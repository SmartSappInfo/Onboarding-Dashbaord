# Task 14 Implementation Summary: Move Pipeline/Stage Logic to workspace_entities

## Overview
Successfully moved pipeline and stage logic to workspace_entities collection, ensuring pipeline state is isolated per workspace as required by Requirement 5.

## Changes Made

### 14.1: Remove pipelineId and stage from entity root ✅
**Status**: Already complete
- Verified Entity interface in `src/lib/types.ts` does NOT have `pipelineId` or `stageId` fields
- These fields exist only on WorkspaceEntity interface as designed
- Pipeline state lives exclusively on workspace_entities collection

### 14.2: Update pipeline Kanban to query workspace_entities ✅
**File**: `src/app/admin/pipeline/components/KanbanBoard.tsx`

**Changes**:
1. Added query for `workspace_entities` filtered by:
   - `workspaceId` (current workspace)
   - `pipelineId` (current pipeline)
   - `status: 'active'`

2. Implemented entity hydration:
   - Fetch workspace_entities first (Requirement 8)
   - Hydrate entity identity data from entities collection in second fetch
   - Map to School format for backward compatibility

3. Combined hydrated entities with legacy schools for migration period

**Key Code**:
```typescript
// Query workspace_entities (Requirement 5, 8)
const workspaceEntitiesQuery = useMemoFirebase(
  () => (firestore ? query(
      collection(firestore, 'workspace_entities'), 
      where('pipelineId', '==', pipelineId),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'active')
  ) : null),
  [firestore, pipelineId, activeWorkspaceId]
);

// Hydrate entity data
for (const we of workspaceEntities) {
  const entityRef = doc(firestore, 'entities', we.entityId);
  const entitySnap = await getDoc(entityRef);
  // Map entity + workspace_entity to School format
}
```

### 14.3: Update stage change actions to update workspace_entities only ✅
**File**: `src/app/admin/pipeline/components/KanbanBoard.tsx`

**Changes**:
1. Modified `handleDragEnd` to check if entity has workspace_entities record
2. If workspace_entities record exists, update it (Requirement 5):
   - Update `stageId`
   - Update `currentStageName` (denormalized)
   - Update `updatedAt`
3. Fallback to legacy schools collection for backward compatibility
4. Stage updates do NOT propagate to other workspaces

**Key Code**:
```typescript
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
```

### 14.4: Write property test for pipeline state isolation ✅
**File**: `src/lib/__tests__/pipeline-state-isolation.property.test.ts`

**Property 2: Pipeline State Isolation Invariant**
- **Validates**: Requirements 5
- **Assertion**: For any entity E linked to workspaces W1 and W2, updating stage in W1 does NOT affect stage in W2

**Test Cases** (all passing):
1. ✅ `should maintain independent stageId when updating one workspace`
   - Updates stage in workspace 1
   - Verifies workspace 2 retains original stage

2. ✅ `should allow same entity to be at different stages in different workspaces`
   - Creates entity in two workspaces with different stages
   - Verifies both records exist independently

3. ✅ `should handle concurrent stage updates to different workspaces independently`
   - Simulates concurrent updates to both workspaces
   - Verifies each workspace has its own independent stage

4. ✅ `should preserve other workspace_entity fields when updating stage`
   - Updates only stage
   - Verifies tags, assignee, and other fields remain unchanged

**Test Results**:
```
✓ Property 2: Pipeline State Isolation Invariant (4)
  ✓ should maintain independent stageId when updating one workspace
  ✓ should allow same entity to be at different stages in different workspaces
  ✓ should handle concurrent stage updates to different workspaces independently
  ✓ should preserve other workspace_entity fields when updating stage

Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  1.58s
```

## Requirements Validated

### Requirement 5: Pipeline and Stage on Workspace Link ✅
1. ✅ Pipeline state stored exclusively on workspace_entities
2. ✅ Stage updates modify only current workspace's workspace_entities record
3. ✅ Stage changes do NOT propagate to other workspaces
4. ✅ Pipeline Kanban queries workspace_entities filtered by workspaceId and pipelineId
5. ✅ Legacy schools collection supported via adapter pattern

### Requirement 8: Workspace-Scoped Queries ✅
1. ✅ Query workspace_entities filtered by workspaceId first
2. ✅ Hydrate entity identity data in second fetch
3. ✅ Do NOT query entities collection directly for list views

## Backward Compatibility

The implementation maintains full backward compatibility:
- Legacy schools collection continues to work
- Kanban board supports both workspace_entities and schools
- Stage updates check for workspace_entities first, fallback to schools
- Migration can proceed gradually without breaking existing functionality

## Testing

All tests passing:
- ✅ 4 property-based tests (100 runs each)
- ✅ No TypeScript diagnostics
- ✅ Pipeline state isolation verified across multiple scenarios

## Next Steps

Task 15 (Checkpoint) should verify:
1. Moving entity through pipeline in one workspace
2. Same entity in different workspace has independent stage
3. Kanban view queries workspace_entities correctly
4. All tests pass
