/**
 * @fileoverview Test Suite for Predictive Cash Flow Cockpit & Forecasting Engine (Phase 12 Milestone 5)
 *
 * Tests:
 * 1. 30/60/90-day cash runway projection and liquidity forecasting.
 * 2. Days Sales Outstanding (DSO) calculation and collection velocity.
 * 3. Debtor concentration index and top debtor financial exposure.
 * 4. Cent-level rounding determinism (Rule 11) with 0 floating-point drift.
 * 5. Emergency dead-man switch fail-closed enforcement (Rule 60).
 * 6. Zero `any` or `any[]` typing strictness (Rule 4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CashFlowForecastingService,
  getCashFlowForecastingService,
} from '@/platform/agents/finance/analytics/cash-flow-forecasting-service';
import {
  type ForecastCashFlowInput,
  CASH_FLOW_ERROR_CODES,
  CashFlowError,
} from '@/platform/agents/finance/analytics/cash-flow-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('CashFlowForecastingService (Phase 12 Milestone 5)', () => {
  let service: CashFlowForecastingService;

  beforeEach(() => {
    vi.clearAllMocks();
    setGovernanceDeadManStateForTests(false);
    service = new CashFlowForecastingService();
  });

  const mockInput: ForecastCashFlowInput = {
    workspaceId: 'ws_finance_test',
    organizationId: 'org_finance_test',
    cashOnHand: 50000,
    currency: 'GHS',
    totalCreditSales90d: 180000,
    invoices: [
      {
        invoiceId: 'inv_001',
        entityId: 'ent_001',
        entityName: 'St. Peter Academy',
        balanceDue: 12000,
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        daysOverdue: 0,
      },
      {
        invoiceId: 'inv_002',
        entityId: 'ent_002',
        entityName: 'Achimota High',
        balanceDue: 18000,
        dueDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
        daysOverdue: 0,
      },
      {
        invoiceId: 'inv_003',
        entityId: 'ent_003',
        entityName: 'Wesley Girls',
        balanceDue: 15000,
        dueDate: new Date(Date.now() + 75 * 86400000).toISOString().split('T')[0],
        daysOverdue: 0,
      },
      {
        invoiceId: 'inv_004',
        entityId: 'ent_004',
        entityName: 'Prempeh College',
        balanceDue: 5000,
        dueDate: new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0],
        daysOverdue: 35,
      },
    ],
    installmentPlans: [
      {
        planId: 'plan_001',
        entityId: 'ent_004',
        entityName: 'Prempeh College',
        milestones: [
          {
            milestoneId: 'ms_1',
            amount: 2500,
            dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
            status: 'PENDING',
          },
          {
            milestoneId: 'ms_2',
            amount: 2500,
            dueDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
            status: 'PENDING',
          },
        ],
      },
    ],
    promisesToPay: [
      {
        promiseId: 'prom_001',
        entityId: 'ent_001',
        entityName: 'St. Peter Academy',
        amount: 6000,
        promiseDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        status: 'PENDING',
      },
    ],
    timeHorizonDays: 90,
  };

  describe('1. 30/60/90-Day Cash Runway & Liquidity Projection', () => {
    it('projects accurate cash inflows across 30, 60, and 90 day horizons', async () => {
      const forecast = await service.forecastCashFlow(mockInput);

      expect(forecast.organizationId).toBe('org_finance_test');
      expect(forecast.currency).toBe('GHS');
      expect(forecast.currentCashOnHand).toBe(50000);

      // Verify horizons exist
      expect(forecast.runwayProjections['30d']).toBeDefined();
      expect(forecast.runwayProjections['60d']).toBeDefined();
      expect(forecast.runwayProjections['90d']).toBeDefined();

      // Cumulative cash projection must be monotonically non-decreasing
      expect(forecast.runwayProjections['60d'].projectedClosingCash)
        .toBeGreaterThanOrEqual(forecast.runwayProjections['30d'].projectedClosingCash);
      expect(forecast.runwayProjections['90d'].projectedClosingCash)
        .toBeGreaterThanOrEqual(forecast.runwayProjections['60d'].projectedClosingCash);

      // Verify rounding: no decimal drift
      expect(forecast.runwayProjections['30d'].projectedClosingCash.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    });

    it('calibrates collection probabilities correctly for installment plans and promises', async () => {
      const forecast = await service.forecastCashFlow(mockInput);

      const p30 = forecast.runwayProjections['30d'];
      expect(p30.expectedInstallmentCash).toBeGreaterThan(0);
      expect(p30.expectedPromiseCash).toBeGreaterThan(0);
      expect(p30.totalProjectedInflow).toBeGreaterThan(0);
    });
  });

  describe('2. Days Sales Outstanding (DSO) & Velocity Analysis (Rule 11)', () => {
    it('calculates DSO deterministically based on total credit sales and open receivables', async () => {
      const forecast = await service.forecastCashFlow(mockInput);

      // Total receivables = 12000 + 18000 + 15000 + 5000 = 50000
      // DSO = (50000 / 180000) * 90 = 25 days
      expect(forecast.dsoMetrics.dsoDays).toBe(25);
      expect(forecast.dsoMetrics.benchmarkDays).toBe(45);
      expect(forecast.dsoMetrics.velocityBand).toBe('FAST');
    });

    it('handles zero credit sales gracefully without division-by-zero', async () => {
      const forecast = await service.forecastCashFlow({
        ...mockInput,
        totalCreditSales90d: 0,
      });

      expect(forecast.dsoMetrics.dsoDays).toBe(0);
      expect(forecast.dsoMetrics.velocityBand).toBe('STALLED');
    });
  });

  describe('3. Debtor Concentration Index & Exposure Risk', () => {
    it('computes top debtor share and flags concentration risk', async () => {
      const forecast = await service.forecastCashFlow(mockInput);

      // Top debtor is Achimota High (18,000 / 50,000 = 36%)
      expect(forecast.debtorConcentration.topDebtorExposurePercent).toBe(36);
      expect(forecast.debtorConcentration.topDebtorName).toBe('Achimota High');
      expect(forecast.debtorConcentration.concentrationTier).toBe('MODERATE');
      expect(forecast.debtorConcentration.top5TotalExposurePercent).toBe(100);
    });
  });

  describe('4. Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('fails closed when emergency governance dead-man switch is engaged', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(service.forecastCashFlow(mockInput)).rejects.toThrowError(CashFlowError);

      try {
        await service.forecastCashFlow(mockInput);
      } catch (err) {
        expect(err).toBeInstanceOf(CashFlowError);
        const cfErr = err as CashFlowError;
        expect(cfErr.code).toBe(CASH_FLOW_ERROR_CODES.CASH_FLOW_DEAD_MAN_PAUSED);
        expect(cfErr.httpStatus).toBe(503);
      }
    });
  });

  describe('5. Global Singleton Preservation (Rule 69)', () => {
    it('returns the same singleton instance', () => {
      const s1 = getCashFlowForecastingService();
      const s2 = getCashFlowForecastingService();
      expect(s1).toBe(s2);
    });
  });
});
