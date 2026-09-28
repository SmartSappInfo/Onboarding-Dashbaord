# Document Signing Phase 1: Integrity, Unified Vector PDF & Idempotent Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the document signing pipeline into an authoritative, tamper-evident, deterministic system by eliminating client-side `html2canvas` screenshotting in favor of server-side vector PDF generation, offloading signatures to Cloud Storage, issuing cryptographic SHA-256 Certificates of Completion, wrapping finalization in an idempotent Firestore transaction, formally wiring CRM deal lifecycle events, and providing a no-code Backoffice Operations Dock for managing contracts and envelopes.

**Architecture:** 
1. **Authoritative Vector PDF Pipeline**: Server-side vector rendering via `pdf-lib` and font subsetting, eliminating `html2canvas` and client raster memory spikes.
2. **Signature Storage Offloading**: Raw base64 data URLs stripped from Firestore and persisted in Cloud Storage at `signatures/{workspaceId}/{contractId}/{recipientId}.png`, storing immutable SHA-256 digests in Firestore.
3. **Cryptographic Integrity & Evidence Ledger**: Append-only execution records (`signing_evidence` collection) calculating pre-sign and post-sign SHA-256 fingerprints, rendered onto a 1-page vector **Certificate of Completion** with verification QR code.
4. **Transactional Idempotent Finalization**: Atomic `adminDb.runTransaction()` ensuring single-execution semantics, status locking (`status !== 'signed'`), and direct emission of `deal.contract.signed` on the CRM event bus.
5. **No-Code Backoffice Operations Dock**: Real-time envelope tracker, one-click Resend Link, Void/Cancel with audit justification, Expiry Extension, and Document Verification Console (`/verify/[envelopeId]`).
6. **Mobile Ergonomics & Minimal UI English**: $44\times 44\text{px}$ touch targets, Emil Kowalski spring micro-interactions (`active:scale-[0.97]`), 16px input typography to prevent iOS Safari auto-zoom, and simple, plain everyday English copy.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (Strict, Rule 4 Zero-`any`), `pdf-lib`, Firebase Admin Firestore & Cloud Storage, Vitest, Zod, Tailwind CSS, Lucide React, `qrcode`.

---

## 1. Failure Modes & Edge Cases Register ("What Could Go Wrong & Resolutions")

| Risk ID | Potential Failure Mode | Root Cause | Impact | Engineering Mitigation in Phase 1 |
| :--- | :--- | :--- | :--- | :--- |
| **FM-01** | **Client Memory Exhaustion / Browser Crash** | `html2canvas` rendering high-DPI canvases across multi-page PDFs on iOS Safari. | Crash/freeze during download; user cannot retrieve signed contract. | **Resolution:** Replace with direct streaming vector PDF from `/api/pdfs/[pdfId]/generate/[submissionId]`. Zero client canvas memory footprint; native streaming. |
| **FM-02** | **Firestore 1MB Document Size Exceeded** | Signatures captured via camera/canvas stored as raw inline base64 in `submissions.formData`. | Write fails with `INVALID_ARGUMENT: Document exceeds maximum allowed size (1048576 bytes)`. | **Resolution:** `signature-storage-service.ts` offloads images to Cloud Storage. Firestore stores only short storage URIs and SHA-256 digests (~120 bytes). |
| **FM-03** | **Concurrent Finalization / Duplicate Dispatch Race** | Signer double-clicks "Finalize Agreement" or experiences network retry. | Multiple submissions created, duplicate emails/SMS dispatched, duplicate CRM deal events emitted. | **Resolution:** `finalizeAgreementAction` wrapped in `adminDb.runTransaction()` with precondition check: if `status === 'signed'`, return idempotent cached response without executing side effects. |
| **FM-04** | **Unwired CRM Deals Event Disconnection** | Legacy `finalizeAgreementAction` never invoked `emitDealDomainEvent`. | Deals stay in "Contract Sent" stage; probability never updates to 100%. | **Resolution:** Formally wire `emitDealDomainEvent('deal.contract.signed', ...)` inside transaction post-commit hook. |
| **FM-05** | **Mobile Auto-Zoom Trapping** | Input font size $< 16\text{px}$ triggers automatic iOS Safari viewport zoom, breaking document layout. | Distorted view, fields offscreen, user frustration. | **Resolution:** Strict `text-base` (`16px`) font size on all mobile inputs, select triggers, and date pickers. |
| **FM-06** | **Non-Standard PDF Geometry Distortion** | Field percentages rendered against fixed A4 coordinates instead of page's actual media box. | Misplaced signatures on Letter, Legal, or Landscape pages. | **Resolution:** Extract actual media box per page via `page.getSize()`. Calculate coordinates dynamically relative to each page's specific dimensions. |
| **FM-07** | **Silent Error Swallowing in Finalization** | Legacy code wrapped `generatePdfBuffer` in empty `catch (_err) {}`. | Incomplete emails sent without PDF attachments, undetected failures. | **Resolution:** Remove empty catch blocks; implement structured server-side logging with transaction rollback on critical artifact generation errors. |
| **FM-08** | **Cross-Tenant or Unauthorized Document Access** | Insecure parameter tampering on public download or signing routes. | Data leak across workspaces. | **Resolution:** Token-bound capability sessions; strict workspace isolation checks in server actions and API handlers. |

