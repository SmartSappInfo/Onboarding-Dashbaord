/**
 * @fileOverview SSRF Protection & Safe Egress Fetcher (Phase 0 / Phase 5)
 *
 * Implements Rule 34 of SmartSapp Agentic Development Rules and Cloud Run Security Blueprint.
 * Re-exports the canonical implementation from `@/lib/security/ssrf-guard` to maintain a
 * single source of truth across both client/application and platform layers.
 */

export {
  validateSafeEgressUrl,
  safeUrlFetch,
  SsrffBlockedError,
  validateExternalUrl,
  isForbiddenIp,
  isForbiddenIpV4,
  isForbiddenHostname,
  isSsrfBlockedError,
} from '@/lib/security/ssrf-guard';

export type { SsrfValidationResult } from '@/lib/security/ssrf-guard';
