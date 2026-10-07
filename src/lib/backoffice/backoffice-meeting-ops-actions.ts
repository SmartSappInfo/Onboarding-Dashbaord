/**
 * @fileoverview Backoffice control plane for meeting transcription & retention (Phase 11 M1 · T9).
 *
 * Operable without code (Rules 15, 60–63):
 * - Inspect: transcription queue, dead letters, today's usage, recent retention runs, controls.
 * - Control: pause transcription, block audio egress (kill switches), per-workspace daily quota,
 *   per-workspace AI data policy, reprocess/discard dead letters, run retention now (bound to a
 *   reviewed preview).
 *
 * SECURITY: every action calls `authorizeBackoffice(idToken, 'meetings_monitor', …)` FIRST and
 * records a Backoffice audit entry with before/after. Reads are bounded (≤ 50 rows).
 *
 * CAUTION: nothing here returns transcript text or media URLs; operators see ids, states and counts.
 *
 * @testability src/lib/backoffice/__tests__/backoffice-meeting-ops-actions.test.ts
 */

'use server';

import { z } from 'zod/v4';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { authorizeBackoffice } from './backoffice-auth';
import { logBackofficeAction } from './audit-logger';
import { getErrorMessage } from './backoffice-errors';
import { readMeetingControls, AiDataPolicySchema } from '@/platform/policy/ai-data-policy';
import { TranscriptHeaderSchema } from '@/lib/meetings/transcript-store';
import { planWorkspaceRetention, runWorkspaceRetention } from '@/lib/meetings/retention-service';
import { DEFAULT_DAILY_MINUTES, TRANSCRIPTION_ENDPOINT, TRANSCRIPTION_QUEUE } from '@/lib/meetings/transcription-request';
import { scheduleTaskWithKey } from '@/lib/gcp-tasks-client';
import { defaultAuditSink } from '@/platform/capabilities/storage/audit-store';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { INTELLIGENCE_ENDPOINT, INTELLIGENCE_QUEUE } from '@/lib/meetings/intelligence/pipeline';
import { RUNS } from '@/lib/meetings/intelligence/intelligence-store';
import { EXTRACT_PROMPT_VERSION, FOLLOWUP_DRAFT_PROMPT_VERSION, SUMMARY_PROMPT_VERSION, promptHash } from '@/lib/meetings/intelligence/prompts';
import { SHADOW_RUNS } from '@/lib/meetings/intelligence/shadow';

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface MeetingOpsSnapshot {
  controls: {
    transcriptionPaused: boolean;
    blockAudioEgress: boolean;
    meetingAnalystPaused: boolean;
    pipelineQueuePaused: boolean;
    autoTriggerDisabled: boolean;
    proposalsPaused: boolean;
  };
  queue: Array<{ transcriptId: string; workspaceId: string; meetingId: string; status: string; attempts: number; updatedAt: string }>;
  deadLetters: Array<{ transcriptId: string; code: string; message: string; at: string }>;
  usageToday: Array<{ workspaceId: string; minutes: number }>;
  retentionRuns: Array<{ workspaceId: string; mode: string; planned: Record<string, number>; deleted: Record<string, number>; verified: boolean; at: string }>;
  defaultDailyMinutes: number;
  pipelineRuns: Array<{ runId: string; workspaceId: string; meetingId: string; status: string; step: string; attempts: number; updatedAt: string }>;
  pipelineDlq: Array<{ runId: string; code: string; message: string; at: string }>;
  shadowRuns: Array<{ runId: string; workspaceId: string; meetingId: string; promptVersion: string; comparison: unknown; createdAt: string }>;
  securityFeed: Array<{ alertId: string; type: string; workspaceId: string; meetingId: string; reason: string; timestamp: string }>;
  promptVersions: Array<{ name: string; version: string; hash: string }>;
  workspaceOverrides: Array<{ workspaceId: string; promptVersion: string; updatedAt: string }>;
}

