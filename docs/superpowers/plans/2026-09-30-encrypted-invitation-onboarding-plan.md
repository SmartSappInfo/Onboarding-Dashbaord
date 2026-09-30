# Encrypted Invitation Link & Multi-Step Onboarding Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed organization and canonical SSoT department into encrypted, tamper-proof invitation links, orchestrating an end-to-end 3-step onboarding journey (`/accept-invitation` → `/login` → `/profile-setup` → `/admin`) with complete accept/decline tracking, re-visit protection, backoffice observability, and zero data leakage.

**Architecture:** 
- **Cryptographic Layer:** AES-256-GCM authenticated encryption (`InviteCryptoService`) with random 12-byte IVs and 16-byte AEAD authentication tags, serialized to URL-safe base64url strings.
- **State Machine Layer:** Firestore `invitations` collection extended with `'declined'` status alongside `'sent'`, `'accepted'`, `'expired'`, and `'revoked'`.
- **Re-Visit Prevention Matrix:** Evaluates `invitations/{id}.status`, `users/{uid}.profileCompleted`, and active Firebase session:
  - Already completed + Active session → Instant redirect to `/admin`.
  - Already completed + Expired session → Redirect to `/login` with notification, then `/admin`.
  - Declined → Blocks re-acceptance with contact admin prompt.
- **Persistence Across Auth Boundaries:** Dual-layer synchronization using URL query parameters (`?invite=...`) and client `sessionStorage` fallback to survive third-party SSO and redirects.
- **SSoT Department Binding:** Pre-fills and locks canonical `departmentId` and `departmentName` resolved via `DepartmentService` on `/profile-setup`.

**Tech Stack:** Next.js 15 (App Router), TypeScript (Strict, 0 `any`), Node.js `crypto`, Firebase Firestore & Admin SDK, Zod, Tailwind CSS v4, Lucide Icons, Vitest.

---

## 1. What Could Go Wrong & Resolutions (Threat Modeling & Robustness)

| Potential Failure Mode | Root Cause | Impact | Architectural Resolution & Mitigation |
| :--- | :--- | :--- | :--- |
| **1. Token Replay / Multiple Acceptance** | User taps link multiple times or forwards it after onboarding. | Duplicate profile setups or race conditions overwriting profile data. | Server-authoritative check on `invitations/{id}.status` and `users/{uid}.profileCompleted`. Once `profileCompleted === true`, mutations are blocked and user is routed directly to `/admin` (or `/login`). |
| **2. Tampering with Organization / Department** | Malicious actor modifies query parameters to escalate access or join unauthorized orgs. | Privilege escalation or multi-tenant cross-contamination. | AES-256-GCM with AEAD auth tag. The ciphertext cannot be forged or altered without the server secret. Any bit-flip triggers instant decryption rejection. |
| **3. Dropped Payload during Auth Redirects** | Google SSO or page reloads drop `?invite=` from URL. | User arrives on `/profile-setup` with blank organization/department. | Dual persistence: URL query param + `sessionStorage.setItem('active_invite_token', token)`. Decryption is also corroborated with Firestore `users/{uid}` fields. |
| **4. Expired or Revoked Token Edge Cases** | Candidate opens link after 7-day expiration window or after admin revokes it. | Confusing crashes or broken half-onboarded state. | Pre-flight server action checks expiration timestamp (`exp`) and database status. Shows clear, polite notice with admin contact action. |
| **5. SSoT Department Deleted Before Acceptance** | Admin deletes or renames assigned department while invite is in flight. | Foreign key mismatch or failed profile completion. | `DepartmentService.resolveDepartmentFallback`: if assigned `departmentId` no longer exists, falls back cleanly to the organization's 'General' department with a warning log, avoiding 500 errors. |
| **6. Secret Key Misconfiguration** | `CREDENTIAL_ENCRYPTION_KEY` or `INVITATION_SECRET_KEY` missing in production. | Inability to decrypt tokens; runtime crashes. | Resilient key derivation in `InviteCryptoService` with fallback to secure server secret and immediate startup verification. |
| **7. Batch Limit Overload in High-Volume Invites** | Admin dispatches or reconciles hundreds of invites in bulk. | Firestore batch write limit exceeded (> 500 ops). | All Firestore batch writes chunked to $\le 200$ operations per batch using existing batch helper utilities. |
| **8. Mobile Viewport & Touch Target Breakage** | Virtual keyboards and small screens obscure action buttons or cause layout shift. | Poor candidate onboarding experience on mobile. | Strict compliance with `ui-ux-pro-max` and `emilkowal-animations`: `min-h-[44px]` touch targets, `active:scale-[0.97]` tactile feedback, `min-h-[100dvh]` container, and short, plain-English copy. |

