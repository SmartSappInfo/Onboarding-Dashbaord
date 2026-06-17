# Legacy Text Builder Layout Swap & AI Generator Integration

Improve the user experience of the Legacy Text script building view by swapping the text area and variables panel layout, updating helper instructions, and polishing the AI Generator actions based on the active editing mode.

## Proposed Changes

### 1. Layout Swap in `ScriptBuilderClient.tsx`
*   Move the Rich Script Editor container (`col-span-9`) to the left of the variables panel.
*   Move the Variables Panel (`col-span-3`) to the right of the editor.
*   Update the header subtitle from "...Click badges on the **left** panel..." to "...Click badges on the **right** panel...".

### 2. AI Generator Integration
*   Ensure the AI Generator modal targets the active workspace context:
    *   **Generation:** Keep generating visual conversation trees and populating both visual nodes and legacy plain text.
    *   **Refinement:** 
        *   If the active tab is `text` (Legacy Text), pass `legacyText` to `refineCallScriptAction` and update the plain text state upon success.
        *   If the active tab is `flow` or `playbook`, pass the JSON graph representing the visual nodes and edges and update the canvas state upon success.

## Verification Plan
*   **Manual Verification:**
    *   Confirm the plain text editor is on the left and the variables panel is on the right.
    *   Confirm the header instruction text is updated correctly.
    *   Verify that clicking badges on the right variables panel inserts the variable at the editor's cursor position.
    *   Verify the AI Generator "Refine Existing" action updates the legacy plain text when on the Legacy Text tab, and updates the canvas flow when on the Visual Flow tab.
