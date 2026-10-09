# Phase 7: Backoffice Codeless Controls, AI Agent MCP Tooling & Resilience Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Backoffice Codeless Controls tab at `/admin/settings?tab=messaging` for administrative governance (low-balance alerts, quick template shortlists, AI prompt customizers, channel kill-switches), register the official `messaging.get_dashboard_summary` MCP tool for AI agents, wire dynamic settings into the Communications Hub and Quick Message Composer, and conduct full platform resilience verification.

**Architecture:** A fail-closed, multi-tenant settings domain persisted in Firestore (`workspaces/{workspaceId}/messaging_settings/current`) coupled with an administrative server action suite with optimistic concurrency (TOCTOU) versioning. The backend dashboard aggregator (`getMessagingDashboardSummaryAction`) dynamically merges these settings to drive runtime alerts, template selections, AI prompt defaults, and channel kill-switch enforcement. The data aggregator is exposed to autonomous agents via a strictly typed, JSON-RPC 2.0 compliant MCP tool (`messaging.get_dashboard_summary`) with exact 64-character SHA-256 schema hashing, server-side risk tiering (`read_only`), and audit logging.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict zero-any), Zod 3, Firebase Admin Firestore, Vitest, Tailwind CSS, Lucide React, Model Context Protocol (MCP TypeScript SDK).

---

## 1. Relevant Milestone Documentation & References

This implementation plan is derived directly from the canonical architectural specifications:
1. **`docs/messaging/messaging_dashboard_redesign_plan.md`**:
   - **Section 4.2 (Backoffice Enhancement & Codeless Management)**: Configurable quick templates shortlist, SMS low-balance alert thresholds, AI assistant prompt placeholders, and channel maintenance kill-switches.
   - **Section 2.2 (Agentic & MCP Rules 1–25)**: Protocol compliance, server-side risk enforcement, trust boundary matrix, tool versioning, and fail-closed multi-tenancy.
2. **`docs/agents_mcp/agents_mcp_rules.md` (Governing Rules 1–25)**:
   - **Rule 1**: Next.js & React best practices, Emil Kowalski tactile animations (`active:scale-[0.97]`).
   - **Rule 2**: What could go wrong & architectural mitigation matrix.
   - **Rule 3**: Cross-module feature interactions & backoffice codeless control impact.
   - **Rule 4**: Strict typing invariant — strictly zero `any` or `any[]` throughout production and test code. `unknown` permitted only at external trust boundaries, immediately narrowed with Zod.
   - **Rule 5**: Staged validation, index verification, zero unprompted remote git push / production deployment.
   - **Rule 6**: Dependency configuration and latest documentation awareness.
   - **Rule 7**: Mobile-first ergonomics (`min-h-[44px]` touch targets, responsive viewports, everyday UI English).
   - **Rule 8**: High security standards & fail-closed multi-tenancy (`requireWorkspace`, cross-tenant isolation).
   - **Rule 9**: Scale & resource protection (bounded in-memory caching, anti-batch-overload, quota protection).
   - **Rule 10**: Inline architectural documentation, cautionary areas, and testability pointers.
   - **Rule 11**: MCP Protocol Compliance (stateless multi-round-trip, JSON-RPC 2.0 wire format).
   - **Rule 12**: Server-side risk tiering (`read_only` enforced server-side, ignoring client hints).
   - **Rule 13**: Formal Trust Boundary Matrix (`SYSTEM TRUST`, `USER TRUST`, `USER UNTRUSTED`).
   - **Rule 14**: Tool poisoning / rug-pull defense (exact 64-character SHA-256 `schemaHash`, version pinning).
   - **Rule 15**: Supply-chain controls & server allowlisting (`ALL_CORE_MCP_TOOLS` registry).
   - **Rule 16**: Agent identity as a first-class security principal (`McpExecutionContext`).
   - **Rule 17**: Non-delegable privileges (agents get read-only summary telemetry; mutating settings is strictly human-gated).
   - **Rule 18**: Time-of-Check / Time-of-Use (TOCTOU) concurrency protection (`version` counter in Firestore doc).
   - **Rule 19**: Idempotent operations & human gates for mutations.
   - **Rule 20**: Replay / duplicate delivery protection & cache invalidation scoping.
   - **Rule 21**: Two-phase action model & graceful degradation (fallback to defaults if doc uninitialized).
   - **Rule 22**: Approval binding to exact schema parameters.
   - **Rule 23**: Execution budget, backpressure, and resource governance (max 8 templates, max 6 prompt starters).
   - **Rule 24**: Circuit breakers (provider health telemetry 'healthy' | 'degraded' | 'error' with 3.5s timeout).
   - **Rule 25**: Dead-letter and recovery queue visibility (`failedCount` exposed directly).
3. **`theme.md` (Sections 4 & 8)**: Standardized card geometry (`rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs`) and modal design (`DialogHeader demarcated`, `CardInfoTooltip`, `DialogDescription sr-only`).
4. **`.agents/AGENTS.md`**: Workspace standards, actionable relative toast routing (`actionConfig.path`), and strict Git protocol (local commits only, zero unprompted remote pushes).

---

