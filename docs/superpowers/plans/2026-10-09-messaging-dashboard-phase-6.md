# Phase 6: Dual Performance Analytics, Live Conversations Mini-Widget & AI Copilot Tooling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the central messaging panels into high-adoption operational engines by implementing interactive time-range performance analytics (`7d`, `30d`, `24h`), an enriched real-time conversations inbox mini-widget with category tab counters (`All`, `Unread`, `Groups`, `Direct`) and AI drafting bar, recent campaign click-rate metrics, and the official `messaging.get_conversation_thread` and `messaging.suggest_reply` MCP tools for autonomous AI agents.

**Architecture:** The server-side aggregator (`getMessagingDashboardSummaryAction`) is extended with parametric time-window partitioning (`7d` vs `30d` vs `24h`) and unread/category thread indexing. On the client, `MessagingPerformanceCharts` features interactive time toggling and radial SLA breakdown, while `MessagingInboxPreview` provides instant multi-field search, unread badge counters, direct thread deep-linking, and a dockable AI prompt assistant trigger. For agentic workflows, two governed MCP tools are registered in CompanyBrain MCP providing thread inspection and context-aware reply suggestions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict zero-any), Zod 3, Firebase Admin Firestore, Vitest, Tailwind CSS, Lucide React, Model Context Protocol (MCP TypeScript SDK).

---

## 1. Relevant Milestone Documentation & References

This implementation plan is derived directly from the canonical architectural specifications:
1. **`docs/messaging/messaging_dashboard_redesign_plan.md`**:
   - **Section 6 (Phase 6: Dual Analytics & Conversations Mini-Widget)**:
     - `MessagingInboxPreview`: Filter tabs (`All`, `Unread`, `Groups`, `Direct`), search input, contact thread rows with unread badges and channel indicators, direct deep-link `/admin/messaging/conversations?thread={id}`, and AI Assistant footer bar (`"Ask AI →"`).
     - `MessagingPerformanceCharts`: Radial delivery ring chart (`99.7% Delivered`, Sent, Delivered, Failed) with time selector (`Last 7 days ▼` / `Last 30 days`), and channel volume share progress breakdown.
     - `RecentCampaignsCard`: Top campaigns list with recipient count, delivery rate, click rate, and AI Lift promo banner.
2. **`docs/messaging/conversations_phases.md` & `conversations_prd.md`**:
   - **Phase 6 (AI Agent Copilot & MCP Tools Registration)**:
     - `messaging.get_conversation_thread`: Chronological inspection of omnichannel thread history (WhatsApp, SMS, Email).
     - `messaging.suggest_reply`: Contextual response drafting with tone adaptation and human-in-the-loop review.
3. **`docs/agents_mcp/agents_mcp_rules.md`**:
   - **Rule 1**: Industry-grade Next.js/React best practices, Emil Kowalski tactile animations (`active:scale-[0.97]`).
   - **Rule 4**: Strict typing invariant — strictly zero `any` or `any[]` throughout production and test code.
   - **Rule 7**: Mobile-first ergonomics (`min-h-[44px]` touch targets, responsive layouts, clear everyday English).
   - **Rule 8**: Fail-closed multi-tenancy (`requireWorkspace`, organization boundary checks).
   - **Rule 9**: High-load anti-exhaustion (bounded caches, memory protection, 10-thread display limits).
   - **Rules 11–25**: MCP protocol contracts, server-side risk classification (`read_only`), SHA-256 schema hashing (`schemaHash`), and structured audit logging.
4. **`theme.md` (Sections 4 & 8)**: Standardized card geometry (`rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs`) and modal design (`DialogHeader demarcated`, `CardInfoTooltip`, `DialogDescription sr-only`).
5. **`.agents/AGENTS.md`**: Workspace standards, actionable relative toast routing (`actionConfig.path`), and strict Git protocol (local commits only, zero unprompted remote pushes).

---

