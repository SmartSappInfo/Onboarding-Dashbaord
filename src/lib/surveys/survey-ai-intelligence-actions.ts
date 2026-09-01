'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — AI Intelligence Server Actions
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Authorization Scoping:
 *    - Validates survey workspace ownership on every action.
 * 2. Caching Subcollection:
 *    - Synthesized thematic insights and anomaly audits are cached in `surveys/{surveyId}/ai_insights/latest`
 *      to conserve AI token consumption and provide instant UI renders.
 * 3. In-Place Blueprint Optimization:
 *    - `applySurveyAiOptimizationAction` safely updates specific question prompts/options while preserving logic conditions.
 * 4. Strict Zero-Any Invariant.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import { auditSurveyQualityFlow } from '@/ai/flows/survey-ai-reviewer-flow';
import { generateSurveySentimentThemesFlow } from '@/ai/flows/survey-sentiment-theme-flow';
import { detectSurveyAnomaliesFlow } from '@/ai/flows/survey-anomaly-detection-flow';
import { querySurveyDataFlow } from '@/ai/flows/query-survey-data-flow';
import {
  type SurveyQualityAuditOutput,
  type SurveySentimentThemeOutput,
  type SurveyAnomalyDetectionOutput,
  type SurveyResearchAssistantOutput,
} from '@/ai/schemas/survey-intelligence-schemas';
import { computeResponseQualityMetrics, getResponseAnswer } from './survey-analytics-engine';

function isAuthorizedForWorkspace(survey: Survey, workspaceId: string): boolean {
  if (survey.workspaceIds && survey.workspaceIds.length > 0) {
    return survey.workspaceIds.includes(workspaceId);
  }
  const legacyWsId = (survey as unknown as { workspaceId?: string }).workspaceId;
  if (legacyWsId) {
    return legacyWsId === workspaceId;
  }
  return true;
}

/**
 * Performs pre-launch AI audit of survey structure and psychometric quality.
 */
export async function auditSurveyQualityAction(
  surveyId: string,
  workspaceId: string,
  options?: {
    provider?: string;
    modelId?: string;
    draftElements?: Record<string, unknown>[];
    draftTitle?: string;
    draftDescription?: string;
  }
): Promise<{ success: boolean; data?: SurveyQualityAuditOutput; error?: string }> {
  try {
    if (!surveyId || !workspaceId) {
      return { success: false, error: 'Missing required surveyId or workspaceId' };
    }

    let surveyTitle = options?.draftTitle || 'Survey';
    let surveyDescription = options?.draftDescription || '';
    let elements = options?.draftElements;

    if (surveyId !== 'new-survey') {
      const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
      if (surveyDoc.exists) {
        const survey = surveyDoc.data() as Survey;
        if (!isAuthorizedForWorkspace(survey, workspaceId)) {
          return { success: false, error: 'Unauthorized: Survey does not belong to this workspace' };
        }
        if (!elements) {
          elements = (survey.elements || []) as unknown as Record<string, unknown>[];
        }
        if (!options?.draftTitle) {
          surveyTitle = survey.title;
        }
        if (!options?.draftDescription) {
          surveyDescription = survey.description || '';
        }
      } else if (!elements) {
        return { success: false, error: 'Survey not found' };
      }
    }

    if (!elements || elements.length === 0) {
      return { success: false, error: 'No survey questions or blocks found to audit' };
    }

    const auditResult = await auditSurveyQualityFlow({
      surveyTitle,
      surveyDescription,
      elements,
      organizationId: workspaceId,
      provider: options?.provider || 'anthropic',
      modelId: options?.modelId,
    });

    return { success: true, data: auditResult };
  } catch (error: unknown) {
    console.error('Failed to audit survey quality:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Survey quality audit failed',
    };
  }
}

/**
 * Generates sentiment distribution, thematic clusters, and anomaly alerts.
 */