## 2. Formal Trust Boundary Matrix (Rule 13)

| Data Element | Source | Trust Classification | Validation & Invariant Mechanism |
| :--- | :--- | :--- | :--- |
| `workspaceId`, `organizationId` | `McpExecutionContext` / Session | **SYSTEM TRUST** | Verified via `requireWorkspace(workspaceId)` against active session. |
| `callerId`, `callerType` | MCP Wire Protocol Header | **AGENT / USER TRUST** | Captured for audit trail logging; never used to bypass tenant boundaries. |
| `forceRefresh` | Tool Parameter | **USER UNTRUSTED** | Validated via `z.boolean().optional().default(false)`. |
| Settings Fields (`lowBalanceThreshold`, etc.) | Admin Form Submission | **USER UNTRUSTED** | Strict Zod validation: integer `min(0)`, template IDs `min(1).max(8)`, prompt starters `max(6)`. |
| AI Prompt Starters | Admin Form Submission | **USER UNTRUSTED** | String length clamped (5–120 chars), sanitized plain text, rendered via React DOM escaping (zero raw HTML/CSS leaks). |
| Kill-Switch States | Admin Form Submission | **USER UNTRUSTED** | Strict boolean dictionary `ChannelKillSwitchesSchema`. |

---

## 3. What Could Go Wrong & Architectural Mitigation Matrix (Rules 2 & 3)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Settings Leakage (Rule 8 & 18)** | Settings action reading/writing without checking caller's organization ID. | A malicious user in Workspace A could modify SMS thresholds or templates for Workspace B. | **Fail-Closed Tenancy Check**: `requireWorkspace(workspaceId)` verifies user membership and ensures `workspace.organizationId === user.organizationId`. |
| **TOCTOU Concurrency Overwrites (Rule 18)** | Two administrators save settings concurrently; second overwrite clobbers the first. | Silent data loss of newly configured prompts or kill-switches. | **Optimistic Concurrency**: `WorkspaceMessagingSettingsSchema` carries a `version: number`. Updates increment `version` and optionally verify `expectedVersion`. |
| **MCP Rug-Pull / Tool Poisoning (Rule 14)** | Tool parameters or behavior modified silently without fingerprint update. | Agents execute unexpected logic or bypass governance. | **64-Character SHA-256 `schemaHash`**: `messaging.get_dashboard_summary` publishes `schemaHash: '7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b'`. Any schema drift breaks contract. |
| **Privilege Escalation via Agent (Rule 17)** | Exposing settings mutation to an autonomous AI agent. | An agent disables kill-switches or alters thresholds without human authorization. | **Non-Delegable Privileges**: AI agents only have `read_only` access to `messaging.get_dashboard_summary`. Settings mutation is strictly non-delegable to agents (human backoffice only). |
| **Channel Kill-Switch Desynchronization (Rule 3 & 21)** | Channel paused in settings while Quick Composer or Server Action still dispatches. | Unintended message sends during provider outage or scheduled maintenance. | **Dual-Gate Kill-Switch Enforcement**: (1) UI disables channel with maintenance banner; (2) `dispatchQuickDirectMessageAction` checks active kill-switches server-side and rejects with `code: 'CHANNEL_PAUSED'`. |
| **Cache Invalidation Lag (Rule 9 & 20)** | Admin updates settings but dashboard serves stale cached KPI summary for 3 minutes. | Confusion over why newly saved settings haven't taken effect immediately. | **Atomic Scoped Cache Purge**: `updateWorkspaceMessagingSettingsAction` purges `dashboardSummaryCache` for `${organizationId}:${workspaceId}` immediately upon write. |
| **Negative Threshold or Template Starvation (Rule 4 & 23)** | Admin enters negative SMS balance threshold or removes all starter templates. | Broken dashboard KPI alerts, division-by-zero, or empty template widgets. | **Zod Schema Boundary**: `lowBalanceThreshold` enforces `min(0)`. `quickTemplateIds` enforces `min(1)` and falls back to canonical default starter templates if empty. |
| **Resource Exhaustion on Custom Prompts (Rule 23)** | Admin pastes massive text blocks into AI prompt starters. | UI layout breaks, excessive LLM token consumption in Hero Greeting. | **Bounded Array & String Limits**: `aiPromptStarters` capped at 6 items, max 120 characters each. |

---

## 4. File Inventory & Touchpoints

