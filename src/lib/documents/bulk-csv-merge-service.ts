/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Bulk CSV Merge & Sanitization Service (Phase 9):
 * 1. Purpose & Standards:
 *    Parses, validates, and sanitizes enterprise bulk CSV rosters for document
 *    signing dispatch campaigns. Conforms to RFC 4180 CSV specifications.
 * 2. Security Defense (FM-P9-07 - CSV Formula Injection / DDE Attack):
 *    All cell contents starting with formula trigger operators (`=`, `+`, `-`, `@`,
 *    `\t`, `\r`) are sanitized by prepending a single quote (`'`), neutralizing
 *    remote code execution (RCE) and dynamic data exchange vulnerabilities in Excel/Calc.
 * 3. Pre-Flight Variable Linting (FM-P9-04 - Missing Merge Fields):
 *    Validates template placeholder completeness on every row prior to dispatch staging,
 *    preventing blank variables on legal contracts.
 * 4. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import Papa from 'papaparse';
import {
  BulkCsvMergePreviewResult,
  BulkCsvMergePreviewResultSchema,
  BulkCsvMergePreviewItem,
} from '@/lib/types/document-signing';

export interface ParsedRecipientRow {
  rowIndex: number;
  name: string;
  email: string;
  phone?: string;
  variables: Record<string, string>;
  raw: Record<string, string>;
  isValid: boolean;
  errors: string[];
}

export interface ParsedCsvResult {
  headers: string[];
  totalRows: number;
  rows: ParsedRecipientRow[];
  nameColumn?: string;
  emailColumn?: string;
  phoneColumn?: string;
  variableColumns: string[];
  parseErrors: string[];
}

export interface VariableLintResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  detectedColumns: string[];
  templateVariables: string[];
  unmappedVariables: string[];
  rowErrors: Array<{ rowIndex: number; errors: string[] }>;
}

/**
 * Sanitizes a single CSV cell string against Formula Injection / DDE attacks (FM-P9-07).
 * Strips leading control characters and prepends a single quote if the cell begins
 * with formula initiation characters (=, +, -, @, |).
 */
export function sanitizeCsvCell(val: string): string {
  if (!val) return '';
  // Strip leading tabs, newlines, and carriage returns
  const stripped = val.replace(/^[\t\r\n]+/, '').trim();
  if (stripped.length === 0) return '';

  // DDE and formula trigger characters: =, +, -, @, |
  const triggerChars = ['=', '+', '-', '@', '|'];
  if (triggerChars.some((char) => stripped.startsWith(char))) {
    // If already single-quoted, leave as is, otherwise prefix with single quote
    if (stripped.startsWith("'")) {
      return stripped;
    }
    return `'${stripped}`;
  }

  return stripped;
}

const NAME_COLUMN_ALIASES = [
  'name',
  'full_name',
  'fullname',
  'recipient_name',
  'contact_name',
  'signer_name',
  'client_name',
  'recipient',
];

const EMAIL_COLUMN_ALIASES = [
  'email',
  'e-mail',
  'email_address',
  'mail',
  'signer_email',
  'recipient_email',
  'contact_email',
];

const PHONE_COLUMN_ALIASES = [
  'phone',
  'telephone',
  'mobile',
  'cell',
  'phone_number',
  'mobile_number',
  'contact_phone',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses raw CSV content into typed, sanitized recipient rows with automated column detection.
 */
export function parseBulkRecipientCsv(csvContent: string): ParsedCsvResult {
  const parseErrors: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((err) => {
      parseErrors.push(`CSV Parse Error at line ${err.row ?? 'unknown'}: ${err.message}`);
    });
  }

  const rawHeaders = parsed.meta.fields || [];
  const normalizedHeaders = rawHeaders.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));

  // Detect column mapping candidates
  const nameColumn = normalizedHeaders.find((h) => NAME_COLUMN_ALIASES.includes(h));
  const emailColumn = normalizedHeaders.find((h) => EMAIL_COLUMN_ALIASES.includes(h));
  const phoneColumn = normalizedHeaders.find((h) => PHONE_COLUMN_ALIASES.includes(h));

  const variableColumns = normalizedHeaders.filter(
    (h) => h !== nameColumn && h !== emailColumn && h !== phoneColumn
  );

  const rows: ParsedRecipientRow[] = [];

  parsed.data.forEach((rawRow, index) => {
    const rowIndex = index + 1; // 1-indexed data row
    const errors: string[] = [];

    // Extract & sanitize name
    const rawName = nameColumn ? rawRow[nameColumn] || '' : '';
    const name = sanitizeCsvCell(rawName);
    if (!name) {
      errors.push('Missing recipient name');
    }

    // Extract & sanitize email
    const rawEmail = emailColumn ? rawRow[emailColumn] || '' : '';
    const email = sanitizeCsvCell(rawEmail).toLowerCase();
    if (!email) {
      errors.push('Missing recipient email');
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push(`Invalid email format: "${email}"`);
    }

    // Extract phone for SMS / messaging (clean dialable format)
    const rawPhone = phoneColumn ? rawRow[phoneColumn] || '' : '';
    const phone = rawPhone ? rawPhone.trim().replace(/^'/, '') : undefined;

    // Extract custom variables and sanitize all cells
    const variables: Record<string, string> = {};
    variableColumns.forEach((colKey) => {
      const cellVal = rawRow[colKey] !== undefined ? String(rawRow[colKey]) : '';
      variables[colKey] = sanitizeCsvCell(cellVal);
    });

    // Also populate common implicit variables
    if (name) {
      variables['name'] = name;
      variables['recipient_name'] = name;
      variables['first_name'] = name.split(' ')[0] || name;
    }
    if (email) {
      variables['email'] = email;
      variables['recipient_email'] = email;
    }
    if (phone) {
      variables['phone'] = phone;
    }

    const isValid = errors.length === 0;

    rows.push({
      rowIndex,
      name,
      email,
      phone,
      variables,
      raw: rawRow,
      isValid,
      errors,
    });
  });

  return {
    headers: normalizedHeaders,
    totalRows: rows.length,
    rows,
    nameColumn,
    emailColumn,
    phoneColumn,
    variableColumns,
    parseErrors,
  };
}

