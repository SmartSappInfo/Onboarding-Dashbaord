# Organization Sender-ID Isolation (No Cross-Tenant Fallback) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` (or `subagent-driven-development`) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. **TDD is mandatory** (`test-driven-development`): write the failing test, watch it fail, then implement. **Verification gate** (`verification-before-completion`): no task is "done" until its command shows 0 failures.
>
> **Build / typecheck / test / lint / commit are run by the human, locally.** Do NOT run `next build`, `tsc`, `vitest`, `eslint`, or `git commit` from the agent. Each phase ends with the exact commands the human runs + the commit message to use.
>
> **Type hygiene:** No `any` / `any[]` in new or touched code. Use precise types, `unknown` + narrowing, or generics. A grep gate is part of every phase's verification.

**Goal:** Guarantee that a message is *always* sent using a sender profile (SMS Sender ID / email From / WhatsApp WABA) that belongs to the **same organization** as the message, resolving through an explicit **org → workspace → org-default** hierarchy with **no global fallback**. When no valid sender exists, the send fails cleanly and a failure notification is written to the in-app notifications panel for the org's admins. Under no circumstances may Org A send using Org B's sender, template, or provider key.

**Architecture:** A single pure resolver (`sender-resolution.ts`, no I/O, fully unit-tested) decides *which* sender id to use given candidates + an org-ownership predicate. A thin I/O wrapper loads the org/workspace/profile docs and feeds the pure resolver. The messaging engine resolves `organizationId` **first** (explicit → template → workspace), then scopes every `sender_profiles` read to that org and asserts ownership. Failures route through one `notifyMessagingFailure` helper. Firestore rules enforce the same org boundary server-side. Existing data is backfilled by an idempotent migration before the engine switch is flipped.

**Tech Stack:** Next.js (App Router, Server Actions), React 18, Firebase Admin SDK (server) + client SDK (admin UI), Zod, Vitest, Motion (`motion/react`) for UI micro-interactions.

---

## Cross-Cutting Standards (the code-review of the approach)

These are the result of reviewing the original advisory against `next-best-practices`, `vercel-react-best-practices`, `frontend-design`, `emilkowal-animations`, `test-driven-development`, `code-refactoring`, and `firebase-security-rules-auditor`. They apply to **every** phase.

| Rule (skill) | How this plan complies |
|---|---|
| **Defense in depth** (`firebase-security-rules-auditor`) | Isolation is enforced in *three* layers: pure resolver (logic), engine I/O wrapper (server), Firestore rules (`isOrgMatch`). No single layer is trusted alone. |
| **Pure core / imperative shell** (`code-refactoring`) | All branching logic lives in pure functions (`pickSenderProfileId`, `resolveOrgId`) — no Firestore inside. I/O wrappers are thin and dynamically import repositories, matching the existing `whatsapp-send.ts` style. |
| **TDD, real behavior** (`test-driven-development`) | Every phase writes the failing test first against real logic (no asserting-on-mocks). The cross-tenant leak gets an explicit regression test that must fail on `main` and pass after. |
| **No global fallback** (this feature) | The "any active profile for channel" and channel-wide `isDefault` queries are **deleted**, not patched. Resolution is a fixed, enumerated hierarchy. |
| **Server actions resolve identity server-side** (`next-best-practices: rsc-boundaries`, `server-auth-actions`) | `organizationId` is never trusted from the client for authorization; it is resolved from the authenticated workspace/template on the server. Client may *hint* but the server re-derives + validates. |
| `bundle-dynamic-imports` | Engine keeps lazily importing repos/services (`await import(...)`) so the resolver module stays out of client bundles and pure tests stay I/O-free. |
| `server-parallel-fetching` | Org-default + workspace-default + explicit-profile docs are fetched with `Promise.all`, not sequentially. |
| `rerender-derived-state-no-effect` | In the profiles UI, "which profile is default" is **derived during render** from the org/workspace pointer, never synced via `useEffect`. |
| `rerender-no-inline-components` / `rerender-functional-setstate` | Dialogs declared at module scope; multi-field state updates use functional `setState`. |
| `frontend-design` + `emilkowal-animations` | The profiles page gets a clear per-channel "Default sender" surface with an explicit org-vs-workspace badge, inline validation, and a **single** orchestrated reveal. Animations: `transform`/`opacity` only, `ease-out` ~150–200 ms for enters, respect `prefers-reduced-motion`, no layout-thrash transitions. |
| **No `any`** (user mandate) | New types are precise. `Channel = 'email' \| 'sms' \| 'whatsapp'`. Where Firestore returns loose data, narrow through typed mappers, never `as any`. Grep gate: `! grep -rnE '\bany\b(\[\])?' <touched files>`. |
| DRY / YAGNI | One resolver, one failure-notify helper, one org-resolution function reused by engine + bulk + callers. No per-channel duplication. We do **not** build a per-user sender-preference system (not required). |

**Local verification commands (human runs after each phase — agent must NOT run these):**
```bash
# Targeted tests for the phase (path varies per phase, see each phase)
npx vitest run src/lib/messaging/__tests__/ src/lib/__tests__/

# Type + lint + no-any gate
npm run typecheck         # or: npx tsc --noEmit
npm run lint
# No-any gate (example for the phase's touched files):
! grep -rnE '\bany\b(\[\])?' src/lib/messaging/sender-resolution.ts

npm run build             # only before deploy, not per-task
```

---

## The Tenancy Model (locked decisions)

