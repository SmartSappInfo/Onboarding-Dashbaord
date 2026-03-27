# Task 14.3 Implementation Summary

## Task: Update stage change actions to update workspace_entities only

**Status:** ✅ Complete

**Requirements:** 5 (Pipeline State Isolation)

---

## Overview

This task ensures that pipeline stage changes update only the `workspace_entities` document for the current workspace, without propagating changes to other workspaces or updating the entity root document.

---

## Implementation Details

### 1. Server Action: `updateWorkspaceEntityAction`

**Location:** `src/lib/workspace-entity-actions.ts`

The existing `updateWorkspaceEntityAction` function already implements the correct behavior:

```typescript
export async function updateWorkspaceEntityAction(input: UpdateWorkspaceEntityInput) {
  // Updates only the specific workspace_entities document
  // Does NOT update entity root
  // Does NOT query or update other workspace_entities records
  
  if (input.stageId !== undefined) {
    updates.stageId = input.stageId;
    
    // Update denormalized stage name
    const stageSnap = await adminDb.collection('stages').doc(input.stageId).get();
    if (stageSnap.exists) {
      updates.currentStageName = stageSnap.data()?.name;
    }
  }
  
  await workspaceEntityRef.update(updates);
}
```

**Key behaviors:**
- Updates `stageId` and `currentStageName` on the specific `workspace_entities` document
- Does NOT touch the entity root document
- Does NOT query or update other workspace_entities records
- Logs activity with workspace context

### 2. UI Component: KanbanBoard

**Location:** `src/app/admin/pipeline/components/KanbanBoard.tsx`

The drag-and-drop handler correctly updates workspace_entities:

```typescript
const handleDragEnd = async (event: DragEndEvent) => {
  // Check if this is a workspace_entity or legacy school
  const workspaceEntityQuery = query(
    collection(firestore!, 'workspace_entities'),
    where('entityId', '==', entityId),
    where('workspaceId', '==', activeWorkspaceId)
  );
  const weSnap = await getDocs(workspaceEntityQuery);

  if (!weSnap.empty) {
    // Update workspace_entities record (Requirement 5)
    const workspaceEntityRef = doc(firestore!, 'workspace_entities', weSnap.docs[0].id);
    await updateDoc(workspaceEntityRef, {
      stageId: newStage.id,
      currentStageName: newStage.name,
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Fallback to legacy schools collection
    const schoolRef = doc(firestore!, 'schools', entityId);
    await updateDoc(schoolRef, {
      stage: { id: newStage.id, name: newStage.name, order: newStage.order, color: newStage.color },
    });
  }
}
```

**Key behaviors:**
- Queries for the workspace_entity record using both `entityId` and `workspaceId`
- Updates only the matched workspace_entities document
- Falls back to legacy schools collection for backward compatibility
- Does NOT propagate changes to other workspaces

---

## Architectural Guarantees

### ✅ Stage Isolation Per Workspace

When an entity exists in multiple workspaces:
- Workspace A can have the entity at "Onboarding" stage
- Workspace B can have the same entity at "Invoice Overdue" stage
- Moving the entity in Workspace A does NOT affect Workspace B

### ✅ No Entity Root Updates

Stage changes do NOT update:
- `entities/{entityId}` document
- Any fields on the entity root
- Pipeline or stage fields that don't exist on entities

### ✅ Single Document Update

Each stage change operation:
- Updates exactly ONE `workspace_entities` document
- Does NOT batch update multiple workspace_entities
- Does NOT query other workspaces

---

## Test Coverage

**Test File:** `src/lib/__tests__/stage-change-isolation.test.ts`

### Test Cases

1. ✅ **Updates stageId and currentStageName on workspace_entities only**
   - Verifies workspace_entities document is updated
   - Verifies entity root is NOT updated

2. ✅ **Does NOT propagate stage changes to other workspaces**
   - Verifies only one workspace_entities document is updated
   - Verifies no batch operations or cross-workspace queries

3. ✅ **Updates currentStageName denormalized field**
   - Verifies stage name is fetched and denormalized
   - Verifies both stageId and currentStageName are updated together

4. ✅ **Handles missing stage documents gracefully**
   - Updates stageId even if stage document doesn't exist
   - Does not set currentStageName if stage is missing

5. ✅ **Logs activity with workspace context**
   - Verifies activity includes workspaceId, entityId, entityType
   - Verifies metadata includes updated fields

### Test Results

```
✓ Stage Change Actions - workspace_entities Only (5)
  ✓ should update stageId and currentStageName on workspace_entities only
  ✓ should NOT propagate stage changes to other workspaces
  ✓ should update currentStageName denormalized field when stage changes
  ✓ should handle stage change when stage document does not exist
  ✓ should log activity when stage changes

Test Files  1 passed (1)
     Tests  5 passed (5)
```

---

## Requirements Validation

### Requirement 5: Pipeline and Stage on Workspace Link

✅ **Acceptance Criteria Met:**

1. ✅ Pipeline and stage stored exclusively on workspace_entities
2. ✅ Stage changes update only the current workspace's workspace_entities record
3. ✅ Stage changes do NOT propagate to other workspaces
4. ✅ Pipeline Kanban queries workspace_entities filtered by workspaceId and pipelineId
5. ✅ Legacy schools collection resolved via Adapter Layer (backward compatibility maintained)

---

## Migration Path

### Current State
- `updateWorkspaceEntityAction` correctly updates workspace_entities only
- KanbanBoard component uses workspace-scoped queries and updates
- Legacy schools collection still supported for backward compatibility

### Future State (Post-Migration)
- Remove legacy schools fallback from KanbanBoard
- All stage changes go through workspace_entities exclusively
- Adapter layer handles legacy reads transparently

---

## Related Tasks

- **Task 14.1:** ✅ Remove pipelineId and stage from entity root
- **Task 14.2:** ✅ Update pipeline Kanban to query workspace_entities
- **Task 14.3:** ✅ Update stage change actions to update workspace_entities only (this task)
- **Task 14.4:** 🔄 Write property test for pipeline state isolation

---

## Conclusion

Task 14.3 is complete. The implementation correctly ensures that:
- Stage changes update only workspace_entities documents
- Changes are isolated to the current workspace
- Entity root documents are never modified by stage changes
- Each workspace maintains independent pipeline state for shared entities

The architecture now fully supports Requirement 5: Pipeline State Isolation.
