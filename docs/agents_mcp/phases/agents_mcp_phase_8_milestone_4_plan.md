# Phase 8 Milestone 4 Implementation Plan: Adaptive Global Context Rail, CRM Contextual Intelligence Hub & Universal Object Command Menu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the adaptive right Context Rail (`GlobalContextRail`), embed contextual "Ask AI" surfaces across CRM records (`EntityAiPromptBar`), and deploy the universal Object Command Menu (`ObjectCommandMenu`) across all entities with grounded citations, prompt injection isolation, and zero dead ends.

**Architecture:** A non-intrusive adaptive right rail governed by `ContextRailContext` (responsive slide-over Sheet on mobile `<768px`, shortcut `⌥C`), 6 contextual intelligence modules (Entity Dossier, Related Entities Mesh, Institutional Memory & Citations, Relationship Health Meter, Active Agent Runs, Pending Approvals), a CRM contextual prompt bar with dynamic suggestion chips and grounded citations, a universal object command menu, and Server Actions strictly adhering to Anti-IDOR, Rule 60 Dead-Man switch, Rule 28/56 Context Budgeting ($\le 4,000$ tokens), and Rules 13/30 Untrusted Reference Data isolation.

**Tech Stack:** Next.js 15 App Router (`'use server'`), React 19, Zod v4 (`zod/v4`), Tailwind CSS, Radix UI (Sheet, DropdownMenu, Tooltip), Lucide React, `CanonicalMemoryService`, `TieredModelRouter`, and `defaultEventBus`.

---

## 1. Master 69-Rules Architectural Governance & Compliance Matrix

All deliverables in Phase 8 Milestone 4 must strictly adhere to the platform's 69 Agentic & MCP Rules and `theme.md` Section 8:

