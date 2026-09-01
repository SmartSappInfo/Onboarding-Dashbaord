/**
 * @fileOverview Unit tests for Survey Intelligence 2.0 Logic Graph Validator
 */

import { describe, it, expect } from 'vitest';
import type { SurveyQuestion, SurveyLogicBlock } from '@/lib/types';
import { validateSurveyLogicGraph, evaluateRuleCondition } from '../survey-logic-graph';

describe('Survey Logic Graph Validator', () => {
  it('should pass on valid linear survey without branching', () => {
    const elements: SurveyQuestion[] = [
      { id: 'q1', type: 'text', title: 'Name', isRequired: true },
      { id: 'q2', type: 'email', title: 'Email', isRequired: true },
    ];

    const result = validateSurveyLogicGraph(elements);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should detect circular branching loop (Q1 -> Q2 -> Q1)', () => {
    const q1: SurveyQuestion = { id: 'q1', type: 'multiple-choice', title: 'Role', isRequired: true };
    const q2: SurveyQuestion = { id: 'q2', type: 'multiple-choice', title: 'Department', isRequired: true };
    
    const logic1: SurveyLogicBlock = {
      id: 'l1',
      type: 'logic',
      rules: [
        {
          sourceQuestionId: 'q1',
          operator: 'isEqualTo',
          targetValue: 'Teacher',
          action: { type: 'jump', targetElementId: 'q2' },
        },
      ],
    };

    const logic2: SurveyLogicBlock = {
      id: 'l2',
      type: 'logic',
      rules: [
        {
          sourceQuestionId: 'q2',
          operator: 'isEqualTo',
          targetValue: 'Science',
          action: { type: 'jump', targetElementId: 'q1' },
        },
      ],
    };

    const result = validateSurveyLogicGraph([q1, logic1, q2, logic2]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'CIRCULAR_LOOP')).toBe(true);
  });

  it('should detect dangling target element references', () => {
    const q1: SurveyQuestion = { id: 'q1', type: 'multiple-choice', title: 'Role', isRequired: true };
    const logic: SurveyLogicBlock = {
      id: 'l1',
      type: 'logic',
      rules: [
        {
          sourceQuestionId: 'q1',
          operator: 'isEqualTo',
          targetValue: 'Admin',
          action: { type: 'jump', targetElementId: 'non_existent_q' },
        },
      ],
    };

    const result = validateSurveyLogicGraph([q1, logic]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DANGLING_TARGET')).toBe(true);
  });

  it('should detect self-referencing jump rules', () => {
    const q1: SurveyQuestion = { id: 'q1', type: 'multiple-choice', title: 'Role', isRequired: true };
    const logic: SurveyLogicBlock = {
      id: 'l1',
      type: 'logic',
      rules: [
        {
          sourceQuestionId: 'q1',
          operator: 'isEqualTo',
          targetValue: 'Admin',
          action: { type: 'jump', targetElementId: 'q1' },
        },
      ],
    };

    const result = validateSurveyLogicGraph([q1, logic]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SELF_REFERENCE')).toBe(true);
  });

  it('should warn on backward jumps', () => {
    const q1: SurveyQuestion = { id: 'q1', type: 'text', title: 'Q1', isRequired: false };
    const q2: SurveyQuestion = { id: 'q2', type: 'text', title: 'Q2', isRequired: false };
    const logic: SurveyLogicBlock = {
      id: 'l1',
      type: 'logic',
      rules: [
        {
          sourceQuestionId: 'q2',
          operator: 'isNotEmpty',
          action: { type: 'jump', targetElementId: 'q1' },
        },
      ],
    };

    const result = validateSurveyLogicGraph([q1, q2, logic]);
    expect(result.warnings.some((w) => w.code === 'BACKWARD_JUMP')).toBe(true);
  });

  it('should evaluate rule operators correctly', () => {
    expect(evaluateRuleCondition('isEqualTo', 'Parent', 'Parent')).toBe(true);
    expect(evaluateRuleCondition('isEqualTo', 'Parent', 'Teacher')).toBe(false);
    expect(evaluateRuleCondition('contains', ['A', 'B'], 'B')).toBe(true);
    expect(evaluateRuleCondition('isEmpty', '', '')).toBe(true);
    expect(evaluateRuleCondition('isNotEmpty', 'Some text', '')).toBe(true);
    expect(evaluateRuleCondition('isGreaterThan', 85, 70)).toBe(true);
    expect(evaluateRuleCondition('isLessThan', 40, 50)).toBe(true);
  });
});