---

## 2. Cross-Feature Impact & Backoffice Enhancements

### Features Affected:
1. **Multi-Channel Invitation Dispatch (`invitation-dispatch-service.ts` & `user-invite-actions.ts`):**
   - Must construct `${baseUrl}/accept-invitation?invite=${encryptedToken}` instead of raw links.
   - Must maintain backwards compatibility for existing raw tokens (`?token=${rawToken}`).
2. **Acceptance Surface (`src/app/accept-invitation/`):**
   - Redesigned to welcome the candidate, display Org & Department, offer Accept & Decline, and execute re-visit routing.
3. **Login Surface (`src/app/login/`):**
   - Reads `?invite=`, pre-populates email and temp password, preserves encrypted token into redirect to `/profile-setup`.
4. **Profile Setup Surface (`src/app/profile-setup/`):**
   - Decrypts token, locks canonical organization & SSoT department, marks `profileCompleted: true`, increments department member count.

### Backoffice Enhancements (No Code Touching Needed by Admins):
1. **Invitations Manager (`src/app/admin/users/components/InvitationsManager.tsx`):**
   - New status filter and badge for **"Declined"** (`bg-slate-500/10 text-slate-600 border-slate-500/30`), showing when a candidate rejected the invitation.
   - **"Copy Encrypted Link"** button on every active invitation row, allowing admins to manually copy the secure link to Slack/WhatsApp if an email bounced.
   - **"Resend"** action refreshes the cryptographic token with a renewed 7-day expiration window.
2. **Backoffice Identity Observatory (`src/app/(backoffice)/backoffice/identity/BackofficeIdentityClient.tsx`):**
   - Superadmin inspection of invitations includes encrypted status telemetry, declined states, and one-click token regeneration.

---

## 3. Strict Compliance Guidelines

- **Zero `any` or `any[]`:** Every function signature, state variable, and API payload is strictly typed.
- **External Boundary Narrowing:** All URL query parameters and API payloads validated via Zod schemas.
- **Mobile Optimization:** Touch targets $\ge 44\text{px}$, responsive layout, natural Emil Kowalski spring animations.
- **Code Comments:** Architectural comments explaining "what changed", "why", "caution areas", and "testability pointers".
- **Git Protocol:** No branch pushing (`git push`) unless explicitly requested.

---

## 4. Phase-by-Phase Implementation Plan

