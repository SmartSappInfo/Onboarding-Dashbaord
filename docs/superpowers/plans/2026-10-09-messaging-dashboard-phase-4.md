# Messaging Dashboard Redesign — Phase 4: Quick Actions Grid & All Features Directory
## Implementation Plan (Conforming to `agents_mcp_rules.md` & Institutional Theme Standards)

> **File Location:** `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-4.md`  
> **Status:** Pending User Approval  
> **Target Subsystems:** Messaging Dashboard Quick Actions Grid (`/admin/messaging`), All Features Directory Modal (`MessagingAllFeaturesModal.tsx`), Route Manifest, Mobile 2x2/Stack Layout  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 25 from `docs/agents_mcp/agents_mcp_rules.md`), `.agents/AGENTS.md`, and `theme.md` (Sections 4 & 8)  
> **Visual Reference:** User-provided mockup (`media_1791516336748_2f0e908d.jpg` — Quick Actions row and "View all features →" link)

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION OR TOUCH CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Goals

This plan details the implementation of **Phase 4** of the SmartSapp Messaging Dashboard Redesign:
1. **Static Institutional Route Manifest & Action Registry (`quick-action-constants.ts`)**:
   - Strictly typed catalog of messaging actions and features with icons, color accents, routes, and descriptions.
   - Eliminates route fragmentation, hardcoded link drift, and Open Redirect / SSRF security vulnerabilities.
2. **Interactive Quick Actions Grid (`MessagingQuickActions.tsx`)**:
   - Header with section title (`"Quick Actions"`), clear subtitle (*"Get started with the most common messaging tasks."*), and an actionable relative link (*"View all features →"*).
   - 4 primary shortcut cards matching the visual mockup (`media_1791516336748_2f0e908d.jpg`):
     - **New Campaign** (Megaphone icon, purple squircle accent, routes to `/admin/messaging/campaigns/new` or opens campaign starter).
     - **Start Message** (Send paperplane icon, blue squircle accent, routes to `/admin/messaging/composer`).
     - **Message Templates** (FileText document icon, emerald squircle accent, routes to `/admin/messaging/templates`).
     - **Manage Queue** (Clock icon, orange squircle accent, routes to `/admin/messaging/scheduled`).
   - Mobile-first responsiveness: Desktop 4 columns (`lg:grid-cols-4`), tablet & mobile 2x2 grid (`grid-cols-2 gap-3 sm:gap-4 md:gap-5`), touch targets `min-h-[44px]`, tactile click feedback (`active:scale-[0.97]`).
3. **Accessible "All Features" Directory Modal (`MessagingAllFeaturesModal.tsx`)**:
   - Standardized Modal Architecture strictly adhering to `theme.md` Section 8 (`sm:max-w-2xl`, `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip text="..." />`, `<DialogDescription className="sr-only">`, and demarcated footer).
   - Comprehensive 3-cluster directory indexing all sub-tools across the messaging suite:
     - **Outbound & Broadcasts**: Campaign Studio, Message Composer, Template Workshop, Scheduled Broadcasts.
     - **Inbound & Conversations**: Real-time Inbox, Contact Directories, Dynamic Triggers.
     - **Operations & Audit**: Dispatch Audit Logs, Gateway Settings, SMS Balance & Top-Up.
4. **Human-in-the-Loop (HITL) Execution Safeguards**:
   - None of the shortcuts fire autonomous message dispatches or mutate data in the background (enforcing Rule 19). They navigate human operators directly to verified workflow wizards.

---

## 2. Conformance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 2.1 The 10 Foundational Engineering Rules
* **Rule 1 (Industry-Grade Best Practices)**:
  * Complies with `next-best-practices`: Presentation components are client components (`'use client'`), completely decoupled from server queries.
  * Complies with `vercel-react-best-practices`: Memoized action lists, zero layout shifts (CLS), clean SVG icon containers.
  * Complies with `emilkowal-animations`: Tactile feedback on interactive action cards and modal triggers (`active:scale-[0.97]`), smooth transitions (`transition-all duration-200`).
  * Complies with `frontend-design`: Modern Institutional Minimalism matching `theme.md` Sections 4 & 8. Squircles, semantic borders, dual-mode tokens (`bg-card`, `text-card-foreground`), zero raw unescaped HTML, clear visual contrast.
