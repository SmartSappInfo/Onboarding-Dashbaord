/**
 * @fileOverview Agent Builder & Policy Editor Zod Contracts (Phase 8 Milestone 5)
 *
 * Implements Rule 4 (Zero any/any[] strict typing), Rule 10 (Canonical Zod v4 schemas),
 * Rule 12 (Risk Level Integration), Rule 13 & 30 (Untrusted boundary isolation),
 * Rule 16 & 17 (Attenuated scopes & non-delegable actions), Rule 23 (Resource ceilings:
 * delegation depth <= 4, max tokens <= 100k, max tool calls <= 30),
 * Rule 34 (Outbound SSRF validation), Rule 42 (Shadow Simulation Mode),
 * Rule 60 (Emergency Dead-Man Switch), and Rule 65 (Canary Releases & Staging Drafts).
 */

import { z } from 'zod/v4';
import { CAPABILITY_DOMAINS } from '@/platform/capabilities/contracts/capability-definition';
import { RISK_LEVELS } from '@/platform/capabilities/contracts/risk-levels';

// ============================================================================
// 1. ERROR TAXONOMY (Rule 48)
// ============================================================================

export const AGENT_BUILDER_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  BUILDER_DEAD_MAN_PAUSED: 'BUILDER_DEAD_MAN_PAUSED',
  PERSONA_NOT_FOUND: 'PERSONA_NOT_FOUND',
  INVALID_SLUG: 'INVALID_SLUG',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  SSRF_DETECTED: 'SSRF_DETECTED',
  INVALID_PERMISSIONS: 'INVALID_PERMISSIONS',
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type AgentBuilderErrorCode =
  (typeof AGENT_BUILDER_ERROR_CODES)[keyof typeof AGENT_BUILDER_ERROR_CODES];

// ============================================================================
// 2. PANEL 1: IDENTITY & PURPOSE CONFIGURATION
// ============================================================================

export const IdentityPurposeConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(64, 'Name must be 64 characters or fewer'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(32, 'Slug must be 32 characters or fewer')
    .regex(/^[a-z0-9_]+$/, 'Slug must contain only lowercase alphanumeric characters and underscores'),
  avatarIcon: z.string().default('Bot'),
  role: z.string().min(1, 'Role title is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  systemPromptSnippet: z.string().min(1, 'System prompt is required').max(4000),
});

export type IdentityPurposeConfig = z.infer<typeof IdentityPurposeConfigSchema>;

// ============================================================================
// 3. PANEL 2: CAPABILITIES & DOMAIN SCOPES CONFIGURATION (Rule 16 & 17)
// ============================================================================

export const CapabilitiesDomainConfigSchema = z.object({
  allowedDomains: z.array(z.enum(CAPABILITY_DOMAINS)).min(1, 'Select at least one domain scope'),
  allowedCapabilities: z.array(z.string()).default([]),
  maxAutonomousRiskLevel: z.enum(RISK_LEVELS).default('L1_INTERNAL_DRAFT'),
});

export type CapabilitiesDomainConfig = z.infer<typeof CapabilitiesDomainConfigSchema>;

// ============================================================================
// 4. PANEL 3: MEMORY & KNOWLEDGE TIERS CONFIGURATION
// ============================================================================

export const MemoryTierEnum = z.enum([
  'working',
  'episodic',
  'semantic',
  'relational',
  'procedural',
]);
export type MemoryTier = z.infer<typeof MemoryTierEnum>;

export const DecayPresetEnum = z.enum(['fast', 'standard', 'persistent']);
export type DecayPreset = z.infer<typeof DecayPresetEnum>;

export const MemoryKnowledgeConfigSchema = z.object({
  enabledTiers: z.array(MemoryTierEnum).default(['working', 'semantic']),
  decayPreset: DecayPresetEnum.default('standard'),
  retrievalTokenLimit: z.number().int().min(500).max(4000).default(2000),
  searchThreshold: z.number().min(0.1).max(1.0).default(0.7),
});

export type MemoryKnowledgeConfig = z.infer<typeof MemoryKnowledgeConfigSchema>;

// ============================================================================
// 5. PANEL 4: GOVERNANCE & POLICIES CONFIGURATION (Rule 21 & 23)
// ============================================================================

