/**
 * @fileoverview Pure Core Web Vitals & Real-Time Provider Latency Aggregator.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Computes average LCP, CLS, INP, and provider availability scores.
 */

import type {
  WebVitalsMetric,
  ProviderLatencyMetric,
  TelemetrySummary,
} from './types/telemetry';

/**
 * Aggregates client Web Vitals and backend provider latency measurements into health score KPIs.
 */
export function aggregateTelemetryVitals(
  metrics: WebVitalsMetric[],
  latencyMetrics: ProviderLatencyMetric[],
  workspaceId: string
): TelemetrySummary {
  let totalLcp = 0;
  let countLcp = 0;
  let totalCls = 0;
  let countCls = 0;
  let totalInp = 0;
  let countInp = 0;

  for (const m of metrics) {
    if (m.name === 'LCP') {
      totalLcp += m.value;
      countLcp++;
    } else if (m.name === 'CLS') {
      totalCls += m.value;
      countCls++;
    } else if (m.name === 'INP') {
      totalInp += m.value;
      countInp++;
    }
  }

  // Provider health calculations
  const providerStats: Record<string, { totalLatency: number; count: number; successCount: number }> = {};

  for (const p of latencyMetrics) {
    if (!providerStats[p.provider]) {
      providerStats[p.provider] = { totalLatency: 0, count: 0, successCount: 0 };
    }
    providerStats[p.provider].totalLatency += p.latencyMs;
    providerStats[p.provider].count++;
    if (p.isSuccess) {
      providerStats[p.provider].successCount++;
    }
  }

  const providerHealthScores: Record<string, { avgLatencyMs: number; uptimePercent: number }> = {};
  for (const [provider, stats] of Object.entries(providerStats)) {
    providerHealthScores[provider] = {
      avgLatencyMs: stats.count > 0 ? Math.round(stats.totalLatency / stats.count) : 0,
      uptimePercent: stats.count > 0 ? Math.round((stats.successCount / stats.count) * 100) : 100,
    };
  }

  return {
    workspaceId,
    totalEventsLogged: metrics.length + latencyMetrics.length,
    avgLcpMs: countLcp > 0 ? Math.round(totalLcp / countLcp) : 0,
    avgCls: countCls > 0 ? parseFloat((totalCls / countCls).toFixed(3)) : 0,
    avgInpMs: countInp > 0 ? Math.round(totalInp / countInp) : 0,
    providerHealthScores,
  };
}
