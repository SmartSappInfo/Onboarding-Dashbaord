/**
 * @fileOverview `meeting_postprocess_v2`: the post-meeting intelligence pipeline
 * (Phase 11 M2 · T3.3; plan §4.3; Rules 9, 19, 20, 23–27, 30, 31, 57, 58, 60).
 *
 * WHY A DEDICATED WORKER (plan deviation, recorded in the M2 plan): the platform workflow engine
 * has no production starter, so a template there would never run. The pipeline uses the same
 * durability pattern the M1 transcription worker proved: a governed request creates ONE run with a
 * deterministic id and schedules ONE Cloud Task; the worker runs the static steps and checkpoints.
 *
 * STEPS (static, in order): load → extract → validate → summarize → store.
 * - load:      transcript completed, same workspace/meeting, AI use allowed, consent `ai_read`, an
 *              allowed provider for personal data (re-checked on every attempt).
 * - extract:   chunk; for each chunk WITHOUT a checkpoint call the model (≤ 4 at a time, breaker +
 *              deadline) and save a checkpoint, so a retry resumes and never repeats a model call.
 * - validate:  pure (`validateExtraction`) on the checkpoints.
 * - summarize: validated items only; a failure leaves the summary empty (items still stored).
 * - store:     re-check cancel, supersede and consent (TOCTOU), then header-last write.
 *
 * CONCURRENCY: one run per (workspace, transcript, prompt version). A newer transcript for the same
 * meeting asks older active runs to stop; a superseded run never stores over newer data.
 * FAILURES: retryable (provider, breaker, deadline) → `retry` (task answers 503, Cloud Tasks backs
 * off); after MAX_RUN_ATTEMPTS → dead-lettered with a DLQ record. Stuck runs are reaped.
 *
 * Tests: src/lib/meetings/__tests__/intelligence-pipeline.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { scheduleTaskWithKey } from '@/lib/gcp-tasks-client';
import { CircuitBreaker, CircuitBreakerOpenError } from '@/platform/events/resilience/circuit-breaker';
import { providersAllowedFor, resolveAiDataPolicy } from '@/platform/policy/ai-data-policy';
import { assertConsent, ConsentRequiredError } from '../consent-store';
import { TRANSCRIPTS, TranscriptHeaderSchema, findLatestTranscriptId, readTranscriptText } from '../transcript-store';
import { chunkTranscript, type TranscriptChunk } from './chunker';
import { isValidTimeZone } from './date-resolver';
import type { OwnerCandidate } from './owner-mapper';
import { EXTRACT_PROMPT_VERSION, SUMMARY_PROMPT_VERSION, buildExtractPrompt, buildSummaryPrompt, promptHash } from './prompts';
import {
  ACTIVE_RUN_STATUSES,
  INTELLIGENCE_SCHEMA_VERSION,
  PIPELINE_ID,
  RUNS,
  RunSchema,
  loadCheckpoints,
  loadRun,
  runIdFor,
  saveCheckpoint,
  writeIntelligenceV2,
  type ChunkCheckpoint,
  type IntelligenceRun,
  type PipelineStep,
} from './intelligence-store';
import { validateExtraction, validateSummary } from './validate-items';

export const INTELLIGENCE_QUEUE = 'meeting-intelligence-queue';
export const INTELLIGENCE_ENDPOINT = '/api/tasks/meeting-intelligence';
export const MAX_RUN_ATTEMPTS = 3;
export const DAILY_RUNS_PER_WORKSPACE = 50;
export const MAX_CONCURRENT_CHUNKS = 4;
export const CHUNK_DEADLINE_MS = 90_000;
export const SUMMARY_DEADLINE_MS = 60_000;
/** A run not updated for this long is stuck (worker died): reaped. */
export const STALE_RUN_MS = 30 * 60 * 1000;
/** A `running` run updated more recently than this is owned by another worker (duplicate delivery). */
export const RUN_LEASE_MS = 10 * 60 * 1000;

