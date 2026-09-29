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
  idempotencyKey: z.string().optional(),
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
  'obligation.created',
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

// ==========================================
// 8. Enterprise Governance, Assurance Profiles, Webhooks & Computed Formulas (Phase 6)
// ==========================================

export const AssuranceLevelSchema = z.enum(['simple', 'advanced', 'qualified']);
export type AssuranceLevel = z.infer<typeof AssuranceLevelSchema>;

export const AssuranceAuthMethodSchema = z.enum([
  'email_link',
  'email_otp',
  'sms_otp',
  'id_verification',
  'in_person_witness',
]);
export type AssuranceAuthMethod = z.infer<typeof AssuranceAuthMethodSchema>;

export const CertificateStandardSchema = z.enum([
  'standard',
  'pki_x509',
  'qualified_trust',
]);
export type CertificateStandard = z.infer<typeof CertificateStandardSchema>;

export const AssuranceProfileSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  level: AssuranceLevelSchema,
  description: z.string().optional(),
  requiredAuth: z.array(AssuranceAuthMethodSchema).min(1),
  requireSignatureBiometrics: z.boolean().default(false),
  certificateStandard: CertificateStandardSchema.default('standard'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AssuranceProfile = z.infer<typeof AssuranceProfileSchema>;

export const WebhookDeliveryStatusSchema = z.enum([
  'pending',
  'delivered',
  'failed',
  'dead_letter',
]);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;

export const WebhookSubscriptionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string()).min(1),
  isActive: z.boolean().default(true),
  retryLimit: z.number().int().min(1).max(10).default(5),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

