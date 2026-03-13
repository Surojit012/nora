import { NextResponse } from "next/server";
import { z } from "zod";
import { listNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

const NotificationsQuerySchema = z.object({
  viewer: z.string().min(1, "Connect wallet first."),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawViewer = url.searchParams.get("viewer");
    const rawLimit = url.searchParams.get("limit");

    const parsed = NotificationsQuerySchema.safeParse({ 
      viewer: rawViewer ?? undefined, 
      limit: rawLimit ?? undefined 
    });

    if (!parsed.success) {
      return error(400, "Invalid query parameters.", parsed.error.message);
    }

    const { viewer, limit } = parsed.data;

    const items = await listNotifications({ 
      viewer, 
      ...(limit ? { limit } : {}) 
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to fetch notifications.", e instanceof Error ? e.message : "Unknown error.");
  }
}
