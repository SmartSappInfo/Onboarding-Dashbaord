import crypto from 'crypto';

// Derive 32-byte key from env variable (falls back gracefully to empty hash if not configured)
const ENCRYPTION_KEY_RAW = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-fallback-key-smartsapp-onboarding';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Serializes output as `iv:authTag:ciphertext`.
 */
export function encryptToken(text: string): string {
  if (!text) return '';

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err: unknown) {
    console.error('Token encryption failed:', err);
    return text; // Graceful fallback
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Supports fallback for unencrypted legacy tokens.
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText) return '';

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // If it doesn't match the three-part GCM format, assume it is legacy raw token
    return cipherText;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err: unknown) {
    console.warn('Token decryption failed (may require connection re-authentication):', err);
    // Return original cipherText or empty string if decryption fails due to key change
    return ''; 
  }
}
