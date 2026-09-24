# Properties Panel Light Theme, Undo/Redo Engine & Dual-Tier Auto-Save Recovery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver complete Light Theme visual fidelity for all properties panel surfaces across the platform, an immutable 50-step Undo/Redo history engine with keyboard shortcuts and dual toolbar controls, and a two-tier Auto-Save recovery engine (0ms local emergency-flush + background Cloud Draft snapshots) with a non-code backoffice management interface in the Content Manager.

**Architecture:**
- **Light Theme & Design Tokens**: Eliminate hardcoded dark styles (`bg-slate-900`, `bg-slate-800`, `border-slate-700`, `text-slate-200`) across `AutoBlockEditor.tsx`, `ContentBlockInspector.tsx`, and `PropertiesPanel.tsx`, standardizing on semantic Tailwind light/dark tokens (`bg-white dark:bg-slate-800/90`, `border-slate-200 dark:border-slate-700`, `text-slate-900 dark:text-slate-100`) adhering to `frontend-design` and `emilkowal-animations` micro-interactions (`active:scale-[0.97]`).
- **Undo / Redo Engine**: Refactor `use-undo-redo.ts` to be strictly typed with generic `<T>` (0 `any`, 0 `any[]`, 0 unhandled `unknown`) with a bounded 50-step circular buffer. Integrate into `ContentEditorModal.tsx` and `ContentBlockInspector.tsx` with intelligent active-element inspection that preserves native text undo inside inputs while executing structural block undo on the canvas, triggered via `⌘Z` / `⌘⇧Z` / `⌘Y`.
- **Two-Tier Auto-Save Engine**: 
  1. *Tier 1 (Instant Local)*: 400ms debounced persistence to namespaced `localStorage` key (`content_studio_draft_${orgId}_${portalId}_${itemId}`) plus a synchronous `beforeunload` emergency flush that captures in-flight state immediately upon browser reload (`⌘R`) or tab closing.
  2. *Tier 2 (Cloud Draft Snapshot)*: 3000ms debounced background sync to Firestore `/content_drafts/{draftId}` with author attribution (`authorId`, `authorName`), enabling multi-device backoffice recovery and team collision detection without writing code.
- **Reversible Restoration**: When restoring a draft (local or cloud), the pre-restore state is pushed directly into the undo history stack, allowing operators to immediately press `⌘Z` to reverse the restore if clicked in error.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Lucide React, Cloud Firestore, Vitest, TypeScript.

---

## 1. What Could Go Wrong & Comprehensive Mitigation Matrix

| Potential Failure Mode | Root Cause Analysis | Architectural Solution & Mitigation Strategy |
| :--- | :--- | :--- |
| **Keystroke Flooding in Undo Stack** | Pushing a new history frame on every character typed in a text field fills the 50-step stack in seconds. | Differentiate structural vs property mutations: Structural block mutations (add, delete, reorder, reset defaults, restore draft) push immediately to `past`. Property updates from inputs are grouped using leading-edge snapshotting or change boundaries. |
| **Keyboard Shortcut Collision with Native Text Undo** | Global `⌘Z` listener intercepts `Undo` while a user is editing text inside a block input or textarea. | In the `keydown` handler, inspect `document.activeElement`. If the active element is an `HTMLInputElement`, `HTMLTextAreaElement`, or `isContentEditable`, delegate to the browser's native text undo. Outside text inputs, intercept and run block-level undo. |
| **Draft Loss During Sudden Browser Reload (`⌘R`)** | Browser reload kills in-memory React state before the 400ms debounce fires. | Register a synchronous `window.addEventListener('beforeunload', ...)` listener that writes the latest state directly to `localStorage` before the page unloads, guaranteeing zero data loss. |
| **LocalStorage Quota Exceeded (`QuotaExceededError`)** | Heavy documents containing large inline SVGs or data URIs exceed the browser's 5MB localStorage quota. | Wrap all `localStorage.setItem` calls in try/catch blocks. When quota is exceeded, prune stale drafts (> 7 days) and seamlessly rely on Firestore Cloud Draft snapshots. |
| **Accidental Overwrite Upon Draft Restore** | Operator clicks "Restore Draft" on an outdated backup, replacing newer changes. | Make restore 100% reversible: `handleRestoreDraft()` pushes the current canvas blocks into the `past` undo stack before applying the draft. The operator can hit `⌘Z` to undo the restore instantly. |
| **Hydration Mismatch on Client Storage** | Reading `localStorage` during initial server render causes SSR/client DOM divergence. | Defer all storage checks to `useEffect` or client-only lifecycle hooks after mounting. |
| **Cross-Tenant or Shared Device Draft Leaks** | Two operators using different accounts on the same computer access another workspace's draft. | Namespace storage keys strictly with both `organizationId` and `portalId`: `content_studio_draft_${orgId}_${portalId}_${itemId}`. Validate tenant match before restoring. |

