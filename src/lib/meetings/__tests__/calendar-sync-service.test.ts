import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncBookingToExternalCalendar } from '../calendar-sync-service';

// Mock Firebase Admin
const mockBookingGet = vi.fn();
const mockBookingUpdate = vi.fn();
const mockMeetingUpdate = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'bookings') {
        return {
          doc: vi.fn(() => ({
            get: mockBookingGet,
            update: mockBookingUpdate,
          })),
        };
      }
      if (colName === 'meetings') {
        return {
          doc: vi.fn(() => ({
            update: mockMeetingUpdate,
          })),
        };
      }
      return {};
    }),
  },
}));

// Mock Resolver
vi.mock('../meeting-provider-service', () => ({
  resolveWorkspaceConnection: vi.fn(),
}));

// Mock Integrations
vi.mock('@/lib/services/integrations/google-calendar', () => ({
  createGoogleCalendarEvent: vi.fn(),
}));

vi.mock('@/lib/services/integrations/microsoft-calendar', () => ({
  createMicrosoftCalendarEvent: vi.fn(),
}));

vi.mock('@/lib/meetings/activity-logger', () => ({
  logMeetingActivity: vi.fn(),
}));

describe('Calendar Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when booking already has externalCalendarEventId', async () => {
    mockBookingGet.mockResolvedValueOnce({
      exists: true,
      id: 'b_123',
      data: () => ({
        externalCalendarEventId: 'existing_evt_999',
        externalCalendarEventUrl: 'https://calendar.google.com/event?id=existing_evt_999',
      }),
    });

    const res = await syncBookingToExternalCalendar('b_123');

    expect(res.success).toBe(true);
    expect(res.externalEventId).toBe('existing_evt_999');
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });

  it('for Zoom bookings, syncs to Google Calendar with createMeetConference: false and never creates duplicate Zoom meetings', async () => {
    const { resolveWorkspaceConnection } = await import('../meeting-provider-service');
    const { createGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');

    mockBookingGet.mockResolvedValueOnce({
      exists: true,
      id: 'b_zoom_1',
      data: () => ({
        workspaceId: 'ws_test',
        hostUserId: 'user_host_1',
        locationType: 'zoom',
        joinUrl: 'https://us05web.zoom.us/j/987654321',
        eventTypeName: 'Product Demo',
        startAt: '2026-10-10T14:00:00Z',
        endAt: '2026-10-10T14:30:00Z',
        booker: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
        meetingId: 'meet_doc_1',
      }),
    });

    vi.mocked(resolveWorkspaceConnection).mockResolvedValueOnce({
      id: 'conn_gcal_1',
      provider: 'google_calendar',
      workspaceId: 'ws_test',
      userId: 'user_host_1',
    } as unknown as import('@/lib/types').CalendarConnection);

    vi.mocked(createGoogleCalendarEvent).mockResolvedValueOnce({
      id: 'gcal_event_555',
      htmlLink: 'https://calendar.google.com/event?eid=555',
    } as unknown as Awaited<ReturnType<typeof createGoogleCalendarEvent>>);

    const res = await syncBookingToExternalCalendar('b_zoom_1');

    expect(res.success).toBe(true);
    expect(res.externalEventId).toBe('gcal_event_555');

    // Verify Google Calendar event was created with the Zoom link in location/description and NO Meet conference
    expect(createGoogleCalendarEvent).toHaveBeenCalledWith(
      'conn_gcal_1',
      expect.objectContaining({
        title: 'Product Demo',
        location: 'https://us05web.zoom.us/j/987654321',
        createMeetConference: false,
      })
    );

    // Verify Firestore updates
    expect(mockBookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        externalCalendarEventId: 'gcal_event_555',
        externalCalendarEventUrl: 'https://calendar.google.com/event?eid=555',
      })
    );
  });

  it('returns success without error if host has no connected calendar', async () => {
    const { resolveWorkspaceConnection } = await import('../meeting-provider-service');

    mockBookingGet.mockResolvedValueOnce({
      exists: true,
      id: 'b_offline_1',
      data: () => ({
        workspaceId: 'ws_test',
        hostUserId: 'user_host_2',
        locationType: 'in_person',
        startAt: '2026-10-10T15:00:00Z',
        endAt: '2026-10-10T16:00:00Z',
      }),
    });

    vi.mocked(resolveWorkspaceConnection).mockResolvedValue(null);

    const res = await syncBookingToExternalCalendar('b_offline_1');

    expect(res.success).toBe(true);
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });
});
