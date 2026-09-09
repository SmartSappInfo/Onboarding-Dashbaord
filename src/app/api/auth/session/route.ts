/**
 * @fileOverview Session cookie mint and clear (audit F14, Phase 3).
 *
 * The server had no trusted identity: `proxy.ts` classified routes and left the
 * actual check to client-side Firebase, which means every Server Action was a public
 * endpoint. This endpoint exchanges a freshly-minted Firebase ID token for an
 * `httpOnly` session cookie, so `requireAuth()` can resolve identity server-side.
 *
 * The client never reads this cookie — that is the point. It is set and cleared here,
 * and read only by the Node runtime in `src/lib/auth/require-auth.ts`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

// Five days. Firebase caps session cookies at 14.
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000;

/** How recent the sign-in must be before we hand out a multi-day cookie. */
const MAX_AUTH_AGE_SECONDS = 5 * 60;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The cookie MUST be named `__session`.
 *
 * Firebase App Hosting and Cloud Run strip every other cookie from cached requests.
 * Renaming this breaks authentication in production while working fine locally.
 */
const COOKIE_NAME = '__session';

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function POST(request: NextRequest) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: 'Missing idToken.' }, { status: 400 });
  }

  try {
    // checkRevoked: true — a disabled or already-signed-out account is rejected here
    // rather than being handed a cookie that outlives its own revocation.
    const decoded = await adminAuth.verifyIdToken(idToken, true);

    // A long-lived cookie should only ever follow a recent sign-in. Without this an
    // old ID token lifted from a log or a stale client could be upgraded into days
    // of server-side access.
    if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      return NextResponse.json({ error: 'Recent sign-in required.' }, { status: 401 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, sessionCookie, cookieOptions(EXPIRES_IN_MS / 1000));
    return response;
  } catch {
    // Deliberately opaque: distinguishing "expired" from "revoked" from "forged"
    // tells an attacker which token they hold.
    return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  // Overwrite with an immediately-expiring cookie rather than relying on delete()
  // alone, so intermediaries that ignore removal still receive a dead value.
  response.cookies.set(COOKIE_NAME, '', cookieOptions(0));
  return response;
}
