import { describe, it, expect } from 'vitest';
import { parseVariables } from '../MappableInputField';

/**
 * ARCHITECTURAL VERIFICATION SUITE: Rule 10 Alignment
 * Verifies that parseVariables correctly partitions multi-line text with inline variable tokens,
 * preserving newlines, indents, colons, and fallbacks for natural inline text flow.
 */
describe('MappableInputField - parseVariables Token Geometry', () => {
  it('correctly partitions a multi-line message containing multiple variables', () => {
    const input =
      'We have a new lead from SmartSapp Website: {{name}}\n' +
      'Name: {{school_name}}\n' +
      'Organization: {{organization}}\n' +
      'Phone: {{phone_number}}\n' +
      'Email: {{email}}';

    const parts = parseVariables(input);

    // Verify correct sequence of text and variable tokens
    expect(parts.length).toBe(10);

    expect(parts[0]).toEqual({
      type: 'text',
      value: 'We have a new lead from SmartSapp Website: ',
      raw: 'We have a new lead from SmartSapp Website: ',
    });

    expect(parts[1]).toEqual({
      type: 'variable',
      value: 'name',
      fallback: undefined,
      raw: '{{name}}',
    });

    expect(parts[2]).toEqual({
      type: 'text',
      value: '\nName: ',
      raw: '\nName: ',
    });

    expect(parts[3]).toEqual({
      type: 'variable',
      value: 'school_name',
      fallback: undefined,
      raw: '{{school_name}}',
    });

    expect(parts[4]).toEqual({
      type: 'text',
      value: '\nOrganization: ',
      raw: '\nOrganization: ',
    });

    expect(parts[5]).toEqual({
      type: 'variable',
      value: 'organization',
      fallback: undefined,
      raw: '{{organization}}',
    });

    expect(parts[6]).toEqual({
      type: 'text',
      value: '\nPhone: ',
      raw: '\nPhone: ',
    });

    expect(parts[7]).toEqual({
      type: 'variable',
      value: 'phone_number',
      fallback: undefined,
      raw: '{{phone_number}}',
    });

    expect(parts[8]).toEqual({
      type: 'text',
      value: '\nEmail: ',
      raw: '\nEmail: ',
    });

    expect(parts[9]).toEqual({
      type: 'variable',
      value: 'email',
      fallback: undefined,
      raw: '{{email}}',
    });
  });

  it('correctly parses variable tokens with fallback values (pipe and double-pipe syntax)', () => {
    const input = 'Hello {{contact.name | Valued Customer}}, your code is {{otp_code || 000000}}!';
    const parts = parseVariables(input);

    expect(parts.length).toBe(5);

    expect(parts[1]).toEqual({
      type: 'variable',
      value: 'contact.name',
      fallback: 'Valued Customer',
      raw: '{{contact.name | Valued Customer}}',
    });

    expect(parts[3]).toEqual({
      type: 'variable',
      value: 'otp_code',
      fallback: '000000',
      raw: '{{otp_code || 000000}}',
    });
  });

  it('preserves leading and trailing newlines and whitespace', () => {
    const input = '\n\nImportant Alert:\n{{alert_message}}\n\nThank you.\n';
    const parts = parseVariables(input);

    expect(parts[0].value).toBe('\n\nImportant Alert:\n');
    expect(parts[1].value).toBe('alert_message');
    expect(parts[2].value).toBe('\n\nThank you.\n');
  });

  it('handles strings without any variables cleanly', () => {
    const input = 'Plain message without any tokens.';
    const parts = parseVariables(input);

    expect(parts.length).toBe(1);
    expect(parts[0]).toEqual({
      type: 'text',
      value: input,
      raw: input,
    });
  });
});
