import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SearchSchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(25).default(10)
});

function error(status: number, message: string, details?: string) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const limit = request.nextUrl.searchParams.get("limit") ?? "";

    const parsed = SearchSchema.safeParse({ q, limit });
    if (!parsed.success) {
      return error(400, "Invalid search query.", parsed.error.message);
    }

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("users")
      .select("username,avatar,bio,created_at")
      .ilike("username", `%${parsed.data.q}%`)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);

    if (dbError) {
      return error(500, "Search failed.", dbError.message);
    }

    return NextResponse.json({ users: data ?? [] }, { status: 200 });
  } catch (e) {
    return error(500, "Search failed.", e instanceof Error ? e.message : "Unknown error.");
  }
}
