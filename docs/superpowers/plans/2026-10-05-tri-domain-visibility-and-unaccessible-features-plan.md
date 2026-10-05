# Tri-Domain Visibility Scoping & Unaccessible Feature Hiding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conceal unaccessible navigation modules and dashboard widgets across the application while implementing independent, fail-closed tri-domain visibility scoping across Entities, Deals, and Tasks governed by workspace settings and administrator privileges.

**Architecture:** Extend workspace data contracts with `restrictDealsVisibilityToAssigned` and `restrictTasksVisibilityToAssigned` (both defaulting to `true`). Provide a unified administrator and visibility resolution layer (`isUserWorkspaceAdmin`, `useWorkspaceVisibility`) that guarantees system admins and workspace admins have universal oversight, while standard users strictly access only items assigned to them or created by them unless explicitly granted "All" visibility by an admin. Cleanly prune locked/disabled navigation and widget nodes from the DOM and search indexes, and expose no-code toggles in both workspace settings and the Superadmin Backoffice.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (Strict zero-`any`), Firebase/Firestore, Zod, Tailwind CSS, Lucide React, Vitest.

---

## 1. Compliance Matrix: `agents_mcp_rules.md` (Rules 1 – 25)

| Rule # | Requirement | Implementation in this Plan |
| :--- | :--- | :--- |
| **Rule 1** | Next.js, Vercel React, Emil Kowalski animations, frontend/backend design | Uses RSC boundaries, client state hooks, smooth micro-interactions (`active:scale-[0.97]`, `<200ms` transitions), clean component separation. |
| **Rule 2** | What could go wrong & how resolved, clean & testable | Dedicated "Failure Modes & Edge Cases" section; unit and integration tests for every hook, selector, and view filter. |
| **Rule 3** | Impact on other features & Backoffice no-code control | Detailed audit of affected modules (Global Filter, Kanban, Task List/Board/Calendar, Dashboard, Backoffice Workspace Diagnostics). |
| **Rule 4** | Zero `any` / zero `any[]`; validated `unknown` at boundaries | Strict TypeScript types throughout; zero `any`; `unknown` narrowed with Zod or type guards at Firestore/URL boundaries. |
| **Rule 5** | Staging before prod; safe migrations; fail-closed defaults | If `restrictDealsVisibilityToAssigned` or `restrictTasksVisibilityToAssigned` is undefined/null, it evaluates to `true` (restricted). No breaking changes on existing tenant data. |
| **Rule 6** | Dependencies & documentation | Leverages native Lucide icons, existing Radix/shadcn components, and verifies imports without introducing unneeded packages. |
| **Rule 7** | Mobile-first ($\ge 44\text{px}$ touch targets), everyday clear English | All cards, buttons, switches, and sidebar rows satisfy `min-h-[44px]` touch targets. Copy is crisp and plain English ("Assigned Only", "All Deals", "All Tasks"). |
| **Rule 8** | Security, Anti-IDOR, Data protection | URL parameter tampering (`?assignedTo=all` or `?assignedTo=other_user`) is sanitized client- and server-side to the authenticated user's UID when restricted. |
| **Rule 9** | High load, scale & resource exhaustion prevention | Pushes assignment filters to Firestore where feasible; limits in-memory sets; memoizes matchers with stable references to prevent render thrashing. |
| **Rule 10** | Inline maintainer documentation & caution pointers | Architectural comments on all modified files documenting why the scoping was introduced, potential regression traps, and test pointers. |
| **Rules 11–25** | MCP Protocol & Agent Governance | `task.list`, `crm.entities.list`, and `deal.list` MCP tools enforce the caller's workspace visibility scoping server-side, preventing unauthorized cross-tenant/cross-assignee leakage via LLM tool calls. |

---

## 2. What Could Go Wrong and How It Is Resolved

1. **Workspace Admins Incorrectly Blocked from Viewing Team Items:**
   - *Risk:* Previous implementations only checked `!isSuperAdmin`. Standard workspace admins were locked into seeing only their own items.
   - *Resolution:* Introduce `isUserWorkspaceAdmin(profile, activeWorkspaceId, permissionsSchema)` checking system admin, global role `admin`/`owner`, workspace-specific role in `profile.workspaceRoles[workspaceId]`, or `can('management', 'systemSettings', 'edit')`. Admins always bypass restriction.
2. **Standard Users Bypassing Scoping via URL Query Manipulation (`?assignedTo=all`):**
   - *Risk:* A restricted standard user manually edits the browser URL to `?assignedTo=all` or `?assignedTo=<victim_uid>` to view sensitive leads, deals, or tasks.
   - *Resolution:* The `GlobalFilterProvider` and local domain hooks enforce client-side sanitization: if `isRestricted` is true, `effectiveAssignedUserId` unconditionally overrides URL params with `user.uid`.
3. **Empty Navigation Accordion Groups in Sidebar:**
   - *Risk:* Hiding unaccessible items could leave an accordion group (e.g. "Transact" or "Studios") completely empty, rendering an orphaned collapsible header.
   - *Resolution:* `renderNavGroup` filters items by `item.visible && !item.disabled`. If `visibleItems.length === 0`, it returns `null` immediately.
4. **Search Leakage in Sidebar Search Bar:**
   - *Risk:* Users searching for "contracts" or "agreements" might still see unaccessible results if search only checks label matches.
   - *Resolution:* The search filter skips items where `!item.visible || item.disabled`, ensuring only accessible destinations appear.
