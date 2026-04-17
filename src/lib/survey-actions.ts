'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { triggerInternalNotification, triggerExternalNotification } from './notification-engine';
import { recordConversion } from './analytics-actions';

import type { Survey, SurveyResponse, Webhook, FocalPerson, EntityType } from './types';
import { createEntityAction, updateEntityAction } from './entity-actions';

/**
 * Get surveys for a specific contact (by entityId or entityId)
 * Implements query fallback pattern: prefer entityId, fallback to entityId
 * 
 * Requirements: 13.5, 22.1, 22.2
 */
export async function getSurveysForContact(
  entityId: string,
  workspaceId: string
): Promise<Survey[]> {
  try {
    let query = adminDb.collection('surveys')
      .where('workspaceIds', 'array-contains', workspaceId);

    if (entityId) {
      query = query.where('entityId', '==', entityId);
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
  entityId: string
): Promise<SurveyResponse[]> {
  try {
    let query = adminDb.collection('surveys').doc(surveyId).collection('responses');

    if (entityId) {
      query = query.where('entityId', '==', entityId) as any;
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
      // Unified identifier pattern
      entityId: originalData.entityId || null,
      entityName: originalData.entityName || null,
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

import { processLeadCaptureAction } from './lead-actions';


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
      sourcePageId: responseData.sourcePageId || null,
      submittedAt: new Date().toISOString()
    });

    // 2. Fetch survey context for organization/workspace
    const surveySnap = await surveyRef.get();
    let organizationId = 'default';
    let workspaceId = 'default';
    let surveyData: Survey | null = null;

    if (surveySnap.exists) {
      surveyData = surveySnap.data() as Survey;
      organizationId = surveyData.organizationId || 'default';
      workspaceId = surveyData.workspaceIds[0] || 'default';
    }

    // 3. Transform to Entity/Lead if enabled (Task 12)
    let finalEntityId = responseData.entityId || null;

    if (surveyData && surveyData.createEntity && surveyData.entityMapping) {
      const mapping = surveyData.entityMapping;
      const answers = responseData.answers || [];

      const getAnswerValue = (qId?: string) => {
        if (!qId) return null;
        const ans = answers.find((a: any) => a.questionId === qId);
        return ans ? ans.value : null;
      };

      const eName = getAnswerValue(mapping.entityNameFieldId);
      const cName = getAnswerValue(mapping.contactNameFieldId);
      const cEmail = getAnswerValue(mapping.contactEmailFieldId);
      const cPhone = getAnswerValue(mapping.contactPhoneFieldId);

      if (eName && cEmail) {
        // 3.1 Resolution & Deduplication
        const weRef = adminDb.collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .where('displayName', '==', eName)
          .where('primaryEmail', '==', cEmail)
          .limit(1);
        
        const weSnap = await weRef.get();
        
        // Get workspace scope
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        const contactScope = (wsSnap.data()?.contactScope || 'institution') as EntityType;

        // 3.1 Advanced Property Mapping (Phase 5)
        const institutionData: any = {};
        const personData: any = {};

        if (mapping.additionalMappings?.length) {
          mapping.additionalMappings.forEach((m: any) => {
            const val = getAnswerValue(m.questionId);
            if (val !== null && val !== undefined && val !== '') {
              if (m.targetField.startsWith('institutionData.')) {
                const field = m.targetField.replace('institutionData.', '');
                // Handle numeric casting for known number fields
                institutionData[field] = field === 'nominalRoll' ? Number(val) : val;
              } else if (m.targetField.startsWith('personData.')) {
                const field = m.targetField.replace('personData.', '');
                personData[field] = val;
              }
            }
          });
        }

        const entityPayload: any = {
          name: eName,
          contacts: [
            {
              name: cName || eName,
              email: cEmail,
              phone: cPhone,
              isPrimary: true,
              typeKey: 'primary'
            }
          ],
          globalTags: surveyData.autoTags || [],
          workspaceTags: surveyData.autoTags || [],
        };

        if (Object.keys(institutionData).length > 0) entityPayload.institutionData = institutionData;
        if (Object.keys(personData).length > 0) entityPayload.personData = personData;

        if (!weSnap.empty) {
          // Match found -> Update existing
          const existingWE = weSnap.docs[0].data();
          finalEntityId = existingWE.entityId;
          await updateEntityAction(
            finalEntityId,
            entityPayload,
            'system_survey',
            workspaceId,
            organizationId
          );
        } else {
          // No match -> Create new
          const createRes = await createEntityAction(
            entityPayload,
            'system_survey',
            workspaceId,
            contactScope,
            organizationId
          );
          if (createRes.success) {
            finalEntityId = createRes.id;
          }
        }

        // Link the response to the entity
        if (finalEntityId) {
          await docRef.update({ 
            entityId: finalEntityId,
            assignedUserId: responseData.assignedUserId || null 
          });
          
          // Trigger automations if enabled
          if (surveyData.autoAutomations?.length) {
            console.log(`[SURVEY:AUTOMATION] Triggering ${surveyData.autoAutomations.length} workflows for entity ${finalEntityId}`);
          }
        }
      }
    }

    // 4. Handle Analytics if submitted from a campaign page
    if (responseData.sourcePageId) {
      await recordConversion(responseData.sourcePageId);
      
      // Process as CRM lead in the background
      processLeadCaptureAction({
          submissionId: docRef.id,
          collection: 'survey_responses',
          data: responseData,
          organizationId,
          workspaceId,
          sourcePageId: responseData.sourcePageId,
          surveyId
      }).catch(console.error);
    }

    // 5. If session exists, mark as submitted
    if (sessionId) {
      await adminDb.collection('survey_sessions').doc(sessionId).set({
        isSubmitted: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    
    // 6. Handle Notifications (Admin & External)
    if (surveyData) {
      const notificationVars = {
        ...responseData.answers.reduce((acc: any, ans: any) => ({ ...acc, [ans.questionId]: ans.value }), {}),
        survey_title: surveyData.title,
        survey_id: surveyId,
        submission_id: docRef.id,
        workspaceId,
        entityId: finalEntityId
      };

      // Internal Team Alerts
      if (surveyData.adminAlertsEnabled) {
        await triggerInternalNotification({
          entityId: finalEntityId,
          notifyManager: surveyData.adminAlertNotifyManager,
          specificUserIds: surveyData.adminAlertSpecificUserIds,
          emailTemplateId: surveyData.adminAlertEmailTemplateId,
          smsTemplateId: surveyData.adminAlertSmsTemplateId,
          variables: notificationVars,
          channel: surveyData.adminAlertChannel
        });
      }

      // External Stakeholder Alerts
      if (surveyData.externalAlertsEnabled && finalEntityId) {
        await triggerExternalNotification({
          entityId: finalEntityId,
          contactTypes: surveyData.externalAlertContactTypes || [],
          emailTemplateId: surveyData.externalAlertEmailTemplateId,
          smsTemplateId: surveyData.externalAlertSmsTemplateId,
          variables: notificationVars,
          channel: surveyData.externalAlertChannel
        });
      }

      // 6.1 Assigned User Attribution Alerts (Phase 3)
      if (surveyData.notifyAssignedUsers && responseData.assignedUserId) {
        const assignedUserId = responseData.assignedUserId;
        const config = surveyData.notifyAssignedUsers;

        const hasEmail = config.email && config.emailTemplateId && config.emailTemplateId !== 'none';
        const hasSms = config.sms && config.smsTemplateId && config.smsTemplateId !== 'none';

        if (hasEmail || hasSms) {
          await triggerInternalNotification({
            entityId: finalEntityId,
            specificUserIds: [assignedUserId],
            emailTemplateId: hasEmail ? config.emailTemplateId : undefined,
            smsTemplateId: hasSms ? config.smsTemplateId : undefined,
            variables: { 
              ...notificationVars, 
              assigned_userId: assignedUserId,
              is_assigned_alert: true 
            },
            channel: hasEmail && hasSms ? 'both' : (hasEmail ? 'email' : 'sms')
          });
        }
      }
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
