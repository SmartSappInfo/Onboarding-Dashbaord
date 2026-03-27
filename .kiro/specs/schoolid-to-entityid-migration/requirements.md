# Requirements Document: SchoolId to EntityId Migration

## Introduction

This document specifies the requirements for migrating the SmartSapp application from using `schoolId` as the primary contact identifier to using `entityId` across all features. The core entity system has already been migrated, but many features still reference the legacy `schoolId` field. This migration will complete the transition to the unified entity architecture while maintaining backward compatibility during the transition period.

## Glossary

- **Entity**: A unified contact record (institution, family, or person) in the `entities` collection
- **Workspace_Entity**: A workspace-specific operational state record linking an entity to a workspace
- **Legacy_School**: A school record in the `schools` collection that has not been migrated (`migrationStatus !== 'migrated'`)
- **Migrated_School**: A school record that has been migrated to the entity architecture (`migrationStatus === 'migrated'`)
- **Contact_Adapter**: A compatibility layer that resolves contact data from either legacy schools or entities+workspace_entities
- **Dual_Write**: Writing data to both legacy (schoolId) and new (entityId) fields during migration
- **Migration_Tool**: A UI component on the seeds page that performs fetch-enrich-restore operations
- **Feature_Module**: A distinct functional area of the application (tasks, activities, pipelines, etc.)
- **Firestore**: The Firebase Firestore database
- **Seeds_Page**: The administrative page at `/seeds` used for data migration operations

## Requirements

### Requirement 1: Feature Audit and Identification

**User Story:** As a developer, I want to identify all features still using schoolId, so that I can plan the complete migration scope.

#### Acceptance Criteria

1. THE System SHALL identify all TypeScript files containing references to `schoolId`
2. THE System SHALL categorize identified features into functional modules (tasks, activities, pipelines, dashboard, forms, invoices, meetings, signups, profiles, settings, surveys)
3. THE System SHALL document the current usage pattern for each feature (data models, operations, UI components, API endpoints)
4. THE System SHALL create a feature inventory document listing all affected modules with their current schoolId usage
5. THE System SHALL prioritize features based on usage frequency and migration complexity

### Requirement 2: Data Model Migration

**User Story:** As a developer, I want to update all data models to use entityId, so that the application uses the unified entity architecture.

#### Acceptance Criteria

1. WHEN a data model contains a `schoolId` field, THE System SHALL add an `entityId` field alongside it
2. WHEN a data model contains a `schoolId` field, THE System SHALL add an `entityType` field to specify the entity type
3. THE System SHALL maintain the `schoolId` field for backward compatibility during the migration period
4. THE System SHALL update TypeScript type definitions to include both `schoolId` (optional) and `entityId` (optional) fields
5. THE System SHALL ensure all new records include both `schoolId` and `entityId` (dual-write pattern)
6. FOR ALL data models with schoolId, THE System SHALL document the migration path from schoolId-only to dual-write to entityId-only

### Requirement 3: Task Module Migration

**User Story:** As a user, I want tasks to work with entityId, so that tasks are properly associated with entities across workspaces.

#### Acceptance Criteria

1. WHEN a task is created, THE System SHALL populate both `schoolId` (if available) and `entityId` fields
2. WHEN a task is edited, THE System SHALL preserve both `schoolId` and `entityId` fields
3. WHEN a task is deleted, THE System SHALL use `entityId` as the primary identifier
4. WHEN tasks are filtered by contact, THE System SHALL support filtering by either `schoolId` or `entityId`
5. WHEN tasks are queried, THE System SHALL use `entityId` in the query if available, falling back to `schoolId`
6. THE Task_UI SHALL display entity information resolved via the Contact_Adapter
7. THE Task_Creation_Form SHALL accept entityId as the primary contact identifier

### Requirement 4: Activity Module Migration

**User Story:** As a user, I want activities to work with entityId, so that activity history is properly tracked for entities.

#### Acceptance Criteria

1. WHEN an activity is logged, THE System SHALL populate both `schoolId` (if available) and `entityId` fields
2. WHEN activities are queried for a contact, THE System SHALL support querying by either `schoolId` or `entityId`
3. THE Activity_Timeline SHALL display activities using entity information from the Contact_Adapter
4. WHEN an activity references a contact, THE System SHALL include `entityType` to identify the contact type
5. THE Activity_Log SHALL support filtering by `entityId` with backward compatibility for `schoolId`

