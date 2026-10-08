/**
 * @fileOverview Canonical Collections & Aging Receivables Contracts, Types & Error Taxonomy (Phase 12 Milestone 4)
 *
 * Implements:
 * - Rule 1 & 14 (Canonical Capability Layer & Typed Schemas)
 * - Rule 2 & 48 (Structured Failure Taxonomy & Recovery Strategies)
 * - Rule 4 (Strict Zero-any / Zero-any[] typing policy)
 * - Rule 8 & 47 (Multi-Tenant Anti-IDOR Boundary Validation)
 * - Rule 10 (Canonical Schemas & Bounded Collections)
 * - Rule 11 (Mathematical Determinism in Financial Logic & Remainder Balancing)
 * - Rule 12 (5-tier risk taxonomy classification)
 * - Rule 13 & 30 (Untrusted Reference Data XML containerization)
 * - Rule 17 (Non-Delegable Actions Guard: student suspension & debt write-offs)
 * - Rule 18 (Live TOCTOU Authority & Freshness Checks)
 * - Rule 19 (Deterministic Idempotency Key Computation)
 * - Rule 21 & 22 (Two-Phase Action Model & Cryptographic SHA-256 Tampering Defense)
 * - Rule 27 (Reverse-LIFO Saga Compensation)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Governed Capability Layer & Strangler Fig Invariant)
 * - .agents/AGENTS.md (Fields & Variables SSOT via FieldsVariablesService, TagSelector SSOT)
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. Math Determinism Helper (Rule 11)
// ============================================================================

/**
 * Rounds a financial currency value strictly to 2 decimal places, eliminating floating-point drift.
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// 2. Enums and Basic Schemas
// ============================================================================

export const AgingBucketSchema = z.enum([
  '0_14_DAYS',
  '15_30_DAYS',
  '31_60_DAYS',
  'OVER_60_DAYS',
]);
export type AgingBucket = z.infer<typeof AgingBucketSchema>;

export const DunningTierSchema = z.enum([
  'COURTESY_REMINDER',
  'FORMAL_STATEMENT',
  'INSTALLMENT_PROPOSAL',
  'EXECUTIVE_SUSPENSION_REVIEW',
]);
export type DunningTier = z.infer<typeof DunningTierSchema>;

export const RelationshipHealthSchema = z.enum([
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'AT_RISK',
]);
export type RelationshipHealth = z.infer<typeof RelationshipHealthSchema>;

export const InstallmentFrequencySchema = z.enum([
  'weekly',
  'biweekly',
  'monthly',
  'termly',
]);
export type InstallmentFrequency = z.infer<typeof InstallmentFrequencySchema>;

export const InstallmentPlanStatusSchema = z.enum([
  'DRAFT',
  'PROPOSED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);
export type InstallmentPlanStatus = z.infer<typeof InstallmentPlanStatusSchema>;

export const MilestoneStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'DEFAULTED',
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const OutreachChannelSchema = z.enum([
  'email',
  'whatsapp',
  'sms',
]);
export type OutreachChannel = z.infer<typeof OutreachChannelSchema>;

export const CollectionsActionTypeSchema = z.enum([
  'SEND_COURTESY_REMINDER',
  'SEND_FORMAL_STATEMENT',
  'PROPOSE_INSTALLMENT_PLAN',
  'RECORD_PROMISE_TO_PAY',
  'REQUEST_SUSPENSION_REVIEW',
]);
export type CollectionsActionType = z.infer<typeof CollectionsActionTypeSchema>;

export const ActionPrioritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);
export type ActionPriority = z.infer<typeof ActionPrioritySchema>;

export const RiskLevelSchema = z.enum([
  'L0_READ',
  'L1_INTERNAL_DRAFT',
  'L2_STATE_MUTATION',
  'L3_EXTERNAL_COMMUNICATION_FINANCE',
  'L4_PRIVILEGED_DESTRUCTIVE',
]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ============================================================================
// 3. Debtor Account & Milestone Contracts
// ============================================================================

export const InstallmentMilestoneSchema = z.object({
  milestoneIndex: z.number().int().positive(),
  dueDate: z.string().min(10), // ISO Date YYYY-MM-DD
  amount: z.number().positive(),
  currency: z.string().default('GHS'),
  status: MilestoneStatusSchema.default('PENDING'),
});
export type InstallmentMilestone = z.infer<typeof InstallmentMilestoneSchema>;

export const InstallmentPaymentPlanSchema = z.object({
  planId: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  totalAmount: z.number().positive(),
  currency: z.string().default('GHS'),
  frequency: InstallmentFrequencySchema,
  milestones: z.array(InstallmentMilestoneSchema).min(2).max(12),
  startDate: z.string().min(10),
  status: InstallmentPlanStatusSchema.default('PROPOSED'),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  proposalId: z.string().optional(),
  notes: z.string().optional(),
});
export type InstallmentPaymentPlan = z.infer<typeof InstallmentPaymentPlanSchema>;

export const DebtorAccountSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  entityName: z.string().min(1),
  studentId: z.string().optional(),
  primaryContactName: z.string().min(1),
  primaryContactPhone: z.string().default(''),
  primaryContactEmail: z.string().default(''),
  totalOutstandingBalance: z.number().nonnegative(),
  currency: z.string().default('GHS'),
  oldestInvoiceDueDate: z.string().min(10),
  daysOverdue: z.number().int().nonnegative(),
  agingBucket: AgingBucketSchema,
  relationshipHealth: RelationshipHealthSchema.default('GOOD'),
  activeInstallmentPlanId: z.string().nullable().optional(),
  lastContactedAt: z.string().nullable().optional(),
  promiseToPayDate: z.string().nullable().optional(),
  promiseToPayAmount: z.number().nullable().optional(),
  brokenPromisesCount: z.number().int().nonnegative().default(0),
  currentTagIds: z.array(z.string()).default([]),
  remarks: z.string().optional(),
});
export type DebtorAccount = z.infer<typeof DebtorAccountSchema>;

export const DunningNoticeDraftSchema = z.object({
  draftId: z.string().min(1),
  entityId: z.string().min(1),
  channel: OutreachChannelSchema,
  tier: DunningTierSchema,
  recipientName: z.string().min(1),
  recipientAddress: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  paymentLink: z.string().min(1),
  currency: z.string().default('GHS'),
  amountDue: z.number().positive(),
  daysOverdue: z.number().int().nonnegative(),
  generatedAt: z.string(),
});
export type DunningNoticeDraft = z.infer<typeof DunningNoticeDraftSchema>;

export const CollectionsExplainabilitySchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  recoveryProbability: z.number().min(0).max(100),
  riskLevel: RiskLevelSchema,
  financialExposure: z.number().nonnegative(),
});
export type CollectionsExplainability = z.infer<typeof CollectionsExplainabilitySchema>;

export const CollectionsNextBestActionSchema = z.object({
  actionId: z.string().min(1),
  entityId: z.string().min(1),
  actionType: CollectionsActionTypeSchema,
  priority: ActionPrioritySchema,
  riskLevel: RiskLevelSchema,
  explainability: CollectionsExplainabilitySchema,
  proposedPlan: InstallmentPaymentPlanSchema.optional(),
  dunningDraft: DunningNoticeDraftSchema.optional(),
  idempotencyKey: z.string().min(1),
  requiresHumanApproval: z.boolean().default(false),
  nonDelegable: z.boolean().default(false),
});
export type CollectionsNextBestAction = z.infer<typeof CollectionsNextBestActionSchema>;

export const CollectionsMetricsSchema = z.object({
  totalReceivablesOverdue: z.number().nonnegative(),
  debtorAccountsCount: z.number().int().nonnegative(),
  activePromisesCount: z.number().int().nonnegative(),
  promisesVolume: z.number().nonnegative(),
  plansActiveCount: z.number().int().nonnegative(),
  plansRecoveredThisMonth: z.number().nonnegative(),
  currency: z.string().default('GHS'),
});
export type CollectionsMetrics = z.infer<typeof CollectionsMetricsSchema>;

// ============================================================================
// 4. Server Action & Engine Input/Output Schemas
// ============================================================================

export const GetDebtorAccountsInputSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  agingBucket: AgingBucketSchema.optional(),
  searchQuery: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(50),
});
export type GetDebtorAccountsInput = z.infer<typeof GetDebtorAccountsInputSchema>;

export const EvaluateDebtorInputSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
});
export type EvaluateDebtorInput = z.infer<typeof EvaluateDebtorInputSchema>;

export const GenerateInstallmentPlanInputSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  totalAmount: z.number().positive(),
  currency: z.string().default('GHS'),
  frequency: InstallmentFrequencySchema,
  milestoneCount: z.number().int().min(2).max(12),
  startDate: z.string().min(10),
  notes: z.string().optional(),
});
export type GenerateInstallmentPlanInput = z.infer<typeof GenerateInstallmentPlanInputSchema>;

export const ProposeCollectionsActionInputSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  actionType: CollectionsActionTypeSchema,
  riskLevel: RiskLevelSchema,
  payload: z.record(z.string(), z.unknown()),
  rationale: z.string().min(5),
  idempotencyKey: z.string().min(1),
});
export type ProposeCollectionsActionInput = z.infer<typeof ProposeCollectionsActionInputSchema>;

export const RecordPromiseToPayInputSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  promiseDate: z.string().min(10), // YYYY-MM-DD
  amount: z.number().positive(),
  notes: z.string().optional(),
});
export type RecordPromiseToPayInput = z.infer<typeof RecordPromiseToPayInputSchema>;

export const CollectionsActionResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        httpStatus: z.number().int(),
      })
      .optional(),
  });

export type CollectionsActionResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    httpStatus: number;
  };
};

// ============================================================================
// 5. Error Taxonomy & Typed CollectionsError (Rule 2 & 48)
// ============================================================================

export const COLLECTIONS_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  COLLECTIONS_DEAD_MAN_PAUSED: 'COLLECTIONS_DEAD_MAN_PAUSED',
  DEBTOR_NOT_FOUND: 'DEBTOR_NOT_FOUND',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  STALE_BALANCE: 'STALE_BALANCE',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  PAYLOAD_TAMPERED: 'PAYLOAD_TAMPERED',
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',
  INVALID_INSTALLMENT_SCHEDULE: 'INVALID_INSTALLMENT_SCHEDULE',
  PROMISE_BROKEN: 'PROMISE_BROKEN',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  NON_DELEGABLE_ACTION: 'NON_DELEGABLE_ACTION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type CollectionsErrorCode =
  (typeof COLLECTIONS_ERROR_CODES)[keyof typeof COLLECTIONS_ERROR_CODES];

export class CollectionsError extends Error {
  readonly code: CollectionsErrorCode;
  readonly httpStatus: number;

  constructor(code: CollectionsErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'CollectionsError';
    this.code = code;
    this.httpStatus = httpStatus;
    Object.setPrototypeOf(this, CollectionsError.prototype);
  }
}