// ── Dependencies ──────────────────────────────────────────────────────────────────

/** The data policy allows no provider for this tenant's personal data. */
export class IntelligencePolicyError extends Error {
  constructor(message = "Your workspace doesn't allow AI analysis of meeting content.") {
    super(message);
    this.name = 'IntelligencePolicyError';
  }
}

export class IntelligenceDeadlineError extends Error {
  constructor(readonly ms: number) {
    super(`The AI service took longer than ${ms} ms.`);
    this.name = 'IntelligenceDeadlineError';
  }
}

export interface IntelligenceModelRequest {
  prompt: string;
  workspaceId: string;
  organizationId?: string;
  signal?: AbortSignal;
}

export interface IntelligenceModelResponse {
  /** Null when the model returned nothing usable. */
  output: unknown;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface IntelligenceModel {
  readonly breakerKey: string;
  extract(request: IntelligenceModelRequest): Promise<IntelligenceModelResponse>;
  summarize(request: IntelligenceModelRequest): Promise<IntelligenceModelResponse>;
}

export interface PipelineDeps {
  model: IntelligenceModel | null;
  schedule?: (taskKey: string, queue: string, endpoint: string, payload: Record<string, unknown>) => Promise<unknown>;
  breaker?: CircuitBreaker;
  nowMs: () => number;
  deadlines?: { chunkMs: number; summaryMs: number };
}

const defaultBreaker = new CircuitBreaker();

export async function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new IntelligenceDeadlineError(ms));
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), late]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Request ───────────────────────────────────────────────────────────────────────

export class IntelligenceRequestError extends Error {
  constructor(readonly code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'PROVIDER_ERROR' | 'QUOTA', message: string) {
    super(message);
    this.name = 'IntelligenceRequestError';
  }
}

export interface IntelligenceRequestParams {
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  transcriptId?: string;
  requestedBy: IntelligenceRun['requestedBy'];
  dryRun?: boolean;
}

export interface IntelligenceRequestResult {
  runId: string;
  transcriptId: string;
  status: IntelligenceRun['status'] | 'eligible';
  replayed: boolean;
}

/** The checks shared by request time, every worker attempt and re-summarizing (Rules 57, 58). */
export async function assertAnalysable(
  db: Firestore,
  params: { workspaceId: string; organizationId?: string; meetingId: string; transcriptId: string }
): Promise<void> {
  const snap = await db.collection(TRANSCRIPTS).doc(params.transcriptId).get();
  const header = snap.exists ? TranscriptHeaderSchema.safeParse(snap.data()) : null;
  if (!header?.success || header.data.workspaceId !== params.workspaceId || header.data.meetingId !== params.meetingId || header.data.status !== 'completed') {
    throw new IntelligenceRequestError('NOT_FOUND', 'No completed transcript found for this meeting.');
  }
  if (header.data.aiUse === 'restricted') {
    throw new IntelligenceRequestError('FORBIDDEN', 'AI analysis is off for this transcript because consent was withdrawn.');
  }
  try {
    await assertConsent(db, { workspaceId: params.workspaceId, meetingId: params.meetingId, operation: 'ai_read' });
  } catch (err) {
    if (err instanceof ConsentRequiredError) throw new IntelligenceRequestError('FORBIDDEN', err.message);
    throw err;
  }
  const policy = await resolveAiDataPolicy(db, { workspaceId: params.workspaceId, ...(params.organizationId ? { organizationId: params.organizationId } : {}) });
  if (providersAllowedFor(policy, 'personal').length === 0) {
    throw new IntelligenceRequestError('FORBIDDEN', "Your workspace doesn't allow AI analysis of meeting content.");
  }
}

const usageDocId = (workspaceId: string, nowMs: number) => `${workspaceId}_${new Date(nowMs).toISOString().slice(0, 10)}`;

