/**
 * Utility to canonicalize Aptos and wallet addresses.
 * Ensures consistent matching between Supabase (profile/follows) and Shelby (blobs).
 */
export function normalizeAddress(addr: string): string {
  if (!addr) return "";
  let clean = addr.trim().toLowerCase();
  
  // Aptos canonical format is 0x followed by 64 hex characters.
  if (clean.startsWith("0x")) {
    const hex = clean.slice(2);
    // Only pad if it's a hex-like string (to avoid mangling other identifier types if any)
    if (/^[0-9a-f]+$/.test(hex)) {
      return "0x" + hex.padStart(64, "0");
    }
  }
  
  return clean;
}
