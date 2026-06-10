'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Entity, EntityContact, WorkspaceEntity } from '@/lib/types';

/**
 * Returns the canonical contacts (`entityContacts`) for an entity.
 *
 * Reads from the global `entities` collection (NOT `workspace_entities` — that
 * record does not hold the contact list). Used by the deal creation flow to
 * let the user pick focal contacts from the deal's own entity.
 *
 * Returns an empty array when the entity is missing or has no contacts so
 * callers can render an empty state without special-casing errors.
 */
export async function getEntityContactsAction(entityId: string): Promise<EntityContact[]> {
  try {
    if (!entityId) return [];
    const snap = await adminDb.collection('entities').doc(entityId).get();
    if (!snap.exists) return [];
    const entity = snap.data() as Entity;
    return entity.entityContacts ?? [];
  } catch (e) {
    console.error('Failed to load entity contacts:', e);
    return [];
  }
}

export type EntityAssignee = WorkspaceEntity['assignedTo'];

export interface EntityDealDefaults {
  contacts: EntityContact[];
  /** Workspace-scoped owner, used to pre-select the deal's default assignee. */
  assignedTo: EntityAssignee;
}

/**
 * One round-trip for the deal-creation form: the entity's focal-contact list
 * (global `entities` doc) and its workspace-scoped owner (`workspace_entities`
 * doc keyed `${workspaceId}_${entityId}`). The owner becomes the deal's default
 * assignee unless the creator overrides it.
 *
 * Always resolves (never throws) so the modal can render defaults without
 * special-casing errors; missing data yields `[]` / `null`.
 */
export async function getEntityDealDefaultsAction(
  entityId: string,
  workspaceId: string
): Promise<EntityDealDefaults> {
  if (!entityId || !workspaceId) return { contacts: [], assignedTo: null };
  try {
    const [entitySnap, wsSnap] = await Promise.all([
      adminDb.collection('entities').doc(entityId).get(),
      adminDb.collection('workspace_entities').doc(`${workspaceId}_${entityId}`).get(),
    ]);
    const contacts = entitySnap.exists ? ((entitySnap.data() as Entity).entityContacts ?? []) : [];
    const assignedTo = wsSnap.exists ? ((wsSnap.data() as WorkspaceEntity).assignedTo ?? null) : null;
    return { contacts, assignedTo };
  } catch (e) {
    console.error('Failed to load entity deal defaults:', e);
    return { contacts: [], assignedTo: null };
  }
}