### Phase 1: Cryptographic Engine & Types

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/services/crypto/invite-crypto-service.ts`
- Create: `src/lib/services/crypto/__tests__/invite-crypto-service.test.ts`

- [ ] **Step 1: Write the failing unit tests for `InviteCryptoService`**
  Test encryption, decryption, tampering detection (invalid auth tag), expired token rejection, and base64url URL-safety.
  File: `src/lib/services/crypto/__tests__/invite-crypto-service.test.ts`

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/lib/services/crypto/__tests__/invite-crypto-service.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Update `src/lib/types.ts`**
  - Add `'declined'` to `InvitationStatus`:
    ```typescript
    export type InvitationStatus =
      | 'draft'
      | 'pending'
      | 'sent'
      | 'delivered'
      | 'accepted'
      | 'declined'
      | 'expired'
      | 'revoked'
      | 'failed';
    ```
  - Define `EncryptedInvitePayload` interface:
    ```typescript
    export interface EncryptedInvitePayload {
      invitationId: string;
      organizationId: string;
      organizationName: string;
      departmentId: string;
      departmentName: string;
      email: string;
      fullName?: string;
      tempPassword?: string;
      workspaceId?: string;
      workspaceName?: string;
      roleIds?: string[];
      roleNames?: string[];
      exp: number; // Unix epoch ms
    }
    ```

- [ ] **Step 4: Implement `InviteCryptoService`**
  File: `src/lib/services/crypto/invite-crypto-service.ts`
  - Implement AES-256-GCM encryption with 12-byte random IV.
  - Return base64url formatted token `iv.tag.ciphertext`.
  - Implement tamper verification and expiration validation.
  - Export Zod schema `EncryptedInvitePayloadSchema` for runtime validation.

- [ ] **Step 5: Run tests to verify they pass**
  Run: `pnpm vitest run src/lib/services/crypto/__tests__/invite-crypto-service.test.ts`
  Expected: PASS.

- [ ] **Step 6: Git commit Phase 1**
  Commit message: `feat(crypto): implement AES-256-GCM invite crypto service and types`

---

### Phase 2: Lifecycle State Machine & Server Actions

**Files:**
- Modify: `src/lib/services/workforce/invitation-lifecycle-service.ts`
- Create: `src/app/actions/invitation-crypto-actions.ts`
- Create: `src/lib/services/workforce/__tests__/invitation-crypto-actions.test.ts`

- [ ] **Step 1: Write failing unit tests for invitation crypto actions and lifecycle methods**
  Test:
  1. `validateEncryptedInvitationAction`: returns invitation and prefill details, detects already completed profiles, detects declined invitations.
  2. `acceptInvitationLandingAction`: marks invitation as accepted in Firestore.
  3. `declineInvitationLandingAction`: marks invitation as declined in Firestore.
  File: `src/lib/services/workforce/__tests__/invitation-crypto-actions.test.ts`

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/lib/services/workforce/__tests__/invitation-crypto-actions.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Update `InvitationLifecycleService` in `src/lib/services/workforce/invitation-lifecycle-service.ts`**
  - Add `declineInvitation(invitationId: string, reason?: string)` method: sets `status: 'declined'`, `declinedAt: new Date().toISOString()`.
  - Add `getInvitationDetails(invitationId: string)`: safely retrieves invitation document.
  - Update `validateInvitationToken`: handle `'declined'` status safely.

- [ ] **Step 4: Implement `src/app/actions/invitation-crypto-actions.ts`**
  - Server actions with strict Zod validation:
    1. `validateEncryptedInvitationAction(params: { token: string })`:
       - Supports both encrypted base64url token and legacy raw hex token.
       - Checks Firestore `invitations` record and `users` record.
       - Returns `state`: `'valid' | 'already_completed' | 'declined' | 'expired' | 'revoked' | 'invalid'`.
       - Returns prefill metadata: `organizationId`, `organizationName`, `departmentId`, `departmentName`, `email`, `fullName`, `tempPassword`.
    2. `acceptInvitationLandingAction(params: { token: string })`:
       - Decrypts token, sets `invitation.status = 'accepted'`.
    3. `declineInvitationLandingAction(params: { token: string, reason?: string })`:
       - Decrypts token, calls `InvitationLifecycleService.declineInvitation`.

- [ ] **Step 5: Run tests to verify they pass**
  Run: `pnpm vitest run src/lib/services/workforce/__tests__/invitation-crypto-actions.test.ts`
  Expected: PASS.

- [ ] **Step 6: Git commit Phase 2**
  Commit message: `feat(workforce): implement encrypted invitation server actions and decline state`

---

### Phase 3: Multi-Channel Dispatch Integration

**Files:**
- Modify: `src/lib/services/workforce/invitation-dispatch-service.ts`
- Modify: `src/lib/user-invite-actions.ts`
- Modify: `src/app/actions/workforce-actions.ts`
- Test: `src/lib/services/workforce/__tests__/invitation-dispatch-service.test.ts`

- [ ] **Step 1: Write/Update dispatch tests for encrypted links**
  Verify email, SMS, and WhatsApp dispatch payloads use the encrypted URL `/accept-invitation?invite=...`.

- [ ] **Step 2: Update `InvitationDispatchService`**
  - Add `encryptedInviteToken?: string` to dispatch inputs.
  - When `encryptedInviteToken` is present, format acceptance URL as:
    `${origin}/accept-invitation?invite=${encodeURIComponent(encryptedInviteToken)}`
  - Fall back cleanly to legacy `${origin}/accept-invitation?token=${rawToken}` if encrypted token not supplied.

- [ ] **Step 3: Update `inviteUserAction` in `src/lib/user-invite-actions.ts`**
  - Resolve canonical SSoT `departmentId` and `departmentName`.
  - Create `invitations` record using `InvitationLifecycleService.createInvitation`.
  - Generate encrypted payload via `InviteCryptoService.encryptInvitePayload`.
  - Dispatch credentials using the new encrypted URL.

- [ ] **Step 4: Update `resendInvitationAction` in `src/app/actions/workforce-actions.ts`**
  - Generate fresh encrypted payload on resend.
  - Return `encryptedInviteToken` alongside `rawToken`.

- [ ] **Step 5: Run dispatch unit tests**
  Run: `pnpm vitest run src/lib/services/workforce/__tests__/invitation-dispatch-service.test.ts`
  Expected: PASS.

- [ ] **Step 6: Git commit Phase 3**
  Commit message: `feat(dispatch): embed encrypted invitation token in multi-channel dispatch`

---

### Phase 4: Landing Screen & Experience (`/accept-invitation`)

**Files:**
- Modify: `src/app/accept-invitation/page.tsx`
- Modify: `src/app/accept-invitation/AcceptInvitationClient.tsx`

- [ ] **Step 1: Update `AcceptInvitationClient.tsx` to handle `?invite=` and `?token=`**
  - Extract `invite` or `token` from URL query parameters.
  - Call `validateEncryptedInvitationAction`.
  - Check `state`:
    - If `state === 'already_completed'`:
      - If user is authenticated in Firebase (`useAuth()`), immediately router push `/admin`.
      - If unauthenticated, router push `/login` with toast: *"You have already registered. Please sign in to access your workspace."*
    - If `state === 'declined'`:
      - Render Declined Card: *"This invitation was previously declined. Please contact your workspace administrator if this was a mistake."*
    - If `state === 'expired'` or `'revoked'`:
      - Render Expired/Revoked Card with Return to Login button.
    - If `state === 'valid'`:
      - Render Welcome Card:
        - Hero badge with Organization Name.
        - Department badge showing Canonical Department Name.
        - Invitee Name & Email preview.
        - Clear message: *"You have been invited to join [Organization] as part of the [Department] department."*

- [ ] **Step 2: Implement "Accept" and "Decline" Handlers**
  - **Accept Invitation:**
    - Trigger `acceptInvitationLandingAction`.
    - Set `sessionStorage.setItem('active_invite_payload', token)`.
    - Router push `/login?invite=${encodeURIComponent(token)}`.
    - Show welcome toast.
  - **Decline Invitation:**
    - Prompt confirmation dialog (or inline confirm).
    - Call `declineInvitationLandingAction`.
    - Switch view to confirmed declined card.

- [ ] **Step 3: Mobile & Animation Optimization**
  - Touch targets $\ge 44\text{px}$ (`h-11 sm:h-10`).
  - Active button tactile scale `active:scale-[0.97]` (`emilkowal-animations`).
  - Responsive container `min-h-[100dvh]` with centered card.
  - Plain English UI text.

- [ ] **Step 4: Git commit Phase 4**
  Commit message: `feat(ui): implement welcome accept/decline landing screen and re-visit routing`

---

### Phase 5: Login & Profile Setup Integration

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/profile-setup/page.tsx`

