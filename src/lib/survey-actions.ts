'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { logActivity } from './activity-logger';
import { triggerInternalNotification, triggerExternalNotification } from './notification-engine';
import { triggerAutomationProtocols } from './automation-processor';
import { recordConversion } from './analytics-actions';

import type { Survey, SurveyResponse, Webhook, EntityType, ContactIdentifierPolicy, IndustryVertical } from './types';
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
            type: 'school_updated',
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

    if (surveyData && surveyData.createEntity && surveyData.entityMapping) {
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

        // Get workspace scope, contact policy, and industry
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        const wsData = wsSnap.data();
        const contactScope = (wsData?.contactScope || 'institution') as EntityType;
        const contactPolicy: ContactIdentifierPolicy = wsData?.contactPolicy || 'phone_or_email';

        // FIX 4: Resolve workspace industry for industryData payload
        const { industry: workspaceIndustry } = await getWorkspaceIndustry(workspaceId);

        // Accept entity.name OR contact.name as the entity name source
        const resolvedName = eName || cName || '';
        const finalEntityName = resolvedName || (cEmail || cPhone ? `[Placeholder] ${cEmail || cPhone}` : '');

        // Validate contact identifiers per workspace policy
        const policyCheck = validateContactIdentifier(cPhone, cEmail, contactPolicy);

        if (finalEntityName && policyCheck.valid) {
          // 3.1 Deduplication — search within this workspace only
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

          // 3.2 Resolve entity defaults chain: system → org → workspace survey defaults → workspace entity defaults
          const systemDefaults = {
            currency: 'GHS',
            subscriptionPackageName: 'Standard',
            subscriptionRate: 0,
            contactTypeKey: 'primary',
          };
          
          let orgDefaults: any = {};
          if (organizationId && organizationId !== 'default') {
            const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
            if (orgSnap.exists) {
              orgDefaults = orgSnap.data()?.surveyEntityDefaults || {};
            }
          }
          
          const wsSurveyDefaults = wsData?.surveyEntityDefaults || {};
          const wsEntityDefaults = wsData?.entityDefaults?.[contactScope as 'institution' | 'family' | 'person'] || {};
          
          // Merge: system < org < workspace survey defaults < workspace entity defaults
          const resolvedDefaults = { ...systemDefaults, ...orgDefaults, ...wsSurveyDefaults, ...wsEntityDefaults };

          // 3.3 Extract survey-mapped fields
          const mappedInstitutionData: any = {};
          const mappedPersonData: any = {};

          if (mapping.additionalMappings?.length) {
            mapping.additionalMappings.forEach((m: any) => {
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

          // FIX 7: contactScope alignment guard
          if (contactScope === 'person' && Object.keys(mappedInstitutionData).length > 0) {
            console.warn(`[survey-actions] institutionData mappings ignored — workspace contactScope is "person"`);
          }
          if (contactScope === 'institution' && Object.keys(mappedPersonData).length > 0 && Object.keys(mappedInstitutionData).length === 0) {
            console.warn(`[survey-actions] personData mappings on institution workspace — will be passed as personData`);
          }

          // FIX 5+6: Build industryData using defaults + survey-mapped fields
          let industryDataPayload: any | undefined;
          if (workspaceIndustry) {
            const industryDefaults = buildIndustryDefaults(workspaceIndustry, contactScope, resolvedDefaults);
            const surveyMapped = contactScope === 'institution' ? mappedInstitutionData : mappedPersonData;

            industryDataPayload = {
              industry: workspaceIndustry,
              ...industryDefaults,
              ...surveyMapped, // Survey answers override defaults
            };
          }

          const entityPayload: any = {
            name: finalEntityName,
            contacts: [
              {
                name: cName || finalEntityName,
                email: cEmail || '',
                phone: cPhone || '',
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

    // 7. Activity Logging — Creates a timeline entry for entity and survey analytics
    if (surveyData) {
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
        // SaaSInstitutionDataSchema requires: capacity, accountStatus
        return {
          capacity: d.capacity ?? 0,
          accountStatus: d.accountStatus ?? 'lead',
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
