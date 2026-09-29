/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative state machine and routing engine for multi-party envelopes (Phase 2, P2.4).
 * 2. Deterministic & Pure:
 *    All functions here are pure business logic without direct database side effects,
 *    enabling straightforward unit testing, deterministic transitions, and transactional safety.
 * 3. Invariants & Guarantees:
 *    - Sequential Mode: Recipient at order N can NEVER act while any recipient at order < N is incomplete.
 *    - Parallel Mode: All recipients at order 1 can act concurrently in any order.
 *    - Mixed Mode: Parallel cohorts at order N must all finish before order N+1 is invited.
 *    - Decline Invariant: Any decline immediately transitions envelope to terminal 'declined'.
 *    - Terminal Completion: Envelope transitions to 'completed' only when all required signatories complete.
 * 4. Zero Tolerance for `any` (Rule 4):
 *    All arguments, return structures, and internal variables are strictly typed.
 */

import type {
  SigningEnvelope,
  EnvelopeRecipient,
} from '@/lib/types/document-signing';

export interface CanRecipientActResult {
  allowed: boolean;
  reason?: string;
  blockingRecipient?: EnvelopeRecipient;
}

export interface RecipientActionDetails {
  signedAt?: string;
  signatureStoragePath?: string;
  signatureHash?: string;
  ipAddress?: string;
  userAgent?: string;
  declineReason?: string;
  declinedAt?: string;
  formData?: Record<string, unknown>;
}

export interface AdvanceRoutingResult {
  updatedEnvelope: SigningEnvelope;
  newlyInvitedRecipients: EnvelopeRecipient[];
  isTerminal: boolean;
}

export interface EnvelopeProgressResult {
  completedCount: number;
  totalCount: number;
  percentage: number;
}

/**
 * Evaluates whether a given recipient is currently permitted to interact with and execute
 * the envelope, enforcing terminal states, sequential order locks, and individual statuses.
 */
export function canRecipientAct(
  envelope: SigningEnvelope,
  recipientId: string
): CanRecipientActResult {
  // 1. Envelope Status Validation
  if (envelope.status === 'draft') {
    return {
      allowed: false,
      reason: 'Envelope is not yet sent (in draft state).',
    };
  }

  if (envelope.status === 'completed') {
    return {
      allowed: false,
      reason: 'Envelope is already completed.',
    };
  }

  if (envelope.status === 'declined') {
    return {
      allowed: false,
      reason: 'Envelope is declined.',
    };
  }

  if (envelope.status === 'voided') {
    return {
      allowed: false,
      reason: 'Envelope is voided.',
    };
  }

  if (envelope.status === 'expired') {
    return {
      allowed: false,
      reason: 'Envelope has expired.',
    };
  }

  // 2. Recipient Identity & Status Validation
  const recipient = envelope.recipients.find((r) => r.id === recipientId);
  if (!recipient) {
    return {
      allowed: false,
      reason: 'Recipient not found on this envelope.',
    };
  }

  if (recipient.status === 'signed') {
    return {
      allowed: false,
      reason: 'Recipient has already signed.',
    };
  }

  if (recipient.status === 'declined') {
    return {
      allowed: false,
      reason: 'Recipient has declined this document.',
    };
  }

  if (recipient.status === 'revoked') {
    return {
      allowed: false,
      reason: 'Recipient capability has been revoked.',
    };
  }

  if (recipient.status === 'reassigned') {
    return {
      allowed: false,
      reason: 'Recipient has been reassigned to another signatory.',
    };
  }

  // 3. Routing Order Enforcement
  if (envelope.routingMode === 'parallel') {
    return { allowed: true };
  }

  // Sequential or Mixed routing mode
  if (recipient.routingOrder > envelope.currentRoutingOrder) {
    // Find who is holding up the queue
    const blockingRecipient = envelope.recipients
      .filter((r) => r.routingOrder < recipient.routingOrder && r.status !== 'signed' && r.role !== 'viewer')
      .sort((a, b) => a.routingOrder - b.routingOrder)[0];

    return {
      allowed: false,
      reason: `Waiting for previous signatories to complete. Current order is ${envelope.currentRoutingOrder}.`,
      blockingRecipient,
    };
  }

  if (recipient.routingOrder < envelope.currentRoutingOrder) {
    return {
      allowed: false,
      reason: 'Previous signing order phase has already closed.',
    };
  }

  // recipient.routingOrder === envelope.currentRoutingOrder
  return { allowed: true };
}

/**
 * Advances the multi-party envelope state machine deterministically when an action
 * (sign or decline) is performed by a recipient.
 */
