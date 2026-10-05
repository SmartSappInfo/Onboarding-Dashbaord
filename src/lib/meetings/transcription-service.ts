import 'server-only';

/**
 * @fileOverview Recording transcription: provider port + worker logic (Phase 11 M1 · T4, D1).
 *
 * FLOW (worker, one Cloud Task per transcript; the task body carries only `transcriptId`):
 *   load header → nothing to do if already terminal (duplicate delivery is a no-op)
 *   → dead-man / pause switch (retry later) → recording still there and unchanged (TOCTOU)
 *   → meeting still there → cancel requested? → consent (recording + transcription)
 *   → data policy + audio-capable allowed model (Rules 57/58) → status processing
 *   → audio from the workspace's own Storage path (no URL fetching, Rule 34)
 *   → provider call behind a circuit breaker (Rule 24) → schema + business validation (Rule 31)
 *   → re-check consent + cancel (Rule 26) → store (header-last) → usage metering.
 *
 * FAILURE SEMANTICS (Rules 25/27)
 * - Retryable provider errors (429/5xx/timeout/breaker open) → `retry` (route answers 503 so Cloud
 *   Tasks backs off). After MAX_ATTEMPTS → `dead_lettered` + a manual recovery entry.
 * - Anything else → `failed` with a plain code; partial chunks are always removed.
 *
 * LIMITS (Context7, Gemini API docs 2026-10-05): inline requests ≤ 20 MB in total, base64 adds a
 * third, so audio ≤ MAX_INLINE_AUDIO_BYTES. Larger files need the Gemini Files API, a tracked
 * follow-up; they get a clear message today. Supported types: WAV, MP3, AIFF, AAC, OGG, FLAC.
 *
 * CAUTION: never log or persist the audio, the transcript text or provider credentials.
 *
 * Tests: src/lib/meetings/__tests__/transcription-service.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { AiModelRegistry, type AiProviderId } from '@/lib/ai/model-registry';
import { CircuitBreaker, CircuitBreakerOpenError } from '@/platform/events/resilience/circuit-breaker';
import {
  assertProviderAllowed,
  DataPolicyDeniedError,
  providersAllowedFor,
  readMeetingControls,
  resolveAiDataPolicy,
} from '@/platform/policy/ai-data-policy';
import { assertConsent, ConsentRequiredError } from './consent-store';
import { MeetingRecordingRecordSchema, isRecordingPathForMeeting } from './schemas/recording-schemas';
import { buildParsedTranscript, type RawCue } from './transcript-parsers';
import { hashTranscriptContent, scanForInjection, mapSpeakersToParticipants, MAX_TRANSCRIPT_WORDS } from './transcript-ingestion';
import {
  TRANSCRIPTS,
  TranscriptHeaderSchema,
  completeTranscript,
  markTranscriptTerminal,
  type TranscriptHeader,
} from './transcript-store';

export const MAX_INLINE_AUDIO_BYTES = 14 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 4 * 60 * 60;
export const MAX_ATTEMPTS = 3;
export const PROMPT_VERSION = 'meeting-transcribe-v1';

export const AUDIO_MIME_BY_EXT: Readonly<Record<string, string>> = {
  mp3: 'audio/mp3', wav: 'audio/wav', aiff: 'audio/aiff', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac',
};

/** What the model must return (validated before anything is stored). */
export const ProviderTranscriptSchema = z.object({
  language: z.string().max(20).optional(),
  segments: z.array(z.object({
    speaker: z.string().max(200).optional(),
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
    text: z.string(),
  })).max(20_000),
});
export type ProviderTranscript = z.infer<typeof ProviderTranscriptSchema>;

export interface TranscriptionProvider {
  readonly provider: AiProviderId;
  transcribe(input: {
    audio: Buffer;
    mimeType: string;
    modelId: string;
    speakerHints: string[];
    workspaceId: string;
    organizationId?: string;
  }): Promise<{ output: unknown; modelId: string }>;
}

/** Retryable provider failure (429/5xx/timeout). */
export class RetryableTranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableTranscriptionError';
  }
}

export interface AudioStorage {
  size(path: string): Promise<number | null>;
  download(path: string): Promise<Buffer>;
}

