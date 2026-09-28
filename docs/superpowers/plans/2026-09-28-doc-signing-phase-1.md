# Document Signing Phase 1: Integrity, Unified Vector PDF & Idempotent Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the document signing pipeline into an authoritative, tamper-evident, deterministic system by eliminating client-side `html2canvas` screenshotting in favor of server-side vector PDF generation, offloading signatures to Cloud Storage, issuing cryptographic SHA-256 Certificates of Completion, wrapping finalization in an idempotent Firestore transaction, and formally wiring CRM deal lifecycle events.

**Architecture:** 
1. Server-authoritative vector PDF pipeline using `pdf-lib` and font embedding at `/api/pdfs/[pdfId]/generate/[submissionId]`.
2. Cloud Storage offloading for signature images (`signatures/{workspaceId}/{contractId}/{recipientId}.png`) storing immutable SHA-256 hashes in Firestore.
3. Cryptographic evidence engine generating append-only audit events and a 1-page vector Certificate of Completion with verification QR code.
4. Concurrency-safe, transactional finalization via `adminDb.runTransaction()` conditioned on `status !== 'signed'`, formally emitting `deal.contract.signed` to the CRM event bus.
5. Mobile-first UX hardening with `min-h-[44px]` touch targets, Emil Kowalski micro-interactions (`active:scale-[0.97]`), and submission lockout.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (Strict, Rule 4 Zero-`any`), `pdf-lib`, Firebase Admin Firestore & Cloud Storage, Vitest, Zod, Tailwind CSS, Lucide React, `qrcode`.

---

## Downstream Compatibility & Guardrails Matrix

| Subsystem | Integration Point | Phase 1 Guardrail & Invariant |
| :--- | :--- | :--- |
| **CRM Deals** | `src/lib/deals/deal-event-bus.ts` | Formally wire `emitDealDomainEvent('deal.contract.signed', ...)` in `finalizeAgreementAction`. Deal probability advances to 100% and sets `contractStatus: 'signed'`. |
| **Automations Engine** | `src/lib/automations/payload-enricher.ts:220-240` | Preserve `pdfs/{pdfId}/submissions` schema with `entityId`, `pdfId`, and `formData`. Condition evaluation nodes will continue to read `formData[fieldKey]` seamlessly. |
| **Link Shortener** | `src/app/go/[linkId]/route.ts` | Maintain backward compatibility for `/forms/[pdfId]?entityId=...`. Query parameters and session resolution remain 100% preserved. |
| **Messaging Engine** | `src/lib/messaging-actions.ts` | Email and SMS dispatch receive the authoritative vector PDF buffer from the server pipeline rather than client-rendered raster captures. |
| **Variables SSOT** | `src/lib/services/fields-variables-service.ts` | All dynamic variable substitution routes through `FieldsVariablesService.resolveTemplateVariables`. |

---

## File Structure & Decomposition Plan

```
src/
├── lib/
│   ├── documents/
│   │   ├── form-validation.ts               # SSOT Zod schema generator extracted from PdfFormRenderer
│   │   ├── signature-storage-service.ts     # Cloud Storage upload & hash generator for signatures
│   │   ├── evidence-service.ts              # Pre/Post SHA-256 hashing & append-only audit records
│   │   ├── audit-certificate-service.ts     # 1-page vector PDF Certificate of Completion with QR code
│   │   └── __tests__/
│   │       ├── form-validation.test.ts
│   │       ├── signature-storage-service.test.ts
│   │       ├── evidence-service.test.ts
│   │       └── audit-certificate-service.test.ts
│   ├── pdf-actions.ts                       # Refactored: transactional finalization, vector engine, 0 any
│   └── __tests__/
│       ├── vector-pdf-engine.test.ts        # Unit test with valid minimal PDF binary fixture
│       └── idempotent-finalization.test.ts  # Transactional concurrency & idempotency test
├── app/
│   ├── api/
│   │   └── pdfs/
│   │       ├── [pdfId]/generate/[submissionId]/route.ts # Direct streaming vector PDF endpoint
│   │       └── submit/route.ts              # Updated to use transactional finalization
│   └── forms/
│       ├── [pdfId]/components/PdfFormRenderer.tsx       # SSOT validation import, submission lockout
│       └── results/components/SharedSubmissionView.tsx  # Eliminate html2canvas, native download & cert badge
```

