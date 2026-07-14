import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy for Next.js 16 App Router
 * Handles route protection and request preprocessing
 * Note: In Next.js 16, middleware.ts has been renamed to proxy.ts
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
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
  
  // For admin and protected routes, add custom headers
  // The actual authentication is handled client-side by Firebase
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
