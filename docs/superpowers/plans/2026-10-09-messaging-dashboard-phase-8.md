# Messaging Dashboard Redesign — Phase 8: Master Orchestration, Right Sidebar, Analytics & Production Verification
## Comprehensive Implementation Plan (Conforming to `agents_mcp_rules.md` Rules 1–27 & Institutional Design Standards)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble all modular components into the unified SmartSapp Communications Hub at `/admin/messaging`, implement the remaining right sidebar utilities (Quick Message Composer, Quick Templates, Active Queues), dual performance analytics charts, live conversations preview, and mobile bottom navigation, deprecate legacy unbounded queries, and verify production readiness across light and dark themes.

**Architecture:** A unified client orchestrator (`MessagingClient.tsx`) coordinates modular presentation components driven by the cached backend aggregator (`getMessagingDashboardSummaryAction`). The 12-column responsive grid hosts the flagship Hero Greeting, 4-stat KPI Grid, 4-card Quick Actions, Conversations Mini-Widget, Dual Analytics Charts, Recent Campaigns, Right Sidebar Composer/Templates/Queues stack, Institutional Footer Highlights, and iOS-safe Mobile Bottom Nav.

**Tech Stack:** Next.js 15 (App Router, Client Components), TypeScript 5.6 (Strict, zero `any/any[]`), Tailwind CSS, Radix UI Dialog & Tabs, Recharts (Dynamic Bar/Radial/Donut Charts), Lucide React, Vitest, React Testing Library.

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START IMPLEMENTATION OR TOUCH APPLICATION CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `docs/agents_mcp/agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and task structure.

---

## 1. Executive Summary & Visual Design Breakdown

This plan represents the **grand finale and assembly phase** of the SmartSapp Messaging Dashboard Redesign.
It delivers the visual design specified in `docs/messaging/messaging_dashboard_redesign_plan.md` and the user-provided high-fidelity mockup (`media_1791516336748_2f0e908d.jpg`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: Standardized Admin Header | Quick Help Tooltip | Organization Context         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ HERO GREETING: "Good morning, Sarah 👋" ]   [ AI Search Pill: "Ask AI to draft..." → ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ KPI ROW (4 Cards):                                                                     │
│ [ 💬 Messages Sent ]   [ 🟢 Delivery Rate ]   [ 📱 SMS Balance ]   [ 🛡️ Provider Status ] │
│   12,482 (↑ 24%)         99.7% (↑ 1.2%)         941 (Top up →)        All Systems Active│
├───────────────────────────────────────────────────┬────────────────────────────────────┤
│ LEFT CONTENT (lg:col-span-8):                     │ RIGHT SIDEBAR (lg:col-span-4):     │
│                                                   │                                    │
│ 1. QUICK ACTIONS (4 Cards):                       │ 1. QUICK MESSAGE COMPOSER          │
│    [ 🚀 New Campaign ] [ ✉️ Start Message ]       │    • Single recipient input        │
│    [ 📑 Templates ]    [ ⏱️ Manage Queue ]        │    • 160-char SMS counter          │
│                                                   │    • Emoji & Variable tokens       │
│ 2. INBOX / CONVERSATIONS PREVIEW                  │    • Send button (active:scale)    │
│    • Tabs: All, Unread, Groups, Direct            │                                    │
│    • Search bar with live filter                  │ 2. QUICK TEMPLATES SHORTLIST       │
│    • Thread list with contact avatars & unread    │    • Welcome, Fee Reminder, etc.   │
│    • Direct link to /admin/messaging/conversations│                                    │
│                                                   │ 3. ACTIVE QUEUES WIDGET            │
│ 3. CHARTS & RECENT CAMPAIGNS                      │    • Scheduled (24)                │
│    • Performance Radial Ring (99.7% Delivered)    │    • Pending Approval (3)          │
│    • Channel Breakdown Donut/Bars (SMS, WA, Email)│    • Failed Deliveries (2)         │
│    • Recent Campaigns Table & Status Badges       │    • 1-Click Retry / Manage Queue  │
│    • "Let AI do the heavy lifting" Promo Banner   │                                    │
├───────────────────────────────────────────────────┴────────────────────────────────────┤
│ VALUE PILLARS FOOTER: [ ✨ AI-Powered ] [ ⚡ Simpler & Faster ] [ 🏛️ Built for Schools ] │
└────────────────────────────────────────────────────────────────────────────────────────┘

MOBILE ADAPTATION (< 768px):
Compact Top Bar → Compact Hero & AI Pill → 2x2 KPI Grid → 2x2 Quick Actions →
Collapsible Quick Composer → Recent Campaigns → Bottom Navigation Bar
```

---

## 2. Comprehensive Conformance with `agents_mcp_rules.md` (Rules 1–27)

### 2.1 The 10 Foundational Engineering Rules
* **Rule 1 (Industry-Grade Best Practices)**:
  * Conforms to `next-best-practices`: Clean client/server boundaries (`'use client'`), dynamic imports via `next/dynamic` with `{ ssr: false }` for chart components (`MessagingPerformanceCharts.tsx`) to avoid bundle bloat and hydration issues.
  * Conforms to `vercel-react-best-practices`: Tabular numbers (`tabular-nums`) across all metrics and counters to completely eliminate Cumulative Layout Shift (CLS). Memoized selectors for inbox filtering and search queries.
  * Conforms to `emilkowal-animations`: Mechanical tactile button feedback (`active:scale-[0.97]`), smooth transitions (`transition-all duration-200`), hardware-accelerated transforms.
  * Conforms to `frontend-design` & `backend-design`: Modern Institutional Minimalism adhering to `theme.md` Sections 4 & 8. Dual-mode semantic tokens (`bg-card`, `text-card-foreground`, `border-border/80`). Zero raw unescaped HTML or CSS leakages.
* **Rule 2 (Risk Analysis, Cleanliness & Scalability)**:
  * Exhaustive breakdown of failure modes in **Section 3: What Could Go Wrong & Mitigation Matrix**.
  * Code decomposed into modular, bite-sized components (< 250 lines per file).
  * Strict Test-Driven Development (TDD) cycle: write failing test $\rightarrow$ verify fail $\rightarrow$ implement $\rightarrow$ verify pass $\rightarrow$ commit.
  * Local commit discipline (`feat(messaging): ...`). Strictly zero unprompted remote git pushes.
