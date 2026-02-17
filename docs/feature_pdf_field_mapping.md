
# Feature: PDF Field Mapping

## Purpose

To provide administrators with a visual interface for placing, resizing, and configuring interactive fields (like text inputs and signature boxes) onto an uploaded PDF document.

## Actors

- **Administrator:** The user who defines the interactive areas on a PDF.

## Entry Points

- **UI Route:** An administrator navigates to the `/admin/pdfs/[id]/edit` route for a specific PDF form.

## Data Model

This feature primarily operates on the `fieldMapping` property within a `PDFForm` document stored in the `/pdfs/{pdfId}` collection.

- **`fieldMapping` (array):** An array of field objects, where each object has the following schema:
  - `id` (string, client-generated unique ID)
  - `type` (enum string): The type of field. Possible values: `text`, `signature`, `date`.
  - `pageNumber` (number): The 1-based index of the page the field is on.
  - `position` (object): An object containing `x` and `y` properties.
    - `x` (number): The horizontal position of the top-left corner, as a percentage (0.0 to 1.0) of the page width.
    - `y` (number): The vertical position of the top-left corner, as a percentage (0.0 to 1.0) of the page height.
  - `dimensions` (object): An object containing `width` and `height` properties.
    - `width` (number): The width of the field, as a percentage (0.0 to 1.0) of the page width.
    - `height` (number): The height of the field, as a percentage (0.0 to 1.0) of the page height.
  - `label` (string, optional): An internal label for the field.
  - `placeholder` (string, optional): Placeholder text for text fields.

## Workflow

1.  The administrator navigates to the PDF editor page.
2.  The `FieldMapper.tsx` component fetches the `PDFForm` document, including its `fieldMapping` array.
3.  The component renders the PDF document page-by-page using the PDF.js library.
4.  For each page, it iterates through the `fieldMapping` array and renders interactive, draggable, and resizable overlays for any fields assigned to that page, converting their percentage-based coordinates to pixel values.
5.  **Adding a Field:** The admin selects a field type (e.g., 'Text') from a toolbar and clicks on the PDF canvas. A new field object with default dimensions is added to the local state and rendered.
6.  **Moving/Resizing:** The admin drags or resizes a field overlay. The component's event handlers update the `x`, `y`, `width`, and `height` properties of the corresponding field object in its local state, continuously converting pixel values back to percentages.
7.  **AI Detection (Optional):** The admin clicks "Auto-detect Fields," which triggers the AI Field Detection feature. The returned suggestions are displayed as temporary overlays that can be confirmed to create actual fields.
8.  **Saving:** The admin clicks the "Save" button. The component sends the entire updated `fieldMapping` array to the server, which updates the `PDFForm` document in Firestore.

## Business Rules

- All field positions and dimensions MUST be stored as percentages to ensure that the overlay correctly scales on different screen sizes and when the final PDF is generated.
- Field IDs must be unique within a single form.
- A PDF cannot be published unless it has at least one field defined in its `fieldMapping`.

## Integrations

- **Firebase Firestore:** Used to store the `fieldMapping` array as part of the `PDFForm` document.
- **PDF.js:** A client-side library used to render the PDF pages onto a `<canvas>` element.
- **React-dnd (or similar):** A library used to handle the drag-and-drop and resizing interactions for the field overlays.
- **AI Field Detection Feature:** Can be invoked to provide initial field suggestions, which are then managed by this feature.
- **PDF Form Management:** This feature is the configuration step within the broader PDF management lifecycle.

## State Changes

- **Update:** This feature's primary function is to update the `fieldMapping` field of a specific document in the `/pdfs/{pdfId}` collection.

## Files Involved

- `src/app/admin/pdfs/[id]/edit/page.tsx`: The main page component that loads the PDF and houses the editor.
- `src/app/admin/pdfs/[id]/edit/components/FieldMapper.tsx`: The core client component responsible for rendering the PDF, managing field overlays, and handling all user interactions.
- `src/app/admin/pdfs/[id]/edit/components/FieldToolbar.tsx`: The UI component providing tools to add new fields of different types.
- `src/lib/pdf-actions.ts`: A server actions file containing the `updatePdfForm` function to persist changes to Firestore.

## What This Feature Does NOT Do

- It does not handle the initial upload of the PDF file.
- It does not render the public-facing form for end-users to fill out.
- It does not generate the final, filled PDF document.

## Extension Guidelines

- To add a new interactive field type (e.g., 'Checkbox'):
  1.  Update the `type` enum in the `fieldMapping` schema.
  2.  Add a new tool to the `FieldToolbar.tsx` component.
  3.  Update the `FieldMapper.tsx` component to render the new field type's specific overlay.
  4.  Update the Public PDF Form Engine to correctly render and handle the new field type during filling.
  5.  Update the PDF Generation Pipeline to correctly draw the new field type on the final document.
