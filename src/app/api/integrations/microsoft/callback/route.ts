import { NextRequest, NextResponse } from 'next/server';
import { exchangeMicrosoftCode } from '@/lib/services/integrations/microsoft-teams';
import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

import { encryptToken } from '@/lib/crypto';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/settings?error=${encodeURIComponent(errorDescription || 'Authentication failed')}`,
        request.nextUrl.origin
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/admin/settings?error=Missing+oauth+code+or+state', request.nextUrl.origin)
    );
  }

  // Parse state: contains workspaceId_orgId
  const stateParts = state.split('_');
  if (stateParts.length < 2) {
    return NextResponse.redirect(
      new URL('/admin/settings?error=Invalid+state+parameter', request.nextUrl.origin)
    );
  }

  const [workspaceId, orgId] = stateParts;

  try {
    // Exchange token
    const tokenData = await exchangeMicrosoftCode(code, workspaceId, orgId);

    const now = Date.now();
    const expiresAt = new Date(now + tokenData.expires_in * 1000).toISOString();

    const connectionId = uuidv4();
    const connection: CalendarConnection = {
      id: connectionId,
      organizationId: orgId,
      workspaceId: workspaceId,
      userId: 'system_integration', // Linked to the workspace context
      provider: 'microsoft_teams',
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: encryptToken(tokenData.refresh_token),
      expiresAt,
      calendarId: 'primary',
      syncDirection: 'two_way',
      createdAt: new Date().toISOString(),
    };

    // Store connection document in Firestore
    await adminDb.collection('calendar_connections').doc(connectionId).set(connection);

    // Redirect to the workspace settings page with success state
    const redirectUrl = new URL(`/admin/settings?workspaceId=${workspaceId}`, request.nextUrl.origin);
    redirectUrl.searchParams.set('success', 'Microsoft Teams connected successfully.');
    redirectUrl.searchParams.set('tab', 'integrations');

    return NextResponse.redirect(redirectUrl);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown integration error';
    const redirectUrl = new URL(`/admin/settings?workspaceId=${workspaceId}`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', errorMsg);
    redirectUrl.searchParams.set('tab', 'integrations');

    return NextResponse.redirect(redirectUrl);
  }
}
