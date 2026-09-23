/**
 * @fileoverview Pure & Robust Conferencing Meeting Room Service (SSOT).
 * 
 * Central engine for:
 * 1. Multi-tier calendar connection resolution (Host Primary -> Host General -> Workspace System).
 * 2. Real meeting room generation (Google Meet, Zoom, MS Teams).
 * 3. Graceful degradation: never produces hardcoded placeholder links like `/new`.
 * 4. 7-second timeout protection with dedicated fallback room URLs.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Do NOT invoke this service inside a Firestore transaction (runTransaction).
 *   Network calls inside transactions cause retry cascades and duplicate meetings.
 * - All generated URLs must be validated before persistence.
 * 
 * @testability Exported pure helper functions and mockable integration adapters.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';
import type { MeetingLocationType } from './types';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import { v4 as uuidv4 } from 'uuid';

export interface GenerateMeetingRoomParams {
  workspaceId: string;
  locationType: MeetingLocationType;
  title: string;
  startAt: string;       // ISO 8601 UTC
  endAt: string;         // ISO 8601 UTC
  timezone: string;
  hostUserId?: string;
  bookerName?: string;
  bookerEmail?: string;
  durationMinutes?: number;
  existingLocationDetails?: string;
}

export interface MeetingRoomResult {
  joinUrl: string;
  conferenceMeetingId?: string;
  externalCalendarEventId?: string;
  externalCalendarEventUrl?: string;
  connectionId?: string;
  provider?: string;
  isRealIntegration: boolean;
}

export interface ConnectedProvidersSummary {
  hasGoogle: boolean;
  hasZoom: boolean;
  hasTeams: boolean;
  googleConnection: CalendarConnection | null;
  zoomConnection: CalendarConnection | null;
  teamsConnection: CalendarConnection | null;
  connectedCount: number;
}

/**
 * 3-Tier Multi-Tenant Connection Resolver.
 * Resolves the most appropriate calendar/conferencing connection for a given workspace and host.
 * 
 * Tier 1: Host User's primary designated connection
 * Tier 2: Host User's general connection for this provider
 * Tier 3: Workspace-level connection (strictly system_integration service account)
 */
export async function resolveWorkspaceConnection(
  workspaceId: string,
  provider: 'google_calendar' | 'zoom' | 'microsoft_teams' | 'microsoft_outlook',
  hostUserId?: string
): Promise<CalendarConnection | null> {
  if (!workspaceId) return null;

  const connectionsRef = adminDb.collection('calendar_connections');

  // Tier 1: Host Primary Connection
  if (hostUserId && hostUserId !== 'system_integration') {
    const primarySnap = await connectionsRef
      .where('workspaceId', '==', workspaceId)
      .where('userId', '==', hostUserId)
      .where('isPrimaryDestination', '==', true)
      .limit(1)
      .get();

    if (!primarySnap.empty) {
      const conn = primarySnap.docs[0].data() as CalendarConnection;
      if (conn.provider === provider || (provider.startsWith('microsoft') && conn.provider.startsWith('microsoft'))) {
        return { ...conn, id: primarySnap.docs[0].id };
      }
    }

    // Tier 2: Host General Connection
    const hostSnap = await connectionsRef
      .where('workspaceId', '==', workspaceId)
      .where('userId', '==', hostUserId)
      .limit(5)
      .get();

    for (const doc of hostSnap.docs) {
      const conn = doc.data() as CalendarConnection;
      if (conn.provider === provider || (provider.startsWith('microsoft') && conn.provider.startsWith('microsoft'))) {
        return { ...conn, id: doc.id };
      }
    }
  }

  // Tier 3: Workspace System Integration
  // Strictly enforce that Tier 3 ONLY resolves system integration connections (userId === 'system_integration').
  // Never borrow another teammate's personal calendar connection in a multi-user workspace.
  const systemSnap = await connectionsRef
    .where('workspaceId', '==', workspaceId)
    .where('provider', '==', provider)
    .where('userId', '==', 'system_integration')
    .limit(1)
    .get();

  if (!systemSnap.empty) {
    const conn = systemSnap.docs[0].data() as CalendarConnection;
    return { ...conn, id: systemSnap.docs[0].id };
  }

  return null;
}

/**
 * Summarizes connected calendar & conferencing providers for a workspace.
 */
