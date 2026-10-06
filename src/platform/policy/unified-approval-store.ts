/**
 * @fileOverview The single approval store (Phase 11 M0 · T2; Rules 13, 18, 21, 22, 40).
 *
 * One collection (`capability_approvals`), one record (`ApprovalRecord`), one set of operations:
 * - `createApproval`: the payload is validated by the target capability's input schema and hashed
 *   with the gateway envelope, so what a person approves is exactly what the gateway will verify.
 *   A target that isn't a registered capability becomes a recommendation (`executable: false`, F7).
 * - `decideApproval`: approver policy (`approver-policy.ts`) inside a transaction; the version moves
 *   on every decision, so concurrent decisions resolve to one winner.
 * - `createUnifiedApprovalVerifier`: the gateway's verifier (step 09). Verifies v2 records and
 *   legacy gateway records; legacy inbox proposals are refused ("Needs re-proposal", D7). Binding
 *   is single-use and transactional (Rule 22).
 *
 * Tests: src/platform/__tests__/approvals/unified-approvals.test.ts
 */

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { AnyCapabilityDefinition } from '../capabilities/contracts/capability-definition';
import { getCapability } from '../capabilities/registry/capability-registry';
import { RISK_LEVELS, type RiskLevel } from '../capabilities/contracts/risk-levels';
import {
  CAPABILITY_APPROVALS_COLLECTION,
  checkApprovalRecord,
  computeApprovalPayloadHash,
  type ApprovalRequest,
  type ApprovalVerification,
  type ApprovalVerifier,
} from '../capabilities/policy/approval-verifier';
import type { BlastRadius } from './approval-proposal-types';
import {
  APPROVAL_RECORD_SCHEMA_VERSION,
  ApprovalRecordSchema,
  UNIFIED_HASH_VERSION,
  readStoredApproval,
  toGatewayRecord,
  type ApprovalRecord,
  type StoredApproval,
} from './approval-record';
import { evaluateDecision, type DecisionActor, type DecisionRefusal } from './approver-policy';

export const DEFAULT_APPROVAL_TTL_SECONDS = 24 * 3600;
const MAX_TTL_SECONDS = 7 * 24 * 3600;

export class ApprovalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalInputError';
  }
}

const PayloadRecordSchema = z.record(z.string(), z.unknown());

export interface CreateApprovalInput {
  /** The registered target, or null when it isn't registered (→ recommendation only). */
  capability: AnyCapabilityDefinition | null;
  capabilityId: string;
  organizationId: string;
  workspaceId: string;
  payload: Record<string, unknown>;
  requestedBy: ApprovalRecord['requestedBy'];
  what: string;
  why: string;
  blastRadius?: BlastRadius;
  evidence?: Record<string, unknown>;
  ttlSeconds?: number;
  workflowRef?: ApprovalRecord['workflowRef'];
  targetVersion?: string | number;
  beforeState?: Record<string, unknown>;
}

function riskFrom(value: string | undefined): RiskLevel {
  const parsed = z.enum(RISK_LEVELS).safeParse(value);
  return parsed.success ? parsed.data : 'L2_STATE_MUTATION';
}

