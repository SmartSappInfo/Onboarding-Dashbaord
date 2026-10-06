import 'server-only';

/**
 * @fileOverview Meeting data retention: plan → (shadow | enforce) → verify (Phase 11 M1 · T6, G10).
 *
 * WHY: the compliance page let workspaces set a retention period, but nothing ever deleted data.
 *
 * SAFETY MODEL (Rules 21, 22, 25, 27, 40, 42)
 * - Opt-in: a workspace is processed only when its policy has a period > 0 AND auto-purge for
 *   transcripts and/or recordings (`retentionEnabled`, maintained by compliance-policy-store).
 * - SHADOW by default (`retentionMode: 'shadow'`): each run records what WOULD be deleted
 *   (`meeting_retention_runs`) and deletes nothing. A person switches to 'enforced' after reviewing
 *   the preview (the switch is bound to the previewed candidate set, see compliance-policy-store).
 * - Floor: never younger than 30 days (existing planner rule). Legal hold and pinned meetings are
 *   always skipped.
 * - Owned data only: for meetings shared across workspaces, a workspace purges ITS transcripts,
 *   recordings and intelligence, never another workspace's.
 * - Saga per transcript: tombstone (status 'deleting') → chunks → registered cascades (M3 memory,
 *   inbox, graph) → header. Every step is idempotent; an interrupted run is finished by the next one.
 * - Bounded: ≤ MAX_WORKSPACES_PER_RUN workspaces, ≤ MAX_MEETINGS_PER_RUN meetings per run.
 * - Audit: ids, counts, candidate-set hash and policy version; never content.
 *
 * CAUTION: deletion is permanent. Any change here needs a test proving shadow mode deletes nothing.
 *
 * Tests: src/lib/meetings/__tests__/retention-service.test.ts
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { CompliancePolicyRecordSchema } from './compliance-policy-store';
import { deleteIntelligenceRuns } from './intelligence/intelligence-store';
import { meetingBelongsToWorkspace } from './meeting-access';
import { MeetingRecordingRecordSchema, isRecordingPathForMeeting } from './schemas/recording-schemas';
import { SEGMENTS, TRANSCRIPTS, TranscriptHeaderSchema, chunkId, canTransition, type TranscriptStatusV2 } from './transcript-store';

export const RETENTION_FLOOR_DAYS = 30;
export const MAX_WORKSPACES_PER_RUN = 5;
export const MAX_MEETINGS_PER_RUN = 50;
/** M1 review R1: the heartbeat fires every minute; each workspace is processed at most daily. */
export const MIN_RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export type RetentionReason = 'retention' | 'manual' | 'consent_withdrawn';

/** Downstream data derived from a transcript (M3: memory, inbox, graph) registers here. */
export type RetentionCascade = (params: { workspaceId: string; sourceType: 'meeting_transcript'; sourceId: string; reason: RetentionReason }) => Promise<void>;
const cascades: RetentionCascade[] = [];
export function registerRetentionCascade(cascade: RetentionCascade): () => void {
  cascades.push(cascade);
  return () => {
    const i = cascades.indexOf(cascade);
    if (i >= 0) cascades.splice(i, 1);
  };
}

/** Storage deletion port (Admin bucket in production, fake in tests). */
export interface RetentionStorage {
  deleteObject(path: string): Promise<void>;
}

export interface RetentionAudit {
  (entry: { workspaceId: string; meetingId: string; reason: RetentionReason; candidateSetHash: string; policyVersion: string; deleted: { transcripts: number; recordings: number; intelligence: number } }): Promise<void>;
}

export interface MeetingCandidate {
  meetingId: string;
  transcriptIds: string[];
  recordingIds: string[];
  intelligence: boolean;
}

export interface RetentionPlan {
  workspaceId: string;
  mode: 'shadow' | 'enforced';
  policyVersion: string;
  cutoffIso: string;
  candidates: MeetingCandidate[];
  candidateSetHash: string;
  counts: { meetings: number; transcripts: number; recordings: number; intelligence: number };
  truncated: boolean;
  /** meetingTime of the last scanned meeting when the window was full; '' when the pass reached the end. */
  nextCursor: string;
}

