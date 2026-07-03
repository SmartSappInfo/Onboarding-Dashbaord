'use server';

import { adminDb } from './firebase-admin';
import { GlobalPrompt, TenantPromptOverride } from './pms-types';
import { revalidatePath } from 'next/cache';

const REVALIDATION_PATH = '/admin/ai-prompts';

/**
 * Fetch all global prompts from backoffice.
 */
export async function getGlobalPrompts(): Promise<{ success: boolean; data?: GlobalPrompt[]; error?: string }> {
  try {
    const snap = await adminDb.collection('global_prompts').get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalPrompt));
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [PMS] Fetch Global Prompts Failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Fetch all custom overrides for an organization.
 */
export async function getTenantOverrides(
  organizationId: string,
  workspaceId?: string
): Promise<{ success: boolean; data?: TenantPromptOverride[]; error?: string }> {
  try {
    let query = adminDb.collection('prompts').where('organizationId', '==', organizationId);
    if (workspaceId) {
      query = query.where('workspaceId', 'in', [workspaceId, '']);
    }
    const snap = await query.get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TenantPromptOverride));
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [PMS] Fetch Tenant Overrides Failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Get a specific global prompt by its ID (flowName).
 */
export async function getGlobalPromptById(id: string): Promise<{ success: boolean; data?: GlobalPrompt; error?: string }> {
  try {
    const snap = await adminDb.collection('global_prompts').doc(id).get();
    if (!snap.exists) {
      return { success: false, error: 'Global prompt not found.' };
    }
    return { success: true, data: { id: snap.id, ...snap.data() } as GlobalPrompt };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Get a specific override by its ID.
 */
export async function getTenantOverrideById(id: string): Promise<{ success: boolean; data?: TenantPromptOverride; error?: string }> {
  try {
    const snap = await adminDb.collection('prompts').doc(id).get();
    if (!snap.exists) {
      return { success: false, error: 'Override not found.' };
    }
    return { success: true, data: { id: snap.id, ...snap.data() } as TenantPromptOverride };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

function validatePromptVariables(system: string, user: string, allowed: string[]): { valid: boolean; error?: string } {
  const findVariables = (text: string): string[] => {
    const matches = [...text.matchAll(/{{\s*([a-zA-Z0-9_-]+)\s*}}/g)];
    return matches.map(m => m[1]);
  };
  
  const systemVars = findVariables(system);
  const userVars = findVariables(user);
  const allUsed = Array.from(new Set([...systemVars, ...userVars]));

  const invalid = allUsed.filter(v => !allowed.includes(v));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid template placeholders: ${invalid.map(v => `{{${v}}}`).join(', ')} are not defined.`
    };
  }
  return { valid: true };
}

/**
 * Creates or updates a global prompt in the backoffice.
 */
export async function saveGlobalPrompt(
  id: string,
  promptData: Omit<GlobalPrompt, 'id' | 'updatedAt' | 'version' | 'updatedBy'>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validatePromptVariables(promptData.systemPrompt, promptData.userPromptTemplate, promptData.variables);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const ref = adminDb.collection('global_prompts').doc(id);
    const snap = await ref.get();
    const now = new Date().toISOString();
    
    if (snap.exists) {
      const existing = snap.data() as GlobalPrompt;
      await ref.update({
        ...promptData,
        version: existing.version + 1,
        updatedAt: now,
        updatedBy: userId
      });
    } else {
      await ref.set({
        ...promptData,
        id,
        version: 1,
        updatedAt: now,
        updatedBy: userId
      });
    }
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Creates or updates an organization/workspace override.
 */
export async function saveTenantOverride(
  id: string,
  overrideData: Omit<TenantPromptOverride, 'id' | 'updatedAt' | 'version' | 'updatedBy'>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Enforce ID matching sanity gate
    const expectedId = `${overrideData.organizationId}_${overrideData.workspaceId || 'global'}_${overrideData.flowName}`;
    if (id !== expectedId) {
      return { success: false, error: 'Unauthorized: Override document ID mismatch.' };
    }

    // 2. Validate template variables match registered schema
    const validation = validatePromptVariables(overrideData.systemPrompt, overrideData.userPromptTemplate, overrideData.variables);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const ref = adminDb.collection('prompts').doc(id);
    const snap = await ref.get();
    const now = new Date().toISOString();
    
    if (snap.exists) {
      const existing = snap.data() as TenantPromptOverride;
      await ref.update({
        ...overrideData,
        version: existing.version + 1,
        updatedAt: now,
        updatedBy: userId
      });
    } else {
      await ref.set({
        ...overrideData,
        id,
        version: 1,
        updatedAt: now,
        updatedBy: userId
      });
    }
    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}


/**
 * Deletes a tenant prompt override (reverting back to the Global subscription).
 */
export async function deleteTenantOverride(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('prompts').doc(id).delete();
    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
