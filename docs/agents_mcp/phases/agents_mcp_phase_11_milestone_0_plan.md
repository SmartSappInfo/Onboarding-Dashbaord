# Phase 11 · Milestone 0 Implementation Plan
## Foundation Remediation: persistent stores, one governed gateway, one approval model, real execution, persistent memory

**Version:** 1.0.0
**Status:** PLANNING. Uses master-plan defaults D2 (Firestore vector search) and D3 (M0 inside Phase 11); D5–D7 (§12) need answers before the infrastructure steps.
**Date:** 2026-10-05
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §2.2 (B5–B9), §9 (P11-M0-T1…T6), §12 deployment policy.
**Rules:** `agents_mcp_rules.md` Important Rules 1–10 (amended 4, 5) and 11–69; `.agents/AGENTS.md`.

**Documents reviewed for this milestone:**

| Document | Used for |
| --- | --- |
| Phase 11 master plan | Scope, definition of done, contracts §5.1–5.6 |
| `agents_mcp_rules.md` (full) | Rules 4, 5, 9, 16–27, 29–31, 40, 43, 47–48, 52, 57, 60, 64, 67–69 drive the task designs |
| `docs/agentic/05-permission-model.md` | Effective principal formula, risk levels, non-delegable actions, approval binding contract |
| `docs/agentic/10-workflow-architecture.md` | Cloud Tasks + Firestore checkpoints; true cancellation; sagas |
| `docs/agentic/11-security-model.md` | Trust boundary classes; Rules 47/48 axioms |
| `docs/agentic/04-data-contracts.md` | Boundary validation pipeline; L3 idempotency key requirement |
| `docs/agentic/08-memory-model.md` | Memory object fields; mandatory tenant filter on vector search |
| `agents_mcp_phase_1_build_plan.md` §4.2–4.4, §12 | The 16-step gateway design, principals, durable records (`capability_executions`, `capability_audit` hash chain, `domain_events`, `capability_approvals`), PR-2 notes, follow-ups **FU-3** (staging = production Firebase project) and **FU-7** (`server-only` boundary) |
| `agents_mcp_pr2_pr3_implementation_plan.md`, `agents_mcp_pr4_implementation_plan.md` | Live-principal re-check, approval verify-then-bind, gateway pipeline contract |
| `agents_mcp_prd.md` §16, §66–76 | `memory_objects` model; permissions, sensitivity, audit, retention, deletion |
| `agents_mcp_tools.md` §6.3 | Execution envelope fields |
| `scripts/NOTE_INDEX_VECTOR_README.md`, `docs/superpowers/specs/2026-06-13-quick-notes-design.md` | How Firestore vector indexes are created in this project (out of band, `gcloud`, 768 dims) |

---

## 1. Goal

When M0 is done, the platform underneath Phase 11 is real:

1. Platform stores persist in production (they don't fall back to RAM).
2. Every agent, workflow, MCP and sales execution passes through **one** governed gateway with production dependencies wired by default.
3. There is **one** approval model that the inbox, the gateway, workflows and CRM/sales all share, decided by permitted humans only.
4. Approved proposals **actually perform** their change, and rollbacks actually compensate.
5. Workflow approval waits appear in the inbox and resume durably across instances.
6. Memory persists, is tenant-scoped and can be searched by meaning.
7. No hardcoded secrets or recipients and no business state in module memory.

**Non-goals (tracked elsewhere):** the generic agent run worker (`AgentExecutionLoop`; Phase 11 uses workflows), the command-bar EXECUTE/AUTOMATE façades, general event-bus durability beyond the approval resume path, and persona matrices that reference unregistered capabilities (follow-up list §13.3).

---

## 2. Verified Findings (code as of `6a0ee755`)

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| F1 | **Eight platform stores choose in-memory storage when `FIREBASE_PROJECT_ID` is unset, and production doesn't set it.** Cloud Run `--set-env-vars` has only `APP_SURFACE, PUBLIC_APP_ORIGIN, NEXT_PUBLIC_APP_URL, NEXT_TELEMETRY_DISABLED, FIREBASE_CONFIG`, and `apphosting.yaml` has none. Affected stores: idempotency, outbox, approvals, **feature flags/kill switches**, audit, DLQ, event ledger, outbox reader. | `execution-store.ts:213`, `outbox-store.ts:182`, `approval-store.ts:326`, `flag-service.ts:275`, `audit-store.ts:334`, `dead-letter-storage.ts:215`, `event-execution-ledger.ts:230`, `outbox-reader.ts:305`; `deploy-cloudrun.yml:139` | Critical |
| F2 | The gateway has no production defaults for idempotency, approval verification or the live-user check: `deps?.idempotencyStore`, `deps?.approvals`, `deps?.verifyActorStanding`. Step 10 **skips** idempotency when no store is passed. Step 8 skips the standing check. The MCP stateless handler passes none of them; the agent-step route passes no idempotency store. | `execute-capability.ts`; `10-check-idempotency.ts`; `08-authorize-principal.ts`; `create-stateless-handler.ts:147`; `agent-step-executor.ts:208` | High |
| F3 | Seven production paths call `capability.handler()` directly (bypassing all 15 pipeline steps): the workflow step runner, workflow saga engine, runtime saga compensation, agent execution loop, Genkit tool adapter, sales agent actions (×5), and the lib MCP tools (crm/deal/task) plus the registry path. | `workflow-step-runner.ts:394`, `workflow-saga-engine.ts:237`, `saga-compensation.ts:224`, `agent-execution-loop.ts:345`, `genkit-tool-adapter.ts:255`, `sales-agent-actions.ts:112…318`, `lib/mcp/tools/*`, `lib/mcp/registry.ts:381` | High |
| F4 | **Two incompatible approval models share `capability_approvals`.** The gateway uses `CapabilityApprovalRecord` (`computeApprovalPayloadHash` over capability + version + tenant + input). The inbox, CRM bridge, SDR and swarm use `ActionProposal` (`sha256Hex(payload)` only, different fields). Each one's parser rejects the other's documents, so an inbox approval can never satisfy the gateway verifier. | `policy/approval-verifier.ts:29-60`; `policy/approval-proposal-types.ts:51-77`; `runtime/execution/approval-interceptor.ts` | High |
| F5 | Approve requires only same-org membership. There's no approver permission and no workspace check; self-approval is blocked only at L4. **No approval permission exists in RBAC.** | `approval-governance-actions.ts:337-460`; `src/lib/permissions*.ts` | High |
| F6 | CRM proposal execute marks the proposal `bound` and emits an event, but performs no mutation. Rollback flips the status only. | `crm-proposal-bridge.ts:180-387` | High |
| F7 | The CRM agent targets **unregistered capability IDs**: `crm.deal.update_stage`, `crm.task.create`, `crm.workspace_entity.assign_owner`; compensations `crm.deal.revert_stage`, `crm.task.delete`, `crm.workspace_entity.revert_*`. The registered equivalents are `deal.advance_stage`, `task.create`, `deal.assign_owner`, `crm.workspace_entity.update`, `task.update`. | `src/platform/agents/crm/actions/*`; `src/platform/domains/*` | High |
| F8 | Workflow approval suspension sets `waitCondition: approval` but creates no inbox item. The resume bridge is never instantiated and relies on the in-process event bus. Resumption-token replay protection is a per-instance `Set`. | `workflow-step-runner.ts:241-290`; `approval-workflow-bridge.ts`; `workflow-resumption-service.ts:92` | High |
| F9 | The platform memory service stores items in an in-process `Map` with an in-RAM vector store and no embedding provider. `getMemoryItem(id)`, `deleteMemoryItem(id)` and `supersedeMemoryItem` take **no tenant**. | `canonical-memory-service.ts:96, 228, 260, 319` | High |
| F10 | `memory_objects` is **client-writable** by any workspace member (create/update/delete), a memory-poisoning path. No client code writes it today. | `firestore.rules:3222-3240` | High |
| F11 | `firestore.indexes.json` declares **no vector index**; the `note_index` index was created out of band. `memory_objects` has no vector index. | `firestore.indexes.json`; `scripts/NOTE_INDEX_VECTOR_README.md` | Medium |
| F12 | Hardcoded fallbacks and module state: `'smartsapp-resumption-secret-fallback'`; SDR fallback recipient `+233249876543` (×2); SDR drafts/proposals in module `Map`s (×2); revenue swarm history and `AbortController`s in module `Map`s; unbounded signature-session and timeline caches. | `workflow-resumption-types.ts:137`; `sdr-outbound-actions.ts:51-52, 285`; `sdr-capabilities.ts:59, 323`; `revenue-swarm-actions.ts:40-48`; `crm-multi-turn-session.ts:72`; `account-timeline-service.ts:40` | High (recipient) / Medium |
| F13 | The two memory schemas are compatible: canonical `CanonicalMemoryObject` is a superset of the PRD `MemoryObject` (adds `tier`, `sensitivity`, `temporal`). Existing `memory_objects` docs can be read with a normalizer; **no data migration is needed**. | `platform/memory/contracts/memory-types.ts:154-179`; `lib/memory/types.ts:128-147` | Opportunity |

---

## 3. Design Decisions for M0

1. **One storage-mode switch (F1).**
   - `resolvePlatformStorageMode()` returns `'firestore'` everywhere except `NODE_ENV === 'test'`, or an explicit `PLATFORM_STORAGE=memory` outside production.
   - Production plus memory mode **throws at startup** (`src/instrumentation.ts`).
   - The project id comes from `firebase-admin`'s resolved app, never `FIREBASE_PROJECT_ID`.
2. **Gateway dependencies by default (F2).** `getGovernedGatewayDeps()` supplies the Firestore idempotency store, the unified approval store/verifier, the live-standing check (reusing `src/platform/tasks/live-principal-check.ts`), the audit sink and the outbox sink. `executeCapability` uses it when the caller doesn't inject dependencies. Tests inject fakes.
3. **Callers never call handlers (F3).** A shared `invokeGoverned(invocation)` helper is the only call site. A CI grep gate fails on `.handler(` outside `13-execute-handler.ts` (allowlist: the MCP `strangler-bridge` legacy-tool path, the event bus `sub.handler`).
4. **One approval model (F4, F5).**
   - `ApprovalRecord` = the `ActionProposal` fields + `requestedBy` + `workflowRef?` + `targetVersion?` + `beforeState?` + `hashVersion: 2`.
   - **One hash:** `computeApprovalPayloadHash` (capability, version, org, workspace, input).
   - **One store:** `FirestoreApprovalStore` implements the proposal operations and the `ApprovalVerifier`.
   - Legacy docs are read through an adapter. Legacy-hash proposals still pending are shown as "Needs re-proposal" and can't be executed.
5. **Approver policy (F5).**
   - New permission `agent_approvals.decide`, registered through the PR-2 `permission-refs` mechanism and granted by default to roles that hold workspace admin, so current admins keep the ability.
   - Plus server-side workspace membership.
   - The proposer can never decide (all levels); L4 needs two distinct approvers.
6. **Execution through the gateway as the agent (F6, F7).**
   - The executor runs `executeCapability` with `surface: 'agent'`, principal = live (authorizing user ∩ persona) and `approvalId`. Step 09 verifies and binds; step 11 checks `expectedVersion`.
   - Afterwards the target is re-read (postcondition).
   - Compensation runs the registered inverse capability with the `beforeState` captured at proposal time.
7. **Durable workflow approval resume (F8).**
   - Suspension creates an `ApprovalRecord` with `workflowRef`.
   - Approve/reject enqueues a Cloud Task to the existing authenticated worker route family (HMAC + OIDC).
   - The step re-runs with `approvalId`.
   - Consumed resumption tokens are recorded in Firestore (`workflow_resumption_tokens/{sha256(token)}`, created in a transaction).
8. **Memory SSOT (F9–F11, F13).** `CanonicalMemoryService` gets the following:
   - `FirestoreMemoryStore` over `memory_objects` (canonical writes, legacy-normalizing reads).
   - `FirestoreVectorStore` (`findNearest`, `where organizationId == ∧ workspaceId ==`, k ≤ 50, cosine).
   - Embedding provider `gemini-embedding-001` at 768 dims.
   - All reads, writes and deletes are tenant-scoped.
   - Constructing the RAM store in production throws.
9. **No hardcoded fallbacks (F12).**
   - The resumption secret is required (`WORKFLOW_RESUMPTION_SECRET`, in Secret Manager); production fails closed at startup.
   - The SDR recipient fallback is removed ("Draft not found" error).
   - SDR drafts persist to `sdr_drafts` (the Phase 10 plan's collection).
   - Swarm runs persist to `revenue_swarm_runs`, with cancellation via a Firestore `cancelRequested` flag checked cooperatively between stages.
   - Caches become bounded LRU (max entries + TTL, tenant-keyed).

---

## 4. Tasks (TDD, small commits)

**Conventions for every step:**
- Write the failing test, run it red, implement, run it green.
- Run `pnpm typecheck` + `pnpm lint` + affected Vitest, then commit locally. **No push unless asked.**
- Each file gets an `@fileOverview` (what, why, rules, caution, tests). Tenant, approval, storage and secret code gets `// CAUTION:` markers.
- Zod at every boundary. No `any`, `any[]` or unchecked `as` casts (Rule 4).

### T0: Persistent platform storage, fail-closed (F1) · Rules 5, 9, 60, 64

| Step | Action | Files |
| --- | --- | --- |
| 0.1 | Test: in production mode, every default store is Firestore-backed; memory mode throws. Test: in test mode, memory stores remain. | `src/platform/__tests__/storage/storage-mode.test.ts` |
| 0.2 | Implement `resolvePlatformStorageMode()` + `assertPersistentStorageInProduction()` | `src/platform/storage/storage-mode.ts` (new) |
| 0.3 | Replace the 8 `!process.env.FIREBASE_PROJECT_ID` checks with the helper (one commit per store family: capabilities, flags, events) | the 8 files in F1 |
| 0.4 | Startup assertion in `src/instrumentation.ts` (next to the existing `CLOUD_TASKS_SECRET` check) | `src/instrumentation.ts` |
| 0.5 | **Flag defaults audit:** test that a missing `platform_features` doc resolves to today's behaviour for every flag (so turning persistence on changes nothing until an operator sets a flag) | `flag-service.ts` tests |
| 0.6 | Index audit: list the queries each store issues (audit prevHash per workspace, outbox reader by status/createdAt, DLQ, ledger). Add missing composite indexes to `firestore.indexes.json` with an emulator test per query. | `firestore.indexes.json`, store tests |
| 0.7 | Write-volume estimate (audit + outbox per execution) and Firestore cost note in the completion report | report |

**Acceptance:** the production-mode tests pass; no `FIREBASE_PROJECT_ID` storage checks remain (grep gate); flag defaults are unchanged; indexes are declared.
**Functionality risk:** turning on audit/outbox writes adds latency. Budget ≤ 50 ms p95 overhead (Phase 1 §4.2), measured in an emulator microbenchmark. Writes are batched (≤ 250).

### T1: Governed gateway defaults (F2) · Rules 16, 19, 20, 22, 47, 51

| Step | Action | Files |
| --- | --- | --- |
| 1.1 | Tests: with no deps injected, (a) a repeated idempotency key replays, (b) a revoked user is refused (`ACTOR_REVOKED`), (c) agent L3 without a verified approval is refused, (d) audit and outbox are written | `src/platform/__tests__/gateway/governed-defaults.test.ts` |
| 1.2 | `getGovernedGatewayDeps()` (memoized per process; per-request principal memo) | `src/platform/capabilities/execution/governed-deps.ts` (new) |
| 1.3 | `executeCapability` uses the defaults when `deps` is omitted; remove the `as ExtendedIdempotencyStore` cast (type guard); validate the replayed result with the output schema instead of `as TOutput` | `execute-capability.ts` |
| 1.4 | MCP stateless handler and agent-step route adopt the defaults (keep explicit test injection) | `create-stateless-handler.ts`, `api/tasks/agent-step/route.ts` |
| 1.5 | Microbenchmark: gateway overhead for a read ≤ 50 ms p95 (emulator) | bench test |

**Acceptance:** tests (a)–(d) pass; existing MCP and agent-step suites pass unchanged.

### T2: Unified approval model & approver policy (F4, F5) · Rules 13, 17, 21, 22, 40

| Step | Action | Files |
| --- | --- | --- |
| 2.1 | Tests: (a) an inbox approval is accepted by the gateway verifier; (b) a payload changed after approval → `APPROVAL_MISMATCH`; (c) the proposer can't approve (L1–L4); (d) a user without `agent_approvals.decide` is refused; (e) a non-member of the workspace is refused; (f) L4 needs two distinct approvers; (g) legacy `ActionProposal` docs are readable; a legacy hash → "Needs re-proposal", not executable | `src/platform/__tests__/approvals/unified-approvals.test.ts` |
| 2.2 | `ApprovalRecordSchema` (superset) + legacy read adapter; `hashVersion: 2` | `src/platform/policy/approval-record.ts` (new); deprecate the duplicates via re-exports |
| 2.3 | Single `FirestoreApprovalStore` (proposal ops + `verify`/`verifyAndBind` in one transaction); remove `createMemoryApprovalStore`/`createFirestoreApprovalStore` duplicates in `approval-interceptor.ts` (re-export for compatibility) | `capabilities/storage/approval-store.ts`, `runtime/execution/approval-interceptor.ts` |
| 2.4 | Register `agent_approvals.decide` in the permission model; default-grant to workspace-admin role templates; parity test with `role-templates-qa` | `permission-refs.ts`, role blueprints, tests |
| 2.5 | `approve/rejectActionProposalAction`: permission + membership (server-side `checkWorkspacePermission`), no self-approval, L4 dual control, `expectedVersion` on the decision, hash-chained audit entry | `approval-governance-actions.ts` |
| 2.6 | Migrate creators to the unified store and hash: CRM bridge, SDR actions/capabilities, revenue swarm | the 4 creator files |
| 2.7 | Inbox UI: show "Needs re-proposal" for legacy-hash items; approver-only buttons (hidden plus server-enforced) | `src/components/approvals/*` |

**Acceptance:** (a)–(g) pass; inbox, CRM and sales suites green.

### T3: Every execution through the gateway (F3) · Rules 12, 16, 31, 47, 48, 69

| Step | Action | Files |
| --- | --- | --- |
| 3.1 | **Grep gate test:** fails if `.handler(` appears outside the allowlist | `src/platform/__tests__/gates/no-direct-handler.test.ts` |
| 3.2 | `invokeGoverned()` helper (builds the invocation per surface, maps errors to `{ success, error, code, stateChanged }`) | `src/platform/capabilities/execution/invoke-governed.ts` (new) |
| 3.3 | Workflow step runner → gateway (`surface: 'task_worker'`, principal re-derived live each step, `idempotencyKey` = step key, `approvalId` when resumed). Delete its duplicate risk/approval/fingerprint logic only where the gateway already covers it; keep the circuit breaker and leases. | `workflow-step-runner.ts` |
| 3.4 | Workflow saga engine + runtime saga compensation → gateway | 2 files |
| 3.5 | Genkit tool adapter → gateway (`surface: 'agent'`) | `genkit-tool-adapter.ts` |
| 3.6 | Sales agent actions (×5) → gateway (`surface: 'ui'`, session principal) | `sales-agent-actions.ts` |
| 3.7 | Lib MCP tools (crm/deal/task) + registry capability path → gateway (`surface: 'mcp'`) | `lib/mcp/tools/*`, `lib/mcp/registry.ts` |
| 3.8 | Agent execution loop → gateway (unused in production; done for consistency, cheap) | `agent-execution-loop.ts` |

**Acceptance:** the grep gate is green; each converted path has a refusal test (wrong tenant, revoked user, missing approval); existing suites green. **Order:** after T1 and T2 (the runner's approval path needs the unified model).

### T4: Real proposal execution & compensation (F6, F7) · Rules 18, 21, 22, 27, 31, 47

| Step | Action | Files |
| --- | --- | --- |
| 4.1 | Tests: approve → **record actually changes** (emulator); stale `expectedVersion` → `VERSION_CONFLICT`, nothing written; rollback restores `beforeState` with a version check; a proposal targeting an unregistered capability is rejected at creation; the postcondition re-read mismatch → `stateChanged: 'unknown'` + operator alert | `src/platform/__tests__/crm/crm-proposal-execution.e2e.test.ts` |
| 4.2 | Action-type → registered-capability map (`deal.advance_stage`, `deal.assign_owner`, `crm.workspace_entity.update`, `task.create`, `task.update`); proposal creation validates against the registry; unsupported action types are surfaced as recommendations only (not approvable) | `crm-action-types.ts`, `crm-proposal-bridge.ts` |
| 4.3 | Capture `beforeState` + `targetVersion` at proposal time | `crm-proposal-bridge.ts` |
| 4.4 | Execute via `invokeGoverned` (agent principal = live authorizing user ∩ persona, `approvalId`); postcondition verify | `crm-proposal-bridge.ts` |
| 4.5 | Compensation via the inverse capability with `beforeState` (`task.update` status → cancelled for agent-created tasks untouched by humans; stage/owner/field → previous value) | `crm-proposal-bridge.ts` |
| 4.6 | UI copy: "Applied" only after a verified success; a conflict says "This record changed. Review again." | CRM proposal modal |

**Acceptance:** E2E green; no "executed" status without a verified mutation.

### T5: Durable workflow approvals (F8) · Rules 20, 25, 26

| Step | Action | Files |
| --- | --- | --- |
| 5.1 | Tests: a step needing approval creates an inbox item with `workflowRef`; approve → Cloud Task enqueued → the step re-runs with `approvalId` and completes; reject → the step fails and the saga runs; expiry → dead-lettered with a reason; the same resumption token used twice (two instances) → the second is refused | `src/platform/__tests__/workflows/approval-resume.e2e.test.ts` |
| 5.2 | Suspension creates an `ApprovalRecord` (unified store) | `workflow-step-runner.ts`, `workflow-resumption-service.ts` |
| 5.3 | The decision action enqueues the resume task (existing dispatcher, HMAC + OIDC worker auth) | `approval-governance-actions.ts`, `workflow-dispatcher.ts` |
| 5.4 | Firestore token-consumption record (transactional create) replaces the in-memory `Set` | `workflow-resumption-service.ts` |
| 5.5 | Remove the in-process `approval-workflow-bridge.ts` (unused; superseded) | delete + tests |

**Acceptance:** E2E green on the emulator with two simulated instances.

### T6: Memory SSOT (F9–F11, F13) · Rules 8, 9, 29, 30, 50, 57

| Step | Action | Files |
| --- | --- | --- |
| 6.1 | **Context7 check** (Rule 6): Genkit `ai.embed` with `gemini-embedding-001` `outputDimensionality`; Firestore `findNearest` with pre-filters and index requirements; record the versions in the report | — |
| 6.2 | Tests: memory persists across service re-instantiation; `get/delete/supersede` with the wrong tenant → not found; vector search without org/workspace → throws; legacy PRD-shaped doc normalizes; embedding dimension ≠ 768 → refused; RAM store in production → throws | `src/platform/__tests__/memory/memory-ssot.test.ts` |
| 6.3 | `FirestoreMemoryStore` (canonical write, legacy-normalizing read, `version` field for TOCTOU) | `src/platform/memory/adapters/firestore-memory-store.ts` (new) |
| 6.4 | `FirestoreVectorStore` implementing `VectorStore` (`findNearest`, prefilters, k ≤ 50, `deleteByFilter` via query + batched deletes ≤ 250) | `src/platform/memory/adapters/firestore-vector-store.ts` (new) |
| 6.5 | Wire the embedding provider (fallback: store without a vector and mark `embeddingStatus: 'pending'`; a background re-embed task; never a random/fake vector) | `embedding-service.ts`, `canonical-memory-service.ts` |
| 6.6 | Tenant-scoped service API (`get(tenant, id)`, `delete(tenant, id)`, `supersede(tenant, …)`); update the 15 callers (§10) | service + callers |
| 6.7 | `firestore.rules`: `memory_objects` writes → `false` (server-only); rules tests (member create/update/delete denied; read unchanged) | `firestore.rules`, rules tests |
| 6.8 | Vector index definition script + README (`gcloud firestore indexes composite create --collection-group=memory_objects --field-config=field-path=organizationId,order=ASCENDING --field-config=field-path=workspaceId,order=ASCENDING --field-config=field-path=embedding,vector-config='{"dimension":768,"flat":{}}'`): **run only with approval** | `scripts/MEMORY_VECTOR_INDEX_README.md` |
| 6.9 | Backfill script: embed `memory_objects` lacking `embedding` (dry run → run; resumable cursor; ≤ 100 docs per batch; rate-limited) | `scripts/backfill-memory-embeddings.ts` |

**Acceptance:** tests green; Brain UI reads unchanged; the index is created only after approval.

### T7: Remove hardcoded fallbacks and module state (F12) · Rules 8, 9, 33, 52

| Step | Action | Files |
| --- | --- | --- |
| 7.1 | Tests: missing `WORKFLOW_RESUMPTION_SECRET` in production → startup error; no literal fallback in the bundle (grep gate) | storage/secret tests |
| 7.2 | Require the secret (dev/test: explicit test secret via env in test setup only) | `workflow-resumption-types.ts`, `instrumentation.ts` |
| 7.3 | SDR: remove `+233249876543` (×2); drafts → `sdr_drafts` (server-only rules); a missing draft → "Draft not found" | `sdr-outbound-actions.ts`, `sdr-capabilities.ts`, rules |
| 7.4 | Revenue swarm: history → `revenue_swarm_runs`; cancel = Firestore `cancelRequested`, checked between stages | `revenue-swarm-actions.ts`, orchestrator |
| 7.5 | Bounded LRU caches (max 500 entries, TTL, keys include org + workspace) for the signature sessions and account timeline | `crm-multi-turn-session.ts`, `account-timeline-service.ts`, shared `src/lib/cache/bounded-lru.ts` |
| 7.6 | `import 'server-only'` in the new server modules and the stores touched in M0 (verify the Next.js `server-only` handling via Context7, FU-7); boundary test | modules + test |

**Acceptance:** grep gates green (no literal secret, no fallback phone); cross-instance tests for drafts and cancel.

### T8: Verification & completion · Rules 42–46, 67

| Step | Action |
| --- | --- |
| 8.1 | Emulator E2E suite: approve → resume → mutation → rollback; memory persists and is tenant-isolated; flags persist and a kill switch takes effect without deploy |
| 8.2 | Red-team subset: cross-tenant memory get/delete, self-approval, payload tamper, replayed resumption token, forged client write to `memory_objects`, revoked user mid-workflow |
| 8.3 | Chaos subset: Firestore contention on approval bind, duplicate Cloud Task delivery, model/embedding outage (pending embedding path) |
| 8.4 | Rule 67 gate answers + completion report with test names and CI run IDs (after the user asks to push) |

---

## 5. Ordering & Commit Plan

```text
T0 ─► T1 ─► T2 ─► T3 ─► T4 ─► T5
  └────► T6 (after T0)      └► T8
  └────► T7 (after T0)
```
Each task lands as 3–8 small commits. Every commit passes `pnpm typecheck` + `pnpm lint` + its tests locally. This machine is memory-constrained: if a full local typecheck can't complete, run the affected-file checks and record that CI is the full gate.

---

## 6. Rules Conformance (M0)

| Rule | M0 conformance |
| --- | --- |
| 1 | Skills: `backend-patterns`, `next-best-practices`, `test-driven-development`, `firebase-security-rules-auditor`, `cybersecurity-analyst`, `firebase-ai-logic`, `verification-before-completion`; tracker §13 |
| 2 | Risk register §8; TDD; local commits; no push until asked |
| 3 | Affected features §10; Backoffice §11 |
| 4 | Zod at boundaries; removes the existing unchecked casts in the gateway (T1.3); grep gate for `as unknown as` in touched files |
| 5 | Rules/index changes emulator-tested; deployment per §12 (D5 resolves FU-3); no production deploy without approval |
| 6 | Context7 checks (T6.1, T7.6); no new dependencies |
| 7 | UI changes are copy and button visibility only, plain English, theme.md §8, mobile targets |
| 8 | Closes F1–F12 security gaps; red-team T8.2 |
| 9 | Batched writes ≤ 250; k ≤ 50; LRU bounds; rate-limited backfill; gateway overhead budget |
| 10 | `@fileOverview` + `// CAUTION:` on storage, approval, tenant and secret code |
| 12 | Approval need decided server-side by risk + persona, not annotations |
| 13 | Proposal payloads and memory content stay untrusted; schemas at boundaries |
| 16 | Live principal re-derived per workflow step and per proposal execution |
| 17 | `agent_approvals.decide` is non-delegable (agents can't hold it) |
| 18 | `expectedVersion` on approval decisions, proposal execution, memory supersede |
| 19, 20 | Gateway idempotency on by default; workflow step keys; token consumption record |
| 21, 22 | One approval model; hash v2 binds capability + version + tenant + input; invalidated on change |
| 24, 25, 26 | Breakers kept in the runner; expiry → DLQ; swarm cancel cooperative and durable |
| 27 | Real compensations with `beforeState` |
| 29, 30 | Memory provenance/temporal fields persisted; client writes removed |
| 31, 47, 48 | All paths run validation → policy → permission → execute → verify |
| 40 | Hash-chained audit persisted (it was in RAM in production) |
| 50 | Cache keys tenant-scoped |
| 52 | `server-only` in touched server modules |
| 57 | Memory `dataClass`/`region`/`retentionPolicy` persisted |
| 60, 64 | Flags/kill switches actually persist (F1) |
| 67, 68, 69 | Gate in the report; non-negotiables 1/3/4 directly strengthened; one governed layer |

---

## 7. Implementation Gate (Rule 67) for M0

```text
ARCHITECTURE  No new capabilities; consolidates storage, gateway, approvals, memory. SoT: Firestore.
              Events: approval.created/decided/bound, proposal.executed/compensated, memory.created/deleted.
AUTHORITY     Approvals: agent_approvals.decide + workspace membership, never the proposer, L4 dual.
              Agents: unchanged personas; can never hold agent_approvals.decide.
DATA          Proposal payloads, memory content: untrusted, schema-validated. Secrets: Secret Manager only.
EXECUTION     Idempotent (gateway keys, step keys, token record); retries safe; cancellation durable;
              version-checked; lost response → stateChanged 'unknown' + reconcile by key.
MCP           No protocol change; MCP paths now get production gateway deps.
FAILURE       Firestore unavailable → fail closed (no silent RAM fallback); embedding outage → pending
              embedding; stale approval → re-propose; contention → transaction retry with jitter.
SECURITY      Closes RAM-fallback, direct-handler bypass, approval mismatch, self-approval, client memory
              writes, hardcoded secret/recipient.
OPERATIONS    Flags/kill switches persist; approver policy and re-proposal visible in Backoffice approvals.
TESTING       Unit, integration (emulator), E2E, rules, red-team subset, chaos subset, benchmark.
MIGRATION     No data migration (memory normalizer, approval adapter); legacy pending proposals need
              re-proposal; rollback = revert commits (no schema-destructive change).
```

---

## 8. What Could Go Wrong (Rule 2)

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Turning on persistent stores (T0) surfaces latent bugs: audit and outbox writes on every execution, missing indexes, cost | Index audit 0.6; benchmark 1.5; batched writes; canary deploy; cost note 0.7 |
| R2 | Flags start reading Firestore and a stale doc disables a feature | Flag defaults test 0.5; read the current `platform_features` docs before deploy (report what's set) |
| R3 | Routing the step runner through the gateway changes refusal codes the workflows UI expects | Error mapping in `invokeGoverned`; UI suite green; refusal snapshot tests |
| R4 | Legacy pending proposals become non-executable | Count them before deploy; inbox shows "Needs re-proposal"; release note |
| R5 | New approver permission locks out current approvers | Default-grant to workspace-admin roles; parity test; Backoffice can grant it without code |
| R6 | Real CRM execution surprises users who were used to no-op "executed" | Clear copy; preview shows the exact change; feature flag `FF_CRM_PROPOSAL_EXECUTION` (default ON for canary workspaces first) |
| R7 | The memory API signature change breaks callers | All 15 callers updated in one task with typecheck; compatibility wrapper for one release |
| R8 | Embedding provider quota/latency | Pending-embedding path; rate-limited backfill |
| R9 | Rules tightening on `memory_objects` breaks a hidden writer | Verified no client writers; rules tests; deploy only with approval |
| R10 | `WORKFLOW_RESUMPTION_SECRET` missing in a deploy breaks startup | Secret added to Secret Manager + both surfaces **before** the code deploy (approval step); startup error names the variable |
| R11 | Machine memory limits stop local typecheck | Scoped checks + CI as the full gate (memory: CI builds) |

**Edge cases:** approval decided twice at once (transaction + version) · approver loses permission between view and decide · proposal approved, then target archived (resource scope → not found, nothing written) · workflow cancelled while waiting for approval (decision ignored, audited) · resume task delivered twice (token record) · embedding returns the wrong dimension · memory doc from another tenant requested by id · swarm cancel during a stage (finish the stage, stop before the next) · cache eviction under load (correctness unaffected; Firestore is the source).

---

## 9. Test Plan Summary

| Layer | New suites |
| --- | --- |
| Unit | storage-mode, governed-defaults, approval-record adapter, LRU, token record |
| Integration (emulator) | approval store transactions, memory stores, vector search prefilters, flags persistence |
| E2E (emulator) | CRM proposal execute/rollback; workflow approval resume (two instances) |
| Rules | `memory_objects` server-only writes; new collections deny client access |
| Gates | no direct `.handler(`; no `FIREBASE_PROJECT_ID` storage checks; no literal secret/phone |
| Security | red-team subset T8.2 |
| Chaos | T8.3 |
| Benchmark | gateway overhead ≤ 50 ms p95 |

---

## 10. Affected Features (Rule 3)

| Feature | Effect | Verified by |
| --- | --- | --- |
| All gateway users (MCP v2, agent steps) | Now get idempotency, live re-check and persisted audit | Existing suites + T1 tests |
| Workflows (runner, sagas, resume, workflows UI) | Executions governed; approvals visible in inbox; durable resume | Workflow suites + T5 E2E |
| Approvals inbox (`/admin/intelligence/approvals`, Backoffice approvals) | One model; approver-only actions; legacy "Needs re-proposal" | T2 tests + UI tests |
| CRM proposals (Phase 9 modal) | Execution and rollback become real | T4 E2E |
| Sales (Prospect Finder, SDR, revenue swarm) | Drafts and swarm history persist; no fallback recipient; governed reads | Sales suites + T7 tests |
| Memory consumers (command bar, context rail, memory actions, Account360, planner, ingestion worker, memory capabilities) | Persistent, tenant-scoped memory | Caller tests + T6 |
| Brain UI / Backoffice knowledge graph | Reads unchanged; writes server-only | UI tests + rules tests |
| Feature flags / kill switches | Actually persist | T0.5 + T8.1 |

---

## 11. Backoffice (operable without code)

- **Approvals:** grant or revoke `agent_approvals.decide` per role/workspace; see legacy proposals needing re-proposal.
- **Features:** `FF_CRM_PROPOSAL_EXECUTION`; existing kill switches now effective.
- **Audit:** the persisted hash-chained ledger with chain verification.
- **Meetings-monitor / companybrain:** memory store health (pending embeddings count, backfill progress).

---

## 12. Deployment & Infrastructure (Rule 5, AGENTS.md)

Nothing below happens without your explicit approval:

| # | Change | Needs |
| --- | --- | --- |
| I1 | `WORKFLOW_RESUMPTION_SECRET` in Secret Manager + both surfaces (App Hosting + Cloud Run) | Approval; **before** the code deploy |
| I2 | `firestore.rules`: `memory_objects` server-only; `sdr_drafts`, `revenue_swarm_runs`, `workflow_resumption_tokens` deny-client | Approval (security-sensitive) |
| I3 | Composite indexes from T0.6 + new collections | Approval |
| I4 | `memory_objects` vector index (`gcloud`, T6.8) | Approval |
| I5 | Embedding backfill run (T6.9) | Approval after dry-run report |
| I6 | Code deploy via `deployment` branch, canary first | Approval |

### Decisions needed (in addition to master D1–D4)

| # | Decision | Recommended |
| --- | --- | --- |
| D5 | **Staging is the same Firebase project as production (FU-3),** so "staging first" for rules can't be met as written | Emulator rules tests + a written approval per rules deploy now; create a separate staging Firebase project as a follow-up |
| D6 | Who gets `agent_approvals.decide` by default | Roles holding workspace admin (preserves today's admin ability; ordinary members lose it) |
| D7 | Legacy pending proposals (old hash) | Show "Needs re-proposal"; don't auto-migrate hashes |

---

## 13. Tracker

### 13.1 Tasks

| ID | Task | Status | Evidence |
| --- | --- | --- | --- |
| P11-M0-T0 | Persistent storage, fail-closed | ☐ | |
| P11-M0-T1 | Governed gateway defaults | ☐ | |
| P11-M0-T2 | Unified approvals + approver policy | ☐ | |
| P11-M0-T3 | All executions through the gateway | ☐ | |
| P11-M0-T4 | Real proposal execution & compensation | ☐ | |
| P11-M0-T5 | Durable workflow approvals | ☐ | |
| P11-M0-T6 | Memory SSOT | ☐ | |
| P11-M0-T7 | No hardcoded fallbacks / module state | ☐ | |
| P11-M0-T8 | Verification & completion report | ☐ | |

### 13.2 Mapping to the master plan

| Master task | M0 task(s) |
| --- | --- |
| P11-M0-T1 Memory SSOT | T6 (+ T0) |
| P11-M0-T2 Route through `executeCapability` | T1, T3 |
| P11-M0-T3 Real proposal execute/rollback | T4 |
| P11-M0-T4 Approvals | T2, T5 |
| P11-M0-T5 Remove fallbacks / Maps | T7 |
| P11-M0-T6 Binding + hash-chained audit | T2 (binding), T0 (audit persists) |
| *(new, from F1)* | T0 |

### 13.3 Follow-ups found during review (not M0)

- Phase 9/10 persona and tool matrices reference unregistered capabilities (`knowledge.memory.query`, `crm.account.get_context`, `crm.timeline.get_events`, `deal.pipeline.get`, `crm.lead.enrich`, `crm.outreach.draft_email`, `crm.calendar.schedule_meeting`): add a registry-consistency test and fix in their owning phases.
- Command bar EXECUTE/AUTOMATE façades (master plan §2.2 context).
- Separate staging Firebase project (D5).
- General event-bus durability (outbox consumers across instances).

---

## 14. Next Step

Confirm D5–D7 (and master D1–D4). Then start T0 with the failing storage-mode test, committing locally after each green step.
