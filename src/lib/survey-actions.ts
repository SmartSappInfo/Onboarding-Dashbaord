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

import type { Survey, SurveyResponse, Webhook, EntityType, ContactIdentifierPolicy, IndustryVertical, SurveyQuestion, EntityContact, WorkspaceEntity, SurveyResultRule } from './types';
import { validateContactIdentifier } from './contact-policy';
import { createEntityAction, updateEntityAction } from './entity-actions';
import { createDeal } from '../app/actions/deal-actions';
import { stripHtml } from './utils';
import { canUser } from './workspace-permissions';
import { processLeadCaptureAction } from './lead-actions';
import { getWorkspaceIndustry } from './industry-cache';

export interface EntityContactPayload {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  isSignatory?: boolean;
  typeKey: string;
  typeLabel?: string;
  order?: number;
  updatedAt?: string;
}

export interface EntityMutationPayload {
  name?: string;
  contacts?: EntityContactPayload[];
  entityContacts?: EntityContactPayload[];
  globalTags: string[];
  workspaceTags: string[];
  customData?: Record<string, string | number | boolean>;
  personData?: Record<string, string | number | boolean | string[]>;
  industryData?: Record<string, unknown>;
}

/**
 * Helper to identify generic choice answers (e.g. "Yes", "No", "Later", "Agree")
 * so they are never erroneously assigned as fallback entity names.
 */
