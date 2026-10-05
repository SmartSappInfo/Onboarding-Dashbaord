# Phase 11 · Milestone 0: Interim Code Review (T0 + T1)

**Reviewer role:** Senior Principal Systems & AI Agent Architect
**Date:** 2026-10-05
**Scope:** commits `95ccb4a7` (T0.1–T0.5), `54039bdd` (T0.6–T0.8), and the **uncommitted T1 working tree** (governed gateway defaults), against [`agents_mcp_phase_11_milestone_0_plan.md`](agents_mcp_phase_11_milestone_0_plan.md) v1.1 and `agents_mcp_rules.md`.
**Verdict:** **On track, with conditions.**
- T0 is sound and can stand.
- **T1 must not be committed until R1 and R2 are fixed.** Both are small, but R1 is a tenant-isolation defect that T1 itself would activate.
- T0 also creates operational obligations (R4) that need a new step before any production deploy.

---

## 1. Evidence

| Check | Result |
| --- | --- |
| Full typecheck (`pnpm typecheck`) | 1 error, in the T1 test fixture (handler result shape). **Fixed in the working tree**; re-run pending |
| Platform test suite (`vitest run src/platform`) | **226 files, 1,684 tests passed** (includes the T1 working tree) |
| Lib suite (`src/lib/__tests__`) | Ran clean (exit 0) |
| Lint on touched files | Clean |
| Push / deploy | None (local commits only, per the Git protocol) |

---

## 2. Plan Conformance

| Plan step | Status | Notes |
| --- | --- | --- |
| T0.1–T0.4 storage-mode switch, 8 stores, startup assertion | ✅ | Pure resolver with an injected env; only the selected factory runs; a gate test pins all 8 stores |
| T0.5 flag-defaults parity | ✅ | Every capability × principal × surface; global switch defaults; confirmed nothing in the app writes the kill-switch fields |
| T0.6 index audit | ✅ with deviation | Static coverage test instead of the planned emulator query tests. Acceptable for now; emulator queries belong in T8 |
| T0.7 write-volume/cost note | ❌ outstanding | Due in the completion report |
| T0.8 sharded audit + pending/seal | ✅ with deviation | The contention test proves distribution and per-shard integrity, but `FakeFirestore` serializes transactions, so real contention isn't simulated. Add an emulator contention test in T8.3 |
| T1.1 tests (a)–(e) | ◐ | (a) replay ✅, (b) revoked ✅; (c) agent L3 without approval relies on the existing pipeline suite; (d) audit + outbox written by default ❌; (e) no per-request principal memo exists yet (N/A until one is added) |
| T1.2 `getGovernedGatewayDeps` | ✅ | Plus `resolveGatewayDeps`, `createActorStandingCheck`, test override |
| T1.3 casts removed / replay validated | ✅ | Type guard replaces the `ExtendedIdempotencyStore` cast; replays re-validated |
| T1.4 MCP + agent-step adopt defaults | ◐ | MCP adopts by omission. Agent-step forwards `undefined` values (see R2) |
| T1.5 overhead benchmark | ◐ | Existing benchmark passes but injects deps; production-default overhead (live standing lookup) is unmeasured |

---

## 3. Findings

Severity: **Critical** = security/data integrity, fix before commit · **High** = fix within M0 · **Medium** = decide or track · **Low** = polish.

### R1 · Critical · Idempotency keys are not tenant-namespaced (activated by T1)

- **Where:** `execute-capability.ts` step 10 passes `invocation.idempotencyKey` straight to the store as the document id. `buildExecutionKey(org, workspace, capability, key)` exists in `execution-store.ts` but **has no callers**.
- **Why it matters:** T1 turns the idempotency store on by default for every surface. MCP keys are safe because they hash the tenant, user and capability. UI, agent and workflow keys are passed raw, and the plans use deterministic keys (`sdr_draft_${prospectId}_${version}`, `lead_sync_${id}`, `mtg_task_{meetingId}_{itemHash}`). Two tenants producing the same key would make the second tenant **receive the first tenant's cached result, and its own operation would not run**. That is cross-tenant data disclosure plus a silent no-op (Rules 8, 19, 50).
- **Fix:** in step 10 (and the complete/fail calls), store under `buildExecutionKey(principal.organizationId, principal.workspaceId, capability.id, key)`. Add a test: same raw key, two workspaces → two executions, no replay across them.

