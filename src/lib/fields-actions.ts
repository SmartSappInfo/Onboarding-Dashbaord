'use server';

import { adminDb } from './firebase-admin';
import type { AppField } from './types';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server-side actions for the Fields & Variables Manager.
 * Handles CRUD operations for workspace-scoped AppFields, seeding native fields,
 * and migrating legacy messaging_variables into the new app_fields collection.
 */

const REVALIDATION_PATH = '/admin/settings/fields';

/**
 * Creates a new custom field in the app_fields collection.
 */
export async function createFieldAction(data: Omit<AppField, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    // Validate unique variableName within workspace
    const existing = await adminDb
      .collection('app_fields')
      .where('workspaceId', '==', data.workspaceId)
      .where('variableName', '==', data.variableName)
      .limit(1)
      .get();

    if (!existing.empty) {
      return { success: false, error: `A field with variable name "${data.variableName}" already exists in this workspace.` };
    }

    const now = new Date().toISOString();
    const ref = adminDb.collection('app_fields').doc();
    await ref.set({
      ...data,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true, id: ref.id };
  } catch (error: any) {
    console.error('>>> [FIELDS] Create Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Updates an existing field. Native fields can only have limited updates (label, helpText, status).
 */
export async function updateFieldAction(id: string, data: Partial<AppField>) {
  try {
    const ref = adminDb.collection('app_fields').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Field not found.' };
    }

    const existing = snap.data() as AppField;

    // If native, restrict editable fields
    if (existing.isNative) {
      const allowed: Partial<AppField> = {};
      if (data.label !== undefined) allowed.label = data.label;
      if (data.helpText !== undefined) allowed.helpText = data.helpText;
      if (data.status !== undefined) allowed.status = data.status;
      if (data.placeholder !== undefined) allowed.placeholder = data.placeholder;
      data = allowed;
    }

    // If variableName changed (custom field only), validate uniqueness
    if (data.variableName && data.variableName !== existing.variableName) {
      const dup = await adminDb
        .collection('app_fields')
        .where('workspaceId', '==', existing.workspaceId)
        .where('variableName', '==', data.variableName)
        .limit(1)
        .get();
      if (!dup.empty) {
        return { success: false, error: `Variable name "${data.variableName}" is already in use.` };
      }
    }

    await ref.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Update Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a custom field. Native fields cannot be deleted.
 */
export async function deleteFieldAction(id: string) {
  try {
    const ref = adminDb.collection('app_fields').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Field not found.' };
    }

    const field = snap.data() as AppField;
    if (field.isNative) {
      return { success: false, error: 'Native fields cannot be deleted. You can deactivate them instead.' };
    }

    await ref.delete();
    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FIELDS] Delete Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Seeds native fields for a workspace. Idempotent — skips fields that already exist.
 * This defines all system-level fields that map to entity properties.
 */
export async function seedNativeFieldsAction(workspaceId: string, organizationId: string) {
  try {
    const now = new Date().toISOString();
    const fieldsCol = adminDb.collection('app_fields');

    // Check which native fields already exist for this workspace
    const existingSnap = await fieldsCol
      .where('workspaceId', '==', workspaceId)
      .where('isNative', '==', true)
      .get();

    const existingKeys = new Set(existingSnap.docs.map(d => (d.data() as AppField).variableName));

    const nativeFields: Omit<AppField, 'id'>[] = [
      // Common / Entity fields
      { workspaceId, organizationId, name: 'entity_name', label: 'Entity Name', variableName: 'school_name', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common', 'institution', 'family', 'person'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'entity_initials', label: 'Entity Initials', variableName: 'school_initials', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common', 'institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'entity_location', label: 'Physical Location', variableName: 'school_location', type: 'address', section: 'common', isNative: true, compatibilityScope: ['common', 'institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'entity_phone', label: 'Primary Phone', variableName: 'school_phone', type: 'phone', section: 'common', isNative: true, compatibilityScope: ['common', 'institution', 'family', 'person'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'entity_email', label: 'Primary Email', variableName: 'school_email', type: 'email', section: 'common', isNative: true, compatibilityScope: ['common', 'institution', 'family', 'person'], status: 'active', createdAt: now },

      // Contact/Signatory
      { workspaceId, organizationId, name: 'contact_name', label: 'Primary Contact Name', variableName: 'contact_name', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common', 'institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'contact_position', label: 'Primary Contact Role', variableName: 'contact_position', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common', 'institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'contact_email', label: 'Primary Contact Email', variableName: 'contact_email', type: 'email', section: 'common', isNative: true, compatibilityScope: ['common', 'institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'contact_phone', label: 'Primary Contact Phone', variableName: 'contact_phone', type: 'phone', section: 'common', isNative: true, compatibilityScope: ['common', 'institution'], status: 'active', createdAt: now },

      // Finance & Arrears
      { workspaceId, organizationId, name: 'school_package', label: 'Subscription Tier', variableName: 'school_package', type: 'short_text', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'subscription_rate', label: 'Unit Rate', variableName: 'subscription_rate', type: 'currency', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'nominal_roll', label: 'Student Count', variableName: 'nominal_roll', type: 'number', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'arrears_balance', label: 'Outstanding Arrears', variableName: 'arrears_balance', type: 'currency', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'credit_balance', label: 'Available Credit', variableName: 'credit_balance', type: 'currency', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'currency', label: 'Billing Currency', variableName: 'currency', type: 'short_text', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'agreement_url', label: 'Institutional Signing Link', variableName: 'agreement_url', type: 'url', section: 'institution', isNative: true, compatibilityScope: ['institution'], status: 'active', createdAt: now },

      // Tags & Logic
      { workspaceId, organizationId, name: 'contact_tags', label: 'Contact Tags', variableName: 'contact_tags', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'tag_count', label: 'Tag Count', variableName: 'tag_count', type: 'number', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      
      // Meetings
      { workspaceId, organizationId, name: 'meeting_time', label: 'Meeting Time', variableName: 'meeting_time', type: 'datetime', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'meeting_link', label: 'Meeting Link', variableName: 'meeting_link', type: 'url', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'meeting_type', label: 'Meeting Type', variableName: 'meeting_type', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },

      // Survey & Results
      { workspaceId, organizationId, name: 'survey_score', label: 'Respondent Score', variableName: 'survey_score', type: 'number', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'max_score', label: 'Survey Max Points', variableName: 'max_score', type: 'number', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'outcome_label', label: 'Logic Result Name', variableName: 'outcome_label', type: 'short_text', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
      { workspaceId, organizationId, name: 'result_url', label: 'Public Result Link', variableName: 'result_url', type: 'url', section: 'common', isNative: true, compatibilityScope: ['common'], status: 'active', createdAt: now },
    ];

    const batch = adminDb.batch();
    let seededCount = 0;

    for (const field of nativeFields) {
      if (existingKeys.has(field.variableName)) continue;
      const ref = fieldsCol.doc();
      batch.set(ref, field);
      seededCount++;
    }

    if (seededCount > 0) {
      await batch.commit();
    }

    revalidatePath(REVALIDATION_PATH);
    return { success: true, seeded: seededCount, skipped: nativeFields.length - seededCount };
  } catch (error: any) {
    console.error('>>> [FIELDS] Seed Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all fields for a workspace.
 */
export async function getFieldsForWorkspace(workspaceId: string): Promise<{ success: boolean; fields?: AppField[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('app_fields')
      .where('workspaceId', '==', workspaceId)
      .orderBy('section', 'asc')
      .get();

    const fields = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppField));
    return { success: true, fields };
  } catch (error: any) {
    console.error('>>> [FIELDS] Fetch Failed:', error.message);
    return { success: false, error: error.message };
  }
}
