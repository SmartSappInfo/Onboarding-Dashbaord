/**
 * @fileOverview Chrome extension access tokens (audit F6).
 *
 * The previous token was built in the BROWSER as
 * `tok_${epochSeconds}_${Math.random().toString(36).slice(2, 15)}` and stored in
 * Firestore in plaintext. Three separate problems:
 *
 *   1. `Math.random()` is not a CSPRNG. V8's implementation is xorshift128+, whose
 *      internal state can be recovered from a handful of outputs — so observing one
 *      token lets an attacker predict others.
 *   2. The timestamp prefix leaks creation time and removes entropy from the guess space.
 *   3. Plaintext at rest means anyone who can read the settings document — a backup, a
 *      log, an over-broad Firestore rule — holds a working credential.
 *
 * Tokens are now 32 CSPRNG bytes generated server-side, shown once, and stored only as a
 * SHA-256 hash. A hash is sufficient here (unlike a password) because the token is
 * high-entropy: there is no dictionary to attack, so a slow KDF buys nothing.
 */
import crypto from 'crypto';

/** Prefix kept so existing operator documentation and support flows still recognise it. */
const TOKEN_PREFIX = 'lit_';

export interface GeneratedExtensionToken {
  /** Full plaintext value. Shown to the operator exactly once, never persisted. */
  token: string;
  /** What gets stored on the settings document. */
  tokenHash: string;
  /** Non-secret display hint, e.g. "lit_…8f3a", safe to persist and show later. */
  tokenHint: string;
}

/** Create a fresh extension token. Server-side only. */
export function generateExtensionToken(): GeneratedExtensionToken {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashExtensionToken(token),
    tokenHint: `${TOKEN_PREFIX}…${token.slice(-4)}`,
  };
}

/** Stable hash used for both storage and lookup. */
export function hashExtensionToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time comparison of a presented token against a stored hash.
 *
 * `timingSafeEqual` throws on length mismatch, so both sides are hashed first — that
 * guarantees equal length and keeps the comparison constant-time.
 */
export function extensionTokenMatches(presented: string, storedHash: string | undefined | null): boolean {
  if (!presented || !storedHash) return false;
  const a = Buffer.from(hashExtensionToken(presented), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
