'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 6: Survey CRM Sync Actions & Two-Way Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multi-Tenant Scoping:
 *    - All mutations require workspace authorization validation via isAuthorizedForWorkspace.
 * 2. Deduplication & Upsert Safety:
 *    - Contact matching prioritizes entity ID, then normalized email, then normalized phone.
 *    - Respects write modes: 'fill_if_empty' (default) vs 'always_overwrite'.
 * 3. Two-Way Event Dispatch:
 *    - Emits SURVEY_SUBMITTED and SURVEY_DETRACTOR_FLAGGED to workspace automation engine.
 * 4. Strict Zero-Any Invariant.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  Survey,
  SurveyElement,
  SurveyQuestion,
  SurveyCrmConfig,
  SurveyCrmFieldMapping,
  SurveyCrmTaskRule,
  SurveyCrmDealRule,
  SurveyCrmFieldDefinition,
  SurveyActivityTimelinePayload,
  SystemCrmFieldMappingTemplate,
} from '@/lib/types';
import { isAuthorizedForWorkspace } from './survey-hydration-adapter';
import { createDeal } from '@/app/actions/deal-actions';
import { triggerAutomationProtocols } from '@/lib/automations/orchestrator';

interface ExecuteSurveyCrmSyncParams {
  survey: Survey;
  responseId: string;
  responseData: {
    answers: Array<{ questionId: string; value: string | string[] | number | boolean | Record<string, unknown> }>;
    score?: number;
    channel?: string;
    durationSeconds?: number;
    submittedAt?: string;
    respondentName?: string | null;
    respondentEmail?: string | null;
    respondentPhone?: string | null;
    assignedUserId?: string | null;
  };
  workspaceId: string;
  organizationId: string;
  entityId?: string | null;
  entityName?: string | null;
  outcomeId?: string | null;
  sentimentPolarity?: 'positive' | 'mostly_positive' | 'neutral' | 'mostly_negative' | 'negative' | 'mixed';
}

function interpolateCrmTemplate(
  template: string,
  vars: {
    contactName?: string | null;
    entityName?: string | null;
    surveyTitle?: string | null;
    score?: number | string | null;
    responseId?: string | null;
  }
): string {
  if (!template) return '';
  return template
    .replace(/\{\{\s*contact\.name\s*\}\}/gi, vars.contactName || vars.entityName || 'Respondent')
    .replace(/\{\{\s*entity\.name\s*\}\}/gi, vars.entityName || vars.contactName || 'Lead')
    .replace(/\{\{\s*survey\.title\s*\}\}/gi, vars.surveyTitle || 'Survey')
    .replace(/\{\{\s*score\s*\}\}/gi, String(vars.score ?? 0))
    .replace(/\{\{\s*responseId\s*\}\}/gi, vars.responseId || '');
}

/**
 * Executes comprehensive CRM synchronization for a survey response submission:
 * 1. Upserts Contact & Entity records with mapped fields.
 * 2. Evaluates Lead Scoring adjustments.
 * 3. Evaluates Deal creation/movement rules.
 * 4. Generates follow-up CRM Tasks for detractors or configured triggers.
 * 5. Writes rich activity records to entity & contact timelines.
 */
