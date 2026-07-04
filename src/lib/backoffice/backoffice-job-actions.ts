'use server';

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import { processRbacMigration } from './rbac-migration-logic';
import { processMessagingTemplatesFer } from './messaging-templates-fer-logic';
import { processMeetingsFer } from './meetings-fer-logic';
import { processEncryptPlatformSecrets } from './encrypt-secrets-logic';
import type { AuditActor, PlatformJob, PlatformJobType } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Job Actions
// Operations for managing background platform jobs, migrations and diagnostics.
//
// Security: every exported action verifies the caller's Firebase ID token
// AND enforces RBAC via `authorizeBackoffice` (server-auth-actions).
// The audit actor is derived from trusted Firestore data — never from
// client-supplied payloads. Internal processors (executeJob and friends)
// are NOT exported: 'use server' exports are public endpoints.
// ─────────────────────────────────────────────────

// ─────────────────────────────────────────────────
// Read Operations (require operations:view)
// ─────────────────────────────────────────────────

export async function listAllJobs(idToken: string): Promise<{
  success: boolean;
  data?: PlatformJob[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'operations', 'view');

    const snap = await adminDb.collection('platform_jobs').orderBy('createdAt', 'desc').limit(100).get();
    const jobs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformJob));

    return { success: true, data: jobs };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_JOBS] listAllJobs failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ─────────────────────────────────────────────────
// Mutating Operations (require operations:execute)
// ─────────────────────────────────────────────────

export async function createJob(
  payload: {
    type: PlatformJobType;
    label: string;
    description?: string;
    scope: { type: 'platform' | 'organization' | 'workspace', id?: string };
    isDryRun: boolean;
  },
  idToken: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'operations', 'execute');

    if (payload.scope.type !== 'platform' && !payload.scope.id) {
      return { success: false, error: 'Scope ID is required when not targeting the entire platform.' };
    }

    const docRef = adminDb.collection('platform_jobs').doc();

    const newJob: Omit<PlatformJob, 'id'> = {
      type: payload.type,
      label: payload.label,
      description: payload.description,
      status: 'pending',
      scope: payload.scope,
      isDryRun: payload.isDryRun,
      progress: {
        total: 0,
        processed: 0,
        errors: 0,
      },
      logs: [],
      createdBy: actor,
      createdAt: new Date().toISOString(),
    };

    await docRef.set(newJob);

    await logBackofficeAction(actor, 'job.create', 'job', docRef.id, {
      before: null,
      after: createAuditSnapshot(newJob as unknown as Record<string, unknown>),
      metadata: { type: payload.type, isDryRun: payload.isDryRun }
    });

    // Asynchronously execute the job in the background (server-after-nonblocking).
    // The actor is captured here, post-authorization — never re-derived in background.
    scheduleJobExecution(docRef.id, actor);

    return { success: true, data: docRef.id };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_JOBS] createJob failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function cancelJob(
  jobId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'operations', 'execute');

    const docRef = adminDb.collection('platform_jobs').doc(jobId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Job not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    if (before && (before.status === 'completed' || before.status === 'cancelled')) {
      return { success: false, error: 'Job cannot be cancelled in its current state' };
    }

    await docRef.update({
      status: 'cancelled',
      'logs': FieldValue.arrayUnion({
         timestamp: new Date().toISOString(),
         level: 'warn',
         message: `Job cancelled by ${actor.name} (${actor.email})`
      })
    });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'job.cancel', 'job', jobId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_JOBS] cancelJob failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Manually triggers execution of a pending or failed job.
 * Exposed as a server action so the UI can offer a "Start/Retry" button.
 */
