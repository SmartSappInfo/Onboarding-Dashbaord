import 'server-only';

/**
 * @fileOverview Transcript ingestion pipeline (Phase 11 M1 · T3, finding G6/B4).
 *
 * text → limits → parse → speaker mapping → injection scan → idempotent store → meeting flag
 *
 * Used by `meeting.ingest_transcript` (gateway: auth, scope, audit, events) for uploads and pastes.
 *
 * IDEMPOTENCY (Rules 19/20): the transcript id is derived from (workspace, meeting, contentHash).
 * Re-ingesting the same content returns the same completed transcript; a concurrent duplicate
 * while one is processing is refused as in progress; a failed attempt can be retried.
 *
 * POISONING (Rule 30): every segment is scanned with the shared anti-poisoning rules. Flagged
 * transcripts are STILL STORED (they are evidence of the meeting) with `injection.flagged`, which
 * later milestones use to force human review. Text is never executed or interpreted.
 *
 * CAUTION: callers must have proven workspace + meeting ownership and `meetings_manage`.
 * The consent gate runs here so no caller can forget it.
 *
 * Tests: src/lib/meetings/__tests__/transcript-ingestion.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { evaluateMemoryContentRisk } from '@/platform/memory/governance/anti-poisoning';
import { assertConsent } from './consent-store';
import { parseTranscriptText, type ParsedTranscript, TranscriptParseError } from './transcript-parsers';
import {
  buildTranscriptHeader,
  completeTranscript,
  markTranscriptTerminal,
  TRANSCRIPTS,
  TranscriptHeaderSchema,
  type TranscriptHeader,
  type TranscriptSpeakerV2,
} from './transcript-store';

export const MAX_TRANSCRIPT_TEXT_BYTES = 5 * 1024 * 1024;
export const MAX_TRANSCRIPT_WORDS = 60_000;
export const MAX_TRANSCRIPT_DURATION_MS = 4 * 60 * 60 * 1000;
const MAX_FLAGGED_PATTERNS = 20;

export class IngestionRejectedError extends Error {
  readonly code = 'VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'IngestionRejectedError';
  }
}

export class IngestionInProgressError extends Error {
  readonly code = 'DUPLICATE_IN_PROGRESS';
  constructor() {
    super('This transcript is already being processed. Try again in a moment.');
    this.name = 'IngestionInProgressError';
  }
}

export interface IngestTranscriptParams {
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  source: 'upload' | 'paste';
  text: string;
  fileName?: string;
  provenance: TranscriptHeader['provenance'];
  nowIso: string;
}

export interface IngestTranscriptResult {
  transcriptId: string;
  replayed: boolean;
  segmentCount: number;
  speakerCount: number;
  wordCount: number;
  injectionFlagged: boolean;
  timed: boolean;
  warnings: string[];
}

export function hashTranscriptContent(parsed: Pick<ParsedTranscript, 'segments'>): string {
  const h = createHash('sha256');
  for (const s of parsed.segments) h.update(`${s.speakerName}\u0000${s.text}\u0000${s.startMs}\n`);
  return h.digest('hex');
}

export function transcriptIdFor(workspaceId: string, meetingId: string, contentHash: string): string {
  return `tx_${createHash('sha256').update(`${workspaceId}\u0000${meetingId}\u0000${contentHash}`).digest('hex').slice(0, 32)}`;
}

/** Validates size/encoding/words/duration and parses. Throws `IngestionRejectedError` with plain copy. */
export function parseWithinLimits(text: string, fileName?: string): ParsedTranscript {
  if (Buffer.byteLength(text, 'utf8') > MAX_TRANSCRIPT_TEXT_BYTES) {
    throw new IngestionRejectedError('This file is larger than 5 MB. Split it and try again.');
  }
  if (text.includes('�')) {
    throw new IngestionRejectedError("This file isn't UTF-8 text. Save it as UTF-8 and try again.");
  }
  let parsed: ParsedTranscript;
  try {
    parsed = parseTranscriptText(text, { fileName });
  } catch (err) {
    if (err instanceof TranscriptParseError) throw new IngestionRejectedError(err.message);
    throw err;
  }
  const words = parsed.segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  if (words > MAX_TRANSCRIPT_WORDS) throw new IngestionRejectedError('This transcript is longer than 60,000 words. Split it and try again.');
  const duration = parsed.segments.reduce((max, s) => Math.max(max, s.endMs), 0);
  if (parsed.timed && duration > MAX_TRANSCRIPT_DURATION_MS) {
    throw new IngestionRejectedError('This transcript is longer than 4 hours. Split it and try again.');
  }
  return parsed;
}

