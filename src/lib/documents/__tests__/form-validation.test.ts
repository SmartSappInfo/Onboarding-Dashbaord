/**
 * PURPOSE: Unit tests for Form Validation Schema Generator (SSOT).
 * ARCHITECTURAL CONTEXT: Verifies that form fields map to runtime Zod schemas across
 * mandatory/optional text fields, email format enforcement, phone length minimums,
 * and exclusion of static/variable display fields.
 * TESTABILITY: Runs in Vitest. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect } from 'vitest';
import { generateValidationSchema } from '../form-validation';
import type { PDFFormField } from '@/lib/types';

describe('P1.1 Form Validation Schema Generator (SSOT)', () => {
  it('generates a schema requiring mandatory text fields and validating email and phone formats', () => {
    const fields: PDFFormField[] = [
      { id: 'full_name', type: 'text', label: 'Full Name', required: true, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'signer_email', type: 'email', label: 'Signer Email', required: true, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'signer_phone', type: 'phone', label: 'Signer Phone', required: false, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'optional_notes', type: 'text', label: 'Notes', required: false, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'static_notice', type: 'static-text', label: 'Notice', required: false, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'var_company', type: 'variable', label: 'Company', required: false, page: 1, x: 0, y: 0, width: 100, height: 20 },
    ];

    const schema = generateValidationSchema(fields);

    // 1. Valid data passing all validations
    const validResult = schema.safeParse({
      full_name: 'Jane Doe',
      signer_email: 'jane@example.com',
      signer_phone: '1234567890',
      optional_notes: '',
    });
    expect(validResult.success).toBe(true);

    // 2. Invalid email format
    const invalidEmailResult = schema.safeParse({
      full_name: 'Jane Doe',
      signer_email: 'not-an-email',
      signer_phone: '1234567890',
    });
    expect(invalidEmailResult.success).toBe(false);

    // 3. Phone too short when provided
    const shortPhoneResult = schema.safeParse({
      full_name: 'Jane Doe',
      signer_email: 'jane@example.com',
      signer_phone: '123',
    });
    expect(shortPhoneResult.success).toBe(false);

    // 4. Missing mandatory full_name
    const missingNameResult = schema.safeParse({
      full_name: '',
      signer_email: 'jane@example.com',
    });
    expect(missingNameResult.success).toBe(false);

    // 5. Static text and variable fields must not be required in the schema
    const dataWithoutStatic = {
      full_name: 'Jane Doe',
      signer_email: 'jane@example.com',
    };
    expect(schema.safeParse(dataWithoutStatic).success).toBe(true);
  });

  it('handles empty field arrays gracefully', () => {
    const schema = generateValidationSchema([]);
    expect(schema.safeParse({}).success).toBe(true);
  });
});
