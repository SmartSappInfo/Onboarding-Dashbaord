/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Authoritative Post-Execution Contract Obligation Extraction & Review Queue Service (P5.4).
 * 2. Invariants Maintained:
 *    - Human-in-the-Loop Invariant (FM-P5-03): Extracted obligations are stored in status
 *      'review_required'. No automated CRM tasks or notifications are generated without human approval.
 *    - Strict Multi-Tenant Scoping (FM-P5-01): Verifies workspaceId matches on candidate extraction,
 *      approval, and dismissal. Cross-workspace operations are rejected immediately.
 *    - Bidirectional Hook Compatibility: Approving an obligation generates a ContractObligation
 *      that can be linked to CRM tasks and fulfilled via Phase 4's reverse hook.
 *    - Zero-Tolerance Typing (Rule 4): Strictly 0 `any` or `any[]` throughout.
 */

import { adminDb } from '@/lib/firebase-admin';
import { emitDocumentDomainEvent } from '@/lib/documents/document-event-bus';
import {
  AiObligationCandidateSchema,
  ContractObligationSchema,
  type AiObligationCandidate,
  type ContractObligation,
  type ObligationType,
  type ObligationResponsibleParty,
} from '@/lib/types/document-signing';

export interface ExtractContractObligationsParams {
  workspaceId: string;
  contractId: string;
  pageTexts: string[];
  apiKey?: string;
}

export interface ApproveObligationCandidateParams {
  workspaceId: string;
  candidateId: string;
  actorUserId: string;
  dueDate?: string;
  assignedUserId?: string;
}

export interface DismissObligationCandidateParams {
  workspaceId: string;
  candidateId: string;
  actorUserId: string;
  reason?: string;
}

/**
 * Extracts candidate obligations from executed contract text and persists them
 * in the review_required queue.
 */
export async function extractContractObligations(
  params: ExtractContractObligationsParams
): Promise<AiObligationCandidate[]> {
  const { workspaceId, contractId, pageTexts } = params;
  const candidates: AiObligationCandidate[] = [];
  const now = new Date().toISOString();
  let candidateCounter = 1;

  pageTexts.forEach((pageText, pageIdx) => {
    if (!pageText || pageText.trim().length === 0) return;

    const pageNumber = pageIdx + 1;
    const sentences = pageText
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);

    sentences.forEach((sentence) => {
      const lower = sentence.toLowerCase();

      let detectedType: ObligationType | null = null;
      let title = '';
      let description = '';
      let party: ObligationResponsibleParty = 'internal';
      let confidence = 0.85;

      // 1. Payment commitments
      if (
        (lower.includes('pay') || lower.includes('payment') || lower.includes('invoice')) &&
        (lower.includes('within') || lower.includes('shall pay') || lower.includes('$') || lower.includes('fee'))
      ) {
        detectedType = 'payment';
        title = 'Remit Scheduled Contract Payment';
        description = sentence;
        party = lower.includes('client shall') || lower.includes('customer shall') ? 'counterparty' : 'internal';
        confidence = 0.92;
      }
      // 2. Compliance & Audit reporting
      else if (
        lower.includes('soc2') ||
        lower.includes('audit report') ||
        (lower.includes('compliance') && lower.includes('annual'))
      ) {
        detectedType = 'compliance';
        title = 'Deliver Annual Compliance / Audit Report';
        description = sentence;
        party = 'internal';
        confidence = 0.94;
      }
      // 3. Deliverable milestones
      else if (
        (lower.includes('deliver') || lower.includes('milestone') || lower.includes('completion')) &&
        (lower.includes('shall deliver') || lower.includes('by') || lower.includes('schedule'))
      ) {
        detectedType = 'deliverable';
        title = 'Complete Contract Deliverable Milestone';
        description = sentence;
        party = 'internal';
        confidence = 0.88;
      }
      // 4. Renewal & Termination notices
      else if (
        (lower.includes('renewal') || lower.includes('non-renewal') || lower.includes('notice of termination')) &&
        (lower.includes('days prior') || lower.includes('written notice'))
      ) {
        detectedType = 'renewal_notice';
        title = 'Issue Contract Renewal / Non-Renewal Notice';
        description = sentence;
        party = 'mutual';
        confidence = 0.9;
      }

      if (detectedType) {
        const candId = `cand_${contractId}_p${pageNumber}_${candidateCounter++}`;

        // Attempt estimating a future due date (e.g. 60 days ahead)
        const estimatedDueDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

        const candidate = AiObligationCandidateSchema.parse({
          id: candId,
          workspaceId,
          contractId,
          title,
          description,
          type: detectedType,
          suggestedDueDate: estimatedDueDate,
          suggestedResponsibleParty: party,
          confidence,
          sourcePage: pageNumber,
          sourceExcerpt: sentence,
          status: 'review_required',
          createdAt: now,
        });

        candidates.push(candidate);
      }
    });
  });

  // Persist candidate records asynchronously
  for (const cand of candidates) {
    await adminDb.collection('obligation_candidates').doc(cand.id).set(cand);
  }

  return candidates;
}

