/**
 * @fileoverview Pure Domain Service for Predictive Cash Flow Analytics & Forecasting
 *
 * Part of Phase 12 Milestone 5: Predictive Cash Flow Cockpit & Forecasting Engine.
 *
 * Invariants Enforced:
 * 1. Rule 4: Zero `any` or `any[]` typing policy.
 * 2. Rule 11: Pure cent-level mathematical rounding with zero floating-point drift.
 * 3. Rule 23: Deterministic budget execution.
 * 4. Rule 60: Emergency dead-man switch evaluated before all forecasts.
 * 5. Rule 69: HMR-safe global singleton preservation.
 */

import crypto from 'crypto';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { roundCurrency } from '@/platform/agents/finance/collections/collections-types';
import {
  type ForecastCashFlowInput,
  type CashFlowForecastResult,
  type RunwayProjectionHorizon,
  type DsoMetrics,
  type DebtorConcentration,
  CASH_FLOW_ERROR_CODES,
  CashFlowError,
} from './cash-flow-types';

export class CashFlowForecastingService {
  /**
   * Evaluates the emergency dead-man switch, failing closed if active (Rule 60).
   */
  private async checkDeadMan(organizationId?: string): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch {
      throw new CashFlowError(
        CASH_FLOW_ERROR_CODES.CASH_FLOW_DEAD_MAN_PAUSED,
        'Cash flow forecasting operations are paused by platform emergency dead-man control.',
        503
      );
    }
  }

  /**
   * Generates a 30/60/90-day predictive cash runway forecast and liquidity model (Rule 11).
   */
  public async forecastCashFlow(input: ForecastCashFlowInput): Promise<CashFlowForecastResult> {
    await this.checkDeadMan(input.organizationId);

    const nowMs = Date.now();
    const invoices = input.invoices ?? [];
    const installmentPlans = input.installmentPlans ?? [];
    const promisesToPay = input.promisesToPay ?? [];
    const totalCreditSales90d = input.totalCreditSales90d ?? 0;

    // 1. Calculate Runway Projections for 30d, 60d, 90d
    const horizons = [30, 60, 90] as const;
    const runwayMap: Record<string, RunwayProjectionHorizon> = {};

    for (const horizon of horizons) {
      const cutoffMs = nowMs + horizon * 86400000;

      // Invoices expected within horizon
      let expectedInvoiceCash = 0;
      for (const inv of invoices) {
        const dueMs = new Date(inv.dueDate).getTime();
        if (dueMs <= cutoffMs) {
          // Calibration: 0.70 baseline recovery degraded by days overdue
          const overduePenalty = Math.min(180, inv.daysOverdue) / 180;
          const prob = Math.max(0.15, 0.70 * (1 - overduePenalty));
          expectedInvoiceCash += inv.balanceDue * prob;
        }
      }
      expectedInvoiceCash = roundCurrency(expectedInvoiceCash);

      // Installment milestones expected within horizon
      let expectedInstallmentCash = 0;
      for (const plan of installmentPlans) {
        for (const ms of plan.milestones) {
          if (ms.status === 'PENDING') {
            const dueMs = new Date(ms.dueDate).getTime();
            if (dueMs <= cutoffMs) {
              expectedInstallmentCash += ms.amount * 0.85; // 85% probability on structured plans
            }
          }
        }
      }
      expectedInstallmentCash = roundCurrency(expectedInstallmentCash);

      // Promises to pay expected within horizon
      let expectedPromiseCash = 0;
      for (const prom of promisesToPay) {
        if (prom.status === 'PENDING') {
          const promMs = new Date(prom.promiseDate).getTime();
          if (promMs <= cutoffMs) {
            expectedPromiseCash += prom.amount * 0.65; // 65% probability on promises
          }
        }
      }
      expectedPromiseCash = roundCurrency(expectedPromiseCash);

      const totalProjectedInflow = roundCurrency(
        expectedInvoiceCash + expectedInstallmentCash + expectedPromiseCash
      );
      const projectedClosingCash = roundCurrency((input.cashOnHand ?? 0) + totalProjectedInflow);

      runwayMap[`${horizon}d`] = {
        horizonDays: horizon,
        expectedInvoiceCash,
        expectedInstallmentCash,
        expectedPromiseCash,
        totalProjectedInflow,
        projectedClosingCash,
      };
    }

    // 2. Days Sales Outstanding (DSO) Calculation
    const totalReceivables = roundCurrency(
      invoices.reduce((sum, inv) => sum + inv.balanceDue, 0)
    );

    let dsoDays = 0;
    let velocityBand: DsoMetrics['velocityBand'] = 'STALLED';

    if (totalCreditSales90d > 0) {
      dsoDays = Math.round((totalReceivables / totalCreditSales90d) * 90);
      if (dsoDays <= 30) velocityBand = 'FAST';
      else if (dsoDays <= 45) velocityBand = 'HEALTHY';
      else if (dsoDays <= 60) velocityBand = 'MODERATE';
      else if (dsoDays <= 90) velocityBand = 'SLOW';
      else velocityBand = 'STALLED';
    }

    const dsoMetrics: DsoMetrics = {
      dsoDays,
      benchmarkDays: 45,
      velocityBand,
      totalReceivables,
      creditSalesPeriod: totalCreditSales90d,
    };

    // 3. Debtor Concentration Analysis
    const debtorBalances = new Map<string, { name: string; balance: number }>();
    for (const inv of invoices) {
      const existing = debtorBalances.get(inv.entityId) ?? { name: inv.entityName, balance: 0 };
      existing.balance = roundCurrency(existing.balance + inv.balanceDue);
      debtorBalances.set(inv.entityId, existing);
    }

    const sortedDebtors = Array.from(debtorBalances.values()).sort((a, b) => b.balance - a.balance);

    const topDebtor = sortedDebtors[0] ?? { name: 'None', balance: 0 };
    const topDebtorExposurePercent = totalReceivables > 0
      ? Math.round((topDebtor.balance / totalReceivables) * 100)
      : 0;

    const top5Total = roundCurrency(
      sortedDebtors.slice(0, 5).reduce((sum, d) => sum + d.balance, 0)
    );
    const top5TotalExposurePercent = totalReceivables > 0
      ? Math.round((top5Total / totalReceivables) * 100)
      : 0;

    let concentrationTier: DebtorConcentration['concentrationTier'] = 'LOW';
    if (topDebtorExposurePercent >= 50) concentrationTier = 'CRITICAL';
    else if (topDebtorExposurePercent >= 40) concentrationTier = 'HIGH';
    else if (topDebtorExposurePercent >= 20) concentrationTier = 'MODERATE';

    const debtorConcentration: DebtorConcentration = {
      topDebtorName: topDebtor.name,
      topDebtorExposure: topDebtor.balance,
      topDebtorExposurePercent,
      top5TotalExposure: top5Total,
      top5TotalExposurePercent,
      concentrationTier,
    };

    return {
      forecastId: `fcast_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      currency: input.currency,
      currentCashOnHand: input.cashOnHand,
      runwayProjections: {
        '30d': runwayMap['30d'],
        '60d': runwayMap['60d'],
        '90d': runwayMap['90d'],
      },
      dsoMetrics,
      debtorConcentration,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ── Global Singleton Preservation (Rule 69) ──────────────────────────────────
declare global {
  var __smartsappCashFlowForecastingService: CashFlowForecastingService | undefined;
}

export function getCashFlowForecastingService(): CashFlowForecastingService {
  if (!globalThis.__smartsappCashFlowForecastingService) {
    globalThis.__smartsappCashFlowForecastingService = new CashFlowForecastingService();
  }
  return globalThis.__smartsappCashFlowForecastingService;
}