/** Builds (but doesn't store) a v2 record; exported for tests and dry runs. */
export function buildApprovalRecord(input: CreateApprovalInput, nowMs: number, approvalId = `appr_${randomUUID()}`): ApprovalRecord {
  let payload: Record<string, unknown> = input.payload;
  let capabilityVersion = '0.0.0';
  let executable = false;
  let riskLevel = riskFrom(input.blastRadius?.riskLevel);

  if (input.capability) {
    if (input.capability.id !== input.capabilityId) throw new ApprovalInputError('Capability does not match the requested id.');
    const validated = input.capability.inputSchema.safeParse(input.payload);
    if (!validated.success) throw new ApprovalInputError(`The proposed change is not valid for '${input.capabilityId}'.`);
    const asRecord = PayloadRecordSchema.safeParse(validated.data);
    if (!asRecord.success) throw new ApprovalInputError('The proposed change must be an object.');
    payload = asRecord.data;
    capabilityVersion = input.capability.version;
    executable = true;
    riskLevel = input.capability.risk.level;
  }

  const nowIso = new Date(nowMs).toISOString();
  const ttl = Math.min(Math.max(input.ttlSeconds ?? DEFAULT_APPROVAL_TTL_SECONDS, 60), MAX_TTL_SECONDS);
  return ApprovalRecordSchema.parse({
    schemaVersion: APPROVAL_RECORD_SCHEMA_VERSION,
    hashVersion: UNIFIED_HASH_VERSION,
    approvalId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    capabilityId: input.capabilityId,
    capabilityVersion,
    riskLevel,
    executable,
    requestedBy: input.requestedBy,
    what: input.what,
    why: input.why,
    ...(input.blastRadius ? { blastRadius: input.blastRadius } : {}),
    ...(input.evidence ? { evidence: input.evidence } : {}),
    payload,
    payloadHash: computeApprovalPayloadHash({
      capabilityId: input.capabilityId,
      capabilityVersion,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      input: payload,
    }),
    status: 'pending',
    requiredApprovals: riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE' ? 2 : 1,
    approvals: [],
    approvedBy: null,
    approvedAt: null,
    ...(input.workflowRef ? { workflowRef: input.workflowRef } : {}),
    ...(input.targetVersion !== undefined ? { targetVersion: input.targetVersion } : {}),
    ...(input.beforeState ? { beforeState: input.beforeState } : {}),
    expiresAt: new Date(nowMs + ttl * 1000).toISOString(),
    createdAt: nowIso,
    updatedAt: nowIso,
    version: 0,
  });
}

/**
 * The hash a proposal's payload must have (Rule 22), for callers that compare a payload with a
 * proposal outside the gateway (agent interceptor, approval centre). Same envelope as the gateway:
 * the registered capability's VALIDATED input when the capability (at that version) is registered,
 * else the raw payload.
 */
export function hashProposalPayload(
  target: { capabilityId: string; capabilityVersion: string; organizationId: string; workspaceId: string },
  payload: Record<string, unknown>,
  lookup: (id: string) => AnyCapabilityDefinition | undefined = getCapability
): string {
  const cap = lookup(target.capabilityId);
  let input: unknown = payload;
  if (cap && cap.version === target.capabilityVersion) {
    const validated = cap.inputSchema.safeParse(payload);
    if (validated.success) input = validated.data;
  }
  // Exactly the gateway envelope: callers often pass a whole proposal, whose other fields must not leak in.
  return computeApprovalPayloadHash({
    capabilityId: target.capabilityId,
    capabilityVersion: target.capabilityVersion,
    organizationId: target.organizationId,
    workspaceId: target.workspaceId,
    input,
  });
}

export async function createApproval(db: Firestore, input: CreateApprovalInput, nowMs: number = Date.now()): Promise<ApprovalRecord> {
  const record = buildApprovalRecord(input, nowMs);
  await db.collection(CAPABILITY_APPROVALS_COLLECTION).doc(record.approvalId).set(record);
  return record;
}

/** Any stored approval in this organisation; another organisation's id reads as missing (no probing). */
export async function getApproval(db: Firestore, approvalId: string, organizationId: string): Promise<StoredApproval | null> {
  if (!approvalId || approvalId.includes('/')) return null;
  const snap = await db.collection(CAPABILITY_APPROVALS_COLLECTION).doc(approvalId).get();
  if (!snap.exists) return null;
  const stored = readStoredApproval(approvalId, snap.data());
  const org = stored.kind === 'v2' || stored.kind === 'legacy_gateway' ? stored.record.organizationId
    : stored.kind === 'legacy_proposal' ? stored.proposal.organizationId : null;
  return org === organizationId ? stored : null;
}

export async function listApprovals(
  db: Firestore,
  params: { workspaceId: string; organizationId: string; status?: string; limit?: number }
): Promise<StoredApproval[]> {
  let q = db.collection(CAPABILITY_APPROVALS_COLLECTION).where('workspaceId', '==', params.workspaceId);
  if (params.status) q = q.where('status', '==', params.status);
  const snap = await q.limit(Math.min(params.limit ?? 50, 200)).get();
  return snap.docs
    .map((d) => readStoredApproval(d.id, d.data()))
    .filter((s) => {
      const org = s.kind === 'v2' || s.kind === 'legacy_gateway' ? s.record.organizationId
        : s.kind === 'legacy_proposal' ? s.proposal.organizationId : null;
      return org === params.organizationId;
    });
}

