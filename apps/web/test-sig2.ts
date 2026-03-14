import { Ed25519Signature } from "@aptos-labs/ts-sdk";
try {
  new Ed25519Signature("[object Object]");
  console.log("Success with [object Object]");
} catch (e: any) {
  console.log("Error:", e.message);
}
