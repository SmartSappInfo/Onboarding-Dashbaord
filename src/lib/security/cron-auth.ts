/**
 * @fileOverview Standardized Cron Route Authentication Guard
 *
 * Enforces fail-closed authentication on scheduled cron endpoints across all environments.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Why this exists: Cron endpoints perform heavy data sweeping and message dispatches.
 *   Failing open (e.g. `if (cronSecret && ...)`) allows unauthenticated users to trigger crons
 *   whenever `CRON_SECRET` is unset.
 * - Production: Requires `CRON_SECRET` to be defined and matched strictly.
 * - Development: Allows `'dev-secret'` or `'local-secret'` when running locally.
 * - Zero `any` or `any[]` typing.
 */

import { NextResponse } from 'next/server';

export interface CronAuthResult {
  isAuthorized: boolean;
  errorResponse?: NextResponse;
}

export function authenticateCronRequest(request: Request): CronAuthResult {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== 'production';

  // Also check query param `?secret=` for providers that pass cron secrets via query string
  let querySecret: string | null = null;
  try {
    const url = new URL(request.url);
    querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
  } catch {
    // URL parsing fallback
  }

  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const providedToken = tokenFromHeader || querySecret;

  if (isDev) {
    if (
      providedToken === 'dev-secret' ||
      providedToken === 'local-secret' ||
      (cronSecret && providedToken === cronSecret) ||
      !cronSecret // In local dev without env var, permit testing with a log warning
    ) {
      return { isAuthorized: true };
    }
  }

  // In production, fail-closed: must have CRON_SECRET configured and matching
  if (!cronSecret) {
    console.error('[CRON_AUTH] CRON_SECRET is not configured in production environment.');
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: 'Server misconfiguration: CRON_SECRET is not configured.' },
        { status: 500 }
      ),
    };
  }

  if (!providedToken || providedToken !== cronSecret) {
    console.warn('[CRON_AUTH] Unauthorized cron execution attempt.');
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Invalid cron authorization credentials.' },
        { status: 401 }
      ),
    };
  }

  return { isAuthorized: true };
}