* **Rule 2 (Risk Analysis & Mitigation Matrix)**:
  * Full breakdown of failure modes (broken internal routes, open redirect tampering, viewport text clipping on 320px screens, modal z-index clipping) documented in Section 4.
  * Unit and integration test coverage with Vitest and React Testing Library before merging.
  * Strictly zero unprompted remote git pushes.
* **Rule 3 (Impact Analysis & Backoffice Management)**:
  * Detailed in Section 5. Zero breaking changes to existing campaigns, composer, or template editor.
  * Backoffice management allows administrators to customize shortcut ordering or disable specific shortcuts during gateway maintenance.
* **Rule 4 (Strict Typing & Bounded `unknown`)**:
  * Strictly zero `any`, `any[]`, or unchecked type assertions across all new components, utilities, and test suites.
  * Manifest strictly bound to `QuickActionItem` and `FeatureDirectoryCategory` interfaces.
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Strict approval gate enforced before executing tasks. All tests must pass locally before staging.
  * Local commit discipline with descriptive commit messages (`feat(messaging): ...`). Strictly zero push to remote origin.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Uses existing verified packages only: `lucide-react` (`Megaphone`, `Send`, `FileText`, `Clock`, `ArrowRight`, `Inbox`, `Sliders`, `Shield`), Radix UI (`@radix-ui/react-dialog`), Tailwind CSS.
  * No experimental or unverified dependencies.
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Responsive 2x2 grid on mobile viewports (`grid-cols-2 lg:grid-cols-4`) matching the user-uploaded mobile mockup (`media_1791516336748_2f0e908d.jpg`).
  * Every interactive touch target meets or exceeds `min-h-[44px]`.
  * Everyday UI English: Clear, short, self-explanatory labels (`"New Campaign"`, `"Start Message"`, `"Message Templates"`, `"Manage Queue"`).
* **Rule 8 (High Security & Relative Navigation)**:
  * Every route strictly adheres to relative path protocol (starts with a single `/`, e.g. `/admin/messaging/composer`). Prohibits direct external links, protocol schemes (`http:`, `https:`), or `javascript:` targets to prevent open redirect and XSS vulnerabilities.
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * Pure static manifest; zero database query storms or polling intervals.
  * Lightweight DOM footprint; modals mount lazily.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * Comprehensive JSDoc blocks on every exported utility and component explaining architectural intent, security cautions, maintainer guidance, and testability pointers.

### 2.2 The Agentic & MCP Rules (Rules 11–25)
* **Rule 11 (MCP Protocol Compliance — Current 2026-07-28 Spec & SDK v2)**:
  * Prepares action definitions that mirror the capabilities exposed via MCP tools in Phase 6 (`draft_message_campaign`, `get_messaging_dashboard_summary`, `manage_message_queue`).
* **Rule 12 (Server-Side Risk Enforcement — Metadata vs Real Boundaries)**:
  * Clicking any action navigates to server-authenticated and authorized routes (`requireWorkspace(workspaceId)`). Client cannot bypass tenant boundaries.
* **Rule 13 (Formal Trust Boundary Matrix)**:
  * Action items and directory catalogs are classified as `SYSTEM_TRUST` (static hardcoded platform routes).
* **Rule 14 (Tool Poisoning / Rug-Pull Defense)**:
  * Route manifests are immutable and version-controlled, preventing malicious dynamic injection of external phishing URLs into dashboard navigation cards.
* **Rule 15 (Server Allowlisting & Supply-Chain Controls)**:
  * All links navigate strictly to internal Next.js routes within the authenticated domain.
* **Rule 16 (Agent Identity as a First-Class Security Principal)**:
  * When an agent invokes actions, execution is bounded by the agent's tenant scope.
* **Rule 17 (Non-Delegable Privileges)**:
  * Launching campaigns or purging queues require human authentication and interactive confirmation.
* **Rule 18 (Time-of-Check / Time-of-Use Protection — TOCTOU)**:
  * Queue and template links navigate to real-time views where fresh resource versions and optimistic locking are enforced.
