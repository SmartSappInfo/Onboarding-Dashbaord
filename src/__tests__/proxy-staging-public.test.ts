/**
 * D-1: staging shares production Firestore, so it must not serve public pages — a form
 * submitted there would write a real record.
 *
 * Production is unaffected: APP_ENV is unset there, so this gate is inert.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; vi.resetModules(); });

function req(path: string) {
  return new NextRequest(new URL(`https://staging.example.com${path}`));
}

describe('staging blocks public pages (D-1)', () => {
  it('blocks anonymous public routes', async () => {
    process.env.APP_ENV = 'staging';
    const { proxy } = await import('@/proxy');
    for (const p of ['/', '/surveys/my-survey', '/forms/abc', '/q/xyz', '/invoice/1']) {
      expect(proxy(req(p)).status, `${p} should be blocked on staging`).toBe(404);
    }
  });

  it('still allows the login page, so staging can be signed into', async () => {
    process.env.APP_ENV = 'staging';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/login')).status).not.toBe(404);
  });

  it('still allows authenticated areas to be exercised', async () => {
    process.env.APP_ENV = 'staging';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/admin'));
    // Either served, or redirected to login — never blocked outright.
    expect(res.status).not.toBe(404);
  });
});

describe('production is unaffected when APP_ENV is unset', () => {
  it('serves public routes normally', async () => {
    delete process.env.APP_ENV;
    const { proxy } = await import('@/proxy');
    for (const p of ['/', '/surveys/my-survey', '/forms/abc', '/q/xyz']) {
      expect(proxy(req(p)).status, `${p} must still be public in production`).not.toBe(404);
    }
  });
});