export async function getWorkspaceConnectedProviders(
  workspaceId: string
): Promise<ConnectedProvidersSummary> {
  if (!workspaceId) {
    return {
      hasGoogle: false,
      hasZoom: false,
      hasTeams: false,
      googleConnection: null,
      zoomConnection: null,
      teamsConnection: null,
      connectedCount: 0,
    };
  }

  const snap = await adminDb
    .collection('calendar_connections')
    .where('workspaceId', '==', workspaceId)
    .get();

  let googleConn: CalendarConnection | null = null;
  let zoomConn: CalendarConnection | null = null;
  let teamsConn: CalendarConnection | null = null;

  for (const doc of snap.docs) {
    const conn = { ...(doc.data() as CalendarConnection), id: doc.id };
    if (conn.provider === 'google_calendar' && !googleConn) {
      googleConn = conn;
    } else if (conn.provider === 'zoom' && !zoomConn) {
      zoomConn = conn;
    } else if ((conn.provider === 'microsoft_teams' || conn.provider === 'microsoft_outlook') && !teamsConn) {
      teamsConn = conn;
    }
  }

  const count = (googleConn ? 1 : 0) + (zoomConn ? 1 : 0) + (teamsConn ? 1 : 0);

  return {
    hasGoogle: !!googleConn,
    hasZoom: !!zoomConn,
    hasTeams: !!teamsConn,
    googleConnection: googleConn,
    zoomConnection: zoomConn,
    teamsConnection: teamsConn,
    connectedCount: count,
  };
}

/**
 * Timeout-wrapped execution helper with true AbortController signal propagation.
 * Cancels underlying HTTP fetch if upstream API hangs.
 */
