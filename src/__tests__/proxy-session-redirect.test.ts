/**
 * Proxy route protection (audit F14, Phase 3).
 *
 * The proxy previously classified routes and left authentication entirely to the
 * client. These tests pin the redirect, and — just as importantly — pin that the many
 * genuinely public routes are NOT redirected. An over-eager rule here would lock real
 * visitors out of the homepage, password reset and invitation links.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function request(pathname: string, opts: { session?: boolean } = {}) {
  const req = new NextRequest(new URL(`https://app.example.com${pathname}`));
  if (opts.session) req.cookies.set('__session', 'some-cookie-value');
  return req;
}

const PROTECTED = [
  '/admin',
  '/admin/surveys',
  '/backoffice',
  '/backoffice/settings/system-defaults',
  '/dashboard',
  '/onboarding/setup',
  '/profile-setup',
  '/awaiting-approval',
  '/force-password-reset',
  '/seeds',
];

const PUBLIC = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/accept-invitation',
  '/surveys/my-survey',
  '/forms/abc',
  '/invoice/123',
  '/quotes/token-abc',
  '/statement/123',
  '/preferences/abc',
  '/unsubscribe/abc',
  '/portal/acme',
  '/thank-you',
  '/campaign/x',
  '/pe/x',
  '/q/abc',
  '/f/abc',
];

describe('protected routes without a session cookie', () => {
  it.each(PROTECTED)('redirects %s to /login', (path) => {
    const res = proxy(request(path));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe(path);
  });
});

describe('the redirect destination', () => {
  it('uses the `redirect` param the login page actually reads', () => {
    const res = proxy(request('/dashboard'));
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('redirect')).toBe('/dashboard');
    // `returnTo` would be silently ignored by the login page.
    expect(location.searchParams.get('returnTo')).toBeNull();
  });

  it('preserves the query string so filters survive the round trip', () => {
    const req = new NextRequest(new URL('https://app.example.com/admin/contacts?tab=leads&page=2'));
    const location = new URL(proxy(req).headers.get('location')!);
    expect(location.searchParams.get('redirect')).toBe('/admin/contacts?tab=leads&page=2');
  });
});

describe('protected routes WITH a session cookie', () => {
  it.each(PROTECTED)('allows %s through', (path) => {
    const res = proxy(request(path, { session: true }));
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('public routes are never redirected to /login', () => {
  it.each(PUBLIC)('leaves %s alone', (path) => {
    const res = proxy(request(path));
    const location = res.headers.get('location');
    if (location) {
      expect(new URL(location).pathname).not.toBe('/login');
    }
  });
});

describe('unrelated behaviour is preserved', () => {
  it('still rewrites the legacy /s/[slug] survey route', () => {
    const res = proxy(request('/s/my-survey'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/surveys/my-survey');
  });

  it('still allows framing on embeddable public routes', () => {
    const res = proxy(request('/surveys/my-survey'));
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors *');
  });

  it('still sets security headers on non-public routes', () => {
    const res = proxy(request('/dashboard', { session: true }));
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
