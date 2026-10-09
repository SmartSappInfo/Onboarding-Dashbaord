# Agreements Hub UI Enhancement: Phase-by-Phase Implementation Plan (Conforming to `agents_mcp_rules.md`)

## Executive Summary

This implementation plan outlines the reorganization of the **Agreements Hub** (`src/app/admin/finance/contracts/ContractsClient.tsx`) into a modern, workflow-centric, high-converting CRM experience. 

It implements the design specified in `docs/billing/ui_enhancement/agreements_hub_enhancement.md`, aligns directly with the UI mockup, and strictly conforms to all standards and safeguards established in [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md):
1. **Core 10 Engineering Rules:** Strict adherence to Next.js / Vercel best practices, Emil Kowalski tactile animations, frontend/backend design patterns, zero `any`/`any[]` typing, failure mode analysis, mobile-first design with everyday UI English, security/load resilience, and maintainer guidance comments.
2. **Agentic & Action Layer Rules:** Strict two-phase execution (Plan $\rightarrow$ Preview $\rightarrow$ Approve $\rightarrow$ Execute), TOCTOU concurrency checks, deterministic idempotency keys, non-delegable privileges, human-in-the-loop review, and backoffice configuration.
3. **Information Architecture Modernization:** 4 logical workflow hubs (`Contracts`, `Templates`, `Obligations`, `Insights`) + an authorized `Administration` menu (`Governance`, `Migration`, `Developer Tools`).
4. **Noise-Free Institutional Register & Dual-Mode UI:** Desktop table with compact assignees and clean badges, paired with a touch-friendly mobile card layout (`min-h-[44px]` touch targets, horizontal filter chips, and responsive bottom bar).
5. **Theme Preservation:** Retains the existing minimalistic blue-and-white theme (`bg-background`, `bg-card`, `text-primary`, `border-border/80`, shadcn tokens) and preserves all 12+ pre-existing modals, tabs, and drawers without functional regression.

---

## 1. Compliance Matrix with `agents_mcp_rules.md`

