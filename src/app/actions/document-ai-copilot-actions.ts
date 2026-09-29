'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Server Actions for Document AI Copilot: Grounded Q&A and Executive Summary generation (P5.3).
 * 2. Invariants Maintained:
 *    - Strict Authentication & Tenant Authorization: Calls `requireWorkspace(workspaceId)`
 *      before any LLM synthesis or database retrieval.
 *    - Rate Limit Circuit Breaker: Verifies quota via `checkAiQuotaAndCircuitBreaker`
 *      before external LLM dispatch.
 *    - Zero-Tolerance Typing (Rule 4): Strictly 0 `any` or `any[]` throughout.
 */

import { requireWorkspace } from '@/lib/auth/require-auth';
import {
  askDocumentQuestion,
  generateDocumentExecutiveSummary,
  type ExecutiveSummaryResult,
} from '@/lib/documents/document-ai-copilot-service';
import {
  checkAiQuotaAndCircuitBreaker,
  recordAiFailure,
  recordAiSuccess,
} from '@/lib/documents/document-ai-governance-service';
import type { AiDocumentQaResponse } from '@/lib/types/document-signing';

export interface AskDocumentQuestionActionResult {
  success: boolean;
  data?: AiDocumentQaResponse;
  error?: string;
  circuitBreakerTripped?: boolean;
}

export interface GetDocumentExecutiveSummaryActionResult {
  success: boolean;
  data?: ExecutiveSummaryResult;
  error?: string;
}

/**
 * Server Action: Answers a natural language question grounded in the document text.
 */
export async function askDocumentQuestionAction(params: {
  workspaceId: string;
  documentId: string;
  documentVersionId?: string;
  question: string;
  pageTexts?: string[];
}): Promise<AskDocumentQuestionActionResult> {
  const { workspaceId, documentId, documentVersionId, question, pageTexts } = params;

  try {
    // 1. Authenticate & Verify Tenant Authorization
    await requireWorkspace(workspaceId);

    // 2. Check Circuit Breaker (FM-P5-06)
    const quota = checkAiQuotaAndCircuitBreaker(workspaceId);
    if (!quota.canProceed) {
      // Degraded fallback
      const fallbackResponse = await askDocumentQuestion({
        workspaceId,
        documentId,
        documentVersionId,
        question,
        pageTexts,
        apiKey: '', // Force deterministic extractive fallback
      });

      return {
        success: true,
        data: fallbackResponse,
        circuitBreakerTripped: true,
      };
    }

    // 3. Execute Grounded Copilot Q&A
    const response = await askDocumentQuestion({
      workspaceId,
      documentId,
      documentVersionId,
      question,
      pageTexts,
    });

    recordAiSuccess(workspaceId);

    return {
      success: true,
      data: response,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to answer question.';
    recordAiFailure(workspaceId, errorMsg);

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action: Generates a structured executive summary for an agreement.
 */
export async function getDocumentExecutiveSummaryAction(params: {
  workspaceId: string;
  documentId: string;
  documentVersionId?: string;
  title: string;
  pageTexts: string[];
}): Promise<GetDocumentExecutiveSummaryActionResult> {
  const { workspaceId, documentId, documentVersionId, title, pageTexts } = params;

  try {
    await requireWorkspace(workspaceId);

    const summary = await generateDocumentExecutiveSummary({
      workspaceId,
      documentId,
      documentVersionId,
      title,
      pageTexts,
    });

    return {
      success: true,
      data: summary,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate executive summary.',
    };
  }
}
