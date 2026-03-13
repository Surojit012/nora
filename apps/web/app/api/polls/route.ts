import { NextRequest, NextResponse } from "next/server";
import { getPollResults } from "@/lib/polls";

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
    const optionsRaw = request.nextUrl.searchParams.get("options") ?? "";
    const voter = request.nextUrl.searchParams.get("voter") ?? undefined;

    const optionsCount = Number(optionsRaw);
    if (!postId.trim()) return toErrorResponse(400, "postId is required.");
    if (!Number.isFinite(optionsCount)) return toErrorResponse(400, "options is required.");

    const results = await getPollResults({
      postId,
      optionsCount,
      ...(voter ? { voterAddress: voter } : {})
    });

    return NextResponse.json(results);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch poll results.", details);
  }
}

