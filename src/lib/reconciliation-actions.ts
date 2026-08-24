'use server';

/**
 * SmartSapp Finance 2.0 - Reconciliation Server Actions
 * Server actions for comparing gateway logs and resolving payment discrepancies with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { ActionResponse } from './types';
import { 
  ReconciliationService, 
  ReconciliationReportPayload 
} from './services/reconciliation-service';
import { revalidatePath } from 'next/cache';

export async function getReconciliationReportAction(
  workspaceId: string,
  channel: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  userId: string
): Promise<ActionResponse & { report?: ReconciliationReportPayload }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient viewing permissions.' };
    }

    const report = await ReconciliationService.getReconciliationReport(
      workspaceId,
      channel,
      startDate,
      endDate
    );

    return { success: true, report };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate reconciliation report';
    return { success: false, error: msg };
  }
}

export async function resolveReconciliationDiscrepancyAction(
  paymentId: string,
  resolutionNotes: string,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to resolve discrepancies.' };
    }

    await ReconciliationService.resolveDiscrepancy(
      paymentId,
      resolutionNotes,
      workspaceId,
      userId,
      userName
    );

    revalidatePath('/admin/finance/reconciliation');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resolve reconciliation discrepancy';
    return { success: false, error: msg };
  }
}
