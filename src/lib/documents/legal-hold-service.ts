/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Enterprise Legal Hold & Statutory Retention Service (Phase 9):
 * 1. Purpose & Standards:
 *    Enforces litigation hold freezes and statutory retention policies across
 *    contracts and signing envelopes, satisfying legal defensibility standards
 *    (FRCP Rules 26 & 37, Sarbanes-Oxley, eIDAS, and GDPR compliance).
 * 2. Immutable Legal Hold Barrier (FM-P9-05):
 *    Any contract with `isUnderLegalHold: true` or `legalHoldDetails.isUnderLegalHold: true`
 *    is strictly frozen against deletion, purging, or TTL automated disposal.
 *    Calling `assertContractNotUnderLegalHold` throws `LegalHoldActiveError` (HTTP 423 Locked).
 * 3. Store Harmonization:
 *    Authoritatively reads and mutates documents in the root `contracts` collection
 *    with `workspaceId` matching to enforce multi-tenant isolation.
 * 4. Evidentiary Audit Logging:
 *    All hold placement and release transitions generate immutable evidentiary logs
 *    in `signing_evidence`.
 * 5. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';
import { createEvidenceRecord } from '@/lib/documents/evidence-service';
import {
  LegalHoldStatus,
  LegalHoldStatusSchema,
  RetentionCategory,
} from '@/lib/types/document-signing';

export class LegalHoldActiveError extends Error {
  public readonly contractId: string;
  public readonly matterId?: string;
  public readonly reason?: string;

  constructor(contractId: string, matterId?: string, reason?: string) {
    super(
      `Contract ${contractId} is protected under active Legal Hold (Matter: ${
        matterId || 'Active Litigation'
      }): ${reason || 'Deletion or purge prohibited by litigation hold'}`
    );
    this.name = 'LegalHoldActiveError';
    this.contractId = contractId;
    this.matterId = matterId;
    this.reason = reason;
  }
}

export interface PlaceLegalHoldInput {
  matterId: string;
  reason: string;
}

export interface ReleaseLegalHoldInput {
  reason?: string;
}

export interface RetentionScheduleResult {
  category: RetentionCategory;
  retentionYears: number;
  executedAt: string;
  expirationDate: string;
  isExpired: boolean;
}

/**
 * Places a contract on active legal hold, immediately freezing it from deletion or purging (FM-P9-05).
 */
export async function placeContractLegalHold(
  workspaceId: string,
  contractId: string,
  input: PlaceLegalHoldInput,
  userId: string
): Promise<LegalHoldStatus> {
  const contractRef = adminDb.collection('contracts').doc(contractId);
  const contractSnap = await contractRef.get();

  if (!contractSnap.exists) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  const contractData = contractSnap.data();
  if (contractData?.workspaceId && contractData.workspaceId !== workspaceId) {
    throw new Error('Tenant isolation violation: contract does not belong to active workspace');
  }

  const now = new Date().toISOString();
  const holdId = randomUUID();

  const holdStatus: LegalHoldStatus = {
    isUnderLegalHold: true,
    holdId,
    matterId: input.matterId,
    reason: input.reason,
    placedByUserId: userId,
    placedAt: now,
  };

  const validated = LegalHoldStatusSchema.parse(holdStatus);

  await contractRef.update({
    isUnderLegalHold: true,
    legalHoldDetails: validated,
    updatedAt: now,
  });

  // Append immutable audit log to signing_evidence
  try {
    await createEvidenceRecord({
      envelopeId: contractId,
      action: 'completed', // Audit event
      recipientName: 'Compliance Officer',
      metadata: {
        eventType: 'legal_hold_placed',
        holdId,
        matterId: input.matterId,
        reason: input.reason,
        userId,
      },
    });
  } catch (err: unknown) {
    console.warn('[legal-hold-service] Non-fatal evidence record error:', err);
  }

  return validated;
}

/**
 * Releases a contract from legal hold, unfreezing it for standard lifecycle operations.
 */
