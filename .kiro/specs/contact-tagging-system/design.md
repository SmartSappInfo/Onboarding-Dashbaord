# Contact Tagging System - Design Document

## Overview

The Contact Tagging System provides a flexible, scalable solution for organizing and categorizing contacts (schools, prospects, focal persons) within the SmartSapp CRM. This system enables intelligent segmentation, personalized campaigns, automation triggers, and behavioral tracking through lightweight, dynamic labels.

### Design Goals

1. **Flexible Organization**: Enable dynamic contact categorization without rigid schema changes
2. **Performance**: Support efficient filtering and querying across 10,000+ contacts
3. **Integration**: Seamlessly integrate with messaging, automation, and campaign systems
4. **Governance**: Maintain clean, organized tag data through proper management tools
5. **Multi-Tenancy**: Ensure workspace-scoped isolation with proper security boundaries

### Key Features

- Tag CRUD operations with category organization
- Bulk tag application/removal for efficient operations
- Advanced filtering with AND/OR/NOT logic
- Real-time tag updates using Firestore listeners
- Integration with automation engine for tag-based triggers
- Tag-based campaign segmentation
- Comprehensive analytics and audit trails

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Tag Management UI  │  Contact Tagging UI  │  Filter UI     │
│  (Server Component) │  (Client Component)  │  (Client)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                    │
├─────────────────────────────────────────────────────────────┤
│  Tag Actions        │  Tagging Actions    │  Query Builder  │
│  (Server Actions)   │  (Server Actions)   │  (Server)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Integration Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Automation Engine  │  Messaging System   │  Activity Logger│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Firestore Collections: tags, schools, prospects            │
│  Indexes: tag arrays, workspace scoping, timestamps         │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Tag Management UI** (Server Component)
- Display tag library with categories
- Tag creation, editing, deletion forms
- Tag merge functionality
- Usage statistics and analytics

**Contact Tagging UI** (Client Component)
- Tag selector with autocomplete
- Bulk tag operations interface
- Real-time tag updates via Firestore listeners
- Tag badge display on contact cards

**Server Actions**
- `createTag()`: Create new tags with validation
- `updateTag()`: Modify tag properties
- `deleteTag()`: Remove tags with cascade handling
- `mergeTags()`: Combine duplicate tags
- `applyTags()`: Add tags to contacts (single/bulk)
- `removeTags()`: Remove tags from contacts (single/bulk)
- `queryContactsByTags()`: Advanced tag-based filtering

**Integration Points**
- Automation engine: Tag-based triggers and conditions
- Messaging system: Tag variables in templates
- Activity logger: Tag change audit trail
- Campaign system: Tag-based segmentation


## Components and Interfaces

### 1. Tag Management Page

**Location**: `/admin/contacts/tags`

**Component Structure**:
```typescript
// Server Component (default)
export default async function TagsPage() {
  // Fetch initial data server-side
  const tags = await getTags();
  const usageStats = await getTagUsageStats();
  
  return <TagsClient initialTags={tags} initialStats={usageStats} />;
}
```

**Client Component** (`TagsClient.tsx`):
```typescript
'use client';

interface TagsClientProps {
  initialTags: Tag[];
  initialStats: TagUsageStats;
}

export default function TagsClient({ initialTags, initialStats }: TagsClientProps) {
  // Real-time subscription to tags collection
  const { data: tags } = useCollection<Tag>(tagsQuery);
  
  return (
    <div className="space-y-8">
      <TagsHeader onCreateTag={handleCreateTag} />
      <TagsStats stats={stats} />
      <TagsTable tags={tags} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  );
}
```

### 2. Tag Selector Component

**Reusable Client Component** for applying tags to contacts:

```typescript
'use client';

interface TagSelectorProps {
  contactId: string;
  contactType: 'school' | 'prospect';
  currentTags: string[]; // Array of tag IDs
  onTagsChange?: (tags: string[]) => void;
}

export function TagSelector({ 
  contactId, 
  contactType, 
  currentTags, 
  onTagsChange 
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Real-time tags subscription
  const { data: availableTags } = useCollection<Tag>(tagsQuery);
  
  const handleApplyTag = async (tagId: string) => {
    await applyTagsAction(contactId, contactType, [tagId]);
    onTagsChange?.([...currentTags, tagId]);
  };
  
  const handleRemoveTag = async (tagId: string) => {
    await removeTagsAction(contactId, contactType, [tagId]);
    onTagsChange?.(currentTags.filter(id => id !== tagId));
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tag className="h-4 w-4" />
          Tags ({currentTags.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <TagSelectorContent
          availableTags={availableTags}
          currentTags={currentTags}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onApply={handleApplyTag}
          onRemove={handleRemoveTag}
        />
      </PopoverContent>
    </Popover>
  );
}
```


### 3. Bulk Tag Operations Component

**Client Component** for bulk operations from list views:

```typescript
'use client';

interface BulkTagOperationsProps {
  selectedContacts: string[];
  contactType: 'school' | 'prospect';
  onComplete: () => void;
}

export function BulkTagOperations({ 
  selectedContacts, 
  contactType, 
  onComplete 
}: BulkTagOperationsProps) {
  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleExecute = async () => {
    setIsProcessing(true);
    
    if (operation === 'add') {
      await bulkApplyTagsAction(selectedContacts, contactType, selectedTags);
    } else {
      await bulkRemoveTagsAction(selectedContacts, contactType, selectedTags);
    }
    
    setIsProcessing(false);
    onComplete();
  };
  
  return (
    <Dialog>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Tag Operations</DialogTitle>
          <DialogDescription>
            Apply or remove tags from {selectedContacts.length} selected contacts
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <RadioGroup value={operation} onValueChange={setOperation}>
            <RadioGroupItem value="add" label="Add Tags" />
            <RadioGroupItem value="remove" label="Remove Tags" />
          </RadioGroup>
          
          <TagMultiSelect
            selectedTags={selectedTags}
            onSelectionChange={setSelectedTags}
          />
          
          {isProcessing && (
            <Progress value={progress} className="w-full" />
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={handleExecute} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Execute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Tag Filter Component

**Client Component** for filtering contact lists:

```typescript
'use client';

interface TagFilterProps {
  onFilterChange: (filter: TagFilter) => void;
}

interface TagFilter {
  tagIds: string[];
  logic: 'AND' | 'OR' | 'NOT';
  categoryFilter?: TagCategory;
}

export function TagFilter({ onFilterChange }: TagFilterProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [logic, setLogic] = useState<'AND' | 'OR' | 'NOT'>('AND');
  const [category, setCategory] = useState<TagCategory | undefined>();
  
  useEffect(() => {
    onFilterChange({
      tagIds: selectedTags,
      logic,
      categoryFilter: category
    });
  }, [selectedTags, logic, category]);
  
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xs font-black uppercase tracking-widest">
          Filter by Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TagMultiSelect
          selectedTags={selectedTags}
          onSelectionChange={setSelectedTags}
        />
        
        <Select value={logic} onValueChange={setLogic}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">Has all tags (AND)</SelectItem>
            <SelectItem value="OR">Has any tag (OR)</SelectItem>
            <SelectItem value="NOT">Does not have tags (NOT)</SelectItem>
          </SelectContent>
        </Select>
        
        <CategoryFilter value={category} onChange={setCategory} />
      </CardContent>
    </Card>
  );
}
```


## Data Models

### TypeScript Interfaces

```typescript
/**
 * Tag Category Types
 */
export type TagCategory = 
  | 'behavioral'    // Actions taken (Downloaded, Attended, Clicked)
  | 'demographic'   // Location, size, type
  | 'interest'      // Product/service interests
  | 'status'        // Current state (Hot Lead, Active, Churned)
  | 'lifecycle'     // Journey stage (Prospect, Onboarding, Renewal)
  | 'engagement'    // Activity level (Highly Engaged, Inactive)
  | 'custom';       // User-defined

/**
 * Tag Definition
 * Stored in 'tags' collection
 */
export interface Tag {
  id: string;
  workspaceId: string;           // Workspace-scoped
  organizationId: string;        // For org-level analytics
  name: string;                  // Display name (max 50 chars)
  slug: string;                  // URL-safe identifier
  description?: string;          // Optional description (max 200 chars)
  category: TagCategory;         // Tag category
  color: string;                 // Hex color code
  isSystem: boolean;             // System-generated (read-only)
  usageCount: number;            // Denormalized count for performance
  createdBy: string;             // User ID
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Contact Tag Association
 * Embedded in contact documents (schools, prospects)
 */
export interface ContactTagging {
  tags: string[];                           // Array of tag IDs
  taggedAt: { [tagId: string]: string };    // When each tag was applied
  taggedBy: { [tagId: string]: string };    // Who applied each tag
}

/**
 * Extended School interface with tagging
 */
export interface School extends ContactTagging {
  // ... existing School fields
  id: string;
  name: string;
  workspaceIds: string[];
  // ... other fields
  
  // Tagging fields
  tags: string[];
  taggedAt: { [tagId: string]: string };
  taggedBy: { [tagId: string]: string };
}

/**
 * Tag Usage Statistics
 */
export interface TagUsageStats {
  tagId: string;
  tagName: string;
  contactCount: number;
  lastUsed: string;
  trendDirection: 'up' | 'down' | 'stable';
  campaignUsage: number;
  automationUsage: number;
}

/**
 * Tag Audit Log Entry
 */
export interface TagAuditLog {
  id: string;
  workspaceId: string;
  action: 'created' | 'updated' | 'deleted' | 'merged' | 'applied' | 'removed';
  tagId: string;
  tagName: string;
  contactId?: string;
  contactName?: string;
  userId: string;
  userName: string;
  timestamp: string;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    mergedIntoTagId?: string;
    bulkOperation?: boolean;
    affectedCount?: number;
  };
}

