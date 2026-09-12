# Backoffice Deployment Isolation — Implementation Plan

> **For agentic workers:** implement task-by-task, in order. Steps use checkbox (`- [ ]`)
> syntax for tracking. Do not skip the "run it and watch it fail" steps — they are what
> prove the test is real. Do not push to origin until explicitly asked.

**Goal:** serve the backoffice control plane from `goadmin.smartsapp.com` and the client
application from `go.smartsapp.com` as two independent deployments, without any interruption
to the client app.

**Architecture:** two Firebase App Hosting backends built from the same repository,
separated by hostname via an `APP_SURFACE` environment variable read in `src/proxy.ts`.
Every stage before the last is additive and cannot affect the live client app. A runtime
control plane in Firestore lets operators change messaging and surface behaviour from the
backoffice UI without a deploy.

**Tech stack:** Next.js 16 (App Router, Turbopack), Firebase App Hosting (Cloud Run),
Firestore, Firebase Auth custom claims, Vitest, `@firebase/rules-unit-testing`.

**Hard constraint:** `go.smartsapp.com` stays up throughout. The backoffice may be down for
the duration.

---

## Progress tracker

| Stage | Scope | Client risk | Status |
| --- | --- | --- | --- |
| **A** | Outbound kill switch + runtime controls + staging backend | None (additive) | ☑ **Code complete** — console step A6.7 pending |
| **B** | Backoffice backend + `goadmin` domain | None (additive) | ☑ **Config committed** — console steps B2-B5 pending |
| **C** | Hostname gating + public-origin pin | **Yes — the only client-affecting stage** | ☑ **Code complete** — deploy + verify pending |
| **D** | True build isolation — **now the priority: the deploy build is failing** | Medium | ☐ Not started |

Update this table as stages land. A stage is only "done" when its verification block passes.

---

## Ground rules for this work

These apply to every task below. They are repeated here so an engineer reading a single
task does not have to reconstruct them.

1. **No `any` / `any[]`.** Use inferred module types (`Awaited<ReturnType<typeof fn>>`,
   `Parameters<typeof fn>[0]`) so signatures cannot drift.
   *One deliberate exception:* `catch (e: unknown)` is the correct TypeScript form and is
   already the codebase standard after audit F11. Narrow immediately with the existing
   helpers in `src/lib/errors/report-error.ts` — never widen back to `any`.
2. **No raw code, HTML tags, JSON or stack traces rendered in the UI.** Operator-facing
   copy is plain, short, everyday English.
3. **Reuse before adding.** The helpers this plan needs mostly exist:
   `requireAuth` / `requireWorkspace` / `authorizeBackofficeSession`, `reportError` /
   `getErrorMessage`, `getBaseUrl` / `getRequestBaseUrl`. Extend them; do not fork them.
4. **Mobile first.** The backoffice is used from phones during incidents. Controls must work
   at 360 px wide, with 44 px minimum touch targets and no horizontal page scroll.
5. **Comment the "why", not the "what".** Every guard added by this plan carries a comment
   explaining what breaks without it, so a future reader does not delete it as noise.
6. **Latest docs only.** Verify Firebase and Next.js behaviour against current documentation
   (Context7) before relying on it. Do not trust recalled API shapes.

---

## Architecture decisions

### AD-1 — Two backends from one codebase, not a monorepo split (yet)

App Hosting supports several backends per repository, each with its own custom domain and
its own `apphosting.<ENVIRONMENT_NAME>.yaml`. That gives separate Cloud Run services,
independent scaling and independent rollouts without restructuring the repo while the
client app is live.

Measured coupling, which is what makes this safe:

| Fact | Value |
| --- | --- |
| Backoffice UI | `src/app/(backoffice)/`, 128 files, ~30.6k LOC |
| Imports **out of** the backoffice UI into shared code | **0** |
| Client files importing `src/lib/backoffice/*` | 37 |
| — of those importing only `backoffice-auth` | 34 |

The UI is a leaf. A true build split (Stage D) is worth doing later for build time, but it
requires resolving those 37 imports and is the wrong first move.

### AD-2 — `APP_SURFACE` env var, not a hostname allowlist in code

Gating on an environment variable rather than a hardcoded hostname means the same image
behaves correctly in staging, preview and production, and the behaviour is revertible by
changing configuration rather than shipping code.

### AD-3 — Env var is a hard floor; Firestore is the operator control

`ALLOW_OUTBOUND_MESSAGING=false` (set on staging) can **never** be re-enabled from the UI.
The Firestore control document can only ever *further restrict* sending. This ordering is
deliberate: a misconfigured console click must not be able to turn a staging environment
into one that messages real customers.

### AD-4 — Guard at the provider boundary, not in the messaging engine

The five outbound functions are the last point before a network call to a provider. Guarding
there means any current or future call path is covered, including ones this plan has not
seen. Guarding in `messaging-engine.ts` alone would miss `bulk-upload-actions.ts`, which
resolves its own per-org keys.

---

## Risk register

Ordered by expected cost. Each row has a concrete mitigation implemented by a task below.

| # | Risk | Why it happens | Mitigation | Task |
| --- | --- | --- | --- | --- |
| R1 | **Customer emails/SMS contain `goadmin.smartsapp.com` links** | `getRequestBaseUrl()` returns the *current request host*; it builds customer-facing URLs in `messaging-engine` (8 sites), `reminder-actions` (3), `unsubscribe-service`, and the meeting actions | Pin `PUBLIC_APP_ORIGIN` and prefer it whenever `APP_SURFACE !== 'client'` | C1 |
| R2 | **Staging sends real messages to real customers** | Per-org provider keys live in Firestore (`org.mnotifyApiKey`, `org.resendApiKey`), which staging shares — omitting env secrets is not enough | Outbound kill switch at all five provider boundaries | A1–A3 |
| R3 | **Sign-in silently fails on the new domain** | Firebase Auth rejects origins not in its authorized-domains list | Explicit console step, verified before the domain is announced | B4 |
| R4 | **Operators locked out of the backoffice** | Session cookie is host-only, so a `go.` session does not carry to `goadmin.` | Expected and documented; operators sign in again. **Do not** widen the cookie to `.smartsapp.com` | B5 |
| R5 | **Public pages break for anonymous visitors** | Rules or gating changes accidentally catch public routes (`/surveys`, `/forms`, `/q/`, `/invoice`) | Gating is an allowlist of protected prefixes; emulator rules tests cover anonymous access | C2, E2 |
| R6 | **Config read on every send adds latency / a new failure mode** | Naive implementation reads Firestore per message | 30-second in-process cache, fail-open to env value on read error | A4 |
| R7 | **Cron double-runs against both backends** | Both backends serve `/api/cron/*` | Staging omits `CRON_SECRET` (route returns 500); backoffice backend gates cron paths off | A2, C2 |
| R8 | **A stale rollout re-enables sending on staging** | Env var dropped during a config edit | Kill switch defaults to *allow*, so staging protection is asserted by a test, not assumed | A5 |