export function advanceEnvelopeRouting(
  envelope: SigningEnvelope,
  actedRecipientId: string,
  actionResult: 'signed' | 'declined',
  details?: RecipientActionDetails
): AdvanceRoutingResult {
  const targetRecipientIndex = envelope.recipients.findIndex((r) => r.id === actedRecipientId);
  if (targetRecipientIndex === -1) {
    throw new Error(`Recipient ${actedRecipientId} not found on envelope ${envelope.id}`);
  }

  const nowIso = new Date().toISOString();

  // Create an immutable clone of recipients
  const updatedRecipients: EnvelopeRecipient[] = envelope.recipients.map((rec, idx) => {
    if (idx !== targetRecipientIndex) {
      return { ...rec };
    }

    if (actionResult === 'declined') {
      return {
        ...rec,
        status: 'declined',
        declinedAt: details?.declinedAt || nowIso,
        declineReason: details?.declineReason || 'Declined without specific reason.',
      };
    }

    // actionResult === 'signed'
    return {
      ...rec,
      status: 'signed',
      signedAt: details?.signedAt || nowIso,
      signatureStoragePath: details?.signatureStoragePath || rec.signatureStoragePath,
      signatureHash: details?.signatureHash || rec.signatureHash,
      ipAddress: details?.ipAddress || rec.ipAddress,
      userAgent: details?.userAgent || rec.userAgent,
      formData: details?.formData ? { ...rec.formData, ...details.formData } : rec.formData,
    };
  });

  // Handle Decline: Immediate terminal transition for the entire envelope
  if (actionResult === 'declined') {
    const updatedEnvelope: SigningEnvelope = {
      ...envelope,
      status: 'declined',
      recipients: updatedRecipients,
      updatedAt: nowIso,
    };

    return {
      updatedEnvelope,
      newlyInvitedRecipients: [],
      isTerminal: true,
    };
  }

  // Handle Sign: Evaluate if current routing cohort is satisfied
  const currentOrder = envelope.currentRoutingOrder;
  const currentCohortIncomplete = updatedRecipients.some(
    (r) => r.routingOrder === currentOrder && r.role !== 'viewer' && r.status !== 'signed'
  );

  if (currentCohortIncomplete) {
    // Other signers in this cohort still need to sign (e.g. parallel within mixed mode)
    const updatedEnvelope: SigningEnvelope = {
      ...envelope,
      status: 'in_progress',
      recipients: updatedRecipients,
      updatedAt: nowIso,
    };

    return {
      updatedEnvelope,
      newlyInvitedRecipients: [],
      isTerminal: false,
    };
  }

  // Current cohort complete! Look for next routing order cohort
  const remainingRecipients = updatedRecipients.filter(
    (r) => r.routingOrder > currentOrder && r.role !== 'viewer' && r.status !== 'signed'
  );

  if (remainingRecipients.length > 0) {
    const nextOrder = Math.min(...remainingRecipients.map((r) => r.routingOrder));
    const newlyInvited: EnvelopeRecipient[] = [];

    const recipientsWithNextCohort: EnvelopeRecipient[] = updatedRecipients.map((r) => {
      if (r.routingOrder === nextOrder && r.status === 'pending') {
        const invitedRecipient: EnvelopeRecipient = {
          ...r,
          status: 'invited',
          invitedAt: nowIso,
        };
        newlyInvited.push(invitedRecipient);
        return invitedRecipient;
      }
      return r;
    });

    const updatedEnvelope: SigningEnvelope = {
      ...envelope,
      status: 'in_progress',
      currentRoutingOrder: nextOrder,
      recipients: recipientsWithNextCohort,
      updatedAt: nowIso,
    };

    return {
      updatedEnvelope,
      newlyInvitedRecipients: newlyInvited,
      isTerminal: false,
    };
  }

  // All cohorts completed! Terminal 'completed' state
  const updatedEnvelope: SigningEnvelope = {
    ...envelope,
    status: 'completed',
    recipients: updatedRecipients,
    completedAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    updatedEnvelope,
    newlyInvitedRecipients: [],
    isTerminal: true,
  };
}

/**
 * Calculates current signing completion metrics across actionable recipients on the envelope.
 */
export function calculateEnvelopeProgress(envelope: SigningEnvelope): EnvelopeProgressResult {
  const actionableRecipients = envelope.recipients.filter((r) => r.role !== 'viewer');
  const totalCount = actionableRecipients.length;

  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percentage: 100 };
  }

  const completedCount = actionableRecipients.filter((r) => r.status === 'signed').length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return {
    completedCount,
    totalCount,
    percentage,
  };
}

/**
 * Returns all recipients currently authorized to review or sign based on routing order and status.
 */
export function getCurrentActiveRecipients(envelope: SigningEnvelope): EnvelopeRecipient[] {
  return envelope.recipients.filter((recipient) => {
    const check = canRecipientAct(envelope, recipient.id);
    return check.allowed;
  });
}

/**
 * Returns recipients waiting for subsequent routing cohorts.
 */
export function getNextRecipientsInLine(envelope: SigningEnvelope): EnvelopeRecipient[] {
  return envelope.recipients.filter(
    (recipient) =>
      recipient.routingOrder > envelope.currentRoutingOrder &&
      recipient.status !== 'signed' &&
      recipient.status !== 'declined'
  );
}
