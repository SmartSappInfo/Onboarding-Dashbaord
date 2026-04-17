'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor, PlatformFieldPack, PlatformFieldDefinition } from './backoffice-types';
import type { ContactTypeEntry, EntityType } from '../types';

// ─────────────────────────────────────────────────
// Backoffice Fields & Variables Actions
// Manage system defaults for fields and contact types
// ─────────────────────────────────────────────────

export async function listFieldPacks(): Promise<{
  success: boolean;
  data?: PlatformFieldPack[];
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('platform_field_defaults').orderBy('name', 'asc').get();
    const packs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformFieldPack));

    return { success: true, data: packs };
  } catch (error: any) {
    console.error('[BACKOFFICE_FIELDS] listFieldPacks failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getContactTypeDefaults(entityType: EntityType): Promise<{
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
  } catch (error: any) {
    console.error('[BACKOFFICE_FIELDS] getContactTypeDefaults failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveContactTypeDefaults(
  entityType: EntityType,
  types: ContactTypeEntry[],
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_FIELDS] saveContactTypeDefaults failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveFieldPack(
  pack: Partial<PlatformFieldPack> & { name: string },
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
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
    const { id, ...dataToSave } = payload as any;

    await docRef.set(dataToSave, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, pack.id ? 'field_pack.update' : 'field_pack.create', 'field_pack', docRef.id, {
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_FIELDS] saveFieldPack failed:', error);
    return { success: false, error: error.message };
  }
}

export async function listNativeFields(): Promise<{
  success: boolean;
  data?: PlatformFieldDefinition[];
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('platform_native_fields').orderBy('key', 'asc').get();
    const fields = snap.docs.map((doc) => ({
      ...doc.data(),
      key: doc.id,
    } as PlatformFieldDefinition));

    return { success: true, data: fields };
  } catch (error: any) {
    console.error('[BACKOFFICE_FIELDS] listNativeFields failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveNativeField(
  fieldKey: string,
  fieldDef: Partial<PlatformFieldDefinition>,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_FIELDS] saveNativeField failed:', error);
    return { success: false, error: error.message };
  }
}
