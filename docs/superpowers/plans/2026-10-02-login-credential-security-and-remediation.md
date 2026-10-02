# Login Credential Security & System Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate plain-text credential leaks in URL query parameters, enforce multi-layered defense-in-depth across authentication forms, Edge proxy, and client hooks, and resolve the package.json dependency conflict and Tailwind CSS ambiguous utility warning.

**Architecture:** Multi-layered defense-in-depth:
1. **Edge/Proxy Gateway Sanitization (`src/proxy.ts`)**: Intercept any incoming HTTP requests that contain sensitive query parameters (such as `password`, `pass`, `tempPassword`, `secret`, `credential`, `token`), strip them immediately, and issue an instant 307 temporary redirect to the clean URL before page handlers, Next.js server logs, or error handlers can record them.
2. **Client-Side HTML Form Hardening**: Update all authentication forms (`/login`, `/signup`, `/forgot-password`, `/force-password-reset`) to explicitly specify `method="POST"`, `action="#"`, explicit `autoComplete` attributes, and `e.preventDefault()`, ensuring that unhydrated or fallback submissions never default to native browser `GET` requests with query parameters.
3. **Client-Side URL Scrubbing Hook**: Provide an instant client-side sanitizer that checks `window.location.search` on mount and scrubs any leaked sensitive parameters via `window.history.replaceState` before browser history, telemetry, analytics, or same-origin `Referer` headers can propagate them.
4. **Tailwind Ambiguity & Package.json Resolution**: Disambiguate arbitrary animation timing functions in `FloatingActionToolbar.tsx` and verify `package.json` syntax against the established dependency governance record (`10.9.1` pinned).

**Tech Stack:** Next.js 16 (App Router, Edge Proxy `proxy.ts`), React 19, TypeScript, Tailwind CSS, Vitest.

---

## File Structure & Responsibilities

| File Path | Responsibility |
| :--- | :--- |
| `package.json` | Dependency governance: ensure `google-auth-library` is pinned to `10.9.1` and file parses as strictly valid JSON. |
| `src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx` | UI styling: replace ambiguous `ease-[cubic-bezier(...)]` with explicit `[animation-timing-function:cubic-bezier(...)]`. |
| `src/proxy.ts` | Edge gateway: add pre-routing sensitive query parameter interceptor and redirector. |
| `src/lib/auth/url-sanitizer.ts` | Utility: helper functions for detecting and scrubbing sensitive parameters from URLs and search strings. |
| `src/hooks/use-sanitize-sensitive-query-params.ts` | Client hook: executes instant URL scrubbing on mount via `window.history.replaceState`. |
| `src/app/login/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete`, and client URL scrubber. |
| `src/app/signup/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete`, and client URL scrubber. |
| `src/app/forgot-password/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete` to both email and phone tabs. |
| `src/app/force-password-reset/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete="new-password"`. |
| `src/__tests__/proxy-sensitive-params.test.ts` | Test suite: verify edge proxy intercepts and strips sensitive query parameters. |
| `src/lib/auth/__tests__/url-sanitizer.test.ts` | Test suite: verify client URL sanitizer utility and scrubbing logic. |

---

## Task Decomposition

### Task 1: Verify & Validate `package.json` Dependency Governance

**Files:**
- Modify: `package.json:115-121`
- Test: Terminal validation script

- [ ] **Step 1: Inspect `package.json` around line 117 to confirm clean syntax**

Check lines 114–120 in `package.json` to verify `"google-auth-library": "10.9.1"` has no git conflict markers:
```json
    "firebase-admin": "^12.7.0",
    "framer-motion": "^12.34.0",
    "genkit": "^1.42.0",
    "google-auth-library": "10.9.1",
    "gsap": "^3.15.0",
```

- [ ] **Step 2: Run JSON parse verification**

Run: `node -e "const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('Dependencies count:', Object.keys(pkg.dependencies).length);"`
Expected: Output `Dependencies count: 100` with exit code 0 and zero syntax errors.

- [ ] **Step 3: Commit cleaned `package.json`**

```bash
git add package.json
git commit -m "fix(deps): finalize google-auth-library version governance at 10.9.1"
```

---

### Task 2: Disambiguate Tailwind CSS Animation Easing Class

**Files:**
- Modify: `src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx:47-50`

