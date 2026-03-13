import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const walletAddress = String(form.get("wallet_address") ?? "").trim().toLowerCase();
    const file = form.get("file");

    if (!walletAddress) return error(400, "wallet_address is required.");
    if (!file || !(file instanceof File)) return error(400, "file is required.");
    if (!ALLOWED_TYPES.has(file.type)) return error(400, "Unsupported file type.");
    if (file.size > MAX_BYTES) return error(400, "File too large (max 5MB).");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = extFromMime(file.type);
    const objectPath = `covers/${walletAddress}/${Date.now()}-${randomUUID()}.${ext}`;

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(objectPath, bytes, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) return error(500, uploadError.message);

    const { data } = supabase.storage.from("covers").getPublicUrl(objectPath);
    return NextResponse.json({ url: data.publicUrl, path: objectPath }, { status: 201 });
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "Upload failed.");
  }
}

