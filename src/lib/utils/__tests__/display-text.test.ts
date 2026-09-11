import { describe, it, expect } from 'vitest';
import { toDisplayText, DISPLAY_TEXT_CACHE_LIMIT } from '../display-text';

/**
 * Covers `toDisplayText` — the single helper every *text* sink uses before printing
 * author-authored copy (stepper labels, sample-file copy, analytics labels).
 *
 * These assertions import the shipped symbol on purpose. Two older survey suites in
 * this repo assert against logic re-implemented inside the test file, which is why a
 * regression in the real function could pass CI. Do not copy that pattern here.
 */
describe('toDisplayText', () => {
  describe('empty and non-string input', () => {
    it('returns an empty string for null, undefined and empty input', () => {
      expect(toDisplayText(null)).toBe('');
      expect(toDisplayText(undefined)).toBe('');
      expect(toDisplayText('')).toBe('');
    });

    it('returns an empty string for whitespace-only input', () => {
      expect(toDisplayText('   \n\t  ')).toBe('');
    });
  });

  describe('plain text passthrough', () => {
    it('leaves clean text untouched', () => {
      expect(toDisplayText('Upload Staff Data')).toBe('Upload Staff Data');
    });

    it('preserves punctuation and non-ASCII characters', () => {
      expect(toDisplayText('Fees — Term 1 (GH₵)')).toBe('Fees — Term 1 (GH₵)');
    });
  });

  describe('markup stripping', () => {
    // The exact payload that leaked into the production stepper: a rich-text section
    // title pasted from Word/Google Docs, rendered into a text sink.
    it('strips the Word-paste span that leaked into the stepper', () => {
      const pasted = '<span style="color: rgb(15, 23, 42)">Upload Staff Data</span>';
      expect(toDisplayText(pasted)).toBe('Upload Staff Data');
    });

    it('strips nested inline markup and keeps the text', () => {
      expect(toDisplayText('<p><strong>Parent</strong> &amp; <em>Student</em> Data</p>')).toBe(
        'Parent & Student Data',
      );
    });

    it('returns an empty string when the input is markup only', () => {
      expect(toDisplayText('<span></span>')).toBe('');
      expect(toDisplayText('<div><br /></div>')).toBe('');
    });

    it('removes style and script blocks along with their contents', () => {
      expect(toDisplayText('<style>.x{color:red}</style>Online Presence')).toBe('Online Presence');
      expect(toDisplayText('<script>alert(1)</script>Safe')).toBe('Safe');
    });
  });

  describe('double-encoded markup', () => {
    // Decoding entities can resurrect tags as literal text. Left unhandled, a
    // double-encoded paste would still print "<span ...>" on the page, which is the
    // very thing this helper exists to prevent.
    it('does not print tags that reappear after entity decoding', () => {
      const doubleEncoded = '&lt;span style="color: rgb(15, 23, 42)"&gt;Upload Staff Data&lt;/span&gt;';
      expect(toDisplayText(doubleEncoded)).toBe('Upload Staff Data');
    });

    it('never returns a string containing an angle-bracket tag', () => {
      const hostile = '&lt;script&gt;alert(1)&lt;/script&gt;';
      expect(toDisplayText(hostile)).not.toMatch(/<[^>]+>/);
    });
  });

  describe('whitespace normalisation', () => {
    it('collapses runs of spaces and tabs', () => {
      expect(toDisplayText('Staff    \t  Data')).toBe('Staff Data');
    });

    it('collapses non-breaking spaces', () => {
      expect(toDisplayText('Staff&nbsp;&nbsp;Data')).toBe('Staff Data');
    });

    it('flattens newlines so single-line sinks cannot break their layout', () => {
      expect(toDisplayText('Staff\n\n\nData')).toBe('Staff Data');
    });
  });

  describe('idempotence', () => {
    it('is a no-op when applied to its own output', () => {
      const once = toDisplayText('<span style="color: rgb(1,2,3)">Upload&nbsp;Staff Data</span>');
      expect(toDisplayText(once)).toBe(once);
    });
  });

  describe('memoisation', () => {
    it('returns an identical result for a repeated input', () => {
      const input = '<b>Parent Student Data</b>';
      expect(toDisplayText(input)).toBe(toDisplayText(input));
    });

    // The cache is bounded so a survey with many distinct labels cannot grow it without
    // limit. Eviction must never corrupt a result, so verify correctness across a run
    // that comfortably overflows the cap, then re-check an early (evicted) entry.
    it('stays correct after the cache overflows its limit', () => {
      const first = '<i>Section 0</i>';
      expect(toDisplayText(first)).toBe('Section 0');

      for (let i = 1; i <= DISPLAY_TEXT_CACHE_LIMIT + 50; i += 1) {
        expect(toDisplayText(`<i>Section ${i}</i>`)).toBe(`Section ${i}`);
      }

      expect(toDisplayText(first)).toBe('Section 0');
    });
  });
});
