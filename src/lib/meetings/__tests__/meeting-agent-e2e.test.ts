// @vitest-environment node
/**
 * @fileOverview Meeting Agent Full Workflow A End-to-End Verification Test (Phase 11 M2 · T8).
 *
 * Exhaustively tests the entire end-to-end pipeline:
 * 1. Transcript Ingestion (valid completed transcript with speaker turns).
 * 2. Pipeline Trigger (requestIntelligenceRun creates pending run, schedules task).
 * 3. Chunker, Evidence Validator & Pipeline Execution (processIntelligenceRun executes chunks).
 * 4. Header-last Intelligence Storage with Line Evidence.
 * 5. Follow-up Tasks Creation from Validated Commitments (createTaskCore + claim tracking).
 * 6. CRM Proposal Generation (proposeMeetingCrmUpdate bound to checked decision).
 * 7. Anti-Self-Approval Enforcement (Rule 13: proposer cannot approve).
 * 8. Two-Phase Approval (approver approves proposal).
 * 9. Governed Execution & Postcondition Verification (stage updated in DB).
 * 10. Reverse-LIFO Saga Compensation Rollback (stage safely restored).
 *
 * Rules: 4, 8, 12, 13, 16, 17, 18, 19, 21, 22, 27, 30, 31, 40, 41, 47, 60, 67.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { executeCapability } from '@/platform/capabilities/execution/execute-capability';
import { CrmProposalBridge, CRM_PROPOSAL_EXECUTION_FLAG } from '@/platform/agents/crm/actions/crm-proposal-bridge';
import { createInMemoryIdempotencyStore } from '@/platform/capabilities/storage/execution-store';
import { createUnifiedApprovalVerifier, decideApproval, getApproval } from '@/platform/policy/unified-approval-store';
import {
  processIntelligenceRun,
  requestIntelligenceRun,
  type IntelligenceModel,
  type IntelligenceModelRequest,
  type PipelineDeps,
} from '../intelligence/pipeline';
import { proposeMeetingCrmUpdate, type MeetingCrmProposalDeps } from '../intelligence/crm-proposals';
import { readIntelligenceV2 } from '../intelligence/intelligence-store';
import { createTaskCore } from '@/lib/tasks/task-core';
import { CircuitBreaker } from '@/platform/events/resilience/circuit-breaker';

const h = vi.hoisted(() => ({
  db: undefined as unknown,
  scheduled: [] as string[],
}));

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

vi.mock('@/lib/gcp-tasks-client', () => ({
  scheduleTaskWithKey: async (key: string) => {
    h.scheduled.push(key);
    return key;
  },
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async () => undefined),
}));

vi.mock('@/platform/events/event-bus', () => {
  const publish = vi.fn(async () => undefined);
  return { defaultEventBus: { publish }, globalEventBus: { publish } };
});

let db: FakeFirestore;
const fs = () => db.asFirestore();

const NOW = '2026-10-07T12:00:00.000Z';
const nowMs = () => Date.parse(NOW);

// Capability stubs for deal get & advance stage
const ok = <T>(data: T) => ({ success: true as const, data, executionId: 'e', emittedEvents: [], durationMs: 1 });
const base = { version: '1.0.0', workspaceScoped: true, tenantScoped: true } as const;
const exec = { synchronous: true, maxDurationMs: 2000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 };
const policies = { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false };

const DealGetInput = z.object({ workspaceId: z.string(), dealId: z.string() });
const dealGet: AnyCapabilityDefinition = {
  ...base,
  id: 'deal.get',
  name: 'Get deal',
  description: 'Reads a deal',
  domain: 'deals_revenue',
  operation: 'read',
  inputSchema: DealGetInput,
  outputSchema: z.object({ id: z.string(), stageId: z.string() }).loose(),
  permissions: ['sales:pipeline:view', 'app:deals_view', 'deal:read'],
  risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec,
  policies,
  handler: async (input) => {
    const { dealId, workspaceId } = DealGetInput.parse(input);
    const deal = db.read(`deals/${dealId}`);
    if (!deal || deal.workspaceId !== workspaceId) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deal not found', stateChanged: 'no', retryable: false },
        executionId: 'e',
        emittedEvents: [],
        durationMs: 1,
      };
    }
    return ok({ id: dealId, stageId: String(deal.stageId) });
  },
};

const AdvanceInput = z.object({ workspaceId: z.string(), dealId: z.string(), stageId: z.string(), reason: z.string().optional() });
const dealAdvance: AnyCapabilityDefinition = {
  ...base,
  id: 'deal.advance_stage',
  name: 'Advance stage',
  description: 'Moves a deal',
  domain: 'deals_revenue',
  operation: 'update',
  inputSchema: AdvanceInput,
  outputSchema: z.object({ dealId: z.string(), stageId: z.string() }).loose(),
  permissions: ['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update'],
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec,
  policies,
  handler: async (input) => {
    const { dealId, stageId } = AdvanceInput.parse(input);
    const prev = db.read(`deals/${dealId}`);
    db.write(`deals/${dealId}`, { ...prev, stageId, updatedAt: NOW });
    return ok({ dealId, stageId });
  },
};

const registry = new Map([dealGet, dealAdvance].map((c) => [c.id, c]));

const human = (uid: string, scopes: string[]): AgentPrincipal => ({
  actorType: 'user',
  userId: uid,
  organizationId: 'org-1',
  workspaceId: 'ws-a',
  grantedScopes: scopes,
  effectiveRole: 'member',
});

const salesRep = human('rep-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'rbac:operations.meetings.edit', 'tasks_manage']);
const manager = human('admin-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'agent_approvals_decide']);
const people: Record<string, AgentPrincipal> = {
  'rep-1': salesRep,
  'admin-1': manager,
};

describe('Meeting Agent Workflow A End-to-End', () => {
  let bridge: CrmProposalBridge;
  let proposalDeps: MeetingCrmProposalDeps;

  beforeEach(() => {
    db = new FakeFirestore();
    h.db = db;
    h.scheduled.length = 0;

    bridge = new CrmProposalBridge({
      db: fs(),
      lookup: (id) => registry.get(id),
      loadPrincipal: async ({ uid }) => people[uid] ?? null,
      flags: {
        getFlagRecord: async (id) =>
          id === CRM_PROPOSAL_EXECUTION_FLAG ? { capabilityId: id, workspaceOverrides: { 'ws-a': { enabled: true } } } : null,
      },
      gatewayDeps: {
        registryLookup: (id) => registry.get(id),
        approvals: createUnifiedApprovalVerifier(fs()),
        idempotencyStore: createInMemoryIdempotencyStore(),
        flagChecker: { checkFlag: async () => ({ enabled: true }) },
        verifyActorStanding: async () => ({ active: true }),
        auditSink: () => undefined,
        outboxSink: () => undefined,
      },
      nowMs,
    });

    proposalDeps = {
      nowMs,
      propose: (input) => bridge.proposeAction(input),
      approvalState: async (approvalId, organizationId) => {
        const stored = await getApproval(fs(), approvalId, organizationId);
        return stored?.kind === 'v2' ? { status: stored.record.status, executable: stored.record.executable } : null;
      },
    };

    // Seed workspace, meeting, deal, user
    db.write('workspaces/ws-a', { organizationId: 'org-1', timezone: 'UTC' });
    db.write('users/rep-1', {
      id: 'rep-1',
      organizationId: 'org-1',
      workspaceIds: ['ws-a'],
      permissions: ['system_admin', 'tasks_manage'],
    });
    db.write('meetings/m-1', {
      workspaceIds: ['ws-a'],
      title: 'Enterprise Q4 Expansion Review',
      meetingTime: '2026-10-07T10:00:00.000Z',
      updatedAt: NOW,
    });
    db.write('deals/d-100', {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      title: 'Enterprise 500-seat Expansion',
      stageId: 'qualified',
      updatedAt: NOW,
    });
  });

  it('executes Workflow A completely: ingestion → extraction → task creation → CRM proposal → approval → mutation → rollback', async () => {
    // 1. Ingest Transcript
    const transcriptId = 'tr_11223344556677889900aabbccddeeff';
    db.write(`meeting_transcripts/${transcriptId}`, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      source: 'recording',
      status: 'completed',
      version: 1,
      schemaVersion: 2,
      chunkCount: 1,
      segmentCount: 3,
      speakers: [
        { id: 'spk-1', name: 'Kwame' },
        { id: 'spk-2', name: 'Ama (Buyer)' },
      ],
      dataClass: 'personal',
      aiUse: 'allowed',
      provenance: { createdBy: 'rep-1', principalKind: 'user' },
      injection: { flagged: false, patterns: [] },
      createdAt: NOW,
      updatedAt: NOW,
    });
    db.write(`meeting_transcripts/${transcriptId}/segments/0000`, {
      index: 0,
      segments: [
        { id: 's1', speakerId: 'spk-1', speakerName: 'Kwame', startMs: 0, endMs: 5000, text: 'Good morning everyone, lets review the contract terms.' },
        { id: 's2', speakerId: 'spk-2', speakerName: 'Ama (Buyer)', startMs: 6000, endMs: 12000, text: 'We agreed to proceed with the proposal and move the deal to proposal stage.' },
        { id: 's3', speakerId: 'spk-1', speakerName: 'Kwame (Seller)', startMs: 13000, endMs: 18000, text: 'Excellent, I will deliver the revised SLA agreement by Friday.' },
      ],
    });

    // 2. Request Intelligence Pipeline Run
    const fakeModel: IntelligenceModel = {
      breakerKey: 'test',
      async extract(req: IntelligenceModelRequest) {
        return {
          modelId: 'googleai/flash-test',
          inputTokens: 120,
          outputTokens: 80,
          output: {
            items: [
              {
                type: 'decision',
                text: 'Move the deal to proposal stage',
                confidence: 0.95,
                evidence: [{ segmentIds: ['s2'], quote: 'move the deal to proposal stage' }],
              },
              {
                type: 'commitment',
                text: 'Deliver the revised SLA agreement by Friday',
                ownerName: 'Kwame',
                dueText: 'by Friday',
                confidence: 0.92,
                evidence: [{ segmentIds: ['s3'], quote: 'deliver the revised SLA agreement by Friday' }],
              },
            ],
          },
        };
      },
      async summarize() {
        return {
          modelId: 'googleai/pro-test',
          output: {
            sentences: [
              { text: 'The client agreed to move to the proposal stage.', itemIds: ['it_1'] },
            ],
          },
        };
      },
    };

    const pipelineDeps: PipelineDeps = {
      model: fakeModel,
      breaker: new CircuitBreaker(),
      nowMs,
      schedule: async (key) => {
        h.scheduled.push(key);
      },
    };

    const reqResult = await requestIntelligenceRun(fs(), pipelineDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      transcriptId,
      requestedBy: { userId: 'rep-1', principalKind: 'user' },
    });

    expect(reqResult.status).toBe('pending');
    expect(h.scheduled.length).toBe(1);

    // 3. Process Pipeline Worker (Cloud Task worker execution)
    const runOutcome = await processIntelligenceRun(fs(), pipelineDeps, reqResult.runId);
    expect(runOutcome.status).toBe('completed');
    if (runOutcome.status === 'completed') {
      expect(runOutcome.kept).toBe(2);
      expect(runOutcome.needsReview).toBe(0);
    }

    // 4. Verify Stored Intelligence & Items
    const intelligence = await readIntelligenceV2(fs(), 'm-1', 'ws-a');
    expect(intelligence).not.toBeNull();
    expect(intelligence?.header.counts.kept).toBe(2);
    expect(intelligence?.items.length).toBe(2);

    const commitmentItem = intelligence?.items.find((i) => i.type === 'commitment');
    const decisionItem = intelligence?.items.find((i) => i.type === 'decision');
    expect(commitmentItem).toBeDefined();
    expect(decisionItem).toBeDefined();

    // 5. Create Follow-up Task from Commitment Item
    const taskResult = await createTaskCore(
      {
        workspaceId: 'ws-a',
        organizationId: 'org-1',
        title: commitmentItem!.text,
        description: `Follow-up from meeting m-1: ${commitmentItem!.text}`,
        priority: 'high',
        status: 'todo',
        category: 'follow_up',
        assignedTo: 'rep-1',
        dueDate: '2026-10-10',
        reminders: [],
        reminderSent: false,
        relatedEntityType: 'Meeting',
        relatedEntityId: 'm-1',
        source: 'system',
      },
      { kind: 'user', uid: 'rep-1' }
    );
    expect(taskResult.success).toBe(true);
    if (!taskResult.success) throw new Error('Task creation failed');
    expect(taskResult.id).toBeDefined();
    const storedTask = db.read(`tasks/${taskResult.id}`);
    expect(storedTask).toMatchObject({
      title: 'Deliver the revised SLA agreement by Friday',
      workspaceId: 'ws-a',
    });

    // 6. Propose CRM Update (Deal Stage advancement) from Decision Item
    const proposalResult = await proposeMeetingCrmUpdate(fs(), proposalDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      meetingTitle: 'Enterprise Q4 Expansion Review',
      itemHash: decisionItem!.itemHash,
      target: { kind: 'deal_stage', dealId: 'd-100', stageId: 'proposal' },
      actorUid: 'rep-1',
      expectedVersion: intelligence!.header.version,
    });
    expect(proposalResult.proposalId).toBeDefined();
    expect(proposalResult.executable).toBe(true); // automated executable action bound to capability

    // 7. Verify Anti-Self-Approval Enforcement (Rule 13)
    const selfApprove = await decideApproval(fs(), {
      approvalId: proposalResult.proposalId,
      organizationId: 'org-1',
      decision: 'approved',
      nowMs: nowMs(),
      actor: { uid: 'rep-1', isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['agent_approvals_decide'] },
    });
    expect(selfApprove.ok).toBe(false);

    // 8. Legitimate Manager Approves Proposal
    const managerApprove = await decideApproval(fs(), {
      approvalId: proposalResult.proposalId,
      organizationId: 'org-1',
      decision: 'approved',
      nowMs: nowMs(),
      actor: { uid: 'admin-1', isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['agent_approvals_decide'] },
    });
    expect(managerApprove.ok).toBe(true);

    // 9. Execute Approved Proposal & Verify Mutation
    const execResult = await bridge.executeApprovedProposal({
      organizationId: 'org-1',
      workspaceId: 'ws-a',
      callerId: 'admin-1',
      proposalId: proposalResult.proposalId,
    });
    expect(execResult.status).toBe('executed');

    // 10. Postcondition Verification: Deal Stage Changed in Firestore
    const updatedDeal = db.read('deals/d-100');
    expect(updatedDeal?.stageId).toBe('proposal');

    // 11. Reverse-LIFO Saga Compensation Rollback
    await bridge.rollbackAction({
      organizationId: 'org-1',
      workspaceId: 'ws-a',
      callerId: 'admin-1',
      proposalId: proposalResult.proposalId,
      reason: 'Customer renegotiated terms',
    });

    // Verify Deal Stage Restored to Original
    const revertedDeal = db.read('deals/d-100');
    expect(revertedDeal?.stageId).toBe('qualified');
  });
});
