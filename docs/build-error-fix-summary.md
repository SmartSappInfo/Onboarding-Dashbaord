# Build Error Fix Summary

## Issue
Next.js build was failing with the error:
```
Only async functions are allowed to be exported in a "use server" file.
./src/lib/template-resolver.ts:25:1
export { renderTemplate } from './template-utils';
```

## Root Cause
The `template-resolver.ts` file has the `'use server'` directive, which means it can only export async functions (Server Actions). The `renderTemplate` function is synchronous, so re-exporting it from this file violated Next.js Server Actions constraints.

## Solution

### 1. Removed Re-export
Removed the re-export statement from `template-resolver.ts`:
```typescript
// REMOVED:
export { renderTemplate } from './template-utils';
```

Added a comment explaining where to import `renderTemplate` from:
```typescript
// Note: renderTemplate is available from './template-utils' (not re-exported here due to 'use server' constraints)
```

### 2. Updated Import Statements
Updated all files that were importing `renderTemplate` from `template-resolver` to import it from `template-utils` instead:

**Files Updated:**
- `src/app/(backoffice)/backoffice/messaging/templates/[id]/EditTemplateClient.tsx`
- `src/lib/__tests__/template-resolver.test.ts`

**Before:**
```typescript
import { renderTemplate } from '@/lib/template-resolver';
```

**After:**
```typescript
import { renderTemplate } from '@/lib/template-utils';
```

## Architecture

The template system is now properly split into two modules:

### `template-utils.ts` (Pure Utilities)
- **No** `'use server'` directive
- Contains synchronous utility functions
- Can be imported in both client and server components
- Exports: `renderTemplate`, `extractVariables`, `validateTemplateVariables`, etc.

### `template-resolver.ts` (Server Actions)
- **Has** `'use server'` directive
- Contains async functions that query Firestore
- Only usable in server components and server actions
- Exports: `resolveTemplateForOrg`, `buildVariableMap`, `resolveAndRender`
- Imports `renderTemplate` internally but doesn't re-export it

## Verification

### TypeScript Check
```bash
pnpm typecheck
# ✅ Exit Code: 0 (No errors)
```

### ESLint Check
```bash
pnpm lint
# ✅ Exit Code: 0 (Only warnings about unused variables, which are allowed)
```

### Unit Tests
```bash
pnpm test:run src/lib/__tests__/template-utils.test.ts src/lib/__tests__/template-resolver.test.ts
# ✅ 55 tests passed (37 + 18)
```

## Impact

### Breaking Changes
None - this is a transparent fix. Code that was importing `renderTemplate` from `template-resolver` has been updated to import from `template-utils`.

### Future Considerations
When importing template functions:
- Import `renderTemplate` and other sync utilities from `@/lib/template-utils`
- Import `resolveTemplateForOrg`, `buildVariableMap`, `resolveAndRender` from `@/lib/template-resolver`

## Related Documentation
- [Template System Architecture](./template-system-architecture.md)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
