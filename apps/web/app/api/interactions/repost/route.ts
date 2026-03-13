import { NextRequest, NextResponse } from "next/server";
import { toggleRepost } from "@/lib/interactions";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { postId?: unknown; viewer?: unknown } | null;
    const postId = String(body?.postId ?? "").trim();
    const viewer = String(body?.viewer ?? "").trim();
    if (!postId) return toErrorResponse(400, "postId is required.");
    if (!viewer) return toErrorResponse(400, "Connect wallet first.");

    const result = await toggleRepost({ postId, viewer });
    return NextResponse.json(result);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to repost.", details);
  }
}

