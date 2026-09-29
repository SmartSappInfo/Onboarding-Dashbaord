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

export const ContractObligationSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  contractId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: ObligationTypeSchema.default('deliverable'),
  status: ObligationStatusSchema.default('pending'),
  dueDate: z.string(), // ISO-8601
  responsibleParty: z.enum(['internal', 'counterparty', 'mutual']).default('internal'),
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