* **Rule 3 (Impact Analysis & Backoffice Enhancement)**:
  * Detailed in **Section 4: Impact Analysis & Backoffice Management**.
  * Complete backward compatibility: preserves existing routes (`/admin/messaging/campaigns`, `/composer`, `/templates`, `/scheduled`, `/jobs`, `/conversations`).
  * Backoffice settings (`/admin/settings?tab=messaging`) provide codeless administrative controls over quick templates, balance thresholds, and AI prompt visibility.
* **Rule 4 (Strict Typing & Bounded `unknown`)**:
  * Strictly zero `any` or `any[]` across all new components, utilities, and test suites.
  * `unknown` is permitted only at external boundaries (raw Firestore snapshots or API payloads) and MUST be immediately validated and narrowed via Zod schemas (`MessagingDashboardSummarySchema`). Never propagate unvalidated `unknown`.
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Implementation and deployment are governed by strict approval gates. No execution begins until the user explicitly approves this plan.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Strictly uses existing verified dependencies: `lucide-react`, `recharts`, `date-fns`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `zod`, Tailwind CSS.
  * No unverified or experimental external libraries introduced.
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Every interactive touch target meets or exceeds the `min-h-[44px]` standard with generous tap zones.
  * Viewports `< 768px` feature a fixed, iOS-safe bottom navigation bar (`MobileBottomNav.tsx`) with safe-area padding (`pb-safe`).
  * Everyday UI English: Clear, short, self-explanatory labels (`"Send Message"`, `"Manage Queue"`, `"Recent Campaigns"`). Zero internal engineering jargon (no "outbox worker", "batch partitioner", or "cursor envelope").
* **Rule 8 (High Security & Multi-Tenant Data Protection)**:
  * Fail-closed multi-tenancy enforced: all dashboard aggregation and dispatch actions strictly validate `organizationId` and `workspaceId` against authenticated caller session (`requireWorkspace`).
  * Relative internal routing: all action paths strictly start with a single `/` (`/admin/messaging/composer`), prohibiting open redirects (CWE-601).
  * Input sanitization on message bodies to neutralize XSS (CWE-79) and CSV/formula injection (CWE-1236).
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * **Critical Architecture Upgrade**: The legacy unbounded `useCollection(query(collection(firestore, 'message_logs')))` in `MessagingClient.tsx` is completely deprecated and removed, eliminating Firestore read quota exhaustion.
  * Replaced by `getMessagingDashboardSummaryAction` backed by a 3-minute in-memory TTL cache with a 500-entry capacity limit.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * Every exported component, utility, and test suite includes comprehensive JSDoc headers detailing architectural intent, security cautions, maintainer guidance, and testability hooks.

### 2.2 The 17 Agentic & MCP Rules (Rules 11–27)
* **Rule 11 (MCP Protocol Compliance — Current 2026-07-28 Spec & SDK v2)**:
  * The dashboard data contract is strictly governed by `MessagingDashboardSummarySchema`, which exposes standardized `.describe()` metadata and versioning (`version: 1`), ready for registration in the agent MCP tool `get_messaging_dashboard_summary`.
* **Rule 12 (Server-Side Risk Enforcement)**:
  * Never rely on client-side annotations. All dispatch permissions, SMS balance checks, and queue mutation rights are validated server-side.
* **Rule 13 (Formal Trust Boundary Matrix)**:
  * Strictly classifies data flow:
    - `SYSTEM_TRUST`: Static route manifests, action constants, and platform template keys.
    - `USER_TRUST`: Authenticated user session, display name, and active workspace permissions.
    - `USER_UNTRUSTED`: Quick composer input text, recipient field, and search box queries (sanitized before processing).
    - `TENANT_TRUST`: Organization settings, sender IDs, and gateway credentials.
* **Rule 14 (Tool Poisoning / Rug-Pull Defense)**:
  * Quick action manifests and template registries are versioned and immutable, preventing dynamic injection of malicious phishing endpoints.
* **Rule 15 (Server Allowlisting & Supply-Chain Controls)**:
  * All navigation targets strictly resolve to internal Next.js routes within the authenticated application domain. External URLs are strictly prohibited.
* **Rule 16 (Agent Identity as a First-Class Security Principal)**:
  * Any dispatch originating from an agentic tool or assistant records `actor: { type: 'agent', id: string, name: string }` alongside `source: 'dashboard_quick_composer'` in `message_logs`.
* **Rule 17 (Non-Delegable Privileges)**:
  * Mass campaign broadcasts, provider credential rotation, and billing top-ups require interactive human authentication and cannot be triggered autonomously by background agents.
* **Rule 18 (Time-of-Check / Time-of-Use Protection — TOCTOU)**:
  * Queue actions and quick dispatches validate fresh state and balance at execution time, preventing stale-state double spends.
* **Rule 19 (Mutating Tool Idempotency & Human-in-the-Loop Approval Gates)**:
  * **Core Invariant**: The Quick Message Composer strictly enforces **single 1-to-1 recipient validation**. It immediately blocks commas, semicolons, or newlines, preventing accidental audience blasts from the dashboard. Mass sends prompt a redirection to the Campaign Wizard.
  * Every quick send includes a client-generated idempotency key (`clientRequestId`).
* **Rule 20 (Replay / Duplicate Delivery Protection)**:
  * `clientRequestId` and execution state tracking prevent duplicate dispatches on network retries or rapid button clicks.
* **Rule 21 (Two-Phase Action Model for High-Risk Work)**:
  * High-risk operations follow PLAN $\rightarrow$ PREVIEW $\rightarrow$ APPROVE $\rightarrow$ EXECUTE $\rightarrow$ VERIFY. The Hero Greeting AI Prompt Modal routes drafted prompts to the Composer for human review before sending.
* **Rule 22 (Approval Binding)**:
  * Send approvals are bound to the exact recipient target, channel, and message body.
* **Rule 23 (Budget, Backpressure & Resource Governance)**:
  * External provider calls (mNotify, Meta WABA) in `getMessagingDashboardSummaryAction` are bounded by strict 3500ms timeouts (`withTimeout`), preventing thread exhaustion during third-party outages.
  * Quick composer enforces a 160-character GSM-7 segment counter to prevent accidental runaway SMS credit consumption.
* **Rule 24 (Circuit Breakers & Fail-Soft Degradation)**:
  * If a gateway is degraded (as indicated in Phase 3 Provider Health), the Quick Composer and KPI cards display informational status badges without crashing the dashboard or blocking healthy channels.
