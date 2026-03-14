import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const CommentSchema = z.object({
  postId: z.string().trim().min(1, "postId is required"),
  author: z.string().trim().min(1, "Connect wallet first"),
  content: z.string()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CommentSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(400, "Invalid data.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { postId, author, content } = parsed.data;

    const comment = await createComment({ postId, author, content });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to comment.", details);
  }
}

