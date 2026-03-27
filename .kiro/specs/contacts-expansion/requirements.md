# Requirements Document

## Introduction

SmartSapp currently manages contacts exclusively as "schools/institutions." This feature expands the contact system to support three distinct contact scopes: **institution**, **family**, and **person**. The architectural principle is that each workspace declares exactly one contact scope, and that scope governs the data model, UI, workflows, automations, and messaging for that workspace.

This expansion introduces a new `entities` collection (unified contact identity), a `workspace_entities` link collection (workspace-specific operational state), and a `contactScope` field on workspaces. All existing `schools` data and features remain fully operational via a backward-compatible adapter layer during and after migration.

The 15 risks identified in `what-could-go-wrong.md` are each addressed as explicit requirements below.

---

## Glossary

- **Organization**: The root tenant. All workspaces, entities, and users belong to one organization.
- **Workspace**: An operational context within an organization. Each workspace declares exactly one `contactScope`.
- **ContactScope**: The declared contact type a workspace manages. One of: `institution`, `family`, `person`.
- **Entity**: A unified contact identity record in the `entities` collection. Stores stable identity data only.
- **EntityType**: The type of an entity. One of: `institution`, `family`, `person`. Must match the workspace's `contactScope` for any workspace the entity belongs to.
- **WorkspaceEntity**: A document in the `workspace_entities` collection representing the operational relationship between one entity and one workspace. Stores pipeline state, stage, assigned rep, and workspace-scoped tags.
- **GlobalTags**: Tags stored on the `entities` document. Represent identity-level labels visible across all workspaces.
- **WorkspaceTags**: Tags stored on the `workspace_entities` document. Represent operational labels scoped to one workspace.
- **Capabilities**: A per-workspace feature flag map that enables or disables modules (billing, admissions, children, contracts, messaging, automations, tasks) independently of `contactScope`.
- **Adapter Layer**: Server-side logic that maps legacy `schools` collection reads/writes to the new `entities` + `workspace_entities` model, preserving backward compatibility.
- **ScopeGuard**: A validation rule enforced at every write path that asserts `entity.entityType === workspace.contactScope`.
- **FocalPerson**: A named contact person associated with an entity (e.g., principal, guardian, account manager).
- **Guardian**: A parent or legal guardian associated with a family entity.
- **Child**: A child record associated with a family entity.
- **Pipeline**: An ordered set of stages representing a workflow. Pipelines are workspace-scoped via `workspace_entities`.
- **Stage**: A single step within a pipeline. Stage assignment lives on `workspace_entities`, not on the entity root.
- **Messaging_Engine**: The SmartSapp subsystem that dispatches SMS and email messages using variable templates.
- **Automation_Engine**: The SmartSapp subsystem that evaluates trigger/condition/action rules in response to entity and workspace events.
- **Activity_Logger**: The SmartSapp subsystem that writes immutable audit entries to the `activities` collection.
- **Import_Service**: The subsystem responsible for parsing CSV/spreadsheet uploads and creating or linking entities in a workspace.
- **Migration_Script**: A one-time script that backfills existing `schools` documents into the `entities` + `workspace_entities` model.

---

## Requirements

### Requirement 1: Workspace Contact Scope Declaration

**User Story:** As an organization administrator, I want each workspace to declare a single contact scope, so that the entire workspace UI, data model, and workflows are consistently tailored to one contact type.

#### Acceptance Criteria

1. THE Workspace SHALL include a `contactScope` field with a value of `institution`, `family`, or `person`.
2. THE Workspace SHALL include a `capabilities` map with boolean flags for: `billing`, `admissions`, `children`, `contracts`, `messaging`, `automations`, `tasks`.
3. WHEN a new workspace is created, THE System SHALL require `contactScope` to be set before the workspace becomes active.
4. WHILE a workspace has zero active `workspace_entities` records, THE System SHALL allow `contactScope` to be updated.
5. WHEN a workspace has one or more active `workspace_entities` records, THE System SHALL reject any attempt to change `contactScope` and return a descriptive error.
6. THE System SHALL display the label "This workspace manages [scope type]" in the workspace settings UI, where scope type is "Schools", "Families", or "People" corresponding to the declared scope.
7. IF a request attempts to change `contactScope` on a workspace with live records, THEN THE System SHALL return an error: "Scope cannot be changed after activation."

---

### Requirement 2: Unified Entity Identity Model

**User Story:** As a developer, I want a single `entities` collection that stores stable contact identity data for all three scopes, so that messaging, tasks, automations, and activity logs share one consistent contact record.