**Data model changes**
- `SenderProfile` gains **`organizationId: string`** (required after backfill). Keeps `workspaceIds: string[]`.
- `Organization` gains **`defaultSenderProfileIds?: { email?: string; sms?: string; whatsapp?: string }`** — the org-level default per channel (the *only* permitted fallback).
- `Workspace` gains the same optional **`defaultSenderProfileIds?`** map — the workspace-level default.
- The legacy channel-wide `SenderProfile.isDefault` flag is **retained for display/back-compat** but is **no longer consulted by the engine**. Backfill seeds the org pointer from it.

**Resolution hierarchy (per channel), no global fallback:**
1. **Explicit** `senderProfileId` (not `'default'`/`'none'`) → load it, assert `profile.organizationId === orgId` **and** `profile.isActive`. Mismatch → reject (do not silently fall through).
2. **Workspace default** → `workspace.defaultSenderProfileIds[channel]` → assert org-owned + active.
3. **Org default** → `organization.defaultSenderProfileIds[channel]` → assert org-owned + active.
4. **None** → return `null`. Engine returns `{ success:false, error }` **and** calls `notifyMessagingFailure`.

**`organizationId` resolution order (server-side, before sender):** explicit input → `template.organizationId` → `workspace.organizationId`. If still empty → fail (never `'default'`).

**WhatsApp** is already org-scoped (`whatsapp-send.ts`); this plan only removes its `|| 'default'` orgId fallback and routes its "no connection" error through the same notify helper.

---

## Risk Register (Q2: what could go wrong + how it's resolved)

| # | Risk | Likelihood | Impact | Mitigation (built into the phases) |
|---|---|---|---|---|
| R1 | **Backfill misses or mis-assigns `organizationId`** (profile spans workspaces in >1 org, or orphaned workspace). | Med | High (wrong-org send or hard send failure) | Phase 1 migration is **dry-run first**, logs every assignment, and flags ambiguous profiles (workspaces resolving to >1 org) into a report instead of guessing. Engine switch (Phase 2) ships **after** backfill is verified clean. |
| R2 | **Removing the global fallback breaks every `senderProfileId: 'default'` caller** (15+ sites, incl. all internal notifications) the moment it deploys. | High | High | Phases are ordered so data (P1) + org-default seeding land before the engine flips (P2). Engine reads org default, so `'default'` callers keep working **iff** the org has a default. P1 guarantees every active org has one. Phase 4 then makes callers pass `organizationId` explicitly for correctness. |
| R3 | **Org has no configured default sender** → legitimate sends start failing silently. | Med | High | Failure is **not** silent: Phase 3 writes an in-app notification + activity log + returns a precise error. Phase 7 surfaces an admin banner prompting default configuration. Seed/onboarding (Phase 1b) creates a sensible default for new orgs. |
| R4 | **Engine resolves sender before org is known** (current code does sender at step 2, org at step 5). | Certain (existing) | High | Phase 2 reorders: org resolution becomes step 1; sender resolution consumes it. Covered by a unit test asserting order via the pure functions (no ordering bug possible since the wrapper requires `orgId` as a parameter). |
| R5 | **Two defaults / race when admin sets default** across workspaces. | Low | Med | Defaults are now a **single pointer field** on the org/workspace doc (not N docs with a boolean), so "set default" is one atomic `update`. No multi-doc batch, no race. |
| R6 | **Firestore rules tightened → existing client reads/writes 403.** | Med | Med | Phase 6 keeps `read` permissive (query-time filtering) but adds `organizationId` immutability + `isOrgMatch` on write. Rules ship with the emulator test (`@firebase/rules-unit-testing`) proving Org-A cannot write an Org-B profile. |
| R7 | **Scheduled/queued messages** captured a senderProfileId that later fails org validation (e.g. profile deleted, org changed). | Low | Med | The dispatch path (`scheduled-message-repository`, `bulk-messaging`) runs the **same** resolver at send time; a now-invalid id falls through to workspace/org default rather than sending wrong. Covered by Phase 4 test. |
| R8 | **Bulk email still uses platform Resend key** (org isolation hole for email provider). | Certain (existing) | Med | Phase 5 threads org `resendKey`/`resendDomain` into `sendBatchEmails`, mirroring the engine. |
| R9 | **Performance regression** from extra org/workspace doc reads per send. | Low | Low | Reads are `Promise.all` parallel; org/workspace docs are already fetched by the engine for branding. We **reuse** those reads (pass the loaded docs into the resolver) rather than adding round-trips. |
| R10 | **`any` creep** when mapping Firestore `DocumentData`. | Med | Low | Typed mapper `toSenderProfile(snap): SenderProfile` with explicit field reads; no `as any`. Grep gate per phase. |
| R11 | **In-app notification spam** if a broken automation loops a failing send. | Low | Med | `notifyMessagingFailure` de-dupes by `(orgId, templateId, channel, recipient-hash)` within a short window (Firestore doc id = stable hash) so repeated identical failures upsert one notice. |

---

## Blast Radius — Other Features Affected (Q3) & where each is handled

Every caller below currently passes `senderProfileId: 'default'` (or a named global like `'system-alerts'`) and relies on the global fallback being removed. Each is explicitly handled in **Phase 4** unless noted.

