'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 6: Inbound CRM Triggers & Direct CRM Dispatch Engine
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Symmetrical Two-Way Integration (CRM -> Survey & Survey -> CRM).
 * 2. Cryptographic Recipient Tracking: Encrypts contact and entity IDs into standard 'ref' tokens.
 * 3. Single Source of Truth: Routes dynamic variable replacement through FieldsVariablesService.
 * 4. Multi-Tenant Scoping & Strict Zero-Any.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Survey, SurveyResponse } from '@/lib/types';
import { isAuthorizedForWorkspace } from './survey-hydration-adapter';
import { encryptToken } from '@/lib/crypto';
import { sendMessage } from '@/lib/messaging-engine';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import { logActivity } from '@/lib/activity-logger';

export interface ActiveSurveyOption {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  scoringEnabled?: boolean;
  maxScore?: number;
}

export interface EntitySurveyHistoryItem {
  id: string;
  surveyId: string;
  surveyTitle: string;
  submittedAt: string;
  score?: number;
  maxScore?: number;
  percentage?: number;
  outcome?: string;
  sentiment?: string;
  sentimentScore?: number;
  channel?: string;
  respondentName?: string;
  respondentEmail?: string;
  respondentPhone?: string;
  answers: Array<{ questionId: string; questionTitle?: string; value: string | string[] | number | boolean }>;
}

export interface EntitySurveyHistorySummary {
  responses: EntitySurveyHistoryItem[];
  totalCount: number;
  averageScore: number;
  latestSentiment?: string;
  latestSubmittedAt?: string;
}

export interface SendSurveyToContactParams {
  surveyId: string;
  workspaceId: string;
  organizationId?: string;
  entityId: string;
  entityName?: string;
  contactId?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: 'email' | 'sms' | 'whatsapp';
  customNote?: string;
  senderProfileId?: string;
}

/**
 * Fetches all published surveys available for direct CRM dispatch in the active workspace.
 */
export async function getWorkspaceActiveSurveysAction(
  workspaceId: string
): Promise<{ success: boolean; surveys: ActiveSurveyOption[]; error?: string }> {
  try {
    if (!workspaceId) return { success: false, surveys: [], error: 'Missing workspaceId' };

    const snapshot = await adminDb
      .collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    const surveys: ActiveSurveyOption[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Survey;
      if (data.status === 'published' || !data.status) {
        surveys.push({
          id: docSnap.id,
          title: data.title || 'Untitled Survey',
          slug: data.slug || docSnap.id,
          description: data.description,
          category: data.category,
          scoringEnabled: data.scoringEnabled,
          maxScore: data.maxScore,
        });
      }
    });

    // Fallback for legacy single workspaceId field
    if (surveys.length === 0) {
      const legacySnap = await adminDb
        .collection('surveys')
        .where('workspaceId', '==', workspaceId)
        .get();
      legacySnap.forEach((docSnap) => {
        const data = docSnap.data() as Survey;
        if (data.status === 'published' || !data.status) {
          surveys.push({
            id: docSnap.id,
            title: data.title || 'Untitled Survey',
            slug: data.slug || docSnap.id,
            description: data.description,
            category: data.category,
            scoringEnabled: data.scoringEnabled,
            maxScore: data.maxScore,
          });
        }
      });
    }

    return { success: true, surveys };
  } catch (err: unknown) {
    console.error('[survey-crm-trigger] getWorkspaceActiveSurveysAction error:', err);
    return {
      success: false,
      surveys: [],
      error: err instanceof Error ? err.message : 'Failed to fetch active surveys',
    };
  }
}

/**
 * Retrieves all survey responses associated with an entity or its contacts.
 */