export type TranscriptionOutcome =
  | { status: 'completed'; transcriptId: string; segmentCount: number; costUnits: number }
  | { status: 'noop'; reason: string }
  | { status: 'retry'; reason: string }
  | { status: 'failed' | 'cancelled' | 'dead_lettered'; code: string };

export interface TranscriptionDeps {
  provider: (providerId: AiProviderId) => TranscriptionProvider | null;
  storage: AudioStorage;
  breaker?: CircuitBreaker;
  nowMs: () => number;
}

const defaultBreaker = new CircuitBreaker();

function isRetryableProviderError(err: unknown): boolean {
  if (err instanceof RetryableTranscriptionError || err instanceof CircuitBreakerOpenError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return /\b(429|500|502|503|504)\b|resource_exhausted|unavailable|deadline|timeout|overloaded|rate limit/.test(msg);
}

/** Converts validated model output into stored segments with business checks (Rule 31). */
export function validateProviderTranscript(raw: unknown, durationSeconds: number): ReturnType<typeof buildParsedTranscript> & { language?: string } {
  const parsed = ProviderTranscriptSchema.safeParse(raw);
  if (!parsed.success) throw new Error('invalid_output');
  // CAUTION (M1 review R3): the declared duration is user-entered (the UI defaulted it to 30 min),
  // so it must not reject real transcripts. The hard bound is the product maximum.
  void durationSeconds;
  const limitMs = MAX_AUDIO_SECONDS * 1000;
  const cues: RawCue[] = [];
  for (const s of parsed.data.segments) {
    const text = s.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const startMs = Math.round(s.startSeconds * 1000);
    const endMs = Math.round(s.endSeconds * 1000);
    if (endMs < startMs || endMs > limitMs) throw new Error('invalid_output');
    cues.push({ startMs, endMs, speaker: s.speaker?.trim() || null, text });
  }
  if (cues.length === 0) throw new Error('empty_output');
  const result = buildParsedTranscript('txt', cues, []);
  const words = result.segments.reduce((n, seg) => n + seg.text.split(/\s+/).filter(Boolean).length, 0);
  if (words > MAX_TRANSCRIPT_WORDS) throw new Error('invalid_output');
  return { ...result, timed: true, language: parsed.data.language };
}

async function loadHeader(db: Firestore, transcriptId: string): Promise<TranscriptHeader | null> {
  const snap = await db.collection(TRANSCRIPTS).doc(transcriptId).get();
  const parsed = snap.exists ? TranscriptHeaderSchema.safeParse(snap.data()) : null;
  return parsed?.success ? parsed.data : null;
}

async function terminal(db: Firestore, transcriptId: string, status: 'failed' | 'cancelled' | 'dead_lettered', code: string, message: string, nowIso: string): Promise<TranscriptionOutcome> {
  await settleReservation(db, transcriptId, 0, nowIso);
  await markTranscriptTerminal(db, transcriptId, status, { code, message }, nowIso);
  if (status === 'dead_lettered') {
    await db.collection('meeting_transcription_dlq').doc(transcriptId).set({ transcriptId, code, message, at: nowIso, resolved: false });
  }
  return { status, code };
}

export function usageDocId(workspaceId: string, nowMs: number): string {
  return `${workspaceId}_${new Date(nowMs).toISOString().slice(0, 10)}`;
}

/** Processes one transcription task. Idempotent: safe under duplicate delivery. */
export async function processTranscriptionTask(db: Firestore, deps: TranscriptionDeps, transcriptId: string): Promise<TranscriptionOutcome> {
  const nowIso = () => new Date(deps.nowMs()).toISOString();
  const header = await loadHeader(db, transcriptId);
  if (!header || header.source !== 'recording' || !header.recordingId) return { status: 'noop', reason: 'not_a_recording_transcript' };
  if (header.status !== 'pending' && header.status !== 'processing') return { status: 'noop', reason: `already_${header.status}` };

  const controls = await readMeetingControls(db);
  if (controls.transcriptionPaused) return { status: 'retry', reason: 'paused' };

  const ws = header.workspaceId;
  const recSnap = await db.collection('meeting_recordings').doc(header.recordingId).get();
  const rec = recSnap.exists ? MeetingRecordingRecordSchema.safeParse(recSnap.data()) : null;
  if (!rec?.success || rec.data.workspaceId !== ws || rec.data.status === 'deleted') {
    return terminal(db, transcriptId, 'failed', 'recording_deleted', 'The recording was removed.', nowIso());
  }
  if ((header.recordingVersion ?? '') !== rec.data.updatedAt) {
    return terminal(db, transcriptId, 'cancelled', 'recording_changed', 'The recording changed. Start transcription again.', nowIso());
  }
  if (!(await db.collection('meetings').doc(header.meetingId).get()).exists) {
    return terminal(db, transcriptId, 'failed', 'meeting_deleted', 'The meeting was removed.', nowIso());
  }
  if (header.cancelRequested) return terminal(db, transcriptId, 'cancelled', 'cancelled', 'Transcription was cancelled.', nowIso());
  try {
    await assertConsent(db, { workspaceId: ws, meetingId: header.meetingId, operation: 'transcribe_recording' });
  } catch (err) {
    if (err instanceof ConsentRequiredError) return terminal(db, transcriptId, 'cancelled', 'consent_withdrawn', err.message, nowIso());
    throw err;
  }

  const storagePath = rec.data.storagePath;
  if (!storagePath || !isRecordingPathForMeeting(storagePath, ws, header.meetingId)) {
    return terminal(db, transcriptId, 'failed', 'external_link', 'External links cannot be transcribed.', nowIso());
  }
  const ext = storagePath.toLowerCase().split('.').pop() ?? '';
  const mimeType = AUDIO_MIME_BY_EXT[ext];
  if (!mimeType) return terminal(db, transcriptId, 'failed', 'unsupported_format', 'Use an MP3, WAV, AAC, OGG, FLAC or AIFF file.', nowIso());

  // Data policy + model routing (Rules 57/58). Policy read errors fail closed as "retry".
  let modelId: string;
  let providerId: AiProviderId;
  try {
    const policy = await resolveAiDataPolicy(db, { organizationId: header.organizationId, workspaceId: ws });
    const model = AiModelRegistry.getAudioCapableModels(providersAllowedFor(policy, 'personal'))[0];
    if (!model) return terminal(db, transcriptId, 'failed', 'no_allowed_model', "Your workspace doesn't allow any AI service that can transcribe audio.", nowIso());
    await assertProviderAllowed(db, { organizationId: header.organizationId, workspaceId: ws, provider: model.provider, dataClass: 'personal', audio: true });
    modelId = model.id;
    providerId = model.provider;
  } catch (err) {
    if (err instanceof DataPolicyDeniedError) return terminal(db, transcriptId, 'failed', 'policy_denied', err.message, nowIso());
    return { status: 'retry', reason: 'policy_unavailable' };
  }
  const provider = deps.provider(providerId);
  if (!provider) return terminal(db, transcriptId, 'failed', 'no_provider', 'Transcription is not available right now.', nowIso());

  const size = await deps.storage.size(storagePath);
  if (size === null) return terminal(db, transcriptId, 'failed', 'recording_missing', 'The recording file is missing.', nowIso());
  if (size > MAX_INLINE_AUDIO_BYTES) {
    return terminal(db, transcriptId, 'failed', 'too_large', 'This recording is larger than 14 MB. Upload a smaller audio file (for example MP3).', nowIso());
  }

  // Claim: pending/processing → processing with attempts + 1 (version-checked).
  const ref = db.collection(TRANSCRIPTS).doc(transcriptId);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = TranscriptHeaderSchema.safeParse(snap.data());
    if (!current.success || (current.data.status !== 'pending' && current.data.status !== 'processing')) return null;
    const attempts = (current.data.attempts ?? 0) + 1;
    const next = { ...current.data, status: 'processing' as const, attempts, version: current.data.version + 1, updatedAt: nowIso() };
    tx.set(ref, next);
    return next;
  });
  if (!claimed) return { status: 'noop', reason: 'claimed_elsewhere' };

  const audio = await deps.storage.download(storagePath);
  const inputHash = createHash('sha256').update(audio).digest('hex');
  const participants = await db.collection('participants').where('meetingId', '==', header.meetingId).limit(50).get();
  const speakerHints = participants.docs.map((d) => d.data()?.name).filter((n): n is string => typeof n === 'string' && n.length > 0);

  let raw: { output: unknown; modelId: string };
  try {
    raw = await (deps.breaker ?? defaultBreaker).execute(`transcription:${providerId}`, () =>
      provider.transcribe({ audio, mimeType, modelId, speakerHints, workspaceId: ws, organizationId: header.organizationId })
    );
  } catch (err) {
    if (isRetryableProviderError(err)) {
      if (claimed.attempts >= MAX_ATTEMPTS) {
        return terminal(db, transcriptId, 'dead_lettered', 'provider_unavailable', 'Transcription failed after several tries.', nowIso());
      }
      return { status: 'retry', reason: 'provider_unavailable' };
    }
    return terminal(db, transcriptId, 'failed', 'provider_error', "Couldn't transcribe this recording.", nowIso());
  }

  let transcript: ReturnType<typeof validateProviderTranscript>;
  try {
    transcript = validateProviderTranscript(raw.output, rec.data.durationSeconds);
  } catch (err) {
    const code = err instanceof Error && err.message === 'empty_output' ? 'empty_output' : 'invalid_output';
    return terminal(db, transcriptId, 'failed', code, "Couldn't transcribe this recording.", nowIso());
  }

  // Re-check before storing: consent may have been withdrawn or a cancel requested meanwhile.
  const latest = await loadHeader(db, transcriptId);
  if (!latest || latest.cancelRequested) return terminal(db, transcriptId, 'cancelled', 'cancelled', 'Transcription was cancelled.', nowIso());
  try {
    await assertConsent(db, { workspaceId: ws, meetingId: header.meetingId, operation: 'transcribe_recording' });
  } catch (err) {
    if (err instanceof ConsentRequiredError) return terminal(db, transcriptId, 'cancelled', 'consent_withdrawn', err.message, nowIso());
    throw err;
  }

  const speakers = await mapSpeakersToParticipants(db, header.meetingId, transcript.speakers);
  // Billed audio minutes: the recording's declared duration, or the transcript's end if longer.
  // Billed from the transcript's actual end time, not the user-entered duration (M1 review R3).
  const lastEndSeconds = (transcript.segments[transcript.segments.length - 1]?.endMs ?? 0) / 1000;
  const costUnits = Math.max(1, Math.ceil(lastEndSeconds / 60));
  try {
    await completeTranscript(db, {
      transcriptId,
      segments: transcript.segments,
      speakers,
      language: transcript.language,
      contentHash: hashTranscriptContent(transcript),
      injection: scanForInjection(transcript),
      provider: {
        modelId: raw.modelId,
        promptVersion: PROMPT_VERSION,
        inputHash,
        outputHash: createHash('sha256').update(JSON.stringify(raw.output)).digest('hex'),
      },
      costUnits,
      expectedVersion: latest.version,
      nowIso: nowIso(),
    });
  } catch {
    return terminal(db, transcriptId, 'failed', 'store_failed', 'Could not save the transcript.', nowIso());
  }

  await db.collection('meetings').doc(header.meetingId).update({ hasTranscript: true, updatedAt: nowIso() }).catch(() => undefined);
  await settleReservation(db, transcriptId, costUnits, nowIso());
  await db.collection('meeting_transcription_dlq').doc(transcriptId).delete().catch(() => undefined);
  return { status: 'completed', transcriptId, segmentCount: transcript.segments.length, costUnits };
}

