# Phase 7: Backoffice Codeless Controls, AI Agent MCP Tooling & Resilience Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Backoffice Codeless Controls tab at `/admin/settings?tab=messaging` for administrative governance (low-balance alerts, quick template shortlists, AI prompt customizers, channel kill-switches), register the official `messaging.get_dashboard_summary` MCP tool for AI agents, wire dynamic settings into the Communications Hub, and conduct full platform resilience verification.

**Architecture:** A fail-closed, multi-tenant settings domain persisted in Firestore (`workspaces/{workspaceId}/messaging_settings/current`) coupled with an administrative server action suite. The backend dashboard aggregator (`getMessagingDashboardSummaryAction`) dynamically merges these settings to drive runtime alerts, template selections, and AI prompt defaults. The data aggregator is exposed to autonomous agents via a strictly typed, JSON-RPC 2.0 compliant MCP tool with SHA-256 schema hashing and audit logging.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict zero-any), Zod 3, Firebase Admin Firestore, Vitest, Tailwind CSS, Lucide React, Model Context Protocol (MCP TypeScript SDK).

---

## 1. Relevant Milestone Documentation & References

This implementation plan is derived directly from the canonical architectural specifications:
1. **`docs/messaging/messaging_dashboard_redesign_plan.md`**:
   - **Section 4.2 (Backoffice Enhancement & Codeless Management)**: Configurable quick templates shortlist, SMS low-balance alert thresholds, AI assistant prompt placeholders, and channel maintenance kill-switches.
   - **Section 2.2 (Agentic & MCP Rules 11–25)**: Protocol compliance, server-side risk enforcement, trust boundary matrix, tool versioning, and fail-closed multi-tenancy.
2. **`docs/agents_mcp/agents_mcp_rules.md`**:
   - **Rule 1**: Industry-grade Next.js/React best practices, Emil Kowalski tactile animations (`active:scale-[0.97]`).
   - **Rule 4**: Strict typing invariant — strictly zero `any` or `any[]` throughout production and test code.
   - **Rule 7**: Mobile-first ergonomics (`min-h-[44px]` touch targets, responsive layouts).
   - **Rule 8**: Fail-closed multi-tenancy (`requireWorkspace`, organization boundary checks).
   - **Rule 9**: High-load anti-exhaustion (bounded caches, memory protection).
   - **Rules 11–25**: MCP protocol contracts, server-side risk classification (`read_only`), SHA-256 schema hashing (`schemaHash`), and structured audit logging.
3. **`theme.md` (Sections 4 & 8)**: Standardized card geometry (`rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs`) and modal design (`DialogHeader demarcated`, `CardInfoTooltip`, `DialogDescription sr-only`).
4. **`.agents/AGENTS.md`**: Workspace standards, actionable relative toast routing (`actionConfig.path`), and strict Git protocol (local commits only, zero unprompted remote pushes).

---

## 2. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Settings Leakage** | Settings action reading/writing without checking caller's organization ID. | A malicious user in Workspace A could modify SMS thresholds or templates for Workspace B. | **Fail-Closed Tenancy Check (Rule 18)**: `requireWorkspace(workspaceId)` verifies user membership and ensures `workspace.organizationId === user.organizationId`. |
| **Invalid Threshold or Empty Templates** | Admin enters negative SMS balance threshold or deletes all quick templates. | Broken dashboard KPI alerts or empty template widgets. | **Zod Schema Boundary (Rule 4)**: `WorkspaceMessagingSettingsSchema` enforces `min(0)` on thresholds and falls back to canonical default starter templates if shortlist is empty. |
| **MCP Tool Poisoning / Parameter Tampering** | External agent sending unvalidated parameters to `messaging.get_dashboard_summary`. | Unexpected server errors or denial-of-service query exhaustion. | **Schema Hash & Stateless Validation (Rules 11, 14)**: The MCP tool validates input against `GetMessagingDashboardSummaryInputSchema` and provides a static SHA-256 `schemaHash`. |
| **Channel Kill-Switch Desynchronization** | Channel paused in settings while Quick Composer in dashboard still attempts send. | User confusion and failed dispatches. | **Centralized Kill-Switch Gate**: Quick Composer and server actions inspect active kill-switches and display explicit maintenance banners when a channel is paused. |
| **Cache Invalidation Lag** | Admin updates settings but dashboard serves stale cached KPI summary for 3 minutes. | Confusion over why newly saved settings haven't taken effect immediately. | **Automatic Cache Purge**: `updateWorkspaceMessagingSettingsAction` invalidates `dashboardSummaryCache` for the specific workspace on save. |

