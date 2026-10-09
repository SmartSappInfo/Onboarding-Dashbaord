# Phase 5 Implementation Plan: Institution Register Visual Noise Reduction & Responsive Dual-Mode

> **Milestone:** Agreements Hub UI Enhancement — Phase 5  
> **Target Files:**
> - `src/app/admin/finance/contracts/components/AgreementsStatusBadge.tsx` (New Shared Component)
> - `src/app/admin/finance/contracts/components/AgreementsDesktopTable.tsx` (New Component)
> - `src/app/admin/finance/contracts/components/AgreementsMobileCardList.tsx` (New Component)
> - `src/app/admin/finance/contracts/ContractsClient.tsx` (Parent Orchestrator Update)
> **Compliance Standards:** `docs/agents_mcp/agents_mcp_rules.md`, `.agents/AGENTS.md`, `agreements_hub_enhancement.md`  
> **Status:** 🟡 Awaiting User Plan Approval (Implementation code must NOT start until approved)

---

## 1. Executive Summary & Architectural Objectives

Phase 5 of the Agreements Hub modernization transforms the core institutional register from a crowded, monolithic desktop table into a refined, high-performance **Responsive Dual-Mode Experience**:

1. **Standardized Status Pill Badge (`AgreementsStatusBadge.tsx`):**
   - Single source of truth for contract lifecycle status rendering across desktop and mobile.
   - Replaces hardcoded, inconsistent badge variants with tokenized pill badges:
     - `Active` (`signed`): Emerald background, `ShieldCheck` icon, emerald text (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`).
     - `Awaiting Signature` (`sent`): Blue background, `Clock` icon, blue text (`bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20`).
     - `Draft` (`draft`): Purple background, `FileEdit` icon, purple text (`bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20`).
     - `No Contract` (`no_contract`): Amber background, `AlertCircle` icon, amber text (`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`).
     - `Expiring Soon` (`expiring`): Orange background, `AlertTriangle` icon, orange text (`bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20`).
     - `Expired` (`expired`): Rose background, `XCircle` icon, rose text (`bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`).
   - Supports `default` (desktop table) and `compact` (mobile cards) size variants.

2. **Noise-Reduced Desktop Table (`AgreementsDesktopTable.tsx` — `hidden sm:block`):**
   - **Institution Column:** Initials avatar badge with brand accent (`bg-primary/10 text-primary border-primary/20`) + Institution Display Name (bold) + Legal Hold preservation indicator + clean Zone/Region subtitle (eliminates repeated italic labels).
   - **Contract Status Column:** Standardized `<AgreementsStatusBadge>`.
   - **Last Update Column:** Formatted date (`formatSafeDate(date, 'MMM d, yyyy')`) + relative time (`formatSafeRelativeTime(date)` -> `"2 days ago"`), guarded against `RangeError`.
   - **Assigned Representative Column:**
     - If assigned: Initials avatar badge + Representative Full Name (bold) + Role/Email in subtle text.
     - If unassigned: Clean, compact `— Not assigned` in muted text.
   - **Management Column:** Quick action buttons (`Copy Signing Link`, `View Signing Page`) + Three-dot `...` dropdown menu retaining all 10+ agreement protocols.
   - **Interactive Row Click:** Clicking anywhere on the row opens `ContractLifecycleDetailModal` (or `ContractWizard` if uncontracted). All inner controls (checkbox, buttons, dropdown) call `e.stopPropagation()` to prevent unwanted row activation.
   - **Table States:** 5-row skeleton shimmer loader (CLS = 0), clean empty state with *"Clear filters"* button, and load-more pagination bar.

3. **Touch-First Mobile Card List (`AgreementsMobileCardList.tsx` — `sm:hidden`):**
   - Standalone tactile cards with Emil Kowalski `active:scale-[0.99]` feedback and $\ge 44\text{px}$ touch targets.
   - **Card Header:** Touch checkbox (`min-h-[44px] min-w-[44px]`), initials icon, institution name + zone, and three-dot action menu.
   - **Card Body:** Compact status badge + Last updated date with relative time.
   - **Card Footer:** Assigned representative chip + Right Chevron (`ChevronRight`) tap target opening the contract lifecycle drawer.
   - **Mobile States:** 3-card skeleton shimmer and clean empty state with clear filters button.

4. **Parent Orchestrator Integration (`ContractsClient.tsx`):**
   - Replaces the monolithic 350-line inline table with `<AgreementsDesktopTable>` and `<AgreementsMobileCardList>`.
   - Strict typing (zero `any` or `any[]`), non-delegable RBAC preservation, and zero regression across all 12+ pre-existing contract modals.

---

## 2. Comprehensive Compliance Matrix: `agents_mcp_rules.md`

| Rule # | Requirement | Phase 5 Architectural Defense & Implementation |
| :--- | :--- | :--- |
| **Rule 1** | Next.js, React & Animation Best Practices | Follows Next.js 15 client component standards, `useMemo` for row data memoization, `useCallback` for event handlers, and Emil Kowalski tactile animations (`active:scale-[0.97]` for buttons, `active:scale-[0.99]` for mobile cards). Preserves all pre-existing app capabilities. |
| **Rule 2** | Failure Mode & Edge Case Analysis | Comprehensive analysis of 10 failure modes (event bubbling conflicts, date `RangeError`, hydration drift, text clipping on 375px screens, missing assignees, selection desync, etc.) with deterministic safeguards. |
| **Rule 3** | Impact on Other Features & Backoffice | Seamlessly connects with existing `ContractLifecycleDetailModal`, `ContractWizard`, `LegalHoldManagerModal`, `PurgeRecordModal`, and `ReminderSettingsDrawer`. Backoffice coordinators gain instant visual clarity on contract health and assignee ownership without code modifications. |
| **Rule 4** | Zero `any` or `any[]` Typing | Strict TypeScript interfaces for all props, row models (`EntityWithContract`), status unions (`ContractDisplayStatus`), and callback signatures. Zero `any`, `any[]`, or unchecked casts. |
| **Rule 5** | Pre-deployment Verification | Comprehensive typecheck (`NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`) and ESLint (`npx eslint src/app/admin/finance/contracts/`) before local commit. Zero automatic remote pushes. |
| **Rule 6** | Dependencies & Up-to-date APIs | Uses established `@/lib/date-utils.ts` (`formatSafeDate`, `formatSafeRelativeTime`), Lucide icons, and Radix UI / shadcn tokens. |
| **Rule 7** | Mobile-First & Everyday English | Responsive dual-mode layout (`hidden sm:block` table vs `sm:hidden` cards). All mobile touch targets (checkboxes, action triggers, pagination buttons, chevrons) meet $\ge 44\text{px}$. Clear, minimal everyday UI English (e.g. *"Active"*, *"Awaiting Signature"*, *"No Contract"*, *"Not assigned"*). |
| **Rule 8** | Security & Content Sanitization | Entity names, zones, and notes rendered as escaped React text nodes (XSS defense). Sensitive URLs (signing portals, certificates) use tokenized links. |
| **Rule 9 & 23** | Load Safeguards & Batch Limits | Client-side pagination ("Load more") prevents DOM bloating. Virtualized-friendly list structure avoiding browser freezing on 1,000+ entities. |
| **Rule 10** | Maintainer Guidance Comments | Comprehensive inline documentation explaining the dual-mode separation, event bubbling boundaries, date parsing safeguards, and testability pointers. |
| **Rule 13** | Trust Boundary Matrix | Entity metadata from Firestore treated as untrusted strings and safely rendered. Verification URLs validated before clipboard copy. |
| **Rule 16** | Non-Delegable Privileges & RBAC | Strict client-side checks for `canPurge`, `canAccessAdmin`, and `userPermissions.includes('contracts_create')`. Unprivileged users cannot trigger administrative purge or audit actions. |
| **Rule 17** | Multi-Tenant Workspace Boundary | All entity lookups, lifecycle modal openings, and contract queries strictly partitioned by `activeWorkspaceId`. Workspace switch resets table selection. |
| **Rule 18** | TOCTOU Concurrency Protection | Validates current contract state when clicking row actions or downloading PDFs; disables download when PDF generation is in flight. |
| **Rule 21** | Two-Phase Execution Guard | Destructive actions (e.g. `Purge Record`, `Audit & Purge History`) route strictly through two-phase confirmation dialogs before execution. |
| **Rule 22** | Content Injection Defense | Prevents raw HTML or CSS leakage. Table cells and card text sanitized against markup injection. |
| **Rule 50** | State & Memory Hygiene | Selection state (`selectedEntities`) synchronized between desktop table and mobile card list via parent `ContractsClient` state. Clean listener teardown on unmount. |
| **Rule 54** | Performance & Re-render Budgets | Components wrapped with `React.memo`. Props pass stable callbacks (`useCallback`) and memoized data arrays (`useMemo`) to avoid re-rendering rows during search keystrokes. |

---

## 3. Failure Mode & Edge Case Analysis (Rule 2)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 5 FAILURE MODES                           │
├───────────────────────────────────┬────────────────────────────────────┤
│ Failure Mode                      │ Architectural Safeguard            │
├───────────────────────────────────┼────────────────────────────────────┤
│ 1. Event Bubbling Conflict        │ Call `e.stopPropagation()` in the  │
│    (Clicking checkbox/menu opens  │ checkbox container, quick action   │
│    the Lifecycle drawer by error) │ buttons, and dropdown triggers.    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 2. Date-fns `RangeError`          │ Use `formatSafeDate` and           │
│    (Corrupt/null updatedAt crashes│ `formatSafeRelativeTime` from      │
│    the entire table component)    │ `@/lib/date-utils.ts` (safe fallback│
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. Client/Server Hydration Drift  │ Format relative times safely or use│
│    (SSR relative time differs from│ client-side mounted state to avoid │
│    client mount timestamp)        │ hydration mismatch warnings.       │
├───────────────────────────────────┼────────────────────────────────────┤
│ 4. Mobile Text Overflow & Truncate│ Apply `truncate max-w-[180px]`     │
│    (Long school names break card  │ with native `title` attribute for  │
│    geometry on 375px screens)     │ full name accessibility.           │
├───────────────────────────────────┼────────────────────────────────────┤
│ 5. Unassigned Representative Drop │ Render a standardized compact dash:│
│    (Missing assignee shrinks cell │ `<span className="text-muted-      │
│    and causes uneven row heights) │ foreground/60 text-xs">— Not       │
│                                   │ assigned</span>`.                  │
├───────────────────────────────────┼────────────────────────────────────┤
│ 6. Desktop/Mobile Selection Desync│ Pass single source of truth        │
│    (Selecting on desktop loses    │ `selectedEntities` and             │
│    selection on resize to mobile) │ `onToggleSelect` to both views.    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 7. Legal Hold Lock Badge Clipping │ Display lock icon inline next to   │
│    (Pushed off screen by name)    │ name with `shrink-0` & tooltip.    │
├───────────────────────────────────┼────────────────────────────────────┤
│ 8. Rapid Pagination Over-fetch    │ Disable "Load more" button during  │
│    (Double clicking "Load more")  │ active request (`isLoadingMore`).  │
├───────────────────────────────────┼────────────────────────────────────┤
│ 9. Zombie Modals & Stale Context  │ Reset modal target states when     │
│    (Opening modal for old entity) │ switching workspace or entity.     │
├───────────────────────────────────┼────────────────────────────────────┤
│ 10. Checkbox Tri-State Glitch     │ Explicitly handle `'indeterminate'`│
│    (Partial selection rendering)  │ state on master header checkbox.   │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 4. Cross-Feature Impact & Backoffice Enhancement (Rule 3)

### 4.1. Impact on Existing Features
- **Preserved Tabs & Modals:**
  - `BulkCampaignsTab`, `TemplateCatalogTab`, `ObligationsSummaryTab`, `ContractsAnalyticsTab`, `EnterpriseGovernanceTab`, `MigrationCutoverTab`, `DeveloperPlatformTab`.
  - All 12+ modals and drawers (`ContractWizard`, `ContractLifecycleDetailModal`, `CreateAmendmentModal`, `CreateObligationModal`, `ObligationReviewModal`, `SemanticDiffModal`, `ContractCopilotModal`, `LegalHoldManagerModal`, `PurgeRecordModal`, `WithdrawEntityModal`, `EnvelopeTrackingModal`, `ReminderSettingsDrawer`).
- **Phase 4 Filters & Bulk Action Bar:**
  - Seamlessly filters records in both desktop table and mobile cards.
  - Selections in either view immediately dock the `AgreementsBulkActionBar`.

### 4.2. Backoffice Operational Enhancement
- **Visual Noise Elimination:** Replacing repetitive, italic "Unassigned" labels with clean initials avatars and subtle indicators gives backoffice managers an immediate high-level grasp of account coverage.
- **1-Tap Lifecycle Auditing:** Clicking an institution row or card directly surfaces complete contract lineage, amendment history, and post-signing obligations.
- **Field Representative Mobility:** Mobile field coordinators visiting client sites can manage contracts, copy signing links, and check obligations on smartphones without horizontal table scrolling frustration.

---

## 5. Detailed Component Specifications

### 5.1. `AgreementsStatusBadge.tsx`
- **Location:** `src/app/admin/finance/contracts/components/AgreementsStatusBadge.tsx`
- **Props Interface:**
  ```ts
  export type ContractDisplayStatus = 
    | 'signed' 
    | 'sent' 
    | 'draft' 
    | 'no_contract' 
    | 'expiring' 
    | 'expired';

  export interface AgreementsStatusBadgeProps {
    status: ContractDisplayStatus | string;
    size?: 'default' | 'compact';
    className?: string;
  }
  ```
- **Styling Tokens:**
  - `signed`: `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`
  - `sent`: `bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20`
  - `draft`: `bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20`
  - `no_contract`: `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`
  - `expiring`: `bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20`
  - `expired`: `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`

### 5.2. `AgreementsDesktopTable.tsx`
- **Location:** `src/app/admin/finance/contracts/components/AgreementsDesktopTable.tsx`
- **Visibility:** `hidden sm:block`
- **Props Interface:**
  ```ts
  export interface AgreementsDesktopTableProps {
    items: EntityWithContract[];
    selectedEntities: EntityWithContract[];
    onToggleSelect: (item: EntityWithContract) => void;
    onSelectAll: (checked: boolean) => void;
    onRowClick: (item: EntityWithContract) => void;
    onCopySigningLink: (item: EntityWithContract) => void;
    onDownloadSignedPdf: (contract: Contract) => void;
    onPrepContract: (item: EntityWithContract) => void;
    onSendAgreement: (item: EntityWithContract) => void;
    onTrackSignatories: (contractId: string) => void;
    onOpenLifecycle: (contractId: string) => void;
    onOpenCopilot: (contract: { id: string; title: string }) => void;
    onOpenRedline: (contract: { id: string; title: string }) => void;
    onOpenObligations: (contract: { id: string; title: string }) => void;
    onOpenLegalHold: (params: LegalHoldContractParams) => void;
    onPurgeContract: (params: { contract: Contract; entity: WorkspaceEntity }) => void;
    onAuditPurgeHistory: (entity: WorkspaceEntity) => void;
    downloadingId: string | null;
    canPurge: boolean;
    isLoading: boolean;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onResetFilters: () => void;
    hasActiveFilters: boolean;
    getEntityZoneName: (e: WorkspaceEntity) => string;
  }
  ```

### 5.3. `AgreementsMobileCardList.tsx`
- **Location:** `src/app/admin/finance/contracts/components/AgreementsMobileCardList.tsx`
- **Visibility:** `sm:hidden`
- **Props Interface:** Shares the same strongly typed props interface as `AgreementsDesktopTableProps`.
- **Card Elements:**
  - Card container with `border border-border/80 bg-card rounded-2xl p-4 shadow-xs space-y-3 active:scale-[0.99]`.
  - Header: Touch checkbox (`min-h-[44px] min-w-[44px]`), initials icon, institution name + zone, and three-dot action menu.
  - Body: Compact `<AgreementsStatusBadge>` + Last updated date with relative time.
  - Footer: Assigned representative chip + Right Chevron (`ChevronRight`) tap target opening the contract lifecycle drawer.
  - 3-card shimmer skeleton during initial load.
  - Empty state with clear filters button.

---

## 6. Implementation Sequence & Verification Checklist

- [ ] **Task 1: Create `AgreementsStatusBadge.tsx`**
  - Implement standardized status pill badge with tokenized colors, Lucide icons, and `default`/`compact` size variants.
  - Add maintainer guidance comments (Rule 10).
  - Verify zero `any` typing.

- [ ] **Task 2: Create `AgreementsDesktopTable.tsx`**
  - Implement noise-reduced desktop table layout (`hidden sm:block`).
  - Add initials avatar, clean name + zone, status badge, formatted date + relative time.
  - Add compact assigned representative display (`avatar + name + role` or `— Not assigned`).
  - Add quick action buttons (`Copy Link`, `View Page`) and complete 3-dot action menu.
  - Add actionable row click opening lifecycle drawer (with `stopPropagation` on controls).
  - Add skeleton shimmer rows and empty state with clear filters button.

- [ ] **Task 3: Create `AgreementsMobileCardList.tsx`**
  - Implement tactile mobile card list (`sm:hidden`).
  - Implement header with touch checkbox (`min-h-[44px]`), initials icon, name, and 3-dot menu.
  - Implement body with status badge, last updated relative time, and representative chip.
  - Implement footer tap target with right chevron opening lifecycle drawer.
  - Implement mobile skeleton loader and mobile empty state.

- [ ] **Task 4: Integrate Dual-Mode Register into `ContractsClient.tsx`**
  - Replace monolithic inline table (lines 631–958) with `<AgreementsDesktopTable>` and `<AgreementsMobileCardList>`.
  - Wire all selection, pagination, and modal action handlers cleanly.
  - Ensure zero functional regression across all 12+ modals and drawers.

- [ ] **Task 5: Typecheck & ESLint Verification**
  - Run `npx eslint src/app/admin/finance/contracts/`.
  - Run TypeScript compile check (`NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`).
  - Verify 0 errors, 0 warnings.

- [ ] **Task 6: Commit Locally & Architect Code Review**
  - Commit changes locally (`git commit -m "feat(agreements-hub): implement Phase 5 institution register visual noise reduction and responsive dual-mode"`).
  - Run code review with Senior Principal Systems and AI Agent Architect.
