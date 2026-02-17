
# Feature: PDF Generation Pipeline

## Purpose

To programmatically generate a new, non-interactive PDF document by taking user-submitted data and drawing it onto the original PDF template at the coordinates defined during field mapping.

## Actors

- **System (Cloud Function):** A server-side function that performs the PDF mutation.
- **Public User:** The user whose submission triggers the pipeline.

## Entry Points

- **Event Trigger:** This pipeline is initiated immediately after a user successfully submits a form via the "Public PDF Form Engine".
- **Function Call:** The form submission logic calls a dedicated server-side function (e.g., a Cloud Function named `generateFilledPdf`).

## Data Model

This feature consumes data from other models and produces a binary file.

- **Input:**
  - `pdfId` (string): The ID of the original `PDFForm` document.
  - `submissionData` (object): A key-value map where keys are field IDs and values are the user's submitted data (text or a data URI for signatures).
- **Process:**
  - Fetches the original `PDFForm` document from `/pdfs/{pdfId}` to get the `storagePath` and `fieldMapping`.
  - Fetches the original PDF file from Firebase Storage.
- **Output:**
  - A new PDF file (`.pdf` binary).
  - This file is saved to a new path in Firebase Storage, typically `/submissions/{pdfId}/{submissionId}.pdf`.

## Workflow

1.  A user submits their data through the public form.
2.  The client-side submission handler calls the `generateFilledPdf` Cloud Function, passing the `pdfId` and the submission data.
3.  The Cloud Function authenticates the request (e.g., as a callable function).
4.  It fetches the corresponding `PDFForm` document from Firestore to retrieve the `storagePath` of the original PDF and the `fieldMapping` array.
5.  It downloads the original PDF file from Firebase Storage into its memory.
6.  It loads the PDF file using the `pdf-lib` library.
7.  It iterates through the `fieldMapping` array. For each field:
    - It finds the corresponding data from the `submissionData` object.
    - It calculates the exact pixel-based `x` and `y` coordinates on the PDF page based on the stored percentage values and the actual page dimensions.
    - **For 'text' or 'date' fields:** It uses `pdf-lib`'s `drawText` method to write the user's text at the calculated position.
    - **For 'signature' fields:** It decodes the signature's data URI (PNG), embeds it into the PDF as an image resource, and uses `drawImage` to place it at the calculated position.
8.  After drawing all fields, the function saves the modified PDF as a new byte array.
9.  It uploads this new byte array to a designated "submissions" path in Firebase Storage.
10. It returns the `storagePath` or `downloadUrl` of the newly generated PDF.
11. The original client-side submission handler receives this URL and saves it as part of the `Submission` document in Firestore.

## Business Rules

- The generation process must be server-side to prevent tampering.
- The coordinate system must be percentage-based to ensure accurate placement regardless of the PDF's native resolution.
- Generated PDFs are immutable and stored separately from the original templates.
- Signature data must be handled as image data (e.g., transparent PNG) to be embedded correctly.

## Integrations

- **Firebase Cloud Functions:** The execution environment for the PDF generation logic.
- **Firebase Firestore:** The source for PDF templates and field mapping information.
- **Firebase Storage:** Used for retrieving the original PDF and storing the final, generated PDF.
- **`pdf-lib`:** A server-side JavaScript library used for parsing, modifying, and creating PDF documents.
- **Public PDF Form Engine:** The feature that triggers this pipeline upon successful form submission.

## State Changes

- **Create:** A new binary PDF file is created and saved in Firebase Storage.
- This feature *indirectly* leads to a state change in Firestore when the calling function saves the generated PDF's URL to a `Submission` document.

## Files Involved

- `functions/src/index.ts` (or similar): A file within a Cloud Functions directory containing the `generateFilledPdf` function.
- `pdf-lib` (npm package): A key dependency for the server-side logic.

## What This Feature Does NOT Do

- It does not have a user interface.
- It does not handle the collection of user data (this is done by the public form).
- It does not store any submission metadata in Firestore (this is the responsibility of the calling function).

## Extension Guidelines

- To support a new field type (e.g., 'checkbox'), the `generateFilledPdf` function must be updated with logic to draw the new type. For a checkbox, this might involve drawing a pre-defined checkmark symbol (e.g., a checkmark character from a standard font or a small embedded image) at the field's location.
- To change the font or style of the drawn text, the `drawText` calls within the function would need to be modified to use custom fonts, which would need to be embedded into the function's deployment package.
