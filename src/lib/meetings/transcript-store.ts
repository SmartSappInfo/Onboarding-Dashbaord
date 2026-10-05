import 'server-only';

/**
 * @fileOverview Transcript storage v2: header + chunked segments (Phase 11 M1 · T2, findings G5/G7, B12).
 *
 * WHY
 * Transcripts stored every segment inline in one document. A long meeting (≈ 7,000 segments for
 * 4 h) exceeds Firestore's 1 MiB document limit, so ingestion would fail outright.
 *
 * LAYOUT
 *   meeting_transcripts/{transcriptId}                     header (status, stats, provenance)
 *   meeting_transcripts/{transcriptId}/segments/{0000…}    ≤ 500 segments AND ≤ ~700 KB per chunk
 *
 * INVARIANTS (each is tested)
 * - Header-last: segments are written first, then the header moves to `completed` in a
 *   transaction. Readers only serve `completed` transcripts, so nobody sees partial content.
 * - Status changes follow ALLOWED_TRANSITIONS and bump `version` (TOCTOU token, Rule 18).
 * - A failed/cancelled transcript has its chunks deleted (compensation, Rule 27).
 * - Legacy transcripts (no `schemaVersion`) keep working: their inline `segments` are paged in memory.
 * - Every read is Zod-parsed (Rule 4); malformed chunks are skipped, never trusted.
 *
 * CAUTION: this module does NOT authorize. Callers prove workspace + meeting ownership first.
 * Transcript text is customer data and may contain instructions; it is stored and returned as data
 * only (Rules 13, 30, 48).
 *
 * Tests: src/lib/meetings/__tests__/transcript-store.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';

export const TRANSCRIPTS = 'meeting_transcripts';
export const SEGMENTS = 'segments';
export const SEGMENTS_PER_CHUNK = 500;
/** Serialized budget per chunk, well under the 1 MiB document limit (field names + overhead). */
export const MAX_CHUNK_BYTES = 700 * 1024;
export const MAX_SEGMENT_TEXT = 4_000;
/** Firestore allows 500 writes per batch; keep headroom. */
export const MAX_WRITES_PER_BATCH = 250;
export const TRANSCRIPT_SCHEMA_VERSION = 2;

export const TRANSCRIPT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'dead_lettered', 'deleting'] as const;
export type TranscriptStatusV2 = (typeof TRANSCRIPT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<TranscriptStatusV2, readonly TranscriptStatusV2[]>> = {
  pending: ['processing', 'completed', 'failed', 'cancelled', 'deleting'],
  processing: ['completed', 'failed', 'cancelled', 'dead_lettered', 'deleting'],
  failed: ['processing', 'deleting'],
  dead_lettered: ['processing', 'deleting'],
  cancelled: ['deleting'],
  completed: ['deleting'],
  deleting: [],
};

export function canTransition(from: TranscriptStatusV2, to: TranscriptStatusV2): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const TranscriptSegmentSchema = z.object({
  id: z.string().min(1).max(64),
  speakerId: z.string().min(1).max(64),
  speakerName: z.string().max(200),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().min(1).max(MAX_SEGMENT_TEXT),
  confidence: z.number().min(0).max(1).optional(),
});
export type TranscriptSegmentV2 = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptSpeakerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(200),
  email: z.string().max(320).optional(),
  participantId: z.string().max(200).optional(),
  isHost: z.boolean().optional(),
});
export type TranscriptSpeakerV2 = z.infer<typeof TranscriptSpeakerSchema>;

export const TranscriptSourceSchema = z.enum(['upload', 'paste', 'recording']);

