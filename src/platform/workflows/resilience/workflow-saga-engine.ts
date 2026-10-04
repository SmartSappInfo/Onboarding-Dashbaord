/**
 * @fileOverview Distributed Workflow Saga Compensation Engine (Phase 7 Milestone 4)
 *
 * Implements strict LIFO (reverse execution) compensating capability workflows for
 * multi-step distributed workflows when partial failures, retry exhaustion, operator cancellations,
 * or policy violations occur.
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout with Zod v4 and typed errors.
 * 2. DETERMINISTIC IDEMPOTENCY (Rule 19): Idempotency keys follow 'saga_comp_${workflowId}_${stepId}'.
 * 3. REVERSE-LIFO ORDER (Rule 27): Compensating capabilities execute in strict descending stepIndex order.
 * 4. DRY-RUN SIMULATION (Rule 42): Supports shadow simulation with zero mutating side effects.
 * 5. EMERGENCY DEAD-MAN SWITCH (Rule 60): Evaluates dead-man switch before initiating saga rollbacks.
 * 6. OPERATOR INTERVENTION ESCALATION (Rule 25 & 63): Partial compensation failure flags
 *    requiresOperatorIntervention: true and emits alert domain events.
 * 7. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowSagaEngine.
 */

import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type CapabilityRegistryStore,
  canonicalCapabilityRegistryStore,
  getCapability,
} from '@/platform/capabilities/registry/capability-registry';
import type {
  AgentPrincipal,
  CapabilityExecutionContext,
} from '@/platform/capabilities/contracts/capability-definition';
import type { TenantBoundary, WorkflowStep } from '../workflow-types';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import {
  type RollbackWorkflowInput,
  type WorkflowSagaResult,
  type WorkflowSagaStep,
  WorkflowSagaResultSchema,
  WorkflowResilienceError,
} from './workflow-resilience-types';

export interface WorkflowSagaEngineOptions {
  store?: WorkflowStore;
  capabilityRegistry?: CapabilityRegistryStore;
  eventBus?: EventBus;
}

export class WorkflowSagaEngine {
  private readonly store: WorkflowStore;
  private readonly capabilityRegistry: CapabilityRegistryStore;
  private readonly eventBus: EventBus;

  constructor(options: WorkflowSagaEngineOptions = {}) {
    this.store = options.store || getWorkflowStore();
    this.capabilityRegistry =
      options.capabilityRegistry || canonicalCapabilityRegistryStore;
    this.eventBus = options.eventBus || defaultEventBus;
  }

  /**
   * Rollback a workflow's completed steps in strict LIFO (reverse execution) order.
   *
   * 1. Evaluates emergency dead-man switch (Rule 60)
   * 2. Asserts tenant perimeter and fetches workflow instance (Rule 8 & 47)
   * 3. Retrieves all completed steps requiring compensation
   * 4. Sorts steps in descending stepIndex order (strict LIFO, Rule 27)
   * 5. For each step:
   *    a. Formulates deterministic idempotency key 'saga_comp_${workflowId}_${stepId}' (Rule 19)
   *    b. Merges forward step input and output for compensating context
   *    c. In dryRun mode: simulates execution without side effects (Rule 42)
   *    d. In live mode: invokes compensating capability with AgentPrincipal context
   * 6. Updates step compensationStatus in store
   * 7. If any step fails: flags requiresOperatorIntervention: true (Rule 25 & 63)
   * 8. Emits audit domain events to the EventBus (Rule 40)
   */
  public async rollbackWorkflow(
    input: RollbackWorkflowInput
  ): Promise<WorkflowSagaResult> {
    const tenant: TenantBoundary = {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    };

    // 1. Emergency Dead-Man Switch Gate (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch (e: unknown) {
      if (e instanceof WorkflowResilienceError) throw e;
      throw new WorkflowResilienceError(
        'DEAD_MAN_PAUSED',
        `Saga compensation halted: Emergency dead-man switch is active for tenant '${input.organizationId}'.`,
        { organizationId: input.organizationId, workflowId: input.workflowId }
      );
    }

    // 2. Fetch workflow instance & verify tenant boundary
    const instance = await this.store.getInstance(input.workflowId, tenant);
    if (!instance) {
      throw new WorkflowResilienceError(
        'WORKFLOW_NOT_FOUND',
        `Workflow instance '${input.workflowId}' not found for tenant '${input.organizationId}'`,
        { workflowId: input.workflowId, organizationId: input.organizationId }
      );
    }

    // 3. Retrieve all steps for this workflow
    const steps = await this.store.listSteps(input.workflowId, tenant);

    // 4. Filter completed steps with compensating capabilities (Rule 27)
    const stepsToCompensate: WorkflowStep[] = steps
      .filter(
        (step) =>
          Boolean(step.compensatingCapabilityId) &&
          step.status === 'COMPLETED' &&
          step.compensationStatus !== 'completed'
      )
      // Strict LIFO: highest stepIndex first
      .sort((a, b) => b.stepIndex - a.stepIndex);

    const isDryRun = Boolean(input.dryRun);

    if (stepsToCompensate.length === 0) {
      return WorkflowSagaResultSchema.parse({
        workflowId: input.workflowId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        success: true,
        totalStepsToCompensate: 0,
        compensatedStepsCount: 0,
        failedStepsCount: 0,
        requiresOperatorIntervention: false,
        dryRun: isDryRun,
        steps: [],
        completedAt: new Date().toISOString(),
      });
    }

    const sagaSteps: WorkflowSagaStep[] = [];
    let completedCount = 0;
    let failedCount = 0;
    let firstErrorMessage: string | undefined;

