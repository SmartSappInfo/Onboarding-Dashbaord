import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBaseUrl, ensureAbsoluteUrl } from '../url-helpers';

describe('URL Helpers & Container Host Leak Safeguard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('should return window.location.origin when in client browser environment', () => {
    const baseUrl = getBaseUrl();
    expect(baseUrl).toBe(window.location.origin);
  });

  it('should return NEXT_PUBLIC_APP_URL when running on server with env configured', () => {
    vi.stubGlobal('window', undefined);
    process.env.NEXT_PUBLIC_APP_URL = 'https://go.smartsapp.com/';
    const baseUrl = getBaseUrl();
    expect(baseUrl).toBe('https://go.smartsapp.com');
  });

  it('should fallback to https://go.smartsapp.com when running on server in production without env var', () => {
    vi.stubGlobal('window', undefined);
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    process.env.NODE_ENV = 'production';
    const baseUrl = getBaseUrl();
    expect(baseUrl).toBe('https://go.smartsapp.com');
  });

  it('should construct absolute URLs cleanly', () => {
    vi.stubGlobal('window', undefined);
    process.env.NEXT_PUBLIC_APP_URL = 'https://go.smartsapp.com';
    expect(ensureAbsoluteUrl('/m/realcost')).toBe('https://go.smartsapp.com/m/realcost');
    expect(ensureAbsoluteUrl('m/realcost')).toBe('https://go.smartsapp.com/m/realcost');
  });

  it('should preserve existing absolute HTTP/HTTPS URLs', () => {
    expect(ensureAbsoluteUrl('https://example.com/page')).toBe('https://example.com/page');
  });
});
