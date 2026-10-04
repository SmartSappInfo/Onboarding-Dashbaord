/**
 * @fileOverview CRM Agent Permission, Tool, Failure, and Rollback Matrices (Phase 9 Milestone 2)
 *
 * Implements Rules 1, 2, 4, 8, 12, 16, 17, 27, 48, 59, 67, 68, and 69.
 * Single Source of Truth for the 4 Mandatory Governance Matrices of the CRM Domain Workforce:
 *
 * 1. PERMISSION MATRIX (`CRM_PERMISSION_MATRIX`): Strict RBAC scope mapping per persona (zero wildcards).
 * 2. TOOL MATRIX (`CRM_TOOL_MATRIX`): Explicit capability inventory and risk level ceilings per persona.
 * 3. FAILURE MATRIX (`CRM_FAILURE_MATRIX`): Deterministic strategies for missing, stale, or timeout failures.
 * 4. ROLLBACK MATRIX (`CRM_ROLLBACK_MATRIX`): Reverse-LIFO Saga compensation mapping for mutating tools.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import { type RiskLevel } from '@/platform/capabilities/contracts/risk-levels';
import {
  type CrmPersonaId,
  isCrmPersonaId,
  CRM_PERSONA_DEFINITIONS,
} from './crm-persona-definitions';

/**
 * Zod Schema for Tool Matrix Entry.
 */
export const CrmToolMatrixEntrySchema = z.object({
  capabilityId: z.string().min(1),
  domain: z.string().min(1),
  riskLevel: z.enum([
    'L0_READ',
    'L1_INTERNAL_DRAFT',
    'L2_STATE_MUTATION',
    'L3_EXTERNAL_COMMUNICATION_FINANCE',
    'L4_PRIVILEGED_DESTRUCTIVE',
  ]),
  description: z.string().min(1),
  compensatingCapabilityId: z.string().optional(),
});

export type CrmToolMatrixEntry = z.infer<typeof CrmToolMatrixEntrySchema>;

/**
 * Zod Schema for Failure Matrix Entry.
 */
export const CrmFailureMatrixEntrySchema = z.object({
  failureCode: z.string().min(1),
  strategy: z.enum([
    'FAIL_CLOSED',
    'RE_FETCH_AND_VERIFY',
    'FALLBACK_TO_STATIC',
    'DEGRADE_GRACEFULLY',
    'ROUTE_TO_PROPOSAL',
    'CIRCUIT_BREAKER_BACKOFF',
  ]),
  fallbackCode: z.string().min(1),
  description: z.string().min(1),
  retryable: z.boolean(),
  requiresIntervention: z.boolean(),
});

export type CrmFailureMatrixEntry = z.infer<typeof CrmFailureMatrixEntrySchema>;

/**
 * 1. PERMISSION MATRIX (Rules 8, 16, 17)
 * Maps each CRM persona to its exact, non-wildcard RBAC permission scopes.
 */
export const CRM_PERMISSION_MATRIX: Readonly<Record<CrmPersonaId, readonly string[]>> = {
  crm_assistant: [
    'rbac:operations.campuses.view',
    'rbac:operations.pipeline.view',
    'rbac:operations.tasks.view',
    'rbac:operations.dashboard.view',
    'workspace:read',
  ],
  crm_researcher: [
    'rbac:operations.campuses.view',
    'rbac:studios.tags.view',
    'rbac:operations.tasks.view',
    'rbac:operations.dashboard.view',
    'workspace:read',
    'crm:timeline:view',
  ],
  lead_analyst: [
    'rbac:operations.campuses.view',
    'rbac:studios.tags.view',
    'rbac:operations.pipeline.view',
    'workspace:read',
  ],
  deal_strategist: [
    'rbac:operations.pipeline.view',
    'rbac:operations.campuses.view',
    'rbac:operations.tasks.view',
    'workspace:read',
  ],
  task_coordinator: [
    'rbac:operations.tasks.view',
    'rbac:operations.tasks.create',
    'rbac:operations.tasks.edit',
    'rbac:operations.campuses.view',
    'workspace:read',
  ],
  knowledge_analyst: [
    'rbac:operations.campuses.view',
    'workspace:read',
  ],
};