- [ ] **Step 1: Update `src/app/login/page.tsx`**
  - Detect `?invite=` query param or `sessionStorage.getItem('active_invite_payload')`.
  - If present, call `validateEncryptedInvitationAction` to pre-populate Email (and temp password if applicable).
  - Show contextual banner: *"Accepting invitation to join [Organization Name]"*.
  - Upon successful email/password or Google authentication:
    - If `profileCompleted === false`, router push `/profile-setup?invite=${encodeURIComponent(token)}`.
    - If `profileCompleted === true`, router push `/admin`.

- [ ] **Step 2: Update `src/app/profile-setup/page.tsx`**
  - Read `?invite=` query parameter or `sessionStorage.getItem('active_invite_payload')`.
  - Decrypt invitation payload via `validateEncryptedInvitationAction`.
  - Pre-fill and lock:
    - Organization (auto-selected).
    - Department (SSoT: canonical `departmentId` and `departmentName` pre-selected and locked with badge).
    - Full Name and Email.
  - On submit in `submitOnboardingProfileAction`:
    - Finalize user profile (`profileCompleted: true`).
    - Clear `sessionStorage.removeItem('active_invite_payload')`.
    - Route to `/admin`.

- [ ] **Step 3: Git commit Phase 5**
  Commit message: `feat(onboarding): connect encrypted invite payload to login and profile setup`

