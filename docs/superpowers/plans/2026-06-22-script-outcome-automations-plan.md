# Script-Owned Outcome Automations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Local verification only:** Do **not** run `pnpm build`, `tsc`, `eslint`, or `git commit` from the agent. Each task ends with the exact commands for the **human** to run locally (typecheck → test → lint → commit) to conserve AI credits. The agent stages code and writes tests; the human runs and commits.

**Goal:** Move post-call outcome configuration and automations out of the campaign and onto each script **outcome node**, so the call centre derives outcomes (and runs their automations) from the script — exactly as it already derives objections and actions — and the campaign wizard's "Configure Outcomes" + "Outcome Automations" steps are removed.

**Architecture:** Each `outcome` node gains `outcomeConfig.automations: CallOutcomeAutomation[]`, edited with a reusable, fully-typed `ActionConfigFields` component (extracted from today's `ActionNodeConfigPanel`). The execution engine sources an outcome's automations from the campaign's `scriptSnapshot` graph, falling back to the legacy `campaign.automationRules` only when the script defines none (no data migration). The workspace and analytics read outcomes from the script graph with the same legacy fallback.

**Tech Stack:** Next.js (App Router, RSC + `'use client'`), React 18, TypeScript (strict — **no `any`/`any[]`**), Firebase Admin (server) + client Firestore hooks, `framer-motion` v12 (repo convention — 63 files) for animation, Tailwind + `tailwindcss-animate`, Vitest.

---

## Skill Conformance (apply throughout)

**`vercel-react-best-practices`**
- `bundle-dynamic-imports`: keep `MessagingTemplateSelector` lazy (already is); lazy-load `OutcomeAutomationsEditor` inside the script builder's right panel so the heavy editor isn't in the canvas's critical bundle.
- `js-set-map-lookups`: reuse the existing `CALL_ACTION_META` `Map`; build `Map`/`Set` for stage→pipeline grouping and dedupe (`extractOutcomesFromGraph` uses a `Set`).
- `rerender-memo` / `rerender-no-inline-components`: each automation row is a top-level `React.memo` component (`AutomationRow`), never defined inside the parent's render.
- `rerender-derived-state-no-effect`: derive outcome lists and grouped stages with `useMemo` during render — never via `useEffect`+`setState`.
- `rerender-functional-setstate`: list add/remove/reorder use functional `setState` so callbacks stay stable.
- `async-parallel`: in the engine, fetch independent docs (entity, template, org) with `Promise.all` where one doesn't depend on another.

**`next-best-practices`**
- `server-after-nonblocking`: keep `after()` for post-call automations (already in `submitOutcome`); preserve the non-`after` test fallback.
- `route-handlers` / `directives`: no new routes; editors are `'use client'`; engine stays in the server-only service. Don't pass non-serializable props across the RSC boundary.

**`emilkowal-animations`** (list + panel motion)
- `ease-out-default` + `timing-300ms-max`: row enter/exit and panel reveals use ease-out, ≤ 250ms.
- `props-transform-opacity`: animate only `transform`/`opacity` (height/translate), never `width`/`top`.
- `polish-stagger-children`: stagger automation-row entrance (~30–40ms) via `AnimatePresence`.
- `polish-reduced-motion` / `polish-framer-hook`: gate all motion behind `useReducedMotion()`; fall back to opacity-only.
- `tw-press-scale`: add/remove/reorder buttons use `active:scale-[0.97]`.

**`frontend-design`**
- Match the existing builder's compact dark inspector aesthetic (`text-[8px] uppercase` labels, `rounded-lg` controls, `colorClass` action badges). Do not introduce a new visual language; refine the existing one. Each automation row shows the action's `meta.icon` + `meta.colorClass` badge for instant scannability.

**`code-refactoring` + type safety**
- Behaviour-preserving extraction first (Phase 1), feature changes after.
- **No `any`/`any[]`.** Introduce one unified `CallActionParams` type and thread it everywhere the engine currently uses `Record<string, any>`. Replace `as any` casts with typed narrowing or `unknown` + guards.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/types.ts` | Domain types | Add `CallActionParams`; `ADD_TO_PIPELINE`; `outcomeConfig.automations`; retype `actionConfig`, `AutomationRuleParams`, `CallOutcomeAutomation`. |
| `src/lib/call-action-types.ts` | Action UI metadata | Add `ADD_TO_PIPELINE` meta + typed `defaultParams`. |
| `src/lib/call-centre-graph.ts` | Graph helpers (pure) | Add `extractOutcomesFromGraph`, `getOutcomeAutomations`, `sanitizeImportedAutomations`. |
| `src/app/.../scripts/components/ActionConfigFields.tsx` | **New** — presentational per-action fields, typed | Extracted from `ActionNodeConfigPanel`. |
| `src/app/.../scripts/components/ActionNodeConfigPanel.tsx` | Single `action` node config | Delegate to `ActionConfigFields` (behaviour preserved). |
| `src/app/.../scripts/components/OutcomeAutomationsEditor.tsx` | **New** — list of automations on an outcome node | Uses `ActionConfigFields` per row + animation. |
| `src/app/.../scripts/new/ScriptBuilderClient.tsx` | Builder shell | Load pipelines/active-meetings/campaigns; render `OutcomeAutomationsEditor`; persist `automations`; sanitize on import. |
| `src/lib/services/call-centre-service.ts` | Execution engine | Source automations from snapshot + fallback; pass `contactId`; add `ADD_TO_PIPELINE`; meeting mode toggle; fix `webhookHeaders` string parse; retype params. |
| `src/lib/call-centre-actions.ts` | Server actions | Sanitise imported `.cflow` automations server-side; retype `actionConfig` (no `any`). |
| `src/app/.../call-centre/CallCentreClient.tsx` | Hub / import UI | Import success note that automations were cleared. |
| `src/app/.../campaigns/new/CampaignWizardClient.tsx` | Campaign wizard | Remove steps 4 & 5; derive outcomes from script; 4-step flow. |
| `src/app/.../campaigns/new/page.tsx` | Wizard route | Clamp `initialStep` to `1..4`. |
| `src/app/.../workspace/[campaignId]/WorkspaceClient.tsx` | Live caller UI | Derive outcome buttons from script graph; legacy fallback. |
| `src/app/.../analytics/[campaignId]/CampaignAnalyticsClient.tsx` | Analytics | Read automations from snapshot graph; legacy fallback. |

---

## Locked Decisions
- **Legacy campaigns:** fallback, **no migration**. Engine/workspace/analytics read script-owned config first, fall back to `campaign.outcomes` / `campaign.automationRules`.
- **Schedule Meeting:** **mode toggle** — `meetingMode: 'guest_list'` (default; add contact to `meetings/{id}/registrants`) or `'create'` (existing behaviour from `MEETING_TYPES`).
- **No `any`/`any[]`** in new or touched code.

---

# Phase 0 — Types & shared params (no behaviour change)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/call-action-types.ts`

- [ ] **Step 0.1 — Add the unified, fully-typed params bag** to `types.ts` (above `AutomationRuleParams`):

```ts
/**
 * Unified, fully-typed parameter bag shared by every call action.
 * Superset across all CallActionTypes — replaces the former `Record<string, any>`
 * used by the engine and the `actionConfig` shape on script nodes.
 */
export interface CallActionParams {
  // Messaging (SEND_SMS / SEND_EMAIL / SEND_WHATSAPP)
  templateId?: string;
  customBody?: string;
  customSubject?: string;
  // Task (CREATE_TASK)
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: 'low' | 'medium' | 'high';
  taskDueDateMode?: 'days' | 'specific';
  taskDueDays?: number;
  taskDueTimeOfDay?: string;
  taskDueSpecificDate?: string;
  taskAssigneeMode?: 'caller' | 'specific' | 'round_robin';
  taskAssigneeId?: string;
  // Pipeline / stage (CHANGE_STAGE, ADD_TO_PIPELINE)
  pipelineId?: string;
  stageId?: string;
  // Tags (ADD_TAG / REMOVE_TAG)
  tagId?: string;
  // Note (LOG_NOTE)
  noteContent?: string;
  // Meeting (SCHEDULE_MEETING)
  meetingMode?: 'guest_list' | 'create';
  meetingId?: string;     // guest_list target
  meetingTypeId?: string; // create mode
  // Transfer to another call campaign (ADD_TO_CALL_CAMPAIGN) + legacy TRANSFER_CALL
  campaignId?: string;
  contactScope?: 'primary' | 'all';
  transferTarget?: string;
  transferMode?: 'phone' | 'agent' | 'campaign';
  // Webhook (WEBHOOK) — headers stored as a JSON string from the UI
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'GET' | 'PUT';
  webhookHeaders?: string;
  // Update Contact (UPDATE_CONTACT)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  updateMode?: 'update' | 'new';
  // Common
  triggerDelaySeconds?: number;
}
```

- [ ] **Step 0.2 — Add `ADD_TO_PIPELINE`** to the `CallActionType` union (after `'CHANGE_STAGE'`):

```ts
  | 'CHANGE_STAGE'
  | 'ADD_TO_PIPELINE'
```

- [ ] **Step 0.3 — Retype the existing shapes** to reuse `CallActionParams` (DRY):
  - `CallOutcomeAutomation.params: CallActionParams;`
  - Replace the whole `AutomationRuleParams` interface body with: `export type AutomationRuleParams = CallActionParams;`
  - Replace `ScriptNode.data.actionConfig?: { … }` with `actionConfig?: CallActionParams;`
  - Extend `outcomeConfig`:

```ts
    outcomeConfig?: {
      suppressDays?: number;
      followUpCampaignId?: string;
      /** Post-call automations that run when a call resolves to this outcome. */
      automations?: CallOutcomeAutomation[];
    };
```

- [ ] **Step 0.4 — Add `ADD_TO_PIPELINE` metadata** in `call-action-types.ts` `CALL_ACTION_META` (after `CHANGE_STAGE`), importing a `Workflow` (or `ListPlus`) icon from `lucide-react`. Make `defaultParams` return a typed `Partial<CallActionParams>` rather than `Record<string, string | number>`:

```ts
  ['ADD_TO_PIPELINE', {
    label: 'Add to Pipeline & Stage',
    icon: Workflow,
    colorClass: 'bg-fuchsia-500',
    badgeLabel: '+ Add to Pipeline',
    defaultParams: () => ({ pipelineId: '', stageId: '' }),
  }],
```

  Update the `CallActionMeta.defaultParams` return type to `Partial<CallActionParams>` and adjust the existing entries (they already return the right keys).

- [ ] **Step 0.5 — Human runs locally:**

```bash
pnpm tsc --noEmit      # expect: pre-existing errors only; no NEW errors from these files
```

- [ ] **Step 0.6 — Commit (human):**

```bash
git add src/lib/types.ts src/lib/call-action-types.ts
git commit -m "feat(call-centre): unify CallActionParams type + add ADD_TO_PIPELINE and outcome automations field"
```

---

# Phase 1 — Pure graph helpers (TDD first)

**Files:**
- Modify: `src/lib/call-centre-graph.ts`
- Test: `src/lib/__tests__/call-centre-graph.test.ts` (extend)

- [ ] **Step 1.1 — Write failing tests** in `call-centre-graph.test.ts`:

```ts
import { extractOutcomesFromGraph, getOutcomeAutomations, sanitizeImportedAutomations } from '../call-centre-graph';
import type { BranchingScriptGraph } from '../types';

const graph: BranchingScriptGraph = {
  nodes: [
    { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start', text: '' } },
    { id: 'o1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: '', text: '', outcomeValue: 'Interested',
        outcomeConfig: { automations: [{ type: 'ADD_TAG', params: { tagId: 't1' } }] } } },
    { id: 'o2', type: 'outcome', position: { x: 0, y: 0 }, data: { label: '', text: '', outcomeValue: 'Interested' } },
    { id: 'o3', type: 'outcome', position: { x: 0, y: 0 }, data: { label: '', text: '', outcomeValue: 'Not Interested' } },
  ],
  edges: [],
};

it('extractOutcomesFromGraph returns distinct outcome values in order', () => {
  expect(extractOutcomesFromGraph(graph)).toEqual(['Interested', 'Not Interested']);
});

it('extractOutcomesFromGraph returns [] for a graph with no outcome nodes', () => {
  expect(extractOutcomesFromGraph({ nodes: [graph.nodes[0]], edges: [] })).toEqual([]);
});

it('getOutcomeAutomations returns the matching node automations', () => {
  expect(getOutcomeAutomations(graph, 'Interested')).toEqual([{ type: 'ADD_TAG', params: { tagId: 't1' } }]);
});

it('getOutcomeAutomations returns null when outcome has no automations (legacy fallback signal)', () => {
  expect(getOutcomeAutomations(graph, 'Not Interested')).toBeNull();
  expect(getOutcomeAutomations(graph, 'Unknown')).toBeNull();
});

it('sanitizeImportedAutomations clears org-scoped ids and webhook urls', () => {
  const dirty: BranchingScriptGraph = { edges: [], nodes: [{ id: 'o', type: 'outcome', position: { x: 0, y: 0 },
    data: { label: '', text: '', outcomeValue: 'X', outcomeConfig: { automations: [
      { type: 'SEND_SMS', params: { templateId: 'foreign' } },
      { type: 'WEBHOOK', params: { webhookUrl: 'http://evil.test', noteContent: 'keep me' } },
    ] } } }] };
  const clean = sanitizeImportedAutomations(dirty);
  const params = clean.nodes[0].data.outcomeConfig!.automations!;
  expect(params[0].params.templateId).toBe('');
  expect(params[1].params.webhookUrl).toBe('');
  expect(params[1].params.noteContent).toBe('keep me'); // free-text survives
});
```

- [ ] **Step 1.2 — Run, expect FAIL:** `pnpm vitest run src/lib/__tests__/call-centre-graph.test.ts` → "not a function".

- [ ] **Step 1.3 — Implement** in `call-centre-graph.ts`:

```ts
import type { BranchingScriptGraph, CallOutcomeAutomation, CallActionParams } from './types';

/** Distinct outcome values declared by `outcome` nodes, in graph order. */
export function extractOutcomesFromGraph(graph: BranchingScriptGraph): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'outcome') continue;
    const value = node.data.outcomeValue?.trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/**
 * Automations configured on the first outcome node matching `outcome`.
 * Returns `null` (not `[]`) when the script defines none, so callers can
 * distinguish "script says run nothing" from "fall back to legacy campaign rules".
 */
export function getOutcomeAutomations(
  graph: BranchingScriptGraph,
  outcome: string,
): CallOutcomeAutomation[] | null {
  const node = graph.nodes.find(n => n.type === 'outcome' && n.data.outcomeValue === outcome);
  const list = node?.data.outcomeConfig?.automations;
  return Array.isArray(list) && list.length > 0 ? list : null;
}

/** Org-scoped reference keys cleared when importing a `.cflow` from another org. */
const ORG_SCOPED_PARAM_KEYS: ReadonlyArray<keyof CallActionParams> = [
  'templateId', 'tagId', 'stageId', 'pipelineId', 'meetingId', 'meetingTypeId',
  'campaignId', 'taskAssigneeId', 'webhookUrl',
];

/** Strip org-scoped ids + webhook URLs from imported outcome automations (re-config required). */
export function sanitizeImportedAutomations(graph: BranchingScriptGraph): BranchingScriptGraph {
  return {
    edges: graph.edges,
    nodes: graph.nodes.map(node => {
      const automations = node.data.outcomeConfig?.automations;
      if (node.type !== 'outcome' || !automations) return node;
      return {
        ...node,
        data: {
          ...node.data,
          outcomeConfig: {
            ...node.data.outcomeConfig,
            automations: automations.map(a => {
              const params: CallActionParams = { ...a.params };
              for (const key of ORG_SCOPED_PARAM_KEYS) {
                if (params[key] !== undefined) (params[key] as string) = '';
              }
              return { type: a.type, params };
            }),
          },
        },
      };
    }),
  };
}
```

- [ ] **Step 1.4 — Run, expect PASS.** **Step 1.5 — Commit (human):**

```bash
git add src/lib/call-centre-graph.ts src/lib/__tests__/call-centre-graph.test.ts
git commit -m "feat(call-centre): graph helpers for outcome extraction, automation lookup, import sanitisation"
```

---

# Phase 2 — Engine: source automations from the script (TDD)

**Files:**
- Modify: `src/lib/services/call-centre-service.ts`
- Test: `src/lib/__tests__/call-centre.test.ts` (extend) and/or `call-centre-script-action.test.ts`

- [ ] **Step 2.1 — Retype the engine signature** (kills the `Record<string, any>`):
  - `executeCallActionEffect(type: CallActionType, params: CallActionParams = {}, ctx: { entityId: string; userId: string; workspaceId: string; organizationId: string; contactId?: string })`
  - `executeScriptAction({ … actionConfig?: CallActionParams … })`
  - Remove `as any` casts in the switch; narrow with the typed fields. Where Firestore docs are read, type the read shape locally (e.g. `const data = snap.data() as CallQueueItem`) — never reintroduce `any`.

- [ ] **Step 2.2 — Fix the `webhookHeaders` string bug** in the `WEBHOOK` case (it's a JSON string from the UI, currently treated as an object → never applied):

```ts
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (typeof params.webhookHeaders === 'string' && params.webhookHeaders.trim()) {
  try {
    const parsed: unknown = JSON.parse(params.webhookHeaders);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) headers[k] = String(v);
    }
  } catch { /* ignore malformed headers — send defaults */ }
}
```

- [ ] **Step 2.3 — Add the `ADD_TO_PIPELINE` case** (after `CHANGE_STAGE`):

```ts
case 'ADD_TO_PIPELINE': {
  if (!params.pipelineId || !params.stageId) return { success: false, error: 'Pipeline and stage are required.' };
  const stageSnap = await adminDb.collection('onboardingStages').doc(params.stageId).get();
  const currentStageName = stageSnap.exists ? (stageSnap.data()?.name ?? 'Unknown') : 'Unknown';
  await updateEntityAction(
    entityId,
    { pipelineId: params.pipelineId, stageId: params.stageId, currentStageName },
    systemActor, workspaceId, organizationId,
  );
  return { success: true };
}
```

  And in `CHANGE_STAGE`, include `pipelineId` in the update when present (cross-pipeline move):

```ts
const patch: { stageId: string; currentStageName: string; pipelineId?: string } =
  { stageId: params.stageId, currentStageName };
if (params.pipelineId) patch.pipelineId = params.pipelineId;
await updateEntityAction(entityId, patch, systemActor, workspaceId, organizationId);
```

- [ ] **Step 2.4 — Add the meeting `guest_list` mode** at the top of the `SCHEDULE_MEETING` case (keep the existing create path under `else`):

```ts
case 'SCHEDULE_MEETING': {
  const mode = params.meetingMode ?? 'guest_list';
  if (mode === 'guest_list') {
    if (!params.meetingId) return { success: false, error: 'No meeting selected.' };
    const entitySnap = await adminDb.collection('entities').doc(entityId).get();
    if (!entitySnap.exists) return { success: false, error: 'Entity not found.' };
    const contacts = (entitySnap.data()?.entityContacts ?? []) as EntityContact[];
    const contact = (contactId ? contacts.find(c => c.id === contactId) : undefined)
      ?? contacts.find(c => c.isPrimary) ?? contacts[0];
    await adminDb.collection(`meetings/${params.meetingId}/registrants`).doc(entityId).set({
      entityId,
      name: contact?.name ?? entitySnap.data()?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      source: 'call_campaign',
      createdAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
  }
  // …existing create-from-MEETING_TYPES path unchanged…
}
```

  (Import/define `EntityContact` from `types.ts` — do **not** use `any[]`.)

- [ ] **Step 2.5 — Source automations from the snapshot + pass `contactId`.** In `submitOutcome`, add `contactId: data.contactId ?? null` to `transactionResult`, and thread it into both `executeCampaignAutomations` calls. Rewrite `executeCampaignAutomations`:

```ts
private static async executeCampaignAutomations(params: {
  campaignId: string; entityId: string; outcome: string; userId: string;
  workspaceId: string; organizationId: string; contactId?: string | null;
}): Promise<void> {
  const { campaignId, entityId, outcome, userId, workspaceId, organizationId, contactId } = params;
  try {
    const campaignSnap = await adminDb.collection('call_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return;
    const campaign = campaignSnap.data() as CallCampaign;

    const graph = parseGraph(campaign.scriptSnapshot);
    const scriptRules = getOutcomeAutomations(graph, outcome);   // null ⇒ no script config
    const rules = scriptRules ?? (campaign.automationRules?.[outcome] ?? []); // legacy fallback

    for (const rule of rules) {
      const result = await this.executeCallActionEffect(rule.type, rule.params ?? {}, {
        entityId, userId, workspaceId, organizationId, contactId: contactId ?? undefined,
      });
      if (!result.success && !result.unsupported) {
        console.error(`[CALL_CENTRE_SERVICE] Automation "${rule.type}" failed:`, result.error);
      }
    }
  } catch (err) {
    console.error('[CALL_CENTRE_SERVICE] Campaign automations failed:', err instanceof Error ? err.message : err);
  }
}
```

  Add imports: `import { parseGraph, getOutcomeAutomations } from '../call-centre-graph';`

- [ ] **Step 2.6 — Tests** (extend the call-centre service tests; use the existing harness/mocks):
  - `executeCampaignAutomations` runs the **script node** automations when the snapshot defines them.
  - Falls back to `campaign.automationRules[outcome]` when the node has none.
  - `contactId` reaches `executeCallActionEffect` ctx.
  - `ADD_TO_PIPELINE` calls `updateEntityAction` with `{ pipelineId, stageId, currentStageName }`.
  - `SCHEDULE_MEETING` `guest_list` writes to `meetings/{id}/registrants/{entityId}`; `create` keeps prior behaviour.
  - `WEBHOOK` applies parsed JSON headers.

- [ ] **Step 2.7 — Human runs:** `pnpm vitest run src/lib/__tests__/call-centre.test.ts` then `pnpm tsc --noEmit`.

- [ ] **Step 2.8 — Commit (human):**

```bash
git add src/lib/services/call-centre-service.ts src/lib/__tests__/
git commit -m "feat(call-centre): run outcome automations from script snapshot (legacy fallback), add ADD_TO_PIPELINE + meeting guest-list, pass contactId, fix webhook headers, drop any"
```

---

# Phase 3 — Extract `ActionConfigFields` (behaviour-preserving refactor)

**Files:**
- Create: `src/app/admin/messaging/call-centre/scripts/components/ActionConfigFields.tsx`
- Modify: `ActionNodeConfigPanel.tsx`

- [ ] **Step 3.1 — Create `ActionConfigFields`** — move the per-action field JSX out of `ActionNodeConfigPanel` into a presentational, typed component. Contract:

```ts
export interface ActionConfigDataSources {
  tags: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId?: string }[];
  pipelines: { id: string; name: string }[];
  meetings: { id: string; title: string }[];        // create-mode types (MEETING_TYPES)
  activeMeetings: { id: string; title: string }[];   // guest-list targets (not-yet-due)
  callCampaigns: { id: string; name: string }[];
  workspaceUsers?: { id: string; name?: string; email: string; photoURL?: string }[];
}

export interface ActionConfigFieldsProps {
  type: CallActionType;
  params: CallActionParams;
  onChange: (patch: Partial<CallActionParams>) => void;
  data: ActionConfigDataSources;
}
```

  - Render the same field blocks as today, but typed against `CallActionParams` (no `ScriptNode` coupling, no `any`).
  - **CHANGE_STAGE:** group the stage `<Select>` by pipeline — build `Map<pipelineId, stages[]>` with `useMemo`; render `SelectGroup`/`SelectLabel` per pipeline; on select set both `stageId` and the stage's `pipelineId`.
  - **ADD_TO_PIPELINE (new):** pipeline `<Select>` (sets `pipelineId`, clears `stageId`) → stage `<Select>` filtered to that pipeline.
  - **SCHEDULE_MEETING:** mode toggle (`guest_list` default) → guest-list shows `activeMeetings` (`meetingId`); create shows `meetings` (`meetingTypeId`).
  - **Transfer to another call campaign:** render this as `ADD_TO_CALL_CAMPAIGN` with a `callCampaigns` `<Select>` (`campaignId`) + scope toggle (`contactScope`). Keep `TRANSFER_CALL`'s phone/agent modes; its `campaign` mode also uses the picker.
  - Keep `MessagingTemplateSelector` (lazy) for SMS/Email/WhatsApp and the `DueDateField` for tasks.

- [ ] **Step 3.2 — Reduce `ActionNodeConfigPanel`** to: the action-type `<Select>` + badge, then `<ActionConfigFields type={activeType} params={config} onChange={p => onUpdate({ actionConfig: { ...config, ...p } })} data={…} />`. Map its existing `tags`/`stages`/`meetings`/`workspaceUsers` props plus the new `pipelines`/`activeMeetings`/`callCampaigns` into `data`. Update `ActionNodeConfigPanelProps` to accept the new data arrays (default `[]`).

- [ ] **Step 3.3 — Human runs:** `pnpm tsc --noEmit`; smoke the script builder's single `action` node config in the running app (human) to confirm parity.

- [ ] **Step 3.4 — Commit (human):**

```bash
git add src/app/admin/messaging/call-centre/scripts/components/ActionConfigFields.tsx src/app/admin/messaging/call-centre/scripts/components/ActionNodeConfigPanel.tsx
git commit -m "refactor(call-centre): extract typed ActionConfigFields; add pipeline grouping, ADD_TO_PIPELINE, meeting modes, campaign picker"
```

---

# Phase 4 — `OutcomeAutomationsEditor` (new component + animation)

**Files:**
- Create: `src/app/admin/messaging/call-centre/scripts/components/OutcomeAutomationsEditor.tsx`

- [ ] **Step 4.1 — Build the editor.** A `React.memo` list managing `CallOutcomeAutomation[]`:

```tsx
'use client';
import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CallActionType, CallOutcomeAutomation, CallActionParams } from '@/lib/types';
import { CALL_ACTION_TYPES, getActionMeta } from '@/lib/call-action-types';
import { ActionConfigFields, type ActionConfigDataSources } from './ActionConfigFields';

interface OutcomeAutomationsEditorProps {
  automations: CallOutcomeAutomation[];
  onChange: (next: CallOutcomeAutomation[]) => void;
  data: ActionConfigDataSources;
}

const AutomationRow = React.memo(function AutomationRow({
  index, automation, onTypeChange, onParamsChange, onRemove, data, reduced,
}: {
  index: number; automation: CallOutcomeAutomation;
  onTypeChange: (i: number, t: CallActionType) => void;
  onParamsChange: (i: number, patch: Partial<CallActionParams>) => void;
  onRemove: (i: number) => void;
  data: ActionConfigDataSources; reduced: boolean;
}) {
  const meta = getActionMeta(automation.type);
  return (
    <motion.div
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1], delay: reduced ? 0 : index * 0.03 }}
      className="rounded-xl border border-border bg-card/40 p-2.5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" aria-hidden />
        <Badge className={cn('text-[8px] font-bold px-2 py-0.5 text-white border-0', meta.colorClass)}>
          <meta.icon className="h-2.5 w-2.5 mr-1" /> {meta.label}
        </Badge>
        <Select value={automation.type} onValueChange={v => onTypeChange(index, v as CallActionType)}>
          <SelectTrigger className="h-7 ml-auto w-[150px] bg-background border-border rounded-lg text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_ACTION_TYPES.map(t => {
              const m = getActionMeta(t);
              return <SelectItem key={t} value={t}><span className="flex items-center gap-2"><m.icon className="h-3 w-3 opacity-70" />{m.label}</span></SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive active:scale-[0.97] transition-transform"
          onClick={() => onRemove(index)} aria-label="Remove automation">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ActionConfigFields type={automation.type} params={automation.params}
        onChange={patch => onParamsChange(index, patch)} data={data} />
    </motion.div>
  );
});

export const OutcomeAutomationsEditor = React.memo(function OutcomeAutomationsEditor({
  automations, onChange, data,
}: OutcomeAutomationsEditorProps) {
  const reduced = useReducedMotion() ?? false;

  const addAutomation = React.useCallback(() => {
    const type: CallActionType = 'SEND_SMS';
    onChange([...automations, { type, params: { ...getActionMeta(type).defaultParams() } }]);
  }, [automations, onChange]);

  const removeAutomation = React.useCallback((i: number) => {
    onChange(automations.filter((_, idx) => idx !== i));
  }, [automations, onChange]);

  const changeType = React.useCallback((i: number, type: CallActionType) => {
    onChange(automations.map((a, idx) => idx === i ? { type, params: { ...getActionMeta(type).defaultParams() } } : a));
  }, [automations, onChange]);

  const changeParams = React.useCallback((i: number, patch: Partial<CallActionParams>) => {
    onChange(automations.map((a, idx) => idx === i ? { ...a, params: { ...a.params, ...patch } } : a));
  }, [automations, onChange]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Post-Call Automations</span>
        <Button type="button" size="sm" variant="outline"
          className="h-7 gap-1 text-[10px] active:scale-[0.97] transition-transform" onClick={addAutomation}>
          <Plus className="h-3 w-3" /> Add Action
        </Button>
      </div>
      {automations.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/60 italic py-2">
          No automations yet. Add SMS, email, tasks, stage changes and more to run when a call resolves to this outcome.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {automations.map((a, i) => (
            <AutomationRow key={`${a.type}-${i}`} index={i} automation={a} data={data} reduced={reduced}
              onTypeChange={changeType} onParamsChange={changeParams} onRemove={removeAutomation} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
});
```

  Notes: animations use ease-out `[0.23, 1, 0.32, 1]` ≤ 200ms, transform+opacity only, staggered, reduced-motion → opacity-only (`emilkowal-animations`); rows are top-level memo components (`vercel-react`). Drag-reorder is intentionally **not** in scope (YAGNI); the grip is a visual affordance for a later phase.

- [ ] **Step 4.2 — Human runs:** `pnpm tsc --noEmit`. **Step 4.3 — Commit (human):**

```bash
git add src/app/admin/messaging/call-centre/scripts/components/OutcomeAutomationsEditor.tsx
git commit -m "feat(call-centre): OutcomeAutomationsEditor with animated, typed automation rows"
```

---

# Phase 5 — Wire the editor + data into the script builder

**Files:**
- Modify: `src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx`
- Modify: `src/lib/call-centre-actions.ts` (server-side import sanitisation + typing)
- Modify: `src/app/admin/messaging/call-centre/CallCentreClient.tsx` (import success note)

- [ ] **Step 5.1 — Add data queries** beside the existing tags/stages/meetings queries (reuse `useMemoFirebase`/`useCollection`; **filter client-side** to avoid new composite Firestore indexes):
  - `pipelines`: `collection 'pipelines'` where `workspaceId == active` → `{ id, name }`.
  - `stages`: already loaded — also select `pipelineId`.
  - `activeMeetings`: derive from the existing `meetingsData` with `useMemo`, keeping only `publishStatus !== 'archived'` and `meetingTime >= now` → `{ id, title }`. (No new query/index.)
  - `callCampaigns`: `collection 'call_campaigns'` where `workspaceId == active`, excluding the script's own return campaign → `{ id, name }`.
  - Assemble one memoized `actionData: ActionConfigDataSources`.

- [ ] **Step 5.2 — Pass `data={actionData}` to `ActionNodeConfigPanel`** (replaces the four separate props).

- [ ] **Step 5.3 — Replace the outcome-node config block** (`ScriptBuilderClient.tsx:1694–1740`) — keep outcome-value `<Select>` + `suppressDays`, drop the free-text "Transfer to Campaign ID" input, and add the editor (lazy-loaded per `bundle-dynamic-imports`):

```tsx
// near other dynamic imports:
const OutcomeAutomationsEditor = dynamic(
  () => import('../components/OutcomeAutomationsEditor').then(m => m.OutcomeAutomationsEditor),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full rounded-xl" /> },
);

// inside the outcome block, after suppressDays:
<OutcomeAutomationsEditor
  automations={selectedNode.data.outcomeConfig?.automations ?? []}
  onChange={(automations) => updateSelectedNode({
    outcomeConfig: { ...selectedNode.data.outcomeConfig, automations },
  })}
  data={actionData}
/>
```

- [ ] **Step 5.4 — Confirm `cleanGraph` persists automations.** `cleanGraph` (`:729`) already spreads `outcomeConfig`; the nested `automations` array survives. Add a one-line assertion comment; no logic change needed.

- [ ] **Step 5.5 — Sanitise on import (server-side — the security boundary).** Edit `importCallScriptAction` in `src/lib/call-centre-actions.ts` (`:85`). After `parseScriptExport` succeeds, if `isJsonGraph(content)`, replace `content` with the sanitised, re-stringified graph **before** persisting:

```ts
import { isJsonGraph, parseGraph, sanitizeImportedAutomations } from './call-centre-graph';
// …after `const { name, description, content, variables } = parsed.script;`
const safeContent = isJsonGraph(content)
  ? JSON.stringify(sanitizeImportedAutomations(parseGraph(content)))
  : content;
// use `safeContent` for `data.content`.
```

  Surface a UI note on success in `CallCentreClient.handleImportFile` (`:181`): append "Post-call automations were cleared — reconfigure templates, tags, stages and webhooks for this workspace." Do **not** rely on the client to sanitise; the server action is authoritative. While here, also retype `executeScriptActionAction`'s `actionConfig?: Record<string, any>` (`call-centre-actions.ts:130`) to `CallActionParams` and replace `catch (error: any)` with `catch (error)` + `error instanceof Error ? error.message : 'Import failed.'` (no `any`).

- [ ] **Step 5.6 — Human runs:** `pnpm tsc --noEmit`; in-app smoke: add an outcome node, add 2 automations, save, reopen → persisted; import a `.cflow` → automations cleared with toast.

- [ ] **Step 5.7 — Commit (human):**

```bash
git add src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx src/lib/call-centre-actions.ts src/app/admin/messaging/call-centre/CallCentreClient.tsx
git commit -m "feat(call-centre): configure post-call automations on outcome nodes; sanitise imported automations server-side"
```

---

# Phase 6 — Campaign wizard: drop Steps 4 & 5, derive outcomes from script

**Files:**
- Modify: `src/app/admin/messaging/call-centre/campaigns/new/CampaignWizardClient.tsx`
- Modify: `src/app/admin/messaging/call-centre/campaigns/new/page.tsx`

- [ ] **Step 6.1 — Remove outcome/automation editing state + handlers** (`outcomes` setter UI, `automationRules`, add/remove/rule handlers). Keep reading `campaign.outcomes`/`automationRules` only for legacy display.

- [ ] **Step 6.2 — Derive outcomes from the selected script** with `useMemo`:

```ts
const derivedOutcomes = React.useMemo(
  () => selectedScript ? extractOutcomesFromGraph(parseGraph(selectedScript.content)) : [],
  [selectedScript],
);
```

  Import `{ parseGraph }` from `@/lib/call-centre-graph` and `extractOutcomesFromGraph`.

- [ ] **Step 6.3 — Collapse to 4 steps.** Update the breadcrumb labels array to `['Campaign Details','Select Script','Define Audience','Review & Launch']`; delete the `step === 4` (Configure Outcomes) and `step === 5` (Outcome Automations) JSX blocks; renumber the old `step === 6` review block to `step === 4`. Fix `nextStep` upper bound and the final-step launch guard to `4`.

- [ ] **Step 6.4 — Save payload:** write `outcomes: derivedOutcomes` (kept for analytics/back-compat) and **do not** write `automationRules` for new campaigns (leave `{}`). The review step renders `derivedOutcomes` read-only with a per-outcome automation count from the script graph.

- [ ] **Step 6.5 — Clamp deep-link step** in `page.tsx` (and the `initialStep` guard in the client): `initialStep >= 1 && initialStep <= 4`. Existing `&step=2` / `&step=3` links remain valid (Script / Audience).

- [ ] **Step 6.6 — Human runs:** `pnpm tsc --noEmit`; in-app: create a campaign end-to-end (4 steps); confirm review shows script outcomes; open an old `?id=…&step=3` link → lands on Audience.

- [ ] **Step 6.7 — Commit (human):**

```bash
git add src/app/admin/messaging/call-centre/campaigns/new/CampaignWizardClient.tsx src/app/admin/messaging/call-centre/campaigns/new/page.tsx
git commit -m "feat(call-centre): wizard derives outcomes from script; remove Configure Outcomes + Outcome Automations steps"
```

---

# Phase 7 — Workspace runtime: outcomes from the script graph

**Files:**
- Modify: `src/app/admin/messaging/call-centre/workspace/[campaignId]/WorkspaceClient.tsx`

- [ ] **Step 7.1 — Derive outcome options** with a legacy fallback:

```ts
const scriptOutcomes = React.useMemo(() => extractOutcomesFromGraph(scriptGraph), [scriptGraph]);
const outcomeOptions = React.useMemo(
  () => (scriptOutcomes.length > 0 ? scriptOutcomes : (campaign?.outcomes ?? [])),
  [scriptOutcomes, campaign?.outcomes],
);
```

  Import `extractOutcomesFromGraph` from `@/lib/call-centre-graph`.

- [ ] **Step 7.2 — Replace the two render sites** (`:2583`, `:2708`) `campaign?.outcomes?.map(...)` → `outcomeOptions.map(...)`, and the `isCallback`/`isDefer` detection memos (`:199`, `:206`) to scan `outcomeOptions`. Behaviour: branching scripts use their outcome nodes; plain-text/legacy use `campaign.outcomes`.

- [ ] **Step 7.3 — Human runs:** `pnpm tsc --noEmit`; in-app: run a call on a branching-script campaign → outcome buttons match the script's outcome nodes; run a legacy plain-text campaign → still shows `campaign.outcomes`.

- [ ] **Step 7.4 — Commit (human):**

```bash
git add "src/app/admin/messaging/call-centre/workspace/[campaignId]/WorkspaceClient.tsx"
git commit -m "feat(call-centre): workspace derives outcome buttons from the script graph (legacy fallback)"
```

---

# Phase 8 — Analytics: read automations from the snapshot

**Files:**
- Modify: `src/app/admin/messaging/call-centre/analytics/[campaignId]/CampaignAnalyticsClient.tsx`

- [ ] **Step 8.1 — Replace** `const rules = campaign?.automationRules?.[item.outcome || ''] || [];` (`:459`) with a snapshot-first read:

```ts
const graph = React.useMemo(() => campaign ? parseGraph(campaign.scriptSnapshot) : null, [campaign?.scriptSnapshot]);
// per row:
const rules = (item.outcome && graph ? getOutcomeAutomations(graph, item.outcome) : null)
  ?? campaign?.automationRules?.[item.outcome || ''] ?? [];
```

  Import `{ parseGraph, getOutcomeAutomations }` from `@/lib/call-centre-graph`. Hoist `graph` out of the row loop (don't re-parse per row — `js-cache-function-results`).

- [ ] **Step 8.2 — Human runs:** `pnpm tsc --noEmit`. **Step 8.3 — Commit (human):**

```bash
git add "src/app/admin/messaging/call-centre/analytics/[campaignId]/CampaignAnalyticsClient.tsx"
git commit -m "feat(call-centre): analytics reads outcome automations from script snapshot (legacy fallback)"
```

---

# Phase 9 — Regression sweep, docs, final verification

**Files:**
- Modify (tests): `call-centre-import.test.ts`, `call-script-portability.test.ts`, `campaign-automation-dispatch.test.ts` (only if they assert removed structures)
- Modify (memory/docs): update the call-centre memory pointer.

- [ ] **Step 9.1 — Update/extend round-trip tests:** assert a `.cflow` containing outcome automations re-imports with org-scoped ids cleared (`sanitizeImportedAutomations`), and that export still round-trips the graph shape.
- [ ] **Step 9.2 — Grep for stragglers:** `grep -rn "automationRules" src/app src/lib` — every read must have a script-first path or be a legacy-only fallback; no writer remains except the type/back-compat surface.
- [ ] **Step 9.3 — Verify AI script generation** (`src/ai/flows/generate-script-flow.ts`, `AiScriptBuilderModal.tsx`): generated outcome nodes simply omit `automations` (valid → engine falls back / runs nothing). Confirm the node schema doesn't reject the new optional field.
- [ ] **Step 9.4 — Human runs full gate locally:**

```bash
pnpm tsc --noEmit
pnpm vitest run src/lib/__tests__
pnpm lint
```

- [ ] **Step 9.5 — Commit (human):**

```bash
git add -A
git commit -m "test(call-centre): cflow automation sanitisation round-trip + regression sweep for script-owned outcomes"
```

---

## Risk Analysis & Mitigations

| # | Risk | Impact | Mitigation (in-plan) |
|---|---|---|---|
| 1 | Legacy running campaigns lose automations | Live campaigns silently stop firing | **Fallback path** in engine/workspace/analytics: script-first, `campaign.automationRules`/`outcomes` second. No migration (Phase 2/7/8). |
| 2 | Outcome string mismatch (node `outcomeValue` ≠ submitted `outcome`) | Automations don't run | `getOutcomeAutomations` matches the exact submitted string; workspace submits the node's `outcomeValue`, so they're the same source. Document exact-match; future: normalise/trim. |
| 3 | `.cflow` import smuggles foreign ids + webhook URLs (SSRF) | Cross-org data leak / SSRF | `sanitizeImportedAutomations` clears org-scoped ids + `webhookUrl` on import + user toast (Phase 1/5). |
| 4 | Double execution: agent triggers a live action node *and* the outcome runs the same action | Duplicate SMS/task | Out of current scope but flagged. Recommend the per-action execution-log + idempotency from the sibling triggers/analytics plan; note it in code comments. |
| 5 | `webhookHeaders` JSON string never parsed (pre-existing) | Auth headers dropped | Fixed in Phase 2.2 with typed `JSON.parse` + guard. |
| 6 | `scriptSnapshot` is a stale copy of the script at launch | Edited script automations don't apply to launched campaign | This is **existing, intended** snapshot behaviour (campaigns are immutable post-launch). Document it; the "Edit Script" deep-link re-snapshots on save. |
| 7 | New Firestore queries needing composite indexes | Deploy-time index errors | Avoided: derive `activeMeetings` client-side from already-loaded meetings; `pipelines`/`call_campaigns` are simple `workspaceId` equality queries (single-field). Only add to `firestore.indexes.json` if a query truly needs it. |
| 8 | Adding `ADD_TO_PIPELINE` to the union breaks an exhaustive `switch` | Type/compile error | Only `call-action-types.ts` (Map — has fallback) and the engine `switch` (has `default`) consume the union; both handled in Phase 0/2. No exhaustive switch elsewhere (verified). |
| 9 | Bundle bloat in the canvas from the new editor | Slower builder load | `OutcomeAutomationsEditor` + `MessagingTemplateSelector` lazy-loaded (`bundle-dynamic-imports`). |
| 10 | Re-render storms editing large automation lists | Janky inspector | Memoized rows + functional setState + primitive keys (`vercel-react` rules). |
| 11 | Reorder-by-index `key` causes animation glitches on delete | Minor visual | Acceptable for v1 (no reorder); revisit with stable ids if drag-reorder lands. |

## Affected / At-Risk Features (explicitly covered)

- **Script import/export (`.cflow`)** — Phase 1/5/9 (sanitise + round-trip tests). *Out of scope but adjacent:* the unauthenticated `/api/call-centre/webhook` SSRF hardening noted in the sibling plan.
- **AI script generation** — Phase 9.3 (new field is optional; no schema break).
- **Campaign deep-links (`&step=2/3`)** — Phase 6.5 (still valid; clamp `1..4`).
- **Workspace callback/defer interception** — Phase 7.2 (memos now scan derived `outcomeOptions`).
- **Analytics automation display** — Phase 8.
- **Messaging-campaign automations (`campaign-automation-*`)** — **not affected** (separate subsystem: delivered/opened/clicked). Confirmed, no changes.
- **`CallCampaign.outcomes` / `automationRules` types** — retained as legacy/back-compat; documented, not removed.

## Type-Safety Rules (enforced in review)
- New/edited code uses `CallActionParams`, `CallOutcomeAutomation`, `EntityContact`, `BranchingScriptGraph` — **never** `any` or `any[]`.
- Firestore reads typed via existing domain interfaces (`as CallQueueItem`, `as CallCampaign`); external/untrusted JSON typed as `unknown` then narrowed.
- `catch (err)` uses `err instanceof Error ? err.message : err` — no `catch (err: any)`.

## Execution Handoff
Plan saved to `docs/superpowers/plans/2026-06-22-script-outcome-automations-plan.md`. Recommended: **subagent-driven** execution (fresh agent per phase, review between). Agent writes code + tests; **human** runs `tsc`/`vitest`/`lint`/`git commit` locally per the per-phase commands.
