'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Server Actions for Contract AI Intelligence: Semantic Redline Comparison & Post-Execution Obligation Review (P5.2, P5.4).
 * 2. Invariants Maintained:
 *    - Strict Authentication & Tenant Authorization: Calls `requireWorkspace(workspaceId)`
 *      before any LLM synthesis or database retrieval.
 *    - Human-in-the-Loop Approval: Obligation candidates require explicit human approval
 *      before being converted into active workspace obligations.
 *    - Zero-Tolerance Typing (Rule 4): Strictly 0 `any` or `any[]` throughout.
 */

import { requireWorkspace } from '@/lib/auth/require-auth';
import { adminDb } from '@/lib/firebase-admin';
import {
  compareDocumentVersions,
} from '@/lib/documents/contract-semantic-diff-service';
import {
  approveObligationCandidate,
  dismissObligationCandidate,
  extractContractObligations,
} from '@/lib/documents/contract-obligation-extraction-service';
import {
  AiObligationCandidateSchema,
  type AiObligationCandidate,
  type ContractObligation,
  type SemanticClauseDiff,
} from '@/lib/types/document-signing';

export interface CompareContractVersionsActionResult {
  success: boolean;
  data?: SemanticClauseDiff;
  error?: string;
}

export interface GetObligationCandidatesActionResult {
  success: boolean;
  data?: AiObligationCandidate[];
  error?: string;
}

export interface ApproveObligationCandidateActionResult {
  success: boolean;
  obligation?: ContractObligation;
  error?: string;
}

export interface DismissObligationCandidateActionResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: Compares two versions of a contract and returns a semantic clause diff.
 */
export async function compareContractVersionsAction(params: {
  workspaceId: string;
  documentId: string;
  versionAId: string;
  versionBId: string;
  versionAText: string;
  versionBText: string;
}): Promise<CompareContractVersionsActionResult> {
  const { workspaceId, documentId, versionAId, versionBId, versionAText, versionBText } = params;

  try {
    await requireWorkspace(workspaceId);

    const diff = await compareDocumentVersions({
      workspaceId,
      documentId,
      versionAId,
      versionBId,
      versionAText,
      versionBText,
    });

    return {
      success: true,
      data: diff,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compare contract versions.',
    };
  }
}

/**
 * Server Action: Retrieves pending obligation candidates for a contract.
 */
export async function getContractObligationCandidatesAction(params: {
  workspaceId: string;
  contractId: string;
}): Promise<GetObligationCandidatesActionResult> {
  const { workspaceId, contractId } = params;

  try {
    await requireWorkspace(workspaceId);

    const snapshot = await adminDb
      .collection('contract_obligation_candidates')
      .where('workspaceId', '==', workspaceId)
      .where('contractId', '==', contractId)
      .where('status', '==', 'review_required')
      .get();

    const candidates: AiObligationCandidate[] = [];
    snapshot.forEach((docSnap) => {
      const parsed = AiObligationCandidateSchema.safeParse(docSnap.data());
      if (parsed.success) {
        candidates.push(parsed.data);
      }
    });

    return {
      success: true,
      data: candidates,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve obligation candidates.',
    };
  }
}

/**
 * Server Action: Extracts candidate obligations from contract text and saves them to the review queue.
 */
export async function extractContractObligationsAction(params: {
  workspaceId: string;
  contractId: string;
  pageTexts: string[];
}): Promise<GetObligationCandidatesActionResult> {
  const { workspaceId, contractId, pageTexts } = params;

  try {
    await requireWorkspace(workspaceId);

    const candidates = await extractContractObligations({
      workspaceId,
      contractId,
      pageTexts,
    });

    return {
      success: true,
      data: candidates,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to extract contract obligations.',
    };
  }
}

/**
 * Server Action: Approves an obligation candidate and converts it to a formal ContractObligation.
 */
export async function approveContractObligationCandidateAction(params: {
  workspaceId: string;
  candidateId: string;
  dueDate?: string;
  assignedUserId?: string;
}): Promise<ApproveObligationCandidateActionResult> {
  const { workspaceId, candidateId, dueDate, assignedUserId } = params;

  try {
    const auth = await requireWorkspace(workspaceId);

    const result = await approveObligationCandidate({
      workspaceId,
      candidateId,
      actorUserId: auth.uid,
      dueDate,
      assignedUserId,
    });

    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to approve obligation candidate.',
    };
  }
}

/**
 * Server Action: Dismisses an obligation candidate as not applicable or false positive.
 */
export async function dismissContractObligationCandidateAction(params: {
  workspaceId: string;
  candidateId: string;
  reason?: string;
}): Promise<DismissObligationCandidateActionResult> {
  const { workspaceId, candidateId, reason } = params;

  try {
    const auth = await requireWorkspace(workspaceId);

    const result = await dismissObligationCandidate({
      workspaceId,
      candidateId,
      actorUserId: auth.uid,
      reason,
    });

    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to dismiss obligation candidate.',
    };
  }
}
