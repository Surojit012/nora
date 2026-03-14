import { Ed25519PublicKey, Ed25519Signature } from "@aptos-labs/ts-sdk";
import { NextRequest } from "next/server";

export interface AuthContext {
  walletAddress: string;
}

/**
 * Verifies an Aptos wallet signature from the request headers.
 * Headers expected:
 * - x-aptos-pubkey: The hex encoded Ed25519 public key
 * - x-aptos-signature: The hex encoded signature
 * - x-aptos-message: The raw message that was signed
 * 
 * The middleware expects the literal message to match a specific pattern 
 * or exact string depending on the route, which the route can verify.
 */
export function verifyAuthSignature(
  req: NextRequest, 
  expectedMessagePrefix?: string
): AuthContext | null {
  try {
    const pubKeyHex = req.headers.get("x-aptos-pubkey");
    const sigHex = req.headers.get("x-aptos-signature");
    const message = req.headers.get("x-aptos-message");

    if (!pubKeyHex || !sigHex || !message) {
      return null;
    }

    if (expectedMessagePrefix && !message.startsWith(expectedMessagePrefix)) {
      return null;
    }

    const pubKey = new Ed25519PublicKey(pubKeyHex);
    const signature = new Ed25519Signature(sigHex);

    const isValid = pubKey.verifySignature({
      message,
      signature
    });

    if (!isValid) return null;

    // Derived auth context
    // The Ed25519 publicKey to AuthKey (wallet address) is standard in Aptos
    const authKey = pubKey.authKey().toString();

    return { walletAddress: authKey };
  } catch (err) {
    console.error("Signature verification failed:", err);
    return null;
  }
}
