# Task 16.3 Implementation Summary: Update Existing Features to Use Adapter Layer

## Overview

This task updates all existing features to use the `resolveContact` adapter layer function, ensuring backward compatibility with both legacy `schools` collection data and the new `entities` + `workspace_entities` model.

## Requirements Addressed

- **Requirement 18**: Backward Compatibility — Schools Adapter Layer

## Implementation Details

### 1. Activity Logger (`src/lib/activity-logger.ts`)

**Status**: ✅ Already implemented in previous task

**Changes**:
- Uses `resolveContact` to fetch contact context when `schoolId` is provided
- Populates both legacy fields (`schoolName`, `schoolSlug`) and new fields (`entityId`, `entityType`, `displayName`, `entitySlug`)
- Ensures activity logs work with both legacy and migrated contacts

**Key Code**:
```typescript
if (activityData.schoolId && (!activityData.schoolName || !activityData.schoolSlug)) {
    const contact = await resolveContact(activityData.schoolId, activityData.workspaceId);
    if (contact) {
        finalData.schoolName = contact.name;
        finalData.schoolSlug = contact.slug;
        if (contact.entityId) {
            finalData.entityId = contact.entityId;
            finalData.entityType = contact.entityType;
            finalData.displayName = contact.name;
            finalData.entitySlug = contact.slug;
        }
    }
}
```

### 2. Messaging Engine (`src/lib/messaging-engine.ts`)

**Status**: ✅ Already implemented in previous task

**Changes**:
- Uses `resolveContact` to fetch contact data for message variable resolution
- Resolves contact information from either legacy schools or new entities + workspace_entities
- Populates message variables with contact data (name, email, phone, etc.)
- Resolves workspace-scoped tags using the adapter

**Key Code**:
```typescript
if (schoolId) {
    const contact = await resolveContact(schoolId, workspaceIds[0] || 'onboarding');
    if (contact) {
        const signatory = getContactSignatory(contact);
        // ... populate contact variables
        const tagVars = await resolveTagVariables(schoolId, 'school', primaryWorkspaceId);
        // ... merge tag variables
    }
}
```

### 3. Automation Processor (`src/lib/automation-processor.ts`)

**Status**: ✅ Already implemented in previous task

**Changes**:
- Uses `resolveContact` in `handleCreateTask` to populate task fields with contact information
- Uses `resolveContact` in `handleUpdateSchool` to determine whether to update legacy school or new entity/workspace_entity
- Ensures automations work correctly with both legacy and migrated contacts

**Key Code**:
```typescript
// In handleCreateTask
if (context.schoolId) {
    const contact = await resolveContact(context.schoolId, context.payload.workspaceId || 'onboarding');
    if (contact) {
        schoolName = contact.name;
        entityId = contact.entityId;
        entityType = contact.entityType;
    }
}

// In handleUpdateSchool
const contact = await resolveContact(context.schoolId, context.payload.workspaceId || 'onboarding');
if (contact && contact.migrationStatus === 'migrated' && contact.entityId) {
    // Update entity and workspace_entities
} else {
    // Update legacy school document
}
```

### 4. Task System (`src/lib/task-actions.ts`)

**Status**: ✅ Indirectly uses adapter through `logActivity`

**Changes**:
- Task creation and updates use `logActivity` which internally uses the adapter
- No direct changes needed as the adapter integration is handled by the activity logger

### 5. Notification Engine (`src/lib/notification-engine.ts`)

**Status**: ✅ **NEW** - Updated in this task

**Changes**:
- Added import for `resolveContact`
- Updated `triggerInternalNotification` to use adapter for resolving assigned manager
- Replaces direct `schools` collection query with adapter call

**Key Code**:
```typescript
// Before
if (notifyManager && schoolId) {
    const schoolSnap = await adminDb.collection('schools').doc(schoolId).get();
    if (schoolSnap.exists) {
        const schoolData = schoolSnap.data() as School;
        const managerId = schoolData.assignedTo?.userId;
        if (managerId) {
            recipients.add(managerId);
        }
    }
}

// After
if (notifyManager && schoolId) {
    const contact = await resolveContact(schoolId, variables.workspaceId || 'onboarding');
    if (contact && contact.assignedTo) {
        recipients.add(contact.assignedTo);
    }
}
```

### 6. PDF Actions (`src/lib/pdf-actions.ts`)

**Status**: ✅ **NEW** - Updated in this task

