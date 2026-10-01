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
  SurveyCrmConfig,
  SurveyCrmFieldDefinition,
  SystemCrmFieldMappingTemplate,
} from '@/lib/types';
import { isAuthorizedForWorkspace } from './survey-hydration-adapter';
import { requireAuth, requireSystemAdmin, requireWorkspace } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';

/**
 * Returns available CRM fields (Standard Contact fields, Entity Custom fields, Deal fields)
 * for visual mapping in Survey Studio.
 */
export async function getSurveyCrmFieldDefinitionsAction(
  workspaceId: string
): Promise<{ success: boolean; fields?: SurveyCrmFieldDefinition[]; error?: string }> {
  // SECURITY (FU-14 follow-on): reads the workspace's custom field schema; members only.
  if (!workspaceId) return { success: false, error: 'Missing workspaceId' };
  await requireWorkspace(workspaceId);

  try {

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
      error: toClientErrorMessage('surveys.survey-crm-sync-actions', error, undefined, 'Unknown error'),
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
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

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
      error: toClientErrorMessage('surveys.survey-crm-sync-actions', error, undefined, 'Unknown error'),
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
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

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
      error: toClientErrorMessage('surveys.survey-crm-sync-actions', error, undefined, 'Unknown error'),
    };
  }
}

/**
 * Backoffice Action: Updates global system CRM field mapping templates.
 */
export async function saveSystemCrmFieldMappingTemplatesAction(
  templates: SystemCrmFieldMappingTemplate[]
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (FU-14 follow-on): platform-wide templates; any signed-in user could overwrite them.
  await requireSystemAdmin();

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
      error: toClientErrorMessage('surveys.survey-crm-sync-actions', error, undefined, 'Unknown error'),
    };
  }
}