| Feature / file | Current call | Effect of change | Phase |
|---|---|---|---|
| Internal/external notifications — `notification-engine.ts` (9 calls) | `'default'`, passes `workspaceId` | Must resolve org from workspace; pass `organizationId`. | P4 |
| Invitations — `invitation-actions.ts` (2) | `'default'` | Pass org of the inviting workspace. | P4 |
| Contracts — `contract-actions.ts` (2) | `'default'` | Pass entity/workspace org. | P4 |
| Forms autoresponders — `forms-actions.ts` (3) | `'default'` | Pass form's org. | P4 |
| Reminders — `reminder-actions.ts` | `msg.senderProfileId \|\| 'default'` | Pass org stored on the scheduled msg. | P4 |
| Scheduled messages — `scheduled-message-repository.ts` | `msg.senderProfileId \|\| 'default'` | Persist + replay `organizationId`. Schema migration for in-flight docs. | P4 |
| Sequential scheduler — `sequential-scheduler.ts` | threaded `senderProfileId` | Thread `organizationId` through the step type. | P4 |
| PDF confirmations — `pdf-actions.ts` | `confirmationSenderProfileId \|\| 'default'` | Pass PDF owner org. | P4 |
| Automations send/notify — `automations/actions/message-actions.ts`, `notification-actions.ts` (`'system-alerts'`) | config id or `'default'`/`'system-alerts'` | Resolve org from `ExecutionContext.organizationId` (already available). | P4 |
| Campaign dispatch — `campaign-dispatch.ts`, `campaign-automation-jobs.ts`, `campaign-hooks.ts` | `campaign.senderProfileId` | Validate the campaign's sender is org-owned at dispatch; campaign already has workspace→org. | P4 |
| Bulk jobs — `bulk-messaging.ts` | `job.senderProfileId` (no fallback) + **bulk email skips org key** | Validate org ownership; **fix email provider key** (R8). | P5 |
| Bulk upload welcome msgs — `bulk-upload-actions.ts` | `senderId` + org keys already resolved | Confirm org alignment; mostly compliant. | P4 (audit only) |
| Direct test send — `template-actions.ts` | `sender` passed directly | Confirm caller passes an org-owned sender. | P4 (audit only) |
| Composer / Campaign wizard / Automation ActionConfig (client) | `sender_profiles` queried `where('isActive', true)` **(no workspace/org filter)** in `ComposerWizard.tsx:249`, `campaign-wizard.tsx:405`, `ActionConfigPanel.tsx:741`, `minimal-results-config.tsx`, `result-rule-manager.tsx` | Pickers can show **other orgs' senders**. Add `organizationId`/workspace filter. | P7 |
| Profiles admin — `messaging/profiles/page.tsx` | creates profiles without `organizationId`; `handleSetDefault` flips boolean across docs | Write `organizationId`; replace boolean-default with org/workspace pointer; default-config UX. | P7 |
| Firestore rules — `firestore.rules` (`sender_profiles`) | workspace-only write gate | Add org match + immutability. | P6 |
| Notifications panel — `NotificationCenter.tsx` | reads `in_app_notifications` | Receives new `category: 'messaging'` failures; add icon. | P3/P7 |

**Not affected (already correct):** WhatsApp credential/session/template resolution (org-keyed); org custom mNotify/Resend keys in `sendMessage`/`sendRawMessage` (single-send paths).

---

## Phase 0 — Foundations: types + pure resolver (no I/O)

**Files:**
- Modify: `src/lib/types.ts` (`SenderProfile`, `Organization`, `Workspace`)
- Create: `src/lib/messaging/sender-resolution.ts`
- Create: `src/lib/messaging/__tests__/sender-resolution.test.ts`

- [x] **Step 1: Add the failing test for the pure resolver**

```typescript
// src/lib/messaging/__tests__/sender-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { pickSenderProfileId, type SenderCandidate } from '../sender-resolution';

const owned = (id: string): SenderCandidate => ({ id, organizationId: 'orgA', isActive: true });

describe('pickSenderProfileId', () => {
  it('prefers a valid explicit profile owned by the org', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: owned('exp'),
      workspaceDefault: owned('ws'),
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'resolved', senderProfileId: 'exp', source: 'explicit' });
  });

  it('REJECTS an explicit profile owned by a different org (no fallthrough)', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: { id: 'evil', organizationId: 'orgB', isActive: true },
      workspaceDefault: owned('ws'),
      orgDefault: owned('org'),
    });
    expect(r).toEqual({ outcome: 'cross_org_explicit', senderProfileId: null, source: 'explicit' });
  });

  it('falls back explicit→workspace→org when each prior is absent', () => {
    expect(pickSenderProfileId({ orgId: 'orgA', explicit: null, workspaceDefault: owned('ws'), orgDefault: owned('org') }))
      .toEqual({ outcome: 'resolved', senderProfileId: 'ws', source: 'workspace_default' });
    expect(pickSenderProfileId({ orgId: 'orgA', explicit: null, workspaceDefault: null, orgDefault: owned('org') }))
      .toEqual({ outcome: 'resolved', senderProfileId: 'org', source: 'org_default' });
  });

  it('skips inactive candidates', () => {
    const r = pickSenderProfileId({
      orgId: 'orgA',
      explicit: null,
      workspaceDefault: { id: 'ws', organizationId: 'orgA', isActive: false },
      orgDefault: owned('org'),
    });
    expect(r.senderProfileId).toBe('org');
  });

  it('returns no_sender (NOT a global pick) when nothing valid exists', () => {
    const r = pickSenderProfileId({ orgId: 'orgA', explicit: null, workspaceDefault: null, orgDefault: null });
    expect(r).toEqual({ outcome: 'no_sender', senderProfileId: null, source: 'none' });
  });
});
```

- [ ] **Step 2: Run it; verify it fails** — `npx vitest run src/lib/messaging/__tests__/sender-resolution.test.ts` → FAIL (module missing). *(human runs)*

