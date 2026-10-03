# Phase 5 Milestone 4 Implementation Plan
## Operator Capability Console (`/settings/ai/capabilities` & `/admin/mcp`), Live Activity Stream & Standardized Tool Inspector Drawer (`theme.md` §8)
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (All 69 Rules), `theme.md` Section 8, and Phase 5 Milestone 3 Review Recommendations

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a unified, operator-facing Mission Control console for technical administrators and operations teams to inspect, configure, govern, and monitor SmartSapp's MCP tools, capabilities, and external servers in real time. Strictly adheres to `theme.md` Section 8 (Standardized Modal & Drawer Architecture), provides real-time SSE streaming via `useEventStream` (Rule 62), enforces multi-tenant Anti-IDOR validation in Server Actions (Rules 47 & 51), containerizes untrusted data with `<untrusted_reference_data>` (Rule 30), and implements the hardening recommendations from the Milestone 3 architectural review.

**Architecture:**
1. **Operator Server Actions (`src/app/actions/mcp-actions.ts`):** Typed Next.js Server Actions (`'use server'`) enforcing Clerk session authentication (`requireAuth`), Anti-IDOR tenant validation (`profile.organizationId`), Rule 60 emergency dead-man pause evaluation (`checkGovernanceDeadManSwitch`), and strict Zod v4 schemas for listing tools, retrieving tool details, approving drifted fingerprints, toggling capability states, managing external MCP server lifecycles, and fetching platform metrics.
2. **Standardized Tool Inspector Drawer (`src/components/mcp/ToolInspectorDrawer.tsx`):** Built strictly to `theme.md` Section 8 specifications:
   - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
   - Demarcated Header: `<DialogHeader demarcated>` with compact breathing height (`min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`).
   - Zero Raw Descriptions: All contextual descriptions routed exclusively through single-circle `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`, with `<DialogDescription className="sr-only">`.
   - Untrusted Data Containerization: Schemas, parameters, and descriptions wrapped inside `<untrusted_reference_data id="...">` (Rule 30).
   - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97]`).
   - Tabs: `Overview`, `Fingerprint & Security` (SHA-256 badge, drift breakdown, re-approval action), `JSON Schema` (Draft-2020-12 input/output contracts), and `Audit History`.
3. **External Server Allowlist Console (`src/components/mcp/ServerAllowlistTable.tsx` & `RegisterServerModal.tsx`):** Operator UI for managing remote MCP servers across the 8-stage lifecycle (`discovered` -> `monitored`), displaying SSRF verification status badges, and executing lifecycle promotions or emergency revocations.
4. **Real-Time MCP Activity Stream (`src/components/mcp/McpActivityStream.tsx`):** Live execution and security feed powered by `useEventStream` connected to `/api/events/stream`, rendering real-time `mcp.tool.*` and `mcp.security.*` events with latency chips, correlation IDs, and event filtering (Rule 62).
5. **Operator Mission Control Route Surfaces:**
   - `/admin/mcp`: Three-zone operator command center (KPI metrics, tabbed catalog/allowlist/activity, dead-man banner).
   - `/admin/settings/ai/capabilities`: Direct administrator view.
   - Backward-compatibility redirect from legacy `/admin/companybrain/tools` and `/settings/developers/mcp` to `/admin/mcp` (Rule 69 Strangler Invariant).
6. **Milestone 3 Recommendations Hardening:**
   - Add Firestore composite indexes in `firestore.indexes.json` for `mcp_server_allowlist` and `mcp_tool_fingerprints`.
   - DNS Pinning socket connection security documentation and verification.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (Strict, Zero `any`/`any[]`), Tailwind CSS, Radix UI Dialog & Tooltip, Lucide Icons, Zod v4, `useEventStream`, Vitest, Testing Library.

---

## 1. Master 69-Rules Compliance Audit & Architectural Matrix

The following matrix systematically maps every rule from `docs/agents_mcp/agents_mcp_rules.md` to its concrete architectural enforcement in Phase 5 Milestone 4:

### 1.1 Foundation & Core Architectural Rules (Rules 1–10)

| Rule # | Principle / Invariant | Specific Milestone 4 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 1** | **The Model Is Not a Security Boundary** | UI displays model capabilities as untrusted contracts; all capability toggles, registrations, and approvals require authenticated human operator action. |
| **Rule 2** | **Explicit Capabilities** | Tool catalog displays explicit capability IDs, versions, input schemas, output schemas, and risk tiers without hidden behaviors. |
| **Rule 3** | **Single Capability Registry SSOT** | All capability listings query the central `CapabilityRegistry` (`getCapabilityRegistry()`), ensuring zero parallel registries. |
| **Rule 4** | **Zero `any` / Zero `any[]`** | Absolute type safety across all React components, Server Actions, schemas, and test fixtures. Every prop, state, and action result is strictly typed. |
| **Rule 5** | **Inbound Schema Validation** | All Server Action inputs pass through runtime Zod v4 schemas (`zod/v4`) prior to execution. |
| **Rule 6** | **Deterministic ID Generation** | Canonical composite keys for tools, servers, and audit items use deterministic formatting (`${orgId}:${wsId}:${id}`). |
| **Rule 7** | **Mobile Touch Targets $\ge 44\text{px}$** | All buttons, tabs, modal triggers, pagination controls, and action pills enforce `min-h-[44px]` with responsive spacing. |
| **Rule 8** | **Tenant Isolation & Anti-IDOR** | Server actions cross-validate `profile.organizationId` against caller inputs. Tool records and allowlist servers are filtered fail-closed by tenant. |
| **Rule 9** | **Cloud Run Resource Limits** | UI operates statelessly without local filesystem dependencies; lists are paginated and stream events consume bounded buffer sizes. |
| **Rule 10** | **Inline Architectural Documentation** | Every authored component and server action includes an exhaustive `@fileOverview` with invariants, security boundaries, and maintainer guidance. |

### 1.2 MCP Protocol, Security & Supply-Chain Rules (Rules 11–20)

| Rule # | Principle / Invariant | Specific Milestone 4 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 11** | **MCP Protocol Spec (2026-07-28 / SDK v2)** | Console presents tools conforming to the latest Streamable HTTP specification and `@modelcontextprotocol/server` SDK v2 standards. |
| **Rule 12** | **Annotations Are Hints** | Tool risk levels and permission boundaries are presented based on server-side definitions, not client or model hints. |
| **Rule 13** | **Never Trust the Model / Caller** | All inputs to Server Actions and drawer modals are strictly parsed and sanitized before reaching platform stores. |
| **Rule 14** | **Rug-Pull Defense & Fingerprint Approval** | `ToolInspectorDrawer` displays drifted tool alerts and provides explicit operator re-approval workflow bound to cryptographic SHA-256 hashes. |
| **Rule 15** | **External Server Allowlist Management** | `ServerAllowlistTable` surfaces the 8-stage lifecycle (`discovered` -> `monitored`) with state transition controls and SSRF safety indicators. |
| **Rule 16** | **Agent Identity as Principal** | Capability catalog displays required agent scopes and least-privilege role bindings. |
| **Rule 17** | **Non-Delegable Action Warning Badges** | High-risk administrative tools are visually demarcated with non-delegable warning shield badges (`isNonDelegableAction`). |
| **Rule 18** | **TOCTOU & Concurrency Control** | Optimistic concurrency versioning (`version`, `updatedAt`) applied to fingerprint approvals and server status updates. |
| **Rule 19** | **Mutating Idempotency** | Fingerprint approvals and server lifecycle promotions are idempotent; duplicate executions produce identical states. |
| **Rule 20** | **Distributed Tracing** | Echoes `mcp-transaction-id`, `x-smartsapp-correlation-id`, and W3C trace identifiers in activity stream logs. |

### 1.3 Governance, Context & Prompt Injection Defense (Rules 21–30)

| Rule # | Principle / Invariant | Specific Milestone 4 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 21** | **Action Proposals & Human Approval** | Fingerprint re-approvals and server status promotions require explicit operator confirmation with typed reasons. |
| **Rule 22** | **Cryptographic Payload Hash Binding** | Re-approval actions bind to the exact SHA-256 `compositeHash`. Truncated hash badges feature one-click copy. |
| **Rule 23** | **Bounded Traversal & Pagination** | Catalog tables and activity feeds enforce pagination ceilings ($\le 50$ items per page) preventing DOM bloat. |
| **Rule 24** | **Circuit Breakers & Graceful Degradation** | `McpActivityStream` provides graceful reconnect states and visual degradation indicators when SSE is unavailable. |
| **Rule 28** | **Context Budgeting** | Lightweight catalog previews truncate descriptions to 300 characters, leaving deep schemas to the lazy-loaded drawer. |
| **Rule 30** | **Untrusted Reference Data Isolation** | All external tool schemas, descriptions, and outputs rendered in the UI are containerized inside `<untrusted_reference_data id="...">` blocks to prevent operator-side prompt injection. |

### 1.4 Tool Engineering, Egress & Discovery Rules (Rules 31–40)

| Rule # | Principle / Invariant | Specific Milestone 4 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 31** | **Tool Description Engineering** | Descriptions displayed in the catalog are formatted as concise imperative statements; prompt overrides in descriptions trigger drift badges. |
| **Rule 32 & 33** | **Data Egress & Exfiltration Visibility** | Security stream surfaces `mcp.security.exfiltration_blocked` events with channel sensitivity levels. |
| **Rule 34** | **Universal Outbound SSRF Guard** | `ServerAllowlistTable` surfaces SSRF validation status; `RegisterServerModal` executes `validateSafeEgressUrl` during registration. |
| **Rule 35** | **Discovery Cache Invalidation** | State mutation actions (fingerprint re-approval, server status change, dead-man toggle) emit events triggering cache invalidation. |
| **Rule 36** | **Capability SemVer Versioning** | Tool versions displayed as canonical SemVer chips (`major.minor.patch`). |
| **Rule 38** | **Banned Deprecated Features** | Console rejects deprecated MCP headers and displays only modern Streamable HTTP configurations. |
| **Rule 39** | **Distributed Trace Propagation** | Tracing headers displayed on activity stream records for distributed observability. |
| **Rule 40** | **Append-Only Audit Logging** | Operator state mutations emit domain events to `defaultEventBus` (`mcp.security.fingerprint_approved`, `mcp.security.server_status_changed`). |

### 1.5 Security Boundaries, Server Actions & Surface Rules (Rules 41–69)

| Rule # | Principle / Invariant | Specific Milestone 4 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 41** | **Structured Action Evidence** | Re-approval requests capture operator ID, timestamp, reason, and cryptographic hash evidence. |
| **Rule 42** | **Shadow Mode Simulation** | Capability details display dry-run support indicators (`supportsDryRun: true`). |
| **Rule 46** | **Granular Role-Based Permissions** | Console actions restricted to workspace administrators; read-only view for standard members. |
| **Rule 47** | **Never Trust the Model / Caller** | Server actions cross-validate `profile.organizationId` against caller inputs. Tool records and allowlist servers are filtered fail-closed by tenant. |
| **Rule 48** | **Sanitize Errors** | Server Action rejections return structured error codes (`UNAUTHORIZED`, `IDOR_VIOLATION`, `MCP_DEAD_MAN_PAUSED`) without leaking internal stack traces. |
| **Rule 50** | **Cache & Store Isolation** | Multi-tenant composite keys prevent cross-tenant UI data contamination. |
| **Rule 51** | **Authenticated Server Actions** | Every server action in `src/app/actions/mcp-actions.ts` enforces `requireAuth()` session authentication. |
| **Rule 52** | **Client/Server Boundary** | Zero server secrets or database credentials leaked into tool schemas or error responses. |
| **Rule 54** | **Performance Budgeting** | Sub-50ms initial tab renders; activity stream batches events to prevent UI thread lock. |
| **Rule 60** | **Emergency Dead-Man Controls** | `McpDeadManBanner` displays active emergency pause status and provides authorized admins with an emergency toggle triggering `checkGovernanceDeadManSwitch`. |
| **Rule 61** | **Backoffice as Agent Control Plane** | The operator console is hosted on `APP_SURFACE=backoffice` (`/admin/mcp`), enabling zero-code management of tools, servers, and kill-switches. |
| **Rule 62** | **Security Command Center & Real-Time SSE** | `McpActivityStream` consumes the `/api/events/stream` SSE channel via `useEventStream`, updating live upon `mcp.tool.*` and `mcp.security.*` events without polling. |
| **Rule 64** | **Non-Interactive Mode Resilience** | Server Actions and UI state updates handle background mutations, disconnected streams, and offline states gracefully. |
| **Rule 66 & 67** | **The Agent Implementation Gate** | 100% compliance across all 10 architectural criteria verified prior to milestone completion. |
| **Rule 68** | **Five Non-Negotiable Rules** | Model is not a boundary; outputs are untrusted; idempotent execution; bounded authority; operable without code. |
| **Rule 69** | **Strangler Fig Invariant** | Legacy `/admin/companybrain/tools` seamlessly redirects to `/admin/mcp`. Legacy `src/lib/mcp/` tests remain 100% operational. |

---

## 2. Modal & Drawer Architecture Compliance (`theme.md` §8)

All modals and drawers created in Milestone 4 must strictly adhere to `theme.md` Section 8:

1. **Surface & Geometry:**
   - Must use `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
   - Prohibited: `bg-slate-900`, `bg-slate-950`, `border-slate-800`, `rounded-3xl`, `rounded-[2rem]`.
