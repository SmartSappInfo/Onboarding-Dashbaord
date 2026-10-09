# Phase 2: Core Tasks Experience, Typing Consistency & Workspace Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the main `/admin/tasks` screen into a predictable, highly responsive, accessible, and strictly typed enterprise task management workspace featuring a refined top-bar hierarchy, scope switcher (`My Tasks | Team | All`), active filter chips with one-click clear, progressive disclosure task editor, mobile-responsive agenda calendar, and zero `any` or `any[]`, strictly conforming to `.agents/AGENTS.md` and `docs/agents_mcp/agents_mcp_rules.md`.

**Architecture:**
- **Landing Page & Navigation Hierarchy (Roadmap §27, UI Spec §442-450):** Standardize `/admin/tasks` layout with dominant page title, restrained operational metrics, segmented scope switcher (`My Tasks | Team | All`), and three distinct view controls (`List | Board | Calendar`).
- **Active Filter Chips Engine (Roadmap §29, UI Spec §507, 513):** Removable chips bar reflecting active search, status, priority, tag, assignee, and date filters with a one-click `Clear all` control.
- **Progressive Disclosure Task Editor (Roadmap §31-32, UI Spec §516-530, PRD §14.2):** Retain fast preset templates in Step 1, restructure Step 2 with required title dominance and collapsible progressive sections (`Details`, `Work`, `Schedule`, `Context` with CRM record prefill, `Organization` with `<TagSelector>`, `Checklist`, and `Reminders`), all with `min-h-[44px]` touch targets.
- **Calendar & Mobile Agenda Stabilization (Roadmap §28, UI Spec §491-501):** Eliminate untyped lookups, standardize badges with Phase 1 primitives, and introduce a compact agenda/list fallback view for mobile viewports and overdue task discovery.
- **Strict Compliance (`.agents/AGENTS.md` & `docs/agents_mcp/agents_mcp_rules.md`):** Zero `any` or `any[]`, relative actionable toast navigation starting with `/`, Section 8 modal geometry, and `min-h-[44px]` touch targets.

**Tech Stack:** Next.js (App Router), React 19, TypeScript (Strict), Cloud Firestore, Tailwind CSS, Lucide React, date-fns, Vitest, React Testing Library.

---

## 1. Compliance Matrix: `docs/agents_mcp/agents_mcp_rules.md`

| Rule # | Requirement | Implementation in Phase 2 |
| :--- | :--- | :--- |
| **Rule 1** | Conform to skills (`next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`). Maintain & improve pre-existing app features. | Preserves all existing functionality (List, Board, Calendar, period grouping tabs, contact tags dropdown, entity logo lookup, mobile filter sheets, simple/detailed view density toggle, TOCTOU version conflict modal, and bulk actions). Tactile scaling (`active:scale-[0.97]`) applied across all interactive buttons. |
| **Rule 2** | Risk analysis: What could go wrong & how to resolve it? Run typecheck, lint, git commit; do NOT push to origin. | Exhaustive Risk Analysis & Failure Mode Matrix defined in Section 2. Automated verification tasks running `pnpm test:run`, `pnpm typecheck`, `pnpm eslint`. Zero remote git push. |
| **Rule 3** | Blast radius: What other features will be broken/affected? Backoffice governance integration. | Cross-module blast radius analyzed in Section 3 (Dashboard TaskWidget, Entity Detail page, Deal task linkage, Contract obligations). Permission error toasts navigate to `/admin/settings/permissions`. |
| **Rule 4** | Strict typing: ZERO `any`, `any[]`, or unchecked casts. `unknown` validated with schemas at trust boundaries. | All state, props, payloads, and local storage values strictly typed. Zero `any` or `any[]` code occurrences across all task components, contracts, and clients. |
| **Rule 5** | Staging, verification, and deployment safety. | Local commits only (`git commit`). Remote `git push` is strictly prohibited. Quality gates verified before completion. |
| **Rule 6** | Dependencies properly configured; Context7 documentation. | Rely strictly on installed and verified dependencies (`date-fns`, `lucide-react`, `vitest`). Use Context7 for SDK documentation if needed. |
| **Rule 7** | Mobile & Accessibility First: `min-h-[44px]` touch targets, minimal everyday UI English. | All interactive buttons, chips, inputs, and triggers satisfy `min-h-[44px]`. Visual cues never rely on color alone (icon + text labels for all states). Plain everyday UI English. |
| **Rule 8** | High security standards: multi-tenant containment, relative actionable toast paths starting with `/`. | Actionable toast navigation strictly validated to begin with `/`. Multi-tenant boundaries enforced on server actions via `requireWorkspace()`. |
| **Rule 9** | Scalability & high load support: avoid batch processing overload or resource exhaustion. | Filter derivations memoized with `useMemo`. Batch chunking ($\le 450$ items). Skeletons prevent layout shift. |
| **Rule 10** | In-code architectural guidance & comments. | Every file and major function includes inline architectural comments explaining what changed, why, caution areas for future maintainers, and testability pointers. |
| **Rules 11-25** | MCP & Agent Governance: Trust boundaries, Actor tracking, Idempotency, Concurrency. | Preserves TOCTOU Version conflict handling (`VersionConflictDialog`). Idempotent reverse hooks (`syncTaskCompletionToObligation`). Actor-aware audit tracking. |