/** Links transcript speakers to meeting participants by name or email (case-insensitive). */
export async function mapSpeakersToParticipants(
  db: Firestore,
  meetingId: string,
  speakers: readonly TranscriptSpeakerV2[]
): Promise<TranscriptSpeakerV2[]> {
  const snap = await db.collection('participants').where('meetingId', '==', meetingId).limit(200).get();
  const byKey = new Map<string, { id: string; email?: string; isHost: boolean }>();
  for (const d of snap.docs) {
    const p = d.data() ?? {};
    const entry = { id: d.id, email: typeof p.email === 'string' ? p.email : undefined, isHost: p.role === 'host' || p.role === 'co_host' };
    if (typeof p.name === 'string' && p.name.trim()) byKey.set(p.name.trim().toLowerCase(), entry);
    if (entry.email) byKey.set(entry.email.toLowerCase(), entry);
  }
  return speakers.map((s) => {
    const match = byKey.get(s.name.trim().toLowerCase());
    return match
      ? { ...s, participantId: match.id, ...(match.email ? { email: match.email } : {}), ...(match.isHost ? { isHost: true } : {}) }
      : s;
  });
}

export function scanForInjection(parsed: Pick<ParsedTranscript, 'segments'>): { flagged: boolean; patterns: string[] } {
  const patterns = new Set<string>();
  for (const s of parsed.segments) {
    for (const p of evaluateMemoryContentRisk(s.text).detectedPatterns) patterns.add(p);
    if (patterns.size >= MAX_FLAGGED_PATTERNS) break;
  }
  return { flagged: patterns.size > 0, patterns: [...patterns].slice(0, MAX_FLAGGED_PATTERNS) };
}

export async function ingestTranscript(db: Firestore, params: IngestTranscriptParams): Promise<IngestTranscriptResult> {
  await assertConsent(db, { workspaceId: params.workspaceId, meetingId: params.meetingId, operation: 'ingest_transcript' });

  const parsed = parseWithinLimits(params.text, params.fileName);
  const contentHash = hashTranscriptContent(parsed);
  const transcriptId = transcriptIdFor(params.workspaceId, params.meetingId, contentHash);
  const words = parsed.segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  const summary = (replayed: boolean, flagged: boolean): IngestTranscriptResult => ({
    transcriptId, replayed, segmentCount: parsed.segments.length, speakerCount: parsed.speakers.length,
    wordCount: words, injectionFlagged: flagged, timed: parsed.timed, warnings: parsed.warnings,
  });

  // Claim the deterministic id atomically: the header is CREATED inside the transaction, so of two
  // concurrent identical uploads exactly one writes chunks. (Creating it afterwards would let both
  // pass, write the same chunk ids, and the loser's compensation would delete the winner's chunks.)
  const headerRef = db.collection(TRANSCRIPTS).doc(transcriptId);
  const newHeader = buildTranscriptHeader({
    workspaceId: params.workspaceId,
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
    meetingId: params.meetingId,
    source: params.source,
    status: 'processing',
    contentHash,
    provenance: params.provenance,
    nowIso: params.nowIso,
  });
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(headerRef);
    if (snap.exists) {
      const existing = TranscriptHeaderSchema.safeParse(snap.data());
      if (existing.success && existing.data.status === 'completed') return { kind: 'replay' as const, flagged: existing.data.injection.flagged };
      if (existing.success && (existing.data.status === 'processing' || existing.data.status === 'pending')) return { kind: 'busy' as const };
      if (existing.success && existing.data.status === 'deleting') throw new IngestionRejectedError('This transcript is being deleted. Try again later.');
      // failed / cancelled / dead_lettered / unparseable → re-claim with a fresh header.
    }
    tx.set(headerRef, newHeader);
    return { kind: 'claim' as const };
  });
  if (claim.kind === 'replay') return summary(true, claim.flagged);
  if (claim.kind === 'busy') throw new IngestionInProgressError();

  const injection = scanForInjection(parsed);
  try {
    const speakers = await mapSpeakersToParticipants(db, params.meetingId, parsed.speakers);
    await completeTranscript(db, {
      transcriptId, segments: parsed.segments, speakers, contentHash, injection, expectedVersion: 0, nowIso: params.nowIso,
    });
  } catch (err) {
    await markTranscriptTerminal(db, transcriptId, 'failed', { code: 'STORE_FAILED', message: 'Could not save the transcript.' }, params.nowIso);
    throw err;
  }

  await db.collection('meetings').doc(params.meetingId).update({ hasTranscript: true, updatedAt: params.nowIso }).catch(() => undefined);
  return summary(false, injection.flagged);
}