export const GovernancePolicyConfigSchema = z.object({
  maxAutonomousRiskLevel: z.enum(RISK_LEVELS).default('L1_INTERNAL_DRAFT'),
  mandatoryApprovalRiskLevels: z
    .array(z.enum(RISK_LEVELS))
    .default(['L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE']),
  delegationDepthCeiling: z.number().int().min(1).max(4).default(2), // Rule 23: <= 4
  requireHumanIntervention: z.boolean().default(false),
  allowedEnvironments: z
    .array(z.enum(['development', 'staging', 'production']))
    .default(['development', 'staging', 'production']),
});

export type GovernancePolicyConfig = z.infer<typeof GovernancePolicyConfigSchema>;

// ============================================================================
// 6. PANEL 5: MODELS & BUDGETS CONFIGURATION (Rule 23 & 58)
// ============================================================================

export const ModelTierEnum = z.enum(['flash', 'pro']);
export type ModelTier = z.infer<typeof ModelTierEnum>;

export const FallbackModelTierEnum = z.enum(['flash', 'none']);
export type FallbackModelTier = z.infer<typeof FallbackModelTierEnum>;

export const AgentBudgetsConfigSchema = z.object({
  maxDurationMs: z.number().int().min(1000).max(300000).default(120000),
  maxTokens: z.number().int().min(1000).max(100000).default(50000), // Rule 23 ceiling: <= 100k
  maxToolCalls: z.number().int().min(1).max(30).default(15), // Rule 23 ceiling: <= 30
  maxRecordsMutated: z.number().int().min(0).max(100).default(25),
  costBudgetUsd: z.number().min(0.01).max(100.0).default(5.0),
});

export type AgentBudgetsConfig = z.infer<typeof AgentBudgetsConfigSchema>;

export const ModelsBudgetsConfigSchema = z.object({
  primaryModelTier: ModelTierEnum.default('flash'),
  fallbackModelTier: FallbackModelTierEnum.default('flash'),
  budgets: AgentBudgetsConfigSchema.default({
    maxDurationMs: 120000,
    maxTokens: 50000,
    maxToolCalls: 15,
    maxRecordsMutated: 25,
    costBudgetUsd: 5.0,
  }),
});

export type ModelsBudgetsConfig = z.infer<typeof ModelsBudgetsConfigSchema>;

// ============================================================================
// 7. PANEL 6: TRIGGERS & OUTPUTS CONFIGURATION (Rule 34 SSRF)
// ============================================================================

export const TriggerTypeEnum = z.enum(['manual', 'event', 'cron', 'webhook']);
export type TriggerType = z.infer<typeof TriggerTypeEnum>;

export const TriggersOutputsConfigSchema = z.object({
  triggerType: TriggerTypeEnum.default('manual'),
  eventSubscriptions: z.array(z.string()).default([]),
  cronSchedule: z.string().optional(),
  webhookUrl: z.string().url('Invalid webhook URL format').optional(),
  enabledNotificationChannels: z
    .array(z.enum(['in_app', 'email', 'slack']))
    .default(['in_app']),
});

export type TriggersOutputsConfig = z.infer<typeof TriggersOutputsConfigSchema>;

// ============================================================================
// 8. COMPOSITE CUSTOM AGENT PERSONA SCHEMA (Rule 65)
// ============================================================================

export const PersonaStatusEnum = z.enum(['draft', 'published', 'archived']);
export type PersonaStatus = z.infer<typeof PersonaStatusEnum>;

export const CustomAgentPersonaSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow SemVer format (e.g. 1.0.0)'),
  status: PersonaStatusEnum.default('draft'),
  isBuiltIn: z.boolean().default(false),
  identity: IdentityPurposeConfigSchema,
  capabilities: CapabilitiesDomainConfigSchema,
  memory: MemoryKnowledgeConfigSchema,
  governance: GovernancePolicyConfigSchema,
  modelsAndBudgets: ModelsBudgetsConfigSchema,
  triggers: TriggersOutputsConfigSchema,
  publishedVersion: z.string().optional(),
  authorId: z.string().default('user'),
  authorName: z.string().default('Operator'),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().optional(),
});

export type CustomAgentPersona = z.infer<typeof CustomAgentPersonaSchema>;

export const CreateAgentPersonaInputSchema = z.object({
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  identity: IdentityPurposeConfigSchema,
  capabilities: CapabilitiesDomainConfigSchema.optional(),
  memory: MemoryKnowledgeConfigSchema.optional(),
  governance: GovernancePolicyConfigSchema.optional(),
  modelsAndBudgets: ModelsBudgetsConfigSchema.optional(),
  triggers: TriggersOutputsConfigSchema.optional(),
});

