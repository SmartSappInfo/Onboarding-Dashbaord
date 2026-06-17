'use server';

/**
 * @fileOverview Resumable backfill of the `workspace_contacts` projection from
 * the canonical `workspace_entities` (Phase 6.0). Cursor-based and idempotent:
 * call repeatedly with the returned `nextCursor` until it's null. Contact doc
 * ids are deterministic (`contactDocId`), so re-runs overwrite rather than
 * duplicate.
 *
 * New + edited contacts get projected automatically via the write path
 * (`writeEntityContacts`, Phase 6.1); this seeds legacy rows. Orphan cleanup
 * (contacts deleted before the write-path existed) is handled by the separate
 * reconcile job — this backfill only upserts.
 *
 * See docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md §9.
 */

import { adminDb } from '../firebase-admin';
import type { WorkspaceEntity } from '../types';
import { flattenEntityContacts } from './contact-projection-domain';

const PAGE_SIZE = 100; // WEs per page — each fans out into N contact docs
const MAX_BATCH = 450; // stay under Firestore's 500 writes/commit limit

export interface ContactsBackfillResult {
  /** workspace_entities scanned this page. */
  processed: number;
  /** contact docs written this page. */
  written: number;
  nextCursor: string | null;
}

export async function backfillWorkspaceContacts(opts?: {
  workspaceId?: string;
  afterId?: string;
}): Promise<ContactsBackfillResult> {
  let q = adminDb.collection('workspace_entities') as FirebaseFirestore.Query;
  if (opts?.workspaceId) q = q.where('workspaceId', '==', opts.workspaceId);
  q = q.orderBy('__name__').limit(PAGE_SIZE);
  if (opts?.afterId) q = q.startAfter(opts.afterId);

  const snap = await q.get();
  if (snap.empty) return { processed: 0, written: 0, nextCursor: null };

  const contactsCol = adminDb.collection('workspace_contacts');
  const now = new Date().toISOString();

  let batch = adminDb.batch();
  let pending = 0;
  let written = 0;

  const flush = async () => {
    if (pending > 0) {
      await batch.commit();
      batch = adminDb.batch();
      pending = 0;
    }
  };

  for (const doc of snap.docs) {
    const we = { ...(doc.data() as WorkspaceEntity), id: doc.id };
    const contactDocs = flattenEntityContacts(we);
    for (const c of contactDocs) {
      batch.set(contactsCol.doc(c.id), { ...c, updatedAt: now }, { merge: true });
      pending++;
      written++;
      if (pending >= MAX_BATCH) await flush();
    }
  }
  await flush();

  const nextCursor = snap.size === PAGE_SIZE ? snap.docs[snap.docs.length - 1].id : null;
  return { processed: snap.size, written, nextCursor };
}
