import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signupUser } from "@/lib/identity";

function errorResponse(status: number, error: string, details?: string) {
  return NextResponse.json({ error, ...(details ? { details } : {}) }, { status });
}

const SignupSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  wallet_address: z.string().trim().min(1, "wallet_address is required."),
  bio: z.string().optional(),
  avatar: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "Invalid data.", parsed.error.issues.map(i => i.message).join(", "));
    }
    const { username, bio, avatar, wallet_address } = parsed.data;

    const user = await signupUser({ username, bio, avatar, wallet_address });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : "Signup failed.");
  }
}