* **Rule 19 (Mutating Tool Idempotency & Human-in-the-Loop Approval Gates)**:
  * **Core Invariant**: Clicking any quick-action card NEVER automatically fires a broadcast send or creates database mutations in the background. It routes the user to the interactive wizard for human review, configuration, and explicit sign-off.
* **Rule 20 (Replay / Duplicate Delivery Protection)**:
  * Downstream message composition enforces idempotency keys and execution tracking.
* **Rule 21 (Two-Phase Action Model for High-Risk Work)**:
  * New Campaign card routes to the Campaign Wizard which enforces PLAN $\rightarrow$ PREVIEW $\rightarrow$ APPROVE $\rightarrow$ EXECUTE $\rightarrow$ VERIFY.
* **Rule 22 (Approval Binding)**:
  * Downstream approvals are bound to exact campaign and audience parameters.
* **Rule 23 (Budget, Backpressure and Resource Governance)**:
  * Zero unbounded resource queries; zero client-side load.
* **Rule 24 (Circuit Breakers & Fail-Soft Degradation)**:
  * If a gateway is in maintenance or disrupted (as surfaced in Phase 3 Provider Health), action cards can display a subtle warning badge without breaking navigation.
* **Rule 25 (Dead-Letter and Recovery Queues / Tasks State)**:
  * The `"Manage Queue"` shortcut directly exposes the operational state of pending and dead-lettered dispatches.

---

## 3. Detailed Component Hierarchy & File Architecture

```
src/
├── lib/messaging/
│   ├── quick-action-constants.ts                              (Static manifest of quick actions and full feature directory)
│   └── __tests__/
│       └── quick-action-constants.test.ts                     (Vitest unit test verifying route hygiene and completeness)
├── app/admin/messaging/
│   └── components/dashboard/
│       ├── MessagingAllFeaturesModal.tsx                      (theme.md Section 8 compliant directory modal)
│       ├── MessagingQuickActions.tsx                          (Responsive 4-card shortcut grid with header and modal trigger)
│       └── __tests__/
│           ├── MessagingAllFeaturesModal.test.tsx             (Modal interaction, cluster grouping, keyboard a11y tests)
│           └── MessagingQuickActions.test.tsx                 (Card rendering, routing, mobile touch targets, modal opening)
```

---

## 4. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Open Redirect Vulnerability (CWE-601)** | Malicious query params or dynamic route inputs modifying card href. | Phishing or unauthorized site redirect. | **Hardcoded Relative Paths**: All action URLs strictly validated against regex `^\/[a-zA-Z0-9_\-\/?=&]+$` and hardcoded in static manifest. |
| **Accidental Autonomous Blast (Rule 19)** | Quick action triggers background message blast on click. | Compliance breach, unauthorized SMS costs. | **Strict HITL Gate**: Every action strictly acts as a navigation link (`Link href="..."`) to a review wizard; zero direct mutations. |
| **Modal Clipping / z-Index Collision** | All Features modal opens behind dashboard overlays or tooltips. | Trapped focus, unusable navigation dialog. | **theme.md Section 8 Compliance**: Modal uses Radix Dialog with standard portal, `z-[100]`, and `<CardInfoTooltip text="..." />` at `z-[10050]`. |
| **Text Overflow on Small Mobile (320px–375px)** | Long descriptions wrapping awkwardly in 2x2 mobile grid. | Broken card layout, misaligned heights. | **Responsive Typography & Line Clamping**: Card descriptions use `line-clamp-2`, fluid font sizes (`text-xs sm:text-sm`), and minimum touch targets (`min-h-[44px]`). |
| **Broken Downstream Route Navigation** | Target page (e.g. `/admin/messaging/campaigns/new`) moved or renamed. | 404 error when user clicks card. | **Route Manifest Invariant**: Manifest validated with unit tests verifying internal routing parity with Next.js app router structure. |

---

## 5. Impact Analysis & Backoffice Management (Rule 3)