const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export async function getMeetingOpsSnapshotAction(idToken: string): Promise<Result<MeetingOpsSnapshot>> {
  try {
    await authorizeBackoffice(idToken, 'meetings_monitor', 'view');
    const today = new Date().toISOString().slice(0, 10);
    const [
      controls,
      queueSnap,
      dlqSnap,
      usageSnap,
      runsSnap,
      pipelineRunsSnap,
      pipelineDlqSnap,
      shadowSnap,
      secSnap,
      overridesSnap,
    ] = await Promise.all([
      readMeetingControls(adminDb),
      adminDb.collection('meeting_transcripts').where('status', 'in', ['pending', 'processing']).orderBy('updatedAt', 'desc').limit(50).get(),
      adminDb.collection('meeting_transcription_dlq').where('resolved', '==', false).limit(50).get(),
      adminDb.collection('meeting_transcription_usage').where('day', '==', today).orderBy('minutes', 'desc').limit(20).get(),
      adminDb.collection('meeting_retention_runs').orderBy('at', 'desc').limit(20).get(),
      adminDb.collection(RUNS).orderBy('updatedAt', 'desc').limit(50).get(),
      adminDb.collection('meeting_intelligence_dlq').where('resolved', '==', false).limit(50).get(),
      adminDb.collection(SHADOW_RUNS).limit(20).get(),
      adminDb.collection('meeting_agent_security_feed').limit(20).get(),
      adminDb.collection('meeting_prompt_overrides').limit(20).get(),
    ]);
    return {
      success: true,
      data: {
        controls: {
          transcriptionPaused: controls.transcriptionPaused === true,
          blockAudioEgress: controls.blockAudioEgress === true,
          meetingAnalystPaused: controls.meetingAnalystPaused === true,
          pipelineQueuePaused: controls.pipelineQueuePaused === true,
          autoTriggerDisabled: controls.autoTriggerDisabled === true,
          proposalsPaused: controls.proposalsPaused === true,
        },
        queue: queueSnap.docs.flatMap((d) => {
          const h = TranscriptHeaderSchema.safeParse(d.data());
          return h.success ? [{ transcriptId: d.id, workspaceId: h.data.workspaceId, meetingId: h.data.meetingId, status: h.data.status, attempts: h.data.attempts ?? 0, updatedAt: h.data.updatedAt }] : [];
        }),
        deadLetters: dlqSnap.docs.map((d) => ({ transcriptId: d.id, code: str(d.data()?.code), message: str(d.data()?.message), at: str(d.data()?.at) })),
        usageToday: usageSnap.docs.map((d) => ({ workspaceId: str(d.data()?.workspaceId), minutes: num(d.data()?.minutes) })),
        retentionRuns: runsSnap.docs.map((d) => {
          const r = d.data() ?? {};
          return {
            workspaceId: str(r.workspaceId), mode: str(r.mode), at: str(r.at), verified: r.verified === true,
            planned: (r.planned && typeof r.planned === 'object' ? r.planned : {}) as Record<string, number>,
            deleted: (r.deleted && typeof r.deleted === 'object' ? r.deleted : {}) as Record<string, number>,
          };
        }),
        defaultDailyMinutes: DEFAULT_DAILY_MINUTES,
        pipelineRuns: pipelineRunsSnap.docs.map((d) => {
          const data = d.data() ?? {};
          return {
            runId: d.id,
            workspaceId: str(data.workspaceId),
            meetingId: str(data.meetingId),
            status: str(data.status),
            step: str(data.step),
            attempts: num(data.attempts),
            updatedAt: str(data.updatedAt),
          };
        }),
        pipelineDlq: pipelineDlqSnap.docs.map((d) => {
          const data = d.data() ?? {};
          return {
            runId: d.id,
            code: str(data.code),
            message: str(data.message),
            at: str(data.at),
          };
        }),
        shadowRuns: shadowSnap.docs.map((d) => {
          const data = d.data() ?? {};
          return {
            runId: d.id,
            workspaceId: str(data.workspaceId),
            meetingId: str(data.meetingId),
            promptVersion: str(data.promptVersion),
            comparison: data.comparison ?? null,
            createdAt: str(data.createdAt),
          };
        }),
        securityFeed: secSnap.docs.map((d) => {
          const data = d.data() ?? {};
          return {
            alertId: d.id,
            type: str(data.type),
            workspaceId: str(data.workspaceId),
            meetingId: str(data.meetingId),
            reason: str(data.reason),
            timestamp: str(data.timestamp),
          };
        }),
        promptVersions: [
          { name: 'Chunk Extraction', version: EXTRACT_PROMPT_VERSION, hash: promptHash(EXTRACT_PROMPT_VERSION) },
          { name: 'Summary Synthesis', version: SUMMARY_PROMPT_VERSION, hash: promptHash(SUMMARY_PROMPT_VERSION) },
          { name: 'Follow-up Draft', version: FOLLOWUP_DRAFT_PROMPT_VERSION, hash: promptHash(FOLLOWUP_DRAFT_PROMPT_VERSION) },
        ],
        workspaceOverrides: overridesSnap.docs.map((d) => {
          const data = d.data() ?? {};
          return {
            workspaceId: str(data.workspaceId || d.id),
            promptVersion: str(data.promptVersion),
            updatedAt: str(data.updatedAt),
          };
        }),
      },
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

const ControlsSchema = z.object({
  transcriptionPaused: z.boolean().optional(),
  blockAudioEgress: z.boolean().optional(),
  meetingAnalystPaused: z.boolean().optional(),
  pipelineQueuePaused: z.boolean().optional(),
  autoTriggerDisabled: z.boolean().optional(),
  proposalsPaused: z.boolean().optional(),
});

/** Kill switches (Rule 60): pause transcription, agent, pipeline, auto-trigger or CRM proposals. */
export async function setMeetingControlsAction(
  idToken: string,
  controls: {
    transcriptionPaused?: boolean;
    blockAudioEgress?: boolean;
    meetingAnalystPaused?: boolean;
    pipelineQueuePaused?: boolean;
    autoTriggerDisabled?: boolean;
    proposalsPaused?: boolean;
  }
): Promise<Result<{ saved: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'execute');
    const parsed = ControlsSchema.parse(controls);
    const ref = adminDb.collection('platform_config').doc('meeting_controls');
    const before = (await ref.get()).data() ?? null;
    const after = { ...(before ?? {}), ...parsed, updatedAt: new Date().toISOString() };
    await ref.set(after);
    await logBackofficeAction(actor, 'meeting_controls.update', 'platform_config', 'meeting_controls', { scope: 'platform', before, after });
    return { success: true, data: { saved: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Per-workspace daily transcription minutes (D11 override). */
export async function setTranscriptionQuotaAction(idToken: string, workspaceId: string, dailyMinutes: number): Promise<Result<{ saved: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'edit');
    const ws = z.string().min(1).max(200).regex(/^[^/]+$/).parse(workspaceId);
    const minutes = z.number().int().min(0).max(24 * 60).parse(dailyMinutes);
    const ref = adminDb.collection('meeting_transcription_quotas').doc(ws);
    const before = (await ref.get()).data() ?? null;
    const after = { workspaceId: ws, dailyMinutes: minutes, updatedAt: new Date().toISOString() };
    await ref.set(after);
    await logBackofficeAction(actor, 'transcription_quota.update', 'workspace', ws, { scope: 'workspace', scopeId: ws, before, after });
    return { success: true, data: { saved: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Per-workspace AI data policy (Rule 57): allowed providers and providers blocked for personal data. */
export async function setWorkspaceAiDataPolicyAction(idToken: string, workspaceId: string, policy: unknown): Promise<Result<{ saved: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'edit');
    const ws = z.string().min(1).max(200).regex(/^[^/]+$/).parse(workspaceId);
    const parsed = AiDataPolicySchema.parse(policy);
    const ref = adminDb.collection('ai_data_policies').doc(ws);
    const before = (await ref.get()).data() ?? null;
    const after = { ...parsed, updatedAt: new Date().toISOString() };
    await ref.set(after);
    await logBackofficeAction(actor, 'ai_data_policy.update', 'workspace', ws, { scope: 'workspace', scopeId: ws, before, after });
    return { success: true, data: { saved: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Manual recovery (Rule 25): requeue a dead-lettered transcription with a fresh attempt budget. */
export async function reprocessDeadLetterAction(idToken: string, transcriptId: string): Promise<Result<{ requeued: boolean }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'execute');
    const id = z.string().regex(/^tr_[0-9a-f]{32}$/).parse(transcriptId);
    const ref = adminDb.collection('meeting_transcripts').doc(id);
    const version = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const h = snap.exists ? TranscriptHeaderSchema.safeParse(snap.data()) : null;
      if (!h?.success || h.data.status !== 'dead_lettered') return null;
      const next = h.data.version + 1;
      const { error: _previousError, ...rest } = h.data;
      tx.set(ref, { ...rest, status: 'pending', attempts: 0, version: next, updatedAt: new Date().toISOString() });
      return next;
    });
    if (version === null) return { success: true, data: { requeued: false } };
    await scheduleTaskWithKey(`${id}-v${version}`, TRANSCRIPTION_QUEUE, TRANSCRIPTION_ENDPOINT, { transcriptId: id });
    await adminDb.collection('meeting_transcription_dlq').doc(id).set({ resolved: true, resolution: 'reprocessed', resolvedAt: new Date().toISOString() }, { merge: true });
    await logBackofficeAction(actor, 'transcription_dlq.reprocess', 'meeting_transcript', id, { scope: 'platform' });
    return { success: true, data: { requeued: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function discardDeadLetterAction(idToken: string, transcriptId: string): Promise<Result<{ discarded: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'execute');
    const id = z.string().regex(/^tr_[0-9a-f]{32}$/).parse(transcriptId);
    await adminDb.collection('meeting_transcription_dlq').doc(id).set({ resolved: true, resolution: 'discarded', resolvedAt: new Date().toISOString() }, { merge: true });
    await logBackofficeAction(actor, 'transcription_dlq.discard', 'meeting_transcript', id, { scope: 'platform' });
    return { success: true, data: { discarded: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Preview for "Run retention now" (read-only). */
export async function previewWorkspaceRetentionAction(idToken: string, workspaceId: string): Promise<Result<{ mode: string; counts: Record<string, number>; candidateSetHash: string; truncated: boolean }>> {
  try {
    await authorizeBackoffice(idToken, 'meetings_monitor', 'view');
    const ws = z.string().min(1).max(200).regex(/^[^/]+$/).parse(workspaceId);
    const plan = await planWorkspaceRetention(adminDb, { workspaceId: ws, nowMs: Date.now() });
    return { success: true, data: { mode: plan.mode, counts: plan.counts, candidateSetHash: plan.candidateSetHash, truncated: plan.truncated } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Runs retention for one workspace now. Bound to the preview the operator reviewed (Rules 21/22):
 * refused if the candidate set changed. Shadow-mode workspaces still delete nothing.
 */
export async function runWorkspaceRetentionNowAction(idToken: string, workspaceId: string, confirmedCandidateSetHash: string): Promise<Result<{ deleted: Record<string, number>; mode: string }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'execute');
    const ws = z.string().min(1).max(200).regex(/^[^/]+$/).parse(workspaceId);
    const nowMs = Date.now();
    const plan = await planWorkspaceRetention(adminDb, { workspaceId: ws, nowMs });
    if (plan.candidateSetHash !== confirmedCandidateSetHash) {
      return { success: false, error: 'The data to remove changed. Preview again before running.' };
    }
    const run = await runWorkspaceRetention(adminDb, {
      nowMs,
      storage: { deleteObject: async (path) => { await adminStorage.file(path).delete({ ignoreNotFound: true }); } },
      audit: async (entry) => {
        await defaultAuditSink({
          executionId: randomUUID(), capabilityId: 'meeting.run_retention', capabilityVersion: '1.0.0',
          userId: actor.userId, organizationId: '', workspaceId: entry.workspaceId, correlationId: entry.candidateSetHash,
          decision: 'allowed', outcome: 'succeeded', durationMs: 0, stateChanged: 'yes',
          timestamp: new Date().toISOString(), inputHash: sha256Hex(entry),
        });
      },
    }, ws, { useCursor: false });
    await logBackofficeAction(actor, 'meeting_retention.run_now', 'workspace', ws, { scope: 'workspace', scopeId: ws, after: { mode: run.mode, deleted: run.deleted, verified: run.verified } });
    return { success: true, data: { deleted: run.deleted, mode: run.mode } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Manual recovery for meeting intelligence (Rule 25): requeue a dead-lettered analysis run. */
export async function reprocessPipelineDeadLetterAction(idToken: string, runId: string): Promise<Result<{ requeued: boolean }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'execute');
    const id = z.string().min(1).max(200).regex(/^[^/]+$/).parse(runId);
    const ref = adminDb.collection(RUNS).doc(id);
    const version = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const r = snap.exists ? snap.data() : null;
      if (!r || r.status !== 'dead_lettered') return null;
      const next = (Number(r.version) || 0) + 1;
      const { error: _prevError, ...rest } = r;
      tx.set(ref, { ...rest, status: 'pending', attempts: 0, version: next, updatedAt: new Date().toISOString() });
      return next;
    });
    if (version === null) return { success: true, data: { requeued: false } };
    await scheduleTaskWithKey(`${id}-v${version}`, INTELLIGENCE_QUEUE, INTELLIGENCE_ENDPOINT, { runId: id });
    await adminDb.collection('meeting_intelligence_dlq').doc(id).set({ resolved: true, resolution: 'reprocessed', resolvedAt: new Date().toISOString() }, { merge: true });
    await logBackofficeAction(actor, 'intelligence_dlq.reprocess', 'meeting_intelligence_run', id, { scope: 'platform' });
    return { success: true, data: { requeued: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function discardPipelineDeadLetterAction(idToken: string, runId: string): Promise<Result<{ discarded: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'execute');
    const id = z.string().min(1).max(200).regex(/^[^/]+$/).parse(runId);
    await adminDb.collection('meeting_intelligence_dlq').doc(id).set({ resolved: true, resolution: 'discarded', resolvedAt: new Date().toISOString() }, { merge: true });
    await logBackofficeAction(actor, 'intelligence_dlq.discard', 'meeting_intelligence_run', id, { scope: 'platform' });
    return { success: true, data: { discarded: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Pin a workspace to a specific extraction/summary prompt version (Rules 58, 65). */
export async function pinMeetingPromptVersionAction(idToken: string, workspaceId: string, promptVersion: string): Promise<Result<{ pinned: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'edit');
    const ws = z.string().min(1).max(200).regex(/^[^/]+$/).parse(workspaceId);
    const pv = z.string().min(1).max(100).parse(promptVersion);
    const ref = adminDb.collection('meeting_prompt_overrides').doc(ws);
    const before = (await ref.get()).data() ?? null;
    const after = { workspaceId: ws, promptVersion: pv, updatedAt: new Date().toISOString() };
    await ref.set(after);
    await logBackofficeAction(actor, 'meeting_prompt_override.pin', 'workspace', ws, { scope: 'workspace', scopeId: ws, before, after });
    return { success: true, data: { pinned: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Unpin/reset a workspace's prompt version override back to canonical default. */
export async function unpinMeetingPromptVersionAction(idToken: string, workspaceId: string): Promise<Result<{ unpinned: true }>> {
  try {
    const actor = await authorizeBackoffice(idToken, 'meetings_monitor', 'edit');
    const ws = z.string().min(1).max(200).regex(/^[^/]+$/).parse(workspaceId);
    const ref = adminDb.collection('meeting_prompt_overrides').doc(ws);
    const before = (await ref.get()).data() ?? null;
    await ref.delete();
    await logBackofficeAction(actor, 'meeting_prompt_override.unpin', 'workspace', ws, { scope: 'workspace', scopeId: ws, before, after: null });
    return { success: true, data: { unpinned: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

