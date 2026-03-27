# Implementation Plan: Contacts Expansion (Institutions, Families, Persons)

## Overview

This implementation plan transforms SmartSapp's contact system from a single "schools" model to a unified entity architecture supporting three distinct contact scopes: institution, family, and person. Each workspace declares exactly one contact scope, governing its data model, UI, workflows, and automations. The architecture introduces an `entities` collection (unified contact identity), a `workspace_entities` link collection (workspace-specific operational state), and a `contactScope` field on workspaces. All existing `schools` data remains operational via a backward-compatible adapter layer during and after migration.

This is a major architectural upgrade requiring careful phased execution to avoid breaking production. The plan follows phases with checkpoints, covers all 27 requirements, and includes property-based tests for all 8 correctness properties.

## Implementation Principles

- Incremental delivery: each phase builds on the previous
- Backward compatibility: existing features continue working via adapter layer
- Early validation: checkpoints after each major phase
- Property-based testing: verify architectural invariants
- No breaking changes: migration is opt-in per workspace

## Tasks

- [x] 1. Set up data models and type definitions
  - Create TypeScript interfaces for Entity, WorkspaceEntity, Guardian, Child, InstitutionData, FamilyData, PersonData
  - Add contactScope and capabilities fields to Workspace interface
  - Add entityId and entityType fields to Task, Activity, MessageLog interfaces
  - Update existing types.ts with new entity-related types
  - _Requirements: 2, 3, 12, 13, 15, 16, 17_

- [x] 2. Create Firestore i
ndexes for entities and workspace_entities
  - Add composite indexes for workspace_entities: (workspaceId, status), (workspaceId, stageId), (workspaceId, assignedTo), (workspaceId, workspaceTags array-contains)
  - Add composite indexes for entities: (organizationId, entityType), (organizationId, globalTags array-contains)
  - Update firestore.indexes.json with all required indexes
  - _Requirements: 22_


- [x] 3. Checkpoint - Type definitions compile
  - Ensure all TypeScript interfaces compile without errors
  - Verify no breaking changes to existing type imports
  - Ask the user if questions arise

- [-] 4. Implement ScopeGuard validation functions
  - [x] 4.1 Create validateScopeMatch function
    - Implement validation logic: entity.entityType === workspace.contactScope
    - Return structured error with code SCOPE_MISMATCH
    - _Requirements: 4_
  
  - [x] 4.2 Write property test for ScopeGuard invariant
    - **Property 1: ScopeGuard Invariant**
    - **Validates: Requirements 4**
    - Generate random (entityType, contactScope) combinations
    - Assert mismatched pairs are always rejected with SCOPE_MISMATCH error

- [x] 5. Implement core entity server actions
  - [x] 5.1 Implement createEntityAction
    - Validate entityType is one of: institution, family, person
    - Validate entity data matches entityType (institutionData for institution, etc.)
    - Create entity document in entities collection
    - Generate slug for institution entities (for public URLs)
    - Log activity with entityId and entityType
    - _Requirements: 2, 15, 16, 17, 26_
  
  - [x] 5.2 Implement updateEntityAction
    - Validate entity exists
    - Update entity fields
    - Trigger denormalization sync to workspace_entities
    - Log activity with entityId and entityType
    - _Requirements: 2, 22_
  
  - [x] 5.3 Implement deleteEntityAction (soft delete)
    - Mark entity as archived
    - Do not delete workspace_entities records (preserve history)
    - Log activity
    - _Requirements: 2_

- [x] 6. Implement workspace-entity link server actions
  - [x] 6.1 Implement linkEntityToWorkspaceAction
    - Validate entity exists
    - Validate workspace exists
    - Enforce ScopeGuard: entity.entityType === workspace.contactScope
    - Create workspace_entities document with denormalized fields
    - Lock workspace contactScope if this is first entity
    - Log workspace_scope_locked activity if applicable
    - _Requirements: 3, 4, 6_
  
  - [x] 6.2 Implement unlinkEntityFromWorkspaceAction
    - Validate workspace_entities record exists
    - Delete workspace_entities document
    - Do NOT delete entity document
    - Log activity
    - _Requirements: 3_
  
  - [x] 6.3 Implement updateWorkspaceEntityAction
    - Update pipelineId, stageId, assignedTo, status, workspaceTags on workspace_entities
    - Do NOT update entity root fields
    - Log activity
    - _Requirements: 3, 5_