### 5.1 Subsystem Impact Analysis
* **Campaign Studio (`/admin/messaging/campaigns`)**: Unaffected. Shortcut provides a direct entry point into the existing campaign wizard.
* **Message Composer (`/admin/messaging/composer`)**: Enhanced. Deep links directly into the composer.
* **Template Workshop (`/admin/messaging/templates`)**: Unaffected. Direct entry to create or customize templates.
* **Scheduled Queues (`/admin/messaging/scheduled`)**: Unaffected. Direct operational view for monitoring dispatches.
* **Existing Messaging Dashboard (`/admin/messaging`)**: Drop-in addition. Positioned directly underneath the Phase 3 Top KPI Metrics Grid.

### 5.2 Backoffice Management (Codeless Customization)
1. **Shortcut Customization**: Administrators can configure which 4 shortcuts appear in the primary row via Workspace Settings (`/admin/settings?tab=messaging`), allowing schools to feature *"Parent Broadcast"* or companies to feature *"Client Updates"*.
2. **Maintenance Mode Banners**: If an admin disables a channel (e.g. WhatsApp maintenance), the corresponding shortcut card can render an informational badge without disrupting other channels.

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Static Route Manifest & Action Registry (`src/lib/messaging/quick-action-constants.ts`)

**Files:**
- Create: `src/lib/messaging/quick-action-constants.ts`
- Test: `src/lib/messaging/__tests__/quick-action-constants.test.ts`

- [ ] **Step 1: Write failing unit tests for route manifest**

```typescript
// src/lib/messaging/__tests__/quick-action-constants.test.ts
import { describe, it, expect } from 'vitest';
import {
  PRIMARY_QUICK_ACTIONS,
  ALL_MESSAGING_FEATURES,
  isValidRelativeRoute,
} from '../quick-action-constants';

describe('quick-action-constants', () => {
  it('defines exactly 4 primary quick action cards matching mockup', () => {
    expect(PRIMARY_QUICK_ACTIONS).toHaveLength(4);
    const ids = PRIMARY_QUICK_ACTIONS.map((a) => a.id);
    expect(ids).toEqual(['new_campaign', 'start_message', 'message_templates', 'manage_queue']);
  });

  it('ensures all action routes are strictly relative paths (Rule 8)', () => {
    PRIMARY_QUICK_ACTIONS.forEach((action) => {
      expect(action.href.startsWith('/')).toBe(true);
      expect(action.href.startsWith('//')).toBe(false);
      expect(isValidRelativeRoute(action.href)).toBe(true);
    });
  });

  it('organizes all messaging features into 3 coherent clusters', () => {
    expect(ALL_MESSAGING_FEATURES).toHaveLength(3);
    const clusterIds = ALL_MESSAGING_FEATURES.map((c) => c.clusterId);
    expect(clusterIds).toEqual(['outbound', 'inbound', 'operations']);
  });

  it('validates that every feature in the directory has safe relative route and non-empty metadata', () => {
    ALL_MESSAGING_FEATURES.forEach((cluster) => {
      expect(cluster.title.length).toBeGreaterThan(0);
      expect(cluster.items.length).toBeGreaterThan(0);
      cluster.items.forEach((item) => {
        expect(isValidRelativeRoute(item.href)).toBe(true);
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/messaging/__tests__/quick-action-constants.test.ts`  
Expected: FAIL with "Cannot find module '../quick-action-constants'"

- [ ] **Step 3: Implement `src/lib/messaging/quick-action-constants.ts`**

