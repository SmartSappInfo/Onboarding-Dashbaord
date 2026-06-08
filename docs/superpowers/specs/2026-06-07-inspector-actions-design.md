# Design Spec: Logic Inspector Standardized Actions & Step Testing

## Overview
This specification standardizes node configuration editing in the visual workflow builder. It introduces local draft buffering (Apply/Cancel), exit interception for unsaved changes, and an isolated step-testing framework.

---

## 1. What Could Go Wrong & Resolutions

| Risk | Impact | Resolution |
|---|---|---|
| **React Flow Selection Desync** | React Flow marks a node as selected visually, but the builder blocks the selection change due to unsaved changes, causing a UI mismatch. | Use React Flow's `nodes` array state to programmatically reset the visual selection (`selected: true` on the active dirty node) if the user cancels the selection transition. |
| **Unsaved Tab Close Desync** | User closes the browser tab with unsaved inspector edits. The page level `isDirty` check doesn't detect it because the edits were only local drafts. | Expose the inspector's dirty status to the parent `edit/page.tsx` via a callback `onDirtyChange(boolean)`, which integrates into the page's unsaved changes handler. |
| **Test Run Side-Effects** | Running a test step (e.g., adding a tag or creating a task) modifies database state, which might pollute production entities. | Clearly label the Test Step modal with a warning explaining side-effects, and enable choosing a specific "test contact" or "qa sandbox entity" to isolate executions. |
| **Keystroke History Flooding** | Committing logic changes to parent state on every keystroke floods the undo/redo stack. | Commits will only occur on clicking **Apply**. This reduces history snapshots to explicit commits. |

---

## 2. Code Cleanliness, Testability & Scalability

- **Encapsulated State (`useNodeDraft`)**:
  Create a React hook `useNodeDraft` to encapsulate:
  - Cloning node data into a local draft buffer.
  - Tracking edits and deep-comparing dirty states.
  - Committing updates via `onUpdate` or discarding.
- **Isolated Testing File**:
  Define all step testing execution logic in a dedicated service module `src/lib/automations/test-step.ts`. This module receives single nodes and payloads, executing them without canvas traversal.
- **Unified Actions Panel**:
  Design a reusable `InspectorActionsPanel` component rendering standard Apply, Cancel, and Test buttons. This simplifies adding new custom nodes.

---

## 3. Impacted Features & Integrations

- **Diagnostics Panel**:
  When viewing a run trace, the inspector enters a read-only state. We will hide the action toolbar in this view.
- **Form Validation**:
  Introduce a validation step before committing. Clicking "Apply" runs the node validation logic (e.g., checking if templates are selected) and highlights errors.
- **Page Unsaved Changes Dialog**:
  The global save action in the header will check if the active node inspector is dirty, alerting the user to apply or discard inspector changes first.
