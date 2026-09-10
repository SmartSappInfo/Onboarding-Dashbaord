import { describe, it, expect, afterEach } from 'vitest';
import { getAppSurface, getPublicAppOrigin, isBackofficeSurface } from '../app-surface';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('getAppSurface', () => {
  it('defaults to client when unset, so existing deployments are unaffected', () => {
    delete process.env.APP_SURFACE;
    expect(getAppSurface()).toBe('client');
  });

  it('reads a valid surface', () => {
    process.env.APP_SURFACE = 'backoffice';
    expect(getAppSurface()).toBe('backoffice');
  });

  it('falls back to client on an unrecognised value rather than throwing at boot', () => {
    process.env.APP_SURFACE = 'nonsense';
    expect(getAppSurface()).toBe('client');
  });
});

describe('isBackofficeSurface', () => {
  it('is false by default', () => {
    delete process.env.APP_SURFACE;
    expect(isBackofficeSurface()).toBe(false);
  });

  it('is true only on the backoffice surface', () => {
    process.env.APP_SURFACE = 'backoffice';
    expect(isBackofficeSurface()).toBe(true);
  });
});

describe('getPublicAppOrigin', () => {
  it('prefers PUBLIC_APP_ORIGIN and strips a trailing slash', () => {
    process.env.PUBLIC_APP_ORIGIN = 'https://go.example.com/';
    expect(getPublicAppOrigin()).toBe('https://go.example.com');
  });

  it('falls back to NEXT_PUBLIC_APP_URL', () => {
    delete process.env.PUBLIC_APP_ORIGIN;
    process.env.NEXT_PUBLIC_APP_URL = 'https://go.example.com';
    expect(getPublicAppOrigin()).toBe('https://go.example.com');
  });

  it('returns an empty string when neither is set, so callers can fall back', () => {
    delete process.env.PUBLIC_APP_ORIGIN;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getPublicAppOrigin()).toBe('');
  });
});
