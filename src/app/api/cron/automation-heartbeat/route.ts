import { NextResponse } from 'next/server';
import { processScheduledJobsAction } from '@/lib/automation-processor';
import { syncPendingSmsStatuses } from '@/lib/messaging/status-sync-service';

/**
 * Cron endpoint for automation delay jobs, campaign-queued events, and SMS status sync.
 * Secured with Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [jobResult, syncResult] = await Promise.all([
    processScheduledJobsAction(),
    syncPendingSmsStatuses().catch((err: unknown) => ({
      processed: 0,
      success: false,
      errors: [err instanceof Error ? err.message : String(err)]
    }))
  ]);

  return NextResponse.json({ jobResult, syncResult });
}
