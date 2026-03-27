# Implementation Plan: SchoolId to EntityId Migration

## Overview

This implementation plan breaks down the migration from `schoolId` to `entityId` across all SmartSapp features into discrete, actionable coding tasks. The migration follows a dual-write pattern to maintain backward compatibility while progressively adopting the unified entity architecture.

The core entity system (entities and workspace_entities collections) has already been migrated. This plan focuses on migrating 14 feature modules and providing comprehensive migration tooling through the seeds page.

## Migration Strategy

1. **Phase 1**: Foundation - Contact Adapter, data models, and migration engine
2. **Phase 2**: Migration Tooling - Seeds page UI and migration operations
3. **Phase 3**: Feature Modules - Migrate 14 feature modules with dual-write pattern
4. **Phase 4**: Testing & Validation - Comprehensive testing and verification
5. **Phase 5**: Documentation & Deployment - Final documentation and rollout

## Tasks

### Phase 1: Foundation

- [x] 1. Set up Contact Adapter layer
  - [x] 1.1 Create Contact Adapter interface and implementation
    - Create `src/lib/contact-adapter.ts` with `ContactAdapter` interface
    - Implement `resolveContact()` method to resolve from entities or schools
    - Implement `getWorkspaceContacts()` method for workspace-scoped queries
    - Implement `contactExists()` method for validation
    - Implement `searchContacts()` method for search functionality
    - Add caching layer (5-minute TTL) for performance
    - _Requirements: 11.1, 23.1, 25.4_
  
  - [x] 1.2 Write unit tests for Contact Adapter
    - Test resolution of migrated entities
    - Test resolution of legacy schools
    - Test fallback behavior when entity not found
    - Test workspace boundary enforcement
    - Test caching behavior
    - _Requirements: 26.4_


- [x] 2. Update core data models with dual-write fields
  - [x] 2.1 Update Task interface with entityId fields
    - Add `entityId?: string | null` field to Task interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Mark `schoolId` and `schoolName` as optional for backward compatibility
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_
  
  - [x] 2.2 Update Activity interface with entityId fields
    - Add `entityId?: string | null` field to Activity interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Add `entitySlug?: string` for denormalized performance
    - Add `displayName?: string` for denormalized performance
    - Mark `schoolId` and `schoolName` as optional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1_
  
  - [x] 2.3 Update Form and FormSubmission interfaces with entityId fields
    - Add entityId fields to Form interface
    - Add entityId fields to FormSubmission interface
    - Mark schoolId as optional in both interfaces
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.2_
  
  - [x] 2.4 Update Invoice interface with entityId fields
    - Add `entityId?: string` field to Invoice interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Mark `schoolId` and `schoolName` as optional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1_
  
  - [x] 2.5 Update Meeting interface with entityId fields
    - Add `entityId?: string` field to Meeting interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Mark `schoolSlug` as optional (used in public URLs)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1_
  
  - [x] 2.6 Update Survey and SurveyResponse interfaces with entityId fields
    - Add entityId fields to Survey interface
    - Add entityId fields to SurveyResponse interface
    - Mark schoolId as optional in both interfaces
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 13.2_
  
  - [x] 2.7 Update MessageLog interface with entityId fields
    - Add `entityId?: string | null` field to MessageLog interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Mark `schoolId` as optional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 15.2_
  
  - [x] 2.8 Update PDF interface with entityId fields
    - Add `entityId?: string | null` field to PDF interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Mark `schoolId` as optional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 16.5_
  
  - [x] 2.9 Update AutomationLog interface with entityId fields
    - Add `entityId?: string | null` field to AutomationLog interface
    - Add `entityType?: 'institution' | 'family' | 'person'` field
    - Mark `schoolId` as optional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 14.2_

- [x] 3. Create migration engine core
  - [x] 3.1 Implement migration data models
    - Create `src/lib/migration-types.ts` with MigrationStatus, MigrationResult, VerificationResult interfaces
    - Create MigrationBatch, EnrichedRecord, EnrichedBatch interfaces
    - Create MigrationError, ValidationError interfaces
    - _Requirements: 17.3, 17.5_
  
  - [x] 3.2 Implement migration engine interface
    - Create `src/lib/migration-engine.ts` with MigrationEngine interface
    - Implement `fetch()` method to identify unmigrated records
    - Implement `enrich()` method to resolve entityId from schoolId
    - Implement `restore()` method to update records with backups
    - Implement `verify()` method to validate migration completeness
    - Implement `rollback()` method to restore from backups
    - Add batch processing logic (450 records per batch)
    - _Requirements: 18.1, 19.1, 19.2, 19.7, 20.1, 21.2_
  
  - [x] 3.3 Write unit tests for migration engine
    - Test fetch operation identifies unmigrated records correctly
    - Test enrich operation resolves entityId correctly
    - Test restore operation creates backups before updating
    - Test verify operation counts migrated/unmigrated/orphaned records
    - Test rollback operation restores from backups
    - Test batch processing handles large datasets
    - Test error handling for individual record failures
    - _Requirements: 26.1_