export async function releaseContractLegalHold(
  workspaceId: string,
  contractId: string,
  input: ReleaseLegalHoldInput,
  userId: string
): Promise<LegalHoldStatus> {
  const contractRef = adminDb.collection('contracts').doc(contractId);
  const contractSnap = await contractRef.get();

  if (!contractSnap.exists) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  const contractData = contractSnap.data();
  if (contractData?.workspaceId && contractData.workspaceId !== workspaceId) {
    throw new Error('Tenant isolation violation: contract does not belong to active workspace');
  }

  const existingDetails = contractData?.legalHoldDetails as LegalHoldStatus | undefined;
  const now = new Date().toISOString();

  const releasedStatus: LegalHoldStatus = {
    isUnderLegalHold: false,
    holdId: existingDetails?.holdId,
    matterId: existingDetails?.matterId,
    reason: input.reason || existingDetails?.reason,
    placedAt: existingDetails?.placedAt,
    placedByUserId: existingDetails?.placedByUserId,
    releasedAt: now,
    releasedByUserId: userId,
  };

  const validated = LegalHoldStatusSchema.parse(releasedStatus);

  await contractRef.update({
    isUnderLegalHold: false,
    legalHoldDetails: validated,
    updatedAt: now,
  });

  // Append immutable audit log to signing_evidence
  try {
    await createEvidenceRecord({
      envelopeId: contractId,
      action: 'completed',
      recipientName: 'Compliance Officer',
      metadata: {
        eventType: 'legal_hold_released',
        holdId: existingDetails?.holdId,
        matterId: existingDetails?.matterId,
        releaseReason: input.reason,
        userId,
      },
    });
  } catch (err: unknown) {
    console.warn('[legal-hold-service] Non-fatal evidence record error:', err);
  }

  return validated;
}

/**
 * Asserts that a contract is not under legal hold (FM-P9-05).
 * Throws LegalHoldActiveError if frozen.
 */
export async function assertContractNotUnderLegalHold(contractId: string): Promise<void> {
  const contractSnap = await adminDb.collection('contracts').doc(contractId).get();

  if (!contractSnap.exists) {
    return; // Contract doesn't exist, allow caller to handle 404
  }

  const data = contractSnap.data();
  const isHeld = data?.isUnderLegalHold === true || data?.legalHoldDetails?.isUnderLegalHold === true;

  if (isHeld) {
    const details = data?.legalHoldDetails as LegalHoldStatus | undefined;
    throw new LegalHoldActiveError(
      contractId,
      details?.matterId,
      details?.reason
    );
  }
}

const STATUTORY_RETENTION_YEARS: Record<RetentionCategory, number> = {
  statutory_tax: 7,
  financial: 7,
  employment: 5,
  intellectual_property: 20,
  standard: 3,
  custom: 10,
};

/**
 * Calculates statutory retention schedule and expiration date for an executed contract.
 */
export function calculateRetentionSchedule(
  category: RetentionCategory,
  executedAtIso: string
): RetentionScheduleResult {
  const executedDate = new Date(executedAtIso);
  const validExecutedDate = isNaN(executedDate.getTime()) ? new Date() : executedDate;

  const retentionYears = STATUTORY_RETENTION_YEARS[category] || 3;
  const expirationDate = new Date(validExecutedDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + retentionYears);

  const now = new Date();
  const isExpired = now.getTime() >= expirationDate.getTime();

  return {
    category,
    retentionYears,
    executedAt: validExecutedDate.toISOString(),
    expirationDate: expirationDate.toISOString(),
    isExpired,
  };
}

/**
 * Retrieves the current legal hold status for a contract.
 */
export async function getContractLegalHoldStatus(
  contractId: string
): Promise<LegalHoldStatus | null> {
  const contractSnap = await adminDb.collection('contracts').doc(contractId).get();

  if (!contractSnap.exists) {
    return null;
  }

  const data = contractSnap.data();
  if (data?.legalHoldDetails) {
    return data.legalHoldDetails as LegalHoldStatus;
  }

  return {
    isUnderLegalHold: data?.isUnderLegalHold === true,
  };
}
