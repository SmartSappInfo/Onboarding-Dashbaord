# Messaging Dashboard Redesign (SmartSapp Experience)
## Master Architecture & Phase-by-Phase Implementation Plan
### Conforming to `agents_mcp_rules.md` & Institutional Design Standards

> **File Location:** `docs/messaging/messaging_dashboard_redesign_plan.md`  
> **Status:** Pending User Approval  
> **Target Subsystems:** Messaging Dashboard (`/admin/messaging`), Real-time Analytics, Quick Composer, Mobile Navigation, Agent MCP Tools, Backoffice Configuration  
> **Visual Reference:** User-provided mockup (`media_1791516336748_2f0e908d.jpg`)  
> **Design Theme:** Institutional Minimalism (`theme.md`), Light & Dark Mode compliant  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 25 from `docs/agents_mcp/agents_mcp_rules.md`)  

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION PHASE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Design Breakdown

This plan details the full transformation of the existing Messaging Dashboard at `/admin/messaging` into the modern, high-adoption **SmartSapp Communications Hub** shown in the design specification, while maintaining complete architectural backwards compatibility, multi-tenant isolation, and zero disruption to active campaigns.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: Logo (SmartSapp) | Global Search | Notifications (1) | User (Admin) | Theme   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ HERO GREETING: "Good morning, Sarah 👋" ]   [ AI Search Pill: "Ask AI to draft..." → ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ KPI ROW (4 Cards):                                                                     │
│ [ 💬 Messages Sent ]   [ 🟢 Delivery Rate ]   [ 📱 SMS Balance ]   [ 🛡️ Provider Status ] │
│   12,482 (↑ 24%)         99.7% (↑ 1.2%)         941 (Top up →)        All Systems Active│
├───────────────────────────────────────────────────┬────────────────────────────────────┤
│ QUICK ACTIONS (4 Cards):                          │ RIGHT SIDEBAR (Stacked Widgets):   │
│ [ 🚀 New Campaign ] [ ✉️ Start Message ]          │ 1. QUICK MESSAGE COMPOSER          │
│ [ 📑 Templates ]    [ ⏱️ Manage Queue ]           │    Textarea + Counter + Send       │
├─────────────────────────┬─────────────────────────┤ 2. TEMPLATES SHORTLIST             │
│ INBOX / CONVERSATIONS   │ CHARTS & CAMPAIGNS      │    Welcome, Fee Reminder, Event... │
│ Filter: All/Unread/Group│ • Performance Ring      │ 3. ACTIVE QUEUES                   │
│ Live contact threads    │ • Channel Breakdown     │    Scheduled (24), Pending (3)...  │
│ [ AI Assistant Bar ]    │ • Recent Campaigns List │                                    │
│                         │ • AI Lift Promo Banner  │                                    │
├─────────────────────────┴─────────────────────────┴────────────────────────────────────┤
│ VALUE PILLARS FOOTER: [ ✨ AI-Powered ] [ ⚡ Simpler & Faster ] [ 🏛️ Built for Schools ] │
└────────────────────────────────────────────────────────────────────────────────────────┘

MOBILE ADAPTATION:
Compact Top Bar → Compact Hero & AI Pill → 2x2 KPI Grid → Horizontal Quick Actions →
Recent Campaigns List → Bottom Navigation Bar (Home | Messages | Campaigns | Templates | More)
```

---

## 2. Compliance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 2.1 The 10 Foundational Engineering Rules
1. **Rule 1: Industry-Grade Best Practices**:
   * Complies with `next-best-practices` (clean server/client boundaries, dynamic imports for heavy chart components, metadata in server wrappers).
   * Complies with `vercel-react-best-practices` (memoized calculations, zero unnecessary re-renders, optimistic updates).
   * Complies with `emilkowal-animations` (tactile button presses `active:scale-[0.97]`, smooth tab transitions, zero layout thrashing).
   * Complies with `frontend-design` & `backend-design` (modular component tree, bounded queries, failure isolation).
2. **Rule 2: Risk Analysis, Cleanliness & Scalability**:
   * Addressed in **Section 3: What Could Go Wrong & Mitigation Matrix**.
   * Code is decomposed into bite-sized units (< 250 lines per file).
   * All tasks are tested using Vitest and verified via `pnpm typecheck` and `pnpm lint`.
   * Strictly zero unprompted remote git pushes.
3. **Rule 3: Impact Analysis & Backoffice Enhancement**:
   * Addressed in **Section 4: Impact Analysis & Backoffice Management**.
   * Backoffice provides codeless control over quick templates, provider thresholds, and AI prompt defaults.
4. **Rule 4: Strict Typing & Bounded `unknown`**:
   * Strictly zero `any` or `any[]` throughout production and test code.
   * `unknown` is only permitted at trust boundaries (external API responses, raw Firestore snapshots) and MUST be immediately parsed and narrowed via Zod schemas before reaching domain logic.
5. **Rule 5: Staging, Validation & Approval Gates**:
   * No auto-deployment. All Firestore rules, composite indexes, and server actions are validated in local/emulator environments first.
6. **Rule 6: Dependency Integrity & Context7**:
   * Uses existing verified packages (`lucide-react`, `date-fns`, `recharts`, `zod`). Context7 MCP is queried whenever integrating external API conventions.
7. **Rule 7: Mobile-First Ergonomics & Everyday UI English**:
   * All touch targets meet `min-h-[44px]`.
   * Viewports `< 768px` feature a sticky iOS-safe mobile bottom navigation bar (`Home`, `Messages`, `Campaigns`, `Templates`, `More`).
   * Clean everyday English: labels are short, crisp, and direct (no jargon or wordy explanations).
8. **Rule 8: High Security & Multi-Tenant Data Protection**:
   * Strict tenant isolation: every query scopes by `organizationId == activeOrg.id` and `workspaceIds array-contains activeWorkspaceId`.
   * Input sanitization on message drafting to prevent XSS (CWE-79) and formula injection (CWE-1236).
9. **Rule 9: High-Load Safety & Resource Protection**:
   * Unbounded client-side queries (`limit(1000)`) are eliminated.
   * Server-side data aggregator (`getMessagingDashboardSummaryAction`) uses bounded queries, in-memory caching (5-minute TTL), and Firestore Count aggregations.
10. **Rule 10: Inline Architectural Documentation**:
    * Every file and exported action contains clear JSDoc blocks explaining *why* it exists, caution areas, tenant boundaries, and test pointers.

### 2.2 The Agentic & MCP Rules (Rules 11–25)
* **Rule 11 (MCP Protocol Compliance)**: All AI tools expose standard JSON schemas and adhere to stateless multi-round-trip request contracts.
* **Rule 12 (Server-Side Risk Enforcement)**: Never rely on client-side annotations. Tool permissions, rate limits, and blast thresholds are enforced server-side.
* **Rule 13 (Trust Boundary Matrix)**: Separates SYSTEM instructions from UNTRUSTED retrieved data (inbound webhooks, CRM contact inputs).
* **Rule 14 (Tool Poisoning Defense)**: AI tools maintain versioning and SHA-256 schema hashes (`schemaHash`) to detect unauthorized definition tampering.
* **Rule 16 (Agent Identity as First-Class Principal)**: Outbound dispatches record `actor: { type: 'user' | 'agent', id: string, name: string }` in `message_logs`.
* **Rule 18 (Fail-Closed Multi-Tenancy)**: If tenant verification fails or context is missing, the action aborts immediately with 403 Forbidden.
* **Rule 19 (Human-in-the-Loop Approval Gates)**: Quick Composer supports direct 1-to-1 sends; any mass campaign or multi-recipient blast requires explicit confirmation.
* **Rule 21 (Graceful Degradation)**: If a provider is degraded (e.g. mNotify SMS balance low or WhatsApp WABA disconnected), the UI presents warning badges and falls back gracefully.
* **Rule 22 (Observability & Audit Logging)**: All dispatches log delivery milestones and errors to `message_logs` and the central audit trail.

---

## 3. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Firestore Query Storm on Page Load** | Multiple components querying `message_logs` independently. | Read quota exhaustion, slow page render, high Firebase costs. | **Unified Server Aggregator**: A single cached action `getMessagingDashboardSummaryAction` fetches all counts, deltas, and stats in 1 round trip with a 3-minute in-memory cache. |
| **Accidental Blast from Quick Composer** | Staff typing a test message in the dashboard and accidentally sending to an audience. | Customer spam, brand damage, compliance violations. | **Single-Target Guard**: Quick Composer in the dashboard strictly enforces 1-to-1 recipient input. Broadcasts are prohibited and redirect to the full Campaign Wizard. |
| **WhatsApp Session Expiration Error (131047)** | User types free-form text to a contact whose 24h Meta customer window is closed. | Send failure, frustration. | **Live Session Badge & Template Fallback**: Composer inspects `whatsapp_sessions`. If closed, disables free-form typing and presents a 1-click approved Meta template picker. |
| **SMS Credit Exhaustion During Send** | mNotify account balance drops below required units. | Silent delivery failure. | **Proactive Balance Guard**: The KPI card shows live SMS balance; if balance < 10 units, Composer shows a warning and provides a 1-click top-up link. |
| **Layout Overflow on Small Mobile Devices (320px–375px)** | Complex 4-card grids and large charts breaking on narrow mobile screens. | Broken horizontal scrolling, unclickable buttons. | **Adaptive Stacking**: 4-column KPI row collapses to a 2x2 grid on mobile; Quick Actions convert to a smooth horizontal swipeable carousel; bottom nav docks to viewport. |
| **Hydration Mismatch on Dynamic Greeting** | Server renders "Good morning" while client is in evening time zone. | React hydration error #418, UI flickering. | **Client-Hydrated Time Calculator**: Time-of-day greeting calculation is calculated client-side with clean SSR skeleton fallback. |

---

## 4. Impact Analysis & Backoffice Management (Rule 3)

### 4.1 Affected Features & Backwards Compatibility
* **Campaigns (`/admin/messaging/campaigns`)**: Unaffected. Quick Actions link directly into the existing campaign wizard.
* **Templates Gallery (`/admin/messaging/templates`)**: Fully integrated. Quick Templates shortlist queries the canonical `TEMPLATES` registry without altering existing data.
* **Conversations Hub (`/admin/messaging/conversations`)**: Deeply linked. The dashboard Inbox Widget acts as a live preview that routes directly to active threads.
* **Message Jobs & Scheduled Queues (`/admin/messaging/jobs`, `/admin/messaging/scheduled`)**: Surfaced in the "Active Queues" widget without altering underlying cron processors.

### 4.2 Backoffice Enhancement (Codeless Management)
To ensure administrators can manage this dashboard without engineering intervention, we enhance the Backoffice Settings (`/admin/settings?tab=messaging`):
1. **Quick Templates Selector**: Admins can check/uncheck which 4 canonical templates appear in the Quick Templates dashboard widget.
2. **Low-Balance Alert Threshold**: Configurable threshold (e.g. alert when SMS units < 100).
3. **AI Assistant Prompt Starters**: Admins can customize the prompt placeholders shown in the Hero Greeting pill based on seasonal workflows (e.g., "Ask AI to draft mid-term exam announcements").
4. **Provider Kill-Switch**: 1-click toggle to temporarily pause a degraded channel (e.g. WhatsApp maintenance) without taking down the entire messaging hub.

---

## 5. Detailed Component Hierarchy & File Architecture

```
src/app/admin/messaging/
├── page.tsx                                (Server component / SEO metadata)
├── MessagingClient.tsx                     (Main orchestrator & layout grid)
└── components/dashboard/
    ├── MessagingHeroGreeting.tsx           (Greeting card + interactive AI prompt pill)
    ├── MessagingKpiGrid.tsx                (4 KPI cards: Sent, Delivery Rate, SMS Balance, Health)
    ├── MessagingQuickActions.tsx           (4 primary shortcut cards with tactile click)
    ├── MessagingInboxPreview.tsx           (Conversations mini-widget with filter tabs)
    ├── MessagingPerformanceCharts.tsx      (Radial delivery ring & channel donut chart)
    ├── RecentCampaignsCard.tsx             (Active & recent campaigns table/list)
    ├── QuickMessageComposerCard.tsx        (Right sidebar: fast inline drafting)
    ├── QuickTemplatesCard.tsx              (Right sidebar: curated starter templates)
    ├── ActiveQueuesCard.tsx                (Right sidebar: scheduled & pending jobs)
    ├── MessagingFooterHighlights.tsx       (Bottom 3 institutional feature badges)
    └── MobileBottomNav.tsx                 (Fixed bottom tab bar for mobile viewports)
```

---

## 6. Phase-by-Phase Implementation Plan

### Phase 1: Data Contracts, Schemas & Multi-Tenant Aggregator
> **Detailed Execution Plan:** [`docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-1.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-1.md)
* **Goal**: Establish strictly typed contracts and a high-performance, cached backend aggregation action.
* **Files**:
  * Create: `src/lib/types/messaging-dashboard.ts`
  * Create: `src/app/actions/messaging-dashboard-actions.ts`
  * Test: `src/app/actions/__tests__/messaging-dashboard-actions.test.ts`
