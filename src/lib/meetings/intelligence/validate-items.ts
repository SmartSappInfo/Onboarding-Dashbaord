/**
 * @fileOverview Pipeline step 3: validate model output into stored items
 * (Phase 11 M2 · T3.2; plan §4.3–4.4; Rules 13, 30, 31, 47, 48).
 *
 * Order per proposed item: schema → evidence (ids in THIS chunk, real quote) → business (date,
 * amount, owner) → identity (itemHash) → dedupe across chunks (overlap) → contradictions → review
 * flags. Nothing the model says is trusted until it passes; every drop is counted by reason for
 * the "Why?" view.
 *
 * Pure and deterministic (re-running it on stored checkpoints gives the same items).
 * Tests: src/lib/meetings/__tests__/intelligence-validate.test.ts
 */

import { z } from 'zod/v4';
import type { TranscriptChunk } from './chunker';
import { linkContradictions } from './contradictions';
import { validateItemEvidence } from './evidence';
import {
  ChunkModelItemSchema,
  ChunkModelOutputLooseSchema,
  LOW_CONFIDENCE,
  type DropReason,
  type MeetingItem,
  type ReviewReason,
} from './intelligence-schemas';
import { itemHash } from './item-hash';
import { normalizeAmount } from './amount';
import { mapOwner, type OwnerCandidate } from './owner-mapper';
import { resolveDuePhrase } from './date-resolver';

export const MAX_ITEMS_PER_MEETING = 200;
const MAX_EVIDENCE = 3;

export interface ValidationContext {
  workspaceId: string;
  meetingId: string;
  transcriptId: string;
  promptVersion: string;
  meetingIso: string;
  timeZone: string;
  timeZoneSource: 'meeting' | 'workspace' | 'default';
  injectionFlagged: boolean;
  owners: readonly OwnerCandidate[];
  nowIso: string;
}

export interface ValidationResult {
  items: MeetingItem[];
  dropped: Record<DropReason, number>;
  kept: number;
  needsReview: number;
}

const emptyDrops = (): Record<DropReason, number> => ({
  schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0,
});

