'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Omnichannel Campaign Distribution Server Actions
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Omnichannel Campaign Dispatch:
 *    - Batches distribution for WhatsApp, SMS, and Email.
 *    - Chunked into slices of 30 (chunkSize = 30) to respect Firestore 'in' query and API rate limits.
 * 2. Recipient Personalization & Attribution:
 *    - Generates cryptographic tracking tokens (ref) for each recipient.
 *    - Variable interpolation routes strictly through FieldsVariablesService.
 * 3. Multi-Tenant Scoping:
 *    - Enforces workspaceId and organizationId isolation.
 * 4. Strict Zero-Any Invariant.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SurveyDistributionCampaign, SurveyDeployment } from './survey-v2-types';
import { generateTrackingToken, buildSurveyAttributionUrl } from './survey-attribution';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import { sendMessage } from '@/lib/messaging-engine';

export interface CreateDistributionCampaignInput {
  surveyId: string;
  deploymentId: string;
  workspaceId: string;
  organizationId?: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  audienceConfig: SurveyDistributionCampaign['audienceConfig'];
  messageConfig: SurveyDistributionCampaign['messageConfig'];
  scheduleConfig?: SurveyDistributionCampaign['scheduleConfig'];
  attributionConfig?: SurveyDistributionCampaign['attributionConfig'];
  createdBy: string;
}