---

## Blast radius — what else this touches

Everything below was found by reading the code, not assumed.

| Area | Effect | Handled by |
| --- | --- | --- |
| **Outbound messaging** | Any send from a non-client surface must be blocked or re-based | A1–A3, C1 |
| **Short links `/go/[linkId]`** | Uses `getRequestBaseUrl()`; a link resolved on `goadmin` would redirect through the admin host | C1 |
| **Unsubscribe links** | Generated via `getRequestBaseUrl()`; a wrong origin breaks legal unsubscribe | C1 |
| **Meeting join links** | Same helper, in three meeting action files | C1 |
| **Cron `/api/cron/process-scheduled-messages`** | Must run on exactly one surface | A2, C2 |
| **Webhooks** (`/api/webhooks/*`) | Providers post to a fixed URL; must keep pointing at the client backend | C2 (no redirect for `/api`) |
| **Chrome extension routes** | `Access-Control-Allow-Origin: *`, token-authenticated — unaffected, but must not be redirected | C2 |
| **Firebase Auth authorized domains** | New origin must be registered | B4 |
| **QR short paths `/q/[shortPath]`** | Public, anonymous, host-derived — must stay on the client origin | C1, C2 |
| **Backoffice FER/migration actions** | Call `authorizeBackofficeSession`; they execute on whichever backend serves the UI, so they follow the backoffice | No change needed |
| **`/admin/media` auto-backfill** | Already fails silently for non-backoffice admins (audit Phase 4a) | No change; documented |

---

## Backoffice enhancement — operating this without touching code

**Requirement:** an operator must be able to see and control this feature from the
backoffice, with no deploy.

**New page:** `/backoffice/operations/platform-controls`

It shows, in plain language:

- **Which surface am I on?** — `client` or `backoffice`, read from the server.
- **Is outbound messaging on?** — with the reason and who last changed it.
- **A pause switch** — "Pause all outbound messages", with a required short reason.

Design constraints (mobile-first, per ground rule 4):

- Single column at 360 px; controls stack, nothing scrolls sideways.
- The pause switch is a large toggle with a 44 px target, not a small checkbox.
- State is shown as a coloured status pill with words — "Sending is paused" — never a raw
  boolean, JSON, or an environment-variable name.
- Changing the switch asks for confirmation, because it affects live customer messaging.
- Motion is limited to a short cross-fade on state change. No animation on the status pill
  itself: an operator checking status during an incident should not have to wait for it.

**Authority model:** the page is gated by `authorizeBackofficeSession('settings', 'edit')`,
so it follows the existing backoffice role matrix. The env var remains a hard floor the UI
cannot override (AD-3), so this page can pause sending but can never enable it on staging.

---

## File structure

| File | Responsibility | Status |
| --- | --- | --- |
| `src/lib/platform/app-surface.ts` | Reads and validates `APP_SURFACE` / `PUBLIC_APP_ORIGIN`. Single source of truth. | Create |
| `src/lib/platform/outbound-guard.ts` | The kill switch: env floor + cached Firestore control. | Create |
| `src/lib/platform/__tests__/outbound-guard.test.ts` | Unit tests for the guard. | Create |
| `src/lib/platform/platform-controls-actions.ts` | Server actions for the backoffice page. | Create |
| `src/lib/resend-service.ts` | Guard `sendEmail`, `sendBatchEmails`. | Modify |
| `src/lib/mnotify-service.ts` | Guard `sendSms`. | Modify |
| `src/lib/onesignal-service.ts` | Guard `sendPushNotification`. | Modify |
| `src/lib/whatsapp/whatsapp-send.ts` | Guard `sendWhatsApp`. | Modify |
| `src/lib/utils/url-helpers.ts` | Pin public origin off the client surface. | Modify |
| `src/proxy.ts` | Hostname/surface gating. | Modify |
| `src/app/(backoffice)/backoffice/operations/platform-controls/page.tsx` | Operator UI. | Create |
| `apphosting.staging.yaml` | Staging config — no sending secrets. | Create |
| `apphosting.backoffice.yaml` | Backoffice backend config. | Create |
| `apphosting.yaml` | Add `APP_SURFACE=client`, `PUBLIC_APP_ORIGIN`. | Modify |
| `firestore.rules` | Rules for `platform_config`. | Modify |
| `firestore.indexes.json` | Index for control audit history. | Modify |

---

## Data model, rules and indexes

### Collection: `platform_config`

One document per control. Small, rarely written, read constantly — hence the cache in R6.

```
platform_config/messaging_controls
  outboundEnabled: boolean        // operator switch; can only restrict, never override env
  pausedReason: string            // shown in the UI; max 200 chars
  updatedBy: string               // uid, written server-side, never from the client
  updatedByName: string
  updatedAt: string               // ISO
```

Audit history is appended to the existing backoffice audit log via `logBackofficeAction`,
so no new audit collection is introduced.

### Firestore rules

Added to `firestore.rules`. Note the deliberate absence of a client `write` path: this
document is only ever written by a server action running under
`authorizeBackofficeSession`, using the Admin SDK, which bypasses rules. Denying all client
writes means a compromised browser session cannot pause the platform's messaging.

```
    // Platform deployment + messaging controls (backoffice isolation).
    //
    // Read: system admins only — it reveals operational posture, nothing a tenant needs.
    // Write: DENIED to all clients. The only writer is a server action running under
    // authorizeBackofficeSession via the Admin SDK, which bypasses these rules. Keeping
    // the client write path closed means an XSS in the backoffice cannot pause sending.
    match /platform_config/{controlId} {
      allow get: if isAuthorized() && isSystemAdmin();
      allow list: if isAuthorized() && isSystemAdmin();
      allow write: if false;
    }
```

**Public-facing access is unchanged by this work.** No public route reads
`platform_config`. The existing anonymous paths — published surveys, form drafts by token,
tokenised invoices, QR short paths — keep the rules verified by
`src/lib/__tests__/audit-f4-firestore-rules.rules.test.ts`, and Task E2 re-asserts them so
this change cannot regress anonymous access.

### Firestore indexes

`platform_config` is read by document id only, so **no composite index is required**. Add
none: an unused index costs write latency on every document in the collection.

Confirm after implementation with:

```bash
grep -c '"collectionGroup": "platform_config"' firestore.indexes.json   # expect 0
```

### Seeding / migration protocol

No FER protocol is needed — there is nothing to backfill. The control document is created
lazily on first write, and every reader treats "document missing" as "no operator
restriction", falling back to the environment value. This is the fail-open direction that
matters: a missing config document must never silently stop production messaging.

