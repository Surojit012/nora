import "server-only";

import { listShelbyPosts } from "@/lib/shelbyServer";
import { getInteractionSummaries, type InteractionSummary } from "@/lib/interactions";
import type { Post } from "@/lib/types";
import { extractHashtags } from "@/lib/hashtags";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ExploreMode = "for_you" | "trending" | "latest";

import { normalizeAddress } from "@/lib/addresses";

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}


function getTagsForPostsFromContent(posts: Post[]) {
  const map = new Map<string, string[]>();
  for (const post of posts) {
    const tags = extractHashtags(post.text ?? "")
      .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean);
    map.set(post.id, tags);
  }
  return map;
}

async function listViewerSignalPostIds(viewer: string, limit: number) {
  const addr = normalizeAddress(viewer);
  if (!addr) return [];

  const supabase = getSupabaseAdmin();
  const [likes, comments] = await Promise.all([
    supabase
      .from("post_likes")
      .select("post_id,created_at")
      .eq("user_address", addr)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("post_comments")
      .select("post_id,created_at")
      .eq("author_address", addr)
      .order("created_at", { ascending: false })
      .limit(limit)
  ]);

  if (likes.error) throw new Error(`Viewer likes read failed: ${likes.error.message}`);
  if (comments.error) throw new Error(`Viewer comments read failed: ${comments.error.message}`);

  const seen = new Set<string>();
  for (const row of (likes.data ?? []) as { post_id: string }[]) seen.add(row.post_id);
  for (const row of (comments.data ?? []) as { post_id: string }[]) seen.add(row.post_id);
  return [...seen].slice(0, limit * 2);
}

function computeBaseScore(post: Post, s: InteractionSummary) {
  const now = Date.now();
  const created = Date.parse(post.createdAt);
  const ageHours = Math.max(0, (now - (Number.isFinite(created) ? created : now)) / 3_600_000);

  // Engagement: comments are heavier than likes.
  const engagement = s.likes * 1 + s.comments * 2.2;
  const engagementScore = Math.log1p(engagement) * 2.25;

  // Recency: fast drop after 24h, long tail after 7d.
  const recencyScore = Math.exp(-ageHours / 24) * 1.75 + Math.exp(-ageHours / 168) * 0.75;

  // Slight boost for richer media posts.
  const mediaBoost = post.attachments?.length ? 0.35 : 0;

  return engagementScore + recencyScore + mediaBoost;
}

function computeInterestBoost(postTags: string[], viewerTagWeights: Map<string, number>) {
  if (!postTags.length || viewerTagWeights.size === 0) return 0;
  let score = 0;
  for (const tag of postTags) {
    score += viewerTagWeights.get(tag) ?? 0;
  }
  // Cap so we don't hard lock into a single niche.
  return Math.min(2.0, score) * 1.15;
}

function applyDiversity(posts: { post: Post; score: number }[], perAuthorCap: number) {
  const out: { post: Post; score: number }[] = [];
  const seenByAuthor = new Map<string, number>();
  for (const item of posts) {
    const author = normalizeAddress(item.post.author);
    const used = seenByAuthor.get(author) ?? 0;
    if (used >= perAuthorCap) continue;
    seenByAuthor.set(author, used + 1);
    out.push(item);
  }
  return out;
}

export async function getExploreFeed(args: { mode?: string; viewer?: string; limit?: number; mediaOnly?: boolean }) {
  const mode = (args.mode ?? "for_you") as ExploreMode;
  const limit = clampInt(args.limit, 1, 50, 30);
  const viewer = typeof args.viewer === "string" ? normalizeAddress(args.viewer) : "";
  const mediaOnly = Boolean(args.mediaOnly);

  const poolSize = mediaOnly ? 800 : mode === "latest" ? 400 : mode === "trending" ? 500 : 600;
  const poolAll = await listShelbyPosts({ limit: poolSize });
  const pool = mediaOnly ? poolAll.filter((p) => (p.attachments ?? []).some((a) => a.kind === "image" || a.kind === "video")) : poolAll;

  const summaries = await getInteractionSummaries({
    postIds: pool.map((p) => p.id),
    viewer: viewer || undefined
  });

  // For-you uses viewer tag affinity; without viewer, fall back to trending ranking.
  let viewerTagWeights = new Map<string, number>();
  let tagsByPost = new Map<string, string[]>();

  if (mode === "for_you" && viewer) {
    const signalPostIds = await listViewerSignalPostIds(viewer, 120);
    const signalTags = getTagsForPostsFromContent(
      pool.filter((p) => signalPostIds.includes(p.id))
    );
    const counts = new Map<string, number>();
    for (const tags of signalTags.values()) {
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    // Weight by rank (diminishing returns).
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    viewerTagWeights = new Map(top.map(([tag, count], i) => [tag, count / Math.sqrt(i + 1)]));
    tagsByPost = getTagsForPostsFromContent(pool);
  } else if (mode !== "latest") {
    tagsByPost = getTagsForPostsFromContent(pool);
  }

  const scored = pool.map((post) => {
    const s = summaries[post.id] ?? { likes: 0, comments: 0, bookmarks: 0, viewerLiked: false, viewerBookmarked: false };
    const base = computeBaseScore(post, s);
    const tags = tagsByPost.get(post.id) ?? [];
    const interest = mode === "for_you" && viewer ? computeInterestBoost(tags, viewerTagWeights) : 0;
    
    return { post, score: base + interest };
  });

  const sorted =
    mode === "latest"
      ? scored.sort((a, b) => +new Date(b.post.createdAt) - +new Date(a.post.createdAt))
      : scored.sort((a, b) => b.score - a.score);

  const diversified = applyDiversity(sorted, 2).slice(0, limit);
  const selectedPosts = diversified.map((x) => x.post);
  const selectedInteractions: Record<string, InteractionSummary> = {};
  for (const p of selectedPosts) {
    selectedInteractions[p.id] = summaries[p.id] ?? { likes: 0, comments: 0, bookmarks: 0, viewerLiked: false, viewerBookmarked: false };
  }

  return { posts: selectedPosts, interactions: selectedInteractions };
}
