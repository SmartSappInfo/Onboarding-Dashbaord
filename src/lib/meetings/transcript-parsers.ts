/**
 * @fileOverview Transcript parsers: WebVTT, SRT, plain text / paste (Phase 11 M1 · T3, finding G6).
 *
 * Pure functions, no I/O, no new dependency (Rule 53). DOCX is converted to text by
 * `docx-guard.ts` and then parsed here as plain text.
 *
 * GUARANTEES (property-tested)
 * - Never throws an unexpected error on arbitrary input: malformed input yields a
 *   `TranscriptParseError` with a plain-English message, or fewer segments.
 * - Output text is PLAIN TEXT: cue markup (`<v>`, `<b>`, `<c.x>`, timestamps, any tag) is removed and
 *   basic entities decoded. Nothing here produces HTML; the UI renders segments as text (Rule 8).
 * - Segments are sorted by start time (stable), ids are sequential, every text ≤ MAX_SEGMENT_TEXT
 *   (longer cues are split), and endMs ≥ startMs.
 * - Untimed text gets estimated times (150 words per minute) so ordering is preserved; `timed: false`
 *   tells callers the times are estimates.
 *
 * CAUTION: content is untrusted customer data. Do not "helpfully" interpret instructions found in
 * it; this module only restructures text.
 *
 * Tests: src/lib/meetings/__tests__/transcript-parsers.test.ts
 */

import { MAX_SEGMENT_TEXT, type TranscriptSegmentV2, type TranscriptSpeakerV2 } from './transcript-store';

export type TranscriptFormat = 'vtt' | 'srt' | 'txt';

export interface ParsedTranscript {
  format: TranscriptFormat;
  segments: TranscriptSegmentV2[];
  speakers: TranscriptSpeakerV2[];
  timed: boolean;
  warnings: string[];
}

export class TranscriptParseError extends Error {
  readonly code = 'VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptParseError';
  }
}

const UNKNOWN_SPEAKER = 'Speaker 1';
const WORDS_PER_MINUTE = 150;

/** A cue before normalization (shared with model-produced transcripts, M1 · T4). */
export interface RawCue {
  startMs: number | null;
  endMs: number | null;
  speaker: string | null;
  text: string;
}