---

## 2. Downstream Systems & Backoffice Management Without Code

### 2.1 Affected Subsystems Matrix
- **CRM Deals (`src/lib/deals/deal-event-bus.ts`, `src/app/actions/deal-actions.ts`)**:
  - Automatically advances deal probability to 100% and sets `contractStatus: 'signed'` upon envelope completion.
- **Automations Engine (`src/lib/automations/payload-enricher.ts`)**:
  - Submissions schema maintains `entityId`, `pdfId`, and `formData` keys. Condition evaluation nodes continue reading `formData[fieldKey]` without modification.
- **Link Shortener (`src/app/go/[linkId]/route.ts`)**:
  - Short URL token resolution routes seamlessly to `/forms/[pdfId]?entityId=...`.
- **Messaging Engine (`src/lib/messaging-actions.ts`, `messaging-engine.ts`)**:
  - Email attachments receive high-fidelity vector PDF buffers with appended Certificates of Completion.
- **SSOT Variables (`FieldsVariablesService`)**:
  - All dynamic tokens resolve through `FieldsVariablesService.resolveTemplateVariables`.

### 2.2 Backoffice Capabilities (No Code Required)
To empower operations and compliance teams to manage contracts without touching code, Phase 1 introduces the **Backoffice Operations Dock**:

1. **Envelope Operations Dock (`/admin/contracts`)**:
   - **Real-Time Status Tracker**: Real-time badge indicators: *Sent*, *Delivered*, *Opened*, *Partially Signed*, *Signed*, *Declined*, *Expired*.
   - **One-Click Resend Link**: Generates a refreshed high-entropy signing token and immediately dispatches SMS and Email reminders to the signatory.
   - **One-Click Void / Cancel**: Voids active contracts with mandatory audit justification. Immediately invalidates the public signing link.
   - **One-Click Extend Expiry**: Extends contract validity by 7, 14, or 30 days via a simple dropdown.
2. **Document & Cryptographic Verification Console (`/verify` & `/admin/documents/verify`)**:
   - Allows internal staff or external auditors to input an Envelope ID or upload a signed PDF.
   - Instantly computes SHA-256 fingerprint, matches against Firestore evidence records, and displays:
     - Document Integrity: Valid / Tampered
     - Signer Name & Verified Email/Phone
     - Exact UTC Signing Timestamp
     - Client IP Address & Device Type
     - Certificate of Completion Status

---

## 3. Strict Type System & Zod Schema Contracts (Rule 4: Zero `any`)

All types strictly eliminate `any` or `any[]`:

```typescript
// Location: src/lib/types/document-signing.ts

import { z } from 'zod';

export const RecipientRoleSchema = z.enum([
  'signer',
  'countersigner',
  'approver',
  'viewer'
]);
export type RecipientRole = z.infer<typeof RecipientRoleSchema>;

export const RecipientStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'opened',
  'signed',
  'declined'
]);
export type RecipientStatus = z.infer<typeof RecipientStatusSchema>;

export const EnvelopeStatusSchema = z.enum([
  'draft',
  'sent',
  'partially_signed',
  'completed',
  'declined',
  'voided',
  'expired'
]);
export type EnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

export const SigningRecipientSchema = z.object({
  id: z.string().min(1),
  role: RecipientRoleSchema,
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  routingOrder: z.number().int().positive(),
  status: RecipientStatusSchema,
  tokenHash: z.string(),
  tokenExpiresAt: z.string(),
  openedAt: z.string().optional(),
  signedAt: z.string().optional(),
  signatureStoragePath: z.string().optional(),
  signatureHash: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  declineReason: z.string().optional(),
});
export type SigningRecipient = z.infer<typeof SigningRecipientSchema>;

export const EvidenceAuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  action: z.enum([
    'created',
    'sent',
    'delivered',
    'opened',
    'progress_saved',
    'signed',
    'declined',
    'completed',
    'voided',
    'expired'
  ]),
  envelopeId: z.string(),
  recipientId: z.string().optional(),
  recipientEmail: z.string().optional(),
  recipientName: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  documentDigest: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type EvidenceAuditLogEntry = z.infer<typeof EvidenceAuditLogEntrySchema>;

export const CertificateDataSchema = z.object({
  envelopeId: z.string(),
  documentTitle: z.string(),
  completedAt: z.string(),
  preSignDigest: z.string(),
  finalDigest: z.string(),
  signatory: z.object({
    name: z.string(),
    email: z.string(),
    signedAt: z.string(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
  }),
  verificationUrl: z.string().url(),
});
export type CertificateData = z.infer<typeof CertificateDataSchema>;
```

---

## 4. Phase 1 Task Breakdown & Execution Plan

### Task 1: Form Validation Extraction & SSOT Consolidation (P1.1)

**Files:**
- Create: `src/lib/documents/form-validation.ts`
- Create: `src/lib/documents/__tests__/form-validation.test.ts`
- Modify: `src/app/forms/[pdfId]/components/PdfFormRenderer.tsx:61-78`
- Modify: `src/lib/__tests__/pdf-variable-resolution.baseline.test.ts:13-31`

- [ ] **Step 1: Write unit test for `generateValidationSchema` in `form-validation.test.ts`**
  - Verify mandatory text fields, optional text fields, email validation, phone minimum length (10 chars), and omission of static/variable fields.

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/form-validation.test.ts`
  - Expected: FAIL (`form-validation` not found).

- [ ] **Step 3: Implement `src/lib/documents/form-validation.ts`**
  - Pure function `generateValidationSchema(fields: PDFFormField[]): z.ZodObject<Record<string, z.ZodTypeAny>>`.
  - Add inline documentation:
    ```typescript
    /**
     * ARCHITECTURAL NOTE: Single source of truth for PDF Form runtime validation.
     * Shared across client-side interactive renderers, server actions, and automated test suites.
     * CAUTION: Modifying validation rules here directly impacts both public form submission and automated verification.
     */
    ```

- [ ] **Step 4: Update `PdfFormRenderer.tsx` and `pdf-variable-resolution.baseline.test.ts` to import `generateValidationSchema`**
  - Remove duplicate inline declarations.

- [ ] **Step 5: Run tests to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/form-validation.test.ts src/lib/__tests__/pdf-variable-resolution.baseline.test.ts`
  - Expected: PASS.

- [ ] **Step 6: Commit changes**
  - Command: `git add src/lib/documents/form-validation.ts src/lib/documents/__tests__/form-validation.test.ts src/app/forms/[pdfId]/components/PdfFormRenderer.tsx src/lib/__tests__/pdf-variable-resolution.baseline.test.ts && git commit -m "refactor(docsigning): extract generateValidationSchema to SSOT domain utility"`

---

### Task 2: Cloud Storage Signature Offloading & Asset Management (P1.3)

**Files:**
- Create: `src/lib/documents/signature-storage-service.ts`
- Create: `src/lib/documents/__tests__/signature-storage-service.test.ts`

