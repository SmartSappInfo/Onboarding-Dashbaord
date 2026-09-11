// @vitest-environment node
//
// Must run under node, not jsdom: getRequestBaseUrl() short-circuits to
// window.location.origin whenever `window` exists, so under jsdom this file would
// test the browser branch and never reach the server logic it is about.
/**
 * R1: getRequestBaseUrl() builds CUSTOMER-FACING links — unsubscribe, meeting joins, short
 * links, survey invitations. It derives from the request host to support tenant custom
 * domains, which is right for the client app and wrong for every other surface: on the
 * backoffice backend it would put goadmin.smartsapp.com into outbound mail.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; vi.resetModules(); });

vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>([
    ['host', 'goadmin.smartsapp.com'],
    ['x-forwarded-proto', 'https'],
  ]),
}));

describe('getRequestBaseUrl on the backoffice surface', () => {
  it('returns the public client origin, never the admin host', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { getRequestBaseUrl } = await import('../url-helpers');
    await expect(getRequestBaseUrl()).resolves.toBe('https://go.smartsapp.com');
  });

  it('falls back to host-derived behaviour if no public origin is configured', async () => {
    process.env.APP_SURFACE = 'backoffice';
    delete process.env.PUBLIC_APP_ORIGIN;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { getRequestBaseUrl } = await import('../url-helpers');
    // Misconfiguration must not produce an empty origin — a broken link is worse than the host.
    await expect(getRequestBaseUrl()).resolves.toBe('https://goadmin.smartsapp.com');
  });
});

describe('getRequestBaseUrl on the client surface', () => {
  it('still honours the request host, which is what supports tenant custom domains', async () => {
    process.env.APP_SURFACE = 'client';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { getRequestBaseUrl } = await import('../url-helpers');
    await expect(getRequestBaseUrl()).resolves.toBe('https://goadmin.smartsapp.com');
  });

  it('behaves the same when APP_SURFACE is unset, so today is unchanged', async () => {
    delete process.env.APP_SURFACE;
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { getRequestBaseUrl } = await import('../url-helpers');
    await expect(getRequestBaseUrl()).resolves.toBe('https://goadmin.smartsapp.com');
  });
});
