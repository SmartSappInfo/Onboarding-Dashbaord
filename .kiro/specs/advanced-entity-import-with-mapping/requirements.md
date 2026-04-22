# Requirements Document: Advanced Entity Import with Mapping

## Introduction

The Advanced Entity Import with Mapping system enables users to import large volumes of entity data (institutions, families, persons) from CSV files into SmartSapp workspaces. The system provides intelligent field mapping, validation, duplicate detection, and error handling to ensure data quality while maintaining backward compatibility with the existing import service. This feature supports the unified entity model (`entities` + `workspace_entities`) and respects multi-tenant isolation and workspace contact scope constraints.

## Glossary

- **Import_System**: The advanced entity import system with mapping capabilities
- **CSV_Parser**: Component that reads and parses CSV file content
- **Field_Mapper**: Component that maps CSV columns to entity fields
- **Validation_Engine**: Component that validates data before import
- **Import_Executor**: Component that creates entities and workspace_entities records
- **Template_Generator**: Component that generates sample CSV templates
- **Duplicate_Detector**: Component that identifies existing entities by name and organizationId
- **Error_Collector**: Component that collects and reports import errors without aborting
- **Contact_Adapter**: Existing adapter layer for entity operations
- **ScopeGuard**: Existing validation component that enforces workspace contact scope
- **Entity**: Record in the entities collection (global identity)
- **Workspace_Entity**: Record in the workspace_entities collection (operational state)
- **Native_Field**: Standard field defined in the entity model
- **Custom_Field**: User-defined field specific to a workspace
- **Import_Session**: A single import operation from upload to completion
- **Import_Row**: A single row from the CSV file representing one entity
- **Mapping_Configuration**: User-defined mapping between CSV columns and entity fields
- **Validation_Report**: Summary of importable, duplicate, and failed rows
- **Import_Result**: Final outcome showing successful, failed, and skipped entities
- **Activity_Logger**: Existing component that logs all import activities

## Requirements

### Requirement 1: CSV Template Generation

**User Story:** As a user, I want to download CSV templates for each entity type, so that I can prepare my data in the correct format before importing.

#### Acceptance Criteria

1. WHEN a user requests a template for an entity type, THE Template_Generator SHALL generate a CSV file with headers for all required and optional fields
2. THE Template_Generator SHALL include minimum required fields: Entity Name, Primary Contact Name, Contact Email, Contact Phone
3. WHERE the workspace has custom fields defined, THE Template_Generator SHALL include custom field columns in the template
4. THE Template_Generator SHALL generate different templates for institution, family, and person entity types
5. THE Template_Generator SHALL include sample data rows demonstrating correct format
6. THE Template_Generator SHALL name template files using the pattern: `{entityType}-import-template-{timestamp}.csv`

### Requirement 2: Intelligent Entity Naming Logic

**User Story:** As a user, I want the system to intelligently determine entity names based on entity type and available data, so that entities are named appropriately without manual intervention.

#### Acceptance Criteria

1. WHEN importing an institution, THE Import_System SHALL use the provided entity name as the institution name
2. WHEN importing a family with an entity name provided, THE Import_System SHALL use the provided entity name as the family name
3. WHEN importing a family without an entity name AND a father contact is provided, THE Import_System SHALL use the father's name as the family name AND designate the father as primary contact
4. WHEN importing a family without an entity name AND no father contact is provided, THE Import_System SHALL use the first guardian name as the family name
5. WHEN importing a person, THE Import_System SHALL concatenate firstName and lastName to create the entity name
6. THE Import_System SHALL allow users to override generated names in the entity editing view after import

### Requirement 3: Field Mapping Interface

**User Story:** As a user, I want to map CSV columns to entity fields after upload, so that I can import data with different column naming conventions.

#### Acceptance Criteria

1. WHEN a CSV file is uploaded, THE Field_Mapper SHALL display a mapping interface showing all CSV columns
2. THE Field_Mapper SHALL use logic-based matching to suggest mappings based on column header similarity
3. THE Field_Mapper SHALL match columns using pattern recognition for common variations (e.g., "Email", "E-mail", "email_address")
4. THE Field_Mapper SHALL display both native fields and workspace-specific custom fields as mapping targets
5. THE Field_Mapper SHALL allow users to manually adjust suggested mappings via dropdown selectors
6. THE Field_Mapper SHALL validate that all required fields are mapped before proceeding
7. THE Field_Mapper SHALL allow users to mark columns as "Do Not Import"
8. THE Field_Mapper SHALL save mapping configurations for reuse in future imports
9. THE Field_Mapper SHALL detect data type mismatches and warn users before import