const MeetingRetentionSchema = z.object({
  workspaceIds: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
  meetingTime: z.string().catch(''),
  isPinned: z.boolean().optional(),
  legalHold: z.object({ on: z.boolean() }).loose().optional(),
});

export function hashCandidateSet(candidates: readonly MeetingCandidate[]): string {
  const canonical = [...candidates]
    .map((c) => ({ m: c.meetingId, t: [...c.transcriptIds].sort(), r: [...c.recordingIds].sort(), i: c.intelligence }))
    .sort((a, b) => a.m.localeCompare(b.m));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** Read-only plan for one workspace. Safe to call from previews. */
export async function planWorkspaceRetention(
  db: Firestore,
  params: {
    workspaceId: string;
    nowMs: number;
    maxMeetings?: number;
    policyOverride?: { retentionPeriodDays: number; autoPurgeTranscripts: boolean; autoPurgeRecordings: boolean };
    /** Resume after this meetingTime (M1 review R2b). Previews pass nothing (start from newest). */
    cursor?: string;
  }
): Promise<RetentionPlan> {
  const snap = await db.collection('meeting_compliance_policies').doc(params.workspaceId).get();
  const parsed = snap.exists ? CompliancePolicyRecordSchema.safeParse(snap.data()) : null;
  const stored = parsed?.success ? parsed.data : null;
  const policy = params.policyOverride ?? {
    retentionPeriodDays: stored?.retentionPeriodDays ?? 0,
    autoPurgeTranscripts: stored?.autoPurgeTranscripts === true,
    autoPurgeRecordings: stored?.autoPurgeRecordings === true,
  };
  const mode = stored?.retentionMode === 'enforced' ? 'enforced' : 'shadow';
  const policyVersion = stored?.updatedAt ?? '';
  const empty = (cutoffIso: string): RetentionPlan => ({
    workspaceId: params.workspaceId, mode, policyVersion, cutoffIso, candidates: [], candidateSetHash: hashCandidateSet([]),
    counts: { meetings: 0, transcripts: 0, recordings: 0, intelligence: 0 }, truncated: false, nextCursor: '',
  });

  if (!(policy.retentionPeriodDays > 0) || (!policy.autoPurgeTranscripts && !policy.autoPurgeRecordings)) return empty('');

  const days = Math.max(RETENTION_FLOOR_DAYS, policy.retentionPeriodDays);
  const cutoffIso = new Date(params.nowMs - days * DAY_MS).toISOString();
  const max = Math.min(params.maxMeetings ?? MAX_MEETINGS_PER_RUN, MAX_MEETINGS_PER_RUN);

  // Existing composite index: (workspaceIds CONTAINS, meetingTime DESC).
  // CAUTION (M1 review R2b): without a cursor every run re-read the same newest-old meetings and,
  // once those were purged, never reached older meetings that still held data.
  const scanLimit = max * 2;
  let query = db
    .collection('meetings')
    .where('workspaceIds', 'array-contains', params.workspaceId)
    .where('meetingTime', '<', cutoffIso)
    .orderBy('meetingTime', 'desc');
  if (params.cursor) query = query.startAfter(params.cursor);
  const meetingsSnap = await query.limit(scanLimit).get();
  const lastScanned = meetingsSnap.docs[meetingsSnap.docs.length - 1]?.data()?.meetingTime;

  const candidates: MeetingCandidate[] = [];
  for (const doc of meetingsSnap.docs) {
    if (candidates.length >= max) break;
    const m = MeetingRetentionSchema.safeParse(doc.data());
    if (!m.success || !meetingBelongsToWorkspace(m.data, params.workspaceId)) continue;
    if (m.data.isPinned || m.data.legalHold?.on) continue;
    if (!m.data.meetingTime || m.data.meetingTime >= cutoffIso) continue;

    const [transcripts, recordings, intel] = await Promise.all([
      policy.autoPurgeTranscripts
        ? db.collection(TRANSCRIPTS).where('workspaceId', '==', params.workspaceId).where('meetingId', '==', doc.id).limit(50).get()
        : null,
      policy.autoPurgeRecordings
        ? db.collection('meeting_recordings').where('meetingId', '==', doc.id).where('workspaceId', '==', params.workspaceId).limit(100).get()
        : null,
      policy.autoPurgeTranscripts ? db.collection('meeting_intelligence').doc(doc.id).get() : null,
    ]);
    const candidate: MeetingCandidate = {
      meetingId: doc.id,
      transcriptIds: transcripts?.docs.map((d) => d.id) ?? [],
      recordingIds: recordings?.docs.map((d) => d.id) ?? [],
      intelligence: Boolean(intel?.exists && intel.data()?.workspaceId === params.workspaceId),
    };
    if (candidate.transcriptIds.length || candidate.recordingIds.length || candidate.intelligence) candidates.push(candidate);
  }

  return {
    workspaceId: params.workspaceId,
    mode,
    policyVersion,
    cutoffIso,
    candidates,
    candidateSetHash: hashCandidateSet(candidates),
    counts: {
      meetings: candidates.length,
      transcripts: candidates.reduce((n, c) => n + c.transcriptIds.length, 0),
      recordings: candidates.reduce((n, c) => n + c.recordingIds.length, 0),
      intelligence: candidates.filter((c) => c.intelligence).length,
    },
    truncated: meetingsSnap.docs.length >= scanLimit || candidates.length >= max,
    nextCursor: meetingsSnap.docs.length >= scanLimit && typeof lastScanned === 'string' ? lastScanned : '',
  };
}

/**
 * Deletes one transcript (tombstone → chunks → cascades → header). Idempotent and resumable.
 * Returns false when there was nothing to delete or the transcript belongs to another workspace.
 */
export async function deleteTranscriptCascade(
  db: Firestore,
  params: { workspaceId: string; transcriptId: string; reason: RetentionReason; nowIso: string; expectedVersion?: number }
): Promise<boolean> {
  const ref = db.collection(TRANSCRIPTS).doc(params.transcriptId);
  const tomb = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const raw = snap.data() ?? {};
    if (raw.workspaceId !== params.workspaceId) return null;
    const parsed = TranscriptHeaderSchema.safeParse(raw);
    const status: TranscriptStatusV2 | 'legacy' = parsed.success ? parsed.data.status : 'legacy';
    const version = typeof raw.version === 'number' ? raw.version : 0;
    if (params.expectedVersion !== undefined && version !== params.expectedVersion) {
      throw new Error('The transcript changed. Reload and try again.');
    }
    if (status !== 'deleting' && status !== 'legacy' && !canTransition(status, 'deleting')) return null;
    if (status !== 'deleting') tx.update(ref, { status: 'deleting', version: version + 1, deletionReason: params.reason, updatedAt: params.nowIso });
    const chunkCount = parsed.success ? Math.max(parsed.data.chunkCount, Math.ceil(parsed.data.segmentCount / 500)) : 0;
    return { chunkCount, meetingId: typeof raw.meetingId === 'string' ? raw.meetingId : '' };
  });
  if (!tomb) return false;

  for (let start = 0; start < tomb.chunkCount; start += 250) {
    const batch = db.batch();
    for (let i = start; i < Math.min(tomb.chunkCount, start + 250); i += 1) batch.delete(ref.collection(SEGMENTS).doc(chunkId(i)));
    await batch.commit();
  }
  // Built-in cascade (M1 review R7): AI output derived from this transcript goes with it.
  if (tomb.meetingId) {
    await deleteDerivedMeetingData(db, { workspaceId: params.workspaceId, meetingId: tomb.meetingId, transcriptId: params.transcriptId });
  }
  for (const cascade of [...cascades]) {
    await cascade({ workspaceId: params.workspaceId, sourceType: 'meeting_transcript', sourceId: params.transcriptId, reason: params.reason });
  }
  await ref.delete();
  if (tomb.meetingId) await clearMeetingDataFlags(db, tomb.meetingId, params.nowIso);
  return true;
}

