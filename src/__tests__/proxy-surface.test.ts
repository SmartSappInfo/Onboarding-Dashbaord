/**
 * Surface gating: the same image serves two App Hosting backends, and APP_SURFACE decides
 * which routes each one answers.
 *
 * The most important cases here are the negative ones — that the client app keeps serving
 * everything it serves today, and that an unset APP_SURFACE changes nothing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; vi.resetModules(); });

function req(path: string, host = 'go.smartsapp.com', headers?: Record<string, string>) {
  return new NextRequest(new URL(`https://${host}${path}`), { headers });
}

describe('client surface', () => {
  it('hides the backoffice entirely', async () => {
    process.env.APP_SURFACE = 'client';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/backoffice')).status).toBe(404);
    expect(proxy(req('/backoffice/operations')).status).toBe(404);
  });

  it('still serves the tenant admin app', async () => {
    process.env.APP_SURFACE = 'client';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/admin')).status).not.toBe(404);
  });

  it('still serves public pages anonymously', async () => {
    process.env.APP_SURFACE = 'client';
    const { proxy } = await import('@/proxy');
    for (const p of ['/', '/surveys/x', '/forms/x', '/q/abc', '/invoice/1', '/login']) {
      expect(proxy(req(p)).status, `${p} must stay public`).not.toBe(404);
    }
  });
});

describe('backoffice surface', () => {
  it('keeps backoffice traffic on this host rather than bouncing it to the client app', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/backoffice', 'goadmin.smartsapp.com'));
    // Unauthenticated, so the session guard sends it to /login — that is correct. What
    // must NOT happen is a redirect to the client origin.
    const location = res.headers.get('location');
    if (location) {
      expect(new URL(location).origin).not.toBe('https://go.smartsapp.com');
      expect(new URL(location).pathname).toBe('/login');
    }
  });

  it('serves the backoffice through when a session cookie is present', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { proxy } = await import('@/proxy');
    const r = req('/backoffice', 'goadmin.smartsapp.com');
    r.cookies.set('__session', 'x');
    const res = proxy(r);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(404);
  });

  it('sends stray non-backoffice traffic to the client app, preserving the path', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/surveys/abc?x=1', 'goadmin.smartsapp.com'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://go.smartsapp.com/surveys/abc?x=1');
  });

  it('does not redirect when no public origin is configured, rather than sending users nowhere', async () => {
    process.env.APP_SURFACE = 'backoffice';
    delete process.env.PUBLIC_APP_ORIGIN;
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/surveys/abc', 'goadmin.smartsapp.com')).status).not.toBe(307);
  });
});

describe('backoffice IP allowlist (D-2)', () => {
  it('is inert while unset, so nothing changes until an address is configured', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.BACKOFFICE_IP_ALLOWLIST = '';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/backoffice', 'goadmin.smartsapp.com')).status).not.toBe(403);
  });

  it('blocks an address that is not on the list', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.BACKOFFICE_IP_ALLOWLIST = '203.0.113.7';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/backoffice', 'goadmin.smartsapp.com', { 'x-forwarded-for': '198.51.100.4' }));
    expect(res.status).toBe(403);
  });

  it('allows an address on the list', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.BACKOFFICE_IP_ALLOWLIST = '203.0.113.7, 198.51.100.4';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/backoffice', 'goadmin.smartsapp.com', { 'x-forwarded-for': '198.51.100.4' }));
    expect(res.status).not.toBe(403);
  });

  it('reads the first address in a proxy chain, which is the real client', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.BACKOFFICE_IP_ALLOWLIST = '198.51.100.4';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/backoffice', 'goadmin.smartsapp.com', { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }));
    expect(res.status).not.toBe(403);
  });

  it('never applies to the client surface, so tenants are never IP-restricted', async () => {
    process.env.APP_SURFACE = 'client';
    process.env.BACKOFFICE_IP_ALLOWLIST = '203.0.113.7';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/admin', 'go.smartsapp.com', { 'x-forwarded-for': '198.51.100.4' })).status).not.toBe(403);
  });
});

describe('unset surface behaves exactly as today', () => {
  it('serves both areas', async () => {
    delete process.env.APP_SURFACE;
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/backoffice')).status).not.toBe(404);
    expect(proxy(req('/admin')).status).not.toBe(404);
  });
});
