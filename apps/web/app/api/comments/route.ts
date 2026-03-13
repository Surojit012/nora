import { NextRequest, NextResponse } from "next/server";
import { createComment, listComments } from "@/lib/interactions";

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

export async function GET(request: NextRequest) {
  try {
    const postId = request.nextUrl.searchParams.get("postId") ?? "";
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    if (!postId.trim()) return toErrorResponse(400, "postId is required.");

    const comments = await listComments({ postId, ...(typeof limit === "number" && Number.isFinite(limit) ? { limit } : {}) });
    return NextResponse.json({ comments });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch comments.", details);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { postId?: unknown; author?: unknown; content?: unknown } | null;
    const postId = String(body?.postId ?? "").trim();
    const author = String(body?.author ?? "").trim();
    const content = String(body?.content ?? "");
    if (!postId) return toErrorResponse(400, "postId is required.");
    if (!author) return toErrorResponse(400, "Connect wallet first.");

    const comment = await createComment({ postId, author, content });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to comment.", details);
  }
}