/**
 * Deletes AI output derived from a meeting's transcript in this workspace: the intelligence record,
 * its items subcollection and follow-up drafts (M2). When `transcriptId` is given, intelligence is
 * deleted only if it came from that transcript, or if it is legacy (no transcriptId) and the meeting
 * has no other transcript left in this workspace. Returns true when intelligence was deleted.
 * CAUTION: bounded (≤ 500 items, ≤ 100 drafts per call); callers may call again to finish.
 */
export async function deleteDerivedMeetingData(
  db: Firestore,
  params: { workspaceId: string; meetingId: string; transcriptId?: string }
): Promise<boolean> {
  const intelRef = db.collection('meeting_intelligence').doc(params.meetingId);
  const intel = await intelRef.get();
  let deletedIntel = false;
  if (intel.exists && intel.data()?.workspaceId === params.workspaceId) {
    const source = intel.data()?.transcriptId;
    let derived = !params.transcriptId || source === params.transcriptId;
    if (!derived && params.transcriptId && typeof source !== 'string') {
      const others = await db.collection(TRANSCRIPTS)
        .where('workspaceId', '==', params.workspaceId).where('meetingId', '==', params.meetingId).limit(2).get();
      derived = others.docs.every((d) => d.id === params.transcriptId);
    }
    if (derived) {
      const items = await intelRef.collection('items').limit(500).get();
      for (let i = 0; i < items.docs.length; i += 250) {
        const batch = db.batch();
        for (const d of items.docs.slice(i, i + 250)) batch.delete(d.ref);
        await batch.commit();
      }
      await intelRef.delete();
      deletedIntel = true;
    }
  }
  let draftQuery = db.collection('meeting_followup_drafts')
    .where('workspaceId', '==', params.workspaceId).where('meetingId', '==', params.meetingId);
  if (params.transcriptId && !deletedIntel) draftQuery = draftQuery.where('transcriptId', '==', params.transcriptId);
  const drafts = await draftQuery.limit(100).get();
  if (!drafts.empty) {
    const batch = db.batch();
    for (const d of drafts.docs) batch.delete(d.ref);
    await batch.commit();
  }
  // Pipeline runs and their chunk checkpoints hold quotes from the transcript (M2 · T3).
  await deleteIntelligenceRuns(db, {
    workspaceId: params.workspaceId,
    meetingId: params.meetingId,
    ...(params.transcriptId && !deletedIntel ? { transcriptId: params.transcriptId } : {}),
  });
  return deletedIntel;
}

