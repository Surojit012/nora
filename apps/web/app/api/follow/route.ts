import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAuthSignature } from "@/lib/auth";
import { isFollowing } from "@/lib/notifications";

export const runtime = "nodejs";

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const follower = String(request.nextUrl.searchParams.get("follower") ?? "").trim();
    const following = String(request.nextUrl.searchParams.get("following") ?? "").trim();
    if (!follower) return error(400, "Connect wallet first.");
    if (!following) return error(400, "following is required.");

    const followingState = await isFollowing({ follower, following });
    return NextResponse.json({ following: followingState }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to read follow state.", e instanceof Error ? e.message : "Unknown error.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuthSignature(request, "\"Follow ");
    if (!auth) return error(401, "Unauthorized: Invalid wallet signature.");

    const body = await request.json().catch(() => ({}));
    const following = String(body.following ?? "").trim();
    if (!following) return error(400, "Invalid following address.");

    if (auth.walletAddress.toLowerCase() === following.toLowerCase()) {
      return error(400, "You cannot follow yourself.");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: rpcError } = await supabase.rpc("follow_user", {
      p_follower: auth.walletAddress,
      p_following: following
    });

    if (rpcError) {
      if (rpcError.message.includes("does not exist")) return error(400, "User does not exist.");
      return error(500, "Follow failed.", rpcError.message);
    }

    return NextResponse.json({
      following: data.following,
      followersCount: data.followers_count,
    }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to follow.", e instanceof Error ? e.message : "Unknown error.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAuthSignature(request, "\"Unfollow ");
    if (!auth) return error(401, "Unauthorized: Invalid wallet signature.");

    const body = await request.json().catch(() => ({}));
    const following = String(body.following ?? "").trim();
    if (!following) return error(400, "Invalid following address.");

    const supabase = getSupabaseAdmin();
    const { data, error: rpcError } = await supabase.rpc("unfollow_user", {
      p_follower: auth.walletAddress,
      p_following: following
    });

    if (rpcError) return error(500, "Unfollow failed.", rpcError.message);

    return NextResponse.json({
      following: data.following,
      followersCount: data.followers_count,
    }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to unfollow.", e instanceof Error ? e.message : "Unknown error.");
  }
}

