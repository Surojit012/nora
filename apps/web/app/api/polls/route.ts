import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const PollsQuerySchema = z.object({
  postId: z.string().min(1, "postId is required"),
  optionsCount: z.coerce.number().int().min(2, "At least 2 options required").max(4, "Max 4 options"),
  voter: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rawPostId = request.nextUrl.searchParams.get("postId");
    const rawOptions = request.nextUrl.searchParams.get("options");
    const rawVoter = request.nextUrl.searchParams.get("voter");

    const parsed = PollsQuerySchema.safeParse({
      postId: rawPostId ?? undefined,
      optionsCount: rawOptions ?? undefined,
      voter: rawVoter ?? undefined
    });

    if (!parsed.success) {
      return toErrorResponse(400, "Invalid query parameters.", parsed.error.message);
    }

    const { postId, optionsCount, voter } = parsed.data;

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
