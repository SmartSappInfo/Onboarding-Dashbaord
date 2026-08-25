/**
 * @fileoverview Pure Transcript Utilities & Search Service.
 * Handles speaker turn grouping, fuzzy text filtering, and millisecond time formatting.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Handles contiguous segments from the same speaker by grouping into conversation turns.
 */

import type { TranscriptSegment } from './types/intelligence';

/**
 * Formats milliseconds into a clean MM:SS or HH:MM:SS timestamp string for video playback seeking.
 */
export function formatTimestampMs(ms: number): string {
  if (isNaN(ms) || ms <= 0) return '00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedMins = minutes.toString().padStart(2, '0');
  const formattedSecs = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    const formattedHours = hours.toString().padStart(2, '0');
    return `${formattedHours}:${formattedMins}:${formattedSecs}`;
  }

  return `${formattedMins}:${formattedSecs}`;
}

export interface SpeakerTurn {
  speakerId: string;
  speakerName: string;
  startMs: number;
  endMs: number;
  text: string;
  segmentIds: string[];
}

/**
 * Groups contiguous transcript segments from the same speaker into cohesive dialogue turns.
 */
export function groupSegmentsBySpeakerTurns(segments: TranscriptSegment[]): SpeakerTurn[] {
  if (!segments || segments.length === 0) return [];

  const turns: SpeakerTurn[] = [];
  let currentTurn: SpeakerTurn = {
    speakerId: segments[0].speakerId,
    speakerName: segments[0].speakerName,
    startMs: segments[0].startMs,
    endMs: segments[0].endMs,
    text: segments[0].text.trim(),
    segmentIds: [segments[0].id],
  };

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];

    if (segment.speakerId === currentTurn.speakerId) {
      // Contiguous from same speaker: extend turn
      currentTurn.endMs = Math.max(currentTurn.endMs, segment.endMs);
      currentTurn.text = `${currentTurn.text} ${segment.text.trim()}`.trim();
      currentTurn.segmentIds.push(segment.id);
    } else {
      turns.push(currentTurn);
      currentTurn = {
        speakerId: segment.speakerId,
        speakerName: segment.speakerName,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text.trim(),
        segmentIds: [segment.id],
      };
    }
  }

  turns.push(currentTurn);
  return turns;
}

/**
 * Searches transcript segments for a given query string (case-insensitive substring match).
 */
export function searchTranscriptSegments(
  segments: TranscriptSegment[],
  searchQuery: string
): TranscriptSegment[] {
  const cleanQuery = searchQuery.trim().toLowerCase();
  if (!cleanQuery) return segments;

  return segments.filter(seg => seg.text.toLowerCase().includes(cleanQuery));
}

/**
 * Computes aggregate transcript statistics (word count, total duration, speaker count).
 */
export function calculateTranscriptStats(segments: TranscriptSegment[]): {
  wordCount: number;
  totalDurationSeconds: number;
  uniqueSpeakerCount: number;
} {
  if (!segments || segments.length === 0) {
    return { wordCount: 0, totalDurationSeconds: 0, uniqueSpeakerCount: 0 };
  }

  let totalWords = 0;
  let maxEndMs = 0;
  const speakers = new Set<string>();

  for (const seg of segments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    totalWords += words.length;
    maxEndMs = Math.max(maxEndMs, seg.endMs);
    if (seg.speakerName) {
      speakers.add(seg.speakerName);
    }
  }

  return {
    wordCount: totalWords,
    totalDurationSeconds: Math.floor(maxEndMs / 1000),
    uniqueSpeakerCount: speakers.size,
  };
}