- [x] 7. Checkpoint - Core entity and link actions work
  - Ensure all server actions compile and pass basic validation tests
  - Verify ScopeGuard rejects mismatched entity types
  - Ask the user if questions arise

- [x] 8. Implement tag system migration (global vs workspace tags)
  - [x] 8.1 Create tag migration utility
    - Read existing tags from schools collection
    - Classify tags as global or workspace-scoped based on naming convention or manual mapping
    - Write global tags to entities.globalTags
    - Write workspace tags to workspace_entities.workspaceTags
    - _Requirements: 7_
  
  - [x] 8.2 Update tag application logic
    - Modify applyTagAction to accept scope parameter: "global" or "workspace"
    - If scope is "global", write to entities.globalTags
    - If scope is "workspace", write to workspace_entities.workspaceTags for current workspace
    - _Requirements: 7_
  
  - [x] 8.3 Update tag removal logic
    - Modify removeTagAction to accept scope parameter
    - Ensure removing workspace tag does not remove global tag
    - Ensure removing global tag does not remove workspace tag
    - _Requirements: 7_
  
  - [x] 8.4 Write property test for tag partition invariant
    - **Property 4: Tag Partition Invariant**
    - **Validates: Requirements 7**
    - Apply and remove tags in both global and workspace scopes
    - Assert operations on one scope do not affect the other

- [x] 9. Implement workspace contactScope declaration and locking
  - [x] 9.1 Add contactScope field to workspace creation flow
    - Require contactScope selection during workspace creation
    - Display scope options: "institution", "family", "person" with descriptions
    - Set capabilities defaults based on scope
    - _Requirements: 1_
  
  - [x] 9.2 Implement scope locking logic
    - When first entity is linked to workspace, set workspace.scopeLocked = true
    - Log workspace_scope_locked activity
    - Reject any attempt to change contactScope when scopeLocked is true
    - _Requirements: 6_
  
  - [x] 9.3 Write property test for scope immutability after activation
    - **Property 3: Scope Immutability After Activation**
    - **Validates: Requirements 6**
    - Generate workspaces with 0, 1, N linked entities
    - Assert scope changes accepted only when count is 0

- [x] 10. Checkpoint - Workspace scope and tags work correctly
  - Verify workspace scope locks after first entity link
  - Verify global and workspace tags are correctly separated
  - Ask the user if questions arise

- [x] 11. Checkpoint - Workspace scope is enforced
  - Test workspace creation with contactScope
  - Test scope lock after first entity linked
  - Verify UI displays scope correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 12. Refactor tag system for global vs workspace tags
  - [x] 12.1 Split tag storage into globalTags and workspaceTags
    - Add globalTags array to entities collection
    - Add workspaceTags array to workspace_entities collection
    - Update Tag interface to include scope field
    - _Requirements: 7_
  
  - [x] 12.2 Update applyTagsAction to write to correct scope
    - If tag is designated global, write to entity.globalTags
    - If tag is workspace-scoped, write to workspace_entities.workspaceTags
    - _Requirements: 7_
  
  - [x] 12.3 Update tag filtering to query workspace_entities
    - Query workspace_entities.workspaceTags for workspace-scoped filters
    - Query entities.globalTags for global filters
    - _Requirements: 7, 8_
  
  - [x] 12.4 Update tag variables in messaging to use workspaceTags
    - Resolve contact_tags from workspace_entities.workspaceTags for active workspace
    - _Requirements: 7, 11_
  
  - [x] 12.5 Write property test for tag partition invariant
    - **Property 4: Tag Partition Invariant**
    - **Validates: Requirements 7**
    - Apply and remove tags in both scopes
    - Assert operations on one scope do not affect the other