- [x] 4. Checkpoint - Foundation complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 2: Migration Tooling

- [ ] 5. Create Seeds page migration UI
  - [ ] 5.1 Create migration card component
    - Create `src/components/seeds/MigrationCard.tsx` component
    - Display feature name, collection name, and description
    - Display migration status (not_started, in_progress, completed, failed)
    - Display record counts (total, migrated, unmigrated, failed)
    - Display action buttons (Fetch, Enrich & Restore, Verify, Rollback)
    - Display progress bar and percentage
    - Display real-time error log
    - _Requirements: 17.2, 17.3, 17.4, 17.5_
  
  - [ ] 5.2 Create migration dashboard page
    - Create or update `/seeds` page with "Feature Data Migration" section
    - Display migration cards for all 14 feature modules
    - Add "Migrate All Features" button for sequential migration
    - Add migration log panel showing real-time progress
    - Add filter/search for specific feature modules
    - _Requirements: 17.1, 17.6, 17.7_
  
  - [ ]* 5.3 Write integration tests for Seeds page UI
    - Test migration card displays correct status
    - Test action buttons trigger correct operations
    - Test progress updates in real-time
    - Test error display and logging
    - _Requirements: 26.2_

- [ ] 6. Implement fetch operation for all collections
  - [ ] 6.1 Implement fetch for tasks collection
    - Query tasks where `schoolId` exists and `entityId` is null
    - Return count of records to migrate
    - Return sample records (first 5) for preview
    - Identify invalid records (missing schoolId)
    - _Requirements: 18.1, 18.2, 18.3, 18.4_
  
  - [ ] 6.2 Implement fetch for activities, forms, invoices, meetings, surveys, message_logs, pdfs, automation_logs collections
    - Implement fetch operation for each collection following same pattern as tasks
    - Query for records with schoolId but no entityId
    - Return counts and samples for each collection
    - _Requirements: 18.1, 18.2, 18.3, 18.4_
  
  - [ ]* 6.3 Write property test for fetch accuracy
    - **Property 8: Migration Fetch Accuracy**
    - **Validates: Requirements 18.1, 19.1**
    - Test that fetch returns exactly records with schoolId but no entityId
    - Use fast-check to generate random collection states
    - _Requirements: 26.3_

- [ ] 7. Implement enrich & restore operation
  - [ ] 7.1 Implement enrichment logic
    - For each record with schoolId, query schools collection
    - If school has `migrationStatus === 'migrated'`, use school's entityId
    - If school doesn't have entityId, generate using format `entity_<schoolId>`
    - Determine entityType from school data (default to 'institution')
    - Handle missing schools with error logging
    - _Requirements: 19.2, 19.3, 19.4_
  
  - [ ] 7.2 Implement backup and restore logic
    - Create backup collection `backup_<collection>_entity_migration` before updates
    - Copy original record to backup with `backedUpAt` timestamp
    - Update original record with entityId and entityType fields
    - Preserve original schoolId field (dual-write)
    - Process in batches of 450 records
    - _Requirements: 19.5, 19.6, 19.7_
  
  - [ ] 7.3 Implement error handling and progress tracking
    - Log errors for individual record failures
    - Continue processing remaining records after error
    - Track progress (percentage, records processed, current batch)
    - Return summary (total, succeeded, failed, skipped)
    - _Requirements: 19.8, 19.9, 19.11_
  
  - [ ]* 7.4 Write property tests for enrichment and idempotency
    - **Property 9: Migration Enrichment Correctness**
    - **Validates: Requirements 19.2, 19.3, 19.4**
    - **Property 13: Migration Idempotency**
    - **Validates: Requirements 19.10**
    - Test enrichment uses correct entityId based on migration status
    - Test running migration multiple times produces same result
    - _Requirements: 26.3_
  
  - [ ]* 7.5 Write property test for backup creation
    - **Property 10: Migration Backup Creation**
    - **Validates: Requirements 19.5**
    - Test that backup is created before each record update
    - _Requirements: 26.3_
  
  - [ ]* 7.6 Write property test for field preservation
    - **Property 11: Migration Field Preservation**
    - **Validates: Requirements 19.6**
    - Test that schoolId remains unchanged during migration
    - _Requirements: 26.3_

