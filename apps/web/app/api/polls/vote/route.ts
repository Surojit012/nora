import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const PollVoteSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  voter: z.string().min(1, "Connect wallet first"),
  optionIndex: z.coerce.number().int().min(0, "Invalid optionIndex"),
  optionsCount: z.coerce.number().int().min(2, "options required").max(4, "options too large"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Rename body field 'options' to 'optionsCount' for schema match
    const payload = {
      ...body,
      optionsCount: body.options
    };

    const parsed = PollVoteSchema.safeParse(payload);
    
    if (!parsed.success) {
      return toErrorResponse(400, "Invalid vote data.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { postId, voter, optionIndex, optionsCount } = parsed.data;

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
