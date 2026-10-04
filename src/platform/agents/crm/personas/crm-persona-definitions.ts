/**
 * @fileOverview Domain Specialist CRM Agent Personas & Capability Boundaries (Phase 9 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 10, 12, 16, 17, 23, 67, 68, and 69.
 * Single Source of Truth for the 6 Specialized CRM Agent Personas:
 * 1. `crm_assistant` - Universal CRM Assistant & Account Copilot (L1_INTERNAL_DRAFT)
 * 2. `crm_researcher` - CRM Researcher & Dossier Specialist (L0_READ)
 * 3. `lead_analyst` - Lead Qualification & Enrichment Analyst (L1_INTERNAL_DRAFT)
 * 4. `deal_strategist` - Deal Strategy & Velocity Analyst (L1_INTERNAL_DRAFT)
 * 5. `task_coordinator` - CRM Task & Commitment Coordinator (L2_STATE_MUTATION)
 * 6. `knowledge_analyst` - Account Knowledge & Memory Analyst (L1_INTERNAL_DRAFT)
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 12: Enforces immutable persona risk level ceilings.
 * - Rule 16: Zero wildcard permissions (`*`). Every allowed permission is explicitly qualified.
 * - Rule 17: Non-delegable destructive actions (e.g., entity deletion) are strictly excluded.
 * - Rule 23: Deterministic resource budgets for duration, tokens, tool calls, and records mutated.
 * - Rule 69: Preserves the dual-tier CRM model. All state mutations target `/workspace_entities`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  type AgentPersonaDefinition,
  type AgentPersonaId,
} from '@/platform/identity/agent-persona-types';

/**
 * Identifiers for specialized CRM domain agent personas.
 */
export const CRM_PERSONA_IDS = [
  'crm_assistant',
  'crm_researcher',
  'lead_analyst',
  'deal_strategist',
  'task_coordinator',
  'knowledge_analyst',
] as const;

export type CrmPersonaId = (typeof CRM_PERSONA_IDS)[number];

export const isCrmPersonaId = (id: string): id is CrmPersonaId =>
  (CRM_PERSONA_IDS as readonly string[]).includes(id);

/**
 * Canonical definitions for the 6 specialized CRM agent personas.
 */
export const CRM_PERSONA_DEFINITIONS: Readonly<Record<CrmPersonaId, AgentPersonaDefinition>> = {
  crm_assistant: {
    id: 'crm_assistant',
    name: 'Universal CRM Assistant & Account Copilot',
    version: '1.0.0',
    role: 'General CRM Copilot & Account Intelligence Specialist',
    description:
      'Provides holistic 360-degree account summaries, answers user queries, and prepares meeting dossiers. All mutating actions are proposed for review.',
    icon: 'Bot',
    allowedDomains: [
      'crm_contacts',
      'deals_revenue',
      'knowledge_memory',
      'tasks_productivity',
      'meetings_conversations',
    ],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.pipeline.view',
      'rbac:operations.tasks.view',
      'rbac:operations.dashboard.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Universal CRM Assistant. You answer inquiries about accounts, synthesize recent interactions, and prepare meeting dossiers. All mutating actions must be structured as proposals.',
  },

  crm_researcher: {
    id: 'crm_researcher',
    name: 'CRM Researcher Agent',
    version: '1.0.0',
    role: 'Account Intelligence Specialist',
    description:
      'Reconstructs comprehensive 360-degree account histories across entities, notes, meetings, and communications with exact source citations.',
    icon: 'UserSearch',
    allowedDomains: [
      'crm_contacts',
      'knowledge_memory',
      'meetings_conversations',
      'tasks_productivity',
    ],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:studios.tags.view',
      'rbac:operations.tasks.view',
      'rbac:operations.dashboard.view',
      'workspace:read',
      'crm:timeline:view',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp CRM Researcher Agent. You explore account histories, synthesize notes, analyze timelines, and build structured dossiers with exact citations. You are strictly read-only.',
  },

  lead_analyst: {
    id: 'lead_analyst',
    name: 'Lead Qualification & Enrichment Analyst',
    version: '1.0.0',
    role: 'ICP Fit & Lead Intelligence Specialist',
    description:
      'Analyzes inbound leads, scores ICP fit, technographically enriches company profiles, and proposes qualification tags.',
    icon: 'Target',
    allowedDomains: ['lead_intelligence', 'crm_contacts', 'knowledge_memory'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:studios.tags.view',
      'rbac:operations.pipeline.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Lead Qualification & Enrichment Analyst. You evaluate inbound prospects against ICP criteria, score qualification, and propose enrichment tags.',
  },

  deal_strategist: {
    id: 'deal_strategist',
    name: 'Deal Strategy & Velocity Analyst',
    version: '1.0.0',
    role: 'Pipeline Velocity & Win Strategy Specialist',
    description:
      'Monitors deal pipeline velocity, detects stalled opportunities, identifies competitor objections, and formulates tactical win plans.',
    icon: 'TrendingUp',
    allowedDomains: ['deals_revenue', 'crm_contacts', 'knowledge_memory'],
    allowedPermissions: [
      'rbac:operations.pipeline.view',
      'rbac:operations.campuses.view',
      'rbac:operations.tasks.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Deal Strategy Analyst. You analyze pipeline velocity, diagnose stalled deals, and propose tactical win plans for account executives.',
  },

  task_coordinator: {
    id: 'task_coordinator',
    name: 'CRM Task & Commitment Coordinator',
    version: '1.0.0',
    role: 'Follow-Up & Commitment Specialist',
    description:
      'Extracts verbal commitments from meeting transcripts and notes, schedules follow-ups, and manages CRM tasks within the workspace.',
    icon: 'CalendarCheck',
    allowedDomains: ['tasks_productivity', 'meetings_conversations', 'crm_contacts'],
    allowedPermissions: [
      'rbac:operations.tasks.view',
      'rbac:operations.tasks.create',
      'rbac:operations.tasks.edit',
      'rbac:operations.campuses.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 20,
      maxRecordsMutated: 25,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp CRM Task Coordinator. You extract commitments, assign follow-up tasks to account team members, and ensure no deal promises slip through the cracks.',
  },

  knowledge_analyst: {
    id: 'knowledge_analyst',
    name: 'Account Knowledge & Memory Analyst',
    version: '1.0.0',
    role: 'Institutional Memory Specialist',
    description:
      'Extracts grounded entity facts, key stakeholder preferences, and organizational changes into structured institutional memory.',
    icon: 'Brain',
    allowedDomains: ['knowledge_memory', 'crm_contacts'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet:
      'You are the SmartSapp Account Knowledge Analyst. You distill grounded entity facts, executive preferences, and relationship milestones into structured memory.',
  },
};

/**
 * Returns a copy of all CRM persona definitions.
 */
export function listCrmPersonaDefinitions(): readonly AgentPersonaDefinition[] {
  return Object.values(CRM_PERSONA_DEFINITIONS);
}

/**
 * Resolves a CRM persona definition by ID or null if not found.
 */
export function getCrmPersonaDefinition(id: string): AgentPersonaDefinition | null {
  if (isCrmPersonaId(id)) {
    return CRM_PERSONA_DEFINITIONS[id];
  }
  return null;
}