* **Tasks**:
  1. Define Zod schemas and TypeScript types:
     * `MessagingKpiMetrics`: `messagesSent`, `messagesSentDelta`, `deliveryRate`, `deliveryRateDelta`, `smsBalance`, `providerStatus`.
     * `PerformanceChartData`: `deliveredCount`, `sentCount`, `failedCount`, `deliveryPercentage`.
     * `ChannelBreakdownItem`: `channel` (`'sms' | 'whatsapp' | 'email' | 'in_app'`), `count`, `percentage`.
     * `RecentCampaignItem`: `id`, `name`, `status`, `recipientCount`, `sentAt`, `deliveryRate`, `clickRate`.
     * `ActiveQueueStats`: `scheduledCount`, `pendingApprovalCount`, `failedCount`.
  2. Implement `getMessagingDashboardSummaryAction(organizationId, workspaceId)`:
     * Enforces fail-closed multi-tenancy.
     * Computes 7-day volume deltas.
     * Fetches live SMS balance and provider health.
     * In-memory TTL cache (3 minutes) to guard Firestore from query storms.
  3. TDD: Write unit tests verifying calculations and tenant isolation.
  4. Commit locally: `feat(messaging): add dashboard types and multi-tenant aggregator action`.

---

### Phase 2: Hero Greeting Card & Interactive AI Prompt Bar
* **Goal**: Build the flagship greeting banner with dynamic time greeting, user first name, terminology adaptation, and interactive AI prompt trigger.
* **Files**:
  * Create: `src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx`
  * Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingHeroGreeting.test.tsx`
* **Tasks**:
  1. Implement client-hydrated time-of-day greeting ("Good morning", "Good afternoon", "Good evening").
  2. Integrate `useAuth().currentUser.displayName` and `useTerminology()` (*"for stronger {school/organization} communities"*).
  3. Implement translucent glassmorphism AI prompt pill (`bg-white/10 backdrop-blur-md hover:bg-white/20 border-white/20`).
  4. On click: opens the AI Assistant modal with pre-filled prompt suggestions.
  5. TDD: Unit test time calculation and terminology substitution.
  6. Commit locally: `feat(messaging): implement hero greeting card and interactive AI prompt bar`.

---

### Phase 3: Top KPI Metrics Grid (4 Stat Cards)
* **Goal**: Build the 4 responsive stat cards with percentage deltas and status pills.
* **Files**:
  * Create: `src/app/admin/messaging/components/dashboard/MessagingKpiGrid.tsx`
  * Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx`
