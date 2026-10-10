# Task Triage & Standup Filtering Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Tasks Hub into an industry-grade, minimal triage interface with 3 dynamic cards (Overdue, Upcoming, Completed), independent header sub-filters, global preset synchronization, a consolidated filter popover, and a dedicated Standup Mode featuring automated Monday weekend expansion (Friday–Monday coverage).

**Architecture:** Encapsulate all date arithmetic, Monday weekend detection, and card triage rules into a pure, testable domain engine (`src/lib/tasks/task-triage-filter-engine.ts`). Replace the cluttered 8-dropdown toolbar with a consolidated `<TaskFilterPopover>` and `<StandupModeToggle>`, and wire dynamic card ordering (Triage-First in Normal Mode vs. Agile Flow in Standup Mode) into `TasksClient.tsx`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (Strict, 0 `any`), Tailwind CSS, Radix UI / shadcn/ui (Popover, Accordion, Badge, Button), Lucide Icons, date-fns, Vitest, `@testing-library/react`.

---

## Governance & Agent Rules Compliance Matrix (`docs/agents_mcp/agents_mcp_rules.md`)

| Rule # | Requirement | Implementation Plan Defense |
|---|---|---|
| **Rule 1** | Clean architecture & standards | Pure calculation logic isolated in domain service; UI split into small, focused subcomponents (`TaskFilterPopover`, `TaskAccordionHeader`, `StandupModeToggle`). |
| **Rule 2** | Risk mitigation & testability | Full TDD on leap years, month boundaries, timezone midnights, Monday weekend rollover, and independent state isolation. |
| **Rule 3** | Zero regressions | Preserves all task mutations (status, delete, postpone, edit, obligation reverse sync, and board/calendar views). |
| **Rule 4** | Strict Typing (0 `any`/`any[]`) | Strongly typed union types (`CompletedSubFilter`, `UpcomingSubFilter`, `OverdueSubFilter`, `TaskTriageMode`). Zero `any` or unchecked casts. |
| **Rule 7** | Mobile-First & Plain-English UI | `min-h-[44px]` touch targets, horizontal scrollable chip rows on mobile, everyday plain English (`Today`, `Yesterday`, `This Week`, `This Month`, `All Time`). |
| **Rule 8** | Multi-Tenant Confinement | Scoped to `activeWorkspaceId`; relative navigation paths starting with `/`. |
| **Rule 9** | Scale & Throttling | In-memory filtering over the cursor-paginated dataset ($< 1\text{ms}$ execution, zero extra Firestore reads). |
| **Rule 10** | Inline Guidance | Exhaustive JSDoc headers on all domain functions and subcomponents explaining state and caution areas. |

---

## File Structure & Directory Map

```text
src/
├── lib/
│   └── tasks/
│       ├── task-triage-filter-engine.ts        # Pure domain calculation & Monday weekend rollover engine
│       └── __tests__/
│           └── task-triage-filter-engine.test.ts # Exhaustive unit tests for all date matrices & edge cases
└── app/
    └── admin/
        └── tasks/
            ├── TasksClient.tsx                  # Master client: wires default scope 'all', 3-card triage & global sync
            └── components/
                ├── TaskAccordionHeader.tsx      # Accordion header with independent horizontal sub-filter chips
                ├── filters/
                │   ├── TaskFilterPopover.tsx    # Consolidated filter button & floating popover (Status, Priority, Tags)
                │   ├── StandupModeToggle.tsx    # Normal vs. Standup mode segmented pill toggle with Monday indicator
                │   └── __tests__/
                │       ├── TaskFilterPopover.test.tsx
                │       └── StandupModeToggle.test.tsx
                └── __tests__/
                    └── TaskAccordionHeader.test.tsx
```

---

## Step-by-Step Implementation Tasks

### Task 1: Domain Filtering Engine (`task-triage-filter-engine.ts`) with TDD

