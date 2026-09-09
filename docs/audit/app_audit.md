# Application Code Audit

**Scope:** Whole application — `src/` (3,792 TS/TSX files, ~972k lines), `firestore.rules`, API routes, server actions, build and CI configuration.
**Commit reviewed:** `36ece32c` (branch `main`)
**Date:** 9 September 2026
**Method:** Static review plus local execution of `tsc --noEmit`, `eslint`, `vitest run`, and `npm audit`. No code was run against production data.

---

## Executive Summary

Automated quality gates are all green. The failures are concentrated in areas that automation does not check: authentication boundaries, Firestore rule logic, and secret hygiene.

| Signal | Result |
| --- | --- |
| Vitest suite | **4,205 passing**, 88 skipped, 0 failing (583 files, 103s) |
| `tsc --noEmit` under `strict` | **0 errors** |
| ESLint | **0 errors**, 5,237 warnings |
| `npm audit` | No high-severity advisories |
| Live API keys in public git history | **7, unrotated** |
| Server-action files using `adminDb` without authenticating the caller | **308 of 327** |
| Firestore rules whose authorization term is dead code | **18** |

The single most urgent item is credential rotation (F1). It requires no code change and can be completed today.

---

## Severity Definitions

- **Critical** — exploitable now by an unauthenticated party over the internet, or an active credential exposure.
- **High** — exploitable with modest effort, or a correctness defect affecting user-visible data.
- **Medium** — structural problems that raise the cost of every future change and conceal defects of the classes above.

---

## Critical Findings

### F1 — Seven live API keys are published in this repository's git history

**Evidence.** Commit `91ab1d1d` ("Push Keys temporarily", 13 May 2026) added `.env`, `.env.local`, and `serviceAccountKey.json`. Commit `4706fda4` (9 April 2026) had previously added `serviceAccountKey.json`. All three paths are now correctly listed in `.gitignore` and are absent from `HEAD`, but they remain in history.

The repository is public — `https://api.github.com/repos/SmartSappInfo/Onboarding-Dashbaord` returns `"private": false`, `"visibility": "public"`.

Comparing each secret in commit `91ab1d1d` against the value currently in `.env` (by hash, values never printed):

| Variable | Status |
| --- | --- |
| `GEMINI_API_KEY` | **Unchanged since the leak** |
| `OPENROUTER_API_KEY` | **Unchanged since the leak** |
| `OPENAI_API_KEY` | **Unchanged since the leak** |
| `MNOTIFY_API_KEY` | **Unchanged since the leak** |
| `RESEND_API_KEY` | **Unchanged since the leak** |
| `SENTRY_AUTH_TOKEN` | **Unchanged since the leak** |
| `ONESIGNAL_REST_API_KEY` | **Unchanged since the leak** |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Rotated ✓ (`private_key_id` differs) |

**Impact.** The AI provider keys are metered spend. `MNOTIFY_API_KEY` and `RESEND_API_KEY` permit a third party to send SMS and email under your identity and domain reputation. `ONESIGNAL_REST_API_KEY` permits sending a push notification to every user of the application. `SENTRY_AUTH_TOKEN` permits reading and modifying error-tracking data.

**Where each key is configured** *(traced 9 September 2026 while preparing Phase 0):*

| Key | Production source | Rotation target |
| --- | --- | --- |
| `RESEND_API_KEY` | Cloud Secret Manager (`apphosting.yaml`) | `gcloud secrets versions add` + redeploy |
| `MNOTIFY_API_KEY` | Cloud Secret Manager (`apphosting.yaml`) | Same |
| `ONESIGNAL_REST_API_KEY` | Cloud Secret Manager (`apphosting.yaml`) | Same |
| `GEMINI_API_KEY` | **Firestore, not env** — see below | Backoffice UI **and** per-org documents |
| `OPENROUTER_API_KEY` | **Firestore, not env** — see below | Backoffice UI **and** per-org documents |
| `OPENAI_API_KEY` | **Read nowhere in the codebase** | Revoke only; delete from `.env` |
| `SENTRY_AUTH_TOKEN` | Build-time only, and currently inactive | Revoke only |

`src/ai/genkit.ts:194-245` resolves AI keys through a four-tier chain in which environment variables
are the *last* fallback: per-organization document → `system_settings/ai_keys` (backoffice global) →
`process.env` → built-in default. Rotating the environment variable alone therefore may change
nothing. `OPENAI_API_KEY` has no reader in `src/` at all, and `SENTRY_AUTH_TOKEN` is gated on
`SENTRY_UPLOAD_SOURCEMAPS === 'true'`, which is set nowhere in the repository.

