import { describe, it, expect } from 'vitest';
import {
  normalizeMeetingToUnified,
  normalizeBookingToUnified,
  deduplicateUnifiedMeetings,
  isMeetingLiveNow,
  isMeetingPast,
  sortUnifiedMeetingsChronologically,
} from '../unified-meeting-service';
import type { Meeting } from '@/lib/types';
import type { Booking } from '../types';

describe('Unified Meeting Service (SSOT Adapter)', () => {
  it('normalizes a group Meeting into a UnifiedMeetingItem', () => {
    const rawMeeting: Partial<Meeting> & { id: string } = {
      id: 'meet_orientation_101',
      title: 'Parent Orientation 2026',
      meetingTime: '2026-10-05T14:00:00.000Z',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      durationMinutes: 45,
      type: {
        id: 'parent',
        slug: 'parent-engagement',
        name: 'Parent Engagement',
      },
      meetingSlug: 'parent-orientation-2026',
      hostUserId: 'user_host_1',
      hostName: 'Principal Davis',
      attendeeCount: 42,
    };

    const unified = normalizeMeetingToUnified(rawMeeting);

    expect(unified.id).toBe('meet_orientation_101');
    expect(unified.sourceType).toBe('meeting');
    expect(unified.title).toBe('Parent Orientation 2026');
    expect(unified.startAt).toBe('2026-10-05T14:00:00.000Z');
    // 45 minutes after 14:00 is 14:45
    expect(unified.endAt).toBe('2026-10-05T14:45:00.000Z');
    expect(unified.durationMinutes).toBe(45);
    expect(unified.joinUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(unified.typeSlug).toBe('parent-engagement');
    expect(unified.typeBadge).toBe('Parent Engagement');
    expect(unified.participantCount).toBe(42);
    expect(unified.hostName).toBe('Principal Davis');
    expect(unified.status).toBe('scheduled');
  });

  it('normalizes a 1:1 Booking into a UnifiedMeetingItem', () => {
    const rawBooking: Booking = {
      id: 'bkg_client_202',
      workspaceId: 'ws_demo',
      organizationId: 'org_demo',
      eventTypeId: 'et_consult',
      eventTypeName: 'Enterprise Consultation',
      booker: {
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah@cyberdyne.io',
        phone: '+15551234567',
        notes: 'Interested in enterprise automation',
      },
      startAt: '2026-10-05T16:00:00.000Z',
      endAt: '2026-10-05T16:30:00.000Z',
      timezone: 'UTC',
      locationType: 'google_meet',
      joinUrl: 'https://meet.google.com/xyz-uvwx-rst',
      status: 'confirmed',
      bookingSource: 'booking_page',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    };

    const unified = normalizeBookingToUnified(rawBooking);

    expect(unified.id).toBe('bkg_client_202');
    expect(unified.sourceType).toBe('booking');
    expect(unified.title).toBe('Enterprise Consultation with Sarah Connor');
    expect(unified.startAt).toBe('2026-10-05T16:00:00.000Z');
    expect(unified.endAt).toBe('2026-10-05T16:30:00.000Z');
    expect(unified.durationMinutes).toBe(30);
    expect(unified.contactName).toBe('Sarah Connor');
    expect(unified.contactEmail).toBe('sarah@cyberdyne.io');
    expect(unified.notes).toBe('Interested in enterprise automation');
    expect(unified.locationType).toBe('google_meet');
    expect(unified.joinUrl).toBe('https://meet.google.com/xyz-uvwx-rst');
    expect(unified.status).toBe('confirmed');
    expect(unified.participantCount).toBe(1);
  });

  it('deduplicates when a booking has a materialized meeting document', () => {
    const bookingUnified = normalizeBookingToUnified({
      id: 'bkg_123',
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      eventTypeId: 'et_1',
      eventTypeName: 'Product Demo',
      meetingId: 'meet_mat_123',
      booker: {
        firstName: 'Alex',
        lastName: 'Morgan',
        email: 'alex@example.com',
      },
      startAt: '2026-10-05T15:00:00.000Z',
      endAt: '2026-10-05T15:30:00.000Z',
      timezone: 'UTC',
      locationType: 'google_meet',
      joinUrl: 'https://meet.google.com/shared-link',
      status: 'confirmed',
      bookingSource: 'booking_page',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });

    const meetingUnified = normalizeMeetingToUnified({
      id: 'meet_mat_123',
      title: 'Product Demo with Alex Morgan',
      meetingSlug: 'booking-bkg_123',
      meetingTime: '2026-10-05T15:00:00.000Z',
      durationMinutes: 30,
      meetingLink: 'https://meet.google.com/shared-link',
    });

    const items = [bookingUnified, meetingUnified];
    const deduplicated = deduplicateUnifiedMeetings(items);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].contactName).toBe('Alex Morgan');
    expect(deduplicated[0].joinUrl).toBe('https://meet.google.com/shared-link');
  });

  it('correctly calculates isMeetingLiveNow and isMeetingPast', () => {
    const fixedNow = new Date('2026-10-05T15:15:00.000Z');

    // Meeting that started at 15:00 and ends at 15:30 -> LIVE at 15:15
    expect(
      isMeetingLiveNow('2026-10-05T15:00:00.000Z', '2026-10-05T15:30:00.000Z', fixedNow)
    ).toBe(true);

    // Meeting that ended at 14:00 -> PAST at 15:15
    expect(
      isMeetingPast('2026-10-05T14:00:00.000Z', fixedNow)
    ).toBe(true);

    // Meeting starting tomorrow -> NOT past, NOT live
    expect(
      isMeetingLiveNow('2026-10-06T15:00:00.000Z', '2026-10-06T15:30:00.000Z', fixedNow)
    ).toBe(false);
    expect(
      isMeetingPast('2026-10-06T15:30:00.000Z', fixedNow)
    ).toBe(false);
  });

  it('sorts unified meetings chronologically', () => {
    const m1 = normalizeMeetingToUnified({
      id: 'm1',
      title: 'First',
      meetingTime: '2026-10-05T10:00:00.000Z',
    });
    const m2 = normalizeMeetingToUnified({
      id: 'm2',
      title: 'Second',
      meetingTime: '2026-10-05T12:00:00.000Z',
    });
    const m3 = normalizeMeetingToUnified({
      id: 'm3',
      title: 'Third',
      meetingTime: '2026-10-05T14:00:00.000Z',
    });

    const unsorted = [m3, m1, m2];
    const sortedAsc = sortUnifiedMeetingsChronologically(unsorted, 'asc');
    expect(sortedAsc.map(x => x.id)).toEqual(['m1', 'm2', 'm3']);

    const sortedDesc = sortUnifiedMeetingsChronologically(unsorted, 'desc');
    expect(sortedDesc.map(x => x.id)).toEqual(['m3', 'm2', 'm1']);
  });
});