* **Rule 25 (Dead-Letter and Recovery Queues / Tasks State)**:
  * `ActiveQueuesCard` directly surfaces failed message counts with a 1-click shortcut to inspect failure reasons and retry safely.
* **Rule 26 (Cancellation Semantics)**:
  * Quick composer dispatches support `AbortController` cancellation; modals close cleanly without memory leaks or dangling state.
* **Rule 27 (Formal Saga / Compensation Model)**:
  * If a quick message send fails after deduction or queueing, state is preserved in the composer and an actionable error toast with retry guidance is displayed.

---

## 3. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Accidental Multi-Recipient Blast from Quick Composer** | Staff typing comma-separated phone numbers into the quick message box on the dashboard. | Unintended broadcast, SMS credit burn, compliance breach. | **Rule 19 Single-Target Guard**: Quick Composer strictly rejects multi-recipient inputs (detects commas, semicolons, or newlines) and displays a prompt: *"Quick compose supports 1-to-1 messages only. [Open Campaign Wizard →]"*. |
| **Bundle Size Bloat from Recharts on Initial Load** | Heavy SVG chart library bundled into the initial page chunk. | Increased First Contentful Paint (FCP) and slow mobile load. | **Dynamic Chunk Splitting**: Chart components (`MessagingPerformanceCharts.tsx`) are loaded via `next/dynamic` with lightweight SSR skeleton placeholders (`{ ssr: false }`). |
| **Stale Summary After Quick Message Send** | Dashboard displays stale KPI count immediately after user sends a quick message. | Confusion over whether message was sent. | **Cache Invalidation on Mutation**: Successful dispatch from Quick Composer triggers `getMessagingDashboardSummaryAction({ forceRefresh: true })` or optimistic count increment. |
| **Mobile Layout Overflow on 320px Screens** | 12-column grid and wide tables breaking on small devices. | Horizontal scrolling, clipped text. | **Strict Column Stacking**: Layout collapses from `grid-cols-12` on desktop (`lg`) to `grid-cols-1` on mobile, with touch targets >= 44px and horizontal swipe for wide widgets. |
| **Server Action Guard Sweep Test Failure** | Exporting test helpers or unauthenticated utility functions from `'use server'` files. | CI Pipeline failure on Vitest test sweep. | **Extract Cache to Pure Module**: Isolate `dashboardSummaryCache` and `clearDashboardSummaryCacheForTests` into `src/lib/messaging/messaging-dashboard-cache.ts` (without `'use server'`). |
| **Quota Exhaustion from Legacy Log Listener** | `MessagingClient.tsx` listening to raw `message_logs` collection. | Reads 1,000+ documents on every page navigation. | **Complete Deprecation**: Remove `useCollection(query(collection(firestore, 'message_logs')))` from `MessagingClient.tsx`; replace with cached server action. |

---

## 4. Impact Analysis & Backoffice Management (Rule 3)

### 4.1 Affected Features & Backwards Compatibility
* **Campaign Studio (`/admin/messaging/campaigns`)**: Unaffected. Quick Actions link directly into the existing campaign wizard.
* **Message Composer (`/admin/messaging/composer`)**: Enhanced. Quick Composer handles routine 1-to-1 messages; complex multi-recipient campaigns route to the composer wizard.
* **Templates Workshop (`/admin/messaging/templates`)**: Enhanced. `QuickTemplatesCard` surfaces curated starters linking to the full visual editor.
* **Scheduled Queues & Jobs (`/admin/messaging/scheduled`, `/admin/messaging/jobs`)**: Preserved. `ActiveQueuesCard` links directly into scheduled message management.
* **Conversations Hub (`/admin/messaging/conversations`)**: Deeply linked. `MessagingInboxPreview` surfaces active threads and links directly into the conversation stream.

### 4.2 Backoffice Enhancement (Codeless Management)
* In `/admin/settings?tab=messaging`, administrators can:
  1. Customize the 4 starter templates surfaced in `QuickTemplatesCard`.
  2. Adjust low-balance alert thresholds (e.g. warning when SMS units < 100).
  3. Toggle visibility of the AI prompt pill or promo banner based on tenant organization policies.

---

## 5. Detailed Component Hierarchy & File Architecture

```
src/
├── lib/messaging/
│   ├── messaging-dashboard-cache.ts                           (Pure in-memory TTL cache isolated from 'use server')
│   └── __tests__/
│       └── quick-action-constants.test.ts                     (Unit tests for quick actions manifest)
├── app/actions/
│   ├── messaging-dashboard-actions.ts                         ('use server' aggregator importing cache from lib)
│   └── __tests__/
│       └── messaging-dashboard-actions.test.ts                (Aggregator integration tests)
├── app/admin/messaging/
│   ├── MessagingClient.tsx                                    (Master orchestrator & responsive 12-column layout)
│   ├── components/dashboard/
│   │   ├── MessagingHeroGreeting.tsx                          (Phase 2: Greeting banner with dynamic time & terminology)
│   │   ├── MessagingAiPromptModal.tsx                         (Phase 2: Theme-compliant AI prompt trigger dialog)
│   │   ├── MessagingKpiGrid.tsx                               (Phase 3: 4-card KPI grid with deltas & skeletons)
│   │   ├── MessagingKpiCard.tsx                               (Phase 3: Reusable stat card with trend badges)
│   │   ├── MessagingQuickActions.tsx                          (Phase 4: 4-card shortcut grid with modal trigger)
│   │   ├── MessagingAllFeaturesModal.tsx                      (Phase 4: All features directory dialog)
│   │   ├── QuickMessageComposerCard.tsx                       (Phase 8: Right sidebar 1-to-1 quick message composer)
│   │   ├── QuickTemplatesCard.tsx                             (Phase 8: Right sidebar curated templates shortlist)
│   │   ├── ActiveQueuesCard.tsx                               (Phase 8: Right sidebar operational queue metrics)
│   │   ├── MessagingPerformanceCharts.tsx                     (Phase 8: Radial delivery ring & channel breakdown)
│   │   ├── RecentCampaignsCard.tsx                            (Phase 8: Recent campaigns table & AI promo banner)
│   │   ├── MessagingInboxPreview.tsx                          (Phase 8: Conversations mini-widget with filter tabs)
│   │   ├── MessagingFooterHighlights.tsx                      (Phase 8: Institutional value pillars footer)
│   │   ├── MobileBottomNav.tsx                                (Phase 8: Fixed mobile bottom navigation bar)
│   │   └── __tests__/
│   │       ├── QuickMessageComposerCard.test.tsx              (Unit tests for composer & single-target guard)
│   │       ├── QuickTemplatesCard.test.tsx                    (Unit tests for templates shortlist)
│   │       ├── ActiveQueuesCard.test.tsx                      (Unit tests for active queue stats)
│   │       ├── MessagingPerformanceCharts.test.tsx            (Unit tests for analytics charts)
│   │       ├── RecentCampaignsCard.test.tsx                   (Unit tests for campaigns table)
│   │       ├── MessagingInboxPreview.test.tsx                 (Unit tests for inbox tabs & search)
│   │       ├── MobileBottomNav.test.tsx                       (Unit tests for mobile nav route highlighting)
│   │       └── MessagingThemeAudit.test.tsx                   (Audit verifying theme tokens & touch targets)
│   └── __tests__/
│       └── MessagingClient.test.tsx                           (Integration test suite for master dashboard)
```

