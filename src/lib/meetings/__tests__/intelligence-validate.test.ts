// @vitest-environment node
/**
 * @fileOverview Pipeline step 3: validation of model output into stored items (Phase 11 M2 · T3.2).
 * Fabricated quotes and foreign segment ids are dropped; overlap duplicates merge; review flags;
 * contradictions linked; summary sentences must cite real items.
 */
import { describe, it, expect } from 'vitest';
import type { TranscriptSegmentV2 } from '../transcript-store';
import { chunkTranscript, type TranscriptChunk } from '../intelligence/chunker';
import { MeetingItemSchema } from '../intelligence/intelligence-schemas';
import { MAX_ITEMS_PER_MEETING, validateExtraction, validateSummary, type ValidationContext } from '../intelligence/validate-items';

const seg = (id: string, speaker: string, text: string): TranscriptSegmentV2 => ({ id, speakerId: speaker, speakerName: speaker, startMs: 0, endMs: 1, text });
const segments = [
  seg('s1', 'Ama Mensah', 'I will send the revised quote by Friday.'),
  seg('s2', 'Kofi', 'Great. The budget is 5000 cedis for the pilot.'),
  seg('s3', 'Ama Mensah', 'We agreed to launch the pilot in November.'),
  seg('s4', 'Kofi', 'Actually we will not launch the pilot in November.'),
];
const chunk: TranscriptChunk = { index: 0, segments, segmentIds: new Set(segments.map((s) => s.id)), tokenEstimate: 100 };
const otherChunk: TranscriptChunk = { index: 1, segments: [seg('s9', 'Kofi', 'Please call the bursar tomorrow morning.')], segmentIds: new Set(['s9']), tokenEstimate: 10 };

const ctx: ValidationContext = {
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', promptVersion: 'mi_extract_v1',
  meetingIso: '2026-10-07T10:00:00.000Z', timeZone: 'Africa/Accra', timeZoneSource: 'workspace',
  injectionFlagged: false, owners: [{ name: 'Ama Mensah', participantId: 'p1', userId: 'u1' }, { name: 'Kofi Boateng', participantId: 'p2' }],
  nowIso: '2026-10-07T12:00:00.000Z',
};

const commitment = {
  type: 'commitment', text: 'Send the revised quote', ownerName: 'Ama', dueText: 'by Friday', confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote by Friday' }],
};

