import { NextRequest, NextResponse } from "next/server";
import { getDebugBlobStats } from "@/lib/shelbyServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const author = request.nextUrl.searchParams.get("author") ?? undefined;
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const stats = await getDebugBlobStats({
      ...(author ? { author } : {}),
      ...(typeof limit === "number" && Number.isFinite(limit) ? { limit } : {})
    });

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug stats failed.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

