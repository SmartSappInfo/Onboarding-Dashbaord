
# Feature: Activity Timeline

## Purpose

To capture and display a chronological feed of significant user and system actions across the platform. This serves as an audit trail and a tool for administrators to monitor platform-wide activity.

## Actors

- **System:** Automatically generates logs for certain events (e.g., school creation).
- **Administrator:** Generates logs by performing actions (e.g., updating a school, changing a pipeline stage) or by manually creating log entries (notes, calls, visits, emails). Views the activity timeline.
- **Public User:** Generates logs by submitting a survey or a PDF form.

## Entry Points

- **Log Creation (Automatic):** Triggered by server-side logic within other features (e.g., creating a school, changing a stage, submitting a form). This is handled by calls to the `logActivity` server action.
- **Log Creation (Manual):** An administrator clicks the "Log Interaction" button within the School Details modal, which opens the `LogActivityModal` component.
- **Timeline Viewing (Global):** An administrator navigates to the `/admin/activities` route.
- **Timeline Viewing (School-specific):** An administrator opens the `SchoolDetailsModal` and views the `NotesSection`.
- **Dashboard Viewing:** The most recent activities are displayed in a widget on the main administrative dashboard (`/admin` route).

## Data Model

The feature uses a single Firestore collection:

- **Collection:** `/activities`
- **Document Schema (`Activity`):**
  - `id` (string, auto-generated)
  - `schoolId` (string, nullable): The ID of the associated school.
  - `userId` (string, nullable): The ID of the user who performed the action. Null for system or public events.
  - `type` (enum string): The category of the activity. Possible values: `note`, `call`, `visit`, `email`, `school_created`, `school_assigned`, `meeting_created`, `pipeline_stage_changed`, `school_updated`, `form_submission`, `notification_sent`, `pdf_uploaded`, `pdf_published`, `pdf_form_submitted`.
  - `source` (enum string): How the log was generated. Possible values: `manual`, `user_action`, `system`, `public`.
  - `timestamp` (ISO string): The time the event occurred.
  - `description` (string): A human-readable sentence describing the action (e.g., "Jane Doe created school 'New School'").
  - `metadata` (object, optional): A map for storing additional, type-specific data.
    - `content` (string): For `note`, `call`, `visit`, `email` types.
    - `from` (string): For `pipeline_stage_changed`.
    - `to` (string): For `pipeline_stage_changed`.
    - `meetingId` (string): For `meeting_created`.
    - `surveyId` (string): For `form_submission`.
    - `pdfId` (string): For PDF-related events.

## Workflow

1.  An action (manual or automatic) triggers a call to the `logActivity` server action, providing all necessary data (`schoolId`, `userId`, `type`, `description`, etc.).
2.  The `logActivity` function adds a `timestamp` and writes a new document to the `/activities` collection in Firestore.
3.  The `ActivityTimeline` component subscribes to the `/activities` collection, ordered by timestamp descending.
4.  It also fetches all `users` and `schools` documents to create lookup maps for names and avatars.
5.  The timeline component groups the fetched activities by date (e.g., "Today", "Yesterday", "June 12, 2024").
6.  Each activity is rendered by the `ActivityItem` component, which displays the user's avatar, name, the description, a timestamp, and any associated content from the `metadata` field.
7.  A user can edit or delete their own `'note'` type activities. This is handled by the `updateNote` and `deleteNote` server actions, which are governed by Firestore security rules.

## Business Rules

- All activity logs are immutable except for activities of type `note`.
- Only the user who created a `note` activity can update or delete it. This is enforced by `firestore.rules`.
- All reads and writes to the `/activities` collection require the user to be an authorized administrator, as defined by `isAuthorized()` in `firestore.rules`.

## Integrations

- **Firebase Firestore:** Used for storing and retrieving all activity documents.
- **School Management Feature:** The `NotesSection` is embedded within the school details view.
- **User Management Feature:** Uses the `/users` collection to enrich activity items with user names and avatars.
- **Survey Engine, PDF Forms:** Trigger activity logs upon public submission.
- **Admin Dashboard:** A widget on the main dashboard displays the most recent activities.

## State Changes

- **Create:** A new document is created in the `/activities` collection for each logged event.
- **Update:** The `metadata.content` and `timestamp` fields of a `note` activity document can be updated.
- **Delete:** A document of type `note` can be deleted from the `/activities` collection.

## Files Involved

- `src/lib/activity-logger.ts`: Provides the `logActivity` server action, the sole entry point for creating new activity logs.
- `src/lib/activity-actions.ts`: Contains server actions for updating and deleting `note` activities.
- `src/app/admin/components/ActivityTimeline.tsx`: The primary UI component for fetching, grouping, and displaying a list of activities.
- `src/app/admin/components/ActivityItem.tsx`: Renders a single item in the timeline, including its icon, user info, and content.
- `src/app/admin/components/NotesSection.tsx`: A specialized view of the timeline for a single school.
- `src/app/admin/components/LogActivityModal.tsx`: A form for manually logging activities.
- `src/lib/activity-icons.tsx`: A utility that maps an activity `type` to a specific `lucide-react` icon component.
- `src/components/dashboard/RecentActivity.tsx`: A dashboard widget that displays a summary of recent activities.
- `firestore.rules`: Defines access control for the `/activities` path.

## What This Feature Does NOT Do

- It does not log every single user click or navigation event. It only logs significant, pre-defined business actions.
- It does not provide real-time notifications to users about new activities.
- It does not handle versioning or history of an activity document itself (e.g., edit history of a note).

## Extension Guidelines

- To log a new type of event, add a new value to the `Activity['type']` enum in `src/lib/types.ts`.
- Add a corresponding icon for the new type in `src/lib/activity-icons.tsx`.
- Call the `logActivity` server action from the relevant server-side or client-side code where the new event occurs.
- If the new activity type requires unique metadata, update the `metadata` object schema in `src/lib/types.ts`.
