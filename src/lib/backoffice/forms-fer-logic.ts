/**
 * SmartSapp Forms 2.0 Backoffice FER (Fetch, Enrich, Restore) Engine
 * 
 * Performs automated health auditing, schema normalization,
 * legacy version synthesis, and zero-downtime data restoration for Forms.
 */

import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '../collection-constants';
import type { Form, AppField } from '../types';
import type { FormVersion } from '../forms/form-types';
import { normalizeFormToVersion } from '../forms/form-compatibility';

export interface FormHealthReport {
  scannedCount: number;
  healthyCount: number;
  repairedCount: number;
  errorsCount: number;
  details: {
    formId: string;
    formTitle: string;
    workspaceId: string;
    status: 'healthy' | 'repaired' | 'error';
    issues: string[];
    repairedActions: string[];
  }[];
}

/**
 * Executes a comprehensive FER audit across forms for a workspace or system-wide.
 */
export async function executeFormsFerAudit(
  workspaceId?: string,
  autoRepair = false
): Promise<FormHealthReport> {
  const report: FormHealthReport = {
    scannedCount: 0,
    healthyCount: 0,
    repairedCount: 0,
    errorsCount: 0,
    details: [],
  };

  try {
    let formsQuery = adminDb.collection(COLLECTIONS.FORMS) as FirebaseFirestore.Query;
    if (workspaceId) {
      formsQuery = formsQuery.where('workspaceId', '==', workspaceId);
    }

    const formsSnap = await formsQuery.get();
    report.scannedCount = formsSnap.size;

    // Fetch fields map
    const fieldsSnap = await adminDb.collection(COLLECTIONS.APP_FIELDS).get();
    const appFieldsMap: Record<string, AppField> = {};
    fieldsSnap.docs.forEach(d => {
      appFieldsMap[d.id] = { id: d.id, ...d.data() } as AppField;
    });

    for (const doc of formsSnap.docs) {
      const form = { id: doc.id, ...doc.data() } as Form;
      const issues: string[] = [];
      const repairedActions: string[] = [];

      // 1. Check if slug exists and is valid
      if (!form.slug) {
        issues.push('Missing URL slug');
      }

      // 2. Check if version snapshot exists
      if (!form.currentVersionId && (!form.fields || form.fields.length === 0)) {
        issues.push('Form has no fields or version snapshots');
      }

      // 3. Auto-Repair if requested
      if (autoRepair && issues.length > 0) {
        const patch: Partial<Form> = {};

        if (!form.slug) {
          patch.slug = `form-${doc.id.substring(0, 8)}`;
          repairedActions.push(`Generated slug: ${patch.slug}`);
        }

        // Synthesize version if missing
        if (!form.currentVersionId && form.fields && form.fields.length > 0) {
          const synthesizedVer = normalizeFormToVersion(form, appFieldsMap);
          const verRef = doc.ref.collection('versions').doc();
          await verRef.set(synthesizedVer);
          patch.currentVersionId = verRef.id;
          repairedActions.push(`Synthesized and saved FormVersion ${verRef.id}`);
        }

        if (Object.keys(patch).length > 0) {
          await doc.ref.update({
            ...patch,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const finalStatus = issues.length === 0 
        ? 'healthy' 
        : (repairedActions.length > 0 ? 'repaired' : 'error');

      if (finalStatus === 'healthy') report.healthyCount++;
      else if (finalStatus === 'repaired') report.repairedCount++;
      else report.errorsCount++;

      report.details.push({
        formId: form.id,
        formTitle: form.internalName || form.title || 'Untitled',
        workspaceId: form.workspaceId,
        status: finalStatus,
        issues,
        repairedActions,
      });
    }

    return report;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:FER_AUDIT] Failed:', msg);
    throw new Error(`Forms FER Audit failed: ${msg}`);
  }
}
