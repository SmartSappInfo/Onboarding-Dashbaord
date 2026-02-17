
# SYSTEM EXECUTION ROADMAP

## Phase 1: Foundation & Identity Layer
[x] Define core user identity and establish secure access control mechanisms.

### Feature: Authentication & User Management
[x] Implement user signup, login, and authorization workflows.

## Phase 2: Core Data Models & Admin Interfaces
[x] Define primary data structures and build administrative UIs.

### Feature: Doc Signing (Management)
[x] Define `PDFForm` schema in Firestore.
[x] Implement the document management page (`/admin/pdfs`).
[x] Implement file upload to Firebase Storage.

## Phase 3: Document Rendering & Interaction Layer
[x] Build the client-side capabilities for visually editing and filling documents.

### Feature: Doc Signing (Editing & Filling)
[x] Integrate `pdfjs-dist` for client-side PDF rendering into image components.
[x] Implement the visual field mapping editor (`/admin/pdfs/[id]/edit`).
    [x] Create a three-panel layout with a field list, a PDF viewer, and a properties inspector.
    [x] Develop draggable and resizable overlay components for form fields.
    [x] Implement logic to calculate and store field coordinates as percentages.
[x] Implement an interactive preview modal for real-time testing.
[x] Implement the public-facing route at `/forms/[pdfId]`.
[x] Develop the public rendering engine with an HTML overlay for interactive fields.
[x] Create the signature capture modal.

## Phase 4: Server-Side Processing & Automation
[x] Implement backend logic for content generation, analysis, and document processing.

### Feature: Doc Signing (Backend & AI)
[x] Implement the `generateFilledPdf` server action.
    [x] Integrate the `pdf-lib` library for PDF manipulation.
    [x] Implement logic to draw text and signature images onto the PDF.
    [x] Implement logic to save the final PDF to Storage and create a submission record in Firestore.
[x] Implement the `detectPdfFields` Genkit flow for AI-assisted field detection.
[x] Integrate the AI flow into the PDF Field Mapping editor.

## Phase 5: Public-Facing Features & User Interaction (Other)
[x] Build other public-facing interfaces like meeting pages and surveys.

### Feature: Dynamic Onboarding Pages
[x] Implement dynamic meeting pages based on school and meeting type.

### Feature: Survey Engine
[x] Implement the public survey-taking experience.
