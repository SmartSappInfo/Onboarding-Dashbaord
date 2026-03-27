/**
 * Organization Utilities
 * 
 * Provides safe utilities for extracting organization identifiers from various
 * entity types, with proper fallback handling for legacy data.
 * 
 * Strategic Solution for Type Safety:
 * - Centralizes organizationId extraction logic
 * - Provides consistent fallback behavior
 * - Prevents TypeScript errors from missing fields
 * - Makes migration path explicit and documented
 */

import type { School, Entity, WorkspaceEntity } from './types';

/**
 * Safely extracts organizationId from a School record
 * 
 * Handles legacy data where organizationId may not be present by falling back
 * to the first workspaceId. This is safe because:
 * 1. In single-tenant setups, workspaceId === organizationId
 * 2. In multi-tenant setups, new data will have organizationId
 * 3. Migration scripts will backfill organizationId for legacy data
 * 
 * @param school - School record (may be legacy or migrated)
 * @param defaultValue - Fallback value if no organizationId can be determined
 * @returns organizationId string
 */
export function getOrganizationId(
  school: School,
  defaultValue: string = 'unknown'
): string {
  return school.organizationId || school.workspaceIds?.[0] || defaultValue;
}

/**
 * Safely extracts organizationId from an Entity record
 * 
 * Entities should always have organizationId, but this provides a safe accessor
 * with fallback for defensive programming.
 * 
 * @param entity - Entity record
 * @param defaultValue - Fallback value if no organizationId present
 * @returns organizationId string
 */
export function getEntityOrganizationId(
  entity: Entity,
  defaultValue: string = 'unknown'
): string {
  return entity.organizationId || defaultValue;
}

/**
 * Safely extracts organizationId from a WorkspaceEntity record
 * 
 * WorkspaceEntities should always have organizationId, but this provides a safe
 * accessor with fallback for defensive programming.
 * 
 * @param workspaceEntity - WorkspaceEntity record
 * @param defaultValue - Fallback value if no organizationId present
 * @returns organizationId string
 */
export function getWorkspaceEntityOrganizationId(
  workspaceEntity: WorkspaceEntity,
  defaultValue: string = 'unknown'
): string {
  return workspaceEntity.organizationId || defaultValue;
}

/**
 * Validates that an organizationId is present and not a fallback value
 * 
 * Useful for ensuring data quality before critical operations.
 * 
 * @param organizationId - The organizationId to validate
 * @returns true if valid, false if it's a fallback value
 */
export function isValidOrganizationId(organizationId: string): boolean {
  return organizationId !== 'unknown' && organizationId.trim() !== '';
}

/**
 * Type guard to check if a School has an explicit organizationId
 * 
 * @param school - School record to check
 * @returns true if school has organizationId field populated
 */
export function hasOrganizationId(school: School): school is School & { organizationId: string } {
  return typeof school.organizationId === 'string' && school.organizationId.trim() !== '';
}
