/**
 * @fileOverview Formal Saga & Compensation Engine (Phase 6 Milestone 3)
 *
 * Implements strict LIFO (reverse execution) compensating capability workflows for
 * multi-step agent runs when partial failures, operator cancellations, or policy
 * violations occur.
 *
 * Rules:
 * - Rule 19: Deterministic idempotency keys for compensation steps ('saga_comp_${stepId}')
 * - Rule 20: Audit trail logging and domain event emission
 * - Rule 25: Failure modes and operator intervention escalation
 * - Rule 27: Compensating capabilities registered and bound to mutating steps
 * - Rule 40: Domain events emitted on compensation success/failure
 * - Rule 42: Shadow simulation & dry-run support
 * - Rule 60: Emergency dead-man switch enforcement
 * - Rule 63: Human-in-the-loop operator intervention flags on partial compensation failures
 *
 * AUTHORITY (Phase 11 M2 review R2; Rules 16, 17): compensation runs through the gateway AS THE RUN'S
 * OWN DELEGATED AGENT: the run's authorizing user, its agent id and workspace, and the persona's
 * permissions (the same scopes an agent session gets). It never invents authority (no 'admin' role,
 * no capability id as a scope, no wildcard). No run, an unknown persona or a rollback request for
 * another workspace → the step fails closed and an operator is asked to step in.
 * The input is exactly the compensation arguments; context travels separately.
 */

