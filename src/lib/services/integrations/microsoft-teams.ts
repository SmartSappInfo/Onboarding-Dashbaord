import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';
import { encryptToken, decryptToken } from '@/lib/crypto';

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface MicrosoftMeetingResponse {
  joinWebUrl: string;
  id: string;
  subject?: string;
  startDateTime?: string;
  endDateTime?: string;
}

interface GraphErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Resolves the OAuth Client Credentials (ID and Secret) following the hierarchy:
 * 1. Custom Workspace overrides (if any, fetched from workspace settings)
 * 2. Organization overrides (if any, fetched from organization settings)
 * 3. System Defaults (loaded from environment variables)
 */
export async function resolveMicrosoftCredentials(
  workspaceId: string,
  orgId: string
): Promise<{ clientId: string; clientSecret: string }> {
  // 1. Check workspace configuration
  const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (workspaceDoc.exists) {
    const wsData = workspaceDoc.data();
    if (wsData?.microsoftClientId && wsData?.microsoftClientSecret) {
      return {
        clientId: wsData.microsoftClientId as string,
        clientSecret: wsData.microsoftClientSecret as string,
      };
    }
  }

  // 2. Check organization configuration
  const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
  if (orgDoc.exists) {
    const orgData = orgDoc.data();
    if (orgData?.microsoftClientId && orgData?.microsoftClientSecret) {
      return {
        clientId: orgData.microsoftClientId as string,
        clientSecret: orgData.microsoftClientSecret as string,
      };
    }
  }

  // 3. Fallback to system env credentials
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  };
}

/**
 * Generates the redirect URL for Microsoft OAuth flow.
 * Passes workspaceId and orgId in the state parameter to verify and route the redirect callback.
 */
export async function getMicrosoftAuthUrl(
  workspaceId: string,
  orgId: string
): Promise<string> {
  const { clientId } = await resolveMicrosoftCredentials(workspaceId, orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;
  const scope = encodeURIComponent('offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite');
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=${workspaceId}_${orgId}`;
}

/**
 * Exchanges the authorization code received from Microsoft OAuth for access/refresh tokens.
 */
export async function exchangeMicrosoftCode(
  code: string,
  workspaceId: string,
  orgId: string
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret } = await resolveMicrosoftCredentials(workspaceId, orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft/callback`;

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json() as GraphErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'error' in errorData
      ? (errorData as GraphErrorResponse).error.message
      : 'Token exchange failed';
    throw new Error(`Microsoft token exchange failed: ${msg}`);
  }

  return await res.json() as MicrosoftTokenResponse;
}

/**
 * Refreshes an expired Microsoft Access Token using the stored refresh token.
 */
export async function refreshMicrosoftToken(
  connection: CalendarConnection
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret } = await resolveMicrosoftCredentials(
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

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    // If the refresh token is revoked or invalid, mark connection status as invalid in Firestore
    await adminDb.collection('calendar_connections').doc(connection.id).update({
      expiresAt: new Date(0).toISOString(), // Forces expired state / prompts user reconnect
    });
    throw new Error('Microsoft refresh token expired or revoked. Please reconnect account.');
  }

  return await res.json() as MicrosoftTokenResponse;
}

/**
 * Validates connection token and refreshes it if within 5 minutes of expiry.
 */
export async function getValidConnection(
  connectionId: string
): Promise<CalendarConnection> {
  const connDoc = await adminDb.collection('calendar_connections').doc(connectionId).get();
  if (!connDoc.exists) {
    throw new Error('Connection record not found');
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

  // If token expires in less than 5 minutes, refresh it
  if (expiryTime - now < 5 * 60 * 1000) {
    const newTokens = await refreshMicrosoftToken(decryptedConnection);
    
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
 * Calls Microsoft Graph API to create an Online Meeting (Microsoft Teams).
 */
export async function createMicrosoftTeamsMeeting(
  connectionId: string,
  details: { title: string; start: string; end: string }
): Promise<MicrosoftMeetingResponse> {
  const connection = await getValidConnection(connectionId);

  const res = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDateTime: details.start,
      endDateTime: details.end,
      subject: details.title,
      lobbyBypassSettings: {
        scope: 'everyone',
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json() as GraphErrorResponse | unknown;
    const msg = errorData && typeof errorData === 'object' && 'error' in errorData
      ? (errorData as GraphErrorResponse).error.message
      : 'Unknown Graph API error';
    throw new Error(`Failed to create MS Teams meeting: ${msg}`);
  }

  return await res.json() as MicrosoftMeetingResponse;
}