#### Acceptance Criteria

1. THE System SHALL store all contact identity records in a Firestore collection named `entities`.
2. EACH Entity document SHALL include: `id`, `organizationId`, `entityType`, `name`, `contacts` (array of FocalPerson), `globalTags` (array of tag IDs), `createdAt`, `updatedAt`.
3. WHERE `entityType` is `institution`, THE Entity SHALL include an `institutionData` sub-document with fields: `nominalRoll`, `subscriptionPackageId`, `subscriptionRate`, `billingAddress`, `currency`, `modules`, `implementationDate`, `referee`.
4. WHERE `entityType` is `family`, THE Entity SHALL include a `familyData` sub-document with fields: `guardians` (array of Guardian), `children` (array of Child), `admissionsData`.
5. WHERE `entityType` is `person`, THE Entity SHALL include a `personData` sub-document with fields: `firstName`, `lastName`, `company`, `jobTitle`, `leadSource`.
6. THE Entity SHALL NOT store `pipelineId`, `stageId`, `assignedTo`, or `workspaceTags` — these fields belong exclusively on `workspace_entities`.
7. WHEN an entity is created, THE System SHALL validate that `entityType` is one of the three allowed values and reject the write if not.

---

### Requirement 3: Workspace-Entity Relationship Model

**User Story:** As a developer, I want an explicit `workspace_entities` link collection that stores all workspace-specific operational state, so that the same entity can participate in multiple workspaces with independent pipeline positions, assignees, and tags.

#### Acceptance Criteria

1. THE System SHALL store all workspace-entity relationships in a Firestore collection named `workspace_entities`.
2. EACH WorkspaceEntity document SHALL include: `id`, `organizationId`, `workspaceId`, `entityId`, `entityType`, `pipelineId`, `stageId`, `assignedTo`, `status`, `workspaceTags` (array of tag IDs), `lastContactedAt`, `addedAt`, `updatedAt`.
3. THE WorkspaceEntity SHALL include denormalized read-model fields: `displayName`, `primaryEmail`, `primaryPhone`, `currentStageName`.
4. WHEN a WorkspaceEntity is created, THE System SHALL validate that `entityType` equals the target workspace's `contactScope` and reject the write if they do not match (ScopeGuard).
5. THE ScopeGuard SHALL be enforced at: entity creation, manual workspace linking, CSV import, API writes, and Firestore security rules.
6. WHEN an entity's `displayName`, `primaryEmail`, or `primaryPhone` changes, THE System SHALL update the corresponding denormalized fields on all related `workspace_entities` documents.
7. THE System SHALL use `workspace_entities` as the primary query target for all workspace list views, then hydrate entity identity data in a second fetch.
8. IF a WorkspaceEntity is deleted, THEN THE System SHALL NOT delete the underlying entity document, preserving identity data for other workspaces.

---

### Requirement 4: Scope Enforcement (Risk 1 — Scope as Hard Rule)

**User Story:** As a system architect, I want scope enforcement to be a hard server-side rule, not a UI preference, so that data integrity is guaranteed regardless of how a write originates.

#### Acceptance Criteria

1. THE System SHALL enforce `entity.entityType === workspace.contactScope` on every write path: create, import, link, and API.
2. THE System SHALL enforce the ScopeGuard in Firestore security rules so that direct SDK writes that bypass the server action layer are also rejected.
3. WHEN a scope mismatch is detected, THE System SHALL return a structured error: `{ code: "SCOPE_MISMATCH", message: "Entity type [X] cannot be added to a workspace with scope [Y]." }`.
4. THE System SHALL log every scope mismatch attempt to the `activities` collection with `type: "scope_violation"`.
5. THE System SHALL NOT rely on frontend validation alone for scope enforcement.

---

### Requirement 5: Pipeline and Stage on Workspace Link (Risk 2 — Per-Workspace Workflow State)

**User Story:** As an operations manager, I want each workspace to maintain its own independent pipeline position for a shared entity, so that the same institution can be at "Contract Review" in the Onboarding workspace and "Invoice Overdue" in the Billing workspace simultaneously.

#### Acceptance Criteria

1. THE System SHALL store `pipelineId` and `stageId` exclusively on the `workspace_entities` document, not on the entity root.
2. WHEN a user moves an entity to a new pipeline stage, THE System SHALL update `stageId` and `currentStageName` on the `workspace_entities` document for the current workspace only.
3. THE System SHALL NOT propagate stage changes from one workspace's `workspace_entities` record to another workspace's record for the same entity.
4. THE Pipeline Kanban view SHALL query `workspace_entities` filtered by `workspaceId` and `pipelineId` to render columns.
5. WHEN the `schools` collection is read via the Adapter Layer, THE System SHALL resolve `pipelineId` and `stage` from the corresponding `workspace_entities` record for the active workspace.