* **Tasks**:
  1. `Messages Sent Card`: Formatted tabular numbers, blue icon, `↑ 24% vs. last 7 days` trend badge.
  2. `Delivery Rate Card`: Emerald icon, `99.7%`, `↑ 1.2% vs. last 7 days` badge.
  3. `SMS Unit Balance Card`: Orange icon, `941` units, `"Top up now →"` relative link to billing.
  4. `Provider Status Card`: Purple shield icon, `"All Systems Active"`, green pulsing indicator (`🟢 Healthy`).
  5. Layout: Desktop 4 columns (`lg:grid-cols-4`), Tablet 2 columns (`sm:grid-cols-2`), Mobile 2 columns (`grid-cols-2`).
  6. TDD: Unit test delta badge rendering and negative trend states.
  7. Commit locally: `feat(messaging): implement 4-card KPI metrics grid with live deltas`.

---

### Phase 4: Quick Actions Grid (4 Task Shortcuts)
* **Goal**: Build the 4 primary quick-action shortcut cards.
* **Files**:
  * Create: `src/app/admin/messaging/components/dashboard/MessagingQuickActions.tsx`
* **Tasks**:
  1. Header: `"Quick Actions"` + *"Get started with the most common messaging tasks."* + `"View all features →"`.
  2. 4 Cards with custom icon backgrounds:
     * `New Campaign` (Megaphone, purple accent) → `/admin/messaging/campaigns/new`
     * `Start Message` (Paper airplane, blue accent) → `/admin/messaging/composer`
     * `Message Templates` (Document, emerald accent) → `/admin/messaging/templates`
     * `Manage Queue` (Clock, orange accent) → `/admin/messaging/scheduled`
  3. Mobile ergonomics: `min-h-[44px]`, tactile click `active:scale-[0.97]`.
  4. Commit locally: `feat(messaging): implement quick actions shortcut cards`.