/**
 * Tag Filter Query
 */
export interface TagFilterQuery {
  tagIds: string[];
  logic: 'AND' | 'OR' | 'NOT';
  categoryFilter?: TagCategory;
  dateRange?: {
    field: 'taggedAt' | 'createdAt';
    start: string;
    end: string;
  };
}
```


### Firestore Schema

**Collection: `tags`**
```typescript
{
  id: "tag_hot_lead",
  workspaceId: "ws_123",
  organizationId: "org_456",
  name: "Hot Lead",
  slug: "hot-lead",
  description: "High-priority prospects showing strong interest",
  category: "status",
  color: "#EF4444",
  isSystem: false,
  usageCount: 47,
  createdBy: "user_789",
  createdAt: "2026-03-23T10:00:00Z",
  updatedAt: "2026-03-23T10:00:00Z"
}
```

**Collection: `schools` (with tagging)**
```typescript
{
  id: "school_abc",
  name: "Accra International School",
  workspaceIds: ["ws_123"],
  // ... other school fields
  
  // Tagging fields
  tags: ["tag_hot_lead", "tag_attended_webinar", "tag_interested_analytics"],
  taggedAt: {
    "tag_hot_lead": "2026-03-20T14:30:00Z",
    "tag_attended_webinar": "2026-03-21T09:15:00Z",
    "tag_interested_analytics": "2026-03-22T16:45:00Z"
  },
  taggedBy: {
    "tag_hot_lead": "user_789",
    "tag_attended_webinar": "system_automation",
    "tag_interested_analytics": "user_789"
  }
}
```

**Collection: `tag_audit_logs`**
```typescript
{
  id: "audit_xyz",
  workspaceId: "ws_123",
  action: "applied",
  tagId: "tag_hot_lead",
  tagName: "Hot Lead",
  contactId: "school_abc",
  contactName: "Accra International School",
  userId: "user_789",
  userName: "Ama Mensah",
  timestamp: "2026-03-20T14:30:00Z",
  metadata: {
    bulkOperation: false
  }
}
```

### Firestore Indexes

Required composite indexes for efficient querying:

```json
{
  "indexes": [
    {
      "collectionGroup": "tags",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "tags",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "usageCount", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "schools",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "tag_audit_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tag_audit_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tagId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```


## API Design (Server Actions)

### Tag Management Actions

**File**: `src/lib/tag-actions.ts`

```typescript
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Tag, TagCategory } from './types';

/**
 * Creates a new tag
 */
export async function createTagAction(data: {
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  category: TagCategory;
  color: string;
  userId: string;
}) {
  try {
    const slug = data.name.toLowerCase().replace(/\s+/g, '-');
    
    // Check for duplicate names in workspace
    const existingSnap = await adminDb
      .collection('tags')
      .where('workspaceId', '==', data.workspaceId)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    
    if (!existingSnap.empty) {
      return { 
        success: false, 
        error: 'A tag with this name already exists' 
      };
    }
    
    const tagRef = adminDb.collection('tags').doc();
    const tag: Tag = {
      id: tagRef.id,
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      name: data.name,
      slug,
      description: data.description,
      category: data.category,
      color: data.color,
      isSystem: false,
      usageCount: 0,
      createdBy: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await tagRef.set(tag);
    
    // Log audit trail
    await logTagAudit({
      workspaceId: data.workspaceId,
      action: 'created',
      tagId: tag.id,
      tagName: tag.name,
      userId: data.userId
    });
    
    revalidatePath('/admin/contacts/tags');
    return { success: true, data: tag };
  } catch (error: any) {
    console.error('Create tag error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates an existing tag
 */
export async function updateTagAction(
  tagId: string,
  updates: Partial<Pick<Tag, 'name' | 'description' | 'category' | 'color'>>
) {
  try {
    const tagRef = adminDb.collection('tags').doc(tagId);
    const tagSnap = await tagRef.get();
    
    if (!tagSnap.exists) {
      return { success: false, error: 'Tag not found' };
    }
    
    const tag = tagSnap.data() as Tag;
    
    if (tag.isSystem) {
      return { success: false, error: 'Cannot edit system tags' };
    }
    
    await tagRef.update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    revalidatePath('/admin/contacts/tags');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a tag and removes it from all contacts
 */
export async function deleteTagAction(
  tagId: string,
  userId: string
) {
  try {
    const tagRef = adminDb.collection('tags').doc(tagId);
    const tagSnap = await tagRef.get();
    
    if (!tagSnap.exists) {
      return { success: false, error: 'Tag not found' };
    }
    
    const tag = tagSnap.data() as Tag;
    
    if (tag.isSystem) {
      return { success: false, error: 'Cannot delete system tags' };
    }
    
    // Remove tag from all schools
    const schoolsSnap = await adminDb
      .collection('schools')
      .where('tags', 'array-contains', tagId)
      .get();
    
    const batch = adminDb.batch();
    
    schoolsSnap.forEach(doc => {
      const tags = (doc.data().tags || []).filter((t: string) => t !== tagId);
      const taggedAt = { ...doc.data().taggedAt };
      const taggedBy = { ...doc.data().taggedBy };
      delete taggedAt[tagId];
      delete taggedBy[tagId];
      
      batch.update(doc.ref, { tags, taggedAt, taggedBy });
    });
    
    // Delete the tag
    batch.delete(tagRef);
    
    await batch.commit();
    
    // Log audit trail
    await logTagAudit({
      workspaceId: tag.workspaceId,
      action: 'deleted',
      tagId: tag.id,
      tagName: tag.name,
      userId,
      metadata: { affectedCount: schoolsSnap.size }
    });
    
    revalidatePath('/admin/contacts/tags');
    revalidatePath('/admin/schools');
    return { success: true, affectedCount: schoolsSnap.size };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```


/**
 * Merges multiple tags into a single target tag
 */
export async function mergeTagsAction(
  sourceTagIds: string[],
  targetTagId: string,
  userId: string
) {
  try {
    const batch = adminDb.batch();
    
    // Get all tags
    const tagsSnap = await adminDb
      .collection('tags')
      .where('__name__', 'in', [...sourceTagIds, targetTagId])
      .get();
    
    const tags = new Map(tagsSnap.docs.map(d => [d.id, d.data() as Tag]));
    const targetTag = tags.get(targetTagId);
    
    if (!targetTag) {
      return { success: false, error: 'Target tag not found' };
    }
    
    // Find all contacts with source tags
    const contactsToUpdate = new Set<string>();
    
    for (const sourceTagId of sourceTagIds) {
      const schoolsSnap = await adminDb
        .collection('schools')
        .where('tags', 'array-contains', sourceTagId)
        .get();
      
      schoolsSnap.forEach(doc => contactsToUpdate.add(doc.id));
    }
    
    // Update contacts
    for (const contactId of contactsToUpdate) {
      const contactRef = adminDb.collection('schools').doc(contactId);
      const contactSnap = await contactRef.get();
      const contactData = contactSnap.data();
      
      if (!contactData) continue;
      
      const tags = new Set(contactData.tags || []);
      sourceTagIds.forEach(id => tags.delete(id));
      tags.add(targetTagId);
      
      const taggedAt = { ...contactData.taggedAt };
      const taggedBy = { ...contactData.taggedBy };
      
      // Keep earliest timestamp
      const earliestTimestamp = sourceTagIds
        .map(id => taggedAt[id])
        .filter(Boolean)
        .sort()[0] || new Date().toISOString();
      
      sourceTagIds.forEach(id => {
        delete taggedAt[id];
        delete taggedBy[id];
      });
      
      taggedAt[targetTagId] = earliestTimestamp;
      taggedBy[targetTagId] = userId;
      
      batch.update(contactRef, {
        tags: Array.from(tags),
        taggedAt,
        taggedBy
      });
    }
    
    // Delete source tags
    sourceTagIds.forEach(id => {
      batch.delete(adminDb.collection('tags').doc(id));
    });
    
    // Update target tag usage count
    batch.update(adminDb.collection('tags').doc(targetTagId), {
      usageCount: contactsToUpdate.size,
      updatedAt: new Date().toISOString()
    });
    
    await batch.commit();
    
    // Log audit trail
    await logTagAudit({
      workspaceId: targetTag.workspaceId,
      action: 'merged',
      tagId: targetTagId,
      tagName: targetTag.name,
      userId,
      metadata: {
        mergedTagIds: sourceTagIds,
        affectedCount: contactsToUpdate.size
      }
    });
    
    revalidatePath('/admin/contacts/tags');
    revalidatePath('/admin/schools');
    return { success: true, affectedCount: contactsToUpdate.size };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Gets all tags for a workspace
 */
export async function getTagsAction(workspaceId: string) {
  try {
    const tagsSnap = await adminDb
      .collection('tags')
      .where('workspaceId', '==', workspaceId)
      .orderBy('category', 'asc')
      .orderBy('name', 'asc')
      .get();
    
    const tags = tagsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tag[];
    
    return { success: true, data: tags };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```


### Contact Tagging Actions

```typescript
/**
 * Applies tags to a single contact
 */
export async function applyTagsAction(
  contactId: string,
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string
) {
  try {
    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const contactRef = adminDb.collection(collection).doc(contactId);
    const contactSnap = await contactRef.get();
    
    if (!contactSnap.exists) {
      return { success: false, error: 'Contact not found' };
    }
    
    const contactData = contactSnap.data();
    const existingTags = new Set(contactData?.tags || []);
    const taggedAt = { ...contactData?.taggedAt };
    const taggedBy = { ...contactData?.taggedBy };
    const timestamp = new Date().toISOString();
    
    // Add new tags
    tagIds.forEach(tagId => {
      if (!existingTags.has(tagId)) {
        existingTags.add(tagId);
        taggedAt[tagId] = timestamp;
        taggedBy[tagId] = userId;
      }
    });
    
    await contactRef.update({
      tags: Array.from(existingTags),
      taggedAt,
      taggedBy
    });
    
    // Update tag usage counts
    const batch = adminDb.batch();
    for (const tagId of tagIds) {
      const tagRef = adminDb.collection('tags').doc(tagId);
      batch.update(tagRef, {
        usageCount: adminDb.FieldValue.increment(1)
      });
    }
    await batch.commit();
    
    // Log audit trail
    for (const tagId of tagIds) {
      const tagSnap = await adminDb.collection('tags').doc(tagId).get();
      const tag = tagSnap.data() as Tag;
      
      await logTagAudit({
        workspaceId: tag.workspaceId,
        action: 'applied',
        tagId,
        tagName: tag.name,
        contactId,
        contactName: contactData?.name,
        userId
      });
    }
    
    revalidatePath(`/admin/${collection}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Removes tags from a single contact
 */
export async function removeTagsAction(
  contactId: string,
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string
) {
  try {
    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const contactRef = adminDb.collection(collection).doc(contactId);
    const contactSnap = await contactRef.get();
    
    if (!contactSnap.exists) {
      return { success: false, error: 'Contact not found' };
    }
    
    const contactData = contactSnap.data();
    const tags = (contactData?.tags || []).filter(
      (t: string) => !tagIds.includes(t)
    );
    const taggedAt = { ...contactData?.taggedAt };
    const taggedBy = { ...contactData?.taggedBy };
    
    tagIds.forEach(tagId => {
      delete taggedAt[tagId];
      delete taggedBy[tagId];
    });
    
    await contactRef.update({ tags, taggedAt, taggedBy });
    
    // Update tag usage counts
    const batch = adminDb.batch();
    for (const tagId of tagIds) {
      const tagRef = adminDb.collection('tags').doc(tagId);
      batch.update(tagRef, {
        usageCount: adminDb.FieldValue.increment(-1)
      });
    }
    await batch.commit();
    
    // Log audit trail
    for (const tagId of tagIds) {
      const tagSnap = await adminDb.collection('tags').doc(tagId).get();
      const tag = tagSnap.data() as Tag;
      
      await logTagAudit({
        workspaceId: tag.workspaceId,
        action: 'removed',
        tagId,
        tagName: tag.name,
        contactId,
        contactName: contactData?.name,
        userId
      });
    }
    
    revalidatePath(`/admin/${collection}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```


/**
 * Bulk applies tags to multiple contacts
 */
export async function bulkApplyTagsAction(
  contactIds: string[],
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string
) {
  try {
    const collection = contactType === 'school' ? 'schools' : 'prospects';
    const timestamp = new Date().toISOString();
    
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    let processedCount = 0;
    
    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batchIds = contactIds.slice(i, i + batchSize);
      const batch = adminDb.batch();
      
      for (const contactId of batchIds) {
        const contactRef = adminDb.collection(collection).doc(contactId);
        const contactSnap = await contactRef.get();
        
        if (!contactSnap.exists) continue;
        
        const contactData = contactSnap.data();
        const existingTags = new Set(contactData?.tags || []);
        const taggedAt = { ...contactData?.taggedAt };
        const taggedBy = { ...contactData?.taggedBy };
        
        tagIds.forEach(tagId => {
          if (!existingTags.has(tagId)) {
            existingTags.add(tagId);
            taggedAt[tagId] = timestamp;
            taggedBy[tagId] = userId;
          }
        });
        
        batch.update(contactRef, {
          tags: Array.from(existingTags),
          taggedAt,
          taggedBy
        });
        
        processedCount++;
      }
      
      await batch.commit();
    }
    
    // Update tag usage counts
    const tagBatch = adminDb.batch();
    for (const tagId of tagIds) {
      const tagRef = adminDb.collection('tags').doc(tagId);
      tagBatch.update(tagRef, {
        usageCount: adminDb.FieldValue.increment(processedCount)
      });
    }
    await tagBatch.commit();
    
    // Log bulk operation
    const firstTag = await adminDb.collection('tags').doc(tagIds[0]).get();
    const tag = firstTag.data() as Tag;
    
    await logTagAudit({
      workspaceId: tag.workspaceId,
      action: 'applied',
      tagId: tagIds[0],
      tagName: `${tagIds.length} tags`,
      userId,
      metadata: {
        bulkOperation: true,
        affectedCount: processedCount,
        tagIds
      }
    });
    
    revalidatePath(`/admin/${collection}`);
    return { success: true, processedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Bulk removes tags from multiple contacts
 */
export async function bulkRemoveTagsAction(
  contactIds: string[],
  contactType: 'school' | 'prospect',
  tagIds: string[],
  userId: string
) {
  try {
    const collection = contactType === 'school' ? 'schools' : 'prospects';
    
    const batchSize = 500;
    let processedCount = 0;
    
    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batchIds = contactIds.slice(i, i + batchSize);
      const batch = adminDb.batch();
      
      for (const contactId of batchIds) {
        const contactRef = adminDb.collection(collection).doc(contactId);
        const contactSnap = await contactRef.get();
        
        if (!contactSnap.exists) continue;
        
        const contactData = contactSnap.data();
        const tags = (contactData?.tags || []).filter(
          (t: string) => !tagIds.includes(t)
        );
        const taggedAt = { ...contactData?.taggedAt };
        const taggedBy = { ...contactData?.taggedBy };
        
        tagIds.forEach(tagId => {
          delete taggedAt[tagId];
          delete taggedBy[tagId];
        });
        
        batch.update(contactRef, { tags, taggedAt, taggedBy });
        processedCount++;
      }
      
      await batch.commit();
    }
    
    // Update tag usage counts
    const tagBatch = adminDb.batch();
    for (const tagId of tagIds) {
      const tagRef = adminDb.collection('tags').doc(tagId);
      tagBatch.update(tagRef, {
        usageCount: adminDb.FieldValue.increment(-processedCount)
      });
    }
    await tagBatch.commit();
    
    revalidatePath(`/admin/${collection}`);
    return { success: true, processedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to log tag audit trail
 */
async function logTagAudit(data: {
  workspaceId: string;
  action: 'created' | 'updated' | 'deleted' | 'merged' | 'applied' | 'removed';
  tagId: string;
  tagName: string;
  contactId?: string;
  contactName?: string;
  userId: string;
  metadata?: any;
}) {
  const auditRef = adminDb.collection('tag_audit_logs').doc();
  await auditRef.set({
    id: auditRef.id,
    ...data,
    timestamp: new Date().toISOString()
  });
}
```


## Integration Points

### 1. Automation Engine Integration

**Tag-Based Triggers**

Add new trigger types to the automation system:

```typescript
// In src/lib/types.ts
export type AutomationTrigger = 
  | 'SCHOOL_CREATED'
  | 'SCHOOL_STAGE_CHANGED'
  | 'TAG_ADDED'           // NEW
  | 'TAG_REMOVED'         // NEW
  | 'TASK_COMPLETED'
  | 'SURVEY_SUBMITTED'
  | 'PDF_SIGNED'
  | 'WEBHOOK_RECEIVED'
  | 'MEETING_CREATED';

// Automation node for tag conditions
export interface TagConditionNode {
  id: string;
  type: 'tag_condition';
  data: {
    logic: 'has_tag' | 'has_all_tags' | 'has_any_tag' | 'not_has_tag';
    tagIds: string[];
  };
}

// Automation node for tag actions
export interface TagActionNode {
  id: string;
  type: 'tag_action';
  data: {
    action: 'add_tags' | 'remove_tags';
    tagIds: string[];
  };
}
```

**Automation Execution**

```typescript
// In automation engine
async function executeTagAction(
  node: TagActionNode,
  context: AutomationContext
) {
  const { contactId, contactType } = context;
  
  if (node.data.action === 'add_tags') {
    await applyTagsAction(
      contactId,
      contactType,
      node.data.tagIds,
      'system_automation'
    );
  } else {
    await removeTagsAction(
      contactId,
      contactType,
      node.data.tagIds,
      'system_automation'
    );
  }
}

async function evaluateTagCondition(
  node: TagConditionNode,
  context: AutomationContext
): Promise<boolean> {
  const { contactId, contactType } = context;
  const collection = contactType === 'school' ? 'schools' : 'prospects';
  
  const contactSnap = await adminDb
    .collection(collection)
    .doc(contactId)
    .get();
  
  const contactTags = contactSnap.data()?.tags || [];
  
  switch (node.data.logic) {
    case 'has_tag':
      return node.data.tagIds.some(id => contactTags.includes(id));
    case 'has_all_tags':
      return node.data.tagIds.every(id => contactTags.includes(id));
    case 'has_any_tag':
      return node.data.tagIds.some(id => contactTags.includes(id));
    case 'not_has_tag':
      return !node.data.tagIds.some(id => contactTags.includes(id));
    default:
      return false;
  }
}
```

### 2. Messaging Variables Integration

**Tag Variables for Templates**

Add tag-related variables to the messaging system:

```typescript
// In src/lib/messaging-actions.ts

// Add to syncVariableRegistry()
const tagVariables: Omit<VariableDefinition, 'id'>[] = [
  {
    key: 'contact_tags',
    label: 'Contact Tags (comma-separated)',
    category: 'general',
    source: 'static',
    entity: 'School',
    path: 'tags',
    type: 'array'
  },
  {
    key: 'has_tag',
    label: 'Has Specific Tag (conditional)',
    category: 'general',
    source: 'static',
    entity: 'School',
    path: 'tags',
    type: 'boolean'
  }
];

// Variable resolution
export async function resolveTagVariables(
  contactId: string,
  contactType: 'school' | 'prospect'
) {
  const collection = contactType === 'school' ? 'schools' : 'prospects';
  const contactSnap = await adminDb.collection(collection).doc(contactId).get();
  const tagIds = contactSnap.data()?.tags || [];
  
  // Fetch tag names
  const tagsSnap = await adminDb
    .collection('tags')
    .where('__name__', 'in', tagIds)
    .get();
  
  const tagNames = tagsSnap.docs.map(d => d.data().name);
  
  return {
    contact_tags: tagNames.join(', '),
    tag_list: tagNames,
    tag_count: tagNames.length
  };
}
```

**Conditional Blocks in Templates**

```typescript
// Template example with tag conditionals
{
  type: 'conditional',
  condition: {
    variableKey: 'has_tag',
    operator: 'contains',
    value: 'hot_lead'
  },
  trueBlock: {
    type: 'text',
    content: 'As a valued prospect, we have a special offer for you...'
  },
  falseBlock: {
    type: 'text',
    content: 'Thank you for your interest in SmartSapp...'
  }
}
```


### 3. Activity Logger Integration

**Tag Change Activities**

```typescript
// In src/lib/activity-logger.ts

export async function logTagActivity(data: {
  workspaceId: string;
  schoolId?: string;
  schoolName?: string;
  userId: string;
  action: 'tag_added' | 'tag_removed' | 'tags_bulk_added' | 'tags_bulk_removed';
  tagNames: string[];
  metadata?: any;
}) {
  const activityRef = adminDb.collection('activities').doc();
  
  await activityRef.set({
    id: activityRef.id,
    workspaceId: data.workspaceId,
    schoolId: data.schoolId,
    schoolName: data.schoolName,
    userId: data.userId,
    type: data.action,
    source: 'tagging_system',
    timestamp: new Date().toISOString(),
    description: generateTagActivityDescription(data),
    metadata: {
      tagNames: data.tagNames,
      ...data.metadata
    }
  });
}

function generateTagActivityDescription(data: {
  action: string;
  tagNames: string[];
  schoolName?: string;
}): string {
  const tagList = data.tagNames.join(', ');
  
  switch (data.action) {
    case 'tag_added':
      return `Added tag "${tagList}" to ${data.schoolName || 'contact'}`;
    case 'tag_removed':
      return `Removed tag "${tagList}" from ${data.schoolName || 'contact'}`;
    case 'tags_bulk_added':
      return `Bulk added tags: ${tagList}`;
    case 'tags_bulk_removed':
      return `Bulk removed tags: ${tagList}`;
    default:
      return 'Tag operation performed';
  }
}
```

### 4. Campaign Segmentation Integration

**Tag-Based Audience Selection**

```typescript
// In campaign composer
export async function getContactsByTags(
  workspaceId: string,
  filter: TagFilterQuery
): Promise<string[]> {
  const collection = adminDb.collection('schools');
  let query = collection.where('workspaceIds', 'array-contains', workspaceId);
  
  if (filter.logic === 'AND') {
    // Contacts must have ALL specified tags
    // Note: Firestore doesn't support array-contains-all, so we fetch and filter
    const snapshot = await query.get();
    
    return snapshot.docs
      .filter(doc => {
        const tags = doc.data().tags || [];
        return filter.tagIds.every(tagId => tags.includes(tagId));
      })
      .map(doc => doc.id);
      
  } else if (filter.logic === 'OR') {
    // Contacts must have ANY of the specified tags
    const contactIds = new Set<string>();
    
    for (const tagId of filter.tagIds) {
      const snapshot = await query
        .where('tags', 'array-contains', tagId)
        .get();
      
      snapshot.docs.forEach(doc => contactIds.add(doc.id));
    }
    
    return Array.from(contactIds);
    
  } else if (filter.logic === 'NOT') {
    // Contacts must NOT have any of the specified tags
    const snapshot = await query.get();
    
    return snapshot.docs
      .filter(doc => {
        const tags = doc.data().tags || [];
        return !filter.tagIds.some(tagId => tags.includes(tagId));
      })
      .map(doc => doc.id);
  }
  
  return [];
}

// Campaign preview with tag filtering
export async function previewCampaignAudience(
  workspaceId: string,
  tagFilter?: TagFilterQuery
): Promise<{ count: number; preview: any[] }> {
  let contactIds: string[];
  
  if (tagFilter) {
    contactIds = await getContactsByTags(workspaceId, tagFilter);
  } else {
    const snapshot = await adminDb
      .collection('schools')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();
    contactIds = snapshot.docs.map(d => d.id);
  }
  
  // Get preview of first 10 contacts
  const previewSnap = await adminDb
    .collection('schools')
    .where('__name__', 'in', contactIds.slice(0, 10))
    .get();
  
  const preview = previewSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name,
    tags: d.data().tags || []
  }));
  
  return { count: contactIds.length, preview };
}
```


## UI/UX Design

### Design System Compliance

Following the existing SmartSapp design patterns:

**Color Palette**
- Primary: `#3B82F6` (blue-500)
- Background: `#F8FAFC` (slate-50)
- Card Background: `#FFFFFF`
- Border: `#E2E8F0` (slate-200)
- Text Primary: `#0F172A` (slate-900)
- Text Muted: `#64748B` (slate-500)

**Typography**
- Labels: `text-[10px] font-black uppercase tracking-widest`
- Headings: `text-xl font-black uppercase tracking-tighter`
- Body: `text-sm font-bold`

**Spacing & Layout**
- Card Radius: `rounded-2xl` or `rounded-[2.5rem]`
- Padding: `p-6` for cards, `p-4` for compact areas
- Gap: `gap-4` or `gap-6` for spacing

**Interactive Elements**
- Buttons: `rounded-xl h-11 font-black uppercase text-xs`
- Inputs: `rounded-xl h-11 font-bold`
- Touch Targets: Minimum 44x44px
- Focus States: `ring-2 ring-primary/20`
- Hover States: `hover:bg-primary/5`

### Page Layouts

#### 1. Tags Management Page (`/admin/contacts/tags`)

```typescript
<div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
  <div className="max-w-7xl mx-auto space-y-8">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tighter">
          Tag Library
        </h1>
        <p className="text-sm text-muted-foreground font-bold mt-1">
          Organize contacts with flexible labels
        </p>
      </div>
      <Button 
        onClick={handleCreateTag}
        className="rounded-xl h-12 gap-2 shadow-xl bg-primary"
      >
        <Plus className="h-5 w-5" />
        New Tag
      </Button>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Total Tags
              </p>
              <p className="text-3xl font-black mt-2">{stats.totalTags}</p>
            </div>
            <Tag className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </Card>
      
      {/* More stat cards... */}
    </div>

    {/* Tabs for Categories */}
    <Tabs defaultValue="all" className="space-y-6">
      <TabsList className="bg-white rounded-2xl p-1 shadow-sm">
        <TabsTrigger value="all">All Tags</TabsTrigger>
        <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
        <TabsTrigger value="status">Status</TabsTrigger>
        {/* More tabs... */}
      </TabsList>

      <TabsContent value="all">
        <TagsTable tags={tags} />
      </TabsContent>
    </Tabs>
  </div>
</div>
```

#### 2. Tag Selector Popover

```typescript
<Popover>
  <PopoverTrigger asChild>
    <Button 
      variant="outline" 
      className="rounded-xl h-11 gap-2 font-bold"
    >
      <Tag className="h-4 w-4" />
      Tags ({currentTags.length})
    </Button>
  </PopoverTrigger>
  
  <PopoverContent className="w-96 p-0 rounded-2xl shadow-2xl">
    {/* Search */}
    <div className="p-4 border-b">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>
    </div>

    {/* Current Tags */}
    {currentTags.length > 0 && (
      <div className="p-4 border-b bg-muted/5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
          Current Tags
        </p>
        <div className="flex flex-wrap gap-2">
          {currentTags.map(tag => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color }}
              className="gap-2 h-7 px-3 text-white"
            >
              {tag.name}
              <X
                className="h-3 w-3 cursor-pointer hover:opacity-70"
                onClick={() => handleRemoveTag(tag.id)}
              />
            </Badge>
          ))}
        </div>
      </div>
    )}

    {/* Available Tags */}
    <ScrollArea className="h-80">
      <div className="p-4 space-y-2">
        {filteredTags.map(tag => (
          <button
            key={tag.id}
            onClick={() => handleApplyTag(tag.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{tag.name}</p>
              {tag.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {tag.description}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="text-[9px] font-black">
              {tag.category}
            </Badge>
          </button>
        ))}
      </div>
    </ScrollArea>

    {/* Create New Tag */}
    <div className="p-4 border-t">
      <Button
        variant="outline"
        className="w-full rounded-xl gap-2"
        onClick={handleCreateNewTag}
      >
        <Plus className="h-4 w-4" />
        Create New Tag
      </Button>
    </div>
  </PopoverContent>
</Popover>
```


#### 3. Tag Badges on Contact Cards

```typescript
// In contact list view
<Card className="rounded-2xl hover:shadow-lg transition-shadow">
  <CardContent className="p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h3 className="font-black text-lg">{school.name}</h3>
        <p className="text-sm text-muted-foreground">{school.location}</p>
        
        {/* Tag Badges */}
        {school.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {school.tags.slice(0, 3).map(tagId => {
              const tag = tagsMap.get(tagId);
              if (!tag) return null;
              
              return (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color }}
                  className="text-white text-[9px] font-black uppercase h-5 px-2"
                >
                  {tag.name}
                </Badge>
              );
            })}
            
            {school.tags.length > 3 && (
              <Badge variant="secondary" className="text-[9px] font-black h-5 px-2">
                +{school.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
      
      <TagSelector
        contactId={school.id}
        contactType="school"
        currentTags={school.tags}
      />
    </div>
  </CardContent>
</Card>
```

#### 4. Bulk Operations Dialog

```typescript
<Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
  <DialogContent className="max-w-2xl rounded-2xl">
    <DialogHeader>
      <DialogTitle className="text-xl font-black uppercase tracking-tighter">
        Bulk Tag Operations
      </DialogTitle>
      <DialogDescription className="font-bold">
        Apply or remove tags from {selectedContacts.length} selected contacts
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-6 py-4">
      {/* Operation Type */}
      <div className="space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Operation Type
        </Label>
        <RadioGroup value={operation} onValueChange={setOperation}>
          <div className="flex items-center space-x-2 p-4 rounded-xl border-2 border-border hover:border-primary transition-colors">
            <RadioGroupItem value="add" id="add" />
            <Label htmlFor="add" className="flex-1 cursor-pointer font-bold">
              Add Tags
              <span className="block text-xs text-muted-foreground font-normal mt-1">
                Apply selected tags to all contacts
              </span>
            </Label>
          </div>
          
          <div className="flex items-center space-x-2 p-4 rounded-xl border-2 border-border hover:border-primary transition-colors">
            <RadioGroupItem value="remove" id="remove" />
            <Label htmlFor="remove" className="flex-1 cursor-pointer font-bold">
              Remove Tags
              <span className="block text-xs text-muted-foreground font-normal mt-1">
                Remove selected tags from all contacts
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Tag Selection */}
      <div className="space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Select Tags
        </Label>
        <TagMultiSelect
          selectedTags={selectedTags}
          onSelectionChange={setSelectedTags}
        />
      </div>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">Processing...</span>
            <span className="text-muted-foreground font-bold">
              {progress}% ({processedCount}/{selectedContacts.length})
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Summary */}
      {!isProcessing && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-blue-900">
                {operation === 'add' ? 'Adding' : 'Removing'} {selectedTags.length} tag(s)
              </p>
              <p className="text-xs text-blue-800">
                This will affect {selectedContacts.length} contact(s)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setIsBulkDialogOpen(false)}
        disabled={isProcessing}
        className="rounded-xl"
      >
        Cancel
      </Button>
      <Button
        onClick={handleExecute}
        disabled={isProcessing || selectedTags.length === 0}
        className="rounded-xl gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Execute
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```


### Accessibility Compliance

**WCAG 2.1 AA Standards**

1. **Color Contrast**
   - All text maintains 4.5:1 contrast ratio
   - Tag badges use sufficient contrast against backgrounds
   - Focus indicators are clearly visible

2. **Keyboard Navigation**
   - All interactive elements accessible via Tab key
   - Tag selector navigable with arrow keys
   - Escape key closes dialogs and popovers
   - Enter key confirms selections

3. **Screen Reader Support**
   - ARIA labels on all interactive elements
   - ARIA live regions for dynamic updates
   - Semantic HTML structure

4. **Touch Targets**
   - Minimum 44x44px for all interactive elements
   - Adequate spacing between clickable items
   - Large enough buttons for mobile use

**Implementation Example**:

```typescript
<button
  onClick={handleApplyTag}
  className="min-h-[44px] min-w-[44px] rounded-xl"
  aria-label={`Apply ${tag.name} tag`}
  role="button"
  tabIndex={0}
>
  <Tag className="h-5 w-5" aria-hidden="true" />
  <span className="sr-only">Apply {tag.name} tag</span>
</button>

<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {statusMessage}
</div>
```

### Loading States

**Skeleton Screens**

```typescript
function TagsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
```

**Loading Indicators**

```typescript
{isLoading && (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-3 font-bold text-muted-foreground">
      Loading tags...
    </span>
  </div>
)}
```

### Responsive Design

**Mobile Optimizations**

```typescript
// Mobile-first responsive classes
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Tag cards */}
</div>

// Mobile drawer for tag selector
<Sheet>
  <SheetTrigger asChild>
    <Button className="w-full sm:w-auto">
      <Tag className="h-4 w-4" />
      <span className="ml-2">Tags</span>
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
    <TagSelectorContent />
  </SheetContent>
</Sheet>

// Responsive table
<div className="overflow-x-auto">
  <Table className="min-w-[800px]">
    {/* Table content */}
  </Table>
</div>
```

### Transitions and Animations

**Smooth Interactions**

```typescript
// Fade in animation
<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
  {content}
</div>

// Tag badge hover effect
<Badge
  className="transition-all duration-150 hover:scale-105 hover:shadow-md"
  style={{ backgroundColor: tag.color }}
>
  {tag.name}
</Badge>

// Button press effect
<Button className="transition-all active:scale-95 duration-150">
  Apply Tags
</Button>

// Loading spinner
<Loader2 className="h-5 w-5 animate-spin" />
```


## Performance Considerations

### Firestore Query Optimization

**1. Efficient Indexing Strategy**

```json
{
  "indexes": [
    {
      "comment": "Tag filtering with workspace scoping",
      "collectionGroup": "schools",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "comment": "Tag usage analytics",
      "collectionGroup": "tags",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "usageCount", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**2. Denormalization for Performance**

- Store `usageCount` on tag documents (updated via transactions)
- Cache frequently accessed tags in memory
- Preload tag library on page load

**3. Pagination for Large Datasets**

```typescript
export async function getTagsPaginated(
  workspaceId: string,
  pageSize: number = 50,
  lastDoc?: any
) {
  let query = adminDb
    .collection('tags')
    .where('workspaceId', '==', workspaceId)
    .orderBy('name', 'asc')
    .limit(pageSize);
  
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  
  const snapshot = await query.get();
  
  return {
    tags: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === pageSize
  };
}
```

### Caching Strategies

**1. Client-Side Caching**

```typescript
// React Query for tag caching
import { useQuery } from '@tanstack/react-query';

export function useTags(workspaceId: string) {
  return useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: () => getTagsAction(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

**2. Real-Time Updates with Optimistic UI**

```typescript
const handleApplyTag = async (tagId: string) => {
  // Optimistic update
  setCurrentTags(prev => [...prev, tagId]);
  
  try {
    await applyTagsAction(contactId, contactType, [tagId], userId);
  } catch (error) {
    // Rollback on error
    setCurrentTags(prev => prev.filter(id => id !== tagId));
    toast({ variant: 'destructive', title: 'Failed to apply tag' });
  }
};
```

**3. Batch Operations**

```typescript
// Process bulk operations in chunks
async function processBulkOperation(
  contactIds: string[],
  operation: () => Promise<void>,
  chunkSize: number = 100
) {
  const chunks = [];
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    chunks.push(contactIds.slice(i, i + chunkSize));
  }
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(id => operation()));
    // Update progress
    setProgress((chunks.indexOf(chunk) + 1) / chunks.length * 100);
  }
}
```

### Real-Time Synchronization

**Firestore Listeners**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export function useRealtimeTags(workspaceId: string) {
  const firestore = useFirestore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!firestore) return;
    
    const q = query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', workspaceId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedTags = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tag[];
      
      setTags(updatedTags);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [firestore, workspaceId]);
  
  return { tags, isLoading };
}
```

### Memory Management

**1. Cleanup on Unmount**

```typescript
useEffect(() => {
  const unsubscribe = subscribeToTags();
  
  return () => {
    unsubscribe();
    // Clear any cached data
    clearTagCache();
  };
}, []);
```

**2. Lazy Loading**

```typescript
// Load tag details only when needed
const TagDetails = lazy(() => import('./TagDetails'));

<Suspense fallback={<TagDetailsSkeleton />}>
  <TagDetails tagId={selectedTagId} />
</Suspense>
```


## Security Model

### Workspace-Scoped Access Control

**1. Tag Isolation**

All tags are strictly scoped to workspaces:

```typescript
// Security rule in firestore.rules
match /tags/{tagId} {
  allow read: if request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.workspaceIds
      .hasAny([resource.data.workspaceId]);
  
  allow create: if request.auth != null
    && hasPermission('tags_manage')
    && request.resource.data.workspaceId in getUserWorkspaces();
  
  allow update: if request.auth != null
    && hasPermission('tags_manage')
    && resource.data.workspaceId in getUserWorkspaces()
    && !resource.data.isSystem; // Cannot edit system tags
  
  allow delete: if request.auth != null
    && hasPermission('tags_manage')
    && resource.data.workspaceId in getUserWorkspaces()
    && !resource.data.isSystem; // Cannot delete system tags
}
```

**2. Contact Tagging Permissions**

```typescript
// Security rule for applying tags to contacts
match /schools/{schoolId} {
  allow update: if request.auth != null
    && hasPermission('schools_edit')
    && schoolHasWorkspaceAccess(schoolId)
    && onlyUpdatingTags(); // Only allow tag field updates
}

function onlyUpdatingTags() {
  return request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['tags', 'taggedAt', 'taggedBy']);
}
```

### Permission System

**New Permissions**

Add to `APP_PERMISSIONS` in `src/lib/types.ts`:

```typescript
export const APP_PERMISSIONS = [
  // ... existing permissions
  { id: 'tags_view', label: 'View Tags', category: 'Operations' },
  { id: 'tags_manage', label: 'Manage Tags', category: 'Operations' },
  { id: 'tags_apply', label: 'Apply Tags to Contacts', category: 'Operations' },
] as const;
```

**Permission Checks in Server Actions**

```typescript
export async function createTagAction(data: CreateTagData) {
  // Verify user has permission
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, 'tags_manage')) {
    return { success: false, error: 'Insufficient permissions' };
  }
  
  // Verify workspace access
  if (!user.workspaceIds.includes(data.workspaceId)) {
    return { success: false, error: 'Workspace access denied' };
  }
  
  // Proceed with tag creation
  // ...
}
```

### Data Validation

**Input Sanitization**

```typescript
import { z } from 'zod';

const TagSchema = z.object({
  name: z.string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must be 50 characters or less')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid characters in tag name'),
  description: z.string()
    .max(200, 'Description must be 200 characters or less')
    .optional(),
  category: z.enum([
    'behavioral',
    'demographic',
    'interest',
    'status',
    'lifecycle',
    'engagement',
    'custom'
  ]),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1)
});

export async function createTagAction(data: unknown) {
  // Validate input
  const result = TagSchema.safeParse(data);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error.errors[0].message 
    };
  }
  
  // Proceed with validated data
  const validatedData = result.data;
  // ...
}
```

### Audit Trail Security

**Immutable Logs**

```typescript
// Audit logs are write-only
match /tag_audit_logs/{logId} {
  allow read: if request.auth != null
    && hasPermission('activities_view')
    && resource.data.workspaceId in getUserWorkspaces();
  
  allow create: if request.auth != null;
  
  // No updates or deletes allowed
  allow update, delete: if false;
}
```

### Rate Limiting

**Prevent Abuse**

```typescript
// In server actions
import { rateLimit } from '@/lib/rate-limit';

export async function bulkApplyTagsAction(
  contactIds: string[],
  contactType: string,
  tagIds: string[],
  userId: string
) {
  // Rate limit: 10 bulk operations per minute per user
  const { success, remaining } = await rateLimit(
    `bulk-tags:${userId}`,
    10,
    60
  );
  
  if (!success) {
    return { 
      success: false, 
      error: 'Rate limit exceeded. Please try again later.' 
    };
  }
  
  // Limit bulk operation size
  if (contactIds.length > 1000) {
    return {
      success: false,
      error: 'Bulk operations limited to 1000 contacts at a time'
    };
  }
  
  // Proceed with operation
  // ...
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, I identified the following redundancies:
- FR1.2 and FR1.3 both test system tag immutability - these can be combined into one property
- FR2.1 and FR2.2 both test audit logging - these can be combined into one comprehensive audit property
- FR7.3 criteria 1 and 2 are about the same audit trail - combine into one property
- Performance properties (NFR1) can be combined into one comprehensive performance property

### Property 1: Tag Name Validation

*For any* tag creation attempt, if the tag name is empty or exceeds 50 characters, the system should reject the creation and return a validation error.

**Validates: Requirements FR1.1.1**

### Property 2: Tag Name Uniqueness

*For any* workspace and any two tag creation attempts with names that differ only in case (e.g., "Hot Lead" and "hot lead"), the second creation attempt should be rejected with a duplicate name error.

**Validates: Requirements FR1.1.2**

### Property 3: Workspace Isolation

*For any* two different workspaces, tags created in workspace A should not be visible or accessible when querying tags for workspace B.

**Validates: Requirements FR1.1.3**

### Property 4: Tag Update Propagation

*For any* tag and any property update (name, description, color, category), all references to that tag across the system should reflect the updated properties immediately.

**Validates: Requirements FR1.2.1**

### Property 5: System Tag Immutability

*For any* tag where `isSystem` is true, attempts to update or delete that tag should be rejected with an appropriate error message.

**Validates: Requirements FR1.2.2, FR1.3.2**

### Property 6: Cascade Tag Deletion

*For any* tag deletion, all contacts that previously had that tag should no longer have it in their tags array, and the corresponding entries in `taggedAt` and `taggedBy` should be removed.

**Validates: Requirements FR1.3.1**

### Property 7: Tag Merge Completeness

*For any* tag merge operation with source tags S and target tag T, after the merge completes: (1) all contacts that had any tag in S should now have tag T, (2) no contacts should have any tag from S, and (3) all tags in S should be deleted from the tags collection.

**Validates: Requirements FR1.4.1, FR1.4.2**

### Property 8: Tag Operation Audit Trail

*For any* tag operation (create, update, delete, apply, remove, merge), the system should create an audit log entry containing the operation type, tag ID, tag name, user ID, timestamp, and relevant metadata.

**Validates: Requirements FR2.1.2, FR2.2.1, FR7.3.1, FR7.3.2**

### Property 9: Bulk Operation Accuracy

*For any* bulk tag operation (apply or remove) on N contacts, the operation should return a count of successfully processed contacts, and that count should match the actual number of contacts whose tag arrays were modified.

**Validates: Requirements FR2.4.2**

### Property 10: Tag Filter AND Logic

*For any* set of tag IDs T and any contact collection, filtering with AND logic should return only contacts whose tags array contains all tag IDs in T.

**Validates: Requirements FR3.1.1**

### Property 11: Tag Filter OR Logic

*For any* set of tag IDs T and any contact collection, filtering with OR logic should return all contacts whose tags array contains at least one tag ID from T.

**Validates: Requirements FR3.1.1**

### Property 12: Tag Filter NOT Logic

*For any* set of tag IDs T and any contact collection, filtering with NOT logic should return only contacts whose tags array contains none of the tag IDs in T.

**Validates: Requirements FR3.1.1**

### Property 13: Tag Condition Evaluation

*For any* contact and any tag condition (has_tag, has_all_tags, has_any_tag, not_has_tag), the condition evaluation should return true if and only if the contact's tags array satisfies the specified logic.

**Validates: Requirements FR4.2.1**

### Property 14: Tag Usage Count Accuracy

*For any* tag, the `usageCount` field should equal the number of contacts (across all contact types) that have that tag ID in their tags array.

**Validates: Requirements FR6.1.1**

### Property 15: Tag Reference Integrity

*For any* contact, every tag ID in the contact's tags array should correspond to an existing document in the tags collection.

**Validates: Requirements NFR4.2**

### Property 16: No Orphaned Tags

*For any* tag with `usageCount` equal to 0, there should be no contacts in the system with that tag ID in their tags array.

**Validates: Requirements NFR4.1**

### Property 17: Query Performance

*For any* tag-based filter query on a collection of 10,000+ contacts, the query execution time should be less than 2 seconds.

**Validates: Requirements NFR1.1**

### Property 18: Bulk Operation Performance

*For any* bulk tag operation on 1,000 contacts, the total operation time (including all database writes and updates) should be less than 10 seconds.

**Validates: Requirements NFR1.2**


## Error Handling

### Error Types and Responses

**1. Validation Errors**

```typescript
export class TagValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'TagValidationError';
  }
}

// Usage
if (name.length > 50) {
  throw new TagValidationError(
    'Tag name must be 50 characters or less',
    'name',
    'TAG_NAME_TOO_LONG'
  );
}
```

**2. Permission Errors**

```typescript
export class TagPermissionError extends Error {
  constructor(
    message: string,
    public requiredPermission: string
  ) {
    super(message);
    this.name = 'TagPermissionError';
  }
}

// Usage
if (!hasPermission(user, 'tags_manage')) {
  throw new TagPermissionError(
    'You do not have permission to manage tags',
    'tags_manage'
  );
}
```

**3. Conflict Errors**

```typescript
export class TagConflictError extends Error {
  constructor(
    message: string,
    public conflictType: 'duplicate' | 'system_tag' | 'in_use'
  ) {
    super(message);
    this.name = 'TagConflictError';
  }
}

// Usage
if (existingTag) {
  throw new TagConflictError(
    'A tag with this name already exists',
    'duplicate'
  );
}
```

### Error Handling Patterns

**Server Actions**

```typescript
export async function createTagAction(data: CreateTagData) {
  try {
    // Validate input
    const validated = TagSchema.parse(data);
    
    // Check permissions
    const user = await getCurrentUser();
    if (!hasPermission(user, 'tags_manage')) {
      return {
        success: false,
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED'
      };
    }
    
    // Check for duplicates
    const existing = await checkDuplicateTag(validated.name, validated.workspaceId);
    if (existing) {
      return {
        success: false,
        error: 'A tag with this name already exists',
        code: 'DUPLICATE_TAG'
      };
    }
    
    // Create tag
    const tag = await createTag(validated);
    
    return { success: true, data: tag };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
        code: 'VALIDATION_ERROR'
      };
    }
    
    console.error('Create tag error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    };
  }
}
```

**Client-Side Error Handling**

```typescript
const handleCreateTag = async (data: CreateTagData) => {
  setIsLoading(true);
  setError(null);
  
  try {
    const result = await createTagAction(data);
    
    if (!result.success) {
      // Handle specific error codes
      switch (result.code) {
        case 'DUPLICATE_TAG':
          setError('A tag with this name already exists. Please choose a different name.');
          break;
        case 'PERMISSION_DENIED':
          setError('You do not have permission to create tags.');
          break;
        case 'VALIDATION_ERROR':
          setError(result.error);
          break;
        default:
          setError('Failed to create tag. Please try again.');
      }
      return;
    }
    
    toast({
      title: 'Tag Created',
      description: `Successfully created tag "${data.name}"`
    });
    
    onSuccess(result.data);
    
  } catch (error) {
    console.error('Unexpected error:', error);
    setError('An unexpected error occurred. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

### Retry Logic

**Transient Failures**

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation or permission errors
      if (
        error instanceof TagValidationError ||
        error instanceof TagPermissionError
      ) {
        throw error;
      }
      
      // Wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError!;
}

// Usage
const result = await withRetry(() => applyTagsAction(contactId, contactType, tagIds, userId));
```

### User-Friendly Error Messages

```typescript
const ERROR_MESSAGES = {
  TAG_NAME_TOO_LONG: 'Tag name is too long. Please use 50 characters or less.',
  TAG_NAME_REQUIRED: 'Please enter a tag name.',
  DUPLICATE_TAG: 'A tag with this name already exists. Try a different name.',
  PERMISSION_DENIED: 'You don\'t have permission to perform this action.',
  TAG_NOT_FOUND: 'The tag you\'re looking for doesn\'t exist.',
  SYSTEM_TAG_READONLY: 'System tags cannot be modified or deleted.',
  BULK_OPERATION_FAILED: 'Some contacts could not be updated. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
} as const;

function getUserFriendlyError(code: string): string {
  return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || 
    'An unexpected error occurred. Please try again.';
}
```


## Testing Strategy

### Dual Testing Approach

The contact tagging system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property Tests**: Verify universal properties across all inputs

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library Selection**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**: Each property test must run minimum 100 iterations due to randomization

**Test Tagging**: Each test must reference its design document property using the format:
```typescript
// Feature: contact-tagging-system, Property 1: Tag Name Validation
```

### Property Test Examples

**Property 1: Tag Name Validation**

```typescript
import fc from 'fast-check';
import { createTagAction } from '@/lib/tag-actions';

// Feature: contact-tagging-system, Property 1: Tag Name Validation
describe('Tag Name Validation Property', () => {
  it('should reject empty or too-long tag names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''), // Empty string
          fc.string({ minLength: 51, maxLength: 100 }) // Too long
        ),
        fc.string(), // workspaceId
        fc.string(), // organizationId
        async (name, workspaceId, organizationId) => {
          const result = await createTagAction({
            name,
            workspaceId,
            organizationId,
            category: 'custom',
            color: '#3B82F6',
            userId: 'test-user'
          });
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property 2: Tag Name Uniqueness**

```typescript
// Feature: contact-tagging-system, Property 2: Tag Name Uniqueness
describe('Tag Name Uniqueness Property', () => {
  it('should reject duplicate tag names regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string(),
        async (tagName, workspaceId) => {
          // Create first tag
          const result1 = await createTagAction({
            name: tagName,
            workspaceId,
            organizationId: 'test-org',
            category: 'custom',
            color: '#3B82F6',
            userId: 'test-user'
          });
          
          if (!result1.success) return; // Skip if first creation failed
          
          // Try to create with different case
          const result2 = await createTagAction({
            name: tagName.toUpperCase(),
            workspaceId,
            organizationId: 'test-org',
            category: 'custom',
            color: '#EF4444',
            userId: 'test-user'
          });
          
          expect(result2.success).toBe(false);
          expect(result2.error).toContain('already exists');
          
          // Cleanup
          await deleteTagAction(result1.data.id, 'test-user');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property 6: Cascade Tag Deletion**

```typescript
// Feature: contact-tagging-system, Property 6: Cascade Tag Deletion
describe('Cascade Tag Deletion Property', () => {
  it('should remove tag from all contacts when deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }), // Contact IDs
        async (contactIds) => {
          // Create a tag
          const tagResult = await createTagAction({
            name: `test-tag-${Date.now()}`,
            workspaceId: 'test-workspace',
            organizationId: 'test-org',
            category: 'custom',
            color: '#3B82F6',
            userId: 'test-user'
          });
          
          if (!tagResult.success) return;
          const tagId = tagResult.data.id;
          
          // Apply tag to all contacts
          for (const contactId of contactIds) {
            await applyTagsAction(contactId, 'school', [tagId], 'test-user');
          }
          
          // Delete the tag
          await deleteTagAction(tagId, 'test-user');
          
          // Verify tag removed from all contacts
          for (const contactId of contactIds) {
            const contact = await getContact(contactId);
            expect(contact.tags).not.toContain(tagId);
            expect(contact.taggedAt[tagId]).toBeUndefined();
            expect(contact.taggedBy[tagId]).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property 10-12: Tag Filter Logic**

```typescript
// Feature: contact-tagging-system, Property 10: Tag Filter AND Logic
describe('Tag Filter AND Logic Property', () => {
  it('should return only contacts with all specified tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 2, maxLength: 5 }), // Tag IDs
        fc.array(
          fc.record({
            id: fc.string(),
            tags: fc.array(fc.string())
          }),
          { minLength: 5, maxLength: 20 }
        ), // Contacts
        async (filterTagIds, contacts) => {
          const result = await filterContactsByTags({
            tagIds: filterTagIds,
            logic: 'AND'
          });
          
          // Every returned contact should have all filter tags
          result.forEach(contact => {
            filterTagIds.forEach(tagId => {
              expect(contact.tags).toContain(tagId);
            });
          });
          
          // Every contact with all filter tags should be returned
          const expectedContacts = contacts.filter(c =>
            filterTagIds.every(tagId => c.tags.includes(tagId))
          );
          
          expect(result.length).toBe(expectedContacts.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```


### Unit Test Examples

**Tag Creation**

```typescript
describe('Tag Creation', () => {
  it('should create a tag with valid data', async () => {
    const result = await createTagAction({
      name: 'Hot Lead',
      description: 'High-priority prospects',
      category: 'status',
      color: '#EF4444',
      workspaceId: 'ws_123',
      organizationId: 'org_456',
      userId: 'user_789'
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: 'Hot Lead',
      slug: 'hot-lead',
      category: 'status',
      color: '#EF4444',
      usageCount: 0,
      isSystem: false
    });
  });
  
  it('should reject tag with empty name', async () => {
    const result = await createTagAction({
      name: '',
      category: 'custom',
      color: '#3B82F6',
      workspaceId: 'ws_123',
      organizationId: 'org_456',
      userId: 'user_789'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
  
  it('should reject tag with name exceeding 50 characters', async () => {
    const longName = 'a'.repeat(51);
    const result = await createTagAction({
      name: longName,
      category: 'custom',
      color: '#3B82F6',
      workspaceId: 'ws_123',
      organizationId: 'org_456',
      userId: 'user_789'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('50 characters');
  });
});

describe('Tag Permissions', () => {
  it('should prevent non-admin from deleting system tags', async () => {
    const result = await deleteTagAction('system_tag_id', 'regular_user');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('system tag');
  });
});

describe('Tag Application', () => {
  it('should apply tag to contact and log audit trail', async () => {
    const contactId = 'school_123';
    const tagId = 'tag_hot_lead';
    const userId = 'user_789';
    
    const result = await applyTagsAction(contactId, 'school', [tagId], userId);
    
    expect(result.success).toBe(true);
    
    // Verify tag applied
    const contact = await getContact(contactId);
    expect(contact.tags).toContain(tagId);
    expect(contact.taggedBy[tagId]).toBe(userId);
    
    // Verify audit log created
    const auditLogs = await getAuditLogs({ tagId, contactId });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('applied');
  });
});
```

**Bulk Operations**

```typescript
describe('Bulk Tag Operations', () => {
  it('should apply tags to multiple contacts', async () => {
    const contactIds = ['school_1', 'school_2', 'school_3'];
    const tagIds = ['tag_1', 'tag_2'];
    
    const result = await bulkApplyTagsAction(
      contactIds,
      'school',
      tagIds,
      'user_789'
    );
    
    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(3);
    
    // Verify all contacts have the tags
    for (const contactId of contactIds) {
      const contact = await getContact(contactId);
      expect(contact.tags).toEqual(expect.arrayContaining(tagIds));
    }
  });
  
  it('should handle partial failures gracefully', async () => {
    const contactIds = ['school_1', 'invalid_id', 'school_3'];
    const tagIds = ['tag_1'];
    
    const result = await bulkApplyTagsAction(
      contactIds,
      'school',
      tagIds,
      'user_789'
    );
    
    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(2); // Only valid contacts
  });
});
```

**Tag Filtering**

```typescript
describe('Tag Filtering', () => {
  beforeEach(async () => {
    // Setup test data
    await createTestContact('school_1', ['tag_a', 'tag_b']);
    await createTestContact('school_2', ['tag_a']);
    await createTestContact('school_3', ['tag_b']);
    await createTestContact('school_4', ['tag_a', 'tag_b', 'tag_c']);
  });
  
  it('should filter with AND logic', async () => {
    const result = await getContactsByTags('ws_123', {
      tagIds: ['tag_a', 'tag_b'],
      logic: 'AND'
    });
    
    expect(result).toHaveLength(2); // school_1 and school_4
    expect(result).toEqual(expect.arrayContaining(['school_1', 'school_4']));
  });
  
  it('should filter with OR logic', async () => {
    const result = await getContactsByTags('ws_123', {
      tagIds: ['tag_a', 'tag_b'],
      logic: 'OR'
    });
    
    expect(result).toHaveLength(4); // All schools have at least one tag
  });
  
  it('should filter with NOT logic', async () => {
    const result = await getContactsByTags('ws_123', {
      tagIds: ['tag_c'],
      logic: 'NOT'
    });
    
    expect(result).toHaveLength(3); // school_1, school_2, school_3
    expect(result).not.toContain('school_4');
  });
});
```

### Integration Tests

**Automation Integration**

```typescript
describe('Tag-Based Automation', () => {
  it('should trigger automation when tag is applied', async () => {
    const automation = await createTestAutomation({
      trigger: 'TAG_ADDED',
      tagId: 'tag_hot_lead'
    });
    
    await applyTagsAction('school_123', 'school', ['tag_hot_lead'], 'user_789');
    
    // Wait for automation to process
    await waitFor(() => {
      const runs = getAutomationRuns(automation.id);
      expect(runs).toHaveLength(1);
    });
  });
  
  it('should evaluate tag conditions correctly', async () => {
    const contact = await createTestContact('school_123', ['tag_a', 'tag_b']);
    
    const hasAllTags = await evaluateTagCondition({
      logic: 'has_all_tags',
      tagIds: ['tag_a', 'tag_b']
    }, { contactId: 'school_123', contactType: 'school' });
    
    expect(hasAllTags).toBe(true);
    
    const hasTagC = await evaluateTagCondition({
      logic: 'has_tag',
      tagIds: ['tag_c']
    }, { contactId: 'school_123', contactType: 'school' });
    
    expect(hasTagC).toBe(false);
  });
});
```

### Test Coverage Goals

- Unit test coverage: >80% of code
- Property test coverage: All 18 correctness properties
- Integration test coverage: All integration points (automation, messaging, campaigns)
- E2E test coverage: Critical user flows (create tag, apply to contact, filter by tags)

### Continuous Testing

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    setupFiles: ['./test/setup.ts'],
    environment: 'node'
  }
});
```


## Implementation Roadmap

### Phase 1: Core Tag Management (Week 1-2)

**Deliverables**:
- Tag CRUD operations (create, read, update, delete)
- Tag categories and color coding
- Workspace-scoped isolation
- Basic validation and error handling
- Tag management page UI

**Files to Create**:
- `src/lib/types.ts` - Add Tag interfaces
- `src/lib/tag-actions.ts` - Server actions for tag management
- `src/app/admin/contacts/tags/page.tsx` - Tag management page
- `src/app/admin/contacts/tags/TagsClient.tsx` - Client component
- `src/components/tags/TagSelector.tsx` - Reusable tag selector
- `firestore.indexes.json` - Add tag indexes

**Testing**:
- Unit tests for tag CRUD operations
- Property tests for validation and uniqueness
- Integration tests for workspace isolation

### Phase 2: Contact Tagging (Week 2-3)

**Deliverables**:
- Apply/remove tags from contacts
- Bulk tag operations
- Tag badges on contact cards
- Real-time tag updates
- Audit trail logging

**Files to Create/Modify**:
- `src/lib/tag-actions.ts` - Add contact tagging actions
- `src/components/tags/BulkTagOperations.tsx` - Bulk operations dialog
- `src/app/admin/schools/page.tsx` - Add tag selector to schools list
- `src/app/admin/schools/[slug]/page.tsx` - Add tag selector to school detail
- `src/lib/activity-logger.ts` - Add tag activity logging

**Testing**:
- Unit tests for tag application/removal
- Property tests for bulk operations
- Integration tests for audit logging

### Phase 3: Tag Filtering & Search (Week 3-4)

**Deliverables**:
- Tag-based filtering with AND/OR/NOT logic
- Advanced tag queries
- Saved filter views
- Tag search and autocomplete

**Files to Create/Modify**:
- `src/components/tags/TagFilter.tsx` - Tag filter component
- `src/lib/tag-queries.ts` - Advanced query functions
- `src/app/admin/schools/page.tsx` - Integrate tag filtering
- `src/hooks/useTagFilter.ts` - Custom hook for tag filtering

**Testing**:
- Unit tests for filter logic
- Property tests for AND/OR/NOT operations
- Performance tests for large datasets

### Phase 4: Automation Integration (Week 4-5)

**Deliverables**:
- Tag-based automation triggers
- Tag condition nodes
- Tag action nodes
- Automation builder UI updates

**Files to Create/Modify**:
- `src/lib/types.ts` - Add tag trigger types
- `src/lib/automation-engine.ts` - Add tag trigger handling
- `src/app/admin/automations/components/nodes/TagConditionNode.tsx`
- `src/app/admin/automations/components/nodes/TagActionNode.tsx`
- `src/app/admin/automations/AutomationsClient.tsx` - Add tag triggers

**Testing**:
- Unit tests for tag triggers and conditions
- Integration tests for automation execution
- E2E tests for complete automation flows

### Phase 5: Messaging & Campaign Integration (Week 5-6)

**Deliverables**:
- Tag variables in message templates
- Tag-based campaign segmentation
- Campaign preview with tag filtering
- Conditional message blocks based on tags

**Files to Create/Modify**:
- `src/lib/messaging-actions.ts` - Add tag variable resolution
- `src/app/admin/messaging/campaigns/CampaignComposer.tsx` - Add tag segmentation
- `src/components/tags/TagSegmentSelector.tsx` - Campaign tag selector

**Testing**:
- Unit tests for tag variable resolution
- Integration tests for campaign segmentation
- E2E tests for complete campaign flow

### Phase 6: Analytics & Governance (Week 6-7)

**Deliverables**:
- Tag usage statistics dashboard
- Tag merge functionality
- Tag cleanup tools
- Naming convention enforcement
- Tag permissions

**Files to Create/Modify**:
- `src/app/admin/contacts/tags/analytics/page.tsx` - Analytics dashboard
- `src/lib/tag-actions.ts` - Add merge and cleanup functions
- `src/components/tags/TagMergeDialog.tsx` - Merge UI
- `src/components/tags/TagAnalytics.tsx` - Analytics components

**Testing**:
- Unit tests for merge operations
- Property tests for data integrity
- Integration tests for analytics accuracy

### Phase 7: Performance Optimization & Polish (Week 7-8)

**Deliverables**:
- Query optimization
- Caching implementation
- Loading state improvements
- Mobile responsiveness
- Accessibility audit
- Documentation

**Tasks**:
- Implement React Query caching
- Add skeleton screens
- Optimize Firestore queries
- Add keyboard shortcuts
- Complete accessibility review
- Write user documentation

**Testing**:
- Performance tests for large datasets
- Load testing for bulk operations
- Accessibility testing with screen readers
- Cross-browser testing

## Migration Strategy

### Existing Data Migration

If there are existing contact categorization fields that should be converted to tags:

```typescript
export async function migrateExistingCategoriesToTags() {
  // 1. Create tags for existing categories
  const categories = ['Hot Lead', 'Active Customer', 'Churned'];
  const tagMap = new Map<string, string>();
  
  for (const category of categories) {
    const tag = await createTagAction({
      name: category,
      category: 'status',
      color: getCategoryColor(category),
      workspaceId: 'default_workspace',
      organizationId: 'default_org',
      userId: 'system'
    });
    
    if (tag.success) {
      tagMap.set(category, tag.data.id);
    }
  }
  
  // 2. Apply tags to contacts based on existing fields
  const schoolsSnap = await adminDb.collection('schools').get();
  
  for (const doc of schoolsSnap.docs) {
    const school = doc.data();
    const category = school.category; // Old field
    
    if (category && tagMap.has(category)) {
      await applyTagsAction(
        doc.id,
        'school',
        [tagMap.get(category)!],
        'system_migration'
      );
    }
  }
  
  console.log('Migration complete');
}
```

## Monitoring and Observability

### Key Metrics to Track

1. **Usage Metrics**
   - Number of tags created per workspace
   - Tag application rate
   - Most used tags
   - Tag growth over time

2. **Performance Metrics**
   - Tag query response times
   - Bulk operation duration
   - Real-time update latency

3. **Error Metrics**
   - Failed tag operations
   - Permission denials
   - Validation errors

### Logging Strategy

```typescript
// Structured logging for tag operations
export function logTagOperation(data: {
  operation: string;
  tagId?: string;
  contactId?: string;
  userId: string;
  duration: number;
  success: boolean;
  error?: string;
}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'tagging-system',
    ...data
  }));
}
```

## Documentation Requirements

1. **User Documentation**
   - Tag management guide
   - Best practices for tag naming
   - Bulk operations tutorial
   - Automation integration guide

2. **Developer Documentation**
   - API reference for server actions
   - Component usage examples
   - Integration guide for new features
   - Testing guide

3. **Admin Documentation**
   - Tag governance policies
   - Permission configuration
   - Performance tuning guide
   - Troubleshooting guide

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-23  
**Status**: Ready for Implementation  
**Estimated Effort**: 7-8 weeks (1 developer)

