/**
 * @fileOverview AES-256-GCM credential vault for WhatsApp (and future) secrets.
 *
 * SERVER-ONLY. Never import from a Client Component — this reads private
 * environment keys and uses Node's `crypto`. It is a pure, synchronous utility
 * (NOT a `'use server'` module: those force every export to be an async Server
 * Action, which is wrong for a crypto helper).
 *
 * Secrets (Meta System User access tokens, app secrets) are stored as
 * {@link EncryptedEnvelope}s — never plaintext. GCM provides confidentiality
 * AND integrity (the auth tag), so tampering is detected on decrypt.
 *
 * Key custody / rotation (spec §3A F9):
 *  - `WHATSAPP_ENCRYPTION_KEY`      — current key, 32-byte hex (64 hex chars).
 *  - `WHATSAPP_ENCRYPTION_KEY_ID`   — label for the current key (default 'default').
 *  - `WHATSAPP_ENCRYPTION_KEYS_RETIRED` — optional JSON `{ "<id>": "<hex>" }`
 *    of previous keys, so envelopes encrypted before a rotation stay decryptable.
 *  Each envelope carries the `keyId` it was sealed with, so rotation is
 *  non-destructive: rotate the current key, move the old one into RETIRED.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce — the GCM standard / most efficient
const DEFAULT_KEY_ID = 'default';

/** Encrypted-at-rest payload. All binary fields are base64. */
export interface EncryptedEnvelope {
  cipher: string;
  iv: string;
  tag: string;
  /** Which key sealed this envelope; resolved on decrypt to support rotation. */
  keyId: string;
}

interface Keyring {
  currentId: string;
  keys: Map<string, Buffer>;
}

function parseHexKey(hex: string, label: string): Buffer {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `[crypto-vault] ${label} must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars); got ${buf.length} bytes.`,
    );
  }
  return buf;
}

/**
 * Build the keyring from the environment on each call. Cheap relative to the
 * crypto op, and re-reading keeps behavior correct if env changes (e.g. tests,
 * or a rotation picked up on the next request).
 */
function loadKeyring(): Keyring {
  const primaryHex = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (!primaryHex) {
    throw new Error('[crypto-vault] WHATSAPP_ENCRYPTION_KEY is not configured.');
  }
  const currentId = process.env.WHATSAPP_ENCRYPTION_KEY_ID || DEFAULT_KEY_ID;
  const keys = new Map<string, Buffer>();
  keys.set(currentId, parseHexKey(primaryHex, 'WHATSAPP_ENCRYPTION_KEY'));

  const retiredRaw = process.env.WHATSAPP_ENCRYPTION_KEYS_RETIRED;
  if (retiredRaw) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(retiredRaw);
    } catch {
      throw new Error('[crypto-vault] WHATSAPP_ENCRYPTION_KEYS_RETIRED is not valid JSON.');
    }
    for (const [id, hex] of Object.entries(parsed)) {
      // The current key wins if an id collides.
      if (!keys.has(id)) keys.set(id, parseHexKey(hex, `retired key '${id}'`));
    }
  }

  return { currentId, keys };
}

/** True when a usable encryption key is configured (for health checks / UI gating). */
export function isVaultConfigured(): boolean {
  try {
    loadKeyring();
    return true;
  } catch {
    return false;
  }
}

/** Seal a plaintext secret under the current key. */
export function encrypt(plaintext: string): EncryptedEnvelope {
  const { currentId, keys } = loadKeyring();
  const key = keys.get(currentId)!;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyId: currentId,
  };
}

/**
 * Open an envelope. Throws if the key is unknown or the ciphertext/tag has been
 * tampered with (GCM auth-tag verification fails in `decipher.final()`).
 */
export function decrypt(envelope: EncryptedEnvelope): string {
  const { keys } = loadKeyring();
  const key = keys.get(envelope.keyId);
  if (!key) {
    throw new Error(`[crypto-vault] No key found for keyId '${envelope.keyId}'.`);
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(envelope.cipher, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** Generate a fresh 32-byte key as hex — for provisioning `WHATSAPP_ENCRYPTION_KEY`. */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString('hex');
}
