# Phase 11 · Milestone 2: Code Review (checkpoint after T0–T2)

**Reviewer role:** Senior Principal Systems & AI Agent Architect
**Date:** 2026-10-05
**Scope:**
- M2 · T0 (M1 review fixes): content in `7e468039`, provenance in `099cf8a8`.
- M0 · T3 (governed execution for internal callers): `052809b1`.
- M2 · T1 (personas and matrices): `bcda1853`.
- M2 · T2 (grounded prep brief): `38fe3538`.

These are checked against [plan v1.1](agents_mcp_phase_11_milestone_2_plan.md), the [M0 plan](agents_mcp_phase_11_milestone_0_plan.md) and `agents_mcp_rules.md`.

**Verdict: on track in sequence, but not ready to build T3 yet.**
- **T0 and T1** are correct.
- **T2** does what the plan asks: every kept item is cited, foreign or invented ids are dropped, and facts-only covers five of the plan's cases. It misses the most common failure, a slow model (R3), and it under-reads history (R4).
- **M0 · T3** moved the platform paths onto the gateway, but it **broke saga compensation** for any real compensating capability (R2, proved with a probe).
- The review found that **the legacy MCP endpoint still runs every registered capability without the gateway** (R1). The new meeting tools are exposed there despite "MCP off until T8".

Fix R1–R3 before T3. T3 adds more L1 capabilities that would inherit both gaps.

---

## 1. Evidence checked

| Check | Result |
| --- | --- |
| Platform + meetings Vitest | 2,032 of 2,035 pass. Failures: registry-unification (13 vs 12) and tasks-client-migration ("Phone is not defined"), plus a third I didn't trace before committing |
| Typecheck / lint (touched files) | 0 errors in M2 files (14 in older files) / lint clean |
| Saga compensation probe | Fixture changed from `permissions: []` to `['rbac:operations.meetings.edit']`: **refused**, `AUTHORIZATION_DENIED … Missing required permission scope` (R2) |
| Handler deadline | Gateway step 13 enforces `maxDurationMs` with `runWithTimeout` (20 s for the brief) (R3) |
| Retention sweep for new workspaces | `compliance-policy-store.ts:137` writes `retentionLastRunAt: ''`, so `'' < cutoff` matches. ✅ |
| Consent re-key (R4 from M1) | Only `consent-store.ts` reads `meeting_consents`. The rule is deny-all (server only). ✅ |
| Reaper index | `meeting_transcripts (status ASC, updatedAt DESC)` exists. ✅ |
| New collections | `meeting_brief_usage` falls under the base deny-all rule. ✅ |
| Legacy MCP path | `/api/mcp` → `McpGateway` → `globalMcpRegistry.getTool()` → synthesised wrapper → `cap.handler()`. The store is `canonicalCapabilityRegistryStore` (R1) |
| Agent loop | `AgentExecutionLoop` has no production importers, so R6 is latent |

---

## 2. Plan conformance

| Task | Status | Notes |
| --- | --- | --- |
| T0 · M1 review fixes R1–R7 | ✅ | Verified above. L1 (false DLQ entries) is new and small |
| M0 · T3 · gateway for internal callers | ◐ | Steps, workflow sagas and the Genkit adapter are correct. **Saga compensation regressed (R2).** Debt: legacy MCP registry (R1), agent loop (R6), sales actions, `lib/mcp` tools, approval engine |
| T1 · personas + matrices | ✅ | One matrix row overstates enforcement (L2) |
| T2 · grounded prep brief | ◐ | Tests 2.2 all present. Gaps: deadline (R3), history lookup (R4), cost/telemetry/TTL (R7) |
| M0 · T2/T4/T5 · approvals, real execute, compensation | ☐ | Required before T4.3. M0 F5 is still live: any signed-in org member can approve |
| T3–T8 | ☐ | |

---

## 3. Findings

Severity:
- **High:** fix before the next task builds on it.
- **Medium:** fix within M2.
- **Low:** polish.

### R1 · High · Legacy `/api/mcp` runs every canonical capability without the gateway

- **Where:** `src/lib/mcp/registry.ts:355-385`. `getTool()` synthesises a wrapper for any capability in `canonicalCapabilityRegistryStore` and calls `cap.handler()`.
  - The principal is made up: `grantedScopes: ['tools:<id>']`, `effectiveRole: 'mcp_caller'`.
  - `/api/mcp/route.ts` → `McpGateway.handleRequest` → `registry.getTool(name)`.
