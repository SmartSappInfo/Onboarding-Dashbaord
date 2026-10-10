# Quick Filters Redesign & Persistent Assigned User Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Entities directory filtering UX with a spacious 2-tier progressive accordion layout and unified location popover, and implement persistent assigned user filtering that defaults to the logged-in user upon load while remembering user preference changes and strictly honoring workspace governance rules.

**Architecture:** 
1. **Global Assigned User Persistence:** Enhance `GlobalFilterProvider.tsx` to scope user preferences per workspace (`crm_assigned_pref_${wsId}_${userId}`) in `localStorage`, defaulting to `currentUser.uid` on initial load while strictly enforcing `currentUser.uid` if the workspace has `restrictVisibilityToAssigned` enabled. Remove conflicting override loops in `EntitiesClient.tsx`.
2. **Unified Location Popover:** Create `src/components/location/LocationFilterPopover.tsx` which houses `<LocationCascade>` inside a clean Popover, reducing 3 crammed horizontal dropdowns down to 1 responsive trigger showing specific selection breadcrumbs (`Greater Accra, Ghana`).
3. **2-Tier Quick Filters Accordion:** Restructure the filter panel in `EntitiesClient.tsx` into Tier 1 (5 spacious columns: Segment, Status, Location, Date Added, More Filters toggle) and Tier 2 (slide-down accordion for Interests, Contact Roles, Contact Health), with zero text truncation and mobile-optimized touch targets.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI Popover / Select / Tabs, Vitest.

---

### Governance & Compliance Review against `agent_mcp_rules.md`

| Rule # | Rule Name | How This Plan Conforms |
| :--- | :--- | :--- |
| **Rule 1** | **Framework & Best Practices** | React 19 hooks, clean component decoupling, zero state drift between URL params and localStorage, standard Radix UI primitives. |
| **Rule 2** | **Edge Cases & Failure Modes** | Handles: (1) First load with no preference &rarr; defaults to current user; (2) User explicitly selects "All Contacts" &rarr; persists `'all'` and does not reset to current user; (3) User changes workspaces &rarr; key is scoped by `workspaceId`, preventing cross-workspace leakage; (4) Restricted workspace (`isRestricted`) &rarr; ignores any `'all'` preference and locks to `currentUser.uid`; (5) Location clears correctly without breaking child cascades. |
| **Rule 3** | **Downstream Impact** | `GlobalFilterProvider` is shared with Deals, Kanban, and Tasks. The changes enhance persistence across these consumers without breaking their contracts. |
| **Rule 4** | **Strict Typing Protocol** | Strict Zero-Any Invariant. All props, states, and event handlers typed explicitly. |
| **Rule 5** | **Deployment Protocol** | Verified via Vitest unit tests, ESLint, and full `pnpm typecheck`. Zero remote push. |
| **Rule 7** | **Mobile & Accessibility First** | Touch targets $\ge 44$px (`min-h-[44px]`), tactile `active:scale-[0.97]` buttons, accessible keyboard focus and Popover dismissal. |
| **Rule 8** | **Security & Multi-Tenancy** | Storage keys are isolated by `${activeWorkspace.id}_${user.uid}`. Workspace governance `isRestricted` takes strict precedence over client localStorage. |
| **Rule 10** | **Inline Architectural Guides** | Code is annotated with comments explaining the persistence lifecycle, governance locks, and accordion layout. |

---

### File Structure Map

```
src/
├── context/
│   └── GlobalFilterProvider.tsx        <-- Persistent localStorage memory, workspace scoping, governance lock
├── components/
│   └── location/
│       ├── LocationFilterPopover.tsx   <-- [NEW] Unified cascading location trigger & popover
│       └── __tests__/
│           └── LocationFilterPopover.test.tsx <-- [NEW] Unit tests for location popover
├── app/
│   └── admin/
│       └── entities/
│           ├── EntitiesClient.tsx      <-- 2-tier accordion filter panel, Quick Filters header, remove hardcoded loop
│           └── __tests__/
│               └── assigned-user-preference.test.ts <-- [NEW] Unit tests for preference persistence
```

---

## Bite-Sized Implementation Tasks

### Task 1: Persistent Assigned User Preference in `GlobalFilterProvider.tsx` & `EntitiesClient.tsx`

**Files:**
- Modify: `src/context/GlobalFilterProvider.tsx`
- Modify: `src/app/admin/entities/EntitiesClient.tsx`
- Test: `src/app/admin/entities/__tests__/assigned-user-preference.test.ts`

- [ ] **Step 1: Write test for assigned user preference resolution**

Create `src/app/admin/entities/__tests__/assigned-user-preference.test.ts` testing:
- Default to `currentUser.uid` on fresh visit when no preference is saved.
- Restore `'all'` when user previously chose "All Contacts".
- Restore specific `userId` when user previously selected a teammate.
- Enforce `currentUser.uid` when `isRestricted === true`, even if localStorage contains `'all'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/admin/entities/__tests__/assigned-user-preference.test.ts`

- [ ] **Step 3: Implement persistence and governance in `GlobalFilterProvider.tsx`**

1. Define scoped key helper:
   ```typescript
   export function getAssignedUserStorageKey(workspaceId?: string, userId?: string): string {
     if (workspaceId && userId) return `crm_assigned_pref_${workspaceId}_${userId}`;
     return 'globalAssignedUserId';
   }
   ```
