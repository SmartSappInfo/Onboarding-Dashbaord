
# Feature: Dynamic Onboarding Pages

## Purpose

To automatically generate unique, school-specific, public-facing landing pages for different types of onboarding meetings. These pages serve as a central hub for meeting attendees (parents, staff) to find meeting details, join the live session, and access related resources like recordings and brochures.

## Actors

- **Public User:** Any user with the direct URL, typically a parent or school staff member. This actor is unauthenticated.
- **Administrator:** Creates and manages the `Meeting` and `School` data that populates these pages.

## Entry Points

- **Direct URL Navigation:** A user navigates to a URL with the structure `/meetings/[meetingType]/[schoolSlug]`.
    -   Example: `/meetings/parent-engagement/ghana-international-school`
- **Admin-Generated Links:** An administrator copies and shares these links from the `/admin/meetings` page.

## Data Model

This feature relies on two core Firestore collections:

-   **Collection:** `/schools`
    -   **Key Fields Used:** `slug`, `name`, `slogan`, `logoUrl`, `heroImageUrl`.
-   **Collection:** `/meetings`
    -   **Key Fields Used:** `schoolId` (links to a school), `schoolSlug`, `meetingTime`, `meetingLink`, `type` (an object containing `id`, `name`, `slug`), `recordingUrl`, `brochureUrl`.

## Workflow

1.  A user accesses a URL like `/meetings/parent-engagement/some-school`.
2.  The Next.js dynamic route captures `parent-engagement` as `typeSlug` and `some-school` as `schoolSlug`.
3.  The `SchoolMeetingLoader` client component is rendered.
4.  Inside `SchoolMeetingLoader`, an effect hook triggers a data fetch from Firestore.
5.  **Step 1: Fetch School.** It executes a query on the `/schools` collection `where('slug', '==', schoolSlug)`.
6.  **Step 2: Fetch Meetings.** If a school is found, it uses the school's ID to query the `/meetings` collection for all documents `where('schoolId', '==', foundSchool.id)`.
7.  **Step 3: Filter & Sort Meetings (Client-Side).** The component receives the list of all meetings for that school. It then filters this list to find meetings where `meeting.type.slug` matches the `typeSlug` from the URL.
8.  **Step 4: Select the Correct Meeting.** It separates the filtered meetings into "upcoming" and "past" based on the current time. It selects the *soonest* upcoming meeting. If there are no upcoming meetings, it selects the *most recent* past meeting.
9.  **Step 5: Render Content.**
    -   If no school or no suitable meeting is found, the `MeetingNotFound` component is rendered.
    -   If data is found, the appropriate layout is rendered based on the `typeSlug` (e.g., `ParentEngagementLayout`, `KickoffLayout`).
    -   The selected layout receives the `school` and `meeting` objects as props.
10. **Step 6: Hero Component Logic.** The specific hero component (e.g., `MeetingHero`) contains its own internal logic to determine its state based on time:
    -   It calculates if the meeting is upcoming, has ended, or has a recording available.
    -   If upcoming, it displays the `CountdownTimer` and `JoinMeetingForm`.
    -   If ended with no recording, it displays a "Recording will be available soon" message.
    -   If a recording is available, it displays a "Watch Meeting Recording" button.
11. **Step 7: Conditional Section Rendering.** The main layout component conditionally renders other sections (like `RecordingSection` or `BrochureDownloadSection`) based on whether `recordingUrl` or `brochureUrl` exist in the `meeting` object.

## Business Rules

-   A meeting page can only be displayed if a `School` with a matching `slug` exists.
-   A meeting page can only be displayed if at least one `Meeting` document exists for that school with a matching `type.slug`.
-   The system prioritizes showing an upcoming meeting. It only falls back to a past meeting if no future meetings of that type are scheduled.
-   The "Join Meeting" button in the `JoinMeetingForm` is disabled until 5 minutes before the scheduled meeting time.
-   The hero section's content (countdown vs. ended message vs. watch recording button) is determined client-side based on the current time and the presence of `meeting.recordingUrl`.

## Integrations

-   **Firebase Firestore:** The sole data source for all school and meeting information.
-   **YouTube:** Video recordings are expected to be YouTube links, which are rendered by the `VideoEmbed` component.

## State Changes

-   When a user submits the `JoinMeetingForm`, a new document is created in the `/meetings/{meetingId}/attendees` subcollection to log their attendance. This is the only write operation performed by this feature.

## Files Involved

-   `src/app/meetings/[slug]/page.tsx`, `.../kickoff/[schoolSlug]/page.tsx`, etc.: The Next.js route entry point files.
-   `src/components/school-meeting-loader.tsx`: The core client component responsible for all data fetching and rendering logic for the meeting pages.
-   `src/components/meeting-hero.tsx`, `src/components/kickoff-meeting-hero.tsx`, `src/components/training-meeting-hero.tsx`: Components that render the main hero section, each containing the time-based state logic.
-   `src/components/join-meeting-form.tsx`: The form for users to enter their name and join the meeting. Handles writing to the `attendees` subcollection.
-   `src/components/recording-section.tsx`: The section that appears when a `recordingUrl` is available.
-   `src/components/countdown-timer.tsx`: A client component that displays the live countdown to the meeting.
-   `src/components/meeting-not-found.tsx`: The component shown when data cannot be loaded.
-   `src/lib/types.ts`: Defines the `School` and `Meeting` data structures.
-   `firestore.rules`: Security rules must `allow read` on the `/schools/{schoolId}` and `/meetings/{meetingId}` paths for this feature to function.

## What This Feature Does NOT Do

-   It does not handle user authentication. All access is public.
-   It does not create or edit school or meeting data. That is handled by the Administrative Dashboard.
-   It does not rely on server-side rendering (SSR) for its primary data; all data fetching is client-side.

## Extension Guidelines

-   To add a new meeting type, add a new entry to the `MEETING_TYPES` array in `src/lib/types.ts`. Create a new route file under `/app/meetings/` (e.g., `/app/meetings/new-type/[schoolSlug]/page.tsx`) and a corresponding new layout component (e.g., `NewTypeLayout`). Update the switch statement in `SchoolMeetingLoader` to render the new layout.
-   To change the content of a meeting page, modify the corresponding layout component (e.g., `ParentEngagementLayout`).
-   Do not add complex, multi-field queries to `school-meeting-loader.tsx` without first creating the required composite indexes in Firestore, as this will cause the query to fail silently. The current pattern of fetching broadly and filtering on the client is more resilient.