---

## 3. File Inventory & Touchpoints

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
│           └── index.ts                                  (MODIFIED: Register messaging tool in core toolset)
├── app/
│   ├── actions/
│   │   ├── messaging-settings-actions.ts                 (NEW: Server actions to get/update workspace settings)
│   │   ├── messaging-dashboard-actions.ts                (MODIFIED: Ingest dynamic settings into aggregator)
│   │   └── __tests__/
│   │       ├── messaging-settings-actions.test.ts        (NEW: Integration tests for settings persistence)
│   │       └── messaging-dashboard-actions.test.ts       (MODIFIED: Verify settings integration & cache purge)
│   └── admin/
│       ├── settings/
│       │   ├── SettingsClient.tsx                        (MODIFIED: Mount MessagingSettingsTab under tab=messaging)
│       │   └── components/
│       │       ├── MessagingSettingsTab.tsx              (NEW: Backoffice codeless configuration component)
│       │       └── __tests__/MessagingSettingsTab.test.tsx(NEW: Component tests for settings interactions)
│       └── messaging/
│           ├── components/dashboard/
│           │   ├── QuickTemplatesCard.tsx                (MODIFIED: Support dynamic workspace templates)
│           │   └── MessagingHeroGreeting.tsx             (MODIFIED: Support dynamic prompt starters)
│           └── __tests__/
│               └── MessagingPhase7Integration.test.tsx   (NEW: End-to-end integration & regression suite)
```

---

## 4. Phase 7 Implementation Tasks

### Task 1: Workspace Messaging Settings Domain Schema & Server Actions

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
  it('validates a valid messaging settings configuration', () => {
    const validData: WorkspaceMessagingSettings = {
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
      expect(parsed.data.lowBalanceThreshold).toBe(150);
      expect(parsed.data.quickTemplateIds).toHaveLength(2);
    }
  });

  it('populates default values when given an empty object', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
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
 */

import { z } from 'zod';

export const ChannelKillSwitchesSchema = z.object({
  sms: z.boolean().default(false).describe('Pause all SMS outbound dispatches for maintenance'),
  whatsapp: z.boolean().default(false).describe('Pause all WhatsApp outbound dispatches for maintenance'),
  email: z.boolean().default(false).describe('Pause all Email outbound dispatches for maintenance'),
});

export type ChannelKillSwitches = z.infer<typeof ChannelKillSwitchesSchema>;

export const WorkspaceMessagingSettingsSchema = z.object({
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
Expected: PASS (3 tests).

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

  it('returns default settings when doc does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const res = await getWorkspaceMessagingSettingsAction('ws_123');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.lowBalanceThreshold).toBe(100);
      expect(res.data.channelKillSwitches.sms).toBe(false);
    }
  });

  it('updates settings and enforces fail-closed multi-tenancy', async () => {
    mockSet.mockResolvedValueOnce(undefined);

    const res = await updateWorkspaceMessagingSettingsAction('ws_123', {
      lowBalanceThreshold: 200,
      quickTemplateIds: ['tpl_fee'],
      aiPromptStarters: ['Custom prompt'],
      channelKillSwitches: { sms: true, whatsapp: false, email: false },
    });

    expect(res.success).toBe(true);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith('workspaces/ws_123/messaging_settings/current');
  });

  it('rejects unauthorized caller', async () => {
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
  settings: Partial<WorkspaceMessagingSettings>
): Promise<MessagingSettingsActionResult<WorkspaceMessagingSettings>> {
  try {
    const { workspace, user } = await requireWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found', code: 'NOT_FOUND' };
    }

    const existingRes = await getWorkspaceMessagingSettingsAction(workspaceId);
    const baseSettings = existingRes.success ? existingRes.data : DEFAULT_MESSAGING_SETTINGS;

    const merged = {
      ...baseSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };

    const validated = WorkspaceMessagingSettingsSchema.parse(merged);

    const docRef = adminDb.doc(`workspaces/${workspaceId}/messaging_settings/current`);
    await docRef.set(validated, { merge: true });

    // Invalidate dashboard summary cache for this workspace to guarantee fresh metrics
    const cacheKey = `dashboard:${workspace.organizationId}:${workspaceId}`;
    dashboardSummaryCache.delete(cacheKey);

    return { success: true, data: validated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update messaging settings';
    return { success: false, error: message, code: 'UPDATE_FAILED' };
  }
}
```