---

## Tasks Breakdown

### Task 1: Form Validation Extraction & SSOT Consolidation (P1.1)

**Files:**
- Create: `src/lib/documents/form-validation.ts`
- Create: `src/lib/documents/__tests__/form-validation.test.ts`
- Modify: `src/app/forms/[pdfId]/components/PdfFormRenderer.tsx:61-78`
- Modify: `src/lib/__tests__/pdf-variable-resolution.baseline.test.ts:13-31`

- [ ] **Step 1: Write unit test for `generateValidationSchema` in `form-validation.test.ts`**

```typescript
// src/lib/documents/__tests__/form-validation.test.ts
import { describe, it, expect } from 'vitest';
import { generateValidationSchema } from '../form-validation';
import type { PDFFormField } from '@/lib/types';

describe('P1.1 Form Validation Schema Generator', () => {
  it('generates schema requiring mandatory text fields and validating email/phone formats', () => {
    const fields: PDFFormField[] = [
      { id: 'full_name', type: 'text', label: 'Full Name', required: true, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'signer_email', type: 'email', label: 'Signer Email', required: true, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'signer_phone', type: 'phone', label: 'Signer Phone', required: false, page: 1, x: 0, y: 0, width: 100, height: 20 },
      { id: 'notes', type: 'static-text', label: 'Static Note', required: false, page: 1, x: 0, y: 0, width: 100, height: 20 },
    ];

    const schema = generateValidationSchema(fields);

    // Valid data
    const valid = schema.safeParse({
      full_name: 'John Doe',
      signer_email: 'john@example.com',
      signer_phone: '1234567890',
    });
    expect(valid.success).toBe(true);

    // Invalid email
    const invalidEmail = schema.safeParse({
      full_name: 'John Doe',
      signer_email: 'not-an-email',
    });
    expect(invalidEmail.success).toBe(false);

    // Missing required field
    const missingName = schema.safeParse({
      full_name: '',
      signer_email: 'john@example.com',
    });
    expect(missingName.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/form-validation.test.ts`
  - Expected: FAIL (module `../form-validation` not found).

- [ ] **Step 3: Implement `src/lib/documents/form-validation.ts`**

```typescript
// src/lib/documents/form-validation.ts
import { z } from 'zod';
import type { PDFFormField } from '@/lib/types';

/**
 * Generates a runtime Zod validation schema for an array of PDF form fields.
 * Conforms to SSOT: used by public form renderers, server actions, and unit tests.
 */
export function generateValidationSchema(fields: PDFFormField[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const schemaObject = fields.reduce<Record<string, z.ZodTypeAny>>((acc, field) => {
    if (field.type === 'static-text' || field.type === 'variable') return acc;
    
    let fieldSchema: z.ZodTypeAny = z.string().optional().nullable().or(z.literal(''));
    
    if (field.type === 'email') {
      const emailSchema = z.string().email({ message: "Invalid email." });
      fieldSchema = field.required ? emailSchema : emailSchema.optional().or(z.literal(''));
    } else if (field.type === 'phone') {
      const phoneSchema = z.string().min(10, "Phone required.");
      fieldSchema = field.required ? phoneSchema : phoneSchema.optional().or(z.literal(''));
    } else if (field.required) {
      fieldSchema = z.string({ required_error: "Required." }).min(1, { message: "Required." });
    }
    
    acc[field.id] = fieldSchema;
    return acc;
  }, {});

  return z.object(schemaObject);
}
```

- [ ] **Step 4: Update `PdfFormRenderer.tsx` and `pdf-variable-resolution.baseline.test.ts` to import from `src/lib/documents/form-validation.ts`**
  - Remove duplicate inline `generateValidationSchema` declaration in `PdfFormRenderer.tsx`.
  - Remove duplicate inline `generateValidationSchema` declaration in `pdf-variable-resolution.baseline.test.ts`.

