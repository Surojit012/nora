import { NextRequest, NextResponse } from "next/server";
import { listRepliesByAuthor } from "@/lib/interactions";

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
    const author = request.nextUrl.searchParams.get("author") ?? "";
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    if (!author.trim()) return toErrorResponse(400, "author is required.");

    const replies = await listRepliesByAuthor({
      author,
      ...(typeof limit === "number" && Number.isFinite(limit) ? { limit } : {})
    });
    return NextResponse.json({ replies });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch replies.", details);
  }
}