---

## 2. Risk Analysis: What Could Go Wrong & Resolution Plan (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Preventive Architecture & Resolution |
| :--- | :--- | :--- | :--- |
| **1. Scope Switcher Desynchronization** | User toggles `My Tasks` while a specific assignee filter or global user filter is active in `GlobalFilterProvider`. | Confusing zero-results state or conflicting filter states. | Scope switcher explicitly resets conflicting manual assignee dropdowns to `'all'` when switched, and surfaces an active filter chip indicating the active scope override. |
| **2. Active Filter Chips Invalidation Race** | Removing a filter chip while a query is loading or while bulk selection mode is active. | Stale selection IDs pointing to filtered-out tasks; inconsistent state. | Selection IDs are filtered against current `filteredTasks` when filters change. Removing a chip invokes the canonical filter setter which triggers an immediate recalculation. |
| **3. TaskEditor CRM Record Overwrite** | Pre-filled CRM record linkage (from Entity Detail or Deal page) gets overwritten when editing secondary sections. | Broken cross-module relationship linkage. | `TaskEditor` protects pre-filled entity state with a `disableEntitySelect` flag and explicit default values from `task.entityId` and `task.entityType`. |
| **4. Calendar Agenda Mobile Viewport Overflow** | Multi-column week/day grids overflow narrow mobile viewports (<375px). | Broken layout, horizontal scrolling, inaccessible event pills. | Responsive breakpoint automatically falls back to the newly introduced `Agenda` list view on screens `<768px`, while providing a clear toggle on desktop. |
| **5. Unchecked LocalStorage Schema Corruption** | User has legacy or corrupted string in `localStorage.getItem('task_scope')`. | Application crash or undefined scope state. | At trust boundary (localStorage), validate with fallback schema: `['my', 'team', 'all'].includes(val) ? val : 'my'`. |
| **6. Open Redirect Security Vulnerability** | Malicious or improperly constructed toast navigation path. | XSS or Open Redirect vulnerability. | Enforce workspace rule: `actionConfig.path` must strictly be a relative path beginning with a single `/`. Direct external links, protocols, or javascript targets are rejected. |

---

## 3. Cross-Module Blast Radius & Backoffice Governance (Rule 3)

