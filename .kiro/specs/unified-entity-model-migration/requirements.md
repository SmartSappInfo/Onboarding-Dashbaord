# Requirements Document

## Introduction

The Unified Entity Model Migration feature represents a comprehensive architectural transformation of SmartSapp's contact management system. The application currently uses a legacy `schools` collection that has already been partially migrated to a new `entities` + `workspace_entities` architecture. This feature will complete the migration by decommissioning the `schools` collection entirely and updating ALL product features to use the unified entity model that supports multiple entity types (Institutions, Families, Persons) through a single, scalable architecture.

The migration addresses critical data consistency gaps where new schools are created in the legacy collection but messaging features read from the new model, causing newly created contacts to be invisible to certain features. This comprehensive migration will ensure zero data loss, maintain backward compatibility during transition, and provide a 7-day rollback capability through the Fetch-Enrich-Restore (FER) protocol.

## Glossary

- **Entity**: A unified contact identity representing an Institution, Family, or Person across all workspaces
- **Workspace_Entity**: The operational relationship between an Entity and a specific Workspace, storing pipeline state and workspace-specific data
- **Legacy_Model**: The original `schools` collection-based architecture
- **Unified_Model**: The new `entities` + `workspace_entities` architecture supporting multiple entity types
- **FER_Protocol**: Fetch-Enrich-Restore protocol for safe data migration with rollback capability
- **Migration_Status**: A field tracking migration progress with values: "legacy", "migrated", "dual-write"
- **Contact_Adapter**: A compatibility layer providing unified access to both legacy and new data models
- **Foreign_Key**: A reference field linking related documents (e.g., schoolId → entityId)
- **Dual_Write**: A transitional pattern where data is written to both legacy and new models simultaneously
- **Backup_Collection**: A temporary collection storing original data for rollback purposes with 7-day retention
- **Contact_Scope**: A workspace setting defining the entity type managed (institution, family, person)
- **Global_Tags**: Identity-level tags stored in entities collection, visible across all workspaces
- **Workspace_Tags**: Operational tags stored in workspace_entities collection, scoped to one workspace
- **Organization**: The top-level tenant for multi-tenant data isolation
- **Workspace**: An operational partition within an organization (e.g., "Admissions", "Billing")
- **Pipeline**: A customizable workflow with multiple stages for tracking entity lifecycle
- **Stage**: A step within a pipeline representing entity status or progress
- **Firestore_Index**: A database index required for efficient querying of Firestore collections

## Requirements

### Requirement 1: Complete Legacy Schools Collection Decommissioning

**User Story:** As a system administrator, I want to completely decommission the legacy schools collection, so that the system uses a single unified entity model and eliminates data consistency issues.

#### Acceptance Criteria

1. THE Migration_Engine SHALL migrate all remaining legacy schools to the Unified_Model using the FER_Protocol
2. WHEN all schools are migrated, THE System SHALL mark the schools collection as deprecated
3. THE System SHALL maintain backup collections for 7 days after migration completion
4. WHEN the retention period expires, THE System SHALL archive backup collections to cold storage
5. THE System SHALL provide rollback capability within the 7-day retention window

### Requirement 2: Unified Entity Model Architecture Implementation

**User Story:** As a developer, I want a unified entity model that supports multiple entity types, so that the system can manage Institutions, Families, and Persons through a single architecture.

#### Acceptance Criteria

1. THE Entity_Schema SHALL support three entity types: "institution", "family", "person"
2. WHEN an entity is created, THE System SHALL assign an ID using the format "entity_{uuid}"
3. THE Entity_Schema SHALL store global identity data in the entities collection
4. THE Workspace_Entity_Schema SHALL store workspace-specific operational state
5. THE System SHALL enforce entity type immutability after creation
6. THE System SHALL validate entity type-specific data based on the entityType field

### Requirement 3: Workspace-Aware UI Dynamic Adaptation

**User Story:** As a user, I want the UI to dynamically adapt based on my workspace's contact scope, so that I see relevant labels and options for the entity types I manage.

#### Acceptance Criteria

