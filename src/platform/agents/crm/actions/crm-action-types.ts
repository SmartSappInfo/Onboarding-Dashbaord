/**
 * @fileOverview Canonical CRM Action, Risk, Hygiene & Proposal Contracts (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary: L0 to L4),
 * Rule 19 (Mandatory Deterministic Idempotency Keys), Rule 21/22 (Two-Phase Action Model & SHA-256 Binding),
 * Rule 27 (Saga Rollback Matrix), Rule 41 (Explainability Grid), and Rule 48 (Sanitized Error Taxonomy).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - This file defines the contract boundaries for autonomous CRM Risk Detection, Next-Best-Action (NBA),
 *   Lead Enrichment, Data Hygiene, and Two-Phase Action Proposals.
 * - All state-changing actions (L2, L3, L4) must specify a compensating capability in `CRM_ROLLBACK_MATRIX`.
 * - All actions targeting operational CRM state must target `/workspace_entities/{workspaceId}_{entityId}`
 *   and NEVER mutate the corporate identity master `/entities/{entityId}` directly (Rule 69).
 * - Zero `any` or `any[]` typing policy strictly enforced.
 */

import { z } from 'zod/v4';
import { createHash } from 'node:crypto';
import { canonicalJson } from '@/platform/capabilities/contracts/canonical-json';

// ============================================================================
// 1. CRM Risk Assessment Schemas
// ============================================================================

export const CrmRiskLevelEnum = z.enum(['LOW', 'MODERATE', 'ELEVATED', 'CRITICAL']);
export type CrmRiskLevel = z.infer<typeof CrmRiskLevelEnum>;

export const CrmRiskCategoryEnum = z.enum([
  'STALLED_DEAL',
  'DARK_ACCOUNT',
  'OVERDUE_COMMITMENT',
  'AGING_RECEIVABLE',
  'HYGIENE_DEFECT',
  'SENTIMENT_DEGRADATION',
]);
export type CrmRiskCategory = z.infer<typeof CrmRiskCategoryEnum>;

export const CrmRiskFactorSchema = z.object({
  id: z.string().min(1),
  category: CrmRiskCategoryEnum,
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1),
  description: z.string().min(1),
  scoreContribution: z.number().min(0).max(100),
  citationIds: z.array(z.string()).default([]),
});
export type CrmRiskFactor = z.infer<typeof CrmRiskFactorSchema>;

export const CrmStalledDealSchema = z.object({
  dealId: z.string().min(1),
  title: z.string().min(1),
  daysInStage: z.number().int().min(0),
  thresholdDays: z.number().int().min(1),
  stage: z.string().min(1),
  value: z.number().min(0),
});
export type CrmStalledDeal = z.infer<typeof CrmStalledDealSchema>;

export const CrmDarkAccountSchema = z.object({
  isDark: z.boolean(),
  daysInactive: z.number().int().min(0),
  thresholdDays: z.number().int().min(1),
  lastInteractionAt: z.string().optional(),
});
export type CrmDarkAccount = z.infer<typeof CrmDarkAccountSchema>;

export const CrmOverdueCommitmentSchema = z.object({
  commitmentId: z.string().min(1),
  title: z.string().min(1),
  dueDate: z.string(),
  daysOverdue: z.number().int().min(0),
  assignedTo: z.string().optional(),
});
export type CrmOverdueCommitment = z.infer<typeof CrmOverdueCommitmentSchema>;

export const CrmAgingReceivableSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  dueDate: z.string(),
  daysOverdue: z.number().int().min(0),
  outstandingBalance: z.number().min(0),
});
export type CrmAgingReceivable = z.infer<typeof CrmAgingReceivableSchema>;

export const CrmHygieneDefectTypeEnum = z.enum([
  'MISSING_DECISION_MAKER',
  'UNVERIFIED_EMAIL',
  'INVALID_PHONE',
  'DUPLICATE_CANDIDATE',
  'STALE_OWNER',
]);
export type CrmHygieneDefectType = z.infer<typeof CrmHygieneDefectTypeEnum>;

export const CrmHygieneDefectSchema = z.object({
  id: z.string().min(1),
  type: CrmHygieneDefectTypeEnum,
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().min(1),
  suggestedRemediation: z.string().min(1),
});
export type CrmHygieneDefect = z.infer<typeof CrmHygieneDefectSchema>;

