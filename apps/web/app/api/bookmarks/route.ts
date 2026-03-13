import { NextRequest, NextResponse } from "next/server";
import { listBookmarksByUser } from "@/lib/interactions";
import { fetchShelbyPostById } from "@/lib/shelbyServer";

export const runtime = "nodejs";

function toErrorResponse(status: number, error: string, details?: string) {
  return NextResponse.json(
    {
      error,
      ...(details ? { details } : {})
    },
    { status }
  );
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function GET(request: NextRequest) {
  try {
    const viewer = String(request.nextUrl.searchParams.get("viewer") ?? "").trim();
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") ?? "50") || 50));
    if (!viewer) return toErrorResponse(400, "viewer is required.");

    const rows = await listBookmarksByUser({ viewer, limit });
    const postIds = rows.map((r) => r.post_id);

    const posts = await mapWithConcurrency(postIds, 10, async (postId) => {
      try {
        return await fetchShelbyPostById(postId);
      } catch {
        return null;
      }
    });

    return NextResponse.json((posts.filter(Boolean) as unknown[]));
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch bookmarks.", details);
  }
}

