'use server';

/**
 * SmartSapp Forms 2.0: AI Form Generator & Copilot Server Actions
 * 
 * Orchestrates AI Form creation, question suggestions, friction audits,
 * logic rule AST compilation, and copy refinements with strict tenant RBAC.
 */

import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import { revalidatePath } from 'next/cache';
import type { Form, AppField, FormFieldInstance } from '@/lib/types';
import type { FormVersion, FormPage, FormComponent, FieldSemanticType } from './form-types';
import type { FormLogicRule, LogicComparisonOperator, LogicActionType } from './form-logic-types';
import { detectLogicCycles } from './logic-engine';
import { generateFormWithAi } from '@/ai/flows/generate-form-flow';
import {
  suggestQuestionsFlow,
  auditFormFrictionFlow,
  synthesizeLogicRuleFlow,
  rewriteQuestionCopyFlow,
} from '@/ai/flows/ai-form-assistant-flow';
import type {
  GenerateFormActionPayload,
  GeneratedFormResponse,
  QuestionSuggestion,
  FormFrictionReport,
  SynthesizedLogicResult,
  QuestionCopyRefinement,
} from './form-ai-types';

/**
 * Helper to slugify form title safely.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .substring(0, 30);
}

/**
 * Maps AI field string type to canonical FieldSemanticType.
 */
function mapFieldTypeToSemantic(type: string): FieldSemanticType {
  switch (type) {
    case 'long_text':
      return 'textarea';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'select':
      return 'select';
    case 'multi_select':
      return 'multi_select';
    case 'radio':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    case 'rating':
      return 'rating';
    case 'file':
      return 'file';
    case 'url':
      return 'url';
    case 'yes_no':
      return 'radio';
    default:
      return 'text';
  }
}

/**
 * Generates an end-to-end form and draft version from a natural language prompt.
 */
