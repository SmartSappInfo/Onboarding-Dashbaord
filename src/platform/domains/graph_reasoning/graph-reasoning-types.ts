/**
 * @fileOverview Graph Reasoning, Influence Mapping & Advanced Relationship Analytics Types (Phase 13 Milestone 2)
 *
 * Implements:
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 11 (Mathematical Determinism)
 * - Rule 12 (Canonical Risk Vocabulary: L0_READ)
 * - Rule 16 (Authority Scopes & Permission Matrices)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 50 (Tenant-Partitioned Caching Constants)
 * - Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges, depth <= 2 or 3)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod';

// ============================================================================
// Rule 55: Graph Canvas Ceilings & Cache Constants
// ============================================================================

export const MAX_GRAPH_NODES = 80;
export const MAX_GRAPH_EDGES = 150;
export const MAX_GRAPH_NEIGHBOR_DEPTH = 2;
export const MAX_GRAPH_PATH_DEPTH = 3;
export const MAX_CONTAGION_HOPS = 2;
export const GRAPH_CACHE_TTL_MS = 180000; // 3 minutes (Rule 50)
export const KEY_DECISION_MAKER_SCORE_THRESHOLD = 75;

// ============================================================================
// Node & Edge Types
// ============================================================================

export const GraphNodeTypeSchema = z.enum([
  'ENTITY',
  'CONTACT',
  'DEAL',
  'MEETING',
  'VENDOR',
  'CAMPUS',
]);

export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const GraphRelationshipTypeSchema = z.enum([
  'EMPLOYED_AT',
  'MANAGES',
  'ATTENDED',
  'ASSOCIATED_WITH',
  'SHARED_VENDOR',
  'SISTER_CAMPUS',
  'REPORTED_RISK',
]);

export type GraphRelationshipType = z.infer<typeof GraphRelationshipTypeSchema>;

export const GraphNodeRecordSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: GraphNodeTypeSchema,
  workspaceId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GraphNodeRecord = z.infer<typeof GraphNodeRecordSchema>;

export const GraphEdgeRecordSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  relationship: GraphRelationshipTypeSchema,
  weight: z.number().min(0).max(1.0).default(1.0),
  workspaceId: z.string().min(1),
  verificationState: z.enum(['unverified', 'proposed', 'verified']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GraphEdgeRecord = z.infer<typeof GraphEdgeRecordSchema>;

// ============================================================================
// Influence Scoring Contracts
// ============================================================================

export const StakeholderRoleCategorySchema = z.enum([
  'EXECUTIVE',
  'FINANCIAL',
  'OPERATIONAL',
  'TECHNICAL',
  'INFLUENCER',
]);

export type StakeholderRoleCategory = z.infer<typeof StakeholderRoleCategorySchema>;

export const GraphInfluenceScoreSchema = z.object({
  nodeId: z.string().min(1),
  nodeLabel: z.string().min(1),
  nodeType: z.string().min(1),
  degreeCentrality: z.number().min(0).max(100),
  betweennessCentrality: z.number().min(0).max(100),
  compositeInfluenceScore: z.number().min(0).max(100),
  authorityWeight: z.number().min(0).max(1.0),
  directConnectionCount: z.number().int().min(0),
  indirectConnectionCount: z.number().int().min(0),
  isKeyDecisionMaker: z.boolean(),
  roleCategory: StakeholderRoleCategorySchema,
  influenceDrivers: z.array(z.string()),
});

export type GraphInfluenceScore = z.infer<typeof GraphInfluenceScoreSchema>;

export const AnalyzeInfluenceInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  maxNodes: z.number().int().min(1).max(MAX_GRAPH_NODES).optional().default(50),
  dryRun: z.boolean().optional().default(false), // Rule 42
});

export type AnalyzeInfluenceInputRaw = z.input<typeof AnalyzeInfluenceInputSchema>;
export type AnalyzeInfluenceInput = z.infer<typeof AnalyzeInfluenceInputSchema>;

export const AnalyzeInfluenceResultSchema = z.object({
  entityId: z.string().min(1),
  entityLabel: z.string().min(1),
  totalStakeholders: z.number().int().min(0),
  keyDecisionMakerCount: z.number().int().min(0),
  stakeholders: z.array(GraphInfluenceScoreSchema),
  keyDecisionMakerIds: z.array(z.string()),
  clamped: z.boolean(),
  analyzedAt: z.string(),
});

export type AnalyzeInfluenceResult = z.infer<typeof AnalyzeInfluenceResultSchema>;

// ============================================================================
// Contagion Risk Clustering Contracts
// ============================================================================

export const ContagionRiskTierSchema = z.enum([
  'LOW',
  'MODERATE',
  'ELEVATED',
  'CRITICAL',
]);

export type ContagionRiskTier = z.infer<typeof ContagionRiskTierSchema>;

export const RiskTransmissionVectorTypeSchema = z.enum([
  'SHARED_VENDOR',
  'SISTER_CAMPUS',
  'COMMON_DECISION_MAKER',
  'GEOGRAPHIC_CLUSTER',
]);

export type RiskTransmissionVectorType = z.infer<typeof RiskTransmissionVectorTypeSchema>;

export const AffectedNodeSummarySchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().min(1),
  relationship: z.string().min(1),
  hopDistance: z.number().int().min(1).max(MAX_CONTAGION_HOPS),
  transmittedRiskScore: z.number().min(0).max(100),
  vulnerabilityFactor: z.number().min(0).max(1.0),
  associatedDealAmount: z.number().min(0).default(0),
});

export type AffectedNodeSummary = z.infer<typeof AffectedNodeSummarySchema>;

export const RiskTransmissionVectorSchema = z.object({
  vectorType: RiskTransmissionVectorTypeSchema,
  weight: z.number().min(0).max(1.0),
  evidence: z.string().min(1),
});

export type RiskTransmissionVector = z.infer<typeof RiskTransmissionVectorSchema>;

export const AccountContagionClusterSchema = z.object({
  rootEntityId: z.string().min(1),
  rootEntityLabel: z.string().min(1),
  initialRiskScore: z.number().min(0).max(100),
  compositeContagionScore: z.number().min(0).max(100),
  contagionRiskTier: ContagionRiskTierSchema,
  affectedNodes: z.array(AffectedNodeSummarySchema),
  riskTransmissionVectors: z.array(RiskTransmissionVectorSchema),
  totalRevenueExposure: z.number().min(0),
  blastRadius: z.object({
    entityCount: z.number().int().min(0),
    dealCount: z.number().int().min(0),
    contactCount: z.number().int().min(0),
  }),
  mitigationPlaybook: z.array(z.string()),
  clamped: z.boolean(),
  analyzedAt: z.string(),
});

export type AccountContagionCluster = z.infer<typeof AccountContagionClusterSchema>;

export const DetectContagionInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceEntityId: z.string().min(1),
  initialRiskScore: z.number().min(0).max(100).optional().default(85),
  maxHops: z.number().int().min(1).max(MAX_CONTAGION_HOPS).optional().default(MAX_CONTAGION_HOPS),
  dryRun: z.boolean().optional().default(false), // Rule 42
});

export type DetectContagionInputRaw = z.input<typeof DetectContagionInputSchema>;
export type DetectContagionInput = z.infer<typeof DetectContagionInputSchema>;

// ============================================================================
// Multi-Hop Path Reasoning Contracts
// ============================================================================

export const PathHopSchema = z.object({
  hopIndex: z.number().int().min(0),
  fromNodeId: z.string().min(1),
  fromLabel: z.string().min(1),
  toNodeId: z.string().min(1),
  toLabel: z.string().min(1),
  relationship: z.string().min(1),
  weight: z.number().min(0).max(1.0),
});

export type PathHop = z.infer<typeof PathHopSchema>;

export const ExplainabilityGridSchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  impact: z.string().min(1),
  risk: z.string().min(1),
});

export type ExplainabilityGrid = z.infer<typeof ExplainabilityGridSchema>;

export const MultiHopPathReasoningSchema = z.object({
  sourceNodeId: z.string().min(1),
  sourceLabel: z.string().min(1),
  targetNodeId: z.string().min(1),
  targetLabel: z.string().min(1),
  pathFound: z.boolean(),
  hops: z.array(PathHopSchema),
  causalInferenceNarrative: z.string(),
  connectionStrength: z.number().min(0).max(100),
  traversalDepth: z.number().int().min(0).max(MAX_GRAPH_PATH_DEPTH),
  explainabilityGrid: ExplainabilityGridSchema,
  analyzedAt: z.string(),
});

export type MultiHopPathReasoning = z.infer<typeof MultiHopPathReasoningSchema>;

export const FindCausalPathInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  maxDepth: z.number().int().min(1).max(MAX_GRAPH_PATH_DEPTH).optional().default(MAX_GRAPH_PATH_DEPTH),
  dryRun: z.boolean().optional().default(false), // Rule 42
});

export type FindCausalPathInputRaw = z.input<typeof FindCausalPathInputSchema>;
export type FindCausalPathInput = z.infer<typeof FindCausalPathInputSchema>;

// ============================================================================
// Error Taxonomy (Rule 48)
// ============================================================================

export const GRAPH_REASONING_ERROR_CODES = {
  GRAPH_NODE_NOT_FOUND: 'GRAPH_NODE_NOT_FOUND',
  DISCONNECTED_SUBGRAPH: 'DISCONNECTED_SUBGRAPH',
  TRAVERSAL_LIMIT_EXCEEDED: 'TRAVERSAL_LIMIT_EXCEEDED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  GRAPH_DEAD_MAN_PAUSED: 'GRAPH_DEAD_MAN_PAUSED',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type GraphReasoningErrorCode = keyof typeof GRAPH_REASONING_ERROR_CODES;

export class GraphReasoningError extends Error {
  public readonly code: GraphReasoningErrorCode;
  public readonly httpStatus: number;

  constructor(code: GraphReasoningErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'GraphReasoningError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================================================
// The 4 Mandatory Governance Matrices (Rules 1940-1953)
// ============================================================================

/**
 * 1. Graph Reasoning Permission Matrix (Rule 16)
 */
