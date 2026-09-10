# Isolating the Backoffice onto its own Deployment

**Goal:** serve the backoffice control plane from `goadmin.smartsapp.com` and the client
application from `go.smartsapp.com`, as two independent deployments.

**Hard constraint:** `go.smartsapp.com` stays up throughout. The backoffice may be down for
as long as the work takes — it is not in active use.

---

## What the codebase actually looks like

Measured, not assumed:

| Fact | Value | Why it matters |
| --- | --- | --- |
| Backoffice UI | `src/app/(backoffice)/`, 128 files, ~30.6k LOC | One contiguous route group — a clean seam |
| Imports **into** the backoffice UI from shared code | 120 modules | One-way dependency |
| Imports **out of** the backoffice UI into shared code | **0** | Nothing in the client app depends on backoffice UI |
| Client files importing `src/lib/backoffice/*` | **37** | The only real coupling |
| — of those, importing just `backoffice-auth` | **34** | Introduced by audit Phase 4a (`authorizeBackofficeSession`) |
| Hosting | Firebase App Hosting, backend `studio`, `rootDir: /` | Supports multiple backends per repo |

The backoffice UI is a leaf. The coupling that exists is almost entirely one function,
`authorizeBackofficeSession`, used by the FER/migration server actions.

---

## Recommended approach

**Two App Hosting backends built from the same codebase, separated by hostname.**
Not a monorepo split — at least not first.

Firebase App Hosting supports several backends from one repository, each with its own
custom domain and its own `apphosting.<ENVIRONMENT_NAME>.yaml`. That gives real deployment
isolation — separate Cloud Run services, separate scaling, separate rollouts, and the
backoffice can be stopped without touching the client — without restructuring the repo.

**The ordering is what protects the client app:** add the new backend first, change the
existing one last. Every step before the final one is additive and cannot affect
`go.smartsapp.com`.

A true build-level split (separate app roots, shared code extracted to a package) is worth
doing later and is described in Stage D. It is not the right first move: it requires
resolving the 37 shared imports and restructuring the build while the client app is live.

---

## The five things that will break if missed

These came out of reading the code, and each one is silent — nothing fails at build time.

### 1. Outbound links would point at the admin domain — the serious one

`getRequestBaseUrl()` (`src/lib/utils/url-helpers.ts`) returns **the current request's
host**. It is used to build customer-facing URLs in:

- `messaging-engine.ts` — 8 call sites, links inside outbound email/SMS
- `reminder-actions.ts` — 3 sites, cron-sent reminders
- `services/unsubscribe-service.ts` — unsubscribe links
- `meeting-registrants-actions.ts`, `meeting-facilitator-actions.ts`, `bulk-meeting-actions.ts`
- `backoffice/backoffice-org-actions.ts` — already calls it from the backoffice today

Any message dispatched from the backoffice backend would embed
`https://goadmin.smartsapp.com/...` in mail sent to customers — including unsubscribe and
meeting-join links. It would not error; it would just be wrong, and only visible after real
messages had gone out.

**Fix:** pin the public origin explicitly rather than deriving it from the host on the
backoffice surface. Add `PUBLIC_APP_ORIGIN=https://go.smartsapp.com` to **both** backends
and prefer it in `getRequestBaseUrl()` when `APP_SURFACE === 'backoffice'`. The host-derived
behaviour must stay for the client backend, because it is what supports tenant custom
domains.

### 2. `NEXT_PUBLIC_APP_URL` must keep pointing at the client domain

`getBaseUrl()` falls back to `NEXT_PUBLIC_APP_URL` (32 consumers). It identifies *where the
product lives for users*, not *where this process is running*. Setting it to the admin
domain on the backoffice backend would break the same class of links as above.

### 3. Backoffice users will sign in separately — by design

The Phase 3 `__session` cookie is set with no `domain` attribute, so it is host-only. A
session established on `go.smartsapp.com` is not sent to `goadmin.smartsapp.com`. Firebase
Auth persistence is per-origin too, so the browser has no client session there either.

Operators therefore sign in again on the admin domain. This is a security improvement — the
control-plane session is isolated from the tenant app — but it is a UX change to announce.
Do **not** "fix" it by widening the cookie to `.smartsapp.com`: that would hand every
tenant-app XSS a path to the control plane.

### 4. Firebase Auth authorized domains

`goadmin.smartsapp.com` must be added under **Authentication → Settings → Authorized
domains** in the Firebase console, or sign-in fails on the new domain with an opaque error.
Easy to forget, and it looks like a code bug.

### 5. Both backends still expose every API route