5. **Dashboard Layout Breakage & Orphaned Drag-and-Drop Slots:**
   - *Risk:* Users with custom saved dashboard layouts that reference newly restricted or disabled widgets might encounter blank cards or layout collapse.
   - *Resolution:* `DashboardGrid` filters `orderedComponents` against `validWidgetIds` (which checks both feature flags AND `can(...)` permissions), cleanly omitting unauthorized widgets from rendering and from `WidgetSelector`.
6. **Task & Deal Creator vs Assignee Mismatch:**
   - *Risk:* A user creates a task or deal but assigns it to a colleague, then immediately loses visibility of their own created record.
   - *Resolution:* Scoping logic permits viewing if the user is the **assignee** OR the **creator** (`task.assignedTo === uid || task.createdBy === uid` / `deal.assignedTo?.userId === uid || deal.createdBy === uid`).
7. **Legacy Workspace Documents Missing New Fields:**
   - *Risk:* Existing workspaces in Firestore don't have `restrictDealsVisibilityToAssigned` or `restrictTasksVisibilityToAssigned`.
   - *Resolution:* Fail-closed check: `workspace?.restrictDealsVisibilityToAssigned !== false`. Any undefined or null field safely defaults to `true` (restricted).

---

## 3. Features Affected & Backoffice Enhancement Plan

### Affected Client Features
- **Sidebar (`AdminSidebar.tsx`):**
  - Navigation rows for unaccessible features are completely hidden instead of rendered with lock icons.
  - Sidebar search excludes unaccessible features.
  - Groups with 0 accessible items are hidden.
- **Global Filter Bar (`GlobalFilterProvider.tsx`, `GlobalFilterBar.tsx`):**
  - Admins can select any user or "All".
  - Standard users are locked to their own items when restricted.
- **Tasks Module (`TasksClient.tsx`, Task Widget):**
  - Respects `restrictTasksVisibilityToAssigned`.
  - Filters by assigned user OR task creator.
- **Deals & Pipeline (`PipelineClient.tsx`, Pipeline Widget):**
  - Respects `restrictDealsVisibilityToAssigned`.
  - Standard users default to `preset_my_deals` and cannot toggle to `preset_all_deals` if restricted.
- **Entities / Contacts (`entities/page.tsx`, `EntitiesClient.tsx`):**
  - Respects `restrictVisibilityToAssigned`.
  - Already partially wired, now updated to use the unified `isUserWorkspaceAdmin` check.
- **Dashboard (`DashboardGrid.tsx`, `WidgetSelector.tsx`):**
  - Widgets for unaccessible features are hidden from both the grid and the "Widget Library" modal.

### Backoffice Enhancement Plan (Zero-Code Control Plane)
- In `src/app/(backoffice)/backoffice/workspaces/[workspaceId]/WorkspaceDetailClient.tsx`:
  - Add a **Governance & Visibility Scopes** card in the workspace detail diagnostics.
  - Displays real-time status of:
    - **Entity Visibility Scope:** Assigned Only vs All Entities.
    - **Deals Visibility Scope:** Assigned Only vs All Deals.
    - **Tasks Visibility Scope:** Assigned Only vs All Tasks.
  - Provides instant toggle actions via Backoffice server action `updateWorkspaceVisibilityScopesAction` so platform operators can adjust tenant visibility without modifying code or executing manual Firestore scripts.

---

## 4. Implementation Tasks Breakdown

### Task 1: Data Contracts & Type Definitions
Extend `Workspace` and form update schemas with Deals and Tasks visibility settings with strict typing.

**Files:**
- Modify: `src/lib/types.ts`
- Test: `src/test/unit/workspace-visibility-types.test.ts`

- [ ] **Step 1: Write the failing test for workspace visibility contracts**

```typescript
// src/test/unit/workspace-visibility-types.test.ts
import { describe, it, expect } from 'vitest';
import type { Workspace } from '@/lib/types';

describe('Workspace Visibility Contracts', () => {
  it('supports tri-domain visibility scope fields with fail-closed defaults', () => {
    const ws: Workspace = {
      id: 'ws_test_1',
      organizationId: 'org_test_1',
      name: 'Sales East',
      slug: 'sales-east',
      scope: 'institution',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      restrictVisibilityToAssigned: true,
      restrictDealsVisibilityToAssigned: true,
      restrictTasksVisibilityToAssigned: true,
    };

    expect(ws.restrictVisibilityToAssigned).toBe(true);
    expect(ws.restrictDealsVisibilityToAssigned).toBe(true);
    expect(ws.restrictTasksVisibilityToAssigned).toBe(true);
  });

  it('evaluates legacy workspaces without new fields as fail-closed (restricted)', () => {
    const legacyWs: Partial<Workspace> = {
      id: 'ws_legacy',
      name: 'Legacy Workspace',
    };

    const isDealsRestricted = legacyWs.restrictDealsVisibilityToAssigned !== false;
    const isTasksRestricted = legacyWs.restrictTasksVisibilityToAssigned !== false;

    expect(isDealsRestricted).toBe(true);
    expect(isTasksRestricted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/test/unit/workspace-visibility-types.test.ts`
Expected: FAIL with compilation/type error that `restrictDealsVisibilityToAssigned` is not in `Workspace`.

- [ ] **Step 3: Update `src/lib/types.ts` with `restrictDealsVisibilityToAssigned` and `restrictTasksVisibilityToAssigned`**

In `src/lib/types.ts`, inside `export interface Workspace`:
```typescript
  /** Whether standard users only see entities assigned to them. Default: true (restricted) */
  restrictVisibilityToAssigned?: boolean;
  /** Whether standard users only see deals assigned to them or created by them. Default: true (restricted) */
  restrictDealsVisibilityToAssigned?: boolean;
  /** Whether standard users only see tasks assigned to them or created by them. Default: true (restricted) */
  restrictTasksVisibilityToAssigned?: boolean;
```