export async function requestIntelligenceRun(
  db: Firestore,
  deps: PipelineDeps,
  params: IntelligenceRequestParams
): Promise<IntelligenceRequestResult> {
  const transcriptId = params.transcriptId ?? (await findLatestTranscriptId(db, params.meetingId, params.workspaceId));
  if (!transcriptId) throw new IntelligenceRequestError('NOT_FOUND', 'Add a transcript to this meeting first.');
  await assertAnalysable(db, { ...params, transcriptId });

  const runId = runIdFor(params.workspaceId, transcriptId, EXTRACT_PROMPT_VERSION);
  if (params.dryRun) return { runId, transcriptId, status: 'eligible', replayed: false };

  const nowMs = deps.nowMs();
  const nowIso = new Date(nowMs).toISOString();
  const runRef = db.collection(RUNS).doc(runId);
  const usageRef = db.collection('meeting_intelligence_usage').doc(usageDocId(params.workspaceId, nowMs));

  const outcome = await db.runTransaction(async (tx) => {
    const [snap, usageSnap] = await Promise.all([tx.get(runRef), tx.get(usageRef)]);
    const existing = snap.exists ? RunSchema.safeParse(snap.data()) : null;
    if (existing?.success) {
      const run = existing.data;
      const fresh = Date.parse(run.updatedAt) > nowMs - STALE_RUN_MS;
      // A duplicate trigger returns the active (or finished) run (plan §4.3 concurrency).
      if (run.status === 'completed' || (ACTIVE_RUN_STATUSES.includes(run.status) && fresh)) {
        return { started: false, status: run.status, version: run.version };
      }
    }
    const used = Number(usageSnap.data()?.count ?? 0);
    if (used >= DAILY_RUNS_PER_WORKSPACE) {
      throw new IntelligenceRequestError('QUOTA', 'Daily meeting-analysis limit reached. Resets at 00:00 UTC.');
    }
    const version = existing?.success ? existing.data.version + 1 : 0;
    tx.set(runRef, RunSchema.parse({
      workspaceId: params.workspaceId,
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      meetingId: params.meetingId,
      transcriptId,
      pipelineId: PIPELINE_ID,
      promptVersion: EXTRACT_PROMPT_VERSION,
      status: 'pending',
      step: 'load',
      // A restart keeps the chunk checkpoints (same prompt version), so finished chunks are reused.
      chunkCount: existing?.success ? existing.data.chunkCount : 0,
      chunksDone: existing?.success ? existing.data.chunksDone : 0,
      attempts: 0,
      requestedBy: params.requestedBy,
      usage: existing?.success ? existing.data.usage : { modelCalls: 0, inputTokens: 0, outputTokens: 0 },
      version,
      createdAt: existing?.success ? existing.data.createdAt : nowIso,
      updatedAt: nowIso,
    }));
    tx.set(usageRef, { workspaceId: params.workspaceId, day: nowIso.slice(0, 10), count: used + 1, updatedAt: nowIso });
    return { started: true, status: 'pending' as const, version };
  });

  if (!outcome.started) return { runId, transcriptId, status: outcome.status, replayed: true };

  // A newer transcript makes older active runs for this meeting stop (they never store).
  const others = await db.collection(RUNS)
    .where('workspaceId', '==', params.workspaceId).where('meetingId', '==', params.meetingId).limit(20).get();
  for (const d of others.docs) {
    const r = RunSchema.safeParse(d.data());
    if (d.id !== runId && r.success && ACTIVE_RUN_STATUSES.includes(r.data.status) && r.data.transcriptId !== transcriptId) {
      await d.ref.update({ cancelRequested: true, updatedAt: nowIso });
    }
  }

  try {
    await (deps.schedule ?? scheduleTaskWithKey)(`${runId}-v${outcome.version}`, INTELLIGENCE_QUEUE, INTELLIGENCE_ENDPOINT, { runId });
  } catch {
    // Fail closed: never leave a pending run nobody will process (M1 review R2a pattern).
    await runRef.update({ status: 'failed', error: { code: 'schedule_failed', message: "Couldn't start the analysis." }, updatedAt: nowIso });
    throw new IntelligenceRequestError('PROVIDER_ERROR', "Couldn't start the analysis. Try again in a moment.");
  }
  return { runId, transcriptId, status: 'pending', replayed: false };
}

