# API Documentation: EntityId Support

## Overview

All SmartSapp API endpoints now support the unified entity architecture using `entityId` as the primary contact identifier. This document provides examples and migration guidance for API consumers.

## ⚠️ Breaking Changes Timeline

- **Phase 1 (Current - March 2026)**: Dual support - both `schoolId` and `entityId` accepted
- **Phase 2 (Q2 2026)**: `schoolId` parameters marked as **DEPRECATED** with warning headers
- **Phase 3 (Q4 2026)**: `schoolId` parameters **REMOVED** (breaking change)

## ⚠️ Deprecation Notice

**IMPORTANT**: The `schoolId` parameter is deprecated and will be removed in Q4 2026. All API consumers should migrate to using `entityId` as soon as possible.

### Migration Deadline
- **Soft deadline**: June 30, 2026 (Q2 2026)
- **Hard deadline**: October 1, 2026 (Q4 2026)

After the hard deadline, API requests using `schoolId` will return a `400 Bad Request` error.

## Authentication

All API endpoints require authentication via Firebase ID token:

```bash
curl -H "Authorization: Bearer <firebase-id-token>" \
  https://api.smartsapp.com/v1/tasks
```

## Contact Identification

### Current: Dual Support (DEPRECATED)

⚠️ **DEPRECATED**: Using `schoolId` is deprecated. Please migrate to `entityId`.

API endpoints currently accept either `schoolId` or `entityId` for backward compatibility:

```json
{
  "entityId": "entity_abc123",
  "entityType": "institution"
}
```

OR (DEPRECATED)

```json
{
  "schoolId": "school_xyz789"
}
```

When using `schoolId`, you will receive a deprecation warning header:

```
Warning: 299 - "schoolId parameter is deprecated and will be removed in Q4 2026. Use entityId instead."
```

### Preferred: EntityId

New integrations should use `entityId`:

```json
{
  "entityId": "entity_abc123",
  "entityType": "institution"
}
```

## API Endpoints

### Tasks

#### Create Task

**POST** `/api/tasks`

Create a new task associated with a contact.

**Request Body:**

```json
{
  "workspaceId": "workspace_123",
  "title": "Follow up call",
  "description": "Discuss enrollment options",
  "priority": "high",
  "status": "todo",
  "category": "call",
  "dueDate": "2026-04-15T10:00:00Z",
  "assignedTo": "user_456",
  
  // Preferred: Use entityId
  "entityId": "entity_abc123",
  "entityType": "institution"
  
  // Legacy: schoolId still supported
  // "schoolId": "school_xyz789"
}
```

**Response:**

```json
{
  "id": "task_789",
  "workspaceId": "workspace_123",
  "title": "Follow up call",
  "description": "Discuss enrollment options",
  "priority": "high",
  "status": "todo",
  "category": "call",
  "dueDate": "2026-04-15T10:00:00Z",
  "assignedTo": "user_456",
  "assignedToName": "John Doe",
  
  // Both identifiers returned for backward compatibility
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolId": "school_xyz789",
  "schoolName": "Springfield Elementary",
  
  "createdAt": "2026-03-28T14:30:00Z",
  "updatedAt": "2026-03-28T14:30:00Z"
}
```

#### Get Tasks for Contact

**GET** `/api/tasks?workspaceId={workspaceId}&entityId={entityId}`

OR

**GET** `/api/tasks?workspaceId={workspaceId}&schoolId={schoolId}` (deprecated)

Query tasks for a specific contact.

**Query Parameters:**
- `workspaceId` (required): Workspace ID
- `entityId` (optional): Entity ID (preferred)
- `schoolId` (optional): School ID (deprecated)
- `status` (optional): Filter by status (`todo`, `in_progress`, `done`)
- `assignedTo` (optional): Filter by assigned user

**Example Request:**

```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.smartsapp.com/v1/tasks?workspaceId=workspace_123&entityId=entity_abc123&status=todo"
```

**Response:**

```json
{
  "tasks": [
    {
      "id": "task_789",
      "workspaceId": "workspace_123",
      "title": "Follow up call",
      "entityId": "entity_abc123",
      "entityType": "institution",
      "schoolId": "school_xyz789",
      "status": "todo",
      "dueDate": "2026-04-15T10:00:00Z",
      "createdAt": "2026-03-28T14:30:00Z"
    }
  ],
  "total": 1
}
```

#### Update Task

**PATCH** `/api/tasks/{taskId}`

Update an existing task. Identifier fields (`entityId`, `schoolId`) are preserved and cannot be changed.

**Request Body:**

