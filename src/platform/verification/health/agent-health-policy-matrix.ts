/**
 * @fileOverview Authoritative Agent Health Policy Matrix (Phase 14 Milestone 4)
 *
 * Implements Rule 1962, Rule 24 (Dynamic Circuit Breakers), Rule 42 (Shadow Mode Degradation),
 * and Rules 1940-1953 (Mandatory Governance Matrices).
 *
 * Establishes deterministic threshold boundaries, failure limits, and cool-off periods
 * across all specialized agent personas in SmartSapp.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { AGENT_PERSONA_IDS } from '../../identity/agent-persona-types';
import {
  HealthThresholdPolicy,
  HealthThresholdPolicySchema,
  AgentHealthStatus,
} from './health-types';

/**
 * Performance metrics input for evaluating persona health against thresholds.
 */
export interface PersonaEvaluationMetrics {
  successRate: number;
  failureRate: number;
  consecutiveFailures: number;
  toolErrorsCount: number;
}

/**
 * Default fallback policy for dynamically instantiated or unmapped personas.
 */
const DEFAULT_FALLBACK_HEALTH_POLICY: Omit<HealthThresholdPolicy, 'personaId'> = {
  minSuccessRate: 85,
  maxFailureRate: 15,
  maxToolErrorsPerHour: 10,
  maxConsecutiveFailures: 3,
  coolOffPeriodMs: 300000, // 5 minutes
  degradationMode: 'SHADOW_MODE',
};

/**
 * Authoritative registry of baseline operational SLAs per specialized agent persona.
 */
