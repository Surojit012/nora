import { NextResponse } from "next/server";
import { runShelbyHealthCheck } from "@/lib/shelbyServer";

export async function GET() {
  try {
    const health = await runShelbyHealthCheck();
    const ok = health.checks.metadata.ok && health.checks.rpc.ok;
    return NextResponse.json(health, { status: ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Shelby health check failed.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
