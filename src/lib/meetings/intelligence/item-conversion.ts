/**
 * @fileOverview Convert one v2 meeting item into a task, exactly once (Phase 11 M2 · T3.5; Rules 19, 20).
 *
 * The claim lives in `meeting_item_conversions/{workspaceId}__{itemHash}`, NOT on the item:
 * re-running the analysis rewrites items, but the same item keeps the same hash, so a task created
 * from it is found again and never duplicated. The record holds ids only (no customer content).
 * T4's `meeting.create_followup_tasks` uses the same record.
 *
 * Rules: only validated commitments / action items; an item that needs review gets no one-click
 * action (plan §4.4 rule 7); a second click while converting is refused; after success the same
 * task id is returned; a stale claim (> 2 min, crashed request) can be re-claimed.
 *
 * Tests: src/lib/meetings/__tests__/intelligence-conversion.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { ACTIONABLE_ITEM_TYPES, type MeetingItem } from './intelligence-schemas';
import { readIntelligenceV2 } from './intelligence-store';

export const CONVERSIONS = 'meeting_item_conversions';
export const CONVERSION_CLAIM_MS = 2 * 60 * 1000;

const ConversionSchema = z.object({
  workspaceId: z.string(),
  meetingId: z.string(),
  itemHash: z.string(),
  taskId: z.string().optional(),
  claimedAt: z.string().optional(),
  convertedAt: z.string().optional(),
  convertedBy: z.string().optional(),
});

export class ItemConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemConversionError';
  }
}

export const conversionDocId = (workspaceId: string, itemHash: string) => `${workspaceId}__${itemHash}`;

/** itemHash → task id for the meeting's converted items. */
export async function listConversions(db: Firestore, workspaceId: string, meetingId: string): Promise<Map<string, string>> {
  const snap = await db.collection(CONVERSIONS).where('workspaceId', '==', workspaceId).where('meetingId', '==', meetingId).limit(500).get();
  const out = new Map<string, string>();
  for (const d of snap.docs) {
    const c = ConversionSchema.safeParse(d.data());
    if (c.success && c.data.taskId) out.set(c.data.itemHash, c.data.taskId);
  }
  return out;
}

/** Is this a v2 item of this meeting (vs a v1 action item id)? */
export async function findV2Item(db: Firestore, workspaceId: string, meetingId: string, itemHash: string): Promise<MeetingItem | null> {
  const stored = await readIntelligenceV2(db, meetingId, workspaceId);
  return stored?.items.find((i) => i.itemHash === itemHash) ?? null;
}

export async function convertItemToTask(
  db: Firestore,
  deps: { createTask: (item: MeetingItem) => Promise<{ success: boolean; id?: string; error?: string }>; nowMs: () => number },
  params: { workspaceId: string; meetingId: string; itemHash: string; actorUid: string }
): Promise<{ taskId: string; replayed: boolean }> {
  const item = await findV2Item(db, params.workspaceId, params.meetingId, params.itemHash);
  if (!item) throw new ItemConversionError('Action item not found.');
  if (!ACTIONABLE_ITEM_TYPES.includes(item.type)) throw new ItemConversionError('Only commitments and action items can become tasks.');
  if (item.needsReview) throw new ItemConversionError('Review this item before turning it into a task.');

  const ref = db.collection(CONVERSIONS).doc(conversionDocId(params.workspaceId, params.itemHash));
  const nowIso = () => new Date(deps.nowMs()).toISOString();
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? ConversionSchema.safeParse(snap.data()) : null;
    if (existing?.success && existing.data.taskId) return { kind: 'done' as const, taskId: existing.data.taskId };
    const claimedAt = existing?.success && existing.data.claimedAt ? Date.parse(existing.data.claimedAt) : Number.NaN;
    if (!Number.isNaN(claimedAt) && deps.nowMs() - claimedAt < CONVERSION_CLAIM_MS) {
      throw new ItemConversionError('This action item is already being converted. Try again in a moment.');
    }
    tx.set(ref, { workspaceId: params.workspaceId, meetingId: params.meetingId, itemHash: params.itemHash, claimedAt: nowIso(), convertedBy: params.actorUid });
    return { kind: 'claimed' as const };
  });
  if (claim.kind === 'done') return { taskId: claim.taskId, replayed: true };

  const result = await deps.createTask(item);
  if (!result.success || !result.id) {
    // Release the claim so the person can retry.
    await ref.set({ workspaceId: params.workspaceId, meetingId: params.meetingId, itemHash: params.itemHash });
    throw new ItemConversionError(result.error || 'Could not create the task. Try again.');
  }
  await ref.set({ workspaceId: params.workspaceId, meetingId: params.meetingId, itemHash: params.itemHash, taskId: result.id, convertedAt: nowIso(), convertedBy: params.actorUid });
  return { taskId: result.id, replayed: false };
}