---

### Requirement 6: Scope Immutability After Activation (Risk 3 — Destructive Scope Changes)

**User Story:** As a product owner, I want workspace scope to be locked once the first live contact record exists, so that changing scope cannot silently corrupt existing forms, automations, pipelines, and templates.

#### Acceptance Criteria

1. THE System SHALL treat `contactScope` as immutable once the workspace has at least one `workspace_entities` record with `status: "active"`.
2. WHEN an administrator attempts to change `contactScope` on an active workspace, THE System SHALL display: "Scope cannot be changed after activation. Create a new workspace and migrate records intentionally."
3. THE System SHALL allow `contactScope` to be set or changed only during workspace creation or before the first active entity is linked.
4. IF a workspace is archived and all its `workspace_entities` records are removed, THEN THE System SHALL allow `contactScope` to be reset for reuse.
5. THE System SHALL record a `workspace_scope_locked` activity log entry the first time an entity is linked to a workspace.

---

### Requirement 7: Global vs. Workspace Tag Separation (Risk 5 — Tag Ambiguity)

**User Story:** As a CRM user, I want tags to be clearly separated into global identity tags and workspace-specific operational tags, so that a billing tag in one workspace does not pollute the sales view in another.

#### Acceptance Criteria

1. THE System SHALL store identity-level tags in `entities/{id}.globalTags` as an array of tag IDs.
2. THE System SHALL store workspace-operational tags in `workspace_entities/{id}.workspaceTags` as an array of tag IDs.
3. WHEN a user applies a tag from within a workspace, THE System SHALL write the tag ID to `workspaceTags` on the `workspace_entities` record by default.
4. WHERE a tag is designated as a global identity tag (e.g., `vip`, `strategic-account`), THE System SHALL write the tag ID to `globalTags` on the entity document.
5. THE Tag Management UI SHALL display a "Scope" indicator for each tag: "Global" or "Workspace".
6. THE Automation_Engine SHALL evaluate tag conditions against `workspaceTags` on the `workspace_entities` record for the triggering workspace.
7. THE Messaging_Engine SHALL resolve `contact_tags` variables from `workspaceTags` for the active workspace context.
8. WHEN a tag is deleted, THE System SHALL remove it from both `globalTags` on all affected entities and `workspaceTags` on all affected `workspace_entities` records.

---

### Requirement 8: Workspace-Scoped Queries (Risk 6 — Misleading Search and Filtering)

**User Story:** As a CRM user, I want all contact list views and search results to be strictly scoped to the current workspace, so that I never see contacts from other workspaces or incorrect stage data.

#### Acceptance Criteria

1. THE System SHALL query `workspace_entities` filtered by `workspaceId` as the first step for all contact list views.
2. THE System SHALL hydrate entity identity data (`name`, `contacts`, scope-specific data) from the `entities` collection in a second fetch after resolving workspace membership.
3. THE System SHALL NOT query the `entities` collection directly for workspace list views.
4. WHEN a user searches for contacts within a workspace, THE System SHALL search against denormalized fields (`displayName`, `primaryEmail`, `primaryPhone`) on `workspace_entities`.
5. THE System SHALL apply all filters (stage, assignee, tags, status) against fields on `workspace_entities`, not on the entity root.
6. WHEN a contact belongs to multiple workspaces, THE System SHALL display it as a separate row in each workspace's list with that workspace's own stage and assignee data.

---

### Requirement 9: Workspace-Scoped Permissions (Risk 7 — Permission Leakage)

**User Story:** As a security architect, I want contact access to be gated by workspace membership, so that a user in the Support workspace cannot read billing-sensitive state from the Finance workspace.

#### Acceptance Criteria

1. THE System SHALL grant access to a contact's `workspace_entities` record only to users who have access to that specific workspace.
2. THE System SHALL NOT grant access to a contact's data in workspace B solely because a user has access to the same entity in workspace A.
3. THE Firestore security rules SHALL enforce that reads on `workspace_entities` require the requesting user to be a member of the document's `workspaceId`.
4. THE System SHALL evaluate permissions at four levels: organization, workspace, workspace-entity relationship, and feature/module capability.
5. WHEN a user's workspace access is revoked, THE System SHALL immediately deny reads and writes to all `workspace_entities` records for that workspace.

