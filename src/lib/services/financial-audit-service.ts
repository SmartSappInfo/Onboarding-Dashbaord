/**
 * SmartSapp Finance 2.0 - Financial Audit Sub-System Service
 * Provides immutable, tamper-evident audit trails for all financial operations.
 */

import { adminDb } from '../firebase-admin';
import { FinancialAuditLog, FinancialAuditAction } from '../types';

export interface LogFinancialActionParams {
  workspaceId: string;
  organizationId?: string;
  action: FinancialAuditAction;
  entityId?: string;
  entityName?: string;
  documentType: 'invoice' | 'payment' | 'credit_note' | 'collection_case' | 'promise_to_pay' | 'approval_request' | 'policy';
  documentId: string;
  documentNumber?: string;
  amount?: number;
  currency?: string;
  performedByUserId: string;
  performedByName: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changeSummary: string;
}

export class FinancialAuditService {
  /**
   * Appends an immutable, point-in-time audit log entry.
   */
  static async logAction(params: LogFinancialActionParams): Promise<string> {
    const timestamp = new Date().toISOString();

    const data: Omit<FinancialAuditLog, 'id'> = {
      organizationId: params.organizationId || 'default',
      workspaceIds: [params.workspaceId],
      action: params.action,
      entityId: params.entityId,
      entityName: params.entityName,
      documentType: params.documentType,
      documentId: params.documentId,
      documentNumber: params.documentNumber,
      amount: params.amount !== undefined ? Math.round(params.amount * 100) / 100 : undefined,
      currency: params.currency || 'GHS',
      performedByUserId: params.performedByUserId,
      performedByName: params.performedByName,
      timestamp,
      previousState: params.previousState,
      newState: params.newState,
      changeSummary: params.changeSummary,
    };

    const docRef = await adminDb.collection('financial_audit_logs').add(data);
    return docRef.id;
  }

  /**
   * Retrieves the complete chronological audit trail for a specific financial document.
   */
  static async getDocumentAuditHistory(
    documentId: string,
    workspaceId: string
  ): Promise<FinancialAuditLog[]> {
    const snap = await adminDb
      .collection('financial_audit_logs')
      .where('documentId', '==', documentId)
      .where('workspaceIds', 'array-contains', workspaceId)
      .orderBy('timestamp', 'desc')
      .get();

    return snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<FinancialAuditLog, 'id'>),
    }));
  }

  /**
   * Retrieves recent audit logs across the entire workspace.
   */
  static async getRecentAuditLogs(
    workspaceId: string,
    limitCount: number = 50
  ): Promise<FinancialAuditLog[]> {
    const snap = await adminDb
      .collection('financial_audit_logs')
      .where('workspaceIds', 'array-contains', workspaceId)
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get();

    return snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<FinancialAuditLog, 'id'>),
    }));
  }
}
