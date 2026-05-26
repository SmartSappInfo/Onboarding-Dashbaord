import { NextResponse } from 'next/server';
import { processScheduledJobsAction } from '@/lib/automation-processor';

/**
 * Cron endpoint for automation delay jobs and campaign-queued events.
 * Secured with Authorization: Bearer $CRON_SECRET (Google Cloud Scheduler on Firebase App Hosting).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processScheduledJobsAction();
  return NextResponse.json(result);
}