| Rule # | Architectural Requirement | Milestone 4 Implementation Details |
| :---: | :--- | :--- |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Canonical Zod v4 schemas for all contracts; zero unchecked casts or `any` arrays |
| **Rule 7** | Mobile-First Touch Standards | All buttons, chips, and menu items enforce `min-h-[44px]` touch targets; rail collapses to Sheet on mobile |
| **Rule 8 & 47** | Strict Multi-Tenant Boundary & Anti-IDOR | `assertTenantContext` validates session `organizationId`; queries scoped strictly by tenant |
| **Rule 9** | Bounded Queries & Pagination | Query limits bounded ($1 \le \text{limit} \le 100$); 300ms debounced input; max citations $\le 10$ |
| **Rule 10** | Inline Architectural Documentation | Complete `@fileOverview` with rule pointers, caution areas, and testability guides |
| **Rule 12** | Canonical Risk Taxonomy | Action proposals and runs in the rail display server-side computed L0 to L4 badges |
| **Rule 13 & 30** | Untrusted Reference Data Isolation | Dynamic entity fields, citations, and prompt outputs rendered inside `<UntrustedReferenceData id="...">` |
| **Rule 16 & 17** | Attenuated Scopes & Non-Delegable Actions | Object Command Menu cannot autonomously execute non-delegable actions without operator sign-off |
| **Rule 18** | Live TOCTOU Authority Check | Actions check real-time user permissions and entity status prior to executing commands |
| **Rule 19** | Idempotency Key Handling | Mutating commands generate deterministic idempotency keys (`cmd_${entityId}_${commandType}_${timestamp}`) |
| **Rule 20 & 39** | Distributed Tracing & Telemetry | Trace badges and correlation IDs rendered on active runs and memory citations with copy action |
| **Rule 21 & 22** | Two-Phase Human Gate & Hash Binding | High-risk commands from Object Command Menu route to `ActionProposal` with SHA-256 payload hash |
| **Rule 23** | Delegation Depth Ceiling & Ceilings | Delegation depth $\le 4$; hard token ($\le 4,000$) and tool call bounds |
| **Rule 26** | Cooperative Cancellation Semantics | In-flight agent runs can be cancelled directly from the Active Runs module in the Context Rail |
| **Rule 27** | Formal Saga Compensation Trigger | Failed or rejected actions dispatch reverse-LIFO rollback via `SagaCompensationEngine.rollbackRun` |
| **Rule 28 & 56** | Knapsack Context Budgeting ($\le 4,000$ Tokens) | "Ask AI" queries and context packages enforce hard knapsack budgeting ceiling of $\le 4,000$ tokens |
| **Rule 31** | Output Validation & Sanitization | Model outputs validated via Zod v4 schemas before UI presentation |
| **Rule 32 & 33** | Data Exfiltration Defense & Egress Control | Prompt answers scanned for sensitive credentials/PII with linear non-backtracking regex matchers |
| **Rule 34** | Outbound SSRF & Network Boundary Defense | Webhook URLs or external entity links validated via `validateSafeEgressUrl` |
| **Rule 40** | Immutable State Audit Trail | Dispatches `context.rail.opened`, `context.ai.queried`, `command.object.executed` to `defaultEventBus` |
| **Rule 41** | Grounded Citations & Explainability | "Ask AI" answers display explicit citations `[citation:1]` linking to verbatim memory snippets |
| **Rule 42** | Shadow Mode Simulation | Dry-run capability support (`dryRun: true`) in `executeObjectCommandAction` generating Blast Radius Reports |
| **Rule 47** | "Never Trust the Model" | All AI outputs schema-validated; prompt injection scanning with `scanForPoisoningDirective` |
| **Rule 48** | "Never Trust the Tool Either" & Masking | Error outputs masked with structured error codes (`IDOR_VIOLATION`, `CONTEXT_DEAD_MAN_PAUSED`, etc.) |
| **Rule 51** | Server Actions Convention | Typed `'use server'` actions guarded by Clerk session auth `requireAuth()` |
| **Rule 52** | Client/Server Boundary Integrity | Clear separation between client hooks (`useContextRail`) and server actions (`context-rail-actions.ts`) |
| **Rule 54** | Performance Budgets | Rail slide-in $<50\text{ms}$; prompt bar suggestions $<150\text{ms}$; AI query $<1200\text{ms}$ |
| **Rule 58** | Tiered Model Routing | Suggestions and classification route to Flash; grounded answer synthesis routes to Pro |
| **Rule 60** | Emergency Dead-Man Switch Gate | Mutating commands in `executeObjectCommandAction` fail closed when dead-man switch is active |
| **Rule 61** | Backoffice Surface Isolation | Dedicated intelligence modules with Suspense boundaries and backoffice role guards |
| **Rule 62** | Real-Time SSE Reactivity | Live updates in active runs & pending approvals via `useEventStream` without client polling |
| **Rule 64** | Zero Raw HTML/CSS Leakage | Strictly sanitized Tailwind token styling; zero raw markup or unescaped strings |
| **Rule 67** | The 12-Point UX Implementation Gate | Full adherence to the 12-point gate prior to completion sign-off |
| **Rule 68** | Five Non-Negotiable Invariants | Never trust model; verify hashes; bounded resources; zero dead ends in UX (§81) |
| **Rule 69** | Strangler Fig Pattern SSOT | Preexisting CRM pages (`/admin/contacts`, `/admin/entities/[id]`, `/admin/pipeline`) augmented with zero regressions |
| **Theme §8** | Standardized Surface Geometry | Slide-over panels, drawers, and menus bind to semantic `--card`, `--border/80`, with tactile buttons |

---

## 2. File Structure & Responsibilities

```text
src/
├── platform/
│   └── ui/
│       └── context-rail/
│           ├── context-rail-types.ts         # Zod schemas, TypeScript types, error codes
│           ├── context-rail-service.ts       # Backend data assembler & hybrid context compiler
│           └── index.ts                      # Barrel export
├── app/
│   └── actions/
│       └── context-rail-actions.ts           # Server Actions: getEntityContextRailDataAction, askEntityAiAction, executeObjectCommandAction
├── components/
│   ├── context-rail/
│   │   ├── ContextRailContext.tsx            # React context provider, useKeyboardShortcut ⌥C, activeEntity state
│   │   ├── GlobalContextRail.tsx             # Adaptive right rail container (desktop sidebar + mobile sheet)
│   │   ├── ContextRailTrigger.tsx            # Header button affordance with active indicator
│   │   ├── modules/
│   │   │   ├── EntityDossierModule.tsx       # Module 1: Dossier, status badge, key facts
│   │   │   ├── RelatedEntitiesModule.tsx     # Module 2: Related entities mesh, interactive links
│   │   │   ├── InstitutionalMemoryModule.tsx # Module 3: Memory citations, verbatim snippets
│   │   │   ├── RelationshipHealthModule.tsx  # Module 4: 0-100 Health gauge, signals, recency
│   │   │   ├── ActiveRunsModule.tsx          # Module 5: Running agent runs with link to /admin/intelligence/runs
│   │   │   └── PendingApprovalsModule.tsx    # Module 6: Pending approvals with link to /admin/intelligence/approvals
│   │   └── index.ts                          # Public barrel export
│   ├── crm/
│   │   └── EntityAiPromptBar.tsx             # Embedded CRM "Ask About This" prompt bar with quick chips & citations
│   └── shared/
│       └── ObjectCommandMenu.tsx             # Standardized universal "..." object dropdown menu (No Dead Ends)
└── platform/
    └── __tests__/
        └── ui/
            ├── context-rail-actions.test.ts  # Unit tests for Server Actions & Anti-IDOR
            ├── context-rail.test.tsx         # Component tests for GlobalContextRail & 6 modules
            ├── entity-ai-prompt-bar.test.tsx # Component tests for EntityAiPromptBar
            └── object-command-menu.test.tsx  # Component tests for ObjectCommandMenu
```