### Requirement 4: Pre-Import Validation and Preview

**User Story:** As a user, I want to see validation results before importing, so that I can identify and correct errors without creating bad data.

#### Acceptance Criteria

1. WHEN validation is triggered, THE Validation_Engine SHALL check all rows for required field completeness
2. THE Validation_Engine SHALL identify duplicate entities by matching name and organizationId
3. THE Validation_Engine SHALL detect invalid data formats (e.g., malformed emails, invalid phone numbers)
4. THE Validation_Engine SHALL generate a Validation_Report showing total rows, importable rows, duplicate rows, and failed rows
5. THE Validation_Engine SHALL display specific error reasons for each failed row
6. THE Validation_Engine SHALL show a preview of the first 10 importable entities with mapped field values
7. THE Validation_Engine SHALL allow users to download a detailed error report as CSV
8. THE Validation_Engine SHALL provide row-level error messages with actionable correction guidance

### Requirement 5: Duplicate Detection

**User Story:** As a user, I want the system to detect duplicate entities before import, so that I avoid creating redundant records.

#### Acceptance Criteria

1. WHEN validating import data, THE Duplicate_Detector SHALL query the entities collection for existing records matching name and organizationId
2. THE Duplicate_Detector SHALL perform case-insensitive name matching
3. THE Duplicate_Detector SHALL normalize entity names by trimming whitespace and removing special characters before comparison
4. WHEN a duplicate is detected, THE Duplicate_Detector SHALL mark the row as skipped and include the existing entityId in the report
5. THE Duplicate_Detector SHALL allow users to choose between skip, update, or create new for duplicate handling
6. THE Duplicate_Detector SHALL batch duplicate checks to optimize performance for large imports

### Requirement 6: ScopeGuard Enforcement

**User Story:** As a system administrator, I want the import system to enforce workspace contact scope, so that users cannot import incompatible entity types into a workspace.

#### Acceptance Criteria

1. WHEN CSV data is parsed, THE Import_System SHALL infer the entity type from CSV headers
2. WHEN entity type is inferred, THE Import_System SHALL invoke ScopeGuard to validate against workspace contactScope
3. IF the inferred entity type does not match workspace contactScope, THEN THE Import_System SHALL reject the import and display an error message
4. THE Import_System SHALL display the workspace contactScope and detected entity type in the error message
5. THE Import_System SHALL prevent import execution until scope validation passes

### Requirement 7: Import Execution with Error Handling

**User Story:** As a user, I want the import to continue processing even when individual rows fail, so that I can import as much valid data as possible in one operation.

#### Acceptance Criteria

1. WHEN import execution begins, THE Import_Executor SHALL process rows sequentially
2. IF a row fails validation or creation, THEN THE Error_Collector SHALL record the error and continue processing remaining rows
3. THE Import_Executor SHALL create records in both entities and workspace_entities collections for each successful row
4. WHERE pipelineId and stageId are provided, THE Import_Executor SHALL link entities to the specified pipeline and stage
5. THE Import_Executor SHALL display real-time progress showing current row number and success/failure counts
6. THE Import_Executor SHALL use batch writes to optimize Firestore operations
7. THE Import_Executor SHALL invoke the Contact_Adapter for entity creation to ensure compatibility
8. THE Import_Executor SHALL log each entity creation via Activity_Logger

### Requirement 8: Post-Import Management

**User Story:** As a user, I want to review import results and retry failed rows, so that I can achieve complete data import without starting over.

#### Acceptance Criteria

1. WHEN import completes, THE Import_System SHALL display an Import_Result summary showing successful, failed, and skipped counts
2. THE Import_System SHALL provide a detailed list of failed rows with error reasons
3. THE Import_System SHALL allow users to download failed rows as a CSV file
4. THE Import_System SHALL allow users to edit failed row data in-app and retry import
5. THE Import_System SHALL allow users to delete failed rows from the retry queue
6. THE Import_System SHALL allow users to abandon retry attempts and close the import session
7. THE Import_System SHALL maintain import history showing timestamp, user, entity type, and result counts

### Requirement 9: Activity Logging and Audit Trail

**User Story:** As a compliance officer, I want all import activities logged, so that I can audit data changes and track user actions.

#### Acceptance Criteria

