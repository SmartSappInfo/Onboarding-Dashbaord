/**
 * @fileOverview End-to-End Autonomous Agent Execution Loop Orchestrator (Phase 6 Milestone 4)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy with Zod v4 schemas.
 * - Rule 8 & 47: Multi-Tenancy & Anti-IDOR (`organizationId`, `workspaceId`).
 * - Rule 13 & 30: Formal trust boundaries and XML isolation containers for tool outputs.
 * - Rule 14: Tool Poisoning / Rug-Pull defense via capability fingerprinting.
 * - Rule 16: Agent Identity as Security Principal.
 * - Rule 17 & 21: Two-Phase Action model and Non-Delegable Action approval interception.
 * - Rule 22: Cryptographic SHA-256 Approval Binding (payloadHash validation).
 * - Rule 23 & 54: Multi-Dimensional Resource Governance (pre-reservation & accounting).
 * - Rule 26: Cooperative Cancellation monitoring via native AbortSignal.
 * - Rule 27: Formal Saga Compensation Engine (reverse-LIFO rollback on failure).
 * - Rule 28 & 56: Context Budgeting and extractive knapsack compression.
 * - Rule 31: Output validation between agent and tool.
 * - Rule 40: Audit trail logging and domain event emission.
 * - Rule 41: Full decision provenance: WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE.
 * - Rule 42: Shadow Mode / Dry-Run support.
 * - Rule 47: "Never Trust the Model" — formal 7-stage execution pipeline.
 * - Rule 48: "Never Trust the Tool Either" — sanitized error taxonomy.
 * - Rule 60: Emergency Dead-Man Switch Evaluation at every step.
 * - Rule 68: The Five Non-Negotiable Invariants.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { type AgentRunStore, getAgentRunStore } from '../agent-run-store';
import { type CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';
import { type CapabilityRegistryStore, canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { globalAgentPersonaRegistry, type AgentPersonaRegistry } from '@/platform/identity/agent-registry';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type AgentStep,
  type ExecutionPlan,
} from '../agent-run-types';
import { isTerminalState } from '../agent-state-machine';
import { AgentBudgetManager } from '../governance/agent-budget-manager';
import { CancellationEngine, getCancellationEngine } from '../governance/cancellation-engine';
import { SagaCompensationEngine, getSagaCompensationEngine } from '../governance/saga-compensation';
import { AgentContextCompressor } from '../governance/context-compressor';
import { StepValidator } from './step-validator';
import { StepVerifier } from './step-verifier';
import { ApprovalInterceptor, type ApprovalStore } from './approval-interceptor';
import {
  type ExecutionLoopOptions,
  type AgentExecutionOutcome,
  ExecutionLoopOptionsSchema,
  AgentExecutionOutcomeSchema,
  ExecutionError,
} from './execution-types';

export interface AgentExecutionLoopOptions {
  runStore?: AgentRunStore;
  approvalStore?: ApprovalStore;
  registry?: CapabilityRegistryStore;
  personaRegistry?: AgentPersonaRegistry;
  budgetManager?: AgentBudgetManager;
  cancellationEngine?: CancellationEngine;
  sagaEngine?: SagaCompensationEngine;
  approvalInterceptor?: ApprovalInterceptor;
  eventBus?: EventBus;
}

export class AgentExecutionLoop {
  private readonly runStore: AgentRunStore;
  private readonly registry: CapabilityRegistryStore;
  private readonly personaRegistry: AgentPersonaRegistry;
  private readonly budgetManager: AgentBudgetManager;
  private readonly cancellationEngine: CancellationEngine;
  private readonly sagaEngine: SagaCompensationEngine;
  private readonly approvalInterceptor: ApprovalInterceptor;
  private readonly eventBus: EventBus;

  constructor(options?: AgentExecutionLoopOptions) {
    this.runStore = options?.runStore ?? getAgentRunStore();
    this.registry = options?.registry ?? canonicalCapabilityRegistryStore;
    this.personaRegistry = options?.personaRegistry ?? globalAgentPersonaRegistry;
    this.eventBus = options?.eventBus ?? defaultEventBus;
    this.budgetManager = options?.budgetManager ?? new AgentBudgetManager({ runStore: this.runStore, eventBus: this.eventBus });
    this.cancellationEngine = options?.cancellationEngine ?? getCancellationEngine({ runStore: this.runStore, eventBus: this.eventBus });
    this.sagaEngine = options?.sagaEngine ?? getSagaCompensationEngine({ runStore: this.runStore, capabilityRegistry: this.registry, eventBus: this.eventBus });
    this.approvalInterceptor = options?.approvalInterceptor ?? new ApprovalInterceptor({
      approvalStore: options?.approvalStore,
      runStore: this.runStore,
      eventBus: this.eventBus,
    });
  }

  /**
   * Executes an Agent Run from start to completion or approval pause.
   */
  public async executeRun(params: {
    organizationId: string;
    runId: string;
    options?: Partial<ExecutionLoopOptions>;
  }): Promise<AgentExecutionOutcome> {
    const startTime = Date.now();
    const options = ExecutionLoopOptionsSchema.parse(params.options ?? {});

    // 1. Step 1: Emergency Dead-Man Switch Gate (Rule 60)
    await checkGovernanceDeadManSwitch(params.organizationId);

    // 2. Fetch Run from Store
    const run = await this.runStore.getRun(params.organizationId, params.runId);
    if (!run) {
      throw new ExecutionError({
        code: 'INVALID_EXECUTION_STATE',
        message: `Agent run '${params.runId}' was not found.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    // Guard against re-executing terminal runs
    if (isTerminalState(run.status)) {
      throw new ExecutionError({
        code: 'INVALID_EXECUTION_STATE',
        message: `Cannot execute agent run '${run.runId}' because it is in terminal state '${run.status}'.`,
        runId: run.runId,
        organizationId: run.organizationId,
      });
    }

    // 3. Resolve Persona (Rule 16)
    const persona = this.personaRegistry.getPersona(run.agentPersonaId);
    if (!persona) {
      throw new ExecutionError({
        code: 'INVALID_EXECUTION_STATE',
        message: `Agent persona '${run.agentPersonaId}' is not registered.`,
        runId: run.runId,
        organizationId: run.organizationId,
      });
    }

    // 4. Register Cancellation Token (Rule 26)
    const cancellationToken = this.cancellationEngine.registerRun(run.runId);

    // 5. Ensure legal run state progression
    if (run.status === 'created') {
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'planning',
        reason: 'Initializing plan execution',
      });
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'executing',
        reason: 'Starting step execution loop',
      });
    } else if (run.status === 'planning') {
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'executing',
        reason: 'Starting step execution loop',
      });
    } else if (run.status === 'waiting_for_approval') {
      await this.runStore.updateRunStatus({
        organizationId: run.organizationId,
        runId: run.runId,
        toStatus: 'executing',
        reason: 'Resuming execution following approval decision',
      });
    }

    const currentPlan: ExecutionPlan | undefined = run.currentPlan;
    if (!currentPlan || currentPlan.steps.length === 0) {
      throw new ExecutionError({
        code: 'INVALID_EXECUTION_STATE',
        message: `Cannot execute run '${run.runId}' without a synthesized ExecutionPlan.`,
        runId: run.runId,
        organizationId: run.organizationId,
      });
    }

    let completedStepsCount = 0;
    let failedStepsCount = 0;
    let replanCount = 0;

    // 6. Step Execution Loop
    for (const planStep of currentPlan.steps) {
      // Check cancellation token (Rule 26)
      if (cancellationToken.isCancelled) {
        this.cancellationEngine.unregisterRun(run.runId);
        return {
          runId: run.runId,
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          status: 'cancelled',
          totalStepsExecuted: completedStepsCount + failedStepsCount,
          completedStepsCount,
          failedStepsCount,
          summary: 'Execution aborted by cancellation token.',
          dryRun: options.dryRun,
          error: cancellationToken.reason?.reason ?? 'Cancelled',
          replanCount,
          durationMs: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      // Re-verify Dead-Man Switch before each step (Rule 60)
      await checkGovernanceDeadManSwitch(run.organizationId);

      // Check if step was already executed in a previous pass (e.g. resumption after approval)
      const existingStep = await this.runStore.getStep(run.organizationId, run.runId, planStep.stepId);
      if (existingStep && existingStep.status === 'completed') {
        completedStepsCount++;
        continue;
      }

      // Compress context for step prompt token budgeting (Rules 28 & 56)
      const priorSteps = await this.runStore.listSteps(run.organizationId, run.runId);
      const compressedCtx = AgentContextCompressor.compress({
        goalPrompt: run.goal.prompt,
        steps: priorSteps,
      });

      const stepStart = Date.now();
      const idempotencyKey = `idemp_${run.runId}_${planStep.stepId}`;
      const correlationId = options.correlationId ?? `corr_${run.runId}_${planStep.stepId}`;

      // Create or update step to 'running'
      let activeStep: AgentStep;
      if (!existingStep) {
        activeStep = await this.runStore.createStep(run.organizationId, run.runId, {
          stepId: planStep.stepId,
          runId: run.runId,
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          stepIndex: planStep.stepIndex,
          type: planStep.type,
          title: planStep.title,
          capabilityId: planStep.capabilityId,
          capabilityVersion: planStep.capabilityVersion,
          idempotencyKey,
          correlationId,
          input: planStep.arguments ?? {},
          compensatingCapabilityId: planStep.compensatingCapabilityId,
        });
      } else {
        activeStep = await this.runStore.updateStep({
          organizationId: run.organizationId,
          runId: run.runId,
          stepId: planStep.stepId,
          status: 'running',
        });
      }

      // Pre-execution Budget Reservation Check (Rule 23)
      await this.budgetManager.checkOrThrow({
        organizationId: run.organizationId,
        runId: run.runId,
        toolCalls: 1,
        estimatedTokens: 200,
        estimatedDurationMs: planStep.timeoutMs ?? 30000,
      });

      // Two-Phase Human Approval Gate (Rules 17, 21, 22)
      const approvalCheck = await this.approvalInterceptor.evaluateStepApproval({
        run,
        planStep,
        persona,
        existingProposalId: existingStep?.actionProposalId,
      });

      if (approvalCheck.requiresApproval && approvalCheck.actionProposalId) {
        // Record proposal on the step
        await this.runStore.updateStep({
          organizationId: run.organizationId,
          runId: run.runId,
          stepId: planStep.stepId,
          status: 'pending',
          actionProposalId: approvalCheck.actionProposalId,
          payloadHash: approvalCheck.payloadHash,
        });

        // Pause execution and return outcome in waiting_for_approval
        this.cancellationEngine.unregisterRun(run.runId);
        return {
          runId: run.runId,
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          status: 'waiting_for_approval',
          totalStepsExecuted: completedStepsCount,
          completedStepsCount,
          failedStepsCount,
          approvalPausedStepId: planStep.stepId,
          actionProposalId: approvalCheck.actionProposalId,
          summary: `Run paused at step '${planStep.title}' awaiting human operator approval.`,
          dryRun: options.dryRun,
          replanCount,
          durationMs: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      // If step previously had an approval proposal and is now approved, verify hash binding (Rule 22)
      if (approvalCheck.actionProposalId) {
        await this.approvalInterceptor.verifyApprovalBinding({
          organizationId: run.organizationId,
          proposalId: approvalCheck.actionProposalId,
          currentPayload: planStep.arguments ?? {},
        });
      }

      // Capability Dispatch
      let rawResult: unknown;
      let stepExecutionError: unknown;

      try {
        const capability = planStep.capabilityId ? this.registry.get(planStep.capabilityId) : undefined;
        if (!capability) {
          throw new ExecutionError({
            code: 'CAPABILITY_NOT_FOUND',
            message: `Capability '${planStep.capabilityId}' not found in registry.`,
            runId: run.runId,
            stepId: planStep.stepId,
            organizationId: run.organizationId,
          });
        }

        const executionCtx: CapabilityExecutionContext = {
          principal: {
            actorType: 'agent',
            userId: run.authorizingUserId,
            organizationId: run.organizationId,
            workspaceId: run.workspaceId,
            agentId: run.principalId,
            runId: run.runId,
            grantedScopes: persona.allowedDomains.map((d) => `${d}:*`),
            effectiveRole: persona.role,
          },
          correlationId,
          idempotencyKey,
          dryRun: options.dryRun,
          timestamp: new Date().toISOString(),
        };

        const executionRes = await capability.handler(planStep.arguments ?? {}, executionCtx);

        if (!executionRes.success) {
          throw new ExecutionError({
            code: 'TOOL_EXECUTION_FAILED',
            message: executionRes.error.message,
            runId: run.runId,
            stepId: planStep.stepId,
            capabilityId: planStep.capabilityId,
            organizationId: run.organizationId,
            details:
              typeof executionRes.error.details === 'object' && executionRes.error.details !== null
                ? (executionRes.error.details as Record<string, unknown>)
                : undefined,
          });
        }

        rawResult = executionRes.data;
      } catch (err: unknown) {
        stepExecutionError = err;
      }

      // Output Validation & Containerization (Rules 13, 30, 31, 48)
      if (stepExecutionError) {
        failedStepsCount++;
        const sanitizedErr = StepValidator.sanitizeError(stepExecutionError, planStep.stepId);

        await this.runStore.updateStep({
          organizationId: run.organizationId,
          runId: run.runId,
          stepId: planStep.stepId,
          status: 'failed',
          sanitizedError: sanitizedErr,
          durationMs: Date.now() - stepStart,
        });

        // Trigger Saga Rollback on unrecoverable failure (Rule 27)
        if (options.autoTriggerSagaRollbackOnFailure) {
          await this.sagaEngine.rollbackRun({
            organizationId: run.organizationId,
            runId: run.runId,
            reason: sanitizedErr.message,
            correlationId,
          });
        }

        await this.runStore.updateRunStatus({
          organizationId: run.organizationId,
          runId: run.runId,
          toStatus: 'failed',
          reason: sanitizedErr.message,
          error: sanitizedErr,
        });

        this.cancellationEngine.unregisterRun(run.runId);

        return {
          runId: run.runId,
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          status: 'failed',
          totalStepsExecuted: completedStepsCount + failedStepsCount,
          completedStepsCount,
          failedStepsCount,
          summary: `Run failed on step '${planStep.title}': ${sanitizedErr.message}`,
          dryRun: options.dryRun,
          error: sanitizedErr.message,
          replanCount,
          durationMs: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      const capability = planStep.capabilityId ? this.registry.get(planStep.capabilityId) : undefined;
      const validation = StepValidator.validateOutput({
        stepId: planStep.stepId,
        capabilityId: planStep.capabilityId ?? 'unspecified',
        outputSchema: capability?.outputSchema,
        rawOutput: rawResult,
      });

      if (!validation.valid) {
        failedStepsCount++;
        await this.runStore.updateStep({
          organizationId: run.organizationId,
          runId: run.runId,
          stepId: planStep.stepId,
          status: 'failed',
          sanitizedError: validation.sanitizedError,
          outputValidationErrors: validation.validationErrors,
          durationMs: Date.now() - stepStart,
        });

        if (options.autoTriggerSagaRollbackOnFailure) {
          await this.sagaEngine.rollbackRun({
            organizationId: run.organizationId,
            runId: run.runId,
            reason: validation.sanitizedError?.message ?? 'Schema validation failed',
            correlationId,
          });
        }

        await this.runStore.updateRunStatus({
          organizationId: run.organizationId,
          runId: run.runId,
          toStatus: 'failed',
          reason: validation.sanitizedError?.message ?? 'Step validation failed',
          error: validation.sanitizedError,
        });

        this.cancellationEngine.unregisterRun(run.runId);

        return {
          runId: run.runId,
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          status: 'failed',
          totalStepsExecuted: completedStepsCount + failedStepsCount,
          completedStepsCount,
          failedStepsCount,
          summary: `Step validation failed on '${planStep.title}'.`,
          dryRun: options.dryRun,
          error: validation.sanitizedError?.message,
          replanCount,
          durationMs: Date.now() - startTime,
          tokensUsed: validation.tokensUsed,
        };
      }

      // Post-Condition Verification Gate (Rule 47 & Step 9 Lifecycle)
      if (options.verifyPostConditions) {
        const verification = await StepVerifier.verifyStep({
          step: activeStep,
          planStep,
          executionOutput: validation.validatedOutput,
        });

        if (!verification.verified) {
          failedStepsCount++;
          const sanitizedErr = {
            code: 'VERIFICATION_FAILED',
            message: verification.rejectionReason ?? 'Post-condition verification failed',
          };

          await this.runStore.updateStep({
            organizationId: run.organizationId,
            runId: run.runId,
            stepId: planStep.stepId,
            status: 'failed',
            sanitizedError: sanitizedErr,
            durationMs: Date.now() - stepStart,
          });

          if (options.autoTriggerSagaRollbackOnFailure) {
            await this.sagaEngine.rollbackRun({
              organizationId: run.organizationId,
              runId: run.runId,
              reason: sanitizedErr.message,
              correlationId,
            });
          }

          await this.runStore.updateRunStatus({
            organizationId: run.organizationId,
            runId: run.runId,
            toStatus: 'failed',
            reason: sanitizedErr.message,
            error: sanitizedErr,
          });

          this.cancellationEngine.unregisterRun(run.runId);

          return {
            runId: run.runId,
            organizationId: run.organizationId,
            workspaceId: run.workspaceId,
            status: 'failed',
            totalStepsExecuted: completedStepsCount + failedStepsCount,
            completedStepsCount,
            failedStepsCount,
            summary: `Post-condition verification failed on '${planStep.title}': ${sanitizedErr.message}`,
            dryRun: options.dryRun,
            error: sanitizedErr.message,
            replanCount,
            durationMs: Date.now() - startTime,
            tokensUsed: validation.tokensUsed,
          };
        }
      }

      // Record Budget Usage Delta (Rule 23)
      const durationMs = Date.now() - stepStart;
      await this.budgetManager.recordUsage({
        organizationId: run.organizationId,
        runId: run.runId,
        delta: {
          tokensUsed: validation.tokensUsed,
          toolCallsExecuted: 1,
          durationMs,
          recordsMutated: 1,
          financialAmount: 0,
        },
        dryRun: options.dryRun,
      });

      // Update step status to 'completed'
      await this.runStore.updateStep({
        organizationId: run.organizationId,
        runId: run.runId,
        stepId: planStep.stepId,
        status: 'completed',
        output: validation.validatedOutput,
        outputValidated: true,
        tokensUsed: validation.tokensUsed,
        contextTokenUsage: compressedCtx.totalTokens,
        durationMs,
        completedAt: new Date().toISOString(),
      });

      completedStepsCount++;

      // Publish step completed domain event (Rule 40)
      await this.eventBus.publish(
        createDomainEvent({
          type: 'agent.run.step_completed',
          source: 'agent-execution-loop',
          organizationId: run.organizationId,
          workspaceId: run.workspaceId,
          actor: { type: 'agent', id: run.principalId },
          entity: { type: 'agent_step', id: planStep.stepId },
          correlationId,
          payload: {
            runId: run.runId,
            stepId: planStep.stepId,
            capabilityId: planStep.capabilityId,
            durationMs,
            tokensUsed: validation.tokensUsed,
          },
        })
      );
    }

    // 7. Complete Run
    await this.runStore.updateRunStatus({
      organizationId: run.organizationId,
      runId: run.runId,
      toStatus: 'completed',
      reason: 'All execution plan steps completed successfully.',
    });

    this.cancellationEngine.unregisterRun(run.runId);

    // Publish run completed event (Rule 40)
    await this.eventBus.publish(
      createDomainEvent({
        type: 'agent.run.completed',
        source: 'agent-execution-loop',
        organizationId: run.organizationId,
        workspaceId: run.workspaceId,
        actor: { type: 'agent', id: run.principalId },
        entity: { type: 'agent_run', id: run.runId },
        correlationId: `corr_${run.runId}`,
        payload: {
          runId: run.runId,
          totalSteps: currentPlan.steps.length,
          completedStepsCount,
          durationMs: Date.now() - startTime,
        },
      })
    );

    const outcome: AgentExecutionOutcome = {
      runId: run.runId,
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      status: 'completed',
      totalStepsExecuted: completedStepsCount,
      completedStepsCount,
      failedStepsCount: 0,
      summary: `All ${completedStepsCount} step(s) in plan '${currentPlan.planId}' completed successfully.`,
      dryRun: options.dryRun,
      replanCount,
      durationMs: Date.now() - startTime,
      tokensUsed: 0,
    };

    return AgentExecutionOutcomeSchema.parse(outcome);
  }
}
