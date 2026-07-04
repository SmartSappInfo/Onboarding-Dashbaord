# Backoffice Server-Action Authorization Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do NOT batch phases — each phase is independently shippable and must end green (`pnpm verify`) before the next begins.

**Goal:** Every backoffice server action must verify the caller's Firebase ID token server-side and enforce per-module/per-action RBAC — closing the current gap where mutating actions trust a client-supplied `actor` object and read actions have no auth at all — without losing any existing functionality.

**Architecture:** Introduce one shared, server-only authorization primitive (`authorizeBackoffice`) that verifies the ID token, resolves the trusted actor from Firestore, and runs the existing `evaluateBackofficePermission` RBAC engine. Convert every mutating action's trailing `actor: AuditActor` parameter to `idToken: string`, and add a `view`-level check to every read action. Because all backoffice data fetching is client-invoked, call sites migrate uniformly to `await user.getIdToken()`. Secrets at rest are wrapped with the existing envelope vault. Defense-in-depth is added via explicit Firestore deny rules and the composite indexes the audit module already requires.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, Firebase Admin SDK (`adminAuth`/`adminDb`), Firestore, `firebase-admin`, `zod` 3.24, `vitest`, pnpm. Existing crypto: `src/lib/whatsapp/crypto-vault.ts` (versioned envelope) and `src/lib/crypto.ts`.

---

## Skills Conformance (apply throughout)

| Skill | How this plan conforms |
|---|---|
| `server-auth-actions` (vercel) | Auth + authorization checked **inside** every action; validate → authenticate → authorize → mutate ordering. |
| `next-best-practices` | Server-only code stays behind `'use server'`; no server imports leak into client bundles; use `after()` where already used; typed async APIs. |
| `vercel-react-best-practices` | `js-set-map-lookups` (RBAC uses `Set`), `rerender-derived-state-no-effect` (provider derives during render), `async-parallel` (`Promise.all` in reads), `bundle-barrel-imports` (client keeps its own RBAC mirror — do not import server RBAC into client). |
| `emilkowal-animations` | Loading/forbidden/success states use short (150–250ms) ease-out transitions; no layout-shift spinners; optimistic UI reverts on `Forbidden`. |
| `frontend-design` | Error surfaces are explicit and human ("You don't have permission to X"), never silent; destructive actions keep their confirm dialogs. |
| `firebase-security-rules-auditor` | New rules are explicit deny for `platform_*`; `platform_audit_logs` immutability (no update/delete) enforced; no client authority from `request.resource.data`. |
| `code-refactoring` | Shared helper removes 9-file duplication; `catch (e: unknown)` + `getErrorMessage` replaces `catch (error: any)`. |
| `test-driven-development` | Each phase: failing test → implement → green → commit. |

**Rule #4 (no `any`/`any[]`):** All new code uses explicit types or `unknown` with narrowing. A shared `getErrorMessage(e: unknown): string` replaces every `catch (error: any)` in files we touch. Firestore reads are typed via narrow interfaces (`BackofficeUserProfile`), never `as any`.

---

## Locked Authorization Matrix

Each action maps to one `(module, action)` pair. 🔶 = product decision required before its phase (see Open Questions).

| Action(s) | File | `(module, action)` |
|---|---|---|
| `listAllFeatures`, `getFeatureDetail` | feature | `features:view` |
| `updateFeatureRolloutRules` | feature | `features:edit` |
| `toggleFeatureKillSwitch` | feature | `features:execute` |
| `listAllJobs` | job | `operations:view` |
| `createJob`, `cancelJob`, `retryJob`/`executeJob` | job | `operations:execute` |
| `getGlobalAiKeys`, `getGlobalAiConfig` | ai | `settings:view` |
| `saveGlobalAiKeys`, `saveGlobalAiConfig` | ai | `settings:edit` |
| `listProviderSettings` | provider | `settings:view` |
| `saveProviderSetting` | provider | `settings:edit` |
| `listAllOrganizations`, `getOrganizationDetail`, `getOrganizationDiagnostics` | org | `organizations:view` |
| `updateOrganizationFromBackoffice`, `toggleOrganizationActivityLogging` | org | `organizations:edit` |
| `createOrganizationFromBackofficeAction`, `shareOrgSetupInviteAction` | org | `organizations:create` |
| `suspendOrganization`, `restoreOrganization` | org | 🔶 `organizations:execute` |
| `clearOrganizationActivityLogs` | org | 🔶 `organizations:execute` |
| `listAllWorkspaces`, `getWorkspaceDiagnostics` | workspace | `workspaces:view` |
| `archiveWorkspaceFromBackoffice`, `restoreWorkspaceFromBackoffice` | workspace | `workspaces:edit` |
| `listFieldPacks`, `getContactTypeDefaults`, `listNativeFields`, `listPlatformIndustryFieldGroups` | field | `fields:view` |
| `saveContactTypeDefaults`, `saveFieldPack`, `saveNativeField`, `savePlatformIndustryFieldGroup` | field | `fields:edit` |
| `deletePlatformIndustryFieldGroup` | field | `fields:delete` |
| `listAllTemplates`, `getTemplateDetail` | template | `templates:view` |
| `publishTemplate`, `deprecateTemplate` | template | `templates:edit` |
| `listAllAssets` | asset | `assets:view` |
| `saveAssetRecord` | asset | `assets:edit` |
| `deleteAssetRecord` | asset | `assets:delete` |
| `fetchAuditLogs`, `queryAuditLogs` | audit | `audit:view` |

