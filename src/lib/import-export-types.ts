/**
 * Type definitions for scope-specific import/export functionality
 * 
 * Requirements: 20, 27
 */

import { EntityType, ContactScope } from './types';

/**
 * CSV column schemas for each contact scope
 */

// Institution CSV columns (Requirement 20.7)
export interface InstitutionImportRow {
  name: string;
  nominalRoll?: string;
  billingAddress?: string;
  currency?: string;
  subscriptionPackageId?: string;
  focalPerson_name?: string;
  focalPerson_phone?: string;
  focalPerson_email?: string;
  focalPerson_type?: string;
}

// Family CSV columns (Requirement 20.8)
export interface FamilyImportRow {
  familyName: string;
  guardian1_name?: string;
  guardian1_phone?: string;
  guardian1_email?: string;
  guardian1_relationship?: string;
  child1_firstName?: string;
  child1_lastName?: string;
  child1_gradeLevel?: string;
}

// Person CSV columns (Requirement 20.9)
export interface PersonImportRow {
  firstName: string;
  lastName: string;
  company?: string;
  jobTitle?: string;
  leadSource?: string;
  phone?: string;
  email?: string;
}

/**
 * Union type for all import row types
 */
export type ImportRow = InstitutionImportRow | FamilyImportRow | PersonImportRow;

/**
 * Import validation error
 */
export interface ImportValidationError {
  row: number;
  field?: string;
  reason: string;
  value?: any;
}

/**
 * Import preview result (Requirement 20.5)
 */
export interface ImportPreview {
  totalRows: number;
  previewRows: ImportRow[];
  fieldMapping: Record<string, string>;
  detectedScope: EntityType;
  errors: ImportValidationError[];
}

/**
 * Import result (Requirement 20.4, 20.6)
 */
export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: ImportValidationError[];
  createdEntityIds: string[];
  duplicateEntityIds: string[];
}

/**
 * Export options
 */
export interface ExportOptions {
  workspaceId: string;
  entityType: EntityType;
  includeGlobalTags?: boolean;
  includeWorkspaceTags?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  csvContent: string;
  filename: string;
  rowCount: number;
}