### Requirement 5: Pipeline Module Migration

**User Story:** As a user, I want pipelines to work with entityId, so that contacts move through stages correctly in the unified architecture.

#### Acceptance Criteria

1. WHEN a contact is assigned to a pipeline stage, THE System SHALL use `entityId` as the primary identifier
2. WHEN a contact moves between stages, THE System SHALL update the `workspace_entities` record using `entityId`
3. THE Pipeline_View SHALL display contacts using entity information from the Contact_Adapter
4. WHEN pipeline data is queried, THE System SHALL use `workspace_entities` collection with `entityId` references
5. THE System SHALL maintain backward compatibility for legacy schools still using `schoolId` in pipelines

### Requirement 6: Dashboard Module Migration

**User Story:** As a user, I want the dashboard to display entity data, so that I see accurate contact information across all workspaces.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE System SHALL query contacts using `entityId` from `workspace_entities`
2. THE Dashboard SHALL display contact counts using `workspace_entities` collection
3. THE Dashboard SHALL display recent activities using `entityId` references
4. THE Dashboard SHALL display tasks using `entityId` references
5. WHEN dashboard widgets filter by contact, THE System SHALL support filtering by `entityId`

### Requirement 7: Forms Module Migration

**User Story:** As a user, I want forms to work with entityId, so that form submissions are properly associated with entities.

#### Acceptance Criteria

1. WHEN a form is created, THE System SHALL associate it with `entityId` instead of `schoolId`
2. WHEN a form submission is saved, THE System SHALL populate both `schoolId` (if available) and `entityId` fields
3. THE Form_Builder SHALL accept `entityId` as the contact identifier
4. THE Form_Submission_View SHALL display entity information using the Contact_Adapter
5. WHEN forms are queried by contact, THE System SHALL support querying by either `schoolId` or `entityId`

### Requirement 8: Invoice Module Migration

**User Story:** As a user, I want invoices to work with entityId, so that billing is properly tracked for entities.

#### Acceptance Criteria

1. WHEN an invoice is created, THE System SHALL associate it with `entityId` instead of `schoolId`
2. WHEN an invoice is edited, THE System SHALL preserve the `entityId` field
3. THE Invoice_List SHALL display invoices using entity information from the Contact_Adapter
4. WHEN invoices are queried by contact, THE System SHALL support querying by either `schoolId` or `entityId`
5. THE Invoice_PDF SHALL include entity information resolved via `entityId`

### Requirement 9: Meeting Module Migration

**User Story:** As a user, I want meetings to work with entityId, so that meetings are properly associated with entities.

#### Acceptance Criteria

1. WHEN a meeting is created, THE System SHALL associate it with `entityId` instead of `schoolSlug`
2. WHEN a meeting is edited, THE System SHALL preserve the `entityId` field
3. THE Meeting_Calendar SHALL display meetings using entity information from the Contact_Adapter
4. WHEN meetings are queried by contact, THE System SHALL support querying by either `schoolSlug` or `entityId`
5. THE Public_Meeting_Page SHALL resolve entity information using `entityId` or `schoolSlug`

### Requirement 10: Signup Module Migration

**User Story:** As a user, I want new signups to use entityId, so that new contacts are created in the unified entity architecture.

#### Acceptance Criteria

1. WHEN a new contact signs up, THE System SHALL create an entity record with `entityId`
2. WHEN a new contact signs up, THE System SHALL create a workspace_entity record linking the entity to the workspace
3. THE Signup_Form SHALL not create legacy school records for new signups
4. THE System SHALL assign a unique `entityId` using the format `entity_<random_id>`
5. WHEN a signup is completed, THE System SHALL log an activity with the `entityId` reference

### Requirement 11: Profile Module Migration

**User Story:** As a user, I want contact profiles to display entity data, so that I see accurate and complete contact information.

#### Acceptance Criteria

1. WHEN a contact profile is loaded, THE System SHALL resolve entity data using `entityId` via the Contact_Adapter
2. THE Profile_Page SHALL display entity information from the `entities` collection
3. THE Profile_Page SHALL display workspace-specific information from the `workspace_entities` collection
4. WHEN a profile is edited, THE System SHALL update the `entities` record using `entityId`
5. WHEN workspace-specific fields are edited, THE System SHALL update the `workspace_entities` record