/** Strips BOM, normalizes newlines and removes control characters except newline/tab. */
export function normalizeTranscriptText(raw: string): string {
  return raw
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function detectTranscriptFormat(text: string, fileName?: string): TranscriptFormat {
  const ext = fileName?.toLowerCase().split('.').pop();
  if (ext === 'vtt' || /^WEBVTT/.test(text.trimStart())) return 'vtt';
  if (ext === 'srt' || /^\s*\d+\s*\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(text)) return 'srt';
  return 'txt';
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'", '&lrm;': '', '&rlm;': '' };

function cleanCueText(text: string): { speaker: string | null; text: string } {
  let speaker: string | null = null;
  const voice = /<v(?:\.[^\s>]*)?\s+([^>]+)>/i.exec(text);
  if (voice) speaker = voice[1].trim();
  const plain = text
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|nbsp|quot|#39|lrm|rlm);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  return { speaker, text: plain };
}

/** "Name: text" prefix (≤ 60 chars, no digits-only names, not a URL scheme). */
function splitSpeakerPrefix(text: string): { speaker: string | null; text: string } {
  const m = /^([^:\n]{1,60}?):\s+([\s\S]+)$/.exec(text);
  if (!m) return { speaker: null, text };
  const name = m[1].trim();
  if (!name || /^\d+$/.test(name) || /^(https?|mailto|tel)$/i.test(name) || /^\d{1,2}$/.test(name)) return { speaker: null, text };
  return { speaker: name, text: m[2].trim() };
}

/** Parses "hh:mm:ss.mmm", "mm:ss.mmm" or with "," decimal. Returns null when invalid. */
export function parseTimestamp(value: string): number | null {
  const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!m) return null;
  const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (min > 59 || s > 59) return null;
  const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  return ((h * 60 + min) * 60 + s) * 1000 + ms;
}

const TIMING = /^\s*(\S+)\s*-->\s*(\S+)/;

function parseCueBlocks(text: string, format: 'vtt' | 'srt', warnings: string[]): RawCue[] {
  const cues: RawCue[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;
    if (format === 'vtt' && /^(WEBVTT|NOTE|STYLE|REGION)\b/.test(lines[0])) continue;

    const timingIndex = lines.findIndex((l) => TIMING.test(l));
    if (timingIndex === -1 || timingIndex > 1) {
      warnings.push('Skipped a block without a valid time line.');
      continue;
    }
    const [, startRaw, endRaw] = TIMING.exec(lines[timingIndex]) ?? [];
    const startMs = parseTimestamp(startRaw ?? '');
    const endMs = parseTimestamp(endRaw ?? '');
    if (startMs === null || endMs === null) {
      warnings.push('Skipped a cue with an unreadable time.');
      continue;
    }
    const cleaned = cleanCueText(lines.slice(timingIndex + 1).join('\n'));
    const prefixed = cleaned.speaker ? { speaker: cleaned.speaker, text: cleaned.text } : splitSpeakerPrefix(cleaned.text);
    if (!prefixed.text) continue;
    cues.push({ startMs, endMs: Math.max(startMs, endMs), speaker: prefixed.speaker, text: prefixed.text });
  }
  return cues;
}

const TXT_TIME_PREFIX = /^\[?((?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]?\s*[-–]?\s*/;

function parseTxt(text: string): RawCue[] {
  const cues: RawCue[] = [];
  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    let startMs: number | null = null;
    const time = TXT_TIME_PREFIX.exec(line);
    if (time) {
      startMs = parseTimestamp(time[1]);
      if (startMs !== null) line = line.slice(time[0].length);
    }
    const { speaker, text: body } = splitSpeakerPrefix(line);
    const clean = cleanCueText(body).text;
    if (!clean) continue;
    const previous = cues[cues.length - 1];
    if (!speaker && startMs === null && previous) {
      // Continuation of the previous speaker's turn.
      previous.text = `${previous.text} ${clean}`;
      continue;
    }
    cues.push({ startMs, endMs: null, speaker, text: clean });
  }
  return cues;
}

function wordsIn(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Splits text at word boundaries into pieces of at most `max` characters. */
function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const piece = word.length > max ? word.slice(0, max) : word;
    if ((current ? current.length + 1 : 0) + piece.length > max) {
      if (current) parts.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Normalizes cues into sorted, sized, speaker-mapped segments. Shared by file parsing and by
 * transcription output so both obey the same invariants (one implementation, Rule 7).
 */
export function buildParsedTranscript(format: TranscriptFormat, cues: RawCue[], warnings: string[]): ParsedTranscript {
  if (cues.length === 0) throw new TranscriptParseError('This file has no transcript text.');

  const timed = cues.every((c) => c.startMs !== null);
  // Estimate missing times from word counts so order and rough position survive.
  let clock = 0;
  const timedCues = cues.map((c) => {
    const estimate = Math.round((wordsIn(c.text) / WORDS_PER_MINUTE) * 60_000);
    const startMs = c.startMs ?? clock;
    const endMs = c.endMs ?? startMs + Math.max(estimate, 500);
    clock = Math.max(clock, endMs);
    return { ...c, startMs, endMs };
  });

  const ordered = timedCues
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.startMs - b.c.startMs || a.i - b.i)
    .map(({ c }) => c);

  const speakerIds = new Map<string, string>();
  const speakers: TranscriptSpeakerV2[] = [];
  const idFor = (name: string): string => {
    const key = name.toLowerCase();
    let id = speakerIds.get(key);
    if (!id) {
      id = `sp${speakerIds.size + 1}`;
      speakerIds.set(key, id);
      speakers.push({ id, name: name.slice(0, 200) });
    }
    return id;
  };

  const segments: TranscriptSegmentV2[] = [];
  for (const cue of ordered) {
    const name = cue.speaker ?? UNKNOWN_SPEAKER;
    const speakerId = idFor(name);
    const pieces = splitLong(cue.text, MAX_SEGMENT_TEXT);
    const span = Math.max(0, cue.endMs - cue.startMs);
    pieces.forEach((text, p) => {
      const startMs = cue.startMs + Math.floor((span * p) / pieces.length);
      const endMs = cue.startMs + Math.floor((span * (p + 1)) / pieces.length);
      segments.push({ id: `s${segments.length}`, speakerId, speakerName: name.slice(0, 200), startMs, endMs: Math.max(startMs, endMs), text });
    });
  }

  return { format, segments, speakers, timed, warnings };
}

/** Parses transcript text in the given (or detected) format. */
export function parseTranscriptText(raw: string, options?: { fileName?: string; format?: TranscriptFormat }): ParsedTranscript {
  const text = normalizeTranscriptText(raw);
  if (!text.trim()) throw new TranscriptParseError('This file has no transcript text.');
  const format = options?.format ?? detectTranscriptFormat(text, options?.fileName);
  const warnings: string[] = [];
  const cues = format === 'txt' ? parseTxt(text) : parseCueBlocks(text, format, warnings);
  return buildParsedTranscript(format, cues, warnings.slice(0, 20));
}
