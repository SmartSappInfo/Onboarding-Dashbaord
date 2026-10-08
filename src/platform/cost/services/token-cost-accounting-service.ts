/**
 * @fileOverview Token Cost Accounting Service (Phase 15 Milestone 2)
 *
 * Implements Rules 4, 8, 11, 23, 40, 48, 57, 58, 60, 67, 68, 69.
 * Tracks, aggregates, and reports token usage across personas, workspaces, models,
 * and providers using exact integer micro-USD arithmetic ($1 = 1,000,000 micro-USD).
 *
 * Emits `cost.usage.recorded` domain event to `defaultEventBus` for reactive accounting.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  TokenUsageRecord,
  CostAccountingMetrics,
  TokenUsageRecordSchema,
  CostAccountingMetricsSchema,
  ModelProvider,
  ModelTier,
} from '@/platform/cost/contracts/cost-types';
import { computeExecutionCostMicroUSD } from './model-pricing-registry';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { defaultEventBus } from '@/platform/events/event-bus';

export interface RecordUsageInput {
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly personaId: string;
  readonly executionId: string;
  readonly modelId: string;
  readonly provider: ModelProvider;
  readonly tier: ModelTier;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedPromptTokens?: number;
  readonly costMicroUSD?: number;
  readonly metadata?: Record<string, string>;
}

export interface MetricsQueryOptions {
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly personaId?: string;
}

export class TokenCostAccountingService {
  private readonly usageRecords: TokenUsageRecord[] = [];

  /**
   * Records a token usage record, calculating exact integer micro-USD if not supplied.
   * Emits `cost.usage.recorded` domain event.
   */
  public async recordUsage(input: RecordUsageInput): Promise<TokenUsageRecord> {
    const cachedTokens = input.cachedPromptTokens ?? 0;
    const computedCost =
      input.costMicroUSD !== undefined
        ? input.costMicroUSD
        : computeExecutionCostMicroUSD(
            input.modelId,
            input.promptTokens,
            input.completionTokens,
            cachedTokens
          );

    const recordId = `usage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const recordedAt = new Date().toISOString();

    const record: TokenUsageRecord = TokenUsageRecordSchema.parse({
      id: recordId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      personaId: input.personaId,
      executionId: input.executionId,
      modelId: input.modelId,
      provider: input.provider,
      tier: input.tier,
      promptTokens: Math.max(0, Math.floor(input.promptTokens)),
      completionTokens: Math.max(0, Math.floor(input.completionTokens)),
      cachedPromptTokens: Math.max(0, Math.floor(cachedTokens)),
      costMicroUSD: Math.max(0, Math.round(computedCost)),
      recordedAt,
      metadata: input.metadata,
    });

    this.usageRecords.push(record);

    // Emit domain event for real-time reactivity and audit trail (Rule 40)
    const event = createDomainEvent({
      type: 'cost.usage.recorded',
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      actor: {
        type: 'agent',
        id: record.personaId,
      },
      entity: {
        type: 'token_usage',
        id: record.id,
      },
      correlationId: record.executionId,
      source: 'cost.accounting_service',
      payload: {
        modelId: record.modelId,
        provider: record.provider,
        tier: record.tier,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        cachedPromptTokens: record.cachedPromptTokens,
        costMicroUSD: record.costMicroUSD,
        recordedAt: record.recordedAt,
      },
    });

    try {
      await defaultEventBus.publish(event);
    } catch {
      // Non-fatal event dispatch failure should not block core accounting
    }

    return record;
  }

  /**
   * Aggregates usage metrics for a workspace within an optional time window.
   */
  public async getMetrics(
    organizationId: string,
    workspaceId: string,
    options?: MetricsQueryOptions
  ): Promise<CostAccountingMetrics> {
    const periodStart = options?.periodStart ?? new Date(0).toISOString();
    const periodEnd = options?.periodEnd ?? new Date().toISOString();

    const startTime = new Date(periodStart).getTime();
    const endTime = new Date(periodEnd).getTime();

    const filtered = this.usageRecords.filter((r) => {
      if (r.organizationId !== organizationId || r.workspaceId !== workspaceId) {
        return false;
      }
      if (options?.personaId && r.personaId !== options.personaId) {
        return false;
      }
      const recordTime = new Date(r.recordedAt).getTime();
      return recordTime >= startTime && recordTime <= endTime;
    });

    let totalCostMicroUSD = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCachedPromptTokens = 0;

    const costByProvider: Record<string, number> = {
      anthropic: 0,
      openai: 0,
      google: 0,
      deepseek: 0,
    };

    const costByTier: Record<string, number> = {
      TIER_1_LOW_COST: 0,
      TIER_2_GENERAL_REASONING: 0,
      TIER_3_HIGH_END: 0,
    };

    const costByPersona: Record<string, number> = {};

    for (const r of filtered) {
      totalCostMicroUSD += r.costMicroUSD;
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      totalCachedPromptTokens += r.cachedPromptTokens;

      costByProvider[r.provider] = (costByProvider[r.provider] ?? 0) + r.costMicroUSD;
      costByTier[r.tier] = (costByTier[r.tier] ?? 0) + r.costMicroUSD;
      costByPersona[r.personaId] = (costByPersona[r.personaId] ?? 0) + r.costMicroUSD;
    }

    return CostAccountingMetricsSchema.parse({
      organizationId,
      workspaceId,
      periodStart,
      periodEnd,
      totalCostMicroUSD,
      totalPromptTokens,
      totalCompletionTokens,
      totalCachedPromptTokens,
      costByProvider,
      costByTier,
      costByPersona,
      totalRequests: filtered.length,
    });
  }

  /**
   * Computes total spend in micro-USD for a workspace from periodStart to now.
   */
  public async getWorkspaceTotalSpendMicroUSD(
    organizationId: string,
    workspaceId: string,
    periodStart?: string
  ): Promise<number> {
    const metrics = await this.getMetrics(organizationId, workspaceId, { periodStart });
    return metrics.totalCostMicroUSD;
  }

  /**
   * Testing helper to reset in-memory records.
   */
  public resetForTesting(): void {
    this.usageRecords.length = 0;
  }
}

// Global HMR singleton preservation (Rule 69)
declare global {
  var __smartsappTokenCostAccountingService: TokenCostAccountingService | undefined;
}

export function getTokenCostAccountingService(): TokenCostAccountingService {
  if (!globalThis.__smartsappTokenCostAccountingService) {
    globalThis.__smartsappTokenCostAccountingService = new TokenCostAccountingService();
  }
  return globalThis.__smartsappTokenCostAccountingService;
}
