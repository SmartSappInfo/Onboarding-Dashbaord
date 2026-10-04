/**
 * @fileOverview Unit Tests for Approval Workflow Bridge (Phase 7 Milestone 3)
 *
 * Verifies event-driven integration with Phase 3 approvals, cryptographic SHA-256
 * payloadHash anti-tampering verification (Rule 21 & 22), automated resumption on approval grant,
 * and failure/rollback on rejection (Rule 27).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { createMemoryWorkflowStore } from '../../workflows/workflow-store';
import { createMemoryWorkflowLeaseManager } from '../../workflows/execution/workflow-lease-manager';
import { createMemoryWorkflowDispatcher } from '../../workflows/dispatcher/workflow-dispatcher';
import { createEventBus } from '../../events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { createWorkflowResumptionService } from '../../workflows/resumption/workflow-resumption-service';
import {
  createApprovalWorkflowBridge,
  type ApprovalWorkflowBridge,
} from '../../workflows/resumption/approval-workflow-bridge';
import type { TenantBoundary, CreateWorkflowInstanceInput, CreateWorkflowStepInput } from '../../workflows/workflow-types';

describe('Approval Workflow Bridge: Two-Phase Approval Integration (Rules 21 & 22)', () => {
  const tenant: TenantBoundary = {
    organizationId: 'org_approval_bridge_test',
    workspaceId: 'ws_approval_bridge_test',
  };

  let store: ReturnType<typeof createMemoryWorkflowStore>;
  let leaseManager: ReturnType<typeof createMemoryWorkflowLeaseManager>;
  let dispatcher: ReturnType<typeof createMemoryWorkflowDispatcher>;
  let eventBus: ReturnType<typeof createEventBus>;
  let resumptionService: ReturnType<typeof createWorkflowResumptionService>;
  let bridge: ApprovalWorkflowBridge;

  beforeEach(async () => {
    store = createMemoryWorkflowStore();
    leaseManager = createMemoryWorkflowLeaseManager();
    dispatcher = createMemoryWorkflowDispatcher({ store });
    eventBus = createEventBus();

    resumptionService = createWorkflowResumptionService({
      store,
      leaseManager,
      dispatcher,
      eventBus,
    });

    bridge = createApprovalWorkflowBridge({
      store,
      resumptionService,
      eventBus,
    });
    bridge.start();
  });

  function computePayloadHash(payload: Record<string, unknown>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(canonical).digest('hex');
  }

  async function setupWaitingApprovalStep(stepPayload: Record<string, unknown>) {
    const instanceInput: CreateWorkflowInstanceInput = {
      id: 'wf_approval_bridge_01',
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'def_discount_approval',
      title: 'Enterprise Discount Approval Workflow',
      initiator: { actorType: 'agent', actorId: 'agent_pricing' },
      principal: {
        actorType: 'agent',
        userId: 'user_sales_lead',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentId: 'agent_pricing',
        grantedScopes: ['crm:read', 'crm:write'],
        effectiveRole: 'editor',
      },
    };
    const instance = await store.createInstance(instanceInput);

    const stepInput: CreateWorkflowStepInput = {
      id: 'step_vp_approval',
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 0,
      capabilityId: 'crm.deal.apply_discount',
      name: 'Apply High Discount (>20%)',
      input: stepPayload,
      waitCondition: {
        type: 'approval',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        details: {
          proposalId: 'prop_999',
          payloadHash: computePayloadHash(stepPayload),
        },
      },
    };
    const step = await store.createStep(stepInput);

    // Suspend step
    const suspendResult = await resumptionService.evaluateAndSuspendStep(
      instance.id,
      step.id,
      tenant
    );

    return { instance, step, token: suspendResult.token! };
  }

  it('resumes waiting workflow when policy.approval.granted event is received with matching payloadHash', async () => {
    const payload = { dealId: 'deal_enterprise_1', discountPct: 25 };
    const { instance, step, token } = await setupWaitingApprovalStep(payload);
    const expectedHash = computePayloadHash(payload);

    // Publish approval granted event
    await eventBus.publish(
      createDomainEvent({
        type: 'policy.approval.granted',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        entity: { type: 'approval_proposal', id: 'prop_999' },
        actor: { type: 'user', id: 'user_vp_finance' },
        correlationId: 'corr_appr_01',
        source: 'operator_approval_center',
        payload: {
          proposalId: 'prop_999',
          capabilityId: 'crm.deal.apply_discount',
          decision: 'approved',
          decidedBy: 'user_vp_finance',
          decidedAt: new Date().toISOString(),
          notes: 'Approved for Q3 enterprise target',
          workflowId: instance.id,
          stepId: step.id,
          token,
          payloadHash: expectedHash,
        },
      })
    );

    // Verify instance state advanced to RESUMED
    const updatedInstance = await store.getInstance(instance.id, tenant);
    expect(updatedInstance?.status).toBe('RESUMED');

    // Verify step output recorded approval evidence
    const updatedStep = await store.getStep(instance.id, step.id, tenant);
    expect(updatedStep?.status).toBe('RUNNING');
    expect(updatedStep?.output).toMatchObject({
      approvalId: 'prop_999',
      approvedBy: 'user_vp_finance',
    });
  });

  it('rejects resumption if payloadHash was tampered with (Rule 22 Anti-Tampering)', async () => {
    const payload = { dealId: 'deal_enterprise_1', discountPct: 25 };
    const { instance, step, token } = await setupWaitingApprovalStep(payload);

    // Mutate step input payload secretly after proposal
    await store.updateStep(
      instance.id,
      step.id,
      {
        output: { tampered: true },
      },
      tenant
    );

    const forgedHash = '0000000000000000000000000000000000000000000000000000000000000000';

    // Publish event with forged hash
    await eventBus.publish(
      createDomainEvent({
        type: 'policy.approval.granted',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        entity: { type: 'approval_proposal', id: 'prop_999' },
        actor: { type: 'user', id: 'user_vp_finance' },
        correlationId: 'corr_appr_02',
        source: 'operator_approval_center',
        payload: {
          proposalId: 'prop_999',
          capabilityId: 'crm.deal.apply_discount',
          decision: 'approved',
          decidedBy: 'user_vp_finance',
          decidedAt: new Date().toISOString(),
          workflowId: instance.id,
          stepId: step.id,
          token,
          payloadHash: forgedHash,
        },
      })
    );

    // Verify workflow stayed in WAITING state and was NOT resumed
    const updatedInstance = await store.getInstance(instance.id, tenant);
    expect(updatedInstance?.status).toBe('WAITING');
  });

  it('transitions workflow to FAILED when policy.approval.rejected event is received (Rule 27)', async () => {
    const payload = { dealId: 'deal_enterprise_1', discountPct: 50 };
    const { instance, step, token } = await setupWaitingApprovalStep(payload);

    // Publish rejection event
    await eventBus.publish(
      createDomainEvent({
        type: 'policy.approval.rejected',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        entity: { type: 'approval_proposal', id: 'prop_999' },
        actor: { type: 'user', id: 'user_vp_finance' },
        correlationId: 'corr_appr_03',
        source: 'operator_approval_center',
        payload: {
          proposalId: 'prop_999',
          capabilityId: 'crm.deal.apply_discount',
          decision: 'rejected',
          decidedBy: 'user_vp_finance',
          decidedAt: new Date().toISOString(),
          notes: 'Discount too aggressive; rejected',
          workflowId: instance.id,
          stepId: step.id,
          token,
        },
      })
    );

    // Verify instance state transitioned to FAILED
    const updatedInstance = await store.getInstance(instance.id, tenant);
    expect(updatedInstance?.status).toBe('FAILED');

    // Verify step status transitioned to FAILED
    const updatedStep = await store.getStep(instance.id, step.id, tenant);
    expect(updatedStep?.status).toBe('FAILED');
    expect(updatedStep?.error?.code).toBe('APPROVAL_REJECTED');
  });

  it('can stop and clean up event subscriptions cleanly', () => {
    expect(bridge.isRunning()).toBe(true);
    bridge.stop();
    expect(bridge.isRunning()).toBe(false);
  });
});
