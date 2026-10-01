# Phase 1 — Build Plan (Canonical Domain Capability Layer)

**Status: APPROVED 2026-09-29.** Decisions:
- P-D1 = A: the 1.1b hotfix goes first, as its own PR.
- P-D2 = A: flags reuse `platform_features`.
- P-D3 = A: evolve `/admin/companybrain/tools`.
- P-D4 = B: include Context Action System v1.
- P-D5 and P-D6 at their recommended defaults (A).

**Rules conformance (2026-09-29):** checked against `agents_mcp_rules.md`. The architecture is on track; amendments **A1–A20** (§11) are part of this plan, and progress is tracked in §12.
Parents:
- [agents_mcp_phase_1_plan.md](./agents_mcp_phase_1_plan.md): **APPROVED**. Decisions D1–D6 stand unchanged.
- [agents_mcp_phase_1_1a_review_fixes_plan.md](./agents_mcp_phase_1_1a_review_fixes_plan.md): implemented.

The approved Phase 1 plan says **what** Phase 1 delivers, at workstream level. This document is the executable **how**: current state, verified again on 2026-09-29; files; designs; PR order; tests; and the **UI changes** for each workstream. Where the code disagrees with the approved plan, it is recorded in §1.2 and resolved here.

**Sources re-read for this plan:**

| Source | Sections |
| :--- | :--- |
| Roadmap | Phase 1, §4 tool contract, §25 generated docs, §33 migration rule, §34 release gates, §36 phase map |
| Rules | 4, 11, 16–22, 39–40, 53, 60–69; §66 Phase 1 contracts; §67 implementation gate |
| Tools doc | §4 execution architecture, §4.1 registry, §6.3 execution envelope, §7 coverage, §10 P1 |
| UI doc | §8–9 command center, §43 capability registry UI, §50 risk treatment, §53 error states, §62 state discipline, §65 conflicts, §67–72 accessibility, §80 object command menu, §82 phase map |
| PRD | §73 middleware order, §47 tool definition, §128 invariants |
| Idea, Cloud Run | "Agents operate tools, never Firestore"; stateless execution, Cloud Tasks, 32 MB |
| `docs/agentic/` | `05-permission-model`, `13-uiux-architecture`, `14-migration-plan` |
| Plans | Phase 0 plan §6; Round 2–4 reviews |

---

## 1. Where we actually are (verified 2026-09-29)

### 1.1 Status by workstream

| Item | Status | Evidence |
| :--- | :--- | :--- |
| Phase 0 platform (`src/platform/**`) | Built and tested, **not committed, not certified** | Baseline 444 tests. The Phase 0 plan §6 list is still open. |
| 1.1a portal / task / quick-notes auth hotfix | Implemented, uncommitted | Plan §1.1a |
| Round 4 review fixes, items 1–6 | Implemented, uncommitted | Full suite 690 files / 5,233 tests; rules 39 |
| 1.0, 1.1 (rest), 1.2–1.9 | **Not started** | — |
| Round 4 item 7 (PR split) and the export-sweep test | Open | — |

### 1.2 New findings from this planning pass

These change the plan. Each was confirmed by reading the code.

| # | Finding | Severity | Where it lands |
| :--- | :--- | :--- | :--- |
| **N1** | **Much of the CRM core that Wave B wraps is unauthenticated** (details below). | **Critical, live** | New workstream **1.1b** (urgent, separate PR) |
| **N2** | **The MCP governance actions trust caller identity** (details below). | **Critical, live** | 1.1b |
| N3 | The inventory missed two more agent subsystems that call `McpGateway.handleRequest`: `src/lib/workflows` (workflow engine) and `src/lib/supervisor`. In `base-domain-specialist.ts:180`, domain specialists label their calls `callerType: 'user'`, so an agent runs as its human. | High | 1.0 scanner; 1.3 / 1.7 identity |
| N4 | `/api/mcp` takes `organizationId` from the unverified `x-organization-id` header for session callers (`route.ts:46,88`). | High | 1.7 |
| N5 | A platform feature-flag store with a backoffice editor already exists: `platform_features`, with `killSwitch`, `rolloutRules` and `orgOverrides`, edited through `backoffice-feature-actions.ts`. **Nothing evaluates it at runtime.** | Design | 1.6 reuses it (P-D2) |
| N6 | There are **three** approval stores: `mcp_pending_approvals` (MCP engine), `capability_approvals` (Phase 0 verifier) and `platform_approval_requests` (backoffice dual control through `approval-registry.ts`). | Design | 1.6 / 1.7 (P-D5) |
| N7 | The permission vocabulary has two shapes. Flat `APP_PERMISSIONS` ids (`tasks_manage`, `tags_apply`, …) and hierarchical coordinates checked through `canUser(uid, section, feature, action)`: tasks use `operations/tasks/*`, entities `operations/campuses/*`, deals `operations/pipeline/*`. Capability permission ids must express both. | Design | 1.3 (P-D6) |
| N8 | The Round 4 cross-phase issues are all still open. | High | 1.0 / 1.2 / 1.3 |
| N9 | UI: there is no global command palette; only `PortalStudioCommandPalette` and the shadcn `ui/command.tsx` exist. The tenant tools screen is `/admin/companybrain/tools`, with tabs Catalog, Approvals, Keys and Telemetry. The backoffice already has `companybrain` (2.7k-line client), `approvals`, `features` and `audit`. Critical-journey E2E coverage does not exist: `src/e2e` has 6 specs, none for CRM create/edit. | Design | §5 (UI) |

**N1 in detail.** Confirmed exports:

| Area | Exports | What's wrong |
| :--- | :--- | :--- |
| `src/lib/entity-actions.ts` | `createEntityAction`, `updateEntityAction` | Caller-supplied `userId`; any `system-*` value skips the permission check; `data: any` |
| `src/lib/workspace-entity-actions.ts` | `linkEntityToWorkspaceAction`, `updateWorkspaceEntityAction`, `ensureEntitySharedToWorkspace`, `bulkArchiveEntitiesAction`, `bulkDeleteEntitiesAction` | No check at all. Includes cross-workspace sharing and bulk deletion. |
| `src/app/actions/deal-actions.ts` | `createDeal`, `updateDealValueAction`, `updateDealStatusAction`, `updateDealOwnerAction`, `resolveWorkspaceEntityRecord` | No check |
| `src/app/actions/deal-actions.ts` | `updateDealStageAction` | Checks permission only if the caller passes a `userId` |
| `src/lib/note-actions.ts` | `logNoteActivity`, `getEntityAiSummary` | Unguarded; the second is an unmetered AI call over any entity |
| `src/lib/activity-actions.ts` | `getActivitiesForContactCore` | A "core" exported from a `'use server'` module, so any contact's timeline is readable |

These functions have 30+ trusted server-side callers (imports, surveys, forms, automations, deal automations). Simple guards would break those callers, so the fix is a core/wrapper split, as was done for tasks.

**N2 in detail.** In `src/lib/mcp/actions/mcp-governance-actions.ts` (`'use server'`), every export takes `userId` / `organizationId` from the caller. `checkWorkspaceAccess` is called with its arguments **swapped** (`(workspaceId, userId)` against the signature `(userId, workspaceId)`). Its result object is then tested as `if (!hasAccess)`, which is always truthy, so **the check can never deny**. Anyone can:
- mint MCP API keys for any workspace;
- adjudicate pending approvals;
- change approval policies;
- execute tools as another user.

**N8 in detail.** Still open from Round 4:
- the worker's "re-authorization" re-checks a snapshot of the principal, not live RBAC;
- the worker writes no audit and doesn't enforce idempotency or version;
- the approval is bound before the authority check;
- `NON_DELEGABLE_ACTIONS` uses dotted ids that never match D6 ids;
- the registry accepts `permissions: []`;
- the MCP path has no timeout, and the idempotency key has no TTL;
- the hardcoded Cloud Tasks secret is still there and OIDC isn't verified;
- `TaskActor.system` skips all permission checks;
- `requirePortalAdmin` means any staff member of the organization.

### 1.3 What that means

Phase 1 cannot wrap Wave B while N1 and N2 are open, because it would launder those holes into the agent layer (approved plan §2.2). So the first build step is another urgent, separate hotfix PR, **1.1b**, mirroring 1.1a. After that the approved order applies, with the Round 4 issues folded into the workstreams they belong to.

---

## 2. New decisions needed

The approved decisions D1–D6 stand. These six are new, raised by the findings above.

