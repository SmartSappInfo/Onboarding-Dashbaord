/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Domain Placement:
 *    Authoritative CRM Master-Record Synchronizer between CRM Deals and Document Envelopes/Contracts (P4.1 & P4.2).
 *    Guarantees bi-directional synchronization, contract status integrity, and zero data duplication.
 * 2. Invariants Enforced:
 *    - Tenant Scoping (Rule 5 & Rule 8, FM-P4-04): Strictly checks that deal and envelope belong to the same workspaceId.
 *    - Split-Brain Prevention (FM-P4-01): Keeps deal status ('won') and deal.contractStatus ('out_for_signature' | 'signed' | 'declined') aligned.
 *    - Currency & Cadence Normalization (FM-P4-08): Correctly computes MRR, ARR, and TCV from recurring vs one-off contract values.
 *    - Reverse Task Hook: Automatically fulfills post-execution contractual obligations when assignees resolve CRM tasks.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Deal } from '@/lib/types';
import { ContractObligationSchema, type SigningEnvelope, type ContractObligation } from '@/lib/types/document-signing';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';
import { emitDocumentDomainEvent } from '@/lib/documents/document-event-bus';

export interface SyncEnvelopeWithDealParams {
  workspaceId: string;
  dealId: string;
  envelopeId: string;
  contractId?: string;
  actorUserId?: string;
}

export interface HandleEnvelopeSignedParams {
  workspaceId: string;
  envelopeId: string;
  dealId?: string;
  contractId?: string;
  autoAdvanceStage?: boolean;
  contractValue?: {
    amount: number;
    currency?: string;
    cadence?: 'one_off' | 'monthly' | 'quarterly' | 'annually';
  };
  actorUserId?: string;
}

export interface HandleEnvelopeDeclinedParams {
  workspaceId: string;
  envelopeId: string;
  dealId?: string;
  reason?: string;
  actorUserId?: string;
}

export interface SyncTaskCompletionToObligationParams {
  workspaceId: string;
  taskId: string;
  contractId: string;
  obligationId: string;
  actorUserId?: string;
}

/**
 * Links a newly dispatched signing envelope to a CRM Deal and updates deal status to 'out_for_signature'.
 */
export async function syncEnvelopeWithDeal(
  params: SyncEnvelopeWithDealParams
): Promise<{ success: boolean; error?: string }> {
  const { workspaceId, dealId, envelopeId, contractId, actorUserId } = params;

  // 1. Verify Deal and Tenant Isolation (FM-P4-04)
  const dealRef = adminDb.collection('deals').doc(dealId);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    throw new Error(`Deal ${dealId} does not exist.`);
  }
  const dealData = dealSnap.data() as Deal;
  if (dealData.workspaceId !== workspaceId) {
    throw new Error(`Workspace mismatch: Deal ${dealId} belongs to a different workspace.`);
  }

  // 2. Verify Envelope and Tenant Isolation
  const envRef = adminDb.collection('signing_envelopes').doc(envelopeId);
  const envSnap = await envRef.get();
  if (envSnap.exists) {
    const envData = envSnap.data() as SigningEnvelope;
    if (envData.workspaceId !== workspaceId) {
      throw new Error(`Workspace mismatch: Envelope ${envelopeId} belongs to a different workspace.`);
    }
  }

  const now = new Date().toISOString();

  // 3. Update Deal
  const dealUpdates: Partial<Deal> = {
    contractId: contractId || dealData.contractId || null,
    contractStatus: 'out_for_signature',
    updatedAt: now,
  };
  await dealRef.update(dealUpdates);

  // 4. Update Envelope with deal reference
  if (envSnap.exists) {
    await envRef.update({
      dealId,
      contractId: contractId || (envSnap.data() as SigningEnvelope).contractId,
      updatedAt: now,
    });
  }

  // 5. Persist CrmDocumentLink
  const linkId = `link_${dealId}_${envelopeId}`;
  await adminDb.collection('crm_document_links').doc(linkId).set({
    id: linkId,
    workspaceId,
    dealId,
    envelopeId,
    contractId,
    relationshipType: 'primary',
    createdAt: now,
  });

  // 6. Emit Deal Domain Event
  emitDealDomainEvent('deal.contract.sent', {
    dealId,
    workspaceId,
    envelopeId,
    contractId,
    contractStatus: 'out_for_signature',
    actorUserId,
    occurredAt: now,
  });

  return { success: true };
}

/**
 * Handles contract execution / signing completion.
 * Updates deal contractStatus = 'signed', optionally advances deal status to 'won',
 * and computes MRR / ARR from contract cadence (FM-P4-01 & FM-P4-08).
 */
