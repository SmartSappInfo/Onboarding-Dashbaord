import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runDailyReminderJob } from '@/lib/documents/signing-reminder-service';

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
  } catch (_err) {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    console.warn('[CRON_SIGNING_REMINDERS] Unauthorized attempt to trigger signing reminder job');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.info('[CRON_SIGNING_REMINDERS] Starting daily signing reminders & renewal job...');

  try {
    const result = await runDailyReminderJob();
    console.info(
      `[CRON_SIGNING_REMINDERS] Completed. Envelopes: ${result.processedEnvelopes}, Reminders: ${result.remindersSent}, Renewals: ${result.renewalsSent}`
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[CRON_SIGNING_REMINDERS] Fatal error during signing reminder job:', message);
    return NextResponse.json({ error: 'Internal reminder job failure', message }, { status: 500 });
  }
}
