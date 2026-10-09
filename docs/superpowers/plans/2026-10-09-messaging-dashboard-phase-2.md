# Messaging Dashboard Redesign — Phase 2: Hero Greeting Card & Interactive AI Prompt Bar
## Implementation Plan (Conforming to `agents_mcp_rules.md` & Institutional Theme Standards)

> **File Location:** `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-2.md`  
> **Status:** Pending User Approval  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 25 from `docs/agents_mcp/agents_mcp_rules.md`), `.agents/AGENTS.md`, and `theme.md` Section 8  
> **Visual Reference:** User-provided mockup (`media_1791516336748_2f0e908d.jpg`)

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION OR TOUCH CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Goals

This plan specifies the implementation of **Phase 2** of the SmartSapp Messaging Dashboard Redesign:
1. **Hero Greeting Banner (`MessagingHeroGreeting.tsx`)**: An institutional gradient card featuring client-hydrated time-of-day greeting ("Good morning", "Good afternoon", "Good evening"), first-name identity extraction, dynamic workspace terminology adaptation (*"for stronger {singular} communities and better engagement"*), and mobile-responsive layout.
2. **Interactive Glassmorphic AI Prompt Pill**: A tactile, glassmorphic interactive button (`bg-white/10 backdrop-blur-md hover:bg-white/20 border-white/20 active:scale-[0.98] min-h-[44px]`) integrated directly into the hero banner.
3. **Standardized AI Assistant Prompt Modal (`MessagingAiPromptModal.tsx`)**: An accessible dialog strictly adhering to `theme.md` Section 8 (`sm:rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip text="..." />`, `<DialogDescription className="sr-only">`, and demarcated footer with tactile buttons).
4. **Safe Workflow Handoff & Composer Wiring**: Clean handoff to the Message Composer (`/admin/messaging/composer?prompt=...`) enforcing Human-in-the-Loop (HITL) approval, input sanitization, and zero automated unapproved dispatches.

---

