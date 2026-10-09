// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeQueryString,
  sanitizeSearchParams,
  hasSensitiveParams,
  isSensitiveParamKey,
  scrubBrowserUrlInPlace,
} from '../url-sanitizer';

describe('url-sanitizer utility', () => {
  it('correctly identifies sensitive parameter keys regardless of casing, snake_case, or kebab-case', () => {
    expect(isSensitiveParamKey('password')).toBe(true);
    expect(isSensitiveParamKey('PASSWORD')).toBe(true);
    expect(isSensitiveParamKey('tempPassword')).toBe(true);
    expect(isSensitiveParamKey('temp_password')).toBe(true);
    expect(isSensitiveParamKey('temp-password')).toBe(true);
    expect(isSensitiveParamKey('current_password')).toBe(true);
    expect(isSensitiveParamKey('current-password')).toBe(true);
    expect(isSensitiveParamKey('confirm_password')).toBe(true);
    expect(isSensitiveParamKey('confirm-password')).toBe(true);
    expect(isSensitiveParamKey('secret')).toBe(true);
    expect(isSensitiveParamKey('client_secret')).toBe(true);
    expect(isSensitiveParamKey('client-secret')).toBe(true);
    expect(isSensitiveParamKey('auth_token')).toBe(true);
    expect(isSensitiveParamKey('auth-token')).toBe(true);
    expect(isSensitiveParamKey('access_token')).toBe(true);
    expect(isSensitiveParamKey('credentials')).toBe(true);

    // Legitimate tokens that must not be stripped
    expect(isSensitiveParamKey('redirect')).toBe(false);
    expect(isSensitiveParamKey('invite')).toBe(false);
    expect(isSensitiveParamKey('email')).toBe(false);
    expect(isSensitiveParamKey('oobCode')).toBe(false);
  });

  it('correctly detects sensitive parameters in query string and URLSearchParams', () => {
    expect(hasSensitiveParams('?email=test@example.com&password=secret')).toBe(true);
    expect(hasSensitiveParams('?password=secret')).toBe(true);
    expect(hasSensitiveParams('?token=abc&tempPassword=123')).toBe(true);
    expect(hasSensitiveParams('?current-password=oldPass123')).toBe(true);
    expect(hasSensitiveParams(new URLSearchParams('password=secret'))).toBe(true);
    expect(hasSensitiveParams('?email=test@example.com&redirect=/admin')).toBe(false);
    expect(hasSensitiveParams(new URLSearchParams('email=test@example.com&redirect=/admin'))).toBe(false);
    expect(hasSensitiveParams('')).toBe(false);
  });

  it('removes sensitive parameters while preserving legitimate ones with sanitizeQueryString', () => {
    const cleaned = sanitizeQueryString('?email=test@example.com&password=secret&redirect=/admin');
    expect(cleaned).toBe('?email=test%40example.com&redirect=%2Fadmin');
  });

  it('returns empty string if only sensitive parameters were present', () => {
    const cleaned = sanitizeQueryString('?password=secret&tempPassword=123');
    expect(cleaned).toBe('');
  });

  it('sanitizes URLSearchParams instance cleanly', () => {
    const params = new URLSearchParams('email=test@example.com&password=secret&redirect=/admin');
    const sanitized = sanitizeSearchParams(params);
    expect(sanitized.has('password')).toBe(false);
    expect(sanitized.get('email')).toBe('test@example.com');
    expect(sanitized.get('redirect')).toBe('/admin');
  });

  describe('scrubBrowserUrlInPlace (DOM URL rewriting)', () => {
    const originalLocation = window.location;
    let replaceStateSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    });

    afterEach(() => {
      replaceStateSpy.mockRestore();
    });

    it('scrubs sensitive query parameters in-place via replaceState', () => {
      // Mock window.location.search and pathname
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          pathname: '/login',
          search: '?email=admin%40smartsapp.com&password=LeakedPass123&redirect=/backoffice',
          hash: '',
        },
      });

      const scrubbed = scrubBrowserUrlInPlace();
      expect(scrubbed).toBe(true);
      expect(replaceStateSpy).toHaveBeenCalledWith(
        window.history.state,
        '',
        '/login?email=admin%40smartsapp.com&redirect=%2Fbackoffice'
      );
    });

    it('rewrites cleanly to pathname only when only sensitive params exist', () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          pathname: '/login',
          search: '?password=secret&confirm_password=secret',
          hash: '',
        },
      });

      const scrubbed = scrubBrowserUrlInPlace();
      expect(scrubbed).toBe(true);
      expect(replaceStateSpy).toHaveBeenCalledWith(
        window.history.state,
        '',
        '/login'
      );
    });

    it('does nothing when no sensitive parameters are present', () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          pathname: '/login',
          search: '?email=admin%40smartsapp.com&redirect=/admin',
          hash: '',
        },
      });

      const scrubbed = scrubBrowserUrlInPlace();
      expect(scrubbed).toBe(false);
      expect(replaceStateSpy).not.toHaveBeenCalled();
    });
  });
});