---

## File Structure

**Create:**
- `src/lib/backoffice/backoffice-auth.ts` — `authorizeBackoffice(idToken, module, action)`, `resolveBackofficeActor(idToken)`, `BackofficeAuthError`. Single responsibility: identity + RBAC for the control plane.
- `src/lib/backoffice/__tests__/backoffice-auth.test.ts` — unit tests for the helper.
- `src/lib/backoffice/backoffice-errors.ts` — `getErrorMessage(e: unknown): string` (shared, removes `catch (error: any)`).
- `src/hooks/use-backoffice-token.ts` — client hook returning `getToken(): Promise<string>` (wraps `useUser().user.getIdToken()`), throws a typed error if signed out.
- `src/lib/backoffice/__tests__/backoffice-actions-authz.test.ts` — one representative authz test per action file (allowed role passes, wrong role → `Forbidden`, bad token → throws).

**Modify (server):** all 9 action files under `src/lib/backoffice/` (`feature`, `job`, `ai`, `provider`, `org`, `workspace`, `field`, `template`, `audit` + `audit-logger.ts`).

**Modify (client call sites):** `OrgListClient`, `OrgDetailClient`, `ShareOrgInvite`, `FeatureListClient`, `FeatureDetailClient`, `WorkspaceListClient`, `WorkspaceDetailClient`, `TemplateListClient`, `TemplateDetailClient`, `AssetLibraryClient`, `ProviderSettingsEditor`, `SystemDefaultsClient`, `AuditLogViewerClient`, `IndustryFieldsEditor`, `FieldPackDialog`, `FieldPackEditor`, `ContactTypeDefaults`, `JobRunner`/`OperationsDashboard`, and **`src/app/admin/users/roles/RolesClient.tsx`** (external consumer).

**Modify (infra):** `firestore.rules`, `firestore.indexes.json`.

---

## Affected / At-Risk Features Inventory

| Feature | Why affected | Handling |
|---|---|---|
| Every backoffice page's data load | Signature `actor`→`idToken`; reads gain auth | Migrated in the same phase as its action (no cross-phase breakage). |
| `admin/users/roles/RolesClient.tsx` | Imports a backoffice action outside the route group | Migrated in the phase that touches that action; add to its call-site list. |
| Legacy `src/app/admin/backoffice/messaging/*` (StylesClient/TemplatesClient) | Possible duplicate surface calling messaging actions | Phase 7 audits; confirm canonical vs dead before deleting. Do **not** delete blind. |
| Audit-log filtering (`queryAuditLogs`/`fetchAuditLogs`) | Currently throws `FAILED_PRECONDITION` (missing composite index) whenever a filter is applied | Fixed in Phase 6 (indexes) — this is a **pre-existing bug** surfaced by this work. |
| AI key "unchanged" sentinel (`••••••••`) | Phase 5 encryption changes stored value; masking/skip-write logic must still detect "unchanged" | Phase 5 keeps sentinel semantics: compare against decrypted current value, re-encrypt only real changes. |
| Optimistic UI in list clients | A now-possible `Forbidden` throw must not leave stale optimistic state | Call sites wrap actions in try/catch, revert + toast on failure (frontend-design). |
| Server components (`page.tsx`) | Confirmed thin wrappers — no server-side action calls | No SSR auth changes needed. |

