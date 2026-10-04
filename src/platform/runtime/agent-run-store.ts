/**
 * @fileOverview Multi-Tenant Agent Run Store Interface & Implementations (Phase 6 Milestone 1)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy with Zod v4 schemas.
 * - Rule 8 & 47: Anti-IDOR & Multi-Tenancy (`organizationId` & `workspaceId`).
 * - Rule 9: High load protection via step subcollections `/agent_runs/{runId}/steps/{stepId}`
 *   preventing parent runs from exceeding the Firestore 1MB document limit.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 18 & 19: Concurrency safety, transactional status progression, and idempotency tracking.
 * - Rule 23 & 54: In-flight budget tracking with hard ceiling enforcement throwing `BUDGET_EXCEEDED`.
 * - Rule 26: Cooperative cancellation recording.
 * - Rule 40: State history progression and audit trail.
 * - Rule 69: HMR-safe singleton preservation via `globalThis.__smartsappAgentRunStore`.
 */

import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import {
  type AgentRun,
  type AgentStep,
  type ExecutionPlan,
  type AgentOutcome,
  type AgentRunBudgetUsage,
  type CreateAgentRunInput,
  type UpdateAgentRunStatusInput,
  type CreateStepInput,
  type UpdateStepInput,
  type ListAgentRunsOptions,
  AgentRunSchema,
  AgentStepSchema,
  CreateAgentRunInputSchema,
  UpdateAgentRunStatusInputSchema,
  CreateStepInputSchema,
  UpdateStepInputSchema,
  ListAgentRunsOptionsSchema,
  AgentRuntimeError,
  AgentRunBudgetsSchema,
} from './agent-run-types';
import {
  assertValidStateTransition,
  createStateHistoryEntry,
  isTerminalState,
} from './agent-state-machine';

export interface AgentRunStore {
  createRun(input: CreateAgentRunInput): Promise<AgentRun>;
  getRun(organizationId: string, runId: string): Promise<AgentRun | null>;
  listRuns(organizationId: string, options?: ListAgentRunsOptions): Promise<{ runs: AgentRun[]; total: number }>;
  updateRunStatus(input: UpdateAgentRunStatusInput): Promise<AgentRun>;
  saveExecutionPlan(organizationId: string, runId: string, plan: ExecutionPlan): Promise<AgentRun>;
  createStep(organizationId: string, runId: string, step: CreateStepInput): Promise<AgentStep>;
  getStep(organizationId: string, runId: string, stepId: string): Promise<AgentStep | null>;
  listSteps(organizationId: string, runId: string): Promise<AgentStep[]>;
  updateStep(input: UpdateStepInput): Promise<AgentStep>;
  updateBudgetUsage(organizationId: string, runId: string, delta: Partial<AgentRunBudgetUsage>): Promise<AgentRun>;
  setOutcome(organizationId: string, runId: string, outcome: AgentOutcome): Promise<AgentRun>;
  clearForTests?(): Promise<void>;
}

/**
 * In-memory AgentRunStore implementation for hermetic unit testing without GCP credentials.
 */
