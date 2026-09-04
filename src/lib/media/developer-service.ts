'use server';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Scoped API Key & Developer Service
 *
 * Provides cryptographically secure, scoped API key provisioning, verification, and revocation
 * for external integrations and developer SDK usage.
 *
 * ARCHITECTURAL INVARIANTS & SECURITY GUIDANCE (RULE 10):
 * 1. Zero Plaintext Key Persistence: Raw keys (sk_media_...) are never stored in Firestore.
 *    Only the SHA-256 hash (`keyHash`) and masked prefix are persisted.
 * 2. Scoped Privilege Enforcement: Keys carry explicit granular scopes (e.g. `media:read`, `media:write`,
 *    `media:publish`, `media:analytics`, `media:webhooks`, `media:admin`).
 * 3. Rate-Limiting Ready: Verification updates `lastUsedAt` and validates expiration timestamps.
 * 4. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 132 (Phase 9 - Enterprise Platform) & Sec 115 (SDK / Developer Platform).
 * - UX Sec 160 (Phase 9 - Enterprise) & Screen 63 (Settings / API).
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { MediaApiKey, MediaApiKeyScope } from '@/lib/types/media-2.0';

export interface ApiKeyGenerationResult {
  success: boolean;
  key?: string; // Plaintext key, displayed ONCE only
  record?: MediaApiKey;
  error?: string;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  workspaceId?: string;
  scopes?: MediaApiKeyScope[];
  keyName?: string;
  keyId?: string;
  error?: string;
}

/**
 * Generates a new cryptographically secure scoped Media API key.
 * The plaintext key is returned to the caller exactly ONCE and never stored.
 */
export async function generateMediaApiKeyAction(
  workspaceId: string,
  name: string,
  scopes: MediaApiKeyScope[],
  expiresInDays?: number,
  userId: string = 'system'
): Promise<ApiKeyGenerationResult> {
  try {
    if (!workspaceId || !name.trim()) {
      return { success: false, error: 'Workspace ID and key name are required.' };
    }

    if (!scopes || scopes.length === 0) {
      return { success: false, error: 'At least one valid API key scope must be specified.' };
    }

    // 1. Generate 32 bytes of cryptographic randomness
    const randomHex = crypto.randomBytes(32).toString('hex');
    const fullKey = `sk_media_${randomHex}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = `sk_media_...${randomHex.slice(-4)}`;

    const id = `apikey_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    let expiresAt: string | null = null;
    if (expiresInDays && expiresInDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiresInDays);
      expiresAt = expDate.toISOString();
    }

    const keyRecord: MediaApiKey = {
      id,
      name: name.trim(),
      keyPrefix,
      keyHash,
      workspaceId,
      scopes,
      createdAt,
      expiresAt,
      lastUsedAt: null,
      status: 'ACTIVE',
      createdBy: userId,
    };

    // 2. Persist hash-only record into Firestore
    await adminDb.collection('media_api_keys').doc(id).set(keyRecord);

    return {
      success: true,
      key: fullKey,
      record: keyRecord,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate API key.';
    return { success: false, error: msg };
  }
}

/**
 * Lists all API keys for a specific workspace.
 * Returns safe metadata only (never reveals plaintext keys).
 */
export async function listMediaApiKeysAction(
  workspaceId: string
): Promise<{ success: boolean; keys?: MediaApiKey[]; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const snapshot = await adminDb
      .collection('media_api_keys')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .get();

    const keys: MediaApiKey[] = snapshot.docs.map((doc) => doc.data() as MediaApiKey);
    return { success: true, keys };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list API keys.';
    return { success: false, error: msg };
  }
}

/**
 * Revokes an existing API key immediately.
 */
export async function revokeMediaApiKeyAction(
  apiKeyId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKeyId || !workspaceId) {
      return { success: false, error: 'API key ID and workspace ID are required.' };
    }

    const docRef = adminDb.collection('media_api_keys').doc(apiKeyId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'API key not found.' };
    }

    const data = snap.data() as MediaApiKey;
    if (data.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized: workspace mismatch.' };
    }

    await docRef.update({
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to revoke API key.';
    return { success: false, error: msg };
  }
}

/**
 * Validates an incoming raw API key against stored cryptographic hashes.
 * Enforces status checks, expiration verification, and optional scope gating.
 */
export async function validateMediaApiKey(
  rawKey: string,
  requiredScope?: MediaApiKeyScope
): Promise<ApiKeyValidationResult> {
  try {
    if (!rawKey || !rawKey.startsWith('sk_media_')) {
      return { valid: false, error: 'Invalid API key format.' };
    }

    // Hash the presented token
    const incomingHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const snap = await adminDb
      .collection('media_api_keys')
      .where('keyHash', '==', incomingHash)
      .limit(1)
      .get();

    if (snap.empty) {
      return { valid: false, error: 'Invalid or unknown API key.' };
    }

    const keyDoc = snap.docs[0];
    const keyData = keyDoc.data() as MediaApiKey;

    // Check status
    if (keyData.status === 'REVOKED') {
      return { valid: false, error: 'API key has been revoked.' };
    }

    // Check expiration
    if (keyData.expiresAt && Date.now() > Date.parse(keyData.expiresAt)) {
      if (keyData.status !== 'EXPIRED') {
        await keyDoc.ref.update({ status: 'EXPIRED' });
      }
      return { valid: false, error: 'API key has expired.' };
    }

    // Check required scope
    if (requiredScope && !keyData.scopes.includes(requiredScope) && !keyData.scopes.includes('media:admin')) {
      return {
        valid: false,
        error: `Insufficient scope: key does not have required '${requiredScope}' permission.`,
      };
    }

    // Asynchronously update lastUsedAt (fire-and-forget)
    keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});

    return {
      valid: true,
      workspaceId: keyData.workspaceId,
      scopes: keyData.scopes,
      keyName: keyData.name,
      keyId: keyData.id,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Authentication verification failure.';
    return { valid: false, error: msg };
  }
}