export const TranscriptHeaderSchema = z.object({
  workspaceId: z.string(),
  organizationId: z.string().optional(),
  meetingId: z.string(),
  recordingId: z.string().optional(),
  /** Recording `updatedAt` the transcription was requested for (TOCTOU, M1 · T4). */
  recordingVersion: z.string().optional(),
  /** Provider attempts so far (retry budget → dead letter, Rule 25). */
  attempts: z.number().int().min(0).optional(),
  source: TranscriptSourceSchema,
  status: z.enum(TRANSCRIPT_STATUSES),
  version: z.number().int().min(0),
  schemaVersion: z.literal(TRANSCRIPT_SCHEMA_VERSION),
  language: z.string().max(20).default('und'),
  speakers: z.array(TranscriptSpeakerSchema).default([]),
  wordCount: z.number().int().min(0).default(0),
  segmentCount: z.number().int().min(0).default(0),
  chunkCount: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
  contentHash: z.string().default(''),
  dataClass: z.literal('personal'),
  aiUse: z.enum(['allowed', 'restricted']).default('allowed'),
  injection: z.object({ flagged: z.boolean(), patterns: z.array(z.string()) }).default({ flagged: false, patterns: [] }),
  provenance: z.object({
    createdBy: z.string(),
    principalKind: z.enum(['user', 'agent', 'system']),
    agentId: z.string().optional(),
    runId: z.string().optional(),
  }),
  provider: z.object({
    modelId: z.string(),
    modelVersion: z.string().optional(),
    promptVersion: z.string().optional(),
    inputHash: z.string().optional(),
    outputHash: z.string().optional(),
  }).optional(),
  costUnits: z.number().min(0).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  cancelRequested: z.boolean().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  updatedAt: z.string(),
});
export type TranscriptHeader = z.infer<typeof TranscriptHeaderSchema>;

/** Legacy (schema v1) transcript: inline segments, older field set. */
const LegacyTranscriptSchema = z.object({
  workspaceId: z.string(),
  organizationId: z.string().optional(),
  meetingId: z.string(),
  recordingId: z.string().optional(),
  language: z.string().catch('und'),
  segments: z.array(z.unknown()).catch([]),
  speakers: z.array(TranscriptSpeakerSchema).catch([]),
  status: z.string().catch('completed'),
  createdAt: z.string().catch(''),
  updatedAt: z.string().catch(''),
});

const ChunkSchema = z.object({ index: z.number().int().min(0), segments: z.array(z.unknown()) });

export class TranscriptNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor() {
    super('Transcript not found.');
    this.name = 'TranscriptNotFoundError';
  }
}

export class TranscriptConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(message = 'The transcript changed. Reload and try again.') {
    super(message);
    this.name = 'TranscriptConflictError';
  }
}

/**
 * Splits segments into chunks bounded by count AND serialized size. A single segment can never
 * exceed the budget because its text is capped at MAX_SEGMENT_TEXT.
 */