describe('validateExtraction', () => {
  it('keeps a well-evidenced item with resolved owner and date; stored shape is valid', () => {
    const r = validateExtraction([{ chunk, rawOutput: { items: [commitment] } }], ctx);
    expect(r.kept).toBe(1);
    const item = r.items[0];
    expect(MeetingItemSchema.parse(item)).toBeTruthy();
    expect(item.owner).toMatchObject({ name: 'Ama Mensah', userId: 'u1', matched: true });
    expect(item.dueDate).toMatchObject({ iso: '2026-10-09', resolvedFrom: 'by Friday', timeZone: 'Africa/Accra', timeZoneSource: 'workspace' });
    expect(item.dueIso).toBe('2026-10-09');
    expect(item.needsReview).toBe(false);
  });

  it('drops a fabricated quote, a foreign segment id, a short quote and malformed items, counting each', () => {
    const r = validateExtraction([{ chunk, rawOutput: { items: [
      { ...commitment, text: 'Give a 50% discount', evidence: [{ segmentIds: ['s1'], quote: 'we give a fifty percent discount' }] },
      { ...commitment, text: 'Call the bursar', evidence: [{ segmentIds: ['s9'], quote: 'call the bursar tomorrow' }] },
      { ...commitment, text: 'Quote', evidence: [{ segmentIds: ['s1'], quote: 'by Friday' }] },
      { type: 'not_a_type', text: 'x', confidence: 2 },
      'garbage',
    ] } }, { chunk: otherChunk, rawOutput: 'not an object' }], ctx);
    expect(r.kept).toBe(0);
    expect(r.dropped).toMatchObject({ quote_not_found: 1, unknown_segment: 1, quote_too_short: 1, schema: 3 });
  });

  it('merges the same item seen in two overlapping chunks', () => {
    const overlap: TranscriptChunk = { ...chunk, index: 1 };
    const r = validateExtraction([
      { chunk, rawOutput: { items: [commitment] } },
      { chunk: overlap, rawOutput: { items: [{ ...commitment, confidence: 0.95, evidence: [{ segmentIds: ['s1'], quote: 'I will send the revised quote' }] }] } },
    ], ctx);
    expect(r.kept).toBe(1);
    expect(r.dropped.duplicate).toBe(1);
    expect(r.items[0].confidence).toBe(0.95);
    expect(r.items[0].evidence).toHaveLength(2);
  });

  it('flags review: low confidence, injection-flagged transcript, ambiguous amount, default time zone', () => {
    const amount = { type: 'buying_signal', text: 'Budget of 5000 for the pilot', amountValue: 5000, amountCurrency: '$', confidence: 0.9, evidence: [{ segmentIds: ['s2'], quote: 'the budget is 5000 cedis' }] };
    const low = { ...commitment, confidence: 0.4 };
    const r = validateExtraction([{ chunk, rawOutput: { items: [amount, low] } }], { ...ctx, timeZoneSource: 'default' });
    const byType = new Map(r.items.map((i) => [i.type, i]));
    expect(byType.get('buying_signal')?.reviewReasons).toEqual(['ambiguous_amount']);
    expect(byType.get('commitment')?.reviewReasons).toEqual(['low_confidence', 'default_time_zone']);
    const injected = validateExtraction([{ chunk, rawOutput: { items: [commitment] } }], { ...ctx, injectionFlagged: true });
    expect(injected.items[0].reviewReasons).toEqual(['injection_flagged']);
    expect(r.needsReview).toBe(2);
  });

  it('keeps an unresolvable deadline out of the item; an unknown owner stays unmatched (not a review reason)', () => {
    const r = validateExtraction([{ chunk, rawOutput: { items: [{ ...commitment, ownerName: 'Yaw', dueText: 'sometime soon' }] } }], ctx);
    expect(r.items[0].dueDate).toBeUndefined();
    expect(r.items[0].owner).toEqual({ name: 'Yaw', matched: false });
    expect(r.items[0].needsReview).toBe(false);
  });

  it('links contradicting decisions and keeps both', () => {
    const r = validateExtraction([{ chunk, rawOutput: { items: [
      { type: 'decision', text: 'Launch the pilot in November', confidence: 0.9, evidence: [{ segmentIds: ['s3'], quote: 'launch the pilot in November' }] },
      { type: 'decision', text: 'Do not launch the pilot in November', confidence: 0.9, evidence: [{ segmentIds: ['s4'], quote: 'we will not launch the pilot' }] },
    ] } }], ctx);
    expect(r.kept).toBe(2);
    expect(r.items[0].contradicts).toEqual([r.items[1].itemHash]);
    expect(r.items[1].contradicts).toEqual([r.items[0].itemHash]);
  });

  it('caps items per meeting', () => {
    const many = Array.from({ length: MAX_ITEMS_PER_MEETING + 5 }, (_, i) => ({ ...commitment, text: `Send the revised quote ${i}` }));
    const r = validateExtraction([{ chunk, rawOutput: { items: many.slice(0, 60) } }, { chunk: { ...chunk, index: 1 }, rawOutput: { items: many.slice(60, 120) } },
      { chunk: { ...chunk, index: 2 }, rawOutput: { items: many.slice(120, 180) } }, { chunk: { ...chunk, index: 3 }, rawOutput: { items: many.slice(180) } }], ctx);
    expect(r.kept).toBe(MAX_ITEMS_PER_MEETING);
    expect(r.dropped.over_limit).toBe(5);
  });

  it('is deterministic (re-validating stored checkpoints gives identical items)', () => {
    const { chunks } = chunkTranscript(segments);
    const input = [{ chunk: chunks[0], rawOutput: { items: [commitment] } }];
    expect(validateExtraction(input, ctx)).toEqual(validateExtraction(input, ctx));
  });
});

describe('validateSummary', () => {
  it('keeps sentences citing known items; drops invented ones; null when nothing survives', () => {
    const items = [{ itemHash: 'it_a' }, { itemHash: 'it_b' }];
    const s = validateSummary({ sentences: [
      { text: 'Ama will send the quote.', itemIds: ['it_a'] },
      { text: 'They agreed a discount.', itemIds: ['it_zzz'] },
      { text: 'No citation.', itemIds: [] },
    ] }, items);
    expect(s).toEqual({ sentences: [{ text: 'Ama will send the quote.', itemHashes: ['it_a'] }], dropped: 2 });
    expect(validateSummary({ sentences: [{ text: 'x', itemIds: ['nope'] }] }, items)).toBeNull();
    expect(validateSummary(null, items)).toBeNull();
  });
});