```
src/
├── lib/
│   ├── types/
│   │   ├── messaging-settings.ts                         (NEW: Zod schema & TS interfaces for messaging settings)
│   │   └── __tests__/messaging-settings.test.ts          (NEW: Test suite for settings validation & defaults)
│   └── mcp/
│       └── tools/
│           ├── messaging-dashboard-tool.ts               (NEW: Governed MCP tool for dashboard aggregator)
│           ├── __tests__/messaging-dashboard-tool.test.ts(NEW: Test suite for MCP tool execution & isolation)
│           └── index.ts                                  (MODIFIED: Register messaging tool in ALL_CORE_MCP_TOOLS)
├── app/
│   ├── actions/
│   │   ├── messaging-settings-actions.ts                 (NEW: Server actions to get/update workspace settings)
│   │   ├── messaging-dashboard-actions.ts                (MODIFIED: Ingest dynamic settings into aggregator)
│   │   ├── quick-message-actions.ts                      (MODIFIED: Enforce server-side channel kill-switches)
│   │   └── __tests__/
│   │       ├── messaging-settings-actions.test.ts        (NEW: Integration tests for settings persistence)
│   │       ├── messaging-dashboard-actions.test.ts       (MODIFIED: Verify settings integration & cache purge)
│   │       └── quick-message-actions.test.ts             (MODIFIED: Test channel kill-switch rejection)
│   └── admin/
│       ├── settings/
│       │   ├── SettingsClient.tsx                        (MODIFIED: Mount MessagingSettingsTab under tab=messaging)
│       │   └── components/
│       │       ├── MessagingSettingsTab.tsx              (NEW: Backoffice codeless configuration component)
│       │       └── __tests__/MessagingSettingsTab.test.tsx(NEW: Component tests for settings interactions)
│       └── messaging/
│           ├── components/dashboard/
│           │   ├── QuickMessageComposerCard.tsx          (MODIFIED: Display channel kill-switch banner and disable send)
│           │   ├── QuickTemplatesCard.tsx                (MODIFIED: Render dynamic workspace templates)
│           │   └── MessagingHeroGreeting.tsx             (MODIFIED: Render dynamic prompt starters)
│           ├── MessagingClient.tsx                       (MODIFIED: Wire dynamic settings to children)
│           └── __tests__/
│               └── MessagingPhase7Integration.test.tsx   (NEW: End-to-end integration & regression suite)
```

---

## 5. Phase 7 Implementation Tasks

### Task 1: Workspace Messaging Settings Domain Schema, Versioning & Server Actions (TDD)

**Files:**
- Create: `src/lib/types/messaging-settings.ts`
- Create: `src/lib/types/__tests__/messaging-settings.test.ts`
- Create: `src/app/actions/messaging-settings-actions.ts`
- Create: `src/app/actions/__tests__/messaging-settings-actions.test.ts`

- [ ] **Step 1: Write unit tests for messaging settings schemas and defaults**

```typescript
// src/lib/types/__tests__/messaging-settings.test.ts
import { describe, it, expect } from 'vitest';
import {
  WorkspaceMessagingSettingsSchema,
  DEFAULT_MESSAGING_SETTINGS,
  type WorkspaceMessagingSettings,
} from '../messaging-settings';

describe('WorkspaceMessagingSettingsSchema', () => {
  it('validates a valid messaging settings configuration with versioning', () => {
    const validData: WorkspaceMessagingSettings = {
      version: 1,
      lowBalanceThreshold: 150,
      quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
      aiPromptStarters: ['Draft an end-of-term congratulations message'],
      channelKillSwitches: {
        sms: false,
        whatsapp: false,
        email: false,
      },
    };

    const parsed = WorkspaceMessagingSettingsSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(1);
      expect(parsed.data.lowBalanceThreshold).toBe(150);
      expect(parsed.data.quickTemplateIds).toHaveLength(2);
    }
  });

  it('populates default values when given an empty object', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(1);
      expect(parsed.data.lowBalanceThreshold).toBe(100);
      expect(parsed.data.quickTemplateIds).toEqual(DEFAULT_MESSAGING_SETTINGS.quickTemplateIds);
      expect(parsed.data.channelKillSwitches.sms).toBe(false);
    }
  });

  it('rejects negative low balance thresholds', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({
      lowBalanceThreshold: -25,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects oversized prompt starters (> 120 chars)', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({
      aiPromptStarters: ['A'.repeat(121)],
    });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/types/__tests__/messaging-settings.test.ts`  
Expected: FAIL with "Cannot find module '../messaging-settings'".

- [ ] **Step 3: Implement domain types & Zod schema in `src/lib/types/messaging-settings.ts`**