/**
 * 2. TOOL MATRIX (Rules 12, 59)
 * Maps each CRM persona to its allowed capability inventory and risk classification.
 */
export const CRM_TOOL_MATRIX: Readonly<Record<CrmPersonaId, readonly CrmToolMatrixEntry[]>> = {
  crm_assistant: [
    {
      capabilityId: 'crm.account.get_context',
      domain: 'crm_contacts',
      riskLevel: 'L0_READ',
      description: 'Fetch full 360-degree account context package across all timeline domains.',
    },
    {
      capabilityId: 'crm.timeline.get_events',
      domain: 'crm_contacts',
      riskLevel: 'L0_READ',
      description: 'Retrieve chronological account timeline events with metadata.',
    },
    {
      capabilityId: 'knowledge.memory.query',
      domain: 'knowledge_memory',
      riskLevel: 'L0_READ',
      description: 'Search semantic memory for grounded entity notes and historical context.',
    },
    {
      capabilityId: 'deal.pipeline.get',
      domain: 'deals_revenue',
      riskLevel: 'L0_READ',
      description: 'View active pipeline stage, deal amount, and health indicators.',
    },
    {
      capabilityId: 'crm.proposal.draft',
      domain: 'crm_contacts',
      riskLevel: 'L1_INTERNAL_DRAFT',
      description: 'Draft account update proposal for human operator review.',
    },
  ],

  crm_researcher: [
    {
      capabilityId: 'crm.account.get_context',
      domain: 'crm_contacts',
      riskLevel: 'L0_READ',
      description: 'Fetch full 360-degree account context package across all timeline domains.',
    },
    {
      capabilityId: 'crm.timeline.get_events',
      domain: 'crm_contacts',
      riskLevel: 'L0_READ',
      description: 'Retrieve chronological account timeline events with exact source citations.',
    },
    {
      capabilityId: 'knowledge.memory.query',
      domain: 'knowledge_memory',
      riskLevel: 'L0_READ',
      description: 'Search semantic memory for grounded entity facts and past interactions.',
    },
    {
      capabilityId: 'meetings.transcript.get',
      domain: 'meetings_conversations',
      riskLevel: 'L0_READ',
      description: 'Read past meeting transcripts and customer conversation recordings.',
    },
  ],

  lead_analyst: [
    {
      capabilityId: 'lead.intelligence.profile',
      domain: 'lead_intelligence',
      riskLevel: 'L0_READ',
      description: 'Retrieve technographic and firmographic profiles of inbound prospect.',
    },
    {
      capabilityId: 'crm.account.get_context',
      domain: 'crm_contacts',
      riskLevel: 'L0_READ',
      description: 'Fetch lead context package and engagement signals.',
    },
    {
      capabilityId: 'lead.proposal.tag_add',
      domain: 'crm_contacts',
      riskLevel: 'L1_INTERNAL_DRAFT',
      description: 'Propose lead qualification and enrichment tags for operator review.',
      compensatingCapabilityId: 'lead.proposal.tag_remove',
    },
  ],

  deal_strategist: [
    {
      capabilityId: 'deal.pipeline.get',
      domain: 'deals_revenue',
      riskLevel: 'L0_READ',
      description: 'Inspect deal stage history, sales velocity, and duration in stage.',
    },
    {
      capabilityId: 'deal.stage.analyze_stall',
      domain: 'deals_revenue',
      riskLevel: 'L0_READ',
      description: 'Calculate deal stall duration, identify competitor friction, and flag stall risk.',
    },
    {
      capabilityId: 'deal.proposal.stage_transition',
      domain: 'deals_revenue',
      riskLevel: 'L1_INTERNAL_DRAFT',
      description: 'Propose pipeline stage transition or tactical win action for account team.',
    },
  ],

  task_coordinator: [
    {
      capabilityId: 'meetings.commitments.extract',
      domain: 'meetings_conversations',
      riskLevel: 'L0_READ',
      description: 'Extract action items, promises, and follow-up commitments from meetings.',
    },
    {
      capabilityId: 'task.create',
      domain: 'tasks_productivity',
      riskLevel: 'L2_STATE_MUTATION',
      description: 'Create follow-up task assigned to team member with due date and priority.',
      compensatingCapabilityId: 'task.cancel',
    },
    {
      capabilityId: 'task.update',
      domain: 'tasks_productivity',
      riskLevel: 'L2_STATE_MUTATION',
      description: 'Update due date, assignee, or priority of existing workspace task.',
      compensatingCapabilityId: 'task.update',
    },
    {
      capabilityId: 'task.cancel',
      domain: 'tasks_productivity',
      riskLevel: 'L2_STATE_MUTATION',
      description: 'Cancel open workspace task with reason.',
      compensatingCapabilityId: 'task.create',
    },
  ],

  knowledge_analyst: [
    {
      capabilityId: 'knowledge.memory.query',
      domain: 'knowledge_memory',
      riskLevel: 'L0_READ',
      description: 'Query existing entity memory facts and key stakeholder preferences.',
    },
    {
      capabilityId: 'knowledge.proposal.fact_record',
      domain: 'knowledge_memory',
      riskLevel: 'L1_INTERNAL_DRAFT',
      description: 'Propose new verified fact for entity memory and relationship profile.',
    },
  ],
};