    for (const step of stepsToCompensate) {
      const compCapId = step.compensatingCapabilityId!;
      const idempotencyKey = `saga_comp_${input.workflowId}_${step.id}`;

      // Formulate compensating payload by merging input and output
      const stepInputObj =
        typeof step.input === 'object' && step.input !== null
          ? (step.input as Record<string, unknown>)
          : {};
      const stepOutputObj =
        typeof step.output === 'object' && step.output !== null
          ? (step.output as Record<string, unknown>)
          : {};

      const compArgs: Record<string, unknown> = {
        ...stepInputObj,
        ...stepOutputObj,
      };

      if (isDryRun) {
        // Shadow simulation mode (Rule 42)
        sagaSteps.push({
          stepId: step.id,
          stepIndex: step.stepIndex,
          capabilityId: step.capabilityId,
          compensatingCapabilityId: compCapId,
          status: 'compensated',
          idempotencyKey,
          durationMs: 0,
          executedAt: new Date().toISOString(),
        });
        completedCount++;
        continue;
      }

      // Live compensation execution
      const startTime = Date.now();
      await this.store.updateStep(
        input.workflowId,
        step.id,
        { compensationStatus: 'pending' },
        tenant
      );

      const capability =
        this.capabilityRegistry.get(compCapId) ??
        getCapability(compCapId);

      if (!capability) {
        const errorMsg = `Compensating capability '${compCapId}' not found in registry`;
        await this.store.updateStep(
          input.workflowId,
          step.id,
          { compensationStatus: 'failed' },
          tenant
        );
        sagaSteps.push({
          stepId: step.id,
          stepIndex: step.stepIndex,
          capabilityId: step.capabilityId,
          compensatingCapabilityId: compCapId,
          status: 'failed',
          idempotencyKey,
          durationMs: Date.now() - startTime,
          error: errorMsg,
          executedAt: new Date().toISOString(),
        });
        failedCount++;
        if (!firstErrorMessage) firstErrorMessage = errorMsg;
        continue;
      }

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

      const ctx: CapabilityExecutionContext = {
        principal,
        correlationId: input.correlationId || input.workflowId,
        causationId: step.id,
        idempotencyKey,
        dryRun: false,
        timestamp: new Date().toISOString(),
      };

      try {
        const executionResult = await capability.handler(compArgs, ctx);
        const durationMs = Date.now() - startTime;

        if (executionResult.success) {
          await this.store.updateStep(
            input.workflowId,
            step.id,
            { compensationStatus: 'completed' },
            tenant
          );
          sagaSteps.push({
            stepId: step.id,
            stepIndex: step.stepIndex,
            capabilityId: step.capabilityId,
            compensatingCapabilityId: compCapId,
            status: 'compensated',
            idempotencyKey,
            durationMs,
            executedAt: new Date().toISOString(),
          });
          completedCount++;
        } else {
          const errMsg = executionResult.error?.message || 'Compensation capability returned failure';
          await this.store.updateStep(
            input.workflowId,
            step.id,
            { compensationStatus: 'failed' },
            tenant
          );
          sagaSteps.push({
            stepId: step.id,
            stepIndex: step.stepIndex,
            capabilityId: step.capabilityId,
            compensatingCapabilityId: compCapId,
            status: 'failed',
            idempotencyKey,
            durationMs,
            error: errMsg,
            executedAt: new Date().toISOString(),
          });
          failedCount++;
          if (!firstErrorMessage) firstErrorMessage = errMsg;
        }
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        await this.store.updateStep(
          input.workflowId,
          step.id,
          { compensationStatus: 'failed' },
          tenant
        );
        sagaSteps.push({
          stepId: step.id,
          stepIndex: step.stepIndex,
          capabilityId: step.capabilityId,
          compensatingCapabilityId: compCapId,
          status: 'failed',
          idempotencyKey,
          durationMs,
          error: errMsg,
          executedAt: new Date().toISOString(),
        });
        failedCount++;
        if (!firstErrorMessage) firstErrorMessage = errMsg;
      }
    }

    const isSuccess = failedCount === 0;
    const requiresOperatorIntervention = failedCount > 0;

    // Publish domain event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: isSuccess ? 'workflow.saga_completed' : 'workflow.saga_failed',
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        entity: { type: 'workflow', id: input.workflowId },
        actor: { type: 'system', id: 'workflow_saga_engine' },
        correlationId: input.correlationId || input.workflowId,
        source: 'workflow_saga_engine',
        payload: {
          workflowId: input.workflowId,
          totalStepsToCompensate: stepsToCompensate.length,
          completedCount,
          failedCount,
          requiresOperatorIntervention,
          reason: input.reason,
          dryRun: isDryRun,
          error: firstErrorMessage,
        },
      })
    );

    return WorkflowSagaResultSchema.parse({
      workflowId: input.workflowId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      success: isSuccess,
      totalStepsToCompensate: stepsToCompensate.length,
      compensatedStepsCount: completedCount,
      failedStepsCount: failedCount,
      requiresOperatorIntervention,
      dryRun: isDryRun,
      steps: sagaSteps,
      completedAt: new Date().toISOString(),
      errorMessage: firstErrorMessage,
    });
  }
}

// ── Global Singleton with HMR Preservation (Rule 69) ─────────────────────────

declare global {
  var __smartsappWorkflowSagaEngine: WorkflowSagaEngine | undefined;
}

export function getWorkflowSagaEngine(): WorkflowSagaEngine {
  if (!globalThis.__smartsappWorkflowSagaEngine) {
    globalThis.__smartsappWorkflowSagaEngine = new WorkflowSagaEngine();
  }
  return globalThis.__smartsappWorkflowSagaEngine;
}