| Rule from `agents_mcp_rules.md` | Architectural Compliance & Safeguards |
| :--- | :--- |
| **Rule 1: Best Practices & Zero Regression** | Adheres to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations` (`active:scale-[0.97]`), `frontend-design`, and `backend-design`. All 12+ existing modals (Wizard, Lifecycle, Amendments, Envelopes, Legal Hold, Redline, Copilot, Purge) are retained. |
| **Rule 2: Failure Mode Analysis & Clean Code** | Rigorous "What could go wrong & how it is resolved" analysis for every phase. Zero TypeScript errors, zero ESLint warnings, local commits only (no push to origin until explicitly instructed). |
| **Rule 3: Backoffice & Affected Features** | Integrates configuration options for administrators to manage AI assistant prompts, threshold rules, and tab visibility directly in the backoffice without touching code. |
| **Rule 4: Zero `any` or `any[]` Typing** | Never use `any`, `any[]`, or unchecked casts. `unknown` used only at external trust boundaries and immediately validated via Zod schemas before entering domain logic. |
| **Rule 5: Rules & Deployment Staging** | Security rules and composite indexes are validated. No automated or premature production deployments. |
| **Rule 6: Dependencies & Context7** | Use Context7 MCP when researching any library/framework APIs. Dependencies verified and configured. |
| **Rule 7: Mobile-First & Everyday UI English** | Touch targets $\ge 44\text{px}$, responsive mobile card layout (not squeezed tables), everyday simple UI English, minimal text, no dense jargon. |
| **Rule 8: High Security Standards** | Strict multi-tenant workspace isolation (`workspaceId` and `workspaceIds`), permission checks (`canUser`), timing-safe operations, and prevention of XSS/IDOR. |
| **Rule 9: High-Load & Resource Governance** | Batch operations chunked (max 50 entities / batch), paginated entity queries via `useEntitySearch`, debounced search inputs, and prevention of memory/Firestore exhaustion. |
| **Rule 10: Maintainer Guidance Comments** | Explanatory comments in every modified/new file outlining what changed, why, caution areas for maintainers, and testability pointers. |
| **Rule 13: Trust Boundary Matrix** | Model-generated recommendations (gap analysis, drafted reminders) are treated as **untrusted suggestions** until validated. |
| **Rule 16: Agent Identity & RBAC** | All actions triggered from the AI Assistant or bulk action bar verify `workspaceId`, `userId`, and `canUser` permissions, logging actor metadata. |
| **Rule 17: Non-Delegable Privileges** | Contract deletion/purging (`canPurge`), legal hold releases, and administration actions can never be automatically executed by AI; they require explicit human interaction. |
| **Rule 18: Time-of-Check / Time-of-Use (TOCTOU)** | When AI suggests actions based on contract status (e.g. "needs preparation"), live entity and contract status are re-verified at execution time. |
| **Rule 19 & 20: Idempotency & Replay Protection** | Batch preparation and reminder triggers use deterministic idempotency keys (`prep_entity_${entityId}_${templateId}`). |
| **Rule 21 & 22: Two-Phase Action Model & Approval Binding** | All AI quick chips (`Find missing contracts`, `Prioritize overdue signatures`, `Draft a reminder`) follow `Plan -> Preview -> Approve -> Execute`. AI never sends messages or generates contracts autonomously. |
| **Rule 40 & 41: Audit Logging & Explainability** | Batch and AI-assisted actions are logged to `financial_audit_logs` / `audit_logs` with actor metadata and operational justification. |

---

## 2. Failure Mode Analysis ("What Could Go Wrong & How It Is Resolved")

| Potential Failure Mode | Severity | Root Cause | Architectural Resolution |
| :--- | :--- | :--- | :--- |
| **Accidental Autonomous Action Execution** | **CRITICAL** | AI Assistant chips triggering mass contract generation or reminder messages without human review. | **Two-Phase Action Model (Rule 21):** AI chips only apply filters or open preview modals/drawers (`ContractWizard`, `ReminderSettingsDrawer`). No mutation occurs without an explicit "Confirm" click by the human user. |
| **TOCTOU Concurrency Desynchronization** | **HIGH** | User initiates a batch contract preparation for 10 entities, but another user or webhook already prepared or signed one of them. | **State Re-verification at Execution (Rule 18):** Before executing the batch mutation, query latest contract status for all selected entities; skip and report any entities whose status changed. |
| **Resource Exhaustion on Bulk Selection** | **HIGH** | Selecting "All Unprepared" across 5,000 schools and firing 5,000 parallel Firestore writes. | **Chunked Batch Processing (Rule 9 & 23):** Cap batch operations at 50 entities per run with progress indicators and rate-limiting. |
| **Mobile UX Breakdown on Large Tables** | **MEDIUM** | Attempting to fit 6 table columns onto a 375px mobile viewport leading to horizontal scroll frustration or clipped content. | **Dual-Mode Rendering (Rule 7):** Render an optimized `Table` on desktop (`hidden sm:block`) and a touch-friendly `CardList` on mobile (`sm:hidden`) with `min-h-[44px]` touch targets. |
| **Typing Degradation / Any-Leakage** | **MEDIUM** | Loose entity contacts, assignee objects, or AI responses typed as `any`. | **Strict Type Contracts (Rule 4):** Define explicit types (`AgreementsKpiStats`, `InstitutionListItem`, `AiRecommendationPayload`) with zero `any` or `any[]`. |

---

## 3. Backoffice & Affected Features Matrix (Rule 3)

| Affected Subsystem | Impact of Enhancement | Backoffice Management Capability (Without Code Changes) |
| :--- | :--- | :--- |
| **Contract Wizard & Lifecycle** | Integrated with new CTA and row clicks | Managed via existing template settings and contract lifecycle protocols. |
| **Bulk Campaigns & Compliance** | Re-routed as a sub-view within `Contracts` tab | Accessible via secondary tab trigger `Bulk Actions` inside the Contracts view. |
| **Administration Modules** | Relocated into `Administration ⌄` dropdown | Role-based visibility configured via workspace permissions (`system_admin` or `admin_role`). |
| **AI Contract Assistant** | Provides contextual chips for gaps and reminders | Configurable via `Reminder Settings` drawer and workspace dunning policies. |

---

## 4. Proposed Component Architecture

```
src/app/admin/finance/contracts/
├── page.tsx                                  # Server Entry (Unchanged)
├── ContractsClient.tsx                       # Main Orchestrator (Refactored layout & tabs)
└── components/
    ├── AgreementsHubHeader.tsx               # (NEW) Title, workspace info & action triggers
    ├── AgreementsKpiGrid.tsx                 # (NEW) 4-metric responsive KPI cards with trends
    ├── AgreementsAiAssistantBanner.tsx       # (NEW) Contextual AI recommendations & quick chips
    ├── AgreementsFilterBar.tsx               # (NEW) Search, Status/Assignee selects, bulk action bar
    ├── AgreementsDesktopTable.tsx            # (NEW) Desktop table with compact assignees & badges
    ├── AgreementsMobileCardList.tsx          # (NEW) Touch-first card layout for mobile viewports
    ├── AgreementsAdminMenu.tsx               # (NEW) Dropdown for Governance, Migration, Dev SDK
    ├── BulkCampaignsTab.tsx                  # (PRESERVED) Contracts -> Bulk actions
    ├── TemplateCatalogTab.tsx                # (PRESERVED) Templates section
    ├── ObligationsSummaryTab.tsx             # (PRESERVED) Obligations section
    ├── ContractsAnalyticsTab.tsx             # (PRESERVED) Insights section
    ├── EnterpriseGovernanceTab.tsx           # (PRESERVED) Administration -> Governance
    ├── MigrationCutoverTab.tsx               # (PRESERVED) Administration -> Migration
    ├── DeveloperPlatformTab.tsx              # (PRESERVED) Administration -> Developer Tools
    └── [Modals & Drawers]                    # (PRESERVED) All 12+ lifecycle & action modals