/**
 * 3. FAILURE MATRIX (Rules 2, 48)
 * Deterministic handling of failure modes, fallback codes, and recovery procedures.
 */
export const CRM_FAILURE_MATRIX: Readonly<Record<string, CrmFailureMatrixEntry>> = {
  ENTITY_NOT_FOUND: {
    failureCode: 'ENTITY_NOT_FOUND',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'ACCOUNT_NOT_FOUND',
    description: 'Entity does not exist in workspace; halts execution immediately with clear notification.',
    retryable: false,
    requiresIntervention: false,
  },
  STALE_RECORD: {
    failureCode: 'STALE_RECORD',
    strategy: 'RE_FETCH_AND_VERIFY',
    fallbackCode: 'VERSION_MISMATCH',
    description: 'Underlying workspace entity was modified concurrently; re-fetches latest state and retries.',
    retryable: true,
    requiresIntervention: false,
  },
  EMPTY_TIMELINE: {
    failureCode: 'EMPTY_TIMELINE',
    strategy: 'FALLBACK_TO_STATIC',
    fallbackCode: 'NO_ACTIVITY_LOGGED',
    description: 'No prior timeline events found; falls back to static account profile with informative notice.',
    retryable: false,
    requiresIntervention: false,
  },
  MODEL_TIMEOUT: {
    failureCode: 'MODEL_TIMEOUT',
    strategy: 'DEGRADE_GRACEFULLY',
    fallbackCode: 'AI_TIMEOUT_FALLBACK',
    description: 'LLM model timed out; falls back to deterministic rule-based summary without total failure.',
    retryable: true,
    requiresIntervention: false,
  },
  UNAPPROVED_MUTATION: {
    failureCode: 'UNAPPROVED_MUTATION',
    strategy: 'ROUTE_TO_PROPOSAL',
    fallbackCode: 'PROPOSAL_REQUIRED',
    description: 'Attempted mutation requires higher authority; automatically wraps into action proposal.',
    retryable: false,
    requiresIntervention: true,
  },
  RATE_LIMITED: {
    failureCode: 'RATE_LIMITED',
    strategy: 'CIRCUIT_BREAKER_BACKOFF',
    fallbackCode: 'RATE_LIMIT_BACKOFF',
    description: 'External provider rate limited; trips circuit breaker and backs off exponentially.',
    retryable: true,
    requiresIntervention: false,
  },
  PERMISSION_DENIED: {
    failureCode: 'PERMISSION_DENIED',
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'FORBIDDEN_SCOPE',
    description: 'Persona or caller lacks required RBAC scope; halts with HTTP 403 sanitized code.',
    retryable: false,
    requiresIntervention: true,
  },
  CONTEXT_OVERFLOW: {
    failureCode: 'CONTEXT_OVERFLOW',
    strategy: 'DEGRADE_GRACEFULLY',
    fallbackCode: 'CONTEXT_TRUNCATED',
    description: 'Context payload exceeded 4,000 token budget; activates greedy knapsack compression.',
    retryable: true,
    requiresIntervention: false,
  },
};