Task A6 adds an idempotent seed for clarity in the console; running it twice is safe.

---

## Security review

Against `.agents/skills/firebase-security-rules-auditor` checklist:

| Check | Assessment |
| --- | --- |
| **Update bypass** | No client write path exists (`allow write: if false`), so create/update divergence is not reachable. |
| **Authority source** | Authority is the `admin` custom claim and the backoffice role matrix, both server-controlled. `updatedBy` is written from the verified session, never from request data. |
| **Business logic** | Operators need read + a pause switch; both are served. Tenants have no need to read it and cannot. |
| **Storage abuse** | `pausedReason` is capped at 200 characters server-side before write. |
| **Type safety** | The server action validates types before writing; the client cannot write at all. |
| **Field vs identity** | Not applicable — no client writes. |

Additional controls from this plan:

- The kill switch is enforced at the network boundary, so a bug in any calling layer cannot
  produce an unintended send.
- The env floor cannot be lifted from the UI, so a compromised backoffice session cannot
  turn staging into a live sender.
- Session isolation between `go.` and `goadmin.` is preserved by *not* widening the cookie
  domain — a tenant-app XSS gains no path to the control plane.

---

## Load, scale and edge cases

| Case | Behaviour | Why it is safe |
| --- | --- | --- |
| High send volume | Guard reads a module-level cached value, not Firestore | One read per instance per 30 s, not per message |
| Firestore unavailable | Guard falls back to the env value and logs once | Fail-open on the operator switch, fail-closed on the env floor |
| Cold start | First call populates the cache; concurrent callers share one in-flight promise | No thundering herd on the config document |
| Config document missing | Treated as "no restriction" | A missing document must not stop production messaging |
| Bulk send of 10k messages | Guard is checked per message but costs a boolean read | No added I/O in the hot loop |
| Operator pauses mid-bulk | In-flight chunk finishes; the next chunk is blocked | Bounded by chunk size, no partial-message corruption |
| Clock skew between instances | Each instance caches independently for 30 s | Worst case, one instance lags by 30 s |
| Both backends running cron | Only the client surface serves cron paths | Task C2 |

---

## Stage A — Kill switch, runtime controls, staging backend

**Client risk: none.** Nothing in this stage changes behaviour on `go.smartsapp.com`,
because the switch defaults to *allow* and no surface variable is set there yet.

### Task A1: Surface + origin resolver

**Files:**
- Create: `src/lib/platform/app-surface.ts`
- Test: `src/lib/platform/__tests__/app-surface.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { getAppSurface, getPublicAppOrigin } from '../app-surface';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('getAppSurface', () => {
  it('defaults to client when unset, so existing deployments are unaffected', () => {
    delete process.env.APP_SURFACE;
    expect(getAppSurface()).toBe('client');
  });

  it('reads a valid surface', () => {
    process.env.APP_SURFACE = 'backoffice';
    expect(getAppSurface()).toBe('backoffice');
  });

  it('falls back to client on an unrecognised value rather than throwing at boot', () => {
    process.env.APP_SURFACE = 'nonsense';
    expect(getAppSurface()).toBe('client');
  });
});

describe('getPublicAppOrigin', () => {
  it('prefers PUBLIC_APP_ORIGIN', () => {
    process.env.PUBLIC_APP_ORIGIN = 'https://go.example.com/';
    expect(getPublicAppOrigin()).toBe('https://go.example.com');
  });

  it('falls back to NEXT_PUBLIC_APP_URL', () => {
    delete process.env.PUBLIC_APP_ORIGIN;
    process.env.NEXT_PUBLIC_APP_URL = 'https://go.example.com';
    expect(getPublicAppOrigin()).toBe('https://go.example.com');
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/platform/__tests__/app-surface.test.ts`
Expected: FAIL — cannot find module `../app-surface`.

- [x] **Step 3: Implement**

```ts
/**
 * @fileOverview Which deployment surface is this process serving? (backoffice isolation)
 *
 * The same image is deployed to two App Hosting backends. This module is the ONLY place
 * that decides which one it is, so behaviour cannot drift between call sites.
 *
 * CAUTION: the default is 'client'. That is deliberate — an existing deployment with no
 * APP_SURFACE set must keep behaving exactly as it does today. Do not change the default
 * to throw or to 'backoffice'; it would break the live client app on the next rollout.
 */
export const APP_SURFACES = ['client', 'backoffice'] as const;
export type AppSurface = (typeof APP_SURFACES)[number];

export function getAppSurface(): AppSurface {
  const raw = process.env.APP_SURFACE;
  return APP_SURFACES.includes(raw as AppSurface) ? (raw as AppSurface) : 'client';
}

export function isBackofficeSurface(): boolean {
  return getAppSurface() === 'backoffice';
}

/**
 * The origin customers see. NOT the origin this process is served from.
 *
 * CAUTION: every customer-facing link must be built from this, never from the request
 * host. A link built from the request host on the backoffice backend would embed
 * goadmin.smartsapp.com in outbound mail. See url-helpers.getRequestBaseUrl().
 */
export function getPublicAppOrigin(): string {
  const raw = process.env.PUBLIC_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}
```

- [x] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/platform/__tests__/app-surface.test.ts`

- [x] **Step 5: Commit**

```bash
git add src/lib/platform/app-surface.ts src/lib/platform/__tests__/app-surface.test.ts
git commit -m "feat(platform): add app surface and public origin resolver"
```

### Task A2: Outbound guard

**Files:**
- Create: `src/lib/platform/outbound-guard.ts`
- Test: `src/lib/platform/__tests__/outbound-guard.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: mockGet }) }) },
}));