```json
{
  "title": "Updated title",
  "status": "in_progress",
  "priority": "urgent"
}
```

**Response:**

```json
{
  "id": "task_789",
  "title": "Updated title",
  "status": "in_progress",
  "priority": "urgent",
  
  // Identifiers preserved
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolId": "school_xyz789",
  
  "updatedAt": "2026-03-28T15:00:00Z"
}
```

### Activities

#### Log Activity

**POST** `/api/activities`

Log an activity for a contact.

**Request Body:**

```json
{
  "workspaceId": "workspace_123",
  "type": "call",
  "description": "Discussed enrollment timeline",
  
  // Preferred: Use entityId
  "entityId": "entity_abc123",
  "entityType": "institution",
  
  "userId": "user_456",
  "timestamp": "2026-03-28T14:30:00Z",
  "metadata": {
    "duration": "15 minutes",
    "outcome": "positive"
  }
}
```

**Response:**

```json
{
  "id": "activity_101",
  "workspaceId": "workspace_123",
  "type": "call",
  "description": "Discussed enrollment timeline",
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolId": "school_xyz789",
  "userId": "user_456",
  "userName": "John Doe",
  "timestamp": "2026-03-28T14:30:00Z",
  "metadata": {
    "duration": "15 minutes",
    "outcome": "positive"
  },
  "createdAt": "2026-03-28T14:30:00Z"
}
```

#### Get Activities for Contact

**GET** `/api/activities?workspaceId={workspaceId}&entityId={entityId}`

Query activities for a specific contact.

**Query Parameters:**
- `workspaceId` (required): Workspace ID
- `entityId` (optional): Entity ID (preferred)
- `schoolId` (optional): School ID (deprecated)
- `type` (optional): Filter by activity type
- `limit` (optional): Number of results (default: 50)
- `startAfter` (optional): Pagination cursor

**Example Request:**

```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.smartsapp.com/v1/activities?workspaceId=workspace_123&entityId=entity_abc123&limit=20"
```

**Response:**

