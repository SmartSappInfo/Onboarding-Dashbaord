# Task Triage & Standup Filtering Engine Design Specification

> **Date:** 2026-10-10  
> **Status:** Draft / Pending Review  
> **Scope:** Tasks Hub (`src/app/admin/tasks/`) & Domain Filtering Engine (`src/lib/tasks/task-triage-filter-engine.ts`)  
> **Governance:** `.agents/AGENTS.md` and `docs/agents_mcp/agents_mcp_rules.md`

---

## 1. Executive Summary & Problem Statement

### 1.1 Problem Statement
The current Tasks Hub (`TasksClient.tsx`) suffers from two usability bottlenecks:
1. **Header Clutter:** The top toolbar features up to 8 separate dropdowns (`Selection`, `Statuses`, `Priorities`, `Tags`, `Time Range`, `Search`, `Simple View`, `+ Add Task`) plus a row of active filter chips. On mobile viewports and standard laptop screens, this wraps into multiple lines and consumes excessive vertical space.
2. **Rigid 4-Accordion Grouping:** The current layout splits tasks into four fixed groups (`This Month`, `Overdue Tasks`, `Upcoming Tasks`, `Completed Archive`). Users cannot triage work dynamically across operational time horizons (e.g., viewing work completed "Yesterday" while simultaneously looking at tasks upcoming "Today") without changing global filters that disrupt other sections.
3. **Agile Standup Inefficiency:** During daily agile standups, team members need to quickly review what was completed yesterday (or over the weekend if it is Monday), what is due today, and what is currently overdue or blocked. The current UI requires manual date navigation that does not account for weekend rollover or the agile "yesterday/today/blockers" flow.

### 1.2 Proposed Solution
1. **Consolidated Filter Popover:** Collapse all secondary filters (Status, Priority, Tags, Assignees) into a single, clean `<TaskFilterPopover>` button displaying an active filter badge (e.g. `Filters (2)`).
2. **Streamlined 3-Card Layout:** Eliminate the 4th "This Month" accordion in favor of exactly three operational cards:
   - **Overdue Tasks**
   - **Upcoming (Due)**
   - **Completed**
3. **Independent Card Sub-Filters:** Place inline segmented filter chips directly inside each card's accordion header row, allowing each section to filter independently.
4. **Global Presets Coordination:** Allow top-level presets (`Today`, `This Week`, `This Month`, `All Time`) to coordinate all three cards synchronously.
5. **Standup Mode with the Monday Weekend Twist:** Introduce a dedicated Standup Mode that:
   - Inverts the card order to match agile standup psychology: **Completed $\rightarrow$ Upcoming $\rightarrow$ Overdue**.
   - Expands the daily standup window on **Mondays** to cover **Friday, Saturday, Sunday, and Monday**.
   - Supports custom anchor date stepping (`<` and `>`) for retrospective standups.
6. **Default Scope:** Open with **All Tasks** by default across the workspace.

---

## 2. User Experience & Layout Redesign

### 2.1 Top Toolbar Minimalization
The top toolbar is consolidated into a clean, single-row layout:
- **Left:** Workspace Scope Switcher: `[ All Tasks (35) | My Tasks (22) | Team Tasks (35) ]` (Defaults to `All Tasks`).
- **Center/Action:**
  - Standup Mode Toggle: `[ 💼 Normal | 🎙️ Standup Mode ]`
  - Global Period Preset Stepper: `[ Today | This Week | This Month | All Time ]` with `<` and `>` anchor date steppers.
- **Right:**
  - Search input (`Search tasks...`).
  - Consolidated **`Filters`** button with active badge (`Filters (2)`).
  - `Simple View` toggle.
  - `+ Add Task` primary action button.

### 2.2 Dynamic Card Display Order

| Mode | Card 1 (Top) | Card 2 (Middle) | Card 3 (Bottom) | Rationale |
|---|---|---|---|---|
| **Normal Mode** *(Default)* | ⚠️ **Overdue Tasks** | ⏳ **Upcoming (Due)** | ✅ **Completed** | **Triage First:** Direct attention immediately to tasks falling behind, then manage upcoming commitments, and keep completed history at the base. |
| **Standup Mode** | ✅ **Completed** | ⏳ **Upcoming (Due)** | ⚠️ **Overdue Tasks** | **Agile Standup Flow:** Teams answer: 1) "What did I complete since last standup?", 2) "What am I working on today?", 3) "What is blocking me or overdue?" |