| # | Question | Options | Recommendation |
| :--- | :--- | :--- | :--- |
| **P-D1** | Ship the N1 and N2 fixes as an urgent hotfix PR ahead of Phase 1, as with 1.1a? | **A.** Yes, 1.1b first. **B.** Fold them into 1.1 / 1.5 Wave B. | **A.** Both are exploitable today; B would leave them open for weeks. |
| **P-D2** | Where do the three-level capability flags live? | **A.** Reuse `platform_features` (one doc per capability, key `capability:<id>`) and its backoffice editor, add workspace overrides, and add the missing runtime evaluator. **B.** New `capabilityFlags` fields on org and workspace docs plus `system_settings/ai_config` (as the approved plan sketched). | **A.** Rule 69 says one mechanism. `platform_features` already has a kill switch, rollout rules, org overrides, approval-gated kill switches and an audited editor. The only thing missing is runtime evaluation, which A adds and which also makes today's platform features real. |
| **P-D3** | Tenant-facing capability admin (UI §43 puts it at `/settings/ai/capabilities`) | **A.** Evolve the existing `/admin/companybrain/tools` Catalog tab onto the canonical registry. Add `/admin/settings/ai/capabilities` as a redirect. **B.** A new page, and deprecate the tools page. | **A.** Same users, same job, and components already exist (`ToolCatalogTable`, `PendingApprovalsQueue`, `McpApiKeysCard`, `McpAuditLogViewer`). B duplicates them. |
| **P-D4** | UI scope beyond D4(a) plumbing | **A.** D4(a) only: invocation framework plus three proof-point buttons. **B.** D4(a) plus a **Context Action System v1** (the UI §82 Phase 1 item and §80's Object Command Menu without its AI entries): a capability-driven action menu on the entity, deal and task surfaces, filtered by permission and flags. The Global Command Bar stays out: its planning and executing states (§9 C–E) need the agent runtime. | **B.** It is the UI doc's Phase 1 deliverable and needs only the registry, principal and flags that Phase 1 builds anyway. It also gives agents and humans a visibly shared action vocabulary before Phase 8. Cost: about one extra M-size PR. |
| **P-D5** | Three approval stores | **A.** `capability_approvals` replaces `mcp_pending_approvals` (D5). `platform_approval_requests` stays separate: it is platform-operator dual control over backoffice operations, a different trust domain. This is a documented exception to Rule 69, revisited in Phase 3. **B.** Merge all three now. | **A.** Merging the backoffice dual-control flow is Phase 3 (policy / delegation) work with no Phase 1 payoff. |
| **P-D6** | Capability permission reference format | **A.** Typed references: `app:<APP_PERMISSION_ID>` (flat) or `rbac:<section>.<feature>.<action>` (hierarchical). Both resolve through the existing engine. **B.** Flat ids only; add new `APP_PERMISSIONS` ids for everything. | **A.** Tasks, deals and entities are checked by coordinates today. B would force a permission migration and break parity. |

---

## 3. Build order (PRs and milestones)

Each PR goes through `tsc`, lint, the affected suites and the baseline, and pushes only when you ask (standing rule). Sizes: S ≤ 1 day, M 2–4 days, L 1–2 weeks.

| PR | Contents | Size | Depends on | Milestone |
| :--- | :--- | :--- | :--- | :--- |
| **PR-0** | Round 4 item 7: split the working tree into (a) SSRF guard + `undici` + lockfile, (b) Phase 0 platform, (c) 1.1a + Round 4 fixes. Add the export-sweep guard test (§4.0.3). | M | — | **M0 Clean base** |
| **PR-1** | **1.1b** CRM + MCP-governance hotfix (§4.1b) | L | PR-0(c) | **M1 Holes closed** |
| **PR-2** | **1.0** Phase 0 closure: Cloud Tasks secret + OIDC; worker live re-auth; approval-bind order; registry validation; `NON_DELEGABLE` remap; scanner and metric fix (§4.0) | M | PR-0(b) | **M2 Foundation certified** |
| **PR-3** | **1.1** remainder: portal permission ids (D6) and the `requirePortalAdmin` role check; lint rule widened | M | PR-1 | M2 |
| **PR-4** | **1.2** execution gateway + error contract (§4.2) | L | PR-2 | **M3 Gateway** |
| **PR-5** | **1.3** principal resolvers + parity suite (§4.3) | M | PR-4 | M3 |
| **PR-6** | **1.4** execution records, audit, outbox, rules tests (§4.4) | M | PR-5 | M3 |
| **PR-7** | **1.6a** runtime flag evaluator on `platform_features` + kill switch (§4.6) | M | PR-4 | M3 |
| **PR-8** | **1.8a** UI invocation framework (`invokeCapabilityAction`, `useCapability`, state components) (§5.1) | M | PR-6, PR-7 | **M4 First capability live** |
| **PR-9** | **1.5 Wave A** (identity, 5 capabilities) | M | PR-6 | M4 |
| **PR-10** | **1.5 Wave B-1**: tasks + tags + notes/activities; UI proof points "Create task" and "Add tag" (§5.2) | L | PR-8, PR-9 | M4 |
| **PR-11** | **1.5 Wave B-2**: entities + deals + pipelines; UI proof point "Advance deal stage"; CRM E2E journeys (§5.7) | L | PR-10 | **M5 CRM on the gateway** |
| **PR-12** | **1.7** CompanyBrain MCP consolidation (§4.7) + tenant tools page onto the registry (§5.4) | L | PR-11 | **M6 One registry** |
| **PR-13** | **1.6b** backoffice control plane: capabilities, executions/audit, approvals (§5.5) | M | PR-12 | M6 |
| **PR-14** | **Context Action System v1** (P-D4 B) (§5.3) | M | PR-11 | M6 |
| **PR-15** | **1.5 Wave C** portals (7 capabilities) | M | PR-3, PR-12 | **M7 Portals** |
| **PR-16** | **1.9** generated docs + structured telemetry; release-gate evidence (§7) | S | throughout | **M8 Phase 1 exit** |

```text
PR-0 ─► PR-1 (1.1b) ─► PR-3 (1.1)
   └──► PR-2 (1.0) ─► PR-4 (gateway) ─┬─► PR-5 ─► PR-6 ─┬─► PR-9 (Wave A) ─► PR-10 (B-1) ─► PR-11 (B-2) ─┬─► PR-12 (MCP) ─► PR-13 (backoffice)
                                       └─► PR-7 (flags) ─┴─► PR-8 (UI framework) ─┘                          ├─► PR-14 (context actions)
                                                                                                             └─► PR-15 (Wave C, also needs PR-3)
PR-16 (docs/telemetry) runs alongside from PR-9 onward.
```

---

## 4. Workstreams in detail

### 4.0 — Entry: close Phase 0 and the Round 4 carry-overs (PR-0, PR-2)

1. **PR split (PR-0).** Three branches:
   - (a) the SSRF prerequisite: `ssrf-guard.ts`, `safe-url-fetch.ts`, `undici@7`, the lockfile and `ssrf-guard.egress.test.ts`;
   - (b) the Phase 0 platform: `src/platform/**`, scripts, `membership.ts` schema, `gcp-tasks-client.ts`, the agent-step route, and the Phase 0 `package.json` hunks;
   - (c) 1.1a and the Round 4 fixes.

   Unrelated work in the tree (`api/call-centre/webhook`, `api/organizations/scrape`, `skills-lock.json`, stray `.docx`) is excluded. Each branch must build and pass on its own. Order: a → b → c.
2. **Phase 0 security closure (PR-2):**
   - Remove the literal secret from `gcp-tasks-client.ts:8` and the dev-secret branches of `cloud-tasks-auth.ts`. Fail at startup if `CLOUD_TASKS_SECRET` is unset in production. Compare with `timingSafeEqual`.
   - Verify the Cloud Tasks **OIDC** token in `/api/tasks/agent-step`: audience plus the service-account email, using `google-auth-library`'s `OAuth2Client.verifyIdToken`, which is already a transitive dependency. Confirm with Context7 before coding.
   - Rotating the secret is an operational step (see [[phase0-rotation-outstanding]]). It needs your approval and is listed in §8.
3. **Export-sweep guard test.** `src/platform/__tests__/security/server-action-guard-sweep.test.ts`:
   - Statically parse every `'use server'` module under `src/app/actions`, `src/lib` and `src/app/**/actions`.
   - Every exported async function must either call an approved guard (`require*`, `authenticateApiRequest`, `authorizeBackoffice`, `resolvePortalViewer`) or be listed in `PUBLIC_SERVER_ACTIONS` with a one-line justification.
   - New unguarded exports fail CI. Today's known gaps are listed in a shrinking `KNOWN_UNGUARDED` baseline that may only get smaller.

   This test replaces the audit metric blind spot (approved plan §2.2) for good, and it is the enforcement for N1 and N2 going forward.
4. **Worker and policy fixes (Round 4):**
   - `agent-step-executor.ts`: re-resolve the principal from live RBAC before execution (through the 1.3 resolvers once they land; until then, refuse if the principal's user is no longer `isAuthorized` or lost the workspace). Evaluate authority **before** binding the approval. Refuse `auditRequired` capabilities until the 1.4 audit exists.
   - `risk-levels.ts`: remap `NON_DELEGABLE_ACTIONS` to D6 references (`app:system_admin`, `app:contracts_delete`, `rbac:management.users.edit`, …). The test asserts that every entry exists in the vocabulary.
   - `capability-registry.ts` `registerCapability`: validate the definition. Require non-empty `permissions` unless `public: true` is declared with a reason; permission references must parse; the version must be SemVer; `risk.level` must be in `RISK_LEVELS`; L3/L4 must set `requiresHumanApproval`.
5. **Inventory scanner:**
   - Extend it to `src/lib/mcp`, `src/lib/agents`, `src/lib/memory`, `src/lib/workflows` and `src/lib/supervisor`.
   - Count every `'use server'` export, whether or not it touches `adminDb`, sharing the same parser as the sweep test.
   - Regenerate `docs/agentic/inventory.json` and the matrix.
- **Exit:** the three branches are green on their own; the sweep test is in CI with its baseline recorded; Phase 0 §6 security items are closed; Phase 0 is certified, apart from the documentation items explicitly deferred with a reason.

### 4.1b — Urgent hotfix: CRM core and MCP governance (PR-1)

Same method as 1.1a and the audit Phase 4 lesson: the **core** lives in a non-`'use server'` module and takes an explicit actor; the `'use server'` export becomes a thin wrapper that derives identity from the session; trusted server callers import the core.

| Module (new, NOT `'use server'`) | Moves out of | Actor handling |
| :--- | :--- | :--- |
| `src/lib/crm/entity-core.ts` | `createEntityAction`, `updateEntityAction` | `CrmActor = { kind: 'user', uid } \| { kind: 'service', service, scopes }` (see 4.3.4; no blanket bypass) |
| `src/lib/crm/workspace-entity-core.ts` | `linkEntityToWorkspace`, `updateWorkspaceEntity`, `ensureEntitySharedToWorkspace`, `bulkArchive`, `bulkDelete` | Authorize against the **stored** workspace of each record; bulk operations refuse foreign ids (as the task bulk fix does) |
| `src/lib/crm/deal-core.ts` | `createDeal`, `update{Stage,Value,Status,Owner}`, `resolveWorkspaceEntityRecord` | `rbac:operations.pipeline.{create,edit}` against the deal's stored workspace; `updateDealStage` always checks |
| `src/lib/crm/activity-core.ts` | `getActivitiesForContactCore`, `logNoteActivity`, `getEntityAiSummary` | Reads require workspace access plus entity-in-workspace. The AI summary is session-only, and permission-checked for `rbac:operations.campuses.view` |

- **Wrappers.** Signatures lose their identity parameters (`userId`, `organizationId`, `actor`). Callers are found by the compiler, plus a manual grep for positional string shifts, since strings don't fail typecheck. Every positional change gets a named-object signature or a typed branded id, so the compiler catches it.
- **`organizationId` defaults** such as `'smartsapp-hq'` are removed; the org is derived from the workspace (the task-core pattern).
- **`data: any`** in `createEntityAction` is replaced by a Zod v3 schema (a Rule 4 boundary).
- **MCP governance (N2).** Every export derives identity with `requireWorkspace(workspaceId)`. The organization comes from the workspace, never the caller.
  - Minting keys, approval policies and adjudication additionally need `app:system_admin`, or a new `app:ai_governance_manage` permission added under D6.
  - Fix the swapped `checkWorkspaceAccess` arguments and test `.granted`.
  - Adjudication refuses self-approval (the requester can't approve their own request).
  - The admin tool runner executes through the gateway after 1.2; until then it keeps using `McpGateway`, but with the verified uid.
- **Tests.** For each wrapper: refuses anonymous callers; refuses a foreign workspace; ignores caller identity fields; trusted core callers still work (imports, surveys, forms, automations). The sweep baseline shrinks by the fixed exports. Existing CRM suites (entity, deals, pipeline, imports, forms `crm-integration`, automations) must stay green.
- **UI changes:** none visible. Call sites stop passing `userId` / `organizationId`. Pipeline, deal page, entity page, imports and the MCP tools page are smoke-checked in the browser.
- **Exit:** the N1 and N2 exports are guarded or moved into cores; the sweep test lists none of them.

### 4.1 — Rest of 1.1 (PR-3)

- Add `portals_view`, `portals_manage` and `portal_members_manage` to `APP_PERMISSIONS` and to the `mapLegacyPermissionToCoordinates` mapping.
- `requirePortalAdmin(portalId, need: 'view' | 'manage' | 'members')` checks the permission on top of same-organization staff. System admins bypass.
- **Existing-role migration.** Roles that manage portals today get the new ids through a one-off FER script, run in dry-run mode first, so nobody loses access on deploy.
- Widen the `no-restricted-syntax` identity-parameter lint rule to `src/lib/**/*actions*.ts` and `src/app/actions/**`.
- **UI:** the Roles editor shows the three new permissions under "Experience Portals". Portal Studio screens hide management controls a viewer can't use, showing a permission-denied state rather than failing on click.

### 4.2 — One execution gateway (PR-4)

**Layout:**

```text
src/platform/capabilities/
  execution/execute-capability.ts        # executeCapability(): the only entry point
  execution/invocation.ts                # CapabilityInvocation type + builders per surface
  execution/pipeline/*.ts                # one file per step (unit-testable)
  errors/capability-error.ts             # typed error contract + mappers
  validation/payload-size.ts
```

**Pipeline.** The order follows PRD §73 (authenticate → actor → tenant → permissions → arguments → resource scope → risk → approval → execute → audit), with the tools §4 additions:

| # | Step | Refusal code |
| :--- | :--- | :--- |
| 1 | Resolve the principal (1.3; surface-specific) | `UNAUTHENTICATED` |
| 2 | Look up the capability: pinned version, or latest | `NOT_FOUND` |
| 3 | Flags and kill switches (1.6): capability, org, workspace, agent/MCP switches, global autonomous switch | `DISABLED` |
| 4 | Payload size ≤ `maxPayloadSizeBytes`, **before** parsing | `VALIDATION` |
| 5 | Validate input (Zod v4) | `VALIDATION` |
| 6 | Tenant binding: the input may not name another org or workspace | `TENANT_SCOPE` |
| 7 | Resource scope: the capability's `resolveResourceScope(input, ctx)` loads the target record(s) and proves they belong to the principal's workspace/org | `NOT_FOUND` (never reveal existence) |
| 8 | Authorize: the evaluator runs permissions, risk and delegation rules against the **live** principal | `FORBIDDEN` |
| 9 | Approval: L3/L4 for agents needs a `VerifiedApproval`, bound only **after** step 8 passes | `APPROVAL_REQUIRED` (carries an approval-request id) |
| 10 | Idempotency: `requiresIdempotencyKey` is enforced; replay returns the stored result; a key seen `running` gives `DUPLICATE_IN_PROGRESS` | — |
| 11 | Concurrency: `requiresExpectedVersion` is enforced; the stored version is compared | `VERSION_CONFLICT` (carries the current version) |
| 12 | Dry run: returns a validated plan and no side effects, when `supportsDryRun` | — |
| 13 | Execute with a timeout (`timeoutMs`, capped by the surface budget) | `TIMEOUT` (**state unknown**, never "failed") |
| 14 | Validate output (a mismatch is an `INTERNAL` error; the result is **not** returned) | `INTERNAL` |
| 15 | One batch: execution record, audit record and outbox events (1.4) | — |
| 16 | Return a typed result | — |

**Contracts:**
- `CapabilityInvocation`: `{ surface: 'ui' | 'mcp' | 'agent' | 'automation' | 'task_worker' | 'api', correlationId, causationId?, idempotencyKey?, expectedVersion?, dryRun?, approvalId?, callDepth }`.
- **Every error carries `stateChanged: 'no' | 'yes' | 'unknown'`.** It is required by UI §53 ("tell the user whether state changed") and set by the gateway, not the handler: validation, authorization, flag and scope refusals are `'no'`; a timeout after dispatch is `'unknown'`; a handler failure after writes is taken from the handler.
- **Error mappers** to server-action results (`{ success: false, error, code, stateChanged }`), MCP JSON-RPC codes and HTTP statuses. Messages are user-safe; details stay server-side (audit F9).

**Refactors (no behaviour change):**
- `buildDomainMcpServer` and `processAgentStep` call `executeCapability`. Their existing suites must pass unchanged.
- The worker's own policy code is deleted, not duplicated.

**Performance budget:** gateway overhead ≤ 50 ms p95 for reads; the principal is memoized per request; flags cached ≤ 60 s.

**Exit:** the pipeline unit suite has a refusal test per step; the MCP and worker suites pass through the gateway; an overhead microbenchmark is recorded.

### 4.3 — Principals (PR-5)

1. **`resolvePrincipalFromSession(workspaceId)`**
   - `requireWorkspace`, then `grantedScopes`: every `app:` id the flat check grants, plus every `rbac:` coordinate the hierarchical schema grants.
   - Coordinates are enumerated from the user's `permissionsSchema` rather than probed one by one (a finite tree).
   - `actorType: 'user'`. Memoized per request.
2. **`resolvePrincipalFromPortalToken(idToken, portalId)`** (new, from Round 4).
   - Portal members have no session cookie. This resolver wraps `requirePortalMember` and grants only `portal.member.*` scopes, derived from membership, role and plan.
   - It lets member-facing portal capabilities use the gateway later (Wave C reads) without a second identity path.
3. **`resolvePrincipalForAgent(user, agentId, delegation)`**: user scopes ∩ the agent allowlist (Rule 16). `actorType: 'agent'`.
4. **Service principals replace blanket `system` bypasses.**
   - `resolveServicePrincipal(service: 'automation' | 'form_pipeline' | 'call_centre' | 'import' | 'mcp_agent_key', workspaceId)` returns `actorType: 'agent'`, `agentId: 'service:<name>'`, and an **explicit scope allowlist per service**, declared in `src/platform/capabilities/policy/service-principals.ts`.
   - `TaskActor.system` and the 1.1b `CrmActor.service` resolve through it once the gateway handles their calls. Until then the cores keep their explicit service actor, and the allowlist is checked in the core.
   - This removes the Round 4 "system actor bypasses RBAC" issue without breaking automations.
5. **`resolvePrincipalFromMcp(request)`**:
   - API key: `service:mcp_agent_key` with the key's role and categories mapped to scopes.
   - Session: the user's scopes with `actorType: 'agent'`.
   - The organization **always comes from the key or the profile, never the header** (N4).
6. **Parity suite.** For every role template (`role-templates-qa`) and a sample of production-shaped `permissionsSchema` fixtures, `resolvePrincipalFromSession` grants exactly what `canUser` / `checkWorkspacePermission` grant. A registry test fails if any capability declares a permission reference that is not in the vocabulary.

### 4.4 — Durable records (PR-6)

| Collection | Contents | Rules |
| :--- | :--- | :--- |
| `capability_executions/{executionKey}` | The tools §6.3 envelope, plus `stateChanged` and `expiresAt` (a Firestore TTL policy on idempotency keys; default 24 h, per capability) | Server-only (deny all client access) |
| `capability_audit/{id}` | Every decision (allow / deny / approval required / executed / failed); `prevHash` chain per workspace; no message bodies or secrets | Deny client access; no update or delete, ever (tested in the emulator) |
| `domain_events/{id}` | Outbox (D3), validated by `DomainEventSchema`, with correlation and causation ids | Server-only |
| `capability_approvals/{id}` | Approval requests from the gateway, plus decisions (D5) | Server-only; decided through actions |

- Writes are batched at ≤ 250.
- `mcp_audit_logs` writers are switched off in PR-12. The old collection stays readable until it ages out.
- **Firestore TTL policies are an infrastructure change and need your approval (§8).**
- **Exit:** the contract test "same key twice ⇒ one side effect" passes; emulator tests prove audit is immutable and client-denied.

### 4.5 — Capability waves (PR-9 to PR-11, PR-15)

**Method, per capability:**
1. baseline;
2. `CapabilityDefinition` in `src/platform/domains/<domain_id>/<capability>.ts`;
3. the handler calls the core or service (never duplicated logic);
4. `defineContractSuite(definition, fixtures)`;
5. register through the domain registrar;
6. the legacy action delegates behind a per-capability flag;
7. canary workspace, then default on.

The **contract suite generator** (`src/platform/__tests__/contract/define-contract-suite.ts`) produces the roadmap's Layer 2 cases from the definition:
- valid input;
- invalid input;
- missing permission;
- wrong workspace;
- wrong org;
- foreign resource id (resource scope);
- duplicate key ⇒ one effect;
- timeout ⇒ `stateChanged: 'unknown'`;
- upstream failure;
- disabled flag;
- agent without approval (L3/L4);
- version conflict (when `requiresExpectedVersion`).

**Waves:**

| Wave | Capabilities (ids as in the approved plan §4) | Implementation they call |
| :--- | :--- | :--- |
| **A** (PR-9) | `identity.actor.get_current`, `identity.workspace.list_accessible`, `identity.workspace.get`, `identity.access.check_permission`, `identity.access.list_effective_permissions` | the 1.3 principal resolvers; workspace doc reads |
| **B-1** (PR-10) | `task.search`, `task.get`, `task.create`, `task.update`, `task.complete`; `crm.entity.add_tag`, `crm.entity.remove_tag`, `crm.entity.list_tags`; `crm.activity.create`, `crm.note.create`, `crm.entity.get_timeline` | `task-core`, `scoped-tag-actions` (already non-`'use server'`), `activity-core` (1.1b) |
| **B-2** (PR-11) | `crm.entity.search`, `crm.entity.get`, `crm.entity.create`, `crm.entity.update`, `crm.workspace_entity.update`, `crm.workspace_entity.archive`; `deal.search`, `deal.get`, `deal.create`, `deal.update`, `deal.advance_stage`, `deal.assign_owner`; `pipeline.list`, `pipeline.get` | `entity-core`, `workspace-entity-core`, `deal-core` (1.1b); new bounded, paginated server reads for search/list (Rule 28) that mirror the rules' `hasWorkspaceAccess` |
| **C** (PR-15) | `portal.get`, `portal.list`, `portal.membership.{list,get,create,update_role,suspend,reactivate,remove}`, `portal.publish` | `PortalService`, `PortalMembershipService`. The five KNOWN RISK behaviours are fixed and their baseline assertions updated in the same PR. |

- **Concurrency token:** `updatedAt`, the quick-notes pattern (Rule 18).
- **Events:** each mutation declares its `DomainEvent`s (`task.created`, `deal.stage_advanced`, …). They are written to the outbox, but **nothing consumes them until Phase 2**.

### 4.6 — Flags, kill switches, control plane (PR-7, PR-13)

**PR-7, runtime evaluator (P-D2 A).** `src/platform/capabilities/flags/evaluate-capability-flag.ts` reads `platform_features/capability:<id>` (cached ≤ 60 s). Precedence, first match wins:

| Order | Rule |
| :--- | :--- |
| 1 | `killSwitch` |
| 2 | The global "autonomous execution disabled" switch (`system_settings/ai_config.autonomousExecutionEnabled`), for non-UI surfaces only |
| 3 | Workspace override (new `workspaceOverrides` map) |
| 4 | Org override |
| 5 | Rollout rules |
| 6 | `defaultState` |

- Per-surface fields: `humanEnabled`, `agentEnabled` and `mcpEnabled`, so agents can be turned off while humans stay on.
- Missing docs **fall back to enabled for humans, and to the capability's declared default for agents**, so a capability doesn't need a flag doc to work for users.
- `PlatformFeature` gains `workspaceOverrides?` and `surfaces?`. These are additive, so the existing editor keeps working.
- Existing non-capability `platform_features` get the same evaluator: a `isPlatformFeatureEnabled(key, { orgId, workspaceId })` export, which makes today's backoffice feature flags actually take effect. **That changes behaviour for features that were edited but never enforced, so PR-7 lists them and ships them defaulted to current behaviour.**

PR-13 is covered in §5.5.

### 4.7 — CompanyBrain MCP consolidation (PR-12)

**Tools become thin mappings onto capabilities.** Tool names are kept for existing clients:

| Tool | Capability |
| :--- | :--- |
| `crm.get_entity` | `crm.entity.get` |
| `crm.search_entities` | `crm.entity.search` |
| `deal.get` | `deal.get` |
| `deal.update_stage` | `deal.advance_stage` |
| `task.create` | `task.create` |
| `task.list` | `task.search` |
| `context.*`, `memory.*` | Same names, as gateway-wrapped capabilities whose handlers call `src/lib/memory` (internals stay Phase 4) |

**Changes:**
- `grep adminDb src/lib/mcp/tools` returns nothing.
- `McpRegistry` lists the canonical registry through an adapter. The risk scale maps per the approved plan §2.3.
- `McpApprovalEngine` is replaced by `capability_approvals` (D5). The `mcp_approval_policies` fields become per-capability flag and policy settings.
- **Identity:**
  - `/api/mcp` resolves the org from the key or profile (N4).
  - Specialists (`base-domain-specialist.ts`) switch to `callerType: 'agent'` with the specialist's `agentId`.
  - `workflow-engine.ts` and `supervisor-engine.ts` keep `'agent'` but gain a real `agentId` and delegation.
- **Tests:** existing MCP, specialist, workflow and supervisor suites stay green; a new test proves a specialist's call is audited and gated. The `/api/mcp` protocol stays `2024-11-05`; the SDK v2 transport is Phase 5.

### 4.8 — Docs and telemetry (PR-16)

- `pnpm capabilities:docs` generates `docs/agentic/capabilities.md` and a JSON Schema per capability. A drift test fails CI if they differ from the registry.
- Structured logs with `correlationId`, `executionId`, capability id, surface, decision and duration on every gateway call.
- OpenTelemetry: **brought forward to PR-4 by amendment A10** (Rule 39 requires it from day one). PR-16 only verifies trace coverage and documents it.

---

## 5. UI changes (detailed)

Guiding rules, from the UI doc:
- no visible redesign except where listed;
- every changed control implements the §62 states it can reach;
- §53 errors say whether state changed;
- §50 approvals say **why**;
- 44 px targets, keyboard, screen-reader and reduced-motion support (§67–72);
- desktop, tablet and mobile per §74.

### 5.1 Invocation framework (PR-8)

| Piece | Design |
| :--- | :--- |
| `invokeCapabilityAction(capabilityId, input, options)` | The one generic server action. Session principal → `executeCapability` (surface `ui`) → serialisable `CapabilityUiResult<T>` = `{ ok: true, data, executionId, resourceVersion }` or `{ ok: false, code, message, stateChanged, retryable, currentVersion?, approvalRequestId? }` |
| `useCapability<TIn, TOut>(capabilityId)` | Returns `{ run, status, data, error, reset }`. `status`: `idle`, `running`, `success`, `error`, `permission-denied`, `disabled`, `conflict`, `approval-required`. A per-call idempotency key is generated once per user intent, and **re-used on retry**, so a double click or retry never runs twice. Retries only when `retryable`. |
| `useCapabilityAvailability(ids, context)` | One batched server call returning `{ [id]: 'available' \| 'disabled' \| 'forbidden' }`, so controls can hide or disable themselves up front instead of failing on click. Cached per page. |
| `<CapabilityErrorNotice error />` | The §53 wording by category. **Recoverable:** "We couldn't save the task. [Retry]". **User-action:** "You don't have permission to advance deals in this workspace. Ask an admin for Pipeline → Edit." **System:** the message, plus "No changes were saved" / "This may have been saved — check before retrying" (`stateChanged: 'no' / 'unknown'`). Never raw errors or JSON. |
| `<VersionConflictDialog />` | §65 for structured data. Field-level "Your change / Current value", with **Use current**, **Keep mine** (re-submits with the current version) and **Review**. Used by `crm.entity.update`, `deal.update` and `task.update`. |
| `<ApprovalRequiredNotice />` | For agent-originated L3/L4 results shown in the UI. States **why**: the risk level and its reason, for example "Archiving removes the contact from this workspace for everyone". Links to the approvals queue (§5.4). |
| Accessibility | Results announced through `aria-live="polite"`; focus returns to the trigger after dialogs; buttons show a spinner **and** a text label (not colour alone); `prefers-reduced-motion` respected; ≥ 44 px targets. |

### 5.2 Proof-point migrations (PR-10, PR-11): "the button and the AI call use the same capability"

| Capability | Screens changed (behaviour unchanged except error, conflict and permission states) |
| :--- | :--- |
| `task.create` / `task.update` / `task.complete` | `admin/tasks/TasksClient.tsx` (create, edit, complete, inline status/due/assignee), `admin/entities/[id]/page.tsx` (create task), `admin/deals/[id]/page.tsx` (create, update, delete), `DashboardClientWrapper.tsx`, `use-unified-entity-timeline.ts` |
| `crm.entity.add_tag` / `remove_tag` | `components/tags/TagSelector.tsx`, plus its hosts: entity page, list rows, bulk tag bar |
| `deal.advance_stage` | `pipeline/components/KanbanBoard.tsx` (drag and drop, **with optimistic move and rollback on refusal**), `MoveDealModal.tsx`, `InlineDealCell.tsx`, `QuickEditDealModal.tsx`, `StageValidationModal.tsx`, `deals/[id]/page.tsx` |

- **Kanban on refusal:** the card snaps back to its original column, a `CapabilityErrorNotice` toast explains why, and a conflict shows the stage the deal is actually in now.
- **Same-capability proof:** a test runs `task.create` once from `invokeCapabilityAction` (UI) and once from MCP `tools/call`, and asserts the same capability id and version and the same audit record shape (approved plan §3 item 4).

### 5.3 Context Action System v1 (PR-14, if P-D4 = B)

- **What it is.** A registry-driven **Object Action Menu**. Capabilities declare `ui.contextActions` with object type, label, icon, confirmation level and input form: `{ objectTypes: ['entity' | 'deal' | 'task'], label, icon, group, confirm: 'none' | 'simple' | 'typed', inputForm? }`. The menu lists actions available for the object, filtered by `useCapabilityAvailability`. **Hidden** when forbidden; **disabled with a reason tooltip** when flagged off.
- **Where:**
  - entity page header ("⋯ Actions");
  - deal page header;
  - pipeline card overflow;
  - task row overflow;
  - right-click / long-press on list rows.

  Mobile shows a bottom sheet (< 768 px, UI §6 / doc 13 §5). Keyboard: `Shift+F10` or the context-menu key opens it; arrow keys move; `Enter` runs.
- **v1 actions** (all Wave B capabilities): Create task, Add / remove tag, Log note, Advance stage, Assign owner, Archive (L4, typed confirmation per §50, stating why).
- **Not in v1:** the AI entries of §80 ("Ask AI", "Summarize", "Find related"). They arrive with Phase 6/8 as more registry entries, so no menu rework is needed. They are **not** shown as disabled placeholders (no dead ends, §81).
- **Tests:** component tests for every §62 state; axe accessibility checks; an E2E test opening the menu and running "Create task" on an entity.

### 5.4 Tenant capability admin: evolve `/admin/companybrain/tools` (PR-12, P-D3 A)

| Tab | Today | After Phase 1 |
| :--- | :--- | :--- |
| **Catalog** | `ToolCatalogTable` over `src/lib/mcp` tools | The canonical registry. Columns per §43: Capability, Domain, Risk (L0–L4 badge + text), Version, Status (enabled / agents off / disabled by platform), Success rate, p95 latency (from `capability_executions`, last 7 days). **Detail drawer:** schema (rendered, not raw JSON), permissions (human labels from the vocabulary), risk and why, events emitted, MCP tool name, version history. |
| **Approvals** | `PendingApprovalsQueue` over `mcp_pending_approvals` | The same component over `capability_approvals`. Each request shows the action, target, requesting agent and run, **why approval is required**, and the evidence pack (doc 13 §3.2). **Approve / Reject / Edit parameters**; self-approval is blocked and says so. |
| **Keys** | `McpApiKeysCard` | Unchanged UI. Actions secured by 1.1b. Key scopes are shown as capability groups. |
| **Telemetry** | `McpAuditLogViewer` over `mcp_audit_logs` | `capability_audit` (with the old collection shown read-only while it ages out). Filters: human / agent / automation / system (a preview of the Phase 2 `/admin/activity` filters); correlation-id drill-down. |
| **Agent access** (new, org admins only) | — | Per-workspace switch "Allow agents to use this capability". Writes the `platform_features` workspace override for the agent surface only. **Humans are never affected from this screen.** The platform kill switch shows as locked ("Disabled by SmartSapp"). |

- `/admin/settings/ai/capabilities` redirects here (the UI §43 route name).
- Access requires `app:system_admin` or the D6 `app:ai_governance_manage`.

### 5.5 Backoffice control plane (PR-13)

On the `goadmin` surface only (`authorizeBackoffice`, `APP_SURFACE=backoffice`), at doc 13 §4 routes. These reuse existing backoffice shells and components:

| Route | Content |
| :--- | :--- |
| `/backoffice/ai/capabilities` | The registry viewer (same drawer as §5.4, plus `implementationRef` and test status); a flag editor (**reuses the `features` editor** for `capability:*` docs, with the new workspace-override and surface fields); the global **"Disable autonomous execution"** switch, dual-controlled through the existing `approval-registry` |
| `/backoffice/ai/executions` | Execution and audit explorer: filter by org, workspace, capability, surface, decision and code; correlation timeline; hash-chain verification badge per workspace |
| `/backoffice/approvals` | Unchanged. Platform dual control stays on `platform_approval_requests` (P-D5 A). |
| `/backoffice/companybrain` | Its MCP tool and approval panels switch to the canonical registry and `capability_approvals`. Duplicate panels are removed where `/backoffice/ai/*` replaces them, and a banner points to the new home. |

### 5.6 Portal UI

No visible change. Member pages keep the token plumbing from 1.1a. **Portal Studio** (Wave C) gets:
- permission-aware controls from 4.1;
- the `CapabilityErrorNotice` on membership actions (role change, suspend, remove);
- a typed confirmation for "Remove member" (L4, stating why).

### 5.7 UX documentation and E2E

- **`docs/ux/01-screen-inventory.md` + `docs/ux/action-capability-map.md`** (UI §82 Phase 0 deliverable, currently missing), scoped to Wave A–C screens. Every button that mutates data is listed with its capability id, or "not yet migrated (phase N)". The UI half of the Phase 1 exit ("every existing UI action maps to a capability") is **measured** from this map.
- **Playwright journeys** (`src/e2e/crm/*.spec.ts`), against a seeded test workspace:
  - create contact;
  - create deal;
  - create task (button + context menu);
  - add tag;
  - advance stage by drag and drop, and by modal;
  - version conflict (two tabs);
  - permission-denied (restricted role);
  - flag-disabled capability (backoffice toggle → UI refusal);
  - portal: join, enrol, post, checkout pending (the Round 4 follow-up).

  These close the Phase 0 Gate A E2E gap.
- **Accessibility:** axe checks on every new component; keyboard-only run through the context menu and the conflict dialog.

---

## 6. Testing strategy (additions to the approved plan §6)

| Layer | New in the build plan |
| :--- | :--- |
| Static | Export-sweep guard test (4.0.3); registry validation test; permission-vocabulary test; docs drift test |
| Unit | One refusal test per gateway step; the flag precedence table; service-principal allowlists; error mappers (`stateChanged`) |
| Contract | `defineContractSuite` for all ~45 capabilities, run in CI |
| Parity | Principal parity across role templates and `permissionsSchema` fixtures |
| Isolation | Roadmap Layer 4 run against the MCP path, the UI path and the worker path |
| Rules (emulator, `pnpm test:rules:ci`) | `capability_*` collections server-only; audit immutable |
| E2E | §5.7 journeys; flag toggle end to end |
| Regression | Baseline (444+), plus existing CRM, pipeline, import, forms, automation, MCP, specialist, workflow and supervisor suites |

---

## 7. Phase 1 exit: evidence mapped to gates (roadmap §34)

| Gate | Evidence |
| :--- | :--- |
| **A Functional** | All capabilities pass contract suites; E2E journeys green; `action-capability-map.md` shows every Wave A–C mutation migrated |
| **B Security** | Sweep test has no unguarded wrapped exports; isolation suite 100% denied; audit immutable (emulator); secrets rotated and OIDC verified; N2 / N4 identity fixes proven by tests; no `system` bypass left (service principals) |
| **C Agentic** | MCP tools and specialists run through canonical capabilities; generated docs and schemas; `tools/list` exposes the canonical descriptions |
| **D Evaluation** | Not gated. Per-capability p95 and error rates captured before and after on the canary workspace, for Phase 15. |
| Rules §67 | Each capability PR answers the Agent Implementation Gate checklist in its description |

---

## 8. Approvals you'll be asked for (nothing happens without them)

- Committing and pushing each PR (standing rule: nothing is pushed until you ask).
- Rotating `CLOUD_TASKS_SECRET` (operational; see the outstanding Phase 0 rotation note).
- Deploying Firestore rules: the `content_items` rule after the app release (Round 4), and the new `capability_*` rules.
- Firestore TTL policy on `capability_executions`.
- The FER migration granting portal permissions to existing roles (dry-run first).
- Turning each capability flag on for the canary workspace, then by default (staging first; production needs approval).

---

## 9. Risks specific to the build

| Risk | Mitigation |
| :--- | :--- |
| 1.1b breaks trusted server callers (imports, surveys, automations) | Core/wrapper split plus explicit service actors; the existing import, forms and automation suites are the gate; browser smoke of imports |
| Making `platform_features` enforceable flips features that were edited but never enforced | PR-7 inventories every existing doc and defaults it to current behaviour; release note lists them |
| Positional string parameters shift silently when identity params are removed | Named-object signatures for changed functions; manual grep of callers (1.1a lesson) |
| Gateway overhead on hot UI paths (Kanban drag) | Per-request principal memo; flags cache; latency budget test; optimistic UI with rollback |
| Scope creep into the command bar or AI actions | P-D4 limits v1 to non-AI context actions; the command bar is explicitly Phase 8 |
| Parity gaps between the capability path and the legacy path | Per-capability flag; canary workspace; baseline + E2E before default-on; instant rollback by flag |

---

## 10. Out of scope, handed to later phases

| Phase | What it gets |
| :--- | :--- |
| 2 | Consuming the `domain_events` outbox (Phase 1 only writes it); Activity Timeline 2.0 and `/admin/activity` |
| 3 | Full delegation grants, merging `platform_approval_requests`, dual-control policies beyond the kill switch |
| 4 | Memory internals |
| 5 | MCP SDK v2 transport for `/api/mcp` |
| 6 / 8 | Agent runtime, Global Command Bar, AI context actions |
| 15 | Automatic canary rollback, incident management (OpenTelemetry itself moved into Phase 1 by A10) |

Carried Round 4 follow-ups: certificate-page PII, event self check-in duration, a real payment gateway, and the review of `identity-resolution.ts` (it is `'use server'`; it is covered by the sweep test in 4.0.3).

---

## 11. Rules conformance review (`agents_mcp_rules.md`, 2026-09-29)

This plan was checked against every rule: the 10 preamble rules, Rules 11–65, §66 (Phase 1 contracts), §67 (implementation gate), §68 (non-negotiables) and §69. Skills from preamble rule 1 were read in `.agents/skills`: `next-best-practices`, `vercel-react-best-practices`, `frontend-design` and `emilkowal-animations`. The named `backend-design` skill **does not exist**; `backend-patterns` / `cc-skill-backend-patterns` are used instead, as the closest match.

**Verdict: on track in architecture, with 20 amendments needed before build.** The core design is sound: one gateway, a capability layer underneath, server-side policy, verified approvals and core/wrapper splits. That meets §69 and the §68 non-negotiables. The gaps are mostly contract fields, load behaviour, observability and trackability, and are fixed by amendments A1–A20 below. Nothing in the rules forces a change to an approved decision (D1–D6, P-D1–P-D6).

### 11.1 Conformance matrix

Legend: ✅ covered · 🟡 partial → amendment · ❌ gap → amendment · ⏭ later phase (reason given).

| Rule | Status | Where / amendment |
| :--- | :--- | :--- |
| P1 Skills conformance, trackable plan | 🟡 | **A1** engineering standards; **A20** tracker |
| P2 What could go wrong; tsc / lint / commit; no push | 🟡 | §9 extended by **A19**; per-PR local commits allowed, no push |
| P3 Affected features and backoffice | 🟡 | **A18** affected-features matrix per PR |
| P4 No `any` / unchecked casts; `unknown` only at boundaries | 🟡 | **A2** lint enforcement on new code |
| P5 Staging first; production needs approval; indexes, rules, migrations | 🟡 | §8, plus **A11** indexes and retention |
| P6 Dependencies + latest docs | 🟡 | **A10** dependency governance (OTel, google-auth-library) |
| P7 Mobile, reuse, plain English | 🟡 | **A16** mobile and copy spec for every new surface |
| P8 Security | ✅ | 1.1b, 4.0, gateway, sweep test |
| P9 Load, edge cases | ❌ | **A7** rate limits and quotas; **A8** audit-chain hotspot; **A19** edge-case table |
| P10 Guidance comments | 🟡 | **A1** |
| 11 MCP spec compliance | 🟡 | Transport stays `2024-11-05` until Phase 5 (justified); **A12** records the spec version and fetches docs before PR-12 |
| 12 Annotations aren't security | 🟡 | **A12** test: annotations derived from risk, never read back for policy |
| 13 Trust-boundary matrix | 🟡 | **A3** `dataClassification` and `outputTrust` required per capability |
| 14 Tool poisoning / rug-pull | ❌ | **A4** capability fingerprints + material-change gate |
| 15 Server allowlisting | ⏭ | Phase 5. Phase 1 connects **no** external MCP servers (stated as a constraint in §4.7). |
| 16 Agent identity | ✅ | 1.3; **A5** adds `policyVersion` and `attempt` to records |
| 17 Non-delegable | ✅ | 4.0.4 remap + test |
| 18 TOCTOU | ✅ | Gateway step 11; **A6** binds the resource version into approvals |
| 19 Idempotency defined per mutation | 🟡 | **A3** `idempotency` block required (key, retry behaviour, duplicate detection) |
| 20 Replay protection | 🟡 | **A5** `toolCallId`, `attempt`, and an `unknown` outcome state |
| 21 Two-phase (plan → preview → approve → execute → verify) | 🟡 | Dry run + approvals + L4 typed confirm; postcondition "verify" ⏭ Phase 14 (reason: needs the agent runtime) |
| 22 Approval binding | 🟡 | **A6** payload hash + capability version + **resource version** + policy version |
| 23 Budgets, backpressure | ❌ | **A7** |
| 24 Circuit breakers | ❌ | **A9** breaker for capabilities with external egress (memory/Qdrant, AI summary) |
| 25 Dead-letter / recovery | ⏭ | Phase 7 (carried from Phase 0 §6). Phase 1 capabilities are synchronous. |
| 26 Cancellation | ⏭ | All Phase 1 capabilities are short and synchronous (`supportsCancellation: false`, declared) |
| 27 Saga / compensation | 🟡 | **A3** `partialFailure` declaration per multi-write capability; contract "partial failure" case |
| 28 Context budgeting | 🟡 | **A7** `maxResults` / cursor defaults on every search and list |
| 29–30 Memory governance / poisoning | ⏭ | Phase 4. Memory tools only gain gateway gating in Phase 1. |
| 31 Output + business validation | 🟡 | **A3** `invariants` (business rules) run before execute |
| 32 Exfiltration detection | ⏭ / 🟡 | No external-send capability in Phase 1. **A3** classification lays the ground. |
| 33 Egress control | ❌ | **A3** `egress` field (`none` / `internal` / `external:<allowlist>`) enforced by the gateway |
| 34 SSRF | ✅ | `safeUrlFetch` (Phase 0) |
| 35 Discovery caching | 🟡 | **A4** `registryVersion` hash; `tools/list` includes it; stale-fingerprint calls refused |
| 36 Version compatibility | ✅ | SemVer + pinned version in records |
| 37 MCP compatibility testing | 🟡 | **A12** compatibility matrix doc + tests (legacy client → current adapter) |
| 38 No deprecated MCP features | ✅ | Verified: no Roots / Sampling / Logging in `src/lib/mcp` or `/api/mcp` |
| 39 OpenTelemetry from day one | ❌ | **A10** OTel API spans in the gateway now (was deferred) |
| 40 Audit immutability | ✅ | 4.4 + **A8** (chain design that scales) |
| 41 "Why did you do this?" view | 🟡 | **A13** decision-trace fields + backoffice view |
| 42 Shadow mode | ❌ | **A14** `agent: 'off' \| 'shadow' \| 'on'` per capability |
| 43 Replayable runs | ⏭ | Phase 6/7. Phase 1 stores capability version, input hash and redacted input ref (**A5**). |
| 44 Deterministic simulation | 🟡 | **A15** shared fakes (Firestore, MCP client, clock) |
| 45 Chaos testing | 🟡 | **A15** fault-injection cases |
| 46 Adversarial testing | 🟡 | **A15** Phase 1 red-team slice |
| 47 Never trust the model | ✅ | Gateway pipeline |
| 48 Never trust the tool | 🟡 | **A3** `outputTrust: 'untrusted_content'` on capabilities returning customer text |
| 49 Public resource isolation | ✅ | Round 4 content fix; portal gateways |
| 50 Cache isolation | ❌ | **A11** request-scoped memo rules; no tenant data in shared caches |
| 51 Defense in depth | ✅ | Cores keep their own actor check behind the gateway (stated in 4.1b) |
| 52 Client/server boundary tests | ❌ | **A2** `import 'server-only'` + boundary test |
| 53 Dependency governance | 🟡 | **A10** |
| 54 Performance budgets | 🟡 | **A17** UI and gateway budgets |
| 55–56 Graph / context compression | ⏭ | Not in Phase 1 scope |
| 57 Residency / retention | 🟡 | **A11** retention per collection; `dataClassification` (**A3**) |
| 58 Model routing | ⏭ | Phase 6. The AI summary keeps the existing AI gateway. |
| 59 Tool selection evaluation | 🟡 | **A4** description lint (Gate C); evaluation ⏭ Phase 15 |
| 60 Dead-man controls | 🟡 | **A14** disable agent, pause agent steps, cancel queued steps |
| 61 Backoffice control plane | ✅ / 🟡 | §5.5; **A13** usage/cost columns |
| 62 Security command center | 🟡 | **A13** security view (denials, cross-tenant attempts) |
| 63 Incident management | ⏭ | Phase 15. The explorer's correlation query is the Phase 1 foundation. |
| 64 Three-level + agent/capability flags | 🟡 | P-D2, plus **A14** `agent:<id>` flags |
| 65 Canary + rollback thresholds | 🟡 | **A14** error-rate alert per capability; auto-rollback ⏭ Phase 15 |
| §66 Phase 1 contracts | 🟡 | Idempotency, risk, version, concurrency and audit ✅; egress ❌ → **A3** |
| §67 Implementation gate | 🟡 | **A20** PR template with the checklist |
| §68 Non-negotiables | ✅ | Model isn't the boundary; tool output untrusted (A3); mutations idempotent / authorized / versioned / audited; bounded authority (A7); operable without code (§5.5) |
| §69 Capability layer underneath | ✅ | D1, P-D2/P-D3 reuse existing surfaces |

### 11.2 Plan amendments

| # | Amendment | PR |
| :--- | :--- | :--- |
| **A1** | **Engineering standards**, applied to every PR. See the table after this one. | all |
| **A2** | **Type and boundary enforcement.** ESLint `@typescript-eslint/no-explicit-any` and `no-unsafe-*` as **errors** on `src/platform/**`, `src/lib/crm/**`, `src/lib/tasks/**` and new UI files. `invokeCapabilityAction` takes `unknown` and hands it straight to the gateway's Zod parse (the only allowed `unknown` boundary). Every non-`'use server'` core starts with `import 'server-only'`. A boundary test builds a client-module import graph and fails if any client file reaches `src/platform/**`, the cores or `firebase-admin` (Rule 52). | PR-0, PR-1, PR-4 |
| **A3** | **Contract additions** to `CapabilityDefinition`, all required and checked by registry validation. See the list after this table. | PR-4 |
| **A4** | **Fingerprints and discovery.** Each registered capability gets `schemaHash`, `descriptionHash`, `permissionHash` and `riskHash` (canonical JSON). A committed snapshot (`capability-fingerprints.json`) makes CI fail on any material change without a SemVer bump. The registry exposes `registryVersion` (the hash of all fingerprints); MCP `tools/list` includes it, and a call pinned to a stale fingerprint gets `VERSION_CONFLICT` (Rules 14, 35). Description lint: ≥ 1 sentence saying *when to use* the capability (Gate C / Rule 59). | PR-4, PR-16 |
| **A5** | **Record fields.** Execution records add `toolCallId`, `attempt`, `policyVersion`, `inputHash`, `redactedInputRef` and `outcome: 'succeeded' \| 'failed' \| 'unknown'` (Rules 16, 20, 43). | PR-6 |
| **A6** | **Approval binding.** `VerifiedApproval` also binds `resourceVersion` (from `resolveResourceScope`) and `policyVersion`. The verifier refuses if either changed since approval (Rules 18, 22). | PR-4 |
| **A7** | **Budgets and backpressure** (gateway step 3b). See the note after this table. | PR-4, PR-7 |
| **A8** | **Audit chain that scales.** A per-workspace `prevHash` chain serializes every write in a workspace: a hotspot under load. Instead, records are written with `recordHash` only (no read-before-write). A **sealer** job (Cloud Scheduler → Cloud Tasks, every 5 min) chains the new records per workspace into `capability_audit_seals/{workspaceId}_{window}` (a Merkle root + the previous seal). Verification recomputes seals. Same immutability, no write contention (Rules 9, 40). | PR-6 |
| **A9** | **Circuit breaker** for capabilities with `egress: external` (memory/Qdrant tools, the entity AI summary). Per-provider states healthy → open → half-open, stored in memory with a Firestore-backed shared state (≤ 60 s staleness). While open, the gateway returns `UPSTREAM` with `stateChanged: 'no'` and the user copy "The AI service is busy. Nothing was changed." (Rule 24). | PR-4 |
| **A10** | **Observability and dependencies.** OpenTelemetry comes forward from "follow-up" to PR-4 (Rule 39). The gateway emits a span per invocation and child spans per pipeline step, carrying `correlationId`, `executionId`, `capabilityId`, surface and decision. An exporter to Google Cloud Trace is enabled by env on Cloud Run; it is a no-op locally. **Dependency governance record** (Rule 53) for `@opentelemetry/api`, the SDK, the GCP exporter and `google-auth-library`: version, license, maintenance, advisories, bundle impact (server-only), peer compatibility. Docs are fetched with Context7 before install; the lockfile is committed. | PR-2, PR-4 |
| **A11** | **Data plumbing.** See the list after this table. | PR-4, PR-6, PR-7 |
| **A12** | **MCP compliance.** Before PR-12, fetch the current MCP spec and SDK docs (Context7) and record the exact versions in `docs/agentic/09-mcp-architecture.md`. Add a compatibility matrix: the current `/api/mcp` `2024-11-05` clients → the capability adapter, and the SDK v2 builder → the capability adapter. A test proves MCP annotations are **derived from** capability risk and never consulted by policy (Rule 12). | PR-12 |
| **A13** | **Decision trace, usage and security views.** Audit records carry a decision trace: capability, version, arguments (redacted per `dataClassification`), policy decision and reasons, approval refs, result summary, evidence refs, actor chain (user → agent → service). The backoffice explorer gets a **"Why"** panel (Rule 41), usage/cost columns (calls, p95, `costPerInvocationUsd`) (Rule 61), and a **Security** tab listing `FORBIDDEN` / `TENANT_SCOPE` / `APPROVAL_REQUIRED` spikes, cross-tenant attempts and disabled-capability hits by principal (Rule 62). | PR-13 |
| **A14** | **Dead-man and rollout controls.** See the note after this table. | PR-7, PR-13 |
| **A15** | **Simulation, chaos and adversarial slices.** See the note after this table. | PR-4 → PR-12 |
| **A16** | **Mobile and copy spec** for every new surface. See the note after this table. | PR-8, PR-13, PR-14 |
| **A17** | **Performance budgets** (Rule 54). Gateway overhead p95 ≤ 50 ms (reads) and ≤ 120 ms (mutations, including 3 writes). The availability call p95 ≤ 150 ms. The context menu adds ≤ 15 kB gzip to entity/deal routes (dynamic import). Kanban drag feedback is < 16 ms (optimistic). Budgets are asserted by a benchmark test (gateway) and by `next build` route-size diffs recorded in each UI PR. | PR-4, PR-8, PR-14 |
| **A18** | **Affected features per PR** (preamble 3). Each PR description carries the matrix after the tracker in §12: what the PR touches, what else is affected, how it is verified, and what the backoffice gains. | all |
| **A19** | **Edge cases and what could go wrong.** Additions to §9 are listed after the tracker in §12. | all |
| **A20** | **Trackability.** `.github/pull_request_template.md` with the §67 Agent Implementation Gate checklist (N/A answers need a reason), the release-gate evidence (§7) and the A18 matrix. The §12 tracker below is updated as each PR lands. | PR-0 |

**A1 — engineering standards:**

| Area | Standard |
| :--- | :--- |
| Next.js (`next-best-practices`) | Server Actions authenticate **inside** the action (never via layout/middleware alone). Reads prefer Server Components. Serialisable action results only (no class instances or Dates). |
| React (`vercel-react-best-practices`) | `server-auth-actions`, `async-parallel` (principal and flags resolved in parallel), `server-serialization`, `rerender-transitions` / `rendering-usetransition-loading` (`useCapability` runs inside `useTransition`), `bundle-dynamic-imports` (context menu and backoffice explorers lazy-loaded), `server-after-nonblocking` **only** for telemetry (never for audit, which must commit with the operation). |
| Motion (`emilkowal-animations`) | Kanban snap-back and menu/sheet motion use ease-out ≤ 200 ms, the bottom sheet uses the iOS-drawer curve, and `prefers-reduced-motion` disables movement. |
| Visual design (`frontend-design`) | Applies its quality bar **within the existing design system** (shadcn tokens, current typography). No new aesthetic, per the UI doc's "no visible redesign in Phase 1". |
| Backend (`backend-patterns`) | Repository/service separation; typed errors; batch and pagination limits. |
| Process | TDD (`test-driven-development`): failing test first. `verification-before-completion` before any "done". `firebase-security-rules-auditor` on every rules change. `mcp-builder` guidance for PR-12. |
| Comments (P10) | Every changed module opens with a `SECURITY` / `WHY` header. Risky seams are marked `CAUTION:` with the test that guards them. |

**A3 — contract additions:**
- `egress: { class: 'none' | 'internal' | 'external', allowlist?: string[] }` (Rule 33 / §66 egress contract). The gateway refuses outbound use outside the declared class.
- `dataClassification` becomes required (was optional).
- `outputTrust: 'system' | 'tenant_data' | 'untrusted_content'`. Notes, timelines, memory and anything customer-written is `untrusted_content`; agent adapters must wrap it as data, never as instructions (Rules 13, 48).
- `idempotency: { keySource: 'caller' | 'derived', retry: 'replay' | 'safe_repeat' | 'forbidden', duplicateDetection: string }` (Rule 19).
- `partialFailure: 'atomic' | 'compensate' | 'report'` for multi-write handlers (Rule 27).
- `invariants: Array<(input, scope) => string | null>`: business rules run after schema validation, before execute (Rule 31; e.g. deal value ≥ 0, due date not before 1970).

**A7 — budgets and backpressure:**
- Per principal: token-bucket rate limits by surface (UI 30/s burst, agent/MCP 5/s, per workspace 50/s). Firestore-sharded counters with an in-memory pre-check, returning `RATE_LIMITED` with `retryAfterMs`.
- Every search/list capability declares `maxResults` (default 50, hard cap 200) and a cursor.
- Bulk mutations cap at 250 ids per call (PRD invariant 14).
- `maxPayloadSizeBytes` defaults to 256 KB for CRM.
- Per-workspace daily quota for agent-surface mutations (backoffice-editable in `platform_features` metadata).

(Rules 23, 28, P9.)

**A11 — data plumbing:**
- **Indexes:** add to `firestore.indexes.json` for `capability_executions` (workspaceId + startedAt, capabilityId + startedAt), `capability_audit` (workspaceId + createdAt, decision + createdAt) and `capability_approvals` (workspaceId + status + createdAt). Deployed to staging with the rules (P5).
- **Retention** (Rule 57): executions 30 days (TTL), audit 400 days then archive to Cloud Storage (export job, Phase 1 manual), outbox 14 days after Phase 2 consumes it.
- **Cache isolation** (Rule 50): the principal memo uses React `cache()` (request-scoped). Flags are cached per `capabilityId` only (global config, no tenant data). Availability results are never cached across users. No `'use cache'` or `unstable_cache` on any tenant-scoped capability read.

**A14 — dead-man and rollout controls:**
- The flag surface for agents becomes tri-state: `off / shadow / on`. **Shadow** runs validation, authorization and dry run, records an execution with `outcome: 'shadow'`, and performs no side effects. It is the default for any capability newly enabled for agents (Rule 42).
- `agent:<agentId>` flags (disable one specialist) (Rule 64).
- "Pause all agent steps" and "Cancel queued steps" switches, checked by the worker (Rule 60).
- An error-rate alert per capability (> 2× baseline over 15 min) in the backoffice, with one-click flag rollback. Automatic rollback ⏭ Phase 15 (Rule 65).

**A15 — simulation, chaos and adversarial slices:**
- **Shared test kit** in `src/platform/__tests__/kit/`: an in-memory Firestore with transactions and contention injection, a fake MCP client, a fixed clock and a fake upstream provider (Rule 44).
- **Chaos cases** in the contract suite: Firestore contention, malformed handler output, duplicate delivery, stale approval, concurrent modification, upstream 429/500, timeout after commit (Rule 45).
- **Red-team slice** (Rule 46): forged `x-organization-id`, cross-tenant resource ids, replayed idempotency key with different input (refused), approval reuse, confused deputy (agent key calling a human-only capability), a race between approve and resource edit.

**A16 — mobile and copy spec:**
- Conflict dialog: a full-screen sheet on < 768 px, with fields stacked, not side by side.
- Backoffice tables: cards on mobile.
- Context menu: bottom sheet with 48 px rows.
- Kanban on touch: long-press to drag, snap-back on refusal, and a haptic-free visual cue.
- Every toast: one sentence plus at most one action.
- Copy rules: everyday words, ≤ 12 words per message, no codes. Examples: "You can't move deals in this workspace." · "Saved." · "Someone changed this deal. Review changes." · "Not sure it saved. Check before trying again."

---

## 12. Tracker

Status: ☐ not started · ◐ in progress · ☑ done (with evidence link).

| PR | Title | Status | Gate evidence (A/B/C) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| PR-0 | Branch split + sweep test + PR template (A20) + lint enforcement (A2) | ◐ deployed; (e) held (H4a) | **On local `main` (fast-forwards, not pushed):** (a) `b14373c5` SSRF guard → (b) `efddec34` Phase 0 platform → (c) `1b188b3b` + `e44aa55b` portal/task auth hotfix and task-core fix → (f) `9e133625` DocSigning auth/SSRF/hook fix → (d) `6f8931ca`…`5d658fc6` guardrails. Each step was verified on a clean checkout before merging: (f) tsc 0, lint 0 errors / 663 warnings, vitest 749 files / 5,672 tests; (d) = stack top, vitest 750 / 5,680, baseline 44 / 452, sweep 0 new / 0 stale (also against the main checkout with its uncommitted work). **Held:** (e) `agentic/pr0e-content-items-rule` (rules 39 pass). Merge only after the app release containing (c) is deployed; it needs a trivial rebase onto `main` first. Backups: `../agentic-pr0-2026-09-29{,-rebased}.bundle`. | Remaining to close PR-0: deploy (needs your approval), then (e). See follow-ups below. |
| PR-1 | 1.1b CRM + MCP-governance hotfix | ☑ done (local; push pending) | **N2** ☑ deployed `3645630d` (10 tests, 9 fail on old code; baseline 508 → 499). **N1 step 1 (deals)** ☑ this commit: `src/lib/crm/deal-core.ts` + `bulk-deal-core.ts`, all `deal-actions` wrappers session-only (15 tests, 10 of 11 wrapper tests fail on old code; baseline 499 → 492). | Next: N1 entity core, workspace-entity core, activity core. See PR-1 notes. |
| PR-2 | 1.0 Phase 0 closure + OTel/auth deps governance (A10) | ◐ code done (local) | `931756d4` Cloud Tasks secret + OIDC; `4b9546bb` worker live re-check, approval bound last, audit gate; `bb402a82` D6 permission refs, non-delegable remap, registry validation; `7a48509a` inventory on the strict sweep + agent stack; governance record `docs/agentic/16-dependency-governance.md`. | Ops (yours): rotate `CLOUD_TASKS_SECRET`; after a week of clean logs set `CLOUD_TASKS_OIDC_MODE=enforce`. See PR-2 notes. |
| PR-3 | 1.1 portal permission ids + lint | ☐ | | FER dry-run first |
| PR-4 | Gateway + errors + contract additions (A3, A4, A6, A7, A9, A10, A17) | ☐ | | |
| PR-5 | Principals + parity | ☐ | | |
| PR-6 | Records, audit (A5, A8), outbox, indexes / retention (A11) | ☐ | | Rules deploy needs approval |
| PR-7 | Flags on `platform_features` + dead-man / shadow (A14) | ☐ | | Existing features defaulted to current behaviour |
| PR-8 | UI invocation framework (A16, A17) | ☐ | | |
| PR-9 | Wave A | ☐ | | |
| PR-10 | Wave B-1 + proof points (task, tag) | ☐ | | |
| PR-11 | Wave B-2 + proof point (stage) + CRM E2E | ☐ | | |
| PR-12 | MCP consolidation + tenant tools page (A12) | ☐ | | |
| PR-13 | Backoffice control plane (A13, A14) | ☐ | | |
| PR-14 | Context Action System v1 (A16, A17) | ☐ | | |
| PR-15 | Wave C portals | ☐ | | |
| PR-16 | Generated docs, fingerprints (A4), telemetry, exit evidence | ☐ | | |

**PR-2 notes (2026-10-01):**

- **Cloud Tasks secret.** The literal fallback in `gcp-tasks-client.ts` (also accepted by the worker check in development) is gone. Production refuses to start without `CLOUD_TASKS_SECRET` (`src/instrumentation.ts`); comparisons are constant-time. **The old literal is still in the public git history**, so if the value in Secret Manager was ever that literal, it is public: rotate it (new Secret Manager version, then redeploy; in-flight tasks signed with the old value will fail once and retry).
- **OIDC.** Workers verify the Google-signed token Cloud Tasks already sends (audience `https://go.smartsapp.com`, signer = the task service account, default `<project>@appspot.gserviceaccount.com`). Production starts in `CLOUD_TASKS_OIDC_MODE=report`: failures are logged as `[CLOUD_TASKS_AUTH] OIDC check failed`, requests with the correct secret are still accepted. Once the logs are clean, set `enforce` on both Cloud Run services. If the queue-missing fallback is used in production, add the Cloud Run runtime service account to `CLOUD_TASKS_SERVICE_ACCOUNT_EMAILS` first (its direct calls now carry an ID token from that account).
- **Worker.** Live re-check of the run's user (exists, approved, same organization, a role granting the workspace) before execution; approvals verified read-only, then bound in a transaction only after authority and the live check pass; `auditRequired` capabilities refused until PR-6.
- **Registry.** D6 permission references (`app:` / `rbac:`) derived from the RBAC engine; `NON_DELEGABLE_ACTIONS` remapped to real permissions (it matched nothing before); definitions validated on registration. No capability is registered in production yet, so nothing live changes.
- **Inventory.** Server actions counted by the strict sweep (1,973 exports; 477 unguarded = the baseline); the agent stack folders are scanned.

**PR-1 notes (2026-09-30):**

- **N1 deals, done.** `CrmActor` = verified user (checked with `canUser(operations/pipeline/…)` against the deal's STORED workspace) or a service pinned to ONE workspace (no blanket bypass). A new deal's organization comes from its workspace. Every `deal-actions` export takes identity from the session; caller `userId` parameters were removed and the compiler found all 56 call sites. `updateDealStageAction` always checks. Bulk paths and the bulk-job worker refuse foreign and workspace-less ids; `processDealBulkJob` is no longer exported. `updateDealAction` can't change `workspaceId` / `organizationId`. `updateStageOrdersAction` checks the pipeline is shared to the workspace and every stage belongs to it. `resolveWorkspaceEntityRecord` and the bulk-create core are no longer public endpoints.
- **Bugs fixed on the way:** two UI calls passed the user's uid as the workspace id (`InlineDealCell` MRR edit, `StageValidationModal` field update), so those edits always failed; the owner cell saved the viewer's uid as the new owner's email.
- **Service callers:** automations (pinned to the resolved target workspace; a `dealId` in a trigger payload can no longer reach another tenant), message-status automations, call centre (attributed to the agent), bulk jobs, forms, surveys. The MCP `deal.update_stage` tool runs as the calling user and only on deals of the calling workspace.
- **FU-14, done.** The survey/form runners are no longer public endpoints: `executeSurveyPipelineAndAutomations` and `addOrMoveEntityInPipeline` are module-private; the decision runner (`survey-decision-runner.ts`) and CRM sync runner (`survey-crm-sync-runner.ts`) moved out of `'use server'` files; `identity-resolution.ts` is no longer a `'use server'` module. Callers pass the STORED survey/form workspace. Their old `requireAuth()` also broke the normal case (anonymous respondents), so survey pipeline routing, CRM sync, decisioning and form identity resolution now work again for them. `executeSurveyResultButtonActions` stays public by design (allowlisted): it takes only the button id, reads tags/automation/webhook from the stored survey, requires the response to belong to the survey and be linked to the entity, and posts the webhook through `safeUrlFetch`. Found on the way and fixed: system decision playbooks and system CRM mapping templates could be overwritten by any signed-in user (now `requireSystemAdmin`); the CRM field-definition read and decision dry-run had no session check. Baseline 492 → 486. 10 tests.
- **FU-15, done.** `checkPipelineInWorkspace` / `checkStageInWorkspace` / `checkDealPlacement` in the deal core: a deal may only reference a pipeline shared to its workspace (`workspaceIds`) and a stage of such a pipeline. Applied to create, bulk create, stage change, bulk stage change, `updateDealAction`, `updateDealDetailsAction`, duplicate, lead conversion and survey routing. Only values being set are checked, so deals on legacy values keep working. 5 tests.
- **N1 entities, done.** `src/lib/crm/entity-core.ts` (`createEntityCore` / `updateEntityCore`, same `CrmActor`): no `system-` bypass; users need operations/campuses create/edit; services are pinned to one workspace; updates require the entity to be linked to that workspace (they also write the shared `entities/{id}` doc); organization from the workspace (the `'smartsapp-hq'` default is gone); `data: any` replaced by `EntityInputSchema` (Zod, passthrough so no caller loses fields). Wrappers take `{ data, workspaceId, entityType }` / `{ entityId, data, workspaceId }` from the session. Callers: UI (session), `/api/contacts*` (route-authenticated user), external API (`api` service pinned to the key's workspace), automations, call centre, forms, surveys, imports (`imports` service after one session permission check — `executeImportBatch` used to accept any `userId` and default to a bypass), signup (`signup` service; target workspace now fixed server-side instead of sent by the browser). `lockWorkspaceScope` split so a first entity created by an anonymous form/survey no longer fails on a session check. 8 tests; baseline 486 → 485.
- **Open (product decision, not changed):** `/register-new-signup` is in `publicRoutes`, but its actions have required sign-in since audit F2, so anonymous school registration fails today. Making it anonymous again needs rate limiting and must not expose `checkSignupDuplicatesAction` results (existing schools' contact details) or allow merges into existing records.
- **N1 workspace-entities, done.** `src/lib/crm/workspace-entity-core.ts`: link / unlink / update / archive / delete / bulk archive / bulk delete / ensure-shared take a `CrmActor` and authorize against each record's STORED workspace (campuses:edit; permanent deletes need campuses:delete, as the UI already gates). The entity id comes from the record, never the request; organization-wide archive/delete only reach workspaces the actor may act in, and a root entity is purged only when no membership remains; bulk actions take the workspace and skip ids stored elsewhere; ensure-shared is server-only and can't widen the tenant boundary with a caller `organizationId`. Wrappers take audit name/email from the session. 6 tests; baseline 485 → 480.
- **N1 activity/notes, done.** `getActivitiesForContactCore` moved to `crm/activity-core.ts` (the wrapper also needs campuses:view); `logNoteActivity` uses the session author and the workspace's organization, and only for entities linked to the workspace; `getEntityAiSummary` is session-only with campuses:view; `updateNote` / `deleteNote` now require the note's author (they relied on Firestore rules, which the Admin SDK bypasses). 4 tests; baseline 480 → 477.
- **N1 exit:** every export listed in N1 is guarded or moved into a core; the sweep lists none of them.
- **Not changed (separate module):** the lead-scoring page's bulk archive/delete come from `scoring-performance-engine.ts`, not the workspace-entity actions; review with the next sweep pass.
- **Inner `any`s:** the moved entity bodies still use internal `any` locals (pre-existing); the boundary is typed. Cleanup belongs with the lint step.

**PR-0 notes (2026-09-29):**

**State of the stack:** `main` → (a) → (b) → (c) + task-core fix → (f) DocSigning hotfix → (d) guardrails; (e) off (c). Agentic work now lives in the worktree `../Onboarding-agentic`. The scratchpad worktree was lost, and nothing committed was affected.

**Senior review (2026-09-29): on track with conditions.** Resolved in this pass:

| Blocker | Resolution |
| :--- | :--- |
| Committed `main` called the new 1-arg task actions against the old wrappers (DocSigning commits `43a8e87d`, `7d163dcd` swept agentic files; `ignoreBuildErrors: true` hid it) | (a)–(c) landed; `main` typechecks with 0 errors |
| Stored-task schema rejected the `null` links the Tasks UI writes, so tasks answered "Task not found." | `e44aa55b`: only `workspaceId` fails closed; regression tests; mutation-checked |
| 11 unauthenticated DocSigning actions (`enterprise-governance-actions`, `workspace-branding-actions`), webhook SSRF, legal-hold actor spoofing, unbound obligation hook | Branch (f): session + finance/agreements or studios/pdfs RBAC, `validateSafeEgressUrl` + `safeUrlFetch`, hook bound to contract + linked task; mutation-checked tests |
| Agentic copies in the main working tree kept being swept into commits; `firestore.rules` there equalled (e) | 163 duplicate files cleaned (byte-verified); your 12 files kept |
| Worktree lost; branches local-only | Bundle backup plus a new worktree outside `/tmp` with its own install |
| Sweep would fail after rebase | It correctly flagged the 11 DocSigning actions; passes after (f) |
| ESLint scoped block could silently replace the F2 rule | Shared selector constants (verified with `--print-config`) |

**Open follow-ups (tracked, not blockers for landing):**

| # | Follow-up | Owner / PR |
| :--- | :--- | :--- |
| FU-1 | Paywall still open on `course_lessons`, `course_assessments` (stores correct answers), `community_posts`, `community_comments` (`if true`). Same pattern as `content_items`. | New item before (e) ships, or with it |
| FU-2 | CI does not enforce anything: commits go straight to `main` (typecheck was red Sep 28–29). Add branch protection with required checks, a pre-push hook (sweep about 4 s + tsc), and a required-reviewer environment on the rules deploy job. | You / repo admin |
| FU-3 | Staging shares the PRODUCTION Firebase project, so rules "staging first" (P5, A11) cannot be met. Decide the approval path before PR-6 and (e). | Decision |
| FU-4 | Sweep false negatives (guard in try/catch or dead branch, local shadowing, `export default`, `export *`, inline `'use server'`, `.js`, TSX parse of `<T>x`); anonymous-tolerant guards (`resolvePortalViewer`) should need an allowlist tier; route-handler sweep (Rule 51). | PR-2 |
| FU-5 | `no-unsafe-type-assertion` in the typed block (single `as` casts, e.g. `task-core.ts` `as Task`); lint and typecheck for `scripts/`. Lint headroom is only 7 warnings. | PR-2 |
| FU-6 | Freeze the `system` task actor (4 call sites + automations) with a shrink-only test until PR-5 service principals. | PR-2 |
| FU-7 | Rule 52 `server-only` boundary: 0 of 18 core modules; add `import 'server-only'` + boundary test. | PR-1 / PR-2 |
| FU-8 | Scanner `GUARD_CALLS` still counts caller-trusting checks; the committed matrix publishes "Auth gaps (731)". Align with the strict sweep and publish the matrix as a CI artifact. | PR-2 |
| FU-9 | 4 more senders use plain `fetch` (`webhook-engine.ts:86`, `outbound-webhook-service.ts:99`, `webhook-actions.ts:61`, plus the DocSigning one now fixed): Rule 34 row is not done. | PR-1 |
| FU-10 | DocSigning is building a parallel AI / webhook / quota layer (Rule 69 drift), including a Gemini call with the key in the query string (`document-ai-copilot-service.ts:280`). PR-4 / PR-12 must absorb it. | PR-4, PR-12 |
| FU-11 | `SsrffBlockedError` typo in a public export; `::ffff:0:0/96`, `fec0::/10` and TEST-NET ranges not blocked (low risk with DNS pinning). | PR-2 |
| FU-12 | Regenerate inventory and matrix: they predate 68 DocSigning commits. | PR-2 |
| FU-13 | Don't push to the public origin before deploying: the diffs disclose the fixed holes. | Release |

**Missing skill.** The `backend-design` skill named in the rules preamble doesn't exist; `backend-patterns` is used instead.

**A18 — affected-features matrix** (fill in per PR):

| Touched | Also affected | Verified by | Backoffice gains |
| :--- | :--- | :--- | :--- |
| e.g. PR-10: tasks, tags | automations creating tasks, form pipeline, call-centre outcomes, MCP `task.create`, dashboard widget | suites `task-*`, `crm-integration`, `call-centre-*`, MCP; E2E create task | `task.create` flag, executions view |

**A19 — edge cases and what could go wrong** (additions to §9):

| Case | Handling |
| :--- | :--- |
| Double submit | Same idempotency key → replay |
| Lost response | `unknown` state + "check before retrying" copy |
| Flag flips mid-request | The decision made at step 3 holds for that execution |
| Kill switch during a long read | The read completes; the next call is refused |
| User loses workspace mid-session | The next gateway call refuses (live principal); the UI shows a permission-denied state |
| Clock skew on approval expiry | Server time only |
| Archived entity referenced by a new task | Resource scope refuses: `NOT_FOUND` |
| Bulk request of 10k ids | Refused with `VALIDATION` (cap 250) and copy "Select up to 250 at a time." |
| Firestore contention on counters | Sharded counters + retry with jitter |
| Hot workspace audit | A8 sealing |
| Capability registered twice with different fingerprints | Startup fails fast (registry validation) |
| Legacy client sending identity params after 1.1b | Params ignored (type error at compile time; runtime strip) |
