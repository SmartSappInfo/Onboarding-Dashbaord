# Tasks Module Phase 4 Implementation Plan: Scale, Standups, Analytics & AI Copilot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 4 of the SmartSapp CRM Tasks Architecture, encompassing **Phase 4A: Scalable Cursor Pagination**, **Phase 4B: Daily Standups, Commitments & Blocker Lifecycle** (`/admin/standups`), **Phase 4C: Operational Analytics & Drill-Downs** (`/admin/task-analytics`), and **Phase 4D: AI Task Copilot & Action Intelligence**.

**Architecture:** Extend the canonical Tasks capability and contracts framework with cursor-based Firestore pagination, a dedicated multi-tab Standups system with draft auto-save and private manager notes, an operational analytics dashboard with actionable drill-downs, and a governed two-phase AI Copilot pipeline (`NL Prompt` → `Zod Schema Validation` → `Interactive Preview` → `User Confirmation` → `Canonical Capability Execution`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (Strict, 0 `any`), Tailwind CSS, Radix UI / shadcn/ui, Lucide Icons, date-fns, Recharts / SVG charting primitives, Firebase Firestore (cursor pagination with `startAfter`/`limit`), Vitest, `@testing-library/react`.

---

## Governance & MCP Rules Compliance Matrix (`docs/agents_mcp/agents_mcp_rules.md`)

| Rule # | Requirement | Phase 4 Architecture & Implementation Defense |
|---|---|---|
| **Rule 1** | Best practices & clean architecture | Uses modular subcomponents under `src/app/admin/standups/` and `src/app/admin/task-analytics/`, reusable chart widgets, and strict separation of presentation and domain services. |
| **Rule 2** | Risk mitigation & testability | Full TDD across cursor query bounds, standup submissions, blocker state transitions, analytics aggregation edge cases (zero vs missing), and AI prompt parsing. |
| **Rule 3** | Impact on other features & backoffice | Preserves existing `/admin/tasks` routes, filters, and relationships; standups and analytics link to tasks without destructive schema migrations. |
| **Rule 4** | Strict Typing (Zero `any` or `any[]`) | All domain entities (`StandupEntry`, `BlockerRecord`, `TaskAnalyticsSummary`, `AiTaskDraft`) strictly typed. External JSON narrowed via Zod schemas. |
| **Rule 5** | Staging & rule verification | Firestore security rules for `standups`, `blockers`, and analytics aggregations validated via unit tests before deployment. |
| **Rule 6** | Dependencies & documentation | Leverages native date-fns and existing charting libraries; context7 consulted for cutting-edge SDK updates. |
| **Rule 7** | Mobile-First & Plain-English UI | All buttons, tab triggers, and inputs enforce `min-h-[44px]` touch targets; clean, jargon-free UI copy with zero visual clutter. |
| **Rule 8** | Security & Privacy (Manager Notes) | Private manager notes in standups strictly filtered at the query layer and UI level; unauthorized team members cannot read them. |
| **Rule 9** | Load, Throttling & Pagination | Replaces 200-task ceiling with cursor-based pagination (`limit(50)` + `startAfter`); large analytics exports processed asynchronously without UI lockup. |
| **Rule 10** | Inline Architectural Guidance | Every file includes header comments detailing architecture, security rules, and testability pointers. |
| **Rule 12** | MCP Server-Side Permissions | AI Copilot tool calls validate permissions server-side on behalf of the authenticated user; never trusts client-side hints alone. |
| **Rule 13** | Trust Boundary Matrix | Distinguishes trusted user instructions from untrusted AI-inferred fields; displays explicit provenance and "Why this was suggested" badges. |
| **Rule 18** | TOCTOU & Concurrency | Standup amendment and blocker resolution use optimistic version checks (`expectedUpdatedAt`) to prevent concurrent overwrite collisions. |
| **Rule 19 & 20** | Idempotency & Replay Protection | Standup submissions and blocker state mutations include unique `idempotencyKey` to prevent duplicate submissions on network retry. |
| **Rule 21 & 22** | Two-Phase AI Action Model | Mandatory: Prompt → Structured Proposal → Validation → User Preview Dialog → Explicit Confirmation → Canonical Capability. Zero silent Firestore writes. |
| **Rule 23** | Budget & Resource Governance | AI task parsing bounded by character length (max 500 chars), checklist suggestion capped at max 10 items. |

---

## File Structure & Directory Map

```text
src/
├── app/
│   └── admin/
│       ├── tasks/
│       │   ├── components/
│       │   │   ├── TaskCopilotBar.tsx            # Phase 4D: Natural-language AI draft creator
│       │   │   ├── TaskCopilotDialog.tsx         # Phase 4D: Two-phase AI review & confirmation modal
│       │   │   └── TaskDetailDrawer.tsx          # Phase 4D: Embeds "Suggest steps" AI decomposition
│       │   └── hooks/
│       │       └── useTaskCursorPagination.ts    # Phase 4A: Stable cursor-based query engine
│       ├── standups/
│       │   ├── page.tsx                          # Phase 4B: Route entry point (/admin/standups)
│       │   ├── StandupsClient.tsx                # Phase 4B: Master client state & tab router
│       │   ├── components/
│       │   │   ├── MyStandupView.tsx             # 4-prompt form, task linking, private manager notes
│       │   │   ├── TeamOverviewView.tsx          # Exception-first submission dashboard & cards
│       │   │   ├── BlockersManagerView.tsx       # Blocker lifecycle (Acknowledge, Assign, Resolve)
│       │   │   ├── StandupHistoryView.tsx        # Past submissions, commitments & carryovers
│       │   │   └── StandupTaskPickerModal.tsx    # Modal to search and link authorized tasks
│       └── task-analytics/
│           ├── page.tsx                          # Phase 4C: Route entry point (/admin/task-analytics)
│           ├── TaskAnalyticsClient.tsx           # Phase 4C: Master analytics client & period filters
│           └── components/
│               ├── AnalyticsOverviewTab.tsx      # Created vs completed, backlog & overdue trends
│               ├── AnalyticsExecutionTab.tsx     # Throughput, cycle time, lead time
│               ├── AnalyticsWorkloadTab.tsx      # Team capacity & balance (non-toxic)
│               ├── AnalyticsBlockersTab.tsx      # Blocker MTTR, categories, age distribution
│               └── AnalyticsStandupsTab.tsx      # Standup compliance & commitment follow-through
├── ai/
│   ├── flows/
│   │   └── task-copilot-flow.ts                  # Server action: parses NL prompt into typed task proposal
│   └── schemas/
│       └── task-copilot-schemas.ts               # Zod schemas for AI task draft & checklist generation
├── lib/
│   ├── types.ts                                  # Extended with Standup, Blocker, and Analytics types
│   ├── standup-server-actions.ts                 # Server actions for standups and blockers
│   └── analytics/
│       └── task-analytics-service.ts             # Aggregation and metric calculation logic
└── platform/
    └── domains/tasks_productivity/
        └── contracts/
            ├── standup-submit.contract.ts        # Canonical contract for standup submission
            └── blocker-mutate.contract.ts        # Canonical contract for blocker lifecycle
```

---

## Detailed Implementation Tasks

### Task 1: Domain Types, Schemas & Canonical Contracts (Phase 4 Foundation)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/ai/schemas/task-copilot-schemas.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/standup-submit.contract.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/blocker-mutate.contract.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/__tests__/standup-blocker-contracts.test.ts`

- [ ] **Step 1: Write failing contract test for standup and blocker domain models**
  Verify schema validation for standup submissions (4 sections, task linkage, manager note privacy) and blocker lifecycle transitions (`open` → `acknowledged` → `resolved`).
- [ ] **Step 2: Update `src/lib/types.ts`**
  Add `StandupSubmission`, `StandupCommitment`, `BlockerRecord`, `BlockerSeverity`, `BlockerStatus`, `TaskAnalyticsMetric`, `AiTaskProposal`.
- [ ] **Step 3: Implement Zod schemas in `src/ai/schemas/task-copilot-schemas.ts`**
  Define `taskCopilotInputSchema`, `taskCopilotProposalSchema`, `taskChecklistProposalSchema`.
- [ ] **Step 4: Implement canonical contracts**
  Create `standup-submit.contract.ts` and `blocker-mutate.contract.ts` adhering to platform capability standards.
- [ ] **Step 5: Run tests and commit**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/standup-blocker-contracts.test.ts`
  Git commit: `feat(tasks): define domain types, schemas, and contracts for standups, blockers, and AI copilot`

---

### Task 2: Scalable Cursor Pagination & Stream Engine (`useTaskCursorPagination.ts`)

**Files:**
- Create: `src/app/admin/tasks/hooks/useTaskCursorPagination.ts`
- Create: `src/app/admin/tasks/hooks/__tests__/useTaskCursorPagination.test.ts`
- Modify: `src/app/admin/tasks/TasksClient.tsx`

- [ ] **Step 1: Write unit test for `useTaskCursorPagination`**
  Test initial batch fetch (`limit(50)`), cursor tracking (`startAfter`), append next page, duplicate elimination by `id`, and reset on filter change.
- [ ] **Step 2: Implement `useTaskCursorPagination.ts`**
  Encapsulate Firestore query with stable secondary ordering (`orderBy('dueDate', 'asc')`, `orderBy('__name__', 'asc')`), `hasMore` calculation, `isLoadingMore` state, and error recovery.
- [ ] **Step 3: Integrate into `TasksClient.tsx`**
  Replace hardcoded `limit(200)` with `useTaskCursorPagination`. Add an accessible `<Button>` "Load More Tasks" (`min-h-[44px]`) and "Showing X tasks" count indicator at the list footer.
- [ ] **Step 4: Run tests and verify zero regressions**
  Run: `pnpm test:run src/app/admin/tasks/hooks/__tests__/useTaskCursorPagination.test.ts src/app/admin/tasks/__tests__/`
- [ ] **Step 5: Commit changes**
  Git commit: `feat(tasks): implement cursor-based pagination and progressive loading in TasksClient`

---

### Task 3: Standup Server Actions & Blocker Lifecycle Service

**Files:**
- Create: `src/lib/standup-server-actions.ts`
- Create: `src/lib/__tests__/standup-server-actions.test.ts`

- [ ] **Step 1: Write failing tests for standup submission and blocker actions**
  Test: draft saving, submission with linked tasks, private manager note access restriction, blocker acknowledgment, and blocker resolution with note.
- [ ] **Step 2: Implement `src/lib/standup-server-actions.ts`**
  - `saveStandupDraftAction(workspaceId, draft)`
  - `submitStandupAction(workspaceId, submission)` (idempotent, records `submittedAt`, links tasks without mutating task status)
  - `mutateBlockerAction(workspaceId, blockerId, mutation)`
- [ ] **Step 3: Enforce TOCTOU and Idempotency**
  Check `expectedUpdatedAt` and generate `idempotencyKey` per Rule 18 & 19.
- [ ] **Step 4: Run tests and commit**
  Run: `pnpm test:run src/lib/__tests__/standup-server-actions.test.ts`
  Git commit: `feat(tasks): implement standup and blocker server actions with concurrency protection`

---

### Task 4: My Standup & Draft Auto-Save View (`MyStandupView.tsx`)

**Files:**
- Create: `src/app/admin/standups/components/MyStandupView.tsx`
- Create: `src/app/admin/standups/components/StandupTaskPickerModal.tsx`
- Create: `src/app/admin/standups/components/__tests__/MyStandupView.test.tsx`

- [ ] **Step 1: Write failing component test for `MyStandupView`**
  Test 4-part form rendering (Completed, Planned, Blockers, Help Needed), task search and linking, private manager note toggle, auto-save status indicator, and submission.
- [ ] **Step 2: Implement `StandupTaskPickerModal.tsx`**
  Modal conforming to Section 8 architecture (`DialogHeader demarcated`, `CardInfoTooltip`, `min-h-[44px]` touch targets) allowing users to select tasks to link.
- [ ] **Step 3: Implement `MyStandupView.tsx`**
  Vertical clean layout, inline item adder, debounced draft auto-save, explicit private-to-manager card with lock icon and tooltip, compact review dialog before submission.
- [ ] **Step 4: Run tests and commit**
  Run: `pnpm test:run src/app/admin/standups/components/__tests__/MyStandupView.test.tsx`
  Git commit: `feat(standups): create MyStandupView with task picker, draft auto-save, and private notes`

---

### Task 5: Team Overview & Blocker Lifecycle Manager (`TeamOverviewView.tsx`, `BlockersManagerView.tsx`)

**Files:**
- Create: `src/app/admin/standups/components/TeamOverviewView.tsx`
- Create: `src/app/admin/standups/components/BlockersManagerView.tsx`
- Create: `src/app/admin/standups/components/__tests__/TeamOverviewView.test.tsx`
- Create: `src/app/admin/standups/components/__tests__/BlockersManagerView.test.tsx`

- [ ] **Step 1: Write failing tests for Team Overview and Blocker Manager**
  Test: exception-first submission summary (Submitted vs Awaiting), blocker card rendering with severity indicators, and blocker action transitions (Acknowledge, Assign, Resolve).
- [ ] **Step 2: Implement `TeamOverviewView.tsx`**
  Submission metric cards, expandable member updates, blocker alert drawer. Privacy defense: strictly omits private manager notes from team display.
- [ ] **Step 3: Implement `BlockersManagerView.tsx`**
  List and Kanban views of blockers by status (`open`, `acknowledged`, `escalated`, `resolved`), severity chips, action popovers (`min-h-[44px]`), resolution note modal.
- [ ] **Step 4: Run tests and commit**
  Run: `pnpm test:run src/app/admin/standups/components/__tests__/TeamOverviewView.test.tsx src/app/admin/standups/components/__tests__/BlockersManagerView.test.tsx`
  Git commit: `feat(standups): create TeamOverviewView and interactive BlockersManagerView`

---

### Task 6: Standup History, Commitments & Standups Client Route (`/admin/standups/page.tsx`)

**Files:**
- Create: `src/app/admin/standups/components/StandupHistoryView.tsx`
- Create: `src/app/admin/standups/StandupsClient.tsx`
- Create: `src/app/admin/standups/page.tsx`
- Create: `src/app/admin/standups/__tests__/StandupsClient.test.tsx`

- [ ] **Step 1: Write integration test for `StandupsClient`**
  Verify tab switching (`my-standup`, `team`, `blockers`, `history`), URL search param persistence, breadcrumb, and tenant scope filtering.
- [ ] **Step 2: Implement `StandupHistoryView.tsx`**
  Past standup cards, carryover indicators with provenance links to original commitment (never phrased as a penalty score).
- [ ] **Step 3: Implement `StandupsClient.tsx` and `src/app/admin/standups/page.tsx`**
  App shell with header, breadcrumb (`Operations / Standups`), primary action (`Submit Standup`), and responsive tabs.
- [ ] **Step 4: Run tests and commit**
  Run: `pnpm test:run src/app/admin/standups/__tests__/StandupsClient.test.tsx`
  Git commit: `feat(standups): assemble StandupsClient page with history, carryover links, and tab routing`

---

### Task 7: Operational Task Analytics Dashboard (`/admin/task-analytics/page.tsx`)

**Files:**
- Create: `src/lib/analytics/task-analytics-service.ts`
- Create: `src/lib/analytics/__tests__/task-analytics-service.test.ts`
- Create: `src/app/admin/task-analytics/components/AnalyticsOverviewTab.tsx`
- Create: `src/app/admin/task-analytics/components/AnalyticsExecutionTab.tsx`
- Create: `src/app/admin/task-analytics/components/AnalyticsWorkloadTab.tsx`
- Create: `src/app/admin/task-analytics/components/AnalyticsBlockersTab.tsx`
- Create: `src/app/admin/task-analytics/TaskAnalyticsClient.tsx`
- Create: `src/app/admin/task-analytics/page.tsx`
- Create: `src/app/admin/task-analytics/__tests__/TaskAnalyticsClient.test.tsx`

- [ ] **Step 1: Write tests for metric calculations in `task-analytics-service.test.ts`**
  Verify throughput, cycle time (created to done), lead time, on-time completion percentage, cancelled exclusion (cancelled != done), and MTTR for blockers.
- [ ] **Step 2: Implement `task-analytics-service.ts`**
  Robust calculation helpers with edge case guards (empty data, zero denominator, timezone normalization).
- [ ] **Step 3: Implement Tab Components with Clickable Drill-Downs**
  Create KPI cards, trend charts (SVG/Recharts), and workload distribution bars. Clicking any KPI/segment navigates to `/admin/tasks` with relative query params.
- [ ] **Step 4: Implement `TaskAnalyticsClient.tsx` and `page.tsx`**
  Period filter (7d, 30d, 90d, custom), export button (CSV/XLSX), freshness badge ("Updated 2m ago").
- [ ] **Step 5: Run tests and commit**
  Run: `pnpm test:run src/lib/analytics/__tests__/task-analytics-service.test.ts src/app/admin/task-analytics/__tests__/TaskAnalyticsClient.test.tsx`
  Git commit: `feat(analytics): implement operational task analytics dashboard with drill-down navigation`

---

### Task 8: AI Task Copilot Engine & Two-Phase Dialog (`TaskCopilotBar.tsx`, `task-copilot-flow.ts`)

**Files:**
- Create: `src/ai/flows/task-copilot-flow.ts`
- Create: `src/ai/flows/__tests__/task-copilot-flow.test.ts`
- Create: `src/app/admin/tasks/components/TaskCopilotBar.tsx`
- Create: `src/app/admin/tasks/components/TaskCopilotDialog.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskCopilot.test.tsx`

- [ ] **Step 1: Write failing tests for AI natural-language parsing flow**
  Test parsing "Follow up with Sarah next Tuesday at 10am" into structured draft with title, category, due date, and detected ambiguity.
- [ ] **Step 2: Implement `src/ai/flows/task-copilot-flow.ts`**
  Server action: calls AI model with context (workspace members, entity types, current timezone), validates output against `taskCopilotProposalSchema`, rejects invalid output safely.
- [ ] **Step 3: Implement `TaskCopilotBar.tsx` & `TaskCopilotDialog.tsx`**
  - `TaskCopilotBar`: compact input bar (`✨ Describe a task... e.g. Call Kwame on Friday at 2pm`, `min-h-[44px]`).
  - `TaskCopilotDialog`: Two-Phase Review modal adhering to Section 8 standards, showing editable fields, confidence/provenance badge ("Why this was suggested"), ambiguity disambiguation chips, and explicit "Create Task" button.
- [ ] **Step 4: Run tests and commit**
  Run: `pnpm test:run src/ai/flows/__tests__/task-copilot-flow.test.ts src/app/admin/tasks/components/__tests__/TaskCopilot.test.tsx`
  Git commit: `feat(ai): build AI Task Copilot with natural-language parsing and two-phase confirmation dialog`

---

### Task 9: Task Detail AI Decomposition & Risk Insights

**Files:**
- Modify: `src/app/admin/tasks/components/TaskDetailDrawer.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskDetailDrawer-ai.test.tsx`

- [ ] **Step 1: Write failing test for "Suggest Steps" in `TaskDetailDrawer`**
  Assert that clicking "✨ Suggest steps" invokes AI checklist generator and presents items for review without automatically writing to database.
- [ ] **Step 2: Add AI checklist decomposition and risk badges into `TaskDetailDrawer.tsx`**
  Embed button "✨ Suggest steps", render suggested checklist items with individual add/dismiss triggers, and render subtle probabilistic risk notice ("Due within 24h with no checklist progress").
- [ ] **Step 3: Run tests and commit**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskDetailDrawer-ai.test.tsx`
  Git commit: `feat(tasks): integrate AI checklist step suggestion and risk insights into TaskDetailDrawer`

---

### Task 10: End-to-End Quality Gates & Comprehensive System Verification

**Files:**
- All Phase 4 components, server actions, contracts, and tests.

- [ ] **Step 1: Run complete Tasks test suite across Phase 1, 2, 3, and 4**
  Run: `pnpm test:run src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/platform/domains/tasks_productivity/`
  Confirm 100% test pass rate.
- [ ] **Step 2: Run TypeScript Typecheck**
  Run: `pnpm typecheck` (`NODE_OPTIONS='--max-old-space-size=8192' tsc --noEmit`)
  Confirm 0 TypeScript errors.
- [ ] **Step 3: Run ESLint**
  Run: `pnpm eslint src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/`
  Confirm 0 ESLint errors and warnings.
- [ ] **Step 4: Verify Zero `any` or `any[]` Invariant**
  Run: `grep -rn "any\[\]" src/app/admin/standups/ src/app/admin/task-analytics/`
  Confirm 0 matches.
- [ ] **Step 5: Final git commit for Phase 4**
  Git commit: `feat(tasks): complete Phase 4 scale, standups, analytics, and AI copilot implementation`

---

## Verification & Architecture Review Plan

1. **Automated Verification:**
   - Vitest suite covers contracts, cursor pagination, standup forms, blocker lifecycles, analytics math, and AI copilot parsing.
   - TypeScript compiler verification: zero unchecked types or `any`.
   - Linting verification: 100% clean across all new directories.

2. **Manual & Architectural Checklist (for Senior Principal Architect review):**
   - Confirm `/admin/standups` renders cleanly with 4 tabs and protects private notes.
   - Confirm `/admin/task-analytics` charts are accessible and have interactive drill-downs to `/admin/tasks`.
   - Confirm AI Copilot enforces the two-phase confirmation rule (no silent writes).
   - Confirm all interactive buttons meet `min-h-[44px]` touch targets on mobile.
   - Confirm all toast notifications with actions use relative paths starting with `/`.
