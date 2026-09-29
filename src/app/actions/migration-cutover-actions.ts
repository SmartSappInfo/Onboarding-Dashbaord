'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Migration & Cutover Server Actions (Phase 7):
 * 1. Purpose (DocSigning_roadmap.md §13 & §17):
 *    Provides strictly typed, tenant-scoped Next.js Server Actions for:
 *    - Running live bounded-batch backfill with resumable cursor checkpoints.
 *    - Querying migration run status and quarantined anomaly counts.
 *    - Triggering automated data reconciliation and integrity audits.
 *    - Managing canary rollout cohort percentages (0% -> 100% GA).
 *    - Emergency 1-click lossless rollback execution.
 *    - Exporting downloadable CSV/JSON reconciliation audit reports.
 * 2. Security & Multi-Tenant Isolation (Rule 5 & 8):
 *    All actions enforce `requireWorkspace(workspaceId)` before execution.
 *    System admins or workspace members are verified server-side via session cookies.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import {
  MigrationRun,
  MigrationRunSchema,
  ReconciliationReport,
  ReconciliationReportSchema,
  RolloutCohortConfig,
} from '@/lib/types/document-signing';
import { executeMigrationBatch } from '@/lib/documents/live-migration-backfill-service';
import {
  auditWorkspaceDataReconciliation,
  formatReconciliationCsv,
  formatReconciliationJson,
} from '@/lib/documents/data-reconciliation-service';
import {
  getWorkspaceRolloutCohort,
  updateWorkspaceRolloutCohort,
  triggerEmergencyRollback,
} from '@/lib/documents/rollout-switchboard-service';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function formatActionError(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof Error) {
    return { success: false, error: err.message || fallback };
  }
  return { success: false, error: fallback };
}

export interface StartMigrationRunInput {
  workspaceId: string;
  batchSize?: number;
  dryRun?: boolean;
  resumeFromCursor?: string;
}

/**
 * Initiates a bounded batch migration run for the workspace.
 */
