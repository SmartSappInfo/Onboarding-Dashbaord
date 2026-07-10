# Inline Variable Inserter Caret Alignment & Sync Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the dropdown positioning of the inline variable inserter in `<InlineEditable>` to align exactly underneath the cursor caret (the `/` character) during typing, synchronize the variable fetch queries with the workspace and organization credentials, and eliminate the prohibited `any` type assertion from the element tag mapping.

**Architecture:** We query cursor position relative to the positioned parent wrapper using a range clone during text nodes selection, set the coordinates dynamically, and synchronize parameters in `getVariablesAction`.

---

## 1. Bite-Sized Implementation Tasks

### Task 1: Refactor InlineEditable.tsx

**Files:**
- Modify: `src/components/page-builder/InlineEditable.tsx`

- [ ] **Step 1: Synchronize getVariablesAction parameters with Workspace Context**
  Destructure `organizationId` from `WorkspaceContext` and pass it to `getVariablesAction` inside the variables-sync effect.
  ```typescript
  const { workspaceId, organizationId } = useContext(WorkspaceContext);
  ```

- [ ] **Step 2: Declare coordinates state for dropdown**
  Add a state for storing top and left coordinates of the autocomplete menu:
  ```typescript
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  ```

- [ ] **Step 3: Update handleInput cursor positioning**
  Modify `handleInput` to clone the active selection range, target the `/` character range, and compute its layout box relative to the wrapper element:
  ```typescript
  try {
    const rangeClone = range.cloneRange();
    rangeClone.setStart(textNode, slashIdx);
    rangeClone.setEnd(textNode, Math.min(slashIdx + 1, textVal.length));
    const rect = rangeClone.getBoundingClientRect();
    
    if (elementRef.current) {
      const parentRect = elementRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setMenuCoords({
          top: rect.bottom - parentRect.top,
          left: rect.left - parentRect.left,
        });
      }
    }
  } catch (e) {
    setMenuCoords({ top: 24, left: 0 });
  }
  ```

- [ ] **Step 4: Update dropdown absolute position style**
  Attach the calculated coordinates to the menu style property:
  ```typescript
  style={{ top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
  ```

- [ ] **Step 5: Proactively eliminate the prohibited `any` tag assertion**
  Replace line 204 `const Tag = tagName as any;` with:
  ```typescript
  const Tag = tagName as keyof JSX.IntrinsicElements;
  ```

---

## 2. Verification Plan

### Automated Coverage
- Run compilation checks and full vitest suite check:
  Run: `pnpm verify`
  Expected: 0 TS errors, all tests passing.