- [x] 13. Checkpoint - Tags work in both scopes
  - Test applying global tags to entities
  - Test applying workspace tags to workspace_entities
  - Verify tag filtering works correctly
  - Verify messaging variables resolve from correct scope
  - Ensure all tests pass, ask the user if questions arise

- [x] 14. Move pipeline/stage logic to workspace_entities
  - [x] 14.1 Remove pipelineId and stage from entity root
    - Pipeline state now lives exclusively on workspace_entities
    - _Requirements: 5_
  
  - [x] 14.2 Update pipeline Kanban to query workspace_entities
    - Query workspace_entities filtered by workspaceId and pipelineId
    - Hydrate entity data in second fetch
    - _Requirements: 5, 8_
  
  - [x] 14.3 Update stage change actions to update workspace_entities only
    - Update stageId and currentStageName on workspace_entities
    - Do not propagate to other workspaces
    - _Requirements: 5_
  
  - [x] 14.4 Write property test for pipeline state isolation
    - **Property 2: Pipeline State Isolation Invariant**
    - **Validates: Requirements 5**
    - Simulate concurrent stage updates from two workspaces on same entity
    - Assert each workspace_entities record retains independent stageId

- [x] 15. Checkpoint - Pipeline works per-workspace
  - Test moving entity through pipeline in one workspace
  - Verify same entity in different workspace has independent stage
  - Verify Kanban view queries workspace_entities correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 16. Implement adapter layer for backward compatibility
  - [x] 16.1 Create resolveContact function
    - Accept schoolId and workspaceId parameters
    - Check if migration record exists for schoolId
    - If migrated, read from entities + workspace_entities
    - If not migrated, read from schools collection
    - Return unified contact object
    - _Requirements: 18_
  
  - [x] 16.2 Add migrationStatus field to schools collection
    - Add field with values: legacy, migrated, dual-write
    - Update schools documents to track migration progress
    - _Requirements: 18_
  
  - [x] 16.3 Update existing features to use adapter layer
    - Update activity logger to use resolveContact
    - Update task system to use resolveContact
    - Update messaging engine to use resolveContact
    - Update automation engine to use resolveContact
    - _Requirements: 18_

- [x] 17. Checkpoint - Existing features work with adapter
  - Test activity logging with both legacy and migrated records
  - Test task creation with both record types
  - Test messaging with both record types
  - Verify no breaking changes to existing features
  - Ensure all tests pass, ask the user if questions arise

- [x] 18. Create scope-specific UI components
  - [x] 18.1 Create InstitutionForm component
    - Display fields: name, nominalRoll, billingAddress, currency, subscriptionPackageId, focalPersons
    - Validate nominalRoll is positive integer
    - _Requirements: 14, 15_
  
  - [x] 18.2 Create FamilyForm component
    - Display fields: familyName, guardians array, children array, admissionsData
    - Support adding/removing guardians and children
    - _Requirements: 14, 16_
  
  - [x] 18.3 Create PersonForm component
    - Display fields: firstName, lastName, company, jobTitle, leadSource
    - Require firstName and lastName
    - _Requirements: 14, 17_
  
  - [x] 18.4 Create scope-aware contact list columns
    - Institution workspace: show nominalRoll, subscriptionRate, billingAddress
    - Family workspace: show guardians count, children count, admissions stage
    - Person workspace: show company, jobTitle, leadSource
    - _Requirements: 14_
  
  - [x] 18.5 Create scope-aware contact detail pages
    - Institution detail: show billing summary, contracts, modules
    - Family detail: show guardians list, children list, admissions pipeline
    - Person detail: show company info, deal notes, follow-up tasks
    - Display entity type badge prominently
    - _Requirements: 14, 25_
  
  - [x] 18.6 Add workspace scope badge to UI
    - Display scope type in workspace switcher
    - Show scope lock indicator in settings
    - _Requirements: 25_

- [x] 19. Checkpoint - UI adapts to workspace scope
  - Test creating entities in each scope type
  - Verify forms show correct fields for each scope
  - Verify list columns adapt to workspace scope
  - Verify detail pages show scope-appropriate sections
  - Ensure all tests pass, ask the user if questions arise