### 2.3 Card Header Sub-Filter Matrices

Each card header displays a dedicated segmented filter bar that updates **only** that card:

#### 1. Overdue Card
* **Header Options:** `Yesterday` | `This Week` | `Last Week` | `This Month` | `Last Month` | `All Time`
* **Filter Semantics:**
  - `Yesterday`: Due on or before yesterday (within 24h past).
  - `This Week`: Overdue tasks whose due dates were earlier this week.
  - `Last Week`: Tasks overdue from the previous calendar week.
  - `This Month`: Tasks overdue from earlier in the current month.
  - `Last Month`: Tasks overdue from the previous calendar month.
  - `All Time`: All unresolved overdue tasks regardless of age.

#### 2. Upcoming (Due) Card
* **Header Options:** `Today` | `Tomorrow` | `This Week` | `This Month` | `All Time`
* **Filter Semantics:**
  - `Today`: Due by 23:59:59 of the anchor date.
  - `Tomorrow`: Due by 23:59:59 of the day following anchor date.
  - `This Week`: Due by the end of the current calendar week.
  - `This Month`: Due by the end of the current calendar month.
  - `All Time`: All upcoming open tasks (including unscheduled backlog items).

#### 3. Completed Card
* **Header Options:** `Today` | `Yesterday` | `This Week` | `This Month` | `All Time`
* **Filter Semantics:**
  - `Today`: Completed on the anchor date.
  - `Yesterday`: Completed on the day prior to anchor date.
  - `This Week`: Completed within the current calendar week.
  - `This Month`: Completed within the current calendar month.
  - `All Time`: Complete historical log of resolved tasks.

---

## 3. The Monday Weekend Twist & Standup Engine

### 3.1 Agile Standup Psychology
In software and operations teams, Monday standups present a unique challenge: team members do not work on weekends, meaning "Yesterday" (Sunday) yields 0 completions. Reviewing only yesterday obscures accomplishments achieved on Friday afternoon.

### 3.2 Automated Monday Detection
When `triageMode === 'standup'`:
1. The engine checks the reference `anchorDate`:
   ```typescript
   const isMonday = getDay(anchorDate) === 1;
   ```
2. If `isMonday === true` and period is Daily:
   - **Completed Window:** Spans from **Friday 00:00:00 through Monday 23:59:59** (4 full calendar days).
   - **Upcoming Window:** Spans **Monday 00:00:00 through Monday 23:59:59**.
   - **Overdue Window:** All tasks with due dates prior to Monday 00:00:00 that remain open.
   - **UI Indicator:** Displays a subtle, helpful banner or badge on the Completed card:
     `"Monday Standup: Reviewing Friday – Monday work"`
3. If `isMonday === false` (Tuesday – Friday):
   - **Completed Window:** Spans `Yesterday 00:00:00` through `Today 23:59:59`.
   - **Upcoming Window:** Spans `Today 00:00:00` through `Today 23:59:59`.

### 3.3 Anchor Date Navigation
Users can step the anchor date forward or backward (`<` / `>`) or select a date via a mini date picker. The entire calculation (including the Monday detection rule) dynamically evaluates relative to the selected anchor date, enabling team leads to review past standups retrospectively.

---

## 4. Pure Domain Engine Architecture

A pure, framework-agnostic domain engine will be created at:
`src/lib/tasks/task-triage-filter-engine.ts`

### 4.1 Strict Domain Types (Zero `any` or `any[]`)
```typescript
export type TaskTriageMode = 'normal' | 'standup';

export type CompletedSubFilter =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'all_time';

export type UpcomingSubFilter =
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'this_month'
  | 'all_time';

export type OverdueSubFilter =
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'all_time';

export type GlobalPeriodPreset = 'today' | 'this_week' | 'this_month' | 'all_time';

export interface TaskTriageFilterOptions {
  anchorDate: Date;
  mode: TaskTriageMode;
  completedFilter: CompletedSubFilter;
  upcomingFilter: UpcomingSubFilter;
  overdueFilter: OverdueSubFilter;
}

export interface TaskTriageResult {
  overdueTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
  isMondayStandup: boolean;
}
```

