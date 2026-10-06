/**
 * @fileOverview CRM proposal bridge: propose → approve → REALLY execute → verify → roll back
 * (Phase 11 M0 · T4, findings F6/F7; Rules 18, 21, 22, 27, 31, 42, 47, 64).
 *
 * WHY
 * Before, "execute" only marked the proposal bound and emitted an event; nothing changed in the CRM,
 * and the targets were capability ids that don't exist. Now:
 *
 * PROPOSE  The action type is mapped to a registered capability (`crm-execution-map.ts`); the payload
 *          becomes that capability's validated input; the current state is read and kept as
 *          `beforeState`. Unmappable types are recommendations (approvable guidance, never executed).
 * EXECUTE  Behind `FF_CRM_PROPOSAL_EXECUTION` (off by default; global → org → workspace).
 *          1. the approval must be the unified record, approved, executable, in this workspace;
 *          2. the record must not have moved since the proposal (`beforeState`) → else VERSION_CONFLICT,
 *             nothing written ("This record changed. Review the update again.");
 *          3. the gateway runs the capability as the requester's LIVE authority ∩ the executing persona,
 *             with the `approvalId` (step 09 verifies the hash and binds it once) and an idempotency key;
 *          4. the result is re-read: only a confirmed change is "Applied"; otherwise the outcome is
 *             recorded as unknown and operators are alerted.
 * ROLLBACK The inverse capability restores `beforeState`, as the person asking for the undo, only if
 *          the record still shows what we applied; actions without a governed inverse are refused
 *          with a clear message (never a silent no-op).
 *
 * Execution results live in `crm_proposal_executions/{approvalId}` (server-only).
 *
 * Tests: src/platform/__tests__/agents/crm/crm-proposal-execution.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import { invokeGoverned } from '@/platform/capabilities/execution/invoke-governed';
import type { ExecuteCapabilityDeps } from '@/platform/capabilities/execution/execute-capability';
import type { CapabilityFlagRecord } from '@/platform/capabilities/flags/capability-flags-types';
import { defaultFlagChecker } from '@/platform/capabilities/flags/flag-service';
import { delegatedAgentPrincipal, loadLiveUserPrincipal } from '@/platform/capabilities/policy/live-user-principal';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';
import { createApproval, getApproval } from '@/platform/policy/unified-approval-store';
import { proposalFromRecord } from '@/platform/runtime/execution/approval-interceptor';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { CrmActionError, type CrmProposedAction } from './crm-action-types';
import { executableFor, type CrmExecutableAction } from './crm-execution-map';
import { readIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';

export const CRM_EXECUTIONS = 'crm_proposal_executions';
/** `FF_CRM_PROPOSAL_EXECUTION` (flag record id in `platform_features`). */
export const CRM_PROPOSAL_EXECUTION_FLAG = 'feature.crm_proposal_execution';

/**
 * Where a proposal came from, when it was derived from a meeting (Phase 11 M2 · T4.3). Bound into
 * the approval evidence; at execute time the meeting's analysis must still be the same run and
 * still contain the item, otherwise the proposal is stale (re-analysis invalidates it).
 */
export interface MeetingProposalOrigin {
  origin: 'meeting';
  meetingId: string;
  itemHash: string;
  transcriptId: string;
  runId: string;
  intelligenceVersion: number;
}

export interface ProposeCrmActionInput {
  organizationId: string;
  workspaceId: string;
  callerId: string;
  action: CrmProposedAction;
  origin?: MeetingProposalOrigin;
  /** Defaults to 72 h; meeting proposals use 24 h (plan §4.12). */
  ttlSeconds?: number;
}

const MeetingOriginEvidenceSchema = z.object({
  origin: z.literal('meeting'),
  meetingId: z.string().min(1),
  itemHash: z.string().min(1),
  runId: z.string().min(1),
}).loose();

export interface ExecuteApprovedProposalInput {
  organizationId: string;
  workspaceId: string;
  callerId: string;
  proposalId: string;
  /** Ignored: execution always uses the approved, validated payload (it can't be swapped). */
  executionPayload?: Record<string, unknown>;
  expectedVersion?: number;
}

export interface CrmProposalExecutionResult {
  proposalId: string;
  status: 'executed';
  executionTimestamp: string;
  payloadHash: string;
  affectedRecord: { type: string; id: string; targetPath: string };
}

export interface RollbackCrmActionInput {
  organizationId: string;
  workspaceId: string;
  callerId: string;
  proposalId: string;
  reason: string;
}

