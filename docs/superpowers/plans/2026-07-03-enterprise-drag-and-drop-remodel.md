# Enterprise Drag-and-Drop Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remodel the drag-and-drop process to support live cross-column and cross-section layout reflowing (instant sorting on hover) in real-time at 60 FPS, matching Figma and Webflow editor standards.

**Architecture:** Implement a local transient layout structure state `dragStructure` inside `Canvas.tsx`. On active drag, compute live state transformations using `onDragOver` and tree translation operations. On drop, write the finalized structure back to the parent state and database.

**Tech Stack:** React, dnd-kit, TypeScript, CampaignPageStructure tree operations

---

## User Review Required

### What Could Go Wrong & Resolutions
1. **React State Update Lag / Jitter (Waterfalls & Lag)**
   - *Risk*: Modifying the layout tree state synchronously on every pointer move event can cause UI frame lag, dropping the page refresh rate below 60 FPS.
   - *Resolution*: Wrap the local transient state update `setDragStructure` inside a React `startTransition` wrapper (`rerender-transitions` guideline). This ensures browser input events (cursor movements) take immediate priority and prevents rendering blocking.
2. **Infinite Drag-Over Update Loop**
   - *Risk*: Moving a component inside a list triggers a state change, which shifts the item rectangles, which might trigger another `onDragOver` event at the same pointer coordinates, causing an infinite loop.
   - *Resolution*: Validate if the computed destination coordinates and indices differ from the current position before triggering `setDragStructure`.
3. **TypeScript Type Safety**
   - *Risk*: `dnd-kit` events default to relaxed typings or `any`, which violates strict typing rules.
   - *Resolution*: Explicitly import and type all event parameters (e.g., `DragOverEvent` and `DragEndEvent` from `@dnd-kit/core`). Avoid all occurrences of `any` and `any[]`.
4. **Collision Clashing between Sections, Columns, and Blocks**
   - *Risk*: Since we allow dragging blocks, sections, and columns concurrently, collision detection could confuse a block drag with a section or column container.
   - *Resolution*: Use the custom collision detection strategy (`customCollisionDetection`) inside `Canvas.tsx` to filter containers based on what is being dragged (e.g. if dragging a block, ignore section-level droppable zones).

---

## Affected Features & Mitigation

1. **Undo/Redo History Stack**
   - *Issue*: Storing intermediate states during drag movement in the history list will flood the undo/redo stack, forcing the user to press undo 50 times to revert a single drag.
   - *Mitigation*: Perform all live sorting reflows on the local `dragStructure` state. Do not update the parent page version state history until `onDragEnd` (pointer release) commits the final position.
2. **Collaborative Pinned Comments**
   - *Issue*: Pinned comments absolute positioning might overlap with shifting block margins when elements reflow.
   - *Mitigation*: Ensure comment pins are recalculated relative to their parent block element boundaries or fade out pins temporarily during active drag.
3. **Mobile & Tablet Viewports**
   - *Issue*: Touch events on mobile/tablet might conflict with screen scrolling.
   - *Mitigation*: Leverage passive touch listeners and disable viewport panning when an active drag handles captures a pointer.
4. **Page Settings & Templates Save**
   - *Issue*: If the user saves a section template while dragging, the template might save the intermediate reflowed layout.
   - *Mitigation*: Disable section settings panels and template save actions while `activeDragId` is set.

---

## Firebase & Firestore Specifications

### 1. Security Rules (`firestore.rules`)
The database writes are made by committing the finalized structure back to the `campaign_page_versions` collection. The relevant security rules are already fully configured in `firestore.rules`:
```javascript
match /campaign_page_versions/{vId} {
  allow get: if isAuthorized() && (isSystemAdmin() || isOrgMatch(resource.data.organizationId));
  allow list: if isAuthorized();
  allow write: if isAuthorized() && (isSystemAdmin() || hasPermission('studios_edit'));
}
```
*Action*: No rules changes are required since the data schema structure matches existing formats.