export async function getEntitySurveyHistoryAction(
  entityId: string,
  workspaceId: string
): Promise<{ success: boolean; data: EntitySurveyHistorySummary; error?: string }> {
  try {
    if (!entityId || !workspaceId) {
      return {
        success: false,
        data: { responses: [], totalCount: 0, averageScore: 0 },
        error: 'Missing parameters',
      };
    }

    const cleanEntityId = entityId.startsWith(`${workspaceId}_`)
      ? entityId.slice(workspaceId.length + 1)
      : entityId;

    // Query responses collection group or survey subcollections
    // In our architecture, survey responses are stored in surveys/{surveyId}/responses
    const surveysSnap = await adminDb
      .collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    const responses: EntitySurveyHistoryItem[] = [];
    let totalScoreSum = 0;
    let scoredCount = 0;

    for (const surveyDoc of surveysSnap.docs) {
      const surveyData = surveyDoc.data() as Survey;
      const responsesSnap = await surveyDoc.ref
        .collection('responses')
        .where('entityId', 'in', [cleanEntityId, `${workspaceId}_${cleanEntityId}`])
        .get();

      responsesSnap.forEach((respDoc) => {
        const rData = respDoc.data() as SurveyResponse;
        const score = typeof rData.score === 'number' ? rData.score : undefined;
        const maxScore = surveyData.maxScore || 100;
        const percentage = score !== undefined && maxScore > 0 ? Math.round((score / maxScore) * 100) : undefined;

        if (score !== undefined) {
          totalScoreSum += score;
          scoredCount++;
        }

        const rawAnswers = (rData.answers || []) as Array<{ questionId: string; questionTitle?: string; value: string | string[] | number | boolean }>;

        responses.push({
          id: respDoc.id,
          surveyId: surveyDoc.id,
          surveyTitle: surveyData.title || 'Survey',
          submittedAt: rData.submittedAt || rData.createdAt || new Date().toISOString(),
          score,
          maxScore,
          percentage,
          outcome: rData.outcome || undefined,
          sentiment: rData.sentimentPolarity || undefined,
          sentimentScore: rData.sentimentScore || undefined,
          channel: rData.channel || 'web',
          respondentName: rData.respondentName || undefined,
          respondentEmail: rData.respondentEmail || undefined,
          respondentPhone: rData.respondentPhone || undefined,
          answers: rawAnswers,
        });
      });
    }

    // Sort responses by submittedAt descending
    responses.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const totalCount = responses.length;
    const averageScore = scoredCount > 0 ? Math.round(totalScoreSum / scoredCount) : 0;
    const latestSentiment = responses[0]?.sentiment;
    const latestSubmittedAt = responses[0]?.submittedAt;

    return {
      success: true,
      data: {
        responses,
        totalCount,
        averageScore,
        latestSentiment,
        latestSubmittedAt,
      },
    };
  } catch (err: unknown) {
    console.error('[survey-crm-trigger] getEntitySurveyHistoryAction error:', err);
    return {
      success: false,
      data: { responses: [], totalCount: 0, averageScore: 0 },
      error: err instanceof Error ? err.message : 'Failed to retrieve entity survey history',
    };
  }
}

/**
 * Dispatches a personalized survey invitation directly from CRM entity/contact profile.
 */
