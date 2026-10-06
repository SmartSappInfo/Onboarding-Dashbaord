/**
 * @fileOverview Durable approvals for workflow steps (Phase 11 M0 · T5, finding F8; Rules 20, 21, 25, 26).
 *
 * Before: a step that needed approval suspended with NO inbox item, and the resume bridge was an
 * in-process listener that was never instantiated, so a suspended step could never be approved.
 * Now a suspended step creates a unified `ApprovalRecord` with `workflowRef` (it shows in the same
 * approvals inbox as everything else); the approval centre enqueues the step again when the decision
 * is complete; the runner reads the decision here and either runs with the `approvalId` (the gateway
 * verifies the payload hash and binds it once) or fails the step (rejected / expired).
 *
 * Tests: src/platform/__tests__/workflows/approval-resume.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { createApproval, getApproval, type CreateApprovalInput } from '@/platform/policy/unified-approval-store';

export type WorkflowApprovalState = 'pending' | 'approved' | 'rejected' | 'expired' | 'missing';

export interface WorkflowApprovalPort {
  request(input: CreateApprovalInput): Promise<{ approvalId: string }>;
  status(approvalId: string, organizationId: string, nowMs: number): Promise<WorkflowApprovalState>;
}

export function createWorkflowApprovals(db: () => Promise<Firestore> | Firestore): WorkflowApprovalPort {
  return {
    async request(input) {
      const record = await createApproval(await db(), input);
      return { approvalId: record.approvalId };
    },
    async status(approvalId, organizationId, nowMs) {
      const stored = await getApproval(await db(), approvalId, organizationId);
      if (stored?.kind !== 'v2') return 'missing';
      const r = stored.record;
      switch (r.status) {
        // `bound` = already used by this step (a re-run after a crash); the gateway accepts the same
        // tool invocation again and refuses any other.
        case 'approved':
        case 'bound':
          return 'approved';
        case 'rejected':
          return 'rejected';
        case 'expired':
        case 'revoked':
          return 'expired';
        case 'pending':
          return Date.parse(r.expiresAt) <= nowMs ? 'expired' : 'pending';
      }
    },
  };
}

/** Production port (Firestore, lazy). */
export const defaultWorkflowApprovals: WorkflowApprovalPort = createWorkflowApprovals(async () => (await import('@/lib/firebase-admin')).adminDb);

/** The approval id recorded on a step's wait condition, when it is waiting for an approval. */
export function approvalIdOf(waitCondition: { type?: string; details?: Record<string, unknown> } | undefined): string | undefined {
  if (waitCondition?.type !== 'approval') return undefined;
  const id = waitCondition.details?.approvalId;
  return typeof id === 'string' && id ? id : undefined;
}
