import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type TrendingItem = { tag: string; count: number };

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function getTrendingSince(sinceMs: number, limit: number): Promise<TrendingItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error: dbError } = await supabase
    .from("post_hashtags")
    .select("tag, post_timestamp")
    .gte("post_timestamp", sinceMs);

  if (dbError) throw new Error(dbError.message);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { tag: string }[]) {
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
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

    const now = Date.now();
    const last24h = await getTrendingSince(now - 24 * 60 * 60 * 1000, limit);
    const last7d = await getTrendingSince(now - 7 * 24 * 60 * 60 * 1000, limit);

    return NextResponse.json({ last24h, last7d });
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "Failed to fetch trending hashtags.");
  }
}

