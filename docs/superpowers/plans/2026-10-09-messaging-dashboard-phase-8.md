# Messaging Dashboard Redesign — Phase 8: Master Orchestration, Modal Ecosystem Audit & Production Verification
## Comprehensive Implementation Plan (Conforming to `agents_mcp_rules.md` Rules 1–27, `theme.md` Section 8 & Roadmap Specifications)

> **Location:** `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-8.md`  
> **Status:** Pending User Approval  
> **Target Subsystems:** Messaging Master Client (`/admin/messaging`), Messaging Modals Ecosystem (`MessagingAiPromptModal`, `MessagingAllFeaturesModal`, `SafeguardBlastModal`, `TestDispatchDialog`), Real-Time Analytics, Quick Sidebar Utilities, Governed MCP Tools  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 27 from `docs/agents_mcp/agents_mcp_rules.md`), Workspace Rules (`.agents/AGENTS.md`), and `theme.md` Sections 4 & 8  
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION PHASE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `docs/agents_mcp/agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Alignment

### 1.1 Context & Roadmap Verification
We reviewed all architecture and roadmap specifications in `docs/messaging/`:
1. `docs/messaging/messaging_dashboard_redesign_plan.md`: The 8-phase master redesign plan for the SmartSapp Communications Hub. Phases 1 through 7 are complete, leaving **Phase 8: Master Orchestration, Testing & Verification** as the final assembly, production hardening, and quality assurance gate.
2. `docs/messaging/conversations_phases.md`: The 7-phase architecture for Unified Omnichannel Messaging Centre (Conversations 2.0).
3. `docs/messaging/conversations_prd.md` & `conversations_ui.md`: Operational standards emphasizing reliable 1-to-1 dispatch, failure recovery, conversation identity, and human-in-the-loop AI assistance.
4. **Recent Completed Milestones**:
   - Phase 1: Data Contracts, Schemas & Cached Backend Aggregator (`getMessagingDashboardSummaryAction`).
   - Phase 2: Flagship Hero Greeting & Interactive AI Prompt Modal (`MessagingHeroGreeting`, `MessagingAiPromptModal`).
   - Phase 3: Top 4-Card KPI Grid (`MessagingKpiGrid`, `MessagingKpiCard`).
   - Phase 4: Quick Actions Grid (`MessagingQuickActions`, `MessagingAllFeaturesModal`).
   - Phase 5: Right Sidebar Utilities (`QuickMessageComposerCard` with single-recipient anti-blast guard & Firestore idempotency, `QuickTemplatesCard`, `ActiveQueuesCard`, MCP tool `messaging.get_queue_stats`).
   - Phase 6: Dual Performance Analytics (`MessagingPerformanceCharts` with 24h/7d/30d time partitioning) & Conversations Preview (`MessagingInboxPreview` with category tabs & AI assistant bar, MCP tools `messaging.get_conversation_thread`, `messaging.suggest_reply`).
   - Phase 7: Backoffice Codeless Controls (`/admin/settings?tab=messaging` for quick templates, SMS balance alert threshold, custom prompt starters, channel kill-switches), Server-side pause enforcement (`CHANNEL_PAUSED`), and MCP tool `messaging.get_dashboard_summary`).
   - Conversations Overhaul: Right panel loading fix (`useMemoFirebase`), 3-line contact cards, collapsible panels, progressive lazy loading.

### 1.2 Phase 8 Core Objectives
Phase 8 delivers the **Grand Finale**:
1. **Master Orchestrator Assembly**: Harmonize all Phase 1–7 modular components in `MessagingClient.tsx` with error recovery, retry mechanics, and tenant hydration guards.
2. **Messaging Modal Ecosystem Audit (`theme.md` Section 8 SSOT)**: Standardize all messaging modals and dialogs (`MessagingAiPromptModal`, `MessagingAllFeaturesModal`, `SafeguardBlastModal`, `TestDispatchDialog`) to enforce demarcated headers, single-circle info tooltips (`CardInfoTooltip`), screen-reader-only descriptions (`sr-only`), and demarcated tactile footers.
3. **Legacy Query Eradication**: Verify that zero unbounded Firestore queries remain across the entire messaging root.
4. **Governed AI Copilot & MCP Tools Invariants**: Audit all 4 registered messaging MCP tools for 64-character SHA-256 schema hashing, fail-closed multi-tenancy, and Rule 19 human-in-the-loop approval gates.
5. **Theme, Accessibility & Mobile Viewport Audit**: Verify WCAG AA contrast across light and dark modes, enforce `tabular-nums` for zero Cumulative Layout Shift (CLS), verify `min-h-[44px]` touch targets, and validate sticky iOS bottom navigation (`MobileBottomNav`).

---

## 2. Comprehensive Compliance with `agents_mcp_rules.md` (Rules 1–27)

| Rule # | Rule Name | How Applied in Phase 8 |
| :--- | :--- | :--- |
| **Rule 1** | Industry-Grade Best Practices | Conforms to `next-best-practices` (clean client boundaries, metadata handling), `vercel-react-best-practices` (memoized calculations, zero layout thrashing), `emilkowal-animations` (tactile button press `active:scale-[0.97]`, smooth modal transitions), and `frontend-design` & `backend-design`. |
| **Rule 2** | Risk Analysis, Cleanliness & Scalability | Decomposed into modular units (< 250 lines per file). Strict Test-Driven Development (TDD) cycle. Zero unprompted remote git pushes. |
| **Rule 3** | Impact Analysis & Backoffice Enhancement | All dynamic dashboard configurations route through Backoffice Settings (`/admin/settings?tab=messaging`), preserving backwards compatibility with existing campaigns, templates, and call centre routes. |
| **Rule 4** | Strict Typing & Bounded `unknown` | Zero `any` or `any[]` throughout production and test code. `unknown` is bounded at trust boundaries and parsed immediately via Zod schemas. |
| **Rule 5** | Staging, Validation & Approval Gates | Explicit gate requiring user sign-off before implementation begins. |
| **Rule 6** | Dependency Integrity & Context7 | Strictly relies on verified dependencies (`lucide-react`, `date-fns`, `recharts`, `zod`, Radix UI). |
| **Rule 7** | Mobile-First Ergonomics & Everyday UI English | All touch targets meet `min-h-[44px]`. Sticky iOS-safe bottom navigation bar (`MobileBottomNav`) with safe-area padding (`pb-safe`). Crisp everyday UI English without engineering jargon. |
| **Rule 8** | High Security & Multi-Tenant Data Protection | Fail-closed multi-tenancy verified on all actions. Relative internal routing starting with single `/` (prohibiting CWE-601 open redirects). Input sanitization against XSS (CWE-79) and formula injection (CWE-1236). |
| **Rule 9** | High-Load Safety & Resource Protection | Legacy unbounded `useCollection` queries eliminated. Server-side data aggregator backed by in-memory TTL cache with bounded array allocations. |
| **Rule 10** | Inline Architectural Documentation & Pointers | Comprehensive JSDoc headers on all components explaining *why* they exist, caution areas for future maintainers, and testability hooks. |
| **Rule 11** | MCP Protocol Compliance | Adheres to current MCP specification and SDK standards. |
| **Rule 12** | Server-Side Risk Enforcement | All dispatch permissions, SMS balance checks, and kill-switches enforced on the server. |
| **Rule 13** | Trust Boundary Matrix | Separates `SYSTEM_TRUST` (route manifests, action constants) from `USER_UNTRUSTED` (composer inputs, search queries). |
| **Rule 14** | Tool Poisoning Defense | Exact 64-character SHA-256 `schemaHash` declarations across all messaging MCP tools. |
| **Rule 15** | Server Allowlisting & Supply-Chain Controls | All navigation targets strictly resolve to internal Next.js routes within the authenticated domain. |
| **Rule 16** | Agent Identity as First-Class Principal | Outbound dispatches log `actor: { type: 'agent' \| 'user', id, name }`. |
| **Rule 17** | Non-Delegable Privileges | Broadcast campaigns, billing top-ups, and credential rotation strictly require human interactive authentication. |
| **Rule 18** | TOCTOU Protection | Settings updates enforce atomic concurrency versioning (`version: number`). |
| **Rule 19** | Mutating Tool Idempotency & HITL Gates | Quick Composer strictly enforces 1-to-1 recipient validation (rejects commas, semicolons, newlines). AI suggestions strictly return draft propositions without autonomous send capability. |
| **Rule 20** | Replay Protection | Client request ID (`clientRequestId`) tracked in Firestore `quick_message_idempotency` with 24h TTL. |
| **Rule 21 & 24** | Circuit Breakers & Graceful Degradation | Degraded providers surface non-blocking status badges without crashing the dashboard. |
| **Rule 22** | Approval Binding | Send approvals are bound to the exact recipient target, channel, and message body. |
| **Rule 23** | Budget, Backpressure & Resource Governance | 3500ms timeout bounds on external calls; 160-char SMS segment counter. |
| **Rule 25** | Dead-Letter Queue Visibility | `ActiveQueuesCard` surfaces failed message counts with a 1-click shortcut to inspect failure reasons. |
| **Rule 26** | Cancellation Semantics | Clean unmounts, abort controller handling on async loads. |
| **Rule 27** | Formal Saga / Compensation Model | Preserves message body on send failures; actionable retry toasts with safe relative paths. |

---

## 3. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Modal Design Drift & Raw Text Leaks** | Modals rendering raw description text directly under titles, or using hardcoded slate/navy background colors. | Inconsistent styling, visual clutter, violation of `theme.md` Section 8. | **Modal SSOT Audit (Task 2)**: Enforce `<DialogHeader demarcated>`, `<CardInfoTooltip>` single-circle, `sr-only` descriptions, and semantic tokens (`bg-card`, `border-border/80`). |
| **Accidental Multi-Recipient Blast from Quick Composer** | Staff typing comma-separated phone numbers into the quick message box on the dashboard. | Unintended broadcast, SMS credit burn, compliance breach. | **Rule 19 Anti-Blast Guard**: Quick Composer strictly rejects multi-recipient inputs (detects commas, semicolons, or newlines) and guides users to the Campaign Wizard. |
| **Hydration Mismatch on Dynamic Greeting** | Server renders "Good morning" while client is in evening time zone. | React hydration error #418, UI flickering. | **Client-Hydrated Mounting State**: Time-of-day greeting calculation is calculated client-side with clean SSR skeleton fallback. |
| **Quota Exhaustion from Legacy Log Listener** | `MessagingClient.tsx` listening to raw `message_logs` collection. | Reads 1,000+ documents on every page navigation. | **Complete Deprecation (Task 1)**: Eliminate `useCollection(query(collection(firestore, 'message_logs')))`; drive dashboard strictly via cached server action. |
| **Network / Provider Timeout Freezing Dashboard** | External gateways (mNotify, Meta WABA) slow or offline during page load. | Spinner spins forever, user cannot interact with messaging. | **Resilience & Retry Banner (Task 1)**: 3500ms timeout bounds on external calls; actionable error card with `<Button> Retry` rendered if backend aggregator fails. |
| **Cumulative Layout Shift (CLS) on Numeric Updates** | Monospaced numbers absent; layout shifts when counters increment. | Poor Core Web Vitals score, jarring UI jump. | **Tabular Numbers Invariant (Task 3)**: Apply `tabular-nums` class to all numeric metrics, timestamps, and badges. |

---

## 4. Phase 8 Detailed Task Breakdown

### Task 1: Master Client Orchestration, Resilience & Unbounded Query Deprecation
**Goal**: Finalize `src/app/admin/messaging/MessagingClient.tsx` to coordinate all Phase 1–7 modular components with error recovery, retry mechanics, and tenant hydration guards.
- **Files to Modify**: `src/app/admin/messaging/MessagingClient.tsx`
- **Files to Verify/Test**: `src/app/admin/messaging/__tests__/MessagingClient.test.tsx`
- **Detailed Steps**:
  1. Verify clean client boundary (`'use client'`).
  2. Verify tenant loading guard (`isTenantLoading`) preventing premature error state flashes before workspace authentication completes.
  3. Wire actionable error banner with retry button (`RefreshCw`) if server aggregator returns an error.
  4. Coordinate all child sections:
     - Hero Greeting Banner (`MessagingHeroGreeting`) with dynamic time calculation and custom AI prompt starters from Backoffice settings.
     - Top KPI Metrics Grid (`MessagingKpiGrid`) with tabular numbers, delivery rates, and SMS balance warnings.
     - Quick Actions Grid (`MessagingQuickActions`) with tactile cards and "View all features" trigger.
     - Left Column: `MessagingInboxPreview`, `MessagingPerformanceCharts`, `RecentCampaignsCard`.
     - Right Column: `QuickMessageComposerCard`, `QuickTemplatesCard`, `ActiveQueuesCard`.
     - Mobile Navigation: `MobileBottomNav` with safe-area padding (`pb-safe`).
  5. Audit for legacy unbounded Firestore query `useCollection(query(collection(firestore, 'message_logs')))` and ensure it is 100% eradicated.
  6. Run `npx vitest run src/app/admin/messaging/__tests__/MessagingClient.test.tsx`.

---

### Task 2: Messaging Modal Ecosystem Audit (`theme.md` Section 8 SSOT)
**Goal**: Standardize and audit all messaging modals and dialogs against the Standardized Modal Architecture in `theme.md` Section 8.
- **Target Modals to Audit & Refactor**:
  1. `src/app/admin/messaging/components/dashboard/MessagingAiPromptModal.tsx`:
     - Surface: `sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl`.
     - Header: `<DialogHeader demarcated>` with `<CardInfoTooltip text="..." />` and `<DialogDescription className="sr-only">`.
     - Single-Circle Invariant: Single circle info icon with `focus:outline-none focus-visible:ring-1` and `z-[10050]` tooltip elevation.
     - Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl min-h-[44px] active:scale-[0.97]`).
  2. `src/app/admin/messaging/components/dashboard/MessagingAllFeaturesModal.tsx`:
     - Verify surface geometry, demarcated header, single-circle info tooltip, sr-only description, and tactile action grid.
  3. `src/app/admin/messaging/composer/components/SafeguardBlastModal.tsx`:
     - Refactor from raw description text to `<AlertDialogHeader demarcated>`, `<CardInfoTooltip text="..." />`, `<AlertDialogDescription className="sr-only">`.
     - Standardize footer: Demarcated `px-6 py-3.5 border-t border-border/80 bg-muted/15` with tactile `active:scale-[0.97]` buttons and `min-h-[44px]` touch targets.
  4. `src/app/admin/messaging/components/TestDispatchDialog.tsx`:
     - Verify demarcated header, single-circle tooltip, sr-only description, and demarcated footer.