export const GRAPH_REASONING_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  supervisor: [
    'workspace:read',
    'crm:contacts:read',
    'crm:deals:read',
    'knowledge:graph:read',
  ],
  crm_researcher: [
    'workspace:read',
    'crm:contacts:read',
    'knowledge:graph:read',
  ],
  deal_strategist: [
    'workspace:read',
    'crm:deals:read',
    'knowledge:graph:read',
  ],
  lead_analyst: [
    'workspace:read',
    'crm:contacts:read',
    'knowledge:graph:read',
  ],
  admin_user: [
    'workspace:read',
    'workspace:write',
    'crm:*',
    'knowledge:*',
  ],
};

/**
 * 2. Graph Reasoning Tool Matrix (Rule 14 & 59)
 */
export const GRAPH_REASONING_TOOL_MATRIX: Readonly<
  Record<
    string,
    {
      readonly level: 'L0_READ' | 'L1_INTERNAL_DRAFT' | 'L2_STATE_MUTATION';
      readonly isDelegable: boolean;
      readonly isIdempotent: boolean;
      readonly description: string;
    }
  >
> = {
  'graph.reasoning.get_influence_map': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description: 'Calculates degree and authority centrality of stakeholders and key decision-makers across an account network.',
  },
  'graph.reasoning.detect_contagion': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description: 'Simulates multi-hop risk contagion across sister campuses, shared vendors, and common stakeholders with financial exposure calculation.',
  },
  'graph.reasoning.find_causal_path': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: true,
    description: 'Finds the shortest weighted relationship path between two entities and generates a causal explanation narrative.',
  },
};