### 2. Indexes (`firestore.indexes.json`)
The builder uses direct document references (lookup by document ID) for versions, which are indexed automatically by Firestore. No compound indexes are required.

---

## Proposed Changes

### Task 1: Type-Safe Transient Drag States & Canvas Setup

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Update type imports and declare dragStructure state**
  Add imports for `CampaignPageStructure` and `DragOverEvent` inside `src/app/admin/pages/[id]/builder/components/Canvas.tsx`, and declare `dragStructure` state properly typed.
  ```typescript
  // Modify imports:
  import {
      DndContext,
      closestCenter,
      KeyboardSensor,
      PointerSensor,
      useSensor,
      useSensors,
      type DragEndEvent,
      type DragOverEvent,
      useDroppable,
      type CollisionDetection,
      DragOverlay,
  } from '@dnd-kit/core';
  
  import type { PageSection, PageBlock, CampaignPageVersion, ResolvedTheme, BuilderResources, CampaignPageStructure } from '@/lib/types';
  import { moveBlockToColumn } from '@/lib/page-builder/tree-operations';
  ```

- [ ] **Step 2: Add state declarations avoiding any**
  ```typescript
  // Around line 515:
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragStructure, setDragStructure] = useState<CampaignPageStructure | null>(null);
  ```

- [ ] **Step 3: Direct the main canvas container rendering loop to use the dynamic activeStructure**
  ```typescript
  // Around line 970:
  const activeStructure = dragStructure || version.structureJson;
  // Map sections using activeStructure:
  activeStructure.sections.length > 0 ? (
      activeStructure.sections.map((section, idx) => {
  ```

- [ ] **Step 4: Commit Task 1**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: setup typed dragStructure state and point rendering loop to it"
  ```

---

### Task 2: Live DragOver Sorting Reflow with Transition Priority

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Implement handleDragOver with strict typings (no any/any[])**
  Write the type-safe `handleDragOver` function to perform real-time tree structure alterations when dragging blocks across columns and sections. Use `React.startTransition` for 60 FPS scrolling and cursor tracking.
  ```typescript
  const handleDragOver = (event: DragOverEvent): void => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Only reflow layout for block dragging
      if (activeId.startsWith('section-') || activeId.startsWith('col-') || !activeId.includes('-')) return;

      const currentStruct = dragStructure || version.structureJson;
      let targetSectionId = '';
      let targetColIdx = 0;
      let targetBlockIndex = 0;

      if (overId.startsWith('col-')) {
          const parts = overId.split('-');
          targetSectionId = parts.slice(1, -1).join('-');
          targetColIdx = parseInt(parts[parts.length - 1], 10);
          const targetSection = currentStruct.sections.find(s => s.id === targetSectionId);
          if (!targetSection) return;
          const colBlocks = targetSection.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
          targetBlockIndex = colBlocks.length;
      } else if (overId.startsWith('section-') || !overId.includes('-')) {
          targetSectionId = overId;
          targetColIdx = 0;
          targetBlockIndex = 0;
      } else {
          let found = false;
          for (const sec of currentStruct.sections) {
              const bIdx = sec.blocks.findIndex(b => b.id === overId);
              if (bIdx !== -1) {
                  targetSectionId = sec.id;
                  const overBlock = sec.blocks[bIdx];
                  targetColIdx = ((overBlock.props || {}) as { column?: number }).column ?? 0;

                  const colBlocks = sec.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
                  targetBlockIndex = colBlocks.findIndex(b => b.id === overId);
                  found = true;
                  break;
              }
          }
          if (!found) return;
      }

      // Check if location has changed
      let sourceSectionId = '';
      let sourceColIdx = 0;
      for (const sec of currentStruct.sections) {
          const bIdx = sec.blocks.findIndex(b => b.id === activeId);
          if (bIdx !== -1) {
              sourceSectionId = sec.id;
              sourceColIdx = ((sec.blocks[bIdx].props || {}) as { column?: number }).column ?? 0;
              break;
          }
      }

      if (sourceSectionId === targetSectionId && sourceColIdx === targetColIdx) {
          const colBlocks = currentStruct.sections.find(s => s.id === sourceSectionId)?.blocks.filter(b => ((b.props || {}) as { column?: number }).column === sourceColIdx) || [];
          const activeColIdx = colBlocks.findIndex(b => b.id === activeId);
          if (activeColIdx !== -1 && activeColIdx !== targetBlockIndex) {
              const sec = currentStruct.sections.find(s => s.id === sourceSectionId);
              if (sec) {
                  const actualActiveIdx = sec.blocks.findIndex(b => b.id === activeId);
                  const targetBlockId = colBlocks[targetBlockIndex]?.id;
                  const actualTargetIdx = targetBlockId ? sec.blocks.findIndex(b => b.id === targetBlockId) : sec.blocks.length;

                  if (actualActiveIdx !== -1 && actualTargetIdx !== -1) {
                      React.startTransition(() => {
                          const newSections = currentStruct.sections.map(s => {
                              if (s.id !== sourceSectionId) return s;
                              const newBlocks = [...s.blocks];
                              const [removed] = newBlocks.splice(actualActiveIdx, 1);
                              newBlocks.splice(actualTargetIdx, 0, removed);
                              return { ...s, blocks: newBlocks };
                          });
                          setDragStructure({ ...currentStruct, sections: newSections });
                      });
                  }
              }
          }
      } else {
          React.startTransition(() => {
              const updated = moveBlockToColumn(currentStruct, activeId, targetSectionId, targetColIdx, targetBlockIndex);
              setDragStructure(updated);
          });
      }
  };
  ```

- [ ] **Step 2: Bind handlers inside DndContext**
  Bind the drag handlers strictly:
  ```typescript
  // Inside DndContext props:
  onDragStart={(e) => {
      setActiveDragId(e.active.id as string);
      setDragStructure(JSON.parse(JSON.stringify(version.structureJson)));
  }}
  onDragOver={handleDragOver}
  onDragCancel={() => {
      setActiveDragId(null);
      setDragStructure(null);
  }}
  ```

- [ ] **Step 3: Commit Task 2**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: implement type-safe onDragOver layout reflowing with transition support"
  ```

