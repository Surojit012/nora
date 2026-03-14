import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateUserByWalletAddress } from "@/lib/identity";

function errorResponse(status: number, error: string, details?: string) {
  return NextResponse.json({ error, ...(details ? { details } : {}) }, { status });
}

const UpdateUserSchema = z.object({
  wallet_address: z.string().trim().min(1, "wallet_address is required."),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  cover: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "Invalid data.", parsed.error.issues.map(i => i.message).join(", "));
    }

    const { wallet_address, bio, avatar, cover } = parsed.data;

    const user = await updateUserByWalletAddress(wallet_address, { bio, avatar, cover });
    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : "Failed to update profile.");
  }
}