/** Adds audio minutes to today's per-workspace usage (transactional). */
export async function meterUsage(db: Firestore, workspaceId: string, nowMs: number, minutes: number): Promise<void> {
  const ref = db.collection('meeting_transcription_usage').doc(usageDocId(workspaceId, nowMs));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = typeof snap.data()?.minutes === 'number' ? Number(snap.data()?.minutes) : 0;
    tx.set(ref, { workspaceId, day: new Date(nowMs).toISOString().slice(0, 10), minutes: used + minutes, updatedAt: new Date(nowMs).toISOString() });
  });
}

export async function readUsageMinutes(db: Firestore, workspaceId: string, nowMs: number): Promise<number> {
  const snap = await db.collection('meeting_transcription_usage').doc(usageDocId(workspaceId, nowMs)).get();
  return typeof snap.data()?.minutes === 'number' ? Number(snap.data()?.minutes) : 0;
}

const usageRef = (db: Firestore, workspaceId: string, day: string) =>
  db.collection('meeting_transcription_usage').doc(`${workspaceId}_${day}`);

function readUsage(data: Record<string, unknown> | undefined): { minutes: number; reservedMinutes: number } {
  return {
    minutes: typeof data?.minutes === 'number' ? data.minutes : 0,
    reservedMinutes: typeof data?.reservedMinutes === 'number' ? data.reservedMinutes : 0,
  };
}

