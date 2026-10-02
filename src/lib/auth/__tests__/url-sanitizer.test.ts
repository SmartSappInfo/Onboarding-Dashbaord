import { describe, it, expect } from 'vitest';
import { sanitizeQueryString, hasSensitiveParams, isSensitiveParamKey } from '../url-sanitizer';

describe('url-sanitizer utility', () => {
  it('correctly identifies sensitive parameter keys regardless of casing', () => {
    expect(isSensitiveParamKey('password')).toBe(true);
    expect(isSensitiveParamKey('PASSWORD')).toBe(true);
    expect(isSensitiveParamKey('tempPassword')).toBe(true);
    expect(isSensitiveParamKey('temp_password')).toBe(true);
    expect(isSensitiveParamKey('secret')).toBe(true);
    expect(isSensitiveParamKey('redirect')).toBe(false);
    expect(isSensitiveParamKey('invite')).toBe(false);
    expect(isSensitiveParamKey('email')).toBe(false);
  });

  it('correctly detects sensitive parameters in query string', () => {
    expect(hasSensitiveParams('?email=test@example.com&password=secret')).toBe(true);
    expect(hasSensitiveParams('?password=secret')).toBe(true);
    expect(hasSensitiveParams('?token=abc&tempPassword=123')).toBe(true);
    expect(hasSensitiveParams('?email=test@example.com&redirect=/admin')).toBe(false);
    expect(hasSensitiveParams('')).toBe(false);
  });

  it('removes sensitive parameters while preserving legitimate ones', () => {
    const cleaned = sanitizeQueryString('?email=test@example.com&password=secret&redirect=/admin');
    expect(cleaned).toBe('?email=test%40example.com&redirect=%2Fadmin');
  });

  it('returns empty string if only sensitive parameters were present', () => {
    const cleaned = sanitizeQueryString('?password=secret&tempPassword=123');
    expect(cleaned).toBe('');
  });
});
