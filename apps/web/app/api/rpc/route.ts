import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/supabaseAdmin"; // Reusing the utility

export async function POST(req: NextRequest) {
  try {
    const rpcUrl = getRequiredEnv("SHELBY_RPC_BASE_URL");
    const apiKey = process.env.SHELBY_RPC_API_KEY;

    // Optional: add rate limiting or session validation here
    // ...

    const body = await req.text();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error("RPC Proxy Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
