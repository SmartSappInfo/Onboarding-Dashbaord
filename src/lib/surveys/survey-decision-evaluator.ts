/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 7: Pure Decision Evaluator
 * 
 * Synchronous, pure evaluation functions for survey decision conditions and rules.
 * Extracted from Server Action boundary to ensure Next.js Server Actions compiler compliance.
 */

import type {
  Survey,
  SurveyDecisionRule,
  SurveyDecisionCondition,
} from '@/lib/types';

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
  isDropOff?: boolean;
  quotaReached?: boolean;
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
      // NPS categories: promoter (9-10 or 90-100), passive (7-8 or 70-89), detractor (0-6 or 0-69)
      if (targetCategory === 'promoter') return score >= 9 || score >= 90;
      if (targetCategory === 'passive') return (score >= 7 && score <= 8) || (score >= 70 && score < 90);
      if (targetCategory === 'detractor') return score <= 6 || (score >= 0 && score < 70);
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
      if (!ans || ans.value === undefined || ans.value === null) {
        return cond.operator === 'is_empty';
      }

      if (cond.operator === 'is_not_empty') return true;
      if (cond.operator === 'is_empty') return false;

      // Array values (multi-select / checkboxes)
      if (Array.isArray(ans.value)) {
        const targetStr = String(cond.value).toLowerCase();
        const arrayStr = ans.value.map((v) => String(v).toLowerCase());

        if (cond.operator === 'has_any_option') {
          const targets = Array.isArray(cond.value) ? cond.value.map(String) : [targetStr];
          return targets.some((t) => arrayStr.includes(t.toLowerCase()));
        }
        if (cond.operator === 'has_all_options') {
          const targets = Array.isArray(cond.value) ? cond.value.map(String) : [targetStr];
          return targets.every((t) => arrayStr.includes(t.toLowerCase()));
        }
        if (cond.operator === 'contains') return arrayStr.includes(targetStr);
        if (cond.operator === 'does_not_contain') return !arrayStr.includes(targetStr);
        return false;
      }

      // String / numeric comparison
      const rawVal = typeof ans.value === 'object' ? JSON.stringify(ans.value) : String(ans.value);
      const strVal = rawVal.toLowerCase();
      const targetStr = String(cond.value).toLowerCase();

      if (cond.operator === 'equals') return strVal === targetStr;
      if (cond.operator === 'not_equals') return strVal !== targetStr;
      if (cond.operator === 'contains') return strVal.includes(targetStr);
      if (cond.operator === 'does_not_contain') return !strVal.includes(targetStr);
      if (cond.operator === 'starts_with') return strVal.startsWith(targetStr);

      const numAns = Number(ans.value);
      const numTarget = Number(cond.value);
      if (!isNaN(numAns) && !isNaN(numTarget)) {
        if (cond.operator === 'greater_than') return numAns > numTarget;
        if (cond.operator === 'less_than') return numAns < numTarget;
      }
      return false;
    }

    case 'contact_tag': {
      const contactTags = (ctx.contactTags || []).map((t) => t.toLowerCase());
      const targetTags = Array.isArray(cond.value)
        ? cond.value.map((t) => String(t).toLowerCase())
        : [String(cond.value).toLowerCase()];

      if (cond.operator === 'has_any_tag') {
        return targetTags.some((t) => contactTags.includes(t));
      }
      if (cond.operator === 'has_all_tags') {
        return targetTags.every((t) => contactTags.includes(t));
      }
      return false;
    }

    case 'anomaly_detected': {
      return Boolean(ctx.isAnomaly);
    }

    case 'drop_off': {
      return Boolean(ctx.isDropOff);
    }

    case 'quota_reached': {
      return Boolean(ctx.quotaReached);
    }

    default:
      return false;
  }
}

/**
 * Evaluates whether an entire decision rule matches the given context.
 */
export function evaluateDecisionRule(
  rule: SurveyDecisionRule,
  ctx: SurveyDecisionContext
): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  if (rule.conditionLogic === 'OR') {
    return rule.conditions.some((cond) => evaluateCondition(cond, ctx));
  }

  // Default: 'AND'
  return rule.conditions.every((cond) => evaluateCondition(cond, ctx));
}
