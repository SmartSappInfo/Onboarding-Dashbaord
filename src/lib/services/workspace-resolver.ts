import { cache } from 'react';
import { adminDb } from '../firebase-admin';

/**
 * Resolves the primary workspace ID associated with a contact entity from workspace_entities.
 */
export const resolveWorkspaceIdFromEntity = cache(async (entityId: string): Promise<string | null> => {
  if (!entityId || typeof entityId !== 'string') return null;

  try {
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .limit(1)
      .get();

    if (!weSnap.empty) {
      const workspaceId = weSnap.docs[0].data().workspaceId as string | undefined;
      return workspaceId || null;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromEntity failed for ${entityId}:`, err);
  }

  return null;
});

/**
 * Resolves the primary workspace ID associated with a meeting document.
 */
export const resolveWorkspaceIdFromMeeting = cache(async (meetingId: string): Promise<string | null> => {
  if (!meetingId || typeof meetingId !== 'string') return null;

  try {
    const docSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      return workspaceId || null;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromMeeting failed for ${meetingId}:`, err);
  }

  return null;
});

/**
 * Resolves the primary workspace ID associated with a contract document.
 */
export const resolveWorkspaceIdFromContract = cache(async (contractId: string): Promise<string | null> => {
  if (!contractId || typeof contractId !== 'string') return null;

  try {
    const docSnap = await adminDb.collection('contracts').doc(contractId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      return workspaceId || null;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromContract failed for ${contractId}:`, err);
  }

  return null;
});

/**
 * Resolves the primary workspace ID associated with a survey.
 */
export const resolveWorkspaceIdFromSurvey = cache(async (surveyId: string): Promise<string | null> => {
  if (!surveyId || typeof surveyId !== 'string') return null;

  try {
    const docSnap = await adminDb.collection('surveys').doc(surveyId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      return workspaceId || null;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromSurvey failed for ${surveyId}:`, err);
  }

  return null;
});

/**
 * Resolves the primary workspace ID associated with a PDF form template.
 */
export const resolveWorkspaceIdFromPDFForm = cache(async (pdfFormId: string): Promise<string | null> => {
  if (!pdfFormId || typeof pdfFormId !== 'string') return null;

  try {
    const docSnap = await adminDb.collection('pdf_forms').doc(pdfFormId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      return workspaceId || null;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromPDFForm failed for ${pdfFormId}:`, err);
  }

  return null;
});

/**
 * Resolves the primary workspace ID associated with a user profile.
 */
export const resolveWorkspaceIdForUser = cache(async (userId: string): Promise<string | null> => {
  if (!userId || typeof userId !== 'string') return null;

  try {
    const docSnap = await adminDb.collection('users').doc(userId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      return workspaceId || null;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdForUser failed for ${userId}:`, err);
  }

  return null;
});

interface ContextPayload {
  workspaceId?: string;
  entityId?: string;
  surveyId?: string;
  meetingId?: string;
  pdfId?: string;
  contractId?: string;
  userId?: string;
}

/**
 * Orchestrates hierarchical context-aware workspace resolution, returning a valid workspace ID or null.
 * Prioritization:
 * 1. Explicit workspace ID context passed.
 * 2. Entity workspace association context.
 * 3. Parent document contexts (meeting, survey, pdf form, contract).
 * 4. User workspace context.
 */
export async function resolveContextWorkspaceId(ctx: ContextPayload): Promise<string | null> {
  // 1. Explicit Context
  if (ctx.workspaceId && ctx.workspaceId !== 'onboarding') {
    return ctx.workspaceId;
  }

  // 2. Entity Context
  if (ctx.entityId) {
    const wsFromEntity = await resolveWorkspaceIdFromEntity(ctx.entityId);
    if (wsFromEntity) return wsFromEntity;
  }

  // 3. Parent Document Contexts
  if (ctx.meetingId) {
    const wsFromMeeting = await resolveWorkspaceIdFromMeeting(ctx.meetingId);
    if (wsFromMeeting) return wsFromMeeting;
  }

  if (ctx.surveyId) {
    const wsFromSurvey = await resolveWorkspaceIdFromSurvey(ctx.surveyId);
    if (wsFromSurvey) return wsFromSurvey;
  }

  if (ctx.pdfId) {
    const wsFromPDF = await resolveWorkspaceIdFromPDFForm(ctx.pdfId);
    if (wsFromPDF) return wsFromPDF;
  }

  if (ctx.contractId) {
    const wsFromContract = await resolveWorkspaceIdFromContract(ctx.contractId);
    if (wsFromContract) return wsFromContract;
  }

  // 4. User context
  if (ctx.userId) {
    const wsFromUser = await resolveWorkspaceIdForUser(ctx.userId);
    if (wsFromUser) return wsFromUser;
  }

  return null;
}

/**
 * Flags a missing workspace ID by logging a warning event/alert to the organization.
 */
export async function flagMissingWorkspaceToAdmin(userId: string, orgId: string): Promise<void> {
  if (!userId || !orgId) return;

  try {
    await adminDb.collection('activities').add({
      type: 'system_warning',
      description: `User "${userId}" has no active workspace assigned.`,
      source: 'system',
      organizationId: orgId,
      workspaceId: 'global',
      userId: 'system',
      metadata: {
        userId,
        reason: 'User activated/triggered action without any workspace IDs associated.'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[WorkspaceResolver] flagMissingWorkspaceToAdmin failed for user ${userId}:`, err);
  }
}