### Requirement 12: Settings Module Migration

**User Story:** As a user, I want settings to work with entityId, so that entity-specific settings are properly managed.

#### Acceptance Criteria

1. WHEN entity settings are loaded, THE System SHALL query using `entityId`
2. WHEN entity settings are updated, THE System SHALL update using `entityId`
3. THE Settings_Page SHALL display entity information using the Contact_Adapter
4. THE System SHALL maintain backward compatibility for legacy school settings using `schoolId`

### Requirement 13: Survey Module Migration

**User Story:** As a user, I want surveys to work with entityId, so that survey responses are properly associated with entities.

#### Acceptance Criteria

1. WHEN a survey is created, THE System SHALL associate it with `entityId` instead of `schoolId`
2. WHEN a survey response is submitted, THE System SHALL populate both `schoolId` (if available) and `entityId` fields
3. THE Survey_Builder SHALL accept `entityId` as the contact identifier
4. THE Survey_Results_View SHALL display entity information using the Contact_Adapter
5. WHEN surveys are queried by contact, THE System SHALL support querying by either `schoolId` or `entityId`

### Requirement 14: Automation Module Migration

**User Story:** As a user, I want automations to work with entityId, so that automated actions are properly triggered for entities.

#### Acceptance Criteria

1. WHEN an automation is triggered, THE System SHALL use `entityId` as the primary contact identifier
2. WHEN an automation creates a task, THE System SHALL populate both `schoolId` (if available) and `entityId` fields
3. WHEN an automation sends a message, THE System SHALL resolve contact information using `entityId`
4. WHEN an automation updates a contact, THE System SHALL update the `entities` record using `entityId`
5. THE Automation_Engine SHALL support both legacy `schoolId` and new `entityId` triggers during the migration period

### Requirement 15: Messaging Module Migration

**User Story:** As a user, I want messaging to work with entityId, so that messages are properly associated with entities.

#### Acceptance Criteria

1. WHEN a message is sent, THE System SHALL associate it with `entityId` instead of `schoolId`
2. WHEN message logs are created, THE System SHALL populate both `schoolId` (if available) and `entityId` fields
3. THE Message_Composer SHALL accept `entityId` as the recipient identifier
4. THE Message_History SHALL display messages using entity information from the Contact_Adapter
5. WHEN messages are queried by contact, THE System SHALL support querying by either `schoolId` or `entityId`

### Requirement 16: PDF Module Migration

**User Story:** As a user, I want PDF forms to work with entityId, so that generated PDFs are properly associated with entities.

#### Acceptance Criteria

1. WHEN a PDF form is created, THE System SHALL associate it with `entityId` instead of `schoolId`
2. WHEN a PDF is generated, THE System SHALL resolve entity information using `entityId` via the Contact_Adapter
3. THE PDF_Template SHALL support entity variables using `entityId`
4. WHEN PDF records are queried by contact, THE System SHALL support querying by either `schoolId` or `entityId`
5. THE System SHALL populate both `schoolId` (if available) and `entityId` fields in PDF records

### Requirement 17: Migration Tooling - Seeds Page UI

**User Story:** As an administrator, I want migration tools on the seeds page, so that I can migrate feature data from schoolId to entityId.

#### Acceptance Criteria

1. THE Seeds_Page SHALL display a "Feature Data Migration" section
2. FOR ALL Feature_Modules identified in Requirement 1, THE Seeds_Page SHALL display a migration card
3. WHEN a migration card is displayed, THE System SHALL show the feature name, current migration status, and record counts
4. THE Migration_Card SHALL display three action buttons: "Fetch", "Enrich & Restore", and "Verify"
5. THE Migration_Card SHALL display migration progress (percentage, records processed, errors)
6. THE Seeds_Page SHALL display a "Migrate All Features" button to run all migrations sequentially
7. THE Seeds_Page SHALL display a migration log showing real-time progress and errors

### Requirement 18: Migration Tooling - Fetch Operation

**User Story:** As an administrator, I want to fetch existing feature data, so that I can preview what will be migrated.

#### Acceptance Criteria

