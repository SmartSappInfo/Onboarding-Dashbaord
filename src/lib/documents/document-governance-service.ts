/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Governance, Legal Hold & Evidence Package Exporter (Phase 6):
 * 1. Purpose & Legal Compliance (FM-P6-03 & FM-P6-06):
 *    Provides statutory retention schedule management, litigation holds,
 *    and tamper-evident cryptographic evidence packages for the e-signature system.
 * 2. Immutable Legal Hold (FM-P6-03):
 *    Contracts flagged with `isUnderLegalHold: true` are blocked from deletion
 *    or automated data retention purging. Attempting to delete a contract on
 *    hold immediately throws `LegalHoldActiveError`.
 * 3. Evidence Package Checksums (FM-P6-06):
 *    Generates comprehensive cryptographic manifests (`manifest.json`) verifying
 *    individual SHA-256 digests of the vector PDF, completion certificate, and
 *    audit event log, anchored with an overall bundle checksum.
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  LegalHoldStatus,
  LegalHoldStatusSchema,
  ContractRetentionPolicy,
  ContractRetentionPolicySchema,
  RetentionCategory,
  EvidencePackageManifest,
  EvidencePackageManifestSchema,
} from '@/lib/types/document-signing';
import { createHash, randomUUID } from 'crypto';

export class LegalHoldActiveError extends Error {
  public readonly contractId: string;
  public readonly matterId?: string;

  constructor(contractId: string, matterId?: string, reason?: string) {
    super(
      `Contract ${contractId} is protected under active Legal Hold (Matter: ${
        matterId || 'Unknown'
      }): ${reason || 'Deletion or purge prohibited by litigation hold'}`
    );
    this.name = 'LegalHoldActiveError';
    this.contractId = contractId;
    this.matterId = matterId;
  }
}

/**
 * Places a contract on active legal hold, freezing it from deletion and automated purging (FM-P6-03).
 */
export async function applyLegalHoldToContract(
  workspaceId: string,
  contractId: string,
  input: {
    holdId: string;
    matterId: string;
    reason: string;
    placedByUserId: string;
  }
): Promise<LegalHoldStatus> {
  const now = new Date().toISOString();
  const holdStatus: LegalHoldStatus = {
    isUnderLegalHold: true,
    holdId: input.holdId,
    matterId: input.matterId,
    reason: input.reason,
    placedByUserId: input.placedByUserId,
    placedAt: now,
  };

  const validated = LegalHoldStatusSchema.parse(holdStatus);

  await adminDb
    .collection(`workspaces/${workspaceId}/contracts`)
    .doc(contractId)
    .update({
      isUnderLegalHold: true,
      legalHoldDetails: validated,
      updatedAt: now,
    });

  return validated;
}

/**
 * Releases a contract from legal hold, returning it to standard lifecycle and retention schedules.
 */
export async function releaseLegalHoldFromContract(
  workspaceId: string,
  contractId: string,
  input: {
    releasedByUserId: string;
    reason?: string;
  }
): Promise<LegalHoldStatus> {
  const now = new Date().toISOString();
  const releasedStatus: LegalHoldStatus = {
    isUnderLegalHold: false,
    releasedAt: now,
    releasedByUserId: input.releasedByUserId,
  };

  const validated = LegalHoldStatusSchema.parse(releasedStatus);

  await adminDb
    .collection(`workspaces/${workspaceId}/contracts`)
    .doc(contractId)
    .update({
      isUnderLegalHold: false,
      legalHoldDetails: validated,
      updatedAt: now,
    });

  return validated;
}

/**
 * Checks if a contract can be safely purged or deleted, enforcing the Legal Hold invariant (FM-P6-03).
 */
export async function checkContractDeletionEligibility(
  workspaceId: string,
  contractId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  const docSnap = await adminDb
    .collection(`workspaces/${workspaceId}/contracts`)
    .doc(contractId)
    .get();

  if (!docSnap.exists) {
    return { canDelete: true };
  }

  const data = docSnap.data();
  if (data?.isUnderLegalHold) {
    const details = data.legalHoldDetails as LegalHoldStatus | undefined;
    const reason = details?.reason
      ? `Contract is protected under active Legal Hold: ${details.reason}`
      : 'Contract is protected under active Legal Hold';
    return { canDelete: false, reason };
  }

  return { canDelete: true };
}

