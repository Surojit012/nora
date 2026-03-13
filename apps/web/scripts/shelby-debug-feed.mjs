import fs from "node:fs";
import path from "node:path";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

async function readBlobAsText(client, account, blobName) {
  const blob = await client.download({ account, blobName });
  return new Response(blob.readable).text();
}

function tryParsePost(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.type !== "post") return null;
  if (typeof parsed.author !== "string" || typeof parsed.timestamp !== "number") return null;
  return {
    author: parsed.author.trim().toLowerCase(),
    timestamp: parsed.timestamp,
    contentLen: typeof parsed.content === "string" ? parsed.content.length : 0,
  };
}

async function main() {
  loadEnv();

  const network = networkFromString(process.env.SHELBY_NETWORK ?? process.env.NETWORK);
  const apiKey = requireEnv("SHELBY_API_KEY");
  const privateKeyHex = requireEnv("SHELBY_SIGNER_PRIVATE_KEY");
  const authorFilter = (process.argv[2] ?? "").trim().toLowerCase();

  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKeyHex),
  });

  const client = new ShelbyNodeClient({
    network,
    apiKey,
    ...(process.env.SHELBY_APTOS_INDEXER_URL
      ? { aptos: { indexer: process.env.SHELBY_APTOS_INDEXER_URL } }
      : {}),
    ...(process.env.SHELBY_RPC_BASE_URL ? { rpc: { baseUrl: process.env.SHELBY_RPC_BASE_URL } } : {}),
  });

  const blobs = await client.coordination.getAccountBlobs({ account: signer.accountAddress });
  const postBlobs = blobs
    .filter((b) => b && b.isWritten && !b.isDeleted && typeof b.blobNameSuffix === "string")
    .map((b) => b.blobNameSuffix)
    .filter((name) => name.startsWith(POST_PREFIX));

  console.log("[debug-feed] network:", network);
  console.log("[debug-feed] signer:", signer.accountAddress.toString());
  console.log("[debug-feed] total blobs:", blobs.length);
  console.log("[debug-feed] post blobs (nora/posts/*):", postBlobs.length);

  let parsedOk = 0;
  let parsedAsPost = 0;
  let authorMatched = 0;
  const failures = [];

  for (const blobName of postBlobs) {
    try {
      const raw = await readBlobAsText(client, signer.accountAddress, blobName);
      parsedOk++;
      const post = tryParsePost(raw);
      if (!post) {
        failures.push({ blobName, reason: "not-a-post-or-schema-mismatch" });
        continue;
      }
      parsedAsPost++;
      if (authorFilter && post.author === authorFilter) authorMatched++;
    } catch (e) {
      failures.push({ blobName, reason: e?.message ?? String(e) });
    }
  }

  console.log("[debug-feed] downloaded ok:", parsedOk);
  console.log("[debug-feed] parsed as post:", parsedAsPost);
  if (authorFilter) console.log("[debug-feed] author matched:", authorMatched, "author:", authorFilter);

  if (failures.length) {
    console.log("[debug-feed] failures (first 10):");
    for (const f of failures.slice(0, 10)) {
      console.log("-", f.blobName, "=>", f.reason);
    }
  }
}

main().catch((err) => {
  console.error("[debug-feed] ERROR:", err?.message ?? String(err));
  process.exitCode = 1;
});

