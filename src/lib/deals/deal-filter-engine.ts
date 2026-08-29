/**
 * @fileoverview Pure Deterministic Filter Evaluation Engine for Deals Platform 2.0
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Section 32, UI Section 15):
 * - Evaluates multi-condition rule trees and conjunction groups (AND/OR) against deal records.
 * - Handles numbers, strings, arrays, timestamps, and dynamic date boundaries (e.g. 'current_month').
 * - 100% pure function with zero database side-effects for maximum performance and testability.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Safe numeric, string, and date parsing with non-crashing fallbacks.
 *
 * TESTABILITY POINTER:
 * Covered by unit tests in `src/lib/deals/__tests__/deal-filter-engine.test.ts`.
 */

import type { Deal, OnboardingStage } from '../types';
import type {
  DealFilterTree,
  DealFilterGroup,
  DealFilterRule,
} from './deal-saved-views';
export type { DealFilterTree, DealFilterGroup, DealFilterRule };
import { calculateDaysInStage, calculateDealHealth } from './deal-health-engine';

export interface FilterEvaluationContext {
  currentUserId?: string;
  now?: Date;
  stagesMap?: Map<string, OnboardingStage>;
  stages?: OnboardingStage[];
}

/**
 * Extracts a comparable field value from a Deal record
 */
export function extractDealFieldValue(
  deal: Deal,
  field: string,
  context?: FilterEvaluationContext
): string | number | boolean | string[] | null | undefined {
  const now = context?.now || new Date();

  switch (field) {
    case 'name':
      return deal.name;
    case 'value':
      return typeof deal.value === 'number' ? deal.value : 0;
    case 'mrr':
      return typeof deal.mrr === 'number' ? deal.mrr : 0;
    case 'arr':
      return typeof deal.arr === 'number' ? deal.arr : 0;
    case 'stageId':
      return deal.stageId || '';
    case 'status':
      return deal.status || 'open';
    case 'ownerId':
    case 'assignedTo':
      return deal.assignedTo?.userId || null;
    case 'probability':
      return typeof deal.probability === 'number' ? deal.probability : 0;
    case 'forecastCategory':
      return deal.forecastCategory || 'pipeline';
    case 'healthStatus': {
      const stage = deal.stageId && context?.stagesMap ? context.stagesMap.get(deal.stageId) : undefined;
      const health = calculateDealHealth(deal, stage, undefined, now);
      return health.status;
    }
    case 'daysInStage':
      return calculateDaysInStage(deal.stageEnteredAt || deal.createdAt, undefined, now);
    case 'dealAge': {
      const created = new Date(deal.createdAt).getTime();
      const diffDays = Math.max(0, Math.floor((now.getTime() - created) / (1000 * 60 * 60 * 24)));
      return diffDays;
    }
    case 'expectedCloseDate':
      return deal.expectedCloseDate || null;
    case 'createdAt':
      return deal.createdAt;
    case 'contractStatus':
      return deal.contractStatus || 'none';
    case 'tagIds':
      return deal.tags || [];
    case 'source':
      return deal.source || null;
    case 'nextStep':
      return typeof deal.nextStep === 'string' ? deal.nextStep : (deal.nextStep?.title || null);
    default: {
      // Check customFields dictionary
      if (deal.customFields && field in deal.customFields) {
        const val = deal.customFields[field];
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          return val;
        }
      }
      return null;
    }
  }
}

/**
 * Checks whether a date string falls in the current calendar month
 */
