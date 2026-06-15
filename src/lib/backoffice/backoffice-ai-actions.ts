'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor } from './backoffice-types';
import { GlobalAiKeysSchema, type GlobalAiKeys, GlobalAiConfigSchema, type GlobalAiConfig } from '../validation/ai-config-schema';

export async function getGlobalAiKeys(): Promise<{
  success: boolean;
  data?: {
    geminiApiKeyExists: boolean;
    claudeApiKeyExists: boolean;
    openRouterApiKeyExists: boolean;
  };
  error?: string;
}> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_AI] getGlobalAiKeys failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveGlobalAiKeys(
  payload: GlobalAiKeys,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate payload
    const parsed = GlobalAiKeysSchema.parse(payload);
    
    const docRef = adminDb.collection('system_settings').doc('ai_keys');
    const snap = await docRef.get();
    let before = null;
    if (snap.exists) {
      before = createAuditSnapshot(snap.data() as Record<string, unknown>);
    }

    const dataToSave: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    };

    const processKeyField = (val?: string, existingVal?: string) => {
      if (val === '••••••••') {
        return existingVal || '';
      }
      return val || '';
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

    const maskData = (snapData: Record<string, any> | null) => {
      if (!snapData) return null;
      return {
        ...snapData,
        geminiApiKey: snapData.geminiApiKey ? '••••••••' : undefined,
        claudeApiKey: snapData.claudeApiKey ? '••••••••' : undefined,
        openRouterApiKey: snapData.openRouterApiKey ? '••••••••' : undefined,
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
  } catch (error: any) {
    console.error('[BACKOFFICE_AI] saveGlobalAiKeys failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getGlobalAiConfig(): Promise<{
  success: boolean;
  data?: {
    defaultProvider: 'googleai' | 'anthropic' | 'openrouter';
    defaultModelId: string;
  };
  error?: string;
}> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_AI] getGlobalAiConfig failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveGlobalAiConfig(
  payload: GlobalAiConfig,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = GlobalAiConfigSchema.parse(payload);
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
  } catch (error: any) {
    console.error('[BACKOFFICE_AI] saveGlobalAiConfig failed:', error);
    return { success: false, error: error.message };
  }
}
