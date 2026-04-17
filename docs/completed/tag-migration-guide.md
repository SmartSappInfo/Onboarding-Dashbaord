# Tag Migration Guide: Global vs Workspace Tags

## Overview

This guide explains the tag migration system that separates tags into two scopes:

- **Global Tags** (`entities.globalTags`): Identity-level tags visible across all workspaces
- **Workspace Tags** (`workspace_entities.workspaceTags`): Operational tags scoped to a specific workspace

This separation ensures that operational tags in one workspace don't pollute the view in another workspace, while still allowing identity-level tags to be shared across all contexts.

## Architecture

### Data Model

```typescript
// Entity (identity-level)
interface Entity {
  id: string;
  organizationId: string;
  entityType: 'institution' | 'family' | 'person';
  name: string;
  globalTags: string[];  // ← Identity-level tags
  // ... other fields
}

// WorkspaceEntity (operational state)
interface WorkspaceEntity {
  id: string;
  entityId: string;
  workspaceId: string;
  workspaceTags: string[];  // ← Workspace-scoped tags
  // ... other fields
}
```

### Tag Classification Rules

Tags are automatically classified based on naming patterns:

**Global Tags** (identity-level):
- VIP status: `vip`, `strategic`, `partner`, `enterprise`
- Account tiers: `tier-1`, `tier-2`, `tier-3`, `key-account`
- Geographic: `region-*`, `zone-*`
- Industry: `industry-*`, `sector-*`

**Workspace Tags** (operational):
- Pipeline stages: `onboarding`, `contract-review`, `invoice-overdue`
- Engagement: `highly-engaged`, `inactive`, `re-engaged`
- Campaign: `attended-demo`, `downloaded-brochure`, `visited-pricing`
- Billing: `payment-pending`, `overdue`, `paid`

## Migration Process

### Step 1: Run Migration Script

```bash
# Dry run (preview changes without writing)
DRY_RUN=true npm run migrate:entity-tags

# Live migration
npm run migrate:entity-tags
```

### Step 2: Verify Results

The migration script will:
1. Read all schools with tags
2. Find corresponding entities
3. Classify each tag as global or workspace-scoped
4. Write global tags to `entities.globalTags`
5. Write workspace tags to `workspace_entities.workspaceTags`

### Step 3: Update Application Code

Replace legacy tag actions with scoped tag actions:

```typescript
// OLD: Legacy tag actions (schools collection)
import { applyTagsAction, removeTagsAction } from '@/lib/tag-actions';

await applyTagsAction(schoolId, 'school', ['tag-1'], userId);
await removeTagsAction(schoolId, 'school', ['tag-1'], userId);

// NEW: Scoped tag actions (entities/workspace_entities)
import { applyTagAction, removeTagAction } from '@/lib/scoped-tag-actions';

// Apply global tag (identity-level)
await applyTagAction(entityId, ['tag-1'], 'global', null, userId);

// Apply workspace tag (operational)
await applyTagAction(entityId, ['tag-1'], 'workspace', workspaceId, userId);

// Remove global tag
await removeTagAction(entityId, ['tag-1'], 'global', null, userId);

// Remove workspace tag
await removeTagAction(entityId, ['tag-1'], 'workspace', workspaceId, userId);
```

## API Reference

### `applyTagAction`

Applies tags to an entity with explicit scope control.

```typescript
function applyTagAction(
  entityId: string,
  tagIds: string[],
  scope: 'global' | 'workspace',
  workspaceId: string | null,
  userId: string
): Promise<{ success: boolean; error?: string }>
```

**Parameters:**
- `entityId`: The entity ID to tag
- `tagIds`: Array of tag IDs to apply
- `scope`: `"global"` for identity-level tags, `"workspace"` for operational tags
- `workspaceId`: Required when scope is `"workspace"`, null for global scope
- `userId`: User performing the action

**Examples:**

```typescript
// Apply VIP tag globally (visible in all workspaces)
await applyTagAction('entity-123', ['vip-tag-id'], 'global', null, 'user-456');

// Apply "Invoice Overdue" tag to billing workspace only
await applyTagAction('entity-123', ['overdue-tag-id'], 'workspace', 'billing-ws', 'user-456');
```

### `removeTagAction`

Removes tags from an entity with explicit scope control.

```typescript
function removeTagAction(
  entityId: string,
  tagIds: string[],
  scope: 'global' | 'workspace',
  workspaceId: string | null,
  userId: string
): Promise<{ success: boolean; error?: string }>
```

**Key Guarantees:**
- Removing a workspace tag does NOT remove the global tag
- Removing a global tag does NOT remove workspace tags

**Examples:**

