import { describe, it, expect } from 'vitest';
import {
  parseSchedulingIntent,
  matchSuggestedSlots,
} from '../ai-scheduling-parser';

describe('AI Scheduling Parser Service', () => {
  it('parses natural language prompts into structured scheduling intent', () => {
    const prompt = 'Schedule a 45 min product demo with client@acme.com next Tuesday afternoon';
    const intent = parseSchedulingIntent(prompt);

    expect(intent.targetDurationMinutes).toBe(45);
    expect(intent.attendeeEmail).toBe('client@acme.com');
    expect(intent.preferredTimeOfDay).toBe('afternoon');
    expect(intent.meetingTitle).toBe('Product Demo');
    expect(intent.intent).toBe('schedule_meeting');
  });

  it('matches and ranks available slots favoring preferred afternoon times', () => {
    const intent = parseSchedulingIntent('30 min quick sync in the afternoon');

    const availableSlots = [
      {
        start: new Date('2026-08-25T09:00:00Z'), // Morning
        end: new Date('2026-08-25T10:00:00Z'),
        hostUserId: 'u1',
        hostName: 'Sarah',
      },
      {
        start: new Date('2026-08-25T14:00:00Z'), // Afternoon -> Higher confidence!
        end: new Date('2026-08-25T15:00:00Z'),
        hostUserId: 'u1',
        hostName: 'Sarah',
      },
    ];

    const suggestions = matchSuggestedSlots(intent, availableSlots);
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].confidenceScore).toBe(0.95);
    expect(suggestions[0].startAt).toContain('14:00:00');
  });
});
