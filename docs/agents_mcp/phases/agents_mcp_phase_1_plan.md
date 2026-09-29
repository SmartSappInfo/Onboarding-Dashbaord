# SmartSapp Agentic & MCP Transformation — Phase 1 Plan

**Canonical Domain Capability Layer.** *Status: APPROVED 2026-09-27. D1–D6 as recommended; the auth hotfix for portals, tasks and quick notes ships first as a separate PR (§5, 1.1a).*

> **Roadmap Phase 1 objective:** turn SmartSapp's scattered server actions, APIs and AI helpers into one capability architecture. Existing server actions remain and become compatibility adapters: *legacy action → canonical capability → existing implementation*. Agents never call UI server actions directly; the capability layer is the only legitimate execution surface.

This plan follows the roadmap's Phase 1. It is cross-checked against:

| Source doc | What it contributes |
| :--- | :--- |
| `agents_mcp_roadmap.md` | Phase 1 architecture, exit criteria, strangler rule (§33), release gates (§34) |
| `agents_mcp_rules.md` | Rules 4, 16–22, 36, 39–40, 53, 60–69; §66 Phase 1 additions (idempotency, risk, version, concurrency, audit and egress contracts); §67 Agent Implementation Gate |
| `agents_mcp_tools.md` | P1 "shared execution gateway"; contract-test layer; §4.1 registry fields; §7 coverage matrix |
| `agents_mcp_ui.md` | Phase 1: every UI action maps to a capability; the button and the AI path call the same capability |
| `agents_mcp_prd.md` | MCP security middleware order (§73); canonical tool definition (§47); engineering invariants (§128) |
| `agents_mcp_idea.md` | "Agents interact through tools, never Firestore"; existing flows become capabilities |
| `agents_mcp_cloudrun.md` | Stateless execution, Cloud Tasks, 32 MB limit, dual-surface isolation |

Where the docs disagree, §2.3 records the resolution.

---

## 1. Decisions (approved 2026-09-27)

All six approved as recommended. D1, D2 and D4 were confirmed explicitly; D3, D5 and D6 by default. The auth hole in §2.2 is hotfixed **before** Phase 1 work, for portals, tasks and quick notes, as its own PR. The remaining unguarded files follow the audit remediation plan.

| # | Decision | Options | Recommended |
| :--- | :--- | :--- | :--- |
| **D1** | Which capability layer is canonical? There are two (§2.1). | (a) `src/platform` is canonical; the existing `src/lib/mcp` tools become thin wrappers over it. (b) Extend `src/lib/mcp` and drop `src/platform`. | **(a)**. `src/platform` has the stricter contract, the policy evaluator, verified approvals and tests. `src/lib/mcp` keeps its live `/api/mcp` endpoint, tool names and UI, but executes through the canonical gateway. |
| **D2** | First-wave scope | (a) Identity + CRM core (entities, contacts, tags, notes/activities, tasks, deals, pipelines) + Portals. (b) Identity + CRM only; Portals next. | **(a)**, in that order. Portals starts only after its auth hardening (§5, workstream 1.1). |
| **D3** | Persist domain events now or in Phase 2? | (a) Write emitted events to an append-only `domain_events` outbox now. (b) Declare events only. | **(a)**. It is one extra write per mutation, and Phase 2's exit gate becomes "consume the outbox" instead of "retrofit 45 capabilities". |
| **D4** | UI scope | (a) Invocation framework + migrate proof-point buttons only. (b) Also Global Command Bar v1 and Object Command Menu. | **(a)**. The command bar needs agent runtime and discovery (Phases 5–6) to be more than search. The UI doc lists the bar for Phase 1, but only as "v1"; we deliver the plumbing it sits on. |
| **D5** | Approvals: one store or two? | (a) One store: `capability_approvals`, with the `src/lib/mcp` approval engine and its queue UI moved onto it. (b) Keep both. | **(a)**. Two approval systems is exactly the drift Rule 69 forbids. The migration keeps the existing Pending Approvals UI. |
| **D6** | Permission vocabulary | (a) Reuse existing ids (`APP_PERMISSIONS`, industry `Permission`, `permissionsSchema` coordinates), adding new ids to `APP_PERMISSIONS` only where none exists (e.g. portals). (b) New capability-scope namespace. | **(a)**. One RBAC. No second permission system for agents. |

---

## 2. Where we are starting (verified 2026-09-27)

### 2.1 An agent stack already exists and Phase 0 missed it

About 13,700 lines of "CompanyBrain" agent infrastructure are live. None of it appears in the Phase 0 inventory:

| Area | What exists | Gap against the docs |
| :--- | :--- | :--- |
| `src/lib/mcp/` (2.8k lines) | Hand-rolled JSON-RPC gateway on protocol `2024-11-05`; registry; 12 tools (`crm.get_entity`, `crm.search_entities`, `deal.get`, `deal.update_stage`, `task.create`, `task.list`, `context.*`, `memory.*`); approval engine; API keys (`mcp_keys`); audit logs (`mcp_audit_logs`); governance actions; live route `src/app/api/mcp/route.ts` | Tools read and write `adminDb` directly (idea / roadmap §1: "agent never operates Firestore"). A second risk scale (`read_only / low_risk / high_risk / critical`). Session-token callers are labelled `callerType: 'user'`, the same agent-identity gap fixed in round 3. Old protocol (Rule 11); the SDK v2 upgrade is Phase 5. |
| `src/lib/agents/` (2.1k lines) | Domain specialists (revenue, SDR, meeting, knowledge, governance, operations) and a swarm orchestrator, calling `McpGateway.handleRequest` | Already consumes MCP tools, so it inherits whatever the gateway enforces. |
| `src/lib/memory/` (~8.8k lines) | Memory repository, Qdrant client, embeddings, knowledge graph, context builder, conflict and freshness engines, consolidation, note→memory pipeline | This is PRD Phases 1–6 and roadmap Phase 4 territory. Out of Phase 1 scope except the memory/context tools already exposed through MCP. |
| UI | `admin/companybrain/tools`, backoffice CompanyBrain, `McpApiKeysCard`, `LiveToolRunnerModal`, `PendingApprovalsQueue`, `ToolCatalogTable`, workflow simulator | Must keep working (the user's rule 3: nothing breaks). |

**Consequence:** Phase 1 is a **consolidation**, not a greenfield build. There must be exactly one registry, one execution gateway, one risk scale, one approval store and one audit trail.

### 2.2 Other facts that shape the plan

- **Auth coverage has a blind spot.** The audit remediation metric (`docs/audit/app_audit_fix.md` Phase 4) reports **303 / 330** `adminDb` server-action files guarded. It only counts files that touch `adminDb` directly, so it misses `'use server'` files that delegate to services. **82 such files, exporting 424 actions, have no guard.** They include all six portal action files (80 actions; the acting user is a parameter defaulting to `'system_admin'`), `task-actions.ts`, `quick-notes-*`, `community-actions`, `learning-actions`, `law-actions`, `real-estate-actions` and `call-centre-actions`. A capability that wraps an unauthenticated action would launder the hole into the agent layer, so Phase 1 must close these for every file it wraps.
- **Permissions:** three coexisting models (flat `APP_PERMISSIONS`, hierarchical `permissionsSchema` via `evaluatePermission`, industry `Permission`), all reachable through `checkWorkspacePermission` / `checkPermission`. There are no portal permission ids.
- **Reads:** the CRM UI reads Firestore directly from the browser (28 client files). Server-side read and search capabilities mostly **do not exist** and must be built (tools §7 status `missing`). The CRM agent (roadmap Phase 9) is mostly reads.
- **Zod:** the app uses `zod@3.25` (v3 API); `src/platform` uses the `zod/v4` API from the same package. Capability schemas are written in `zod/v4`; wrapped legacy code keeps its v3 schemas.
- **Phase 0 is not certified.** Plan §6 of Phase 0 is still open. Items that block Phase 1 work are absorbed as workstream 1.0.
- **No OpenTelemetry** in the repo (Rule 39: "from day one"). Playwright E2E exists (`pnpm test:e2e`).

### 2.3 Where the source docs disagree

| Topic | Conflict | Resolution in this plan |
| :--- | :--- | :--- |
| What "Phase 1" is | Roadmap: capability layer. PRD: Notes & Memory. Tools P1: execution gateway. UI: command bar and context actions. | Roadmap order (as you asked). The tools-doc gateway is the core of the capability layer, so it's in. The PRD memory work is largely built already; it stays in roadmap Phase 4. UI per D4. |
| Domain folders | Roadmap: `domains/{crm,sales,marketing,meetings,finance,media,experience,school}`. Phase 0: 18 capability domains. | Folders use the 18 canonical domain ids (`src/platform/domains/<domain_id>/`), so code, inventory and registry agree. |
| Risk scales | Roadmap / PRD / tools / existing MCP each differ | Canonical L0–L4 (`risk-levels.ts`, mapping in `docs/agentic/05-permission-model.md`). MCP mapping: `read_only→L0`, `low_risk→L2`, `high_risk→L3`, `critical→L4`. |
| MCP SDK | Tools doc says `@modelcontextprotocol/sdk` (v1); rules say v2 `server` | v2 (Rule 11), as Phase 0 already chose. The transport rewrite of `/api/mcp` is Phase 5. |

---

## 3. Objective and exit criteria

**Objective:** every in-scope domain operation runs through one governed execution gateway, whether it is invoked by the UI, an MCP client, an agent, an automation or a Cloud Task. Existing behaviour is preserved and proven by the baseline.

**Phase 1 exits when, for every capability in §4:**

1. Roadmap exit criteria: it has typed input, typed output, permission requirements, workspace scope, audit behaviour, an error contract, an idempotency definition, event behaviour and test coverage.
2. Rules §66 Phase 1 contracts: risk, version, concurrency (`expectedVersion` for mutations), audit and egress are declared **and enforced by the gateway**, not only declared.
3. Tools P1 exit: representative read, write and approval-required capabilities pass authorization and isolation tests. The roadmap Layer 2 contract suite passes for every capability: valid input, invalid input, missing permission, wrong workspace, wrong organization, wrong entity, duplicate execution, timeout, external failure, partial failure.
4. UI Phase 1 deliverable: at least one migrated button and the equivalent AI/MCP call hit the **same** capability (proved by a test that asserts one audit record shape from both paths).
5. Rule 69: exactly one registry, gateway, risk scale, approval store and audit trail. The `src/lib/mcp` tools execute through the gateway.
6. The baseline (`pnpm test:agentic:baseline`) stays green, plus new Phase 1 contract suites. Typecheck and lint are clean. No `any`, `any[]` or unchecked casts in new code (Rule 4).
7. Backoffice can list capabilities, disable any capability globally or per tenant, and inspect executions without a code change (Rules 60, 61; non-negotiable #15).

---

## 4. Scope: first-wave capabilities

Chosen from what the Phase 9 CRM agent needs (roadmap: *search contacts, notes, deals, meetings, activities, tasks, knowledge; create tasks; prepare follow-ups; update CRM metadata*), plus identity and portals. Status uses tools §7.1 terms: **wrap** (existing implementation behind the contract), **extend** (exists but needs auth, validation or version checks), **build** (no server-side implementation today).

### Wave A — Identity & Access (`identity_access`)

| Capability | Risk | Implementation today | Status |
| :--- | :--- | :--- | :--- |
| `identity.actor.get_current` | L0 | `requireAuth` | wrap |
| `identity.workspace.list_accessible` | L0 | profile `workspaceIds` | wrap |
| `identity.workspace.get` | L0 | workspace doc read | build |
| `identity.access.check_permission` | L0 | `checkWorkspacePermission` | wrap |
| `identity.access.list_effective_permissions` | L0 | permission engine | build |

### Wave B — CRM core (`crm_contacts`, `deals_revenue`, `tasks_productivity`, `knowledge_memory` (notes only))

| Capability | Risk | Implementation today | Status |
| :--- | :--- | :--- | :--- |
| `crm.entity.search` | L0 | client-side queries; MCP `crm.search_entities` hits `adminDb` | build |
| `crm.entity.get` | L0 | `contact-adapter.getEntity`; MCP `crm.get_entity` | wrap |
| `crm.entity.get_timeline` | L0 | `activity-actions.getActivitiesForContact` | wrap |
| `crm.entity.create` | L2 | `entity-actions.createEntityAction` | wrap |
| `crm.entity.update` | L2 | `entity-actions.updateEntityAction` | extend (version) |
| `crm.workspace_entity.update` | L2 | `workspace-entity-actions.updateWorkspaceEntityAction` | extend (version) |
| `crm.workspace_entity.archive` | L4 | `archiveEntityAction` | wrap (approval for agents) |
| `crm.entity.add_tag` / `crm.entity.remove_tag` | L2 | `scoped-tag-actions.applyTagAction` / `removeTagAction` (tags SSOT) | wrap |
| `crm.entity.list_tags` | L0 | `getEntityTagsAction` | wrap |
| `crm.activity.create` / `crm.note.create` | L2 | `activity-logger`, `note-actions.logNoteActivity` | wrap |
| `task.search`, `task.get` | L0 | client-side; MCP `task.list` | build |
| `task.create`, `task.update`, `task.complete` | L2 | `src/lib/tasks/task-core.ts` (`createTaskCore` / `updateTaskCore`, explicit `TaskActor`); session wrappers in `src/lib/task-server-actions.ts` (guarded in 1.1a) | wrap |
| `deal.search`, `deal.get` | L0 | MCP `deal.get` (`adminDb`) | build |
| `deal.create` | L2 | `deal-actions.createDeal` | wrap |
| `deal.update` | L2 | `updateDealAction` / `updateDealDetailsAction` | extend (version) |
| `deal.advance_stage` | L2 | `updateDealStageAction`; MCP `deal.update_stage` | wrap |
| `deal.assign_owner` | L2 | `updateDealOwnerAction` | wrap |
| `pipeline.list`, `pipeline.get` | L0 | client-side | build |

### Wave C — Experience Portals (`experience_portal`), after workstream 1.1 hardening

| Capability | Risk | Implementation today | Status |
| :--- | :--- | :--- | :--- |
| `portal.get`, `portal.list` | L0 | `PortalService` | wrap |
| `portal.membership.list` / `get` | L0 | `PortalMembershipService.listMembers` / `getMembership` | wrap |
| `portal.membership.create` | L2 | `createMembership` — fix the KNOWN RISKs: org-aware dedupe, no `'default'` workspace, no `'system'` actor | extend |
| `portal.membership.update_role` / `suspend` / `reactivate` | L2 | `updateRole` etc.; field allowlist (no tenant-id overwrite) | extend |
| `portal.membership.remove` | L4 | `deleteMembership` (report a missing record honestly) | extend |
| `portal.publish` | L3 | `PortalService.publishPortal` (public exposure) | extend |

That is about 45 capabilities. **Out of scope:** messaging and campaigns, finance, meetings, lead intelligence, media, automations, school operations, analytics (waves in later phases); memory internals (roadmap Phase 4); retiring legacy actions (only after parity, a later phase).

---

## 5. Workstreams

Sizes are relative (S ≈ ≤1 day, M ≈ 2–4 days, L ≈ 1–2 weeks), per tools §10: "run the repository audit before estimating". Each workstream is its own PR with its own exit check.

### 1.0 — Entry: absorb blocking Phase 0 items (M)
- [ ] Commit Phase 0 on a branch (lockfile included).
- [ ] Extend the inventory scanner to `src/lib/mcp/tools`, `src/lib/agents`, `src/lib/memory` (roadmap Phase 0 "existing agent-like components"), and regenerate the matrix.
- [ ] Fix the audit metric blind spot: count every `'use server'` file, not only `adminDb` ones. Record the new baseline (82 files / 424 actions).
- [ ] Triage the auth-gap list **for files wrapped in Waves A–C only**. The rest stays on the audit remediation plan (batches 4b–4e).
- [ ] Rotate `CLOUD_TASKS_SECRET`, remove the hardcoded fallbacks, and verify the Cloud Tasks OIDC token in the worker (round-3 #4). Needed before any capability runs via the worker.
- **Exit:** Phase 0 branch merged to a staging branch; matrix includes the CompanyBrain stack; auth list for wrapped files agreed.

### 1.1a — Urgent hotfix, separate PR, before 1.0 (M) — *code complete 2026-09-27, not yet committed*
- [x] Authenticate `portal-actions`, `membership-actions`, `learning-actions`, `community-actions`, `ai-experience-actions`, `portal-analytics-actions`, `task-server-actions` and `quick-notes-actions`, using the audit Phase 4 pattern. Update call sites; keep public (unauthenticated member-facing) paths explicitly public and documented.
- [x] Extended to the remaining portal files: `engagement-actions`, `commerce-actions`, `content-actions`, `credential-actions`, `event-actions`, `enterprise-actions`, plus `quick-notes-ai-actions` and the `/api/tasks` routes.

**Correction to §2.2 / §4.** `src/lib/task-actions.ts` is `'use client'` (Firestore client SDK under security rules), not an unguarded server action. The server-side task surface is `src/lib/task-server-actions.ts`, and that is what the `task.*` capabilities wrap.

**How identity works now.**
- Portal staff: session + same organization via `requirePortalAdmin(portalId)` / `requirePortalOrganizationAdmin(orgId)`; records checked with `assertRecordInPortal`. The organization is always taken from the portal, never the caller.
- Portal members: Firebase ID token → `requirePortalUser` / `requirePortalMember` (`src/lib/auth/require-portal-access.ts`). Client components pass `await user.getIdToken()`.
- Mixed read endpoints (courses, content): `isPortalAdminCaller` — staff see drafts, everyone else is pinned to published.
- Tasks: core/wrapper split per the audit Phase 4 lesson. `src/lib/tasks/task-core.ts` is **not** `'use server'` and takes an explicit `TaskActor` (`user` uid or trusted `system` source). Session-less server callers (MCP gateway, call-centre engine, form pipeline, automation engine) use the core; browser callers use the session-guarded wrappers; `/api/tasks` uses `authenticateApiRequest`.

**Additional holes found and closed while doing this.**
| Finding | Fix |
|---|---|
| Checkout marked every order `completed` and provisioned courses/plans with no payment gateway at all (free paid content, coupon burn, affiliate commission inflation) | Paid orders are `pending` and provision nothing until a verified payment exists (`CommerceService.processCheckoutOrder`). `PORTAL_CHECKOUT_SIMULATE_PAYMENTS=true` re-enables demo settlement outside production only. Offers must belong to the portal; fixed commissions are capped at the amount paid |
| `createTaskAction` skipped permission checks for any caller-supplied `userId` starting with `system-`; `createTaskFromAutomation` and `getTasksForContact` were public | Session wrappers only; `system` actors exist only in the non-HTTP core |
| `updateTaskAction` checked permission against a caller-chosen workspace; bulk actions accepted task ids from any workspace | Stored workspace is authorized; tenant fields immutable on update; bulk refuses foreign ids |
| `/api/tasks` GET/POST/PATCH/DELETE were unauthenticated | Bearer ID token + workspace membership, permission-checked as the caller |
| `quick-notes-ai-actions` trusted a caller-supplied `userId` for every AI call and task creation | Session uid via `requireWorkspace` |
| `enterprise-actions` returned raw `err.message` (F9); hierarchy nodes could be grafted onto another organization's tree | Opaque errors; parent must be in the same organization |
| `CohortRosterModal` passed `portalSlug` as `portalId` to `removeCohortMemberAction` (pre-existing bug) | Fixed |

**Verification.** `tsc` 0 errors; ESLint 0 errors on touched files; full Vitest suite 682 files / 5188 tests pass; agentic baseline 444 pass. New tests: `require-portal-access.test.ts`, `portal-auth-hotfix.test.ts`, `commerce-checkout-security.test.ts` (mutation-checked), `task-server-actions-auth.test.ts`.

**Round 4 review fixes (2026-09-28).** Items 1–6 of the senior review are implemented; see [agents_mcp_phase_1_1a_review_fixes_plan.md](./agents_mcp_phase_1_1a_review_fixes_plan.md). They cover:
- self-enrol plan bypass;
- lesson↔course binding;
- community author spoofing and space gating;
- the gated content leak, including the Firestore rule;
- task tenant derivation and `/api/tasks` validation;
- invitation redemption.

Remaining before merge:
- the PR split (item 7);
- the export-sweep guard test;
- a staging smoke run;
- a separately approved `content_items` rule deploy, after the app release.

**Open follow-ups (not blockers for the PR).**
- No Playwright coverage for portal member flows (join, enroll, post, checkout, event registration). Manual smoke test on staging before merge.
- Public certificate verification (`/portal/[slug]/verify/[code]`) serialises `recipientEmail` to the browser — minimise.
- Event self check-in lets a member claim a full-duration attendance (points). Bind to join/leave timestamps.
- Paid checkout needs a real gateway + verified webhook to settle `pending` orders.
- `identity-resolution.ts` is itself `'use server'`; its exports need their own review (it now uses the task core as a system actor).

### 1.1 — Authenticate the files Phase 1 wraps (M)
Uses the audit Phase 4 pattern exactly: delete the identity parameter, derive identity with `requireWorkspace` / `requireOrganization`, keep the existing permission check fed with the verified uid, and let TypeScript find the call sites.
- [x] ~~`task-actions.ts`~~ → `task-server-actions.ts`, `quick-notes-actions.ts`, `quick-notes-ai-actions.ts` (done in 1.1a). `activity-actions.ts` gaps remain.
- [ ] Portal files: authentication done in 1.1a. Remaining here: add portal permission ids to `APP_PERMISSIONS` per D6 (`portals_view`, `portals_manage`, `portal_members_manage`) and to the permissions-schema mapping.
- [ ] Widen the `no-restricted-syntax` identity-parameter lint rule (audit Phase 4) to these files and to `src/lib/**/*actions*.ts`.
- **Exit:** these files show zero auth gaps in the matrix; baseline and Portal suites green (the KNOWN RISK assertions for the actor attribution change deliberately in this PR).

### 1.2 — One execution gateway (L)
The tools-doc "shared execution gateway". It replaces the three partial pipelines that exist today (the MCP handler, the agent-step executor, `src/lib/mcp/gateway`).
- [ ] `src/platform/capabilities/execution/execute-capability.ts`: `executeCapability(id, rawInput, invocation)`. The pipeline follows PRD §73 and the tools §4 diagram:
  1. resolve principal;
  2. kill switch and flags (§5 1.6);
  3. validate input (Zod v4);
  4. tenant binding (input may not name another tenant);
  5. resource ownership check (capability-provided `resolveResourceScope`: e.g. the entity belongs to the workspace), resolving round-3 #8;
  6. authorize (evaluator);
  7. verified approval for approval-requiring agent calls;
  8. idempotency lookup and replay;
  9. concurrency check (`expectedVersion`);
  10. execute with timeout;
  11. validate output;
  12. write audit and outbox events;
  13. return a typed result.
- [ ] `invocation` carries the surface (`ui`, `mcp`, `agent`, `automation`, `task_worker`), `correlationId`/`causationId`, the idempotency key and dry-run.
- [ ] Refactor `buildDomainMcpServer`, `processAgentStep` and the dispatcher onto it (no behaviour change; their test suites must stay green).
- [ ] Typed error contract `src/platform/capabilities/errors/`: `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `TENANT_SCOPE`, `VERSION_CONFLICT`, `APPROVAL_REQUIRED`, `DUPLICATE_IN_PROGRESS`, `DISABLED`, `RATE_LIMITED`, `TIMEOUT`, `UPSTREAM`, `INTERNAL`. Each carries `retryable` and a user-safe message. Mappings to server-action results, MCP JSON-RPC codes and HTTP statuses.
- **Exit:** gateway unit suite covers every pipeline step with refusal cases; the MCP and worker suites pass unchanged through the gateway.

### 1.3 — Principal resolution on the existing RBAC (M)
- [ ] `resolvePrincipalFromSession(workspaceId)`: `requireWorkspace`, then `grantedScopes` = every permission id the **existing** engine grants in that workspace (`checkWorkspacePermission` over `APP_PERMISSIONS`; `permissionsSchema` honoured through `mapLegacyPermissionToCoordinates`). `actorType: 'user'`. Memoized per request (one profile read, not N).
- [ ] `resolvePrincipalForAgent(user, agentId, delegation)`: user scopes ∩ agent allowlist (Rule 16). `actorType: 'agent'`.
- [ ] `resolvePrincipalFromMcp(request)`: API key → key role and allowed categories; session → the user's scopes. **Always `actorType: 'agent'`**, fixing the existing `/api/mcp` `callerType: 'user'` mislabel.
- [ ] Parity test: for a matrix of role templates (`role-templates-qa`), `resolvePrincipalFromSession` grants exactly what `checkWorkspacePermission` grants.
- **Exit:** no capability declares a permission id that isn't in the existing vocabulary (enforced by a registry test).

### 1.4 — Durable execution records: idempotency, audit, outbox (M)
- [ ] `capability_executions/{executionKey}` records (tools §6.3 envelope): execution id, capability id and version, actor, tenant, policy decision, approval refs, status (`running / succeeded / failed / unknown`), result ref, error code. Idempotency replay returns the stored result. A key seen `running` returns `DUPLICATE_IN_PROGRESS`. "No response" is never treated as "failed" (Rule 20).
- [ ] Append-only audit (Rule 40): `capability_audit/{id}` written on every decision (allow, deny, approval required). Firestore rules deny update and delete. Hash chaining (`prevHash`) per workspace.
- [ ] `domain_events` outbox (D3): events returned by capabilities, validated against `DomainEventSchema`, written in the same batch as the execution record.
- [ ] Migrate `mcp_audit_logs` writers to the new audit and keep reading the old collection in the backoffice view until it ages out.
- [ ] Batch sizes ≤ 250 writes (PRD invariant 14).
- **Exit:** a duplicate-execution contract test proves one side effect; the audit record is immutable under rules tests (emulator).

### 1.5 — Capability adapters, Waves A → B → C (L each wave)
Per capability, the strangler steps from roadmap §33 and `docs/agentic/14-migration-plan.md`:
1. Baseline exists (manifest suite or a new characterization test).
2. Write a `CapabilityDefinition` in `src/platform/domains/<domain_id>/`: Zod v4 schemas, permission ids, risk, execution limits, policies, egress class, events, `implementationRef`, `resolveResourceScope`.
3. The handler calls the **existing** implementation (wrap) or new server-side reads (build) — never duplicate business logic.
4. Contract suite passes (generated from the definition; roadmap Layer 2 list).
5. Register via the domain registrar in `register-capabilities.ts`.
6. Point the legacy server action at `executeCapability` behind the per-capability flag. Its public signature is unchanged (identity parameters already removed in 1.1).
7. Baseline and E2E green → flag on for a canary workspace → default on.

Wave-specific requirements:
- **B:** `expectedVersion` uses the existing `updatedAt` token (the quick-notes optimistic-concurrency pattern, Rule 18). Build reads mirror the Firestore rules' visibility (`hasWorkspaceAccess`) and are paginated and bounded (Rule 28: max results, cursor).
- **C:** fix the five KNOWN RISK behaviours in `portal-membership.baseline.test.ts`, updating those assertions in the same PR.

**Exit per wave:** every capability in the wave meets §3; the matrix shows its status as `reuse`.

### 1.6 — Flags, kill switches and the backoffice control plane (M)
- [ ] Three-level flags (Rule 64, doc 14): `system_settings/ai_config.capabilities`, `organizations/{id}.capabilityFlags`, `workspaces/{id}.capabilityFlags`. Per capability: `enabled`, `agentEnabled` (agents off while humans stay on), `mcpEnabled`. Evaluated in the gateway and cached ≤ 60 s.
- [ ] Global "Disable autonomous execution" switch (Rule 60).
- [ ] Backoffice (`goadmin`, `authorizeBackoffice`, APP_SURFACE-isolated):
  - capability registry viewer (definition, schema, risk, permissions, version, tests, `implementationRef`);
  - flag editor with audit;
  - execution and audit explorer;
  - the approvals queue moved onto `capability_approvals` (D5).
- **Exit:** an operator disables `task.create` for one workspace without a deploy, and both the UI path and the MCP path refuse with `DISABLED`.

### 1.7 — Consolidate the existing CompanyBrain MCP stack (M)
- [ ] Each existing `src/lib/mcp/tools/*` tool becomes a thin mapping onto a canonical capability, keeping its public tool name for existing clients (`crm.get_entity` → `crm.entity.get`, `task.create` → `task.create`, `deal.update_stage` → `deal.advance_stage`, …). Direct `adminDb` access is removed from tools.
- [ ] `McpRegistry` lists canonical capabilities through an adapter. The risk scale maps per §2.3. The `src/lib/mcp` approval engine is replaced by `capability_approvals` (D5), with the existing `PendingApprovalsQueue` re-pointed at it.
- [ ] Memory and context tools keep their `src/lib/memory` implementations but execute through the gateway (auth, flags, audit). Their internals stay in roadmap Phase 4.
- [ ] `src/lib/agents` specialists need no change; they inherit the gateway through `McpGateway`. Add a test that a specialist's call is audited and gated.
- **Exit:** `grep adminDb src/lib/mcp/tools` returns nothing; the existing MCP suite and UI tests pass; one registry.

### 1.8 — UI invocation framework, D4 option (a) (M)
- [ ] One server action, `invokeCapabilityAction(capabilityId, input, options)`: session principal → `executeCapability` → serialisable typed result.
- [ ] Client hook `useCapability(id)` with loading, error, conflict and permission-denied states (UI doc §62 state discipline); errors say whether state changed (UI doc §53).
- [ ] Proof points (UI doc Phase 1 deliverable):
  - the **Create task** button and the MCP `task.create` call use the same capability;
  - **Add tag** and **Advance deal stage** likewise.
  - Mobile targets ≥ 44 px; accessible error text (UI doc §69–72).
- **Exit:** E2E journeys create contact, create deal, create task and advance stage pass through the gateway (UI doc Phase 0/1 validation list; closes the Gate A E2E gap).

### 1.9 — Docs generated from the registry, and telemetry (S)
- [ ] `pnpm capabilities:docs` generates `docs/agentic/capabilities.md` and JSON Schemas from the registry (roadmap §25). A test fails if the docs drift from the registry.
- [ ] Structured logs with `correlationId` / `executionId` on every gateway call now. **OpenTelemetry** (Rule 39) exporter wiring is a proposed follow-up: no OTel exists today, and adding it is a dependency decision (Rule 53).

---

## 6. Testing strategy

| Layer (roadmap §13) | Phase 1 content |
| :--- | :--- |
| Unit | Gateway steps, principal resolvers, flag evaluation, error mapping, idempotency state machine |
| Capability contract | Generated per capability from its definition: valid input; invalid input; missing permission; wrong workspace; wrong org; wrong entity (resource scope); duplicate; timeout; upstream failure; partial failure; agent without approval (L3/L4); disabled flag |
| MCP conformance | `tools/list` and `tools/call` through the existing `/api/mcp` and the new builder: authorization, malformed request, schema violation |
| Tenant isolation | Roadmap Layer 4, "100% denied, 0 leakage": agent from workspace A reads workspace B; org A invokes a workspace B tool; limited scope attempts a privileged capability; expired delegation; sub-agent inheriting parent privileges |
| Baseline | `pnpm test:agentic:baseline` stays green; each wave adds its capability suites to the manifest |
| E2E | Playwright journeys in 1.8 |
| Firestore rules | Emulator tests for `capability_executions`, `capability_audit`, `domain_events`, `capability_approvals` (server-only, append-only audit) |

Every PR: `tsc --noEmit`, eslint, baseline, the affected suites. Full suite before each wave's flag goes on (Rule 5: staging first; production needs approval).

---

## 7. What could go wrong, and mitigations

| Risk | Mitigation |
| :--- | :--- |
| Behaviour drift when legacy actions delegate | Wrap, don't rewrite; per-capability flag; baseline and E2E gate; canary workspace first; instant rollback via flag |
| Double side effects on retries | Execution records plus idempotency replay; contract test "same key ⇒ one effect" (round-3 #5) |
| Extra Firestore cost and latency (principal, flags, idempotency, audit, outbox) | Per-request principal memo; flags cached ≤ 60 s; reads skip idempotency and outbox; audit + execution + outbox in one batch; measure p95 before and after on canary (Rule 54) |
| Removing identity params breaks client call sites | TypeScript finds them (audit Phase 4 method); one domain per PR |
| Two MCP stacks confuse clients | Keep `/api/mcp` and tool names stable; only the execution path changes |
| Permission mismatch between UI and agents | Principal resolver built on the existing engine plus a parity test over role templates |
| Portal hardening changes visible behaviour (actor attribution, dedupe) | Deliberate, in 1.1 / 1.5-C, with KNOWN RISK assertions updated in the same PR and noted in the release notes |
| Scope creep into memory or agent runtime | Explicit out-of-scope list (§4); memory stays roadmap Phase 4 |
| Zod v3/v4 mix | Capability schemas in `zod/v4` only; legacy schemas untouched; no cross-version composition |
| Cold starts and timeouts on Cloud Run | Gateway overhead budget ≤ 50 ms p95 for reads; heavy work stays on Cloud Tasks |

---

## 8. Features affected, and how backoffice manages them

- **Affected:**
  - every UI screen whose action is migrated (same behaviour, now audited and flag-controlled);
  - CompanyBrain tools, approvals queue, API keys and workflow simulator (same UI, new execution path);
  - domain specialists (inherit gating);
  - portal admin screens (auth now required; actor attribution now real).
- **Backoffice without code:**
  - enable or disable any capability globally, per org or per workspace;
  - turn agents off per capability while humans stay on;
  - global autonomous-execution kill switch;
  - inspect executions and audit;
  - approve or reject approval requests;
  - view the registry and its generated docs.

---

## 9. Definition of done (Phase 1 release gates, roadmap §34)

- **A — Functional:** §3 items 1, 3, 4 and 6 met for all ~45 capabilities; E2E journeys green.
- **B — Security:** tenant-isolation suite 100% denied; no auth gaps in wrapped files; the MCP identity mislabel fixed; audit immutable; secrets rotated and OIDC verified.
- **C — Agentic:** the existing MCP tools and specialists execute through the canonical capabilities, with generated docs and schemas discoverable via `tools/list`.
- **D — Evaluation:** not a Phase 1 gate. Capture baseline latency and error rates per capability for the Phase 15 evaluation work.
- The rules §67 Agent Implementation Gate checklist is answered in each capability's definition PR; "not applicable" answers are explained.

---

## 10. Order and dependencies

```text
1.0 entry ──► 1.1 auth hardening ──┐
     └──────► 1.2 gateway ─► 1.3 principals ─► 1.4 records ─┬─► 1.5 Wave A ─► Wave B ─► Wave C
                                                            ├─► 1.6 flags + backoffice
                                                            ├─► 1.7 MCP consolidation (after Wave B tools exist)
                                                            └─► 1.8 UI framework (after 1.5 Wave B task.create)
1.9 docs/telemetry runs alongside from 1.5 onward
```

Nothing ships to production without staging verification and your approval (Rule 5). No push to origin until you ask.
