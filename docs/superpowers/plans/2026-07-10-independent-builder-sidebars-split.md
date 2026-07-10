# Page Builder sidebar Restructure and Independent control Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely decouple the properties/settings panel from the left sidebar's active tabs. Remove the 'edit' icon tab from the left bar, allow the left and right drawers to render simultaneously, and support configuring the Navigation Header and Page Footer inside the right panel instead of the left drawer.

**Architecture:**
- Remove the `'edit'` icon tab from the left vertical tab bar.
- Introduce `editingHeader` and `editingFooter` states to control selected header/footer configuration.
- Render close buttons in the top headers of both drawer panels.
- Update `Canvas.tsx` header/footer selection callbacks to select header/footer for editing in the right panel.

---

## 1. Bite-Sized Implementation Tasks

### Task 1: Refactor Sidebar Tab Configuration and Canvas Triggers in BuilderClient.tsx

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/BuilderClient.tsx`
- Modify: `src/app/admin/pages/[id]/builder/components/SettingsPanel.tsx`

- [ ] **Step 1: Declare selection states for header/footer configuration**
  Declare state in `BuilderClient.tsx`:
  ```typescript
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingFooter, setEditingFooter] = useState(false);
  ```

- [ ] **Step 2: Clean selection states on block/section selection**
  In the `onSelectBlock` and `onSelectSection` handlers in `BuilderClient.tsx` (around lines 846-851), clean selection states:
  ```typescript
  onSelectBlock={(id) => {
      builder.dispatch({ type: 'SELECT_BLOCK', payload: id });
      setIsRightSidebarExpanded(true);
      setEditingHeader(false);
      setEditingFooter(false);
  }}
  onSelectSection={(id) => {
      builder.dispatch({ type: 'SELECT_SECTION', payload: id });
      setIsRightSidebarExpanded(true);
      setEditingHeader(false);
      setEditingFooter(false);
  }}
  ```

- [ ] **Step 3: Remove navigation header & page footer accordion panels from SettingsPanel.tsx**
  Open `SettingsPanel.tsx` and delete Sections 2 & 3 (Navigation Header and Page Footer settings accordions and lists, lines 109 to 329). Keep Page Behavior, SEO, and Custom Scripts in `SettingsPanel.tsx` for the left sidebarSettings tab.

- [ ] **Step 4: Update header and footer canvas edit selectors**
  In `BuilderClient.tsx`, update the `<Canvas />` component callbacks for `onClickHeader`, `onClickFooter`, and `onEditSection`:
  ```typescript
  onEditSection={(id, colIdx) => {
      builder.dispatch({ type: 'SELECT_SECTION', payload: id, columnIndex: colIdx });
      builder.dispatch({ type: 'SELECT_BLOCK', payload: null });
      setEditingHeader(false);
      setEditingFooter(false);
      setIsRightSidebarExpanded(true);
  }}
  onClickHeader={() => {
      setEditingHeader(true);
      setEditingFooter(false);
      builder.dispatch({ type: 'SELECT_BLOCK', payload: null });
      builder.dispatch({ type: 'SELECT_SECTION', payload: null });
      setIsRightSidebarExpanded(true);
  }}
  onClickFooter={() => {
      setEditingFooter(true);
      setEditingHeader(false);
      builder.dispatch({ type: 'SELECT_BLOCK', payload: null });
      builder.dispatch({ type: 'SELECT_SECTION', payload: null });
      setIsRightSidebarExpanded(true);
  }}
  ```

- [ ] **Step 5: Decouple left and right drawers from builder.activeTab**
  * Update left panel width rendering condition:
    ```typescript
    isLeftSidebarExpanded ? "w-72 opacity-100" : "w-0 opacity-0 border-r-0"
    ```
  * Update right panel width rendering condition (completely independent of tab state):
    ```typescript
    isRightSidebarExpanded ? "w-72 opacity-100 border-l-border" : "w-0 opacity-0 border-l-0"
    ```

- [ ] **Step 6: Add collapse close buttons in both headers**
  * Add left sidebar close button in left panel layout top:
    ```typescript
    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 select-none">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sidebar Options</span>
        <button
            type="button"
            onClick={() => setIsLeftSidebarExpanded(false)}
            className="w-6 h-6 rounded-md flex items-center justify-center border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-300 transition-all active:scale-[0.97]"
            title="Collapse Sidebar"
        >
            <ChevronLeft className="w-3.5 h-3.5" />
        </button>
    </div>
    ```
  * Add the import for `HeaderSettingsControl` and `FooterSettingsControl` from `./components/HeaderFooterSettings` in `BuilderClient.tsx`.
  * Update the right properties drawer header title text and render the respective header/footer settings or properties:
    ```typescript
    {editingHeader ? (
        <HeaderSettingsControl
            page={page}
            structure={version.structureJson}
            onUpdateHeader={handleUpdateHeader}
            onUpdateSettings={handleUpdateSettings}
        />
    ) : editingFooter ? (
        <FooterSettingsControl
            page={page}
            structure={version.structureJson}
            onUpdateFooter={handleUpdateFooter}
            onUpdateSettings={handleUpdateSettings}
        />
    ) : ...
    ```

- [ ] **Step 7: Remove the 'edit' tab from the vertical bar tab list**
  Remove `{ id: 'edit', icon: Settings2, label: 'Edit' },` from `tabs` definitions in `BuilderClient.tsx` (around lines 579-589).

---

## 2. Verification Plan

### Automated Coverage
- Run compilation checks and full vitest suite check:
  Run: `pnpm verify`
  Expected: 0 TS errors, all tests passing.