### 4.2 Core Pure Functions
1. `filterCompletedTasks(tasks: Task[], filter: CompletedSubFilter, anchorDate: Date, mode: TaskTriageMode): Task[]`
2. `filterUpcomingTasks(tasks: Task[], filter: UpcomingSubFilter, anchorDate: Date, mode: TaskTriageMode): Task[]`
3. `filterOverdueTasks(tasks: Task[], filter: OverdueSubFilter, anchorDate: Date, mode: TaskTriageMode): Task[]`
4. `getGlobalPresetSubFilters(preset: GlobalPeriodPreset): { completed: CompletedSubFilter; upcoming: UpcomingSubFilter; overdue: OverdueSubFilter }`
5. `calculateTriageBuckets(tasks: Task[], options: TaskTriageFilterOptions): TaskTriageResult`

---

## 5. UI Subcomponents & Integration

### 5.1 `<TaskFilterPopover>`
* **Location:** `src/app/admin/tasks/components/filters/TaskFilterPopover.tsx`
* **Trigger:** Accessible tactile button (`min-h-[44px]`, `rounded-xl`, `active:scale-[0.97]`).
* **Content:**
  - Status multi-select pills (`To Do`, `In Progress`, `Waiting`, `Review`, `Done`).
  - Priority multi-select pills (`Low`, `Medium`, `High`, `Urgent`).
  - Workspace contact tags via standardized `<TagSelector clientDraftMode>`.
  - "Clear all filters" CTA.

### 5.2 `<TaskAccordionHeader>`
* **Location:** `src/app/admin/tasks/components/TaskAccordionHeader.tsx`
* **Features:**
  - Accordion toggle trigger (Chevron + Title + Count Badge).
  - Stop propagation on sub-filter chip clicks (`e.stopPropagation()`).
  - Horizontal scrolling container (`overflow-x-auto scrollbar-none`) with `min-h-[44px]` touch targets on mobile.
  - Active state visual indicator using `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground`.

### 5.3 `<StandupModeToggle>`
* **Location:** `src/app/admin/tasks/components/filters/StandupModeToggle.tsx`
* **Features:**
  - Segmented control on the top bar: `[ 💼 Normal | 🎙️ Standup Mode ]`.
  - Inverts card rendering order and activates Monday weekend detection.

---

## 6. Accessibility & Mobile Optimization (WCAG 2.1 AA)

1. **Touch Targets:** All interactive chips, popover options, steppers, and accordion headers enforce `min-h-[44px]` touch targets.
2. **Keyboard Navigation:** Full Tab/Enter/Space support across segmented chips and popover filters.
3. **Contrast & Color:** Status and priority badges combine semantic text and distinct icons; never rely on color alone.
4. **Screen Readers:** Sub-filters include descriptive `aria-label` attributes (e.g. `aria-label="Filter completed tasks by Yesterday"`).

---

## 7. Scale, Concurrency & Performance

1. **In-Memory Filtering:** All card sub-filters operate in-memory over the currently loaded cursor pagination batch. Switching between "Today" and "Yesterday" takes $< 1\text{ms}$ with zero Firestore network overhead.
2. **Zero `any` or `any[]`:** Full type safety enforced across domain interfaces and component props.
3. **Memoization:** Triage buckets are memoized via `React.useMemo` to ensure zero wasted re-renders on unrelated state changes.

---

## 8. Governance & MCP Rules Compliance Summary

* **Rule 1:** Modular subcomponents, clean architecture.
* **Rule 2:** Comprehensive test suite (`task-triage-filter-engine.test.ts`) validating 100% of date boundary math and Monday weekend rollover.
* **Rule 3:** Backward compatible; preserves all existing task mutations, board/calendar views, and downstream contracts.
* **Rule 4:** Zero `any` or `any[]`.
* **Rule 7:** Mobile-first, `min-h-[44px]` touch targets, plain English copy.
* **Rule 8:** Multi-tenant isolation bounded to `activeWorkspaceId`.
* **Rule 10:** Inline JSDoc architectural headers.