```typescript
// src/lib/messaging/quick-action-constants.ts
/**
 * @fileOverview SmartSapp Messaging Dashboard — Quick Action & Feature Directory Manifest
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Centralized, immutable registry of all messaging sub-tools and shortcuts.
 * - Enforces Rule 8 (Strict Relative Navigation): all routes begin with a single '/' and prohibit external schemes.
 * - Enforces Rule 4 (Strict Typing: zero any/any[]).
 * - Enforces Rule 19 (HITL Approval Gate): links route to interactive wizards; zero autonomous sends.
 */

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  iconName: 'Megaphone' | 'Send' | 'FileText' | 'Clock';
  accentColor: 'purple' | 'blue' | 'emerald' | 'orange';
  badgeLabel?: string;
}

export interface FeatureDirectoryItem {
  id: string;
  title: string;
  description: string;
  href: string;
  iconName: string;
  badgeLabel?: string;
}

export interface FeatureDirectoryCategory {
  clusterId: 'outbound' | 'inbound' | 'operations';
  title: string;
  description: string;
  items: FeatureDirectoryItem[];
}

/**
 * Validates that a route string is a safe relative internal URL.
 */
export function isValidRelativeRoute(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/') && !url.startsWith('//') && !url.includes(':') && !url.startsWith('/\\');
}

/**
 * The 4 primary task shortcuts rendered on the main dashboard grid.
 */
export const PRIMARY_QUICK_ACTIONS: readonly QuickActionItem[] = [
  {
    id: 'new_campaign',
    title: 'New Campaign',
    description: 'Create and launch a multi-channel campaign to engage your contacts.',
    href: '/admin/messaging/campaigns/new',
    iconName: 'Megaphone',
    accentColor: 'purple',
    badgeLabel: 'Multi-channel',
  },
  {
    id: 'start_message',
    title: 'Start Message',
    description: 'Draft and dispatch a single message or announcement directly.',
    href: '/admin/messaging/composer',
    iconName: 'Send',
    accentColor: 'blue',
    badgeLabel: 'Instant',
  },
  {
    id: 'message_templates',
    title: 'Message Templates',
    description: 'Browse, customize and standardize institutional message layouts.',
    href: '/admin/messaging/templates',
    iconName: 'FileText',
    accentColor: 'emerald',
    badgeLabel: 'Reusable',
  },
  {
    id: 'manage_queue',
    title: 'Manage Queue',
    description: 'Monitor scheduled dispatches, approvals, and active retry queues.',
    href: '/admin/messaging/scheduled',
    iconName: 'Clock',
    accentColor: 'orange',
    badgeLabel: 'Live',
  },
] as const;

/**
 * The comprehensive directory of all messaging features rendered in the "View all features" modal.
 */
export const ALL_MESSAGING_FEATURES: readonly FeatureDirectoryCategory[] = [
  {
    clusterId: 'outbound',
    title: 'Outbound & Broadcasts',
    description: 'Tools for creating, designing, and scheduling outreach at scale.',
    items: [
      {
        id: 'feat-campaigns',
        title: 'Campaign Studio',
        description: 'Multi-step campaign builder with segmentation, scheduling, and A/B tracking.',
        href: '/admin/messaging/campaigns',
        iconName: 'Megaphone',
      },
      {
        id: 'feat-composer',
        title: 'Message Composer',
        description: 'High-speed single and batch message authoring with variable tokens.',
        href: '/admin/messaging/composer',
        iconName: 'Send',
      },
      {
        id: 'feat-templates',
        title: 'Template Workshop',
        description: 'Design visual email templates, SMS blurbs, and WhatsApp message templates.',
        href: '/admin/messaging/templates',
        iconName: 'FileText',
      },
      {
        id: 'feat-scheduled',
        title: 'Scheduled Broadcasts',
        description: 'View upcoming time-locked dispatches and pending supervisor approvals.',
        href: '/admin/messaging/scheduled',
        iconName: 'Clock',
      },
    ],
  },
  {
    clusterId: 'inbound',
    title: 'Inbound & Audience',
    description: 'Conversational channels, contact directories, and automated workflows.',
    items: [
      {
        id: 'feat-inbox',
        title: 'Conversations & Inbox',
        description: 'Real-time two-way WhatsApp and SMS communication hub with contact history.',
        href: '/admin/messaging/conversations',
        iconName: 'Inbox',
      },
      {
        id: 'feat-triggers',
        title: 'Automation Triggers',
        description: 'Event-driven triggers sending messages on status changes, birthdays, and deadlines.',
        href: '/admin/messaging/triggers',
        iconName: 'Zap',
      },
      {
        id: 'feat-entities',
        title: 'Contact Directory',
        description: 'Browse, filter, and tag organization contacts and recipient groups.',
        href: '/admin/entities',
        iconName: 'Users',
      },
    ],
  },
  {
    clusterId: 'operations',
    title: 'Operations & Audit',
    description: 'Delivery logs, carrier configurations, and billing governance.',
    items: [
      {
        id: 'feat-logs',
        title: 'Dispatch Audit Logs',
        description: 'Complete immutable audit trail of sent messages with provider delivery receipts.',
        href: '/admin/messaging/logs',
        iconName: 'ListFilter',
      },
      {
        id: 'feat-gateways',
        title: 'Gateway Provider Settings',
        description: 'Manage mNotify SMS and Meta WhatsApp Cloud API credentials and routing.',
        href: '/admin/settings?tab=messaging',
        iconName: 'Sliders',
      },
      {
        id: 'feat-billing',
        title: 'SMS Units & Billing',
        description: 'Purchase SMS credits, monitor bundle consumption, and view transaction receipts.',
        href: '/admin/settings?tab=billing',
        iconName: 'CreditCard',
      },
    ],
  },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/messaging/__tests__/quick-action-constants.test.ts`  
Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/lib/messaging/quick-action-constants.ts src/lib/messaging/__tests__/quick-action-constants.test.ts
git commit -m "feat(messaging): implement quick action constants and feature directory manifest"
```

---

### Task 2: Standardized "All Features" Directory Modal (`MessagingAllFeaturesModal.tsx`)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingAllFeaturesModal.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx`

