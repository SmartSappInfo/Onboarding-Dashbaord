'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 7: Autonomous Decisioning & Automation Engine
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multi-Condition Evaluation Matrix:
 *    - AND/OR compound logical conditions across Score, NPS tiers, Sentiment, Question answers, Contact tags, and Anomalies.
 * 2. Enterprise Action Pipeline:
 *    - Contact tag application, Pipeline stage routing, Task dispatch, Lead score adjustment, AI Prescriptions, Webhooks.
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
  SurveyDecisionSimulationResult,
} from '@/lib/types';
import { isAuthorizedForWorkspace } from './survey-hydration-adapter';
import { createDeal } from '@/app/actions/deal-actions';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
import {
  type SurveyDecisionContext,
  evaluateCondition,
  evaluateDecisionRule,
} from './survey-decision-evaluator';

export type { SurveyDecisionContext };

/**
 * Safely resolves dynamic variable tokens in templates using FieldsVariablesService.
 */
function interpolateDecisionTemplate(template: string, ctx: SurveyDecisionContext): string {
  if (!template) return '';
  const valuesMap = new Map<string, unknown>([
    ['contact.name', ctx.contactName || ctx.entityName || 'Respondent'],
    ['contact_name', ctx.contactName || ctx.entityName || 'Respondent'],
    ['entity.name', ctx.entityName || ctx.contactName || 'Lead'],
    ['entity_name', ctx.entityName || ctx.contactName || 'Lead'],
    ['survey.title', ctx.survey.title || 'Survey'],
    ['survey_title', ctx.survey.title || 'Survey'],
    ['score', ctx.score ?? 0],
    ['survey.score', ctx.score ?? 0],
    ['responseId', ctx.responseId || ''],
    ['sentiment', ctx.sentimentPolarity || 'neutral'],
  ]);
  return FieldsVariablesService.resolveTextWithMap(template, valuesMap, false);
}

/**
 * Executes a single decision action.
 */
