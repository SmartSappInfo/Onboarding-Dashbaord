'use server';

/**
 * @file src/lib/governance-actions.ts
 * @description Next.js Server Actions for managing `page_audit_logs` and `approval_requests` in Firestore.
 * Supports append-only immutable audit logging, publish approval requests, and admin review transitions.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Input validation & security checks prior to adminDb execution.
 * - Append-only immutable log persistence.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { ApprovalRequest, PageAuditLog } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Appends an immutable audit log record to Firestore.
 */
export async function recordAuditLogAction(log: PageAuditLog): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (
      !log.id ||
      !log.pageId ||
      !log.organizationId ||
      !log.actorId ||
      !log.action
    ) {
      return { success: false, error: 'Unauthorized or missing required audit log parameters' };
    }

    const docRef = adminDb.collection('page_audit_logs').doc(log.id);
    await docRef.create(log);

    return { success: true, id: log.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record audit log';
    console.error('>>> [GOVERNANCE] Audit Log Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Submits a publish approval request for admin review.
 */
export async function submitApprovalRequestAction(request: ApprovalRequest): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (
      !request.id ||
      !request.pageId ||
      !request.organizationId ||
      !request.requesterId
    ) {
      return { success: false, error: 'Unauthorized or missing required approval request parameters' };
    }

    const docRef = adminDb.collection('approval_requests').doc(request.id);
    await docRef.set(request, { merge: true });

    revalidatePath(`/admin/pages/${request.pageId}/builder`);
    return { success: true, id: request.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit approval request';
    console.error('>>> [GOVERNANCE] Approval Request Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Reviews (approves or rejects) a publish approval request using a Firestore Transaction.
 */
export async function reviewApprovalRequestAction(
  requestId: string,
  status: 'approved' | 'rejected',
  approverId: string,
  approverEmail: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!requestId || !approverId || !status) {
      return { success: false, error: 'Missing required review parameters' };
    }

    const reqRef = adminDb.collection('approval_requests').doc(requestId);

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(reqRef);
      if (!snap.exists) {
        throw new Error('Approval request not found');
      }

      const request = snap.data() as ApprovalRequest;
      if (request.status !== 'pending') {
        throw new Error(`Approval request has already been ${request.status}`);
      }

      const now = new Date().toISOString();
      transaction.update(reqRef, {
        status,
        approverId,
        approverEmail,
        notes: notes || '',
        updatedAt: now,
      });

      // Record corresponding immutable audit log for approval review
      const auditRef = adminDb.collection('page_audit_logs').doc();
      transaction.create(auditRef, {
        id: auditRef.id,
        pageId: request.pageId,
        organizationId: request.organizationId,
        actorId: approverId,
        actorEmail: approverEmail,
        action: status === 'approved' ? 'approve' : 'reject',
        details: { requestId, notes },
        createdAt: now,
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to review approval request';
    console.error('>>> [GOVERNANCE] Review Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches recent audit log entries for a landing page (capped at top 50 entries).
 */
export async function fetchPageAuditLogsAction(
  pageId: string,
): Promise<{ success: boolean; logs?: PageAuditLog[]; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('page_audit_logs')
      .where('pageId', '==', pageId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const logs = snap.docs.map((doc) => doc.data() as PageAuditLog);
    return { success: true, logs };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit logs';
    console.error('>>> [GOVERNANCE] Fetch Logs Failed:', message);
    return { success: false, error: message };
  }
}
