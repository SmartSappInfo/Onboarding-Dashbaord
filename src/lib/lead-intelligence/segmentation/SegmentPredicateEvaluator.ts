/**
 * Dynamic Segment Predicate Evaluator & AST Rule Engine (Lead Intelligence 2.0 - Phase 10)
 * UI Spec Section 41: "Dynamic Segments Visual Rule Builder"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Pure, deterministic single-pass AST predicate evaluator with O(N) complexity.
 * 2. Strongly typed field getters and operator handlers.
 * 3. Seed template generator for RevOps backoffice governance.
 * 4. Strict Zero-`any` typing.
 */

import type {
  Prospect,
  SegmentRule,
  SegmentRuleGroup,
  SegmentPredicateField,
  SegmentOperator,
  DynamicSegment
} from '../types';

export class SegmentPredicateEvaluator {
  /**
   * Evaluates a single atomic rule against a prospect.
   */
  public static evaluateRule(prospect: Prospect, rule: SegmentRule): boolean {
    const fieldValue = this.extractFieldValue(prospect, rule.field);
    return this.applyOperator(fieldValue, rule.operator, rule.value);
  }

  /**
   * Recursively evaluates a rule group with AND/OR combinators.
   */
  public static evaluateRuleGroup(prospect: Prospect, group: SegmentRuleGroup): boolean {
    if (!group || !group.rules || group.rules.length === 0) {
      return true;
    }

    if (group.combinator === 'AND') {
      return group.rules.every((child) => {
        if ('rules' in child) {
          return this.evaluateRuleGroup(prospect, child as SegmentRuleGroup);
        }
        return this.evaluateRule(prospect, child as SegmentRule);
      });
    } else {
      // OR combinator
      return group.rules.some((child) => {
        if ('rules' in child) {
          return this.evaluateRuleGroup(prospect, child as SegmentRuleGroup);
        }
        return this.evaluateRule(prospect, child as SegmentRule);
      });
    }
  }

  /**
   * Single-pass filter returning all matching prospects for a segment rule group.
   */
  public static filterProspectsBySegment(
    prospects: Prospect[],
    group: SegmentRuleGroup
  ): Prospect[] {
    return prospects.filter((p) => this.evaluateRuleGroup(p, group));
  }

  /**
   * Default seed segment templates for RevOps & Backoffice governance.
   */
  public static getDefaultSegmentTemplates(
    workspaceId: string,
    organizationId: string
  ): DynamicSegment[] {
    const now = new Date().toISOString();
    return [
      {
        id: `seg_tmpl_high_intent_${workspaceId}`,
        workspaceId,
        organizationId,
        name: '⭐ High Priority & Intent Leaders',
        description: 'Prospects with overall priority score >= 75 and verified high buying intent',
        icon: 'star',
        isTemplate: true,
        ruleGroup: {
          id: 'grp_1',
          combinator: 'AND',
          rules: [
            {
              id: 'r_1',
              field: 'overallScore',
              operator: 'greater_than',
              value: 75
            },
            {
              id: 'r_2',
              field: 'buyingIntent',
              operator: 'greater_than',
              value: 15
            }
          ]
        },
        createdAt: now,
        updatedAt: now
      },
      {
        id: `seg_tmpl_payment_gaps_${workspaceId}`,
        workspaceId,
        organizationId,
        name: '⚠️ Payment Gateway Gaps',
        description: 'Educational institutions without Paystack or online checkout stacks',
        icon: 'credit-card',
        isTemplate: true,
        ruleGroup: {
          id: 'grp_2',
          combinator: 'AND',
          rules: [
            {
              id: 'r_3',
              field: 'technologies',
              operator: 'not_contains',
              value: 'Paystack'
            },
            {
              id: 'r_4',
              field: 'crmStatus',
              operator: 'not_equals',
              value: 'synced'
            }
          ]
        },
        createdAt: now,
        updatedAt: now
      },
      {
        id: `seg_tmpl_verified_leaders_${workspaceId}`,
        workspaceId,
        organizationId,
        name: '🎯 Verified Leadership Ready',
        description: 'Unregistered prospects with verified decision-maker emails',
        icon: 'user-check',
        isTemplate: true,
        ruleGroup: {
          id: 'grp_3',
          combinator: 'AND',
          rules: [
            {
              id: 'r_5',
              field: 'hasVerifiedContact',
              operator: 'is_true',
              value: true
            },
            {
              id: 'r_6',
              field: 'crmStatus',
              operator: 'not_equals',
              value: 'synced'
            }
          ]
        },
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  // --- Private Extraction & Comparison Helpers ---

  private static extractFieldValue(
    prospect: Prospect,
    field: SegmentPredicateField
  ): unknown {
    switch (field) {
      case 'overallScore':
        return prospect.scoring?.overallScore ?? 0;
      case 'needScore':
        return prospect.scoring?.needScore ?? 0;
      case 'buyingIntent':
        return prospect.scoring?.buyingIntent ?? 0;
      case 'icpFitScore':
        return prospect.researchDossier?.icpFitScore ?? (prospect.rating ? Math.round(prospect.rating * 20) : 50);
      case 'crmStatus':
        return prospect.syncStatus;
      case 'industry':
        return prospect.industry || '';
      case 'city':
        return prospect.address || '';
      case 'country':
        return prospect.address?.toLowerCase().includes('ghana') ? 'Ghana' : 'Other';
      case 'hasVerifiedContact':
        return (prospect.contacts || []).some(
          (c) => c.verificationStatus === 'verified' || (c.deliverabilityScore && c.deliverabilityScore >= 80)
        );
      case 'technologies':
        return prospect.websiteScan?.technologies || [];
      case 'signals':
        return prospect.activeSignalsCount ?? 0;
      default:
        return undefined;
    }
  }

  private static applyOperator(
    targetVal: unknown,
    operator: SegmentOperator,
    ruleVal: string | number | boolean | string[]
  ): boolean {
    if (operator === 'is_true') return Boolean(targetVal);
    if (operator === 'is_false') return !Boolean(targetVal);

    if (operator === 'greater_than') {
      const numTarget = Number(targetVal) || 0;
      const numRule = Number(ruleVal) || 0;
      return numTarget > numRule;
    }

    if (operator === 'less_than') {
      const numTarget = Number(targetVal) || 0;
      const numRule = Number(ruleVal) || 0;
      return numTarget < numRule;
    }

    if (operator === 'equals') {
      return String(targetVal).toLowerCase().trim() === String(ruleVal).toLowerCase().trim();
    }

    if (operator === 'not_equals') {
      return String(targetVal).toLowerCase().trim() !== String(ruleVal).toLowerCase().trim();
    }

    if (operator === 'contains') {
      if (Array.isArray(targetVal)) {
        const queryStr = String(ruleVal).toLowerCase().trim();
        return targetVal.some((item) => String(item).toLowerCase().includes(queryStr));
      }
      return String(targetVal).toLowerCase().includes(String(ruleVal).toLowerCase().trim());
    }

    if (operator === 'not_contains') {
      if (Array.isArray(targetVal)) {
        const queryStr = String(ruleVal).toLowerCase().trim();
        return !targetVal.some((item) => String(item).toLowerCase().includes(queryStr));
      }
      return !String(targetVal).toLowerCase().includes(String(ruleVal).toLowerCase().trim());
    }

    if (operator === 'in') {
      if (Array.isArray(ruleVal)) {
        return ruleVal.map(r => String(r).toLowerCase().trim()).includes(String(targetVal).toLowerCase().trim());
      }
      return false;
    }

    return false;
  }
}
