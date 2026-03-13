import { NextRequest, NextResponse } from "next/server";
import { getInteractionSummaries } from "@/lib/interactions";

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
    const postIdsRaw = request.nextUrl.searchParams.get("postIds") ?? "";
    const viewer = request.nextUrl.searchParams.get("viewer") ?? undefined;
    const postIds = postIdsRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 200);

    if (postIds.length === 0) return NextResponse.json({ items: {} });

    const items = await getInteractionSummaries({ postIds, viewer });
    return NextResponse.json({ items });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch interactions.", details);
  }
}