---

### Task 3: Finalize layout state on Drag End

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Update handleDragEnd parameters and logic**
  Update the signature and drag release committing inside `handleDragEnd`:
  ```typescript
  // Replace:
  const handleDragEnd = (event: DragEndEvent) => {
  
  // With:
  const handleDragEnd = (event: DragEndEvent): void => {
  ```
  And replace the block dragging commit block:
  ```typescript
  // Replace:
  onMoveBlockToColumn(activeId, targetSectionId, targetColIdx, targetBlockIndex);
  
  // With:
  if (dragStructure) {
      let targetSectionId = '';
      let targetColIdx = 0;
      let targetBlockIndex = 0;
      for (const sec of dragStructure.sections) {
          const bIdx = sec.blocks.findIndex(b => b.id === activeId);
          if (bIdx !== -1) {
              targetSectionId = sec.id;
              targetColIdx = ((sec.blocks[bIdx].props || {}) as { column?: number }).column ?? 0;
              const colBlocks = sec.blocks.filter(b => ((b.props || {}) as { column?: number }).column === targetColIdx);
              targetBlockIndex = colBlocks.findIndex(b => b.id === activeId);
              break;
          }
      }
      if (targetSectionId) {
          onMoveBlockToColumn(activeId, targetSectionId, targetColIdx, targetBlockIndex);
      }
  }
  setDragStructure(null);
  ```

- [ ] **Step 2: Commit Task 3**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: finalize dragState changes on pointer release"
  ```

---

## Verification Plan

### Automated Tests
Run type checking compiler script:
```bash
npx tsc --noEmit
```

### Manual Verification
- Drag a component across columns and sections.
- Verify elements shift out of the way dynamically at 60 FPS.
- Cancel the drag by pressing ESC or dragging outside and verify elements return to their initial coordinates without any layout shift.
