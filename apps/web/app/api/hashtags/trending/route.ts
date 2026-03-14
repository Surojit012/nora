import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type TrendingItem = { tag: string; count: number };

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function getTrendingAllTime(limit: number): Promise<TrendingItem[]> {
  const { data, error: dbError } = await supabase
    .from("post_hashtags")
    .select("tag");

  if (dbError) throw new Error(dbError.message);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { tag: string }[]) {
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));

  return sorted;
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
