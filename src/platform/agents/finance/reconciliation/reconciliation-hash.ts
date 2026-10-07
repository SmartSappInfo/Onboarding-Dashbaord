/**
 * @fileOverview Universal Cryptographic SHA-256 Canonical Payload Hashing (Phase 12 Milestone 3)
 *
 * Implements Rule 22: Cryptographic SHA-256 Tampering Detection.
 * Universal implementation compatible with both Node.js (v18+) and browser Web Crypto environments.
 * Zero external or Node-only dependencies.
 */

/**
 * Serializes an object deterministically with key-sorting.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalizeJson).join(',')}]`;
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`
  );
  return `{${entries.join(',')}}`;
}

/**
 * Computes SHA-256 hash using Web Crypto API (async, universally available in browser & Node 18+).
 */
export async function computePayloadHashAsync(payload: Record<string, unknown>): Promise<string> {
  const text = canonicalizeJson(payload);
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
