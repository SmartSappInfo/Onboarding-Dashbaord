/**
 * @fileOverview Transcript chunker (Phase 11 M2 · T3.1; plan §4.3 step 2; Rules 9, 23).
 *
 * Splits a transcript into chunks for extraction:
 * - boundaries fall between speaker TURNS (consecutive segments by one speaker), so a turn is
 *   never cut unless it alone exceeds the budget;
 * - each chunk ≤ `maxTokens` (≈ 6k) and at most `maxChunks` (25) chunks;
 * - one-turn overlap: a chunk starts with the previous chunk's last turn, so a commitment made
 *   across a boundary is still seen whole. Duplicates from the overlap are removed later by itemHash.
 *
 * When the transcript needs more than `maxChunks`, the tail is NOT analysed and `truncated` is
 * true with the covered share, so the UI can say so (never silently partial).
 *
 * Pure and deterministic. Tests: src/lib/meetings/__tests__/intelligence-pure.test.ts
 */

import type { TranscriptSegmentV2 } from '../transcript-store';
import { estimateTokens } from './text-normalize';

export const CHUNK_MAX_TOKENS = 6_000;
export const CHUNK_MAX_COUNT = 25;

export interface TranscriptChunk {
  index: number;
  segments: TranscriptSegmentV2[];
  /** Ids the model may cite from this chunk. */
  segmentIds: ReadonlySet<string>;
  tokenEstimate: number;
}

export interface ChunkingResult {
  chunks: TranscriptChunk[];
  truncated: boolean;
  /** Segments analysed / total segments (1 when nothing was cut). */
  coverage: number;
}

const segmentTokens = (s: TranscriptSegmentV2) => estimateTokens(`${s.speakerName}: ${s.text}`) + 4;

function toTurns(segments: readonly TranscriptSegmentV2[], maxTokens: number): TranscriptSegmentV2[][] {
  const turns: TranscriptSegmentV2[][] = [];
  let current: TranscriptSegmentV2[] = [];
  let tokens = 0;
  for (const s of segments) {
    const t = segmentTokens(s);
    const sameSpeaker = current.length > 0 && current[current.length - 1].speakerId === s.speakerId;
    // A very long monologue is split so no single turn exceeds the budget.
    if (current.length > 0 && (!sameSpeaker || tokens + t > maxTokens)) {
      turns.push(current);
      current = [];
      tokens = 0;
    }
    current.push(s);
    tokens += t;
  }
  if (current.length > 0) turns.push(current);
  return turns;
}

export function chunkTranscript(
  segments: readonly TranscriptSegmentV2[],
  options: { maxTokens?: number; maxChunks?: number } = {}
): ChunkingResult {
  const maxTokens = options.maxTokens ?? CHUNK_MAX_TOKENS;
  const maxChunks = options.maxChunks ?? CHUNK_MAX_COUNT;
  if (segments.length === 0) return { chunks: [], truncated: false, coverage: 1 };

  const turns = toTurns(segments, maxTokens);
  const turnTokens = turns.map((turn) => turn.reduce((n, s) => n + segmentTokens(s), 0));

  const chunkTurns: number[][] = [];
  let current: number[] = [];
  let tokens = 0;
  for (let i = 0; i < turns.length; i += 1) {
    if (current.length > 0 && tokens + turnTokens[i] > maxTokens) {
      chunkTurns.push(current);
      const overlap = current[current.length - 1];
      // Overlap only when it leaves room for at least the next turn.
      current = turnTokens[overlap] + turnTokens[i] <= maxTokens ? [overlap] : [];
      tokens = current.length ? turnTokens[overlap] : 0;
    }
    current.push(i);
    tokens += turnTokens[i];
  }
  if (current.length > 0) chunkTurns.push(current);

  const kept = chunkTurns.slice(0, maxChunks);
  const chunks: TranscriptChunk[] = kept.map((turnIdx, index) => {
    const segs = turnIdx.flatMap((t) => turns[t]);
    return {
      index,
      segments: segs,
      segmentIds: new Set(segs.map((s) => s.id)),
      tokenEstimate: turnIdx.reduce((n, t) => n + turnTokens[t], 0),
    };
  });

  const truncated = chunkTurns.length > maxChunks;
  const covered = new Set(chunks.flatMap((c) => c.segments.map((s) => s.id))).size;
  return { chunks, truncated, coverage: truncated ? covered / segments.length : 1 };
}
