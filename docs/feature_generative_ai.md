
# Feature: Generative AI Abstraction

## Purpose

To provide a structured and centralized system for interacting with Google's Generative AI models via the Genkit framework. This feature enables the application to automate content creation and data analysis tasks requested by administrators.

## Actors

- **Administrator:** The user who initiates an AI-powered action through the UI.
- **System (Genkit Flow):** The server-side code that orchestrates the interaction with the AI model.

## Entry Points

- **AI Survey Generation:** An administrator uses the "Create Survey with AI" feature at `/admin/surveys/new/ai`.
- **AI Survey Analysis:** An administrator clicks the "Generate AI Summary" or uses the "Interactive AI Analysis" form on the survey results page.
- **Link Metadata Fetching:** The system automatically triggers this flow when an administrator adds a new asset of type 'link' via the media library.
- **AI PDF Field Detection:** An administrator clicks the "Auto-detect Fields" button in the PDF field mapping editor at `/admin/pdfs/[id]/edit`.

## Data Model

This feature acts as a processor for other models and relies on Zod schemas for defining strict input and output structures for each AI interaction.

- **`GenerateSurveyInputSchema` / `GenerateSurveyOutputSchema`:** Defines the shape for creating a `Survey` object from text/URL.
- **`GenerateSurveySummaryInputSchema` / `GenerateSurveySummaryOutputSchema`:** Defines the `survey` and `responses` as input and expects an HTML `summary` as output.
- **`QuerySurveyDataInputSchema` / `QuerySurveyDataOutputSchema`:** Defines `survey`, `responses`, and a `query` as input and expects an HTML `answer` as output.
- **`GetLinkMetadataInputSchema` / `GetLinkMetadataOutputSchema`:** Defines a `url` as input and expects `title`, `description`, and `imageUrl`.
- **`DetectPdfFieldsInputSchema` / `DetectPdfFieldsOutputSchema`:** Defines a PDF file (as a data URI) and an optional prompt as input, and expects an array of field objects with `type`, `pageNumber`, and percentage-based `position` and `dimensions` as output.

## Workflow

1.  A client component calls an exported server-side function (e.g., `generateSurvey`).
2.  The server-side function calls the corresponding Genkit flow (e.g., `generateSurveyFlow(input)`).
3.  The flow uses a pre-defined Genkit prompt object containing input/output Zod schemas and a Handlebars template.
4.  Genkit sends a structured request to the configured Google AI model (e.g., 'gemini-2.5-flash'). The output schema instructs the model on the desired JSON structure.
5.  The flow receives the structured output from the model.
6.  The flow then performs a state change, such as creating a new document in Firestore or returning data to the client.
7.  The client component receives the result and updates the UI accordingly.

**Special Case: AI PDF Field Detection**
- An admin clicks "Auto-detect Fields" in the PDF editor.
- The client sends the PDF file's data URI to the `detectPdfFields` server function.
- The `detectPdfFieldsFlow` is invoked.
- The flow passes the PDF data to a Genkit prompt.
- The prompt instructs the Gemini model to analyze the PDF's visual layout and identify potential form fields (text inputs, signature areas, etc.).
- The model returns a JSON array of suggested field locations, types, and percentage-based coordinates.
- The client receives this array and displays the suggested fields as temporary overlays on the editor, which the admin can then confirm, edit, or delete.

## Business Rules

- All AI interactions must have their inputs and outputs defined by Zod schemas.
- The global `ai` object in `src/ai/genkit.ts` is the single source for defining all Genkit prompts and flows.
- Flows that accept external content (like a URL or file) are responsible for fetching/processing that content server-side before passing it to the AI prompt.
- Handlebars templates are used for prompt templating; no logic is executed within the template itself.
- For PDF field detection, the AI's role is purely assistive. Its suggestions are never saved automatically and require explicit admin confirmation.

## Integrations

- **Genkit Framework:** The core framework for defining and executing AI flows.
- **Google AI (Gemini):** The underlying Large Language Model provider.
- **Zod:** Used for all schema definitions.
- **Firebase Firestore:** Flows often write their results to other collections (e.g., `surveys`, `media`).
- **PDF Field Mapping Feature:** The AI field detection results are consumed by the PDF editor UI.
- **Admin Dashboard Feature:** The UI for triggering these flows resides within the admin dashboard.

## State Changes

- **Create `Survey`:** The `generateSurveyFlow` creates a new document in the `/surveys` collection.
- **Create `SurveySummary`:** The `generateSurveySummaryFlow` and `querySurveyDataFlow` create new documents in the `/surveys/{surveyId}/summaries` subcollection.
- **Create `MediaAsset`:** The `getLinkMetadataFlow` provides data used to create a 'link' asset in `/media`.
- **No Direct State Change by PDF Detection:** The `detectPdfFieldsFlow` does not directly modify state; it returns a data structure to the client for the admin to act upon.

## Files Involved

- `src/ai/genkit.ts`: Configures the global Genkit instance.
- `src/ai/flows/generate-survey-flow.ts`: Implements logic for creating a survey.
- `src/ai/flows/generate-survey-summary-flow.ts`: Implements logic for summarizing survey responses.
- `src/ai/flows/query-survey-data-flow.ts`: Implements logic for answering questions about survey data.
- `src/ai/flows/get-link-metadata-flow.ts`: Implements logic for extracting metadata from a URL.
- `src/ai/flows/detect-pdf-fields-flow.ts`: Implements logic for analyzing a PDF and suggesting form field placements.
- `src/app/admin/surveys/components/ai-survey-generator.tsx`: Client UI for AI survey creation.
- `src/app/admin/surveys/[id]/results/components/ai-summaries-view.tsx`: Client UI for interactive survey Q&A.
- `src/app/admin/media/components/add-link-button.tsx`: Client component that invokes metadata fetching.
- `src/app/admin/pdfs/[id]/edit/components/FieldMapper.tsx`: Client component that will contain the button to trigger AI field detection.

## What This Feature Does NOT Do

- It does not interact directly with the client's browser environment. All flows are server-side.
- It does not manage its own data persistence beyond writing results to other features' collections.
- It does not handle image generation or other non-text-based AI tasks (in its current implementation).
- The PDF field detection does not automatically save or publish fields; it only provides suggestions.

## Extension Guidelines

- To add a new AI feature, create a new file in `src/ai/flows/` named `<feature-name>-flow.ts`.
- Within the new file, define Zod schemas for the flow's input and output.
- Define a new `ai.definePrompt` with the schemas and a Handlebars template.
- Define a new `ai.defineFlow` that calls the prompt.
- Export a server-side wrapper function that client components can call to trigger the flow.
- Import the new flow file in `src/ai/dev.ts` for its side effects.
- Create a new client component in the admin dashboard to provide a UI for the new feature.
