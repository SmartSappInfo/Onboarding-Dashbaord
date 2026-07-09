# Design Specification: Switch-style Tag Split Routing in Visual Automations

This document specifies the architecture and implementation design for improving the visual automation's Tag Split step to support multi-branch switch logic.

## 1. Overview
The current Tag Split step is a binary `if/else` condition checking contact tags, routing contacts through a "True" or "False" exit path. 

This enhancement extends the Tag Split to act as a `switch` statement:
*   Allows configuring multiple sequential tag condition branches.
*   Enables routing a contact through the specific branch matching their tag.
*   Supports routing through a fallback `"None"` branch if no condition matches.
*   Offers two evaluation modes: **First-Match Wins** (sequential routing to a single branch) and **All-Matches Trigger** (concurrent routing to all matching branches).

## 2. Requirements & Constraints
1.  **Backward Compatibility**: Existing automations with standard true/false handles must remain visually intact and execute correctly.
2.  **Single Source of Truth for Tags**: Tag selection in the UI must exclusively use the standardized `<TagSelector>` component in draft/client mode, as per Workspace Rules.
3.  **Canvas Spacing & Cleanups**:
    *   Adding a branch adds a corresponding bottom handle to the canvas node.
    *   Handles must be dynamically positioned and spaced.
    *   Deleting a condition branch in the inspector must immediately remove its corresponding handle and delete any connected edges from the canvas to avoid dangling or invisible edges.

## 3. Detailed Architecture

### 3.1 Data Model Expansion
We expand `TagConditionNode` in `src/lib/types.ts`:

```typescript
export interface TagConditionNode {
  id: string;
  type: 'tag_condition';
  data: {
    // --- Legacy Fields (preserved for backward compatibility) ---
    logic?: 'has_tag' | 'has_all_tags' | 'has_any_tag' | 'not_has_tag';
    tagIds?: string[];

    // --- Switch Fields ---
    evaluationMode?: 'first_match' | 'all_matches'; // Defaults to 'first_match'
    conditions?: Array<{
      id: string; // Unique ID of this branch (e.g. cond_12345)
      tagId: string; // The Tag ID checked on the contact
    }>;
  };
}
```

### 3.2 Dynamic Canvas Handles & Layout
In `src/app/admin/automations/[id]/edit/components/nodes/TagConditionNode.tsx`:
*   If `data.conditions` is not defined: render legacy `true` (at `25%` left) and `false` (at `75%` left) handles.
*   If `data.conditions` is defined:
    *   Compute `totalHandles = data.conditions.length + 1` (conditions + default "None").
    *   Loop through conditions at index `idx` (from 0 to `conditions.length - 1`). Position each handle at `leftPercent = ((idx + 1) * 100) / (totalHandles + 1)`.
    *   Render the fallback `'none'` handle at `leftPercent = (totalHandles * 100) / (totalHandles + 1)`.
    *   Display the friendly tag name (looked up from workspace tags) underneath each condition handle, and `"None"` under the fallback handle.

In `src/app/admin/automations/components/AutomationBuilder.tsx`:
*   Support dynamic node placement offsets:
    ```typescript
    const parentHandles = parentNode.data?.conditions 
        ? [...parentNode.data.conditions.map((c: any) => c.id), 'none'] 
        : ['true', 'false'];
    const handleIndex = parentHandles.indexOf(sourceHandle);
    const step = 240 / (parentHandles.length - 1);
    targetX += -120 + (handleIndex * step);
    ```

### 3.3 Node Inspector & TagSelector Compliance
In `src/app/admin/automations/components/NodeInspector.tsx`:
*   Add a **Routing Mode** dropdown: `Standard Split (Legacy)` / `Multi-tag Route (Switch)`.
*   If `Multi-tag Route (Switch)` is selected:
    *   Show a selector for **Evaluation Mode** (`first_match` / `all_matches`).
    *   Show an editable list of condition branches.
    *   For each condition branch, embed `<TagSelector>`:
        ```tsx
        <TagSelector
          currentTagIds={cond.tagId ? [cond.tagId] : []}
          onTagsChange={(newTags) => {
            const lastTag = newTags[newTags.length - 1] || '';
            // update this branch's tagId
          }}
        />
        ```
    *   Provide an **Add Branch** button that appends a new condition object with a unique random ID (e.g. `cond_${Date.now()}_${Math.random()}`).

### 3.4 Edge Pruning upon Branch Deletion
To prevent dangling canvas edges:
*   In `AutomationBuilder.tsx`'s `handleUpdateNodeData`:
    *   Detect if a condition in `node.data.conditions` was removed.
    *   If yes, filter out any edges from `edges` matching `edge.source === nodeId && edge.sourceHandle === deletedConditionId`.

### 3.5 Runtime Execution Engine
In `src/lib/tag-condition.ts`:
*   Implement `evaluateTagSplitSwitch(contactTags: string[], node: TagConditionNode): string[]`:
    *   If legacy node (no `conditions`): return `evaluateTagCondition(contactTags, node) ? ['true'] : ['false']`.
    *   If switch node:
        *   Filter conditions to find all whose `tagId` is present in `contactTags`.
        *   If no matching conditions, return `['none']`.
        *   If `evaluationMode === 'all_matches'`, return all matching condition IDs.
        *   If `evaluationMode === 'first_match'` (or undefined), return `[firstMatchingCondition.id]`.

In `src/lib/automations/nodes/traverse.ts`:
*   Update `tagConditionNode` step execution:
    ```typescript
    const matchedHandles = await evaluateTagConditionNode(currentNode, context); // returns string[]
    outgoingEdges = outgoingEdges.filter((e) => matchedHandles.includes(e.sourceHandle));
    ```
*   Update step logging to record all traversed branches in execution metadata.

## 4. Verification Plan
1.  **Unit Tests**: Add tests in `src/lib/__tests__/tag-condition.test.ts` verifying routing logic for:
    *   Sequential first-match evaluation.
    *   Concurrent all-matches evaluation.
    *   Fallback routing to `'none'` handle when no tags match.
    *   Preservation of legacy binary evaluation.
2.  **UI Verification**: Inspect handle spacing, dynamic renaming, tag selector behavior, and edge auto-pruning on the visual automation editor canvas.
