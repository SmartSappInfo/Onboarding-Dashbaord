# Backoffice Governance (Spec Phase 7) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans`. Steps use checkbox (`- [ ]`) syntax. Each phase is independently shippable and must end green (`pnpm typecheck && pnpm vitest run src/lib/backoffice`) with a commit before the next begins. No `any`/`any[]` anywhere (user rule).

**Goal:** Add the control-plane safety net from `docs/feature_backoffice_superadmin.md` §Phase 7: four-eyes approval for dangerous actions, audited impersonation with a visible banner, and MFA enforcement for backoffice roles — building on the existing `authorizeBackoffice` primitive, audit ledger, and RBAC matrix.

**Architecture:** Three independent subsystems, each a thin layer over what already exists. Approvals introduce a `platform_approval_requests` queue that dangerous actions *enqueue into* instead of executing; a second admin approves and the server executes the stored payload. Impersonation mints a short-lived Firebase custom token with an `impersonatedBy` claim, surfaced by a fixed banner in the main app shell. MFA enforcement is a single check inside `authorizeBackoffice` on the verified token's second-factor claim, plus an enrollment UX.

**Tech Stack:** existing `backoffice-auth.ts` / `audit-logger.ts` / `backoffice-rbac.ts`, Firebase Admin SDK (`createCustomToken`, MFA claims), Firestore (`platform_approval_requests`, `platform_impersonation_sessions`), vitest.

**Priority order:** A (approvals) → C (MFA) → B (impersonation). Approvals close the biggest live risk (a single compromised super-admin session); MFA is small and high-leverage; impersonation is a feature, not a defense, so it goes last.

---

## Locked design decisions