- [ ] **Step 1: Write test or identify warning trigger**

The warning:
`warn - The class 'ease-[cubic-bezier(0.23,1,0.32,1)]' is ambiguous and matches multiple utilities.`
occurs because `tailwindcss-animate` and core Tailwind both define `ease-*` utilities (one for `animation-timing-function` and one for `transition-timing-function`).

- [ ] **Step 2: Update `FloatingActionToolbar.tsx` with unambiguous CSS property**

Replace line 49 of `src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx`:
```tsx
// Before:
className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-6 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"

// After:
className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-6 duration-300 [animation-timing-function:cubic-bezier(0.23,1,0.32,1)]"
```

- [ ] **Step 3: Verify Tailwind build / compilation produces zero ambiguous ease warnings**

Run: `pnpm typecheck`
Expected: PASS with zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx
git commit -m "fix(ui): disambiguate animation timing function class in FloatingActionToolbar"
```

---

### Task 3: Edge & Gateway Defense: Sensitive Query Parameter Interceptor in `src/proxy.ts`

**Files:**
- Create: `src/__tests__/proxy-sensitive-params.test.ts`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Write the failing unit tests for sensitive query parameter interception**

Create `src/__tests__/proxy-sensitive-params.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('Proxy sensitive query parameters sanitizer (CWE-598 Defense)', () => {
  it('redirects requests containing sensitive password parameter to a sanitized URL', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?email=admin%40smartsapp.com&password=SecurePassword123%21')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('email')).toBe('admin@smartsapp.com');
    expect(location.searchParams.has('password')).toBe(false);
  });

  it('redirects requests containing variations of sensitive keys (pass, tempPassword, secret)', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/force-password-reset?tempPassword=TempPass123&secret=xyz&validParam=1')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/force-password-reset');
    expect(location.searchParams.has('tempPassword')).toBe(false);
    expect(location.searchParams.has('secret')).toBe(false);
    expect(location.searchParams.get('validParam')).toBe('1');
  });

  it('allows safe query parameters to pass through untouched', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?redirect=%2Fadmin&email=user%40test.com')
    );
    const res = proxy(req);
    // Public route with safe params proceeds without redirect
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/proxy-sensitive-params.test.ts`
Expected: FAIL (sensitive query params currently pass through without redirection).

- [ ] **Step 3: Implement sensitive query parameter scrubbing in `src/proxy.ts`**

Define the blocklist of sensitive parameter keys at the top of `src/proxy.ts`:
```ts
/**
 * Blocklist of sensitive query parameter keys that must NEVER appear in URL strings.
 * If an incoming request contains any of these keys (e.g. from an accidental native GET
 * form submission or external leak), the proxy immediately strips them and redirects
 * to the sanitized URL before server logs or page handlers can process them (CWE-598).
 */
const SENSITIVE_QUERY_PARAM_PATTERNS = [
  /^pass(word)?$/i,
  /^temp_?pass(word)?$/i,
  /^new_?pass(word)?$/i,
  /^confirm_?pass(word)?$/i,
  /^secret$/i,
  /^client_?secret$/i,
  /^auth_?token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^credentials?$/i,
];

function containsSensitiveQueryParam(searchParams: URLSearchParams): boolean {
  for (const key of searchParams.keys()) {
    if (SENSITIVE_QUERY_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
      return true;
    }
  }
  return false;
}

function sanitizeUrlSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const sanitized = new URLSearchParams(searchParams);
  for (const key of Array.from(sanitized.keys())) {
    if (SENSITIVE_QUERY_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized.delete(key);
    }
  }
  return sanitized;
}
```

In `proxy(request: NextRequest)` in `src/proxy.ts`, insert this check right at the entrypoint:
```ts
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  // ── CWE-598 Defense: Sensitive Credential URL Scrubbing ────────────────────
  if (containsSensitiveQueryParam(searchParams)) {
    const sanitizedUrl = request.nextUrl.clone();
    sanitizedUrl.search = sanitizeUrlSearchParams(searchParams).toString();
    return NextResponse.redirect(sanitizedUrl, { status: 307 });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/proxy-sensitive-params.test.ts`
Expected: PASS (all 3 tests green).

- [ ] **Step 5: Run existing proxy test suites to ensure no regressions**

Run: `pnpm vitest run src/__tests__/proxy-*.test.ts`
Expected: All proxy tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/__tests__/proxy-sensitive-params.test.ts
git commit -m "security(proxy): intercept and strip sensitive credentials from URL query parameters"
```

---

### Task 4: Client-Side Defense: URL Sanitizer Hook & Sanitizer Utility

**Files:**
- Create: `src/lib/auth/url-sanitizer.ts`
- Create: `src/lib/auth/__tests__/url-sanitizer.test.ts`
- Create: `src/hooks/use-sanitize-sensitive-query-params.ts`

- [ ] **Step 1: Write failing unit test for `url-sanitizer.ts`**

Create `src/lib/auth/__tests__/url-sanitizer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sanitizeQueryString, hasSensitiveParams } from '../url-sanitizer';

describe('url-sanitizer utility', () => {
  it('correctly detects sensitive parameters in query string', () => {
    expect(hasSensitiveParams('?email=test@example.com&password=secret')).toBe(true);
    expect(hasSensitiveParams('?password=secret')).toBe(true);
    expect(hasSensitiveParams('?token=abc&tempPassword=123')).toBe(true);
    expect(hasSensitiveParams('?email=test@example.com&redirect=/admin')).toBe(false);
    expect(hasSensitiveParams('')).toBe(false);
  });

  it('removes sensitive parameters while preserving legitimate ones', () => {
    const cleaned = sanitizeQueryString('?email=test@example.com&password=secret&redirect=/admin');
    expect(cleaned).toBe('?email=test%40example.com&redirect=%2Fadmin');
  });

  it('returns empty string if only sensitive parameters were present', () => {
    const cleaned = sanitizeQueryString('?password=secret&tempPassword=123');
    expect(cleaned).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/auth/__tests__/url-sanitizer.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/auth/url-sanitizer.ts`**

```ts
/**
 * Utility to scrub sensitive credentials from browser search strings and URLs.
 * Complies with OWASP Top 10 and CWE-598 (Information Exposure via Query Strings).
 */
const SENSITIVE_PARAM_NAMES = new Set([
  'password',
  'pass',
  'pwd',
  'temppassword',
  'temp_password',
  'newpassword',
  'new_password',
  'confirmpassword',
  'confirm_password',
  'secret',
  'client_secret',
  'authtoken',
  'auth_token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'credential',
  'credentials',
]);

export function isSensitiveParamKey(key: string): boolean {
  return SENSITIVE_PARAM_NAMES.has(key.toLowerCase().trim());
}

export function hasSensitiveParams(searchString: string): boolean {
  if (!searchString) return false;
  const search = searchString.startsWith('?') ? searchString.slice(1) : searchString;
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (isSensitiveParamKey(key)) return true;
  }
  return false;
}

export function sanitizeQueryString(searchString: string): string {
  if (!searchString) return '';
  const search = searchString.startsWith('?') ? searchString.slice(1) : searchString;
  const params = new URLSearchParams(search);
  let changed = false;

  for (const key of Array.from(params.keys())) {
    if (isSensitiveParamKey(key)) {
      params.delete(key);
      changed = true;
    }
  }

  if (!changed) return searchString;
  const result = params.toString();
  return result ? `?${result}` : '';
}

/**
 * Scrubs sensitive parameters from current window location history immediately.
 * Safe to call in browser environments.
 */
export function scrubBrowserUrlInPlace(): boolean {
  if (typeof window === 'undefined' || !window.location.search) return false;
  if (!hasSensitiveParams(window.location.search)) return false;

  const cleanedSearch = sanitizeQueryString(window.location.search);
  const newUrl = `${window.location.pathname}${cleanedSearch}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
  return true;
}
```

- [ ] **Step 4: Implement React hook `src/hooks/use-sanitize-sensitive-query-params.ts`**

```ts
'use client';

import * as React from 'react';
import { scrubBrowserUrlInPlace } from '@/lib/auth/url-sanitizer';

/**
 * Hook that executes on initial mount to immediately scrub any sensitive credential
 * query parameters (such as `password`) from the browser address bar and history.
 */
