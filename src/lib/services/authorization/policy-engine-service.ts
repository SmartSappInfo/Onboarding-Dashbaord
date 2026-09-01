/**
 * @fileOverview Attribute-Based Access Control (ABAC) Policy Evaluator (Authorization 2.0)
 *
 * Evaluates contextual constraints (resource ownership, workspace matching, time-of-day,
 * department scoping) and enforces explicit `deny` overrides.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Deterministic, memory-safe evaluation with zero runtime eval() or regex vulnerability.
 * - Explicit `deny` rules always take absolute precedence over `allow` grants.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `authorization-services.test.ts`.
 */

import type { PolicyRule, PolicyCondition, AccessEvaluationResult } from '@/lib/types';

export interface EvaluationContext {
  actor: {
    uid: string;
    organizationId: string;
    workspaceId?: string;
    department?: string;
    roles?: string[];
  };
  resource?: {
    type: string;
    id?: string;
    ownerId?: string;
    organizationId?: string;
    workspaceId?: string;
    department?: string;
    status?: string;
  };
  action: string;
  environment?: {
    currentTime?: string;
    ipAddress?: string;
  };
}

export class PolicyEngineService {
  /**
   * Evaluates a single condition against the context dictionary.
   */
  static evaluateCondition(condition: PolicyCondition, context: EvaluationContext): boolean {
    const { field, operator, value } = condition;

    // Resolve field value from context via dot notation
    let contextVal: unknown = undefined;
    const parts = field.split('.');

    if (parts[0] === 'actor') {
      contextVal = context.actor[parts[1] as keyof typeof context.actor];
    } else if (parts[0] === 'resource' && context.resource) {
      contextVal = context.resource[parts[1] as keyof typeof context.resource];
    } else if (parts[0] === 'environment' && context.environment) {
      contextVal = context.environment[parts[1] as keyof typeof context.environment];
    }

    if (contextVal === undefined) return false;

    switch (operator) {
      case 'equals':
        return String(contextVal) === String(value);

      case 'not_equals':
        return String(contextVal) !== String(value);

      case 'in':
        if (Array.isArray(value)) {
          return value.includes(String(contextVal));
        }
        return false;

      case 'contains':
        if (Array.isArray(contextVal)) {
          return (contextVal as string[]).includes(String(value));
        }
        if (typeof contextVal === 'string') {
          return contextVal.includes(String(value));
        }
        return false;

      case 'less_than':
        return Number(contextVal) < Number(value);

      case 'greater_than':
        return Number(contextVal) > Number(value);

      default:
        return false;
    }
  }

  /**
   * Evaluates an array of policy rules against the given evaluation context.
   */
  static evaluatePolicies(
    policies: PolicyRule[],
    context: EvaluationContext,
    baseRbacAllowed: boolean
  ): AccessEvaluationResult {
    const startTime = performance.now();
    const activePolicies = policies
      .filter((p) => p.status === 'active')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const matchedPolicies: string[] = [];
    const reasons: string[] = [];
    let isAllowed = baseRbacAllowed;

    for (const policy of activePolicies) {
      // Check if action matches
      const actionMatches =
        policy.actions.includes('*') ||
        policy.actions.includes(context.action) ||
        policy.actions.some((a) => context.action.startsWith(a.replace('.*', '')));

      if (!actionMatches) continue;

      // Check if resource type matches
      const resourceType = context.resource?.type || '*';
      const resourceMatches =
        policy.resources.includes('*') ||
        policy.resources.includes(resourceType);

      if (!resourceMatches) continue;

      // Check all conditions
      const allConditionsMet = policy.conditions.every((cond) =>
        this.evaluateCondition(cond, context)
      );

      if (allConditionsMet) {
        matchedPolicies.push(policy.id);

        if (policy.effect === 'deny') {
          isAllowed = false;
          reasons.push(`Explicitly denied by policy: ${policy.name}`);
          break; // Explicit deny immediately terminates evaluation
        } else if (policy.effect === 'allow') {
          isAllowed = true;
          reasons.push(`Granted by policy rule: ${policy.name}`);
        }
      }
    }

    const duration = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      isAllowed,
      grantedByRoles: context.actor.roles || [],
      matchedPolicies,
      reasons,
      evaluationDurationMs: duration,
    };
  }
}