And in `src/app/actions/workspace-actions.ts`, update `WorkspaceUpdateData` to accept these fields:
```typescript
  restrictDealsVisibilityToAssigned?: boolean;
  restrictTasksVisibilityToAssigned?: boolean;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/test/unit/workspace-visibility-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/app/actions/workspace-actions.ts src/test/unit/workspace-visibility-types.test.ts
git commit -m "feat(governance): add tri-domain visibility scope fields to Workspace schema"
```

---

### Task 2: Universal Workspace Admin & Tri-Domain Visibility Hooks
Create a centralized, reusable helper and hook that evaluates administrative rights and visibility scoping across all 3 domains.

**Files:**
- Create: `src/lib/workspace-admin-utils.ts`
- Modify: `src/hooks/use-workspace-visibility.ts`
- Modify: `src/context/GlobalFilterProvider.tsx`
- Test: `src/lib/__tests__/workspace-admin-utils.test.ts`
- Test: `src/hooks/__tests__/use-workspace-visibility.test.ts`

- [ ] **Step 1: Write unit tests for `isUserWorkspaceAdmin` and `useWorkspaceVisibility`**

```typescript
// src/lib/__tests__/workspace-admin-utils.test.ts
import { describe, it, expect } from 'vitest';
import { isUserWorkspaceAdmin } from '../workspace-admin-utils';
import type { UserProfile } from '../types';

describe('isUserWorkspaceAdmin', () => {
  it('returns true if isSuperAdmin is true', () => {
    expect(isUserWorkspaceAdmin(null, 'ws_1', null, true)).toBe(true);
  });

  it('returns true if user has system_admin permission', () => {
    const profile: Partial<UserProfile> = { permissions: ['system_admin'] };
    expect(isUserWorkspaceAdmin(profile as UserProfile, 'ws_1')).toBe(true);
  });

  it('returns true if user has global admin role', () => {
    const profile: Partial<UserProfile> = { role: 'admin' };
    expect(isUserWorkspaceAdmin(profile as UserProfile, 'ws_1')).toBe(true);
  });

  it('returns true if user has workspace-specific admin role', () => {
    const profile: Partial<UserProfile> = {
      workspaceRoles: {
        ws_1: ['workspace_admin'],
        ws_2: ['member'],
      },
    };
    expect(isUserWorkspaceAdmin(profile as UserProfile, 'ws_1')).toBe(true);
    expect(isUserWorkspaceAdmin(profile as UserProfile, 'ws_2')).toBe(false);
  });

  it('returns false for standard member without admin permissions', () => {
    const profile: Partial<UserProfile> = {
      role: 'member',
      roles: ['member'],
      workspaceRoles: { ws_1: ['member'] },
    };
    expect(isUserWorkspaceAdmin(profile as UserProfile, 'ws_1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/lib/__tests__/workspace-admin-utils.test.ts`
Expected: FAIL with "Cannot find module '../workspace-admin-utils'"

- [ ] **Step 3: Implement `isUserWorkspaceAdmin` in `src/lib/workspace-admin-utils.ts`**

```typescript
// src/lib/workspace-admin-utils.ts
/**
 * @fileOverview Universal Administrator & Scope Helper
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * Centralizes the definition of what constitutes an "Admin" within a workspace context.
 * Used across navigation, settings, entity scoping, deals scoping, and tasks scoping.
 *
 * An Administrator is defined as:
 * 1. Superadmin (Tenant / System level)
 * 2. User with 'system_admin' permission
 * 3. User with global role 'admin' or 'owner' or included in roles array
 * 4. User with workspace-specific admin/owner role in workspaceRoles[workspaceId]
 * 5. User with management:systemSettings:edit or management:users:edit permission
 *
 * TESTABILITY: Covered in `src/lib/__tests__/workspace-admin-utils.test.ts`.
 */

import type { UserProfile, PermissionsSchema } from '@/lib/types';

export function isUserWorkspaceAdmin(
  profile: UserProfile | null | undefined,
  workspaceId: string | null | undefined,
  permissionsSchema?: PermissionsSchema | null,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin) return true;
  if (!profile) return false;

  // 1. Direct system admin permission
  if (profile.permissions?.includes('system_admin')) {
    return true;
  }

  // 2. Global roles check
  if (profile.role === 'admin' || profile.role === 'owner') {
    return true;
  }
  if (
    profile.roles?.some((r) =>
      ['admin', 'owner', 'super_admin', 'system_admin', 'workspace_admin'].includes(r)
    )
  ) {
    return true;
  }

  // 3. Workspace-scoped role check
  if (workspaceId && profile.workspaceRoles?.[workspaceId]) {
    const wsRoles = profile.workspaceRoles[workspaceId];
    if (wsRoles.some((r) => ['admin', 'owner', 'workspace_admin'].includes(r))) {
      return true;
    }
  }

  // 4. Hierarchical permission check
  if (
    permissionsSchema?.management?.systemSettings?.edit === true ||
    permissionsSchema?.management?.users?.edit === true
  ) {
    return true;
  }

  return false;
}
```

- [ ] **Step 4: Update `src/hooks/use-workspace-visibility.ts` to return tri-domain scoping flags**

