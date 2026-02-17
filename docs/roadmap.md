# SYSTEM EXECUTION ROADMAP

## Phase 1: Foundation & Identity Layer

[ ] Define core user identity and establish secure access control mechanisms.

### Feature: Authentication & User Management

[ ] Define `UserProfile` schema in Firestore, including `name`, `email`, `photoURL`, and the `isAuthorized` boolean flag.
[ ] Implement the user signup workflow (`/signup` route).
    [ ] Create a new user in Firebase Authentication.
    [ ] Create a corresponding user document in the `/users` collection in Firestore.
    [ ] Set the `isAuthorized` flag to `false` for all new signups.
    [ ] Sign the user out immediately after signup.
    [ ] Redirect to the `/login` page with a "pending authorization" notification.
[ ] Implement the user login workflow (`/login` route).
    [ ] Authenticate users via email/password or Google Sign-In.
    [ ] On success, redirect the user to the `/admin` dashboard.
[ ] Implement the post-login authorization check.
    [ ] In the root admin layout (`/admin/layout.tsx`), fetch the logged-in user's profile from `/users/{userId}`.
    [ ] Validate if the `isAuthorized` field is `true`.
    [ ] If `false`, sign the user out and redirect them to `/login` with a "Permission Denied" error.
    [ ] If `true`, grant access and render the requested admin page.
[ ] Implement the user management UI (`/admin/users` route).
    [ ] Display a table of all user profiles from the `/users` collection.
    [ ] Include a UI control (e.g., toggle switch) to modify the `isAuthorized` boolean field for each user.

## Phase 2: Core Data Models & Admin Interfaces

[ ] Define the primary data structures and build the administrative interfaces for managing them.

### Feature: Administrative Dashboard (Core Structure)

[ ] Define `OnboardingStage` schema in Firestore, including `name`, `order`, and `color`.
[ ] Define `School` schema in Firestore with fields for name, contact info, and relationships to stages and users.
[ ] Define `Meeting` schema in Firestore with fields for type, time, and links to a school.
[ ] Define `MediaAsset` schema in Firestore for storing metadata about uploaded files and links.
[ ] Define `Survey` schema in Firestore, including a flexible `elements` array for questions and layout blocks.
[ ] Implement the base administrative layout (`/admin/layout.tsx`) with sidebar navigation.
[ ] Implement the main dashboard page (`/admin/page.tsx`) to fetch and display aggregated data.
[ ] Implement the draggable dashboard grid (`DashboardGrid.tsx`) to allow admins to personalize their widget layout.
    [ ] Persist user-specific widget order to the `dashboardLayouts/{userId}` collection in Firestore.
[ ] Implement the school management page (`/admin/schools` route) with a data table for all schools.
[ ] Implement the meeting management page (`/admin/meetings` route) with a data table for all meetings.
[ ] Implement the media library page (`/admin/media` route) with a grid view for all media assets.
[ ] Implement the survey management page (`/admin/surveys` route) with a data table for all surveys.
[ ] Implement the pipeline Kanban board (`/admin/pipeline` route).
    [ ] Render columns based on `OnboardingStage` documents.
    [ ] Render school cards within their respective stage columns.
    [ ] Implement drag-and-drop functionality to update a school's `stage` field in Firestore.

### Feature: Activity Timeline

[ ] Define the `Activity` schema in Firestore to log significant system and user events.
[ ] Implement a centralized `logActivity` server action (`src/lib/activity-logger.ts`) as the sole entry point for creating new activity logs.
[ ] Implement the global activity feed UI (`/admin/activities` route) to display all logs chronologically.
[ ] Implement a school-specific activity view (e.g., `NotesSection.tsx`) to be embedded in the school details modal.
[ ] Implement server actions (`updateNote`, `deleteNote`) to allow users to edit or delete their own `'note'` type activities, governed by Firestore security rules.

## Phase 3: Generative AI & Content Automation

[ ] Integrate generative AI capabilities to automate content creation and data analysis tasks for administrators.

### Feature: Generative AI Abstraction

[ ] Define Zod schemas for the inputs and outputs of all AI flows (`GenerateSurveyInputSchema`, `GetLinkMetadataOutputSchema`, etc.).
[ ] Configure the global Genkit AI instance (`/src/ai/genkit.ts`).
[ ] Implement the `generateSurvey` flow to create a complete survey structure from a text prompt or URL.
[ ] Implement the UI for AI survey generation (`/admin/surveys/new/ai`).
[ ] Implement the `getLinkMetadata` flow to fetch and parse metadata (`title`, `description`, `imageUrl`) from a given URL.
[ ] Integrate the `getLinkMetadata` flow into the "Add Link" functionality in the media library to pre-fill asset details.
[ ] Implement the `generateSurveySummary` flow to analyze all responses for a given survey and produce an HTML summary.
[ ] Implement the `querySurveyData` flow to answer a user's natural language question about a set of survey responses.
[ ] Implement the AI analysis UI (`AISummariesView.tsx`) on the survey results page to trigger AI summaries and Q&A.

## Phase 4: Public-Facing Features & User Interaction

[ ] Build the public-facing interfaces that allow users (parents, staff, respondents) to interact with the data managed by administrators.

### Feature: Dynamic Onboarding Pages

[ ] Create dynamic Next.js routes for different meeting types (e.g., `/meetings/parent-engagement/[schoolSlug]`).
[ ] Implement the `SchoolMeetingLoader` client component.
    [ ] Fetch the `School` document based on the `schoolSlug` from the URL.
    [ ] Fetch all associated `Meeting` documents for that school.
    [ ] Filter and sort meetings on the client to find the most relevant one (soonest upcoming or most recent past).
[ ] Implement hero components (`MeetingHero`, `KickoffMeetingHero`) with time-based logic.
    [ ] Display a countdown timer before the meeting starts.
    [ ] Disable the "Join Meeting" button until 5 minutes before the meeting.
    [ ] After 2 hours have passed, display an "ended" message.
    [ ] If a `recordingUrl` is present, display a "Watch Meeting Recording" button that links to the recording section.
[ ] Implement the `JoinMeetingForm` to capture attendee names and write them to the `/meetings/{meetingId}/attendees` subcollection in Firestore.
[ ] Implement the `RecordingSection` component, which is conditionally rendered only when a `recordingUrl` is available in the `Meeting` document.

### Feature: Survey Engine

[ ] Implement the public survey page (`/surveys/[slug]` route).
    [ ] Fetch the survey document where `slug` matches the URL and `status` is 'published'.
[ ] Implement the `SurveyDisplay` and `SurveyForm` components.
    [ ] Dynamically render form fields based on the survey's `elements` array.
    [ ] Implement client-side logic to handle conditional visibility and requirements based on `SurveyLogicBlock` rules.
[ ] On form submission, create a new document in the `/surveys/{surveyId}/responses` subcollection containing the user's answers.
[ ] Implement the post-submission "Thank You" page display.
