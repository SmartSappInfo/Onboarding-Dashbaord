# Phase 4 Implementation Plan: Unified Filter & Contextual Bulk Action Bar

> **Milestone:** Agreements Hub UI Enhancement — Phase 4  
> **Target Files:**
> - `src/app/admin/finance/contracts/components/AgreementsFilterBar.tsx` (New Component)
> - `src/app/admin/finance/contracts/components/AgreementsMobileFilterChips.tsx` (New Component)
> - `src/app/admin/finance/contracts/components/AgreementsBulkActionBar.tsx` (New Component)
> - `src/app/admin/finance/contracts/ContractsClient.tsx` (Parent Orchestrator Update)
> **Compliance Standards:** `docs/agents_mcp/agents_mcp_rules.md`, `.agents/AGENTS.md`, `agreements_hub_enhancement.md`  
> **Status:** 🟡 Awaiting User Plan Approval (Implementation code must NOT start until approved)

---

## 1. Executive Summary & Architectural Objectives

Phase 4 of the Agreements Hub modernization streamlines searching, multi-faceted filtering, and bulk operations. It eliminates visual clutter by replacing the legacy inline search card and the disjointed "Select All Unprepared" button with:

1. **Unified Filter Bar (`AgreementsFilterBar.tsx`):**
   - Debounced search input (250ms) matching institution name, city/zone, contract ID, or assigned representative.
   - Status `<Select>` dropdown supporting: `All Institutions`, `No Contract (Unprepared)`, `Draft Contracts`, `Awaiting Signature`, `Active Contracts`, and `Expiring Soon (< 60d)`.
   - Assigned Representative `<Select>` dropdown: `All Representatives`, `Unassigned`, or specific representative.
   - Secondary Filter Popover / Sheet: Filter by Zone/City and Legal Hold status with active filter count badges.
   - Primary Action CTA: `+ New Contract` button with tactile feedback (`active:scale-[0.97]`).
   - "Show All / Reset Filters" trigger when filters are active.

2. **Mobile Horizontal Filter Chips (`AgreementsMobileFilterChips.tsx`):**
   - High-performance, touch-scrollable chip row for mobile screens (`< 640px`).
   - Filter chips with live counts: `All ({N})`, `No Contract ({N})`, `Awaiting Signature ({N})`, `Active ({N})`, `Draft ({N})`, `Expiring Soon ({N})`, and `+ Filters`.
   - Compliant with Rule 7: minimum touch targets $\ge 44\text{px}$, smooth inertia scrolling (`no-scrollbar`).

3. **Contextual Floating Bulk Action Bar (`AgreementsBulkActionBar.tsx`):**
   - Dynamically floats and docks when $\ge 1$ institutions are selected.
   - Positioned safely:
     - Desktop: `fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]`.
     - Mobile: `fixed bottom-20 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40` (safely clearing the `AgreementsMobileBottomNav` which sits at `bottom-0 h-16`).
   - Action capabilities:
     - **Prepare Contracts ({N})**: Triggers batch contract preparation wizard.
     - **Send Batch Reminders**: Opens reminder settings/outreach modal for selected institutions awaiting signature.
     - **Export Selection**: Generates and downloads a sanitized CSV (immune to spreadsheet formula injection per Rule 8).
     - **Clear Selection**: 1-click deselect.
     - Batch size safeguard: capped at 50 entities per run (Rule 23) with user guidance if exceeded.

---

## 2. Compliance Matrix: `agents_mcp_rules.md`

