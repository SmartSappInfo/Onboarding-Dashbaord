/**
 * @fileOverview Specialized Finance & School Operations Agent Persona Types & Identifiers (Phase 12 Milestone 2)
 *
 * Implements Rules 4, 10, 12, 16, 23, and Master Roadmap Section 4 / Document 07.
 * Single Source of Truth for the 9 Specialized Finance & School Operations Agent Personas:
 *
 * Finance Domain:
 * 1. `billing_analyst` - Invoice & Fee Structure Specialist (L1_INTERNAL_DRAFT)
 * 2. `collections_agent` - Accounts Receivable & Recovery Specialist (L2_STATE_MUTATION)
 * 3. `reconciliation_agent` - Payment Matching & Discrepancy Specialist (L2_STATE_MUTATION)
 * 4. `revenue_analyst` - Cash Flow & Revenue Analytics Specialist (L0_READ)
 * 5. `invoice_assistant` - Invoice Drafting & Validation Assistant (L1_INTERNAL_DRAFT)
 * 6. `finance_reporter` - Financial Compliance & Audit Reporting Specialist (L0_READ)
 *
 * School Operations Domain:
 * 7. `school_ops_agent` - Academic Calendar & Fee Schedule Specialist (L1_INTERNAL_DRAFT)
 * 8. `attendance_analyst` - Attendance Correlation & Student Retention Specialist (L0_READ)
 * 9. `fee_collection_agent` - Tuition Payment Plan & School Fee Specialist (L2_STATE_MUTATION)
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 12: Enforces immutable persona risk level ceilings.
 * - Rule 16: Zero wildcard permissions (`*`). Every allowed permission is explicitly qualified.
 * - Rule 17: Non-delegable destructive actions (e.g. deleting posted invoices, unauthorized refunds) strictly excluded.
 * - Rule 23: Deterministic resource and monetary budgets for duration, tokens, tool calls, and financial exposure.
 * - Rule 69: Governed capability layer underneath SmartSapp. Master records remain immutable.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type AgentPersonaDefinition,
  AgentPersonaDefinitionSchema,
} from '@/platform/identity/agent-persona-types';

/**
 * Identifiers for specialized finance domain agent personas.
 */
export const FINANCE_PERSONA_IDS = [
  'billing_analyst',
  'collections_agent',
  'reconciliation_agent',
  'revenue_analyst',
  'invoice_assistant',
  'finance_reporter',
  'school_ops_agent',
  'attendance_analyst',
  'fee_collection_agent',
] as const;

export type FinancePersonaId = (typeof FINANCE_PERSONA_IDS)[number];

export const isFinancePersonaId = (id: string): id is FinancePersonaId =>
  (FINANCE_PERSONA_IDS as readonly string[]).includes(id);

export const FinancePersonaIdSchema = z.enum(FINANCE_PERSONA_IDS);

export type FinancePersonaDefinition = AgentPersonaDefinition;
export const FinancePersonaDefinitionSchema = AgentPersonaDefinitionSchema;
