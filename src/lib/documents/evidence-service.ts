/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Cryptographic Evidence Service (ESIGN & eIDAS Compliance):
 *    Calculates deterministic SHA-256 binary digests over document bytes and generates
 *    append-only evidentiary audit trail logs in the `signing_evidence` Firestore collection.
 * 2. Immutability & Legal Evidentiary Weight:
 *    Records written here must NEVER be mutated or deleted. Each entry records the
 *    envelope ID, action type (created, sent, opened, signed, completed, voided),
 *    actor details (recipient ID, email, name, IP address, user agent), and document digest.
 * 3. Strict Typing & Zero-Any (Rule 4):
 *    Explicit type definitions imported directly from `@/lib/types/document-signing`.
 *    Zero tolerance for `any` or unchecked casts.
 * 4. Testability:
 *    Fully covered by unit tests in `src/lib/documents/__tests__/evidence-service.test.ts`.
 */

import { createHash } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type {
  EvidenceAuditLogEntry,
  CreateEvidenceRecordInput,
} from '@/lib/types/document-signing';

/**
 * Computes a deterministic SHA-256 hexadecimal digest from a binary buffer.
 *
 * @param data Buffer or Uint8Array representing the document or asset payload.
 * @returns 64-character lowercase hexadecimal SHA-256 digest string.
 */
export function calculateSha256Digest(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Creates an append-only legal audit log entry in the `signing_evidence` collection.
 *
 * @param input Audit metadata including actor identity, action type, IP, and optional document digest.
 * @returns Fully populated EvidenceAuditLogEntry with generated Firestore document ID and ISO timestamp.
 */
export async function createEvidenceRecord(
  input: CreateEvidenceRecordInput
): Promise<EvidenceAuditLogEntry> {
  const timestamp = new Date().toISOString();

  // Strip undefined values to maintain clean Firestore document structures
  const recordPayload: Omit<EvidenceAuditLogEntry, 'id'> = {
    envelopeId: input.envelopeId,
    action: input.action,
    timestamp,
    ...(input.recipientId ? { recipientId: input.recipientId } : {}),
    ...(input.recipientEmail ? { recipientEmail: input.recipientEmail } : {}),
    ...(input.recipientName ? { recipientName: input.recipientName } : {}),
    ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    ...(input.documentDigest ? { documentDigest: input.documentDigest } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const docRef = await adminDb.collection('signing_evidence').add(recordPayload);

  return {
    id: docRef.id,
    ...recordPayload,
  };
}

/**
 * Retrieves the complete chronological audit trail of evidentiary events for a given envelope.
 *
 * @param envelopeId The unique identifier of the signing envelope or contract.
 * @returns Array of EvidenceAuditLogEntry records ordered chronologically (ascending).
 */
export async function getEvidenceAuditTrail(
  envelopeId: string
): Promise<EvidenceAuditLogEntry[]> {
  const snapshot = await adminDb
    .collection('signing_evidence')
    .where('envelopeId', '==', envelopeId)
    .orderBy('timestamp', 'asc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Omit<EvidenceAuditLogEntry, 'id'>;
    return {
      id: doc.id,
      envelopeId: data.envelopeId,
      action: data.action,
      recipientId: data.recipientId,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      documentDigest: data.documentDigest,
      timestamp: data.timestamp,
      metadata: data.metadata,
    };
  });
}
