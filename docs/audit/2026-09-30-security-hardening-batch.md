# Security & Quality Hardening Batch (2026-09-30)

Five follow-ups found while releasing `9fed3bed`–`4cd8dea6`. Each phase lands as its own verified
commit on local `main`. **Nothing is pushed or deployed without explicit approval** (Rules 2 and 5).
Staging shares the production Firebase project, so any rules deploy is a production deploy.

## Tracker

| Phase | Item | Severity | Status | Commit |
| :--- | :--- | :--- | :--- | :--- |
| H0 | Flaky tag property test | CI reliability | ☐ | |
| H1 | Workforce privilege escalation | **Critical (live)** | ☐ | |
| H2 | Phone password reset → one-time code | **High (live)** | ☐ | |
| H3 | Lint step 1 (~311 warnings) | Quality | ☐ | |
| H4a | `content_items` paywall rule (held PR-0e) | High | ☐ | |
| H4b | `event_registrations` tenant isolation | **High (live)** | ☐ | |
| H4c | `contracts` tenant isolation | **High (live)** | ☐ | |

Order is risk-first: H0 makes CI trustworthy for everything after it; H1–H2 close live holes;
H3 is mechanical; H4 needs rules deploys (approval) and, for H4c, a data backfill.

## Rules applied in every phase

| Rule | How it shows up here |
| :--- | :--- |
| 2 Trackable plan, local commits only | This tracker; one commit per phase; no push without approval |
| 4 No `any` / unchecked casts | New code types its inputs; `unknown` only at request/Firestore boundaries, narrowed immediately |
| 5 Staged, approved deploys | Rules and data changes are emulator-tested, then deployed only on approval |
| 6 Current docs | Context7 / `node_modules/next/dist/docs` checked before new APIs (e.g. `headers()`) |
| 7 Mobile, plain English, reuse | Phone-reset UI is one short form per step; shared helpers instead of copies |
| 8 Security | Identity from session or verified token only; tenant checks on every read and write |
| 9 Load and edge cases | Rate limits, attempt caps, bounded queries; edge cases listed per phase |
| 10 Guidance comments | Every changed guard explains what it protects and why |
| 51–53 | Server actions authorize every call; client/server boundary scan; no new dependencies |

---

## H0 — Flaky tag property test

**Evidence.** `src/lib/__tests__/tag-partition.property.test.ts` tests 1–2 generate ids with
`fc.string()`, which yields whitespace ids and the same tag id in both scopes (counterexample
`[" "," ",["call"],["call"]," "]`, seed 1697029857). Test 3 already uses safe generators.

**Fix.** One shared id generator (`/^[a-zA-Z0-9_-]{1,20}$/`) and `g_`/`w_` tag-id prefixes for all
three tests. **Verify:** replay the failing seed, then run the file repeatedly.
**Could go wrong:** over-constraining hides real bugs. Mitigation: only ids change; the property
and its assertions stay identical.

## H1 — Workforce privilege escalation

**Evidence.** `verifyCallerAuth` in `src/app/actions/workforce-actions.ts` sets
`canManageWorkforce` true for `profile.isAuthorized` (every approved staff member) and for the
read-only `management.users.view`. It gates bulk role assignment, access-request approval,
invitations, departments and teams. Also: `purgeSampleDepartmentsAction` (destructive) has no
manager check; `listAccessRequestsAction` / `listInvitationsAction` return personal data to any
member; `orgId = profile.organizationId || targetOrgId` lets a profile without an organization
match any organization.

**Fix.**
1. Extend the shared `canManageUsers` (`src/lib/auth/require-user-manager.ts`) with the remaining
   legitimate admin signals: dotted legacy ids `management.users.edit|create`, and admin role names
   `admin|administrator|org_admin|super_admin` (case-insensitive). Never `isAuthorized`, never `.view`.
2. `workforce-actions` and `identity-actions` use it (removes two copies). `authorization-actions`
   keeps its stricter role-management test, documented, so role management is not broadened.
3. Organization check: the caller's own `organizationId` must equal the target (system admins exempt).
4. Gate `purgeSampleDepartmentsAction`, `listAccessRequestsAction`, `listInvitationsAction` behind
   the manager check. `listDepartments` / `listTeams` stay member-readable (pickers need them).

**Tests.** Approved staff without admin rights are refused on every gated action; each admin signal
is accepted; view-only refused; cross-organization refused; profile without organization refused.
Mutation-check against the old code.
**Affected:** Users hub bulk actions, departments/teams settings, invitations, access requests.
**Could go wrong:** a real admin whose only signal is unusual loses access. Mitigation: every
signal the old code honoured is kept except `isAuthorized` and `.view`; the error message names the
missing permission so it is fixable in Roles without code (backoffice-manageable).