1. WHEN a workspace has contactScope set to "institution", THE UI SHALL display "Schools" or "Institutions" labels
2. WHEN a workspace has contactScope set to "family", THE UI SHALL display "Families" labels
3. WHEN a workspace has contactScope set to "person", THE UI SHALL display "Contacts" or "Persons" labels
4. THE System SHALL update navigation labels dynamically based on workspace context
5. THE System SHALL show entity type-specific creation forms based on contactScope
6. WHEN contactScope is undefined, THE System SHALL default to "institution" for backward compatibility

### Requirement 4: Foreign Key Migration Across All Collections

**User Story:** As a data engineer, I want all foreign key references renamed from schoolId to entityId, so that the data model is consistent and supports the unified entity architecture.

#### Acceptance Criteria

1. THE Migration_Engine SHALL rename schoolId to entityId in the tasks collection
2. THE Migration_Engine SHALL rename schoolId to entityId in the invoices collection
3. THE Migration_Engine SHALL rename schoolId to entityId in the contracts collection
4. THE Migration_Engine SHALL rename schoolId to entityId in the activities collection
5. THE Migration_Engine SHALL rename schoolId to entityId in the meetings collection
6. THE Migration_Engine SHALL rename schoolId to entityId in the message_logs collection
7. THE Migration_Engine SHALL rename schoolId to entityId in the pdf_submissions collection
8. THE Migration_Engine SHALL rename schoolId to entityId in the survey_responses collection
9. THE Migration_Engine SHALL rename schoolId to entityId in the automations collection
10. THE Migration_Engine SHALL update tag contact references to use entityId
11. FOR ALL foreign key migrations, THE System SHALL preserve the original schoolId value in a legacy field for rollback

### Requirement 5: Fetch-Enrich-Restore (FER) Protocol Implementation

**User Story:** As a system administrator, I want a safe migration protocol with rollback capability, so that I can recover from migration failures without data loss.

#### Acceptance Criteria

1. WHEN a migration starts, THE Migration_Engine SHALL fetch all documents from the source collection
2. THE Migration_Engine SHALL create backup documents in a backup collection with timestamp
3. THE Migration_Engine SHALL enrich documents with new schema fields and relationships
4. THE Migration_Engine SHALL restore enriched documents to target collections
5. THE Migration_Engine SHALL update source documents with migrationStatus field
6. WHEN a migration fails, THE System SHALL log the error and continue with remaining documents
7. THE System SHALL provide a rollback function that restores from backup collections
8. THE Backup_Collection SHALL retain data for 7 days after successful migration
9. WHEN rollback is executed, THE System SHALL restore original documents and delete new entities

### Requirement 6: Contact Management Module Migration

**User Story:** As a user managing contacts, I want the Schools page to become an Entities page that works with the new model, so that I can manage all entity types through a unified interface.

#### Acceptance Criteria

1. THE System SHALL rename the route from /admin/schools to /admin/entities
2. THE Entities_Page SHALL query the workspace_entities collection instead of schools
3. THE Entities_Page SHALL support filtering by entity type
4. THE Entities_Page SHALL display entity type-specific fields based on entityType
5. WHEN creating a new entity, THE System SHALL write to entities and workspace_entities collections only
6. THE System SHALL remove all direct reads from the schools collection
7. THE Contact_Adapter SHALL be deprecated after migration completion

### Requirement 7: Tasks and Pipeline Management Migration

**User Story:** As a user managing tasks, I want tasks to reference entities instead of schools, so that I can assign tasks to any entity type.

#### Acceptance Criteria

1. THE Task_Schema SHALL use entityId instead of schoolId for entity references
2. THE Task_Query_Functions SHALL query tasks by entityId
3. THE Task_Creation_Form SHALL accept entityId parameter
4. THE Task_List_View SHALL display entity name from entities collection
5. THE System SHALL migrate existing task schoolId references to entityId using FER_Protocol

### Requirement 8: Messaging and Communication Module Migration

**User Story:** As a user sending messages, I want the message composer to work seamlessly with the unified entity model, so that I can message any entity type.

#### Acceptance Criteria

1. THE Message_Composer SHALL query workspace_entities for recipient selection
2. THE Message_Composer SHALL support filtering recipients by entity type
3. THE Message_Log_Schema SHALL use entityId instead of schoolId
4. THE Message_Delivery_System SHALL resolve entity contact information from entities collection
5. THE System SHALL migrate existing message_logs schoolId references to entityId