---

## 3. Implementation Tasks

### Task 1: Canonical Context Rail Contracts, Zod Schemas & Service (`src/platform/ui/context-rail/`)

**Files:**
- Create: `src/platform/ui/context-rail/context-rail-types.ts`
- Create: `src/platform/ui/context-rail/context-rail-service.ts`
- Create: `src/platform/ui/context-rail/index.ts`
- Test: `src/platform/__tests__/ui/context-rail-actions.test.ts`

- [ ] **Step 1: Write failing contract and type tests**
  - Verify Zod v4 schemas for:
    * `EntityDossierSummarySchema`: Validates `id`, `type`, `name`, `status`, `tier`, `tags`, `keyFacts`, `sentiment`, `lastInteractionAt`.
    * `RelationshipHealthSchema`: Enforces score clamping ($0 \le \text{score} \le 100$) and health bands (`critical`, `at_risk`, `neutral`, `healthy`, `champion`).
    * `AskEntityAiInputSchema`: Validates prompt tokens ceiling ($\le 4,000$ tokens).
    * `ObjectCommandActionInputSchema`: Validates all 6 command types (`ask_ai`, `summarize`, `find_related`, `create_task`, `launch_agent_run`, `add_to_workflow`).
    * `CONTEXT_RAIL_ERROR_CODES`: Structured error code taxonomy.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail-actions.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `context-rail-types.ts` & `context-rail-service.ts`**
  - Define canonical contracts in `context-rail-types.ts` with strict Zod v4 types (`import { z } from 'zod/v4'`).
  - Implement `context-rail-service.ts`:
    * `calculateRelationshipHealth(interactions, lastContactDaysAgo)`: Computes 0–100 health score based on touchpoint recency and engagement frequency.
    * `categorizeHealthBand(score)`: Maps scores to semantic bands (`critical`: 0–29, `at_risk`: 30–59, `neutral`: 60–69, `healthy`: 70–89, `champion`: 90–100).
  - Add public barrel in `src/platform/ui/context-rail/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail-actions.test.ts`
  - Expected: PASS.

---

### Task 2: Context Rail Server Actions (`src/app/actions/context-rail-actions.ts`)

**Files:**
- Create: `src/app/actions/context-rail-actions.ts`
- Test: `src/platform/__tests__/ui/context-rail-actions.test.ts`

- [ ] **Step 1: Write failing Server Action tests**
  - Test session authentication `requireAuth()` rejecting unauthenticated callers.
  - Test Anti-IDOR validation `assertTenantContext` rejecting cross-tenant injections with `IDOR_VIOLATION`.
  - Test `getEntityContextRailDataAction`: Assembles the 6 modules from `CanonicalMemoryService` and platform stores.
  - Test `askEntityAiAction`:
    * Scans for prompt injection directives (`ADVERSARIAL_DIRECTIVE_PATTERNS`, Rule 30).
    * Enforces $\le 4,000$ token ceiling (Rules 28 & 56).
    * Retrieves evidence pack and formats citations with verbatim snippets and confidence scores.
    * Emits `context.ai.queried` domain event to `defaultEventBus` (Rule 40).
  - Test `executeObjectCommandAction`:
    * Evaluates `checkGovernanceDeadManSwitch(organizationId)` on mutating commands, failing closed with `CONTEXT_DEAD_MAN_PAUSED` (Rule 60).
    * Returns actionable target URL (`actionTargetUrl`) ensuring "No Dead Ends" (§81).
    * Emits `command.object.executed` domain event.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail-actions.test.ts`
  - Expected: FAIL with action not found.

- [ ] **Step 3: Implement `context-rail-actions.ts`**
  - Add `'use server'` directive.
  - Implement `getEntityContextRailDataAction(entityId, entityType, options)`.
  - Implement `askEntityAiAction(rawInput)`.
  - Implement `executeObjectCommandAction(rawInput)`.
  - Add proper error sanitization masking sensitive error patterns (Rule 48).

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail-actions.test.ts`
  - Expected: PASS.

