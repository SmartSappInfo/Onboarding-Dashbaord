# Phase 11 · Milestone 0 Implementation Plan
## Foundation Remediation: persistent stores, one governed gateway, one approval model, real execution, persistent memory

**Version:** 1.1.0. Rules-conformance revision: every rule (Important 1–10 as amended, 11–69) is mapped to M0 tasks and verification (§7); functionality-preservation guarantees added (§3).
**Status:** PLANNING. Uses master-plan defaults D2 (Firestore vector search) and D3 (M0 inside Phase 11); D5–D7 (§14) need answers before the infrastructure steps.
**Date:** 2026-10-05
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §2.2 (B5–B9), §13 (P11-M0-T1…T6), §12 deployment policy.
**Rules:** [`agents_mcp_rules.md`](../agents_mcp_rules.md); [`.agents/AGENTS.md`](../../../.agents/AGENTS.md); `theme.md` §8.
**Change log:**
- 1.0.0: initial plan.
- 1.1.0:
  - Full per-rule matrix (§7).
  - Functionality-preservation table (§3).
  - New steps from the rules review:
    - T0.8: audit-chain contention, Rule 9.
    - T3.0: preserve the runner/adapter checks the gateway lacks, Rules 14/30/60/24.
    - T6.0: residency/allowed-model check before embedding, Rule 57.
    - T2.8: security-feed events, Rule 62.
    - T8.5: canary/rollback thresholds, Rule 65.
    - T8.6: runbook entries, Rule 63.
  - Explicit OTel, version, audit, cache and boundary requirements.
  - N/A rules explained.

**Documents reviewed for this milestone:**

| Document | Used for |
| --- | --- |
| Phase 11 master plan | Scope, definition of done, contracts §5.1–5.6 |
| `agents_mcp_rules.md` (full, every rule) | §7 matrix; task designs |
| `.agents/AGENTS.md` | Git protocol (no push unless asked), `pnpm typecheck`/`pnpm lint`, no full local build, strict typing, toasts, theme.md §8 modals, mobile-first |
| `docs/agentic/04, 05, 08, 10, 11` | Boundary validation; effective principal, risk levels, non-delegable list, approval binding; memory fields + tenant vector filter; Cloud Tasks + sagas + cancellation; trust classes |
| `agents_mcp_phase_1_build_plan.md` §4.2–4.4, §12 | 16-step gateway design; principals; durable records; PR-2 notes; **FU-3** (staging = production Firebase project); **FU-7** (`server-only`) |
| `agents_mcp_pr2_pr3_implementation_plan.md`, `agents_mcp_pr4_implementation_plan.md` | Live-principal re-check; verify-then-bind; gateway pipeline contract |
| `agents_mcp_prd.md` §16, §66–76 | `memory_objects`; permissions, sensitivity, audit, retention, deletion |
| `agents_mcp_tools.md` §6.3 | Execution envelope |
| `scripts/NOTE_INDEX_VECTOR_README.md`, Quick Notes spec | Out-of-band `gcloud` vector index pattern (768 dims) |

---

## 1. Goal

When M0 is done, the platform underneath Phase 11 is real:

1. Platform stores persist in production (they don't fall back to RAM).
2. Every agent, workflow, MCP and sales execution passes through **one** governed gateway with production dependencies wired by default.
3. There is **one** approval model shared by the inbox, the gateway, workflows and CRM/sales, decided only by permitted humans.
4. Approved proposals **actually perform** their change, and rollbacks actually compensate.
5. Workflow approval waits appear in the inbox and resume durably across instances.
6. Memory persists, is tenant-scoped and can be searched by meaning.
7. No hardcoded secrets or recipients and no business state in module memory.

**Non-goals (tracked in §15.3):** the generic agent run worker (`AgentExecutionLoop`; Phase 11 uses workflows), the command-bar EXECUTE/AUTOMATE façades, general event-bus durability beyond the approval resume path, and persona matrices that reference unregistered capabilities.

---

## 2. Verified Findings (code as of `6a0ee755`)

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| F1 | **Eight platform stores choose in-memory storage when `FIREBASE_PROJECT_ID` is unset, and production doesn't set it** (Cloud Run env: `APP_SURFACE, PUBLIC_APP_ORIGIN, NEXT_PUBLIC_APP_URL, NEXT_TELEMETRY_DISABLED, FIREBASE_CONFIG` only; `apphosting.yaml` none). Affected: idempotency, outbox, approvals, **flags/kill switches**, audit, DLQ, event ledger, outbox reader. | `execution-store.ts:213`, `outbox-store.ts:182`, `approval-store.ts:326`, `flag-service.ts:275`, `audit-store.ts:334`, `dead-letter-storage.ts:215`, `event-execution-ledger.ts:230`, `outbox-reader.ts:305`; `deploy-cloudrun.yml:139` | Critical |
| F2 | The gateway has no production defaults for idempotency, approval verification or the live-user check; step 10 **skips** idempotency without a store, and step 8 skips the standing check without a checker. MCP stateless handler: none passed. Agent-step route: no idempotency store. | `execute-capability.ts`; `pipeline/10-check-idempotency.ts`; `pipeline/08-authorize-principal.ts`; `create-stateless-handler.ts:147`; `agent-step-executor.ts:208` | High |
| F3 | Seven production paths call `capability.handler()` directly (bypassing all 15 steps). | `workflow-step-runner.ts:394`, `workflow-saga-engine.ts:237`, `saga-compensation.ts:224`, `agent-execution-loop.ts:345`, `genkit-tool-adapter.ts:255`, `sales-agent-actions.ts:112…318`, `lib/mcp/tools/*`, `lib/mcp/registry.ts:381` | High |
| F4 | **Two incompatible approval models share `capability_approvals`.** The gateway's `CapabilityApprovalRecord` (`computeApprovalPayloadHash`: capability + version + tenant + input) and the inbox/CRM/SDR/swarm `ActionProposal` (`sha256Hex(payload)`) reject each other's documents. | `policy/approval-verifier.ts:29-60`; `policy/approval-proposal-types.ts:51-77`; `runtime/execution/approval-interceptor.ts` | High |
| F5 | Approve requires only same-org membership: no approver permission, no workspace check, self-approval blocked only at L4. **No approval permission exists in RBAC.** | `approval-governance-actions.ts:337-460`; `src/lib/permissions*.ts` | High |
| F6 | CRM proposal execute marks `bound` and emits an event, but performs no mutation; rollback flips the status only. | `crm-proposal-bridge.ts:180-387` | High |
| F7 | The CRM agent targets **unregistered capability IDs** (`crm.deal.update_stage`, `crm.task.create`, `crm.workspace_entity.assign_owner`; compensations `crm.deal.revert_stage`, `crm.task.delete`, `crm.workspace_entity.revert_*`). Registered: `deal.advance_stage`, `deal.assign_owner`, `crm.workspace_entity.update`, `task.create`, `task.update`. | `src/platform/agents/crm/actions/*`; `src/platform/domains/*` | High |
| F8 | Workflow approval suspension creates no inbox item. The resume bridge is never instantiated and is in-process; resumption-token replay protection is a per-instance `Set`. | `workflow-step-runner.ts:241-290`; `approval-workflow-bridge.ts`; `workflow-resumption-service.ts:92` | High |
| F9 | Platform memory lives in a process `Map` + RAM vector store with no embedding provider. `getMemoryItem(id)`, `deleteMemoryItem(id)`, `supersedeMemoryItem` take **no tenant**. | `canonical-memory-service.ts:96, 228, 260, 319` | High |
| F10 | `memory_objects` is **client-writable** by any workspace member; no client code writes it today. | `firestore.rules:3222-3240` | High |
| F11 | No vector index is declared anywhere (the `note_index` one was created out of band); `memory_objects` has none. | `firestore.indexes.json`; `scripts/NOTE_INDEX_VECTOR_README.md` | Medium |
| F12 | Hardcoded `'smartsapp-resumption-secret-fallback'`; SDR fallback recipient `+233249876543` (×2); SDR drafts/proposals in module `Map`s; swarm history + `AbortController`s in module `Map`s; unbounded signature-session/timeline caches. | `workflow-resumption-types.ts:137`; `sdr-outbound-actions.ts:51-52, 285`; `sdr-capabilities.ts:59, 323`; `revenue-swarm-actions.ts:40-48`; `crm-multi-turn-session.ts:72`; `account-timeline-service.ts:40` | High / Medium |
| F13 | Memory schemas are compatible: `CanonicalMemoryObject` ⊇ PRD `MemoryObject` (+`tier`, `sensitivity`, `temporal`). **No data migration needed.** | `platform/memory/contracts/memory-types.ts:154-179`; `lib/memory/types.ts:128-147` | Opportunity |
| F14 | **Audit chain = one head document per workspace, updated in a transaction for every execution.** Once T0 makes audit persistent, all audited executions in a busy workspace serialize on one document (Firestore's sustained per-document write guidance ≈ 1/s), risking contention, latency and aborted executions. | `audit-store.ts:40-95` (`capability_audit_heads/{workspace}`) | High (load) |
| F15 | The workflow runner and Genkit adapter perform checks **the gateway does not**: tool-fingerprint drift (Rule 14), injection scan of step input (Rule 30), dead-man switch (Rule 60), capability circuit breaker (Rule 24). A naive move to the gateway would lose them. | `workflow-step-runner.ts:101-345`; `genkit-tool-adapter.ts:115, 192-205` | High (preservation) |

---

## 3. Functionality Preservation ("without compromising functionality")

| Area | Today | After M0 | Guarantee & proof |
| --- | --- | --- | --- |
| Feature flags & kill switches | In RAM in production (F1): operator changes don't stick | Persisted in `platform_features` | **A missing flag doc = today's default** (T0.5 test per flag). Before deploy: report which flag docs exist so nothing flips unexpectedly |
| Gateway callers (MCP v2, agent steps) | Run without idempotency or a live check | Idempotent; revoked users refused | Existing MCP and agent-step suites pass unchanged; the only new refusals are for revoked users (intended) |
| Workflow runner / Genkit adapter | Own checks + direct handler | Own **extra** checks kept (F15) + gateway | Fingerprint drift, injection scan, dead-man, breaker tests stay green (T3.0); refusal-code snapshot tests for the workflows UI |
| Sales actions (search, score, dossier, decision makers, pitch) | Direct handler | Gateway | Same return shapes (`invokeGoverned` maps outcomes); sales suites green |
| Approvals inbox | Any org member approves | `agent_approvals.decide` + membership | **Default-granted to workspace-admin roles** (D6), so admins keep the ability; Backoffice can grant it to others without code |
| Pending proposals (old hash) | Approvable, but execution was a no-op anyway | Shown "Needs re-proposal" | Nothing executable is lost (execution never happened before); count reported pre-deploy |
| CRM proposal execute/rollback | Reports success, changes nothing | Changes the record / restores it | Behind `FF_CRM_PROPOSAL_EXECUTION` (canary first); preview shows the exact change; copy says "Applied" only after a verified write |
| Memory API (15 callers) | `get/delete(id)` | `get/delete(tenant, id)` | All callers updated in one task; a one-release compatibility wrapper that resolves the tenant from the record and **refuses** cross-tenant access |
| Brain UI, Backoffice knowledge graph | Reads `memory_objects` | Same reads; writes server-only | Rules tests: reads unchanged; writes denied (no client writers exist) |
| SDR drafts / revenue swarm | Lost on restart; break across instances | Persisted | Same UI contracts; cross-instance tests |
| Workflow resume | Token replay possible across instances | Firestore token record | Webhook/schedule resume suites green |
| Audit | RAM (lost) | Persisted, **sharded chain** (T0.8) | No serialization bottleneck; chain verification per shard |

---

## 4. Design Decisions

1. **One storage-mode switch (F1).**
   - `resolvePlatformStorageMode()` returns `'firestore'` except when `NODE_ENV === 'test'`, or with an explicit `PLATFORM_STORAGE=memory` outside production.
   - Production plus memory mode **throws at startup** (`src/instrumentation.ts`).
   - The project id comes from `firebase-admin`'s resolved app.
   - Firestore unavailable at runtime → fail closed (`stateChanged: 'no'`, retryable); no silent RAM fallback.
2. **Gateway dependencies by default (F2).**
   - `getGovernedGatewayDeps()` supplies the Firestore idempotency store, the unified approval store/verifier, live standing (`live-principal-check.ts`), the audit sink and the outbox sink.
   - The principal memo is **per request only** (never across requests, Rule 50).
   - `executeCapability` uses these defaults unless deps are injected (tests).
3. **Callers never call handlers (F3), without losing extra checks (F15).**
   - `invokeGoverned()` is the single call site.
   - Path-specific pre-checks (fingerprint, injection scan, dead-man, breaker) run **before** it, in a shared `runPreExecutionGuards()` so the runner and the adapter don't duplicate them (Rule 7, reuse).
   - CI grep gate: no `.handler(` outside `13-execute-handler.ts` (allowlist: MCP `strangler-bridge` legacy tools, event-bus `sub.handler`).
4. **One approval model (F4) and approver policy (F5).**
   - `ApprovalRecord` = `ActionProposal` fields + `requestedBy`, `workflowRef?`, `targetVersion?`, `beforeState?`, `hashVersion: 2`, `schemaVersion`.
   - Hash: `computeApprovalPayloadHash`.
   - One `FirestoreApprovalStore` implementing proposal operations and the verifier (verify → bind in one transaction).
   - Legacy docs are read through an adapter.
   - Permission `agent_approvals.decide`: non-delegable, so agents can never hold it. Plus workspace membership; never the proposer; L4 needs two distinct approvers.
5. **Real execution (F6, F7).**
   - Execution runs `invokeGoverned` with `surface: 'agent'`, the live (authorizing user ∩ persona) principal and `approvalId`. Step 09 binds; step 11 version-checks; the target is re-read afterwards.
   - Compensation runs the registered inverse capability with `beforeState`.
6. **Durable workflow approvals (F8).**
   - Suspension creates an `ApprovalRecord` with `workflowRef`.
   - The decision enqueues a Cloud Task to the existing authenticated worker family (HMAC + OIDC; target = own origin only).
   - Token consumption is recorded in a transactional Firestore record.
7. **Memory SSOT (F9–F11, F13).**
   - `FirestoreMemoryStore` + `FirestoreVectorStore` (`findNearest`, org + workspace prefilter, k ≤ 50, cosine) + `gemini-embedding-001` at 768 dims through the AI gateway.
   - Tenant-scoped API; `schemaVersion` field.
   - The RAM store throws in production.
8. **Sharded audit chain (F14).**
   - `shard = hash(executionId) mod N` (N = 8 default, Backoffice-tunable); the head doc is `{workspace}_{shard}`.
   - Per-shard `prevHash` chain + sequence; verification walks each shard.
   - The chain head write is in the same transaction as the record. An audit-write failure after a committed mutation → the outbox records `audit_pending`, and a retry worker completes it (never drops).
9. **No hardcoded fallbacks (F12).**
   - The resumption secret is required (Secret Manager).
   - SDR recipient fallback removed.
   - `sdr_drafts` and `revenue_swarm_runs` persisted; swarm cancel via Firestore `cancelRequested`.
   - Caches become bounded LRU, tenant-keyed.

---

## 5. Tasks (TDD, small commits)

**Conventions:**
- Failing test first, then red, then implement, then green.
- `pnpm typecheck` + `pnpm lint` + affected Vitest, then a **local** commit; **no push unless asked** (Rule 2, AGENTS.md).
- `@fileOverview` (what, why, rules, caution, tests) on every new or changed file; `// CAUTION:` at tenant, approval, storage and secret code (Rule 10).
- Zod v4 at every boundary (Firestore reads, Cloud Task payloads, model/embedding output, MCP args). `unknown` only at those boundaries and parsed immediately. No `any`, `any[]` or unchecked `as` (Rule 4).
- OTel spans and correlation/causation IDs on every new path (Rule 39).

### T0: Persistent platform storage, fail-closed (F1, F14) · Rules 5, 9, 40, 60, 64

| Step | Action | Files |
| --- | --- | --- |
| 0.1 | Tests: production mode → every default store Firestore-backed; memory mode throws; test mode → memory | `src/platform/__tests__/storage/storage-mode.test.ts` |
| 0.2 | `resolvePlatformStorageMode()` + `assertPersistentStorageInProduction()` | `src/platform/storage/storage-mode.ts` (new) |
| 0.3 | Replace the 8 env checks (one commit per family: capabilities, flags, events) | F1 files |
| 0.4 | Startup assertion beside the `CLOUD_TASKS_SECRET` check | `src/instrumentation.ts` |
| 0.5 | Flag-defaults test: a missing doc = current behaviour, for every registered flag | `flag-service` tests |
| 0.6 | Index audit for every store query (audit per shard, outbox reader status/createdAt, DLQ, ledger); add missing composite indexes + emulator query tests | `firestore.indexes.json`, tests |
| 0.7 | Write-volume and cost estimate (audit + outbox per execution) in the report | report |
| 0.8 | **Sharded audit chain (F14):** tests for concurrent writes (50 parallel executions in one workspace: no aborts beyond retry budget, every shard chain verifies); implement shards; `audit_pending` retry path; verification API per shard | `audit-store.ts`, tests |

**Acceptance:** tests green; grep gate (no `FIREBASE_PROJECT_ID` storage checks); 50-parallel contention test passes; flag defaults unchanged.

### T1: Governed gateway defaults (F2) · Rules 16, 19, 20, 22, 47, 50, 51

| Step | Action | Files |
| --- | --- | --- |
| 1.1 | Tests with no deps injected: (a) repeated key replays; (b) revoked user → `ACTOR_REVOKED`; (c) agent L3 without verified approval refused; (d) audit + outbox written; (e) principal memo not shared across requests | `src/platform/__tests__/gateway/governed-defaults.test.ts` |
| 1.2 | `getGovernedGatewayDeps()` | `src/platform/capabilities/execution/governed-deps.ts` (new) |
| 1.3 | `executeCapability` uses the defaults; replace the `as ExtendedIdempotencyStore` cast with a type guard; validate replayed results with the output schema (no `as TOutput`) | `execute-capability.ts` |
| 1.4 | MCP stateless handler + agent-step route adopt the defaults | `create-stateless-handler.ts`, `api/tasks/agent-step/route.ts` |
| 1.5 | Benchmark: read overhead ≤ 50 ms p95 (emulator) | bench test |

**Acceptance:** (a)–(e) green; existing suites unchanged.

### T2: Unified approval model & approver policy (F4, F5) · Rules 13, 17, 18, 21, 22, 40, 41, 51, 62

| Step | Action | Files |
| --- | --- | --- |
| 2.1 | Tests: (a) an inbox approval passes the gateway verifier; (b) payload changed after approval → `APPROVAL_MISMATCH`; (c) proposer can't decide (L1–L4); (d) no `agent_approvals.decide` → refused; (e) non-member → refused; (f) L4 needs two distinct approvers; (g) legacy docs readable, legacy hash → "Needs re-proposal"; (h) concurrent decisions → one wins (version); (i) agents can't be granted `agent_approvals.decide` | `src/platform/__tests__/approvals/unified-approvals.test.ts` |
| 2.2 | `ApprovalRecordSchema` (superset, `hashVersion: 2`, `schemaVersion`) + legacy adapter; WHAT/WHY/evidence fields kept for the "why" view (Rule 41) | `src/platform/policy/approval-record.ts` (new) |
| 2.3 | Single `FirestoreApprovalStore`; old factories re-exported for compatibility | `approval-store.ts`, `approval-interceptor.ts` |
| 2.4 | Register `agent_approvals.decide` (PR-2 `permission-refs`), add it to the non-delegable list, default-grant to workspace-admin templates; parity test | `permission-refs.ts`, `risk-levels.ts`, role blueprints |
| 2.5 | Decision actions: `'use server'` + `requireAuth` + server-side permission + membership; no self-approval; L4 dual; `expectedVersion`; hash-chained audit | `approval-governance-actions.ts` |
| 2.6 | Migrate creators (CRM bridge, SDR actions/capabilities, revenue swarm) | 4 files |
| 2.7 | Inbox UI (theme.md §8, mobile): approver-only buttons (hidden + server-enforced); "Needs re-proposal" badge; conflict copy "Someone already decided this."; actionable toasts with relative `actionConfig.path` | `src/components/approvals/*` |
| 2.8 | Security-feed events (Rule 62): `approval.self_decision_blocked`, `approval.permission_denied`, `approval.binding_mismatch` | events + Backoffice feed query |

### T3: Every execution through the gateway (F3, F15) · Rules 12, 14, 16, 24, 30, 31, 47, 48, 60, 69

| Step | Action | Files |
| --- | --- | --- |
| 3.0 | **Preservation first:** extract `runPreExecutionGuards()` (dead-man, fingerprint drift, injection scan, breaker state) from the runner/adapter with tests proving identical behaviour | `src/platform/capabilities/execution/pre-execution-guards.ts` (new), tests |
| 3.1 | Grep gate test: no `.handler(` outside the allowlist | `src/platform/__tests__/gates/no-direct-handler.test.ts` |
| 3.2 | `invokeGoverned()` (invocation per surface; outcome → `{ success, data?, error?, code?, stateChanged }`) | `invoke-governed.ts` (new) |
| 3.3 | Workflow step runner → guards + gateway (`surface: 'task_worker'`; principal re-derived live each step; step idempotency key; `approvalId` on resume); remove only the logic the gateway now owns; keep leases and breaker recording | `workflow-step-runner.ts` |
| 3.4 | Workflow saga engine + runtime saga compensation → gateway | 2 files |
| 3.5 | Genkit tool adapter → guards + gateway (`surface: 'agent'`) | `genkit-tool-adapter.ts` |
| 3.6 | Sales agent actions (×5) → gateway (`surface: 'ui'`, session principal) | `sales-agent-actions.ts` |
| 3.7 | Lib MCP tools + registry capability path → gateway (`surface: 'mcp'`); existing MCP conformance suite run unchanged (Rule 37) | `lib/mcp/*` |
| 3.8 | Agent execution loop → gateway (consistency) | `agent-execution-loop.ts` |

**Acceptance:** grep gate green; refusal tests per path (wrong tenant, revoked user, missing approval, fingerprint drift, injection); suites green; refusal-code snapshots match the UI expectations.

### T4: Real proposal execution & compensation (F6, F7) · Rules 18, 21, 22, 27, 31, 42, 47

| Step | Action | Files |
| --- | --- | --- |
| 4.1 | Emulator E2E: approve → record changes; stale version → `VERSION_CONFLICT`, nothing written; rollback restores `beforeState` with a version check; unregistered target rejected at creation; postcondition mismatch → `stateChanged: 'unknown'` + operator alert; business validation (assignee is a workspace member, stage exists in the deal's pipeline, due date ≥ today) | `src/platform/__tests__/crm/crm-proposal-execution.e2e.test.ts` |
| 4.2 | Action-type → registered-capability map; registry validation at proposal creation; unsupported types → recommendation only | `crm-action-types.ts`, `crm-proposal-bridge.ts` |
| 4.3 | Capture `beforeState` + `targetVersion`; preview via gateway dry run (step 12, Rule 42) | `crm-proposal-bridge.ts` |
| 4.4 | Execute via `invokeGoverned`; postcondition verify | `crm-proposal-bridge.ts` |
| 4.5 | Compensation via inverse capability (agent-created tasks untouched by humans → `task.update` status cancelled; stage/owner/field → previous value) | `crm-proposal-bridge.ts` |
| 4.6 | `FF_CRM_PROPOSAL_EXECUTION` (global/org/workspace); UI copy "Applied" only after a verified success; "This record changed. Review again." on conflict | flags, CRM proposal modal |

### T5: Durable workflow approvals (F8) · Rules 20, 25, 26, 34

| Step | Action | Files |
| --- | --- | --- |
| 5.1 | E2E: suspension creates an inbox item with `workflowRef`; approve → Cloud Task → step re-runs with `approvalId`; reject → step fails, saga runs; expiry → dead-lettered with a reason; workflow cancelled while waiting → decision ignored + audited; the same token on two instances → second refused | `src/platform/__tests__/workflows/approval-resume.e2e.test.ts` |
| 5.2 | Suspension creates an `ApprovalRecord` | runner, resumption service |
| 5.3 | Decision enqueues the resume task (existing dispatcher; fixed own-origin target, Rule 34; HMAC + OIDC) | `approval-governance-actions.ts`, `workflow-dispatcher.ts` |
| 5.4 | Firestore token record (`workflow_resumption_tokens/{sha256}`, transactional create, TTL) | resumption service |
| 5.5 | Delete the unused in-process `approval-workflow-bridge.ts` | delete + tests |

### T6: Memory SSOT (F9–F11, F13) · Rules 6, 8, 9, 29, 30, 50, 54, 57, 58

| Step | Action | Files |
| --- | --- | --- |
| 6.0 | **Residency gate (Rule 57):** before embedding, check the tenant's `allowedModels`/`allowedExternalProviders`/`region`; disallowed → store without a vector, `embeddingStatus: 'blocked_by_policy'`, keyword search only | `embedding-service.ts`, tests |
| 6.1 | Context7 (Rule 6): Genkit `ai.embed` + `gemini-embedding-001` `outputDimensionality`; Firestore `findNearest` prefilters/limits; record versions | report |
| 6.2 | Tests: persists across re-instantiation; wrong-tenant get/delete/supersede → not found; vector search without org/workspace throws; legacy doc normalizes; dimension ≠ 768 refused; RAM store in production throws; retrieval p95 < 800 ms on a 10k-doc emulator fixture (Rule 54) | `src/platform/__tests__/memory/memory-ssot.test.ts` |
| 6.3 | `FirestoreMemoryStore` (canonical write, normalizing read, `version`, `schemaVersion`) | new adapter |
| 6.4 | `FirestoreVectorStore` (`findNearest`, prefilters, k ≤ 50; `deleteByFilter` batched ≤ 250) | new adapter |
| 6.5 | Embedding provider through the AI gateway model registry (Rule 58); outage → `embeddingStatus: 'pending'` + rate-limited re-embed task; **never a fake vector** | `embedding-service.ts`, `canonical-memory-service.ts` |
| 6.6 | Tenant-scoped API; update 15 callers; one-release compatibility wrapper that refuses cross-tenant access | service + callers |
| 6.7 | `firestore.rules`: `memory_objects` writes → `false`; rules tests | rules + tests |
| 6.8 | Vector index script + README (`gcloud`, org + workspace + embedding 768, flat); **run only with approval** | `scripts/MEMORY_VECTOR_INDEX_README.md` |
| 6.9 | Backfill: dry run → run; resumable cursor; ≤ 100 docs per batch; rate-limited; residency gate applied | `scripts/backfill-memory-embeddings.ts` |

### T7: Remove hardcoded fallbacks and module state (F12) · Rules 8, 9, 33, 50, 52, 53

| Step | Action | Files |
| --- | --- | --- |
| 7.1 | Tests: missing `WORKFLOW_RESUMPTION_SECRET` in production → startup error; grep gates (no literal secret, no fallback phone) | tests |
| 7.2 | Require the secret (test setup provides a test value) | `workflow-resumption-types.ts`, `instrumentation.ts` |
| 7.3 | SDR: remove fallback recipient (×2); drafts → `sdr_drafts` (deny-client rules); missing draft → "Draft not found" | SDR files, rules |
| 7.4 | Revenue swarm: history → `revenue_swarm_runs`; cancel = `cancelRequested`, checked between stages | swarm files |
| 7.5 | Shared bounded LRU (max 500, TTL, keys include org + workspace) for signature sessions + account timeline | `src/lib/cache/bounded-lru.ts` (new), 2 files |
| 7.6 | `import 'server-only'` in new/touched server modules (verify Next.js handling via Context7; FU-7) + client-boundary test (Rule 52); no new dependency unless Context7 says the package is required, in which case record it in `docs/agentic/16-dependency-governance.md` (Rule 53) | modules, test |

### T8: Verification, release & operations · Rules 42–46, 61–65, 67

| Step | Action |
| --- | --- |
| 8.1 | Emulator E2E: approve → resume → mutation → rollback; memory persistence + tenant isolation; flag/kill switch takes effect without deploy |
| 8.2 | Red team (Rule 46): cross-tenant memory get/delete, self-approval, payload tamper, replayed token, forged client write to `memory_objects`, revoked user mid-workflow, confused deputy via MCP session principal |
| 8.3 | Chaos (Rule 45): Firestore contention on approval bind and audit shards, duplicate Cloud Task delivery, embedding outage, Firestore unavailable (fail closed, `stateChanged: 'no'`) |
| 8.4 | Rule 67 gate answers + completion report (test names; CI run IDs once pushed) |
| 8.5 | **Canary plan (Rule 65):** Cloud Run traffic split 5% → 20% → 50% → 100% (backoffice surface first, then client). Auto-rollback if: 5xx > 1%, gateway p95 > 2× baseline, Firestore write errors > 0.5%, approval-bind failures > 0, audit `pending` backlog > 1,000 |
| 8.6 | Runbook entries (Rule 63): store outage, approval-binding failure, audit chain verification failure, embedding backlog: detection, containment (kill switch), remediation, replay test, postmortem |

---

## 6. Ordering & Commit Plan

```text
T0 ─► T1 ─► T2 ─► T3 ─► T4 ─► T5 ─► T8
  ├──► T6 (after T0)
  └──► T7 (after T0)
```
Each task lands as 3–8 small local commits, each passing `pnpm typecheck` + `pnpm lint` + affected tests. This machine is memory-constrained: if the full local typecheck can't complete, run scoped checks and record that CI on `main` is the full gate once you ask to push.

---

## 7. Rules Conformance Matrix (every rule → M0)

### 7.1 Important Rules 1–10 (as amended)

| Rule | M0 conformance | Where | Verified by |
| --- | --- | --- | --- |
| 1 | Skills: `backend-patterns`, `next-best-practices`, `vercel-react-best-practices` + `frontend-design` + `emilkowal-animations` (inbox changes only), `test-driven-development`, `firebase-security-rules-auditor`, `cybersecurity-analyst`, `firebase-ai-logic`, `verification-before-completion`, `systematic-debugging`. Preservation §3. Trackable: step-level tracker §15 | All | Review checklist; tracker kept current |
| 2 | Risk register §10; edge cases §10.2; TDD; local typecheck/lint/commit; no push until asked | All | Commit log; report |
| 3 | Affected features §12; Backoffice §13 | T2, T4, T8 | Backoffice E2E |
| 4 | Zod at boundaries; removes existing gateway casts (T1.3); grep gate for `as unknown as` / `: any` in touched files | All | Lint + gate |
| 5 | Generate → emulator test → stage → verify; staging = production project (FU-3) → D5; production only with written approval; security-sensitive changes never auto-deployed | §14 | Approval record per change |
| 6 | Context7 for Genkit embeddings, Firestore vector, `server-only`; no new deps planned | T6.1, T7.6 | Report lists versions |
| 7 | UI changes only in the approvals inbox + CRM modal copy: plain short English, ≥ 44 px, swipe-safe, theme.md §8, actionable toasts; shared guards/LRU/`invokeGoverned` avoid duplication | T2.7, T4.6, T3.0, T7.5 | Mobile viewport tests (375/768/1280) |
| 8 | Closes F1–F15; security skills per task; red team T8.2 | All | Red-team suite |
| 9 | Sharded audit (T0.8); batched writes ≤ 250; k ≤ 50; LRU bounds; rate-limited backfill/re-embed; gateway overhead ≤ 50 ms; edge cases §10.2 | T0, T1, T6, T7 | Contention + benchmark tests |
| 10 | `@fileOverview` + `// CAUTION:` | All | Review |

### 7.2 Rules 11–69

| Rule | M0 conformance | Task | Verification |
| --- | --- | --- | --- |
| 11 | No protocol change; MCP paths keep spec 2026-07-28 / SDK v2; the existing conformance suite runs unchanged | T1.4, T3.7 | MCP suite |
| 12 | Approval need decided server-side by risk + persona in steps 08/09; annotations ignored | T1, T3 | False-`readOnlyHint` test |
| 13 | Proposal payloads, memory content, Cloud Task bodies, embedding output = untrusted; parsed at the boundary | All | Schema tests |
| 14 | Fingerprint drift check preserved for workflow/agent paths (T3.0); MCP domain factory unchanged | T3.0 | Drift tests |
| 15 | N/A: no external MCP servers added or changed | — | — |
| 16 | Live principal re-derived per workflow step and per proposal execution; runs record `agentId/agentVersion/runId/delegationId/policyVersion/toolInvocationId` | T1, T3, T4 | Revoked-user tests |
| 17 | `agent_approvals.decide` added to the non-delegable list | T2.4 | Test 2.1(i) |
| 18 | `expectedVersion` on approval decisions, proposal execution, compensation, memory supersede | T2, T4, T6 | Conflict tests |
| 19 | Gateway idempotency default-on; workflow step keys; proposal execution key `approvalId`; memory writes keyed by `sourceId + contentHash` | T1, T3, T4, T6 | Duplicate tests |
| 20 | Execution records (`runId, toolCallId, executionId, idempotencyKey, status, attempt`) persisted; token record; unknown outcome → reconcile by key | T0, T1, T5 | Duplicate-delivery test |
| 21 | PLAN → PREVIEW (dry run) → APPROVE → EXECUTE → VERIFY for CRM proposals | T4 | E2E |
| 22 | Hash v2 binds capability + version + tenant + input; `targetVersion`/`policyVersion`/`toolVersion` stored; any change invalidates | T2 | Tamper test |
| 23 | Backfill/re-embed budgets (batch ≤ 100, rate limit, max runtime); gateway `callDepth` guard kept; swarm stage budgets unchanged | T6, T7 | Budget tests |
| 24 | Runner breaker preserved; embedding provider breaker; Firestore errors → clear "Nothing was changed" messages | T3.0, T6.5 | Chaos tests |
| 25 | Approval expiry → DLQ with reason; `audit_pending` retry queue; manual recovery via Backoffice | T0.8, T5 | DLQ tests |
| 26 | Swarm cancel durable and cooperative (finish the current stage, stop before the next, show the exact state); workflow cancel while waiting → decision ignored | T5, T7 | Cancel tests |
| 27 | Real compensations with `beforeState`; reverse order for multi-step | T4 | Rollback E2E |
| 28 | Memory retrieval keeps k ≤ 50 and existing context budgets; no change to agent context assembly | T6 | Retrieval test |
| 29 | Memory provenance, temporal, sensitivity, retention fields persisted; supersede, never overwrite | T6 | Memory tests |
| 30 | Injection scan preserved on workflow inputs (T3.0); client memory writes removed (T6.7) | T3.0, T6.7 | Poisoning tests |
| 31 | Schema → business → permission → policy before execute (T4.1 business rules) | T4 | Validation tests |
| 32 | No new outbound data paths; SDR drafts stay drafts; embedding text is the only egress, governed by the residency gate | T6.0, T7.3 | Egress review |
| 33 | Embedding provider allowlisted per tenant; no external sends in M0 | T6.0 | Disallowed-provider test |
| 34 | No URL fetching; resume tasks target the fixed own origin; Cloud Tasks auth unchanged | T5.3 | Target test |
| 35 | N/A: no discovery-cache changes | — | — |
| 36 | `schemaVersion` on approval and memory records; `hashVersion`; capability versions stored in approvals and executions | T2, T6 | Record assertions |
| 37 | Existing MCP compatibility suite unchanged and green | T3.7 | CI |
| 38 | No deprecated MCP features introduced | — | Review |
| 39 | Spans: gateway (per step), approval create/decide/bind, resume enqueue/run, memory write/search/embed, audit shard write; IDs propagated | All | Span assertions |
| 40 | Audit persisted, append-only, hash-chained per shard; deny client access; no update/delete (rules tests) | T0.8 | Tamper + rules tests |
| 41 | Approval records keep WHAT/WHY/evidence/blast radius; inbox shows them | T2.2, T2.7 | UI test |
| 42 | Dry-run preview before approval; `FF_CRM_PROPOSAL_EXECUTION` canary | T4.3, T4.6 | E2E |
| 43 | Executions store versions (agent/tool/schema/policy) and input hash; enough to replay without writes | T1 | Record assertions |
| 44 | Firestore emulator; fake embedding provider; fake clock; two-instance simulation | T5, T6 | Hermetic suites |
| 45 | Chaos list T8.3; expected behaviour defined in §10.2 before injection | T8.3 | Chaos suite |
| 46 | Red-team list T8.2 | T8.2 | Red-team suite |
| 47 | MODEL/PROPOSAL → VALIDATOR → POLICY → PERMISSION → EXECUTOR → VERIFIER for every path | T3, T4 | Grep gate + E2E |
| 48 | Capability outputs validated (step 14); replayed results re-validated (T1.3); sanitized errors | T1, T3 | Unit tests |
| 49 | New collections (`sdr_drafts`, `revenue_swarm_runs`, `workflow_resumption_tokens`, audit heads) deny-client; nothing public | T5, T7, T0.8 | Rules tests |
| 50 | Principal memo per request; LRU keys tenant-scoped; no `unstable_cache` of workspace data | T1, T7.5 | Cache tests |
| 51 | Decision actions: `'use server'` + auth + permission + membership; gateway authorization as a second layer | T2.5 | Action tests |
| 52 | `server-only` in touched server modules; boundary test; CI build gate | T7.6 | Test + CI |
| 53 | No new dependencies planned; lockfile untouched; any addition recorded | T7.6 | Dependency record |
| 54 | Gateway read overhead ≤ 50 ms p95; approval decide ≤ 400 ms p95; memory search ≤ 800 ms p95; inbox render unchanged | T1.5, T2, T6.2 | Benchmarks |
| 55 | N/A: no graph/canvas changes | — | — |
| 56 | N/A: no context-compression changes | — | — |
| 57 | Residency/allowed-model gate before embedding; memory `dataClass`/`region`/`retentionPolicy` persisted | T6.0 | Policy tests |
| 58 | Embedding model resolved through the central AI gateway registry | T6.5 | Routing test |
| 59 | N/A: no planner/tool-selection changes (Phase 11 M4) | — | — |
| 60 | Kill switches persist (T0); dead-man check preserved on all paths (T3.0); `FF_CRM_PROPOSAL_EXECUTION` can disable execution instantly | T0, T3.0, T4.6 | Kill-switch E2E |
| 61 | Backoffice gains approver policy, legacy-proposal view, audit-chain verification, memory health (§13) | T2, T8 | Backoffice E2E |
| 62 | Security-feed events (T2.8) + revoked-actor refusals, token replays, forged-write denials | T2.8, T5, T6 | Feed tests |
| 63 | Runbook entries T8.6 | T8.6 | Drill |
| 64 | `FF_CRM_PROPOSAL_EXECUTION` at global/org/workspace; capability-level toggles via existing flag service (now persistent) | T4.6, T0 | Flag tests |
| 65 | Canary 5/20/50/100 with auto-rollback thresholds (T8.5) | T8.5 | Canary plan |
| 66 | Cross-cutting gates closed here: Phase 1 (idempotency, risk, version, concurrency, audit, egress contracts), Phase 2 (correlation/causation, replay protection, DLQ), Phase 3 (agent identity, delegation, non-delegable, approval binding, TOCTOU), Phase 4 memory (provenance, validity, poisoning, sensitivity, retention, deletion), Phase 7 (cancel, retry, DLQ, recovery, compensation, replay), Phase 8 UX (approval clarity, stale-state warnings, recovery UI) in the inbox | All | Gate answers |
| 67 | Gate §9 answered in the report; every N/A explained (15, 35, 55, 56, 59) | T8.4 | Review |
| 68 | (1) Model is not the boundary: gateway on every path; (2) tool output untrusted: step 14 + replay validation; (3) mutations idempotent/authorized/version-checked/auditable: T1/T2/T4/T0.8; (4) bounded authority + resources: approver policy, budgets; (5) operable without code: persistent flags, Backoffice §13 | All | Mapped tests |
| 69 | One governed layer: `invokeGoverned` + grep gate; UI, agents, MCP, workflows converge | T3 | Gate |

---

## 8. Test Plan Summary

| Layer | Suites |
| --- | --- |
| Unit | storage-mode, governed-defaults, pre-execution guards, approval-record adapter, LRU, token record, residency gate |
| Integration (emulator) | approval store transactions, sharded audit, memory stores, vector prefilters, flags persistence |
| E2E (emulator) | CRM execute/rollback; workflow approval resume (two instances); kill switch without deploy |
| Rules | `memory_objects` server-only; new collections deny-client; audit no update/delete |
| Gates | no direct `.handler(`; no `FIREBASE_PROJECT_ID` storage checks; no literal secret/phone; no `any`/unchecked casts in touched files |
| Security / chaos | T8.2 / T8.3 |
| Performance | gateway overhead, approval decide, memory search, audit contention |

---

## 9. Implementation Gate (Rule 67)

```text
ARCHITECTURE  No new capabilities; consolidates storage, gateway, approvals, memory, audit. SoT: Firestore.
              Events: approval.created/decided/bound/self_decision_blocked/permission_denied/binding_mismatch,
              proposal.executed/compensated, memory.created/deleted, audit.pending/sealed.
AUTHORITY     Approvals: agent_approvals.decide (non-delegable) + membership; never the proposer; L4 dual.
DATA          Payloads, memory content, task bodies, embedding output untrusted → schemas. Secrets in Secret Manager.
EXECUTION     Idempotent by default; retries safe; durable cancel; version-checked; lost response → reconcile.
MCP           Unchanged protocol; MCP paths now get production deps.
FAILURE       Firestore down → fail closed; embedding down → pending; stale approval → re-propose; contention →
              sharded audit + transaction retry with jitter.
SECURITY      Closes RAM fallback, handler bypass, approval mismatch, self-approval, client memory writes,
              hardcoded secret/recipient; keeps fingerprint/injection/dead-man checks.
OPERATIONS    Persistent flags/kill switches; approver policy, audit verification, memory health in Backoffice.
TESTING       Unit · integration · contract · E2E · rules · security · tenant isolation · adversarial · chaos · load.
MIGRATION     No data migration; legacy proposals → re-proposal; rollback = revert commits / flags off.
N/A           Rules 15, 35, 55, 56, 59 (reasons in §7.2).
```

---

## 10. What Could Go Wrong (Rule 2) & Edge Cases (Rule 9)

### 10.1 Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Persistent stores add latency/cost and surface missing indexes | Index audit 0.6; benchmarks; batched writes; cost note; canary |
| R2 | A stale flag doc flips a feature when flags start persisting | Defaults test 0.5; pre-deploy flag-doc report |
| R3 | **Audit chain contention in busy workspaces** (F14) | Sharded chains T0.8; contention test; `audit_pending` retry |
| R4 | Losing the runner/adapter's extra checks (F15) | T3.0 first, with behaviour-identity tests |
| R5 | Refusal codes change for the workflows UI | `invokeGoverned` mapping; snapshot tests |
| R6 | Legacy pending proposals become non-executable | Pre-deploy count; badge; release note |
| R7 | Approver permission locks out current approvers | Default-grant to workspace admins; Backoffice grant; parity test |
| R8 | Real CRM execution surprises users | Preview + flag + canary + clear copy |
| R9 | The memory API change breaks callers | One-task update + compatibility wrapper |
| R10 | Embedding quota/latency | Pending path; rate-limited re-embed |
| R11 | Rules tightening breaks a hidden writer | Verified none; rules tests; approval |
| R12 | Missing `WORKFLOW_RESUMPTION_SECRET` breaks startup | Secret provisioned before the code deploy (I1); startup error names it |
| R13 | Local typecheck can't run (memory) | Scoped checks; CI as the full gate |

### 10.2 Edge cases (expected behaviour defined before chaos tests)

| Case | Expected behaviour |
| --- | --- |
| Two approvers decide at once | One transaction wins; the other gets "Someone already decided this." |
| Approver loses permission between view and decide | Server refuses; the inbox refreshes |
| Approved target archived before execute | Resource scope → not found; nothing written; proposal marked failed |
| Workflow cancelled while waiting | Decision ignored; audited |
| Resume task delivered twice | Token record → second no-op |
| Firestore unavailable | Fail closed, `stateChanged: 'no'`, retryable message |
| Audit write fails after a committed mutation | `audit_pending` recorded; retried until sealed |
| Embedding wrong dimension | Refused; `embeddingStatus: 'failed'`; alert |
| Memory id from another tenant | Not found (no existence leak) |
| Swarm cancel mid-stage | Finish the stage, stop before the next, show the exact state |
| Cache eviction under load | Correctness unaffected (Firestore is the source) |
| 50 parallel executions in one workspace | No audit aborts beyond the retry budget |
| Legacy approval doc missing fields | Adapter fills safe defaults; legacy hash → not executable |

---

## 11. UX Notes for M0 Surfaces (Rule 7, AGENTS.md, theme.md §8)

- **Approvals inbox:**
  - Approver-only "Approve"/"Reject" (≥ 44 px, `rounded-xl active:scale-[0.97]`).
  - "Needs re-proposal" badge.
  - Conflict and permission messages in one plain line.
  - Toasts with relative `actionConfig.path`.
  - Guidance in `CardInfoTooltip`, not paragraphs.
  - Works at 375/768/1280.
- **CRM proposal modal:** a preview list of exact field changes; "Applied" only after verification; "This record changed. Review again." on conflict; "Undo" for compensation.
- No other UI changes in M0.

---

## 12. Affected Features (Rule 3)

| Feature | Effect | Verified by |
| --- | --- | --- |
| Gateway users (MCP v2, agent steps) | Idempotency, live re-check, persisted audit | Suites + T1 |
| Workflows (runner, sagas, resume, UI) | Governed; approvals in the inbox; durable resume; checks preserved | Workflow suites + T5 |
| Approvals inbox (`/admin/intelligence/approvals`, Backoffice approvals) | One model; approver policy; legacy badge | T2 |
| CRM proposals (Phase 9 modal) | Real execute/rollback behind a flag | T4 |
| Sales (Prospect Finder, SDR, revenue swarm) | Persisted drafts/history; no fallback recipient; governed reads | Sales suites + T7 |
| Memory consumers (command bar, context rail, memory actions, Account360, planner, ingestion worker, memory capabilities) | Persistent, tenant-scoped memory | Caller tests + T6 |
| Brain UI / Backoffice knowledge graph | Reads unchanged; writes server-only | Rules + UI tests |
| Feature flags / kill switches | Actually persist | T0.5 + T8.1 |

---

## 13. Backoffice (operable without code; Rules 3, 60–62)

- **Approvals:** grant/revoke `agent_approvals.decide` per role/workspace; the legacy-proposal list; the decision audit.
- **Features:** `FF_CRM_PROPOSAL_EXECUTION`; existing kill switches now effective.
- **Audit:** per-shard chain verification; `audit_pending` backlog; shard count setting.
- **Companybrain / meetings-monitor:** memory health (pending/blocked embeddings, backfill progress).
- **Security feed:** approval blocks, binding mismatches, revoked-actor refusals, token replays, forged-write denials.

---

## 14. Deployment, Infrastructure & Decisions (Rule 5, AGENTS.md)

Nothing below happens without your explicit approval:

| # | Change | When |
| --- | --- | --- |
| I1 | `WORKFLOW_RESUMPTION_SECRET` in Secret Manager + both surfaces | **Before** the code deploy |
| I2 | `firestore.rules`: `memory_objects` server-only; deny-client for `sdr_drafts`, `revenue_swarm_runs`, `workflow_resumption_tokens`, audit heads | After emulator tests; security-sensitive |
| I3 | Composite indexes (T0.6, new collections) | Before the code deploy |
| I4 | `memory_objects` vector index (`gcloud`) | Before enabling memory search |
| I5 | Embedding backfill | After the dry-run report |
| I6 | Code deploy via `deployment`, canary per T8.5 | Last |

| # | Decision | Recommended |
| --- | --- | --- |
| D5 | Staging shares the production Firebase project (FU-3), so "staging first" for rules can't be met as written | Emulator rules tests + written approval per rules deploy now; a separate staging project as a follow-up |
| D6 | Default holders of `agent_approvals.decide` | Workspace-admin roles (preserves admins; ordinary members lose it) |
| D7 | Legacy pending proposals | "Needs re-proposal"; no hash auto-migration |

---

## 15. Tracker (Rule 1)

### 15.1 Tasks and steps

Status: ☐ not started · ◐ in progress · ☑ done (evidence) · ⛔ blocked

| ID | Task | Steps | Status | Evidence |
| --- | --- | --- | --- | --- |
| P11-M0-T0 | Persistent storage + sharded audit | 0.1–0.8 | ☐ | |
| P11-M0-T1 | Governed gateway defaults | 1.1–1.5 | ☐ | |
| P11-M0-T2 | Unified approvals + approver policy | 2.1–2.8 | ☐ | |
| P11-M0-T3 | All executions through the gateway (checks preserved) | 3.0–3.8 | ☐ | |
| P11-M0-T4 | Real proposal execution & compensation | 4.1–4.6 | ☐ | |
| P11-M0-T5 | Durable workflow approvals | 5.1–5.5 | ☐ | |
| P11-M0-T6 | Memory SSOT | 6.0–6.9 | ☐ | |
| P11-M0-T7 | No hardcoded fallbacks / module state | 7.1–7.6 | ☐ | |
| P11-M0-T8 | Verification, canary, runbooks, report | 8.1–8.6 | ☐ | |

### 15.2 Mapping to the master plan

| Master task | M0 task(s) |
| --- | --- |
| P11-M0-T1 Memory SSOT | T6 (+ T0) |
| P11-M0-T2 Route through `executeCapability` | T1, T3 |
| P11-M0-T3 Real proposal execute/rollback | T4 |
| P11-M0-T4 Approvals | T2, T5 |
| P11-M0-T5 Remove fallbacks / Maps | T7 |
| P11-M0-T6 Binding + hash-chained audit | T2, T0.8 |
| *(new, F1/F14)* | T0 |

### 15.3 Follow-ups (not M0)

- A registry-consistency test plus fixes for the Phase 9/10 matrices referencing unregistered capabilities (`knowledge.memory.query`, `crm.account.get_context`, `crm.timeline.get_events`, `deal.pipeline.get`, `crm.lead.enrich`, `crm.outreach.draft_email`, `crm.calendar.schedule_meeting`).
- Command-bar EXECUTE/AUTOMATE façades.
- A separate staging Firebase project (D5).
- General event-bus durability for outbox consumers across instances.

---

## 16. Next Step

Confirm D5–D7 (and master D1–D4). Then start T0.1 with the failing storage-mode test, committing locally after each green step.
