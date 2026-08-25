import { describe, it, expect } from 'vitest';
import {
  formatTimestampMs,
  groupSegmentsBySpeakerTurns,
  searchTranscriptSegments,
  calculateTranscriptStats,
} from '../transcript-service';
import type { TranscriptSegment } from '../types/intelligence';

describe('Transcript Processing & Search Service', () => {
  it('formats millisecond timestamps into MM:SS and HH:MM:SS strings', () => {
    expect(formatTimestampMs(0)).toBe('00:00');
    expect(formatTimestampMs(65000)).toBe('01:05');
    expect(formatTimestampMs(3665000)).toBe('01:01:05');
  });

  it('groups contiguous segments from the same speaker into dialogue turns', () => {
    const segments: TranscriptSegment[] = [
      { id: 's1', speakerId: 'u1', speakerName: 'Alice', startMs: 0, endMs: 2000, text: 'Hello everyone.' },
      { id: 's2', speakerId: 'u1', speakerName: 'Alice', startMs: 2100, endMs: 5000, text: 'Welcome to the demo.' },
      { id: 's3', speakerId: 'u2', speakerName: 'Bob', startMs: 5500, endMs: 9000, text: 'Thanks Alice, excited to be here.' },
      { id: 's4', speakerId: 'u1', speakerName: 'Alice', startMs: 9500, endMs: 12000, text: 'Let us begin.' },
    ];

    const turns = groupSegmentsBySpeakerTurns(segments);
    expect(turns).toHaveLength(3);

    // Turn 1: Alice (combining s1 and s2)
    expect(turns[0].speakerName).toBe('Alice');
    expect(turns[0].text).toBe('Hello everyone. Welcome to the demo.');
    expect(turns[0].startMs).toBe(0);
    expect(turns[0].endMs).toBe(5000);
    expect(turns[0].segmentIds).toEqual(['s1', 's2']);

    // Turn 2: Bob (s3)
    expect(turns[1].speakerName).toBe('Bob');
    expect(turns[1].text).toBe('Thanks Alice, excited to be here.');

    // Turn 3: Alice (s4)
    expect(turns[2].speakerName).toBe('Alice');
    expect(turns[2].text).toBe('Let us begin.');
  });

  it('searches segments by keyword query', () => {
    const segments: TranscriptSegment[] = [
      { id: 's1', speakerId: 'u1', speakerName: 'Alice', startMs: 0, endMs: 2000, text: 'We need to discuss pricing plans.' },
      { id: 's2', speakerId: 'u2', speakerName: 'Bob', startMs: 2100, endMs: 5000, text: 'Can we customize the enterprise SLA?' },
      { id: 's3', speakerId: 'u1', speakerName: 'Alice', startMs: 5500, endMs: 9000, text: 'Yes, enterprise accounts get 24/7 dedicated support.' },
    ];

    const enterpriseResults = searchTranscriptSegments(segments, 'enterprise');
    expect(enterpriseResults).toHaveLength(2);
    expect(enterpriseResults[0].id).toBe('s2');
    expect(enterpriseResults[1].id).toBe('s3');

    const pricingResults = searchTranscriptSegments(segments, 'pricing');
    expect(pricingResults).toHaveLength(1);
    expect(pricingResults[0].id).toBe('s1');
  });

  it('calculates transcript statistics correctly', () => {
    const segments: TranscriptSegment[] = [
      { id: 's1', speakerId: 'u1', speakerName: 'Alice', startMs: 0, endMs: 10000, text: 'Four simple words here' },
      { id: 's2', speakerId: 'u2', speakerName: 'Bob', startMs: 10000, endMs: 30000, text: 'Another five words added now' },
    ];

    const stats = calculateTranscriptStats(segments);
    expect(stats.wordCount).toBe(9);
    expect(stats.totalDurationSeconds).toBe(30);
    expect(stats.uniqueSpeakerCount).toBe(2);
  });
});