export type DecideResult =
  | { ok: true; record: ApprovalRecord; complete: boolean }
  | { ok: false; code: DecisionRefusal | 'NOT_FOUND' | 'NEEDS_REPROPOSAL' };

export async function decideApproval(
  db: Firestore,
  params: {
    approvalId: string;
    organizationId: string;
    actor: DecisionActor;
    decision: 'approved' | 'rejected';
    notes?: string;
    expectedVersion?: number;
    nowMs: number;
  }
): Promise<DecideResult> {
  if (!params.approvalId || params.approvalId.includes('/')) return { ok: false, code: 'NOT_FOUND' };
  const ref = db.collection(CAPABILITY_APPROVALS_COLLECTION).doc(params.approvalId);
  return db.runTransaction(async (tx): Promise<DecideResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, code: 'NOT_FOUND' };
    const stored = readStoredApproval(params.approvalId, snap.data());
    if (stored.kind === 'legacy_proposal') {
      return stored.proposal.organizationId === params.organizationId ? { ok: false, code: 'NEEDS_REPROPOSAL' } : { ok: false, code: 'NOT_FOUND' };
    }
    if (stored.kind !== 'v2' || stored.record.organizationId !== params.organizationId) return { ok: false, code: 'NOT_FOUND' };
    const outcome = evaluateDecision({
      record: stored.record,
      actor: params.actor,
      decision: params.decision,
      nowIso: new Date(params.nowMs).toISOString(),
      ...(params.notes ? { notes: params.notes } : {}),
      ...(params.expectedVersion !== undefined ? { expectedVersion: params.expectedVersion } : {}),
    });
    if (!outcome.ok) return outcome;
    tx.set(ref, outcome.next);
    return { ok: true, record: outcome.next, complete: outcome.complete };
  });
}

/** The gateway's approval verifier over the unified store (step 09). */
export function createUnifiedApprovalVerifier(db: Firestore): ApprovalVerifier {
  const check = (stored: StoredApproval, request: ApprovalRequest): { result: ApprovalVerification; bind: boolean } => {
    const fail = (code: Extract<ApprovalVerification, { ok: false }>['code'], message: string) => ({ result: { ok: false as const, code, message }, bind: false });
    switch (stored.kind) {
      case 'corrupt':
        return fail('APPROVAL_CORRUPT', 'Approval record failed schema validation.');
      case 'legacy_proposal':
        return fail('APPROVAL_MISMATCH', 'This approval was made before approvals were unified. Ask for the action again (needs re-proposal).');
      case 'legacy_gateway':
        return checkApprovalRecord(stored.record, request);
      case 'v2': {
        if (!stored.record.executable) return fail('APPROVAL_MISMATCH', 'This approval is a recommendation and cannot authorise an execution.');
        // An agent can never be one of the approvers of its own action.
        if (request.agentId && stored.record.approvals.some((a) => a.by === request.agentId)) {
          return fail('APPROVAL_SELF_APPROVED', 'An agent cannot approve its own action.');
        }
        return checkApprovalRecord(toGatewayRecord(stored.record), request);
      }
    }
  };

  return {
    async verify(request) {
      const snap = await db.collection(CAPABILITY_APPROVALS_COLLECTION).doc(request.approvalId).get();
      if (!snap.exists) return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
      return check(readStoredApproval(request.approvalId, snap.data()), request).result;
    },
    async verifyAndBind(request) {
      const ref = db.collection(CAPABILITY_APPROVALS_COLLECTION).doc(request.approvalId);
      return db.runTransaction(async (tx): Promise<ApprovalVerification> => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record does not exist.' };
        const stored = readStoredApproval(request.approvalId, snap.data());
        const { result, bind } = check(stored, request);
        if (result.ok && bind) {
          const nowIso = new Date(request.nowMs).toISOString();
          if (stored.kind === 'v2') {
            tx.set(ref, { ...stored.record, status: 'bound', boundToolInvocationId: request.toolInvocationId, boundAt: nowIso, updatedAt: nowIso, version: stored.record.version + 1 });
          } else if (stored.kind === 'legacy_gateway') {
            tx.set(ref, { ...stored.record, status: 'bound', boundToolInvocationId: request.toolInvocationId, boundAt: nowIso });
          }
        }
        return result;
      });
    },
  };
}