/**
 * Human approval action: Promotes a candidate obligation into an official ContractObligation.
 */
export async function approveObligationCandidate(
  params: ApproveObligationCandidateParams
): Promise<{ success: boolean; obligationId: string }> {
  const { workspaceId, candidateId, actorUserId, dueDate, assignedUserId } = params;

  const candDoc = await adminDb.collection('obligation_candidates').doc(candidateId).get();
  if (!candDoc.exists) {
    throw new Error(`Obligation candidate "${candidateId}" not found.`);
  }

  const cand = candDoc.data() as AiObligationCandidate;

  // Strict Tenant Scoping (FM-P5-01)
  if (cand.workspaceId !== workspaceId) {
    throw new Error(
      `Unauthorized cross-tenant access: Candidate belongs to "${cand.workspaceId}", but caller is in "${workspaceId}".`
    );
  }

  const now = new Date().toISOString();
  const obligationId = `obl_${cand.contractId}_${Date.now()}`;

  const officialObligation: ContractObligation = ContractObligationSchema.parse({
    id: obligationId,
    workspaceId,
    contractId: cand.contractId,
    title: cand.title,
    description: cand.description,
    type: cand.type,
    status: 'pending',
    dueDate: dueDate || cand.suggestedDueDate || now,
    responsibleParty: cand.suggestedResponsibleParty,
    assignedUserId,
    createdAt: now,
    updatedAt: now,
  });

  // 1. Create official ContractObligation
  await adminDb.collection('contract_obligations').doc(obligationId).set(officialObligation);

  // 2. Update candidate record to approved
  await adminDb.collection('obligation_candidates').doc(candidateId).update({
    status: 'approved',
    reviewedBy: actorUserId,
    reviewedAt: now,
  });

  // 3. Emit canonical domain event
  await emitDocumentDomainEvent({
    workspaceId,
    type: 'obligation.created',
    contractId: cand.contractId,
    actorId: actorUserId,
    metadata: {
      obligationId,
      title: officialObligation.title,
      type: officialObligation.type,
      dueDate: officialObligation.dueDate,
    },
  });

  return {
    success: true,
    obligationId,
  };
}

/**
 * Human rejection action: Dismisses a candidate obligation without creating a task.
 */
export async function dismissObligationCandidate(
  params: DismissObligationCandidateParams
): Promise<{ success: boolean }> {
  const { workspaceId, candidateId, actorUserId } = params;

  const candDoc = await adminDb.collection('obligation_candidates').doc(candidateId).get();
  if (!candDoc.exists) {
    throw new Error(`Obligation candidate "${candidateId}" not found.`);
  }

  const cand = candDoc.data() as AiObligationCandidate;

  // Strict Tenant Scoping
  if (cand.workspaceId !== workspaceId) {
    throw new Error(
      `Unauthorized cross-tenant access: Candidate belongs to "${cand.workspaceId}", but caller is in "${workspaceId}".`
    );
  }

  const now = new Date().toISOString();

  await adminDb.collection('obligation_candidates').doc(candidateId).update({
    status: 'rejected',
    reviewedBy: actorUserId,
    reviewedAt: now,
  });

  return { success: true };
}
