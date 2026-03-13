import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const InteractionsQuerySchema = z.object({
  postIdsRaw: z.string().optional(),
  viewer: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rawPostIds = request.nextUrl.searchParams.get("postIds");
    const rawViewer = request.nextUrl.searchParams.get("viewer");

    const parsed = InteractionsQuerySchema.safeParse({
      postIdsRaw: rawPostIds ?? undefined,
      viewer: rawViewer ?? undefined,
    });

    if (!parsed.success) {
      return toErrorResponse(400, "Invalid query parameters.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { postIdsRaw, viewer } = parsed.data;

    const postIds = (postIdsRaw ?? "")
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
