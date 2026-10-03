import { describe, it, expect } from 'vitest';

export interface SessionWizardPayload {
  title: string;
  format: 'webinar' | 'interactive' | 'roundtable' | 'training' | 'consultation' | 'workshop' | 'general';
  date?: string; // yyyy-MM-dd
  time?: string; // HH:mm
  duration: number; // minutes
  platform: 'google_meet' | 'zoom' | 'microsoft_teams' | 'daily';
  maxSeats?: number;
  autoRecord?: boolean;
}

export function buildSessionCreationPayload(input: SessionWizardPayload, workspaceId: string) {
  const dateStr = input.date || '2026-10-15';
  const timeStr = input.time || '14:00';
  const startAt = new Date(`${dateStr}T${timeStr}:00`).toISOString();
  const durationMs = (input.duration || 60) * 60000;
  const endAt = new Date(new Date(startAt).getTime() + durationMs).toISOString();

  return {
    workspaceId,
    workspaceIds: [workspaceId],
    title: input.title.trim(),
    format: input.format,
    meetingTime: startAt,
    endTime: endAt,
    durationMinutes: input.duration || 60,
    locationType: input.platform,
    capacity: input.maxSeats || 100,
    autoRecord: !!input.autoRecord,
    status: 'scheduled',
  };
}

describe('Session Wizard Data Normalization', () => {
  it('correctly maps date, time, and duration into UTC ISO timestamps and dual workspaceIds', () => {
    const payload = buildSessionCreationPayload(
      {
        title: 'Enterprise Growth Masterclass',
        format: 'webinar',
        date: '2026-10-15',
        time: '14:00',
        duration: 90,
        platform: 'google_meet',
        maxSeats: 250,
        autoRecord: true,
      },
      'ws_test_123'
    );

    expect(payload.title).toBe('Enterprise Growth Masterclass');
    expect(payload.workspaceId).toBe('ws_test_123');
    expect(payload.workspaceIds).toEqual(['ws_test_123']);
    expect(payload.durationMinutes).toBe(90);
    expect(payload.capacity).toBe(250);
    expect(new Date(payload.endTime).getTime() - new Date(payload.meetingTime).getTime()).toBe(90 * 60000);
  });

  it('provides safe defaults when date or time are omitted', () => {
    const payload = buildSessionCreationPayload(
      {
        title: 'Quick Sync',
        format: 'general',
        duration: 30,
        platform: 'daily',
      },
      'ws_test_456'
    );

    expect(payload.title).toBe('Quick Sync');
    expect(payload.durationMinutes).toBe(30);
    expect(payload.workspaceId).toBe('ws_test_456');
    expect(payload.workspaceIds).toEqual(['ws_test_456']);
  });
});
