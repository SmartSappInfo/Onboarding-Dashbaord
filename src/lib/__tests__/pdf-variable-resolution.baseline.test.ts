/**
 * PURPOSE: Baseline unit tests for PDF template variable resolution and field validation.
 * ARCHITECTURAL CONTEXT: Locks in the Single Source of Truth resolution hierarchy for dynamic
 * CRM tokens (entity, campus, signatory, financials) and form validation schema creation.
 * TESTABILITY: Runs in Vitest jsdom environment. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect } from 'vitest';
import { resolveVariableValue } from '../utils';
import type { PDFFormField } from '../types';
import { generateValidationSchema } from '../documents/form-validation';

describe('P0.3 Baseline: PDF Variable Resolution & Schema Contract', () => {
  const mockSchool = {
    id: 'school_123',
    name: 'St. Andrew Senior High',
    initials: 'SASH',
    location: 'Kumasi Campus',
    phone: '+233201234567',
    email: 'admin@standrew.edu',
    subscriptionPackageName: 'Enterprise Growth',
    currency: 'USD',
    subscriptionRate: 15,
    nominalRoll: 800,
    arrearsBalance: 0,
    entityContacts: [
      { name: 'Dr. John Mensah', email: 'jmensah@standrew.edu', phone: '+233244111222', type: 'Principal', isSignatory: true },
      { name: 'Mary Osei', email: 'mosei@standrew.edu', phone: '+233244333444', type: 'Accountant', isSignatory: false },
    ],
  };

  it('resolves core entity profile tokens', () => {
    expect(resolveVariableValue('entity_name', mockSchool)).toBe('St. Andrew Senior High');
    expect(resolveVariableValue('entity_initials', mockSchool)).toBe('SASH');
    expect(resolveVariableValue('entity_location', mockSchool)).toBe('Kumasi Campus');
    expect(resolveVariableValue('entity_phone', mockSchool)).toBe('+233201234567');
    expect(resolveVariableValue('entity_email', mockSchool)).toBe('admin@standrew.edu');
    expect(resolveVariableValue('entity_package', mockSchool)).toBe('Enterprise Growth');
  });

  it('resolves signatory contact variables from entityContacts list', () => {
    expect(resolveVariableValue('contact_name', mockSchool)).toBe('Dr. John Mensah');
    expect(resolveVariableValue('contact_email', mockSchool)).toBe('jmensah@standrew.edu');
    expect(resolveVariableValue('contact_phone', mockSchool)).toBe('+233244111222');
    expect(resolveVariableValue('contact_position', mockSchool)).toBe('Principal');
  });

  it('resolves computed financial variables with currency formatting', () => {
    expect(resolveVariableValue('subscription_rate', mockSchool)).toBe('USD 15');
    expect(resolveVariableValue('nominal_roll', mockSchool)).toBe('800');
    expect(resolveVariableValue('subscription_total', mockSchool)).toBe('USD 12,000');
    expect(resolveVariableValue('arrears_balance', mockSchool)).toBe('USD 0');
  });

  it('returns null for unknown variable tokens or empty entity context', () => {
    expect(resolveVariableValue('non_existent_key', mockSchool)).toBeNull();
    expect(resolveVariableValue('entity_name', null)).toBeNull();
    expect(resolveVariableValue('entity_name', undefined)).toBeNull();
  });

  it('generates accurate Zod validation schema for form field types', () => {
    const fields: PDFFormField[] = [
      {
        id: 'f_name',
        label: 'Full Name',
        type: 'text',
        position: { x: 10, y: 10 },
        dimensions: { width: 40, height: 5 },
        pageNumber: 1,
        required: true,
      },
      {
        id: 'f_email',
        label: 'Official Email',
        type: 'email',
        position: { x: 10, y: 20 },
        dimensions: { width: 40, height: 5 },
        pageNumber: 1,
        required: true,
      },
      {
        id: 'f_phone_opt',
        label: 'Secondary Phone',
        type: 'phone',
        position: { x: 10, y: 30 },
        dimensions: { width: 40, height: 5 },
        pageNumber: 1,
        required: false,
      },
      {
        id: 'f_static_notice',
        label: 'Legal Notice',
        type: 'static-text',
        staticText: 'This agreement is binding.',
        position: { x: 10, y: 40 },
        dimensions: { width: 80, height: 5 },
        pageNumber: 1,
      },
      {
        id: 'f_var_campus',
        label: 'Campus Name',
        type: 'variable',
        variableKey: 'entity_location',
        position: { x: 10, y: 50 },
        dimensions: { width: 40, height: 5 },
        pageNumber: 1,
      },
    ];

    const schema = generateValidationSchema(fields);

    // Static text and variable fields are excluded from user input schema
    const validData = {
      f_name: 'Dr. John Mensah',
      f_email: 'jmensah@standrew.edu',
      f_phone_opt: '+233244111222',
    };

    const parsed = schema.safeParse(validData);
    expect(parsed.success).toBe(true);

    // Missing required field fails validation
    const invalidData = {
      f_name: '',
      f_email: 'invalid-email-address',
    };
    const failedParse = schema.safeParse(invalidData);
    expect(failedParse.success).toBe(false);
  });
});
