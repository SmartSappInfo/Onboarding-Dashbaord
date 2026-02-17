
# Feature: Dynamic PDF Forms

## Purpose

To provide a complete, end-to-end system for administrators to upload PDF documents, visually map interactive fields onto them, publish them for public access, and for end-users to fill out and sign these forms, resulting in a finalized, flattened PDF document. This feature automates the entire lifecycle of a PDF form, from creation to submission and generation.

## Actors

- **Administrator:** The user who manages all aspects of the PDF forms, including upload, field mapping, AI-assisted field detection, and publishing.
- **Public User:** Any user with the direct link to a published form who can fill it out and sign it without needing to log in.
- **System (Cloud Function & Genkit Flow):** Server-side processes that handle the final PDF generation and optional AI field detection.

## Entry Points

- **Management:** An administrator navigates to `/admin/pdfs` to view and manage all PDF forms.
- **Upload:** An administrator clicks an "Upload PDF" button, which opens a file selection dialog.
- **Field Mapping:** An administrator navigates to `/admin/pdfs/[id]/edit` to use the visual field editor.
- **AI-Assisted Detection:** An administrator clicks the "Auto-detect Fields" button within the field mapping editor.
- **Publishing:** An administrator changes the status of a PDF form to `published`.
- **Public Access:** A public user navigates to a public URL, typically `/forms/[pdfId]`.
- **Submission:** A public user clicks the "Submit" button on the form, triggering the server-side PDF generation pipeline.

## Data Model

This feature uses both Firestore for metadata and Firebase Storage for file binaries.

- **Firestore Collection: `/pdfs`**
  - **Document ID:** Auto-generated unique ID.
  - **Schema (`PDFForm`):**
    - `id` (string): The document ID.
    - `name` (string): The user-defined name for the form.
    - `originalFileName` (string): The name of the file upon upload.
    - `storagePath` (string): The full path to the original PDF file in Firebase Storage.
    - `downloadUrl` (string): The public URL to access the original PDF from Firebase Storage.
    - `status` (enum string): `draft`, `published`, `archived`.
    - `createdAt` (ISO string): Timestamp of creation.
    - `updatedAt` (ISO string): Timestamp of the last update.
    - **`fieldMapping` (array):** An array of field definition objects, each with:
      - `id` (string): Client-generated unique ID.
      - `type` (enum string): `text`, `signature`, `date`.
      - `pageNumber` (number): The 1-based index of the page.
      - `position` (object): `{ x: number, y: number }` stored as percentages (0.0 to 1.0).
      - `dimensions` (object): `{ width: number, height: number }` stored as percentages (0.0 to 1.0).

- **Firestore Subcollection: `/pdfs/{pdfId}/submissions`**
  - **Document ID:** Auto-generated unique ID.
  - **Schema (`Submission`):** Stores `submittedAt`, `formData`, and `generatedPdfUrl`.

- **Firebase Storage**
  - **Original Templates:** `/pdfs/{unique_id}-{original_filename}.pdf`
  - **Generated Submissions:** `/submissions/{pdfId}/{submissionId}.pdf`

## Workflow

1.  **Upload & Management:** An admin uploads a PDF to Firebase Storage. A new `PDFForm` document is created in Firestore with `status: 'draft'`, containing the `storagePath` and `downloadUrl`.
2.  **Field Mapping:** The admin navigates to the editor (`/admin/pdfs/[id]/edit`). The `FieldMapper.tsx` component renders the PDF using PDF.js. The admin adds, moves, and resizes field overlays. All positions and dimensions are calculated and stored as percentages of the page size to ensure responsiveness.
3.  **AI Field Detection (Optional):** The admin can click "Auto-detect Fields". This triggers the `detectPdfFields` Genkit flow. The flow sends the PDF's data URI to the Gemini model, which analyzes the layout and returns a JSON array of suggested field locations and types (e.g., text, signature), also using percentage-based coordinates. The editor displays these as temporary suggestions for the admin to confirm or discard.
4.  **Publish:** The admin changes the form's status to `published`.
5.  **Public Filling:** A user accesses the public URL (`/forms/[pdfId]`). The `PdfFormRenderer.tsx` component fetches the PDF and its `fieldMapping`. It renders the PDF onto a `<canvas>` and creates an HTML overlay with interactive inputs (`<input>`, signature pads) positioned precisely using the stored percentages.
6.  **Submission & Generation:** Upon submission, the client calls a server-side Cloud Function (`generateFilledPdf`), passing the form data. This function uses the `pdf-lib` library. It fetches the original PDF template, iterates through the `fieldMapping`, and draws the user's submitted text and signature images onto a new PDF at the exact percentage-based coordinates.
7.  **Storage:** The newly generated, filled PDF is uploaded to `/submissions/...` in Firebase Storage. The function returns the new file's URL. The client then creates a new submission document in the `/pdfs/{pdfId}/submissions` subcollection, storing the user's input and the URL to the final, generated PDF.

