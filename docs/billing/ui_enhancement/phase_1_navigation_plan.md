# Phase 1 Plan: Navigation Architecture & Section Restructuring (Conforming to `agents_mcp_rules.md`)

## 1. Executive Summary & Objective

Phase 1 establishes the foundational **Four-Section Navigation Architecture** for the Agreements Hub (`src/app/admin/finance/contracts/ContractsClient.tsx`).

It resolves the cognitive overload of the previous 8 competing top-level tabs by reorganizing the page into:
1. **Four Primary Workflow Sections:**
   * **Contracts (`contracts`):** Contract register, lifecycle inspection, and in-view bulk campaigns sub-view.
   * **Templates (`templates`):** Document templates catalog and reusable clauses (`TemplateCatalogTab`).
   * **Obligations (`obligations`):** Post-signing milestones, renewals, compliance tracking, and reminder settings (`ObligationsSummaryTab`).
   * **Insights (`insights`):** Analytics, signing velocity, and audit reports (`ContractsAnalyticsTab`).
2. **Administration Menu (`Administration ⌄` Dropdown):**
   * Relocates technical/administrative modules out of everyday operational sight:
     * **Enterprise & Governance (`governance`)** (`EnterpriseGovernanceTab`)
     * **GA Cutover & Migration (`migration`)** (`MigrationCutoverTab`)
     * **Developer & Embedded SDK (`developer`)** (`DeveloperPlatformTab`)
   * Strictly gated by RBAC permissions (`system_admin` or `admin_role`).
3. **Dual-Mode Mobile Navigation:**
   * Desktop: Segmented pill tabs + Administration dropdown menu.
   * Mobile: Horizontal scrollable segmented pill control + Mobile Bottom Navigation Dock (`min-h-[44px]` touch targets).
4. **Zero Functional Regression:**
   * All pre-existing tabs (`TemplateCatalogTab`, `ObligationsSummaryTab`, `ContractsAnalyticsTab`, `EnterpriseGovernanceTab`, `MigrationCutoverTab`, `DeveloperPlatformTab`, `BulkCampaignsTab`) remain 100% functional.
   * All 12+ modals and drawers remain wired and operational.

---

## 2. Complete Compliance Matrix with `agents_mcp_rules.md`