## H2 — Phone password reset → one-time code

**Evidence.** `publicResetPasswordViaPhoneAction` (public) replaces a user's password **before**
they prove they hold the phone. Anyone with a number can lock that user out, and trigger unlimited
SMS (cost abuse). No rate limit.

**Fix (two public actions, one server-only service).**
1. `requestPhoneResetCodeAction(phone)`: normalize the number with the existing phone utilities;
   if a user matches, create a 6-digit code (`crypto.randomInt`), store only its SHA-256 hash with a
   10-minute expiry and 0 attempts in `password_reset_codes/{uid}` (server-only; base deny-all
   rule), send it by SMS. Always return the same generic message (no account enumeration).
2. `confirmPhoneResetAction(phone, code, newPassword)`: constant-time hash compare; max 5 attempts
   then the code is burned; on success set the user's chosen password, clear
   `requiresPasswordReset`, revoke refresh tokens, delete the code.
3. Limits: max 3 codes per number per hour; reuse the existing rate limiter if it fits, else a
   bounded timestamp list on the code document.
4. `/forgot-password` phone tab becomes two short steps: *Phone* → *Code + new password*. Email
   tab (Firebase reset link) unchanged.
5. Remove the old action; add the two new actions to the public-actions allowlist with reasons;
   the guard baseline shrinks by one.

**Tests.** Unknown number: same response, no SMS. Wrong code: attempt counted; 6th attempt
refused. Expired code refused. Rate limit enforced. Success sets password and revokes sessions.
Code never returned to the client or logged.
**Could go wrong:** stored phone formats differ from input → reuse the app's phone normalizer and
match both stored forms; SMS provider down → generic error, email reset still available;
kill switch `assertOutboundAllowed('sms')` respected.

## H3 — Lint step 1 (~311 warnings, no new dependencies)

1. `caughtErrorsIgnorePattern: '^_'` on `@typescript-eslint/no-unused-vars` in every config block
   that sets it (the codebase already uses `_` for intentionally unused args/vars) → −125.
2. Remove the 179 unused imports with a codemod driven by ESLint's report and TypeScript's own
   "remove unused import" fix (no new package; Rule 53). Verified by tsc, tests and build.
3. The one non-`_` catch binding, the stale `eslint-disable`, and 5 unescaped `'` fixed by hand;
   `reportUnusedDisableDirectives: 'error'` so stale disables cannot return.
4. Ratchet: lower `--max-warnings` in `package.json` from 670 to the new count.

**Could go wrong:** a removed import had side effects → only named specifiers that TypeScript
itself reports unused are removed; build + tests confirm. Many files touched → land quickly to
avoid conflicts with other agents.

## H4 — Firestore rules (each deploy needs approval)

### H4a — `content_items` paywall (PR-0e, held)
Rebase `agentic/pr0e-content-items-rule` onto `main`; rules suite green. Precondition met: the
portal reader moved to server actions and that app version is live. Deploy = production.
**Could go wrong:** a browser still running an old bundle loses the reader until refresh.

### H4b — `event_registrations`
Today: any signed-in account reads and writes every registration. Target (same shape as
`cohort_members`): a member reads their own rows (`userId == uid`); staff read and write their own
organization's (`isOrgMatch`); `organizationId` immutable; member self-registration, if the portal
does it client-side, only for themselves in the event's organization. Client queries gain the
filter the rule needs; indexes added. Emulator tests for both halves.

### H4c — `contracts`
Today: `list: if isAuthorized()` (every tenant's contracts), while `get`/`write` check a
`workspaceIds` array no writer sets. Writers store `workspaceId`; the oldest docs may have none.
1. App first: Contracts page queries `where('workspaceId', '==', activeWorkspaceId)` (fixes its
   cross-tenant signed/pending totals); index added.
2. Data: a dry-run backfill script counts contracts without `workspaceId` and derives it from the
   linked deal/entity; applied only after review (Rule 5).
3. Rules last: tenant-scoped `get/list/create/update/delete` on `workspaceId` (helpers from the
   DocSigning rules); legacy array accepted only if the data check finds any.
**Order matters:** app deploy → backfill → rules deploy, or the Contracts page breaks.

## Verification per phase
`tsc` 0 errors · lint 0 errors under the cap · full Vitest · rules emulator when rules change ·
client-leak scan · clean `next build` · mutation check of new tests against the old code.