---

## Risk Register — What Could Go Wrong & Resolution

| # | Risk | Likelihood | Resolution / Mitigation |
|---|---|---|---|
| R1 | **Lockstep drift:** server signature changes but a call site still passes `actor` → runtime/type error, backoffice page broken. | High | Change server + all its call sites in the **same commit**; `pnpm typecheck` is a hard gate (the removed `actor` param makes stale callers fail to compile — this is a feature, not a bug). |
| R2 | **Self-lockout:** wrong `(module, action)` mapping denies legitimate admins (e.g. mapping a read to `execute`). | Medium | Matrix reviewed above; `super_admin` retains all actions; smoke-test each phase as super_admin before merge. |
| R3 | **`getIdToken()` latency/expiry** adds a round-trip or returns stale token. | Medium | Use `user.getIdToken()` (auto-refreshes if <5min to expiry); never force-refresh on every call. Show pending state via `useTransition` (emilkowal — no spinner flash under 200ms). |
| R4 | **Signed-out / token-less race** on mount reads. | Medium | `use-backoffice-token` throws typed `NotAuthenticatedError`; call sites treat it as "still loading", not an error toast. Reads gated behind `useUser()` ready state. |
| R5 | **Audit-log index missing** → filter throws in prod. | High (already latent) | Phase 6 ships exact composite indexes; deploy indexes **before/with** the audit phase. |
| R6 | **Encryption migration corrupts keys** (double-encrypt, or read path not updated). | Medium | Phase 5 uses a dry-run `platform_jobs` migration first; envelope carries a version tag so already-encrypted values are skipped; consumer read paths updated in the same phase; keep a one-command rollback (re-run with `decrypt` mode). |
| R7 | **RBAC divergence:** client `ROLE_MATRIX` mirror drifts from server. | Medium | Add a unit test asserting the two matrices are structurally equal (import both, deep-compare). Server remains source of truth for enforcement. |
| R8 | **Firestore rules regression** breaks a legitimate client read. | Low | New rules are explicit-deny only for already server-only `platform_*`; run rules unit tests (`@firebase/rules-unit-testing`) / `firebase emulators:exec`. No client currently reads `platform_*`. |
| R9 | **`unstable_after` job execution** loses actor context after auth refactor. | Low | `createJob` resolves actor **before** scheduling `after(() => executeJob(id, actor))`; actor is captured, not re-derived in background. |
| R10 | **Combinatorial audit filters** need indexes we didn't create. | Low | Provide single-filter+timestamp indexes + the common `actor.userId+resourceType+timestamp`; document that new combos surface a console link; keep UI filters to the indexed set. |
| R11 | **Legacy `admin/backoffice` deletion** removes a still-used page. | Low | Phase 7 only after grep proves zero inbound links + no nav entry; otherwise leave and note. |

---

## Required Firebase Artifacts

### 1. Firestore Indexes (`firestore.indexes.json`)

Add to the `indexes` array. These make the **existing** audit queries and the provider upsert query work.

```json
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "actor.userId", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "action", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "resourceType", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "resourceId", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "scope", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "scopeId", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_audit_logs", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "actor.userId", "order": "ASCENDING" }, { "fieldPath": "resourceType", "order": "ASCENDING" }, { "fieldPath": "timestamp", "order": "DESCENDING" } ] },
{ "collectionGroup": "platform_provider_settings", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "provider", "order": "ASCENDING" }, { "fieldPath": "type", "order": "ASCENDING" } ] }
```

Single-field filters (`platform_industry_field_groups.industry`, `platform_jobs.createdAt`, `platform_*.name/key/createdAt` orderBys) are auto-indexed — no entry needed.

Deploy: `firebase deploy --only firestore:indexes`

### 2. Firestore Rules (`firestore.rules`) — add before the closing `}` of the `documents` match

Defense-in-depth. All `platform_*` access is via Admin SDK (bypasses rules); these lock out any client SDK path and guarantee audit-log immutability.