export const WebhookDeliveryLogSchema = z.object({
  id: z.string().min(1),
  subscriptionId: z.string().min(1),
  workspaceId: z.string().min(1),
  event: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  status: WebhookDeliveryStatusSchema,
  attemptCount: z.number().int().min(0).default(0),
  nextRetryAt: z.string().nullable().optional(),
  lastAttemptAt: z.string().nullable().optional(),
  responseStatusCode: z.number().int().nullable().optional(),
  responseBody: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type WebhookDeliveryLog = z.infer<typeof WebhookDeliveryLogSchema>;

export const LegalHoldStatusSchema = z.object({
  isUnderLegalHold: z.boolean(),
  holdId: z.string().optional(),
  matterId: z.string().optional(),
  reason: z.string().optional(),
  placedByUserId: z.string().optional(),
  placedAt: z.string().optional(),
  releasedAt: z.string().optional(),
  releasedByUserId: z.string().optional(),
});
export type LegalHoldStatus = z.infer<typeof LegalHoldStatusSchema>;

export const RetentionCategorySchema = z.enum([
  'standard',
  'financial',
  'employment',
  'intellectual_property',
  'statutory_tax',
  'custom',
]);
export type RetentionCategory = z.infer<typeof RetentionCategorySchema>;

export const ContractRetentionPolicySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  category: RetentionCategorySchema,
  retentionYears: z.number().int().min(1).max(100),
  autoPurgeAfterRetention: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContractRetentionPolicy = z.infer<typeof ContractRetentionPolicySchema>;

export const EvidencePackageManifestSchema = z.object({
  packageId: z.string().min(1),
  workspaceId: z.string().min(1),
  contractId: z.string().min(1),
  envelopeId: z.string().optional(),
  generatedAt: z.string(),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  certificateSha256: z.string().regex(/^[a-f0-9]{64}$/),
  auditEventsCount: z.number().int().min(0),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  overallChecksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type EvidencePackageManifest = z.infer<typeof EvidencePackageManifestSchema>;

export const ComputedFieldFormulaTypeSchema = z.enum([
  'sum',
  'multiply',
  'subtract',
  'percentage',
  'tax',
  'custom_expression',
]);
export type ComputedFieldFormulaType = z.infer<typeof ComputedFieldFormulaTypeSchema>;

export const ComputedFieldFormulaSchema = z.object({
  type: ComputedFieldFormulaTypeSchema,
  expression: z.string().min(1),
  sourceFieldIds: z.array(z.string()),
  decimalPlaces: z.number().int().min(0).max(6).default(2),
  currencySymbol: z.string().optional(),
});
export type ComputedFieldFormula = z.infer<typeof ComputedFieldFormulaSchema>;

export const WorkspaceBrandingSchema = z.object({
  workspaceId: z.string().min(1),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  logoUrl: z.string().url().or(z.literal('')),
  companyDisplayName: z.string().min(1).max(100),
  emailSenderName: z.string().min(1).max(100),
  customInviteMessage: z.string().max(500).optional(),
  portalSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  updatedAt: z.string(),
});
export type WorkspaceBranding = z.infer<typeof WorkspaceBrandingSchema>;

export const CircuitBreakerStateSchema = z.object({
  workspaceId: z.string(),
  serviceKey: z.string(),
  state: z.enum(['closed', 'open', 'half_open']),
  failureCount: z.number().int().nonnegative().default(0),
  successCount: z.number().int().nonnegative().default(0),
  lastFailureAt: z.string().nullable().optional(),
  nextAllowedAttemptAt: z.string().nullable().optional(),
  updatedAt: z.string(),
});
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

// ============================================================================
// SECTION 9: Phase 7 General Availability, Migration Backfill & Cutover Schemas
// ============================================================================

export const MigrationRunStatusSchema = z.enum([
  'pending',
  'in_progress',
  'paused',
  'completed',
  'failed',
  'rolled_back',
]);
export type MigrationRunStatus = z.infer<typeof MigrationRunStatusSchema>;

export const MigrationRecordCountsSchema = z.object({
  totalContracts: z.number().int().nonnegative().default(0),
  migratedContracts: z.number().int().nonnegative().default(0),
  totalTemplates: z.number().int().nonnegative().default(0),
  migratedTemplates: z.number().int().nonnegative().default(0),
  totalSubmissions: z.number().int().nonnegative().default(0),
  migratedSubmissions: z.number().int().nonnegative().default(0),
  quarantinedCount: z.number().int().nonnegative().default(0),
  skippedCount: z.number().int().nonnegative().default(0),
});
export type MigrationRecordCounts = z.infer<typeof MigrationRecordCountsSchema>;

export const MigrationRunSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  isDryRun: z.boolean().default(false),
  status: MigrationRunStatusSchema,
  counts: MigrationRecordCountsSchema,
  lastProcessedCursor: z.string().nullable().default(null),
  startedAt: z.string(),
  completedAt: z.string().nullable().default(null),
  initiatedByUserId: z.string().min(1),
  errorMessage: z.string().nullable().default(null),
});
export type MigrationRun = z.infer<typeof MigrationRunSchema>;

export const MigrationQuarantineErrorCodeSchema = z.enum([
  'ERR_ORPHANED_RECORD',
  'ERR_TENANT_MISMATCH',
  'ERR_ARTIFACT_UNREACHABLE',
  'ERR_MALFORMED_SCHEMA',
  'ERR_INCOMPLETE_FIELDS',
]);
export type MigrationQuarantineErrorCode = z.infer<typeof MigrationQuarantineErrorCodeSchema>;

export const MigrationQuarantineRecordSchema = z.object({
  quarantineId: z.string().min(1),
  workspaceId: z.string().min(1),
  runId: z.string().min(1),
  sourceCollection: z.enum(['contracts', 'pdfs', 'contract_submissions']),
  sourceRecordId: z.string().min(1),
  errorCode: MigrationQuarantineErrorCodeSchema,
  reason: z.string().min(1),
  rawPayload: z.record(z.unknown()),
  quarantinedAt: z.string(),
  resolved: z.boolean().default(false),
  resolvedAt: z.string().nullable().default(null),
});
export type MigrationQuarantineRecord = z.infer<typeof MigrationQuarantineRecordSchema>;

export const ReconciliationDiscrepancySchema = z.object({
  recordId: z.string().min(1),
  entityType: z.enum(['contract', 'template', 'envelope', 'artifact']),
  discrepancyType: z.enum([
    'count_mismatch',
    'status_divergence',
    'hash_mismatch',
    'missing_target',
  ]),
  expected: z.string(),
  actual: z.string(),
  detectedAt: z.string(),
});
export type ReconciliationDiscrepancy = z.infer<typeof ReconciliationDiscrepancySchema>;

export const ReconciliationReportSchema = z.object({
  reportId: z.string().min(1),
  workspaceId: z.string().min(1),
  generatedAt: z.string(),
  sourceCounts: z.object({
    contracts: z.number().int().nonnegative(),
    templates: z.number().int().nonnegative(),
    submissions: z.number().int().nonnegative(),
  }),
  targetCounts: z.object({
    contracts: z.number().int().nonnegative(),
    templates: z.number().int().nonnegative(),
    envelopes: z.number().int().nonnegative(),
  }),
  parityPercentage: z.number().min(0).max(100),
  artifactParityPercentage: z.number().min(0).max(100),
  discrepancies: z.array(ReconciliationDiscrepancySchema),
  status: z.enum(['perfect_parity', 'discrepancies_detected']),
});
export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>;

export const RolloutCohortConfigSchema = z.object({
  workspaceId: z.string().min(1),
  cohortPercentage: z.number().int().min(0).max(100).default(0),
  isEmergencyRollbackActive: z.boolean().default(false),
  legacyDualWriteEnabled: z.boolean().default(true),
  shadowReadsEnabled: z.boolean().default(true),
  updatedAt: z.string(),
  updatedByUserId: z.string().min(1),
});
export type RolloutCohortConfig = z.infer<typeof RolloutCohortConfigSchema>;

/* =========================================================================
   PHASE 8: DEVELOPER PLATFORM, SCOPED API KEYS, EMBEDDED SDK & OFFLINE PWA
   =========================================================================
   Maintainer Note:
   These schemas govern programmatic developer access via REST APIs, partner
   iframe embedded signing with postMessage bi-directional communication, and
   offline biometric stroke captures with IndexedDB sync queues.
   Strict validation ensures zero un-narrowed external payloads.
*/

export const ApiKeyScopeSchema = z.enum([
  'envelopes:create',
  'envelopes:read',
  'envelopes:void',
  'templates:read',
  'webhooks:manage',
]);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;

export const ApiKeyRateLimitTierSchema = z.enum(['standard', 'enterprise']);
export type ApiKeyRateLimitTier = z.infer<typeof ApiKeyRateLimitTierSchema>;

export const ApiKeyStatusSchema = z.enum(['active', 'revoked', 'expired']);
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

export const ApiKeyRecordSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(64),
  prefix: z.string().min(1),
  hashedSecret: z.string().min(64), // SHA-256 hex digest
  scopes: z.array(ApiKeyScopeSchema).min(1),
  status: ApiKeyStatusSchema.default('active'),
  rateLimitTier: ApiKeyRateLimitTierSchema.default('standard'),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
});
export type ApiKeyRecord = z.infer<typeof ApiKeyRecordSchema>;

