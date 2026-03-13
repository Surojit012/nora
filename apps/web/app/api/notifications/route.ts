import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = String(url.searchParams.get("viewer") ?? "").trim();
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    if (!viewer) return error(400, "Connect wallet first.");

    const items = await listNotifications({ viewer, ...(typeof limit === "number" && Number.isFinite(limit) ? { limit } : {}) });
    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    return error(500, "Failed to fetch notifications.", e instanceof Error ? e.message : "Unknown error.");
  }
}