| Rule from `agents_mcp_rules.md` | Phase 1 Architectural Implementation & Verification |
| :--- | :--- |
| **Rule 1: Best Practices & Zero Regression** | Adheres to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations` (`active:scale-[0.97]`), and `frontend-design`. All 8 existing tab views and 12+ modals remain fully intact. |
| **Rule 2: Failure Mode Analysis & Clean Code** | Rigorous analysis of tab desynchronization, dropdown traps, mobile clipping, and memory leaks. Zero TypeScript errors, zero ESLint warnings, local commits only. |
| **Rule 3: Backoffice Management & Affected Features** | Administration dropdown dynamically renders based on user permissions (`userPermissions.includes('system_admin') || userPermissions.includes('admin_role')`) without hardcoded code changes. |
| **Rule 4: Zero `any` or `any[]` Typing** | Strict union typing for all tab keys (`AgreementsTabKey`) and sub-views (`ContractsSubViewKey`). Never use `any`, `any[]`, or unchecked casts. |
| **Rule 5: Rules & Deployment Staging** | Client-side navigation verified to adhere to existing Firestore security rules and multi-tenant scoping. No automated or unverified production deployments. |
| **Rule 6: Dependencies & Context7** | Uses existing Radix UI / shadcn dropdown and tab primitives already installed and configured in the project. |
| **Rule 7: Mobile-First & Everyday English** | All tap targets $\ge 44\text{px}$, smooth scroll gestures, simple everyday UI English (`Contracts`, `Templates`, `Obligations`, `Insights`, `Administration`, `More`), minimal text, no dense jargon. |
| **Rule 8: High Security Standards & Multi-Tenant Isolation** | Workspace context (`activeWorkspaceId`) cleanly passed to all tab components; administrative tabs hidden and blocked for non-admin users. |
| **Rule 9: Load Support & Resource Exhaustion (Vercel/React Best Practices)** | Inactive tab views conditionally unmounted or lazy-rendered so that 7 complex sub-tabs do not bloat the DOM, memory, or Firestore listeners simultaneously. |
| **Rule 10: Maintainer Guidance Comments** | Comprehensive inline comments in all new and modified components explaining invariants, tab hierarchy, and testability. |
| **Rule 16 & 17: Non-Delegable Admin Privileges** | Administration tabs are protected by user permissions. |
| **Rule 50: Cache & Tenant Isolation** | Tab state reflects the current `activeWorkspaceId`. When switching workspaces, tab state defaults safely to `contracts`. |
| **Rule 54: Performance Budgets & Unnecessary Rerenders** | Navigation buttons memoized; avoids anonymous inline arrow functions in render loops. |

---

## 3. Failure Mode Analysis ("What Could Go Wrong & How It Is Resolved")

| Potential Failure Mode | Severity | Root Cause | Engineering Resolution |
| :--- | :--- | :--- | :--- |
| **Active Tab State Desynchronization** | **HIGH** | User selects "Enterprise & Governance" from the Administration dropdown, but the primary 4-tab bar loses visual indication of where the user is. | **Parent Dropdown Active State Binding:** When `activeTab` is `'governance'`, `'migration'`, or `'developer'`, the `Administration ⌄` dropdown trigger displays an active indicator badge/styling (e.g. `bg-primary/10 text-primary border-primary/20`) and displays the active sub-module name. |
| **Mobile Viewport Overflow & Clipping** | **MEDIUM** | Long tab labels squeezing on 360px–390px mobile screens, causing horizontal scrollbars or ugly line breaks. | **Responsive Segmented Scroll:** Apply `overflow-x-auto no-scrollbar scroll-smooth flex-nowrap` to the tab container on mobile, paired with the persistent `AgreementsMobileBottomNav` dock. |
| **Bulk Campaigns Inaccessibility** | **MEDIUM** | Users who previously accessed "Bulk Campaigns & Compliance" as a top-level tab cannot find it after consolidation. | **Sub-View Switcher inside Contracts:** Inside the `Contracts` tab, provide a clean secondary segmented switch: `[Institution Register]` / `[Bulk Campaigns]`, preserving 100% of `BulkCampaignsTab` functionality. |
| **Unauthorized Access to Admin Tools** | **HIGH** | Non-admin users seeing or clicking GA Migration or Developer SDK. | **Strict Permission Guard:** Filter the Administration dropdown items against `canAccessAdmin = userPermissions.includes('system_admin') || userPermissions.includes('admin_role')`. If unauthorized, hide the dropdown. |
| **DOM Bloat & Firestore Listener Overload** | **HIGH** | Rendering all 7 tab components simultaneously in the background maintains active real-time listeners across all sub-modules. | **Lazy Tab Mount Guard:** Render tab component trees conditionally (`{activeTab === 'templates' && <TemplateCatalogTab ... />}`) or ensure unmounted tabs release snapshot subscriptions. |

---

## 4. Backoffice Management & Affected Features Matrix (Rule 3)

| Affected Subsystem | Impact of Phase 1 Enhancement | Backoffice Management Capability (Without Code Changes) |
| :--- | :--- | :--- |
| **Bulk Campaigns & Compliance** | Relocated from top-level tab to sub-view within `Contracts` tab | Managed via clean toggle `[Institution Register]` / `[Bulk Campaigns]` directly in the Contracts UI. |
| **Enterprise & Governance** | Relocated into `Administration ⌄` dropdown | Role-based visibility automatically controlled by workspace permissions (`system_admin` or `admin_role`). |
| **GA Cutover & Migration** | Relocated into `Administration ⌄` dropdown | Accessible only to authorized migration engineers and workspace owners. |
| **Developer & Embedded SDK** | Relocated into `Administration ⌄` dropdown | Accessible only to developer roles for API keys and webhook configuration. |
| **Reminder Settings** | Accessible contextually within `Obligations` | Controlled via `ReminderSettingsDrawer` in the Obligations section. |

---

## 5. Component Architecture & File Plan

### 1. [NEW] `src/app/admin/finance/contracts/components/AgreementsHubNav.tsx`
* **Purpose:** Reusable, responsive navigation component for the Agreements Hub.
* **Props Contract:**
  ```typescript
  export type AgreementsTabKey = 
    | 'contracts' 
    | 'templates' 
    | 'obligations' 
    | 'insights' 
    | 'governance' 
    | 'migration' 
    | 'developer';

  export type ContractsSubViewKey = 'register' | 'campaigns';

  export interface AgreementsHubNavProps {
    activeTab: AgreementsTabKey;
    onTabChange: (tab: AgreementsTabKey) => void;
    userPermissions: string[];
    contractsSubView?: ContractsSubViewKey;
    onContractsSubViewChange?: (view: ContractsSubViewKey) => void;
  }
  ```
* **Features:**
  * 4 Primary Tab Buttons:
    * `Contracts` (Icon: `FileCheck`)
    * `Templates` (Icon: `FileText`)
    * `Obligations` (Icon: `CheckSquare`)
    * `Insights` (Icon: `BarChart3`)
  * `Administration ⌄` Dropdown Menu:
    * `Enterprise & Governance` (Icon: `ShieldCheck`)
    * `GA Cutover & Migration` (Icon: `Rocket`)
    * `Developer & Embedded SDK` (Icon: `Code2`)
  * Active state highlighting on the Administration dropdown when an admin sub-view is selected.
  * Tactile animations (`active:scale-[0.97]`).
  * Mobile horizontal scroll with smooth swipe physics.

### 2. [NEW] `src/app/admin/finance/contracts/components/AgreementsMobileBottomNav.tsx`
* **Purpose:** Touch-first bottom navigation dock for mobile devices (`sm:hidden`).
* **Features:**
  * 5 Fixed Touch Targets (`min-h-[44px]`):
    * `Home` (`/admin` link)
    * `Contracts` (`activeTab = 'contracts'`)
    * `Templates` (`activeTab = 'templates'`)
    * `Obligations` (`activeTab = 'obligations'`)
    * `More` (Opens bottom sheet for `Insights` and `Administration` modules)
  * Elevated with blur backdrop (`bg-background/95 backdrop-blur-md border-t border-border/80`).

### 3. [MODIFY] `src/app/admin/finance/contracts/ContractsClient.tsx`
* **Refactor Tab State:**
  * Update `activeTab` to `AgreementsTabKey`.
  * Add `contractsSubView: 'register' | 'campaigns'` state.
* **Replace Legacy `<TabsList>`:**
  * Render `<AgreementsHubNav>` in place of the 8-tab trigger list.
  * Render `<AgreementsMobileBottomNav>` at the bottom of the client container on mobile.
* **Update Tab Contents:**
  * `value="contracts"`: Displays Contracts Register when `contractsSubView === 'register'`, and `<BulkCampaignsTab>` when `contractsSubView === 'campaigns'`.
  * `value="templates"`: `<TemplateCatalogTab>`.
  * `value="obligations"`: `<ObligationsSummaryTab>`.
  * `value="insights"`: `<ContractsAnalyticsTab>`.
  * `value="governance"`: `<EnterpriseGovernanceTab>`.
  * `value="migration"`: `<MigrationCutoverTab>`.
  * `value="developer"`: `<DeveloperPlatformTab>`.

---

## 6. Step-by-Step Execution Sequence

1. **Step 1:** Create `AgreementsHubNav.tsx` under `src/app/admin/finance/contracts/components/` with strict typing, permissions gating, Emil Kowalski tactile animations, and responsive styling.
2. **Step 2:** Create `AgreementsMobileBottomNav.tsx` under `src/app/admin/finance/contracts/components/` for mobile touch navigation (`sm:hidden`).
3. **Step 3:** Refactor `ContractsClient.tsx` to integrate `AgreementsHubNav`, support the 4 primary tabs + Administration dropdown, add sub-view switching for Bulk Campaigns, and wire `AgreementsMobileBottomNav`.
4. **Step 4:** Run TypeScript compilation (`tsc --noEmit`) and ESLint audits to verify zero errors or warnings.
5. **Step 5:** Perform visual verification of tab switching and mobile layout adaptability.

---

## 7. Verification Criteria

* [ ] Primary tab bar displays exactly 4 tabs: `Contracts`, `Templates`, `Obligations`, `Insights`.
* [ ] Administration dropdown displays `Enterprise & Governance`, `GA Cutover & Migration`, and `Developer & Embedded SDK`.
* [ ] Selecting an administration item switches the view and marks the Administration dropdown as active.
* [ ] Inside `Contracts`, user can toggle between Institutional Register and Bulk Campaigns without losing any campaign functionality.
* [ ] Mobile viewport renders clean scrollable tabs and the bottom navigation bar with $\ge 44\text{px}$ touch targets.
* [ ] TypeScript check (`npx tsc --noEmit`) passes with 0 errors.
* [ ] ESLint check (`npx eslint`) passes with 0 warnings/errors.
* [ ] Zero `any` or `any[]` typing throughout.
