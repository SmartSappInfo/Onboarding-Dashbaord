/**
 * @fileOverview Topological DAG Validator & Cycle Detection Engine (Rule 47 & Rule 23)
 *
 * Implements Kahn's Algorithm for topological sorting on agent ExecutionPlan steps:
 * - Proves mathematically that the planned steps form a strict Directed Acyclic Graph.
 * - Detects circular dependencies (cycles), self-references, or orphan dependency pointers.
 * - Enforces hard step count and dependency density ceilings (Rule 23).
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 23: Resource governance ceilings (`maxStepsPerPlan`, `maxDependenciesPerStep`).
 * - Rule 47: Never trust the model (validates plan DAG before execution).
 * - Rule 48: Sanitized error taxonomy (`PLANNING_FAILED`).
 */

import { type PlanStep, AgentRuntimeError } from '../agent-run-types';

export interface DagValidationOptions {
  maxSteps?: number;
  maxDependenciesPerStep?: number;
  runId?: string;
  organizationId?: string;
}

export interface DagValidationResult {
  valid: true;
  sortedStepIds: string[];
  sortedSteps: PlanStep[];
}

/**
 * Validates that an array of PlanSteps forms a valid, acyclic Directed Acyclic Graph (DAG)
 * using Kahn's algorithm. Returns steps in topological execution order.
 *
 * @throws {AgentRuntimeError} if a cycle is detected, dependencies are invalid, or ceilings are breached.
 */
export function validateExecutionPlanDag(
  steps: PlanStep[],
  options?: DagValidationOptions
): DagValidationResult {
  const maxSteps = options?.maxSteps ?? 15;
  const maxDependencies = options?.maxDependenciesPerStep ?? 5;
  const runId = options?.runId;
  const organizationId = options?.organizationId;

  if (!steps || steps.length === 0) {
    throw new AgentRuntimeError({
      code: 'PLANNING_FAILED',
      message: 'Execution plan must have at least one step.',
      runId,
      organizationId,
    });
  }

  if (steps.length > maxSteps) {
    throw new AgentRuntimeError({
      code: 'PLANNING_FAILED',
      message: `Execution plan exceeds max step count limit. Allowed: ${maxSteps}, Planned: ${steps.length}.`,
      runId,
      organizationId,
      details: { maxSteps, count: steps.length },
    });
  }

  // 1. Build Step ID lookup and verify uniqueness
  const stepMap = new Map<string, PlanStep>();
  for (const step of steps) {
    if (stepMap.has(step.stepId)) {
      throw new AgentRuntimeError({
        code: 'PLANNING_FAILED',
        message: `Duplicate step ID '${step.stepId}' found in execution plan.`,
        stepId: step.stepId,
        runId,
        organizationId,
      });
    }
    stepMap.set(step.stepId, step);
  }

  // 2. Validate dependency integrity (no self-loops, existing references, max fan-in)
  // Adjacency list: edge from dependency u -> dependent step v (u must execute before v)
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const step of steps) {
    adjacency.set(step.stepId, []);
    inDegree.set(step.stepId, 0);
  }

  for (const step of steps) {
    const deps = step.dependsOnStepIds || [];

    if (deps.length > maxDependencies) {
      throw new AgentRuntimeError({
        code: 'PLANNING_FAILED',
        message: `Step '${step.stepId}' exceeds maximum dependency limit of ${maxDependencies}.`,
        stepId: step.stepId,
        runId,
        organizationId,
      });
    }

    for (const depId of deps) {
      if (depId === step.stepId) {
        throw new AgentRuntimeError({
          code: 'PLANNING_FAILED',
          message: `Self-referential dependency detected on step '${step.stepId}'.`,
          stepId: step.stepId,
          runId,
          organizationId,
        });
      }

      if (!stepMap.has(depId)) {
        throw new AgentRuntimeError({
          code: 'PLANNING_FAILED',
          message: `Step '${step.stepId}' references non-existent step '${depId}'.`,
          stepId: step.stepId,
          runId,
          organizationId,
        });
      }

      // Valid dependency: depId -> step.stepId
      adjacency.get(depId)!.push(step.stepId);
      inDegree.set(step.stepId, (inDegree.get(step.stepId) || 0) + 1);
    }
  }

  // 3. Kahn's Algorithm for Topological Sorting
  const queue: string[] = [];
  for (const [stepId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(stepId);
    }
  }

  const sortedStepIds: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    sortedStepIds.push(currentId);

    const neighbors = adjacency.get(currentId) || [];
    for (const neighborId of neighbors) {
      const updatedDegree = (inDegree.get(neighborId) || 1) - 1;
      inDegree.set(neighborId, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(neighborId);
      }
    }
  }

  // 4. Cycle Detection Check
  if (sortedStepIds.length !== steps.length) {
    const cycleStepIds: string[] = [];
    for (const [stepId, degree] of inDegree.entries()) {
      if (degree > 0) {
        cycleStepIds.push(stepId);
      }
    }

    throw new AgentRuntimeError({
      code: 'PLANNING_FAILED',
      message: `Circular dependency detected in execution plan DAG. Cycle involves steps: [${cycleStepIds.join(', ')}].`,
      runId,
      organizationId,
      details: { cycleStepIds, totalSteps: steps.length, resolvedSteps: sortedStepIds.length },
    });
  }

  const sortedSteps = sortedStepIds.map((id) => stepMap.get(id)!);

  return {
    valid: true,
    sortedStepIds,
    sortedSteps,
  };
}
