/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Post-Signing Contract Lifecycle & Relationship Engine (Phase 3 Task 3):
 *    Governs the post-signature operational lifecycle of contracts (from execution
 *    to active performance, amendments, renewals, and archival/termination).
 * 2. Non-Destructive Audit Trail:
 *    Amendments and renewals create distinct child `ContractRecord` entities linked
 *    via `ContractRelationship` records without mutating or overwriting the
 *    original signed PDF and verification certificates of the parent agreement.
 * 3. Commercial Urgency Intelligence:
 *    Calculates renewal countdowns, notice periods, and expiry urgency to trigger
 *    timely operational actions and CRM notifications.
 * 4. Strict Typing & Zero-`any` (Rule 4):
 *    Strictly typed with Zod schema validation on all inputs and returned records.
 */

import {
  ContractRecordSchema,
  ContractRelationshipSchema,
  type ContractRecord,
  type ContractLifecycleStatus,
  type ContractRelationship,
} from '@/lib/types/document-signing';

export interface TransitionOptions {
  reason?: string;
  updatedBy?: string;
}

export interface CreateContractAmendmentParams {
  parentContract: ContractRecord;
  amendmentTitle: string;
  description?: string;
  createdBy: string;
  customContractValue?: {
    amount: number;
    currency: string;
    cadence?: 'one_off' | 'monthly' | 'quarterly' | 'annually';
  };
}

export interface CreateContractAmendmentResult {
  amendmentContract: ContractRecord;
  updatedParentContract: ContractRecord;
  relationship: ContractRelationship;
}

export interface CreateContractRenewalParams {
  parentContract: ContractRecord;
  renewalTitle: string;
  newEffectiveAt: string;
  newExpiresAt: string;
  newRenewalAt?: string;
  createdBy: string;
}

export interface CreateContractRenewalResult {
  renewalContract: ContractRecord;
  updatedParentContract: ContractRecord;
  relationship: ContractRelationship;
}

export interface ContractRenewalUrgency {
  daysUntilExpiration: number | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isRenewalDue: boolean;
  urgencyLevel: 'normal' | 'warning' | 'critical' | 'expired';
  badgeLabel: string;
}

/**
 * Valid state machine transitions map.
 */
const VALID_TRANSITIONS: Record<ContractLifecycleStatus, readonly ContractLifecycleStatus[]> = {
  proposed: ['negotiation', 'pending_execution', 'terminated'],
  negotiation: ['proposed', 'pending_execution', 'terminated'],
  pending_execution: ['executed', 'negotiation', 'terminated'],
  executed: ['active', 'superseded', 'terminated'],
  active: ['renewal_pending', 'renewed', 'amended', 'expired', 'terminated', 'superseded'],
  renewal_pending: ['renewed', 'active', 'expired', 'terminated'],
  renewed: ['active', 'superseded', 'terminated'],
  amended: ['active', 'superseded', 'terminated'],
  expired: ['renewed', 'superseded', 'terminated'],
  terminated: [], // Terminal state
  superseded: [], // Terminal state
};

/**
 * Validates and applies a contract lifecycle status transition.
 */
export function transitionContractStatus(
  contract: ContractRecord,
  nextStatus: ContractLifecycleStatus,
  _options?: TransitionOptions
): ContractRecord {
  if (contract.status === nextStatus) {
    return contract;
  }

  const allowedTransitions = VALID_TRANSITIONS[contract.status];
  if (!allowedTransitions || !allowedTransitions.includes(nextStatus)) {
    throw new Error(
      `Invalid contract status transition from "${contract.status}" to "${nextStatus}".`
    );
  }

  const now = new Date().toISOString();
  return ContractRecordSchema.parse({
    ...contract,
    status: nextStatus,
    updatedAt: now,
  });
}

/**
 * Creates an amendment contract linked to a parent agreement without overwriting the parent.
 */
export function createContractAmendment(
  params: CreateContractAmendmentParams
): CreateContractAmendmentResult {
  const { parentContract, amendmentTitle, description, createdBy, customContractValue } = params;

  const now = new Date().toISOString();
  const amendmentId = `cnt_amend_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const relationshipId = `rel_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

  const amendmentContract: ContractRecord = ContractRecordSchema.parse({
    id: amendmentId,
    workspaceId: parentContract.workspaceId,
    title: amendmentTitle,
    status: 'proposed',
    parentContractId: parentContract.id,
    templateId: parentContract.templateId,
    templateVersionId: parentContract.templateVersionId,
    dealId: parentContract.dealId,
    entityId: parentContract.entityId,
    partyLinks: JSON.parse(JSON.stringify(parentContract.partyLinks)),
    contractValue: customContractValue ?? parentContract.contractValue,
    noticePeriodDays: parentContract.noticePeriodDays,
    ownerId: createdBy || parentContract.ownerId,
    tagIds: [...parentContract.tagIds, 'amendment'],
    createdAt: now,
    updatedAt: now,
  });

  const updatedParentContract: ContractRecord = ContractRecordSchema.parse({
    ...parentContract,
    status: 'amended',
    updatedAt: now,
  });

  const relationship: ContractRelationship = ContractRelationshipSchema.parse({
    id: relationshipId,
    workspaceId: parentContract.workspaceId,
    sourceContractId: parentContract.id,
    targetContractId: amendmentId,
    relationshipType: 'amendment',
    description: description ?? 'Contract Amendment',
    createdAt: now,
    createdBy,
  });

  return {
    amendmentContract,
    updatedParentContract,
    relationship,
  };
}