2. **Demarcated Header:**
   - Must use `<DialogHeader demarcated>`:
     `min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between shrink-0 space-y-0 text-left`.
3. **Zero Raw Descriptions:**
   - Descriptions must never be rendered as visible plain text under the title.
   - User guidance must route exclusively through single-circle `<CardInfoTooltip text="..." />` placed directly alongside the title.
   - Screen-reader accessibility: `<DialogDescription className="sr-only">`.
4. **Single-Circle Info Tooltip:**
   - The info icon must render with exactly ONE circle (the Lucide `Info` SVG stroke). No outer button ring or border.
   - Tooltip content elevated to `z-[10050]`.
5. **Demarcated Footer:**
   - Must use `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0`.
   - Tactile buttons: `rounded-xl active:scale-[0.97]`.
6. **Prompt Injection Containerization (Rule 30):**
   - All external schemas, descriptions, and outputs wrapped in `<untrusted_reference_data id="...">`.

---

## 3. File Decomposition & Component Architecture

```
src/
├── app/
│   ├── actions/
│   │   └── mcp-actions.ts                 # Typed Server Actions for tools, allowlist, fingerprints, and metrics
│   ├── admin/
│   │   ├── mcp/
│   │   │   ├── page.tsx                   # Server component with metadata & Suspense boundary
│   │   │   └── McpClient.tsx              # Three-zone client console with tabs & SSE reactivity
│   │   └── settings/
│   │       └── ai/
│   │           └── capabilities/
│   │               └── page.tsx           # Redirect to /admin/mcp?tab=catalog
├── components/
│   └── mcp/
│       ├── ToolInspectorDrawer.tsx        # theme.md §8 standardized drawer with tabs, hash badge & schema view
│       ├── CapabilityCatalogTable.tsx     # Searchable catalog table with domain, risk chips & drawer triggers
│       ├── ServerAllowlistTable.tsx       # External server table with 8-stage lifecycle & promotion controls
│       ├── RegisterServerModal.tsx        # theme.md §8 modal for registering external MCP servers
│       ├── McpActivityStream.tsx          # Real-time SSE activity feed powered by useEventStream (Rule 62)
│       ├── McpMetricsCards.tsx            # Executive KPI cards (active tools, servers, drift count, invocations)
│       └── McpDeadManBanner.tsx           # High-visibility emergency pause indicator & toggle modal
└── platform/
    └── __tests__/
        ├── ui/
        │   └── mcp-capability-console.test.tsx # 10 unit & component tests for catalog, drawer, theme compliance
        └── mcp/
            └── mcp-actions.test.ts        # 8 integration tests for server actions, Anti-IDOR, dead-man gates
```