---

### Requirement 10: Workspace-Aware Automation Engine (Risk 8 — Automation Context Confusion)

**User Story:** As an automation designer, I want every automation event to carry a `workspaceId`, so that automations in one workspace cannot accidentally trigger actions intended for another workspace.

#### Acceptance Criteria

1. WHEN an automation trigger fires, THE Automation_Engine SHALL include `{ organizationId, workspaceId, entityId, entityType, action, actorId, timestamp }` in the event payload.
2. THE Automation_Engine SHALL evaluate automation rules only against rules whose `workspaceIds` array includes the triggering `workspaceId`.
3. WHEN a `TAG_ADDED` or `TAG_REMOVED` trigger fires, THE Automation_Engine SHALL use the `workspaceId` from the `workspace_entities` record where the tag was applied.
4. THE Automation_Engine SHALL NOT fire automations across workspace boundaries unless the automation rule explicitly declares `scope: "global"`.
5. WHEN a `CREATE_TASK` automation action executes, THE System SHALL set `workspaceId` on the created task to match the triggering workspace.
6. THE Automation Builder UI SHALL display the workspace scope of each automation rule and warn if a rule has no `workspaceId` constraint.

---

### Requirement 11: Workspace-Aware Messaging Engine (Risk 9 — Messaging Context Confusion)

**User Story:** As a messaging operator, I want every message log to record the workspace context, so that message history is filterable by workspace and templates are not confused across operational contexts.

#### Acceptance Criteria

1. WHEN a message is dispatched, THE Messaging_Engine SHALL record `workspaceId` on the `message_logs` document.
2. THE Messaging_Engine SHALL resolve message template variables using the entity's data combined with the `workspace_entities` record for the active workspace.
3. THE System SHALL scope the message history view to the current workspace by default, with an option to view all messages for an entity across workspaces.
4. WHEN the `sendMessage` function is called, THE System SHALL require `workspaceId` as a mandatory parameter.
5. THE Messaging_Engine SHALL resolve `contact_tags` from `workspaceTags` on the `workspace_entities` record for the active workspace, not from `globalTags`.
6. THE System SHALL support workspace-scoped message templates, where a template's `workspaceIds` array determines which workspaces can use it.

---

### Requirement 12: Workspace-Aware Activity Logging (Existing Feature Integration)

**User Story:** As an auditor, I want every activity log entry to reference both the entity and the workspace context, so that the audit trail remains interpretable even when the same entity appears in multiple workspaces.

#### Acceptance Criteria

1. WHEN the Activity_Logger writes a new entry, THE System SHALL include `workspaceId`, `entityId`, and `entityType` on the activity document.
2. THE Activity_Logger SHALL denormalize `displayName` and a stable `entitySlug` from the entity at the time of logging, so historical entries remain readable if the entity is renamed.
3. THE Activity Timeline view SHALL filter entries by `workspaceId` when viewed from within a workspace context.
4. THE System SHALL maintain backward compatibility: existing `activities` documents with `schoolId` and `schoolName` SHALL continue to render correctly without migration.
5. WHEN a new activity is logged for a legacy `schools` record, THE System SHALL populate both `schoolId` (legacy) and `entityId` (new) fields on the activity document.

---

### Requirement 13: Workspace-Aware Task Management (Existing Feature Integration)

**User Story:** As a CRM user, I want tasks to be linked to both an entity and a workspace, so that task lists are correctly scoped and tasks created by automations land in the right workspace.

#### Acceptance Criteria

1. THE Task document SHALL include `entityId` and `entityType` fields in addition to the existing `schoolId` (retained for backward compatibility).
2. WHEN a task is created manually or by automation, THE System SHALL require `workspaceId` to be set.
3. THE Task list view SHALL filter tasks by `workspaceId` when accessed from within a workspace.
4. WHEN a task is linked to a legacy `schools` record, THE System SHALL populate both `schoolId` (legacy) and `entityId` (new) on the task document.
5. THE System SHALL display the entity's `displayName` and `entityType` badge on each task card.

---

### Requirement 14: Scope-Specific UI Behaviors

**User Story:** As a product designer, I want the workspace UI to automatically adapt its forms, table columns, and labels to the declared contact scope, so that users never see irrelevant fields.

#### Acceptance Criteria