/**
 * 4. ROLLBACK MATRIX (Rule 27)
 * Reverse-LIFO Saga compensation mapping for state-mutating capabilities.
 */
export const CRM_ROLLBACK_MATRIX: Readonly<Record<string, string>> = {
  'task.create': 'task.cancel',
  'task.update': 'task.update',
  'task.cancel': 'task.create',
  'crm.entity.tag_add': 'crm.entity.tag_remove',
  'crm.entity.tag_remove': 'crm.entity.tag_add',
  'crm.entity.assign_owner': 'crm.entity.assign_owner',
  'deal.stage.transition': 'deal.stage.transition',
};

// ---------------------------------------------------------------------------
// Evaluator & Helper Functions
// ---------------------------------------------------------------------------

/**
 * Validates whether a CRM persona is authorized to access a given capability.
 */
export function validateCrmPersonaToolAccess(
  personaId: string,
  capabilityId: string
): { allowed: boolean; reason?: string; entry?: CrmToolMatrixEntry } {
  if (!isCrmPersonaId(personaId)) {
    return {
      allowed: false,
      reason: `Unknown CRM persona '${personaId}'`,
    };
  }

  const toolList = CRM_TOOL_MATRIX[personaId];
  const entry = toolList.find((t) => t.capabilityId === capabilityId);

  if (!entry) {
    return {
      allowed: false,
      reason: `Capability '${capabilityId}' is not in the allowed tool inventory for persona '${personaId}'`,
    };
  }

  return {
    allowed: true,
    entry,
  };
}

/**
 * Retrieves the compensating capability ID for a given capability, or null if read-only / none.
 */
export function getCrmRollbackCapability(capabilityId: string): string | null {
  return CRM_ROLLBACK_MATRIX[capabilityId] ?? null;
}

/**
 * Resolves the deterministic failure strategy and fallback code for an error.
 */
export function resolveCrmFailureStrategy(failureCode: string): CrmFailureMatrixEntry {
  const entry = CRM_FAILURE_MATRIX[failureCode];
  if (entry) {
    return entry;
  }

  return {
    failureCode,
    strategy: 'FAIL_CLOSED',
    fallbackCode: 'INTERNAL_FAILURE',
    description: `Unrecognized failure code '${failureCode}'; defaulting to fail-closed policy.`,
    retryable: false,
    requiresIntervention: false,
  };
}

/**
 * Returns all allowed tool entries for a given CRM persona.
 */
export function getPersonaAllowedCapabilities(personaId: string): readonly CrmToolMatrixEntry[] {
  if (isCrmPersonaId(personaId)) {
    return CRM_TOOL_MATRIX[personaId];
  }
  return [];
}

/**
 * Returns the explicit permission list for a given CRM persona.
 */
export function getPersonaPermissionList(personaId: string): readonly string[] {
  if (isCrmPersonaId(personaId)) {
    return CRM_PERMISSION_MATRIX[personaId];
  }
  return [];
}