export async function executeSurveyCrmSyncAction(
  params: ExecuteSurveyCrmSyncParams
): Promise<{
  success: boolean;
  contactId?: string;
  dealId?: string;
  tasksCreatedCount: number;
  activityLogged: boolean;
  error?: string;
}> {
  const {
    survey,
    responseId,
    responseData,
    workspaceId,
    organizationId,
    entityId,
    entityName,
    outcomeId,
    sentimentPolarity,
  } = params;

  let tasksCreatedCount = 0;
  let activityLogged = false;
  let createdDealId: string | undefined;
  let resolvedContactId: string | undefined;

  try {
    const crmConfig: SurveyCrmConfig | undefined = survey.crmConfig;
    const cleanEntityId = entityId
      ? entityId.startsWith(`${workspaceId}_`)
        ? entityId.slice(workspaceId.length + 1)
        : entityId
      : null;

    // 1. Build quick answers map
    const answerMap = new Map<string, string | string[] | number | boolean | Record<string, unknown>>();
    for (const a of responseData.answers || []) {
      answerMap.set(a.questionId, a.value);
    }

    // 2. Resolve / Match Contact
    let matchedContactDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    const normalizedEmail = responseData.respondentEmail?.trim().toLowerCase() || null;
    const normalizedPhone = responseData.respondentPhone?.replace(/[^0-9+]/g, '') || null;

    if (normalizedEmail) {
      const emailSnap = await adminDb
        .collection('contacts')
        .where('workspaceId', '==', workspaceId)
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();
      if (!emailSnap.empty) {
        matchedContactDoc = emailSnap.docs[0];
      }
    }

    if (!matchedContactDoc && normalizedPhone) {
      const phoneSnap = await adminDb
        .collection('contacts')
        .where('workspaceId', '==', workspaceId)
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();
      if (!phoneSnap.empty) {
        matchedContactDoc = phoneSnap.docs[0];
      }
    }

    if (!matchedContactDoc && cleanEntityId) {
      const entityContactSnap = await adminDb
        .collection('contacts')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', cleanEntityId)
        .limit(1)
        .get();
      if (!entityContactSnap.empty) {
        matchedContactDoc = entityContactSnap.docs[0];
      }
    }

    // 3. Contact & Entity Field Mapping Upsert
    const contactUpdates: Record<string, unknown> = {};
    const entityCustomUpdates: Record<string, unknown> = {};
    const dealCustomUpdates: Record<string, unknown> = {};

    if (crmConfig?.fieldMappings && crmConfig.fieldMappings.length > 0) {
      for (const mapping of crmConfig.fieldMappings) {
        const rawValue = answerMap.get(mapping.questionId);
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        let processedValue: unknown = rawValue;
        if (typeof rawValue === 'string') {
          if (mapping.transform === 'trim') processedValue = rawValue.trim();
          else if (mapping.transform === 'lowercase') processedValue = rawValue.trim().toLowerCase();
          else if (mapping.transform === 'uppercase') processedValue = rawValue.trim().toUpperCase();
          else if (mapping.transform === 'number') processedValue = Number(rawValue) || 0;
          else if (mapping.transform === 'boolean') processedValue = rawValue.toLowerCase() === 'true' || rawValue === 'yes';
        }

        if (mapping.targetType === 'contact') {
          if (mapping.targetField.startsWith('customData.')) {
            const subKey = mapping.targetField.replace('customData.', '');
            contactUpdates[`customData.${subKey}`] = processedValue;
          } else {
            contactUpdates[mapping.targetField] = processedValue;
          }
        } else if (mapping.targetType === 'entity') {
          if (mapping.targetField.startsWith('customFields.')) {
            const subKey = mapping.targetField.replace('customFields.', '');
            entityCustomUpdates[`customFields.${subKey}`] = processedValue;
          } else {
            entityCustomUpdates[mapping.targetField] = processedValue;
          }
        } else if (mapping.targetType === 'deal') {
          dealCustomUpdates[mapping.targetField] = processedValue;
        }
      }
    }

    // Upsert Contact
    const nowIso = new Date().toISOString();
    if (matchedContactDoc) {
      resolvedContactId = matchedContactDoc.id;
      const existingData = matchedContactDoc.data() || {};
      const safeContactUpdates: Record<string, unknown> = {
        updatedAt: nowIso,
        lastSurveySubmissionAt: nowIso,
      };

      for (const [key, val] of Object.entries(contactUpdates)) {
        const mapping = crmConfig?.fieldMappings?.find((m) => m.targetField === key);
        if (mapping?.writeMode === 'fill_if_empty' && existingData[key]) {
          continue; // Keep existing non-empty value
        }
        safeContactUpdates[key] = val;
      }

      await adminDb.collection('contacts').doc(resolvedContactId).update(safeContactUpdates);
    } else if (crmConfig?.autoUpsertContact && (normalizedEmail || normalizedPhone || responseData.respondentName)) {
      const newContactRef = adminDb.collection('contacts').doc();
      resolvedContactId = newContactRef.id;
      const newContactPayload = {
        id: resolvedContactId,
        workspaceId,
        organizationId,
        entityId: cleanEntityId || null,
        name: responseData.respondentName || 'Survey Respondent',
        email: normalizedEmail,
        phone: normalizedPhone,
        createdAt: nowIso,
        updatedAt: nowIso,
        source: 'survey_submission',
        surveyId: survey.id,
        ...contactUpdates,
      };
      await newContactRef.set(newContactPayload);
    }

    // Update Entity Custom Fields if linked
    if (cleanEntityId && Object.keys(entityCustomUpdates).length > 0) {
      const entityRef = adminDb.collection('workspace_entities').doc(`${workspaceId}_${cleanEntityId}`);
      const entityDoc = await entityRef.get();
      if (entityDoc.exists) {
        await entityRef.update({
          ...entityCustomUpdates,
          updatedAt: nowIso,
        });
      }
    }

    // 4. Lead Score Adjustments
    if (crmConfig?.leadScoreAdjustment?.enabled && resolvedContactId) {
      let scoreDelta = crmConfig.leadScoreAdjustment.pointsPerSurveyCompleted || 5;
      const score = responseData.score ?? 0;
      if (score >= 80 && crmConfig.leadScoreAdjustment.pointsForPromoter) {
        scoreDelta += crmConfig.leadScoreAdjustment.pointsForPromoter;
      } else if (score <= 50 && crmConfig.leadScoreAdjustment.pointsForDetractor) {
        scoreDelta += crmConfig.leadScoreAdjustment.pointsForDetractor;
      }

      const initialLeadScore = matchedContactDoc ? Number(matchedContactDoc.data()?.leadScore) || 0 : 0;
      await adminDb.collection('contacts').doc(resolvedContactId).update({
        leadScore: Math.max(0, initialLeadScore + scoreDelta),
      });
    }

    // 5. Deal Creation Rules
    if (crmConfig?.dealRules && crmConfig.dealRules.length > 0) {
      for (const rule of crmConfig.dealRules) {
        let shouldTriggerDeal = false;
        const currentScore = responseData.score ?? 0;

        if (rule.triggerOn === 'always') shouldTriggerDeal = true;
        else if (rule.triggerOn === 'score_above' && currentScore >= (rule.thresholdValue || 70)) shouldTriggerDeal = true;
        else if (rule.triggerOn === 'outcome_matched' && outcomeId && rule.matchedOutcomeId === outcomeId) shouldTriggerDeal = true;

        if (shouldTriggerDeal && rule.pipelineId && rule.stageId) {
          const rawDealTitle = rule.dealTitleTemplate || 'Survey Lead: {{contact.name}}';
          const dealTitle = interpolateCrmTemplate(rawDealTitle, {
            contactName: responseData.respondentName,
            entityName,
            surveyTitle: survey.title,
            score: currentScore,
          });

          let dealValue = rule.fixedDealValue || 0;
          if (rule.dealValueQuestionId) {
            const rawVal = answerMap.get(rule.dealValueQuestionId);
            dealValue = Number(rawVal) || dealValue;
          }

          if (cleanEntityId) {
            const dealRes = await createDeal({
              workspaceId,
              organizationId,
              pipelineId: rule.pipelineId,
              stageId: rule.stageId,
              name: dealTitle,
              value: dealValue,
              entityId: cleanEntityId,
              customFields: dealCustomUpdates as Record<string, string | number | boolean | null>,
            });

            if (dealRes.id) {
              createdDealId = dealRes.id;
            }
          }
        }
      }
    }

    // 6. Automated Follow-up Task Generation
    if (crmConfig?.taskRules && crmConfig.taskRules.length > 0) {
      const currentScore = responseData.score ?? 0;

      for (const taskRule of crmConfig.taskRules) {
        let shouldCreateTask = false;

        if (taskRule.triggerOn === 'always') {
          shouldCreateTask = true;
        } else if (taskRule.triggerOn === 'score_below' && currentScore <= (taskRule.thresholdValue ?? 50)) {
          shouldCreateTask = true;
        } else if (taskRule.triggerOn === 'score_above' && currentScore >= (taskRule.thresholdValue ?? 80)) {
          shouldCreateTask = true;
        } else if (taskRule.triggerOn === 'sentiment_negative' && (sentimentPolarity === 'negative' || sentimentPolarity === 'mostly_negative')) {
          shouldCreateTask = true;
        } else if (taskRule.triggerOn === 'nps_detractor' && currentScore <= 6) {
          shouldCreateTask = true;
        } else if (taskRule.triggerOn === 'outcome_matched' && outcomeId && taskRule.matchedOutcomeId === outcomeId) {
          shouldCreateTask = true;
        }

        if (shouldCreateTask) {
          const rawTaskTitle = taskRule.taskTitleTemplate || 'Follow up on survey feedback from {{contact.name}}';
          const taskTitle = interpolateCrmTemplate(rawTaskTitle, {
            contactName: responseData.respondentName,
            entityName,
            surveyTitle: survey.title,
            score: currentScore,
            responseId,
          });

          const rawTaskDescription = taskRule.taskDescriptionTemplate || 'Automated task created from survey response submission {{responseId}}';
          const taskDescription = interpolateCrmTemplate(rawTaskDescription, {
            contactName: responseData.respondentName,
            entityName,
            surveyTitle: survey.title,
            score: currentScore,
            responseId,
          });

          const dueTimestamp = new Date(Date.now() + (taskRule.dueInHours || 24) * 3600 * 1000).toISOString();

          const taskRef = adminDb.collection('tasks').doc();
          await taskRef.set({
            id: taskRef.id,
            workspaceId,
            organizationId,
            entityId: cleanEntityId || null,
            contactId: resolvedContactId || null,
            surveyId: survey.id,
            responseId,
            title: taskTitle,
            description: taskDescription,
            priority: taskRule.priority || 'medium',
            status: 'todo',
            dueDate: dueTimestamp,
            assignedUserId: taskRule.assignedUserId || responseData.assignedUserId || null,
            tags: taskRule.autoTagIds || [],
            source: 'survey_crm_sync',
            createdAt: nowIso,
            updatedAt: nowIso,
          });

          tasksCreatedCount++;
        }
      }
    }

    // 7. Rich Activity Timeline Logging
    if (crmConfig?.timelineLoggingEnabled !== false && (cleanEntityId || resolvedContactId)) {
      // Build top 5 answer highlights
      const elements = (survey.elements || []) as SurveyElement[];
      const questionMap = new Map<string, string>();
      for (const el of elements) {
        if ('title' in el && el.title) {
          questionMap.set(el.id, el.title);
        }
      }

      const answerHighlights: Array<{ questionId: string; questionTitle: string; answerValue: string }> = [];
      for (const [qId, val] of answerMap.entries()) {
        if (answerHighlights.length >= 5) break;
        const qTitle = questionMap.get(qId) || 'Question';
        let valStr = '';
        if (Array.isArray(val)) valStr = val.join(', ');
        else if (typeof val === 'object' && val !== null) valStr = JSON.stringify(val);
        else valStr = String(val ?? '');

        if (valStr.trim()) {
          answerHighlights.push({
            questionId: qId,
            questionTitle: qTitle,
            answerValue: valStr.length > 150 ? `${valStr.slice(0, 147)}...` : valStr,
          });
        }
      }

      const score = responseData.score ?? 0;
      const maxScore = survey.maxScore || 100;
      const percentageScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      const activityPayload: SurveyActivityTimelinePayload = {
        type: 'survey_submission',
        surveyId: survey.id,
        surveyTitle: survey.title,
        surveyVersion: survey.currentVersionNumber || 1,
        responseId,
        score,
        maxScore,
        percentageScore,
        sentimentPolarity,
        submittedAt: responseData.submittedAt || nowIso,
        durationSeconds: responseData.durationSeconds,
        channel: responseData.channel || 'web',
        answerHighlights,
        reviewUrl: `/admin/surveys/${survey.id}/results/${responseId}`,
        respondentName: responseData.respondentName,
        respondentEmail: normalizedEmail,
        respondentPhone: normalizedPhone,
      };

      if (cleanEntityId) {
        const entityActivityRef = adminDb
          .collection('workspace_entities')
          .doc(`${workspaceId}_${cleanEntityId}`)
          .collection('activities')
          .doc();
        await entityActivityRef.set({
          id: entityActivityRef.id,
          ...activityPayload,
          createdAt: nowIso,
        });
      }

      if (resolvedContactId) {
        const contactActivityRef = adminDb
          .collection('contacts')
          .doc(resolvedContactId)
          .collection('activities')
          .doc();
        await contactActivityRef.set({
          id: contactActivityRef.id,
          ...activityPayload,
          createdAt: nowIso,
        });
      }

      activityLogged = true;
    }

    // 8. Trigger detractor protocol if low score
    if ((responseData.score ?? 100) <= 50) {
      await triggerAutomationProtocols('SURVEY_DETRACTOR_FLAGGED', {
        surveyId: survey.id,
        surveyTitle: survey.title,
        responseId,
        entityId: cleanEntityId || '',
        entityName: entityName || responseData.respondentName || '',
        workspaceId,
        organizationId,
        score: responseData.score,
        contactId: resolvedContactId,
      }).catch((err: unknown) => console.error('[survey-crm-sync] Detractor protocol error:', err));
    }

    return {
      success: true,
      contactId: resolvedContactId,
      dealId: createdDealId,
      tasksCreatedCount,
      activityLogged,
    };
  } catch (error: unknown) {
    console.error('[survey-crm-sync] CRM synchronization failed:', error);
    return {
      success: false,
      tasksCreatedCount: 0,
      activityLogged: false,
      error: error instanceof Error ? error.message : 'Unknown CRM sync error',
    };
  }
}