- [ ] 8. Implement verify operation
  - [ ] 8.1 Implement verification logic
    - Count records with entityId (migrated)
    - Count records with schoolId but no entityId (unmigrated)
    - Check for orphaned records (entityId doesn't exist in entities collection)
    - Validate all migrated records have valid entityId and entityType
    - Return detailed verification report
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  
  - [ ]* 8.2 Write property tests for verification
    - **Property 14: Verification Completeness**
    - **Validates: Requirements 20.1, 20.2, 20.5**
    - **Property 15: Verification Validation**
    - **Validates: Requirements 20.3, 20.4**
    - Test verification correctly counts migrated/unmigrated/orphaned records
    - Test verification validates entityId and entityType fields
    - _Requirements: 26.3_

- [ ] 9. Implement rollback operation
  - [ ] 9.1 Implement rollback logic
    - Query backup collection `backup_<collection>_entity_migration`
    - Restore each record to original state (remove entityId and entityType)
    - Delete backup collection after successful rollback
    - Track rollback progress and errors
    - Make operation idempotent (safe to run multiple times)
    - _Requirements: 21.2, 21.3, 21.4, 21.6_
  
  - [ ]* 9.2 Write property tests for rollback
    - **Property 16: Rollback Restoration**
    - **Validates: Requirements 21.2, 21.3**
    - **Property 17: Rollback Cleanup**
    - **Validates: Requirements 21.4**
    - **Property 18: Rollback Idempotency**
    - **Validates: Requirements 21.6**
    - Test rollback restores records to pre-migration state
    - Test backup collection is deleted after rollback
    - Test rollback can be run multiple times safely
    - _Requirements: 26.3_

- [ ] 10. Checkpoint - Migration tooling complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 3: Feature Module Migrations

- [ ] 11. Migrate Task module
  - [ ] 11.1 Update task creation with dual-write
    - Update `createTask()` server action to populate both schoolId and entityId
    - Resolve schoolId from entityId when only entityId provided
    - Resolve entityId from schoolId when only schoolId provided (if migrated)
    - Set entityType based on contact type
    - _Requirements: 3.1, 25.3_
  
  - [ ] 11.2 Update task query functions with fallback
    - Update `getTasksForContact()` to accept either entityId or schoolId
    - Prefer entityId when both provided
    - Add Firestore composite index for workspaceId + entityId + dueDate
    - _Requirements: 3.4, 3.5, 22.1, 22.3_
  
  - [ ] 11.3 Update task UI components to use Contact Adapter
    - Update TaskList component to resolve contact via adapter
    - Update TaskDetail component to display entity information
    - Update TaskForm component to accept entityId as primary identifier
    - _Requirements: 3.6, 3.7, 23.1, 23.2_
  
  - [ ]* 11.4 Write property tests for task dual-write and queries
    - **Property 1: Dual-Write Consistency**
    - **Validates: Requirements 2.5, 3.1**
    - **Property 2: Query Fallback Pattern**
    - **Validates: Requirements 3.4, 3.5**
    - Test new tasks include both schoolId and entityId
    - Test queries work with either identifier
    - _Requirements: 26.3, 26.5_
  
  - [ ]* 11.5 Write property test for identifier preservation
    - **Property 3: Identifier Preservation Invariant**
    - **Validates: Requirements 3.2**
    - Test task updates preserve schoolId, entityId, entityType
    - _Requirements: 26.3_
  
  - [ ]* 11.6 Write unit tests for task module
    - Test task creation with entityId only
    - Test task creation with schoolId only
    - Test task creation with both identifiers
    - Test task query by entityId
    - Test task query by schoolId
    - Test Contact Adapter integration in UI
    - _Requirements: 26.2_

- [ ] 12. Migrate Activity module
  - [ ] 12.1 Update activity logging with dual-write
    - Update `logActivity()` server action to populate both schoolId and entityId
    - Add entitySlug and displayName for denormalized performance
    - Set entityType based on contact type
    - _Requirements: 4.1, 25.3_
  
  - [ ] 12.2 Update activity query functions with fallback
    - Update `getActivitiesForContact()` to accept either entityId or schoolId
    - Add Firestore composite index for workspaceId + entityId + timestamp
    - _Requirements: 4.2, 22.1, 22.3_
  
  - [ ] 12.3 Update activity UI components to use Contact Adapter
    - Update ActivityTimeline component to resolve contact via adapter
    - Update ActivityLog component to display entity information
    - Add filtering by entityId with schoolId fallback
    - _Requirements: 4.3, 4.5, 23.1_
  
  - [ ]* 12.4 Write unit tests for activity module
    - Test activity logging with entityId
    - Test activity logging with schoolId
    - Test activity queries by entityId and schoolId
    - Test Contact Adapter integration
    - _Requirements: 26.2_

- [ ] 13. Migrate Pipeline module
  - [ ] 13.1 Update pipeline stage assignment to use entityId
    - Update stage assignment logic to use entityId as primary identifier
    - Update workspace_entities records when contacts move between stages
    - Maintain backward compatibility for legacy schools
    - _Requirements: 5.1, 5.2_
  
  - [ ] 13.2 Update pipeline UI to use Contact Adapter
    - Update PipelineView component to resolve contacts via adapter
    - Update pipeline queries to use workspace_entities collection
    - Display entity information from entities + workspace_entities
    - _Requirements: 5.3, 5.4, 23.1_
  
  - [ ]* 13.3 Write unit tests for pipeline module
    - Test stage assignment with entityId
    - Test pipeline queries use workspace_entities
    - Test Contact Adapter integration
    - Test backward compatibility with legacy schools
    - _Requirements: 26.2_

- [ ] 14. Migrate Dashboard module
  - [ ] 14.1 Update dashboard queries to use entityId
    - Update contact count queries to use workspace_entities collection
    - Update recent activities query to use entityId references
    - Update tasks query to use entityId references
    - Add filtering by entityId for dashboard widgets
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 14.2 Write unit tests for dashboard module
    - Test dashboard loads with workspace_entities data
    - Test contact counts are accurate
    - Test recent activities display correctly
    - Test tasks display correctly
    - _Requirements: 26.2_

- [ ] 15. Migrate Forms module
  - [ ] 15.1 Update form creation and submission with dual-write
    - Update form creation to use entityId instead of schoolId
    - Update form submission to populate both schoolId and entityId
    - Update FormBuilder to accept entityId as contact identifier
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 15.2 Update form query functions with fallback
    - Update form queries to accept either entityId or schoolId
    - Add Firestore composite index for workspaceId + entityId + status
    - _Requirements: 7.5, 22.1, 22.3_
  
  - [ ] 15.3 Update form UI components to use Contact Adapter
    - Update FormSubmissionView to resolve contact via adapter
    - Update form list to display entity information
    - _Requirements: 7.4, 23.1_
  
  - [ ]* 15.4 Write unit tests for forms module
    - Test form creation with entityId
    - Test form submission with dual-write
    - Test form queries by entityId and schoolId
    - Test Contact Adapter integration
    - _Requirements: 26.2_

- [ ] 16. Migrate Invoices module
  - [ ] 16.1 Update invoice creation with entityId
    - Update invoice creation to use entityId instead of schoolId
    - Preserve entityId during invoice edits
    - Add Firestore composite index for organizationId + entityId + status
    - _Requirements: 8.1, 8.2, 22.3_
  
  - [ ] 16.2 Update invoice query functions with fallback
    - Update invoice queries to accept either entityId or schoolId
    - _Requirements: 8.4, 22.1_
  
  - [ ] 16.3 Update invoice UI and PDF generation to use Contact Adapter
    - Update InvoiceList to resolve contact via adapter
    - Update invoice PDF generation to include entity information
    - _Requirements: 8.3, 8.5, 23.1_
  
  - [ ]* 16.4 Write unit tests for invoices module
    - Test invoice creation with entityId
    - Test invoice queries by entityId and schoolId
    - Test invoice PDF includes entity information
    - Test Contact Adapter integration
    - _Requirements: 26.2_

- [ ] 17. Migrate Meetings module
  - [ ] 17.1 Update meeting creation with entityId
    - Update meeting creation to use entityId instead of schoolSlug
    - Preserve entityId during meeting edits
    - Add Firestore composite index for workspaceId + entityId + startTime
    - _Requirements: 9.1, 9.2, 22.3_
  
  - [ ] 17.2 Update meeting query functions with fallback
    - Update meeting queries to accept either entityId or schoolSlug
    - Update public meeting page to resolve entity using entityId or schoolSlug
    - _Requirements: 9.4, 9.5, 22.1_
  
  - [ ] 17.3 Update meeting UI to use Contact Adapter
    - Update MeetingCalendar to resolve contact via adapter
    - Display entity information in meeting details
    - _Requirements: 9.3, 23.1_
  
  - [ ]* 17.4 Write unit tests for meetings module
    - Test meeting creation with entityId
    - Test meeting queries by entityId and schoolSlug
    - Test public meeting page resolution
    - Test Contact Adapter integration
    - _Requirements: 26.2_

- [ ] 18. Migrate Signups module
  - [ ] 18.1 Update signup flow to create entities
    - Update signup handler to create entity record with unique entityId
    - Create workspace_entity record linking entity to workspace
    - Do not create legacy school records for new signups
    - Use format `entity_<random_id>` for entityId generation
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 18.2 Update signup activity logging to use entityId
    - Log signup completion activity with entityId reference
    - Do not use schoolId in new signup activities
    - _Requirements: 10.5_
  
  - [ ]* 18.3 Write property tests for signup entity creation
    - **Property 4: Entity Creation Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.4**
    - **Property 5: No Legacy School Creation**
    - **Validates: Requirements 10.3**
    - **Property 6: Signup Activity Logging**
    - **Validates: Requirements 10.5**
    - Test signup creates both entity and workspace_entity records
    - Test signup does not create school records
    - Test signup activity uses entityId
    - _Requirements: 26.3_
  
  - [ ]* 18.4 Write unit tests for signups module
    - Test signup creates entity with correct format
    - Test signup creates workspace_entity link
    - Test signup does not create school record
    - Test signup activity logging
    - _Requirements: 26.2_

- [ ] 19. Migrate Profiles module
  - [ ] 19.1 Update profile page to load entity data
    - Update profile page to resolve entity using entityId via Contact Adapter
    - Display entity information from entities collection
    - Display workspace-specific information from workspace_entities collection
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ] 19.2 Update profile edit to update correct collections
    - Route identity field updates (name, contacts, globalTags) to entities collection
    - Route operational field updates (pipelineId, stageId, assignedTo, workspaceTags) to workspace_entities collection
    - Use entityId as primary identifier for updates
    - _Requirements: 11.4, 11.5_
  
  - [ ]* 19.3 Write property test for profile update routing
    - **Property 7: Profile Update Routing**
    - **Validates: Requirements 11.4, 11.5**
    - Test identity updates modify entities collection
    - Test operational updates modify workspace_entities collection
    - _Requirements: 26.3_
  
  - [ ]* 19.4 Write unit tests for profiles module
    - Test profile loads entity data correctly
    - Test profile displays workspace-specific data
    - Test identity field updates go to entities
    - Test operational field updates go to workspace_entities
    - _Requirements: 26.2_

