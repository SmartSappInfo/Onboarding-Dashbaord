# Audit Remediation Plan

Companion to [`app_audit.md`](./app_audit.md). Findings are referenced by ID (F1–F15).

**Sequencing principle:** ordered by *current exposure*, not by effort. A hole that an anonymous
party can exploit with no credentials and no prior knowledge is closed before one that requires
discovering an internal identifier — even when the latter is the larger defect.

---

## Phase Overview

| Phase | Goal | Findings | Window | Blocking? |
| --- | --- | --- | --- | --- |
| **0** | Rotate exposed credentials | F1 | Day 1 | Yes — nothing else matters first |
| **1** | Close zero-effort public holes | F3, F4, F5, F10 | Week 1 | Yes |
| **2** | Purge secrets from git history | F1 | Week 1–2 | No (after Phase 0) |
| **3** | Establish a server-side session | F14 | Week 2–3 | Yes — Phase 4 depends on it |
| **4** | Authenticate all server actions | F2 | Week 3–8 | No |
| **5** | Credential and observability hardening | F6, F7, F8, F9 | Week 3–6 (parallel) | No |
| **6** | Code health | F11, F12, F13, F15 | Ongoing | No |

### A note on Phase 3 preceding Phase 4

The obvious order is to fix F2 (308 unauthenticated actions) immediately, using the existing
`requireOrgAdmin(idToken, orgId)` pattern where an ID token is threaded from the client as a
parameter.

**Do not do this.** It requires editing both sides of every call — roughly 308 actions plus each of
their client call sites — and produces a signature you will have to migrate a second time once a
real session exists. Building the session cookie first (Phase 3) means `requireAuth()` reads
identity from an `httpOnly` cookie server-side, so Phase 4 becomes a one-sided change:

```ts
// before
export async function doThing(userId: string, workspaceId: string) { ... }

// after — no client change at all
export async function doThing(workspaceId: string) {
  const { uid, profile } = await requireAuth();
  ...
}
```

One migration instead of two, and no client churn. The two-to-three week delay on F2 is acceptable
because exploiting a server action requires recovering its action ID from the client bundle, whereas
everything in Phase 1 is reachable with a bare `curl`.

---

## Phase 0 — Rotate Exposed Credentials

**Finding:** F1 · **Window:** Day 1 · **Code changes:** none

No deployment is required. This is console work plus a secret-store update.

### Steps

