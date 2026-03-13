import { NextRequest, NextResponse } from "next/server";
import { signupUser } from "@/lib/identity";

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? "");
    const bio = String(body?.bio ?? "");
    const avatar = String(body?.avatar ?? "");
    const wallet_address = String(body?.wallet_address ?? "");

    if (!username.trim() || !wallet_address.trim()) {
      return errorResponse(400, "Username and wallet_address are required.");
    }

    const user = await signupUser({ username, bio, avatar, wallet_address });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : "Signup failed.");
  }
}
