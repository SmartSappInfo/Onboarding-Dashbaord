/**
 * @fileOverview Agent Persona Contracts & Resource Budget Schemas (Phase 3 Milestone 1)
 *
 * Implements Rules 1, 4, 10, 11, 12, 16, 23, and Master Roadmap Section 4 / Document 07.
 * Defines the canonical specialized agent personas for SmartSapp CompanyBrain:
 *   - CRM Researcher (`crm_researcher`)
 *   - Autonomous Lead SDR (`lead_sdr`)
 *   - Deal Strategy & Coach (`deal_coach`)
 *   - Portal Experience Guide (`portal_guide`)
 *   - Meeting Dossier & Prep (`meeting_prep`)
 *   - Supervisor Orchestrator (`supervisor`)
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Personas define the maximum outer bounds for an agent's capability and risk ceiling.
 * - Under Rule 16, an agent's effective authority is always the intersection of the persona's
 *   allowed permissions, the authorizing user's RBAC permissions, and the target workspace boundary.
 * - Resource budgets (Rule 23) establish deterministic ceilings on tokens, tool calls, and duration.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded schemas only.
 */

import { z } from 'zod/v4';
import { CAPABILITY_DOMAINS } from '../capabilities/contracts/capability-definition';
import { RISK_LEVELS } from '../capabilities/contracts/risk-levels';

/**
 * Canonical identifiers for built-in specialized agent personas.
 */
export const AGENT_PERSONA_IDS = [
  'crm_researcher',
  'lead_sdr',
  'deal_coach',
  'portal_guide',
  'meeting_prep',
  'supervisor',
  // Domain Specialist CRM Personas (Phase 9 Milestone 2)
  'crm_assistant',
  'lead_analyst',
  'deal_strategist',
  'task_coordinator',
  'knowledge_analyst',
  // Domain Specialist Sales Personas (Phase 10 Milestone 2)
  'prospecting_agent',
  'enrichment_agent',
  'qualification_agent',
  'sales_coach',
  // Meeting Agent (Phase 11 Milestone 2)
  'meeting_analyst',
  // Knowledge Agent (Phase 11 Milestone 4)
  'knowledge_agent',
  // Domain Specialist Finance & School Operations Personas (Phase 12 Milestone 2)
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

export type AgentPersonaId = (typeof AGENT_PERSONA_IDS)[number];

export const isAgentPersonaId = (id: string): id is AgentPersonaId =>
  (AGENT_PERSONA_IDS as readonly string[]).includes(id);

/**
 * Deterministic resource budget limits governing agent executions (Rule 23).
 */
export const AgentPersonaBudgetsSchema = z.object({
  maxDurationMs: z.number().int().min(1000).max(300000).default(120000),
  maxTokens: z.number().int().min(1000).max(200000).default(50000),
  maxToolCalls: z.number().int().min(1).max(50).default(15),
  maxRecordsMutated: z.number().int().min(0).max(100).default(25),
  maxOutboundMessages: z.number().int().min(0).max(10).default(0),
});

export type AgentPersonaBudgets = z.infer<typeof AgentPersonaBudgetsSchema>;

/**
 * Canonical contract defining an Agent Persona.
 */
export const AgentPersonaDefinitionSchema = z.object({
  id: z.enum(AGENT_PERSONA_IDS),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be standard SemVer (e.g. 1.0.0)'),
  role: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  allowedDomains: z.array(z.enum(CAPABILITY_DOMAINS)).min(1),
  allowedPermissions: z.array(z.string()).min(1),
  maxAutonomousRiskLevel: z.enum(RISK_LEVELS),
  budgets: AgentPersonaBudgetsSchema,
  systemPromptSnippet: z.string().min(1),
});

export type AgentPersonaDefinition = z.infer<typeof AgentPersonaDefinitionSchema>;

/**
 * Workspace-level persona configuration override in Firestore (`workspace_agent_configs`).
 */
export const WorkspaceAgentConfigSchema = z.object({
  workspaceId: z.string().min(1),
  personaId: z.enum(AGENT_PERSONA_IDS),
  enabled: z.boolean().default(true),
  customBudgets: AgentPersonaBudgetsSchema.partial().optional(),
  restrictedPermissions: z.array(z.string()).optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type WorkspaceAgentConfig = z.infer<typeof WorkspaceAgentConfigSchema>;
