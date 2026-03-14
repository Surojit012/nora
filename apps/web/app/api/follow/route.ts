import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isFollowing } from "@/lib/notifications";

export const runtime = "nodejs";

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const follower = String(request.nextUrl.searchParams.get("follower") ?? "").trim();
    const following = String(request.nextUrl.searchParams.get("following") ?? "").trim();
    if (!follower) return error(400, "follower address required.");
    if (!following) return error(400, "following address required.");

    const followingState = await isFollowing({ follower, following });
    return NextResponse.json({ following: followingState }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to read follow state.", e instanceof Error ? e.message : "Unknown error.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const followerAddress = String(body.follower ?? "").trim();
    const following = String(body.following ?? "").trim();
    
    if (!followerAddress) return error(400, "follower address required.");
    if (!following) return error(400, "following address required.");

    if (followerAddress.toLowerCase() === following.toLowerCase()) {
      return error(400, "You cannot follow yourself.");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: rpcError } = await supabase.rpc("handle_follow", {
      p_follower: followerAddress,
      p_following: following
    });

    if (rpcError) {
      if (rpcError.message.includes("does not exist")) return error(400, "User does not exist.");
      return error(500, "Follow failed.", rpcError.message);
    }

    return NextResponse.json({
      following: data?.following ?? true,
      followersCount: data?.followers_count,
    }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to follow.", e instanceof Error ? e.message : "Unknown error.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const followerAddress = String(body.follower ?? "").trim();
    const following = String(body.following ?? "").trim();

    if (!followerAddress) return error(400, "follower address required.");
    if (!following) return error(400, "following address required.");

    const supabase = getSupabaseAdmin();
    const { data, error: rpcError } = await supabase.rpc("handle_unfollow", {
      p_follower: followerAddress,
      p_following: following
    });

    if (rpcError) return error(500, "Unfollow failed.", rpcError.message);

    return NextResponse.json({
      following: data?.following ?? false,
      followersCount: data?.followers_count,
    }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to unfollow.", e instanceof Error ? e.message : "Unknown error.");
  }
}