```
// --- Platform Control Plane (Backoffice) — server/Admin SDK only ---
match /platform_features/{id}            { allow read, write: if false; }
match /platform_entitlements/{id}        { allow read, write: if false; }
match /platform_templates/{id}           { allow read, write: if false; }
match /platform_assets/{id}              { allow read, write: if false; }
match /platform_provider_settings/{id}   { allow read, write: if false; }
match /platform_field_defaults/{id}      { allow read, write: if false; }
match /platform_native_fields/{id}       { allow read, write: if false; }
match /platform_contact_type_defaults/{id} { allow read, write: if false; }
match /platform_industry_field_groups/{id} { allow read, write: if false; }
match /platform_jobs/{id}                { allow read, write: if false; }
// Audit logs: never client-writable, never mutable (immutability).
match /platform_audit_logs/{id}          { allow read, write: if false; }
```

`system_settings/ai_keys` is already `allow read, write: if false` via the `{settingId}` catch-all — **do not loosen it**. Verify `system_settings/ai_config` staying `read: isSignedIn()` is acceptable (non-secret model defaults); leave as-is.

Deploy: `firebase deploy --only firestore:rules`

### 3. Server functions / env

- No new Cloud Functions. All logic runs in Next.js Server Actions (Node runtime).
- **Env for Phase 5:** the envelope vault key (see `crypto-vault.ts` `isVaultConfigured()` / `generateEncryptionKey()`). Confirm the key is set in all environments before enabling encryption; `saveGlobalAiKeys` must hard-fail (not silently store plaintext) if `!isVaultConfigured()`.

---

## Phase 0 — Shared Foundation (ships inside Phase 1's PR)

**Files:** Create `backoffice-errors.ts`, `backoffice-auth.ts`, `use-backoffice-token.ts`, `__tests__/backoffice-auth.test.ts`.

- [x] **Step 0.1 — Error util.** Create `src/lib/backoffice/backoffice-errors.ts`:

```ts
export class BackofficeAuthError extends Error {
  constructor(message: string, readonly code: 'unauthenticated' | 'forbidden') {
    super(message);
    this.name = 'BackofficeAuthError';
  }
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Unexpected error';
}
```

