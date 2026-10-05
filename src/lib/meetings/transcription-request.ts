import 'server-only';

/**
 * @fileOverview Request (enqueue) side of recording transcription (Phase 11 M1 · T4).
 *
 * Runs every eligibility check up front so people get an immediate, specific answer, then creates
 * the transcript header (`pending`) inside a transaction and schedules ONE Cloud Task whose body is
 * only `{ transcriptId }` (the worker reloads everything; it never trusts task state).
 *
 * QUOTA (D11): default 120 audio minutes per workspace per day; override in
 * `meeting_transcription_quotas/{workspaceId}.dailyMinutes` (Backoffice). Counted on completion,
 * checked here with the recording's duration so a run cannot start that would blow the cap.
 *
 * Tests: src/lib/meetings/__tests__/transcription-service.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { AiModelRegistry } from '@/lib/ai/model-registry';
import { scheduleTaskWithKey } from '@/lib/gcp-tasks-client';
import {
  DataPolicyDeniedError,
  assertProviderAllowed,
  providersAllowedFor,
  resolveAiDataPolicy,
} from '@/platform/policy/ai-data-policy';
import { assertConsent, ConsentRequiredError } from './consent-store';
import { MeetingRecordingRecordSchema, isRecordingPathForMeeting } from './schemas/recording-schemas';
import {
  AUDIO_MIME_BY_EXT, MAX_AUDIO_SECONDS, MAX_INLINE_AUDIO_BYTES, QuotaExceededError, reserveUsage, settleReservation,
} from './transcription-service';
import { TRANSCRIPTS, TranscriptHeaderSchema, buildTranscriptHeader, markTranscriptTerminal, type TranscriptHeader } from './transcript-store';

export const TRANSCRIPTION_QUEUE = 'meeting-transcription-queue';
export const TRANSCRIPTION_ENDPOINT = '/api/tasks/meeting-transcription';
export const DEFAULT_DAILY_MINUTES = 120;
export const STALE_PENDING_MS = 10 * 60 * 1000;

export class TranscriptionRequestError extends Error {
  constructor(readonly code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'PROVIDER_ERROR', message: string) {
    super(message);
    this.name = 'TranscriptionRequestError';
  }
}

export interface TranscriptionRequestDeps {
  storage: { size(path: string): Promise<number | null> };
  schedule?: (taskKey: string, queue: string, endpoint: string, payload: Record<string, unknown>) => Promise<unknown>;
  nowMs: () => number;
}

export interface TranscriptionRequestParams {
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  recordingId: string;
  dryRun: boolean;
  provenance: TranscriptHeader['provenance'];
  correlationId: string;
}

export function recordingTranscriptIdFor(workspaceId: string, recordingId: string, recordingVersion: string): string {
  return `tr_${createHash('sha256').update(`${workspaceId}\u0000${recordingId}\u0000${recordingVersion}`).digest('hex').slice(0, 32)}`;
}

async function dailyLimit(db: Firestore, workspaceId: string): Promise<number> {
  const snap = await db.collection('meeting_transcription_quotas').doc(workspaceId).get();
  const v = snap.data()?.dailyMinutes;
  return typeof v === 'number' && v >= 0 ? v : DEFAULT_DAILY_MINUTES;
}

export async function requestRecordingTranscription(
  db: Firestore,
  deps: TranscriptionRequestDeps,
  params: TranscriptionRequestParams
): Promise<{ transcriptId: string; status: 'pending' | 'processing' | 'completed' | 'eligible'; replayed: boolean; estimatedMinutes: number }> {
  const refuse = (code: TranscriptionRequestError['code'], message: string) => new TranscriptionRequestError(code, message);

  // 1. Recording: this workspace, this meeting, an uploaded file, a supported format and size.
  const recSnap = await db.collection('meeting_recordings').doc(params.recordingId).get();
  const rec = recSnap.exists ? MeetingRecordingRecordSchema.safeParse(recSnap.data()) : null;
  if (!rec?.success || rec.data.workspaceId !== params.workspaceId || rec.data.meetingId !== params.meetingId || rec.data.status === 'deleted') {
    throw refuse('NOT_FOUND', 'Recording not found.');
  }
  const path = rec.data.storagePath;
  if (!path || !isRecordingPathForMeeting(path, params.workspaceId, params.meetingId)) {
    throw refuse('VALIDATION', "This recording is an external link and can't be transcribed. Upload the file instead.");
  }
  if (!AUDIO_MIME_BY_EXT[path.toLowerCase().split('.').pop() ?? '']) {
    throw refuse('VALIDATION', 'Use an MP3, WAV, AAC, OGG, FLAC or AIFF file.');
  }
  if (rec.data.durationSeconds > MAX_AUDIO_SECONDS) throw refuse('VALIDATION', 'This recording is longer than 4 hours.');
  const size = await deps.storage.size(path);
  if (size === null) throw refuse('NOT_FOUND', 'The recording file is missing. Upload it again.');
  if (size > MAX_INLINE_AUDIO_BYTES) throw refuse('VALIDATION', 'This recording is larger than 14 MB. Upload a smaller audio file (for example MP3).');

  // 2. Consent (when the workspace enforces it).
  try {
    await assertConsent(db, { workspaceId: params.workspaceId, meetingId: params.meetingId, operation: 'transcribe_recording' });
  } catch (err) {
    if (err instanceof ConsentRequiredError) throw refuse('FORBIDDEN', err.message);
    throw err;
  }

  // 3. Data policy: an allowed audio-capable provider, and audio egress not paused (Rules 57/58/60).
  const policy = await resolveAiDataPolicy(db, { organizationId: params.organizationId, workspaceId: params.workspaceId });
  const model = AiModelRegistry.getAudioCapableModels(providersAllowedFor(policy, 'personal'))[0];
  if (!model) throw refuse('FORBIDDEN', "Your workspace doesn't allow any AI service that can transcribe audio.");
  try {
    await assertProviderAllowed(db, { organizationId: params.organizationId, workspaceId: params.workspaceId, provider: model.provider, dataClass: 'personal', audio: true });
  } catch (err) {
    if (err instanceof DataPolicyDeniedError) throw refuse('FORBIDDEN', err.message);
    throw err;
  }

  // 4. Daily quota. The declared duration is user-entered (M1 review R3), so the estimate also uses
  // the file size (≈ 4 KB/s for compressed speech) and takes the larger of the two.
  const nowMs = deps.nowMs();
  const estimatedMinutes = Math.max(1, Math.ceil(Math.max(rec.data.durationSeconds / 60, size / 240_000)));
  const limit = await dailyLimit(db, params.workspaceId);
  const usageSnap = await db.collection('meeting_transcription_usage').doc(`${params.workspaceId}_${new Date(nowMs).toISOString().slice(0, 10)}`).get();
  const used = Number(usageSnap.data()?.minutes ?? 0) + Number(usageSnap.data()?.reservedMinutes ?? 0);
  if (used + estimatedMinutes > limit) throw refuse('FORBIDDEN', 'Daily transcription limit reached. Try again tomorrow.');

  const transcriptId = recordingTranscriptIdFor(params.workspaceId, params.recordingId, rec.data.updatedAt);
  if (params.dryRun) return { transcriptId, status: 'eligible', replayed: false, estimatedMinutes };

  // 5. Create/reuse the header atomically; schedule only when this call (re)started it.
  const ref = db.collection(TRANSCRIPTS).doc(transcriptId);
  const nowIso = new Date(nowMs).toISOString();
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? TranscriptHeaderSchema.safeParse(snap.data()) : null;
    // A job left 'pending' for > 10 min never reached the worker (lost task, M1 review R2a): restart it.
    const stalePending = existing?.success && existing.data.status === 'pending'
      && Date.parse(existing.data.updatedAt) < nowMs - STALE_PENDING_MS;
    if (existing?.success && !stalePending && ['pending', 'processing', 'completed'].includes(existing.data.status)) {
      return { started: false, status: existing.data.status as 'pending' | 'processing' | 'completed', version: existing.data.version, priorReservation: 0 };
    }
    if (existing?.success && existing.data.status === 'deleting') throw refuse('VALIDATION', 'This transcript is being deleted. Try again later.');
    const previousVersion = existing?.success ? existing.data.version : -1;
    const header = buildTranscriptHeader({
      workspaceId: params.workspaceId,
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      meetingId: params.meetingId,
      recordingId: params.recordingId,
      recordingVersion: rec.data.updatedAt,
      source: 'recording',
      status: 'pending',
      provenance: params.provenance,
      nowIso,
    });
    // Carry an old reservation over so it is released below (restart of a stale job).
    const priorReservation = existing?.success ? existing.data.reservedMinutes ?? 0 : 0;
    tx.set(ref, {
      ...header, version: previousVersion + 1, attempts: 0,
      ...(priorReservation > 0 && existing?.success
        ? { reservedMinutes: priorReservation, ...(existing.data.reservationDay ? { reservationDay: existing.data.reservationDay } : {}) }
        : {}),
    });
    return { started: true, status: 'pending' as const, version: previousVersion + 1, priorReservation };
  });

  if (outcome.started) {
    if (outcome.priorReservation > 0) await settleReservation(db, transcriptId, 0, nowIso);
    // Reserve quota atomically so concurrent requests can't exceed the daily limit (M1 review R5).
    try {
      await reserveUsage(db, { workspaceId: params.workspaceId, transcriptId, minutes: estimatedMinutes, limit, nowMs });
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        await markTranscriptTerminal(db, transcriptId, 'failed', { code: 'quota', message: err.message }, nowIso);
        throw refuse('FORBIDDEN', err.message);
      }
      throw err;
    }
    const schedule = deps.schedule ?? scheduleTaskWithKey;
    try {
      // A new task name per (re)start: Cloud Tasks refuses reused names for a while after deletion.
      await schedule(`${transcriptId}-v${outcome.version}`, TRANSCRIPTION_QUEUE, TRANSCRIPTION_ENDPOINT, { transcriptId });
    } catch {
      // CAUTION (M1 review R2a): without this the job stayed 'pending' forever and every retry
      // replayed it without scheduling. Fail it (releasing the quota) so asking again restarts it.
      await settleReservation(db, transcriptId, 0, nowIso);
      await markTranscriptTerminal(db, transcriptId, 'failed', { code: 'schedule_failed', message: "Couldn't start transcription." }, nowIso);
      throw refuse('PROVIDER_ERROR', "Couldn't start transcription. Try again in a moment.");
    }
  }
  return { transcriptId, status: outcome.status, replayed: !outcome.started, estimatedMinutes };
}
