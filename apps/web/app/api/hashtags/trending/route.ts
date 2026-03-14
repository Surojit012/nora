import { NextResponse } from "next/server";
import { listShelbyPosts } from "@/lib/shelbyServer";
import { extractHashtags } from "@/lib/hashtags";

type TrendingItem = { tag: string; count: number };

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function getTrendingAllTime(limit: number): Promise<TrendingItem[]> {
  const scan = Math.max(200, limit * 20);
  const posts = await listShelbyPosts({ limit: scan });
  const counts = new Map<string, number>();
  for (const post of posts) {
    const tags = extractHashtags(post.text ?? "")
      .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean);
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") ?? 8)));

    const allTime = await getTrendingAllTime(limit);

    return NextResponse.json({ last24h: allTime, last7d: allTime });
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "Failed to fetch trending hashtags.");
  }
}
