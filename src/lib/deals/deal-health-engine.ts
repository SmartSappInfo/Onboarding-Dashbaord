/**
 * @fileoverview Deals Platform 2.0 Health, Velocity & Forecast Calculation Engine
 *
 * ARCHITECTURAL POINTER (Deterministic Health & Velocity Engine):
 * Provides pure, memoizable functions for calculating:
 * - Days in stage & SLA compliance
 * - Deterministic Deal Health Status ('healthy' | 'at_risk' | 'stalled' | 'closed')
 * - Weighted Deal Value & Pipeline Forecasting
 * - Line Item totals (subtotal, discounts, tax, grand total)
 * - Executive Overview KPIs
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Keep calculations O(1) per deal and O(N) over deal arrays.
 * - Never perform database side effects inside these pure calculators.
 * - Strict typing with zero 'any' or 'any[]'.
 *
 * TESTABILITY POINTER:
 * Tested in `src/lib/deals/__tests__/deal-health-engine.test.ts`.
 */

import type { Deal, DealStage, DealLineItem, DealHealthStatus, DealsOverviewMetrics } from './deal-types';

/**
 * Helper to safely extract milliseconds timestamp from strings, Dates, or Firestore Timestamps.
 */
export function extractTimestampMs(value?: unknown): number {
  if (!value) return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return isNaN(parsed) ? NaN : parsed;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return isNaN(time) ? NaN : time;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof obj.toDate === 'function') {
      try {
        const d = obj.toDate();
        return d instanceof Date ? d.getTime() : NaN;
      } catch {
        return NaN;
      }
    }
    if (typeof obj.seconds === 'number' && Number.isFinite(obj.seconds)) {
      return obj.seconds * 1000;
    }
    if (typeof obj._seconds === 'number' && Number.isFinite(obj._seconds)) {
      return obj._seconds * 1000;
    }
  }
  return NaN;
}

/**
 * Calculates number of calendar days a deal has spent in its current stage.
 */
