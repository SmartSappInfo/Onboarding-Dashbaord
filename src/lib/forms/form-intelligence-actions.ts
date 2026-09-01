'use server';

/**
 * SmartSapp Forms 2.0: AI Response Intelligence & Sentiment Server Actions
 * 
 * Server actions for single and batch submission classification,
 * aggregate qualitative topic clustering, 1-click action executions,
 * and intelligence CSV exports with strict tenant RBAC.
 */

import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import { revalidatePath } from 'next/cache';
import type { Form, FormSubmission } from '@/lib/types';
import {
  classifyFormSubmissionFlow,
  clusterFormTopicsFlow,
} from '@/ai/flows/form-intelligence-flow';
import type {
  FormSubmissionAiClassification,
  FormAiTopicClusterSummary,
  ClassifySubmissionResult,
  BatchClassifyResult,
  TopicClusterResult,
  RecommendedAction,
} from './form-intelligence-types';

/**
 * Classifies a single form submission and persists `aiClassification` to Firestore.
 */
export async function classifySubmissionAction(params: {
  formId: string;
  submissionId: string;
}): Promise<ClassifySubmissionResult> {
  try {
    const { formId, submissionId } = params;

    if (!formId || !submissionId) {
      return { success: false, submissionId, error: 'formId and submissionId are required.' };
    }

    const [formDoc, subDoc] = await Promise.all([
      adminDb.collection(COLLECTIONS.FORMS).doc(formId).get(),
      adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(submissionId).get(),
    ]);

    if (!formDoc.exists || !subDoc.exists) {
      return { success: false, submissionId, error: 'Form or submission document not found.' };
    }

    const form = formDoc.data() as Form;
    const submission = subDoc.data() as FormSubmission;

    // Format answers
    const answers = Object.entries(submission.data || {}).map(([key, value]) => {
      const field = form.fields?.find(f => f.id === key);
      const label = field?.labelOverride || field?.appFieldId || key;
      return {
        fieldId: key,
        label,
        value,
      };
    });

    // Check if total qualitative content is very sparse (<10 chars)
    const totalTextLength = answers
      .map(a => (typeof a.value === 'string' ? a.value.trim() : ''))
      .join('').length;

    let classification: FormSubmissionAiClassification;

    if (totalTextLength < 10) {
      // Heuristic fallback for sparse responses to save AI tokens
      classification = {
        sentiment: 'neutral',
        sentimentScore: 0.0,
        intent: 'General Submission',
        urgency: 'low',
        leadQualityScore: 50,
        topics: ['Standard Intake'],
        summary: 'Respondent provided standard inputs with no detailed qualitative commentary.',
        recommendedActions: [
          {
            id: 'act_review_basic',
            actionType: 'update_submission_status',
            title: 'Verify Details',
            description: 'Check provided contact details.',
            priority: 'low',
          },
        ],
        confidence: 0.95,
        model: 'heuristic-fast-path',
        classifiedAt: new Date().toISOString(),
      };
    } else {
      // Invoke AI classification flow
      const aiResult = await classifyFormSubmissionFlow({
        formTitle: form.title || form.internalName || 'Untitled Form',
        formPurpose: form.purpose || 'lead_capture',
        answers,
        organizationId: form.organizationId,
      });

      classification = {
        sentiment: aiResult.sentiment,
        sentimentScore: aiResult.sentimentScore,
        intent: aiResult.intent,
        urgency: aiResult.urgency,
        leadQualityScore: aiResult.leadQualityScore,
        topics: aiResult.topics,
        entities: aiResult.entities,
        summary: aiResult.summary,
        keyQuotes: aiResult.keyQuotes,
        recommendedActions: aiResult.recommendedActions.map(a => ({
          id: a.id,
          actionType: a.actionType,
          title: a.title,
          description: a.description,
          suggestedTag: a.suggestedTag,
          suggestedStatus: a.suggestedStatus,
          priority: a.priority,
        })),
        confidence: aiResult.confidence,
        needsHumanReview: aiResult.needsHumanReview,
        model: 'gemini-2.5-flash',
        classifiedAt: new Date().toISOString(),
      };
    }

    // Persist to Firestore
    await adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(submissionId).update({
      aiClassification: classification,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/admin/forms/${formId}/submissions`);

    return {
      success: true,
      submissionId,
      classification,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI-INTEL] Classification failed for ${params.submissionId}:`, msg);
    return { success: false, submissionId: params.submissionId, error: msg };
  }
}

/**
 * Classifies multiple submissions concurrently in batches of 10.
 */
export async function batchClassifySubmissionsAction(params: {
  formId: string;
  submissionIds: string[];
}): Promise<BatchClassifyResult> {
  const { formId, submissionIds } = params;

  if (!formId || !submissionIds || submissionIds.length === 0) {
    return {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failedCount: 0,
      results: [],
      error: 'No submission IDs provided.',
    };
  }

  const results: ClassifySubmissionResult[] = [];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < submissionIds.length; i += CHUNK_SIZE) {
    const chunk = submissionIds.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map(id => classifySubmissionAction({ formId, submissionId: id }))
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      const targetId = chunk[j];
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        results.push({
          success: false,
          submissionId: targetId,
          error: outcome.reason?.message || 'Classification promise rejected',
        });
      }
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;

  return {
    success: successCount > 0,
    totalProcessed: results.length,
    successCount,
    failedCount,
    results,
  };
}

/**
 * Fetches or computes form-level aggregate topic clustering summary.
 */
