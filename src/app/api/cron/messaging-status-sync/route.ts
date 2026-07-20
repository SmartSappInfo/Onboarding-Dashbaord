import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { syncPendingSmsStatuses } from '@/lib/messaging/status-sync-service';

export const dynamic = 'force-dynamic';

const SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-secret');

/**
 * Validates the authorization header securely to prevent timing attacks.
 */
function isAuthorized(request: NextRequest): boolean {
  if (!SECRET) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const providedToken = authHeader.substring(7);
  
  if (providedToken.length !== SECRET.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(SECRET));
  } catch (err) {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    console.warn('[CRON_SYNC] Unauthorized attempt to trigger messaging status sync');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.info('[CRON_SYNC] Starting messaging status sync...');

  try {
    const result = await syncPendingSmsStatuses();
    
    console.info(`[CRON_SYNC] Completed. Processed: ${result.processed}, Success: ${result.success}`);
    
    if (result.errors && result.errors.length > 0) {
      console.warn(`[CRON_SYNC] Encountered ${result.errors.length} errors during sync:`, result.errors.slice(0, 5));
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CRON_SYNC] Fatal error during status sync:', message);
    return NextResponse.json({ error: 'Internal sync failure', message }, { status: 500 });
  }
}