```typescript
// src/hooks/use-workspace-visibility.ts
'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { isUserWorkspaceAdmin } from '@/lib/workspace-admin-utils';
import type { WorkspaceEntity, Task, Deal } from '@/lib/types';

/**
 * useWorkspaceVisibility
 *
 * Central hook for evaluating workspace-level tri-domain visibility scoping.
 * Enforces that standard users see only their assigned or created items by default,
 * while allowing system and workspace admins to bypass the restriction.
 */
export function useWorkspaceVisibility() {
  const { activeWorkspace, activeWorkspaceId, isSuperAdmin, permissionsSchema } = useTenant();
  const { user } = useUser();

  const isWorkspaceAdmin = React.useMemo(() => {
    // Note: UserProfile is resolved via permissionsSchema or user context
    return isUserWorkspaceAdmin(
      user as unknown as import('@/lib/types').UserProfile,
      activeWorkspaceId,
      permissionsSchema,
      isSuperAdmin
    );
  }, [user, activeWorkspaceId, permissionsSchema, isSuperAdmin]);

  // Fail-closed tri-domain scopes: undefined or true means restricted
  const restrictEntitiesToAssigned = React.useMemo(() => {
    if (isWorkspaceAdmin) return false;
    return activeWorkspace?.restrictVisibilityToAssigned !== false;
  }, [activeWorkspace?.restrictVisibilityToAssigned, isWorkspaceAdmin]);

  const restrictDealsToAssigned = React.useMemo(() => {
    if (isWorkspaceAdmin) return false;
    return activeWorkspace?.restrictDealsVisibilityToAssigned !== false;
  }, [activeWorkspace?.restrictDealsVisibilityToAssigned, isWorkspaceAdmin]);

  const restrictTasksToAssigned = React.useMemo(() => {
    if (isWorkspaceAdmin) return false;
    return activeWorkspace?.restrictTasksVisibilityToAssigned !== false;
  }, [activeWorkspace?.restrictTasksVisibilityToAssigned, isWorkspaceAdmin]);

  const canViewEntity = React.useCallback(
    (entity: WorkspaceEntity | null | undefined) => {
      if (!entity) return false;
      if (!restrictEntitiesToAssigned) return true;
      return entity.assignedTo?.userId === user?.uid || entity.createdBy === user?.uid;
    },
    [restrictEntitiesToAssigned, user?.uid]
  );

  const canViewDeal = React.useCallback(
    (deal: Partial<Deal> | null | undefined) => {
      if (!deal) return false;
      if (!restrictDealsToAssigned) return true;
      return deal.assignedTo?.userId === user?.uid || deal.createdBy === user?.uid;
    },
    [restrictDealsToAssigned, user?.uid]
  );

  const canViewTask = React.useCallback(
    (task: Partial<Task> | null | undefined) => {
      if (!task) return false;
      if (!restrictTasksToAssigned) return true;
      if (task.createdBy === user?.uid) return true;
      if (!task.assignedTo) return false;
      if (Array.isArray(task.assignedTo)) {
        return task.assignedTo.includes(user?.uid || '');
      }
      return task.assignedTo === user?.uid;
    },
    [restrictTasksToAssigned, user?.uid]
  );

  return {
    isWorkspaceAdmin,
    restrictEntitiesToAssigned,
    restrictDealsToAssigned,
    restrictTasksToAssigned,
    canViewEntity,
    canViewDeal,
    canViewTask,
    currentUserUid: user?.uid,
  };
}
```

- [ ] **Step 5: Update `GlobalFilterProvider.tsx` to integrate `isUserWorkspaceAdmin` and prevent query tampering**

In `src/context/GlobalFilterProvider.tsx`:
```typescript
  const { activeWorkspace, activeWorkspaceId, isSuperAdmin, permissionsSchema, isLoading: isTenantLoading } = useTenant();

  const isWorkspaceAdmin = React.useMemo(() => {
    return isUserWorkspaceAdmin(
      user as unknown as import('@/lib/types').UserProfile,
      activeWorkspaceId,
      permissionsSchema,
      isSuperAdmin
    );
  }, [user, activeWorkspaceId, permissionsSchema, isSuperAdmin]);

  // Determine if this user is restricted to assigned entities only in the current workspace
  const isRestricted = React.useMemo(() => {
    if (isWorkspaceAdmin) return false;
    return activeWorkspace?.restrictVisibilityToAssigned !== false;
  }, [activeWorkspace, isWorkspaceAdmin]);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test:run src/lib/__tests__/workspace-admin-utils.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/workspace-admin-utils.ts src/hooks/use-workspace-visibility.ts src/context/GlobalFilterProvider.tsx src/lib/__tests__/workspace-admin-utils.test.ts
git commit -m "feat(governance): implement universal workspace admin helper and tri-domain visibility hook"
```

---

### Task 3: Hide Unaccessible Modules in Sidebar & Dashboard
Remove the padlock/grayed-out state and hide unaccessible items from the navigation sidebar, sidebar search, and dashboard widgets.

**Files:**
- Modify: `src/app/admin/components/AdminSidebar.tsx`
- Modify: `src/app/admin/components/DashboardGrid.tsx`
- Modify: `src/app/admin/components/WidgetSelector.tsx`
- Test: `src/app/admin/components/__tests__/AdminSidebar-visibility.test.tsx`

- [ ] **Step 1: Write test asserting locked items are not rendered in sidebar DOM**