### Requirement 9: Finance and Billing Module Migration

**User Story:** As a billing manager, I want invoices and contracts to reference entities, so that I can bill any entity type.

#### Acceptance Criteria

1. THE Invoice_Schema SHALL use entityId and entityType instead of schoolId
2. THE Contract_Schema SHALL use entityId and entityType instead of schoolId
3. THE Invoice_Generation_Function SHALL query entity data from entities collection
4. THE Contract_Generation_Function SHALL query entity data from entities collection
5. THE System SHALL migrate existing invoice and contract schoolId references to entityId
6. THE Billing_Reports SHALL aggregate by entityId instead of schoolId

### Requirement 10: Forms and PDF Module Migration

**User Story:** As a user managing forms, I want survey responses and PDF submissions to reference entities, so that I can collect data from any entity type.

#### Acceptance Criteria

1. THE Survey_Response_Schema SHALL use entityId and entityType instead of schoolId
2. THE PDF_Submission_Schema SHALL use entityId and entityType instead of schoolId
3. THE Survey_Builder SHALL support entity type-specific field mapping
4. THE PDF_Form_Builder SHALL support entity type-specific field mapping
5. THE System SHALL migrate existing survey_responses and pdf_submissions schoolId references to entityId

### Requirement 11: Automation Engine Migration

**User Story:** As a user creating automations, I want automation triggers and actions to work with entities, so that I can automate workflows for any entity type.

#### Acceptance Criteria

1. THE Automation_Schema SHALL use entityId instead of schoolId in trigger conditions
2. THE Automation_Engine SHALL resolve entity data from entities and workspace_entities collections
3. THE Automation_Processor SHALL support entity type-specific logic
4. THE System SHALL migrate existing automation schoolId references to entityId
5. THE Automation_Trigger_Evaluator SHALL query workspace_entities for entity state

### Requirement 12: Activity Logging and Audit Trails Migration

**User Story:** As a compliance officer, I want activity logs to reference entities, so that I can track all actions across entity types.

#### Acceptance Criteria

1. THE Activity_Log_Schema SHALL use entityId and entityType instead of schoolId
2. THE Activity_Logger SHALL log entity operations with entity type context
3. THE Activity_Feed SHALL display entity-specific activity icons and labels
4. THE System SHALL migrate existing activity logs schoolId references to entityId
5. THE Audit_Trail_Export SHALL include entity type information

### Requirement 13: Reporting and Analytics Migration

**User Story:** As a manager reviewing reports, I want analytics to aggregate by entity type, so that I can understand performance across different contact types.

#### Acceptance Criteria

1. THE Dashboard_Analytics SHALL query workspace_entities for entity metrics
2. THE Report_Generator SHALL support entity type filtering
3. THE Pipeline_Metrics SHALL aggregate by entity type
4. THE Tag_Analytics SHALL separate global tags from workspace tags
5. THE System SHALL provide entity type distribution reports

### Requirement 14: Import and Export Functionality Migration

**User Story:** As a user importing data, I want the import system to support all entity types, so that I can bulk import institutions, families, and persons.

#### Acceptance Criteria

1. THE Import_Service SHALL support entity type selection during import
2. THE Import_Mapper SHALL map CSV columns to entity type-specific fields
3. THE Import_Validator SHALL validate entity type-specific data
4. THE Export_Service SHALL include entity type in exported data
5. THE System SHALL support importing to entities and workspace_entities collections

### Requirement 15: Tagging System Migration

**User Story:** As a user managing tags, I want tags to work with the two-tier model, so that I can apply global identity tags and workspace-specific operational tags.

#### Acceptance Criteria

1. THE Tag_Application_Function SHALL apply global tags to entities.globalTags
2. THE Tag_Application_Function SHALL apply workspace tags to workspace_entities.workspaceTags
3. THE Tag_Filter_Query SHALL support filtering by global tags across workspaces
4. THE Tag_Filter_Query SHALL support filtering by workspace tags within a workspace
5. THE System SHALL migrate existing tag associations to the appropriate tier

### Requirement 16: Meeting Management Migration

**User Story:** As a user scheduling meetings, I want meetings to reference entities, so that I can schedule meetings with any entity type.