- [ ] 20. Migrate Settings module
  - [ ] 20.1 Update settings to query and update using entityId
    - Update settings queries to use entityId
    - Update settings updates to use entityId
    - Maintain backward compatibility for legacy school settings
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [ ] 20.2 Update settings UI to use Contact Adapter
    - Update settings page to display entity information via adapter
    - _Requirements: 12.3, 23.1_
  
  - [ ]* 20.3 Write unit tests for settings module
    - Test settings load with entityId
    - Test settings update with entityId
    - Test backward compatibility with schoolId
    - _Requirements: 26.2_

- [ ] 21. Migrate Surveys module
  - [ ] 21.1 Update survey creation and responses with dual-write
    - Update survey creation to use entityId instead of schoolId
    - Update survey response submission to populate both schoolId and entityId
    - Update SurveyBuilder to accept entityId as contact identifier
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [ ] 21.2 Update survey query functions with fallback
    - Update survey queries to accept either entityId or schoolId
    - Add Firestore composite index for workspaceId + entityId + status
    - _Requirements: 13.5, 22.1, 22.3_
  
  - [ ] 21.3 Update survey UI to use Contact Adapter
    - Update SurveyResultsView to resolve contact via adapter
    - Display entity information in survey results
    - _Requirements: 13.4, 23.1_
  
  - [ ]* 21.4 Write unit tests for surveys module
    - Test survey creation with entityId
    - Test survey response with dual-write
    - Test survey queries by entityId and schoolId
    - Test Contact Adapter integration
    - _Requirements: 26.2_

