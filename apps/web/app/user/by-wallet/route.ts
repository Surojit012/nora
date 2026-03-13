import { NextRequest, NextResponse } from "next/server";
import { getUserByWalletAddress } from "@/lib/identity";

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.nextUrl.searchParams.get("wallet_address") ?? "";
    if (!walletAddress.trim()) {
      return NextResponse.json({ error: "wallet_address is required." }, { status: 400 });
    }

    const user = await getUserByWalletAddress(walletAddress);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user." },
      { status: 500 }
    );
  }
}
