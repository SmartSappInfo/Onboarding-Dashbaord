import { describe, it, expect } from 'vitest';
import { isSafeRedirectUrl } from '@/lib/survey-redirect-safety';

/**
 * Audit F5: survey redirectUrl is authored copy that passes through variable
 * substitution, so respondent answers can reach it before it is used as a
 * navigation target.
 */
describe('isSafeRedirectUrl', () => {
  describe('accepts legitimate targets', () => {
    it.each([
      'https://example.com',
      'https://example.com/thanks?ref=survey',
      'http://localhost:3000/done',
      '/thank-you',
      '/surveys/abc/result',
    ])('accepts %s', (url) => {
      expect(isSafeRedirectUrl(url)).toBe(true);
    });
  });

  describe('rejects dangerous schemes', () => {
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ])('rejects %s', (url) => {
      expect(isSafeRedirectUrl(url)).toBe(false);
    });
  });

  it('rejects protocol-relative URLs that silently leave the site', () => {
    expect(isSafeRedirectUrl('//evil.test/phish')).toBe(false);
  });

  it('rejects empty and unparseable input', () => {
    expect(isSafeRedirectUrl('')).toBe(false);
    expect(isSafeRedirectUrl('   ')).toBe(false);
    expect(isSafeRedirectUrl(undefined)).toBe(false);
    expect(isSafeRedirectUrl(null)).toBe(false);
    expect(isSafeRedirectUrl('not a url at all')).toBe(false);
  });

  it('ignores surrounding whitespace before validating', () => {
    expect(isSafeRedirectUrl('  https://example.com  ')).toBe(true);
    expect(isSafeRedirectUrl('  javascript:alert(1)  ')).toBe(false);
  });

  describe('with a host allowlist', () => {
    const allowed = ['example.com', 'smartsapp.com'];

    it('accepts an exact host match', () => {
      expect(isSafeRedirectUrl('https://example.com/x', allowed)).toBe(true);
    });

    it('accepts a subdomain of an allowed host', () => {
      expect(isSafeRedirectUrl('https://go.smartsapp.com/x', allowed)).toBe(true);
    });

    it('rejects a host outside the allowlist', () => {
      expect(isSafeRedirectUrl('https://evil.test/x', allowed)).toBe(false);
    });

    it('rejects a lookalike host that merely ends with the allowed string', () => {
      expect(isSafeRedirectUrl('https://notexample.com/x', allowed)).toBe(false);
    });

    it('still accepts site-relative paths', () => {
      expect(isSafeRedirectUrl('/thanks', allowed)).toBe(true);
    });
  });
});
