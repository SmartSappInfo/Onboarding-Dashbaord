'use server';

/**
 * SmartSapp Finance 2.0 - Financial Approval Server Actions
 * Server actions for submitting and deciding governance approval requests with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { 
  ActionResponse, 
  FinancialApprovalRequest, 
  FinancialApprovalPolicy 
} from './types';
import { 
  FinancialApprovalService, 
  CreateApprovalRequestInput 
} from './services/financial-approval-service';
import { adminDb } from './firebase-admin';

export async function getPendingApprovalsAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { requests?: FinancialApprovalRequest[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient viewing permissions.' };
    }

    const snap = await adminDb
      .collection('financial_approval_requests')
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('status', '==', 'pending')
      .orderBy('requestedAt', 'desc')
      .get();

    const requests: FinancialApprovalRequest[] = snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<FinancialApprovalRequest, 'id'>),
    }));

    return { success: true, requests };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch pending approval requests';
    return { success: false, error: msg };
  }
}

export async function submitApprovalRequestAction(
  input: Omit<CreateApprovalRequestInput, 'workspaceId' | 'requestedByUserId' | 'requestedByName'>,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { request?: FinancialApprovalRequest }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance permissions.' };
    }

    const request = await FinancialApprovalService.createApprovalRequest({
      ...input,
      workspaceId,
      requestedByUserId: userId,
      requestedByName: userName,
    });

    return { success: true, request };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit approval request';
    return { success: false, error: msg };
  }
}

export async function decideApprovalRequestAction(
  requestId: string,
  decision: 'approved' | 'rejected',
  decisionNotes: string,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { request?: FinancialApprovalRequest }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to approve/reject financial requests.' };
    }

    const request = await FinancialApprovalService.decideApprovalRequest({
      requestId,
      decision,
      decisionNotes,
      decidedByUserId: userId,
      decidedByName: userName,
    });

    return { success: true, request };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process approval decision';
    return { success: false, error: msg };
  }
}

export async function getApprovalPolicyAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { policy?: FinancialApprovalPolicy }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient viewing permissions.' };
    }

    const policy = await FinancialApprovalService.getPolicy(workspaceId);
    return { success: true, policy };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch approval policy';
    return { success: false, error: msg };
  }
}

export async function saveApprovalPolicyAction(
  policy: Partial<FinancialApprovalPolicy>,
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { policy?: FinancialApprovalPolicy }> {
  try {
    const permission = await canUser(userId, 'finance', 'settings', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: only finance managers may update approval policies.' };
    }

    const updated = await FinancialApprovalService.savePolicy(workspaceId, policy);
    return { success: true, policy: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save approval policy';
    return { success: false, error: msg };
  }
}