#### Acceptance Criteria

1. THE Meeting_Schema SHALL use entityId and entityType instead of schoolId
2. THE Meeting_Creation_Form SHALL accept entityId parameter
3. THE Meeting_List_View SHALL display entity name and type
4. THE Meeting_Public_Page SHALL resolve entity data from entities collection
5. THE System SHALL migrate existing meeting schoolId references to entityId

### Requirement 17: Document Management Migration

**User Story:** As a user managing documents, I want document associations to reference entities, so that I can attach documents to any entity type.

#### Acceptance Criteria

1. THE Document_Schema SHALL use entityId and entityType for entity associations
2. THE Document_Upload_Function SHALL accept entityId parameter
3. THE Document_List_View SHALL filter by entity type
4. THE System SHALL migrate existing document schoolId references to entityId

### Requirement 18: Firestore Index Creation and Optimization

**User Story:** As a database administrator, I want optimized Firestore indexes for the new entity model, so that queries perform efficiently at scale.

#### Acceptance Criteria

1. THE System SHALL create a composite index on workspace_entities (workspaceId, status, displayName)
2. THE System SHALL create a composite index on workspace_entities (workspaceId, entityType, status)
3. THE System SHALL create a composite index on workspace_entities (workspaceId, pipelineId, stageId)
4. THE System SHALL create a composite index on entities (organizationId, entityType, name)
5. THE System SHALL create a composite index on entities (organizationId, status, createdAt)
6. THE System SHALL document all required indexes in firestore.indexes.json

### Requirement 19: Backward Compatibility During Transition

**User Story:** As a system administrator, I want backward compatibility during the migration period, so that the system continues to function while migration is in progress.

#### Acceptance Criteria

1. THE Contact_Adapter SHALL continue to support dual-read from both legacy and new models
2. WHEN a document has migrationStatus "legacy", THE Contact_Adapter SHALL read from schools collection
3. WHEN a document has migrationStatus "migrated", THE Contact_Adapter SHALL read from entities and workspace_entities
4. THE System SHALL support gradual migration without requiring downtime
5. THE System SHALL maintain the Contact_Adapter until all features are migrated

### Requirement 20: Zero Downtime Deployment Strategy

**User Story:** As a DevOps engineer, I want a zero-downtime deployment strategy, so that users experience no service interruption during migration.

#### Acceptance Criteria

1. THE Deployment_Process SHALL deploy new code before running migrations
2. THE System SHALL use feature flags to enable new entity model features gradually
3. THE Migration_Engine SHALL run as a background process without blocking user operations
4. THE System SHALL monitor migration progress and provide status updates
5. WHEN migration errors occur, THE System SHALL alert administrators without affecting user operations

### Requirement 21: Data Integrity Validation

**User Story:** As a data engineer, I want comprehensive data integrity validation, so that I can verify migration correctness and completeness.

#### Acceptance Criteria

1. THE Validation_Engine SHALL verify all entities have corresponding workspace_entities
2. THE Validation_Engine SHALL verify all foreign key references are valid
3. THE Validation_Engine SHALL verify entity type-specific data is complete
4. THE Validation_Engine SHALL verify tag associations are correctly migrated
5. THE Validation_Engine SHALL generate a validation report with any discrepancies
6. FOR ALL validation failures, THE System SHALL log detailed error information for investigation

### Requirement 22: Migration Progress Monitoring

**User Story:** As a system administrator, I want real-time migration progress monitoring, so that I can track migration status and identify issues.

#### Acceptance Criteria

1. THE Migration_Dashboard SHALL display total documents to migrate
2. THE Migration_Dashboard SHALL display documents successfully migrated
3. THE Migration_Dashboard SHALL display documents failed with error details
4. THE Migration_Dashboard SHALL display estimated time remaining
5. THE Migration_Dashboard SHALL provide pause and resume controls
6. THE System SHALL send notifications when migration completes or encounters critical errors

### Requirement 23: Performance Optimization for Large Datasets

**User Story:** As a system administrator, I want optimized migration performance, so that large datasets can be migrated efficiently.

#### Acceptance Criteria