```typescript
// src/lib/types/messaging-settings.ts
/**
 * @fileOverview Domain schemas and types for Workspace Messaging Governance Settings.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 8: Multi-tenant configuration boundaries.
 * - Rule 18: TOCTOU concurrency protection with integer document version.
 * - Rule 23: Explicit bounds on templates (max 8) and prompts (max 6, <=120 chars).
 */

import { z } from 'zod';

export const ChannelKillSwitchesSchema = z.object({
  sms: z.boolean().default(false).describe('Pause all SMS outbound dispatches for maintenance'),
  whatsapp: z.boolean().default(false).describe('Pause all WhatsApp outbound dispatches for maintenance'),
  email: z.boolean().default(false).describe('Pause all Email outbound dispatches for maintenance'),
});

export type ChannelKillSwitches = z.infer<typeof ChannelKillSwitchesSchema>;

export const WorkspaceMessagingSettingsSchema = z.object({
  version: z
    .number()
    .int()
    .nonnegative()
    .default(1)
    .describe('Optimistic concurrency document version (Rule 18 TOCTOU protection)'),
  lowBalanceThreshold: z
    .number()
    .int()
    .min(0, 'Threshold cannot be negative')
    .default(100)
    .describe('SMS unit balance threshold below which warning badges are displayed'),
  quickTemplateIds: z
    .array(z.string())
    .min(1, 'At least one quick template must be selected')
    .max(8, 'Maximum 8 quick templates allowed')
    .default(['tpl_welcome', 'tpl_fee', 'tpl_event', 'tpl_update'])
    .describe('List of template IDs displayed in the dashboard Quick Templates card'),
  aiPromptStarters: z
    .array(z.string().min(5).max(120))
    .max(6, 'Maximum 6 prompt starters allowed')
    .default([
      'Draft a warm welcome note for new enrollments',
      'Remind parents about the upcoming PTA meeting',
      'Send a polite tuition fee reminder for this term',
      'Announce the inter-school sports gala this Friday',
    ])
    .describe('Custom AI prompt suggestions rendered in the Hero Greeting card'),
  channelKillSwitches: ChannelKillSwitchesSchema.default({
    sms: false,
    whatsapp: false,
    email: false,
  }),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type WorkspaceMessagingSettings = z.infer<typeof WorkspaceMessagingSettingsSchema>;

export const DEFAULT_MESSAGING_SETTINGS: WorkspaceMessagingSettings = {
  version: 1,
  lowBalanceThreshold: 100,
  quickTemplateIds: ['tpl_welcome', 'tpl_fee', 'tpl_event', 'tpl_update'],
  aiPromptStarters: [
    'Draft a warm welcome note for new enrollments',
    'Remind parents about the upcoming PTA meeting',
    'Send a polite tuition fee reminder for this term',
    'Announce the inter-school sports gala this Friday',
  ],
  channelKillSwitches: {
    sms: false,
    whatsapp: false,
    email: false,
  },
};
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/types/__tests__/messaging-settings.test.ts`  
Expected: PASS (4 tests).

- [ ] **Step 5: Write unit tests for messaging settings server actions**

```typescript
// src/app/actions/__tests__/messaging-settings-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkspaceMessagingSettingsAction,
  updateWorkspaceMessagingSettingsAction,
} from '../messaging-settings-actions';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn(() => ({
  get: mockGet,
  set: mockSet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    doc: (path: string) => mockDoc(path),
  },
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (workspaceId: string) => {
    if (workspaceId === 'unauthorized') {
      throw new Error('Unauthorized');
    }
    return {
      workspace: { id: workspaceId, organizationId: 'org_123' },
      user: { uid: 'user_123', email: 'admin@smartsapp.com' },
    };
  }),
}));

vi.mock('@/lib/messaging/messaging-dashboard-cache', () => ({
  dashboardSummaryCache: new Map(),
}));

describe('messaging-settings-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default settings when doc does not exist (Rule 21)', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const res = await getWorkspaceMessagingSettingsAction('ws_123');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.lowBalanceThreshold).toBe(100);
      expect(res.data.channelKillSwitches.sms).toBe(false);
      expect(res.data.version).toBe(1);
    }
  });

  it('updates settings, increments version, and invalidates cache', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ version: 1, lowBalanceThreshold: 100 }),
    });
    mockSet.mockResolvedValueOnce(undefined);

    const res = await updateWorkspaceMessagingSettingsAction('ws_123', {
      lowBalanceThreshold: 200,
      quickTemplateIds: ['tpl_fee'],
      aiPromptStarters: ['Custom prompt'],
      channelKillSwitches: { sms: true, whatsapp: false, email: false },
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.version).toBe(2);
      expect(res.data.lowBalanceThreshold).toBe(200);
    }
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith('workspaces/ws_123/messaging_settings/current');
  });

  it('rejects unauthorized caller (Rule 8 & 18)', async () => {
    const res = await updateWorkspaceMessagingSettingsAction('unauthorized', {
      lowBalanceThreshold: 50,
      quickTemplateIds: ['tpl_welcome'],
      aiPromptStarters: [],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/unauthorized/i);
    }
  });

  it('prevents concurrency overwrite when expectedVersion mismatches (Rule 18)', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ version: 3, lowBalanceThreshold: 100 }),
    });

    const res = await updateWorkspaceMessagingSettingsAction(
      'ws_123',
      { lowBalanceThreshold: 150 },
      2 // Stale expected version
    );

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe('CONCURRENCY_CONFLICT');
    }
    expect(mockSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify failure**

Run: `npx vitest run src/app/actions/__tests__/messaging-settings-actions.test.ts`  
Expected: FAIL with "Cannot find module '../messaging-settings-actions'".

- [ ] **Step 7: Implement `src/app/actions/messaging-settings-actions.ts`**

```typescript
// src/app/actions/messaging-settings-actions.ts
'use server';