- [ ] 22. Migrate Automations module
  - [ ] 22.1 Update automation triggers to use entityId
    - Update automation engine to use entityId as primary contact identifier
    - Support both legacy schoolId and new entityId triggers during migration
    - _Requirements: 14.1, 14.5_
  
  - [ ] 22.2 Update automation actions with dual-write
    - Update task creation actions to populate both schoolId and entityId
    - Update contact update actions to modify entities collection using entityId
    - Update message sending to resolve contact using entityId
    - Set source field to 'automation' for automated tasks
    - _Requirements: 14.2, 14.3, 14.4_
  
  - [ ]* 22.3 Write property tests for automation dual-write and operations
    - **Property 19: Automation Dual-Write**
    - **Validates: Requirements 14.2**
    - **Property 20: Automation Entity Operations**
    - **Validates: Requirements 14.4**
    - **Property 21: Automation Trigger Compatibility**
    - **Validates: Requirements 14.5**
    - Test automated tasks include both identifiers
    - Test automation updates use entityId
    - Test triggers accept both identifiers
    - _Requirements: 26.3_
  
  - [ ]* 22.4 Write unit tests for automations module
    - Test automation triggers with entityId
    - Test automation task creation with dual-write
    - Test automation contact updates use entityId
    - Test backward compatibility with schoolId triggers
    - _Requirements: 26.2_

- [ ] 23. Migrate Messaging module
  - [ ] 23.1 Update message sending with dual-write
    - Update message sending to use entityId instead of schoolId
    - Update message log creation to populate both schoolId and entityId
    - Update MessageComposer to accept entityId as recipient identifier
    - _Requirements: 15.1, 15.2, 15.3_
  
  - [ ] 23.2 Update message query functions with fallback
    - Update message queries to accept either entityId or schoolId
    - Add Firestore composite index for workspaceId + entityId + createdAt
    - _Requirements: 15.5, 22.1, 22.3_
  
  - [ ] 23.3 Update messaging UI to use Contact Adapter
    - Update MessageHistory to resolve contact via adapter
    - Display entity information in message logs
    - _Requirements: 15.4, 23.1_
  
  - [ ]* 23.4 Write unit tests for messaging module
    - Test message sending with entityId
    - Test message log creation with dual-write
    - Test message queries by entityId and schoolId
    - Test Contact Adapter integration
    - _Requirements: 26.2_

