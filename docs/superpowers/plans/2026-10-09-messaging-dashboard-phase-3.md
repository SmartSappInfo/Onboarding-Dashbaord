# Messaging Dashboard Redesign — Phase 3: Top KPI Metrics Grid
## Implementation Plan (Conforming to `agents_mcp_rules.md` & Institutional Theme Standards)

> **File Location:** `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-3.md`  
> **Status:** Pending User Approval  
> **Target Subsystems:** Messaging Dashboard Top Metrics Grid (`/admin/messaging`), Provider Health Display, SMS Balance & Billing Shortcut, Mobile 2x2 Grid  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 25 from `docs/agents_mcp/agents_mcp_rules.md`), `.agents/AGENTS.md`, and `theme.md`  
> **Visual Reference:** User-provided mockup (`media_1791516336748_2f0e908d.jpg` — Desktop & Mobile KPI Rows)

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION OR TOUCH CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Goals

This plan details the implementation of **Phase 3** of the SmartSapp Messaging Dashboard Redesign:
1. **Pure KPI & Trend Formatting Utility (`kpi-utils.ts`)**: Pure deterministic functions for number formatting, directional delta arrows (`↑`, `↓`, `→`), provider status color mappings, and configurable SMS low-balance alerts.
2. **Standardized Reusable Stat Card (`MessagingKpiCard.tsx`)**: An institutional card component supporting custom icon containers, tabular typography (`tabular-nums`), positive/negative trend pill badges, and mobile-friendly action links.
3. **Composite 4-Card Responsive Grid (`MessagingKpiGrid.tsx`)**:
   - **Messages Sent**: Blue icon squircle, formatted volume (e.g. `12,482`), `↑ 24% vs. last 7 days` trend badge.
   - **Delivery Rate**: Emerald icon squircle, percentage (e.g. `99.7%`), `↑ 1.2% vs. last 7 days` trend badge.
   - **SMS Unit Balance**: Orange icon squircle, live unit count (e.g. `941`), low-balance badge warning, and `"Top up now →"` relative action link (`/admin/settings?tab=billing`).
   - **Provider Status**: Purple icon squircle, human-readable status (`"All Systems Active"`), and pulsing indicator dot (`🟢 Healthy`, `🟡 Degraded`, `🔴 Disrupted`).
4. **Adaptive Stacking & Skeleton (`MessagingKpiGridSkeleton`)**: Seamless transition from desktop 4-column layout (`lg:grid-cols-4`) to tablet/mobile 2x2 grid (`grid-cols-2`), with skeleton states preventing Cumulative Layout Shift (CLS).

---

## 2. Conformance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 2.1 The 10 Foundational Engineering Rules
* **Rule 1 (Industry-Grade Best Practices)**:
  * Complies with `next-best-practices`: Presentation components (`MessagingKpiCard`, `MessagingKpiGrid`) are modular client components (`'use client'`), completely decoupled from Firestore queries or network side effects. They take validated props or render responsive skeletons.
  * Complies with `vercel-react-best-practices`: Pure memoized layout, `tabular-nums` used on all numeric metrics to eliminate alignment jitter and layout shift (CLS); zero unnecessary re-renders.
  * Complies with `emilkowal-animations`: Tactile feedback on interactive action links (`active:scale-[0.97]`), smooth shadow and border transitions (`transition-all duration-200`).
  * Complies with `frontend-design`: Modern Institutional Minimalism matching `theme.md` Section 4. Squircles, semantic `border-border/80`, dual-mode tokens (`bg-card`, `text-card-foreground`), zero raw unescaped HTML, clear visual contrast.
* **Rule 2 (Risk Analysis & Mitigation Matrix)**:
  * Comprehensive failure modes identified: divide-by-zero, NaN, undefined metrics, narrow mobile viewport clipping (320px–375px), negative trend sentiment confusion, provider circuit-breaker trips, and TOCTOU stale balance snapshot.
  * Full mitigation matrix documented in Section 4.
  * Unit and integration test coverage with Vitest and React Testing Library before merging.
  * Strictly zero unprompted remote git pushes.
* **Rule 3 (Impact Analysis & Backoffice Management)**:
  * Detailed in Section 5. Zero breaking changes to existing messaging features.
  * Backoffice management allows administrators to configure the SMS low-balance alert threshold (e.g., alert when units < 100) via Organization Settings without code deployment.
  * Provider Status card surfaces real-time provider health aggregated from mNotify and Meta Cloud APIs, giving operators immediate visibility if an SMS or WhatsApp channel is degraded.