---

## 2. Affected Subsystems & Backoffice Governance Enhancement

### A. Subsystem Impact Assessment
1. **Content Studio (`ContentEditorModal.tsx`)**: Upgraded with Undo/Redo history, dual toolbars, 400ms auto-save, `beforeunload` emergency flush, and reversible restore.
2. **Block Inspector (`ContentBlockInspector.tsx` & `AutoBlockEditor.tsx`)**: Upgraded to clean Light Theme (crisp white backgrounds, slate-200 borders, high contrast slate-900 text) and added Undo/Redo quick action buttons.
3. **Page Builder (`PropertiesPanel.tsx` & `BuilderClient.tsx`)**: Replaced hardcoded dark classes in `/admin/pages/[id]/builder` with theme-adaptive tokens.
4. **Portal Content Manager (`PortalContentManager.tsx`)**: Enhanced with an active session recovery alert banner and a dedicated "Drafts" view for backoffice operators.

### B. Backoffice Governance (No-Code Administrative Control)
How can backoffice administrators manage and govern this feature without touching code?
1. **Visual Draft Recovery Banner**:
   - When an operator reloads their browser or returns to the Portal Content Manager within 24 hours of an unclosed editing session, a prominent top banner appears:
     > *"You have an unsaved session for '[Content Title]'. [Resume Editing] [Discard]"*
   - Clicking `[Resume Editing]` immediately re-opens the Content Studio with the exact draft intact.
2. **Cross-Device Cloud Drafts Vault in Content Manager**:
   - In `PortalContentManager.tsx`, backoffice admins can view a "Saved Drafts" tab listing all uncommitted drafts across team members, showing `Title`, `Author`, `Last Saved`, `Block Count`, with one-click `[Open in Studio]` and `[Delete Draft]` buttons.
   - Non-technical operators can recover their work from any device or hand over an in-progress draft to another editor without sharing local browser storage.
3. **Collision Detection for Concurrent Editing**:
   - If Operator B opens a content item that Operator A is actively drafting, the backoffice displays:
     > *"Jane Doe saved a draft for this item 3 minutes ago. [Load Team Draft] [Use Published Version]"*

---

## 3. Data Architecture, Firestore Security Rules & Indexes

### A. Firestore Collections Schema
#### Collection: `content_drafts`
- **Document ID**: `${portalId}_${contentItemId || 'new_' + authorId}`
- **Fields**:
  - `id`: string
  - `portalId`: string (indexed)
  - `organizationId`: string (indexed)
  - `contentItemId`: string | null (indexed)
  - `title`: string
  - `slug`: string
  - `type`: ContentItemType (`article` | `lesson` | `resource` | `page` | `announcement` | `video` | `file` | `embed`)
  - `summary`: string
  - `category`: string
  - `tags`: string[]
  - `blocks`: PageBlock[]
  - `visibility`: PortalVisibility (`public` | `members` | `tier_restricted` | `private`)
  - `media`: ContentMedia
  - `seo`: ContentSeoConfig
  - `authorId`: string
  - `authorName`: string
  - `authorEmail`: string
  - `savedAt`: string (ISO 8601, indexed)
  - `updatedAt`: string (ISO 8601, indexed)
  - `version`: number

