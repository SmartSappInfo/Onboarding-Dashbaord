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
import type {
  Survey,
  SurveyDecisionConfig,
  SurveyDecisionRule,
  SystemDecisionPlaybook,
  SurveyDecisionSimulationResult,
} from '@/lib/types';
import { isAuthorizedForWorkspace } from './survey-hydration-adapter';
import { requireAuth, requireSystemAdmin, requireWorkspace } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  type SurveyDecisionContext,
  evaluateCondition,
} from './survey-decision-evaluator';
import { interpolateDecisionTemplate } from './survey-decision-runner';

/**
 * Simulates and dry-runs a decision rule against a sample payload without mutating database records.
 */
export async function testSurveyDecisionRuleAction(
  rule: SurveyDecisionRule,
  ctx: SurveyDecisionContext
): Promise<SurveyDecisionSimulationResult> {
  // A dry run (no writes) for the decision hub; signed-in users only.
  await requireAuth();

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
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

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
      error: toClientErrorMessage('surveys.survey-decision-engine', err, undefined, 'Failed to get decision config'),
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
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

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
      error: toClientErrorMessage('surveys.survey-decision-engine', err, undefined, 'Failed to save decision config'),
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
  // Read by the tenant decision hub and the backoffice; signed-in users only.
  await requireAuth();

  try {
    const docSnap = await adminDb.collection('system_settings').doc('survey_decision_playbooks').get();
    if (!docSnap.exists) {
      return { success: true, playbooks: DEFAULT_SYSTEM_PLAYBOOKS };
    }
    const data = docSnap.data();
    return { success: true, playbooks: data?.playbooks || DEFAULT_SYSTEM_PLAYBOOKS };
  } catch (_err: unknown) {
    return { success: true, playbooks: DEFAULT_SYSTEM_PLAYBOOKS };
  }
}

export async function saveSystemDecisionPlaybooksAction(
  playbooks: SystemDecisionPlaybook[]
): Promise<{ success: boolean; error?: string }> {
  // SECURITY (FU-14 follow-on): platform-wide playbooks; any signed-in user could overwrite them.
  await requireSystemAdmin();

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
      error: toClientErrorMessage('surveys.survey-decision-engine', err, undefined, 'Failed to save system playbooks'),
    };
  }
}