import { assertOutboundAllowed, OutboundBlockedError, __resetOutboundCache } from '../outbound-guard';

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  __resetOutboundCache();
  mockGet.mockResolvedValue({ exists: false, data: () => undefined });
});
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('assertOutboundAllowed', () => {
  it('allows sending when nothing is configured, so production is unaffected', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    await expect(assertOutboundAllowed('email')).resolves.toBeUndefined();
  });

  it('blocks when the environment floor is false', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    await expect(assertOutboundAllowed('sms')).rejects.toBeInstanceOf(OutboundBlockedError);
  });

  it('ignores an operator re-enable when the environment floor is false', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    mockGet.mockResolvedValue({ exists: true, data: () => ({ outboundEnabled: true }) });
    await expect(assertOutboundAllowed('sms')).rejects.toBeInstanceOf(OutboundBlockedError);
  });

  it('blocks when an operator has paused sending', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    mockGet.mockResolvedValue({ exists: true, data: () => ({ outboundEnabled: false, pausedReason: 'incident' }) });
    await expect(assertOutboundAllowed('email')).rejects.toBeInstanceOf(OutboundBlockedError);
  });

  it('allows sending if the config read fails, so Firestore cannot halt production', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    mockGet.mockRejectedValue(new Error('unavailable'));
    await expect(assertOutboundAllowed('email')).resolves.toBeUndefined();
  });

  it('reads the config at most once across concurrent callers', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    await Promise.all([
      assertOutboundAllowed('email'),
      assertOutboundAllowed('sms'),
      assertOutboundAllowed('push'),
    ]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/platform/__tests__/outbound-guard.test.ts`
Expected: FAIL — cannot find module `../outbound-guard`.

- [x] **Step 3: Implement**

```ts
/**
 * @fileOverview The outbound messaging kill switch (backoffice isolation, risk R2).
 *
 * WHY THIS EXISTS
 * A staging backend shares production Firestore, and provider keys are stored PER
 * ORGANIZATION in Firestore (`org.mnotifyApiKey`, `org.resendApiKey`). Withholding the
 * environment secrets from staging is therefore NOT enough to stop it messaging real
 * customers — it would resolve a tenant's own key and send. This guard is the thing that
 * actually prevents that.
 *
 * WHERE IT IS ENFORCED
 * At the five provider boundaries (resend, mnotify, onesignal, whatsapp), not in the
 * messaging engine, so that any call path is covered — including bulk-upload-actions,
 * which resolves its own keys and never touches the engine.
 *
 * TWO LAYERS, DELIBERATELY ORDERED
 *   1. ALLOW_OUTBOUND_MESSAGING=false  — a hard floor. Cannot be lifted from the UI.
 *   2. platform_config/messaging_controls.outboundEnabled — the operator pause switch.
 * The floor wins. An operator must never be able to turn a staging environment into one
 * that messages customers.
 *
 * CAUTION FOR FUTURE EDITORS
 * The default is ALLOW, and a failed config read is ALLOW. That is intentional: a missing
 * document or a Firestore outage must not silently stop production messaging. If you
 * change either default, you are choosing "customers stop receiving mail during an
 * incident" — make that choice explicitly.
 */
import { reportError } from '@/lib/errors/report-error';

export type OutboundChannel = 'email' | 'sms' | 'push' | 'whatsapp';

export class OutboundBlockedError extends Error {
  readonly channel: OutboundChannel;
  readonly reason: string;
  constructor(channel: OutboundChannel, reason: string) {
    super(`Outbound ${channel} is disabled on this deployment: ${reason}`);
    this.name = 'OutboundBlockedError';
    this.channel = channel;
    this.reason = reason;
  }
}

interface MessagingControls {
  outboundEnabled: boolean;
  pausedReason: string;
}

const CACHE_TTL_MS = 30_000;

let cachedControls: MessagingControls | null = null;
let cachedAt = 0;
let inFlight: Promise<MessagingControls> | null = null;

/** Test seam. Not for production use. */
export function __resetOutboundCache(): void {
  cachedControls = null;
  cachedAt = 0;
  inFlight = null;
}

function envFloorAllows(): boolean {
  return process.env.ALLOW_OUTBOUND_MESSAGING !== 'false';
}

async function readControls(): Promise<MessagingControls> {
  const fallback: MessagingControls = { outboundEnabled: true, pausedReason: '' };
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('platform_config').doc('messaging_controls').get();
    if (!snap.exists) return fallback;
    const data = snap.data();
    return {
      outboundEnabled: data?.outboundEnabled !== false,
      pausedReason: typeof data?.pausedReason === 'string' ? data.pausedReason : '',
    };
  } catch (error) {
    // Fail open: a Firestore problem must not stop production messaging.
    reportError('platform.outbound-guard', error, { note: 'control read failed; allowing' });
    return fallback;
  }
}

async function getControls(): Promise<MessagingControls> {
  const now = Date.now();
  if (cachedControls && now - cachedAt < CACHE_TTL_MS) return cachedControls;
  // Share one in-flight read across concurrent callers so a cold start cannot stampede.
  if (!inFlight) {
    inFlight = readControls().then((c) => {
      cachedControls = c;
      cachedAt = Date.now();
      inFlight = null;
      return c;
    });
  }
  return inFlight;
}

/**
 * Throws {@link OutboundBlockedError} if this deployment must not send.
 * Call at the top of every provider send function.
 */
export async function assertOutboundAllowed(channel: OutboundChannel): Promise<void> {
  if (!envFloorAllows()) {
    throw new OutboundBlockedError(channel, 'sending is disabled for this environment');
  }
  const controls = await getControls();
  if (!controls.outboundEnabled) {
    throw new OutboundBlockedError(channel, controls.pausedReason || 'paused by an administrator');
  }
}
```

- [x] **Step 4: Run tests — expect PASS (6 tests)**

Run: `npx vitest run src/lib/platform/__tests__/outbound-guard.test.ts`

- [x] **Step 5: Commit**

```bash
git add src/lib/platform/outbound-guard.ts src/lib/platform/__tests__/outbound-guard.test.ts
git commit -m "feat(platform): add outbound messaging kill switch"
```

### Task A3: Wire the guard into all five provider boundaries

**Files:**
- Modify: `src/lib/resend-service.ts` (`sendEmail`, `sendBatchEmails`)
- Modify: `src/lib/mnotify-service.ts` (`sendSms`)
- Modify: `src/lib/onesignal-service.ts` (`sendPushNotification`)
- Modify: `src/lib/whatsapp/whatsapp-send.ts` (`sendWhatsApp`)
- Test: `src/lib/platform/__tests__/outbound-boundaries.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }) }) },
}));

const ORIGINAL = { ...process.env };
beforeEach(() => { process.env.ALLOW_OUTBOUND_MESSAGING = 'false'; });
afterEach(() => { process.env = { ...ORIGINAL }; });

// Every provider boundary must refuse before it reaches the network.
describe('provider boundaries respect the kill switch', () => {
  it('blocks email', async () => {
    const { sendEmail } = await import('@/lib/resend-service');
    await expect(sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })).rejects.toThrow(/disabled/i);
  });

  it('blocks sms', async () => {
    const { sendSms } = await import('@/lib/mnotify-service');
    await expect(sendSms({ recipient: '+233000000000', message: 'm', sender: 'S' })).rejects.toThrow(/disabled/i);
  });

  it('blocks push', async () => {
    const { sendPushNotification } = await import('@/lib/onesignal-service');
    // Signature is positional: (userIds, title, message, data?)
    await expect(sendPushNotification(['user-1'], 'title', 'message')).rejects.toThrow(/disabled/i);
  });
});
```

Note `sendPushNotification` currently returns `null` when credentials are missing rather
than throwing. The guard must run **before** that check, so a blocked send is loud rather
than silently indistinguishable from "not configured".

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/platform/__tests__/outbound-boundaries.test.ts`
Expected: FAIL — the calls attempt a real request instead of throwing.