### R2 · High · "Provided-but-undefined disables the default" is a footgun

- **Where:** `resolveGatewayDeps` treats a present key with an `undefined` value as an explicit opt-out. `agent-step-executor.ts:210-211` forwards `approvals: deps.approvals, verifyActorStanding: deps.verifyActorStanding`. Any caller omitting those gets the governance **silently disabled**, not defaulted.
- **Today:** production is safe only by coincidence (the route passes `approvals`, and the executor does its own live re-check before calling the gateway).
- **Fix:** `undefined` means "use the default". Test isolation already comes from `setGovernedGatewayDepsForTests({})` in the Vitest setup, so no per-call opt-out is needed. If one is ever required, use an explicit, greppable flag (e.g. `governance: 'disabled-for-test'`) that throws in production.

### R3 · High · Audit verification misses tail truncation

- **Where:** `FirestoreAuditStore.verifyWorkspaceChain` uses the shard heads only to enumerate shard ids.
- **Why it matters:** deleting the newest records of a shard leaves a shorter chain that still verifies. Tamper evidence (Rule 40) must catch truncation.
- **Fix:** after streaming a shard, require `lastRecord.hash === head.headHash` and `count === head.sequenceNumber`. Add a test that deletes the last record and expects `valid: false`. (Pre-existing gap, but T0.8 owns this code now.)

### R4 · High · T0 makes several collections persistent with no retention or consumer

- `domain_events`: now persisted in production, but **nothing enqueues `/api/tasks/event-dispatcher`** (no caller in code, no scheduler config in the repo). Events accumulate with status `pending` indefinitely.
- `capability_executions` (idempotency): has `expiresAt`, but as an **ISO string**. Firestore TTL policies only act on **Timestamp** fields, so the documented 24 h TTL can never fire.
- `event_execution_ledger`, `dead_letter_events`, `capability_audit_pending`: no expiry.
- **Why it matters:** unbounded collection growth and cost from the first production deploy of T0 (Rule 9). Previously masked because these stores lived in RAM.
- **Fix (new step T0.9):** write TTL fields as Firestore `Timestamp`s (`expireAt`); define TTL policies for idempotency (24 h), delivered/abandoned outbox events (e.g. 30 d) and ledger entries; **audit is never TTL'd**. Decide whether the event dispatcher should be scheduled. Until then, add a bounded janitor to the existing heartbeat cron. TTL policies are infrastructure changes and need approval (plan §14).

### R5 · Medium · Flags fail open on Firestore errors (decision needed)

- **Where:** `FirestoreFlagService.getGlobalAutonomousControl` / `getFlagRecord` return the cached or default (enabled) value on error.
- **Tension:** plan §4.1 says platform stores fail closed. For flags, failing closed would disable every capability on a Firestore blip; failing open means an emergency kill switch can be ignored during an outage.
- **Recommendation (D8):** keep the last-known value for up to 5 minutes. Beyond that, fail **closed for the global kill switch and per-capability kill switches** (a safety control) and **open for ordinary enablement flags** (availability). Document it in `flag-service.ts`.

### R6 · Medium · Local development now writes platform records into the production project (decision needed)

- **Cause:** FU-3 (staging and dev share the production Firebase project). After T0, `next dev` writes audit, idempotency and outbox records there.
- **Context:** dev already mutates production data through `adminDb`, so auditing those writes is arguably correct. But dev-originated `domain_events` will sit in the production outbox (see R4).
- **Recommendation (D9):** keep Firestore in dev (it audits real data changes), document `PLATFORM_STORAGE=memory` for offline work, and prioritise the separate staging project (D5 follow-up).

