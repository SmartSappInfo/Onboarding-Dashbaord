# Page Builder Independent sidebars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Page Builder sidebars expansion state in `BuilderClient.tsx` to handle the left side panels and the right properties panel independently.

**Architecture:** We declare separate React states (`isLeftSidebarExpanded`, `isRightSidebarExpanded`), connect them to their respective sidebar width transitions, introduce a central `useEffect` hook to expand sidebars on programmatic tab switches, and add a dedicated close trigger to the right panel header.

---

## 1. Bite-Sized Implementation Tasks

### Task 1: Refactor Sidebar States in BuilderClient.tsx

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/BuilderClient.tsx`

- [ ] **Step 1: Declare independent expansion states**
  Replace line 251 in `BuilderClient.tsx` (the old `isSidebarExpanded` state) with:
  ```typescript
  const [isLeftSidebarExpanded, setIsLeftSidebarExpanded] = useState(true);
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true);
  ```

- [ ] **Step 2: Add centralized tab expansion hook**
  Add a `useEffect` hook to expand the active panel when `builder.activeTab` changes:
  ```typescript
  // Expand corresponding sidebar when tab is changed programmatically
  useEffect(() => {
      if (builder.activeTab === 'edit') {
          setIsRightSidebarExpanded(true);
      } else {
          setIsLeftSidebarExpanded(true);
      }
  }, [builder.activeTab]);
  ```

- [ ] **Step 3: Refactor vertical tab bar buttons**
  Replace vertical tab button mapping onClick and active checks (lines 784 to 810) to read/write respective sidebar expand states:
  ```typescript
  {tabs.map(tab => {
      const isActive = builder.activeTab === tab.id;
      const isExpanded = tab.id === 'edit' ? isRightSidebarExpanded : isLeftSidebarExpanded;
      return (
          <button
              key={tab.id}
              type="button"
              onClick={() => {
                  if (tab.id === 'edit') {
                      if (builder.activeTab === 'edit' && isRightSidebarExpanded) {
                          setIsRightSidebarExpanded(false);
                      } else {
                          builder.dispatch({ type: 'SET_TAB', payload: 'edit' });
                          setIsRightSidebarExpanded(true);
                      }
                  } else {
                      if (builder.activeTab === tab.id && isLeftSidebarExpanded) {
                          setIsLeftSidebarExpanded(false);
                      } else {
                          builder.dispatch({ type: 'SET_TAB', payload: tab.id });
                          setIsLeftSidebarExpanded(true);
                      }
                  }
              }}
              className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-xl text-[7px] font-black uppercase tracking-wider transition-all duration-200 w-full border border-transparent",
                  isActive && isExpanded
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "text-slate-500 hover:text-slate-355 hover:bg-slate-900/50"
              )}
              title={tab.label}
          >
              <tab.icon className="w-4 h-4 shrink-0" />
          </button>
      );
  })}
  ```

- [ ] **Step 4: Refactor left vertical bar bottom chevron button**
  Replace bottom expand/collapse button onClick and icon rendering checks (lines 811 to 818) to read/write active sidebar state:
  ```typescript
  <button
      type="button"
      onClick={() => {
          if (builder.activeTab === 'edit') {
              setIsRightSidebarExpanded(prev => !prev);
          } else {
              setIsLeftSidebarExpanded(prev => !prev);
          }
      }}
      className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-300 transition-all active:scale-[0.97]"
  >
      {builder.activeTab === 'edit'
          ? (isRightSidebarExpanded ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />)
          : (isLeftSidebarExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
      }
  </button>
  ```

- [ ] **Step 5: Refactor left and right panel widths**
  * Update left panel width check in `BuilderClient.tsx` to read `isLeftSidebarExpanded`:
    ```typescript
    isLeftSidebarExpanded && builder.activeTab !== 'edit' ? "w-72 opacity-100" : "w-0 opacity-0 border-r-0"
    ```
  * Update right panel width check in `BuilderClient.tsx` to read `isRightSidebarExpanded`:
    ```typescript
    isRightSidebarExpanded && builder.activeTab === 'edit' ? "w-72 opacity-100 border-l-border" : "w-0 opacity-0 border-l-0"
    ```

- [ ] **Step 6: Add dedicated collapse trigger in the right panel header**
  In the right side panel element (around line 1020), add a small title bar with close chevron button:
  ```typescript
  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2 select-none">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Properties</span>
      <button
          type="button"
          onClick={() => setIsRightSidebarExpanded(false)}
          className="w-6 h-6 rounded-md flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-300 transition-all active:scale-[0.97]"
          title="Collapse Panel"
      >
          <ChevronRight className="w-3.5 h-3.5" />
      </button>
  </div>
  ```

---

## 2. Verification Plan

### Automated Coverage
- Run typecheck compilation and vitest check:
  Run: `pnpm verify`
  Expected: 0 TS compilation errors, all 2,336 unit tests passing.
