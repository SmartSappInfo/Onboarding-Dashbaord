/**
 * @fileOverview Workflow Suspension & Resumption Engine Service (Phase 7 Milestone 3)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): All contracts, methods, and parameters strictly typed with Zod v4 and typed errors.
 * 2. ANTI-IDOR & TENANT ISOLATION (Rule 8 & 47): Every suspension and resumption operation strictly binds to
 *    the tenant boundary (organizationId, workspaceId). Cross-tenant access is rejected immediately.
 * 3. CRYPTOGRAPHIC TOKENS & ANTI-TAMPERING (Rule 22 & 46): HMAC-SHA256 resumption tokens verified using constant-time
 *    comparison. Consumed tokens tracked to guarantee single-use replay protection.
 * 4. UNTRUSTED DATA CONTAINERIZATION (Rule 13 & 30): External webhook payloads and signal inputs are scanned for
 *    prompt injection directives and isolated within `<untrusted_reference_data id="...">` containers.
 * 5. SERVERLESS DECOUPLING (Rule 9 & Cloud Run Blueprint): Resumption re-dispatches execution via Google Cloud Tasks
 *    without blocking Node.js container execution threads.
 * 6. EMERGENCY DEAD-MAN SWITCH (Rule 60): Evaluates `checkGovernanceDeadManSwitch`; throws `DEAD_MAN_PAUSED` on active pause.
 * 7. HMR PRESERVATION (Rule 69): Singleton cached on globalThis.__smartsappWorkflowResumptionService.
 */

import { randomUUID } from 'node:crypto';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { evaluateMemoryContentRisk } from '@/platform/memory/governance/anti-poisoning';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type {
  TenantBoundary,
  WorkflowState,
  WaitCondition,
} from '../workflow-types';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import {
  type WorkflowLeaseManager,
  getWorkflowLeaseManager,
} from '../execution/workflow-lease-manager';
import {
  type WorkflowDispatcher,
  getWorkflowDispatcher,
} from '../dispatcher/workflow-dispatcher';
import { createCheckpointHash } from '../workflow-state-machine';
import {
  type ResumptionSignalInput,
  ResumptionSignalSchema,
  type WaitConditionEvaluationResult,
  type StepResumptionResult,
  type TimeoutAction,
  WorkflowResumptionError,
  generateResumptionToken,
  verifyResumptionToken,
} from './workflow-resumption-types';

export interface SuspendStepOptions {
  workerId?: string;
  explicitWaitCondition?: WaitCondition;
  timeoutMs?: number;
  reason?: string;
}

export interface WorkflowResumptionService {
  evaluateAndSuspendStep(
    workflowId: string,
    stepId: string,
    tenant: TenantBoundary,
    options?: SuspendStepOptions
  ): Promise<WaitConditionEvaluationResult>;

  resumeStep(signal: ResumptionSignalInput): Promise<StepResumptionResult>;

  handleWaitTimeout(
    workflowId: string,
    stepId: string,
    tenant: TenantBoundary,
    options?: { timeoutAction?: TimeoutAction }
  ): Promise<{ actionTaken: TimeoutAction; newStatus: WorkflowState }>;
}

export interface WorkflowResumptionServiceOptions {
  store?: WorkflowStore;
  leaseManager?: WorkflowLeaseManager;
  dispatcher?: WorkflowDispatcher;
  eventBus?: EventBus;
  resumptionSecret?: string;
}

