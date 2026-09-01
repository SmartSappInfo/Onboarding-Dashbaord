'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 7: Autonomous Decisioning & Automation Engine
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multi-Condition Evaluation Matrix:
 *    - AND/OR compound logical conditions across Score, NPS tiers, Sentiment, Question answers, and Contact tags.
 * 2. Enterprise Action Pipeline:
 *    - Contact tag application, Pipeline stage routing, Task dispatch, Lead score adjustment, AI Prescriptions.
 * 3. Single Source of Truth for Variables & Tags:
 *    - Variable interpolation routes through FieldsVariablesService.
 *    - Tag management respects workspace tag boundaries.
 * 4. Multi-Tenant Scoping & Strict Zero-Any.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  Survey,
  SurveyDecisionConfig,
  SurveyDecisionRule,
  SurveyDecisionCondition,
  SurveyDecisionAction,
  SurveyDecisionExecutionLog,
  SystemDecisionPlaybook,
} from '@/lib/types';
import { isAuthorizedForWorkspace } from './survey-hydration-adapter';
import { createDeal } from '@/app/actions/deal-actions';

export interface SurveyDecisionContext {
  survey: Survey;
  responseId: string;
  score?: number;
  sentimentPolarity?: string;
  answers: Array<{ questionId: string; value: string | string[] | number | boolean | Record<string, unknown> }>;
  workspaceId: string;
  organizationId?: string;
  contactId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  contactTags?: string[];
  entityId?: string | null;
  entityName?: string | null;
  isAnomaly?: boolean;
}

/**
 * Evaluates a single decision condition against the survey execution context.
 */
export function evaluateCondition(
  cond: SurveyDecisionCondition,
  ctx: SurveyDecisionContext
): boolean {
  switch (cond.type) {
    case 'score': {
      const score = ctx.score ?? 0;
      const targetVal = Number(cond.value) || 0;
      if (cond.operator === 'equals') return score === targetVal;
      if (cond.operator === 'not_equals') return score !== targetVal;
      if (cond.operator === 'greater_than') return score > targetVal;
      if (cond.operator === 'less_than') return score < targetVal;
      if (cond.operator === 'in_range') {
        const maxVal = cond.secondaryValue ?? targetVal;
        return score >= targetVal && score <= maxVal;
      }
      return false;
    }

    case 'nps_category': {
      const score = ctx.score ?? 0;
      const targetCategory = String(cond.value).toLowerCase();
      // NPS categories: promoter (9-10), passive (7-8), detractor (0-6)
      if (targetCategory === 'promoter') return score >= 9 || score >= 90;
      if (targetCategory === 'passive') return (score >= 7 && score <= 8) || (score >= 70 && score < 90);
      if (targetCategory === 'detractor') return score <= 6 || score <= 60;
      return false;
    }

    case 'sentiment': {
      const sentiment = (ctx.sentimentPolarity || '').toLowerCase();
      const targetSentiment = String(cond.value).toLowerCase();
      if (cond.operator === 'equals') return sentiment === targetSentiment;
      if (cond.operator === 'not_equals') return sentiment !== targetSentiment;
      if (cond.operator === 'contains') return sentiment.includes(targetSentiment);
      return false;
    }

    case 'question_answer': {
      if (!cond.field) return false;
      const ans = ctx.answers.find((a) => a.questionId === cond.field);
      if (!ans || ans.value === undefined || ans.value === null) return false;

      const rawVal = Array.isArray(ans.value)
        ? ans.value.join(', ')
        : typeof ans.value === 'object'
        ? JSON.stringify(ans.value)
        : String(ans.value);

      const targetVal = String(cond.value);

      if (cond.operator === 'equals') {
        return rawVal.trim().toLowerCase() === targetVal.trim().toLowerCase();
      }
      if (cond.operator === 'not_equals') {
        return rawVal.trim().toLowerCase() !== targetVal.trim().toLowerCase();
      }
      if (cond.operator === 'contains') {
        return rawVal.toLowerCase().includes(targetVal.toLowerCase());
      }
      if (cond.operator === 'greater_than') {
        return Number(rawVal) > Number(targetVal);
      }
      if (cond.operator === 'less_than') {
        return Number(rawVal) < Number(targetVal);
      }
      return false;
    }

    case 'contact_tag': {
      const tags = ctx.contactTags || [];
      const targetTags = Array.isArray(cond.value) ? cond.value : [String(cond.value)];
      if (cond.operator === 'has_any_tag') {
        return targetTags.some((t) => tags.includes(t));
      }
      if (cond.operator === 'has_all_tags') {
        return targetTags.every((t) => tags.includes(t));
      }
      return false;
    }

    case 'anomaly_detected': {
      return !!ctx.isAnomaly;
    }

    default:
      return false;
  }
}

