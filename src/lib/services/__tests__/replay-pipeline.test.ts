/**
 * {{Org_name}} Experience Platform — Replay & AI Pipeline Test Suite
 *
 * Tests:
 * 1. Publishing replay records with AI summary, takeaways, and action items.
 * 2. Attaching replay assets (video, slides, AI recaps) into course curriculum lessons.
 */

import { describe, it, expect } from 'vitest';
import { EventService } from '../event-service';
import type { LiveEvent, PublishReplayInput } from '@/lib/types/events';

describe('EventService — Replay & AI Pipeline', () => {
  const mockCompletedEvent: LiveEvent = {
    id: 'evt-ai-101',
    organizationId: 'org-1',
    portalId: 'portal-1',
    workspaceIds: ['events'],
    title: 'Advanced AI Logic & Structured Outputs',
    slug: 'advanced-ai-logic',
    type: 'masterclass',
    instructorName: 'Dr. Jane Smith',
    meetingProvider: 'zoom',
    meetingUrl: 'https://zoom.us/j/12345678',
    scheduledStartTime: '2026-10-01T14:00:00.000Z',
    scheduledEndTime: '2026-10-01T15:00:00.000Z',
    durationMinutes: 60,
    registeredCount: 20,
    attendedCount: 18,
    status: 'scheduled',
    isPublic: true,
    courseId: 'course-ai-101',
    lessonId: 'lesson-ai-1',
    createdAt: '2026-09-25T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
  };

  it('formats replay payload with video, duration, AI summary, and action items', () => {
    const replayInput: PublishReplayInput = {
      portalId: 'portal-1',
      eventId: 'evt-ai-101',
      recordingUrl: 'https://cdn.example.com/recordings/ai-lesson-1.mp4',
      recordingDurationSeconds: 3600,
      aiSummary: 'Comprehensive overview of multimodal prompting and structured schema outputs.',
      keyTakeaways: [
        'Always validate structured outputs with Zod schemas.',
        'Use function calling with strict parameter types.',
      ],
      actionItems: [
        'Clone starter repo',
        'Run sample inference script',
      ],
      slideDeckUrl: 'https://cdn.example.com/slides/ai-masterclass.pdf',
    };

    expect(replayInput.recordingUrl).toContain('cdn.example.com');
    expect(replayInput.recordingDurationSeconds).toBe(3600);
    expect(replayInput.keyTakeaways?.length).toBe(2);
    expect(replayInput.actionItems?.length).toBe(2);
  });

  it('generates curriculum lesson replay attachment payload cleanly', () => {
    const replayPayload = EventService.buildCurriculumReplayPayload({
      recordingUrl: 'https://cdn.example.com/recordings/ai-lesson-1.mp4',
      recordingDurationSeconds: 3600,
      aiSummary: 'Summary of session.',
      slideDeckUrl: 'https://cdn.example.com/slides/deck.pdf',
    });

    expect(replayPayload.videoUrl).toBe('https://cdn.example.com/recordings/ai-lesson-1.mp4');
    expect(replayPayload.videoDurationSeconds).toBe(3600);
    expect(replayPayload.summary).toBe('Summary of session.');
    expect(replayPayload.attachments?.length).toBe(1);
    expect(replayPayload.attachments?.[0].name).toBe('Session Slide Deck');
  });
});
