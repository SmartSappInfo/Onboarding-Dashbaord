/**
 * @fileOverview Canonical 5-Tier Memory & Knowledge Plane Contracts
 *
 * ARCHITECTURAL INVARIANTS & MAINTAINER NOTES (Rules 4, 8, 10, 16, 29, 32):
 * 1. Unified 5-Tier Memory Model:
 *    - Working Memory: Run-scoped scratchpad (agent_runs/{runId}/working_memory).
 *    - Episodic Memory: Materialized action log bridging Phase 2 ActivityRecordV2.
 *    - Semantic Memory: Vectorized knowledge in Qdrant with mandatory tenant filters.
 *    - Relational Memory: Entity graph edges in Firestore (workspaces/{wsId}/entity_edges).
 *    - Procedural Memory: Governed prompt playbooks and SOPs in PMS.
 * 2. Strict Zero-`any` Standard (Rule 4):
 *    - All schemas are fully specified with Zod v4 and inferred TypeScript types.
 *    - Safe `unknown` narrowing pattern applied at all system boundaries.
 * 3. Multi-Tenant Fail-Closed Isolation (Rules 8 & 47):
 *    - All queries and objects require non-empty organizationId and workspaceId.
 * 4. Temporal Validity & Sensitivity (Rules 29 & 32):
 *    - Built-in temporal decay parameters, sensitivity classifications, and provenance hashes.
 *
 * @testability Covered in `src/platform/__tests__/memory/memory-contracts.test.ts`.
 */

import { z } from 'zod';

export const MemoryTierSchema = z.enum([
  'working',
  'episodic',
  'semantic',
  'relational',
  'procedural',
]);
export type MemoryTier = z.infer<typeof MemoryTierSchema>;

export const MemoryTypeSchema = z.enum([
  'fact',
  'observation',
  'decision',
  'insight',
  'problem',
  'opportunity',
  'risk',
  'preference',
  'instruction',
  'event',
  'conversation',
  'meeting',
  'note',
  'summary',
  'document',
  'document_chunk',
  'action_item',
  'customer_feedback',
  'strategy',
  'policy',
  'procedure',
  'ai_recommendation',
]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const SensitivityLevelSchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

export const VerificationStateSchema = z.enum([
  'unverified',
  'ai_generated',
  'user_confirmed',
  'source_verified',
  'disputed',
  'invalidated',
]);
export type VerificationState = z.infer<typeof VerificationStateSchema>;

export const MemoryLifecycleStatusSchema = z.enum([
  'captured',
  'processing',
  'normalized',
  'indexed',
  'active',
  'stale',
  'disputed',
  'archived',
]);
export type MemoryLifecycleStatus = z.infer<typeof MemoryLifecycleStatusSchema>;

export const TemporalValiditySchema = z.object({
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  supersededBy: z.string().optional(),
  decayRate: z.number().min(0.0).max(1.0).optional().default(0.0),
});
export type TemporalValidity = z.infer<typeof TemporalValiditySchema>;

export const SubjectReferencesSchema = z.object({
  entityIds: z.array(z.string()).optional(),
  personIds: z.array(z.string()).optional(),
  dealIds: z.array(z.string()).optional(),
  meetingIds: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional(),
  campaignIds: z.array(z.string()).optional(),
  formIds: z.array(z.string()).optional(),
  surveyIds: z.array(z.string()).optional(),
  invoiceIds: z.array(z.string()).optional(),
  paymentIds: z.array(z.string()).optional(),
  pageIds: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
  knowledgeIds: z.array(z.string()).optional(),
});
export type SubjectReferences = z.infer<typeof SubjectReferencesSchema>;

export const MemorySourceTypeSchema = z.enum([
  'user_note',
  'meeting',
  'call',
  'email',
  'whatsapp',
  'crm_entity',
  'deal',
  'campaign',
  'survey',
  'form',
  'document',
  'page',
  'task',
  'invoice',
  'payment',
  'ai_flow',
  'agent',
  'import',
]);
export type MemorySourceType = z.infer<typeof MemorySourceTypeSchema>;

export const MemorySourceSchema = z.object({
  type: MemorySourceTypeSchema,
  sourceId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceVersion: z.string().optional(),
  sourceHash: z.string().length(64).optional(), // SHA-256 (Rule 22)
});
export type MemorySource = z.infer<typeof MemorySourceSchema>;

export const MemoryProvenanceSchema = z.object({
  createdBy: z.enum(['user', 'agent', 'automation', 'system']),
  userId: z.string().optional(),
  agentId: z.string().optional(),
  sourceHash: z.string().optional(),
});
export type MemoryProvenance = z.infer<typeof MemoryProvenanceSchema>;

export const CanonicalMemoryObjectSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  tier: MemoryTierSchema,
  type: MemoryTypeSchema,
  title: z.string().optional(),
  content: z.string().min(1),
  summary: z.string().optional(),
  source: MemorySourceSchema,
  subjectRefs: SubjectReferencesSchema.optional().default({}),
  topics: z.array(z.string()).default([]),
  importance: z.number().min(0.0).max(1.0).default(0.5),
  confidence: z.number().min(0.0).max(1.0).default(1.0),
  verification: VerificationStateSchema.default('unverified'),
  sensitivity: SensitivityLevelSchema.default('internal'),
  lifecycle: z.object({
    status: MemoryLifecycleStatusSchema.default('captured'),
    lastReviewedAt: z.string().datetime().optional(),
    reviewedBy: z.string().optional(),
    invalidationReason: z.string().optional(),
  }),
  temporal: TemporalValiditySchema,
  provenance: MemoryProvenanceSchema,
  evidence: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CanonicalMemoryObject = z.infer<typeof CanonicalMemoryObjectSchema>;

export const CreateMemoryInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  tier: MemoryTierSchema.default('semantic'),
  type: MemoryTypeSchema,
  title: z.string().optional(),
  content: z.string().min(1),
  summary: z.string().optional(),
  source: MemorySourceSchema,
  subjectRefs: SubjectReferencesSchema.optional(),
  topics: z.array(z.string()).optional(),
  importance: z.number().min(0.0).max(1.0).optional(),
  confidence: z.number().min(0.0).max(1.0).optional(),
  verification: VerificationStateSchema.optional(),
  sensitivity: SensitivityLevelSchema.optional(),
  validUntil: z.string().datetime().optional(),
  evidence: z.string().optional(),
  provenance: MemoryProvenanceSchema,
  vector: z.array(z.number()).length(768).optional(),
});
export type CreateMemoryInput = z.input<typeof CreateMemoryInputSchema>;
export type CreateMemoryParsed = z.infer<typeof CreateMemoryInputSchema>;