---

## 4. Bite-Sized Implementation Tasks

### Task 1: Milestone 3 Review Recommendations & Compound Index Hardening
**Files:**
- Modify: `firestore.indexes.json`
- Rules: **Rule 8, Rule 14, Rule 15, Rule 50**

- [ ] **Step 1: Inspect and add compound indexes to `firestore.indexes.json`**
  - Add compound index for `mcp_server_allowlist`:
    * Fields: `organizationId` (ASC), `workspaceId` (ASC), `status` (ASC)
    * Query Scope: `COLLECTION`
  - Add compound index for `mcp_tool_fingerprints`:
    * Fields: `organizationId` (ASC), `workspaceId` (ASC), `toolId` (ASC), `version` (ASC)
    * Query Scope: `COLLECTION`
- [ ] **Step 2: Validate JSON syntax**
  - Ensure `firestore.indexes.json` parses cleanly without errors.

---

### Task 2: Operator Server Actions (`src/app/actions/mcp-actions.ts`)
**Files:**
- Create: `src/app/actions/mcp-actions.ts`
- Test: `src/platform/__tests__/mcp/mcp-actions.test.ts`
- Rules: **Rule 4, Rule 8, Rule 10, Rule 14, Rule 15, Rule 21, Rule 22, Rule 40, Rule 47, Rule 48, Rule 51, Rule 60**