1. **Rotate each key in its provider console.** For each, create the new key first, update the
   secret store (step 2), verify, then revoke the old key — so there is no gap in service.

   | Key | Console | Revoke old after verifying |
   | --- | --- | --- |
   | `MNOTIFY_API_KEY` | mNotify dashboard | Yes — highest abuse value (SMS spend) |
   | `RESEND_API_KEY` | Resend → API Keys | Yes — domain reputation |
   | `ONESIGNAL_REST_API_KEY` | OneSignal → Settings → Keys | Yes — can push to all users |
   | `OPENAI_API_KEY` | platform.openai.com → API keys | Yes |
   | `GEMINI_API_KEY` | Google AI Studio / GCP console | Yes |
   | `OPENROUTER_API_KEY` | openrouter.ai → Keys | Yes |
   | `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens | Yes |

2. **Update the secret store.** Three of the seven are wired through Cloud Secret Manager in
   `apphosting.yaml` (`RESEND_API_KEY`, `MNOTIFY_API_KEY`, `ONESIGNAL_REST_API_KEY`):

   ```bash
   printf '%s' 'NEW_VALUE' | gcloud secrets versions add resend-api-key --data-file=-
   printf '%s' 'NEW_VALUE' | gcloud secrets versions add mnotify-api-key --data-file=-
   printf '%s' 'NEW_VALUE' | gcloud secrets versions add onesignal-rest-api-key --data-file=-
   ```

   Then redeploy so the new secret versions are picked up.

   **The other four do not reach production through environment variables at all.** This was traced
   through the code — see *Where the AI keys actually live* below. Do not add them to
   `apphosting.yaml`; that would be the wrong fix.

### Where the AI keys actually live

`src/ai/genkit.ts` resolves an AI provider key through a four-step precedence chain
(lines 194–245). Environment variables are the *last* fallback, not the source of truth:

| Priority | Source | Encrypted at rest? |
| --- | --- | --- |
| 1 | `organizations/{orgId}.geminiApiKey` / `.claudeApiKey` / `.openRouterApiKey` | **No — plaintext** (see F16) |
| 2 | `system_settings/ai_keys` — the backoffice global fallback | Yes — sealed via `sealSecret` |
| 3 | `process.env.GEMINI_API_KEY` / `OPENROUTER_API_KEY` | n/a |
| 4 | Built-in default instance | n/a |

**Consequence for rotation:** replacing the environment variable alone may change nothing, because a
Firestore-stored key at priority 1 or 2 silently wins. Conversely, if Firestore holds a key, the
leaked env value may be dormant — still worth revoking, but not the live credential.

**So, for `GEMINI_API_KEY` and `OPENROUTER_API_KEY`:**

- Rotate in the provider console, then update the value at **`/backoffice/settings/system-defaults`**
  (backed by `saveGlobalAiKeys` in `src/lib/backoffice/backoffice-ai-actions.ts`, which seals the
  value before writing). The UI reports only whether a key exists, never its value.
- **Also check every organization document** for a per-org override — those are set through
  Settings → Integrations (`OrganizationIntegrationsTab.tsx`) and take priority over everything else.
  Any org holding a leaked key needs updating individually.
- Update `process.env` too (local `.env`, and production if it is set there) so the last fallback is
  not a revoked key.

**`OPENAI_API_KEY` — revoke, do not replace.** It appears in `.env` but is read nowhere in the
codebase; `grep -rn "OPENAI_API_KEY" src scripts` returns nothing. It is dead configuration. Revoke
it in the OpenAI console and delete the line from `.env`/`.env.local`.

**`SENTRY_AUTH_TOKEN` — build-time only, currently inactive.** It is read in exactly one place,
`next.config.ts:209`, and only when `SENTRY_UPLOAD_SOURCEMAPS === 'true'`. That variable is set
nowhere in the repository — not in `apphosting.yaml`, not in CI — so the Sentry webpack plugin never
activates and no sourcemaps are uploaded. Revoke the token. Only mint a replacement if you want
sourcemap upload, in which case add both variables to `apphosting.yaml` with `availability: [BUILD]`.
(Caveat: a value could have been set directly in the Firebase App Hosting console rather than in
`apphosting.yaml`; check there before concluding it is unused.)

3. **Update local `.env` and `.env.local`** for every developer. These files are gitignored;
   confirm with `git check-ignore -v .env .env.local`.

4. **Review for abuse across the exposure window** (13 May 2026 → rotation date):
   - Resend → Logs: sends you do not recognise; check for domain reputation damage.
   - mNotify → usage and billing: unexpected SMS volume or unfamiliar destinations.
   - OneSignal → Delivery history: notifications your team did not send.
   - OpenAI / Gemini / OpenRouter → usage dashboards: spend anomalies.
   - Sentry → audit log: unfamiliar token activity.

5. **Decide on repository visibility.** Making the repo private does not un-leak anything already
   public, but it removes the next such mistake from public view. If it stays public, Phase 2
   becomes mandatory rather than advisable.

6. **Enable GitHub secret scanning with push protection**
   (Settings → Code security → Secret protection). This is what prevents a recurrence; the rest of
   this phase is cleanup.

### Definition of done

- [ ] `MNOTIFY_API_KEY`, `RESEND_API_KEY`, `ONESIGNAL_REST_API_KEY` rotated; new versions added to Cloud Secret Manager; redeployed.
- [ ] `GEMINI_API_KEY` and `OPENROUTER_API_KEY` rotated, updated at `/backoffice/settings/system-defaults`, **and** every per-org override checked and updated.
- [ ] `OPENAI_API_KEY` revoked and the line deleted from `.env` / `.env.local` (it is dead config).
- [ ] `SENTRY_AUTH_TOKEN` revoked; replacement minted only if sourcemap upload is wanted.
- [ ] All old keys revoked in their provider consoles.
- [ ] Production verified after rotation: send a test email, a test SMS, trigger one AI flow, fire one push notification.
- [ ] Abuse review completed and findings recorded — including "no anomalies found".
- [ ] Push protection enabled.

> **Verification tip.** `src/ai/genkit.ts` logs which tier supplied the key on every call —
> `[AI] Using Organization-specific key…`, `[AI] Using Backoffice global fallback key…`, or
> `[AI] Using Environment fallback key…`. Watch those lines after rotating to confirm which source is
> actually live; if you see "Organization-specific" for an org you did not update, that org is still
> holding a leaked key.

---

## Phase 1 — Close Zero-Effort Public Holes

**Findings:** F3, F4, F5, F10 · **Window:** Week 1

Everything here is exploitable with an unauthenticated HTTP request or a free account. Ship these as
four small, independently revertable PRs.

### 1.1 Authenticate three API routes (F3)

**`src/app/api/workspaces/[workspaceId]/contacts/route.ts`** — the guard already accepts exactly the
option needed:

```ts
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const auth = await authenticateApiRequest(request, { requiredWorkspaceId: workspaceId });
  if (!auth.success) return auth.errorResponse;

  // ... existing query, unchanged
}
```

**`src/app/api/migration/cleanup/route.ts`** and every other route under `src/app/api/migration/*`
(11 routes) — gate on system admin:

```ts
const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
if (!auth.success) return auth.errorResponse;
```

**`src/app/api/diagnostic/route.ts`** — delete it if it is a development leftover. If it is genuinely
used, apply the `requireSystemAdmin` guard above.

Client callers must send `Authorization: Bearer <idToken>`; the codebase's existing pattern is
`await user.getIdToken()` (see `src/app/admin/workforce/command-center/AiCommandCenterClient.tsx:53`).

**Verify:**
```bash
# Should return 401, not data
curl -s -o /dev/null -w '%{http_code}\n' \
  "$APP_URL/api/workspaces/any-id/contacts"
```

### 1.2 Repair the Firestore rules (F4)

**a. Remove the dead authorization term.** All 18 occurrences of `isAuthorized() || isSignedIn()`
reduce to `isSignedIn()`. Replace each with a workspace-scoped check. For the survey tree:

```
// before
allow read, list: if isAuthorized() || isSignedIn();

// after
allow get:  if isAuthorized() && (isSystemAdmin() || hasWorkspaceAccess(resource.data.workspaceId));
allow list: if isAuthorized() && (isSystemAdmin() || hasWorkspaceAccess(request.query.workspaceId));
```

Note `get` and `list` need separating: `resource.data` is unavailable on a `list`, so list queries
must be constrained by a query predicate the rule can read. Where that is impractical, restrict
`list` to `isSystemAdmin()` and have the application read through an authenticated API route instead.

**b. Fix the two over-permissive collections:**

```
// firestore.rules:2572
match /portal_waitlists/{waitlistId} {
  allow create: if true;                              // public sign-up — intended
  allow get, list: if isAuthorized() && (isSystemAdmin() || hasWorkspaceAccess(resource.data.workspaceId));
  allow update, delete: if isAuthorized() && isSystemAdmin();
}

// firestore.rules:769
match /webinar_questions/{questionId} {
  allow read, create: if true;                        // public Q&A — intended
  allow update, delete: if isAuthorized();            // was: update if true
}
```

**c. Audit every remaining `update: if true`.** On a public collection, `create: if true` is a
reasonable pattern; `update: if true` is not, because anyone who can guess a document ID may
overwrite another person's record. Affected: `office_hours_queue`, `meeting_polls/{id}/votes`,
`survey_sessions`, `surveySessions`, `/surveys/{id}/sessions`. Where resume-by-token behaviour is
genuinely required, gate the update on the caller proving knowledge of a secret token stored on the
document, not on the document ID alone.

**Verify** — add rules tests using the Firebase emulator (this becomes a CI job in Phase 6):

```bash
firebase emulators:exec --only firestore 'vitest run src/lib/__tests__/firestore-rules'
```

Minimum cases: an authenticated-but-unauthorized user cannot read another tenant's survey responses;
an anonymous user cannot `list` or `delete` `portal_waitlists`; an anonymous user cannot `update` an
existing `webinar_questions` document.

### 1.3 Escape interpolated values before rendering (F5)

Fix at the interpolation layer — the point where untrusted data meets a trusted template — rather
than at each of the render sites.

In `src/lib/survey-variable-utils.ts`, add an escaping variant and make it the default for any value
substituted into a string that will be rendered as HTML:

```ts
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Interpolate for an HTML sink: template is trusted, values are not. */
export function interpolateWithMapForHtml(
  text: string | undefined | null,
  valuesMap: VariableValuesMap,
  keepMissing = false,
): string {
  const escaped: VariableValuesMap = Object.fromEntries(
    Object.entries(valuesMap ?? {}).map(([k, v]) => [k, escapeHtml(String(v ?? ''))]),
  );
  return interpolateWithMap(text, escaped, keepMissing);
}
```

Then update the sinks:

- `src/app/surveys/[slug]/result/[submissionId]/page.tsx:221` and `:222` —
  use the escaping variant for `resolvedThankYouTitle` and `resolvedThankYouDescription`.
- `src/app/surveys/[slug]/result/components/ResultRenderer.tsx:595` — same.
- `src/app/surveys/[slug]/components/survey-form.tsx:769, 775, 1408` — same.
- `src/app/surveys/[slug]/result/[submissionId]/page.tsx:224` — `redirectUrl` must **not** be
  HTML-escaped but must be validated: resolve it, then reject anything whose scheme is not
  `http:`/`https:` and whose host is not on an allowlist. This closes the open redirect.

If a survey author legitimately needs rich text in the thank-you copy, keep the template's own HTML
intact (it is authored, and `sanitizeHtml` is available for it) while escaping only the substituted
values — which is exactly what the helper above does.

**As applied — two corrections to the sink list above.**

*One sink was missing from the plan.* `src/app/surveys/[slug]/components/survey-display.tsx:392`
renders `thankYouDescription` through `dangerouslySetInnerHTML` with raw `interpolateWithMap`
output, the same shape as the `ResultRenderer` hole. It is fixed too. The sweep that found it is
worth re-running after any change here:

```bash
for f in $(grep -rl "dangerouslySetInnerHTML" src); do
  grep -n "dangerouslySetInnerHTML" "$f" | grep -E "interpolateWithMap\(|interpolateText\("