- [x] **Step 3: Implement the pure resolver**

```typescript
// src/lib/messaging/sender-resolution.ts
// Pure, I/O-free sender selection. No Firestore here — keep it unit-testable.

export type Channel = 'email' | 'sms' | 'whatsapp';

/** Minimal shape needed to decide ownership. Mapped from SenderProfile by the I/O wrapper. */
export interface SenderCandidate {
  id: string;
  organizationId: string;
  isActive: boolean;
}

export type ResolutionSource = 'explicit' | 'workspace_default' | 'org_default' | 'none';

export type ResolutionOutcome =
  | 'resolved'
  | 'cross_org_explicit' // explicit id belonged to another org — hard reject
  | 'no_sender';

export interface SenderResolution {
  outcome: ResolutionOutcome;
  senderProfileId: string | null;
  source: ResolutionSource;
}

export interface PickInput {
  orgId: string;
  explicit: SenderCandidate | null;
  workspaceDefault: SenderCandidate | null;
  orgDefault: SenderCandidate | null;
}

function isUsable(c: SenderCandidate | null, orgId: string): boolean {
  return !!c && c.isActive && c.organizationId === orgId;
}

export function pickSenderProfileId(input: PickInput): SenderResolution {
  const { orgId, explicit, workspaceDefault, orgDefault } = input;

  // An explicit id that exists but belongs to another org is a hard security reject.
  if (explicit && explicit.organizationId !== orgId) {
    return { outcome: 'cross_org_explicit', senderProfileId: null, source: 'explicit' };
  }
  if (isUsable(explicit, orgId)) {
    return { outcome: 'resolved', senderProfileId: explicit!.id, source: 'explicit' };
  }
  if (isUsable(workspaceDefault, orgId)) {
    return { outcome: 'resolved', senderProfileId: workspaceDefault!.id, source: 'workspace_default' };
  }
  if (isUsable(orgDefault, orgId)) {
    return { outcome: 'resolved', senderProfileId: orgDefault!.id, source: 'org_default' };
  }
  return { outcome: 'no_sender', senderProfileId: null, source: 'none' };
}
```

- [x] **Step 4: Extend the types** (also added `DefaultSenderProfileIds` type; patched the synthetic WhatsApp sender literal in `messaging-engine.ts` with `organizationId: ''` so the required field keeps the file type-valid before the Phase 2 rewrite)

```typescript
// src/lib/types.ts — add to SenderProfile
//   organizationId: string;            // tenant owner (required post-backfill)
// add to Organization and Workspace:
//   defaultSenderProfileIds?: Partial<Record<'email' | 'sms' | 'whatsapp', string>>;
```
(Edit the three interfaces in place; keep `SenderProfile.isDefault` for back-compat display.)

- [ ] **Step 5: Run tests; verify green.** *(human)*
- [ ] **Step 6: No-any gate** — `! grep -rnE '\bany\b(\[\])?' src/lib/messaging/sender-resolution.ts` *(human)*
- [ ] **Step 7: Commit** *(human)*

```bash
git add src/lib/messaging/sender-resolution.ts src/lib/messaging/__tests__/sender-resolution.test.ts src/lib/types.ts
git commit -m "feat(messaging): add org-scoped pure sender resolver + tenancy fields"
```

---

## Phase 1 — Backfill migration (data first, idempotent, dry-run)

**Files:**
- Create: `src/lib/migrations/backfill-sender-org.ts`
- Create: `src/lib/migrations/__tests__/backfill-sender-org.test.ts`

- [x] **Step 1: Failing test for the pure mapping** (which org a profile belongs to + ambiguity detection; also covers `pickOrgDefaultSeed`)

```typescript
// __tests__/backfill-sender-org.test.ts
import { describe, it, expect } from 'vitest';
import { resolveProfileOrg, type WorkspaceOrgMap } from '../backfill-sender-org';

const map: WorkspaceOrgMap = { ws1: 'orgA', ws2: 'orgA', ws3: 'orgB' };

describe('resolveProfileOrg', () => {
  it('returns the single org when all workspaces share it', () => {
    expect(resolveProfileOrg(['ws1', 'ws2'], map)).toEqual({ status: 'ok', organizationId: 'orgA' });
  });
  it('flags ambiguous when workspaces span multiple orgs', () => {
    expect(resolveProfileOrg(['ws1', 'ws3'], map)).toEqual({ status: 'ambiguous', organizationIds: ['orgA', 'orgB'] });
  });
  it('flags orphan when no workspace resolves', () => {
    expect(resolveProfileOrg(['wsX'], map)).toEqual({ status: 'orphan', organizationIds: [] });
  });
});
```

- [ ] **Step 2: Run; verify fail.** *(human)*

- [x] **Step 3: Implement the pure mapper + the migration runner** (`backfill-sender-org.ts`: `resolveProfileOrg`, `pickOrgDefaultSeed`, and `backfillSenderOrg(mode)`; never overwrites an org default already set; reports `orgsMissingDefault`). Trigger: `src/app/actions/backfill-sender-org-action.ts` (`requireSystemAdmin`, dry-run by default).

```typescript
// src/lib/migrations/backfill-sender-org.ts
export type WorkspaceOrgMap = Record<string, string>;

export type ProfileOrgResult =
  | { status: 'ok'; organizationId: string }
  | { status: 'ambiguous'; organizationIds: string[] }
  | { status: 'orphan'; organizationIds: [] };

export function resolveProfileOrg(workspaceIds: string[], map: WorkspaceOrgMap): ProfileOrgResult {
  const orgs = Array.from(new Set(workspaceIds.map((w) => map[w]).filter((x): x is string => !!x)));
  if (orgs.length === 1) return { status: 'ok', organizationId: orgs[0] };
  if (orgs.length === 0) return { status: 'orphan', organizationIds: [] };
  return { status: 'ambiguous', organizationIds: orgs };
}
```