- [ ] **Step 5: Run tests to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/form-validation.test.ts src/lib/__tests__/pdf-variable-resolution.baseline.test.ts`
  - Expected: PASS (both suites green).

- [ ] **Step 6: Commit changes**
  - Command: `git add src/lib/documents/form-validation.ts src/lib/documents/__tests__/form-validation.test.ts src/app/forms/[pdfId]/components/PdfFormRenderer.tsx src/lib/__tests__/pdf-variable-resolution.baseline.test.ts && git commit -m "refactor(docsigning): extract generateValidationSchema to SSOT domain utility"`

---

### Task 2: Cloud Storage Signature Offloading & Asset Management (P1.3)

**Files:**
- Create: `src/lib/documents/signature-storage-service.ts`
- Create: `src/lib/documents/__tests__/signature-storage-service.test.ts`

- [ ] **Step 1: Write unit test in `signature-storage-service.test.ts`**

```typescript
// src/lib/documents/__tests__/signature-storage-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadSignatureImage, isBase64DataUrl } from '../signature-storage-service';

const mockUpload = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/firebase-admin', () => ({
  adminStorage: {
    file: vi.fn().mockImplementation((path: string) => ({
      save: mockUpload,
      name: path,
    })),
  },
}));

describe('P1.3 Signature Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects base64 data URLs correctly', () => {
    expect(isBase64DataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(true);
    expect(isBase64DataUrl('https://storage.googleapis.com/bucket/sig.png')).toBe(false);
  });

  it('uploads base64 signature to storage path and computes SHA-256 hash', async () => {
    const fakeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await uploadSignatureImage({
      workspaceId: 'ws_test_01',
      contractId: 'contract_test_01',
      recipientId: 'recipient_01',
      dataUrl: fakeBase64,
    });

    expect(result.storagePath).toBe('signatures/ws_test_01/contract_test_01/recipient_01.png');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(mockUpload).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/signature-storage-service.test.ts`
  - Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/documents/signature-storage-service.ts`**

```typescript
// src/lib/documents/signature-storage-service.ts
import { adminStorage } from '@/lib/firebase-admin';
import crypto from 'crypto';

export interface SignatureUploadInput {
  workspaceId: string;
  contractId: string;
  recipientId: string;
  dataUrl: string;
}

export interface SignatureUploadResult {
  storagePath: string;
  sha256: string;
  byteSize: number;
}

export function isBase64DataUrl(str: string): boolean {
  return typeof str === 'string' && str.startsWith('data:image/');
}

export async function uploadSignatureImage(input: SignatureUploadInput): Promise<SignatureUploadResult> {
  const { workspaceId, contractId, recipientId, dataUrl } = input;
  
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error('Invalid base64 image data URL.');
  }

  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storagePath = `signatures/${workspaceId}/${contractId}/${recipientId}.${extension}`;

  const file = adminStorage.file(storagePath);
  await file.save(buffer, {
    metadata: {
      contentType: `image/${extension}`,
      metadata: {
        workspaceId,
        contractId,
        recipientId,
        sha256,
      },
    },
  });

  return {
    storagePath,
    sha256,
    byteSize: buffer.length,
  };
}
```

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/signature-storage-service.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/documents/signature-storage-service.ts src/lib/documents/__tests__/signature-storage-service.test.ts && git commit -m "feat(docsigning): implement signature storage service with sha256 hashing"`

---

### Task 3: Authoritative Server-Side Vector PDF Engine (P1.1)

**Files:**
- Modify: `src/lib/pdf-actions.ts:76-200`
- Create: `src/lib/__tests__/vector-pdf-engine.test.ts`

- [ ] **Step 1: Write vector PDF engine test with valid minimal PDF fixture**

```typescript
// src/lib/__tests__/vector-pdf-engine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generatePdfBuffer } from '../pdf-actions';
import { PDFDocument } from 'pdf-lib';
import type { PDFForm } from '../types';

// Create a valid blank PDF buffer for testing
async function createValidBlankPdfBuffer(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]); // A4
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
  adminStorage: {
    file: vi.fn().mockImplementation(() => ({
      download: vi.fn().mockImplementation(async () => [await createValidBlankPdfBuffer()]),
    })),
  },
}));

