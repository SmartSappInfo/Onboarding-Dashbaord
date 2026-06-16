'use server';

/**
 * @fileOverview One-time backfill of `displayNameLower` onto existing
 * `workspace_entities` (Phase 5.2 search foundation). Cursor-based and
 * resumable: call repeatedly, passing the returned `nextCursor`, until it's
 * null. Only touches docs missing the field, so re-runs are cheap/idempotent.
 *
 * New + edited entities get `displayNameLower` automatically via the write path
 * (entity-actions / denormalization-sync); this covers legacy rows.
 */

import { adminDb } from '../firebase-admin';
import { toSearchKey } from './entity-cache-domain';

const PAGE_SIZE = 400; // under Firestore's 500 writes/batch limit

export interface BackfillResult {
  processed: number;
  updated: number;
  nextCursor: string | null;
}

export async function backfillDisplayNameLower(opts?: {
  workspaceId?: string;
  afterId?: string;
}): Promise<BackfillResult> {
  let q = adminDb.collection('workspace_entities') as FirebaseFirestore.Query;
  if (opts?.workspaceId) q = q.where('workspaceId', '==', opts.workspaceId);
  q = q.orderBy('__name__').limit(PAGE_SIZE);
  if (opts?.afterId) q = q.startAfter(opts.afterId);

  const snap = await q.get();
  if (snap.empty) return { processed: 0, updated: 0, nextCursor: null };

  const batch = adminDb.batch();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.displayNameLower) continue; // already migrated
    batch.update(doc.ref, {
      displayNameLower: toSearchKey(data.displayName || data.name || ''),
    });
    updated++;
  }
  if (updated > 0) await batch.commit();

  const nextCursor = snap.size === PAGE_SIZE ? snap.docs[snap.docs.length - 1].id : null;
  return { processed: snap.size, updated, nextCursor };
}
