/**
 * @fileOverview Evidence validation (Phase 11 M2 · T3.1; plan §4.4 rules 2–3; Rules 30, 31, 47).
 *
 * A model-proposed item is kept only if EVERY piece of evidence:
 * - cites segment ids that exist in the chunk the model was shown (an id from another chunk,
 *   meeting or workspace is rejected), and
 * - quotes words that really appear in those segments (normalised substring of the cited
 *   segments joined in order), at least `MIN_QUOTE_WORDS` words long.
 *
 * Pure. Tests: src/lib/meetings/__tests__/intelligence-pure.test.ts
 */

import type { TranscriptSegmentV2 } from '../transcript-store';
import { MIN_QUOTE_WORDS, type DropReason } from './intelligence-schemas';
import { normalizeForMatch, wordCount } from './text-normalize';

export interface EvidenceInput {
  segmentIds: readonly string[];
  quote: string;
}

export type EvidenceVerdict = { ok: true } | { ok: false; reason: Extract<DropReason, 'unknown_segment' | 'quote_not_found' | 'quote_too_short'> };

export function validateEvidence(
  evidence: EvidenceInput,
  segmentsById: ReadonlyMap<string, Pick<TranscriptSegmentV2, 'id' | 'text'>>,
  segmentOrder: ReadonlyMap<string, number>
): EvidenceVerdict {
  const ids = [...new Set(evidence.segmentIds)];
  if (ids.length === 0 || ids.some((id) => !segmentsById.has(id))) return { ok: false, reason: 'unknown_segment' };
  if (wordCount(evidence.quote) < MIN_QUOTE_WORDS) return { ok: false, reason: 'quote_too_short' };

  // Cited segments in transcript order, so a quote spanning two adjacent segments still matches.
  const ordered = ids.sort((a, b) => (segmentOrder.get(a) ?? 0) - (segmentOrder.get(b) ?? 0));
  const haystack = normalizeForMatch(ordered.map((id) => segmentsById.get(id)?.text ?? '').join(' '));
  const needle = normalizeForMatch(evidence.quote);
  return haystack.includes(needle) ? { ok: true } : { ok: false, reason: 'quote_not_found' };
}

/** Validates all evidence of one item; the first failure decides the drop reason. */
export function validateItemEvidence(
  evidence: readonly EvidenceInput[],
  segmentsById: ReadonlyMap<string, Pick<TranscriptSegmentV2, 'id' | 'text'>>,
  segmentOrder: ReadonlyMap<string, number>
): EvidenceVerdict {
  if (evidence.length === 0) return { ok: false, reason: 'quote_not_found' };
  for (const e of evidence) {
    const verdict = validateEvidence(e, segmentsById, segmentOrder);
    if (!verdict.ok) return verdict;
  }
  return { ok: true };
}