export interface DispatchCampaignResult {
  success: boolean;
  dispatchedCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Creates a new distribution campaign record and syncs with the deployment.
 */
export async function createSurveyDistributionCampaignAction(
  input: CreateDistributionCampaignInput
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  try {
    if (!input.surveyId || !input.deploymentId || !input.workspaceId) {
      return { success: false, error: 'Missing required surveyId, deploymentId, or workspaceId' };
    }

    const campaignRef = adminDb.collection('survey_distribution_campaigns').doc();
    const now = new Date().toISOString();

    const campaignData: SurveyDistributionCampaign = {
      id: campaignRef.id,
      surveyId: input.surveyId,
      deploymentId: input.deploymentId,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      name: input.name,
      channel: input.channel,
      status: input.scheduleConfig?.scheduledAt ? 'scheduled' : 'draft',
      scheduleConfig: input.scheduleConfig,
      audienceConfig: input.audienceConfig,
      messageConfig: input.messageConfig,
      attributionConfig: input.attributionConfig,
      stats: {
        totalRecipients: input.audienceConfig.recipientCount || 0,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        startedCount: 0,
        completedCount: 0,
        bouncedCount: 0,
        failedCount: 0,
      },
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await campaignRef.set(campaignData);

    return { success: true, campaignId: campaignRef.id };
  } catch (error: unknown) {
    console.error('Failed to create survey distribution campaign:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create campaign',
    };
  }
}

/**
 * Dispatches an omnichannel survey distribution campaign to targeted contacts in batches of 30.
 */
export async function dispatchSurveyDistributionCampaignAction(
  campaignId: string,
  workspaceId: string
): Promise<DispatchCampaignResult> {
  try {
    if (!campaignId || !workspaceId) {
      return { success: false, dispatchedCount: 0, failedCount: 0, error: 'Missing campaignId or workspaceId' };
    }

    const campaignDoc = await adminDb.collection('survey_distribution_campaigns').doc(campaignId).get();
    if (!campaignDoc.exists) {
      return { success: false, dispatchedCount: 0, failedCount: 0, error: 'Campaign not found' };
    }

    const campaign = campaignDoc.data() as SurveyDistributionCampaign;
    if (campaign.workspaceId !== workspaceId) {
      return { success: false, dispatchedCount: 0, failedCount: 0, error: 'Unauthorized access to campaign' };
    }

    const surveyDoc = await adminDb.collection('surveys').doc(campaign.surveyId).get();
    if (!surveyDoc.exists) {
      return { success: false, dispatchedCount: 0, failedCount: 0, error: 'Survey not found' };
    }
    const surveyData = surveyDoc.data() || {};
    const surveySlug = (surveyData.slug as string) || campaign.surveyId;

    // Fetch targeted contacts (with chunking)
    const contactsQuery = adminDb.collection('contacts')
      .where('workspaceIds', 'array-contains', workspaceId)
      .limit(500);

    const contactSnap = await contactsQuery.get();
    let contacts = contactSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Apply Tag Filters if configured
    if (campaign.audienceConfig.filterTagIds && campaign.audienceConfig.filterTagIds.length > 0) {
      const allowedTags = new Set(campaign.audienceConfig.filterTagIds);
      contacts = contacts.filter((c: Record<string, unknown>) => {
        const contactTags = Array.isArray(c.tagIds) ? (c.tagIds as string[]) : [];
        return contactTags.some((t) => allowedTags.has(t));
      });
    }

    let dispatchedCount = 0;
    let failedCount = 0;
    const baseUrl = getBaseUrl();

    // Mark as dispatching
    await campaignDoc.ref.update({
      status: 'dispatching',
      updatedAt: new Date().toISOString(),
    });

    // Chunk recipients into slices of 30
    const chunkSize = 30;
    for (let i = 0; i < contacts.length; i += chunkSize) {
      const chunk = contacts.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (contact: Record<string, unknown>) => {
          try {
            const contactId = String(contact.id);
            const entityId = typeof contact.entityId === 'string' ? contact.entityId : undefined;
            const recipientEmail = typeof contact.email === 'string' ? contact.email : undefined;
            const recipientPhone = typeof contact.phone === 'string' ? contact.phone : undefined;

            // Generate opaque tracking token
            const trackingToken = generateTrackingToken({
              contactId,
              entityId,
              workspaceId,
              campaignId,
              timestamp: Date.now(),
            });

            // Build personalized survey link
            const personalizedUrl = buildSurveyAttributionUrl(baseUrl, surveySlug, {
              utmSource: campaign.channel,
              utmMedium: 'campaign',
              utmCampaign: campaign.name,
              deploymentId: campaign.deploymentId,
              campaignId: campaign.id,
              trackingRef: trackingToken,
            });

            const recipientTarget = campaign.channel === 'email' ? recipientEmail : recipientPhone;
            if (!recipientTarget) {
              failedCount++;
              return;
            }

            // Dispatch message via messaging engine
            if (campaign.messageConfig.templateId) {
              await sendMessage({
                templateId: campaign.messageConfig.templateId,
                senderProfileId: campaign.messageConfig.senderId || 'default',
                organizationId: campaign.organizationId,
                recipient: recipientTarget,
                workspaceId,
                entityId,
                variables: {
                  survey_link: personalizedUrl,
                  survey_url: personalizedUrl,
                  survey_title: (surveyData.title as string) || 'Survey',
                  recipient_name: (contact.name as string) || 'Valued Contact',
                },
                subject: campaign.messageConfig.subject,
                body: campaign.messageConfig.messageBody,
              });
            }

            dispatchedCount++;
          } catch (err) {
            console.error('Failed to send campaign message to recipient:', err);
            failedCount++;
          }
        })
      );
    }

    // Finalize Campaign Stats
    const finalStatus = dispatchedCount > 0 ? 'completed' : 'failed';
    const now = new Date().toISOString();

    await campaignDoc.ref.update({
      status: finalStatus,
      dispatchedAt: now,
      completedAt: now,
      'stats.sentCount': dispatchedCount,
      'stats.failedCount': failedCount,
      updatedAt: now,
    });

    return {
      success: true,
      dispatchedCount,
      failedCount,
    };
  } catch (error: unknown) {
    console.error('Error in dispatchSurveyDistributionCampaignAction:', error);
    return {
      success: false,
      dispatchedCount: 0,
      failedCount: 0,
      error: error instanceof Error ? error.message : 'Dispatch failed',
    };
  }
}

/**
 * Estimates audience size based on tag filters and workspace criteria.
 */
export async function estimateAudienceSizeAction(
  workspaceId: string,
  filterTagIds?: string[],
  entityTypes?: string[]
): Promise<{ count: number }> {
  try {
    if (!workspaceId) return { count: 0 };

    const contactsQuery = adminDb.collection('contacts')
      .where('workspaceIds', 'array-contains', workspaceId);

    const snapshot = await contactsQuery.get();
    let count = snapshot.size;

    if (filterTagIds && filterTagIds.length > 0) {
      const allowed = new Set(filterTagIds);
      count = snapshot.docs.filter((d) => {
        const data = d.data();
        const tagIds = Array.isArray(data.tagIds) ? (data.tagIds as string[]) : [];
        return tagIds.some((t) => allowed.has(t));
      }).length;
    }

    return { count };
  } catch (error: unknown) {
    console.error('Failed to estimate audience size:', error);
    return { count: 0 };
  }
}
