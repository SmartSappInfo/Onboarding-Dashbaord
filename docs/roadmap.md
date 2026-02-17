
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
[ ] Implement the draggable dashboard grid (`DashboardGrid.tsx`).
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
[ ] Implement a centralized `logActivity` server action (`src/lib/activity-logger.ts`) as the sole entry point.
[ ] Implement the global activity feed UI (`/admin/activities` route).
[ ] Implement a school-specific activity view (`NotesSection.tsx`) to be embedded in the school details modal.
[ ] Implement server actions (`updateNote`, `deleteNote`) to allow users to edit or delete their own `'note'` type activities.

### Feature: Dynamic PDF Forms (Management)
[*] Define `PDFForm` schema in Firestore, including `name`, `storagePath`, `status`, and `fieldMapping`.
[*] Implement the PDF form management page (`/admin/pdfs` route) with a data table for all PDF forms.
[*] Implement the file upload mechanism to Firebase Storage for new PDFs.

## Phase 3: Document Rendering & Interaction Layer

[ ] Build the client-side capabilities for visually editing and filling documents.

### Feature: Dynamic PDF Forms (Editing & Filling)
[ ] Integrate PDF.js library for client-side PDF rendering in the admin UI.
[ ] Implement the visual field mapping editor (`/admin/pdfs/[id]/edit`).
    [ ] Create a canvas-based interface to display PDF pages.
    [ ] Develop draggable and resizable overlay components for form fields.
    [ ] Implement logic to calculate and store field coordinates and dimensions as percentages.
    [ ] Create a toolbar for selecting and adding new field types (text, signature, date).
    [ ] Implement the save mechanism to update the `fieldMapping` array in the `PDFForm` document.
[ ] Implement the public-facing route at `/forms/[pdfId]`.
[ ] Develop the public rendering engine that combines a PDF.js base layer with an HTML overlay for interactive fields.
[ ] Implement real-time state synchronization to show a live preview of user input on the form.
[ ] Create the signature capture modal and component using a library like `react-signature-canvas`.


## Phase 4: Server-Side Processing & Automation

[ ] Implement backend logic for content generation, analysis, and document processing.

### Feature: Generative AI Abstraction
[ ] Define Zod schemas for the inputs and outputs of all AI flows.
[ ] Configure the global Genkit AI instance (`/src/ai/genkit.ts`).
[ ] Implement the `generateSurvey` flow.
[ ] Implement the `getLinkMetadata` flow.
[ ] Implement the `generateSurveySummary` flow.
[ ] Implement the `querySurveyData` flow.

### Feature: Dynamic PDF Forms (Backend & AI)
[ ] Implement the `detectPdfFields` Genkit flow.
    [ ] Instruct the AI model to analyze a PDF's visual layout and return field suggestions.
    [ ] Ensure the output is a structured JSON array with percentage-based coordinates.
[ ] Integrate the `detectPdfFields` flow into the PDF Field Mapping editor via an "Auto-detect" button.
[ ] Create a server-side Cloud Function (`generateFilledPdf`).
[ ] Integrate the `pdf-lib` library for PDF manipulation.
[ ] Implement logic to fetch the original PDF from Storage and its `fieldMapping` from Firestore.
[ ] Develop the core logic to draw text and signature images onto the PDF canvas based on percentage-based coordinates.
[ ] Implement logic to save the final, mutated PDF to a `/submissions` path in Firebase Storage.
[ ] Secure the function to be callable only from the application.
[ ] Implement the client-side submission handler for public PDF forms.
    [ ] The handler will first call the `generateFilledPdf` Cloud Function.
    [ ] On success, it will create a new document in the `/pdfs/{pdfId}/submissions` subcollection.
    [ ] This new document will store the user's raw input and the URL of the generated PDF.
    [ ] Implement the post-submission "Thank You" page display.


## Phase 5: Public-Facing Features & User Interaction

[ ] Build the public-facing interfaces that allow end-users to interact with the data managed by administrators.

### Feature: Dynamic Onboarding Pages
[ ] Create dynamic Next.js routes for different meeting types (e.g., `/meetings/parent-engagement/[schoolSlug]`).
[ ] Implement the `SchoolMeetingLoader` client component.
    [ ] Fetch the `School` document based on the `schoolSlug`.
    [ ] Fetch all associated `Meeting` documents for that school and filter on the client.
[ ] Implement time-based logic in hero components (countdown, ended message, recording button).
[ ] Implement the `JoinMeetingForm` to capture attendee names.
[ ] Implement the `RecordingSection` component, conditionally rendered when a `recordingUrl` is available.

### Feature: Survey Engine
[ ] Implement the public survey page (`/surveys/[slug]` route).
[ ] Implement `SurveyDisplay` and `SurveyForm` components to dynamically render form fields.
[ ] Implement client-side logic for conditional visibility based on `SurveyLogicBlock` rules.
[ ] On form submission, create a new document in the `/surveys/{surveyId}/responses` subcollection.