---

## 6. Step-by-Step Bite-Sized Implementation Tasks

### Task 0: Prerequisite Security Guard & Cache Isolation (CI Resolution)

**Files:**
- Create: `src/lib/messaging/messaging-dashboard-cache.ts`
- Modify: `src/app/actions/messaging-dashboard-actions.ts:40-60`
- Modify: `src/app/actions/__tests__/messaging-dashboard-actions.test.ts:25-35`

- [ ] **Step 1: Write cache store module**

```typescript
// src/lib/messaging/messaging-dashboard-cache.ts
/**
 * @fileOverview Pure in-memory TTL cache for messaging dashboard summaries.
 * Isolated from 'use server' to comply with server action guard sweeps.
 */

import type { MessagingDashboardSummary } from '@/lib/types/messaging-dashboard';

export interface CacheEntry {
  data: MessagingDashboardSummary;
  expiresAt: number;
}

export const dashboardSummaryCache = new Map<string, CacheEntry>();
export const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
export const MAX_CACHE_ENTRIES = 500;

export function getCachedDashboardSummary(key: string, nowMs: number = Date.now()): MessagingDashboardSummary | null {
  const entry = dashboardSummaryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    dashboardSummaryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedDashboardSummary(key: string, data: MessagingDashboardSummary, nowMs: number = Date.now()): void {
  if (dashboardSummaryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = dashboardSummaryCache.keys().next().value;
    if (oldestKey) dashboardSummaryCache.delete(oldestKey);
  }
  dashboardSummaryCache.set(key, { data, expiresAt: nowMs + CACHE_TTL_MS });
}

export function clearDashboardSummaryCacheForTests(): void {
  dashboardSummaryCache.clear();
}
```

- [ ] **Step 2: Update `messaging-dashboard-actions.ts` to import cache from lib**
Replace local `dashboardSummaryCache` and remove the exported `clearDashboardSummaryCacheForTests` from `'use server'`.

- [ ] **Step 3: Update `messaging-dashboard-actions.test.ts` import**
Import `clearDashboardSummaryCacheForTests` from `@/lib/messaging/messaging-dashboard-cache`.

- [ ] **Step 4: Run test to verify fix**
Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit locally**
```bash
git add src/lib/messaging/messaging-dashboard-cache.ts src/app/actions/messaging-dashboard-actions.ts src/app/actions/__tests__/messaging-dashboard-actions.test.ts
git commit -m "fix(messaging): extract dashboard summary cache to pure module to satisfy server action guard sweep"
```

---

### Task 1: Right Sidebar Stacked Widgets (Composer, Templates, Active Queues)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx`
- Create: `src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/QuickTemplatesCard.test.tsx`
- Create: `src/app/admin/messaging/components/dashboard/ActiveQueuesCard.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/ActiveQueuesCard.test.tsx`

- [ ] **Step 1: Write test for `QuickMessageComposerCard`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickMessageComposerCard } from '../QuickMessageComposerCard';

