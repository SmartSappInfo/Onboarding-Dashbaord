/**
 * @fileOverview Approver policy (Phase 11 M0 · T2, finding F5; Rules 13, 17, 18, 21, 51).
 *
 * Before: any signed-in member of the organisation could approve any proposal; self-approval was
 * blocked only for L4. Now a decision needs ALL of:
 * - workspace membership (system admins excepted);
 * - the `agent_approvals_decide` permission, held by default by workspace admins (`users_manage`,
 *   decision D6) and grantable to others in Backoffice without code; system admins always;
 * - not being the proposer (the person who requested it, directly or through their agent), at any
 *   risk level;
 * - for L4, two DISTINCT approvers (the record stays pending after the first);
 * - a pending, unexpired record at the version the person saw (Rule 18).
 *
 * The permission is non-delegable (risk-levels.ts), so an agent principal can never hold it.
 *
 * Pure. Tests: src/platform/__tests__/approvals/unified-approvals.test.ts
 */

import type { ApprovalRecord } from './approval-record';
import { isProposer } from './approval-record';

export const AGENT_APPROVALS_DECIDE = 'agent_approvals_decide';
/** Workspace-admin coordinate that holds the decide permission by default (D6). */
export const DEFAULT_DECIDER_PERMISSION = 'users_manage';

export interface DecisionActor {
  uid: string;
  isSystemAdmin: boolean;
  workspaceIds: readonly string[];
  /** Effective flat permissions (profile list ∪ flattened schema). */
  permissions: readonly string[];
}

export function canDecideApprovals(actor: DecisionActor, workspaceId: string): { ok: true } | { ok: false; code: 'NOT_MEMBER' | 'NOT_PERMITTED' } {
  if (actor.isSystemAdmin) return { ok: true };
  if (!actor.workspaceIds.includes(workspaceId)) return { ok: false, code: 'NOT_MEMBER' };
  const perms = new Set(actor.permissions);
  return perms.has(AGENT_APPROVALS_DECIDE) || perms.has(DEFAULT_DECIDER_PERMISSION) ? { ok: true } : { ok: false, code: 'NOT_PERMITTED' };
}

export type DecisionRefusal =
  | 'NOT_MEMBER'
  | 'NOT_PERMITTED'
  | 'SELF_DECISION'
  | 'DUPLICATE_APPROVER'
  | 'NOT_PENDING'
  | 'EXPIRED'
  | 'VERSION_CONFLICT';

export const DECISION_MESSAGES: Readonly<Record<DecisionRefusal, string>> = {
  NOT_MEMBER: "You don't have access to this workspace.",
  NOT_PERMITTED: "You don't have permission to approve agent actions.",
  SELF_DECISION: "You can't approve or reject an action you requested.",
  DUPLICATE_APPROVER: 'This action needs a second, different approver.',
  NOT_PENDING: 'Someone already decided this.',
  EXPIRED: 'This request has expired. Ask for it again.',
  VERSION_CONFLICT: 'Someone already decided this.',
};

export type DecisionOutcome =
  | { ok: true; next: ApprovalRecord; complete: boolean }
  | { ok: false; code: DecisionRefusal };

export function evaluateDecision(params: {
  record: ApprovalRecord;
  actor: DecisionActor;
  decision: 'approved' | 'rejected';
  notes?: string;
  nowIso: string;
  expectedVersion?: number;
}): DecisionOutcome {
  const { record, actor, decision, nowIso } = params;
  const allowed = canDecideApprovals(actor, record.workspaceId);
  if (!allowed.ok) return { ok: false, code: allowed.code };
  if (isProposer(record, actor.uid)) return { ok: false, code: 'SELF_DECISION' };
  if (params.expectedVersion !== undefined && params.expectedVersion !== record.version) return { ok: false, code: 'VERSION_CONFLICT' };
  if (record.status !== 'pending') return { ok: false, code: 'NOT_PENDING' };
  if (Date.parse(record.expiresAt) <= Date.parse(nowIso)) return { ok: false, code: 'EXPIRED' };

  const base = { ...record, updatedAt: nowIso, version: record.version + 1, decisionNotes: params.notes ?? record.decisionNotes ?? null };
  if (decision === 'rejected') {
    return { ok: true, complete: true, next: { ...base, status: 'rejected', rejectedBy: actor.uid, rejectedAt: nowIso } };
  }
  if (record.approvals.some((a) => a.by === actor.uid)) return { ok: false, code: 'DUPLICATE_APPROVER' };
  const approvals = [...record.approvals, { by: actor.uid, at: nowIso, ...(params.notes ? { notes: params.notes } : {}) }];
  const complete = approvals.length >= record.requiredApprovals;
  return {
    ok: true,
    complete,
    next: {
      ...base,
      approvals,
      ...(complete ? { status: 'approved' as const, approvedBy: actor.uid, approvedAt: nowIso } : {}),
    },
  };
}