See [`app_audit_fix.md` § Where the AI keys actually live](./app_audit_fix.md#where-the-ai-keys-actually-live) for the rotation procedure this implies, and F16 below for a defect found during the same trace.

---

### F2 — Server actions accept caller-supplied identity as proof of authorization

**Evidence.** Next.js Server Actions are public HTTP endpoints. Of 442 files containing `'use server'`, 327 import `adminDb` or `adminAuth` — the Firebase Admin SDK, which bypasses Firestore security rules entirely. Of those 327, **19 verify the caller's identity** (via `verifyIdToken`, `requireOrgAdmin`, `requireSystemAdmin`, or `authenticateApiRequest`).

The authorization logic itself is well built and is genuinely invoked. `src/app/actions/deal-actions.ts` calls `canUser(userId, 'operations', 'pipeline', 'edit', workspaceId)` at nine separate call sites (lines 328, 867, 947, 992, 1106, 1147, 1214, 1354, 1423). The defect is that `userId` is a function parameter supplied by the caller:

```ts
// src/app/actions/purge-focal-persons-fer-action.ts:9
export async function executePurgeFocalPersonsFerAction(userId: string): Promise<{...}> {
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({ ..., executedBy: userId }, { merge: true });
  // ...
  let q = adminDb.collection('entities').limit(BATCH_SIZE);   // every tenant
```

No token is verified. `userId` is used only to populate the audit log.

**Impact.** Every permission check of this shape answers "does user X hold this permission?" where X is whoever the caller claims to be. An attacker supplies a known administrator's UID and every check passes. 27 files across `src/app/actions` and `src/lib` accept an identity parameter of this kind.

**Note.** The rule is already documented in the codebase. `src/lib/auth/require-org-admin.ts` opens with: *"Server Actions are public endpoints — auth MUST be verified inside the action, not just by page/layout guards."*

---

### F3 — Three API routes perform privileged operations with no authentication

**Evidence.** 13 of 83 API routes call a token-verifying guard. The majority of the remainder are legitimately public or use an appropriate alternative: webhook signature verification, OAuth callbacks, `CRON_SECRET` header checks (`/api/cron/*`), a handshake signature (`/api/automations/bulk-trigger`), and API-key lookup (`/api/external/v1/entities`). The following three have no authentication of any kind:

```
GET  /api/workspaces/[workspaceId]/contacts
     src/app/api/workspaces/[workspaceId]/contacts/route.ts
     adminDb.collection('workspace_entities').where('workspaceId','==',workspaceId)
     Returns: displayName, primaryEmail, primaryPhone, status, workspaceTags,
              assignedTo, lastContactedAt
     workspaceId is taken directly from the URL path.

POST /api/migration/cleanup      src/app/api/migration/cleanup/route.ts
     Calls cleanupOldMigrationLogs(retentionDays) — destructive, body-controlled.

GET  /api/diagnostic             src/app/api/diagnostic/route.ts
     Dumps automation_runs and automation_jobs.
```

**Impact.** The contacts route is a personal-data disclosure for any tenant whose workspace ID is known. Workspace IDs appear in client-side URLs throughout the admin application, so they are not secret.

---

### F4 — Eighteen Firestore rules contain a dead authorization term

**Evidence.** The helper functions in `firestore.rules` are defined so that `isAuthorized()` strictly implies `isSignedIn()`:

```
function isSignedIn()   { return request.auth != null; }
function isAuthorized() { return isSignedIn() && ( ... isAuthorized flag ... ); }
```

Therefore `isAuthorized() || isSignedIn()` is logically equivalent to `isSignedIn()` alone. The left operand can never change the result. This pattern occurs 18 times:

| Line | Collection |
| --- | --- |
| 1018, 1019 | `/surveys/{surveyId}` |
| 1024 | `/surveys/{id}/responses/{rId}` |
| 1028 | `/surveys/{id}/sessions/{sId}` |
| 1031 | `/surveys/{id}/summaries/{sId}` |
| 1035 | `/surveys/{id}/resultPages/{pId}` |
| 1038, 1039 | `/surveys/{id}/versions/{vId}` |
| 1042 | `/surveys/{id}/ai_insights/{insightId}` |
| 1045 | `/surveys/{id}/ai_audits/{auditId}` |
| 1048 | `/surveys/{id}/experiments/{experimentId}` |
| 1051 | `/surveys/{id}/retention_waves/{waveId}` |
| 1056 | `/survey_projects/{projectId}` |
| 1060, 1061 | `/question_bank/{questionId}` |
| 1657 | `/activities/{activityId}` (create) |
| 1988 | `/survey_sessions/{sId}` |
| 1992 | `/surveySessions/{sId}` |

Self-service registration is open — `createUserWithEmailAndPassword` is called in `src/app/signup/page.tsx:74`, `src/app/portal/[slug]/join/PortalJoinClient.tsx:126`, and `src/app/portal/[slug]/components/PortalAuthModal.tsx:104`.

**Impact.** Any member of the public may register an account and then read survey responses, sessions, summaries and AI insights **across every tenant**. The `isAuthorized` approval flag — the very control being bypassed — offers no protection.

> **Correction (9 September 2026, during Phase 1 remediation).** The original write-up
> understated this. Nine of the eighteen rules grant `write`, not merely `read` — including
> `/surveys/{id}/summaries`, `/resultPages`, `/versions`, `/ai_insights`, `/ai_audits`,
> `/experiments`, `/retention_waves`, `/survey_projects` and `/question_bank`. Any self-registered
> account could therefore **modify or delete** other tenants' survey content, not just read it.
> Fixed in Phase 1.2 by scoping all of them through a new `canAccessSurvey(surveyId)` helper.

**Related rules in the same file:**

```
firestore.rules:2572   /portal_waitlists/{waitlistId}
                       allow get, list, create, update, delete: if true;
firestore.rules:769    /webinar_questions/{questionId}
                       allow read, create, update: if true;
```

`portal_waitlists` permits unauthenticated enumeration, modification and deletion of the entire collection. `webinar_questions` permits any party to overwrite another person's submission. Several other collections (`office_hours_queue`, `meeting_polls/votes`, `survey_sessions`) allow unauthenticated `update`, which lets anyone who can guess a document ID overwrite another person's record.

Additionally, `email_verified` does not appear anywhere in the 4,208-line rules file.

---

### F5 — Survey answers reach `dangerouslySetInnerHTML` without escaping

**Evidence.** Sanitization is applied on write (`src/app/admin/surveys/components/question-editor.tsx:199` calls `sanitizeHtml`), and the page-builder applies `lib/page-builder/sanitize.ts` consistently across every block type. However, variable interpolation occurs on read — after sanitization — and does not escape:

1. An anonymous respondent submits an answer. Firestore rules permit this by design.
2. `src/app/surveys/[slug]/result/[submissionId]/page.tsx:212` writes the raw value into the variable map:
   `valuesMap.set(q.id, valStr)`
3. Line 221 substitutes it into the survey's thank-you copy:
   `FieldsVariablesService.resolveTextWithMap(survey.thankYouDescription, valuesMap)`
   `thankYouDescription` is not sanitized on write either.
4. `src/app/surveys/[slug]/result/components/ResultRenderer.tsx:595` renders the result through `dangerouslySetInnerHTML`.

**Impact.** Any survey whose thank-you copy contains a `{{question_id}}` placeholder is a stored-XSS sink. The payload executes on a public page and, more consequentially, in the authenticated session of any staff member who opens the submission for review. Because authentication in this application is client-side Firebase, the ID token is available in browser storage.

`redirectUrl` at line 224 passes through the same unescaped substitution, giving an open-redirect vector.

**Related.** 25 files use `dangerouslySetInnerHTML` with no sanitizer imported in the same file. Those under `src/app/surveys/`, `src/app/forms/`, `src/app/invoice/` and `src/app/pe/` render on public routes.

---

## High Findings

### F6 — An API bearer token is generated with `Math.random()` in the browser

```
src/app/admin/lead-intelligence/LeadIntelligenceClient.tsx:204
  const newToken = `tok_${Math.floor(Date.now()/1000)}_${Math.random().toString(36).substring(2,15)}`;

src/app/api/lead-intelligence/extension/sync/route.ts:30
  .where('chromeExtensionToken','==',token)          ← this token is the route's only authentication

src/app/admin/lead-intelligence/components/SettingsTab.tsx:475
  href={`/api/lead-intelligence/extension/download?workspaceId=${activeWorkspaceId}&token=${settings.chromeExtensionToken}`}
```

`Math.random()` is implemented as xorshift128+ in V8. It is not a cryptographically secure generator and its internal state is recoverable from observed output. Half the token is a second-resolution timestamp, further reducing entropy. Transmitting it as a URL query parameter leaks it to server logs, intermediate proxies and `Referer` headers.

### F7 — Certificate verification codes collide, and lookup silently returns the wrong holder

```
src/lib/services/credential-service.ts:86
  const randCode = Math.floor(1000 + Math.random() * 9000);   // 9,000 values per year
  const verificationCode = `CERT-${year}-${randCode}`;        // no uniqueness check

src/lib/services/credential-service.ts:177
  .where('verificationCode','==',cleanCode).limit(1)          // first match wins
```

With a 9,000-value space, a collision becomes more likely than not after roughly **112 certificates issued in one year** (birthday bound). Because the lookup applies `limit(1)`, a collision causes the public verification page at `/portal/{slug}/verify/{code}` to display a different person's credential as valid. The same small space is trivially enumerable — 9,000 requests walks the whole certificate registry.

### F8 — A hardcoded superadmin email is distributed across 26 sites

`admin@smartsapp.com` grants system-administrator privilege in `firestore.rules` (inside `isAuthorized`, `isSystemAdmin`, `canAccessWorkspace` and `hasWorkspaceAccess`) and in at least six server-side modules, including `src/lib/auth/api-auth-guard.ts`. In that guard it also bootstraps a complete administrator profile for a user with **no Firestore record at all**, bypassing the `isAuthorized` check.

The rules match on `request.auth.token.email` and never check `email_verified`.

### F9 — Caught errors are logged to stdout and never reported

```
console.error(...)              1,905 call sites
Sentry.captureException(...)        1 call site
```

Sentry is installed and configured (`@sentry/nextjs`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, sourcemap upload in `next.config.ts`). Automatic instrumentation will capture unhandled errors, but every deliberately caught failure is invisible in production — including the messaging dispatch, automation processor, and webhook paths.

Separately, 22 API routes and 47 server actions return raw `error.message` to the client, leaking Firestore internals (including the index-creation URLs Firestore embeds in its error strings).

### F10 — The build ignores type errors it is not producing

```
next.config.ts:9    typescript: { ignoreBuildErrors: true }
tsc --noEmit        0 errors under "strict": true
```

The flag provides no current benefit and will silently accept the first regression. Separately, `.npmrc` sets `minimum-release-age=0` (mirrored in `pnpm-workspace.yaml`), disabling pnpm's supply-chain delay across all 93 dependencies, so a package compromised minutes ago installs immediately. The targeted alternative — `minimumReleaseAgeExclude` — is already in use for two packages.

### F16 — Per-organization AI keys are stored in plaintext and sent to the browser

*Added 9 September 2026 during Phase 0 tracing.*

The codebase encrypts global AI keys at rest but not per-organization ones.

**Global keys** (`system_settings/ai_keys`) are sealed. `src/lib/backoffice/backoffice-ai-actions.ts:102`
runs every value through `sealSecret(...)` before writing, and `getGlobalAiKeys` deliberately returns
only `geminiApiKeyExists: boolean` rather than the value.

**Per-organization keys** are written raw to the organization document:

```
src/app/admin/settings/components/OrganizationIntegrationsTab.tsx:60
  geminiApiKey: geminiApiKey.trim(),        // no sealSecret — plaintext to Firestore

src/app/admin/settings/components/OrganizationIntegrationsTab.tsx:27
  React.useState(organization.geminiApiKey || '')   // plaintext read back into the browser

src/ai/genkit.ts:201-204
  if (finalProvider === 'googleai') apiKey = data?.geminiApiKey;   // no openSecret on read
```

**Impact.** Provider API keys for every tenant sit unencrypted in Firestore, and the plaintext value
is transmitted to the client whenever an administrator opens Settings → Integrations. Because these
keys have the highest priority in the resolution chain (`src/ai/genkit.ts:197`), they are also the
values most likely to be live.

**Fix.** Apply `sealSecret` / `openSecret` on the per-org path exactly as the backoffice path does,
return an existence boolean rather than the value to the client, and migrate any existing plaintext
values.

---

## Structural Findings

### F11 — `strict` mode is undermined by 3,440 escapes

```
: any  /  as any  /  any[]      3,440
@ts-ignore / @ts-nocheck            96
catch (error: any)                 381
```

The clean typecheck overstates the actual type safety. The 381 `catch (error: any)` sites are the most tractable group — the change to `unknown` plus a narrowing helper is mechanical, and it touches exactly the code that F9 requires anyway.

### F12 — 5,237 lint warnings render lint output unreadable

```
@typescript-eslint/no-unused-vars     4,597
react/no-unescaped-entities             350
react-hooks/exhaustive-deps             161   ← latent stale-closure bugs
@next/next/no-img-element               116

package.json: "lint": "eslint 'src/**/*.{ts,tsx}' --max-warnings 9999"
```

The 161 `exhaustive-deps` warnings are genuine defects buried under 4,597 unused variables. `--max-warnings 9999` means the CI lint job can never fail on warning count.

### F13 — A 9,001-line type module, and 86 files over 1,000 lines

```
src/lib/types.ts                                    9,001 lines · 586 exports
src/app/admin/messaging/templates/.../template-workshop.tsx   6,209
src/app/admin/messaging/call-centre/.../ScriptBuilderClient.tsx 3,758
src/lib/quick-notes-domain.ts                       3,742
src/app/admin/pages/[id]/builder/components/Canvas.tsx  3,312
```

`types.ts` is imported almost everywhere, so any change to it invalidates the entire module graph. This contributes materially to build memory pressure — the build script requires `--max-old-space-size=4096` and `BUILD_CPUS=2`.

### F14 — 76% of components are client components

1,425 of 1,879 `.tsx` files declare `'use client'`. `src/proxy.ts` states: *"The actual authentication is handled client-side by Firebase."* The proxy performs route classification and header setting only; it enforces no authentication.

This is the architectural cause of F2 and F3. When the server holds no session, every server entry point must re-authenticate by hand, and 308 of them do not.

### F15 — 53 scratch files are committed to the repository root

```
fix_*.py, fix_*.cjs, patch_*.cjs, refactor*.js     one-off codemods, tracked
test-*.cjs, test-*.js, scratch-*.ts                ad-hoc scripts, tracked
lint_output.txt (383 KB), diff.txt (53 KB), *.log  stale build artefacts
campaign-wizard.tsx.bak                            superseded component
src/lib/__tests__/*.test.ts.bak  (×2)              superseded tests
Top_Gospel_*.docx (×3)                             unrelated to this project
```

Approximately 1 MB. The `.bak` files are the principal hazard: they are dead copies of live modules that project-wide search and IDE navigation will surface as though current.

---

## What Is Working

These are load-bearing and should be preserved.

- **The test suite is substantial and fast.** 583 files, 4,205 passing assertions, 103 seconds. 16 property-based suites; 98 files touching authorization or tenancy.
- **The codebase is clean under `strict`.** Zero `tsc` errors across 972k lines, zero ESLint errors.
- **CI gates the right four things** — typecheck, lint, full test suite, production build — on every push and PR to `main` and `deployment`, with per-job heap limits.
- **Production secret management is correct.** `apphosting.yaml` wires eight secrets through Cloud Secret Manager by reference, with no secret values in deploy configuration. F1 is a history problem, not a current-practice problem.
- **The auth guards are well written.** `api-auth-guard.ts` and `require-org-admin.ts` handle tenant isolation, system-admin bypass and workspace membership correctly, with documented reasoning. They are under-applied, not incorrect.
- **The page builder sanitizes consistently.** Every block routes HTML through `lib/page-builder/sanitize.ts`, with tests covering `<script>`, `onerror` and `javascript:` URIs. This is the pattern the survey renderer should adopt.
- **The stack is current.** Next.js 16.3.3, React 19.2.1, pinned tiptap and React types via pnpm overrides. No high-severity advisories.
- **Architecture is documented alongside the code.** ~103 documents, per-feature plans, and explanatory docblocks on security-relevant modules.

---

## Finding Index

| ID | Severity | Summary |
| --- | --- | --- |
| F1 | Critical | Seven live API keys in public git history, unrotated |
| F2 | Critical | Server actions trust caller-supplied `userId` |
| F3 | Critical | Three unauthenticated privileged API routes |
| F4 | Critical | 18 Firestore rules with a dead authorization term |
| F5 | Critical | Unescaped survey answers reach `dangerouslySetInnerHTML` |
| F6 | High | API bearer token generated with `Math.random()` client-side |
| F7 | High | Certificate codes collide; verification returns wrong holder |
| F8 | High | Hardcoded superadmin email across 26 sites |
| F9 | High | Caught errors never reported to Sentry |
| F16 | High | Per-org AI keys stored plaintext and sent to the browser |
| F10 | High | `ignoreBuildErrors` enabled; `minimum-release-age=0` |
| F11 | Medium | 3,440 `any` escapes undermine `strict` |
| F12 | Medium | 5,237 lint warnings conceal 161 real defects |
| F13 | Medium | 9,001-line `types.ts`; 86 files over 1,000 lines |
| F14 | Medium | 76% client components; no server-side session |
| F15 | Medium | 53 scratch files committed to repository root |

Remediation sequence: see [`app_audit_fix.md`](./app_audit_fix.md).