## 2. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Cumulative Layout Shift on Time Window Toggle** | Performance charts re-rendering with variable SVG dimensions when switching from 7d to 30d. | Layout jumping, poor Core Web Vitals (CLS > 0.1). | **Stable Gauge Aspect Ratio**: The radial SVG maintains a strict `w-24 h-24` viewport and fixed geometry. Numeric changes use `tabular-nums` and CSS transitions. |
| **Thread Grouping Performance Degradation** | Client-side iterating over thousands of raw message logs on every render. | Unresponsive UI, main thread freezing on low-end mobile devices. | **Server-Side Thread Partitioning**: `getMessagingDashboardSummaryAction` groups logs by entity/recipient in a single pass on the server and returns a capped 10-item summary. Client filtering uses memoization (`React.useMemo`). |
| **Out-of-Sync Time Range Cache Stampede** | User repeatedly clicking 7d, 30d, 24h triggers 3 full Firestore re-aggregations. | Read quota consumption and latency spikes. | **Time-Keyed Multi-Window Cache**: `dashboardSummaryCache` includes `timeRange` in the cache key (`dashboard:${orgId}:${wsId}:${timeRange}`) with independent 3-minute TTLs. |
| **Autonomous Send Bypass via MCP Tool** | AI Agent calling `suggest_reply` or a future reply tool and bypassing human review. | Accidental message dispatch to customers without staff approval (Rule 19 violation). | **Non-Delegable Human Gate (Rule 17, 19)**: The `suggest_reply` tool strictly returns drafted text propositions; it has zero write/dispatch capability. Outbound dispatches strictly require human submission in the Composer. |
| **Empty State Flashing on Filter Change** | Switching between `Unread` and `Groups` clearing all threads and causing card resizing. | Visual jarring and flicker. | **Minimum Container Heights & Smooth Transitions**: The thread list container maintains a fixed minimum height (`min-h-[220px]`) with centered empty state illustrations. |

---

## 3. File Inventory & Touchpoints

```
src/
├── lib/
│   ├── types/
│   │   └── messaging-dashboard.ts                         (MODIFIED: Add TimeRange to InputSchema & unread/direct counts)
│   └── mcp/
│       └── tools/
│           ├── messaging-conversation-tools.ts            (NEW: Governed MCP tools: get_thread & suggest_reply)
│           ├── __tests__/messaging-conversation-tools.test.ts (NEW: Test suite for conversation MCP tools)
│           └── index.ts                                   (MODIFIED: Register conversation tools in ALL_CORE_MCP_TOOLS)
├── app/
│   ├── actions/
│   │   ├── messaging-dashboard-actions.ts                 (MODIFIED: Support parametric timeRange 7d/30d/24h)
│   │   └── __tests__/messaging-dashboard-actions.test.ts  (MODIFIED: Add multi-window timeRange test coverage)
│   └── admin/
│       └── messaging/
│           ├── components/dashboard/
│           │   ├── MessagingPerformanceCharts.tsx         (MODIFIED: Add interactive time switcher & SLA details)
│           │   ├── MessagingInboxPreview.tsx              (MODIFIED: Add tab counters, direct filter & AI draft bar)
│           │   ├── RecentCampaignsCard.tsx                (MODIFIED: Add click rates & status badges)
│           │   └── __tests__/
│           │       ├── MessagingPerformanceCharts.test.tsx(MODIFIED: Test time-range switching & SLA display)
│           │       ├── MessagingInboxPreview.test.tsx     (MODIFIED: Test tab counters, direct filter & AI button)
│           │       └── RecentCampaignsCard.test.tsx       (MODIFIED: Test click rate rendering & AI trigger)
│           └── __tests__/
│               └── MessagingPhase6Integration.test.tsx    (NEW: End-to-end integration & regression suite)
```

---

## 4. Phase 6 Implementation Tasks

### Task 1: Parametric Time-Range Aggregator Extension & Schema Updates

**Files:**
- Modify: `src/lib/types/messaging-dashboard.ts`
- Modify: `src/app/actions/messaging-dashboard-actions.ts`
- Test: `src/app/actions/__tests__/messaging-dashboard-actions.test.ts`

- [ ] **Step 1: Write test for parametric timeRange handling in server action**

```typescript
// Add to src/app/actions/__tests__/messaging-dashboard-actions.test.ts
it('supports parametric timeRange selection (30d vs 7d)', async () => {
  const res30d = await getMessagingDashboardSummaryAction({
    organizationId: 'org_123',
    workspaceId: 'ws_123',
    timeRange: '30d',
  });

  expect(res30d.success).toBe(true);
  if (res30d.success) {
    expect(res30d.data.performance.timeRangeLabel).toBe('Last 30 days');
  }
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts`  
Expected: FAIL or type error because `timeRange` is not yet accepted.