export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(64),
  scopes: z.array(ApiKeyScopeSchema).min(1),
  rateLimitTier: ApiKeyRateLimitTierSchema.default('standard'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export const CreateEnvelopeApiRecipientSchema = z.object({
  role: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  routingOrder: z.number().int().positive().default(1),
  verificationPolicy: z.enum(['none', 'email', 'sms_otp']).default('none'),
});
export type CreateEnvelopeApiRecipient = z.infer<typeof CreateEnvelopeApiRecipientSchema>;

export const CreateEnvelopeApiRequestSchema = z.object({
  title: z.string().min(1),
  templateId: z.string().min(1).optional(),
  templateVersionId: z.string().min(1).optional(),
  documentStoragePath: z.string().optional(),
  recipients: z.array(CreateEnvelopeApiRecipientSchema).min(1).max(10),
  metadata: z.record(z.string(), z.string()).optional(),
  externalReferenceId: z.string().optional(),
});
export type CreateEnvelopeApiRequest = z.infer<typeof CreateEnvelopeApiRequestSchema>;

export const EmbedHandshakeInitMessageSchema = z.object({
  type: z.literal('handshake_init'),
  token: z.string().min(1),
});

export const EmbedHandshakeAckMessageSchema = z.object({
  type: z.literal('handshake_ack'),
  status: z.literal('ready'),
  allowedOrigins: z.array(z.string()),
});

export const EmbedRecipientSignedMessageSchema = z.object({
  type: z.literal('recipient_signed'),
  envelopeId: z.string().min(1),
  recipientId: z.string().min(1),
  timestamp: z.string(),
});

export const EmbedRecipientDeclinedMessageSchema = z.object({
  type: z.literal('recipient_declined'),
  envelopeId: z.string().min(1),
  recipientId: z.string().min(1),
  reason: z.string().optional(),
  timestamp: z.string(),
});

export const EmbedResizeRequestMessageSchema = z.object({
  type: z.literal('resize_request'),
  height: z.number().positive(),
});

export const EmbedMessageSchema = z.discriminatedUnion('type', [
  EmbedHandshakeInitMessageSchema,
  EmbedHandshakeAckMessageSchema,
  EmbedRecipientSignedMessageSchema,
  EmbedRecipientDeclinedMessageSchema,
  EmbedResizeRequestMessageSchema,
]);
export type EmbedMessage = z.infer<typeof EmbedMessageSchema>;

export const OfflineBiometricPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  time: z.number(),
  pressure: z.number().min(0).max(1).optional(),
  velocity: z.number().optional(),
});
export type OfflineBiometricPoint = z.infer<typeof OfflineBiometricPointSchema>;

