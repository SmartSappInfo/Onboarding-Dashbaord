# Architecture Notes: Contacts Expansion

## Future Enhancements

### Entity Relationships Collection (Reserved)

**Status**: Planned for future implementation  
**Collection Name**: `entity_relationships` (RESERVED - do not use for other purposes)

#### Purpose

The `entity_relationships` collection will enable explicit mapping of relationships between entities across different types. This supports scenarios where the same real-world person appears in multiple contexts (e.g., a principal who is also a parent, a consultant who works with multiple institutions).

#### Collection Schema

```typescript
interface EntityRelationship {
  id: string;
  organizationId: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string; // e.g., "parent_of", "works_at", "consults_for", "sibling_of"
  metadata?: Record<string, any>; // Optional relationship-specific data
  createdAt: string; // ISO 8601 timestamp
  createdBy: string; // User ID who created the relationship
  updatedAt?: string; // ISO 8601 timestamp
}
```

#### Firestore Path

```
/entity_relationships/{relationshipId}
```

#### Composite Indexes (Future)

When implemented, the following indexes will be required:

```json
{
  "collectionGroup": "entity_relationships",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "fromEntityId", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "entity_relationships",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "toEntityId", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "entity_relationships",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "relationshipType", "order": "ASCENDING" }
  ]
}
```

#### Example Relationship Types

- `parent_of`: Links a person entity to a family entity (guardian relationship)
- `works_at`: Links a person entity to an institution entity (employment)
- `consults_for`: Links a person entity to an institution entity (contractor)
- `sibling_of`: Links two person entities (family relationship)
- `child_of`: Links a person entity to a family entity (child relationship)
- `partner_of`: Links two person entities (business partnership)
- `affiliated_with`: Generic relationship between any two entities

#### Query Patterns (Future)

```typescript
// Find all relationships from a specific entity
const outgoingRelationships = await db
  .collection('entity_relationships')
  .where('organizationId', '==', orgId)
  .where('fromEntityId', '==', entityId)
  .get();

// Find all relationships to a specific entity
const incomingRelationships = await db
  .collection('entity_relationships')
  .where('organizationId', '==', orgId)
  .where('toEntityId', '==', entityId)
  .get();

// Find all relationships of a specific type
const typeRelationships = await db
  .collection('entity_relationships')
  .where('organizationId', '==', orgId)
  .where('relationshipType', '==', 'works_at')
  .get();
```

#### UI Considerations (Future)

When implemented, the UI should:

1. Display a "Related Contacts" section on entity detail pages
2. Allow users to create relationships with type selection
3. Show bidirectional relationships (if A relates to B, show on both detail pages)
4. Support filtering and searching by relationship type
5. Provide relationship visualization (network graph for complex relationships)

#### Migration Strategy (Future)

When implementing this feature:

1. **Phase 1**: Create collection and basic CRUD operations
2. **Phase 2**: Add UI for manual relationship creation
3. **Phase 3**: Implement automatic relationship detection (e.g., matching FocalPerson email to Person entity)
4. **Phase 4**: Add relationship-based automation triggers
5. **Phase 5**: Implement relationship visualization and analytics

#### Security Rules (Future)

```javascript
match /entity_relationships/{relationshipId} {
  allow read: if isAuthenticated() 
    && belongsToOrganization(resource.data.organizationId)
    && (hasEntityAccess(resource.data.fromEntityId) 
        || hasEntityAccess(resource.data.toEntityId));
  
  allow create: if isAuthenticated()
    && belongsToOrganization(request.resource.data.organizationId)
    && hasPermission('entities_edit')
    && hasEntityAccess(request.resource.data.fromEntityId)
    && hasEntityAccess(request.resource.data.toEntityId);
  
  allow update, delete: if isAuthenticated()
    && belongsToOrganization(resource.data.organizationId)
    && hasPermission('entities_edit')
    && (hasEntityAccess(resource.data.fromEntityId) 
        || hasEntityAccess(resource.data.toEntityId));
}
```

---

## Current Implementation Notes

### Entity Interface Extensions

The `Entity` interface includes a `relatedEntityIds` field to support future relationship mapping without requiring schema migration:

```typescript
interface Entity {
  id: string;
  organizationId: string;
  entityType: 'institution' | 'family' | 'person';
  name: string;
  contacts: FocalPerson[];
  globalTags: string[];
  relatedEntityIds?: string[]; // Optional, empty by default
  createdAt: string;
  updatedAt: string;
  // ... scope-specific data fields
}
```