1. WHEN an import session begins, THE Import_System SHALL log an activity with type `import_started`
2. WHEN an import session completes, THE Import_System SHALL log an activity with type `contacts_imported` including success and error counts
3. THE Import_System SHALL log each entity creation with type `entity_created` including entityId and entityType
4. THE Import_System SHALL include import metadata in activity logs: totalRows, successCount, errorCount, skippedCount, entityType
5. THE Import_System SHALL associate all import activities with the userId, organizationId, and workspaceId
6. THE Import_System SHALL store import session details for 90 days for audit purposes

### Requirement 10: Multi-Step Wizard User Experience

**User Story:** As a user, I want a guided multi-step process for importing, so that I understand each stage and can make corrections before finalizing.

#### Acceptance Criteria

1. THE Import_System SHALL display a wizard with five steps: Upload, Map, Validate, Import, Review
2. THE Import_System SHALL show progress indicators displaying current step and completion status
3. THE Import_System SHALL allow users to navigate backward to previous steps to adjust mappings or upload a different file
4. THE Import_System SHALL disable the Next button until current step requirements are satisfied
5. THE Import_System SHALL preserve user selections when navigating between steps
6. THE Import_System SHALL display step-specific help text and examples
7. THE Import_System SHALL show a confirmation dialog before executing import

### Requirement 11: Performance Optimization for Large Files

**User Story:** As a user, I want to import large CSV files with 1000+ rows efficiently, so that I can complete bulk imports without timeouts or performance degradation.

#### Acceptance Criteria

1. THE Import_System SHALL process CSV files containing up to 5000 rows
2. WHEN processing more than 100 rows, THE Import_Executor SHALL use batch processing with batches of 50 entities
3. THE Import_Executor SHALL use background job processing for imports exceeding 500 rows
4. THE Import_System SHALL display real-time progress updates every 10 rows processed
5. THE Import_System SHALL complete validation of 1000 rows within 10 seconds
6. THE Import_System SHALL complete import execution of 1000 rows within 60 seconds
7. IF import execution exceeds 5 minutes, THEN THE Import_System SHALL timeout and provide a partial Import_Result

### Requirement 12: Custom Field Support

**User Story:** As a workspace administrator, I want to import data into custom fields, so that I can capture workspace-specific information during import.

#### Acceptance Criteria

1. WHEN generating templates, THE Template_Generator SHALL query workspace custom field definitions
2. THE Template_Generator SHALL include custom field columns with naming pattern: `custom_{fieldName}`
3. THE Field_Mapper SHALL display custom fields in the mapping interface with a "Custom" label
4. THE Import_Executor SHALL store custom field values in the appropriate entity or workspace_entity document structure
5. THE Validation_Engine SHALL validate custom field data types according to field definitions
6. THE Import_System SHALL support custom field types: text, number, date, boolean, select

### Requirement 13: Error Report Generation

**User Story:** As a user, I want to download a detailed error report, so that I can correct data issues offline and re-upload.

#### Acceptance Criteria

1. WHEN validation or import fails for any rows, THE Import_System SHALL generate an error report
2. THE Error_Collector SHALL include original row data, row number, and error reason for each failed row
3. THE Import_System SHALL allow users to download the error report as a CSV file
4. THE error report CSV SHALL include all original columns plus an "Error Reason" column
5. THE error report SHALL be named using pattern: `import-errors-{entityType}-{timestamp}.csv`
6. THE Import_System SHALL provide a "Download Error Report" button in the validation and review steps

### Requirement 14: Backward Compatibility

**User Story:** As a system maintainer, I want the new import system to maintain backward compatibility with existing import service, so that existing integrations continue to work.

#### Acceptance Criteria

1. THE Import_System SHALL use the existing Contact_Adapter for all entity creation operations
2. THE Import_System SHALL respect the existing entity model structure (entities + workspace_entities)
3. THE Import_System SHALL invoke existing ScopeGuard validation logic
4. THE Import_System SHALL use existing Activity_Logger for all logging operations
5. THE Import_System SHALL support the existing FER-01 EntityContact format
6. THE Import_System SHALL maintain compatibility with existing CSV parser utilities

### Requirement 15: Parser and Pretty Printer for CSV

**User Story:** As a developer, I want robust CSV parsing and generation, so that the system handles various CSV formats correctly.

#### Acceptance Criteria