1. WHEN the "Fetch" button is clicked, THE System SHALL query all records in the feature collection that have `schoolId` but no `entityId`
2. THE System SHALL display the count of records to be migrated
3. THE System SHALL display a sample of records (first 5) with their current `schoolId` values
4. THE System SHALL identify any records with invalid or missing `schoolId` values
5. THE Fetch_Operation SHALL complete within 30 seconds for collections with up to 10,000 records

### Requirement 19: Migration Tooling - Enrich & Restore Operation

**User Story:** As an administrator, I want to enrich and restore feature data, so that records are updated with entityId references.

#### Acceptance Criteria

1. WHEN the "Enrich & Restore" button is clicked, THE System SHALL fetch all records with `schoolId` but no `entityId`
2. FOR ALL fetched records, THE System SHALL resolve the `entityId` by querying the `schools` collection for the corresponding `entityId` field
3. IF a school has `migrationStatus === 'migrated'`, THE System SHALL use the `entityId` from the school record
4. IF a school does not have an `entityId`, THE System SHALL generate one using the format `entity_<schoolId>`
5. THE System SHALL create a backup of each record in a `backup_<feature>_entity_migration` collection before updating
6. THE System SHALL update each record with `entityId` and `entityType` fields while preserving the `schoolId` field
7. THE System SHALL process records in batches of 450 to avoid Firestore limits
8. THE System SHALL display real-time progress (percentage, records processed, errors)
9. IF an error occurs for a record, THE System SHALL log the error and continue processing remaining records
10. THE Enrich_Restore_Operation SHALL be idempotent (can be run multiple times safely)
11. WHEN the operation completes, THE System SHALL display a summary (total, succeeded, failed, skipped)

### Requirement 20: Migration Tooling - Verify Operation

**User Story:** As an administrator, I want to verify migration results, so that I can confirm data integrity after migration.

#### Acceptance Criteria