/**
 * 3. Graph Reasoning Failure Matrix (Rule 2 & 48)
 */
export const GRAPH_REASONING_FAILURE_MATRIX: Readonly<
  Record<
    GraphReasoningErrorCode,
    {
      readonly strategy:
        | 'RETURN_EMPTY_DOSSIER'
        | 'FALLBACK_LOCAL_ATTRIBUTES'
        | 'CLAMP_TO_CEILING'
        | 'TERMINATE_BRANCH'
        | 'NEUTRALIZE_AND_CONTAIN'
        | 'FAIL_CLOSED';
      readonly httpStatus: number;
      readonly retryable: boolean;
    }
  >
> = {
  GRAPH_NODE_NOT_FOUND: {
    strategy: 'RETURN_EMPTY_DOSSIER',
    httpStatus: 404,
    retryable: false,
  },
  DISCONNECTED_SUBGRAPH: {
    strategy: 'FALLBACK_LOCAL_ATTRIBUTES',
    httpStatus: 200,
    retryable: false,
  },
  TRAVERSAL_LIMIT_EXCEEDED: {
    strategy: 'CLAMP_TO_CEILING',
    httpStatus: 200,
    retryable: false,
  },
  PROMPT_INJECTION_DETECTED: {
    strategy: 'NEUTRALIZE_AND_CONTAIN',
    httpStatus: 200,
    retryable: false,
  },
  TENANT_MISMATCH: {
    strategy: 'FAIL_CLOSED',
    httpStatus: 403,
    retryable: false,
  },
  GRAPH_DEAD_MAN_PAUSED: {
    strategy: 'FAIL_CLOSED',
    httpStatus: 503,
    retryable: true,
  },
  INVALID_INPUT: {
    strategy: 'FAIL_CLOSED',
    httpStatus: 400,
    retryable: false,
  },
  INTERNAL_ERROR: {
    strategy: 'FAIL_CLOSED',
    httpStatus: 500,
    retryable: true,
  },
};

/**
 * 4. Graph Reasoning Rollback Matrix (Rule 27)
 */
export const GRAPH_REASONING_ROLLBACK_MATRIX: Readonly<
  Record<string, { readonly rollbackAction: 'noop' | 'invalidate_cache'; readonly description: string }>
> = {
  'graph.reasoning.get_influence_map': {
    rollbackAction: 'noop',
    description: 'Read-only analysis operation; no state mutation to revert.',
  },
  'graph.reasoning.detect_contagion': {
    rollbackAction: 'noop',
    description: 'Read-only risk simulation; no state mutation to revert.',
  },
  'graph.reasoning.find_causal_path': {
    rollbackAction: 'noop',
    description: 'Read-only path traversal; no state mutation to revert.',
  },
};
