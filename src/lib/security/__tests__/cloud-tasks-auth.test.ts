import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAuthorizedCloudTaskRequest } from '../cloud-tasks-auth';

describe('isAuthorizedCloudTaskRequest (PR-2 / Rules 8 & 52)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('fails closed in production when CLOUD_TASKS_SECRET is unset', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.CLOUD_TASKS_SECRET;
    const headers = new Headers({ 'x-cloud-tasks-secret': 'some-secret' });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(false);
  });

  it('fails closed in production when CLOUD_TASKS_SECRET is shorter than 16 characters', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.CLOUD_TASKS_SECRET = 'short-secret';
    const headers = new Headers({ 'x-cloud-tasks-secret': 'short-secret' });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(false);
  });

  it('rejects the legacy hardcoded fallback secret in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.CLOUD_TASKS_SECRET = 'real-configured-production-secret-12345';
    const headers = new Headers({
      'x-cloud-tasks-secret': 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf',
    });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(false);
  });

  it('accepts matching secret in production via timing-safe comparison', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.CLOUD_TASKS_SECRET = 'real-configured-production-secret-12345';
    const headers = new Headers({
      'x-cloud-tasks-secret': 'real-configured-production-secret-12345',
    });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(true);
  });

  it('rejects non-matching secret of different length without throwing', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.CLOUD_TASKS_SECRET = 'real-configured-production-secret-12345';
    const headers = new Headers({
      'x-cloud-tasks-secret': 'short',
    });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(false);
  });

  it('rejects non-matching secret of equal length', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.CLOUD_TASKS_SECRET = 'real-configured-production-secret-12345';
    const headers = new Headers({
      'x-cloud-tasks-secret': 'wrong-configured-production-secret-99999',
    });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(false);
  });

  it('allows local-secret in development mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.CLOUD_TASKS_SECRET;
    const headers = new Headers({ 'x-cloud-tasks-secret': 'local-secret' });
    expect(isAuthorizedCloudTaskRequest(headers)).toBe(true);
  });
});
