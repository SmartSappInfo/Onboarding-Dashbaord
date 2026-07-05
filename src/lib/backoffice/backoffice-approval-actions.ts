'use server';

import { adminDb } from '../firebase-admin';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import { logBackofficeAction } from './audit-logger';
import { APPROVAL_EXECUTORS } from './approval-registry';
import type { ApprovalRequest, ApprovalStatus } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Approval Server Actions (four-eyes governance)
//
// Security: token + RBAC on every action (server-auth-actions).
// Deciding requires approvals:execute AND a different admin than the
// requester. Approved requests execute the payload STORED at request
// time — never a client-supplied one. Expiry is evaluated lazily.
// ─────────────────────────────────────────────────

function isExpired(request: ApprovalRequest): boolean {
  return new Date(request.expiresAt).getTime() < Date.now();
}

export async function listApprovalRequests(idToken: string, statusFilter?: ApprovalStatus): Promise<{
  success: boolean;
  data?: ApprovalRequest[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'approvals', 'view');

    let query: FirebaseFirestore.Query = adminDb
      .collection('platform_approval_requests')
      .orderBy('createdAt', 'desc')
      .limit(100);
    if (statusFilter) {
      query = adminDb
        .collection('platform_approval_requests')
        .where('status', '==', statusFilter)
        .orderBy('createdAt', 'desc')
        .limit(100);
    }

    const snap = await query.get();
    const requests = snap.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() } as ApprovalRequest;
      // Lazy expiry for display — persisted transition happens on decide.
      if (data.status === 'pending' && isExpired(data)) {
        return { ...data, status: 'expired' as ApprovalStatus };
      }
      return data;
    });

    return { success: true, data: requests };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_APPROVALS] listApprovalRequests failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function decideApprovalRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  idToken: string
): Promise<{ success: boolean; status?: ApprovalStatus; error?: string }> {
  try {
    const approver = await authorizeBackoffice(idToken, 'approvals', 'execute');

    const ref = adminDb.collection('platform_approval_requests').doc(requestId);

    // Decide inside a transaction so concurrent approvals cannot
    // double-execute: only the transition pending → approved/rejected wins.
    const decided = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Approval request not found.');

      const request = { id: snap.id, ...snap.data() } as ApprovalRequest;

      if (request.status !== 'pending') {
        throw new Error(`Request is already ${request.status}.`);
      }
      if (isExpired(request)) {
        tx.update(ref, { status: 'expired' });
        return { request, finalStatus: 'expired' as ApprovalStatus };
      }
      // Four-eyes: the requester can never decide their own request.
      if (request.requestedBy.userId === approver.userId) {
        throw new Error('Four-eyes violation: you cannot approve or reject your own request.');
      }

      tx.update(ref, {
        status: decision,
        decidedBy: approver,
        decidedAt: new Date().toISOString(),
      });
      return { request, finalStatus: decision as ApprovalStatus };
    });

    await logBackofficeAction(approver, `approval.${decided.finalStatus}`, 'approval_request', requestId, {
      metadata: { actionKey: decided.request.actionKey, summary: decided.request.summary },
    });

    if (decided.finalStatus !== 'approved') {
      return { success: true, status: decided.finalStatus };
    }

    // Execute with the STORED payload under the approver's identity.
    const executor = APPROVAL_EXECUTORS[decided.request.actionKey];
    const result = await executor(decided.request.payload, approver);

    if (result.success) {
      await ref.update({ status: 'executed', executedAt: new Date().toISOString() });
      await logBackofficeAction(approver, 'approval.executed', 'approval_request', requestId, {
        metadata: { actionKey: decided.request.actionKey },
      });
      return { success: true, status: 'executed' };
    }

    // Stay 'approved' with the error recorded so another decider can retry.
    await ref.update({ executionError: result.error ?? 'Execution failed.' });
    return { success: false, status: 'approved', error: result.error ?? 'Execution failed after approval.' };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_APPROVALS] decideApprovalRequest failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/** The requester (or any approvals:execute holder) can cancel a pending request. */
export async function cancelApprovalRequest(
  requestId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'approvals', 'view');

    const ref = adminDb.collection('platform_approval_requests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'Approval request not found.' };

    const request = { id: snap.id, ...snap.data() } as ApprovalRequest;
    if (request.status !== 'pending') {
      return { success: false, error: `Request is already ${request.status}.` };
    }
    if (request.requestedBy.userId !== actor.userId) {
      // Non-requesters need decision rights to withdraw someone else's request.
      await authorizeBackoffice(idToken, 'approvals', 'execute');
    }

    await ref.update({
      status: 'rejected',
      decidedBy: actor,
      decidedAt: new Date().toISOString(),
    });

    await logBackofficeAction(actor, 'approval.cancelled', 'approval_request', requestId, {
      metadata: { actionKey: request.actionKey },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_APPROVALS] cancelApprovalRequest failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
