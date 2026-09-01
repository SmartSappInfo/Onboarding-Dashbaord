/**
 * @fileOverview Unit & Integration Tests for Onboarding 2.0 Services
 */

import { describe, it, expect } from 'vitest';
import { AdaptiveConditionEvaluator } from '../adaptive-condition-evaluator';
import { OnboardingJourneyService } from '../onboarding-journey-service';
import { CANONICAL_JOURNEY_PRESETS } from '../canonical-journey-presets';
import type { OnboardingStepDefinition } from '@/lib/types';

describe('AdaptiveConditionEvaluator', () => {
  it('correctly evaluates equality and inclusion conditions', () => {
    const context = {
      department: 'dept-finance',
      roles: ['role-billing', 'role-officer'],
      memberType: 'staff',
    };

    // Equality test
    expect(
      AdaptiveConditionEvaluator.evaluateCondition(
        { field: 'department', operator: 'equals', value: 'dept-finance' },
        context
      )
    ).toBe(true);

    expect(
      AdaptiveConditionEvaluator.evaluateCondition(
        { field: 'department', operator: 'equals', value: 'dept-sales' },
        context
      )
    ).toBe(false);

    // Array contains test
    expect(
      AdaptiveConditionEvaluator.evaluateCondition(
        { field: 'roles', operator: 'contains', value: 'role-billing' },
        context
      )
    ).toBe(true);

    expect(
      AdaptiveConditionEvaluator.evaluateCondition(
        { field: 'roles', operator: 'contains', value: 'role-superadmin' },
        context
      )
    ).toBe(false);
  });

  it('determines step applicability based on composite conditions', () => {
    const context = {
      department: 'dept-finance',
      roles: ['role-billing'],
    };

    const applicableConditions = [
      { field: 'department', operator: 'equals' as const, value: 'dept-finance' },
      { field: 'roles', operator: 'contains' as const, value: 'role-billing' },
    ];

    expect(AdaptiveConditionEvaluator.isStepApplicable(applicableConditions, context)).toBe(true);

    const nonApplicableConditions = [
      { field: 'department', operator: 'equals' as const, value: 'dept-sales' },
    ];

    expect(AdaptiveConditionEvaluator.isStepApplicable(nonApplicableConditions, context)).toBe(false);
  });
});

describe('OnboardingJourneyService.validateJourneyGraph', () => {
  it('rejects empty steps array', () => {
    const result = OnboardingJourneyService.validateJourneyGraph([]);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('At least one step is required');
  });

  it('rejects duplicate step IDs', () => {
    const duplicateSteps: OnboardingStepDefinition[] = [
      { id: 'step-1', title: 'Step 1', type: 'profile', isRequired: true, order: 1 },
      { id: 'step-1', title: 'Step 1 duplicate', type: 'form', isRequired: true, order: 2 },
    ];
    const result = OnboardingJourneyService.validateJourneyGraph(duplicateSteps);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Duplicate step ID detected');
  });

  it('validates canonical presets structure', () => {
    expect(CANONICAL_JOURNEY_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of CANONICAL_JOURNEY_PRESETS) {
      const validation = OnboardingJourneyService.validateJourneyGraph(preset.steps);
      expect(validation.isValid).toBe(true);
    }
  });
});