- [ ] **Step 1: Write unit test in `signature-storage-service.test.ts`**
  - Test `isBase64DataUrl` detection.
  - Test base64 parsing, buffer conversion, Cloud Storage upload call, and SHA-256 digest calculation.

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/signature-storage-service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/documents/signature-storage-service.ts`**
  - Stream image buffer to `signatures/${workspaceId}/${contractId}/${recipientId}.${extension}` using `adminStorage.file().save()`.
  - Calculate `crypto.createHash('sha256').update(buffer).digest('hex')`.
  - Return `{ storagePath, sha256, byteSize }`.
  - Add inline architectural comment:
    ```typescript
    /**
     * ARCHITECTURAL NOTE: Prevents Firestore 1MB document bloat (Vulnerability T-04).
     * Offloads signature images to Cloud Storage while storing immutable cryptographic fingerprints.
     */
    ```

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/signature-storage-service.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/documents/signature-storage-service.ts src/lib/documents/__tests__/signature-storage-service.test.ts && git commit -m "feat(docsigning): implement signature storage offloading with sha256 digests"`

---

### Task 3: Authoritative Server-Side Vector PDF Engine (P1.1)

**Files:**
- Modify: `src/lib/pdf-actions.ts:76-200`
- Create: `src/lib/__tests__/vector-pdf-engine.test.ts`

- [ ] **Step 1: Write vector PDF engine test with valid minimal PDF fixture**
  - Create a valid minimal PDF buffer using `PDFDocument.create()`.
  - Assert that `generatePdfBuffer` overlays fields, respects dynamic coordinates, preserves page dimensions (A4, Letter), and returns a loadable vector `Buffer`.

- [ ] **Step 2: Run test to verify failure or current state**
  - Command: `pnpm test:run src/lib/__tests__/vector-pdf-engine.test.ts`
  - Expected: FAIL or PASS depending on fixture alignment.