| Rule # | Requirement | Phase 4 Architecture & Implementation Defense |
| :--- | :--- | :--- |
| **Rule 1** | Next.js, React & Animation Best Practices | Utilizes React 19 / Next.js client component patterns, `useMemo` for memoized filtered lists, `useCallback` for event handlers, and Emil Kowalski tactile animations (`active:scale-[0.97]`). |
| **Rule 2** | Failure Mode & Edge Case Analysis | Comprehensive analysis of 8 concrete failure modes (debounce lag, TOCTOU selection staleness, batch overload, CSV formula injection, mobile bottom nav occlusion) with mitigations. |
| **Rule 3** | Impact on Other Features & Backoffice | Seamlessly integrates with existing `ContractWizard`, `ContractLifecycleDetailModal`, `LegalHoldManagerModal`, and `contracts` state. Retains all 12+ existing modals and drawers. |
| **Rule 4** | Zero `any` or `any[]` Typing | Strict TypeScript interfaces for all props, filter states, assignee options, and bulk action handlers. Zero `any` or loose type casting. |
| **Rule 5** | Pre-deployment Verification | Rigorous verification using `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` and `npx eslint` before local commit. No remote pushes. |
| **Rule 6** | Dependencies & Up-to-date APIs | Uses native Lucide icons (`Search`, `X`, `Filter`, `Plus`, `Download`, `Send`, `Zap`, `CheckSquare`, `RotateCcw`), Radix UI popovers/selects, and shadcn tokens. |
| **Rule 7** | Mobile-First & Everyday English | All touch targets $\ge 44\text{px}$. Horizontal scroll chips on mobile. Simple, intuitive English labels: *"Prepare contracts"*, *"Send reminders"*, *"Export CSV"*, *"Clear selection"*. |
| **Rule 8** | Security & CSV Injection Defense | Sanitizes all exported CSV fields against spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r` prepended with `'`). |
| **Rule 9** | Overload & Resource Exhaustion | Caps batch contract generation at 50 entities per run (Rule 23) to prevent browser freezing and Firestore transaction timeouts. |
| **Rule 10** | Maintainer Guidance Comments | Comprehensive architectural comments explaining component lifecycles, caution areas, state bindings, and testability pointers. |
| **Rule 13** | Trust Boundary Matrix | Search inputs and filter strings treated as untrusted text; sanitized against XSS; no `dangerouslySetInnerHTML`. |
| **Rule 16** | Non-Delegable Privileges & RBAC | Bulk actions check `userPermissions.canManageContracts` or `canUser('contracts', 'create')`. Disables bulk prepare if user lacks edit permission. |
| **Rule 17** | Multi-Tenant Workspace Boundary | Filtered entities and selection arrays strictly scoped to `activeWorkspaceId`. Workspace change automatically clears selections and resets filters. |
| **Rule 18** | TOCTOU Concurrency Protection | When triggering bulk prepare or reminders, checks real-time contract status from Firestore snapshot before proceeding with mutations. |
| **Rule 21** | Two-Phase Action Model | Bulk action buttons act as the *Preview Phase* (opening the batch review drawer/wizard with item summaries). Actual generation occurs in the *Execute Phase* after human confirmation. |
| **Rule 22** | Idempotency Tokens | Batch preparation passes deterministic idempotency keys (`bulk_prep_${workspaceId}_${entityId}_${timestamp}`) to prevent duplicate contract records. |
| **Rule 23** | Batching & Chunking Limits | Client-enforced maximum batch size of 50 items. Warning alert displayed if selection exceeds batch capability. |
| **Rule 26** | Graceful Degradation | Empty search/filter states display a helpful illustration, explanatory text, and a prominent *"Show all institutions"* button. |
| **Rule 50** | Cache Isolation & State Hygiene | `selectedEntities` state automatically cleared on workspace switch, sub-tab switch, or filter change if selected items are no longer visible. |
| **Rule 54** | Performance & Re-render Prevention | Debounced search input avoids re-filtering on every keystroke. Components wrapped with `React.memo`. |

---