1. WHEN the active workspace has `contactScope: "institution"`, THE System SHALL display: school name, nominal roll, billing address, subscription rate, contract signatory, onboarding stages, and modules. THE System SHALL hide: guardian fields, children management, and family admissions UI.
2. WHEN the active workspace has `contactScope: "family"`, THE System SHALL display: family name, guardians list, children list, admissions data, and child progression pipeline. THE System SHALL hide: nominal roll, subscription rate per student, and institutional billing UI.
3. WHEN the active workspace has `contactScope: "person"`, THE System SHALL display: first name, last name, company, job title, lead source, follow-up tasks, and deal notes. THE System SHALL hide: children, guardian fields, nominal roll, and school subscription data.
4. THE contact creation form SHALL render only the fields relevant to the workspace's `contactScope`.
5. THE contact list table SHALL display columns appropriate to the workspace's `contactScope`.
6. WHEN a user switches workspaces, THE System SHALL re-render the contact list, forms, and pipeline view to match the new workspace's `contactScope`.
7. THE workspace switcher SHALL display the scope type label ("Schools", "Families", "People") alongside the workspace name.

---

### Requirement 15: Institution Scope — Data Model and Fields

**User Story:** As an onboarding manager, I want institution contacts to capture all school-specific data fields, so that billing, contracts, and subscription management work correctly for school clients.

#### Acceptance Criteria

1. THE Entity with `entityType: "institution"` SHALL support `institutionData` containing: `nominalRoll` (integer), `subscriptionPackageId` (string), `subscriptionRate` (number), `billingAddress` (string), `currency` (string), `modules` (array), `implementationDate` (ISO date string), `referee` (string).
2. THE Entity with `entityType: "institution"` SHALL support `contacts` as an array of FocalPerson objects, each with: `name`, `phone`, `email`, `type` (Champion, Accountant, Administrator, Principal, School Owner), `isSignatory`.
3. THE System SHALL generate a URL-safe `slug` for each institution entity, used for public-facing pages such as `/meetings/parent-engagement/[slug]`.
4. WHEN an institution entity is created, THE System SHALL validate that `nominalRoll` is a positive integer if provided.
5. THE institution contact detail page SHALL display: profile header, focal persons, pipeline stage (from `workspace_entities`), tags (workspace + global), tasks, activity timeline, billing summary, and contracts.

---

### Requirement 16: Family Scope — Data Model and Fields

**User Story:** As an admissions coordinator, I want family contacts to capture guardian and child data, so that the admissions pipeline and child progression workflows are fully supported.

#### Acceptance Criteria

1. THE Entity with `entityType: "family"` SHALL support `familyData` containing: `guardians` (array of Guardian), `children` (array of Child), `admissionsData` (object).
2. EACH Guardian SHALL include: `name`, `phone`, `email`, `relationship` (e.g., Father, Mother, Legal Guardian), `isPrimary` (boolean).
3. EACH Child SHALL include: `firstName`, `lastName`, `dateOfBirth`, `gradeLevel`, `enrollmentStatus`.
4. THE family contact detail page SHALL display: family name, guardians list, children list, admissions pipeline stage (from `workspace_entities`), workspace tags, tasks, and activity timeline.
5. WHEN `capabilities.children` is `true` on the workspace, THE System SHALL display the children management section on the family detail page.
6. WHEN `capabilities.admissions` is `true` on the workspace, THE System SHALL display the admissions pipeline and admissions-specific fields.

---

### Requirement 17: Person Scope — Data Model and Fields

**User Story:** As a sales representative, I want person contacts to capture individual lead data, so that the personal CRM pipeline and follow-up workflows are fully supported.

#### Acceptance Criteria

1. THE Entity with `entityType: "person"` SHALL support `personData` containing: `firstName` (string, required), `lastName` (string, required), `company` (string, optional), `jobTitle` (string, optional), `leadSource` (string, optional).
2. THE `name` field on the entity SHALL be computed as `firstName + " " + lastName` for person entities.
3. THE person contact detail page SHALL display: full name, company, job title, lead source, pipeline stage (from `workspace_entities`), workspace tags, tasks, and activity timeline.
4. THE person contact detail page SHALL hide: nominal roll, subscription rate, children, guardian fields, and institutional billing.
5. WHEN a person entity is created, THE System SHALL require at least `firstName` and `lastName`.

---

### Requirement 18: Backward Compatibility — Schools Adapter Layer

**User Story:** As a developer, I want all existing features that reference the `schools` collection to continue working without modification, so that the migration can be phased without breaking production.

#### Acceptance Criteria