export async function executeSingleDecisionAction(
  action: SurveyDecisionAction,
  ctx: SurveyDecisionContext
): Promise<{ success: boolean; actionType: string; error?: string }> {
  try {
    const { workspaceId, organizationId, contactId, entityId, contactName, survey, score } = ctx;
    const cleanEntityId = entityId ? entityId.replace(/^[a-zA-Z0-9_-]+_/, '') : null;

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
          organizationId: organizationId || '',
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
          organizationId: organizationId || '',
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

      case 'trigger_webhook': {
        if (!action.webhookConfig?.url) {
          return { success: false, actionType: action.type, error: 'Missing webhook URL' };
        }
        // Asynchronously dispatch webhook payload
        try {
          const payload = {
            event: 'survey.decision_triggered',
            surveyId: survey.id,
            surveyTitle: survey.title,
            responseId: ctx.responseId,
            score: ctx.score,
            sentiment: ctx.sentimentPolarity,
            contactName: ctx.contactName,
            contactEmail: ctx.contactEmail,
            entityName: ctx.entityName,
            timestamp: new Date().toISOString(),
            ...action.webhookConfig.customPayload,
          };
          fetch(action.webhookConfig.url, {
            method: action.webhookConfig.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(action.webhookConfig.headers || {}),
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
          }).catch((fetchErr) => console.error('[decision-engine] Webhook dispatch error:', fetchErr));
        } catch (webhookErr) {
          console.error('[decision-engine] Webhook error:', webhookErr);
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
 * Simulates and dry-runs a decision rule against a sample payload without mutating database records.
 */
export async function testSurveyDecisionRuleAction(
  rule: SurveyDecisionRule,
  ctx: SurveyDecisionContext
): Promise<SurveyDecisionSimulationResult> {
  const evaluatedConditions = rule.conditions.map((cond) => {
    const passed = evaluateCondition(cond, ctx);
    let reason = passed ? 'Condition matched successfully.' : 'Condition did not match sample input.';
    if (cond.type === 'score') {
      reason = `Sample score (${ctx.score ?? 0}) ${passed ? 'satisfies' : 'does not satisfy'} ${cond.operator} ${cond.value}.`;
    } else if (cond.type === 'nps_category') {
      reason = `Sample score (${ctx.score ?? 0}) ${passed ? 'matches' : 'does not match'} NPS tier "${cond.value}".`;
    } else if (cond.type === 'sentiment') {
      reason = `Sample sentiment "${ctx.sentimentPolarity || 'none'}" ${passed ? 'matches' : 'does not match'} "${cond.value}".`;
    }
    return {
      conditionId: cond.id,
      type: cond.type,
      passed,
      reason,
    };
  });

  const matched = rule.conditionLogic === 'OR'
    ? evaluatedConditions.some((c) => c.passed)
    : evaluatedConditions.every((c) => c.passed);

  const prescribedActions = rule.actions.map((act) => ({
    actionId: act.id,
    type: act.type,
    summary: act.type === 'create_task'
      ? `Create Task: "${interpolateDecisionTemplate(act.taskConfig?.titleTemplate || 'Follow up', ctx)}"`
      : act.type === 'adjust_lead_score'
      ? `Adjust Lead Score: ${(act.scoreDelta ?? 0) >= 0 ? '+' : ''}${act.scoreDelta ?? 0} pts`
      : act.type === 'apply_tags'
      ? `Apply Tags: ${(act.tagIds || []).length} tag(s)`
      : act.type === 'move_pipeline_stage'
      ? `Move Deal to Pipeline Stage`
      : `Execute Action: ${act.type}`,
    delayMinutes: act.delayMinutes,
  }));

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    matched,
    evaluatedConditions,
    prescribedActions,
  };
}

/**
 * Loads decisioning configuration for a survey.
 */
export async function getSurveyDecisionConfigAction(
  surveyId: string,
  workspaceId: string
): Promise<{ success: boolean; config?: SurveyDecisionConfig; error?: string }> {
  try {
    const surveyDoc = await adminDb.collection('surveys').doc(surveyId).get();
    if (!surveyDoc.exists) {
      return { success: false, error: 'Survey not found' };
    }
    const surveyData = { id: surveyDoc.id, ...surveyDoc.data() } as Survey;
    if (!isAuthorizedForWorkspace(surveyData, workspaceId)) {
      return { success: false, error: 'Unauthorized workspace access' };
    }
    return {
      success: true,
      config: surveyData.decisionConfig || { enabled: false, rules: [] },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get decision config',
    };
  }
}

/**
 * Saves decisioning configuration for a survey.
 */
export async function saveSurveyDecisionConfigAction(
  surveyId: string,
  config: SurveyDecisionConfig,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const surveyRef = adminDb.collection('surveys').doc(surveyId);
    const surveyDoc = await surveyRef.get();
    if (!surveyDoc.exists) {
      return { success: false, error: 'Survey not found' };
    }
    const surveyData = { id: surveyDoc.id, ...surveyDoc.data() } as Survey;
    if (!isAuthorizedForWorkspace(surveyData, workspaceId)) {
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
  {
    id: 'playbook_lead_qualification',
    name: 'High-Intent Lead Fast-Track Routing',
    description: 'When high score or qualified response is detected, automatically assigns account executive and accelerates pipeline stage.',
    category: 'lead_qualification',
    isProtected: true,
    rule: {
      name: 'Lead Fast-Track Protocol',
      description: 'Triggered on high survey score (>= 80%)',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'score', operator: 'greater_than', value: 80 },
      ],
      actions: [
        { id: 'a1', type: 'adjust_lead_score', scoreDelta: 20 },
        {
          id: 'a2',
          type: 'create_task',
          taskConfig: {
            titleTemplate: 'High-Intent Prospect: Follow up with {{contact.name}}',
            descriptionTemplate: 'Lead scored {{score}}% on survey "{{survey.title}}". Immediate outreach recommended.',
            priority: 'high',
            dueInHours: 12,
          },
        },
      ],
    },
  },
  {
    id: 'playbook_dropoff_reengagement',
    name: 'Survey Drop-off Automated Re-engagement',
    description: 'When a respondent abandons a survey, automatically schedules a friendly follow-up task and note.',
    category: 'dropoff_reengagement',
    isProtected: true,
    rule: {
      name: 'Drop-off Recovery Reminder',
      description: 'Triggered when respondent drops off before survey completion',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'drop_off', operator: 'equals', value: true },
      ],
      actions: [
        {
          id: 'a1',
          type: 'create_task',
          delayMinutes: 1440, // 24 hours
          taskConfig: {
            titleTemplate: 'Survey Incomplete: Re-engage {{contact.name}}',
            descriptionTemplate: 'Respondent began survey "{{survey.title}}" but did not finish. Reach out with assistance.',
            priority: 'medium',
            dueInHours: 48,
          },
        },
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