---

### Task 3: Context Rail Context & State Management (`src/components/context-rail/ContextRailContext.tsx`)

**Files:**
- Create: `src/components/context-rail/ContextRailContext.tsx`
- Test: `src/platform/__tests__/ui/context-rail.test.tsx`

- [ ] **Step 1: Write failing context & hook tests**
  - Test initial state (`isOpen: false`, `activeEntity: null`).
  - Test `toggleRail()`, `openRail()`, `closeRail()`.
  - Test `openRailForEntity({ id, type, name })` updates `activeEntity` and sets `isOpen: true`.
  - Test global keyboard shortcut `⌥C` (Option+C / Alt+C) toggling rail state.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail.test.tsx`
  - Expected: FAIL with component not found.

- [ ] **Step 3: Implement `ContextRailContext.tsx`**
  - Create React Context with `ContextRailContextType`:
    * `isOpen: boolean`
    * `toggleRail: () => void`
    * `openRail: (entity?: { id: string; type: string; name: string }) => void`
    * `closeRail: () => void`
    * `activeEntity: { id: string; type: string; name: string } | null`
    * `activeModuleTab: string`
    * `setActiveModuleTab: (tab: string) => void`
  - Implement global keyboard event listener for `Alt + C` / `Option + C`.
  - Export `ContextRailProvider` and custom hook `useContextRail()`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail.test.tsx`
  - Expected: PASS.

---

### Task 4: Adaptive Global Context Rail Component (`src/components/context-rail/`)

**Files:**
- Create: `src/components/context-rail/GlobalContextRail.tsx`
- Create: `src/components/context-rail/ContextRailTrigger.tsx`
- Create: `src/components/context-rail/modules/EntityDossierModule.tsx`
- Create: `src/components/context-rail/modules/RelatedEntitiesModule.tsx`
- Create: `src/components/context-rail/modules/InstitutionalMemoryModule.tsx`
- Create: `src/components/context-rail/modules/RelationshipHealthModule.tsx`
- Create: `src/components/context-rail/modules/ActiveRunsModule.tsx`
- Create: `src/components/context-rail/modules/PendingApprovalsModule.tsx`
- Create: `src/components/context-rail/index.ts`
- Test: `src/platform/__tests__/ui/context-rail.test.tsx`

- [ ] **Step 1: Write failing component tests**
  - Test rendering of the 6 contextual modules.
  - Test desktop sidebar slide-in transition ($< 50\text{ms}$).
  - Test mobile responsive sheet drawer on screens $< 768\text{px}$ (Rule 7).
  - Test click navigation from active runs to `/admin/intelligence/runs?runId=...`.
  - Test click navigation from pending approvals to `/admin/intelligence/approvals?proposalId=...`.
  - Test `<UntrustedReferenceData>` isolation for memory citations (Rules 13 & 30).
  - Test touch targets $\ge 44\text{px}$ (Rule 7) and tactile active state (`active:scale-[0.97]`).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail.test.tsx`
  - Expected: FAIL with components not found.

- [ ] **Step 3: Implement `GlobalContextRail.tsx` & the 6 modules**
  - Implement `GlobalContextRail`:
    * Desktop view: fixed right drawer `w-96 border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl z-40 transition-transform duration-300`.
    * Mobile view: Radix `Sheet` / `SheetContent` slide-over from right on mobile viewports.
    * Header: Entity title, close button, refresh button.
    * Module Navigation Tabs / Accordion:
      1. **Entity Dossier:** Quick facts, status badge, sentiment chip.
      2. **Relationship Health:** Visual circular score meter (0–100), health band badge (`Healthy`, `At Risk`, etc.), recency indicator.
      3. **Related Entities Mesh:** Interactive badges linking to related contacts, institutions, deals.
      4. **Institutional Memory:** Top 5 memory snippets wrapped in `<UntrustedReferenceData id="...">` with citation tags.
      5. **Active Agent Runs:** List of executing runs with step progress and direct link to Mission Control.
      6. **Pending Approvals:** Pending proposal cards with risk chips (L0–L4) and one-click link to Approval Center.
  - Implement `ContextRailTrigger`:
    * Header icon button with badge indicator when active runs or pending approvals exist for the current entity.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail.test.tsx`
  - Expected: PASS.

