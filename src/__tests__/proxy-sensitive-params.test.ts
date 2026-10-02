/**
 * Proxy sensitive query parameters sanitizer tests.
 * Enforces OWASP Top 10 and CWE-598 (Information Exposure via Query Strings).
 * Governed by SmartSapp Agentic Development Rules (Rule 1, 3, 8, 9, 13, 54).
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('Proxy sensitive query parameters sanitizer (CWE-598 Defense)', () => {
  it('redirects requests containing sensitive password parameter to a sanitized URL', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?email=admin%40smartsapp.com&password=SecurePassword123%21')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('email')).toBe('admin@smartsapp.com');
    expect(location.searchParams.has('password')).toBe(false);
  });

  it('preserves backoffice redirect while stripping leaked password (Rule 3)', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?redirect=%2Fbackoffice&password=LeakedPass123')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe('/backoffice');
    expect(location.searchParams.has('password')).toBe(false);
  });

  it('redirects requests containing variations of sensitive keys (pass, tempPassword, secret)', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/force-password-reset?tempPassword=TempPass123&secret=xyz&validParam=1')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/force-password-reset');
    expect(location.searchParams.has('tempPassword')).toBe(false);
    expect(location.searchParams.has('secret')).toBe(false);
    expect(location.searchParams.get('validParam')).toBe('1');
  });

  it('redirects requests containing only sensitive parameters to clean pathname without query string', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?password=SecurePassword123%21')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.search).toBe('');
    expect(location.searchParams.has('password')).toBe(false);

    // Verify security & anti-caching headers (IMP-3)
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('allows safe query parameters and invite tokens to pass through untouched', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?redirect=%2Fadmin&email=user%40test.com&invite=ENC_TOKEN_123')
    );
    const res = proxy(req);
    expect(res.status).toBe(200);
  });
});

