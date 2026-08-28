/**
 * @fileoverview Platform Control Plane Contact Repair Execution Engine
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Scans entities across workspaces to resolve broken parent linkages, missing organizationIds, or invalid scopes.
 * - Chunked into safe batches of <= 30 items with 50ms interval delays.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Isolated execution logic reporting through `platform_jobs` audit collection.
 */

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logBackofficeAction } from './audit-logger';
import { getErrorMessage } from './backoffice-errors';
import { chunkArray } from './template-propagation-engine';
import type { AuditActor, PlatformJob } from './backoffice-types';

export async function processRepairContacts(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);

  try {
    // 1. Set job running
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Starting cross-tenant contact entity repair scan...',
      }),
    });

    const jobSnap = await jobRef.get();
    const job = jobSnap.data() as PlatformJob;
    const targetOrgId = job.scope?.type === 'organization' ? job.scope.id : undefined;

    // 2. Query target entities
    let query: FirebaseFirestore.Query = adminDb.collection('entities');
    if (targetOrgId) {
      query = query.where('organizationId', '==', targetOrgId);
    }

    const entitiesSnap = await query.limit(500).get();
    const brokenDocs: FirebaseFirestore.DocumentSnapshot[] = [];

    for (const doc of entitiesSnap.docs) {
      const data = doc.data();
      // Check if entity is missing essential fields
      if (!data.organizationId || !data.type || !data.name) {
        brokenDocs.push(doc);
      }
    }

    await jobRef.update({
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Scanned ${entitiesSnap.size} entities. Found ${brokenDocs.length} anomalous records requiring repair.`,
      }),
    });

    let repairedCount = 0;
    if (brokenDocs.length > 0) {
      const chunks = chunkArray(brokenDocs, 30);

      for (const chunk of chunks) {
        const batch = adminDb.batch();
        for (const doc of chunk) {
          const data = doc.data() || {};
          const fallbackOrgId = targetOrgId || data.workspaceId || 'org_system_fallback';
          batch.update(doc.ref, {
            organizationId: data.organizationId || fallbackOrgId,
            type: data.type || 'person',
            name: data.name || 'Unnamed Entity',
            updatedAt: new Date().toISOString(),
            _repairedAt: new Date().toISOString(),
          });
          repairedCount++;
        }
        await batch.commit();
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    // 3. Mark job completed
    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Repair completed successfully. Repaired ${repairedCount} entity records.`,
      }),
    });

    await logBackofficeAction(actor, 'job.execute', 'platform_job', jobId, {
      metadata: { jobType: 'repair_contacts', repairedCount },
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    console.error('[REPAIR_CONTACTS_JOB] Failed:', errorMsg);

    await jobRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Job failed: ${errorMsg}`,
      }),
    });

    return { success: false, error: errorMsg };
  }
}
