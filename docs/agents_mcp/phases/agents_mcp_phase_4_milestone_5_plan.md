# Phase 4 Milestone 5 Implementation Plan (Rule-Hardened Edition)
## CRM Contextual Surfaces, Knowledge Graph Visualizer v1 & Platform Memory Capabilities

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed institutional memory and real-time AI context directly into CRM records (Contacts, Deals, Companies), deliver an interactive Knowledge Graph Canvas visualizer (UI #38 / PRD §96), and register canonical memory capabilities in the platform capability registry for MCP and agent personas, in 100% strict compliance with the 69 SmartSapp Agentic Development Rules.

**Architecture:** 
- Expose canonical memory operations behind `CapabilityDefinition` contracts (`memory:semantic_search`, `memory:get_context`, `memory:create_item`, `memory:inspect_graph`, `memory:purge_tenant_memory`) registered in `globalCapabilityRegistry`.
- Build `KnowledgeContextPanel.tsx` providing contextual intelligence, key takeaways, and clickable evidence cards opening `KnowledgeItemDrawer.tsx` within Contact and Deal views.
- Deliver `KnowledgeGraphCanvas.tsx` as an interactive SVG/HTML5 visualizer rendering multi-hop entity-relationship networks with depth and temporal filters.
- Route all data fetching through secure, typed Server Actions enforcing Clerk authentication, Anti-IDOR tenant scoping (Rule 47), and Rule 60 dead-man switch evaluation.

**Tech Stack:** Next.js 15 Server Actions (`'use server'`), React 19, TypeScript 5, Tailwind CSS, Lucide Icons, Zod v4, Qdrant Vector Store, Radix UI Dialog & Tooltip (`theme.md` §8), Vitest.

---

## 1. Complete Rule Compliance Mapping (`agents_mcp_rules.md`)

| Rule # | Requirement & Rule Intent | Milestone 5 Implementation Mechanism |
|:---|:---|:---|
| **Rule 1** | Ecosystem Compatibility & Strangler Fig | Reuses existing CRM layouts (`ContactDetailPage.tsx`, `DealAiIntelligencePanel.tsx`) and `/admin/brain` without breaking existing workflows or routes. |
| **Rule 2** | Defensive Edge Case & Failure Mode Analysis | Handles empty search results, disconnected graph nodes, Qdrant timeouts, and active dead-man switch gracefully. |
| **Rule 3** | Backoffice & Governance Visibility | Traversal depth, context token limits, and sensitivity tiers can be inspected and audited without touching code. |
| **Rule 4** | Zero `any` / `any[]` & Validated Trust Boundaries | Zero `any`/`any[]` in domain code. Inferred generic schemas only. `unknown` at boundaries immediately narrowed via Zod v4. |
| **Rule 5** | Non-Automatic Production Deployments | Tested in local test suites and verified via strict quality gates; no unauthorized git pushes. |
| **Rule 6** | Up-to-Date Documentation & Context7 | Aligns with latest React 19 / Next.js 15 server action guidelines and MCP 2026-07-28 specifications. |
| **Rule 7** | Mobile-First & Touch Target Standards | Touch targets $\ge 44\text{px}$, responsive viewports, collapsibility on mobile, everyday UI English with minimal text clutter. |
| **Rule 8 & 47** | Multi-Tenancy & Anti-IDOR Scope Binding | `organizationId` and `workspaceId` resolved from Clerk session via `requireAuth()`. Cross-tenant queries rejected fail-closed with `TENANT_MISMATCH`. |
| **Rule 9** | Load Governance & Resource Ceilings | Bounded graph traversal: $\le 2$ degrees, max 100 nodes and 200 edges per query. 300ms debounced search. |
| **Rule 10** | Inline Documentation & Caution Areas | Every file contains `@fileOverview` with architectural rationale, testability pointers, and rule citations. |
| **Rule 11 & 12** | MCP Protocol & Server-Side Risk Enforcement | Canonical `CapabilityDefinition` contracts with server-side risk classifications (`L0_READ`, `L2_STATE_MUTATION`, `L4_PRIVILEGED_DESTRUCTIVE`). |
| **Rule 13 & 30** | Zero Model Trust & Prompt Injection Defense | Quarantines external retrieved data inside `<untrusted_reference_data>` isolation tags with shield badges and monospace formatting. |
| **Rule 16** | Strict Ban on Wildcard (`*`) Scopes | Explicit D6 RBAC permissions (`rbac:operations.contacts.view`, `app:system_admin`); zero wildcard scopes. |
| **Rule 17** | Non-Delegable Operations | `memory:purge_tenant_memory` flagged `nonDelegable: true`, barring sub-agent inheritance. |
| **Rule 18** | Live Principal Authorization Verification | Capabilities execute through the authorization pipeline checking live grants in Firestore. |
| **Rule 21 & 22** | Two-Phase Approvals & SHA-256 Hash Binding | L4 destructive purge requires human approval in `/admin/approvals`; SHA-256 chunk hashes displayed as truncated badges. |
| **Rule 24** | Resilient Circuit Breakers & Failover | Circuit breaker fallback to in-memory cosine store if Qdrant is unreachable. |
| **Rule 28** | Context Budget Ceiling | Stratified knapsack context budget manager guarantees $\le 4,000$ tokens ceiling. |
| **Rule 29** | Temporal Validity & Freshness Decay | Half-life exponential decay applied to retrieval scores; superseded and expired memories filtered. |
| **Rule 31** | Structured Error Taxonomy | All errors use standardized codes (`MEMORY_ERROR_CODES`, `CAPABILITY_ERROR_CODES`, `TENANT_MISMATCH`). |
| **Rule 32** | Sensitivity Classification | Color-coded sensitivity badges (`public`, `internal`, `confidential`, `restricted`) on nodes and evidence cards. |
| **Rule 40** | Comprehensive Domain Event Emission | Mutations publish domain events (`memory.item.created`, `memory.graph.updated`, `capability.executed`) to `defaultEventBus`. |
| **Rule 51** | Secure Server Actions Convention | Marked `'use server'` with mandatory session authentication via `requireAuth()`. |
| **Rule 60** | Emergency Dead-Man Switch Evaluation | `checkGovernanceDeadManSwitch(orgId)` evaluated before executing mutations or destructive actions; returns `MEMORY_DEAD_MAN_PAUSED`. |
| **Rule 61** | Operator Console Surface | Dedicated Graph Mesh tab integrated directly into `/admin/brain`. |
| **Rule 62** | Live SSE Stream Reactivity | Real-time updates via `useEventStream` on domain events. |
| **Rule 64** | Tactile Micro-Interactions | Emil Kowalski mechanical tactile feedback `active:scale-[0.97]` on all buttons, pills, tabs, and canvas nodes. |
| **Rule 69** | Strangler Fig Invariant | Legacy `src/lib/memory/` remains completely unmodified and passes all 60 tests untouched. |
| **`theme.md` §8** | Standardized Modal SSOT | Standardized Modal Architecture: demarcated header/footer, single-circle info tooltip at `z-[10050]`, `sr-only` descriptions. |

---

## 2. File Decomposition & Proposed File Structure

```
src/
├── platform/
│   ├── capabilities/
│   │   ├── domains/
│   │   │   └── memory/
│   │   │       ├── memory-capabilities.ts          # [NEW] Canonical CapabilityDefinitions for memory (Rules 4, 11, 12, 16, 17, 21)
│   │   │       └── index.ts                        # [NEW] Barrel export
│   │   └── registry/
│   │       └── register-capabilities.ts            # [MODIFY] Register memory domain capabilities
│   └── __tests__/
│       ├── capabilities/
│       │   └── memory-capabilities.test.ts         # [NEW] Unit tests for memory capabilities
│       └── ui/
│           ├── crm-knowledge-panel.test.tsx        # [NEW] Component tests for CRM context panel
│           └── knowledge-graph-canvas.test.tsx     # [NEW] Component tests for graph visualizer
├── app/
│   ├── actions/
│   │   └── memory-actions.ts                       # [MODIFY] Add getEntityContextAction & getEntityGraphAction (Rules 47, 51, 60)
│   └── admin/
│       └── brain/
│           └── BrainClient.tsx                     # [MODIFY] Add "Graph Mesh" tab rendering KnowledgeGraphCanvas (Rule 61)
└── components/
    ├── crm/
    │   └── KnowledgeContextPanel.tsx               # [NEW] Embedded CRM context & evidence sidebar (Rules 7, 13, 30, 64)
    └── brain/
        ├── KnowledgeGraphCanvas.tsx                # [NEW] Interactive SVG/HTML5 entity-relationship visualizer (Rules 7, 9, 64)
        └── GraphNodeDetailsDrawer.tsx              # [NEW] Standardized drawer for graph node details (theme.md §8)
```

---

## 3. Bite-Sized Implementation Tasks

### Task 1: Canonical Platform Memory Capabilities & Registration
**Files:**
- Create: `src/platform/capabilities/domains/memory/memory-capabilities.ts`
- Create: `src/platform/capabilities/domains/memory/index.ts`
- Modify: `src/platform/capabilities/registry/register-capabilities.ts`
- Test: `src/platform/__tests__/capabilities/memory-capabilities.test.ts`

- [ ] **Step 1: Write failing capability tests**
  - Verify registration of `memory:semantic_search`, `memory:get_context`, `memory:create_item`, `memory:inspect_graph`, `memory:purge_tenant_memory`.
  - Verify risk classifications (`L0_READ`, `L2_STATE_MUTATION`, `L4_PRIVILEGED_DESTRUCTIVE`) adhering to Rule 12.
  - Verify `requiresHumanApproval: true` and `nonDelegable: true` on `memory:purge_tenant_memory` (Rules 17, 21).
  - Verify input schema validation and tenant boundary rejection (Rule 47).
  - Verify execution handler outputs conforming to strict Zod schemas with zero `any` (Rule 4).
- [ ] **Step 2: Run test to confirm failure**
  - Run `pnpm vitest run src/platform/__tests__/capabilities/memory-capabilities.test.ts`.
- [ ] **Step 3: Implement memory capabilities**
  - In `src/platform/capabilities/domains/memory/memory-capabilities.ts`:
    - Define Zod input/output schemas for each capability using canonical types.
    - Wire handlers to `getCanonicalMemoryService()`.
    - Apply D6 permission references (`rbac:operations.contacts.view`, `rbac:operations.contacts.edit`, `app:system_admin`).
    - Enforce tenant isolation and Rule 60 dead-man switch evaluation.
    - Export `registerMemoryCapabilities()`.
  - In `src/platform/capabilities/registry/register-capabilities.ts`:
    - Add `registerMemoryCapabilities` to `DOMAIN_REGISTRARS`.
- [ ] **Step 4: Run tests to confirm pass**
  - Run `pnpm vitest run src/platform/__tests__/capabilities/memory-capabilities.test.ts`.

---

### Task 2: Server Actions for Entity Context & Knowledge Graph
**Files:**
- Modify: `src/app/actions/memory-actions.ts`
- Test: `src/platform/__tests__/memory/memory-actions.test.ts`

- [ ] **Step 1: Write failing server action tests**
  - Test `getEntityContextAction(entityId, entityType)`: validates Clerk session via `requireAuth()`, fetches relevant memories for the entity via `retrieveContext()`, formats evidence pack wrapped in `<untrusted_reference_data>` isolation, and enforces anti-IDOR (Rule 47).
  - Test `getEntityGraphAction(entityId, options)`: validates Clerk session, returns center node, 1st-degree and 2nd-degree connected nodes and edges (max 100 nodes, 200 edges, Rule 9), and respects temporal window.
  - Test Rule 60 dead-man switch rejection on mutations with typed error code `MEMORY_DEAD_MAN_PAUSED`.
- [ ] **Step 2: Run test to confirm failure**
  - Run `pnpm vitest run src/platform/__tests__/memory/memory-actions.test.ts`.
- [ ] **Step 3: Implement server actions**
  - In `src/app/actions/memory-actions.ts`:
    - Implement `getEntityContextAction(entityId, entityType, options)`.
    - Implement `getEntityGraphAction(entityId, depth, timeWindow)`.
    - Adapt graph nodes and edges conforming to canonical `CompanyBrainGraphNode` and `CompanyBrainGraphEdge` contracts.
- [ ] **Step 4: Run tests to confirm pass**
  - Run `pnpm vitest run src/platform/__tests__/memory/memory-actions.test.ts`.

---

### Task 3: CRM Contextual Intelligence Panel (`KnowledgeContextPanel.tsx`)
**Files:**
- Create: `src/components/crm/KnowledgeContextPanel.tsx`
- Test: `src/platform/__tests__/ui/crm-knowledge-panel.test.tsx`

- [ ] **Step 1: Write failing UI tests for KnowledgeContextPanel**
  - Test initial loading state and skeleton rendering.
  - Test context summary, key takeaways, and buying signals display.
  - Test clicking an evidence pill triggers `onInspectItem(item)` opening `KnowledgeItemDrawer.tsx`.
  - Test inline "Ask SmartSapp about this entity" search dispatch.
  - Test empty state when no memories exist for the entity.
  - Test responsive touch targets ($\ge 44\text{px}$) and tactile micro-interactions (`active:scale-[0.97]`).
- [ ] **Step 2: Run test to confirm failure**
  - Run `pnpm vitest run src/platform/__tests__/ui/crm-knowledge-panel.test.tsx`.
- [ ] **Step 3: Implement KnowledgeContextPanel**
  - In `src/components/crm/KnowledgeContextPanel.tsx`:
    - Responsive card/sidebar component.
    - Displays AI summary, confidence metric, and source citations.
    - Quarantines reference data with monospace styling, shield badges, and `<untrusted_reference_data>` wrapper (Rule 30).
    - Emil Kowalski tactile buttons (`active:scale-[0.97]`).
    - Mountable directly in Contact Detail and Deal views.
- [ ] **Step 4: Run tests to confirm pass**
  - Run `pnpm vitest run src/platform/__tests__/ui/crm-knowledge-panel.test.tsx`.

---

### Task 4: Interactive Knowledge Graph Canvas (`KnowledgeGraphCanvas.tsx`) & Graph Tab
**Files:**
- Create: `src/components/brain/KnowledgeGraphCanvas.tsx`
- Create: `src/components/brain/GraphNodeDetailsDrawer.tsx`
- Modify: `src/app/admin/brain/BrainClient.tsx`
- Test: `src/platform/__tests__/ui/knowledge-graph-canvas.test.tsx`

- [ ] **Step 1: Write failing UI tests for KnowledgeGraphCanvas**
  - Test SVG canvas rendering with center node, adjacent nodes, and directed edges.
  - Test filtering by node type (People, Deals, Meetings, Knowledge, Notes).
  - Test time filtering (7d, 30d, 90d, All time).
  - Test node click triggers inspection drawer opening conforming to `theme.md` §8.
  - Test zoom and pan controls.
- [ ] **Step 2: Run test to confirm failure**
  - Run `pnpm vitest run src/platform/__tests__/ui/knowledge-graph-canvas.test.tsx`.
- [ ] **Step 3: Implement KnowledgeGraphCanvas & Graph View**
  - In `src/components/brain/KnowledgeGraphCanvas.tsx`:
    - Responsive SVG canvas with pan, zoom, and interactive node selection.
    - Distinct color-coded badges per node type (Person, Deal, Meeting, Memory, Knowledge).
    - Labeled edges (`WORKS_AT`, `DISCUSSED_IN`, `RESULTED_IN`).
    - Tactile interactive controls (`active:scale-[0.97]`).
  - In `src/components/brain/GraphNodeDetailsDrawer.tsx`:
    - Standardized drawer strictly adhering to `theme.md` §8 (`<DialogHeader demarcated>`, `<CardInfoTooltip>` at `z-[10050]`, `<DialogDescription className="sr-only">`).
  - In `src/app/admin/brain/BrainClient.tsx`:
    - Add a "Knowledge Graph Mesh" tab toggle between the Memory Item Stream and the Graph Canvas (Rule 61).
- [ ] **Step 4: Run tests to confirm pass**
  - Run `pnpm vitest run src/platform/__tests__/ui/knowledge-graph-canvas.test.tsx`.

---

### Task 5: Full Platform Regression, Typecheck, Lint & Senior Architect Review
**Files:**
- Verify: Full repository workspace

- [ ] **Step 1: Run all memory & platform test suites**
  - `pnpm vitest run src/platform/__tests__/memory/`
  - `pnpm vitest run src/platform/__tests__/ui/`
  - `pnpm vitest run src/platform/__tests__/capabilities/`
  - `pnpm vitest run src/lib/memory/__tests__/` (Rule 69 Strangler invariant: all 60 tests must pass)
- [ ] **Step 2: Project-wide TypeScript Compilation**
  - `NODE_OPTIONS='--max-old-space-size=8192' ./node_modules/.bin/tsc --noEmit`
- [ ] **Step 3: ESLint Static Analysis**
  - `NODE_OPTIONS='--max-old-space-size=8192' ./node_modules/.bin/eslint src/platform/capabilities/domains/memory/ src/components/crm/ src/components/brain/ src/app/actions/memory-actions.ts`
- [ ] **Step 4: Generate Milestone 5 Completion Report & Senior Architect Review**
  - Create `docs/agents_mcp/phases/agents_mcp_phase_4_milestone_5_completion_report.md`.
  - Invoke `Senior Principal Systems & AI Agentic Architecture Reviewer` subagent.
  - Save review to `docs/agents_mcp/phases/agents_mcp_phase_4_milestone_5_code_review.md`.

---

## 4. Verification & Quality Gates

1. **Unit & Integration Test Coverage:** 100% pass across all new and existing memory/ui/capability suites.
2. **Multi-Tenant Isolation (Rule 47):** Every action and capability validates `organizationId` and `workspaceId`.
3. **Modal SSOT (`theme.md` §8):** Drawer components strictly adhere to standard modal architecture with zero raw descriptions.
4. **Strangler Pattern (Rule 69):** Preexisting `src/lib/memory/` remains completely unmodified (60/60 legacy tests passing).
5. **Compilation & Linting:** 0 TypeScript errors and 0 ESLint warnings.