1. THE CSV_Parser SHALL parse CSV files with comma, semicolon, and tab delimiters
2. THE CSV_Parser SHALL handle quoted fields containing delimiters and newlines
3. THE CSV_Parser SHALL detect and handle UTF-8, UTF-16, and ASCII encodings
4. THE CSV_Parser SHALL trim whitespace from field values
5. THE Template_Generator SHALL format CSV output with proper quoting and escaping
6. FOR ALL valid entity data, parsing then generating then parsing SHALL produce equivalent data (round-trip property)
7. WHEN a CSV file contains invalid syntax, THE CSV_Parser SHALL return a descriptive error with line number

### Requirement 16: Import Session State Management

**User Story:** As a user, I want my import progress saved, so that I can resume if I navigate away or encounter an error.

#### Acceptance Criteria

1. THE Import_System SHALL create an Import_Session record when a CSV file is uploaded
2. THE Import_Session SHALL store: sessionId, userId, workspaceId, entityType, uploadedAt, status, rowCount
3. THE Import_System SHALL persist mapping configuration in the Import_Session
4. THE Import_System SHALL persist validation results in the Import_Session
5. WHEN a user navigates away during import, THE Import_System SHALL allow resuming from the last completed step
6. THE Import_System SHALL expire Import_Sessions after 24 hours
7. THE Import_System SHALL allow users to view and resume recent Import_Sessions from an import history page

### Requirement 17: Mapping Configuration Reuse

**User Story:** As a user, I want to save and reuse field mappings, so that I can quickly import files with consistent column structures.

#### Acceptance Criteria

1. THE Field_Mapper SHALL allow users to save mapping configurations with a custom name
2. THE Field_Mapper SHALL store saved mappings scoped to workspaceId and entityType
3. THE Field_Mapper SHALL display a list of saved mappings when starting a new import
4. THE Field_Mapper SHALL allow users to select a saved mapping to auto-populate field assignments
5. THE Field_Mapper SHALL allow users to edit and update saved mappings
6. THE Field_Mapper SHALL allow users to delete saved mappings
7. THE Field_Mapper SHALL validate that saved mappings are compatible with current CSV columns before applying

### Requirement 18: Pipeline and Stage Assignment

**User Story:** As a user, I want to assign imported entities to a specific pipeline and stage, so that they enter my workflow at the correct point.

#### Acceptance Criteria

1. THE Import_System SHALL display pipeline and stage selectors in the Upload step
2. THE Import_System SHALL query available pipelines for the target workspace
3. WHEN a pipeline is selected, THE Import_System SHALL load and display stages for that pipeline
4. THE Import_System SHALL default to the first stage of the selected pipeline if no stage is specified
5. WHERE pipelineId and stageId are provided, THE Import_Executor SHALL set these values in workspace_entities records
6. THE Import_System SHALL allow users to skip pipeline assignment, creating entities without workspace linkage

### Requirement 19: Data Type Validation

**User Story:** As a user, I want the system to validate data types before import, so that I can correct type mismatches before creating invalid records.

#### Acceptance Criteria

1. THE Validation_Engine SHALL validate email fields using RFC 5322 email format
2. THE Validation_Engine SHALL validate phone fields allowing international formats with optional country codes
3. THE Validation_Engine SHALL validate numeric fields rejecting non-numeric values
4. THE Validation_Engine SHALL validate date fields accepting ISO 8601 and common date formats (MM/DD/YYYY, DD/MM/YYYY)
5. THE Validation_Engine SHALL validate boolean fields accepting: true/false, yes/no, 1/0, Y/N (case-insensitive)
6. WHEN a field fails type validation, THE Validation_Engine SHALL include the expected format in the error message
7. THE Validation_Engine SHALL allow empty values for optional fields

### Requirement 20: Contact Information Handling

**User Story:** As a user, I want to import contact information correctly for each entity type, so that primary contacts are properly designated.

#### Acceptance Criteria

1. WHEN importing an institution, THE Import_Executor SHALL create EntityContact records from focal person columns
2. WHEN importing a family, THE Import_Executor SHALL create Guardian records from guardian columns
3. WHEN importing a person, THE Import_Executor SHALL create an EntityContact record using the person's own contact information
4. THE Import_Executor SHALL designate the first contact as isPrimary and isSignatory by default
5. THE Import_Executor SHALL extract and denormalize primary contact fields (primaryContactName, primaryEmail, primaryPhone) to workspace_entities
6. THE Import_Executor SHALL enforce FER-01 EntityContact format for all contact records

