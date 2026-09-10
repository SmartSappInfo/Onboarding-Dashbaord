/**
 * @fileOverview Which deployment surface is this process serving? (backoffice isolation)
 *
 * The same image is deployed to two Firebase App Hosting backends — the client app on
 * go.smartsapp.com and the control plane on goadmin.smartsapp.com. This module is the ONLY
 * place that decides which one it is, so behaviour cannot drift between call sites.
 *
 * CAUTION FOR FUTURE EDITORS
 * The default is 'client'. That is deliberate: a deployment with no APP_SURFACE set must
 * keep behaving exactly as it does today. Do not change the default to throw, and do not
 * default to 'backoffice' — either would break the live client app on the next rollout.
 *
 * An unrecognised value also falls back to 'client' rather than throwing, so a typo in a
 * console config cannot take the product down at boot.
 */

/** The deployment surfaces this image knows how to serve. */
export const APP_SURFACES = ['client', 'backoffice'] as const;

export type AppSurface = (typeof APP_SURFACES)[number];

/** Resolve the current surface. Never throws. */
export function getAppSurface(): AppSurface {
  const raw = process.env.APP_SURFACE;
  return APP_SURFACES.includes(raw as AppSurface) ? (raw as AppSurface) : 'client';
}

/** Convenience for the common branch. */
export function isBackofficeSurface(): boolean {
  return getAppSurface() === 'backoffice';
}

/**
 * The origin CUSTOMERS see — not the origin this process happens to be served from.
 *
 * CAUTION: every customer-facing link must be built from this, never from the request
 * host. `getRequestBaseUrl()` in url-helpers.ts derives from the request host to support
 * tenant custom domains; on the backoffice surface that would put goadmin.smartsapp.com
 * into outbound email — unsubscribe links, meeting joins, survey invitations.
 *
 * Returns '' when unset so callers can fall back to their existing behaviour rather than
 * silently producing a broken absolute URL.
 */
export function getPublicAppOrigin(): string {
  const raw = process.env.PUBLIC_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}