done   # → must print nothing
```

*The shared helper could not simply be swapped.* In `survey-form.tsx` the local `interpolateText`
feeds **both** HTML sinks and plain-text JSX (placeholders, option labels, button text). Pointing it
at the escaping variant would have double-escaped the text sites, rendering a literal `&lt;` to
respondents. A sibling `interpolateHtml` was added in each of the two scopes instead, and only the
eight `dangerouslySetInnerHTML` call sites switched to it. Any future sink must opt in the same way —
`interpolateText` deliberately stays unescaped.

**Then audit the remaining sinks.** 25 files use `dangerouslySetInnerHTML` with no sanitizer in
file. Prioritise the public routes:

```bash
for f in $(grep -rl "dangerouslySetInnerHTML" src --include='*.tsx'); do
  grep -qE "DOMPurify|sanitizeHtml|sanitize\(" "$f" || echo "$f"
done
```

`src/app/pe/`, `src/app/preferences/`, `src/app/forms/`, `src/app/invoice/`, `src/app/surveys/`
first. Several inject `<style>` rather than markup — lower risk, but confirm the content cannot
contain `</style>`.

**Verify:** add a test that submits `<img src=x onerror=alert(1)>` as a survey answer and asserts the
rendered thank-you HTML contains `&lt;img` and not `<img`.

### 1.4 Restore the build guard rails (F10)

```diff
  // next.config.ts
  typescript: {
-   ignoreBuildErrors: true,
  },
```

The suite is already at zero `tsc` errors, so this is a no-op today and a regression guard tomorrow.

```diff
  // .npmrc
