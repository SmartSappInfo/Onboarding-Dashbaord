'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { Survey, SurveyResponse, Webhook } from './types';

/**
 * Get surveys for a specific contact (by entityId or entityId)
 * Implements query fallback pattern: prefer entityId, fallback to entityId
 * 
 * Requirements: 13.5, 22.1, 22.2
 */
export async function getSurveysForContact(
  contactId: { entityId?: string | null; entityId?: string | null },
  workspaceId: string
): Promise<Survey[]> {
  try {
    let query = adminDb.collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId);

    // Prefer entityId when available (Requirement 22.2)
    if (contactId.entityId) {
      query = query.where('entityId', '==', contactId.entityId);
    } else if (contactId.entityId) {
      // Fallback to entityId for backward compatibility (Requirement 22.1)
      query = query.where('entityId', '==', contactId.entityId);
    } else {
      // No contact identifier provided, return empty array
      return [];
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Survey));
  } catch (error: any) {
    console.error('Get Surveys For Contact Error:', error);
    throw new Error(error.message || 'Failed to get surveys for contact');
  }
}

/**
 * Get survey responses for a specific contact (by entityId or entityId)
 * Implements query fallback pattern: prefer entityId, fallback to entityId
 * 
 * Requirements: 13.5, 22.1, 22.2
 */
export async function getSurveyResponsesForContact(
  surveyId: string,
  contactId: { entityId?: string | null; entityId?: string | null }
): Promise<SurveyResponse[]> {
  try {
    let query = adminDb.collection('surveys').doc(surveyId).collection('responses');

    // Prefer entityId when available (Requirement 22.2)
    if (contactId.entityId) {
      query = query.where('entityId', '==', contactId.entityId) as any;
    } else if (contactId.entityId) {
      // Fallback to entityId for backward compatibility (Requirement 22.1)
      query = query.where('entityId', '==', contactId.entityId) as any;
    } else {
      // No contact identifier provided, return empty array
      return [];
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse));
  } catch (error: any) {
    console.error('Get Survey Responses For Contact Error:', error);
    throw new Error(error.message || 'Failed to get survey responses for contact');
  }
}

/**
 * Clones an existing survey including its elements and result pages subcollection.
 * @param surveyId The ID of the survey to clone.
 * @param userId The ID of the user performing the action.
 */
export async function cloneSurvey(surveyId: string, userId: string) {
  try {
    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found.' };
    }

    const originalData = surveySnap.data();
    if (!originalData) return { success: false, error: 'Survey data is empty.' };

    const newTitle = `${originalData.title} (Copy)`;
    const newSlug = `${originalData.slug}-copy-${Math.random().toString(36).substring(2, 7)}`;

    // Prepare new survey data
    const newSurveyData = {
      ...originalData,
      title: newTitle,
      slug: newSlug,
      status: 'draft', // Default to draft for the clone for safety
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Preserve dual-write fields from original survey
      entityId: originalData.entityId || null,
      entityName: originalData.entityName || null,
      entityId: originalData.entityId || null,
    };

    // Create the new survey document
    const newSurveyRef = await adminDb.collection('surveys').add(newSurveyData);

    // Clone the resultPages subcollection
    const resultPagesSnap = await surveyRef.collection('resultPages').get();
    if (!resultPagesSnap.empty) {
      const batch = adminDb.batch();
      resultPagesSnap.forEach((pageDoc) => {
        const newPageRef = newSurveyRef.collection('resultPages').doc(pageDoc.id);
        batch.set(newPageRef, pageDoc.data());
      });
      await batch.commit();
    }

    // Log activity
    await logActivity({
      entityId: '', 
      organizationId: 'default',
      userId,
      workspaceId: '',
      type: 'school_updated', // Using existing type for logging
      source: 'user_action',
      description: `cloned survey "${originalData.title}" as "${newTitle}"`,
      metadata: { originalSurveyId: surveyId, newSurveyId: newSurveyRef.id }
    });

    revalidatePath('/admin/surveys');
    return { success: true, id: newSurveyRef.id };
  } catch (error: any) {
    console.error("Clone Survey Error:", error);
    return { success: false, error: error.message || 'Unknown error occurred during cloning.' };
  }
}

/**
 * Bulk deletes survey responses.
 */
export async function deleteSurveyResponses(surveyId: string, responseIds: string[], userId: string) {
    const batch = adminDb.batch();
    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    
    for (const id of responseIds) {
        const docRef = surveyRef.collection('responses').doc(id);
        batch.delete(docRef);
    }

    try {
        await batch.commit();
        await logActivity({
            entityId: '',
            organizationId: 'default',
            userId,
            workspaceId: '',
            type: 'school_updated',
            source: 'user_action',
            description: `deleted ${responseIds.length} survey responses`,
            metadata: { surveyId, count: responseIds.length }
        });
        revalidatePath(`/admin/surveys/${surveyId}/results`);
        return { success: true };
    } catch (error: any) {
        console.error("Delete Responses Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Submits a public survey response using the Admin SDK.
 * Bypasses client-side security rules to ensure reliability for public paths.
 */
export async function submitPublicSurveyResponse(surveyId: string, responseData: any, sessionId?: string | null) {
  try {
    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    
    // 1. Add the response to the subcollection
    const docRef = await surveyRef.collection('responses').add({
      ...responseData,
      submittedAt: new Date().toISOString()
    });

    // 2. If session exists, mark as submitted
    if (sessionId) {
      await adminDb.collection('survey_sessions').doc(sessionId).set({
        isSubmitted: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Submit Public Survey Response Error:", error);
    return { success: false, error: error.message || "Failed to submit response." };
  }
}

/**
 * Triggers a survey webhook from the server.
 * Ensures the webhook endpoint is protected from public read access.
 */
export async function triggerSurveyWebhook(webhookId: string, payload: any) {
    try {
        const webhookDoc = await adminDb.collection('webhooks').doc(webhookId).get();
        if (!webhookDoc.exists) {
            return { success: false, error: "Webhook endpoint not found." };
        }
        
        const webhook = webhookDoc.data() as Webhook;
        const res = await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            return { success: false, error: `Webhook failed with status ${res.status}` };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Trigger Webhook Error:", error);
        return { success: false, error: error.message || "Failed to trigger webhook." };
    }
}