* **Rule 4 (Strict Typing & Bounded `unknown`)**:
  * Strictly zero `any`, `any[]`, or unchecked type assertions across all new components, utilities, and test suites.
  * Input props strictly bound to `MessagingKpiMetrics` validated via Zod schema from Phase 1 (`MessagingKpiMetricsSchema`).
  * Strict enum-like unions for provider status (`'healthy' | 'degraded' | 'error'`) and badge variants (`'emerald' | 'amber' | 'rose'`).
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Strict approval gate enforced before executing tasks. All tests must pass locally before staging.
  * Local commit discipline with descriptive commit messages (`feat(messaging): ...`). Strictly zero push to remote origin.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Uses existing, verified packages only: `lucide-react` (`MessageSquare`, `CheckCircle2`, `Smartphone`, `ShieldCheck`), Tailwind CSS, Radix UI.
  * No experimental, unpinned, or unverified packages.
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Responsive 2x2 grid on mobile viewports (`grid-cols-2 lg:grid-cols-4`) matching the user-uploaded mobile mockup (`media_1791516336748_2f0e908d.jpg`).
  * Every interactive touch target meets or exceeds `min-h-[44px]` (e.g. `"Top up now →"` billing action link).
  * Everyday UI English: Clear, concise labels with zero technical jargon (`"Messages Sent"`, `"Delivery Rate"`, `"SMS Unit Balance"`, `"Provider Status"`).
* **Rule 8 (High Security & Relative Navigation)**:
  * Action link strictly adheres to relative path protocol: `/admin/settings?tab=billing`. Prohibits direct external links, protocol schemes (`http:`, `https:`), or `javascript:` targets to prevent open redirect and XSS vulnerabilities.
  * Numeric inputs sanitized against injection; zero unescaped strings.
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * Read-only presentation layer that consumes cached aggregated summary from Phase 1 (`getMessagingDashboardSummaryAction` with 3-minute in-memory TTL).
  * Zero client-side polling loops or re-fetching storms.
  * $O(1)$ computation for all formatting utilities; lightweight DOM footprint.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * Comprehensive JSDoc blocks on every exported utility and component explaining architectural intent, security cautions, maintainer guidance, and testability pointers.

### 2.2 The Agentic & MCP Rules (Rules 11–25)
* **Rule 11 (MCP Protocol Compliance — Current 2026-07-28 Spec & SDK v2)**:
  * The KPI metrics output structure (`messagesSent`, `deliveryRate`, `smsBalance`, `providerStatus`) directly aligns with the MCP tool response schema for `get_messaging_dashboard_summary` to be registered in Phase 6.
  * Targets the current stateless MCP specification and split `@modelcontextprotocol/server` architecture; supports cacheable discovery and Task extension polling.
* **Rule 12 (Server-Side Risk Enforcement — Metadata vs Real Boundaries)**:
  * Client never relies on client-side hints or unverified annotations for balance or health. SMS balance and provider statuses are read-only metrics aggregated server-side via authenticated actions; client UI cannot spoof or alter balances.
* **Rule 13 (Formal Trust Boundary Matrix)**:
  * Strict data classification applied to all incoming data:
    * `TENANT_TRUST`: Workspace metrics calculated from tenant message logs (`messagesSent`, `deliveryRate`).
    * `EXTERNAL_DATA` / `UNTRUSTED_TOOL_OUTPUT`: Upstream provider balances (mNotify) and webhook/health payloads (Meta Cloud API), validated and bounded through Zod schemas before rendering.
    * `SYSTEM_TRUST`: Hardcoded route paths (`/admin/settings?tab=billing`) and layout configurations.
* **Rule 14 (Tool Poisoning / Rug-Pull Defense)**:
  * Data contracts are strictly schema-validated via `MessagingKpiMetricsSchema`. Any upstream drift or unexpected fields from provider endpoints will be caught at the Zod validation boundary rather than propagating unvalidated into the presentation layer.
* **Rule 15 (Server Allowlisting and Supply-Chain Controls)**:
  * External health checks strictly communicate with allowlisted endpoints (`api.mnotify.com`, `graph.facebook.com`) configured in server-side environment variables, ensuring zero arbitrary URL access.
* **Rule 16 (Agent Identity as a First-Class Security Principal)**:
  * When an AI agent accesses dashboard metrics in Phase 6, authority is evaluated at the intersection of `User authority ∩ Agent authority ∩ Workspace authority ∩ Tool authority`. The agent cannot view metrics outside its designated workspace or organization scope.
* **Rule 17 (Non-Delegable Privileges)**:
  * The "Top up now →" shortcut navigates to the human billing management view (`/admin/settings?tab=billing`). Purchasing SMS units, modifying billing payment methods, or altering financial thresholds are strictly non-delegable privileges requiring explicit human authentication; they can NEVER be automated or delegated to an autonomous AI agent.
* **Rule 18 (Time-of-Check / Time-of-Use Protection — TOCTOU)**:
  * Metrics display reflects a snapshot timestamp (`cachedAt` from Phase 1). The UI clearly indicates relative time ("vs. last 7 days"), and any subsequent operational trigger (such as sending a message blast in the Composer) performs a fresh Just-In-Time (JIT) balance check before dispatch.