**Purpose**: The `relatedEntityIds` array provides a lightweight way to store entity relationships before the full `entity_relationships` collection is implemented. This field:

- Is optional and defaults to empty array
- Can be populated manually or via import
- Supports basic relationship queries without complex joins
- Will be migrated to `entity_relationships` collection when that feature is implemented

**Current Usage**: This field is reserved for future use. Do not populate it in the current implementation phase.

---

## Cross-Entity Relationship Strategy

### Design Principle: Separate Records Until Explicit Linking

The contacts expansion architecture treats the same real-world person appearing in different contexts as **separate entity records** until an explicit relationship is created.

#### Example Scenarios

**Scenario 1: Principal Who Is Also a Parent**

- **Institution Entity**: "Springfield Elementary School"
  - FocalPerson: { name: "Jane Smith", type: "Principal", email: "jane@springfield.edu" }
- **Family Entity**: "Smith Family"
  - Guardian: { name: "Jane Smith", email: "jane.personal@gmail.com", relationship: "Mother" }

**Current Behavior**: These are treated as two separate contact records. No automatic linking occurs.

**Future Behavior**: When `entity_relationships` is implemented, users can create a relationship:
```typescript
{
  fromEntityId: "person_jane_smith_123",
  toEntityId: "institution_springfield_456",
  relationshipType: "works_at"
}
```

**Scenario 2: Consultant Working with Multiple Schools**

- **Person Entity**: "John Doe - Education Consultant"
  - personData: { firstName: "John", lastName: "Doe", company: "EduConsult LLC" }
- **Institution Entity 1**: "Oak Valley School"
  - FocalPerson: { name: "John Doe", type: "Consultant", email: "john@educonsult.com" }
- **Institution Entity 2**: "Maple Ridge Academy"
  - FocalPerson: { name: "John Doe", type: "Consultant", email: "john@educonsult.com" }

**Current Behavior**: John exists as a standalone person entity AND as a FocalPerson on two institution entities. These are separate records.

**Future Behavior**: Relationships can map the person entity to both institutions:
```typescript
[
  {
    fromEntityId: "person_john_doe_789",
    toEntityId: "institution_oak_valley_101",
    relationshipType: "consults_for"
  },
  {
    fromEntityId: "person_john_doe_789",
    toEntityId: "institution_maple_ridge_102",
    relationshipType: "consults_for"
  }
]
```

#### Why Separate Records?

1. **Scope Enforcement**: Each workspace has a single `contactScope`. A person cannot exist as both a family guardian and a standalone person entity in the same workspace.

2. **Context Matters**: The same person may have different operational states in different contexts:
   - As a principal: pipeline stage "Contract Renewal", assigned to Sales Rep A
   - As a parent: pipeline stage "Admissions Interview", assigned to Admissions Rep B

3. **Data Ownership**: Different teams may manage different aspects:
   - Sales team manages the institution relationship
   - Admissions team manages the family relationship
   - Neither team should accidentally modify the other's data

4. **Gradual Migration**: Existing systems have FocalPerson data embedded in institution records. Automatic linking would require complex email/phone matching logic and could create false positives.

#### When to Create Relationships (Future)

Relationships should be created when:

1. **User explicitly links records**: "This person works at this institution"
2. **Import includes relationship data**: CSV with relationship columns
3. **Automated matching with user confirmation**: System suggests matches based on email/phone, user approves
4. **API integration**: External system provides relationship data

Relationships should NOT be created automatically without user confirmation to avoid:
- False positives (two different people with same name)
- Privacy concerns (linking personal and professional identities without consent)
- Data integrity issues (incorrect relationships polluting the database)

#### Migration Path

When `entity_relationships` is implemented:

1. **Audit existing FocalPerson records**: Identify potential duplicates across entities
2. **Generate relationship suggestions**: Use email/phone matching to suggest links
3. **User review and approval**: Present suggestions in UI for manual confirmation
4. **Bulk relationship creation**: Allow batch approval of high-confidence matches
5. **Ongoing relationship management**: Provide UI for creating, editing, and deleting relationships

---

## Related Requirements

- **Requirement 24**: Cross-Entity Relationships (Future Enhancement)

---

## Document History

- **2024-03-26**: Initial architecture notes created for task 40
- Reserved `entity_relationships` collection name
- Documented collection schema and query patterns
- Added `relatedEntityIds` field to Entity interface
- Documented cross-entity relationship strategy
