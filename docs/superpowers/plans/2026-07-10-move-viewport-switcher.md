# Page Builder Viewport Switcher Move & AI Button Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the viewport device preview switcher (Desktop, Tablet, Mobile) from the floating bottom-right corner of the canvas to the top actions header bar right next to the Edit/Preview switcher. In addition, design the floating AI Sparkles button to stand out with a premium, glowing gradient aesthetic and label.

**Architecture:**
- Render the viewport switcher buttons in `BuilderClient.tsx` with selectors triggering `builder.dispatch({ type: 'SET_VIEWPORT', payload: v })`.
- Remove the viewport switcher from the floating bottom-right box in `Canvas.tsx`.
- Enhance the AI button classes in `Canvas.tsx` to use glowing gradients, ring styles, and an explicit text label.

---

## 1. Bite-Sized Implementation Tasks

### Task 1: Refactor Viewport Switcher in BuilderClient.tsx

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/BuilderClient.tsx`

- [ ] **Step 1: Add viewport icon imports if missing**
  Ensure `MonitorPlay`, `Tablet`, and `Smartphone` are imported from `lucide-react`.

- [ ] **Step 2: Add Viewport/Device Switcher component markup**
  Insert the device switcher buttons in `BuilderClient.tsx` next to the Edit/Preview Switcher (around line 642):
  ```typescript
  {/* Viewport/Device Switcher */}
  <div className="flex items-center gap-0.5 bg-slate-800/40 p-0.5 rounded-xl border border-slate-700/30">
      <Button
          variant="ghost" size="icon"
          onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'desktop' })}
          className={cn(
              "h-7 w-7 p-0 rounded-lg transition-all border-0",
              builder.viewport === 'desktop' ? "bg-slate-750 shadow-sm text-blue-400 hover:text-blue-400" : "bg-transparent text-slate-500 hover:text-slate-355"
          )}
          title="Desktop View"
      >
          <MonitorPlay className="w-3.5 h-3.5" />
      </Button>
      <Button
          variant="ghost" size="icon"
          onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'tablet' })}
          className={cn(
              "h-7 w-7 p-0 rounded-lg transition-all border-0",
              builder.viewport === 'tablet' ? "bg-slate-750 shadow-sm text-blue-400 hover:text-blue-400" : "bg-transparent text-slate-500 hover:text-slate-355"
          )}
          title="Tablet View"
      >
          <Tablet className="w-3.5 h-3.5" />
      </Button>
      <Button
          variant="ghost" size="icon"
          onClick={() => builder.dispatch({ type: 'SET_VIEWPORT', payload: 'mobile' })}
          className={cn(
              "h-7 w-7 p-0 rounded-lg transition-all border-0",
              builder.viewport === 'mobile' ? "bg-slate-750 shadow-sm text-blue-400 hover:text-blue-400" : "bg-transparent text-slate-500 hover:text-slate-355"
          )}
          title="Mobile View"
      >
          <Smartphone className="w-3.5 h-3.5" />
      </Button>
  </div>
  ```

### Task 2: Refactor Toolbar in Canvas.tsx

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx`

- [ ] **Step 1: Remove viewport triggers from the floating bar**
  Remove lines 2173 to 2210 in `Canvas.tsx`.

- [ ] **Step 2: Redesign the AI Sparks button**
  Replace lines 2212 to 2225 with a premium layout that stands out:
  ```typescript
  <Button
      onClick={() => setIsAiChatOpen(prev => !prev)}
      className={cn(
          "h-8 px-3 rounded-lg transition-all border-0 font-bold text-xs flex items-center gap-1.5 text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:shadow-[0_0_22px_rgba(124,58,237,0.5)] hover:scale-[1.03] active:scale-[0.97] duration-200 cursor-pointer select-none",
          isAiChatOpen && "ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900"
      )}
      variant="ghost"
      title="Experience Copilot (AI)"
  >
      <Sparkles className="h-3.5 h-3.5 animate-pulse" />
      <span>Ask AI</span>
  </Button>
  ```

---

## 2. Verification Plan

### Automated Coverage
- Run compilation checks and full vitest suite check:
  Run: `pnpm verify`
  Expected: 0 TS errors, all tests passing.