1. THE System SHALL retain the existing `schools` Firestore collection intact and continue to support all reads and writes to it during the migration period.
2. THE Adapter Layer SHALL expose a `resolveContact(schoolId, workspaceId)` function that returns a unified contact object by reading from `entities` + `workspace_entities` if a migration record exists, or falling back to the `schools` collection.
3. WHEN a legacy `schools` document is read via the Adapter Layer, THE System SHALL map `school.pipelineId` and `school.stage` to the corresponding `workspace_entities` record for the active workspace.
4. THE Adapter Layer SHALL translate `school.tags` to `workspaceTags` on the `workspace_entities` record.
5. THE Activity_Logger, Task system, Messaging_Engine, and Automation_Engine SHALL use the Adapter Layer to resolve contact references, ensuring they work with both legacy and new records.
6. THE System SHALL support a `migrationStatus` field on `schools` documents: `"legacy"`, `"migrated"`, or `"dual-write"` to track migration progress per record.
7. WHEN a `schools` document has `migrationStatus: "migrated"`, THE Adapter Layer SHALL read exclusively from `entities` + `workspace_entities` and ignore the `schools` document fields.

---

### Requirement 19: Migration Script

**User Story:** As a developer, I want a migration script that backfills existing school records into the new `entities` + `workspace_entities` model, so that historical data is preserved and the new architecture is fully populated.

#### Acceptance Criteria

1. THE Migration_Script SHALL read each document from the `schools` collection and create a corresponding `entities` document with `entityType: "institution"`.
2. THE Migration_Script SHALL create a `workspace_entities` document for each `(school, workspaceId)` pair found in `school.workspaceIds`.
3. THE Migration_Script SHALL copy `school.pipelineId` and `school.stage` to the `workspace_entities` document for the primary workspace.
4. THE Migration_Script SHALL copy `school.tags` to `workspaceTags` on the `workspace_entities` document.
5. THE Migration_Script SHALL set `migrationStatus: "migrated"` on the `schools` document upon successful backfill.
6. THE Migration_Script SHALL be idempotent: running it multiple times on the same record SHALL produce the same result without creating duplicate documents.
7. THE Migration_Script SHALL log a summary report: total records processed, succeeded, failed, and skipped.
8. IF a migration step fails for a specific record, THEN THE Migration_Script SHALL log the error and continue processing remaining records without aborting the entire run.

---

### Requirement 20: Scope-Specific Import Schemas (Risk 14 — Error-Prone Imports)

**User Story:** As a data administrator, I want scope-specific CSV import templates for each contact type, so that imports are validated against the correct schema before any records are created.

#### Acceptance Criteria

1. THE Import_Service SHALL provide three distinct import templates: institution, family, and person.
2. WHEN a CSV is uploaded to a workspace, THE Import_Service SHALL validate each row against the schema for the workspace's `contactScope` and reject rows that do not conform.
3. THE Import_Service SHALL enforce the ScopeGuard: it SHALL reject any import where the inferred entity type does not match the workspace's `contactScope`.
4. WHEN an import row fails validation, THE Import_Service SHALL record the row number and error reason in an import error report without aborting the remaining rows.
5. THE Import_Service SHALL preview the first 10 rows of a CSV upload and display field mapping before committing any writes.
6. THE Import_Service SHALL be idempotent per import session: re-uploading the same file SHALL not create duplicate entities if a matching record already exists (matched by name + organizationId).
7. THE institution import template SHALL include columns for: name, nominalRoll, billingAddress, currency, subscriptionPackageId, focalPerson_name, focalPerson_phone, focalPerson_email, focalPerson_type.
8. THE family import template SHALL include columns for: familyName, guardian1_name, guardian1_phone, guardian1_email, guardian1_relationship, child1_firstName, child1_lastName, child1_gradeLevel.
9. THE person import template SHALL include columns for: firstName, lastName, company, jobTitle, leadSource, phone, email.

---

### Requirement 21: Reporting — Distinct Metrics (Risk 10 — Reporting Confusion)

**User Story:** As an organization administrator, I want reports to clearly distinguish between unique entities, workspace memberships, and active pipeline items, so that business metrics are never misleadingly collapsed.

#### Acceptance Criteria

1. THE System SHALL expose the following distinct metrics in the reporting dashboard: total unique entities by type, total workspace-entity memberships by workspace, entities active in pipeline by workspace, and unique entities shared across two or more workspaces.
2. THE System SHALL NOT display a single "total contacts" metric that conflates unique entities with workspace memberships.
3. WHEN a report is generated for a specific workspace, THE System SHALL count `workspace_entities` records for that workspace, not the total entity count.
4. THE System SHALL support filtering reports by `entityType` and by `workspaceId` independently.
5. THE System SHALL display a "Shared Contacts" report showing entities that appear in more than one workspace, with their per-workspace stage and assignee.

