import { describe, it, expect } from 'vitest';
import { sanitizeScientificNotation, normalizePhoneNumber } from '../phone-utils';

describe('phone-utils', () => {
  describe('sanitizeScientificNotation', () => {
    it('should parse scientific notation integers', () => {
      expect(sanitizeScientificNotation('2.33276E+11')).toBe('233276000000');
      expect(sanitizeScientificNotation(2.33276e11)).toBe('233276000000');
    });

    it('should pass through normal numbers and strings', () => {
      expect(sanitizeScientificNotation('233559040002')).toBe('233559040002');
      expect(sanitizeScientificNotation(233559040002)).toBe('233559040002');
      expect(sanitizeScientificNotation('0559040002')).toBe('0559040002');
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should format normal local Ghana numbers by stripping leading 0 and prepending 233', () => {
      expect(normalizePhoneNumber('0559040002', 'GH').e164).toBe('+233559040002');
      expect(normalizePhoneNumber('559040002', 'GH').e164).toBe('+233559040002');
    });

    it('should handle already-prefixed Ghana numbers', () => {
      expect(normalizePhoneNumber('233559040002', 'GH').e164).toBe('+233559040002');
      expect(normalizePhoneNumber('+233559040002', 'GH').e164).toBe('+233559040002');
      expect(normalizePhoneNumber('00233559040002', 'GH').e164).toBe('+233559040002');
    });

    it('should handle US/CA numbers', () => {
      expect(normalizePhoneNumber('4155552671', 'US').e164).toBe('+14155552671');
      expect(normalizePhoneNumber('14155552671', 'US').e164).toBe('+14155552671');
      expect(normalizePhoneNumber('+14155552671', 'US').e164).toBe('+14155552671');
      expect(normalizePhoneNumber('0014155552671', 'US').e164).toBe('+14155552671');
    });

    it('should handle scientific notation parsed from files', () => {
      expect(normalizePhoneNumber('2.33276E+11', 'GH').e164).toBe('+233276000000');
    });

    it('should strip spaces and special characters', () => {
      expect(normalizePhoneNumber(' 055-904-0002 ', 'GH').e164).toBe('+233559040002');
      expect(normalizePhoneNumber('+233 (55) 904 0002', 'GH').e164).toBe('+233559040002');
    });

    it('does NOT coerce local numbers to Ghana when no default country is provided', () => {
      // When no country context is given for a domestic number (starts with 0),
      // it should NOT assume Ghana.
      const result = normalizePhoneNumber('0244123456');
      expect(result.countryCode).not.toBe('GH');
    });

    it('correctly uses dynamic calling codes for any country (e.g. Germany 49, South Africa 27)', () => {
      const deResult = normalizePhoneNumber('015112345678', 'DE');
      expect(deResult.isValid).toBe(true);
      expect(deResult.e164).toBe('+4915112345678');
      expect(deResult.callingCode).toBe('49');

      const zaResult = normalizePhoneNumber('0825550199', 'ZA');
      expect(zaResult.isValid).toBe(true);
      expect(zaResult.e164).toBe('+27825550199');
      expect(zaResult.callingCode).toBe('27');
    });

    it('normalizes bare international numbers without needing default country', () => {
      const result = normalizePhoneNumber('233242737120');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+233242737120');
      expect(result.countryCode).toBe('GH');
    });
  });
});

