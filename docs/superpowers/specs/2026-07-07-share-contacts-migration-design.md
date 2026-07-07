# Spec: Share Contacts Migration (Sales Leads to Enrollment Marketing)

This specification outlines the technical design for a Fetch-Enrich-Restore (FER) migration protocol to share contacts between the **Sales Leads** (`prospect`) workspace and the **Enrollment Marketing** (`enrollment-marketing`) workspace.

## Problem Description & Feasibility

### Goal
Add all contacts from the "Sales Leads" workspace to the "Enrollment Marketing" workspace so they can share contacts. 

### Feasibility Analysis
* **Scope Guard Compatibility**: The "Sales Leads" workspace contains entities of type `institution`. The "Enrollment Marketing" workspace has `contactScope: "institution"`. The scopes are fully compatible, satisfying system constraints.
* **Shared Entity Model**: In this application, contact details (names, contacts, addresses) are stored in the canonical `entities` collection, while workspace-specific states (assignee, status, workspaceTags) are stored in the `workspace_entities` collection.
* **Non-Duplication**: Instead of cloning entity records, sharing contacts means creating a new `workspace_entities` document for each entity in the target workspace. This links both workspaces to the exact same underlying `entities` document.

---

## Technical Architecture

The migration is implemented as a standalone script at `scripts/share-contacts-migration.ts` using a paginated Fetch-Enrich-Restore (FER) pipeline.

### 1. FETCH (Paginated Reader)
* Queries `workspace_entities` where `workspaceId == 'prospect'`.
* Processes in paginated chunks of **500 records** using Firestore query cursors (`orderBy('entityId')` and `startAfter()`) to prevent timeouts and out-of-memory errors on the ~19k contacts dataset.

### 2. ENRICH (Target Generator)
For each source `workspace_entities` record, the script constructs a target `workspace_entities` document:
* **Target Document ID**: `enrollment-marketing_${entityId}` (deterministic).
* **Workspace Settings**:
  * `workspaceId`: `"enrollment-marketing"`
  * `assignedTo`: `null` (reset assignee)
  * `workspaceTags`: `[]` (reset tags)
  * `status`: `"active"`
* **Denormalized Fields**: Copy all identity fields from the source document (e.g., `displayName`, `primaryEmail`, `primaryPhone`, `entityContacts`, `location`, `interests`, `entityType`).
* **Metadata**: Add `_migrationSource: "prospect_share_migration"` and `_migrationTimestamp: "<ISO_TIMESTAMP>"` for tracking and rollbacks.

### 3. RESTORE (Atomic Writer)
* Writes target relationship documents using Firestore `writeBatch` in chunks of **400 records**.
* After a batch commits, the script triggers `syncContactProjectionForWE` for each document to update the read-model projection.

---

## Operational Mechanics

### 1. Resume Capability (State Tracking)
Progress is persisted in Firestore at `migration_states/prospect_to_enrollment_marketing` with the following structure:
```typescript
interface MigrationProgressState {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  lastProcessedEntityId: string | null;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  errors: Array<{ entityId: string; error: string; timestamp: string }>;
  updatedAt: string;
}
```
* **Checkpointing**: The script reads the state document on startup. If it is `in_progress`, it resumes from `lastProcessedEntityId`.
* **State Commits**: The state document is updated atomically after every batch commit.

### 2. Rollback Capability
Invoking the script with the `--rollback` flag triggers a deletion pipeline:
1. Queries `workspace_entities` where `workspaceId == 'enrollment-marketing'` and `_migrationSource == 'prospect_share_migration'`.
2. Deletes these records in batches of 400.
3. Triggers `deleteContactProjectionForEntity` for each deleted document to clean up projections.
4. Deletes the checkpoint state document.

### 3. Verification Capability
Invoking the script with the `--verify` flag runs checks without modifying data:
* Cross-references target record count against source record count.
* Scans for orphaned target relationships (where `entityId` doesn't exist in `entities`).
* Verifies projection record presence for all linked relationships.

---

## Audit Logs & Trail
* Calls `logWorkspaceEntityCreated` to log manual-edit-level audit entries for each shared relationship.
* Logs a global activity summary under the `activities` collection on completion.