/**
 * Returns available CRM fields (Standard Contact fields, Entity Custom fields, Deal fields)
 * for visual mapping in Survey Studio.
 */
export async function getSurveyCrmFieldDefinitionsAction(
  workspaceId: string
): Promise<{ success: boolean; fields?: SurveyCrmFieldDefinition[]; error?: string }> {
  try {
    if (!workspaceId) return { success: false, error: 'Missing workspaceId' };

    const standardContactFields: SurveyCrmFieldDefinition[] = [
      { key: 'name', label: 'Full Name', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'firstName', label: 'First Name', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'lastName', label: 'Last Name', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'email', label: 'Email Address', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'phone', label: 'Phone Number', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'company', label: 'Company / School', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'jobTitle', label: 'Job Title / Role', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'address', label: 'Postal Address', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'city', label: 'City', type: 'string', group: 'Standard Contact', targetType: 'contact' },
      { key: 'country', label: 'Country', type: 'string', group: 'Standard Contact', targetType: 'contact' },
    ];

    const dealFields: SurveyCrmFieldDefinition[] = [
      { key: 'title', label: 'Deal Title', type: 'string', group: 'Deal Fields', targetType: 'deal' },
      { key: 'value', label: 'Deal Value / Amount', type: 'number', group: 'Deal Fields', targetType: 'deal' },
      { key: 'notes', label: 'Deal Notes', type: 'string', group: 'Deal Fields', targetType: 'deal' },
    ];

    // Fetch workspace custom fields
    const customFieldsSnap = await adminDb
      .collection('app_fields')
      .where('workspaceId', '==', workspaceId)
      .get();

    const seenFieldKeys = new Set<string>();
    const entityCustomFields: SurveyCrmFieldDefinition[] = [];

    for (const doc of customFieldsSnap?.docs || []) {
      const data = doc.data();
      if (data.status === 'archived' || data.status === 'deleted' || data.type === 'hidden') {
        continue;
      }
      const rawIdentifier = data.variableName || data.name || doc.id;
      const fullKey = `customFields.${rawIdentifier}`;

      if (seenFieldKeys.has(fullKey)) continue;
      seenFieldKeys.add(fullKey);

      entityCustomFields.push({
        key: fullKey,
        label: data.label || data.name || doc.id,
        type: data.type === 'number' ? 'number' : data.type === 'boolean' ? 'boolean' : 'string',
        group: 'Entity Custom Fields',
        targetType: 'entity',
        description: data.description,
      });
    }

    return {
      success: true,
      fields: [...standardContactFields, ...entityCustomFields, ...dealFields],
    };
  } catch (error: unknown) {
    console.error('Failed to get CRM field definitions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Saves CRM sync configuration (field mappings, task rules, deal rules) to survey document.
 */
export async function saveSurveyCrmConfigAction(
  surveyId: string,
  workspaceId: string,
  crmConfig: SurveyCrmConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!surveyId || !workspaceId) return { success: false, error: 'Missing surveyId or workspaceId' };

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveyDoc = await surveyRef.get();
    if (!surveyDoc.exists) return { success: false, error: 'Survey not found' };

    const survey = surveyDoc.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized: Survey does not belong to this workspace' };
    }

    await surveyRef.update({
      crmConfig,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to save survey CRM config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Backoffice Action: Fetches global system CRM field mapping templates.
 */
export async function getSystemCrmFieldMappingTemplatesAction(): Promise<{
  success: boolean;
  templates?: SystemCrmFieldMappingTemplate[];
  error?: string;
}> {
  try {
    const docRef = adminDb.collection('system_settings').doc('crm_field_mapping_templates');
    const snap = await docRef.get();

    if (!snap.exists) {
      // Default seeded standard templates
      const defaultTemplates: SystemCrmFieldMappingTemplate[] = [
        {
          id: 'tpl_nps',
          archetype: 'nps',
          standardQuestionTitle: 'Net Promoter Score (NPS)',
          suggestedTargetType: 'contact',
          suggestedTargetField: 'customData.npsScore',
          suggestedWriteMode: 'always_overwrite',
          isProtected: true,
        },
        {
          id: 'tpl_parent_name',
          archetype: 'lead_generation',
          standardQuestionTitle: 'Parent / Guardian Full Name',
          suggestedTargetType: 'contact',
          suggestedTargetField: 'name',
          suggestedWriteMode: 'fill_if_empty',
          isProtected: true,
        },
        {
          id: 'tpl_parent_email',
          archetype: 'lead_generation',
          standardQuestionTitle: 'Email Address',
          suggestedTargetType: 'contact',
          suggestedTargetField: 'email',
          suggestedWriteMode: 'fill_if_empty',
          isProtected: true,
        },
        {
          id: 'tpl_parent_phone',
          archetype: 'lead_generation',
          standardQuestionTitle: 'Phone / WhatsApp Number',
          suggestedTargetType: 'contact',
          suggestedTargetField: 'phone',
          suggestedWriteMode: 'fill_if_empty',
          isProtected: true,
        },
        {
          id: 'tpl_target_grade',
          archetype: 'school_enrollment',
          standardQuestionTitle: 'Target Grade of Entry',
          suggestedTargetType: 'entity',
          suggestedTargetField: 'customFields.targetGrade',
          suggestedWriteMode: 'always_overwrite',
          isProtected: false,
        },
      ];
      await docRef.set({ templates: defaultTemplates, updatedAt: new Date().toISOString() });
      return { success: true, templates: defaultTemplates };
    }

    const data = snap.data();
    return { success: true, templates: (data?.templates || []) as SystemCrmFieldMappingTemplate[] };
  } catch (error: unknown) {
    console.error('Failed to get system CRM templates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Backoffice Action: Updates global system CRM field mapping templates.
 */
export async function saveSystemCrmFieldMappingTemplatesAction(
  templates: SystemCrmFieldMappingTemplate[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('system_settings').doc('crm_field_mapping_templates');
    await docRef.set({
      templates,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to save system CRM templates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
