import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExploreFeed } from "@/lib/explore";
import { normalizeAddress } from "@/lib/addresses";

const FeedQuerySchema = z.object({
  mode: z.enum(["for_you", "trending"]).default("for_you"),
  viewer: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const parsed = FeedQuerySchema.safeParse({
      mode: request.nextUrl.searchParams.get("mode") ?? undefined,
      viewer: request.nextUrl.searchParams.get("viewer") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return error(400, "Invalid query parameters.", parsed.error.message);
    }

    const { mode, viewer, limit } = parsed.data;
    const viewerAddress = typeof viewer === "string" ? normalizeAddress(viewer) : "";

    console.log(`[API/FEED] Fetching mode=${mode}, viewer=${viewerAddress}`);

    const data = await getExploreFeed({
      mode: mode === "trending" ? "trending" : "for_you",
      viewer: viewerAddress || undefined,
      limit
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return error(500, "Failed to load feed.", e instanceof Error ? e.message : "Unknown error.");
  }
}
