import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExploreFeed } from "@/lib/explore";
import { listShelbyPosts } from "@/lib/shelbyServer";
import { getInteractionSummaries } from "@/lib/interactions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const FeedQuerySchema = z.object({
  mode: z.enum(["for_you", "following", "trending"]).default("for_you"),
  viewer: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

async function listFollowingAddresses(viewer: string) {
  const supabase = getSupabaseAdmin();
  const { data, error: dbError } = await supabase
    .from("follows")
    .select("following_address")
    .eq("follower_address", viewer);

  if (dbError) throw new Error(`Follows read failed: ${dbError.message}`);
  return (data ?? [])
    .map((row: { following_address?: string }) => normalizeAddress(row.following_address ?? ""))
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const parsed = FeedQuerySchema.safeParse({
      mode: request.nextUrl.searchParams.get("mode") ?? undefined,
      viewer: request.nextUrl.searchParams.get("viewer") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return error(400, "Invalid query parameters.", parsed.error.message);
    }

    const { mode, viewer, limit } = parsed.data;
    const viewerAddress = typeof viewer === "string" ? normalizeAddress(viewer) : "";

    if (mode === "following") {
      if (!viewerAddress) {
        return NextResponse.json({ posts: [], interactions: {} }, { status: 200 });
      }

      const following = new Set(await listFollowingAddresses(viewerAddress));
      if (following.size === 0) {
        return NextResponse.json({ posts: [], interactions: {} }, { status: 200 });
      }

      const poolSize = Math.max(200, limit * 8);
      const posts = (await listShelbyPosts({ limit: poolSize })).filter((post) =>
        following.has(normalizeAddress(post.author))
      );

      const selected = posts.slice(0, limit);
      const interactions = await getInteractionSummaries({
        postIds: selected.map((p) => p.id),
        viewer: viewerAddress || undefined
      });

      return NextResponse.json({ posts: selected, interactions }, { status: 200 });
    }

    const data = await getExploreFeed({
      mode: mode === "trending" ? "trending" : "for_you",
      viewer: viewerAddress || undefined,
      limit
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return error(500, "Failed to load feed.", e instanceof Error ? e.message : "Unknown error.");
  }
}
