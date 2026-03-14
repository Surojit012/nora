import { Ed25519PublicKey, Ed25519Signature } from "@aptos-labs/ts-sdk";

try {
  const pubKeyHex = "0x" + "00".repeat(32);
  const sigHex = "0x" + "00".repeat(64);
  const message = "APTOS\nmessage: Follow 0x12..";

  const pubKey = new Ed25519PublicKey(pubKeyHex);
  const signature = new Ed25519Signature(sigHex);

  const isValid = pubKey.verifySignature({
    message,
    signature
  });
  console.log("Success?", isValid);
} catch (e) {
  console.error("Error:", (e as any).message);
}
