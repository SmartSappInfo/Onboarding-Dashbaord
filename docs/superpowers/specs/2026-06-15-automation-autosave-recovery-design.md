# Design Spec: Local Storage Autosave & Backup Recovery for Automation Builder

**Author**: Antigravity  
**Date**: 2026-06-15  
**Status**: Proposal  

---

## 1. Objective
Implement a client-side `localStorage` autosave and restore recovery mechanism in the automation workflow builder edit page. This prevents user work loss in the event of browser crashes, power failures, or accidental tab closures.

## 2. Architecture

We decouple serialization/storage concerns from React lifecycle concerns.

```
+-----------------------------------------------------------+
|                                                           |
|             EditAutomationPage (page.tsx)                 |
|                                                           |
+-----------------------------+-----------------------------+
                              |
                     uses custom hook
                              |
                              v
+-----------------------------------------------------------+
|                                                           |
|         useAutomationAutosave (React Hook)                |
|                                                           |
+-----------------------------+-----------------------------+
                              |
                        uses utility
                              |
                              v
+-----------------------------------------------------------+
|                                                           |
|          automation-storage.ts (Storage Utility)           |
|                                                           |
+-----------------------------------------------------------+
```

### 2.1 Storage Schema (`src/lib/automation-storage.ts`)
The storage schema is versioned to allow migrations. To conserve storage space, the payload is minimized by preserving only essential workflow properties.

```typescript
export interface AutomationBackup {
  version: number;
  name: string;
  description: string;
  triggers: any[];
  nodes: any[];
  edges: any[];
  timestamp: string;      // ISO 8601 Date String
  dbUpdatedAt: string;    // The updatedAt value of the doc when it was fetched
}
```

* Minimization Rules:
  * Nodes: Select only `{ id, type, position, data }`. Strip dynamic visual markers or sizing computations computed by React Flow during render.
  * Edges: Select only `{ id, source, target, sourceHandle, targetHandle, type }`.

### 2.2 Autosave Hook (`useAutomationAutosave.ts`)
Operates statefully inside the editor page.
* **Mount-time Restoration Detection**:
  * Run once during mounting (via `useEffect`).
  * If a backup is found in `localStorage`:
    * If `backup.timestamp > database.updatedAt` AND `backup.dbUpdatedAt === database.updatedAt`, it is considered a valid unsaved backup. Trigger the recovery dialog.
    * If `database.updatedAt > backup.timestamp` or `backup.dbUpdatedAt !== database.updatedAt`, the database version has progressed elsewhere. Discard the stale backup immediately.
* **Debounced Autosave**:
  * Watch `currentData` state.
  * If `isDirty` is true and the workflow is not archived, start a 1000ms timer to call `saveAutomationBackup`.
  * If `currentData` changes again before the timer expires, clear and restart the timer to avoid canvas performance bottlenecks.

### 2.3 Visual Builder Re-Mounting
To update React Flow nodes and edges upon restoration:
* A `builderKey` counter is exposed by the custom hook.
* When the user clicks "Restore", the hook updates the page's `currentData` state and increments `builderKey`.
* In `page.tsx`, we render:
  `<AutomationBuilder key={builderKey} ... />`
* Changing `key` forces React to cleanly unmount the previous instance and initialize a new instance with the restored nodes/edges.

---

## 3. UI/UX Specifications

### 3.1 Recovery Dialog
* **Layout**: A centered overlay dialog (`DialogContent` from `@/components/ui/dialog`).
* **Visual Styling**: Glassmorphic panel using `rounded-3xl border border-border/20 shadow-2xl bg-card/90 backdrop-blur-md p-6 max-w-md animate-in fade-in zoom-in-95 duration-200`.
* **Details Panel**: Shows a helper badge with the date/time of the backup.
* **Buttons**:
  * **Restore Backup** (Primary): Styled with a soft brand color button (`bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`).
  * **Discard Backup** (Secondary): Destructive ghost styling (`text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200`).

---

## 4. Verification & Testing

### 4.1 Unit Testing Strategy
`src/lib/automation-storage.ts` can be tested in isolation using Jest/Vitest:
* Validate serialization drops visual properties.
* Validate versioning mismatches are correctly discarded.
* Validate timestamps parsing.

### 4.2 Manual Verification Scenario
1. Edit an automation, check DevTools to verify `automation-autosave-[id]` is updated.
2. Hard reload the page. Verify the Recovery Dialog renders and matches the premium design tokens.
3. Click restore. Verify node layout updates on canvas and the page is marked as dirty.
4. Save the automation. Verify the backup is cleared from local storage.
