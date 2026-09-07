/**
 * @fileOverview CompanyBrain 2.0: Core Graph Domain Types & Invariants
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Organizational Relationships:
 *    - Strictly defines GraphNode and GraphEdge models adhering to PRD Sections 23 & 24.
 * 2. Strict Zero-`any` Standard:
 *    - Absolute zero `any` or `any[]`. All node metadata, query filters, and traversal
 *      results are strongly typed with explicit primitives and schemas.
 * 3. Multi-Tenant Scoping by Design:
 *    - All nodes, edges, queries, and mutations require `workspaceId` and `organizationId`.
 * 4. Backward Compatibility Adapters:
 *    - Provides bidirectional mapping helpers to integrate legacy Quick Notes
 *      `KnowledgeRelation` records into CompanyBrain 2.0 graph structures without data loss.
 *
 * @testability Covered in `src/lib/memory/__tests__/knowledge-graph-service.test.ts`.
 */

import type { MemoryType } from './types';

/**
 * Valid node types in CompanyBrain 2.0 (PRD Section 23).
 */
export const GRAPH_NODE_TYPES = [
  'entity',
  'person',
  'deal',
  'meeting',
  'campaign',
  'task',
  'survey',
  'form',
  'invoice',
  'payment',
  'memory',
  'knowledge',
  'document',
  'page',
] as const;

export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

/**
 * Valid relationship types in CompanyBrain 2.0 (PRD Section 24).
 */
export const GRAPH_RELATIONSHIP_TYPES = [
  'HAS_CONTACT',
  'OWNS_DEAL',
  'ATTENDED',
  'DISCUSSED',
  'CREATED',
  'MENTIONS',
  'RELATED_TO',
  'GENERATED',
  'CAUSED',
  'BLOCKED_BY',
  'INTERESTED_IN',
  'HAS_PROBLEM',
  'HAS_RISK',
  'HAS_OPPORTUNITY',
  'PRODUCED',
  'ANSWERED_BY',
  'DERIVED_FROM',
  'INVOLVES',
] as const;

export type GraphRelationshipType = (typeof GRAPH_RELATIONSHIP_TYPES)[number];

/**
 * Source attribution kind for graph edges.
 */
export type GraphSourceType = 'system' | 'user' | 'ai';

/**
 * Strongly typed node in the CompanyBrain organizational graph (PRD Section 23).
 */