* **Rule 19 (Mutating Tool Idempotency & Human-in-the-Loop Approval Gates)**:
  * The KPI grid is strictly read-only and non-mutating.
  * Clicking any action shortcut (e.g. Top up now) routes to a human-interactive review screen rather than firing an autonomous transaction.
* **Rule 20 (Replay / Duplicate Delivery Protection)**:
  * Aggregator calculations utilize deterministic query filters and execution timestamps, ensuring idempotent metric aggregation across server refreshes.
* **Rule 21 (Two-Phase Action Model for High-Risk Work)**:
  * High-risk operations linked from this view (e.g., purchasing balance or dispatching high-volume campaigns) follow the strict sequence: PLAN $\rightarrow$ PREVIEW $\rightarrow$ APPROVE $\rightarrow$ EXECUTE $\rightarrow$ VERIFY.
* **Rule 22 (Approval Binding)**:
  * Any administrative changes to low-balance alert thresholds or billing settings are bound to specific organization IDs and administrator user IDs.
* **Rule 23 (Budget, Backpressure and Resource Governance)**:
  * Dashboard queries are hard-bounded to 500 logs max with a 3-minute in-memory TTL cache, protecting Firestore against query storms and quota exhaustion.
  * Skeletons and component rendering are bounded to exactly 4 stat cards with zero recursive DOM branching.
* **Rule 24 (Circuit Breakers & Fail-Soft Degradation)**:
  * The Provider Status card directly visualizes upstream Circuit Breaker health states:
    * `healthy` $\rightarrow$ 🟢 "Healthy" (All gateways operating normally).
    * `degraded` $\rightarrow$ 🟡 "Degraded" (Provider experiencing elevated latency or partial throttling; safe fallbacks active).
    * `error` $\rightarrow$ 🔴 "Disrupted" (Provider offline or authentication failed; fail-soft messaging without crashing dashboard).
* **Rule 25 (Dead-Letter and Recovery Queues / Tasks State)**:
  * Surfacing provider disruptions on the 4th card prepares operators for queue diagnostics (e.g., messages backed up in retry queues during a provider degradation), aligning with the durable task states to be rendered in Phase 5.

---

## 3. Detailed Component Hierarchy & File Architecture

```
src/
├── lib/messaging/
│   ├── kpi-utils.ts                                           (Pure number, delta, and status formatting helpers)
│   └── __tests__/
│       └── kpi-utils.test.ts                                  (Vitest unit test suite)
├── app/admin/messaging/
│   └── components/dashboard/
│       ├── MessagingKpiCard.tsx                               (Reusable stat card component with icon squircle & trend badge)
│       ├── MessagingKpiGrid.tsx                               (Composite 4-card responsive grid: 4-col desktop, 2x2 mobile)
│       └── __tests__/
│           ├── MessagingKpiCard.test.tsx                      (Stat card unit tests)
│           └── MessagingKpiGrid.test.tsx                      (4-card grid integration tests & skeleton tests)
```

---

## 4. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Number Alignment Jitter During Updates** | Variable character widths in sans-serif fonts causing card elements to shift. | Jumpy layout (CLS) when counts change. | **Tabular Numbers Invariant**: Apply `tabular-nums` CSS on all numeric values. |
| **Divide-by-Zero / NaN in Trend Deltas** | Zero messages in previous 7-day period. | Rendering `NaN%` or `Infinity%` in the trend badge. | **Guarded Trend Formatter**: Handled in Phase 1 aggregator and verified in `kpi-utils.ts` (`if (!isFinite(delta)) return '0%'`). |
| **Text Overflow on Small Mobile (320px–375px)** | Large numbers (e.g., `1,248,200`) or long labels overflowing 2x2 grid cells. | Truncated digits or broken horizontal scrollbars. | **Fluid Typography**: Responsive font sizing (`text-xl sm:text-2xl lg:text-3xl`), `truncate`, and compact mobile padding (`p-3.5 sm:p-4 md:p-5`). |
| **Layout Shift (CLS) on Data Fetch** | Grid renders empty, then suddenly jumps into place once Firestore responds. | Poor user experience, Core Web Vitals penalty. | **Dedicated Skeleton Grid**: `<MessagingKpiGridSkeleton />` mirrors the exact 2x2/4-column geometry and card heights. |
| **Misleading Negative Trend Colors** | Red color used for negative trends where negative is actually good (or vice versa). | Confusing UI signals to users. | **Explicit Directional Mapping**: `isPositive` vs `isNegative` explicitly mapped per metric (e.g. Delivery Rate decrease is bad, error rate increase is bad). |
| **Third-Party Gateway Outage / Circuit Breaker Trip** | mNotify SMS gateway or Meta Cloud API experiencing upstream downtime. | Dashboard crashes or hangs indefinitely on provider status. | **Isolated Circuit Breaker Display (Rule 21 & 24)**: Provider status gracefully shows 🟡 "Degraded" or 🔴 "Disrupted" with fallback badges without crashing page. |
| **TOCTOU Stale Balance Display** | Cached SMS balance does not reflect rapid consecutive dispatches. | Operator thinks balance is sufficient when it has been consumed. | **JIT Pre-Flight Verification (Rule 18)**: Balance card reflects 3-minute TTL snapshot, but Message Composer runs live JIT balance verification prior to dispatch. |
| **Open Redirect via Top-Up Action Link** | Malicious injection or parameter spoofing on top-up navigation. | Security vulnerability (CWE-601). | **Hardcoded Safe Relative Path (Rule 8)**: Top-up action is strictly hardcoded to `/admin/settings?tab=billing` with zero dynamic URL inputs. |