export function calculateDaysInStage(
  stageEnteredAt?: unknown,
  createdAt?: unknown,
  now: Date = new Date()
): number {
  const referenceTime = extractTimestampMs(stageEnteredAt) || extractTimestampMs(createdAt);
  if (!referenceTime || isNaN(referenceTime)) return 0;

  const nowMs = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const diffMs = Math.max(0, nowMs - referenceTime);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Deterministically evaluates deal health based on stage SLA, activity recency, and close date.
 */
export function calculateDealHealth(
  deal?: Deal | null,
  stage?: DealStage | null,
  lastActivityDate?: unknown,
  now: Date = new Date()
): {
  status: DealHealthStatus;
  reason: string;
  isSlaBreached: boolean;
  daysInStage: number;
} {
  if (!deal) {
    return {
      status: 'healthy',
      reason: 'No deal specified',
      isSlaBreached: false,
      daysInStage: 0,
    };
  }

  if (deal.status === 'won' || deal.status === 'lost') {
    return {
      status: 'closed',
      reason: deal.status === 'won' ? 'Closed Won' : (deal.lostReason || 'Closed Lost'),
      isSlaBreached: false,
      daysInStage: 0,
    };
  }

  const nowMs = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const daysInStage = calculateDaysInStage(deal.stageEnteredAt, deal.createdAt, now);
  const slaDays = typeof stage?.slaDays === 'number' && Number.isFinite(stage.slaDays) ? stage.slaDays : undefined;

  // 1. Check for Severe SLA Stagnation (> 2x SLA or > 21 days with no SLA)
  if (slaDays && daysInStage > slaDays * 2) {
    return {
      status: 'stalled',
      reason: `Stalled in stage for ${daysInStage} days (SLA: ${slaDays} days)`,
      isSlaBreached: true,
      daysInStage,
    };
  }

  // 2. Check for Stage SLA Breach
  if (slaDays && daysInStage > slaDays) {
    return {
      status: 'at_risk',
      reason: `Exceeded stage SLA by ${daysInStage - slaDays} days`,
      isSlaBreached: true,
      daysInStage,
    };
  }

  // 3. Check for Inactivity Stagnation (> 14 days without activity)
  const activityTime = extractTimestampMs(lastActivityDate);
  if (!isNaN(activityTime)) {
    const daysSinceActivity = Math.floor((nowMs - activityTime) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity >= 14) {
      return {
        status: 'stalled',
        reason: `No activity recorded for ${daysSinceActivity} days`,
        isSlaBreached: false,
        daysInStage,
      };
    }
  }

  // 4. Check for Past Expected Close Date
  const closeTime = extractTimestampMs(deal.expectedCloseDate);
  if (!isNaN(closeTime) && closeTime < nowMs) {
    return {
      status: 'at_risk',
      reason: 'Target close date is in the past',
      isSlaBreached: false,
      daysInStage,
    };
  }

  return {
    status: 'healthy',
    reason: 'On track within stage SLA',
    isSlaBreached: false,
    daysInStage,
  };
}

/**
 * Calculates weighted value for a deal based on its probability percentage.
 */
export function calculateWeightedValue(value: number, probability?: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const prob = typeof probability === 'number' && Number.isFinite(probability) ? Math.min(100, Math.max(0, probability)) : 50;
  return Math.round(value * (prob / 100));
}

/**
 * Computes subtotal, discounts, taxes, grand total, and normalized recurring revenue
 * projections (MRR, ARR, ACV, TCV, One-Time vs Recurring) across deal line items (Phase 4).
 */
export function calculateLineItemsTotals(
  items: DealLineItem[] = [],
  contractTermMonths: number = 12
): {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  mrr: number;
  arr: number;
  oneTimeValue: number;
  recurringValue: number;
  acv: number;
  tcv: number;
  contractTermMonths: number;
} {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let mrr = 0;
  let oneTimeValue = 0;
  let recurringValue = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity || 1);
    const price = Math.max(0, item.unitPrice || 0);
    const itemSubtotal = qty * price;
    subtotal += itemSubtotal;

    let discountAmount = Math.max(0, item.discount || 0);
    if (item.discountPercent && item.discountPercent > 0) {
      discountAmount += (itemSubtotal * Math.min(100, item.discountPercent)) / 100;
    }
    totalDiscount += discountAmount;

    const taxableAmount = Math.max(0, itemSubtotal - discountAmount);
    const taxRate = Math.max(0, item.taxRate || 0);
    const taxAmount = (taxableAmount * taxRate) / 100;
    totalTax += taxAmount;

    const itemTotal = Math.max(0, taxableAmount + taxAmount);

    const isRecurring = item.isRecurring === true || (item.billingInterval && item.billingInterval !== 'one_time');

    if (isRecurring) {
      recurringValue += itemTotal;
      if (item.billingInterval === 'quarterly') {
        mrr += itemTotal / 3;
      } else if (item.billingInterval === 'annual') {
        mrr += itemTotal / 12;
      } else {
        // Default monthly
        mrr += itemTotal;
      }
    } else {
      oneTimeValue += itemTotal;
    }
  }

  const grandTotal = Math.max(0, Math.round((subtotal - totalDiscount + totalTax) * 100) / 100);
  const normalizedMrr = Math.round(mrr * 100) / 100;
  const normalizedArr = Math.round(normalizedMrr * 12 * 100) / 100;
  const rawMonths = typeof contractTermMonths === 'number' && !Number.isNaN(contractTermMonths) ? contractTermMonths : 12;
  const normalizedTermMonths = Math.max(1, Math.floor(rawMonths));
  const normalizedTermYears = Math.max(1, Math.ceil(normalizedTermMonths / 12));
  const normalizedOneTime = Math.round(oneTimeValue * 100) / 100;
  const normalizedRecurring = Math.round(recurringValue * 100) / 100;

  const tcv = Math.round((normalizedOneTime + (normalizedMrr * normalizedTermMonths)) * 100) / 100;
  const acv = Math.round((normalizedArr + (normalizedOneTime / normalizedTermYears)) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal,
    mrr: normalizedMrr,
    arr: normalizedArr,
    oneTimeValue: normalizedOneTime,
    recurringValue: normalizedRecurring,
    acv,
    tcv,
    contractTermMonths: normalizedTermMonths,
  };
}

