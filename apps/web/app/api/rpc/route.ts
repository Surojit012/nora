import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredEnv } from "@/lib/supabaseAdmin"; // Reusing the utility

const RpcPayloadSchema = z.union([
  z.object({
    jsonrpc: z.string(),
    method: z.string(),
    params: z.any().optional(),
    id: z.union([z.string(), z.number(), z.null()]).optional(),
  }),
  z.array(
    z.object({
      jsonrpc: z.string(),
      method: z.string(),
      params: z.any().optional(),
      id: z.union([z.string(), z.number(), z.null()]).optional(),
    })
  )
]);

export async function POST(req: NextRequest) {
  try {
    const rpcUrl = getRequiredEnv("SHELBY_RPC_BASE_URL");
    const apiKey = process.env.SHELBY_RPC_API_KEY;

    let bodyJson;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = RpcPayloadSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid JSON-RPC payload", details: parsed.error.issues }, { status: 400 });
    }

    const body = JSON.stringify(parsed.data);

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