import { invokeGoverned } from '@/platform/capabilities/execution/invoke-governed';
import {
  type AgentRunStore,
  getAgentRunStore,
} from '@/platform/runtime/agent-run-store';
import {
  type CapabilityRegistryStore,
  canonicalCapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import {
  type EventBus,
  defaultEventBus,
} from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import type { AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import type { AgentRun } from '@/platform/runtime/agent-run-types';
import {
  GovernanceError,
  type CompensationStep,
  type SagaExecutionResult,
  SagaExecutionResultSchema,
} from './governance-types';

export interface SagaCompensationEngineOptions {
  runStore?: AgentRunStore;
  capabilityRegistry?: CapabilityRegistryStore;
  eventBus?: EventBus;
}

export interface RollbackRunInput {
  organizationId: string;
  workspaceId?: string;
  runId: string;
  reason: string;
  dryRun?: boolean;
  correlationId?: string;
}

/** The run's delegated agent principal, or why it can't be resolved (fail closed). */
export function resolveCompensationPrincipal(
  run: AgentRun | null | undefined,
  input: { organizationId: string; workspaceId?: string }
): { principal: AgentPrincipal } | { error: string } {
  if (!run) return { error: 'The run was not found, so the authority to undo its steps cannot be confirmed.' };
  if (run.organizationId !== input.organizationId) return { error: 'The run belongs to another organization.' };
  if (input.workspaceId && input.workspaceId !== run.workspaceId) return { error: 'The rollback request names a different workspace than the run.' };
  const persona = globalAgentPersonaRegistry.getPersona(run.agentPersonaId);
  if (!persona) return { error: `Unknown agent persona '${run.agentPersonaId}'.` };
  const grantedScopes = persona.allowedPermissions.filter((scope) => !scope.includes('*'));
  return {
    principal: {
      actorType: 'agent',
      userId: run.authorizingUserId,
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      agentId: run.principalId,
      runId: run.runId,
      grantedScopes,
      effectiveRole: persona.role,
    },
  };
}

export class SagaCompensationEngine {
  private readonly runStore: AgentRunStore;
  private readonly capabilityRegistry: CapabilityRegistryStore;
  private readonly eventBus: EventBus;

  constructor(options: SagaCompensationEngineOptions = {}) {
    this.runStore = options.runStore || getAgentRunStore();
    this.capabilityRegistry =
      options.capabilityRegistry || canonicalCapabilityRegistryStore;
    this.eventBus = options.eventBus || defaultEventBus;
  }

  /**
   * Rollback an Agent Run's executed steps in strict LIFO (reverse execution) order.
   *
   * 1. Evaluates emergency dead-man switch (Rule 60)
   * 2. Retrieves all executed steps with compensating capability IDs
   * 3. Sorts in descending order of stepIndex (strict LIFO)
   * 4. For each step, constructs deterministic idempotency key 'saga_comp_${stepId}' (Rule 19)
   * 5. In live mode: executes compensating capability handler and updates step compensationStatus
   * 6. In dryRun mode: simulates compensation without mutating real state (Rule 42)
   * 7. If any compensation step fails: flags requiresOperatorIntervention: true (Rule 25 & 63)
   * 8. Publishes domain events to the audit trail (Rule 40)
   */
  public async rollbackRun(input: RollbackRunInput): Promise<SagaExecutionResult> {
    // 1. Emergency Dead-Man Switch Gate (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(input.organizationId);
    } catch (e) {
      if (e instanceof GovernanceError) throw e;
      throw new GovernanceError({
        code: 'DEAD_MAN_PAUSED',
        message: `Saga compensation halted: Emergency dead-man switch is active for tenant '${input.organizationId}'.`,
        runId: input.runId,
        organizationId: input.organizationId,
      });
    }

    const run = await this.runStore.getRun(input.organizationId, input.runId);
    const authority = resolveCompensationPrincipal(run, input);

    // 2. Retrieve all steps for this run
    const steps = await this.runStore.listSteps(input.organizationId, input.runId);

    // 3. Filter steps requiring compensation
    const stepsToCompensate = steps
      .filter(
        (step) =>
          Boolean(step.compensatingCapabilityId) &&
          step.status === 'completed' &&
          step.compensationStatus !== 'completed'
      )
      // Strict LIFO: highest stepIndex first
      .sort((a, b) => b.stepIndex - a.stepIndex);

    if (stepsToCompensate.length === 0) {
      return SagaExecutionResultSchema.parse({
        success: true,
        totalCompensations: 0,
        completedCompensations: 0,
        failedCompensations: 0,
        compensationSteps: [],
        compensatedAt: new Date().toISOString(),
        dryRun: Boolean(input.dryRun),
        requiresOperatorIntervention: false,
      });
    }

    const compensationSteps: CompensationStep[] = [];
    let completedCount = 0;
    let failedCount = 0;

    for (const step of stepsToCompensate) {
      const stepId = step.stepId;
      const compCapId = step.compensatingCapabilityId!;
      const idempotencyKey = `saga_comp_${stepId}`;

      const stepInputObj =
        typeof step.input === 'object' && step.input !== null
          ? (step.input as Record<string, unknown>)
          : {};
      const stepOutputObj =
        typeof step.output === 'object' && step.output !== null
          ? (step.output as Record<string, unknown>)
          : {};

      // Merge inputs & outputs (outputs have precedence for IDs created in forward step)
      const compArgs: Record<string, unknown> = {
        ...stepInputObj,
        ...stepOutputObj,
      };

      const compStep: CompensationStep = {
        stepId,
        capabilityId: step.capabilityId || 'unknown',
        compensatingCapabilityId: compCapId,
        idempotencyKey,
        compensationArguments: compArgs,
        status: 'pending',
      };

      // Dry-run mode: do not invoke live mutating handlers (Rule 42)
      if (input.dryRun) {
        compStep.status = 'completed';
        compStep.completedAt = new Date().toISOString();
        compStep.durationMs = 0;
        completedCount++;
        compensationSteps.push(compStep);
        continue;
      }

      // Check if compensating capability exists in registry, and that the run's authority resolves.
      const capability = this.capabilityRegistry.get(compCapId);
      if (!capability || 'error' in authority) {
        compStep.status = 'failed';
        compStep.error = !capability
          ? `Compensating capability '${compCapId}' is not registered in capability registry.`
          : 'error' in authority ? authority.error : 'Authority could not be resolved.';
        failedCount++;
        compensationSteps.push(compStep);

        await this.runStore.updateStep({
          organizationId: input.organizationId,
          runId: input.runId,
          stepId,
          status: step.status,
          compensationStatus: 'failed',
          sanitizedError: {
            code: 'COMPENSATION_FAILED',
            message: compStep.error,
          },
        });
        continue;
      }

      const startTime = Date.now();
      compStep.status = 'running';

      try {
        // CAUTION (Phase 11 M0 · T3 + M2 review R2): executes through the governed gateway as the run's
        // delegated agent; never capability.handler(), never invented authority.
        const compensation = await invokeGoverned({
          capability,
          capabilityId: capability.id,
          surface: 'task_worker',
          input: compArgs,
          principal: authority.principal,
          correlationId: input.correlationId || step.correlationId || `corr_${input.runId}`,
          causationId: step.stepId,
          idempotencyKey,
        });
        if (!compensation.success) {
          throw new Error(`Compensation refused (${compensation.error.code}): ${compensation.error.message}`);
        }

        compStep.status = 'completed';
        compStep.completedAt = new Date().toISOString();
        compStep.durationMs = Date.now() - startTime;
        completedCount++;

        await this.runStore.updateStep({
          organizationId: input.organizationId,
          runId: input.runId,
          stepId,
          status: step.status,
          compensationStatus: 'completed',
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        compStep.status = 'failed';
        compStep.error = errorMessage;
        compStep.durationMs = Date.now() - startTime;
        failedCount++;

        await this.runStore.updateStep({
          organizationId: input.organizationId,
          runId: input.runId,
          stepId,
          status: step.status,
          compensationStatus: 'failed',
          sanitizedError: {
            code: 'COMPENSATION_FAILED',
            message: errorMessage,
          },
        });
      }

      compensationSteps.push(compStep);
    }

    const isSuccess = failedCount === 0;
    const requiresOperatorIntervention = failedCount > 0;

    const result: SagaExecutionResult = {
      success: isSuccess,
      totalCompensations: stepsToCompensate.length,
      completedCompensations: completedCount,
      failedCompensations: failedCount,
      compensationSteps,
      compensatedAt: new Date().toISOString(),
      dryRun: Boolean(input.dryRun),
      requiresOperatorIntervention,
      error: !isSuccess
        ? `Saga rollback completed with ${failedCount} failed compensation step(s). Operator intervention required.`
        : undefined,
    };

    // Emit domain events for live runs (Rule 40)
    if (!input.dryRun) {
      await this.eventBus.publish(
        createDomainEvent({
          type: isSuccess ? 'agent.run.compensated' : 'agent.run.compensation_failed',
          source: 'agent-saga-engine',
          organizationId: input.organizationId,
          workspaceId: run?.workspaceId ?? input.workspaceId,
          actor: { type: 'agent', id: run?.principalId || 'saga_engine' },
          entity: { type: 'agent_run', id: input.runId },
          correlationId: input.correlationId || `corr_${input.runId}`,
          payload: {
            runId: input.runId,
            success: isSuccess,
            reason: input.reason,
            totalCompensations: result.totalCompensations,
            completedCompensations: result.completedCompensations,
            failedCompensations: result.failedCompensations,
            requiresOperatorIntervention,
          },
        })
      );
    }

    return SagaExecutionResultSchema.parse(result);
  }
}

declare global {
  var __smartsappSagaEngine: SagaCompensationEngine | undefined;
}

export function getSagaCompensationEngine(
  options?: SagaCompensationEngineOptions
): SagaCompensationEngine {
  if (process.env.NODE_ENV === 'test') {
    return new SagaCompensationEngine(options);
  }
  if (!globalThis.__smartsappSagaEngine) {
    globalThis.__smartsappSagaEngine = new SagaCompensationEngine(options);
  }
  return globalThis.__smartsappSagaEngine;
}