---

### Phase 5: Right Sidebar (Composer, Templates, Active Queues)
* **Goal**: Build the 3 stacked utility widgets in the right panel.
* **Files**:
  * Create: `src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx`
  * Create: `src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx`
  * Create: `src/app/admin/messaging/components/dashboard/ActiveQueuesCard.tsx`
  * Test: `src/app/admin/messaging/components/dashboard/__tests__/QuickComposer.test.tsx`
* **Tasks**:
  1. `QuickMessageComposerCard`:
     * Textarea with placeholder *"Type your message..."*.
     * Toolbar: Emoji trigger, Attachment paperclip, Variable token pill, Character counter (`0/160`).
     * Single-recipient target selector with phone/email validation.
     * `Send Message` primary button with tactile `active:scale-[0.97]`.
  2. `QuickTemplatesCard`:
     * 4 starter templates: `Welcome Message`, `Fee Reminder`, `Event Invite`, `Newsletter`.
     * Clicking a template prefills the Quick Composer or routes to the visual editor.
  3. `ActiveQueuesCard`:
     * 3 interactive status rows: `Scheduled Messages` (24), `Pending Approval` (3), `Failed Messages` (2) with retry shortcut.
  4. Commit locally: `feat(messaging): implement right sidebar composer, templates and queues`.