export const CrmRiskAssessmentSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  overallScore: z.number().int().min(0).max(100),
  riskLevel: CrmRiskLevelEnum,
  factors: z.array(CrmRiskFactorSchema).default([]),
  stalledDeals: z.array(CrmStalledDealSchema).default([]),
  darkAccount: CrmDarkAccountSchema,
  overdueCommitments: z.array(CrmOverdueCommitmentSchema).default([]),
  agingReceivables: z.array(CrmAgingReceivableSchema).default([]),
  hygieneDefects: z.array(CrmHygieneDefectSchema).default([]),
  evaluatedAt: z.string(),
});
export type CrmRiskAssessment = z.infer<typeof CrmRiskAssessmentSchema>;

// ============================================================================
// 2. Next-Best-Action (NBA) & Explainability Schemas (Rule 12 & 41)
// ============================================================================

export const CrmActionTypeEnum = z.enum([
  'DRAFT_OUTREACH',
  'SCHEDULE_MEETING',
  'CREATE_TASK',
  'UPDATE_STAGE',
  'ASSIGN_OWNER',
  'APPLY_TAGS',
  'ENRICH_LEAD',
  'RESOLVE_DUPLICATE',
  'RESOLVE_HYGIENE',
]);
export type CrmActionType = z.infer<typeof CrmActionTypeEnum>;

export const CrmActionPriorityEnum = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']);
export type CrmActionPriority = z.infer<typeof CrmActionPriorityEnum>;

export const CrmRiskTierEnum = z.enum([
  'L0_READ',
  'L1_INTERNAL_DRAFT',
  'L2_STATE_MUTATION',
  'L3_EXTERNAL_COMMUNICATION_FINANCE',
  'L4_PRIVILEGED_DESTRUCTIVE',
]);
export type CrmRiskTier = z.infer<typeof CrmRiskTierEnum>;

export const CrmExplainabilityBlastRadiusSchema = z.object({
  affectedRecordsCount: z.number().int().min(0).default(1),
  financialExposureUsd: z.number().min(0).default(0),
  isReversible: z.boolean().default(true),
});
export type CrmExplainabilityBlastRadius = z.infer<typeof CrmExplainabilityBlastRadiusSchema>;

export const CrmExplainabilityGridSchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  impact: z.string().min(1),
  blastRadius: CrmExplainabilityBlastRadiusSchema,
});
export type CrmExplainabilityGrid = z.infer<typeof CrmExplainabilityGridSchema>;

export const CrmProposedActionSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  actionType: CrmActionTypeEnum,
  priority: CrmActionPriorityEnum,
  riskLevel: CrmRiskTierEnum,
  explainability: CrmExplainabilityGridSchema,
  idempotencyKey: z.string().min(1),
  targetCapabilityId: z.string().min(1),
  compensatingCapabilityId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  requiresApproval: z.boolean().default(true),
  createdAt: z.string(),
});
export type CrmProposedAction = z.infer<typeof CrmProposedActionSchema>;

// ============================================================================
// 3. Lead Enrichment & Deduplication Schemas
// ============================================================================

export const CrmLeadEnrichmentRequestSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  domain: z.string().optional(),
  companyName: z.string().optional(),
});
export type CrmLeadEnrichmentRequest = z.infer<typeof CrmLeadEnrichmentRequestSchema>;

export const CrmLeadFirmographicsSchema = z.object({
  industry: z.string().optional(),
  employeeCount: z.number().int().min(0).optional(),
  estimatedRevenueUsd: z.number().min(0).optional(),
  headquartersLocation: z.string().optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
});
export type CrmLeadFirmographics = z.infer<typeof CrmLeadFirmographicsSchema>;

export const CrmLeadEnrichmentResultSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  firmographics: CrmLeadFirmographicsSchema,
  technographics: z.array(z.string()).default([]),
  enrichedAt: z.string(),
  confidenceScore: z.number().min(0).max(1),
  source: z.string().min(1),
});
export type CrmLeadEnrichmentResult = z.infer<typeof CrmLeadEnrichmentResultSchema>;

export const CrmEntityDeduplicationSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  primaryEntityId: z.string().min(1),
  duplicateEntityId: z.string().min(1),
  matchConfidence: z.number().min(0).max(1),
  matchingFields: z.array(z.string()).default([]),
  status: z.enum(['pending_review', 'merged', 'dismissed']).default('pending_review'),
  detectedAt: z.string(),
});
export type CrmEntityDeduplication = z.infer<typeof CrmEntityDeduplicationSchema>;

// ============================================================================
// 4. Saga Compensation Matrix (Rule 27)
// ============================================================================

export interface CrmRollbackDefinition {
  compensatingCapabilityId: string;
  description: string;
  reversible: boolean;
}