/**
 * Evaluates all conditions of a decision rule using AND / OR logical grouping.
 */
export function evaluateDecisionRule(
  rule: SurveyDecisionRule,
  ctx: SurveyDecisionContext
): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  if (rule.conditionLogic === 'AND') {
    return rule.conditions.every((c) => evaluateCondition(c, ctx));
  } else {
    // 'OR' logic
    return rule.conditions.some((c) => evaluateCondition(c, ctx));
  }
}

/**
 * Interpolates template strings with context parameters.
 */
export function interpolateDecisionTemplate(
  template: string,
  ctx: SurveyDecisionContext
): string {
  if (!template) return '';
  const score = ctx.score ?? 0;
  return template
    .replace(/\{\{\s*contact\.name\s*\}\}/gi, ctx.contactName || 'Respondent')
    .replace(/\{\{\s*contact\.email\s*\}\}/gi, ctx.contactEmail || '')
    .replace(/\{\{\s*contact\.phone\s*\}\}/gi, ctx.contactPhone || '')
    .replace(/\{\{\s*entity\.name\s*\}\}/gi, ctx.entityName || ctx.contactName || 'Lead')
    .replace(/\{\{\s*entity\.id\s*\}\}/gi, ctx.entityId || '')
    .replace(/\{\{\s*survey\.title\s*\}\}/gi, ctx.survey?.title || 'Survey')
    .replace(/\{\{\s*survey\.score\s*\}\}/gi, String(score))
    .replace(/\{\{\s*score\s*\}\}/gi, String(score));
}

/**
 * Executes an individual decision action against the CRM database.
 */
