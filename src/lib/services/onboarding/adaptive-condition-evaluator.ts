/**
 * @fileOverview Adaptive Onboarding Step Condition Evaluator (Onboarding 2.0)
 *
 * Deterministically evaluates conditional step visibility based on member attributes
 * (department, roles, workspace, memberType) to enable tailored onboarding paths.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Pure, deterministic evaluation with zero regex/eval security risks.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `onboarding-services.test.ts`.
 */

import type { OnboardingStepCondition } from '@/lib/types';

export interface MemberEvaluationContext {
  department?: string;
  roles?: string[];
  workspaceId?: string;
  memberType?: string;
  email?: string;
}

export class AdaptiveConditionEvaluator {
  /**
   * Evaluates a single condition against member context.
   */
  static evaluateCondition(
    condition: OnboardingStepCondition,
    context: MemberEvaluationContext
  ): boolean {
    const { field, operator, value } = condition;
    const contextVal = context[field as keyof MemberEvaluationContext];

    if (contextVal === undefined || contextVal === null) {
      return false;
    }

    switch (operator) {
      case 'equals':
        return String(contextVal).toLowerCase() === String(value).toLowerCase();

      case 'not_equals':
        return String(contextVal).toLowerCase() !== String(value).toLowerCase();

      case 'in':
        if (Array.isArray(value)) {
          return value.map((v) => String(v).toLowerCase()).includes(String(contextVal).toLowerCase());
        }
        return false;

      case 'contains':
        if (Array.isArray(contextVal)) {
          return (contextVal as string[])
            .map((c) => String(c).toLowerCase())
            .includes(String(value).toLowerCase());
        }
        if (typeof contextVal === 'string') {
          return contextVal.toLowerCase().includes(String(value).toLowerCase());
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Determines if a step should be included for a given member context.
   * If a step has no conditions, it is included by default.
   */
  static isStepApplicable(
    conditions: OnboardingStepCondition[] | undefined,
    context: MemberEvaluationContext
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    // All conditions must evaluate to true (AND logic)
    return conditions.every((cond) => this.evaluateCondition(cond, context));
  }
}