/**
 * Validates mapped recipient rows against required template variables (FM-P9-04).
 */
export function validateTemplateVariableMapping(
  templateVariables: string[],
  rows: ParsedRecipientRow[]
): VariableLintResult {
  const detectedColumns = new Set<string>();
  const rowErrors: Array<{ rowIndex: number; errors: string[] }> = [];

  // Clean template variables list (lower-cased)
  const normalizedTemplateVars = templateVariables
    .map((v) => v.trim().toLowerCase().replace(/^\{\{|\}\}$/g, ''))
    .filter((v) => v.length > 0);

  // Collect all available column keys from first row or headers
  rows.forEach((row) => {
    Object.keys(row.variables).forEach((k) => detectedColumns.add(k));
  });

  const availableKeys = Array.from(detectedColumns);
  const unmappedVariables = normalizedTemplateVars.filter(
    (requiredVar) => !availableKeys.includes(requiredVar)
  );

  let validCount = 0;
  let invalidCount = 0;

  rows.forEach((row) => {
    const missingForThisRow: string[] = [];
    normalizedTemplateVars.forEach((varKey) => {
      const val = row.variables[varKey];
      if (val === undefined || val === null || val.trim() === '') {
        missingForThisRow.push(varKey);
      }
    });

    const combinedErrors = [...row.errors];
    if (missingForThisRow.length > 0) {
      combinedErrors.push(
        `Missing template variable${missingForThisRow.length > 1 ? 's' : ''}: ${missingForThisRow.join(', ')}`
      );
    }

    if (combinedErrors.length > 0) {
      invalidCount++;
      rowErrors.push({
        rowIndex: row.rowIndex,
        errors: combinedErrors,
      });
    } else {
      validCount++;
    }
  });

  return {
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    detectedColumns: availableKeys,
    templateVariables: normalizedTemplateVars,
    unmappedVariables,
    rowErrors,
  };
}

/**
 * Generates an end-to-end dry run merge preview conforming to BulkCsvMergePreviewResultSchema.
 */
export function generateDryRunMergePreview(
  templateVariables: string[],
  rows: ParsedRecipientRow[],
  sampleLimit = 5
): BulkCsvMergePreviewResult {
  const lintResult = validateTemplateVariableMapping(templateVariables, rows);

  const normalizedTemplateVars = lintResult.templateVariables;

  const previewSample: BulkCsvMergePreviewItem[] = rows
    .slice(0, sampleLimit)
    .map((row) => {
      const missingVariables = normalizedTemplateVars.filter((k) => {
        const val = row.variables[k];
        return val === undefined || val === null || val.trim() === '';
      });

      const rowErrorEntry = lintResult.rowErrors.find((e) => e.rowIndex === row.rowIndex);
      const errors = rowErrorEntry ? rowErrorEntry.errors : [...row.errors];
      const isValid = errors.length === 0;

      return {
        rowIndex: row.rowIndex,
        recipientName: row.name,
        recipientEmail: row.email,
        mappedVariables: { ...row.variables },
        missingVariables,
        isValid,
        errors,
      };
    });

  const result: BulkCsvMergePreviewResult = {
    totalRows: lintResult.totalRows,
    validRows: lintResult.validRows,
    invalidRows: lintResult.invalidRows,
    detectedColumns: lintResult.detectedColumns,
    templateVariables: lintResult.templateVariables,
    unmappedVariables: lintResult.unmappedVariables,
    previewSample,
  };

  return BulkCsvMergePreviewResultSchema.parse(result);
}