// ── Worker ────────────────────────────────────────────────────────────────────────

export type RunOutcome =
  | { status: 'completed'; runId: string; kept: number; needsReview: number }
  | { status: 'noop'; reason: string }
  | { status: 'retry'; reason: string }
  | { status: 'failed' | 'cancelled' | 'superseded' | 'dead_lettered'; code: string };

const MeetingTimeSchema = z.object({ title: z.string().optional(), meetingTime: z.string().optional(), timezone: z.string().optional() }).loose();
const ParticipantSchema = z.object({ name: z.string().catch(''), userId: z.string().optional(), contactId: z.string().optional() }).loose();
const WorkspaceTimeZoneSchema = z.object({ timezone: z.string().optional() }).loose();

async function patchRun(db: Firestore, runId: string, patch: Partial<IntelligenceRun>, nowIso: string): Promise<void> {
  await db.collection(RUNS).doc(runId).update({ ...patch, updatedAt: nowIso });
}

/**
 * Ends a run, but only if it is still pending/running (a finished run is never overwritten, e.g. by
 * the reaper racing a worker). The DLQ record is written only when the transition happened.
 */
async function finish(
  db: Firestore,
  runId: string,
  status: 'failed' | 'cancelled' | 'superseded' | 'dead_lettered',
  code: string,
  message: string,
  nowIso: string
): Promise<RunOutcome> {
  const ref = db.collection(RUNS).doc(runId);
  const transitioned = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const run = snap.exists ? RunSchema.safeParse(snap.data()) : null;
    if (!run?.success || !ACTIVE_RUN_STATUSES.includes(run.data.status)) return false;
    tx.set(ref, { ...run.data, status, error: { code, message }, completedAt: nowIso, updatedAt: nowIso, version: run.data.version + 1 });
    return true;
  });
  if (transitioned && status === 'dead_lettered') {
    await db.collection('meeting_intelligence_dlq').doc(runId).set({ runId, code, message, at: nowIso, resolved: false });
  }
  return transitioned ? { status, code } : { status: 'noop', reason: 'already_finished' };
}

/**
 * Releases the lease so the Cloud Task retry can claim the run again. `refundAttempt` gives the
 * attempt back when the provider was never reached (breaker open, plan §5: "retry later without
 * burning attempts").
 */
async function retryLater(
  db: Firestore,
  run: IntelligenceRun,
  runId: string,
  step: PipelineStep,
  reason: string,
  nowIso: string,
  refundAttempt = false
): Promise<RunOutcome> {
  await patchRun(db, runId, { status: 'pending', step, ...(refundAttempt ? { attempts: Math.max(0, run.attempts - 1) } : {}) }, nowIso);
  return { status: 'retry', reason };
}

/** Why the run must stop now: cancelled (by request or consent), or superseded by a newer transcript. */
async function stopReason(db: Firestore, runId: string, run: IntelligenceRun): Promise<'cancelled' | 'superseded' | null> {
  const newest = await findLatestTranscriptId(db, run.meetingId, run.workspaceId);
  if (newest && newest !== run.transcriptId) return 'superseded';
  const latest = await loadRun(db, runId);
  return !latest || latest.cancelRequested ? 'cancelled' : null;
}

async function resolveTimeZone(db: Firestore, meetingTz: string | undefined, workspaceId: string): Promise<{ timeZone: string; source: 'meeting' | 'workspace' | 'default' }> {
  if (meetingTz && isValidTimeZone(meetingTz)) return { timeZone: meetingTz, source: 'meeting' };
  const ws = WorkspaceTimeZoneSchema.safeParse((await db.collection('workspaces').doc(workspaceId).get()).data() ?? {});
  const wsTz = ws.success ? ws.data.timezone : undefined;
  if (wsTz && isValidTimeZone(wsTz)) return { timeZone: wsTz, source: 'workspace' };
  return { timeZone: 'UTC', source: 'default' };
}

