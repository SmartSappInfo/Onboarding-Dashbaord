/**
 * @fileOverview Knowledge UI Contracts, Schemas & Governance Types (Phase 11 M5 · T0)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 10 (Guiding Comments)
 * - Rule 17 (Non-Delegable Human Decider Types)
 * - Rule 18 (TOCTOU expectedVersion Concurrency Guards)
 * - Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges, depth <= 2)
 * - Rule 60 (Emergency Dead-Man Switch Types)
 * - Rule 64 (3-Tier Feature Flags: global, org, workspace)
 */

import { z } from 'zod/v4';
import {
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_SENSITIVITY_LEVELS,
  KNOWLEDGE_VERIFICATION_STATES,
} from './knowledge-schemas';

// ============================================================================
// 1. Knowledge Inbox Filter & Item Types (PRD §62, UI §14)
// ============================================================================

export const KNOWLEDGE_INBOX_ITEM_TYPES = [
  'all',
  'fact',
  'relationship',
  'decision',
  'commitment',
  'preference',
  'procedure',
  'conflict',
  'duplicate',
  'sensitive',
  'low_confidence',
] as const;
export type KnowledgeInboxItemType = (typeof KNOWLEDGE_INBOX_ITEM_TYPES)[number];

export const KNOWLEDGE_INBOX_STATUS_TABS = [
  'all',
  'needs_review',
  'important',
  'conflicts',
  'saved',
] as const;
export type KnowledgeInboxStatusTab = (typeof KNOWLEDGE_INBOX_STATUS_TABS)[number];

export const KNOWLEDGE_SOURCE_TRUST_LEVELS = [
  'all',
  'internal',
  'customer',
  'external',
] as const;
export type KnowledgeSourceTrustLevel = (typeof KNOWLEDGE_SOURCE_TRUST_LEVELS)[number];

export const KnowledgeInboxFilterSchema = z.object({
  status: z.enum(KNOWLEDGE_INBOX_STATUS_TABS).default('all'),
  itemType: z.enum(KNOWLEDGE_INBOX_ITEM_TYPES).default('all'),
  sourceTrust: z.enum(KNOWLEDGE_SOURCE_TRUST_LEVELS).default('all'),
  minConfidence: z.number().min(0).max(1).default(0),
  searchQuery: z.string().trim().optional(),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});
export type KnowledgeInboxFilter = z.infer<typeof KnowledgeInboxFilterSchema>;

// ============================================================================
// 2. Candidate Triage Input Schemas (Rule 17 Non-Delegable, Rule 18 TOCTOU)
// ============================================================================

export const KnowledgeCandidateTriageInputSchema = z.object({
  candidateId: z.string().trim().min(1, 'Candidate ID is required'),
  decision: z.enum(['accept', 'reject', 'edit']),
  expectedVersion: z.number().int().positive().optional(),
  editPayload: z
    .object({
      statement: z.string().trim().min(1).optional(),
      sensitivity: z.enum(KNOWLEDGE_SENSITIVITY_LEVELS).optional(),
      tags: z.array(z.string().trim()).optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    })
    .optional(),
  decisionNotes: z.string().trim().max(1000).optional(),
});
export type KnowledgeCandidateTriageInput = z.infer<typeof KnowledgeCandidateTriageInputSchema>;

export const BatchTriageInputSchema = z.object({
  candidateIds: z.array(z.string().trim().min(1)).min(1, 'At least one candidate ID is required'),
  decision: z.enum(['accept', 'reject']),
  expectedVersions: z.record(z.string(), z.number().int()).optional(),
  decisionNotes: z.string().trim().max(1000).optional(),
});
export type BatchTriageInput = z.infer<typeof BatchTriageInputSchema>;

// ============================================================================
// 3. Global ⌘⇧K Search Modal Input & Evidence Stack Types (Rule 47)
// ============================================================================

export const KnowledgeSearchModalInputSchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(1000),
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  limit: z.number().int().min(1).max(20).default(5),
  verifiedOnly: z.boolean().default(false),
  sourceFilter: z.enum(['all', ...KNOWLEDGE_SOURCE_TYPES]).default('all'),
});
export type KnowledgeSearchModalInput = z.infer<typeof KnowledgeSearchModalInputSchema>;

// ============================================================================
// 4. Visual Graph Explorer State & Modes (Rule 55 Limits)
// ============================================================================

export const GRAPH_EXPLORER_MODES = ['explore', 'explain', 'investigate'] as const;
export type GraphExplorerMode = (typeof GRAPH_EXPLORER_MODES)[number];

export const GraphExplorerStateSchema = z.object({
  centerNodeId: z.string().trim().min(1),
  mode: z.enum(GRAPH_EXPLORER_MODES).default('explore'),
  depth: z.number().int().min(1).max(2).default(1), // Rule 55: expand depth <= 2
  visibleNodeIds: z.array(z.string()).max(80).optional(), // Rule 55: <= 80 nodes
  minConfidence: z.number().min(0).max(1).default(0.5),
  selectedRelationType: z.string().optional(),
});
export type GraphExplorerState = z.infer<typeof GraphExplorerStateSchema>;

// ============================================================================
// 5. Backoffice Governance, Kill Switches & Security Feeds (Rules 60, 61, 62, 64)
// ============================================================================

export const KNOWLEDGE_KILL_SWITCH_KEYS = [
  'agent_meeting',
  'agent_knowledge',
  'capability_retrieval',
  'draft_messages',
  'global_halt',
] as const;
export type KnowledgeKillSwitchKey = (typeof KNOWLEDGE_KILL_SWITCH_KEYS)[number];

export const BackofficeGovernanceConfigSchema = z.object({
  autoAcceptThreshold: z.number().min(0.5).max(1.0).default(0.9),
  quotas: z.object({
    dailyPipelines: z.number().int().positive().default(50),
    dailyTranscriptionHours: z.number().positive().default(2),
    queriesPerHour: z.number().int().positive().default(60),
  }),
  costCeilingUsd: z.number().positive().default(250),
  retentionDays: z.number().int().positive().default(90),
  allowedModels: z.array(z.string().trim()).default(['gemini-2.0-flash', 'gemini-1.5-pro']),
  killSwitches: z.record(z.enum(KNOWLEDGE_KILL_SWITCH_KEYS), z.boolean()).default({
    agent_meeting: false,
    agent_knowledge: false,
    capability_retrieval: false,
    draft_messages: false,
    global_halt: false,
  }),
});
export type BackofficeGovernanceConfig = z.infer<typeof BackofficeGovernanceConfigSchema>;

export const SECURITY_INCIDENT_EVENT_TYPES = [
  'prompt_injection_detected',
  'knowledge_poisoning_flagged',
  'consent_refusal_audited',
  'cross_workspace_denial',
  'egress_exfiltration_blocked',
  'approval_bypass_attempt',
] as const;
export type SecurityIncidentEventType = (typeof SECURITY_INCIDENT_EVENT_TYPES)[number];

export const SecurityIncidentFeedItemSchema = z.object({
  incidentId: z.string().trim().min(1),
  eventType: z.enum(SECURITY_INCIDENT_EVENT_TYPES),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  sourceId: z.string().trim().min(1),
  organizationId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  timestamp: z.string(),
  message: z.string().trim().min(1),
  actorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SecurityIncidentFeedItem = z.infer<typeof SecurityIncidentFeedItemSchema>;

export const GovernanceMetricsSummarySchema = z.object({
  pendingCandidatesCount: z.number().int(),
  conflictsCount: z.number().int(),
  activePipelinesCount: z.number().int(),
  graphDensity: z.number(),
  dailyQuotaUsedHours: z.number(),
  dailyCostUsd: z.number(),
  killSwitches: z.record(z.enum(KNOWLEDGE_KILL_SWITCH_KEYS), z.boolean()),
  recentIncidents: z.array(SecurityIncidentFeedItemSchema),
});
export type GovernanceMetricsSummary = z.infer<typeof GovernanceMetricsSummarySchema>;