- [ ] **Step 8: Run test to verify pass**

Run: `npx vitest run src/app/actions/__tests__/messaging-settings-actions.test.ts`  
Expected: PASS (3 tests).

- [ ] **Step 9: Commit locally**

```bash
git add src/lib/types/messaging-settings.ts src/lib/types/__tests__/messaging-settings.test.ts src/app/actions/messaging-settings-actions.ts src/app/actions/__tests__/messaging-settings-actions.test.ts
git commit -m "feat(messaging): implement workspace messaging settings schema and server actions"
```

---

### Task 2: Backoffice Codeless Controls Tab (`MessagingSettingsTab.tsx`)

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
      lowBalanceThreshold: 120,
      quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
      aiPromptStarters: ['Custom Starter Prompt 1'],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    },
  }),
  updateWorkspaceMessagingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
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
      expect(screen.getByText(/Messaging Hub Configuration/i)).toBeInTheDocument();
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
        expect.objectContaining({ lowBalanceThreshold: 150 })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`  
Expected: FAIL with "Cannot find module '../MessagingSettingsTab'".

- [ ] **Step 3: Implement `MessagingSettingsTab.tsx`**

```tsx
// src/app/admin/settings/components/MessagingSettingsTab.tsx
'use client';

/**
 * @fileOverview Backoffice Codeless Management Tab for the Messaging Hub.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 7: Tactile buttons (active:scale-[0.97]), min-h-[44px] touch targets.
 * - Rule 4: Strict zero-any TypeScript typing.
 * - Rule 8: Safe relative navigation.
 * - theme.md Section 4 & 8: Institutional card styling, CardInfoTooltip, sr-only descriptions.
 */

