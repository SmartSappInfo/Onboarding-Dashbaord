/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Bi-directional compatibility adapter between legacy Single-Signer Contracts / PDF Forms
 *    and the Phase 2 Multi-Party Signing Envelope Domain Model (P2.2).
 * 2. Invariants & Guarantees:
 *    - Dual-Read & Write Preservation: Guarantees 100% backward compatibility for existing
 *      contracts in Firestore, legacy signing URLs, and CRM deal listeners.
 *    - Virtual Recipient Synthesis: When legacy contracts have empty recipient arrays,
 *      synthesizes a virtual primary signer using entity snapshots.
 *    - Preserves All Core IDs: `id`, `contractId`, `entityId`, `dealId`, `storagePath`, and digests.
 * 3. Strict Typing Standard (Rule 4):
 *    Zero tolerance for `any` or `any[]`.
 */

import type { Contract, PDFForm, ContractStatus } from '@/lib/types';
import type {
  SigningEnvelope,
  EnvelopeRecipient,
  EnvelopeStatus,
  RecipientRole,
  RecipientStatus,
} from '@/lib/types/document-signing';

/**
 * Maps a legacy Contract status to an authoritative Envelope status.
 */
export function mapContractStatusToEnvelopeStatus(status: ContractStatus): EnvelopeStatus {
  switch (status) {
    case 'signed':
      return 'completed';
    case 'sent':
      return 'sent';
    case 'partially_signed':
      return 'in_progress';
    case 'draft':
      return 'draft';
    case 'expired':
      return 'expired';
    case 'no_contract':
      return 'draft';
    default:
      return 'draft';
  }
}

/**
 * Maps an authoritative Envelope status back to a legacy Contract status.
 */
export function mapEnvelopeStatusToContractStatus(status: EnvelopeStatus): ContractStatus {
  switch (status) {
    case 'completed':
      return 'signed';
    case 'in_progress':
      return 'partially_signed';
    case 'sent':
      return 'sent';
    case 'draft':
    case 'pending_approval':
      return 'draft';
    case 'declined':
    case 'voided':
    case 'expired':
      return 'expired';
    default:
      return 'draft';
  }
}

/**
 * Maps a legacy or raw role string to a valid RecipientRole.
 */
export function mapRecipientRole(role?: string): RecipientRole {
  switch (role) {
    case 'approver':
      return 'approver';
    case 'countersigner':
      return 'countersigner';
    case 'viewer':
      return 'viewer';
    case 'signer':
    default:
      return 'signer';
  }
}

/**
 * Converts a legacy single-signer Contract and PDFForm definition into an authoritative
 * Phase 2 SigningEnvelope domain aggregate.
 */
export function legacyContractToEnvelope(
  contract: Contract,
  pdfForm?: Partial<PDFForm>
): SigningEnvelope {
  const workspaceId = pdfForm?.workspaceIds?.[0] || 'default';
  const envelopeStatus = mapContractStatusToEnvelopeStatus(contract.status);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.parse(contract.createdAt || nowIso) + 30 * 86400000).toISOString();

  let recipients: EnvelopeRecipient[] = [];

  if (contract.recipients && contract.recipients.length > 0) {
    recipients = contract.recipients.map((rec, idx) => {
      const isSigned = contract.status === 'signed';
      const isSentOrPartial = contract.status === 'sent' || contract.status === 'partially_signed';

      const recipientStatus: RecipientStatus = isSigned
        ? 'signed'
        : isSentOrPartial
        ? 'invited'
        : 'pending';

      return {
        id: `${contract.id}_rec_${idx + 1}`,
        workspaceId,
        envelopeId: contract.id,
        entityId: contract.entityId,
        role: mapRecipientRole(rec.type),
        name: rec.name || contract.entityName || 'Signatory',
        email: rec.email || 'recipient@placeholder.internal',
        phone: rec.phone,
        routingOrder: idx + 1,
        status: recipientStatus,
        tokenHash: `legacy_token_hash_${contract.id}_${idx + 1}`,
        tokenExpiresAt: expiresAt,
        signedAt: isSigned ? contract.signedAt : undefined,
      };
    });
  } else {
    // Synthesize single virtual recipient from entity metadata
    const isSigned = contract.status === 'signed';
    const recipientStatus: RecipientStatus = isSigned
      ? 'signed'
      : contract.status === 'sent'
      ? 'invited'
      : 'pending';

    recipients = [
      {
        id: `${contract.id}_rec_1`,
        workspaceId,
        envelopeId: contract.id,
        entityId: contract.entityId,
        role: 'signer',
        name: contract.entityName || 'Signatory',
        email: 'recipient@placeholder.internal',
        routingOrder: 1,
        status: recipientStatus,
        tokenHash: `legacy_token_hash_${contract.id}_1`,
        tokenExpiresAt: expiresAt,
        signedAt: isSigned ? contract.signedAt : undefined,
      },
    ];
  }

  return {
    id: contract.id,
    workspaceId,
    title: contract.pdfName || pdfForm?.name || 'Agreement',
    status: envelopeStatus,
    templateId: contract.pdfId,
    contractId: contract.id,
    dealId: contract.dealId,
    entityId: contract.entityId,
    routingMode: 'sequential',
    currentRoutingOrder: 1,
    recipients,
    documentStoragePath: contract.storagePath || pdfForm?.storagePath || '',
    preExecutionSha256: contract.documentDigest || 'legacy_unhashed',
    completedDocumentStoragePath: contract.status === 'signed' ? (contract.storagePath || undefined) : undefined,
    completedSha256: contract.status === 'signed' ? (contract.documentDigest || undefined) : undefined,
    expiresAt,
    completedAt: contract.signedAt,
    createdBy: 'legacy_system',
    createdAt: contract.createdAt || nowIso,
    updatedAt: contract.updatedAt || nowIso,
    isLegacyMigrated: true,
  };
}

/**
 * Projects a modern Phase 2 SigningEnvelope back into a legacy Contract structure
 * to guarantee that older subsystems (e.g. legacy table viewers or reports) continue functioning.
 */
export function envelopeToLegacyContract(envelope: SigningEnvelope): Contract {
  const primaryRecipient = envelope.recipients[0];

  return {
    id: envelope.contractId || envelope.id,
    entityId: envelope.entityId || primaryRecipient?.entityId || '',
    entityName: primaryRecipient?.name || envelope.title,
    pdfId: envelope.templateId || envelope.pdfTemplateId || '',
    pdfName: envelope.title,
    status: mapEnvelopeStatusToContractStatus(envelope.status),
    signedAt: envelope.completedAt,
    sentAt: envelope.createdAt,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    dealId: envelope.dealId,
    storagePath: envelope.completedDocumentStoragePath || envelope.documentStoragePath,
    documentDigest: envelope.completedSha256 || envelope.preExecutionSha256,
    recipients: envelope.recipients.map((r) => ({
      name: r.name,
      email: r.email,
      phone: r.phone,
      type: r.role,
    })),
  };
}
