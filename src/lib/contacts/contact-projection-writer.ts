'use server';

/**
 * @fileOverview Write-path sync for the `workspace_contacts` projection (Phase 6.1).
 *
 * The projection derives entirely from `workspace_entities` (which already holds
 * the denormalized `entityContacts` + workspace-scoped tags/zone/assignee). So
 * the single rule is: **whenever a workspace_entity's contacts or denormalized
 * fields change, re-sync its projection rows.** There are no Firestore triggers
 * in this app (App Hosting only), so callers invoke `syncContactProjectionForWE`
 * right after they write the WE doc. The `reconcile` job is the safety net for
 * any path that forgets.
 *
 * All work routes through the pure domain (`flattenEntityContacts` + `diff`), so
 * the decision of what to upsert/delete is unit-tested; this file is just the
 * thin Firestore I/O around it.
 *
 * See docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md §9.
 */

import { adminDb } from '../firebase-admin';
import type { WorkspaceEntity } from '../types';
import {
  flattenEntityContacts,
  diffContactDocs,
  type ContactDoc,
} from './contact-projection-domain';

const COLLECTION = 'workspace_contacts';

async function readExistingRows(workspaceId: string, entityId: string): Promise<ContactDoc[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where('workspaceId', '==', workspaceId)
    .where('entityId', '==', entityId)
    .get();
  return snap.docs.map((d) => d.data() as ContactDoc);
}

/**
 * Re-sync the projection rows for one workspace_entity. Adds new contacts,
 * updates changed ones (including propagated tag/zone/assignee/status changes),
 * and deletes contacts that were removed. Idempotent.
 *
 * Never throws into the caller — the projection is a read-model; a failure here
 * must not break the entity write. Failures are logged and healed by reconcile.
 */
export async function syncContactProjectionForWE(
  we: Pick<
    WorkspaceEntity,
    | 'id'
    | 'workspaceId'
    | 'entityId'
    | 'entityType'
    | 'status'
    | 'workspaceTags'
    | 'displayName'
    | 'entityName'
    | 'entityContacts'
    | 'primaryEmail'
    | 'primaryPhone'
    | 'primaryContactName'
    | 'assignedTo'
    | 'zone'
    | 'location'
  >,
): Promise<{ upserts: number; deletes: number }> {
  try {
    const workspaceId = we.workspaceId;
    const entityId = we.entityId || we.id;
    if (!workspaceId || !entityId) return { upserts: 0, deletes: 0 };

    const desired = flattenEntityContacts(we as WorkspaceEntity);
    const existing = await readExistingRows(workspaceId, entityId);
    const { upserts, deleteIds } = diffContactDocs(existing, desired);

    if (upserts.length === 0 && deleteIds.length === 0) {
      return { upserts: 0, deletes: 0 };
    }

    const col = adminDb.collection(COLLECTION);
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    for (const d of upserts) batch.set(col.doc(d.id), { ...d, updatedAt: now }, { merge: true });
    for (const id of deleteIds) batch.delete(col.doc(id));
    await batch.commit();

    return { upserts: upserts.length, deletes: deleteIds.length };
  } catch (err: any) {
    console.error('[contacts] projection sync failed (will heal via reconcile):', err?.message);
    return { upserts: 0, deletes: 0 };
  }
}

/**
 * Re-sync projection rows for an entity within a workspace by reading its
 * current WE doc(s). Convenience wrapper for mutation paths that don't hold the
 * full WE object — notably tag apply/remove, which change `workspaceTags`
 * (a segmentation field) on the WE. Safe + best-effort.
 */
export async function syncContactProjectionForEntityWorkspace(
  entityId: string,
  workspaceId: string,
): Promise<void> {
  try {
    if (!entityId || !workspaceId) return;
    const snap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .get();
    for (const doc of snap.docs) {
      await syncContactProjectionForWE({ ...(doc.data() as WorkspaceEntity), id: doc.id });
    }
  } catch (err: any) {
    console.error('[contacts] projection tag-sync failed:', err?.message);
  }
}

/**
 * Cascade-delete the projection rows for an entity (all its contacts in a
 * workspace) — call when a workspace_entity is removed/unlinked.
 */
export async function deleteContactProjectionForEntity(
  workspaceId: string,
  entityId: string,
): Promise<number> {
  try {
    const existing = await readExistingRows(workspaceId, entityId);
    if (existing.length === 0) return 0;
    const col = adminDb.collection(COLLECTION);
    const batch = adminDb.batch();
    for (const d of existing) batch.delete(col.doc(d.id));
    await batch.commit();
    return existing.length;
  } catch (err: any) {
    console.error('[contacts] projection delete failed:', err?.message);
    return 0;
  }
}

export interface ReconcileResult {
  processed: number; // workspace_entities scanned this page
  upserts: number;
  deletes: number;
  nextCursor: string | null;
}

const RECONCILE_PAGE = 100;

/**
 * Cursor-resumable full reconcile: walks `workspace_entities`, re-syncing each
 * one's projection (diff handles both upserts and within-entity contact
 * deletions). The safety net for drift from any write path that bypassed
 * `syncContactProjectionForWE`. Call repeatedly with `nextCursor` until null.
 *
 * Note: orphan rows from an entity that was deleted *before* the cascade existed
 * are not swept here (they have no WE to iterate) — that rare case is handled by
 * the delete cascade going forward; a dedicated orphan sweep can be added if
 * needed.
 */
export async function reconcileWorkspaceContacts(opts?: {
  workspaceId?: string;
  afterId?: string;
}): Promise<ReconcileResult> {
  let q = adminDb.collection('workspace_entities') as FirebaseFirestore.Query;
  if (opts?.workspaceId) q = q.where('workspaceId', '==', opts.workspaceId);
  q = q.orderBy('__name__').limit(RECONCILE_PAGE);
  if (opts?.afterId) q = q.startAfter(opts.afterId);

  const snap = await q.get();
  if (snap.empty) return { processed: 0, upserts: 0, deletes: 0, nextCursor: null };

  let upserts = 0;
  let deletes = 0;
  for (const doc of snap.docs) {
    const we = { ...(doc.data() as WorkspaceEntity), id: doc.id };
    const r = await syncContactProjectionForWE(we);
    upserts += r.upserts;
    deletes += r.deletes;
  }

  const nextCursor = snap.size === RECONCILE_PAGE ? snap.docs[snap.docs.length - 1].id : null;
  return { processed: snap.size, upserts, deletes, nextCursor };
}