- [ ] 24. Migrate PDF module
  - [ ] 24.1 Update PDF generation with entityId
    - Update PDF form creation to use entityId instead of schoolId
    - Update PDF generation to resolve entity information using entityId
    - Update PDF templates to support entity variables
    - Populate both schoolId and entityId in PDF records
    - _Requirements: 16.1, 16.2, 16.3, 16.5_
  
  - [ ] 24.2 Update PDF query functions with fallback
    - Update PDF queries to accept either entityId or schoolId
    - Add Firestore composite index for workspaceId + entityId + createdAt
    - _Requirements: 16.4, 22.1, 22.3_
  
  - [ ]* 24.3 Write unit tests for PDF module
    - Test PDF creation with entityId
    - Test PDF generation includes entity information
    - Test PDF queries by entityId and schoolId
    - Test PDF templates support entity variables
    - _Requirements: 26.2_

- [ ] 25. Checkpoint - Feature modules migrated
  - Ensure all tests pass, ask the user if questions arise.


### Phase 4: Testing & Validation

- [ ] 26. Create comprehensive test suite
  - [ ] 26.1 Write integration tests for end-to-end workflows
    - Test complete migration cycle (fetch → enrich → restore → verify → rollback)
    - Test task creation with entity → resolve contact → display correctly
    - Test activity logging with entity → query → display timeline
    - Test form submission with entity → query → display results
    - Test message sending with entity → log → display history
    - _Requirements: 26.2, 26.7_
  
  - [ ]* 26.2 Write property test for workspace boundary enforcement
    - **Property 22: Workspace Boundary Enforcement**
    - **Validates: Requirements 29.1, 29.2**
    - Test users only access entities in authorized workspaces
    - Test queries enforce workspace boundaries
    - _Requirements: 26.3_
  
  - [ ]* 26.3 Write property tests for security and authorization
    - **Property 23: Entity Update Authorization**
    - **Validates: Requirements 29.3**
    - **Property 25: Cross-Workspace Isolation**
    - **Validates: Requirements 29.5**
    - Test entity updates require proper permissions
    - Test entityId queries prevent cross-workspace access
    - _Requirements: 26.3_
  
  - [ ]* 26.4 Write property test for migration error resilience
    - **Property 12: Migration Error Resilience**
    - **Validates: Requirements 19.9**
    - Test migration continues after individual record failures
    - _Requirements: 26.3_
  
  - [ ]* 26.5 Write unit tests for dual-write edge cases
    - Test record creation with entityId only
    - Test record creation with schoolId only
    - Test record creation with both identifiers
    - Test record creation with neither identifier (error case)
    - _Requirements: 26.2_
  
  - [ ]* 26.6 Write unit tests for Contact Adapter edge cases
    - Test resolution with migrated entity
    - Test resolution with legacy school
    - Test resolution with non-existent contact
    - Test resolution with invalid identifiers
    - Test caching behavior
    - _Requirements: 26.4_

- [ ] 27. Create Firestore indexes
  - [ ] 27.1 Create composite indexes for all feature collections
    - Create index: tasks (workspaceId ASC, entityId ASC, dueDate ASC)
    - Create index: activities (workspaceId ASC, entityId ASC, timestamp DESC)
    - Create index: workspace_entities (workspaceId ASC, entityType ASC, status ASC)
    - Create index: workspace_entities (workspaceId ASC, pipelineId ASC, stageId ASC)
    - Create index: message_logs (workspaceId ASC, entityId ASC, createdAt DESC)
    - Create index: forms (workspaceId ASC, entityId ASC, status ASC)
    - Create index: invoices (organizationId ASC, entityId ASC, status ASC)
    - Create index: meetings (workspaceId ASC, entityId ASC, startTime ASC)
    - Create index: surveys (workspaceId ASC, entityId ASC, status ASC)
    - Create index: pdfs (workspaceId ASC, entityId ASC, createdAt DESC)
    - Create index: automation_logs (workspaceId ASC, entityId ASC, executedAt DESC)
    - _Requirements: 22.3, 28.1_
  
  - [ ] 27.2 Verify index creation and query performance
    - Test queries use indexes (check Firestore console)
    - Measure query performance (should be < 1000ms)
    - _Requirements: 28.1_