/**
 * Creates a renewed agreement record linked to the expiring parent agreement.
 */
export function createContractRenewal(
  params: CreateContractRenewalParams
): CreateContractRenewalResult {
  const { parentContract, renewalTitle, newEffectiveAt, newExpiresAt, newRenewalAt, createdBy } = params;

  const now = new Date().toISOString();
  const renewalId = `cnt_renew_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const relationshipId = `rel_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

  const renewalContract: ContractRecord = ContractRecordSchema.parse({
    id: renewalId,
    workspaceId: parentContract.workspaceId,
    title: renewalTitle,
    status: 'proposed',
    parentContractId: parentContract.id,
    templateId: parentContract.templateId,
    templateVersionId: parentContract.templateVersionId,
    dealId: parentContract.dealId,
    entityId: parentContract.entityId,
    partyLinks: JSON.parse(JSON.stringify(parentContract.partyLinks)),
    contractValue: parentContract.contractValue,
    effectiveAt: newEffectiveAt,
    expiresAt: newExpiresAt,
    renewalAt: newRenewalAt,
    noticePeriodDays: parentContract.noticePeriodDays,
    ownerId: createdBy || parentContract.ownerId,
    tagIds: [...parentContract.tagIds, 'renewal'],
    createdAt: now,
    updatedAt: now,
  });

  const updatedParentContract: ContractRecord = ContractRecordSchema.parse({
    ...parentContract,
    status: 'renewed',
    updatedAt: now,
  });

  const relationship: ContractRelationship = ContractRelationshipSchema.parse({
    id: relationshipId,
    workspaceId: parentContract.workspaceId,
    sourceContractId: parentContract.id,
    targetContractId: renewalId,
    relationshipType: 'renewal',
    description: `Renewal for agreement ${parentContract.title}`,
    createdAt: now,
    createdBy,
  });

  return {
    renewalContract,
    updatedParentContract,
    relationship,
  };
}

/**
 * Calculates days remaining, urgency tier, and everyday microcopy badge for contract renewal.
 */
export function calculateRenewalUrgency(
  contract: ContractRecord,
  referenceDate: Date = new Date()
): ContractRenewalUrgency {
  const refTime = referenceDate.getTime();
  const msInDay = 1000 * 60 * 60 * 24;

  let daysUntilExpiration: number | null = null;
  let isExpired = false;

  if (contract.expiresAt) {
    const expTime = new Date(contract.expiresAt).getTime();
    daysUntilExpiration = Math.ceil((expTime - refTime) / msInDay);
    if (daysUntilExpiration < 0) {
      isExpired = true;
    }
  }

  let daysUntilRenewal: number | null = null;
  let isRenewalDue = false;

  if (contract.renewalAt) {
    const renTime = new Date(contract.renewalAt).getTime();
    daysUntilRenewal = Math.ceil((renTime - refTime) / msInDay);
    const threshold = contract.noticePeriodDays ?? 30;
    if (daysUntilRenewal <= threshold) {
      isRenewalDue = true;
    }
  }

  // Determine urgency level and badge label
  if (isExpired) {
    const absDays = Math.abs(daysUntilExpiration ?? 0);
    return {
      daysUntilExpiration,
      daysUntilRenewal,
      isExpired: true,
      isRenewalDue: false,
      urgencyLevel: 'expired',
      badgeLabel: `Expired ${absDays} days ago`,
    };
  }

  if (isRenewalDue && daysUntilRenewal !== null) {
    const urgencyLevel = daysUntilRenewal <= 14 ? 'critical' : 'warning';
    const badgeLabel =
      daysUntilRenewal >= 0
        ? `Renews in ${daysUntilRenewal} days`
        : `Renewal overdue by ${Math.abs(daysUntilRenewal)} days`;

    return {
      daysUntilExpiration,
      daysUntilRenewal,
      isExpired: false,
      isRenewalDue: true,
      urgencyLevel,
      badgeLabel,
    };
  }

  if (daysUntilExpiration !== null) {
    let urgencyLevel: 'normal' | 'warning' | 'critical' = 'normal';
    if (daysUntilExpiration <= 14) {
      urgencyLevel = 'critical';
    } else if (daysUntilExpiration <= 45) {
      urgencyLevel = 'warning';
    }

    return {
      daysUntilExpiration,
      daysUntilRenewal,
      isExpired: false,
      isRenewalDue: false,
      urgencyLevel,
      badgeLabel: `Expires in ${daysUntilExpiration} days`,
    };
  }

  return {
    daysUntilExpiration: null,
    daysUntilRenewal: null,
    isExpired: false,
    isRenewalDue: false,
    urgencyLevel: 'normal',
    badgeLabel: 'Active',
  };
}
