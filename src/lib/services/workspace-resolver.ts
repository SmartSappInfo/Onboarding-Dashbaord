import { cache } from 'react';
import { adminDb } from '../firebase-admin';

// Local caches to deduplicate Firestore reads per request segment
const entityWorkspaceCache = new Map<string, string | null>();
const meetingWorkspaceCache = new Map<string, string | null>();
const contractWorkspaceCache = new Map<string, string | null>();
const surveyWorkspaceCache = new Map<string, string | null>();
const pdfWorkspaceCache = new Map<string, string | null>();
const userWorkspaceCache = new Map<string, string | null>();

/**
 * Resolves the primary workspace ID associated with a contact entity from workspace_entities.
 */
export async function resolveWorkspaceIdFromEntity(entityId: string): Promise<string | null> {
  if (!entityId || typeof entityId !== 'string') return null;
  
  if (entityWorkspaceCache.has(entityId)) {
    return entityWorkspaceCache.get(entityId) ?? null;
  }

  try {
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .limit(1)
      .get();

    if (!weSnap.empty) {
      const workspaceId = weSnap.docs[0].data().workspaceId as string | undefined;
      const result = workspaceId || null;
      entityWorkspaceCache.set(entityId, result);
      return result;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromEntity failed for ${entityId}:`, err);
  }

  entityWorkspaceCache.set(entityId, null);
  return null;
}

/**
 * Resolves the primary workspace ID associated with a meeting document.
 */
export async function resolveWorkspaceIdFromMeeting(meetingId: string): Promise<string | null> {
  if (!meetingId || typeof meetingId !== 'string') return null;

  if (meetingWorkspaceCache.has(meetingId)) {
    return meetingWorkspaceCache.get(meetingId) ?? null;
  }

  try {
    const docSnap = await adminDb.collection('meetings').doc(meetingId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      const result = workspaceId || null;
      meetingWorkspaceCache.set(meetingId, result);
      return result;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromMeeting failed for ${meetingId}:`, err);
  }

  meetingWorkspaceCache.set(meetingId, null);
  return null;
}

/**
 * Resolves the primary workspace ID associated with a contract document.
 */
export async function resolveWorkspaceIdFromContract(contractId: string): Promise<string | null> {
  if (!contractId || typeof contractId !== 'string') return null;

  if (contractWorkspaceCache.has(contractId)) {
    return contractWorkspaceCache.get(contractId) ?? null;
  }

  try {
    const docSnap = await adminDb.collection('contracts').doc(contractId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      const result = workspaceId || null;
      contractWorkspaceCache.set(contractId, result);
      return result;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromContract failed for ${contractId}:`, err);
  }

  contractWorkspaceCache.set(contractId, null);
  return null;
}

/**
 * Resolves the primary workspace ID associated with a survey.
 */
export async function resolveWorkspaceIdFromSurvey(surveyId: string): Promise<string | null> {
  if (!surveyId || typeof surveyId !== 'string') return null;

  if (surveyWorkspaceCache.has(surveyId)) {
    return surveyWorkspaceCache.get(surveyId) ?? null;
  }

  try {
    const docSnap = await adminDb.collection('surveys').doc(surveyId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      const result = workspaceId || null;
      surveyWorkspaceCache.set(surveyId, result);
      return result;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromSurvey failed for ${surveyId}:`, err);
  }

  surveyWorkspaceCache.set(surveyId, null);
  return null;
}

/**
 * Resolves the primary workspace ID associated with a PDF form template.
 */
export async function resolveWorkspaceIdFromPDFForm(pdfFormId: string): Promise<string | null> {
  if (!pdfFormId || typeof pdfFormId !== 'string') return null;

  if (pdfWorkspaceCache.has(pdfFormId)) {
    return pdfWorkspaceCache.get(pdfFormId) ?? null;
  }

  try {
    const docSnap = await adminDb.collection('pdf_forms').doc(pdfFormId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      const result = workspaceId || null;
      pdfWorkspaceCache.set(pdfFormId, result);
      return result;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdFromPDFForm failed for ${pdfFormId}:`, err);
  }

  pdfWorkspaceCache.set(pdfFormId, null);
  return null;
}

/**
 * Resolves the primary workspace ID associated with a user profile.
 */
export async function resolveWorkspaceIdForUser(userId: string): Promise<string | null> {
  if (!userId || typeof userId !== 'string') return null;

  if (userWorkspaceCache.has(userId)) {
    return userWorkspaceCache.get(userId) ?? null;
  }

  try {
    const docSnap = await adminDb.collection('users').doc(userId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const workspaceId = (data?.workspaceIds?.[0] || data?.workspaceId) as string | undefined;
      const result = workspaceId || null;
      userWorkspaceCache.set(userId, result);
      return result;
    }
  } catch (err) {
    console.error(`[WorkspaceResolver] resolveWorkspaceIdForUser failed for ${userId}:`, err);
  }

  userWorkspaceCache.set(userId, null);
  return null;
}

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