export class QuotaExceededError extends Error {
  constructor() {
    super('Daily transcription limit reached. Try again tomorrow.');
    this.name = 'QuotaExceededError';
  }
}

/**
 * Atomically checks the daily limit and reserves `minutes` for this transcript (M1 review R5).
 * Used minutes + reserved minutes + this request must fit, so concurrent requests can't overshoot.
 * Idempotent: a transcript that already holds a reservation is not reserved twice.
 */
export async function reserveUsage(
  db: Firestore,
  params: { workspaceId: string; transcriptId: string; minutes: number; limit: number; nowMs: number }
): Promise<void> {
  const day = new Date(params.nowMs).toISOString().slice(0, 10);
  const uRef = usageRef(db, params.workspaceId, day);
  const tRef = db.collection(TRANSCRIPTS).doc(params.transcriptId);
  await db.runTransaction(async (tx) => {
    const [uSnap, tSnap] = await Promise.all([tx.get(uRef), tx.get(tRef)]);
    if ((tSnap.data()?.reservedMinutes ?? 0) > 0) return;
    const usage = readUsage(uSnap.data());
    if (usage.minutes + usage.reservedMinutes + params.minutes > params.limit) throw new QuotaExceededError();
    tx.set(uRef, { workspaceId: params.workspaceId, day, ...usage, reservedMinutes: usage.reservedMinutes + params.minutes, updatedAt: new Date(params.nowMs).toISOString() });
    tx.update(tRef, { reservedMinutes: params.minutes, reservationDay: day });
  });
}

