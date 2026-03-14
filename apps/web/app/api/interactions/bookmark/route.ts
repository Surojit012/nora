import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toggleBookmark } from "@/lib/interactions";

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

const BookmarkSchema = z.object({
  postId: z.string().trim().min(1, "postId is required"),
  viewer: z.string().trim().min(1, "Connect wallet first"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = BookmarkSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(400, "Invalid data.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { postId, viewer } = parsed.data;

    const result = await toggleBookmark({ postId, viewer });
    return NextResponse.json(result);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to bookmark.", details);
  }
}

