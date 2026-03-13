import fs from "node:fs";
import path from "node:path";

import { Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

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

async function main() {
  loadEnv();

  const network = networkFromString(process.env.SHELBY_NETWORK ?? process.env.NETWORK);
  const apiKey = requireEnv("SHELBY_API_KEY");
  const privateKeyHex = requireEnv("SHELBY_SIGNER_PRIVATE_KEY");

  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKeyHex),
  });

  const config = {
    network,
    apiKey,
    ...(process.env.SHELBY_APTOS_INDEXER_URL
      ? { aptos: { indexer: process.env.SHELBY_APTOS_INDEXER_URL } }
      : {}),
  };

  console.log("[shelby-list-blobs] network:", network);
  if (process.env.SHELBY_APTOS_INDEXER_URL) {
    console.log("[shelby-list-blobs] indexer override:", process.env.SHELBY_APTOS_INDEXER_URL);
  }
  console.log("[shelby-list-blobs] account:", signer.accountAddress.toString());

  const client = new ShelbyNodeClient(config);

  // This call requires a Shelby-compatible indexer behind the scenes.
  const blobs = await client.coordination.getAccountBlobs({
    account: signer.accountAddress,
  });

  console.log("[shelby-list-blobs] blobs:", blobs.length);
  const first = blobs[0];
  if (first) {
    console.log("[shelby-list-blobs] first keys:", Object.keys(first));
    console.log("[shelby-list-blobs] first:", first);
  }
}

main().catch((err) => {
  console.error("[shelby-list-blobs] ERROR:", err?.message ?? String(err));
  process.exitCode = 1;
});
