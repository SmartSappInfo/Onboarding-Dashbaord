'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import type { PlatformFieldPack, PlatformFieldDefinition } from './backoffice-types';
import type { ContactTypeEntry, EntityType, IndustryVertical } from '../types';
import { INDUSTRY_FIELD_REGISTRY, IndustryGroupDef } from '../industry-field-registry';
import { propagateIndustryGroupChanges } from './industry-propagation';

// Security: every action verifies the caller's ID token and enforces RBAC
// via `authorizeBackoffice` (server-auth-actions). Actor derived server-side.
// Authorization runs BEFORE any industry propagation fan-out.

// ─────────────────────────────────────────────────
// Backoffice Fields & Variables Actions
// Manage system defaults for fields and contact types
// ─────────────────────────────────────────────────

export async function listFieldPacks(idToken: string): Promise<{
  success: boolean;
  data?: PlatformFieldPack[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'fields', 'view');

    const snap = await adminDb.collection('platform_field_defaults').orderBy('name', 'asc').get();
    const packs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformFieldPack));

    return { success: true, data: packs };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] listFieldPacks failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Internal (token-less) read of system contact-type defaults.
 * For server-to-server callers that are ALREADY trusted (e.g. workspace
 * provisioning in fields-actions.ts). Never expose to clients directly.
 */
export async function getContactTypeDefaultsInternal(entityType: EntityType): Promise<{
  success: boolean;
  data?: { types: ContactTypeEntry[] };
  error?: string;
}> {
  try {
    const doc = await adminDb.collection('platform_contact_type_defaults').doc(`system_${entityType}`).get();
    if (!doc.exists) {
      // Return empty allowing the frontend to fall back to hardcoded defaults if needed
      return { success: true, data: { types: [] } };
    }

    return { success: true, data: doc.data() as { types: ContactTypeEntry[] } };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] getContactTypeDefaultsInternal failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Public (token + fields:view) read of system contact-type defaults. */
export async function getContactTypeDefaults(entityType: EntityType, idToken: string): Promise<{
  success: boolean;
  data?: { types: ContactTypeEntry[] };
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'fields', 'view');
    return await getContactTypeDefaultsInternal(entityType);
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] getContactTypeDefaults failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveContactTypeDefaults(
  entityType: EntityType,
  types: ContactTypeEntry[],
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'fields', 'edit');

    const docRef = adminDb.collection('platform_contact_type_defaults').doc(`system_${entityType}`);
    const snap = await docRef.get();
    
    const before = snap.exists ? createAuditSnapshot(snap.data() as Record<string, unknown>) : null;

    await docRef.set({
      entityType,
      scope: 'system',
      types,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    }, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'contact_defaults.update', 'contact_defaults', entityType, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] saveContactTypeDefaults failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveFieldPack(
  pack: Partial<PlatformFieldPack> & { name: string },
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'fields', 'edit');

    const collection = adminDb.collection('platform_field_defaults');
    let docRef: FirebaseFirestore.DocumentReference;
    let before = null;

    if (pack.id) {
       docRef = collection.doc(pack.id);
       const snap = await docRef.get();
       if (snap.exists) {
          before = createAuditSnapshot(snap.data() as Record<string, unknown>);
       }
    } else {
       docRef = collection.doc();
    }

    const payload = {
       ...pack,
       updatedAt: new Date().toISOString(),
       updatedBy: actor.userId,
    };
    
    if (!pack.id) {
       payload.createdAt = new Date().toISOString();
    }

    // Exclude id from being saved in the doc itself
    const { id: _id, ...dataToSave } = payload;

    await docRef.set(dataToSave, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, pack.id ? 'field_pack.update' : 'field_pack.create', 'field_pack', docRef.id, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] saveFieldPack failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function listNativeFields(idToken: string): Promise<{
  success: boolean;
  data?: PlatformFieldDefinition[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'fields', 'view');

    const snap = await adminDb.collection('platform_native_fields').orderBy('key', 'asc').get();
    const fields = snap.docs.map((doc) => ({
      ...doc.data(),
      key: doc.id,
    } as PlatformFieldDefinition));

    return { success: true, data: fields };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] listNativeFields failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveNativeField(
  fieldKey: string,
  fieldDef: Partial<PlatformFieldDefinition>,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'fields', 'edit');

    const docRef = adminDb.collection('platform_native_fields').doc(fieldKey);
    const snap = await docRef.get();
    
    let before = null;
    if (snap.exists) {
       before = createAuditSnapshot(snap.data() as Record<string, unknown>);
    }

    await docRef.set({
      ...fieldDef,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    }, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, snap.exists ? 'native_field.update' : 'native_field.create', 'native_field', fieldKey, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] saveNativeField failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ─────────────────────────────────────────────────
