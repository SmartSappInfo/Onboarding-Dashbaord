/**
 * @fileOverview Multi-Dimensional Resource Governance & Budget Manager (Rules 23, 40, 42, 54, 60)
 *
 * Implements strict resource ceilings:
 * - maxTokens, maxToolCalls, maxDurationMs, maxRecordsMutated, maxFinancialAmount, maxDelegationDepth.
 * - Pre-execution reservation checks (`checkBudget`, `checkOrThrow`).
 * - Atomic persistence to `AgentRunStore` with dry-run support (Rule 42).
 * - Emits `agent.run.budget_exceeded` domain events on breach (Rule 40).
 * - Emergency dead-man evaluation (Rule 60).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { type AgentRunStore, getAgentRunStore } from '../agent-run-store';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  type BudgetCheckResult,
  type RecordUsageDelta,
  GovernanceError,
} from './governance-types';
import { type AgentRunBudgetUsage } from '../agent-run-types';

export interface AgentBudgetManagerOptions {
  runStore?: AgentRunStore;
  eventBus?: EventBus;
}

export interface CheckBudgetParams {
  organizationId: string;
  runId: string;
  estimatedTokens?: number;
  toolCalls?: number;
  estimatedDurationMs?: number;
  recordsMutated?: number;
  financialAmount?: number;
  delegationDepth?: number;
  correlationId?: string;
  traceId?: string;
}

export class AgentBudgetManager {
  private readonly runStore: AgentRunStore;
  private readonly eventBus: EventBus;

  constructor(options?: AgentBudgetManagerOptions) {
    this.runStore = options?.runStore ?? getAgentRunStore();
    this.eventBus = options?.eventBus ?? defaultEventBus;
  }

  public async checkBudget(params: CheckBudgetParams): Promise<BudgetCheckResult> {
    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch (e) {
      if (e instanceof GovernanceError) throw e;
      throw new GovernanceError({
        code: 'DEAD_MAN_PAUSED',
        message: `Operation halted: Emergency dead-man switch is active for tenant '${params.organizationId}'.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    const run = await this.runStore.getRun(params.organizationId, params.runId);
    if (!run) {
      throw new GovernanceError({
        code: 'INVALID_GOVERNANCE_INPUT',
        message: `Agent run '${params.runId}' not found.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    const { budgets, budgetUsage } = run;
    const breached: string[] = [];

    const projectedTokens = budgetUsage.tokensUsed + (params.estimatedTokens ?? 0);
    if (projectedTokens > budgets.maxTokens) {
      breached.push(`tokens (${projectedTokens} > ${budgets.maxTokens})`);
    }

    const projectedToolCalls = budgetUsage.toolCallsExecuted + (params.toolCalls ?? 0);
    if (projectedToolCalls > budgets.maxToolCalls) {
      breached.push(`toolCalls (${projectedToolCalls} > ${budgets.maxToolCalls})`);
    }

    const projectedDuration = budgetUsage.durationMs + (params.estimatedDurationMs ?? 0);
    if (projectedDuration > budgets.maxDurationMs) {
      breached.push(`durationMs (${projectedDuration} > ${budgets.maxDurationMs})`);
    }

    const projectedRecords = budgetUsage.recordsMutated + (params.recordsMutated ?? 0);
    if (projectedRecords > budgets.maxRecordsMutated) {
      breached.push(`recordsMutated (${projectedRecords} > ${budgets.maxRecordsMutated})`);
    }

    const projectedFinance = budgetUsage.financialAmount + (params.financialAmount ?? 0);
    if (projectedFinance > budgets.maxFinancialAmount) {
      breached.push(`financialAmount (${projectedFinance} > ${budgets.maxFinancialAmount})`);
    }

    if (params.delegationDepth !== undefined && params.delegationDepth > budgets.maxDelegationDepth) {
      breached.push(`delegationDepth (${params.delegationDepth} > ${budgets.maxDelegationDepth})`);
    }

    const allowed = breached.length === 0;

    if (!allowed) {
      await this.eventBus.publish(
        createDomainEvent({
          type: 'agent.run.budget_exceeded',
          source: 'agent-runtime',
          organizationId: params.organizationId,
          workspaceId: run.workspaceId,
          actor: { type: 'agent', id: run.agentPersonaId },
          entity: { type: 'agent_run', id: run.runId },
          correlationId: params.correlationId || `corr_${run.runId}`,
          payload: {
            runId: params.runId,
            agentPersonaId: run.agentPersonaId,
            breachedDimensions: breached,
            currentUsage: budgetUsage,
            budgets,
          },
        })
      );
    }

    return {
      allowed,
      breachedDimensions: breached,
      currentUsage: budgetUsage,
      remainingBudgets: {
        maxTokens: Math.max(0, budgets.maxTokens - budgetUsage.tokensUsed),
        maxToolCalls: Math.max(0, budgets.maxToolCalls - budgetUsage.toolCallsExecuted),
        maxDurationMs: Math.max(0, budgets.maxDurationMs - budgetUsage.durationMs),
        maxRecordsMutated: Math.max(0, budgets.maxRecordsMutated - budgetUsage.recordsMutated),
        maxFinancialAmount: Math.max(0, budgets.maxFinancialAmount - budgetUsage.financialAmount),
        maxDelegationDepth: Math.max(0, budgets.maxDelegationDepth - budgetUsage.currentDelegationDepth),
      },
      rejectionReason: allowed ? undefined : `Budget breached on dimensions: ${breached.join(', ')}`,
      traceId: params.traceId,
      correlationId: params.correlationId,
    };
  }

  public async checkOrThrow(params: CheckBudgetParams): Promise<void> {
    const check = await this.checkBudget(params);
    if (!check.allowed) {
      throw new GovernanceError({
        code: 'BUDGET_EXCEEDED',
        message: check.rejectionReason ?? 'Agent resource budget exceeded.',
        runId: params.runId,
        organizationId: params.organizationId,
        details: {
          breachedDimensions: check.breachedDimensions,
          currentUsage: check.currentUsage,
        },
      });
    }
  }

  public async recordUsage(params: {
    organizationId: string;
    runId: string;
    delta: RecordUsageDelta;
    dryRun?: boolean;
  }): Promise<AgentRunBudgetUsage> {
    const run = await this.runStore.getRun(params.organizationId, params.runId);
    if (!run) {
      throw new GovernanceError({
        code: 'INVALID_GOVERNANCE_INPUT',
        message: `Agent run '${params.runId}' not found.`,
        runId: params.runId,
        organizationId: params.organizationId,
      });
    }

    if (params.dryRun) {
      // Simulate usage accumulation in memory without committing to database (Rule 42)
      return {
        tokensUsed: run.budgetUsage.tokensUsed + params.delta.tokensUsed,
        toolCallsExecuted: run.budgetUsage.toolCallsExecuted + params.delta.toolCallsExecuted,
        durationMs: run.budgetUsage.durationMs + params.delta.durationMs,
        recordsMutated: run.budgetUsage.recordsMutated + params.delta.recordsMutated,
        financialAmount: run.budgetUsage.financialAmount + params.delta.financialAmount,
        currentDelegationDepth: run.budgetUsage.currentDelegationDepth,
      };
    }

    const updatedRun = await this.runStore.updateBudgetUsage(
      params.organizationId,
      params.runId,
      params.delta
    );

    return updatedRun.budgetUsage;
  }
}
