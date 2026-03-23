import { describe, it, expect } from 'vitest';
import { formatBytes, toTitleCase, resolveVariableValue } from '../utils';

describe('formatBytes', () => {
  it('formats 0 bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('formats KB correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats MB correctly', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});

describe('toTitleCase', () => {
  it('converts single word to title case', () => {
    expect(toTitleCase('HELLO')).toBe('Hello');
  });

  it('converts multiple words correctly', () => {
    expect(toTitleCase('ghana international school')).toBe('Ghana International School');
  });

  it('handles empty input gracefully', () => {
    expect(toTitleCase('')).toBe('');
  });
});

describe('resolveVariableValue', () => {
  const mockSchool = {
    id: 'school_123',
    name: 'SmartSapp Academy',
    initials: 'SSA',
    location: 'Accra',
    currency: 'USD',
    subscriptionRate: 50,
    nominalRoll: 100,
    focalPersons: [
      {
        name: 'John Signatory',
        email: 'john@smartsapp.com',
        phone: '0240000000',
        type: 'Director',
        isSignatory: true
      }
    ]
  };

  it('resolves core institutional data', () => {
    expect(resolveVariableValue('school_name', mockSchool)).toBe('SmartSapp Academy');
    expect(resolveVariableValue('school_initials', mockSchool)).toBe('SSA');
  });

  it('resolves signatory context correctly', () => {
    expect(resolveVariableValue('contact_name', mockSchool)).toBe('John Signatory');
    expect(resolveVariableValue('contact_email', mockSchool)).toBe('john@smartsapp.com');
  });

  it('resolves financial logic correctly', () => {
    expect(resolveVariableValue('subscription_total', mockSchool)).toBe('USD 5,000');
  });

  it('returns null for unknown keys', () => {
    expect(resolveVariableValue('invalid_key', mockSchool)).toBeNull();
  });

  it('returns null if school is missing', () => {
    expect(resolveVariableValue('school_name')).toBeNull();
  });
});
