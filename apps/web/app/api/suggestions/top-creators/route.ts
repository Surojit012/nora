import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const TopCreatorsQuerySchema = z.object({
  viewer: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(3),
});

export async function GET(request: NextRequest) {
  try {
    const rawViewer = request.nextUrl.searchParams.get("viewer");
    const rawLimit = request.nextUrl.searchParams.get("limit");

    const parsed = TopCreatorsQuerySchema.safeParse({
      viewer: rawViewer ?? undefined,
      limit: rawLimit ?? undefined,
    });

    if (!parsed.success) {
      return toErrorResponse(400, "Invalid query parameters.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { viewer, limit } = parsed.data;

    const creators = await listTopCreators({ viewer, limit });
    return NextResponse.json({ creators });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return toErrorResponse(500, "Failed to fetch creators.", details);
  }
}
