# TypeCheck Fix Plan

## Summary
The codebase is migrating from entity-level pipelines to Deal-based pipelines. WorkspaceEntity no longer has `pipelineId`, `stageId`, or `currentStageName` fields.

## Fix Strategy

### 1. WorkspaceEntity Pipeline Fields (REMOVED)
- `pipelineId` → Moved to Deal model
- `stageId` → Moved to Deal model  
- `currentStageName` → Moved to Deal model OR use `lifecycleStatus` for simple status tracking

### 2. Replacement Approaches

#### Option A: Use lifecycleStatus (Simple Status)
For UI display of entity status without full pipeline tracking:
```typescript
// OLD
{workspaceEntity.currentStageName}

// NEW
{workspaceEntity.lifecycleStatus || 'No status'}
```

#### Option B: Query Deal Records (Full Pipeline)
For actual pipeline/stage tracking:
```typescript
// Query deals for this entity
const deals = await getDealsForEntity(entityId, workspaceId);
const activeDeal = deals.find(d => d.status === 'open');
// Use activeDeal.stageId, activeDeal.pipelineId
```

#### Option C: Remove Feature (Deprecated)
For features that are no longer supported, remove the code entirely.

## Files to Fix

### Tests (Use lifecycleStatus)
- [ ] src/app/admin/contacts/components/__tests__/scope-ui-adaptation.test.tsx

### UI Components (Use lifecycleStatus)
- [ ] src/app/admin/contacts/components/ContactDetailPage.tsx
- [ ] src/app/admin/entities/[id]/page.tsx
- [ ] src/app/admin/entities/components/ManageWorkspacesModal.tsx
- [ ] src/app/admin/entities/EntitiesClient.tsx

### Pipeline Components (Remove or Refactor to Deal-based)
- [ ] src/app/admin/entities/components/ChangeStageModal.tsx
- [ ] src/app/admin/entities/components/PipelineAutomationsTab.tsx
- [ ] src/app/admin/entities/components/TransferPipelineModal.tsx
- [ ] src/app/admin/pipeline/components/StageEditor.tsx
- [ ] src/lib/dashboard-server.ts

### API Routes (Remove pipeline fields from response)
- [ ] src/app/api/contacts/[entityId]/route.ts
- [ ] src/app/api/workspaces/[workspaceId]/contacts/route.ts

### Adapters & Queries (Remove pipeline fields)
- [ ] src/lib/contact-adapter.ts
- [ ] src/lib/workspace-list-queries.ts

### Actions (Remove pipeline initialization)
- [ ] src/lib/lead-actions.ts (already fixed - remove stageId)
- [ ] src/lib/workspace-entity-actions.ts (remove pipelineId, stageId, currentStageName)

### MessageChannel Fixes (Filter to email/sms)
- [ ] src/app/admin/messaging/components/quick-template-dialog.tsx
- [ ] src/lib/bulk-messaging.ts
- [ ] src/lib/reminder-actions.ts

### TemplateCategory Fixes (Handle extended categories)
- [ ] src/app/(backoffice)/backoffice/messaging/templates/[id]/EditTemplateClient.tsx
- [ ] src/app/admin/messaging/composer/page.tsx

### Real Estate PropertyDeal Fix
- [ ] src/lib/real-estate-actions.ts (use PropertyDeal type correctly)