export async function sendSurveyToContactAction(
  params: SendSurveyToContactParams
): Promise<{ success: boolean; surveyUrl?: string; messageId?: string; error?: string }> {
  try {
    const {
      surveyId,
      workspaceId,
      organizationId = 'default',
      entityId,
      entityName = 'Valued Partner',
      contactId,
      recipientName,
      recipientEmail,
      recipientPhone,
      channel,
      customNote,
      senderProfileId = 'default',
    } = params;

    if (!surveyId || !workspaceId || !entityId) {
      return { success: false, error: 'Missing mandatory dispatch parameters' };
    }

    const cleanEntityId = entityId.startsWith(`${workspaceId}_`)
      ? entityId.slice(workspaceId.length + 1)
      : entityId;

    // 1. Fetch & authorize survey
    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) return { success: false, error: 'Survey not found' };

    const survey = surveyDoc.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized survey access for this workspace' };
    }

    // 2. Generate Cryptographic Tracking Token (ref)
    const tokenPayload = contactId ? `${contactId}:${cleanEntityId}` : cleanEntityId;
    const trackingRef = encryptToken(tokenPayload);

    const baseUrl = getBaseUrl();
    const surveySlug = survey.slug || survey.id;
    const surveyUrl = `${baseUrl}/surveys/${surveySlug}?ref=${encodeURIComponent(trackingRef)}`;

    // 3. Determine Recipient & Channel Prerequisites
    const recipient = channel === 'email' ? recipientEmail : recipientPhone;
    if (!recipient) {
      return {
        success: false,
        error: `Recipient has no ${channel === 'email' ? 'email address' : 'phone number'} configured`,
      };
    }

    // 4. Construct Notification Body
    const defaultBody = customNote
      ? `${customNote}\n\nPlease take a moment to complete our survey: ${surveyUrl}`
      : `Hi ${recipientName}, we would appreciate your feedback on "${survey.title}". Please click here to share your thoughts: ${surveyUrl}`;

    const subject = `Feedback Request: ${survey.title}`;

    // 5. Dispatch Message via Messaging Engine
    const sendRes = await sendMessage({
      templateId: 'custom_survey_dispatch',
      senderProfileId,
      organizationId,
      recipient,
      variables: {
        survey_title: survey.title,
        survey_url: surveyUrl,
        surveyUrl,
        recipient_name: recipientName,
        recipientName,
        entity_name: entityName,
        entityName,
      },
      entityId: cleanEntityId,
      workspaceId,
      body: defaultBody,
      subject,
    });

    // 6. Log Activity in CRM Timeline
    await logActivity({
      type: 'survey_invite_dispatched',
      source: 'survey_engine',
      description: `Survey invitation for "${survey.title}" dispatched to ${recipientName} via ${channel.toUpperCase()}.`,
      entityId: cleanEntityId,
      workspaceId,
      organizationId,
      metadata: {
        surveyId,
        surveyTitle: survey.title,
        channel,
        recipient,
        surveyUrl,
      },
    }).catch((logErr: unknown) => console.error('[survey-crm-trigger] Activity log error:', logErr));

    return {
      success: true,
      surveyUrl,
      messageId: sendRes?.logId || 'msg_dispatched',
    };
  } catch (err: unknown) {
    console.error('[survey-crm-trigger] sendSurveyToContactAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to dispatch survey invitation',
    };
  }
}

/**
 * Handles inbound CRM lifecycle events (e.g. Deal Won, Meeting Completed) and auto-dispatches configured surveys.
 */
export async function executeCrmInboundSurveyTriggerAction(params: {
  event: 'deal_won' | 'deal_stage_changed' | 'meeting_completed' | 'contact_created';
  workspaceId: string;
  organizationId?: string;
  entityId: string;
  contactId?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  pipelineId?: string;
  stageId?: string;
}): Promise<{ success: boolean; triggeredCount: number }> {
  try {
    const { event, workspaceId, entityId, contactId, recipientName, recipientEmail, recipientPhone } = params;
    if (!workspaceId || !entityId) return { success: true, triggeredCount: 0 };

    // Fetch surveys in workspace that have inbound CRM trigger rules
    const surveysSnap = await adminDb
      .collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    let triggeredCount = 0;

    for (const docSnap of surveysSnap.docs) {
      const survey = docSnap.data() as Survey;
      const crmConfig = survey.crmConfig;
      if (!crmConfig?.inboundTriggers?.enabled) continue;

      const matchedTrigger = crmConfig.inboundTriggers.rules?.find(
        (rule) => rule.enabled && rule.event === event
      );

      if (matchedTrigger) {
        const channel = matchedTrigger.channel || 'email';
        await sendSurveyToContactAction({
          surveyId: docSnap.id,
          workspaceId,
          organizationId: params.organizationId,
          entityId,
          contactId,
          recipientName,
          recipientEmail,
          recipientPhone,
          channel,
          customNote: matchedTrigger.customMessage,
        });
        triggeredCount++;
      }
    }

    return { success: true, triggeredCount };
  } catch (err) {
    console.error('[survey-crm-trigger] executeCrmInboundSurveyTriggerAction error:', err);
    return { success: false, triggeredCount: 0 };
  }
}
