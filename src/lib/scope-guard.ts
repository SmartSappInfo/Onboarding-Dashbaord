/**
 * ScopeGuard - Validation functions for entity-workspace scope matching
 * 
 * Enforces the architectural rule: entity.entityType === workspace.contactScope
 * This is a hard server-side rule that must be validated on every write path.
 */

import { EntityType, ContactScope } from './types';

/**
 * Error codes for scope validation failures
 */
export const SCOPE_ERROR_CODES = {
  SCOPE_MISMATCH: 'SCOPE_MISMATCH',
} as const;

/**
 * Structured error for scope validation failures
 */
export interface ScopeValidationError {
  code: typeof SCOPE_ERROR_CODES.SCOPE_MISMATCH;
  message: string;
  entityType: EntityType;
  contactScope: ContactScope;
}

/**
 * Result type for scope validation
 */
export type ScopeValidationResult = 
  | { valid: true }
  | { valid: false; error: ScopeValidationError };

/**
 * Normalizes any contact scope string (including legacy aliases like 'school' or 'schools')
 * to its canonical ContactScope type key ('institution', 'family', or 'person').
 * 
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - 'institution' is the database key representing the "Institutions" UI scope.
 * - Legacy alias values ('school', 'schools', 'institutions') must resolve to 'institution'.
 * - Default fallback when unassigned is 'institution'.
 */
export function normalizeContactScope(scope?: string | null): ContactScope {
  if (!scope) return 'institution';
  const s = scope.trim().toLowerCase();
  if (s === 'institution' || s === 'institutions' || s === 'school' || s === 'schools') {
    return 'institution';
  }
  if (s === 'family' || s === 'families') {
    return 'family';
  }
  if (s === 'person' || s === 'people') {
    return 'person';
  }
  return 'institution';
}

/**
 * Checks if a workspace contact scope and entity type are compatible, taking
 * legacy aliases into account.
 */
export function areScopesCompatible(
  entityType?: string | null,
  contactScope?: string | null
): boolean {
  if (!entityType || !contactScope) return false;
  return normalizeContactScope(entityType) === normalizeContactScope(contactScope);
}

/**
 * Validates that an entity type matches a workspace's contact scope.
 * 
 * This is the core ScopeGuard validation function that enforces the architectural
 * invariant: entity.entityType === workspace.contactScope
 * 
 * @param entityType - The type of the entity being validated
 * @param contactScope - The contact scope declared by the workspace
 * @returns A validation result indicating success or failure with structured error
 */
export function validateScopeMatch(
  entityType: EntityType,
  contactScope: ContactScope
): ScopeValidationResult {
  if (areScopesCompatible(entityType, contactScope)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: {
      code: SCOPE_ERROR_CODES.SCOPE_MISMATCH,
      message: `Entity type "${entityType}" cannot be added to a workspace with scope "${contactScope}".`,
      entityType,
      contactScope,
    },
  };
}

