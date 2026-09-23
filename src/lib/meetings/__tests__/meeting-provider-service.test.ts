import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDirectRoomFallback,
  generateMeetingRoom,
  resolveWorkspaceConnection,
  getWorkspaceConnectedProviders,
  rollbackMeetingRoomAsync,
} from '../meeting-provider-service';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(),
    },
  };
});

// Mock Integration Services
vi.mock('@/lib/services/integrations/google-calendar', () => ({
  createGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
}));

vi.mock('@/lib/services/integrations/zoom-meeting', () => ({
  createZoomMeeting: vi.fn(),
  deleteZoomMeeting: vi.fn(),
}));

vi.mock('@/lib/services/integrations/microsoft-teams', () => ({
  createMicrosoftTeamsMeeting: vi.fn(),
}));

describe('Meeting Provider Service (SSOT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDirectRoomFallback', () => {
    it('generates a direct room URL and never produces /new', () => {
      const url = createDirectRoomFallback('room_123');
      expect(url).toContain('/meetings/room/room_123');
      expect(url).not.toContain('/new');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('generates a random UUID-based room when no identifier is passed', () => {
      const url = createDirectRoomFallback();
      expect(url).toContain('/meetings/room/');
      expect(url.length).toBeGreaterThan(25);
    });
  });

  describe('generateMeetingRoom for Offline Providers', () => {
    it('returns empty string or custom details for phone call', async () => {
      const res = await generateMeetingRoom({
        workspaceId: 'ws_test',
        locationType: 'phone',
        title: 'Phone Consultation',
        startAt: '2026-10-01T10:00:00Z',
        endAt: '2026-10-01T10:30:00Z',
        timezone: 'UTC',
        existingLocationDetails: '+1-555-0123',
      });

      expect(res.joinUrl).toBe('+1-555-0123');
      expect(res.isRealIntegration).toBe(false);
      expect(res.externalCalendarEventId).toBeUndefined();
    });

    it('returns physical address for in_person meeting', async () => {
      const res = await generateMeetingRoom({
        workspaceId: 'ws_test',
        locationType: 'in_person',
        title: 'Office Discussion',
        startAt: '2026-10-01T10:00:00Z',
        endAt: '2026-10-01T10:30:00Z',
        timezone: 'UTC',
        existingLocationDetails: '450 Lexington Ave, New York',
      });

      expect(res.joinUrl).toBe('450 Lexington Ave, New York');
      expect(res.isRealIntegration).toBe(false);
    });

    it('returns custom link for custom location type', async () => {
      const res = await generateMeetingRoom({
        workspaceId: 'ws_test',
        locationType: 'custom',
        title: 'Webex Sync',
        startAt: '2026-10-01T10:00:00Z',
        endAt: '2026-10-01T10:30:00Z',
        timezone: 'UTC',
        existingLocationDetails: 'https://mycompany.webex.com/meet/team',
      });

      expect(res.joinUrl).toBe('https://mycompany.webex.com/meet/team');
      expect(res.isRealIntegration).toBe(false);
    });
  });

  describe('generateMeetingRoom for Google Meet', () => {
    it('provisions legitimate Google Meet room and passes attendee information', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const { createGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');

      // Mock database returning active Google Calendar connection
      (adminDb.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              id: 'conn_google_01',
              data: () => ({
                id: 'conn_google_01',
                workspaceId: 'ws_test',
                provider: 'google_calendar',
                calendarId: 'primary',
              }),
            },
          ],
        }),
      });

      (createGoogleCalendarEvent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'g_event_999',
        htmlLink: 'https://www.google.com/calendar/event?eid=g999',
        hangoutLink: 'https://meet.google.com/xyz-uvwx-rst',
      });

      const res = await generateMeetingRoom({
        workspaceId: 'ws_test',
        locationType: 'google_meet',
        title: 'Executive Architecture Review',
        startAt: '2026-10-01T14:00:00Z',
        endAt: '2026-10-01T14:45:00Z',
        timezone: 'America/New_York',
        bookerName: 'Sarah Connor',
        bookerEmail: 'sarah@skynet.com',
      });

      expect(res.isRealIntegration).toBe(true);
      expect(res.joinUrl).toBe('https://meet.google.com/xyz-uvwx-rst');
      expect(res.joinUrl).not.toBe('https://meet.google.com/new');
      expect(res.externalCalendarEventId).toBe('g_event_999');
      expect(res.provider).toBe('google_calendar');

      expect(createGoogleCalendarEvent).toHaveBeenCalledWith(
        'conn_google_01',
        expect.objectContaining({
          title: 'Executive Architecture Review',
          attendees: [{ email: 'sarah@skynet.com', displayName: 'Sarah Connor' }],
        }),
        expect.any(Object)
      );
    });

    it('falls back to direct room URL if Google API fails or is disconnected, never /new', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');

      // Mock empty connection list (disconnected)
      (adminDb.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          empty: true,
          docs: [],
        }),
      });

      const res = await generateMeetingRoom({
        workspaceId: 'ws_disconnected',
        locationType: 'google_meet',
        title: 'Disconnected Meeting',
        startAt: '2026-10-01T10:00:00Z',
        endAt: '2026-10-01T10:30:00Z',
        timezone: 'UTC',
      });

      expect(res.isRealIntegration).toBe(false);
      expect(res.joinUrl).toContain('/meetings/room/');
      expect(res.joinUrl).not.toContain('https://meet.google.com/new');
    });
  });

  describe('generateMeetingRoom for Zoom Video', () => {
    it('provisions legitimate Zoom meeting link with topic and duration', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const { createZoomMeeting } = await import('@/lib/services/integrations/zoom-meeting');

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              id: 'conn_zoom_01',
              data: () => ({
                id: 'conn_zoom_01',
                workspaceId: 'ws_test',
                provider: 'zoom',
              }),
            },
          ],
        }),
      });

      (createZoomMeeting as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1234567890,
        join_url: 'https://us05web.zoom.us/j/1234567890',
        start_url: 'https://zoom.us/s/start123',
        topic: 'Product Demo',
      });

      const res = await generateMeetingRoom({
        workspaceId: 'ws_test',
        locationType: 'zoom',
        title: 'Product Demo',
        startAt: '2026-10-01T16:00:00Z',
        endAt: '2026-10-01T16:30:00Z',
        durationMinutes: 30,
        timezone: 'UTC',
      });

      expect(res.isRealIntegration).toBe(true);
      expect(res.joinUrl).toBe('https://us05web.zoom.us/j/1234567890');
      expect(res.conferenceMeetingId).toBe('1234567890');
      expect(res.provider).toBe('zoom');
    });

    it('gracefully degrades to fallback direct room if Google Calendar returns only htmlLink without hangoutLink', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const { createGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              id: 'conn_google_no_meet',
              data: () => ({
                id: 'conn_google_no_meet',
                workspaceId: 'ws_test',
                provider: 'google_calendar',
              }),
            },
          ],
        }),
      });

      // Simulating a Google event created where Meet is disabled or not generated (only htmlLink exists)
      (createGoogleCalendarEvent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'g_event_no_meet',
        htmlLink: 'https://www.google.com/calendar/event?eid=nomeet123',
        hangoutLink: undefined,
      });

      const res = await generateMeetingRoom({
        workspaceId: 'ws_test',
        locationType: 'google_meet',
        title: 'Meeting Without Meet',
        startAt: '2026-10-01T14:00:00Z',
        endAt: '2026-10-01T14:30:00Z',
        timezone: 'UTC',
      });

      // Must NOT treat the Google Calendar event page as the video joinUrl!
      expect(res.joinUrl).not.toContain('google.com/calendar/event');
      expect(res.joinUrl).toContain('/meetings/room/');
      expect(res.isRealIntegration).toBe(false);
    });
  });

  describe('resolveWorkspaceConnection & getWorkspaceConnectedProviders', () => {
    it('returns empty summary when workspaceId is not provided', async () => {
      const summary = await getWorkspaceConnectedProviders('');
      expect(summary.hasGoogle).toBe(false);
      expect(summary.hasZoom).toBe(false);
      expect(summary.hasTeams).toBe(false);
      expect(summary.connectedCount).toBe(0);
    });

    it('returns null connection when workspaceId is not provided', async () => {
      const conn = await resolveWorkspaceConnection('', 'google_calendar');
      expect(conn).toBeNull();
    });

    it('strictly requires system_integration for Tier 3 and ignores teammates personal connections', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');

      // Setup where query that returns empty for system_integration
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockGet = vi.fn().mockResolvedValue({
        empty: true,
        docs: [],
      });

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        where: mockWhere,
        limit: mockLimit,
        get: mockGet,
      });

      const conn = await resolveWorkspaceConnection('ws_demo', 'google_calendar', 'user_host_b');
      expect(conn).toBeNull();
      // Verifies Tier 3 searched specifically for userId == 'system_integration'
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'system_integration');
    });

    it('summarizes connected providers from Firestore connections', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const mockWhere = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              id: 'conn_gcal',
              data: () => ({
                id: 'conn_gcal',
                workspaceId: 'ws_demo',
                provider: 'google_calendar',
              }),
            },
            {
              id: 'conn_zoom',
              data: () => ({
                id: 'conn_zoom',
                workspaceId: 'ws_demo',
                provider: 'zoom',
              }),
            },
          ],
        }),
      });

      (adminDb.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        where: mockWhere,
      });

      const summary = await getWorkspaceConnectedProviders('ws_demo');
      expect(summary.hasGoogle).toBe(true);
      expect(summary.hasZoom).toBe(true);
      expect(summary.hasTeams).toBe(false);
      expect(summary.connectedCount).toBe(2);
      expect(summary.googleConnection?.id).toBe('conn_gcal');
      expect(summary.zoomConnection?.id).toBe('conn_zoom');
    });
  });

  describe('rollbackMeetingRoomAsync', () => {
    it('deletes Google Calendar event on rollback if room was provisioned with real integration', async () => {
      const { deleteGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');

      await rollbackMeetingRoomAsync({
        joinUrl: 'https://meet.google.com/abc-defg-hij',
        externalCalendarEventId: 'g_event_123',
        connectionId: 'conn_g_1',
        provider: 'google_calendar',
        isRealIntegration: true,
      });

      expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('conn_g_1', 'g_event_123');
    });

    it('deletes Zoom meeting on rollback if room was provisioned with real integration', async () => {
      const { deleteZoomMeeting } = await import('@/lib/services/integrations/zoom-meeting');

      await rollbackMeetingRoomAsync({
        joinUrl: 'https://us05web.zoom.us/j/987654321',
        conferenceMeetingId: '987654321',
        connectionId: 'conn_z_1',
        provider: 'zoom',
        isRealIntegration: true,
      });

      expect(deleteZoomMeeting).toHaveBeenCalledWith('conn_z_1', '987654321');
    });

    it('does nothing when room is not a real external integration', async () => {
      const { deleteGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');
      const { deleteZoomMeeting } = await import('@/lib/services/integrations/zoom-meeting');

      await rollbackMeetingRoomAsync({
        joinUrl: 'https://mysite.com/meetings/room/direct_123',
        isRealIntegration: false,
      });

      expect(deleteGoogleCalendarEvent).not.toHaveBeenCalled();
      expect(deleteZoomMeeting).not.toHaveBeenCalled();
    });
  });
});