export async function startMigrationRunAction(
  input: StartMigrationRunInput
): Promise<ActionResponse<MigrationRun>> {
  try {
    const ctx = await requireWorkspace(input.workspaceId);
    const runId = `mig_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const run = await executeMigrationBatch({
      workspaceId: input.workspaceId,
      runId,
      batchSize: input.batchSize ?? 25,
      cursor: input.resumeFromCursor ?? null,
      isDryRun: input.dryRun ?? false,
      initiatedByUserId: ctx.uid,
    });

    revalidatePath('/admin/finance/contracts');
    return { success: true, data: run };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to initiate migration run.');
  }
}

export interface GetMigrationStatusResult {
  latestRun: MigrationRun | null;
  quarantineCount: number;
}

/**
 * Retrieves the latest migration run status and quarantine record count.
 */
export async function getMigrationStatusAction(
  workspaceId: string
): Promise<ActionResponse<GetMigrationStatusResult>> {
  try {
    await requireWorkspace(workspaceId);

    const [runsSnap, quarantineSnap] = await Promise.all([
      adminDb
        .collection(`workspaces/${workspaceId}/migration_runs`)
        .orderBy('startedAt', 'desc')
        .limit(1)
        .get(),
      adminDb
        .collection(`workspaces/${workspaceId}/migration_quarantine`)
        .count()
        .get(),
    ]);

    let latestRun: MigrationRun | null = null;
    if (!runsSnap.empty) {
      const parsed = MigrationRunSchema.safeParse(runsSnap.docs[0].data());
      if (parsed.success) {
        latestRun = parsed.data;
      }
    }

    const quarantineCount = quarantineSnap.data().count;

    return {
      success: true,
      data: {
        latestRun,
        quarantineCount,
      },
    };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to fetch migration status.');
  }
}

export interface RunReconciliationAuditInput {
  workspaceId: string;
  checkArtifactHashes?: boolean;
}

/**
 * Triggers an automated data reconciliation audit between legacy and modern collections.
 */
export async function runReconciliationAuditAction(
  input: RunReconciliationAuditInput
): Promise<ActionResponse<ReconciliationReport>> {
  try {
    await requireWorkspace(input.workspaceId);
    const report = await auditWorkspaceDataReconciliation(input.workspaceId);

    revalidatePath('/admin/finance/contracts');
    return { success: true, data: report };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to run reconciliation audit.');
  }
}

/**
 * Retrieves the current canary rollout cohort configuration.
 */
export async function getRolloutCohortAction(
  workspaceId: string
): Promise<ActionResponse<RolloutCohortConfig>> {
  try {
    await requireWorkspace(workspaceId);
    const config = await getWorkspaceRolloutCohort(workspaceId);
    return { success: true, data: config };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to retrieve rollout cohort config.');
  }
}

export interface UpdateRolloutCohortInput {
  workspaceId: string;
  cohortPercentage?: number;
  legacyDualWriteEnabled?: boolean;
  shadowReadsEnabled?: boolean;
}

/**
 * Updates the canary rollout cohort configuration.
 */
export async function updateRolloutCohortAction(
  input: UpdateRolloutCohortInput
): Promise<ActionResponse<RolloutCohortConfig>> {
  try {
    const ctx = await requireWorkspace(input.workspaceId);
    const updated = await updateWorkspaceRolloutCohort(
      input.workspaceId,
      {
        cohortPercentage: input.cohortPercentage,
        legacyDualWriteEnabled: input.legacyDualWriteEnabled,
        shadowReadsEnabled: input.shadowReadsEnabled,
      },
      ctx.uid
    );

    revalidatePath('/admin/finance/contracts');
    return { success: true, data: updated };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to update rollout cohort config.');
  }
}

export interface TriggerEmergencyRollbackInput {
  workspaceId: string;
  reason: string;
}

/**
 * Immediately triggers an emergency rollback, forcing all traffic back to legacy mode.
 */
export async function triggerEmergencyRollbackAction(
  input: TriggerEmergencyRollbackInput
): Promise<ActionResponse<RolloutCohortConfig>> {
  try {
    const ctx = await requireWorkspace(input.workspaceId);
    const rolledBack = await triggerEmergencyRollback(
      input.workspaceId,
      input.reason,
      ctx.uid
    );

    revalidatePath('/admin/finance/contracts');
    return { success: true, data: rolledBack };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to trigger emergency rollback.');
  }
}

export interface ExportReconciliationReportInput {
  workspaceId: string;
  reportId: string;
  format: 'csv' | 'json';
}

export interface ExportReconciliationReportResult {
  payload: string;
  format: 'csv' | 'json';
  filename: string;
}

/**
 * Exports a reconciliation audit report as a downloadable CSV or JSON payload.
 */
export async function exportReconciliationReportAction(
  input: ExportReconciliationReportInput
): Promise<ActionResponse<ExportReconciliationReportResult>> {
  try {
    await requireWorkspace(input.workspaceId);

    const docSnap = await adminDb
      .collection(`workspaces/${input.workspaceId}/reconciliation_reports`)
      .doc(input.reportId)
      .get();

    if (!docSnap.exists) {
      return { success: false, error: 'Reconciliation report not found.' };
    }

    const parsed = ReconciliationReportSchema.safeParse(docSnap.data());
    if (!parsed.success) {
      return { success: false, error: 'Invalid reconciliation report format.' };
    }

    const report = parsed.data;
    const payload =
      input.format === 'csv'
        ? formatReconciliationCsv(report)
        : formatReconciliationJson(report);

    const filename = `reconciliation-${report.reportId}.${input.format}`;

    return {
      success: true,
      data: {
        payload,
        format: input.format,
        filename,
      },
    };
  } catch (err: unknown) {
    return formatActionError(err, 'Failed to export reconciliation report.');
  }
}
