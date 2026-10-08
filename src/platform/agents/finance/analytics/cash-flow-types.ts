/**
 * @fileoverview Canonical Contracts, Zod v4 Schemas & Error Taxonomy for Predictive Cash Flow Analytics
 *
 * Part of Phase 12 Milestone 5: Predictive Cash Flow Cockpit & Forecasting Engine.
 *
 * Invariants Enforced:
 * 1. Rule 4: Zero `any` or `any[]` typing policy.
 * 2. Rule 10: Strict runtime validation on every system boundary using Zod v4.
 * 3. Rule 11: Cent-level mathematical determinism in liquidity projections and DSO metrics.
 * 4. Rule 48: Standardized error taxonomy mapping to HTTP status codes.
 */

import { z } from 'zod/v4';

/**
 * Open Invoice Summary for cash flow projection.
 */
export const ForecastInvoiceItemSchema = z.object({
  invoiceId: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  balanceDue: z.number().min(0),
  dueDate: z.string().min(1),
  daysOverdue: z.number().int().min(0),
});
export type ForecastInvoiceItem = z.infer<typeof ForecastInvoiceItemSchema>;

/**
 * Installment Milestone for cash flow projection.
 */
export const ForecastMilestoneItemSchema = z.object({
  milestoneId: z.string().min(1),
  amount: z.number().min(0),
  dueDate: z.string().min(1),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
});
export type ForecastMilestoneItem = z.infer<typeof ForecastMilestoneItemSchema>;

/**
 * Active Installment Plan for cash flow projection.
 */
export const ForecastInstallmentPlanSchema = z.object({
  planId: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  milestones: z.array(ForecastMilestoneItemSchema),
});
export type ForecastInstallmentPlan = z.infer<typeof ForecastInstallmentPlanSchema>;

/**
 * Active Promise to Pay for cash flow projection.
 */
export const ForecastPromiseToPaySchema = z.object({
  promiseId: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  amount: z.number().min(0),
  promiseDate: z.string().min(1),
  status: z.enum(['PENDING', 'FULFILLED', 'BROKEN', 'CANCELLED']),
});
export type ForecastPromiseToPay = z.infer<typeof ForecastPromiseToPaySchema>;

/**
 * Input contract for cash flow forecasting.
 */
export const ForecastCashFlowInputSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  cashOnHand: z.number().min(0),
  currency: z.string().min(1).default('GHS'),
  totalCreditSales90d: z.number().min(0),
  invoices: z.array(ForecastInvoiceItemSchema).default([]),
  installmentPlans: z.array(ForecastInstallmentPlanSchema).default([]),
  promisesToPay: z.array(ForecastPromiseToPaySchema).default([]),
  timeHorizonDays: z.number().int().min(1).max(365).optional().default(90),
});
export type ForecastCashFlowInput = z.infer<typeof ForecastCashFlowInputSchema>;

/**
 * Runway Projection Horizon Breakdown.
 */
export const RunwayProjectionHorizonSchema = z.object({
  horizonDays: z.number().int().min(1),
  expectedInvoiceCash: z.number().min(0),
  expectedInstallmentCash: z.number().min(0),
  expectedPromiseCash: z.number().min(0),
  totalProjectedInflow: z.number().min(0),
  projectedClosingCash: z.number().min(0),
});
export type RunwayProjectionHorizon = z.infer<typeof RunwayProjectionHorizonSchema>;

/**
 * Days Sales Outstanding (DSO) & Velocity Metrics.
 */
export const DsoMetricsSchema = z.object({
  dsoDays: z.number().min(0),
  benchmarkDays: z.number().min(0),
  velocityBand: z.enum(['FAST', 'HEALTHY', 'MODERATE', 'SLOW', 'STALLED']),
  totalReceivables: z.number().min(0),
  creditSalesPeriod: z.number().min(0),
});
export type DsoMetrics = z.infer<typeof DsoMetricsSchema>;

/**
 * Debtor Concentration Metrics.
 */
export const DebtorConcentrationSchema = z.object({
  topDebtorName: z.string().min(1),
  topDebtorExposure: z.number().min(0),
  topDebtorExposurePercent: z.number().min(0).max(100),
  top5TotalExposure: z.number().min(0),
  top5TotalExposurePercent: z.number().min(0).max(100),
  concentrationTier: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
});
export type DebtorConcentration = z.infer<typeof DebtorConcentrationSchema>;

/**
 * Cash Flow Forecast Result Schema.
 */
export const CashFlowForecastResultSchema = z.object({
  forecastId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  currency: z.string().min(1),
  currentCashOnHand: z.number().min(0),
  runwayProjections: z.object({
    '30d': RunwayProjectionHorizonSchema,
    '60d': RunwayProjectionHorizonSchema,
    '90d': RunwayProjectionHorizonSchema,
  }),
  dsoMetrics: DsoMetricsSchema,
  debtorConcentration: DebtorConcentrationSchema,
  generatedAt: z.string().datetime(),
});
export type CashFlowForecastResult = z.infer<typeof CashFlowForecastResultSchema>;

/**
 * Cash Flow Analytics Error Taxonomy (Rule 48).
 */
export const CASH_FLOW_ERROR_CODES = {
  INVALID_FORECAST_INPUT: 'INVALID_FORECAST_INPUT',
  CASH_FLOW_DEAD_MAN_PAUSED: 'CASH_FLOW_DEAD_MAN_PAUSED',
  CROSS_TENANT_ACCESS_DENIED: 'CROSS_TENANT_ACCESS_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type CashFlowErrorCode = (typeof CASH_FLOW_ERROR_CODES)[keyof typeof CASH_FLOW_ERROR_CODES];

export class CashFlowError extends Error {
  public readonly code: CashFlowErrorCode;
  public readonly httpStatus: number;

  constructor(code: CashFlowErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'CashFlowError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
