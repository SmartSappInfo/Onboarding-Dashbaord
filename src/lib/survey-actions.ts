'use server';

import { adminDb } from './firebase-admin';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { logActivity } from './activity-logger';
import { triggerInternalNotification, triggerExternalNotification } from './notification-engine';
import { triggerAutomationProtocols } from './automation-processor';
import { recordConversion } from './analytics-actions';
import { sendMessage } from './messaging-engine';
import { resolveContact } from './contact-adapter';

import type { Survey, SurveyResponse, Webhook, EntityType, ContactIdentifierPolicy, IndustryVertical, SurveyQuestion, EntityContact, WorkspaceEntity } from './types';
import { validateContactIdentifier } from './contact-policy';
import { createEntityAction, updateEntityAction } from './entity-actions';
import { canUser } from './workspace-permissions';
import { processLeadCaptureAction } from './lead-actions';
import { getWorkspaceIndustry } from './industry-cache';

/**
 * Get surveys for a specific contact (by entityId)
 * 
 * Requirements: 13.5, 22.1
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
 * Get survey responses for a specific contact (by entityId)
 * 
 * Requirements: 13.5, 22.1
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

    const originalData = surveySnap.data() as Survey;
    const workspaceId = originalData.workspaceIds?.[0];

    // 0. Permission Check
    const permission = await canUser(userId, 'studios', 'surveys', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

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
      type: 'entity_updated',
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
 * Deletes a survey and its subcollections.
 */