function isGenericChoiceValue(val: unknown): boolean {
  if (typeof val !== 'string' && typeof val !== 'boolean') return false;
  const str = String(val).trim().toLowerCase();
  const genericChoices = new Set([
    'yes', 'no', 'later', 'maybe', 'agree', 'disagree', 
    'true', 'false', 'option 1', 'option 2', 'option 3', 
    'select', 'none', 'n/a', 'na'
  ]);
  return genericChoices.has(str);
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Sanitize entity mutation payload when updating pre-existing entities.
 * Prevents unintended overwrites of entity display names by unmapped question answers
 * (such as option "Yes") or dynamic lead capture fallbacks.
 * If the existing entity name is generic (e.g. "Yes", "Later") or a placeholder,
 * the lead form's actual school/company name is allowed to overwrite it.
 *
 * @param payload Target entity mutation payload
 * @param options Guard evaluation context (isExistingEntity, isExplicitlyMapped, isManualInput, existingEntityName)
 * @returns Sanitized payload safe for updateEntityAction
 */
export async function sanitizeEntityPayloadForUpdate(
  payload: EntityMutationPayload,
  options: {
    isExistingEntity: boolean;
    isExplicitlyMapped: boolean;
    isManualInput: boolean;
    existingEntityName?: string | null;
  }
): Promise<EntityMutationPayload> {
  const sanitized: EntityMutationPayload = { ...payload };

  const isExistingNameGeneric = options.existingEntityName
    ? (isGenericChoiceValue(options.existingEntityName) || options.existingEntityName.startsWith('[Placeholder]'))
    : false;

  // CAUTION: Only strip name when updating pre-existing entities that already have a legitimate non-generic name,
  // without explicit mapping or manual fill. If the existing name is generic (like "Yes") or placeholder, allow update.
  if (options.isExistingEntity && !options.isExplicitlyMapped && !options.isManualInput && !isExistingNameGeneric) {
    delete sanitized.name;
  }

  return sanitized;
}

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



export interface EntityMatchResult {
  entityId: string;
  entityName: string;
  entityContacts?: EntityContact[];
  matchedBy: 'tracked_id' | 'primary_email' | 'primary_phone' | 'contact_email' | 'contact_phone' | 'display_name';
  existingEntityDoc?: Record<string, unknown>;
}

/**
 * Multi-layered helper to resolve or match an existing workspace entity before
 * attempting to create a new one. Guarantees zero duplicate entities in CRM.
 */
export async function resolveOrMatchWorkspaceEntity(
  workspaceId: string,
  params: {
    preTrackedEntityId?: string | null;
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  }
): Promise<EntityMatchResult | null> {
  if (!workspaceId) return null;

  const dedupeBase = adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId);
  const cleanEmail = params.email?.toLowerCase().trim() || null;
  const cleanPhone = params.phone?.trim() || null;
  const cleanName = params.name?.trim() || null;
  const preTrackedId = params.preTrackedEntityId?.trim() || null;

  // Layer 1: Check Pre-Tracked Entity ID (from trackingToken, ref, respondentEntityId)
  if (preTrackedId && !preTrackedId.includes(':') && !preTrackedId.startsWith('usr_')) {
    // Check in workspace_entities
    const weSnap = await dedupeBase.where('entityId', '==', preTrackedId).limit(1).get();
    if (!weSnap.empty) {
      const data = weSnap.docs[0].data();
      return {
        entityId: data.entityId || preTrackedId,
        entityName: data.displayName || data.primaryName || '',
        entityContacts: data.contacts || [],
        matchedBy: 'tracked_id',
        existingEntityDoc: data,
      };
    }
    // Check direct entities collection
    const entSnap = await adminDb.collection('entities').doc(preTrackedId).get();
    if (entSnap.exists) {
      const data = entSnap.data();
      const wsIds: string[] = data?.workspaceIds || [];
      if (wsIds.includes(workspaceId) || wsIds.length === 0) {
        return {
          entityId: entSnap.id,
          entityName: data?.name || '',
          entityContacts: data?.entityContacts || [],
          matchedBy: 'tracked_id',
          existingEntityDoc: data,
        };
      }
    }
  }

  // Layer 2: Match by Primary Email in workspace_entities
  if (cleanEmail) {
    const emailSnap = await dedupeBase.where('primaryEmail', '==', cleanEmail).limit(1).get();
    if (!emailSnap.empty) {
      const data = emailSnap.docs[0].data();
      return {
        entityId: data.entityId,
        entityName: data.displayName || data.primaryName || '',
        entityContacts: data.contacts || [],
        matchedBy: 'primary_email',
        existingEntityDoc: data,
      };
    }
  }

  // Layer 3: Match by Primary Phone in workspace_entities
  if (cleanPhone) {
    const phoneSnap = await dedupeBase.where('primaryPhone', '==', cleanPhone).limit(1).get();
    if (!phoneSnap.empty) {
      const data = phoneSnap.docs[0].data();
      return {
        entityId: data.entityId,
        entityName: data.displayName || data.primaryName || '',
        entityContacts: data.contacts || [],
        matchedBy: 'primary_phone',
        existingEntityDoc: data,
      };
    }
  }

  // Layer 4: Deep Search in `entities` for secondary contact email or phone
  if (cleanEmail || cleanPhone) {
    try {
      const entitiesQuery = adminDb.collection('entities').where('workspaceIds', 'array-contains', workspaceId);
      const allEntsSnap = await entitiesQuery.limit(50).get();
      for (const doc of allEntsSnap.docs) {
        const entData = doc.data();
        const contacts: EntityContact[] = entData.entityContacts || [];
        for (const c of contacts) {
          if (cleanEmail && c.email && c.email.toLowerCase().trim() === cleanEmail) {
            return {
              entityId: doc.id,
              entityName: entData.name || '',
              entityContacts: contacts,
              matchedBy: 'contact_email',
              existingEntityDoc: entData,
            };
          }
          if (cleanPhone && c.phone && c.phone.trim() === cleanPhone) {
            return {
              entityId: doc.id,
              entityName: entData.name || '',
              entityContacts: contacts,
              matchedBy: 'contact_phone',
              existingEntityDoc: entData,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[survey-actions] Secondary contact scan failed:', err);
    }
  }

  // Layer 5: Match by Display Name in workspace_entities
  if (cleanName && cleanName.length > 2 && !cleanName.startsWith('[Placeholder]')) {
    const nameSnap = await dedupeBase.where('displayName', '==', cleanName).limit(1).get();
    if (!nameSnap.empty) {
      const data = nameSnap.docs[0].data();
      return {
        entityId: data.entityId,
        entityName: data.displayName || data.primaryName || '',
        entityContacts: data.contacts || [],
        matchedBy: 'display_name',
        existingEntityDoc: data,
      };
    }
  }

  return null;
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
      // Guard workspaceId — never fall back to 'default' for entity writes
      workspaceId = surveyData.workspaceIds?.[0] || '';
    }

    // 3. Transform to Entity/Lead if enabled (Task 12)
    let finalEntityId = responseData.entityId || null;
    let finalEntityName = '';
    let finalContactName = '';
    let existingMatch: EntityMatchResult | null = null;

    // ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
    // Lead Capture Precedence Resolution:
    // If `leadCaptureMode` is 'form' (CAPTURE WITH LEAD FORM), defer entity creation to `submitPublicSurveyLead`.
    // Only run question mapping in `submitPublicSurveyResponse` when `leadCaptureMode` is 'questions'.
    const hasLeadFormConfig = Boolean(
      surveyData?.leadCaptureFieldsConfig?.name?.show ||
      surveyData?.leadCaptureFieldsConfig?.email?.show ||
      surveyData?.leadCaptureFieldsConfig?.phone?.show ||
      surveyData?.leadCaptureFieldsConfig?.company?.show
    );
    const activeLeadMode = surveyData?.leadCaptureMode || (hasLeadFormConfig ? 'form' : 'questions');
    const isFormMode = surveyData?.createEntity && activeLeadMode === 'form';

    if (surveyData && surveyData.createEntity && surveyData.entityMapping && !isFormMode) {
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

        const rawEName = getAnswerValue(mapping.entityNameFieldId);
        const rawCName = getAnswerValue(mapping.contactNameFieldId);
        const eName = isGenericChoiceValue(rawEName) ? null : String(rawEName ?? '');
        const cName = isGenericChoiceValue(rawCName) ? null : String(rawCName ?? '');
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
                if (!isGenericChoiceValue(val)) overriddenEntityName = String(val);
              } else if (m.targetField === 'contacts.name') {
                if (!isGenericChoiceValue(val)) overriddenContactName = String(val);
              } else if (m.targetField === 'contacts.email') {
                overriddenContactEmail = String(val);
              } else if (m.targetField === 'contacts.phone') {
                overriddenContactPhone = String(val);
              }
            }
          });
        }

        // Get workspace scope, contact policy, and industry
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        const wsData = wsSnap.data();
        const contactScope = (wsData?.contactScope || 'institution') as EntityType;
        const contactPolicy: ContactIdentifierPolicy = wsData?.contactPolicy || 'phone_or_email';

        const { industry: workspaceIndustry } = await getWorkspaceIndustry(workspaceId);

        // Accept entity.name OR contact.name as the entity name source
        const resolvedName = overriddenEntityName || eName || cName || '';
        finalEntityName = resolvedName || (cEmail || cPhone ? `[Placeholder] ${cEmail || cPhone}` : '');
        
        const resolvedEmail = (overriddenContactEmail || cEmail ? String(overriddenContactEmail || cEmail).toLowerCase().trim() : '') || '';
        const resolvedPhone = (overriddenContactPhone || cPhone ? String(overriddenContactPhone || cPhone).trim() : '') || '';

        // Validate contact identifiers per workspace policy
        const policyCheck = validateContactIdentifier(resolvedPhone, resolvedEmail, contactPolicy);

        if (finalEntityName && policyCheck.valid) {
          // Resolve entity defaults chain: system → org → workspace survey defaults → workspace entity defaults
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
          
          const resolvedDefaults = { ...systemDefaults, ...orgDefaults, ...wsSurveyDefaults, ...wsEntityDefaults };

          if (contactScope === 'person' && Object.keys(mappedInstitutionData).length > 0) {
            console.warn(`[survey-actions] institutionData mappings ignored — workspace contactScope is "person"`);
          }
          if (contactScope === 'institution' && Object.keys(mappedPersonData).length > 0 && Object.keys(mappedInstitutionData).length === 0) {
            console.warn(`[survey-actions] personData mappings on institution workspace — will be passed as personData`);
          }

          let industryDataPayload: Record<string, unknown> | undefined;
          if (workspaceIndustry) {
            const industryDefaults = buildIndustryDefaults(workspaceIndustry, contactScope, resolvedDefaults);
            const surveyMapped = contactScope === 'institution' ? mappedInstitutionData : mappedPersonData;

            industryDataPayload = {
              industry: workspaceIndustry,
              ...industryDefaults,
              ...surveyMapped,
            };
          }

          finalContactName = overriddenContactName || cName || finalEntityName;

          const entityPayload: EntityMutationPayload = {
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

          if (industryDataPayload) {
            entityPayload.industryData = industryDataPayload;
          }
          if (contactScope === 'person' && Object.keys(mappedPersonData).length > 0) {
            entityPayload.personData = mappedPersonData;
          }
          if (Object.keys(mappedCustomData).length > 0) {
            entityPayload.customData = mappedCustomData;
          }

          // Multi-Layered Deduplication / Entity Recognition
          existingMatch = await resolveOrMatchWorkspaceEntity(workspaceId, {
            preTrackedEntityId: responseData.entityId || responseData.assignedUserId || null,
            email: resolvedEmail,
            phone: resolvedPhone,
            name: finalEntityName,
          });

          if (existingMatch) {
            // Match found → Update existing entity safely via sanitizeEntityPayloadForUpdate
            finalEntityId = existingMatch.entityId;

            const safePayload = await sanitizeEntityPayloadForUpdate(entityPayload, {
              isExistingEntity: true,
              isExplicitlyMapped: Boolean(overriddenEntityName),
              isManualInput: false,
              existingEntityName: existingMatch.entityName || null,
            });

            await updateEntityAction(
              finalEntityId,
              safePayload,
              'system-survey',
              workspaceId,
              organizationId
            );
          } else {
            // No match → Create new entity
            const createRes = await createEntityAction(
              entityPayload,
              'system-survey',
              workspaceId,
              contactScope,
              organizationId
            );
            if (createRes.success) {
              finalEntityId = createRes.id;
            } else if (createRes.isDuplicate && createRes.duplicates && createRes.duplicates.length > 0) {
              // Graceful duplicate fallback
              const duplicate = createRes.duplicates[0];
              const targetEntityId = duplicate.entityId.replace(`${workspaceId}_`, '');
              finalEntityId = targetEntityId;

              const safePayload = await sanitizeEntityPayloadForUpdate(entityPayload, {
                isExistingEntity: true,
                isExplicitlyMapped: Boolean(overriddenEntityName),
                isManualInput: false,
                existingEntityName: duplicate.name || null,
              });

              await updateEntityAction(
                targetEntityId,
                safePayload,
                'system-survey',
                workspaceId,
                organizationId
              );
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

            // Log survey submission activity on the entity's CRM timeline
            after(async () => {
              try {
                await logActivity({
                  organizationId,
                  workspaceId,
                  entityId: finalEntityId!,
                  entityType: contactScope,
                  type: 'survey_submission',
                  title: `Completed Survey: ${surveyData!.title}`,
                  details: `Respondent completed survey "${surveyData!.title}"${responseData.score !== undefined ? ` with score ${responseData.score}` : ''}.`,
                  metadata: {
                    surveyId,
                    surveyTitle: surveyData!.title,
                    submissionId: docRef.id,
                    score: responseData.score || null,
                    isExistingEntity: Boolean(existingMatch),
                    matchedBy: existingMatch?.matchedBy || 'new_entity',
                    skipAutomationTrigger: true,
                  },
                });
              } catch (err) {
                console.error('[survey-actions] Failed to log survey submission activity:', err);
              }
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

            // Pipeline Routing Automation Execution (Outcome Rules & Workbench Automations)
            if (surveyData) {
              const score = responseData.score !== undefined ? responseData.score : 0;
              const maxScore = surveyData.maxScore || 100;
              const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

              // 1. Evaluate score outcome rules
              let matchedRulePipelineAction: { pipelineId: string; stageId: string; label?: string } | null = null;
              if (surveyData.scoringEnabled && surveyData.resultRules?.length) {
                const sortedRules = [...surveyData.resultRules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
                const matchedRule = sortedRules.find((r) => score >= (r.minScore || 0) && score <= (r.maxScore || 0));
                if (matchedRule?.pipelineEnabled && matchedRule.pipelineId && matchedRule.pipelineStageId) {
                  matchedRulePipelineAction = {
                    pipelineId: matchedRule.pipelineId,
                    stageId: matchedRule.pipelineStageId,
                    label: matchedRule.label,
                  };
                }
              }

              // 2. Evaluate Workbench Pipeline Automation
              let workbenchPipelineAction: { pipelineId: string; stageId: string } | null = null;
              if (surveyData.autoPipelineEnabled && surveyData.autoPipelineId && surveyData.autoPipelineStageId) {
                const mode = surveyData.autoPipelineMode || 'fallback';
                if (mode === 'fallback') {
                  if (!matchedRulePipelineAction) {
                    workbenchPipelineAction = {
                      pipelineId: surveyData.autoPipelineId,
                      stageId: surveyData.autoPipelineStageId,
                    };
                  }
                } else if (mode === 'additional') {
                  workbenchPipelineAction = {
                    pipelineId: surveyData.autoPipelineId,
                    stageId: surveyData.autoPipelineStageId,
                  };
                }
              }

              const scoreDetailsPayload = {
                score,
                maxScore,
                percentage,
                submittedAt: new Date().toISOString(),
                surveyTitle: surveyData.title,
                responseId: docRef.id,
              };

              // Wrap pipeline routing execution in Next.js after() for non-blocking <50ms response speed
              after(async () => {
                try {
                  // Execute Matched Result Rule Pipeline Action
                  if (matchedRulePipelineAction) {
                    await addOrMoveEntityInPipeline({
                      entityId: finalEntityId,
                      entityName: finalEntityName,
                      workspaceId,
                      organizationId,
                      pipelineId: matchedRulePipelineAction.pipelineId,
                      stageId: matchedRulePipelineAction.stageId,
                      scoreDetails: {
                        ...scoreDetailsPayload,
                        label: matchedRulePipelineAction.label,
                      },
                    }).catch((err) => console.error('[survey-actions] Outcome rule pipeline action error:', err));
                  }

                  // Execute Workbench Pipeline Action
                  if (workbenchPipelineAction) {
                    // Avoid redundant execution if workbench points to exact same pipeline & stage as outcome rule
                    if (
                      !matchedRulePipelineAction ||
                      matchedRulePipelineAction.pipelineId !== workbenchPipelineAction.pipelineId ||
                      matchedRulePipelineAction.stageId !== workbenchPipelineAction.stageId
                    ) {
                      await addOrMoveEntityInPipeline({
                        entityId: finalEntityId,
                        entityName: finalEntityName,
                        workspaceId,
                        organizationId,
                        pipelineId: workbenchPipelineAction.pipelineId,
                        stageId: workbenchPipelineAction.stageId,
                        scoreDetails: {
                          ...scoreDetailsPayload,
                          label: 'Workbench Automations',
                        },
                      }).catch((err) => console.error('[survey-actions] Workbench pipeline action error:', err));
                    }
                  }
                } catch (bgError) {
                  console.error('[survey-actions] Background pipeline routing error:', bgError);
                }
              });
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
      let matchedRule: SurveyResultRule | undefined;
      const score = responseData.score !== undefined ? responseData.score : 0;
      if (surveyData.scoringEnabled && surveyData.resultRules?.length) {
        const sortedRules = [...surveyData.resultRules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
        matchedRule = sortedRules.find((r) => score >= (r.minScore || 0) && score <= (r.maxScore || 0));
      }

      const resultMsg = matchedRule?.message || matchedRule?.description || matchedRule?.title || matchedRule?.label || '';
      const resultTitle = matchedRule?.title || matchedRule?.label || surveyData.title || '';
      const resultDesc = matchedRule?.description || '';
      const outcomeLabel = matchedRule?.label || matchedRule?.title || '';

      // Persist outcome details on response document for auditability
      if (matchedRule || resultMsg || outcomeLabel) {
        await docRef.update({
          resultMessage: resultMsg || null,
          resultTitle: resultTitle || null,
          resultDescription: resultDesc || null,
          outcome: outcomeLabel || null,
          matchedRuleId: matchedRule?.id || null,
        }).catch((err) => console.warn('[survey-actions] Failed to persist outcome on response doc:', err));
      }

      let resolvedRespondentName = responseData.respondentName;
      if (!resolvedRespondentName && finalEntityId) {
        try {
          const contact = await resolveContact(finalEntityId, workspaceId);
          if (contact) {
            resolvedRespondentName = contact.name || contact.schoolData?.name;
          }
        } catch (e) {
          // ignore fallback
        }
      }
      if (!resolvedRespondentName) {
        resolvedRespondentName = finalContactName || finalEntityName || 'Respondent';
      }

      const getBaseUrl = () => process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const baseUrl = getBaseUrl();

      // Build question map for variable key alias resolution
      const questionMap = new Map<string, any>();
      if (Array.isArray(surveyData.elements)) {
        surveyData.elements.forEach((el: any) => {
          if (el && typeof el === 'object' && el.id) {
            questionMap.set(el.id, el);
            if (el.variableName) questionMap.set(el.variableName, el);
            if (el.fieldKey) questionMap.set(el.fieldKey, el);
            if (el.key) questionMap.set(el.key, el);
          }
        });
      }

      const answerVars: Record<string, string> = {};
      let respPhone = (responseData as any).contactPhone || (responseData as any).respondentPhone || '';
      let respEmail = (responseData as any).contactEmail || (responseData as any).respondentEmail || '';

      if (Array.isArray(responseData.answers)) {
        responseData.answers.forEach((ans: any) => {
          if (ans && ans.questionId) {
            const valStr = Array.isArray(ans.value) ? ans.value.join(', ') : String(ans.value ?? '');
            answerVars[ans.questionId] = valStr;

            const q = questionMap.get(ans.questionId);
            if (q) {
              if (q.variableName) {
                answerVars[q.variableName] = valStr;
                answerVars[`q_${q.variableName}`] = valStr;
                const bare = q.variableName.replace(/^q_/, '');
                answerVars[bare] = valStr;
                answerVars[`q_${bare}`] = valStr;
              }
              if (q.fieldKey) {
                answerVars[q.fieldKey] = valStr;
                answerVars[`q_${q.fieldKey}`] = valStr;
              }
              if (q.key) {
                answerVars[q.key] = valStr;
              }

              const qType = (q.type || '').toLowerCase();
              const qTitle = (q.title || '').toLowerCase();
              const qVar = (q.variableName || q.fieldKey || '').toLowerCase();

              if (!respPhone && (qType === 'phone' || qType === 'contact_phone' || qTitle.includes('phone') || qTitle.includes('contact number') || qVar.includes('phone'))) {
                respPhone = valStr;
              }
              if (!respEmail && (qType === 'email' || qType === 'contact_email' || qTitle.includes('email') || qVar.includes('email'))) {
                respEmail = valStr;
              }
            } else if (ans.questionId.startsWith('q_')) {
              answerVars[ans.questionId.substring(2)] = valStr;
            }
          }
        });
      }

      const notificationVars: Record<string, any> = {
        ...answerVars,
        ...((responseData as any).variables || {}),
        survey_title: surveyData.title,
        surveyTitle: surveyData.title,
        survey_id: surveyId,
        surveyId: surveyId,
        submission_id: docRef.id,
        submissionId: docRef.id,
        responseId: docRef.id,
        _surveyId: surveyId,
        _responseId: docRef.id,
        workspaceId,
        entityId: finalEntityId || '',
        score: responseData.score !== undefined ? responseData.score : 0,
        survey_score: responseData.score !== undefined ? responseData.score : 0,
        max_score: surveyData.maxScore || 100,
        maxScore: surveyData.maxScore || 100,
        respondent_name: resolvedRespondentName,
        respondentName: resolvedRespondentName,
        contact_name: resolvedRespondentName,
        contactName: resolvedRespondentName,
        entity_name: finalEntityName || resolvedRespondentName,
        entityName: finalEntityName || resolvedRespondentName,
        q_entity_name_input: answerVars.q_entity_name_input || finalEntityName || resolvedRespondentName,
        result_message: resultMsg,
        resultMessage: resultMsg,
        result_title: resultTitle,
        resultTitle: resultTitle,
        result_description: resultDesc,
        resultDescription: resultDesc,
        outcome_label: outcomeLabel,
        outcomeLabel: outcomeLabel,
        survey_result: resultTitle || resultMsg,
        survey_link: `${baseUrl}/surveys/${surveyData.slug || surveyId}`,
        surveyLink: `${baseUrl}/surveys/${surveyData.slug || surveyId}`,
        dashboard_url: `${baseUrl}/admin/surveys/${surveyId}/results`,
        dashboardUrl: `${baseUrl}/admin/surveys/${surveyId}/results`,
        submission_link: `${baseUrl}/admin/surveys/${surveyId}/results?submissionId=${docRef.id}`,
        submissionLink: `${baseUrl}/admin/surveys/${surveyId}/results?submissionId=${docRef.id}`,
      };

      if (respPhone) {
        notificationVars.contact_phone = respPhone;
        notificationVars.respondent_phone = respPhone;
        notificationVars.phone = respPhone;
      }
      if (respEmail) {
        notificationVars.contact_email = respEmail;
        notificationVars.respondent_email = respEmail;
        notificationVars.email = respEmail;
      }

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

        // 2. Workspace Validation & Permission Check
        const workspaceIds = data.workspaceIds || [];
        if (workspaceIds.length === 0 || workspaceIds.includes('onboarding') || workspaceIds.includes('generic')) {
            return { success: false, error: 'A survey must be associated with at least one valid workspace.' };
        }
        const workspaceId = workspaceIds[0];
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
    fieldFillSource?: Record<string, 'manual' | 'dynamic'>;
    [key: string]: unknown;
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

    // Deduplication Search & Pre-tracked Entity Resolution
    let preTrackedEntityId: string | null = responseData.entityId || null;
    if (!preTrackedEntityId && responseData.assignedUserId && !responseData.assignedUserId.includes(':')) {
      preTrackedEntityId = responseData.assignedUserId;
    }

    const existingMatch = await resolveOrMatchWorkspaceEntity(workspaceId, {
      preTrackedEntityId,
      email: cEmail,
      phone: cPhone,
      name: finalEntityName,
    });

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
    let isExplicitEntityNameMapped = Boolean(
      mapping.entityNameFieldId && getAnswerValue(mapping.entityNameFieldId)?.toString().trim()
    );

    if (mapping.additionalMappings?.length) {
      mapping.additionalMappings.forEach((m) => {
        const val = getAnswerValue(m.questionId);
        if (m.targetField === 'entity.name' && val && String(val).trim().length > 0) {
          isExplicitEntityNameMapped = true;
        }
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

    const fieldSources = (leadData.fieldFillSource as Record<string, 'manual' | 'dynamic'> | undefined) || {};
    const hasLeadFormName = Boolean((leadData.company || leadData.name)?.toString().trim());
    const isManualNameInput = fieldSources.name === 'manual' || fieldSources.company === 'manual' || hasLeadFormName;

    const entityPayload: EntityMutationPayload = {
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
    if (existingMatch) {
      finalEntityId = existingMatch.entityId;

      // Merge or append respondent contact into existing entity contacts
      const targetEntitySnap = await adminDb.collection('entities').doc(finalEntityId).get();
      const targetData = targetEntitySnap.data();
      const existingContacts: EntityContact[] = targetData?.entityContacts || existingMatch.entityContacts || [];

      let contactExists = false;
      const mergedContacts = [...existingContacts];

      for (let i = 0; i < mergedContacts.length; i++) {
        const ec = mergedContacts[i];
        const emailMatch = cEmail && ec.email && ec.email.toLowerCase().trim() === cEmail;
        const phoneMatch = cPhone && ec.phone && ec.phone.trim() === cPhone;

        if (emailMatch || phoneMatch) {
          mergedContacts[i] = {
            ...ec,
            name: isManualNameInput ? (leadData.name || ec.name || finalEntityName) : (ec.name || leadData.name || finalEntityName),
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
          isPrimary: mergedContacts.length === 0,
          isSignatory: false,
          typeKey: resolvedDefaults.contactTypeKey,
          typeLabel: resolvedDefaults.contactTypeKey === 'primary' ? 'Primary' : 'Other',
          order: mergedContacts.length,
          updatedAt: new Date().toISOString()
        });
      }

      entityPayload.entityContacts = mergedContacts;
      delete entityPayload.contacts;

      // ENTITY IDENTITY GUARD: When updating a pre-existing entity, lock entity name
      // unless explicitly typed by the user (manual) or explicitly mapped to `entity.name`.
      const safePayload = await sanitizeEntityPayloadForUpdate(entityPayload, {
        isExistingEntity: true,
        isExplicitlyMapped: isExplicitEntityNameMapped,
        isManualInput: isManualNameInput,
        existingEntityName: existingMatch.entityName || targetData?.name || null,
      });

      await updateEntityAction(
        finalEntityId!,
        safePayload,
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
        const existingData = entitySnap.data();
        const existingContacts: EntityContact[] = existingData?.entityContacts || [];
        
        let contactExists = false;
        const mergedContacts = [...existingContacts];
        
        for (let i = 0; i < mergedContacts.length; i++) {
          const ec = mergedContacts[i];
          const emailMatch = cEmail && ec.email && ec.email.toLowerCase().trim() === cEmail;
          const phoneMatch = cPhone && ec.phone && ec.phone.trim() === cPhone;
          
          if (emailMatch || phoneMatch) {
            mergedContacts[i] = {
              ...ec,
              name: isManualNameInput ? (leadData.name || ec.name || finalEntityName) : (ec.name || leadData.name || finalEntityName),
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

        // ENTITY IDENTITY GUARD for duplicate matches via sanitizeEntityPayloadForUpdate
        const safePayload = await sanitizeEntityPayloadForUpdate(entityPayload, {
          isExistingEntity: true,
          isExplicitlyMapped: isExplicitEntityNameMapped,
          isManualInput: isManualNameInput,
          existingEntityName: existingData?.name || duplicate.name || null,
        });
        
        await updateEntityAction(
          targetEntityId,
          safePayload,
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

      // Log lead capture activity on the entity's CRM timeline
      after(async () => {
        try {
          await logActivity({
            organizationId,
            workspaceId,
            entityId: finalEntityId!,
            entityType: contactScope,
            type: 'survey_submission',
            title: `Claimed Results for Survey: ${surveyData.title}`,
            details: `Lead captured for survey "${surveyData.title}" (${leadData.name || leadData.email || 'Anonymous'}).`,
            metadata: {
              surveyId,
              surveyTitle: surveyData.title,
              submissionId: responseId,
              outcomeId: outcomeId || null,
              leadName: leadData.name || null,
              leadEmail: leadData.email || null,
              leadPhone: leadData.phone || null,
              isExistingEntity: Boolean(existingMatch),
              matchedBy: existingMatch?.matchedBy || 'new_entity',
              skipAutomationTrigger: true,
            },
          });
        } catch (err) {
          console.error('[survey-actions] Failed to log lead capture activity:', err);
        }
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
    const surveyData = { id: surveySnap.id, ...surveySnap.data() } as Survey;
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

    let finalEntityId = responseData.entityId || null;
    let existingMatch: EntityMatchResult | null = null;
    if (!finalEntityId && (respondentEmail || respondentPhone)) {
      existingMatch = await resolveOrMatchWorkspaceEntity(workspaceId, {
        email: respondentEmail ? String(respondentEmail) : null,
        phone: respondentPhone ? String(respondentPhone) : null,
      });
      if (existingMatch) {
        finalEntityId = existingMatch.entityId;
        await responseRef.update({ entityId: finalEntityId });
      }
    }

    if (finalEntityId) {
      after(async () => {
        try {
          await logActivity({
            organizationId,
            workspaceId,
            entityId: finalEntityId!,
            entityType: 'institution',
            type: 'survey_submission',
            title: `Completed Survey: ${surveyData.title}`,
            details: `Respondent completed survey "${surveyData.title}"${responseData.score !== undefined ? ` with score ${responseData.score}` : ''}.`,
            metadata: {
              surveyId,
              surveyTitle: surveyData.title,
              submissionId: responseId,
              outcomeId: outcomeId || responseData.outcomeId || null,
              score: responseData.score || null,
              isExistingEntity: Boolean(existingMatch || responseData.entityId),
              matchedBy: existingMatch?.matchedBy || (responseData.entityId ? 'tracked_id' : 'new_entity'),
              skipAutomationTrigger: true,
            },
          });
        } catch (err) {
          console.error('[survey-actions] Failed to log survey submission activity in finalizeSurveySubmission:', err);
        }
      });
    }

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
        finalEntityId,
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
  let matchedRule: SurveyResultRule | undefined;
  if (outcomeId) {
    matchedRule = surveyData.resultRules?.find(r => r.id === outcomeId);
  } else if (surveyData.scoringEnabled && surveyData.resultRules?.length && responseData.score !== undefined) {
    const score = responseData.score;
    const sortedRules = [...surveyData.resultRules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    matchedRule = sortedRules.find((r) => score >= (r.minScore || 0) && score <= (r.maxScore || 0));
  }

  const resultMsg = matchedRule?.message || matchedRule?.description || matchedRule?.title || matchedRule?.label || '';
  const resultTitle = matchedRule?.title || matchedRule?.label || surveyData.title || '';
  const resultDesc = matchedRule?.description || '';
  const outcomeLabel = matchedRule?.label || matchedRule?.title || '';

  let resolvedRespondentName = responseData.respondentName;
  if (!resolvedRespondentName && entityId) {
    try {
      const contact = await resolveContact(entityId, workspaceId);
      if (contact) {
        resolvedRespondentName = contact.name || contact.schoolData?.name;
      }
    } catch (e) {
      // ignore
    }
  }
  if (!resolvedRespondentName) {
    resolvedRespondentName = 'Respondent';
  }

  const getBaseUrl = () => process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const baseUrl = getBaseUrl();

  const notificationVars: Record<string, string | number> = {
    ...responseData.answers.reduce((acc, ans) => ({
      ...acc,
      [ans.questionId]: Array.isArray(ans.value) ? ans.value.join(', ') : String(ans.value)
    }), {}),
    survey_title: surveyData.title,
    surveyTitle: surveyData.title,
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
    maxScore: surveyData.maxScore || 100,
    respondent_name: resolvedRespondentName,
    respondentName: resolvedRespondentName,
    contact_name: resolvedRespondentName,
    contactName: resolvedRespondentName,
    result_message: resultMsg,
    resultMessage: resultMsg,
    result_title: resultTitle,
    resultTitle: resultTitle,
    result_description: resultDesc,
    resultDescription: resultDesc,
    outcome_label: outcomeLabel,
    outcomeLabel: outcomeLabel,
    survey_result: resultTitle || resultMsg,
    survey_link: `${baseUrl}/surveys/${surveyData.slug || surveyData.id}`,
    surveyLink: `${baseUrl}/surveys/${surveyData.slug || surveyData.id}`,
    dashboard_url: `${baseUrl}/admin/surveys/${surveyData.id}/results`,
    dashboardUrl: `${baseUrl}/admin/surveys/${surveyData.id}/results`,
    submission_link: `${baseUrl}/admin/surveys/${surveyData.id}/results?submissionId=${responseId}`,
    submissionLink: `${baseUrl}/admin/surveys/${surveyData.id}/results?submissionId=${responseId}`,
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
    const surveyData = { id: surveySnap.id, ...surveySnap.data() } as Survey;
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

export async function logSurveyStartedAction(params: {
  surveyId: string;
  entityId: string;
  contactEmail?: string | null;
  workspaceId: string;
  organizationId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { surveyId, entityId, contactEmail, workspaceId, organizationId } = params;
  try {
    const surveySnap = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveySnap.exists) {
      return { success: false, error: 'Survey not found' };
    }
    const surveyData = { id: surveySnap.id, ...surveySnap.data() } as Survey;

    await logActivity({
      entityId: entityId || undefined,
      organizationId,
      workspaceId,
      userId: 'anonymous',
      type: 'survey_started',
      source: 'public_survey',
      description: `Survey "${surveyData.title}" started`,
      metadata: {
        surveyId,
        surveyTitle: surveyData.title,
        contactEmail: contactEmail || null
      }
    });
    
    return { success: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown survey start log failure';
    console.error('[logSurveyStartedAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

export interface PipelineRouteParams {
  entityId: string;
  entityName?: string | null;
  workspaceId: string;
  organizationId: string;
  pipelineId: string;
  stageId: string;
  scoreDetails: {
    score: number;
    maxScore: number;
    label?: string;
    percentage?: number;
    submittedAt: string;
    surveyTitle: string;
    responseId: string;
  };
}

export async function addOrMoveEntityInPipeline(params: PipelineRouteParams): Promise<{ success: boolean; dealId?: string; action?: 'created' | 'moved'; error?: string }> {
  try {
    const { entityId, entityName, workspaceId, organizationId, pipelineId, stageId, scoreDetails } = params;
    if (!entityId || !workspaceId || !pipelineId || !stageId) {
      return { success: false, error: 'Missing required parameters for pipeline routing' };
    }

    // 1. Resolve target stageName from onboardingStages
    let stageName: string | undefined;
    try {
      const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
      if (stageSnap.exists) {
        stageName = stageSnap.data()?.name as string | undefined;
      }
    } catch (e) {
      console.warn('[survey-actions] Failed to fetch stageName:', e);
    }

    // Format score details summary cleanly (plain text)
    const scoreStr = `${scoreDetails.score}/${scoreDetails.maxScore}`;
    const pctStr = scoreDetails.percentage !== undefined ? ` (${scoreDetails.percentage}%)` : '';
    const outcomeLabelStr = scoreDetails.label ? ` | Outcome: "${stripHtml(scoreDetails.label)}"` : '';
    const formattedScoreSummary = `Score: ${scoreStr}${pctStr}${outcomeLabelStr} | Submitted: ${scoreDetails.submittedAt} | Survey: "${stripHtml(scoreDetails.surveyTitle)}"`;

    // 2. Query open deal for this entity in the targeted workspace & pipeline
    const dealsSnap = await adminDb
      .collection('deals')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'open')
      .where('pipelineId', '==', pipelineId)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();

    if (!dealsSnap.empty) {
      // 3. Open deal found → Move stage and update score details
      const existingDealDoc = dealsSnap.docs[0];
      const existingData = existingDealDoc.data();
      const dealId = existingDealDoc.id;

      const existingDescription = existingData.description || '';
      const updatedDescription = existingDescription
        ? `${existingDescription}\n\n[Survey Score Update - ${new Date().toLocaleDateString()}]\n${formattedScoreSummary}`
        : `[Survey Score Summary]\n${formattedScoreSummary}`;

      const updatePayload: Record<string, unknown> = {
        stageId,
        ...(stageName ? { stageName } : {}),
        description: updatedDescription,
        updatedAt: new Date().toISOString(),
        'customFields.lastSurveyScore': scoreDetails.score,
        'customFields.lastSurveyScoreDetails': formattedScoreSummary,
      };

      await adminDb.collection('deals').doc(dealId).update(updatePayload);

      // Record CRM activity timeline event for deal stage movement
      await logActivity({
        entityId,
        workspaceId,
        organizationId: organizationId || 'default',
        userId: 'system-survey',
        type: 'deal_stage_changed',
        source: 'survey_pipeline_routing',
        description: `Deal "${existingData.name || 'Open Deal'}" moved to stage "${stageName || stageId}" via survey outcome`,
        metadata: {
          dealId,
          pipelineId,
          stageId,
          score: scoreDetails.score,
          responseId: scoreDetails.responseId,
        },
      }).catch((err) => console.error('[survey-actions] Activity log for deal stage move failed:', err));

      return { success: true, dealId, action: 'moved' };
    } else {
      // 4. No open deal found → Create a new deal in the targeted pipeline & stage
      const resolvedName = entityName ? `[Lead] ${entityName} - ${stripHtml(scoreDetails.surveyTitle)}` : `Survey Lead - ${stripHtml(scoreDetails.surveyTitle)}`;

      const createRes = await createDeal({
        entityId,
        workspaceId,
        organizationId: organizationId || 'default',
        pipelineId,
        stageId,
        name: resolvedName,
        value: 0,
        description: `[Survey Score Summary]\n${formattedScoreSummary}`,
        suppressAutomations: true,
      });

      if (createRes.error) {
        return { success: false, error: createRes.error };
      }

      return { success: true, dealId: createRes.id, action: 'created' };
    }
  } catch (error) {
    console.error('[survey-actions] addOrMoveEntityInPipeline Error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