export type CreateAgentPersonaInput = z.input<typeof CreateAgentPersonaInputSchema>;

export const UpdateAgentPersonaInputSchema = z.object({
  personaId: z.string().min(1),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  identity: IdentityPurposeConfigSchema.partial().optional(),
  capabilities: CapabilitiesDomainConfigSchema.partial().optional(),
  memory: MemoryKnowledgeConfigSchema.partial().optional(),
  governance: GovernancePolicyConfigSchema.partial().optional(),
  modelsAndBudgets: ModelsBudgetsConfigSchema.partial().optional(),
  triggers: TriggersOutputsConfigSchema.partial().optional(),
});

export type UpdateAgentPersonaInput = z.input<typeof UpdateAgentPersonaInputSchema>;

export const PublishAgentPersonaInputSchema = z.object({
  personaId: z.string().min(1),
  versionBump: z.enum(['patch', 'minor', 'major']).default('patch'),
  changeNotes: z.string().optional(),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
});

export type PublishAgentPersonaInput = z.input<typeof PublishAgentPersonaInputSchema>;

// ============================================================================
// 9. VERSION DIFF CONTRACTS (theme.md §8 & Rule 65)
// ============================================================================

export const DiffFieldChangeSchema = z.object({
  field: z.string(),
  label: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
});
export type DiffFieldChange = z.infer<typeof DiffFieldChangeSchema>;

export const AgentVersionDiffSchema = z.object({
  personaId: z.string(),
  personaName: z.string(),
  previousVersion: z.string(),
  targetVersion: z.string(),
  fieldChanges: z.array(DiffFieldChangeSchema),
  permissionsAdded: z.array(z.string()),
  permissionsRemoved: z.array(z.string()),
  riskEscalated: z.boolean(),
  budgetIncreased: z.boolean(),
  hasChanges: z.boolean(),
});
export type AgentVersionDiff = z.infer<typeof AgentVersionDiffSchema>;

// ============================================================================
// 10. TEST LAB SANDBOX CONTRACTS (Rule 42 Shadow Simulation)
// ============================================================================

export const AgentTestLabInputSchema = z.object({
  personaId: z.string().min(1),
  goalPrompt: z.string().min(1, 'Goal prompt is required').max(1000),
  parameters: z.record(z.string(), z.unknown()).optional(),
  sampleEntityId: z.string().optional(),
  sampleEntityType: z.string().optional(),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export type AgentTestLabInput = z.input<typeof AgentTestLabInputSchema>;

export const BlastRadiusSummarySchema = z.object({
  totalSimulatedSteps: z.number().int().min(0),
  mutationsInterceptedCount: z.number().int().min(0),
  highRiskOperationsCount: z.number().int().min(0),
  nonDelegableOperationsCount: z.number().int().min(0),
  requiredApprovalsCount: z.number().int().min(0),
  estimatedTokensUsed: z.number().int().min(0),
  estimatedDurationMs: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0),
  overallRiskCategory: z.enum(RISK_LEVELS),
  zeroMutationsVerified: z.boolean().default(true),
});

export type BlastRadiusSummary = z.infer<typeof BlastRadiusSummarySchema>;

export const SimulatedStepTraceItemSchema = z.object({
  stepNumber: z.number().int().min(1),
  stepName: z.string(),
  capabilityId: z.string().optional(),
  riskLevel: z.enum(RISK_LEVELS).default('L0_READ'),
  simulatedAction: z.enum(['executed_read', 'intercepted_mutation', 'skipped']),
  what: z.string(),
  why: z.string(),
  expectedStateChange: z.string().optional(),
  requiresHumanApproval: z.boolean().default(false),
  simulatedOutputSnippet: z.string().default('{}'),
});

export type SimulatedStepTraceItem = z.infer<typeof SimulatedStepTraceItemSchema>;

export const AgentTestLabResultSchema = z.object({
  success: z.boolean(),
  personaId: z.string(),
  goalPrompt: z.string(),
  blastRadius: BlastRadiusSummarySchema,
  trace: z.array(SimulatedStepTraceItemSchema),
  message: z.string(),
  latencyMs: z.number().min(0),
});

export type AgentTestLabResult = z.infer<typeof AgentTestLabResultSchema>;