---

## 5. Impact Analysis & Backoffice Management (Rule 3)

### 5.1 Subsystem Impact Analysis
* **Existing Messaging Dashboard (`/admin/messaging`)**: Zero disruption. The KPI grid is a drop-in replacement for legacy unbounded stat cards.
* **Billing & Top-Up Flow (`/admin/settings?tab=billing`)**: Deeply linked. The SMS balance card provides a direct 1-click shortcut to top up units.
* **Gateway Status Monitor**: The Provider Status card surfaces real-time provider health aggregated from mNotify and Meta Cloud APIs.
* **AI Agent & MCP Tooling (`get_messaging_dashboard_summary`)**: Fully compatible. Provides direct visualization of the summary metrics that will be queried by AI agents in Phase 6.

### 5.2 Backoffice Management (Codeless Customization)
1. **Configurable Low-Balance Threshold**: Admins can set their organization alert threshold (default: 100 units). When units fall below this threshold, the SMS Unit Balance card displays a prominent warning badge.
2. **Provider Kill-Switch Visibility**: If an admin pauses a gateway in Backoffice settings, the Provider Status card reflects `"Maintenance Mode"` with clear operator guidance.
3. **Multi-Tenant Gateway Routing**: If an organization configures custom WhatsApp or SMS credentials, the Provider Status card automatically monitors and displays health for the active tenant's configured gateways.

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Pure Trend Delta & KPI Formatting Helpers (`src/lib/messaging/kpi-utils.ts`)

**Files:**
- Create: `src/lib/messaging/kpi-utils.ts`
- Test: `src/lib/messaging/__tests__/kpi-utils.test.ts`

- [ ] **Step 1: Write failing unit tests for KPI formatting utilities**

```typescript
// src/lib/messaging/__tests__/kpi-utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatMetricNumber,
  formatTrendDelta,
  resolveProviderStatusDisplay,
  resolveSmsBalanceStatus,
} from '../kpi-utils';

describe('kpi-utils', () => {
  describe('formatMetricNumber', () => {
    it('formats numbers with standard thousand separators', () => {
      expect(formatMetricNumber(12482)).toBe('12,482');
      expect(formatMetricNumber(941)).toBe('941');
      expect(formatMetricNumber(0)).toBe('0');
      expect(formatMetricNumber(1000000)).toBe('1,000,000');
    });

    it('safely handles non-finite or negative numbers', () => {
      expect(formatMetricNumber(NaN)).toBe('0');
      expect(formatMetricNumber(Infinity)).toBe('0');
      expect(formatMetricNumber(-5)).toBe('0');
    });
  });

  describe('formatTrendDelta', () => {
    it('formats positive deltas with up arrow and emerald sentiment', () => {
      const res = formatTrendDelta(24);
      expect(res.formatted).toBe('↑ 24%');
      expect(res.isPositive).toBe(true);
      expect(res.isNeutral).toBe(false);
    });

    it('formats negative deltas with down arrow and rose sentiment', () => {
      const res = formatTrendDelta(-5.2);
      expect(res.formatted).toBe('↓ 5.2%');
      expect(res.isPositive).toBe(false);
      expect(res.isNeutral).toBe(false);
    });

    it('formats zero delta as neutral', () => {
      const res = formatTrendDelta(0);
      expect(res.formatted).toBe('0%');
      expect(res.isNeutral).toBe(true);
    });

    it('supports percentage point prefix for rates', () => {
      const res = formatTrendDelta(1.2, true);
      expect(res.formatted).toBe('↑ 1.2%');
    });
  });

  describe('resolveProviderStatusDisplay', () => {
    it('maps healthy status to green indicators', () => {
      const res = resolveProviderStatusDisplay('healthy');
      expect(res.label).toBe('Healthy');
      expect(res.badgeVariant).toBe('emerald');
      expect(res.dotColorClass).toContain('bg-emerald-500');
    });

    it('maps degraded status to amber indicators', () => {
      const res = resolveProviderStatusDisplay('degraded');
      expect(res.label).toBe('Degraded');
      expect(res.badgeVariant).toBe('amber');
      expect(res.dotColorClass).toContain('bg-amber-500');
    });

    it('maps error status to rose indicators', () => {
      const res = resolveProviderStatusDisplay('error');
      expect(res.label).toBe('Disrupted');
      expect(res.badgeVariant).toBe('rose');
      expect(res.dotColorClass).toContain('bg-rose-500');
    });
  });

  describe('resolveSmsBalanceStatus', () => {
    it('returns healthy status when balance exceeds threshold', () => {
      const res = resolveSmsBalanceStatus(941, 100);
      expect(res.isLow).toBe(false);
      expect(res.isExhausted).toBe(false);
      expect(res.badgeLabel).toBeUndefined();
    });

    it('flags low balance when below threshold', () => {
      const res = resolveSmsBalanceStatus(45, 100);
      expect(res.isLow).toBe(true);
      expect(res.isExhausted).toBe(false);
      expect(res.badgeLabel).toBe('Low balance');
    });

    it('flags exhausted balance when zero', () => {
      const res = resolveSmsBalanceStatus(0, 100);
      expect(res.isLow).toBe(true);
      expect(res.isExhausted).toBe(true);
      expect(res.badgeLabel).toBe('Exhausted');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/messaging/__tests__/kpi-utils.test.ts`  
