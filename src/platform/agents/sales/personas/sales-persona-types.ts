/**
 * @fileOverview Specialized Sales Agent Persona Types & Identifiers (Phase 10 Milestone 2)
 *
 * Implements Rules 4, 10, 12, 16, 23, and Master Roadmap Section 4 / Document 07.
 * Single Source of Truth for the 5 Specialized Sales Agent Personas:
 * 1. `lead_sdr` - Outbound Sales Development Representative (L2_STATE_MUTATION)
 * 2. `prospecting_agent` - Account & Lead Discovery Specialist (L0_READ)
 * 3. `enrichment_agent` - Multi-Provider Waterfall Specialist (L1_INTERNAL_DRAFT)
 * 4. `qualification_agent` - Lead Scoring & ICP Qualification Analyst (L0_READ)
 * 5. `sales_coach` - Objections & Value Proposition Coach (L1_INTERNAL_DRAFT)
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 12: Enforces immutable persona risk level ceilings.
 * - Rule 16: Zero wildcard permissions (`*`). Every allowed permission is explicitly qualified.
 * - Rule 17: Non-delegable destructive actions (e.g. unsolicited bulk sending without approval) are strictly excluded.
 * - Rule 23: Deterministic resource budgets for duration, tokens, tool calls, and records mutated.
 * - Rule 69: Preserves the dual-tier CRM model. All state mutations target `/workspace_entities`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type AgentPersonaDefinition,
  AgentPersonaDefinitionSchema,
} from '@/platform/identity/agent-persona-types';

/**
 * Identifiers for specialized sales domain agent personas.
 */
export const SALES_PERSONA_IDS = [
  'lead_sdr',
  'prospecting_agent',
  'enrichment_agent',
  'qualification_agent',
  'sales_coach',
] as const;

export type SalesPersonaId = (typeof SALES_PERSONA_IDS)[number];

export const isSalesPersonaId = (id: string): id is SalesPersonaId =>
  (SALES_PERSONA_IDS as readonly string[]).includes(id);

export const SalesPersonaIdSchema = z.enum(SALES_PERSONA_IDS);

export type SalesPersonaDefinition = AgentPersonaDefinition;
export const SalesPersonaDefinitionSchema = AgentPersonaDefinitionSchema;