export const QueryMemoryInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  query: z.string().min(1),
  tiers: z.array(MemoryTierSchema).optional(),
  types: z.array(MemoryTypeSchema).optional(),
  subjectRefs: SubjectReferencesSchema.optional(),
  minConfidence: z.number().min(0.0).max(1.0).optional(),
  maxSensitivity: SensitivityLevelSchema.optional(),
  includeExpired: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(10), // Bounded (Rule 9 & 28)
});
export type QueryMemoryInput = z.input<typeof QueryMemoryInputSchema>;
export type QueryMemoryParsed = z.infer<typeof QueryMemoryInputSchema>;

export const MemoryStatsSchema = z.object({
  totalIndexed: z.number().int().nonnegative(),
  semanticVectors: z.number().int().nonnegative(),
  activeSources: z.number().int().nonnegative(),
  inboxPending: z.number().int().nonnegative(),
  tierCounts: z.record(MemoryTierSchema, z.number().int().nonnegative()),
  verificationCounts: z.record(VerificationStateSchema, z.number().int().nonnegative()),
  sensitivityCounts: z.record(SensitivityLevelSchema, z.number().int().nonnegative()),
  healthStatus: z.enum(['healthy', 'degraded', 'unhealthy']),
});
export type MemoryStats = z.infer<typeof MemoryStatsSchema>;

export const MEMORY_ERROR_CODES = {
  TENANT_REQUIRED: 'MEMORY_TENANT_REQUIRED',
  MEMORY_NOT_FOUND: 'MEMORY_NOT_FOUND',
  MEMORY_EXPIRED: 'MEMORY_EXPIRED',
  MEMORY_SUPERSEDED: 'MEMORY_SUPERSEDED',
  VECTOR_UNAVAILABLE: 'MEMORY_VECTOR_UNAVAILABLE',
  INJECTION_DETECTED: 'MEMORY_INJECTION_DETECTED',
  SENSITIVITY_VIOLATION: 'MEMORY_SENSITIVITY_VIOLATION',
  CIRCUIT_BREAKER_OPEN: 'MEMORY_CIRCUIT_BREAKER_OPEN',
  RATE_LIMITED: 'MEMORY_RATE_LIMITED',
  DEAD_MAN_PAUSED: 'MEMORY_DEAD_MAN_PAUSED',
  INVALID_PAYLOAD: 'MEMORY_INVALID_PAYLOAD',
} as const;
export type MemoryErrorCode = typeof MEMORY_ERROR_CODES[keyof typeof MEMORY_ERROR_CODES];
