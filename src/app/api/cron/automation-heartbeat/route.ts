import { NextResponse } from 'next/server';
import { processScheduledJobsAction } from '@/lib/automation-processor';
import { syncPendingSmsStatuses } from '@/lib/messaging/status-sync-service';
import { authenticateCronRequest } from '@/lib/security/cron-auth';
import { randomUUID } from 'node:crypto';
import { defaultAuditStore, defaultAuditSink } from '@/platform/capabilities/storage/audit-store';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { runRetentionSweep } from '@/lib/meetings/retention-service';

/**
 * Cron endpoint for automation delay jobs, campaign-queued events, and SMS status sync.
 * Secured with Authorization: Bearer $CRON_SECRET (fail-closed).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateCronRequest`.
 * - Phase 11 M0 · T0.8: also seals audit entries whose chain write failed (capability_audit_pending),
 *   so no audit record is lost to contention. Bounded to 200 per run; safe to run concurrently.
 * - Phase 11 M1 · T6: meeting data retention. Opt-in workspaces only, ≤ 5 workspaces and ≤ 50
 *   meetings per run, SHADOW (preview only) unless the workspace switched to enforced after a bound
 *   preview. Failures are isolated per workspace and never block the other heartbeat jobs.
 * - Zero `any` or `any[]` typing.
 */
export async function GET(request: Request) {
  const auth = authenticateCronRequest(request);
  if (!auth.isAuthorized) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [jobResult, syncResult, auditSealResult, retentionResult] = await Promise.all([
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
    runRetentionSweep(adminDb, {
      nowMs: Date.now(),
      storage: { deleteObject: async (path) => { await adminStorage.file(path).delete({ ignoreNotFound: true }); } },
      audit: async (entry) => {
        await defaultAuditSink({
          executionId: randomUUID(),
          capabilityId: 'meeting.run_retention',
          capabilityVersion: '1.0.0',
          userId: 'service:retention',
          agentId: 'service:retention',
          organizationId: '',
          workspaceId: entry.workspaceId,
          correlationId: entry.candidateSetHash,
          decision: 'allowed',
          outcome: 'succeeded',
          durationMs: 0,
          stateChanged: 'yes',
          timestamp: new Date().toISOString(),
          // Ids, counts, plan hash and policy version only; never content (Rule 40).
          inputHash: sha256Hex(entry),
        });
      },
    }).then(
      (runs) => ({ workspaces: runs.length, runs: runs.map((r) => ({ workspaceId: r.workspaceId, mode: r.mode, planned: r.planned, deleted: r.deleted, verified: r.verified })) }),
      (err: unknown) => ({ workspaces: 0, runs: [], error: err instanceof Error ? err.message : String(err) })
    ),
  ]);

  return NextResponse.json({ jobResult, syncResult, auditSealResult, retentionResult });
}
