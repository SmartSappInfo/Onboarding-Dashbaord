# SmartSapp Agentic & MCP Transformation: Phase 1 Master Implementation Plan
## Canonical Domain Capability Layer & UI/UX Integration

**Version:** 1.2.0 (Updated: Registry Unified First in Milestone 1)  
**Status:** PROPOSED FOR USER APPROVAL  
**Authors:** Principal Systems & AI Agentic Architecture Engineer  
**Governing Documents & Foundations:**
- [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (Phase 1, §4, §33, §34, §36)
- [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) (Rules 4, 11–25, 28, 34, 36, 39–40, 47–53, 60–69; §66 Phase 1 Contracts; §67 Implementation Gate; §68 Non-Negotiables)
- [`docs/agents_mcp/agents_mcp_ui.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_ui.md) (§8–9, §43, §50, §53, §62, §65, §67–72, §80, §82)
- [`docs/agents_mcp/agents_mcp_prd.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_prd.md) (§47, §73, §128)
- [`docs/agents_mcp/agents_mcp_tools.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_tools.md) (§4, §4.1, §6.3, §7, §10)
- [`docs/agents_mcp/agents_mcp_cloudrun.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_cloudrun.md) (Cloud Run Serverless Topology)
- [`.agents/AGENTS.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/.agents/AGENTS.md) (FieldsVariablesService SSOT, TagSelector SSOT, Modal Architecture)

---

## 1. Executive Summary & Strategic Architecture

### 1.1 The Phase 1 Mission
Phase 0 successfully built, verified, and certified the execution engine (Grade A+):
- Canonical 16-step Execution Gateway (`executeCapability`)
- Standardized Error Contract & `stateChanged` invariant (`CapabilityError`, `toServerActionResult`, `toMcpToolError`, `toHttpError`)
- Durable Cloud Tasks worker with OIDC verification
- Stateless MCP SDK v2 tool handler
- SSRF and Cloud Run metadata guards
- Behavioral baseline regression suite (50 suites, 513 passing tests)

**Phase 1 turns SmartSapp from an app with scattered server actions and an isolated "CompanyBrain" chatbot into a unified, capability-driven operating system.**

Under the **Master Layering Axiom (Rule 69)**:
> **The capability layer is underneath the application, not an AI layer beside it.**
> When a human clicks "Create Task" in the CRM UI, and when an autonomous agent invokes `task.create` via MCP or Cloud Tasks, **both execute the exact same capability through the exact same 16-step gateway**, producing the exact same audit record and transactional domain events.

### 1.2 Architectural Decision: Unify the Registry First (Decision D1 Fast-Track)
In the initial roadmap outline, CompanyBrain MCP consolidation was scheduled late (PR-12). **This was recognized as an architectural risk**: maintaining two registries (`src/lib/mcp/registry.ts` and `src/platform/capabilities/registry/`) across 6 PRs creates split-brain tool discovery, dual risk scales, and desynchronized admin UI.

**Decision:** **We unify the registry FIRST in PR-5.**
1. `src/platform/capabilities/registry/capability-registry.ts` becomes the **exclusive**, single source of truth immediately.
2. `src/lib/mcp/registry.ts` (`globalMcpRegistry`) becomes a thin compatibility facade over the canonical registry.
3. The 12 legacy CompanyBrain tools (`memory.*`, `context.*`, `crm.*`, `deal.*`, `task.*`) are registered directly into the canonical registry as compatibility definitions with canonical L0–L4 risk mapping.
4. Tenant admin (`/admin/companybrain/tools`), `McpGateway`, and `supervisor-engine.ts` immediately query the canonical registry.
5. When Wave B-1 and B-2 capabilities arrive later in Phase 1, they perform **in-place upgrades** of the legacy tool handlers to the full 16-step execution gateway without breaking existing callers!

```
       ┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
       │     CRM Web / Mobile   │      │    MCP Tool Client     │      │   Cloud Tasks Worker   │
       │    (Interactive User)  │      │   (Autonomous Agent)   │      │    (Background Job)    │
       └───────────┬────────────┘      └───────────┬────────────┘      └───────────┬────────────┘
                   │                               │                               │
                   │ invokeCapabilityAction()      │ createCapabilityToolHandler() │ processAgentStep()
                   ▼                               ▼                               ▼
       ┌────────────────────────────────────────────────────────────────────────────────────────┐
       │                        CANONICAL EXECUTION GATEWAY (PR-4 Certified)                     │
       │                                executeCapability()                                     │
       │  01. Principal  │  02. Registry  │  03. Flags   │  04. Payload  │  05. Input Schema    │
       │  06. Tenant     │  07. Resource  │  08. RBAC    │  09. Approval │  10. Idempotency     │
       │  11. Version    │  12. Dry Run   │  13. Handler │  14. Output   │  15. Audit & Outbox  │
       └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                                   │
                                                   ▼
       ┌────────────────────────────────────────────────────────────────────────────────────────┐
       │                   UNIFIED CANONICAL CAPABILITY REGISTRY (Rule 69 SSOT)                  │
       │                   src/platform/capabilities/registry/capability-registry.ts             │
       │   (Single Source of Truth: Legacy McpRegistry delegates here; L0–L4 Canonical Risk)    │
       └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                                   │
                                                   ▼
       ┌────────────────────────────────────────────────────────────────────────────────────────┐
       │                        CANONICAL DOMAIN CAPABILITY WRAPPERS                            │
       │                               src/platform/domains/                                    │
       │   identity_access  │  crm_contacts  │  deals_revenue  │  tasks  │  experience_portal   │
       └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                                   │
                                                   ▼
       ┌────────────────────────────────────────────────────────────────────────────────────────┐
       │                           CORE DOMAIN SERVICES (Strangler Core)                        │
       │   EntityService  │  ContactAdapter  │  DealService  │  TaskCore  │  PortalMembership   │
       └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Governing Rules & Phase 1 Invariants Matrix

Every capability, resolver, adapter, and UI component authored in Phase 1 must strictly adhere to the following rules:

### 2.1 The Six Mandatory Phase 1 Contracts (Rule 66)
Every domain capability registered in Phase 1 MUST define and enforce:
1. **Idempotency Contract (Rule 19):** Every state mutation derives a deterministic SHA-256 idempotency key, acquires an atomic lease lock during execution, and returns cached outputs on replay without re-executing side effects.
2. **Risk Contract (Rule 12, Rule 21):** Strictly mapped to canonical `L0_READ` through `L4_PRIVILEGED_DESTRUCTIVE`. MCP tool annotations are treated as hints; server-side policy enforces `requiresAgentApproval`.
3. **Version Contract (Rule 18, Rule 20):** Optimistic concurrency verification using `expectedVersion` matching underlying record `updatedAt`. On conflict, fails with `VERSION_CONFLICT` and triggers `<VersionConflictDialog>`.
4. **Concurrency Contract (Rule 18):** In-progress lease locks prevent duplicate concurrent mutations under identical idempotency keys, releasing atomically in `finally` blocks.
5. **Audit Contract (Rule 23, Rule 24):** Decision and outcome written to append-only `capability_audit` with running SHA-256 `prevHash` chain per workspace. Trace context (`correlationId`, `causationId`) propagated.
6. **Egress Contract (Rule 34, Rule 36):** Outbound webhooks and external HTTP requests must pass through `safe-url-fetch.ts`, blocking loopback, link-local metadata (`169.254.169.254`), and RFC-1918 subnets.

### 2.2 The Agent Implementation Gate (Rule 67)
No capability or adapter is complete until all 10 gate criteria are satisfied:
1. **Architecture:** Uses canonical `CapabilityDefinition`; zero direct Firestore access from agents; emits typed `DomainEvent`.
2. **Authority:** Synchronous least-privilege evaluation ($\text{User} \cap \text{Agent} \cap \text{Workspace} \cap \text{Tool}$); agents blocked from `*` and non-delegable operations (Rule 16, 17).
3. **Data Trust:** Inputs validated via Zod v4; pre-parsing byte check enforces 32 MB ceiling (Rule 5); output validated before returning (Rule 50).
4. **Execution:** Fully idempotent; supports dry-run simulation where applicable; bounded by `maxDurationMs` with `AbortSignal` (Rule 3).
5. **Protocol:** Stateless MCP SDK v2 (`@modelcontextprotocol/server`, Protocol Revision 2026-07-28) (Rule 11).
6. **Failure Modes:** Explicit `stateChanged: 'no' | 'yes' | 'unknown'` invariant on all outcomes (Rule 51).
7. **Security:** Anti-IDOR: cross-tenant and non-existent records masked as 404 `NOT_FOUND` (Rule 49); zero info disclosure (Rule 52).
8. **Operations:** Operable without code: controllable via `platform_features` kill-switches and backoffice consoles (Rule 15, 60, 62).
9. **Testing:** Unit tests, contract suites (`define-contract-suite.ts`), same-capability parity tests, and baseline regression suites pass (Rule 42, 69).
10. **Migration:** Zero regression of preexisting UI or API functionality; backward-compatible adapters for legacy callers (Rule 1).

### 2.3 UI/UX & Single Source of Truth Invariants (.agents/AGENTS.md & theme.md)
1. **Fields & Variables SSOT:** All template and script dynamic variable interpolations must route strictly through `FieldsVariablesService.resolveTemplateVariables` and `<VariablesPanel>`.
2. **Tag Selection SSOT:** Tag application in UI must route strictly through `<TagSelector>`. Direct text input for tags is forbidden.
3. **Standardized Modal Architecture (theme.md Section 8):**
   - Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
   - Header: `<DialogHeader demarcated>` (`min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5`).
   - Zero raw descriptions: routed through `<CardInfoTooltip text="..." />` alongside title with `<DialogDescription className="sr-only">`.
   - Single-circle info tooltip button (`z-[10050]`).
   - Footer: Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`).
4. **Actionable Toast Navigation:** Errors prompting settings or review pass relative `actionConfig: { path: '/...', label: '...' }`.
5. **Mobile & Accessibility:** `min-h-[44px]` touch targets, bottom sheets on mobile viewports (< 768px), screen-reader live announcements (`aria-live="polite"`).

---

## 3. Phase 1 Roadmap & Milestones (PR-5 through PR-16)

```text
MILESTONE 1: Canonical Registry Unification, Identity & Durable Storage
  PR-5: Canonical Registry Unification & Legacy Tool Bridging (Rule 69 SSOT)
    │
    ▼
  PR-6: Principal Resolvers & RBAC Parity Suite
    │
    ▼
  PR-7: Durable Execution Records, Tamper-Evident Audit & Event Outbox

MILESTONE 2: Governance & Client Invocation Engine
  PR-8: Multi-Tier Capability Flags & Kill-Switches (platform_features integration)
    │
    ▼
  PR-9: UI Invocation Framework & Error/Conflict Surfaces (useCapability, ErrorNotice, ConflictDialog)

MILESTONE 3: Canonical Capability Waves & UI Proof Points
  PR-10: Wave A — Identity & Access (5 Capabilities)
    │
    ▼
  PR-11: Wave B-1 — Tasks, Tags, Notes (11 Capabilities) + TasksClient & TagSelector UI Migrations
    │  (In-place upgrade of legacy task.* tools in the unified registry)
    ▼
  PR-12: Wave B-2 — Entities, Deals, Pipelines (14 Capabilities) + KanbanBoard UI Migration
       (In-place upgrade of legacy crm.* & deal.* tools; optimistic drag & drop with rollback)

MILESTONE 4: Administrative Consoles & Context Actions
  PR-13: Backoffice Control Plane (/backoffice/ai/capabilities & executions)
    │
    ▼
  PR-14: Context Action System v1 (Object Action Menu on Entity/Deal/Task views)

MILESTONE 5: Experience Platform & Final Certification
  PR-15: Wave C — Experience Platform & Portals (7 Capabilities, fixing legacy Known Risks)
    │
    ▼
  PR-16: Generated Documentation, Telemetry Verification & Phase 1 Exit Certification
```

---

## 4. In-Depth PR Specifications

### Milestone 1: Canonical Registry Unification, Identity & Durable Storage

#### PR-5: Canonical Registry Unification & Legacy Tool Bridging (Workstream 1.7 Fast-Track) [Rules 4, 11, 12, 15, 60, 69]
- **Goal:** Establish strictly **ONE** registry across the entire codebase from Day 1, eliminating split-brain discovery and bridging all 12 legacy CompanyBrain tools into the canonical registry.
- **Deliverables:**
  1. `src/lib/mcp/registry.ts` Refactor:
     - `globalMcpRegistry` becomes a thin compatibility facade over `src/platform/capabilities/registry/capability-registry.ts`.
     - `listTools()` and `getToolDescriptors()` map directly from `listCapabilities()`.
     - `getTool(name)` delegates to `getCapability(id)`.
     - `registerTool(tool)` wraps legacy `McpToolDefinition` into `CapabilityDefinition` and registers it directly into the canonical registry.
  2. Legacy Risk Vocabulary Translation:
     - `read_only` $\to$ `L0_READ`
     - `low_risk` $\to$ `L2_STATE_MUTATION`
     - `high_risk` $\to$ `L3_EXTERNAL_COMMUNICATION_FINANCE`
     - `critical` $\to$ `L4_PRIVILEGED_DESTRUCTIVE`
  3. Legacy Tool Bootstrapping:
     - Register the 12 existing CompanyBrain tools (`memoryRecallTool`, `memoryRememberTool`, `crmGetEntityTool`, `dealUpdateStageTool`, `taskCreateTool`, etc.) into the canonical registry as compatibility capabilities.
  4. Tenant Tools Console Immediate Cutover:
     - `/admin/companybrain/tools` Catalog tab immediately queries the unified canonical registry.
     - Adds redirect from `/admin/settings/ai/capabilities` to `/admin/companybrain/tools`.
- **Verification:**
  - `src/platform/__tests__/mcp/registry-unification.test.ts`: Proves that querying `globalMcpRegistry` and querying `src/platform/capabilities/registry` return the exact same capabilities.
  - All existing MCP tests (`src/lib/mcp/__tests__/mcp-gateway.test.ts`) and supervisor tests pass with zero modification.

#### PR-6: Principal Resolvers & Parity Test Suite (Workstream 1.3) [Rules 4, 16, 17, 47, 48, 69]
- **Goal:** Bridge live auth tokens (Next.js cookies, portal JWTs, service credentials, MCP API keys) into canonical `AgentPrincipal` objects without bypassing RBAC.
- **Deliverables:**
  1. `src/platform/capabilities/policy/session-principal-resolver.ts`:
     - Resolves authenticated Next.js session via `requireWorkspace`.
     - Maps flat `app:` permissions from `APP_PERMISSIONS` and walks hierarchical coordinates `rbac:<section>.<feature>.<action>` from `permissionsSchema`.
     - Sets `actorType: 'user'`. Memoized per request lifecycle.
  2. `src/platform/capabilities/policy/portal-principal-resolver.ts`:
     - Resolves portal member JWTs via `requirePortalMember`.
     - Grants scoped `portal.member.*` permissions derived from membership tier, plan, and active enrollments.
  3. `src/platform/capabilities/policy/agent-principal-resolver.ts`:
     - Resolves delegated agent principal: evaluates intersection of user authority $\cap$ agent allowlist (Rule 16). Sets `actorType: 'agent'`.
  4. `src/platform/capabilities/policy/service-principals.ts`:
     - Eliminates blanket `system` bypasses.
     - Declares explicit allowlists for internal services (`service:automation`, `service:form_pipeline`, `service:call_centre`, `service:import`, `service:mcp_agent_key`).
  5. `src/platform/capabilities/policy/mcp-principal-resolver.ts`:
     - Resolves MCP API keys and session callers. Extracts `organizationId` strictly from verified credentials, never from arbitrary HTTP headers (preventing tenant spoofing).
- **Verification:**
  - `src/platform/__tests__/principal-resolvers.test.ts`: Parity suite proving that for every QA role template (`role-templates-qa.test.ts`), `resolvePrincipalFromSession` grants the exact same capabilities as `canUser` / `checkWorkspacePermission`.

#### PR-7: Durable Records, Audit Trail & Event Outbox (Workstream 1.4) [Rules 18, 19, 23, 24, 49, 51, 66]
- **Goal:** Implement tamper-evident persistence for capability executions, immutable audit trails, single-use approvals, and transactional domain events.
- **Deliverables:**
  1. `src/platform/capabilities/storage/execution-store.ts`:
     - Stores `capability_executions/{executionKey}` records containing input hash, output, stateChanged, duration, and Firestore TTL (`expiresAt: 24h`).
  2. `src/platform/capabilities/storage/audit-store.ts`:
     - Appends immutable decision logs to `capability_audit/{id}`.
     - Calculates running SHA-256 `prevHash` chain per workspace, guaranteeing tamper detection (Rule 23).
     - Denies all client reads/writes in Firestore security rules.
  3. `src/platform/capabilities/storage/outbox-store.ts`:
     - Persists emitted `DomainEvent` records into `domain_events/{id}` within Firestore transactions.
  4. `src/platform/capabilities/storage/approval-store.ts`:
     - Manages `capability_approvals/{id}` requests, supporting status transitions (`pending` $\to$ `approved` | `rejected` | `expired`).
     - Evolve `PendingApprovalsQueue.tsx` to read from this collection.
- **Verification:**
  - `src/platform/__tests__/storage/audit-immutability.test.ts`: Verifies hash-chain verification and rejection of mutated audit records.
  - `src/platform/__tests__/storage/idempotency-replay.test.ts`: Tests cache hits on identical idempotency keys returning cached results with zero duplicate side effects.

---

### Milestone 2: Governance & Client Invocation Engine

#### PR-8: Multi-Tier Capability Flags & Kill-Switches (Workstream 1.6a) [Rules 15, 60, 62, 64, 65]
- **Goal:** Provide instant runtime control over capabilities with global, organization, and workspace-level kill switches.
- **Deliverables:**
  1. `src/platform/capabilities/flags/evaluate-capability-flag.ts`:
     - Evaluates 6-tier precedence (cached $\le 60\text{ s}$):
       1. Global Kill-Switch (`platform_features/capability:<id>.killSwitch`)
       2. Global Autonomous Execution Switch (`system_settings/ai_config.autonomousExecutionEnabled` for agents/MCP)
       3. Workspace Override (`workspaceOverrides[workspaceId]`)
       4. Organization Override (`orgOverrides[organizationId]`)
       5. Progressive Rollout Rules (percentage-based canary, Rule 65)
       6. Capability Declared Default
     - Distinguishes surface flags: `humanEnabled`, `agentEnabled`, and `mcpEnabled`.
  2. Wire into Step 03 (`src/platform/capabilities/execution/pipeline/03-check-flags.ts`).
- **Verification:**
  - `src/platform/__tests__/flags/capability-flags.test.ts`: Tests hierarchical override precedence, surface-specific toggles, and cache invalidation.

#### PR-9: UI Invocation Framework & Error/Conflict Surfaces (Workstream 1.8a & §5.1) [Rules 4, 7, 51, 52, 53, 69, theme.md Section 8]
- **Goal:** Equip React components and Server Actions with standard, accessible capability invocation hooks, state management, and user-facing error/conflict recovery dialogs.
- **Deliverables:**
  1. `src/platform/capabilities/ui/invoke-capability-action.ts`:
     - Generic `'use server'` action. Resolves session principal $\to$ executes `executeCapability` (surface: `ui`) $\to$ returns typed `CapabilityUiResult<T>`.
  2. `src/platform/capabilities/ui/use-capability.ts`:
     - React hook returning `{ run, status, data, error, isRunning, reset }`.
     - Supports explicit statuses: `'idle' | 'running' | 'success' | 'error' | 'permission-denied' | 'disabled' | 'conflict' | 'approval-required'`.
     - Generates stable idempotency keys per user intent and reuses on retry.
  3. `src/platform/capabilities/ui/use-capability-availability.ts`:
     - Batched client hook querying capability availability (`'available' | 'disabled' | 'forbidden'`), allowing buttons and menus to disable/hide pre-flight.
  4. Standardized UI Components (strictly adhering to `.agents/AGENTS.md` and `theme.md` Section 8):
     - `<CapabilityErrorNotice error={...} />`: Renders user-safe explanation and actionable toast navigation (`actionConfig`). Explicitly signals state change ("No changes were saved" vs "This may have been saved — check before retrying").
     - `<VersionConflictDialog />`: Standardized modal displaying field-level diffs ("Your change" vs "Current value") with "Use current", "Keep mine", and "Review" buttons.
     - `<ApprovalRequiredNotice />`: Informs the user when an action triggered by an agent requires human sign-off, stating the exact risk level and linking to the Approvals Queue.
- **Verification:**
  - `src/platform/__tests__/ui/ui-framework.test.ts`: Hook state transitions, idempotency stability, and accessibility checks (`min-h-[44px]` touch targets, `aria-live` announcements).

---

### Milestone 3: Canonical Capability Waves & UI Proof Points

#### PR-10: Wave A Capabilities — Identity & Access (Workstream 1.5 Wave A) [Rules 2, 16, 17, 47, 66]
- **Capabilities Delivered:**
  1. `identity.actor.get_current` (`L0_READ`): Returns caller profile, tenant context, and effective scopes.
  2. `identity.workspace.list_accessible` (`L0_READ`): Lists workspaces accessible to caller.
  3. `identity.workspace.get` (`L0_READ`): Fetches workspace configuration and active modules.
  4. `identity.access.check_permission` (`L0_READ`): Evaluates target permission against caller.
  5. `identity.access.list_effective_permissions` (`L0_READ`): Returns enumerated permission coordinates.
- **Folder:** `src/platform/domains/identity_access/`
- **Verification:** Contract suite generator (`define-contract-suite.ts`) testing valid input, bad input, wrong org, foreign workspace, and audit emission.

#### PR-11: Wave B-1 Capabilities — CRM Tasks, Tags, Notes & UI Proof Points (Workstream 1.5 Wave B-1 & §5.2) [Rules 18, 19, 23, 49, 69, SSOT Invariants]
- **In-Place Upgrades:** Replaces legacy `task.create` and `task.list` compatibility entries in the unified registry with full 16-step capability handlers!
- **Capabilities Delivered:**
  - **Tasks:** `task.search`, `task.get`, `task.create`, `task.update`, `task.complete`
  - **Tags:** `crm.entity.add_tag`, `crm.entity.remove_tag`, `crm.entity.list_tags` (wrapping `scoped-tag-actions.ts`)
  - **Notes & Activity:** `crm.activity.create`, `crm.note.create`, `crm.entity.get_timeline`
- **Folder:** `src/platform/domains/tasks_productivity/`, `src/platform/domains/crm_contacts/`
- **UI Proof-Point Migrations:**
  1. `src/app/admin/tasks/TasksClient.tsx`:
     - Refactor task creation, editing, and inline status completion to route through `useCapability('task.create')` and `useCapability('task.complete')`.
     - Binds `<CapabilityErrorNotice>` on error and `<VersionConflictDialog>` on TOCTOU collision.
  2. `src/components/tags/TagSelector.tsx`:
     - Tag additions and removals route through `crm.entity.add_tag` and `crm.entity.remove_tag`.
     - Preserves Tag Selection SSOT while delegating to the capability gateway.
- **Verification:**
  - **Same-Capability Parity Test (`src/platform/__tests__/parity/same-capability-proof.test.ts`):** Proves that invoking `task.create` from the UI Server Action and invoking it from MCP `tools/call` produces the exact same audit entry, validates identical Zod schemas, and triggers the same domain event.

#### PR-12: Wave B-2 Capabilities — CRM Entities, Deals, Pipelines & Kanban UI Proof Point (Workstream 1.5 Wave B-2 & §5.2) [Rules 18, 19, 20, 28, 47, 49, 69]
- **In-Place Upgrades:** Replaces legacy `crm.get_entity`, `crm.search_entities`, `deal.get`, and `deal.update_stage` compatibility entries in the unified registry!
- **Capabilities Delivered:**
  - **Entities / Contacts:** `crm.entity.search`, `crm.entity.get`, `crm.entity.create`, `crm.entity.update`, `crm.workspace_entity.update`, `crm.workspace_entity.archive` (bounded, paginated server reads per Rule 28)
  - **Deals & Opportunities:** `deal.search`, `deal.get`, `deal.create`, `deal.update`, `deal.advance_stage`, `deal.assign_owner`
  - **Pipelines:** `pipeline.list`, `pipeline.get`
- **Folder:** `src/platform/domains/crm_contacts/`, `src/platform/domains/deals_revenue/`
- **UI Proof-Point Migration:**
  - `src/components/pipeline/components/KanbanBoard.tsx`:
    - Refactor drag-and-drop deal stage progression to route through `useCapability('deal.advance_stage')`.
    - **Optimistic Move & Rollback on Refusal:** The deal card optimistically updates in the UI. If the gateway rejects the transition (e.g. entry criteria unmet, missing permission, or TOCTOU version conflict), the card snaps back smoothly to its original column, and a `<CapabilityErrorNotice>` toast explains the refusal reason.
- **Verification:**
  - `src/platform/__tests__/domains/deal-advance-stage.test.ts`: Stage progression validation, version conflict handling, and rollback verification.

---

### Milestone 4: Administrative Consoles & Context Actions

#### PR-13: Backoffice Control Plane (Workstream 1.6b & §5.5) [Rules 15, 60, 61, 62]
- **Goal:** Surface platform-wide capability administration, execution inspection, and emergency kill-switches on the backoffice surface (`APP_SURFACE=backoffice`).
- **Deliverables:**
  1. `/backoffice/ai/capabilities/page.tsx`:
     - Inspect all 2,337 cataloged capabilities and active adapters.
     - Global "Disable Autonomous Execution" master switch with backoffice dual control.
  2. `/backoffice/ai/executions/page.tsx`:
     - Real-time stream of capability executions and audit logs.
     - Filtering by tenant, domain, actor type, decision, and risk level.
     - Hash-chain verification badge per workspace audit log.

#### PR-14: Context Action System v1 (Workstream P-D4 B & §5.3) [Rules 7, 50, 69, theme.md Section 8]
- **Goal:** Provide an accessible, capability-driven **Object Action Menu (⋯ Actions)** shared by humans and agents on entity, deal, and task views.
- **Deliverables:**
  1. Metadata Extension: Capabilities declare `ui.contextActions: { objectTypes: ['entity' | 'deal' | 'task'], label, icon, group, confirm: 'none' | 'simple' | 'typed' }`.
  2. `<ObjectActionMenu objectType="entity" objectId={...} />`:
     - Rendered on entity page headers, deal headers, and task rows.
     - Automatically populated with capabilities matching the object type, pre-filtered via `useCapabilityAvailability`.
     - On desktop: Accessible dropdown menu (`Shift+F10` keyboard shortcut).
     - On mobile (< 768px): Accessible bottom sheet with $\ge 44\text{px}$ touch targets.
- **Verification:**
  - Component accessibility checks (ARIA attributes, keyboard navigation, focus trap).

---

### Milestone 5: Experience Platform & Final Certification

#### PR-15: Wave C Capabilities — Experience Platform & Portals (Workstream 1.5 Wave C) [Rules 2, 16, 18, 47, 49, 69]
- **Capabilities Delivered:**
  - `portal.get`, `portal.list` (`L0_READ`)
  - `portal.membership.list`, `portal.membership.get` (`L0_READ`)
  - `portal.membership.create_plan` (`L2_STATE_MUTATION`)
  - `portal.membership.update_role`, `portal.membership.suspend`, `portal.membership.reactivate`, `portal.membership.remove` (`L2_STATE_MUTATION`)
  - `portal.publish` (`L3_EXTERNAL_COMMUNICATION_FINANCE`)
- **Remediating Legacy "KNOWN RISKS":**
  - Fixes the 5 known vulnerabilities documented in `portal-membership.baseline.test.ts`:
    1. Enforces strict tenant immutability (`organizationId` cannot be updated).
    2. Enforces strict tenant scoping during existing-membership lookups.
    3. Blocks unauthenticated callers from defaulting to `'system'`.
- **Verification:**
  - `src/platform/__tests__/domains/portal-capabilities.test.ts`: Validates membership mutations, plan assignments, and tenant isolation.

#### PR-16: Generated Documentation, Telemetry Verification & Phase 1 Exit Certification [Rules 24, 39, 40, 67]
- **Deliverables:**
  1. `scripts/generate-capability-docs.ts`:
     - Compiles `docs/agentic/capabilities.md` and generates JSON Schemas for all registered capabilities.
     - CI drift test fails if docs diverge from code.
  2. End-to-end telemetry verification.
  3. Final Phase 1 certification audit against the 69 rules.

---

## 5. Execution Order & Immediate Next Step

1. **Step 1:** User approves this updated Phase 1 Master Plan.
2. **Step 2:** Begin implementation of **PR-5: Canonical Registry Unification & Legacy Tool Bridging**.
3. **Step 3:** Code review PR-5 with the Senior Principal Architect before moving to PR-6.

---

## 6. Plan Approval Request

Please review this plan. Upon your approval, we will proceed immediately with the implementation of **PR-5 (Canonical Registry Unification & Legacy Tool Bridging)**.
