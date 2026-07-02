import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';
import { encryptToken, decryptToken } from '@/lib/crypto';

interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  start_url: string;
  topic: string;
}

interface ZoomErrorResponse {
  code: number;
  message: string;
}

/**
 * Resolves Client Credentials (ID and Secret) for Zoom following the hierarchy:
 * 1. Custom Workspace credentials (if override set)
 * 2. Organization overrides (if override set)
 * 3. System Defaults (loaded from environment variables)
 */
export async function resolveZoomCredentials(
  workspaceId: string,
  orgId: string
): Promise<{ clientId: string; clientSecret: string }> {
  const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (workspaceDoc.exists) {
    const wsData = workspaceDoc.data();
    if (wsData?.zoomClientId && wsData?.zoomClientSecret) {
      return {
        clientId: wsData.zoomClientId as string,
        clientSecret: wsData.zoomClientSecret as string,
      };
    }
  }

  const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
  if (orgDoc.exists) {
    const orgData = orgDoc.data();
    if (orgData?.zoomClientId && orgData?.zoomClientSecret) {
      return {
        clientId: orgData.zoomClientId as string,
        clientSecret: orgData.zoomClientSecret as string,
      };
    }
  }

  return {
    clientId: process.env.ZOOM_CLIENT_ID || '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  };
}

/**
 * Generates Zoom Auth URL.
 */
export async function getZoomAuthUrl(
  workspaceId: string,
  orgId: string
): Promise<string> {
  const { clientId } = await resolveZoomCredentials(workspaceId, orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`;
  return `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${workspaceId}_${orgId}`;
}

/**
 * Exchanges the code for Zoom access/refresh tokens.
 */
export async function exchangeZoomCode(
  code: string,
  workspaceId: string,
  orgId: string
): Promise<ZoomTokenResponse> {
  const { clientId, clientSecret } = await resolveZoomCredentials(workspaceId, orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const bodyParams = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json() as ZoomErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'message' in errorData
      ? (errorData as ZoomErrorResponse).message
      : 'Zoom code exchange failed';
    throw new Error(`Zoom token exchange failed: ${msg}`);
  }

  return await res.json() as ZoomTokenResponse;
}

/**
 * Refreshes an expired Zoom token.
 */
export async function refreshZoomToken(
  connection: CalendarConnection
): Promise<ZoomTokenResponse> {
  const { clientId, clientSecret } = await resolveZoomCredentials(
    connection.workspaceId,
    connection.organizationId
  );

  const decryptedRefreshToken = decryptToken(connection.refreshToken);

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decryptedRefreshToken,
  });

  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    // Revoke connection validity on token failure
    await adminDb.collection('calendar_connections').doc(connection.id).update({
      expiresAt: new Date(0).toISOString(),
    });
    throw new Error('Zoom refresh token expired or revoked. Please reconnect account.');
  }

  return await res.json() as ZoomTokenResponse;
}

/**
 * Checks Zoom connection validity and refreshes token if needed.
 */
export async function getValidZoomConnection(
  connectionId: string
): Promise<CalendarConnection> {
  const connDoc = await adminDb.collection('calendar_connections').doc(connectionId).get();
  if (!connDoc.exists) {
    throw new Error('Zoom connection record not found');
  }

  const connection = connDoc.data() as CalendarConnection;
  
  // Decrypt connection tokens for local processing
  const decryptedConnection: CalendarConnection = {
    ...connection,
    accessToken: decryptToken(connection.accessToken),
    refreshToken: decryptToken(connection.refreshToken),
  };

  const expiryTime = new Date(decryptedConnection.expiresAt).getTime();
  const now = Date.now();

  if (expiryTime - now < 5 * 60 * 1000) {
    const newTokens = await refreshZoomToken(decryptedConnection);
    
    // Encrypt updated tokens before saving
    const encryptedAccessToken = encryptToken(newTokens.access_token);
    const encryptedRefreshToken = encryptToken(newTokens.refresh_token);

    const updatedConnection: CalendarConnection = {
      ...connection,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: new Date(now + newTokens.expires_in * 1000).toISOString(),
    };

    await adminDb.collection('calendar_connections').doc(connectionId).set(updatedConnection);
    
    // Return decrypted connection to client callers for immediate API use
    return {
      ...updatedConnection,
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
    };
  }

  return decryptedConnection;
}

/**
 * Calls Zoom API to create a new Meeting.
 */
export async function createZoomMeeting(
  connectionId: string,
  details: { topic: string; start: string; durationMinutes: number; timezone: string }
): Promise<ZoomMeetingResponse> {
  const connection = await getValidZoomConnection(connectionId);

  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: details.topic,
      type: 2, // Scheduled meeting
      start_time: details.start,
      duration: details.durationMinutes,
      timezone: details.timezone,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: true,
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json() as ZoomErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'message' in errorData
      ? (errorData as ZoomErrorResponse).message
      : 'Unknown Zoom API error';
    throw new Error(`Failed to create Zoom meeting: ${msg}`);
  }

  return await res.json() as ZoomMeetingResponse;
}
