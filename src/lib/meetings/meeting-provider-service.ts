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
  externalCalendarEventId?: string;
  externalCalendarEventUrl?: string;
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
 * Tier 3: Workspace-level connection (e.g. system_integration)
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

  // Tier 3: Workspace-level (system_integration or any active connection for this provider)
  const workspaceSnap = await connectionsRef
    .where('workspaceId', '==', workspaceId)
    .limit(10)
    .get();

  for (const doc of workspaceSnap.docs) {
    const conn = doc.data() as CalendarConnection;
    if (conn.provider === provider || (provider.startsWith('microsoft') && conn.provider.startsWith('microsoft'))) {
      return { ...conn, id: doc.id };
    }
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
 * Timeout-wrapped execution helper to protect against hanging upstream APIs.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 7000, operationName = 'API Call'): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`[MeetingProviderService] ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
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
          createGoogleCalendarEvent(googleConn.id, {
            title: title || 'SmartSapp Meeting',
            description: `Scheduled meeting with ${bookerName || 'Invitee'} (${bookerEmail || 'No email provided'}).`,
            start: startAt,
            end: endAt,
            timezone: timezone || 'UTC',
            attendees: bookerEmail ? [{ email: bookerEmail, displayName: bookerName }] : undefined,
          }),
          7000,
          'Google Meet Provisioning'
        );

        const realLink = gEvent.hangoutLink || gEvent.htmlLink;
        if (realLink && !realLink.endsWith('/new')) {
          return {
            joinUrl: realLink,
            externalCalendarEventId: gEvent.id,
            externalCalendarEventUrl: gEvent.htmlLink,
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
          createZoomMeeting(zoomConn.id, {
            topic: title || 'SmartSapp Zoom Meeting',
            start: startAt,
            durationMinutes,
            timezone: timezone || 'UTC',
          }),
          7000,
          'Zoom Meeting Provisioning'
        );

        if (zMeeting.join_url) {
          return {
            joinUrl: zMeeting.join_url,
            externalCalendarEventId: String(zMeeting.id),
            externalCalendarEventUrl: zMeeting.start_url,
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
          createMicrosoftTeamsMeeting(teamsConn.id, {
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
            externalCalendarEventId: msMeeting.id,
            externalCalendarEventUrl: msMeeting.joinWebUrl,
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
