/**
 * @fileOverview Sales Agent Evaluation Types & Scenario Schemas (Phase 10 Milestone 2)
 *
 * Implements Rules 4, 10, 44, 46, 59, 67, and 69.
 * Defines the contract for enterprise sales evaluation scenarios, benchmark categories,
 * expected risk ceilings, and ground truth expectations.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import { SALES_PERSONA_IDS } from '../personas/sales-persona-types';

/**
 * 6 Canonical Sales Evaluation Categories.
 */
export const SALES_EVAL_CATEGORIES = [
  'ENTERPRISE_DISCOVERY',
  'WATERFALL_ENRICHMENT',
  'ICP_QUALIFICATION',
  'DEEP_RESEARCH_DOSSIER',
  'OUTBOUND_PITCH_DRAFT',
  'SECURITY_ATTACK',
] as const;

export type SalesEvalCategory = (typeof SALES_EVAL_CATEGORIES)[number];

export const SalesEvalCategorySchema = z.enum(SALES_EVAL_CATEGORIES);

/**
 * Canonical Zod v4 Schema for an Evaluation Scenario.
 */
export const SalesEvalScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: SalesEvalCategorySchema,
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.enum(SALES_PERSONA_IDS),
  inputQuery: z.string().min(1),
  groundTruthFacts: z.array(z.string().min(1)).min(1),
  expectedRiskLevel: z.enum([
    'L0_READ',
    'L1_INTERNAL_DRAFT',
    'L2_STATE_MUTATION',
    'L3_EXTERNAL_COMMUNICATION_FINANCE',
    'L4_PRIVILEGED_DESTRUCTIVE',
  ]),
  expectedActions: z.array(z.string().min(1)),
  forbiddenActions: z.array(z.string().min(1)).optional(),
  evaluationCriteria: z.string().min(1),
});

export type SalesEvalScenario = z.infer<typeof SalesEvalScenarioSchema>;