---

### Task 5: CRM Contextual "Ask About This" Surface (`src/components/crm/EntityAiPromptBar.tsx`)

**Files:**
- Create: `src/components/crm/EntityAiPromptBar.tsx`
- Test: `src/platform/__tests__/ui/entity-ai-prompt-bar.test.tsx`

- [ ] **Step 1: Write failing component tests**
  - Test rendering of the 5 dynamic quick-prompt chips:
    * "What do they care about?"
    * "What's unresolved?"
    * "What did we promise?"
    * "Summarize relationship"
    * "Prepare meeting briefing"
  - Test prompt chip click populating and submitting query.
  - Test freeform query input with submit button.
  - Test loading skeleton state during retrieval.
  - Test rendered answer with clickable citation tags (`[citation:1]`).
  - Test citation modal or expandable card showing verbatim snippet, author, and source type.
  - Test prompt injection containerization (`<UntrustedReferenceData id="...">`).
  - Test $\ge 44\text{px}$ touch targets (Rule 7).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/entity-ai-prompt-bar.test.tsx`
  - Expected: FAIL with component not found.

- [ ] **Step 3: Implement `EntityAiPromptBar.tsx`**
  - Build `EntityAiPromptBar`:
    * Quick-action chips horizontally scrollable with tactile hover and active scaling (`active:scale-[0.97]`).
    * Search input with Sparkles icon, loading indicator, and clear button.
    * Answer container: Markdown / plain text formatted response.
    * Citations bar: Clickable citation chips displaying source type (`crm`, `meeting`, `note`), author, and confidence score.
    * Citation detail popover / drawer showing the exact verbatim snippet wrapped in `<UntrustedReferenceData>`.
    * Token budget metric badge displaying tokens used within the $\le 4,000$ token ceiling.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/entity-ai-prompt-bar.test.tsx`
  - Expected: PASS.

---

### Task 6: Universal Object Command Menu (`src/components/shared/ObjectCommandMenu.tsx`)

**Files:**
- Create: `src/components/shared/ObjectCommandMenu.tsx`
- Test: `src/platform/__tests__/ui/object-command-menu.test.tsx`

- [ ] **Step 1: Write failing component tests**
  - Test trigger button ("...") with $\ge 44\text{px}$ touch target (Rule 7).
  - Test dropdown menu rendering 6 contextual actions:
    * `Ask AI about this entity`
    * `Summarize activity`
    * `Find related entities`
    * `Create follow-up task`
    * `Launch Agent Run`
    * `Add to Workflow`
  - Test clicking `Ask AI about this entity` opens the Context Rail.
  - Test clicking `Summarize activity` triggers synthesis action.
  - Test "No Dead Ends" rule (§81): Every action navigates or performs a verifiable action with toast feedback.
  - Test keyboard navigation (Arrow keys, Enter, Escape).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/object-command-menu.test.tsx`
  - Expected: FAIL with component not found.

- [ ] **Step 3: Implement `ObjectCommandMenu.tsx`**
  - Built on `@/components/ui/dropdown-menu`.
  - Props: `entityId`, `entityType`, `entityName`, `metadata`, `onActionComplete`, `className`.
  - Renders compact, high-contrast menu items with dedicated Lucide icons (`Sparkles`, `FileText`, `Network`, `CheckSquare`, `Bot`, `Workflow`).
  - Integrates with `useContextRail()` to immediately focus the right rail for contextual actions.
  - Dispatches `executeObjectCommandAction` for direct mutations with dead-man pause evaluation (Rule 60) and actionable toasts with relative navigation paths.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/object-command-menu.test.tsx`
  - Expected: PASS.

---

### Task 7: Layout & CRM Surface Integration (Strangler Fig SSOT)