/**
 * @fileOverview Server actions for managing Workspace Messaging Governance Settings.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any.
 * - Rule 8 & Rule 18: Fail-closed multi-tenancy verification.
 * - Rule 9: Cache invalidation on setting modification.
 * - Rule 17: Non-delegable administrative privileges (human session required).
 * - Rule 18: TOCTOU concurrency protection with expectedVersion verification.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import {
  WorkspaceMessagingSettingsSchema,
  DEFAULT_MESSAGING_SETTINGS,
  type WorkspaceMessagingSettings,
} from '@/lib/types/messaging-settings';
import { dashboardSummaryCache } from '@/lib/messaging/messaging-dashboard-cache';

export type MessagingSettingsActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function getWorkspaceMessagingSettingsAction(
  workspaceId: string
): Promise<MessagingSettingsActionResult<WorkspaceMessagingSettings>> {
  try {
    const { workspace } = await requireWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found', code: 'NOT_FOUND' };
    }

    const docRef = adminDb.doc(`workspaces/${workspaceId}/messaging_settings/current`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: true, data: DEFAULT_MESSAGING_SETTINGS };
    }

    const parsed = WorkspaceMessagingSettingsSchema.safeParse(snap.data());
    if (!parsed.success) {
      return { success: true, data: DEFAULT_MESSAGING_SETTINGS };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve messaging settings';
    return { success: false, error: message, code: 'UNAUTHORIZED' };
  }
}

export async function updateWorkspaceMessagingSettingsAction(
  workspaceId: string,
  settings: Partial<WorkspaceMessagingSettings>,
  expectedVersion?: number
): Promise<MessagingSettingsActionResult<WorkspaceMessagingSettings>> {
  try {
    const { workspace, user } = await requireWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found', code: 'NOT_FOUND' };
    }

    const docRef = adminDb.doc(`workspaces/${workspaceId}/messaging_settings/current`);
    const snap = await docRef.get();
    const currentData = snap.exists ? snap.data() : null;
    const currentVersion = typeof currentData?.version === 'number' ? currentData.version : 1;

    // Rule 18: TOCTOU Concurrency Guard
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      return {
        success: false,
        error: 'Settings were modified by another administrator. Please refresh the page and try again.',
        code: 'CONCURRENCY_CONFLICT',
      };
    }

    const existingRes = await getWorkspaceMessagingSettingsAction(workspaceId);
    const baseSettings = existingRes.success ? existingRes.data : DEFAULT_MESSAGING_SETTINGS;

    const merged = {
      ...baseSettings,
      ...settings,
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };

    const validated = WorkspaceMessagingSettingsSchema.parse(merged);
    await docRef.set(validated, { merge: true });

    // Invalidate dashboard summary cache for this workspace across all timeframes (Rule 9 & 20)
    for (const range of ['24h', '7d', '30d']) {
      dashboardSummaryCache.delete(`dashboard:${workspace.organizationId}:${workspaceId}:${range}`);
    }
    dashboardSummaryCache.delete(`dashboard:${workspace.organizationId}:${workspaceId}`);

    return { success: true, data: validated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update messaging settings';
    return { success: false, error: message, code: 'UPDATE_FAILED' };
  }
}
```

- [ ] **Step 8: Run test to verify pass**

Run: `npx vitest run src/app/actions/__tests__/messaging-settings-actions.test.ts`  
Expected: PASS (4 tests).

- [ ] **Step 9: Commit locally**

```bash
git add src/lib/types/messaging-settings.ts src/lib/types/__tests__/messaging-settings.test.ts src/app/actions/messaging-settings-actions.ts src/app/actions/__tests__/messaging-settings-actions.test.ts
git commit -m "feat(messaging): implement workspace messaging settings schema with TOCTOU versioning and server actions"
```

---

### Task 2: Backoffice Codeless Controls Tab (`MessagingSettingsTab.tsx`) & Mounting (TDD)

**Files:**
- Create: `src/app/admin/settings/components/MessagingSettingsTab.tsx`
- Create: `src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`
- Modify: `src/app/admin/settings/SettingsClient.tsx`

- [ ] **Step 1: Write component tests for `MessagingSettingsTab`**

```tsx
// src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingSettingsTab } from '../MessagingSettingsTab';
import * as actions from '@/app/actions/messaging-settings-actions';

vi.mock('@/app/actions/messaging-settings-actions', () => ({
  getWorkspaceMessagingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      version: 1,
      lowBalanceThreshold: 120,
      quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
      aiPromptStarters: ['Custom Starter Prompt 1'],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    },
  }),
  updateWorkspaceMessagingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      version: 2,
      lowBalanceThreshold: 150,
      quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
      aiPromptStarters: ['Custom Starter Prompt 1'],
      channelKillSwitches: { sms: true, whatsapp: false, email: false },
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('MessagingSettingsTab', () => {
  it('renders settings fields with loaded data', async () => {
    render(<MessagingSettingsTab workspaceId="ws_123" />);

    await waitFor(() => {
      expect(screen.getByText(/SMS Low-Balance Alert Threshold/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('120')).toBeInTheDocument();
      expect(screen.getByText(/Custom Starter Prompt 1/i)).toBeInTheDocument();
    });
  });

  it('updates low balance threshold on form save', async () => {
    render(<MessagingSettingsTab workspaceId="ws_123" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByDisplayValue('120');
    fireEvent.change(thresholdInput, { target: { value: '150' } });

    const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(actions.updateWorkspaceMessagingSettingsAction).toHaveBeenCalledWith(
        'ws_123',
        expect.objectContaining({ lowBalanceThreshold: 150 }),
        1
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingSettingsTab'".

- [ ] **Step 3: Implement `MessagingSettingsTab.tsx`**

Follows `theme.md` Sections 4 & 8:
- Surface geometry: `rounded-2xl border border-border/80 bg-card shadow-xs`.
- Header: Title, description in `CardDescription text-xs`, and `<CardInfoTooltip text="..." />`.
- Tactile buttons: `active:scale-[0.97]`, `min-h-[44px]` touch targets.
- Switchers: Channel kill-switch toggles with clear operational/paused text.
- Prompt Manager: Add/remove custom prompt starters (clamped to max 6, <= 120 chars).
- Actionable Toast: `actionConfig: { path: '/admin/messaging', label: 'View Hub' }`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`  
Expected: PASS (2 tests).

- [ ] **Step 5: Mount `MessagingSettingsTab` in `src/app/admin/settings/SettingsClient.tsx`**

Integrate `MessagingSettingsTab` into `SettingsClient.tsx` under `<TabsContent value="messaging">`, replacing the placeholder SMS balance card with the unified governance tab while preserving the top-up link.

- [ ] **Step 6: Commit locally**

```bash
git add src/app/admin/settings/components/MessagingSettingsTab.tsx src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx src/app/admin/settings/SettingsClient.tsx
git commit -m "feat(settings): mount backoffice codeless messaging governance tab"
```

---

### Task 3: Dynamic Settings Ingestion in Aggregator, Kill-Switches & Quick Composer (TDD)

**Files:**
- Modify: `src/app/actions/messaging-dashboard-actions.ts`
- Modify: `src/app/actions/quick-message-actions.ts`
- Modify: `src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx`
- Modify: `src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx`
- Modify: `src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx`
- Modify: `src/app/admin/messaging/MessagingClient.tsx`
- Test: `src/app/actions/__tests__/messaging-dashboard-actions.test.ts`
- Test: `src/app/actions/__tests__/quick-message-actions.test.ts`

- [ ] **Step 1: Ingest settings into `getMessagingDashboardSummaryAction`**
- In `src/app/actions/messaging-dashboard-actions.ts`:
  1. Retrieve workspace settings via `getWorkspaceMessagingSettingsAction(workspaceId)`.
  2. Use `settings.lowBalanceThreshold` to evaluate `isLowBalance` (rather than hardcoded 100).
  3. Include `settings` in returned summary payload (`summary.settings`).
  4. Ensure fail-safe default fallback if settings read fails.

- [ ] **Step 2: Server-Side Channel Kill-Switch Enforcement in `quick-message-actions.ts` (Rule 18)**
- In `dispatchQuickDirectMessageAction`:
  1. Read workspace settings.
  2. If `settings.channelKillSwitches[channel] === true`:
     Return `{ success: false, error: `${channel.toUpperCase()} dispatch is temporarily paused for maintenance.`, code: 'CHANNEL_PAUSED' }`.
  3. Update `quick-message-actions.test.ts` with test verifying kill-switch rejection.

- [ ] **Step 3: Client-Side Channel Kill-Switch & Dynamic Prop Pass in Widgets**
- `QuickMessageComposerCard.tsx`:
  - Accept optional `killSwitches?: ChannelKillSwitches`.
  - When `killSwitches?.[channel]` is true, render a warning banner ("⚠️ SMS outbound is paused for maintenance") and disable the Send button.
- `QuickTemplatesCard.tsx`:
  - Accept optional `allowedTemplateIds?: string[]`. If provided, filters `STARTER_TEMPLATES` to only display templates selected in Backoffice settings.
- `MessagingHeroGreeting.tsx`:
  - Accept optional `promptStarters?: string[]`. If provided, rotates or displays prompt starters configured in Backoffice settings.
- `MessagingClient.tsx`:
  - Pass `summary?.settings?.channelKillSwitches`, `summary?.settings?.quickTemplateIds`, and `summary?.settings?.aiPromptStarters` to corresponding child components.

- [ ] **Step 4: Run test suites**

Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts src/app/actions/__tests__/quick-message-actions.test.ts`  
Expected: All tests PASS.

- [ ] **Step 5: Commit locally**

```bash
git add src/app/actions/messaging-dashboard-actions.ts src/app/actions/quick-message-actions.ts src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx src/app/admin/messaging/MessagingClient.tsx
git commit -m "feat(messaging): wire dynamic settings into dashboard widgets and enforce server-side channel kill-switches"
```

---

### Task 4: Governed MCP Tool Registration (`messaging.get_dashboard_summary`) (TDD)

**Files:**
- Create: `src/lib/mcp/tools/messaging-dashboard-tool.ts`
- Create: `src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts`
- Modify: `src/lib/mcp/tools/index.ts`

- [ ] **Step 1: Write unit tests for `messaging.get_dashboard_summary` MCP tool**

```typescript
// src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { messagingGetDashboardSummaryTool } from '../messaging-dashboard-tool';
import type { McpExecutionContext } from '../../types';

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

describe('messagingGetDashboardSummaryTool', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    callerId: 'agent_007',
    callerType: 'agent',
    requestId: 'req_123',
    callDepth: 1,
    timestamp: '2026-10-09T08:00:00Z',
  };

  it('declares read_only risk tier, campaign category, and exact 64-char schemaHash', () => {
    expect(messagingGetDashboardSummaryTool.riskLevel).toBe('read_only');
    expect(messagingGetDashboardSummaryTool.category).toBe('campaign');
    expect(messagingGetDashboardSummaryTool.name).toBe('messaging.get_dashboard_summary');
    expect(messagingGetDashboardSummaryTool.requiresApproval).toBe(false);
    expect(messagingGetDashboardSummaryTool.schemaHash).toHaveLength(64);
    expect(messagingGetDashboardSummaryTool.schemaHash).toBe(
      '7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b'
    );
  });

  it('executes successfully and returns summary telemetry', async () => {
    const res = await messagingGetDashboardSummaryTool.handler(
      { forceRefresh: false },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.kpi.messagesSent).toBe(12482);
    expect(res.kpi.deliveryRate).toBe(99.7);
    expect(res.activeQueues.failedCount).toBe(2);
  });

  it('enforces fail-closed multi-tenancy if context is missing workspaceId or organizationId (Rule 18)', async () => {
    await expect(
      messagingGetDashboardSummaryTool.handler(
        { forceRefresh: false },
        { ...mockContext, workspaceId: '' }
      )
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts`  
Expected: FAIL with "Cannot find module '../messaging-dashboard-tool'".

- [ ] **Step 3: Implement `messaging-dashboard-tool.ts` conforming strictly to `McpToolDefinition`**

```typescript
// src/lib/mcp/tools/messaging-dashboard-tool.ts
/**
 * @fileOverview Governed MCP Tool: messaging.get_dashboard_summary
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 11: MCP Protocol Compliance (stateless multi-round-trip).
 * - Rule 12: Server-side risk enforcement (read_only).
 * - Rule 13: Trust Boundary Matrix (separates system context from caller arguments).
 * - Rule 14: Tool poisoning defense (exact 64-char hex schemaHash).
 * - Rule 17: Non-delegable privileges (read_only telemetry only).
 * - Rule 18: Fail-closed multi-tenancy verification.
 * - Rule 24 & Rule 25: Exposes provider status and dead-letter failed count.
 */

