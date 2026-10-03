/**
 * @fileOverview Planner Contracts & Schemas (Rule 13, 16, 27, 30, 41, 47, 59)
 *
 * Defines the input schemas, LLM candidate schemas, and explainability types
 * for the SmartSapp Goal Decomposition & DAG Planning Engine.
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 13 & 30: Untrusted memory grounding containerization.
 * - Rule 16 & 59: Persona boundary and capability discovery constraints.
 * - Rule 27: Formal Saga compensation bindings.
 * - Rule 41: Explainability attributes (WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE).
 * - Rule 47: Never trust the model (strict candidate validation).
 */

import { z } from 'zod/v4';
import {
  AgentGoalSchema,
  AgentRunBudgetsSchema,
  AGENT_STEP_TYPES,
} from '../agent-run-types';

// ============================================================================
// 1. LLM PLAN CANDIDATE SCHEMAS (Rule 47)
// ============================================================================

export const PlanStepCandidateSchema = z.object({
  stepId: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(AGENT_STEP_TYPES).default('tool_call'),
  capabilityId: z.string().optional(),
  arguments: z.record(z.string(), z.unknown()).default({}),
  dependsOnStepIds: z.array(z.string()).default([]),
  expectedStateChange: z.string().optional(),
  // Rule 41 Explainability fields
  what: z.string().optional(),
  why: z.string().optional(),
  blastRadius: z.string().optional(),
  evidenceCitations: z.array(z.string()).default([]),
});

export type PlanStepCandidate = z.infer<typeof PlanStepCandidateSchema>;

export const ExecutionPlanCandidateSchema = z.object({
  steps: z.array(PlanStepCandidateSchema).min(1),
  rationale: z.string().min(1),
  estimatedTokens: z.number().int().min(0).default(0),
});

export type ExecutionPlanCandidate = z.infer<typeof ExecutionPlanCandidateSchema>;

// ============================================================================
// 2. PLANNER INVOCATION INPUT CONTRACTS (Rule 8 & 47)
// ============================================================================

export const GeneratePlanInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  runId: z.string().min(1),
  goal: AgentGoalSchema,
  personaId: z.string().min(1),
  authorizingUserId: z.string().min(1),
  budgets: AgentRunBudgetsSchema.optional(),
  dryRun: z.boolean().default(false),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

export type GeneratePlanInput = z.input<typeof GeneratePlanInputSchema>;

// ============================================================================
// 3. REPLANNER CONTRACTS & SCHEMAS (Rule 23, 47, 48)
// ============================================================================

export const ReplanInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  runId: z.string().min(1),
  failedStepId: z.string().min(1),
  failureReason: z.string().min(1),
  maxReplansPerRun: z.number().int().min(1).max(10).default(3),
  authorizingUserId: z.string().optional(),
  correlationId: z.string().optional(),
});

export type ReplanInput = z.input<typeof ReplanInputSchema>;

export const RemedialPlanCandidateSchema = z.object({
  remedialSteps: z.array(PlanStepCandidateSchema).min(1),
  remedialRationale: z.string().min(1),
  estimatedTokens: z.number().int().min(0).default(0),
});

export type RemedialPlanCandidate = z.infer<typeof RemedialPlanCandidateSchema>;