```

---

## 5. Phase-by-Phase Implementation Plan

### Phase 1: Navigation Architecture & Section Restructuring [COMPLETED & VERIFIED]
**Status:** Completed & Architect-Verified (Commits: `d56bb1be` & `bb3a2e1a`)
**Deliverables:**
* Created `AgreementsHubNav.tsx` with 4 workflow hubs (`Contracts`, `Templates`, `Obligations`, `Insights`), `Administration ⌄` dropdown (RBAC gated), and `Bulk Campaigns` sub-view toggle.
* Created `AgreementsMobileBottomNav.tsx` with responsive fixed bottom dock and `min-h-[44px]` touch targets.
* Replaced legacy 8-tab `<TabsList>` in `ContractsClient.tsx` with zero functional regressions across all 12+ modals and sub-tabs.
* Applied code review remediations: content-level RBAC guard on administration tabs, floating bulk bar elevated on mobile, workspace switch resets, and strict typing.

---

### Phase 2: Redefined, Actionable KPI Cards [COMPLETED & VERIFIED]
**Status:** Completed & Verified (Commit: `38d06c77`)
**Deliverables:**
* Created `AgreementsKpiGrid.tsx` with 4 standardized, mockup-aligned metrics: Total Institutions, No Contract, Awaiting Signature, and Active Contracts.
* Implemented bidirectional interactive one-click filter toggling and active ring/border styling.
* Designed mobile-first 2x2 grid with `min-h-[104px]` touch targets and Emil Kowalski `active:scale-[0.97]` animations.
* Added skeleton shimmer loading state and bounded arithmetic safeguards (`Math.max(0, ...)`).
* Reset status filter to `'all'` on workspace change (Rule 50).
* Cleaned up legacy `StatCard` function and unused imports. Typecheck and ESLint passed with 0 errors.

* **2.1. Metric Calculation Engine:**
  * **Total Institutions:** Current scope count (`totalEntities` from Firestore `workspace_entities`) + trend (`↑ +12%` vs last 30 days).
  * **No Contract:** Institutions without active contracts (`Needs preparation`) + trend (`↓ -6%` vs last 30 days).
  * **Awaiting Signature:** Contracts in `sent` state (`Pending completion`) + trend (`↑ +8%` vs last 30 days).
  * **Active Contracts:** Completed / signed contracts (`Active`) + trend (`↑ +15%` vs last 30 days).
* **2.2. Responsive Grid Layout (`AgreementsKpiGrid.tsx`):**
  * Desktop (`lg:grid-cols-4`): 4 horizontal cards with iconography, primary value, trend badge, and sub-label.
  * Tablet (`sm:grid-cols-2 lg:grid-cols-4`): 2x2 grid.
  * Mobile (`grid-cols-2`): Compact 2x2 grid with everyday UI English, clear values, and `min-h-[104px]` touch targets (`active:scale-[0.97]`).
* **2.3. Interactive Click-to-Filter Binding & Toggling:**
  * Clicking "No Contract" card toggles `statusFilter` between `'no_contract'` and `'all'`.
  * Clicking "Awaiting Signature" card toggles `statusFilter` between `'sent'` and `'all'`.
  * Clicking "Active Contracts" card toggles `statusFilter` between `'signed'` and `'all'`.
  * Clicking "Total Institutions" card resets `statusFilter` to `'all'`.
  * Active cards receive an active ring/border and an active status badge.
* **2.4. Failure Mode Safeguards & Accessibility (Rules 2, 4, 7):**
  * Strict typing (`AgreementsKpiStats`, `AgreementsKpiGridProps`).
  * Skeleton shimmer loader on initial load (CLS = 0).
  * Semantic ARIA attributes (`role="button"`, `aria-pressed`, `tabIndex={0}`, keyboard `Enter`/`Space` handlers).

---

### Phase 3: Contextual AI Contract Assistant Action Layer [COMPLETED & COMMITTED]
**Status:** ✅ Completed & Committed (Commit: `83eb56c2`)
**Goal:** Introduce an AI-assisted action layer directly above the institutional register that surfaces gaps, suggests follow-ups, and drafts reminders with human review.

* **3.1. Desktop AI Assistant Hero Banner (`AgreementsAiAssistantBanner.tsx`):**
  * Soft blue/indigo themed card with bot avatar, header: *"AI Contract Assistant"*, and subtitle: *"Find gaps, prioritize follow-ups or prepare a draft from an approved template."*
  * Quick-action chips:
    * `[Find missing contracts]`: Automatically filters to institutions without contracts (`statusFilter = 'no_contract'`) and highlights the batch preparation workflow.
    * `[Prioritize overdue signatures]`: Filters to `sent` contracts (`statusFilter = 'sent'`) and sorts by oldest pending signatures.
    * `[Draft a reminder]`: Contextually opens the `ReminderSettingsDrawer` for user review and customization before dispatch.
  * Direct action trigger button (blue circular arrow button) opening the comprehensive AI analysis drawer.
* **3.2. Mobile AI Assistant Compact Card & Action Sheet (`AgreementsAiActionSheet.tsx`):**
  * Compact card with bot icon, concise everyday UI English, and a right chevron `>` that expands into an accessible bottom sheet on tap.
  * Tactile mobile action cards (`min-h-[56px]`, `active:scale-[0.97]`).
* **3.3. Human-in-the-Loop Safeguards (Rules 13, 16, 17, 21, 22):**
  * All AI chips route strictly through a two-phase model (`Plan -> Preview -> Approve -> Execute`).
  * AI quick chips only preview filters or open interactive drawers (`ReminderSettingsDrawer`, `ContractWizard`); legally consequential mutations require explicit human review and click confirmation.
  * Prompt outputs treated as untrusted data (escaped React text nodes, no XSS).
  * Strict typing (`AiAssistantActionKey`, `AgreementsAiAssistantBannerProps`, `AgreementsAiActionSheetProps`).

---

### Phase 4: Unified Filter & Contextual Bulk Action Bar [COMPLETED & COMMITTED]
**Status:** ✅ Completed, Architect-Verified (Grade A+) & Committed (Commits: `eacacaf3` & `65e70910`) — Full specification in `docs/billing/ui_enhancement/phase_4_filter_and_bulk_bar_plan.md`
**Goal:** Streamline searching and filtering while replacing clunky "Select All Unprepared" buttons with standard checkboxes and a contextual action bar.

* **4.1. Desktop Filter Controls (`AgreementsFilterBar.tsx`):**
  * Unified search input with placeholder: *"Search by institution name, contract ID or representative..."* with 250ms debounce and clear button.
  * **Status Select Dropdown:** `All Institutions`, `No Contract (Unprepared)`, `Draft Contracts`, `Awaiting Signature`, `Active Contracts`, `Expiring Soon (< 60d)`.
  * **Assigned Representative Select Dropdown:** `All Representatives`, `Unassigned`, or specific sales representative / manager.
  * **Advanced Filters Popover:** Zone / Region multi-select, Legal Hold status (`all`, `on_hold`, `not_on_hold`), with active filter count badge.
  * **Reset All Filters Button:** Displayed whenever active filters or search terms are present.
  * **Primary Action CTA:** `+ New Contract` button (`bg-primary text-white shadow-sm active:scale-[0.97] rounded-xl`).
* **4.2. Mobile Horizontal Filter Chips (`AgreementsMobileFilterChips.tsx`):**
  * Smooth horizontal scrollable chip row on mobile (`sm:hidden`): `[All (count)]`, `[No Contract (count)]`, `[Awaiting Signature (count)]`, `[Active (count)]`, `[Draft (count)]`, `[Expiring Soon (count)]`, `[+ More Filters]`.
  * Touch target compliance: `min-h-[44px]`, `active:scale-[0.95]`.
* **4.3. Contextual Bulk Action Bar (`AgreementsBulkActionBar.tsx`):**
  * Dynamically floats above bottom dock when $\ge 1$ institutions are selected:
    * Desktop: `fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]`.
    * Mobile: `fixed bottom-20 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40` (safely clear of mobile bottom dock).
  * **Selection Counter Badge:** `ShieldCheck` icon + `Selected {N} of {total} institutions`.
  * **Action Buttons:**
    * Button: *"Prepare contracts ({N})"* — triggers `ContractWizard` (batch size capped at 50 entities per run per Rule 23).
    * Button: *"Send Batch Reminders"* — triggers reminder outreach flow for pending contracts.
    * Button: *"Export Selection"* — downloads sanitized CSV protected against spreadsheet formula injection (Rule 8).
    * Button: *"Clear"* — 1-click deselect.
* **4.4. Full `agents_mcp_rules.md` Compliance:**
  * Two-phase mutation guard (Rule 21), TOCTOU concurrency check (Rule 18), chunked batch limits (Rule 23), formula injection sanitization (Rule 8), zero `any` typing (Rule 4), and performance memoization (Rule 54).

---

### Phase 5: Institution Register Visual Noise Reduction & Responsive Dual-Mode [COMPLETED & COMMITTED]
**Status:** ✅ Completed, Architect-Verified (Grade A, 96/100) & Committed (Commits: `bbf2a104` & `2ea93e75`)
**Goal:** Deliver a crystal-clear desktop institution register and an optimized touch-first mobile card list that eliminates visual clutter, surfaces actionable status badges and compact assignees, supports one-tap lifecycle review, and adheres strictly to `docs/agents_mcp/agents_mcp_rules.md` and `.agents/AGENTS.md`.

* **5.1. Standardized Status Pill Badge (`AgreementsStatusBadge.tsx`):**
  * Single source of truth for contract lifecycle status rendering across desktop table and mobile cards.
  * Statuses: `Active` (`signed` - emerald/shield), `Awaiting Signature` (`sent` - blue/clock), `Draft` (`draft` - purple/edit), `No Contract` (`no_contract` - amber/alert), `Expiring Soon` (`expiring` - orange/triangle), `Expired` (`expired` - rose/x).
  * Variants: `default` (desktop table) and `compact` (mobile cards).
* **5.2. Desktop Institution Table (`AgreementsDesktopTable.tsx` - `hidden sm:block`):**
  * **Institution Column:** Initials avatar with brand accent + Institution Display Name + Zone/City in clean subtle text + Legal Hold preservation indicator.
  * **Contract Status Column:** Standardized `<AgreementsStatusBadge>`.
  * **Last Update Column:** Formatted date (`formatSafeDate(date, 'MMM d, yyyy')`) + relative time (`formatSafeRelativeTime(date)` -> `"2 days ago"`).
  * **Assigned Representative Column:**
    * If assigned: Initials avatar badge + Representative Full Name (bold) + Role/Email in subtle text.
    * If unassigned: Clean, compact `— Not assigned` in muted text (no repeated italic labels).
  * **Management Column:** Quick action buttons (`Copy Signing Link`, `View Signing Page`) + Three-dot `...` dropdown menu retaining all 10+ agreement protocols.
  * **Interactive Row Click:** Clicking anywhere on the row opens `ContractLifecycleDetailModal` (or `ContractWizard` if uncontracted) with `e.stopPropagation()` on controls.
  * **States:** 5-row skeleton shimmer loader (CLS = 0), clean empty state with clear filters button, and load more pagination bar.
* **5.3. Mobile Institution Card List (`AgreementsMobileCardList.tsx` - `sm:hidden`):**
  * Standalone tactile cards with `min-h-[44px]` touch targets and Emil Kowalski `active:scale-[0.99]` animations.
  * Card header: Touch checkbox (`min-h-[44px] min-w-[44px]`), initials icon, institution name + zone, and three-dot action menu.
  * Card body: Compact status badge + Last updated date with relative time.
  * Card footer: Assigned representative chip and right chevron `ChevronRight` tap target opening `ContractLifecycleDetailModal`.
  * Mobile-specific skeleton shimmer cards and empty state.
* **5.4. Full `agents_mcp_rules.md` Compliance & Remediations:**
  * Strict typing (Rule 4), mobile optimization with `min-h-[44px]` targets (Rule 7), defensive date parsing without throwing (Rule 2), RBAC permission gating (Rules 16 & 17), tenant isolation (Rule 50), and performance memoization (Rule 54).
  * Remediations applied: keyboard event bubbling guard (`onKeyDown` stopPropagation), $44 \times 44\text{px}$ touch targets, shared `getInitials` utility, and native `title` attribute for text truncation.

---

### Phase 6: Code Quality, Testing, Verification & Integration [COMPLETED & VERIFIED]
**Status:** ✅ Completed, Verified & Validated across all 6 Phases
**Goal:** Verify full end-to-end functionality, strict typing, responsive behavior, cross-modal preservation, and performance budgets across all 5 completed phases.

* **6.1. Comprehensive Verification Matrix:**
  * **Strict Typing Audit:** Zero `any` or `any[]` typing across the entire vertical (`WithdrawContractModal.tsx` strictly typed with `LegalRecordSubmission`, `Contract` updated with `workspaceId?: string`, `ContractsClient.tsx` sanitized).
  * **Zero Functional Regression:** Verified that all 12+ pre-existing contract modals/drawers (`ContractWizard`, `ContractLifecycleDetailModal`, `CreateAmendmentModal`, `CreateObligationModal`, `ReminderSettingsDrawer`, `DocumentAiCopilotDrawer`, `ContractClauseDiffModal`, `ObligationReviewModal`, `LegalHoldManagerModal`, `EnvelopeDetailModal`, `WithdrawContractModal`, and Purge `AlertDialog`) and all 7 sub-tabs mount, function, and pass context cleanly.
  * **Multi-Viewport Responsive Verification:** Desktop (1440px), Laptop (1024px), Tablet (768px), Mobile (375px). All touch targets meet $\ge 44 \times 44\text{px}$ bounding box. Mobile floating bulk action bar safely docked at `bottom-20`, clearing `bottom-0 h-16` mobile navigation dock.
  * **Emil Kowalski Tactile Animations:** `active:scale-[0.97]` on tactile buttons and `active:scale-[0.99]` on mobile cards with smooth transitions.
  * **Security & Batch Governance:** CSV export protected against formula injection (`sanitizeCell` prepending `'` to `=`, `+`, `-`, `@`, `\t`, `\r` per Rule 8). Client batch preparation capped at 50 entities per run (Rule 23). Non-delegable RBAC permissions (`canPurge`, `canAccessAdmin`) enforced.
* **6.2. Automated Audits & Smoke Tests:**
  * ESLint audit: `0 errors, 0 warnings` across `src/app/admin/finance/contracts/`.
  * TypeScript verification: zero errors in `src/app/admin/finance/contracts/`.
  * Master walkthrough documented in `docs/billing/ui_enhancement/walkthrough.md`.

---

## 6. Verification Summary

### Automated Type & Lint Verification
* `npx eslint src/app/admin/finance/contracts/` → **PASSED (0 errors, 0 warnings)**
* `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` → **PASSED in contracts vertical**

### Visual & Interactive Review
1. 4-tab bar (`Contracts`, `Templates`, `Obligations`, `Insights`) and Administration dropdown toggle sub-views cleanly.
2. 4 KPI cards filter the institutional register with bidirectional 1-click toggling.
3. AI Assistant quick action chips execute intended filter workflows with human-in-the-loop review.
4. Responsive dual-mode displays tabular register on desktop and tactile cards on mobile.
5. All 12+ modals and drawers mount, trigger, and preserve context with zero regression.
