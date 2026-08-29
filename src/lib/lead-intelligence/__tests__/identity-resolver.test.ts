import { describe, it, expect } from 'vitest';
import { 
  canonicalizeDomain, 
  isSafeExternalDomain, 
  normalizeBusinessName, 
  calculateStringSimilarity, 
  evaluateIdentityMatch 
} from '../identity-resolver';

describe('identity-resolver', () => {
  describe('canonicalizeDomain', () => {
    it('canonicalizes complex URLs to bare hostnames', () => {
      expect(canonicalizeDomain('https://www.school.edu.gh/admissions?ref=google')).toBe('school.edu.gh');
      expect(canonicalizeDomain('http://mysite.com/path#anchor')).toBe('mysite.com');
      expect(canonicalizeDomain('www.example.org')).toBe('example.org');
      expect(canonicalizeDomain('  HTTP://WWW.TEST.COM/  ')).toBe('test.com');
      expect(canonicalizeDomain('localhost:3000/api')).toBe('localhost');
    });

    it('returns empty string for empty input', () => {
      expect(canonicalizeDomain('')).toBe('');
    });
  });

  describe('isSafeExternalDomain (SSRF Protection)', () => {
    it('blocks loopback and private IPv4 ranges', () => {
      expect(isSafeExternalDomain('localhost')).toBe(false);
      expect(isSafeExternalDomain('http://127.0.0.1:8080')).toBe(false);
      expect(isSafeExternalDomain('169.254.169.254')).toBe(false);
      expect(isSafeExternalDomain('10.0.0.1')).toBe(false);
      expect(isSafeExternalDomain('192.168.1.100')).toBe(false);
      expect(isSafeExternalDomain('172.16.0.5')).toBe(false);
    });

    it('allows valid external public domains', () => {
      expect(isSafeExternalDomain('https://school.edu.gh')).toBe(true);
      expect(isSafeExternalDomain('https://example.com')).toBe(true);
      expect(isSafeExternalDomain('https://smart-app.io/about')).toBe(true);
    });
  });

  describe('normalizeBusinessName', () => {
    it('strips legal suffixes and excess spaces', () => {
      expect(normalizeBusinessName('Acme International Ltd.')).toBe('acme');
      expect(normalizeBusinessName('Osei Tutu Academy LLC')).toBe('osei tutu academy');
      expect(normalizeBusinessName('Ghana Health Services PLC')).toBe('health');
    });
  });

  describe('calculateStringSimilarity', () => {
    it('computes high similarity for identical and minor variations', () => {
      const score = calculateStringSimilarity('Osei Tutu Academy Ltd', 'Osei Tutu Academy');
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('computes low similarity for completely different names', () => {
      const score = calculateStringSimilarity('Kumasi International School', 'Accra Tech Hub');
      expect(score).toBeLessThan(0.4);
    });
  });

  describe('evaluateIdentityMatch', () => {
    it('matches on exact domain match with high confidence', () => {
      const result = evaluateIdentityMatch(
        { name: 'New School', domain: 'newschool.edu.gh' },
        { displayName: 'Old School Name', slug: 'newschool.edu.gh' }
      );
      expect(result.isMatch).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('matches on matching normalized phone number', () => {
      const result = evaluateIdentityMatch(
        { name: 'Different Name', domain: 'different.com', phone: '+233 24 123 4567' },
        { displayName: 'Another Name', primaryPhone: '0241234567' }
      );
      // Normalized matching compares digits
      expect(result.isMatch).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    it('matches on high fuzzy name similarity', () => {
      const result = evaluateIdentityMatch(
        { name: 'Kumasi Premier Academy Ltd', domain: 'unknown1.com' },
        { displayName: 'Kumasi Premier Academy', slug: 'unknown2.com' }
      );
      expect(result.isMatch).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });
});