- [ ] **Step 3: Refactor `generatePdfBuffer` in `src/lib/pdf-actions.ts`**
  - Replace `formData: { [key: string]: any }` with strict `Record<string, unknown>`.
  - Replace `(school as any)` with explicit `School & Record<string, unknown>`.
  - Calculate exact page geometry dynamically per page:
    ```typescript
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const x = (field.x / 100) * pageWidth;
    const y = pageHeight - ((field.y / 100) * pageHeight) - ((field.height / 100) * pageHeight);
    ```
  - Support signature rendering from both Cloud Storage paths and validated data URLs.
  - Return clean `Buffer`.
  - Add inline architectural comment:
    ```typescript
    /**
     * ARCHITECTURAL NOTE: Authoritative server-side vector PDF generation engine.
     * Eliminates client-side html2canvas screenshotting. Preserves exact page dimensions and text selectable glyphs.
     * CAUTION: Coordinates use percentage-based normalization relative to actual page media boxes.
     */
    ```

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/__tests__/vector-pdf-engine.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/pdf-actions.ts src/lib/__tests__/vector-pdf-engine.test.ts && git commit -m "feat(docsigning): modernize vector PDF engine with strict typing and exact geometry"`

---

### Task 4: Cryptographic Evidence Service & SHA-256 Fingerprinting (P1.4)

**Files:**
- Create: `src/lib/documents/evidence-service.ts`
- Create: `src/lib/documents/__tests__/evidence-service.test.ts`

- [ ] **Step 1: Write unit test in `evidence-service.test.ts`**
  - Test `calculateSha256Digest` with known binary buffers.
  - Test `createEvidenceRecord` writing append-only entry to `signing_evidence` collection.

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/evidence-service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/documents/evidence-service.ts`**
  - Compute SHA-256 using Node.js `crypto`.
  - Write immutable audit entries: `{ envelopeId, action, recipientId, recipientEmail, ipAddress, userAgent, documentDigest, timestamp }`.
  - Add inline architectural comment:
    ```typescript
    /**
     * ARCHITECTURAL NOTE: Tamper-evident execution ledger.
     * Every signing action records cryptographic digests and actor metadata in an append-only collection.
     */
    ```

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/evidence-service.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/documents/evidence-service.ts src/lib/documents/__tests__/evidence-service.test.ts && git commit -m "feat(docsigning): implement cryptographic evidence ledger and sha256 digests"`

---

### Task 5: Certificate of Completion Vector Generator (P1.4)

**Files:**
- Create: `src/lib/documents/audit-certificate-service.ts`
- Create: `src/lib/documents/__tests__/audit-certificate-service.test.ts`

- [ ] **Step 1: Write unit test in `audit-certificate-service.test.ts`**
  - Test appending a Certificate of Completion to an existing PDF buffer.
  - Verify page count increases from $N$ to $N + 1$.
  - Verify QR code and certificate metadata are drawn.

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/audit-certificate-service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/documents/audit-certificate-service.ts`**
  - Use `pdf-lib` and `qrcode.toDataURL` to create an elegant, high-contrast, professional A4 Certificate of Completion.
  - Render Envelope ID, Document Name, Status (Executed), Signatory Name/Email, Timestamp (UTC), IP Address, SHA-256 pre-sign digest, SHA-256 final digest, and verification QR code.
  - Add inline architectural comment:
    ```typescript
    /**
     * ARCHITECTURAL NOTE: Formal legal Certificate of Completion page appended to all executed documents.
     * Features tamper-evident SHA-256 fingerprints and scannable QR verification code.
     */
    ```

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/audit-certificate-service.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/documents/audit-certificate-service.ts src/lib/documents/__tests__/audit-certificate-service.test.ts && git commit -m "feat(docsigning): implement vector certificate of completion generator with QR code"`

---

### Task 6: Transactional Idempotent Finalization & CRM Event Wiring (P1.2)

**Files:**
- Modify: `src/lib/pdf-actions.ts:280-435`
- Create: `src/lib/__tests__/idempotent-finalization.test.ts`

- [ ] **Step 1: Write concurrency and idempotency unit tests in `idempotent-finalization.test.ts`**
  - Assert that `finalizeAgreementAction` executes atomically via `adminDb.runTransaction()`.
  - Assert that `emitDealDomainEvent('deal.contract.signed', ...)` is called.
  - Assert that subsequent parallel calls for an already signed contract return `{ success: true, submissionId, isIdempotentReplay: true }` without re-dispatching side effects.

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/__tests__/idempotent-finalization.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Refactor `finalizeAgreementAction` in `src/lib/pdf-actions.ts`**
  - Wrap database execution in `adminDb.runTransaction()`.
  - Enforce status precondition: if contract status is already `'signed'`, return idempotently.
  - Offload signatures to Cloud Storage using `uploadSignatureImage`.
  - Formally invoke `emitDealDomainEvent('deal.contract.signed', { dealId, contractId, entityId, workspaceId, submissionId })`.
  - Append Certificate of Completion to generated PDF.
  - Remove silent error swallowing: log errors with structured logging context and fail gracefully.
  - Add inline architectural comments explaining concurrency lock and transactional boundaries.

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/__tests__/idempotent-finalization.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/pdf-actions.ts src/lib/__tests__/idempotent-finalization.test.ts && git commit -m "feat(docsigning): transactional idempotent finalization with CRM deal event wiring"`

---

### Task 7: Client Vector PDF Download & `html2canvas` Elimination (P1.1 UI)

**Files:**
- Modify: `src/app/forms/results/components/SharedSubmissionView.tsx`
- Modify: `src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts`

- [ ] **Step 1: Harden API route `/api/pdfs/[pdfId]/generate/[submissionId]/route.ts`**
  - Validate authorization and return streaming vector PDF with appended Certificate of Completion.
  - Set caching headers: `Cache-Control: private, no-cache, no-store, must-revalidate`.

- [ ] **Step 2: Refactor `SharedSubmissionView.tsx`**
  - Completely remove `html2canvas` DOM screenshot loops and JPEG slicing.
  - Download directly from `/api/pdfs/${pdfForm.id}/generate/${submission.id}` via native browser stream.
  - Add an evidentiary "Certificate of Completion" verification card in the UI:
    - Status: "Executed"
    - SHA-256 Digest badge (monospaced with copy button)
    - Timestamp & Signer IP
    - QR Code verification button

- [ ] **Step 3: Verify TypeScript compiler and lint**
  - Command: `pnpm typecheck && pnpm eslint 'src/app/forms/results/components/SharedSubmissionView.tsx'`
  - Expected: 0 errors.

- [ ] **Step 4: Commit changes**
  - Command: `git add src/app/forms/results/components/SharedSubmissionView.tsx src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts && git commit -m "refactor(docsigning): replace html2canvas with direct server vector PDF download and certificate badge"`

