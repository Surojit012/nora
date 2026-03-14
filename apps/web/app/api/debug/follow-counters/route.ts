import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(Math.max(Math.floor(parsed), 1), 1000);
}

function parseOnlyMismatches(raw: string | null) {
  if (raw === null) return true;
  return raw !== "false" && raw !== "0";
}

export async function GET(request: NextRequest) {
  try {
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const onlyMismatches = parseOnlyMismatches(request.nextUrl.searchParams.get("onlyMismatches"));
    const supabase = getSupabaseAdmin();

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("wallet_address,username,followers_count")
      .limit(limit);

    if (usersError) {
      return NextResponse.json(
        { ok: false, error: "Failed to read users.", details: usersError.message },
        { status: 500 }
      );
    }

    const mismatches: Array<{
      wallet_address: string;
      username: string;
      cached_count: number;
      live_count: number;
    }> = [];

    const rows = (users ?? []) as {
      wallet_address: string;
      username: string;
      followers_count: number | null;
    }[];

    for (const row of rows) {
      const { count, error } = await supabase
        .from("follows")
        .select("follower_address", { count: "exact", head: true })
        .eq("following_address", row.wallet_address);

      if (error) {
        return NextResponse.json(
          { ok: false, error: "Failed to read follows.", details: error.message },
          { status: 500 }
        );
      }

      const liveCount = typeof count === "number" ? count : 0;
      const cachedCount = typeof row.followers_count === "number" ? row.followers_count : 0;
      if (cachedCount !== liveCount) {
        mismatches.push({
          wallet_address: row.wallet_address,
          username: row.username,
          cached_count: cachedCount,
          live_count: liveCount
        });
      } else if (!onlyMismatches) {
        mismatches.push({
          wallet_address: row.wallet_address,
          username: row.username,
          cached_count: cachedCount,
          live_count: liveCount
        });
      }
    }

    return NextResponse.json(
      {
        ok: mismatches.length === 0 || !onlyMismatches,
        checked: rows.length,
        mismatches
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Follow counter check failed.", details: e instanceof Error ? e.message : "Unknown error." },
      { status: 500 }
    );
  }
}