```typescript
// Remove VIP tag globally
await removeTagAction('entity-123', ['vip-tag-id'], 'global', null, 'user-456');

// Remove "Invoice Overdue" tag from billing workspace only
await removeTagAction('entity-123', ['overdue-tag-id'], 'workspace', 'billing-ws', 'user-456');
```

### `getEntityTagsAction`

Gets all tags for an entity, separated by scope.

```typescript
function getEntityTagsAction(
  entityId: string,
  workspaceId?: string
): Promise<{
  success: boolean;
  globalTags?: string[];
  workspaceTags?: string[];
  error?: string;
}>
```

**Examples:**

```typescript
// Get global tags only
const result = await getEntityTagsAction('entity-123');
console.log(result.globalTags); // ['vip-tag-id', 'strategic-tag-id']

// Get both global and workspace tags
const result = await getEntityTagsAction('entity-123', 'billing-ws');
console.log(result.globalTags); // ['vip-tag-id', 'strategic-tag-id']
console.log(result.workspaceTags); // ['overdue-tag-id', 'payment-pending-tag-id']
```

## Tag Partition Invariant

The system enforces a strict **Tag Partition Invariant** (Property 4):

> For any entity E and workspace W:
> - Operations on `globalTags(E)` do NOT affect `workspaceTags(W, E)`
> - Operations on `workspaceTags(W, E)` do NOT affect `globalTags(E)`
> - The same tag ID can exist in both scopes simultaneously

This invariant is verified by property-based tests that run 20+ randomized scenarios.

## UI Integration

### Tag Display

Tags should be displayed with scope indicators:

```tsx
// Example: Tag badge component
function TagBadge({ tag, scope }: { tag: Tag; scope: 'global' | 'workspace' }) {
  return (
    <div className="flex items-center gap-1">
      <span className="tag-name">{tag.name}</span>
      {scope === 'global' && (
        <span className="scope-badge global">Global</span>
      )}
      {scope === 'workspace' && (
        <span className="scope-badge workspace">Workspace</span>
      )}
    </div>
  );
}
```

### Tag Management UI

The tag management UI should:
1. Display "Scope" indicator for each tag
2. Allow filtering by scope (global vs workspace)
3. Show which workspaces use each workspace-scoped tag
4. Warn when deleting a tag that it will be removed from both scopes

## Testing

### Unit Tests

```bash
npm run test:run -- src/lib/__tests__/scoped-tag-actions.test.ts
```

### Property-Based Tests

```bash
npm run test:run -- src/lib/__tests__/tag-partition.property.test.ts
```

The property-based tests verify:
1. Removing workspace tag does NOT remove global tag
2. Removing global tag does NOT remove workspace tag
3. Applying to one scope does not affect the other
4. Same tag can exist in both scopes without interference

## Troubleshooting

### Migration Issues

**Problem:** Entity not found for school
```
No entity found for school abc123 (School Name)
```

**Solution:** Ensure the entity migration has been run first:
```bash
npm run migrate:schools-to-entities
```

---

**Problem:** Workspace_entities record not found
```
No workspace_entities record found for entity xyz789 in workspace ws-456
```

**Solution:** Ensure workspace linking has been completed:
```bash
npm run link:entities-to-workspaces
```

### Tag Classification Issues

**Problem:** Tag classified incorrectly

**Solution:** Use manual classification override:
```typescript
import { classifyTagManuallyAction } from '@/lib/tag-migration';

await classifyTagManuallyAction('tag-id', 'global', 'user-id');
```

## Best Practices

1. **Use Global Tags for Identity Attributes**
   - VIP status, account tier, industry, region
   - Attributes that are meaningful across all workspaces

2. **Use Workspace Tags for Operational State**
   - Pipeline stages, engagement levels, campaign participation
   - State that is specific to one workspace's operations

3. **Avoid Duplicate Tags**
   - Don't create separate "VIP" tags for each workspace
   - Use one global "VIP" tag instead

4. **Document Tag Scope**
   - Add descriptions to tags explaining their scope
   - Use consistent naming conventions (e.g., prefix workspace tags with workspace name)

5. **Test Tag Operations**
   - Always test tag operations in both scopes
   - Verify that removing from one scope doesn't affect the other

## Migration Checklist

- [ ] Run entity migration (`npm run migrate:schools-to-entities`)
- [ ] Run workspace linking (`npm run link:entities-to-workspaces`)
- [ ] Run tag migration in dry-run mode (`DRY_RUN=true npm run migrate:entity-tags`)
- [ ] Review migration output and verify classification
- [ ] Run tag migration live (`npm run migrate:entity-tags`)
- [ ] Update application code to use scoped tag actions
- [ ] Update UI to display scope indicators
- [ ] Run tests to verify tag partition invariant
- [ ] Deploy and monitor for issues

## Support

For questions or issues, contact the development team or file an issue in the project repository.