**Files:**
- Modify: `src/app/admin/layout-client.tsx`
- Modify: `src/app/admin/entities/[id]/page.tsx`
- Test: Run full regression and integration suites

- [ ] **Step 1: Mount `ContextRailProvider` and `GlobalContextRail` in `AdminLayoutClient`**
  - Wrap admin shell with `ContextRailProvider`.
  - Render `<GlobalContextRail />` inside `AdminLayoutContent` right beside `<main>` content.
  - Add `<ContextRailTrigger />` to the header action bar beside `FloatingNotesTrigger` and `ThemeToggle`.
  - Preserve all existing layout providers (`TenantProvider`, `FloatingNotesProvider`, etc.).

- [ ] **Step 2: Mount `EntityAiPromptBar` on `EntityDetailPage` (`/admin/entities/[id]`)**
  - Add `EntityAiPromptBar` into the entity overview tab or persistent header area, allowing operators to immediately "Ask AI about this entity" with quick chips.
  - Mount `ObjectCommandMenu` on entity list rows, deals cards, or header menu.

- [ ] **Step 3: Verify zero regression to existing routes (Rule 69)**
  - Ensure `/admin/contacts`, `/admin/pipeline`, `/admin/tasks`, and `/admin/entities/[id]` remain 100% operational.

---

### Task 8: Verification & Static Quality Gates

- [ ] **Step 1: Execute all Milestone 4 test suites**
  - Run: `pnpm vitest run src/platform/__tests__/ui/context-rail-actions.test.ts src/platform/__tests__/ui/context-rail.test.tsx src/platform/__tests__/ui/entity-ai-prompt-bar.test.tsx src/platform/__tests__/ui/object-command-menu.test.tsx`
  - Expected: All tests passing with 100% pass rate.

- [ ] **Step 2: Execute regression test suites across earlier milestones**
  - Run: `pnpm vitest run src/platform/__tests__/ui/command-center.test.tsx src/platform/__tests__/ui/agent-runs-console.test.tsx src/platform/__tests__/ui/unified-approval-center.test.tsx`
  - Expected: All tests passing.

- [ ] **Step 3: Run TypeScript static typecheck**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Expected: 0 errors (Rule 4 zero `any` verification).

- [ ] **Step 4: Run ESLint static analysis**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint`
  - Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Author Completion Report**
  - Write `docs/agents_mcp/phases/agents_mcp_phase_8_milestone_4_completion_report.md` and artifact.

---

## 4. The 12-Point UX Implementation Gate (Rule 67) Checklist for Milestone 4

```
[ ] 1. Protocol & Version Compliance: App Router Server Actions ('use server'), React 19, Radix UI.
[ ] 2. Strict Typing Invariant (Rule 4): Zero `any` or `any[]`; all props and Server Actions strictly typed with Zod v4 schemas.
[ ] 3. Mobile & Touch Accessibility (Rule 7): All interactive touch targets >= 44px; responsive collapse to mobile Sheet drawer on screens < 768px.
[ ] 4. Multi-Tenant Boundary & Anti-IDOR (Rules 8 & 47): Session organizationId cross-validated on every action; fail-closed on mismatch.
[ ] 5. Resource Ceilings & Performance (Rules 9, 28 & 56): Hard knapsack budgeting ceiling (<= 4,000 tokens) on AI queries and context packs.
[ ] 6. Prompt Injection Defense (Rule 30): All untrusted entity fields, memories, and citations rendered in <UntrustedReferenceData> containers.
[ ] 7. Two-Phase Cryptographic Integrity (Rules 21 & 22): High-impact commands route to ActionProposal with SHA-256 payload hash verification.
[ ] 8. Explainability Standard (Rule 41): Plain-English grounded answers with explicit citations linking to source notes/records.
[ ] 9. Shadow Mode Simulation (Rule 42): Dry-run capability support for testing object commands.
[ ] 10. Dead-Man Switch Safety Gate (Rule 60): All mutating server actions evaluate checkGovernanceDeadManSwitch upfront.
[ ] 11. Real-Time SSE Reactivity (Rule 62): Active runs and pending approvals in the rail auto-refresh via useEventStream.
[ ] 12. Modal & Surface Architecture (theme.md §8): Rail surface binds to semantic tokens (--card, --border/80), with tactile active:scale-[0.97] buttons.
```