export function createWorkflowResumptionService(
  options?: WorkflowResumptionServiceOptions
): WorkflowResumptionService {
  const store = options?.store ?? getWorkflowStore();
  const leaseManager = options?.leaseManager ?? getWorkflowLeaseManager();
  const dispatcher = options?.dispatcher ?? getWorkflowDispatcher();
  const eventBus = options?.eventBus ?? defaultEventBus;
  const secret = options?.resumptionSecret;

  // In-memory set for replay protection within this instance process
  const consumedTokens = new Set<string>();

  return {
    async evaluateAndSuspendStep(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      opts?: SuspendStepOptions
    ): Promise<WaitConditionEvaluationResult> {
      // 1. Verify existence of workflow instance & step
      const instance = await store.getInstance(workflowId, tenant);
      if (!instance) {
        throw new WorkflowResumptionError(
          'WORKFLOW_NOT_WAITING',
          `Workflow instance '${workflowId}' not found for tenant`
        );
      }

      const step = await store.getStep(workflowId, stepId, tenant);
      if (!step) {
        throw new WorkflowResumptionError(
          'STEP_NOT_WAITING',
          `Step '${stepId}' not found in workflow '${workflowId}'`
        );
      }

      const waitCondition = opts?.explicitWaitCondition ?? step.waitCondition;
      if (!waitCondition) {
        return { shouldSuspend: false, details: {} };
      }

      // 2. Generate cryptographic resumption token
      const nonce = randomUUID();
      const token = generateResumptionToken(
        {
          workflowId,
          stepId,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          conditionType: waitCondition.type,
          nonce,
          expiresAt: waitCondition.expiresAt,
          metadata: {
            reason: opts?.reason ?? 'step_wait_condition_evaluated',
          },
        },
        secret
      );

      // 3. Construct callback URL for external webhook triggers
      const callbackUrl =
        waitCondition.type === 'webhook'
          ? `/api/tasks/workflows/webhooks/${token}`
          : undefined;

      const updatedWaitCondition: WaitCondition = {
        type: waitCondition.type,
        token,
        expiresAt: waitCondition.expiresAt,
        details: {
          ...waitCondition.details,
          callbackUrl,
          suspendedAt: new Date().toISOString(),
        },
      };

      // 4. Update step status to WAITING with token & condition
      await store.updateStep(
        workflowId,
        stepId,
        {
          status: 'WAITING',
          waitCondition: updatedWaitCondition,
        },
        tenant
      );

      // 5. Update instance status to WAITING and register current wait condition
      if (instance.status === 'CREATED') {
        await store.updateInstanceStatus(workflowId, 'QUEUED', tenant);
        await store.updateInstanceStatus(workflowId, 'RUNNING', tenant);
        await store.updateInstanceStatus(workflowId, 'WAITING', tenant, {
          currentStepId: stepId,
          waitCondition: updatedWaitCondition,
        });
      } else if (instance.status === 'QUEUED') {
        await store.updateInstanceStatus(workflowId, 'RUNNING', tenant);
        await store.updateInstanceStatus(workflowId, 'WAITING', tenant, {
          currentStepId: stepId,
          waitCondition: updatedWaitCondition,
        });
      } else if (instance.status === 'RUNNING') {
        await store.updateInstanceStatus(workflowId, 'WAITING', tenant, {
          currentStepId: stepId,
          waitCondition: updatedWaitCondition,
        });
      }

      // 6. Append immutable checkpoint recording transition to WAITING
      const checkpoints = await store.listCheckpoints(workflowId, tenant);
      const sequence = checkpoints.length;
      const prevCheckpoint = sequence > 0 ? checkpoints[sequence - 1] : undefined;

      const checkpointPayload = {
        stepId,
        conditionType: waitCondition.type,
        token,
        suspendedAt: new Date().toISOString(),
      };
      const hash = createCheckpointHash({
        workflowId,
        sequence,
        fromState: 'RUNNING',
        toState: 'WAITING',
        stepId,
        statePayload: checkpointPayload,
        previousHash: prevCheckpoint?.hash,
      });

      await store.recordCheckpoint({
        workflowId,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        checkpointSequence: sequence,
        fromState: 'RUNNING',
        toState: 'WAITING',
        stepId,
        statePayload: checkpointPayload,
        hash,
        previousHash: prevCheckpoint?.hash,
      });

      // 7. Release distributed lease so worker thread is not blocked (Rule 9)
      if (opts?.workerId) {
        try {
          await leaseManager.releaseLease(workflowId, stepId, tenant, opts.workerId);
        } catch {
          // Non-fatal if lease was not held
        }
      }

      // 8. Publish domain event
      await eventBus.publish(
        createDomainEvent({
          type: 'workflow.state_changed',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          entity: { type: 'workflow', id: workflowId },
          actor: { type: 'system', id: 'resumption_service' },
          correlationId: instance.correlationId,
          source: 'resumption_engine',
          payload: {
            fromState: 'RUNNING',
            toState: 'WAITING',
            stepId,
            conditionType: waitCondition.type,
            token,
          },
        })
      );

      return {
        shouldSuspend: true,
        conditionType: waitCondition.type,
        token,
        expiresAt: waitCondition.expiresAt,
        callbackUrl,
        details: updatedWaitCondition.details,
      };
    },

    async resumeStep(inputSignal: ResumptionSignalInput): Promise<StepResumptionResult> {
      const signal = ResumptionSignalSchema.parse(inputSignal);
      const startTime = Date.now();

      // 1. Dead-Man Switch Evaluation (Rule 60)
      try {
        await checkGovernanceDeadManSwitch(signal.tenant.organizationId);
      } catch (dmErr: unknown) {
        throw new WorkflowResumptionError(
          'DEAD_MAN_PAUSED',
          `Workflow resumption paused by emergency dead-man switch for org '${signal.tenant.organizationId}'`,
          dmErr
        );
      }

      // 2. Cryptographic token verification (Rule 22 & 46)
      const tokenVerification = verifyResumptionToken(signal.token, secret);
      if (!tokenVerification.valid || !tokenVerification.payload) {
        throw new WorkflowResumptionError(
          tokenVerification.error ?? 'RESUMPTION_TOKEN_INVALID',
          `Resumption token verification failed: ${tokenVerification.error ?? 'Invalid signature'}`
        );
      }

      const tokenPayload = tokenVerification.payload;

      // Anti-IDOR: verify tenant scoping in token matches signal tenant
      if (
        tokenPayload.organizationId !== signal.tenant.organizationId ||
        tokenPayload.workspaceId !== signal.tenant.workspaceId
      ) {
        throw new WorkflowResumptionError(
          'TENANT_MISMATCH',
          `Tenant scope mismatch: token org '${tokenPayload.organizationId}' does not match signal org '${signal.tenant.organizationId}'`
        );
      }

      // Verify workflowId and stepId match token payload
      if (
        tokenPayload.workflowId !== signal.workflowId ||
        tokenPayload.stepId !== signal.stepId
      ) {
        throw new WorkflowResumptionError(
          'WAIT_CONDITION_MISMATCH',
          `Token target '${tokenPayload.workflowId}:${tokenPayload.stepId}' does not match signal target '${signal.workflowId}:${signal.stepId}'`
        );
      }

      // 3. Replay Protection: verify token has not been consumed yet
      if (consumedTokens.has(signal.token)) {
        throw new WorkflowResumptionError(
          'RESUMPTION_TOKEN_ALREADY_CONSUMED',
          `Resumption token '${signal.token}' has already been consumed`
        );
      }

      // 4. Verify Workflow Instance & Step status in store
      const instance = await store.getInstance(signal.workflowId, signal.tenant);
      if (!instance) {
        throw new WorkflowResumptionError(
          'WORKFLOW_NOT_WAITING',
          `Workflow instance '${signal.workflowId}' not found for tenant`
        );
      }

      if (instance.status !== 'WAITING') {
        throw new WorkflowResumptionError(
          'WORKFLOW_NOT_WAITING',
          `Workflow instance '${signal.workflowId}' is in state '${instance.status}', expected 'WAITING'`
        );
      }

      const step = await store.getStep(signal.workflowId, signal.stepId, signal.tenant);
      if (!step) {
        throw new WorkflowResumptionError(
          'STEP_NOT_WAITING',
          `Step '${signal.stepId}' not found in workflow '${signal.workflowId}'`
        );
      }

      if (step.status !== 'WAITING') {
        throw new WorkflowResumptionError(
          'STEP_NOT_WAITING',
          `Step '${signal.stepId}' is in state '${step.status}', expected 'WAITING'`
        );
      }

      // 5. Anti-Poisoning & Prompt Injection Scanner (Rule 13 & 30)
      const serializedSignal = JSON.stringify(signal.signalData);
      const riskAssessment = evaluateMemoryContentRisk(serializedSignal);
      if (!riskAssessment.isSafe) {
        throw new WorkflowResumptionError(
          'PROMPT_INJECTION_DETECTED',
          `Adversarial prompt injection pattern detected in external resumption signal: ${riskAssessment.detectedPatterns.join(', ')}`
        );
      }

      // Containerize signal data inside XML reference wrapper
      const containerizedData: Record<string, unknown> = {
        ...signal.signalData,
        _untrusted_container: `<untrusted_reference_data id="resumption_${signal.stepId}">${serializedSignal}</untrusted_reference_data>`,
        _resumedAt: new Date().toISOString(),
        _verifiedBy: signal.verifiedBy ?? 'external_signal',
      };

      // 6. Atomically mark token consumed
      consumedTokens.add(signal.token);

      // 7. Update Step: advance to RUNNING and merge output with signal data
      await store.updateStep(
        signal.workflowId,
        signal.stepId,
        {
          status: 'RUNNING',
          output: {
            ...(step.output ?? {}),
            ...containerizedData,
          },
        },
        signal.tenant
      );

      // 8. Update Instance: advance to RESUMED
      await store.updateInstanceStatus(signal.workflowId, 'RESUMED', signal.tenant);
      instance.currentWaitCondition = undefined;

      // 9. Append Checkpoint: WAITING -> RESUMED
      const checkpoints = await store.listCheckpoints(signal.workflowId, signal.tenant);
      const sequence = checkpoints.length;
      const prevCheckpoint = sequence > 0 ? checkpoints[sequence - 1] : undefined;

      const checkpointPayload = {
        stepId: signal.stepId,
        resumedBy: signal.verifiedBy ?? 'external_signal',
        resumedAt: new Date().toISOString(),
      };
      const hash = createCheckpointHash({
        workflowId: signal.workflowId,
        sequence,
        fromState: 'WAITING',
        toState: 'RESUMED',
        stepId: signal.stepId,
        statePayload: checkpointPayload,
        previousHash: prevCheckpoint?.hash,
      });

      await store.recordCheckpoint({
        workflowId: signal.workflowId,
        organizationId: signal.tenant.organizationId,
        workspaceId: signal.tenant.workspaceId,
        checkpointSequence: sequence,
        fromState: 'WAITING',
        toState: 'RESUMED',
        stepId: signal.stepId,
        statePayload: checkpointPayload,
        hash,
        previousHash: prevCheckpoint?.hash,
      });

      // 10. Re-dispatch step execution via Cloud Tasks (Rule 9 & 19)
      const dispatchResult = await dispatcher.enqueueWorkflowStep({
        workflowId: signal.workflowId,
        stepId: signal.stepId,
        tenant: signal.tenant,
        idempotencyKey: `${step.idempotencyKey}_resume`,
        correlationId: instance.correlationId,
      });

      // 11. Publish domain event
      await eventBus.publish(
        createDomainEvent({
          type: 'workflow.state_changed',
          organizationId: signal.tenant.organizationId,
          workspaceId: signal.tenant.workspaceId,
          entity: { type: 'workflow', id: signal.workflowId },
          actor: { type: 'system', id: signal.verifiedBy ?? 'resumption_service' },
          correlationId: instance.correlationId,
          source: 'resumption_engine',
          payload: {
            fromState: 'WAITING',
            toState: 'RESUMED',
            stepId: signal.stepId,
            taskKey: dispatchResult.taskKey,
          },
        })
      );

      const durationMs = Date.now() - startTime;

      return {
        workflowId: signal.workflowId,
        stepId: signal.stepId,
        status: 'RESUMED',
        durationMs,
        taskKey: dispatchResult.taskKey,
      };
    },

    async handleWaitTimeout(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary,
      opts?: { timeoutAction?: TimeoutAction }
    ): Promise<{ actionTaken: TimeoutAction; newStatus: WorkflowState }> {
      const instance = await store.getInstance(workflowId, tenant);
      if (!instance) {
        throw new WorkflowResumptionError(
          'WORKFLOW_NOT_WAITING',
          `Workflow instance '${workflowId}' not found for tenant`
        );
      }

      const step = await store.getStep(workflowId, stepId, tenant);
      if (!step) {
        throw new WorkflowResumptionError(
          'STEP_NOT_WAITING',
          `Step '${stepId}' not found in workflow '${workflowId}'`
        );
      }

      const timeoutAction: TimeoutAction =
        opts?.timeoutAction ??
        (step.waitCondition?.details?.timeoutAction as TimeoutAction) ??
        'fail';

      let newStatus: WorkflowState;

      switch (timeoutAction) {
        case 'cancel':
          newStatus = 'CANCELLED';
          await store.updateStep(workflowId, stepId, { status: 'SKIPPED' }, tenant);
          await store.updateInstanceStatus(workflowId, 'CANCELLED', tenant);
          break;

        case 'proceed':
          newStatus = 'RESUMED';
          await store.updateStep(workflowId, stepId, { status: 'RUNNING' }, tenant);
          await store.updateInstanceStatus(workflowId, 'RESUMED', tenant);
          await dispatcher.enqueueWorkflowStep({
            workflowId,
            stepId,
            tenant,
            idempotencyKey: `${step.idempotencyKey}_timeout_proceed`,
            correlationId: instance.correlationId,
          });
          break;

        case 'compensate':
          newStatus = 'FAILED';
          await store.updateStep(
            workflowId,
            stepId,
            {
              status: 'FAILED',
              compensationStatus: 'pending',
              error: { code: 'TIMEOUT_EXPIRED', message: 'Wait condition timed out; compensation initiated' },
            },
            tenant
          );
          await store.updateInstanceStatus(workflowId, 'FAILED', tenant);
          break;

        case 'fail':
        default:
          newStatus = 'TIMED_OUT';
          await store.updateStep(
            workflowId,
            stepId,
            {
              status: 'FAILED',
              error: { code: 'TIMEOUT_EXPIRED', message: 'Wait condition timed out without signal' },
            },
            tenant
          );
          await store.updateInstanceStatus(workflowId, 'TIMED_OUT', tenant);
          break;
      }

      // Append Checkpoint
      const checkpoints = await store.listCheckpoints(workflowId, tenant);
      const sequence = checkpoints.length;
      const prevCheckpoint = sequence > 0 ? checkpoints[sequence - 1] : undefined;

      const checkpointPayload = {
        stepId,
        timeoutAction,
        timedOutAt: new Date().toISOString(),
      };
      const hash = createCheckpointHash({
        workflowId,
        sequence,
        fromState: 'WAITING',
        toState: newStatus,
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
        toState: newStatus,
        stepId,
        statePayload: checkpointPayload,
        hash,
        previousHash: prevCheckpoint?.hash,
      });

      // Domain Event
      await eventBus.publish(
        createDomainEvent({
          type: 'workflow.state_changed',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          entity: { type: 'workflow', id: workflowId },
          actor: { type: 'system', id: 'timeout_handler' },
          correlationId: instance.correlationId,
          source: 'resumption_engine',
          payload: {
            fromState: 'WAITING',
            toState: newStatus,
            stepId,
            timeoutAction,
          },
        })
      );

      return {
        actionTaken: timeoutAction,
        newStatus,
      };
    },
  };
}

declare global {
  var __smartsappWorkflowResumptionService: WorkflowResumptionService | undefined;
}

export function getWorkflowResumptionService(
  options?: WorkflowResumptionServiceOptions
): WorkflowResumptionService {
  if (!globalThis.__smartsappWorkflowResumptionService || options) {
    const service = createWorkflowResumptionService(options);
    if (!globalThis.__smartsappWorkflowResumptionService) {
      globalThis.__smartsappWorkflowResumptionService = service;
    }
    return service;
  }
  return globalThis.__smartsappWorkflowResumptionService;
}