export interface CrmProposalRollbackResult {
  proposalId: string;
  status: 'reverted';
  revertedAt: string;
  compensatingCapabilityId: string;
  reason: string;
}

const Json = z.record(z.string(), z.unknown());
const ExecutionRecordSchema = z.object({
  organizationId: z.string(),
  workspaceId: z.string(),
  approvalId: z.string(),
  actionType: z.string(),
  capabilityId: z.string(),
  status: z.enum(['applied', 'rolled_back', 'postcondition_failed']),
  input: Json,
  beforeState: Json.nullable(),
  afterState: Json.nullable(),
  affectedRecord: z.object({ type: z.string(), id: z.string(), targetPath: z.string() }),
  executedBy: z.string(),
  executedAt: z.string(),
  rolledBackBy: z.string().optional(),
  rolledBackAt: z.string().optional(),
  rollbackReason: z.string().optional(),
});
type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;

export interface CrmProposalBridgeOptions {
  db?: Firestore;
  /** Injected in tests (registry lookup, verifier over the same database, flags). */
  gatewayDeps?: ExecuteCapabilityDeps;
  flags?: { getFlagRecord(id: string): Promise<CapabilityFlagRecord | null> };
  lookup?: (id: string) => AnyCapabilityDefinition | undefined;
  loadPrincipal?: (params: { uid: string; organizationId: string; workspaceId: string }) => Promise<AgentPrincipal | null>;
  nowMs?: () => number;
}

/** Flag evaluation: kill switch → workspace → organisation → global default (off). */
export function isExecutionEnabled(record: CapabilityFlagRecord | null, organizationId: string, workspaceId: string): boolean {
  if (!record || record.killSwitch) return false;
  const ws = record.workspaceOverrides?.[workspaceId]?.enabled;
  if (ws !== undefined) return ws;
  const org = record.orgOverrides?.[organizationId]?.enabled;
  if (org !== undefined) return org;
  return record.defaultState === true;
}

function affectedRecordFor(capabilityId: string, input: Record<string, unknown>, output: unknown): ExecutionRecord['affectedRecord'] {
  const idOf = (v: unknown) => (typeof v === 'string' ? v : '');
  if (capabilityId.startsWith('deal.')) return { type: 'deal', id: idOf(input.dealId), targetPath: `/deals/${idOf(input.dealId)}` };
  const created = z.object({ taskId: z.string() }).loose().safeParse(output);
  const taskId = created.success ? created.data.taskId : idOf(input.taskId);
  return { type: 'task', id: taskId, targetPath: `/tasks/${taskId}` };
}

export class CrmProposalBridge {
  private readonly options: CrmProposalBridgeOptions;

  constructor(options: CrmProposalBridgeOptions = {}) {
    this.options = options;
  }

  private async db(): Promise<Firestore> {
    if (this.options.db) return this.options.db;
    const { adminDb } = await import('@/lib/firebase-admin');
    return adminDb;
  }

  private now(): number {
    return this.options.nowMs ? this.options.nowMs() : Date.now();
  }

  private lookup(id: string): AnyCapabilityDefinition | undefined {
    return (this.options.lookup ?? getCapability)(id);
  }

  private async principalFor(uid: string, organizationId: string, workspaceId: string): Promise<AgentPrincipal | null> {
    if (this.options.loadPrincipal) return this.options.loadPrincipal({ uid, organizationId, workspaceId });
    return loadLiveUserPrincipal(await this.db(), { uid, organizationId, workspaceId });
  }

