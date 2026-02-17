
# Feature: PDF Form Management

## Purpose

To allow administrators to upload, view, manage the lifecycle, and configure interactive PDF documents that can be filled out and signed by public users.

## Actors

- **Administrator:** The user who manages all aspects of the PDF forms.

## Entry Points

- **UI Route:** An administrator navigates to the `/admin/pdfs` route to view and manage all PDF forms.
- **UI Action:** An administrator clicks an "Upload PDF" button, which opens a file selection dialog.
- **UI Action:** An administrator clicks "Edit" on a specific PDF to access the field mapping editor.
- **UI Action:** An administrator clicks "Publish" or "Archive" to change the status of a PDF form.

## Data Model

This feature uses both Firestore for metadata and Firebase Storage for file binaries.

- **Firestore Collection:** `/pdfs`
  - **Document ID:** Auto-generated unique ID.
  - **Schema (`PDFForm`):**
    - `id` (string): The document ID.
    - `name` (string): The user-defined name for the form.
    - `originalFileName` (string): The name of the file upon upload.
    - `storagePath` (string): The full path to the PDF file in Firebase Storage (e.g., `pdfs/123-abc.pdf`).
    - `downloadUrl` (string): The public URL to access the PDF from Firebase Storage.
    - `status` (enum string): The current state of the form. Possible values: `draft`, `published`, `archived`.
    - `fieldMapping` (array): An array of field definition objects. Managed by the "PDF Field Mapping" feature.
    - `createdAt` (ISO string): Timestamp of creation.
    - `updatedAt` (ISO string): Timestamp of the last update.

- **Firebase Storage:**
  - **Path:** `/pdfs/{unique_id}-{original_filename}.pdf` for original uploaded PDFs.
  - **Path:** `/submissions/{pdfId}/{submissionId}.pdf` for generated, filled PDFs.

## Workflow

1.  **Upload:** An admin selects a PDF file from their local machine. The client uploads the file directly to a designated path in Firebase Storage.
2.  **Document Creation:** Upon successful upload, the system creates a new document in the `/pdfs` collection in Firestore. This document includes the `storagePath` and `downloadUrl` returned by Firebase Storage. The initial `status` is set to `draft`.
3.  **Configuration:** The admin is redirected to the field mapping editor (`/admin/pdfs/[id]/edit`), where they define the interactive fields. This is handled by the "PDF Field Mapping" feature.
4.  **Publishing:** Once configured, the admin changes the form's status to `published`. This makes the form accessible via its public URL.
5.  **Viewing:** Admins can view a list of all PDFs, their statuses, and submission counts on the `/admin/pdfs` page.
6.  **Archiving/Deleting:** An admin can archive a form (making it inaccessible to the public but keeping its data) or delete it entirely, which removes the Firestore document and the corresponding file from Firebase Storage.

## Business Rules

- Only authenticated administrators can access this feature.
- A PDF form must have a `status` of `published` to be accessible to the public.
- Deleting a PDF form is a hard delete and also removes the file from Firebase Storage.

## Integrations

- **Firebase Firestore:** The source of truth for all PDF metadata and field configurations.
- **Firebase Storage:** Stores the actual PDF file binaries.
- **Authentication:** Restricts all management actions to authorized administrators.
- **PDF Field Mapping:** The core configuration step within this feature's lifecycle.
- **Activity Timeline:** Logs key events like `pdf_uploaded` and `pdf_published`.

## State Changes

- **Create:** A new document is created in the `/pdfs` collection. A new file is created in Firebase Storage.
- **Update:** The `status`, `name`, or other metadata fields of a `/pdfs` document can be updated.
- **Delete:** A document in `/pdfs` is deleted. The corresponding file in Firebase Storage is deleted.

## Files Involved

- `src/app/admin/pdfs/page.tsx`: The main data table view for listing and managing all PDF forms.
- `src/app/admin/pdfs/components/UploadPDFButton.tsx`: The client component handling the file selection and upload process to Firebase Storage.
- `src/lib/pdf-actions.ts`: Server actions for creating, updating, and deleting PDF form documents in Firestore.

## What This Feature Does NOT Do

- It does not handle the visual placement of fields on the PDF (see "PDF Field Mapping").
- It does not process or render the public-facing form (see "Public PDF Form Engine").
- It does not generate the final, filled PDF (see "PDF Generation Pipeline").

## Extension Guidelines

- To add a new metadata field to a PDF form (e.g., `category`), update the `PDFForm` type in `src/lib/types.ts` and add a corresponding input field to the PDF settings UI.
- To introduce a new lifecycle status (e.g., `needs_review`), update the `status` enum and adjust the UI and security rules to handle the new state.