async function withTimeout<T>(
  action: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 7000,
  operationName = 'API Call'
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(`[MeetingProviderService] ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([action(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Generates an internal secure workspace room URL when external APIs are disconnected or fail.
 * NEVER outputs a placeholder link like "https://meet.google.com/new".
 */
export function createDirectRoomFallback(identifier?: string): string {
  const roomId = identifier || uuidv4().slice(0, 12);
  return `${getBaseUrl()}/meetings/room/${roomId}`;
}

/**
 * Core room generation orchestrator.
 * Connects to Google, Zoom, or Microsoft to generate legitimate video meeting links.
 */
export async function generateMeetingRoom(
  params: GenerateMeetingRoomParams
): Promise<MeetingRoomResult> {
  const {
    workspaceId,
    locationType,
    title,
    startAt,
    endAt,
    timezone,
    hostUserId,
    bookerName,
    bookerEmail,
    durationMinutes = 30,
    existingLocationDetails,
  } = params;

  // 1. Offline & Custom Link Handling
  if (locationType === 'phone' || locationType === 'in_person') {
    return {
      joinUrl: existingLocationDetails || '',
      isRealIntegration: false,
    };
  }

  if (locationType === 'custom') {
    return {
      joinUrl: existingLocationDetails || createDirectRoomFallback(),
      isRealIntegration: false,
    };
  }

  // 2. Google Meet via Google Calendar Integration
  if (locationType === 'google_meet') {
    try {
      const googleConn = await resolveWorkspaceConnection(workspaceId, 'google_calendar', hostUserId);

      if (googleConn) {
        const { createGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');

        const gEvent = await withTimeout(
          (signal) => createGoogleCalendarEvent(
            googleConn.id,
            {
              title: title || 'SmartSapp Meeting',
              description: `Scheduled meeting with ${bookerName || 'Invitee'} (${bookerEmail || 'No email provided'}).`,
              start: startAt,
              end: endAt,
              timezone: timezone || 'UTC',
              attendees: bookerEmail ? [{ email: bookerEmail, displayName: bookerName }] : undefined,
            },
            signal
          ),
          7000,
          'Google Meet Provisioning'
        );

        // Sanitize: Google Meet link MUST start with meet.google.com.
        // Never treat htmlLink (Google Calendar web event view) as a video join URL!
        const meetLink = gEvent.hangoutLink;
        if (meetLink && meetLink.startsWith('https://meet.google.com/')) {
          return {
            joinUrl: meetLink,
            externalCalendarEventId: gEvent.id,
            externalCalendarEventUrl: gEvent.htmlLink,
            connectionId: googleConn.id,
            provider: 'google_calendar',
            isRealIntegration: true,
          };
        }
      }
    } catch (err) {
      console.warn('[MeetingProviderService] Google Meet creation failed, falling back to direct room:', err);
    }

    // Graceful fallback: Use existing custom link if provided, otherwise create direct room
    return {
      joinUrl: existingLocationDetails && !existingLocationDetails.endsWith('/new')
        ? existingLocationDetails
        : createDirectRoomFallback(),
      isRealIntegration: false,
    };
  }

  // 3. Zoom Video Meeting via Zoom Integration
  if (locationType === 'zoom') {
    try {
      const zoomConn = await resolveWorkspaceConnection(workspaceId, 'zoom', hostUserId);

      if (zoomConn) {
        const { createZoomMeeting } = await import('@/lib/services/integrations/zoom-meeting');

        const zMeeting = await withTimeout(
          (signal) => createZoomMeeting(
            zoomConn.id,
            {
              topic: title || 'SmartSapp Zoom Meeting',
              start: startAt,
              durationMinutes,
              timezone: timezone || 'UTC',
            },
            signal
          ),
          7000,
          'Zoom Meeting Provisioning'
        );

        if (zMeeting.join_url) {
          // Decouple conferenceMeetingId from externalCalendarEventId so calendar sync pushes to Google/Outlook
          return {
            joinUrl: zMeeting.join_url,
            conferenceMeetingId: String(zMeeting.id),
            externalCalendarEventUrl: zMeeting.start_url,
            connectionId: zoomConn.id,
            provider: 'zoom',
            isRealIntegration: true,
          };
        }
      }
    } catch (err) {
      console.warn('[MeetingProviderService] Zoom meeting creation failed, falling back to direct room:', err);
    }

    // Graceful fallback
    return {
      joinUrl: existingLocationDetails || createDirectRoomFallback(),
      isRealIntegration: false,
    };
  }

  // 4. Microsoft Teams via Graph Integration
  if (locationType === 'teams') {
    try {
      const teamsConn = await resolveWorkspaceConnection(workspaceId, 'microsoft_teams', hostUserId);

      if (teamsConn) {
        const { createMicrosoftTeamsMeeting } = await import('@/lib/services/integrations/microsoft-teams');

        const msMeeting = await withTimeout(
          () => createMicrosoftTeamsMeeting(teamsConn.id, {
            title: title || 'SmartSapp Teams Meeting',
            start: startAt,
            end: endAt,
          }),
          7000,
          'Microsoft Teams Provisioning'
        );

        if (msMeeting.joinWebUrl) {
          return {
            joinUrl: msMeeting.joinWebUrl,
            conferenceMeetingId: msMeeting.id,
            externalCalendarEventUrl: msMeeting.joinWebUrl,
            connectionId: teamsConn.id,
            provider: 'microsoft_teams',
            isRealIntegration: true,
          };
        }
      }
    } catch (err) {
      console.warn('[MeetingProviderService] MS Teams meeting creation failed, falling back to direct room:', err);
    }

    // Graceful fallback
    return {
      joinUrl: existingLocationDetails || createDirectRoomFallback(),
      isRealIntegration: false,
    };
  }

  return {
    joinUrl: existingLocationDetails || createDirectRoomFallback(),
    isRealIntegration: false,
  };
}

/**
 * Rollback compensation engine.
 * Asynchronously deletes provisioned external meetings if the booking transaction subsequently aborts.
 */
export async function rollbackMeetingRoomAsync(
  roomResult: MeetingRoomResult
): Promise<void> {
  if (!roomResult.isRealIntegration || !roomResult.connectionId) return;

  try {
    if (roomResult.provider === 'google_calendar' && roomResult.externalCalendarEventId) {
      const { deleteGoogleCalendarEvent } = await import('@/lib/services/integrations/google-calendar');
      await deleteGoogleCalendarEvent(roomResult.connectionId, roomResult.externalCalendarEventId);
    } else if (roomResult.provider === 'zoom' && roomResult.conferenceMeetingId) {
      const { deleteZoomMeeting } = await import('@/lib/services/integrations/zoom-meeting');
      await deleteZoomMeeting(roomResult.connectionId, roomResult.conferenceMeetingId);
    }
  } catch (err) {
    console.error('[rollbackMeetingRoomAsync] Failed to rollback external meeting:', err);
  }
}

