'use server';

/**
 * SmartSapp Finance 2.0 - Financial Audit Server Actions
 * Queries immutable audit trails with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { ActionResponse, FinancialAuditLog } from './types';
import { FinancialAuditService } from './services/financial-audit-service';

export async function getDocumentAuditHistoryAction(
  documentId: string,
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { logs?: FinancialAuditLog[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const logs = await FinancialAuditService.getDocumentAuditHistory(documentId, workspaceId);
    return { success: true, logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch document audit history';
    return { success: false, error: msg };
  }
}

export async function getRecentFinancialAuditLogsAction(
  workspaceId: string,
  userId: string,
  limitCount: number = 50
): Promise<ActionResponse & { logs?: FinancialAuditLog[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const logs = await FinancialAuditService.getRecentAuditLogs(workspaceId, limitCount);
    return { success: true, logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch financial audit logs';
    return { success: false, error: msg };
  }
}
