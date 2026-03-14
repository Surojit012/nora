import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

const POST_PREFIX = "nora/posts/";

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
  const root = path.resolve(process.cwd(), "../.."); // apps/web -> repo root
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(root, ".env.local"),
    path.join(root, ".env"),
  ];
  for (const file of candidates) {
    const parsed = parseEnvFile(file);
    for (const [k, v] of Object.entries(parsed)) {
      if (!process.env[k] && typeof v === "string" && v.length > 0) {
        process.env[k] = v;
      }
    }
  }
}

function requireEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function networkFromString(value) {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "shelbynet") return Network.SHELBYNET;
  if (v === "local") return Network.LOCAL;
  return Network.TESTNET;
}

function extractHashtags(input) {
  const text = input ?? "";
  const tags = new Set();
  const re = /(?:^|[^\w])#([a-zA-Z0-9_]{1,32})/g;
  let match = null;
  while ((match = re.exec(text)) !== null) {
    tags.add(String(match[1]).toLowerCase());
  }
  return [...tags].map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
}

function normalizeTimestamp(value) {
  if (typeof value !== "number") return Date.now();
  return value > 1_000_000_000_000 ? value : value * 1000;
}

async function readBlobAsText(client, account, blobName) {
  const blob = await client.download({ account, blobName });
  return new Response(blob.readable).text();
}

async function main() {
  loadEnv();
  const verbose = process.argv.includes("--verbose");

  const network = networkFromString(process.env.SHELBY_NETWORK ?? process.env.NETWORK);
  const apiKey = requireEnv("SHELBY_API_KEY");
  const privateKeyHex = requireEnv("SHELBY_SIGNER_PRIVATE_KEY");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKeyHex),
  });

  const client = new ShelbyNodeClient({
    network,
    apiKey,
    ...(process.env.SHELBY_APTOS_INDEXER_URL ? { aptos: { indexer: process.env.SHELBY_APTOS_INDEXER_URL } } : {}),
    ...(process.env.SHELBY_RPC_BASE_URL ? { rpc: { baseUrl: process.env.SHELBY_RPC_BASE_URL } } : {}),
  });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const blobs = await client.coordination.getAccountBlobs({ account: signer.accountAddress });
  const postBlobs = blobs
    .filter((b) => b && b.isWritten && !b.isDeleted && typeof b.blobNameSuffix === "string")
    .map((b) => b.blobNameSuffix)
    .filter((name) => name.startsWith(POST_PREFIX));

  console.log("[hashtag-backfill] network:", network);
  console.log("[hashtag-backfill] signer:", signer.accountAddress.toString());
  console.log("[hashtag-backfill] post blobs:", postBlobs.length);

  let processed = 0;
  let indexed = 0;
  let skipped = 0;

  for (const blobName of postBlobs) {
    processed++;
    let raw = "";
    try {
      raw = await readBlobAsText(client, signer.accountAddress, blobName);
    } catch (e) {
      console.warn("[hashtag-backfill] download failed:", blobName, e?.message ?? String(e));
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (verbose) console.log("[hashtag-backfill] skip: invalid JSON:", blobName);
      skipped++;
      continue;
    }

    if (!parsed || parsed.type !== "post") {
      if (verbose) console.log("[hashtag-backfill] skip: not a post:", blobName);
      skipped++;
      continue;
    }

    const tags = extractHashtags(parsed.content ?? "");
    if (tags.length === 0) {
      if (verbose) console.log("[hashtag-backfill] skip: no hashtags:", blobName);
      skipped++;
      continue;
    }

    const author = typeof parsed.author === "string" ? parsed.author.trim().toLowerCase() : "";
    const timestamp = normalizeTimestamp(parsed.timestamp);
    const postId = `${signer.accountAddress.toString()}/${blobName}`;

    const { error: tagErr } = await supabase.from("hashtags").upsert(
      tags.map((tag) => ({ tag })),
      { onConflict: "tag" }
    );
    if (tagErr) {
      console.warn("[hashtag-backfill] tag upsert failed:", tagErr.message);
      continue;
    }

    const { error: mapErr } = await supabase.from("post_hashtags").upsert(
      tags.map((tag) => ({
        post_id: postId,
        blob_name: blobName,
        author,
        post_timestamp: timestamp,
        tag,
      })),
      { onConflict: "post_id,tag" }
    );

    if (mapErr) {
      console.warn("[hashtag-backfill] post_hashtags upsert failed:", mapErr.message);
      continue;
    }

    indexed++;
  }

  console.log("[hashtag-backfill] processed:", processed);
  console.log("[hashtag-backfill] indexed:", indexed);
  console.log("[hashtag-backfill] skipped:", skipped);
}

main().catch((err) => {
  console.error("[hashtag-backfill] ERROR:", err?.message ?? String(err));
  process.exitCode = 1;
});
