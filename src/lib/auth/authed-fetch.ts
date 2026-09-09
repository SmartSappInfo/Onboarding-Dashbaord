/**
 * @fileOverview Client-side `fetch` that attaches the caller's Firebase ID token.
 *
 * Why this exists: internal API routes that read or write through `adminDb` bypass
 * Firestore rules, so they verify the caller with `authenticateApiRequest`, which
 * expects an `Authorization: Bearer <idToken>` header (see `api-auth-guard.ts`).
 * Every browser caller of such a route needs that header; this centralises it so the
 * token plumbing is not copy-pasted per call site (audit F3).
 *
 * Use from client components and other browser-side modules only — on the server,
 * call the underlying logic directly instead of going back out over HTTP.
 */

import { getAuth } from 'firebase/auth';

export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in: no Firebase user is available to authenticate this request.');
    this.name = 'NotSignedInError';
  }
}

/**
 * Resolve the current user's ID token.
 *
 * @param forceRefresh Force a token refresh rather than using the cached one.
 * @throws {NotSignedInError} when no user is signed in.
 */
export async function getIdTokenOrThrow(forceRefresh = false): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new NotSignedInError();
  return user.getIdToken(forceRefresh);
}

/**
 * `fetch` with the current user's ID token attached as a Bearer token.
 *
 * Existing headers are preserved; an explicit `Authorization` header, if the caller
 * supplies one, wins.
 *
 * @throws {NotSignedInError} when no user is signed in — callers should treat this as
 *         "redirect to login", not as a network failure.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const idToken = await getIdTokenOrThrow();

  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }

  return fetch(input, { ...init, headers });
}
