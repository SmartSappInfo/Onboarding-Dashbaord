/**
 * @fileOverview Unit tests for SmartSapp Messaging Dashboard — KPI Metric & Trend Formatting Utilities
 * 
 * Conforms to:
 * - Rule 1 (Best Practices & Clean Testability)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 2 (Guarded edge cases: divide-by-zero, negative numbers, NaN, non-finite values)
 */

import { describe, it, expect } from 'vitest';
import {
  formatMetricNumber,
  formatTrendDelta,
  resolveProviderStatusDisplay,
  resolveSmsBalanceStatus,
} from '../kpi-utils';

describe('kpi-utils', () => {
  describe('formatMetricNumber', () => {
    it('formats numbers with standard thousand separators', () => {
      expect(formatMetricNumber(12482)).toBe('12,482');
      expect(formatMetricNumber(941)).toBe('941');
      expect(formatMetricNumber(0)).toBe('0');
      expect(formatMetricNumber(1000000)).toBe('1,000,000');
    });

    it('safely handles non-finite or negative numbers', () => {
      expect(formatMetricNumber(NaN)).toBe('0');
      expect(formatMetricNumber(Infinity)).toBe('0');
      expect(formatMetricNumber(-Infinity)).toBe('0');
      expect(formatMetricNumber(-5)).toBe('0');
    });

    it('rounds floating point quantities cleanly to nearest integer', () => {
      expect(formatMetricNumber(12482.4)).toBe('12,482');
      expect(formatMetricNumber(12482.6)).toBe('12,483');
    });
  });

  describe('formatTrendDelta', () => {
    it('formats positive deltas with up arrow and emerald sentiment', () => {
      const res = formatTrendDelta(24);
      expect(res.formatted).toBe('↑ 24%');
      expect(res.isPositive).toBe(true);
      expect(res.isNeutral).toBe(false);
      expect(res.deltaValue).toBe(24);
    });

    it('formats negative deltas with down arrow and rose sentiment', () => {
      const res = formatTrendDelta(-5.2);
      expect(res.formatted).toBe('↓ 5.2%');
      expect(res.isPositive).toBe(false);
      expect(res.isNeutral).toBe(false);
      expect(res.deltaValue).toBe(-5.2);
    });

    it('formats zero or negligible delta as neutral', () => {
      const zeroRes = formatTrendDelta(0);
      expect(zeroRes.formatted).toBe('0%');
      expect(zeroRes.isNeutral).toBe(true);
      expect(zeroRes.isPositive).toBe(false);

      const tinyRes = formatTrendDelta(0.02);
      expect(tinyRes.formatted).toBe('0%');
      expect(tinyRes.isNeutral).toBe(true);
    });

    it('safely handles non-finite numbers without throwing', () => {
      const nanRes = formatTrendDelta(NaN);
      expect(nanRes.formatted).toBe('0%');
      expect(nanRes.isNeutral).toBe(true);

      const infRes = formatTrendDelta(Infinity);
      expect(infRes.formatted).toBe('0%');
      expect(infRes.isNeutral).toBe(true);
    });

    it('supports percentage point formatting for rates', () => {
      const res = formatTrendDelta(1.2, true);
      expect(res.formatted).toBe('↑ 1.2%');
      expect(res.isPositive).toBe(true);
    });
  });

  describe('resolveProviderStatusDisplay', () => {
    it('maps healthy status to green indicators', () => {
      const res = resolveProviderStatusDisplay('healthy');
      expect(res.label).toBe('Healthy');
      expect(res.badgeVariant).toBe('emerald');
      expect(res.dotColorClass).toContain('bg-emerald-500');
    });

    it('maps degraded status to amber indicators', () => {
      const res = resolveProviderStatusDisplay('degraded');
      expect(res.label).toBe('Degraded');
      expect(res.badgeVariant).toBe('amber');
      expect(res.dotColorClass).toContain('bg-amber-500');
    });

    it('maps error status to rose indicators', () => {
      const res = resolveProviderStatusDisplay('error');
      expect(res.label).toBe('Disrupted');
      expect(res.badgeVariant).toBe('rose');
      expect(res.dotColorClass).toContain('bg-rose-500');
    });
  });

  describe('resolveSmsBalanceStatus', () => {
    it('returns healthy status when balance exceeds threshold', () => {
      const res = resolveSmsBalanceStatus(941, 100);
      expect(res.isLow).toBe(false);
      expect(res.isExhausted).toBe(false);
      expect(res.badgeLabel).toBeUndefined();
    });

    it('flags low balance when below threshold', () => {
      const res = resolveSmsBalanceStatus(45, 100);
      expect(res.isLow).toBe(true);
      expect(res.isExhausted).toBe(false);
      expect(res.badgeLabel).toBe('Low balance');
    });

    it('flags exhausted balance when zero or negative', () => {
      const resZero = resolveSmsBalanceStatus(0, 100);
      expect(resZero.isLow).toBe(true);
      expect(resZero.isExhausted).toBe(true);
      expect(resZero.badgeLabel).toBe('Exhausted');

      const resNeg = resolveSmsBalanceStatus(-10, 100);
      expect(resNeg.isLow).toBe(true);
      expect(resNeg.isExhausted).toBe(true);
      expect(resNeg.badgeLabel).toBe('Exhausted');
    });

    it('uses default threshold of 100 when omitted', () => {
      const healthy = resolveSmsBalanceStatus(150);
      expect(healthy.isLow).toBe(false);

      const low = resolveSmsBalanceStatus(50);
      expect(low.isLow).toBe(true);
      expect(low.badgeLabel).toBe('Low balance');
    });
  });
});
