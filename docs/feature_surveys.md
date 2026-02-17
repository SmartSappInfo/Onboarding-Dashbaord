
# Feature: Survey Engine

## Purpose

To provide administrators with the capability to create, manage, and publish surveys, and to provide the public with an interface to respond to them. The feature also includes tools for analyzing submission data.

## Actors

- **Administrator:** Creates, edits, publishes, and analyzes surveys.
- **Public User (Respondent):** Navigates to a survey URL and submits a response.

## Entry Points

- **Survey Management:** `/admin/surveys` - An admin can view all existing surveys.
- **Survey Creation (Manual):** `/admin/surveys/new` - An admin uses a multi-step form builder.
- **Survey Creation (AI):** `/admin/surveys/new/ai` - An admin provides text or a URL to have a survey generated.
- **Survey Editing:** `/admin/surveys/[id]/edit` - An admin modifies an existing survey.
- **Survey Results:** `/admin/surveys/[id]/results` - An admin views responses and analytics.
- **Public Survey Form:** `/surveys/[slug]` - A respondent accesses the live survey.

## Data Model

This feature uses a primary collection with two subcollections:

- **Collection: `/surveys`**
  - **Document ID:** Auto-generated ID.
  - **Schema (`Survey`):**
    - `title`, `description`, `slug`, `bannerImageUrl` (string, optional)
    - `status` (enum string: 'draft', 'published', 'archived')
    - `createdAt`, `updatedAt` (ISO string)
    - `thankYouTitle`, `thankYouDescription` (string, optional)
    - `elements` (array of objects): A JSON array representing the survey structure. Each object is a `SurveyElement` (question, layout block, or logic block) with its own defined schema.

- **Subcollection: `/surveys/{surveyId}/responses`**
  - **Document ID:** Auto-generated ID.
  - **Schema (`SurveyResponse`):**
    - `surveyId` (string)
    - `submittedAt` (ISO string)
    - `answers` (array of objects): Each object contains `questionId` and `value`.

- **Subcollection: `/surveys/{surveyId}/summaries`**
  - **Document ID:** Auto-generated ID.
  - **Schema (`SurveySummary`):**
    - `summary` (HTML string): The AI-generated summary text.
    - `createdAt` (ISO string)
    - `prompt` (string, optional): The user prompt that generated this summary.

## Workflow

1.  **Creation:** An admin chooses to create a survey manually or with AI.
    -   **Manual:** They are guided through a 4-step process (`Stepper` component) to define details, build the form (`SurveyFormBuilder`), customize the thank-you page, and set publishing options.
    -   **AI:** They provide content, which triggers the `generateSurveyFlow`. The result is used to create a new 'draft' survey document, and the admin is redirected to the edit page to make adjustments.
2.  **Building:** The `SurveyFormBuilder` component allows admins to add, remove, reorder (drag-and-drop), and configure `SurveyElement` objects in the `elements` array. Changes are managed via `react-hook-form` and `useFieldArray`.
3.  **Publishing:** To make a survey live, an admin sets its `status` to 'published' and ensures it has a unique `slug`.
4.  **Responding:** A public user navigates to `/surveys/[slug]`.
    -   The `PublicSurveyPage` fetches the survey document from Firestore `where('slug', '==', slug)` and `where('status', '==', 'published')`.
    -   If found, the `SurveyDisplay` component renders the live `SurveyForm`.
    -   The `SurveyForm` dynamically generates form fields based on the `elements` array. It also interprets `SurveyLogicBlock` elements to conditionally show/hide/require other elements based on user answers.
    -   Upon submission, the form data is compiled into an `answers` array and a new document is created in the `/surveys/{surveyId}/responses` subcollection.
5.  **Analysis:** An admin navigates to the results page.
    -   They can view all individual submissions in a table (`ResponsesListView`).
    -   They can view auto-generated charts and statistics for each question (`AnalyticsView`).
    -   They can use the AI interface (`AISummariesView`) to generate summaries or ask natural language questions about the response data, which creates documents in the `summaries` subcollection.

## Business Rules

-   A survey is only publicly accessible if its `status` is 'published'.
-   A survey `slug` must be unique for the survey to be accessible. The edit/new forms check for slug uniqueness on submission.
-   Conditional logic (`logic` blocks) only allows forward-jumping; a user cannot be sent back to a previous question.
-   Validation rules (e.g., `isRequired`, `minLength`) are defined in the survey's `elements` array and enforced on the client-side `SurveyForm`.

## Integrations

-   **Firebase Firestore:** The primary data store for all survey, response, and summary documents.
-   **Firebase Storage:** Used for the 'file-upload' question type to store uploaded files.
-   **Generative AI Feature:** Used for survey creation and analysis.
-   **dnd-kit Library:** Used for drag-and-drop reordering of questions in the `SurveyFormBuilder`.

## State Changes

-   **Create/Update:** `Survey` documents are created or updated in the `/surveys` collection.
-   **Create:** `SurveyResponse` documents are created in the `/surveys/{surveyId}/responses` subcollection upon public submission.
-   **Create:** `SurveySummary` documents are created in the `/surveys/{surveyId}/summaries` subcollection when an admin uses AI analysis.

## Files Involved

-   **Admin-Side:**
    -   `src/app/admin/surveys/new/page.tsx`: Manual multi-step survey creation form.
    -   `src/app/admin/surveys/[id]/edit/page.tsx`: The same multi-step form, but for editing an existing survey.
    -   `src/app/admin/surveys/components/survey-form-builder.tsx`: The core UI for adding and managing survey elements.
    -   `src/app/admin/surveys/components/question-editor.tsx`: Renders the editor UI for a single question or layout block.
    -   `src/app/admin/surveys/[id]/results/page.tsx`: The main results page with tabs for different views.
    -   `src/app/admin/surveys/[id]/results/components/*`: The components for each results tab (list, analytics, AI).
-   **Public-Side:**
    -   `src/app/surveys/[slug]/page.tsx`: The server component that fetches the survey data.
    -   `src/app/surveys/[slug]/components/survey-display.tsx`: The main wrapper for the public survey page.
    -   `src/app/surveys/[slug]/components/survey-form.tsx`: The client component that renders the live form, handles user input, and processes conditional logic.

## What This Feature Does NOT Do

-   It does not authenticate respondents. All public submissions are anonymous.
-   It does not handle payment processing or integration with other systems as part of a response.
-   It does not provide real-time updates on the results page; an admin must refresh to see new responses.

## Extension Guidelines

-   To add a new question type, update the `SurveyQuestion['type']` enum and add its editor UI to `question-editor.tsx` and its renderer UI to `survey-form.tsx`.
-   To add a new logic action, update the `SurveyLogicAction['type']` enum and implement its effect in the `useEffect` hook within `survey-form.tsx`.
-   To add a new analytics chart, create a new chart component and add it to the `AnalyticsView` component, ensuring it receives the necessary `responses` and `survey` data to perform its calculations.
