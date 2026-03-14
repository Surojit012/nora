import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import * as dotenv from "dotenv";

dotenv.config({ path: "apps/web/.env.local" });

async function run() {
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(process.env.SHELBY_SIGNER_PRIVATE_KEY!)
  });

  const client = new ShelbyNodeClient({
    network: Network.TESTNET,
    apiKey: process.env.SHELBY_API_KEY!,
    aptos: {
      fullnode: "https://api.testnet.aptoslabs.com/v1",
      indexer: "https://api.testnet.aptoslabs.com/v1/graphql",
      clientConfig: { API_KEY: process.env.SHELBY_API_KEY! }
    },
    rpc: {
      baseUrl: "https://api.testnet.shelby.xyz/shelby",
      apiKey: process.env.SHELBY_API_KEY!
    }
  });

  const uploadIdRes = await fetch("https://api.testnet.shelby.xyz/shelby/v1/multipart-uploads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SHELBY_API_KEY}`
    },
    body: JSON.stringify({
      rawAccount: account.accountAddress.toString(),
      rawBlobName: "test-repro.json",
      rawPartSize: 5 * 1024 * 1024
    })
  });
  
  if (!uploadIdRes.ok) {
    console.log("Start failed:", uploadIdRes.status, await uploadIdRes.text());
    return;
  }
  const { uploadId } = await uploadIdRes.json();
  console.log("Got uploadId:", uploadId);
  
  const completeRes = await fetch(`https://api.testnet.shelby.xyz/shelby/v1/multipart-uploads/${uploadId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SHELBY_API_KEY}`
    }
  });

  if (!completeRes.ok) {
    console.log("Complete failed:", completeRes.status, await completeRes.text());
  } else {
    console.log("Complete succeeded!");
  }
}

run().catch(console.error);
