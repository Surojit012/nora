import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const RepliesQuerySchema = z.object({
  author: z.string().min(1, "Author is required"),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rawAuthor = request.nextUrl.searchParams.get("author");
    const rawLimit = request.nextUrl.searchParams.get("limit");

    const parsed = RepliesQuerySchema.safeParse({ 
      author: rawAuthor ?? undefined, 
      limit: rawLimit ?? undefined 
    });

    if (!parsed.success) {
      return toErrorResponse(400, "Invalid query parameters.", parsed.error.message);
    }

    const { author, limit } = parsed.data;

    const replies = await listRepliesByAuthor({
      author,
      ...(limit ? { limit } : {})
    });
    return NextResponse.json({ replies });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch replies.", details);
  }
}
