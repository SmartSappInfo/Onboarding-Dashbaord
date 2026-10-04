/**
 * @fileOverview Context Rail & CRM Intelligence Zod Contracts (Phase 8 Milestone 4)
 *
 * Implements Rule 4 (Zero any/any[] strict typing), Rule 10 (Canonical Zod v4 schemas),
 * Rule 12 (Risk Level Integration), Rule 13 & 30 (Untrusted boundary isolation),
 * and Rule 28/56 (Knapsack context budgeting ceilings).
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. ERROR TAXONOMY (Rule 48)
// ============================================================================

export const CONTEXT_RAIL_ERROR_CODES = {
  TENANT_REQUIRED: 'TENANT_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  CONTEXT_DEAD_MAN_PAUSED: 'CONTEXT_DEAD_MAN_PAUSED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  DRAWER_MOUNT_FAILED: 'DRAWER_MOUNT_FAILED',
  COMMAND_EXECUTION_FAILED: 'COMMAND_EXECUTION_FAILED',
} as const;

export type ContextRailErrorCode =
  (typeof CONTEXT_RAIL_ERROR_CODES)[keyof typeof CONTEXT_RAIL_ERROR_CODES];

// ============================================================================
// 2. MODULE 1: ENTITY DOSSIER SUMMARY
// ============================================================================

export const EntityDossierSummarySchema = z.object({
  id: z.string().min(1),
  entityId: z.string().optional(),
  type: z.string().min(1),
  entityType: z.string().optional(),
  name: z.string().min(1),
  status: z.string().default('active'),
  tier: z.string().optional(),
  avatarUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  keyFacts: z.array(z.string()).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
  lastInteractionAt: z.string().default(() => new Date().toISOString()),
  healthScore: z.number().min(0).max(100).optional(),
  primaryEmail: z.string().optional(),
  primaryPhone: z.string().optional(),
  assignedOwner: z
    .object({
      id: z.string(),
      name: z.string(),
      avatarUrl: z.string().optional(),
    })
    .optional(),
});
export type EntityDossierSummary = z.infer<typeof EntityDossierSummarySchema>;
export type EntityDossier = EntityDossierSummary;

// ============================================================================
// 3. MODULE 2: RELATED ENTITIES MESH
// ============================================================================

export const RelatedEntityNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  relationType: z.string().min(1),
  relationship: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  href: z.string().optional(),
  status: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  targetUrl: z.string().default('#'),
});
export type RelatedEntityNode = z.infer<typeof RelatedEntityNodeSchema>;
export type RelatedEntityRef = RelatedEntityNode;

// ============================================================================
// 4. MODULE 3: INSTITUTIONAL MEMORY & CITATIONS
// ============================================================================

export const ContextMemoryItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  snippet: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  author: z.string().default('SmartSapp AI'),
  confidence: z.number().min(0).max(1).default(0.85),
  createdAt: z.string().min(1),
  tags: z.array(z.string()).default([]),
  sensitivity: z.string().optional(),
});
export type ContextMemoryItem = z.infer<typeof ContextMemoryItemSchema>;
export type InstitutionalMemoryItem = ContextMemoryItem;

// ============================================================================
// 5. MODULE 4: RELATIONSHIP HEALTH METER
// ============================================================================

export const HealthBandSchema = z.enum([
  'critical',
  'at_risk',
  'neutral',
  'healthy',
  'champion',
  'excellent',
  'good',
  'fair',
]);
export type HealthBand = z.infer<typeof HealthBandSchema>;

export const HealthSignalsSchema = z.object({
  recencyScore: z.number().min(0).max(100).default(80),
  activityFrequencyScore: z.number().min(0).max(100).default(80),
  sentimentScore: z.number().min(0).max(100).default(80),
  engagementDepthScore: z.number().min(0).max(100).default(80),
});
export type HealthSignals = z.infer<typeof HealthSignalsSchema>;

export const RelationshipHealthSchema = z.object({
  score: z.number().min(0).max(100),
  healthBand: HealthBandSchema.default('healthy'),
  band: HealthBandSchema.default('healthy'),
  trend: z.enum(['improving', 'stable', 'declining']).default('stable'),
  signals: HealthSignalsSchema.default({
    recencyScore: 80,
    activityFrequencyScore: 80,
    sentimentScore: 80,
    engagementDepthScore: 80,
  }),
  positiveSignals: z.array(z.string()).default([]),
  riskSignals: z.array(z.string()).default([]),
  factors: z.array(z.string()).default([]),
  lastContactDaysAgo: z.number().min(0).default(0),
  lastEvaluatedAt: z.string().default(() => new Date().toISOString()),
});
export type RelationshipHealth = z.infer<typeof RelationshipHealthSchema>;

// ============================================================================
// 6. MODULE 5: ACTIVE AGENT RUNS
// ============================================================================

export const ContextRailRunSummarySchema = z.object({
  id: z.string().min(1),
  runId: z.string().optional(),
  goal: z.string().min(1),
  goalDescription: z.string().optional(),
  status: z.string().min(1),
  personaName: z.string().min(1),
  personaId: z.string().optional(),
  startedAt: z.string().optional(),
  createdAt: z.string().min(1),
  totalTokens: z.number().optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  stepProgress: z
    .object({
      completed: z.number().min(0),
      total: z.number().min(0),
    })
    .default({ completed: 0, total: 1 }),
  viewUrl: z.string().default('#'),
});
export type ContextRailRunSummary = z.infer<typeof ContextRailRunSummarySchema>;
export type ActiveAgentRunSummary = ContextRailRunSummary;

// ============================================================================
// 7. MODULE 6: PENDING APPROVALS
// ============================================================================

export const ContextRailProposalSummarySchema = z.object({
  id: z.string().min(1),
  proposalId: z.string().optional(),
  actionType: z.string().min(1),
  actionName: z.string().optional(),
  targetEntityName: z.string().default('Target Entity'),
  riskLevel: z.string().min(1),
  what: z.string().min(1),
  why: z.string().min(1),
  createdAt: z.string().min(1),
  payloadHash: z.string().default(''),
  requiresOperatorIntervention: z.boolean().default(false),
  reviewUrl: z.string().default('#'),
});
export type ContextRailProposalSummary = z.infer<typeof ContextRailProposalSummarySchema>;
export type PendingApprovalSummary = ContextRailProposalSummary;

// ============================================================================
// 8. COMPOSITE CONTEXT RAIL DATA
// ============================================================================

export const EntityContextRailDataSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  entityName: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  dossier: EntityDossierSummarySchema,
  relatedEntities: z.array(RelatedEntityNodeSchema).default([]),
  memories: z.array(ContextMemoryItemSchema).default([]),
  health: RelationshipHealthSchema,
  activeRuns: z.array(ContextRailRunSummarySchema).default([]),
  pendingApprovals: z.array(ContextRailProposalSummarySchema).default([]),
});
export type EntityContextRailData = z.infer<typeof EntityContextRailDataSchema>;

// ============================================================================
// 9. CRM "ASK ABOUT THIS" INPUTS & RESULTS
// ============================================================================

export const AskEntityAiInputSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  entityName: z.string().min(1),
  query: z.string().min(1).max(1000),
  promptTemplate: z.string().optional(),
  maxTokens: z.number().min(100).max(4000).default(2000), // Rule 28 & 56 ceiling <= 4000 tokens
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
});
export type AskEntityAiInput = z.input<typeof AskEntityAiInputSchema>;
export type AskEntityAiResolved = z.output<typeof AskEntityAiInputSchema>;

export const EntityCitationSchema = z.object({
  id: z.string().min(1),
  citationTag: z.string().min(1), // e.g. "[citation:1]"
  verbatimSnippet: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  author: z.string().default('System'),
  confidence: z.number().min(0).max(1).default(0.85),
});
export type EntityCitation = z.infer<typeof EntityCitationSchema>;

export const AskEntityAiResultSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(EntityCitationSchema).default([]),
  tokenCount: z.number().min(0),
  latencyMs: z.number().min(0),
});
export type AskEntityAiResult = z.infer<typeof AskEntityAiResultSchema>;

// ============================================================================
// 10. UNIVERSAL OBJECT COMMAND MENU INPUTS & RESULTS
// ============================================================================

export const ObjectCommandTypeSchema = z.enum([
  'ask_ai',
  'summarize',
  'find_related',
  'create_task',
  'launch_agent_run',
  'add_to_workflow',
]);
export type ObjectCommandType = z.infer<typeof ObjectCommandTypeSchema>;

export const ObjectCommandActionInputSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  commandType: ObjectCommandTypeSchema,
  entityName: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
});
export type ObjectCommandActionInput = z.input<typeof ObjectCommandActionInputSchema>;

export const ObjectCommandResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  actionTargetUrl: z.string().optional(), // No Dead Ends §81
  resultData: z.record(z.string(), z.unknown()).optional(),
});
export type ObjectCommandResult = z.infer<typeof ObjectCommandResultSchema>;