export async function processIntelligenceRun(db: Firestore, deps: PipelineDeps, runId: string): Promise<RunOutcome> {
  const nowIso = () => new Date(deps.nowMs()).toISOString();
  const ref = db.collection(RUNS).doc(runId);

  // Claim (lease): only a pending run, or a `running` run whose worker stopped updating it.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const parsed = snap.exists ? RunSchema.safeParse(snap.data()) : null;
    if (!parsed?.success) return { kind: 'noop' as const, reason: 'not_found' };
    const run = parsed.data;
    const ownedElsewhere = run.status === 'running' && Date.parse(run.updatedAt) > deps.nowMs() - RUN_LEASE_MS;
    if (!ACTIVE_RUN_STATUSES.includes(run.status) || ownedElsewhere) return { kind: 'noop' as const, reason: `already_${run.status}` };
    const next: IntelligenceRun = { ...run, status: 'running', attempts: run.attempts + 1, version: run.version + 1, updatedAt: nowIso() };
    tx.set(ref, next);
    return { kind: 'claimed' as const, run: next };
  });
  if (claimed.kind === 'noop') return { status: 'noop', reason: claimed.reason };
  try {
    return await runClaimed(db, deps, runId, claimed.run);
  } catch (err) {
    // Unexpected failure: release the lease so the task retry can claim the run again (the attempt
    // counter still bounds retries), then let the worker answer 5xx.
    await patchRun(db, runId, { status: 'pending' }, nowIso()).catch(() => undefined);
    throw err;
  }
}