**Changes**:
- Added import for `resolveContact`
- Updated `generatePdfBuffer` to use adapter for resolving school data
- Replaces direct `schools` collection query with adapter call

**Key Code**:
```typescript
// Before
if (pdfForm.schoolId) {
    const schoolSnap = await adminDb.collection('schools').doc(pdfForm.schoolId).get();
    if (schoolSnap.exists) {
        school = { id: schoolSnap.id, ...schoolSnap.data() } as School;
    }
}

// After
if (pdfForm.schoolId) {
    const contact = await resolveContact(pdfForm.schoolId, pdfForm.workspaceId || 'onboarding');
    if (contact && contact.schoolData) {
        school = contact.schoolData;
    }
}
```

### 7. Billing Actions (`src/lib/billing-actions.ts`)

**Status**: ✅ **NEW** - Updated in this task

**Changes**:
- Added import for `resolveContact`
- Updated invoice generation to use adapter for resolving school data
- Replaces direct `schools` collection query with adapter call

**Key Code**:
```typescript
// Before
const [profileSnap, periodSnap, schoolSnap] = await Promise.all([
    db.collection('billing_profiles').doc(profileId).get(),
    db.collection('billing_periods').doc(periodId).get(),
    db.collection('schools').doc(schoolId).get(),
]);
const school = schoolSnap.data() as School;

// After
const [profileSnap, periodSnap] = await Promise.all([
    db.collection('billing_profiles').doc(profileId).get(),
    db.collection('billing_periods').doc(periodId).get(),
]);
const contact = await resolveContact(schoolId, 'onboarding');
if (!contact || !contact.schoolData) throw new Error("Institutional record missing.");
const school = contact.schoolData;
```

## Testing

### Test Files Created

1. **`src/lib/__tests__/adapter-integration.test.ts`** (from previous task)
   - Tests activity logger integration with legacy and migrated contacts
   - Tests messaging engine integration with legacy contacts

2. **`src/lib/__tests__/adapter-integration-extended.test.ts`** (new)
   - Tests notification engine integration with legacy and migrated contacts
   - Tests PDF actions integration with legacy contacts
   - Verifies adapter is called correctly in all scenarios

### Test Results

All tests passing:
```
✓ src/lib/__tests__/adapter-integration.test.ts (3)
  ✓ Activity Logger Integration (2)
  ✓ Messaging Engine Integration (1)

✓ src/lib/__tests__/adapter-integration-extended.test.ts (3)
  ✓ Notification Engine Integration (2)
  ✓ PDF Actions Integration (1)

Test Files  2 passed (2)
Tests  6 passed (6)
```

## Backward Compatibility

All features now support both:

1. **Legacy Mode**: Reads from `schools` collection when `migrationStatus` is `legacy` or undefined
2. **Migrated Mode**: Reads from `entities` + `workspace_entities` when `migrationStatus` is `migrated`

The adapter layer (`resolveContact`) automatically determines which mode to use based on the migration status of each contact record.

## Features Updated Summary

| Feature | File | Status | Notes |
|---------|------|--------|-------|
| Activity Logger | `activity-logger.ts` | ✅ Previous | Uses adapter for contact resolution |
| Messaging Engine | `messaging-engine.ts` | ✅ Previous | Uses adapter for contact and tag resolution |
| Automation Processor | `automation-processor.ts` | ✅ Previous | Uses adapter in task creation and school updates |
| Task System | `task-actions.ts` | ✅ Indirect | Uses adapter through activity logger |
| Notification Engine | `notification-engine.ts` | ✅ **New** | Updated to use adapter for manager resolution |
| PDF Actions | `pdf-actions.ts` | ✅ **New** | Updated to use adapter for school data |
| Billing Actions | `billing-actions.ts` | ✅ **New** | Updated to use adapter for school data |

## Migration Path

1. **Phase 1**: All features continue working with legacy `schools` collection
2. **Phase 2**: Run migration script to backfill `entities` + `workspace_entities`
3. **Phase 3**: Set `migrationStatus: 'migrated'` on migrated records
4. **Phase 4**: Features automatically use new model for migrated records
5. **Phase 5**: Eventually deprecate legacy `schools` collection (future)

## Next Steps

- Task 17: Checkpoint - Verify existing features work with adapter
- Task 18: Create scope-specific UI components
- Continue with remaining implementation tasks

## Conclusion

Task 16.3 is complete. All existing features (activity logger, task system, messaging engine, automation engine, notification engine, PDF actions, and billing actions) now use the adapter layer for backward compatibility with both legacy and migrated contact records.