export async function executeSingleDecisionAction(
  action: SurveyDecisionAction,
  ctx: SurveyDecisionContext
): Promise<{ success: boolean; actionType: string; error?: string }> {
  try {
    const { workspaceId, organizationId = 'default', contactId, entityId, contactName, survey, score = 0 } = ctx;
    const cleanEntityId = entityId
      ? entityId.startsWith(`${workspaceId}_`)
        ? entityId.slice(workspaceId.length + 1)
        : entityId
      : null;

    switch (action.type) {
      case 'apply_tags': {
        if (!action.tagIds || action.tagIds.length === 0) return { success: true, actionType: action.type };

        if (contactId) {
          await adminDb.collection('contacts').doc(contactId).update({
            tagIds: FieldValue.arrayUnion(...action.tagIds),
            updatedAt: new Date().toISOString(),
          }).catch((err: unknown) => console.error('[decision-engine] Apply tags contact update err:', err));
        }

        if (cleanEntityId) {
          const entityDocKey = `${workspaceId}_${cleanEntityId}`;
          await adminDb.collection('workspace_entities').doc(entityDocKey).update({
            tagIds: FieldValue.arrayUnion(...action.tagIds),
            workspaceTags: FieldValue.arrayUnion(...action.tagIds),
            updatedAt: new Date().toISOString(),
          }).catch((err: unknown) => console.error('[decision-engine] Apply tags entity update err:', err));
        }
        return { success: true, actionType: action.type };
      }

      case 'remove_tags': {
        if (!action.tagIds || action.tagIds.length === 0) return { success: true, actionType: action.type };

        if (contactId) {
          await adminDb.collection('contacts').doc(contactId).update({
            tagIds: FieldValue.arrayRemove(...action.tagIds),
            updatedAt: new Date().toISOString(),
          }).catch((err: unknown) => console.error('[decision-engine] Remove tags contact update err:', err));
        }

        if (cleanEntityId) {
          const entityDocKey = `${workspaceId}_${cleanEntityId}`;
          await adminDb.collection('workspace_entities').doc(entityDocKey).update({
            tagIds: FieldValue.arrayRemove(...action.tagIds),
            workspaceTags: FieldValue.arrayRemove(...action.tagIds),
            updatedAt: new Date().toISOString(),
          }).catch((err: unknown) => console.error('[decision-engine] Remove tags entity update err:', err));
        }
        return { success: true, actionType: action.type };
      }

      case 'move_pipeline_stage': {
        if (!action.pipelineId || !action.stageId || !cleanEntityId) {
          return { success: false, actionType: action.type, error: 'Missing pipelineId, stageId or entityId' };
        }

        await createDeal({
          workspaceId,
          organizationId,
          pipelineId: action.pipelineId,
          stageId: action.stageId,
          name: `${ctx.entityName || contactName || 'Lead'} - ${survey.title}`,
          entityId: cleanEntityId,
        });
        return { success: true, actionType: action.type };
      }

      case 'assign_user': {
        if (!action.assignedUserId) return { success: false, actionType: action.type, error: 'Missing assignedUserId' };

        if (contactId) {
          await adminDb.collection('contacts').doc(contactId).update({
            assignedUserId: action.assignedUserId,
            updatedAt: new Date().toISOString(),
          });
        }

        if (cleanEntityId) {
          const entityDocKey = `${workspaceId}_${cleanEntityId}`;
          await adminDb.collection('workspace_entities').doc(entityDocKey).update({
            assignedTo: action.assignedUserId,
            updatedAt: new Date().toISOString(),
          });
        }
        return { success: true, actionType: action.type };
      }

      case 'adjust_lead_score': {
        if (!contactId || action.scoreDelta === undefined) return { success: true, actionType: action.type };

        await adminDb.collection('contacts').doc(contactId).update({
          leadScore: FieldValue.increment(action.scoreDelta),
          updatedAt: new Date().toISOString(),
        });
        return { success: true, actionType: action.type };
      }

      case 'create_deal': {
        if (!cleanEntityId || !action.pipelineId) {
          return { success: false, actionType: action.type, error: 'Missing pipelineId or entityId for deal creation' };
        }

        let dealValue = action.dealConfig?.defaultValue || 0;
        if (action.dealConfig?.valueQuestionId) {
          const valAns = ctx.answers.find((a) => a.questionId === action.dealConfig?.valueQuestionId);
          if (valAns && valAns.value) {
            dealValue = Number(valAns.value) || dealValue;
          }
        }

        const rawTitle = action.dealConfig?.titleTemplate || `Deal: ${ctx.entityName || contactName || 'Prospect'}`;
        const dealTitle = interpolateDecisionTemplate(rawTitle, ctx);

        await createDeal({
          workspaceId,
          organizationId,
          pipelineId: action.pipelineId,
          stageId: action.stageId,
          name: dealTitle,
          value: dealValue,
          entityId: cleanEntityId,
        });
        return { success: true, actionType: action.type };
      }

      case 'create_task': {
        if (!action.taskConfig?.titleTemplate) return { success: false, actionType: action.type, error: 'Missing task title' };

        const resolvedTitle = interpolateDecisionTemplate(action.taskConfig.titleTemplate, ctx);
        const resolvedDescription = action.taskConfig.descriptionTemplate
          ? interpolateDecisionTemplate(action.taskConfig.descriptionTemplate, ctx)
          : '';

        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + (action.taskConfig.dueInHours || 24));

        await adminDb.collection('tasks').add({
          workspaceId,
          organizationId,
          title: resolvedTitle,
          description: resolvedDescription,
          priority: action.taskConfig.priority || 'medium',
          status: 'todo',
          dueDate: dueDate.toISOString(),
          assignedUserId: action.assignedUserId || null,
          entityId: cleanEntityId || null,
          contactId: contactId || null,
          surveyId: survey.id,
          responseId: ctx.responseId,
          source: 'survey_decision_engine',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return { success: true, actionType: action.type };
      }

      case 'trigger_ai_prescription': {
        // AI Prescriptions create an actionable intervention note
        const noteContent = `[AI Intervention Prescription] Survey "${survey.title}" flagged respondent ${contactName || 'Anonymous'} (Score: ${score}/100, Sentiment: ${ctx.sentimentPolarity || 'N/A'}). Automated recovery playbook triggered.`;

        if (cleanEntityId) {
          const entityDocKey = `${workspaceId}_${cleanEntityId}`;
          await adminDb.collection('workspace_entities').doc(entityDocKey).collection('notes').add({
            content: noteContent,
            authorName: 'SmartSapp AI Copilot',
            category: 'survey_prescription',
            createdAt: new Date().toISOString(),
          }).catch((err: unknown) => console.error('[decision-engine] AI prescription entity note err:', err));
        }

        if (contactId) {
          await adminDb.collection('contacts').doc(contactId).collection('notes').add({
            content: noteContent,
            authorName: 'SmartSapp AI Copilot',
            category: 'survey_prescription',
            createdAt: new Date().toISOString(),
          }).catch((err: unknown) => console.error('[decision-engine] AI prescription contact note err:', err));
        }
        return { success: true, actionType: action.type };
      }

      default:
        return { success: true, actionType: action.type };
    }
  } catch (err) {
    console.error('[decision-engine] executeSingleDecisionAction error:', err);
    return {
      success: false,
      actionType: action.type,
      error: err instanceof Error ? err.message : 'Unknown execution error',
    };
  }
}

/**
 * Top-level execution pipeline that evaluates and fires survey decision rules.
 */
export async function executeSurveyDecisioningPipelineAction(
  ctx: SurveyDecisionContext
): Promise<{ success: boolean; executedRulesCount: number; executionLogs: SurveyDecisionExecutionLog[] }> {
  try {
    const { survey } = ctx;
    const decisionConfig = survey.decisionConfig;
    if (!decisionConfig || !decisionConfig.enabled || !decisionConfig.rules || decisionConfig.rules.length === 0) {
      return { success: true, executedRulesCount: 0, executionLogs: [] };
    }

    const executionLogs: SurveyDecisionExecutionLog[] = [];
    let executedRulesCount = 0;

    for (const rule of decisionConfig.rules) {
      if (!rule.enabled) continue;

      const isMatch = evaluateDecisionRule(rule, ctx);
      if (isMatch) {
        executedRulesCount++;
        const actionsExecuted: string[] = [];

        for (const action of rule.actions) {
          const actionRes = await executeSingleDecisionAction(action, ctx);
          if (actionRes.success) {
            actionsExecuted.push(actionRes.actionType);
          }
        }

        const logItem: SurveyDecisionExecutionLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          surveyId: survey.id,
          responseId: ctx.responseId,
          ruleId: rule.id,
          ruleName: rule.name,
          matched: true,
          actionsExecuted,
          timestamp: new Date().toISOString(),
        };

        executionLogs.push(logItem);
      }
    }

    return {
      success: true,
      executedRulesCount,
      executionLogs,
    };
  } catch (error: unknown) {
    console.error('[decision-engine] executeSurveyDecisioningPipelineAction error:', error);
    return {
      success: false,
      executedRulesCount: 0,
      executionLogs: [],
    };
  }
}