  private async guard(organizationId: string): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch {
      throw new CrmActionError('CRM_DEAD_MAN_PAUSED', 'Autonomous CRM actions are paused by governance dead-man switch.');
    }
  }

  /** A meeting-derived proposal is stale once the meeting was re-analysed or the item is gone. */
  private async assertOriginCurrent(db: Firestore, workspaceId: string, evidence: Record<string, unknown> | undefined): Promise<void> {
    const origin = MeetingOriginEvidenceSchema.safeParse(evidence ?? {});
    if (!origin.success) return;
    const stored = await readIntelligenceV2(db, origin.data.meetingId, workspaceId);
    if (!stored || stored.header.runId !== origin.data.runId || !stored.items.some((i) => i.itemHash === origin.data.itemHash)) {
      throw new CrmActionError('VERSION_CONFLICT', 'The meeting was analysed again since this was proposed. Propose the update again.');
    }
  }

  /** Reads the fields that matter for the action (conflict check / rollback). */
  private async readState(map: CrmExecutableAction, input: Record<string, unknown>, principal: AgentPrincipal, surface: 'ui' | 'agent', correlationId: string): Promise<Record<string, unknown> | null> {
    if (!map.before) return null;
    const res = await invokeGoverned({
      capabilityId: map.before.capabilityId,
      surface,
      input: map.before.input(input),
      principal,
      correlationId,
    }, this.options.gatewayDeps);
    return res.success ? map.before.pick(res.data) : null;
  }

  /** Creates the approval request for a proposed CRM action (unified record, Phase 11 M0 · T2/T4). */
  async proposeAction(input: ProposeCrmActionInput): Promise<ActionProposal> {
    await this.guard(input.organizationId);
    const { action } = input;
    const map = executableFor(action.actionType);
    const capInput = map ? map.toInput(action.payload, input.workspaceId) : null;
    const capability = map && capInput ? this.lookup(map.capabilityId) ?? null : null;
    const executable = map !== null && capInput !== null && capability !== null;

    let beforeState: Record<string, unknown> | undefined;
    if (executable && map.before && capInput) {
      const caller = await this.principalFor(input.callerId, input.organizationId, input.workspaceId);
      if (!caller) throw new CrmActionError('IDOR_VIOLATION', 'You no longer have access to this workspace.');
      const state = await this.readState(map, capInput, caller, 'ui', `corr_prop_${action.id}`);
      if (!state) throw new CrmActionError('TARGET_NOT_FOUND', 'The record this change is for was not found.');
      beforeState = state;
    }

    const record = await createApproval(await this.db(), {
      capability: executable ? capability : null,
      capabilityId: executable && map ? map.capabilityId : action.targetCapabilityId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      payload: executable && capInput ? capInput : action.payload,
      requestedBy: { kind: 'agent', userId: input.callerId, agentPersonaId: executable && map ? map.executingPersona : 'crm_assistant' },
      what: action.explainability.what,
      why: action.explainability.why,
      blastRadius: {
        entityCount: action.explainability.blastRadius.affectedRecordsCount,
        entityType: 'crm_record',
        estimatedCostUsd: 0,
        riskLevel: action.riskLevel,
      },
      evidence: {
        actionType: action.actionType,
        actionId: action.id,
        entityId: action.entityId,
        priority: action.priority,
        idempotencyKey: action.idempotencyKey,
        impact: action.explainability.impact,
        ...(input.origin ?? {}),
      },
      ...(beforeState ? { beforeState } : {}),
      ttlSeconds: input.ttlSeconds ?? 72 * 3600,
    }, this.now());

    await defaultEventBus.publish(createDomainEvent({
      type: 'crm.action.proposed',
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actor: { type: 'agent', id: 'crm_proposal_bridge' },
      entity: { type: 'crm_proposal', id: record.approvalId },
      source: 'crm_proposal_bridge',
      correlationId: `corr_prop_${record.approvalId}`,
      payload: {
        proposalId: record.approvalId,
        actionId: action.id,
        entityId: action.entityId,
        workspaceId: input.workspaceId,
        actionType: action.actionType,
        targetCapabilityId: record.capabilityId,
        executable: record.executable,
        payloadHash: record.payloadHash,
        proposedAt: record.createdAt,
      },
    }));

    const proposal = proposalFromRecord(record);
    if (!proposal) throw new CrmActionError('PROPOSAL_NOT_FOUND', 'The proposal could not be created.');
    return proposal;
  }

  /** Applies an approved proposal for real (see file header). */
  async executeApprovedProposal(input: ExecuteApprovedProposalInput): Promise<CrmProposalExecutionResult> {
    await this.guard(input.organizationId);
    const flagRecord = await (this.options.flags ?? defaultFlagChecker).getFlagRecord(CRM_PROPOSAL_EXECUTION_FLAG);
    if (!isExecutionEnabled(flagRecord, input.organizationId, input.workspaceId)) {
      throw new CrmActionError('EXECUTION_DISABLED', 'Applying approved CRM changes is not switched on for this workspace yet.');
    }

    const db = await this.db();
    const stored = await getApproval(db, input.proposalId, input.organizationId);
    if (stored?.kind === 'legacy_proposal') throw new CrmActionError('NEEDS_REPROPOSAL', 'This request was made before approvals were updated. Ask for it again.');
    if (stored?.kind !== 'v2' || stored.record.workspaceId !== input.workspaceId) {
      throw new CrmActionError('PROPOSAL_NOT_FOUND', 'This request no longer exists.');
    }
    const record = stored.record;
    const execRef = db.collection(CRM_EXECUTIONS).doc(record.approvalId);

    // Idempotent: a second click after success returns the same result.
    const prior = ExecutionRecordSchema.safeParse((await execRef.get()).data());
    if (prior.success && prior.data.status === 'applied') {
      return { proposalId: record.approvalId, status: 'executed', executionTimestamp: prior.data.executedAt, payloadHash: record.payloadHash, affectedRecord: prior.data.affectedRecord };
    }
    if (!record.executable) throw new CrmActionError('NOT_EXECUTABLE', 'This is a recommendation. Make the change yourself if you agree.');
    if (record.status === 'bound') throw new CrmActionError('EXECUTION_STATE_UNKNOWN', 'This change may already have been applied. Check the record before trying again.');
    if (record.status !== 'approved') throw new CrmActionError('PROPOSAL_NOT_APPROVED', 'This request has not been approved.');

    const actionType = typeof record.evidence?.actionType === 'string' ? record.evidence.actionType : '';
    const map = executableFor(actionType);
    if (!map || map.capabilityId !== record.capabilityId) throw new CrmActionError('NOT_EXECUTABLE', 'This change can no longer be applied automatically.');

    await this.assertOriginCurrent(db, record.workspaceId, record.evidence);

    const caller = await this.principalFor(input.callerId, input.organizationId, input.workspaceId);
    if (!caller) throw new CrmActionError('IDOR_VIOLATION', 'You no longer have access to this workspace.');
    const requester = await this.principalFor(record.requestedBy.userId, input.organizationId, input.workspaceId);
    if (!requester) throw new CrmActionError('REQUESTER_NOT_ACTIVE', 'The person who requested this no longer has access, so it was not applied.');
    const invocationId = `crm_exec_${record.approvalId}`;
    const agent = delegatedAgentPrincipal(requester, map.executingPersona, { runId: invocationId, toolInvocationId: invocationId });
    if (!agent) throw new CrmActionError('NOT_EXECUTABLE', 'No agent is set up to apply this change.');

    // Conflict check (Rule 18): the record must still be as it was when proposed.
    if (map.before && record.beforeState) {
      const current = await this.readState(map, record.payload, agent, 'agent', invocationId);
      if (!current || map.changed(record.beforeState, current)) {
        throw new CrmActionError('VERSION_CONFLICT', 'This record changed. Review the update again.');
      }
    }

    const result = await invokeGoverned({
      capabilityId: map.capabilityId,
      surface: 'agent',
      input: record.payload,
      principal: agent,
      approvalId: record.approvalId,
      idempotencyKey: invocationId,
      correlationId: invocationId,
    }, this.options.gatewayDeps);
    if (!result.success) throw new CrmActionError('EXECUTION_REFUSED', `${result.error.message} (${result.error.code})`);

    // Postcondition (Rule 31): only a confirmed change counts as applied.
    const after = map.before ? await this.readState(map, record.payload, agent, 'agent', invocationId) : null;
    const confirmed = map.confirmed(record.payload, after, result.data);
    const executedAt = new Date(this.now()).toISOString();
    const affectedRecord = affectedRecordFor(map.capabilityId, record.payload, result.data);
    const exec: ExecutionRecord = {
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      approvalId: record.approvalId,
      actionType,
      capabilityId: map.capabilityId,
      status: confirmed ? 'applied' : 'postcondition_failed',
      input: record.payload,
      beforeState: record.beforeState ?? null,
      afterState: after,
      affectedRecord,
      executedBy: input.callerId,
      executedAt,
    };
    await execRef.set(exec);

    if (!confirmed) {
      await defaultEventBus.publish(createDomainEvent({
        type: 'crm.action.postcondition_failed',
        organizationId: record.organizationId,
        workspaceId: record.workspaceId,
        actor: { type: 'user', id: input.callerId },
        entity: { type: 'crm_proposal', id: record.approvalId },
        source: 'crm_proposal_bridge',
        correlationId: `corr_exec_${record.approvalId}`,
        payload: { proposalId: record.approvalId, capabilityId: map.capabilityId, stateChanged: 'unknown' },
      }));
      throw new CrmActionError('POSTCONDITION_FAILED', "The change couldn't be confirmed. An operator has been alerted.");
    }

    await defaultEventBus.publish(createDomainEvent({
      type: 'crm.action.executed',
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      actor: { type: 'user', id: input.callerId },
      entity: { type: 'crm_proposal', id: record.approvalId },
      source: 'crm_proposal_bridge',
      correlationId: `corr_exec_${record.approvalId}`,
      payload: { proposalId: record.approvalId, capabilityId: map.capabilityId, executorId: input.callerId, targetPath: affectedRecord.targetPath, payloadHash: record.payloadHash, executedAt },
    }));

    return { proposalId: record.approvalId, status: 'executed', executionTimestamp: executedAt, payloadHash: record.payloadHash, affectedRecord };
  }

  /** Reverts an applied proposal with its inverse capability (Rule 27). */
  async rollbackAction(input: RollbackCrmActionInput): Promise<CrmProposalRollbackResult> {
    await this.guard(input.organizationId);
    const db = await this.db();
    const execRef = db.collection(CRM_EXECUTIONS).doc(input.proposalId);
    const exec = ExecutionRecordSchema.safeParse((await execRef.get()).data());
    if (!exec.success || exec.data.organizationId !== input.organizationId || exec.data.workspaceId !== input.workspaceId) {
      throw new CrmActionError('NOT_EXECUTED', 'Nothing was applied for this request, so there is nothing to undo.');
    }
    if (exec.data.status === 'rolled_back') throw new CrmActionError('ALREADY_REVERTED', 'This change was already undone.');
    if (exec.data.status !== 'applied') throw new CrmActionError('EXECUTION_STATE_UNKNOWN', 'This change was not confirmed, so it can\'t be undone automatically. Check the record.');

    const map = executableFor(exec.data.actionType);
    if (!map) throw new CrmActionError('NOT_REVERSIBLE', 'This change can\'t be undone automatically.');
    if (map.inverse.kind === 'none') throw new CrmActionError('NOT_REVERSIBLE', map.inverse.reason);
    if (!exec.data.beforeState) throw new CrmActionError('NOT_REVERSIBLE', 'The previous state was not captured, so this can\'t be undone automatically.');

    const caller = await this.principalFor(input.callerId, input.organizationId, input.workspaceId);
    if (!caller) throw new CrmActionError('IDOR_VIOLATION', 'You no longer have access to this workspace.');
    const correlationId = `crm_rollback_${input.proposalId}`;

    // Only undo what we applied: the record must still show our change.
    const current = await this.readState(map, exec.data.input, caller, 'ui', correlationId);
    if (!current || !exec.data.afterState || map.changed(exec.data.afterState, current)) {
      throw new CrmActionError('VERSION_CONFLICT', 'This record changed after the update, so it wasn\'t reverted.');
    }

    const result = await invokeGoverned({
      capabilityId: map.inverse.capabilityId,
      surface: 'ui',
      input: map.inverse.input(exec.data.beforeState, exec.data.input),
      principal: caller,
      idempotencyKey: correlationId,
      correlationId,
    }, this.options.gatewayDeps);
    if (!result.success) throw new CrmActionError('EXECUTION_REFUSED', `${result.error.message} (${result.error.code})`);

    const restored = await this.readState(map, exec.data.input, caller, 'ui', correlationId);
    if (!restored || map.changed(exec.data.beforeState, restored)) {
      throw new CrmActionError('POSTCONDITION_FAILED', "The undo couldn't be confirmed. Check the record.");
    }

    const revertedAt = new Date(this.now()).toISOString();
    await execRef.set({ ...exec.data, status: 'rolled_back', rolledBackBy: input.callerId, rolledBackAt: revertedAt, rollbackReason: input.reason });
    await defaultEventBus.publish(createDomainEvent({
      type: 'crm.action.reverted',
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actor: { type: 'user', id: input.callerId },
      entity: { type: 'crm_proposal', id: input.proposalId },
      source: 'crm_proposal_bridge',
      correlationId: `corr_rev_${input.proposalId}`,
      payload: { proposalId: input.proposalId, compensatingCapabilityId: map.inverse.capabilityId, revertedBy: input.callerId, reason: input.reason, revertedAt },
    }));
    return { proposalId: input.proposalId, status: 'reverted', revertedAt, compensatingCapabilityId: map.inverse.capabilityId, reason: input.reason };
  }
}

// Global HMR singleton preservation
declare global {
  var __smartsappCrmProposalBridge: CrmProposalBridge | undefined;
}

export function getCrmProposalBridge(): CrmProposalBridge {
  if (!globalThis.__smartsappCrmProposalBridge) {
    globalThis.__smartsappCrmProposalBridge = new CrmProposalBridge();
  }
  return globalThis.__smartsappCrmProposalBridge;
}
