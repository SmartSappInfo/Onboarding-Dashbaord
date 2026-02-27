
# Feature: Doc Signing (High-Fidelity PDF Forms)

## 1. High-Level Flow

The Doc Signing module is a sophisticated document management and execution system that allows administrators to transform static PDFs into interactive, secure, and branded digital forms.

**ADMIN (Authenticated)**
   ↓
Upload PDF → 3-Phase Configuration → Publish
   ↓
*Phase 1: Identity* (Branding, Logo, Theme, Internal Name)
*Phase 2: Builder* (Visual Field Mapping, AI Detection, Drag-and-Drop)
*Phase 3: Integration* (Password Security, Webhooks, Auto-Messaging)
   ↓
**PUBLIC USER (No Login)**
   ↓
Public URL → Password Gate (Optional) → Fill & Sign
   ↓
*Real-time HTML Overlay Preview* (Proportional Scaling & Centering)
   ↓
User clicks "Submit"
   ↓
*Server-Side Persistence & Activity Logging*
   ↓
User downloads Final PDF / Admin audits submission

---

## 2. Technical Architecture & Constraints

| Concern | Implementation Detail |
| :--- | :--- |
| **Typography** | **Pixel-Perfect Scaling**: Calculated as `fontSize * zoom`. Removes relative units (`em`) to ensure visual parity between design, web preview, and exported PDF. |
| **Scaling** | **Proportional (Contain)**: Signatures and Photo attachments maintain original aspect ratio. Always centered horizontally and vertically within the field box. |
| **Rendering** | `pdfjs-dist` for background layer; React-managed HTML components for interactive overlay. |
| **Generation** | `pdf-lib` (Server-Side) for drawing text and embedding image buffers. |
| **Resilience** | **LocalStorage Autosave**: Builder state is cached in real-time. Prompt-based recovery allows restoring unsaved sessions. |
| **AI Assist** | `detectPdfFields` Genkit Flow: Analyzes visual layout to suggest inputs, signatures, and primary naming fields. |

---

## 3. Data Models

### PDFForm Schema (`/pdfs/{pdfId}`)
```json
{
  "name": "Internal Form Name",
  "publicTitle": "Visible Header for Users",
  "slug": "unique-url-backhalf",
  "storagePath": "pdfs/unique-id.pdf",
  "downloadUrl": "...",
  "status": "draft" | "published" | "archived",
  "namingFieldId": "fld_id", // Used for submission titles
  "displayFieldIds": ["fld_1", "fld_2"], // Top 3 fields for list views
  "passwordProtected": true,
  "password": "...",
  "backgroundColor": "#HEX",
  "backgroundPattern": "dots" | "grid" | "circuit" | "topography" | "cubes" | "gradient" | "none",
  "fields": [
    {
      "id": "fld_1",
      "type": "text" | "signature" | "date" | "dropdown" | "phone" | "email" | "time" | "photo",
      "position": { "x": %, "y": % },
      "dimensions": { "width": %, "height": % },
      "fontSize": number,
      "alignment": "left" | "center" | "right",
      "verticalAlignment": "top" | "center" | "bottom" // Default: center
    }
  ]
}
```

---

## 4. Admin Editor Workspace

The editor is a premium, distraction-free environment organized into three distinct phases:

### Phase 1: Details
- **Identity**: Sets internal vs. public nomenclature.
- **Organization**: Links the document to a specific school.
- **Branding**: Custom logo and background theme (colors and SVG patterns).

### Phase 2: Builder
- **Canvas**: High-performance PDF rendering with custom zoom interceptors (`Ctrl+Scroll`, `Pinch`).
- **Toolbar**: Floating docker for adding 8+ field types.
- **Inspector**: Context-aware properties panel for typography, alignment, and bulk-editing (Object Alignment & Distribution).
- **History**: Robust Undo/Redo logic with programmatic state guard.

### Phase 3: Publish
- **Visibility**: Status management and URL slug configuration.
- **Security**: Global password protection.
- **Automation**: Integration with the Messaging Engine for "Submission Confirmed" alerts and Webhook dispatch.

---

## 5. Public Experience

- **Responsive Renderer**: Automatically scales to `baseScale (0.9 - 1.3)` based on device width.
- **Mobile Optimized**: On mobile, data entry is handled via a specialized `DataEntryModal` to prevent small touch-targets, while signatures/photos remain direct-on-document.
- **Legal Fidelity**: Signature capture includes Draw, Type, and Upload with explicit legal consent toggles.
- **High-Fidelity Download**: Uses a "Silent Page Renderer" to capture the finalized document as high-DPI images, ensuring the signed copy looks exactly like the filled form.