- [ ] **Step 1: Write failing integration tests for Server Actions**
  - Test `listMcpCapabilitiesAction` with domain and risk filtering.
  - Test `getMcpToolDetailsAction` returning schema, description, and fingerprint status.
  - Test `approveToolFingerprintAction` updating fingerprint and emitting `mcp.security.fingerprint_approved`.
  - Test Anti-IDOR protection: rejecting requests with mismatched `organizationId` (Rule 47).
  - Test Rule 60 dead-man evaluation: mutations blocked when dead-man pause is tripped.
  - Test `listMcpServersAction`, `registerMcpServerAction`, and `transitionServerLifecycleAction`.
  - Test `getMcpPlatformMetricsAction` aggregating live statistics.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-actions.test.ts`
  - Expected: FAIL with missing module.
- [ ] **Step 3: Implement `src/app/actions/mcp-actions.ts`**
  - Apply `'use server'`.
  - Enforce `requireAuth()` across all exported actions.
  - Enforce Anti-IDOR tenant validation comparing `profile.organizationId` with request inputs.
  - Integrate `checkGovernanceDeadManSwitch(orgId)` on all mutating actions (Rule 60).
  - Define strictly typed action interfaces (`McpActionResult<T>`) with zero `any`/`any[]`.
  - Wire actions to `getCapabilityRegistry()`, `getGlobalToolFingerprintStore()`, `getGlobalServerAllowlistStore()`, and `defaultEventBus`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-actions.test.ts`
  - Expected: PASS.

