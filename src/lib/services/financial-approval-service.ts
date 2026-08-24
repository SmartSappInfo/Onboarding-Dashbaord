/**
 * SmartSapp Finance 2.0 - Financial Approval & Governance Service
 * Manages institutional signoff thresholds, manager decision queues, and self-approval prevention.
 */

import { adminDb } from '../firebase-admin';
import { 
  FinancialApprovalPolicy, 
  FinancialApprovalRequest, 
  ApprovalRequestType, 
  ApprovalStatus 
} from '../types';
import { logActivity } from '../activity-logger';
import { FinancialAuditService } from './financial-audit-service';

export interface CreateApprovalRequestInput {
  organizationId: string;
  workspaceId: string;
  requestType: ApprovalRequestType;
  referenceId: string;
  referenceNumber?: string;
  entityId: string;
  entityName: string;
  amount: number;
  currency: string;
  reason: string;
  requestedByUserId: string;
  requestedByName: string;
  metadata?: Record<string, unknown>;
}

export interface DecideApprovalRequestInput {
  requestId: string;
  decision: 'approved' | 'rejected';
  decisionNotes?: string;
  decidedByUserId: string;
  decidedByName: string;
}

export class FinancialApprovalService {
  /**
   * Retrieves the approval policy for a workspace (or default fallbacks).
   */
  static async getPolicy(workspaceId: string): Promise<FinancialApprovalPolicy> {
    const docRef = adminDb.collection('financial_approval_policies').doc(workspaceId);
    const snap = await docRef.get();

    if (snap.exists) {
      return { id: snap.id, ...(snap.data() as Omit<FinancialApprovalPolicy, 'id'>) };
    }

    return {
      workspaceId,
      refundThreshold: 5000,
      writeOffThreshold: 10000,
      requireVoidApproval: true,
      requireCreditNoteApprovalThreshold: 5000,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates or creates the approval policy.
   */
  static async savePolicy(
    workspaceId: string,
    policy: Partial<FinancialApprovalPolicy>
  ): Promise<FinancialApprovalPolicy> {
    const timestamp = new Date().toISOString();
    const updated: FinancialApprovalPolicy = {
      workspaceId,
      refundThreshold: policy.refundThreshold ?? 5000,
      writeOffThreshold: policy.writeOffThreshold ?? 10000,
      requireVoidApproval: policy.requireVoidApproval ?? true,
      requireCreditNoteApprovalThreshold: policy.requireCreditNoteApprovalThreshold ?? 5000,
      updatedAt: timestamp,
    };

    await adminDb.collection('financial_approval_policies').doc(workspaceId).set(updated, { merge: true });
    return updated;
  }

  /**
   * Checks whether a proposed action requires manager approval.
   */
  static async requiresApproval(
    workspaceId: string,
    requestType: ApprovalRequestType,
    amount: number
  ): Promise<boolean> {
    const policy = await this.getPolicy(workspaceId);

    switch (requestType) {
      case 'refund':
        return amount >= policy.refundThreshold;
      case 'write_off':
        return amount >= policy.writeOffThreshold;
      case 'credit_note':
        return amount >= (policy.requireCreditNoteApprovalThreshold || 5000);
      case 'void_issued_invoice':
        return policy.requireVoidApproval;
      default:
        return false;
    }
  }

  /**
   * Submits a new financial approval request.
   */
  static async createApprovalRequest(
    input: CreateApprovalRequestInput
  ): Promise<FinancialApprovalRequest> {
    const timestamp = new Date().toISOString();

    const data: Omit<FinancialApprovalRequest, 'id'> = {
      organizationId: input.organizationId,
      workspaceIds: [input.workspaceId],
      requestType: input.requestType,
      referenceId: input.referenceId,
      referenceNumber: input.referenceNumber,
      entityId: input.entityId,
      entityName: input.entityName,
      amount: Math.round(input.amount * 100) / 100,
      currency: input.currency,
      reason: input.reason,
      status: 'pending',
      requestedByUserId: input.requestedByUserId,
      requestedByName: input.requestedByName,
      requestedAt: timestamp,
      metadata: input.metadata || {},
    };

    const docRef = await adminDb.collection('financial_approval_requests').add(data);

    // Audit log
    await FinancialAuditService.logAction({
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      action: 'approval.requested',
      entityId: input.entityId,
      entityName: input.entityName,
      documentType: 'approval_request',
      documentId: docRef.id,
      documentNumber: input.referenceNumber,
      amount: input.amount,
      currency: input.currency,
      performedByUserId: input.requestedByUserId,
      performedByName: input.requestedByName,
      changeSummary: `Submitted ${input.requestType.toUpperCase()} approval request for ${input.currency} ${input.amount.toLocaleString()}`,
    });

    return { id: docRef.id, ...data };
  }

  /**
   * Processes a manager's decision (Approve / Reject) with self-approval prevention.
   */
  static async decideApprovalRequest(
    input: DecideApprovalRequestInput
  ): Promise<FinancialApprovalRequest> {
    const { requestId, decision, decisionNotes, decidedByUserId, decidedByName } = input;
    const docRef = adminDb.collection('financial_approval_requests').doc(requestId);

    const { updatedRequest, newStatus } = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new Error('Approval request not found');

      const request = { id: snap.id, ...(snap.data() as Omit<FinancialApprovalRequest, 'id'>) };

      if (request.status !== 'pending') {
        throw new Error(`Approval request has already been ${request.status}`);
      }

      // Strict Segregation of Duties: cannot approve your own request
      if (request.requestedByUserId === decidedByUserId) {
        throw new Error('Unauthorized: Segregation of duties policy prohibits approving your own financial request.');
      }

      const timestamp = new Date().toISOString();
      const statusVal: ApprovalStatus = decision === 'approved' ? 'approved' : 'rejected';

      const updates: Partial<FinancialApprovalRequest> = {
        status: statusVal,
        decidedByUserId,
        decidedByName,
        decidedAt: timestamp,
        decisionNotes: decisionNotes || '',
      };

      tx.update(docRef, updates);
      return { updatedRequest: { ...request, ...updates }, newStatus: statusVal };
    });

    // Audit log
    await FinancialAuditService.logAction({
      workspaceId: updatedRequest.workspaceIds[0],
      organizationId: updatedRequest.organizationId,
      action: 'approval.decided',
      entityId: updatedRequest.entityId,
      entityName: updatedRequest.entityName,
      documentType: 'approval_request',
      documentId: requestId,
      documentNumber: updatedRequest.referenceNumber,
      amount: updatedRequest.amount,
      currency: updatedRequest.currency,
      performedByUserId: decidedByUserId,
      performedByName: decidedByName,
      changeSummary: `${decision.toUpperCase()} ${updatedRequest.requestType.toUpperCase()} request for ${updatedRequest.currency} ${updatedRequest.amount.toLocaleString()}`,
    });

    await logActivity({
      userId: decidedByUserId,
      organizationId: updatedRequest.organizationId,
      workspaceId: updatedRequest.workspaceIds[0],
      type: 'interaction',
      source: 'finance_engine',
      description: `[Approval ${newStatus.toUpperCase()}] ${decidedByName} ${newStatus} ${updatedRequest.requestType} for ${updatedRequest.entityName} (${updatedRequest.currency} ${updatedRequest.amount.toLocaleString()})`,
      entityId: updatedRequest.entityId,
    });

    return updatedRequest;
  }
}