export async function generateSurveyThematicInsightsAction(
  surveyId: string,
  workspaceId: string,
  options?: { provider?: string; modelId?: string }
): Promise<{
  success: boolean;
  sentimentThemes?: SurveySentimentThemeOutput;
  anomalies?: SurveyAnomalyDetectionOutput;
  error?: string;
}> {
  try {
    if (!surveyId || !workspaceId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
      return { success: false, error: 'Survey not found' };
    }

    const survey = surveyDoc.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey does not belong to this workspace' };
    }

    const responsesSnap = await adminDb.collection('surveys').doc(surveyId).collection('responses')
      .orderBy('submittedAt', 'desc')
      .limit(200)
      .get();

    const responses = responsesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SurveyResponse[];

    // Extract text responses
    const textQuestions = (survey.elements || []).filter(
      (e): e is SurveyQuestion => 'type' in e && (e.type === 'text' || e.type === 'textarea')
    );

    const extractedTextAnswers: {
      responseId: string;
      questionId: string;
      questionTitle: string;
      textAnswer: string;
      submittedAt?: string;
      channel?: string;
      score?: number;
    }[] = [];

    responses.forEach((res) => {
      textQuestions.forEach((q) => {
        const val = getResponseAnswer(res, q.id);
        if (typeof val === 'string' && val.trim().length > 3) {
          extractedTextAnswers.push({
            responseId: res.id,
            questionId: q.id,
            questionTitle: q.title || q.id,
            textAnswer: val.trim(),
            submittedAt: res.submittedAt,
            channel: res.channel,
            score: res.score,
          });
        }
      });
    });

    const elements = (survey.elements || []) as unknown as Record<string, unknown>[];

    // 1. Run Thematic & Sentiment Flow
    let sentimentThemes: SurveySentimentThemeOutput | undefined;
    if (extractedTextAnswers.length > 0) {
      sentimentThemes = await generateSurveySentimentThemesFlow({
        surveyTitle: survey.title,
        elements,
        textResponses: extractedTextAnswers,
        organizationId: workspaceId,
        provider: options?.provider || 'anthropic',
        modelId: options?.modelId,
      });
    }

    // 2. Run Anomaly Detection Flow
    const qualityMetrics = computeResponseQualityMetrics(responses);
    const anomalies = await detectSurveyAnomaliesFlow({
      surveyTitle: survey.title,
      elements,
      metricsOverview: qualityMetrics as unknown as Record<string, unknown>,
      responsesSample: responses.slice(0, 30) as unknown as Record<string, unknown>[],
      organizationId: workspaceId,
      provider: options?.provider || 'anthropic',
      modelId: options?.modelId,
    });

    // Cache insights to Firestore
    const insightsDocRef = adminDb.collection('surveys').doc(surveyId).collection('ai_insights').doc('latest');
    await insightsDocRef.set({
      updatedAt: new Date().toISOString(),
      sentimentThemes: sentimentThemes || null,
      anomalies,
      analyzedResponsesCount: responses.length,
      analyzedTextCount: extractedTextAnswers.length,
    });

    return {
      success: true,
      sentimentThemes,
      anomalies,
    };
  } catch (error: unknown) {
    console.error('Failed to generate thematic insights:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Thematic synthesis failed',
    };
  }
}

/**
 * Answers natural language research inquiries over survey responses with evidence citations.
 */
export async function querySurveyResearchAssistantAction(
  surveyId: string,
  workspaceId: string,
  userQuery: string,
  options?: { provider?: string; modelId?: string }
): Promise<{ success: boolean; data?: SurveyResearchAssistantOutput; error?: string }> {
  try {
    if (!surveyId || !workspaceId || !userQuery) {
      return { success: false, error: 'Missing required parameters' };
    }

    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
      return { success: false, error: 'Survey not found' };
    }

    const survey = surveyDoc.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey does not belong to this workspace' };
    }

    const responsesSnap = await adminDb.collection('surveys').doc(surveyId).collection('responses')
      .orderBy('submittedAt', 'desc')
      .limit(150)
      .get();

    const responses = responsesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const result = await querySurveyDataFlow({
      surveyTitle: survey.title,
      elementsJson: JSON.stringify(survey.elements, null, 2),
      responsesJson: JSON.stringify(responses, null, 2),
      userQuery,
      organizationId: workspaceId,
      provider: options?.provider || 'anthropic',
      modelId: options?.modelId,
    });

    // Save summary query history in summaries subcollection
    await adminDb.collection('surveys').doc(surveyId).collection('summaries').add({
      summary: result.answerHtml,
      prompt: userQuery,
      confidenceScore: result.confidenceScore,
      keyMetrics: result.keyMetrics,
      evidenceCitations: result.evidenceCitations,
      suggestedFollowUpQuestions: result.suggestedFollowUpQuestions,
      createdAt: new Date().toISOString(),
      provider: options?.provider || 'anthropic',
      modelId: options?.modelId || 'claude-3-5-sonnet',
    });

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Failed to query survey research assistant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Research query failed',
    };
  }
}

/**
 * Applies an AI-recommended question optimization directly into the survey blueprint.
 */
export async function applySurveyAiOptimizationAction(
  surveyId: string,
  workspaceId: string,
  questionId: string,
  improvedTitle: string,
  improvedDescription?: string,
  improvedOptions?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!surveyId || !workspaceId || !questionId || !improvedTitle) {
      return { success: false, error: 'Missing required parameters' };
    }

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveyDoc = await surveyRef.get();
    if (!surveyDoc.exists) {
      return { success: false, error: 'Survey not found' };
    }

    const survey = surveyDoc.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey does not belong to this workspace' };
    }

    const elements = [...(survey.elements || [])];
    const targetIdx = elements.findIndex((e) => e.id === questionId);
    if (targetIdx === -1) {
      return { success: false, error: 'Target question not found in survey elements' };
    }

    const targetEl = elements[targetIdx] as SurveyQuestion;
    const updatedEl: SurveyQuestion = {
      ...targetEl,
      title: improvedTitle,
    };

    if (improvedDescription !== undefined) {
      updatedEl.description = improvedDescription;
    }

    if (improvedOptions && Array.isArray(improvedOptions) && improvedOptions.length > 0) {
      updatedEl.options = improvedOptions;
    }

    elements[targetIdx] = updatedEl;

    await surveyRef.update({
      elements,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to apply AI survey optimization:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update question blueprint',
    };
  }
}
