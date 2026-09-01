import { describe, it, expect } from 'vitest';
import {
  evaluateSafeFormula,
  evaluateCondition,
  evaluateConditionGroup,
  detectLogicCycles,
  evaluateFormLogic,
} from '../logic-engine';
import type { FormLogicRule, FormCalculationRule, FormScoreRule } from '../form-logic-types';
import type { FormPage } from '../form-types';

describe('SmartSapp Forms 2.0: Logic Engine Tests', () => {
  describe('evaluateSafeFormula (Safe Arithmetic Parser)', () => {
    it('evaluates basic addition, subtraction, multiplication, and division with variable substitution', () => {
      const data = { qty: 5, unit_price: 20, discount: 10 };
      const formula = '{{qty}} * {{unit_price}} - {{discount}}';
      const result = evaluateSafeFormula(formula, data);
      expect(result).toBe(90);
    });

    it('evaluates complex parenthesized expressions and percentage formulas', () => {
      const data = { base: 100, tax_rate: 0.15, fee: 5 };
      const formula = '({{base}} * (1 + {{tax_rate}})) + {{fee}}';
      const result = evaluateSafeFormula(formula, data);
      expect(result).toBe(120);
    });

    it('returns null on invalid or unsafe expressions', () => {
      expect(evaluateSafeFormula('alert(1)', {})).toBeNull();
      expect(evaluateSafeFormula('2 + ; 3', {})).toBeNull();
      expect(evaluateSafeFormula('', {})).toBeNull();
    });
  });

  describe('evaluateCondition (Comparison Operators)', () => {
    it('evaluates string equality and containment', () => {
      expect(evaluateCondition({ id: 'c1', fieldId: 'city', operator: 'equals', value: 'London' }, { city: 'london' })).toBe(true);
      expect(evaluateCondition({ id: 'c2', fieldId: 'city', operator: 'not_equals', value: 'Paris' }, { city: 'London' })).toBe(true);
      expect(evaluateCondition({ id: 'c3', fieldId: 'tagline', operator: 'contains', value: 'tech' }, { tagline: 'Fintech Leader' })).toBe(true);
    });

    it('evaluates numeric comparisons and between ranges', () => {
      expect(evaluateCondition({ id: 'c4', fieldId: 'score', operator: 'greater_than', value: 50 }, { score: 75 })).toBe(true);
      expect(evaluateCondition({ id: 'c5', fieldId: 'score', operator: 'less_than', value: 50 }, { score: 75 })).toBe(false);
      expect(evaluateCondition({ id: 'c6', fieldId: 'age', operator: 'between', value: 18, secondaryValue: 65 }, { age: 30 })).toBe(true);
      expect(evaluateCondition({ id: 'c7', fieldId: 'age', operator: 'between', value: 18, secondaryValue: 65 }, { age: 70 })).toBe(false);
    });

    it('evaluates regex matches', () => {
      expect(evaluateCondition({ id: 'c8', fieldId: 'zip', operator: 'regex_matches', value: '^\\d{5}$' }, { zip: '90210' })).toBe(true);
      expect(evaluateCondition({ id: 'c9', fieldId: 'zip', operator: 'regex_matches', value: '^\\d{5}$' }, { zip: 'invalid' })).toBe(false);
    });

    it('evaluates is_empty and is_not_empty', () => {
      expect(evaluateCondition({ id: 'c10', fieldId: 'notes', operator: 'is_empty' }, { notes: '' })).toBe(true);
      expect(evaluateCondition({ id: 'c11', fieldId: 'notes', operator: 'is_empty' }, { notes: null })).toBe(true);
      expect(evaluateCondition({ id: 'c12', fieldId: 'notes', operator: 'is_not_empty' }, { notes: 'hello' })).toBe(true);
    });
  });

  describe('detectLogicCycles (DAG Branching Validator)', () => {
    const pages: FormPage[] = [
      { id: 'p1', title: 'Page 1', order: 0, components: [{ id: 'c1', type: 'field', fieldId: 'f1', order: 0, layout: { width: 'full' } }] },
      { id: 'p2', title: 'Page 2', order: 1, components: [{ id: 'c2', type: 'field', fieldId: 'f2', order: 0, layout: { width: 'full' } }] },
      { id: 'p3', title: 'Page 3', order: 2, components: [{ id: 'c3', type: 'field', fieldId: 'f3', order: 0, layout: { width: 'full' } }] },
    ];

    it('detects no cycle in linear or forward branching flow', () => {
      const rules: FormLogicRule[] = [
        {
          id: 'r1',
          name: 'Jump to P3',
          enabled: true,
          priority: 0,
          conditionGroup: { id: 'g1', combinator: 'AND', conditions: [{ id: 'c1', fieldId: 'f1', operator: 'equals', value: 'VIP' }] },
          actions: [{ id: 'a1', type: 'jump_to_page', targetPageId: 'p3' }],
        },
      ];
      const result = detectLogicCycles(pages, rules);
      expect(result.hasCycle).toBe(false);
    });

    it('detects circular jump loops', () => {
      const rules: FormLogicRule[] = [
        {
          id: 'r1',
          name: 'Jump P1 to P2',
          enabled: true,
          priority: 0,
          conditionGroup: { id: 'g1', combinator: 'AND', conditions: [{ id: 'c1', fieldId: 'f1', operator: 'equals', value: 'A' }] },
          actions: [{ id: 'a1', type: 'jump_to_page', targetPageId: 'p2' }],
        },
        {
          id: 'r2',
          name: 'Jump P2 to P1',
          enabled: true,
          priority: 1,
          conditionGroup: { id: 'g2', combinator: 'AND', conditions: [{ id: 'c2', fieldId: 'f2', operator: 'equals', value: 'B' }] },
          actions: [{ id: 'a2', type: 'jump_to_page', targetPageId: 'p1' }],
        },
      ];
      const result = detectLogicCycles(pages, rules);
      expect(result.hasCycle).toBe(true);
      expect(result.error).toContain('Circular logic jump detected');
    });
  });

  describe('evaluateFormLogic (Full Simulation Pass)', () => {
    it('executes visibility actions, calculations, scoring, and tags in a single pass', () => {
      const rules: FormLogicRule[] = [
        {
          id: 'r1',
          name: 'Show VIP package if high budget',
          enabled: true,
          priority: 0,
          conditionGroup: {
            id: 'cg1',
            combinator: 'AND',
            conditions: [{ id: 'c1', fieldId: 'budget', operator: 'greater_than', value: 10000 }],
          },
          actions: [
            { id: 'a1', type: 'show_field', targetFieldId: 'vip_package' },
            { id: 'a2', type: 'assign_tag', tagId: 'tag_enterprise_lead' },
          ],
        },
      ];

      const calculations: FormCalculationRule[] = [
        {
          id: 'calc1',
          name: 'Total Cost',
          targetFieldId: 'total_cost',
          formula: '{{qty}} * {{unit_price}}',
          precision: 2,
          prefix: '$',
          enabled: true,
        },
      ];

      const scoreRules: FormScoreRule[] = [
        {
          id: 's1',
          name: 'High intent score',
          category: 'lead_fit',
          scoreDelta: 25,
          conditionGroup: {
            id: 'scg1',
            combinator: 'AND',
            conditions: [{ id: 'c2', fieldId: 'timeline', operator: 'equals', value: 'Immediate' }],
          },
        },
      ];

      const formData = {
        budget: 25000,
        qty: 3,
        unit_price: 50,
        timeline: 'Immediate',
      };

      const result = evaluateFormLogic(rules, scoreRules, calculations, formData);

      // Calculations
      expect(result.overrideValues['total_cost']).toBe('$150');

      // Visibility & Tags
      expect(result.hiddenFieldIds.has('vip_package')).toBe(false);
      expect(result.appliedTags).toContain('tag_enterprise_lead');

      // Lead Scoring
      expect(result.totalScore).toBe(25);
      expect(result.scoreBreakdown['lead_fit']).toBe(25);
    });

    it('executes elseActions when condition evaluates to false', () => {
      const rules: FormLogicRule[] = [
        {
          id: 'r_else',
          name: 'Show fallback field if not adult',
          enabled: true,
          priority: 0,
          conditionGroup: {
            id: 'cg_adult',
            combinator: 'AND',
            conditions: [{ id: 'c_age', fieldId: 'age', operator: 'greater_than_or_equal', value: 18 }],
          },
          actions: [{ id: 'a_show_id', type: 'show_field', targetFieldId: 'drivers_license' }],
          elseActions: [{ id: 'a_show_parent', type: 'show_field', targetFieldId: 'parental_consent' }],
        },
      ];

      const minorResult = evaluateFormLogic(rules, [], [], { age: 16 });
      expect(minorResult.hiddenFieldIds.has('parental_consent')).toBe(false);

      const adultResult = evaluateFormLogic(rules, [], [], { age: 21 });
      expect(adultResult.hiddenFieldIds.has('drivers_license')).toBe(false);
    });

    it('resolves fieldId to variableName using fieldAliasMap', () => {
      const rules: FormLogicRule[] = [
        {
          id: 'r_alias',
          name: 'Show discount if promo applied',
          enabled: true,
          priority: 0,
          conditionGroup: {
            id: 'cg_promo',
            combinator: 'AND',
            conditions: [{ id: 'c_promo', fieldId: 'field_instance_abc', operator: 'equals', value: 'SAVE50' }],
          },
          actions: [{ id: 'a_discount', type: 'show_field', targetFieldId: 'discount_panel' }],
        },
      ];

      const fieldAliasMap = {
        'field_instance_abc': 'promo_code',
        'promo_code': 'field_instance_abc',
      };

      const result = evaluateFormLogic(rules, [], [], { promo_code: 'SAVE50' }, fieldAliasMap);
      expect(result.hiddenFieldIds.has('discount_panel')).toBe(false);
    });
  });
});
