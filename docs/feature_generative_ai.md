
# Feature: Generative AI Abstraction

## Purpose

To provide a structured and centralized system for interacting with Google's Generative AI models via the Genkit framework. This feature enables the application to automate content creation and data analysis tasks requested by administrators.

## Actors

- **Administrator:** The user who initiates an AI-powered action through the UI.
- **System (Genkit Flow):** The server-side code that orchestrates the interaction with the AI model.

## Entry Points

- **AI Survey Generation:** An administrator uses the "Create Survey with AI" feature at `/admin/surveys/new/ai`.
- **AI Survey Analysis:** An administrator clicks the "Generate AI Summary" or uses the "Interactive AI Analysis" form on the survey results page (`/admin/surveys/[id]/results`).
- **Link Metadata Fetching:** The system automatically triggers this flow when an administrator adds a new asset of type 'link' via the "Add Link" button in the media library.

## Data Model

This feature does not own a primary data model but rather acts as a processor for other models. It relies heavily on Zod schemas for defining the strict input and output structures for each AI interaction.

- **`GenerateSurveyInputSchema` / `GenerateSurveyOutputSchema`:** Defines the shape of the data for creating a survey from text/URL. The output is a complete `Survey` object structure.
- **`GenerateSurveySummaryInputSchema` / `GenerateSurveySummaryOutputSchema`:** Defines the `survey` and `responses` objects as input and expects an HTML string `summary` as output.
- **`QuerySurveyDataInputSchema` / `QuerySurveyDataOutputSchema`:** Defines the `survey`, `responses`, and a `query` string as input and expects an HTML string `answer` as output.
- **`GetLinkMetadataInputSchema` / `GetLinkMetadataOutputSchema`:** Defines a `url` as input and expects an object with `title`, `description`, and `imageUrl` as output.

## Workflow

1.  **Initiation:** A client component (e.g., `AiSurveyGenerator`) calls an exported server-side function (e.g., `generateSurvey` from `generate-survey-flow.ts`).
2.  **Flow Execution:** The server-side function receives the input and calls the corresponding Genkit flow (e.g., `generateSurveyFlow(input)`).
3.  **Prompt Definition:** The flow uses a pre-defined Genkit prompt object (e.g., `generationPrompt`). This object contains:
    -   A `name` for the prompt.
    -   Input and output Zod schemas (`input.schema`, `output.schema`).
    -   A Handlebars template string (`prompt`) that structures the instructions and data for the AI model.
4.  **AI Model Invocation:** The prompt object is called with the input data. Genkit sends a structured request to the configured Google AI model (e.g., 'gemini-2.5-flash'). The Zod output schema instructs the model to return a JSON object that conforms to the defined structure.
5.  **Response Handling:** The flow receives the structured output from the model.
6.  **Action/State Change:** The flow then performs a state change, such as creating a new `Survey` document in Firestore, saving a `SurveySummary`, or returning data to the client.
7.  **Client Update:** The client component receives the result (or confirmation) and updates the UI accordingly (e.g., redirecting to the new survey's edit page, displaying the AI-generated answer).

**Special Case: Link Metadata**
-   When a URL is submitted via the "Add Link" form, the `getLinkMetadata` flow is called.
-   It uses `fetch` to retrieve the HTML of the target URL.
-   It then passes the HTML content to the `metadataExtractionPrompt`, which extracts the title, description, and image URL.
-   The `AddLinkButton` component then uses this extracted metadata to enrich the new `MediaAsset` document it creates in Firestore.

## Business Rules

-   All AI interactions must have their inputs and outputs defined by Zod schemas to ensure type safety and predictable model behavior.
-   The global `ai` object in `src/ai/genkit.ts` is the single source for defining all Genkit prompts and flows.
-   Flows that accept external content (like a URL) are responsible for fetching that content server-side before passing it to the AI prompt.
-   Handlebars templates are used for prompt templating; no logic is executed within the template itself.

## Integrations

-   **Genkit Framework:** The core framework for defining and executing AI flows.
-   **Google AI (Gemini):** The underlying Large Language Model provider.
-   **Zod:** Used for all schema definitions.
-   **Firebase Firestore:** Flows often write their results to Firestore collections (e.g., `surveys`, `media`, `surveySummaries`).
-   **Admin Dashboard Feature:** The UI for triggering these flows resides entirely within the admin dashboard.

## State Changes

-   **Create `Survey`:** The `generateSurveyFlow` creates a new document in the `/surveys` collection.
-   **Create `SurveySummary`:** The `generateSurveySummaryFlow` and `querySurveyDataFlow` create new documents in the `/surveys/{surveyId}/summaries` subcollection.
-   **Create `MediaAsset`:** The `getLinkMetadataFlow` provides data that is used to create a new 'link' type document in the `/media` collection.

## Files Involved

-   `src/ai/genkit.ts`: Configures the global Genkit instance and sets the default model.
-   `src/ai/flows/generate-survey-flow.ts`: Implements the logic for creating a survey from text or a URL.
-   `src/ai/flows/generate-survey-summary-flow.ts`: Implements the logic for generating a high-level summary of all survey responses.
-   `src/ai/flows/query-survey-data-flow.ts`: Implements the logic for answering a natural language question about survey data.
-   `src/ai/flows/get-link-metadata-flow.ts`: Implements the logic for extracting metadata from a webpage URL.
-   `src/app/admin/surveys/components/ai-survey-generator.tsx`: The client-side form for the AI survey creation feature.
-   `src/app/admin/surveys/[id]/results/components/ai-summaries-view.tsx`: The client-side UI for the interactive survey Q&A feature.
-   `src/app/admin/media/components/add-link-button.tsx`: The client component that invokes the metadata fetching flow.

## What This Feature Does NOT Do

-   It does not interact directly with the client's browser environment. All flows are executed on the server.
-   It does not manage its own data persistence beyond writing results to other features' collections.
-   It does not handle image generation or other non-text-based AI tasks (in its current implementation).

## Extension Guidelines

-   To add a new AI feature, create a new file in `src/ai/flows/` named `<feature-name>-flow.ts`.
-   Within the new file, define Zod schemas for the flow's input and output.
-   Define a new `ai.definePrompt` with the schemas and a Handlebars template.
-   Define a new `ai.defineFlow` that calls the prompt.
-   Export a server-side wrapper function that client components can call to trigger the flow.
-   Import the new flow file in `src/ai/dev.ts` for its side effects.
-   Create a new client component in the admin dashboard to provide a UI for the new feature.
