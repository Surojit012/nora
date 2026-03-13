import { NextResponse } from "next/server";
import { getExploreFeed } from "@/lib/explore";

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "for_you";
    const viewer = url.searchParams.get("viewer") ?? "";
    const limit = url.searchParams.get("limit") ?? "";
    const mediaOnly = url.searchParams.get("mediaOnly") === "1";

    const data = await getExploreFeed({
      mode,
      viewer: viewer || undefined,
      limit: limit ? Number(limit) : undefined,
      mediaOnly
    });

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return error(500, "Failed to load explore feed.", e instanceof Error ? e.message : "Unknown error.");
  }
}
