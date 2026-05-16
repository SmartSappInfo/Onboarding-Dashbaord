'use server';

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { processRbacMigration } from './rbac-migration-logic';
import type { AuditActor, PlatformJob, PlatformJobType } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Job Actions
// Operations for managing background platform jobs, migrations and diagnostics.
// ─────────────────────────────────────────────────

export async function listAllJobs(): Promise<{
  success: boolean;
  data?: PlatformJob[];
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('platform_jobs').orderBy('createdAt', 'desc').limit(100).get();
    const jobs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformJob));

    return { success: true, data: jobs };
  } catch (error: any) {
    console.error('[BACKOFFICE_JOBS] listAllJobs failed:', error);
    return { success: false, error: error.message };
  }
}

export async function createJob(
  payload: {
    type: PlatformJobType;
    label: string;
    description?: string;
    scope: { type: 'platform' | 'organization' | 'workspace', id?: string };
    isDryRun: boolean;
  },
  actor: AuditActor
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
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
      after: createAuditSnapshot(newJob as any),
      metadata: { type: payload.type, isDryRun: payload.isDryRun }
    });

    return { success: true, data: docRef.id };
  } catch (error: any) {
    console.error('[BACKOFFICE_JOBS] createJob failed:', error);
    return { success: false, error: error.message };
  }
}

export async function cancelJob(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_JOBS] cancelJob failed:', error);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────
// Diagnostics Actions
// ─────────────────────────────────────────────────

export async function runTenantDiagnostics(
  scopeType: 'organization' | 'workspace',
  scopeId: string,
  actor: AuditActor
): Promise<{ 
   success: boolean; 
   data?: { issues: any[], stats: any, timestamp: string }; 
   error?: string 
}> {
  try {
     // This is a stub for the heavy diagnostics engine.
     // In a real execution, it would crawl configuration anomalies.
     const issues = [];
     const stats = { configChecks: 34, schemaValidations: 12, passed: true };

     // For demonstration, arbitrarily finding an issue if the ID has a 1 in it.
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
  } catch (error: any) {
    console.error('[BACKOFFICE_DIAGNOSTICS] runTenantDiagnostics failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Executes a pending platform job.
 * Dispatches to specific handlers based on job type.
 */
export async function executeJob(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const jobSnap = await adminDb.collection('platform_jobs').doc(jobId).get();
    if (!jobSnap.exists) throw new Error('Job not found');

    const job = jobSnap.data() as PlatformJob;

    if (job.status === 'running' || job.status === 'completed') {
      throw new Error(`Job is already ${job.status}`);
    }

    // Router
    switch (job.type) {
      case 'migrate_hierarchical_rbac':
        // This is a long running task. In a real environment, 
        // you might want to return early and run this in a worker.
        // For now, we await the completion.
        return await processRbacMigration(jobId, actor);
      
      case 'migrate_legacy_saas_fields':
        return await processSaasFieldMigration(jobId, actor);
      
      default:
        throw new Error(`Execution logic for job type "${job.type}" is not yet implemented.`);
    }
  } catch (error: any) {
    console.error('[BACKOFFICE_JOBS] executeJob failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Migration Protocol: Re-parents legacy SaaS fields.
 * Safely migrates fields tied to the old `company_metrics` group 
 * into the modern `saas_operations` group.
 */
export async function processSaasFieldMigration(
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
    let errors = 0;

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
  } catch (error: any) {
    console.error('[MIGRATION] processSaasFieldMigration failed:', error);
    
    // Fail job
    await adminDb.collection('platform_jobs').doc(jobId).update({
        status: 'failed',
        'logs': FieldValue.arrayUnion({
           timestamp: new Date().toISOString(),
           level: 'error',
           message: `Migration failed: ${error.message}`
        })
    });

    return { success: false, error: error.message };
  }
}
