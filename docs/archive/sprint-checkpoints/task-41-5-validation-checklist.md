# Task 41.5: Migration Script Validation Checklist

## Pre-Migration Validation

### Environment Setup
- [ ] Firebase emulator running on port 8080
- [ ] Environment variables configured (.env file)
- [ ] Admin SDK credentials available
- [ ] Test organization and workspaces created
- [ ] Backup of production data created

### Test Data Preparation
- [ ] Production-like schools data created (5 schools)
- [ ] Multi-workspace school included (1 school with 2 workspaces)
- [ ] Archived school included (1 school)
- [ ] Minimal data school included (1 school)
- [ ] Special characters school included (1 school)
- [ ] Large school included (1 school with 2,500+ students)

## Migration Execution Validation

### Dry Run Mode
- [ ] Run migration with `DRY_RUN=true`
- [ ] Verify no writes performed
- [ ] Verify all validation logic executed
- [ ] Review summary report
- [ ] Check for any errors in output

### Live Migration
- [ ] Run migration without DRY_RUN flag
- [ ] Monitor progress logs
- [ ] Verify batch processing (50 schools per batch)
- [ ] Check for errors during execution
- [ ] Review final summary report

### Summary Report Validation
- [ ] Total schools count matches expected
- [ ] Succeeded count equals total (or expected)
- [ ] Failed count is 0 (or acceptable)
- [ ] Skipped count is 0 on first run
- [ ] Error details logged if any failures

## Data Integrity Validation

### Entity Documents
- [ ] All schools have corresponding entity documents
- [ ] Entity count matches school count
- [ ] All entities have `entityType: "institution"`
- [ ] All entities have correct `organizationId`
- [ ] All entities have `name` field populated
- [ ] All entities have `slug` field populated
- [ ] All entities have `contacts` array (from focalPersons)
- [ ] All entities have `status` field (active/archived)
- [ ] All entities have `createdAt` timestamp
- [ ] All entities have `updatedAt` timestamp

### Institution Data Preservation
- [ ] `nominalRoll` preserved when present
- [ ] `subscriptionPackageId` preserved when present
- [ ] `subscriptionRate` preserved when present
- [ ] `billingAddress` preserved when present
- [ ] `currency` preserved when present
- [ ] `modules` array preserved when present
- [ ] `implementationDate` preserved when present
- [ ] `referee` preserved when present

### Workspace Entity Documents
- [ ] All (school, workspace) pairs have workspace_entities documents
- [ ] Multi-workspace school has multiple workspace_entities
- [ ] All workspace_entities have correct `workspaceId`
- [ ] All workspace_entities have correct `entityId`
- [ ] All workspace_entities have `entityType: "institution"`
- [ ] All workspace_entities have correct `organizationId`

### Workspace Entity Data Preservation
- [ ] `pipelineId` preserved from school
- [ ] `stageId` preserved from school.stage.id
- [ ] `assignedTo` preserved from school
- [ ] `workspaceTags` copied from school.tags
- [ ] `status` mapped correctly (Active → active, Archived → archived)
- [ ] `addedAt` set to school.createdAt
- [ ] `updatedAt` set to migration timestamp

### Denormalized Fields
- [ ] `displayName` equals school.name
- [ ] `primaryEmail` equals first focalPerson.email
- [ ] `primaryPhone` equals first focalPerson.phone
- [ ] `currentStageName` equals school.stage.name

### Migration Status
- [ ] All migrated schools have `migrationStatus: "migrated"`
- [ ] `updatedAt` timestamp updated on schools
- [ ] Original school data unchanged (except migrationStatus)

## Edge Cases Validation

### Multi-Workspace Schools
- [ ] School with 2+ workspaces creates multiple workspace_entities
- [ ] Each workspace_entities has same entityId
- [ ] Each workspace_entities has different workspaceId
- [ ] Entity data consistent across all workspace_entities

### Archived Schools
- [ ] Archived schools migrated successfully
- [ ] Entity status set to "archived"
- [ ] Workspace_entities status set to "archived"
- [ ] Historical data preserved

### Minimal Data Schools
- [ ] Schools with only required fields migrate successfully
- [ ] Optional fields handled gracefully (undefined/null)
- [ ] No errors on missing data
- [ ] Entity created with minimal data

### Special Characters
- [ ] Names with apostrophes preserved
- [ ] Names with ampersands preserved
- [ ] Names with parentheses preserved
- [ ] Slugs generated correctly (URL-safe)
- [ ] No encoding issues

### Large Schools
- [ ] Large nominal roll (2,000+) handled correctly
- [ ] High subscription rates preserved
- [ ] No numeric overflow
- [ ] No precision loss

## Idempotency Validation

### First Run
- [ ] Record count of entities created
- [ ] Record count of workspace_entities created
- [ ] Record count of schools migrated
- [ ] Save summary report

### Second Run
- [ ] Run migration again on same data
- [ ] Verify 0 new entities created
- [ ] Verify 0 new workspace_entities created
- [ ] Verify all schools still marked as migrated
- [ ] Verify no duplicate documents
- [ ] Verify entity count unchanged
- [ ] Verify workspace_entities count unchanged

