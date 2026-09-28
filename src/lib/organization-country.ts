import { adminDb } from './firebase-admin';
import type { CountryCode } from 'libphonenumber-js';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 *
 * This module is the Single Source of Truth (SSOT) for resolving an organization's
 * configured default country.
 *
 * SCALE & RESOURCE SAFETY (Rule 9):
 * During high-throughput message dispatches (e.g. 20,000 messages in parallel),
 * querying Firestore on every contact phone number would cause severe read amplification,
 * rate limiting (HTTP 429), and latency spikes.
 *
 * To prevent this, `resolveOrganizationCountryCode` uses an in-memory TTL cache (5-minute TTL).
 * A dispatch batch of 20,000 contacts belonging to the same tenant triggers exactly 1 Firestore read.
 *
 * STRICT TYPING (Rule 4):
 * No `any` or `any[]` is used. Validates 2-letter ISO alpha-2 strings before casting to `CountryCode`.
 */

interface CachedCountry {
  countryCode?: CountryCode;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const orgCountryCache = new Map<string, CachedCountry>();
const inFlightResolvers = new Map<string, Promise<CountryCode | undefined>>();

/**
 * Clears the in-memory cache (primarily for tests and cache-busting).
 */
export function clearOrganizationCountryCache(): void {
  orgCountryCache.clear();
  inFlightResolvers.clear();
}

/**
 * Invalidates the cached country for a single organization (call when settings are updated).
 */
export function invalidateOrganizationCountryCache(organizationId: string): void {
  if (organizationId) {
    const cleanId = organizationId.trim();
    orgCountryCache.delete(cleanId);
    inFlightResolvers.delete(cleanId);
  }
}

/**
 * Resolves the default country code for an organization from Firestore.
 *
 * @param organizationId - The tenant organization ID to lookup
 * @returns ISO 3166-1 alpha-2 country code (e.g. 'GH', 'NG', 'KE', 'GB', 'US') or undefined
 */
export async function resolveOrganizationCountryCode(
  organizationId?: string | null
): Promise<CountryCode | undefined> {
  if (!organizationId || typeof organizationId !== 'string') {
    return undefined;
  }

  const cleanOrgId = organizationId.trim();
  if (!cleanOrgId) {
    return undefined;
  }

  const now = Date.now();
  const cached = orgCountryCache.get(cleanOrgId);
  if (cached && cached.expiresAt > now) {
    return cached.countryCode;
  }

  // Stampede protection: if a lookup for this organization is already in flight, reuse its promise
  const inFlight = inFlightResolvers.get(cleanOrgId);
  if (inFlight) {
    return inFlight;
  }

  const lookupPromise = (async (): Promise<CountryCode | undefined> => {
    try {
      const orgSnap = await adminDb.collection('organizations').doc(cleanOrgId).get();
      if (!orgSnap.exists) {
        orgCountryCache.set(cleanOrgId, { countryCode: undefined, expiresAt: now + CACHE_TTL_MS });
        return undefined;
      }

      const data = orgSnap.data();
      const rawCode = data?.defaultCountryCode;

      if (typeof rawCode === 'string' && rawCode.trim().length === 2) {
        const countryCode = rawCode.trim().toUpperCase() as CountryCode;
        orgCountryCache.set(cleanOrgId, { countryCode, expiresAt: now + CACHE_TTL_MS });
        return countryCode;
      }

      orgCountryCache.set(cleanOrgId, { countryCode: undefined, expiresAt: now + CACHE_TTL_MS });
      return undefined;
    } catch (err) {
      console.warn(`[OrganizationCountry] Failed to resolve country for org "${cleanOrgId}":`, err);
      return undefined;
    } finally {
      inFlightResolvers.delete(cleanOrgId);
    }
  })();

  inFlightResolvers.set(cleanOrgId, lookupPromise);
  return lookupPromise;
}
