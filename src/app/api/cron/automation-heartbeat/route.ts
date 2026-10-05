import { NextResponse } from 'next/server';
import { processScheduledJobsAction } from '@/lib/automation-processor';
import { syncPendingSmsStatuses } from '@/lib/messaging/status-sync-service';
import { authenticateCronRequest } from '@/lib/security/cron-auth';
import { defaultAuditStore } from '@/platform/capabilities/storage/audit-store';

/**
 * Cron endpoint for automation delay jobs, campaign-queued events, and SMS status sync.
 * Secured with Authorization: Bearer $CRON_SECRET (fail-closed).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateCronRequest`.
 * - Phase 11 M0 · T0.8: also seals audit entries whose chain write failed (capability_audit_pending),
 *   so no audit record is lost to contention. Bounded to 200 per run; safe to run concurrently.
 * - Zero `any` or `any[]` typing.
 */
export async function GET(request: Request) {
  const auth = authenticateCronRequest(request);
  if (!auth.isAuthorized) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [jobResult, syncResult, auditSealResult] = await Promise.all([
    processScheduledJobsAction(),
    syncPendingSmsStatuses().catch((err: unknown) => ({
      processed: 0,
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    })),
    (defaultAuditStore.sealPending?.(200) ?? Promise.resolve({ sealed: 0, failed: 0 })).catch((err: unknown) => ({
      sealed: 0,
      failed: 0,
      error: err instanceof Error ? err.message : String(err),
    })),
  ]);

  return NextResponse.json({ jobResult, syncResult, auditSealResult });
}
