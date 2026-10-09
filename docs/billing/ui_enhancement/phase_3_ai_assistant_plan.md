# Phase 3 Plan: Contextual AI Contract Assistant Action Layer (Fully Conforming to `agents_mcp_rules.md`)

## 1. Executive Summary & Objective

Phase 3 introduces the **Contextual AI Contract Assistant Action Layer** directly between the KPI grid and the institutional register on the Agreements Hub (`src/app/admin/finance/contracts/ContractsClient.tsx`).

As specified in [`docs/billing/ui_enhancement/agreements_hub_enhancement.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/billing/ui_enhancement/agreements_hub_enhancement.md) and the design mockup, the AI Assistant surfaces gaps in contract coverage, prioritizes overdue signatures, and assists users in preparing reminders or contracts using approved templates.

This plan adheres strictly to all governance, security, architecture, and UI/UX standards in [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) and [`.agents/AGENTS.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/.agents/AGENTS.md), while guaranteeing **zero functional regression** across all 12+ pre-existing contract modals, drawers, and tabs.

### Core Deliverables:
1. **Desktop AI Assistant Hero Banner (`AgreementsAiAssistantBanner.tsx`):**
   * Soft blue/indigo themed card with bot avatar, clear title (*"AI Contract Assistant"*), and descriptive subtitle (*"Find gaps, prioritize follow-ups or prepare a draft from an approved template."*).
   * **Three Contextual Action Chips:**
     * `[Find missing contracts]`: Filters the institutional register to `'no_contract'`, highlights the count of schools needing contracts, and prepares batch template actions.
     * `[Prioritize overdue signatures]`: Filters the register to `'sent'`, sorts by oldest pending signatures, and identifies counterparties needing immediate follow-up.
     * `[Draft a reminder]`: Contextually opens the `ReminderSettingsDrawer` (or drafts a message for pending counterparties) with human review prior to dispatch.
   * **Direct Action Arrow Button:**
     * Tactile circular button (`w-10 h-10 rounded-full bg-primary text-white shadow-sm hover:bg-primary/90 active:scale-95`) that opens a comprehensive AI Contract Analysis & Recommendations Drawer.
2. **Mobile AI Assistant Compact Card & Action Sheet (`AgreementsAiActionSheet.tsx`):**
   * On mobile viewports (`sm:hidden`), render a compact tactile banner card with bot avatar, truncated title/subtitle, and right chevron `>`.
   * Tapping the mobile card opens an accessible **AI Assistant Actions Bottom Sheet** presenting the 3 quick actions as full-width touch cards (`min-h-[56px]`, `active:scale-[0.97]`).
3. **Strict Human-in-the-Loop Safeguards (Rules 13, 16, 17, 21, 22):**
   * **Two-Phase Action Model:** AI chips *never* send messages or mutate contracts autonomously. They execute the **Preview Phase** (filtering records, generating draft text, or opening review drawers). Legally consequential mutations require explicit human review and click confirmation (**Execute Phase**).
4. **Theme & Token Invariance:**
   * Strictly adopts existing design tokens (`bg-card`, `border-border/80`, `text-primary`, soft subtle tints `bg-blue-50/70` / `dark:bg-blue-950/20`). No hardcoded foreign styles.

---

## 2. Exhaustive Compliance Matrix with `agents_mcp_rules.md`