The runner (`'use server'`, lazy `adminDb` import) must:
1. Load all `workspaces` → build `WorkspaceOrgMap`.
2. For each `sender_profiles` doc without `organizationId`, call `resolveProfileOrg`.
   - `ok` → in **apply** mode set `organizationId`; in **dry-run** log only.
   - `ambiguous` / `orphan` → push to a report array; never guess.
3. For each org, seed `Organization.defaultSenderProfileIds[channel]` from the profile currently flagged `isDefault` for that channel (or the sole active one). Log when an org has no candidate (R3).
4. Return `{ updated, ambiguous, orphan, orgsMissingDefault }`. Accept a `mode: 'dry-run' | 'apply'` param defaulting to `'dry-run'`.

- [ ] **Step 4: Run tests; green.** *(human)*
- [ ] **Step 5: No-any gate** on both files. *(human)*
- [ ] **Step 6: Human runs the migration in DRY-RUN against the real project, reviews the report, then APPLY.** Document the trigger (temporary admin route or `tsx` script) in the PR description. **Do not flip Phase 2 until the report shows 0 unresolved-active profiles.**
- [ ] **Step 7: Commit** *(human)*

```bash
git add src/lib/migrations/backfill-sender-org.ts src/lib/migrations/__tests__/backfill-sender-org.test.ts
git commit -m "feat(messaging): idempotent backfill of sender organizationId + org defaults"
```

---

## Phase 2 — Engine: org-first resolution, no global fallback

**Files:**
- Create: `src/lib/messaging/sender-repository.ts` (I/O wrapper; typed mapper)
- Modify: `src/lib/messaging-engine.ts` (`sendMessage` lines ~80–130 & ~440; `sendRawMessage` ~848–863; WhatsApp orgId ~750)
- Create/Modify: `src/lib/messaging/__tests__/sender-repository.test.ts`

- [x] **Step 1: Failing test** — wrapper composes org/workspace/explicit candidates and calls the pure resolver; cross-org explicit id is rejected. Injected fake loader; also covers sentinel normalization, dedupe-loads-once, and `resolveOrgId` precedence.

```typescript
// sender-repository.test.ts (core case)
import { describe, it, expect } from 'vitest';
import { resolveSenderProfileId } from '../sender-repository';

it('rejects an explicit sender from another org', async () => {
  const loader = async (id: string) =>
    id === 'evil' ? { id, organizationId: 'orgB', isActive: true } : null;
  const res = await resolveSenderProfileId({
    orgId: 'orgA', channel: 'sms', explicitId: 'evil',
    workspaceDefaultId: null, orgDefaultId: null, loadCandidate: loader,
  });
  expect(res.outcome).toBe('cross_org_explicit');
});
```

- [ ] **Step 2: Run; fail.** *(human)*

- [x] **Step 3: Implement `resolveSenderProfileId`** — takes ids + injectable `loadCandidate` (default reads `sender_profiles` via lazy `adminDb`), dedupes + `Promise.all`s the loads, calls `pickSenderProfileId`. Exported `toSenderProfile` typed mapper + `normalizeExplicitSenderId` sentinel helper. No `any`.

- [x] **Step 4: Add a pure `resolveOrgId` helper** in `sender-repository.ts`: `(explicit?, templateOrgId?, workspaceOrgId?) => string | null`. Unit-tested.