/** Clears `hasTranscript` / `hasRecording` when nothing of that kind remains (any workspace). */
export async function clearMeetingDataFlags(db: Firestore, meetingId: string, nowIso: string): Promise<void> {
  const [t, r] = await Promise.all([
    db.collection(TRANSCRIPTS).where('meetingId', '==', meetingId).limit(1).get(),
    db.collection('meeting_recordings').where('meetingId', '==', meetingId).limit(1).get(),
  ]);
  const patch: Record<string, unknown> = {};
  if (t.empty) patch.hasTranscript = false;
  if (r.empty) patch.hasRecording = false;
  if (Object.keys(patch).length) {
    await db.collection('meetings').doc(meetingId).update({ ...patch, updatedAt: nowIso }).catch(() => undefined);
  }
}

async function deleteRecording(db: Firestore, storage: RetentionStorage, workspaceId: string, recordingId: string): Promise<boolean> {
  const ref = db.collection('meeting_recordings').doc(recordingId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const rec = MeetingRecordingRecordSchema.safeParse(snap.data());
  if (!rec.success || rec.data.workspaceId !== workspaceId) return false;
  if (rec.data.storagePath && isRecordingPathForMeeting(rec.data.storagePath, workspaceId, rec.data.meetingId)) {
    await storage.deleteObject(rec.data.storagePath);
  }
  await ref.delete();
  return true;
}

export interface RetentionRunResult {
  workspaceId: string;
  mode: 'shadow' | 'enforced';
  candidateSetHash: string;
  planned: RetentionPlan['counts'];
  deleted: { transcripts: number; recordings: number; intelligence: number };
  verified: boolean;
  resumedTombstones: number;
}

/** Plans and (when enforced) executes retention for one workspace; always records the run. */
export async function runWorkspaceRetention(
  db: Firestore,
  deps: { storage: RetentionStorage; audit: RetentionAudit; nowMs: number },
  workspaceId: string,
  options: { useCursor?: boolean } = {}
): Promise<RetentionRunResult> {
  const nowIso = new Date(deps.nowMs).toISOString();

  // Finish interrupted deletions first (tombstones survive crashes).
  const tombstones = await db.collection(TRANSCRIPTS).where('workspaceId', '==', workspaceId).where('status', '==', 'deleting').limit(20).get();
  let resumedTombstones = 0;
  for (const t of tombstones.docs) {
    if (await deleteTranscriptCascade(db, { workspaceId, transcriptId: t.id, reason: 'retention', nowIso })) resumedTombstones += 1;
  }

  const policyRef = db.collection('meeting_compliance_policies').doc(workspaceId);
  const storedCursor = options.useCursor === false ? '' : String((await policyRef.get()).data()?.retentionCursor ?? '');
  const plan = await planWorkspaceRetention(db, { workspaceId, nowMs: deps.nowMs, cursor: storedCursor || undefined });
  const deleted = { transcripts: 0, recordings: 0, intelligence: 0 };

  if (plan.mode === 'enforced') {
    for (const c of plan.candidates) {
      // Re-check legal hold right before each meeting (it may have been set mid-run).
      const fresh = MeetingRetentionSchema.safeParse((await db.collection('meetings').doc(c.meetingId).get()).data());
      if (!fresh.success || fresh.data.legalHold?.on || fresh.data.isPinned) continue;

      const before = { ...deleted };
      // Derived AI output first, so it is counted here rather than inside the transcript cascade.
      if (c.intelligence && (await deleteDerivedMeetingData(db, { workspaceId, meetingId: c.meetingId }))) {
        deleted.intelligence += 1;
      }
      for (const id of c.transcriptIds) if (await deleteTranscriptCascade(db, { workspaceId, transcriptId: id, reason: 'retention', nowIso })) deleted.transcripts += 1;
      for (const id of c.recordingIds) if (await deleteRecording(db, deps.storage, workspaceId, id)) deleted.recordings += 1;
      await clearMeetingDataFlags(db, c.meetingId, nowIso);
      await deps.audit({
        workspaceId, meetingId: c.meetingId, reason: 'retention', candidateSetHash: plan.candidateSetHash, policyVersion: plan.policyVersion,
        deleted: { transcripts: deleted.transcripts - before.transcripts, recordings: deleted.recordings - before.recordings, intelligence: deleted.intelligence - before.intelligence },
      });
    }
  }

  // Verify: nothing planned remains (enforced) — shadow trivially verifies.
  let verified = true;
  if (plan.mode === 'enforced') {
    for (const c of plan.candidates) {
      for (const id of c.transcriptIds) if ((await db.collection(TRANSCRIPTS).doc(id).get()).exists) verified = false;
      for (const id of c.recordingIds) if ((await db.collection('meeting_recordings').doc(id).get()).exists) verified = false;
    }
  }

  await db.collection('meeting_retention_runs').doc(randomUUID()).set({
    workspaceId, mode: plan.mode, policyVersion: plan.policyVersion, cutoffIso: plan.cutoffIso,
    candidateSetHash: plan.candidateSetHash, planned: plan.counts, deleted, verified, resumedTombstones,
    truncated: plan.truncated, at: nowIso,
  });
  await policyRef.update({
    retentionLastRunAt: nowIso,
    ...(options.useCursor === false ? {} : { retentionCursor: plan.nextCursor }),
  }).catch(() => undefined);

  return { workspaceId, mode: plan.mode, candidateSetHash: plan.candidateSetHash, planned: plan.counts, deleted, verified, resumedTombstones };
}

/** Heartbeat entry point: the least recently processed opted-in workspaces, bounded. */
export async function runRetentionSweep(
  db: Firestore,
  deps: { storage: RetentionStorage; audit: RetentionAudit; nowMs: number }
): Promise<RetentionRunResult[]> {
  const snap = await db
    .collection('meeting_compliance_policies')
    .where('retentionEnabled', '==', true)
    // Same composite index (equality + range on the orderBy field). '' (never run) sorts first.
    .where('retentionLastRunAt', '<', new Date(deps.nowMs - MIN_RUN_INTERVAL_MS).toISOString())
    .orderBy('retentionLastRunAt', 'asc')
    .limit(MAX_WORKSPACES_PER_RUN)
    .get();
  const results: RetentionRunResult[] = [];
  for (const doc of snap.docs) {
    try {
      results.push(await runWorkspaceRetention(db, deps, doc.id));
    } catch (err) {
      console.error('[retention] workspace run failed', doc.id, err instanceof Error ? err.message : String(err));
    }
  }
  return results;
}