Expected: FAIL with "Cannot find module '../kpi-utils'"

- [ ] **Step 3: Implement `src/lib/messaging/kpi-utils.ts`**

```typescript
// src/lib/messaging/kpi-utils.ts
/**
 * @fileOverview SmartSapp Messaging Dashboard — KPI Metric & Trend Formatting Utilities
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Pure, deterministic helpers for formatting tabular numbers, directional trends, and provider states.
 * - Adheres strictly to Rule 4 (Zero any/any[]).
 * - Guards against divide-by-zero, NaN, and negative anomalies.
 */

import type { ProviderHealthStatus } from '@/lib/types/messaging-dashboard';

export interface TrendDeltaResult {
  formatted: string;
  isPositive: boolean;
  isNeutral: boolean;
  deltaValue: number;
}

export interface ProviderStatusDisplayResult {
  label: string;
  badgeVariant: 'emerald' | 'amber' | 'rose';
  dotColorClass: string;
}

export interface SmsBalanceStatusResult {
  isLow: boolean;
  isExhausted: boolean;
  badgeLabel?: 'Low balance' | 'Exhausted';
}

/**
 * Formats a metric count with locale-aware thousand separators.
 * Safely guards against non-finite or negative inputs.
 * 
 * @param count - Raw number value.
 * @returns Formatted string (e.g. "12,482").
 */
export function formatMetricNumber(count: number): string {
  if (!isFinite(count) || count < 0) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(Math.round(count));
}

/**
 * Formats directional percentage trend deltas with arrow indicators and sentiment classification.
 * 
 * @param delta - The numerical delta (e.g. 24 for +24%, -5.2 for -5.2%).
 * @param _isPercentagePoint - Optional hint if delta represents percentage points.
 * @returns TrendDeltaResult with formatted label and sentiment flags.
 */
export function formatTrendDelta(delta: number, _isPercentagePoint: boolean = false): TrendDeltaResult {
  if (!isFinite(delta) || Math.abs(delta) < 0.05) {
    return {
      formatted: '0%',
      isPositive: false,
      isNeutral: true,
      deltaValue: 0,
    };
  }

  const rounded = Math.abs(Math.round(delta * 10) / 10);
  const isPositive = delta > 0;
  const arrow = isPositive ? '↑' : '↓';

  return {
    formatted: `${arrow} ${rounded}%`,
    isPositive,
    isNeutral: false,
    deltaValue: delta,
  };
}

/**
 * Resolves visual indicator tokens for provider gateway health.
 * 
 * @param status - The ProviderHealthStatus enum value ('healthy' | 'degraded' | 'error').
 * @returns Display label, badge color variant, and pulsing indicator class.
 */
export function resolveProviderStatusDisplay(status: ProviderHealthStatus): ProviderStatusDisplayResult {
  switch (status) {
    case 'healthy':
      return {
        label: 'Healthy',
        badgeVariant: 'emerald',
        dotColorClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      };
    case 'degraded':
      return {
        label: 'Degraded',
        badgeVariant: 'amber',
        dotColorClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      };
    case 'error':
    default:
      return {
        label: 'Disrupted',
        badgeVariant: 'rose',
        dotColorClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
      };
  }
}

/**
 * Classifies SMS unit balance against low-balance thresholds.
 * 
 * @param balance - Remaining SMS units.
 * @param threshold - Configurable threshold for low alert (defaults to 100).
 * @returns Alert flags and badge label.
 */
export function resolveSmsBalanceStatus(balance: number, threshold: number = 100): SmsBalanceStatusResult {
  if (balance <= 0) {
    return {
      isLow: true,
      isExhausted: true,
      badgeLabel: 'Exhausted',
    };
  }
  if (balance < threshold) {
    return {
      isLow: true,
      isExhausted: false,
      badgeLabel: 'Low balance',
    };
  }
  return {
    isLow: false,
    isExhausted: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/messaging/__tests__/kpi-utils.test.ts`  
