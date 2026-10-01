import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyCloudTasksOidcToken } from '../cloud-tasks-oidc';

describe('verifyCloudTasksOidcToken (Rules 13 & 34)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects missing Authorization header in production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const headers = new Headers();
    const result = await verifyCloudTasksOidcToken(headers);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('Missing Authorization header');
  });

  it('rejects non-Bearer authorization header in production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const headers = new Headers({ authorization: 'Basic xyz123' });
    const result = await verifyCloudTasksOidcToken(headers);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('Malformed Bearer token');
  });

  it('bypasses in non-production when no authorization header is supplied', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const headers = new Headers();
    const result = await verifyCloudTasksOidcToken(headers);
    expect(result.authorized).toBe(true);
    expect(result.devBypass).toBe(true);
  });

  it('rejects invalid token in production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const headers = new Headers({ authorization: 'Bearer invalid-token-string' });
    const result = await verifyCloudTasksOidcToken(headers);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