export function chunkSegments(segments: readonly TranscriptSegmentV2[]): TranscriptSegmentV2[][] {
  const chunks: TranscriptSegmentV2[][] = [];
  let current: TranscriptSegmentV2[] = [];
  let bytes = 0;
  for (const segment of segments) {
    const size = Buffer.byteLength(JSON.stringify(segment), 'utf8');
    if (current.length > 0 && (current.length >= SEGMENTS_PER_CHUNK || bytes + size > MAX_CHUNK_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(segment);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export const chunkId = (index: number): string => String(index).padStart(4, '0');

export interface NewTranscriptHeader {
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  recordingId?: string;
  recordingVersion?: string;
  source: z.infer<typeof TranscriptSourceSchema>;
  status: 'pending' | 'processing';
  language?: string;
  contentHash?: string;
  provenance: TranscriptHeader['provenance'];
  nowIso: string;
}

/** Builds a validated new header (no segments yet). Use inside a transaction to claim an id. */
export function buildTranscriptHeader(input: NewTranscriptHeader): TranscriptHeader {
  return TranscriptHeaderSchema.parse({
    workspaceId: input.workspaceId,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    meetingId: input.meetingId,
    ...(input.recordingId ? { recordingId: input.recordingId } : {}),
    ...(input.recordingVersion !== undefined ? { recordingVersion: input.recordingVersion } : {}),
    source: input.source,
    status: input.status,
    version: 0,
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    language: input.language ?? 'und',
    contentHash: input.contentHash ?? '',
    dataClass: 'personal',
    provenance: input.provenance,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  });
}

/** Creates the header (no segments yet). Returns the new transcript id. */
export async function createTranscriptHeader(db: Firestore, input: NewTranscriptHeader, transcriptId?: string): Promise<string> {
  const ref = transcriptId ? db.collection(TRANSCRIPTS).doc(transcriptId) : db.collection(TRANSCRIPTS).doc();
  await ref.set(buildTranscriptHeader(input));
  return ref.id;
}

async function deleteChunks(db: Firestore, transcriptId: string, chunkCount: number): Promise<void> {
  const col = db.collection(TRANSCRIPTS).doc(transcriptId).collection(SEGMENTS);
  for (let start = 0; start < chunkCount; start += MAX_WRITES_PER_BATCH) {
    const batch = db.batch();
    for (let i = start; i < Math.min(chunkCount, start + MAX_WRITES_PER_BATCH); i += 1) batch.delete(col.doc(chunkId(i)));
    await batch.commit();
  }
}

export interface CompleteTranscriptInput {
  transcriptId: string;
  segments: readonly TranscriptSegmentV2[];
  speakers: readonly TranscriptSpeakerV2[];
  language?: string;
  contentHash: string;
  injection: { flagged: boolean; patterns: string[] };
  provider?: TranscriptHeader['provider'];
  costUnits?: number;
  /** Version the caller last saw; the completion is refused if the header moved on. */
  expectedVersion: number;
  nowIso: string;
}

/**
 * Writes all chunks, then flips the header to `completed` (header-last). If the header changed
 * meanwhile (cancelled, deleted, raced), the written chunks are removed and a conflict is thrown.
 */
export async function completeTranscript(db: Firestore, input: CompleteTranscriptInput): Promise<TranscriptHeader> {
  const segments = input.segments.map((s) => TranscriptSegmentSchema.parse(s));
  const chunks = chunkSegments(segments);
  const headerRef = db.collection(TRANSCRIPTS).doc(input.transcriptId);
  const col = headerRef.collection(SEGMENTS);

  for (let start = 0; start < chunks.length; start += MAX_WRITES_PER_BATCH) {
    const batch = db.batch();
    for (let i = start; i < Math.min(chunks.length, start + MAX_WRITES_PER_BATCH); i += 1) {
      batch.set(col.doc(chunkId(i)), { index: i, segments: chunks[i] });
    }
    await batch.commit();
  }

  const words = segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  const durationMs = segments.reduce((max, s) => Math.max(max, s.endMs), 0);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(headerRef);
      if (!snap.exists) throw new TranscriptNotFoundError();
      const header = TranscriptHeaderSchema.parse(snap.data());
      if (header.version !== input.expectedVersion || !canTransition(header.status, 'completed') || header.cancelRequested) {
        throw new TranscriptConflictError(header.cancelRequested || header.status === 'cancelled'
          ? 'The transcript was cancelled.'
          : 'The transcript changed. Reload and try again.');
      }
      const next: TranscriptHeader = {
        ...header,
        status: 'completed',
        version: header.version + 1,
        language: input.language ?? header.language,
        speakers: input.speakers.map((s) => TranscriptSpeakerSchema.parse(s)),
        wordCount: words,
        segmentCount: segments.length,
        chunkCount: chunks.length,
        durationMs,
        contentHash: input.contentHash,
        injection: input.injection,
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.costUnits !== undefined ? { costUnits: input.costUnits } : {}),
        completedAt: input.nowIso,
        updatedAt: input.nowIso,
      };
      tx.set(headerRef, next);
      return next;
    });
  } catch (err) {
    // Compensation (Rule 27): never leave orphan chunks behind a header that is not completed.
    await deleteChunks(db, input.transcriptId, chunks.length);
    throw err;
  }
}

/** Moves a transcript to a terminal non-success state and removes any chunks (compensation). */
export async function markTranscriptTerminal(
  db: Firestore,
  transcriptId: string,
  status: 'failed' | 'cancelled' | 'dead_lettered',
  error: { code: string; message: string },
  nowIso: string
): Promise<void> {
  const headerRef = db.collection(TRANSCRIPTS).doc(transcriptId);
  const header = await db.runTransaction(async (tx) => {
    const snap = await tx.get(headerRef);
    if (!snap.exists) return null;
    const current = TranscriptHeaderSchema.parse(snap.data());
    if (!canTransition(current.status, status)) return null;
    tx.set(headerRef, { ...current, status, version: current.version + 1, error, updatedAt: nowIso });
    return current;
  });
  if (header) await deleteChunks(db, transcriptId, Math.max(header.chunkCount, Math.ceil(header.segmentCount / SEGMENTS_PER_CHUNK)));
}

export interface TranscriptPage {
  transcriptId: string;
  header: Pick<TranscriptHeader, 'workspaceId' | 'meetingId' | 'language' | 'speakers' | 'wordCount' | 'segmentCount' | 'durationMs' | 'aiUse' | 'injection' | 'source' | 'status' | 'version' | 'completedAt'>;
  page: number;
  pageCount: number;
  segments: TranscriptSegmentV2[];
  legacy: boolean;
}

