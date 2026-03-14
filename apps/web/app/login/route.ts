import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginUser } from "@/lib/identity";

function errorResponse(status: number, error: string, details?: string) {
  return NextResponse.json({ error, ...(details ? { details } : {}) }, { status });
}

const LoginSchema = z.object({
  wallet_address: z.string().trim().min(1, "wallet_address is required."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "Invalid data.", parsed.error.issues.map(i => i.message).join(", "));
    }
    
    const { wallet_address } = parsed.data;

    const result = await loginUser({ wallet_address });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Login failed.");
  }
}
