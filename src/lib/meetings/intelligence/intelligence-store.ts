/**
 * @fileOverview Meeting intelligence v2 storage (Phase 11 M2 · T3.2; plan §4.3; Rules 19, 20, 25, 40, 57).
 *
 * LAYOUT
 *   meeting_intelligence_runs/{runId}              one pipeline run (status, step, attempts, usage)
 *   meeting_intelligence_runs/{runId}/chunks/{i}   per-chunk checkpoint = replay record: raw model
 *                                                  output, model id, prompt hash, tokens
 *   meeting_intelligence/{meetingId}               v2 header (summary, counts, provenance), written LAST
 *   meeting_intelligence/{meetingId}/items/{hash}  validated items
 *
 * IDEMPOTENCY: `runId` is derived from (workspace, transcript, prompt version), so a duplicate
 * trigger finds the same run, and a retry finds its chunk checkpoints and never repeats a model call.
 * Items are keyed by `itemHash`.
 *
 * CAUTION
 * - Checkpoints hold quotes from customer speech (personal data). They are deleted with the
 *   transcript (`deleteDerivedMeetingData`) and are server-only (Firestore rules deny all).
 * - Writers must check the run is still current (not cancelled/superseded) before `writeIntelligenceV2`.
 *
 * Tests: src/lib/meetings/__tests__/intelligence-store.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore, WriteBatch } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { MeetingItemSchema, type DropReason, type MeetingItem } from './intelligence-schemas';

export const INTELLIGENCE = 'meeting_intelligence';
export const RUNS = 'meeting_intelligence_runs';
export const PIPELINE_ID = 'meeting_postprocess_v2';
export const INTELLIGENCE_SCHEMA_VERSION = 2;

/** Static step list (plan §4.3, finding F8): a run moves through these in order. */
export const PIPELINE_STEPS = ['load', 'extract', 'validate', 'summarize', 'store'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled', 'superseded', 'dead_lettered'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ['pending', 'running'];

const Count = z.number().int().min(0);
const DropCountsSchema = z.object({
  schema: Count, unknown_segment: Count, quote_not_found: Count, quote_too_short: Count, duplicate: Count, over_limit: Count,
});
/** Compile-time guard: the stored counts cover every drop reason (fails to type-check otherwise). */
export const dropCountsCoverReasons = (counts: z.infer<typeof DropCountsSchema>): Record<DropReason, number> => counts;

export const RunSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().optional(),
  meetingId: z.string().min(1),
  transcriptId: z.string().min(1),
  pipelineId: z.literal(PIPELINE_ID),
  promptVersion: z.string().min(1),
  status: z.enum(RUN_STATUSES),
  step: z.enum(PIPELINE_STEPS),
  chunkCount: z.number().int().min(0),
  chunksDone: z.number().int().min(0),
  attempts: z.number().int().min(0),
  cancelRequested: z.boolean().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  requestedBy: z.object({ userId: z.string(), agentId: z.string().optional(), principalKind: z.enum(['user', 'agent']) }),
  usage: z.object({ modelCalls: z.number().int().min(0), inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) }),
  coverage: z.number().min(0).max(1).optional(),
  truncated: z.boolean().optional(),
  version: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
export type IntelligenceRun = z.infer<typeof RunSchema>;

