# Quick Filters Redesign & Persistent Assigned User Memory Design Spec

> **Date:** 2026-10-09  
> **Status:** Proposed  
> **Scope:** Entities / Directory Client (`EntitiesClient.tsx`), Global Filter Provider (`GlobalFilterProvider.tsx`), Unified Location Filter (`LocationFilterPopover.tsx`).

---

## 1. Context & User Problem

1. **Current Filter Panel Crowding:**
   - The current filter panel squeezes 9 distinct dropdowns into a single row (`xl:grid-cols-9`), resulting in extreme truncation (`Select a...`, `Select a countr...`, `All Inte...`).
   - `Country`, `Region`, and `District` consume 3 full columns (33% of horizontal real estate), with Region and District sitting as disabled gray boxes until Country is selected.
   - The title "ADVANCED FILTERS" creates psychological friction for everyday users.

2. **Assigned User Filter Behavior:**
   - Users want the app to default to filtering leads/deals assigned to the current user upon initial load.
   - When a user explicitly changes the filter (e.g. to "All Leads", "Unassigned", or another teammate), the app must remember their choice across loads.
   - This preference must strictly respect workspace governance (`restrictVisibilityToAssigned` / `isRestricted`): non-admin users in restricted workspaces must always remain locked to their assigned records.

---

## 2. Architecture & Design Specification

### A. Assigned User Filter Persistence & Governance Model

```mermaid
flowchart TD
    A["Page Load (EntitiesClient / GlobalFilterProvider)"] --> B{"Is User Restricted?\n(restrictVisibilityToAssigned && !isAdmin)"}
    B -->|Yes| C["Enforce currentUser.uid\n(Lock Filter Dropdown)"]
    B -->|No| D{"URL param ?assignedTo present?"}
    D -->|Yes| E["Use URL param value"]
    D -->|No| F{"Read localStorage:\ncrm_assigned_pref_${wsId}_${userId}"}
    F -->|Found: 'all'| G["Set assignedUserId = null (All Leads)"]
    F -->|Found: 'unassigned'| H["Set assignedUserId = 'unassigned'"]
    F -->|Found: uid| I["Set assignedUserId = uid"]
    F -->|Not Found (Default)| J["Default to currentUser.uid\n(My Leads by default)"]
    
    K["User changes filter in UserFilterSelect"] --> L{"Is User Restricted?"}
    L -->|No| M["Update Global State &\nSave to localStorage(wsId, userId) &\nSync URL ?assignedTo"]
```

#### Storage Invariant:
- **Key Format:** `crm_assigned_pref_${workspaceId}_${userId}`
- **Values:**
  - `'all'`: User explicitly selected "All Contacts / All Leads"
  - `'unassigned'`: User explicitly selected "Unassigned"
  - `${targetUserId}`: User selected themselves or a teammate
  - `undefined`: First load default &rarr; resolves to `currentUser.uid`
- **Governance Override:** If `isRestricted === true`, the preference lookup is bypassed and `currentUser.uid` is strictly enforced.

---

### B. Quick Filters UI (Progressive 2-Tier Panel with Unified Location)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  QUICK FILTERS                                                         (2 active)        [ Reset All ] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  🏷️ TAGS:  [ Filter by Tags ▾ ]  |  POPULAR:  ( 14K LIST )  ( AFA SCHOOL )  ( AGM DATA )  ( ICS DATA ) │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  TIER 1: PRIMARY FILTERS (5-Column Grid: ~220px per item — zero truncation)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ 👥 SEGMENT   │  │ ⚡ STATUS    │  │ 📍 LOCATION      │  │ 📅 DATE ADDED│  │ ⚙️ MORE FILTERS (1)   │ │
│  │ All Contacts▾│  │ Active Only ▾│  │ Greater Accra, GH│  │ Last 30 Days▾│  │ Interests, Roles...  ▾│ │
│  └──────────────┘  └──────────────┘  └──────────────────┘  └──────────────┘  └───────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  TIER 2: EXTENDED FILTERS (Smooth Accordion Slide-Down)                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐                 │
│  │ 🔥 INTERESTS            │  │ 👤 CONTACT ROLES        │  │ 🛡️ CONTACT HEALTH       │                 │
│  │ Select interests...   ▾ │  │ Select roles...       ▾ │  │ Select health status... ▾│                │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Active Filters Strip:
[ 📍 Greater Accra, Ghana ✕ ]  [ ⚡ Active Only ✕ ]  [ 🔥 STEM ✕ ]      [ Clear All ]  [ Save as Audience ]
```

#### Detailed Component Breakdown:

1. **Header:**
   - Title: **"Quick Filters"**
   - Active filters count badge: e.g. `(2 active)`
   - Subtle "Reset All" button

2. **Row 1 (Tags):**
   - Full-width tag search button (`<TagFilter />`)
   - Divider
   - Popular tag pills with smooth active states

3. **Row 2 (Tier 1 Primary Grid — `xl:grid-cols-5`):**
   - **Segment / Audience:** Dropdown with full width, no truncation.
   - **Status:** All Statuses, Active Only, Archived.
   - **Unified Location Selector (`<LocationFilterPopover>`):**
     - Button label displays the **specific selection**:
       - If district: `"${district.name}, ${country.code || country.name}"`
       - Else if region: `"${region.name}, ${country.code || country.name}"`
       - Else if country: `"${country.name}"`
       - Default: `"All Locations"`
     - Clicking opens a popover containing the cascading selector (`Country` &rarr; `Region` &rarr; `District`).
     - Includes a clear `✕` button when active.
   - **Date Added:** All Time, Today, Last 7 Days, Last 30 Days, Last 90 Days.
   - **More Filters Button:**
     - Toggles Tier 2 accordion.
     - Displays badge with count of active extended filters (e.g. `(2)`).
     - Chevron icon that rotates smoothly on open/close.

4. **Row 3 (Tier 2 Extended Filters Accordion):**
   - Smooth animated expansion (`animate-in fade-in slide-in-from-top-2`).
   - Contains:
     - **Interests** (`<InterestFilterSelect />`)
     - **Contact Roles** (`<MultiSelect />`)
     - **Contact Health** (`<MultiSelect />`)
   - Auto-expands on mount if any of these 3 filters are active.

5. **Active Capsules Strip:**
   - Renders below the card with 1-click `✕` dismissal per filter, `Clear All`, and `Save as Audience`.

---

## 3. Strict Compliance & Quality Standards

- **Strict Zero-Any Typing (Rule 4):** All props, handlers, and states strictly typed. Zero `any` or `any[]`.
- **Accessibility & Touch Targets (Rule 7):** Controls satisfy `min-h-[44px]` (or `min-h-[36px]` inside compact grids with full tap manipulation) and `active:scale-[0.97]` tactile feedback.
- **Single Source of Truth:** Routes tag filtering through `<TagFilter>` and contact variables through `FieldsVariablesService`.
- **No Remote Git Push:** Code changes verified locally via `pnpm vitest run` and `pnpm typecheck`.
