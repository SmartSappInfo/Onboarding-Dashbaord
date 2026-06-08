# Design Spec: Task confirmation dialog modals & ListView layout improvements

## Overview
This specification details two primary changes to the Tasks management system:
1. Transitioning from default browser alerts to custom-themed `AlertDialog` components for delete and bulk actions.
2. Swapping the columns of the Task Due Status ("Today", "Overdue", etc.) and the Entity Display Name in the listview, and bringing the Entity Display Name into the Simple listview mode.

---

## 1. What Could Go Wrong & Resolutions

| Risk | Impact | Resolution |
|---|---|---|
| **Type mismatch on single delete** | Clicking delete passes an invalid format to `handleDelete` or fails compilation. | Update `handleDelete` caller to trigger `setTaskToDelete(task)` instead of calling `handleDelete(task.id)` directly with a string. The confirmation dialog then calls `handleDelete(taskToDelete)` passing the correct `Task` object. |
| **Bulk action processing overlap** | Users trigger multiple bulk operations (e.g. resolve and delete) simultaneously while an operation is pending. | Set `isBulkProcessing` state to `true` during active bulk actions. Disable buttons in both the selection bar and confirmation footers while processing to prevent duplicate submissions. |
| **Modal state reset failure** | If an action fails, the dialog stays open or the state gets stuck, preventing subsequent actions. | Wrap handlers in `try...finally` blocks to ensure modal states (`taskToDelete`, `isBulkDeleteOpen`, `isBulkResolveOpen`) are reset to defaults (`null` or `false`) regardless of success or failure. |
| **Column alignment breakage on small screens** | Swapping columns or adding the Entity column in simple view overflows the row on smaller viewport widths. | Use responsive utility classes (e.g. `hidden md:flex` or `hidden lg:flex`) for the Entity Display Name in both simple and detailed views to degrade gracefully on narrow layouts. |

---

## 2. Code Cleanliness, Testability & Scalability

- **Unified Alert Dialog Styling**:
  All new modals inherit styling patterns from the existing `taskToComplete` alert dialog:
  - Header: Centered status icon inside a color-coded circular container (`bg-rose-500/10` for warnings/deletions, `bg-emerald-500/10` for resolutions).
  - Content: Clean typography utilizing semantic HTML (`AlertDialogTitle`, `AlertDialogDescription`).
  - Footer: Consistent padding, layout, and button styling using predefined Tailwind/CSS theme tokens.
- **State Segregation**:
  Keep trigger variables clean and precise:
  - `taskToDelete` (Task | null) for single deletions.
  - `isBulkDeleteOpen` (boolean) for bulk deletions.
  - `isBulkResolveOpen` (boolean) for bulk resolutions.
- **Responsive Flex Columns**:
  Maintain strict alignment in both `isSimpleView === true` and `isSimpleView === false` modes by ensuring that swapped columns use consistent `min-w` and `max-w` settings to avoid horizontal shifting when list items hover or scale.

---

## 3. Impacted Features & Integrations

### Dropdown Actions Menu
- The task list item's dropdown menu will trigger the confirmation modal states rather than calling action routines directly.

### Selection Action Bar
- The fixed action bar displayed during active selection mode will trigger bulk confirmation modals instead of inline browser alerts.

### Swapped Column Layout (Detailed View)
- Current order: Title/Metadata -> Due Status (`Clock`) -> Entity Display Name (`EntityAvatar`) -> Progress Bar.
- Swapped order: Title/Metadata -> Entity Display Name (`EntityAvatar`) -> Due Status (`Clock`) -> Progress Bar.

### Swapped Column Layout (Simple View)
- Current order: Title -> Priority Badge -> Due Status (`Clock`) -> Progress Bar.
- Swapped order: Title -> Priority Badge -> Entity Display Name (`EntityAvatar` if present) -> Due Status (`Clock`) -> Progress Bar.
- Note: Entity Display Name is integrated using `hidden md:flex items-center gap-1.5 min-w-[120px] max-w-[160px]` to maintain compact styling.
