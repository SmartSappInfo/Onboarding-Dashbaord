/**
 * CSV Parser and Validator
 * 
 * Requirements: 20.2, 20.3, 20.4
 * 
 * Parses CSV files and validates rows against scope-specific schemas
 */

import { EntityType, ContactScope } from './types';
import { validateScopeMatch } from './scope-guard';
import { validateRequiredFields, getTemplateColumns } from './import-templates';
import type {
  ImportRow,
  ImportValidationError,
  ImportPreview,
  InstitutionImportRow,
  FamilyImportRow,
  PersonImportRow,
} from './import-export-types';

/**
 * Parses a CSV string into rows
 * 
 * @param csvContent - Raw CSV content
 * @returns Array of row objects with column headers as keys
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Skip empty rows
    if (values.every(v => !v || v.trim() === '')) {
      continue;
    }
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    
    rows.push(row);
  }

  return rows;
}

/**
 * Parses a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
}

/**
 * Infers the entity type from CSV headers
 * 
 * @param headers - Array of column headers
 * @returns Detected entity type or null if ambiguous
 */
export function inferEntityType(headers: string[]): EntityType | null {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));

  // Check for institution-specific fields
  if (headerSet.has('nominalroll') || headerSet.has('subscriptionpackageid')) {
    return 'institution';
  }

  // Check for family-specific fields
  if (headerSet.has('familyname') || headerSet.has('guardian1_name') || headerSet.has('child1_firstname')) {
    return 'family';
  }

  // Check for person-specific fields (must have both firstName and lastName)
  if (headerSet.has('firstname') && headerSet.has('lastname')) {
    return 'person';
  }

  return null;
}

/**
 * Validates a CSV import against workspace contact scope
 * 
 * Requirements: 20.2, 20.3, 20.4
 * 
 * @param csvContent - Raw CSV content
 * @param workspaceContactScope - The workspace's declared contact scope
 * @returns Import preview with validation results
 */
export function validateImport(
  csvContent: string,
  workspaceContactScope: ContactScope
): ImportPreview {
  const rows = parseCSV(csvContent);
  
  if (rows.length === 0) {
    return {
      totalRows: 0,
      previewRows: [],
      fieldMapping: {},
      detectedScope: workspaceContactScope,
      errors: [{ row: 0, reason: 'CSV file is empty or has no data rows' }],
    };
  }

  // Infer entity type from headers
  const headers = Object.keys(rows[0]);
  const detectedScope = inferEntityType(headers);

  const errors: ImportValidationError[] = [];

  // Validate scope match (Requirement 20.3)
  if (!detectedScope) {
    errors.push({
      row: 0,
      reason: 'Could not determine entity type from CSV headers. Please use the correct template.',
    });
  } else {
    const scopeValidation = validateScopeMatch(detectedScope, workspaceContactScope);
    if (!scopeValidation.valid) {
      errors.push({
        row: 0,
        reason: scopeValidation.error.message,
      });
    }
  }

  // Validate each row (Requirement 20.4)
  const validatedRows: ImportRow[] = [];
  const previewLimit = 10;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is headers, and we're 0-indexed

    if (detectedScope) {
      // Validate required fields
      const fieldValidation = validateRequiredFields(row, detectedScope);
      if (!fieldValidation.valid) {
        errors.push({
          row: rowNumber,
          reason: `Missing required fields: ${fieldValidation.missingFields.join(', ')}`,
        });
      }

      // Type-specific validation
      const rowErrors = validateRowData(row, detectedScope, rowNumber);
      errors.push(...rowErrors);
    }

    // Add to preview (first 10 rows)
    if (validatedRows.length < previewLimit) {
      validatedRows.push(row as ImportRow);
    }
  }

  // Build field mapping
  const fieldMapping: Record<string, string> = {};
  if (detectedScope) {
    const templateColumns = getTemplateColumns(detectedScope);
    templateColumns.forEach(col => {
      fieldMapping[col] = col;
    });
  }

  return {
    totalRows: rows.length,
    previewRows: validatedRows,
    fieldMapping,
    detectedScope: detectedScope || workspaceContactScope,
    errors,
  };
}

/**
 * Validates row data based on entity type
 */
function validateRowData(
  row: Record<string, string>,
  entityType: EntityType,
  rowNumber: number
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  switch (entityType) {
    case 'institution':
      // Validate nominalRoll is a positive integer
      if (row.nominalRoll && row.nominalRoll.trim()) {
        const nominalRoll = parseInt(row.nominalRoll, 10);
        if (isNaN(nominalRoll) || nominalRoll < 0) {
          errors.push({
            row: rowNumber,
            field: 'nominalRoll',
            reason: 'nominalRoll must be a positive integer',
            value: row.nominalRoll,
          });
        }
      }
      break;

    case 'family':
      // Validate at least one guardian or child is provided
      const hasGuardian = row.guardian1_name && row.guardian1_name.trim();
      const hasChild = row.child1_firstName && row.child1_firstName.trim();
      
      if (!hasGuardian && !hasChild) {
        errors.push({
          row: rowNumber,
          reason: 'Family must have at least one guardian or child',
        });
      }
      break;

    case 'person':
      // firstName and lastName are already validated as required fields
      break;
  }

  // Validate email format if provided
  if (row.email && row.email.trim()) {
    if (!isValidEmail(row.email)) {
      errors.push({
        row: rowNumber,
        field: 'email',
        reason: 'Invalid email format',
        value: row.email,
      });
    }
  }

  // Validate focal person email if provided (institution)
  if (row.focalPerson_email && row.focalPerson_email.trim()) {
    if (!isValidEmail(row.focalPerson_email)) {
      errors.push({
        row: rowNumber,
        field: 'focalPerson_email',
        reason: 'Invalid email format',
        value: row.focalPerson_email,
      });
    }
  }

  // Validate guardian email if provided (family)
  if (row.guardian1_email && row.guardian1_email.trim()) {
    if (!isValidEmail(row.guardian1_email)) {
      errors.push({
        row: rowNumber,
        field: 'guardian1_email',
        reason: 'Invalid email format',
        value: row.guardian1_email,
      });
    }
  }

  return errors;
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