function isDateInCurrentMonth(dateStr: string | null | undefined, now: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Evaluates a single filter rule against a deal record
 */
export function evaluateDealFilterRule(
  deal: Deal,
  rule: DealFilterRule,
  context?: FilterEvaluationContext
): boolean {
  const now = context?.now || new Date();
  const rawValue = extractDealFieldValue(deal, rule.field, context);

  // 1. Special case: Dynamic Value Tokens (e.g. 'current_user', 'current_month')
  if (rule.field === 'ownerId' && rule.value === 'current_user') {
    const ownerId = typeof rawValue === 'string' ? rawValue : null;
    return context?.currentUserId ? ownerId === context.currentUserId : true;
  }

  if (rule.field === 'expectedCloseDate' && rule.value === 'current_month') {
    const isThisMonth = isDateInCurrentMonth(typeof rawValue === 'string' ? rawValue : null, now);
    return rule.operator === 'equals' ? isThisMonth : !isThisMonth;
  }

  // 2. Empty / Not Empty operators
  if (rule.operator === 'is_empty') {
    if (rawValue === null || rawValue === undefined || rawValue === '') return true;
    if (Array.isArray(rawValue) && rawValue.length === 0) return true;
    return false;
  }

  if (rule.operator === 'is_not_empty') {
    if (rawValue === null || rawValue === undefined || rawValue === '') return false;
    if (Array.isArray(rawValue) && rawValue.length === 0) return false;
    return true;
  }

  // 3. String & Array Contains operators
  if (rule.operator === 'contains' || rule.operator === 'not_contains') {
    const targetStr = String(rule.value ?? '').toLowerCase();
    let matches = false;

    if (Array.isArray(rawValue)) {
      matches = rawValue.some(item => String(item).toLowerCase().includes(targetStr));
    } else if (typeof rawValue === 'string') {
      matches = rawValue.toLowerCase().includes(targetStr);
    }

    return rule.operator === 'contains' ? matches : !matches;
  }

  // 4. In / Not In (Array comparison)
  if (rule.operator === 'in' || rule.operator === 'not_in') {
    const targetArray = Array.isArray(rule.value) ? rule.value : [String(rule.value)];
    let matches = false;

    if (Array.isArray(rawValue)) {
      matches = rawValue.some(v => targetArray.includes(String(v)));
    } else if (rawValue !== null && rawValue !== undefined) {
      matches = targetArray.includes(String(rawValue));
    }

    return rule.operator === 'in' ? matches : !matches;
  }

  // 5. Numeric & Range operators
  if (typeof rawValue === 'number' || typeof rule.value === 'number') {
    const numVal = typeof rawValue === 'number' ? rawValue : Number(rawValue || 0);
    const targetNum = Number(rule.value || 0);

    switch (rule.operator) {
      case 'equals':
        return numVal === targetNum;
      case 'not_equals':
        return numVal !== targetNum;
      case 'greater_than':
        return numVal > targetNum;
      case 'greater_than_or_equal':
        return numVal >= targetNum;
      case 'less_than':
        return numVal < targetNum;
      case 'less_than_or_equal':
        return numVal <= targetNum;
      case 'is_between': {
        const targetTo = Number(rule.valueTo || targetNum);
        const lower = Math.min(targetNum, targetTo);
        const upper = Math.max(targetNum, targetTo);
        return numVal >= lower && numVal <= upper;
      }
      default:
        return false;
    }
  }

  // 6. Standard String / Boolean Equality
  const valStr = String(rawValue ?? '').toLowerCase();
  const ruleStr = String(rule.value ?? '').toLowerCase();

  switch (rule.operator) {
    case 'equals':
      return valStr === ruleStr;
    case 'not_equals':
      return valStr !== ruleStr;
    default:
      return false;
  }
}

/**
 * Evaluates a single filter group against a deal record
 */
export function evaluateDealFilterGroup(
  deal: Deal,
  group: DealFilterGroup,
  context?: FilterEvaluationContext
): boolean {
  if (!group.rules || group.rules.length === 0) return true;

  if (group.conjunction === 'OR') {
    return group.rules.some(rule => evaluateDealFilterRule(deal, rule, context));
  } else {
    return group.rules.every(rule => evaluateDealFilterRule(deal, rule, context));
  }
}

/**
 * Evaluates an entire nested filter tree against a deal record
 */
export function evaluateDealFilterTree(
  deal: Deal,
  tree: DealFilterTree | null | undefined,
  context?: FilterEvaluationContext
): boolean {
  if (!tree || !tree.groups || tree.groups.length === 0) return true;

  if (tree.conjunction === 'OR') {
    return tree.groups.some(group => evaluateDealFilterGroup(deal, group, context));
  } else {
    return tree.groups.every(group => evaluateDealFilterGroup(deal, group, context));
  }
}

/**
 * Helper to count how many deals match a filter tree
 */
export function countMatchingDeals(
  deals: Deal[],
  tree: DealFilterTree | null | undefined,
  context?: FilterEvaluationContext
): number {
  if (!tree || !tree.groups || tree.groups.length === 0) return deals.length;
  return deals.filter(deal => evaluateDealFilterTree(deal, tree, context)).length;
}
