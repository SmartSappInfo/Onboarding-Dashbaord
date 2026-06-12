# Plan: Share Org Setup Credentials + Fix Join-Code Loss on Login

> Status: IMPLEMENTED (Part 2 phases 2.1–2.7 + Part 1). Conforms to `next-best-practices`, `vercel-react-best-practices`, `frontend-design`.
> Verified: `pnpm typecheck` clean; `pnpm lint` exit 0 (warnings only); `safeInternalRedirect` 8/8 tests pass.
> Verification (typecheck/lint/test) run locally by the user.

Two related work items from the "Organization Pre-Created" flow:
1. **Share** the join token + invitation link by **email and/or SMS** — from the success modal, and later from the org's detail page in the back office.
2. **Fix** the broken invitee journey: the `?code=` is silently dropped, login is required (and fails with permission errors) before the code can be used.

---

## Part 1 — Share setup credentials (email / SMS)

### Current state (verified)
- The success modal (`OrgListClient.tsx`) only shows copy-to-clipboard for the token + link.
- The back office org detail page (`organizations/[orgId]/OrgDetailClient.tsx`) has **no** share affordance.
- Reusable send infra already exists: `resend-service.sendEmail`, `mnotify-service.sendSms`, and the pattern in `user-invite-actions.ts` (`inviteUserAction` sends branded email + SMS). The Create-Org action already captures an optional `email`.

### Design
Add one server action and reuse it in both surfaces.

