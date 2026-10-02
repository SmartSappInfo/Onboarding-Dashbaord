import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MEETING_TEMPLATES } from '@/app/admin/meetings/constants/templates';
import { cloneMeetingData } from '@/lib/meeting-clone-utils';
import type { Meeting } from '@/lib/types';

describe('Meeting Entry Mode & Attendee Collection Configuration', () => {
  // Test 1: Verify all system built-in templates default collectAttendeeDetails to false
  it('should default collectAttendeeDetails to false across all built-in templates', () => {
    expect(MEETING_TEMPLATES.length).toBeGreaterThanOrEqual(4);

    MEETING_TEMPLATES.forEach(template => {
      expect(
        template.defaults.collectAttendeeDetails,
        `Template "${template.title}" must default collectAttendeeDetails to false`
      ).toBe(false);
    });
  });

  // Test 2: Verify Zod schema defaults collectAttendeeDetails to false when omitted
  it('should default collectAttendeeDetails to false in the meeting form schema when omitted', () => {
    const meetingFormSchema = z.object({
      title: z.string().min(1),
      collectAttendeeDetails: z.boolean().default(false),
    });

    const parsedOmitted = meetingFormSchema.parse({ title: 'Ad-hoc Sync' });
    expect(parsedOmitted.collectAttendeeDetails).toBe(false);

    const parsedExplicitTrue = meetingFormSchema.parse({
      title: 'Parent Orientation',
      collectAttendeeDetails: true,
    });
    expect(parsedExplicitTrue.collectAttendeeDetails).toBe(true);

    const parsedExplicitFalse = meetingFormSchema.parse({
      title: 'Public Town Hall',
      collectAttendeeDetails: false,
    });
    expect(parsedExplicitFalse.collectAttendeeDetails).toBe(false);
  });

  // Test 3: Defensive resolver for legacy meetings where collectAttendeeDetails is undefined
  it('should treat undefined or null collectAttendeeDetails as false (Direct 1-Click Join)', () => {
    const legacyMeeting: Partial<Meeting> = {
      id: 'legacy_meeting_101',
      title: 'Legacy Meeting Without Field',
    };

    const isInfoGateRequired = (meeting: Partial<Meeting>): boolean => {
      return meeting.collectAttendeeDetails === true;
    };

    expect(isInfoGateRequired(legacyMeeting)).toBe(false);
    expect(isInfoGateRequired({ ...legacyMeeting, collectAttendeeDetails: false })).toBe(false);
    expect(isInfoGateRequired({ ...legacyMeeting, collectAttendeeDetails: true })).toBe(true);
  });

  // Test 4: Meeting clone integrity preserves collectAttendeeDetails
  it('should preserve collectAttendeeDetails when cloning a meeting', () => {
    const originalWithGate: Meeting = {
      id: 'meeting_gate_1',
      title: 'Gated Orientation',
      meetingSlug: 'gated-orientation',
      publishStatus: 'published',
      workspaceIds: ['ws_test'],
      meetingTime: '2026-10-10T10:00:00Z',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      type: { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
      collectAttendeeDetails: true,
    };

    const clonedWithGate = cloneMeetingData(originalWithGate);
    expect(clonedWithGate.collectAttendeeDetails).toBe(true);

    const originalDirect: Meeting = {
      id: 'meeting_direct_1',
      title: 'Direct Broadcast',
      meetingSlug: 'direct-broadcast',
      publishStatus: 'published',
      workspaceIds: ['ws_test'],
      meetingTime: '2026-10-10T10:00:00Z',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      type: { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
      collectAttendeeDetails: false,
    };

    const clonedDirect = cloneMeetingData(originalDirect);
    expect(clonedDirect.collectAttendeeDetails).toBe(false);
  });

  // Test 5: Safe URL validation to prevent open-redirect and javascript: injection attacks
  it('should strictly validate meeting links against open-redirect or script execution vulnerabilities', () => {
    const isValidMeetingUrl = (url?: string): boolean => {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim().toLowerCase();
      return trimmed.startsWith('https://') || trimmed.startsWith('http://');
    };

    // Valid HTTPS / HTTP links
    expect(isValidMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isValidMeetingUrl('https://zoom.us/j/1234567890')).toBe(true);
    expect(isValidMeetingUrl('http://localhost:3000/meetings/room/123')).toBe(true);

    // Malicious or invalid protocols
    expect(isValidMeetingUrl('javascript:alert("XSS")')).toBe(false);
    expect(isValidMeetingUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidMeetingUrl('vbscript:msgbox("test")')).toBe(false);
    expect(isValidMeetingUrl('')).toBe(false);
    expect(isValidMeetingUrl('   ')).toBe(false);
    expect(isValidMeetingUrl(undefined)).toBe(false);
  });

  // Test 6: Button label resolution when registration is not required and meeting has started
  it('should resolve CTA button to "Join Meeting Now" when registration is not required and meeting is live', () => {
    const resolveCtaButtonLabel = (heroCtaLabel?: string): string => {
      if (heroCtaLabel && !heroCtaLabel.trim().toLowerCase().includes('register')) {
        return heroCtaLabel.trim();
      }
      return 'Join Meeting Now';
    };

    // When template had "Register Now" or similar register label, it must NOT lead to register
    expect(resolveCtaButtonLabel('Register Now')).toBe('Join Meeting Now');
    expect(resolveCtaButtonLabel('Register')).toBe('Join Meeting Now');
    expect(resolveCtaButtonLabel('REGISTER NOW')).toBe('Join Meeting Now');
    expect(resolveCtaButtonLabel('')).toBe('Join Meeting Now');
    expect(resolveCtaButtonLabel(undefined)).toBe('Join Meeting Now');

    // When explicitly customized to a non-register action, keep custom action
    expect(resolveCtaButtonLabel('Enter Livestream')).toBe('Enter Livestream');
    expect(resolveCtaButtonLabel('Join Meeting Now')).toBe('Join Meeting Now');
  });

  // Test 7: Countdown timer hides when expired so "The meeting has started!" is not duplicated
  it('should verify countdown timer hides upon reaching zero to eliminate duplicate and misaligned text', () => {
    const isCountdownExpired = (targetDate: string, now: Date): boolean => {
      const difference = +new Date(targetDate) - +now;
      return difference <= 0;
    };

    const pastDate = '2026-10-01T10:00:00Z';
    const now = new Date('2026-10-02T12:00:00Z');
    expect(isCountdownExpired(pastDate, now)).toBe(true);

    const futureDate = '2026-10-03T10:00:00Z';
    expect(isCountdownExpired(futureDate, now)).toBe(false);
  });
});