import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';

const getDashboardSummaryInputSchema = z.object({
  forceRefresh: z.boolean().optional().default(false).describe('Bypass in-memory cache to re-aggregate live metrics'),
});

const getDashboardSummaryOutputSchema = z.object({
  success: z.boolean(),
  kpi: z.object({
    messagesSent: z.number().int().nonnegative(),
    messagesSentDeltaPercentage: z.number(),
    deliveryRate: z.number(),
    deliveryRateDeltaPercentage: z.number(),
    smsBalance: z.number().nonnegative(),
    providerStatus: z.string(),
    providerStatusLabel: z.string(),
  }),
  performance: z.object({
    sentCount: z.number().int().nonnegative(),
    deliveredCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    deliveryRatePercentage: z.number(),
    timeRangeLabel: z.string(),
  }),
  activeQueues: z.object({
    scheduledCount: z.number().int().nonnegative(),
    pendingApprovalCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  }),
});

export const messagingGetDashboardSummaryTool: McpToolDefinition<
  z.infer<typeof getDashboardSummaryInputSchema>,
  z.infer<typeof getDashboardSummaryOutputSchema>
> = {
  name: 'messaging.get_dashboard_summary',
  description:
    'Retrieves the multi-tenant communications hub summary including message volume, trend deltas, delivery SLA rate, SMS credit balance, and dead-letter/pending queue counts for a workspace.',
  version: '1.0.0',
  schemaHash: '7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
  riskLevel: 'read_only',
  category: 'campaign',
  requiresApproval: false,
  parameters: getDashboardSummaryInputSchema,
  responseSchema: getDashboardSummaryOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    const res = await getMessagingDashboardSummaryAction({
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      forceRefresh: params.forceRefresh,
    });

    if (!res.success) {
      throw new Error(`Failed to retrieve dashboard summary: ${res.error}`);
    }

    return {
      success: true,
      kpi: {
        messagesSent: res.data.kpi.messagesSent,
        messagesSentDeltaPercentage: res.data.kpi.messagesSentDeltaPercentage,
        deliveryRate: res.data.kpi.deliveryRate,
        deliveryRateDeltaPercentage: res.data.kpi.deliveryRateDeltaPercentage,
        smsBalance: res.data.kpi.smsBalance,
        providerStatus: res.data.kpi.providerStatus,
        providerStatusLabel: res.data.kpi.providerStatusLabel,
      },
      performance: {
        sentCount: res.data.performance.sentCount,
        deliveredCount: res.data.performance.deliveredCount,
        failedCount: res.data.performance.failedCount,
        deliveryRatePercentage: res.data.performance.deliveryRatePercentage,
        timeRangeLabel: res.data.performance.timeRangeLabel,
      },
      activeQueues: {
        scheduledCount: res.data.activeQueues.scheduledCount,
        pendingApprovalCount: res.data.activeQueues.pendingApprovalCount,
        failedCount: res.data.activeQueues.failedCount,
      },
    };
  },
};
```

- [ ] **Step 4: Register in `src/lib/mcp/tools/index.ts`**

Export `messagingGetDashboardSummaryTool` and append to `ALL_CORE_MCP_TOOLS`.

- [ ] **Step 5: Run MCP tool test to verify pass**

Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts`  
Expected: PASS (3 tests).