- [ ] 28. Performance optimization
  - [ ] 28.1 Implement Contact Adapter caching
    - Add 5-minute TTL cache for resolved contacts
    - Use LRU cache to limit memory usage
    - Invalidate cache on entity updates
    - _Requirements: 28.3_
  
  - [ ] 28.2 Optimize denormalized fields in workspace_entities
    - Ensure displayName, primaryEmail, primaryPhone are populated
    - Update denormalized fields when entity data changes
    - Use denormalized fields to avoid additional lookups
    - _Requirements: 28.2_
  
  - [ ] 28.3 Optimize batch processing for migration
    - Use batch size of 450 records (under Firestore 500 limit)
    - Process batches in parallel where possible
    - Monitor Firestore costs during migration
    - _Requirements: 28.4_
  
  - [ ]* 28.4 Write performance tests
    - Test query performance with entityId < 1000ms
    - Test Contact Adapter caching reduces lookups
    - Test batch processing handles large datasets efficiently
    - _Requirements: 28.1, 28.5_

- [ ] 29. Security and permissions verification
  - [ ] 29.1 Update Firestore security rules for entities
    - Add rules to enforce workspace boundaries for workspace_entities
    - Add rules to verify user permissions for entity updates
    - Add rules to prevent cross-workspace data leakage
    - _Requirements: 29.1, 29.2, 29.3, 29.5_
  
  - [ ] 29.2 Implement audit logging for entity operations
    - Log all entity data access operations
    - Log all entity modification operations
    - Include user, operation type, timestamp, affected entity in logs
    - _Requirements: 29.4_
  
  - [ ]* 29.3 Write security tests
    - Test workspace boundary enforcement
    - Test entity update authorization
    - Test cross-workspace isolation
    - Test audit logging captures all operations
    - _Requirements: 26.2_

- [ ] 30. Monitoring and observability
  - [ ] 30.1 Implement migration operation logging
    - Log all migration operations (fetch, enrich, restore, verify, rollback)
    - Include operation type, collection, timestamp, result summary
    - _Requirements: 30.1_
  
  - [ ] 30.2 Implement migration metrics tracking
    - Track records processed, success count, failure count, duration
    - Display metrics in Seeds page dashboard
    - _Requirements: 30.2_
  
  - [ ] 30.3 Implement migration error alerting
    - Send alert when failure rate exceeds 5% of records
    - Include error details and affected collection in alert
    - _Requirements: 30.3_
  
  - [ ] 30.4 Implement migration log retention
    - Retain migration logs for 90 days
    - Provide log export functionality for audit purposes
    - _Requirements: 30.5_
  
  - [ ]* 30.5 Write property tests for monitoring
    - **Property 26: Migration Operation Logging**
    - **Validates: Requirements 30.1**
    - **Property 27: Migration Metrics Tracking**
    - **Validates: Requirements 30.2**
    - **Property 28: Migration Error Alerting**
    - **Validates: Requirements 30.3**
    - **Property 29: Migration Log Retention**
    - **Validates: Requirements 30.5**
    - Test all operations are logged
    - Test metrics are tracked correctly
    - Test alerts trigger at 5% failure threshold
    - Test logs are retained for 90 days
    - _Requirements: 26.3_

- [ ] 31. Checkpoint - Testing and validation complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 5: Documentation & Deployment

- [ ] 32. Create migration documentation
  - [ ] 32.1 Write migration runbook
    - Document step-by-step migration process
    - Include pre-migration checklist (backups, index creation, testing)
    - Include migration execution steps (fetch, enrich, restore, verify)
    - Include post-migration validation steps
    - Include rollback procedures for each feature
    - _Requirements: 27.1_
  
  - [ ] 32.2 Write architecture documentation
    - Document entity model architecture (entities + workspace_entities)
    - Document Contact Adapter pattern and usage
    - Document dual-write pattern and migration strategy
    - Document query patterns (entityId with schoolId fallback)
    - Include architecture diagrams
    - _Requirements: 27.2_
  
  - [ ] 32.3 Write API documentation
    - Document all API endpoints with entityId parameters
    - Include examples for creating records with entityId
    - Include examples for querying by entityId
    - Document backward compatibility with schoolId
    - Document deprecation timeline for schoolId parameters
    - _Requirements: 27.3_
  
  - [ ] 32.4 Write developer guide
    - Document how to work with entities in new features
    - Document how to use Contact Adapter
    - Document dual-write pattern for new features
    - Include code examples and best practices
    - Document testing patterns for entity-based features
    - _Requirements: 27.4_
  
  - [ ] 32.5 Write troubleshooting guide
    - Document common migration issues and solutions
    - Document how to handle orphaned entity references
    - Document how to resolve Contact Adapter errors
    - Document how to debug query performance issues
    - Include FAQ section
    - _Requirements: 27.5_

