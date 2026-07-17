# Design Spec: Entity Detail Page Task Modal Integration

## Overview
This specification details the transition from page navigation for creating tasks from the Entity Details page to showing an inline `TaskEditor` modal. This locks the task scope to the current entity, prevents user redirection, and ensures a seamless operational workflow.

---

## 1. What Could Go Wrong & Resolutions

| Risk | Impact | Resolution |
|---|---|---|
| **Step 1 resets entity fields** | Opening the `TaskEditor` resets the entity details when selecting a category template. | Update the `reset` call in `TaskEditor.tsx` for Step 1 to preserve `task.entityId` and `task.entityType` instead of overriding them to empty defaults. |
| **Combobox accessibility in modal** | Users might inadvertently change the school/entity link inside the task creation modal. | Introduce a `disableEntitySelect` boolean flag to hide or disable the `EntityCombobox` control and display a read-only badge indicating entity association. |
| **No UI update after saving** | Saving a task succeeds in Firestore, but the tasks list in the entity details page does not reload. | The entity details page already uses Firestore real-time listener `useCollection` for tasks. Any new task added to the collection with `entityId` matching the current page will automatically render without page reload. |

---

## 2. Code Cleanliness, Testability & Scalability

- **DRY (Don't Repeat Yourself)**:
  By reusing the existing `<TaskEditor>` component with custom flags (`disableEntitySelect`, `preFilledEntityName`), we avoid duplicating form inputs, styles, schema validations, and state handling.
- **Unified Entity Schema Compatibility**:
  Ensure that when saving tasks from the Entity Details page, the correct `entityId` and resolved properties (`entityName`, `entityType`) are recorded on Firestore matching our unified entity guidelines.
- **Robust Local Testing**:
  Modifying `TaskEditor` to support preset locks simplifies rendering it in other contexts (e.g. Deals details page, Meetings page).

---

## 3. Proposed Changes

### TaskEditor Modification (`src/app/admin/tasks/components/TaskEditor.tsx`)
- Add props:
  - `disableEntitySelect?: boolean`
  - `preFilledEntityName?: string`
- Update `useEffect` that initializes form defaults:
  - In the `else` blocks where `task` contains entity fields, preserve `task.entityId` and `task.entityType`.
- Conditionally render the Entity Selection section. If `disableEntitySelect` is true, show a read-only input with a Locked badge.

### Entity Detail Page Integration (`src/app/admin/entities/[id]/page.tsx`)
- Import `TaskEditor` and `createTaskAction`.
- Declare states `taskEditorOpen` and `isSavingTask`.
- Replace the `+ Create Task` `<Link>` wrapper with a button that triggers `setTaskEditorOpen(true)`.
- Implement `handleSaveTask` callback to commit task data to Firestore.