---

### Phase 6: Backoffice & Workforce UI Enhancements

**Files:**
- Modify: `src/app/admin/users/components/InvitationsManager.tsx`
- Modify: `src/app/(backoffice)/backoffice/identity/BackofficeIdentityClient.tsx`

- [ ] **Step 1: Enhance `InvitationsManager.tsx`**
  - Add `'declined'` to status dropdown filter (`"Declined"`).
  - Add `'declined'` badge styling: `bg-slate-500/10 text-slate-600 border-slate-500/30`.
  - Update `handleResend` to generate and copy the encrypted link `${origin}/accept-invitation?invite=${res.encryptedInviteToken}`.
  - Add "Copy Link" action in the row actions so admins can copy the active invite link directly.

- [ ] **Step 2: Enhance `BackofficeIdentityClient.tsx`**
  - Add `'declined'` badge support.
  - Update `handleResendInvite` to copy the encrypted invite link.

- [ ] **Step 3: Git commit Phase 6**
  Commit message: `feat(backoffice): add declined status and encrypted link copy to backoffice workforce`

---

### Phase 7: Verification & Hardening

**Files:**
- All modified and created files.

- [ ] **Step 1: Run comprehensive Vitest suite**
  Run: `pnpm vitest run src/lib/services/crypto/ src/lib/services/workforce/`
  Expected: ALL PASS.

- [ ] **Step 2: Run TypeScript typecheck**
  Run: `pnpm typecheck`
  Expected: 0 errors.

- [ ] **Step 3: Run ESLint**
  Run: `pnpm lint`
  Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Manual Edge-Case & Mobile Checklist Verification**
  - [ ] Test 1: User clicks invite link → Landing page displays Organization & Department.
  - [ ] Test 2: User clicks "Decline" → Status changes to declined; re-opening link shows declined message.
  - [ ] Test 3: User clicks "Accept" → Redirects to login with email pre-filled.
  - [ ] Test 4: User logs in → Forwarded to `/profile-setup` with Department locked.
  - [ ] Test 5: User completes profile → Redirects to `/admin`.
  - [ ] Test 6: User clicks original invite link again while logged in → Immediately redirects to `/admin`.
  - [ ] Test 7: User clicks original invite link after logging out → Redirects to `/login` with notification.

---