In the same-build model each backend contains the whole app, and `proxy.ts` explicitly does
not match `/api`. So `goadmin.smartsapp.com/api/*` will serve client APIs, and
`go.smartsapp.com` will still *contain* backoffice code even once its routes are gated.

This is a routing separation, not a security boundary. It is acceptable because every one
of those endpoints authenticates independently (audit Phase 4), but it is the main reason
to eventually do Stage D.

---

## Staging: what I would actually do

**Recommendation: yes, create a staging backend — but do not block this work on it, and do
not build a separate Firebase project for it right now.**

The reasoning:

- The change under test is *routing and configuration*, not data logic. A staging tier with
  its own empty Firestore would exercise a different environment than the one the change
  affects, while costing duplicated secrets, auth users and seed data.
- The thing that de-risks this change is the additive ordering (Stage B is invisible to the
  client app) plus App Hosting's rollback to a previous rollout.
- A staging backend is still worth having permanently, and this is a good excuse to create
  one — just scope it to what it is good for.

**Concretely:** create a `staging` branch and an App Hosting backend with Environment name
`staging`, in the **same Firebase project**, with **no custom domain**. It gets a
`*.web.app` URL, shares Firestore with production, and exists to smoke-test the hostname
gating before it reaches the client backend. Treat it as read-mostly and never point load
or automated writes at it.

If you later want a true isolated staging tier with its own data, that is a separate project
and a separate piece of work — it should not gate this one.

---

## Stages

### Stage A — Staging backend (½ day, optional)

1. `git switch -c staging && git push -u origin staging`
2. Firebase console → App Hosting → **Create backend**, same repo, branch `staging`.
3. Set its **Environment name** to `staging`; add `apphosting.staging.yaml`.
4. No custom domain. Verify the app boots on the generated URL.

*Client impact: none.*

### Stage B — Add the backoffice backend (½ day)

1. Create a second backend, same repo, branch `main`, **Environment name** `backoffice`.
2. Add `apphosting.backoffice.yaml`:

```yaml
runConfig:
  minInstances: 0      # control plane; cold start is fine
  maxInstances: 2
  concurrency: 80
  cpu: 1
  memoryMiB: 1024
env:
  - variable: APP_SURFACE
    value: "backoffice"
    availability: [BUILD, RUNTIME]
  # Customer-facing links must resolve to the CLIENT origin, never this host.
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
```

3. Attach `goadmin.smartsapp.com` to this backend; complete DNS verification.
4. Add `goadmin.smartsapp.com` to Firebase Auth authorized domains.
5. Verify: sign in on the admin domain, load `/backoffice`, exercise one read-only page.

*Client impact: none. `go.smartsapp.com` has not been touched.*

### Stage C — Gate by surface (the only client-affecting change)

Add `APP_SURFACE=client` and `PUBLIC_APP_ORIGIN` to the existing `apphosting.yaml`, then
teach `proxy.ts` to gate on it:

- `APP_SURFACE=client` and path starts with `/backoffice` → return 404.
- `APP_SURFACE=backoffice` and path is **not** `/backoffice` → redirect to
  `PUBLIC_APP_ORIGIN` + path, so a stray admin-domain link lands on the real app.
- Anything else → unchanged.

Ship the `getRequestBaseUrl()` pin (risk 1) in the **same** change.

This is one env var and one guard, both instantly revertible: setting `APP_SURFACE` back to
empty restores today's behaviour without a code deploy.

*Client impact: `/backoffice/*` stops resolving on `go.smartsapp.com`. Nothing else changes.*

### Stage D — True build isolation (later, optional)

Only worth doing for the build-time win: the client build currently compiles ~30.6k LOC of
backoffice it will never serve, and the TypeScript phase already dominates the build.

1. Extract the genuinely shared pieces — `backoffice-auth`, `backoffice-types`,
   `backoffice-errors` — into a neutral module the FER actions can import without pulling in
   the control plane (this addresses 37 of 37 current imports).
2. Move `src/app/(backoffice)/` into its own app root.
3. Point the backoffice backend's `rootDir` at it; the client backend stops building it.

---

## Rollback

| Stage | Rollback |
| --- | --- |
| A, B | Delete the backend. The client app was never involved. |
| C | Set `APP_SURFACE` to empty on the client backend, or roll back to the previous App Hosting rollout. |
| D | Revert the branch; the two-backend topology from B/C still stands. |

---

## Cost

Two Cloud Run services instead of one. With `minInstances: 0` on the backoffice backend,
idle cost is effectively zero — it scales to nothing when nobody is using it, which matches
how the control plane is actually used.
