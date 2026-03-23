# Next.js 16 Proxy Migration

## Important Change: middleware.ts → proxy.ts

Next.js 16 has deprecated the `middleware.ts` file convention in favor of `proxy.ts` to better reflect its purpose.

### What Changed?

1. **File Name**: `middleware.ts` → `proxy.ts`
2. **Function Name**: `middleware()` → `proxy()`
3. **Location**: Still in project root or `src/` directory
4. **Functionality**: Exactly the same - just renamed for clarity

### Why the Change?

The term "middleware" was confusing because:
- It suggested Express-style middleware (which it's not)
- It didn't clearly communicate that it runs at the network boundary
- The new name "proxy" better describes what it does: proxies and intercepts requests

### Migration Steps

✅ **Already Completed**:

1. Renamed `src/middleware.ts` to `src/proxy.ts`
2. Changed function name from `middleware` to `proxy`
3. Added default export for compatibility
4. Updated all documentation

### Current Implementation

```typescript
// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
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
  ];
  
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // For admin and protected routes, add custom headers
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
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

// Default export for compatibility
export default proxy;
```

### Key Points

1. **Named Export**: Use `export function proxy()` (recommended)
2. **Default Export**: Also exported as default for compatibility
3. **Config**: The `config` export remains the same
4. **Matcher**: Pattern matching syntax unchanged

### What Stays the Same?

- All functionality remains identical
- The `config` object and matcher patterns
- Request/response handling
- Header manipulation
- Redirect/rewrite capabilities
- Performance characteristics

### Benefits of the New Name

1. **Clearer Intent**: "Proxy" clearly indicates network-level interception
2. **Better Mental Model**: Easier to understand what the file does
3. **Reduced Confusion**: No more mixing up with Express middleware
4. **Future-Proof**: Aligns with Next.js's vision for the feature

### Official Documentation

- [Next.js Proxy Documentation](https://nextjs.org/docs/app/getting-started/proxy)
- [Migration Guide](https://nextjs.org/docs/messages/middleware-to-proxy)

### Verification

To verify the migration is complete:

```bash
# Check that middleware.ts doesn't exist
ls src/middleware.ts  # Should not exist

# Check that proxy.ts exists
ls src/proxy.ts  # Should exist

# Check the dev server starts without warnings
pnpm dev
```

### Common Issues

**Issue**: Warning about deprecated middleware convention
**Solution**: ✅ Already fixed - file renamed to proxy.ts

**Issue**: Function not being called
**Solution**: Ensure function is named `proxy` (not `middleware`)

**Issue**: Config not working
**Solution**: Config object should be exported alongside the proxy function

## Summary

The migration from `middleware.ts` to `proxy.ts` is complete. This is purely a naming change - all functionality remains the same. The new name better reflects that this file sits at the network boundary and proxies requests before they reach your application.
