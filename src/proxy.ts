import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy for Next.js 16 App Router
 * Handles route protection and request preprocessing
 * Note: In Next.js 16, middleware.ts has been renamed to proxy.ts
 */
/**
 * Areas that require a signed-in user.
 *
 * Deliberately an allowlist of PROTECTED prefixes rather than "everything not public".
 * Most of this app is public by design — the marketing homepage, surveys, invoices,
 * quotes, statements, preference centres, password reset and invitation links — and an
 * inverted rule would redirect real visitors to /login. Missing an entry here costs a
 * redirect convenience, not a security hole: `requireAuth()` is the actual boundary and
 * runs server-side on every action that touches data (audit F14).
 */
const protectedPrefixes = [
  '/admin',
  '/backoffice',
  '/dashboard',
  '/onboarding',
  '/profile-setup',
  '/awaiting-approval',
  '/force-password-reset',
  '/seeds',
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // Auto-correct legacy survey route /s/[slug] -> /surveys/[slug]
  if (pathname.startsWith('/s/')) {
    const slug = pathname.substring(3);
    const url = request.nextUrl.clone();
    url.pathname = `/surveys/${slug}`;
    return NextResponse.redirect(url);
  }
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/signup',
    '/campaign',
    '/surveys',
    '/forms',
    '/invoice',
    '/pe',
    '/register-new-signup',
    '/f/',
    '/meetings/',
    '/book/',
    '/q/',
    '/p/',
    '/m/',
    '/go/',
    '/unsubscribe/'
  ];
  
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Staging must not serve anonymous public pages (decision D-1).
  //
  // The staging backend shares the PRODUCTION Firebase project, so a survey response or
  // form submission made there would write a real record into real tenant data. Blocking
  // the anonymous surface is what makes a shared-data staging environment safe to run.
  //
  // /login stays reachable so the environment can be signed into and its authenticated
  // areas exercised — which is the whole point of having it.
  //
  // CAUTION: this is keyed on APP_ENV, which is unset in production, so the gate is inert
  // there. Do not repurpose APP_ENV for anything else without revisiting this.
  if (process.env.APP_ENV === 'staging' && isPublicRoute && !pathname.startsWith('/login')) {
    return new NextResponse(null, { status: 404 });
  }

  // Allow public routes to pass through
  if (isPublicRoute) {
    const response = NextResponse.next();
    // Allow framing on public embedded routes (surveys, forms, meetings, qr, preferences, pages, media)
    if (pathname.startsWith('/surveys') || pathname.startsWith('/f/') || pathname.startsWith('/meetings') || pathname.startsWith('/book') || pathname.startsWith('/q/') || pathname.startsWith('/p/') || pathname.startsWith('/m/')) {
      response.headers.set('Content-Security-Policy', "frame-ancestors *");
      response.headers.delete('x-frame-options');
    }
    return response;
  }
  
  // The marketing homepage is not in publicRoutes but is equally anonymous (D-1).
  if (process.env.APP_ENV === 'staging' && pathname === '/') {
    return new NextResponse(null, { status: 404 });
  }

  // Redirect to /login when a protected area is requested without a session cookie.
  //
  // PRESENCE ONLY. The proxy runs on the Edge runtime, where firebase-admin is
  // unavailable, so the cookie cannot be cryptographically verified here. A forged or
  // expired cookie gets past this check and is then rejected by `requireAuth()` on the
  // Node runtime. This is a redirect convenience, never the security boundary.
  const isProtectedRoute = protectedPrefixes.some(route => pathname.startsWith(route));

  if (isProtectedRoute && !request.cookies.get('__session')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Param name must be `redirect` — that is what the login page reads, and it is
    // already open-redirect protected there by safeInternalRedirect().
    url.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  
  // Add pathname to headers for debugging
  response.headers.set('x-pathname', pathname);
  
  // Add security headers
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

// Default export for compatibility
export default proxy;
