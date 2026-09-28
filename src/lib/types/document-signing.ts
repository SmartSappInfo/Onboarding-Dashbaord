/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Single Source of Truth for Document Signing Domain Models:
 *    Defines strict TypeScript data models for Envelopes, Recipients,
 *    Evidence Records, Audit Certificates, and Execution Events.
 * 2. Strict Typing Enforcement:
 *    Zero tolerance for `any` or `any[]`. All metadata dictionaries must be
 *    typed as `Record<string, unknown>` or strictly enumerated.
 * 3. Security & Immutability:
 *    EvidenceAuditLogEntry records represent append-only immutable legal logs
 *    stored in `signing_evidence` collection in Firestore.
 */

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
  | 'expired';

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

export interface SigningEnvelopeRecipient {
  id: string;
  name: string;
  email: string;
  role?: string;
  routingOrder?: number;
  status: 'pending' | 'sent' | 'opened' | 'signed' | 'declined';
  signedAt?: string;
  signatureUrl?: string;
  signatureHash?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SigningEnvelope {
  id: string;
  workspaceId: string;
  title: string;
  status: 'draft' | 'pending' | 'signed' | 'declined' | 'voided' | 'expired';
  pdfTemplateId?: string;
  recipients: SigningEnvelopeRecipient[];
  storagePath?: string;
  originalDocumentDigest?: string;
  finalDocumentDigest?: string;
  certificateStoragePath?: string;
  dealId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}
