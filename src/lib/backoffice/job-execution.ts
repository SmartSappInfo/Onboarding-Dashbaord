// NOTE: intentionally NOT 'use server' — internal job execution engine,
// invoked only from already-authorized entrypoints (backoffice-job-actions,
// approval-registry). Exporting these from a 'use server' module would make
// (jobId, actor) a public endpoint with a spoofable actor.

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getErrorMessage } from './backoffice-errors';
import { processRbacMigration } from './rbac-migration-logic';
import { processMessagingTemplatesFer } from './messaging-templates-fer-logic';
import { processMeetingsFer } from './meetings-fer-logic';
import { processEncryptPlatformSecrets } from './encrypt-secrets-logic';
import type { AuditActor, PlatformJob } from './backoffice-types';

/**
 * Schedules background execution of a job with a pre-authorized actor.
 * Prefers Next's after() (non-blocking, survives the response); falls back
 * to a detached promise when unavailable (e.g. in tests).
 */
export function scheduleJobExecution(jobId: string, actor: AuditActor): void {
  try {
    const { unstable_after } = require('next/server') as { unstable_after: (fn: () => Promise<void>) => void };
    unstable_after(async () => {
      await executeJob(jobId, actor);
    });
  } catch {
    executeJob(jobId, actor).catch((err: unknown) => {
      console.error('[BACKOFFICE_JOBS] Background job execution failed:', err);
    });
  }
}

/**
 * Executes a pending platform job.
 * Dispatches to specific handlers based on job type.
 *
 * Internal only: callers must already hold operations:execute — the actor
 * is passed in from an authorized entrypoint.
 *
 * CRITICAL: The catch block ALWAYS updates the Firestore document
 * to `status: 'failed'` with a full error trace. This prevents
 * jobs from being permanently stuck in 'pending' or 'running'.
 */
export async function executeJob(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);

  try {
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) throw new Error('Job not found');

    const job = jobSnap.data() as PlatformJob;

    if (job.status === 'running' || job.status === 'completed') {
      throw new Error(`Job is already ${job.status}`);
    }

    // Router — dispatch to the correct handler
    switch (job.type) {
      case 'migrate_hierarchical_rbac':
        return await processRbacMigration(jobId, actor);

      // 'migrate_legacy_saas_fields' (company_metrics → saas_operations
      // re-parenting) was retired after being applied in all environments;
      // nothing creates company_metrics fields anymore. The type stays in
      // PlatformJobType so historical job documents still render.

      case 'migrate_messaging_templates_fer':
        return await processMessagingTemplatesFer(jobId, actor);

      case 'migrate_meetings_fer':
        return await processMeetingsFer(jobId, actor);

      case 'encrypt_platform_secrets':
        return await processEncryptPlatformSecrets(jobId, actor);

      // NOTE: the former generic job types (reseed_templates, reindex_search,
      // repair_contacts, backfill_analytics, migrate_data, rebuild_variables,
      // fix_duplicate_slugs, replay_webhooks, retry_campaigns, restore_archived)
      // were removed — they executed a no-op processor that logged a fabricated
      // success message. Re-add a type only together with a real handler.
      default:
        throw new Error(`Execution logic for job type "${job.type}" is not yet implemented.`);
    }
  } catch (error: unknown) {
    // CRITICAL: Always mark the job as failed in Firestore so it never
    // gets permanently stuck in 'pending' or 'running'.
    console.error('[BACKOFFICE_JOBS] executeJob failed:', error);
    const message = getErrorMessage(error);

    try {
      await jobRef.update({
        status: 'failed',
        completedAt: new Date().toISOString(),
        'logs': FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Execution failed: ${message || 'Unknown error'}`
        })
      });
    } catch (updateErr) {
      console.error('[BACKOFFICE_JOBS] Failed to update job status to failed:', updateErr);
    }

    return { success: false, error: message };
  }
}