```json
{
  "activities": [
    {
      "id": "activity_101",
      "type": "call",
      "description": "Discussed enrollment timeline",
      "entityId": "entity_abc123",
      "timestamp": "2026-03-28T14:30:00Z"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

### Forms

#### Create Form

**POST** `/api/forms`

Create a new form associated with a contact.

**Request Body:**

```json
{
  "workspaceId": "workspace_123",
  "title": "Enrollment Application",
  "description": "Complete this form to apply",
  
  // Preferred: Use entityId
  "entityId": "entity_abc123",
  "entityType": "institution",
  
  "fields": [
    {
      "id": "field_1",
      "type": "text",
      "label": "Student Name",
      "required": true
    },
    {
      "id": "field_2",
      "type": "email",
      "label": "Parent Email",
      "required": true
    }
  ],
  "status": "published"
}
```

**Response:**

```json
{
  "id": "form_202",
  "workspaceId": "workspace_123",
  "title": "Enrollment Application",
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolId": "school_xyz789",
  "fields": [...],
  "status": "published",
  "createdAt": "2026-03-28T14:30:00Z"
}
```

#### Submit Form

**POST** `/api/forms/{formId}/submissions`

Submit a form response.

**Request Body:**

```json
{
  "responses": {
    "field_1": "Jane Smith",
    "field_2": "parent@example.com"
  },
  "submittedBy": "user_789"
}
```

**Response:**

```json
{
  "id": "submission_303",
  "formId": "form_202",
  "entityId": "entity_abc123",
  "entityType": "institution",
  "responses": {
    "field_1": "Jane Smith",
    "field_2": "parent@example.com"
  },
  "submittedAt": "2026-03-28T15:00:00Z",
  "submittedBy": "user_789"
}
```

### Invoices

#### Create Invoice

**POST** `/api/invoices`

Create a new invoice for a contact.

**Request Body:**

```json
{
  "organizationId": "org_123",
  "invoiceNumber": "INV-2026-001",
  
  // Preferred: Use entityId
  "entityId": "entity_abc123",
  "entityType": "institution",
  
  "periodId": "period_q1_2026",
  "periodName": "Q1 2026",
  "items": [
    {
      "description": "Subscription Fee",
      "quantity": 1,
      "unitPrice": 500.00,
      "total": 500.00
    }
  ],
  "subtotal": 500.00,
  "tax": 50.00,
  "total": 550.00,
  "dueDate": "2026-04-30T00:00:00Z",
  "status": "sent"
}
```

**Response:**

```json
{
  "id": "invoice_404",
  "invoiceNumber": "INV-2026-001",
  "organizationId": "org_123",
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolId": "school_xyz789",
  "schoolName": "Springfield Elementary",
  "items": [...],
  "subtotal": 500.00,
  "tax": 50.00,
  "total": 550.00,
  "dueDate": "2026-04-30T00:00:00Z",
  "status": "sent",
  "createdAt": "2026-03-28T14:30:00Z"
}
```

### Meetings

#### Schedule Meeting

**POST** `/api/meetings`

Schedule a meeting with a contact.

**Request Body:**

```json
{
  "workspaceId": "workspace_123",
  "title": "Campus Tour",
  "description": "Tour of facilities and Q&A",
  
  // Preferred: Use entityId
  "entityId": "entity_abc123",
  "entityType": "institution",
  
  "startTime": "2026-04-10T10:00:00Z",
  "endTime": "2026-04-10T11:00:00Z",
  "location": "Main Campus",
  "attendees": ["user_456", "user_789"],
  "status": "scheduled"
}
```

**Response:**

```json
{
  "id": "meeting_505",
  "workspaceId": "workspace_123",
  "title": "Campus Tour",
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolSlug": "springfield-elementary",
  "startTime": "2026-04-10T10:00:00Z",
  "endTime": "2026-04-10T11:00:00Z",
  "location": "Main Campus",
  "attendees": ["user_456", "user_789"],
  "status": "scheduled",
  "createdAt": "2026-03-28T14:30:00Z"
}
```

### Messaging

#### Send Message

**POST** `/api/messages`

Send a message to a contact.

**Request Body:**

```json
{
  "workspaceId": "workspace_123",
  
  // Preferred: Use entityId
  "entityId": "entity_abc123",
  "entityType": "institution",
  
  "messageType": "email",
  "recipient": "contact@school.edu",
  "subject": "Welcome to SmartSapp",
  "body": "Thank you for signing up...",
  "sendAt": "2026-03-28T15:00:00Z"
}
```

**Response:**

```json
{
  "id": "message_606",
  "workspaceId": "workspace_123",
  "entityId": "entity_abc123",
  "entityType": "institution",
  "schoolId": "school_xyz789",
  "messageType": "email",
  "recipient": "contact@school.edu",
  "subject": "Welcome to SmartSapp",
  "status": "sent",
  "sentAt": "2026-03-28T15:00:00Z",
  "createdAt": "2026-03-28T14:30:00Z"
}
```

### Contacts

#### Create Contact (Entity)

**POST** `/api/contacts`

Create a new contact as an entity.

**Request Body:**

```json
{
  "organizationId": "org_123",
  "workspaceId": "workspace_123",
  "entityType": "institution",
  "name": "New School",
  "contacts": [
    {
      "name": "Principal Smith",
      "email": "principal@newschool.edu",
      "phone": "+1-555-0100",
      "role": "Principal"
    }
  ],
  "institutionData": {
    "nominalRoll": 500,
    "billingAddress": "123 Main St, City, State 12345",
    "currency": "USD"
  },
  "pipelineId": "pipeline_admissions",
  "stageId": "stage_inquiry"
}
```

**Response:**

```json
{
  "entity": {
    "id": "entity_new123",
    "organizationId": "org_123",
    "entityType": "institution",
    "name": "New School",
    "slug": "new-school",
    "contacts": [...],
    "globalTags": [],
    "status": "active",
    "institutionData": {...},
    "createdAt": "2026-03-28T14:30:00Z"
  },
  "workspaceEntity": {
    "id": "workspace_123_entity_new123",
    "workspaceId": "workspace_123",
    "entityId": "entity_new123",
    "entityType": "institution",
    "pipelineId": "pipeline_admissions",
    "stageId": "stage_inquiry",
    "status": "active",
    "workspaceTags": [],
    "displayName": "New School",
    "addedAt": "2026-03-28T14:30:00Z"
  }
}
```

#### Get Contact

**GET** `/api/contacts/{entityId}?workspaceId={workspaceId}`

Get contact details including both identity and workspace-specific data.

**Query Parameters:**
- `workspaceId` (required): Workspace ID for workspace-specific data

**Example Request:**

```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.smartsapp.com/v1/contacts/entity_abc123?workspaceId=workspace_123"
```

**Response:**

```json
{
  "id": "entity_abc123",
  "organizationId": "org_123",
  "entityType": "institution",
  "name": "Springfield Elementary",
  "slug": "springfield-elementary",
  "contacts": [
    {
      "name": "Principal Skinner",
      "email": "skinner@springfield.edu",
      "phone": "+1-555-0199",
      "role": "Principal"
    }
  ],
  "globalTags": ["public", "k-12"],
  "status": "active",
  "institutionData": {
    "nominalRoll": 600,
    "billingAddress": "19 Evergreen Terrace, Springfield",
    "currency": "USD"
  },
  
  // Workspace-specific data
  "workspaceData": {
    "workspaceId": "workspace_123",
    "pipelineId": "pipeline_admissions",
    "stageId": "stage_active",
    "currentStageName": "Active Client",
    "assignedTo": {
      "userId": "user_456",
      "name": "John Doe",
      "email": "john@smartsapp.com"
    },
    "workspaceTags": ["priority", "vip"],
    "lastContactedAt": "2026-03-25T10:00:00Z"
  },
  
  "createdAt": "2025-01-15T08:00:00Z",
  "updatedAt": "2026-03-28T14:30:00Z"
}
```

#### Update Contact

**PATCH** `/api/contacts/{entityId}`

Update contact information. Identity fields update the entity, operational fields update the workspace entity.

**Request Body:**

```json
{
  "workspaceId": "workspace_123",
  
  // Identity updates (go to entities collection)
  "name": "Springfield Elementary School",
  "globalTags": ["public", "k-12", "stem"],
  
  // Operational updates (go to workspace_entities collection)
  "stageId": "stage_enrolled",
  "workspaceTags": ["priority", "vip", "high-value"],
  "assignedTo": {
    "userId": "user_789",
    "name": "Jane Smith",
    "email": "jane@smartsapp.com"
  }
}
```

**Response:**

```json
{
  "id": "entity_abc123",
  "name": "Springfield Elementary School",
  "globalTags": ["public", "k-12", "stem"],
  "workspaceData": {
    "stageId": "stage_enrolled",
    "workspaceTags": ["priority", "vip", "high-value"],
    "assignedTo": {
      "userId": "user_789",
      "name": "Jane Smith",
      "email": "jane@smartsapp.com"
    }
  },
  "updatedAt": "2026-03-28T15:00:00Z"
}
```

#### List Workspace Contacts

**GET** `/api/workspaces/{workspaceId}/contacts`

List all contacts in a workspace with optional filters.

**Query Parameters:**
- `entityType` (optional): Filter by type (`institution`, `family`, `person`)
- `pipelineId` (optional): Filter by pipeline
- `stageId` (optional): Filter by stage
- `status` (optional): Filter by status (`active`, `archived`)
- `limit` (optional): Number of results (default: 50)
- `startAfter` (optional): Pagination cursor

**Example Request:**

```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.smartsapp.com/v1/workspaces/workspace_123/contacts?entityType=institution&status=active&limit=20"
```

**Response:**

```json
{
  "contacts": [
    {
      "entityId": "entity_abc123",
      "entityType": "institution",
      "displayName": "Springfield Elementary",
      "primaryEmail": "contact@springfield.edu",
      "primaryPhone": "+1-555-0199",
      "pipelineId": "pipeline_admissions",
      "stageId": "stage_active",
      "currentStageName": "Active Client",
      "status": "active",
      "workspaceTags": ["priority", "vip"],
      "assignedTo": {
        "userId": "user_456",
        "name": "John Doe"
      },
      "lastContactedAt": "2026-03-25T10:00:00Z"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

## Migration Guide for API Consumers

### Migration Timeline

| Phase | Date | Action Required |
|-------|------|----------------|
| Phase 1 | March 2026 | Start migration - both identifiers supported |
| Phase 2 | Q2 2026 | Complete migration - deprecation warnings active |
| Phase 3 | Q4 2026 | Migration mandatory - `schoolId` removed |

### Step 1: Update Request Bodies

Replace `schoolId` with `entityId` and `entityType`:

**Before (DEPRECATED):**

```json
{
  "schoolId": "school_xyz789",
  "title": "Follow up"
}
```

**After:**

```json
{
  "entityId": "entity_abc123",
  "entityType": "institution",
  "title": "Follow up"
}
```

### Step 2: Update Query Parameters

Replace `schoolId` query parameters with `entityId`:

**Before (DEPRECATED):**

```
GET /api/tasks?workspaceId=workspace_123&schoolId=school_xyz789
```

**After:**

```
GET /api/tasks?workspaceId=workspace_123&entityId=entity_abc123
```

### Step 3: Obtain EntityId Mapping

If you have stored `schoolId` values, you need to obtain the corresponding `entityId` values. Contact your SmartSapp account manager or use the migration mapping endpoint:

```bash
# Request mapping for your organization
curl -H "Authorization: Bearer <token>" \
  "https://api.smartsapp.com/v1/migration/schoolid-to-entityid-mapping?organizationId=org_123"
```

**Response:**

```json
{
  "mappings": [
    {
      "schoolId": "school_xyz789",
      "entityId": "entity_abc123",
      "entityType": "institution",
      "name": "Springfield Elementary"
    }
  ]
}
```

### Step 4: Handle Both Identifiers in Responses

During the transition period, responses include both identifiers:

```typescript
interface TaskResponse {
  id: string;
  // ... other fields
  
  // New fields (preferred)
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  
  // Legacy fields (DEPRECATED - will be removed Q4 2026)
  schoolId?: string;
  schoolName?: string;
}
```

Update your client code to use `entityId` as the primary identifier:

```typescript
// ✅ Good: Use entityId
const entityId = task.entityId;

// ❌ Bad: Use schoolId (DEPRECATED)
const schoolId = task.schoolId; // Will be removed in Phase 3
```

Update your client code to use `entityId` as the primary identifier:

```typescript
// ✅ Good: Use entityId
const entityId = task.entityId;

// ❌ Bad: Use schoolId
const schoolId = task.schoolId; // Will be removed in Phase 3
```

### Step 4: Migrate Stored Identifiers

If your application stores contact identifiers, migrate them to `entityId`:

```typescript
// Fetch mapping from API
const mapping = await fetch('/api/migration/schoolid-to-entityid-mapping')
  .then(res => res.json());

// Update stored identifiers
for (const [schoolId, entityId] of Object.entries(mapping)) {
  await updateStoredIdentifier(schoolId, entityId);
}
```

### Step 5: Test with Both Identifiers

During migration, test that your integration works with both:

```typescript
// Test with entityId (preferred)
const tasksWithEntityId = await fetch(
  `/api/tasks?workspaceId=${workspaceId}&entityId=${entityId}`
);

// Test with schoolId (fallback)
const tasksWithSchoolId = await fetch(
  `/api/tasks?workspaceId=${workspaceId}&schoolId=${schoolId}`
);

// Both should return the same results
expect(tasksWithEntityId).toEqual(tasksWithSchoolId);
```

## Error Handling

### Invalid Identifier

**Status Code:** `400 Bad Request`

```json
{
  "error": "INVALID_IDENTIFIER",
  "message": "Either entityId or schoolId must be provided",
  "code": 400
}
```

### Contact Not Found

**Status Code:** `404 Not Found`

```json
{
  "error": "CONTACT_NOT_FOUND",
  "message": "Contact with entityId 'entity_abc123' not found",
  "code": 404
}
```

### Unauthorized Workspace Access

**Status Code:** `403 Forbidden`

```json
{
  "error": "UNAUTHORIZED_WORKSPACE",
  "message": "User does not have access to workspace 'workspace_123'",
  "code": 403
}
```

### Deprecated Parameter

**Status Code:** `200 OK` (with warning header)

**Response Headers:**

```
Warning: 299 - "schoolId parameter is deprecated and will be removed in Q4 2026. Use entityId instead."
```

## Rate Limiting

All API endpoints are rate limited:

- **Standard tier**: 100 requests per minute
- **Premium tier**: 1000 requests per minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1711638000
```

## Webhooks

Webhook payloads now include both identifiers during the transition period:

```json
{
  "event": "task.created",
  "timestamp": "2026-03-28T14:30:00Z",
  "data": {
    "id": "task_789",
    "entityId": "entity_abc123",
    "entityType": "institution",
    "schoolId": "school_xyz789",
    "title": "Follow up call"
  }
}
```

Update webhook handlers to use `entityId`:

```typescript
app.post('/webhooks/smartsapp', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'task.created') {
    // ✅ Use entityId
    const entityId = data.entityId;
    
    // ❌ Don't use schoolId
    // const schoolId = data.schoolId; // Deprecated
  }
  
  res.sendStatus(200);
});
```

## Support

For API support and migration assistance:

- **Email**: api-support@smartsapp.com
- **Documentation**: https://docs.smartsapp.com/api
- **Status Page**: https://status.smartsapp.com
- **Slack Community**: https://smartsapp.slack.com

## Changelog

### v1.1.0 (March 2026)

- Added `entityId` and `entityType` parameters to all endpoints
- Added dual support for `schoolId` (backward compatibility)
- Added `/api/contacts` endpoint for entity management
- Added deprecation warnings for `schoolId` parameters

### v1.0.0 (January 2025)

- Initial API release with `schoolId` support
