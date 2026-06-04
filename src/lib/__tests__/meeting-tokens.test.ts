import { describe, it, expect } from 'vitest';
import { getPersonalizedMeetingUrl } from '../meeting-tokens';

describe('getPersonalizedMeetingUrl', () => {
  const origin = 'https://go.smartsapp.com';
  const token = '_Q70a3GdwLUHKc-3';

  it('correctly maps meeting.type.slug if it is defined', () => {
    const meeting = {
      id: 'meeting-123',
      meetingSlug: 'gakd',
      type: { slug: 'parent-engagement', id: 'parent' }
    };
    const url = getPersonalizedMeetingUrl(origin, meeting, token);
    expect(url).toBe('https://go.smartsapp.com/meetings/parent-engagement/gakd/join?token=_Q70a3GdwLUHKc-3');
  });

  it('correctly maps legacy type "parent" ID to parent-engagement slug', () => {
    const meeting = {
      id: 'meeting-123',
      meetingSlug: 'gakd',
      type: { id: 'parent' }
    };
    const url = getPersonalizedMeetingUrl(origin, meeting, token);
    expect(url).toBe('https://go.smartsapp.com/meetings/parent-engagement/gakd/join?token=_Q70a3GdwLUHKc-3');
  });

  it('correctly uses raw string type mapped "parent" -> "parent-engagement"', () => {
    const meeting = {
      id: 'meeting-123',
      meetingSlug: 'gakd',
      type: 'parent'
    };
    const url = getPersonalizedMeetingUrl(origin, meeting, token);
    expect(url).toBe('https://go.smartsapp.com/meetings/parent-engagement/gakd/join?token=_Q70a3GdwLUHKc-3');
  });

  it('uses meeting.id if meetingSlug or entitySlug is not defined', () => {
    const meeting = {
      id: 'meeting-123',
      type: { id: 'kickoff', slug: 'kickoff-slug' }
    };
    const url = getPersonalizedMeetingUrl(origin, meeting, token);
    expect(url).toBe('https://go.smartsapp.com/meetings/kickoff-slug/meeting-123/join?token=_Q70a3GdwLUHKc-3');
  });

  it('falls back to parent-engagement if meeting.type is undefined', () => {
    const meeting = {
      id: 'meeting-123',
      meetingSlug: 'gakd'
    };
    const url = getPersonalizedMeetingUrl(origin, meeting, token);
    expect(url).toBe('https://go.smartsapp.com/meetings/parent-engagement/gakd/join?token=_Q70a3GdwLUHKc-3');
  });
});
