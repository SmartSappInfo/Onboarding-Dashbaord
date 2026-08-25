/**
 * @fileoverview Microsoft Outlook / Office 365 Calendar Integration Service via Microsoft Graph API.
 * Handles OAuth 2.0 authentication, token encryption/refresh, Free/Busy schedule queries,
 * and bi-directional event creation with Microsoft Teams conferencing.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All tokens are stored AES-256-GCM encrypted in Firestore.
 * - Free/Busy queries use the Microsoft Graph `/me/calendar/getSchedule` endpoint.
 * - Do not use 'any' or 'any[]' in these contracts.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection, CalendarSyncResult } from '@/lib/meetings/types/calendar';
import { encryptToken, decryptToken } from '@/lib/crypto';

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface MicrosoftScheduleItem {
  status: string; // 'busy', 'free', 'tentative', 'oof', 'workingElsewhere'
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

interface MicrosoftGetScheduleResponse {
  value: Array<{
    scheduleId: string;
    scheduleItems: MicrosoftScheduleItem[];
  }>;
}

interface MicrosoftCalendarEventResponse {
  id: string;
  webLink: string;
  onlineMeeting?: {
    joinUrl: string;
  };
}

/**
 * Resolves Client Credentials (ID and Secret) for Microsoft Graph API.
 */
export async function resolveMicrosoftCredentials(
  workspaceId: string,
  organizationId?: string
): Promise<{ clientId: string; clientSecret: string; tenantId: string }> {
  try {
    const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (workspaceDoc.exists) {
      const wsData = workspaceDoc.data();
      if (wsData?.microsoftClientId && wsData?.microsoftClientSecret) {
        return {
          clientId: wsData.microsoftClientId as string,
          clientSecret: wsData.microsoftClientSecret as string,
          tenantId: (wsData.microsoftTenantId as string) || 'common',
        };
      }
    }

    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const orgData = orgDoc.data();
        if (orgData?.microsoftClientId && orgData?.microsoftClientSecret) {
          return {
            clientId: orgData.microsoftClientId as string,
            clientSecret: orgData.microsoftClientSecret as string,
            tenantId: (orgData.microsoftTenantId as string) || 'common',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[MicrosoftCalendar] Error checking custom credentials:', err);
  }

  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  };
}

/**
 * Generates Microsoft OAuth 2.0 Auth URL.
 */
export async function getMicrosoftAuthUrl(
  workspaceId: string,
  organizationId?: string,
  userId?: string
): Promise<string> {
  const { clientId, tenantId } = await resolveMicrosoftCredentials(workspaceId, organizationId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartsapp.com';
  const redirectUri = `${appUrl}/api/integrations/microsoft/callback`;
  const scopes = encodeURIComponent('offline_access Calendars.ReadWrite Calendars.Read.Shared User.Read');
  const state = `${workspaceId}_${organizationId || 'default'}_${userId || 'default'}`;

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}&state=${encodeURIComponent(state)}&prompt=select_account`;
}

/**
 * Exchanges authorization code for Microsoft Access & Refresh tokens.
 */
export async function exchangeMicrosoftCode(
  code: string,
  workspaceId: string,
  organizationId?: string
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tenantId } = await resolveMicrosoftCredentials(workspaceId, organizationId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartsapp.com';
  const redirectUri = `${appUrl}/api/integrations/microsoft/callback`;

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Microsoft code exchange failed: ${errorText}`);
  }

  return (await res.json()) as MicrosoftTokenResponse;
}

/**
 * Refreshes an expired Microsoft Access Token using the encrypted Refresh Token.
 */
export async function refreshMicrosoftToken(
  connection: CalendarConnection
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tenantId } = await resolveMicrosoftCredentials(
    connection.workspaceId,
    connection.organizationId
  );

  const decryptedRefreshToken = decryptToken(connection.refreshToken);

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: decryptedRefreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    // Mark connection as requiring re-authentication
    await adminDb.collection('calendar_connections').doc(connection.id).update({
      status: 'reauth_required',
      updatedAt: new Date().toISOString(),
    });
    throw new Error('Microsoft refresh token expired or revoked. Please reconnect account.');
  }

  return (await res.json()) as MicrosoftTokenResponse;
}

/**
 * Retrieves valid decrypted Microsoft calendar connection, refreshing automatically if nearing expiration.
 */
