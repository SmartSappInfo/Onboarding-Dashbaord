'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Deployments & Distribution Server Actions
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Channel Distribution Architecture:
 *    - Decouples survey definition from distribution channels (Web, QR, WhatsApp, SMS, Embed, Field).
 *    - Enforces quotas, scheduling, and attribution parameters per deployment.
 * 2. Strict Zero-Any Invariant:
 *    - Strictly typed inputs and returns.
 * 3. Testability:
 *    - Tested in src/lib/surveys/__tests__/survey-deployment-actions.test.ts.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SurveyDeployment } from './survey-v2-types';
import { hydrateSurveyDocument } from './survey-hydration-adapter';

export interface CreateDeploymentInput {
  name: string;
  channel: SurveyDeployment['channel'];
  quotaConfig?: SurveyDeployment['quotaConfig'];
  scheduleConfig?: SurveyDeployment['scheduleConfig'];
  audienceConfig?: SurveyDeployment['audienceConfig'];
  attributionConfig?: SurveyDeployment['attributionConfig'];
  customSlug?: string;
}

export interface DeploymentResult {
  success: boolean;
  deployment?: SurveyDeployment;
  deployments?: SurveyDeployment[];
  error?: string;
}

/**
 * Creates a new survey deployment channel.
 */
export async function createSurveyDeploymentAction(
  surveyId: string,
  workspaceId: string,
  input: CreateDeploymentInput
): Promise<DeploymentResult> {
  try {
    if (!surveyId || !workspaceId || !input.name.trim()) {
      return { success: false, error: 'surveyId, workspaceId, and name are required.' };
    }

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found.' };
    }

    const survey = hydrateSurveyDocument({ id: surveySnap.id, ...surveySnap.data() });
    if (!survey.workspaceIds.includes(workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey belongs to another workspace.' };
    }

    const depRef = adminDb.collection('survey_deployments').doc();
    const now = new Date().toISOString();
    const slug = input.customSlug?.trim() || `${survey.slug}-${input.channel}-${Math.random().toString(36).substring(2, 6)}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.smartsapp.com';
    const url = `${appUrl}/surveys/${survey.slug}?dep=${depRef.id}${input.attributionConfig?.agentId ? `&ref=${input.attributionConfig.agentId}` : ''}`;

    const newDeployment: SurveyDeployment = {
      id: depRef.id,
      surveyId,
      workspaceId,
      organizationId: survey.organizationId,
      name: input.name.trim(),
      channel: input.channel,
      status: 'active',
      slug,
      url,
      versionId: survey.publishedVersionId,
      quotaConfig: input.quotaConfig,
      scheduleConfig: input.scheduleConfig,
      audienceConfig: input.audienceConfig,
      attributionConfig: input.attributionConfig,
      stats: {
        viewsCount: 0,
        startsCount: 0,
        completionsCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    const batch = adminDb.batch();
    batch.set(depRef, newDeployment);
    batch.update(surveyRef, {
      deploymentIds: [...(survey.deploymentIds || []), depRef.id],
      updatedAt: now,
    });

    await batch.commit();

    return { success: true, deployment: newDeployment };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error creating deployment';
    console.error('[createSurveyDeploymentAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Retrieves all deployments for a survey.
 */
export async function getSurveyDeploymentsAction(
  surveyId: string,
  workspaceId: string
): Promise<DeploymentResult> {
  try {
    if (!surveyId || !workspaceId) {
      return { success: false, error: 'surveyId and workspaceId are required.' };
    }

    const snap = await adminDb
      .collection('survey_deployments')
      .where('surveyId', '==', surveyId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const deployments: SurveyDeployment[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        surveyId,
        workspaceId,
        organizationId: data.organizationId,
        name: data.name || 'Default Deployment',
        channel: data.channel || 'web',
        status: data.status || 'active',
        slug: data.slug || '',
        url: data.url || '',
        versionId: data.versionId,
        quotaConfig: data.quotaConfig,
        scheduleConfig: data.scheduleConfig,
        audienceConfig: data.audienceConfig,
        attributionConfig: data.attributionConfig,
        stats: data.stats || { viewsCount: 0, startsCount: 0, completionsCount: 0 },
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    deployments.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    return { success: true, deployments };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching deployments';
    console.error('[getSurveyDeploymentsAction Error]:', message);
    return { success: false, error: message };
  }
}

/**
 * Toggles the status of a deployment (active, paused, closed).
 */
export async function updateDeploymentStatusAction(
  deploymentId: string,
  workspaceId: string,
  status: SurveyDeployment['status']
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!deploymentId || !workspaceId) {
      return { success: false, error: 'deploymentId and workspaceId are required.' };
    }

    const docRef = adminDb.collection('survey_deployments').doc(deploymentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists || docSnap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Deployment not found or unauthorized.' };
    }

    const now = new Date().toISOString();
    await docRef.update({ status, updatedAt: now });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error updating deployment status';
    console.error('[updateDeploymentStatusAction Error]:', message);
    return { success: false, error: message };
  }
}
