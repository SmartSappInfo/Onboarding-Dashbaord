// ─────────────────────────────────────────────────
// Backoffice Secret Vault Adapter (SERVER-ONLY)
//
// Wraps the WhatsApp crypto-vault envelope for platform secrets
// (e.g. global AI API keys) so they are encrypted at rest.
//
// Tolerates a mixed store during migration: a field may hold either
// a legacy plaintext string or a sealed EncryptedEnvelope. `openSecret`
// handles both; `sealSecret` always produces an envelope.
// ─────────────────────────────────────────────────

import { encrypt, decrypt, isVaultConfigured, type EncryptedEnvelope } from '../whatsapp/crypto-vault';

export { isVaultConfigured };
export type { EncryptedEnvelope };

/** True when `value` is a sealed envelope (vs. a legacy plaintext string). */
export function isEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncryptedEnvelope).cipher === 'string' &&
    typeof (value as EncryptedEnvelope).iv === 'string' &&
    typeof (value as EncryptedEnvelope).tag === 'string' &&
    typeof (value as EncryptedEnvelope).keyId === 'string'
  );
}

/**
 * Seals a plaintext secret. Throws if the vault key is not configured —
 * callers must fail loudly rather than silently persist plaintext.
 */
export function sealSecret(plaintext: string): EncryptedEnvelope {
  if (!isVaultConfigured()) {
    throw new Error('Encryption vault is not configured; refusing to store a secret in plaintext.');
  }
  return encrypt(plaintext);
}

/**
 * Opens a stored secret. Accepts a sealed envelope, a legacy plaintext
 * string, or an empty/undefined value. Returns undefined when there is
 * no usable secret.
 */
export function openSecret(value: unknown): string | undefined {
  if (isEnvelope(value)) {
    return decrypt(value);
  }
  if (typeof value === 'string' && value.length > 0) {
    // Legacy plaintext (pre-encryption migration).
    return value;
  }
  return undefined;
}

/**
 * Checks if a value (either legacy plaintext string or an encrypted envelope)
 * was sealed with an outdated encryption key or is in plaintext.
 */
export function needsRotation(value: unknown): boolean {
  if (isEnvelope(value)) {
    const currentKeyId = process.env.WHATSAPP_ENCRYPTION_KEY_ID || 'default';
    return value.keyId !== currentKeyId;
  }
  if (typeof value === 'string' && value.length > 0) {
    return true; // legacy plaintext
  }
  return false;
}

/**
 * Rotates/re-seals a stored secret under the currently active master key.
 */
export function rotateSecret(value: unknown): EncryptedEnvelope | undefined {
  const plaintext = openSecret(value);
  if (plaintext) {
    return sealSecret(plaintext);
  }
  return undefined;
}
