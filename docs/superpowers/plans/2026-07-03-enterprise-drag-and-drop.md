# Enterprise Drag-and-Drop Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the page builder drag-and-drop interaction model to match Figma, Webflow, and Canva industry standards, ensuring the actual component is visible during dragging with smooth overlays and green-accented responsive drop target animations.

**Architecture:** Utilize dnd-kit's `DragOverlay` to render exact component clones instead of textual placeholders. Set source elements to a 35% opacity blur state when active. Render animated green-themed dashed indicator containers for valid drop destinations.

**Tech Stack:** React, Tailwind CSS, dnd-kit, Lucide Icons, TypeScript

---

## Proposed Changes

### Task 1: Lift & Ghost element visibility (Original Location)

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Update SortableBlock drag classes**
  Modify the `SortableBlock` className binding inside `src/app/admin/pages/[id]/builder/components/Canvas.tsx` so that it renders a 35% opacity ghost element with a 1px blur filter during active drags.
  ```typescript
  // Replace:
  selected && !isPreview && "ring-2 ring-blue-500/80 border-solid border-blue-500/50 bg-blue-500/5",
  isDragging && "z-50 shadow-2xl bg-slate-800/80"
  
  // With:
  selected && !isPreview && "ring-2 ring-blue-500/80 border-solid border-blue-500/50 bg-blue-500/5",
  isDragging && "opacity-35 blur-[1px] pointer-events-none select-none"
  ```

- [ ] **Step 2: Commit Task 1**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: implement 35% opacity blur ghost state for active drag blocks"
  ```

---

### Task 2: High-Fidelity Drag Proxy Clones

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Refactor block drag overlay view**
  Refactor the `<DragOverlay>` block case inside `src/app/admin/pages/[id]/builder/components/Canvas.tsx` so that dragging a block renders the actual `<BlockRenderer>` directly, wrapped in a container that applies an elevated shadow, a scale of `1.01`, and `98%` opacity without extra text frames.
  ```typescript
  // Replace:
  activeBlock ? (
      <div className="opacity-75 bg-white dark:bg-slate-900 border border-emerald-500/50 shadow-2xl rounded-xl p-4 pointer-events-none scale-95 origin-center transition-transform max-w-sm overflow-hidden select-none">
          <div className="text-[8px] font-black uppercase text-emerald-500 tracking-widest mb-2 flex items-center gap-1.5">
              <PlusSquare className="w-3.5 h-3.5" />
              Dragging component ({activeBlock.type})
          </div>
          <div className="pointer-events-none">
              <BlockRenderer block={activeBlock} ctx={editCtx(activeBlock.id)} />
          </div>
      </div>
  )
  
  // With:
  activeBlock ? (
      <div className="opacity-[0.98] shadow-[0_18px_45px_rgba(0,0,0,0.25)] scale-[1.01] pointer-events-none select-none max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl overflow-hidden">
          <BlockRenderer block={activeBlock} ctx={editCtx(activeBlock.id)} />
      </div>
  )
  ```

- [ ] **Step 2: Commit Task 2**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: render exact block previews inside DragOverlay"
  ```

---

### Task 3: Green-Themed Pulsing Drop Target Animations

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Redesign ColumnCell Empty Target view**
  Refactor the empty column indicator inside `src/app/admin/pages/[id]/builder/components/Canvas.tsx` to match the Webflow-like dropzone specification:
  - Green dashed border (`border-emerald-500`).
  - Green gradient glow, pulse scale animation (`animate-pulse`).
  - Drop icon and descriptive caption text.
  ```typescript
  // Replace:
  isOver && activeDragId && !activeDragId.startsWith('col-') && !activeDragId.startsWith('section-') ? (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-emerald-500/10 border-2 border-dashed border-emerald-500 rounded-xl text-emerald-600 dark:text-emerald-400 select-none animate-pulse transition-all duration-300">
          <PlusSquare className="w-5 h-5 mb-1 text-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-wider">Drop here...</p>
      </div>
  )
  
  // With:
  isOver && activeDragId && !activeDragId.startsWith('col-') && !activeDragId.startsWith('section-') ? (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-emerald-500/10 border-2 border-dashed border-emerald-500 rounded-xl text-emerald-600 dark:text-emerald-400 select-none shadow-[0_0_20px_rgba(16,185,129,0.15)] scale-[1.01] animate-pulse transition-all duration-200">
          <PlusSquare className="w-6 h-6 mb-2 text-emerald-500" />
          <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Drop Here</p>
          <p className="text-[10px] text-emerald-500 mt-1">Release to place component</p>
      </div>
  )
  ```

- [ ] **Step 2: Commit Task 3**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: implement pulsing green drop-here indicator for empty columns"
  ```

---

### Task 4: Valid/Invalid Drop Zone Indicators

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Show thin bottom drop target indicators in columns**
  Ensure that when a column has blocks and is being hovered over, the thin insertion bar also utilizes the green glow theme:
  ```typescript
  // Replace:
  {isOver && activeDragId && !blockIds.includes(activeDragId) && !activeDragId.startsWith('col-') && !activeDragId.startsWith('section-') && blocks.length > 0 && (
      <div className="w-full py-2 bg-emerald-500/10 border border-dashed border-emerald-400 rounded-lg text-center text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider animate-pulse transition-all">
          Drop here...
      </div>
  )}
  
  // With:
  {isOver && activeDragId && !blockIds.includes(activeDragId) && !activeDragId.startsWith('col-') && !activeDragId.startsWith('section-') && blocks.length > 0 && (
      <div className="w-full py-3 bg-emerald-500/10 border border-dashed border-emerald-500 rounded-lg text-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.1)] animate-pulse transition-all">
          Drop here to place component
      </div>
  )}
  ```

- [ ] **Step 2: Commit Task 4**
  ```bash
  git add src/app/admin/pages/[id]/builder/components/Canvas.tsx
  git commit -m "feat: design dynamic bottom drop indicators for populated columns"
  ```

---

## Verification Plan

### Automated Tests
Verify that all changes build correctly and compile without type errors:
```bash
npx tsc --noEmit
```

### Manual Verification
- Drag a component inside the page builder.
- Confirm the original element becomes transparent (35% opacity) and slightly blurred.
- Confirm the drag preview follows the cursor 1:1 without extra text overlays or sizing alterations.
- Verify the drop target pulses green (#22C55E) when a valid drop container is hovered over.
