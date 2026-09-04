/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Unified Context Builder Domain Models & Contracts
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Prompt & Agent Context:
 *    - Transforms disparate database facts, dense vectors, knowledge graph edges,
 *      and temporal memory objects into a permission-aware, relevance-scored,
 *      token-budgeted ContextPackage.
 * 2. Strict Zero-`any` Standard:
 *    - Wildcard types (`any`, `any[]`) are strictly prohibited in all contracts.
 * 3. 4-Tier Stratified Token Budgeting:
 *    - Tier 1 (Critical): Identity, active commercial deals, key stakeholders, conflict warnings.
 *    - Tier 2 (Relevant): High-scoring semantic memories, 1-hop relationships, upcoming meetings.
 *    - Tier 3 (Supporting): 2-hop graph neighbors, background notes, completed tasks.
 *    - Tier 4 (Discoverable): Peripheral mentions, archived context.
 * 4. Grounded Citation Traceability:
 *    - Every factual assertion or memory item MUST carry a `ContextSourceCitation`
 *      linking back to the authoritative source document.
 *
 * @testability Covered in `src/lib/memory/__tests__/context-builder.test.ts`.
 */

import type { MemoryObject, MemorySourceType } from './types';
import type { MemoryFreshnessInfo } from './orchestrator-types';

export type ContextSubjectType =
  | 'entity'
  | 'deal'
  | 'meeting'
  | 'campaign'
  | 'user'
  | 'workspace'
  | 'organization';

export type ContextSource =
  | 'crm'
  | 'memory'
  | 'graph'
  | 'deals'
  | 'meetings'
  | 'campaigns'
  | 'tasks'
  | 'conflicts';

export type ContextBudgetTier =
  | 'tier1_critical'
  | 'tier2_relevant'
  | 'tier3_supporting'
  | 'tier4_discoverable';

export type ContextDepth = 'shallow' | 'standard' | 'deep'; // shallow = 1 hop, standard = 2 hops, deep = 3 hops

export type ContextFreshness = 'realtime' | 'recent' | 'historical' | 'mixed';

export interface ContextSubject {
  id: string;
  type: ContextSubjectType;
  name: string;
  category?: string;
  stageName?: string;
  value?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ContextFact {
  id: string;
  key: string;
  label: string;
  value: string | number | boolean;
  confidence: number;
  tier: ContextBudgetTier;
  sourceCitationId?: string;
}

export interface ContextMemory {
  id: string;
  memory: MemoryObject;
  relevanceScore: number;
  effectiveScore: number;
  freshness: MemoryFreshnessInfo;
  tier: ContextBudgetTier;
  whyRelevant: string;
  citationId: string;
}

export interface ContextRelationship {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  targetNodeName: string;
  targetNodeType: string;
  relationshipType: string;
  hops: number;
  tier: ContextBudgetTier;
  citationId?: string;
}

export interface ContextEvent {
  id: string;
  eventType: string;
  timestamp: string;
  summary: string;
  authorName?: string;
  tier: ContextBudgetTier;
  citationId?: string;
}

export interface ContextAction {
  id: string;
  title: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignedToName?: string;
  tier: ContextBudgetTier;
  citationId?: string;
}

export interface ContextKnowledge {
  id: string;
  insight: string;
  confidence: number;
  occurrences: number;
  theme: string;
  tier: ContextBudgetTier;
  citationId?: string;
}

export interface ContextConflictWarning {
  id: string;
  summary: string;
  conflictType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  opposingAspects: string[];
  memoryIdA: string;
  memoryIdB: string;
  evidenceQuoteA: string;
  evidenceQuoteB: string;
  resolutionStatus: 'unresolved' | 'resolved' | 'ignored';
}

export interface ContextRecommendation {
  type: 'action' | 'talking_point' | 'risk_mitigation' | 'follow_up';
  title: string;
  description: string;
  reasoning: string;
  suggestedActionId?: string;
}

export interface ContextSourceCitation {
  id: string;
  sourceId: string;
  sourceType: MemorySourceType | ContextSource;
  title: string;
  quoteSnippet: string;
  timestamp: string;
  authorName?: string;
  confidence: number;
  deepLinkPath?: string;
}

export interface ContextTokenBudget {
  totalTokens: number;
  maxBudget: number;
  utilizationPercentage: number;
  tierBreakdown: {
    tier1Critical: number;
    tier2Relevant: number;
    tier3Supporting: number;
    tier4Discoverable: number;
  };
  truncatedItemCount: number;
  isTruncated: boolean;
}

export interface PermissionTrace {
  tenantId: string;
  workspaceId: string;
  authorizedRoles: string[];
  restrictedFieldCount: number;
  appliedFilters: string[];
}

export interface ContextBuildRequest {
  organizationId: string;
  workspaceId: string;
  requester?: {
    type: 'user' | 'agent';
    id: string;
  };
  objective: string;
  subject?: {
    type: ContextSubjectType;
    id: string;
  };
  requestedSources?: ContextSource[];
  maxTokens?: number;
  freshness?: ContextFreshness;
  depth?: ContextDepth;
  includeConflicts?: boolean;
}

export interface ContextPackage {
  contextId: string;
  workspaceId: string;
  organizationId: string;
  objective: string;
  subject?: ContextSubject;
  structuredFacts: ContextFact[];
  memories: ContextMemory[];
  relationships: ContextRelationship[];
  recentActivity: ContextEvent[];
  openActions: ContextAction[];
  relevantKnowledge: ContextKnowledge[];
  conflicts: ContextConflictWarning[];
  recommendations: ContextRecommendation[];
  sources: ContextSourceCitation[];
  tokenBudget: ContextTokenBudget;
  permissionsApplied: PermissionTrace;
  generatedAt: string;
  executionTimeMs: number;
}

export interface SubjectDossier {
  subjectId: string;
  subjectType: ContextSubjectType;
  title: string;
  subtitle?: string;
  executiveSummary: string;
  commercialOutlook: {
    stage?: string;
    dealValue?: number;
    winProbability?: number;
    revenueMomentum: 'strong' | 'stable' | 'at_risk' | 'dormant';
  };
  keyStakeholders: Array<{
    name: string;
    role: string;
    relationshipStatus: string;
    contactInfo?: string;
  }>;
  currentConcerns: string[];
  recentSignals: Array<{
    trend: 'up' | 'down' | 'neutral';
    label: string;
    description: string;
  }>;
  openCommitments: Array<{
    title: string;
    dueDate?: string;
    priority: string;
  }>;
  verifiedInstitutionalTruths: string[];
  activeConflictWarnings: ContextConflictWarning[];
  citations: ContextSourceCitation[];
  tokenUtilization: number;
  sourceContextId: string;
  generatedAt: string;
}

export interface ContextSnapshotDocument {
  id: string;
  workspaceId: string;
  organizationId: string;
  subjectId?: string;
  subjectType?: ContextSubjectType;
  objective: string;
  packageSummary: string;
  totalTokens: number;
  totalMemories: number;
  totalConflicts: number;
  createdByUserId: string;
  createdAt: string;
}

export const CONTEXT_SNAPSHOTS_COLLECTION = 'context_snapshots';