- [x] 20. Update automation engine for workspace awareness
  - [x] 20.1 Add workspaceId to automation event payload
    - Include organizationId, workspaceId, entityId, entityType, action, actorId, timestamp
    - _Requirements: 10_
  
  - [x] 20.2 Update automation rule evaluation to filter by workspaceId
    - Evaluate rules only if rule.workspaceIds includes triggering workspaceId
    - _Requirements: 10_
  
  - [x] 20.3 Update TAG_ADDED and TAG_REMOVED triggers to use workspaceId
    - Use workspaceId from workspace_entities record where tag was applied
    - _Requirements: 10_
  
  - [x] 20.4 Update CREATE_TASK action to set workspaceId
    - Set workspaceId on created task to match triggering workspace
    - _Requirements: 10_
  
  - [x] 20.5 Add workspace scope display to automation builder UI
    - Show workspace scope of each automation rule
    - Warn if rule has no workspaceId constraint
    - _Requirements: 10_

- [x] 21. Update messaging engine for workspace awareness
  - [x] 21.1 Add workspaceId to message log documents
    - Record workspaceId on every message_logs document
    - _Requirements: 11_
  
  - [x] 21.2 Update sendMessage function to require workspaceId
    - Make workspaceId a mandatory parameter
    - _Requirements: 11_
  
  - [x] 21.3 Update message template variable resolution
    - Resolve variables using entity data + workspace_entities for active workspace
    - Resolve contact_tags from workspace_entities.workspaceTags
    - _Requirements: 11_
  
  - [x] 21.4 Add workspace filter to message history view
    - Filter messages by workspaceId by default
    - Add option to view all messages across workspaces
    - _Requirements: 11_
  
  - [x] 21.5 Support workspace-scoped message templates
    - Add workspaceIds array to template documents
    - Filter templates by workspace access
    - _Requirements: 11_

- [x] 22. Checkpoint - All integrations are workspace-aware
  - Test automation triggers include workspaceId
  - Test messaging logs include workspaceId
  - Verify template variables resolve from correct workspace context
  - Ensure all tests pass, ask the user if questions arise

- [x] 23. Update activity logger for workspace awareness
  - [x] 23.1 Add entityId and entityType to activity documents
    - Include workspaceId, entityId, entityType on all new activity entries
    - Maintain backward compatibility with schoolId and schoolName
    - _Requirements: 12_
  
  - [x] 23.2 Denormalize displayName and entitySlug on activity documents
    - Store displayName and entitySlug at time of logging
    - Ensure historical entries remain readable if entity renamed
    - _Requirements: 12_
  
  - [x] 23.3 Update activity timeline view to filter by workspaceId
    - Filter entries by workspaceId when viewed from workspace context
    - _Requirements: 12_
  
  - [x] 23.4 Support dual-write for legacy schools records
    - Populate both schoolId (legacy) and entityId (new) on activity documents
    - _Requirements: 12_

- [x] 24. Update task management for workspace awareness
  - [x] 24.1 Add entityId and entityType to task documents
    - Include entityId and entityType fields
    - Maintain backward compatibility with schoolId
    - _Requirements: 13_
  
  - [x] 24.2 Update task creation to require workspaceId
    - Set workspaceId on all new tasks
    - _Requirements: 13_
  
  - [x] 24.3 Update task list view to filter by workspaceId
    - Filter tasks by workspaceId when accessed from workspace
    - _Requirements: 13_
  
  - [x] 24.4 Display entity type badge on task cards
    - Show displayName and entityType badge
    - _Requirements: 13_
  
  - [x] 24.5 Support dual-write for legacy schools records
    - Populate both schoolId (legacy) and entityId (new) on task documents
    - _Requirements: 13_

