import { NextRequest, NextResponse } from "next/server";
import { listTopCreators } from "@/lib/suggestions";

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
    const viewer = String(request.nextUrl.searchParams.get("viewer") ?? "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "3");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 3;

    const creators = await listTopCreators({ viewer: viewer || undefined, limit });
    return NextResponse.json({ creators });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch creators.", details);
  }
}