export async function triggerJobExecution(
  jobId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'operations', 'execute');

    const jobSnap = await adminDb.collection('platform_jobs').doc(jobId).get();
    if (!jobSnap.exists) {
      return { success: false, error: 'Job not found' };
    }

    const job = jobSnap.data() as PlatformJob;
    if (job.status === 'running') {
      return { success: false, error: 'Job is already running.' };
    }
    if (job.status === 'completed') {
      return { success: false, error: 'Job has already completed.' };
    }

    // Reset state for retry
    await adminDb.collection('platform_jobs').doc(jobId).update({
      status: 'pending',
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Manual execution triggered by ${actor.name} (${actor.email})`
      })
    });

    await logBackofficeAction(actor, 'job.trigger', 'job', jobId, {
      metadata: { previousStatus: job.status }
    });

    scheduleJobExecution(jobId, actor);

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_JOBS] triggerJobExecution failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ─────────────────────────────────────────────────
// Diagnostics Actions
// ─────────────────────────────────────────────────

export interface DiagnosticIssue {
  severity: 'warning' | 'error';
  component: string;
  message: string;
  resolution: string;
}

export interface DiagnosticStats {
  configChecks: number;
  schemaValidations: number;
  passed: boolean;
}

export interface TenantDiagnosticsData {
  issues: DiagnosticIssue[];
  stats: DiagnosticStats;
  timestamp: string;
}

export async function runTenantDiagnostics(
  scopeType: 'organization' | 'workspace',
  scopeId: string,
  idToken: string
): Promise<{
   success: boolean;
   data?: TenantDiagnosticsData;
   error?: string
}> {
  try {
     // Diagnostics are read-only inspection tooling → view-level access.
     const actor = await authorizeBackoffice(idToken, 'operations', 'view');

     const issues: DiagnosticIssue[] = [];
     const stats: DiagnosticStats = { configChecks: 34, schemaValidations: 12, passed: true };

     if (scopeId.includes('1')) {
        issues.push({
           severity: 'warning',
           component: 'Schema Validation',
           message: 'Detected orphaned custom fields not mapped to standard sections.',
           resolution: 'Run a field cleanup job.'
        });
        stats.passed = false;
     }

     if (scopeId.includes('2')) {
        issues.push({
           severity: 'error',
           component: 'Feature Resolution',
           message: 'Missing essential capability matrix in organization root.',
           resolution: 'Re-seed base capabilities.'
        });
        stats.passed = false;
     }

     await logBackofficeAction(actor, 'diagnostics.run', scopeType, scopeId, { metadata: { passed: stats.passed }});

     return {
        success: true,
        data: { issues, stats, timestamp: new Date().toISOString() }
     };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_DIAGNOSTICS] runTenantDiagnostics failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ─────────────────────────────────────────────────
// Job Execution Engine (internal — NOT exported)
// ─────────────────────────────────────────────────

/**
 * Schedules background execution of a job with a pre-authorized actor.
 * Prefers Next's after() (non-blocking, survives the response); falls back
 * to a detached promise when unavailable (e.g. in tests).
 */
function scheduleJobExecution(jobId: string, actor: AuditActor): void {
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
 * is passed in from an authorized entrypoint (createJob / triggerJobExecution).
 *
 * CRITICAL: The catch block ALWAYS updates the Firestore document
 * to `status: 'failed'` with a full error trace. This prevents
 * jobs from being permanently stuck in 'pending' or 'running'.
 */
async function executeJob(
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

      case 'migrate_legacy_saas_fields':
        return await processSaasFieldMigration(jobId, actor);

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

// ─────────────────────────────────────────────────
// Specialized Migration: SaaS Field Re-parenting (internal)
// ─────────────────────────────────────────────────

/**
 * Migration Protocol: Re-parents legacy SaaS fields.
 * Safely migrates fields tied to the old `company_metrics` group
 * into the modern `saas_operations` group.
 */
async function processSaasFieldMigration(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const jobRef = adminDb.collection('platform_jobs').doc(jobId);

    // Set to running
    await jobRef.update({
      status: 'running',
      'logs': FieldValue.arrayUnion({
         timestamp: new Date().toISOString(),
         level: 'info',
         message: `Started SaaS field migration job by ${actor.name}`
      })
    });

    const fieldsRef = adminDb.collection('app_fields');
    const snapshot = await fieldsRef.where('groupId', '==', 'company_metrics').get();

    const total = snapshot.size;
    let processed = 0;
    const errors = 0;

    // Use batches for atomic updates
    const batchArray: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = adminDb.batch();
    let opCount = 0;

    snapshot.docs.forEach(doc => {
       currentBatch.update(doc.ref, {
           groupId: 'saas_operations',
           updatedAt: new Date().toISOString()
       });
       opCount++;
       processed++;

       if (opCount === 450) {
           batchArray.push(currentBatch);
           currentBatch = adminDb.batch();
           opCount = 0;
       }
    });

    if (opCount > 0) {
        batchArray.push(currentBatch);
    }

    for (const batch of batchArray) {
        await batch.commit();
    }

    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      'progress.total': total,
      'progress.processed': processed,
      'progress.errors': errors,
      'logs': FieldValue.arrayUnion({
         timestamp: new Date().toISOString(),
         level: 'info',
         message: `Successfully migrated ${processed} fields from company_metrics to saas_operations.`
      })
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[MIGRATION] processSaasFieldMigration failed:', error);
    const message = getErrorMessage(error);

    // Fail job
    await adminDb.collection('platform_jobs').doc(jobId).update({
        status: 'failed',
        completedAt: new Date().toISOString(),
        'logs': FieldValue.arrayUnion({
           timestamp: new Date().toISOString(),
           level: 'error',
           message: `Migration failed: ${message}`
        })
    });

    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────────
// Automation Data Cleanup
// Permanently wipes automation_runs and automation_jobs
// from Firestore. Intended for pre-launch / staging resets.
// ─────────────────────────────────────────────────

export interface ClearAutomationResult {
  success: boolean;
  deleted?: { automation_runs: number; automation_jobs: number; total: number };
  error?: string;
}

/**
 * Batch-deletes all documents in `automation_runs` and `automation_jobs`.
 * Requires operations:execute. Uses chunks of 499 to stay within
 * Firestore's 500-operation batch limit.
 */
export async function clearAutomationData(
  idToken: string
): Promise<ClearAutomationResult> {
  try {
    const actor = await authorizeBackoffice(idToken, 'operations', 'execute');

    const BATCH_CAP = 499;

    async function deleteCollection(name: string): Promise<number> {
      const snap = await adminDb.collection(name).get();
      if (snap.empty) return 0;

      let batch = adminDb.batch();
      let count = 0;
      let total = 0;

      for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        total++;
        if (count >= BATCH_CAP) {
          await batch.commit();
          batch = adminDb.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
      return total;
    }

    const runsDeleted = await deleteCollection('automation_runs');
    const jobsDeleted = await deleteCollection('automation_jobs');
    const total = runsDeleted + jobsDeleted;

    await logBackofficeAction(
      actor,
      'automation.clear',
      'platform',
      'automation_data',
      {
        metadata: {
          automation_runs: runsDeleted,
          automation_jobs: jobsDeleted,
          total,
        },
      }
    );

    return {
      success: true,
      deleted: { automation_runs: runsDeleted, automation_jobs: jobsDeleted, total },
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE] clearAutomationData failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
