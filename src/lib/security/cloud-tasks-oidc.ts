/**
 * @fileOverview Cloud Tasks OIDC Token Verification (Phase 0 / PR-2)
 *
 * Implements Rule 13 (Trust Boundary Matrix) and Rule 34 (SSRF & Network Boundary Controls).
 * Validates Google Cloud Tasks OIDC identity tokens passed in the Authorization header.
 * Confirms token audience, issuer (https://accounts.google.com), and service account email.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Cloud Tasks sends an OIDC identity token with every task delivery when configured with an OIDC service account.
 * - In production, this token proves that the caller is genuine Google Cloud Tasks infrastructure.
 * - In development (NODE_ENV !== 'production'), requests without an Authorization header can bypass for emulator testing.
 */

import { OAuth2Client } from 'google-auth-library';

const authClient = new OAuth2Client();

export interface OidcVerificationResult {
  authorized: boolean;
  reason?: string;
  email?: string;
  devBypass?: boolean;
}

export async function verifyCloudTasksOidcToken(
  headers: Headers,
  options?: {
    expectedAudience?: string;
    expectedServiceAccountEmail?: string;
  }
): Promise<OidcVerificationResult> {
  const isDev = process.env.NODE_ENV !== 'production';
  const authHeader = headers.get('authorization');

  if (!authHeader) {
    if (isDev) {
      return { authorized: true, devBypass: true };
    }
    return { authorized: false, reason: 'Missing Authorization header' };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return { authorized: false, reason: 'Malformed Bearer token in Authorization header' };
  }

  const token = parts[1];
  const expectedAudience =
    options?.expectedAudience ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://go.smartsapp.com';

  const expectedEmail =
    options?.expectedServiceAccountEmail ||
    process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
    process.env.SERVICE_ACCOUNT_EMAIL;

  try {
    const ticket = await authClient.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return { authorized: false, reason: 'Empty token payload' };
    }

    if (payload.iss !== 'https://accounts.google.com') {
      return { authorized: false, reason: `Untrusted issuer: ${payload.iss}` };
    }

    if (expectedEmail && payload.email !== expectedEmail) {
      return {
        authorized: false,
        reason: `Service account email mismatch: got ${payload.email}, expected ${expectedEmail}`,
      };
    }

    return { authorized: true, email: payload.email };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Token verification failed';
    return { authorized: false, reason: msg };
  }
}