- [x] **Step 3: Add the guard to each boundary**

Add this import to each of the four files:

```ts
// SECURITY (backoffice isolation, R2): a non-client deployment shares production Firestore
// and can resolve per-organization provider keys, so it can message real customers unless
// stopped here. This is the last point before the network call.
import { assertOutboundAllowed } from '@/lib/platform/outbound-guard';
```

Then as the first statement of each send function:

```ts
  await assertOutboundAllowed('email');   // resend-service.ts: sendEmail, sendBatchEmails
  await assertOutboundAllowed('sms');     // mnotify-service.ts: sendSms
  await assertOutboundAllowed('push');    // onesignal-service.ts: sendPushNotification
  await assertOutboundAllowed('whatsapp'); // whatsapp/whatsapp-send.ts: sendWhatsApp
```

- [x] **Step 4: Run the boundary tests — expect PASS**

- [x] **Step 5: Run the full suite — nothing may regress**

Run: `NODE_OPTIONS='--max-old-space-size=4096' npx vitest run`
Expected: same pass count as before this stage, plus the new tests.

> Existing messaging tests do not set `ALLOW_OUTBOUND_MESSAGING`, so the guard defaults to
> allow and they are unaffected. If any test fails, the guard has been placed in a read
> path by mistake — check it is only on send functions.

- [x] **Step 6: Commit**

```bash
git add src/lib/resend-service.ts src/lib/mnotify-service.ts src/lib/onesignal-service.ts \
        src/lib/whatsapp/whatsapp-send.ts src/lib/platform/__tests__/outbound-boundaries.test.ts
git commit -m "feat(platform): enforce the outbound kill switch at every provider boundary"
```

### Task A4: Firestore rules for `platform_config`

**Files:**
- Modify: `firestore.rules`
- Test: `src/lib/__tests__/platform-config-rules.rules.test.ts`

- [x] **Step 1: Write the failing rules test**

```ts
// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { connect } from 'node:net';

async function emulatorUp(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = connect(port, '127.0.0.1');
    s.setTimeout(1000);
    s.on('connect', () => { s.end(); res(true); });
    s.on('timeout', () => { s.destroy(); res(false); });
    s.on('error', () => { s.destroy(); res(false); });
  });
}
const up = await emulatorUp(8080);

describe.skipIf(!up)('platform_config rules', () => {
  let env;
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: `platform-config-${Date.now()}`,
      firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/root'), { isAuthorized: true, permissions: ['system_admin'], organizationId: 'o', workspaceIds: [] });
      await setDoc(doc(db, 'users/tenant'), { isAuthorized: true, permissions: [], organizationId: 'o', workspaceIds: ['ws'] });
      await setDoc(doc(db, 'platform_config/messaging_controls'), { outboundEnabled: true, pausedReason: '' });
    });
  });

  const anon = () => env.unauthenticatedContext().firestore();
  const tenant = () => env.authenticatedContext('tenant').firestore();
  const root = () => env.authenticatedContext('root').firestore();

  it('denies anonymous read', async () => {
    await assertFails(getDoc(doc(anon(), 'platform_config/messaging_controls')));
  });

  it('denies an ordinary tenant user', async () => {
    await assertFails(getDoc(doc(tenant(), 'platform_config/messaging_controls')));
  });

  it('allows a system admin to read', async () => {
    await assertSucceeds(getDoc(doc(root(), 'platform_config/messaging_controls')));
  });

  it('denies writes even from a system admin, because only the server may write', async () => {
    await assertFails(setDoc(doc(root(), 'platform_config/messaging_controls'), { outboundEnabled: false }));
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npm run test:rules`
Expected: the admin-read case FAILS — no rule matches `platform_config` yet, so it is denied.

- [x] **Step 3: Add the rules**

Insert into `firestore.rules`, inside `match /databases/{database}/documents {`:

```
    // Platform deployment + messaging controls (backoffice isolation).
    //
    // Read: system admins only. Write: DENIED to every client. The sole writer is a server
    // action running under authorizeBackofficeSession via the Admin SDK, which bypasses
    // rules. Keeping the client write path closed means an XSS in the backoffice cannot
    // pause the platform's outbound messaging.
    match /platform_config/{controlId} {
      allow get: if isAuthorized() && isSystemAdmin();
      allow list: if isAuthorized() && isSystemAdmin();
      allow write: if false;
    }
```

- [x] **Step 4: Run the rules tests — expect PASS (4 tests)**

Run: `npm run test:rules`

- [x] **Step 5: Commit**

```bash
git add firestore.rules src/lib/__tests__/platform-config-rules.rules.test.ts
git commit -m "feat(rules): restrict platform_config to system admins, deny client writes"
```

### Task A5: Staging configuration

**Files:**
- Create: `apphosting.staging.yaml`
- Modify: `src/proxy.ts` — block anonymous public routes when `APP_ENV=staging` (D-1)
- Test: `src/__tests__/proxy-staging-public.test.ts`

- [x] **Step 1: Create the file**

```yaml
# Staging backend — shares the production Firebase project, so it MUST NOT be able to
# contact a customer.
#
# CAUTION: the sending secrets are omitted deliberately. Do not add them "to make staging
# realistic". Per-organization provider keys live in Firestore and staging shares that
# data, so the ALLOW_OUTBOUND_MESSAGING floor below is what actually stops sending —
# see src/lib/platform/outbound-guard.ts.
runConfig:
  minInstances: 0
  maxInstances: 2
  concurrency: 80
  cpu: 1
  memoryMiB: 1024
env:
  - variable: APP_SURFACE
    value: "client"
    availability: [BUILD, RUNTIME]
  - variable: ALLOW_OUTBOUND_MESSAGING
    value: "false"
    availability: [BUILD, RUNTIME]
  - variable: APP_ENV
    value: "staging"
    availability: [BUILD, RUNTIME]
  # Customer-facing links must still resolve to the real client origin.
  - variable: PUBLIC_APP_ORIGIN
    value: "https://go.smartsapp.com"
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_APP_URL
    value: "https://go.smartsapp.com"
    availability: [BUILD, RUNTIME]
  - variable: RAYON_NUM_THREADS
    value: "2"
    availability: [BUILD]
  - variable: BUILD_CPUS
    value: "2"
    availability: [BUILD]
  - variable: NEXT_TELEMETRY_DISABLED
    value: "1"
    availability: [BUILD]
  # CRON_SECRET is intentionally absent: /api/cron/* returns 500 without it, so staging
  # cannot run scheduled sends.
  - variable: WHATSAPP_ENCRYPTION_KEY
    secret: whatsapp-encryption-key
```

- [x] **Step 2: Commit**

```bash
git add apphosting.staging.yaml
git commit -m "feat(hosting): add staging backend config with outbound sending disabled"
```

### Task A6: Verify the whole stage