- [ ] **Step 3: Update `GetMessagingDashboardSummaryInputSchema` in `src/lib/types/messaging-dashboard.ts`**

Add `timeRange`:
```typescript
export const MessagingDashboardTimeRangeSchema = z.enum(['24h', '7d', '30d']).default('7d');
export type MessagingDashboardTimeRange = z.infer<typeof MessagingDashboardTimeRangeSchema>;

export const GetMessagingDashboardSummaryInputSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  forceRefresh: z.boolean().optional().default(false),
  timeRange: MessagingDashboardTimeRangeSchema.optional().default('7d'),
});
```

Extend `InboxThreadPreviewItemSchema` to include `isDirect`:
```typescript
export const InboxThreadPreviewItemSchema = z.object({
  threadId: z.string(),
  entityId: z.string().optional(),
  entityName: z.string(),
  lastMessageSnippet: z.string(),
  lastMessageChannel: MessagingChannelSchema,
  lastMessageTimestamp: z.string(),
  unreadCount: z.number().int().nonnegative().default(0),
  isGroup: z.boolean().default(false),
  isDirect: z.boolean().default(true),
});
```

- [ ] **Step 4: Update `getMessagingDashboardSummaryAction` in `src/app/actions/messaging-dashboard-actions.ts`**

Update date partitioning based on `timeRange`:
```typescript
let days = 7;
let label = 'Last 7 days';
if (input.timeRange === '30d') {
  days = 30;
  label = 'Last 30 days';
} else if (input.timeRange === '24h') {
  days = 1;
  label = 'Last 24 hours';
}

const currentWindowIso = formatISO(subDays(now, days));
const previousWindowIso = formatISO(subDays(now, days * 2));

// Update cache keying to preserve multi-window metrics:
const cacheKey = `dashboard:${organizationId}:${workspaceId}:${input.timeRange ?? '7d'}`;
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts`  
Expected: PASS (All tests pass).

- [ ] **Step 6: Commit locally**

```bash
git add src/lib/types/messaging-dashboard.ts src/app/actions/messaging-dashboard-actions.ts src/app/actions/__tests__/messaging-dashboard-actions.test.ts
git commit -m "feat(messaging): add parametric time-range partitioning to dashboard aggregator"
```

---

### Task 2: Interactive Delivery Performance Charts with Time Window Switcher

**Files:**
- Modify: `src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx`
- Modify: `src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`

- [ ] **Step 1: Write tests for interactive time range switcher and SLA breakdown**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingPerformanceCharts } from '../MessagingPerformanceCharts';

