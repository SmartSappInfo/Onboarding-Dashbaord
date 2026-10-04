/**
 * @fileOverview Canonical CRM Signature Inquiry, Citations & Multi-Turn Contracts (Phase 9 Milestone 5)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary),
 * Rule 13/30 (Trust Boundary Isolation: <untrusted_reference_data id="...">),
 * Rule 19 (Deterministic Idempotency), Rule 21/22 (Two-Phase Actions & Cryptographic Binding),
 * Rule 27 (Saga Rollback Matrix), Rule 29 (Memory & 30-min TTL Governance),
 * Rule 41 (Explainability Grid), Rule 47 (Never Trust the Model),
 * Rule 48 (Sanitized Error Taxonomy), Rule 68 (The Five Non-Negotiable Invariants 11-15),
 * and Rule 69 (Governed Capability Layer & Dual-Tier CRM Data Model).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - This file defines the canonical contract for the Flagship CRM Autonomous Experience:
 *   "What's going on with [Entity]?"
 * - The inquiry aggregates 14 discrete data dimensions across the 360° account context,
 *   performs risk analysis, extracts commitments, constructs grounded narratives,
 *   and stages executable Next-Best-Actions (NBA).
 * - All actions proposed through the signature flow target `/workspace_entities/{workspaceId}_{entityId}`
 *   or sub-resources, preserving the immutable master `/entities/{entityId}` identity (Rule 69).
 * - Zero `any` or `any[]` typing policy strictly enforced.
 */

import { z } from 'zod/v4';
import {
  CrmProposedActionSchema,
  CrmRiskFactorSchema,
  CrmOverdueCommitmentSchema,
  type CrmProposedAction,
  type CrmRiskFactor,
  type CrmOverdueCommitment,
} from '@/platform/agents/crm/actions/crm-action-types';

// ============================================================================
// 1. Signature Inquiry Input Schema
// ============================================================================

export const CrmSignatureQueryOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  maxTokens: z.number().int().min(500).max(8000).default(4000),
  correlationId: z.string().optional(),
  signal: z.instanceof(AbortSignal).optional(),
});
export type CrmSignatureQueryOptions = z.infer<typeof CrmSignatureQueryOptionsSchema>;

export const CrmSignatureQuerySchema = z
  .object({
    query: z.string().optional(),
    entityId: z.string().optional(),
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
    callerId: z.string().min(1),
    options: CrmSignatureQueryOptionsSchema.default({
      dryRun: false,
      maxTokens: 4000,
    }),
  })
  .refine(
    (data) => Boolean((data.query && data.query.trim().length > 0) || (data.entityId && data.entityId.trim().length > 0)),
    {
      message: 'Either a non-empty query string or an entityId must be provided for a signature inquiry.',
      path: ['query'],
    }
  );
export type CrmSignatureQuery = z.infer<typeof CrmSignatureQuerySchema>;

// ============================================================================
// 2. Citation & Source Grounding Schema (Rule 13 & 30)
// ============================================================================

export const CrmSignatureCitationSourceTypeEnum = z.enum([
  'note',
  'meeting',
  'transcript',
  'deal',
  'invoice',
  'task',
  'memory',
  'communication',
]);
export type CrmSignatureCitationSourceType = z.infer<typeof CrmSignatureCitationSourceTypeEnum>;

export const CrmSignatureCitationSchema = z.object({
  id: z.string().min(1),
  sourceType: CrmSignatureCitationSourceTypeEnum,
  sourceId: z.string().min(1),
  title: z.string().min(1),
  snippet: z.string().min(1),
  timestamp: z.string(),
  deepLinkUrl: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type CrmSignatureCitation = z.infer<typeof CrmSignatureCitationSchema>;

// ============================================================================
// 3. Timeline Highlight Schema
// ============================================================================

export const CrmTimelineHighlightCategoryEnum = z.enum([
  'DEAL',
  'MEETING',
  'NOTE',
  'INVOICE',
  'TASK',
  'COMMUNICATION',
  'MEMORY',
]);
export type CrmTimelineHighlightCategory = z.infer<typeof CrmTimelineHighlightCategoryEnum>;

export const CrmTimelineSignificanceEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'ROUTINE']);
export type CrmTimelineSignificance = z.infer<typeof CrmTimelineSignificanceEnum>;

export const CrmSignatureTimelineHighlightSchema = z.object({
  id: z.string().min(1),
  category: CrmTimelineHighlightCategoryEnum,
  title: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.string(),
  significance: CrmTimelineSignificanceEnum,
  citationIds: z.array(z.string()).default([]),
});
export type CrmSignatureTimelineHighlight = z.infer<typeof CrmSignatureTimelineHighlightSchema>;

// ============================================================================
// 4. Signature Inquiry Result Schema
// ============================================================================

export const CrmRelationshipStatusEnum = z.enum([
  'EXCELLENT',
  'HEALTHY',
  'ATTENTION_NEEDED',
  'AT_RISK',
  'CRITICAL',
]);
export type CrmRelationshipStatus = z.infer<typeof CrmRelationshipStatusEnum>;

