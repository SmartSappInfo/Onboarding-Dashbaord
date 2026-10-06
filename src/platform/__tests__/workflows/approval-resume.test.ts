/**
 * @fileOverview Durable workflow approvals and single-use resumption tokens (Phase 11 M0 · T5, F8).
 *
 * A high-risk step run by an agent suspends with a unified approval record (workflowRef); the
 * decision is read by the runner on the next run: approved → executes with the approvalId (bound
 * once by the gateway), rejected / expired → permanent failure, cancelled → decision ignored and
 * recorded. Resumption tokens are consumed through a ledger shared by every instance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import { FakeFirestore } from '../helpers/fake-firestore';
import { createWorkflowStepRunner, type StepRunnerOptions } from '@/platform/workflows/execution/workflow-step-runner';
import { createWorkflowApprovals } from '@/platform/workflows/execution/workflow-approvals';
import { createMemoryWorkflowStore, type WorkflowStore } from '@/platform/workflows/workflow-store';
import { createMemoryWorkflowLeaseManager } from '@/platform/workflows/execution/workflow-lease-manager';
import { createMemoryWorkflowDispatcher } from '@/platform/workflows/dispatcher/workflow-dispatcher';
import { createEventBus, type EventBus } from '@/platform/events/event-bus';
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { createToolFingerprintService, createMemoryFingerprintStore } from '@/platform/mcp/security/tool-fingerprint-service';
import { createWorkflowResumptionService } from '@/platform/workflows/resumption/workflow-resumption-service';
import { createMemoryTokenLedger } from '@/platform/workflows/resumption/resumption-token-ledger';
import { createInMemoryIdempotencyStore } from '@/platform/capabilities/storage/execution-store';
import { CAPABILITY_APPROVALS_COLLECTION } from '@/platform/capabilities/policy/approval-verifier';
import { createUnifiedApprovalVerifier, decideApproval, getApproval } from '@/platform/policy/unified-approval-store';
import type { CapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import type { StoredPrincipal } from '@/platform/tasks/agent-step-contract';
import type { WorkflowTaskPayload } from '@/platform/workflows/dispatcher/workflow-dispatcher-types';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

const tenant = { organizationId: 'org_appr_1', workspaceId: 'ws_appr_1' };
const principal: StoredPrincipal = {
  actorType: 'agent',
  userId: 'usr_requester',
  organizationId: tenant.organizationId,
  workspaceId: tenant.workspaceId,
  effectiveRole: 'admin',
  grantedScopes: ['rbac:operations.campuses.view'],
};

const handler = vi.fn(async (input: unknown) => ({
  success: true as const,
  data: { sent: true, input: input as Record<string, unknown> },
  executionId: 'exec_appr',
  emittedEvents: [],
  durationMs: 1,
}));

const highRisk: CapabilityDefinition<Record<string, unknown>, Record<string, unknown>> = {
  id: 'test.workflow.send_invoice',
  version: '1.0.0',
  name: 'Send invoice',
  description: 'High-risk step used by the approval resume tests',
  domain: 'crm_contacts',
  operation: 'execute',
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L3_EXTERNAL_COMMUNICATION_FINANCE', destructive: false, idempotent: false, openWorld: true, requiresHumanApproval: true, nonDelegable: false },
  permissions: ['rbac:operations.campuses.view'],
  execution: { synchronous: true, maxDurationMs: 10_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 100_000 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
  inputSchema: z.object({ invoiceId: z.string() }),
  outputSchema: z.record(z.string(), z.unknown()),
  handler,
};

let db: FakeFirestore;
let store: WorkflowStore;
let eventBus: EventBus;
let events: DomainEvent[];
let options: StepRunnerOptions;
const fs = () => db.asFirestore();

beforeEach(async () => {
  setGovernanceDeadManStateForTests(false);
  registerCapability(highRisk, { allowOverride: true });
  handler.mockClear();
  db = new FakeFirestore();
  store = createMemoryWorkflowStore();
  eventBus = createEventBus();
  events = [];
  eventBus.subscribe('*', async (e) => { events.push(e); });
  const leaseManager = createMemoryWorkflowLeaseManager();
  const dispatcher = createMemoryWorkflowDispatcher({ store, eventBus });
  const fingerprintService = createToolFingerprintService({ store: createMemoryFingerprintStore(), eventBus });
  await fingerprintService.approveFingerprint(highRisk, tenant, 'usr_admin');
  options = {
    store,
    leaseManager,
    dispatcher,
    eventBus,
    fingerprintService,
    resumptionService: createWorkflowResumptionService({ store, leaseManager, dispatcher, eventBus, tokenLedger: createMemoryTokenLedger() }),
    approvals: createWorkflowApprovals(fs),
    gatewayDeps: {
      registryLookup: (id) => (id === highRisk.id ? highRisk : undefined),
      approvals: createUnifiedApprovalVerifier(fs()),
      idempotencyStore: createInMemoryIdempotencyStore(),
      flagChecker: { checkFlag: async () => ({ enabled: true }) },
      verifyActorStanding: async () => ({ active: true }),
      auditSink: () => undefined,
      outboxSink: () => undefined,
    },
  };
});

async function startStep(): Promise<WorkflowTaskPayload> {
  const instance = await store.createInstance({
    ...tenant,
    definitionId: 'wf_def_invoice',
    title: 'Invoice follow-up',
    initiator: { actorType: 'agent', actorId: 'agent_1' },
    principal,
  });
  const step = await store.createStep({
    workflowId: instance.id,
    ...tenant,
    stepIndex: 0,
    capabilityId: highRisk.id,
    name: 'Send the overdue invoice',
    input: { invoiceId: 'inv_42' },
  });
  return { workflowId: instance.id, stepId: step.id, ...tenant, idempotencyKey: 'idem_appr', attempt: 0, correlationId: 'corr_appr' };
}

const run = (payload: WorkflowTaskPayload) => createWorkflowStepRunner().executeWorkflowStep(payload, options);

async function approvalIdFor(payload: WorkflowTaskPayload): Promise<string> {
  const step = await store.getStep(payload.workflowId, payload.stepId, tenant);
  const id = step?.waitCondition?.details?.approvalId;
  if (typeof id !== 'string') throw new Error('step has no approvalId');
  return id;
}

const decide = (approvalId: string, decision: 'approved' | 'rejected') => decideApproval(fs(), {
  approvalId,
  organizationId: tenant.organizationId,
  decision,
  nowMs: Date.now(),
  actor: { uid: 'usr_approver', isSystemAdmin: false, workspaceIds: [tenant.workspaceId], permissions: ['agent_approvals_decide'] },
});

describe('Durable workflow approvals (M0 · T5)', () => {
  it('suspends a high-risk agent step with a unified approval record that points back at the step', async () => {
    const payload = await startStep();
    const result = await run(payload);

    expect(result.status).toBe('WAITING');
    expect(handler).not.toHaveBeenCalled();
    const approvalId = await approvalIdFor(payload);
    const stored = await getApproval(fs(), approvalId, tenant.organizationId);
    expect(stored?.kind).toBe('v2');
    if (stored?.kind !== 'v2') return;
    expect(stored.record.status).toBe('pending');
    expect(stored.record.workflowRef).toEqual({ workflowId: payload.workflowId, stepId: payload.stepId });
    expect(stored.record.capabilityId).toBe(highRisk.id);
  });

  it('keeps waiting while the approval is pending', async () => {
    const payload = await startStep();
    await run(payload);
    const again = await run(payload);
    expect(again.status).toBe('WAITING');
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the step once approved, and the gateway binds the approval to this step', async () => {
    const payload = await startStep();
    await run(payload);
    const approvalId = await approvalIdFor(payload);
    expect((await decide(approvalId, 'approved')).ok).toBe(true);

    const result = await run(payload);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe('COMPLETED');
    expect(handler).toHaveBeenCalledTimes(1);
    const stored = await getApproval(fs(), approvalId, tenant.organizationId);
    expect(stored?.kind === 'v2' && stored.record.status).toBe('bound');
  });

  it('fails the step permanently when the approval is rejected', async () => {
    const payload = await startStep();
    await run(payload);
    await decide(await approvalIdFor(payload), 'rejected');

    const result = await run(payload);

    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('APPROVAL_REJECTED');
    expect(result.retryScheduled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('fails the step as expired when nobody decided in time', async () => {
    const payload = await startStep();
    await run(payload);
    const approvalId = await approvalIdFor(payload);
    const path = `${CAPABILITY_APPROVALS_COLLECTION}/${approvalId}`;
    db.write(path, { ...db.read(path), expiresAt: new Date(Date.now() - 1000).toISOString() });

    const result = await run(payload);

    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('APPROVAL_EXPIRED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores a decision for a cancelled workflow and records that it was ignored', async () => {
    const payload = await startStep();
    await run(payload);
    const approvalId = await approvalIdFor(payload);
    await store.updateInstanceStatus(payload.workflowId, 'CANCELLED', tenant);
    await decide(approvalId, 'approved');

    const result = await run(payload);

    expect(result.status).toBe('CANCELLED');
    expect(handler).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'workflow.approval_ignored')?.payload).toMatchObject({ approvalId, reason: 'workflow_cancelled' });
  });
});

describe('Single-use resumption tokens across instances (M0 · T5.4)', () => {
  it('refuses the same token on a second service instance that shares the ledger', async () => {
    const ledger = createMemoryTokenLedger();
    const deps = { store, leaseManager: createMemoryWorkflowLeaseManager(), dispatcher: createMemoryWorkflowDispatcher({ store, eventBus }), eventBus };
    const instanceA = createWorkflowResumptionService({ ...deps, tokenLedger: ledger });
    const instanceB = createWorkflowResumptionService({ ...deps, tokenLedger: ledger });

    const wf = await store.createInstance({ ...tenant, definitionId: 'wf_def_hook', title: 'Webhook wait', initiator: { actorType: 'user', actorId: 'usr_1' }, principal });
    const step = await store.createStep({
      workflowId: wf.id, ...tenant, stepIndex: 0, capabilityId: highRisk.id, name: 'Wait for payment', input: { invoiceId: 'inv_1' },
      waitCondition: { type: 'webhook', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), details: { event: 'invoice.paid' } },
    });
    const suspended = await instanceA.evaluateAndSuspendStep(wf.id, step.id, tenant);
    const signal = { workflowId: wf.id, stepId: step.id, token: suspended.token!, tenant, signalData: {}, verifiedBy: 'webhook_worker' };

    await instanceA.resumeStep(signal);
    await expect(instanceB.resumeStep(signal)).rejects.toMatchObject({ code: 'RESUMPTION_TOKEN_ALREADY_CONSUMED' });
  });
});