- minimum-release-age=0
+ minimum-release-age=1440
```

Mirror in `pnpm-workspace.yaml` (`minimumReleaseAge: 1440`). Keep the existing
`minimumReleaseAgeExclude` entries and add to that list when a specific package must be taken early —
that is the targeted escape hatch, rather than disabling the protection globally.

**Verify:** `pnpm build && pnpm typecheck && pnpm install --frozen-lockfile`

### Definition of done

- [x] The three routes return 401 unauthenticated; `/api/migration/*` requires system admin.
- [x] Zero occurrences of `isAuthorized() || isSignedIn()` remain: `grep -c "isAuthorized() || isSignedIn()" firestore.rules` → `0`.
- [x] `portal_waitlists` and `webinar_questions` corrected; every remaining `update: if true` reviewed and justified in a comment or removed.
- [x] Emulator rules tests cover cross-tenant read, anonymous list, anonymous update.
- [x] XSS test passes; `redirectUrl` scheme/host validated.
- [x] `ignoreBuildErrors` removed; build green.

**Deferred within Phase 1, tracked in the rules file.** `survey_sessions` and `surveySessions`
still carry `allow update: if true` so anonymous respondents can record progress; both are
annotated `TODO(F4): gate on a per-session token`. An anonymous writer can therefore still
overwrite another respondent's in-flight session, though it can no longer be *read* back
(`read, list` now require `isAuthorized()`). Properly closing this needs a per-session token,
which is cheapest to build alongside the session work in Phase 3 — do it there, not here.

---

## Phase 2 — Purge Secrets From Git History

**Finding:** F1 · **Window:** Week 1–2 · **Prerequisite:** Phase 0 complete

This is cleanup, not remediation — rotation is what closes the exposure. Sequence it after Phase 0
so that a delay here costs nothing.

### Steps

1. **Announce a freeze window.** History rewriting invalidates every clone. Coordinate with anyone
   holding a branch; have them push their work first.

2. **Merge or record all open PRs.** They will need to be recreated against the rewritten history.

3. **Rewrite:**
   ```bash
   # from a fresh clone, not your working copy
   git clone --mirror https://github.com/SmartSappInfo/Onboarding-Dashbaord.git
   cd Onboarding-Dashbaord.git

   git filter-repo \
     --path .env --path .env.local --path .env.test --path serviceAccountKey.json \
     --invert-paths

   git push --force --all
   git push --force --tags
   ```

4. **Every developer re-clones.** A `git pull` on an existing clone will resurrect the old objects.

5. **Ask GitHub Support to expire cached views.** Rewritten commits remain reachable by SHA through
   the API until GitHub garbage-collects them.

6. **Accept what cannot be undone.** Any existing fork, clone, or third-party mirror still holds the
   secrets. This is why Phase 0 is the real fix.

### Definition of done

- [ ] `git log --all --diff-filter=A -- .env .env.local .env.test serviceAccountKey.json` returns nothing.
- [ ] All developers on fresh clones; CI green on the rewritten history.
- [ ] `.env.test.example` still present — it is a committed template, not a secret.

### Dry-run findings (verified against a throwaway mirror)

**`.env.test` was missing from the path list above and has been added.** It was committed in
`91ab1d1d "Push Keys temporarily"` (2026-05-13). Its contents are placeholders rather than live
credentials, so it is not an exposure on its own, but it costs nothing to purge in the same pass.
Take care not to catch `.env.test.example` — that one is a deliberate template and must survive;
`--path` matches exact paths, so the four entries listed are safe as written.

**Only two commits ever added secret files:** `4706fda4` (2026-04-09) and `91ab1d1d` (2026-05-13).
Nine commits touch those paths in total.

**Exactly one commit is dropped, and it is the right one.** `964f45d0 "Service Key removed"` only
ever deleted the key, so stripping the path leaves it empty and `filter-repo` prunes it. Verified
per branch: `main` and `deployment` each go 1676 → 1675 commits, and nothing else disappears. Repo
size drops from ~60M to ~22M.

**Every SHA changes**, including the Phase 1 commit. Any branch, tag, open PR, CI pin, deploy
reference or bookmark that names a SHA must be recreated afterwards.

**Sequencing:** push all outstanding work to `origin` *before* the rewrite. The rewrite operates on
a mirror of `origin`, so anything still sitting unpushed locally is not included, and once `origin`
is rewritten that local work can no longer be merged without a rebase onto the new history.

---

## Phase 3 — Establish a Server-Side Session

**Finding:** F14 · **Window:** Week 2–3 · **Unblocks:** Phase 4

Today the server has no trusted identity: `src/proxy.ts` performs route classification only, and its
own comment states *"the actual authentication is handled client-side by Firebase."* This phase gives
every server entry point an identity by default rather than by remembering to ask.

### 3.1 Session-cookie mint and clear endpoints

Create `src/app/api/auth/session/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000; // 5 days — Firebase maximum is 14

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();
  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
  }

  try {
    // Reject a token minted long ago: require a recent sign-in for a long-lived cookie.
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ error: 'Recent sign-in required' }, { status: 401 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    });

    (await cookies()).set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: EXPIRES_IN_MS / 1000,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function DELETE() {
  (await cookies()).delete('__session');
  return NextResponse.json({ ok: true });
}
```

> **Cookie name.** Firebase App Hosting and Cloud Run strip most cookies from cached requests;
> `__session` is the one name that is preserved. Do not rename it.

> **CSRF.** `sameSite: 'lax'` blocks cross-site POSTs. Next.js Server Actions additionally verify the
> `Origin` header against `Host` by default. Do not disable that check.

### 3.2 The `requireAuth` helper

Create `src/lib/auth/require-auth.ts`. This is the function Phase 4 migrates 308 files onto, so its
shape matters more than anything else in this plan.

```ts
import { cookies } from 'next/headers';
import type { UserProfile } from '@/lib/types';

export interface AuthContext {
  uid: string;
  profile: UserProfile;
  isSystemAdmin: boolean;
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/**
 * Resolve the caller's verified identity from the session cookie.
 *
 * Server Actions are public endpoints. Call this at the top of every action that
 * touches adminDb — never accept a userId/actorId as a parameter (see F2).
 */
