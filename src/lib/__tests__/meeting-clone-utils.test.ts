import { describe, it, expect } from 'vitest';
import { cloneMeetingData } from '../meeting-clone-utils';
import type { Meeting } from '../types';

describe('cloneMeetingData', () => {
  it('should copy all config, branding and registration fields, and modify title and status', () => {
    const originalMeeting: Meeting = {
      id: 'meeting_123',
      title: 'Original Webinar',
      meetingSlug: 'original-webinar',
      publishStatus: 'published',
      status: 'active',
      meetingTime: '2026-06-16T12:00:00Z',
      meetingLink: 'https://zoom.us/j/123456789',
      type: { id: 'webinar', name: 'Webinar', slug: 'webinar' },
      workspaceIds: ['ws_123'],
      logoUrl: 'https://example.com/logo.png',
      brandingEnabled: true,
      registrationEnabled: true,
      registrationRequiredToJoin: true,
      registrationFields: [{ id: 'name', key: 'name', label: 'Name', required: true, type: 'text', order: 0 }],
      facilitators: [
        { id: 'fac_1', type: 'custom', name: 'Facilitator 1', joinLink: 'old-join-link-token-1' },
      ],
    };

    const cloned = cloneMeetingData(originalMeeting);

    expect(cloned.title).toBe('Copy of Original Webinar');
    expect(cloned.publishStatus).toBe('draft');
    expect(cloned.status).toBeUndefined();
    expect(cloned.meetingSlug).toBe('');
    expect(cloned.meetingTime).toBe('2026-06-16T12:00:00Z');
    expect(cloned.meetingLink).toBe('https://zoom.us/j/123456789');
    expect(cloned.logoUrl).toBe('https://example.com/logo.png');
    expect(cloned.brandingEnabled).toBe(true);
    expect(cloned.registrationEnabled).toBe(true);
    expect(cloned.registrationRequiredToJoin).toBe(true);
    
    // Facilitators check: link must be regenerated and not empty/original
    expect(cloned.facilitators).toBeDefined();
    expect(cloned.facilitators).toHaveLength(1);
    expect(cloned.facilitators![0].name).toBe('Facilitator 1');
    expect(cloned.facilitators![0].joinLink).not.toBe('old-join-link-token-1');
    expect(cloned.facilitators![0].joinLink.length).toBeGreaterThan(0);
  });

  it('should handle meetings without title or facilitators gracefully', () => {
    const originalMeeting: Meeting = {
      id: 'meeting_456',
      meetingSlug: 'no-title-meeting',
      publishStatus: 'draft',
      meetingTime: '2026-06-16T12:00:00Z',
      meetingLink: 'https://zoom.us/j/123456789',
      type: { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
      workspaceIds: ['ws_456'],
    };

    const cloned = cloneMeetingData(originalMeeting);

    expect(cloned.title).toBe('Copy Meeting');
    expect(cloned.publishStatus).toBe('draft');
    expect(cloned.facilitators).toEqual([]);
  });
});

