import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { emitLikeNotification, retractLikeNotification, emitMentionsFromText } from "@/lib/notifications";

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export type InteractionSummary = {
  likes: number;
  reposts: number;
  comments: number;
  bookmarks: number;
  viewerLiked: boolean;
  viewerReposted: boolean;
  viewerBookmarked: boolean;
};

export type Comment = {
  id: string;
  postId: string;
  author: string;
  content: string;
  createdAt: string;
};

export async function getInteractionSummaries(args: { postIds: string[]; viewer?: string }) {
  const postIds = Array.from(new Set(args.postIds.map((v) => v.trim()).filter(Boolean))).slice(0, 200);
  const viewer = args.viewer ? normalizeAddress(args.viewer) : "";
  const summaries: Record<string, InteractionSummary> = {};

  for (const id of postIds) {
    summaries[id] = {
      likes: 0,
      reposts: 0,
      comments: 0,
      bookmarks: 0,
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false
    };
  }

  if (postIds.length === 0) return summaries;

  const supabase = getSupabaseAdmin();

  const [likesRes, repostsRes, commentsRes, bookmarksRes] = await Promise.all([
    supabase.from("post_likes").select("post_id,user_address").in("post_id", postIds),
    supabase.from("post_reposts").select("post_id,user_address").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    supabase.from("post_bookmarks").select("post_id,user_address").in("post_id", postIds)
  ]);

  if (likesRes.error) throw new Error(`Likes read failed: ${likesRes.error.message}`);
  if (repostsRes.error) throw new Error(`Reposts read failed: ${repostsRes.error.message}`);
  if (commentsRes.error) throw new Error(`Comments read failed: ${commentsRes.error.message}`);
  if (bookmarksRes.error) throw new Error(`Bookmarks read failed: ${bookmarksRes.error.message}`);

  for (const row of (likesRes.data ?? []) as { post_id: string; user_address: string }[]) {
    const s = summaries[row.post_id];
    if (!s) continue;
    s.likes += 1;
    if (viewer && normalizeAddress(row.user_address) === viewer) s.viewerLiked = true;
  }

  for (const row of (repostsRes.data ?? []) as { post_id: string; user_address: string }[]) {
    const s = summaries[row.post_id];
    if (!s) continue;
    s.reposts += 1;
    if (viewer && normalizeAddress(row.user_address) === viewer) s.viewerReposted = true;
  }

  for (const row of (commentsRes.data ?? []) as { post_id: string }[]) {
    const s = summaries[row.post_id];
    if (!s) continue;
    s.comments += 1;
  }

  for (const row of (bookmarksRes.data ?? []) as { post_id: string; user_address: string }[]) {
    const s = summaries[row.post_id];
    if (!s) continue;
    s.bookmarks += 1;
    if (viewer && normalizeAddress(row.user_address) === viewer) s.viewerBookmarked = true;
  }

  return summaries;
}

export async function toggleLike(args: { postId: string; viewer: string }) {
  const postId = args.postId.trim();
  const viewer = normalizeAddress(args.viewer);
  if (!postId) throw new Error("postId is required.");
  if (!viewer) throw new Error("Connect wallet first.");

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existsErr } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_address", viewer)
    .maybeSingle();

  if (existsErr) throw new Error(`Like read failed: ${existsErr.message}`);

  if (existing) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_address", viewer);
    if (error) throw new Error(`Unlike failed: ${error.message}`);
    try {
      await retractLikeNotification({ postId, actor: viewer });
    } catch (e) {
      console.warn("[notifications] retract like failed:", e);
    }
    return { liked: false };
  }

  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_address: viewer });
  if (error) throw new Error(`Like failed: ${error.message}`);
  try {
    await emitLikeNotification({ postId, actor: viewer });
  } catch (e) {
    console.warn("[notifications] emit like failed:", e);
  }
  return { liked: true };
}