**Files:**
- Create: `src/lib/tasks/task-triage-filter-engine.ts`
- Create: `src/lib/tasks/__tests__/task-triage-filter-engine.test.ts`

- [ ] **Step 1: Write failing unit test suite for date filtering & Monday rollover**
  Cover:
  - Normal Mode: Overdue ($< \text{anchorDate}$), Upcoming ($\ge \text{anchorDate}$), Completed.
  - Standup Mode on Tuesday (Yesterday + Today for Completed, Today for Upcoming, Past Overdue).
  - Standup Mode on Monday: Friday, Saturday, Sunday, and Monday in Completed.
  - Sub-filters: `Today`, `Yesterday`, `This Week`, `Last Week`, `This Month`, `Last Month`, `All Time`.
  - Custom anchor date shifting.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/lib/tasks/__tests__/task-triage-filter-engine.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `task-triage-filter-engine.ts`**
  Implement strict types and pure functions using `date-fns` (`isMonday`, `subDays`, `startOfDay`, `endOfDay`, `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `subWeeks`, `subMonths`).
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/lib/tasks/__tests__/task-triage-filter-engine.test.ts`
  Expected: PASS (100%).
- [ ] **Step 5: Git commit**
  Run: `git add src/lib/tasks/ && git commit -m "feat(tasks): implement task triage and standup filtering domain engine"`

---

### Task 2: Consolidated Filter Popover (`TaskFilterPopover.tsx`)

**Files:**
- Create: `src/app/admin/tasks/components/filters/TaskFilterPopover.tsx`
- Create: `src/app/admin/tasks/components/filters/__tests__/TaskFilterPopover.test.tsx`

- [ ] **Step 1: Write failing component test for `TaskFilterPopover`**
  Assert:
  - Renders trigger button with `min-h-[44px]` and active badge count.
  - Opens Popover on click showing Statuses, Priorities, and Tags.
  - Selecting Status/Priority updates callback.
  - "Clear all filters" resets active selections.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/app/admin/tasks/components/filters/__tests__/TaskFilterPopover.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement `TaskFilterPopover.tsx`**
  - Section 8 Popover geometry (`border border-border/80 bg-card text-card-foreground shadow-2xl rounded-2xl`).
  - Tactile trigger button (`min-h-[44px] active:scale-[0.97]`).
  - Integrates `<TagSelector clientDraftMode>`.
  - Clean badged selection pills for Status and Priority.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/filters/__tests__/TaskFilterPopover.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Git commit**
  Run: `git add src/app/admin/tasks/components/filters/TaskFilterPopover.tsx src/app/admin/tasks/components/filters/__tests__/TaskFilterPopover.test.tsx && git commit -m "feat(tasks): create consolidated TaskFilterPopover component"`

---

### Task 3: Standup Mode Toggle & Indicator (`StandupModeToggle.tsx`)

**Files:**
- Create: `src/app/admin/tasks/components/filters/StandupModeToggle.tsx`
- Create: `src/app/admin/tasks/components/filters/__tests__/StandupModeToggle.test.tsx`

- [ ] **Step 1: Write failing component test for `StandupModeToggle`**
  Assert:
  - Toggles between Normal and Standup mode.
  - When in Standup Mode on a Monday, renders `"Monday Standup: Reviewing Fri – Mon work"`.
  - Enforces `min-h-[44px]` touch targets.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/app/admin/tasks/components/filters/__tests__/StandupModeToggle.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement `StandupModeToggle.tsx`**
  - Segmented control with tactile feedback.
  - Monday standup helper pill.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/filters/__tests__/StandupModeToggle.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Git commit**
  Run: `git add src/app/admin/tasks/components/filters/StandupModeToggle.tsx src/app/admin/tasks/components/filters/__tests__/StandupModeToggle.test.tsx && git commit -m "feat(tasks): create StandupModeToggle component with Monday indicator"`

---

### Task 4: Interactive Card Accordion Header (`TaskAccordionHeader.tsx`)

**Files:**
- Create: `src/app/admin/tasks/components/TaskAccordionHeader.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskAccordionHeader.test.tsx`

- [ ] **Step 1: Write failing component test for `TaskAccordionHeader`**
  Assert:
  - Renders title, count badge, and sub-filter chips.
  - Tapping a sub-filter chip calls `onSelectFilter` without triggering accordion toggle (`stopPropagation`).
  - Enforces `min-h-[44px]` touch targets.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskAccordionHeader.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement `TaskAccordionHeader.tsx`**
  - Horizontal scroll container (`overflow-x-auto scrollbar-none`) for sub-filter chips.
  - Active state pill styling (`data-[state=active]:bg-primary data-[state=active]:text-primary-foreground`).
  - Accordion trigger with chevron rotation.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskAccordionHeader.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Git commit**
  Run: `git add src/app/admin/tasks/components/TaskAccordionHeader.tsx src/app/admin/tasks/components/__tests__/TaskAccordionHeader.test.tsx && git commit -m "feat(tasks): create TaskAccordionHeader with independent sub-filter chips"`

---

### Task 5: Integrate into `TasksClient.tsx` & Refactor Layout

**Files:**
- Modify: `src/app/admin/tasks/TasksClient.tsx`
- Modify: `src/app/admin/tasks/__tests__/TasksClient.test.tsx`

- [ ] **Step 1: Update default workspace scoping**
  Change default `taskScope` from `'my'` to `'all'` (**All Tasks**).
- [ ] **Step 2: Remove the 4th "This Month" accordion**
  Remove `currentPeriodLabel` and consolidate the list into exactly three cards: Overdue, Upcoming (Due), and Completed.
- [ ] **Step 3: Integrate domain engine & state management**
  - Add state for `triageMode`: `'normal' | 'standup'`.
  - Add states for `completedSubFilter`, `upcomingSubFilter`, `overdueSubFilter`.
  - Add `syncGlobalPreset(preset)` to coordinate all 3 cards synchronously when global preset changes.
  - Order cards dynamically:
    - Normal Mode: Overdue $\rightarrow$ Upcoming $\rightarrow$ Completed.
    - Standup Mode: Completed $\rightarrow$ Upcoming $\rightarrow$ Overdue.
- [ ] **Step 4: Consolidate top toolbar**
  - Mount `<StandupModeToggle>`.
  - Mount `<TaskFilterPopover>` (replacing individual dropdowns for status, priority, and tags).
  - Mount `<TaskAccordionHeader>` on each card.
- [ ] **Step 5: Run tests and verify zero regressions**
  Run: `pnpm test:run src/app/admin/tasks/__tests__/ src/app/admin/tasks/components/__tests__/`
  Expected: PASS (100%).
- [ ] **Step 6: Git commit**
  Run: `git add src/app/admin/tasks/TasksClient.tsx && git commit -m "refactor(tasks): integrate 3-card triage layout, consolidated filter popover, and standup mode"`

---

### Task 6: Comprehensive Verification & Quality Gates

**Files:**
- All created and modified files.

- [ ] **Step 1: Run all Tasks and Standups test suites**
  Run: `pnpm test:run src/lib/tasks/__tests__/ src/app/admin/tasks/components/filters/__tests__/ src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/ src/app/admin/standups/`
  Confirm 100% pass rate.
- [ ] **Step 2: Verify Strict Typing (Zero `any` or `any[]`)**
  Run: `grep -rn "any\[\]" src/lib/tasks/ src/app/admin/tasks/components/filters/`
  Confirm 0 occurrences.
- [ ] **Step 3: Review Mobile Touch Target Compliance**
  Confirm all buttons, chips, and triggers enforce `min-h-[44px]`.
- [ ] **Step 4: Final commit and verification record**
  Run: `git commit --allow-empty -m "chore(tasks): complete Task Triage and Standup Filtering Engine verification"`