- [x] 25. Checkpoint - Activity and task systems are workspace-aware
  - Test activity logging with entityId and workspaceId
  - Test task creation with entityId and workspaceId
  - Verify filtering works correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 26. Implement scope-specific import/export
  - [x] 26.1 Create institution import template
    - Define CSV columns: name, nominalRoll, billingAddress, currency, subscriptionPackageId, focalPerson_name, focalPerson_phone, focalPerson_email, focalPerson_type
    - _Requirements: 20_
  
  - [x] 26.2 Create family import template
    - Define CSV columns: familyName, guardian1_name, guardian1_phone, guardian1_email, guardian1_relationship, child1_firstName, child1_lastName, child1_gradeLevel
    - _Requirements: 20_
  
  - [x] 26.3 Create person import template
    - Define CSV columns: firstName, lastName, company, jobTitle, leadSource, phone, email
    - _Requirements: 20_
  
  - [x] 26.4 Implement import validation with ScopeGuard
    - Validate each row against workspace contactScope schema
    - Reject rows that do not conform
    - Enforce ScopeGuard: inferred entityType must match workspace contactScope
    - _Requirements: 20_
  
  - [x] 26.5 Implement import preview
    - Display first 10 rows with field mapping
    - Show validation errors before committing
    - _Requirements: 20_
  
  - [x] 26.6 Implement import error reporting
    - Record row number and error reason for failed rows
    - Continue processing remaining rows without aborting
    - _Requirements: 20_
  
  - [x] 26.7 Implement idempotent import
    - Match by name + organizationId to avoid duplicates
    - Re-uploading same file should not create duplicate entities
    - _Requirements: 20_
  
  - [x] 26.8 Implement export serializer
    - Serialize entity + workspace_entities data to CSV
    - Use scope-specific schema matching import template
    - _Requirements: 27_
  
  - [x] 26.9 Write property test for import round-trip
    - **Property 6: Import Round-Trip Property**
    - **Validates: Requirements 27**
    - Generate random valid entities for each scope
    - Serialize to CSV, parse back, assert structural equivalence

- [x] 27. Checkpoint - Import/export works for all scopes
  - Test importing institution CSV into institution workspace
  - Test importing family CSV into family workspace
  - Test importing person CSV into person workspace
  - Verify ScopeGuard rejects mismatched imports
  - Test export and re-import produces equivalent records
  - Ensure all tests pass, ask the user if questions arise

- [x] 28. Implement migration script for schools → entities + workspace_entities
  - [x] 28.1 Create migration script entry point
    - Read all documents from schools collection
    - Process in batches with progress logging
    - _Requirements: 19_
  
  - [x] 28.2 Implement entity creation from school record
    - Create entities document with entityType: institution
    - Copy school data to institutionData sub-document
    - Generate slug for public URLs
    - _Requirements: 19_
  
  - [x] 28.3 Implement workspace_entities creation
    - Create workspace_entities document for each (school, workspaceId) pair
    - Copy pipelineId and stage to workspace_entities
    - Copy tags to workspaceTags on workspace_entities
    - _Requirements: 19_
  
  - [x] 28.4 Set migrationStatus on schools documents
    - Set migrationStatus: migrated upon successful backfill
    - _Requirements: 19_
  
  - [x] 28.5 Implement idempotency checks
    - Check if entity already exists before creating
    - Check if workspace_entities already exists before creating
    - Running script multiple times produces same result
    - _Requirements: 19_
  
  - [x] 28.6 Implement error handling and logging
    - Log errors for specific records without aborting entire run
    - Generate summary report: total, succeeded, failed, skipped
    - _Requirements: 19_
  
  - [x] 28.7 Write property test for migration idempotency
    - **Property 7: Migration Idempotency**
    - **Validates: Requirements 19**
    - Run migration twice on same record
    - Assert produces same entities and workspace_entities without duplicates

- [x] 29. Checkpoint - Migration script runs successfully
  - Test migration on sample schools data
  - Verify entities and workspace_entities created correctly
  - Verify idempotency: running twice produces same result
  - Verify error handling for malformed records
  - Ensure all tests pass, ask the user if questions arise