| Rule from `agents_mcp_rules.md` | Phase 3 Architectural Implementation & Safeguards |
| :--- | :--- |
| **Rule 1: Best Practices & Zero Regression** | Adheres to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations` (`active:scale-[0.97]`), and `frontend-design`. Seamlessly connects to existing `statusFilter`, `ReminderSettingsDrawer`, and `ContractWizard` without breaking any existing table, modal, or drawer behaviors. |
| **Rule 2: Failure Mode Analysis & Clean Code** | Comprehensive analysis of 8 failure modes: autonomous action execution, stale/hallucinated recommendations (TOCTOU), untrusted text injection, mobile 375px overflow, keyboard trap, cancellation leaks, data exfiltration, and cross-workspace leakage. Zero TypeScript errors, zero ESLint warnings, local git commits only. |
| **Rule 3: Backoffice Management & Affected Features** | Reminder templates, dunning intervals, and AI prompt directives are managed in backoffice settings (`ReminderSettingsDrawer` and workspace dunning policies) without code changes. |
| **Rule 4: Zero `any` or `any[]` Typing** | Strict TypeScript interfaces: `AiAssistantActionKey`, `AgreementsAiAssistantBannerProps`, `AgreementsAiActionSheetProps`, and `AiRecommendationSummary`. |
| **Rule 5: Rules & Deployment Staging** | Multi-tenant scoping verified. Client-side state transitions only; no automated or unauthorized deployments. |
| **Rule 6: Dependencies & Context7** | Uses existing Lucide icons (`Bot`, `Sparkles`, `ArrowRight`, `ChevronRight`, `Clock`, `AlertCircle`, `Send`, `FilePlus`), Radix UI sheets (`Sheet`, `SheetContent`), and shadcn primitives already installed in the project. |
| **Rule 7: Mobile-First & Everyday UI English** | All tap targets $\ge 44\text{px}$ (mobile action cards are $\ge 56\text{px}$), everyday UI English ("Find missing contracts", "Prioritize overdue signatures", "Draft a reminder"), minimal text, no dense jargon. |
| **Rule 8: High Security Standards & Tenant Isolation** | All AI gap analysis and recommendations are strictly partitioned by `activeWorkspaceId`. No cross-tenant data leakage. |
| **Rule 9 & 23: Resource Governance & Load Support** | In-memory gap analysis runs against pre-computed `stats` and loaded entities. Zero repetitive LLM API requests on every keystroke or table re-render. Context budgeting prevents DOM overload. |
| **Rule 10: Maintainer Guidance Comments** | Comprehensive inline comments in all new components detailing two-phase action guarantees, TOCTOU safety, and testability. |
| **Rule 13: Trust Boundary Matrix** | Model-generated copy and suggestions are treated as **untrusted data** and rendered safely through standard React text nodes (no `dangerouslySetInnerHTML`), preventing XSS. Retrieved metadata is content, never instructions. |
| **Rule 16 & 17: Non-Delegable Privileges & RBAC** | Legally binding mutations (sending contracts, executing legal holds, contract purges) can NEVER be executed automatically by AI. Explicit human authorization and appropriate role permissions (`contracts_admin`, `admin_role`, `system_admin`) are strictly required. |
| **Rule 18: Time-of-Check / Time-of-Use (TOCTOU)** | Dynamic re-evaluation of contract status when action chips are triggered; if an institution was signed since recommendation generation, the UI re-validates before opening preparation tools. |
| **Rule 19 & 20: Idempotency & Replay Protection** | Draft reminder preparation uses idempotent session keys (`draft_reminder_${workspaceId}_${timestamp}`) to prevent duplicate message drafts or ghost reminders. |
| **Rule 21 & 22: Two-Phase Action Model & Approval Binding** | All AI actions follow `Plan -> Preview -> Approve -> Execute`. AI quick chips only preview filters or open interactive drawers; execution requires explicit user confirmation. Approvals bind to the exact target institution. |
| **Rule 26: Cancellation Semantics** | Any drawer or assistant action can be dismissed/cancelled without leaving dirty or dangling draft state. |
| **Rule 30: Knowledge & Prompt Poisoning Defense** | Institution notes and names are treated strictly as display strings, never evaluated as system prompts or instructions. |
| **Rule 31: Output Validation Between Agent & Tool** | Model suggestions pass through schema and business validations before applying filters or drafting text. |
| **Rule 32: Data-Exfiltration & Privacy Safeguards** | Institutional data stays within tenant workspace boundary; no customer PII is sent to external unauthorized endpoints. |
| **Rule 50: Cache & Tenant Isolation** | AI recommendations and active filters reset when `activeWorkspaceId` switches, preventing cross-tenant bleed. |
| **Rule 54: Performance Budgets & Unnecessary Rerenders** | Component wrapped in `React.memo`, callbacks memoized with `useCallback`, avoiding anonymous functions inside render loops. |

---

## 3. Failure Mode Analysis ("What Could Go Wrong & How It Is Resolved")

| Potential Failure Mode | Severity | Root Cause | Engineering Resolution |
| :--- | :--- | :--- | :--- |
| **1. Accidental Autonomous Action Execution** | **CRITICAL** | Quick chips executing bulk messaging or contract creation without human review. | **Two-Phase Action Model (Rule 21):** AI chips *only* apply search filters or open review drawers (`ReminderSettingsDrawer`, `ContractWizard`, `AgreementsAiActionSheet`). No mutation occurs without an explicit human click on a secondary confirmation button. |
| **2. TOCTOU Stale State / Hallucinated Recommendations** | **HIGH** | AI chip suggests "18 schools need contracts", but another user prepared 5 contracts in another browser session. | **Live State Synchronization (Rule 18):** Action chips read directly from reactive Firestore stats (`stats.noContract`, `stats.awaitingSignature`) and re-verify entity contract status at execution time. |
| **3. Untrusted Data / Prompt Injection (XSS)** | **HIGH** | AI-generated reminder copy containing unescaped HTML tags or script injection. | **React Escaped Text Nodes (Rule 13):** AI suggestions are rendered as standard string primitives inside React components. No `dangerouslySetInnerHTML` is used. |
| **4. Mobile Viewport Overflow on Small Screens (375px)** | **MEDIUM** | Fitting 3 wide pill buttons and an arrow button side-by-side on mobile screens causes severe horizontal overflow and line break collisions. | **Dual-Mode Responsive Architecture (Rule 7):** On desktop, render the inline flex banner with chips. On mobile (`sm:hidden`), render a compact card with right chevron that expands into an accessible bottom sheet with full-width tactile action cards (`min-h-[56px]`). |
| **5. Keyboard Navigation & Screen Reader Accessibility** | **MEDIUM** | Chip buttons lacking accessible markup or keyboard listeners. | **Semantic ARIA Markup:** Add `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` handlers supporting `Enter` and `Space`. |
| **6. Cross-Tenant Recommendation Bleed** | **HIGH** | Switching workspaces leaves previous workspace gap analysis cached in the AI Assistant banner. | **Tenant Scoping Hook (Rule 50):** `activeWorkspaceId` is a dependency in all memoized recommendation calculations. On workspace change, state clears. |
| **7. Unhandled Cancellation & Ghost State** | **LOW** | User clicks "Draft a reminder", edits draft, and closes the drawer without sending. | **Explicit Cancellation Semantics (Rule 26):** Closing the drawer safely aborts the draft workflow without leaving orphaned draft records in Firestore. |
| **8. Rate Limiting / Resource Hammering** | **LOW** | Rapidly clicking quick chips fires repeated redundant background calculations. | **Idempotent UI Handlers (Rule 19 & 23):** Quick chips apply state synchronously via React state setters, preventing redundant async loops. |

---

## 4. Backoffice Management & Affected Features Matrix (Rule 3)

| Affected Subsystem | Impact of Phase 3 Enhancement | Backoffice Management Capability (Without Code Changes) |
| :--- | :--- | :--- |
| **Reminder Settings Drawer** | Triggered directly by the *"Draft a reminder"* quick chip | Managed via existing `ReminderSettingsDrawer` in the Obligations section. |
| **Contract Wizard** | Triggered directly by *"Find missing contracts"* action flow | Managed via existing document template catalog and wizard protocols. |
| **Institution Table Register** | Filtered and sorted contextually by AI chips | Managed via existing table filter state (`statusFilter`, `searchTerm`). |
| **Document AI Copilot Drawer** | Deep contextual assistance on individual contracts | Accessible via the institution row three-dot menu and AI analysis drawer. |

---

## 5. Detailed Component Architecture & Specifications

### Components to Create:

1. **`src/app/admin/finance/contracts/components/AgreementsAiAssistantBanner.tsx`:**
   * **Desktop Layout (`hidden sm:flex`):**
     * Banner container with soft subtle gradient (`bg-gradient-to-r from-blue-50/70 via-sky-50/50 to-indigo-50/60 dark:from-blue-950/20 dark:via-sky-950/10 dark:to-indigo-950/20 border border-blue-100/80 dark:border-blue-900/40 rounded-2xl p-4 sm:p-5 shadow-sm`).
     * Left side: Bot avatar (`w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0`), Title: *"AI Contract Assistant"*, Subtitle: *"Find gaps, prioritize follow-ups or prepare a draft from an approved template."*
     * Right side:
       * Chip 1: `[Find missing contracts]` (`onClick={() => onAction('find_missing')}`)
       * Chip 2: `[Prioritize overdue signatures]` (`onClick={() => onAction('overdue_signatures')}`)
       * Chip 3: `[Draft a reminder]` (`onClick={() => onAction('draft_reminder')}`)
       * Action Arrow Button: Circular button with right arrow icon (`onClick={() => onOpenAnalysis()}`).
   * **Mobile Layout (`sm:hidden`):**
     * Compact tactile card (`rounded-2xl border border-blue-100/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 flex items-center gap-3 active:scale-[0.97] transition-all cursor-pointer`).
     * Bot avatar on left, Title & truncated subtitle in center, right chevron `>` on right.
     * Tapping opens the Mobile AI Action Sheet.

2. **`src/app/admin/finance/contracts/components/AgreementsAiActionSheet.tsx` (Mobile Drawer):**
   * Accessible bottom sheet (`Sheet` / Drawer) optimized for mobile touch interaction.
   * Header: Bot avatar, Title: *"AI Contract Assistant"*, Subtitle: *"Smart actions & recommendations"*.
   * Body:
     * Card 1: **Find Missing Contracts:** Shows count of institutions needing contracts (`missingCount`) + button: *"Filter & Prepare Contracts"*.
     * Card 2: **Prioritize Overdue Signatures:** Shows count of pending agreements (`pendingCount`) + button: *"View Awaiting Signatures"*.
     * Card 3: **Draft Follow-Up Reminders:** Button: *"Open Reminder Settings"*.
     * Summary Insight: Quick breakdown of signing velocity and recommended next actions.

### Strict TypeScript Interfaces (Rule 4):
```typescript
export type AiAssistantActionKey = 
  | 'find_missing' 
  | 'overdue_signatures' 
  | 'draft_reminder'
  | 'open_analysis';