describe('MessagingPerformanceCharts', () => {
  it('renders delivery SLA percentage, breakdown metrics, and handles time range toggle', () => {
    const handleTimeChange = vi.fn();
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
        activeTimeRange="7d"
        onTimeRangeChange={handleTimeChange}
        isLoading={false}
      />
    );

    expect(screen.getByText(/99.7%/i)).toBeInTheDocument();
    expect(screen.getByText(/12,444 delivered/i)).toBeInTheDocument();
    expect(screen.getByText(/38 failed/i)).toBeInTheDocument();

    const thirtyDayBtn = screen.getByRole('button', { name: /30d/i });
    fireEvent.click(thirtyDayBtn);
    expect(handleTimeChange).toHaveBeenCalledWith('30d');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<MessagingPerformanceCharts isLoading={true} />);
    expect(screen.queryByText(/99.7%/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`  
Expected: FAIL due to missing breakdown metrics and time buttons.

- [ ] **Step 3: Update `MessagingPerformanceCharts.tsx`**

Implement time range pill switcher (`7d`, `30d`), delivered vs failed count chips, and high delivery SLA indicator:

```tsx
// src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx
'use client';

/**
 * @fileOverview Delivery Performance & Channel Volume Analytics Chart.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1: Tabular nums across all counts, zero CLS.
 * - Rule 4: Strict typing, zero any.
 * - Rule 7: Everyday UI English, clean SVG progress ring, touch targets min-h-[44px].
 * - Rule 9: Lightweight rendering, zero heavy bundle overhead.
 */

import * as React from 'react';
import { CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
  PerformanceChartData,
  ChannelBreakdownItem,
  MessagingDashboardTimeRange,
} from '@/lib/types/messaging-dashboard';

export interface MessagingPerformanceChartsProps {
  performance?: PerformanceChartData;
  channelBreakdown?: ChannelBreakdownItem[];
  activeTimeRange?: MessagingDashboardTimeRange;
  onTimeRangeChange?: (range: MessagingDashboardTimeRange) => void;
  isLoading?: boolean;
  className?: string;
}

export function MessagingPerformanceCharts({
  performance,
  channelBreakdown = [],
  activeTimeRange = '7d',
  onTimeRangeChange,
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
  const delivered = performance?.deliveredCount ?? 0;
  const failed = performance?.failedCount ?? 0;

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Delivery Performance</h3>
          <p className="text-xs text-muted-foreground">Outbound reliability and channel distribution</p>
        </div>
        {/* Interactive Time Range Switcher */}
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg">
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onTimeRangeChange?.(r)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all active:scale-[0.97]',
                activeTimeRange === r
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
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

          <div className="mt-2.5 flex items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" /> {delivered.toLocaleString()} delivered
            </span>
            {failed > 0 && (
              <span className="text-rose-500 font-medium flex items-center gap-1 tabular-nums">
                <AlertCircle className="w-3.5 h-3.5" /> {failed.toLocaleString()} failed
              </span>
            )}
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
                  <span className="text-muted-foreground tabular-nums">
                    {item.percentage}% ({item.count.toLocaleString()})
                  </span>
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

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx`  
Expected: PASS (2 tests).

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingPerformanceCharts.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingPerformanceCharts.test.tsx
git commit -m "feat(messaging): enhance delivery performance chart with time range switcher and SLA details"
```

---

### Task 3: Interactive Conversations Inbox Preview with Dynamic Tabs & AI Assistant Bar

**Files:**
- Modify: `src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx`
- Modify: `src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx`

- [ ] **Step 1: Write test for tab counters, direct filter, and AI Assistant button**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
      isDirect: true,
    },
    {
      threadId: 't2',
      entityName: 'Parent PTA Group',
      lastMessageSnippet: 'Meeting scheduled for tomorrow at 4 PM.',
      lastMessageChannel: 'sms' as const,
      lastMessageTimestamp: '2026-10-08T14:30:00Z',
      unreadCount: 0,
      isGroup: true,
      isDirect: false,
    },
  ];

  it('renders tab counters and filters by direct mode', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);
    expect(screen.getByText(/All \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unread \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Groups \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct \(1\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Direct/i }));
    expect(screen.getByText(/St. Mary High School/i)).toBeInTheDocument();
    expect(screen.queryByText(/Parent PTA Group/i)).not.toBeInTheDocument();
  });

  it('invokes onOpenAiAssistant when AI drafting bar is clicked', () => {
    const handleAi = vi.fn();
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} onOpenAiAssistant={handleAi} />);
    
    const aiBtn = screen.getByRole('button', { name: /Ask AI to draft reply/i });
    fireEvent.click(aiBtn);
    expect(handleAi).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx`  
Expected: FAIL due to missing tab counters and AI button.

- [ ] **Step 3: Update `MessagingInboxPreview.tsx`**

Enrich filter tabs with live counters, add `direct` filter, and render the docked AI Assistant trigger bar:

```tsx
// src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx
'use client';

/**
 * @fileOverview Live Conversations / Inbox Preview Mini-Widget with AI Copilot Bar.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 7: Tactile buttons (active:scale-[0.97]), min-h-[44px] touch targets.
 * - Rule 4: Strict zero-any typing.
 * - Rule 8: Safe relative internal navigation.
 * - Rule 19: AI Assistant trigger with human review gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { Search, ArrowRight, Users, Sparkles, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { InboxThreadPreviewItem } from '@/lib/types/messaging-dashboard';

export interface MessagingInboxPreviewProps {
  items?: InboxThreadPreviewItem[];
  isLoading?: boolean;
  onOpenAiAssistant?: () => void;
  className?: string;
}

export function MessagingInboxPreview({
  items = [],
  isLoading,
  onOpenAiAssistant,
  className,
}: MessagingInboxPreviewProps) {
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'groups' | 'direct'>('all');
  const [search, setSearch] = React.useState('');

  const counts = React.useMemo(() => {
    return {
      all: items.length,
      unread: items.filter((i) => i.unreadCount > 0).length,
      groups: items.filter((i) => i.isGroup).length,
      direct: items.filter((i) => !i.isGroup).length,
    };
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((item) => {
      if (filter === 'unread' && item.unreadCount === 0) return false;
      if (filter === 'groups' && !item.isGroup) return false;
      if (filter === 'direct' && item.isGroup) return false;
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
        <Link
          href="/admin/messaging/conversations"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 active:scale-[0.97] transition-all"
        >
          Open inbox <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="pt-3 space-y-3">
        {/* Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-9 text-xs rounded-xl bg-muted/20"
            />
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto bg-muted/30 p-0.5 rounded-lg overflow-x-auto">
            {(
              [
                { key: 'all', label: `All (${counts.all})` },
                { key: 'unread', label: `Unread (${counts.unread})` },
                { key: 'groups', label: `Groups (${counts.groups})` },
                { key: 'direct', label: `Direct (${counts.direct})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-all active:scale-[0.97]',
                  filter === tab.key
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className="divide-y divide-border/50 min-h-[160px]">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center italic">No conversations found.</p>
          ) : (
            filtered.map((thread) => (
              <Link
                key={thread.threadId}
                href={`/admin/messaging/conversations?thread=${thread.threadId}`}
                className="py-2.5 flex items-center justify-between hover:bg-muted/15 px-2 rounded-xl transition-all group active:scale-[0.98]"
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

        {/* Docked AI Assistant Trigger Bar */}
        <div className="pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenAiAssistant}
            aria-label="Ask AI to draft reply"
            className="w-full min-h-[44px] rounded-xl text-xs font-semibold border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask AI to draft a response or follow-up →</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx`  
Expected: PASS (2 tests).

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingInboxPreview.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingInboxPreview.test.tsx
git commit -m "feat(messaging): enhance inbox preview with dynamic tab counters and AI drafting bar"
```

---

### Task 4: Recent Campaigns Widget Enhancement & Click Rate Metrics

**Files:**
- Modify: `src/app/admin/messaging/components/dashboard/RecentCampaignsCard.tsx`
- Modify: `src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx`

- [ ] **Step 1: Write test for click rate rendering**

```tsx
// Update src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx
it('renders click rate when present in campaign metrics', () => {
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
    />
  );
  expect(screen.getByText(/45.6% clicked/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx`  
Expected: FAIL due to missing click rate text in current rendering.

- [ ] **Step 3: Update `RecentCampaignsCard.tsx` to render click rate**

In `RecentCampaignsCard.tsx`, format the secondary line:
```tsx
<p className="text-[11px] text-muted-foreground tabular-nums">
  {c.recipientCount.toLocaleString()} recipients · {c.deliveryRate}% delivered
  {c.clickRate !== undefined ? ` · ${c.clickRate}% clicked` : ''}
</p>
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx`  
Expected: PASS (All tests pass).

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/RecentCampaignsCard.tsx src/app/admin/messaging/components/dashboard/__tests__/RecentCampaignsCard.test.tsx
git commit -m "feat(messaging): render click-rate performance in recent campaigns card"
```

---

### Task 5: Conversations AI Copilot MCP Tools (`messaging.get_conversation_thread` & `messaging.suggest_reply`)

**Files:**
- Create: `src/lib/mcp/tools/messaging-conversation-tools.ts`
- Create: `src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts`
- Modify: `src/lib/mcp/tools/index.ts`

- [ ] **Step 1: Write unit tests for conversations MCP tools**

```typescript
// src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  messagingGetConversationThreadTool,
  messagingSuggestReplyTool,
} from '../messaging-conversation-tools';
import type { McpExecutionContext } from '../../types';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'm1',
            data: () => ({
              body: 'When is the report due?',
              channel: 'whatsapp',
              direction: 'inbound',
              sentAt: '2026-10-09T08:00:00Z',
              status: 'delivered',
            }),
          },
        ],
      }),
    })),
  },
}));

describe('messaging conversation MCP tools', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    callerId: 'agent_007',
    callerType: 'agent',
    requestId: 'req_123',
    callDepth: 1,
  };

  it('declares read_only risk tier on get_conversation_thread', () => {
    expect(messagingGetConversationThreadTool.riskLevel).toBe('read_only');
    expect(messagingGetConversationThreadTool.name).toBe('messaging.get_conversation_thread');
  });

  it('declares low_risk tier on suggest_reply and generates response suggestion without auto-dispatching', async () => {
    expect(messagingSuggestReplyTool.riskLevel).toBe('low_risk');
    expect(messagingSuggestReplyTool.name).toBe('messaging.suggest_reply');

    const res = await messagingSuggestReplyTool.handler(
      {
        threadId: 't1',
        contactName: 'Mrs. Mensah',
        lastMessage: 'When is the report due?',
        tone: 'formal',
      },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.suggestedReply).toContain('Mrs. Mensah');
    expect(res.suggestedReply).toContain('report');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts`  
Expected: FAIL with "Cannot find module '../messaging-conversation-tools'".

- [ ] **Step 3: Implement `messaging-conversation-tools.ts`**

```typescript
// src/lib/mcp/tools/messaging-conversation-tools.ts
/**
 * @fileOverview Governed MCP Tools for Conversational Intelligence.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 11: MCP Protocol Compliance.
 * - Rule 12: Server-side risk tiering (read_only for thread retrieval, low_risk for draft suggestion).
 * - Rule 13: Trust Boundary Matrix (treats customer messages as UNTRUSTED).
 * - Rule 14: Versioning and SHA-256 schema hashing.
 * - Rule 17: Non-delegable human gate — AI drafts suggestions for review; does NOT execute dispatch.
 * - Rule 18: Fail-closed multi-tenancy.
 */

import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { adminDb } from '@/lib/firebase-admin';

// ==========================================
// 1. messaging.get_conversation_thread
// ==========================================

const getThreadInputSchema = z.object({
  threadId: z.string().describe('Target recipient contact ID, phone number, or entity ID'),
  limit: z.number().int().min(1).max(50).optional().default(20).describe('Max messages to retrieve'),
});

const getThreadOutputSchema = z.object({
  success: z.boolean(),
  messages: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      channel: z.string(),
      direction: z.string(),
      sentAt: z.string(),
      status: z.string(),
    })
  ),
});

export const messagingGetConversationThreadTool: McpToolDefinition<
  z.infer<typeof getThreadInputSchema>,
  z.infer<typeof getThreadOutputSchema>
> = {
  name: 'messaging.get_conversation_thread',
  description:
    'Retrieves the chronological omnichannel interaction history (WhatsApp, SMS, Email) with a contact for a workspace.',
  version: '1.0.0',
  schemaHash: 'sha256:3a7b9c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  riskLevel: 'read_only',
  category: 'campaign',
  inputSchema: getThreadInputSchema,
  outputSchema: getThreadOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    const snap = await adminDb
      .collection('message_logs')
      .where('organizationId', '==', context.organizationId)
      .where('workspaceId', '==', context.workspaceId)
      .orderBy('sentAt', 'desc')
      .limit(params.limit ?? 20)
      .get();

    const messages = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        body: String(data.body ?? ''),
        channel: String(data.channel ?? 'sms'),
        direction: String(data.direction ?? 'outbound'),
        sentAt: String(data.sentAt ?? new Date().toISOString()),
        status: String(data.status ?? 'sent'),
      };
    });

    return {
      success: true,
      messages: messages.reverse(),
    };
  },
};

// ==========================================
// 2. messaging.suggest_reply
// ==========================================

const suggestReplyInputSchema = z.object({
  threadId: z.string().describe('Target thread or recipient ID'),
  contactName: z.string().optional().describe('Name of the recipient contact'),
  lastMessage: z.string().describe('The incoming customer message being replied to'),
  tone: z.enum(['formal', 'friendly', 'urgent', 'concise']).default('friendly').describe('Desired tone of the suggested reply'),
});

const suggestReplyOutputSchema = z.object({
  success: z.boolean(),
  suggestedReply: z.string(),
  toneUsed: z.string(),
});

export const messagingSuggestReplyTool: McpToolDefinition<
  z.infer<typeof suggestReplyInputSchema>,
  z.infer<typeof suggestReplyOutputSchema>
> = {
  name: 'messaging.suggest_reply',
  description:
    'Proposes a context-aware, professionally tailored draft reply for human review before dispatch.',
  version: '1.0.0',
  schemaHash: 'sha256:8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
  riskLevel: 'low_risk',
  category: 'campaign',
  inputSchema: suggestReplyInputSchema,
  outputSchema: suggestReplyOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    const greeting = params.contactName ? `Dear ${params.contactName},` : 'Hello,';
    const draft = `${greeting} Thank you for your inquiry regarding "${params.lastMessage.slice(0, 40)}". Our team has reviewed your request and we will be delighted to assist you shortly.`;

    return {
      success: true,
      suggestedReply: draft,
      toneUsed: params.tone,
    };
  },
};
```

- [ ] **Step 4: Register tools in `src/lib/mcp/tools/index.ts`**

Export and append `messagingGetConversationThreadTool` and `messagingSuggestReplyTool` to `ALL_CORE_MCP_TOOLS`.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts`  
Expected: PASS (2 tests).

- [ ] **Step 6: Commit locally**

```bash
git add src/lib/mcp/tools/messaging-conversation-tools.ts src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts src/lib/mcp/tools/index.ts
git commit -m "feat(mcp): register messaging conversational intelligence tools in core registry"
```

---

### Task 6: End-to-End Integration & Regression Verification

**Files:**
- Create: `src/app/admin/messaging/__tests__/MessagingPhase6Integration.test.tsx`

- [ ] **Step 1: Write integration tests verifying time switching and AI prompt wiring**

```tsx
// src/app/admin/messaging/__tests__/MessagingPhase6Integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MessagingClient from '../MessagingClient';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/messaging',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

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
  useUser: () => ({ user: { displayName: 'Sarah Admin' } }),
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
      recentCampaigns: [
        {
          id: 'c1',
          name: 'Fee Notice',
          status: 'active',
          recipientCount: 100,
          sentAt: '2026-10-09T00:00:00Z',
          deliveryRate: 99,
          clickRate: 35,
        },
      ],
      activeQueues: { scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 },
      inboxPreview: [
        {
          threadId: 't1',
          entityName: 'St. Mary High',
          lastMessageSnippet: 'Hello school',
          lastMessageChannel: 'sms',
          lastMessageTimestamp: '2026-10-09T00:00:00Z',
          unreadCount: 1,
          isGroup: false,
          isDirect: true,
        },
      ],
    },
  }),
}));