export async function requireAuth(): Promise<AuthContext> {
  const cookie = (await cookies()).get('__session')?.value;
  if (!cookie) throw new UnauthorizedError('Not signed in.');

  const { adminAuth, adminDb } = await import('@/lib/firebase-admin');

  let uid: string;
  try {
    // checkRevoked: true — a disabled or signed-out user is rejected immediately.
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    uid = decoded.uid;
  } catch {
    throw new UnauthorizedError('Session expired or revoked.');
  }

  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new UnauthorizedError('No user profile.');

  const profile = { id: snap.id, ...snap.data() } as UserProfile;
  if (!profile.isAuthorized) throw new ForbiddenError('Account pending approval.');

  return {
    uid,
    profile,
    isSystemAdmin: !!profile.permissions?.includes('system_admin'),
  };
}

/** Verified identity plus a workspace membership check. */
export async function requireWorkspace(workspaceId: string): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.isSystemAdmin) return ctx;
  if (!(ctx.profile.workspaceIds ?? []).includes(workspaceId)) {
    throw new ForbiddenError('No access to this workspace.');
  }
  return ctx;
}
```

### 3.3 Set the cookie on sign-in, clear it on sign-out

In every sign-in path — `src/app/login/page.tsx`, `src/app/signup/page.tsx`, and the two portal flows
— after Firebase authentication succeeds:

```ts
const idToken = await userCredential.user.getIdToken();
await fetch('/api/auth/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
});
```

On sign-out, call `DELETE /api/auth/session` before `signOut(auth)`.

Add a refresh path: Firebase ID tokens expire hourly while the session cookie lives for days. Use
`onIdTokenChanged` to re-POST the session endpoint when the token refreshes, so a revoked account
loses server access promptly.

### 3.4 Enforce in `proxy.ts`

Replace the comment-only protection with a real check. Keep the existing public-route list:

```ts
const sessionCookie = request.cookies.get('__session');
if (!sessionCookie) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('returnTo', pathname);
  return NextResponse.redirect(url);
}
```

> Verify **presence** only in the proxy — it runs on the Edge runtime, where `firebase-admin` is
> unavailable. Cryptographic verification happens in `requireAuth()` on the Node runtime. The proxy
> is a redirect convenience, never the security boundary.

### Definition of done

- [x] Sign-in sets `__session`; sign-out clears it; refresh keeps it current.
- [x] `requireAuth()` unit-tested: missing cookie, expired cookie, revoked session, missing profile, `isAuthorized: false`.
- [x] Protected routes redirect to `/login` when the cookie is absent.
- [x] All existing e2e specs still pass (`pnpm test:e2e`) — see the note on the two pre-existing failures.

### As applied — five deviations from the plan above

**1. Session sync is centralised, not per-call-site.** §3.3 says to edit every sign-in path. There
are six sign-in call sites and nine sign-out call sites, and a missed one is an account with no
server identity. Instead `src/firebase/provider.tsx` switches `onAuthStateChanged` →
`onIdTokenChanged`, which fires on sign-in, sign-out *and* refresh, and calls `syncSessionCookie()`
(`src/firebase/session-sync.ts`). One subscription covers every path, including ones added later.

**2. The cookie is NOT re-minted on token refresh — §3.1 and §3.3 contradict each other.** The mint
endpoint rejects an `auth_time` older than five minutes, but `auth_time` records when the user
*authenticated*, not when the current ID token was minted. An hourly refresh therefore carries the
original `auth_time`, so the re-POST that §3.3 asks for would 401 for the entire life of the session.
We mint only while `auth_time` is fresh. Nothing is lost: revocation stays prompt because
`requireAuth()` verifies with `checkRevoked: true` on *every* call, and if the cookie expires while
the Firebase session persists, `proxy.ts` bounces the user to `/login`, where signing in produces a
fresh `auth_time`. The flow self-heals instead of looping on a request the server always rejects.

**3. `keepalive: true` on both session requests.** Sign-out is almost always followed by an immediate
navigation, which cancels in-flight `fetch`. A cancelled DELETE would leave a valid session cookie
alive for its full five days *after* the user believes they signed out.

**4. `proxy.ts` uses an allowlist of PROTECTED prefixes, not "everything not public".** The existing
public list omits `/`, `/forgot-password`, `/accept-invitation`, `/preferences`, `/quotes`,
`/statement`, `/portal` and most marketing pages. Inverting it would have redirected visitors away
from the homepage and broken password-reset and invitation links. Missing a prefix costs a redirect
convenience, not a security hole — `requireAuth()` is the boundary. 43 tests pin both directions.

**5. The redirect param is `redirect`, not `returnTo`.** `src/app/login/page.tsx` reads
`searchParams.get('redirect')` and passes it through `safeInternalRedirect()`. A `returnTo` param
would have been silently ignored, dropping the user on the default landing page. The query string is
carried through too, so filters survive the round trip.

### Verification

- 16 `requireAuth()` unit tests; 43 proxy tests; full suite green (581 files, 4293 tests).
- Live against `next dev`: `/dashboard` without a cookie → `307 → /login?redirect=%2Fdashboard`;
  `/` → 200; `POST /api/auth/session` → 400 without a token, 401 on a bogus one; `DELETE` returns
  `__session=; Max-Age=0; HttpOnly; SameSite=lax`.
- e2e: 14 of 16 passed. The two failures (`auth.spec.ts` invalid-credentials on chromium, and the
  login heading on mobile-safari) reproduce identically with Phase 3 stashed, so they are
  pre-existing and unrelated.

### Two things to know before deploying

**Every currently signed-in user gets bounced to `/login` once.** They hold a persisted Firebase
session but no `__session` cookie, and their `auth_time` is stale, so no cookie is minted until they
sign in again. There is no redirect loop — `/login` does not auto-redirect an authenticated user —
but it is a one-time re-login for the entire active user base.

**Phase 3 does not close F2 on its own.** A forged cookie still gets past `proxy.ts` (presence-only)
and renders a protected page shell, because the pages and actions do not call `requireAuth()` yet.
This phase builds the mechanism; Phase 4 applies it to the 327 server actions. Until then the
Server Actions remain as exposed as before.

---

## Phase 4 — Authenticate All Server Actions

**Finding:** F2 · **Window:** Week 3–8 · **Prerequisite:** Phase 3

308 files to migrate. Do it in risk-ordered batches, each its own PR, each shippable alone.

### The migration, per action

```ts
// before
export async function updateDeal(userId: string, workspaceId: string, data: DealInput) {
  const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
  if (!permission.granted) return { success: false, message: permission.reason };
  ...
}

