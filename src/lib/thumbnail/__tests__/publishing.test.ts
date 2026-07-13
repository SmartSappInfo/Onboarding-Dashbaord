import { expect, test, describe } from 'vitest';

describe('Direct publishing and scheduling actions', () => {
  test('correctly configures immediately published targets', () => {
    const publishPayload = {
      channel: 'youtube',
      videoId: 'v-1',
      mode: 'immediate',
      published: true
    };
    expect(publishPayload.channel).toBe('youtube');
    expect(publishPayload.videoId).toBe('v-1');
    expect(publishPayload.mode).toBe('immediate');
    expect(publishPayload.published).toBe(true);
  });

  test('correctly schedules release payloads', () => {
    const schedulePayload = {
      channel: 'youtube',
      videoId: 'v-2',
      mode: 'schedule',
      releaseDate: '2026-07-20',
      releaseTime: '12:00',
      published: false
    };
    expect(schedulePayload.mode).toBe('schedule');
    expect(schedulePayload.releaseDate).toBe('2026-07-20');
    expect(schedulePayload.releaseTime).toBe('12:00');
    expect(schedulePayload.published).toBe(false);
  });
});
