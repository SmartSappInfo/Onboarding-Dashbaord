/**
 * @fileOverview Canonical Sales & Lead Intelligence Contracts and Zod v4 Schemas.
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Strict Typing: Zero `any` or `any[]` (Rule 4).
 * 2. Zod v4 Schemas: All entity inputs, outputs, and score breakdowns strictly validated (Rule 10, 47).
 * 3. Structured Errors: Structured taxonomy with HTTP status mappings (Rule 48).
 * 4. Dual-Tier CRM Preservation: Differentiates master identity from operational records (Rule 69).
 */

import { z } from 'zod/v4';

export const SALES_INTELLIGENCE_ERROR_CODES = {
  LEAD_NOT_FOUND: 'LEAD_NOT_FOUND',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  SALES_DEAD_MAN_PAUSED: 'SALES_DEAD_MAN_PAUSED',
  ENRICHMENT_FAILED: 'ENRICHMENT_FAILED',
  SCORING_FAILED: 'SCORING_FAILED',
  SSRF_DETECTED: 'SSRF_DETECTED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type SalesIntelligenceErrorCode =
  typeof SALES_INTELLIGENCE_ERROR_CODES[keyof typeof SALES_INTELLIGENCE_ERROR_CODES];

export class SalesIntelligenceError extends Error {
  public readonly code: SalesIntelligenceErrorCode;
  public readonly statusCode: number;

  constructor(message: string, code: SalesIntelligenceErrorCode, statusCode = 500) {
    super(message);
    this.name = 'SalesIntelligenceError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, SalesIntelligenceError.prototype);
  }
}

export const EmailVerificationStatusSchema = z.enum([
  'verified',
  'risky',
  'invalid',
  'unverified',
  'unknown',
]);
export type EmailVerificationStatus = z.infer<typeof EmailVerificationStatusSchema>;

export const LeadContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().optional(),
  confidence: z.number().min(0).max(100),
  verificationStatus: EmailVerificationStatusSchema,
  deliverabilityScore: z.number().min(0).max(100).optional(),
  mxProvider: z.string().optional(),
  lastVerifiedAt: z.string().optional(),
});
export type LeadContact = z.infer<typeof LeadContactSchema>;

export const LeadScoreBreakdownSchema = z.object({
  overallScore: z.number().min(0).max(100),
  priorityTier: z.enum(['critical', 'high', 'medium', 'low']),
  icpFitPoints: z.number(),
  needPoints: z.number(),
  intentPoints: z.number(),
  engagementPoints: z.number(),
  similarityPoints: z.number(),
  recencyPoints: z.number().optional(),
  topPositiveDrivers: z.array(z.string()),
  topNegativeDrivers: z.array(z.string()),
});
export type LeadScoreBreakdown = z.infer<typeof LeadScoreBreakdownSchema>;

export const LeadBuyingSignalSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  strength: z.enum(['low', 'medium', 'high', 'critical']),
  detectedAt: z.string(),
  description: z.string().optional(),
  scoreImpact: z.number().optional(),
});
export type LeadBuyingSignal = z.infer<typeof LeadBuyingSignalSchema>;

export const LeadEnrichmentDataSchema = z.object({
  scannedAt: z.string(),
  technologies: z.array(z.string()),
  sslValid: z.boolean(),
  loadTimeMs: z.number().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  verifiedEmailsCount: z.number(),
});
export type LeadEnrichmentData = z.infer<typeof LeadEnrichmentDataSchema>;

export const LeadEntitySummarySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  domain: z.string(),
  industry: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  syncStatus: z.enum(['unregistered', 'synced']),
  syncedEntityId: z.string().optional(),
});
export type LeadEntitySummary = z.infer<typeof LeadEntitySummarySchema>;

export const LeadIntelligenceDossierSchema = z.object({
  prospectId: z.string(),
  organizationId: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  domain: z.string(),
  industry: z.string().optional(),
  address: z.string().optional(),
  contacts: z.array(LeadContactSchema),
  scoring: LeadScoreBreakdownSchema,
  technologies: z.array(z.string()),
  buyingSignals: z.array(LeadBuyingSignalSchema),
  enrichment: LeadEnrichmentDataSchema.optional(),
  assembledAt: z.string(),
});
export type LeadIntelligenceDossier = z.infer<typeof LeadIntelligenceDossierSchema>;

export const AssembleLeadContextInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  prospectId: z.string().min(1),
  includeSignals: z.boolean().default(true),
  includeDossier: z.boolean().default(true),
  maxTokens: z.number().default(4000),
});
export type AssembleLeadContextInput = z.infer<typeof AssembleLeadContextInputSchema>;

export const LeadSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  industry: z.string().optional(),
  score: z.number(),
  priorityTier: z.enum(['critical', 'high', 'medium', 'low']),
  contactsCount: z.number(),
  verifiedContactsCount: z.number(),
  syncStatus: z.enum(['unregistered', 'synced']),
  syncedEntityId: z.string().optional(),
});
export type LeadSearchResult = z.infer<typeof LeadSearchResultSchema>;

export const LeadPitchRecommendationSchema = z.object({
  prospectId: z.string(),
  pitchText: z.string(),
  targetPersona: z.string(),
  valuePropositions: z.array(z.string()),
  groundingPoints: z.array(z.string()),
  confidence: z.number().min(0).max(100),
});
export type LeadPitchRecommendation = z.infer<typeof LeadPitchRecommendationSchema>;

export const LeadObjectionHandlerSchema = z.object({
  objection: z.string(),
  counter: z.string(),
  evidence: z.array(z.string()).default([]),
});
export type LeadObjectionHandler = z.infer<typeof LeadObjectionHandlerSchema>;

export const MarketResearchParamsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  industry: z.string().min(1),
  region: z.string().min(1),
  targetAudience: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});
export type MarketResearchParams = z.infer<typeof MarketResearchParamsSchema>;

export const MarketResearchResultSchema = z.object({
  researchId: z.string().min(1),
  industry: z.string(),
  region: z.string(),
  tamSamEstimate: z.string(),
  marketTrends: z.array(z.string()),
  highIntentTriggers: z.array(z.string()),
  recommendedAngles: z.array(z.string()),
  icpRecommendations: z.array(z.string()),
  sourcesCount: z.number().int().min(0),
  researchedAt: z.string(),
  idempotencyKey: z.string(),
});
export type MarketResearchResult = z.infer<typeof MarketResearchResultSchema>;
