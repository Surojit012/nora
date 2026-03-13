import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Minimal check: can read a known table.
    const { error } = await supabase.from("users").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "Supabase check failed.", details: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Supabase check failed.", details: e instanceof Error ? e.message : "Unknown error." },
      { status: 500 }
    );
  }
}

