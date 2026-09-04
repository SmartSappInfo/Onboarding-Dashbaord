/**
 * @fileOverview CompanyBrain 2.0: Core Organization Memory Domain Models
 *
 * ARCHITECTURAL GUIDELINES & DESIGN POINTERS (Rule 10 Maintainer Note):
 * 1. Single Source of Truth for Organization Memory:
 *    - MemoryObject represents atomic, durable units of institutional knowledge.
 *    - Strictly separated from raw notes (`quick_notes` / `NoteDocument`).
 *    - All memory entities, sources, and verification states are strictly typed.
 * 2. Strict Zero-`any` Invariant:
 *    - No `any` or `any[]` permitted across any memory interface or schema.
 * 3. Bidirectional Provenance & Linkage:
 *    - Every MemoryObject references its origin via `MemorySource`.
 *    - Notes record extracted memory IDs via `memoryObjectIds`.
 *
 * @testability Covered in `src/lib/memory/__tests__/memory-repository.test.ts`.
 */

export type MemoryType =
  | 'fact'
  | 'observation'
  | 'decision'
  | 'insight'
  | 'problem'
  | 'opportunity'
  | 'risk'
  | 'preference'
  | 'instruction'
  | 'event'
  | 'conversation'
  | 'meeting'
  | 'note'
  | 'summary'
  | 'document'
  | 'action_item'
  | 'customer_feedback';

export type MemorySourceType =
  | 'user_note'
  | 'meeting'
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'crm_entity'
  | 'deal'
  | 'campaign'
  | 'survey'
  | 'form'
  | 'task'
  | 'ai_flow'
  | 'agent'
  | 'import';

export interface MemorySource {
  type: MemorySourceType;
  sourceId: string;
  sourceUrl?: string;
  sourceVersion?: string;
  sourceHash?: string;
}

export interface SubjectReferences {
  entityIds?: string[];
  personIds?: string[];
  dealIds?: string[];
  meetingIds?: string[];
  taskIds?: string[];
  campaignIds?: string[];
  formIds?: string[];
  surveyIds?: string[];
  invoiceIds?: string[];
  knowledgeIds?: string[];
}

export type VerificationState =
  | 'unverified'
  | 'ai_generated'
  | 'user_confirmed'
  | 'source_verified'
  | 'disputed'
  | 'invalidated';

export type MemoryLifecycleStatus =
  | 'captured'
  | 'processing'
  | 'normalized'
  | 'indexed'
  | 'active'
  | 'stale'
  | 'disputed'
  | 'archived';

export interface MemoryLifecycle {
  status: MemoryLifecycleStatus;
  lastReviewedAt?: string;
  reviewedBy?: string;
  invalidationReason?: string;
}

export type MemoryVisibilityScope = 'private' | 'workspace' | 'organization' | 'public';

export interface MemoryVisibility {
  scope: MemoryVisibilityScope;
  allowedRoleIds?: string[];
}

export type MemoryCreatorType = 'user' | 'system' | 'agent';

export interface MemoryProvenance {
  createdBy: MemoryCreatorType;
  userId?: string;
  agentId?: string;
  sourceHash?: string;
}

export type ExtractedEntityType = 'institution' | 'person' | 'contact' | 'deal' | 'unknown';

export interface ExtractedEntity {
  entityId?: string;
  entityName: string;
  entityType: ExtractedEntityType;
  confidenceScore: number;
}

/**
 * The canonical Organization Memory Unit in SmartSapp.
 */
export interface MemoryObject {
  id: string;
  organizationId: string;
  workspaceId: string;
  type: MemoryType;
  title?: string;
  content: string;
  summary?: string;
  source: MemorySource;
  subjectRefs: SubjectReferences;
  topics: string[];
  entities: ExtractedEntity[];
  importance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  verification: VerificationState;
  visibility: MemoryVisibility;
  lifecycle: MemoryLifecycle;
  provenance: MemoryProvenance;
  evidence?: string; // Exact verbatim quote from source
  createdAt: string;
  updatedAt: string;
}

/**
 * Temporary candidate extracted by AI before persistence.
 */
export interface MemoryCandidate {
  type: MemoryType;
  title: string;
  content: string;
  importance: number;
  confidence: number;
  evidence?: string;
  relatedEntityNames?: string[];
  suggestedAction?: {
    type: 'task' | 'deal' | 'followup';
    title: string;
  };
}

export interface MemoryFilterOptions {
  type?: MemoryType;
  verification?: VerificationState;
  status?: MemoryLifecycleStatus;
  entityId?: string;
  dealId?: string;
  searchQuery?: string;
  limit?: number;
}

export interface MemoryHealthStats {
  totalMemories: number;
  pendingReviewCount: number;
  verifiedCount: number;
  conflictsOrInvalidatedCount: number;
}
