/**
 * @fileOverview Unit Tests for Topological DAG Validator (Rule 47 & Rule 23)
 */

import { describe, it, expect } from 'vitest';
import { validateExecutionPlanDag } from '@/platform/runtime/planning/dag-validator';
import { type PlanStep } from '@/platform/runtime/agent-run-types';
import { AgentRuntimeError } from '@/platform/runtime/agent-run-types';

describe('validateExecutionPlanDag (Rule 47 & Rule 23)', () => {
  const createMockStep = (id: string, index: number, dependsOn: string[] = []): PlanStep => ({
    stepId: id,
    stepIndex: index,
    title: `Step ${id}`,
    type: 'tool_call',
    capabilityId: 'crm.find_contact',
    dependsOnStepIds: dependsOn,
    isNonDelegable: false,
    timeoutMs: 30000,
  });

  it('validates and returns topologically sorted order for linear DAG', () => {
    // 0 -> 1 -> 2
    const steps: PlanStep[] = [
      createMockStep('step_0', 0, []),
      createMockStep('step_1', 1, ['step_0']),
      createMockStep('step_2', 2, ['step_1']),
    ];

    const result = validateExecutionPlanDag(steps);

    expect(result.valid).toBe(true);
    expect(result.sortedStepIds).toEqual(['step_0', 'step_1', 'step_2']);
    expect(result.sortedSteps.map((s) => s.stepId)).toEqual(['step_0', 'step_1', 'step_2']);
  });

  it('validates and orders a diamond DAG correctly', () => {
    //       step_0
    //       /    \
    //   step_1   step_2
    //       \    /
    //       step_3
    const steps: PlanStep[] = [
      createMockStep('step_3', 3, ['step_1', 'step_2']),
      createMockStep('step_0', 0, []),
      createMockStep('step_2', 2, ['step_0']),
      createMockStep('step_1', 1, ['step_0']),
    ];

    const result = validateExecutionPlanDag(steps);

    expect(result.valid).toBe(true);
    expect(result.sortedStepIds[0]).toBe('step_0');
    expect(result.sortedStepIds[3]).toBe('step_3');
    // step_1 and step_2 can be in either order in between
    expect(result.sortedStepIds.slice(1, 3)).toEqual(expect.arrayContaining(['step_1', 'step_2']));
  });

  it('throws PLANNING_FAILED when a simple 2-node cycle is detected', () => {
    // step_0 -> step_1 -> step_0
    const steps: PlanStep[] = [
      createMockStep('step_0', 0, ['step_1']),
      createMockStep('step_1', 1, ['step_0']),
    ];

    expect(() => validateExecutionPlanDag(steps)).toThrowError(AgentRuntimeError);

    try {
      validateExecutionPlanDag(steps);
    } catch (e) {
      const err = e as AgentRuntimeError;
      expect(err.code).toBe('PLANNING_FAILED');
      expect(err.message).toContain('Circular dependency detected');
    }
  });

  it('throws PLANNING_FAILED when a self-referential step is present', () => {
    const steps: PlanStep[] = [createMockStep('step_0', 0, ['step_0'])];

    expect(() => validateExecutionPlanDag(steps)).toThrowError(AgentRuntimeError);
  });

  it('throws PLANNING_FAILED when a step references a non-existent step ID', () => {
    const steps: PlanStep[] = [createMockStep('step_1', 0, ['step_ghost'])];

    expect(() => validateExecutionPlanDag(steps)).toThrowError(AgentRuntimeError);

    try {
      validateExecutionPlanDag(steps);
    } catch (e) {
      const err = e as AgentRuntimeError;
      expect(err.code).toBe('PLANNING_FAILED');
      expect(err.message).toContain('non-existent step');
    }
  });

  it('throws PLANNING_FAILED when step count exceeds maxSteps ceiling (Rule 23)', () => {
    const steps: PlanStep[] = Array.from({ length: 6 }, (_, i) =>
      createMockStep(`step_${i}`, i, i > 0 ? [`step_${i - 1}`] : [])
    );

    // Limit to max 5 steps
    expect(() => validateExecutionPlanDag(steps, { maxSteps: 5 })).toThrowError(
      AgentRuntimeError
    );

    try {
      validateExecutionPlanDag(steps, { maxSteps: 5 });
    } catch (e) {
      const err = e as AgentRuntimeError;
      expect(err.code).toBe('PLANNING_FAILED');
      expect(err.message).toContain('max step count limit');
    }
  });

  it('throws PLANNING_FAILED when duplicate step IDs are detected', () => {
    const steps: PlanStep[] = [
      createMockStep('step_dup', 0, []),
      createMockStep('step_dup', 1, []),
    ];

    expect(() => validateExecutionPlanDag(steps)).toThrowError(AgentRuntimeError);
  });

  it('throws PLANNING_FAILED when steps array is empty', () => {
    expect(() => validateExecutionPlanDag([])).toThrowError(AgentRuntimeError);
  });
});
