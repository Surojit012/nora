import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/identity";

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet_address = String(body?.wallet_address ?? "");

    if (!wallet_address.trim()) {
      return errorResponse(400, "wallet_address is required.");
    }

    const result = await loginUser({ wallet_address });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Login failed.");
  }
}