export async function handleEnvelopeSigned(
  params: HandleEnvelopeSignedParams
): Promise<{ success: boolean; dealUpdated: boolean }> {
  const {
    workspaceId,
    envelopeId,
    dealId: directDealId,
    contractId,
    autoAdvanceStage = true,
    contractValue,
    actorUserId,
  } = params;

  let dealId = directDealId;

  // Resolve dealId if not directly passed
  if (!dealId) {
    const snap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .where('envelopeId', '==', envelopeId)
      .limit(1)
      .get();
    if (!snap.empty) {
      dealId = snap.docs[0].id;
    }
  }

  if (!dealId) {
    return { success: true, dealUpdated: false };
  }

  const dealRef = adminDb.collection('deals').doc(dealId);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    return { success: true, dealUpdated: false };
  }

  const dealData = dealSnap.data() as Deal;
  if (dealData.workspaceId !== workspaceId) {
    throw new Error(`Workspace mismatch: Deal ${dealId} belongs to a different workspace.`);
  }

  const now = new Date().toISOString();
  const dealUpdates: Partial<Deal> = {
    contractStatus: 'signed',
    contractSignedAt: now,
    updatedAt: now,
  };

  if (autoAdvanceStage) {
    dealUpdates.status = 'won';
  }

  // Contract Valuation & Cadence normalization (FM-P4-08)
  if (contractValue) {
    const { amount, cadence = 'one_off' } = contractValue;
    if (cadence === 'monthly') {
      dealUpdates.mrr = amount;
      dealUpdates.arr = amount * 12;
      dealUpdates.value = amount * 12;
    } else if (cadence === 'annually') {
      dealUpdates.arr = amount;
      dealUpdates.value = amount;
    } else if (cadence === 'quarterly') {
      dealUpdates.arr = amount * 4;
      dealUpdates.value = amount * 4;
    } else {
      dealUpdates.value = amount;
      dealUpdates.oneTimeValue = amount;
    }
  }

  await dealRef.update(dealUpdates);

  // Emit Deal domain events
  emitDealDomainEvent('deal.contract.signed', {
    dealId,
    workspaceId,
    envelopeId,
    contractId,
    contractStatus: 'signed',
    actorUserId,
    occurredAt: now,
    value: dealUpdates.value,
    mrr: dealUpdates.mrr,
    arr: dealUpdates.arr,
  });

  if (dealUpdates.status === 'won') {
    emitDealDomainEvent('deal.won', {
      dealId,
      workspaceId,
      actorUserId,
      occurredAt: now,
      value: dealUpdates.value,
      mrr: dealUpdates.mrr,
      arr: dealUpdates.arr,
    });
  }

  return { success: true, dealUpdated: true };
}

/**
 * Handles envelope decline. Updates deal contractStatus = 'declined' and emits deal.contract.declined.
 */
export async function handleEnvelopeDeclined(
  params: HandleEnvelopeDeclinedParams
): Promise<{ success: boolean; dealUpdated: boolean }> {
  const { workspaceId, envelopeId, dealId: directDealId, reason, actorUserId } = params;

  let dealId = directDealId;

  if (!dealId) {
    const snap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .where('envelopeId', '==', envelopeId)
      .limit(1)
      .get();
    if (!snap.empty) {
      dealId = snap.docs[0].id;
    }
  }

  if (!dealId) {
    return { success: true, dealUpdated: false };
  }

  const dealRef = adminDb.collection('deals').doc(dealId);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    return { success: true, dealUpdated: false };
  }

  const dealData = dealSnap.data() as Deal;
  if (dealData.workspaceId !== workspaceId) {
    throw new Error(`Workspace mismatch: Deal ${dealId} belongs to a different workspace.`);
  }

  const now = new Date().toISOString();
  await dealRef.update({
    contractStatus: 'declined',
    updatedAt: now,
  });

  emitDealDomainEvent('deal.contract.declined', {
    dealId,
    workspaceId,
    envelopeId,
    contractStatus: 'declined',
    actorUserId,
    occurredAt: now,
    metadata: { reason },
  });

  return { success: true, dealUpdated: true };
}

/**
 * Bi-directional reverse hook: marks contractual obligation fulfilled when CRM task completes.
 */
export async function syncTaskCompletionToObligation(
  params: SyncTaskCompletionToObligationParams
): Promise<{ success: boolean; obligationUpdated: boolean }> {
  const { workspaceId, taskId, contractId, obligationId, actorUserId } = params;

  const obRef = adminDb.collection('contract_obligations').doc(obligationId);
  const obSnap = await obRef.get();
  if (!obSnap.exists) {
    return { success: true, obligationUpdated: false };
  }

  const parsed = ContractObligationSchema.safeParse(obSnap.data());
  if (!parsed.success) {
    console.warn(`[CRM_SYNC] Obligation ${obligationId} has an unexpected shape; not fulfilling.`);
    return { success: true, obligationUpdated: false };
  }
  const obData: ContractObligation = parsed.data;
  if (obData.workspaceId !== workspaceId) {
    throw new Error(`Workspace mismatch: Obligation ${obligationId} belongs to a different workspace.`);
  }

  // SECURITY (PR-0 review, 2026-09-29): only the task the obligation itself created may fulfil it,
  // and only for its own contract. Without this binding, any user able to edit tasks could point a
  // task at any obligation id in the workspace and mark it fulfilled by completing the task.
  if (obData.contractId !== contractId || obData.linkedTaskId !== taskId) {
    console.warn(`[CRM_SYNC] Task ${taskId} is not the linked task of obligation ${obligationId}; not fulfilling.`);
    return { success: true, obligationUpdated: false };
  }

  // Idempotent: fulfilling an obligation completes its linked task, which fires this hook again.
  if (obData.status === 'fulfilled') {
    return { success: true, obligationUpdated: false };
  }

  const now = new Date().toISOString();
  await obRef.update({
    status: 'fulfilled',
    fulfilledAt: now,
    fulfilledBy: actorUserId || 'crm_task',
    updatedAt: now,
  });

  emitDocumentDomainEvent({
    workspaceId,
    type: 'obligation.fulfilled',
    contractId,
    actorId: actorUserId || 'crm_task',
    metadata: { taskId, obligationId },
    timestamp: now,
  });

  return { success: true, obligationUpdated: true };
}
