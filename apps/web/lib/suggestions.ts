import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type TopCreator = {
  username: string;
  walletAddress: string;
  avatar: string;
  followersCount: number;
};

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export async function listTopCreators(args: { viewer?: string; limit?: number }): Promise<TopCreator[]> {
  const limit = Math.max(1, Math.min(20, args.limit ?? 3));
  const viewer = args.viewer ? normalizeAddress(args.viewer) : "";

  const supabase = getSupabaseAdmin();

  // Preload who the viewer is already following (so "Who to follow" is actually useful).
  const followingSet = new Set<string>();
  if (viewer) {
    const { data, error } = await supabase
      .from("follows")
      .select("following_address")
      .eq("follower_address", viewer)
      .limit(500);
    if (error) throw new Error(`follows read failed: ${error.message}`);
    for (const row of (data ?? []) as { following_address: string }[]) {
      followingSet.add(normalizeAddress(row.following_address));
    }
  }

  // Pull a larger candidate set then filter client-side because Supabase filters
  // with NOT IN need explicit arrays and we also want to exclude viewer + followingSet.
  const { data, error } = await supabase
    .from("users")
    .select("username,wallet_address,avatar,followers_count")
    .order("followers_count", { ascending: false })
    .limit(Math.max(50, limit * 20));

  if (error) throw new Error(`users read failed: ${error.message}`);

  const out: TopCreator[] = [];
  for (const row of (data ?? []) as {
    username: string;
    wallet_address: string;
    avatar: string | null;
    followers_count: number | null;
  }[]) {
    const addr = normalizeAddress(row.wallet_address);
    if (!addr) continue;
    if (viewer && addr === viewer) continue;
    if (viewer && followingSet.has(addr)) continue;

    out.push({
      username: row.username,
      walletAddress: row.wallet_address,
      avatar: row.avatar ?? "",
      followersCount: typeof row.followers_count === "number" ? row.followers_count : 0
    });

    if (out.length >= limit) break;
  }

  return out;
}

