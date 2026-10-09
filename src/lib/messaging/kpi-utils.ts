/**
 * @fileOverview SmartSapp Messaging Dashboard — KPI Metric & Trend Formatting Utilities
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Pure, deterministic helpers for formatting tabular numbers, directional trends, and provider states.
 * - Adheres strictly to Rule 4 (Zero any/any[]).
 * - Guards against divide-by-zero, NaN, and negative anomalies (Rule 2).
 * - Conforms to MCP Protocol alignment (Rule 11) and server risk enforcement (Rule 12).
 */

import type { ProviderHealthStatus } from '@/lib/types/messaging-dashboard';

export interface TrendDeltaResult {
  formatted: string;
  isPositive: boolean;
  isNeutral: boolean;
  deltaValue: number;
}

export interface ProviderStatusDisplayResult {
  label: string;
  badgeVariant: 'emerald' | 'amber' | 'rose';
  dotColorClass: string;
}

export interface SmsBalanceStatusResult {
  isLow: boolean;
  isExhausted: boolean;
  badgeLabel?: 'Low balance' | 'Exhausted';
}

/**
 * Formats a metric count with locale-aware thousand separators.
 * Safely guards against non-finite or negative inputs.
 * 
 * @param count - Raw number value.
 * @returns Formatted string (e.g. "12,482").
 */
export function formatMetricNumber(count: number): string {
  if (!isFinite(count) || count < 0) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(Math.round(count));
}

/**
 * Formats directional percentage trend deltas with arrow indicators and sentiment classification.
 * 
 * @param delta - The numerical delta (e.g. 24 for +24%, -5.2 for -5.2%).
 * @param _isPercentagePoint - Optional hint if delta represents percentage points.
 * @returns TrendDeltaResult with formatted label and sentiment flags.
 */
export function formatTrendDelta(delta: number, _isPercentagePoint: boolean = false): TrendDeltaResult {
  if (!isFinite(delta) || Math.abs(delta) < 0.05) {
    return {
      formatted: '0%',
      isPositive: false,
      isNeutral: true,
      deltaValue: 0,
    };
  }

  const rounded = Math.abs(Math.round(delta * 10) / 10);
  const isPositive = delta > 0;
  const arrow = isPositive ? '↑' : '↓';

  return {
    formatted: `${arrow} ${rounded}%`,
    isPositive,
    isNeutral: false,
    deltaValue: delta,
  };
}

/**
 * Resolves visual indicator tokens for provider gateway health.
 * 
 * @param status - The ProviderHealthStatus enum value ('healthy' | 'degraded' | 'error').
 * @returns Display label, badge color variant, and pulsing indicator class.
 */
export function resolveProviderStatusDisplay(status: ProviderHealthStatus): ProviderStatusDisplayResult {
  switch (status) {
    case 'healthy':
      return {
        label: 'Healthy',
        badgeVariant: 'emerald',
        dotColorClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      };
    case 'degraded':
      return {
        label: 'Degraded',
        badgeVariant: 'amber',
        dotColorClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      };
    case 'error':
    default:
      return {
        label: 'Disrupted',
        badgeVariant: 'rose',
        dotColorClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
      };
  }
}

/**
 * Classifies SMS unit balance against low-balance thresholds.
 * 
 * @param balance - Remaining SMS units.
 * @param threshold - Configurable threshold for low alert (defaults to 100).
 * @returns Alert flags and badge label.
 */
export function resolveSmsBalanceStatus(balance: number, threshold: number = 100): SmsBalanceStatusResult {
  if (balance <= 0) {
    return {
      isLow: true,
      isExhausted: true,
      badgeLabel: 'Exhausted',
    };
  }
  if (balance < threshold) {
    return {
      isLow: true,
      isExhausted: false,
      badgeLabel: 'Low balance',
    };
  }
  return {
    isLow: false,
    isExhausted: false,
  };
}