## 3. Failure Mode & Edge Case Analysis (Rule 2)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 4 FAILURE MODES                           │
├───────────────────────────────────┬────────────────────────────────────┤
│ Failure Mode                      │ Architectural Safeguard            │
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. Debounce lag & UI desync       │ Use local controlled input state   │
│    (User types quickly, laggy)    │ with 250ms debounced propagation to│
│                                   │ the parent filter pipeline.        │
├───────────────────────────────────┼────────────────────────────────────┤
│ 2. TOCTOU selection staleness     │ Re-verify entity contract status   │
│    (Status changes while in batch)│ before passing to ContractWizard.  │
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. Large batch browser freeze     │ Enforce strict 50-item batch cap   │
│    (Selecting 500+ items at once) │ with warning toast (Rule 9 & 23).  │
├───────────────────────────────────┼────────────────────────────────────┤
│ 4. CSV Formula Injection          │ Escape values starting with        │
│    (Malicious entity name in CSV) │ '=', '+', '-', '@' with a quote.   │
├───────────────────────────────────┼────────────────────────────────────┤
│ 5. Mobile floating dock collision │ Set mobile bulk bar to `bottom-20` │
│    (Bulk bar overlaps bottom nav) │ clearing bottom nav (Rule 7).      │
├───────────────────────────────────┼────────────────────────────────────┤
│ 6. Ghost selections across spaces │ Auto-clear `selectedEntities` when │
│    (Switching workspace retains)  │ `activeWorkspaceId` changes.       │
├───────────────────────────────────┼────────────────────────────────────┤
│ 7. Filter combination dead-end    │ Provide "Reset all filters" button │
│    (No items match filter criteria│ and display active filter count.   │
├───────────────────────────────────┼────────────────────────────────────┤
│ 8. Mobile touch target violation  │ Ensure all filter chips & bulk bar │
│    (Buttons too small to tap)     │ buttons are min-h-[44px].          │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 4. Detailed Component Design & Specifications

### 4.1. `AgreementsFilterBar.tsx`
- **Location:** `src/app/admin/finance/contracts/components/AgreementsFilterBar.tsx`
- **Responsibilities:**
  - Search input with clearable `X` button and 250ms debounce.
  - Status filter dropdown (`AgreementsFilterStatus`):
    - `all`: "All Institutions"
    - `no_contract`: "No Contract (Unprepared)"
    - `draft`: "Draft Contracts"
    - `sent`: "Awaiting Signature"
    - `signed`: "Active Contracts"
    - `expiring_soon`: "Expiring Soon (< 60d)"
  - Assignee filter dropdown (`string`):
    - `all`: "All Representatives"
    - `unassigned`: "Unassigned"
    - Dynamically extracted list of assigned representatives from `entities`.
  - Secondary Filter Popover (`AdvancedFiltersPopover`):
    - Zone / Region filter select.
    - Legal Hold filter (`all`, `on_hold`, `not_on_hold`).
  - Active filter badge count (e.g. `Filters (2)`).
  - Clear all filters button with `RotateCcw` icon.
  - Primary CTA button: `+ New Contract` triggering `onNewContract()`.

### 4.2. `AgreementsMobileFilterChips.tsx`
- **Location:** `src/app/admin/finance/contracts/components/AgreementsMobileFilterChips.tsx`
- **Responsibilities:**
  - Rendered exclusively on mobile viewports (`sm:hidden`).
  - Horizontal touch-scrollable chip container with `no-scrollbar`.
  - Chip options with badge counts:
    - `All ({counts.all})`
    - `No Contract ({counts.noContract})`
    - `Awaiting Signature ({counts.awaitingSignature})`
    - `Active ({counts.active})`
    - `Draft ({counts.draft})`
    - `Expiring Soon ({counts.expiringSoon})`
    - `+ More Filters` (opens mobile sheet with assignee and legal hold filters).
  - Tactile styling: active chip highlighted with `bg-primary text-primary-foreground font-bold shadow-sm`, unselected chips styled with `bg-muted/40 text-muted-foreground hover:bg-muted/60`.
  - Minimum touch target: `h-10 px-3.5 rounded-full text-xs font-semibold active:scale-95`.

### 4.3. `AgreementsBulkActionBar.tsx`
- **Location:** `src/app/admin/finance/contracts/components/AgreementsBulkActionBar.tsx`
- **Responsibilities:**
  - Elevated floating card with Framer Motion slide-up animation (`y: 100` to `y: 0`).
  - Positioning:
    - Desktop: `fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]`.
    - Mobile: `fixed bottom-20 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40`.
  - Glassmorphic styling: `border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl text-card-foreground rounded-2xl p-2 sm:px-4 sm:py-2.5`.
  - Action Items:
    1. **Counter Badge:** `ShieldCheck` icon + `Selected {N} of {total}` text.
    2. **"Prepare Contracts ({N})"**: Triggers batch wizard (`onPrepareContracts`). Capped at 50 items (Rule 23).
    3. **"Send Reminders"**: Enabled if any selected item is in `sent` or `draft` status.
    4. **"Export CSV"**: Downloads a formula-sanitized CSV file (`onExportSelection`).
    5. **"Clear"**: 1-click deselect button (`onClearSelection`).

### 4.4. Parent Orchestrator Updates (`ContractsClient.tsx`)
- Integrate `AgreementsFilterBar` replacing the inline `<Card>` search/filter block.
- Integrate `AgreementsMobileFilterChips` above the register.
- Replace the legacy basic bulk bar with `<AgreementsBulkActionBar>`.
- Remove the legacy "Select All Unprepared" button.
- Add `assigneeFilter` state (`'all' | string`) and `legalHoldFilter` state (`'all' | 'on_hold' | 'not_on_hold'`).
- Update `filteredList` memoization to account for:
  - `searchTerm` (case-insensitive across entity name, city/zone, assigned representative, or contract ID).
  - `statusFilter` (including `expiring_soon` check: `status === 'signed'` and contract expires within 60 days).
  - `assigneeFilter` (`all`, `unassigned`, or matching `assignedRepId` / name).
  - `legalHoldFilter` (`all`, `on_hold`, `not_on_hold`).
- Implement `handleExportCsv` with formula injection prevention.

---

## 5. Verification Checklist

1. **Automated Verification:**
   - Run `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` to ensure 0 TypeScript errors.
   - Run `npx eslint src/app/admin/finance/contracts/` to verify zero lint errors and zero unused variables.
2. **Behavioral Verification:**
   - Search input debounce functions smoothly without UI hitching.
   - Status dropdown and mobile chips stay synchronized bidirectionally.
   - Advanced filters popover properly filters by assignee and legal hold status.
   - Selecting checkboxes displays `<AgreementsBulkActionBar>` docked at `bottom-20` on mobile and `bottom-8` on desktop.
   - Batch limit of 50 is strictly enforced with user feedback.
   - CSV export produces sanitized files safe against Excel/Sheets formula execution.
   - Deselecting or clearing filters returns the table to its full state.
   - Switching workspaces resets all filter and selection states.

---

## 6. Execution Protocol

> **CRITICAL RULE:** Do NOT write any Phase 4 implementation code until the user explicitly reviews and approves this plan!
