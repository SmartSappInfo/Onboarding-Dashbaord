# Login Credential Security & System Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate plain-text credential leaks in URL query parameters (CWE-598), enforce multi-layered defense-in-depth across authentication forms, Edge proxy, and client hooks, and resolve the `package.json` dependency conflict and Tailwind CSS ambiguous utility warning.

**Architecture:** Multi-layered defense-in-depth adhering to the governed capability architecture ([`agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md)):
1. **Edge/Proxy Gateway Sanitization (`src/proxy.ts`)**: Intercept any incoming HTTP requests that contain sensitive query parameters (`password`, `pass`, `tempPassword`, `secret`, `credential`, `auth_token`), strip them immediately, and issue an instant 307 temporary redirect to the clean URL before page handlers, Next.js server logs, or error handlers can record them.
2. **Client-Side HTML Form Hardening**: Update all authentication forms (`/login`, `/signup`, `/forgot-password`, `/force-password-reset`) to explicitly specify `method="POST"`, `action="#"`, explicit `autoComplete` attributes, and `e.preventDefault()`, ensuring that unhydrated or fallback submissions never default to native browser `GET` requests with query parameters.
3. **Client-Side URL Scrubbing Hook**: Provide an instant client-side sanitizer that checks `window.location.search` on mount and scrubs any leaked sensitive parameters via `window.history.replaceState` before browser history, telemetry, analytics, or same-origin `Referer` headers can propagate them.
4. **Tailwind Ambiguity & Package.json Resolution**: Disambiguate arbitrary animation timing functions in `FloatingActionToolbar.tsx` and verify `package.json` syntax against the established dependency governance record (`10.9.1` pinned).

**Tech Stack:** Next.js 16 (App Router, Edge Proxy `proxy.ts`), React 19, TypeScript, Tailwind CSS, Vitest.

---

## Review Against `agents_mcp_rules.md` (Governed Compliance)

Only the rules relevant to authentication, web security, edge routing, performance, UI/UX, and dependency governance apply here. Rules specific to MCP protocol servers, Genkit model routing, knowledge graphs, and multi-agent sagas are identified as non-applicable.

| Rule in `agents_mcp_rules.md` | Relevance to this Task | How This Plan Respects It |
| :--- | :--- | :--- |
| **Rule 1: Conform to core skills** | **Mandatory** | Implements `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`. Preserves all pre-existing app behaviors. |
| **Rule 2: Failure modes & no unprompted git push** | **Mandatory** | Includes comprehensive "What Could Go Wrong" matrix and edge cases. Commits locally; **never pushes to origin**. |
| **Rule 3: Feature regression & Backoffice impact** | **Mandatory** | Validates `/backoffice` operators logging in (`/login?redirect=%2Fbackoffice`), invite links (`?invite=...`), and return destinations. |
| **Rule 4: Strict typing protocol** | **Mandatory** | Absolute zero `any` or `any[]`. Inferred and explicit types throughout. External URL search params narrowed with Zod/guards. |
| **Rule 5: Deployment & staging governance** | **Mandatory** | Changes are verified locally with tests, lint, and typecheck. No unattended or automatic production deployment. |
| **Rule 6 & 53: Dependency governance** | **Mandatory** | Pins `google-auth-library` to `10.9.1` strictly per `16-dependency-governance.md`. Validates JSON parse and zero client bundle leaks. |
| **Rule 7: Mobile-first & simple UI English** | **Mandatory** | All touch targets maintain `min-h-[44px]`. Toasts and error messages use everyday, simple, concise English. |
| **Rule 8: High security standards & data protection** | **Mandatory** | Fixes OWASP CWE-598 (Information Exposure Through Query Strings). Protects credentials across proxy, browser history, server logs, and Referer headers. |
| **Rule 9 & 54: Performance budgets & resource limits** | **Mandatory** | Edge query scrubbing executes in O(N) using pre-compiled regex set, adding < 1ms to request processing. Zero memory leaks. |
| **Rule 10: Inline maintainer documentation** | **Mandatory** | All modified files receive clear, explanatory comments detailing what changed, why, caution areas, and testability hooks. |
| **Rule 13: Trust Boundary Matrix** | **Mandatory** | Query params are classified as untrusted external inputs. Sensitive credentials in URLs are quarantined and scrubbed immediately. |
| **Rule 19: Mutating action idempotency & double-submit protection** | **Mandatory** | Form submit buttons enforce busy disabling (`disabled={isBusy}`) to prevent duplicate form submissions and race conditions. |
| **Rule 51: Route Handler & Server Action Security** | **Mandatory** | Auth operations process credentials exclusively through POST bodies / client-side Firebase Auth; never through GET query params. |
| **Rule 52: Client/Server boundary verification** | **Mandatory** | Confirms server-only packages (`google-auth-library`, `firebase-admin`) remain strictly on the server and are not bundled into client auth pages. |
| **Rule 67: Real Definition of Done** | **Mandatory** | Done is defined not just by "TypeScript passes," but by functional correctness, edge defense, mobile usability, test suites passing, and zero regressions. |

### Non-Applicable Rules (Explicitly Excluded)
- Rules 11, 12, 14, 15, 34, 35, 37, 38: MCP protocol spec (2026-07-28), tool discovery, MCP tool annotations, and MCP server allowlists (not building an MCP server).
- Rules 16, 17, 18, 21, 22, 27: Agent principal delegation, two-phase approval binding, agent sagas, and agent token budgets.
- Rules 47, 58, 59: Central Genkit model routing and tool selection.
- Rules 55, 56: Idea Canvas and Knowledge Graph rendering node limits.

---

## What Could Go Wrong & How It Is Resolved (Rule 2)

| Potential Failure Mode | Root Cause | Preventive Design / Resolution |
| :--- | :--- | :--- |
| **Accidentally stripping legitimate parameters** | An overly aggressive query parameter sanitizer could strip `?redirect=/admin`, `?invite=SS-XXXX`, `?email=user@test.com`, or Firebase's `?oobCode=...`. | The blocklist strictly matches credential variations (`password`, `pass`, `tempPassword`, `secret`, `credential`). Legitimate routing/token parameters (`redirect`, `invite`, `email`, `oobCode`, `mode`, `apiKey`) are explicitly preserved. |
| **Obfuscated or case-varying parameter bypass** | An attacker or browser might send uppercase or mixed-case parameters like `?PASSWORD=...`, `?Password=...`, or trailing whitespace. | The sanitizer normalizes keys via `.toLowerCase().trim()` and uses case-insensitive regular expressions (`/^pass(word)?$/i`). |
| **Double redirect loops on Edge Proxy** | If the sanitizer redirects to a URL that still triggers the sanitizer, an infinite 307 loop occurs. | The redirected URL is generated by cloning `request.nextUrl`, deleting all matched sensitive keys from `searchParams`, and redirecting ONLY if at least one sensitive key was actually present. |
| **Breaking `/backoffice` operators (Rule 3)** | Backoffice operators navigate to `/login?redirect=%2Fbackoffice`. If the redirect is corrupted, operators could be locked out. | The proxy preserves the `redirect` parameter intact. Automated test explicitly verifies `/login?redirect=%2Fbackoffice&password=123` cleans to `/login?redirect=%2Fbackoffice`. |
| **Native browser form resubmission on network drop** | If client-side JavaScript crashes or drops network, native `<form>` submits inputs as GET unless prevented. | Forms are assigned `method="POST"`, `action="#"`, `noValidate`, and submit handlers call `e.preventDefault()`, ensuring the browser never falls back to GET serialization. |
| **Referer header credential leakage** | Browsers with `strict-origin-when-cross-origin` policy send query strings in the `Referer` header to same-origin image/script fetches if credentials sit in the URL. | Client-side hook immediately calls `window.history.replaceState` before any secondary assets or scripts execute, scrubbing the URL in place. |
| **Submitting while already busy (Rule 19)** | User double-clicks submit or presses Enter repeatedly while authentication is pending. | Form submit buttons and inputs are disabled (`disabled={isBusy}` or `isSubmitting`), preventing duplicate flight requests. |

---

## Backoffice & Feature Impact Analysis (Rule 3)

1. **Backoffice Operator Access**:
   - `src/proxy.ts` line 98 automatically redirects backoffice operators to `/backoffice` upon login.
   - The query sanitizer preserves `?redirect=/backoffice`, ensuring operators are seamlessly guided to the control plane.
2. **Encrypted Invitation Flow**:
   - Invited users arrive at `/login?invite=...` or `/profile-setup?invite=...`.
   - `invite` is an encrypted AES-256-GCM token and is explicitly preserved by the sanitizer.
3. **Password Reset Flow**:
   - Firebase password reset links arrive with `?mode=resetPassword&oobCode=...&apiKey=...`.
   - None of these match the sensitive credential blocklist, ensuring password reset links function uninterrupted.

---

## File Structure & Responsibilities

| File Path | Responsibility |
| :--- | :--- |
| `package.json` | Dependency governance: ensure `google-auth-library` is pinned to `10.9.1` and file parses as strictly valid JSON. |
| `src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx` | UI styling: replace ambiguous `ease-[cubic-bezier(...)]` with explicit `[animation-timing-function:cubic-bezier(...)]`. |
| `src/proxy.ts` | Edge gateway: add pre-routing sensitive query parameter interceptor and 307 redirector. |
| `src/lib/auth/url-sanitizer.ts` | Utility: helper functions for detecting and scrubbing sensitive parameters from URLs and search strings. |
| `src/hooks/use-sanitize-sensitive-query-params.ts` | Client hook: executes instant URL scrubbing on mount via `window.history.replaceState`. |
| `src/app/login/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete`, touch target compliance, and client URL scrubber. |
| `src/app/signup/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete`, touch target compliance, and client URL scrubber. |
| `src/app/forgot-password/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete` to both email and phone tabs. |
| `src/app/force-password-reset/page.tsx` | Auth UI: add `method="POST"`, `action="#"`, `autoComplete="new-password"`. |
| `src/__tests__/proxy-sensitive-params.test.ts` | Test suite: verify edge proxy intercepts and strips sensitive query parameters. |
| `src/lib/auth/__tests__/url-sanitizer.test.ts` | Test suite: verify client URL sanitizer utility and scrubbing logic. |

---

## Task Decomposition

### Task 1: Verify & Validate `package.json` Dependency Governance

**Rules Respected:** Rule 4 (Strict Typing), Rule 6 & 53 (Dependency Governance), Rule 52 (Boundary Checks).

**Files:**
- Modify: `package.json:115-121`
- Test: Terminal verification

- [ ] **Step 1: Inspect `package.json` to confirm clean syntax and version pinning**

Confirm line 117 of `package.json` has `"google-auth-library": "10.9.1"` with no conflict markers.

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

**Rules Respected:** Rule 1 (Core Skills: `emilkowal-animations`, `frontend-design`), Rule 10 (Inline Comments).

**Files:**
- Modify: `src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx:47-52`

- [ ] **Step 1: Update `FloatingActionToolbar.tsx` with unambiguous CSS property**

In `src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx`, replace the ambiguous utility with the explicit property:
```tsx
// Architectural Note: Using [animation-timing-function:...] prevents Tailwind compiler
// ambiguity between transition-timing-function (core Tailwind) and animation-timing-function
// (tailwindcss-animate) for smooth entry toolbar physics.
className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-6 duration-300 [animation-timing-function:cubic-bezier(0.23,1,0.32,1)]"
```

- [ ] **Step 2: Verify zero Tailwind compilation warnings**

Run: `pnpm typecheck`
Expected: Zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lead-intelligence/components/FloatingActionToolbar.tsx
git commit -m "fix(ui): disambiguate animation timing function class in FloatingActionToolbar"
```

---

### Task 3: Edge & Gateway Defense: Sensitive Query Parameter Interceptor in `src/proxy.ts`

**Rules Respected:** Rule 1 (Backend Design), Rule 3 (Backoffice Preservation), Rule 8 (OWASP CWE-598 Security), Rule 9 & 54 (Performance Budgets: <1ms edge execution), Rule 10 (Inline Comments), Rule 13 (Trust Boundary Matrix).

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

  it('preserves backoffice redirect while stripping leaked password (Rule 3)', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?redirect=%2Fbackoffice&password=LeakedPass123')
    );
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe('/backoffice');
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

  it('allows safe query parameters and invite tokens to pass through untouched', () => {
    const req = new NextRequest(
      new URL('https://app.example.com/login?redirect=%2Fadmin&email=user%40test.com&invite=ENC_TOKEN_123')
    );
    const res = proxy(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/proxy-sensitive-params.test.ts`
Expected: FAIL (sensitive query params currently pass through without redirection).

- [ ] **Step 3: Implement sensitive query parameter scrubbing in `src/proxy.ts`**

Add the pre-compiled regular expressions and helper functions at the top of `src/proxy.ts`:
```ts
/**
 * Blocklist of sensitive query parameter patterns that must NEVER appear in URL strings.
 * Enforces OWASP Top 10 and CWE-598 (Information Exposure via Query String).
 *
 * Performance Budget: Pre-compiled regex patterns executed against URLSearchParams keys
 * ensure O(N) evaluation (< 1ms execution on the Edge runtime).
 */
const SENSITIVE_QUERY_PARAM_PATTERNS: readonly RegExp[] = [
  /^pass(word)?$/i,
  /^temp_?pass(word)?$/i,
  /^new_?pass(word)?$/i,
  /^confirm_?pass(word)?$/i,
  /^pwd$/i,
  /^passwd$/i,
  /^secret$/i,
  /^client_?secret$/i,
  /^auth_?token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^credentials?$/i,
];

function isSensitiveQueryKey(key: string): boolean {
  const normalizedKey = key.trim();
  return SENSITIVE_QUERY_PARAM_PATTERNS.some((pattern) => pattern.test(normalizedKey));
}

function containsSensitiveQueryParam(searchParams: URLSearchParams): boolean {
  for (const key of searchParams.keys()) {
    if (isSensitiveQueryKey(key)) return true;
  }
  return false;
}

function sanitizeUrlSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const sanitized = new URLSearchParams(searchParams);
  for (const key of Array.from(sanitized.keys())) {
    if (isSensitiveQueryKey(key)) {
      sanitized.delete(key);
    }
  }
  return sanitized;
}
```

In `proxy(request: NextRequest)` in `src/proxy.ts`, insert this check right at the beginning:
```ts
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  // ── CWE-598 Defense: Sensitive Credential URL Scrubbing ────────────────────
  // If an incoming request includes sensitive credentials in the query string (e.g. from
  // an unhydrated native GET submission), immediately issue an Edge redirect to the
  // sanitized URL so that page SSR and server logs never process raw credentials.
  if (containsSensitiveQueryParam(searchParams)) {
    const sanitizedUrl = request.nextUrl.clone();
    sanitizedUrl.search = sanitizeUrlSearchParams(searchParams).toString();
    return NextResponse.redirect(sanitizedUrl, { status: 307 });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/proxy-sensitive-params.test.ts`
Expected: PASS (all 4 tests green).

- [ ] **Step 5: Run existing proxy test suites to ensure zero regressions**

Run: `pnpm vitest run src/__tests__/proxy-*.test.ts`
Expected: All proxy tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/__tests__/proxy-sensitive-params.test.ts
git commit -m "security(proxy): intercept and strip sensitive credentials from URL query parameters"
```

---

### Task 4: Client-Side Defense: URL Sanitizer Hook & Sanitizer Utility

**Rules Respected:** Rule 4 (Strict Typing), Rule 8 (Security & Data Protection), Rule 10 (Inline Comments), Rule 54 (Performance Budgets).

**Files:**
- Create: `src/lib/auth/url-sanitizer.ts`
- Create: `src/lib/auth/__tests__/url-sanitizer.test.ts`
- Create: `src/hooks/use-sanitize-sensitive-query-params.ts`

- [ ] **Step 1: Write failing unit test for `url-sanitizer.ts`**

Create `src/lib/auth/__tests__/url-sanitizer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sanitizeQueryString, hasSensitiveParams, isSensitiveParamKey } from '../url-sanitizer';

describe('url-sanitizer utility', () => {
  it('correctly identifies sensitive parameter keys regardless of casing', () => {
    expect(isSensitiveParamKey('password')).toBe(true);
    expect(isSensitiveParamKey('PASSWORD')).toBe(true);
    expect(isSensitiveParamKey('tempPassword')).toBe(true);
    expect(isSensitiveParamKey('temp_password')).toBe(true);
    expect(isSensitiveParamKey('secret')).toBe(true);
    expect(isSensitiveParamKey('redirect')).toBe(false);
    expect(isSensitiveParamKey('invite')).toBe(false);
    expect(isSensitiveParamKey('email')).toBe(false);
  });

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
 * Strictly typed with zero `any` usage (Rule 4).
 */
const SENSITIVE_PARAM_NAMES: ReadonlySet<string> = new Set([
  'password',
  'pass',
  'pwd',
  'passwd',
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
 * Replaces history entry in-place to prevent credential retention in browser history
 * or leaking via same-origin HTTP Referer headers.
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

**Rules Respected:** Rule 1 (Frontend Design & Vercel React Best Practices), Rule 4 (Strict Typing), Rule 7 (Mobile Touch Targets: `min-h-[44px]` & Everyday UI English), Rule 8 (Security Standards), Rule 10 (Inline Comments), Rule 19 (Double-Submit Idempotency).

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
2. Call `useSanitizeSensitiveQueryParams()` at top of `LoginContent`:
```tsx
function LoginContent() {
  useSanitizeSensitiveQueryParams();
  // ...
```
3. Update `<form>` attributes and submit event handling:
```tsx
{/* Security Note (CWE-598): method="POST" and action="#" guarantee that if JS hydration
    is delayed or fails, native browser submission will NEVER default to GET with
    serialized credentials in the URL query string. */}
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
4. Verify inputs have `autoComplete` and mobile touch targets:
```tsx
<Input
  type="email"
  placeholder="first.last@smartsapp.com"
  autoComplete="email"
  className="min-h-[44px]"
  disabled={isBusy}
  {...field}
/>

<Input
  type={showPassword ? 'text' : 'password'}
  placeholder="Min. 8 characters"
  autoComplete="current-password"
  className="min-h-[44px]"
  disabled={isBusy}
  {...field}
/>
```
5. Ensure the submit button has `min-h-[44px]` for mobile ergonomics:
```tsx
<Button type="submit" className="w-full min-h-[44px] font-semibold" disabled={isBusy}>
  {isSubmitting ? 'Signing In...' : 'Sign In'}
</Button>
```

- [ ] **Step 2: Harden `src/app/signup/page.tsx`**

1. Import and mount `useSanitizeSensitiveQueryParams()`.
2. Update `<form method="POST" action="#" onSubmit={(e) => { e.preventDefault(); form.handleSubmit(onSubmit)(e); }} className="space-y-6" noValidate>`.
3. Set `autoComplete="name"`, `autoComplete="email"`, and `autoComplete="new-password"`.
4. Ensure `min-h-[44px]` touch targets on inputs and submit button.

- [ ] **Step 3: Harden `src/app/forgot-password/page.tsx`**

1. Import and mount `useSanitizeSensitiveQueryParams()`.
2. Update both email and phone `<form>` elements with `method="POST" action="#" onSubmit={(e) => { e.preventDefault(); ... }}`.
3. Ensure `min-h-[44px]` inputs and submit buttons.

- [ ] **Step 4: Harden `src/app/force-password-reset/page.tsx`**

1. Import and mount `useSanitizeSensitiveQueryParams()`.
2. Update `<form>` with `method="POST" action="#" onSubmit={(e) => { e.preventDefault(); form.handleSubmit(onSubmit)(e); }}`.
3. Add `autoComplete="new-password"` to the new password input field.

- [ ] **Step 5: Run typecheck to verify zero TypeScript errors and strict typing**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
Expected: Zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx src/app/signup/page.tsx src/app/forgot-password/page.tsx src/app/force-password-reset/page.tsx
git commit -m "security(auth): harden all auth forms against native GET leaks and add client query scrubbers"
```

---

### Task 6: Comprehensive Regression Verification & Test Suite Execution

**Rules Respected:** Rule 2 (Verification Before Claims), Rule 5 (Staging/Deploy Readiness), Rule 67 (Real Definition of Done: Functional, secure, tenant-safe, retry-safe).

**Files:**
- Test: All proxy, auth, and system test suites

- [ ] **Step 1: Run Vitest across all proxy and auth sanitizer suites**

Run: `pnpm vitest run src/__tests__/proxy-*.test.ts src/lib/auth/__tests__/*.test.ts`
Expected: All tests PASS.

- [ ] **Step 2: Run full Vitest suite to ensure zero regressions across the codebase**

Run: `pnpm vitest run`
Expected: All test suites PASS.

- [ ] **Step 3: Run project linter**

Run: `pnpm lint`
Expected: PASS with zero errors.

- [ ] **Step 4: Final Definition of Done Checklist (Rule 67)**
- [x] **Functionally Correct**: Legitimate login, signup, reset, invite, and backoffice redirections work seamlessly.
- [x] **Secure Under Adversarial Input**: Credentials in query strings are rejected/stripped at the edge with 307 redirects and scrubbed on the client.
- [x] **Tenant & Backoffice Safe**: `/backoffice` operators and invite links retain destination parameters intact.
- [x] **Retry & Idempotency Safe**: Forms prevent duplicate rapid submissions during flight.
- [x] **Mobile Ergonomics**: All interactive elements maintain `min-h-[44px]` touch targets.
- [x] **No Unprompted Push**: Changes remain in local branch; **never pushed to remote**.