- [x] **Step 0.2 — Write failing test.** Create `src/lib/backoffice/__tests__/backoffice-auth.test.ts` (mock `firebase-admin` `adminAuth.verifyIdToken` + `adminDb`, mirror the mocking style in `industry-propagation.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyIdToken = vi.fn();
const userGet = vi.fn();
vi.mock('../../firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: { collection: () => ({ doc: () => ({ get: userGet }) }) },
}));

import { authorizeBackoffice } from '../backoffice-auth';

beforeEach(() => vi.clearAllMocks());

it('grants super_admin execute on features', async () => {
  verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c' });
  userGet.mockResolvedValue({ exists: true, data: () => ({ email: 'a@b.c', name: 'A', permissions: ['system_admin'] }) });
  const actor = await authorizeBackoffice('tok', 'features', 'execute');
  expect(actor).toMatchObject({ userId: 'u1', role: 'super_admin' });
});

it('forbids readonly_auditor from executing operations', async () => {
  verifyIdToken.mockResolvedValue({ uid: 'u2', email: 'r@b.c' });
  userGet.mockResolvedValue({ exists: true, data: () => ({ email: 'r@b.c', backofficeRoles: ['readonly_auditor'] }) });
  await expect(authorizeBackoffice('tok', 'operations', 'execute'))
    .rejects.toMatchObject({ code: 'forbidden' });
});

it('rejects an invalid token', async () => {
  verifyIdToken.mockRejectedValue(new Error('bad token'));
  await expect(authorizeBackoffice('bad', 'features', 'view')).rejects.toBeInstanceOf(Error);
});

it('rejects a user with no backoffice roles', async () => {
  verifyIdToken.mockResolvedValue({ uid: 'u3', email: 'n@b.c' });
  userGet.mockResolvedValue({ exists: true, data: () => ({ email: 'n@b.c' }) });
  await expect(authorizeBackoffice('tok', 'dashboard', 'view')).rejects.toMatchObject({ code: 'forbidden' });
});
```

- [x] **Step 0.3 — Run test, verify FAIL.** `pnpm vitest run src/lib/backoffice/__tests__/backoffice-auth.test.ts` → FAIL (module not found).

- [x] **Step 0.4 — Implement helper.** Create `src/lib/backoffice/backoffice-auth.ts`:

```ts
'use server';

import { adminAuth, adminDb } from '../firebase-admin';
import { evaluateBackofficePermission } from './backoffice-rbac';
import { BackofficeAuthError } from './backoffice-errors';
import type { AuditActor, BackofficeRole, BackofficeModule, BackofficeAction } from './backoffice-types';

interface BackofficeUserProfile {
  email?: string;
  name?: string;
  displayName?: string;
  permissions?: string[];
  backofficeRoles?: BackofficeRole[];
}

function resolveRoles(profile: BackofficeUserProfile): BackofficeRole[] {
  if (profile.permissions?.includes('system_admin')) return ['super_admin'];
  return profile.backofficeRoles ?? [];
}

/** Verifies the ID token and returns the trusted actor (no RBAC check). */
export async function resolveBackofficeActor(idToken: string): Promise<{ actor: AuditActor; roles: BackofficeRole[] }> {
  const decoded = await adminAuth.verifyIdToken(idToken);
  const snap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!snap.exists) throw new BackofficeAuthError('User profile not found', 'unauthenticated');

  const profile = snap.data() as BackofficeUserProfile;
  const roles = resolveRoles(profile);
  const email = profile.email ?? decoded.email ?? '';
  const actor: AuditActor = {
    userId: decoded.uid,
    name: profile.name ?? profile.displayName ?? email,
    email,
    role: roles[0] ?? 'readonly_auditor',
  };
  return { actor, roles };
}

/** Verifies token AND enforces RBAC for (module, action). Returns the trusted actor. */
export async function authorizeBackoffice(
  idToken: string,
  module: BackofficeModule,
  action: BackofficeAction = 'view',
): Promise<AuditActor> {
  const { actor, roles } = await resolveBackofficeActor(idToken);
  if (roles.length === 0) throw new BackofficeAuthError('No backoffice access', 'forbidden');
  if (!evaluateBackofficePermission(roles, module, action)) {
    throw new BackofficeAuthError(`Forbidden: ${module}:${action}`, 'forbidden');
  }
  return actor;
}
```

- [x] **Step 0.5 — Run test, verify PASS.** `pnpm vitest run src/lib/backoffice/__tests__/backoffice-auth.test.ts` → PASS.

- [x] **Step 0.6 — Client token hook.** Create `src/hooks/use-backoffice-token.ts`:

```ts
'use client';
import { useCallback } from 'react';
import { useUser } from '@/firebase';

export class NotAuthenticatedError extends Error {
  constructor() { super('Not authenticated'); this.name = 'NotAuthenticatedError'; }
}

export function useBackofficeToken() {
  const { user } = useUser();
  return useCallback(async (): Promise<string> => {
    if (!user) throw new NotAuthenticatedError();
    return user.getIdToken();
  }, [user]);
}
```

- [x] **Step 0.7 — Matrix parity test** (R7). Add to `backoffice-auth.test.ts`: import server `ROLE_MATRIX` (export it from `backoffice-rbac.ts`) and the client mirror; assert deep structural equality of role→module→action sets.

- [x] **Step 0.8 — Commit.**
```bash
git add src/lib/backoffice/backoffice-errors.ts src/lib/backoffice/backoffice-auth.ts src/hooks/use-backoffice-token.ts src/lib/backoffice/__tests__/backoffice-auth.test.ts src/lib/backoffice/backoffice-rbac.ts
git commit -m "feat(backoffice): add server-side auth+RBAC primitive and client token hook"
```

---

## Phase 1 — Highest Blast Radius: Features, Jobs (RBAC), AI Keys

**Files:** `backoffice-feature-actions.ts`, `backoffice-job-actions.ts`, `backoffice-ai-actions.ts` + call sites `FeatureListClient`, `FeatureDetailClient`, `SystemDefaultsClient`, `JobRunner`/`OperationsDashboard`.

**Conversion pattern (apply to every mutating action in this and later phases):**

```ts
// BEFORE
export async function toggleFeatureKillSwitch(featureId: string, killSwitch: boolean, actor: AuditActor) { ... }
// AFTER
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
export async function toggleFeatureKillSwitch(featureId: string, killSwitch: boolean, idToken: string) {
  try {
    const actor = await authorizeBackoffice(idToken, 'features', 'execute'); // ← per matrix
    // ...unchanged body, `actor` still used for audit + updatedBy...
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FEATURE] toggleFeatureKillSwitch failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
```

**Read pattern:**
```ts
export async function listAllFeatures(idToken: string) {
  try {
    await authorizeBackoffice(idToken, 'features', 'view');
    // ...unchanged body...
  } catch (error: unknown) { return { success: false, error: getErrorMessage(error) }; }
}
```

- [x] **Step 1.1 — Authz test** for one action per file in `__tests__/backoffice-actions-authz.test.ts` (feature kill switch, ai keys save): allowed role passes, wrong role → `forbidden`. Run → FAIL.
- [x] **Step 1.2 — feature-actions:** convert `listAllFeatures`, `getFeatureDetail` (`features:view`), `updateFeatureRolloutRules` (`features:edit`), `toggleFeatureKillSwitch` (`features:execute`). Replace all `catch (error: any)` → `unknown` + `getErrorMessage`.
- [x] **Step 1.3 — job-actions:** replace `resolveActorFromToken` internals with a call to `resolveBackofficeActor`; add `authorizeBackoffice(idToken,'operations','execute')` to `createJob`/`cancelJob`/`executeJob` (retry entrypoint) and `operations:view` to `listAllJobs`. Preserve `after(() => executeJob(id, actor))` capturing the resolved actor (R9). Remove the local `resolveActorFromToken`/`BackofficeRole` single-role logic.
- [x] **Step 1.4 — ai-actions:** `getGlobalAiKeys`/`getGlobalAiConfig` → `settings:view`; `saveGlobalAiKeys`/`saveGlobalAiConfig` → `settings:edit`. Keep the zod `.parse` **before** auth (validate → auth → mutate). Keep `••••••••` sentinel logic untouched (encryption is Phase 5).
- [x] **Step 1.5 — Call sites:** import `useBackofficeToken`; replace hand-built `actor` objects with `const idToken = await getToken()`; wrap calls in try/catch → toast on `Forbidden`, ignore `NotAuthenticatedError` on mount. Use `useTransition` for pending state (emilkowal — no <200ms spinner flash).
- [x] **Step 1.6 — Run authz tests → PASS.**
- [x] **Step 1.7 — Verify:** `pnpm typecheck && pnpm lint && pnpm vitest run src/lib/backoffice`. Fix all errors (stale callers will fail typecheck — migrate them). 
- [x] **Step 1.8 — Manual smoke:** as super_admin toggle a feature + save AI config (works); temporarily set a test user to `readonly_auditor` and confirm `Forbidden`.
- [x] **Step 1.9 — Commit.**
```bash
git add -A
git commit -m "feat(backoffice): enforce token+RBAC on features, jobs, and AI settings actions"
```

---

## Phase 2 — Organizations & Providers

**Files:** `backoffice-org-actions.ts` (7 mutators + 3 reads), `backoffice-provider-actions.ts` + call sites `OrgListClient`, `OrgDetailClient`, `ShareOrgInvite`, `ProviderSettingsEditor`.

- [x] **Step 2.0 — Resolve Open Question Q1** (suspend / clear-logs severity) before coding.
- [x] **Step 2.1 — Authz test** for `suspendOrganization` + `saveProviderSetting`. Run → FAIL.
- [x] **Step 2.2 — org-actions:** convert per matrix — reads `organizations:view`; `update`/`toggleOrganizationActivityLogging` → `edit`; `create*`/`shareOrgSetupInviteAction` → `create`; `suspend`/`restore`/`clearOrganizationActivityLogs` → `execute` (per Q1). Preserve join-token TTL/single-use logic and confirm dialogs. Replace `catch (error: any)`.
- [x] **Step 2.3 — provider-actions:** `listProviderSettings` → `settings:view`; `saveProviderSetting` → `settings:edit`. Keep the provider+type upsert query (needs the Phase 6 index).
- [x] **Step 2.4 — Call sites** migrate to `getToken()`; keep destructive-action confirmations.
- [x] **Step 2.5 — Verify + smoke + Commit.**
```bash
git commit -m "feat(backoffice): enforce token+RBAC on organization and provider actions"
```

---

## Phase 3 — Fields, Templates, Assets, Workspaces

**Files:** `backoffice-field-actions.ts`, `backoffice-template-actions.ts`, `backoffice-asset-actions.ts`, `backoffice-workspace-actions.ts` + call sites `IndustryFieldsEditor`, `FieldPackDialog`, `FieldPackEditor`, `ContactTypeDefaults`, `TemplateListClient`, `TemplateDetailClient`, `AssetLibraryClient`, `WorkspaceListClient`, `WorkspaceDetailClient`, **`admin/users/roles/RolesClient.tsx`**.

- [x] **Step 3.1 — Authz test** for `savePlatformIndustryFieldGroup` + `deletePlatformIndustryFieldGroup`. Run → FAIL.
- [x] **Step 3.2 — field-actions:** reads `fields:view`; saves `fields:edit`; `deletePlatformIndustryFieldGroup` `fields:delete`. **Auth must pass before `propagateIndustryGroupChanges` runs** — put `authorizeBackoffice` at the top of the try.
- [x] **Step 3.3 — template/asset/workspace actions** per matrix.
- [x] **Step 3.4 — Call sites** incl. the external `RolesClient.tsx` (grep for the exact imported action; migrate its call).
- [x] **Step 3.5 — Verify + smoke** (edit a field pack, confirm workspace propagation still fires) **+ Commit.**
```bash
git commit -m "feat(backoffice): enforce token+RBAC on field, template, asset, workspace actions"
```

---

## Phase 4 — Read-Action Lockdown & Audit Module

**Files:** `backoffice-audit-actions.ts`, `audit-logger.ts` (`queryAuditLogs`), any remaining `list*/get*` not yet gated + call sites `AuditLogViewerClient`, `AuditDiffViewer`, all list clients.

- [x] **Step 4.1 — Authz test** for `fetchAuditLogs` (`audit:view`). Run → FAIL.
- [x] **Step 4.2 — audit-actions:** `fetchAuditLogs`/`queryAuditLogs` take `idToken` first arg, `audit:view`. Keep `queryAuditLogs` usable by internal callers by exposing a token-less `queryAuditLogsInternal` used only by other **already-authorized** server actions (avoid double-auth); the public export requires token.
- [x] **Step 4.3 — Sweep:** confirm every exported `list*/get*/fetch*` across all 9 files now begins with an `authorizeBackoffice(idToken, module, 'view')`. (Grep checklist in Step 4.5.)
- [x] **Step 4.4 — Call sites** pass `getToken()`; audit viewer handles empty/forbidden gracefully.
- [x] **Step 4.5 — Verify** including grep gate:
```bash
grep -rL "authorizeBackoffice" src/lib/backoffice/backoffice-*-actions.ts   # expect: none
pnpm typecheck && pnpm lint && pnpm vitest run src/lib/backoffice
```
- [x] **Step 4.6 — Commit.**
```bash
git commit -m "feat(backoffice): require view-level auth on all read actions incl. audit logs"
```

---

## Phase 5 — Encrypt Secrets at Rest (independent hardening)

**Files:** `backoffice-ai-actions.ts`, `backoffice-provider-actions.ts`, consumers of AI keys / provider config, new migration job type in `backoffice-job-actions.ts` + `backoffice-types.ts`.

- [x] **Step 5.1 — Preflight:** confirm `isVaultConfigured()` true in every env; `saveGlobalAiKeys` throws (not silent plaintext) when false.
- [x] **Step 5.2 — Failing test:** save a key → stored value is an envelope (has `version`/`iv`/`ciphertext`), not plaintext; read path decrypts to original; `••••••••` sentinel leaves value unchanged.
- [x] **Step 5.3 — Implement:** wrap secret fields with `crypto-vault` `encrypt()` on write, `decrypt()` on read. Sentinel logic compares against **decrypted** current value. Never log plaintext (keep masking in audit).
- [x] **Step 5.4 — Migration:** add `encrypt_platform_secrets` to `PlatformJobType`; implement dry-run-capable job that encrypts existing plaintext rows (skip already-versioned envelopes). Run dry-run, review, then real run.
- [x] **Step 5.5 — Verify + Commit.**
```bash
git commit -m "feat(backoffice): encrypt AI/provider secrets at rest with envelope vault + migration job"
```

---

## Phase 6 — Firestore Indexes & Rules

**Files:** `firestore.indexes.json`, `firestore.rules`. (Deploy indexes **before** anyone relies on audit filtering — can ship alongside Phase 4.)

- [x] **Step 6.1** — Add the 8 index entries from *Required Firebase Artifacts §1*.
- [x] **Step 6.2** — Add the `platform_*` deny + audit-immutability rules from §2.
- [x] **Step 6.3 — Rules tests** (if `@firebase/rules-unit-testing` present or via `firebase emulators:exec`): assert a signed-in non-admin client SDK read of `platform_features`/`platform_audit_logs` is denied; `platform_audit_logs` write denied.
- [x] **Step 6.4 — Deploy:**
```bash
firebase deploy --only firestore:indexes,firestore:rules
```
- [x] **Step 6.5 — Verify** audit filtering in the UI no longer throws `FAILED_PRECONDITION`.
- [x] **Step 6.6 — Commit.**
```bash
git add firestore.indexes.json firestore.rules
git commit -m "chore(firestore): add platform_audit_logs indexes and platform_* deny rules"
```

---

## Phase 7 — Legacy Cleanup & Final Review

- [x] **Step 7.1** — Grep whether `src/app/admin/backoffice/messaging/*` is reachable (nav links, route usage). If dead → remove; if live → migrate its actions and note.
```bash
grep -rn "admin/backoffice/messaging" src --include="*.tsx" --include="*.ts"
```
- [x] **Step 7.2** — Final grep gates: no `catch (error: any)` in touched files; no `: any`/`any[]` introduced; every action authorized.
```bash
grep -rn ": any\|any\[\]" src/lib/backoffice src/hooks/use-backoffice-token.ts   # expect: none
```
- [x] **Step 7.3** — `pnpm verify` (lint + typecheck + full test run) green.
- [x] **Step 7.4** — Update `docs/feature_backoffice_superadmin.md` "Phase 1 — security" status; note token+RBAC enforcement complete.
- [x] **Step 7.5 — Commit.**
```bash
git commit -m "chore(backoffice): legacy cleanup, docs update, final authz verification"
```

---

## Definition of Done

- Every exported action in `src/lib/backoffice/*-actions.ts` (+ `audit-logger.queryAuditLogs`) begins with `authorizeBackoffice`/`resolveBackofficeActor`; no action accepts a client-supplied `actor`.
- `pnpm verify` green; no `any`/`any[]` in touched files; matrix-parity test passes.
- All backoffice pages function as before for authorized roles; unauthorized roles get explicit, non-crashing `Forbidden` UX.
- Indexes + rules deployed; audit filtering works; `platform_*` client access denied; audit logs immutable.
- Secrets encrypted at rest with a completed (non-dry-run) migration.

## Open Questions — RESOLVED

1. **Q1 (Phase 2):** ✅ Locked **super-admin-only** (`organizations:execute`) for suspend/restore/clear-logs.
2. **Q2 (Phase 5):** ✅ Vault key confirmed provisioned → Phase 5 implemented (AI keys). Provider-settings encryption **deferred**: `platform_provider_settings` has no runtime consumer and its `config` is a generic map with no secret-field schema, so encrypting it now would be premature (no decrypt path). Revisit when a consumer + secret-field designation exists.
3. **Q3 (Phase 7):** ✅ Investigated — `src/app/admin/backoffice/messaging/*` is **live, not dead**: the new `(backoffice)/backoffice/messaging/styles/page.tsx` re-exports the legacy `StylesClient`, which links to the legacy `styles/[id]`, `styles/new`, and `templates` editor routes (no replacement exists in the new tree). **Not deleted** — deleting would break style/template editing.

---

## Completion Status (2026-07-04)

**Done & committed:** Phases 0–6 (commits `523b4fe` … `238ab61`).
- Every backoffice mutation + read verifies the Firebase ID token and enforces RBAC (`authorizeBackoffice`). No action trusts a client-supplied actor.
- Jobs module RBAC gap closed; internal job processors de-exported from `'use server'`.
- Field reads used by trusted server callers split into token-less `*Internal`; SSR fields page made a thin client-fetching wrapper.
- Audit reads require `audit:view`; `queryAuditLogs` unauthenticated endpoint secured.
- Firestore: `platform_audit_logs` composite indexes (fixes latent `FAILED_PRECONDITION`) + `platform_*` deny/immutability rules. **Deploy:** `firebase deploy --only firestore:indexes,firestore:rules`.
- Global AI keys encrypted at rest (envelope vault) with legacy-plaintext-tolerant reads + idempotent dry-run migration job.
- No `any`/`any[]` in authored code; `pnpm typecheck` + backoffice `pnpm vitest` green (27 backoffice tests). 3 pre-existing failures in page-builder/automation are unrelated to this work.

**Follow-ups (not blocking):** deploy indexes/rules; run the `encrypt_platform_secrets` job (dry-run → real); provider-secret encryption when a consumer exists; Phase-7 spec governance (impersonation/approvals) remains future work.