- [x] **Step 1: Types**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [x] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0 (warning ceiling unchanged).

- [x] **Step 3: Directive placement**

Run: `npm run check:directives`
Expected: all directives first.

- [x] **Step 4: Full suite**

Run: `NODE_OPTIONS='--max-old-space-size=4096' npx vitest run`
Expected: previous pass count plus the new tests, 0 failures.

- [x] **Step 5: Rules**

Run: `npm run test:rules`

- [x] **Step 6: Prove the switch actually blocks (the assertion R8 depends on)**

```bash
ALLOW_OUTBOUND_MESSAGING=false npx tsx -e "
  import('./src/lib/resend-service').then(async (m) => {
    try { await m.sendEmail({ to: 'x@example.com', subject: 's', html: '<p>x</p>' }); console.log('FAIL: send was attempted'); process.exit(1); }
    catch (e) { console.log('OK blocked:', e instanceof Error ? e.message : e); process.exit(0); }
  });
"
```
Expected: `OK blocked: Outbound email is disabled…`

- [ ] **Step 7: Console — create the staging backend (manual — owner)**

1. `git switch -c staging && git push -u origin staging` *(only when asked to push)*
2. Firebase console → App Hosting → Create backend → same repo → branch `staging`.
3. Set **Environment name** to `staging`. No custom domain.
4. After the first rollout, open the generated URL and confirm the app loads.
5. Repeat Step 6's assertion against the deployed staging URL by triggering a test send
   from the UI and confirming it is refused.

---

## Stage B — Backoffice backend (client untouched)

### Task B1: Backoffice hosting config

**Files:** Create `apphosting.backoffice.yaml`

- [x] **Step 1: Create the file**

```yaml
# Backoffice control plane — goadmin.smartsapp.com.
#
# CAUTION: PUBLIC_APP_ORIGIN and NEXT_PUBLIC_APP_URL both point at the CLIENT domain on
# purpose. They answer "where does the product live for customers", not "where is this
# process running". Pointing them here would put goadmin.smartsapp.com into customer
# emails — see risk R1.
runConfig:
  minInstances: 0
  maxInstances: 2
  concurrency: 80
  cpu: 1
  memoryMiB: 1024
env:
  - variable: APP_SURFACE
    value: "backoffice"
    availability: [BUILD, RUNTIME]
  - variable: PUBLIC_APP_ORIGIN
    value: "https://go.smartsapp.com"
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_APP_URL
    value: "https://go.smartsapp.com"
    availability: [BUILD, RUNTIME]
  - variable: RAYON_NUM_THREADS
    value: "2"
    availability: [BUILD]
  - variable: BUILD_CPUS
    value: "2"
    availability: [BUILD]
  - variable: NEXT_TELEMETRY_DISABLED
    value: "1"
    availability: [BUILD]
  - variable: WHATSAPP_ENCRYPTION_KEY
    secret: whatsapp-encryption-key
  - variable: CLOUD_TASKS_SECRET
    secret: CLOUD_TASKS_SECRET
```

- [x] **Step 2: Commit**

```bash
git add apphosting.backoffice.yaml
git commit -m "feat(hosting): add backoffice backend config"
```

### Task B2–B5: Standing up the second surface

**THE HOSTING DECISION CHANGED MID-FLIGHT.** B2 was written for a second App Hosting
backend. We did not do that, because App Hosting's Cloud Build step is what was failing in
the first place — 57m timeouts and OOM on an e2-standard-2 builder. Both surfaces now run
as **Cloud Run services built by GitHub Actions** (~4m30s), per
`.github/workflows/deploy-cloudrun.yml` and `docs/architecture/ci-build-and-deploy.md`.
`apphosting.backoffice.yaml` above is kept only as the record of the intended runtime env;
the live values come from the workflow's deploy matrix.

- [x] **B2** Second surface created — Cloud Run service `smartsapp-backoffice`
      (`us-central1`, `APP_SURFACE=backoffice`), deployed by the same workflow as
      `smartsapp-app`. Both are `--allow-unauthenticated` at the IAM layer, with access
      enforced in the app (session guard + `BACKOFFICE_IP_ALLOWLIST`) — IAM-level
      lockout was tried first and made the service unreachable by any browser.
- [ ] **B3** Attach `goadmin.smartsapp.com`. **Mapping created; blocked on DNS.**
      The mapping to `smartsapp-backoffice` exists and reports
      `CertificateProvisioned: Unknown — the challenge data was not visible through the
      public internet`. Cause: there is no `goadmin` record at all; a **wildcard `*` A
      record** on `smartsapp.com` (DNS hosted at DigitalOcean) is answering with
      `209.38.53.42`. Fix is purely additive — an exact-match record beats a wildcard, so
      nothing needs deleting and none of the `go.` cutover's NXDOMAIN risk applies:

      | Type | CNAME |
      | Hostname | `goadmin` |
      | Value | `ghs.googlehosted.com.` — the trailing dot is required; DigitalOcean
        appends the zone to any value without one, silently creating
        `ghs.googlehosted.com.smartsapp.com` |
      | TTL | 300 |

      Google re-polls hourly. Recreating the mapping restarts the poll immediately.
- [x] **B4** `goadmin.smartsapp.com` added to Firebase Auth authorized domains, via
      `identitytoolkit.googleapis.com/admin/v2/.../config` with
      `updateMask=authorizedDomains`. All nine pre-existing domains verified preserved;
      backup of the prior config was taken before the PATCH. *Skipping this makes sign-in
      fail with an opaque error that looks like a code bug (risk R3).*
- [ ] **B5** Sign in on `goadmin.smartsapp.com` and load `/backoffice`. **Blocked on B3.**
      A fresh sign-in is expected — the session cookie is host-only (risk R4).

Verified against the live services in the meantime, by URL rather than by domain:

| Request | Result |
| --- | --- |
| `smartsapp-backoffice` → `/backoffice` | `307` → `/login?redirect=%2Fbackoffice` (stays on host) |
| `smartsapp-backoffice` → `/admin` | `307` → `https://go.smartsapp.com/admin` |
| `smartsapp-app` → `/backoffice` | `404` |

**Checkpoint:** `go.smartsapp.com` has not been modified. If anything above is wrong, delete
the backend; nothing rolls back on the client.

---

## Stage C — Surface gating (the only client-affecting stage)

Ship C1 and C2 together: gating the surfaces without pinning the origin would put the admin
host into customer emails.

### Task C1: Pin the public origin off the client surface