2. In initialization effect:
   - Check `searchParams.get('assignedTo')`.
   - Check `localStorage.getItem(storageKey)`.
   - If not restricted:
     - If URL param present: use URL param.
     - Else if stored preference found:
       - If `'all'`: set `null`.
       - Else if `'unassigned'`: set `'unassigned'`.
       - Else: set stored user ID.
     - Else (no stored preference): **default to `user.uid`**!
   - If restricted: force `user.uid`.
3. In `setAssignedUserId`:
   - When not restricted, write to `localStorage.setItem(storageKey, userId === null ? 'all' : userId)`.
   - Update URL `assignedTo` query parameter.

- [ ] **Step 4: Clean up conflicting override in `EntitiesClient.tsx`**

Remove lines 349-356 in `src/app/admin/entities/EntitiesClient.tsx` (`hasInitializedUserFilterRef` effect) that was resetting `assignedUserId` on every reload and wiping user selections.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/app/admin/entities/__tests__/assigned-user-preference.test.ts`

---

### Task 2: Create Modular `<LocationFilterPopover>` Component

**Files:**
- Create: `src/components/location/LocationFilterPopover.tsx`
- Test: `src/components/location/__tests__/LocationFilterPopover.test.tsx`

- [ ] **Step 1: Write test for LocationFilterPopover**

Create `src/components/location/__tests__/LocationFilterPopover.test.tsx`:
- Tests label rendering for district: `"Adabraka, GH"`
- Tests label rendering for region: `"Greater Accra, GH"`
- Tests label rendering for country only: `"Ghana"`
- Tests default label: `"All Locations"`
- Tests clear button clears all location fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/location/__tests__/LocationFilterPopover.test.tsx`

- [ ] **Step 3: Implement `<LocationFilterPopover>`**

Features:
- Uses `@/components/ui/popover` (`Popover`, `PopoverTrigger`, `PopoverContent`).
- Trigger button with `MapPin` icon, specific location label, clear button `X` (when active), and `ChevronDown`.
- Popover content rendering `<LocationCascade>` with a demarcated header "Location Filter" and quick "Clear" button.
- Strictly typed (`LocationValue` from `./LocationCascade`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/location/__tests__/LocationFilterPopover.test.tsx`

---

### Task 3: 2-Tier Progressive Accordion Filter Panel in `EntitiesClient.tsx`

**Files:**
- Modify: `src/app/admin/entities/EntitiesClient.tsx`

- [ ] **Step 1: Update Imports & State**

- Import `LocationFilterPopover` from `@/components/location/LocationFilterPopover`.
- Import `SlidersHorizontal`, `ChevronUp` from `lucide-react`.
- Add state: `const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);`
- Auto-open Tier 2 on mount if `filterState.interests?.length > 0 || filterState.contactRoles?.length > 0 || filterState.contactHealths?.length > 0`.
- Calculate `moreFiltersActiveCount`: count of active Tier 2 filters.

- [ ] **Step 2: Restructure Card Header**

- Change text from `"ADVANCED FILTERS"` to `"QUICK FILTERS"`.
- Add active count badge: `activeFiltersCount > 0 ? ( <Badge variant="secondary">{activeFiltersCount} active</Badge> ) : null`.
- "Reset All" button with `clearAllFilters`.

- [ ] **Step 3: Replace Row 2 with Tier 1 (5-Column Spacious Grid)**

Change grid from `xl:grid-cols-9` to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3`:
1. **Segment / Audience:** `<Select>`
2. **Status:** `<Select>`
3. **Location:** `<LocationFilterPopover value={locationFilter} onChange={setLocationFilter} />`
4. **Date Added:** `<Select>`
5. **More Filters Toggle Button:**
   - Shows `SlidersHorizontal` icon
   - Shows label `"More Filters"`
   - Shows badge if `moreFiltersActiveCount > 0`
   - Shows chevron that rotates when `isMoreFiltersOpen` is true
   - Minimum touch target $\ge 36$px with tactile `active:scale-[0.97]`

- [ ] **Step 4: Implement Tier 2 (Extended Filters Accordion)**

Add smooth collapsible section below Tier 1 when `isMoreFiltersOpen` is true:
- Demarcated container: `p-3 rounded-xl bg-muted/15 border border-border/50 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200`
- Contains:
  1. **Interests** (`<InterestFilterSelect />`)
  2. **Contact Roles** (`<MultiSelect />`)
  3. **Contact Health** (`<MultiSelect />`)

- [ ] **Step 5: Polish Active Capsules Strip**

- Update location capsule to show formatted specific selection (`getSpecificLocationLabel(locationFilter)`).
- Ensure 1-click removal cleanly updates `filterState`.

---

### Task 4: Comprehensive Verification & Typecheck

**Files:**
- Run Vitest unit tests:
  `pnpm vitest run src/app/admin/entities/__tests__/assigned-user-preference.test.ts`
  `pnpm vitest run src/components/location/__tests__/LocationFilterPopover.test.tsx`
  `pnpm vitest run src/lib/crm/__tests__/workspace-entity-bulk.test.ts`
- Run ESLint:
  `pnpm eslint src/context/GlobalFilterProvider.tsx src/components/location/LocationFilterPopover.tsx src/app/admin/entities/EntitiesClient.tsx`
- Run TypeScript compilation:
  `pnpm typecheck`