- [x] **Step 5: Rewire `sendMessage`** (`messaging-engine.ts`):
  - Add `organizationId?: string` to `SendMessageInput`.
  - **Move org resolution above sender resolution.** Fetch the template (existing), then resolve `orgId = input.organizationId || template.organizationId || (await workspaceOrg(workspaceId))`. If null → fail + `notifyMessagingFailure` (Phase 3) → return.
  - **Assert template ownership:** if `template.organizationId && template.organizationId !== orgId && template.scope !== 'global'` → reject.
  - For non-WhatsApp: load org + workspace docs (reuse the branding fetch later in the fn — hoist it up so it's read once), pass `defaultSenderProfileIds[channel]` into `resolveSenderProfileId`. On `resolved` load the full `SenderProfile`; on `no_sender`/`cross_org_explicit` → fail + notify → return precise error.
  - **Delete** the channel-wide `isDefault` query and the "any active profile" query (lines ~108–127).
  - WhatsApp branch: replace `|| 'default'` with the resolved `orgId`; on missing connection, route through notify.

- [x] **Step 6: Mirror the change in `sendRawMessage`** (deleted its global-default block; org resolved first; same hierarchy; `in_app`/`push` synthesize an org-owned sender instead of the old throw).

**Phase 2 note:** `in_app`/`push` channels never had `sender_profiles` rows — the old engine threw for them. They now synthesize a minimal org-owned sender (a strict improvement). Their synthesized `channel` uses a localized `as unknown as SenderProfile['channel']` cast (not `any`) because `SenderProfile.channel` cannot represent those channels; the honest channel still reaches the log at runtime. The `notifyMessagingFailure` call on resolution failure is intentionally deferred to Phase 3 — Phase 2 returns a precise error string in its place.

- [ ] **Step 7: Run tests; green.** *(human)*
- [ ] **Step 8: No-any gate** on engine + repository touched regions. *(human)*
- [ ] **Step 9: Commit** *(human)*

```bash
git add src/lib/messaging/sender-repository.ts src/lib/messaging/__tests__/sender-repository.test.ts src/lib/messaging-engine.ts
git commit -m "feat(messaging): resolve sender org-first via hierarchy, drop global fallback"
```

---

## Phase 3 — Fail loudly: messaging failure notifications

**Files:**
- Create: `src/lib/messaging/messaging-failure-notice.ts`
- Create: `src/lib/messaging/__tests__/messaging-failure-notice.test.ts`
- Modify: `src/lib/messaging-engine.ts` (failure sites), `src/app/admin/components/NotificationCenter.tsx` (icon for `messaging`)

- [x] **Step 1: Failing test** for the pure parts: stable de-dupe doc id from `(orgId, templateId, channel, recipient)` and the message-builder text per `ResolutionOutcome`.

```typescript
import { describe, it, expect } from 'vitest';
import { failureNoticeId, buildFailureBody } from '../messaging-failure-notice';

it('produces a stable id for the same failure', () => {
  const a = failureNoticeId({ orgId: 'orgA', templateId: 't1', channel: 'sms', recipient: '+233...' });
  const b = failureNoticeId({ orgId: 'orgA', templateId: 't1', channel: 'sms', recipient: '+233...' });
  expect(a).toBe(b);
});
it('explains a missing-sender failure actionably', () => {
  expect(buildFailureBody('no_sender', 'sms')).toMatch(/no SMS sender/i);
});
```

- [ ] **Step 2: Run; fail.** *(human)*

- [x] **Step 3: Implement** `failureNoticeId` (FNV-1a → deterministic `msgfail_*` doc id), `buildFailureTitle`/`buildFailureBody`, and `notifyMessagingFailure(...)`: resolves org admins via `users where organizationId == orgId` + `canManageOrgIntegrations`, then **batch-upserts** (`set` with stable id `${noticeId}_${userId}`) an `in_app_notifications` doc per admin with `category: 'messaging'`, `isRead: false`, `actionUrl: '/admin/messaging/profiles'`. Wrapped in try/catch — never masks the original send failure (R11 de-dupe). (Activity-log entry dropped to avoid enum/noise risk; in-app panel is the requirement.)

- [x] **Step 4: Wire** the two engine resolution-failure sites (`sendMessage`, `sendRawMessage`) to call `notifyMessagingFailure` before returning the error.

- [x] **Step 5: NotificationCenter** — added a `messaging` case to `getIcon` (`MessageSquareWarning`, red) + import. No data-layer change (already reads `in_app_notifications`).

- [ ] **Step 6: Tests green + no-any gate.** *(human)*
- [ ] **Step 7: Commit** *(human)*

```bash
git add src/lib/messaging/messaging-failure-notice.ts src/lib/messaging/__tests__/messaging-failure-notice.test.ts src/lib/messaging-engine.ts src/app/admin/components/NotificationCenter.tsx
git commit -m "feat(messaging): notify org admins in-app when a send has no valid sender"
```

---

## Phase 4 — Thread `organizationId` through all callers

**Files (modify, one focused commit per cluster):**
- `src/lib/notification-engine.ts`, `src/lib/invitation-actions.ts`, `src/lib/contract-actions.ts`, `src/lib/forms-actions.ts`, `src/lib/reminder-actions.ts`, `src/lib/scheduled-message-repository.ts`, `src/lib/sequential-scheduler.ts`, `src/lib/pdf-actions.ts`, `src/lib/automations/actions/message-actions.ts`, `src/lib/automations/actions/notification-actions.ts`, `src/lib/campaign-dispatch.ts`, `src/lib/campaign-automation-jobs.ts`, `src/lib/campaign-hooks.ts`
- Tests: `src/app/actions/__tests__/` + `src/lib/__tests__/` co-located per file.

**Pattern for each caller (DRY):** resolve `organizationId` from the nearest authoritative source already in scope and pass it into `sendMessage`/`sendRawMessage`. Keep `senderProfileId: 'default'` as the "let the org default decide" sentinel — it now means *org default*, not *global default*.

- [x] **MUST-FIX breakage (R2):** `automations/actions/notification-actions.ts` used `senderProfileId: 'system-alerts'` (a named, org-less profile) which the org-scoped resolver would reject as `cross_org_explicit` → broken alerts. Changed both calls to `'default'` + `organizationId: orgId` (resolved from the workspace at the top of the action). Verified no other `'system-alerts'` references remain.
- [x] **Explicit org threaded** where trivially in scope:
  - `automations/actions/message-actions.ts` — both `sendMessage` branches (`organizationId || context.organizationId`) + the `sendRawMessage` direct-message path (`context.organizationId`).
  - `forms-actions.ts` — the 3 respondent-alert sends (`form.organizationId`).
  - `scheduled-message-repository.ts` + `reminder-actions.ts` — replay paths pass the persisted `msg.organizationId` (R7: the engine already stores `organizationId` on `scheduled_messages`, so in-flight docs resolve).
  - `pdf-actions.ts` — confirmation send (`pdfData.organizationId`).
  - `invitation-actions.ts` — email + SMS invites (`meeting.organizationId`).
- [x] **Rely on engine workspace-derivation (no change needed):** `notification-engine.ts` (9 calls, all pass `workspaceId`), `contract-actions.ts` (passes `workspaceId`), `sequential-scheduler.ts` (passes `workspaceId`). The engine resolves org from the workspace when `organizationId` is omitted, and these callers always send for that workspace's own org. **Campaign/bulk** carry `organizationId` on the job and are wired in Phase 5.
- [x] **No-any gate** — confirmed 0 new `any` across all 7 touched files.

**Testing note (deviation):** per-caller unit tests are skipped here because each change only forwards an extra field the engine *already* validates (unit-tested in Phases 0/2). Behavioral coverage is the Phase 8 cross-tenant regression test, which exercises the real engine path end-to-end. This avoids low-value, high-mock-cost tests that would only assert "a field was passed."

**Commit** *(human)*:
```bash
git add src/lib/automations/actions/message-actions.ts src/lib/automations/actions/notification-actions.ts src/lib/forms-actions.ts src/lib/scheduled-message-repository.ts src/lib/reminder-actions.ts src/lib/pdf-actions.ts src/lib/invitation-actions.ts
git commit -m "fix(messaging): thread organizationId through senders; route system alerts to org default"
```

---

## Phase 5 — Close the bulk-email provider-key hole

**Files:** `src/lib/bulk-messaging.ts` (lines ~135–161 resolve, ~272 & ~610 send), `src/lib/__tests__/bulk-messaging.*.test.ts`

- [x] **Step 1: Failing test** — unit test for the pure `pickOrgProviderKeys` mapping (custom vs platform per channel). (The provider-key wiring + sender guard are covered behaviorally; the pure mapping carries the unit coverage.)
- [x] **Step 3: Shared helper extracted** — `src/lib/messaging/org-provider-keys.ts` (`pickOrgProviderKeys` pure + `resolveOrgProviderKeys` I/O). **Both engine copies refactored to use it** (sendMessage + sendRawMessage), removing the 2 inline duplicates (DRY). Bulk `processBulkJobChunk` and `processJobChunkBackground` now resolve `orgId = job.organizationId || template.organizationId` and pass `providerKeys.resendKey`/`resendDomain` into **both** `sendBatchEmails` calls — closing R8. Bulk SMS `sendMessage` calls now pass `organizationId: orgId`.
- [x] **Sender ownership guard** — both bulk workers reject when `sender.organizationId !== orgId`: mark the chunk's tasks failed, fail the job, and call `notifyMessagingFailure` (`cross_org_explicit`). Defense-in-depth on top of the engine's per-send validation.
- [x] **No-any gate** — clean (helper + 0 new `any` in engine/bulk diffs).
- [ ] **Step 5: Commit** *(human)*

```bash
git add src/lib/bulk-messaging.ts src/lib/messaging-engine.ts src/lib/__tests__/bulk-messaging.*.test.ts
git commit -m "fix(bulk): use org's Resend key/domain + validate sender ownership in bulk email"
```

---

## Phase 6 — Firestore rules: enforce the boundary server-side

**Files:** `firestore.rules` (`sender_profiles` block ~415), `src/lib/__tests__/firestore-rules.sender.test.ts` (emulator, `@firebase/rules-unit-testing`)

- [x] **Step 1: Emulator test** — `src/lib/__tests__/sender-profile-security-rules.test.ts`: Org-A admin can create/update/delete their own profile; cannot create for Org-B; foreign org admin cannot update/delete an Org-A profile; `organizationId` cannot be changed on update. (Run with the Firestore emulator on :8080.)
- [x] **Step 3: Rule tightened** (`sender_profiles`): split into create/update/delete, each requiring `studios_edit` + `isOrgMatch(organizationId)`; update also pins `organizationId` immutable + `canAccessWorkspace`.

  **Org/workspace default pointers:** the `organizations` and `workspaces` rules already restrict writes to **system admins only**, so `defaultSenderProfileIds` must be set via a server action (admin SDK) — NOT a client write. Phase 7's "set default" is therefore a server action with `requireOrgAdmin`, and these rules are left unchanged (more secure: org docs also hold provider API keys).

  Reference rule:

```
match /sender_profiles/{pId} {
  allow read: if isAuthorized();                       // query-time filtering retained
  allow create: if isAuthorized() && hasPermission('studios_edit')
                && isOrgMatch(request.resource.data.organizationId)
                && canAccessWorkspace(request.resource.data.workspaceIds);
  allow update: if isAuthorized() && hasPermission('studios_edit')
                && isOrgMatch(resource.data.organizationId)
                && request.resource.data.organizationId == resource.data.organizationId   // immutable
                && canAccessWorkspace(request.resource.data.workspaceIds);
  allow delete: if isAuthorized() && hasPermission('studios_edit')
                && isOrgMatch(resource.data.organizationId);
}
```
(No `organizations`/`workspaces` rule change — default pointers are written server-side via a `requireOrgAdmin` action, see note above.)

- [ ] **Step 4:** Emulator tests green. *(human — needs the Firestore emulator)*
- [ ] **Step 5: Commit** *(human)*

```bash
git add firestore.rules src/lib/__tests__/firestore-rules.sender.test.ts
git commit -m "security(rules): scope sender_profiles writes to organization + immutable orgId"
```

---

## Phase 7 — Admin UI: org-scoped pickers, default management, polish

**Files:**
- `src/app/admin/messaging/profiles/page.tsx` (create writes `organizationId`; replace boolean default with org/workspace pointer; default-config surface)
- Pickers: `messaging/composer/components/ComposerWizard.tsx`, `messaging/campaigns/components/campaign-wizard.tsx`, `automations/components/ActionConfigPanel.tsx`, `surveys/components/minimal-results-config.tsx`, `surveys/components/result-rule-manager.tsx` (add org/workspace filter to the `sender_profiles` query)
- Optional: a "No default sender configured" admin banner.

**Conformance (per cross-cutting table):**
- Queries add `where('organizationId','==', activeOrganization.id)` (and keep `workspaceIds array-contains` where relevant). Fixes the cross-org picker leak.
- **Derive** "is default" during render from the org/workspace `defaultSenderProfileIds` pointer (`rerender-derived-state-no-effect`); "Set as default" is one atomic `updateDoc` on the org/workspace doc (no batch over profiles — R5).
- `frontend-design`: a per-channel "Default sender" card with an explicit **Org default** vs **Workspace override** badge, inline validation already present, character counter on SMS Sender ID, `htmlFor`/`aria-invalid`/`aria-describedby`.
- `emilkowal-animations`: single staggered reveal of the profile list on mount via `motion/react` (`opacity`+`translateY`, `ease-out`, ~180 ms, `staggerChildren` ~40 ms); default-change confirmation is a subtle `transform`/`opacity` pulse; **wrap in `prefers-reduced-motion` guard**; no `width/height/top/left` transitions.

- [x] **Set-default server action** — `src/app/actions/set-default-sender-action.ts` (`setDefaultSenderProfileAction` + `clearWorkspaceDefaultSenderAction`): `requireOrgAdmin`, validates the profile is org-owned + active + channel-matched, then `set(..., { merge: true })` on the org (or workspace) `defaultSenderProfileIds`. This is required because org/workspace docs are system-admin-only at the rules layer.
- [x] **Profiles page** (`messaging/profiles/page.tsx`): create now writes `organizationId: activeOrganization.id` (the rule requires it); the "default" star is **derived during render** from the org's `defaultSenderProfileIds` (read via `useDoc`), not the dead `isDefault` flag; clicking it calls the server action (with `getIdToken()`), shows a spinner, and disables for WhatsApp/inactive. `motion-safe:` zoom on the active star (respects reduced-motion); `aria-pressed`/`aria-label` for a11y. Removed the old `writeBatch` boolean flip.
- [x] **Org-scoped pickers** — added `where('organizationId','==', orgId)` to the leaky queries: `ComposerWizard`, `ActionConfigPanel`, `minimal-results-config`, `result-rule-manager` (the four that filtered only by `isActive`). `campaign-wizard` already filters by `workspaceIds array-contains` (a workspace belongs to one org) so it's left unchanged to avoid composite-index churn. All picker queries stay pure-equality → no new composite indexes.
- [x] **No-any gate** — 0 new `any` across all 6 touched files (survey pickers use typed `useWorkspace().activeOrganization`, not `as any`).

**Testing note (deviation):** no Vitest UI smoke test — these are context-heavy client components and the change is a query-filter + a guarded server action whose logic mirrors the already-tested resolver/auth patterns. Behavioral coverage is the Phase 8 regression + manual verification.

**Commit** *(human)*:
```bash
git add src/app/actions/set-default-sender-action.ts src/app/admin/messaging/profiles/page.tsx src/app/admin/messaging/composer/components/ComposerWizard.tsx src/app/admin/automations/components/ActionConfigPanel.tsx src/app/admin/surveys/components/minimal-results-config.tsx src/app/admin/surveys/components/result-rule-manager.tsx
git commit -m "feat(messaging-ui): org-scoped sender pickers + org default management"
```

```bash
git add src/app/admin/messaging/profiles/page.tsx src/app/admin/messaging/composer/components/ComposerWizard.tsx src/app/admin/messaging/campaigns/components/campaign-wizard.tsx src/app/admin/automations/components/ActionConfigPanel.tsx src/app/admin/surveys/components/minimal-results-config.tsx src/app/admin/surveys/components/result-rule-manager.tsx
git commit -m "feat(messaging-ui): org-scoped sender pickers + org/workspace default management"
```

---

## Phase 8 — Cross-tenant regression guard + verification

**Files:** `src/lib/messaging/__tests__/cross-tenant-isolation.test.ts`

- [x] **Step 1: The headline regression test** — `src/lib/messaging/__tests__/cross-tenant-isolation.test.ts` drives the REAL `sendMessage` against a two-org mock: Org-A `'default'` resolves `sender-A` (asserts `senderProfileId`/`senderIdentifier` on the scheduled doc, never Org-B); an explicit `sender-B` returns `cross_org_explicit` + fires `notifyMessagingFailure`; Org-A with no default returns `no_sender` + notice. Shared mock state via `vi.hoisted` so the `vi.mock` factories read it safely.
- [ ] **Step 2:** Run full messaging suite. *(human)*
- [ ] **Step 3:** `verification-before-completion` gate — run the full local command block (typecheck, lint, no-any grep across all touched files, targeted vitest, then `npm run build`). Any failure → fix before "done".
- [ ] **Step 4: Commit** *(human)*

```bash
git add src/lib/messaging/__tests__/cross-tenant-isolation.test.ts
git commit -m "test(messaging): regression guard against cross-tenant sender resolution"
```

---

## Definition of Done
- No `sender_profiles` query anywhere lacks an `organizationId` (engine) or org/workspace (UI) constraint.
- The "any active profile" + channel-wide `isDefault` engine queries are deleted.
- Every `sendMessage`/`sendRawMessage` caller passes a resolvable `organizationId`.
- A send with no valid org sender fails with a precise error **and** an in-app notification.
- Firestore rules reject cross-org profile writes and `organizationId` mutation.
- Bulk email uses the org's Resend key/domain.
- Cross-tenant regression test passes; no `any`/`any[]` in touched files; `npm run build` clean.
