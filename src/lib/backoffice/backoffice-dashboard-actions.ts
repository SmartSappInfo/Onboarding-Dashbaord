'use server';

import { adminDb } from '../firebase-admin';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';

// ─────────────────────────────────────────────────
// Backoffice Dashboard Server Actions
// Aggregate operational stats for the platform overview.
//
// platform_jobs / platform_audit_logs are client-SDK-denied by Firestore
// rules, so these counts MUST come through an authorized server action
// (server-auth-actions). Uses Admin SDK count() aggregates — no doc reads.
// ─────────────────────────────────────────────────

export interface PlatformOpsStats {
  failedJobs: number;
  pendingJobs: number;
  auditActions24h: number;
}

export async function getPlatformOpsStats(idToken: string): Promise<{
  success: boolean;
  data?: PlatformOpsStats;
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'dashboard', 'view');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [failedSnap, pendingSnap, auditSnap] = await Promise.all([
      adminDb.collection('platform_jobs').where('status', '==', 'failed').count().get(),
      adminDb.collection('platform_jobs').where('status', '==', 'pending').count().get(),
      adminDb.collection('platform_audit_logs').where('timestamp', '>=', since).count().get(),
    ]);

    return {
      success: true,
      data: {
        failedJobs: failedSnap.data().count,
        pendingJobs: pendingSnap.data().count,
        auditActions24h: auditSnap.data().count,
      },
    };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_DASHBOARD] getPlatformOpsStats failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