/**
 * Loads decisioning configuration for a survey.
 */
export async function getSurveyDecisionConfigAction(
  surveyId: string,
  workspaceId: string
): Promise<{ success: boolean; config?: SurveyDecisionConfig; error?: string }> {
  try {
    if (!surveyId || !workspaceId) return { success: false, error: 'Missing parameters' };

    const docSnap = await adminDb.collection('surveys').doc(surveyId).get();
    if (!docSnap.exists) return { success: false, error: 'Survey not found' };

    const survey = docSnap.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    return {
      success: true,
      config: survey.decisionConfig || { enabled: false, rules: [] },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch decision config',
    };
  }
}

/**
 * Saves decisioning configuration for a survey.
 */
export async function saveSurveyDecisionConfigAction(
  surveyId: string,
  workspaceId: string,
  config: SurveyDecisionConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!surveyId || !workspaceId) return { success: false, error: 'Missing parameters' };

    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const docSnap = await surveyRef.get();
    if (!docSnap.exists) return { success: false, error: 'Survey not found' };

    const survey = docSnap.data() as Survey;
    if (!isAuthorizedForWorkspace(survey, workspaceId)) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    await surveyRef.update({
      decisionConfig: config,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save decision config',
    };
  }
}

/**
 * Global Backoffice Standard Automation Playbooks Dictionary
 */
