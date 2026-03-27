/**
 * Import Service
 * 
 * Handles CSV import with scope validation, preview, error reporting, and idempotency.
 * Requirements: 20, 27
 */

import { parse } from 'csv-parse/sync';
import type { Entity, EntityType, ContactScope, Workspace } from '../types';
import { validateScopeMatch } from '../scope-guard';
import type { InstitutionImportRow } from './institution-template';
import type { FamilyImportRow } from './family-template';
import type { PersonImportRow } from './person-template';

export interface ImportError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ImportPreview {
  rows: Array<Record<string, string>>;
  totalRows: number;
  columns: string[];
  errors: ImportError[];
}

export interface ImportResult {
  succeeded: number;
  failed: number;
  skipped: number;
  errors: ImportError[];
  createdEntityIds: string[];
}

/**
 * Parse CSV content and return preview of first 10 rows
 * Requirement 20: Import preview
 */
export function previewImport(csvContent: string): ImportPreview {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const preview = records.slice(0, 10);
    const columns = records.length > 0 ? Object.keys(records[0]) : [];

    return {
      rows: preview,
      totalRows: records.length,
      columns,
      errors: [],
    };
  } catch (error) {
    return {
      rows: [],
      totalRows: 0,
      columns: [],
      errors: [
        {
          rowNumber: 0,
          message: `CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
}

/**
 * Validate import row against workspace contactScope
 * Requirement 20: ScopeGuard enforcement
 */
export function validateImportRow(
  row: Record<string, string>,
  rowNumber: number,
  workspace: Workspace
): { valid: boolean; errors: ImportError[]; entityType: EntityType | null } {
  const errors: ImportError[] = [];
  let entityType: EntityType | null = null;

  // Ensure workspace has contactScope
  if (!workspace.contactScope) {
    errors.push({
      rowNumber,
      message: 'Workspace does not have a contactScope defined',
    });
    return { valid: false, errors, entityType: null };
  }

  // Infer entity type from row structure
  if ('name' in row && ('nominalRoll' in row || 'subscriptionPackageId' in row)) {
    entityType = 'institution';
  } else if ('familyName' in row && ('guardian1_name' in row || 'child1_firstName' in row)) {
    entityType = 'family';
  } else if ('firstName' in row && 'lastName' in row) {
    entityType = 'person';
  } else {
    errors.push({
      rowNumber,
      message: 'Cannot infer entity type from row structure',
    });
    return { valid: false, errors, entityType: null };
  }

  // Enforce ScopeGuard: entityType must match workspace contactScope
  const scopeValidation = validateScopeMatch(entityType, workspace.contactScope);
  if (!scopeValidation.valid) {
    errors.push({
      rowNumber,
      message: scopeValidation.error?.message || 'Scope mismatch',
    });
    return { valid: false, errors, entityType };
  }

  // Validate required fields based on entity type
  if (entityType === 'institution') {
    if (!row.name || row.name.trim() === '') {
      errors.push({
        rowNumber,
        field: 'name',
        message: 'Institution name is required',
      });
    }
    if (row.nominalRoll && isNaN(parseInt(row.nominalRoll, 10))) {
      errors.push({
        rowNumber,
        field: 'nominalRoll',
        message: 'Nominal roll must be a number',
      });
    }
  } else if (entityType === 'family') {
    if (!row.familyName || row.familyName.trim() === '') {
      errors.push({
        rowNumber,
        field: 'familyName',
        message: 'Family name is required',
      });
    }
  } else if (entityType === 'person') {
    if (!row.firstName || row.firstName.trim() === '') {
      errors.push({
        rowNumber,
        field: 'firstName',
        message: 'First name is required',
      });
    }
    if (!row.lastName || row.lastName.trim() === '') {
      errors.push({
        rowNumber,
        field: 'lastName',
        message: 'Last name is required',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    entityType,
  };
}

/**
 * Check if entity already exists (for idempotency)
 * Requirement 20: Idempotent import
 */
export async function checkEntityExists(
  name: string,
  organizationId: string,
  entityType: EntityType
): Promise<string | null> {
  // This would query Firestore to check if entity exists
  // Returns entityId if found, null otherwise
  // Implementation depends on Firestore setup
  return null; // Placeholder
}

/**
 * Parse institution row to entity data
 */
export function parseInstitutionRow(row: InstitutionImportRow, organizationId: string): Partial<Entity> {
  const contacts = [];
  if (row.focalPerson_name) {
    contacts.push({
      name: row.focalPerson_name,
      phone: row.focalPerson_phone || '',
      email: row.focalPerson_email || '',
      type: (row.focalPerson_type as any) || 'Other',
      isSignatory: false,
    });
  }

  return {
    organizationId,
    entityType: 'institution',
    name: row.name,
    contacts,
    globalTags: [],
    status: 'active',
    institutionData: {
      nominalRoll: row.nominalRoll ? parseInt(row.nominalRoll, 10) : undefined,
      billingAddress: row.billingAddress,
      currency: row.currency,
      subscriptionPackageId: row.subscriptionPackageId,
      subscriptionRate: undefined,
      modules: [],
      implementationDate: undefined,
      referee: undefined,
    },
  };
}

/**
 * Parse family row to entity data
 */
export function parseFamilyRow(row: FamilyImportRow, organizationId: string): Partial<Entity> {
  const guardians = [];
  if (row.guardian1_name) {
    guardians.push({
      name: row.guardian1_name,
      phone: row.guardian1_phone || '',
      email: row.guardian1_email || '',
      relationship: row.guardian1_relationship || 'Guardian',
      isPrimary: true,
    });
  }

  const children = [];
  if (row.child1_firstName && row.child1_lastName) {
    children.push({
      firstName: row.child1_firstName,
      lastName: row.child1_lastName,
      dateOfBirth: '', // Default empty string for required field (not captured in CSV)
      gradeLevel: row.child1_gradeLevel,
      enrollmentStatus: undefined,
    });
  }

  return {
    organizationId,
    entityType: 'family',
    name: row.familyName,
    contacts: guardians.map((g) => ({
      name: g.name,
      phone: g.phone,
      email: g.email,
      type: 'Guardian' as any,
      isSignatory: false,
    })),
    globalTags: [],
    status: 'active',
    familyData: {
      guardians,
      children,
      admissionsData: undefined,
    },
  };
}

/**
 * Parse person row to entity data
 */
export function parsePersonRow(row: PersonImportRow, organizationId: string): Partial<Entity> {
  const contacts = [];
  if (row.phone || row.email) {
    contacts.push({
      name: `${row.firstName} ${row.lastName}`,
      phone: row.phone || '',
      email: row.email || '',
      type: 'Primary' as any,
      isSignatory: false,
    });
  }

  return {
    organizationId,
    entityType: 'person',
    name: `${row.firstName} ${row.lastName}`,
    contacts,
    globalTags: [],
    status: 'active',
    personData: {
      firstName: row.firstName,
      lastName: row.lastName,
      company: row.company,
      jobTitle: row.jobTitle,
      leadSource: row.leadSource,
    },
  };
}
