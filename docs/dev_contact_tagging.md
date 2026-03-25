# Contact Tagging System — Developer Reference

> Stack: Next.js 15 · TypeScript · Firestore (Admin SDK) · Zod · fast-check

---

## Table of Contents

1. [Server Action APIs](#1-server-action-apis)
2. [Component Usage Examples](#2-component-usage-examples)
3. [Integration Guide](#3-integration-guide)
4. [Testing Approach](#4-testing-approach)

---

## 1. Server Action APIs

All actions live in `src/lib/tag-actions.ts` and are marked `'use server'`. They return a discriminated union `{ success: true; data?: T } | { success: false; error: string }` so callers never need to catch.

### Permission model

Two permissions gate tag operations (checked via `userHasTagPermission` in `src/lib/tag-permissions.ts`):

| Permission | Grants |
|---|---|
| `tags_manage` | Create, update, delete, merge tags |
| `tags_apply` | Apply / remove tags on contacts |

`system_admin` bypasses all checks. Permissions are stored flat on the `users` document.

### Error types

Defined in `src/lib/tag-errors.ts`:

```ts
TagValidationError  // bad input (name, color, category)
TagPermissionError  // missing permission
TagConflictError    // duplicate tag name in workspace
TagNotFoundError    // tag or contact doesn't exist
TagNetworkError     // transient Firestore failure
```

`getUserFriendlyErrorMessage(error)` converts any of these to a human-readable string safe to show in the UI.

---

### `createTagAction`

Creates a new tag in a workspace.

```ts
createTagAction(data: {
  workspaceId: string;
  organizationId: string;
  name: string;          // 1–50 chars, [a-zA-Z0-9 \-_\[\]:]
  description?: string;  // max 200 chars
  category: TagCategory; // see below
  color: string;         // hex, e.g. "#3B82F6"
  userId: string;
  userName?: string;
}): Promise<{ success: true; data: Tag } | { success: false; error: string }>
```

`TagCategory` values: `behavioral | demographic | interest | status | lifecycle | engagement | custom`

Errors: `TagPermissionError`, `TagValidationError`, `TagConflictError` (duplicate slug in workspace).

---

### `updateTagAction`

Updates name, description, category, or color of an existing tag. System tags (`isSystem: true`) cannot be modified.

```ts
updateTagAction(
  tagId: string,
  updates: Partial<Pick<Tag, 'name' | 'description' | 'category' | 'color'>>,
  userId: string,
  userName?: string
): Promise<{ success: true } | { success: false; error: string }>
```

---

### `deleteTagAction`

Deletes a tag and removes it from every school and prospect in batches of 500.

```ts
deleteTagAction(
  tagId: string,
  userId: string,
  userName?: string
): Promise<{ success: true; affectedCount: number } | { success: false; error: string }>
```

---

### `mergeTagsAction`

Merges one or more source tags into a target tag. Source tags are deleted; contacts are updated to carry the target tag instead. The earliest `taggedAt` timestamp from the source tags is preserved.

```ts
mergeTagsAction(
  sourceTagIds: string[],  // min 1
  targetTagId: string,
  userId: string,
  userName?: string
): Promise<{ success: true; affectedCount: number } | { success: false; error: string }>
```

---

### `getTagsAction`

Returns all tags for a workspace, ordered by category then name.

```ts
getTagsAction(workspaceId: string): Promise<
  { success: true; data: Tag[] } | { success: false; error: string }
>
```

---

### `applyTagsAction`

Applies one or more tags to a single contact. Already-applied tags are skipped (idempotent). Fires `TAG_ADDED` automation triggers for each newly applied tag.

```ts
applyTagsAction(
  contactId: string,
  contactType: 'school' | 'prospect',
  tagIds: string[],        // min 1
  userId: string,
  userName?: string
): Promise<{ success: true } | { success: false; error: string }>
```

---

### `removeTagsAction`

Removes one or more tags from a single contact. Tags not present on the contact are silently ignored. Fires `TAG_REMOVED` automation triggers for each actually-removed tag.

```ts
removeTagsAction(
  contactId: string,
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string
): Promise<{ success: true } | { success: false; error: string }>
```

---

### `bulkApplyTagsAction`

Applies tags to many contacts. Processes in chunks of 100; each chunk is committed atomically. Failed chunks are recorded in `partialFailures` and processing continues (partial-failure tolerance).

```ts
bulkApplyTagsAction(
  contactIds: string[],
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  success: boolean;
  processedCount?: number;
  failedCount?: number;
  errors?: string[];
  partialFailures?: string[];
  error?: string;
}>
```

---

### `bulkRemoveTagsAction`

Same shape as `bulkApplyTagsAction` but removes tags. Decrements `usageCount` on each tag.

```ts
bulkRemoveTagsAction(
  contactIds: string[],
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string,
  userName?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ /* same as bulkApplyTagsAction */ }>
```

---

### `getContactsByTagsAction`

Queries contacts by tag filter with AND / OR / NOT logic.

```ts
getContactsByTagsAction(
  workspaceId: string,
  filter: {
    tagIds: string[];
    logic: 'AND' | 'OR' | 'NOT';
    categoryFilter?: TagCategory;
  }
): Promise<{ success: true; data: string[] } | { success: false; error: string }>
```

- `OR` — uses Firestore `array-contains-any` (chunked at 10).
- `AND` — queries first tag, then filters client-side for the rest.
- `NOT` — fetches all workspace contacts, excludes those with any of the tags.
- `categoryFilter` — restricts `tagIds` to those belonging to the given category.

---

### `getTagUsageStatsAction`

Returns per-tag usage statistics including trend direction (last 30 days vs prior 30 days), campaign usage, and automation usage.

```ts
getTagUsageStatsAction(workspaceId: string): Promise<{
  success: true;
  data: TagUsageStats[];
} | { success: false; error: string }>

// TagUsageStats shape:
{
  tagId: string;
  tagName: string;
  contactCount: number;
  lastUsed: string;          // ISO timestamp
  trendDirection: 'up' | 'down' | 'stable';
  campaignUsage: number;
  automationUsage: number;
}
```

---

### `getTagAuditLogsAction`

Fetches audit log entries for a workspace with optional filters.

```ts
getTagAuditLogsAction(
  workspaceId: string,
  filters?: {
    tagId?: string;
    contactId?: string;
    userId?: string;
    action?: 'created' | 'updated' | 'deleted' | 'merged' | 'applied' | 'removed';
    startDate?: string;  // ISO
    endDate?: string;    // ISO
    limit?: number;      // default 100
  }
): Promise<{ success: true; data: TagAuditLog[] } | { success: false; error: string }>
```

---

### `bulkDeleteUnusedTagsAction`

Deletes all non-system tags with `usageCount === 0` in a workspace.

```ts
bulkDeleteUnusedTagsAction(
  workspaceId: string,
  userId: string,
  userName?: string
): Promise<{ success: true; deletedCount: number } | { success: false; error: string }>
```

---

### Retry wrapper

For transient Firestore failures, wrap any action with `withRetryAction` from `src/lib/tag-retry.ts`:

```ts
import { withRetryAction } from '@/lib/tag-retry';

const result = await withRetryAction(
  () => applyTagsAction(contactId, 'school', tagIds, userId),
  { maxAttempts: 3, baseDelayMs: 500 }
);
```

Validation and permission errors are never retried. Exponential backoff: 500 ms → 1 s → 2 s.

---

## 2. Component Usage Examples

All components are exported from `src/components/tags/index.ts`.

```ts
import {
  TagSelector,
  TagBadges,
  TagFilter,
  BulkTagOperations,
} from '@/components/tags';
```

---

### `TagSelector`

Dropdown for applying / removing tags on a single contact. Handles its own server action calls internally.

```tsx
'use client';

import { TagSelector } from '@/components/tags';

export function SchoolDetailPanel({ school, userId }: Props) {
  return (
    <TagSelector
      contactId={school.id}
      contactType="school"
      currentTagIds={school.tags ?? []}
      workspaceId={school.workspaceId}
      userId={userId}
    />
  );
}
```

---

### `TagBadges`

Read-only display of applied tags. Suitable for list rows, detail panels, and cards.

```tsx
import { TagBadges } from '@/components/tags';

// Inside a server component or client component
<TagBadges tagIds={contact.tags ?? []} workspaceId={workspaceId} />
```

Pass `maxVisible` to cap the number of badges shown before a "+N more" overflow indicator.

```tsx
<TagBadges tagIds={contact.tags ?? []} workspaceId={workspaceId} maxVisible={3} />
```

---

### `TagFilter`

Filter panel that lets users build AND / OR / NOT tag queries. Calls `getContactsByTagsAction` and returns matching contact IDs to the parent via `onFilterChange`.

```tsx
'use client';

import { TagFilter } from '@/components/tags';

export function ContactListPage({ workspaceId }: Props) {
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);

  return (
    <>
      <TagFilter
        workspaceId={workspaceId}
        onFilterChange={setFilteredIds}
      />
      <ContactTable contactIds={filteredIds} />
    </>
  );
}
```

---

### `BulkTagOperations`

Toolbar component for applying or removing tags across a selection of contacts. Accepts the selected contact IDs and calls `bulkApplyTagsAction` / `bulkRemoveTagsAction` internally. Shows a progress indicator during processing.

```tsx
'use client';

import { BulkTagOperations } from '@/components/tags';

export function ContactsToolbar({ selectedIds, contactType, workspaceId, userId }: Props) {
  return (
    <BulkTagOperations
      selectedContactIds={selectedIds}
      contactType={contactType}
      workspaceId={workspaceId}
      userId={userId}
      onComplete={() => router.refresh()}
    />
  );
}
```

---

## 3. Integration Guide

### 3.1 Adding tag support to a new contact type

The system currently supports `school` and `prospect`. To add a new type (e.g. `partner`):

**1. Extend the union type** in `src/lib/types.ts`:

```ts
export type ContactType = 'school' | 'prospect' | 'partner';
```

**2. Update every action that branches on `contactType`** in `src/lib/tag-actions.ts`. Search for `contactType === 'school' ? 'schools' : 'prospects'` and add the new branch:

```ts
function collectionForType(contactType: ContactType): string {
  if (contactType === 'school') return 'schools';
  if (contactType === 'prospect') return 'prospects';
  if (contactType === 'partner') return 'partners';
  throw new Error(`Unknown contact type: ${contactType}`);
}
```

**3. Update the Zod schemas** in `src/lib/tag-schemas.ts`:

```ts
contactType: z.enum(['school', 'prospect', 'partner'], { ... }),
```

**4. Update `fireTagTrigger`** in `src/lib/tag-trigger.ts` — the `TagTriggerPayload.contactType` union needs the new value.

**5. Ensure the Firestore document** for the new type stores `tags: string[]`, `taggedAt: Record<string, string>`, and `taggedBy: Record<string, string>` fields.

---

### 3.2 Adding tag variables to a new message template

Tag data can be injected into message templates as variables.

**1. Resolve the contact's tags** before rendering the template:

```ts
import { getTagsAction } from '@/lib/tag-actions';

const tagsResult = await getTagsAction(workspaceId);
const tagMap = new Map(tagsResult.data?.map(t => [t.id, t]) ?? []);

const contactTagNames = (contact.tags ?? [])
  .map(id => tagMap.get(id)?.name)
  .filter(Boolean)
  .join(', ');
```

**2. Inject into the template variable bag**:

```ts
const variables = {
  // ...existing variables
  contact_tags: contactTagNames,           // "VIP, Enrolled, High Priority"
  contact_tag_ids: contact.tags ?? [],     // raw IDs for downstream logic
};
```

**3. Reference in the template string**:

```
Hello {{first_name}}, your current tags are: {{contact_tags}}.
```

---

### 3.3 Adding tag triggers to a new automation type

Tag triggers (`TAG_ADDED`, `TAG_REMOVED`) fire automatically from `applyTagsAction` and `removeTagsAction`. To make a new automation type respond to them:

**1. Create an `AutomationRule` document** in Firestore with `trigger: 'TAG_ADDED'` or `trigger: 'TAG_REMOVED'` and `isActive: true`.

**2. Configure `triggerConfig`** (type `TagTriggerConfig`) to scope the rule:

```ts
const rule = {
  trigger: 'TAG_ADDED',
  isActive: true,
  workspaceIds: ['ws-123'],
  triggerConfig: {
    tagIds: ['tag-vip'],          // only fire for this tag (empty = any tag)
    contactType: 'school',        // optional: scope to one contact type
    appliedBy: 'manual',          // 'manual' | 'automatic' | undefined (any)
  },
  actions: [
    {
      type: 'CREATE_TASK',
      taskTitle: 'Follow up with VIP school',
      taskPriority: 'high',
      taskDueOffsetDays: 2,
    },
  ],
};
```

**3. Supported action types** in `executeTagAutomationRule` (`src/lib/tag-trigger.ts`):

| `action.type` | What it does |
|---|---|
| `CREATE_TASK` | Creates a task linked to the contact |
| `UPDATE_FIELD` | Updates a field on the contact document (`fixedRecipient: "field=value"`) |
| `SEND_MESSAGE` | Logged; requires messaging engine integration |

**4. To add a new action type**, extend the `switch` in `executeTagAutomationRule`.

---

### 3.4 Using tag conditions in automation flows

`evaluateTagCondition` in `src/lib/tag-condition.ts` evaluates a `TagConditionNode` against a contact's current tags:

```ts
import { evaluateTagCondition } from '@/lib/tag-condition';

const passes = evaluateTagCondition(contact.tags ?? [], {
  data: {
    logic: 'has_all_tags',   // 'has_tag' | 'has_any_tag' | 'has_all_tags' | 'not_has_tag'
    tagIds: ['tag-enrolled', 'tag-vip'],
  },
});
```

An empty `tagIds` array is treated as trivially `true`.

---

### 3.5 Executing tag actions from automation nodes

`executeTagAction` in `src/lib/tag-action-executor.ts` is the entry point for automation flow runners:

```ts
import { executeTagAction } from '@/lib/tag-action-executor';

await executeTagAction(
  node,          // TagActionNode: { data: { action: 'add_tags' | 'remove_tags', tagIds: string[] } }
  contactId,
  contactType,
  'system-automation'  // userId — prefix with 'system' to mark as automatic
);
```

---

### 3.6 Reference integrity

`src/lib/tag-integrity.ts` provides utilities for keeping tag references clean:

```ts
import {
  validateTagReferences,
  detectOrphanedTagReferences,
  cleanupOrphanedTagReferences,
} from '@/lib/tag-integrity';

// Check a single contact
const { valid, orphanedTagIds } = await validateTagReferences(contactId, 'school');

// Scan the whole workspace (run as a background job)
const report = await detectOrphanedTagReferences();
console.log(`${report.totalOrphanedRefs} orphaned refs across ${report.scannedContacts} contacts`);

// Clean up
const { cleanedContacts, removedRefs } = await cleanupOrphanedTagReferences(report);
```

---

## 4. Testing Approach

### 4.1 Framework

Tests use **Vitest** with **fast-check** for property-based testing. The test file is:

```
src/lib/__tests__/tag-actions.property.test.ts
```

### 4.2 Running tests

```bash
# Run once (CI / local verification)
npx vitest --run src/lib/__tests__/tag-actions.property.test.ts

# Run all tests once
npx vitest --run

# Watch mode (development)
npx vitest
```

### 4.3 What is property-based testing?

Instead of hand-writing specific inputs, fast-check generates hundreds of random inputs and checks that a *property* (a universal invariant) holds for all of them. A single failing example is reported as a minimal counterexample.

```ts
import fc from 'fast-check';

await fc.assert(
  fc.asyncProperty(
    fc.string({ minLength: 51, maxLength: 200 }),  // generator
    async (name) => {
      const result = await createTagAction({ name, /* ... */ });
      expect(result.success).toBe(false);  // property
    }
  ),
  { numRuns: 100 }
);
```

### 4.4 Properties tested

| Property | What it verifies |
|---|---|
| **1 — Tag Name Validation** | Empty names, names > 50 chars, whitespace-only, invalid characters, and boundary cases (exactly 50 / 51 chars) are all rejected; valid names are accepted |
| **2 — Tag Name Uniqueness** | Duplicate names (case-insensitive) in the same workspace are rejected; the same name in different workspaces is allowed |
| **5 — System Tag Immutability** | `updateTagAction` and `deleteTagAction` always fail for tags with `isSystem: true`, regardless of which fields are updated or who calls them |

### 4.5 Mock strategy

Firestore is mocked via `vi.mock('../firebase-admin')`. The mock is reset in `beforeEach` so each property run starts with a clean state. The `users` collection always returns a document with `['tags_manage', 'tags_apply']` permissions so permission checks don't interfere with the validation being tested.

```ts
function withUserPermissions(innerMock) {
  return (collectionName) => {
    if (collectionName === 'users') {
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ permissions: ['tags_manage', 'tags_apply', 'system_admin'] }),
          }),
        })),
      };
    }
    return innerMock(collectionName);
  };
}
```

### 4.6 Adding a new property test

1. Identify the invariant (e.g. "color must always be a valid hex string").
2. Write a generator that produces inputs covering the full input space.
3. Add a `describe` block named `Property N: <Name>` with `numRuns: 20` for fast CI runs (increase to 100+ for thorough local checks).
4. Add a comment `// Validates: Requirements X.Y` above the `it` block.

```ts
describe('Property 6: Color Validation', () => {
  it('should reject non-hex colors', async () => {
    // Validates: Requirements FR1.1.3
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => !/^#[0-9A-Fa-f]{6}$/.test(s)),
        async (color) => {
          const result = await createTagAction({ color, /* valid other fields */ });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});
```