/**
 * Computes statutory retention expiration date based on contract category and execution date.
 */
export function calculateRetentionExpiration(
  category: RetentionCategory,
  executedAtIso: string,
  customYears?: number
): Date {
  const baseDate = new Date(executedAtIso);
  let yearsToAdd = 3;

  switch (category) {
    case 'financial':
    case 'statutory_tax':
      yearsToAdd = 7;
      break;
    case 'employment':
      yearsToAdd = 5;
      break;
    case 'intellectual_property':
      yearsToAdd = 10;
      break;
    case 'custom':
      yearsToAdd = customYears && customYears > 0 ? customYears : 3;
      break;
    case 'standard':
    default:
      yearsToAdd = 3;
      break;
  }

  const expDate = new Date(baseDate.getTime());
  expDate.setUTCFullYear(expDate.getUTCFullYear() + yearsToAdd);
  return expDate;
}

/**
 * Generates an authoritative, tamper-proof Evidence Package Manifest with SHA-256 hashes (FM-P6-06).
 */
export function generateEvidencePackageManifest(params: {
  workspaceId: string;
  contractId: string;
  envelopeId?: string;
  documentBuffer: Buffer;
  certificateBuffer: Buffer;
  auditEvents: unknown[];
}): EvidencePackageManifest {
  const documentSha256 = createHash('sha256').update(params.documentBuffer).digest('hex');
  const certificateSha256 = createHash('sha256').update(params.certificateBuffer).digest('hex');
  const auditEventsJson = JSON.stringify(params.auditEvents);
  const auditEventsSha256 = createHash('sha256').update(auditEventsJson).digest('hex');

  const nowIso = new Date().toISOString();
  const packageId = `pkg_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const manifestPayload = `${params.workspaceId}:${params.contractId}:${documentSha256}:${certificateSha256}:${auditEventsSha256}`;
  const manifestSha256 = createHash('sha256').update(manifestPayload).digest('hex');

  const overallChecksum = createHash('sha256')
    .update(`${manifestSha256}:${nowIso}:${params.auditEvents.length}`)
    .digest('hex');

  const manifest: EvidencePackageManifest = {
    packageId,
    workspaceId: params.workspaceId,
    contractId: params.contractId,
    envelopeId: params.envelopeId,
    generatedAt: nowIso,
    documentSha256,
    certificateSha256,
    auditEventsCount: params.auditEvents.length,
    manifestSha256,
    overallChecksum,
  };

  return EvidencePackageManifestSchema.parse(manifest);
}

/**
 * Retrieves all statutory retention policies configured for a workspace.
 */
export async function getWorkspaceRetentionPolicies(
  workspaceId: string
): Promise<ContractRetentionPolicy[]> {
  const snapshot = await adminDb
    .collection(`workspaces/${workspaceId}/retention_policies`)
    .get();

  const policies: ContractRetentionPolicy[] = [];
  for (const doc of snapshot.docs) {
    const parsed = ContractRetentionPolicySchema.safeParse(doc.data());
    if (parsed.success && parsed.data.workspaceId === workspaceId) {
      policies.push(parsed.data);
    }
  }

  return policies;
}

/**
 * Creates or updates a statutory retention policy for a workspace.
 */
export async function setWorkspaceRetentionPolicy(
  workspaceId: string,
  input: Omit<ContractRetentionPolicy, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Promise<ContractRetentionPolicy> {
  const policyId = `ret_${input.category}_${input.retentionYears}y`;
  const now = new Date().toISOString();

  const policyData: ContractRetentionPolicy = {
    ...input,
    id: policyId,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  };

  const validated = ContractRetentionPolicySchema.parse(policyData);

  await adminDb
    .collection(`workspaces/${workspaceId}/retention_policies`)
    .doc(policyId)
    .set(validated);

  return validated;
}