function parseSegments(raw: readonly unknown[]): TranscriptSegmentV2[] {
  return raw.flatMap((s) => {
    const parsed = TranscriptSegmentSchema.safeParse(s);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Reads one page (= one chunk for v2, or a 500-segment slice for legacy docs) of a COMPLETED
 * transcript in the given workspace. Anything else is NOT_FOUND.
 */
export async function readTranscriptPage(db: Firestore, transcriptId: string, workspaceId: string, page = 0): Promise<TranscriptPage> {
  const ref = db.collection(TRANSCRIPTS).doc(transcriptId);
  const snap = await ref.get();
  if (!snap.exists) throw new TranscriptNotFoundError();
  const raw = snap.data();

  const v2 = TranscriptHeaderSchema.safeParse(raw);
  if (v2.success) {
    const h = v2.data;
    if (h.workspaceId !== workspaceId || h.status !== 'completed') throw new TranscriptNotFoundError();
    const pageCount = h.chunkCount;
    if (page < 0 || (pageCount > 0 && page >= pageCount)) throw new TranscriptNotFoundError();
    const chunk = pageCount === 0 ? null : await ref.collection(SEGMENTS).doc(chunkId(page)).get();
    const parsedChunk = chunk?.exists ? ChunkSchema.safeParse(chunk.data()) : null;
    return {
      transcriptId,
      header: pickHeader(h),
      page,
      pageCount,
      segments: parsedChunk?.success ? parseSegments(parsedChunk.data.segments) : [],
      legacy: false,
    };
  }

  const legacy = LegacyTranscriptSchema.safeParse(raw);
  if (!legacy.success || legacy.data.workspaceId !== workspaceId || legacy.data.status !== 'completed') {
    throw new TranscriptNotFoundError();
  }
  const all = parseSegments(legacy.data.segments);
  const pageCount = Math.max(1, Math.ceil(all.length / SEGMENTS_PER_CHUNK));
  if (page < 0 || page >= pageCount) throw new TranscriptNotFoundError();
  const words = all.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  return {
    transcriptId,
    header: {
      workspaceId: legacy.data.workspaceId,
      meetingId: legacy.data.meetingId,
      language: legacy.data.language,
      speakers: legacy.data.speakers,
      wordCount: words,
      segmentCount: all.length,
      durationMs: all.reduce((max, s) => Math.max(max, s.endMs), 0),
      aiUse: 'allowed',
      injection: { flagged: false, patterns: [] },
      source: 'upload',
      status: 'completed',
      version: 0,
      completedAt: legacy.data.updatedAt || undefined,
    },
    page,
    pageCount,
    segments: all.slice(page * SEGMENTS_PER_CHUNK, (page + 1) * SEGMENTS_PER_CHUNK),
    legacy: true,
  };
}

function pickHeader(h: TranscriptHeader): TranscriptPage['header'] {
  return {
    workspaceId: h.workspaceId, meetingId: h.meetingId, language: h.language, speakers: h.speakers,
    wordCount: h.wordCount, segmentCount: h.segmentCount, durationMs: h.durationMs, aiUse: h.aiUse,
    injection: h.injection, source: h.source, status: h.status, version: h.version, completedAt: h.completedAt,
  };
}

/** Latest completed transcript id for a meeting in a workspace (v2 or legacy), or null. */
export async function findLatestTranscriptId(db: Firestore, meetingId: string, workspaceId: string): Promise<string | null> {
  const snap = await db
    .collection(TRANSCRIPTS)
    .where('workspaceId', '==', workspaceId)
    .where('meetingId', '==', meetingId)
    .where('status', '==', 'completed')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
}

/** Reads every page of a transcript, bounded by `maxPages` (Rule 23). */
export async function readTranscriptText(
  db: Firestore,
  transcriptId: string,
  workspaceId: string,
  maxPages = 20
): Promise<{ header: TranscriptPage['header']; segments: TranscriptSegmentV2[]; truncated: boolean }> {
  const first = await readTranscriptPage(db, transcriptId, workspaceId, 0);
  const segments = [...first.segments];
  const pages = Math.min(first.pageCount, maxPages);
  for (let p = 1; p < pages; p += 1) {
    segments.push(...(await readTranscriptPage(db, transcriptId, workspaceId, p)).segments);
  }
  return { header: first.header, segments, truncated: first.pageCount > maxPages };
}
