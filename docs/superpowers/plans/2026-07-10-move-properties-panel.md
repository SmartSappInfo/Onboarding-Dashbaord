# Page Builder properties Sidebar Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the active edit/properties tab configuration panel from the left sidebar drawer to the right side of the canvas in the Page Builder, while keeping all other tabs on the left and maintaining all layout/state-management logic.

**Architecture:** We conditionally adjust the left slide-out panel's width to `w-0` when the `'edit'` tab is active, render a new corresponding right slide-out panel container after the `<Canvas />` element, and visually adjust the toggle chevron direction to match the spatial drawer behavior.

---

## 1. Bite-Sized Implementation Tasks

### Task 1: Update Builder Layout in BuilderClient.tsx

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/BuilderClient.tsx`

- [ ] **Step 1: Update the left sidebar chevron indicator**
  Replace lines 815 to 817 in `BuilderClient.tsx` to conditionally point the chevron based on active tab and expanded state:
  ```typescript
  {builder.activeTab === 'edit'
      ? (isSidebarExpanded ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />)
      : (isSidebarExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
  }
  ```

- [ ] **Step 2: Update left slide-out panel layout classes**
  Modify lines 821 to 825 in `BuilderClient.tsx` to collapse the left panel when `'edit'` is active:
  ```typescript
  className={cn(
      "flex flex-col bg-slate-900/90 border-r border-slate-700/50 backdrop-blur-md transition-all duration-300 ease-[0.32,0.72,0,1] overflow-hidden",
      isSidebarExpanded && builder.activeTab !== 'edit' ? "w-72 opacity-100" : "w-0 opacity-0 border-r-0"
  )}
  ```

- [ ] **Step 3: Remove the 'edit' panel rendering from the left sidebar**
  Remove the `{builder.activeTab === 'edit' && (...)}` block completely (lines 866 to 893).

- [ ] **Step 4: Add the properties panel rendering container on the right side**
  Add the new right-side sidebar element right after the `<Canvas />` component call (around line 1018):
  ```typescript
  {/* ─── PROPERTIES PANEL ON THE RIGHT ─── */}
  <div
      className={cn(
          "flex flex-col bg-slate-900/90 border-l border-slate-700/50 backdrop-blur-md transition-all duration-300 ease-[0.32,0.72,0,1] overflow-hidden shrink-0",
          isSidebarExpanded && builder.activeTab === 'edit' ? "w-72 opacity-100 border-l-border" : "w-0 opacity-0 border-l-0"
      )}
  >
      <div className="flex-1 text-left min-w-[288px] flex flex-col overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-4">
              {getSelectedPathLabel() && (
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-900/50 border border-slate-800 rounded-lg px-2.5 py-1.5 mb-2 select-none text-center">
                      {getSelectedPathLabel()}
                  </div>
              )}
              {builder.selectedBlockId && builder.findBlock(builder.selectedBlockId)?.block ? (
                  <PropertiesPanel
                      block={builder.findBlock(builder.selectedBlockId)!.block}
                      resources={builderResources}
                      theme={editorTheme}
                      workspaceId={activeWorkspaceId ?? undefined}
                      onUpdate={(patch) => builder.updateBlockProps(builder.selectedBlockId!, patch)}
                  />
              ) : selectedSection ? (
                  <SectionSettings
                      section={selectedSection}
                      workspaceId={activeWorkspaceId ?? undefined}
                      onUpdate={(patch) => builder.updateSectionProps(selectedSection.id, patch)}
                  />
              ) : (
                  <div className="text-center py-8 text-xs text-slate-500 font-semibold leading-relaxed">
                      Select a section or block on the canvas to configure properties.
                  </div>
              )}
          </div>
      </div>
  </div>
  ```

---

## 2. Verification Plan

### Automated Coverage
- Run typecheck and full vitest suite check:
  Run: `pnpm verify`
  Expected: 0 TS compilation errors, all 2,329 tests passing.
