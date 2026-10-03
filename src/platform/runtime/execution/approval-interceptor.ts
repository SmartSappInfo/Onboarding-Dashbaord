/**
 * @fileOverview Two-Phase Action Approval Interceptor & Cryptographic Binding (Rules 17, 21, 22, 27, 41, 60)
 *
 * Implements:
 * - Rule 17: Non-Delegable Action Stripping & Human Approval Gating.
 * - Rule 21: Two-Phase Action Model for High-Risk Operations (PLAN -> PREVIEW -> APPROVE -> EXECUTE).
 * - Rule 22: Cryptographic SHA-256 Approval Binding (payloadHash validation against tampering).
 * - Rule 27: Formal Saga Compensation trigger on proposal rejection.
 * - Rule 40: Audit Event Publication (`agent.run.approval_required`).
 * - Rule 41: Full decision provenance: WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE.
 * - Rule 60: Emergency Dead-Man Switch Evaluation.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import crypto from 'node:crypto';
import {
  type ActionProposal,
  type ActionProposalStatus,
  type CreateProposalInput,
  ActionProposalSchema,
} from '@/platform/policy/approval-proposal-types';
import { type AgentRun, type PlanStep } from '../agent-run-types';
import { type AgentPersonaDefinition } from '@/platform/identity/agent-persona-types';
import { RISK_LEVEL_WEIGHTS } from '@/platform/capabilities/contracts/risk-levels';
import { type AgentRunStore, getAgentRunStore } from '../agent-run-store';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { adminDb } from '@/lib/firebase-admin';
import {
  type ApprovalInterceptionResult,
  ExecutionError,
} from './execution-types';

// ============================================================================
// 1. APPROVAL STORE INTERFACE & ADAPTERS
// ============================================================================

export interface ApprovalStore {
  createProposal(input: CreateProposalInput): Promise<ActionProposal>;
  getProposal(organizationId: string, proposalId: string): Promise<ActionProposal | null>;
  updateProposalStatus(input: {
    organizationId: string;
    proposalId: string;
    status: ActionProposalStatus;
    decidedBy?: string;
    decisionNotes?: string;
  }): Promise<ActionProposal>;
}

export function createMemoryApprovalStore(): ApprovalStore {
  const proposals = new Map<string, ActionProposal>();

  const buildKey = (orgId: string, propId: string) => `${orgId}:${propId}`;

  return {
    async createProposal(input: CreateProposalInput): Promise<ActionProposal> {
      const proposalId = `prop_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 86400) * 1000).toISOString();

      const payloadHash = ApprovalInterceptor.computePayloadHash(input.payload);

      const proposal: ActionProposal = {
        proposalId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        capabilityId: input.capabilityId,
        capabilityVersion: input.capabilityVersion,
        agentPersonaId: input.agentPersonaId,
        authorizingUserId: input.authorizingUserId,
        delegationId: input.delegationId,
        delegationChain: input.delegationChain,
        toolInvocationId: input.toolInvocationId,
        what: input.what,
        why: input.why,
        blastRadius: input.blastRadius,
        evidence: input.evidence,
        payload: input.payload,
        payloadHash,
        status: 'pending',
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };

      const parsed = ActionProposalSchema.parse(proposal);
      proposals.set(buildKey(input.organizationId, proposalId), parsed);
      return { ...parsed };
    },

    async getProposal(organizationId: string, proposalId: string): Promise<ActionProposal | null> {
      const found = proposals.get(buildKey(organizationId, proposalId));
      return found ? { ...found } : null;
    },

    async updateProposalStatus(input: {
      organizationId: string;
      proposalId: string;
      status: ActionProposalStatus;
      decidedBy?: string;
      decisionNotes?: string;
    }): Promise<ActionProposal> {
      const key = buildKey(input.organizationId, input.proposalId);
      const existing = proposals.get(key);

      if (!existing) {
        throw new ExecutionError({
          code: 'INVALID_EXECUTION_STATE',
          message: `Action proposal '${input.proposalId}' not found.`,
          organizationId: input.organizationId,
        });
      }

      const now = new Date().toISOString();
      const updated: ActionProposal = {
        ...existing,
        status: input.status,
        updatedAt: now,
        decisionNotes: input.decisionNotes ?? existing.decisionNotes,
        ...(input.status === 'approved'
          ? { approvedBy: input.decidedBy, approvedAt: now }
          : {}),
        ...(input.status === 'rejected'
          ? { rejectedBy: input.decidedBy, rejectedAt: now }
          : {}),
      };

      const parsed = ActionProposalSchema.parse(updated);
      proposals.set(key, parsed);
      return { ...parsed };
    },
  };
}

export function createFirestoreApprovalStore(): ApprovalStore {
  return {
    async createProposal(input: CreateProposalInput): Promise<ActionProposal> {
      const proposalId = `prop_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 86400) * 1000).toISOString();

      const payloadHash = ApprovalInterceptor.computePayloadHash(input.payload);

      const proposal: ActionProposal = {
        proposalId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        capabilityId: input.capabilityId,
        capabilityVersion: input.capabilityVersion,
        agentPersonaId: input.agentPersonaId,
        authorizingUserId: input.authorizingUserId,
        delegationId: input.delegationId,
        delegationChain: input.delegationChain,
        toolInvocationId: input.toolInvocationId,
        what: input.what,
        why: input.why,
        blastRadius: input.blastRadius,
        evidence: input.evidence,
        payload: input.payload,
        payloadHash,
        status: 'pending',
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };

      const parsed = ActionProposalSchema.parse(proposal);
      await adminDb.collection('capability_approvals').doc(proposalId).set(parsed);
      return { ...parsed };
    },

    async getProposal(organizationId: string, proposalId: string): Promise<ActionProposal | null> {
      const doc = await adminDb.collection('capability_approvals').doc(proposalId).get();
      if (!doc.exists) return null;
      const data = doc.data();
      if (!data || data.organizationId !== organizationId) return null;
      return ActionProposalSchema.parse(data);
    },

    async updateProposalStatus(input: {
      organizationId: string;
      proposalId: string;
      status: ActionProposalStatus;
      decidedBy?: string;
      decisionNotes?: string;
    }): Promise<ActionProposal> {
      const docRef = adminDb.collection('capability_approvals').doc(input.proposalId);
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new ExecutionError({
          code: 'INVALID_EXECUTION_STATE',
          message: `Action proposal '${input.proposalId}' not found.`,
          organizationId: input.organizationId,
        });
      }

      const existing = ActionProposalSchema.parse(doc.data());
      if (existing.organizationId !== input.organizationId) {
        throw new ExecutionError({
          code: 'INVALID_EXECUTION_STATE',
          message: 'Tenant mismatch on proposal status update.',
          organizationId: input.organizationId,
        });
      }

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: input.status,
        updatedAt: now,
        decisionNotes: input.decisionNotes ?? null,
      };

      if (input.status === 'approved') {
        updateData.approvedBy = input.decidedBy ?? 'system';
        updateData.approvedAt = now;
      } else if (input.status === 'rejected') {
        updateData.rejectedBy = input.decidedBy ?? 'system';
        updateData.rejectedAt = now;
      }

      await docRef.update(updateData);
      return ActionProposalSchema.parse({ ...existing, ...updateData });
    },
  };
}

// ============================================================================
// 2. APPROVAL INTERCEPTOR ENGINE
// ============================================================================

export interface ApprovalInterceptorOptions {
  approvalStore?: ApprovalStore;
  runStore?: AgentRunStore;
  eventBus?: EventBus;
}

export class ApprovalInterceptor {
  private readonly approvalStore: ApprovalStore;
  private readonly runStore: AgentRunStore;
  private readonly eventBus: EventBus;

  constructor(options?: ApprovalInterceptorOptions) {
    this.approvalStore =
      options?.approvalStore ??
      (process.env.NODE_ENV === 'test'
        ? createMemoryApprovalStore()
        : createFirestoreApprovalStore());
    this.runStore = options?.runStore ?? getAgentRunStore();
    this.eventBus = options?.eventBus ?? defaultEventBus;
  }

  /**
   * Deterministically computes SHA-256 hash of payload using canonical key-sorting (Rule 22).
   */
  public static computePayloadHash(payload: Record<string, unknown>): string {
    const canonicalString = (obj: unknown): string => {
      if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
      }
      if (Array.isArray(obj)) {
        return `[${obj.map(canonicalString).join(',')}]`;
      }
      const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
      const entries = sortedKeys.map(
        (key) => `${JSON.stringify(key)}:${canonicalString((obj as Record<string, unknown>)[key])}`
      );
      return `{${entries.join(',')}}`;
    };

    return crypto.createHash('sha256').update(canonicalString(payload)).digest('hex');
  }

  /**
   * Evaluates if a plan step requires two-phase human approval before execution (Rules 17 & 21).
   */
  public async evaluateStepApproval(params: {
    run: AgentRun;
    planStep: PlanStep;
    persona: AgentPersonaDefinition;
    existingProposalId?: string;
  }): Promise<ApprovalInterceptionResult> {
    const { run, planStep, persona, existingProposalId } = params;

    // 1. Emergency Dead-Man Switch Check (Rule 60)
    await checkGovernanceDeadManSwitch(run.organizationId);

    const isL3OrL4 =
      planStep.riskLevel === 'L3_EXTERNAL_COMMUNICATION_FINANCE' ||
      planStep.riskLevel === 'L4_PRIVILEGED_DESTRUCTIVE';

    const stepRiskWeight = planStep.riskLevel ? RISK_LEVEL_WEIGHTS[planStep.riskLevel] : 0;
    const personaRiskWeight = RISK_LEVEL_WEIGHTS[persona.maxAutonomousRiskLevel];
    const exceedsAutonomousCeiling = stepRiskWeight > personaRiskWeight;

    const requiresApproval = isL3OrL4 || planStep.isNonDelegable || exceedsAutonomousCeiling;

    if (!requiresApproval) {
      return {
        requiresApproval: false,
        isNonDelegable: false,
      };
    }

    const payload = planStep.arguments ?? {};
    const payloadHash = ApprovalInterceptor.computePayloadHash(payload);

    // If an existing proposal was already linked, check its current status (Resumption flow)
    if (existingProposalId) {
      const existingProposal = await this.approvalStore.getProposal(run.organizationId, existingProposalId);
      if (existingProposal) {
        if (existingProposal.status === 'approved') {
          return {
            requiresApproval: false,
            actionProposalId: existingProposal.proposalId,
            payloadHash: existingProposal.payloadHash,
            riskLevel: planStep.riskLevel,
            isNonDelegable: planStep.isNonDelegable,
            reason: 'Proposal was approved by human operator.',
          };
        } else if (existingProposal.status === 'rejected') {
          throw new ExecutionError({
            code: 'APPROVAL_REJECTED',
            message: `Proposal '${existingProposalId}' for step '${planStep.title}' was rejected by operator.`,
            runId: run.runId,
            stepId: planStep.stepId,
            organizationId: run.organizationId,
          });
        } else {
          return {
            requiresApproval: true,
            actionProposalId: existingProposal.proposalId,
            payloadHash: existingProposal.payloadHash,
            riskLevel: planStep.riskLevel,
            isNonDelegable: planStep.isNonDelegable,
            reason: 'Proposal is currently pending operator review.',
          };
        }
      }
    }

    // Determine specific reason
    let reason = 'Action requires operator approval.';
    if (planStep.isNonDelegable) {
      reason = `Capability '${planStep.capabilityId}' is marked non-delegable and requires human approval (Rule 17).`;
    } else if (isL3OrL4) {
      reason = `Risk level '${planStep.riskLevel}' requires two-phase human approval (Rule 21).`;
    } else if (exceedsAutonomousCeiling) {
      reason = `Step risk level '${planStep.riskLevel}' exceeds persona '${persona.id}' autonomous ceiling '${persona.maxAutonomousRiskLevel}'.`;
    }

    // 2. Create ActionProposal in store (Rule 21 & 41)
    const proposal = await this.approvalStore.createProposal({
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      capabilityId: planStep.capabilityId || 'system.unspecified',
      capabilityVersion: planStep.capabilityVersion || '1.0.0',
      agentPersonaId: run.agentPersonaId,
      authorizingUserId: run.authorizingUserId,
      what: planStep.title,
      why: run.goal.prompt,
      blastRadius: {
        entityCount: 1,
        entityType: planStep.capabilityId || 'action',
        riskLevel: planStep.riskLevel || 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        targetSummary: planStep.expectedStateChange,
      },
      evidence: {
        goalPrompt: run.goal.prompt,
        stepIndex: planStep.stepIndex,
      },
      payload,
    });

    // 3. Transition run status to 'waiting_for_approval' in store
    const currentRun = (await this.runStore.getRun(run.organizationId, run.runId)) ?? run;
    if (currentRun.status === 'created') {
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'planning',
        reason: 'Advancing to planning prior to execution approval pause',
      });
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'executing',
        reason: 'Advancing to executing prior to execution approval pause',
      });
    } else if (currentRun.status === 'planning') {
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'executing',
        reason: 'Advancing to executing prior to execution approval pause',
      });
    }

    await this.runStore.updateRunStatus({
      organizationId: run.organizationId,
      runId: run.runId,
      toStatus: 'waiting_for_approval',
      reason: `Paused for human approval of proposal '${proposal.proposalId}'.`,
    });

    // 4. Publish domain event to event bus (Rule 40 & 62)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'agent.run.approval_required',
        source: 'agent-approval-interceptor',
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        actor: { type: 'agent', id: run.principalId },
        entity: { type: 'agent_run', id: run.runId },
        correlationId: `corr_${run.runId}`,
        payload: {
          runId: run.runId,
          stepId: planStep.stepId,
          proposalId: proposal.proposalId,
          capabilityId: planStep.capabilityId,
          riskLevel: planStep.riskLevel,
          payloadHash,
          reason,
        },
      })
    );

    return {
      requiresApproval: true,
      actionProposalId: proposal.proposalId,
      payloadHash,
      riskLevel: planStep.riskLevel,
      reason,
      isNonDelegable: planStep.isNonDelegable,
    };
  }

  /**
   * Verifies that an approved proposal matches the exact payload being executed (Rule 22).
   */
  public async verifyApprovalBinding(params: {
    organizationId: string;
    proposalId: string;
    currentPayload: Record<string, unknown>;
  }): Promise<void> {
    const { organizationId, proposalId, currentPayload } = params;

    const proposal = await this.approvalStore.getProposal(organizationId, proposalId);
    if (!proposal) {
      throw new ExecutionError({
        code: 'APPROVAL_REQUIRED',
        message: `Action proposal '${proposalId}' not found.`,
        organizationId,
      });
    }

    if (proposal.status !== 'approved') {
      throw new ExecutionError({
        code: 'APPROVAL_REQUIRED',
        message: `Action proposal '${proposalId}' is not approved (current status: '${proposal.status}').`,
        organizationId,
      });
    }

    // Verify expiration
    if (new Date(proposal.expiresAt).getTime() < Date.now()) {
      throw new ExecutionError({
        code: 'APPROVAL_REQUIRED',
        message: `Action proposal '${proposalId}' expired at ${proposal.expiresAt}.`,
        organizationId,
      });
    }

    // Rule 22: Cryptographic Payload Hash Matching
    const currentHash = ApprovalInterceptor.computePayloadHash(currentPayload);
    if (currentHash !== proposal.payloadHash) {
      throw new ExecutionError({
        code: 'PAYLOAD_TAMPERED',
        message: `Execution payload does not match approved proposal hash (expected ${proposal.payloadHash}, computed ${currentHash}). Execution aborted (Rule 22).`,
        organizationId,
      });
    }
  }

  public getStore(): ApprovalStore {
    return this.approvalStore;
  }
}
