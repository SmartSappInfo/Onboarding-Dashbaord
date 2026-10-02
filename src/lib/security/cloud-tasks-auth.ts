/**
 * @fileOverview Cloud Tasks & Worker Secret Verification Helper (Phase 0 / PR-2)
 *
 * Implements Rule 8 (High Security Standards & Timing Defense) and Rule 52 (Secret Isolation).
 * Uses crypto.timingSafeEqual to prevent side-channel timing attacks when verifying task secrets.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - In production, fail closed: strictly requires CLOUD_TASKS_SECRET to be configured and >= 16 chars.
 * - In development (NODE_ENV !== 'production'), allows 'local-secret' fallback for emulator flows.
 * - Never reintroduce hardcoded fallback secrets in source code.
 */

import crypto from 'crypto';

export function isAuthorizedCloudTaskRequest(headers: Headers): boolean {
  const configuredSecret = process.env.CLOUD_TASKS_SECRET;
  const incomingSecret = headers.get('x-cloud-tasks-secret');
  const isDev = process.env.NODE_ENV !== 'production';

  // In development, allow local-secret if configured or as fallback
  if (isDev) {
    if (incomingSecret === 'local-secret') {
      return true;
    }
    if (configuredSecret && incomingSecret === configuredSecret) {
      return true;
    }
    if (!configuredSecret && !incomingSecret) {
      return false;
    }
  }

  // In production, fail-closed: must have CLOUD_TASKS_SECRET configured and >= 16 chars entropy
  if (!configuredSecret || configuredSecret.length < 16) {
    console.error('[CLOUD_TASKS_AUTH] CLOUD_TASKS_SECRET is unset or insecure (< 16 chars) in production.');
    return false;
  }

  if (!incomingSecret) {
    return false;
  }

  const incomingBuf = Buffer.from(incomingSecret, 'utf8');
  const configuredBuf = Buffer.from(configuredSecret, 'utf8');

  if (incomingBuf.length !== configuredBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuf, configuredBuf);
}
