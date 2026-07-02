import { NextRequest, NextResponse } from 'next/server';
import { exchangeZoomCode } from '@/lib/services/integrations/zoom-meeting';
import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

import { encryptToken } from '@/lib/crypto';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/settings?error=${encodeURIComponent(error || 'Zoom connection failed')}`,
        request.nextUrl.origin
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/admin/settings?error=Missing+oauth+code+or+state', request.nextUrl.origin)
    );
  }

  const stateParts = state.split('_');
  if (stateParts.length < 2) {
    return NextResponse.redirect(
      new URL('/admin/settings?error=Invalid+state+parameter', request.nextUrl.origin)
    );
  }

  const [workspaceId, orgId] = stateParts;

  try {
    const tokenData = await exchangeZoomCode(code, workspaceId, orgId);

    const now = Date.now();
    const expiresAt = new Date(now + tokenData.expires_in * 1000).toISOString();

    const connectionId = uuidv4();
    const connection: CalendarConnection = {
      id: connectionId,
      organizationId: orgId,
      workspaceId: workspaceId,
      userId: 'system_integration', // Scoped to workspace level
      provider: 'zoom',
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: encryptToken(tokenData.refresh_token),
      expiresAt,
      calendarId: 'primary',
      syncDirection: 'two_way',
      createdAt: new Date().toISOString(),
    };

    // Save in Firestore
    await adminDb.collection('calendar_connections').doc(connectionId).set(connection);

    const redirectUrl = new URL(`/admin/settings?workspaceId=${workspaceId}`, request.nextUrl.origin);
    redirectUrl.searchParams.set('success', 'Zoom connected successfully.');
    redirectUrl.searchParams.set('tab', 'integrations');

    return NextResponse.redirect(redirectUrl);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown Zoom integration error';
    const redirectUrl = new URL(`/admin/settings?workspaceId=${workspaceId}`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', errorMsg);
    redirectUrl.searchParams.set('tab', 'integrations');

    return NextResponse.redirect(redirectUrl);
  }
}