- **Effect:** once any Server Action has run `ensureCapabilitiesRegistered()` in the instance, an MCP API-key holder can call all of these:
  - `meeting.get_transcript`;
  - `meeting.ingest_transcript`;
  - `meeting.generate_prep_brief`;
  - **`meeting.transcribe_recording`**, which is `defaultEnabled: false` and costs money.

  Skipped:
  - flags (Rule 64; the plan's "MCP off until T8"; `automatedRequiresExplicitFlag`);
  - permission intersection;
  - resource scope;
  - live standing;
  - idempotency;
  - gateway audit and outbox.

  Handler-level checks still hold:
  - workspace binding;
  - consent;
  - quota;
  - data policy.

  So this is a governance bypass, not a cross-tenant leak.
- **Fix (small):**
  - The synthesised wrapper calls `invokeGoverned({ surface: 'mcp', principal })`. The principal comes from the API key's workspace and its real scopes, never `tools:<id>`.
  - Until then, `getToolDescriptors()` lists only legacy tools.
- **Test:** `tools/call meeting.transcribe_recording` through `McpGateway` is refused without an explicit MCP flag, and `meeting.*` isn't listed.

### R2 · High · Saga compensation is refused for every real compensating capability (M0 · T3 regression)

- **Where:** `src/platform/runtime/governance/saga-compensation.ts:196-236`. The engine builds its own principal:
  - `grantedScopes: [compCapId]`;
  - `effectiveRole: 'admin'`;
  - `workspaceId: effectiveWorkspaceId || ''`.

  It also passes `{ ...compArgs, input: compArgs, ...execContext }` as the **input**, so the principal and a fresh timestamp end up inside the payload.
- **Effect:**
  - Before T3, the handler ran directly: it worked, but ungoverned.
  - Now the gateway checks permissions and refuses every compensating capability that declares one. Proven by the probe above.
  - The tests pass only because the fixtures use `permissions: []`.
  - Rollback (Rule 27) fails for real capabilities. It's reported as `COMPENSATION_FAILED`, so failures are loud but nothing is undone.
  - This blocks the T4 undo and CRM rollback.
- **Fix:**
  - Use the run's stored authorizing principal, the way `workflow-saga-engine.ts` uses `storedPrincipal`. With none stored, refuse.
  - Never use `'admin'` or a capability id as a scope.
  - Send only `compArgs` as input.
- **Test:** the fixtures carry real `rbac:` permissions. A run whose authorizer lacks the scope is refused; one whose authorizer has it is compensated.

### R3 · High · A slow model makes the brief fail instead of going facts-only

- **Where:** `prep-brief-service.ts` (`generatePrepBrief`). It has no deadline of its own. The gateway kills the handler at 20 s (`13-execute-handler.ts:64`) and returns `TIMEOUT`.
- **Effect:**
  - A reasoning-tier call with up to 30k tokens of context often takes 10–30 s. This is the most common failure mode, and plan §4.5/§5 promise facts-only for it.
  - The person instead gets an error, and the abandoned model call keeps running and is billed.
  - A slow Account360 load has the same effect.
- **Fix:**
  - Give Account360 its own 3 s deadline and the model call a 12 s deadline, via `AbortSignal` or `Promise.race`.
  - On expiry → `facts_only`, adding a new reason `timeout` to `FactsOnlyReasonSchema`.
  - Pass the signal to Genkit `generate` where it's supported.
- **Test:** a never-resolving fake model gives `facts_only/timeout` in under 15 s.

### R4 · Medium · History misses older meetings with the record

- **Where:** `priorMeetingSources` → `searchMeetings({ entityId, limit: 6 })`. That scans only the **24 newest** meetings in the workspace (`limit*4`) and filters by entity in memory.
- **Effect:** in a busy workspace, the brief shows no history even when there are earlier meetings with this record.
- **Fix:**
  - Query directly: `workspaceIds array-contains` + `entityId ==` + `meetingTime <` + `orderBy meetingTime desc` + `limit 6`.
  - Add the index.
- **Test:** 30 newer unrelated meetings plus 1 older meeting with the record → it appears.

### R5 · Medium · Idempotency keys aren't bound to the input (M0 · T1 carry-over, now reachable)

- **Where:** `pipeline/10-check-idempotency.ts`. A `completed` record is replayed by key alone; `inputHash` is computed but never compared.
- **Effect:** workflow steps now use deterministic keys (`wf_{workflowId}_{stepId}`). If a step's input is re-resolved differently on retry, the old result is returned for a different request (Rule 19).
- **Fix:**
  - Store `inputHash` with the lease.
  - On mismatch → `IDEMPOTENCY_KEY_REUSED` (409, not retryable).
- **Test:** same key, different input → refused.

### R6 · Medium (latent) · The agent loop still bypasses the gateway

- **Where:** `agent-execution-loop.ts:327-345`. It calls `capability.handler(planStep.arguments, …)` with **unvalidated input** and `grantedScopes: persona.allowedDomains.map(d => \`${d}:*\`)`, which are wildcard scopes (Rule 16).
- **Effect:** nothing imports it today. Wiring any meeting agent run to it (T5 shadow mode) would skip flags, consent gates, schema validation and audit.
- **Fix:** migrate it with M0 · T2. That needs the unified approval verifier, which is why it was reverted in `052809b1`.
- **Gate:** add it to the T5 entry criteria.

### R7 · Medium · Prep brief cost, telemetry and quota hygiene

- **Usage isn't recorded:** `response.usage` (input/output tokens) is ignored. There's no per-org cost ceiling (plan §5) and no metering (Rule 9).
- **Prompt hash isn't recorded** (plan §6, Rule 36). Only `prep_brief_v1` is.
- **Facts-only outcomes are invisible:** reasons aren't counted or logged, so an open breaker or a policy denial can't be seen in operations.
- **Account360 failures are silent:** `loadAccountContext(...).catch(() => null)` hides them. That includes a paused dead-man switch.
- **No TTL on the quota collection:** `meeting_brief_usage.expiresAt` is an ISO string, but Firestore TTL needs a `Timestamp`, and no TTL policy exists. Unbounded growth (Rule 9; M0 T0.9).
- **Quota is used even when the breaker is open.** Check the breaker before consuming.

### R8 · Medium · `invokeGoverned` trusts any pinned definition

- **Where:** `invoke-governed.ts:77-83`. A caller-supplied `capability` overrides the registry for that id, whatever its contents.
- **Effect:** an internal caller holding a stale or edited definition (lower risk, fewer permissions) is governed by that copy, not by the reviewed one (Rules 12, 14).
- **Fix:**
  - When the registry has the id, require the same object, or the same version plus fingerprint. Otherwise refuse with `CAPABILITY_VERSION_MISMATCH`.
  - Allow pinning an unregistered id only via injected test deps.

### Low

- **L1 · False dead-letter entries.** `transcription-service.ts` `terminal()` writes `meeting_transcription_dlq` even when `markTranscriptTerminal` refused the transition. For example, the reaper runs just as the worker completes. Return a "transitioned" flag and write the DLQ entry only when it's set.
- **L2 · One `MEETING_NEVER` row overstates enforcement.** The row says "approval store refuses agents". Agents are refused only because approval is a session-authenticated Server Action. Any signed-in org member can approve (M0 F5). Correct the text and keep F5 as a T4.3 blocker.
- **L3 · No trust label on brief output.** The brief is model text derived from customer data. Add `trust: 'model_generated_from_customer_content'`, as `get_transcript` does (Rules 13, 30, 48), and render it as text only in T6.
- **L4 · Meeting entries aren't deduplicated.** A timeline entry about a meeting gets `timeline_meeting:{id}`, so it doesn't merge with `meeting:{id}`. Map meeting `sourceRef`s into the meeting id space.
- **L5 · Brief reads exceed the plan's budget.** The Account360 assembler reads up to about 8 × 50 records against the plan's `maxRecordsRead` of 100 for the brief. Either tighten it (pass `maxTokens` and per-store caps) or record the deviation.
- **L6 · Fingerprint baseline update accepted.** It was updated in the same commit (`38fe3538`). This review covers the description, schema, permission and risk of `meeting.generate_prep_brief@1.0.0`.

---

## 4. What is good

- **T2 grounding:** the model can cite only ids from the selected set.
  - An item with any unknown id is dropped and counted.
  - Foreign meetings never reach the prompt.
  - Facts-only items cite exactly one real source.
  - The red-team cases are in the tests.
- **Fail-closed tenancy:** an Account360 package for another workspace or record is ignored entirely. Prior-meeting items are re-checked per item for workspace and meeting.
- **Prompt injection:** source text sits in a delimited data block, and the closing delimiter is stripped from customer text.
- **Flags:** people are on, and agents and MCP need an explicit flag. A gateway test proves the refusal reason (the R1 legacy path aside).
- **M0 · T3:**
  - Workflow steps use the stored principal and deterministic keys.
  - Refusals are classified, so authority and validation failures are never retried.
  - The grep-gate ratchet stops new direct `handler()` calls.
- **T0:** the retention cadence, cursor and derived-data cascade, quota reservation and settlement, and the reaper are all well tested.

---

## 5. Required actions

**Before T3:**
1. **R1:** govern or hide canonical capabilities on the legacy MCP path.
2. **R2:** saga compensation uses the stored principal and clean input; fixtures use real permissions.
3. **R3:** internal deadlines in the brief → `facts_only/timeout`.
4. **R4:** direct entity query for prior meetings, plus its index.
5. **R8:** `invokeGoverned` pin check.

**Within M2:**
6. **R5:** bind idempotency keys to the input hash. Do this before T3's pipeline relies on step keys.
7. **R7:** usage metering, prompt hash, facts-only telemetry, a TTL `Timestamp`, and checking the breaker before the quota.
8. **L1–L5.**

**Gates:**
- **R6** (agent loop on the gateway) is an entry criterion for T5 shadow mode.
- **M0 F5** (approver policy) and **M0 · T4** (real execute and compensation) are entry criteria for T4.3.

**Still outstanding from M1:** deploying the T0 security hotfixes (G1/G2 are live in production) needs written approval.

---

## 6. Overall

- **Direction is right:** the brief is honest by construction, and the platform is converging on one governed path.
- **What still needs closing:**
  - one legacy door (R1);
  - a regression introduced by the very change meant to close the doors (R2);
  - the brief's handling of time (R3).

  All three are small, well-bounded fixes. Once they're in, with R4 and R8, T3 can start on solid ground.

---

## 7. Resolution (2026-10-05)

| Finding | Status | Commit | Proof |
| --- | --- | --- | --- |
| R8 · pin check | ✅ | `979fb6ee` | 4 tests. A pin differing in version, fingerprint, policies, execution or scoping → `CAPABILITY_VERSION_MISMATCH`, nothing runs |
| R2 · saga compensation | ✅ | `78e1ce64` | 5 tests with **real permissions**. Runs as the run's delegated agent (authorizing user + persona permissions); input is exactly the compensation arguments; fails closed for a missing run, another workspace or an unknown persona |
| R1 · legacy MCP | ✅ | `cd267f1c` | 6 tests, 5 of which fail on the old code. API keys refused (pointer to `/api/mcp/v2/{domain}`). Others run as the verified acting user via `invokeGoverned` on the `mcp` surface. Explicit-MCP flags enforced. Ratchet 3 → 2 |
| R3 · brief deadlines | ✅ | `0d47b959` | 3 tests. A hanging model → `facts_only/timeout` and the signal is aborted. A hanging record context is skipped. Capability `1.1.0`; fingerprint baseline reviewed (one key) |
| R4 · history lookup | ✅ | `0ea62e22` | 2 tests (30 newer unrelated meetings; no later meetings). Direct indexed query, plus a new composite index |

**Decisions taken while fixing:**
- **R8:** an id the registry doesn't hold may still be pinned. It impersonates nothing, every gateway check still runs, and the caller already holds the handler in process. This narrows §3 R8's "test deps only"; the protection that matters (a registered id can't be weakened) is in place.
- **R1:**
  - The scope logic was extracted to `principalFromProfile`, so sessions and the legacy bridge compute authority identically.
  - Internal callers (supervisor, legacy workflows, specialists) keep working as the user they act for.
  - API-key callers lose access to platform capabilities on v1 and must use the governed v2 endpoint, where key scopes are mapped. Legacy (non-platform) tools are unchanged.

**Regression run:** platform + lib suites pass 6,822; 3 fail:
- the known registry-unification failure (13 vs 12);
- 2 in `automation-misc-actions` from another author's commit `6611dc97`, whose test mock lacks `.get`.

**Deploy note:** the new `meetings (workspaceIds CONTAINS, entityId ASC, meetingTime DESC)` index ships with the other pending index changes. That still needs written approval.

**Next:** R5 (idempotency bound to input) before T3, then T3. R6 stays a T5 gate. R7 and L1–L6 within M2.