---

### Phase 6: Dual Analytics & Conversations Mini-Widget
* **Goal**: Build the two central panels (Inbox widget on the left, Analytics & Campaigns on the right).
* **Files**:
  * Create: `src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx`
  * Create: `src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx`
  * Create: `src/app/admin/messaging/components/dashboard/RecentCampaignsCard.tsx`
* **Tasks**:
  1. `MessagingInboxPreview`:
     * Filter Tabs: `All (24)`, `Unread (3)`, `Groups (6)`, `Direct (15)`.
     * Search Input with filter icon.
     * Contact thread rows with avatars, entity name, message snippet, timestamp, unread badge.
     * Clicking a thread navigates to `/admin/messaging/conversations?thread={id}`.
     * AI Assistant footer bar with `"Ask AI →"` button.
  2. `MessagingPerformanceCharts`:
     * Radial delivery ring chart (`99.7% Delivered`, breakdown of Sent, Delivered, Failed) with time selector (`Last 7 days ▼`).
     * Donut chart showing channel volume (`12.5K Total Sent`: SMS 52%, WhatsApp 28%, Email 12%, In-App 8%).
  3. `RecentCampaignsCard`:
     * Top 3 campaigns list showing name, status pill (`Active` / `Completed`), recipient count, delivery rate, and click rate.
  4. AI Promo Banner:
     * *"Let AI do the heavy lifting — Generate messages, analyze results..."* + `"Try AI Assistant →"`.
  5. Commit locally: `feat(messaging): implement dual analytics and inbox mini-widget`.