## 2. Conformance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 2.1 The 10 Foundational Engineering Rules
* **Rule 1 (Industry-Grade Best Practices)**:
  * Complies with `next-best-practices`: Pure presentation components with client hydration guards preventing React hydration mismatch (#418).
  * Complies with `vercel-react-best-practices`: Stable callbacks with `useCallback`, memoized prompt lists with `useMemo`, zero unnecessary re-renders.
  * Complies with `emilkowal-animations`: Tactile click states (`active:scale-[0.97]` on buttons, `active:scale-[0.98]` on pills), smooth transitions (`duration-200 ease-out`).
  * Complies with `frontend-design`: Modern Institutional Minimalism matching `theme.md`, no raw unescaped HTML, clear visual hierarchy.
* **Rule 2 (Risk Analysis & Mitigation Matrix)**:
  * Full breakdown of failure modes (hydration mismatch, empty display name, prompt injection, mobile layout overflow) documented in Section 4.
  * Unit and integration test coverage with Vitest and React Testing Library before merging.
  * Strictly zero unprompted remote git pushes.
* **Rule 3 (Impact Analysis & Backoffice Management)**:
  * Detailed in Section 5. Backoffice allows administrators to configure AI prompt starters via workspace settings without code changes.
  * Preserves full backward compatibility with `/admin/messaging/composer` and existing campaigns.
* **Rule 4 (Strict Typing & Bounded `unknown`)**:
  * Strictly zero `any` or `any[]` across all new components, utilities, and test suites.
  * External query parameters (e.g. `?prompt=...`) are bounded, validated, and normalized before reaching component state.
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Strict approval gate enforced before executing tasks. All tests must pass locally before staging.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Uses existing verified packages (`lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, Tailwind CSS).
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Every interactive touch target meets `min-h-[44px]`.
  * Mobile viewports (`< 768px`) stack cleanly (`flex-col md:flex-row`).
  * Everyday UI English: Clean, short, and friendly labels (no esoteric jargon).
* **Rule 8 (High Security & Multi-Tenant Data Protection)**:
  * Prompt sanitization: Encodes prompt strings and uses React safe text nodes to prevent XSS (CWE-79) and formula injection (CWE-1236).
  * Tenant isolation: Terminology strictly derives from active workspace context (`useTerminology()`).
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * Pure date computation with $O(1)$ complexity.
  * Zero memory leaks; all modal states unbind and cleanup safely.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * JSDoc blocks on every exported utility and component explaining architectural intent, security cautions, and maintainer pointers.

### 2.2 The Agentic & MCP Rules (Rules 11–25)
* **Rule 11 (MCP Protocol & Tooling Alignment)**:
  * Prepares prompt contracts that align with future Phase 6 MCP tools (`draft_message_campaign`, `analyze_campaign_performance`).
* **Rule 12 (Server-Side Risk Enforcement)**:
  * The prompt modal never bypasses backend rate limits or blast limits. All message dispatches route through the server-governed Composer with recipient safety thresholds intact.
* **Rule 13 (Trust Boundary Matrix)**:
  * All prompt text entered by the user is explicitly treated as `UNTRUSTED_USER_INPUT`. It is never treated as a `SYSTEM_INSTRUCTION` or executed directly without human review.
* **Rule 14 (Tool Poisoning / Rug-Pull Defense)**:
  * Curated starter prompts are hardcoded or schema-validated from backoffice configuration, preventing injection of malicious tool calls.
* **Rule 16 (Agent Identity as First-Class Principal)**:
  * Prompts passed to composer carry contextual metadata indicating user initiation and optional AI assistance tag.
* **Rule 18 (Fail-Closed Multi-Tenancy)**:
  * If workspace context is undefined or transitioning, terminology falls back safely to `"School"` or `"Organization"` without leaking cross-tenant data.
* **Rule 19 (Human-in-the-Loop Approval Gates)**:
  * **Core Invariant**: Clicking "Open in Message Composer" or selecting a starter NEVER executes a broadcast send. It places the draft in front of the human operator for review, editing, and explicit approval.
* **Rule 21 (Graceful Degradation)**:
  * If AI assistance services or network are unavailable, the user can still freely type custom instructions or proceed directly to manual message creation.

---

## 3. Detailed Component Hierarchy & File Architecture

```
src/
├── lib/messaging/
│   ├── greeting-utils.ts                                      (Pure time & name formatting helpers)
│   └── __tests__/
│       └── greeting-utils.test.ts                             (Vitest unit test suite)
├── app/admin/messaging/
│   ├── components/dashboard/
│   │   ├── MessagingHeroGreeting.tsx                          (Flagship hero banner with AI prompt pill)
│   │   ├── MessagingAiPromptModal.tsx                         (theme.md Section 8 compliant AI modal)
│   │   └── __tests__/
│   │       ├── MessagingHeroGreeting.test.tsx                 (Banner rendering, terminology, click test)
│   │       └── MessagingAiPromptModal.test.tsx                (Modal interaction, starter injection, routing)
│   └── composer/
│       └── components/
│           ├── ComposerWizard.tsx                             (Ingests ?prompt=... into messageBody)
│           └── __tests__/
│               └── ComposerWizardPrompt.test.ts               (URL prompt parameter decoding test)
```

---

## 4. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **React Hydration Mismatch (Error #418)** | Server renders "Good morning" while client executes in evening timezone. | Console error, unstyled flash or UI flickering. | **Client-Hydrated Mount State**: `mounted` state in `useEffect` renders a neutral fallback during SSR/pre-render, and hydrates the true local time on mount. |
| **Missing / Null Display Name** | User profile has no `displayName` or contains leading/trailing whitespace. | Blank space or broken greeting ("Good morning, 👋"). | **Safe Extractor with Fallback**: `extractFirstName(displayName, fallback)` trims whitespace, splits on space, and returns `"Team Member"` if empty. |
| **Prompt Injection / XSS (CWE-79)** | User or attacker crafts malicious script in `?prompt=` query string. | DOM XSS or unexpected model command execution. | **Sanitization & URL Encoding**: All prompts are passed through `encodeURIComponent`, rendered only as React text nodes, and strictly bounded to 500 characters. |
| **Modal Accessibility / Overlay Collision** | Dialog opens under backdrop or info tooltip clips behind dialog. | Broken keyboard navigation or unreadable tooltips. | **theme.md Section 8 Compliance**: `<DialogContent>` binds to `--card` with `shadow-2xl sm:rounded-2xl`, `<DialogHeader demarcated>`, and `<CardInfoTooltip>` at `z-[10050]`. |
| **Autonomous Send Risk (Rule 19 Violation)** | Clicking AI starter immediately triggers message blast. | Unauthorized customer spam, compliance violation. | **Strict HITL Gate**: AI Prompt Modal strictly navigates to `/admin/messaging/composer?prompt=...` for human preview, recipient selection, and approval. |
| **Layout Overflow on Small Mobile (320px–375px)** | Long prompt placeholder or rigid flex container overflows viewport. | Horizontal page scrolling on mobile devices. | **Mobile-First Responsive Design**: Uses `flex-col md:flex-row`, `truncate` on text spans, and `min-h-[44px]` tap targets on all buttons. |

---

## 5. Impact Analysis & Backoffice Management (Rule 3)

### 5.1 Subsystem Impact Analysis
* **Message Composer (`/admin/messaging/composer`)**: Enhanced. Ingests `?prompt=...` from the query string to prefill the message body without disrupting existing query params (`recipient`, `entityId`, `contactRoles`, `category`).
* **Existing Messaging Dashboard (`/admin/messaging`)**: Zero disruption. The hero greeting is built as a self-contained component that can be mounted into the page without altering existing table queries.
* **Workspace Terminology Engine (`useTerminology`)**: Consumed read-only. Seamlessly supports all verticals (K-12 schools, higher education, corporate, consulting).

### 5.2 Backoffice Management (Codeless Customization)
To support institutional customization without engineering intervention:
1. **Configurable AI Starters**: Admins can customize the prompt starters via Workspace Settings (`/admin/settings?tab=messaging`), allowing seasonal prompts (e.g. *"Draft mid-term exam schedule"* or *"Send end-of-year billing notice"*).
2. **Greeting Tone Presets**: Default tone can be pre-configured per organization (e.g. Formal for legal/corporate, Friendly for primary schools).

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Time Calculation & Greeting Utilities (`src/lib/messaging/greeting-utils.ts`)

**Files:**
- Create: `src/lib/messaging/greeting-utils.ts`
- Test: `src/lib/messaging/__tests__/greeting-utils.test.ts`

- [ ] **Step 1: Write the failing unit tests for greeting helpers**

```typescript
// src/lib/messaging/__tests__/greeting-utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  getTimeOfDayGreeting,
  extractFirstName,
  formatGreetingHeadline,
  buildHeroSubtitle,
} from '../greeting-utils';

describe('greeting-utils', () => {
  describe('getTimeOfDayGreeting', () => {
    it('returns "Good morning" between 05:00 and 11:59', () => {
      expect(getTimeOfDayGreeting(new Date('2026-10-09T05:00:00'))).toBe('Good morning');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T09:30:00'))).toBe('Good morning');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T11:59:59'))).toBe('Good morning');
    });

    it('returns "Good afternoon" between 12:00 and 16:59', () => {
      expect(getTimeOfDayGreeting(new Date('2026-10-09T12:00:00'))).toBe('Good afternoon');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T14:45:00'))).toBe('Good afternoon');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T16:59:59'))).toBe('Good afternoon');
    });

    it('returns "Good evening" between 17:00 and 04:59', () => {
      expect(getTimeOfDayGreeting(new Date('2026-10-09T17:00:00'))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T22:15:00'))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T00:00:00'))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T04:59:59'))).toBe('Good evening');
    });
  });

  describe('extractFirstName', () => {
    it('extracts first name from full name string', () => {
      expect(extractFirstName('Sarah Mensah')).toBe('Sarah');
      expect(extractFirstName('Kwame Kofi Asante')).toBe('Kwame');
    });

    it('handles single names cleanly', () => {
      expect(extractFirstName('Sarah')).toBe('Sarah');
      expect(extractFirstName('  Sarah  ')).toBe('Sarah');
    });

    it('returns fallback when name is null, undefined, or empty', () => {
      expect(extractFirstName(null)).toBe('Team Member');
      expect(extractFirstName(undefined)).toBe('Team Member');
      expect(extractFirstName('')).toBe('Team Member');
      expect(extractFirstName('   ')).toBe('Team Member');
      expect(extractFirstName(undefined, 'Admin')).toBe('Admin');
    });
  });

  describe('formatGreetingHeadline', () => {
    it('combines greeting, first name, and wave emoji', () => {
      const morningDate = new Date('2026-10-09T08:00:00');
      expect(formatGreetingHeadline('Sarah Mensah', morningDate)).toBe('Good morning, Sarah 👋');
      expect(formatGreetingHeadline(null, morningDate)).toBe('Good morning, Team Member 👋');
    });
  });

  describe('buildHeroSubtitle', () => {
    it('incorporates singular entity terminology in lowercase', () => {
      expect(buildHeroSubtitle('School')).toBe(
        'Your AI-powered messaging hub for stronger school communities and better engagement.'
      );
      expect(buildHeroSubtitle('Campus')).toBe(
        'Your AI-powered messaging hub for stronger campus communities and better engagement.'
      );
    });

    it('falls back to school when entity term is missing or empty', () => {
      expect(buildHeroSubtitle(undefined)).toBe(
        'Your AI-powered messaging hub for stronger school communities and better engagement.'
      );
      expect(buildHeroSubtitle('')).toBe(
        'Your AI-powered messaging hub for stronger school communities and better engagement.'
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/messaging/__tests__/greeting-utils.test.ts`  
Expected: FAIL with "Cannot find module '../greeting-utils'"

- [ ] **Step 3: Implement greeting utility functions**

```typescript
// src/lib/messaging/greeting-utils.ts
/**
 * @fileOverview SmartSapp Messaging Dashboard — Hero Greeting Utilities
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Pure, deterministic helper functions for time-of-day greetings and user identity extraction.
 * - Adheres strictly to Rule 4 (Zero any/any[]).
 * - Safe against SSR hydration mismatches by isolating Date logic.
 */

/**
 * Classifies a timestamp into a time-of-day greeting.
 * - 05:00 - 11:59: "Good morning"
 * - 12:00 - 16:59: "Good afternoon"
 * - 17:00 - 04:59: "Good evening"
 * 
 * @param date - Optional Date instance; defaults to new Date().
 * @returns Time-of-day greeting string.
 */
export function getTimeOfDayGreeting(date: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return 'Good morning';
  }
  if (hours >= 12 && hours < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * Safely extracts the first name from a user's display name or email prefix.
 * 
 * @param displayName - Raw display name from user profile or auth context.
 * @param fallback - Fallback term if name is absent (defaults to "Team Member").
 * @returns Clean, trimmed first name or fallback.
 */
export function extractFirstName(
  displayName?: string | null,
  fallback: string = 'Team Member'
): string {
  if (!displayName || !displayName.trim()) {
    return fallback;
  }
  const trimmed = displayName.trim();
  const firstPart = trimmed.split(/\s+/)[0];
  return firstPart || fallback;
}

/**
 * Formats the full hero headline incorporating greeting, user first name, and wave emoji.
 * 
 * @param displayName - User's display name.
 * @param date - Optional Date instance.
 * @returns e.g. "Good morning, Sarah 👋"
 */
export function formatGreetingHeadline(
  displayName?: string | null,
  date: Date = new Date()
): string {
  const greeting = getTimeOfDayGreeting(date);
  const firstName = extractFirstName(displayName);
  return `${greeting}, ${firstName} 👋`;
}

/**
 * Generates the standardized hero subtitle tailored to active workspace terminology.
 * 
 * @param entityTermSingular - Singular entity label (e.g. "School", "Campus", "Client").
 * @returns e.g. "Your AI-powered messaging hub for stronger school communities and better engagement."
 */
export function buildHeroSubtitle(entityTermSingular?: string): string {
  const normalizedTerm = entityTermSingular?.trim()
    ? entityTermSingular.trim().toLowerCase()
    : 'school';
  return `Your AI-powered messaging hub for stronger ${normalizedTerm} communities and better engagement.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/messaging/__tests__/greeting-utils.test.ts`  
Expected: PASS (4 test suites, all assertions passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/lib/messaging/greeting-utils.ts src/lib/messaging/__tests__/greeting-utils.test.ts
git commit -m "feat(messaging): implement hero greeting and terminology utilities with tests"
```

---

### Task 2: Standardized AI Assistant Prompt Modal (`MessagingAiPromptModal.tsx`)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingAiPromptModal.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingAiPromptModal.test.tsx`

- [ ] **Step 1: Write the failing component test for the AI Prompt Modal**

```typescript
// src/app/admin/messaging/components/dashboard/__tests__/MessagingAiPromptModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MessagingAiPromptModal } from '../MessagingAiPromptModal';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('MessagingAiPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with demarcated header, title, and tooltip when open', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
        entityTermSingular="School"
        entityTermPlural="Schools"
      />
    );

    expect(screen.getByText('SmartSapp AI Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What would you like to draft or analyze/i)).toBeInTheDocument();
    expect(screen.getByTestId('card-info-tooltip')).toBeInTheDocument();
  });

  it('populates prompt textarea when a curated starter pill is clicked', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
        entityTermSingular="School"
        entityTermPlural="Parents"
      />
    );

    const feeReminderButton = screen.getByText(/Draft a fee reminder message for Parents/i);
    fireEvent.click(feeReminderButton);

    const textarea = screen.getByPlaceholderText(/What would you like to draft or analyze/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Draft a fee reminder message for Parents');
  });

  it('toggles tone selection pills', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
      />
    );

    const formalButton = screen.getByRole('button', { name: /Formal/i });
    fireEvent.click(formalButton);
    expect(formalButton).toHaveAttribute('data-selected', 'true');

    const friendlyButton = screen.getByRole('button', { name: /Friendly/i });
    fireEvent.click(friendlyButton);
    expect(friendlyButton).toHaveAttribute('data-selected', 'true');
    expect(formalButton).toHaveAttribute('data-selected', 'false');
  });

  it('routes to composer with sanitized encoded prompt on primary CTA click', () => {
    const handleOpenChange = vi.fn();
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={handleOpenChange}
      />
    );

    const textarea = screen.getByPlaceholderText(/What would you like to draft or analyze/i);
    fireEvent.change(textarea, { target: { value: 'Announce science fair next Friday' } });

    const submitBtn = screen.getByRole('button', { name: /Open in Message Composer/i });
    fireEvent.click(submitBtn);

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/admin/messaging/composer?prompt=')
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('Announce science fair next Friday'))
    );
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingAiPromptModal.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingAiPromptModal'"

- [ ] **Step 3: Implement `MessagingAiPromptModal.tsx` conforming to `theme.md` Section 8 and Rules 13 & 19**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingAiPromptModal.tsx
'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — Interactive AI Assistant Modal
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Strictly adheres to theme.md Section 8 (Standardized Modal Architecture):
 *   - Surface geometry: sm:rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl.
 *   - Demarcated header: <DialogHeader demarcated> with single-circle CardInfoTooltip.
 *   - Zero raw descriptions: Guidance routes through CardInfoTooltip + <DialogDescription className="sr-only">.
 *   - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with tactile active:scale-[0.97] buttons.
 * - Conforms to agents_mcp_rules.md:
 *   - Rule 13 (Trust Boundary Matrix): Prompt treated as UNTRUSTED_USER_INPUT.
 *   - Rule 19 (HITL Approval Gate): Routes to Composer for human review; NEVER auto-dispatches.
 *   - Rule 8 (Input Sanitization): Safe encoding, zero raw HTML injection.
 * - Strict typing: Zero any or any[].
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';

export type PromptTone = 'formal' | 'friendly' | 'urgent' | 'concise';

export interface MessagingAiPromptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entityTermSingular?: string;
  entityTermPlural?: string;
  initialPrompt?: string;
}

export function MessagingAiPromptModal({
  isOpen,
  onOpenChange,
  entityTermSingular = 'School',
  entityTermPlural = 'Recipients',
  initialPrompt = '',
}: MessagingAiPromptModalProps) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [selectedTone, setSelectedTone] = React.useState<PromptTone>('friendly');

  // Reset prompt when modal reopens with a new initial prompt
  React.useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  const curatedStarters = React.useMemo(() => [
    `Draft a fee reminder message for ${entityTermPlural}`,
    `Draft an emergency ${entityTermSingular.toLowerCase()} closure notice`,
    `Write a warm welcome message for new ${entityTermPlural}`,
    `Analyze recent campaign performance and recommend improvements`,
  ], [entityTermSingular, entityTermPlural]);

  const tones: Array<{ id: PromptTone; label: string; icon: string }> = [
    { id: 'friendly', label: 'Friendly', icon: '😊' },
    { id: 'formal', label: 'Formal', icon: '🏛️' },
    { id: 'urgent', label: 'Urgent', icon: '🚨' },
    { id: 'concise', label: 'Concise', icon: '⚡' },
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    // Append tone context if not already mentioned
    const fullQuery = `${trimmed} [Tone: ${selectedTone}]`;
    const targetUrl = `/admin/messaging/composer?prompt=${encodeURIComponent(fullQuery)}`;

    onOpenChange(false);
    router.push(targetUrl);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
              SmartSapp AI Assistant
            </DialogTitle>
            <CardInfoTooltip
              text="Ask AI to draft messages, refine campaigns, or analyze communication performance across all channels."
            />
            <DialogDescription className="sr-only">
              Ask AI to draft messages or analyze messaging campaigns
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Prompt Textarea */}
          <div className="space-y-2">
            <label
              htmlFor="ai-prompt-input"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
            >
              <span>Your Instructions or Topic</span>
              <span className="text-[11px] font-normal text-muted-foreground/80">
                {prompt.length} characters
              </span>
            </label>
            <div className="relative rounded-xl border border-border/80 bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all">
              <textarea
                id="ai-prompt-input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like to draft or analyze? (e.g., Draft a fee reminder message for next term...)"
                className="w-full bg-transparent px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none"
              />
              {prompt.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPrompt('')}
                  aria-label="Clear prompt"
                  className="absolute right-3 top-3 h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center justify-center transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tone Selector */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tone & Style
            </span>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => {
                const isSelected = selectedTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={() => setSelectedTone(t.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] min-h-[36px] sm:min-h-[32px] border cursor-pointer',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground border-border/60'
                    )}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Curated Prompt Starters */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span>Suggested Starters</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {curatedStarters.map((starter, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(starter)}
                  className="text-left p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-xs text-foreground/90 transition-all active:scale-[0.98] cursor-pointer flex items-start gap-2 group"
                >
                  <span className="text-muted-foreground/60 group-hover:text-blue-500 transition-colors pt-0.5">
                    •
                  </span>
                  <span className="line-clamp-2 leading-relaxed">{starter}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Demarcated Footer */}
        <DialogFooter demarcated>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!prompt.trim()}
            onClick={() => handleSubmit()}
            className="rounded-xl min-h-[44px] active:scale-[0.97] gap-2 text-xs font-medium bg-primary text-primary-foreground shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Open in Message Composer</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingAiPromptModal.test.tsx`  
Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingAiPromptModal.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingAiPromptModal.test.tsx
git commit -m "feat(messaging): implement theme-compliant AI assistant prompt modal"
```

---

### Task 3: Flagship Hero Greeting Card Component (`MessagingHeroGreeting.tsx`)

**Files:**
- Create: `src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/MessagingHeroGreeting.test.tsx`

- [ ] **Step 1: Write the failing component test for `MessagingHeroGreeting`**

```tsx
// src/app/admin/messaging/components/dashboard/__tests__/MessagingHeroGreeting.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MessagingHeroGreeting } from '../MessagingHeroGreeting';

// Mock auth hook
vi.mock('@/firebase', () => ({
  useUser: () => ({
    user: { displayName: 'Sarah Mensah', email: 'sarah@example.com' },
    isUserLoading: false,
  }),
}));

// Mock terminology hook
vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'School',
    plural: 'Schools',
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('MessagingHeroGreeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders time-of-day greeting with extracted first name', () => {
    render(<MessagingHeroGreeting />);
    expect(screen.getByText(/Sarah 👋/i)).toBeInTheDocument();
  });

  it('renders dynamic subtitle using active terminology', () => {
    render(<MessagingHeroGreeting />);
    expect(
      screen.getByText(/Your AI-powered messaging hub for stronger school communities and better engagement\./i)
    ).toBeInTheDocument();
  });

  it('renders interactive AI prompt pill with tactile attributes', () => {
    render(<MessagingHeroGreeting />);
    const promptPill = screen.getByRole('button', { name: /Ask AI to draft/i });
    expect(promptPill).toBeInTheDocument();
    expect(promptPill).toHaveClass('active:scale-[0.98]');
  });

  it('opens AI prompt modal when the interactive prompt pill is clicked', () => {
    render(<MessagingHeroGreeting />);
    const promptPill = screen.getByRole('button', { name: /Ask AI to draft/i });
    fireEvent.click(promptPill);

    expect(screen.getByText('SmartSapp AI Assistant')).toBeInTheDocument();
  });

  it('allows overriding user display name via props for SSR or custom previews', () => {
    render(<MessagingHeroGreeting userDisplayName="Kwame Asante" />);
    expect(screen.getByText(/Kwame 👋/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingHeroGreeting.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingHeroGreeting'"

- [ ] **Step 3: Implement `MessagingHeroGreeting.tsx`**

```tsx
// src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx
'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — Hero Greeting Banner
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Visual flagship card matching user mockup (media_1791516336748_2f0e908d.jpg).
 * - Hydration-safe time-of-day greeting ("Good morning / afternoon / evening, [First Name] 👋").
 * - Dynamic workspace terminology injection via useTerminology() (Rule 3).
 * - Interactive glassmorphic AI prompt bar trigger.
 * - Mobile ergonomics: Stacks cleanly on mobile viewports (< 768px) with min-h-[44px] touch targets.
 * - Theme adaptability: Institutional gradient in light mode; deep slate/indigo accent in dark mode.
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import { Bot, ArrowRight } from 'lucide-react';
import { useUser } from '@/firebase';
import { useTerminology } from '@/hooks/use-terminology';
import {
  formatGreetingHeadline,
  buildHeroSubtitle,
} from '@/lib/messaging/greeting-utils';
import { MessagingAiPromptModal } from './MessagingAiPromptModal';
import { cn } from '@/lib/utils';

export interface MessagingHeroGreetingProps {
  userDisplayName?: string | null;
  className?: string;
  onOpenAiPrompt?: () => void;
}

export function MessagingHeroGreeting({
  userDisplayName,
  className,
  onOpenAiPrompt,
}: MessagingHeroGreetingProps) {
  const { user } = useUser();
  const terminology = useTerminology();
  const [mounted, setMounted] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Prevent SSR hydration mismatch for timezone-dependent greeting
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeName = userDisplayName ?? user?.displayName ?? null;
  const headline = mounted
    ? formatGreetingHeadline(activeName)
    : `Welcome, ${activeName ? activeName.split(' ')[0] : 'Team Member'} 👋`;

  const subtitle = buildHeroSubtitle(terminology?.singular);

  const handlePillClick = () => {
    if (onOpenAiPrompt) {
      onOpenAiPrompt();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          // Gradient container: Royal blue to deep indigo in light mode; rich dark slate in dark mode
          'relative overflow-hidden rounded-2xl sm:rounded-3xl',
          'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 dark:from-slate-900 dark:via-blue-950/60 dark:to-slate-900',
          'border border-blue-500/20 dark:border-blue-800/40 shadow-xl dark:shadow-2xl',
          'p-6 sm:p-7 md:p-8 text-white',
          className
        )}
      >
        {/* Subtle decorative background ambient glow */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 dark:bg-blue-500/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 lg:gap-8">
          {/* Left Text Block */}
          <div className="space-y-1.5 max-w-xl">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              {headline}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 dark:text-blue-200/80 leading-relaxed font-normal">
              {subtitle}
            </p>
          </div>

          {/* Right AI Prompt Bar Pill */}
          <div className="shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={handlePillClick}
              aria-label="Ask AI to draft a message, find contacts, or analyze campaign results"
              className={cn(
                'w-full md:w-auto inline-flex items-center justify-between gap-3',
                'px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-full',
                'bg-white/10 hover:bg-white/15 dark:bg-white/5 dark:hover:bg-white/10',
                'border border-white/20 dark:border-white/10',
                'backdrop-blur-md shadow-inner text-white',
                'transition-all duration-200 cursor-pointer',
                'active:scale-[0.98] min-h-[44px] group'
              )}
            >
              {/* Bot Icon */}
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/20 dark:bg-blue-500/30 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                <Bot className="h-4 w-4" />
              </div>

              {/* Middle Prompt Snippet */}
              <span className="text-xs sm:text-sm text-white/90 dark:text-white/80 font-normal truncate max-w-[210px] sm:max-w-xs md:max-w-[260px] lg:max-w-sm text-left">
                Ask AI to draft a message, find parents, or analyze results...
              </span>

              {/* Arrow Circle Button */}
              <div className="h-7 w-7 rounded-full bg-blue-500 group-hover:bg-blue-400 dark:bg-blue-600 dark:group-hover:bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-sm transition-all group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      <MessagingAiPromptModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        entityTermSingular={terminology?.singular}
        entityTermPlural={terminology?.plural}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/MessagingHeroGreeting.test.tsx`  
Expected: PASS (5 tests passing)

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx src/app/admin/messaging/components/dashboard/__tests__/MessagingHeroGreeting.test.tsx
git commit -m "feat(messaging): implement flagship hero greeting banner with dynamic terminology and AI prompt bar"
```

---

### Task 4: Composer `prompt` Search Parameter Ingestion (`ComposerWizard.tsx`)

**Files:**
- Modify: `src/app/admin/messaging/composer/components/ComposerWizard.tsx:456-488`
- Test: `src/app/admin/messaging/composer/components/__tests__/ComposerWizardPrompt.test.ts`

- [ ] **Step 1: Write a focused test verifying `prompt` searchParam pre-populates `messageBody`**

```typescript
// src/app/admin/messaging/composer/components/__tests__/ComposerWizardPrompt.test.ts
import { describe, it, expect } from 'vitest';

describe('Composer Prompt Ingestion Spec', () => {
  it('safely decodes and extracts prompt parameter from query string', () => {
    const rawSearch = '?prompt=' + encodeURIComponent('Draft fee reminder for Parents [Tone: formal]');
    const params = new URLSearchParams(rawSearch);
    const prompt = params.get('prompt');

    expect(prompt).toBe('Draft fee reminder for Parents [Tone: formal]');
  });

  it('handles null, undefined or empty prompts without altering state', () => {
    const params = new URLSearchParams('');
    expect(params.get('prompt')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/app/admin/messaging/composer/components/__tests__/ComposerWizardPrompt.test.ts`  
Expected: PASS

- [ ] **Step 3: Update `ComposerWizard.tsx` to read `prompt` from searchParams**

In `src/app/admin/messaging/composer/components/ComposerWizard.tsx`, lines 456-488:
```typescript
    React.useEffect(() => {
        if (!searchParams) return;
        const r = searchParams.get('recipient');
        if (r) setValue('recipient', r);

        // Pre-populate message body when launched from AI prompt bar (Rule 8 & 19 safe binding)
        const promptParam = searchParams.get('prompt');
        if (promptParam) {
            setValue('messageBody', promptParam);
        }

        const entityIdParam = searchParams.get('entityId');
        if (entityIdParam) {
            setValue('entityId', entityIdParam);
            setValue('selectedEntityIds', [entityIdParam]);
        }
        ...
```

- [ ] **Step 4: Run typecheck and existing composer tests**

Run: `npx vitest run src/app/admin/messaging/composer/components/__tests__/ComposerWizardPrompt.test.ts`  
Run: `pnpm typecheck`  
Expected: All tests pass, 0 type errors.

- [ ] **Step 5: Commit locally**

```bash
git add src/app/admin/messaging/composer/components/ComposerWizard.tsx src/app/admin/messaging/composer/components/__tests__/ComposerWizardPrompt.test.ts
git commit -m "feat(messaging): ingest prompt search parameter into message body in composer wizard"
```

---

## 7. Verification Invariants & Definition of Done

* [ ] `npx vitest run src/lib/messaging/__tests__/greeting-utils.test.ts` passes with 100% assertions.
* [ ] `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/` passes with 100% assertions.
* [ ] `pnpm typecheck` completes with **0 errors**.
* [ ] `pnpm lint` completes with **0 errors**.
* [ ] Zero `any` or `any[]` throughout new files (Strict Typing Invariant — Rule 4).
* [ ] Dialog strictly adheres to `theme.md` Section 8 (`sm:rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip>`, `<DialogDescription className="sr-only">`).
* [ ] Mobile touch targets meet the `min-h-[44px]` standard with tactile `active:scale-[0.97]` clicks (Rule 7).
* [ ] Human-in-the-Loop approval gate strictly enforced (Rule 19) — zero autonomous broadcasts.
* [ ] Zero unprompted git push to remote origin (Rule 5).