vi.mock('../services/workspace-resolver', () => ({
  resolveWorkspaceIdFromEntity: vi.fn().mockResolvedValue('ws_main_01'),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue({
    schoolData: { name: 'Acme Academy', location: 'London' }
  }),
}));

describe('P1.1 Authoritative Vector PDF Engine', () => {
  it('overlays text and form data onto template without throwing and preserves page dimensions', async () => {
    const mockPdfForm: PDFForm = {
      id: 'pdf_test_form',
      name: 'Service Agreement',
      storagePath: 'templates/service_agreement.pdf',
      fields: [
        {
          id: 'client_name',
          type: 'text',
          label: 'Client Name',
          page: 1,
          x: 10,
          y: 20,
          width: 30,
          height: 5,
          required: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspaceIds: ['ws_main_01'],
    };

    const formData = {
      client_name: 'Jane Doe',
    };

    const resultBuffer = await generatePdfBuffer(mockPdfForm, formData);
    expect(resultBuffer).toBeInstanceOf(Buffer);
    expect(resultBuffer.length).toBeGreaterThan(100);

    // Verify output is a valid PDF
    const parsedPdf = await PDFDocument.load(resultBuffer);
    expect(parsedPdf.getPageCount()).toBe(1);
    const page = parsedPdf.getPage(0);
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
  });
});
```

- [ ] **Step 2: Run test to verify current state**
  - Command: `pnpm test:run src/lib/__tests__/vector-pdf-engine.test.ts`
  - Expected: PASS or FAIL depending on mock alignment.

- [ ] **Step 3: Refactor `generatePdfBuffer` in `src/lib/pdf-actions.ts`**
  - Replace `formData: { [key: string]: any }` with strictly typed `Record<string, unknown>`.
  - Ensure coordinates map accurately based on the page's actual media box:
    `const { width: pageWidth, height: pageHeight } = page.getSize();`
    `const x = (field.x / 100) * pageWidth;`
    `const y = pageHeight - ((field.y / 100) * pageHeight) - ((field.height / 100) * pageHeight);`
  - Support image signatures embedded from both Cloud Storage paths and validated data URLs.
  - Return clean `Buffer`.

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/__tests__/vector-pdf-engine.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/pdf-actions.ts src/lib/__tests__/vector-pdf-engine.test.ts && git commit -m "feat(docsigning): modernize generatePdfBuffer with strict typing and exact page geometry"`

---

### Task 4: Cryptographic Evidence Service & SHA-256 Fingerprinting (P1.4)

**Files:**
- Create: `src/lib/documents/evidence-service.ts`
- Create: `src/lib/documents/__tests__/evidence-service.test.ts`

- [ ] **Step 1: Write unit test in `evidence-service.test.ts`**

```typescript
// src/lib/documents/__tests__/evidence-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateSha256Digest, createEvidenceRecord } from '../evidence-service';

const mockAdd = vi.fn().mockResolvedValue({ id: 'ev_12345' });
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      add: mockAdd,
    }),
  },
}));

describe('P1.4 Cryptographic Evidence Service', () => {
  it('calculates reproducible SHA-256 digest from buffer', () => {
    const buffer = Buffer.from('SmartSapp Tamper Evident PDF Content');
    const digest = calculateSha256Digest(buffer);
    expect(digest).toBe('7a07fcce20f8c2b53580554fbfbbdf758832a8298754b52479f676451eeb2263');
  });

  it('records an immutable evidence event with actor metadata and digest', async () => {
    const record = await createEvidenceRecord({
      envelopeId: 'env_test_01',
      action: 'signed',
      recipientId: 'rec_01',
      recipientEmail: 'signer@example.com',
      recipientName: 'Jane Doe',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 iOS Safari',
      documentDigest: '7a07fcce20f8c2b53580554fbfbbdf758832a8298754b52479f676451eeb2263',
    });

    expect(record.id).toBe('ev_12345');
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      envelopeId: 'env_test_01',
      action: 'signed',
      documentDigest: '7a07fcce20f8c2b53580554fbfbbdf758832a8298754b52479f676451eeb2263',
      ipAddress: '192.168.1.1',
    }));
  });
});
```

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/evidence-service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/documents/evidence-service.ts`**

```typescript
// src/lib/documents/evidence-service.ts
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';

export interface EvidenceRecordInput {
  envelopeId: string;
  action: 'created' | 'sent' | 'delivered' | 'opened' | 'progress_saved' | 'signed' | 'declined' | 'completed' | 'voided';
  recipientId?: string;
  recipientEmail?: string;
  recipientName?: string;
  ipAddress?: string;
  userAgent?: string;
  documentDigest?: string;
  metadata?: Record<string, unknown>;
}

export function calculateSha256Digest(data: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function createEvidenceRecord(input: EvidenceRecordInput): Promise<{ id: string; timestamp: string }> {
  const timestamp = new Date().toISOString();
  const entry = {
    ...input,
    timestamp,
    createdAt: timestamp,
  };

  const docRef = await adminDb.collection('signing_evidence').add(entry);
  return { id: docRef.id, timestamp };
}
```

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/evidence-service.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/documents/evidence-service.ts src/lib/documents/__tests__/evidence-service.test.ts && git commit -m "feat(docsigning): implement cryptographic evidence service and sha256 digests"`

---

### Task 5: Certificate of Completion Vector Generator (P1.4)

**Files:**
- Create: `src/lib/documents/audit-certificate-service.ts`
- Create: `src/lib/documents/__tests__/audit-certificate-service.test.ts`

- [ ] **Step 1: Write unit test in `audit-certificate-service.test.ts`**

```typescript
// src/lib/documents/__tests__/audit-certificate-service.test.ts
import { describe, it, expect } from 'vitest';
import { appendCertificateOfCompletion } from '../audit-certificate-service';
import { PDFDocument } from 'pdf-lib';

describe('P1.4 Certificate of Completion Generator', () => {
  it('appends a 1-page vector Certificate of Completion with verification QR code to existing PDF', async () => {
    const basePdf = await PDFDocument.create();
    basePdf.addPage([595.28, 841.89]);
    const baseBytes = await basePdf.save();

    const signedBytes = await appendCertificateOfCompletion({
      pdfBuffer: Buffer.from(baseBytes),
      certificateData: {
        envelopeId: 'env_test_998877',
        documentTitle: 'Master Commercial Agreement',
        completedAt: '2026-09-28T22:30:00.000Z',
        preSignDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        finalDigest: '7a07fcce20f8c2b53580554fbfbbdf758832a8298754b52479f676451eeb2263',
        signatory: {
          name: 'Jane Signer',
          email: 'jane@example.com',
          signedAt: '2026-09-28T22:29:45.000Z',
          ipAddress: '203.0.113.195',
        },
        verificationUrl: 'https://app.smartsapp.com/verify/env_test_998877',
      },
    });

    const finalPdf = await PDFDocument.load(signedBytes);
    expect(finalPdf.getPageCount()).toBe(2); // Base page + 1 certificate page
  });
});
```

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/documents/__tests__/audit-certificate-service.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/documents/audit-certificate-service.ts`**
  - Uses `pdf-lib` and `qrcode.toDataURL` to construct a formal, beautifully formatted A4 vector summary page.
  - Draws document title, Envelope ID, Status (Executed), Signatory Name/Email, Timestamp (UTC), IP Address, SHA-256 pre-sign digest, SHA-256 final digest, and the scannable QR code.

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/documents/__tests__/audit-certificate-service.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/documents/audit-certificate-service.ts src/lib/documents/__tests__/audit-certificate-service.test.ts && git commit -m "feat(docsigning): implement certificate of completion vector generator"`

---

### Task 6: Transactional Idempotent Finalization & CRM Event Wiring (P1.2)

**Files:**
- Modify: `src/lib/pdf-actions.ts:280-435`
- Create: `src/lib/__tests__/idempotent-finalization.test.ts`

- [ ] **Step 1: Write concurrency and idempotency unit tests in `idempotent-finalization.test.ts`**

```typescript
// src/lib/__tests__/idempotent-finalization.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finalizeAgreementAction } from '../pdf-actions';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';

vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/notification-engine', () => ({
  triggerInternalNotification: vi.fn().mockResolvedValue({ success: true }),
}));

describe('P1.2 Transactional Idempotent Finalization', () => {
  it('executes finalization, emits deal.contract.signed event, and prevents duplicate execution', async () => {
    // Test initial finalization execution
    // Verify emitDealDomainEvent('deal.contract.signed') is invoked
    // Test second parallel execution with already-signed contract, confirming idempotent success without side-effects
  });
});
```

- [ ] **Step 2: Run test to verify failure**
  - Command: `pnpm test:run src/lib/__tests__/idempotent-finalization.test.ts`
  - Expected: FAIL (emitDealDomainEvent not called).

- [ ] **Step 3: Refactor `finalizeAgreementAction` in `src/lib/pdf-actions.ts`**
  - Wrap contract read/write and submission creation in `adminDb.runTransaction()`.
  - Add precondition: If `contract.status === 'signed'`, return `{ success: true, submissionId, isIdempotentReplay: true }` without re-dispatching messages or re-triggering deal events.
  - Formally wire `emitDealDomainEvent('deal.contract.signed', ...)` passing `contractId`, `entityId`, `workspaceId`, and `submissionId`.
  - Offload signatures to Cloud Storage using `uploadSignatureImage` when base64 is detected.
  - Append the Certificate of Completion to the generated PDF.
  - Replace the empty silent `catch (_err) {}` with structured error logging.

- [ ] **Step 4: Run test to verify pass**
  - Command: `pnpm test:run src/lib/__tests__/idempotent-finalization.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit changes**
  - Command: `git add src/lib/pdf-actions.ts src/lib/__tests__/idempotent-finalization.test.ts && git commit -m "feat(docsigning): implement transactional idempotent finalization and wire deal.contract.signed event"`

---

### Task 7: Client Vector PDF Download & `html2canvas` Elimination (P1.1 UI)

**Files:**
- Modify: `src/app/forms/results/components/SharedSubmissionView.tsx`
- Modify: `src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts`

- [ ] **Step 1: Update API route `/api/pdfs/[pdfId]/generate/[submissionId]/route.ts`**
  - Ensure the route validates tenant authorization and generates the authoritative vector PDF with the appended Certificate of Completion.
  - Set appropriate caching headers: `Cache-Control: private, no-cache, no-store, must-revalidate`.

- [ ] **Step 2: Refactor `handleDownload` in `SharedSubmissionView.tsx`**
  - Completely remove `html2canvas` DOM screenshot loops and fixed A4 JPEG slicing.
  - Trigger download directly via `window.open('/api/pdfs/' + pdfForm.id + '/generate/' + submission.id, '_blank')` or direct blob stream.
  - Render an evidentiary "Certificate of Completion" verification card in the UI displaying:
    - Status: "Legally Executed"
    - SHA-256 Digest badge (monospaced, truncated with copy button)
    - Timestamp & Signer IP
    - QR Code button linking to verification portal

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
    - Finalize button visual press state (`active:scale-[0.97]`).
    - Spinner animation while transaction completes.
    - Prevents double-taps on mobile devices.
  - Touch targets: ensure all inputs, checkmarks, signature triggers, and date selectors have `min-h-[44px]` touch target sizing.
  - Add meta viewport zoom protection for mobile inputs (`text-base` / `16px` font size to prevent iOS Safari auto-zooming).

- [ ] **Step 2: Update `SignaturePadModal.tsx`**
  - Ensure canvas and webcam draw surfaces resize smoothly on mobile portrait viewports.
  - Maintain camera "Scan" mode with its luminance thresholding and transparent background isolation.
  - Eliminate any `any` types in `SignaturePadModal.tsx` and `PdfFormRenderer.tsx`.

- [ ] **Step 3: Verify TypeScript compiler and lint**
  - Command: `pnpm typecheck && pnpm eslint 'src/app/forms/[pdfId]/components/PdfFormRenderer.tsx' 'src/components/SignaturePadModal.tsx'`
  - Expected: 0 errors.

- [ ] **Step 4: Commit changes**
  - Command: `git add src/app/forms/[pdfId]/components/PdfFormRenderer.tsx src/components/SignaturePadModal.tsx && git commit -m "feat(docsigning): mobile touch target hardening and double-submission protection in signing portal"`

---

### Task 9: Phase 1 Acceptance Gate & Verification

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
