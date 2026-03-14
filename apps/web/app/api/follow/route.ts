import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toggleFollow, isFollowing } from "@/lib/notifications";

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

const FollowSchema = z.object({
  follower: z.string().trim().min(1, "Connect wallet first."),
  following: z.string().trim().min(1, "following is required."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = FollowSchema.safeParse(body);
    if (!parsed.success) {
      return error(400, "Invalid data.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { follower, following } = parsed.data;

    const result = await toggleFollow({ follower, following });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    return error(500, "Failed to follow.", e instanceof Error ? e.message : "Unknown error.");
  }
}