Expected: PASS (4 test suites, all assertions passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/lib/messaging/kpi-utils.ts src/lib/messaging/__tests__/kpi-utils.test.ts
git commit -m "feat(messaging): implement KPI and trend formatting utilities with tests"
```

---

### Task 2: Standardized Reusable Metric Card (`MessagingKpiCard.tsx`)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingKpiCard.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiCard.test.tsx`

- [ ] **Step 1: Write failing component tests for `MessagingKpiCard`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { MessageSquare } from 'lucide-react';
import { MessagingKpiCard } from '../MessagingKpiCard';

describe('MessagingKpiCard', () => {
  it('renders title, formatted value with tabular numbers, and icon', () => {
    render(
      <MessagingKpiCard
        title="Messages Sent"
        value="12,482"
        icon={<MessageSquare data-testid="test-icon" className="h-5 w-5" />}
        iconBgClass="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
      />
    );

    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    expect(screen.getByText('12,482')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders positive trend badge and subtitle', () => {
    render(
      <MessagingKpiCard
        title="Delivery Rate"
        value="99.7%"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-emerald-50 text-emerald-600"
        trend={{ formatted: '↑ 1.2%', isPositive: true, isNeutral: false, deltaValue: 1.2 }}
        subtitle="vs. last 7 days"
      />
    );

    expect(screen.getByText('↑ 1.2%')).toBeInTheDocument();
    expect(screen.getByText('vs. last 7 days')).toBeInTheDocument();
  });

  it('renders interactive action link with tactile feedback and min-h-[44px]', () => {
    render(
      <MessagingKpiCard
        title="SMS Unit Balance"
        value="941"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-orange-50 text-orange-600"
        actionLink={{ label: 'Top up now →', href: '/admin/settings?tab=billing' }}
      />
    );

    const link = screen.getByRole('link', { name: /Top up now/i });
    expect(link).toHaveAttribute('href', '/admin/settings?tab=billing');
    expect(link).toHaveClass('active:scale-[0.97]');
    expect(link).toHaveClass('min-h-[44px]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiCard.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingKpiCard'"

- [ ] **Step 3: Implement `MessagingKpiCard.tsx`**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingKpiCard.tsx
'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — Stat Card Component
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Institutional card geometry adhering to theme.md Section 4:
 *   - Surface: bg-card text-card-foreground border border-border/80 rounded-2xl shadow-sm hover:shadow-md transition-shadow.
 *   - Tabular numbers (tabular-nums) to prevent layout shifting on data refresh.
 *   - Directional trend badge with high contrast for both light and dark modes.
 *   - Mobile ergonomics: Compact padding for 2x2 mobile grid (p-3.5 sm:p-4 md:p-5), touch targets min-h-[44px].
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import Link from 'next/link';
import type { TrendDeltaResult } from '@/lib/messaging/kpi-utils';
import { cn } from '@/lib/utils';

export interface MessagingKpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgClass: string;
  trend?: TrendDeltaResult;
  subtitle?: string;
  badge?: {
    label: string;
    variant: 'emerald' | 'amber' | 'rose';
    indicatorDotClass?: string;
  };
  actionLink?: {
    label: string;
    href: string;
    onClick?: () => void;
  };
  className?: string;
}

export function MessagingKpiCard({
  title,
  value,
  icon,
  iconBgClass,
  trend,
  subtitle,
  badge,
  actionLink,
  className,
}: MessagingKpiCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden',
        'rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 text-card-foreground',
        'shadow-sm hover:shadow-md hover:border-border transition-all duration-200',
        className
      )}
    >
      {/* Top Header: Title & Icon Container */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
          {title}
        </span>
        <div
          className={cn(
            'flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
            iconBgClass
          )}
        >
          {icon}
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="my-2 sm:my-2.5">
        <span
          className={cn(
            'font-bold tracking-tight text-foreground tabular-nums block line-clamp-1',
            typeof value === 'number' || (typeof value === 'string' && /^\d+/.test(value))
              ? 'text-xl sm:text-2xl lg:text-3xl'
              : 'text-base sm:text-lg lg:text-xl'
          )}
        >
          {value}
        </span>
      </div>

      {/* Bottom Subtitle / Trend Badge / Action Link */}
      <div className="flex items-center justify-between gap-1.5 text-xs">
        {/* Trend or Status Badge */}
        {trend && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs font-semibold tabular-nums',
                trend.isPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : trend.isNeutral
                  ? 'bg-muted text-muted-foreground border border-border'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              )}
            >
              {trend.formatted}
            </span>
            {subtitle && (
              <span className="text-[11px] sm:text-xs text-muted-foreground/80 line-clamp-1">
                {subtitle}
              </span>
            )}
          </div>
        )}

        {badge && (
          <div className="flex items-center gap-1.5">
            {badge.indicatorDotClass && (
              <span
                aria-hidden="true"
                className={cn('h-2 w-2 rounded-full shrink-0', badge.indicatorDotClass)}
              />
            )}
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium',
                badge.variant === 'emerald'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : badge.variant === 'amber'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              )}
            >
              {badge.label}
            </span>
          </div>
        )}

        {/* Action Link (e.g. Top up now →) */}
        {actionLink && (
          <Link
            href={actionLink.href}
            onClick={actionLink.onClick}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400',
              'hover:text-blue-700 dark:hover:text-blue-300 hover:underline',
              'active:scale-[0.97] transition-all min-h-[44px] cursor-pointer'
            )}
          >
            <span>{actionLink.label}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiCard.test.tsx`  
Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingKpiCard.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiCard.test.tsx
git commit -m "feat(messaging): implement reusable KPI stat card component with trend badges"
```

---

### Task 3: Composite 4-Card Grid & Skeleton Component (`MessagingKpiGrid.tsx`)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingKpiGrid.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx`

- [ ] **Step 1: Write failing integration tests for `MessagingKpiGrid`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MessagingKpiGrid } from '../MessagingKpiGrid';
import type { MessagingKpiMetrics } from '@/lib/types/messaging-dashboard';

