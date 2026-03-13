import { NextRequest, NextResponse } from "next/server";
import { castPollVote } from "@/lib/polls";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          postId?: unknown;
          voter?: unknown;
          optionIndex?: unknown;
          options?: unknown;
        }
      | null;

    const postId = String(body?.postId ?? "").trim();
    const voter = String(body?.voter ?? "").trim();
    const optionIndex = Number(body?.optionIndex);
    const optionsCount = Number(body?.options);

    if (!postId) return toErrorResponse(400, "postId is required.");
    if (!voter) return toErrorResponse(400, "Connect wallet first.");
    if (!Number.isFinite(optionIndex)) return toErrorResponse(400, "optionIndex is required.");
    if (!Number.isFinite(optionsCount)) return toErrorResponse(400, "options is required.");

    await castPollVote({
      postId,
      voterAddress: voter,
      optionIndex,
      optionsCount
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to vote.", details);
  }
}

