/**
 * @fileOverview Canonical Finance Context Contracts, Types & Error Taxonomy (Phase 12 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Lock)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 12 (5-tier risk taxonomy classification)
 * - Rule 13 & 30 (Untrusted Reference Data XML containerization)
 * - Rule 28 & 56 (Stratified greedy Knapsack context budgeting <= 4,000 tokens)
 * - Rule 32 & 33 (Sensitive financial data and credential redaction)
 * - Rule 60 (Emergency Dead-Man Switch Error Taxonomy)
 * - Rule 69 (Governed Capability Layer & Strangler Fig Invariant)
 * - .agents/AGENTS.md (Fields & Variables SSOT via FieldsVariablesService, TagSelector SSOT)
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. Account Financial Summary Schema
// ============================================================================

export const AccountFinanceSummarySchema = z.object({
  accountId: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  currency: z.string().default('GHS'),
  totalInvoiced: z.number().nonnegative(),
  totalPaid: z.number().nonnegative(),
  totalOutstanding: z.number(),
  availableCredit: z.number().nonnegative().default(0),
  overdueAmount: z.number().nonnegative().default(0),
  unallocatedPayments: z.number().nonnegative().default(0),
  paymentPlanActive: z.boolean().default(false),
  lastPaymentDate: z.string().nullable().optional(),
  lastInvoiceDate: z.string().nullable().optional(),
});

export type AccountFinanceSummary = z.infer<typeof AccountFinanceSummarySchema>;

// ============================================================================
// 2. Invoice Summary Schema
// ============================================================================

export const InvoiceSummarySchema = z.object({
  id: z.string().min(1),
  invoiceNumber: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().default('Unknown Debtor'),
  periodName: z.string().default('General Billing'),
  currency: z.string().default('GHS'),
  totalPayable: z.number().nonnegative(),
  amountPaid: z.number().nonnegative().default(0),
  balanceDue: z.number().default(0),
  status: z.enum([
    'draft',
    'issued',
    'paid',
    'partially_paid',
    'overdue',
    'voided',
    'disputed',
  ]),
  lifecycleStatus: z
    .enum(['draft', 'issued', 'voided', 'disputed'])
    .default('draft'),
  paymentStatus: z
    .enum(['unpaid', 'partially_paid', 'paid', 'refunded'])
    .default('unpaid'),
  dueDate: z.string(),
  issuedAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  itemsCount: z.number().int().nonnegative().default(1),
  agreementNumber: z.string().nullable().optional(),
});

export type InvoiceSummary = z.infer<typeof InvoiceSummarySchema>;

// ============================================================================
// 3. Payment Summary Schema
// ============================================================================

export const PaymentSummarySchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  accountId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('GHS'),
  paymentMethod: z.enum([
    'bank_transfer',
    'card',
    'mobile_money',
    'cash',
    'cheque',
    'credit_deduction',
  ]),
  status: z.enum(['recorded', 'settled', 'reconciled', 'disputed', 'reversed']),
  receivedAt: z.string(),
  allocatedAmount: z.number().nonnegative().default(0),
  unallocatedAmount: z.number().nonnegative().default(0),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

// ============================================================================
// 4. Receivables Aging Schema
// ============================================================================

export const ReceivablesAgingSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  asOfDate: z.string(),
  current0To30: z.number().nonnegative().default(0),
  warning31To60: z.number().nonnegative().default(0),
  critical61To90: z.number().nonnegative().default(0),
  defaultOver90: z.number().nonnegative().default(0),
  totalOverdue: z.number().nonnegative().default(0),
  totalOutstanding: z.number().default(0),
  oldestInvoiceDueDate: z.string().nullable().optional(),
  debtRiskBand: z.enum(['LOW', 'MODERATE', 'ELEVATED', 'CRITICAL']),
  invoiceCount: z.number().int().nonnegative().default(0),
  overdueInvoiceCount: z.number().int().nonnegative().default(0),
});

export type ReceivablesAging = z.infer<typeof ReceivablesAgingSchema>;

// ============================================================================
// 5. Collection Case Schema
// ============================================================================

export const PromiseToPaySchema = z.object({
  amount: z.number().positive(),
  promiseDate: z.string(),
  status: z.enum(['pending', 'fulfilled', 'broken']),
  notes: z.string().nullable().optional(),
});

export type PromiseToPay = z.infer<typeof PromiseToPaySchema>;

export const CollectionCaseSchema = z.object({
  caseId: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  totalOverdue: z.number().nonnegative(),
  agingBucket: z.enum(['0_30', '31_60', '61_90', '90_PLUS']),
  dunningStage: z.enum([
    'COURTESY_REMINDER',
    'FIRST_OVERDUE',
    'FINAL_NOTICE',
    'ESCALATED_LEGAL',
  ]),
  promiseToPay: PromiseToPaySchema.nullable().optional(),
  assignedAgentPersona: z.string().default('collections_agent'),
  lastContactedAt: z.string().nullable().optional(),
  reminderCount: z.number().int().nonnegative().default(0),
  notes: z.string().nullable().optional(),
});

export type CollectionCase = z.infer<typeof CollectionCaseSchema>;

// ============================================================================
// 6. Fee Schedule Schema (School Billing Focus)
// ============================================================================

export const FeeScheduleItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nominalRoll: z.number().int().nonnegative(),
  ratePerStudent: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
});

export type FeeScheduleItem = z.infer<typeof FeeScheduleItemSchema>;

export const FeeScheduleSchema = z.object({
  scheduleId: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  periodName: z.string().min(1),
  nominalRoll: z.number().int().nonnegative(),
  ratePerStudent: z.number().nonnegative(),
  currency: z.string().default('GHS'),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  vatAmount: z.number().nonnegative().default(0),
  totalPayable: z.number().nonnegative(),
  items: z.array(FeeScheduleItemSchema).default([]),
});

export type FeeSchedule = z.infer<typeof FeeScheduleSchema>;

// ============================================================================
// 7. Account Finance Context Assembler Input & Output Contracts
// ============================================================================

export const AssembleAccountFinanceContextInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  maxTokens: z.number().int().positive().default(4000),
  includeInvoicesLimit: z.number().int().positive().default(25),
  includePaymentsLimit: z.number().int().positive().default(20),
  referenceDate: z.string().optional(),
});

export type AssembleAccountFinanceContextInput = z.infer<
  typeof AssembleAccountFinanceContextInputSchema
>;

export const AccountFinanceContextMetadataSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  assembledAt: z.string(),
  tokenCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  dataFreshnessMs: z.number().nonnegative(),
  sourcesIncluded: z.array(z.string()),
});

export type AccountFinanceContextMetadata = z.infer<
  typeof AccountFinanceContextMetadataSchema
>;

export const AccountFinance360ContextSchema = z.object({
  account: AccountFinanceSummarySchema,
  aging: ReceivablesAgingSchema,
  invoices: z.array(InvoiceSummarySchema),
  recentPayments: z.array(PaymentSummarySchema),
  activeCase: CollectionCaseSchema.nullable().optional(),
  feeSchedule: FeeScheduleSchema.nullable().optional(),
  sanitizedXmlReference: z.string(),
  metadata: AccountFinanceContextMetadataSchema,
});

export type AccountFinance360Context = z.infer<
  typeof AccountFinance360ContextSchema
>;

// ============================================================================
// 8. Finance Capabilities Input & Output Contracts
// ============================================================================

export const CreateInvoiceDraftInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  periodName: z.string().min(1),
  currency: z.string().default('GHS'),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
  dueDate: z.string(),
  notes: z.string().optional(),
});

export type CreateInvoiceDraftInput = z.infer<
  typeof CreateInvoiceDraftInputSchema
>;

export const ValidateInvoiceInputSchema = z.object({
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  totalPayable: z.number().nonnegative(),
  currency: z.string().min(1),
  itemsCount: z.number().int().positive(),
});

export type ValidateInvoiceInput = z.infer<typeof ValidateInvoiceInputSchema>;

export const ValidateInvoiceOutputSchema = z.object({
  isValid: z.boolean(),
  calculatedTotal: z.number(),
  difference: z.number(),
  diagnostics: z.array(z.string()),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH']),
});

export type ValidateInvoiceOutput = z.infer<typeof ValidateInvoiceOutputSchema>;

export const SearchPaymentsInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().optional(),
  reference: z.string().optional(),
  limit: z.number().int().positive().default(20),
});

export type SearchPaymentsInput = z.infer<typeof SearchPaymentsInputSchema>;

export const ReconcilePaymentInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  paymentId: z.string().min(1),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().min(1),
        amount: z.number().positive(),
      })
    )
    .min(1),
  idempotencyKey: z.string().min(1),
});

export type ReconcilePaymentInput = z.infer<typeof ReconcilePaymentInputSchema>;

export const ReconcilePaymentOutputSchema = z.object({
  success: z.boolean(),
  paymentId: z.string(),
  totalAllocated: z.number(),
  unallocatedCredit: z.number(),
  allocatedInvoices: z.array(z.string()),
  reconciledAt: z.string(),
});

export type ReconcilePaymentOutput = z.infer<
  typeof ReconcilePaymentOutputSchema
>;

// ============================================================================
// 9. Structured Error Taxonomy & FinanceError Class (Rule 48)
// ============================================================================

export const FINANCE_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  FINANCE_DEAD_MAN_PAUSED: 'FINANCE_DEAD_MAN_PAUSED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  INVOICE_ALREADY_ISSUED: 'INVOICE_ALREADY_ISSUED',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  PAYMENT_EXCEEDS_OUTSTANDING: 'PAYMENT_EXCEEDS_OUTSTANDING',
  DISCREPANCY_EXCEEDS_TOLERANCE: 'DISCREPANCY_EXCEEDS_TOLERANCE',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  INTERNAL_FINANCE_ERROR: 'INTERNAL_FINANCE_ERROR',
} as const;

export type FinanceErrorCode =
  (typeof FINANCE_ERROR_CODES)[keyof typeof FINANCE_ERROR_CODES];

export class FinanceError extends Error {
  public readonly code: FinanceErrorCode;
  public readonly statusCode: number;
  public readonly httpStatus: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: FinanceErrorCode,
    statusCode: number,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FinanceError';
    this.code = code;
    this.statusCode = statusCode;
    this.httpStatus = statusCode;
    this.context = context;
    Object.setPrototypeOf(this, FinanceError.prototype);
  }
}