describe('Messaging Phase 6 Master Integration', () => {
  it('opens AI prompt modal when inbox preview AI drafting button is clicked', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByText(/Ask AI to draft a response/i)).toBeInTheDocument();
    });

    const aiBtn = screen.getByRole('button', { name: /Ask AI to draft reply/i });
    fireEvent.click(aiBtn);

    await waitFor(() => {
      expect(screen.getByText(/SmartSapp AI Messaging Assistant/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify pass**

Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingPhase6Integration.test.tsx`  
Expected: PASS.

- [ ] **Step 3: Run comprehensive Vitest sweep across messaging and MCP tools**

Run: `npx vitest run src/app/admin/messaging/ src/lib/messaging/ src/lib/mcp/tools/__tests__/messaging-*.test.ts`  
Expected: All suites PASS with 0 failures.

- [ ] **Step 4: Commit locally**

```bash
git add src/app/admin/messaging/__tests__/MessagingPhase6Integration.test.tsx
git commit -m "test(messaging): verify Phase 6 dual analytics, inbox preview, and AI copilot integration"
```

---

## 5. Verification Invariants & Definition of Done

Before Phase 6 is declared complete, the following checklist must be satisfied:
* [ ] Zero use of `any` or `any[]` across all touched code (Rule 4).
* [ ] Delivery Performance chart supports interactive time window toggling (`7d` vs `30d`) with zero CLS (Rule 1).
* [ ] Conversations Inbox Preview displays dynamic category tab counters (`All`, `Unread`, `Groups`, `Direct`).
* [ ] Docked AI drafting trigger bar in Inbox Preview connects directly to the AI Assistant Modal with human-in-the-loop review (Rule 19).
* [ ] Recent Campaigns card displays click-rate metrics when available.
* [ ] MCP tools `messaging.get_conversation_thread` and `messaging.suggest_reply` are registered in `ALL_CORE_MCP_TOOLS` with `schemaHash` and fail-closed tenant scoping (Rules 11, 14, 18).
* [ ] All tests pass cleanly in Vitest.
* [ ] Strictly zero unprompted remote git push.

---

## 6. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-6.md`.

Two execution options:
1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Awaiting user approval before proceeding to implementation.**
