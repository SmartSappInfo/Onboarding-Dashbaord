/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Single Source of Truth for Document Signing Domain Models (Phase 2):
 *    Defines authoritative Zod schemas and strict TypeScript types for
 *    Envelopes, Recipients, Roles, Statuses, Routing Modes, Field Definitions,
 *    Evidence Records, Audit Certificates, and Execution Events.
 * 2. Strict Typing Enforcement (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`. All dynamic metadata dictionaries are
 *    typed as `Record<string, unknown>`.
 * 3. Security & Immutability:
 *    - Signing tokens are never stored in plaintext (only `tokenHash` = SHA-256).
 *    - Envelopes link immutably to `templateVersionId` and `preExecutionSha256`.
 *    - Sequential and parallel routing is governed strictly by `routingOrder` and `currentRoutingOrder`.
 */

import { z } from 'zod';

// ==========================================
// 1. Enumerations & Value Objects
// ==========================================

export const RecipientRoleSchema = z.enum([
  'signer',
  'approver',
  'countersigner',
  'viewer',
]);
export type RecipientRole = z.infer<typeof RecipientRoleSchema>;

export const RecipientStatusSchema = z.enum([
  'pending',
  'invited',
  'delivered',
  'opened',
  'signed',
  'declined',
  'revoked',
  'reassigned',
]);
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>;

export const EnvelopeRoutingModeSchema = z.enum([
  'sequential',
  'parallel',
  'mixed',
]);
export type EnvelopeRoutingMode = z.infer<typeof EnvelopeRoutingModeSchema>;

export const EnvelopeStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'sent',
  'in_progress',
  'completed',
  'declined',
  'voided',
  'expired',
]);
export type EnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

// ==========================================
// 2. Field Definitions & Form Canvas
// ==========================================

export const DocumentFieldDefinitionSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().optional(),
  type: z.enum([
    'text',
    'multiline',
    'number',
    'date',
    'checkbox',
    'dropdown',
    'email',
    'phone',
    'signature',
    'initials',
    'static_text',
    'variable',
  ]),
  page: z.number().int().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  required: z.boolean().default(false),
  assignedRole: RecipientRoleSchema.default('signer'),
  assignedRecipientId: z.string().optional(),
  variableKey: z.string().optional(),
  validation: z.record(z.unknown()).optional(),
  style: z.record(z.unknown()).optional(),
});
export type DocumentFieldDefinition = z.infer<typeof DocumentFieldDefinitionSchema>;

// ==========================================
// 3. Envelope Recipient Schema
// ==========================================

export const EnvelopeRecipientSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  envelopeId: z.string().min(1),
  crmContactId: z.string().optional(),
  entityId: z.string().optional(),
  role: RecipientRoleSchema,
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  routingOrder: z.number().int().min(1),
  status: RecipientStatusSchema,
  tokenHash: z.string(),
  tokenExpiresAt: z.string(),
  invitedAt: z.string().optional(),
  openedAt: z.string().optional(),
  signedAt: z.string().optional(),
  declinedAt: z.string().optional(),
  declineReason: z.string().optional(),
  reassignedToId: z.string().optional(),
  signatureStoragePath: z.string().optional(),
  signatureHash: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  formData: z.record(z.unknown()).optional(),
});
export type EnvelopeRecipient = z.infer<typeof EnvelopeRecipientSchema>;

// Backward-compatible alias for existing references
export type SigningEnvelopeRecipient = EnvelopeRecipient;

// ==========================================
// 4. Signing Envelope Schema
// ==========================================

export const SigningEnvelopeSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  status: EnvelopeStatusSchema,
  templateId: z.string().optional(),
  templateVersionId: z.string().optional(),
  contractId: z.string().optional(),
  dealId: z.string().optional(),
  entityId: z.string().optional(),
  routingMode: EnvelopeRoutingModeSchema,
  currentRoutingOrder: z.number().int().min(1),
  recipients: z.array(EnvelopeRecipientSchema),
  documentStoragePath: z.string(),
  preExecutionSha256: z.string(),
  completedDocumentStoragePath: z.string().optional(),
  completedSha256: z.string().optional(),
  resolvedVariablesSnapshot: z.record(z.unknown()).optional(),
  expiresAt: z.string(),
  completedAt: z.string().optional(),
  voidedAt: z.string().optional(),
  voidReason: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  isLegacyMigrated: z.boolean().optional(),
  // Retained optional legacy fields for backward compatibility
  pdfTemplateId: z.string().optional(),
  storagePath: z.string().optional(),
  originalDocumentDigest: z.string().optional(),
  finalDocumentDigest: z.string().optional(),
  certificateStoragePath: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SigningEnvelope = z.infer<typeof SigningEnvelopeSchema>;

// ==========================================
// 5. Audit & Evidence Domain Models (Phase 1 Baseline)
// ==========================================

export type SigningAuditAction =
  | 'created'
  | 'sent'
  | 'viewed'
  | 'opened'
  | 'progress_saved'
  | 'signed'
  | 'declined'
  | 'completed'
  | 'voided'
  | 'expired'
  | 'reassigned';

export interface EvidenceAuditLogEntry {
  id: string;
  envelopeId: string;
  action: SigningAuditAction;
  recipientId?: string;
  recipientEmail?: string;
  recipientName?: string;
  ipAddress?: string;
  userAgent?: string;
  documentDigest?: string; // SHA-256 binary digest
  timestamp: string; // ISO 8601 string
  metadata?: Record<string, unknown>;
}

export interface CreateEvidenceRecordInput {
  envelopeId: string;
  action: SigningAuditAction;
  recipientId?: string;
  recipientEmail?: string;
  recipientName?: string;
  ipAddress?: string;
  userAgent?: string;
  documentDigest?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditCertificateSignerInfo {
  recipientId: string;
  name: string;
  email: string;
  signedAt: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  signatureHash?: string;
}

export interface VerificationAuditCertificateData {
  envelopeId: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string;
  preExecutionSha256: string;
  postExecutionSha256: string;
  signers: AuditCertificateSignerInfo[];
  auditTrail: EvidenceAuditLogEntry[];
  verificationUrl: string;
}

// ==========================================
// 6. Template Studio & Versioning (Phase 3)
// ==========================================

export const DocumentTypeSchema = z.enum([
  'contract',
  'nda',
  'msa',
  'sow',
  'order_form',
  'sla',
  'amendment',
  'addendum',
  'waiver',
  'agreement',
  'proposal',
  'form',
  'letter',
  'policy',
  'certificate',
  'other',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const TemplateStatusSchema = z.enum(['draft', 'published', 'archived']);
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

export const TemplateVersionStatusSchema = z.enum(['draft', 'published', 'superseded']);
export type TemplateVersionStatus = z.infer<typeof TemplateVersionStatusSchema>;

export const TemplateVersionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  templateId: z.string().min(1),
  versionNumber: z.number().int().min(1),
  status: TemplateVersionStatusSchema,
  contentSnapshot: z.object({
    storagePath: z.string().min(1),
    sha256: z.string().min(1),
  }),
  fields: z.array(DocumentFieldDefinitionSchema),
  variableSchemaVersion: z.string().default('1.0'),
  changeSummary: z.string().optional(),
  publishedAt: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

export const DocumentTemplateSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  documentType: DocumentTypeSchema.default('contract'),
  status: TemplateStatusSchema.default('draft'),
  currentPublishedVersionId: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
  storagePath: z.string(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
});
export type DocumentTemplate = z.infer<typeof DocumentTemplateSchema>;

// ==========================================
// 7. Post-Signing Contracts & Relationships (Phase 3)
// ==========================================

export const ContractLifecycleStatusSchema = z.enum([
  'proposed',
  'negotiation',
  'pending_execution',
  'executed',
  'active',
  'renewal_pending',
  'renewed',
  'amended',
  'expired',
  'terminated',
  'superseded',
]);
export type ContractLifecycleStatus = z.infer<typeof ContractLifecycleStatusSchema>;

export const ContractRelationshipTypeSchema = z.enum([
  'amendment',
  'renewal',
  'supersedes',
  'parent_child',
]);
export type ContractRelationshipType = z.infer<typeof ContractRelationshipTypeSchema>;

export const ContractRelationshipSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceContractId: z.string().min(1),
  targetContractId: z.string().min(1),
  relationshipType: ContractRelationshipTypeSchema,
  description: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string().min(1),
});
export type ContractRelationship = z.infer<typeof ContractRelationshipSchema>;

// ==========================================
// 8. Contract Obligations & Milestones (Phase 3)
// ==========================================

export const ObligationTypeSchema = z.enum([
  'deliverable',
  'payment',
  'reporting',
  'renewal_notice',
  'audit',
  'compliance',
  'other',
]);
export type ObligationType = z.infer<typeof ObligationTypeSchema>;

export const ObligationStatusSchema = z.enum([
  'pending',
  'in_progress',
  'fulfilled',
  'breached',
  'waived',
]);
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;

export const ObligationResponsiblePartySchema = z.enum([
  'internal',
  'counterparty',
  'mutual',
]);
export type ObligationResponsibleParty = z.infer<typeof ObligationResponsiblePartySchema>;

export const ContractObligationSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  contractId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: ObligationTypeSchema.default('deliverable'),
  status: ObligationStatusSchema.default('pending'),
  dueDate: z.string(), // ISO-8601
  responsibleParty: ObligationResponsiblePartySchema.default('internal'),
  assignedUserId: z.string().optional(),
  counterpartyContactId: z.string().optional(),
  linkedTaskId: z.string().optional(),
  reminderDaysBefore: z.array(z.number().int()).default([7, 14, 30]),
  fulfilledAt: z.string().optional(),
  fulfilledBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContractObligation = z.infer<typeof ContractObligationSchema>;

export const ContractRecordSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  status: ContractLifecycleStatusSchema.default('proposed'),
  templateId: z.string().optional(),
  templateVersionId: z.string().optional(),
  envelopeIds: z.array(z.string()).default([]),
  dealId: z.string().optional(),
  entityId: z.string().optional(),
  partyLinks: z.array(
    z.object({
      entityId: z.string().optional(),
      contactId: z.string().optional(),
      name: z.string(),
      email: z.string().optional(),
      role: z.string(),
    })
  ).default([]),
  contractValue: z
    .object({
      amount: z.number().min(0),
      currency: z.string().default('USD'),
      cadence: z.enum(['one_off', 'monthly', 'quarterly', 'annually']).default('one_off'),
    })
    .optional(),
  effectiveAt: z.string().optional(),
  expiresAt: z.string().optional(),
  renewalAt: z.string().optional(),
  noticePeriodDays: z.number().int().default(30),
  parentContractId: z.string().optional(),
  ownerId: z.string().min(1),
  executedPdfStoragePath: z.string().optional(),
  executedPdfSha256: z.string().optional(),
  certificateStoragePath: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContractRecord = z.infer<typeof ContractRecordSchema>;

// ==========================================
// 9. Canonical Document Domain Events & Taxonomy (Phase 4 / P4.3)
// ==========================================

export const DocumentDomainEventTypeSchema = z.enum([
  'document.template_published',
  'document.instance_created',
  'document.dispatched',
  'document.viewed',
  'signing.recipient_completed',
  'signing.recipient_declined',
  'signing.envelope_completed',
  'contract.created',
  'contract.amended',
  'contract.renewed',
  'contract.renewal_due',
  'contract.terminated',
  'obligation.fulfilled',
]);
export type DocumentDomainEventType = z.infer<typeof DocumentDomainEventTypeSchema>;

export const DocumentDomainEventSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  type: DocumentDomainEventTypeSchema,
  envelopeId: z.string().optional(),
  contractId: z.string().optional(),
  dealId: z.string().optional(),
  entityId: z.string().optional(),
  contactId: z.string().optional(),
  recipientId: z.string().optional(),
  actorId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  timestamp: z.string(),
});
export type DocumentDomainEvent = z.infer<typeof DocumentDomainEventSchema>;

// ==========================================
// 10. CRM Master-Record Federation & Links (Phase 4 / P4.1)
// ==========================================

export const CrmDocumentRelationshipTypeSchema = z.enum([
  'primary',
  'related',
  'counterparty',
]);
export type CrmDocumentRelationshipType = z.infer<typeof CrmDocumentRelationshipTypeSchema>;

export const CrmDocumentLinkSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  contractId: z.string().optional(),
  envelopeId: z.string().optional(),
  dealId: z.string().optional(),
  entityId: z.string().optional(),
  contactId: z.string().optional(),
  relationshipType: CrmDocumentRelationshipTypeSchema.default('primary'),
  createdAt: z.string(),
});
export type CrmDocumentLink = z.infer<typeof CrmDocumentLinkSchema>;

// ==========================================
// 11. Event-Derived Lifecycle Analytics (Phase 4 / P4.4)
// ==========================================

export const SigningFunnelStageSchema = z.object({
  stage: z.string(),
  count: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});
export type SigningFunnelStage = z.infer<typeof SigningFunnelStageSchema>;

export const SignerBottleneckMetricSchema = z.object({
  role: z.string(),
  averageTurnaroundHours: z.number().min(0),
  count: z.number().int().min(0),
});
export type SignerBottleneckMetric = z.infer<typeof SignerBottleneckMetricSchema>;

export const SigningAnalyticsMetricSchema = z.object({
  completionRate: z.number().min(0).max(100),
  medianHoursToSign: z.number().min(0),
  averageHoursToSign: z.number().min(0),
  totalEnvelopes: z.number().int().min(0),
  completedCount: z.number().int().min(0),
  declinedCount: z.number().int().min(0),
  voidedCount: z.number().int().min(0),
  expiredCount: z.number().int().min(0),
  inProgressCount: z.number().int().min(0),
  totalContractValue: z.number().min(0),
  currency: z.string().default('USD'),
  funnel: z.array(SigningFunnelStageSchema).default([]),
  signerBottlenecks: z.array(SignerBottleneckMetricSchema).default([]),
  freshnessTimestamp: z.string(),
});
export type SigningAnalyticsMetric = z.infer<typeof SigningAnalyticsMetricSchema>;

// ==========================================
// 12. Multi-Channel Reminder & Escalation Config (Phase 4 / P4.5)
// ==========================================

export const ReminderChannelSchema = z.enum(['email', 'sms', 'whatsapp']);
export type ReminderChannel = z.infer<typeof ReminderChannelSchema>;

export const ReminderQuietHoursSchema = z.object({
  enabled: z.boolean().default(true),
  start: z.string().default('22:00'),
  end: z.string().default('08:00'),
  timezone: z.string().default('UTC'),
});
export type ReminderQuietHours = z.infer<typeof ReminderQuietHoursSchema>;

export const ReminderScheduleConfigSchema = z.object({
  workspaceId: z.string().min(1),
  enabled: z.boolean().default(true),
  reminderDays: z.array(z.number().int().positive()).default([3, 7, 14]),
  channels: z.array(ReminderChannelSchema).default(['email']),
  renewalAlertDays: z.array(z.number().int().positive()).default([30, 60, 90]),
  quietHours: ReminderQuietHoursSchema.default({
    enabled: true,
    start: '22:00',
    end: '08:00',
    timezone: 'UTC',
  }),
  dealAutoStageAdvance: z.boolean().default(true),
  updatedAt: z.string(),
  updatedBy: z.string().min(1),
});
export type ReminderScheduleConfig = z.infer<typeof ReminderScheduleConfigSchema>;

// ==========================================
// 13. AI Document Intelligence, Redlining & Obligations (Phase 5 / P5.1 - P5.5)
// ==========================================

export const AiFieldTypeSchema = z.enum([
  'signature',
  'initials',
  'date',
  'signer_name',
  'text',
  'checkbox',
]);
export type AiFieldType = z.infer<typeof AiFieldTypeSchema>;

export const AiFieldSuggestionSchema = z.object({
  id: z.string().min(1),
  pageNumber: z.number().int().min(1),
  fieldType: AiFieldTypeSchema,
  label: z.string().min(1),
  recipientRole: RecipientRoleSchema.default('signer'),
  confidence: z.number().min(0).max(1),
  leftPct: z.number().min(0).max(100),
  topPct: z.number().min(0).max(100),
  widthPct: z.number().min(0).max(100),
  heightPct: z.number().min(0).max(100),
  sourceExcerpt: z.string().optional(),
  accepted: z.boolean().default(false),
});
export type AiFieldSuggestion = z.infer<typeof AiFieldSuggestionSchema>;

export const AiDocumentQaCitationSchema = z.object({
  pageNumber: z.number().int().min(1),
  textSnippet: z.string().min(1),
  score: z.number().min(0).max(1).optional(),
});
export type AiDocumentQaCitation = z.infer<typeof AiDocumentQaCitationSchema>;

export const AiDocumentQaMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});
export type AiDocumentQaMessage = z.infer<typeof AiDocumentQaMessageSchema>;

export const AiDocumentQaRequestSchema = z.object({
  workspaceId: z.string().min(1),
  documentId: z.string().min(1),
  documentVersionId: z.string().optional(),
  question: z.string().min(1),
  history: z.array(AiDocumentQaMessageSchema).optional(),
});
export type AiDocumentQaRequest = z.infer<typeof AiDocumentQaRequestSchema>;

export const AiDocumentQaResponseSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(AiDocumentQaCitationSchema).default([]),
  confidence: z.number().min(0).max(1).default(1),
  isSupported: z.boolean().default(true),
  documentId: z.string().min(1),
  documentVersionId: z.string().optional(),
  generatedAt: z.string(),
});
export type AiDocumentQaResponse = z.infer<typeof AiDocumentQaResponseSchema>;

export const SemanticClauseChangeTypeSchema = z.enum([
  'added',
  'removed',
  'modified',
  'unchanged',
]);
export type SemanticClauseChangeType = z.infer<typeof SemanticClauseChangeTypeSchema>;

export const SemanticClauseSignificanceSchema = z.enum(['high', 'medium', 'low']);
export type SemanticClauseSignificance = z.infer<typeof SemanticClauseSignificanceSchema>;

export const SemanticClauseDiffItemSchema = z.object({
  id: z.string().min(1),
  clauseTitle: z.string().min(1),
  changeType: SemanticClauseChangeTypeSchema,
  originalText: z.string().optional(),
  newText: z.string().optional(),
  summaryOfChange: z.string().min(1),
  significance: SemanticClauseSignificanceSchema.default('medium'),
});
export type SemanticClauseDiffItem = z.infer<typeof SemanticClauseDiffItemSchema>;

export const SemanticClauseDiffSchema = z.object({
  documentId: z.string().min(1),
  versionA: z.string().min(1),
  versionB: z.string().min(1),
  executiveSummary: z.string().min(1),
  clauses: z.array(SemanticClauseDiffItemSchema).default([]),
  addedCount: z.number().int().min(0),
  removedCount: z.number().int().min(0),
  modifiedCount: z.number().int().min(0),
  generatedAt: z.string(),
});
export type SemanticClauseDiff = z.infer<typeof SemanticClauseDiffSchema>;

export const AiObligationStatusSchema = z.enum([
  'review_required',
  'approved',
  'rejected',
]);
export type AiObligationStatus = z.infer<typeof AiObligationStatusSchema>;

export const AiObligationCandidateSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  contractId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  type: ObligationTypeSchema.default('deliverable'),
  suggestedDueDate: z.string().optional(),
  suggestedResponsibleParty: ObligationResponsiblePartySchema.default('internal'),
  confidence: z.number().min(0).max(1).default(0.8),
  sourcePage: z.number().int().min(1).optional(),
  sourceExcerpt: z.string().min(1),
  status: AiObligationStatusSchema.default('review_required'),
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  linkedTaskId: z.string().optional(),
});
export type AiObligationCandidate = z.infer<typeof AiObligationCandidateSchema>;

export const DocumentAiTaskTypeSchema = z.enum([
  'field_detection',
  'summarize',
  'qa',
  'compare',
  'draft',
  'obligations',
]);
export type DocumentAiTaskType = z.infer<typeof DocumentAiTaskTypeSchema>;

export const DocumentAiAnalysisStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'review_required',
]);
export type DocumentAiAnalysisStatus = z.infer<typeof DocumentAiAnalysisStatusSchema>;

export const DocumentAiTokenUsageSchema = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});
export type DocumentAiTokenUsage = z.infer<typeof DocumentAiTokenUsageSchema>;

export const DocumentAiAnalysisLogSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  documentId: z.string().min(1),
  documentVersionId: z.string().optional(),
  taskType: DocumentAiTaskTypeSchema,
  status: DocumentAiAnalysisStatusSchema,
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  promptVersionId: z.string().min(1),
  inputDigest: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  latencyMs: z.number().min(0).optional(),
  tokenUsage: DocumentAiTokenUsageSchema.optional(),
  costUsd: z.number().min(0).optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  createdAt: z.string(),
});
export type DocumentAiAnalysisLog = z.infer<typeof DocumentAiAnalysisLogSchema>;

