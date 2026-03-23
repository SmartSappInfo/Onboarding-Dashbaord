# Build Error Fix - Genkit AI Express Module

## Issue
**Error**: `Module not found: Can't resolve (<dynamic> | 'undefined') ./node_modules/.pnpm/express@4.22.1/node_modules/express/lib/view.js`

**Location**: New School page and other pages using AI flows

**Root Cause**: Client component directly importing server-side Genkit AI flow that uses Express

## Error Details
```
Module not found: Can't resolve (<dynamic> | 'undefined')
  79 |   
  80 |     // default engine export
> 81 |     var fn = require(mod).__express
     |              ^^^^^^^^^^^^
  82 |   
  83 |     if (typeof fn !== 'function') {
  84 |       throw new Error('Module "' + mod + '" does not provide a view engine.')

Import trace:
  ./node_modules/.pnpm/express@4.22.1/node_modules/express/lib/view.js
  ./node_modules/.pnpm/express@4.22.1/node_modules/express/lib/application.js
  ./node_modules/.pnpm/express@4.22.1/node_modules/express/lib/express.js
  ./node_modules/.pnpm/express@4.22.1/node_modules/express/index.js
  ./node_modules/.pnpm/@genkit-ai+core@1.30.1.../node_modules/@genkit-ai/core/lib/reflection.js
  ./node_modules/.pnpm/@genkit-ai+core@1.30.1.../node_modules/@genkit-ai/core/lib/index.js
  ./node_modules/.pnpm/genkit@1.30.1.../node_modules/genkit/lib/common.js
  ./src/ai/flows/get-link-metadata-flow.ts
```

## Problem Analysis

### What Happened
1. `add-link-button.tsx` is a client component (`'use client'`)
2. It directly imported `getLinkMetadata` from `get-link-metadata-flow.ts`
3. The flow file uses Genkit AI which depends on Express (server-side framework)
4. Next.js tried to bundle Express into the client bundle
5. Express uses dynamic `require()` calls that can't be resolved at build time

### Why It Failed
- **Client/Server Boundary Violation**: Client components cannot directly import server-only code
- **Dynamic Requires**: Express uses `require(mod)` with dynamic module names
- **Webpack Limitation**: Next.js webpack can't resolve dynamic requires during static analysis

## Solution Applied

### 1. Created Server Action Wrapper
**File**: `src/app/actions/link-metadata-actions.ts`

```typescript
'use server';

import { getLinkMetadata as getLinkMetadataFlow } from '@/ai/flows/get-link-metadata-flow';

export async function getLinkMetadataAction(url: string) {
  try {
    const metadata = await getLinkMetadataFlow({ url });
    return { success: true, metadata };
  } catch (error: any) {
    console.error('Error fetching link metadata:', error);
    return { success: false, error: error.message || 'Failed to fetch metadata' };
  }
}
```

**Benefits**:
- ✅ Proper server action with `'use server'` directive
- ✅ Can be safely called from client components
- ✅ Keeps AI/Express code on the server
- ✅ Returns serializable data

### 2. Updated Client Component
**File**: `src/app/admin/media/components/add-link-button.tsx`

**Before**:
```typescript
import { getLinkMetadata } from '@/ai/flows/get-link-metadata-flow';
// ...
const metadata = await getLinkMetadata({ url: data.url });
```

**After**:
```typescript
import { getLinkMetadataAction } from '@/app/actions/link-metadata-actions';
// ...
const result = await getLinkMetadataAction(data.url);
if (!result.success) {
  // handle error
}
const metadata = result.metadata;
```

### 3. Enhanced Webpack Configuration
**File**: `next.config.ts`

Added webpack configuration to prevent server-only modules from being bundled in client:

```typescript
webpack: (config, { isServer }) => {
  if (!isServer) {
    // Fallback for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      path: false,
      os: false,
    };
    
    // Mark express as external
    config.externals = config.externals || [];
    config.externals.push({
      express: 'commonjs express',
      'express/lib/view': 'commonjs express/lib/view',
    });
  }
  
  return config;
}
```

## Best Practices for Genkit AI in Next.js

### ✅ DO:
1. **Use Server Actions**: Wrap AI flows in server actions with `'use server'`
2. **Keep AI Server-Side**: Never import AI flows directly in client components
3. **Return Serializable Data**: Server actions must return JSON-serializable data
4. **Handle Errors**: Wrap AI calls in try-catch and return error states

### ❌ DON'T:
1. **Direct Import**: Don't import AI flows in `'use client'` components
2. **Client-Side AI**: Don't try to run Genkit AI in the browser
3. **Complex Objects**: Don't return non-serializable objects from server actions
4. **Ignore Boundaries**: Don't mix server and client code without proper separation

## File Structure

```
src/
├── ai/
│   └── flows/
│       └── get-link-metadata-flow.ts    # Server-only AI flow
├── app/
│   ├── actions/
│   │   └── link-metadata-actions.ts     # Server action wrapper ✅
│   └── admin/
│       └── media/
│           └── components/
│               └── add-link-button.tsx  # Client component ✅
└── next.config.ts                        # Webpack config ✅
```

## Testing

After applying the fix:

1. ✅ Build completes without errors
2. ✅ Client components can call AI functionality
3. ✅ No Express code in client bundle
4. ✅ Server actions work correctly
5. ✅ Metadata fetching works as expected

## Related Issues

This pattern should be applied to any other AI flows used in the application:
- `generate-survey-flow.ts`
- `generate-survey-summary-flow.ts`
- `detect-pdf-fields-flow.ts`
- Any future Genkit AI flows

## Verification Commands

```bash
# Build the application
npm run build

# Check for Express in client bundle (should be empty)
grep -r "express" .next/static/chunks/*.js

# Run the application
npm run dev

# Test the add link functionality
# Navigate to /admin/media and click "Add Link"
```

## Additional Notes

- **Genkit AI**: Designed for server-side use with Express
- **Next.js App Router**: Requires strict client/server separation
- **Server Actions**: The recommended way to call server code from client components
- **Webpack Config**: Provides additional safety net for build process

## Impact

- ✅ Build errors resolved
- ✅ Application can be deployed
- ✅ AI functionality preserved
- ✅ Proper architecture maintained
- ✅ No performance impact

**Date Fixed**: March 23, 2026  
**Status**: ✅ Resolved
