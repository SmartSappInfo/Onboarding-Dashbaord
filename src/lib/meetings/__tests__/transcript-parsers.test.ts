// @vitest-environment node
/**
 * @fileOverview Transcript parsers (Phase 11 M1 · T3.1).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  detectTranscriptFormat,
  parseTimestamp,
  parseTranscriptText,
  TranscriptParseError,
} from '../transcript-parsers';
import { MAX_SEGMENT_TEXT, TranscriptSegmentSchema } from '../transcript-store';

const VTT = `﻿WEBVTT\r
\r
NOTE recorded on Meet\r
\r
1\r
00:00:01.000 --> 00:00:04.500 align:start\r
<v Ama Mensah>Good morning, <b>everyone</b> &amp; welcome.\r
\r
00:00:05.000 --> 00:00:07.000\r
<v.loud Kwame>Thanks.\r
We can start.\r
\r
00:00:08.000 --> 00:00:09.000\r
Kwame: Pricing <script>alert(1)</script>works.\r
`;

const SRT = `1
00:00:01,000 --> 00:00:02,500
Ama: Hello there

3
00:00:03,000 --> 00:00:04,000
Kwame: Hi

4
garbage --> line
Bad cue
`;

describe('format detection and timestamps', () => {
  it('detects by extension or content', () => {
    expect(detectTranscriptFormat('WEBVTT\n\n')).toBe('vtt');
    expect(detectTranscriptFormat('1\n00:00:01,000 --> 00:00:02,000\nhi')).toBe('srt');
    expect(detectTranscriptFormat('Ama: hi', 'notes.TXT')).toBe('txt');
    expect(detectTranscriptFormat('Ama: hi', 'call.vtt')).toBe('vtt');
  });

  it('parses hh:mm:ss.mmm, mm:ss and comma decimals; rejects nonsense', () => {
    expect(parseTimestamp('01:02:03.004')).toBe(3_723_004);
    expect(parseTimestamp('02:03,5')).toBe(123_500);
    expect(parseTimestamp('00:61:00.000')).toBeNull();
    expect(parseTimestamp('abc')).toBeNull();
  });
});

describe('VTT', () => {
  it('handles BOM, CRLF, NOTE blocks, cue ids, settings, voice tags, markup and entities', () => {
    const r = parseTranscriptText(VTT);
    expect(r.format).toBe('vtt');
    expect(r.timed).toBe(true);
    expect(r.speakers.map((s) => s.name)).toEqual(['Ama Mensah', 'Kwame']);
    expect(r.segments.map((s) => [s.speakerName, s.text, s.startMs, s.endMs])).toEqual([
      ['Ama Mensah', 'Good morning, everyone & welcome.', 1000, 4500],
      ['Kwame', 'Thanks. We can start.', 5000, 7000],
      ['Kwame', 'Pricing alert(1)works.', 8000, 9000],
    ]);
    for (const s of r.segments) expect(s.text).not.toMatch(/[<>]/);
  });
});

describe('SRT', () => {
  it('parses numbered cues with numbering gaps and skips broken cues with a warning', () => {
    const r = parseTranscriptText(SRT);
    expect(r.format).toBe('srt');
    expect(r.segments.map((s) => `${s.speakerName}|${s.text}`)).toEqual(['Ama|Hello there', 'Kwame|Hi']);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('plain text and paste', () => {
  it('reads speaker lines, continuation lines and optional time prefixes', () => {
    const r = parseTranscriptText('[00:00:05] Ama: Hello\nhow are you?\n00:10 Kwame: Fine\nKwame: Thanks');
    expect(r.format).toBe('txt');
    expect(r.segments.map((s) => `${s.speakerName}|${s.text}`)).toEqual(['Ama|Hello how are you?', 'Kwame|Fine', 'Kwame|Thanks']);
    expect(r.segments[0].startMs).toBe(5000);
  });

  it('untimed text gets ordered estimated times and timed=false', () => {
    const r = parseTranscriptText('We discussed fees.\n\nThen enrollment numbers for next term.');
    expect(r.timed).toBe(false);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].speakerName).toBe('Speaker 1');
  });

  it('does not treat URLs or times as speaker names', () => {
    const r = parseTranscriptText('https://example.com/x is the link');
    expect(r.segments[0].speakerName).toBe('Speaker 1');
  });

  it('splits overlong turns to fit the segment limit', () => {
    const r = parseTranscriptText(`Ama: ${'word '.repeat(3000)}`);
    expect(r.segments.length).toBeGreaterThan(1);
    for (const s of r.segments) expect(s.text.length).toBeLessThanOrEqual(MAX_SEGMENT_TEXT);
  });

  it('refuses empty input with a plain message', () => {
    expect(() => parseTranscriptText('  \n﻿  ')).toThrow(TranscriptParseError);
    expect(() => parseTranscriptText('WEBVTT\n\nNOTE only a note')).toThrow('This file has no transcript text.');
  });
});

describe('properties', () => {
  it('never throws anything but TranscriptParseError, and output always satisfies the segment schema', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), fc.constantFrom<'vtt' | 'srt' | 'txt' | undefined>('vtt', 'srt', 'txt', undefined), (input, format) => {
        try {
          const r = parseTranscriptText(input, format ? { format } : undefined);
          let last = -1;
          for (const s of r.segments) {
            expect(TranscriptSegmentSchema.safeParse(s).success).toBe(true);
            expect(s.startMs).toBeGreaterThanOrEqual(last);
            expect(s.endMs).toBeGreaterThanOrEqual(s.startMs);
            last = s.startMs;
          }
        } catch (err) {
          expect(err).toBeInstanceOf(TranscriptParseError);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('timed cues come out sorted regardless of input order', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3_599 }), { minLength: 1, maxLength: 40 }), (starts) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const ts = (sec: number) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}.000`;
        const vtt = 'WEBVTT\n\n' + starts.map((s, i) => `${ts(s)} --> ${ts(s)}\nA: line ${i}`).join('\n\n');
        const r = parseTranscriptText(vtt);
        const out = r.segments.map((s) => s.startMs);
        expect(out).toEqual([...out].sort((a, b) => a - b));
        expect(r.segments).toHaveLength(starts.length);
      }),
      { numRuns: 100 }
    );
  });
});