- [x] 30. Implement performance optimizations and denormalization
  - [x] 30.1 Add denormalized fields to workspace_entities
    - Add displayName, primaryEmail, primaryPhone, currentStageName
    - _Requirements: 22_
  
  - [x] 30.2 Implement denormalization sync on entity updates
    - Update all workspace_entities when entity name/contacts change
    - Process in batches of 500
    - _Requirements: 22_
  
  - [x] 30.3 Add Firestore composite indexes
    - Create indexes for (workspaceId, status), (workspaceId, stageId), (workspaceId, assignedTo)
    - Create indexes for (workspaceId, workspaceTags array-contains)
    - _Requirements: 22_
  
  - [x] 30.4 Optimize workspace list queries
    - Query workspace_entities first (single fetch)
    - Hydrate entity data in second fetch only if needed
    - Ensure max 2 Firestore reads per list page
    - _Requirements: 22_
  
  - [x] 30.5 Write property test for denormalization consistency
    - **Property 5: Denormalization Consistency Invariant** (duplicate check)
    - **Validates: Requirements 22**
    - Update entity fields and verify workspace_entities sync

- [x] 31. Checkpoint - Performance meets requirements
  - Test workspace list page loads with max 2 Firestore reads
  - Verify denormalization sync works on entity updates
  - Verify composite indexes are deployed
  - Ensure all tests pass, ask the user if questions arise

- [x] 32. Implement reporting and metrics
  - [x] 32.1 Create distinct metrics dashboard
    - Display total unique entities by type
    - Display total workspace-entity memberships by workspace
    - Display entities active in pipeline by workspace
    - Display unique entities shared across 2+ workspaces
    - _Requirements: 21_
  
  - [x] 32.2 Implement workspace-scoped reports
    - Count workspace_entities records for workspace reports
    - Do not conflate unique entities with workspace memberships
    - _Requirements: 21_
  
  - [x] 32.3 Add filtering by entityType and workspaceId
    - Support independent filtering by entityType and workspaceId
    - _Requirements: 21_
  
  - [x] 32.4 Create shared contacts report
    - Show entities appearing in multiple workspaces
    - Display per-workspace stage and assignee for each
    - _Requirements: 21_

- [x] 33. Checkpoint - Reporting is accurate
  - Test metrics dashboard shows correct counts
  - Verify workspace reports count workspace_entities not entities
  - Verify shared contacts report shows per-workspace state
  - Ensure all tests pass, ask the user if questions arise

- [x] 34. Update Firestore security rules
  - [x] 34.1 Add security rules for entities collection
    - Allow read if user has workspace access to any workspace the entity belongs to
    - Allow create if user has schools_edit permission
    - Allow update if user has schools_edit permission
    - Allow delete if user has system_admin permission
    - _Requirements: 9_
  
  - [x] 34.2 Add security rules for workspace_entities collection
    - Allow read if user has access to the specific workspaceId
    - Allow create if user has schools_edit permission and workspace access
    - Allow update if user has schools_edit permission and workspace access
    - Allow delete if user has schools_edit permission and workspace access
    - Enforce ScopeGuard in security rules
    - _Requirements: 9_
  
  - [x] 34.3 Implement workspace-scoped permission checks
    - Evaluate permissions at organization, workspace, workspace-entity, and feature levels
    - _Requirements: 9_
  
  - [x] 34.4 Update security rules for workspace access revocation
    - Immediately deny reads/writes to workspace_entities when user workspace access revoked
    - _Requirements: 9_
  
  - [x] 34.5 Write property test for workspace query isolation
    - **Property 8: Workspace Query Isolation**
    - **Validates: Requirements 9**
    - Populate two workspaces with disjoint entity sets
    - Assert querying one workspace never returns entities from the other

- [x] 35. Checkpoint - Security rules enforce workspace boundaries
  - Test user can only read workspace_entities for their workspaces
  - Test ScopeGuard enforced in security rules
  - Test workspace access revocation immediately denies access
  - Ensure all tests pass, ask the user if questions arise

- [x] 36. Update PDF forms, surveys, and meetings integration
  - [x] 36.1 Add entityId field to PDFForm documents
    - Support both schoolId (legacy) and entityId (new)
    - Adapter layer populates both during migration
    - _Requirements: 26_
  
  - [x] 36.2 Add entityId field to Survey documents
    - Support both schoolId (legacy) and entityId (new)
    - _Requirements: 26_
  
  - [x] 36.3 Update Meeting documents to use entity slug
    - Continue using schoolSlug for public URL routing
    - Resolve schoolSlug from entity.slug field via adapter
    - _Requirements: 26_
  
  - [x] 36.4 Generate slug for institution entities
    - Use same slug generation logic as schools collection
    - Ensure slug uniqueness within organization
    - _Requirements: 26_
  
  - [x] 36.5 Maintain existing public routes
    - Keep /meetings/parent-engagement/[schoolSlug] unchanged
    - Ensure no breaking changes to public-facing pages
    - _Requirements: 26_