---

### Requirement 22: Firestore Performance and Denormalization (Risk 11 — Index Sprawl)

**User Story:** As a developer, I want the data model to use intentional denormalization on `workspace_entities`, so that workspace list views require at most two Firestore fetches and do not require composite indexes that multiply unboundedly.

#### Acceptance Criteria

1. THE `workspace_entities` document SHALL include denormalized fields: `displayName`, `primaryEmail`, `primaryPhone`, `currentStageName` to support list rendering without a second entity fetch.
2. THE System SHALL update denormalized fields on `workspace_entities` whenever the corresponding source fields on the entity change.
3. THE System SHALL define Firestore composite indexes for: `(workspaceId, status)`, `(workspaceId, stageId)`, `(workspaceId, assignedTo)`, `(workspaceId, workspaceTags array-contains)`.
4. THE System SHALL NOT require more than two sequential Firestore reads to render a workspace contact list page.
5. THE System SHALL document all required Firestore indexes in a `firestore.indexes.json` file.

---

### Requirement 23: Capabilities vs. Scope Separation (Risk 12 — Logic Overloaded on Scope)

**User Story:** As a product manager, I want workspace capabilities to be configurable independently of contact scope, so that an institution workspace can have billing disabled without changing its scope.

#### Acceptance Criteria

1. THE Workspace SHALL include a `capabilities` map with boolean flags: `billing`, `admissions`, `children`, `contracts`, `messaging`, `automations`, `tasks`.
2. THE System SHALL NOT derive feature availability solely from `contactScope`; it SHALL check the `capabilities` map for each feature gate.
3. WHEN `capabilities.billing` is `false`, THE System SHALL hide all billing UI and reject billing-related API calls for that workspace.
4. WHEN `capabilities.messaging` is `false`, THE System SHALL hide the message composer and disable automation actions that send messages in that workspace.
5. WHEN `capabilities.tasks` is `false`, THE System SHALL hide the task panel and disable `CREATE_TASK` automation actions in that workspace.
6. THE workspace settings UI SHALL allow administrators to toggle individual capabilities without changing `contactScope`.

---

### Requirement 24: Cross-Scope Relationship Planning (Risk 13 — Cross-Scope Relationships)

**User Story:** As a product architect, I want the data model to not block future cross-entity relationships, so that a guardian who is also a school decision-maker can eventually be linked without duplicating records.

#### Acceptance Criteria

1. THE System SHALL NOT store cross-entity relationship data in the initial release but SHALL reserve the `entity_relationships` collection name for future use.
2. THE Entity document SHALL include an optional `relatedEntityIds` array field (empty by default) to support future relationship mapping without a schema migration.
3. THE System SHALL document the planned `entity_relationships` collection shape in the architecture notes: `{ id, organizationId, fromEntityId, toEntityId, relationshipType, createdAt }`.
4. THE System SHALL NOT block creation of the same real-world person as both a FocalPerson inside an institution entity and a standalone person entity; these are treated as separate records until relationship mapping is implemented.

---

### Requirement 25: Explicit UI Language for Scope Rules (Risk 15 — UI Hiding Complex Rules)

**User Story:** As a UX designer, I want the product copy to make scope rules explicit and visible, so that users understand constraints before they hit them.

#### Acceptance Criteria

1. THE workspace settings page SHALL display: "This workspace manages [scope label]. Only [scope label] records can exist here."
2. THE workspace creation wizard SHALL display: "Scope cannot be changed after the first contact is added."
3. WHEN a user attempts an action blocked by scope rules (e.g., importing a family CSV into an institution workspace), THE System SHALL display a clear, human-readable error message explaining the constraint.
4. THE workspace switcher dropdown SHALL display the scope type badge ("Schools", "Families", "People") next to each workspace name.
5. THE contact detail page SHALL display the entity type badge prominently so users always know what type of record they are viewing.
6. WHEN a workspace's `contactScope` is locked, THE System SHALL display a lock icon on the scope field in workspace settings with a tooltip: "Scope is locked because this workspace has active contacts."

---

### Requirement 26: PDF Forms, Surveys, and Meetings Integration

**User Story:** As a developer, I want PDF forms, surveys, and meetings to continue linking to contacts correctly after the migration, so that existing public-facing pages and submission records are not broken.

#### Acceptance Criteria