/**
 * Calculates high-level aggregate KPI metrics for the Deals Command Center.
 */
export function calculateDealsOverviewMetrics(
  deals: Deal[] = [],
  stages: DealStage[] = [],
  now: Date = new Date()
): DealsOverviewMetrics {
  let totalPipelineValue = 0;
  let totalWeightedValue = 0;
  let totalWonValue = 0;
  let totalActiveDeals = 0;
  let wonCount = 0;
  let closedCount = 0;
  let healthyDealsCount = 0;
  let atRiskDealsCount = 0;
  let stalledDealsCount = 0;
  let closingThisWeekCount = 0;
  let slaBreachedCount = 0;
  let noNextStepCount = 0;

  const stageMap = new Map<string, DealStage>();
  if (Array.isArray(stages)) {
    stages.forEach(s => {
      if (s && s.id) stageMap.set(s.id, s);
    });
  }

  const nowMs = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const oneWeekFromNow = nowMs + 7 * 24 * 60 * 60 * 1000;

  if (Array.isArray(deals)) {
    for (const deal of deals) {
      if (!deal) continue;
      const stage = deal.stageId ? stageMap.get(deal.stageId) : undefined;
      const val = typeof deal.value === 'number' && Number.isFinite(deal.value) ? Math.max(0, deal.value) : 0;

      if (deal.status === 'won') {
        totalWonValue += val;
        wonCount++;
        closedCount++;
      } else if (deal.status === 'lost') {
        closedCount++;
      } else {
        // Active Deal
        totalActiveDeals++;
        totalPipelineValue += val;
        
        const prob = typeof deal.probability === 'number' && Number.isFinite(deal.probability) 
          ? deal.probability 
          : (typeof stage?.probability === 'number' && Number.isFinite(stage.probability) ? stage.probability : 50);
        totalWeightedValue += calculateWeightedValue(val, prob);

        const health = calculateDealHealth(deal, stage, deal.updatedAt, now);
        if (health.status === 'healthy') healthyDealsCount++;
        else if (health.status === 'at_risk') atRiskDealsCount++;
        else if (health.status === 'stalled') stalledDealsCount++;

        if (health.isSlaBreached) slaBreachedCount++;

        const hasNextStep = typeof deal.nextStep === 'string'
          ? deal.nextStep.trim().length > 0
          : Boolean(
              deal.nextStep && 
              typeof deal.nextStep === 'object' && 
              !deal.nextStep.isCompleted && 
              typeof deal.nextStep.title === 'string' && 
              deal.nextStep.title.trim().length > 0
            );

        if (!hasNextStep) {
          noNextStepCount++;
        }

        const closeTime = extractTimestampMs(deal.expectedCloseDate);
        if (!isNaN(closeTime) && closeTime >= nowMs && closeTime <= oneWeekFromNow) {
          closingThisWeekCount++;
        }
      }
    }
  }

  const winRatePercentage = closedCount > 0 ? Math.round((wonCount / closedCount) * 100 * 10) / 10 : 0;
  const avgDealSize = totalActiveDeals > 0 ? Math.round(totalPipelineValue / totalActiveDeals) : 0;

  return {
    totalPipelineValue: Math.round(totalPipelineValue * 100) / 100,
    totalWeightedValue: Math.round(totalWeightedValue * 100) / 100,
    totalWonValue: Math.round(totalWonValue * 100) / 100,
    totalActiveDeals,
    winRatePercentage,
    avgDealSize,
    healthyDealsCount,
    atRiskDealsCount,
    stalledDealsCount,
    closingThisWeekCount,
    slaBreachedCount,
    noNextStepCount,
  };
}
