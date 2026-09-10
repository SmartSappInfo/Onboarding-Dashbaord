'use server';

import { adminDb } from './firebase-admin';
import { requireWorkspace } from './auth/require-auth';

/**
 * Settings Actions
 * 
 * Handles entity-specific settings with dual-write pattern:
 * - Primary: Query and update using entityId
 * - Fallback: Support legacy entityId for backward compatibility
 * 
 * Requirements: 12.1, 12.2, 12.4
 */

interface EntitySettings {
  id: string;
  organizationId?: string; // Organization identifier
  entityId: string | null;
  entityType?: 'institution' | 'family' | 'person' | null;
  workspaceId: string;
  
  // Settings fields
  settings?: {
    notificationsEnabled?: boolean;
    emailPreferences?: {
      invoices?: boolean;
      reminders?: boolean;
      updates?: boolean;
    };
    displayPreferences?: {
      theme?: 'light' | 'dark';
      language?: string;
    };
  };
  notificationsEnabled?: boolean;
  emailPreferences?: {
    invoices?: boolean;
    reminders?: boolean;
    updates?: boolean;
  };
  displayPreferences?: {
    theme?: 'light' | 'dark';
    language?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Load settings for an entity
 * 
 * @param entityId - Unified Entity Identifier
 * @param workspaceId - Workspace ID
 * @returns Settings or null if not found
 */
export async function loadSettings(
  entityId: string,
  workspaceId: string
): Promise<{ success: boolean; settings?: EntitySettings; error?: string }> {
  try {
    if (!entityId) {
        return { success: false, error: 'entityId must be provided' };
    }

    // SECURITY (audit F2): scoped to the workspace being read, so a caller cannot pull
    // another tenant's settings by guessing ids.
    await requireWorkspace(workspaceId);

    const snapshot = await adminDb
      .collection('settings')
      .where('workspaceId', '==', workspaceId)
      .where('entityId', '==', entityId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return { success: true, settings: undefined };
    }
    
    const data = snapshot.docs[0].data() as EntitySettings;
    const settings: EntitySettings = {
      ...data,
      entityType: data.entityType || 'institution',
    };
    return { success: true, settings };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[SETTINGS] Load failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update settings for an entity
 * 
 * @param settingsId - Settings document ID
 * @param updates - Settings updates
 * @returns Success status
 */
export async function updateSettings(
  settingsId: string,
  updates: Partial<EntitySettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get existing settings to preserve identifiers
    const settingsRef = adminDb.collection('settings').doc(settingsId);
    const settingsDoc = await settingsRef.get();
    
    if (!settingsDoc.exists) {
      return { success: false, error: 'Settings not found' };
    }
    
    const existingSettings = settingsDoc.data() as EntitySettings;

    // SECURITY (audit F2): the workspace comes from the stored record, never the caller.
    await requireWorkspace(existingSettings.workspaceId);
    
    // Preserve identifiers during update
    const updateData = {
      ...updates,
      entityId: existingSettings.entityId,
      entityType: existingSettings.entityType,
      updatedAt: new Date().toISOString()
    };
    
    await settingsRef.update(updateData);
    
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[SETTINGS] Update failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create settings for an entity
 * 
 * @param input - Settings creation input
 * @returns Success status with settings ID
 */
export async function createSettings(
  input: {
    entityId: string | null;
    entityType?: 'institution' | 'family' | 'person';
    workspaceId: string;
    notificationsEnabled?: boolean;
    emailPreferences?: EntitySettings['emailPreferences'];
    displayPreferences?: EntitySettings['displayPreferences'];
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // SECURITY (audit F2): a caller could otherwise create settings inside any tenant.
    await requireWorkspace(input.workspaceId);

    const now = new Date().toISOString();
    
    const settings: Omit<EntitySettings, 'id'> = {
      entityId: input.entityId,
      entityType: input.entityType || null,
      workspaceId: input.workspaceId,
      notificationsEnabled: input.notificationsEnabled ?? true,
      emailPreferences: input.emailPreferences || {
        invoices: true,
        reminders: true,
        updates: true
      },
      displayPreferences: input.displayPreferences || {
        theme: 'light',
        language: 'en'
      },
      createdAt: now,
      updatedAt: now
    };
    
    const docRef = await adminDb.collection('settings').add(settings);
    
    return { success: true, id: docRef.id };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[SETTINGS] Create failed:', err);
    return { success: false, error: err.message };
  }
}