1. THE PDFForm document SHALL support both `schoolId` (legacy) and `entityId` (new) fields; the Adapter Layer SHALL populate both during the migration period.
2. THE Survey document SHALL support both `schoolId` (legacy) and `entityId` (new) fields.
3. THE Meeting document SHALL continue to use `schoolSlug` for public URL routing (`/meetings/parent-engagement/[schoolSlug]`); the Adapter Layer SHALL resolve `schoolSlug` from the entity's `slug` field.
4. WHEN a new entity is created with `entityType: "institution"`, THE System SHALL generate a `slug` field on the entity document using the same slug generation logic as the current `schools` collection.
5. THE System SHALL maintain all existing public routes (`/meetings/parent-engagement/[schoolSlug]`) without change during and after migration.

---

### Requirement 27: Parser and Serializer Round-Trip for Import/Export

**User Story:** As a developer, I want the import and export serializers to be round-trip safe, so that a contact exported to CSV and re-imported produces an equivalent record.

#### Acceptance Criteria

1. THE Import_Service SHALL parse CSV rows into typed entity objects according to the scope-specific schema.
2. THE Export_Service SHALL serialize entity + workspace_entities data back into CSV rows using the same scope-specific schema.
3. THE Export_Service SHALL format entity objects into valid CSV rows that conform to the import template for the same scope.
4. FOR ALL valid entity objects of a given scope, exporting then importing SHALL produce an equivalent entity record (round-trip property).
5. WHEN an invalid CSV row is provided, THE Import_Service SHALL return a descriptive error identifying the row number and the specific field that failed validation.

---

## Correctness Properties

The following property-based testing invariants MUST be verified for the key architectural rules of this feature.

### Property 1: ScopeGuard Invariant (Risk 1)

For all `(entity, workspace)` pairs where a `workspace_entities` link exists:

```
entity.entityType === workspace.contactScope
```

This invariant must hold after every create, import, link, and migration operation. A property test should generate random `(entityType, contactScope)` combinations and assert that mismatched pairs are always rejected with a `SCOPE_MISMATCH` error.

### Property 2: Pipeline State Isolation Invariant (Risk 2)

For any entity `E` linked to workspaces `W1` and `W2`:

```
workspace_entities[W1, E].stageId !== workspace_entities[W2, E].stageId
  is allowed and must not cause either record to be overwritten
```

A property test should simulate concurrent stage updates from two workspaces on the same entity and assert that each workspace's `workspace_entities` record retains its own independent `stageId`.

### Property 3: Scope Immutability After Activation (Risk 3)

For any workspace `W` with at least one active `workspace_entities` record:

```
update(W, { contactScope: newScope }) → REJECTED
```

A property test should generate workspaces with varying numbers of linked entities (0, 1, N) and assert that scope changes are accepted only when the count is 0.

### Property 4: Tag Partition Invariant (Risk 5)

For any entity `E` and workspace `W`:

```
globalTags(E) ∩ workspaceTags(W, E) may be non-empty (same tag can appear in both)
  but removing a workspaceTag from W must NOT remove it from globalTags(E)
  and removing a globalTag from E must NOT remove it from workspaceTags(W, E)
```

A property test should apply and remove tags in both scopes and assert that operations on one scope do not affect the other.

### Property 5: Denormalization Consistency Invariant (Risk 11)

For any entity `E` with `workspace_entities` records `[WE1, WE2, ..., WEn]`:

```
∀ WEi: WEi.displayName === E.name
∀ WEi: WEi.primaryEmail === E.contacts[0].email (if contacts non-empty)
```

A property test should update `E.name` and assert that all related `workspace_entities` records reflect the updated `displayName` within one write cycle.

### Property 6: Import Round-Trip Property (Requirement 27)

For all valid entity objects `E` of scope `S`:

```
parse(export(E)) ≡ E
```

A property test should generate random valid institution, family, and person entity objects, serialize them to CSV, parse the CSV back, and assert structural equivalence of the result.

### Property 7: Migration Idempotency (Requirement 19)

For any `schools` document `S`:

```
migrate(S) = migrate(migrate(S))
```

Running the Migration_Script twice on the same record must produce the same `entities` and `workspace_entities` documents without creating duplicates or overwriting data written after the first migration run.

### Property 8: Workspace Query Isolation (Risk 6)

For any two workspaces `W1` and `W2` in the same organization:

```
queryContacts(W1) ∩ queryContacts(W2) = ∅
  when no entity belongs to both workspaces
```

A property test should populate two workspaces with disjoint entity sets and assert that querying one workspace never returns entities from the other.