**Files:**
- Modify: `src/lib/utils/url-helpers.ts`
- Test: `src/lib/utils/__tests__/url-helpers-surface.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; vi.resetModules(); });

vi.mock('next/headers', () => ({
  headers: async () => new Map([['host', 'goadmin.smartsapp.com'], ['x-forwarded-proto', 'https']]),
}));

describe('getRequestBaseUrl on the backoffice surface', () => {
  it('returns the public client origin, never the admin host', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { getRequestBaseUrl } = await import('../url-helpers');
    await expect(getRequestBaseUrl()).resolves.toBe('https://go.smartsapp.com');
  });

  it('still honours the request host on the client surface, for tenant custom domains', async () => {
    process.env.APP_SURFACE = 'client';
    const { getRequestBaseUrl } = await import('../url-helpers');
    await expect(getRequestBaseUrl()).resolves.toBe('https://goadmin.smartsapp.com');
  });
});
```

- [x] **Step 2: Run it and watch the first case fail**

Run: `npx vitest run src/lib/utils/__tests__/url-helpers-surface.test.ts`
Expected: the backoffice case FAILS, returning the admin host.

- [x] **Step 3: Implement**

In `getRequestBaseUrl()`, before reading headers:

```ts
  // SECURITY (backoffice isolation, R1): this helper builds CUSTOMER-FACING links —
  // unsubscribe, meeting joins, short links, survey invitations. On any surface other than
  // the client app, the request host is the wrong answer: it would put
  // goadmin.smartsapp.com into outbound mail. The host-derived behaviour below is kept for
  // the client surface only, because that is what supports tenant custom domains.
  const { isBackofficeSurface, getPublicAppOrigin } = await import('@/lib/platform/app-surface');
  if (isBackofficeSurface()) {
    const pinned = getPublicAppOrigin();
    if (pinned) return pinned;
  }
```

- [x] **Step 4: Run tests — expect PASS**

- [x] **Step 5: Commit**

```bash
git add src/lib/utils/url-helpers.ts src/lib/utils/__tests__/url-helpers-surface.test.ts
git commit -m "fix(links): pin customer-facing origin off the client surface"
```

### Task C2: Gate routes by surface in the proxy

**Files:**
- Modify: `src/proxy.ts`
- Test: `src/__tests__/proxy-surface.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL = { ...process.env };
afterEach(() => { process.env = { ...ORIGINAL }; vi.resetModules(); });

function req(path: string, host = 'go.smartsapp.com') {
  return new NextRequest(new URL(`https://${host}${path}`));
}

describe('client surface', () => {
  it('hides the backoffice', async () => {
    process.env.APP_SURFACE = 'client';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/backoffice')).status).toBe(404);
  });

  it('still serves the tenant admin app', async () => {
    process.env.APP_SURFACE = 'client';
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/admin')).status).not.toBe(404);
  });

  it('still serves public pages anonymously', async () => {
    process.env.APP_SURFACE = 'client';
    const { proxy } = await import('@/proxy');
    for (const p of ['/', '/surveys/x', '/forms/x', '/q/abc', '/invoice/1']) {
      expect(proxy(req(p)).status).not.toBe(404);
    }
  });
});

