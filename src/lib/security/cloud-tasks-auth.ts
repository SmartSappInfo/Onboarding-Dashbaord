/**
 * @fileOverview Cloud Tasks worker authentication (agents_mcp PR-2 / Phase 0 security closure).
 *
 * Every worker endpoint (`/api/tasks/agent-step`, `/api/automations/*`) calls
 * `isAuthorizedCloudTaskRequest`. A request must carry:
 * 1. the shared secret in `x-cloud-tasks-secret`, compared in constant time; and
 * 2. in production, a Google-signed OIDC token (`Authorization: Bearer …`) whose audience is this
 *    app and whose email is an allowed task service account.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - There is NO built-in secret. The old code fell back to a literal secret that is in the public
 *   repo history; it must never come back. Production without `CLOUD_TASKS_SECRET` fails at startup
 *   (`assertCloudTasksConfig`, called from `src/instrumentation.ts`) and refuses every request.
 * - OIDC rollout is staged with `CLOUD_TASKS_OIDC_MODE`:
 *     'report'  (production default) — verify and log failures, but accept a correct secret;
 *     'enforce' — reject requests without a valid token;
 *     'off'     (development default) — secret only.
 *   Switch production to 'enforce' once the logs show no `[CLOUD_TASKS_AUTH] OIDC` warnings.
 * - Audiences: `CLOUD_TASKS_OIDC_AUDIENCE` (comma list) or the public base URL tasks are sent to.
 *   Service accounts: `CLOUD_TASKS_SERVICE_ACCOUNT_EMAILS` (comma list) or the account tasks are
 *   signed with (`cloudTasksServiceAccountEmail`). Add the Cloud Run runtime account here if the
 *   queue-missing fallback dispatch is used in production.
 * - Not a `'use server'` module. Zero `any`.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

/** Development-only secret used when `CLOUD_TASKS_SECRET` is unset outside production. */
const DEV_LOCAL_SECRET = 'local-secret';

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const splitList = (value: string | undefined): string[] =>
  (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * The shared worker secret. Throws in production when it is not configured, so a misconfigured
 * deploy can never sign or accept tasks with a guessable value.
 */
export function getCloudTasksSecret(): string {
  const configured = process.env.CLOUD_TASKS_SECRET;
  if (configured) return configured;
  if (isProduction()) {
    throw new Error('CLOUD_TASKS_SECRET is not configured. Cloud Tasks workers cannot be authenticated.');
  }
  return DEV_LOCAL_SECRET;
}

/** Fails fast at server startup when production is missing the worker secret. */
export function assertCloudTasksConfig(): void {
  if (isProduction() && !process.env.CLOUD_TASKS_SECRET) {
    throw new Error('[CLOUD_TASKS_AUTH] CLOUD_TASKS_SECRET must be set in production.');
  }
}

/** The project id tasks are created in (same resolution the task client has always used). */
export function cloudTasksProjectId(): string {
  return (
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    ''
  );
}

/** The public base URL Cloud Tasks calls, which is also the OIDC audience tasks are signed for. */
export function cloudTasksPublicBaseUrl(): string {
  const envUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return 'https://go.smartsapp.com';
}

/** The service account Cloud Tasks signs OIDC tokens as. */
export function cloudTasksServiceAccountEmail(): string {
  return (
    process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
    process.env.SERVICE_ACCOUNT_EMAIL ||
    `${cloudTasksProjectId() || 'studio-9220106300-f74cb'}@appspot.gserviceaccount.com`
  );
}

/** Constant-time string comparison (hashing first makes unequal lengths safe too). */
export function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export type CloudTasksOidcMode = 'enforce' | 'report' | 'off';

export function cloudTasksOidcMode(): CloudTasksOidcMode {
  const configured = process.env.CLOUD_TASKS_OIDC_MODE;
  if (configured === 'enforce' || configured === 'report' || configured === 'off') return configured;
  return isProduction() ? 'report' : 'off';
}

/** The verifier is injectable so tests don't fetch Google's certificates. */
export interface IdTokenVerifier {
  verify(idToken: string, audiences: string[]): Promise<{ email?: string; emailVerified?: boolean }>;
}

let oauthClient: OAuth2Client | null = null;
const googleVerifier: IdTokenVerifier = {
  async verify(idToken, audiences) {
    oauthClient ??= new OAuth2Client();
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();
    return { email: payload?.email, emailVerified: payload?.email_verified };
  },
};

/** Why an OIDC token was rejected, or null when it is valid. */
export async function checkCloudTasksOidc(
  headers: Headers,
  verifier: IdTokenVerifier = googleVerifier
): Promise<string | null> {
  const authorization = headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return 'missing bearer token';
  const audiences = splitList(process.env.CLOUD_TASKS_OIDC_AUDIENCE);
  const allowedEmails = splitList(process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAILS);
  try {
    const claims = await verifier.verify(
      authorization.slice('Bearer '.length).trim(),
      audiences.length > 0 ? audiences : [cloudTasksPublicBaseUrl()]
    );
    const allowed = allowedEmails.length > 0 ? allowedEmails : [cloudTasksServiceAccountEmail()];
    if (!claims.email || claims.emailVerified !== true) return 'token has no verified email';
    if (!allowed.includes(claims.email)) return `unexpected service account ${claims.email}`;
    return null;
  } catch (err: unknown) {
    return `invalid token (${err instanceof Error ? err.message.split(':')[0] : 'unknown error'})`;
  }
}

/**
 * Authenticates a Cloud Tasks worker request. Fail-closed: any configuration problem refuses.
 */
export async function isAuthorizedCloudTaskRequest(
  headers: Headers,
  verifier: IdTokenVerifier = googleVerifier
): Promise<boolean> {
  let expected: string;
  try {
    expected = getCloudTasksSecret();
  } catch (err: unknown) {
    console.error('[CLOUD_TASKS_AUTH]', err instanceof Error ? err.message : err);
    return false;
  }
  if (!secretsMatch(headers.get('x-cloud-tasks-secret'), expected)) return false;

  const mode = cloudTasksOidcMode();
  if (mode === 'off') return true;
  const problem = await checkCloudTasksOidc(headers, verifier);
  if (!problem) return true;
  if (mode === 'enforce') {
    console.warn(`[CLOUD_TASKS_AUTH] OIDC rejected: ${problem}`);
    return false;
  }
  console.warn(`[CLOUD_TASKS_AUTH] OIDC check failed (report mode, request accepted): ${problem}`);
  return true;
}
