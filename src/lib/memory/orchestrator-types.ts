/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Organization Memory Orchestration & Conflict Types
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Institutional Memory Orchestration:
 *    - Unifies transactional storage (Firestore memory_objects), vector search (Qdrant),
 *      and relational topology (graph_nodes/edges).
 * 2. Strict Zero-`any` Standard:
 *    - Absolutely no `any` or `any[]` is permitted in these types or associated handlers.
 * 3. Non-Destructive Conflict & Staleness Invariant:
 *    - Contradictions are explicitly modeled as first-class `MemoryConflict` entities.
 *    - Stale memories decay predictably and require 1-click human reconfirmation.
 *
 * @testability Covered in `src/lib/memory/__tests__/conflict-repository.test.ts`.
 */

import type { MemoryType, MemorySourceType } from './types';

export type ConflictStatus = 'unresolved' | 'resolved' | 'ignored';

export type ConflictType =
  | 'contradiction'
  | 'fact_update'
  | 'duplicate_divergence'
  | 'obsolete_claim';

export type ConflictResolutionChoice =
  | 'confirm_a'
  | 'confirm_b'
  | 'keep_both'
  | 'custom_synthesis'
  | 'dismiss';

export interface ConflictEvidenceSnippet {
  memoryId: string;
  title: string;
  quote: string;
  sourceType: MemorySourceType;
  sourceId: string;
  createdAt: string;
  authorName?: string;
}

export interface MemoryConflict {
  id: string;
  workspaceId: string;
  organizationId: string;
  memoryIdA: string;
  memoryIdB: string;
  summary: string;
  status: ConflictStatus;
  conflictType: ConflictType;
  confidenceScore: number;
  detectedBy: 'ai' | 'user' | 'system';
  evidenceA: ConflictEvidenceSnippet;
  evidenceB: ConflictEvidenceSnippet;
  opposingAspects: string[];
  resolution?: ConflictResolutionChoice;
  resolvedByUserId?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FreshnessPolicy {
  ttlDays: number;
  requiresReconfirmation: boolean;
  decayFloor?: number;
}

export interface MemoryFreshnessInfo {
  memoryId: string;
  freshnessScore: number; // 0.0 to 1.0
  isStale: boolean;
  ttlDays: number;
  daysRemaining: number;
  lastConfirmedAt: string;
  category: MemoryType;
}

export interface ConsolidationCandidate {
  id: string;
  workspaceId: string;
  organizationId: string;
  sourceMemoryIds: string[];
  proposedTitle: string;
  proposedContent: string;
  proposedType: MemoryType;
  confidenceScore: number;
  reasoning: string;
  topics: string[];
  entityIds: string[];
  createdAt: string;
}

export interface MemoryHealthMetrics {
  totalMemories: number;
  verifiedTruthCount: number;
  unresolvedConflictCount: number;
  staleMemoryCount: number;
  qdrantIndexedCount: number;
  graphNodesCount: number;
  graphEdgesCount: number;
  syncHealthPercentage: number;
}

export const MEMORY_CONFLICTS_COLLECTION = 'memory_conflicts';
