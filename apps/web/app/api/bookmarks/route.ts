import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listBookmarksByUser } from "@/lib/interactions";
import { fetchShelbyPostById } from "@/lib/shelbyServer";

export const runtime = "nodejs";

const BookmarksQuerySchema = z.object({
  viewer: z.string().min(1, "Viewer address is required"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

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
    const rawViewer = request.nextUrl.searchParams.get("viewer");
    const rawLimit = request.nextUrl.searchParams.get("limit");
    
    const parsed = BookmarksQuerySchema.safeParse({ viewer: rawViewer, limit: rawLimit });
    
    if (!parsed.success) {
      return toErrorResponse(400, "Invalid query parameters.", parsed.error.message);
    }

    const { viewer, limit } = parsed.data;

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
