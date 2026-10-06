// @vitest-environment node
/**
 * @fileOverview Meeting intelligence pure modules (Phase 11 M2 · T3.1): property + example tests.
 * Chunker, evidence validator, date resolver, amounts, owner mapping, itemHash, contradictions.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { TranscriptSegmentV2 } from '../transcript-store';
import { chunkTranscript } from '../intelligence/chunker';
import { validateEvidence, validateItemEvidence } from '../intelligence/evidence';
import { localDate, resolveDuePhrase } from '../intelligence/date-resolver';
import { normalizeAmount } from '../intelligence/amount';
import { mapOwner } from '../intelligence/owner-mapper';
import { itemHash } from '../intelligence/item-hash';
import { linkContradictions } from '../intelligence/contradictions';

const word = fc.stringMatching(/^[a-z]{2,8}$/);
const sentence = fc.array(word, { minLength: 3, maxLength: 30 }).map((w) => w.join(' '));
const segmentsArb = fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), sentence), { minLength: 1, maxLength: 200 }).map((rows) =>
  rows.map(([speaker, text], i): TranscriptSegmentV2 => ({
    id: `s${i}`, speakerId: `sp${speaker}`, speakerName: `Speaker ${speaker}`, startMs: i * 1000, endMs: i * 1000 + 900, text,
  }))
);

describe('chunker', () => {
  it('keeps order, covers every segment (unless truncated), respects the chunk cap and overlaps one turn', () => {
    fc.assert(fc.property(segmentsArb, fc.integer({ min: 60, max: 600 }), fc.integer({ min: 1, max: 25 }), (segments, maxTokens, maxChunks) => {
      const { chunks, truncated, coverage } = chunkTranscript(segments, { maxTokens, maxChunks });
      expect(chunks.length).toBeLessThanOrEqual(maxChunks);
      const order = new Map(segments.map((s, i) => [s.id, i]));
      for (const c of chunks) {
        const idx = c.segments.map((s) => order.get(s.id) ?? -1);
        expect(idx).toEqual([...idx].sort((a, b) => a - b));
      }
      const covered = new Set(chunks.flatMap((c) => c.segments.map((s) => s.id)));
      if (!truncated) {
        expect(covered.size).toBe(segments.length);
        expect(coverage).toBe(1);
      } else {
        expect(coverage).toBeLessThan(1);
      }
      for (let i = 1; i < chunks.length; i += 1) {
        // Each chunk starts at or before the next unseen segment: nothing is skipped between chunks.
        const prevLast = order.get(chunks[i - 1].segments[chunks[i - 1].segments.length - 1].id) ?? -1;
        const nextFirst = order.get(chunks[i].segments[0].id) ?? -1;
        expect(nextFirst).toBeLessThanOrEqual(prevLast + 1);
      }
    }), { numRuns: 150 });
  });

  it('never cuts a turn when turns fit, and repeats the previous last turn at the start of the next chunk', () => {
    const seg = (i: number, speaker: string, words: number): TranscriptSegmentV2 => ({
      id: `s${i}`, speakerId: speaker, speakerName: speaker, startMs: i, endMs: i + 1, text: 'word '.repeat(words).trim(),
    });
    const segments = [seg(0, 'a', 40), seg(1, 'a', 40), seg(2, 'b', 40), seg(3, 'c', 40), seg(4, 'a', 40)];
    // Turns: [s0,s1] ≈112 tokens, then 56 each. With 200 the overlap turn fits beside the next turn.
    const { chunks } = chunkTranscript(segments, { maxTokens: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    // The two-segment turn [s0, s1] is never split across chunks.
    expect(chunks[0].segments.map((s) => s.id).slice(0, 2)).toEqual(['s0', 's1']);
    const lastOfFirst = chunks[0].segments[chunks[0].segments.length - 1];
    expect(chunks[1].segments.map((s) => s.id)).toContain(lastOfFirst.id);
  });

  it('empty transcript → no chunks', () => {
    expect(chunkTranscript([])).toEqual({ chunks: [], truncated: false, coverage: 1 });
  });
});

describe('evidence', () => {
  const index = (segments: TranscriptSegmentV2[]) => ({
    byId: new Map(segments.map((s) => [s.id, s])),
    order: new Map(segments.map((s, i) => [s.id, i])),
  });

  it('any ≥3-word slice of a cited segment validates, whatever the case or punctuation', () => {
    fc.assert(fc.property(segmentsArb, fc.nat(), fc.nat(), (segments, pick, start) => {
      const s = segments[pick % segments.length];
      const words = s.text.split(' ');
      const from = start % Math.max(1, words.length - 2);
      const quote = `"${words.slice(from, from + 3).join(', ').toUpperCase()}!"`;
      const { byId, order } = index(segments);
      expect(validateEvidence({ segmentIds: [s.id], quote }, byId, order)).toEqual({ ok: true });
    }), { numRuns: 200 });
  });

  it('rejects invented quotes, short quotes and foreign segment ids', () => {
    const segments = [
      { id: 's1', speakerId: 'a', speakerName: 'Ama', startMs: 0, endMs: 1, text: 'We will send the revised quote by Friday.' },
      { id: 's2', speakerId: 'b', speakerName: 'Kofi', startMs: 1, endMs: 2, text: 'Great, and include the term billing option.' },
    ];
    const { byId, order } = index(segments);
    expect(validateEvidence({ segmentIds: ['s1'], quote: 'we will give a 50% discount' }, byId, order)).toEqual({ ok: false, reason: 'quote_not_found' });
    expect(validateEvidence({ segmentIds: ['s1'], quote: 'by Friday' }, byId, order)).toEqual({ ok: false, reason: 'quote_too_short' });
    expect(validateEvidence({ segmentIds: ['s9'], quote: 'send the revised quote' }, byId, order)).toEqual({ ok: false, reason: 'unknown_segment' });
    // A quote spanning two adjacent cited segments is fine.
    expect(validateEvidence({ segmentIds: ['s2', 's1'], quote: 'by Friday. Great, and include' }, byId, order)).toEqual({ ok: true });
    // One bad piece of evidence drops the item.
    expect(validateItemEvidence([{ segmentIds: ['s1'], quote: 'send the revised quote' }, { segmentIds: ['x'], quote: 'a b c' }], byId, order).ok).toBe(false);
  });
});

describe('date resolver', () => {
  const at = (iso: string, tz = 'Africa/Accra') => ({ meetingIso: iso, timeZone: tz });
  // Wednesday 2026-10-07 10:00 in Accra (UTC+0).
  const wed = at('2026-10-07T10:00:00.000Z');

  it('resolves common phrases against the meeting date', () => {
    expect(resolveDuePhrase('by Friday', wed)?.iso).toBe('2026-10-09');
    expect(resolveDuePhrase('tomorrow', wed)?.iso).toBe('2026-10-08');
    expect(resolveDuePhrase('end of the week', wed)?.iso).toBe('2026-10-09');
    expect(resolveDuePhrase('end of the month', wed)?.iso).toBe('2026-10-31');
    expect(resolveDuePhrase('next Tuesday', wed)?.iso).toBe('2026-10-13');
    expect(resolveDuePhrase('in two weeks', wed)?.iso).toBe('2026-10-21');
    expect(resolveDuePhrase('12th of November', wed)?.iso).toBe('2026-11-12');
    expect(resolveDuePhrase('March 3', wed)?.iso).toBe('2027-03-03');
    expect(resolveDuePhrase('2026-10-20', wed)?.iso).toBe('2026-10-20');
  });

  it('drops ambiguous, past or unknown phrases', () => {
    expect(resolveDuePhrase('next week', wed)).toBeNull();
    expect(resolveDuePhrase('Wednesday', wed)).toBeNull(); // same weekday as the meeting
    expect(resolveDuePhrase('12/10', wed)).toBeNull();
    expect(resolveDuePhrase('2026-01-01', wed)).toBeNull();
    expect(resolveDuePhrase('soon', wed)).toBeNull();
    expect(resolveDuePhrase('February 30', wed)).toBeNull();
    expect(resolveDuePhrase('by Friday', at('2026-10-07T10:00:00.000Z', 'Not/AZone'))).toBeNull();
  });

  it('uses the local date in the time zone (late evening in Los Angeles is still Tuesday there)', () => {
    // 2026-10-07T03:00Z is Tuesday 2026-10-06 20:00 in Los Angeles.
    expect(resolveDuePhrase('tomorrow', at('2026-10-07T03:00:00.000Z', 'America/Los_Angeles'))?.iso).toBe('2026-10-07');
    expect(resolveDuePhrase('tomorrow', at('2026-10-07T03:00:00.000Z', 'UTC'))?.iso).toBe('2026-10-08');
  });

  it('a weekday resolves to that weekday within the next 1–6 days; "next" lands in the following week', () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    fc.assert(fc.property(fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 0, max: 6 }), (dayOffset, target) => {
      const meeting = new Date(Date.UTC(2026, 0, 1) + dayOffset * 86_400_000);
      const ctx = { meetingIso: meeting.toISOString(), timeZone: 'UTC' };
      const today = localDate(ctx.meetingIso, 'UTC');
      if (!today) throw new Error('no date');
      const plain = resolveDuePhrase(days[target], ctx);
      if (target === today.getUTCDay()) {
        expect(plain).toBeNull();
      } else {
        const d = new Date(`${plain?.iso}T00:00:00Z`);
        expect(d.getUTCDay()).toBe(target);
        const ahead = (d.getTime() - today.getTime()) / 86_400_000;
        expect(ahead).toBeGreaterThanOrEqual(1);
        expect(ahead).toBeLessThanOrEqual(6);
      }
      const next = resolveDuePhrase(`next ${days[target]}`, ctx);
      const n = new Date(`${next?.iso}T00:00:00Z`);
      expect(n.getUTCDay()).toBe(target);
      const aheadNext = (n.getTime() - today.getTime()) / 86_400_000;
      expect(aheadNext).toBeGreaterThanOrEqual(1);
      expect(aheadNext).toBeLessThanOrEqual(13);
    }), { numRuns: 300 });
  });

  it('never returns a date before the meeting or more than a year ahead', () => {
    const phrases = fc.constantFrom('today', 'tomorrow', 'friday', 'next monday', 'end of the month', 'in 3 days', 'in 10 weeks', 'january 5', '31 december', 'end of the week');
    fc.assert(fc.property(fc.integer({ min: 0, max: 3000 }), phrases, (dayOffset, phrase) => {
      const meetingIso = new Date(Date.UTC(2026, 0, 1) + dayOffset * 86_400_000).toISOString();
      const r = resolveDuePhrase(phrase, { meetingIso, timeZone: 'UTC' });
      if (!r) return;
      const ahead = (Date.parse(`${r.iso}T00:00:00Z`) - Date.parse(meetingIso.slice(0, 10))) / 86_400_000;
      expect(ahead).toBeGreaterThanOrEqual(0);
      expect(ahead).toBeLessThanOrEqual(366);
    }), { numRuns: 300 });
  });
});

describe('amounts', () => {
  it('needs a known currency; shared symbols are ambiguous, never guessed', () => {
    expect(normalizeAmount(5000, 'ghs')).toEqual({ value: 5000, currency: 'GHS', ambiguous: false });
    expect(normalizeAmount(5000, 'GH₵')).toEqual({ value: 5000, currency: 'GHS', ambiguous: false });
    expect(normalizeAmount(200, '€')).toEqual({ value: 200, currency: 'EUR', ambiguous: false });
    expect(normalizeAmount(200, '$')).toEqual({ value: 200, currency: null, ambiguous: true });
    expect(normalizeAmount(200, 'dollars')).toEqual({ value: 200, currency: null, ambiguous: true });
    expect(normalizeAmount(200, undefined)).toEqual({ value: 200, currency: null, ambiguous: true });
    expect(normalizeAmount(-1, 'USD')).toBeUndefined();
    expect(normalizeAmount(undefined, 'USD')).toBeUndefined();
  });
});

describe('owner mapping', () => {
  const people = [
    { name: 'Ama Mensah', participantId: 'p1', userId: 'u1' },
    { name: 'Kofi Boateng', participantId: 'p2' },
    { name: 'Kofi Asante', participantId: 'p3' },
  ];
  it('matches a full name or a unique first name; ambiguous or unknown stays unmatched', () => {
    expect(mapOwner('ama mensah', people)).toEqual({ name: 'Ama Mensah', participantId: 'p1', userId: 'u1', matched: true });
    expect(mapOwner('Ama', people)).toMatchObject({ participantId: 'p1', matched: true });
    expect(mapOwner('Kofi', people)).toEqual({ name: 'Kofi', matched: false });
    expect(mapOwner('Kofi Asante', people)).toMatchObject({ participantId: 'p3', matched: true });
    expect(mapOwner('Yaw Darko', people)).toEqual({ name: 'Yaw Darko', matched: false });
    expect(mapOwner(undefined, people)).toBeUndefined();
  });
});

describe('itemHash', () => {
  it('is stable under case, punctuation and spacing; type, owner and date change it', () => {
    fc.assert(fc.property(sentence, (text) => {
      const a = itemHash({ type: 'commitment', text, ownerName: 'Ama', dueIso: '2026-10-09' });
      const b = itemHash({ type: 'commitment', text: `  ${text.toUpperCase()}!! `, ownerName: 'AMA', dueIso: '2026-10-09' });
      expect(a).toBe(b);
      expect(itemHash({ type: 'decision', text, ownerName: 'Ama', dueIso: '2026-10-09' })).not.toBe(a);
      expect(itemHash({ type: 'commitment', text, ownerName: 'Kofi', dueIso: '2026-10-09' })).not.toBe(a);
      expect(itemHash({ type: 'commitment', text, ownerName: 'Ama', dueIso: '2026-10-10' })).not.toBe(a);
    }), { numRuns: 100 });
  });
});

describe('contradictions', () => {
  it('links a reversed decision and differing deadlines; keeps unrelated items apart', () => {
    const links = linkContradictions([
      { itemHash: 'h1', type: 'decision', text: 'We will launch the pilot in November' },
      { itemHash: 'h2', type: 'decision', text: 'We will not launch the pilot in November' },
      { itemHash: 'h3', type: 'commitment', text: 'Send the revised quote to Ama', dueIso: '2026-10-09' },
      { itemHash: 'h4', type: 'commitment', text: 'Send revised quote to Ama', dueIso: '2026-10-13' },
      { itemHash: 'h5', type: 'commitment', text: 'Book the venue for training' },
      { itemHash: 'h6', type: 'topic', text: 'We will not launch the pilot in November' },
    ]);
    expect(links.get('h1')).toEqual(['h2']);
    expect(links.get('h2')).toEqual(['h1']);
    expect(links.get('h3')).toEqual(['h4']);
    expect(links.has('h5')).toBe(false);
    expect(links.has('h6')).toBe(false);
  });
});
