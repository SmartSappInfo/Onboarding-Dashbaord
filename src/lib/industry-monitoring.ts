import type { IndustryVertical } from '@/lib/types';
import { INDUSTRY_CONFIG } from '@/lib/industry-config';

/**
 * @fileOverview Industry-Specific Error Messaging
 * 
 * Provides industry-appropriate error messages using terminology from INDUSTRY_CONFIG.
 * 
 * Requirements:
 * - 13.1–13.12: Apply industry-specific terminology to error messages
 * - 44.1–44.10: Display industry-appropriate error messages
 */

export type ErrorCode =
  | 'entity_not_found'
  | 'entity_create_failed'
  | 'entity_update_failed'
  | 'entity_delete_failed'
  | 'workspace_scope_locked'
  | 'industry_mismatch'
  | 'validation_failed'
  | 'permission_denied'
  | 'record_not_found'
  | 'operation_failed';

interface ErrorMessageOptions {
  entityName?: string;
  fieldName?: string;
  details?: string;
}

/**
 * Get industry-specific error message for a given error code.
 * 
 * @param errorCode - The error code to get a message for
 * @param industry - The industry vertical for terminology
 * @param options - Optional parameters for message customization
 * @returns Industry-appropriate error message
 * 
 * @example
 * ```ts
 * const message = getIndustryErrorMessage('entity_not_found', 'SaaS');
 * // Returns: "Account not found"
 * 
 * const message = getIndustryErrorMessage('entity_not_found', 'Law');
 * // Returns: "Client not found"
 * ```
 */
export function getIndustryErrorMessage(
  errorCode: ErrorCode,
  industry: IndustryVertical,
  options: ErrorMessageOptions = {}
): string {
  const terminology = INDUSTRY_CONFIG[industry].terminology;
  const { entityName, fieldName, details } = options;

  switch (errorCode) {
    case 'entity_not_found':
      return `${terminology.entitySingular} not found${entityName ? `: ${entityName}` : ''}`;

    case 'entity_create_failed':
      return `Failed to create ${terminology.entitySingular.toLowerCase()}${details ? `: ${details}` : ''}`;

    case 'entity_update_failed':
      return `Failed to update ${terminology.entitySingular.toLowerCase()}${entityName ? ` "${entityName}"` : ''}${details ? `: ${details}` : ''}`;

    case 'entity_delete_failed':
      return `Failed to delete ${terminology.entitySingular.toLowerCase()}${entityName ? ` "${entityName}"` : ''}${details ? `: ${details}` : ''}`;

    case 'workspace_scope_locked':
      return `Workspace industry is locked and cannot be changed. This workspace manages ${terminology.entityPlural}.`;

    case 'industry_mismatch':
      return `Industry data mismatch. Expected ${industry} ${terminology.entitySingular.toLowerCase()} data.`;

    case 'validation_failed':
      return `Validation failed${fieldName ? ` for ${fieldName}` : ''}${details ? `: ${details}` : ''}`;

    case 'permission_denied':
      return `You don't have permission to perform this action on ${terminology.entityPlural.toLowerCase()}`;

    case 'record_not_found':
      return `Record not found${entityName ? `: ${entityName}` : ''}`;

    case 'operation_failed':
      return `Operation failed${details ? `: ${details}` : ''}`;

    default:
      return `An error occurred${details ? `: ${details}` : ''}`;
  }
}

/**
 * Get industry-specific success message for common operations.
 * 
 * @param operation - The operation that succeeded
 * @param industry - The industry vertical for terminology
 * @param entityName - Optional entity name for personalization
 * @returns Industry-appropriate success message
 * 
 * @example
 * ```ts
 * const message = getIndustrySuccessMessage('create', 'SaaS', 'Acme Corp');
 * // Returns: "Account created successfully: Acme Corp"
 * ```
 */
export function getIndustrySuccessMessage(
  operation: 'create' | 'update' | 'delete' | 'archive',
  industry: IndustryVertical,
  entityName?: string
): string {
  const terminology = INDUSTRY_CONFIG[industry].terminology;

  switch (operation) {
    case 'create':
      return `${terminology.entitySingular} created successfully${entityName ? `: ${entityName}` : ''}`;

    case 'update':
      return `${terminology.entitySingular} updated successfully${entityName ? `: ${entityName}` : ''}`;

    case 'delete':
      return `${terminology.entitySingular} deleted successfully${entityName ? `: ${entityName}` : ''}`;

    case 'archive':
      return `${terminology.entitySingular} archived successfully${entityName ? `: ${entityName}` : ''}`;

    default:
      return `Operation completed successfully${entityName ? `: ${entityName}` : ''}`;
  }
}

/**
 * Get industry-specific confirmation message for destructive operations.
 * 
 * @param operation - The operation requiring confirmation
 * @param industry - The industry vertical for terminology
 * @param entityName - Optional entity name for personalization
 * @returns Industry-appropriate confirmation message
 * 
 * @example
 * ```ts
 * const message = getIndustryConfirmMessage('delete', 'SchoolEnrollment', 'Lincoln High');
 * // Returns: "Are you sure you want to delete this School? Lincoln High"
 * ```
 */
export function getIndustryConfirmMessage(
  operation: 'delete' | 'archive' | 'transfer',
  industry: IndustryVertical,
  entityName?: string
): string {
  const terminology = INDUSTRY_CONFIG[industry].terminology;

  switch (operation) {
    case 'delete':
      return `Are you sure you want to delete this ${terminology.entitySingular.toLowerCase()}?${entityName ? ` ${entityName}` : ''}`;

    case 'archive':
      return `Are you sure you want to archive this ${terminology.entitySingular.toLowerCase()}?${entityName ? ` ${entityName}` : ''}`;

    case 'transfer':
      return `Are you sure you want to transfer this ${terminology.entitySingular.toLowerCase()}?${entityName ? ` ${entityName}` : ''}`;

    default:
      return `Are you sure you want to proceed?${entityName ? ` ${entityName}` : ''}`;
  }
}
