import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleCalendarEvent {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

interface GoogleFreeBusyResponse {
  calendars: Record<string, {
    busy: Array<{ start: string; end: string }>;
  }>;
}

interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Resolves Client Credentials (ID and Secret) for Google Calendar following the hierarchy:
 * 1. Custom Workspace credentials (if override set)
 * 2. Organization overrides (if override set)
 * 3. System Defaults (loaded from environment variables)
 */
export async function resolveGoogleCredentials(
  workspaceId: string,
  orgId: string
): Promise<{ clientId: string; clientSecret: string }> {
  const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (workspaceDoc.exists) {
    const wsData = workspaceDoc.data();
    if (wsData?.googleClientId && wsData?.googleClientSecret) {
      return {
        clientId: wsData.googleClientId as string,
        clientSecret: wsData.googleClientSecret as string,
      };
    }
  }

  const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
  if (orgDoc.exists) {
    const orgData = orgDoc.data();
    if (orgData?.googleClientId && orgData?.googleClientSecret) {
      return {
        clientId: orgData.googleClientId as string,
        clientSecret: orgData.googleClientSecret as string,
      };
    }
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  };
}

/**
 * Generates Google Auth URL.
 */
export async function getGoogleAuthUrl(
  workspaceId: string,
  orgId: string
): Promise<string> {
  const { clientId } = await resolveGoogleCredentials(workspaceId, orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly');
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${workspaceId}_${orgId}`;
}

/**
 * Exchanges the code for Google Access/Refresh tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  workspaceId: string,
  orgId: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = await resolveGoogleCredentials(workspaceId, orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;

  const bodyParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json() as GoogleErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'error' in errorData
      ? (errorData as GoogleErrorResponse).error.message
      : 'Google code exchange failed';
    throw new Error(`Google token exchange failed: ${msg}`);
  }

  return await res.json() as GoogleTokenResponse;
}

/**
 * Refreshes an expired Google access token.
 */
export async function refreshGoogleToken(
  connection: CalendarConnection
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = await resolveGoogleCredentials(
    connection.workspaceId,
    connection.organizationId
  );

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    // Revoke connection validity on token failure
    await adminDb.collection('calendar_connections').doc(connection.id).update({
      expiresAt: new Date(0).toISOString(),
    });
    throw new Error('Google refresh token expired or revoked. Please reconnect account.');
  }

  return await res.json() as GoogleTokenResponse;
}

/**
 * Checks Google Calendar connection validity and refreshes token if needed.
 */
export async function getValidGoogleConnection(
  connectionId: string
): Promise<CalendarConnection> {
  const connDoc = await adminDb.collection('calendar_connections').doc(connectionId).get();
  if (!connDoc.exists) {
    throw new Error('Google connection record not found');
  }

  const connection = connDoc.data() as CalendarConnection;
  const expiryTime = new Date(connection.expiresAt).getTime();
  const now = Date.now();

  if (expiryTime - now < 5 * 60 * 1000) {
    const newTokens = await refreshGoogleToken(connection);
    const updatedConnection: CalendarConnection = {
      ...connection,
      accessToken: newTokens.access_token,
      // If server does not return a new refresh token, preserve existing one
      refreshToken: newTokens.refresh_token || connection.refreshToken,
      expiresAt: new Date(now + newTokens.expires_in * 1000).toISOString(),
    };

    await adminDb.collection('calendar_connections').doc(connectionId).set(updatedConnection);
    return updatedConnection;
  }

  return connection;
}

/**
 * Fetches Google Calendar free/busy slots for conflict checks.
 */
export async function queryGoogleFreeBusy(
  connectionId: string,
  timeMin: string, // ISO Format
  timeMax: string  // ISO Format
): Promise<Array<{ start: string; end: string }>> {
  const connection = await getValidGoogleConnection(connectionId);

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: connection.calendarId || 'primary' }],
    }),
  });

  if (!res.ok) {
    const errorData = await res.json() as GoogleErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'error' in errorData
      ? (errorData as GoogleErrorResponse).error.message
      : 'Google FreeBusy request failed';
    throw new Error(`Google FreeBusy API error: ${msg}`);
  }

  const data = await res.json() as GoogleFreeBusyResponse;
  const calendarId = connection.calendarId || 'primary';
  const busySlots = data.calendars[calendarId]?.busy || [];

  return busySlots.map(slot => ({
    start: slot.start,
    end: slot.end,
  }));
}

/**
 * Creates an event on Google Calendar, automatically provisioning Google Meet conferencing.
 */
export async function createGoogleCalendarEvent(
  connectionId: string,
  details: { title: string; description?: string; start: string; end: string; timezone: string }
): Promise<GoogleCalendarEvent> {
  const connection = await getValidGoogleConnection(connectionId);
  const calendarId = connection.calendarId || 'primary';

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: details.title,
        description: details.description || '',
        start: {
          dateTime: details.start,
          timeZone: details.timezone,
        },
        end: {
          dateTime: details.end,
          timeZone: details.timezone,
        },
        conferenceData: {
          createRequest: {
            requestId: `meet_${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json() as GoogleErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'error' in errorData
      ? (errorData as GoogleErrorResponse).error.message
      : 'Google Calendar Event creation failed';
    throw new Error(`Google Calendar API error: ${msg}`);
  }

  return await res.json() as GoogleCalendarEvent;
}