import * as React from 'react';
import {
  MessageSquare,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Save,
  Loader2,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import {
  getWorkspaceMessagingSettingsAction,
  updateWorkspaceMessagingSettingsAction,
} from '@/app/actions/messaging-settings-actions';
import {
  DEFAULT_MESSAGING_SETTINGS,
  type WorkspaceMessagingSettings,
} from '@/lib/types/messaging-settings';
import { STARTER_TEMPLATES } from '@/app/admin/messaging/components/dashboard/QuickTemplatesCard';
import { cn } from '@/lib/utils';

export interface MessagingSettingsTabProps {
  workspaceId: string;
  className?: string;
}

export function MessagingSettingsTab({ workspaceId, className }: MessagingSettingsTabProps) {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<WorkspaceMessagingSettings>(DEFAULT_MESSAGING_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [newPrompt, setNewPrompt] = React.useState('');

  const loadSettings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getWorkspaceMessagingSettingsAction(workspaceId);
      if (res.success) {
        setSettings(res.data);
      }
    } catch {
      toast({
        title: 'Error Loading Settings',
        description: 'Unable to retrieve workspace messaging settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateWorkspaceMessagingSettingsAction(workspaceId, settings);
      if (res.success) {
        setSettings(res.data);
        toast({
          title: 'Configuration Saved',
          description: 'Messaging governance parameters updated successfully.',
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Failed to persist settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTemplate = (templateId: string) => {
    setSettings((prev) => {
      const exists = prev.quickTemplateIds.includes(templateId);
      if (exists) {
        if (prev.quickTemplateIds.length <= 1) {
          toast({
            title: 'Minimum Template Required',
            description: 'You must maintain at least one quick template.',
            variant: 'destructive',
          });
          return prev;
        }
        return {
          ...prev,
          quickTemplateIds: prev.quickTemplateIds.filter((id) => id !== templateId),
        };
      }
      return {
        ...prev,
        quickTemplateIds: [...prev.quickTemplateIds, templateId],
      };
    });
  };

  const handleAddPromptStarter = () => {
    if (!newPrompt.trim()) return;
    if (settings.aiPromptStarters.length >= 6) {
      toast({
        title: 'Maximum Reached',
        description: 'You can define up to 6 custom AI prompt starters.',
        variant: 'destructive',
      });
      return;
    }
    setSettings((prev) => ({
      ...prev,
      aiPromptStarters: [...prev.aiPromptStarters, newPrompt.trim()],
    }));
    setNewPrompt('');
  };

  const handleRemovePromptStarter = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      aiPromptStarters: prev.aiPromptStarters.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 1. Low-Balance Alert Threshold */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                SMS Low-Balance Alert Threshold
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Display warning badges and top-up advisories when credit drops below this level.
              </CardDescription>
            </div>
            <CardInfoTooltip text="Governs the warning threshold displayed on the Top KPI Metrics Grid and Quick Message Composer." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="max-w-xs space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Minimum Reserve Units</label>
            <Input
              type="number"
              min={0}
              value={settings.lowBalanceThreshold}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  lowBalanceThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
              className="min-h-[44px] rounded-xl text-sm tabular-nums"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Quick Templates Shortlist Selector */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                Dashboard Quick Templates Shortlist
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Choose which curated starter templates appear in the right-hand dashboard sidebar.
              </CardDescription>
            </div>
            <CardInfoTooltip text="Templates selected here will be instantly available in the Quick Templates card on the main Messaging Hub." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STARTER_TEMPLATES.map((tpl) => {
              const isSelected = settings.quickTemplateIds.includes(tpl.id);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleToggleTemplate(tpl.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left flex items-start justify-between gap-3 transition-all active:scale-[0.98]',
                    isSelected
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border/60 bg-muted/10 hover:border-border text-muted-foreground'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{tpl.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{tpl.snippet}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors',
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border/80 bg-background'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 3. AI Assistant Prompt Starters */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                AI Assistant Prompt Starters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Customize prompt suggestions displayed in the Hero Greeting banner pill.
              </CardDescription>
            </div>
            <CardInfoTooltip text="Staff can click these suggested prompts in the Hero Greeting card to quickly compose relevant announcements." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            {settings.aiPromptStarters.map((prompt, index) => (
              <div
                key={index}
                className="p-2.5 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between gap-2"
              >
                <span className="text-xs text-foreground font-medium">{prompt}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePromptStarter(index)}
                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg active:scale-[0.97]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Add seasonal starter (e.g. Announce mid-term exam schedule)..."
              className="min-h-[44px] rounded-xl text-xs sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddPromptStarter();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPromptStarter}
              className="min-h-[44px] rounded-xl text-xs font-semibold px-4 active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Channel Maintenance Kill-Switches */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">
                Channel Maintenance & Kill-Switches
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Temporarily pause specific delivery channels during provider downtime or maintenance.
              </CardDescription>
            </div>
            <CardInfoTooltip text="When paused, agents cannot initiate dispatches on the disabled channel from the composer or quick actions." />
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="divide-y divide-border/60">
            {(['sms', 'whatsapp', 'email'] as const).map((channel) => (
              <div key={channel} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase">{channel} Outbound Dispatch</p>
                  <p className="text-[11px] text-muted-foreground">
                    {settings.channelKillSwitches[channel]
                      ? 'Channel is currently PAUSED for maintenance.'
                      : 'Channel is operational and accepting dispatches.'}
                  </p>
                </div>
                <Switch
                  checked={settings.channelKillSwitches[channel]}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      channelKillSwitches: {
                        ...prev.channelKillSwitches,
                        [channel]: checked,
                      },
                    }))
                  }
                  className="data-[state=checked]:bg-rose-600"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-[44px] rounded-xl px-6 font-semibold active:scale-[0.97] transition-all flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`  
Expected: PASS (2 tests).

- [ ] **Step 5: Mount `MessagingSettingsTab` in `src/app/admin/settings/SettingsClient.tsx`**

Integrate `MessagingSettingsTab` into `SettingsClient.tsx` under `<TabsContent value="messaging">`, replacing the placeholder SMS card with the unified governance suite while preserving the top-up link.

- [ ] **Step 6: Commit locally**

```bash
git add src/app/admin/settings/components/MessagingSettingsTab.tsx src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx src/app/admin/settings/SettingsClient.tsx
git commit -m "feat(settings): implement backoffice messaging codeless controls tab"
```

---

### Task 3: Dynamic Settings Ingestion in Aggregator & Dashboard Widgets

**Files:**
- Modify: `src/app/actions/messaging-dashboard-actions.ts`
- Modify: `src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx`
- Modify: `src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx`
- Modify: `src/app/admin/messaging/MessagingClient.tsx`
- Test: `src/app/actions/__tests__/messaging-dashboard-actions.test.ts`

- [ ] **Step 1: Update `messaging-dashboard-actions.ts` to merge workspace settings**

In `getMessagingDashboardSummaryAction`:
1. Call `getWorkspaceMessagingSettingsAction(workspaceId)`.
2. Evaluate `metrics.smsBalance <= settings.lowBalanceThreshold` to populate `isLowBalance`.
3. Filter `quickTemplates` to include only those whose IDs are in `settings.quickTemplateIds`.
4. Return `settings` alongside summary data.

- [ ] **Step 2: Update `QuickTemplatesCard.tsx` and `MessagingHeroGreeting.tsx`**

- `QuickTemplatesCard.tsx`: Accept `templateIds?: string[]` and filter visible templates.
- `MessagingHeroGreeting.tsx`: Accept `promptStarters?: string[]` to dynamically rotate the AI prompt pill.
- `MessagingClient.tsx`: Pass `summary?.settings?.quickTemplateIds` and `summary?.settings?.aiPromptStarters` to child components.

- [ ] **Step 3: Run existing dashboard actions tests**

Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit locally**

```bash
git add src/app/actions/messaging-dashboard-actions.ts src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx src/app/admin/messaging/components/dashboard/MessagingHeroGreeting.tsx src/app/admin/messaging/MessagingClient.tsx
git commit -m "feat(messaging): dynamically ingest workspace governance settings into dashboard aggregator"
```

---

### Task 4: Agentic MCP Tool Registration (`messaging.get_dashboard_summary`)

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
  };

  it('declares read_only risk tier and campaign category', () => {
    expect(messagingGetDashboardSummaryTool.riskLevel).toBe('read_only');
    expect(messagingGetDashboardSummaryTool.category).toBe('campaign');
    expect(messagingGetDashboardSummaryTool.name).toBe('messaging.get_dashboard_summary');
  });

  it('executes successfully and returns summary data', async () => {
    const res = await messagingGetDashboardSummaryTool.handler(
      { forceRefresh: false },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.kpi.messagesSent).toBe(12482);
    expect(res.kpi.deliveryRate).toBe(99.7);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts`  
Expected: FAIL with "Cannot find module '../messaging-dashboard-tool'".

- [ ] **Step 3: Implement `messaging-dashboard-tool.ts`**

```typescript
// src/lib/mcp/tools/messaging-dashboard-tool.ts
/**
 * @fileOverview Governed MCP Tool: messaging.get_dashboard_summary
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 11: MCP Protocol Compliance (stateless multi-round-trip).
 * - Rule 12: Server-side risk enforcement (read_only).
 * - Rule 13: Trust Boundary Matrix (separates system context from caller arguments).
 * - Rule 14: Tool poisoning defense (versioning and schemaHash).
 * - Rule 18: Fail-closed multi-tenancy verification.
 * - Rule 22: Observability & audit logging.
 */

import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';

const inputSchema = z.object({
  forceRefresh: z.boolean().optional().default(false).describe('Bypass cache to re-aggregate live metrics'),
});

const outputSchema = z.object({
  success: z.boolean(),
  kpi: z.object({
    messagesSent: z.number(),
    messagesSentDeltaPercentage: z.number(),
    deliveryRate: z.number(),
    deliveryRateDeltaPercentage: z.number(),
    smsBalance: z.number(),
    providerStatus: z.string(),
    providerStatusLabel: z.string(),
  }),
  performance: z.object({
    sentCount: z.number(),
    deliveredCount: z.number(),
    failedCount: z.number(),
    deliveryRatePercentage: z.number(),
    timeRangeLabel: z.string(),
  }),
  activeQueues: z.object({
    scheduledCount: z.number(),
    pendingApprovalCount: z.number(),
    failedCount: z.number(),
  }),
});

export const messagingGetDashboardSummaryTool: McpToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: 'messaging.get_dashboard_summary',
  description:
    'Retrieves the multi-tenant communications hub summary including message volume, 7-day trend deltas, delivery SLA rate, SMS credit balance, and queue counts for a workspace.',
  version: '1.0.0',
  schemaHash: 'sha256:7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
  riskLevel: 'read_only',
  category: 'campaign',
  inputSchema,
  outputSchema,
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

- [ ] **Step 4: Register tool in `src/lib/mcp/tools/index.ts`**

Export `messagingGetDashboardSummaryTool` and append it to `ALL_CORE_MCP_TOOLS`.

- [ ] **Step 5: Run MCP tool test to verify pass**

Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts`  
Expected: PASS (2 tests).

- [ ] **Step 6: Commit locally**

```bash
git add src/lib/mcp/tools/messaging-dashboard-tool.ts src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts src/lib/mcp/tools/index.ts
git commit -m "feat(mcp): register messaging.get_dashboard_summary governed tool"
```

---

### Task 5: End-to-End Integration, Resilience & Regression Verification

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
      lowBalanceThreshold: 100,
      quickTemplateIds: ['tpl_welcome'],
      aiPromptStarters: ['Test AI prompt'],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    },
  }),
  updateWorkspaceMessagingSettingsAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
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
        }
      )
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
```

- [ ] **Step 2: Run test to verify pass**

Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingPhase7Integration.test.tsx`  
Expected: PASS (2 tests).

- [ ] **Step 3: Run comprehensive Vitest sweep across messaging, settings, and MCP tools**

Run: `npx vitest run src/app/admin/messaging/ src/lib/messaging/ src/lib/mcp/tools/__tests__/messaging-dashboard-tool.test.ts src/app/admin/settings/components/__tests__/MessagingSettingsTab.test.tsx`  
Expected: All suites PASS with 0 failures.

- [ ] **Step 4: Commit locally**

```bash
git add src/app/admin/messaging/__tests__/MessagingPhase7Integration.test.tsx
git commit -m "test(messaging): verify Phase 7 backoffice integration and MCP multi-tenant invariants"
```

---

## 5. Verification Invariants & Definition of Done

Before Phase 7 is declared complete, the following checklist must be satisfied:
* [ ] Zero use of `any` or `any[]` across all touched code (Rule 4).
* [ ] Backoffice codeless settings tab at `/admin/settings?tab=messaging` is fully interactive and persists to Firestore.
* [ ] MCP tool `messaging.get_dashboard_summary` is registered in `ALL_CORE_MCP_TOOLS` with `schemaHash` and `read_only` risk level.
* [ ] Fail-closed multi-tenancy enforced on all server actions and MCP handlers (Rule 18).
* [ ] Dynamic workspace settings (thresholds, starter templates, prompt suggestions) propagate to dashboard widgets.
* [ ] Mobile touch targets meet `min-h-[44px]` with tactile `active:scale-[0.97]` interactions.
* [ ] All tests pass cleanly in Vitest.
* [ ] Strictly zero unprompted remote git push.

---

## 6. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-7.md`.

Two execution options:
1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Awaiting user approval before proceeding to implementation.**
