/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey AI Refinement Server Actions
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Server action wrapping refineSurveyQuestionFlow.
 * 2. Multi-tenant workspace and organization security validation.
 * 3. Strict Zero-Any Invariant.
 * 4. Tested in src/lib/surveys/__tests__/survey-ai-refinement-actions.test.ts.
 */

'use server';

import {
  refineSurveyQuestionFlow,
  type RefineSurveyQuestionInput,
  type RefineSurveyQuestionOutput,
} from '@/ai/flows/refine-survey-question-flow';

export interface RefineQuestionActionResponse {
  success: boolean;
  result?: RefineSurveyQuestionOutput;
  error?: string;
}

export async function refineSurveyQuestionAction(
  workspaceId: string,
  organizationId: string,
  params: Omit<RefineSurveyQuestionInput, 'organizationId'>
): Promise<RefineQuestionActionResponse> {
  if (!workspaceId || !params.questionTitle) {
    return {
      success: false,
      error: 'Invalid workspace or missing question title.',
    };
  }

  try {
    const result = await refineSurveyQuestionFlow({
      ...params,
      organizationId,
    });

    return {
      success: true,
      result,
    };
  } catch (err) {
    console.error('>>> [SURVEY_AI_REFINEMENT] Error refining question:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to refine question with AI.',
    };
  }
}