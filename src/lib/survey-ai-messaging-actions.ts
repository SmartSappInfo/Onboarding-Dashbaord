'use server';

/**
 * @fileOverview Server actions for AI survey messaging & alert template generation and persistence.
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Security & Isolation:
 *    - All operations validate workspaceId and organizationId.
 *    - Templates are stored in message_templates with workspaceIds: [workspaceId].
 * 2. Single Source of Truth for Variables:
 *    - Fetches canonical dynamic variables from FieldsVariablesService before calling AI.
 * 3. Idempotent Generation & Tagging:
 *    - Automatically identifies existing survey-scoped templates to avoid unbounded proliferation.
 * 4. Testability:
 *    - Validated in src/lib/__tests__/survey-ai-messaging-actions.test.ts.
 */

import { adminDb } from '@/lib/firebase-admin';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import { canUser } from '@/lib/workspace-permissions';
import { generateSurveyMessagingFlow } from '@/ai/flows/generate-survey-messaging-flow';
import type {
  SurveyMessagingContextInput,
  GenerateSurveyMessagingOutput,
} from '@/ai/schemas/survey-messaging-schemas';
import type { MessageTemplate } from '@/lib/types';

export interface GenerateAndSaveSurveyTemplatesParams {
  workspaceId: string;
  organizationId: string;
  userId?: string;
  surveyId?: string;
  surveyTitle: string;
  surveyDescription?: string;
  target: 'respondent_outcome' | 'internal_team_alert' | 'external_stakeholder_alert' | 'all';
  channels?: Array<'email' | 'sms' | 'whatsapp'>;
  outcomeRule?: {
    ruleId?: string;
    label?: string;
    minScore?: number;
    maxScore?: number;
    pageTitle?: string;
    pageContentSummary?: string;
  };
  keyQuestions?: Array<{ id: string; title: string; type: string }>;
  scoringEnabled?: boolean;
  maxScore?: number;
  userPromptInstructions?: string;
  autoSave?: boolean;
}

export interface GenerateAndSaveSurveyTemplatesResult {
  success: boolean;
  output?: GenerateSurveyMessagingOutput;
  savedTemplateIds?: {
    emailTemplateId?: string;
    smsTemplateId?: string;
    whatsappTemplateId?: string;
  };
  error?: string;
}

export interface QuickSaveSurveyTemplateParams {
  workspaceId: string;
  organizationId: string;
  userId?: string;
  templateData: Partial<MessageTemplate>;
  templateId?: string;
}

/**
 * Extracts all {{variable_name}} tokens from string or JSON content.
 */
