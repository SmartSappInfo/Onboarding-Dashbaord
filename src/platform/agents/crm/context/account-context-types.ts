/**
 * @fileOverview Canonical Domain Contracts: 360° Account Context & Timeline (Phase 9 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Zod v4 schema validation), Rule 13/30 (Untrusted Reference Data XML containerization),
 * Rule 28/56 (Knapsack context budgeting <= 4,000 tokens), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - `Account360Context` is the foundational payload that powers all downstream CRM agents:
 *   CRM Assistant, CRM Researcher, Lead Analyst, Deal Strategist, Task Coordinator, Knowledge Analyst.
 * - `AccountEntitySummary` represents the global identity master (`/entities/{entityId}`).
 * - `AccountWorkspaceEntitySummary` represents the workspace operational record (`/workspace_entities/{workspaceId}_{entityId}`).
 * - Any state modifications must target `AccountWorkspaceEntitySummary` and NEVER mutate global identity directly.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';

// ============================================================================
// 1. Entity & Workspace Entity Summaries (Rule 69 Dual-Tier CRM Preservation)
// ============================================================================

export const AccountEntitySummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().default('client'),
  status: z.string().default('active'),
  industry: z.string().default('general'),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const AccountWorkspaceEntitySummarySchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  pipelineId: z.string().nullable().optional(),
  stageId: z.string().nullable().optional(),
  stageName: z.string().nullable().optional(),
  assignedTo: z
    .object({
      userId: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  workspaceTags: z.array(z.string()).default([]),
  leadStatus: z.string().nullable().optional(),
  updatedAt: z.string(),
});

// ============================================================================
// 2. Contacts, Deals, Meetings & Notes Summaries
// ============================================================================

export const AccountContactSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  channelPreferences: z.array(z.string()).default([]),
});

export const AccountDealSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  stageName: z.string().min(1),
  value: z.number().default(0),
  currency: z.string().default('USD'),
  probability: z.number().min(0).max(100).default(50),
  ageInDays: z.number().int().min(0).default(0),
  expectedCloseDate: z.string().nullable().optional(),
  isStalled: z.boolean().default(false),
});

export const AccountMeetingSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startTime: z.string(),
  attendees: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  transcriptSnippet: z.string().nullable().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'unknown']).default('unknown'),
  isolatedContent: z.string().optional(),
});

export const AccountNoteSummarySchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  isolatedContent: z.string().optional(),
  authorName: z.string().nullable().optional(),
  createdAt: z.string(),
  category: z.string().default('general'),
});

// ============================================================================
// 3. Tasks, Finances & Semantic Memories
// ============================================================================

export const AccountTaskSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  isOverdue: z.boolean().default(false),
});

export const AccountFinancialSummarySchema = z.object({
  openBalance: z.number().default(0),
  overdueBalance: z.number().default(0),
  currency: z.string().default('USD'),
  invoiceCount: z.number().int().default(0),
  agingCategory: z.enum(['CURRENT', 'OVERDUE_30', 'OVERDUE_60', 'OVERDUE_90_PLUS', 'CLEAR']).default('CLEAR'),
});

export const AccountMemoryFactSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  sourceType: z.string().default('note'),
  confidence: z.number().min(0).max(1).default(1),
  citationId: z.string().min(1),
});

// ============================================================================
// 4. Normalized Account Timeline Item (Milestone 1 Core)
// ============================================================================

export const AccountTimelineItemSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  category: z.enum(['COMMERCIAL', 'ENGAGEMENT', 'OPERATIONAL', 'FINANCIAL', 'ADMINISTRATIVE']),
  title: z.string().min(1),
  summary: z.string(),
  actor: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceRef: z.object({
    type: z.enum(['note', 'meeting', 'deal', 'task', 'invoice', 'tag', 'communication']),
    id: z.string().min(1),
  }),
});

// ============================================================================
// 5. Account 360 Context Package & Assembled Metadata
// ============================================================================

export const AccountContextMetadataSchema = z.object({
  assembledAt: z.string(),
  durationMs: z.number().nonnegative(),
  estimatedTokens: z.number().int().nonnegative(),
  correlationId: z.string().min(1),
  isKnapsackCompressed: z.boolean().default(false),
  rawItemCounts: z.record(z.string(), z.number()).optional(),
});

export const Account360ContextSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  entity: AccountEntitySummarySchema,
  workspaceEntity: AccountWorkspaceEntitySummarySchema.nullable().optional(),
  contacts: z.array(AccountContactSummarySchema).default([]),
  deals: z.array(AccountDealSummarySchema).default([]),
  meetings: z.array(AccountMeetingSummarySchema).default([]),
  notes: z.array(AccountNoteSummarySchema).default([]),
  tasks: z.array(AccountTaskSummarySchema).default([]),
  finances: AccountFinancialSummarySchema,
  memories: z.array(AccountMemoryFactSchema).default([]),
  timeline: z.array(AccountTimelineItemSchema).default([]),
  metadata: AccountContextMetadataSchema,
});

export const AssembleAccountContextOptionsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  maxTokens: z.number().int().min(500).max(8000).default(4000),
  includeMemory: z.boolean().default(true),
  includeFinancials: z.boolean().default(true),
  correlationId: z.string().optional(),
  signal: z.instanceof(AbortSignal).optional(),
});

// TypeScript Types Derived from Zod Schemas
export type AccountEntitySummary = z.infer<typeof AccountEntitySummarySchema>;
export type AccountWorkspaceEntitySummary = z.infer<typeof AccountWorkspaceEntitySummarySchema>;
export type AccountContactSummary = z.infer<typeof AccountContactSummarySchema>;
export type AccountDealSummary = z.infer<typeof AccountDealSummarySchema>;
export type AccountMeetingSummary = z.infer<typeof AccountMeetingSummarySchema>;
export type AccountNoteSummary = z.infer<typeof AccountNoteSummarySchema>;
export type AccountTaskSummary = z.infer<typeof AccountTaskSummarySchema>;
export type AccountFinancialSummary = z.infer<typeof AccountFinancialSummarySchema>;
export type AccountMemoryFact = z.infer<typeof AccountMemoryFactSchema>;
export type AccountTimelineItem = z.infer<typeof AccountTimelineItemSchema>;
export type AccountContextMetadata = z.infer<typeof AccountContextMetadataSchema>;
export type Account360Context = z.infer<typeof Account360ContextSchema>;
export type AssembleAccountContextInput = z.input<typeof AssembleAccountContextOptionsSchema>;
export type AssembleAccountContextOptions = z.infer<typeof AssembleAccountContextOptionsSchema>;

// ============================================================================
// 6. Error Taxonomy & Typed Domain Error (Rule 48)
// ============================================================================

export const ACCOUNT_CONTEXT_ERROR_CODES = {
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  GOVERNANCE_PAUSED: 'GOVERNANCE_PAUSED',
  CONTEXT_ASSEMBLY_TIMEOUT: 'CONTEXT_ASSEMBLY_TIMEOUT',
  CANCELLED: 'CANCELLED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
} as const;

export type AccountContextErrorCode = keyof typeof ACCOUNT_CONTEXT_ERROR_CODES;

export class AccountContextError extends Error {
  public readonly code: AccountContextErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: AccountContextErrorCode,
    statusCode = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AccountContextError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AccountContextError.prototype);
  }
}