// after — caller can no longer choose who they are
export async function updateDeal(workspaceId: string, data: DealInput) {
  const { uid } = await requireWorkspace(workspaceId);
  const permission = await canUser(uid, 'operations', 'pipeline', 'edit', workspaceId);
  if (!permission.granted) return { success: false, message: permission.reason };
  ...
}
```

Three rules:

1. **Delete the identity parameter.** Do not leave it accepted-but-ignored — a later edit will start
   trusting it again.
2. **Keep the existing `canUser` call**, feeding it the verified `uid`. The permission model is
   sound; only its input was untrusted.
3. **Update call sites to drop the argument.** TypeScript finds these for you once the parameter is
   gone — which is why `ignoreBuildErrors` had to go in Phase 1.

### Batch order

| Batch | Scope | Why first |
| --- | --- | --- |
| **4a** | `src/app/actions/*-fer-action.ts`, `*-migration-*`, `backfill-*`, `purge-*`, `seed-*` | Destructive, cross-tenant, unauthenticated. `purge-focal-persons-fer-action.ts` is the worst single case. |
| **4b** | Billing, credentials, API keys, org settings, user/permission management | Privilege escalation and financial impact |
| **4c** | Messaging and campaign dispatch (SMS, email, WhatsApp, push) | Real spend; reputational damage |
| **4d** | Deals, entities, contacts, pipelines — the CRM core | Largest data surface |
| **4e** | Everything else | Long tail |

Track progress with the same measurement used in the audit:

```bash
tot=0; guard=0
for f in $(grep -rl "use server" src --include='*.ts'); do
  grep -qE "adminDb|adminAuth" "$f" || continue
  tot=$((tot+1))
  grep -qE "requireAuth|requireWorkspace|requireOrgAdmin|requireSystemAdmin|verifyIdToken" "$f" \
    && guard=$((guard+1))
done
echo "$guard / $tot server-action files authenticate the caller"
```

Baseline: `19 / 327`. Target: `327 / 327`.

> **The script above undercounts — add `authorizeBackoffice` to the pattern.** This codebase
> already had a correct server-side guard, `authorizeBackoffice(idToken, module, action)` in
> `src/lib/backoffice/backoffice-auth.ts`, which the audit's regex does not match. Files guarded
> that way were scored as unguarded. Use:
>
> ```bash
> grep -qE "requireAuth|requireWorkspace|requireOrgAdmin|requireSystemAdmin|verifyIdToken|authorizeBackoffice" "$f"
> ```
>
> With the corrected pattern the count after Phase 4a is **55 / 326**. (The denominator drops by
> one because `seed-all-workspaces-fields-fer-action.ts` no longer touches `adminDb` directly —
> its body moved to `src/lib/migrations/`.)

### Make the fix permanent

A migration this size regresses unless the old shape becomes impossible. Add a lint rule that fails
CI when an action accepts an identity parameter — `no-restricted-syntax` is sufficient:

```js
// eslint.config.js — applied to src/app/actions/**
{
  files: ['src/app/actions/**/*.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector:
        'ExportNamedDeclaration > FunctionDeclaration > Identifier.params[name=/^(userId|actorId|currentUserId|performedBy)$/]',
      message:
        'Server Actions are public endpoints. Derive identity with requireAuth() — never accept it as a parameter. See docs/audit/app_audit_fix.md (F2).',
    }],
  },
}
```

Enable it at the start of Phase 4, scoped to the directories already migrated, and widen the scope as
each batch lands. That way it never blocks work in progress but permanently locks in completed work.

> **Verified against this codebase.** The selector above was tested with the project's own ESLint
> config: it flags `export async function bad(userId: string, ...)` and leaves
> `export async function good(workspaceId: string)` alone. It matches `FunctionDeclaration` only,
> which is sufficient here — all 717 exported actions under `src/app/actions/` use
> `export async function`, and none use `export const x = async () => {}`. If that convention ever
> changes, add a second selector for `VariableDeclarator > ArrowFunctionExpression`.

### Definition of done

- [ ] The progress script reports `327 / 327`. — **in progress: 55 / 326** (was 16 / 326).
- [ ] No file under `src/app/actions/` accepts `userId`/`actorId`/`currentUserId`/`performedBy`.
      — **done for batch 4a**; 4b–4e outstanding.
- [ ] The lint rule is active for all of `src/app/actions/**` and CI fails on violation.
      — **active for the 4a globs**, widening as each batch lands.
- [x] Full suite green; e2e green. — 581 files / 4295 tests green after 4a.

---

### Batch 4a — complete

24 of 24 destructive migration/seed/backfill/purge action files now authenticate the caller.

**Use `authorizeBackofficeSession`, not `requireSystemAdmin`.** The plan's `requireAuth`/
`requireSystemAdmin` shape would have broken the backoffice. Access there is granted by *either*
`permissions: ['system_admin']` *or* a separate `backofficeRoles` field evaluated against
`ROLE_MATRIX` — so operators holding `backofficeRoles` but not `system_admin` legitimately run these
tools, and gating on system admin alone would have locked them out. A new
`authorizeBackofficeSession(module, action)` was added alongside the existing token-based
`authorizeBackoffice`: same role matrix, same trust model, but it reads the Phase 3 `__session`
cookie so actions need no identity argument and call sites need no token threading.

**Eight actions accepted a `userId` and now derive it.** `purge-focal-persons`,
`purge-legacy-fields`, `strip-account-status`, `strip-lifecycle-status`, `template-identifiers`,
`unexpire-import-payloads`, `workspace-scope-migration` and `seed-all-workspaces-fields`. The worst,
`executePurgeFocalPersonsFerAction(userId)`, irreversibly stripped `focalPerson` / `focalPersons` /
`contactPersons` from **every entity in every tenant** and wrote the caller's chosen name to the
audit log. The three backoffice components that passed `profile?.id || 'system_backoffice'` now pass
nothing.

**Two call paths would have broken, and were preserved by splitting the core out of the action.**
A Server Action's guard reads a session cookie, which neither of these has:

- `pnpm migrate:workspace-fields` (`src/app/seeds/migrate-workspace-fields.ts`) runs from the CLI.
  The migration body moved to `src/lib/migrations/seed-all-workspaces-fields.ts`; the action is now
  a thin authenticated wrapper, and the CLI calls the core directly.
- `/api/admin/backfill-document-cta` authenticates with a **bearer token** and already enforces
  system admin. Adding a cookie-based guard inside the action would have broken it, so
  `backfill-document-cta-action.ts` exports `runDocumentCtaBackfillCore` for callers that have
  already authenticated, while the Server Action wrapper stays guarded.

One behaviour change worth knowing: `/admin/media` auto-fires the CTA backfill on mount for any
admin. That call is now authorised, so for users without backoffice rights it fails and is swallowed
by the existing `.catch()` — the global backfill simply stops running for them, which is the intent
of the fix rather than a regression, but it does mean the auto-trigger is no longer universal.

---

## Phase 5 — Credential and Observability Hardening

**Findings:** F6, F7, F8, F9 · **Window:** Week 3–6, parallel with Phase 4

Independent of each other; assign separately.

### 5.1 Replace the extension token (F6)

- Generate server-side in a new action: `crypto.randomBytes(32).toString('base64url')`.
- Store only `sha256(token)` on the workspace document; compare hashes on lookup.
- Move transmission from `?token=` to an `Authorization: Bearer` header in
  `src/app/api/lead-intelligence/extension/{sync,scan,download}/route.ts`.
- Show the plaintext value once, at creation, and never again.
- Invalidate all existing `chromeExtensionToken` values — they were generated with `Math.random()`
  and must be treated as compromised.

### 5.2 Fix certificate codes (F7)

This is a data-integrity fix before a security one — a collision currently shows the wrong person's
credential as valid.

- Replace `Math.floor(1000 + Math.random() * 9000)` with
  `crypto.randomBytes(8).toString('base64url')` (or a checksummed alphanumeric of at least 12
  characters if the code must stay human-readable).
- **Enforce uniqueness structurally:** make the verification code the Firestore document ID, so a
  duplicate write fails rather than silently creating a second match. Then replace the
  `.where(...).limit(1)` lookup at `credential-service.ts:177` with a direct `.doc(code).get()`.
- **Backfill:** scan `issued_certificates` for existing duplicate `verificationCode` values before
  migrating; any collision already issued needs a new code and a reissued certificate.
- Rate-limit `/portal/{slug}/verify/{code}` to frustrate enumeration.

### 5.3 Remove the hardcoded superadmin (F8)

- Set a custom claim instead: `adminAuth.setCustomUserClaims(uid, { admin: true })`.
- In `firestore.rules`, replace every `request.auth.token.email == 'admin@smartsapp.com'` with
  `request.auth.token.admin == true`.
- Remove the bootstrap branch in `src/lib/auth/api-auth-guard.ts` that fabricates an admin profile
  for a user with no Firestore record.
- If any email comparison survives anywhere, it must also require
  `request.auth.token.email_verified == true` — currently that string appears nowhere in the rules.
- Sweep all 26 occurrences: `grep -rn "admin@smartsapp.com" src firestore.rules`.

### 5.4 Report errors (F9)

- Add `Sentry.captureException(error, { extra: { ... } })` to catch blocks in the paths where silent
  failure costs most: messaging dispatch, `src/lib/automation-processor.ts`, webhook handlers,
  billing and payments.
- Stop returning raw `error.message` to clients — 22 API routes and 47 actions currently do. Return
  an opaque message plus a correlation ID; log the detail server-side.
- Consider a small `logError(scope, error, context)` wrapper so this is one call, not two, and so the
  remaining `console.error` sites can be migrated mechanically.

### Definition of done

- [ ] No `Math.random()` in any credential, token or verification-code path.
- [ ] Existing extension tokens invalidated; certificate duplicates identified and reissued.
- [ ] `grep -rn "admin@smartsapp.com" src firestore.rules` returns nothing.
- [ ] Sentry receives errors from messaging, automation and webhook paths (verify with a deliberate test throw).
- [ ] No endpoint returns a raw `error.message`.

---

## Phase 6 — Code Health

**Findings:** F11, F12, F13, F15 · **Window:** Ongoing

Lower urgency, but F12 and F14 are why the critical findings stayed hidden.

### 6.1 Clear the lint backlog (F12)

1. `pnpm lint --fix` clears most of the 4,597 unused variables and 350 unescaped entities.
2. Triage the 161 `react-hooks/exhaustive-deps` warnings individually — these are real stale-closure
   bugs, not noise. Do not blanket-disable.
3. Ratchet `--max-warnings` down from 9999 as the count falls, so it cannot climb back.

### 6.2 Reduce `any` (F11)

Start with the 381 `catch (error: any)` sites — mechanical, and they overlap exactly with the error
handling in 5.4. Convert to `catch (error: unknown)` with a shared narrowing helper. Then enable
`@typescript-eslint/no-explicit-any` as a warning and ratchet.

### 6.3 Split `types.ts` (F13)

9,001 lines and 586 exports, imported nearly everywhere. Split by domain
(`types/deals.ts`, `types/surveys.ts`, `types/messaging.ts`, …) behind a re-exporting
`types/index.ts` barrel, so no call site changes. Expect a measurable improvement in incremental
typecheck and build memory — the build currently needs `--max-old-space-size=4096`.

### 6.4 Delete the scratch files (F15)

```bash
git rm --cached campaign-wizard.tsx.bak src/lib/__tests__/*.test.ts.bak
git rm --cached fix_*.py fix_*.cjs patch_*.cjs refactor*.js test-*.cjs test-*.js scratch-*.ts
git rm --cached lint_output.txt diff.txt tsc-errors.txt tsc_output.txt \
               build-output.log scripts_output.log extracted_text.txt
git rm --cached Top_Gospel_*.docx
```

Add to `.gitignore`: `*.bak`, `*_output.txt`, `*-output.log`, `tsc*.txt`. Move any codemod worth
keeping into `scripts/` with a one-line header explaining what it was for.

The `.bak` files are the priority — they are dead copies of live modules that project-wide search
will surface as though current.

### 6.5 Add a rules test job to CI

A 4,208-line rules file with 509 match blocks cannot be reviewed by eye; F4 is the proof. Add a
fourth job to `.github/workflows/ci.yml` alongside the existing three:

```yaml
  firestore-rules:
    name: Firestore Rules
    runs-on: ubuntu-latest
    steps:
      # ... checkout / pnpm / node setup, as in the other jobs
      - run: pnpm dlx firebase-tools emulators:exec --only firestore 'pnpm vitest run src/lib/__tests__/firestore-rules'
```

Also consider adding a secret-scanning step (`gitleaks`) so F1 cannot recur silently.

### Definition of done

- [ ] Lint warnings under 500 and `--max-warnings` ratcheted to match.
- [ ] `catch (error: any)` eliminated.
- [ ] `types.ts` split; build memory ceiling reduced.
- [ ] Scratch files removed and gitignored.
- [ ] Rules job green in CI.

---

## Tracking

| ID | Phase | Status | Owner |
| --- | --- | --- | --- |
| F1 rotate | 0 | ☐ | |
| F1 history | 2 | ☐ | |
| F3 routes | 1.1 | ☐ | |
| F4 rules | 1.2 | ☐ | |
| F5 XSS | 1.3 | ☐ | |
| F10 build guards | 1.4 | ☐ | |
| F14 session | 3 | ☐ | |
| F2 actions | 4 | ☐ | |
| F6 ext token | 5.1 | ☐ | |
| F7 cert codes | 5.2 | ☐ | |
| F8 admin email | 5.3 | ☐ | |
| F16 per-org AI keys | 5.5 | ☐ | |
| F9 Sentry | 5.4 | ☐ | |
| F12 lint | 6.1 | ☐ | |
| F11 any | 6.2 | ☐ | |
| F13 types.ts | 6.3 | ☐ | |
| F15 scratch | 6.4 | ☐ | |

**Regression guards installed by this plan** — the parts that keep the fixes fixed:

1. GitHub push protection (Phase 0) → F1 cannot recur.
2. `ignoreBuildErrors` removed (Phase 1.4) → type regressions fail the build.
3. Firestore rules CI job (Phase 6.5) → rule regressions fail CI.
4. `no-restricted-syntax` lint rule (Phase 4) → F2 cannot recur.
5. Ratcheted `--max-warnings` (Phase 6.1) → warning count cannot climb.