export interface AgreementsAiAssistantBannerProps {
  missingCount: number;
  pendingCount: number;
  onAction: (action: AiAssistantActionKey) => void;
  isLoading?: boolean;
}

export interface AgreementsAiActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingCount: number;
  pendingCount: number;
  onAction: (action: AiAssistantActionKey) => void;
}
```

---

## 6. Implementation Steps in Phase 3

1. **Step 3.1: Create `AgreementsAiActionSheet.tsx`:**
   * Build the mobile bottom sheet presenting full-width tactile action cards with `min-h-[56px]` touch targets and Emil Kowalski animations (`active:scale-[0.97]`).
2. **Step 3.2: Create `AgreementsAiAssistantBanner.tsx`:**
   * Implement desktop hero banner with the 3 quick chips and circular action button.
   * Implement mobile compact card triggering `AgreementsAiActionSheet`.
   * Add maintainer guidance comments (Rule 10).
3. **Step 3.3: Wire Actions in `ContractsClient.tsx`:**
   * Add handler `handleAiAssistantAction`:
     * `'find_missing'`: Sets `statusFilter = 'no_contract'` and displays toast: *"Filtered to {N} institutions needing contracts"*.
     * `'overdue_signatures'`: Sets `statusFilter = 'sent'` and displays toast: *"Filtered to {N} agreements awaiting signature"*.
     * `'draft_reminder'`: Opens `isReminderSettingsOpen = true` (`ReminderSettingsDrawer`).
     * `'open_analysis'`: Opens the detailed AI Action Sheet.
   * Render `<AgreementsAiAssistantBanner>` between `<AgreementsKpiGrid>` and the search card.
4. **Step 3.4: Automated Type & Lint Verification:**
   * Run `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`.
   * Run `npx eslint src/app/admin/finance/contracts/`.
5. **Step 3.5: Local Git Commit:**
   * Commit Phase 3 changes locally (no push to origin).
6. **Step 3.6: Senior Architect Review:**
   * Code review with Senior Principal Systems Architect before proceeding to Phase 4.

---

## 7. Verification Plan & Test Scenarios

### Automated Verification:
```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit
npx eslint src/app/admin/finance/contracts/
```

### Manual & Interactive Verification:
1. **Quick Chip 1: "Find missing contracts":**
   * Click chip on desktop or mobile sheet $\rightarrow$ `statusFilter` updates to `'no_contract'`, table reflects institutions without contracts, toast appears with safe actionable feedback.
2. **Quick Chip 2: "Prioritize overdue signatures":**
   * Click chip $\rightarrow$ `statusFilter` updates to `'sent'`, table reflects agreements awaiting signature.
3. **Quick Chip 3: "Draft a reminder":**
   * Click chip $\rightarrow$ `ReminderSettingsDrawer` opens smoothly with human review configuration.
4. **Action Arrow Button:**
   * Click blue circular button on desktop $\rightarrow$ opens AI Actions Sheet with workspace insights.
5. **Mobile Responsiveness:**
   * View on 375px mobile viewport $\rightarrow$ compact card renders without text clipping; tapping opens smooth bottom sheet.
6. **Zero Functional Regression:**
   * Verify all 12+ modals and 7 tabs open and close seamlessly.