export async function toggleRepost(args: { postId: string; viewer: string }) {
  const postId = args.postId.trim();
  const viewer = normalizeAddress(args.viewer);
  if (!postId) throw new Error("postId is required.");
  if (!viewer) throw new Error("Connect wallet first.");

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existsErr } = await supabase
    .from("post_reposts")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_address", viewer)
    .maybeSingle();

  if (existsErr) throw new Error(`Repost read failed: ${existsErr.message}`);

  if (existing) {
    const { error } = await supabase
      .from("post_reposts")
      .delete()
      .eq("post_id", postId)
      .eq("user_address", viewer);
    if (error) throw new Error(`Undo repost failed: ${error.message}`);
    return { reposted: false };
  }

  const { error } = await supabase.from("post_reposts").insert({ post_id: postId, user_address: viewer });
  if (error) throw new Error(`Repost failed: ${error.message}`);
  return { reposted: true };
}

export async function toggleBookmark(args: { postId: string; viewer: string }) {
  const postId = args.postId.trim();
  const viewer = normalizeAddress(args.viewer);
  if (!postId) throw new Error("postId is required.");
  if (!viewer) throw new Error("Connect wallet first.");

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existsErr } = await supabase
    .from("post_bookmarks")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_address", viewer)
    .maybeSingle();

  if (existsErr) throw new Error(`Bookmark read failed: ${existsErr.message}`);

  if (existing) {
    const { error } = await supabase
      .from("post_bookmarks")
      .delete()
      .eq("post_id", postId)
      .eq("user_address", viewer);
    if (error) throw new Error(`Remove bookmark failed: ${error.message}`);
    return { bookmarked: false };
  }

  const { error } = await supabase.from("post_bookmarks").insert({ post_id: postId, user_address: viewer });
  if (error) throw new Error(`Bookmark failed: ${error.message}`);
  return { bookmarked: true };
}

export async function listBookmarksByUser(args: { viewer: string; limit?: number }) {
  const viewer = normalizeAddress(args.viewer);
  const limit = Math.max(1, Math.min(100, args.limit ?? 50));
  if (!viewer) throw new Error("viewer is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_bookmarks")
    .select("post_id,created_at")
    .eq("user_address", viewer)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Bookmarks read failed: ${error.message}`);
  return (data ?? []) as { post_id: string; created_at: string }[];
}

export async function listComments(args: { postId: string; limit?: number }) {
  const postId = args.postId.trim();
  const limit = Math.max(1, Math.min(100, args.limit ?? 30));
  if (!postId) throw new Error("postId is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_comments")
    .select("id,post_id,author_address,content,created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Comments read failed: ${error.message}`);

  return ((data ?? []) as { id: string; post_id: string; author_address: string; content: string; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      postId: row.post_id,
      author: row.author_address,
      content: row.content,
      createdAt: row.created_at
    })
  ) as Comment[];
}

export async function createComment(args: { postId: string; author: string; content: string }) {
  const postId = args.postId.trim();
  const author = normalizeAddress(args.author);
  const content = args.content.trim();
  if (!postId) throw new Error("postId is required.");
  if (!author) throw new Error("Connect wallet first.");
  if (!content) throw new Error("Comment is required.");
  if (content.length > 280) throw new Error("Comment must be 280 characters or less.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_address: author, content })
    .select("id,post_id,author_address,content,created_at")
    .single();

  if (error) throw new Error(`Comment create failed: ${error.message}`);

  // Mentions in comments also create notifications.
  try {
    await emitMentionsFromText({ text: content, actor: author, postId, entityId: String(data.id) });
  } catch (e) {
    console.warn("[notifications] emit comment mentions failed:", e);
  }

  return {
    id: data.id,
    postId: data.post_id,
    author: data.author_address,
    content: data.content,
    createdAt: data.created_at
  } as Comment;
}

export async function listRepliesByAuthor(args: { author: string; limit?: number }) {
  const author = normalizeAddress(args.author);
  const limit = Math.max(1, Math.min(100, args.limit ?? 50));
  if (!author) throw new Error("author is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_comments")
    .select("id,post_id,author_address,content,created_at")
    .eq("author_address", author)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Replies read failed: ${error.message}`);

  return ((data ?? []) as { id: string; post_id: string; author_address: string; content: string; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      postId: row.post_id,
      author: row.author_address,
      content: row.content,
      createdAt: row.created_at
    })
  ) as Comment[];
}