- [x] 37. Checkpoint - PDF/Survey/Meeting integration works
  - Test PDF form submission with entityId
  - Test survey submission with entityId
  - Test meeting page loads with schoolSlug
  - Verify public routes unchanged
  - Ensure all tests pass, ask the user if questions arise

- [x] 38. Add explicit UI language for scope rules
  - [x] 38.1 Update workspace settings page copy
    - Display "This workspace manages [scope label]. Only [scope label] records can exist here."
    - _Requirements: 25_
  
  - [x] 38.2 Update workspace creation wizard copy
    - Display "Scope cannot be changed after the first contact is added."
    - _Requirements: 25_
  
  - [x] 38.3 Add clear error messages for scope violations
    - Display human-readable error when scope mismatch occurs
    - Example: "Family records cannot be added to a workspace that manages Schools."
    - _Requirements: 25_
  
  - [x] 38.4 Add scope type badge to workspace switcher
    - Display "Schools", "Families", or "People" badge next to workspace name
    - _Requirements: 25_
  
  - [x] 38.5 Add entity type badge to contact detail page
    - Display entity type badge prominently
    - _Requirements: 25_
  
  - [x] 38.6 Add scope lock indicator to workspace settings
    - Display lock icon on scope field when locked
    - Add tooltip: "Scope is locked because this workspace has active contacts."
    - _Requirements: 25_

- [x] 39. Checkpoint - UI language is explicit and clear
  - Test workspace settings displays scope rules clearly
  - Test error messages are human-readable
  - Test scope badges appear in all relevant locations
  - Ensure all tests pass, ask the user if questions arise

- [x] 40. Plan for future cross-entity relationships
  - [x] 40.1 Reserve entity_relationships collection name
    - Document planned collection shape in architecture notes
    - Shape: { id, organizationId, fromEntityId, toEntityId, relationshipType, createdAt }
    - _Requirements: 24_
  
  - [x] 40.2 Add relatedEntityIds field to Entity interface
    - Add optional relatedEntityIds array (empty by default)
    - Supports future relationship mapping without schema migration
    - _Requirements: 24_
  
  - [x] 40.3 Document cross-entity relationship strategy
    - Allow same real-world person as FocalPerson and standalone person entity
    - Treat as separate records until relationship mapping implemented
    - _Requirements: 24_

- [-] 41. Final integration testing
  - [x] 41.1 Run all property-based tests
    - Property 1: ScopeGuard Invariant
    - Property 2: Pipeline State Isolation
    - Property 3: Scope Immutability After Activation
    - Property 4: Tag Partition Invariant
    - Property 5: Denormalization Consistency
    - Property 6: Import Round-Trip
    - Property 7: Migration Idempotency
    - Property 8: Workspace Query Isolation
  
  - [x] 41.2 Test all existing features with adapter layer
    - Test activity logging
    - Test task management
    - Test messaging
    - Test automations
    - Test PDF forms
    - Test surveys
    - Test meetings
  
  - [x] 41.3 Test new entity creation for all three scopes
    - Create institution entity in institution workspace
    - Create family entity in family workspace
    - Create person entity in person workspace
  
  - [x] 41.4 Test workspace switching
    - Switch between workspaces with different scopes
    - Verify UI adapts correctly
    - Verify data isolation
  
  - [x] 41.5 Test migration script on production-like data
    - Run migration on copy of production schools data
    - Verify all records migrated correctly
    - Verify idempotency
    - Verify no data loss

- [x] 42. Final checkpoint - System ready for deployment
  - All property tests pass
  - All existing features work with adapter layer
  - All new entity types can be created and managed
  - Migration script tested on production-like data
  - Security rules enforce workspace boundaries
  - UI displays scope rules clearly
  - Ensure all tests pass, ask the user if questions arise