### Idempotency Checks
- [ ] `entityExists()` function works correctly
- [ ] `workspaceEntityExists()` function works correctly
- [ ] Migration skips schools with `migrationStatus: "migrated"`
- [ ] No errors on re-run

## No Data Loss Validation

### Field-by-Field Verification
For each migrated school:
- [ ] Name preserved exactly
- [ ] Slug preserved or generated
- [ ] Focal persons count matches
- [ ] Focal persons data matches
- [ ] Tags count matches
- [ ] Tags data matches
- [ ] Pipeline ID matches
- [ ] Stage ID matches
- [ ] Assigned rep matches
- [ ] Nominal roll matches (if present)
- [ ] Subscription rate matches (if present)
- [ ] Billing address matches (if present)
- [ ] Currency matches (if present)
- [ ] Modules count matches (if present)
- [ ] Modules data matches (if present)
- [ ] Implementation date matches (if present)
- [ ] Referee matches (if present)
- [ ] Created timestamp matches
- [ ] Status mapped correctly

### Aggregate Validation
- [ ] Total fields in schools = Total fields in entities + workspace_entities
- [ ] No fields lost during migration
- [ ] No fields corrupted during migration
- [ ] All relationships preserved

## Adapter Layer Validation

### Unified Contact Construction
- [ ] Entity can be queried by organizationId + name
- [ ] Workspace_entities can be queried by entityId + workspaceId
- [ ] Unified contact object constructible
- [ ] All entity fields accessible
- [ ] All workspace_entities fields accessible
- [ ] Institution data accessible

### Backward Compatibility
- [ ] Schools collection unchanged (except migrationStatus)
- [ ] Existing features can use adapter layer
- [ ] Activity logger can resolve migrated records
- [ ] Task system can resolve migrated records
- [ ] Messaging engine can resolve migrated records
- [ ] Automation engine can resolve migrated records

## Performance Validation

### Migration Speed
- [ ] Batch processing works (50 schools per batch)
- [ ] Progress logged after each batch
- [ ] No timeouts during migration
- [ ] Reasonable execution time (< 5 min for 100 schools)

### Query Performance
- [ ] Entity queries by organizationId + name are fast
- [ ] Workspace_entities queries by workspaceId are fast
- [ ] Workspace_entities queries by entityId are fast
- [ ] Composite indexes deployed and used

## Error Handling Validation

### Error Scenarios
- [ ] Malformed school data handled gracefully
- [ ] Missing required fields logged as errors
- [ ] Invalid data types logged as errors
- [ ] Network errors handled gracefully
- [ ] Firestore errors handled gracefully

### Error Reporting
- [ ] Errors logged with school ID
- [ ] Errors logged with school name
- [ ] Errors logged with error message
- [ ] Failed schools tracked in stats.errors array
- [ ] Summary report includes error details
- [ ] Migration continues after errors (doesn't abort)

## Post-Migration Validation

### Data Consistency
- [ ] All schools have entities
- [ ] All (school, workspace) pairs have workspace_entities
- [ ] No orphaned entities
- [ ] No orphaned workspace_entities
- [ ] All relationships valid

### Feature Compatibility
- [ ] Contact list view works with migrated data
- [ ] Contact detail page works with migrated data
- [ ] Pipeline Kanban works with migrated data
- [ ] Task system works with migrated data
- [ ] Activity logger works with migrated data
- [ ] Messaging engine works with migrated data
- [ ] Automation engine works with migrated data

### UI Validation
- [ ] Migrated contacts display correctly
- [ ] Entity type badges show "Institution"
- [ ] Workspace scope shows correctly
- [ ] Pipeline stages display correctly
- [ ] Tags display correctly
- [ ] Focal persons display correctly
- [ ] Billing data displays correctly

## Requirements Validation

### Requirement 18: Backward Compatibility
- [ ] Schools collection retained intact
- [ ] `migrationStatus` field added
- [ ] Adapter layer can resolve migrated records
- [ ] Unified contact object constructible
- [ ] All existing features work with adapter layer

### Requirement 19: Migration Script
- [ ] Reads all schools documents
- [ ] Creates entity with entityType: institution
- [ ] Creates workspace_entities for each workspace
- [ ] Copies data to institutionData
- [ ] Generates slug for public URLs
- [ ] Copies pipelineId and stage
- [ ] Copies tags to workspaceTags
- [ ] Sets migrationStatus: "migrated"
- [ ] Idempotent (safe to run multiple times)
- [ ] Error handling (logs without aborting)
- [ ] Summary report (total, succeeded, failed, skipped)

## Sign-Off

### Test Execution
- [ ] All tests passed
- [ ] All validations completed
- [ ] All edge cases covered
- [ ] All requirements met

### Documentation
- [ ] Test summary document created
- [ ] Validation checklist completed
- [ ] Migration guide updated
- [ ] Known issues documented (if any)

### Approval
- [ ] Developer sign-off
- [ ] QA sign-off
- [ ] Product owner sign-off
- [ ] Ready for production migration

---

**Completed by**: _________________
**Date**: _________________
**Status**: ☐ Pass ☐ Fail ☐ Needs Review
**Notes**: _________________
