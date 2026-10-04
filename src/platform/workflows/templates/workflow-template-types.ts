/**
 * @fileOverview Canonical Contracts & Kahn's DAG Validator for Deterministic Workflow Templates (Phase 7 Milestone 5)
 *
 * Implements:
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Multi-tenant boundary checks
 * - Rule 9 & 23: Graph complexity bounds (<= 30 steps per template)
 * - Rule 47: Model Distrust & Topological Sorting DAG acyclicity verification
 * - Rule 60: Emergency Dead-Man Switch compliance
 */

import { z } from 'zod/v4';
import { WaitConditionSchema } from '../workflow-types';
import { StoredPrincipalSchema } from '@/platform/tasks/agent-step-contract';

// ── 1. Error Taxonomy & Typed WorkflowTemplateError ─────────────────────────
export const TEMPLATE_ERROR_CODES = {
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_ALREADY_EXISTS: 'TEMPLATE_ALREADY_EXISTS',
  TEMPLATE_DAG_CYCLE_DETECTED: 'TEMPLATE_DAG_CYCLE_DETECTED',
  TEMPLATE_DAG_SELF_DEPENDENCY: 'TEMPLATE_DAG_SELF_DEPENDENCY',
  TEMPLATE_DAG_MISSING_DEPENDENCY: 'TEMPLATE_DAG_MISSING_DEPENDENCY',
  TEMPLATE_INVALID_PARAMETERS: 'TEMPLATE_INVALID_PARAMETERS',
  TEMPLATE_MAX_STEPS_EXCEEDED: 'TEMPLATE_MAX_STEPS_EXCEEDED',
  DEAD_MAN_PAUSED: 'DEAD_MAN_PAUSED',
} as const;

export type TemplateErrorCode =
  (typeof TEMPLATE_ERROR_CODES)[keyof typeof TEMPLATE_ERROR_CODES];

export class WorkflowTemplateError extends Error {
  readonly code: TemplateErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TemplateErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowTemplateError';
    this.code = code;
    this.details = details;
  }
}

// ── 2. Template Step Definition Schema ──────────────────────────────────────
export const WorkflowStepTemplateSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  capabilityId: z.string().trim().min(1),
  capabilityVersion: z.string().optional(),
  dependsOn: z.array(z.string().trim().min(1)).default([]),
  waitCondition: WaitConditionSchema.optional(),
  isMutating: z.boolean().default(false),
  compensatingCapabilityId: z.string().optional(),
  riskLevel: z.string().optional(),
  timeoutSeconds: z.number().int().positive().default(300),
  maxAttempts: z.number().int().positive().default(3),
  inputMapping: z.record(z.string(), z.unknown()).default({}),
});

export type WorkflowStepTemplate = z.infer<typeof WorkflowStepTemplateSchema>;

// ── 3. Template Parameter Schema ────────────────────────────────────────────
export const TemplateParameterSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
});

export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;

// ── 4. Workflow Template Definition Schema ──────────────────────────────────
export const WorkflowTemplateDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  version: z.string().default('1.0.0'),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.enum(['crm', 'sales', 'support', 'onboarding', 'operations', 'custom']),
  parameters: z.array(TemplateParameterSchema).default([]),
  steps: z.array(WorkflowStepTemplateSchema).min(1).max(30),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowTemplateDefinition = z.infer<typeof WorkflowTemplateDefinitionSchema>;

// ── 5. Kahn's Algorithm DAG Topological Sorter & Cycle Detector (Rule 47) ───
export function validateTemplateDag(steps: WorkflowStepTemplate[]): string[] {
  if (steps.length === 0) {
    return [];
  }
  if (steps.length > 30) {
    throw new WorkflowTemplateError(
      TEMPLATE_ERROR_CODES.TEMPLATE_MAX_STEPS_EXCEEDED,
      `Template contains ${steps.length} steps, exceeding the maximum allowed limit of 30 steps.`
    );
  }

  const allIds = new Set<string>();
  for (const step of steps) {
    if (allIds.has(step.id)) {
      throw new WorkflowTemplateError(
        TEMPLATE_ERROR_CODES.TEMPLATE_DAG_CYCLE_DETECTED,
        `Duplicate step ID '${step.id}' detected in workflow template.`
      );
    }
    allIds.add(step.id);
  }

  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.id, step.dependsOn.length);
    adjList.set(step.id, []);

    // Check self-dependency
    if (step.dependsOn.includes(step.id)) {
      throw new WorkflowTemplateError(
        TEMPLATE_ERROR_CODES.TEMPLATE_DAG_SELF_DEPENDENCY,
        `[TEMPLATE_DAG_SELF_DEPENDENCY] Step '${step.id}' cannot depend on itself.`
      );
    }

    // Check missing dependencies
    for (const dep of step.dependsOn) {
      if (!allIds.has(dep)) {
        throw new WorkflowTemplateError(
          TEMPLATE_ERROR_CODES.TEMPLATE_DAG_MISSING_DEPENDENCY,
          `[TEMPLATE_DAG_MISSING_DEPENDENCY] Step '${step.id}' depends on missing step '${dep}'.`
        );
      }
    }
  }

  // Populate adjacency list: dep -> steps that depend on dep
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      adjList.get(dep)?.push(step.id);
    }
  }

  // Queue initial steps with in-degree 0
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      const updatedDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (order.length !== steps.length) {
    throw new WorkflowTemplateError(
      TEMPLATE_ERROR_CODES.TEMPLATE_DAG_CYCLE_DETECTED,
      `[TEMPLATE_DAG_CYCLE_DETECTED] Circular dependency detected in workflow template DAG.`
    );
  }

  return order;
}

// ── 6. Template Instantiation Schemas ───────────────────────────────────────
export const InstantiateTemplateInputSchema = z.object({
  templateId: z.string().trim().min(1),
  inputs: z.record(z.string(), z.unknown()).default({}),
  initiator: z.object({
    actorType: z.enum(['user', 'agent', 'system', 'cron']),
    actorId: z.string().trim().min(1),
  }),
  principal: StoredPrincipalSchema,
  tenant: z.object({
    organizationId: z.string().trim().min(1),
    workspaceId: z.string().trim().min(1),
  }),
  title: z.string().optional(),
  correlationId: z.string().optional(),
  dryRun: z.boolean().default(false),
});

export type InstantiateTemplateInput = z.infer<typeof InstantiateTemplateInputSchema>;