### R7 · Medium · Plan traceability gaps (tests)

Add these to close the plan's acceptance criteria:
- T1.1(d): default deps write audit + outbox.
- T1.1(c) in the new suite.
- T1.5: overhead with the production standing check (emulator).
- Emulator contention (T0.8) and emulator query/index tests (T0.6), both in T8.

### R8 · Low · Replay validation failure reports `stateChanged: 'no'`

If a stored result fails the current output schema (the schema evolved), the error is mapped with `stateChanged: 'no'`, although the original execution did change state. Map that case to `'yes'` with a clear "result unavailable, operation already applied" message (Rule 19).

### R9 · Low · Standing check cost on MCP session calls

Each automated call by a session-backed MCP principal does a user read plus a workspace-access check. Measure against the ≤ 50 ms budget; add a per-request memo if needed (never cross-request, Rule 50).

### R10 · Low · Service-principal recognition uses only the `service:` prefix

Harden it by also requiring `agentId === userId` and the name to be in `SERVICE_NAMES`. Server-side resolvers make spoofing unlikely; this is defense in depth.

### R11 · Low · Pre-sharding audit records are skipped silently

Legacy head documents (no `shard` field) are ignored by verification. Report `legacyEntriesUnverified` instead of skipping silently. (Production audit was in RAM, so legacy Firestore entries can only come from local runs.)

### R12 · Low · Global test setup imports platform modules

`src/test/setup.ts` now imports `governed-deps` (and the store modules) for every test file, including UI tests. Correct, but adds start-up cost; consider a lazy registration if suite time grows.

---

## 4. What Is Good

- **The storage switch is minimal, pure and gated.** One function, an injected env, a startup assertion, and a gate test covering all eight stores. The `FIREBASE_PROJECT_ID` trap can't come back unnoticed.
- **Behaviour parity was proven, not assumed.** The flag-defaults test compares Firestore and in-memory decisions across the whole registry before persistence goes live.
- **The audit design is the right shape.** Sharding removes the hot-document bottleneck; pending-then-seal makes audit loss impossible short of a total outage; sealing is idempotent; reads are schema-checked; verification streams in constant memory; legacy hashes still verify.
- **The governed-defaults structure** (one resolver, lazy Firestore loading, explicit standing rules per principal kind) matches the plan and keeps existing suites unchanged.
- **Discipline:** small commits with rationale, rules-aware comments, no push, no infrastructure touched.

---

## 5. Required Before Continuing

| # | Action | Blocks |
| --- | --- | --- |
| 1 | Fix R1 (namespace idempotency keys) + test | T1 commit |
| 2 | Fix R2 (undefined → default) + test | T1 commit |
| 3 | Re-run the full typecheck (fixture fix) | T1 commit |
| 4 | Fix R3 (tail-truncation check) + test | T0.8 sign-off |
| 5 | Add **T0.9** (TTL Timestamp fields, retention policy, outbox decision) to the plan and implement the code parts | Any production deploy of T0 |
| 6 | Decide D8 (flag failure policy) and D9 (dev storage) | T0 sign-off |
| 7 | Add the R7 tests (T1.1(c)/(d), emulator items scheduled in T8) | M0 completion |

R8–R12 can ride along with T1/T8.

---

## 6. Overall Assessment Against the Milestone Goal

M0's goal is a platform underneath Phase 11 that is real, governed and recoverable.
- **T0** delivers the most important piece: persistence that was silently missing in production, together with a load-safe audit design.
- **T1** delivers default-on governance but, as written, would open a tenant-isolation hole (R1). That is exactly the class of defect M0 exists to remove, so it must be fixed before the commit.
- **T0 surfaced operational work** (R4) that was invisible while the stores lived in RAM; the plan should absorb it as T0.9 rather than defer it.

With items 1–6 done, M0 remains on schedule for T2 (unified approvals), the next highest-value task.