export function validateExtraction(
  chunks: readonly { chunk: TranscriptChunk; rawOutput: unknown }[],
  ctx: ValidationContext
): ValidationResult {
  const dropped = emptyDrops();
  const byHash = new Map<string, MeetingItem>();

  for (const { chunk, rawOutput } of chunks) {
    const loose = ChunkModelOutputLooseSchema.safeParse(rawOutput);
    if (!loose.success) {
      dropped.schema += 1;
      continue;
    }
    const segmentsById = new Map(chunk.segments.map((s) => [s.id, s]));
    const order = new Map(chunk.segments.map((s, i) => [s.id, i]));

    for (const raw of loose.data.items) {
      const parsed = ChunkModelItemSchema.safeParse(raw);
      if (!parsed.success) {
        dropped.schema += 1;
        continue;
      }
      const p = parsed.data;
      const evidence = validateItemEvidence(p.evidence, segmentsById, order);
      if (!evidence.ok) {
        dropped[evidence.reason] += 1;
        continue;
      }

      const due = resolveDuePhrase(p.dueText, { meetingIso: ctx.meetingIso, timeZone: ctx.timeZone });
      const amount = normalizeAmount(p.amountValue, p.amountCurrency);
      const owner = mapOwner(p.ownerName, ctx.owners);
      const hash = itemHash({ type: p.type, text: p.text, ownerName: owner?.matched ? owner.name : p.ownerName, dueIso: due?.iso });

      const reviewReasons: ReviewReason[] = [];
      if (p.confidence < LOW_CONFIDENCE) reviewReasons.push('low_confidence');
      if (ctx.injectionFlagged) reviewReasons.push('injection_flagged');
      if (amount?.ambiguous) reviewReasons.push('ambiguous_amount');
      if (due && ctx.timeZoneSource === 'default') reviewReasons.push('default_time_zone');

      const evidenceOut = p.evidence.map((e) => ({ segmentIds: [...new Set(e.segmentIds)], quote: e.quote }));
      const existing = byHash.get(hash);
      if (existing) {
        // Same item seen again (chunk overlap): merge evidence, keep the higher confidence.
        dropped.duplicate += 1;
        const quotes = new Set(existing.evidence.map((e) => e.quote));
        existing.evidence = [...existing.evidence, ...evidenceOut.filter((e) => !quotes.has(e.quote))].slice(0, MAX_EVIDENCE);
        existing.confidence = Math.max(existing.confidence, p.confidence);
        continue;
      }
      if (byHash.size >= MAX_ITEMS_PER_MEETING) {
        dropped.over_limit += 1;
        continue;
      }
      byHash.set(hash, {
        workspaceId: ctx.workspaceId,
        meetingId: ctx.meetingId,
        transcriptId: ctx.transcriptId,
        itemHash: hash,
        type: p.type,
        text: p.text,
        ...(owner ? { owner } : {}),
        ...(due ? { dueDate: { ...due, timeZoneSource: ctx.timeZoneSource }, dueIso: due.iso } : {}),
        ...(amount ? { amount } : {}),
        confidence: p.confidence,
        evidence: evidenceOut.slice(0, MAX_EVIDENCE),
        contradicts: [],
        needsReview: reviewReasons.length > 0,
        reviewReasons,
        status: 'valid',
        promptVersion: ctx.promptVersion,
        createdAt: ctx.nowIso,
      });
    }
  }

  // Low confidence must be judged on the merged item, not the first sighting.
  for (const item of byHash.values()) {
    const reasons: ReviewReason[] = item.reviewReasons.filter((r) => r !== 'low_confidence');
    if (item.confidence < LOW_CONFIDENCE) reasons.unshift('low_confidence');
    item.reviewReasons = reasons;
    item.needsReview = reasons.length > 0;
  }

  const items = [...byHash.values()];
  const links = linkContradictions(items.map((i) => ({
    itemHash: i.itemHash, type: i.type, text: i.text,
    ...(i.dueIso ? { dueIso: i.dueIso } : {}),
    ...(i.amount ? { amountValue: i.amount.value } : {}),
  })));
  for (const item of items) item.contradicts = links.get(item.itemHash) ?? [];

  return { items, dropped, kept: items.length, needsReview: items.filter((i) => i.needsReview).length };
}

// ── Summary validation ─────────────────────────────────────────────────────────────

export const SummaryModelOutputLooseSchema = z.object({ sentences: z.array(z.unknown()).max(12) });
const SummarySentenceSchema = z.object({
  text: z.string().trim().min(1).max(400),
  itemIds: z.array(z.string().min(1)).min(1).max(10),
});

export interface ValidatedSummary {
  sentences: { text: string; itemHashes: string[] }[];
  dropped: number;
}

/** Keeps sentences that cite only known item hashes; null when none survive. */
export function validateSummary(raw: unknown, items: readonly Pick<MeetingItem, 'itemHash'>[]): ValidatedSummary | null {
  const loose = SummaryModelOutputLooseSchema.safeParse(raw);
  if (!loose.success) return null;
  const known = new Set(items.map((i) => i.itemHash));
  let dropped = 0;
  const sentences: ValidatedSummary['sentences'] = [];
  for (const s of loose.data.sentences) {
    const parsed = SummarySentenceSchema.safeParse(s);
    const ids = parsed.success ? [...new Set(parsed.data.itemIds)] : [];
    if (!parsed.success || ids.some((id) => !known.has(id))) {
      dropped += 1;
      continue;
    }
    sentences.push({ text: parsed.data.text, itemHashes: ids });
  }
  return sentences.length > 0 ? { sentences: sentences.slice(0, 6), dropped } : null;
}
