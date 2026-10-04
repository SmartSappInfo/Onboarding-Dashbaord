/**
 * @fileOverview Canonical Domain Contracts: CRM In-Context Intelligence (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Zod v4 schema validation), Rule 12 (Risk Vocabulary), Rule 13/30 (Untrusted Reference Data XML containerization),
 * Rule 41 (Explainability Grid: WHAT, WHY, IMPACT), and Rule 48 (Sanitized Error Taxonomy).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - These schemas define the data shapes for the CRM AI Overview, Knowledge Panel,
 *   Recommendations Card, Deal Intelligence, and Meeting Briefing surfaces.
 * - All recommendation items provide explicit WHAT, WHY, and IMPACT explainability dimensions.
 * - All untrusted reference snippets (notes, transcripts) must be isolated inside `<untrusted_reference_data id="...">` containers.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. Account AI Overview Schema
// ============================================================================

export const AccountHealthStatusEnum = z.enum(['HEALTHY', 'ATTENTION_NEEDED', 'AT_RISK', 'DORMANT']);
export type AccountHealthStatus = z.infer<typeof AccountHealthStatusEnum>;

export const AccountMomentumEnum = z.enum(['ACCELERATING', 'STEADY', 'SLOWING', 'STALLED']);
export type AccountMomentum = z.infer<typeof AccountMomentumEnum>;

export const AccountRiskSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type AccountRiskSeverity = z.infer<typeof AccountRiskSeverityEnum>;

export const AccountKeyRiskSchema = z.object({
  id: z.string().min(1),
  tag: z.string().min(1),
  severity: AccountRiskSeverityEnum,
  description: z.string().min(1),
});
export type AccountKeyRisk = z.infer<typeof AccountKeyRiskSchema>;

export const StakeholderEngagementEnum = z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNRESPONSIVE']);
export type StakeholderEngagement = z.infer<typeof StakeholderEngagementEnum>;

export const AccountStakeholderSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  engagementLevel: StakeholderEngagementEnum,
  isPrimary: z.boolean().default(false),
});
export type AccountStakeholder = z.infer<typeof AccountStakeholderSchema>;

export const AccountSignalTypeEnum = z.enum(['DEAL', 'MEETING', 'NOTE', 'BILLING', 'TASK', 'COMMUNICATION']);
export type AccountSignalType = z.infer<typeof AccountSignalTypeEnum>;

export const AccountRecentSignalSchema = z.object({
  id: z.string().min(1),
  type: AccountSignalTypeEnum,
  title: z.string().min(1),
  timestamp: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
});
export type AccountRecentSignal = z.infer<typeof AccountRecentSignalSchema>;

export const AccountAiOverviewSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  healthStatus: AccountHealthStatusEnum,
  healthScore: z.number().int().min(0).max(100),
  executiveSummary: z.string().min(1),
  activeMomentum: AccountMomentumEnum,
  keyRisks: z.array(AccountKeyRiskSchema).default([]),
  stakeholders: z.array(AccountStakeholderSchema).default([]),
  recentSignals: z.array(AccountRecentSignalSchema).default([]),
  generatedAt: z.string(),
});
export type AccountAiOverview = z.infer<typeof AccountAiOverviewSchema>;

// ============================================================================
// 2. Account Knowledge Schema & Citations (Rule 13 & 30)
// ============================================================================

export const AccountGroundedFactSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  citationId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceType: z.string().min(1),
});
export type AccountGroundedFact = z.infer<typeof AccountGroundedFactSchema>;

export const MeetingTakeawaySchema = z.object({
  meetingId: z.string().min(1),
  meetingTitle: z.string().min(1),
  date: z.string(),
  takeaways: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
});
export type MeetingTakeaway = z.infer<typeof MeetingTakeawaySchema>;

export const KnowledgeCitationSourceTypeEnum = z.enum(['note', 'meeting', 'deal', 'invoice', 'memory']);
export type KnowledgeCitationSourceType = z.infer<typeof KnowledgeCitationSourceTypeEnum>;

export const KnowledgeCitationSchema = z.object({
  id: z.string().min(1),
  sourceType: KnowledgeCitationSourceTypeEnum,
  sourceId: z.string().min(1),
  title: z.string().min(1),
  snippet: z.string().min(1),
  timestamp: z.string(),
  isolatedSnippet: z.string(), // Wrapped in <untrusted_reference_data id="...">
});
export type KnowledgeCitation = z.infer<typeof KnowledgeCitationSchema>;

export const AccountKnowledgeSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  groundedFacts: z.array(AccountGroundedFactSchema).default([]),
  meetingTakeaways: z.array(MeetingTakeawaySchema).default([]),
  citations: z.array(KnowledgeCitationSchema).default([]),
  generatedAt: z.string(),
});
export type AccountKnowledge = z.infer<typeof AccountKnowledgeSchema>;

// ============================================================================
// 3. Account Recommendations Schema (Rule 41 Explainability Grid)
// ============================================================================

export const RecommendationPriorityEnum = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']);
export type RecommendationPriority = z.infer<typeof RecommendationPriorityEnum>;

export const RecommendationActionTypeEnum = z.enum([
  'DRAFT_EMAIL',
  'CREATE_TASK',
  'SCHEDULE_MEETING',
  'UPDATE_STAGE',
  'ADD_NOTE',
  'LAUNCH_RESEARCH',
]);
export type RecommendationActionType = z.infer<typeof RecommendationActionTypeEnum>;

export const RecommendationExplainabilitySchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  impact: z.string().min(1),
});
export type RecommendationExplainability = z.infer<typeof RecommendationExplainabilitySchema>;

export const AccountRecommendationItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: RecommendationPriorityEnum,
  category: z.string().min(1),
  actionType: RecommendationActionTypeEnum,
  explainability: RecommendationExplainabilitySchema,
  payloadDelta: z.record(z.string(), z.unknown()).optional(),
  targetCapabilityId: z.string().optional(),
});
export type AccountRecommendationItem = z.infer<typeof AccountRecommendationItemSchema>;

export const AccountRecommendationsSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  items: z.array(AccountRecommendationItemSchema).default([]),
  generatedAt: z.string(),
});
export type AccountRecommendations = z.infer<typeof AccountRecommendationsSchema>;

// ============================================================================
// 4. Deal Intelligence Schema
// ============================================================================

export const DealVelocityStatusEnum = z.enum(['FAST', 'NORMAL', 'SLOW', 'STALLED']);
export type DealVelocityStatus = z.infer<typeof DealVelocityStatusEnum>;

export const DealHealthCategoryEnum = z.enum(['STRONG', 'MODERATE', 'VULNERABLE', 'CRITICAL']);
export type DealHealthCategory = z.infer<typeof DealHealthCategoryEnum>;

export const DealStageVelocitySchema = z.object({
  daysInStage: z.number().int().nonnegative(),
  averageDaysInStage: z.number().int().nonnegative(),
  velocityStatus: DealVelocityStatusEnum,
});
export type DealStageVelocity = z.infer<typeof DealStageVelocitySchema>;

export const DealStallRiskSchema = z.object({
  isStalled: z.boolean(),
  reason: z.string().optional(),
  daysSinceActivity: z.number().int().nonnegative(),
});
export type DealStallRisk = z.infer<typeof DealStallRiskSchema>;

export const DealBuyingSignalSchema = z.object({
  signal: z.string().min(1),
  detectedAt: z.string(),
  confidence: z.number().min(0).max(1),
});
export type DealBuyingSignal = z.infer<typeof DealBuyingSignalSchema>;

export const DealRiskFactorSchema = z.object({
  risk: z.string().min(1),
  severity: AccountRiskSeverityEnum,
  mitigationPrompt: z.string().min(1),
});
export type DealRiskFactor = z.infer<typeof DealRiskFactorSchema>;

export const DealCompetitorAnalysisSchema = z.object({
  competitorName: z.string().min(1),
  objection: z.string().min(1),
  counterStrategy: z.string().min(1),
});
export type DealCompetitorAnalysis = z.infer<typeof DealCompetitorAnalysisSchema>;

export const DealRecommendedPlaybookSchema = z.object({
  strategyName: z.string().min(1),
  tacticalSteps: z.array(z.string()).default([]),
  expectedOutcome: z.string().min(1),
});
export type DealRecommendedPlaybook = z.infer<typeof DealRecommendedPlaybookSchema>;

export const DealIntelligenceSchema = z.object({
  dealId: z.string().min(1),
  dealTitle: z.string().min(1),
  dealValue: z.number().nonnegative(),
  currency: z.string().default('USD'),
  stageVelocity: DealStageVelocitySchema,
  winProbability: z.number().int().min(0).max(100),
  healthScore: z.number().int().min(0).max(100),
  healthCategory: DealHealthCategoryEnum,
  stallRisk: DealStallRiskSchema,
  buyingSignals: z.array(DealBuyingSignalSchema).default([]),
  riskFactors: z.array(DealRiskFactorSchema).default([]),
  competitorAnalysis: z.array(DealCompetitorAnalysisSchema).default([]),
  recommendedPlaybook: DealRecommendedPlaybookSchema,
  generatedAt: z.string(),
});
export type DealIntelligence = z.infer<typeof DealIntelligenceSchema>;

// ============================================================================
// 5. Meeting Brief Schema
// ============================================================================

export const MeetingAttendeeBriefSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  pastInteractionsCount: z.number().int().nonnegative().default(0),
  lastSentiment: z.string().optional(),
});
export type MeetingAttendeeBrief = z.infer<typeof MeetingAttendeeBriefSchema>;

export const MeetingOpenCommitmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  isOverdue: z.boolean().default(false),
});
export type MeetingOpenCommitment = z.infer<typeof MeetingOpenCommitmentSchema>;

export const MeetingBriefSchema = z.object({
  meetingId: z.string().min(1),
  title: z.string().min(1),
  startTime: z.string(),
  attendees: z.array(MeetingAttendeeBriefSchema).default([]),
  relationshipSummary: z.string().min(1),
  openCommitments: z.array(MeetingOpenCommitmentSchema).default([]),
  likelyObjectives: z.array(z.string()).default([]),
  potentialObjections: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  recommendedStrategy: z.string().min(1),
  generatedAt: z.string(),
});
export type MeetingBrief = z.infer<typeof MeetingBriefSchema>;

// ============================================================================
// 6. Action Input Schemas (Anti-IDOR & Multi-Tenant Scoping, Rules 8 & 47)
// ============================================================================

export const GetAccountIntelligenceInputSchema = z.object({
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
});
export type GetAccountIntelligenceInput = z.infer<typeof GetAccountIntelligenceInputSchema>;

export const GetDealIntelligenceInputSchema = z.object({
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  dealId: z.string().min(1),
});
export type GetDealIntelligenceInput = z.infer<typeof GetDealIntelligenceInputSchema>;

export const GetMeetingBriefInputSchema = z.object({
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  meetingId: z.string().min(1),
});
export type GetMeetingBriefInput = z.infer<typeof GetMeetingBriefInputSchema>;

// ============================================================================
// 7. Error Taxonomy & Typed Domain Error (Rule 48)
// ============================================================================

export const CRM_INTELLIGENCE_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  CRM_DEAD_MAN_PAUSED: 'CRM_DEAD_MAN_PAUSED',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  DEAL_NOT_FOUND: 'DEAL_NOT_FOUND',
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  SYNTHESIS_FAILED: 'SYNTHESIS_FAILED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type CrmIntelligenceErrorCode = keyof typeof CRM_INTELLIGENCE_ERROR_CODES;

export class CrmIntelligenceError extends Error {
  public readonly code: CrmIntelligenceErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: CrmIntelligenceErrorCode,
    statusCode = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CrmIntelligenceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, CrmIntelligenceError.prototype);
  }
}