1. **Requester ≠ approver**, enforced server-side (compare `request.requestedBy.userId` to approver's verified uid). Super admins are NOT exempt.
2. **Approval-gated actions (initial set):** `organization.suspend`, `organization.clear_activity_logs`, `feature.toggle_kill_switch` (enable only), `automation.clear`, and any **non-dry-run** `platform_jobs` create. Everything else executes directly as today.
3. Requests **expire after 48h** (`expiresAt`), single execution (`status` state machine: `pending → approved → executed`, or `rejected` / `expired`). Payload is stored server-side at request time — the approver approves *exactly* what was requested; no client payload at execution.
4. Impersonation sessions are **60 minutes max**, require a reason string, are limited to `super_admin`, and always audit `impersonation.start` / `impersonation.end`. The custom-token claims carry `{ impersonatedBy, impersonationSessionId }`.
5. MFA enforcement is **flag-gated** (`BACKOFFICE_REQUIRE_MFA` env) with a dated grace period so existing admins can enroll before lockout.

## Required Firebase artifacts

**Firestore rules** (extend the platform block — same deny pattern):
```
match /platform_approval_requests/{id}   { allow read, write: if false; }
match /platform_impersonation_sessions/{id} { allow read, write: if false; }
```

**Indexes** (`firestore.indexes.json`):
```json
{ "collectionGroup": "platform_approval_requests", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] }
```
(Impersonation sessions are fetched by id / by `endedAt == null` single-field — auto-indexed.)

**No new Cloud Functions.** Expiry is evaluated lazily on read/approve (`expiresAt < now → expired`), avoiding a scheduler dependency.

---

## Phase A — Approval Workflow (four-eyes)

**Files:**
- Create: `src/lib/backoffice/backoffice-approval-actions.ts`, `src/lib/backoffice/approval-registry.ts`, `src/lib/backoffice/__tests__/backoffice-approvals.test.ts`
- Create: `src/app/(backoffice)/backoffice/approvals/page.tsx` + `components/ApprovalsInboxClient.tsx`
- Modify: `backoffice-types.ts` (types + `approvals` module in `BackofficeModule`), `backoffice-rbac.ts` (matrix column), `BackofficeSidebar.tsx` (nav item), the 4 gated actions, `firestore.rules`, `firestore.indexes.json`

### Data model (`backoffice-types.ts`)
```ts
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

/** Registry key of an approval-gated operation. */
export type ApprovalActionKey =
  | 'organization.suspend'
  | 'organization.clear_activity_logs'
  | 'feature.enable_kill_switch'
  | 'automation.clear'
  | 'job.create_live';

export interface ApprovalRequest {
  id: string;
  actionKey: ApprovalActionKey;
  /** Serialized, validated inputs captured at request time. */
  payload: Record<string, unknown>;
  /** Human summary shown in the inbox, e.g. "Suspend Acme Corp: nonpayment". */
  summary: string;
  status: ApprovalStatus;
  requestedBy: AuditActor;
  decidedBy?: AuditActor;
  decidedAt?: string;
  executedAt?: string;
  executionError?: string;
  createdAt: string;
  expiresAt: string; // createdAt + 48h
}
```

### Core flow
1. **Gate helper** in `backoffice-approval-actions.ts`:
```ts
'use server';
// createApprovalRequest(actionKey, payload, summary, idToken):
//   actor = authorizeBackoffice(idToken, moduleFor(actionKey), 'execute')
//   → writes ApprovalRequest{status:'pending'} → audit 'approval.requested'
// decideApprovalRequest(requestId, decision: 'approved'|'rejected', idToken):
//   actor = authorizeBackoffice(idToken, 'approvals', 'execute')
//   → reject if actor.userId === request.requestedBy.userId  (four-eyes)
//   → reject if expired (lazy expiry) or not 'pending'
//   → on approve: transition to 'approved', then EXECUTE the registered
//     executor with the STORED payload, then 'executed' (or record
//     executionError and stay 'approved' for retry) → audit both steps
// listApprovalRequests(idToken, statusFilter): approvals:view
```
2. **Executor registry** (`approval-registry.ts`, pure map): `ApprovalActionKey → (payload, approverActor) => Promise<{success, error?}>`, delegating to *internal* (non-exported-action) functions of the existing modules — mirror the `executeJob` internal pattern so executors are not public endpoints.
3. **Gated actions change shape:** e.g. `suspendOrganization` keeps its signature but, when approvals are enabled for the key, returns `{ success: true, pendingApproval: true, requestId }` instead of mutating. UI shows "Sent for approval" state (toast + badge) instead of the applied state.
4. **RBAC:** add `approvals` module — `view` for all roles, `execute` for `super_admin` and `security_auditor` (decision-makers), `create` implicit via the gated action's own permission.

### Steps
- [x] **A1** Types + `approvals` module in `BackofficeModule` union + ROLE_MATRIX column (matrix parity holds — client imports the same engine).
- [x] **A2** Failing tests: four-eyes rejection (same uid), expiry transition, non-pending decision rejected, executor called with stored payload (not caller payload), audit entries written for request + decision.
- [x] **A3** Implement `backoffice-approval-actions.ts` + `approval-registry.ts` (executors for the 5 keys, wired to internal fns extracted from org/feature/job actions).
- [x] **A4** Convert the 4 gated actions to enqueue; update their call sites' UX (pending toast, disabled state).
- [x] **A5** Approvals inbox UI (list pending/decided, approve/reject with confirm, requester can cancel own request).
- [x] **A6** Rules + index entries; deploy note.
- [x] **A7** `pnpm typecheck && pnpm vitest run src/lib/backoffice` green → commit `feat(backoffice): four-eyes approval workflow for dangerous actions`.

**Risks:** double-execution on concurrent approvals → decide inside a Firestore transaction on the request doc; executor failure after 'approved' → keep status 'approved' + `executionError`, allow retry by another decision call.

---

## Phase C — MFA Enforcement (do second)

**Files:** Modify `backoffice-auth.ts`, `backoffice-errors.ts` (`'mfa-required'` code), `AuthorizationGate.tsx` (enrollment prompt UX); Create `__tests__` additions.

1. - [ ] **C1** Failing tests: token without second factor + flag on → `BackofficeAuthError('mfa-required')`; flag off → passes; token with `sign_in_second_factor` → passes.
2. - [ ] **C2** In `resolveBackofficeActor`, after `verifyIdToken`:
```ts
const mfaRequired = process.env.BACKOFFICE_REQUIRE_MFA === 'true';
const hasSecondFactor = Boolean(decoded.firebase?.sign_in_second_factor);
if (mfaRequired && !hasSecondFactor) {
  throw new BackofficeAuthError('Multi-factor authentication required for backoffice access.', 'mfa-required');
}
```
3. - [ ] **C3** Client: `AuthorizationGate` catches `mfa-required` (surfaced via a `checkBackofficeAccess` ping action) → renders an enrollment screen linking to Firebase MFA enrollment (TOTP/SMS per project config) instead of a dead redirect.
4. - [ ] **C4** Ops notes: enable MFA providers in Firebase console; announce grace date; flip `BACKOFFICE_REQUIRE_MFA=true`.
5. - [ ] **C5** Verify + commit `feat(backoffice): enforce MFA for backoffice access behind flag`.

**Risk:** locking out the only super admin → flag + grace period; document a break-glass (temporarily unset env var) in the runbook.

---

## Phase B — Impersonation (do last)

**Files:** Create `src/lib/backoffice/backoffice-impersonation-actions.ts`, `src/components/ImpersonationBanner.tsx`, tests; Modify org/user detail UI (entry point), main app layout (banner mount), `firestore.rules`.

### Data model
```ts
export interface ImpersonationSession {
  id: string;
  targetUserId: string;
  targetEmail: string;
  organizationId: string;
  reason: string;            // required, non-empty
  startedBy: AuditActor;     // super_admin only
  startedAt: string;
  expiresAt: string;         // startedAt + 60min
  endedAt?: string;
}
```

### Flow
- `startImpersonation(targetUserId, reason, idToken)` → `authorizeBackoffice(idToken, 'organizations', 'execute')` + role must include `super_admin` → create session doc → `adminAuth.createCustomToken(targetUserId, { impersonatedBy: actor.userId, impersonationSessionId })` → audit `impersonation.start` → return custom token. Client opens the tenant app in a **new tab** and signs in with the custom token (existing `signInWithCustomToken` util).
- `endImpersonation(sessionId, idToken)` → sets `endedAt`, audits `impersonation.end`. Banner also auto-expires by comparing `expiresAt`.
- **Banner:** main app layout reads the ID-token result claims; when `impersonatedBy` is present, render a fixed, non-dismissible top banner — "Viewing as {email} · impersonation by platform staff · Ends {time} · [End session]". Every server action the tenant app performs still runs as the *target* user (their permissions), which is the point: reproduce exactly what the user sees.
- **Guard:** impersonated tokens must NOT grant backoffice access — in `resolveBackofficeActor`, reject tokens carrying `impersonatedBy` (`forbidden`), preventing privilege bounce-back.

### Steps
- [ ] **B1** Failing tests: non-super-admin start rejected; empty reason rejected; audit written; impersonated token rejected by `resolveBackofficeActor`; end sets `endedAt`.
- [ ] **B2** Implement actions + session collection + rules entry.
- [ ] **B3** Banner component + layout mount + claim detection (`getIdTokenResult`).
- [ ] **B4** Entry point button on backoffice user/org detail (super_admin-only, reason dialog).
- [ ] **B5** Verify + commit `feat(backoffice): audited impersonation with visible banner`.

**Risks:** forgotten sessions → hard 60-min token expiry (custom tokens mint 1h Firebase sessions naturally; the banner's end-time reflects it); claim spoofing → claims only ever set server-side via Admin SDK.

---

## Definition of Done
- Dangerous actions cannot execute without a second admin; every request/decision/execution is in `platform_audit_logs`.
- Backoffice access requires a second factor when the flag is on, with a working enrollment path.
- Impersonation is super-admin-only, reasoned, time-boxed, visibly bannered, fully audited, and cannot reach the backoffice.
- All new collections client-denied; matrix parity intact; no `any`; suite green.

## Open questions (answer before the relevant phase)
1. **Q-A:** ✅ Confirmed — initial list as proposed.
2. **Q-C:** ✅ TOTP.
3. **Q-B:** ✅ super_admin AND support_admin may impersonate.
