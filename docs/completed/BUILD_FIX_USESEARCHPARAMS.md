# Build Fix: useSearchParams Suspense Boundary

## Problem

Build was failing with error:
```
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/admin/activities"
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/admin/surveys"
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/admin/messaging/scheduled"
```

## Root Cause

The `TenantContext` uses `useSearchParams()` to read the `track` query parameter for workspace switching:

```typescript
// src/c