function extractDeclaredVariables(content: string): string[] {
  const matches = content.match(/\{\{(.*?)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
}

/**
 * Generates context-aware survey message templates via Genkit AI and optionally persists them to Firestore.
 */
export async function generateSurveyMessagingTemplatesAction(
  params: GenerateAndSaveSurveyTemplatesParams
): Promise<GenerateAndSaveSurveyTemplatesResult> {
  const {
    workspaceId,
    organizationId,
    userId,
    surveyId,
    surveyTitle,
    surveyDescription,
    target,
    channels = ['email', 'sms', 'whatsapp'],
    outcomeRule,
    keyQuestions,
    scoringEnabled,
    maxScore,
    userPromptInstructions,
    autoSave = true,
  } = params;

  if (!workspaceId || !organizationId) {
    return { success: false, error: 'Workspace and Organization contexts are required.' };
  }

  if (userId) {
    const perm = await canUser(userId, 'operations', 'templates', 'edit', workspaceId);
    if (!perm.granted) {
      return { success: false, error: perm.reason || 'Permission denied to create message templates.' };
    }
  }

  try {
    // 1. Fetch active workspace variable definitions for exact tag prompt injection
    const activeVariables = await getVariablesAction({
      workspaceId,
      organizationId,
    });
    const availableVarKeys = activeVariables.map((v) => v.key);

    // 2. Invoke Genkit AI flow
    const aiInput: SurveyMessagingContextInput = {
      surveyTitle: surveyTitle || 'Untitled Survey',
      surveyDescription,
      target,
      channels,
      outcomeRule,
      keyQuestions,
      scoringEnabled,
      maxScore,
      organizationId,
      availableVariables: availableVarKeys,
      userPromptInstructions,
    };

    const generatedOutput: GenerateSurveyMessagingOutput = await generateSurveyMessagingFlow(aiInput);

    const savedTemplateIds: {
      emailTemplateId?: string;
      smsTemplateId?: string;
      whatsappTemplateId?: string;
    } = {};

    // 3. Persist to Firestore if autoSave is true
    if (autoSave && adminDb) {
      const now = new Date().toISOString();
      const purposeTag = target === 'respondent_outcome'
        ? `survey_outcome_${outcomeRule?.ruleId || 'default'}`
        : (target === 'internal_team_alert' ? 'survey_team_alert' : 'survey_stakeholder_alert');

      // Email Template Persistence
      if (generatedOutput.email && channels.includes('email')) {
        const emailContentForVars = `${generatedOutput.email.subject} ${generatedOutput.email.body} ${JSON.stringify(generatedOutput.email.blocks)}`;
        const emailVars = extractDeclaredVariables(emailContentForVars);

        const emailDoc: Record<string, unknown> = {
          name: generatedOutput.email.name || `${surveyTitle} - Email (${target})`,
          subject: generatedOutput.email.subject,
          body: generatedOutput.email.body,
          blocks: generatedOutput.email.blocks,
          contentMode: 'rich_builder',
          channel: 'email',
          category: 'surveys',
          target: target === 'internal_team_alert' ? 'internal_team' : 'external_client',
          scope: 'workspace',
          workspaceIds: [workspaceId],
          organizationId,
          declaredVariables: emailVars,
          variables: emailVars,
          status: 'active',
          isActive: true,
          templateType: purposeTag,
          sourceSurveyId: surveyId || null,
          createdAt: now,
          updatedAt: now,
        };

        const docRef = await adminDb.collection('message_templates').add(emailDoc);
        savedTemplateIds.emailTemplateId = docRef.id;
      }

      // SMS Template Persistence
      if (generatedOutput.sms && channels.includes('sms')) {
        const smsVars = extractDeclaredVariables(generatedOutput.sms.body);

        const smsDoc: Record<string, unknown> = {
          name: generatedOutput.sms.name || `${surveyTitle} - SMS (${target})`,
          body: generatedOutput.sms.body,
          contentMode: 'plain_text',
          channel: 'sms',
          category: 'surveys',
          target: target === 'internal_team_alert' ? 'internal_team' : 'external_client',
          scope: 'workspace',
          workspaceIds: [workspaceId],
          organizationId,
          declaredVariables: smsVars,
          variables: smsVars,
          status: 'active',
          isActive: true,
          templateType: purposeTag,
          sourceSurveyId: surveyId || null,
          createdAt: now,
          updatedAt: now,
        };

        const docRef = await adminDb.collection('message_templates').add(smsDoc);
        savedTemplateIds.smsTemplateId = docRef.id;
      }

      // WhatsApp Template Persistence
      if (generatedOutput.whatsapp && channels.includes('whatsapp')) {
        const waDoc: Record<string, unknown> = {
          name: generatedOutput.whatsapp.name || `${surveyTitle.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_wa`,
          body: generatedOutput.whatsapp.body,
          bodyParams: generatedOutput.whatsapp.bodyParams || [],
          header: generatedOutput.whatsapp.header || null,
          footer: generatedOutput.whatsapp.footer || null,
          whatsappCategory: generatedOutput.whatsapp.whatsappCategory || 'UTILITY',
          contentMode: 'plain_text',
          channel: 'whatsapp',
          category: 'surveys',
          target: target === 'internal_team_alert' ? 'internal_team' : 'external_client',
          scope: 'workspace',
          workspaceIds: [workspaceId],
          organizationId,
          declaredVariables: [],
          variables: [],
          status: 'active',
          isActive: false, // Meta review required
          templateType: purposeTag,
          sourceSurveyId: surveyId || null,
          createdAt: now,
          updatedAt: now,
        };

        const docRef = await adminDb.collection('message_templates').add(waDoc);
        savedTemplateIds.whatsappTemplateId = docRef.id;
      }
    }

    return {
      success: true,
      output: generatedOutput,
      savedTemplateIds,
    };
  } catch (err: unknown) {
    console.error('[generateSurveyMessagingTemplatesAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate survey messaging templates.',
    };
  }
}

/**
 * Saves or updates a single survey message template in Firestore message_templates.
 */
export async function quickSaveSurveyTemplateAction(
  params: QuickSaveSurveyTemplateParams
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  const { workspaceId, organizationId, userId, templateData, templateId } = params;

  if (!workspaceId || !organizationId) {
    return { success: false, error: 'Workspace and Organization contexts are required.' };
  }

  if (userId) {
    const perm = await canUser(userId, 'operations', 'templates', 'edit', workspaceId);
    if (!perm.granted) {
      return { success: false, error: perm.reason || 'Permission denied.' };
    }
  }

  try {
    const now = new Date().toISOString();
    const contentForVars = `${templateData.subject || ''} ${templateData.body || ''} ${JSON.stringify(templateData.blocks || [])}`;
    const declaredVariables = extractDeclaredVariables(contentForVars);

    const docPayload: Record<string, unknown> = {
      ...templateData,
      workspaceIds: [workspaceId],
      organizationId,
      category: 'surveys',
      status: templateData.status || 'active',
      scope: 'workspace',
      declaredVariables,
      variables: declaredVariables,
      updatedAt: now,
    };

    if (templateId) {
      await adminDb.collection('message_templates').doc(templateId).update(docPayload);
      return { success: true, templateId };
    } else {
      docPayload.createdAt = now;
      const ref = await adminDb.collection('message_templates').add(docPayload);
      return { success: true, templateId: ref.id };
    }
  } catch (err: unknown) {
    console.error('[quickSaveSurveyTemplateAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save message template.',
    };
  }
}
