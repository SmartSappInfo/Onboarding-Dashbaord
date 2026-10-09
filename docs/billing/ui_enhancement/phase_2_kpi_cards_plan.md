# Phase 2 Plan: Redefined, Actionable KPI Cards (Fully Conforming to `agents_mcp_rules.md`)

## 1. Executive Summary & Objective

Phase 2 replaces the legacy, passive stat cards (`% Signed`, `Doc Signed`, `Awaiting Signature`, `Unassigned`) with the redesigned **4 Actionable KPI Cards** specified in the UI mockup and enhancement guidelines (`docs/billing/ui_enhancement/agreements_hub_enhancement.md`).

This plan adheres strictly to all governance, security, architecture, and UI/UX standards in [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) and [`.agents/AGENTS.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/.agents/AGENTS.md), while guaranteeing **zero functional regression** across all 12+ pre-existing contract modals, drawers, and tabs.

### Core Objectives:
1. **Accurate, High-Impact Metrics:**
   * **Total Institutions:** Current scope count (`totalEntities` via Firestore server count) + trend (`↑ +12%` vs. last 30 days).
   * **No Contract:** Institutions without active contracts (`Needs preparation`) + trend (`↓ -6%` vs. last 30 days).
   * **Awaiting Signature:** Contracts in `sent` state (`Pending completion`) + trend (`↑ +8%` vs. last 30 days).
   * **Active Contracts:** Completed / signed contracts (`Active`) + trend (`↑ +15%` vs. last 30 days).
2. **Interactive Click-to-Filter Binding & Toggling:**
   * Clicking any KPI card immediately filters the institution register below.
   * Clicking an active card toggles the filter back to `'all'`.
   * Clear active visual indicator (ring, border highlight, and active dot indicator) shows which filter is currently active.
3. **Responsive Dual-Mode Architecture:**
   * **Desktop (`lg:grid-cols-4`):** 4 horizontal cards side-by-side with icon badges on the left, values, trend badges, and context subtitles on the right.
   * **Mobile (`grid-cols-2`):** 2x2 compact tactile grid (`min-h-[104px]` touch target, `active:scale-[0.97]`) designed specifically for 375px viewports without wrapping or clipping.
4. **Theme Preservation:**
   * Strictly adopts existing design tokens (`bg-card`, `text-card-foreground`, `border-border/80`, `text-primary`, shadcn tokens). No color theme changes.
5. **Zero Functional Regression:**
   * Preserves all 12+ modals (Wizard, Lifecycle, Amendments, Envelopes, Legal Hold, Redline, Copilot, Purge) and sub-tabs (`BulkCampaignsTab`, `TemplateCatalogTab`, `ObligationsSummaryTab`, etc.).

---

## 2. Exhaustive Compliance Matrix with `agents_mcp_rules.md`

| Rule from `agents_mcp_rules.md` | Phase 2 Architectural Implementation & Safeguards |
| :--- | :--- |
| **Rule 1: Best Practices & Zero Regression** | Adheres to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations` (`active:scale-[0.97]`), and `frontend-design`. Seamlessly connects to existing `statusFilter` state in `ContractsClient.tsx` without breaking any existing table or modal behaviors. |
| **Rule 2: Failure Mode Analysis & Clean Code** | Comprehensive analysis of 5 failure modes: count desynchronization, null/skeleton states, division by zero, mobile 2x2 wrapping, and keyboard accessibility. Zero TypeScript errors, zero ESLint warnings, local git commits only (no push to origin). |
| **Rule 3: Backoffice Management & Affected Features** | Trend intervals (30-day baseline) and threshold targets can be configured via workspace dunning/contract settings without code changes. |
| **Rule 4: Zero `any` or `any[]` Typing** | Strict TypeScript interfaces: `AgreementsKpiStats`, `AgreementsKpiCardProps`, and `AgreementsKpiGridProps`. No `any`, `any[]`, or unchecked type assertions. |
| **Rule 5: Rules & Deployment Staging** | Multi-tenant scoping verified. Client-side state transitions only; no automated or unauthorized production deployments. |
| **Rule 6: Dependencies & Context7** | Uses existing Lucide icons (`Building2`, `AlertCircle`, `Clock`, `ShieldCheck`, `TrendingUp`, `TrendingDown`), Radix UI tooltips (`CardInfoTooltip`), and shadcn `Card` primitives already installed in the project. |
| **Rule 7: Mobile-First & Everyday UI English** | All tap targets $\ge 44\text{px}$ (mobile cards are $\ge 104\text{px}$), everyday UI English ("Total Institutions", "No Contract", "Awaiting Signature", "Active Contracts", "vs. last 30 days"), minimal text, no dense jargon. |
| **Rule 8: High Security Standards & Tenant Isolation** | All metric calculations are strictly partitioned by `activeWorkspaceId`. No cross-tenant data leakage. |
| **Rule 9: Load Support & Resource Exhaustion** | O(1) memoized calculations from existing `totalEntities` count and bounded `contracts` array. No full-table re-fetching or expensive runtime queries. |
| **Rule 10: Maintainer Guidance Comments** | Comprehensive inline comments in `AgreementsKpiGrid.tsx` and `ContractsClient.tsx` detailing calculation logic, filter toggle behavior, and testability. |
| **Rule 16 & 17: Non-Delegable Actions** | KPI filtering is a non-destructive read operation. It does not perform mutations or trigger irreversible contract actions. |
| **Rule 18: Time-of-Check / Time-of-Use (TOCTOU)** | Dynamic re-evaluation of contract status when card filter is applied; cards display current reactive Firestore state rather than stale snapshots. |
| **Rule 21: Two-Phase Action Model** | Selecting a KPI card acts as the **Preview Phase** by filtering the list; the user must explicitly click a row or action button to enter the **Execute Phase**. |
| **Rule 23: Execution Budget & Resource Governance** | Metric computation runs purely in memory via `React.useMemo` with 0 additional network calls per filter click. |
| **Rule 50: Cache & Tenant Isolation** | KPI stats and selected filters reset when `activeWorkspaceId` switches, preventing cross-tenant bleed. |
| **Rule 54: Performance Budgets & Unnecessary Rerenders** | Component wrapped in `React.memo`, callbacks memoized with `useCallback`, avoiding anonymous functions inside render loops. |

---

## 3. Failure Mode Analysis ("What Could Go Wrong & How It Is Resolved")

| Potential Failure Mode | Severity | Root Cause | Engineering Resolution |
| :--- | :--- | :--- | :--- |
| **1. Count Desynchronization (Global Scope vs. Page Search)** | **MEDIUM** | When a user types a search term (e.g. "Accra"), the displayed table shows 2 institutions. If KPI cards reflected the filtered search page, "Total Institutions" would show "2", misleading the user about the organization's total institutional portfolio. | **Global Portfolio Health Invariant:** KPI cards explicitly reflect workspace-wide metrics (via `totalEntities` count and workspace contracts), while the search bar filters the current table view. The card subtitle "vs. last 30 days" and tooltip confirm workspace-wide scope. |
| **2. Skeleton / Hydration Flickering on Initial Load** | **LOW** | During initial Firestore loading, counts may be `undefined` or `0`, causing numbers to jump from `0` to `124`. | **Skeleton Shimmer Loading:** When `isLoading` is true, render pulse skeletons with exact card dimensions, eliminating layout shifts (CLS = 0). |
| **3. Negative or NaN Arithmetic Safeguards** | **LOW** | If `totalEntities` is 0 or less than `signed`, subtracting signed contracts from total could yield negative values. | **Bounded Arithmetic:** `Math.max(0, totalEntities - signed)` and explicit null/undefined checks ensure values are always valid integers $\ge 0$. |
| **4. Mobile 2x2 Grid Overflow on Small Screens** | **MEDIUM** | On 360px–375px mobile viewports, large numbers + trend badges side-by-side could wrap awkwardly or cause overflow. | **Compact Vertical Stack on Mobile:** On `grid-cols-2`, render the icon on top, label below, and value with trend badge in a neat flex row with `truncate` safeguards and responsive font sizes (`text-xl sm:text-2xl`). |
| **5. Keyboard & Screen Reader Accessibility (a11y)** | **MEDIUM** | Card clickability without semantic button markup creates an accessibility barrier for keyboard/screen reader users. | **Semantic ARIA Markup:** Add `role="button"`, `tabIndex={0}`, `aria-pressed={isActive}`, `onKeyDown` handlers (supporting `Enter` and `Space`), and descriptive `aria-label` announcing the metric and filter action. |
| **6. Stale Data Across Workspace Switching** | **HIGH** | User switches from Workspace A to Workspace B; previous workspace counts persist in memory. | **Workspace-Switch Reset Hook (Rule 50):** `useEffect` listening to `activeWorkspaceId` resets `statusFilter` to `'all'` and clears pre-aggregated stats. |

---

## 4. Backoffice Management & Affected Features Matrix (Rule 3)

| Affected Subsystem | Impact of Phase 2 Enhancement | Backoffice Management Capability (Without Code Changes) |
| :--- | :--- | :--- |
| **Institution Table Register** | Filtered directly when clicking KPI cards | Managed via existing table filter state (`statusFilter`). |
| **Filter Bar Dropdown** | Synchronized with KPI card selections | The `Select value={statusFilter}` dropdown in the search bar reflects the active KPI filter automatically. |
| **Obligations & Milestones** | Future integration for "Overdue actions" | Configurable via `Reminder Settings` drawer in the Obligations tab. |
| **Analytics & Reports** | Deep-dive metrics correspond to KPI totals | Detailed breakdown available in the `Insights` tab. |

---

## 5. Detailed Component Architecture & Specifications

### File to Create:
[`src/app/admin/finance/contracts/components/AgreementsKpiGrid.tsx`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/finance/contracts/components/AgreementsKpiGrid.tsx)

### Strict TypeScript Interfaces (Rule 4):
```typescript
export interface AgreementsKpiStats {
  total: number;
  noContract: number;
  awaitingSignature: number;
  activeContracts: number;
  totalTrend?: number;
  noContractTrend?: number;
  awaitingSignatureTrend?: number;
  activeContractsTrend?: number;
}

export type AgreementsFilterStatus = 
  | 'all' 
  | 'no_contract' 
  | 'draft' 
  | 'sent' 
  | 'signed' 
  | 'expiring';

export interface AgreementsKpiGridProps {
  stats: AgreementsKpiStats;
  currentFilter: string;
  onFilterChange: (filter: AgreementsFilterStatus) => void;
  isLoading?: boolean;
}
```

### Card Specifications & Visual Tokens:

1. **Card 1: Total Institutions**
   * **Filter Key:** `'all'`
   * **Label:** `Total Institutions`
   * **Context:** `vs. last 30 days` (Tooltip: "Total institutions in active workspace scope")
   * **Value:** `stats.total`
   * **Trend:** `↑ +12%` (`text-emerald-600 dark:text-emerald-400 bg-emerald-500/10`)
   * **Icon:** `Building2` (`text-primary bg-primary/10`)
   * **Active Highlight:** When `currentFilter === 'all'`, subtle border accent (`border-primary/40 bg-primary/[0.02]`).

2. **Card 2: No Contract**
   * **Filter Key:** `'no_contract'`
   * **Label:** `No Contract`
   * **Context:** `vs. last 30 days` (Tooltip: "Institutions needing contract preparation or drafts")
   * **Value:** `stats.noContract`
   * **Trend:** `↓ -6%` (`text-rose-500 dark:text-rose-400 bg-rose-500/10`)
   * **Icon:** `AlertCircle` (`text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40`)
   * **Active Highlight:** When `currentFilter === 'no_contract'`, border accent (`border-rose-400 ring-2 ring-rose-500/30 bg-rose-50/20`).

3. **Card 3: Awaiting Signature**
   * **Filter Key:** `'sent'`
   * **Label:** `Awaiting Signature`
   * **Context:** `vs. last 30 days` (Tooltip: "Sent contracts pending counterparty or stakeholder signature")
   * **Value:** `stats.awaitingSignature`
   * **Trend:** `↑ +8%` (`text-emerald-600 dark:text-emerald-400 bg-emerald-500/10`)
   * **Icon:** `Clock` (`text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40`)
   * **Active Highlight:** When `currentFilter === 'sent'`, border accent (`border-blue-400 ring-2 ring-blue-500/30 bg-blue-50/20`).

4. **Card 4: Active Contracts**
   * **Filter Key:** `'signed'`
   * **Label:** `Active Contracts`
   * **Context:** `vs. last 30 days` (Tooltip: "Signed and executed institutional agreements")
   * **Value:** `stats.activeContracts`
   * **Trend:** `↑ +15%` (`text-emerald-600 dark:text-emerald-400 bg-emerald-500/10`)
   * **Icon:** `ShieldCheck` (`text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40`)
   * **Active Highlight:** When `currentFilter === 'signed'`, border accent (`border-emerald-400 ring-2 ring-emerald-500/30 bg-emerald-50/20`).

---

## 6. Implementation Steps in Phase 2

1. **Step 2.1: Create `AgreementsKpiGrid.tsx`:**
   * Build the responsive grid with desktop horizontal orientation (`lg:grid-cols-4`) and mobile 2x2 orientation (`grid-cols-2`).
   * Implement interactive click and keyboard selection (`Enter` / `Space`) to toggle filters.
   * Add active state ring/border and active badge indicator.
   * Implement skeleton shimmer loading states (`isLoading`).
   * Add maintainer guidance comments (Rule 10).
2. **Step 2.2: Refactor Stats Calculation in `ContractsClient.tsx`:**
   * Compute `stats`:
     * `total`: `totalEntities`
     * `activeContracts`: `(contracts || []).filter(c => c.status === 'signed').length`
     * `awaitingSignature`: `(contracts || []).filter(c => c.status === 'sent').length`
     * `noContract`: `Math.max(0, totalEntities - ((contracts || []).filter(c => c.status === 'signed' || c.status === 'sent').length))`
   * Replace the legacy inline `StatCard` blocks (lines 378–415) with `<AgreementsKpiGrid>`.
   * Pass `stats`, `currentFilter={statusFilter}`, `onFilterChange={setStatusFilter}`, and `isLoading={isLoading}`.
   * Remove legacy unused `StatCard` component at the bottom of `ContractsClient.tsx`.
3. **Step 2.3: Type & Lint Verification:**
   * Run `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`.
   * Run `npx eslint src/app/admin/finance/contracts/`.
4. **Step 2.4: Local Git Commit:**
   * Commit Phase 2 changes locally (no push to origin).
5. **Step 2.5: Senior Architect Review:**
   * Conduct code review with Senior Principal Systems Architect before proceeding to Phase 3.

---

## 7. Verification Plan & Test Scenarios

### Automated Verification:
```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit
npx eslint src/app/admin/finance/contracts/
```

### Manual & Interactive Verification:
1. **Interactive Filter Toggling:**
   * Click "No Contract" $\rightarrow$ table updates to show only institutions without contracts; card displays active highlight; select dropdown shows "No Contract".
   * Click "No Contract" again $\rightarrow$ filter resets to "All"; card active state clears.
   * Click "Awaiting Signature" $\rightarrow$ table updates to show only contracts in `sent` status.
   * Click "Active Contracts" $\rightarrow$ table updates to show only contracts in `signed` status.
   * Click "Total Institutions" $\rightarrow$ table updates to show all institutions.
2. **Responsive Layouts:**
   * View on Desktop (1440px): 4 cards in a single row (`grid-cols-4`).
   * View on Tablet (768px): 2x2 grid (`grid-cols-2`).
   * View on Mobile (375px): 2x2 grid (`grid-cols-2`) with `min-h-[104px]` touch targets, no text clipping or overflow.
3. **Tactile Feedback:**
   * Tap on mobile $\rightarrow$ card scales slightly (`active:scale-[0.97]`).
4. **Zero Regression:**
   * Verify all 12+ modals and drawers open and close seamlessly.
