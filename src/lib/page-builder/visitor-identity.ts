/**
 * @file src/lib/page-builder/visitor-identity.ts
 * @description Visitor Identity Resolver for SmartSapp AI Experience Builder.
 * Manages persistent anonymous visitor identification (`_sb_vid`) across sessions using cookies and localStorage,
 * and maps historic anonymous visitor activity to a CRM `contactId` upon lead conversion.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Robust dual storage (Cookie + LocalStorage) for ITP/private browsing resilience.
 * - Testable utility pure functions.
 */

const VISITOR_COOKIE_NAME = '_sb_vid';
const VISITOR_STORAGE_KEY = 'smartsapp_visitor_id';

/**
 * Retrieves the existing persistent visitor ID or generates a new one.
 * Safely handles SSR / Node runtime boundaries.
 * 
 * TESTABILITY POINTER:
 * Mock `document.cookie` and `window.localStorage` in unit tests to verify fallback resolution.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') {
    return `vid-ssr-${Math.random().toString(36).substring(2, 9)}`;
  }

  // 1. Try reading cookie
  const cookieMatch = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${VISITOR_COOKIE_NAME}=`));

  if (cookieMatch) {
    const value = cookieMatch.split('=')[1];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  // 2. Try reading localStorage fallback
  try {
    const localId = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (localId && localId.trim()) {
      // Refresh cookie
      setVisitorIdCookie(localId.trim());
      return localId.trim();
    }
  } catch (_e: unknown) {
    // LocalStorage restricted by browser security settings
  }

  // 3. Generate new visitor ID
  const newId = `vid-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

  // Persist both in cookie and localStorage
  setVisitorIdCookie(newId);
  try {
    window.localStorage.setItem(VISITOR_STORAGE_KEY, newId);
  } catch (_e: unknown) {
    // Ignore storage quota or restricted access errors
  }

  return newId;
}

/**
 * Stores the visitor ID in document cookies with 1-year max age.
 */
function setVisitorIdCookie(visitorId: string): void {
  if (typeof document === 'undefined') return;
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  document.cookie = `${VISITOR_COOKIE_NAME}=${encodeURIComponent(visitorId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Associative mapping helper linking an anonymous visitor ID to a CRM contact ID upon lead conversion.
 */
export function buildVisitorContactAssociation(
  visitorId: string,
  contactId: string,
): { visitorId: string; contactId: string; linkedAt: string } {
  return {
    visitorId,
    contactId,
    linkedAt: new Date().toISOString(),
  };
}