- [ ] 33. Update API endpoints for entityId support
  - [ ] 33.1 Update API endpoints to accept entityId
    - Update all contact-related endpoints to accept either schoolId or entityId
    - Prefer entityId when both provided
    - Return both schoolId and entityId in responses
    - _Requirements: 24.1, 24.2_
  
  - [ ] 33.2 Update API documentation with deprecation notices
    - Mark schoolId parameters as deprecated
    - Document migration timeline for API consumers
    - Provide migration examples for API clients
    - _Requirements: 24.3, 24.4_
  
  - [ ] 33.3 Update API endpoints for entity creation
    - Update contact creation endpoints to generate entityId
    - Create entity and workspace_entity records for new contacts
    - Do not create legacy school records
    - _Requirements: 24.5_
  
  - [ ]* 33.4 Write API integration tests
    - Test API accepts both schoolId and entityId
    - Test API returns both identifiers in responses
    - Test API creates entities for new contacts
    - _Requirements: 26.2_

- [ ] 34. Update server actions for entityId support
  - [ ] 34.1 Update all server actions to accept entityId
    - Update server actions to accept either schoolId or entityId
    - Use entityId as primary identifier in database operations
    - Maintain backward compatibility with schoolId parameters
    - _Requirements: 25.1, 25.2_
  
  - [ ] 34.2 Update server actions to use Contact Adapter
    - Use Contact Adapter for all contact resolution
    - Display entity information from adapter results
    - _Requirements: 25.4_
  
  - [ ]* 34.3 Write server action tests
    - Test server actions accept both identifiers
    - Test server actions use entityId for operations
    - Test Contact Adapter integration
    - Test backward compatibility
    - _Requirements: 26.2_

- [ ] 35. Update UI components for entityId support
  - [ ] 35.1 Update contact selection components
    - Update all contact dropdowns to use entityId as value
    - Display entity information from Contact Adapter
    - Populate entityId field when contact selected
    - _Requirements: 23.2, 23.4_
  
  - [ ] 35.2 Update contact display components
    - Update all contact display components to use Contact Adapter
    - Show entity information from entities + workspace_entities
    - Handle both migrated and legacy contacts gracefully
    - _Requirements: 23.3, 23.5_
  
  - [ ]* 35.3 Write UI component tests
    - Test contact selection populates entityId
    - Test contact display shows entity information
    - Test components handle migrated and legacy contacts
    - _Requirements: 26.2_

- [ ] 36. Execute migration for all feature collections
  - [ ] 36.1 Run migration for tasks collection
    - Execute fetch operation to preview records
    - Execute enrich & restore operation
    - Execute verify operation to confirm completeness
    - Monitor for errors and address issues
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.2 Run migration for activities collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.3 Run migration for forms collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.4 Run migration for invoices collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.5 Run migration for meetings collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.6 Run migration for surveys collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.7 Run migration for message_logs collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.8 Run migration for pdfs collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_
  
  - [ ] 36.9 Run migration for automation_logs collection
    - Execute fetch, enrich & restore, verify operations
    - Monitor and address any errors
    - _Requirements: 17.6, 18.5, 19.11, 20.6_

- [ ] 37. Post-migration validation
  - [ ] 37.1 Verify all collections migrated successfully
    - Run verify operation on all collections
    - Confirm zero unmigrated records
    - Confirm zero orphaned records
    - Address any validation errors
    - _Requirements: 20.6, 20.7_
  
  - [ ] 37.2 Test critical user workflows
    - Test task creation and display
    - Test activity logging and timeline
    - Test form submission and results
    - Test invoice generation and display
    - Test meeting scheduling and display
    - Test message sending and history
    - _Requirements: 26.7_
  
  - [ ] 37.3 Monitor application performance
    - Monitor query performance (should be < 1000ms)
    - Monitor error rates (should be < 1%)
    - Monitor Firestore costs
    - Address any performance issues
    - _Requirements: 28.1, 28.5_
  
  - [ ] 37.4 Verify security and permissions
    - Test workspace boundary enforcement
    - Test entity update authorization
    - Test cross-workspace isolation
    - Verify audit logs are being created
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_

- [ ] 38. Final checkpoint - Migration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- Migration is executed in Phase 5 after all code changes are complete
- Rollback capability is available for each collection via Seeds page

## Migration Execution Order

The migration should be executed in this order to minimize risk:

1. **Low-risk collections first**: automation_logs, pdfs, message_logs (logging/audit data)
2. **Medium-risk collections**: surveys, forms, meetings (less frequently accessed)
3. **High-risk collections**: activities, tasks (frequently accessed, critical features)
4. **Critical collections last**: invoices (financial data, requires extra validation)

Each collection should be migrated, verified, and monitored before proceeding to the next.

## Rollback Strategy

If issues are discovered after migration:

1. Use the Seeds page "Rollback" button for the affected collection
2. Verify rollback completed successfully using "Verify" button
3. Address the root cause of the issue
4. Re-run the migration when ready

All backup collections are retained until explicitly deleted, allowing rollback at any time.
