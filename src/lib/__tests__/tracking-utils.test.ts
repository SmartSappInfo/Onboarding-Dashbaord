import { describe, it, expect } from 'vitest';
import {
  normalizeSuccessBehavior,
  sanitizeRedirectUrl,
  extractTrackingParams,
  appendTrackingParams,
} from '../tracking-utils';

describe('Tracking & Redirection Utilities', () => {
  describe('normalizeSuccessBehavior', () => {
    it('should return default values when called with undefined', () => {
      const result = normalizeSuccessBehavior(undefined);
      expect(result.thankYouTitle).toBe('Thank You!');
      expect(result.thankYouMessage).toContain('Thanks for sharing your contact details');
      expect(result.redirectMode).toBe('none');
      expect(result.presentation).toBe('modal');
      expect(result.redirectDelaySeconds).toBe(5);
      expect(result.redirectButtonText).toBe('Continue');
      expect(result.preserveTrackingParams).toBe(true);
    });

    it('should normalize legacy type "message"', () => {
      const result = normalizeSuccessBehavior({
        type: 'message',
        value: 'Legacy thank you note',
      });
      expect(result.redirectMode).toBe('none');
      expect(result.thankYouMessage).toBe('Legacy thank you note');
    });

    it('should normalize legacy type "redirect"', () => {
      const result = normalizeSuccessBehavior({
        type: 'redirect',
        value: 'https://example.com/legacy-thank-you',
      });
      expect(result.redirectMode).toBe('immediate');
      expect(result.redirectUrl).toBe('https://example.com/legacy-thank-you');
    });

    it('should preserve custom delay and button text settings', () => {
      const result = normalizeSuccessBehavior({
        redirectMode: 'delay',
        redirectUrl: 'https://example.com/target',
        redirectDelaySeconds: 10,
        redirectButtonText: 'Go to Site',
        thankYouTitle: 'Success!',
        thankYouMessage: 'Done!',
        presentation: 'page',
      });
      expect(result.redirectMode).toBe('delay');
      expect(result.redirectDelaySeconds).toBe(10);
      expect(result.redirectButtonText).toBe('Go to Site');
      expect(result.thankYouTitle).toBe('Success!');
      expect(result.presentation).toBe('page');
    });
  });

  describe('sanitizeRedirectUrl', () => {
    it('should allow valid absolute http and https URLs', () => {
      expect(sanitizeRedirectUrl('https://example.com/page')).toBe('https://example.com/page');
      expect(sanitizeRedirectUrl('http://example.com/page')).toBe('http://example.com/page');
    });

    it('should allow relative paths starting with a single slash', () => {
      expect(sanitizeRedirectUrl('/surveys/123')).toBe('/surveys/123');
      expect(sanitizeRedirectUrl('/p/f/my-form')).toBe('/p/f/my-form');
    });

    it('should reject protocol relative URLs starting with double slash', () => {
      expect(sanitizeRedirectUrl('//malicious.com')).toBe('');
    });

    it('should reject javascript: and data: URLs', () => {
      expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('should return empty string for invalid URLs', () => {
      expect(sanitizeRedirectUrl('not a url')).toBe('');
      expect(sanitizeRedirectUrl('')).toBe('');
    });
  });

  describe('extractTrackingParams', () => {
    it('should extract valid tracking parameters from search string', () => {
      const search = '?utm_source=google&utm_campaign=summer_sale&ref=partner123&other=ignored';
      const params = extractTrackingParams(search);
      expect(params.utm_source).toBe('google');
      expect(params.utm_campaign).toBe('summer_sale');
      expect(params.ref).toBe('partner123');
      expect(params.other).toBeUndefined();
    });
  });

  describe('appendTrackingParams', () => {
    it('should append tracking parameters to a relative URL', () => {
      const target = '/thank-you';
      const tracking = { utm_source: 'newsletter', ref: 'email' };
      const result = appendTrackingParams(target, tracking);
      expect(result).toBe('/thank-you?utm_source=newsletter&ref=email');
    });

    it('should append tracking parameters to an absolute URL', () => {
      const target = 'https://example.com/welcome';
      const tracking = { utm_source: 'facebook', utm_medium: 'cpc' };
      const result = appendTrackingParams(target, tracking);
      expect(result).toBe('https://example.com/welcome?utm_source=facebook&utm_medium=cpc');
    });

    it('should preserve existing query parameters on target URL without overwriting', () => {
      const target = 'https://example.com/welcome?utm_source=original&id=42';
      const tracking = { utm_source: 'new', utm_medium: 'cpc' };
      const result = appendTrackingParams(target, tracking);
      expect(result).toBe('https://example.com/welcome?utm_source=original&id=42&utm_medium=cpc');
    });
  });
});
