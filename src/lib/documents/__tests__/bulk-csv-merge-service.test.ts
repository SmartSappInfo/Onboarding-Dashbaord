/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test Suite for Bulk CSV Merge & Sanitization Service (Phase 9):
 * 1. Purpose:
 *    Guarantees robust CSV parsing, DDE formula injection sanitization,
 *    and pre-flight dry-run variable linting.
 * 2. Security Defense (FM-P9-07):
 *    Verifies malicious spreadsheet cells (=cmd, +SUM, @formula) are neutralized.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeCsvCell,
  parseBulkRecipientCsv,
  validateTemplateVariableMapping,
  generateDryRunMergePreview,
} from '../bulk-csv-merge-service';

describe('Bulk CSV Merge & Sanitization Service', () => {
  describe('sanitizeCsvCell (FM-P9-07 DDE Defense)', () => {
    it('leaves standard text unchanged', () => {
      expect(sanitizeCsvCell('John Doe')).toBe('John Doe');
      expect(sanitizeCsvCell('Acme Corp 2026')).toBe('Acme Corp 2026');
      expect(sanitizeCsvCell('user@domain.com')).toBe('user@domain.com');
    });

    it('neutralizes malicious formula injection characters', () => {
      expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe('\'=cmd|"/C calc"!A0');
      expect(sanitizeCsvCell('+1+2')).toBe('\'+1+2');
      expect(sanitizeCsvCell('-1000')).toBe('\'-1000');
      expect(sanitizeCsvCell('@SUM(1,2)')).toBe('\'@SUM(1,2)');
      expect(sanitizeCsvCell('|cmd|calc')).toBe('\'|cmd|calc');
      // Strips leading control characters and escapes if followed by formula
      expect(sanitizeCsvCell('\t=calc')).toBe('\'=calc');
      expect(sanitizeCsvCell('\tregular_text')).toBe('regular_text');
    });

    it('does not double-prefix if already single-quoted', () => {
      expect(sanitizeCsvCell("'=cmd|calc")).toBe("'=cmd|calc");
    });

    it('handles empty or whitespace strings', () => {
      expect(sanitizeCsvCell('')).toBe('');
      expect(sanitizeCsvCell('   ')).toBe('');
    });
  });

  describe('parseBulkRecipientCsv', () => {
    it('parses standard enterprise roster CSV with header detection', () => {
      const csv = `Full Name,Email Address,Phone Number,Job Title,Base Salary
Jane Smith,jane.smith@enterprise.com,+1234567890,Senior Engineer,"$180,000"
Bob Jones,bob.jones@enterprise.com,,Engineering Manager,"$210,000"`;

      const result = parseBulkRecipientCsv(csv);

      expect(result.totalRows).toBe(2);
      expect(result.nameColumn).toBe('full_name');
      expect(result.emailColumn).toBe('email_address');
      expect(result.phoneColumn).toBe('phone_number');
      expect(result.variableColumns).toContain('job_title');
      expect(result.variableColumns).toContain('base_salary');

      const firstRow = result.rows[0];
      expect(firstRow.name).toBe('Jane Smith');
      expect(firstRow.email).toBe('jane.smith@enterprise.com');
      expect(firstRow.phone).toBe('+1234567890');
      expect(firstRow.variables['job_title']).toBe('Senior Engineer');
      expect(firstRow.variables['base_salary']).toBe('$180,000');
      expect(firstRow.isValid).toBe(true);
      expect(firstRow.errors.length).toBe(0);

      const secondRow = result.rows[1];
      expect(secondRow.phone).toBeUndefined();
      expect(secondRow.isValid).toBe(true);
    });

    it('sanitizes formula injection across all parsed cells', () => {
      const csv = `Name,Email,Department,Payload
=Hacker,hacker@evil.com,@Security,"+SUM(1,2)"`;

      const result = parseBulkRecipientCsv(csv);
      const row = result.rows[0];

      expect(row.name).toBe("'=Hacker");
      expect(row.variables['department']).toBe("'@Security");
      expect(row.variables['payload']).toBe("'+SUM(1,2)");
    });

    it('identifies rows with invalid email or missing name', () => {
      const csv = `Name,Email
,missing.name@test.com
Valid Name,not-an-email`;

      const result = parseBulkRecipientCsv(csv);
      expect(result.rows[0].isValid).toBe(false);
      expect(result.rows[0].errors).toContain('Missing recipient name');

      expect(result.rows[1].isValid).toBe(false);
      expect(result.rows[1].errors.some((e) => e.includes('Invalid email format'))).toBe(true);
    });
  });

  describe('validateTemplateVariableMapping & Dry-Run Preview (FM-P9-04)', () => {
    it('validates matching variables and flags missing fields on a per-row basis', () => {
      const csv = `Name,Email,department,start_date
Alice,alice@corp.com,Engineering,2026-10-01
Bob,bob@corp.com,,2026-10-05`;

      const parsed = parseBulkRecipientCsv(csv);
      const templateVars = ['department', 'start_date', 'severance_clause'];

      const lint = validateTemplateVariableMapping(templateVars, parsed.rows);

      expect(lint.totalRows).toBe(2);
      expect(lint.unmappedVariables).toContain('severance_clause');
      expect(lint.validRows).toBe(0); // Both rows miss severance_clause; Bob also misses department
      expect(lint.invalidRows).toBe(2);

      const bobErrors = lint.rowErrors.find((e) => e.rowIndex === 2);
      expect(bobErrors).toBeDefined();
      expect(bobErrors?.errors.some((e) => e.includes('department'))).toBe(true);
      expect(bobErrors?.errors.some((e) => e.includes('severance_clause'))).toBe(true);
    });

    it('generates schema-compliant dry run preview sample', () => {
      const csv = `Name,Email,role,stipend
Carol Danvers,carol@avengers.org,Captain,$10,000
Peter Parker,peter@avengers.org,Intern,`;

      const parsed = parseBulkRecipientCsv(csv);
      const preview = generateDryRunMergePreview(['role', 'stipend'], parsed.rows, 5);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows).toBe(1);
      expect(preview.invalidRows).toBe(1);
      expect(preview.previewSample.length).toBe(2);

      const carolPreview = preview.previewSample[0];
      expect(carolPreview.isValid).toBe(true);
      expect(carolPreview.mappedVariables['role']).toBe('Captain');
      expect(carolPreview.missingVariables.length).toBe(0);

      const peterPreview = preview.previewSample[1];
      expect(peterPreview.isValid).toBe(false);
      expect(peterPreview.missingVariables).toContain('stipend');
      expect(peterPreview.errors.length).toBeGreaterThan(0);
    });
  });
});