1. THE Migration_Engine SHALL process documents in batches of 450 operations
2. THE Migration_Engine SHALL use Firebase Admin SDK batch writes for efficiency
3. THE Migration_Engine SHALL implement exponential backoff for rate limit errors
4. THE Migration_Engine SHALL parallelize independent migration operations
5. THE System SHALL complete migration of 10,000 documents within 30 minutes

### Requirement 24: Rollback Testing and Validation

**User Story:** As a QA engineer, I want comprehensive rollback testing, so that I can verify data recovery works correctly.

#### Acceptance Criteria

1. THE Test_Suite SHALL verify rollback restores original document state
2. THE Test_Suite SHALL verify rollback deletes newly created entities
3. THE Test_Suite SHALL verify rollback restores foreign key references
4. THE Test_Suite SHALL verify rollback maintains data integrity
5. THE Test_Suite SHALL verify rollback completes within 15 minutes for 10,000 documents

### Requirement 25: Migration Documentation and Runbooks

**User Story:** As a system administrator, I want comprehensive migration documentation, so that I can execute migrations safely and troubleshoot issues.

#### Acceptance Criteria

1. THE Documentation SHALL provide step-by-step migration execution instructions
2. THE Documentation SHALL document all migration prerequisites and dependencies
3. THE Documentation SHALL provide rollback procedures with decision criteria
4. THE Documentation SHALL document common migration errors and resolutions
5. THE Documentation SHALL provide post-migration validation checklists

### Requirement 26: Test Coverage for Migration Logic

**User Story:** As a developer, I want comprehensive test coverage for migration logic, so that I can ensure migration correctness.

#### Acceptance Criteria

1. THE Test_Suite SHALL achieve 100% code coverage for migration functions
2. THE Test_Suite SHALL include unit tests for FER_Protocol implementation
3. THE Test_Suite SHALL include integration tests for end-to-end migration
4. THE Test_Suite SHALL include property-based tests for data transformation invariants
5. THE Test_Suite SHALL validate round-trip migration (migrate → rollback → verify)

### Requirement 27: Entity Type-Specific Field Validation

**User Story:** As a developer, I want entity type-specific field validation, so that data integrity is maintained for each entity type.

#### Acceptance Criteria

1. WHEN entityType is "institution", THE System SHALL require institutionData fields
2. WHEN entityType is "family", THE System SHALL require familyData with guardians and children
3. WHEN entityType is "person", THE System SHALL require personData with firstName and lastName
4. THE System SHALL reject entity creation with missing required type-specific fields
5. THE System SHALL validate field types match entity type schema

### Requirement 28: Multi-Workspace Entity Visibility

**User Story:** As a user working across workspaces, I want to see entities shared across multiple workspaces, so that I can maintain consistent contact information.

#### Acceptance Criteria

1. WHEN an entity is linked to multiple workspaces, THE System SHALL create separate workspace_entities for each
2. THE Entity_Selector SHALL display entities from all accessible workspaces
3. THE System SHALL show workspace-specific state (pipeline, stage, tags) per workspace
4. THE System SHALL maintain global entity data consistency across workspaces
5. WHEN entity global data is updated, THE System SHALL reflect changes in all workspaces

### Requirement 29: Security and Access Control Migration

**User Story:** As a security administrator, I want access control rules updated for the new entity model, so that data security is maintained.

#### Acceptance Criteria

1. THE Firestore_Security_Rules SHALL enforce organization-level isolation for entities
2. THE Firestore_Security_Rules SHALL enforce workspace-level isolation for workspace_entities
3. THE System SHALL verify user has workspace access before allowing workspace_entity operations
4. THE System SHALL audit all entity and workspace_entity operations
5. THE System SHALL prevent cross-organization data access

### Requirement 30: Migration Dry Run Capability

**User Story:** As a system administrator, I want to run migration in dry-run mode, so that I can preview changes without committing them.

#### Acceptance Criteria

1. WHEN dry-run mode is enabled, THE Migration_Engine SHALL simulate all operations without writing to Firestore
2. THE Migration_Engine SHALL generate a detailed report of planned changes
3. THE Migration_Engine SHALL identify potential errors before actual migration
4. THE Migration_Engine SHALL estimate migration duration based on document count
5. THE System SHALL provide a comparison report showing before and after states