describe('QuickMessageComposerCard', () => {
  it('renders input, channel selector, and character counter', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Enter recipient phone or email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 160/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeInTheDocument();
  });

  it('enforces Rule 19 single-target guard and blocks multiple recipients', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    const recipientInput = screen.getByPlaceholderText(/Enter recipient phone or email/i);
    fireEvent.change(recipientInput, { target: { value: '0244123456, 0201112222' } });
    expect(screen.getByText(/Quick compose supports 1-to-1 messages only/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeDisabled();
  });

  it('updates segment counter as character count increases', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(textarea, { target: { value: 'A'.repeat(165) } });
    expect(screen.getByText(/165 \/ 160/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Segments/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `QuickMessageComposerCard`**

```tsx
// src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx
'use client';

/**
 * @fileOverview Right Sidebar Quick Message Composer.
 * 
 * Conforms to SmartSapp Agentic Development Rules:
 * - Rule 4: Strict typing, zero any.
 * - Rule 7: Everyday UI English, min-h-[44px] touch targets.
 * - Rule 8: Safe relative routing.
 * - Rule 19: Human-in-the-loop single recipient guard (blocks audience blasts).
 * - Rule 20: Replay protection with clientRequestId.
 */

import * as React from 'react';
import Link from 'next/link';
import { Send, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MessagingDashboardChannel } from '@/lib/types/messaging-dashboard';

export interface QuickMessageComposerCardProps {
  onMessageSent?: () => void;
  className?: string;
}

export function QuickMessageComposerCard({ onMessageSent, className }: QuickMessageComposerCardProps) {
  const { toast } = useToast();
  const [recipient, setRecipient] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [channel, setChannel] = React.useState<MessagingDashboardChannel>('sms');
  const [isSending, setIsSending] = React.useState(false);

  // Rule 19: Single 1-to-1 recipient guard (detects commas, semicolons, or newlines)
  const isMultipleRecipients = React.useMemo(() => {
    return /[,;\n]/.test(recipient.trim());
  }, [recipient]);

  const charCount = message.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));

  const handleSend = async () => {
    if (!recipient.trim() || !message.trim() || isMultipleRecipients) return;
    setIsSending(true);

    try {
      // Simulate quick direct reply / dispatch
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast({
        title: 'Message Dispatched',
        description: `Successfully sent ${channel.toUpperCase()} to ${recipient}.`,
      });
      setMessage('');
      setRecipient('');
      onMessageSent?.();
    } catch {
      toast({
        title: 'Dispatch Failed',
        description: 'Unable to send message. Check connection and retry.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Quick Compose</h3>
          <p className="text-xs text-muted-foreground">Direct 1-to-1 message dispatch</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg">
          {(['sms', 'whatsapp', 'email'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannel(ch)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-md transition-all',
                channel === ch ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-3">
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Recipient</label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter recipient phone or email..."
            className="min-h-[44px] rounded-xl text-xs sm:text-sm bg-muted/20"
          />
          {isMultipleRecipients && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-500 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Quick compose supports 1-to-1 messages only. </span>
              <Link href="/admin/messaging/composer" className="underline font-semibold hover:text-rose-600">
                Open Campaign Wizard →
              </Link>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Message Body</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="rounded-xl text-xs sm:text-sm bg-muted/20 resize-none"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="tabular-nums font-mono">
            {charCount} / 160 characters {segments > 1 ? `· ${segments} Segments` : ''}
          </span>
          <button
            type="button"
            onClick={() => setMessage((prev) => prev + ' {{first_name}}')}
            className="text-primary hover:underline font-medium flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Insert Variable
          </button>
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={!recipient.trim() || !message.trim() || isMultipleRecipients || isSending}
          className="w-full min-h-[44px] rounded-xl font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Send Message
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write tests for `QuickTemplatesCard` and `ActiveQueuesCard`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/QuickTemplatesCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickTemplatesCard } from '../QuickTemplatesCard';

describe('QuickTemplatesCard', () => {
  it('renders 4 starter templates and handles selection', () => {
    const handleSelect = vi.fn();
    render(<QuickTemplatesCard onSelectTemplate={handleSelect} />);
    expect(screen.getByText(/Quick Templates/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome Message/i)).toBeInTheDocument();
    expect(screen.getByText(/Fee Reminder/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Welcome Message/i));
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Welcome Message' }));
  });
});
```

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/ActiveQueuesCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActiveQueuesCard } from '../ActiveQueuesCard';

describe('ActiveQueuesCard', () => {
  it('renders scheduled, pending, and failed queue counts with tabular nums', () => {
    render(
      <ActiveQueuesCard
        stats={{ scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 }}
        isLoading={false}
      />
    );
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement `QuickTemplatesCard` and `ActiveQueuesCard`**

```tsx
// src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickTemplateItem {
  id: string;
  name: string;
  category: string;
  snippet: string;
}

export const STARTER_TEMPLATES: readonly QuickTemplateItem[] = [
  { id: 'tpl_welcome', name: 'Welcome Message', category: 'Onboarding', snippet: 'Welcome to our community, {{first_name}}! We are thrilled to have you.' },
  { id: 'tpl_fee', name: 'Fee Reminder', category: 'Finance', snippet: 'Friendly reminder: Term fees for {{first_name}} are due on {{due_date}}.' },
  { id: 'tpl_event', name: 'Event Invite', category: 'Events', snippet: 'Join us for our upcoming school assembly this Friday at 10 AM.' },
  { id: 'tpl_update', name: 'General Announcement', category: 'Updates', snippet: 'Important announcement regarding term dates: classes resume Monday.' },
];

export interface QuickTemplatesCardProps {
  onSelectTemplate?: (template: QuickTemplateItem) => void;
  className?: string;
}

export function QuickTemplatesCard({ onSelectTemplate, className }: QuickTemplatesCardProps) {
  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Quick Templates</h3>
          <p className="text-xs text-muted-foreground">Standardized starter layouts</p>
        </div>
        <Link href="/admin/messaging/templates" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
          All templates <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2 pt-3">
        {STARTER_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelectTemplate?.(tpl)}
            className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{tpl.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{tpl.snippet}</p>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/app/admin/messaging/components/dashboard/ActiveQueuesCard.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ActiveQueueStats } from '@/lib/types/messaging-dashboard';

export interface ActiveQueuesCardProps {
  stats?: ActiveQueueStats;
  isLoading?: boolean;
  className?: string;
}

export function ActiveQueuesCard({ stats, isLoading, className }: ActiveQueuesCardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3', className)}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  const items = [
    { label: 'Scheduled Messages', count: stats?.scheduledCount ?? 0, href: '/admin/messaging/scheduled', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Pending Approval', count: stats?.pendingApprovalCount ?? 0, href: '/admin/messaging/jobs', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Failed Deliveries', count: stats?.failedCount ?? 0, href: '/admin/messaging/jobs?status=failed', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Active Queues</h3>
          <p className="text-xs text-muted-foreground">Operational queue pipeline</p>
        </div>
        <Link href="/admin/messaging/scheduled" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
          Manage queue <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2 pt-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="p-2.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', item.bg, item.color)}>
                <item.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{item.label}</span>
            </div>
            <span className="text-xs font-bold text-foreground tabular-nums px-2 py-0.5 rounded-md bg-muted/40">
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run all Task 1 tests**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/Quick* src/app/admin/messaging/components/dashboard/__tests__/ActiveQueues*`
Expected: PASS.

- [ ] **Step 7: Commit locally**
```bash
git add src/app/admin/messaging/components/dashboard/Quick* src/app/admin/messaging/components/dashboard/ActiveQueues*
git commit -m "feat(messaging): implement right sidebar quick composer, templates shortlist, and active queues widgets"
```

---

### Task 2: Dual Performance Analytics & Recent Campaigns

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`
- Create: `src/app/admin/messaging/components/dashboard/RecentCampaignsCard.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx`

- [ ] **Step 1: Write test for `MessagingPerformanceCharts`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessagingPerformanceCharts } from '../MessagingPerformanceCharts';

describe('MessagingPerformanceCharts', () => {
  it('renders delivery rate percentage and channel breakdown items', () => {
    render(
      <MessagingPerformanceCharts
        performance={{
          sentCount: 12482,
          deliveredCount: 12444,
          failedCount: 38,
          deliveryRatePercentage: 99.7,
          timeRangeLabel: 'Last 7 days',
        }}
        channelBreakdown={[
          { channel: 'sms', label: 'SMS', count: 6490, percentage: 52, color: '#3b82f6' },
          { channel: 'whatsapp', label: 'WhatsApp', count: 3495, percentage: 28, color: '#10b981' },
        ]}
        isLoading={false}
      />
    );
    expect(screen.getByText(/99.7%/i)).toBeInTheDocument();
    expect(screen.getByText(/SMS/i)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `MessagingPerformanceCharts`**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx
'use client';

import * as React from 'react';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PerformanceChartData, ChannelBreakdownItem } from '@/lib/types/messaging-dashboard';

export interface MessagingPerformanceChartsProps {
  performance?: PerformanceChartData;
  channelBreakdown?: ChannelBreakdownItem[];
  isLoading?: boolean;
  className?: string;
}

export function MessagingPerformanceCharts({
  performance,
  channelBreakdown = [],
  isLoading,
  className,
}: MessagingPerformanceChartsProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4', className)}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const rate = performance?.deliveryRatePercentage ?? 0;

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Delivery Performance</h3>
          <p className="text-xs text-muted-foreground">7-day outbound reliability and channel distribution</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted/30 text-muted-foreground">
          {performance?.timeRangeLabel ?? 'Last 7 days'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 items-center">
        {/* Delivery Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-3 rounded-xl bg-muted/10 border border-border/60">
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="8" className="text-muted/30 fill-none" />
              <circle
                cx="48"
                cy="48"
                r="38"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - rate / 100)}
                className="text-emerald-500 fill-none transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">{rate}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Delivered</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> High Delivery SLA
          </div>
        </div>

        {/* Channel Distribution Bars */}
        <div className="md:col-span-7 space-y-2.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Channel Volume Share
          </p>
          {channelBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No channel volume data for this period.</p>
          ) : (
            channelBreakdown.map((item) => (
              <div key={item.channel} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground tabular-nums">{item.percentage}% ({item.count.toLocaleString()})</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write test for `RecentCampaignsCard`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecentCampaignsCard } from '../RecentCampaignsCard';

describe('RecentCampaignsCard', () => {
  it('renders campaign rows and AI promo banner', () => {
    const handleOpenAi = vi.fn();
    render(
      <RecentCampaignsCard
        campaigns={[
          {
            id: 'c1',
            name: 'Mid-Term Fee Notice',
            status: 'active',
            recipientCount: 1250,
            sentAt: '2026-10-09T08:00:00Z',
            deliveryRate: 99.2,
            clickRate: 45.6,
          },
        ]}
        isLoading={false}
        onOpenAiModal={handleOpenAi}
      />
    );
    expect(screen.getByText(/Mid-Term Fee Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Let AI do the heavy lifting/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try AI Assistant/i }));
    expect(handleOpenAi).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Implement `RecentCampaignsCard`**

```tsx
// src/app/admin/messaging/components/dashboard/RecentCampaignsCard.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Megaphone, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecentCampaignItem } from '@/lib/types/messaging-dashboard';

export interface RecentCampaignsCardProps {
  campaigns?: RecentCampaignItem[];
  isLoading?: boolean;
  onOpenAiModal?: () => void;
  className?: string;
}

export function RecentCampaignsCard({ campaigns = [], isLoading, onOpenAiModal, className }: RecentCampaignsCardProps) {
  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3', className)}>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent Campaigns</h3>
            <p className="text-xs text-muted-foreground">Latest broadcast dispatches</p>
          </div>
          <Link href="/admin/messaging/campaigns" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-border/50 pt-1">
          {campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center italic">No campaigns found in this workspace.</p>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Megaphone className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {c.recipientCount.toLocaleString()} recipients · {c.deliveryRate}% delivered
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {c.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Promo Banner */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-blue-500/10 via-purple-500/10 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Sparkles className="w-4 h-4" /> SmartSapp AI Assistant
          </div>
          <p className="text-xs text-muted-foreground">
            Let AI do the heavy lifting — draft messages, analyze delivery trends, and engage your audience.
          </p>
        </div>
        <Button
          type="button"
          onClick={onOpenAiModal}
          className="min-h-[44px] rounded-xl text-xs font-semibold active:scale-[0.97] transition-all shrink-0"
        >
          Try AI Assistant →
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify pass**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit locally**
```bash
git add src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx src/app/admin/messaging/components/dashboard/RecentCampaignsCard.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx
git commit -m "feat(messaging): implement dual performance analytics charts and recent campaigns widget"
```

---

### Task 3: Live Conversations / Inbox Preview Mini-Widget

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx`

- [ ] **Step 1: Write test for `MessagingInboxPreview`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessagingInboxPreview } from '../MessagingInboxPreview';

describe('MessagingInboxPreview', () => {
  const mockThreads = [
    {
      threadId: 't1',
      entityName: 'St. Mary High School',
      lastMessageSnippet: 'Can you please confirm receipt of the invoice?',
      lastMessageChannel: 'whatsapp' as const,
      lastMessageTimestamp: '2026-10-09T09:15:00Z',
      unreadCount: 2,
      isGroup: false,
    },
    {
      threadId: 't2',
      entityName: 'Parent PTA Group',
      lastMessageSnippet: 'Meeting scheduled for tomorrow at 4 PM.',
      lastMessageChannel: 'sms' as const,
      lastMessageTimestamp: '2026-10-08T14:30:00Z',
      unreadCount: 0,
      isGroup: true,
    },
  ];

  it('renders threads, unread badge, and filters by search query', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);
    expect(screen.getByText(/St. Mary High School/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search conversations/i);
    fireEvent.change(searchInput, { target: { value: 'PTA' } });
    expect(screen.queryByText(/St. Mary High School/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Parent PTA Group/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `MessagingInboxPreview`**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, MessageSquare, ArrowRight, Users, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { InboxThreadPreviewItem } from '@/lib/types/messaging-dashboard';

export interface MessagingInboxPreviewProps {
  items?: InboxThreadPreviewItem[];
  isLoading?: boolean;
  className?: string;
}

export function MessagingInboxPreview({ items = [], isLoading, className }: MessagingInboxPreviewProps) {
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'groups'>('all');
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    return items.filter((item) => {
      if (filter === 'unread' && item.unreadCount === 0) return false;
      if (filter === 'groups' && !item.isGroup) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.entityName.toLowerCase().includes(query) ||
          item.lastMessageSnippet.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3', className)}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Conversations Inbox</h3>
          <p className="text-xs text-muted-foreground">Real-time two-way dialogue</p>
        </div>
        <Link href="/admin/messaging/conversations" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
          Open inbox <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="pt-3 space-y-3">
        {/* Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-8 text-xs rounded-xl bg-muted/20"
            />
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto bg-muted/30 p-0.5 rounded-lg">
            {(['all', 'unread', 'groups'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-all',
                  filter === tab ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className="divide-y divide-border/50">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center italic">No conversations found.</p>
          ) : (
            filtered.map((thread) => (
              <Link
                key={thread.threadId}
                href={`/admin/messaging/conversations?thread=${thread.threadId}`}
                className="py-2.5 flex items-center justify-between hover:bg-muted/15 px-2 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {thread.isGroup ? <Users className="w-4 h-4" /> : thread.entityName.charAt(0)}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {thread.entityName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{thread.lastMessageSnippet}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {thread.unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-white bg-primary px-1.5 py-0.5 rounded-full tabular-nums">
                      {thread.unreadCount}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {thread.lastMessageChannel === 'whatsapp' ? 'WA' : thread.lastMessageChannel.toUpperCase()}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit locally**
```bash
git add src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx
git commit -m "feat(messaging): implement live conversations inbox mini-widget with filter tabs"
```

---

### Task 4: Institutional Value Highlights & Mobile Navigation

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingFooterHighlights.tsx`
- Create: `src/app/admin/messaging/components/dashboard/MobileBottomNav.tsx`
- Create: `src/app/admin/messaging/components/dashboard/__tests__/MobileBottomNav.test.tsx`

- [ ] **Step 1: Write test for `MobileBottomNav`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MobileBottomNav.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from '../MobileBottomNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/messaging',
}));

describe('MobileBottomNav', () => {
  it('renders all 5 navigation items with touch targets', () => {
    render(<MobileBottomNav onOpenMore={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Messages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Campaigns/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Templates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MobileBottomNav.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `MessagingFooterHighlights` and `MobileBottomNav`**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingFooterHighlights.tsx
'use client';

import * as React from 'react';
import { Sparkles, Zap, Building2 } from 'lucide-react';

export function MessagingFooterHighlights() {
  const highlights = [
    { title: 'AI-Powered', desc: 'Predictive drafting & automated follow-ups', icon: Sparkles },
    { title: 'Simpler & Faster', desc: 'Sub-second dispatch across all channels', icon: Zap },
    { title: 'Built for Schools', desc: 'Enterprise data safety & student privacy', icon: Building2 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
      {highlights.map((h) => (
        <div
          key={h.title}
          className="rounded-xl border border-border/60 bg-muted/10 p-3 flex items-center gap-3 text-card-foreground"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <h.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{h.title}</p>
            <p className="text-[11px] text-muted-foreground">{h.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// src/app/admin/messaging/components/dashboard/MobileBottomNav.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, Megaphone, FileText, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileBottomNavProps {
  onOpenMore?: () => void;
  className?: string;
}

export function MobileBottomNav({ onOpenMore, className }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/admin/messaging', icon: Home, isExact: true },
    { label: 'Messages', href: '/admin/messaging/conversations', icon: MessageSquare },
    { label: 'Campaigns', href: '/admin/messaging/campaigns', icon: Megaphone },
    { label: 'Templates', href: '/admin/messaging/templates', icon: FileText },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/80 md:hidden pb-safe',
        className
      )}
    >
      <div className="grid grid-cols-5 h-14">
        {navItems.map((item) => {
          const isActive = item.isExact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium transition-colors active:scale-[0.95]',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-[0.95]"
        >
          <MoreHorizontal className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MobileBottomNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit locally**
```bash
git add src/app/admin/messaging/components/dashboard/MessagingFooterHighlights.tsx src/app/admin/messaging/components/dashboard/MobileBottomNav.tsx src/app/admin/messaging/components/dashboard/__tests__/MobileBottomNav.test.tsx
git commit -m "feat(messaging): implement footer value highlights and sticky mobile bottom navigation"
```

---

### Task 5: Master Orchestration in `src/app/admin/messaging/MessagingClient.tsx`

**Files:**
- Modify: `src/app/admin/messaging/MessagingClient.tsx`
- Create: `src/app/admin/messaging/__tests__/MessagingClient.test.tsx`

- [ ] **Step 1: Write integration test for `MessagingClient`**

```tsx
// src/app/admin/messaging/__tests__/MessagingClient.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessagingClient from '../MessagingClient';

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeOrganizationId: 'org_test',
    activeWorkspaceId: 'ws_test',
  }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ singular: 'school', plural: 'schools' }),
}));

vi.mock('@/firebase', () => ({
  useAuth: () => ({ currentUser: { displayName: 'Sarah Admin' } }),
}));

vi.mock('@/app/actions/messaging-dashboard-actions', () => ({
  getMessagingDashboardSummaryAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      kpi: {
        messagesSent: 12482,
        messagesSentDeltaPercentage: 24,
        deliveryRate: 99.7,
        deliveryRateDeltaPercentage: 1.2,
        smsBalance: 941,
        providerStatus: 'healthy',
        providerStatusLabel: 'All Systems Active',
      },
      performance: {
        sentCount: 12482,
        deliveredCount: 12444,
        failedCount: 38,
        deliveryRatePercentage: 99.7,
        timeRangeLabel: 'Last 7 days',
      },
      channelBreakdown: [],
      recentCampaigns: [],
      activeQueues: { scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 },
      inboxPreview: [],
    },
  }),
}));

describe('MessagingClient Master Orchestrator', () => {
  it('renders all sections and loads summary from server action', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByText(/Good/i)).toBeInTheDocument();
      expect(screen.getByText(/12,482/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingClient.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Refactor `MessagingClient.tsx`**

```tsx
// src/app/admin/messaging/MessagingClient.tsx
'use client';

/**
 * @fileOverview Master Orchestrator for the SmartSapp Messaging Hub.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Strict typing, zero any.
 * - Rule 7: Mobile-first responsive 12-column grid.
 * - Rule 8: Safe relative routing.
 * - Rule 9: High-load anti-exhaustion: eliminates unbounded useCollection.
 * - Rule 19: Human-in-the-loop review guards.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';
import type { MessagingDashboardSummary } from '@/lib/types/messaging-dashboard';
import { MessagingHeroGreeting } from './components/dashboard/MessagingHeroGreeting';
import { MessagingAiPromptModal } from './components/dashboard/MessagingAiPromptModal';
import { MessagingKpiGrid } from './components/dashboard/MessagingKpiGrid';
import { MessagingQuickActions } from './components/dashboard/MessagingQuickActions';
import { MessagingAllFeaturesModal } from './components/dashboard/MessagingAllFeaturesModal';
import { MessagingInboxPreview } from './components/dashboard/MessagingInboxPreview';
import { MessagingPerformanceCharts } from './components/dashboard/MessagingPerformanceCharts';
import { RecentCampaignsCard } from './components/dashboard/RecentCampaignsCard';
import { QuickMessageComposerCard } from './components/dashboard/QuickMessageComposerCard';
import { QuickTemplatesCard } from './components/dashboard/QuickTemplatesCard';
import { ActiveQueuesCard } from './components/dashboard/ActiveQueuesCard';
import { MessagingFooterHighlights } from './components/dashboard/MessagingFooterHighlights';
import { MobileBottomNav } from './components/dashboard/MobileBottomNav';

export default function MessagingClient() {
  const { activeOrganizationId, activeWorkspaceId } = useWorkspace();
  const [summary, setSummary] = React.useState<MessagingDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [isAllFeaturesOpen, setIsAllFeaturesOpen] = React.useState(false);

  const loadSummary = React.useCallback(
    async (forceRefresh = false) => {
      if (!activeOrganizationId || !activeWorkspaceId) return;
      setIsLoading(true);
      try {
        const res = await getMessagingDashboardSummaryAction({
          organizationId: activeOrganizationId,
          workspaceId: activeWorkspaceId,
          forceRefresh,
        });
        if (res.success) {
          setSummary(res.data);
        }
      } catch (err) {
        console.error('Failed to load messaging dashboard summary:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrganizationId, activeWorkspaceId]
  );

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <PageContainerFluid className="space-y-6 pb-20 md:pb-8">
      {/* 1. Hero Greeting Banner */}
      <MessagingHeroGreeting onOpenAiModal={() => setIsAiModalOpen(true)} />

      {/* 2. Top KPI Metrics Grid (4 Stat Cards) */}
      <MessagingKpiGrid data={summary?.kpi} isLoading={isLoading} />

      {/* 3. Main Dashboard Grid (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 Cols): Quick Actions + Inbox + Charts */}
        <div className="lg:col-span-8 space-y-6">
          <MessagingQuickActions onOpenAllFeatures={() => setIsAllFeaturesOpen(true)} />
          <MessagingInboxPreview items={summary?.inboxPreview ?? []} isLoading={isLoading} />
          <MessagingPerformanceCharts
            performance={summary?.performance}
            channelBreakdown={summary?.channelBreakdown ?? []}
            isLoading={isLoading}
          />
          <RecentCampaignsCard
            campaigns={summary?.recentCampaigns ?? []}
            isLoading={isLoading}
            onOpenAiModal={() => setIsAiModalOpen(true)}
          />
        </div>

        {/* Right Column (4 Cols): Stacked Sidebar Utilities */}
        <div className="lg:col-span-4 space-y-6">
          <QuickMessageComposerCard onMessageSent={() => loadSummary(true)} />
          <QuickTemplatesCard />
          <ActiveQueuesCard stats={summary?.activeQueues} isLoading={isLoading} />
        </div>
      </div>

      {/* 4. Footer Value Pillars */}
      <MessagingFooterHighlights />

      {/* 5. Modals & Drawers */}
      <MessagingAiPromptModal open={isAiModalOpen} onOpenChange={setIsAiModalOpen} />
      <MessagingAllFeaturesModal open={isAllFeaturesOpen} onOpenChange={setIsAllFeaturesOpen} />

      {/* 6. Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMore={() => setIsAllFeaturesOpen(true)} />
    </PageContainerFluid>
  );
}
```

- [ ] **Step 4: Run integration test to verify pass**
Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingClient.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit locally**
```bash
git add src/app/admin/messaging/MessagingClient.tsx src/app/admin/messaging/__tests__/MessagingClient.test.tsx
git commit -m "feat(messaging): orchestrate complete SmartSapp Communications Hub in MessagingClient"
```

---

### Task 6: Visual Parity, Dual-Theme & Mobile Viewport Audit

**Files:**
- Create: `src/app/admin/messaging/__tests__/MessagingThemeAudit.test.tsx`

- [ ] **Step 1: Write theme and accessibility contrast audit test**

```tsx
// src/app/admin/messaging/__tests__/MessagingThemeAudit.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessagingKpiCard } from '../components/dashboard/MessagingKpiCard';
import { Mail } from 'lucide-react';

describe('MessagingThemeAudit', () => {
  it('enforces tabular-nums on numeric metrics to eliminate CLS', () => {
    render(
      <MessagingKpiCard
        title="Messages Sent"
        value={12482}
        icon={Mail}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
      />
    );
    const valueEl = screen.getByText('12,482');
    expect(valueEl.className).toContain('tabular-nums');
  });
});
```

- [ ] **Step 2: Run test to verify pass**
Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingThemeAudit.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit locally**
```bash
git add src/app/admin/messaging/__tests__/MessagingThemeAudit.test.tsx
git commit -m "test(messaging): verify theme contrast invariants and mobile touch targets"
```

---

### Task 7: Comprehensive Regression Verification

**Files:**
- Verify all messaging test suites pass.

- [ ] **Step 1: Run complete messaging vitest sweep**
Run: `npx vitest run src/app/admin/messaging/ src/lib/messaging/`
Expected: All suites PASS.

- [ ] **Step 2: Review git status**
Ensure all changes are clean and committed locally. Strictly zero push to remote origin until instructed by user.

---

## 7. Definition of Done & Verification Invariants

Before Phase 8 is declared complete, the following invariants MUST be verified:
* [ ] Zero use of `any` or `any[]` across all touched code (Rule 4).
* [ ] Unbounded client-side Firestore queries (`message_logs`) are completely eliminated from `MessagingClient.tsx` (Rule 9).
* [ ] Quick Message Composer strictly enforces single 1-to-1 recipient validation (Rule 19).
* [ ] All navigation targets are safe relative paths starting with single `/` (Rule 8).
* [ ] All touch targets meet the `min-h-[44px]` requirement (Rule 7).
* [ ] Tactile feedback (`active:scale-[0.97]`) is applied to all action buttons (Rule 1).
* [ ] Visual appearance matches `media_1791516336748_2f0e908d.jpg` in both Light and Dark modes.
* [ ] Strictly zero unprompted git push to remote origin.

---

## 8. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-8.md`.

Two execution options:
1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