export function createMemoryAgentRunStore(): AgentRunStore {
  const runs = new Map<string, AgentRun>();
  const steps = new Map<string, AgentStep>();

  const buildRunKey = (orgId: string, runId: string) => `${orgId}:${runId}`;
  const buildStepKey = (orgId: string, runId: string, stepId: string) => `${orgId}:${runId}:${stepId}`;

  return {
    async createRun(rawInput: CreateAgentRunInput): Promise<AgentRun> {
      const input = CreateAgentRunInputSchema.parse(rawInput);
      const runId = input.runId || `run_${randomUUID()}`;
      const now = new Date().toISOString();

      const defaultBudgets = AgentRunBudgetsSchema.parse({});
      const mergedBudgets = AgentRunBudgetsSchema.parse({
        ...defaultBudgets,
        ...(input.customBudgets || {}),
      });

      const initialStatus = input.triggerType === 'scheduled' ? 'queued' : 'created';

      const run: AgentRun = {
        runId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentPersonaId: input.agentPersonaId,
        principalId: input.principalId,
        authorizingUserId: input.authorizingUserId,
        triggerType: input.triggerType,
        modelTier: input.modelTier,
        dryRun: input.dryRun,
        goal: input.goal,
        status: initialStatus,
        stateHistory: [createStateHistoryEntry(initialStatus, initialStatus, 'Run initialized')],
        currentStepIndex: 0,
        budgets: mergedBudgets,
        budgetUsage: {
          tokensUsed: 0,
          toolCallsExecuted: 0,
          durationMs: 0,
          recordsMutated: 0,
          financialAmount: 0,
          currentDelegationDepth: 0,
        },
        ...(input.originalRunId ? { originalRunId: input.originalRunId } : {}),
        ...(input.swarmRunId ? { swarmRunId: input.swarmRunId } : {}),
        ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
        childRunIds: input.childRunIds ?? [],
        metadata: input.metadata || {},
        createdAt: now,
        updatedAt: now,
      };

      const parsed = AgentRunSchema.parse(run);
      runs.set(buildRunKey(input.organizationId, runId), parsed);
      return { ...parsed };
    },

    async getRun(organizationId: string, runId: string): Promise<AgentRun | null> {
      if (!organizationId || !runId) return null;
      const found = runs.get(buildRunKey(organizationId, runId));
      return found ? { ...found } : null;
    },

    async listRuns(
      organizationId: string,
      rawOptions?: ListAgentRunsOptions
    ): Promise<{ runs: AgentRun[]; total: number }> {
      const options = ListAgentRunsOptionsSchema.parse(rawOptions || {});
      const all: AgentRun[] = [];

      for (const run of runs.values()) {
        if (run.organizationId !== organizationId) continue;
        if (options.workspaceId && run.workspaceId !== options.workspaceId) continue;
        if (options.agentPersonaId && run.agentPersonaId !== options.agentPersonaId) continue;
        if (options.status && run.status !== options.status) continue;
        all.push({ ...run });
      }

      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const total = all.length;
      const paginated = all.slice(options.offset, options.offset + options.limit);
      return { runs: paginated, total };
    },

    async updateRunStatus(rawInput: UpdateAgentRunStatusInput): Promise<AgentRun> {
      const input = UpdateAgentRunStatusInputSchema.parse(rawInput);
      const key = buildRunKey(input.organizationId, input.runId);
      const existing = runs.get(key);

      if (!existing) {
        throw new AgentRuntimeError({
          code: 'RUN_NOT_FOUND',
          message: `Agent run '${input.runId}' was not found in organization '${input.organizationId}'.`,
          runId: input.runId,
          organizationId: input.organizationId,
        });
      }

      if (input.fromStatus && existing.status !== input.fromStatus) {
        throw new AgentRuntimeError({
          code: 'CONCURRENCY_CONFLICT',
          message: `Expected current status '${input.fromStatus}', but actual status is '${existing.status}'.`,
          runId: input.runId,
          organizationId: input.organizationId,
          currentStatus: existing.status,
          targetStatus: input.toStatus,
        });
      }

      assertValidStateTransition(existing.status, input.toStatus, existing.runId);

      const now = new Date().toISOString();
      const updatedHistory = [
        ...existing.stateHistory,
        createStateHistoryEntry(existing.status, input.toStatus, input.reason),
      ];

      const updated: AgentRun = {
        ...existing,
        status: input.toStatus,
        stateHistory: updatedHistory,
        updatedAt: now,
        ...(input.error ? { error: input.error } : {}),
        ...(isTerminalState(input.toStatus) && !existing.completedAt ? { completedAt: now } : {}),
        ...((input.toStatus === 'executing' || input.toStatus === 'planning') && !existing.startedAt
          ? { startedAt: now }
          : {}),
      };

      const parsed = AgentRunSchema.parse(updated);
      runs.set(key, parsed);
      return { ...parsed };
    },

    async saveExecutionPlan(
      organizationId: string,
      runId: string,
      plan: ExecutionPlan
    ): Promise<AgentRun> {
      const key = buildRunKey(organizationId, runId);
      const existing = runs.get(key);

      if (!existing) {
        throw new AgentRuntimeError({
          code: 'RUN_NOT_FOUND',
          message: `Agent run '${runId}' was not found.`,
          runId,
          organizationId,
        });
      }

      if (isTerminalState(existing.status)) {
        throw new AgentRuntimeError({
          code: 'TERMINAL_STATE_IMMUTABLE',
          message: `Cannot update plan on run '${runId}' because it is in terminal state '${existing.status}'.`,
          runId,
          organizationId,
          currentStatus: existing.status,
        });
      }

      const updated: AgentRun = {
        ...existing,
        currentPlan: plan,
        updatedAt: new Date().toISOString(),
      };

      const parsed = AgentRunSchema.parse(updated);
      runs.set(key, parsed);
      return { ...parsed };
    },

    async createStep(
      organizationId: string,
      runId: string,
      rawStep: CreateStepInput
    ): Promise<AgentStep> {
      const stepInput = CreateStepInputSchema.parse(rawStep);

      if (stepInput.organizationId !== organizationId || stepInput.runId !== runId) {
        throw new AgentRuntimeError({
          code: 'TENANT_SCOPE_VIOLATION',
          message: `Tenant or run parameter mismatch in createStep.`,
          runId,
          organizationId,
        });
      }

      const runKey = buildRunKey(organizationId, runId);
      const run = runs.get(runKey);
      if (!run) {
        throw new AgentRuntimeError({
          code: 'RUN_NOT_FOUND',
          message: `Cannot create step for non-existent run '${runId}'.`,
          runId,
          organizationId,
        });
      }

      if (stepInput.workspaceId !== run.workspaceId) {
        throw new AgentRuntimeError({
          code: 'TENANT_SCOPE_VIOLATION',
          message: `Workspace mismatch in createStep: expected '${run.workspaceId}', got '${stepInput.workspaceId}'.`,
          runId,
          organizationId,
        });
      }

      const stepId = stepInput.stepId || `step_${runId}_${stepInput.stepIndex}_${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      const step: AgentStep = {
        stepId,
        runId,
        organizationId,
        workspaceId: stepInput.workspaceId,
        stepIndex: stepInput.stepIndex,
        type: stepInput.type,
        title: stepInput.title,
        capabilityId: stepInput.capabilityId,
        capabilityVersion: stepInput.capabilityVersion,
        status: 'running',
        idempotencyKey: stepInput.idempotencyKey,
        correlationId: stepInput.correlationId,
        traceId: stepInput.traceId,
        spanId: stepInput.spanId,
        actionProposalId: stepInput.actionProposalId,
        payloadHash: stepInput.payloadHash,
        what: stepInput.what,
        why: stepInput.why,
        expectedStateChange: stepInput.expectedStateChange,
        riskLevel: stepInput.riskLevel,
        startedAt: now,
        input: stepInput.input,
        outputValidated: false,
        tokensUsed: 0,
        compensatingCapabilityId: stepInput.compensatingCapabilityId,
        compensationStatus: 'not_required',
      };

      const parsedStep = AgentStepSchema.parse(step);
      steps.set(buildStepKey(organizationId, runId, stepId), parsedStep);

      // Advance current step index on run
      const updatedRun: AgentRun = {
        ...run,
        currentStepIndex: Math.max(run.currentStepIndex, stepInput.stepIndex),
        updatedAt: now,
      };
      runs.set(runKey, AgentRunSchema.parse(updatedRun));

      return { ...parsedStep };
    },

    async getStep(
      organizationId: string,
      runId: string,
      stepId: string
    ): Promise<AgentStep | null> {
      const found = steps.get(buildStepKey(organizationId, runId, stepId));
      return found ? { ...found } : null;
    },

    async listSteps(organizationId: string, runId: string): Promise<AgentStep[]> {
      const results: AgentStep[] = [];
      const prefix = `${organizationId}:${runId}:`;

      for (const [key, step] of steps.entries()) {
        if (key.startsWith(prefix)) {
          results.push({ ...step });
        }
      }

      results.sort((a, b) => a.stepIndex - b.stepIndex);
      return results;
    },

    async updateStep(rawInput: UpdateStepInput): Promise<AgentStep> {
      const input = UpdateStepInputSchema.parse(rawInput);
      const key = buildStepKey(input.organizationId, input.runId, input.stepId);
      const existing = steps.get(key);

      if (!existing) {
        throw new AgentRuntimeError({
          code: 'STEP_NOT_FOUND',
          message: `Agent step '${input.stepId}' was not found.`,
          runId: input.runId,
          stepId: input.stepId,
          organizationId: input.organizationId,
        });
      }

      const updated: AgentStep = {
        ...existing,
        status: input.status,
        ...(input.actionProposalId ? { actionProposalId: input.actionProposalId } : {}),
        ...(input.payloadHash ? { payloadHash: input.payloadHash } : {}),
        ...(input.output !== undefined ? { output: input.output } : {}),
        ...(input.outputValidated !== undefined ? { outputValidated: input.outputValidated } : {}),
        ...(input.outputValidationErrors !== undefined ? { outputValidationErrors: input.outputValidationErrors } : {}),
        ...(input.sanitizedError ? { sanitizedError: input.sanitizedError } : {}),
        ...(input.tokensUsed !== undefined ? { tokensUsed: input.tokensUsed } : {}),
        ...(input.contextTokenUsage !== undefined ? { contextTokenUsage: input.contextTokenUsage } : {}),
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
        ...(input.completedAt ? { completedAt: input.completedAt } : {}),
        ...(input.compensationStepId ? { compensationStepId: input.compensationStepId } : {}),
        ...(input.compensationStatus ? { compensationStatus: input.compensationStatus } : {}),
      };

      const parsed = AgentStepSchema.parse(updated);
      steps.set(key, parsed);
      return { ...parsed };
    },

    async updateBudgetUsage(
      organizationId: string,
      runId: string,
      delta: Partial<AgentRunBudgetUsage>
    ): Promise<AgentRun> {
      const key = buildRunKey(organizationId, runId);
      const run = runs.get(key);

      if (!run) {
        throw new AgentRuntimeError({
          code: 'RUN_NOT_FOUND',
          message: `Cannot update budget for non-existent run '${runId}'.`,
          runId,
          organizationId,
        });
      }

      const nextTokens = run.budgetUsage.tokensUsed + (delta.tokensUsed || 0);
      const nextToolCalls = run.budgetUsage.toolCallsExecuted + (delta.toolCallsExecuted || 0);
      const nextDuration = run.budgetUsage.durationMs + (delta.durationMs || 0);
      const nextMutations = run.budgetUsage.recordsMutated + (delta.recordsMutated || 0);
      const nextFinance = run.budgetUsage.financialAmount + (delta.financialAmount || 0);
      const nextDepth = Math.max(run.budgetUsage.currentDelegationDepth, delta.currentDelegationDepth || 0);

      // Rule 23 Hard Ceilings Enforcement
      if (nextTokens > run.budgets.maxTokens) {
        throw new AgentRuntimeError({
          code: 'BUDGET_EXCEEDED',
          message: `Token budget exceeded for run '${runId}'. Limit: ${run.budgets.maxTokens}, Requested: ${nextTokens}.`,
          runId,
          organizationId,
          details: { limit: run.budgets.maxTokens, attempted: nextTokens, metric: 'tokens' },
        });
      }

      if (nextToolCalls > run.budgets.maxToolCalls) {
        throw new AgentRuntimeError({
          code: 'BUDGET_EXCEEDED',
          message: `Tool call limit exceeded for run '${runId}'. Limit: ${run.budgets.maxToolCalls}, Requested: ${nextToolCalls}.`,
          runId,
          organizationId,
          details: { limit: run.budgets.maxToolCalls, attempted: nextToolCalls, metric: 'toolCalls' },
        });
      }

      if (nextDuration > run.budgets.maxDurationMs) {
        throw new AgentRuntimeError({
          code: 'BUDGET_EXCEEDED',
          message: `Execution duration budget exceeded for run '${runId}'. Limit: ${run.budgets.maxDurationMs}ms, Requested: ${nextDuration}ms.`,
          runId,
          organizationId,
          details: { limit: run.budgets.maxDurationMs, attempted: nextDuration, metric: 'durationMs' },
        });
      }

      if (nextMutations > run.budgets.maxRecordsMutated) {
        throw new AgentRuntimeError({
          code: 'BUDGET_EXCEEDED',
          message: `Record mutation ceiling exceeded for run '${runId}'. Limit: ${run.budgets.maxRecordsMutated}, Requested: ${nextMutations}.`,
          runId,
          organizationId,
          details: { limit: run.budgets.maxRecordsMutated, attempted: nextMutations, metric: 'recordsMutated' },
        });
      }

      if (run.budgets.maxFinancialAmount > 0 && nextFinance > run.budgets.maxFinancialAmount) {
        throw new AgentRuntimeError({
          code: 'BUDGET_EXCEEDED',
          message: `Financial spending ceiling exceeded for run '${runId}'. Limit: ${run.budgets.maxFinancialAmount}, Requested: ${nextFinance}.`,
          runId,
          organizationId,
          details: { limit: run.budgets.maxFinancialAmount, attempted: nextFinance, metric: 'financialAmount' },
        });
      }

      if (nextDepth > run.budgets.maxDelegationDepth) {
        throw new AgentRuntimeError({
          code: 'BUDGET_EXCEEDED',
          message: `Delegation depth ceiling exceeded for run '${runId}'. Limit: ${run.budgets.maxDelegationDepth}, Attempted: ${nextDepth}.`,
          runId,
          organizationId,
          details: { limit: run.budgets.maxDelegationDepth, attempted: nextDepth, metric: 'delegationDepth' },
        });
      }

      const updatedUsage: AgentRunBudgetUsage = {
        tokensUsed: nextTokens,
        toolCallsExecuted: nextToolCalls,
        durationMs: nextDuration,
        recordsMutated: nextMutations,
        financialAmount: nextFinance,
        currentDelegationDepth: nextDepth,
      };

      const updatedRun: AgentRun = {
        ...run,
        budgetUsage: updatedUsage,
        updatedAt: new Date().toISOString(),
      };

      const parsed = AgentRunSchema.parse(updatedRun);
      runs.set(key, parsed);
      return { ...parsed };
    },

    async setOutcome(
      organizationId: string,
      runId: string,
      outcome: AgentOutcome
    ): Promise<AgentRun> {
      const key = buildRunKey(organizationId, runId);
      const run = runs.get(key);

      if (!run) {
        throw new AgentRuntimeError({
          code: 'RUN_NOT_FOUND',
          message: `Agent run '${runId}' not found.`,
          runId,
          organizationId,
        });
      }

      const updated: AgentRun = {
        ...run,
        outcome,
        updatedAt: new Date().toISOString(),
      };

      const parsed = AgentRunSchema.parse(updated);
      runs.set(key, parsed);
      return { ...parsed };
    },

    async clearForTests(): Promise<void> {
      runs.clear();
      steps.clear();
    },
  };
}

/**
 * Production Firestore AgentRunStore implementation.
 * Partitioned collections:
 *   /organizations/{organizationId}/agent_runs/{runId}
 *   /organizations/{organizationId}/agent_runs/{runId}/steps/{stepId}
 */
export function createFirestoreAgentRunStore(firestoreInstance?: Firestore): AgentRunStore {
  async function getDb(): Promise<Firestore> {
    if (firestoreInstance) return firestoreInstance;
    const { adminDb } = await import('@/lib/firebase-admin');
    return adminDb;
  }

  function getRunDocRef(db: Firestore, organizationId: string, runId: string) {
    return db
      .collection('organizations')
      .doc(organizationId)
      .collection('agent_runs')
      .doc(runId);
  }

  function getStepDocRef(db: Firestore, organizationId: string, runId: string, stepId: string) {
    return getRunDocRef(db, organizationId, runId)
      .collection('steps')
      .doc(stepId);
  }

  return {
    async createRun(rawInput: CreateAgentRunInput): Promise<AgentRun> {
      const input = CreateAgentRunInputSchema.parse(rawInput);
      const db = await getDb();
      const runId = input.runId || `run_${randomUUID()}`;
      const now = new Date().toISOString();

      const defaultBudgets = AgentRunBudgetsSchema.parse({});
      const mergedBudgets = AgentRunBudgetsSchema.parse({
        ...defaultBudgets,
        ...(input.customBudgets || {}),
      });

      const initialStatus = input.triggerType === 'scheduled' ? 'queued' : 'created';

      const run: AgentRun = {
        runId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentPersonaId: input.agentPersonaId,
        principalId: input.principalId,
        authorizingUserId: input.authorizingUserId,
        triggerType: input.triggerType,
        modelTier: input.modelTier,
        dryRun: input.dryRun,
        goal: input.goal,
        status: initialStatus,
        stateHistory: [createStateHistoryEntry(initialStatus, initialStatus, 'Run initialized')],
        currentStepIndex: 0,
        budgets: mergedBudgets,
        budgetUsage: {
          tokensUsed: 0,
          toolCallsExecuted: 0,
          durationMs: 0,
          recordsMutated: 0,
          financialAmount: 0,
          currentDelegationDepth: 0,
        },
        ...(input.originalRunId ? { originalRunId: input.originalRunId } : {}),
        ...(input.swarmRunId ? { swarmRunId: input.swarmRunId } : {}),
        ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
        childRunIds: input.childRunIds ?? [],
        metadata: input.metadata || {},
        createdAt: now,
        updatedAt: now,
      };

      const parsed = AgentRunSchema.parse(run);
      await getRunDocRef(db, input.organizationId, runId).set(parsed);
      return parsed;
    },

    async getRun(organizationId: string, runId: string): Promise<AgentRun | null> {
      if (!organizationId || !runId) return null;
      const db = await getDb();
      const snap = await getRunDocRef(db, organizationId, runId).get();
      if (!snap.exists) return null;
      return AgentRunSchema.parse(snap.data());
    },

    async listRuns(
      organizationId: string,
      rawOptions?: ListAgentRunsOptions
    ): Promise<{ runs: AgentRun[]; total: number }> {
      const options = ListAgentRunsOptionsSchema.parse(rawOptions || {});
      const db = await getDb();

      let query = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agent_runs')
        .orderBy('createdAt', 'desc');

      if (options.workspaceId) {
        query = query.where('workspaceId', '==', options.workspaceId);
      }
      if (options.agentPersonaId) {
        query = query.where('agentPersonaId', '==', options.agentPersonaId);
      }
      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      // Count total before pagination
      const totalSnap = await query.count().get();
      const total = totalSnap.data().count;

      const snap = await query.offset(options.offset).limit(options.limit).get();
      const runs = snap.docs.map((d) => AgentRunSchema.parse(d.data()));

      return { runs, total };
    },

    async updateRunStatus(rawInput: UpdateAgentRunStatusInput): Promise<AgentRun> {
      const input = UpdateAgentRunStatusInputSchema.parse(rawInput);
      const db = await getDb();
      const ref = getRunDocRef(db, input.organizationId, input.runId);

      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new AgentRuntimeError({
            code: 'RUN_NOT_FOUND',
            message: `Agent run '${input.runId}' not found.`,
            runId: input.runId,
            organizationId: input.organizationId,
          });
        }

        const existing = AgentRunSchema.parse(snap.data());

        if (input.fromStatus && existing.status !== input.fromStatus) {
          throw new AgentRuntimeError({
            code: 'CONCURRENCY_CONFLICT',
            message: `Expected current status '${input.fromStatus}', but actual status is '${existing.status}'.`,
            runId: input.runId,
            organizationId: input.organizationId,
            currentStatus: existing.status,
            targetStatus: input.toStatus,
          });
        }

        assertValidStateTransition(existing.status, input.toStatus, existing.runId);

        const now = new Date().toISOString();
        const updatedHistory = [
          ...existing.stateHistory,
          createStateHistoryEntry(existing.status, input.toStatus, input.reason),
        ];

        const updated: AgentRun = {
          ...existing,
          status: input.toStatus,
          stateHistory: updatedHistory,
          updatedAt: now,
          ...(input.error ? { error: input.error } : {}),
          ...(isTerminalState(input.toStatus) && !existing.completedAt ? { completedAt: now } : {}),
          ...((input.toStatus === 'executing' || input.toStatus === 'planning') && !existing.startedAt
            ? { startedAt: now }
            : {}),
        };

        const parsed = AgentRunSchema.parse(updated);
        transaction.set(ref, parsed);
        return parsed;
      });
    },

    async saveExecutionPlan(
      organizationId: string,
      runId: string,
      plan: ExecutionPlan
    ): Promise<AgentRun> {
      const db = await getDb();
      const ref = getRunDocRef(db, organizationId, runId);

      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new AgentRuntimeError({
            code: 'RUN_NOT_FOUND',
            message: `Agent run '${runId}' not found.`,
            runId,
            organizationId,
          });
        }

        const existing = AgentRunSchema.parse(snap.data());
        if (isTerminalState(existing.status)) {
          throw new AgentRuntimeError({
            code: 'TERMINAL_STATE_IMMUTABLE',
            message: `Cannot update plan on run '${runId}' in terminal state '${existing.status}'.`,
            runId,
            organizationId,
            currentStatus: existing.status,
          });
        }

        const updated: AgentRun = {
          ...existing,
          currentPlan: plan,
          updatedAt: new Date().toISOString(),
        };

        const parsed = AgentRunSchema.parse(updated);
        transaction.set(ref, parsed);
        return parsed;
      });
    },

    async createStep(
      organizationId: string,
      runId: string,
      rawStep: CreateStepInput
    ): Promise<AgentStep> {
      const stepInput = CreateStepInputSchema.parse(rawStep);

      if (stepInput.organizationId !== organizationId || stepInput.runId !== runId) {
        throw new AgentRuntimeError({
          code: 'TENANT_SCOPE_VIOLATION',
          message: `Tenant or run parameter mismatch in createStep.`,
          runId,
          organizationId,
        });
      }

      const db = await getDb();
      const runRef = getRunDocRef(db, organizationId, runId);

      return db.runTransaction(async (transaction) => {
        const runSnap = await transaction.get(runRef);
        if (!runSnap.exists) {
          throw new AgentRuntimeError({
            code: 'RUN_NOT_FOUND',
            message: `Run '${runId}' not found.`,
            runId,
            organizationId,
          });
        }

        const run = AgentRunSchema.parse(runSnap.data());

        if (stepInput.workspaceId !== run.workspaceId) {
          throw new AgentRuntimeError({
            code: 'TENANT_SCOPE_VIOLATION',
            message: `Workspace mismatch in createStep: expected '${run.workspaceId}', got '${stepInput.workspaceId}'.`,
            runId,
            organizationId,
          });
        }

        const stepId = stepInput.stepId || `step_${runId}_${stepInput.stepIndex}_${randomUUID().slice(0, 8)}`;
        const stepRef = getStepDocRef(db, organizationId, runId, stepId);
        const now = new Date().toISOString();

        const step: AgentStep = {
          stepId,
          runId,
          organizationId,
          workspaceId: stepInput.workspaceId,
          stepIndex: stepInput.stepIndex,
          type: stepInput.type,
          title: stepInput.title,
          capabilityId: stepInput.capabilityId,
          capabilityVersion: stepInput.capabilityVersion,
          status: 'running',
          idempotencyKey: stepInput.idempotencyKey,
          correlationId: stepInput.correlationId,
          traceId: stepInput.traceId,
          spanId: stepInput.spanId,
          actionProposalId: stepInput.actionProposalId,
          payloadHash: stepInput.payloadHash,
          what: stepInput.what,
          why: stepInput.why,
          expectedStateChange: stepInput.expectedStateChange,
          riskLevel: stepInput.riskLevel,
          startedAt: now,
          input: stepInput.input,
          outputValidated: false,
          tokensUsed: 0,
          compensatingCapabilityId: stepInput.compensatingCapabilityId,
          compensationStatus: 'not_required',
        };

        const parsedStep = AgentStepSchema.parse(step);
        transaction.set(stepRef, parsedStep);

        const updatedRun: AgentRun = {
          ...run,
          currentStepIndex: Math.max(run.currentStepIndex, stepInput.stepIndex),
          updatedAt: now,
        };
        transaction.set(runRef, AgentRunSchema.parse(updatedRun));

        return parsedStep;
      });
    },

    async getStep(
      organizationId: string,
      runId: string,
      stepId: string
    ): Promise<AgentStep | null> {
      const db = await getDb();
      const snap = await getStepDocRef(db, organizationId, runId, stepId).get();
      if (!snap.exists) return null;
      return AgentStepSchema.parse(snap.data());
    },

    async listSteps(organizationId: string, runId: string): Promise<AgentStep[]> {
      const db = await getDb();
      const snap = await getRunDocRef(db, organizationId, runId)
        .collection('steps')
        .orderBy('stepIndex', 'asc')
        .get();

      return snap.docs.map((d) => AgentStepSchema.parse(d.data()));
    },

    async updateStep(rawInput: UpdateStepInput): Promise<AgentStep> {
      const input = UpdateStepInputSchema.parse(rawInput);
      const db = await getDb();
      const ref = getStepDocRef(db, input.organizationId, input.runId, input.stepId);

      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new AgentRuntimeError({
            code: 'STEP_NOT_FOUND',
            message: `Agent step '${input.stepId}' was not found.`,
            runId: input.runId,
            stepId: input.stepId,
            organizationId: input.organizationId,
          });
        }

        const existing = AgentStepSchema.parse(snap.data());
        const updated: AgentStep = {
          ...existing,
          status: input.status,
          ...(input.actionProposalId ? { actionProposalId: input.actionProposalId } : {}),
          ...(input.payloadHash ? { payloadHash: input.payloadHash } : {}),
          ...(input.output !== undefined ? { output: input.output } : {}),
          ...(input.outputValidated !== undefined ? { outputValidated: input.outputValidated } : {}),
          ...(input.outputValidationErrors !== undefined ? { outputValidationErrors: input.outputValidationErrors } : {}),
          ...(input.sanitizedError ? { sanitizedError: input.sanitizedError } : {}),
          ...(input.tokensUsed !== undefined ? { tokensUsed: input.tokensUsed } : {}),
          ...(input.contextTokenUsage !== undefined ? { contextTokenUsage: input.contextTokenUsage } : {}),
          ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
          ...(input.completedAt ? { completedAt: input.completedAt } : {}),
          ...(input.compensationStepId ? { compensationStepId: input.compensationStepId } : {}),
          ...(input.compensationStatus ? { compensationStatus: input.compensationStatus } : {}),
        };

        const parsed = AgentStepSchema.parse(updated);
        transaction.set(ref, parsed);
        return parsed;
      });
    },

    async updateBudgetUsage(
      organizationId: string,
      runId: string,
      delta: Partial<AgentRunBudgetUsage>
    ): Promise<AgentRun> {
      const db = await getDb();
      const ref = getRunDocRef(db, organizationId, runId);

      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new AgentRuntimeError({
            code: 'RUN_NOT_FOUND',
            message: `Agent run '${runId}' not found.`,
            runId,
            organizationId,
          });
        }

        const run = AgentRunSchema.parse(snap.data());
        const nextTokens = run.budgetUsage.tokensUsed + (delta.tokensUsed || 0);
        const nextToolCalls = run.budgetUsage.toolCallsExecuted + (delta.toolCallsExecuted || 0);
        const nextDuration = run.budgetUsage.durationMs + (delta.durationMs || 0);
        const nextMutations = run.budgetUsage.recordsMutated + (delta.recordsMutated || 0);
        const nextFinance = run.budgetUsage.financialAmount + (delta.financialAmount || 0);
        const nextDepth = Math.max(run.budgetUsage.currentDelegationDepth, delta.currentDelegationDepth || 0);

        // Rule 23 Hard Ceilings Enforcement
        if (nextTokens > run.budgets.maxTokens) {
          throw new AgentRuntimeError({
            code: 'BUDGET_EXCEEDED',
            message: `Token budget exceeded for run '${runId}'. Limit: ${run.budgets.maxTokens}, Requested: ${nextTokens}.`,
            runId,
            organizationId,
            details: { limit: run.budgets.maxTokens, attempted: nextTokens, metric: 'tokens' },
          });
        }

        if (nextToolCalls > run.budgets.maxToolCalls) {
          throw new AgentRuntimeError({
            code: 'BUDGET_EXCEEDED',
            message: `Tool call limit exceeded for run '${runId}'. Limit: ${run.budgets.maxToolCalls}, Requested: ${nextToolCalls}.`,
            runId,
            organizationId,
            details: { limit: run.budgets.maxToolCalls, attempted: nextToolCalls, metric: 'toolCalls' },
          });
        }

        if (nextDuration > run.budgets.maxDurationMs) {
          throw new AgentRuntimeError({
            code: 'BUDGET_EXCEEDED',
            message: `Execution duration budget exceeded for run '${runId}'. Limit: ${run.budgets.maxDurationMs}ms, Requested: ${nextDuration}ms.`,
            runId,
            organizationId,
            details: { limit: run.budgets.maxDurationMs, attempted: nextDuration, metric: 'durationMs' },
          });
        }

        if (nextMutations > run.budgets.maxRecordsMutated) {
          throw new AgentRuntimeError({
            code: 'BUDGET_EXCEEDED',
            message: `Record mutation ceiling exceeded for run '${runId}'. Limit: ${run.budgets.maxRecordsMutated}, Requested: ${nextMutations}.`,
            runId,
            organizationId,
            details: { limit: run.budgets.maxRecordsMutated, attempted: nextMutations, metric: 'recordsMutated' },
          });
        }

        if (run.budgets.maxFinancialAmount > 0 && nextFinance > run.budgets.maxFinancialAmount) {
          throw new AgentRuntimeError({
            code: 'BUDGET_EXCEEDED',
            message: `Financial spending ceiling exceeded for run '${runId}'. Limit: ${run.budgets.maxFinancialAmount}, Requested: ${nextFinance}.`,
            runId,
            organizationId,
            details: { limit: run.budgets.maxFinancialAmount, attempted: nextFinance, metric: 'financialAmount' },
          });
        }

        if (nextDepth > run.budgets.maxDelegationDepth) {
          throw new AgentRuntimeError({
            code: 'BUDGET_EXCEEDED',
            message: `Delegation depth ceiling exceeded for run '${runId}'. Limit: ${run.budgets.maxDelegationDepth}, Attempted: ${nextDepth}.`,
            runId,
            organizationId,
            details: { limit: run.budgets.maxDelegationDepth, attempted: nextDepth, metric: 'delegationDepth' },
          });
        }

        const updatedUsage: AgentRunBudgetUsage = {
          tokensUsed: nextTokens,
          toolCallsExecuted: nextToolCalls,
          durationMs: nextDuration,
          recordsMutated: nextMutations,
          financialAmount: nextFinance,
          currentDelegationDepth: nextDepth,
        };

        const updatedRun: AgentRun = {
          ...run,
          budgetUsage: updatedUsage,
          updatedAt: new Date().toISOString(),
        };

        const parsed = AgentRunSchema.parse(updatedRun);
        transaction.set(ref, parsed);
        return parsed;
      });
    },

    async setOutcome(
      organizationId: string,
      runId: string,
      outcome: AgentOutcome
    ): Promise<AgentRun> {
      const db = await getDb();
      const ref = getRunDocRef(db, organizationId, runId);

      return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new AgentRuntimeError({
            code: 'RUN_NOT_FOUND',
            message: `Agent run '${runId}' not found.`,
            runId,
            organizationId,
          });
        }

        const run = AgentRunSchema.parse(snap.data());
        const updated: AgentRun = {
          ...run,
          outcome,
          updatedAt: new Date().toISOString(),
        };

        const parsed = AgentRunSchema.parse(updated);
        transaction.set(ref, parsed);
        return parsed;
      });
    },
  };
}

// ============================================================================
// HMR-SAFE GLOBAL SINGLETON (Rule 69)
// ============================================================================

declare global {
  var __smartsappAgentRunStore: AgentRunStore | undefined;
}

/**
 * Returns the singleton AgentRunStore instance.
 * Preserves in-flight state across Hot Module Reloading in Next.js development.
 */
export function getAgentRunStore(customStore?: AgentRunStore): AgentRunStore {
  if (customStore) {
    globalThis.__smartsappAgentRunStore = customStore;
    return customStore;
  }

  if (!globalThis.__smartsappAgentRunStore) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      globalThis.__smartsappAgentRunStore = createMemoryAgentRunStore();
    } else {
      globalThis.__smartsappAgentRunStore = createFirestoreAgentRunStore();
    }
  }

  return globalThis.__smartsappAgentRunStore;
}