---

### Task 3: Standardized Tool Inspector Drawer (`src/components/mcp/ToolInspectorDrawer.tsx`)
**Files:**
- Create: `src/components/mcp/ToolInspectorDrawer.tsx`
- Rules: **Rule 4, Rule 7, Rule 10, Rule 12, Rule 14, Rule 17, Rule 21, Rule 22, Rule 30, Rule 31, theme.md §8**

- [ ] **Step 1: Implement `ToolInspectorDrawer.tsx` strictly conforming to `theme.md` §8**
  - **Surface & Geometry:** `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
  - **Demarcated Header:** `<DialogHeader demarcated>` (`min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`).
  - **Zero Raw Descriptions:** Routed through `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`, with `<DialogDescription className="sr-only">`.
  - **Untrusted Data Isolation:** Wrap schema definitions and descriptions in `<untrusted_reference_data id="...">` (Rule 30).
  - **Demarcated Footer:** `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97]`).
  - **Tabs:**
    * `overview`: ID, domain badge, risk level badge, non-delegable shield (Rule 17), description.
    * `fingerprint`: SHA-256 composite hash badge with one-click copy (Rule 22), 6 sub-hash breakdown, drift status badge, and "Approve Fingerprint" trigger.
    * `schema`: Formatted JSON Schema representation for inputs and outputs.
    * `permissions`: Required scopes, roles, and execution constraints.

---

### Task 4: Operator UI Components (Catalog, Server Allowlist, Modals, Metrics, Dead-Man)
**Files:**
- Create: `src/components/mcp/CapabilityCatalogTable.tsx`
- Create: `src/components/mcp/ServerAllowlistTable.tsx`
- Create: `src/components/mcp/RegisterServerModal.tsx`
- Create: `src/components/mcp/McpMetricsCards.tsx`
- Create: `src/components/mcp/McpDeadManBanner.tsx`
- Rules: **Rule 4, Rule 7, Rule 8, Rule 14, Rule 15, Rule 17, Rule 22, Rule 60, theme.md §8**

- [ ] **Step 1: Implement `McpMetricsCards.tsx`**
  - 4 executive metric cards: Total Capabilities, Verified Fingerprints (with drift badge), External Servers, 24h Invocations.
  - Pulse status indicator and tactile hover states.
- [ ] **Step 2: Implement `McpDeadManBanner.tsx`**
  - High-visibility banner when emergency pause is active.
  - Confirmation modal adhering to `theme.md` §8 for toggling platform or workspace-level dead-man pause.
- [ ] **Step 3: Implement `CapabilityCatalogTable.tsx`**
  - Search input with 300ms debounce.
  - Domain filter pills (`All`, `crm`, `knowledge`, `messaging`, `sales`, `portals`, `system`).
  - Risk chips (`L0_READ` through `L4_PRIVILEGED_DESTRUCTIVE`).
  - Fingerprint status badges (`Verified`, `Drift Detected`, `Unapproved`).
  - Touch-accessible actions (`min-h-[44px]`): Inspect Drawer trigger, Toggle capability switch.
- [ ] **Step 4: Implement `ServerAllowlistTable.tsx` & `RegisterServerModal.tsx`**
  - Server table with 8-stage lifecycle pills (`discovered` -> `monitored`).
  - SSRF Verified badge and server URL display.
  - Transition lifecycle dropdown actions (`Promote to Reviewed`, `Approve`, `Connect`, `Suspend`).
  - `RegisterServerModal` conforming to `theme.md` §8 with server name, URL, and description inputs.

---

### Task 5: Real-Time MCP Activity Stream (`src/components/mcp/McpActivityStream.tsx`)
**Files:**
- Create: `src/components/mcp/McpActivityStream.tsx`
- Rules: **Rule 4, Rule 7, Rule 20, Rule 39, Rule 40, Rule 62**

- [ ] **Step 1: Implement `McpActivityStream.tsx`**
  - Connect to SSE via `useEventStream({ workspaceId, enabled: true })`.
  - Listen for `mcp.tool.invoked`, `mcp.security.tool_drift_detected`, `mcp.security.server_status_changed`, `mcp.security.exfiltration_blocked`.
  - Stream items with timestamp, correlation ID badge, tool ID, duration ms, and outcome chip.
  - Live connection status pill (`Connected`, `Connecting`, `Disconnected`) with reconnect button.
  - Filter pills: `All`, `Invocations`, `Security Alerts`, `Drifts`.

---

### Task 6: Operator Mission Control Page & Navigation Routing
**Files:**
- Create: `src/app/admin/mcp/page.tsx`
- Create: `src/app/admin/mcp/McpClient.tsx`
- Modify: `src/app/admin/settings/ai/capabilities/page.tsx`
- Modify: `src/app/admin/companybrain/tools/page.tsx`
- Rules: **Rule 4, Rule 10, Rule 61, Rule 69**

- [ ] **Step 1: Implement `src/app/admin/mcp/page.tsx` and `McpClient.tsx`**
  - Server page with SEO metadata (`SmartSapp AI | MCP Control Plane`) and Suspense boundary.
  - `McpClient.tsx`: Three-Zone Layout:
    * Zone 1: Executive KPI Metrics (`McpMetricsCards`) & Emergency Banner (`McpDeadManBanner`).
    * Zone 2: Workspace Filter Toolbar & Real-Time Connection Indicator.
    * Zone 3: Tabbed Surfaces (`Capabilities Catalog`, `External Servers`, `Live Activity Stream`).
- [ ] **Step 2: Harmonize navigation and redirects (Rule 69 Strangler Invariant)**
  - Update `src/app/admin/settings/ai/capabilities/page.tsx` to redirect cleanly to `/admin/mcp?tab=catalog`.
  - Update `src/app/admin/companybrain/tools/page.tsx` to redirect cleanly to `/admin/mcp`.

---

### Task 7: Comprehensive Verification & Implementation Gate
**Files:**
- Create: `src/platform/__tests__/ui/mcp-capability-console.test.tsx`
- Rules: **Rule 4, Rule 66, Rule 67, Rule 68, Rule 69**

- [ ] **Step 1: Implement UI unit and component tests**
  - Verify catalog table rendering, domain filtering, and search filtering.
  - Verify `ToolInspectorDrawer` adheres to `theme.md` §8 (demarcated header, single-circle info tooltip, sr-only description, demarcated footer).
  - Verify tactile button classes (`active:scale-[0.97]`).
  - Verify touch targets meet `min-h-[44px]`.
- [ ] **Step 2: Execute full verification suite**
  - Run all MCP tests: `pnpm vitest run src/platform/__tests__/mcp/`
  - Run all UI tests: `pnpm vitest run src/platform/__tests__/ui/mcp-capability-console.test.tsx`
  - Run legacy regression tests: `pnpm vitest run src/lib/mcp/__tests__/` (Rule 69)
  - Run project-wide typecheck: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Run ESLint static analysis: `NODE_OPTIONS='--max-old-space-size=8192' pnpm eslint src/components/mcp/ src/app/admin/mcp/ src/app/actions/mcp-actions.ts`

---

## 5. Implementation Gate: 10 Architectural Criteria

Before Phase 5 Milestone 4 is declared complete, all 10 criteria must be verified:

1. [ ] **`theme.md` §8 Compliance:** `ToolInspectorDrawer` and all modals use demarcated headers, single-circle `<CardInfoTooltip>` at `z-[10050]`, zero raw descriptions (`<DialogDescription className="sr-only">`), and demarcated footers with tactile feedback (`active:scale-[0.97]`).
2. [ ] **Anti-IDOR Tenant Enforcement:** Server actions strictly cross-validate authenticated user tenant context against all requested parameters (Rule 47).
3. [ ] **Rule 60 Dead-Man Integration:** Mutating actions and toggles fail closed when emergency pause is tripped.
4. [ ] **Real-Time SSE Streaming:** `McpActivityStream` consumes `/api/events/stream` and updates live without client polling (Rule 62).
5. [ ] **Untrusted Data Isolation:** All capability schemas, descriptions, and outputs are containerized inside `<untrusted_reference_data id="...">` (Rule 30).
6. [ ] **Cryptographic Hash Badges:** SHA-256 composite hashes and sub-hashes are displayed with truncation and one-click copy (Rule 22).
7. [ ] **External Server 8-Stage Lifecycle UI:** Server allowlist console reflects formal lifecycle transitions with SSRF verification badges (Rule 15).
8. [ ] **Mobile Touch Targets:** All interactive triggers, buttons, and tabs enforce `min-h-[44px]` (Rule 7).
9. [ ] **Zero `any` / Zero `any[]`:** Absolute strict typing across all components, actions, and schemas (Rule 4).
10. [ ] **Strangler Fig Invariant:** Legacy routes redirect cleanly and all legacy MCP tests pass (Rule 69).