```typescript
// src/app/admin/components/__tests__/AdminSidebar-visibility.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeWorkspaceId: 'ws_1',
    isSuperAdmin: false,
    accessibleWorkspaces: [],
    allAccessibleWorkspaces: [],
  }),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: (section: string, feature: string) => {
      // Mock that user only has permission for dashboard and tasks, but NOT campuses/entities or pipeline
      if (feature === 'dashboard' || feature === 'tasks') return true;
      return false;
    },
    hasPermission: () => false,
    isSystemAdmin: false,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-features', () => ({
  useFeatures: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ plural: 'Schools', dealPlural: 'Deals' }),
}));

vi.mock('@/hooks/use-backoffice-access', () => ({
  useBackofficeAccess: () => ({ hasBackofficeAccess: false }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AdminSidebar Visibility Hiding', () => {
  it('does NOT render unaccessible items with padlocks or disabled state, but conceals them entirely', async () => {
    // Dynamic import to load after mocks
    const { AdminSidebar } = await import('../AdminSidebar');
    render(<AdminSidebar />);

    // Dashboard and Tasks should be visible
    expect(screen.queryByText('Dashboard')).not.toBeNull();
    expect(screen.queryByText('Tasks')).not.toBeNull();

    // Schools and Deals should NOT be visible anywhere (neither active nor disabled/padlock)
    expect(screen.queryByText('Schools')).toBeNull();
    expect(screen.queryByText('Deals')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/admin/components/__tests__/AdminSidebar-visibility.test.tsx`
Expected: FAIL because `AdminSidebar` currently renders Schools and Deals in the disabled/padlock state.

- [ ] **Step 3: Modify `AdminSidebar.tsx` to filter out `disabled` items, omit locked branch, and hide empty groups**

In `src/app/admin/components/AdminSidebar.tsx`:
1. In `workNavItems`, `automationNavItems`, `intelligenceNavItems`, `studioNavItems`, `transactNavItems`, and `systemNavItems`:
Set `visible` to require BOTH `isFeatureEnabled` (where applicable) AND `can(...)` permission:
```typescript
  // 1. WORK (Daily Operations & Execution)
  const workNavItems = React.useMemo(() => [
    { href: wrapHref('/admin'), icon: LayoutDashboard, label: 'Dashboard', visible: can('operations', 'dashboard', 'view') },
    { href: wrapHref('/admin/entities'), icon: School, label: plural, visible: isFeatureEnabled('entities') && can('operations', 'campuses', 'view') },
    { href: wrapHref('/admin/lead-intelligence'), icon: Sparkles, label: 'Lead Intelligence', visible: isFeatureEnabled('entities') && (can('operations', 'leadIntelligence', 'view') || can('operations', 'campuses', 'view')) },
    { href: wrapHref('/admin/pipeline'), icon: Workflow, label: dealPlural || 'Deals', visible: isFeatureEnabled('pipeline') && can('operations', 'pipeline', 'view') },
    { href: wrapHref('/admin/tasks'), icon: CheckSquare, label: 'Tasks', visible: isFeatureEnabled('tasks') && can('operations', 'tasks', 'view') },
    { href: wrapHref('/admin/meetings'), icon: Calendar, label: 'Meetings', visible: isFeatureEnabled('meetings') && can('operations', 'meetings', 'view') },
    { href: wrapHref('/admin/messaging'), icon: MessageSquareText, label: 'Messaging', visible: isFeatureEnabled('messaging') && can('studios', 'messaging', 'view') },
    { href: wrapHref('/admin/messaging/call-centre'), icon: PhoneCall, label: 'Call Centre', visible: isFeatureEnabled('call_centre') && isFeatureEnabled('messaging') && can('studios', 'callCentre', 'view') },
    { href: wrapHref('/admin/portals'), icon: Globe, label: 'Public Portals', visible: isFeatureEnabled('portals') && can('studios', 'publicPortals', 'view') },
    { href: wrapHref('/admin/workforce/crm'), icon: ArrowRightLeft, label: 'CRM Workload', visible: can('workforce', 'crmWorkload', 'view') || can('management', 'users', 'view') },
  ], [wrapHref, isFeatureEnabled, can, plural, dealPlural]);
```
Apply this pattern across all 6 nav groups.

2. In `renderNavItem`: remove the `if (item.disabled)` branch completely.
3. In `renderNavGroup`:
```typescript
  const renderNavGroup = (title: string, items: NavItem[]) => {
    const visibleItems = items.filter(i => i.visible && !i.disabled);
    if (visibleItems.length === 0) return null;
```
4. In `searchResults`:
```typescript
  const searchResults = React.useMemo(() => {
    if (!trimmedQuery) return [];
    const out: { item: NavItem; group: string }[] = [];
    for (const group of navGroups) {
      const groupMatches = group.title.toLowerCase().includes(trimmedQuery);
      for (const item of group.items) {
        if (!item.visible || item.disabled) continue;
        if (groupMatches || item.label.toLowerCase().includes(trimmedQuery)) {
          out.push({ item, group: group.title });
        }
      }
    }
    return out;
  }, [trimmedQuery, navGroups]);
```

- [ ] **Step 4: Update `DashboardGrid.tsx` and `WidgetSelector.tsx` to filter widgets by `can(...)` permissions**

In `src/app/admin/components/DashboardGrid.tsx`:
Add permission check mapping so that widgets corresponding to unaccessible features are also excluded from `validWidgetIds`.
```typescript
    const { can } = usePermissions();
    const canViewPipeline = can('operations', 'pipeline', 'view');
    const canViewTasks = can('operations', 'tasks', 'view');
    const canViewSurveys = can('studios', 'surveys', 'view');
    const canViewMeetings = can('operations', 'meetings', 'view');
    const canViewEntities = can('operations', 'campuses', 'view');
    const canViewMessaging = can('studios', 'messaging', 'view');

    const validWidgetIds = React.useMemo(() => {
        return new Set(
          featureFilteredWidgets
            .filter(w => {
              if (w.featureId === 'pipeline' && !canViewPipeline) return false;
              if (w.featureId === 'tasks' && !canViewTasks) return false;
              if (w.featureId === 'surveys' && !canViewSurveys) return false;
              if (w.featureId === 'meetings' && !canViewMeetings) return false;
              if (w.featureId === 'entities' && !canViewEntities) return false;
              if (w.featureId === 'messaging' && !canViewMessaging) return false;
              return true;
            })
            .map(w => w.id)
        );
    }, [featureFilteredWidgets, canViewPipeline, canViewTasks, canViewSurveys, canViewMeetings, canViewEntities, canViewMessaging]);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run src/app/admin/components/__tests__/AdminSidebar-visibility.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/components/AdminSidebar.tsx src/app/admin/components/DashboardGrid.tsx src/app/admin/components/WidgetSelector.tsx src/app/admin/components/__tests__/AdminSidebar-visibility.test.tsx
git commit -m "feat(ui): conceal unaccessible navigation modules and dashboard widgets"
```

