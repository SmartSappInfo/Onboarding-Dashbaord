
# Feature: Doc Signing

## 1. High-Level Flow

**ADMIN (Authenticated)**
   ↓
Upload PDF → Define Fields (with AI Assist) → Publish Form
   ↓
*Firestore stores field schema & metadata*
*Storage stores the original PDF template*
   ↓
**PUBLIC USER (No Login)**
   ↓
Loads public form URL → Fills interactive fields
   ↓
*Client-side state provides a real-time overlay preview*
   ↓
User clicks "Submit"
   ↓
*Server Action generates the final, flattened PDF*
   ↓
User can download the final PDF / Admin sees submission record

---

## 2. Tech Stack Responsibilities

| Concern                 | Tool / Library         |
| ----------------------- | ---------------------- |
| Frontend Rendering      | Next.js (App Router)   |
| PDF Viewer (Client)     | `pdfjs-dist`           |
| PDF Generation (Server) | `pdf-lib`              |
| Field Layout System     | Custom React Overlay   |
| Backend State           | Firebase Firestore     |
| File Storage            | Firebase Storage       |
| Server-Side Logic       | Next.js Server Actions |
| AI Field Detection      | Genkit (Google AI)     |

---

## 3. Folder Structure

```
/app
   /admin
      /pdfs
         page.tsx              # List & manage all PDF forms
         /[id]/edit/
            page.tsx           # Main editor page
            /components/
               FieldMapper.tsx # The core drag-and-drop editor
   /forms/[pdfId]/
      page.tsx                 # Public-facing page for filling the form
      /components/
         PdfFormRenderer.tsx   # Renders the PDF and interactive inputs
         SignaturePadModal.tsx # Captures user signatures

/src
   /ai
      /flows
         /detect-pdf-fields-flow.ts # Genkit flow for AI
   /lib
      pdf-actions.ts           # Server actions (create, update, generate)
      types.ts                 # All TypeScript type definitions
```

---

## 4. Firebase Structure

### Firestore Collections

-   `/pdfs/{pdfId}`
-   `/pdfs/{pdfId}/submissions/{submissionId}`

### `PDFForm` Schema (`/pdfs/{pdfId}`)

```json
{
  "name": "Admission Form",
  "originalFileName": "admission.pdf",
  "storagePath": "pdfs/form123/original.pdf",
  "downloadUrl": "https://firebasestorage.googleapis.com/...",
  "status": "draft" | "published",
  "createdBy": "user_uid_string",
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-02T14:30:00Z",
  "fields": [
    {
      "id": "fld_1",
      "type": "text",
      "label": "Applicant Full Name",
      "pageNumber": 1,
      "position": { "x": 32.5, "y": 48.2 },
      "dimensions": { "width": 22.1, "height": 3.5 },
      "fontSize": 12,
      "required": true
    }
  ]
}
```

**CRITICAL:** Field `position` and `dimensions` **MUST** be stored as percentages (0-100) to ensure responsive rendering on different screen sizes.

### `Submission` Schema (`/pdfs/{pdfId}/submissions/{submissionId}`)

```json
{
  "submittedAt": "2024-01-03T10:00:00Z",
  "formData": {
    "fld_1": "John Doe"
  },
  "generatedPdfUrl": "https://firebasestorage.googleapis.com/..."
}
```

---

## 5. Firebase Storage Layout

-   **Original Templates**: `/pdfs/{unique_id}-{original_filename}.pdf`
-   **Generated Submissions**: `/submissions/{pdfId}/{submissionId}.pdf`

---

## 6. Admin Editor Architecture (`FieldMapper.tsx`)

-   **Layout**: The editor is a three-panel interface: a list of all fields on the left, a central canvas displaying the PDF pages, and a properties panel on the right for editing the selected field.
-   **Rendering**: The component uses `pdfjs-dist` to render each page of the PDF into an `Image` component for a stable and performant viewing experience.
-   **Field Overlays**: The interactive fields (`text`, `signature`, etc.) are React components absolutely positioned over the rendered page images.
-   **Interaction**: The `dnd-kit` library handles dragging fields, and custom logic on the resize handles calculates the new percentage-based dimensions.
-   **State Management**: Field data (`label`, `position`, `dimensions`, etc.) is managed in React state and is saved to Firestore via a server action (`updatePdfFormMapping`).
-   **AI Assist**: A button triggers the `detectPdfFields` Genkit flow, which analyzes the PDF and returns an array of suggested field locations. The editor then displays these as temporary overlays for the admin to confirm.
-   **Interactive Preview**: A "Preview" button launches a modal that shows a fully interactive, public-facing version of the form, allowing for end-to-end testing without leaving the editor.

