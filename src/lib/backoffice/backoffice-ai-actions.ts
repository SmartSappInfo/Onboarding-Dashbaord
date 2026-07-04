'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import { sealSecret, isEnvelope, type EncryptedEnvelope } from './secret-vault';
import { GlobalAiKeysSchema, type GlobalAiKeys, GlobalAiConfigSchema, type GlobalAiConfig } from '../validation/ai-config-schema';

/** A stored secret field: sealed envelope, or empty string when unset. */
type StoredSecret = EncryptedEnvelope | '';

// Security: every action verifies the caller's ID token and enforces
// RBAC via `authorizeBackoffice` (server-auth-actions). Actor is
// derived server-side — never from client payloads.

export async function getGlobalAiKeys(idToken: string): Promise<{
  success: boolean;
  data?: {
    geminiApiKeyExists: boolean;
    claudeApiKeyExists: boolean;
    openRouterApiKeyExists: boolean;
  };
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'settings', 'view');

    const docRef = adminDb.collection('system_settings').doc('ai_keys');
    const snap = await docRef.get();
    if (!snap.exists) {
      return {
        success: true,
        data: {
          geminiApiKeyExists: false,
          claudeApiKeyExists: false,
          openRouterApiKeyExists: false,
        }
      };
    }
    const data = snap.data();
    return {
      success: true,
      data: {
        geminiApiKeyExists: !!data?.geminiApiKey,
        claudeApiKeyExists: !!data?.claudeApiKey,
        openRouterApiKeyExists: !!data?.openRouterApiKey,
      }
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_AI] getGlobalAiKeys failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveGlobalAiKeys(
  payload: GlobalAiKeys,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate payload, then authenticate + authorize (validate → auth → act)
    const parsed = GlobalAiKeysSchema.parse(payload);
    const actor = await authorizeBackoffice(idToken, 'settings', 'edit');

    const docRef = adminDb.collection('system_settings').doc('ai_keys');
    const snap = await docRef.get();
    let before = null;
    if (snap.exists) {
      before = createAuditSnapshot(snap.data() as Record<string, unknown>);
    }

    interface AiKeysDoc {
      updatedAt: string;
      updatedBy: string;
      createdAt?: string;
      geminiApiKey: StoredSecret;
      claudeApiKey: StoredSecret;
      openRouterApiKey: StoredSecret;
    }

    const dataToSave: AiKeysDoc = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
      geminiApiKey: '',
      claudeApiKey: '',
      openRouterApiKey: '',
    };

    // Sentinel ('••••••••') keeps the existing (already-sealed) value; a real
    // value is sealed with the vault; empty clears the key.
    const processKeyField = (val: string | undefined, existingVal: unknown): StoredSecret => {
      if (val === '••••••••') {
        return isEnvelope(existingVal) ? existingVal
          : (typeof existingVal === 'string' && existingVal.length > 0 ? sealSecret(existingVal) : '');
      }
      return val ? sealSecret(val) : '';
    };

    const existingData = snap.exists ? snap.data() : {};

    dataToSave.geminiApiKey = processKeyField(parsed.geminiApiKey, existingData?.geminiApiKey);
    dataToSave.claudeApiKey = processKeyField(parsed.claudeApiKey, existingData?.claudeApiKey);
    dataToSave.openRouterApiKey = processKeyField(parsed.openRouterApiKey, existingData?.openRouterApiKey);

    if (!before) {
      dataToSave.createdAt = new Date().toISOString();
    }

    await docRef.set(dataToSave, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    // Never write plaintext (or ciphertext) secrets into the audit trail.
    const maskData = (snapData: Record<string, unknown> | null): Record<string, unknown> | null => {
      if (!snapData) return null;
      const mask = (v: unknown) => (v ? '••••••••' : undefined);
      return {
        ...snapData,
        geminiApiKey: mask(snapData.geminiApiKey),
        claudeApiKey: mask(snapData.claudeApiKey),
        openRouterApiKey: mask(snapData.openRouterApiKey),
      };
    };

    await logBackofficeAction(
      actor,
      before ? 'system_defaults.ai_keys_update' : 'system_defaults.ai_keys_create',
      'system_settings',
      docRef.id,
      {
        before: maskData(before),
        after: maskData(after),
        metadata: { action: 'update_global_ai_keys' }
      }
    );

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_AI] saveGlobalAiKeys failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getGlobalAiConfig(idToken: string): Promise<{
  success: boolean;
  data?: {
    defaultProvider: 'googleai' | 'anthropic' | 'openrouter';
    defaultModelId: string;
  };
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'settings', 'view');

    const docRef = adminDb.collection('system_settings').doc('ai_config');
    const snap = await docRef.get();
    if (!snap.exists) {
      return {
        success: true,
        data: {
          defaultProvider: 'googleai',
          defaultModelId: 'gemini-3-flash-preview',
        }
      };
    }
    const data = snap.data();
    return {
      success: true,
      data: {
        defaultProvider: (data?.defaultProvider || 'googleai') as 'googleai' | 'anthropic' | 'openrouter',
        defaultModelId: data?.defaultModelId || 'gemini-3-flash-preview',
      }
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_AI] getGlobalAiConfig failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveGlobalAiConfig(
  payload: GlobalAiConfig,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = GlobalAiConfigSchema.parse(payload);
    const actor = await authorizeBackoffice(idToken, 'settings', 'edit');
    const docRef = adminDb.collection('system_settings').doc('ai_config');
    const snap = await docRef.get();
    let before = null;
    if (snap.exists) {
      before = createAuditSnapshot(snap.data() as Record<string, unknown>);
    }

    const dataToSave = {
      defaultProvider: parsed.defaultProvider,
      defaultModelId: parsed.defaultModelId,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
      ...(before ? {} : { createdAt: new Date().toISOString() }),
    };

    await docRef.set(dataToSave, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(
      actor,
      before ? 'system_defaults.ai_config_update' : 'system_defaults.ai_config_create',
      'system_settings',
      docRef.id,
      {
        before,
        after,
        metadata: { action: 'update_global_ai_config' }
      }
    );

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_AI] saveGlobalAiConfig failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
