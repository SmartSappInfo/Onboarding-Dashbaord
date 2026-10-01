/**
 * Cloud Tasks worker authentication (agents_mcp PR-2 / Phase 0 security closure).
 *
 * Pins: no built-in secret (the old literal is in the public repo history), constant-time
 * comparison, fail-closed production config, and the staged OIDC check (report / enforce).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertCloudTasksConfig,
  checkCloudTasksOidc,
  cloudTasksOidcMode,
  getCloudTasksSecret,
  isAuthorizedCloudTaskRequest,
  secretsMatch,
  type IdTokenVerifier,
} from '../cloud-tasks-auth';

const TASK_SA = 'studio-9220106300-f74cb@appspot.gserviceaccount.com';

const headers = (values: Record<string, string>) => new Headers(values);
const verifierReturning = (claims: { email?: string; emailVerified?: boolean }, seen?: string[][]): IdTokenVerifier => ({
  verify: async (_token, audiences) => { seen?.push(audiences); return claims; },
});
const failingVerifier: IdTokenVerifier = { verify: async () => { throw new Error('Wrong recipient: aud mismatch'); } };

afterEach(() => { vi.unstubAllEnvs(); });

describe('Cloud Tasks secret', () => {
  it('has no built-in value: production without the secret throws and refuses', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLOUD_TASKS_SECRET', '');
    expect(() => getCloudTasksSecret()).toThrow();
    expect(() => assertCloudTasksConfig()).toThrow();
    expect(await isAuthorizedCloudTaskRequest(headers({ 'x-cloud-tasks-secret': 'anything' }))).toBe(false);
  });

  it('uses a local-only value in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CLOUD_TASKS_SECRET', '');
    expect(getCloudTasksSecret()).toBe('local-secret');
    expect(() => assertCloudTasksConfig()).not.toThrow();
  });

  it('compares secrets exactly, including different lengths', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true);
    expect(secretsMatch('abc', 'abcd')).toBe(false);
    expect(secretsMatch(null, 'abc')).toBe(false);
    expect(secretsMatch('', '')).toBe(false);
  });

  it('never accepts the leaked literal from the old code', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CLOUD_TASKS_SECRET', '');
    const leaked = ['cc6442af1b849d22', '50ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf'].join('');
    expect(await isAuthorizedCloudTaskRequest(headers({ 'x-cloud-tasks-secret': leaked }))).toBe(false);
  });

  it('the leaked literal appears nowhere in src', () => {
    const needle = ['cc6442af1b849d22', '50ab115c340ac11b'].join('');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx|js|mjs|cjs|json)$/.test(name) && readFileSync(path, 'utf8').includes(needle)) hits.push(path);
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(hits).toEqual([]);
  });
});

describe('Cloud Tasks OIDC', () => {
  const signed = { 'x-cloud-tasks-secret': 's3cret', authorization: 'Bearer token' };

  it('defaults to report in production and off in development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(cloudTasksOidcMode()).toBe('report');
    vi.stubEnv('NODE_ENV', 'development');
    expect(cloudTasksOidcMode()).toBe('off');
    vi.stubEnv('CLOUD_TASKS_OIDC_MODE', 'enforce');
    expect(cloudTasksOidcMode()).toBe('enforce');
  });

  it('accepts a token for this app from the task service account', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://go.smartsapp.com');
    const seen: string[][] = [];
    expect(await checkCloudTasksOidc(headers(signed), verifierReturning({ email: TASK_SA, emailVerified: true }, seen))).toBeNull();
    expect(seen).toEqual([['https://go.smartsapp.com']]);
  });

  it('rejects a missing token, an unverified email, another account, or a bad signature/audience', async () => {
    expect(await checkCloudTasksOidc(headers({ 'x-cloud-tasks-secret': 's3cret' }), verifierReturning({ email: TASK_SA, emailVerified: true }))).toMatch(/missing/);
    expect(await checkCloudTasksOidc(headers(signed), verifierReturning({ email: TASK_SA, emailVerified: false }))).toMatch(/verified/);
    expect(await checkCloudTasksOidc(headers(signed), verifierReturning({ email: 'attacker@evil.iam.gserviceaccount.com', emailVerified: true }))).toMatch(/unexpected/);
    expect(await checkCloudTasksOidc(headers(signed), failingVerifier)).toMatch(/invalid token/);
  });

  it('honours configured audiences and service accounts', async () => {
    vi.stubEnv('CLOUD_TASKS_OIDC_AUDIENCE', 'https://a.example, https://b.example');
    vi.stubEnv('CLOUD_TASKS_SERVICE_ACCOUNT_EMAILS', 'runtime@p.iam.gserviceaccount.com');
    const seen: string[][] = [];
    expect(await checkCloudTasksOidc(headers(signed), verifierReturning({ email: 'runtime@p.iam.gserviceaccount.com', emailVerified: true }, seen))).toBeNull();
    expect(seen).toEqual([['https://a.example', 'https://b.example']]);
    expect(await checkCloudTasksOidc(headers(signed), verifierReturning({ email: TASK_SA, emailVerified: true }))).toMatch(/unexpected/);
  });

  it('report mode accepts a correct secret with a bad token; enforce mode refuses it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLOUD_TASKS_SECRET', 's3cret');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubEnv('CLOUD_TASKS_OIDC_MODE', 'report');
    expect(await isAuthorizedCloudTaskRequest(headers(signed), failingVerifier)).toBe(true);

    vi.stubEnv('CLOUD_TASKS_OIDC_MODE', 'enforce');
    expect(await isAuthorizedCloudTaskRequest(headers(signed), failingVerifier)).toBe(false);
    expect(await isAuthorizedCloudTaskRequest(headers(signed), verifierReturning({ email: TASK_SA, emailVerified: true }))).toBe(true);

    // The secret is still required in every mode.
    expect(await isAuthorizedCloudTaskRequest(headers({ ...signed, 'x-cloud-tasks-secret': 'wrong' }), verifierReturning({ email: TASK_SA, emailVerified: true }))).toBe(false);
  });
});