// Platform Industry-Specific Fields Actions
// ─────────────────────────────────────────────────

/**
 * Internal (token-less) read of an industry's field groups, with lazy
 * self-seeding of registry defaults. For already-trusted server callers
 * (e.g. workspace provisioning in fields-actions.ts). Not for direct client use.
 */
export async function listPlatformIndustryFieldGroupsInternal(industry: IndustryVertical): Promise<{
  success: boolean;
  data?: IndustryGroupDef[];
  error?: string;
}> {
  try {
    const snap = await adminDb
      .collection('platform_industry_field_groups')
      .where('industry', '==', industry)
      .get();

    if (snap.empty) {
      // Lazy self-seeding: write defaults to Firestore
      const defaults = INDUSTRY_FIELD_REGISTRY[industry];
      if (defaults && defaults.length > 0) {
        const batch = adminDb.batch();
        const now = new Date().toISOString();

        for (const group of defaults) {
          const docId = `${industry}_${group.slug}`;
          const ref = adminDb.collection('platform_industry_field_groups').doc(docId);
          batch.set(ref, {
            ...group,
            industry,
            createdAt: now,
            updatedAt: now,
            updatedBy: 'system',
          });
        }
        await batch.commit();

        // Query again to get the seeded data
        const seededSnap = await adminDb
          .collection('platform_industry_field_groups')
          .where('industry', '==', industry)
          .get();
        const seededGroups = seededSnap.docs.map(doc => doc.data() as IndustryGroupDef);
        return { success: true, data: seededGroups };
      }
      return { success: true, data: [] };
    }

    const groups = snap.docs.map(doc => doc.data() as IndustryGroupDef);
    // Sort groups by 'order' asc
    groups.sort((a, b) => a.order - b.order);
    return { success: true, data: groups };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] listPlatformIndustryFieldGroupsInternal failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Public (token + fields:view) read of an industry's field groups. */
export async function listPlatformIndustryFieldGroups(industry: IndustryVertical, idToken: string): Promise<{
  success: boolean;
  data?: IndustryGroupDef[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'fields', 'view');
    return await listPlatformIndustryFieldGroupsInternal(industry);
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] listPlatformIndustryFieldGroups failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function savePlatformIndustryFieldGroup(
  industry: IndustryVertical,
  groupSlug: string,
  groupDef: Omit<IndustryGroupDef, 'slug'> & { slug?: string },
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Authorize BEFORE the write + workspace-wide propagation fan-out.
    const actor = await authorizeBackoffice(idToken, 'fields', 'edit');

    const docId = `${industry}_${groupSlug}`;
    const ref = adminDb.collection('platform_industry_field_groups').doc(docId);
    const snap = await ref.get();

    let before = null;
    if (snap.exists) {
      before = createAuditSnapshot(snap.data() as Record<string, unknown>);
    }

    const now = new Date().toISOString();
    const payload: IndustryGroupDef & { industry: IndustryVertical; updatedAt: string; updatedBy: string; createdAt?: string } = {
      ...groupDef,
      slug: groupSlug, // Lock slug to passed value
      industry,
      updatedAt: now,
      updatedBy: actor.userId,
    };

    if (!snap.exists) {
      payload.createdAt = now;
    }

    await ref.set(payload, { merge: true });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(
      actor,
      snap.exists ? 'industry_field_group.update' : 'industry_field_group.create',
      'industry_field_group',
      docId,
      {
        before,
        after,
      }
    );

    // Propagate changes to all workspaces in this industry
    const propRes = await propagateIndustryGroupChanges(industry, groupSlug, false, payload);
    if (!propRes.success) {
      console.warn(`[BACKOFFICE_FIELDS] Propagation failed during save: ${propRes.error}`);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] savePlatformIndustryFieldGroup failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deletePlatformIndustryFieldGroup(
  industry: IndustryVertical,
  groupSlug: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Authorize BEFORE the delete + workspace-wide propagation fan-out.
    const actor = await authorizeBackoffice(idToken, 'fields', 'delete');

    const docId = `${industry}_${groupSlug}`;
    const ref = adminDb.collection('platform_industry_field_groups').doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Industry field group not found.' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.delete();

    await logBackofficeAction(
      actor,
      'industry_field_group.delete',
      'industry_field_group',
      docId,
      {
        before,
        after: null,
      }
    );

    // Propagate deletion to all workspaces in this industry
    const propRes = await propagateIndustryGroupChanges(industry, groupSlug, true);
    if (!propRes.success) {
      console.warn(`[BACKOFFICE_FIELDS] Propagation failed during delete: ${propRes.error}`);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FIELDS] deletePlatformIndustryFieldGroup failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