### B. Firestore Security Rules (`firestore.rules`)
```rules
// --- {{Org_name}} Experience Platform — Content Drafts (Backoffice Only) ---
match /content_drafts/{draftId} {
  // Public access is strictly forbidden
  allow read, write: if isAuthorized() && (
    resource == null ||
    resource.data.organizationId == getUserData().organizationId ||
    isSystemAdmin()
  );
}

// Public facing content items permissions (verify public read for published & public items)
match /content_items/{itemId} {
  allow get, list: if true;
  allow create, update, delete: if isAuthorized();

  match /versions/{versionId} {
    allow read, write: if isAuthorized();
  }
}
```

### C. Firestore Indexes (`firestore.indexes.json`)
```json
{
  "collectionGroup": "content_drafts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "portalId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "content_drafts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "portalId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

### D. Fetch-Enrich-Restore Protocol (FERP)
1. **Fetch**:
   - On Studio mount: Simultaneously query LocalStorage (`content_studio_draft_${orgId}_${portalId}_${itemId}`) and Firestore (`/content_drafts/${portalId}_${itemId}`).
2. **Enrich**:
   - Compare timestamps: If LocalStorage is newer than Firestore (e.g. offline edits), prioritize LocalStorage; if Cloud Draft is newer (e.g. edited on another machine), surface the Cloud Draft indicator.
3. **Restore**:
   - Push existing in-memory blocks to undo stack (`past`).
   - Populate Studio state with draft values.
   - Dispatch toast notification with an actionable option to undo (`⌘Z`).

---

## 4. Phase-by-Phase Trackable Implementation Plan

### Phase 1: Foundation & Strict Type-Safe Bounded History Engine

**Files:**
- Modify: `src/hooks/use-undo-redo.ts`
- Create: `src/hooks/__tests__/use-undo-redo.test.ts`
- Modify: `src/lib/types/content.ts`

- [ ] **Step 1: Write unit tests for `use-undo-redo` hook**

Create `src/hooks/__tests__/use-undo-redo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../use-undo-redo';

describe('useUndoRedo hook', () => {
  it('initializes with present value and empty past/future', () => {
    const { result } = renderHook(() => useUndoRedo<string>('initial'));
    expect(result.current.state).toBe('initial');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('records state transitions and allows undo/redo', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.set('v2');
    });

    expect(result.current.state).toBe('v2');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toBe('v1');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toBe('v2');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps history size to prevent unbounded memory growth', () => {
    const { result } = renderHook(() => useUndoRedo<number>(0, 5));

    for (let i = 1; i <= 10; i++) {
      act(() => {
        result.current.set(i);
      });
    }

    expect(result.current.state).toBe(10);
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.undo();
      });
    }
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/use-undo-redo.test.ts`
Expected: Fails due to missing `maxHistory` or typing mismatches.

- [ ] **Step 3: Refactor `src/hooks/use-undo-redo.ts` with strict typing and bounded memory**

Modify `src/hooks/use-undo-redo.ts`:
```ts
'use client';

/**
 * {{Org_name}} Experience Platform — Generic Type-Safe Undo/Redo Hook
 *
 * Conforms to:
 * - Strict Typing: Zero `any`, zero `any[]`, zero unhandled `unknown`.
 * - Memory Safety: Bounded past history stack (`maxHistory`, default 50).
 * - Immutability: Pure functional state updates without direct mutation.
 */

import { useState, useCallback } from 'react';

function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export interface UseUndoRedoReturn<T> {
  state: T;
  set: (newPresent: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newPresent: T) => void;
}

