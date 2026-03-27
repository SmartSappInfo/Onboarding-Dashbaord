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
 * Validates that an entity type matches a workspace's contact scope.
 * 
 * This is the core ScopeGuard validation function that enforces the architectural
 * invariant: entity.entityType === workspace.contactScope
 * 
 * @param entityType - The type of the entity being validated
 * @param contactScope - The contact scope declared by the workspace
 * @returns A validation result indicating success or failure with structured error
 * 
 * @example
 * ```typescript
 * const result = validateScopeMatch('institution', 'institution');
 * if (!result.valid) {
 *   console.error(result.error.message);
 *   // Handle error
 * }
 * ```
 */
export function validateScopeMatch(
  entityType: EntityType,
  contactScope: ContactScope
): ScopeValidationResult {
  if (entityType === contactScope) {
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