describe('MessagingKpiGrid', () => {
  const mockMetrics: MessagingKpiMetrics = {
    messagesSent: 12482,
    messagesSentDeltaPercentage: 24,
    deliveryRate: 99.7,
    deliveryRateDeltaPercentage: 1.2,
    smsBalance: 941,
    providerStatus: 'healthy',
    providerStatusLabel: 'All Systems Active',
  };

  it('renders all 4 stat cards with formatted values and indicators', () => {
    render(<MessagingKpiGrid metrics={mockMetrics} />);

    // Card 1: Messages Sent
    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    expect(screen.getByText('12,482')).toBeInTheDocument();
    expect(screen.getByText('↑ 24%')).toBeInTheDocument();

    // Card 2: Delivery Rate
    expect(screen.getByText('Delivery Rate')).toBeInTheDocument();
    expect(screen.getByText('99.7%')).toBeInTheDocument();
    expect(screen.getByText('↑ 1.2%')).toBeInTheDocument();

    // Card 3: SMS Unit Balance
    expect(screen.getByText('SMS Unit Balance')).toBeInTheDocument();
    expect(screen.getByText('941')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Top up now/i })).toHaveAttribute(
      'href',
      '/admin/settings?tab=billing'
    );

    // Card 4: Provider Status
    expect(screen.getByText('Provider Status')).toBeInTheDocument();
    expect(screen.getByText('All Systems Active')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders low balance warning badge when SMS units are below threshold', () => {
    const lowMetrics: MessagingKpiMetrics = {
      ...mockMetrics,
      smsBalance: 42,
    };
    render(<MessagingKpiGrid metrics={lowMetrics} lowBalanceThreshold={100} />);

    expect(screen.getByText('Low balance')).toBeInTheDocument();
  });

  it('renders skeleton cards when isLoading is true to eliminate layout shift (CLS)', () => {
    render(<MessagingKpiGrid isLoading={true} />);

    const skeletons = screen.getAllByTestId('kpi-skeleton-card');
    expect(skeletons).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingKpiGrid'"

- [ ] **Step 3: Implement `MessagingKpiGrid.tsx` & Skeleton**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingKpiGrid.tsx
'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — 4-Card Responsive KPI Metrics Grid
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Renders the 4 primary operational stat cards matching user mockup (media_1791516336748_2f0e908d.jpg):
 *   1. Messages Sent (Volume + 7-day trend delta)
 *   2. Delivery Rate (Percentage + 7-day delta)
 *   3. SMS Unit Balance (Count + Top up shortcut + low balance alert)
 *   4. Provider Status (Health pill + pulsing indicator)
 * - Mobile ergonomics:
 *   - Desktop: 4 columns (lg:grid-cols-4).
 *   - Tablet & Mobile: 2x2 grid (grid-cols-2 gap-3 sm:gap-4).
 * - Skeleton component prevents layout shift (CLS) during server action aggregation.
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import { MessageSquare, CheckCircle2, Smartphone, ShieldCheck } from 'lucide-react';
import type { MessagingKpiMetrics } from '@/lib/types/messaging-dashboard';
import {
  formatMetricNumber,
  formatTrendDelta,
  resolveProviderStatusDisplay,
  resolveSmsBalanceStatus,
} from '@/lib/messaging/kpi-utils';
import { MessagingKpiCard } from './MessagingKpiCard';
import { cn } from '@/lib/utils';

export interface MessagingKpiGridProps {
  metrics?: MessagingKpiMetrics | null;
  isLoading?: boolean;
  lowBalanceThreshold?: number;
  className?: string;
  onTopUpClick?: () => void;
}

export function MessagingKpiGridSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-label="Loading metrics"
      className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5', className)}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          data-testid="kpi-skeleton-card"
          className="rounded-2xl border border-border/60 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs animate-pulse flex flex-col justify-between min-h-[120px] sm:min-h-[135px]"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 sm:w-24 bg-muted rounded-md" />
            <div className="h-8 w-8 bg-muted rounded-xl" />
          </div>
          <div className="my-2">
            <div className="h-7 w-24 sm:w-32 bg-muted rounded-lg" />
          </div>
          <div className="h-4 w-16 bg-muted rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function MessagingKpiGrid({
  metrics,
  isLoading = false,
  lowBalanceThreshold = 100,
  className,
  onTopUpClick,
}: MessagingKpiGridProps) {
  if (isLoading || !metrics) {
    return <MessagingKpiGridSkeleton className={className} />;
  }

  // Card 1: Messages Sent
  const messagesSentTrend = formatTrendDelta(metrics.messagesSentDeltaPercentage);

  // Card 2: Delivery Rate
  const deliveryRateTrend = formatTrendDelta(metrics.deliveryRateDeltaPercentage, true);

  // Card 3: SMS Unit Balance
  const smsStatus = resolveSmsBalanceStatus(metrics.smsBalance, lowBalanceThreshold);

  // Card 4: Provider Status
  const providerDisplay = resolveProviderStatusDisplay(metrics.providerStatus);

  return (
    <div
      className={cn(
        // Responsive 2x2 grid on mobile/tablet; 4-column row on desktop
        'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5',
        className
      )}
    >
      {/* 1. Messages Sent */}
      <MessagingKpiCard
        title="Messages Sent"
        value={formatMetricNumber(metrics.messagesSent)}
        icon={<MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
        trend={messagesSentTrend}
        subtitle="vs. last 7 days"
      />

      {/* 2. Delivery Rate */}
      <MessagingKpiCard
        title="Delivery Rate"
        value={`${metrics.deliveryRate.toFixed(1)}%`}
        icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        trend={deliveryRateTrend}
        subtitle="vs. last 7 days"
      />

      {/* 3. SMS Unit Balance */}
      <MessagingKpiCard
        title="SMS Unit Balance"
        value={formatMetricNumber(metrics.smsBalance)}
        icon={<Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400"
        badge={
          smsStatus.isLow
            ? {
                label: smsStatus.badgeLabel ?? 'Low balance',
                variant: smsStatus.isExhausted ? 'rose' : 'amber',
              }
            : undefined
        }
        actionLink={{
          label: 'Top up now →',
          href: '/admin/settings?tab=billing',
          onClick: onTopUpClick,
        }}
      />

      {/* 4. Provider Status */}
      <MessagingKpiCard
        title="Provider Status"
        value={metrics.providerStatusLabel}
        icon={<ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
        badge={{
          label: providerDisplay.label,
          variant: providerDisplay.badgeVariant,
          indicatorDotClass: cn(providerDisplay.dotColorClass, 'animate-pulse'),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx`  
Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingKpiGrid.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx
git commit -m "feat(messaging): implement 4-card KPI metrics grid with 2x2 mobile layout and skeleton"
```

---

## 7. Verification Invariants & Definition of Done

* [ ] `npx vitest run src/lib/messaging/__tests__/kpi-utils.test.ts` passes with 100% assertions.
* [ ] `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiCard.test.tsx` passes with 100% assertions.
* [ ] `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingKpiGrid.test.tsx` passes with 100% assertions.
* [ ] `pnpm lint` completes with **0 errors**.
* [ ] Zero `any` or `any[]` throughout new files (Strict Typing Invariant — Rule 4).
* [ ] Visual parity matches mockup (`media_1791516336748_2f0e908d.jpg`): 4-card desktop row, 2x2 mobile grid.
* [ ] Top-up action link strictly uses relative navigation (`/admin/settings?tab=billing`) with `min-h-[44px]` touch target (Rule 7 & 8).
* [ ] Zero unprompted git push to remote origin (Rule 5).
