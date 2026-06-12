import { describe, it, expect } from 'vitest';
import { safeInternalRedirect } from './return-to';

describe('safeInternalRedirect', () => {
  it('accepts app-relative paths', () => {
    expect(safeInternalRedirect('/admin')).toBe('/admin');
    expect(safeInternalRedirect('/profile-setup?code=SS-ABC123')).toBe('/profile-setup?code=SS-ABC123');
    expect(safeInternalRedirect('/a/b?x=1#frag')).toBe('/a/b?x=1#frag');
    // hyphens must be preserved, not treated as control chars
    expect(safeInternalRedirect('/profile-setup')).toBe('/profile-setup');
  });

  it('decodes an encoded path once', () => {
    expect(safeInternalRedirect('%2Fprofile-setup%3Fcode%3DSS-ABC')).toBe('/profile-setup?code=SS-ABC');
  });

  it('rejects empty / nullish', () => {
    expect(safeInternalRedirect(null)).toBeNull();
    expect(safeInternalRedirect(undefined)).toBeNull();
    expect(safeInternalRedirect('')).toBeNull();
    expect(safeInternalRedirect('   ')).toBeNull();
  });

  it('rejects absolute external URLs', () => {
    expect(safeInternalRedirect('https://evil.com')).toBeNull();
    expect(safeInternalRedirect('http://evil.com/admin')).toBeNull();
  });

  it('rejects scheme-relative and backslash tricks', () => {
    expect(safeInternalRedirect('//evil.com')).toBeNull();
    expect(safeInternalRedirect('/\\evil.com')).toBeNull();
  });

  it('rejects javascript: and other embedded schemes', () => {
    expect(safeInternalRedirect('/javascript:alert(1)')).toBeNull();
    expect(safeInternalRedirect('/foo:bar')).toBeNull();
  });

  it('rejects non-rooted relative paths', () => {
    expect(safeInternalRedirect('admin')).toBeNull();
    expect(safeInternalRedirect('profile-setup?code=X')).toBeNull();
  });

  it('rejects paths containing whitespace/control characters', () => {
    expect(safeInternalRedirect('/admin\tx')).toBeNull();
    expect(safeInternalRedirect('/admin x')).toBeNull();
  });
});
