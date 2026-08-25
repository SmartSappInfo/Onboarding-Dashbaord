import { describe, it, expect } from 'vitest';
import { analyzeConversationDynamics } from '../speech-coach-service';
import type { TranscriptSegment, TranscriptSpeaker } from '../types/intelligence';

describe('AI Meeting Speech Coach Service', () => {
  it('calculates balanced talk ratio, pacing, and questions count', () => {
    const speakers: TranscriptSpeaker[] = [
      { id: 'spk_1', name: 'Alice Host', isHost: true },
      { id: 'spk_2', name: 'Bob Client', isHost: false },
    ];

    const segments: TranscriptSegment[] = [
      { id: 'seg_1', speakerId: 'spk_1', speakerName: 'Alice Host', startMs: 0, endMs: 30000, text: 'Welcome Bob! How are you doing today and what challenges are you looking to solve?' },
      { id: 'seg_2', speakerId: 'spk_2', speakerName: 'Bob Client', startMs: 30000, endMs: 60000, text: 'We are struggling with our onboarding pipeline and student drop-off rate.' },
    ];

    const result = analyzeConversationDynamics(segments, speakers, 'm1', 'w1');

    expect(result.talkToListenRatio.hostPercentage).toBe(50);
    expect(result.talkToListenRatio.evaluation).toBe('optimal');
    expect(result.questionsDetectedCount).toBeGreaterThanOrEqual(1);
    expect(result.overallCoachScore).toBeGreaterThanOrEqual(80);
  });

  it('handles empty segments safely without NaN or crash', () => {
    const result = analyzeConversationDynamics([], [], 'm2', 'w1');
    expect(result.overallCoachScore).toBe(75);
    expect(result.talkToListenRatio.hostPercentage).toBe(50);
  });
});