---

### Phase 7: Footer Feature Highlights & Mobile Bottom Navigation Bar
* **Goal**: Complete the institutional value highlight footer and implement the mobile-specific bottom tab bar.
* **Files**:
  * Create: `src/app/admin/messaging/components/dashboard/MessagingFooterHighlights.tsx`
  * Create: `src/app/admin/messaging/components/dashboard/MobileBottomNav.tsx`
* **Tasks**:
  1. `MessagingFooterHighlights`:
     * 3 value badges: `AI-Powered`, `Simpler & Faster`, `Built for Schools / Organizations`.
     * Desktop & Mobile responsive indicator badge.
  2. `MobileBottomNav`:
     * Fixed bottom bar for screens `< 768px`:
       * `Home` (`/admin/messaging`)
       * `Messages` (`/admin/messaging/conversations`)
       * `Campaigns` (`/admin/messaging/campaigns`)
       * `Templates` (`/admin/messaging/templates`)
       * `More` (Opens navigation drawer)
     * iOS safe-area padding (`pb-safe`).
  3. Commit locally: `feat(messaging): implement footer value highlights and mobile bottom navigation`.

---

### Phase 8: Orchestration, Testing & Verification
* **Goal**: Assemble all modular components into `MessagingClient.tsx` and run rigorous automated validation.
* **Files**:
  * Modify: `src/app/admin/messaging/MessagingClient.tsx`
* **Tasks**:
  1. Assemble all modular components into `MessagingClient.tsx`.
  2. Verify dual-theme appearance:
     * Check light theme contrast (14.8:1).
     * Check dark theme contrast (17.8:1).
  3. Verify mobile responsiveness across 320px, 375px, 768px, 1024px, and 1440px viewports.
  4. Run verification commands:
     * `pnpm typecheck` (Must pass with 0 errors).
     * `pnpm lint` (Must pass with 0 errors).
     * Execute targeted Vitest suites for all new dashboard components.
  5. Commit locally: `feat(messaging): assemble unified SmartSapp messaging dashboard`.

---

## 7. Verification Invariants & Definition of Done

* [ ] `pnpm typecheck` completes with **0 errors**.
* [ ] `pnpm lint` completes with **0 errors**.
* [ ] All new components are strictly typed (zero `any` or `any[]`).
* [ ] Visual parity matches the attached design across both Desktop and Mobile viewports.
* [ ] Light Mode and Dark Mode both satisfy WCAG AA contrast rules.
* [ ] All touch targets meet the `min-h-[44px]` standard.
* [ ] No remote git push until explicitly requested by the user.
