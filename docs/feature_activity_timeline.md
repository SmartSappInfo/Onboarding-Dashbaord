# Feature: Activity Timeline

## Purpose

To capture and display a chronological feed of significant user and system actions across the platform. This serves as an audit trail and a tool for administrators to monitor platform-wide activity.

## Actors

- **System:** Automatically generates logs for certain events (e.g., school creation).
- **Administrator:** Generates logs by performing actions (e.g., updating a school, changing a pipeline stage) or by manually creating log entries (notes, calls, visits, emails). Views the activity timeline.
- **Public User:** Generates logs by submitting a survey or a PDF form.

## Entry Points

- **Log Creation (Automatic):** Triggered by server-side logic within other features. This is handled by calls to the `logActivity` server action.
- **Log Creation (Manual):** An administrator uses log interaction tools within school management contexts.
- **Timeline Viewing (Global):** An administrator navigates to the `/admin/activities` route.
- **Dashboard Viewing:** The most recent activities are displayed in a widget on the main administrative dashboard (`/admin` route).

## Data Model

The feature uses a single Firestore collection:

- **Collection:** `/activities`
- **Document Schema (`Activity`):**
  - `id` (string, auto-generated)
  - `schoolId` (string, nullable): The ID of the associated school.
  - `schoolName` (string, denormalized): The name of the school at the time of logging.
  - `schoolSlug` (string, denormalized): The slug of the school at the time of logging for UI linking.
  - `userId` (string, nullable): The ID of the user who performed the action. Null for system or public events.
  - `type` (enum string): The category of the activity.
  - `source` (enum string): How the log was generated. Possible values: `manual`, `user_action`, `system`, `public`.
  - `timestamp` (ISO string): The time the event occurred.
  - `description` (string): A human-readable sentence describing the action.
  - `metadata` (object, optional): A map for storing additional, type-specific data.

## Workflow

1.  An action triggers a call to the `logActivity` server action.
2.  The `logActivity` function denormalizes school identity data (`schoolName`, `schoolSlug`) and writes a new document to the `/activities` collection.
3.  The `ActivityTimeline` component subscribes to the `/activities` collection, ordered by timestamp descending.
4.  It fetches authorized users to create a lookup map for names and avatars.
5.  Each activity is rendered using denormalized school data, ensuring high performance and audit durability.

## Business Rules & Technical Constraints

- **Audit Durability**: School names and slugs are denormalized into each log entry. If a school is renamed or deleted, the historical logs remain interpretable.
- **Immutability**: All activity logs are immutable except for activities of type `note`.
- **Performance**: Queries are designed to run without secondary lookups for school names.
- **Firestore Indexing**: Composite indexes are required for queries that filter by `schoolId` or `userId` while ordering by `timestamp`.

## extension Guidelines

- Call the `logActivity` server action from the relevant logic where new events occur.
- Ensure `schoolName` and `schoolSlug` are passed to the logger to avoid additional database reads during the logging process.
