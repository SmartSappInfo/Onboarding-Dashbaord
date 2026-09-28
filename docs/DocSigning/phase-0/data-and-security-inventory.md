# Phase 0.2 — Data Schemas, Storage & Security Inventory

> **Module:** Document Signing & Contract Platform  
> **Status:** Phase 0 Baseline Discovery  
> **Governance:** Strict Typing (Zero `any`), Cryptographic Evidence, Tenant Isolation  

---

## 1. Firestore Collections & Schema Contracts

The document signing subsystem operates across 5 primary Firestore collections and subcollections:

```
Firestore Root
├── pdfs (Collection)
│   └── {pdfId} (Document)
│       └── submissions (Subcollection)
│           └── {submissionId} (Document)
├── contracts (Collection)
│   └── {contractId} (Document)
├── pdf_sessions (Collection)
│   └── {sessionId} (Document)
└── activities (Collection)
    └── {activityId} (Document)
```

### 1.1 `pdfs` Collection (Templates)
- **Path:** `pdfs/{pdfId}`
- **Model:** [`PDFForm`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts#L4515-L4558)
- **Tenant Scope:** `workspaceIds: string[]` (multi-tenant shared across workspaces) and optional `organizationId?: string`.
- **Field Inventory:**

| Field Name | Type | Required? | Purpose / Business Rule |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Firestore document ID. |
| `name` | `string` | Yes | Internal template name (e.g. "School Master Services Agreement"). |
| `publicTitle` | `string` | Yes | Public-facing title displayed on the signing header and SEO tags. |
| `slug` | `string` | Yes | URL-friendly identifier used in `/forms/[slug]` or `/forms/results/[slug]`. |
| `storagePath` | `string` | Yes | Cloud Storage path to the base PDF template file (e.g. `pdfs/{uuid}/{filename}.pdf`). |
| `downloadUrl` | `string` | Yes | Public or signed URL for the client `pdfjs-dist` canvas to fetch bytes. |
| `status` | `'draft' \| 'published' \| 'archived'` | Yes | Determines access. Only `'published'` allows public access in `/forms/[pdfId]`. |
| `fields` | `PDFFormField[]` | Yes | Array of field definitions and bounding coordinates. |
| `isContractDocument` | `boolean` | No | Flag indicating that submission triggers legal contract status sync. |
| `passwordProtected` | `boolean` | No | If true, recipient must enter `password` before viewing or signing. |
| `password` | `string` | No | Plaintext password used when `passwordProtected: true`. |
| `workspaceIds` | `string[]` | Yes | Workspaces permitted to edit, view, or dispatch this template. |
| `organizationId` | `string` | No | Organization tenant ID for branding and enterprise isolation. |
| `confirmationMessagingEnabled` | `boolean` | No | If true, sends automated confirmation message upon finalization. |
| `confirmationTemplateId` | `string` | No | Email template ID used for the confirmation message. |
| `confirmationSenderProfileId` | `string` | No | Sender profile used to dispatch the confirmation email. |
| `adminAlertsEnabled` | `boolean` | No | If true, dispatches team alert upon signature. |
| `adminAlertChannels` | `Array<'email' \| 'sms' \| 'whatsapp'>` | No | Channels to dispatch alerts to. |
| `resultsShared` | `boolean` | No | Enables public audit results portal (`/forms/results/[slug]`). |
| `resultsPassword` | `string` | No | Password required to unlock the results portal. |

---

### 1.2 `PDFFormField` Schema (Coordinates & Typography)
- **Model:** [`PDFFormField`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts#L4560-L4580)
- **Coordinate System:** Normalized percentage-based coordinates relative to the rendered page viewport (`0` to `100`).

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique field identifier (e.g., `field_1711234567_abc`). |
| `label` | `string` | Display label in inspector and form error summaries. |
| `type` | `string` | Supported: `text`, `dropdown`, `date`, `time`, `phone`, `email`, `static-text`, `variable`, `signature`, `photo`. |
| `position` | `{ x: number, y: number }` | Top-left corner coordinates as a percentage of page width and height (`0%` to `100%`). |
| `dimensions` | `{ width: number, height: number }` | Bounding box dimensions as a percentage of page width and height. |
| `pageNumber` | `number` | 1-indexed page number where the field appears. |
| `required` | `boolean` | Validation constraint. Must be populated before finalization. |
| `fontSize` | `number` | Font point size (defaults to 11pt; dynamically scaled by zoom factor). |
| `alignment` | `'left' \| 'center' \| 'right'` | Horizontal text alignment. |
| `verticalAlignment`| `'top' \| 'center' \| 'bottom'` | Vertical text alignment inside bounding box. |
| `color` | `string` | Hex color code (defaults to `#000000`). |
| `bold` | `boolean` | Applies bold font weight. |
| `italic` | `boolean` | Applies oblique font style. |
| `underline` | `boolean` | Draws underline rule under rendered text. |
| `textTransform` | `'none' \| 'uppercase' \| 'capitalize'` | Text casing transform rule. |
| `options` | `string[]` | Select options for `type: 'dropdown'`. |
| `staticText` | `string` | Fixed content for `type: 'static-text'`. |
| `variableKey` | `string` | Dynamic CRM token key for `type: 'variable'` (e.g. `school_name`). |

---

### 1.3 `pdfs/{pdfId}/submissions` Subcollection (Executed Records)
- **Path:** `pdfs/{pdfId}/submissions/{submissionId}`
- **Model:** [`Submission`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts#L4582-L4590)

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Firestore document ID. |
| `pdfId` | `string` | Parent template identifier. |
| `submittedAt` | `string` | ISO 8601 UTC timestamp of execution. |
| `status` | `'submitted' \| 'partial'` | `'submitted'` for executed agreements; `'partial'` for draft progress saves. |
| `formData` | `Record<string, any>` | Key-value dictionary mapping `field.id` to string values or signature data URLs. |
| `entityId` | `string \| null` | Unified entity ID (customer, school, or contact). |
| `entityType` | `string \| null` | Entity type identifier (e.g., `'institution'`, `'family'`, `'person'`). |

---

### 1.4 `contracts` Collection (Agreement Lifecycle)
- **Path:** `contracts/{contractId}`
- **Model:** [`Contract`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/types.ts#L4592-L4607)
- **Status Enum:** `'no_contract' | 'draft' | 'sent' | 'partially_signed' | 'signed' | 'expired'`

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Firestore document ID. |
| `entityId` | `string` | Linked customer entity ID. |
| `entityName` | `string` | Denormalized entity name snapshot. |
| `pdfId` | `string` | Linked PDFForm template ID. |
| `pdfName` | `string` | Denormalized template name. |
| `status` | `ContractStatus` | Current lifecycle state. |
| `submissionId` | `string \| undefined`| Linked submission document ID in `pdfs/{pdfId}/submissions`. |
| `sentAt` | `string \| undefined`| ISO timestamp of dispatch. |
| `signedAt` | `string \| undefined`| ISO timestamp of execution. |
| `workspaceId` | `string` | Tenant workspace bounding this agreement. |
| `recipients` | `Array<{ name: string, email?: string, phone?: string, type: string }>` | Designated signatories. |

---

## 2. Storage Buckets & Artifact Locations

| Artifact | Storage Mechanism | Location Path | Access Controls | Risk / Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Original PDF Template** | Firebase Cloud Storage | `pdfs/{pdfId}/{filename}.pdf` | Read: public (via `downloadUrl`); Write: authenticated admins | Public bucket URL readable by anyone with URL. |
| **Signature Assets** | Inline in Firestore | `submission.formData[fieldId]` as `data:image/png;base64,...` | Read: authenticated admins or results viewer | **Critical Technical Debt (R-08)**: Bloats Firestore documents up to 500KB+ per signature; violates 1MB limit. |
| **Signed Completed PDF** | Ephemeral / Dynamically Generated | Generated on-the-fly by `pdf-lib` in `/api/pdfs/[pdfId]/generate/[submissionId]` or client screenshot via `html2canvas` | Streamed over HTTP response | No permanent immutable storage archive; discrepancy between server vector and client screenshot. |
| **Evidence / Audit Trail** | Partial in Firestore | `activities` collection | Read: workspace members | No cryptographic digest (SHA-256) of document bytes stored. |

---

## 3. Authorization Matrix & Tenant Isolation

```mermaid
graph TD
    User([User Request]) --> Gate{Public or Authenticated?}
    Gate -->|Public /forms/[pdfId]| CheckPublished{Template status === 'published'?}
    CheckPublished -->|No| Reject404[Return 404 / notFound]
    CheckPublished -->|Yes| CheckPassword{passwordProtected?}
    CheckPassword -->|Yes| GatePassword[PasswordGatedForm]
    CheckPassword -->|No| SignView[PdfFormRenderer]

    Gate -->|Admin /admin/pdfs| CheckAuth{requireAuth() & requireWorkspace()}
    CheckAuth -->|No| RejectAuth[Redirect to Sign-in]
    CheckAuth -->|Yes| CheckRBAC{canUser(userId, module, action)}
    CheckRBAC -->|No| RejectForbidden[Return Permission Denied]
    CheckRBAC -->|Yes| AdminStudio[Allow Template Edit / Dispatch]
```

### 3.1 Permission Rules by Role

| Action / Surface | Anonymous Public | Authenticated Portal Member | Workspace Team Member | Workspace Admin / Manager | System Admin |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **View Template Studio** | Denied | Denied | Permitted (`finance.agreements.view`) | Permitted | Full |
| **Edit / Save Fields** | Denied | Denied | Denied | Permitted (`finance.agreements.edit`) | Full |
| **Dispatch Agreement** | Denied | Denied | Denied | Permitted (`finance.agreements.create`) | Full |
| **Sign Document (`/forms/[pdfId]`)** | Permitted (if published) | Permitted | Permitted | Permitted | Full |
| **View Audit Results** | Permitted (if shared + password) | Permitted | Permitted | Permitted | Full |
| **Purge Contract & Submission** | Denied | Denied | Denied | Permitted (`contracts_delete`) | Full |

---

## 4. Threat Model & Vulnerability Register

| ID | Vulnerability / Threat | Current Implementation Vector | Exploitation Scenario | Severity | Required Mitigation (Phase 1/2) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T-01** | Insecure Direct Object Reference (IDOR) | `/forms/[pdfId]?entityId=school_123` | An attacker alters the `entityId` query parameter to view and execute agreements for another institution. | **Critical** | Sign signing links with HMAC-SHA256 (`/sign/[token]`). Tokens bind `pdfId`, `contractId`, and `recipientId` with expiration. |
| **T-02** | Tampering of Executed Document | No cryptographic hash (SHA-256) stored. | A party edits the downloaded PDF using Adobe Acrobat Pro and claims differing terms in legal arbitration. | **Critical** | Compute SHA-256 digest of original and executed PDF; record hash in an append-only evidence record and Certificate of Completion. |
| **T-03** | Concurrent Finalization Race | No distributed lock or transaction check. | Signer clicks "Finalize" twice rapidly, causing duplicate submissions and redundant email dispatches. | **High** | Wrap finalization in a Firestore `runTransaction` with an idempotency key (`${contractId}_finalize`). |
| **T-04** | Firestore Document Size Exhaustion | Base64 PNGs stored directly in Firestore document. | Multi-signer or multi-photo documents exceed the 1MB Firestore document limit, failing write operations. | **High** | Upload signature PNGs to Firebase Storage (`signatures/{contractId}/{recipientId}.png`); store only storage path and hash in Firestore. |
| **T-05** | Credential & Password Exposure | Form passwords stored in plaintext in Firestore (`pdfForm.password`). | Anyone with read access to Firestore can see form passwords. | **Medium** | Hash form passwords using bcrypt or argon2 before storage. |

---

## 5. P0.2 Acceptance Sign-Off

- [x] Firestore collections, schemas, and coordinate models documented.
- [x] Storage paths, signature storage debt, and artifact locations identified.
- [x] Authorization matrix across public and authenticated roles mapped.
- [x] Threat model cataloged with actionable mitigations for Phases 1–2.
- [x] File committed locally to git.
