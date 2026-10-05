/**
 * @fileOverview Workflow Step Execution Runner (Phase 7 Milestone 2)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4 and typed errors.
 * 2. 9-STAGE EXECUTION PIPELINE (Rule 68):
 *    Dead-Man -> Lease Acquisition -> Tenant & Authority -> Tool Fingerprint ->
 *    Input Sanitization -> Execution with Cancellation -> Post-Condition -> Checkpoint Commit -> DAG Progression.
 * 3. TOCTOU CONCURRENCY & LEASE SAFETY (Rule 18): Atomic lease protects single active execution per step.
 * 4. PROMPT INJECTION & UNTRUSTED DATA CONTAINERIZATION (Rule 13 & 30):
 *    Step inputs and reference data scanned with anti-poisoning engine.
 * 5. EXPONENTIAL BACKOFF RETRY & RANDOMIZED JITTER (Rule 23):
 *    T = min(300, 2^attempt * 5) + jitter.
 * 6. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowStepRunner.
 */

import { randomUUID } from 'node:crypto';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { evaluateMemoryContentRisk } from '@/platform/memory/governance/anti-poisoning';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { getCapability } from '@/platform/capabilities/registry/capability-registry';
import { evaluatePrincipalAuthority } from '@/platform/capabilities/policy/principal-evaluator';
import type { AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import { classifyRefusal, invokeGoverned } from '@/platform/capabilities/execution/invoke-governed';
import type { ExecuteCapabilityDeps } from '@/platform/capabilities/execution/execute-capability';
import {
  type ToolFingerprintService,
  getToolFingerprintService,
} from '@/platform/mcp/security/tool-fingerprint-service';
import type { TenantBoundary, WorkflowStep, WorkflowInstance } from '../workflow-types';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import type { WorkflowTaskPayload } from '../dispatcher/workflow-dispatcher-types';
import {
  type WorkflowDispatcher,
  getWorkflowDispatcher,
} from '../dispatcher/workflow-dispatcher';
import {
  type WorkflowLeaseManager,
  getWorkflowLeaseManager,
} from './workflow-lease-manager';
import { createCheckpointHash } from '../workflow-state-machine';
import {
  type StepExecutionResult,
  StepExecutionResultSchema,
  WorkflowExecutionError,
} from './workflow-execution-types';
import {
  type WorkflowResumptionService,
  getWorkflowResumptionService,
} from '../resumption/workflow-resumption-service';
import {
  type WorkflowRetryPolicy,
  getWorkflowRetryPolicy,
} from '../resilience/workflow-retry-policy';
import {
  type WorkflowDlqService,
  getWorkflowDlqService,
} from '../resilience/workflow-dlq-service';
import {
  type WorkflowSagaEngine,
  getWorkflowSagaEngine,
} from '../resilience/workflow-saga-engine';

export interface StepRunnerOptions {
  workerId?: string;
  store?: WorkflowStore;
  leaseManager?: WorkflowLeaseManager;
  dispatcher?: WorkflowDispatcher;
  resumptionService?: WorkflowResumptionService;
  eventBus?: EventBus;
  fingerprintService?: ToolFingerprintService;
  retryPolicy?: WorkflowRetryPolicy;
  dlqService?: WorkflowDlqService;
  sagaEngine?: WorkflowSagaEngine;
  signal?: AbortSignal;
  /** Gateway dependencies (tests inject fakes; production uses the governed defaults). */
  gatewayDeps?: ExecuteCapabilityDeps;
}

export interface WorkflowStepRunner {
  executeWorkflowStep(
    payload: WorkflowTaskPayload,
    options?: StepRunnerOptions
  ): Promise<StepExecutionResult>;
}

export function calculateBackoffDelay(attempt: number): number {
  const baseSeconds = Math.min(300, Math.pow(2, Math.max(0, attempt)) * 5);
  const jitter = Math.floor(Math.random() * 3);
  return baseSeconds + jitter;
}

export function createWorkflowStepRunner(): WorkflowStepRunner {
  return {
    async executeWorkflowStep(
      payload: WorkflowTaskPayload,
      options?: StepRunnerOptions
    ): Promise<StepExecutionResult> {
      const workerId = options?.workerId ?? `worker_${randomUUID()}`;
      const store = options?.store ?? getWorkflowStore();
      const leaseManager = options?.leaseManager ?? getWorkflowLeaseManager();
      const dispatcher = options?.dispatcher ?? getWorkflowDispatcher();
      const eventBus = options?.eventBus ?? defaultEventBus;
      const fingerprintService = options?.fingerprintService ?? getToolFingerprintService();
      const retryPolicy = options?.retryPolicy ?? getWorkflowRetryPolicy();
      const dlqService = options?.dlqService ?? getWorkflowDlqService();
      const sagaEngine = options?.sagaEngine ?? getWorkflowSagaEngine();

      const tenant: TenantBoundary = {
        organizationId: payload.organizationId,
        workspaceId: payload.workspaceId,
      };

      const correlationId = payload.correlationId || payload.workflowId;
      const startTime = Date.now();

      // ── Stage 1: Dead-Man Switch Evaluation (Rule 60) ───────────────────────
      try {
        await checkGovernanceDeadManSwitch(payload.organizationId);
      } catch (dmErr: unknown) {
        throw new WorkflowExecutionError(
          'DEAD_MAN_PAUSED',
          `Workflow step execution paused: organization ${payload.organizationId} has active dead-man switch`,
          dmErr
        );
      }

      // ── Stage 2: Lease Acquisition (Rule 9 & 18) ────────────────────────────
      await leaseManager.acquireLease(payload.workflowId, payload.stepId, tenant, workerId);

      let step: WorkflowStep | null = null;
      let instance: WorkflowInstance | null = null;

      try {
        // ── Stage 3: Tenant & Authority Check (Rule 18 & 47) ─────────────────
        instance = await store.getInstance(payload.workflowId, tenant);
        if (!instance) {
          throw new WorkflowExecutionError(
            'EXECUTION_FAILED',
            `Workflow instance ${payload.workflowId} not found for tenant`
          );
        }

        if (instance.status === 'CANCELLED') {
          await leaseManager.releaseLease(payload.workflowId, payload.stepId, tenant, workerId);
          return StepExecutionResultSchema.parse({
            stepId: payload.stepId,
            status: 'CANCELLED',
            durationMs: 0,
            nextStepsScheduled: [],
            retryScheduled: false,
          });
        }

        step = await store.getStep(payload.workflowId, payload.stepId, tenant);
        if (!step) {
          throw new WorkflowExecutionError(
            'EXECUTION_FAILED',
            `Step ${payload.stepId} not found in workflow ${payload.workflowId}`
          );
        }

        // Idempotency: if step is already completed or skipped, release lease and return
        if (step.status === 'COMPLETED' || step.status === 'SKIPPED') {
          await leaseManager.releaseLease(payload.workflowId, payload.stepId, tenant, workerId);
          return StepExecutionResultSchema.parse({
            stepId: payload.stepId,
            status: step.status,
            output: step.output,
            durationMs: step.durationMs ?? 0,
            nextStepsScheduled: [],
            retryScheduled: false,
          });
        }

        // ── Stage 3.5: Suspension Evaluation (Wait Condition / Non-Delegable) (Rules 17, 21, 22) ──
        const alreadyResumed = Boolean(
          step.output && (step.output as Record<string, unknown>)._resumedAt
        );

        if (step.waitCondition && !alreadyResumed) {
          const resumptionService =
            options?.resumptionService ??
            getWorkflowResumptionService({
              store,
              leaseManager,
              dispatcher,
              eventBus,
            });

          await resumptionService.evaluateAndSuspendStep(
            payload.workflowId,
            payload.stepId,
            tenant,
            { workerId }
          );

          return StepExecutionResultSchema.parse({
            stepId: payload.stepId,
            status: 'WAITING',
            durationMs: Date.now() - startTime,
            nextStepsScheduled: [],
            retryScheduled: false,
          });
        }

        // If step is already in WAITING status and not yet resumed, release lease and return WAITING
        if (step.status === 'WAITING' && !alreadyResumed) {
          await leaseManager.releaseLease(payload.workflowId, payload.stepId, tenant, workerId);
          return StepExecutionResultSchema.parse({
            stepId: payload.stepId,
            status: 'WAITING',
            durationMs: Date.now() - startTime,
            nextStepsScheduled: [],
            retryScheduled: false,
          });
        }

        // Advance step status to RUNNING
        const newAttempt = (step.attempt ?? 0) + 1;
        step = await store.updateStep(
          payload.workflowId,
          payload.stepId,
          { status: 'RUNNING', attempt: newAttempt },
          tenant
        );

        if (instance.status === 'CREATED') {
          await store.updateInstanceStatus(payload.workflowId, 'QUEUED', tenant);
          await store.updateInstanceStatus(payload.workflowId, 'RUNNING', tenant);
        } else if (instance.status === 'QUEUED' || instance.status === 'RESUMED') {
          await store.updateInstanceStatus(payload.workflowId, 'RUNNING', tenant);
        }

        // ── Stage 4: Capability Discovery & Tool Fingerprint Drift (Rule 14) ──
        const capability = getCapability(step.capabilityId);
        if (!capability) {
          throw new WorkflowExecutionError(
            'CAPABILITY_NOT_FOUND',
            `Capability '${step.capabilityId}' is not registered in the canonical registry`
          );
        }

        // Rule 17 & 21: Non-delegable actions or high-risk L3/L4 require approval suspension if caller is agent
        const isNonDelegable = Boolean(capability.risk?.nonDelegable);
        const isHighRisk =
          capability.risk?.level === 'L3_EXTERNAL_COMMUNICATION_FINANCE' ||
          capability.risk?.level === 'L4_PRIVILEGED_DESTRUCTIVE';
        const requiresApproval =
          (isNonDelegable || isHighRisk) &&
          !alreadyResumed &&
          instance.principal.actorType === 'agent';

        if (requiresApproval && !step.waitCondition) {
          const resumptionService =
            options?.resumptionService ??
            getWorkflowResumptionService({
              store,
              leaseManager,
              dispatcher,
              eventBus,
            });

          await store.updateStep(
            payload.workflowId,
            payload.stepId,
            {
              waitCondition: {
                type: 'approval',
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                details: {
                  reason: isNonDelegable
                    ? 'non_delegable_action'
                    : 'high_risk_capability',
                  riskLevel: capability.risk.level,
                },
              },
            },
            tenant
          );

          await resumptionService.evaluateAndSuspendStep(
            payload.workflowId,
            payload.stepId,
            tenant,
            { workerId }
          );

          return StepExecutionResultSchema.parse({
            stepId: payload.stepId,
            status: 'WAITING',
            durationMs: Date.now() - startTime,
            nextStepsScheduled: [],
            retryScheduled: false,
          });
        }

        // Verify principal authority (Rule 16, 17, 18)
        const storedPrincipal = instance.principal;
        const principal: AgentPrincipal = {
          actorType: 'agent',
          userId: storedPrincipal.userId,
          organizationId: storedPrincipal.organizationId,
          workspaceId: storedPrincipal.workspaceId,
          agentId: storedPrincipal.agentId,
          agentVersion: storedPrincipal.agentVersion,
          delegationId: storedPrincipal.delegationId,
          grantedScopes: storedPrincipal.grantedScopes,
          effectiveRole: storedPrincipal.effectiveRole,
        };
        const authResult = evaluatePrincipalAuthority(
          principal,
          capability,
          tenant
        );
        if (!authResult.allowed) {
          throw new WorkflowExecutionError(
            'AUTHORIZATION_DENIED',
            `Authority evaluation denied execution for capability '${step.capabilityId}': ${authResult.violations.join('; ')}`
          );
        }

        // Verify fingerprint drift
        const fingerprintResult = await fingerprintService.verifyCapabilityFingerprint(
          capability,
          tenant
        );
        if (!fingerprintResult.isValid) {
          throw new WorkflowExecutionError(
            'FINGERPRINT_DRIFT_DETECTED',
            `Cryptographic tool fingerprint drift detected for capability '${step.capabilityId}'`
          );
        }

        // ── Stage 5: Input Sanitization & Injection Scanner (Rule 13 & 30) ───
        const stepInput = {
          ...(step.input ?? {}),
          ...(step.output ?? {}),
        };
        const inputSerialized = JSON.stringify(stepInput);
        const riskAssessment = evaluateMemoryContentRisk(inputSerialized);
        if (!riskAssessment.isSafe) {
          throw new WorkflowExecutionError(
            'INJECTION_DETECTED',
            `Adversarial prompt injection pattern detected in step input: ${riskAssessment.detectedPatterns.join(', ')}`
          );
        }

        // ── Stage 6: Step Execution with Cancellation Token (Rule 26 & 42) ───
        await eventBus.publish(
          createDomainEvent({
            type: 'workflow.step_started',
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            entity: { type: 'workflow', id: payload.workflowId },
            actor: { type: 'agent', id: workerId },
            correlationId,
            source: 'workflow_runner',
            payload: {
              stepId: payload.stepId,
              capabilityId: step.capabilityId,
              attempt: newAttempt,
            },
          })
        );

        let output: Record<string, unknown>;

        if (instance.dryRun) {
          // Rule 42: Shadow Mode / Simulation
          output = {
            simulated: true,
            capabilityId: step.capabilityId,
            input: stepInput,
            simulatedAt: new Date().toISOString(),
          };
        } else {
          // Real capability execution
          // Rule 24: Check 5-State Capability Circuit Breaker
          const breaker = retryPolicy.getCircuitBreaker(step.capabilityId, tenant);
          const breakerState = breaker.getState();
          if (breakerState === 'open') {
            throw new WorkflowExecutionError(
              'CIRCUIT_BREAKER_OPEN',
              `Circuit breaker for capability '${step.capabilityId}' is OPEN (fast fail)`
            );
          }

          // CAUTION (Phase 11 M0 · T3, F3/B6): steps execute through the governed gateway, never by
          // calling `capability.handler()`. The gateway re-checks flags, tenant, resource scope, live
          // standing, approvals, idempotency, audit and outbox. The step key is deterministic, so a
          // retry after a lost response replays the stored result instead of acting twice (Rule 20).
          const executionResult = await invokeGoverned(
            {
              capabilityId: step.capabilityId,
              surface: 'task_worker',
              input: stepInput,
              principal,
              correlationId: payload.workflowId,
              causationId: payload.stepId,
              idempotencyKey: `wf_${payload.workflowId}_${payload.stepId}`,
            },
            options?.gatewayDeps
          );
          if (!executionResult.success) {
            const refusal = classifyRefusal(executionResult.error.code, executionResult.error.retryable);
            throw new WorkflowExecutionError(
              refusal === 'authority' ? 'AUTHORIZATION_DENIED' : refusal === 'invalid' ? 'INPUT_VALIDATION_FAILED' : 'EXECUTION_FAILED',
              `Capability execution refused (${executionResult.error.code}): ${executionResult.error.message}`
            );
          }

          // Record successful execution in circuit breaker (Rule 24)
          breaker.recordSuccess();

          const rawData = executionResult.data;
          output = (rawData && typeof rawData === 'object')
            ? (rawData as Record<string, unknown>)
            : { value: rawData };
        }

        const durationMs = Date.now() - startTime;
        const finalOutput = {
          ...(step.output ?? {}),
          ...output,
        };

        // ── Stage 7: Post-Condition Output Validation (Rule 47) ───────────────
        if (capability.outputSchema) {
          const parsed = capability.outputSchema.safeParse(output);
          if (!parsed.success) {
            const issues = 'issues' in parsed.error ? parsed.error.issues : [];
            const msg = (issues as Array<{ message: string }>).map((i) => i.message).join('; ') || 'Invalid output schema';
            throw new WorkflowExecutionError(
              'OUTPUT_VALIDATION_FAILED',
              `Step output failed capability output schema: ${msg}`
            );
          }
        }

        // ── Stage 8: Atomic Checkpoint & Lease Release (Rule 18 & 40) ────────
        await store.updateStep(
          payload.workflowId,
          payload.stepId,
          {
            status: 'COMPLETED',
            output: finalOutput,
            durationMs,
          },
          tenant
        );

        const checkpoints = await store.listCheckpoints(payload.workflowId, tenant);
        const sequence = checkpoints.length;
        const previousHash = sequence > 0 ? checkpoints[sequence - 1].hash : undefined;
        const statePayload = {
          status: 'COMPLETED',
          stepId: payload.stepId,
          capabilityId: step.capabilityId,
          durationMs,
        };

        const hash = createCheckpointHash({
          workflowId: payload.workflowId,
          sequence,
          fromState: 'RUNNING',
          toState: 'RUNNING',
          stepId: payload.stepId,
          statePayload,
          previousHash,
        });

        await store.recordCheckpoint({
          workflowId: payload.workflowId,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          checkpointSequence: sequence,
          fromState: 'RUNNING',
          toState: 'RUNNING',
          stepId: payload.stepId,
          statePayload,
          hash,
          previousHash,
        });

        await leaseManager.releaseLease(payload.workflowId, payload.stepId, tenant, workerId);

        // ── Stage 9: DAG Advancement & Dependency Unblocking ─────────────────
        const nextStepsScheduled: string[] = [];
        const allSteps = await store.listSteps(payload.workflowId, tenant);

        const completedStepIds = new Set(
          allSteps
            .filter((s) => s.status === 'COMPLETED' || s.id === payload.stepId)
            .map((s) => s.id)
        );

        const unblockedPendingSteps = allSteps.filter((s) => {
          if (s.status !== 'PENDING') return false;
          const deps = s.dependsOn ?? [];
          return deps.every((depId) => completedStepIds.has(depId));
        });

        for (const unblocked of unblockedPendingSteps) {
          await store.updateStep(
            payload.workflowId,
            unblocked.id,
            { status: 'QUEUED' },
            tenant
          );

          await dispatcher.enqueueWorkflowStep({
            workflowId: payload.workflowId,
            stepId: unblocked.id,
            tenant,
            idempotencyKey: `step_${unblocked.id}_${randomUUID()}`,
            correlationId,
          });

          nextStepsScheduled.push(unblocked.id);
        }

        // Check if all steps in the workflow are now COMPLETED
        const allStepsCompleted = allSteps.every((s) =>
          s.id === payload.stepId ? true : s.status === 'COMPLETED' || s.status === 'SKIPPED'
        );

        if (allStepsCompleted) {
          await store.updateInstanceStatus(payload.workflowId, 'COMPLETED', tenant, {
            outputs: finalOutput,
          });

          await eventBus.publish(
            createDomainEvent({
              type: 'workflow.completed',
              organizationId: payload.organizationId,
              workspaceId: payload.workspaceId,
              entity: { type: 'workflow', id: payload.workflowId },
              actor: { type: 'system', id: 'workflow_runner' },
              correlationId,
              source: 'workflow_runner',
              payload: {
                workflowId: payload.workflowId,
                durationMs: Date.now() - startTime,
              },
            })
          );
        }

        await eventBus.publish(
          createDomainEvent({
            type: 'workflow.step_completed',
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            entity: { type: 'workflow', id: payload.workflowId },
            actor: { type: 'agent', id: workerId },
            correlationId,
            source: 'workflow_runner',
            payload: {
              stepId: payload.stepId,
              durationMs,
              nextStepsScheduled,
            },
          })
        );

        return StepExecutionResultSchema.parse({
          stepId: payload.stepId,
          status: 'COMPLETED',
          output: finalOutput,
          durationMs,
          nextStepsScheduled,
          retryScheduled: false,
        });
      } catch (err: unknown) {
        // Safe lease release on failure
        try {
          await leaseManager.releaseLease(payload.workflowId, payload.stepId, tenant, workerId);
        } catch {
          // Ignore lease release error during exception handling
        }

        const durationMs = Date.now() - startTime;
        const errorCode = err instanceof WorkflowExecutionError
          ? err.code
          : 'EXECUTION_FAILED';
        const errorMessage = err instanceof Error ? err.message : String(err);
        const currentAttempt = step?.attempt ?? 1;
        const maxAttempts = step?.maxAttempts ?? 3;

        // Record failure in circuit breaker (Rule 24)
        if (step?.capabilityId) {
          const breaker = retryPolicy.getCircuitBreaker(step.capabilityId, tenant);
          breaker.recordFailure();
        }

        // Tri-state error classification (Rule 23 & 48)
        const classification = retryPolicy.classifyError(err);
        const isTransient = classification.category === 'TRANSIENT';

        // Check if retry attempts remain for transient failures (Rule 23)
        if (
          isTransient &&
          currentAttempt < maxAttempts &&
          errorCode !== 'DEAD_MAN_PAUSED' &&
          errorCode !== 'AUTHORIZATION_DENIED'
        ) {
          const backoff = retryPolicy.calculateBackoffDelay(currentAttempt);
          const delaySeconds = Math.max(calculateBackoffDelay(currentAttempt), backoff.delaySeconds);

          await store.updateStep(
            payload.workflowId,
            payload.stepId,
            {
              status: 'QUEUED',
              attempt: currentAttempt,
              error: {
                code: errorCode,
                message: errorMessage,
              },
            },
            tenant
          );

          await dispatcher.enqueueWorkflowStep({
            workflowId: payload.workflowId,
            stepId: payload.stepId,
            tenant,
            attempt: currentAttempt,
            delaySeconds,
            idempotencyKey: `retry_${payload.stepId}_${currentAttempt}_${randomUUID()}`,
            correlationId,
          });

          await eventBus.publish(
            createDomainEvent({
              type: 'workflow.step_retry_scheduled',
              organizationId: payload.organizationId,
              workspaceId: payload.workspaceId,
              entity: { type: 'workflow', id: payload.workflowId },
              actor: { type: 'system', id: 'workflow_runner' },
              correlationId,
              source: 'workflow_runner',
              payload: {
                stepId: payload.stepId,
                attempt: currentAttempt,
                delaySeconds,
                error: { code: errorCode, message: errorMessage },
              },
            })
          );

          return StepExecutionResultSchema.parse({
            stepId: payload.stepId,
            status: 'FAILED',
            error: {
              code: errorCode,
              message: errorMessage,
              category: classification.category,
            },
            durationMs,
            nextStepsScheduled: [],
            retryScheduled: true,
            retryDelaySeconds: delaySeconds,
          });
        }

        // Exhausted attempts OR Non-Transient failure (FATAL / PERMANENT)
        // 1. Route to Dead-Letter Queue (DLQ) (Rule 25 & 48)
        try {
          await dlqService.routeToDlq({
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            workflowId: payload.workflowId,
            stepId: payload.stepId,
            stepIndex: step?.stepIndex ?? 0,
            capabilityId: step?.capabilityId ?? 'unknown',
            attempt: currentAttempt,
            maxAttempts,
            rawError: err,
            stepInput: (step?.input ?? {}) as Record<string, unknown>,
            contextSnapshot: (step?.output ?? {}) as Record<string, unknown>,
            correlationId,
          });
        } catch (dlqErr) {
          console.error('[WorkflowStepRunner] Failed to route to DLQ:', dlqErr);
        }

        // 2. Trigger Saga Compensation if configured (Rule 27)
        try {
          await sagaEngine.rollbackWorkflow({
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            workflowId: payload.workflowId,
            reason: `Step '${payload.stepId}' failed with ${classification.category} error: ${errorMessage}`,
            failedStepId: payload.stepId,
            dryRun: instance?.dryRun ?? false,
            correlationId,
          });
        } catch (sagaErr) {
          console.error('[WorkflowStepRunner] Saga compensation rollback failed or skipped:', sagaErr);
        }

        // 3. Exhausted attempts: Step and Workflow Instance terminal FAILED
        if (step) {
          await store.updateStep(
            payload.workflowId,
            payload.stepId,
            {
              status: 'FAILED',
              error: {
                code: errorCode,
                message: errorMessage,
              },
              durationMs,
            },
            tenant
          );
        }

        const currentInstance = await store.getInstance(payload.workflowId, tenant);
        if (currentInstance?.status !== 'FAILED') {
          await store.updateInstanceStatus(payload.workflowId, 'FAILED', tenant, {
            currentStepId: payload.stepId,
            error: {
              code: errorCode,
              message: errorMessage,
            },
          });
        }

        await eventBus.publish(
          createDomainEvent({
            type: 'workflow.step_failed',
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            entity: { type: 'workflow', id: payload.workflowId },
            actor: { type: 'agent', id: workerId },
            correlationId,
            source: 'workflow_runner',
            payload: {
              stepId: payload.stepId,
              error: { code: errorCode, message: errorMessage },
              durationMs,
            },
          })
        );

        await eventBus.publish(
          createDomainEvent({
            type: 'workflow.failed',
            organizationId: payload.organizationId,
            workspaceId: payload.workspaceId,
            entity: { type: 'workflow', id: payload.workflowId },
            actor: { type: 'system', id: 'workflow_runner' },
            correlationId,
            source: 'workflow_runner',
            payload: {
              workflowId: payload.workflowId,
              failedStepId: payload.stepId,
              error: { code: errorCode, message: errorMessage },
            },
          })
        );

        return StepExecutionResultSchema.parse({
          stepId: payload.stepId,
          status: 'FAILED',
          error: {
            code: errorCode,
            message: errorMessage,
            category: classification.category,
          },
          durationMs,
          nextStepsScheduled: [],
          retryScheduled: false,
        });
      }
    },
  };
}

// ── Global Singleton with HMR Preservation (Rule 69) ────────────────────────
declare global {
  var __smartsappWorkflowStepRunner: WorkflowStepRunner | undefined;
}

export function getWorkflowStepRunner(): WorkflowStepRunner {
  if (process.env.NODE_ENV === 'test') {
    return createWorkflowStepRunner();
  }

  if (!globalThis.__smartsappWorkflowStepRunner) {
    globalThis.__smartsappWorkflowStepRunner = createWorkflowStepRunner();
  }
  return globalThis.__smartsappWorkflowStepRunner;
}