export const OfflineBiometricStrokeSchema = z.object({
  points: z.array(OfflineBiometricPointSchema).min(1),
});
export type OfflineBiometricStroke = z.infer<typeof OfflineBiometricStrokeSchema>;

export const OfflineSigningPayloadSchema = z.object({
  envelopeId: z.string().min(1),
  recipientId: z.string().min(1),
  signedAt: z.string(),
  strokes: z.array(OfflineBiometricStrokeSchema),
  deviceFingerprint: z.string().min(1),
  documentSha256: z.string().min(1),
  nonce: z.string().min(1),
});
export type OfflineSigningPayload = z.infer<typeof OfflineSigningPayloadSchema>;

export const OfflineSyncRecordSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  envelopeId: z.string().min(1),
  recipientId: z.string().min(1),
  status: z.enum(['pending', 'synced', 'conflict']),
  payload: OfflineSigningPayloadSchema,
  error: z.string().optional(),
  syncedAt: z.string().optional(),
});
export type OfflineSyncRecord = z.infer<typeof OfflineSyncRecordSchema>;

export const RateLimitConfigSchema = z.object({
  windowMs: z.number().int().positive(),
  maxRequests: z.number().int().positive(),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

export const DeveloperWebhookSubscriptionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16),
  status: z.enum(['active', 'paused', 'disabled']),
  createdAt: z.string(),
});
export type DeveloperWebhookSubscription = z.infer<typeof DeveloperWebhookSubscriptionSchema>;

/* =========================================================================
   PHASE 9: ENTERPRISE BULK DISPATCH CAMPAIGNS, BATCH MERGE & E-DISCOVERY
   =========================================================================
   Maintainer Note (Rule 10 Maintainer Guidance):
   These schemas govern high-throughput bulk document dispatch campaigns,
   item-level recipient state machines, pre-flight merge validation,
   statutory retention schedules, litigation legal holds, and court-admissible
   e-Discovery archival packages with Merkle root hash verification.
   Strict validation ensures zero un-narrowed external payloads and zero `any`.
*/

export const BulkCampaignStatusSchema = z.enum([
  'draft',
  'validating',
  'ready',
  'dispatching',
  'active',
  'paused',
  'completed',
  'failed',
]);
export type BulkCampaignStatus = z.infer<typeof BulkCampaignStatusSchema>;