export const CrmContextMetricsSchema = z.object({
  totalRecordsAnalyzed: z.number().int().min(0),
  tokensUsed: z.number().int().min(0),
  executionDurationMs: z.number().min(0),
  modelTier: z.enum(['flash', 'pro']),
});
export type CrmContextMetrics = z.infer<typeof CrmContextMetricsSchema>;

export const CrmSignatureResultSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityName: z.string().min(1),
  healthScore: z.number().min(0).max(100),
  relationshipStatus: CrmRelationshipStatusEnum,
  executiveNarrative: z.string().min(1),
  timelineHighlights: z.array(CrmSignatureTimelineHighlightSchema),
  activeRisks: z.array(CrmRiskFactorSchema),
  commitments: z.array(CrmOverdueCommitmentSchema),
  proposedActions: z.array(CrmProposedActionSchema),
  citations: z.array(CrmSignatureCitationSchema),
  contextMetrics: CrmContextMetricsSchema,
  sessionId: z.string().optional(),
  generatedAt: z.string(),
});
export type CrmSignatureResult = z.infer<typeof CrmSignatureResultSchema>;

// ============================================================================
// 5. Multi-Turn Session Schemas (Rule 29: Memory & 30-min TTL Governance)
// ============================================================================

export const CrmSessionMessageRoleEnum = z.enum(['user', 'assistant', 'system']);
export type CrmSessionMessageRole = z.infer<typeof CrmSessionMessageRoleEnum>;

export const CrmSignatureSessionMessageSchema = z.object({
  id: z.string().min(1),
  role: CrmSessionMessageRoleEnum,
  content: z.string().min(1),
  timestamp: z.string(),
  citationIds: z.array(z.string()).optional(),
  proposedActionIds: z.array(z.string()).optional(),
});
export type CrmSignatureSessionMessage = z.infer<typeof CrmSignatureSessionMessageSchema>;

export const CrmSignatureSessionSchema = z.object({
  sessionId: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  messages: z.array(CrmSignatureSessionMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(), // 30 minutes from last activity
  turnCount: z.number().int().min(0),
});
export type CrmSignatureSession = z.infer<typeof CrmSignatureSessionSchema>;

export const CrmFollowupMessageInputSchema = z.object({
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  message: z.string().min(1).max(2000),
  callerId: z.string().optional(),
  signal: z.instanceof(AbortSignal).optional(),
});
export type CrmFollowupMessageInput = z.infer<typeof CrmFollowupMessageInputSchema>;

export const CrmFollowupMessageResultSchema = z.object({
  sessionId: z.string().min(1),
  answer: z.string().min(1),
  citations: z.array(CrmSignatureCitationSchema),
  proposedActions: z.array(CrmProposedActionSchema),
  turnIndex: z.number().int().min(1),
  generatedAt: z.string(),
});
export type CrmFollowupMessageResult = z.infer<typeof CrmFollowupMessageResultSchema>;

// ============================================================================
// 6. Error Taxonomy & Structured Error Class (Rule 48)
// ============================================================================

export const CRM_SIGNATURE_ERROR_CODES = [
  'AUTHENTICATION_REQUIRED',
  'IDOR_VIOLATION',
  'ENTITY_NOT_FOUND',
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'INVALID_QUERY',
  'PROMPT_INJECTION_DETECTED',
  'CRM_DEAD_MAN_PAUSED',
  'CIRCUIT_BREAKER_OPEN',
  'TOKEN_BUDGET_EXCEEDED',
  'SYNTHESIS_FAILED',
  'INTERNAL_ERROR',
] as const;
export type CrmSignatureErrorCode = (typeof CRM_SIGNATURE_ERROR_CODES)[number];

export class CrmSignatureError extends Error {
  public readonly code: CrmSignatureErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: CrmSignatureErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CrmSignatureError';
    this.code = code;
    this.details = details;
    this.httpStatus = CrmSignatureError.mapCodeToHttpStatus(code);
  }

  private static mapCodeToHttpStatus(code: CrmSignatureErrorCode): number {
    switch (code) {
      case 'AUTHENTICATION_REQUIRED':
        return 401;
      case 'IDOR_VIOLATION':
        return 403;
      case 'ENTITY_NOT_FOUND':
      case 'SESSION_NOT_FOUND':
        return 404;
      case 'INVALID_QUERY':
      case 'PROMPT_INJECTION_DETECTED':
        return 400;
      case 'SESSION_EXPIRED':
        return 410;
      case 'CRM_DEAD_MAN_PAUSED':
      case 'CIRCUIT_BREAKER_OPEN':
        return 503;
      case 'TOKEN_BUDGET_EXCEEDED':
        return 429;
      case 'SYNTHESIS_FAILED':
      case 'INTERNAL_ERROR':
      default:
        return 500;
    }
  }
}
