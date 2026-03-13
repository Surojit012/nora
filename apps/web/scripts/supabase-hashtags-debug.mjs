import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  const out = {};
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  const root = path.resolve(process.cwd(), "../..");
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(root, ".env.local"),
    path.join(root, ".env"),
  ];
  for (const file of candidates) {
    const parsed = parseEnvFile(file);
    for (const [k, v] of Object.entries(parsed)) {
      if (!process.env[k] && typeof v === "string" && v.length > 0) process.env[k] = v;
    }
  }
}

function requireEnv(name) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  loadEnv();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tag = (process.argv[2] ?? "shelby").trim().toLowerCase();

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { count, error: countErr } = await supabase
    .from("post_hashtags")
    .select("*", { count: "exact", head: true })
    .eq("tag", tag);
  if (countErr) throw new Error(countErr.message);

  const { data, error } = await supabase
    .from("post_hashtags")
    .select("post_id, blob_name, author, post_timestamp, tag, created_at")
    .eq("tag", tag)
    .order("post_timestamp", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  console.log(JSON.stringify({ tag, count: count ?? 0, sample: data ?? [] }, null, 2));
}

main().catch((e) => {
  console.error("[supabase-hashtags-debug] ERROR:", e?.message ?? String(e));
  process.exitCode = 1;
});