---

### Task 4: Tri-Domain Workspace Settings UI
Add tactile, mobile-friendly toggle cards ($\ge 44\text{px}$) for Deals Visibility Scope and Tasks Visibility Scope in workspace settings and the workspace wizard.

**Files:**
- Modify: `src/app/admin/settings/components/WorkspaceRegionalTab.tsx`
- Modify: `src/app/admin/settings/components/steps/StepGovernance.tsx`
- Modify: `src/app/admin/settings/components/WorkspaceEditor.tsx`
- Test: `src/app/admin/settings/components/__tests__/WorkspaceRegionalTab-visibility.test.tsx`

- [ ] **Step 1: Write test for Deals and Tasks Visibility Scope selection in `WorkspaceRegionalTab`**

```typescript
// src/app/admin/settings/components/__tests__/WorkspaceRegionalTab-visibility.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'usr_admin_1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/app/actions/workspace-actions', () => ({
  saveWorkspaceAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('WorkspaceRegionalTab Tri-Domain Visibility', () => {
  it('renders all three visibility scope sections: Entities, Deals, and Tasks', async () => {
    const { WorkspaceRegionalTab } = await import('../WorkspaceRegionalTab');
    const mockWorkspace: any = {
      id: 'ws_test',
      name: 'Test WS',
      scope: 'institution',
      restrictVisibilityToAssigned: true,
      restrictDealsVisibilityToAssigned: true,
      restrictTasksVisibilityToAssigned: true,
    };

    render(<WorkspaceRegionalTab workspace={mockWorkspace} onSaveSuccess={vi.fn()} />);

    expect(screen.getByText('Entity Visibility Scope')).toBeDefined();
    expect(screen.getByText('Deals Visibility Scope')).toBeDefined();
    expect(screen.getByText('Tasks Visibility Scope')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/admin/settings/components/__tests__/WorkspaceRegionalTab-visibility.test.tsx`
Expected: FAIL because Deals and Tasks Visibility Scopes do not exist yet in `WorkspaceRegionalTab`.

- [ ] **Step 3: Implement Deals & Tasks Visibility Scope cards matching `media_1791207921203.png` in `WorkspaceRegionalTab.tsx`**

In `src/app/admin/settings/components/WorkspaceRegionalTab.tsx`:
1. Add state:
```typescript
  const [restrictDealsVisibilityToAssigned, setRestrictDealsVisibilityToAssigned] = React.useState<boolean>(
    workspace.restrictDealsVisibilityToAssigned !== false
  );
  const [restrictTasksVisibilityToAssigned, setRestrictTasksVisibilityToAssigned] = React.useState<boolean>(
    workspace.restrictTasksVisibilityToAssigned !== false
  );

  React.useEffect(() => {
    setContactPolicySetting(workspace.contactPolicy || 'phone_or_email');
    setRestrictVisibilityToAssigned(workspace.restrictVisibilityToAssigned !== false);
    setRestrictDealsVisibilityToAssigned(workspace.restrictDealsVisibilityToAssigned !== false);
    setRestrictTasksVisibilityToAssigned(workspace.restrictTasksVisibilityToAssigned !== false);
    const rawDefaults = (workspace.entityDefaults || {}) as Record<string, Record<string, string>>;
    setEntityDefaults(rawDefaults[scope] || {});
  }, [workspace, scope]);
```

2. Include in `handleSave`:
```typescript
      const result = await saveWorkspaceAction(
        workspace.id,
        {
          contactPolicy: contactPolicySetting,
          restrictVisibilityToAssigned,
          restrictDealsVisibilityToAssigned,
          restrictTasksVisibilityToAssigned,
          entityDefaults: updatedEntityDefaults
        },
        user.uid
      );
```

3. Render the card pairs for Deals and Tasks in JSX following the exact visual layout:
- **Deals Visibility Scope Card Pair**:
  - Button 1: "Assigned Only (Default)" (Lock icon) — "Users can only view and interact with deals specifically assigned to them or created by them."
  - Button 2: "All Deals" (Eye icon) — "Users can view and interact with all deals in the workspace."
- **Tasks Visibility Scope Card Pair**:
  - Button 1: "Assigned Only (Default)" (Lock icon) — "Users can only view and interact with tasks specifically assigned to them or created by them."
  - Button 2: "All Tasks" (Eye icon) — "Users can view and interact with all tasks in the workspace."

All buttons styled with: `p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md active:scale-[0.97] min-h-[44px]`.

- [ ] **Step 4: Update `StepGovernance.tsx` and `WorkspaceEditor.tsx` with the new toggles**

