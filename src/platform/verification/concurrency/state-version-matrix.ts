/**
 * @fileOverview Authoritative State Version Matrix Registry & Policy Lookups (Phase 14 Milestone 2)
 *
 * Enforces:
 * - Rule 10 (Inline Architectural Documentation): Comprehensive policy definitions
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard): Collection and version field registry
 * - Rule 23 (Resource Governance & Quotas): Enforceable lease timeouts
 * - Rule 48 (Sanitized Error Taxonomy): Structured error throwing
 */

import {
  type StateVersionMatrixEntry,
  StateConcurrencyError,
} from './state-version-types';

// ============================================================================
// 1. DEFAULT CONCURRENCY POLICY
// ============================================================================

export const DEFAULT_CONCURRENCY_POLICY: Readonly<StateVersionMatrixEntry> = {
  resourceType: 'default',
  collectionPath: '/unknown',
  versionField: 'version',
  leaseDurationMs: 30000,
  requiresHashValidation: true,
};

// ============================================================================
// 2. AUTHORITATIVE STATE_VERSION_MATRIX REGISTRY (Rule 18)
// ============================================================================

export const STATE_VERSION_MATRIX: Readonly<Record<string, StateVersionMatrixEntry>> = {
  crm_entity: {
    resourceType: 'crm_entity',
    collectionPath: '/entities',
    versionField: 'version',
    leaseDurationMs: 30000,
    requiresHashValidation: true,
  },
  deal: {
    resourceType: 'deal',
    collectionPath: '/deals',
    versionField: 'stageVersion',
    leaseDurationMs: 15000,
    requiresHashValidation: true,
  },
  invoice: {
    resourceType: 'invoice',
    collectionPath: '/invoices',
    versionField: 'version',
    leaseDurationMs: 60000,
    requiresHashValidation: true,
  },
  installment_plan: {
    resourceType: 'installment_plan',
    collectionPath: '/installment_plans',
    versionField: 'version',
    leaseDurationMs: 30000,
    requiresHashValidation: true,
  },
  knowledge_fact: {
    resourceType: 'knowledge_fact',
    collectionPath: '/knowledge_facts',
    versionField: 'version',
    leaseDurationMs: 10000,
    requiresHashValidation: true,
  },
  mesh_task: {
    resourceType: 'mesh_task',
    collectionPath: '/mesh_tasks',
    versionField: 'version',
    leaseDurationMs: 15000,
    requiresHashValidation: true,
  },
};

// ============================================================================
// 3. POLICY LOOKUP & ASSERTION HELPERS
// ============================================================================

/**
 * Retrieves the state version policy for a given resource type, or null if unregistered.
 */
export function getStateVersionPolicy(
  resourceType: string
): StateVersionMatrixEntry | null {
  return STATE_VERSION_MATRIX[resourceType] ?? null;
}

/**
 * Asserts that a resource type is registered in the STATE_VERSION_MATRIX.
 * Throws StateConcurrencyError (404) if unregistered.
 */
export function assertStateVersionPolicy(
  resourceType: string
): StateVersionMatrixEntry {
  const policy = STATE_VERSION_MATRIX[resourceType];
  if (!policy) {
    throw new StateConcurrencyError(
      'RESOURCE_NOT_FOUND',
      `Resource type '${resourceType}' is not registered in STATE_VERSION_MATRIX`
    );
  }
  return policy;
}

/**
 * Returns all registered state version policies.
 */
export function getAllStateVersionPolicies(): Readonly<StateVersionMatrixEntry[]> {
  return Object.values(STATE_VERSION_MATRIX);
}

/**
 * Resolves the version field name for a resource type, falling back to 'version'.
 */
export function getVersionFieldName(resourceType: string): string {
  const policy = STATE_VERSION_MATRIX[resourceType];
  return policy ? policy.versionField : DEFAULT_CONCURRENCY_POLICY.versionField;
}

/**
 * Resolves the optimistic lease duration in milliseconds for a resource type.
 */
export function getLeaseDurationMs(resourceType: string): number {
  const policy = STATE_VERSION_MATRIX[resourceType];
  return policy ? policy.leaseDurationMs : DEFAULT_CONCURRENCY_POLICY.leaseDurationMs;
}

/**
 * Resolves whether cryptographic state hash validation is required.
 */
export function isHashValidationRequired(resourceType: string): boolean {
  const policy = STATE_VERSION_MATRIX[resourceType];
  return policy ? policy.requiresHashValidation : DEFAULT_CONCURRENCY_POLICY.requiresHashValidation;
}