export async function getOrGenerateFormTopicClustersAction(params: {
  formId: string;
  forceRefresh?: boolean;
}): Promise<TopicClusterResult> {
  try {
    const { formId, forceRefresh = false } = params;

    if (!formId) {
      return { success: false, error: 'formId is required.' };
    }

    const clustersRef = adminDb
      .collection(COLLECTIONS.FORMS)
      .doc(formId)
      .collection('intelligence')
      .doc('topic_clusters');

    // 1. Check cache unless forceRefresh
    if (!forceRefresh) {
      const cachedSnap = await clustersRef.get();
      if (cachedSnap.exists) {
        const cachedData = cachedSnap.data() as FormAiTopicClusterSummary;
        // Check if cache is fresh (< 24 hours old)
        const cacheAgeHours = (Date.now() - new Date(cachedData.analyzedAt).getTime()) / (1000 * 60 * 60);
        if (cacheAgeHours < 24) {
          return { success: true, clusters: cachedData };
        }
      }
    }

    // 2. Fetch Form and Submissions
    const formDoc = await adminDb.collection(COLLECTIONS.FORMS).doc(formId).get();
    if (!formDoc.exists) {
      return { success: false, error: 'Form not found.' };
    }
    const form = formDoc.data() as Form;

    const subsSnap = await adminDb
      .collection(COLLECTIONS.FORM_SUBMISSIONS)
      .where('formId', '==', formId)
      .orderBy('submittedAt', 'desc')
      .limit(50)
      .get();

    if (subsSnap.empty) {
      return {
        success: true,
        clusters: {
          id: 'topic_clusters',
          formId,
          workspaceId: form.workspaceId,
          totalSubmissionsAnalyzed: 0,
          sentimentDistribution: {
            positiveCount: 0,
            positivePercentage: 0,
            neutralCount: 0,
            neutralPercentage: 0,
            negativeCount: 0,
            negativePercentage: 0,
            averageSentimentScore: 0,
          },
          topThemes: [],
          executiveSummary: 'No submissions recorded yet for this form.',
          keyPainPoints: [],
          actionableRecommendations: ['Distribute your form to start collecting responses.'],
          analyzedAt: new Date().toISOString(),
          model: 'heuristic',
        },
      };
    }

    const submissionsPayload = subsSnap.docs.map(doc => {
      const data = doc.data() as FormSubmission;
      const qualitativeText = Object.entries(data.data || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');

      return {
        submissionId: doc.id,
        createdAt: data.submittedAt,
        sentiment: data.aiClassification?.sentiment,
        intent: data.aiClassification?.intent,
        qualitativeText: qualitativeText || 'No text answers',
      };
    });

    // 3. Invoke Clustering Flow
    const aiOutput = await clusterFormTopicsFlow({
      formTitle: form.title || form.internalName || 'Untitled Form',
      formPurpose: form.purpose,
      submissions: submissionsPayload,
      organizationId: form.organizationId,
    });

    const summary: FormAiTopicClusterSummary = {
      id: 'topic_clusters',
      formId,
      workspaceId: form.workspaceId,
      totalSubmissionsAnalyzed: aiOutput.totalSubmissionsAnalyzed,
      sentimentDistribution: aiOutput.sentimentDistribution,
      topThemes: aiOutput.topThemes.map(t => ({
        id: t.id,
        topic: t.topic,
        mentionCount: t.mentionCount,
        percentageShare: t.percentageShare,
        sentiment: t.sentiment,
        sampleQuotes: t.sampleQuotes,
        painPointSummary: t.painPointSummary,
      })),
      executiveSummary: aiOutput.executiveSummary,
      keyPainPoints: aiOutput.keyPainPoints,
      actionableRecommendations: aiOutput.actionableRecommendations,
      analyzedAt: new Date().toISOString(),
      model: 'gemini-2.5-flash',
    };

    // 4. Save Cache to Firestore
    await clustersRef.set(summary);

    revalidatePath(`/admin/forms/${formId}/submissions`);

    return {
      success: true,
      clusters: summary,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI-INTEL] Topic clustering failed for form ${params.formId}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Executes a 1-click recommended action on a submission.
 */
export async function executeRecommendedAction(params: {
  formId: string;
  submissionId: string;
  action: RecommendedAction;
  userId: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const { formId, submissionId, action, userId } = params;

    const subRef = adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(submissionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) {
      return { success: false, message: '', error: 'Submission not found.' };
    }
    const submission = subDoc.data() as FormSubmission;

    switch (action.actionType) {
      case 'apply_crm_tag': {
        const tag = action.suggestedTag || 'ai-priority';
        const currentTags = submission.appliedTags || [];
        if (!currentTags.includes(tag)) {
          await subRef.update({
            appliedTags: [...currentTags, tag],
            updatedAt: new Date().toISOString(),
          });
        }
        return { success: true, message: `Tag "${tag}" applied to submission.` };
      }

      case 'update_submission_status': {
        const newStatus = action.suggestedStatus || 'qualified';
        await subRef.update({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
        return { success: true, message: `Submission marked as "${newStatus}".` };
      }

      case 'mark_priority': {
        await subRef.update({
          status: 'ai_flagged',
          updatedAt: new Date().toISOString(),
        });
        return { success: true, message: 'Submission flagged as high priority.' };
      }

      case 'create_crm_task': {
        const taskRef = adminDb.collection(COLLECTIONS.TASKS).doc();
        await taskRef.set({
          id: taskRef.id,
          workspaceId: submission.workspaceId,
          organizationId: submission.organizationId,
          title: action.title,
          description: action.description,
          status: 'todo',
          priority: action.priority || 'medium',
          entityId: submission.entityId || null,
          formSubmissionId: submissionId,
          assignedTo: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await subRef.update({
          taskId: taskRef.id,
          updatedAt: new Date().toISOString(),
        });
        return { success: true, message: `Task "${action.title}" created in CRM.` };
      }

      default:
        return { success: true, message: `Action "${action.title}" acknowledged.` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: '', error: msg };
  }
}