1. WHEN the "Verify" button is clicked, THE System SHALL count records with `entityId` in the feature collection
2. THE System SHALL count records with `schoolId` but no `entityId` (unmigrated)
3. THE System SHALL verify that all migrated records have valid `entityId` values
4. THE System SHALL verify that all migrated records have valid `entityType` values
5. THE System SHALL check for orphaned records (entityId that doesn't exist in entities collection)
6. THE System SHALL display verification results (migrated count, unmigrated count, orphaned count, validation errors)
7. THE System SHALL highlight any data integrity issues found during verification

### Requirement 21: Migration Tooling - Rollback Capability

**User Story:** As an administrator, I want to rollback a failed migration, so that I can restore data to its pre-migration state.

#### Acceptance Criteria

1. THE Migration_Card SHALL display a "Rollback" button when a backup collection exists
2. WHEN the "Rollback" button is clicked, THE System SHALL restore all records from the `backup_<feature>_entity_migration` collection
3. THE System SHALL remove the `entityId` and `entityType` fields added during migration
4. THE System SHALL delete the backup collection after successful rollback
5. THE System SHALL display rollback progress and results
6. THE Rollback_Operation SHALL be idempotent (can be run multiple times safely)

### Requirement 22: Query and Filter Migration

**User Story:** As a developer, I want all queries to support entityId, so that features can filter and search by entity.

#### Acceptance Criteria

1. WHEN a feature queries by contact, THE System SHALL support querying by `entityId` as the primary method
2. WHEN a feature queries by contact, THE System SHALL support querying by `schoolId` as a fallback for backward compatibility
3. THE System SHALL create Firestore indexes for `entityId` fields in all feature collections
4. WHEN a query uses `entityId`, THE System SHALL use the `workspace_entities` collection for workspace-scoped queries
5. THE System SHALL update all existing query functions to accept either `schoolId` or `entityId` parameters

### Requirement 23: UI Component Migration

**User Story:** As a developer, I want all UI components to display entity data, so that users see consistent contact information.

#### Acceptance Criteria

1. WHEN a UI component displays contact information, THE System SHALL resolve entity data using the Contact_Adapter
2. THE System SHALL update all contact selection dropdowns to use `entityId` as the value
3. THE System SHALL update all contact display components to show entity information from `entities` and `workspace_entities`
4. WHEN a contact is selected in a form, THE System SHALL populate the `entityId` field
5. THE System SHALL maintain backward compatibility for components that still receive `schoolId` props

### Requirement 24: API Endpoint Migration

**User Story:** As a developer, I want all API endpoints to support entityId, so that external integrations work with the unified entity architecture.

#### Acceptance Criteria

1. WHEN an API endpoint receives a contact identifier, THE System SHALL accept either `schoolId` or `entityId`
2. WHEN an API endpoint returns contact data, THE System SHALL include both `schoolId` (if available) and `entityId` fields
3. THE System SHALL update API documentation to reflect the new `entityId` parameter
4. THE System SHALL deprecate `schoolId` parameters in API endpoints with a migration timeline
5. WHEN an API endpoint creates a new contact, THE System SHALL generate an `entityId` and create entity records

### Requirement 25: Server Action Migration

**User Story:** As a developer, I want all server actions to support entityId, so that server-side operations work with the unified entity architecture.

#### Acceptance Criteria

1. WHEN a server action receives a contact identifier, THE System SHALL accept either `schoolId` or `entityId`
2. WHEN a server action performs a database operation, THE System SHALL use `entityId` as the primary identifier
3. THE System SHALL update all server actions to populate both `schoolId` (if available) and `entityId` fields (dual-write)
4. WHEN a server action resolves contact information, THE System SHALL use the Contact_Adapter
5. THE System SHALL maintain backward compatibility for server actions that still receive `schoolId` parameters

### Requirement 26: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for the migration, so that I can verify functionality after migration.

#### Acceptance Criteria

1. THE System SHALL include unit tests for each migration function (fetch, enrich, restore, verify, rollback)
2. THE System SHALL include integration tests for each Feature_Module after migration
3. THE System SHALL include property-based tests for data integrity (round-trip: schoolId → entityId → schoolId)
4. THE System SHALL include tests for the Contact_Adapter with both legacy and migrated records
5. THE System SHALL include tests for dual-write functionality (both schoolId and entityId populated)
6. THE System SHALL include tests for query functions with both schoolId and entityId parameters
7. THE System SHALL include end-to-end tests for critical user flows (create task, log activity, send message)

### Requirement 27: Documentation and Training

**User Story:** As a team member, I want documentation for the migration, so that I understand the new entity architecture.

#### Acceptance Criteria

1. THE System SHALL include a migration runbook with step-by-step instructions
2. THE System SHALL include architecture documentation explaining the entity model
3. THE System SHALL include API documentation with entityId examples
4. THE System SHALL include a developer guide for working with entities
5. THE System SHALL include a troubleshooting guide for common migration issues

### Requirement 28: Performance Optimization

**User Story:** As a user, I want the application to perform well after migration, so that I don't experience slowdowns.

#### Acceptance Criteria

1. WHEN querying by entityId, THE System SHALL use Firestore indexes to ensure query performance < 1000ms
2. THE System SHALL use denormalized fields in `workspace_entities` to avoid additional lookups
3. WHEN the Contact_Adapter resolves entity data, THE System SHALL cache results for 5 minutes
4. THE System SHALL batch database operations during migration to minimize Firestore costs
5. THE System SHALL monitor query performance and alert if queries exceed 2000ms

### Requirement 29: Security and Permissions

**User Story:** As a user, I want entity data to be secure, so that I can only access entities in my authorized workspaces.

#### Acceptance Criteria

1. WHEN a user queries entities, THE System SHALL enforce workspace boundaries using security rules
2. THE System SHALL verify that users can only access `workspace_entities` for workspaces they have access to
3. THE System SHALL verify that entity updates are authorized based on user permissions
4. THE System SHALL audit all entity data access and modifications
5. THE System SHALL prevent cross-workspace data leakage through entityId references

### Requirement 30: Monitoring and Observability

**User Story:** As an administrator, I want to monitor the migration, so that I can track progress and identify issues.

#### Acceptance Criteria

1. THE System SHALL log all migration operations (fetch, enrich, restore, verify, rollback)
2. THE System SHALL track migration metrics (records processed, success rate, error rate, duration)
3. THE System SHALL send alerts when migration errors exceed 5% of records
4. THE System SHALL display a migration dashboard showing status for all Feature_Modules
5. THE System SHALL retain migration logs for 90 days for audit purposes