export const BulkCampaignRecipientStatusSchema = z.enum([
  'queued',
  'dispatched',
  'delivered',
  'signed',
  'failed',
]);
export type BulkCampaignRecipientStatus = z.infer<typeof BulkCampaignRecipientStatusSchema>;

export const BulkCampaignRecipientSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  rowIndex: z.number().int().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  variables: z.record(z.string(), z.string()).default({}),
  status: BulkCampaignRecipientStatusSchema.default('queued'),
  envelopeId: z.string().optional(),
  error: z.string().optional(),
  dispatchedAt: z.string().optional(),
  signedAt: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type BulkCampaignRecipient = z.infer<typeof BulkCampaignRecipientSchema>;

export const BulkCampaignRoutingModeSchema = z.enum([
  'single_signer',
  'sequential_countersign',
]);
export type BulkCampaignRoutingMode = z.infer<typeof BulkCampaignRoutingModeSchema>;

export const BulkCampaignSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(120),
  templateId: z.string().min(1),
  templateVersionId: z.string().optional(),
  status: BulkCampaignStatusSchema,
  totalCount: z.number().int().min(0),
  dispatchedCount: z.number().int().min(0),
  signedCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  routingMode: BulkCampaignRoutingModeSchema.default('single_signer'),
  countersignerEmail: z.string().email().optional(),
  countersignerName: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type BulkCampaign = z.infer<typeof BulkCampaignSchema>;

export const CreateBulkCampaignRecipientInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  variables: z.record(z.string(), z.string()).default({}),
});
export type CreateBulkCampaignRecipientInput = z.infer<typeof CreateBulkCampaignRecipientInputSchema>;

export const CreateBulkCampaignRequestSchema = z.object({
  title: z.string().min(1).max(120),
  templateId: z.string().min(1),
  templateVersionId: z.string().optional(),
  routingMode: BulkCampaignRoutingModeSchema.default('single_signer'),
  countersignerEmail: z.string().email().optional(),
  countersignerName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  recipients: z.array(CreateBulkCampaignRecipientInputSchema).min(1).max(5000),
});
export type CreateBulkCampaignRequest = z.infer<typeof CreateBulkCampaignRequestSchema>;

export const EDiscoveryFileEntrySchema = z.object({
  path: z.string().min(1),
  description: z.string().min(1),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().min(0),
  mimeType: z.string().min(1),
});
export type EDiscoveryFileEntry = z.infer<typeof EDiscoveryFileEntrySchema>;

export const EDiscoveryManifestSchema = z.object({
  manifestVersion: z.literal('1.0.0'),
  contractId: z.string().min(1),
  envelopeId: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  exportedAt: z.string(),
  exportedByUserId: z.string().min(1),
  files: z.array(EDiscoveryFileEntrySchema).min(1),
  merkleRootSha256: z.string().length(64),
  legalHoldActive: z.boolean(),
  legalHoldDetails: z.object({
    matterId: z.string().optional(),
    reason: z.string().optional(),
    placedAt: z.string().optional(),
  }).optional(),
});
export type EDiscoveryManifest = z.infer<typeof EDiscoveryManifestSchema>;

export const BulkCsvMergePreviewItemSchema = z.object({
  rowIndex: z.number().int().min(1),
  recipientName: z.string(),
  recipientEmail: z.string(),
  mappedVariables: z.record(z.string(), z.string()),
  missingVariables: z.array(z.string()),
  isValid: z.boolean(),
  errors: z.array(z.string()),
});
export type BulkCsvMergePreviewItem = z.infer<typeof BulkCsvMergePreviewItemSchema>;

export const BulkCsvMergePreviewResultSchema = z.object({
  totalRows: z.number().int().min(0),
  validRows: z.number().int().min(0),
  invalidRows: z.number().int().min(0),
  detectedColumns: z.array(z.string()),
  templateVariables: z.array(z.string()),
  unmappedVariables: z.array(z.string()),
  previewSample: z.array(BulkCsvMergePreviewItemSchema),
});
export type BulkCsvMergePreviewResult = z.infer<typeof BulkCsvMergePreviewResultSchema>;