export const ChunkCheckpointSchema = z.object({
  index: z.number().int().min(0),
  rawOutput: z.unknown(),
  modelId: z.string(),
  promptHash: z.string(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  at: z.string(),
});
export type ChunkCheckpoint = z.infer<typeof ChunkCheckpointSchema>;

export const SummarySchema = z.object({
  sentences: z.array(z.object({ text: z.string(), itemHashes: z.array(z.string()).min(1) })).min(1),
  promptVersion: z.string(),
});

export const IntelligenceHeaderV2Schema = z.object({
  schemaVersion: z.literal(INTELLIGENCE_SCHEMA_VERSION),
  workspaceId: z.string().min(1),
  organizationId: z.string().optional(),
  meetingId: z.string().min(1),
  transcriptId: z.string().min(1),
  runId: z.string().min(1),
  pipelineId: z.literal(PIPELINE_ID),
  promptVersion: z.string(),
  promptHash: z.string(),
  summary: SummarySchema.nullable(),
  counts: z.object({ kept: z.number().int().min(0), needsReview: z.number().int().min(0), dropped: DropCountsSchema }),
  coverage: z.number().min(0).max(1),
  truncated: z.boolean(),
  modelId: z.string().optional(),
  version: z.number().int().min(0),
  generatedAt: z.string(),
  updatedAt: z.string(),
});
export type IntelligenceHeaderV2 = z.infer<typeof IntelligenceHeaderV2Schema>;

export function runIdFor(workspaceId: string, transcriptId: string, promptVersion: string): string {
  return `mir_${createHash('sha256').update(`${workspaceId}\u0000${transcriptId}\u0000${promptVersion}`).digest('hex').slice(0, 32)}`;
}

export function chunkCheckpointId(index: number): string {
  return String(index).padStart(3, '0');
}

export async function loadRun(db: Firestore, runId: string): Promise<IntelligenceRun | null> {
  const snap = await db.collection(RUNS).doc(runId).get();
  const parsed = snap.exists ? RunSchema.safeParse(snap.data()) : null;
  return parsed?.success ? parsed.data : null;
}

export async function loadCheckpoints(db: Firestore, runId: string): Promise<Map<number, ChunkCheckpoint>> {
  const snap = await db.collection(RUNS).doc(runId).collection('chunks').limit(100).get();
  const out = new Map<number, ChunkCheckpoint>();
  for (const d of snap.docs) {
    const parsed = ChunkCheckpointSchema.safeParse(d.data());
    if (parsed.success) out.set(parsed.data.index, parsed.data);
  }
  return out;
}

export async function saveCheckpoint(db: Firestore, runId: string, checkpoint: ChunkCheckpoint): Promise<void> {
  await db.collection(RUNS).doc(runId).collection('chunks').doc(chunkCheckpointId(checkpoint.index)).set({
    ...checkpoint,
    rawOutput: checkpoint.rawOutput ?? null,
  });
}

/**
 * Writes items, removes items of the previous analysis that are not in this one, then writes the
 * header LAST so readers never see a header pointing at items that aren't there yet.
 */
export async function writeIntelligenceV2(db: Firestore, header: IntelligenceHeaderV2, items: readonly MeetingItem[]): Promise<void> {
  const ref = db.collection(INTELLIGENCE).doc(header.meetingId);
  const existing = await ref.collection('items').limit(500).get();
  const keep = new Set(items.map((i) => i.itemHash));
  const writes: ((b: WriteBatch) => void)[] = [
    ...items.map((item) => (b: WriteBatch) => b.set(ref.collection('items').doc(item.itemHash), MeetingItemSchema.parse(item))),
    ...existing.docs.filter((d) => !keep.has(d.id)).map((d) => (b: WriteBatch) => b.delete(d.ref)),
  ];
  for (let i = 0; i < writes.length; i += 250) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 250)) w(batch);
    await batch.commit();
  }
  await ref.set(IntelligenceHeaderV2Schema.parse(header));
}

export interface IntelligenceV2 {
  header: IntelligenceHeaderV2;
  items: MeetingItem[];
}

/** v2 only; `null` for none, another workspace, or a v1 document (see the legacy adapter). */
export async function readIntelligenceV2(db: Firestore, meetingId: string, workspaceId: string): Promise<IntelligenceV2 | null> {
  const ref = db.collection(INTELLIGENCE).doc(meetingId);
  const snap = await ref.get();
  const header = snap.exists ? IntelligenceHeaderV2Schema.safeParse(snap.data()) : null;
  if (!header?.success || header.data.workspaceId !== workspaceId) return null;
  const itemSnap = await ref.collection('items').limit(500).get();
  const items = itemSnap.docs
    .map((d) => MeetingItemSchema.safeParse(d.data()))
    .filter((p) => p.success)
    .map((p) => p.data)
    .filter((i) => i.workspaceId === workspaceId && i.transcriptId === header.data.transcriptId);
  return { header: header.data, items };
}

/** Deletes runs (and their checkpoints) for a meeting, optionally only those of one transcript. */
export async function deleteIntelligenceRuns(
  db: Firestore,
  params: { workspaceId: string; meetingId: string; transcriptId?: string }
): Promise<number> {
  let q = db.collection(RUNS).where('workspaceId', '==', params.workspaceId).where('meetingId', '==', params.meetingId);
  if (params.transcriptId) q = q.where('transcriptId', '==', params.transcriptId);
  const runs = await q.limit(50).get();
  for (const run of runs.docs) {
    const chunks = await run.ref.collection('chunks').limit(100).get();
    const batch = db.batch();
    for (const c of chunks.docs) batch.delete(c.ref);
    batch.delete(run.ref);
    await batch.commit();
  }
  return runs.docs.length;
}