- [x] 43. Documentation and deployment preparation
  - [x] 43.1 Write user documentation
    - Document workspace scope concept
    - Document entity types: institution, family, person
    - Document workspace capabilities
    - Document import/export for each scope
    - _Requirements: All_
  
  - [x] 43.2 Write developer documentation
    - Document entities and workspace_entities data model
    - Document adapter layer usage
    - Document ScopeGuard validation
    - Document migration script
    - Document property-based tests
    - _Requirements: All_
  
  - [x] 43.3 Create deployment checklist
    - Verify all Firestore indexes deployed
    - Verify security rules updated
    - Test in staging environment
    - Create rollback plan
    - Schedule migration window
    - _Requirements: All_
  
  - [x] 43.4 Create migration runbook
    - Document pre-migration checks
    - Document migration execution steps
    - Document post-migration verification
    - Document rollback procedure
    - _Requirements: 19_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties from requirements
- All code should follow existing SmartSapp TypeScript conventions
- Backward compatibility is critical: existing features must continue working
- Migration is opt-in: workspaces can remain on legacy schools model
- Security rules must enforce workspace boundaries at database level
- UI must make scope rules explicit to prevent user confusion
- Performance optimizations use denormalization to minimize Firestore reads

## Implementation Order

The tasks are ordered to enable incremental development and testing:
1. Data models and infrastructure (tasks 1-3)
2. Core entity operations with ScopeGuard (tasks 4-8)
3. Workspace scope management (tasks 9-11)
4. Tag system refactor (tasks 12-13)
5. Pipeline/stage migration (tasks 14-15)
6. Adapter layer for backward compatibility (tasks 16-17)
7. Scope-specific UI (tasks 18-19)
8. Automation integration (task 20)
9. Messaging integration (task 21-22)
10. Activity and task integration (tasks 23-25)
11. Import/export (tasks 26-27)
12. Migration script (tasks 28-29)
13. Performance optimization (tasks 30-31)
14. Reporting (tasks 32-33)
15. Security rules (tasks 34-35)
16. PDF/Survey/Meeting integration (tasks 36-37)
17. UI polish (tasks 38-39)
18. Future planning (task 40)
19. Final testing (tasks 41-42)
20. Documentation and deployment (task 43)

Each phase builds on the previous one, allowing for testing and validation at each checkpoint.

## Risk Mitigation

This plan addresses all 15 risks identified in what-could-go-wrong.md:

1. **Risk 1 (Soft scope rule)**: ScopeGuard enforced at all write paths + security rules
2. **Risk 2 (Workspace behavior conflicts)**: Pipeline state moved to workspace_entities
3. **Risk 3 (Destructive scope changes)**: Scope immutability after activation
4. **Risk 4 (Conflicting truth)**: Clear separation of entity identity vs workspace state
5. **Risk 5 (Tag ambiguity)**: Split into globalTags and workspaceTags
6. **Risk 6 (Misleading search)**: Query workspace_entities first, then hydrate
7. **Risk 7 (Permission leakage)**: Workspace-scoped security rules
8. **Risk 8 (Automation danger)**: WorkspaceId in all automation events
9. **Risk 9 (Messaging confusion)**: WorkspaceId in all message logs
10. **Risk 10 (Reporting confusion)**: Distinct metrics for entities vs memberships
11. **Risk 11 (Firestore complexity)**: Intentional denormalization on workspace_entities
12. **Risk 12 (Logic overload)**: Capabilities separate from scope
13. **Risk 13 (Cross-scope relationships)**: Reserved entity_relationships collection
14. **Risk 14 (Import errors)**: Scope-specific import schemas with validation
15. **Risk 15 (UI hiding rules)**: Explicit UI language for all scope constraints

## Success Criteria

The implementation is complete when:
- All 27 requirements are implemented
- All 8 property-based tests pass
- All existing features work via adapter layer
- Migration script successfully processes production data
- Security rules enforce workspace boundaries
- UI clearly communicates scope rules
- Documentation is complete
- Deployment checklist is verified

