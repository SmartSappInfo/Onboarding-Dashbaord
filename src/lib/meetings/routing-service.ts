/**
 * @fileoverview Pure Smart Routing Service.
 * Evaluates prospect form responses against conditional routing rules to determine
 * the destination Event Type, custom URL, or message fallback.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure evaluation with zero side effects.
 * - Handles type coercion gracefully (strings vs numbers vs arrays).
 */

import type {
  RoutingRule,
  RoutingCondition,
  RoutingDestination,
  RoutingEvaluationResult,
} from './types/routing';

/**
 * Evaluates a single condition predicate against a user's field answer.
 */
export function evaluateCondition(
  condition: RoutingCondition,
  answerValue: unknown
): boolean {
  if (answerValue === undefined || answerValue === null) {
    return condition.operator === 'not_equals';
  }

  const { operator, value: targetValue } = condition;

  switch (operator) {
    case 'equals': {
      if (typeof answerValue === 'string' && typeof targetValue === 'string') {
        return answerValue.trim().toLowerCase() === targetValue.trim().toLowerCase();
      }
      return String(answerValue) === String(targetValue);
    }

    case 'not_equals': {
      if (typeof answerValue === 'string' && typeof targetValue === 'string') {
        return answerValue.trim().toLowerCase() !== targetValue.trim().toLowerCase();
      }
      return String(answerValue) !== String(targetValue);
    }

    case 'contains': {
      const strAnswer = String(answerValue).toLowerCase();
      const strTarget = String(targetValue).toLowerCase();
      return strAnswer.includes(strTarget);
    }

    case 'not_contains': {
      const strAnswer = String(answerValue).toLowerCase();
      const strTarget = String(targetValue).toLowerCase();
      return !strAnswer.includes(strTarget);
    }

    case 'greater_than': {
      const numAnswer = Number(answerValue);
      const numTarget = Number(targetValue);
      if (isNaN(numAnswer) || isNaN(numTarget)) return false;
      return numAnswer > numTarget;
    }

    case 'less_than': {
      const numAnswer = Number(answerValue);
      const numTarget = Number(targetValue);
      if (isNaN(numAnswer) || isNaN(numTarget)) return false;
      return numAnswer < numTarget;
    }

    case 'in_array': {
      const targetArray = Array.isArray(targetValue)
        ? targetValue.map(v => String(v).trim().toLowerCase())
        : [String(targetValue).trim().toLowerCase()];

      if (Array.isArray(answerValue)) {
        return answerValue.some(v => targetArray.includes(String(v).trim().toLowerCase()));
      }

      return targetArray.includes(String(answerValue).trim().toLowerCase());
    }

    default:
      return false;
  }
}

/**
 * Evaluates a rule containing multiple conditions using AND / OR logic.
 */
export function evaluateRoutingRule(
  rule: RoutingRule,
  answers: Record<string, unknown>
): boolean {
  if (!rule.conditions || rule.conditions.length === 0) {
    return true;
  }

  if (rule.conditionLogic === 'or') {
    return rule.conditions.some(condition => {
      const answer = answers[condition.fieldId];
      return evaluateCondition(condition, answer);
    });
  }

  // Default to 'and' logic
  return rule.conditions.every(condition => {
    const answer = answers[condition.fieldId];
    return evaluateCondition(condition, answer);
  });
}

/**
 * Evaluates all rules sequentially and returns the destination of the first matching rule,
 * or the default fallback destination if no rules match.
 */
export function evaluateRoutingRules(
  answers: Record<string, unknown>,
  rules: RoutingRule[],
  fallbackDestination: RoutingDestination,
  formAutoTagIds: string[] = []
): RoutingEvaluationResult {
  const appliedTags = [...formAutoTagIds];

  for (const rule of rules) {
    if (evaluateRoutingRule(rule, answers)) {
      if (rule.autoTagIds && rule.autoTagIds.length > 0) {
        appliedTags.push(...rule.autoTagIds);
      }

      return {
        destination: rule.destination,
        matchedRule: rule,
        appliedTagIds: Array.from(new Set(appliedTags)),
      };
    }
  }

  // No rule matched; return fallback destination
  return {
    destination: fallbackDestination,
    appliedTagIds: Array.from(new Set(appliedTags)),
  };
}