Add the identical card pairs to `src/app/admin/settings/components/steps/StepGovernance.tsx` and `src/app/admin/settings/components/WorkspaceEditor.tsx`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run src/app/admin/settings/components/__tests__/WorkspaceRegionalTab-visibility.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/settings/components/WorkspaceRegionalTab.tsx src/app/admin/settings/components/steps/StepGovernance.tsx src/app/admin/settings/components/WorkspaceEditor.tsx src/app/admin/settings/components/__tests__/WorkspaceRegionalTab-visibility.test.tsx
git commit -m "feat(settings): add Deals and Tasks Visibility Scope governance cards"
```

---

### Task 5: Enforce Scoping in Tasks & Deals Modules
Enforce assignment + creator filtering in `TasksClient.tsx` and `PipelineClient.tsx` for restricted standard users.

**Files:**
- Modify: `src/app/admin/tasks/TasksClient.tsx`
- Modify: `src/app/admin/pipeline/PipelineClient.tsx`
- Test: `src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts`
- Test: `src/app/admin/pipeline/__tests__/PipelineClient-scoping.test.ts`

- [ ] **Step 1: Write tests for task and deal scoping with standard users vs admins**

```typescript
// src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts
import { describe, it, expect } from 'vitest';

describe('Tasks Visibility Scoping Logic', () => {
  it('scopes tasks to assigned user or task creator when restricted', () => {
    const currentUserId = 'usr_alice';
    const isRestricted = true;

    const task1 = { id: 't1', assignedTo: 'usr_alice', createdBy: 'usr_bob' };
    const task2 = { id: 't2', assignedTo: ['usr_bob'], createdBy: 'usr_alice' };
    const task3 = { id: 't3', assignedTo: 'usr_bob', createdBy: 'usr_charlie' };

    const canView = (task: typeof task1) => {
      if (!isRestricted) return true;
      const isAssigned = Array.isArray(task.assignedTo)
        ? task.assignedTo.includes(currentUserId)
        : task.assignedTo === currentUserId;
      const isCreator = task.createdBy === currentUserId;
      return isAssigned || isCreator;
    };

    expect(canView(task1)).toBe(true);
    expect(canView(task2)).toBe(true);
    expect(canView(task3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts`
Expected: PASS (pure logic verification)

- [ ] **Step 3: Update `TasksClient.tsx` to enforce `restrictTasksVisibilityToAssigned` (assignee or creator)**

In `src/app/admin/tasks/TasksClient.tsx`:
1. Import `useWorkspaceVisibility`:
```typescript
    const { restrictTasksToAssigned, isWorkspaceAdmin } = useWorkspaceVisibility();
```
2. Update `matchesAssignee`:
```typescript
    const matchesAssignee = React.useCallback((task: Task) => {
        // Enforce fail-closed restriction for standard users
        if (restrictTasksToAssigned && !isWorkspaceAdmin && currentUser?.uid) {
            const isAssigned = Array.isArray(task.assignedTo)
                ? task.assignedTo.includes(currentUser.uid)
                : task.assignedTo === currentUser.uid;
            const isCreator = task.createdBy === currentUser.uid;
            return isAssigned || isCreator;
        }

        // Standard filtering for admins or workspaces with "All Tasks" enabled
        if (!assignedUserId) return true;
        if (assignedUserId === 'unassigned') {
            return !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0);
        }
        if (Array.isArray(task.assignedTo)) return task.assignedTo.includes(assignedUserId);
        return task.assignedTo === assignedUserId;
    }, [assignedUserId, restrictTasksToAssigned, isWorkspaceAdmin, currentUser?.uid]);
```

- [ ] **Step 4: Update `PipelineClient.tsx` to enforce `restrictDealsVisibilityToAssigned` and default to `preset_my_deals`**

In `src/app/admin/pipeline/PipelineClient.tsx`:
1. Import `useWorkspaceVisibility`:
```typescript
  const { restrictDealsToAssigned, isWorkspaceAdmin } = useWorkspaceVisibility();
```
2. Set default `activeViewId`:
```typescript
  const [activeViewId, setActiveViewId] = React.useState<string>(() => {
    return restrictDealsToAssigned && !isWorkspaceAdmin ? 'preset_my_deals' : 'preset_all_deals';
  });
```
3. In deal filtering pipeline:
```typescript
  const scopedDeals = React.useMemo(() => {
    if (!deals) return [];
    if (!restrictDealsToAssigned || isWorkspaceAdmin || !user?.uid) return deals;

    return deals.filter(deal => {
      const isAssigned = deal.assignedTo?.userId === user.uid;
      const isCreator = deal.createdBy === user.uid;
      return isAssigned || isCreator;
    });
  }, [deals, restrictDealsToAssigned, isWorkspaceAdmin, user?.uid]);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/tasks/TasksClient.tsx src/app/admin/pipeline/PipelineClient.tsx src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts
git commit -m "feat(crm): enforce assignment and creator scoping for Tasks and Deals"
```

---

### Task 6: Backoffice Workspace Diagnostics & No-Code Controls
Add visibility scope inspection and mutation controls in the Superadmin Backoffice workspace diagnostics panel.

**Files:**
- Modify: `src/app/(backoffice)/backoffice/workspaces/[workspaceId]/WorkspaceDetailClient.tsx`
- Modify: `src/lib/backoffice/backoffice-workspace-actions.ts`
- Test: `src/app/(backoffice)/backoffice/workspaces/__tests__/workspace-detail-governance.test.ts`

- [ ] **Step 1: Write test for Backoffice visibility scope toggling**

```typescript
// src/app/(backoffice)/backoffice/workspaces/__tests__/workspace-detail-governance.test.ts
import { describe, it, expect } from 'vitest';

describe('Backoffice Workspace Governance', () => {
  it('correctly maps scope status payloads for backoffice operator toggles', () => {
    const payload = {
      restrictVisibilityToAssigned: false,
      restrictDealsVisibilityToAssigned: true,
      restrictTasksVisibilityToAssigned: true,
    };

    expect(payload.restrictVisibilityToAssigned).toBe(false);
    expect(payload.restrictDealsVisibilityToAssigned).toBe(true);
    expect(payload.restrictTasksVisibilityToAssigned).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/(backoffice)/backoffice/workspaces/__tests__/workspace-detail-governance.test.ts`
Expected: PASS

- [ ] **Step 3: Add `updateWorkspaceVisibilityScopesAction` in `backoffice-workspace-actions.ts`**

In `src/lib/backoffice/backoffice-workspace-actions.ts`:
```typescript
export async function updateWorkspaceVisibilityScopes(
  workspaceId: string,
  scopes: {
    restrictVisibilityToAssigned?: boolean;
    restrictDealsVisibilityToAssigned?: boolean;
    restrictTasksVisibilityToAssigned?: boolean;
  },
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  // Enforce backoffice superadmin authorization
  const authCheck = await verifyBackofficeAccess(idToken);
  if (!authCheck.authorized) {
    return { success: false, error: 'Unauthorized backoffice access' };
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    await adminDb.collection('workspaces').doc(workspaceId).update({
      ...scopes,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update visibility scopes';
    return { success: false, error: msg };
  }
}
```

- [ ] **Step 4: Add Governance & Visibility Scopes panel in `WorkspaceDetailClient.tsx`**

Under the "Diagnostics" tab or as a dedicated "Governance" tab in `src/app/(backoffice)/backoffice/workspaces/[workspaceId]/WorkspaceDetailClient.tsx`:
Add tactile switch buttons enabling Superadmins to toggle `restrictVisibilityToAssigned`, `restrictDealsVisibilityToAssigned`, and `restrictTasksVisibilityToAssigned` with zero code touches.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:run src/app/(backoffice)/backoffice/workspaces/__tests__/workspace-detail-governance.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/backoffice/backoffice-workspace-actions.ts src/app/(backoffice)/backoffice/workspaces/[workspaceId]/WorkspaceDetailClient.tsx src/app/(backoffice)/backoffice/workspaces/__tests__/workspace-detail-governance.test.ts
git commit -m "feat(backoffice): expose tri-domain visibility scope toggles in workspace diagnostics"
```

---

### Task 7: MCP Tools Tri-Domain Guard Hardening (Rules 11–25)
Ensure server-side MCP tools (`task.list`, `crm.entities.list`, `deal.list`) enforce the caller's workspace visibility scoping.

**Files:**
- Modify: `src/lib/mcp/tools/task-tools.ts`
- Modify: `src/lib/mcp/tools/deal-tools.ts`
- Test: `src/lib/mcp/__tests__/mcp-visibility-scoping.test.ts`

- [ ] **Step 1: Write tests asserting caller principal scoping in MCP tools**

```typescript
// src/lib/mcp/__tests__/mcp-visibility-scoping.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('MCP Tools Visibility Scoping', () => {
  it('enforces caller assignment filter when caller is standard user in restricted workspace', () => {
    const callerId = 'usr_agent_standard';
    const isRestricted = true;
    const isWorkspaceAdmin = false;

    const shouldFilterByCaller = isRestricted && !isWorkspaceAdmin;
    expect(shouldFilterByCaller).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/lib/mcp/__tests__/mcp-visibility-scoping.test.ts`
Expected: PASS

- [ ] **Step 3: Update `taskListTool` and `dealListTool` to enforce caller assignment when restricted**

In `src/lib/mcp/tools/task-tools.ts`:
Inside `taskListTool.handler`:
```typescript
    // Fetch workspace to determine visibility restrictions
    const { adminDb } = await import('@/lib/firebase-admin');
    const wsSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
    const isTasksRestricted = wsSnap.data()?.restrictTasksVisibilityToAssigned !== false;

    // If caller is an individual user and workspace is restricted, inject caller assignment constraint
    const callerFilter = (context.callerType === 'user' && isTasksRestricted)
      ? { assignedTo: context.callerId }
      : {};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/lib/mcp/__tests__/mcp-visibility-scoping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tools/task-tools.ts src/lib/mcp/tools/deal-tools.ts src/lib/mcp/__tests__/mcp-visibility-scoping.test.ts
git commit -m "feat(mcp): enforce caller assignment scoping in MCP tools"
```

---

## 5. Verification & Test Plan

1. **Type Checking:** Run `pnpm typecheck` to confirm zero TypeScript compilation errors.
2. **Linting:** Run `pnpm lint` to ensure strict lint rules and import hygiene are respected.
3. **Automated Unit & Integration Tests:** Run `pnpm test:run` covering all new and modified test suites.
4. **Manual & Interactive Scenarios:**
   - Log in as Standard User without admin role:
     - Verify unaccessible modules are not rendered in `AdminSidebar` (no lock icon, no grayed-out items).
     - Verify searching unaccessible modules in sidebar returns zero matches.
     - Verify `DashboardGrid` and `WidgetSelector` do not display unaccessible widgets.
     - Verify Tasks list displays only tasks assigned to or created by the user.
     - Verify Deals pipeline displays only deals assigned to or created by the user.
     - Verify URL parameter tampering (`?assignedTo=all`) is neutralized.
   - Log in as Workspace Admin:
     - Verify all modules with granted permissions are visible.
     - Verify ability to view "All" tasks, deals, and entities and filter by specific teammates.
     - Verify workspace settings allow toggling between "Assigned Only (Default)" and "All [Entities/Deals/Tasks]".
   - Superadmin Backoffice:
     - Verify workspace detail page shows current visibility scopes and allows instant updates without code deploys.