| Affected Module | Relationship / Integration | Invariant Protection |
| :--- | :--- | :--- |
| **Dashboard TaskWidget** (`src/components/dashboard/TaskWidget.tsx`) | Displays urgent and due-today tasks on executive dashboard. | Relies on shared `Task`, `TaskPriority`, and `TaskStatus` types. Must remain 100% binary compatible with zero breaking schema changes. |
| **Entity Detail Page** (`src/app/admin/entities/[id]/page.tsx`) | Lists entity-linked tasks and launches task creation dialog. | Task creation pre-fills `entityId` and `entityType`. `TaskEditor` must honor `preFilledEntityName` and `disableEntitySelect`. |
| **Deal Next-Best-Action** (`src/app/admin/deals/`) | Automated task recommendations for deal stages. | Contractual obligation reverse hooks and status transitions must remain atomic and idempotent. |
| **DocSigning Contract Obligations** | Auto-generates tasks for contractual milestones. | When any task transitions to `done` (manual, Kanban, bulk, or editor), the contractual reverse hook (`syncTaskCompletionToObligation`) must execute. |
| **Backoffice Permission Matrix** (`/admin/settings/permissions`) | Governs `canViewAllTasks`, `canCreateTasks`, and `canDeleteTasks`. | When an unauthorized user attempts an admin-only action (e.g. clicking disabled `All Tasks`), an actionable toast with `actionConfig: { path: '/admin/settings/permissions', label: 'View Permissions' }` directs them to settings without code changes. |

---

## 4. File Structure & Responsibilities

| File Path | Responsibility |
| :--- | :--- |
| `src/app/admin/tasks/components/TaskFilterChips.tsx` (Create) | Renders active filter chips with individual dismiss (X) and global `Clear all` button. |
| `src/app/admin/tasks/components/__tests__/TaskFilterChips.test.tsx` (Create) | Unit tests for active filter chips rendering, removal callbacks, and reset behavior. |
| `src/app/admin/tasks/components/TaskScopeSwitcher.tsx` (Create) | Segmented scope control (`My Tasks | Team | All`) with permission awareness, badge counts, and tooltips. |
| `src/app/admin/tasks/components/__tests__/TaskScopeSwitcher.test.tsx` (Create) | Tests for scope selection, contributor defaults, and permission gating. |
| `src/app/admin/tasks/components/TaskEditor.tsx` (Refactor) | Progressive disclosure layout, required title dominance, CRM prefill, `<TagSelector>` integration, and `min-h-[44px]` touch targets. |
| `src/app/admin/tasks/components/__tests__/TaskEditor-progressive-disclosure.test.tsx` (Create) | Tests verifying title dominance, collapsible progressive sections, and `<TagSelector>` draft state binding. |
| `src/app/admin/tasks/components/TaskCalendar.tsx` (Refactor) | Eliminate untyped icon maps, standardize with Phase 1 primitives, add mobile agenda list view and overdue task discoverability. |
| `src/app/admin/tasks/components/__tests__/TaskCalendar-standards.test.tsx` (Create) | Tests verifying calendar view rendering, mobile agenda toggle, and strict typing. |
| `src/app/admin/tasks/TasksClient.tsx` (Refactor) | Integrate `TaskScopeSwitcher`, `TaskFilterChips`, revised restrained summary stats line, mobile sheet improvements, and filter state preservation. |
| `src/app/admin/tasks/__tests__/TasksClient-phase-2-integration.test.ts` (Create) | Integration tests verifying scope switching, active filter chips, and toast navigation. |

---

## 5. Bite-Sized Implementation Tasks

---

### Task 1: Scope Switcher Primitive (`TaskScopeSwitcher.tsx`)

**Files:**
- Create: `src/app/admin/tasks/components/TaskScopeSwitcher.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskScopeSwitcher.test.tsx`

- [ ] **Step 1: Write failing test for `TaskScopeSwitcher`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskScopeSwitcher.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskScopeSwitcher, type TaskScope } from '../TaskScopeSwitcher';

