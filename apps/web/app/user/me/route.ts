import { NextRequest, NextResponse } from "next/server";
import { updateUserByWalletAddress } from "@/lib/identity";

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = String(body?.wallet_address ?? "");
    const bio = typeof body?.bio === "string" ? body.bio : undefined;
    const avatar = typeof body?.avatar === "string" ? body.avatar : undefined;
    const cover = typeof body?.cover === "string" ? body.cover : undefined;

    if (!walletAddress.trim()) {
      return errorResponse(400, "wallet_address is required.");
    }

    const user = await updateUserByWalletAddress(walletAddress, { bio, avatar, cover });
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : "Failed to update profile.");
  }
}
