import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateRoutingRule,
  evaluateRoutingRules,
} from '../routing-service';
import type { RoutingRule, RoutingDestination } from '../types/routing';

describe('Smart Routing Engine', () => {
  it('evaluates various comparison operators accurately', () => {
    // equals
    expect(evaluateCondition({ id: 'c1', fieldId: 'role', operator: 'equals', value: 'Admin' }, 'admin')).toBe(true);
    expect(evaluateCondition({ id: 'c2', fieldId: 'role', operator: 'equals', value: 'Admin' }, 'User')).toBe(false);

    // greater_than & less_than
    expect(evaluateCondition({ id: 'c3', fieldId: 'students', operator: 'greater_than', value: 500 }, 650)).toBe(true);
    expect(evaluateCondition({ id: 'c4', fieldId: 'students', operator: 'greater_than', value: 500 }, 300)).toBe(false);
    expect(evaluateCondition({ id: 'c5', fieldId: 'budget', operator: 'less_than', value: 10000 }, 5000)).toBe(true);

    // in_array
    expect(evaluateCondition({ id: 'c6', fieldId: 'plan', operator: 'in_array', value: ['pro', 'enterprise'] }, 'enterprise')).toBe(true);
    expect(evaluateCondition({ id: 'c7', fieldId: 'plan', operator: 'in_array', value: ['pro', 'enterprise'] }, 'starter')).toBe(false);

    // contains
    expect(evaluateCondition({ id: 'c8', fieldId: 'email', operator: 'contains', value: '@edu.org' }, 'principal@edu.org')).toBe(true);
  });

  it('evaluates AND and OR condition logic in rules', () => {
    const andRule: RoutingRule = {
      id: 'r_and',
      name: 'Enterprise School',
      conditionLogic: 'and',
      conditions: [
        { id: 'c1', fieldId: 'country', operator: 'equals', value: 'Ghana' },
        { id: 'c2', fieldId: 'students', operator: 'greater_than', value: 200 },
      ],
      destination: { type: 'event_type', eventTypeId: 'et_enterprise_demo' },
    };

    expect(evaluateRoutingRule(andRule, { country: 'Ghana', students: 500 })).toBe(true);
    expect(evaluateRoutingRule(andRule, { country: 'Ghana', students: 50 })).toBe(false);
    expect(evaluateRoutingRule(andRule, { country: 'Nigeria', students: 500 })).toBe(false);

    const orRule: RoutingRule = {
      id: 'r_or',
      name: 'Urgent Prospect',
      conditionLogic: 'or',
      conditions: [
        { id: 'c1', fieldId: 'isUrgent', operator: 'equals', value: 'true' },
        { id: 'c2', fieldId: 'budget', operator: 'greater_than', value: 50000 },
      ],
      destination: { type: 'event_type', eventTypeId: 'et_vip_call' },
    };

    expect(evaluateRoutingRule(orRule, { isUrgent: 'true', budget: 100 })).toBe(true);
    expect(evaluateRoutingRule(orRule, { isUrgent: 'false', budget: 80000 })).toBe(true);
    expect(evaluateRoutingRule(orRule, { isUrgent: 'false', budget: 1000 })).toBe(false);
  });

  it('routes sequentially and applies fallback destination and auto-tags', () => {
    const rules: RoutingRule[] = [
      {
        id: 'rule_1',
        name: 'Large Enterprise',
        conditionLogic: 'and',
        conditions: [{ id: 'c1', fieldId: 'size', operator: 'greater_than', value: 1000 }],
        destination: { type: 'event_type', eventTypeId: 'et_enterprise' },
        autoTagIds: ['tag_enterprise_vip'],
      },
      {
        id: 'rule_2',
        name: 'Mid-Market',
        conditionLogic: 'and',
        conditions: [{ id: 'c2', fieldId: 'size', operator: 'greater_than', value: 200 }],
        destination: { type: 'event_type', eventTypeId: 'et_midmarket' },
        autoTagIds: ['tag_midmarket'],
      },
    ];

    const fallback: RoutingDestination = {
      type: 'event_type',
      eventTypeId: 'et_starter_self_serve',
    };

    // Case 1: Matches Large Enterprise (1500)
    const result1 = evaluateRoutingRules({ size: 1500 }, rules, fallback, ['tag_lead']);
    expect(result1.destination.eventTypeId).toBe('et_enterprise');
    expect(result1.appliedTagIds).toContain('tag_enterprise_vip');
    expect(result1.appliedTagIds).toContain('tag_lead');

    // Case 2: Matches Mid-Market (500)
    const result2 = evaluateRoutingRules({ size: 500 }, rules, fallback, ['tag_lead']);
    expect(result2.destination.eventTypeId).toBe('et_midmarket');
    expect(result2.appliedTagIds).toContain('tag_midmarket');

    // Case 3: Falls through to fallback (50)
    const result3 = evaluateRoutingRules({ size: 50 }, rules, fallback, ['tag_lead']);
    expect(result3.destination.eventTypeId).toBe('et_starter_self_serve');
    expect(result3.matchedRule).toBeUndefined();
  });
});