**New server action** `shareOrgSetupInviteAction` in `src/lib/backoffice/backoffice-org-actions.ts`:
```ts
shareOrgSetupInviteAction(
  { organizationId: string; email?: string; phone?: string; channel: 'email'|'sms'|'both' },
  actor: AuditActor
): Promise<{ success: boolean; error?: string; sentTo: { email?: boolean; sms?: boolean } }>
```
- Re-reads the org server-side (admin SDK) to get `name`, `joinToken`, `slug` — **never trusts client-passed token** (avoids a client forging a link for another org).
- Rebuilds the invite URL from a server env base (`NEXT_PUBLIC_APP_URL` / request origin) → `${base}/profile-setup?code=${joinToken}`. (Also fixes the screenshot's `localhost:9002` leaking into shares.)
- Sends a branded email (subject "You're invited to set up {org} on SmartSapp") and/or SMS with the link + token.
- Writes a `logBackofficeAction(actor, 'organization.invite_shared', …)` audit entry.
- E.164-normalises phone via the existing `libphonenumber-js` helper before SMS.

**Modal (`OrgListClient` success state):** below the copy fields add a compact "Share with administrator" row — an email input + phone input (phone uses the existing phone-input component) and a **Send** button calling the action. Pre-fill email from the org's `email`. Show per-channel success/failure via toast. Keep the existing copy buttons.

**Org detail page (`OrgDetailClient`):** when `org.isConfigured === false`, render an "Onboarding" card showing the token + link (copy) **and** the same share controls (reusing one `<ShareOrgInvite orgId email phone />` component so logic isn't duplicated). Hide/disable once `isConfigured === true` (setup already complete).

### Risks / mitigations
| Risk | Mitigation |
|---|---|
| Client forging a token for another org | Action re-reads org by id server-side; ignores any client token |
| Wrong base URL in shared link (localhost) | Build URL from server env, not `window.location` |
| Sharing after org already configured | Action returns error if `isConfigured === true`; UI hides controls |
| Provider failure on one channel | Return per-channel `sentTo`; toast partial success |
| Invalid phone/email | Validate + normalise server-side; clear inline error |

### Testability
- Unit test the URL builder + payload composition (pure helper `buildInviteMessage(org, base)`).
- Mock `resend-service`/`mnotify-service` to assert correct recipient/link, mirroring `user-invite-actions` tests.

---

## Part 2 — Join code lost + login permission failure

### Root cause (verified, it's routing — not the security model)
The privileged work is already safe and server-side: `validateJoinCodeAction`, `submitOnboardingProfileAction`, and `completeOrganizationOnboardingAction` all run via the Admin SDK with guards (`completeOrganizationOnboardingAction` throws if `isConfigured === true`). The breakage is entirely in client routing:

1. **`profile-setup` ignores `?code=`** — no `useSearchParams`; the invitee must retype the token (step 1). The link looks broken.
2. **Auth guard drops the destination** — `profile-setup` does `router.push('/login')` with no return path, so the code is gone after login.
3. **Login/signup hardcode `/admin`** — neither reads a `redirect`/`code` param; after auth the user never returns to `profile-setup`.
4. **Admin guard sends unlinked users to `/awaiting-approval`** (`layout-client.tsx`) — a brand-new invited admin (no org link yet) lands there or hits permission-denied reads, which is the "permission issue." They needed to finish `profile-setup` with the code, but the code was lost at step 2/3.

### Industry-grade solution — carry the capability token across the auth boundary

**Principle:** the join token is an *invite capability* (like a GitHub/Slack invite link). It only grants "request to join / configure an **unconfigured** org." All elevation happens server-side with guards. So carrying it through a signed `redirect` param is safe, with these hardening rules:
- **Open-redirect protection:** only honor `redirect` values that are app-relative paths (`startsWith('/')`, no `//` or scheme). Reject external URLs.
- **Admin-grant guard:** "becomes Administrator" only when `org.isConfigured === false` (first-configurer-wins, already enforced). After configuration the same link can no longer self-promote.
- **Token hardening (IN SCOPE — decision locked):** add `joinTokenExpiresAt` and single-use consumption for the *org-provisioning* token so a leaked link can't be replayed indefinitely.

**Invitee entry (decision locked):** an unauthenticated invitee defaults to **Create account** (`/signup?redirect=…`), since invited admins are new users; a secondary "Already have an account? Sign in" preserves the same `redirect`.

**Flow after fix:**
```
Invite link  /profile-setup?code=SS-XXXX
   │
   ├─ authenticated?  ── yes ─► profile-setup reads code, auto-validates, prefilled & locked → complete → configure → admin
   │
   └─ no ─► /login?redirect=%2Fprofile-setup%3Fcode%3DSS-XXXX   (primary CTA: "Create account" → /signup?redirect=…)
              │  (code also stashed in sessionStorage as a fallback)
              └─ after auth ─► honor redirect ─► back to /profile-setup?code=SS-XXXX ─► (as above)
```

### Phase-by-phase

| Phase | Change | File(s) | Risk |
|---|---|---|---|
| 2.1 | `profile-setup` reads `?code=` via `useSearchParams`, auto-calls `validateJoinCodeAction`, prefills + locks the code field, advances past step 1 on success. Falls back to `sessionStorage('pendingJoinCode')`. | `profile-setup/page.tsx` | low |
| 2.2 | Replace the bare `router.push('/login')` guard with `router.push('/login?redirect=' + encodeURIComponent('/profile-setup?code=' + code))`, and stash the code in `sessionStorage`. | `profile-setup/page.tsx` | low |
| 2.3 | Add a tiny shared helper `safeInternalRedirect(param): string \| null` (app-relative only) + `useReturnTo()` hook. Unit-tested. | `src/lib/auth/return-to.ts` | none |
| 2.4 | Login: read `redirect` (validated) and, on every successful-auth `router.push`, route to the return path when present (else existing defaults). Also surface the invite context ("Sign in to finish joining **{org}**" if a code is present). | `login/page.tsx` | medium (touches all push sites) |
| 2.5 | Invitee defaults to **Create account**: when `redirect` points at `profile-setup`, the invite screen leads with sign-up (`/signup?redirect=…`), secondary "Sign in" preserves `redirect`. Both honor the return path after auth. | `signup/page.tsx`, `login/page.tsx` | medium |
| 2.6 | Admin guard: if an authenticated user has no org link **but** a `pendingJoinCode` exists (URL or sessionStorage), route to `/profile-setup?code=…` instead of `/awaiting-approval`. Clear the stash once consumed. | `admin/layout-client.tsx` | medium |
| 2.7 | **(In scope)** add `joinTokenExpiresAt` (set at pre-create + on re-share) and single-use consumption to the provisioning token; expiry/used checks in `validateJoinCodeAction`; surface "link expired/used — ask admin to re-share." Re-share (Part 1 action) mints a fresh token+expiry. | `backoffice-org-actions.ts`, `onboarding-actions.ts` | medium |

### What could go wrong / mitigations
| Risk | Mitigation |
|---|---|
| Open redirect via crafted `?redirect=//evil.com` | `safeInternalRedirect` rejects anything not starting with a single `/`; unit-tested |
| Code in URL leaking via referrer/logs | It's an invite capability with server-side guards; add expiry/single-use (2.7); link only self-promotes while org unconfigured |
| sessionStorage stale code after completion | Clear `pendingJoinCode` on successful onboarding + on guard consumption |
| Existing (already-linked) user clicks an invite link | `validateJoinCodeAction` + guards: if already a member, send to `/admin`; if org configured, no admin grant |
| Multiple people open the same link | First to complete `completeOrganizationOnboardingAction` wins (throws for the rest); show "already configured" message |
| Redirect loops (guard ↔ profile-setup) | Guard only redirects to profile-setup when a code is present AND user lacks org link; profile-setup never redirects an authenticated user back to login |

### Testability
- `safeInternalRedirect` — pure, unit-tested (accepts `/profile-setup?code=X`; rejects `//x`, `https://x`, `javascript:`).
- `validateJoinCodeAction` expiry branch (emulator) for 2.7.
- Manual QA matrix: (a) logged-out invitee, (b) logged-in-but-unlinked invitee, (c) already-member invitee, (d) already-configured org link.

---

## Suggested build order
Part 2 first (it's the broken path blocking onboarding): 2.3 → 2.1 → 2.2 → 2.4 → 2.5 → 2.6, then 2.7 if desired. Then Part 1 (share action + modal + org-detail card), which is purely additive.

## Local verification
```bash
pnpm test:run src/lib/auth         # safeInternalRedirect
pnpm typecheck && pnpm lint
pnpm test:emulator                 # join-code validation/expiry
```
Manual: create org → share to your email/phone → open link logged out → create account → land back on profile-setup with code prefilled → complete → become admin → first workspace.