describe('backoffice surface', () => {
  it('serves the backoffice', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/backoffice', 'goadmin.smartsapp.com'));
    expect(res.status).not.toBe(307);
  });

  it('sends stray non-backoffice traffic to the client app', async () => {
    process.env.APP_SURFACE = 'backoffice';
    process.env.PUBLIC_APP_ORIGIN = 'https://go.smartsapp.com';
    const { proxy } = await import('@/proxy');
    const res = proxy(req('/surveys/x', 'goadmin.smartsapp.com'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://go.smartsapp.com/surveys/x');
  });
});

describe('unset surface behaves exactly as today', () => {
  it('serves both areas', async () => {
    delete process.env.APP_SURFACE;
    const { proxy } = await import('@/proxy');
    expect(proxy(req('/backoffice')).status).not.toBe(404);
    expect(proxy(req('/admin')).status).not.toBe(404);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/__tests__/proxy-surface.test.ts`

- [x] **Step 3: Implement**

Add near the top of `proxy()`, after the legacy `/s/` rewrite:

```ts
  // Deployment surface gating (backoffice isolation).
  //
  // The same image runs on two App Hosting backends. APP_SURFACE decides which routes this
  // one serves. Unset means "serve everything", so an existing deployment is unaffected.
  //
  // CAUTION: /api is NOT matched by this proxy (see config.matcher), so webhooks, cron and
  // the Chrome extension endpoints are never redirected. That is deliberate — providers
  // post to fixed URLs and a redirect would silently break them.
  const surface = process.env.APP_SURFACE;
  const isBackofficePath = pathname === '/backoffice' || pathname.startsWith('/backoffice/');

  if (surface === 'client' && isBackofficePath) {
    // Not a redirect: the control plane should not be discoverable from the tenant domain.
    return new NextResponse(null, { status: 404 });
  }

  if (surface === 'backoffice' && !isBackofficePath) {
    const publicOrigin = process.env.PUBLIC_APP_ORIGIN;
    if (publicOrigin) {
      return NextResponse.redirect(`${publicOrigin}${pathname}${search}`);
    }
  }
```

- [x] **Step 4: Run the surface tests — expect PASS (7 tests)**

- [x] **Step 5: Run the existing proxy suite — must not regress**

Run: `npx vitest run src/__tests__/proxy-session-redirect.test.ts`
Expected: all 43 still pass.

- [x] **Step 6: Commit**

```bash
git add src/proxy.ts src/__tests__/proxy-surface.test.ts
git commit -m "feat(proxy): gate routes by deployment surface"
```

### Task C3: Turn the client surface on

- [x] **Step 1: Add to `apphosting.yaml`**

```yaml
  - variable: APP_SURFACE
    value: "client"
    availability: [BUILD, RUNTIME]
  - variable: PUBLIC_APP_ORIGIN
    value: "https://go.smartsapp.com"
    availability: [BUILD, RUNTIME]
```

- [x] **Step 2: Verify locally before it ships**

```bash
APP_SURFACE=client npm run build
```
Expected: build succeeds.

- [x] **Step 3: Commit**

```bash
git add apphosting.yaml
git commit -m "feat(hosting): mark the primary backend as the client surface"
```

- [x] **Step 4: Deploy, then verify in production** — done for the client surface;
      the `goadmin` line is blocked on B3's DNS record.

| URL | Expected | Actual |
| --- | --- | --- |
| `https://go.smartsapp.com/backoffice` | 404 | **404** |
| `https://go.smartsapp.com/` | 200 | **200** |
| `https://go.smartsapp.com/admin` | 200 or 307 to `/login` | **307 → `/login?redirect=%2Fadmin`** |
| `https://go.smartsapp.com/login` | 200 | **200** |
| `https://goadmin.smartsapp.com/backoffice` | 200 or 307 to `/login` | **unreachable — DNS, see B3** |

Note when re-running these: Cloud Run scales to zero, so the first request to a cold
service can exceed a short `curl -m`. A `000` here means "cold start", not "broken" —
retry with `-m 120` before believing it.

- [ ] **Step 5: Send one real message and read its links**

Trigger a single test email from the client app. Open it and confirm every link points at
`go.smartsapp.com`. This is the only reliable check for R1.

**Rollback:** clear `APP_SURFACE` on the client backend, or roll back to the previous App
Hosting rollout. No code change required.

---

## Stage D — True build isolation (optional, later)

Only worth doing for build time: the client build compiles ~30.6k LOC of backoffice it will
never serve, and the TypeScript phase already dominates (37 minutes on a loaded machine).

- [ ] **D1** Move `authorizeBackofficeSession`, `backoffice-types` and `backoffice-errors`
      into a neutral module the FER actions can import without pulling in the control plane.
      This addresses 37 of 37 current cross-imports.
- [ ] **D2** Move `src/app/(backoffice)/` into its own app root.
- [ ] **D3** Point the backoffice backend's `rootDir` at it; the client build stops
      compiling it.
- [ ] **D4** Re-measure the build; record the new TypeScript phase duration here.

---

## Stage E — Backoffice control page

**STATUS: DONE.** Depends on Stage A. Shipped after it.

Rule 3 ("how can the backoffice manage this without touching code?") is answered here:
pausing customer messaging platform-wide used to need an env-var change and a redeploy.
It is now a switch with an audit trail.

### Task E1: Server actions for the control page — DONE

**Files:**
- `src/lib/platform/platform-controls-actions.ts`
- `src/lib/platform/__tests__/platform-controls-actions.test.ts` (11 tests)

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run it and watch it fail** (module not found)
- [x] **Step 3: Implement**
- [x] **Step 4: Run tests — 11 passed**
- [x] **Step 5: Commit**

Exports:

| Export | Permission | Notes |
| --- | --- | --- |
| `getPlatformControlsAction()` | `settings:view` | Returns `PlatformControlsView` — display-safe primitives only, never the raw document. |
| `setOutboundPausedAction(paused, reason)` | `settings:edit` (super_admin) | Writes `platform_config/messaging_controls`, audit-logs, resets the local guard cache. |

Deviations from the sketch in the original plan, and why:

- **Authorization is outside the try/catch.** A denied caller rejects rather than returning
  `{ success: false }`, which a UI would render as an ordinary retryable failure.
- **Resuming clears `pausedReason`.** Leaving the old incident note behind would read as
  the current state to the next operator.
- **One error call, not two.** `reportError` followed by `toClientErrorMessage` mints two
  correlation ids, so the operator would quote a reference that is not the one in the logs.
- **`__resetOutboundCache()` after a successful write.** Makes the change immediate for the
  instance that served the request; other instances follow within the guard's 30s TTL. The
  UI says so rather than implying it is instant.

### Task E2: The operator page — DONE

**Files:**
- `src/app/(backoffice)/backoffice/operations/platform-controls/page.tsx` (server component)
- `src/app/(backoffice)/backoffice/operations/platform-controls/PlatformControlsClient.tsx`
- `.../__tests__/platform-controls-client.test.tsx` (9 tests)
- Nav: `BackofficeSidebar.tsx` (Operations group, `settings` module) and `route-titles.ts`

- [x] **Step 1: Build it**
- [ ] **Step 2: Check it on a phone-sized viewport** — see "Outstanding" below
- [x] **Step 3: Commit**

Requirements and how each is met:

| Requirement | How |
| --- | --- |
| Server component loads state; client owns only the toggle | `page.tsx` is `async` + `force-dynamic`; the client bundle is the switch and dialog. During an incident the state is in the first paint, not behind a spinner. |
| Words-first status, never a boolean | "Sending is on" / "Sending is paused" / "Sending is off for this environment". A test asserts no `true`/`false` is rendered. |
| Environment floor disables the toggle | `envFloorAllows === false` → inert switch, one plain line of explanation. A test asserts `ALLOW_OUTBOUND_MESSAGING` never reaches the DOM. |
| Confirm dialog with a reason to pause; confirm to resume | Pause requires a non-empty note (capped at 200, mirrored from the server); resume confirms without one. |
| Mobile at 360 px | Single column by default, `sm:` breakpoints for every row layout, `max-w-prose`, no tables, no fixed widths; the toggle row is `min-h-11` (44 px). |
| Motion | 150 ms colour cross-fade on the status band; no entrance animation on the status text. |
| Errors as one plain sentence + reference id | The dialog stays open on failure and shows `res.error`, which already carries `(ref: …)`. A test asserts the state does not move. |

Read-only operators (`settings:view` but not `edit`) see the state and a disabled control
with "You can see this setting but not change it." — not a hidden control they would then
go looking for.

The page also warns, quietly, if it is being served by the `client` surface: post-isolation
that means the split has regressed.

**Outstanding:** the phone-sized visual pass (Step 2) still needs a human — it requires a
running app and a signed-in backoffice session, which the automated tests cannot stand in
for. The structural guarantees above are covered by tests; the pixel check is not.

---

## Final verification and deployment

- [ ] `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — exit 0
- [ ] `npm run check:directives` — all directives first
- [ ] `NODE_OPTIONS='--max-old-space-size=4096' npx vitest run` — 0 failures
- [ ] `npm run test:rules` — 0 failures
- [ ] `npm run build` — exit 0
- [ ] Deploy rules and indexes (only after the above are green):

```bash
firebase deploy --only firestore:rules --project <prod-project-id>
firebase deploy --only firestore:indexes --project <prod-project-id>
```

- [ ] Re-run `npm run test:rules` against the deployed rules
- [ ] Confirm anonymous access still works on a real public page (open an incognito window
      on a published survey and a tokenised invoice)

**Do not push to origin until explicitly asked.**

---

## Decisions (settled with the owner)

**D-1 — Staging does not serve public pages.** It shares production Firestore, so a form
submitted there would write a real record. Public routes are blocked when `APP_ENV=staging`
(Task A6). Trade-off accepted: public pages cannot be exercised on staging. Reversible by
clearing `APP_ENV`.

**D-2 — `goadmin.smartsapp.com` is IP-allowlisted.** An authenticated control plane is
still better off not reachable from the open internet. Implemented as an allowlist checked
in the proxy (Task B6), configured by `BACKOFFICE_IP_ALLOWLIST`. Empty means no
restriction, so nothing changes until the value is set.

**D-3 — The pause switch is `settings:edit`, which is super_admin only.**
Checked against `ROLE_MATRIX`: for `settings`, only `super_admin` holds `edit`; every other
role has `view`. `operations:execute` was rejected because `support_admin` and
`migration_admin` also hold it, and pausing all customer messaging platform-wide is too
broad for either. Reading status stays at `settings:view` so any backoffice role can see
posture during an incident without being able to change it.
