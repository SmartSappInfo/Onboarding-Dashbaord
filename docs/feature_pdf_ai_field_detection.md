
# Feature: AI-Assisted PDF Field Detection

## Purpose

To automate the tedious process of manually placing form fields on a PDF by using a generative AI model to analyze the document's layout and suggest the location, size, and type of potential input fields.

## Actors

- **Administrator:** The user who initiates the auto-detection process within the PDF Field Mapping editor.
- **System (Genkit Flow):** The server-side AI flow that processes the PDF and returns field suggestions.

## Entry Points

- **UI Action:** An administrator clicks the "Auto-detect Fields" button within the Field Mapper UI located at the `/admin/pdfs/[id]/edit` route.

## Data Model

This feature does not own a data model but produces a data structure that is consumed by the PDF Field Mapping feature.

- **Input (`DetectPdfFieldsInputSchema`):** An object containing the PDF file encoded as a data URI (`pdfDataUri`).
- **Output (`DetectPdfFieldsOutputSchema`):** An array of `FieldSuggestion` objects. Each object contains:
  - `type` (enum: 'text', 'signature', 'date'): The AI's best guess for the field type.
  - `pageNumber` (number): The page number on which the field was detected.
  - `position` (object): An object with `x` and `y` coordinates, stored as percentages relative to the page dimensions.
  - `dimensions` (object): An object with `width` and `height`, stored as percentages relative to the page dimensions.

## Workflow

1.  The administrator is in the PDF Field Mapping editor.
2.  They click the "Auto-detect Fields" button.
3.  The client-side component sends the PDF file (as a data URI) to the `detectPdfFields` server action.
4.  The server action invokes the `detectPdfFieldsFlow`.
5.  The flow passes the PDF data URI to a Genkit prompt specifically designed for visual analysis.
6.  The prompt instructs the Gemini model to act as a document analysis expert, identify common form field patterns (lines, boxes, text labels), and return a structured JSON array of field suggestions. The model is explicitly told to use percentage-based coordinates.
7.  The flow receives the structured JSON output from the model.
8.  The server action returns the array of field suggestions to the client.
9.  The `FieldMapper.tsx` component receives the suggestions and renders them as temporary, non-interactive overlays on the PDF canvas.
10. The administrator can then review each suggestion, choosing to accept (which creates a real, editable field), modify, or discard it.

## Business Rules

- The AI's role is strictly assistive. No fields are created or saved without explicit administrator confirmation.
- The AI must return coordinates and dimensions as percentages (float values between 0 and 1) to ensure responsiveness.
- The feature is designed to be a time-saver, not a perfect solution. It may not detect all fields or may suggest incorrect types/locations.

## Integrations

- **Generative AI Abstraction:** This feature is implemented as a flow within the broader Genkit AI system.
- **PDF Field Mapping:** The primary consumer of this feature's output. The suggestions are rendered within the field mapping editor.
- **Firebase Storage:** The original PDF is assumed to be stored in Firebase Storage, but the AI flow itself interacts with a data URI representation of the file.

## State Changes

- This feature does not directly cause any persistent state changes in the database. It is a read-only analysis process that returns data to the client. Any state changes (i.e., saving the fields) are performed by the PDF Field Mapping feature after the administrator confirms the suggestions.

## Files Involved

- `src/ai/flows/detect-pdf-fields-flow.ts`: Implements the Genkit flow and prompt for interacting with the Gemini model.
- `src/app/admin/pdfs/[id]/edit/components/FieldMapper.tsx`: The client-side UI component that contains the "Auto-detect Fields" button and the logic to render the returned suggestions.

## What This Feature Does NOT Do

- It does not save any data to Firestore.
- It does not create final, interactive form fields.
- It does not read or interpret the semantic meaning of the PDF text, only the visual layout.
- It does not guarantee 100% accuracy in field detection.

## Extension Guidelines

- To improve detection, the prompt in `detect-pdf-fields-flow.ts` can be refined with more specific examples or instructions.
- To support detection of new field types (e.g., 'checkbox'), the `type` enum in the output Zod schema must be updated, and the prompt must be instructed to identify these new types. The `FieldMapper.tsx` component would also need to be updated to render the new suggestion type.