export const AGENT_HEALTH_POLICY_MATRIX: Record<string, HealthThresholdPolicy> = {
  // Sales & Outbound SDR Personas
  lead_sdr: HealthThresholdPolicySchema.parse({
    personaId: 'lead_sdr',
    minSuccessRate: 85,
    maxFailureRate: 15,
    maxToolErrorsPerHour: 10,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  prospecting_agent: HealthThresholdPolicySchema.parse({
    personaId: 'prospecting_agent',
    minSuccessRate: 85,
    maxFailureRate: 15,
    maxToolErrorsPerHour: 10,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  enrichment_agent: HealthThresholdPolicySchema.parse({
    personaId: 'enrichment_agent',
    minSuccessRate: 85,
    maxFailureRate: 15,
    maxToolErrorsPerHour: 10,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  qualification_agent: HealthThresholdPolicySchema.parse({
    personaId: 'qualification_agent',
    minSuccessRate: 85,
    maxFailureRate: 15,
    maxToolErrorsPerHour: 10,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  sales_coach: HealthThresholdPolicySchema.parse({
    personaId: 'sales_coach',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),

  // Finance & Mission-Critical Billing Personas (Strict 95% SLA)
  billing_analyst: HealthThresholdPolicySchema.parse({
    personaId: 'billing_analyst',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 5,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000, // 10 minutes
    degradationMode: 'SHADOW_MODE',
  }),
  collections_agent: HealthThresholdPolicySchema.parse({
    personaId: 'collections_agent',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 5,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000,
    degradationMode: 'SHADOW_MODE',
  }),
  reconciliation_agent: HealthThresholdPolicySchema.parse({
    personaId: 'reconciliation_agent',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 5,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000,
    degradationMode: 'SHADOW_MODE',
  }),
  revenue_analyst: HealthThresholdPolicySchema.parse({
    personaId: 'revenue_analyst',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 5,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000,
    degradationMode: 'SHADOW_MODE',
  }),
  invoice_assistant: HealthThresholdPolicySchema.parse({
    personaId: 'invoice_assistant',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 5,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000,
    degradationMode: 'SHADOW_MODE',
  }),
  finance_reporter: HealthThresholdPolicySchema.parse({
    personaId: 'finance_reporter',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 5,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000,
    degradationMode: 'SHADOW_MODE',
  }),

  // School Operations & Attendance Personas
  school_ops_agent: HealthThresholdPolicySchema.parse({
    personaId: 'school_ops_agent',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  attendance_analyst: HealthThresholdPolicySchema.parse({
    personaId: 'attendance_analyst',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  fee_collection_agent: HealthThresholdPolicySchema.parse({
    personaId: 'fee_collection_agent',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),

  // Knowledge & Memory Personas
  knowledge_agent: HealthThresholdPolicySchema.parse({
    personaId: 'knowledge_agent',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 180000, // 3 minutes
    degradationMode: 'SHADOW_MODE',
  }),
  knowledge_analyst: HealthThresholdPolicySchema.parse({
    personaId: 'knowledge_analyst',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 180000,
    degradationMode: 'SHADOW_MODE',
  }),

  // Meeting Intelligence Personas
  meeting_analyst: HealthThresholdPolicySchema.parse({
    personaId: 'meeting_analyst',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  meeting_prep: HealthThresholdPolicySchema.parse({
    personaId: 'meeting_prep',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),

  // CRM Operations Personas
  crm_researcher: HealthThresholdPolicySchema.parse({
    personaId: 'crm_researcher',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  crm_assistant: HealthThresholdPolicySchema.parse({
    personaId: 'crm_assistant',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  lead_analyst: HealthThresholdPolicySchema.parse({
    personaId: 'lead_analyst',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  deal_coach: HealthThresholdPolicySchema.parse({
    personaId: 'deal_coach',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  deal_strategist: HealthThresholdPolicySchema.parse({
    personaId: 'deal_strategist',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  task_coordinator: HealthThresholdPolicySchema.parse({
    personaId: 'task_coordinator',
    minSuccessRate: 90,
    maxFailureRate: 10,
    maxToolErrorsPerHour: 8,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),
  portal_guide: HealthThresholdPolicySchema.parse({
    personaId: 'portal_guide',
    minSuccessRate: 85,
    maxFailureRate: 15,
    maxToolErrorsPerHour: 10,
    maxConsecutiveFailures: 3,
    coolOffPeriodMs: 300000,
    degradationMode: 'SHADOW_MODE',
  }),

  // Supervisor Swarm Orchestrator (Strict 95% SLA)
  supervisor: HealthThresholdPolicySchema.parse({
    personaId: 'supervisor',
    minSuccessRate: 95,
    maxFailureRate: 5,
    maxToolErrorsPerHour: 4,
    maxConsecutiveFailures: 2,
    coolOffPeriodMs: 600000,
    degradationMode: 'SHADOW_MODE',
  }),
};

// Ensure all built-in personas from AGENT_PERSONA_IDS have a registered policy
for (const personaId of AGENT_PERSONA_IDS) {
  if (!AGENT_HEALTH_POLICY_MATRIX[personaId]) {
    AGENT_HEALTH_POLICY_MATRIX[personaId] = HealthThresholdPolicySchema.parse({
      personaId,
      ...DEFAULT_FALLBACK_HEALTH_POLICY,
    });
  }
}

/**
 * Retrieves the health threshold policy for a given persona ID.
 * Returns a safe default policy if personaId is unmapped.
 */
export function getPersonaHealthPolicy(personaId: string): HealthThresholdPolicy {
  const policy = AGENT_HEALTH_POLICY_MATRIX[personaId];
  if (policy) {
    return policy;
  }
  return HealthThresholdPolicySchema.parse({
    personaId,
    ...DEFAULT_FALLBACK_HEALTH_POLICY,
  });
}

/**
 * Determines whether a persona's current performance violates its policy SLA,
 * warranting immediate circuit breaker tripping.
 */
export function shouldTripCircuitBreaker(
  personaId: string,
  metrics: PersonaEvaluationMetrics
): boolean {
  const policy = getPersonaHealthPolicy(personaId);

  // Fast trip on consecutive failure threshold breach
  if (metrics.consecutiveFailures >= policy.maxConsecutiveFailures) {
    return true;
  }

  // Trip on overall success rate breach
  if (metrics.successRate < policy.minSuccessRate) {
    return true;
  }

  // Trip on overall failure rate breach
  if (metrics.failureRate > policy.maxFailureRate) {
    return true;
  }

  return false;
}

/**
 * Evaluates an agent's operational health status based on its policy thresholds.
 */
export function evaluateHealthStatus(
  personaId: string,
  metrics: PersonaEvaluationMetrics
): AgentHealthStatus {
  const policy = getPersonaHealthPolicy(personaId);

  if (shouldTripCircuitBreaker(personaId, metrics)) {
    return 'TRIPPED';
  }

  // If failure rate is elevated (> 50% of allowable max) or consecutive failures > 0
  const elevatedThreshold = policy.maxFailureRate / 2;
  if (metrics.failureRate >= elevatedThreshold || metrics.consecutiveFailures > 0) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

/**
 * Returns the degradation mode for a persona when its circuit breaker is OPEN.
 * Defaults strictly to 'SHADOW_MODE' (Rule 42).
 */
export function getDegradationMode(personaId: string): 'SHADOW_MODE' {
  const policy = getPersonaHealthPolicy(personaId);
  return policy.degradationMode as 'SHADOW_MODE';
}

/**
 * Returns all registered health policies.
 */
export function getAllHealthPolicyEntries(): HealthThresholdPolicy[] {
  return Object.values(AGENT_HEALTH_POLICY_MATRIX);
}
