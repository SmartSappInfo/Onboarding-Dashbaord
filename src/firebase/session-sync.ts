'use client';

/**
 * @fileOverview Keeps the server-side `__session` cookie in step with Firebase client auth.
 *
 * Centralised deliberately. Sign-in happens in six places and sign-out in nine, and a
 * missed call site is an account that silently has no server identity. `onIdTokenChanged`
 * fires for all three transitions we care about — sign-in, token refresh, sign-out — so
 * one subscription in the provider covers every path, including ones added later.
 */
import type { User } from 'firebase/auth';

/**
 * The mint endpoint requires a recent sign-in, and `auth_time` records when the user
 * actually authenticated — not when the current ID token was minted. An hourly refresh
 * therefore carries the *original* `auth_time`, so re-posting on every refresh would
 * 401 for the entire life of the session.
 *
 * We only mint while `auth_time` is fresh. That is sufficient:
 *
 *   - Revocation stays prompt without re-minting, because `requireAuth()` verifies the
 *     cookie with `checkRevoked: true` on every single call.
 *   - If the cookie is missing or expired while the Firebase session persists, `proxy.ts`
 *     redirects to `/login`; signing in produces a fresh `auth_time` and a new cookie.
 *     The flow self-heals rather than looping on a request the server will always reject.
 *
 * Kept slightly under the server's 5 minutes to allow for clock skew and latency.
 */
const MINT_WINDOW_MS = 4 * 60 * 1000;

/**
 * `keepalive` matters here. Sign-out and sign-in are almost always followed by an
 * immediate navigation, which cancels in-flight requests. A cancelled DELETE would
 * leave a valid session cookie behind for its full five-day life *after* the user
 * believes they have signed out. keepalive lets the request outlive the page.
 */
async function post(idToken: string): Promise<void> {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    keepalive: true,
  });
}

async function clear(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE', keepalive: true });
}

/**
 * Reconcile the session cookie with the current Firebase user.
 *
 * Never throws: a failure here must not break rendering. The consequence of a failed
 * mint is a redirect to `/login`, not a broken page.
 */
export async function syncSessionCookie(user: User | null): Promise<void> {
  try {
    if (!user) {
      await clear();
      return;
    }

    const result = await user.getIdTokenResult();
    const authTimeMs = Date.parse(result.authTime);

    // Stale sign-in: the cookie is either already established or the user is about to
    // be bounced to /login. Posting would only produce a guaranteed 401.
    if (Number.isFinite(authTimeMs) && Date.now() - authTimeMs > MINT_WINDOW_MS) {
      return;
    }

    await post(result.token);
  } catch (error) {
    console.error('[session-sync] Failed to sync server session cookie:', error);
  }
}
