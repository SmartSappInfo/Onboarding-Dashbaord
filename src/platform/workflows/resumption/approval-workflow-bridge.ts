/**
 * @fileOverview Approval Workflow Bridge (Phase 7 Milestone 3)
 *
 * Implements two-phase approval binding (Rules 21 & 22) between the Phase 3
 * Operator Approval Center and the Phase 7 Workflow Resumption Engine.
 *
 * Listens to `policy.approval.granted` and `policy.approval.rejected` domain events:
 * - On grant: verifies cryptographic `payloadHash` anti-tampering invariant (Rule 22),
 *   resumes the waiting workflow step via `WorkflowResumptionService.resumeStep`,
 *   and records operator approval metadata.
 * - On rejection: transitions step and instance to `FAILED`, records rejection error,
 *   and appends an immutable checkpoint (Rule 27 / Rule 40).
 */

import { createHash } from 'node:crypto';
import type { WorkflowStore } from '../workflow-store';
import type { WorkflowResumptionService } from './workflow-resumption-service';
import type { EventBus, EventBusSubscription } from '@/platform/events/event-bus';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { TenantBoundary } from '../workflow-types';
import { createCheckpointHash } from '../workflow-state-machine';

export interface ApprovalWorkflowBridgeOptions {
  store: WorkflowStore;
  resumptionService: WorkflowResumptionService;
  eventBus: EventBus;
}

export interface ApprovalWorkflowBridge {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

/**
 * Computes deterministic SHA-256 hash of a payload object with sorted keys (Rule 22).
 */
function computeCanonicalHash(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return createHash('sha256').update(String(payload)).digest('hex');
  }
  const canonical = JSON.stringify(payload, Object.keys(payload as Record<string, unknown>).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Creates an event-driven bridge connecting policy approval decisions to workflow resumptions.
 */
export function createApprovalWorkflowBridge(
  options: ApprovalWorkflowBridgeOptions
): ApprovalWorkflowBridge {
  const { store, resumptionService, eventBus } = options;
  const subscriptions: EventBusSubscription[] = [];
  let running = false;

  async function handleApprovalGranted(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown> | undefined;
    if (!payload) return;

    const workflowId = payload.workflowId as string | undefined;
    const stepId = payload.stepId as string | undefined;
    const token = payload.token as string | undefined;

    // Skip approvals that are not associated with a workflow step or missing tenant
    if (!workflowId || !stepId || !token || !event.organizationId || !event.workspaceId) {
      return;
    }

    const tenant: TenantBoundary = {
      organizationId: event.organizationId,
      workspaceId: event.workspaceId,
    };

    // 1. Fetch step and instance
    const [step, instance] = await Promise.all([
      store.getStep(workflowId, stepId, tenant),
      store.getInstance(workflowId, tenant),
    ]);

    if (!step || !instance) {
      return;
    }

    // Only process steps currently waiting for approval
    if (step.status !== 'WAITING' || instance.status !== 'WAITING') {
      return;
    }

    // 2. Cryptographic payloadHash verification (Rule 22 Anti-Tampering)
    const expectedHash = (step.waitCondition?.details as { payloadHash?: string } | undefined)?.payloadHash;
    const providedHash = payload.payloadHash as string | undefined;

    if (expectedHash && providedHash && expectedHash !== providedHash) {
      // Tampering detected: proposal was approved for a different payload
      return;
    }

    if (step.input && expectedHash) {
      const currentInputHash = computeCanonicalHash(step.input);
      if (currentInputHash !== expectedHash) {
        // Step input was modified post-proposal creation
        return;
      }
    }

    // 3. Resume the step via Resumption Service
    const proposalId = (payload.proposalId as string | undefined) ?? event.entity?.id;
    const decidedBy = (payload.decidedBy as string | undefined) ?? event.actor?.id ?? 'operator';
    const notes = payload.notes as string | undefined;

    try {
      await resumptionService.resumeStep({
        workflowId,
        stepId,
        token,
        tenant,
        source: 'approval',
        signalData: {
          approvalId: proposalId,
          approvedBy: decidedBy,
          notes,
          decidedAt: (payload.decidedAt as string | undefined) ?? new Date().toISOString(),
        },
        verifiedBy: decidedBy,
      });
    } catch {
      // Non-fatal if resumption service rejects due to dead-man switch or already consumed token
    }
  }

  async function handleApprovalRejected(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown> | undefined;
    if (!payload) return;

    const workflowId = payload.workflowId as string | undefined;
    const stepId = payload.stepId as string | undefined;

    if (!workflowId || !stepId || !event.organizationId || !event.workspaceId) {
      return;
    }

    const tenant: TenantBoundary = {
      organizationId: event.organizationId,
      workspaceId: event.workspaceId,
    };

    const [step, instance] = await Promise.all([
      store.getStep(workflowId, stepId, tenant),
      store.getInstance(workflowId, tenant),
    ]);

    if (!step || !instance) {
      return;
    }

    if (step.status !== 'WAITING') {
      return;
    }

    const rejectionReason = (payload.notes as string | undefined) ?? 'Approval rejected by operator';

    // 1. Mark step as FAILED
    await store.updateStep(
      workflowId,
      stepId,
      {
        status: 'FAILED',
        error: {
          code: 'APPROVAL_REJECTED',
          message: rejectionReason,
        },
      },
      tenant
    );

    // 2. Mark instance as FAILED
    await store.updateInstanceStatus(workflowId, 'FAILED', tenant);

    // 3. Record checkpoint WAITING -> FAILED
    const checkpoints = await store.listCheckpoints(workflowId, tenant);
    const sequence = checkpoints.length;
    const prevCheckpoint = sequence > 0 ? checkpoints[sequence - 1] : undefined;

    const checkpointPayload = {
      stepId,
      reason: 'APPROVAL_REJECTED',
      notes: rejectionReason,
      rejectedBy: payload.decidedBy ?? event.actor?.id,
      rejectedAt: new Date().toISOString(),
    };

    const hash = createCheckpointHash({
      workflowId,
      sequence,
      fromState: 'WAITING',
      toState: 'FAILED',
      stepId,
      statePayload: checkpointPayload,
      previousHash: prevCheckpoint?.hash,
    });

    await store.recordCheckpoint({
      workflowId,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      checkpointSequence: sequence,
      fromState: 'WAITING',
      toState: 'FAILED',
      stepId,
      statePayload: checkpointPayload,
      hash,
      previousHash: prevCheckpoint?.hash,
    });

    // 4. Publish domain event
    await eventBus.publish(
      createDomainEvent({
        type: 'workflow.state_changed',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        entity: { type: 'workflow', id: workflowId },
        actor: { type: 'system', id: 'approval_workflow_bridge' },
        correlationId: instance.correlationId,
        source: 'approval_workflow_bridge',
        payload: {
          fromState: 'WAITING',
          toState: 'FAILED',
          stepId,
          reason: 'APPROVAL_REJECTED',
        },
      })
    );
  }

  return {
    start(): void {
      if (running) return;
      running = true;

      const grantSub = eventBus.subscribe(
        'policy.approval.granted',
        handleApprovalGranted,
        { name: 'approval-workflow-bridge-granted' }
      );
      const rejectSub = eventBus.subscribe(
        'policy.approval.rejected',
        handleApprovalRejected,
        { name: 'approval-workflow-bridge-rejected' }
      );

      subscriptions.push(grantSub, rejectSub);
    },

    stop(): void {
      if (!running) return;
      running = false;
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
      subscriptions.length = 0;
    },

    isRunning(): boolean {
      return running;
    },
  };
}
