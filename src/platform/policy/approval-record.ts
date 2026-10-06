/**
 * @fileOverview Unified approval record (Phase 11 M0 · T2, findings F4/F5; Rules 13, 21, 22, 40, 41).
 *
 * WHY
 * Two incompatible models shared `capability_approvals`: the gateway's `CapabilityApprovalRecord`
 * (hash = capability + version + tenant + validated input) and the inbox/CRM/swarm `ActionProposal`
 * (hash = sha256 of the raw payload). Each rejected the other's documents, so an approval granted in
 * the inbox could never authorise a gateway execution.
 *
 * NOW: ONE record (`schemaVersion: 1`, `hashVersion: 2`). `hashVersion: 2` means the payload hash is
 * the gateway envelope (`computeApprovalPayloadHash`) over the capability's VALIDATED input, so the
 * record the inbox approves is exactly what the gateway verifies and binds.
 * - WHAT / WHY / blast radius / evidence are kept for the "why" view (Rule 41).
 * - `approvals[]` holds each distinct approver; L4 needs two (`requiredApprovals: 2`).
 * - `executable: false` marks a recommendation whose target is not a registered capability (F7):
 *   it can be approved as guidance, never bound to an execution.
 * - `workflowRef` / `targetVersion` / `beforeState` carry workflow resume (T5) and execution (T4) data.
 * - `version` is the optimistic-concurrency token for decisions (Rule 18).
 *
 * LEGACY (decision D7): old `ActionProposal` documents are readable for display but are marked
 * "Needs re-proposal" and can never be bound (their hash can't be verified by the gateway). Old
 * gateway records (`CapabilityApprovalRecord`, same envelope) stay verifiable.
 *
 * Tests: src/platform/__tests__/approvals/unified-approvals.test.ts
 */

import { z } from 'zod/v4';
import { RISK_LEVELS } from '../capabilities/contracts/risk-levels';
import { CapabilityApprovalRecordSchema, type CapabilityApprovalRecord } from '../capabilities/policy/approval-verifier';
import { ActionProposalSchema, BlastRadiusSchema, type ActionProposal } from './approval-proposal-types';
import { AGENT_PERSONA_IDS } from '../identity/agent-persona-types';

export const APPROVAL_RECORD_SCHEMA_VERSION = 1;
export const UNIFIED_HASH_VERSION = 2;

export const APPROVAL_RECORD_STATUSES = ['pending', 'approved', 'rejected', 'bound', 'expired', 'revoked'] as const;
export type ApprovalRecordStatus = (typeof APPROVAL_RECORD_STATUSES)[number];

export const ApprovalDecisionEntrySchema = z.object({
  by: z.string().min(1),
  at: z.string(),
  notes: z.string().max(2000).optional(),
});

export const ApprovalRecordSchema = z.object({
  schemaVersion: z.literal(APPROVAL_RECORD_SCHEMA_VERSION),
  hashVersion: z.literal(UNIFIED_HASH_VERSION),
  approvalId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().min(1),
  riskLevel: z.enum(RISK_LEVELS),
  /** False when the target isn't a registered capability: guidance only, never bound (F7). */
  executable: z.boolean(),
  requestedBy: z.object({
    kind: z.enum(['user', 'agent', 'workflow']),
    /** The person on whose behalf the request was made (the proposer for separation of duties). */
    userId: z.string().min(1),
    agentId: z.string().optional(),
    agentPersonaId: z.enum(AGENT_PERSONA_IDS).optional(),
  }),
  what: z.string().min(1).max(2000),
  why: z.string().min(1).max(4000),
  blastRadius: BlastRadiusSchema.optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.enum(APPROVAL_RECORD_STATUSES),
  requiredApprovals: z.union([z.literal(1), z.literal(2)]),
  approvals: z.array(ApprovalDecisionEntrySchema).default([]),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedBy: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  decisionNotes: z.string().nullable().optional(),
  workflowRef: z.object({ workflowId: z.string().min(1), stepId: z.string().min(1) }).optional(),
  targetVersion: z.union([z.string(), z.number()]).optional(),
  beforeState: z.record(z.string(), z.unknown()).optional(),
  boundToolInvocationId: z.string().nullable().optional(),
  boundAt: z.string().nullable().optional(),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(0),
});
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export type StoredApproval =
  | { kind: 'v2'; record: ApprovalRecord }
  /** Old inbox/CRM/swarm proposal: display only, "Needs re-proposal" (D7). */
  | { kind: 'legacy_proposal'; proposal: ActionProposal }
  /** Old gateway approval: same hash envelope, still verifiable. */
  | { kind: 'legacy_gateway'; record: CapabilityApprovalRecord }
  | { kind: 'corrupt' };

/** Reads any document in `capability_approvals`, never trusting its shape (Rule 4). */
export function readStoredApproval(id: string, raw: unknown): StoredApproval {
  const v2 = ApprovalRecordSchema.safeParse(raw);
  if (v2.success) return { kind: 'v2', record: v2.data };
  const gateway = CapabilityApprovalRecordSchema.safeParse(raw);
  if (gateway.success) return { kind: 'legacy_gateway', record: gateway.data };
  const proposal = ActionProposalSchema.safeParse({ ...(typeof raw === 'object' && raw !== null ? raw : {}), proposalId: id });
  if (proposal.success) return { kind: 'legacy_proposal', proposal: proposal.data };
  return { kind: 'corrupt' };
}

/** The gateway's view of a v2 record, so the existing pure check (`checkApprovalRecord`) applies. */
export function toGatewayRecord(record: ApprovalRecord): CapabilityApprovalRecord {
  const status: CapabilityApprovalRecord['status'] =
    record.status === 'expired' ? 'revoked' : record.status;
  return {
    approvalId: record.approvalId,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    capabilityId: record.capabilityId,
    capabilityVersion: record.capabilityVersion,
    payloadHash: record.payloadHash,
    requestedBy: record.requestedBy.agentId ?? record.requestedBy.userId,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    expiresAt: record.expiresAt,
    status,
    boundToolInvocationId: record.boundToolInvocationId ?? null,
    boundAt: record.boundAt ?? null,
  };
}

/** True when this user requested the action (directly or through their agent). */
export function isProposer(record: ApprovalRecord, uid: string): boolean {
  return record.requestedBy.userId === uid;
}
