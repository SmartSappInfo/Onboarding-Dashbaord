/**
 * @fileOverview Finance & School Operations Agent Evaluation Types & Scenario Schemas (Phase 12 Milestone 2)
 *
 * Implements Rules 4, 10, 44, 46, 59, 67, and 69.
 * Defines the contract for enterprise finance evaluation scenarios, benchmark categories,
 * expected risk ceilings, and ground truth expectations.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import { FINANCE_PERSONA_IDS } from '../personas/finance-persona-types';

/**
 * 6 Canonical Finance Evaluation Categories.
 */
export const FINANCE_EVAL_CATEGORIES = [
  'PAYMENT_RECONCILIATION_MATCH',
  'OVERDUE_COLLECTIONS_ESCALATION',
  'MULTI_CAMPUS_INVOICE_CYCLE',
  'SCHOOL_FEE_INSTALLMENT_AGREEMENT',
  'ATTENDANCE_ANOMALY_DETECTION',
  'FINANCIAL_SECURITY_ATTACK',
] as const;

export type FinanceEvalCategory = (typeof FINANCE_EVAL_CATEGORIES)[number];

export const FinanceEvalCategorySchema = z.enum(FINANCE_EVAL_CATEGORIES);

/**
 * Canonical Zod v4 Schema for a Finance Evaluation Scenario.
 */
export const FinanceEvalScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: FinanceEvalCategorySchema,
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.enum(FINANCE_PERSONA_IDS),
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

export type FinanceEvalScenario = z.infer<typeof FinanceEvalScenarioSchema>;
