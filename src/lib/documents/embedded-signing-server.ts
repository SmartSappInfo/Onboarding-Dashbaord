/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Domain Placement:
 *    Authoritative Server-Side Query Service for Embedded Signing Partner Origins (P8.4 Server Layer).
 *    Safely interacts with Firestore Admin SDK without leaking Node.js built-ins to client components.
 * 2. Invariants Enforced:
 *    - Rejects wildcards ('*') and invalid schemes (javascript:, data:) in embed origins.
 *    - Tenant Scoping: Validates origins against workspace settings document at `workspaces/{workspaceId}/settings/embedded_signing`.
 * 3. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`. Output adheres to EmbedOriginValidationResult.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  isValidEmbedOrigin,
  type EmbedOriginValidationResult,
} from './embedded-signing-service';

/**
 * Validates if the requesting parent origin is registered in workspace embed settings.
 */
export async function validateEmbedOrigin(
  workspaceId: string,
  origin: string
): Promise<EmbedOriginValidationResult> {
  if (!isValidEmbedOrigin(origin)) {
    return {
      allowed: false,
      reason: 'Invalid origin format. Must be a valid http(s) origin without paths or wildcards.',
    };
  }

  const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();

  const settingsDoc = await adminDb
    .doc(`workspaces/${workspaceId}/settings/embedded_signing`)
    .get();

  if (!settingsDoc.exists) {
    return {
      allowed: false,
      reason: 'Embedded signing origins not configured for workspace.',
    };
  }

  const data = settingsDoc.data();
  const allowedOrigins: unknown = data?.allowedEmbedOrigins;

  if (!Array.isArray(allowedOrigins)) {
    return {
      allowed: false,
      reason: 'Embedded signing origins not configured for workspace.',
    };
  }

  const isWhitelisted = allowedOrigins.some((allowed) => {
    if (typeof allowed !== 'string') return false;
    return allowed.trim().replace(/\/+$/, '').toLowerCase() === normalizedOrigin;
  });

  if (!isWhitelisted) {
    return {
      allowed: false,
      reason: `Origin '${origin}' is not whitelisted for workspace iframe embedding.`,
    };
  }

  return { allowed: true };
}