---

## 7. Public Filling Page (`PdfFormRenderer.tsx`)

-   **Load Sequence**: The page fetches the `published` `PDFForm` document from Firestore.
-   **Rendering**: Like the editor, it renders the PDF pages as images.
-   **Interactive Overlay**: It maps over the `fields` array and renders the appropriate HTML inputs (`<input>`, `SignaturePadModal`, etc.) precisely positioned on top of the PDF images using the stored percentage values.
-   **Real-Time Preview**: Each input is bound to `react-hook-form` state. As the user types or signs, the state is updated, providing a fast, real-time preview directly in the HTML overlay without regenerating the PDF.

---

## 8. Signature Handling

The `SignaturePadModal.tsx` component manages a two-step signature capture process:

1.  **Step 1: Signature Creation**
    -   The user clicks a signature field, opening a dialog with four tabs:
        -   **Draw**: The user draws their signature on a canvas using `react-signature-canvas`.
        -   **Type**: The user types their name, which is rendered on a canvas with a cursive font.
        -   **Upload**: The user selects an image file (PNG, JPG) of their signature, which is previewed.
        -   **Take Photo**: The user's camera is activated to capture a photo of a physical signature.
    -   The user clicks "Next" to proceed.

2.  **Step 2: Confirmation**
    -   A preview of the generated signature image is displayed.
    -   A legal consent message and a toggle switch ("I consent to sign") are shown.
    -   A "Back" button allows the user to return to Step 1.
    -   The "Sign Now" button is enabled only after the user checks the consent toggle.

3.  **Finalization**
    -   Upon clicking "Sign Now", the signature is exported as a `data:image/png;base64,...` data URL.
    -   This data URL is stored in the main form's state.
    -   The signature field on the PDF renderer now displays this image.
    -   During final submission, this data URL is sent to the backend `generateFilledPdf` server action.

---

## 9. Final PDF Generation (Server Action)

A server action `generateFilledPdf` is triggered on form submission.

**Payload:**

-   `pdfId`: The ID of the form document.
-   `formData`: An object mapping field IDs to their values (e.g., `{ fld_1: "John Doe" }`).

**Workflow:**

1.  **Fetch Data**: The function loads the `PDFForm` document from Firestore and the original PDF template from Firebase Storage.
2.  **Load PDF Engine**: It initializes the `pdf-lib` library with the original PDF's buffer.
3.  **Draw Fields**: It iterates through the `formData`. For each field:
    -   It looks up the field's properties (`position`, `dimensions`, `pageNumber`) from the `fields` array.
    -   It **converts percentage coordinates to PDF points**, flipping the Y-axis (`y = pageHeight - (y_percent * pageHeight)`).
    -   For text fields, it uses `page.drawText()`.
    -   For signature fields, it embeds the PNG data URL using `page.drawImage()`.
4.  **Save & Upload**: The modified PDF is saved as a `Uint8Array` and uploaded to the `submissions/{pdfId}/{submissionId}.pdf` path in Firebase Storage.
5.  **Record Submission**: The function gets the `downloadUrl` of the new PDF and creates a new document in the `/pdfs/{pdfId}/submissions` collection containing the `formData` and the `generatedPdfUrl`.
6.  **Return URL**: The function returns the URL of the newly created, finalized PDF to the client.

---

## 10. AI Field Detection (Genkit Flow)

-   **Flow**: `detectPdfFields`
-   **Input**: The PDF file as a data URI string.
-   **Process**: The flow sends the PDF data to the Gemini model with a prompt instructing it to identify potential form fields (inputs, signature lines, date fields).
-   **Output**: The model returns a structured JSON array of suggested fields, including `type`, `pageNumber`, and percentage-based `position` and `dimensions`.
-   **Integration**: The admin editor receives this array and renders the suggestions as temporary overlays, which the admin can then accept, modify, or delete before saving.

---

## 11. Security Rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pdfs/{pdfId} {
      // Public can read a published form to fill it out.
      // Admins can read any form.
      allow get: if resource.data.status == 'published' || isAuthorized();
      
      // Admins can list, create, and update forms.
      allow list, write: if isAuthorized();

      // Rules for the submissions subcollection
      match /submissions/{submissionId} {
        // Anyone can create a submission for a published document.
        allow create: if get(/databases/$(database)/documents/pdfs/$(pdfId)).data.status == 'published';
        
        // Only admins can read submission records.
        allow read, list: if isAuthorized();

        // Submissions are immutable once created.
        allow update, delete: if false;
      }
    }
  }
}
```