## Business Rules

- Only authenticated administrators can manage PDF forms.
- A PDF form must have a status of `published` to be publicly accessible.
- All field positions and dimensions MUST be stored as percentages to ensure accurate rendering on any screen size.
- The AI's field detection role is purely assistive; its suggestions are never saved automatically and require explicit admin confirmation.
- The PDF generation process is strictly server-side to prevent tampering.

## Integrations

- **Firebase Firestore:** Source of truth for all PDF metadata, field configurations, and submission records.
- **Firebase Storage:** Stores all PDF file binaries (templates and generated submissions).
- **Firebase Cloud Functions:** Provides the server-side execution environment for the `pdf-lib` generation pipeline.
- **Genkit & Google AI:** Powers the optional AI-assisted field detection.
- **PDF.js:** A client-side library used to render PDF documents in the browser for both the editor and the public form.
- **`pdf-lib`:** A server-side JavaScript library used for programmatically creating and modifying PDF documents.
- **React-dnd (or similar):** Used in the admin editor to handle drag-and-drop and resizing of field overlays.
- **`react-signature-canvas` (or similar):** Used in the public form to capture user signatures.

## State Changes

- **Create:** A new document is created in `/pdfs` upon upload. A new document is created in `/pdfs/{pdfId}/submissions` upon successful submission. A new binary file is created in Firebase Storage for each upload and each generated submission.
- **Update:** The `fieldMapping`, `status`, and other metadata fields of a `/pdfs` document are updated by the administrator.
- **Delete:** Deleting a `PDFForm` document is a hard delete and also removes the associated file from Firebase Storage.

## Files Involved

- **Management & Upload:**
  - `src/app/admin/pdfs/page.tsx`: Main data table for listing and managing PDF forms.
  - `src/app/admin/pdfs/components/UploadPDFButton.tsx`: Handles file selection and upload to Firebase Storage.
- **Field Mapping & AI:**
  - `src/app/admin/pdfs/[id]/edit/page.tsx`: The main page for the PDF editor.
  - `src/app/admin/pdfs/[id]/edit/components/FieldMapper.tsx`: The core UI for rendering the PDF and managing field overlays.
  - `src/ai/flows/detect-pdf-fields-flow.ts`: The Genkit flow for AI-assisted field detection.
- **Public Form Engine:**
  - `src/app/forms/[pdfId]/page.tsx`: The main public-facing page for filling a form.
  - `src/app/forms/[pdfId]/components/PdfFormRenderer.tsx`: Renders the PDF and the interactive HTML overlay.
  - `src/app/forms/[pdfId]/components/SignaturePadModal.tsx`: Component for capturing user signatures.
- **Generation & Actions:**
  - `functions/src/index.ts` (or similar): Contains the `generateFilledPdf` Cloud Function.
  - `src/lib/pdf-actions.ts`: Contains server actions for creating, updating, and deleting PDF data in Firestore.

## What This Feature Does NOT Do

- It does not automatically route or process the data from the submitted PDF beyond saving it.
- It does not provide an edit history or versioning for the `fieldMapping`.
- It does not have a built-in workflow for approving or rejecting submissions.

## Extension Guidelines

- To add a new field type (e.g., 'Checkbox'):
  1.  Update the `fieldMapping` schema to include the new type.
  2.  Add a new tool to the `FieldToolbar.tsx` in the admin editor.
  3.  Update `FieldMapper.tsx` to render the new field overlay.
  4.  Update `PdfFormRenderer.tsx` to render the corresponding interactive HTML element (e.g., a checkbox input).
  5.  Update the `generateFilledPdf` Cloud Function with logic to draw the new field type's state onto the final PDF (e.g., drawing a checkmark).