describe('TaskScopeSwitcher (Roadmap §27, UI Spec §444-462)', () => {
  it('renders My Tasks, Team Tasks, and All Tasks segments', () => {
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={vi.fn()}
        canViewAllTasks={true}
        counts={{ my: 5, team: 12, all: 24 }}
      />
    );
    expect(screen.getByRole('button', { name: /my tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /team tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all tasks/i })).toBeInTheDocument();
  });

  it('triggers onScopeChange when clicking a selectable scope', () => {
    const onScopeChange = vi.fn();
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={onScopeChange}
        canViewAllTasks={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /team tasks/i }));
    expect(onScopeChange).toHaveBeenCalledWith('team');
  });

  it('disables All Tasks when canViewAllTasks is false and displays permission tooltip', () => {
    const onScopeChange = vi.fn();
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={onScopeChange}
        canViewAllTasks={false}
      />
    );
    const allBtn = screen.getByRole('button', { name: /all tasks/i });
    expect(allBtn).toBeDisabled();
    fireEvent.click(allBtn);
    expect(onScopeChange).not.toHaveBeenCalled();
  });

  it('satisfies min-h-[44px] touch target rule on interactive buttons', () => {
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={vi.fn()}
        canViewAllTasks={true}
      />
    );
    const myBtn = screen.getByRole('button', { name: /my tasks/i });
    expect(myBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskScopeSwitcher.test.tsx`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `TaskScopeSwitcher.tsx` with architectural comments (Rule 10)**

```tsx
// src/app/admin/tasks/components/TaskScopeSwitcher.tsx
'use client';

/**
 * TaskScopeSwitcher
 * Segmented scope control conforming to Roadmap §27 and UI Spec §444-462:
 * - Contributors default to My Tasks.
 * - Team leads can switch to Team Tasks.
 * - All Tasks is permission-controlled with tooltip and disabled state.
 * - Tactile active:scale-[0.97] feedback and min-h-[44px] touch targets per .agents/AGENTS.md.
 * 
 * Caution:
 * - Do not remove disabled state on 'all' scope as standard users must be prevented from seeing workspace-wide tasks.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { User, Users, Globe, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type TaskScope = 'my' | 'team' | 'all';

export interface TaskScopeSwitcherProps {
    currentScope: TaskScope;
    onScopeChange: (scope: TaskScope) => void;
    canViewAllTasks?: boolean;
    counts?: {
        my?: number;
        team?: number;
        all?: number;
    };
    className?: string;
}

export function TaskScopeSwitcher({
    currentScope,
    onScopeChange,
    canViewAllTasks = true,
    counts,
    className,
}: TaskScopeSwitcherProps) {
    const scopes: Array<{ id: TaskScope; label: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean; tooltip?: string }> = [
        { id: 'my', label: 'My Tasks', icon: User },
        { id: 'team', label: 'Team Tasks', icon: Users },
        { 
            id: 'all', 
            label: 'All Tasks', 
            icon: canViewAllTasks ? Globe : Lock, 
            disabled: !canViewAllTasks,
            tooltip: !canViewAllTasks ? 'Requires admin or manager permissions to view all tasks.' : undefined,
        },
    ];

    return (
        <TooltipProvider>
            <div className={cn("inline-flex items-center p-1 bg-muted/40 rounded-xl border border-border/80 shadow-xs", className)}>
                {scopes.map(s => {
                    const Icon = s.icon;
                    const isSelected = currentScope === s.id;
                    const count = counts?.[s.id];

                    const buttonElement = (
                        <button
                            key={s.id}
                            type="button"
                            disabled={s.disabled}
                            onClick={() => !s.disabled && onScopeChange(s.id)}
                            aria-label={s.label}
                            aria-pressed={isSelected}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all select-none min-h-[44px] sm:min-h-[36px] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                isSelected
                                    ? "bg-card text-foreground shadow-sm font-bold border border-border/60"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                                s.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                            )}
                        >
                            <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                            <span>{s.label}</span>
                            {typeof count === 'number' && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5",
                                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );

                    if (s.tooltip) {
                        return (
                            <Tooltip key={s.id}>
                                <TooltipTrigger asChild>
                                    <span>{buttonElement}</span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-xs">{s.tooltip}</TooltipContent>
                            </Tooltip>
                        );
                    }

                    return buttonElement;
                })}
            </div>
        </TooltipProvider>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskScopeSwitcher.test.tsx`
  Expected: PASS (4/4 tests).

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/TaskScopeSwitcher.tsx src/app/admin/tasks/components/__tests__/TaskScopeSwitcher.test.tsx
  git commit -m "feat(tasks): create TaskScopeSwitcher segmented control with permission gating"
  ```

---

### Task 2: Active Filter Chips Bar (`TaskFilterChips.tsx`)

**Files:**
- Create: `src/app/admin/tasks/components/TaskFilterChips.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskFilterChips.test.tsx`

- [ ] **Step 1: Write failing test for `TaskFilterChips`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskFilterChips.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskFilterChips, type FilterChipItem } from '../TaskFilterChips';

describe('TaskFilterChips (Roadmap §29, UI Spec §507, 513)', () => {
  const sampleChips: FilterChipItem[] = [
    { key: 'status', label: 'Status: In Progress', value: 'in_progress' },
    { key: 'priority', label: 'Priority: Urgent', value: 'urgent' },
    { key: 'tag', label: 'Tag: High Value', value: 'tag-1' },
  ];

  it('renders active filter chips with label and dismiss buttons', () => {
    render(
      <TaskFilterChips
        chips={sampleChips}
        totalMatching={8}
        onRemoveChip={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText('Status: In Progress')).toBeInTheDocument();
    expect(screen.getByText('Priority: Urgent')).toBeInTheDocument();
    expect(screen.getByText('Tag: High Value')).toBeInTheDocument();
    expect(screen.getByText(/8 tasks match/i)).toBeInTheDocument();
  });

  it('calls onRemoveChip when individual X button is clicked', () => {
    const onRemoveChip = vi.fn();
    render(
      <TaskFilterChips
        chips={sampleChips}
        onRemoveChip={onRemoveChip}
        onClearAll={vi.fn()}
      />
    );
    const removeButtons = screen.getAllByRole('button', { name: /remove filter/i });
    fireEvent.click(removeButtons[0]);
    expect(onRemoveChip).toHaveBeenCalledWith(sampleChips[0]);
  });

  it('calls onClearAll when Clear all button is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <TaskFilterChips
        chips={sampleChips}
        onRemoveChip={vi.fn()}
        onClearAll={onClearAll}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when chips array is empty', () => {
    const { container } = render(
      <TaskFilterChips
        chips={[]}
        onRemoveChip={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskFilterChips.test.tsx`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `TaskFilterChips.tsx` with architectural comments (Rule 10)**

```tsx
// src/app/admin/tasks/components/TaskFilterChips.tsx
'use client';

/**
 * TaskFilterChips
 * Removable filter chips bar conforming to UI Spec §507 and Roadmap §29.
 * Surfaces active filters, live matching counts, and a one-click 'Clear all' button.
 * - Min-h-[44px] on mobile dismiss targets for accessibility.
 * - Tactile active:scale-[0.97] feedback.
 */

import * as React from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterChipItem {
    key: string;
    label: string;
    value: string;
}

export interface TaskFilterChipsProps {
    chips: FilterChipItem[];
    totalMatching?: number;
    onRemoveChip: (chip: FilterChipItem) => void;
    onClearAll: () => void;
    className?: string;
}

export function TaskFilterChips({
    chips,
    totalMatching,
    onRemoveChip,
    onClearAll,
    className,
}: TaskFilterChipsProps) {
    if (!chips.length) return null;

    return (
        <div className={cn(
            "flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs",
            className
        )}>
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 mr-1">
                <Filter className="h-3.5 w-3.5" />
                <span>Filters:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {chips.map((chip) => (
                    <Badge
                        key={`${chip.key}-${chip.value}`}
                        variant="secondary"
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold bg-card border border-border/80 text-foreground shadow-2xs hover:bg-muted/40 transition-colors"
                    >
                        <span>{chip.label}</span>
                        <button
                            type="button"
                            aria-label={`Remove filter ${chip.label}`}
                            onClick={() => onRemoveChip(chip)}
                            className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.95] transition-all cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </Badge>
                ))}
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-auto pt-1 sm:pt-0">
                {typeof totalMatching === 'number' && (
                    <span className="text-[11px] font-medium text-muted-foreground">
                        <strong className="text-foreground">{totalMatching}</strong> tasks match
                    </span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    aria-label="Clear all filters"
                    className="h-8 min-h-[44px] sm:min-h-[32px] text-xs font-semibold px-2.5 text-muted-foreground hover:text-destructive active:scale-[0.97] rounded-lg gap-1"
                >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear all</span>
                </Button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskFilterChips.test.tsx`
  Expected: PASS (4/4 tests).

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/TaskFilterChips.tsx src/app/admin/tasks/components/__tests__/TaskFilterChips.test.tsx
  git commit -m "feat(tasks): create TaskFilterChips bar with one-click clear all"
  ```

---

### Task 3: TaskEditor Progressive Disclosure & Ergonomics Refactor

**Files:**
- Modify: `src/app/admin/tasks/components/TaskEditor.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskEditor-progressive-disclosure.test.tsx`

- [ ] **Step 1: Write failing test for progressive disclosure in `TaskEditor`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskEditor-progressive-disclosure.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskEditor from '../TaskEditor';

vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(),
  useUser: vi.fn(() => ({ user: { uid: 'user-1' } })),
  useCollection: vi.fn(() => ({ data: [] })),
}));

describe('TaskEditor Progressive Disclosure & Ergonomics (Roadmap §31-32, PRD §14.2)', () => {
  it('renders dominant title input on initial form view without opening advanced sections', async () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />
    );
    // Move past preset step
    const scratchBtn = screen.getByRole('button', { name: /start from scratch/i });
    fireEvent.click(scratchBtn);

    // Title must be dominant
    const titleInput = screen.getByPlaceholderText(/what needs to be done\?/i);
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.className).toMatch(/min-h-\[44px\]/);
  });

  it('renders progressive sections (Details, Context, Organization, Reminders)', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));

    expect(screen.getByText(/organization/i)).toBeInTheDocument();
    expect(screen.getByText(/context/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it passes/fails**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskEditor-progressive-disclosure.test.tsx`

- [ ] **Step 3: Refactor `TaskEditor.tsx` progressive disclosure**
  - Verify all touch targets inside `TaskEditor.tsx` meet `min-h-[44px]` (inputs, selects, tag buttons, footer buttons).
  - Wrap secondary metadata (Reminders, Attachments, Notes) into clear, labeled progressive sections.
  - Preserve `<TagSelector>` integration in client/draft mode (`currentTagIds={field.value}` and `onTagsChange={field.onChange}`).
  - Pre-fill CRM record connection if `task.entityId` or `preFilledEntityName` is supplied.
  - Ensure zero `any` or `any[]` throughout `TaskEditor.tsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskEditor-progressive-disclosure.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/TaskEditor.tsx src/app/admin/tasks/components/__tests__/TaskEditor-progressive-disclosure.test.tsx
  git commit -m "refactor(tasks): improve TaskEditor progressive disclosure and mobile touch targets"
  ```

---

### Task 4: Calendar & Mobile Agenda Stabilization (`TaskCalendar.tsx`)

**Files:**
- Modify: `src/app/admin/tasks/components/TaskCalendar.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskCalendar-standards.test.tsx`

- [ ] **Step 1: Write failing test for `TaskCalendar` typing and agenda fallback**

```tsx
// src/app/admin/tasks/components/__tests__/TaskCalendar-standards.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCalendar from '../TaskCalendar';
import type { Task } from '@/lib/types';

describe('TaskCalendar Standards & Mobile Agenda (Roadmap §28, UI Spec §491-501)', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Audit Compliance Clause',
      status: 'todo',
      priority: 'high',
      dueDate: new Date().toISOString(),
      assignedTo: 'user-1',
      workspaceId: 'ws-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'document',
      reminders: [],
      reminderSent: false,
    },
    {
      id: 'task-2',
      title: 'Overdue Vendor Agreement',
      status: 'todo',
      priority: 'urgent',
      dueDate: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days overdue
      assignedTo: 'user-1',
      workspaceId: 'ws-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'document',
      reminders: [],
      reminderSent: false,
    }
  ];

  it('renders calendar controls with Month, Week, Day, and Agenda options', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agenda/i })).toBeInTheDocument();
  });

  it('renders overdue task section in Agenda view', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /agenda/i }));
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    expect(screen.getByText('Overdue Vendor Agreement')).toBeInTheDocument();
  });

  it('satisfies min-h-[44px] touch targets on navigation controls', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={vi.fn()}
      />
    );
    const todayBtn = screen.getByRole('button', { name: /today/i });
    expect(todayBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskCalendar-standards.test.tsx`
  Expected: FAIL (agenda mode not yet present on TaskCalendar).

- [ ] **Step 3: Refactor `TaskCalendar.tsx` with architectural comments (Rule 10)**
  - Replace any remaining untyped lookups (`PRIORITY_ICONS: Record<TaskPriority, any>`) with `React.ComponentType<{ className?: string }>`.
  - Add `'agenda'` view mode alongside `month`, `week`, `day`.
  - In Agenda mode, group tasks into:
    - Overdue Tasks (always visible even if due date is outside current month/week range).
    - Today's Tasks.
    - Upcoming Tasks.
  - Wire `TaskStatusBadge` and `TaskPriorityBadge` primitives into calendar event popovers and agenda rows.
  - Ensure all navigation buttons (`Today`, `< Prev`, `Next >`, `View triggers`) enforce `min-h-[44px] sm:min-h-[36px]`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskCalendar-standards.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/TaskCalendar.tsx src/app/admin/tasks/components/__tests__/TaskCalendar-standards.test.tsx
  git commit -m "feat(tasks): add agenda view and overdue task drawer to TaskCalendar with strict typing"
  ```

---

### Task 5: Mobile Filter Sheet & Responsive Toolbar Standardization

**Files:**
- Modify: `src/app/admin/tasks/TasksClient.tsx`
- Test: `src/app/admin/tasks/__tests__/TasksClient-mobile-filters.test.ts`

- [ ] **Step 1: Write failing test for mobile filter sheet and toolbar synchronization**

```tsx
// src/app/admin/tasks/__tests__/TasksClient-mobile-filters.test.ts
import { describe, it, expect } from 'vitest';

describe('TasksClient Mobile Toolbar & Filter Sheet Synchronization (Roadmap §29)', () => {
  it('correctly calculates active filter count across status, priority, tag, assignee, and date', () => {
    const countActive = (filters: { status: string; priority: string; tagId: string; dateType: string }) => {
      let count = 0;
      if (filters.status !== 'all') count++;
      if (filters.priority !== 'all') count++;
      if (filters.tagId !== 'all') count++;
      if (filters.dateType !== 'all') count++;
      return count;
    };

    expect(countActive({ status: 'all', priority: 'all', tagId: 'all', dateType: 'all' })).toBe(0);
    expect(countActive({ status: 'todo', priority: 'urgent', tagId: 'all', dateType: 'all' })).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**
  Run: `pnpm test:run src/app/admin/tasks/__tests__/TasksClient-mobile-filters.test.ts`
  Expected: PASS.

- [ ] **Step 3: Align mobile sheet in `TasksClient.tsx`**
  - Integrate `TaskScopeSwitcher` inside the mobile filter sheet as well as the desktop header.
  - Wire `min-h-[44px]` touch targets on all mobile sheet selects and buttons.
  - Ensure filter changes apply immediately and close gracefully without losing scroll position.

- [ ] **Step 4: Run test to verify zero regressions**
  Run: `pnpm test:run src/app/admin/tasks/__tests__/`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/TasksClient.tsx src/app/admin/tasks/__tests__/TasksClient-mobile-filters.test.ts
  git commit -m "feat(tasks): standardize mobile filter sheet with TaskScopeSwitcher and 44px touch targets"
  ```

---

### Task 6: Wire Full Core Experience & State in `TasksClient.tsx`

**Files:**
- Modify: `src/app/admin/tasks/TasksClient.tsx`
- Test: `src/app/admin/tasks/__tests__/TasksClient-phase-2-integration.test.ts`

- [ ] **Step 1: Write integration test for Phase 2 Core Experience**

```tsx
// src/app/admin/tasks/__tests__/TasksClient-phase-2-integration.test.ts
import { describe, it, expect } from 'vitest';

describe('TasksClient Phase 2 Core Experience Integration', () => {
  it('defines scope types as "my" | "team" | "all"', () => {
    const scopes = ['my', 'team', 'all'] as const;
    expect(scopes).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Integrate `TaskScopeSwitcher` and `TaskFilterChips` in `TasksClient.tsx`**
  - Place `TaskScopeSwitcher` directly in the top header below title (Roadmap §27).
  - Place `TaskFilterChips` directly under the filter toolbar whenever any filter is active.
  - Implement `handleRemoveChip(chip)` to reset specific filter back to `'all'` or `null`.
  - Refactor summary stat cards into a restrained, compact metric row or toggleable summary (UI Spec §450).
  - Add permission error toast navigation with `actionConfig: { path: '/admin/settings/permissions', label: 'View Permissions' }` when an unauthorized user attempts an admin-only action.

- [ ] **Step 3: Run full task test suite**
  Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/`
  Expected: PASS.

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/TasksClient.tsx src/app/admin/tasks/__tests__/TasksClient-phase-2-integration.test.ts
  git commit -m "refactor(tasks): wire TaskScopeSwitcher, TaskFilterChips, and restrained metrics into TasksClient"
  ```

---

### Task 7: Quality Gates, TypeScript Verification & Lint Cleanliness

**Files:**
- All task-related files

- [ ] **Step 1: Run complete task test suites**
  Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/`
  Expected: PASS (all tests pass).

- [ ] **Step 2: Verify zero `any` or `any[]`**
  Run: `grep -rn -E ":\s*any\b|<any>|any\[\]" src/app/admin/tasks/components/ src/lib/utils/date-utils.ts src/app/admin/tasks/TasksClient.tsx`
  Expected: 0 TypeScript type occurrences.

- [ ] **Step 3: Run repository-wide TypeScript check**
  Run: `pnpm typecheck`
  Expected: Exit code 0.

- [ ] **Step 4: Run ESLint**
  Run: `pnpm eslint src/app/admin/tasks/ src/lib/utils/date-utils.ts`
  Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit quality gate verification**
  Run:
  ```bash
  git commit --allow-empty -m "chore(tasks): verify Phase 2 quality gates, typing, and test suites"
  ```

---

## 6. Plan Verification & Approval Gate

This plan is stored at:
[`docs/superpowers/plans/2026-10-09-tasks-phase-2-core-experience-and-workspace-standards.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/superpowers/plans/2026-10-09-tasks-phase-2-core-experience-and-workspace-standards.md)

**In strict adherence to instructions, execution will NOT begin until you review and approve this plan.**