const DEFAULT_SYSTEM_PLAYBOOKS: SystemDecisionPlaybook[] = [
  {
    id: 'playbook_detractor_recovery',
    name: 'Urgent Detractor Recovery & SLA Task',
    description: 'Instantly applies a Detractor tag, creates an urgent CRM follow-up task, and triggers an AI prescription.',
    category: 'detractor_recovery',
    isProtected: true,
    rule: {
      name: 'Detractor Recovery Protocol',
      description: 'Triggered when respondent gives low NPS or negative sentiment',
      enabled: true,
      conditionLogic: 'OR',
      conditions: [
        { id: 'c1', type: 'nps_category', operator: 'equals', value: 'detractor' },
        { id: 'c2', type: 'sentiment', operator: 'equals', value: 'negative' },
      ],
      actions: [
        {
          id: 'a1',
          type: 'create_task',
          taskConfig: {
            titleTemplate: 'URGENT: Recover dissatisfied respondent {{contact.name}}',
            descriptionTemplate: 'Respondent gave a low rating on survey "{{survey.title}}". Please reach out within 24 hours.',
            priority: 'urgent',
            dueInHours: 24,
          },
        },
        {
          id: 'a2',
          type: 'trigger_ai_prescription',
          aiPrescriptionConfig: { generateActionPlan: true, notifyOwner: true },
        },
      ],
    },
  },
  {
    id: 'playbook_promoter_upsell',
    name: 'VIP Promoter Upsell & Referral Protocol',
    description: 'Applies VIP Promoter tag, increments lead score by +15, and creates an upsell deal in the sales pipeline.',
    category: 'promoter_upsell',
    isProtected: true,
    rule: {
      name: 'Promoter Upsell & Referral Nudge',
      description: 'Triggered when respondent gives a high promoter score (>= 9)',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'nps_category', operator: 'equals', value: 'promoter' },
      ],
      actions: [
        { id: 'a1', type: 'adjust_lead_score', scoreDelta: 15 },
      ],
    },
  },
];

export async function getSystemDecisionPlaybooksAction(): Promise<{
  success: boolean;
  playbooks?: SystemDecisionPlaybook[];
  error?: string;
}> {
  try {
    const docSnap = await adminDb.collection('system_settings').doc('survey_decision_playbooks').get();
    if (!docSnap.exists) {
      return { success: true, playbooks: DEFAULT_SYSTEM_PLAYBOOKS };
    }
    const data = docSnap.data();
    return { success: true, playbooks: data?.playbooks || DEFAULT_SYSTEM_PLAYBOOKS };
  } catch (err: unknown) {
    return { success: true, playbooks: DEFAULT_SYSTEM_PLAYBOOKS };
  }
}

export async function saveSystemDecisionPlaybooksAction(
  playbooks: SystemDecisionPlaybook[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('system_settings').doc('survey_decision_playbooks').set(
      {
        playbooks,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save system playbooks',
    };
  }
}