/**
 * Releases the transcript's reservation and records `actualMinutes` as used (0 on failure/cancel).
 * Idempotent: the reservation is zeroed on the transcript in the same transaction.
 */
export async function settleReservation(db: Firestore, transcriptId: string, actualMinutes: number, nowIso: string): Promise<void> {
  const tRef = db.collection(TRANSCRIPTS).doc(transcriptId);
  await db.runTransaction(async (tx) => {
    const tSnap = await tx.get(tRef);
    const t = tSnap.data();
    if (!t) return;
    const reserved = typeof t.reservedMinutes === 'number' ? t.reservedMinutes : 0;
    const day = typeof t.reservationDay === 'string' ? t.reservationDay : nowIso.slice(0, 10);
    const workspaceId = typeof t.workspaceId === 'string' ? t.workspaceId : '';
    if (!workspaceId || (reserved === 0 && actualMinutes === 0)) return;
    const uRef = usageRef(db, workspaceId, day);
    const usage = readUsage((await tx.get(uRef)).data());
    tx.set(uRef, {
      workspaceId, day,
      minutes: usage.minutes + actualMinutes,
      reservedMinutes: Math.max(0, usage.reservedMinutes - reserved),
      updatedAt: nowIso,
    });
    tx.update(tRef, { reservedMinutes: 0 });
  });
}

export const STALE_JOB_MS = 30 * 60 * 1000;

/**
 * Heartbeat reaper (M1 review R5): jobs stuck in pending/processing for > 30 min stop being
 * "in progress". A pending recording job never started (lost task) → failed (retryable by the
 * person); a processing job died mid-run → dead-lettered for recovery. Bounded to 50 per run.
 */
export async function reapStaleTranscriptions(db: Firestore, nowMs: number): Promise<{ failed: number; deadLettered: number }> {
  const cutoff = new Date(nowMs - STALE_JOB_MS).toISOString();
  const snap = await db.collection(TRANSCRIPTS)
    .where('status', 'in', ['pending', 'processing'])
    .where('updatedAt', '<', cutoff)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();
  let failed = 0;
  let deadLettered = 0;
  const nowIso = new Date(nowMs).toISOString();
  for (const d of snap.docs) {
    const h = TranscriptHeaderSchema.safeParse(d.data());
    if (!h.success) continue;
    if (h.data.status === 'processing' && h.data.source === 'recording') {
      await terminal(db, d.id, 'dead_lettered', 'stalled', 'Transcription stopped responding.', nowIso);
      deadLettered += 1;
    } else {
      await terminal(db, d.id, 'failed', 'stalled', 'This did not finish. Try again.', nowIso);
      failed += 1;
    }
  }
  return { failed, deadLettered };
}