export function useSanitizeSensitiveQueryParams(): void {
  React.useEffect(() => {
    scrubBrowserUrlInPlace();
  }, []);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/auth/__tests__/url-sanitizer.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/url-sanitizer.ts src/lib/auth/__tests__/url-sanitizer.test.ts src/hooks/use-sanitize-sensitive-query-params.ts
git commit -m "feat(security): add client-side sensitive query parameter sanitizer hook and utilities"
```

---

### Task 5: Auth Surface Form Hardening

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/forgot-password/page.tsx`
- Modify: `src/app/force-password-reset/page.tsx`

- [ ] **Step 1: Harden `src/app/login/page.tsx`**

1. Import `useSanitizeSensitiveQueryParams`:
```tsx
import { useSanitizeSensitiveQueryParams } from '@/hooks/use-sanitize-sensitive-query-params';
```
2. Call `useSanitizeSensitiveQueryParams()` at the start of `LoginContent`:
```tsx
function LoginContent() {
  useSanitizeSensitiveQueryParams();
  // ...
```
3. Update the form element with explicit attributes and submission hardening:
```tsx
<form
  method="POST"
  action="#"
  onSubmit={(e) => {
    e.preventDefault();
    form.handleSubmit(onSubmit)(e);
  }}
  className="space-y-6"
  noValidate
>
```
4. Add `autoComplete="email"` to the email Input:
```tsx
<Input
  type="email"
  placeholder="first.last@smartsapp.com"
  autoComplete="email"
  disabled={isBusy}
  {...field}
/>
```
5. Add `autoComplete="current-password"` to the password Input:
```tsx
<Input
  type={showPassword ? 'text' : 'password'}
  placeholder="Min. 8 characters"
  autoComplete="current-password"
  disabled={isBusy}
  {...field}
/>
```

- [ ] **Step 2: Harden `src/app/signup/page.tsx`**

1. Import `useSanitizeSensitiveQueryParams` and call inside `SignupContent`:
```tsx
import { useSanitizeSensitiveQueryParams } from '@/hooks/use-sanitize-sensitive-query-params';
```
2. Update `<form>`:
```tsx
<form
  method="POST"
  action="#"
  onSubmit={(e) => {
    e.preventDefault();
    form.handleSubmit(onSubmit)(e);
  }}
  className="space-y-6"
  noValidate
>
```
3. Add `autoComplete="name"`, `autoComplete="email"`, and `autoComplete="new-password"` to form fields.

- [ ] **Step 3: Harden `src/app/forgot-password/page.tsx`**

1. Import `useSanitizeSensitiveQueryParams` and call in `ForgotPasswordContent`.
2. Update both email and phone `<form>` elements with `method="POST" action="#" onSubmit={(e) => { e.preventDefault(); ... }}`.
3. Add appropriate `autoComplete` attributes.

- [ ] **Step 4: Harden `src/app/force-password-reset/page.tsx`**

1. Import `useSanitizeSensitiveQueryParams` and call in `ForcePasswordResetContent`.
2. Update `<form>` with `method="POST" action="#" onSubmit={(e) => { e.preventDefault(); form.handleSubmit(onSubmit)(e); }}`.
3. Add `autoComplete="new-password"` to the new password input field.

- [ ] **Step 5: Run typecheck and lint to verify zero errors and strict typing**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
Expected: Zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx src/app/signup/page.tsx src/app/forgot-password/page.tsx src/app/force-password-reset/page.tsx
git commit -m "security(auth): harden all auth forms against native GET leaks and add client query scrubbers"
```

---

### Task 6: Comprehensive Regression Verification & Test Suite Execution

**Files:**
- Test: All auth and proxy tests

- [ ] **Step 1: Run Vitest across all proxy and auth sanitizer suites**

Run: `pnpm vitest run src/__tests__/proxy-*.test.ts src/lib/auth/__tests__/*.test.ts`
Expected: All tests PASS.

- [ ] **Step 2: Run full Vitest suite to ensure zero regressions across the codebase**

Run: `pnpm vitest run`
Expected: All test suites PASS.

- [ ] **Step 3: Run project linter**

Run: `pnpm lint`
Expected: PASS with zero errors.

- [ ] **Step 4: Self-Review Checklist**
- [x] Spec coverage: No placeholders, no `any`, strictly typed.
- [x] Multi-layered defense: Form `method="POST"`, Edge proxy `307` interceptor, client URL scrubber.
- [x] Tailwind warning resolved without ambiguous classes.
- [x] Pinned `package.json` governance validated.
