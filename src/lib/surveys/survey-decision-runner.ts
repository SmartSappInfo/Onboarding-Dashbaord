/**
 * @fileOverview Survey decision runner (agents_mcp N1 / FU-14).
 *
 * WHY THIS FILE IS NOT `'use server'`: these functions trust their context — the survey (with its
 * decision rules) and the workspace. They used to live in `survey-decision-engine.ts`, where
 * `runSurveyDecisionPipeline` was a public endpoint taking the whole survey from the
 * caller, so anyone could run arbitrary decision actions (tags, tasks, deals, webhooks) in any
 * workspace. Only the public submission flow in `survey-actions.ts` calls this, with the STORED
 * survey and its workspace. Never re-export these from a `'use server'` module.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  SurveyDecisionAction,
  SurveyDecisionExecutionLog,
} from '@/lib/types';
import { createDealCore } from '@/lib/crm/deal-core';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import { type SurveyDecisionContext, evaluateDecisionRule } from './survey-decision-evaluator';

/**
 * Safely resolves dynamic variable tokens in templates using FieldsVariablesService.
 */
export function interpolateDecisionTemplate(template: string, ctx: SurveyDecisionContext): string {
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
export async function runSingleDecisionAction(
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

        await createDealCore({ kind: 'service', service: 'surveys', workspaceId }, {
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

        await createDealCore({ kind: 'service', service: 'surveys', workspaceId }, {
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
    console.error('[decision-engine] runSingleDecisionAction error:', err);
    return {
      success: false,
      actionType: action.type,
      error: toClientErrorMessage('surveys.survey-decision-engine', err, undefined, 'Unknown execution error'),
    };
  }
}

/**
 * Top-level execution pipeline that evaluates and fires survey decision rules.
 */
export async function runSurveyDecisionPipeline(
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
          const actionRes = await runSingleDecisionAction(action, ctx);
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
    console.error('[decision-engine] runSurveyDecisionPipeline error:', error);
    return {
      success: false,
      executedRulesCount: 0,
      executionLogs: [],
    };
  }
}