- **Unit & Component Tests**:
  - `src/app/admin/messaging/components/dashboard/__tests__/MessagingAiPromptModal.test.tsx`
  - `src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx`
  - `src/app/admin/messaging/components/__tests__/test-dispatch-dialog.context.test.tsx`
  - Create: `src/app/admin/messaging/composer/components/__tests__/SafeguardBlastModal.test.tsx`

---

### Task 3: Dual Performance Analytics & Dynamic Range Partitioning
**Goal**: Verify the delivery SLA radial ring, channel breakdown share bars, and dynamic time-range switcher (`7D` vs `30D`).
- **Files to Verify**: `src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx`
- **Files to Test**: `src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`
- **Detailed Steps**:
  1. Verify pure SVG radial delivery ring (`w-24 h-24`) that renders with zero layout thrashing or hydration mismatches.
  2. Verify time-range switcher (`7D` vs `30D`) triggering parametric cache keying (`dashboard:${orgId}:${wsId}:${timeRange}`).
  3. Verify all metrics render with `tabular-nums` to eliminate CLS.
  4. Run `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`.

---

### Task 4: AI Copilot & Governed MCP Tool Registry Verification
**Goal**: Verify that all 4 messaging MCP tools conform to current MCP standards, risk tiers, 64-character SHA-256 schema hashing, and fail-closed multi-tenancy.
- **Tools to Verify**:
  1. `messaging.get_dashboard_summary` (`src/lib/mcp/tools/messaging-dashboard-tool.ts`):
     - Category `'campaign'`, risk `'read_only'`, SHA-256 `schemaHash: '7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b'`.
  2. `messaging.get_queue_stats` (`src/lib/mcp/tools/messaging-queue-tools.ts`):
     - Category `'campaign'`, risk `'read_only'`, SHA-256 `schemaHash: '5f8a1c3e7b9d2e4f6a8b0c1d3e5f7a9b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f'`.
  3. `messaging.get_conversation_thread` (`src/lib/mcp/tools/messaging-conversation-tools.ts`):
     - Category `'campaign'`, risk `'read_only'`, SHA-256 `schemaHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'`.
  4. `messaging.suggest_reply` (`src/lib/mcp/tools/messaging-conversation-tools.ts`):
     - Category `'campaign'`, risk `'low_risk'`, SHA-256 `schemaHash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3'`.
     - Rule 17 & 19 Human-in-the-Loop invariant: Strictly returns draft propositions; zero outbound mutation capability.