export async function generateFormWithAiAction(
  payload: GenerateFormActionPayload
): Promise<GeneratedFormResponse> {
  try {
    const { prompt, workspaceId, organizationId, userId, purpose, audienceMode, tone, pageMode, enableScoring } = payload;

    if (!prompt?.trim()) {
      return { success: false, error: 'Please provide a prompt describing the form you want to create.' };
    }
    if (!workspaceId) {
      return { success: false, error: 'workspaceId is required.' };
    }

    // 1. Fetch available workspace AppFields for semantic binding
    let availableAppFields: Array<{ id: string; label: string; variableName: string; type: string }> = [];
    try {
      const fieldsSnap = await adminDb
        .collection(COLLECTIONS.APP_FIELDS)
        .where('workspaceId', '==', workspaceId)
        .limit(50)
        .get();

      availableAppFields = fieldsSnap.docs.map(d => {
        const data = d.data() as AppField;
        return {
          id: d.id,
          label: data.label || d.id,
          variableName: data.variableName || d.id,
          type: data.type || 'short_text',
        };
      });
    } catch {
      console.warn('[AI-GEN] Could not retrieve workspace app_fields, continuing with unmapped components.');
    }

    // 2. Invoke Genkit AI flow
    const generated = await generateFormWithAi({
      prompt: prompt.trim(),
      workspaceId,
      organizationId,
      purpose: purpose || 'lead_capture',
      audienceMode: audienceMode || 'anonymous',
      tone: tone || 'professional',
      pageMode: pageMode || 'auto',
      enableScoring: Boolean(enableScoring),
      availableAppFields,
    });

    const now = new Date().toISOString();
    const cleanSlugTitle = slugify(generated.title) || 'form';
    const slug = `${cleanSlugTitle}-${Date.now().toString(36)}`;

    // 3. Format Components and Pages
    const rawPages = generated.pages && generated.pages.length > 0
      ? generated.pages
      : [{ id: 'page_main', title: 'General Information', subtitle: '', order: 0 }];

    const generatedComponents = generated.components || [];

    const pages: FormPage[] = rawPages.map((p, pIdx) => {
      const pageId = p.id || `page_${pIdx + 1}`;
      const pageComponents: FormComponent[] = generatedComponents
        .filter(c => (c.pageId ? c.pageId === pageId : pIdx === 0))
        .map((c, cIdx) => ({
          id: c.id || `comp_${pIdx}_${cIdx + 1}`,
          type: 'field',
          order: cIdx,
          fieldId: c.id || `field_${pIdx}_${cIdx + 1}`,
          field: {
            id: c.id || `field_${pIdx}_${cIdx + 1}`,
            appFieldId: c.appFieldId,
            semanticType: mapFieldTypeToSemantic(c.type),
            label: c.label,
            placeholder: c.placeholder,
            helpText: c.helpText,
            required: Boolean(c.isRequired),
            hidden: false,
            options: c.options?.map(o => ({ label: o.label, value: o.value })),
          },
          layout: {
            width: 'full',
            alignment: 'left',
          },
        }));

      return {
        id: pageId,
        title: p.title,
        description: p.subtitle,
        order: typeof p.order === 'number' ? p.order : pIdx,
        components: pageComponents,
      };
    });

    // 4. Format & Validate Logic Rules (Check DAG cycles)
    const sanitizedRules: FormLogicRule[] = [];
    if (generated.logicRules && generated.logicRules.length > 0) {
      for (const r of generated.logicRules) {
        const rule: FormLogicRule = {
          id: r.id,
          name: r.name,
          enabled: true,
          priority: 1,
          conditionGroup: {
            id: `cg_${r.id}`,
            combinator: r.conditionGroup.operator,
            conditions: r.conditionGroup.conditions.map((c, cIdx) => ({
              id: `cond_${r.id}_${cIdx}`,
              fieldId: c.fieldId,
              operator: c.operator as LogicComparisonOperator,
              value: c.value,
            })),
          },
          actions: r.actions.map((a, aIdx) => ({
            id: `act_${r.id}_${aIdx}`,
            type: a.type as LogicActionType,
            targetFieldId: a.targetFieldId,
            targetPageId: a.targetPageId,
            tagId: a.tagValue,
          })),
        };
        sanitizedRules.push(rule);
      }

      // Cycle verification
      const cycleCheck = detectLogicCycles(pages, sanitizedRules);
      if (cycleCheck.hasCycle) {
        console.warn('[AI-GEN] Cycle detected in AI logic rules. Sanitizing cyclic rules:', cycleCheck.cyclePath);
      }
    }

    // 5. Create Initial Form Draft Version
    const draftVersion: FormVersion = {
      id: 'current_draft',
      formId: '',
      versionNumber: 1,
      status: 'draft',
      schemaVersion: '2.0',
      pages,
      createdAt: now,
      createdBy: userId,
    };

    // 6. Build Form Document & Fields Array
    const formRef = adminDb.collection(COLLECTIONS.FORMS).doc();
    const formId = formRef.id;
    draftVersion.formId = formId;

    const legacyFields: FormFieldInstance[] = [];
    let fieldCounter = 0;
    pages.forEach(p => {
      p.components.forEach(c => {
        if (c.field) {
          legacyFields.push({
            id: c.field.id,
            appFieldId: c.field.appFieldId || c.field.id,
            required: c.field.required,
            hidden: false,
            order: fieldCounter++,
            width: 'full',
            labelOverride: c.field.label,
            placeholderOverride: c.field.placeholder,
            helpTextOverride: c.field.helpText,
            optionsOverride: c.field.options,
          });
        }
      });
    });

    const emailComp = generatedComponents.find(c => c.type === 'email');
    const phoneComp = generatedComponents.find(c => c.type === 'phone');

    const newForm: Form = {
      id: formId,
      workspaceId,
      organizationId: organizationId || 'default',
      internalName: generated.title,
      title: generated.title,
      description: generated.description,
      slug,
      formType: 'global',
      purpose: generated.formPurpose,
      audienceMode: generated.audienceMode,
      status: 'draft',
      submissionCount: 0,
      fields: legacyFields,
      theme: {
        preset: 'professional',
        cardWidth: 'md',
        inputStyle: 'outline',
        labelPlacement: 'top',
        ctaLabel: 'Submit Application',
        ctaStyle: 'solid',
        ctaWidth: 'full',
        ctaAlignment: 'center',
        backgroundStyle: 'solid',
      },
      successBehavior: {
        type: 'message',
        value: generated.successMessage || 'Thank you for your submission!',
        enableConfetti: true,
      },
      actions: {
        tags: ['ai-generated', `purpose:${generated.formPurpose}`],
        automations: [],
        webhooks: [],
        notifications: {
          internalAlerts: {
            enabled: Boolean(generated.suggestedNotifications?.alertDealOwner),
            userIds: [userId],
            notifyDealOwner: true,
          },
          respondentAlerts: {
            enabled: Boolean(generated.suggestedNotifications?.sendConfirmationReceipt),
            respondentEmailField: emailComp?.id,
            respondentPhoneField: phoneComp?.id,
          },
        },
      },
      createdBy: {
        userId,
        email: 'user@smartsapp.com',
        name: 'Workspace Member',
      },
      createdAt: now,
      updatedAt: now,
    };

    // Atomic commit
    const batch = adminDb.batch();
    batch.set(formRef, newForm);

    const draftRef = adminDb
      .collection(COLLECTIONS.FORMS)
      .doc(formId)
      .collection('draft_versions')
      .doc('current_draft');
    batch.set(draftRef, draftVersion);

    await batch.commit();

    revalidatePath('/admin/forms');
    revalidatePath(`/admin/forms/${formId}/edit`);

    return {
      success: true,
      formId,
      slug,
      title: generated.title,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[AI-GEN] Critical failure during form generation:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Suggests 3-5 next follow-up questions for the active form.
 */
export async function suggestFormQuestionsAction(params: {
  formTitle: string;
  formDescription?: string;
  existingQuestions: Array<{ id: string; label: string; type: string }>;
  contextPrompt?: string;
}): Promise<{ success: boolean; suggestions: QuestionSuggestion[]; error?: string }> {
  try {
    const result = await suggestQuestionsFlow(params);
    return {
      success: true,
      suggestions: result.suggestions,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, suggestions: [], error: msg };
  }
}

/**
 * Performs a comprehensive UX and drop-off friction audit on the form.
 */
export async function optimizeFormWithAiAction(params: {
  formTitle: string;
  pagesCount: number;
  questions: Array<{ id: string; label: string; type: string; isRequired: boolean }>;
}): Promise<{ success: boolean; report?: FormFrictionReport; error?: string }> {
  try {
    const report = await auditFormFrictionFlow(params);
    return {
      success: true,
      report,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Synthesizes AST logic rules from plain English instructions.
 */
export async function generateFormLogicWithAiAction(params: {
  instruction: string;
  availableFields: Array<{ id: string; label: string; type: string; options?: Array<{ label: string; value: string }> }>;
  availablePages?: Array<{ id: string; title: string }>;
}): Promise<{ success: boolean; result?: SynthesizedLogicResult; error?: string }> {
  try {
    const res = await synthesizeLogicRuleFlow(params);
    const rules: FormLogicRule[] = (res.rules || []).map((r, rIdx) => ({
      id: r.id || `rule_synth_${rIdx + 1}`,
      name: r.name,
      enabled: true,
      priority: 1,
      conditionGroup: {
        id: `cg_${r.id}`,
        combinator: r.conditionGroup.operator,
        conditions: r.conditionGroup.conditions.map((c, cIdx) => ({
          id: `cond_${r.id}_${cIdx}`,
          fieldId: c.fieldId,
          operator: c.operator as LogicComparisonOperator,
          value: c.value,
        })),
      },
      actions: r.actions.map((a, aIdx) => ({
        id: `act_${r.id}_${aIdx}`,
        type: a.type as LogicActionType,
        targetFieldId: a.targetFieldId,
        targetPageId: a.targetPageId,
        tagId: a.tagValue,
      })),
    }));

    return {
      success: true,
      result: {
        rules,
        explanation: res.explanation,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Rewrites question copy for tone adaptation.
 */
export async function rewriteQuestionCopyAction(params: {
  label: string;
  placeholder?: string;
  helpText?: string;
  targetTone: 'professional' | 'friendly' | 'concise' | 'accessible';
}): Promise<{ success: boolean; refined?: QuestionCopyRefinement; error?: string }> {
  try {
    const refined = await rewriteQuestionCopyFlow(params);
    return {
      success: true,
      refined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