---

### Task 8: Public Signing Portal Mobile Hardening & Double-Submit Lock (P1.2 & P1.3 UI)

**Files:**
- Modify: `src/app/forms/[pdfId]/components/PdfFormRenderer.tsx`
- Modify: `src/components/SignaturePadModal.tsx`

- [ ] **Step 1: Update `PdfFormRenderer.tsx`**
  - Implement affirmative submission lock state (`isSubmitting: boolean`).
  - Add Emil Kowalski micro-interactions:
    - Finalize button active press feedback (`active:scale-[0.97]`).
    - Spinner animation while transaction completes.
    - Prevents double-taps on mobile devices.
  - Enforce `min-h-[44px]` touch target sizing across all mobile form inputs, date selectors, checkmarks, and signature action buttons.
  - Add viewport zoom protection (`text-base` / `16px` font size on all form inputs).

- [ ] **Step 2: Update `SignaturePadModal.tsx`**
  - Optimize canvas and camera drawing surfaces for mobile portrait viewports (`touch-pan-y` without scroll conflicts).
  - Preserve camera "Scan" mode with luminance thresholding and transparent background isolation.
  - Eliminate all `any` types.

- [ ] **Step 3: Verify TypeScript compiler and lint**
  - Command: `pnpm typecheck && pnpm eslint 'src/app/forms/[pdfId]/components/PdfFormRenderer.tsx' 'src/components/SignaturePadModal.tsx'`
  - Expected: 0 errors.

- [ ] **Step 4: Commit changes**
  - Command: `git add src/app/forms/[pdfId]/components/PdfFormRenderer.tsx src/components/SignaturePadModal.tsx && git commit -m "feat(docsigning): mobile touch target hardening and double-submission protection in signing portal"`

---

### Task 9: Backoffice Operations Dock & Verification Console (P1.4 Backoffice)

**Files:**
- Create: `src/app/verify/[envelopeId]/page.tsx`
- Create: `src/app/verify/[envelopeId]/components/DocumentVerificationClient.tsx`
- Modify: `src/app/admin/contracts/ContractsClient.tsx` (Add Envelope Operations Dock: Resend, Void, Extend)

- [ ] **Step 1: Create public verification portal `/verify/[envelopeId]`**
  - Displays document authenticity, SHA-256 digests, UTC timestamps, and signer timeline.
  - Read-only, public-safe (redacts private CRM details, shows only verification evidence).

- [ ] **Step 2: Add Envelope Operations Dock to `ContractsClient.tsx`**
  - One-click **Resend Link**: dispatches fresh token via SMS/Email.
  - One-click **Void Contract**: marks status as `voided` with audit justification.
  - One-click **Extend Expiry**: extends contract validity by 7, 14, 30 days.

- [ ] **Step 3: Run unit and integration tests**
  - Command: `pnpm test:run src/lib/__tests__/*.test.ts src/lib/documents/__tests__/*.test.ts`
  - Expected: 100% pass.

- [ ] **Step 4: Commit changes**
  - Command: `git add src/app/verify/ src/app/admin/contracts/ContractsClient.tsx && git commit -m "feat(docsigning): implement backoffice operations dock and public verification portal"`

---

### Task 10: Phase 1 Acceptance Gate & Verification

**Files:**
- Verify: Full test suite across baseline and Phase 1 tests.
- Update: `docs/superpowers/plans/2026-09-28-doc-signing-phase-1.md` (Check off tasks)

- [ ] **Step 1: Run all baseline and Phase 1 unit tests**
  - Command: `pnpm test:run src/lib/__tests__/*.test.ts src/lib/documents/__tests__/*.test.ts`
  - Expected: 100% pass across all suites.

- [ ] **Step 2: Run TypeScript compiler**
  - Command: `pnpm typecheck`
  - Expected: 0 errors.

- [ ] **Step 3: Run ESLint**
  - Command: `pnpm lint`
  - Expected: 0 errors, warnings within 670 budget.

- [ ] **Step 4: Commit completed Phase 1 plan status**
  - Command: `git add docs/superpowers/plans/2026-09-28-doc-signing-phase-1.md && git commit -m "docs(docsigning): mark Phase 1 tasks completed"`
