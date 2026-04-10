'use server';

import { adminDb } from './firebase-admin';

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

    const snapshot = await adminDb
      .collection('settings')
      .where('workspaceId', '==', workspaceId)
      .where('entityId', '==', entityId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return { success: true, settings: undefined };
    }
    
    const settings = snapshot.docs[0].data() as EntitySettings;
    return { success: true, settings };
  } catch (error: any) {
    console.error('[SETTINGS] Load failed:', error);
    return { success: false, error: error.message };
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
    
    // Preserve identifiers during update
    const updateData = {
      ...updates,
      entityId: existingSettings.entityId,
      entityType: existingSettings.entityType,
      updatedAt: new Date().toISOString()
    };
    
    await settingsRef.update(updateData);
    
    return { success: true };
  } catch (error: any) {
    console.error('[SETTINGS] Update failed:', error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('[SETTINGS] Create failed:', error);
    return { success: false, error: error.message };
  }
}