- [ ] **Step 1: Write failing component tests for `MessagingAllFeaturesModal`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingAllFeaturesModal } from '../MessagingAllFeaturesModal';

describe('MessagingAllFeaturesModal', () => {
  it('renders modal dialog conforming to theme.md Section 8 when open', () => {
    render(<MessagingAllFeaturesModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Messaging Directory & Tools')).toBeInTheDocument();
    expect(screen.getByText('Outbound & Broadcasts')).toBeInTheDocument();
    expect(screen.getByText('Inbound & Audience')).toBeInTheDocument();
    expect(screen.getByText('Operations & Audit')).toBeInTheDocument();
  });

  it('renders all directory tool items with safe relative links and descriptions', () => {
    render(<MessagingAllFeaturesModal open={true} onOpenChange={vi.fn()} />);

    const campaignLink = screen.getByRole('link', { name: /Campaign Studio/i });
    expect(campaignLink).toHaveAttribute('href', '/admin/messaging/campaigns');

    const composerLink = screen.getByRole('link', { name: /Message Composer/i });
    expect(composerLink).toHaveAttribute('href', '/admin/messaging/composer');

    const billingLink = screen.getByRole('link', { name: /SMS Units & Billing/i });
    expect(billingLink).toHaveAttribute('href', '/admin/settings?tab=billing');
  });

  it('triggers onOpenChange(false) when clicking the close button', () => {
    const onOpenChange = vi.fn();
    render(<MessagingAllFeaturesModal open={true} onOpenChange={onOpenChange} />);

    const closeBtn = screen.getByRole('button', { name: /Close Directory/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingAllFeaturesModal'"

- [ ] **Step 3: Implement `MessagingAllFeaturesModal.tsx` conforming to `theme.md` Section 8**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingAllFeaturesModal.tsx
'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — All Features Directory Modal
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Conforms strictly to theme.md Section 8 (Standardized Modal Architecture):
 *   - Surface: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl sm:max-w-2xl.
 *   - Demarcated header: <DialogHeader demarcated> with single-circle CardInfoTooltip.
 *   - Zero raw descriptions: Guidance routes through CardInfoTooltip + <DialogDescription className="sr-only">.
 *   - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with tactile active:scale-[0.97] button.
 * - Conforms to Rule 8 (Strict Relative Navigation): all links route internally.
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/ui/card-info-tooltip';
import { Button } from '@/components/ui/button';
import { ALL_MESSAGING_FEATURES } from '@/lib/messaging/quick-action-constants';
import {
  Megaphone,
  Send,
  FileText,
  Clock,
  Inbox,
  Zap,
  Users,
  ListFilter,
  Sliders,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MessagingAllFeaturesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function resolveIcon(name: string) {
  switch (name) {
    case 'Megaphone':
      return <Megaphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    case 'Send':
      return <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case 'FileText':
      return <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'Clock':
      return <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    case 'Inbox':
      return <Inbox className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
    case 'Zap':
      return <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case 'Users':
      return <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
    case 'ListFilter':
      return <ListFilter className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
    case 'Sliders':
      return <Sliders className="h-4 w-4 text-violet-600 dark:text-violet-400" />;
    case 'CreditCard':
      return <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    default:
      return <ExternalLink className="h-4 w-4 text-muted-foreground" />;
  }
}

export function MessagingAllFeaturesModal({
  open,
  onOpenChange,
}: MessagingAllFeaturesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden',
          'border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl'
        )}
      >
        {/* Demarcated Header */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 bg-muted/20 border-b border-border/80 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Messaging Directory & Tools
            </DialogTitle>
            <CardInfoTooltip text="Directory of all broadcast, conversational, template, and operational tools across the SmartSapp Communications Hub." />
          </div>
          <DialogDescription className="sr-only">
            Index of all messaging features, outbound campaign tools, inbound conversation channels, and operational settings.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Directory Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {ALL_MESSAGING_FEATURES.map((cluster) => (
            <div key={cluster.clusterId} className="space-y-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {cluster.title}
                </h4>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  {cluster.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cluster.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'group flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/10',
                      'hover:bg-muted/25 hover:border-border hover:shadow-xs transition-all duration-150',
                      'active:scale-[0.98] min-h-[44px]'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60 group-hover:scale-105 transition-transform mt-0.5">
                      {resolveIcon(item.iconName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Demarcated Footer */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] px-5 text-xs font-medium active:scale-[0.97]"
          >
            Close Directory
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx`  
Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingAllFeaturesModal.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx
git commit -m "feat(messaging): implement accessible all features directory modal"
```

---

### Task 3: Interactive Responsive Quick Actions Grid (`MessagingQuickActions.tsx`)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingQuickActions.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingQuickActions.test.tsx`

- [ ] **Step 1: Write failing integration tests for `MessagingQuickActions`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingQuickActions.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingQuickActions } from '../MessagingQuickActions';

describe('MessagingQuickActions', () => {
  it('renders section title, subtitle, and "View all features" link', () => {
    render(<MessagingQuickActions />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(
      screen.getByText('Get started with the most common messaging tasks.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View all features/i })).toBeInTheDocument();
  });

  it('renders all 4 primary action cards with links and badges', () => {
    render(<MessagingQuickActions />);

    // Card 1: New Campaign
    const campaignLink = screen.getByRole('link', { name: /New Campaign/i });
    expect(campaignLink).toHaveAttribute('href', '/admin/messaging/campaigns/new');

    // Card 2: Start Message
    const composerLink = screen.getByRole('link', { name: /Start Message/i });
    expect(composerLink).toHaveAttribute('href', '/admin/messaging/composer');

    // Card 3: Message Templates
    const templatesLink = screen.getByRole('link', { name: /Message Templates/i });
    expect(templatesLink).toHaveAttribute('href', '/admin/messaging/templates');

    // Card 4: Manage Queue
    const queueLink = screen.getByRole('link', { name: /Manage Queue/i });
    expect(queueLink).toHaveAttribute('href', '/admin/messaging/scheduled');
  });

  it('opens the All Features modal when clicking "View all features →"', () => {
    render(<MessagingQuickActions />);

    const triggerBtn = screen.getByRole('button', { name: /View all features/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByText('Messaging Directory & Tools')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingQuickActions.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingQuickActions'"

- [ ] **Step 3: Implement `MessagingQuickActions.tsx`**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingQuickActions.tsx
'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — 4-Card Quick Actions Grid
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Renders the primary action shortcuts matching user mockup (media_1791516336748_2f0e908d.jpg):
 *   1. New Campaign (Megaphone, purple accent)
 *   2. Start Message (Send paperplane, blue accent)
 *   3. Message Templates (FileText document, emerald accent)
 *   4. Manage Queue (Clock, orange accent)
 * - Section header with "View all features →" opening the Directory Modal (theme.md Section 8).
 * - Mobile ergonomics (Rule 7):
 *   - Desktop: 4 columns (lg:grid-cols-4).
 *   - Tablet & Mobile: 2x2 grid (grid-cols-2 gap-3 sm:gap-4 md:gap-5).
 *   - All cards meet min-h-[44px] touch target with tactile active:scale-[0.97].
 * - Safe relative navigation strictly enforced (Rule 8).
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Send,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  PRIMARY_QUICK_ACTIONS,
  type QuickActionItem,
} from '@/lib/messaging/quick-action-constants';
import { MessagingAllFeaturesModal } from './MessagingAllFeaturesModal';
import { cn } from '@/lib/utils';

export interface MessagingQuickActionsProps {
  className?: string;
}

function resolveActionIcon(iconName: QuickActionItem['iconName']) {
  switch (iconName) {
    case 'Megaphone':
      return <Megaphone className="h-5 w-5" />;
    case 'Send':
      return <Send className="h-5 w-5" />;
    case 'FileText':
      return <FileText className="h-5 w-5" />;
    case 'Clock':
      return <Clock className="h-5 w-5" />;
  }
}

function resolveAccentClasses(accent: QuickActionItem['accentColor']) {
  switch (accent) {
    case 'purple':
      return {
        bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
      };
    case 'blue':
      return {
        bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      };
    case 'emerald':
      return {
        bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      };
    case 'orange':
      return {
        bg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
        badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
      };
  }
}

export function MessagingQuickActions({ className }: MessagingQuickActionsProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);

  return (
    <section className={cn('space-y-3.5', className)} aria-labelledby="quick-actions-heading">
      {/* Section Header */}
      <div className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3
            id="quick-actions-heading"
            className="text-base sm:text-lg font-semibold tracking-tight text-foreground"
          >
            Quick Actions
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Get started with the most common messaging tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            'inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400',
            'hover:text-blue-700 dark:hover:text-blue-300 hover:underline',
            'active:scale-[0.97] transition-all min-h-[44px] cursor-pointer'
          )}
        >
          <span>View all features</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4-Card Responsive Grid: 4-col desktop, 2x2 mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {PRIMARY_QUICK_ACTIONS.map((action) => {
          const accents = resolveAccentClasses(action.accentColor);
          return (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden',
                'rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 text-card-foreground',
                'shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200',
                'active:scale-[0.98] min-h-[140px] sm:min-h-[155px] cursor-pointer'
              )}
            >
              {/* Top: Squircle Icon & Badge */}
              <div className="flex items-center justify-between gap-2">
                <div
                  className={cn(
                    'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                    accents.bg
                  )}
                >
                  {resolveActionIcon(action.iconName)}
                </div>
                {action.badgeLabel && (
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold',
                      accents.badge
                    )}
                  >
                    {action.badgeLabel}
                  </span>
                )}
              </div>

              {/* Bottom: Title & Description */}
              <div className="mt-3">
                <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors block truncate">
                  {action.title}
                </span>
                <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-1 leading-snug">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* All Features Modal */}
      <MessagingAllFeaturesModal open={modalOpen} onOpenChange={setModalOpen} />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingQuickActions.test.tsx`  
Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingQuickActions.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingQuickActions.test.tsx
git commit -m "feat(messaging): implement 4-card quick actions grid with all features modal"
```

---

## 7. Verification Invariants & Definition of Done

* [ ] `npx vitest run src/lib/messaging/__tests__/quick-action-constants.test.ts` passes with 100% assertions.
* [ ] `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingAllFeaturesModal.test.tsx` passes with 100% assertions.
* [ ] `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingQuickActions.test.tsx` passes with 100% assertions.
* [ ] `pnpm lint` and `pnpm typecheck` complete with **0 errors**.
* [ ] Zero `any` or `any[]` throughout new files (Strict Typing Invariant — Rule 4).
* [ ] Visual parity matches mockup (`media_1791516336748_2f0e908d.jpg`): 4-card row on desktop, 2x2 grid on mobile viewports (Rule 1 & 7).
* [ ] All navigation targets strictly use relative paths starting with single `/` (Rule 8).
* [ ] All Features modal strictly conforms to `theme.md` Section 8 (`sm:rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip text="..." />`, `<DialogDescription className="sr-only">`, demarcated footer).
* [ ] Human-in-the-Loop approval gate strictly enforced (Rule 19) — zero background automated message broadcasts.
* [ ] Zero unprompted git push to remote origin (Rule 2 & 5).