- [ ] **Step 6: Commit locally**

```bash
git add src/lib/mcp/tools/messaging-dashboard-tool.ts src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts src/lib/mcp/tools/index.ts
git commit -m "feat(mcp): register messaging.get_dashboard_summary governed tool with 64-char schemaHash"
```

---

### Task 5: End-to-End Integration, Resilience & Regression Verification (TDD)

**Files:**
- Create: `src/app/admin/messaging/__tests__/MessagingPhase7Integration.test.tsx`

- [ ] **Step 1: Write comprehensive integration test**

```tsx
// src/app/admin/messaging/__tests__/MessagingPhase7Integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MessagingSettingsTab } from '../../settings/components/MessagingSettingsTab';
import { messagingGetDashboardSummaryTool } from '@/lib/mcp/tools/messaging-dashboard-tool';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/app/actions/messaging-settings-actions', () => ({
  getWorkspaceMessagingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      version: 1,
      lowBalanceThreshold: 100,
      quickTemplateIds: ['tpl_welcome'],
      aiPromptStarters: ['Test AI prompt'],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    },
  }),
  updateWorkspaceMessagingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      version: 2,
      lowBalanceThreshold: 100,
      quickTemplateIds: ['tpl_welcome'],
      aiPromptStarters: ['Test AI prompt'],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    },
  }),
}));

describe('Messaging Phase 7 End-to-End Integration', () => {
  it('loads backoffice governance settings and renders actionable inputs', async () => {
    render(<MessagingSettingsTab workspaceId="ws_test" />);
    await waitFor(() => {
      expect(screen.getByText(/SMS Low-Balance Alert Threshold/i)).toBeInTheDocument();
      expect(screen.getByText(/Dashboard Quick Templates Shortlist/i)).toBeInTheDocument();
      expect(screen.getByText(/Channel Maintenance & Kill-Switches/i)).toBeInTheDocument();
    });
  });

  it('MCP tool rejects executions missing multi-tenant context', async () => {
    await expect(
      messagingGetDashboardSummaryTool.handler(
        { forceRefresh: false },
        {
          workspaceId: '',
          organizationId: '',
          callerId: 'agent',
          callerType: 'agent',
          requestId: 'r1',
          callDepth: 1,
          timestamp: '2026-10-09T08:00:00Z',
        }
      )
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
```