export const CRM_ROLLBACK_MATRIX: Record<CrmActionType, CrmRollbackDefinition> = {
  DRAFT_OUTREACH: {
    compensatingCapabilityId: 'crm.outreach.discard_draft',
    description: 'Discards un-sent outreach draft',
    reversible: true,
  },
  SCHEDULE_MEETING: {
    compensatingCapabilityId: 'crm.calendar.cancel_meeting',
    description: 'Cancels scheduled calendar meeting invite',
    reversible: true,
  },
  CREATE_TASK: {
    compensatingCapabilityId: 'crm.task.delete',
    description: 'Deletes created remediation task',
    reversible: true,
  },
  UPDATE_STAGE: {
    compensatingCapabilityId: 'crm.deal.revert_stage',
    description: 'Reverts deal stage back to its prior stage',
    reversible: true,
  },
  ASSIGN_OWNER: {
    compensatingCapabilityId: 'crm.workspace_entity.revert_owner',
    description: 'Reverts assigned rep back to previous owner',
    reversible: true,
  },
  APPLY_TAGS: {
    compensatingCapabilityId: 'crm.tag.remove',
    description: 'Removes applied tags from entity',
    reversible: true,
  },
  ENRICH_LEAD: {
    compensatingCapabilityId: 'crm.workspace_entity.revert_enrichment',
    description: 'Reverts newly enriched firmographic/technographic attributes',
    reversible: true,
  },
  RESOLVE_DUPLICATE: {
    compensatingCapabilityId: 'crm.entity.unmerge_preview',
    description: 'Reverts entity merge association preview',
    reversible: true,
  },
  RESOLVE_HYGIENE: {
    compensatingCapabilityId: 'crm.workspace_entity.revert_hygiene',
    description: 'Reverts hygiene remediation changes',
    reversible: true,
  },
};

// ============================================================================
// 5. Canonical Error Taxonomy (Rule 48)
// ============================================================================

export const CRM_ACTION_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  CRM_DEAD_MAN_PAUSED: 'CRM_DEAD_MAN_PAUSED',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  INVALID_ACTION_PAYLOAD: 'INVALID_ACTION_PAYLOAD',
  PAYLOAD_TAMPERED: 'PAYLOAD_TAMPERED',
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  TOKEN_BUDGET_EXCEEDED: 'TOKEN_BUDGET_EXCEEDED',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PROPOSAL_NOT_APPROVED: 'PROPOSAL_NOT_APPROVED',
  PROPOSAL_EXPIRED: 'PROPOSAL_EXPIRED',
  SAGA_ROLLBACK_FAILED: 'SAGA_ROLLBACK_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type CrmActionErrorCode = (typeof CRM_ACTION_ERROR_CODES)[keyof typeof CRM_ACTION_ERROR_CODES];

export class CrmActionError extends Error {
  readonly code: CrmActionErrorCode;
  readonly httpStatus: number;

  constructor(code: CrmActionErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'CrmActionError';
    this.code = code;
    this.httpStatus = CrmActionError.mapCodeToHttpStatus(code);
  }

  private static mapCodeToHttpStatus(code: CrmActionErrorCode): number {
    switch (code) {
      case 'AUTHENTICATION_REQUIRED':
        return 401;
      case 'IDOR_VIOLATION':
      case 'SELF_APPROVAL_FORBIDDEN':
        return 403;
      case 'ENTITY_NOT_FOUND':
      case 'PROPOSAL_NOT_FOUND':
        return 404;
      case 'INVALID_ACTION_PAYLOAD':
      case 'PAYLOAD_TAMPERED':
      case 'PROPOSAL_NOT_APPROVED':
        return 400;
      case 'VERSION_MISMATCH':
        return 409;
      case 'PROPOSAL_EXPIRED':
        return 410;
      case 'CRM_DEAD_MAN_PAUSED':
      case 'CIRCUIT_BREAKER_OPEN':
        return 503;
      case 'TOKEN_BUDGET_EXCEEDED':
        return 429;
      case 'SAGA_ROLLBACK_FAILED':
      case 'INTERNAL_ERROR':
      default:
        return 500;
    }
  }
}

// ============================================================================
// 6. Deterministic Idempotency Key Generator (Rule 19)
// ============================================================================

/**
 * Computes a deterministic idempotency key for a proposed CRM action.
 * Formats: `crm_action_${entityId}_${sha256Hex(actionType + canonicalPayload).substring(0, 16)}`
 */
export function computeCrmActionIdempotencyKey(
  entityId: string,
  actionType: string,
  payload: Record<string, unknown>
): string {
  const canonicalPayload = canonicalJson(payload);
  const hash = createHash('sha256')
    .update(`${actionType}:${canonicalPayload}`)
    .digest('hex')
    .substring(0, 16);
  return `crm_action_${entityId}_${hash}`;
}
