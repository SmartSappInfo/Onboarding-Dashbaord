import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { CalendarConnection } from '@/lib/types';
import { refreshGoogleToken } from '@/lib/services/integrations/google-calendar';
import { refreshZoomToken } from '@/lib/services/integrations/zoom-meeting';
import { refreshMicrosoftToken } from '@/lib/services/integrations/microsoft-teams';
import { encryptToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Simple auth token verification to prevent arbitrary execution
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const firestore = adminDb;
  const now = Date.now();
  const tenMinutesFromNow = new Date(now + 10 * 60 * 1000).toISOString();

  try {
    // Query connections expiring within 10 minutes (or already expired)
    const snapshot = await firestore.collection('calendar_connections')
      .where('expiresAt', '<=', tenMinutesFromNow)
      .get();

    const results = {
      total: snapshot.size,
      successCount: 0,
      failedCount: 0,
      refreshed: [] as { id: string; provider: string }[],
    };

    for (const doc of snapshot.docs) {
      const conn = doc.data() as CalendarConnection;
      try {
        if (conn.provider === 'google_calendar') {
          const tokens = await refreshGoogleToken(conn);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          
          await doc.ref.update({
            accessToken: encryptToken(tokens.access_token),
            expiresAt,
          });
          results.refreshed.push({ id: conn.id, provider: conn.provider });
          results.successCount++;
        } else if (conn.provider === 'zoom') {
          const tokens = await refreshZoomToken(conn);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          
          await doc.ref.update({
            accessToken: encryptToken(tokens.access_token),
            refreshToken: encryptToken(tokens.refresh_token),
            expiresAt,
          });
          results.refreshed.push({ id: conn.id, provider: conn.provider });
          results.successCount++;
        } else if (conn.provider === 'microsoft_teams') {
          const tokens = await refreshMicrosoftToken(conn);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          
          await doc.ref.update({
            accessToken: encryptToken(tokens.access_token),
            refreshToken: encryptToken(tokens.refresh_token),
            expiresAt,
          });
          results.refreshed.push({ id: conn.id, provider: conn.provider });
          results.successCount++;
        }
      } catch (err: unknown) {
        results.failedCount++;
        console.error(`Token refresh failed for connection ID: ${conn.id}. Error:`, err);
      }
    }

    return NextResponse.json(results);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync process error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
