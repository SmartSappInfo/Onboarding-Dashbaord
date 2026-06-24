# Call Script Builder Undo/Redo & Deletion Choice Design Specification

## Overview

This specification details the design for introducing **Undo/Redo** capabilities and **Step Deletion Choices** inside the Call Script Builder. Both features provide high-fidelity control over the script building workflow:

1. **Undo/Redo:** Revert and re-apply mutations (in Visual Flow, List View, and Legacy Text tabs) using toolbar controls or standard keyboard shortcuts (`Cmd+Z`/`Cmd+Y`).
2. **Step Deletion Choices:** Prompt the user to choose between deleting only the target step or the entire downstream conversation branch (subtree) connected to it.

---

## 1. Undo/Redo Architecture & Data Flow

### State Snapshot Definition
The state history is tracked via a unified snapshot model containing the flowchart graph structure and fallback legacy plain text:

```typescript
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
  legacyText: string;
}
```

### Centralized History Manager
We implement an in-memory history stack inside `ScriptBuilderClient.tsx` using React refs to bypass unnecessary re-renders during state mutations, exposing only status booleans to toggle UI controls.

```typescript
// Refs for stack control
const historyRef = React.useRef<HistoryState[]>([]);
const pointerRef = React.useRef<number>(-1);
const isUndoingRedoingRef = React.useRef<boolean>(false);
const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

// State for UI button toggles
const [canUndo, setCanUndo] = React.useState(false);
const [canRedo, setCanRedo] = React.useState(false);
```

### Push and Debounce Strategy
- **Continuous Changes (Debounced):** Actions like dragging nodes, panning/zooming, or typing in the dialogue script textareas will trigger a debounced push (waits for $500\text{ms}$ of silence).
- **Discrete Changes (Immediate):** Actions like adding a node, deleting a node, cloning a node, connecting an edge, deleting an edge, or converting a plain text script to a graph will clear any pending debounce timer and push to history immediately.

#### Mutation Comparison
Before any push is committed, the new snapshot is compared with the current state at `historyRef.current[pointerRef.current]`. If all fields are identical, the push is discarded, preventing duplicate snapshots.

---

## 2. Deletion Choice Dialog Architecture

When a user deletes a step, the builder must verify if it has any downstream connected paths:
- If a step is deleted, we present a Radix UI Dialog asking the user to decide the scope of the deletion.
- **Delete Step Only:** Removes the target node and its directly connected edges. Parents and children are left disconnected (or users can re-wire manually).
- **Delete Step & Subtree:** Recursively collects all child nodes of the target node using a DFS/BFS traversal, then filters out all collected node IDs and their associated edges from the graph.

---

## UI Design & Animations

### 1. Header Toolbar Undo/Redo Buttons
- **Undo Button:** `Undo2` icon. Enabled when `canUndo` is true. Clicking calls `handleUndo()`.
- **Redo Button:** `Redo2` icon. Enabled when `canRedo` is true. Clicking calls `handleRedo()`.
- Scale transitions on click: `active:scale-95 transition-all duration-150`.

### 2. Dialog Component Integrations
- Dialog overlays will be styled with backdrop blur (`backdrop-blur-sm bg-black/60`).
- Content boxes will slide and zoom in smoothly: `animate-in fade-in zoom-in-95 duration-200`.

---

## Verification Plan

### Automated Tests
Write unit tests in `src/lib/__tests__/call-centre-history.test.ts` verifying:
1. Pushing states increments the pointer and clears redo paths.
2. Undoing/Redoing correctly shifts pointer indexes and returns appropriate nodes/edges payloads.
3. Subtree deletion recursively gathers all downstream descendant nodes.
