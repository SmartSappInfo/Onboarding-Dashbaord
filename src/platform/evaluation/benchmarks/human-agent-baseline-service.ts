/**
 * @fileOverview Human Baseline vs Agent Baseline Benchmarking Engine (Roadmap §16 & Phase 15 Milestone 1)
 *
 * Implements Rules 1, 4, 10, 11, 41, 44, 47, 67, 68, 69.
 * Computes deterministic, mathematical comparative metrics comparing human operator baselines
 * against autonomous agent performance:
 * - Speedup Factor: Th / Ta
 * - Error Reduction Percentage: ((Eh - Ea) / Eh) * 100%
 * - Context Consultation Breadth Factor: Ca / Ch
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  EvaluationScenario,
  EvaluationRun,
  HumanVsAgentBaseline,
  HumanVsAgentBaselineSchema,
  EPSILON_DIVISION_GUARD,
  EvaluationDomain,
} from '../contracts/evaluation-types';

export interface ComputeBaselineInput {
  readonly scenario: EvaluationScenario;
  readonly run: EvaluationRun;
  readonly agentSourcesConsulted?: number;
}

export interface DomainBaselineAggregate {
  readonly domain: EvaluationDomain;
  readonly scenarioCount: number;
  readonly avgSpeedupFactor: number;
  readonly avgErrorReductionPercentage: number;
  readonly avgContextBreadthFactor: number;
  readonly baselines: readonly HumanVsAgentBaseline[];
}

export class HumanAgentBaselineService {
  /**
   * Computes comparative baseline metrics for a single evaluation scenario run.
   */
  public computeComparison(input: ComputeBaselineInput): HumanVsAgentBaseline {
    const { scenario, run } = input;
    const hb = scenario.humanBaseline;

    // Agent time in seconds
    const agentTimeSeconds = Math.max(0.1, Math.round((run.durationMs / 1000) * 10) / 10);
    const humanTimeSeconds = hb.humanTimeSeconds;

    // Speedup factor S = Th / Ta
    const speedupRaw = humanTimeSeconds / Math.max(agentTimeSeconds, EPSILON_DIVISION_GUARD);
    const speedupFactor = Math.round(speedupRaw * 100) / 100;

    // Agent error rate: 0% if SUCCESS, 5% if DEGRADED, 100% if FAILURE
    let agentErrorRate = 0;
    if (run.status === 'FAILURE') {
      agentErrorRate = 100;
    } else if (run.status === 'DEGRADED') {
      agentErrorRate = Math.max(1, Math.round((100 - run.overallScore) * 10) / 10);
    } else {
      agentErrorRate = 0.5; // Baseline negligible trace rate
    }

    const humanErrorRate = hb.humanErrorRate;

    // Error reduction: ((Eh - Ea) / Eh) * 100%
    const errorReductionRaw =
      ((humanErrorRate - agentErrorRate) / Math.max(humanErrorRate, EPSILON_DIVISION_GUARD)) * 100;
    const errorReductionPercentage = Math.round(errorReductionRaw * 100) / 100;

    // Context breadth: Ca / Ch
    const agentSources = input.agentSourcesConsulted ?? hb.totalSourcesAvailable;
    const humanSources = hb.humanSourcesConsulted;
    const contextBreadthRaw = agentSources / Math.max(humanSources, EPSILON_DIVISION_GUARD);
    const contextBreadthFactor = Math.round(contextBreadthRaw * 100) / 100;

    return HumanVsAgentBaselineSchema.parse({
      scenarioId: scenario.id,
      domain: scenario.domain,
      humanTimeSeconds,
      agentTimeSeconds,
      speedupFactor,
      humanErrorRate,
      agentErrorRate,
      errorReductionPercentage,
      humanSourcesConsulted: humanSources,
      agentSourcesConsulted: agentSources,
      contextBreadthFactor,
    });
  }

  /**
   * Computes domain-level aggregate baseline comparisons across multiple evaluation runs.
   */
  public aggregateDomainBaselines(
    domain: EvaluationDomain,
    comparisons: readonly HumanVsAgentBaseline[]
  ): DomainBaselineAggregate {
    const domainComparisons = comparisons.filter((c) => c.domain === domain);
    const count = domainComparisons.length;

    if (count === 0) {
      return {
        domain,
        scenarioCount: 0,
        avgSpeedupFactor: 1.0,
        avgErrorReductionPercentage: 0,
        avgContextBreadthFactor: 1.0,
        baselines: [],
      };
    }

    let sumSpeedup = 0;
    let sumErrorReduction = 0;
    let sumContextBreadth = 0;

    for (const c of domainComparisons) {
      sumSpeedup += c.speedupFactor;
      sumErrorReduction += c.errorReductionPercentage;
      sumContextBreadth += c.contextBreadthFactor;
    }

    return {
      domain,
      scenarioCount: count,
      avgSpeedupFactor: Math.round((sumSpeedup / count) * 100) / 100,
      avgErrorReductionPercentage: Math.round((sumErrorReduction / count) * 100) / 100,
      avgContextBreadthFactor: Math.round((sumContextBreadth / count) * 100) / 100,
      baselines: domainComparisons,
    };
  }
}

// ============================================================================
// HMR-Safe Global Singleton Preservation (Rule 69)
// ============================================================================

declare global {
  var __smartsappHumanAgentBaselineService: HumanAgentBaselineService | undefined;
}

export function getHumanAgentBaselineService(): HumanAgentBaselineService {
  if (!globalThis.__smartsappHumanAgentBaselineService) {
    globalThis.__smartsappHumanAgentBaselineService = new HumanAgentBaselineService();
  }
  return globalThis.__smartsappHumanAgentBaselineService;
}