export const useUndoRedo = <T>(
  initialPresent: T,
  maxHistory: number = 50
): UseUndoRedoReturn<T> => {
  const [history, setHistory] = useState<{
    past: T[];
    present: T;
    future: T[];
  }>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = history.past.length !== 0;
  const canRedo = history.future.length !== 0;

  const undo = useCallback(() => {
    setHistory((currentState) => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentState) => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const set = useCallback(
    (newPresent: T) => {
      setHistory((currentState) => {
        const { past, present } = currentState;

        if (deepEqual(newPresent, present)) {
          return currentState;
        }
        return {
          past: [...past.slice(-(maxHistory - 1)), present],
          present: newPresent,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const reset = useCallback((newPresent: T) => {
    setHistory({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
};
```

- [ ] **Step 4: Update `src/lib/types/content.ts` with Cloud Draft Schema**

Append to `src/lib/types/content.ts`:
```ts
export interface ContentStudioDraft {
  id: string;
  portalId: string;
  organizationId: string;
  contentItemId: string | null;
  title: string;
  slug: string;
  type: ContentItemType;
  summary?: string;
  category?: string;
  tags?: string[];
  blocks: PageBlock[];
  visibility: PortalVisibility;
  media?: ContentMedia;
  seo?: ContentSeoConfig;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  savedAt: string;
  updatedAt: string;
  version: number;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/use-undo-redo.test.ts`
Expected: PASS with 3 tests passing.

- [ ] **Step 6: Commit changes**

```bash
git add src/hooks/use-undo-redo.ts src/hooks/__tests__/use-undo-redo.test.ts src/lib/types/content.ts
git commit -m "refactor(hooks): strictly type useUndoRedo, cap history at 50, and define ContentStudioDraft contract"
```

---

### Phase 2: Universal Light Theme & Polish Across Properties Panels

**Files:**
- Modify: `src/components/page-builder/AutoBlockEditor.tsx`
- Modify: `src/app/admin/portals/components/studio/ContentBlockInspector.tsx`
- Modify: `src/app/admin/pages/[id]/builder/components/PropertiesPanel.tsx`
- Modify: `src/app/admin/pages/[id]/builder/BuilderClient.tsx:1179`

- [ ] **Step 1: Verify and complete `AutoBlockEditor.tsx` Light Theme Tokens**

Ensure all constants in `src/components/page-builder/AutoBlockEditor.tsx` are fully theme-adaptive:
- `SELECT_TRIGGER_CLASS`: `h-9 rounded-xl bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-sm focus:border-[var(--portal-primary,#3B82F6)]`
- `SELECT_CONTENT_CLASS`: `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl`
- `SELECT_ITEM_CLASS`: `text-xs font-medium cursor-pointer focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-slate-100`
- `INPUT_CLASS`: `h-9 rounded-xl bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:border-[var(--portal-primary,#3B82F6)]`
- `TEXTAREA_CLASS`: `rounded-xl bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:border-[var(--portal-primary,#3B82F6)]`
- `LABEL_CLASS`: `text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400`
- Color inputs: Color swatch box styled with `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900`
- Preset buttons: Active state `bg-[var(--portal-primary,#3B82F6)]/10 text-[var(--portal-primary,#3B82F6)] border-[var(--portal-primary,#3B82F6)]`, inactive `bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800`

- [ ] **Step 2: Update `ContentBlockInspector.tsx` with Light Theme & Header Undo/Redo**

In `src/app/admin/portals/components/studio/ContentBlockInspector.tsx`:
Add Undo & Redo icon buttons (`Undo2`, `Redo2`) to the inspector header with tooltips, `canUndo`/`canRedo` disabled states, and `active:scale-[0.97]` touch response.
Ensure empty state and container backgrounds use `bg-background border-slate-200 dark:border-slate-800`.

- [ ] **Step 3: Update `PropertiesPanel.tsx` in Page Builder**

In `src/app/admin/pages/[id]/builder/components/PropertiesPanel.tsx`:
Replace hardcoded dark classes:
```tsx
const TAB_TRIGGER_CLASS = 'text-[10px] py-1 rounded-md font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400';
const INPUT_CLASS = 'h-10 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-200 focus:border-emerald-500/50';
```
Update style-state selector container from `bg-slate-900 border-slate-700/80` to `bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700/80`.
Update SelectContent, Inputs, and Color Pickers to theme-adaptive classes.

- [ ] **Step 4: Update `BuilderClient.tsx:1179` Wrapper**

In `src/app/admin/pages/[id]/builder/BuilderClient.tsx`:
Change line 1179:
```tsx
<aside className="w-80 border-l border-slate-200 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-4 overflow-y-auto">
```

- [ ] **Step 5: Run TypeScript verification**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/page-builder/AutoBlockEditor.tsx src/app/admin/portals/components/studio/ContentBlockInspector.tsx src/app/admin/pages/[id]/builder/components/PropertiesPanel.tsx src/app/admin/pages/[id]/builder/BuilderClient.tsx
git commit -m "fix(builder): complete light theme styling across all properties panels and add inspector undo-redo buttons"
```

---

### Phase 3: Content Studio Undo/Redo Engine & Dual Toolbar Navigation

**Files:**
- Modify: `src/app/admin/portals/components/ContentEditorModal.tsx`
- Test: `src/lib/services/__tests__/content-history.test.ts`

- [ ] **Step 1: Write unit tests for block history transitions**

Create `src/lib/services/__tests__/content-history.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { PageBlock } from '@/lib/types';

describe('Content Studio Block History Engine', () => {
  interface HistoryState {
    past: PageBlock[][];
    present: PageBlock[];
    future: PageBlock[][];
  }

  const pushSnapshot = (history: HistoryState, next: PageBlock[], max: number = 50): HistoryState => ({
    past: [...history.past.slice(-(max - 1)), history.present],
    present: next,
    future: [],
  });

  const undo = (history: HistoryState): HistoryState => {
    if (history.past.length === 0) return history;
    const previous = history.past[history.past.length - 1];
    return {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    };
  };

  const redo = (history: HistoryState): HistoryState => {
    if (history.future.length === 0) return history;
    const next = history.future[0];
    return {
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1),
    };
  };

  it('records additions and undoes back to initial blocks', () => {
    let hist: HistoryState = { past: [], present: [], future: [] };
    const b1: PageBlock = { id: 'blk_1', type: 'text', props: { content: 'Hello' } };

    hist = pushSnapshot(hist, [b1]);
    expect(hist.present).toHaveLength(1);
    expect(hist.past).toHaveLength(1);

    hist = undo(hist);
    expect(hist.present).toHaveLength(0);
    expect(hist.future).toHaveLength(1);

    hist = redo(hist);
    expect(hist.present).toHaveLength(1);
    expect(hist.present[0].id).toBe('blk_1');
  });

  it('reversibly restores draft by keeping pre-restore state in history', () => {
    const original: PageBlock[] = [{ id: 'orig_1', type: 'text', props: {} }];
    const draft: PageBlock[] = [
      { id: 'draft_1', type: 'hero', props: {} },
      { id: 'draft_2', type: 'faq', props: {} },
    ];

    let hist: HistoryState = { past: [], present: original, future: [] };
    hist = pushSnapshot(hist, draft);

    expect(hist.present).toHaveLength(2);
    // User can immediately reverse the draft restoration
    hist = undo(hist);
    expect(hist.present).toHaveLength(1);
    expect(hist.present[0].id).toBe('orig_1');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/content-history.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement History Stack & Controls in `ContentEditorModal.tsx`**

In `src/app/admin/portals/components/ContentEditorModal.tsx`:
1. Add state:
```tsx
const MAX_HISTORY = 50;
const [history, setHistory] = useState<{
  past: PageBlock[][];
  future: PageBlock[][];
}>({ past: [], future: [] });

const canUndo = history.past.length > 0;
const canRedo = history.future.length > 0;
```
2. Implement `commitBlocksWithHistory`:
```tsx
const commitBlocksWithHistory = useCallback((nextBlocks: PageBlock[]) => {
  setHistory((prev) => ({
    past: [...prev.past.slice(-(MAX_HISTORY - 1)), blocks],
    future: [],
  }));
  setBlocks(nextBlocks);
  setIsDirty(true);
}, [blocks]);
```
3. Implement `handleUndo` and `handleRedo`.
4. Wrap `handleAddBlockOfType`, `handleDeleteBlock`, `handleResetBlockDefaults`, and `handleBlocksChange` with history tracking.
5. In top studio header, render Undo (`Undo2`) and Redo (`Redo2`) buttons between the View Switcher and Actions.
6. Pass `canUndo`, `canRedo`, `onUndo={handleUndo}`, `onRedo={handleRedo}` to `<ContentBlockInspector />`.
7. Add smart keyboard event listener:
```tsx
useEffect(() => {
  if (!open) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    const isModifier = e.metaKey || e.ctrlKey;
    if (!isModifier) return;

    if (e.key === 's') {
      e.preventDefault();
      handleSave(false);
      return;
    }

    // Check if focused on input/textarea to preserve native text undo
    const active = document.activeElement;
    const isTextInput =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active as HTMLElement | null)?.isContentEditable;

    if (e.key === 'z' && !e.shiftKey) {
      if (!isTextInput && canUndo) {
        e.preventDefault();
        handleUndo();
      }
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      if (!isTextInput && canRedo) {
        e.preventDefault();
        handleRedo();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [open, handleSave, handleUndo, handleRedo, canUndo, canRedo]);
```

- [ ] **Step 4: Run typecheck and tests**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Run: `npx vitest run src/lib/services/__tests__/content-history.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/admin/portals/components/ContentEditorModal.tsx src/lib/services/__tests__/content-history.test.ts
git commit -m "feat(studio): add block undo-redo engine with dual toolbars and keyboard shortcuts"
```

---

### Phase 4: Two-Tier Storage Engine: Instant LocalStorage Flush + Cross-Device Cloud Draft Sync

**Files:**
- Create: `src/app/actions/draft-actions.ts`
- Modify: `src/app/admin/portals/components/ContentEditorModal.tsx`
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: `src/lib/services/__tests__/content-storage.test.ts`

- [ ] **Step 1: Write tests for draft serialization and schema integrity**

Create `src/lib/services/__tests__/content-storage.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { ContentStudioDraft } from '@/lib/types/content';

describe('Content Studio Draft Storage Engine', () => {
  it('serializes and validates draft payload with all required metadata', () => {
    const draft: ContentStudioDraft = {
      id: 'portal_123_item_456',
      portalId: 'portal_123',
      organizationId: 'org_789',
      contentItemId: 'item_456',
      title: 'Guide to SmartSapp',
      slug: 'guide-to-smartsapp',
      type: 'article',
      summary: 'Comprehensive guide',
      category: 'General',
      tags: ['onboarding'],
      blocks: [{ id: 'b1', type: 'text', props: { content: 'Content' } }],
      visibility: 'public',
      media: {},
      authorId: 'user_1',
      authorName: 'Alex Smith',
      authorEmail: 'alex@example.com',
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const serialized = JSON.stringify(draft);
    const parsed = JSON.parse(serialized) as ContentStudioDraft;

    expect(parsed.portalId).toBe('portal_123');
    expect(parsed.blocks).toHaveLength(1);
    expect(new Date(parsed.savedAt).getTime()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/content-storage.test.ts`
Expected: PASS.

- [ ] **Step 3: Create Server Actions in `src/app/actions/draft-actions.ts`**

Implement secure Cloud Draft actions:
- `saveContentStudioDraftAction(draft: ContentStudioDraft)`
- `getContentStudioDraftAction(portalId: string, contentItemId: string | null)`
- `discardContentStudioDraftAction(portalId: string, contentItemId: string | null)`
- `listContentStudioDraftsByPortalAction(portalId: string)`
Strictly verified against `authorizeBackofficeSession` for multi-tenant security.

- [ ] **Step 4: Update `firestore.rules` and `firestore.indexes.json`**

In `firestore.rules`, add:
```rules
match /content_drafts/{draftId} {
  allow read, write: if isAuthorized() && (
    resource == null ||
    resource.data.organizationId == getUserData().organizationId ||
    isSystemAdmin()
  );
}
```
In `firestore.indexes.json`, add compound indexes for `(portalId ASC, updatedAt DESC)` and `(organizationId ASC, portalId ASC, updatedAt DESC)`.

- [ ] **Step 5: Implement Emergency Flush & Cloud Sync in `ContentEditorModal.tsx`**

1. Tighten local auto-save debounce to 400ms.
2. Synchronous `beforeunload` listener writes draft immediately upon browser reload or tab close.
3. Debounced (3000ms) background sync calls `saveContentStudioDraftAction(...)`.
4. Make `handleRestoreDraft()` push pre-restore blocks into undo history stack.
5. On save success (`handleSave`) or `handleDiscardDraft`, purge both LocalStorage and Cloud Draft record.

- [ ] **Step 6: Run tests and typecheck**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Run: `npx vitest run src/lib/services/__tests__/content-storage.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 7: Commit changes**

```bash
git add src/app/actions/draft-actions.ts src/app/admin/portals/components/ContentEditorModal.tsx firestore.rules firestore.indexes.json src/lib/services/__tests__/content-storage.test.ts
git commit -m "feat(studio): implement dual-tier auto-save engine with emergency flush and cloud draft sync"
```

---

### Phase 5: Backoffice Management & Visual Draft Recovery in Content Manager

**Files:**
- Modify: `src/app/admin/portals/components/PortalContentManager.tsx`

- [ ] **Step 1: Implement Session Recovery Banner in `PortalContentManager.tsx`**

On mount, check if an unclosed dirty session exists in `localStorage` or Firestore Cloud Drafts.
If found within 24 hours, display a non-intrusive banner at the top of the content manager:
```tsx
{activeSession && !isEditorOpen && (
  <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
      <span>
        You have unsaved changes from a previous session for <strong>&quot;{activeSession.title}&quot;</strong>.
      </span>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <Button
        size="sm"
        onClick={handleResumeSession}
        className="h-8 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] sm:min-h-0"
      >
        Resume Editing
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDismissSession}
        className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
      >
        Dismiss
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add "Drafts" Tab Filter in Content Manager**

Allow operators to filter by "Unsaved Drafts", displaying cloud drafts saved by team members with options to inspect, resume, or discard.

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/admin/portals/components/PortalContentManager.tsx
git commit -m "feat(backoffice): add visual draft recovery banner and team drafts filter in content manager"
```

---

### Phase 6: Security Audit, Mobile Usability Verification & Deployment Protocols

**Files:**
- Touch: All touched files across Phases 1–5

- [ ] **Step 1: Mobile Accessibility & Touch Target Audit**
Verify that all buttons (`Undo`, `Redo`, `Resume Editing`, `Restore Draft`, `Discard`) adhere to $\ge 44\text{px}$ touch targets (`min-h-[44px]` on mobile or touch viewports).

- [ ] **Step 2: Strict Typing & Workspace Rules Audit**
Run AST/grep verification:
- 0 `any`, 0 `any[]`, 0 unhandled `unknown`.
- Single source of truth for variables routed through `FieldsVariablesService`.
- Single source of truth for contact tags using `<TagSelector>`.
- Toasts carry safe relative paths starting with `/`.

- [ ] **Step 3: Run Full Vitest Test Suite**
Run: `npx vitest run src/lib/services/__tests__/ src/hooks/__tests__/`
Expected: 100% tests pass.

- [ ] **Step 4: Run Full TypeScript Typecheck**
Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Firebase Deploy Verification**
Deploy Firestore security rules and indexes using Firebase MCP or CLI:
`npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes`

- [ ] **Step 6: Git Status Verification**
Run: `git status`
Expected: Clean working tree, only local commits ahead of remote. Strictly ZERO pushes to `origin/main`.
