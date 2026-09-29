/**
 * @fileOverview Capability Approval Verifier (Phase 0 / Phase 3)
 *
 * Turns an `approvalId` into a `VerifiedApproval` by checking the server-side record in
 * `capability_approvals/{approvalId}` and binding it, single-use, to one tool invocation
 * (Rules 21, 22: an approval covers exactly one operation with exactly this payload).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - `capability_approvals` is server-only (covered by the catch-all deny in firestore.rules).
 *   Records are created by the Phase 3 approval center, never by agents or tool arguments.
 * - The payload hash is computed over the VALIDATED input (after the capability input schema);
 *   the approval UI must hash the same parsed input with `computeApprovalPayloadHash`.
 * - Binding is transactional: `approved` → `bound` to a toolInvocationId. A retry of the SAME
 *   invocation re-verifies successfully; any other invocation gets APPROVAL_ALREADY_USED.
 * - This is separate from `ai_action_proposals` (src/lib/services/ai-admin), which models
 *   administrative proposals that execute on approval and carry no payload binding.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { sha256Hex } from '../contracts/canonical-json';
import type { VerifiedApproval } from '../contracts/capability-definition';

export const CAPABILITY_APPROVALS_COLLECTION = 'capability_approvals';

/** Bump when the hashed envelope changes; stored approvals carry the version they were made with. */
export const APPROVAL_HASH_VERSION = 1;

export function computeApprovalPayloadHash(args: {
  capabilityId: string;
  capabilityVersion: string;
  organizationId: string;
  workspaceId: string;
  input: unknown;
}): string {
  return sha256Hex({ v: APPROVAL_HASH_VERSION, ...args });
}

export const CapabilityApprovalRecordSchema = z.object({
  approvalId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().min(1),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  requestedBy: z.string().min(1),
  approvedBy: z.string().min(1).nullable(),
  approvedAt: z.string().nullable(),
  expiresAt: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'bound', 'revoked']),
  boundToolInvocationId: z.string().nullable().optional(),
  boundAt: z.string().nullable().optional(),
});
export type CapabilityApprovalRecord = z.infer<typeof CapabilityApprovalRecordSchema>;

export type ApprovalFailureCode =
  | 'APPROVAL_NOT_FOUND'
  | 'APPROVAL_CORRUPT'
  | 'APPROVAL_NOT_APPROVED'
  | 'APPROVAL_ALREADY_USED'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_MISMATCH'
  | 'APPROVAL_SELF_APPROVED';

export type ApprovalVerification =
  | { ok: true; approval: VerifiedApproval }
  | { ok: false; code: ApprovalFailureCode; message: string };

export interface ApprovalRequest {
  approvalId: string;
  capabilityId: string;
  capabilityVersion: string;
  organizationId: string;
  workspaceId: string;
  payloadHash: string;
  toolInvocationId: string;
  /** The agent id executing; an agent can never be its own approver. */
  agentId?: string;
  nowMs: number;
}

export interface ApprovalVerifier {
  verifyAndBind(request: ApprovalRequest): Promise<ApprovalVerification>;
}

/**
 * Pure verification of a stored record against a request. Returns the patch to apply when the
 * approval must be bound now (null when already bound to this same invocation).
 */
export function checkApprovalRecord(
  record: CapabilityApprovalRecord,
  request: ApprovalRequest
): { result: ApprovalVerification; bind: boolean } {
  const fail = (code: ApprovalFailureCode, message: string) => ({ result: { ok: false as const, code, message }, bind: false });

  if (record.status === 'bound') {
    if (record.boundToolInvocationId !== request.toolInvocationId) {
      return fail('APPROVAL_ALREADY_USED', 'Approval was already used by another invocation.');
    }
  } else if (record.status !== 'approved') {
    return fail('APPROVAL_NOT_APPROVED', `Approval is ${record.status}.`);
  }
  if (!record.approvedBy || !record.approvedAt) {
    return fail('APPROVAL_NOT_APPROVED', 'Approval has no approver.');
  }
  if (request.agentId && record.approvedBy === request.agentId) {
    return fail('APPROVAL_SELF_APPROVED', 'An agent cannot approve its own action.');
  }
  const expiresMs = Date.parse(record.expiresAt);
  if (Number.isNaN(expiresMs) || expiresMs <= request.nowMs) {
    return fail('APPROVAL_EXPIRED', 'Approval has expired.');
  }
  const mismatched =
    record.organizationId !== request.organizationId ||
    record.workspaceId !== request.workspaceId ||
    record.capabilityId !== request.capabilityId ||
    record.capabilityVersion !== request.capabilityVersion ||
    record.payloadHash !== request.payloadHash;
  if (mismatched) {
    return fail('APPROVAL_MISMATCH', 'Approval does not cover this capability, tenant or payload.');
  }

  return {
    result: {
      ok: true,
      approval: {
        approvalId: record.approvalId,
        approvedBy: record.approvedBy,
        organizationId: record.organizationId,
        workspaceId: record.workspaceId,
        capabilityId: record.capabilityId,
        capabilityVersion: record.capabilityVersion,
        payloadHash: record.payloadHash,
        toolInvocationId: request.toolInvocationId,
        expiresAt: record.expiresAt,
      },
    },
    bind: record.status === 'approved',
  };
}

export function createFirestoreApprovalVerifier(db: Firestore): ApprovalVerifier {
  return {
    async verifyAndBind(request) {
      const ref = db.collection(CAPABILITY_APPROVALS_COLLECTION).doc(request.approvalId);
      return db.runTransaction(async (tx): Promise<ApprovalVerification> => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
        }
        const parsed = CapabilityApprovalRecordSchema.safeParse(snap.data());
        if (!parsed.success) {
          return { ok: false, code: 'APPROVAL_CORRUPT', message: 'Approval record failed schema validation.' };
        }
        const { result, bind } = checkApprovalRecord(parsed.data, request);
        if (result.ok && bind) {
          tx.update(ref, {
            status: 'bound',
            boundToolInvocationId: request.toolInvocationId,
            boundAt: new Date(request.nowMs).toISOString(),
          });
        }
        return result;
      });
    },
  };
}
