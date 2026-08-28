import { NextResponse } from 'next/server';
import { processScheduledJobsAction } from '@/lib/automation-processor';
import { syncPendingSmsStatuses } from '@/lib/messaging/status-sync-service';
import { authenticateCronRequest } from '@/lib/security/cron-auth';

/**
 * Cron endpoint for automation delay jobs, campaign-queued events, and SMS status sync.
 * Secured with Authorization: Bearer $CRON_SECRET (fail-closed).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateCronRequest`.
 * - Zero `any` or `any[]` typing.
 */
export async function GET(request: Request) {
  const auth = authenticateCronRequest(request);
  if (!auth.isAuthorized) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [jobResult, syncResult] = await Promise.all([
    processScheduledJobsAction(),
    syncPendingSmsStatuses().catch((err: unknown) => ({
      processed: 0,
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    })),
  ]);

  return NextResponse.json({ jobResult, syncResult });
}