- **Test Suite**:
  - `src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts`
  - `src/lib/mcp/tools/__tests__/messaging-queue-tools.test.ts`
  - `src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts`

---

### Task 5: Mobile Viewport, Theme Contrast & Full Regression Verification
**Goal**: Perform exhaustive theme contrast, mobile touch target, and full regression verification.
- **Files to Verify/Test**:
  - `src/app/admin/messaging/__tests__/MessagingThemeAudit.test.tsx`
  - Full messaging test sweep across all 40 test files.
- **Detailed Steps**:
  1. Run `MessagingThemeAudit.test.tsx` to verify:
     - `tabular-nums` on all KPI and counter metrics.
     - Touch targets meet `min-h-[44px]`.
     - Light mode and Dark mode contrast compliance.
  2. Verify mobile bottom navigation (`MobileBottomNav.tsx`):
     - Fixed `bottom-0`, `z-50`, `pb-safe`, `active:scale-[0.95]`.
  3. Run full verification commands:
     - `npx vitest run src/app/admin/messaging/` (Must pass 100%).
     - `npx eslint src/app/admin/messaging/` (0 errors).
     - Verify strict TypeScript typing (zero `any` or `any[]`).
  4. Local Git Commit: Stage and commit cleanly on `main` locally with zero unprompted remote push (Rule 5).

---

## 5. Definition of Done & Verification Invariants

Before Phase 8 is signed off:
* [ ] Zero use of `any` or `any[]` across all touched code (Rule 4).
* [ ] All modals strictly conform to `theme.md` Section 8 (`<DialogHeader demarcated>`, `<CardInfoTooltip>` single-circle, `sr-only` descriptions, demarcated footer with `rounded-xl active:scale-[0.97]` buttons).
* [ ] Unbounded client-side Firestore queries (`message_logs`) are completely eliminated from `MessagingClient.tsx` (Rule 9).
* [ ] Quick Message Composer strictly enforces single 1-to-1 recipient validation (Rule 19).
* [ ] All 4 messaging MCP tools verify 64-character SHA-256 `schemaHash` and fail-closed multi-tenancy.
* [ ] All navigation targets are safe relative paths starting with single `/` (Rule 8).
* [ ] All touch targets meet the `min-h-[44px]` requirement (Rule 7).
* [ ] Visual appearance matches `media_1791516336748_2f0e908d.jpg` in both Light and Dark modes.
* [ ] All 40 messaging test suites pass in Vitest.
* [ ] ESLint check passes with 0 errors.
* [ ] Strictly zero unprompted git push to remote origin (Rule 5).
