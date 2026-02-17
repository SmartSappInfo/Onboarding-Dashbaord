
# Feature: Public PDF Form Engine

## Purpose

To provide a public, no-login-required interface for users to view an interactive PDF, fill in its fields, provide a signature, and submit their data.

## Actors

- **Public User:** Any user with the direct link to the form.

## Entry Points

- **UI Route:** A user navigates to a public URL, typically `/forms/[pdfId]`, where `pdfId` is the unique identifier of a published `PDFForm`.

## Data Model

This feature consumes the `PDFForm` data model and produces a `Submission` data object.

- **Consumed:** `PDFForm` document from `/pdfs/{pdfId}`. It uses the `downloadUrl` to fetch the PDF and the `fieldMapping` to build the form.
- **Produced (on submit):**
  - **Submission Data (client-side):** A key-value object where keys are field IDs from the `fieldMapping` and values are the user's input. For signatures, the value is a base64-encoded PNG data URI.
  - **Submission Document (server-side):** After generation, a document is created in the `/pdfs/{pdfId}/submissions` subcollection with fields like `submittedAt`, `formData` (the user's input), and `generatedPdfUrl`.

## Workflow

1.  A user accesses the public URL (`/forms/[pdfId]`).
2.  The client-side component fetches the `PDFForm` document from Firestore. If the form is not `published` or does not exist, it displays a "Not Found" page.
3.  The component uses PDF.js to render the PDF specified by the `downloadUrl` onto a base `<canvas>` layer.
4.  It then creates an HTML overlay on top of the PDF canvas.
5.  It iterates through the `fieldMapping` array from the `PDFForm` document. For each field object, it dynamically creates and positions an interactive HTML element (`<input>`, `<textarea>`, or a signature pad component) on the overlay.
6.  The position and dimensions of these HTML elements are calculated using the percentage-based values from the field mapping, ensuring they perfectly align with the visual PDF underneath.
7.  **Real-Time Preview:** As the user types into an input field, the component uses a second, temporary `<canvas>` layer to draw the user's text directly onto it, providing an immediate visual preview of how the final PDF will look.
8.  **Signature Capture:** When a user interacts with a signature field, a modal containing a signature pad component (`react-signature-canvas`) appears. The user draws their signature, and upon saving, the canvas content is converted into a transparent PNG data URI and stored in the form's state.
9.  **Submission:** The user clicks the "Submit" button.
10. The client validates that all required fields are filled.
11. It packages the form state into the `submissionData` object.
12. It calls the `generateFilledPdf` Cloud Function, passing the `pdfId` and `submissionData`.
13. Upon receiving the URL of the newly generated PDF from the Cloud Function, it creates a new document in the `/pdfs/{pdfId}/submissions` subcollection in Firestore, saving the user's input and the URL to the final document.
14. It displays a "Thank You" message to the user.

## Business Rules

- Only `published` PDF forms are accessible to the public.
- The coordinate system for rendering the overlay MUST be percentage-based to match the way it's stored.
- Signature pads must produce a transparent background PNG to avoid obscuring the PDF.
- All submission data is first used to generate the final PDF; only then is the submission record saved in Firestore.

## Integrations

- **Firebase Firestore:** To fetch the form structure and save the final submission record.
- **Firebase Cloud Functions:** To trigger the `generateFilledPdf` pipeline.
- **PDF.js:** A client-side library for rendering the base PDF layer.
- **react-signature-canvas (or similar):** A component for capturing user signatures.
- **PDF Generation Pipeline:** The server-side feature that this engine triggers upon submission.

## State Changes

- **Create:** A new document is created in the `/pdfs/{pdfId}/submissions` subcollection for each successful submission.
- This feature also triggers the creation of a new file in Firebase Storage via the PDF Generation Pipeline.

## Files Involved

- `src/app/forms/[pdfId]/page.tsx`: The main page component for the public form.
- `src/app/forms/[pdfId]/components/PdfFormRenderer.tsx`: The core client component that handles rendering the PDF, the interactive overlay, and form state.
- `src/app/forms/[pdfId]/components/SignaturePadModal.tsx`: The modal component for capturing signatures.
- `src/lib/pdf-actions.ts`: A server actions file containing the logic to create the final submission document in Firestore.

## What This Feature Does NOT Do

- It does not allow editing of the PDF layout or fields.
- It does not generate the final PDF itself (it triggers a separate pipeline).
- It does not require user authentication.

## Extension Guidelines

- To support a new field type, the `PdfFormRenderer.tsx` component must be updated to render the new HTML input element (e.g., a set of checkboxes). Its state management logic must also be updated to handle the new field's data structure.
- To add client-side validation rules beyond "required," logic can be added to the `PdfFormRenderer.tsx` component that checks the form state before enabling the submit button.