export async function deleteSurveyAction(surveyId: string, userId: string) {
    try {
        const surveyRef = adminDb.collection('surveys').doc(surveyId);
        const surveySnap = await surveyRef.get();
        if (!surveySnap.exists) throw new Error("Survey not found.");
        const workspaceId = (surveySnap.data() as Survey).workspaceIds?.[0];

        // 0. Permission Check
        const permission = await canUser(userId, 'studios', 'surveys', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        // Delete subcollections (responses, resultPages)
        const responses = await surveyRef.collection('responses').get();
        const resultPages = await surveyRef.collection('resultPages').get();
        
        const batch = adminDb.batch();
        responses.forEach(doc => batch.delete(doc.ref));
        resultPages.forEach(doc => batch.delete(doc.ref));
        batch.delete(surveyRef);
        
        await batch.commit();

        // Cleanup Learning Loop Data (Non-blocking)
        after(async () => {
            try {
                const { deleteLearningSignalsBySurveyAction } = await import('./learning-loop-actions');
                await deleteLearningSignalsBySurveyAction(surveyId);
            } catch (err) {
                console.error('Failed to cleanup learning signals:', err);
            }
        });

        await logActivity({
            organizationId: 'default',
            workspaceId: workspaceId || '',
            userId,
            type: 'entity_updated',
            source: 'user_action',
            description: `deleted survey protocol: "${surveySnap.data()?.internalName || surveySnap.data()?.title}"`,
            metadata: { surveyId }
        });

        revalidatePath('/admin/surveys');
        return { success: true };
    } catch (error: any) {
        console.error("Delete Survey Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates a survey's status with permission validation.
 */
export async function updateSurveyStatusAction(surveyId: string, status: 'published' | 'draft' | 'archived', userId: string) {
    try {
        const surveyRef = adminDb.collection('surveys').doc(surveyId);
        const surveySnap = await surveyRef.get();
        if (!surveySnap.exists) throw new Error("Survey not found.");
        const workspaceId = (surveySnap.data() as Survey).workspaceIds?.[0];

        // 0. Permission Check
        const permission = await canUser(userId, 'studios', 'surveys', 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        await surveyRef.update({ status, updatedAt: new Date().toISOString() });

        revalidatePath('/admin/surveys');
        return { success: true };
    } catch (error: any) {
        console.error("Update Survey Status Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Bulk deletes survey responses.
 */
export async function deleteSurveyResponses(surveyId: string, responseIds: string[], userId: string) {
    try {
        const surveyRef = adminDb.collection('surveys').doc(surveyId);
        const surveySnap = await surveyRef.get();
        if (!surveySnap.exists) throw new Error("Survey not found.");
        const workspaceId = (surveySnap.data() as Survey).workspaceIds?.[0];

        // 0. Permission Check
        const permission = await canUser(userId, 'studios', 'surveys', 'delete', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const batch = adminDb.batch();
    
        for (const id of responseIds) {
            const docRef = surveyRef.collection('responses').doc(id);
            batch.delete(docRef);
        }

        await batch.commit();

        await logActivity({
            entityId: '',
            organizationId: 'default',
            userId,
            workspaceId: '',
            type: 'entity_updated',
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
      sourcePageId: responseData.sourcePageId || null,
      submittedAt: new Date().toISOString()
    });

    // 2. Fetch survey context for organization/workspace
    const surveySnap = await surveyRef.get();
    let organizationId = 'default';
    let workspaceId = '';
    let surveyData: Survey | null = null;

    if (surveySnap.exists) {
      surveyData = surveySnap.data() as Survey;
      organizationId = surveyData.organizationId || 'default';
      // FIX 1: Guard workspaceId — never fall back to 'default' for entity writes
      workspaceId = surveyData.workspaceIds?.[0] || '';
    }

    // 3. Transform to Entity/Lead if enabled (Task 12)
    let finalEntityId = responseData.entityId || null;
    const isFormMode = surveyData?.createEntity && surveyData?.leadCaptureMode === 'form';

    if (surveyData && surveyData.createEntity && surveyData.entityMapping && !isFormMode) {
      // FIX 1: Skip entity creation entirely if no workspace is resolved
      if (!workspaceId) {
        console.error(`[survey-actions] Survey ${surveyId} has no workspaceId — entity creation skipped`);
      } else {
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

        // Parse additional mappings and resolve overrides early
        const mappedInstitutionData: Record<string, string | number | boolean> = {};
        const mappedPersonData: Record<string, string | number | boolean> = {};
        const mappedCustomData: Record<string, string | number | boolean> = {};
        
        let overriddenEntityName: string | null = null;
        let overriddenContactName: string | null = null;
        let overriddenContactEmail: string | null = null;
        let overriddenContactPhone: string | null = null;

        if (mapping.additionalMappings?.length) {
          mapping.additionalMappings.forEach((m: { questionId: string; targetField: string }) => {
            const val = getAnswerValue(m.questionId);
            if (val !== null && val !== undefined && val !== '') {
              if (m.targetField.startsWith('institutionData.')) {
                const field = m.targetField.replace('institutionData.', '');
                mappedInstitutionData[field] = (field === 'nominalRoll' || field === 'capacity') ? Number(val) : val;
              } else if (m.targetField.startsWith('personData.')) {
                const field = m.targetField.replace('personData.', '');
                mappedPersonData[field] = val;
              } else if (m.targetField.startsWith('customData.')) {
                const field = m.targetField.replace('customData.', '');
                mappedCustomData[field] = val;
              } else if (m.targetField === 'entity.name') {
                overriddenEntityName = val;
              } else if (m.targetField === 'contacts.name') {
                overriddenContactName = val;
              } else if (m.targetField === 'contacts.email') {
                overriddenContactEmail = val;
              } else if (m.targetField === 'contacts.phone') {
                overriddenContactPhone = val;
              }
            }
          });
        }

        // Get workspace scope, contact policy, and industry
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        const wsData = wsSnap.data();
        const contactScope = (wsData?.contactScope || 'institution') as EntityType;
        const contactPolicy: ContactIdentifierPolicy = wsData?.contactPolicy || 'phone_or_email';

        // FIX 4: Resolve workspace industry for industryData payload
        const { industry: workspaceIndustry } = await getWorkspaceIndustry(workspaceId);

        // Accept entity.name OR contact.name as the entity name source
        const resolvedName = overriddenEntityName || eName || cName || '';
        const finalEntityName = resolvedName || (cEmail || cPhone ? `[Placeholder] ${cEmail || cPhone}` : '');
        
        const resolvedEmail = overriddenContactEmail || cEmail || '';
        const resolvedPhone = overriddenContactPhone || cPhone || '';

        // Validate contact identifiers per workspace policy
        const policyCheck = validateContactIdentifier(resolvedPhone, resolvedEmail, contactPolicy);

        if (finalEntityName && policyCheck.valid) {
          // 3.1 Deduplication — search within this workspace only
          const dedupeQuery = adminDb.collection('workspace_entities')
            .where('workspaceId', '==', workspaceId)
            .where('displayName', '==', finalEntityName);
          
          let weSnap;
          if (resolvedEmail) {
            weSnap = await dedupeQuery.where('primaryEmail', '==', resolvedEmail).limit(1).get();
          } else if (resolvedPhone) {
            weSnap = await dedupeQuery.where('primaryPhone', '==', resolvedPhone).limit(1).get();
          } else {
            weSnap = await dedupeQuery.limit(1).get();
          }

          // 3.2 Resolve entity defaults chain: system → org → workspace survey defaults → workspace entity defaults
          const systemDefaults = {
            currency: 'GHS',
            subscriptionPackageName: 'Standard',
            subscriptionRate: 0,
            contactTypeKey: 'primary',
          };
          
          let orgDefaults: Record<string, unknown> = {};
          if (organizationId && organizationId !== 'default') {
            const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
            if (orgSnap.exists) {
              orgDefaults = (orgSnap.data()?.surveyEntityDefaults as Record<string, unknown>) || {};
            }
          }
          
          const wsSurveyDefaults = (wsData?.surveyEntityDefaults as Record<string, unknown>) || {};
          const wsEntityDefaults = (wsData?.entityDefaults?.[contactScope as 'institution' | 'family' | 'person'] as Record<string, unknown>) || {};
          
          // Merge: system < org < workspace survey defaults < workspace entity defaults
          const resolvedDefaults = { ...systemDefaults, ...orgDefaults, ...wsSurveyDefaults, ...wsEntityDefaults };

          // FIX 7: contactScope alignment guard
          if (contactScope === 'person' && Object.keys(mappedInstitutionData).length > 0) {
            console.warn(`[survey-actions] institutionData mappings ignored — workspace contactScope is "person"`);
          }
          if (contactScope === 'institution' && Object.keys(mappedPersonData).length > 0 && Object.keys(mappedInstitutionData).length === 0) {
            console.warn(`[survey-actions] personData mappings on institution workspace — will be passed as personData`);
          }

          // FIX 5+6: Build industryData using defaults + survey-mapped fields
          let industryDataPayload: Record<string, unknown> | undefined;
          if (workspaceIndustry) {
            const industryDefaults = buildIndustryDefaults(workspaceIndustry, contactScope, resolvedDefaults);
            const surveyMapped = contactScope === 'institution' ? mappedInstitutionData : mappedPersonData;

            industryDataPayload = {
              industry: workspaceIndustry,
              ...industryDefaults,
              ...surveyMapped, // Survey answers override defaults
            };
          }

          const finalContactName = overriddenContactName || cName || finalEntityName;

          const entityPayload: {
            name: string;
            contacts: Array<{
              name: string;
              email: string;
              phone: string;
              isPrimary: boolean;
              typeKey: string;
            }>;
            globalTags: string[];
            workspaceTags: string[];
            customData?: Record<string, string | number | boolean>;
            personData?: Record<string, string | number | boolean>;
            industryData?: Record<string, unknown>;
          } = {
            name: finalEntityName,
            contacts: [
              {
                name: finalContactName,
                email: resolvedEmail,
                phone: resolvedPhone,
                isPrimary: true,
                typeKey: resolvedDefaults.contactTypeKey
              }
            ],
            globalTags: surveyData.autoTags || [],
            workspaceTags: surveyData.autoTags || [],
          };

          // Attach polymorphic data to the correct slot
          if (industryDataPayload) {
            entityPayload.industryData = industryDataPayload;
          }
          // Pass personData for person entities (non-industry fields like custom CRM props)
          if (contactScope === 'person' && Object.keys(mappedPersonData).length > 0) {
            entityPayload.personData = mappedPersonData;
          }
          // Pass customData
          if (Object.keys(mappedCustomData).length > 0) {
            entityPayload.customData = mappedCustomData;
          }

          if (!weSnap.empty) {
            // Match found → Update existing
            const existingWE = weSnap.docs[0].data();
            finalEntityId = existingWE.entityId;
            await updateEntityAction(
              finalEntityId,
              entityPayload,
              'system-survey', // FIX 2: hyphen prefix for system exemption
              workspaceId,
              organizationId
            );
          } else {
            // No match → Create new
            const createRes = await createEntityAction(
              entityPayload,
              'system-survey', // FIX 2: hyphen prefix for system exemption
              workspaceId,
              contactScope,
              organizationId
            );
            if (createRes.success) {
              finalEntityId = createRes.id;
            } else {
              console.error(`[survey-actions] Entity creation failed: ${createRes.error}`);
            }
          }

          // Link the response to the entity
          if (finalEntityId) {
            await docRef.update({ 
              entityId: finalEntityId,
              assignedUserId: responseData.assignedUserId || null 
            });
            
            // Trigger automations via the Logic Processor (Phase 1 completion)
            if (surveyData.autoAutomations?.length) {
              const automationPayload = {
                entityId: finalEntityId,
                entityName: eName,
                workspaceId,
                organizationId,
                surveyId,
                surveyTitle: surveyData.title,
                submissionId: docRef.id,
                assignedUserId: responseData.assignedUserId || null,
                score: responseData.score || null,
                autoTags: surveyData.autoTags || [],
                source: 'survey_submission',
              };

              // Fire SURVEY_SUBMITTED trigger for each matching automation
              await triggerAutomationProtocols('SURVEY_SUBMITTED', automationPayload);
            }
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
    if (surveyData && !isFormMode) {
      const notificationVars = {
        ...responseData.answers.reduce((acc: any, ans: any) => ({ ...acc, [ans.questionId]: ans.value }), {}),
        survey_title: surveyData.title,
        survey_id: surveyId,
        surveyId: surveyId,
        submission_id: docRef.id,
        submissionId: docRef.id,
        responseId: docRef.id,
        workspaceId,
        entityId: finalEntityId,
        score: responseData.score !== undefined ? responseData.score : 0,
        survey_score: responseData.score !== undefined ? responseData.score : 0,
        max_score: surveyData.maxScore || 100,
        respondent_name: responseData.respondentName || "",
        respondentName: responseData.respondentName || ""
      };

      // Internal Team Alerts
      if (surveyData.adminAlertsEnabled) {
        await triggerInternalNotification({
          entityId: finalEntityId,
          notifyManager: surveyData.adminAlertNotifyManager,
          specificUserIds: surveyData.adminAlertSpecificUserIds,
          emailTemplateId: surveyData.adminAlertEmailTemplateId,
          smsTemplateId: surveyData.adminAlertSmsTemplateId,
          whatsappTemplateId: surveyData.adminAlertWhatsappTemplateId,
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
          whatsappTemplateId: surveyData.externalAlertWhatsappTemplateId,
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

    // 7. Activity Logging — Creates a timeline entry for entity and survey analytics
    if (surveyData && !isFormMode) {
      await logActivity({
        entityId: finalEntityId || undefined,
        organizationId,
        workspaceId,
        userId: responseData.assignedUserId || 'anonymous',
        type: 'survey_submitted' as any, // Uses a non-bus type to avoid double-triggering automations
        source: 'public_survey',
        description: `Survey "${surveyData.title}" submitted${finalEntityId ? ` — entity linked` : ''}`,
        metadata: {
          surveyId,
          submissionId: docRef.id,
          surveyTitle: surveyData.title,
          score: responseData.score || null,
          assignedUserId: responseData.assignedUserId || null,
          entityCreated: !!finalEntityId,
          sourcePageId: responseData.sourcePageId || null,
        },
      });
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

/**
 * Robust asynchronous autosave action for the survey builder.
 * Handles both new survey creation (auto-initialization) and updates.
 */
export async function autoSaveSurveyAction(
    surveyId: string | 'new-survey',
    data: Partial<Survey>,
    userId: string
) {
    try {
        const surveysCol = adminDb.collection('surveys');
        const now = new Date().toISOString();
        
        // 1. Determine if we are creating or updating
        let targetId = surveyId;
        let isNew = surveyId === 'new-survey';

        // 2. Permission Check
        const workspaceId = data.workspaceIds?.[0] || 'generic';
        const permission = await canUser(userId, 'studios', 'surveys', isNew ? 'create' : 'edit', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        // 3. Prepare payload
        const payload = {
            ...JSON.parse(JSON.stringify(data)), // Ensure plain object
            updatedAt: now,
        };

        if (isNew) {
            // Auto-initialization defaults
            payload.createdAt = now;
            payload.status = payload.status || 'draft';
            payload.slug = payload.slug || `survey-${Math.random().toString(36).substring(2, 7)}`;
            
            const docRef = await surveysCol.add(payload);
            targetId = docRef.id;
        } else {
            await surveysCol.doc(surveyId).update(payload);
        }

        // Task 13.2: Register survey element variables when elements are updated
        if (data.elements && Array.isArray(data.elements) && data.elements.length > 0) {
            try {
                const { registerSurveyVariables } = await import('./template-variable-registry');
                await registerSurveyVariables(targetId, data.elements);
            } catch (error) {
                // Registration failures should not block survey operations
                console.error('Failed to register survey variables:', error);
            }
        }

        return { success: true, id: targetId };
    } catch (error: any) {
        console.error("AutoSave Survey Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Builds safe industry-specific defaults for entity creation via survey submission.
 * Bridges the generic SurveyEntityDefaults config and the strict Zod industry schemas.
 * Every required field in each IndustryDataSchema variant is covered here.
 *
 * Priority: resolvedDefaults (admin-configured) > hardcoded fallbacks
 */
function buildIndustryDefaults(
  industry: IndustryVertical,
  entityType: EntityType,
  resolvedDefaults: Record<string, any>
): Record<string, any> {
  const d = resolvedDefaults;

  switch (industry) {
    case 'SchoolEnrollment':
      // SchoolEnrollmentInstitutionDataSchema requires: gradeOfferings, academicYear, capacity
      return {
        gradeOfferings: d.gradeOfferings ?? [],
        academicYear: d.academicYear ?? new Date().getFullYear().toString(),
        capacity: d.capacity ?? 0,
        ...(d.currentEnrollment !== undefined && { currentEnrollment: d.currentEnrollment }),
      };

    case 'SaaS':
      if (entityType === 'institution') {
        // SaaSInstitutionDataSchema requires: capacity only
        return {
          capacity: d.capacity ?? 0,
          ...(d.activeUsers !== undefined && { activeUsers: d.activeUsers }),
        };
      } else {
        // SaaSPersonDataSchema requires: role, activationStatus
        return {
          role: d.role ?? 'user',
          activationStatus: d.activationStatus ?? 'pending',
        };
      }

    case 'Law':
      if (entityType === 'institution') {
        // LawInstitutionDataSchema requires: firmType, practiceAreas, conflictCheckRequired
        return {
          firmType: d.firmType ?? 'solo',
          practiceAreas: d.practiceAreas ?? [],
          conflictCheckRequired: d.conflictCheckRequired ?? false,
          ...(d.capacity !== undefined && { capacity: d.capacity }),
        };
      } else {
        // LawPersonDataSchema requires: clientType, urgency
        return {
          clientType: d.clientType ?? 'individual',
          urgency: d.urgency ?? 'low',
          ...(d.legalIssueType !== undefined && { legalIssueType: d.legalIssueType }),
        };
      }

    case 'Marketing':
      if (entityType === 'institution') {
        // MarketingInstitutionDataSchema requires: clientIndustry
        return {
          clientIndustry: d.clientIndustry ?? 'General',
          ...(d.targetAudience !== undefined && { targetAudience: d.targetAudience }),
          ...(d.capacity !== undefined && { capacity: d.capacity }),
          ...(d.monthlyBudget !== undefined && { monthlyBudget: d.monthlyBudget }),
        };
      } else {
        // MarketingPersonDataSchema requires: role, influenceLevel, approvalAuthority
        return {
          role: d.role ?? 'user',
          influenceLevel: d.influenceLevel ?? 'user',
          approvalAuthority: d.approvalAuthority ?? false,
        };
      }

    case 'RealEstate':
      if (entityType === 'institution') {
        // RealEstateInstitutionDataSchema requires: developerType
        return {
          developerType: d.developerType ?? 'residential',
          ...(d.capacity !== undefined && { capacity: d.capacity }),
          ...(d.investmentFocus !== undefined && { investmentFocus: d.investmentFocus }),
        };
      } else {
        // RealEstatePersonDataSchema requires: clientType
        return {
          clientType: d.clientType ?? 'buyer',
          ...(d.preferredLocations !== undefined && { preferredLocations: d.preferredLocations }),
        };
      }

    case 'Consultancy':
      if (entityType === 'institution') {
        // ConsultancyInstitutionDataSchema requires: clientIndustry
        return {
          clientIndustry: d.clientIndustry ?? 'General',
          ...(d.capacity !== undefined && { capacity: d.capacity }),
          ...(d.strategicPriorities !== undefined && { strategicPriorities: d.strategicPriorities }),
          ...(d.painPoints !== undefined && { painPoints: d.painPoints }),
        };
      } else {
        // ConsultancyPersonDataSchema requires: role, influenceLevel
        return {
          role: d.role ?? 'user',
          influenceLevel: d.influenceLevel ?? 'user',
          ...(d.department !== undefined && { department: d.department }),
          ...(d.decisionMakingStyle !== undefined && { decisionMakingStyle: d.decisionMakingStyle }),
        };
      }

    default:
      return {};
  }
}

export interface SubmitPublicSurveyLeadInput {
  surveyId: string;
  responseId: string;
  workspaceId: string;
  leadData: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  outcomeId?: string | null;
}

export interface FinalizeSurveySubmissionInput {
  surveyId: string;
  responseId: string;
  workspaceId: string;
  outcomeId?: string | null;
}

export async function submitPublicSurveyLead(
  surveyId: string,
  responseId: string,
  workspaceId: string,
  leadData: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    [key: string]: string | undefined;
  },
  outcomeId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found' };
    }
    const surveyData = surveySnap.data() as Survey;
    const organizationId = surveyData.organizationId || 'default';

    const responseRef = surveyRef.collection('responses').doc(responseId);
    const responseSnap = await responseRef.get();
    if (!responseSnap.exists) {
      return { success: false, error: 'Response not found' };
    }
    const responseData = responseSnap.data() as SurveyResponse;

    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    const wsData = wsSnap.data();
    const contactScope = (wsData?.contactScope || 'institution') as EntityType;
    const contactPolicy: ContactIdentifierPolicy = wsData?.contactPolicy || 'phone_or_email';

    const { industry: workspaceIndustry } = await getWorkspaceIndustry(workspaceId);

    const cEmail = leadData.email?.toLowerCase().trim() || '';
    const cPhone = leadData.phone?.trim() || '';
    const resolvedName = leadData.company || leadData.name || '';
    const finalEntityName = resolvedName || (cEmail || cPhone ? `[Placeholder] ${cEmail || cPhone}` : '');

    const policyCheck = validateContactIdentifier(cPhone, cEmail, contactPolicy);
    if (!finalEntityName || !policyCheck.valid) {
      return { success: false, error: 'Identity validation failed per workspace policy.' };
    }

    // Deduplication Search
    const dedupeQuery = adminDb.collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .where('displayName', '==', finalEntityName);
    
    let weSnap;
    if (cEmail) {
      weSnap = await dedupeQuery.where('primaryEmail', '==', cEmail).limit(1).get();
    } else if (cPhone) {
      weSnap = await dedupeQuery.where('primaryPhone', '==', cPhone).limit(1).get();
    } else {
      weSnap = await dedupeQuery.limit(1).get();
    }

    const systemDefaults = {
      currency: 'GHS',
      subscriptionPackageName: 'Standard',
      subscriptionRate: 0,
      contactTypeKey: 'primary',
    };
    
    let orgDefaults: Record<string, string | number> = {};
    if (organizationId !== 'default') {
      const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgSnap.exists) {
        orgDefaults = orgSnap.data()?.surveyEntityDefaults || {};
      }
    }
    
    const wsSurveyDefaults = wsData?.surveyEntityDefaults || {};
    const wsEntityDefaults = wsData?.entityDefaults?.[contactScope as 'institution' | 'family' | 'person'] || {};
    const resolvedDefaults = { ...systemDefaults, ...orgDefaults, ...wsSurveyDefaults, ...wsEntityDefaults };

    // Extract survey mappings from answers
    const answers = responseData.answers || [];
    const getAnswerValue = (qId?: string) => {
      if (!qId) return null;
      const ans = answers.find(a => a.questionId === qId);
      return ans ? ans.value : null;
    };

    const mappedInstitutionData: Record<string, string | number | string[]> = {};
    const mappedPersonData: Record<string, string | number | string[]> = {};

    const mapping = surveyData.entityMapping || {};
    if (mapping.additionalMappings?.length) {
      mapping.additionalMappings.forEach((m) => {
        const val = getAnswerValue(m.questionId);
        if (val !== null && val !== undefined && val !== '') {
          if (m.targetField.startsWith('institutionData.')) {
            const field = m.targetField.replace('institutionData.', '');
            mappedInstitutionData[field] = (field === 'nominalRoll' || field === 'capacity') ? Number(val) : val;
          } else if (m.targetField.startsWith('personData.')) {
            const field = m.targetField.replace('personData.', '');
            mappedPersonData[field] = val;
          }
        }
      });
    }

    let industryDataPayload: Record<string, string | number | string[]> | undefined;
    if (workspaceIndustry) {
      const industryDefaults = buildIndustryDefaults(workspaceIndustry, contactScope, resolvedDefaults);
      const surveyMapped = contactScope === 'institution' ? mappedInstitutionData : mappedPersonData;

      industryDataPayload = {
        industry: workspaceIndustry,
        ...industryDefaults,
        ...surveyMapped,
      };
    }

    const entityPayload: any = {
      name: finalEntityName,
      contacts: [
        {
          name: leadData.name || finalEntityName,
          email: cEmail,
          phone: cPhone,
          isPrimary: true,
          typeKey: resolvedDefaults.contactTypeKey
        }
      ],
      globalTags: surveyData.autoTags || [],
      workspaceTags: surveyData.autoTags || [],
    };

    if (industryDataPayload) {
      entityPayload.industryData = industryDataPayload;
    }
    if (contactScope === 'person' && Object.keys(mappedPersonData).length > 0) {
      entityPayload.personData = mappedPersonData;
    }

    let finalEntityId: string | null = null;
    if (!weSnap.empty) {
      const existingWE = weSnap.docs[0].data();
      finalEntityId = existingWE.entityId;
      await updateEntityAction(
        finalEntityId!,
        entityPayload,
        'system-survey',
        workspaceId,
        organizationId
      );
    } else {
      const createRes = await createEntityAction(
        entityPayload,
        'system-survey',
        workspaceId,
        contactScope,
        organizationId
      );
      if (createRes.success) {
        finalEntityId = createRes.id!;
      } else if (createRes.isDuplicate && createRes.duplicates && createRes.duplicates.length > 0) {
        const duplicate = createRes.duplicates[0];
        const targetEntityId = duplicate.entityId.replace(`${workspaceId}_`, '');
        
        const entitySnap = await adminDb.collection('entities').doc(targetEntityId).get();
        const existingContacts: EntityContact[] = entitySnap.data()?.entityContacts || [];
        
        let contactExists = false;
        const mergedContacts = [...existingContacts];
        
        for (let i = 0; i < mergedContacts.length; i++) {
          const ec = mergedContacts[i];
          const emailMatch = cEmail && ec.email && ec.email.toLowerCase().trim() === cEmail;
          const phoneMatch = cPhone && ec.phone && ec.phone.trim() === cPhone;
          
          if (emailMatch || phoneMatch) {
            mergedContacts[i] = {
              ...ec,
              name: leadData.name || ec.name || finalEntityName,
              email: cEmail || ec.email || '',
              phone: cPhone || ec.phone || '',
            };
            contactExists = true;
            break;
          }
        }
        
        if (!contactExists) {
          mergedContacts.push({
            id: `ec_${crypto.randomUUID().substring(0, 8)}`,
            name: leadData.name || finalEntityName,
            email: cEmail,
            phone: cPhone,
            isPrimary: false,
            isSignatory: false,
            typeKey: resolvedDefaults.contactTypeKey,
            typeLabel: resolvedDefaults.contactTypeKey === 'primary' ? 'Primary' : 'Other',
            order: mergedContacts.length,
            updatedAt: new Date().toISOString()
          });
        }
        
        entityPayload.entityContacts = mergedContacts;
        delete entityPayload.contacts;
        
        await updateEntityAction(
          targetEntityId,
          entityPayload,
          'system-survey',
          workspaceId,
          organizationId
        );
        finalEntityId = targetEntityId;
      } else {
        return { success: false, error: createRes.error || 'Failed to create lead.' };
      }
    }

    // Link the response to the entity
    if (finalEntityId) {
      await responseRef.update({ 
        entityId: finalEntityId,
        assignedUserId: responseData.assignedUserId || null,
        leadDetails: leadData
      });

      // Trigger post-submission automations, notifications, webhooks, and logs
      after(async () => {
        await triggerPostSubmissionAutomations(
          surveyData,
          responseId,
          {
            answers: responseData.answers as Array<{ questionId: string; value: string | string[] }>,
            score: responseData.score,
            sourcePageId: responseData.sourcePageId,
            assignedUserId: responseData.assignedUserId
          },
          workspaceId,
          organizationId,
          finalEntityId,
          cEmail || null,
          cPhone || null,
          outcomeId
        );
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("submitPublicSurveyLead Error:", error);
    return { success: false, error: error.message || "Failed to process lead." };
  }
}

export async function finalizeSurveySubmission(
  surveyId: string,
  responseId: string,
  workspaceId: string,
  outcomeId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found' };
    }
    const surveyData = surveySnap.data() as Survey;
    const organizationId = surveyData.organizationId || 'default';

    const responseRef = surveyRef.collection('responses').doc(responseId);
    const responseSnap = await responseRef.get();
    if (!responseSnap.exists) {
      return { success: false, error: 'Response not found' };
    }
    const responseData = responseSnap.data() as SurveyResponse;

    // Trigger post-submission automations (without entityId, and fallback email/phone if any exist in the response answers)
    const answers = responseData.answers || [];
    
    const emailQuestion = surveyData.elements.filter((el): el is SurveyQuestion => 'isRequired' in el).find(q => 
        q.type === 'email' || 
        q.title.toLowerCase().includes('email address') ||
        q.title.toLowerCase().includes('your email')
    );
    const phoneQuestion = surveyData.elements.filter((el): el is SurveyQuestion => 'isRequired' in el).find(q => 
        q.type === 'phone' || 
        q.title.toLowerCase().includes('phone number') ||
        q.title.toLowerCase().includes('mobile number') ||
        q.title.toLowerCase().includes('contact number')
    );

    const getAnswerValue = (qId?: string) => {
      if (!qId) return null;
      const ans = answers.find(a => a.questionId === qId);
      return ans ? ans.value : null;
    };

    const respondentEmail = emailQuestion ? getAnswerValue(emailQuestion.id) : null;
    const respondentPhone = phoneQuestion ? getAnswerValue(phoneQuestion.id) : null;

    after(async () => {
      await triggerPostSubmissionAutomations(
        surveyData,
        responseId,
        {
          answers: responseData.answers as Array<{ questionId: string; value: string | string[] }>,
          score: responseData.score,
          respondentName: responseData.respondentName,
          sourcePageId: responseData.sourcePageId,
          assignedUserId: responseData.assignedUserId
        },
        workspaceId,
        organizationId,
        responseData.entityId || null,
        respondentEmail ? String(respondentEmail) : null,
        respondentPhone ? String(respondentPhone) : null,
        outcomeId
      );
    });

    return { success: true };
  } catch (error: any) {
    console.error("finalizeSurveySubmission Error:", error);
    return { success: false, error: error.message || "Failed to finalize submission." };
  }
}

async function triggerPostSubmissionAutomations(
  surveyData: Survey,
  responseId: string,
  responseData: {
    answers: Array<{ questionId: string; value: string | string[] }>;
    score?: number;
    respondentName?: string | null;
    sourcePageId?: string | null;
    assignedUserId?: string | null;
  },
  workspaceId: string,
  organizationId: string,
  entityId: string | null,
  respondentEmail: string | null,
  respondentPhone: string | null,
  outcomeId?: string | null
): Promise<void> {
  const notificationVars: Record<string, string | number> = {
    ...responseData.answers.reduce((acc, ans) => ({
      ...acc,
      [ans.questionId]: Array.isArray(ans.value) ? ans.value.join(', ') : String(ans.value)
    }), {}),
    survey_title: surveyData.title,
    survey_id: surveyData.id,
    surveyId: surveyData.id,
    submission_id: responseId,
    submissionId: responseId,
    responseId: responseId,
    workspaceId: workspaceId,
    entityId: entityId || '',
    score: responseData.score !== undefined ? responseData.score : 0,
    survey_score: responseData.score !== undefined ? responseData.score : 0,
    max_score: surveyData.maxScore || 100,
    respondent_name: responseData.respondentName || '',
    respondentName: responseData.respondentName || ''
  };

  // 1. Webhook
  if (surveyData.webhookEnabled && surveyData.webhookId) {
    const payload = { 
      ...notificationVars, 
      answers: responseData.answers, 
      raw_score: responseData.score || 0,
      survey_id: surveyData.id,
      school_id: entityId || ''
    };
    await triggerSurveyWebhook(surveyData.webhookId, payload).catch(console.error);
  }

  // 2. Auto-acknowledgements (outcome-specific)
  if (outcomeId) {
    const outcome = surveyData.resultRules?.find(r => r.id === outcomeId);
    if (outcome) {
      // 2a. Apply Tag
      const tagEnabled = outcome.tagEnabled ?? (!!outcome.applyTag && outcome.applyTag.trim().length > 0);
      if (tagEnabled && outcome.applyTag && entityId) {
        try {
          const { applyTagsAction } = await import('./tag-actions');
          await applyTagsAction(
            entityId,
            'workspace_entity',
            [outcome.applyTag],
            'system-survey-engine',
            'Survey Outcome Engine'
          );
        } catch (err: unknown) {
          console.error(">>> [NOTIFY] Failed to apply outcome contact tag:", err);
        }
      }

      // 2b. Trigger Automation
      if (outcome.automationEnabled && outcome.triggerAutomationId && entityId) {
        try {
          const { runAutomationById } = await import('./automation-processor');
          const automationPayload = {
            entityId,
            entityName: String(notificationVars.entityName || ''),
            workspaceId,
            organizationId,
            surveyId: surveyData.id,
            surveyTitle: surveyData.title,
            submissionId: responseId,
            assignedUserId: responseData.assignedUserId || null,
            score: responseData.score || null,
            source: 'survey_outcome',
          };
          await runAutomationById(outcome.triggerAutomationId, automationPayload);
        } catch (err: unknown) {
          console.error(">>> [NOTIFY] Failed to trigger outcome automation:", err);
        }
      }

      // 2c. Send Messages
      const messagingEnabled = outcome.messagingEnabled ?? (!!outcome.emailTemplateId || !!outcome.smsTemplateId || !!outcome.whatsappTemplateId);
      if (messagingEnabled) {
        if (outcome.emailTemplateId && outcome.emailTemplateId !== 'none' && respondentEmail) {
          await sendMessage({
            templateId: outcome.emailTemplateId,
            senderProfileId: outcome.emailSenderProfileId || 'default',
            recipient: respondentEmail,
            variables: notificationVars,
            entityId: entityId || undefined
          }).catch(console.error);
        }
        if (outcome.smsTemplateId && outcome.smsTemplateId !== 'none' && respondentPhone) {
          await sendMessage({
            templateId: outcome.smsTemplateId,
            senderProfileId: outcome.smsSenderProfileId || 'default',
            recipient: respondentPhone,
            variables: notificationVars,
            entityId: entityId || undefined
          }).catch(console.error);
        }
        if (outcome.whatsappTemplateId && outcome.whatsappTemplateId !== 'none' && respondentPhone) {
          await sendMessage({
            templateId: outcome.whatsappTemplateId,
            senderProfileId: outcome.whatsappSenderProfileId || 'default',
            recipient: respondentPhone,
            variables: notificationVars,
            entityId: entityId || undefined
          }).catch(console.error);
        }
      }
    }
  }

  // 3. Admin Alerts
  if (surveyData.adminAlertsEnabled) {
    await triggerInternalNotification({
      entityId: entityId || '',
      notifyManager: surveyData.adminAlertNotifyManager,
      specificUserIds: surveyData.adminAlertSpecificUserIds,
      emailTemplateId: surveyData.adminAlertEmailTemplateId,
      smsTemplateId: surveyData.adminAlertSmsTemplateId,
      whatsappTemplateId: surveyData.adminAlertWhatsappTemplateId,
      channel: surveyData.adminAlertChannel,
      variables: {
        ...notificationVars,
        event_type: 'Survey Completion',
        surveyId: surveyData.id,
        responseId: responseId,
        submissionId: responseId
      }
    }).catch(console.error);
  }

  // 4. External Alerts
  if (surveyData.externalAlertsEnabled && entityId) {
    await triggerExternalNotification({
      entityId: entityId,
      contactTypes: surveyData.externalAlertContactTypes || [],
      emailTemplateId: surveyData.externalAlertEmailTemplateId,
      smsTemplateId: surveyData.externalAlertSmsTemplateId,
      whatsappTemplateId: surveyData.externalAlertWhatsappTemplateId,
      channel: surveyData.externalAlertChannel,
      variables: {
        ...notificationVars,
        surveyId: surveyData.id,
        responseId: responseId,
        submissionId: responseId
      }
    }).catch(console.error);
  }

  // 5. Assigned User Alerts
  if (surveyData.notifyAssignedUsers && responseData.assignedUserId) {
    const assignedUserId = responseData.assignedUserId;
    const config = surveyData.notifyAssignedUsers;
    const hasEmail = config.email && config.emailTemplateId && config.emailTemplateId !== 'none';
    const hasSms = config.sms && config.smsTemplateId && config.smsTemplateId !== 'none';

    if (hasEmail || hasSms) {
      await triggerInternalNotification({
        entityId: entityId || '',
        specificUserIds: [assignedUserId],
        emailTemplateId: hasEmail ? config.emailTemplateId : undefined,
        smsTemplateId: hasSms ? config.smsTemplateId : undefined,
        variables: { 
          ...notificationVars, 
          assigned_userId: assignedUserId,
          is_assigned_alert: true,
          surveyId: surveyData.id,
          responseId: responseId,
          submissionId: responseId
        },
        channel: hasEmail && hasSms ? 'both' : (hasEmail ? 'email' : 'sms')
      });
    }
  }

  // 5.5 Survey Completion Team Alert (Default dynamic blueprint)
  try {
    const outcome = outcomeId ? surveyData.resultRules?.find(r => r.id === outcomeId) : undefined;
    let contactName = 'Client';
    if (entityId) {
      const contact = await resolveContact(entityId, workspaceId);
      if (contact && contact.name) {
        contactName = contact.name;
      }
    }
    const respondentName = (notificationVars.respondent_name || contactName) as string;

    await triggerInternalNotification({
      triggerKey: 'survey_completion_team',
      entityId: entityId || '',
      notifyManager: true,
      specificUserIds: surveyData.adminAlertSpecificUserIds || [],
      variables: {
        ...notificationVars,
        respondent_name: respondentName,
        completion_date: new Date().toLocaleDateString(),
        score: responseData.score || 0,
        result_message: outcome?.label || 'No specific result outcome reached.',
        surveyId: surveyData.id,
        responseId: responseId,
        submissionId: responseId,
        organizationId: organizationId,
        category: 'surveys'
      },
      channel: 'both'
    });
  } catch (err: unknown) {
    console.error(">>> [NOTIFY] Failed to trigger internal survey_completion_team alert:", err);
  }

  // 6. Automations (SURVEY_SUBMITTED trigger)
  if (surveyData.autoAutomations?.length && entityId) {
    const automationPayload = {
      entityId,
      entityName: notificationVars.entityName || '',
      workspaceId,
      organizationId,
      surveyId: surveyData.id,
      surveyTitle: surveyData.title,
      submissionId: responseId,
      assignedUserId: responseData.assignedUserId || null,
      score: responseData.score || null,
      autoTags: surveyData.autoTags || [],
      source: 'survey_submission',
    };
    await triggerAutomationProtocols('SURVEY_SUBMITTED', automationPayload).catch(console.error);
  }

  // 7. Activity Log
  await logActivity({
    entityId: entityId || undefined,
    organizationId,
    workspaceId,
    userId: responseData.assignedUserId || 'anonymous',
    type: 'survey_submitted' as any,
    source: 'public_survey',
    description: `Survey "${surveyData.title}" submitted${entityId ? ` — entity linked` : ''}`,
    metadata: {
      surveyId: surveyData.id,
      submissionId: responseId,
      surveyTitle: surveyData.title,
      score: responseData.score || null,
      assignedUserId: responseData.assignedUserId || null,
      entityCreated: !!entityId,
      sourcePageId: responseData.sourcePageId || null,
    },
  }).catch(console.error);
}

export async function executeSurveyResultButtonActions(params: {
  surveyId: string;
  responseId: string;
  entityId: string;
  addTagIds?: string[];
  triggerAutomationId?: string;
  fireWebhookUrl?: string;
}) {
  const { surveyId, responseId, entityId, addTagIds, triggerAutomationId, fireWebhookUrl } = params;
  
  try {
    const surveySnap = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveySnap.exists) throw new Error('Survey not found');
    const surveyData = surveySnap.data() as Survey;
    const organizationId = surveyData.organizationId || 'default';
    const workspaceId = surveyData.workspaceIds?.[0] || '';

    // Load workspace entity
    const weSnap = await adminDb.collection('workspace_entities').doc(entityId).get();
    if (!weSnap.exists) throw new Error('Contact/entity not found');
    const weData = weSnap.data() as WorkspaceEntity;

    // 1. Add Tag(s)
    if (addTagIds && addTagIds.length > 0) {
      const { applyTagsAction } = await import('./tag-actions');
      await applyTagsAction(entityId, 'workspace_entity', addTagIds, 'system-survey-results-button');
    }

    // 2. Trigger Automation
    if (triggerAutomationId && triggerAutomationId !== 'none') {
      const { runAutomationById } = await import('./automation-processor');
      const automationPayload = {
        entityId,
        entityName: weData.displayName || '',
        workspaceId,
        organizationId,
        surveyId,
        surveyTitle: surveyData.title,
        submissionId: responseId,
        source: 'survey_results_button',
      };
      await runAutomationById(triggerAutomationId, automationPayload);
    }

    // 3. Fire Webhook
    if (fireWebhookUrl) {
      const payload = {
        surveyId,
        surveyTitle: surveyData.title,
        responseId,
        entityId,
        entityName: weData.displayName || '',
        primaryEmail: weData.primaryEmail || '',
        primaryPhone: weData.primaryPhone || '',
        contacts: weData.entityContacts || [],
        timestamp: new Date().toISOString()
      };
      await fetch(fireWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => {
        console.error(`[survey-actions] Webhook fire failed:`, err);
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[survey-actions] executeSurveyResultButtonActions failed:`, err);
    return { success: false, error: msg };
  }
}

export async function getWorkspaceEntitiesForSimulationAction(workspaceId: string): Promise<Array<{
  id: string;
  name: string;
  contacts: Array<{
    name: string;
    email: string;
    phone: string;
    typeLabel?: string;
    typeKey?: string;
  }>;
}>> {
  if (!workspaceId) return [];
  try {
    const weSnap = await adminDb.collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .limit(100)
      .get();
    
    if (weSnap.empty) return [];

    const results: Array<{ id: string; name: string; contacts: any[] }> = [];
    
    const promises = weSnap.docs.map(async (weDoc) => {
      const weData = weDoc.data();
      const entityId = weData.entityId;
      if (!entityId) return null;

      try {
        const entityDoc = await adminDb.collection('entities').doc(entityId).get();
        if (!entityDoc.exists) {
          return {
            id: entityId,
            name: weData.displayName || weData.name || 'Unnamed Entity',
            contacts: weData.entityContacts || []
          };
        }
        const entityData = entityDoc.data()!;
        return {
          id: entityId,
          name: entityData.name || weData.displayName || weData.name || 'Unnamed Entity',
          contacts: entityData.entityContacts || weData.entityContacts || []
        };
      } catch (err) {
        console.error(`Error loading entity doc ${entityId} for simulation:`, err);
        return {
          id: entityId,
          name: weData.displayName || weData.name || 'Unnamed Entity',
          contacts: weData.entityContacts || []
        };
      }
    });

    const resolved = await Promise.all(promises);
    return resolved.filter((item): item is NonNullable<typeof item> => item !== null);
  } catch (error) {
    console.error('Error in getWorkspaceEntitiesForSimulationAction:', error);
    return [];
  }
}