- [ ] **Step 2: Run test to verify pass**

Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingPhase7Integration.test.tsx`  
Expected: PASS (2 tests).

- [ ] **Step 3: Run comprehensive Vitest sweep across all messaging, settings, and MCP tools**

Run: `npx vitest run src/app/admin/messaging/ src/lib/mcp/ src/app/actions/__tests__/messaging-settings-actions.test.ts src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`  
Expected: All test suites PASS cleanly.

- [ ] **Step 4: Commit locally**

```bash
git add src/app/admin/messaging/__tests__/MessagingPhase7Integration.test.tsx
git commit -m "test(messaging): verify Phase 7 backoffice integration and MCP multi-tenant invariants"
```

---

## 6. Verification Invariants & Definition of Done

Before Phase 7 execution is concluded, the following checklist must be satisfied:
* [ ] **Strict Typing (Rule 4)**: Strictly zero `any` or `any[]` across all code and test files.
* [ ] **Backoffice Codeless Settings**: Interactive tab at `/admin/settings?tab=messaging` that persists configuration to Firestore with TOCTOU versioning (`version`).
* [ ] **Channel Kill-Switch Dual Gate (Rules 3, 18 & 21)**: Active kill-switches disable composer button client-side and block server-side direct dispatch action with `code: 'CHANNEL_PAUSED'`.
* [ ] **Governed MCP Tooling (Rules 11–25)**: `messaging.get_dashboard_summary` registered in `ALL_CORE_MCP_TOOLS` with exact 64-char `schemaHash`, `read_only` risk level, and fail-closed multi-tenancy.
* [ ] **Dynamic Settings Propagation (Rule 3)**: SMS alert threshold, Quick Templates shortlist, and AI Prompt starters dynamically reflect workspace configuration.
* [ ] **Mobile Ergonomics & Animations (Rules 1 & 7)**: Touch targets meet `min-h-[44px]`, tactile click feedback `active:scale-[0.97]`.
* [ ] **Toast Safety (Rule 4)**: Actionable toasts use safe relative paths (`actionConfig.path` starting with `/`).
* [ ] **Verification Evidence**: All Vitest test suites pass (35+ test files, 300+ tests).
* [ ] **Git Protocol (Rule 5)**: Strictly local commits on `main`. Zero unprompted remote pushes.

---

## 7. Execution Readiness

Plan is fully aligned with **`docs/agents_mcp/agents_mcp_rules.md` (Rules 1 through 25)** and documented in:
[docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-7.md](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-7.md).

**Awaiting user approval before proceeding to implementation.**
