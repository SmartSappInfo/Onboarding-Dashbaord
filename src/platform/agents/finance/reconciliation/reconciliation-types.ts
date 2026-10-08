/**
 * @fileOverview Canonical Contracts, Types, and Zod v4 Schemas for Payment Reconciliation & Exception Queue (Phase 12 Milestone 3)
 *
 * Implements Rules 2, 4, 8, 10, 11, 12, 14, 16, 18, 19, 21, 22, 41, 47, 48, 67, and 69.
 * Single Source of Truth for:
 * - Bank / Gateway Settlement Payout Transactions
 * - Recorded Payment Allocations & Open Invoice Candidates
 * - 3-Way Reconciliation Match Candidates with Weighted Confidence Scoring
 * - Reconciliation Exception Items & Resolution Proposals
 * - Executive Reconciliation Metrics
 * - Structured Error Taxonomy & Bounded Error Classes
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. BANK / GATEWAY PAYOUT TRANSACTION CONTRACTS
// ============================================================================

export const PayoutGatewaySourceSchema = z.enum([
  'stripe',
  'momo_mtn',
  'momo_telecel',
  'bank_wire',
  'cash',
]);

export type PayoutGatewaySource = z.infer<typeof PayoutGatewaySourceSchema>;

export const BankPayoutTransactionSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  settlementDate: z.string().min(1),
  sourceGateway: PayoutGatewaySourceSchema,
  counterpartyName: z.string().optional(),
  counterpartyAccount: z.string().optional(),
  rawMemo: z.string().optional(),
});

export type BankPayoutTransaction = z.infer<typeof BankPayoutTransactionSchema>;

// ============================================================================
// 2. RECORDED PAYMENT & OPEN INVOICE CONTRACTS
// ============================================================================

export const RecordedPaymentStatusSchema = z.enum([
  'unallocated',
  'partially_allocated',
  'allocated',
]);

export type RecordedPaymentStatus = z.infer<typeof RecordedPaymentStatusSchema>;

export const RecordedPaymentItemSchema = z.object({
  id: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  recordedDate: z.string().min(1),
  method: z.string().min(1),
  reference: z.string().optional(),
  status: RecordedPaymentStatusSchema,
});

export type RecordedPaymentItem = z.infer<typeof RecordedPaymentItemSchema>;

export const InvoiceCandidateSchema = z.object({
  id: z.string().min(1),
  invoiceNumber: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  totalPayable: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  balanceDue: z.number().nonnegative(),
  dueDate: z.string().min(1),
  currency: z.string().length(3),
  status: z.string().min(1),
});

export type InvoiceCandidate = z.infer<typeof InvoiceCandidateSchema>;

// ============================================================================
// 3. RECONCILIATION MATCH TIERS & CONFIDENCE SCORING CONTRACTS
// ============================================================================

export const ReconciliationMatchTierSchema = z.enum([
  'EXACT_MATCH',
  'TOLERANCE_MATCH',
  'EXCEPTION_FLAGGED',
  'MANUAL_REVIEW',
]);

export type ReconciliationMatchTier = z.infer<typeof ReconciliationMatchTierSchema>;

export const ReconciliationVarianceReasonSchema = z.enum([
  'EXACT_MATCH',
  'ROUNDING_DRIFT',
  'EXCHANGE_RATE_DIFF',
  'UNIDENTIFIED_SURCHARGE',
  'REFERENCE_MISMATCH',
]);

export type ReconciliationVarianceReason = z.infer<typeof ReconciliationVarianceReasonSchema>;

export const ReconciliationSuggestedActionSchema = z.enum([
  'AUTO_RECONCILE',
  'ADJUST_VARIANCE_AND_RECONCILE',
  'ROUTE_TO_EXCEPTION_QUEUE',
  'SPLIT_ALLOCATION',
]);

export type ReconciliationSuggestedAction = z.infer<typeof ReconciliationSuggestedActionSchema>;

export const ReconciliationConfidenceScoreDetailsSchema = z.object({
  amountMatchScore: z.number().min(0).max(100),
  dateProximityScore: z.number().min(0).max(100),
  tokenMatchScore: z.number().min(0).max(100),
  entityMatchScore: z.number().min(0).max(100),
  compositeScore: z.number().min(0).max(100),
});

export type ReconciliationConfidenceScoreDetails = z.infer<
  typeof ReconciliationConfidenceScoreDetailsSchema
>;

export const ReconciliationExplainabilitySchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  expectedStateChange: z.string().min(1),
});

export type ReconciliationExplainability = z.infer<typeof ReconciliationExplainabilitySchema>;

export const ReconciliationMatchCandidateSchema = z.object({
  matchId: z.string().min(1),
  payoutId: z.string().min(1),
  paymentId: z.string().optional(),
  invoiceId: z.string().min(1),
  confidenceScore: z.number().min(0).max(100),
  confidenceScoreDetails: ReconciliationConfidenceScoreDetailsSchema,
  matchTier: ReconciliationMatchTierSchema,
  varianceAmount: z.number(),
  varianceReason: ReconciliationVarianceReasonSchema,
  suggestedAction: ReconciliationSuggestedActionSchema,
  idempotencyKey: z.string().min(1),
  explainability: ReconciliationExplainabilitySchema,
});

export type ReconciliationMatchCandidate = z.infer<typeof ReconciliationMatchCandidateSchema>;

// ============================================================================
// 4. RECONCILIATION EXCEPTION QUEUE CONTRACTS
// ============================================================================

export const ReconciliationExceptionStatusSchema = z.enum([
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'DISMISSED',
]);

export type ReconciliationExceptionStatus = z.infer<
  typeof ReconciliationExceptionStatusSchema
>;

export const ReconciliationExceptionItemSchema = z.object({
  exceptionId: z.string().min(1),
  payoutId: z.string().min(1),
  payoutReference: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  flaggedReason: z.string().min(1),
  varianceAmount: z.number(),
  confidenceScore: z.number().min(0).max(100),
  candidateInvoices: z.array(InvoiceCandidateSchema),
  assignedToPersonaId: z.string().min(1),
  createdAt: z.string().min(1),
  status: ReconciliationExceptionStatusSchema,
  rawMemo: z.string().optional(),
  resolutionNotes: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().optional(),
});

export type ReconciliationExceptionItem = z.infer<typeof ReconciliationExceptionItemSchema>;

// ============================================================================
// 5. BATCH MATCHING & RESOLUTION CONTRACTS
// ============================================================================

export const ReconciliationBatchMatchInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  payouts: z.array(BankPayoutTransactionSchema).min(1).max(50),
  invoices: z.array(InvoiceCandidateSchema).min(1).max(100),
  payments: z.array(RecordedPaymentItemSchema).max(100).optional(),
  toleranceUSD: z.number().nonnegative().optional().default(0.50),
});

export type ReconciliationBatchMatchInput = z.input<typeof ReconciliationBatchMatchInputSchema>;

export const ReconciliationBatchMatchResultSchema = z.object({
  batchId: z.string().min(1),
  totalPayoutsProcessed: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  toleranceMatchedCount: z.number().int().nonnegative(),
  exceptionCount: z.number().int().nonnegative(),
  matches: z.array(ReconciliationMatchCandidateSchema),
  exceptions: z.array(ReconciliationExceptionItemSchema),
  durationMs: z.number().nonnegative(),
});

export type ReconciliationBatchMatchResult = z.infer<typeof ReconciliationBatchMatchResultSchema>;

export const ResolveReconciliationExceptionInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  exceptionId: z.string().min(1),
  payoutId: z.string().min(1),
  selectedInvoiceId: z.string().min(1),
  action: z.enum([
    'APPROVE_MATCH',
    'ADJUST_VARIANCE_AND_MATCH',
    'DISMISS',
    'ROUTE_TO_PROPOSAL',
  ]),
  varianceAmount: z.number().default(0),
  resolutionNotes: z.string().min(3),
  payloadHash: z.string().min(1),
});

export type ResolveReconciliationExceptionInput = z.infer<
  typeof ResolveReconciliationExceptionInputSchema
>;

export const ResolveReconciliationExceptionResultSchema = z.object({
  success: z.boolean(),
  exceptionId: z.string().min(1),
  status: ReconciliationExceptionStatusSchema,
  reconciledPaymentId: z.string().optional(),
  resolvedAt: z.string().min(1),
});

export type ResolveReconciliationExceptionResult = z.infer<
  typeof ResolveReconciliationExceptionResultSchema
>;

// ============================================================================
// 6. EXECUTIVE KPI METRICS CONTRACT
// ============================================================================

export const ReconciliationMetricsSchema = z.object({
  unmatchedSettlementsCount: z.number().int().nonnegative(),
  unmatchedSettlementsAmount: z.number().nonnegative(),
  matchedTodayCount: z.number().int().nonnegative(),
  matchedTodayAmount: z.number().nonnegative(),
  flaggedDiscrepanciesCount: z.number().int().nonnegative(),
  totalNetDiscrepancyAmount: z.number(),
  currency: z.string().length(3),
});

export type ReconciliationMetrics = z.infer<typeof ReconciliationMetricsSchema>;

// ============================================================================
// 7. STRUCTURED ERROR TAXONOMY (Rule 2 & 48)
// ============================================================================

export const RECONCILIATION_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  RECONCILIATION_DEAD_MAN_PAUSED: 'RECONCILIATION_DEAD_MAN_PAUSED',
  PAYLOAD_TAMPERED: 'PAYLOAD_TAMPERED',
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',
  DISCREPANCY_EXCEEDS_TOLERANCE: 'DISCREPANCY_EXCEEDS_TOLERANCE',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  PAYOUT_NOT_FOUND: 'PAYOUT_NOT_FOUND',
  EXCEPTION_NOT_FOUND: 'EXCEPTION_NOT_FOUND',
  SIMULATION_ABORTED: 'SIMULATION_ABORTED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ReconciliationErrorCode =
  (typeof RECONCILIATION_ERROR_CODES)[keyof typeof RECONCILIATION_ERROR_CODES];

export class ReconciliationError extends Error {
  public readonly code: ReconciliationErrorCode;
  public readonly httpStatus: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: ReconciliationErrorCode,
    httpStatus: number,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReconciliationError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
  }
}