async function runClaimed(db: Firestore, deps: PipelineDeps, runId: string, run: IntelligenceRun): Promise<RunOutcome> {
  const nowIso = () => new Date(deps.nowMs()).toISOString();
  const deadlines = deps.deadlines ?? { chunkMs: CHUNK_DEADLINE_MS, summaryMs: SUMMARY_DEADLINE_MS };
  const breaker = deps.breaker ?? defaultBreaker;
  if (run.attempts > MAX_RUN_ATTEMPTS) return finish(db, runId, 'dead_lettered', 'attempts_exhausted', 'The analysis failed after several tries.', nowIso());

  const stop = await stopReason(db, runId, run);
  if (stop) return finish(db, runId, stop, stop, stop === 'superseded' ? 'A newer transcript replaced this one.' : 'The analysis was cancelled.', nowIso());

  // 1. load
  try {
    await assertAnalysable(db, run);
  } catch (err) {
    if (err instanceof IntelligenceRequestError) return finish(db, runId, err.code === 'FORBIDDEN' ? 'cancelled' : 'failed', `load_${err.code.toLowerCase()}`, err.message, nowIso());
    throw err;
  }
  if (!deps.model) return retryLater(db, run, runId, 'load', 'model_unavailable', nowIso(), true);
  const model = deps.model;

  const transcript = await readTranscriptText(db, run.transcriptId, run.workspaceId);
  const meeting = MeetingTimeSchema.safeParse((await db.collection('meetings').doc(run.meetingId).get()).data() ?? {});
  const meetingIso = meeting.success && meeting.data.meetingTime ? meeting.data.meetingTime : transcript.header.completedAt ?? run.createdAt;
  const title = meeting.success && meeting.data.title ? meeting.data.title : 'Meeting';
  const tz = await resolveTimeZone(db, meeting.success ? meeting.data.timezone : undefined, run.workspaceId);
  const participants = await db.collection('participants').where('meetingId', '==', run.meetingId).limit(200).get();
  const owners: OwnerCandidate[] = [
    ...transcript.header.speakers.map((s) => ({ name: s.name, ...(s.participantId ? { participantId: s.participantId } : {}) })),
    ...participants.docs.flatMap((d) => {
      const p = ParticipantSchema.safeParse(d.data());
      return p.success && p.data.name ? [{ name: p.data.name, participantId: d.id, ...(p.data.userId ? { userId: p.data.userId } : {}) }] : [];
    }),
  ];

  // 2. extract (resumable)
  const chunking = chunkTranscript(transcript.segments);
  await patchRun(db, runId, { step: 'extract', chunkCount: chunking.chunks.length, coverage: chunking.coverage, truncated: chunking.truncated || transcript.truncated }, nowIso());
  const checkpoints = await loadCheckpoints(db, runId);
  const hash = promptHash(EXTRACT_PROMPT_VERSION);
  const todo = chunking.chunks.filter((c) => !checkpoints.has(c.index));
  let usage = run.usage;

  for (let i = 0; i < todo.length; i += MAX_CONCURRENT_CHUNKS) {
    if (i > 0) {
      const between = await stopReason(db, runId, run);
      if (between) return finish(db, runId, between, between, 'Stopped between chunks.', nowIso());
    }
    const batch = todo.slice(i, i + MAX_CONCURRENT_CHUNKS);
    const results = await Promise.allSettled(batch.map((chunk: TranscriptChunk) =>
      breaker.execute(`meeting_intelligence:${model.breakerKey}`, () =>
        withDeadline((signal) => model.extract({
          prompt: buildExtractPrompt(chunk, { title, meetingIso, chunkCount: chunking.chunks.length }),
          workspaceId: run.workspaceId,
          ...(run.organizationId ? { organizationId: run.organizationId } : {}),
          signal,
        }), deadlines.chunkMs)
      ).then(async (res) => {
        const cp: ChunkCheckpoint = {
          index: chunk.index, rawOutput: res.output ?? null, modelId: res.modelId, promptHash: hash,
          ...(res.inputTokens !== undefined ? { inputTokens: res.inputTokens } : {}),
          ...(res.outputTokens !== undefined ? { outputTokens: res.outputTokens } : {}),
          at: nowIso(),
        };
        await saveCheckpoint(db, runId, cp);
        checkpoints.set(chunk.index, cp);
        return cp;
      })
    ));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        usage = {
          modelCalls: usage.modelCalls + 1,
          inputTokens: usage.inputTokens + (r.value.inputTokens ?? 0),
          outputTokens: usage.outputTokens + (r.value.outputTokens ?? 0),
        };
      }
    }
    await patchRun(db, runId, { chunksDone: checkpoints.size, usage }, nowIso());
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) {
      if (failure.reason instanceof IntelligencePolicyError) return finish(db, runId, 'cancelled', 'policy', failure.reason.message, nowIso());
      const reason = failure.reason instanceof CircuitBreakerOpenError ? 'breaker_open'
        : failure.reason instanceof IntelligenceDeadlineError ? 'timeout' : 'provider_error';
      // Finished chunks are checkpointed; the retry only redoes the rest.
      if (reason === 'breaker_open') return retryLater(db, run, runId, 'extract', reason, nowIso(), true);
      return run.attempts >= MAX_RUN_ATTEMPTS
        ? finish(db, runId, 'dead_lettered', reason, 'The AI service kept failing.', nowIso())
        : retryLater(db, run, runId, 'extract', reason, nowIso());
    }
  }

  // 3. validate (pure, re-runnable from checkpoints)
  await patchRun(db, runId, { step: 'validate' }, nowIso());
  const validation = validateExtraction(
    chunking.chunks.map((chunk) => ({ chunk, rawOutput: checkpoints.get(chunk.index)?.rawOutput ?? null })),
    {
      workspaceId: run.workspaceId, meetingId: run.meetingId, transcriptId: run.transcriptId, promptVersion: run.promptVersion,
      meetingIso, timeZone: tz.timeZone, timeZoneSource: tz.source, injectionFlagged: transcript.header.injection.flagged,
      owners, nowIso: nowIso(),
    }
  );

  // 4. summarize (validated items only; optional)
  await patchRun(db, runId, { step: 'summarize' }, nowIso());
  let summary: { sentences: { text: string; itemHashes: string[] }[]; promptVersion: string } | null = null;
  let modelId = [...checkpoints.values()][0]?.modelId;
  if (validation.items.length > 0) {
    try {
      const res = await breaker.execute(`meeting_intelligence:${model.breakerKey}`, () =>
        withDeadline((signal) => model.summarize({
          prompt: buildSummaryPrompt(validation.items),
          workspaceId: run.workspaceId,
          ...(run.organizationId ? { organizationId: run.organizationId } : {}),
          signal,
        }), deadlines.summaryMs)
      );
      usage = { modelCalls: usage.modelCalls + 1, inputTokens: usage.inputTokens + (res.inputTokens ?? 0), outputTokens: usage.outputTokens + (res.outputTokens ?? 0) };
      modelId = modelId ?? res.modelId;
      const s = validateSummary(res.output, validation.items);
      summary = s ? { sentences: s.sentences, promptVersion: SUMMARY_PROMPT_VERSION } : null;
    } catch {
      summary = null; // Items are still useful without a summary (failure matrix: degrade).
    }
  }

  // 5. store (TOCTOU: re-check before writing)
  await patchRun(db, runId, { step: 'store', usage }, nowIso());
  const beforeStore = await stopReason(db, runId, run);
  if (beforeStore) return finish(db, runId, beforeStore, beforeStore, 'Stopped before storing.', nowIso());
  try {
    await assertAnalysable(db, run);
  } catch (err) {
    if (err instanceof IntelligenceRequestError) return finish(db, runId, 'cancelled', 'consent_withdrawn', err.message, nowIso());
    throw err;
  }
  const existing = await db.collection('meeting_intelligence').doc(run.meetingId).get();
  const previousVersion = Number(existing.data()?.version ?? -1);
  const at = nowIso();
  await writeIntelligenceV2(db, {
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    workspaceId: run.workspaceId,
    ...(run.organizationId ? { organizationId: run.organizationId } : {}),
    meetingId: run.meetingId,
    transcriptId: run.transcriptId,
    runId,
    pipelineId: PIPELINE_ID,
    promptVersion: run.promptVersion,
    promptHash: hash,
    summary,
    counts: { kept: validation.kept, needsReview: validation.needsReview, dropped: validation.dropped },
    coverage: chunking.coverage,
    truncated: chunking.truncated || transcript.truncated,
    ...(modelId ? { modelId } : {}),
    version: (Number.isFinite(previousVersion) ? previousVersion : -1) + 1,
    generatedAt: at,
    updatedAt: at,
  }, validation.items);
  await patchRun(db, runId, { status: 'completed', completedAt: at, usage }, at);
  return { status: 'completed', runId, kept: validation.kept, needsReview: validation.needsReview };
}

// ── Reaper ───────────────────────────────────────────────────────────────────────

/** Heartbeat: runs stuck for > 30 min stop counting as active (bounded to 50 per call). */
export async function reapStaleIntelligenceRuns(db: Firestore, nowMs: number): Promise<{ failed: number; deadLettered: number }> {
  const cutoff = new Date(nowMs - STALE_RUN_MS).toISOString();
  const nowIso = new Date(nowMs).toISOString();
  const snap = await db.collection(RUNS).where('status', 'in', ['pending', 'running']).where('updatedAt', '<', cutoff).orderBy('updatedAt', 'asc').limit(50).get();
  let failed = 0;
  let deadLettered = 0;
  for (const d of snap.docs) {
    const run = RunSchema.safeParse(d.data());
    if (!run.success) continue;
    if (run.data.status === 'running') {
      await finish(db, d.id, 'dead_lettered', 'stalled', 'The analysis stopped responding.', nowIso);
      deadLettered += 1;
    } else {
      await finish(db, d.id, 'failed', 'stalled', 'The analysis did not start. Try again.', nowIso);
      failed += 1;
    }
  }
  return { failed, deadLettered };
}