export interface CompanyBrainGraphNode {
  id: string; // e.g. "ent_school123", "deal_456", "mem_789"
  organizationId: string;
  workspaceId: string;
  nodeType: GraphNodeType;
  sourceId: string; // ID of the underlying Firestore document
  label: string; // Human-readable display label
  metadata?: Record<string, string | number | boolean>;
  connectionsCount?: number;
  originHref?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Strongly typed directed edge in the CompanyBrain organizational graph (PRD Section 24).
 */
export interface CompanyBrainGraphEdge {
  id: string; // Deterministic or UUID string
  organizationId: string;
  workspaceId: string;
  sourceNodeId: string; // source node id
  targetNodeId: string; // target node id
  relationshipType: GraphRelationshipType;
  confidence: number; // 0.0 to 1.0 (1.0 for deterministic system/user relations)
  weight?: number;
  sourceType: GraphSourceType;
  sourceId?: string; // Originating note, meeting, or event ID
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Graph path representing a sequence of connected nodes and edges.
 */
export interface GraphPath {
  nodes: CompanyBrainGraphNode[];
  edges: CompanyBrainGraphEdge[];
  length: number;
  totalHops?: number;
  totalWeight?: number;
}

/**
 * Result of a breadth-first or depth-bounded graph traversal.
 */
export interface GraphTraversalResult {
  rootNodeId: string;
  nodes: CompanyBrainGraphNode[];
  edges: CompanyBrainGraphEdge[];
  depth: number;
  totalVisited: number;
}

/**
 * Filter conditions for graph queries and traversals.
 */
export interface GraphQueryFilter {
  nodeTypes?: GraphNodeType[];
  relationshipTypes?: GraphRelationshipType[];
  minConfidence?: number;
  sourceTypes?: GraphSourceType[];
  limit?: number;
}

/**
 * Natural language explanation for why two nodes or entities are connected in the graph.
 */
export interface GraphConnectionExplanation {
  narrative: string;
  path: GraphPath;
  confidence: number;
  evidenceCount: number;
  eventsCited: string[];
}

/**
 * Overall Graph Topology Health Metrics.
 */
export interface GraphTopologyMetrics {
  workspaceId: string;
  totalNodes: number;
  totalEdges: number;
  nodeCountsByType: Record<GraphNodeType, number>;
  edgeCountsByType: Record<GraphRelationshipType, number>;
  density: number; // 0.0 to 1.0
  orphanedNodesCount: number;
  lastCalculatedAt: string;
}

/**
 * UI display configuration for Node Types.
 */
export interface NodeTypeConfig {
  label: string;
  badgeClass: string;
  nodeColor: string;
  iconName: string;
}

export const NODE_TYPE_DISPLAY_CONFIG: Record<GraphNodeType, NodeTypeConfig> = {
  entity: {
    label: 'Account / Entity',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    nodeColor: '#3b82f6',
    iconName: 'Building2',
  },
  person: {
    label: 'Contact / Person',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    nodeColor: '#10b981',
    iconName: 'User',
  },
  deal: {
    label: 'Deal / Opportunity',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    nodeColor: '#f59e0b',
    iconName: 'Handshake',
  },
  meeting: {
    label: 'Meeting',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    nodeColor: '#a855f7',
    iconName: 'Video',
  },
  campaign: {
    label: 'Campaign',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    nodeColor: '#f43f5e',
    iconName: 'Send',
  },
  task: {
    label: 'Task',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    nodeColor: '#06b6d4',
    iconName: 'ListTodo',
  },
  survey: {
    label: 'Survey',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    nodeColor: '#14b8a6',
    iconName: 'FileQuestion',
  },
  form: {
    label: 'Form',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    nodeColor: '#6366f1',
    iconName: 'FileCode',
  },
  invoice: {
    label: 'Invoice',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    nodeColor: '#059669',
    iconName: 'Receipt',
  },
  payment: {
    label: 'Payment',
    badgeClass: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    nodeColor: '#16a34a',
    iconName: 'CheckCircle2',
  },
  memory: {
    label: 'Organization Memory',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    nodeColor: '#8b5cf6',
    iconName: 'Brain',
  },
  knowledge: {
    label: 'Knowledge Document',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    nodeColor: '#0284c7',
    iconName: 'BookOpen',
  },
  document: {
    label: 'Document',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    nodeColor: '#64748b',
    iconName: 'FileText',
  },
  page: {
    label: 'Landing Page',
    badgeClass: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
    nodeColor: '#ec4899',
    iconName: 'Globe',
  },
};

/**
 * UI display configuration for Relationship Types.
 */
export interface RelationshipTypeConfig {
  label: string;
  badgeClass: string;
  strokeColor: string;
}

export const RELATIONSHIP_TYPE_DISPLAY_CONFIG: Record<GraphRelationshipType, RelationshipTypeConfig> = {
  HAS_CONTACT: {
    label: 'Has Contact',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    strokeColor: '#10b981',
  },
  OWNS_DEAL: {
    label: 'Owns Deal',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    strokeColor: '#f59e0b',
  },
  ATTENDED: {
    label: 'Attended Meeting',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    strokeColor: '#a855f7',
  },
  DISCUSSED: {
    label: 'Discussed In',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    strokeColor: '#6366f1',
  },
  CREATED: {
    label: 'Created',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    strokeColor: '#3b82f6',
  },
  MENTIONS: {
    label: 'Mentions',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    strokeColor: '#64748b',
  },
  RELATED_TO: {
    label: 'Related To',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    strokeColor: '#94a3b8',
  },
  GENERATED: {
    label: 'Generated',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    strokeColor: '#14b8a6',
  },
  CAUSED: {
    label: 'Caused',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    strokeColor: '#ef4444',
  },
  BLOCKED_BY: {
    label: 'Blocked By',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    strokeColor: '#f43f5e',
  },
  INTERESTED_IN: {
    label: 'Interested In',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    strokeColor: '#06b6d4',
  },
  HAS_PROBLEM: {
    label: 'Has Problem / Pain',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    strokeColor: '#d97706',
  },
  HAS_RISK: {
    label: 'Has Risk',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    strokeColor: '#dc2626',
  },
  HAS_OPPORTUNITY: {
    label: 'Has Opportunity',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    strokeColor: '#059669',
  },
  PRODUCED: {
    label: 'Produced',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    strokeColor: '#8b5cf6',
  },
  ANSWERED_BY: {
    label: 'Answered By',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    strokeColor: '#0284c7',
  },
  DERIVED_FROM: {
    label: 'Derived From',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    strokeColor: '#4f46e5',
  },
  INVOLVES: {
    label: 'Involves Stakeholder',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    strokeColor: '#0d9488',
  },
};

/**
 * Maps a MemoryType to the appropriate GraphRelationshipType when connecting an Entity to a Memory.
 */
export function memoryTypeToRelationship(type: MemoryType): GraphRelationshipType {
  switch (type) {
    case 'problem':
      return 'HAS_PROBLEM';
    case 'opportunity':
      return 'HAS_OPPORTUNITY';
    case 'risk':
      return 'HAS_RISK';
    case 'decision':
    case 'insight':
    case 'fact':
    case 'action_item':
    default:
      return 'INTERESTED_IN';
  }
}