export async function getValidMicrosoftConnection(
  connectionId: string
): Promise<CalendarConnection> {
  const connDoc = await adminDb.collection('calendar_connections').doc(connectionId).get();
  if (!connDoc.exists) {
    throw new Error('Microsoft calendar connection not found');
  }

  const connection = connDoc.data() as CalendarConnection;
  const decryptedAccessToken = decryptToken(connection.accessToken);
  const decryptedRefreshToken = decryptToken(connection.refreshToken);

  const expiryTime = new Date(connection.expiresAt).getTime();
  const now = Date.now();

  // Refresh if less than 5 minutes remain
  if (expiryTime - now < 5 * 60 * 1000) {
    const newTokens = await refreshMicrosoftToken({
      ...connection,
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    });

    const encryptedAccessToken = encryptToken(newTokens.access_token);
    const encryptedRefreshToken = encryptToken(newTokens.refresh_token || decryptedRefreshToken);
    const newExpiresAt = new Date(now + newTokens.expires_in * 1000).toISOString();

    await adminDb.collection('calendar_connections').doc(connectionId).update({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: newExpiresAt,
      status: 'connected',
      updatedAt: new Date().toISOString(),
    });

    return {
      ...connection,
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || decryptedRefreshToken,
      expiresAt: newExpiresAt,
      status: 'connected',
    };
  }

  return {
    ...connection,
    accessToken: decryptedAccessToken,
    refreshToken: decryptedRefreshToken,
  };
}

/**
 * Queries Microsoft Graph API for Free/Busy schedule items.
 */
export async function queryMicrosoftFreeBusy(
  connectionId: string,
  startTimeIso: string,
  endTimeIso: string,
  timezone = 'UTC'
): Promise<Array<{ start: string; end: string }>> {
  const connection = await getValidMicrosoftConnection(connectionId);

  const res = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: `outlook.timezone="${timezone}"`,
    },
    body: JSON.stringify({
      schedules: [connection.email],
      startTime: {
        dateTime: startTimeIso.replace('Z', ''),
        timeZone: timezone,
      },
      endTime: {
        dateTime: endTimeIso.replace('Z', ''),
        timeZone: timezone,
      },
      availabilityViewInterval: 15,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn(`[MicrosoftCalendar] FreeBusy query failed: ${errorText}`);
    return [];
  }

  const data = (await res.json()) as MicrosoftGetScheduleResponse;
  const schedule = data.value?.[0]?.scheduleItems || [];

  // Filter busy items (status !== 'free')
  const busyItems = schedule.filter(item => item.status && item.status.toLowerCase() !== 'free');

  return busyItems.map(item => ({
    start: new Date(item.start.dateTime + (item.start.timeZone === 'UTC' ? 'Z' : '')).toISOString(),
    end: new Date(item.end.dateTime + (item.end.timeZone === 'UTC' ? 'Z' : '')).toISOString(),
  }));
}

/**
 * Creates an event on Microsoft Outlook Calendar with automatic Microsoft Teams conferencing.
 */
export async function createMicrosoftCalendarEvent(
  connectionId: string,
  details: {
    title: string;
    description?: string;
    start: string; // ISO
    end: string;   // ISO
    timezone?: string;
    attendeeEmail?: string;
    attendeeName?: string;
  }
): Promise<CalendarSyncResult> {
  try {
    const connection = await getValidMicrosoftConnection(connectionId);
    const timezone = details.timezone || 'UTC';

    const eventPayload = {
      subject: details.title,
      body: {
        contentType: 'HTML',
        content: details.description || '<p>Scheduled via SmartSapp Meetings</p>',
      },
      start: {
        dateTime: details.start.replace('Z', ''),
        timeZone: timezone,
      },
      end: {
        dateTime: details.end.replace('Z', ''),
        timeZone: timezone,
      },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      attendees: details.attendeeEmail
        ? [
            {
              emailAddress: {
                address: details.attendeeEmail,
                name: details.attendeeName || details.attendeeEmail,
              },
              type: 'required',
            },
          ]
        : [],
    };

    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Microsoft event creation failed: ${errorText}` };
    }

    const eventData = (await res.json()) as MicrosoftCalendarEventResponse;
    return {
      success: true,
      externalEventId: eventData.id,
      externalEventUrl: eventData.webLink,
      meetLink: eventData.onlineMeeting?.joinUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Microsoft Calendar error';
    return { success: false, error: msg };
  }
}
