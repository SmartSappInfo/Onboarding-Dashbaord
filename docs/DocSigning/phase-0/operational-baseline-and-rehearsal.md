# Document Signing Phase 0: Operational Baseline, Known-Gap Register & Rollback Playbook

**Document ID:** DOC-SIGNING-P0-OPERATIONAL-BASELINE  
**Status:** Approved & Verified  
**Date:** 2026-09-28  
**Scope:** Phase 0 Baseline Audit, Technical Debt Register, Backup Procedures & Transition Gates  

---

## 1. Executive Summary

This document establishes the operational baseline and architectural governance for the Document Signing modernization project. It catalogs the current technical debt and vulnerabilities discovered during the Phase 0 audit, details the operational backup and rollback rehearsal procedures, and specifies the verification criteria required for entering Phase 1.

All baseline behaviors have been codified into automated test suites without modifying existing production logic:
- `src/lib/__tests__/signature-processing.baseline.test.ts` (4/4 tests passing)
- `src/lib/__tests__/pdf-variable-resolution.baseline.test.ts` (5/5 tests passing)
- `src/lib/__tests__/contract-actions.baseline.test.ts` (4/4 tests passing)
- `src/lib/__tests__/pdf-actions.baseline.test.ts` (3/3 tests passing)
- **Total Baseline Verification:** 16 tests passing, 0 failures, 100% adherence to Rule 4 Zero-Tolerance Typing (`any` free).

---

## 2. Known-Gap & Technical Debt Register

The Phase 0 code-path and data audit revealed five primary architectural deficiencies that impact document security, regulatory compliance (ESIGN / eIDAS), system reliability, and mobile responsiveness.

| Gap ID | Defect / Vulnerability | Root Cause & Impact | Planned Phase 1 / Phase 2 Remediation | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| **G-01** | **Client-Side `html2canvas` Rasterization** | `SharedSubmissionView.tsx` and `SubmissionsPage.tsx` use `html2canvas` to screenshot DOM elements, slicing them into JPEG images inside a jsPDF wrapper.<br>• Degrades text clarity, unselectable text.<br>• High client memory usage causing mobile iOS Safari crashes on >3-page documents.<br>• Inaccurate page breaking. | Replaced in **Phase 1** with authoritative server-side vector PDF generation via `pdf-lib` at `/api/pdfs/[pdfId]/generate/[submissionId]`. Text remains crisp vector glyphs, form fields are embedded with true OpenType fonts, and downloads stream directly via chunked responses. | **Critical** |
| **G-02** | **Absence of Cryptographic Document Digests (SHA-256)** | Existing contracts and submissions do not compute or store cryptographic hashes of the original blank PDF or final signed PDF.<br>• Inability to legally prove document immutability.<br>• Susceptible to post-sign tampering disputes in legal proceedings. | Implemented in **Phase 1**: Compute pre-sign SHA-256 hash (`preSignDigest`) on draft creation and post-sign SHA-256 hash (`finalDigest`) upon finalization. Both hashes are recorded in Firestore and stamped on the Certificate of Completion. | **High** |
| **G-03** | **Missing Tamper-Evident Certificate of Completion** | Signed contracts lack a formal, standardized evidentiary audit page.<br>• Activity logs are recorded as loose strings in the workspace `activities` collection, making third-party verification difficult.<br>• No single self-contained legal instrument. | Implemented in **Phase 1**: Every signed document appends a standardized 1-page "Certificate of Completion" containing Envelope ID, Signer IP, Device/User-Agent, exact UTC timestamps, SHA-256 hashes, and a scannable QR verification code leading to `/verify/[envelopeId]`. | **High** |
| **G-04** | **Inline Base64 Signature Storage in Firestore** | Signatures captured via camera/canvas are saved as raw base64 data URLs inside `submissions.formData`.<br>• High-resolution PNGs can reach 300KB–600KB.<br>• Two or three signatures easily breach Firestore's 1MB document size limit.<br>• Increases Firestore read/write costs exponentially. | Implemented in **Phase 1**: Signatures are streamed directly to Cloud Storage at `signatures/{workspaceId}/{contractId}/{recipientId}.png`. Firestore documents store only the storage URI and cryptographic hash of the signature image. | **High** |
| **G-05** | **Single Signer Limitation (No Sequential/Parallel Routing)** | The `contracts` collection only tracks one `signatoryName` and `signatoryEmail`.<br>• Cannot support two-party agreements, counter-signatures, co-signers, or corporate approvals.<br>• Forces manual dispatch of separate documents. | Implemented in **Phase 2**: Multi-recipient envelope schema (`SigningRecipient[]`) supporting sequential (`routingOrder: 1, 2...`) or parallel signing, individual recipient tokens, and independent audit trails. | **Medium** |
| **G-06** | **Non-Transactional Finalization Race Conditions** | `finalizeAgreementAction` in `pdf-actions.ts` runs non-transactional reads and writes across `contracts` and `submissions`.<br>• Simultaneous clicks or network retries by a signer can trigger duplicate completion workflows, duplicate deal updates, and duplicate email/SMS notifications. | Implemented in **Phase 1**: Wrap finalization in a strict Firestore `adminDb.runTransaction()` with an atomic status precondition (`status == 'sent' \|\| status == 'partially_signed'`). Second executions are immediately rejected as idempotent duplicates. | **High** |

---

## 3. Backup, Disaster Recovery & Rollback Playbook

To ensure zero risk of data loss or service disruption during subsequent migration phases, the following operational procedures are established.

### 3.1 Pre-Migration Firestore Snapshot
Prior to applying schema changes or running automated backfills, a point-in-time export of relevant Firestore collections must be executed via Google Cloud CLI:

```bash
# Set environment variables
PROJECT_ID="smartsapp-app"
BACKUP_BUCKET="gs://${PROJECT_ID}-firestore-backups"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Export all document-signing related collections
gcloud firestore export ${BACKUP_BUCKET}/docsigning-phase0-${TIMESTAMP} \
  --project=${PROJECT_ID} \
  --collection-ids='contracts','pdfs','pdf_sessions','activities'
```

### 3.2 Dual-Read / Single-Write Transition Pattern
During Phase 1 and Phase 2 rollouts:
1. **Reads:** The application code will support both legacy schemas (`contracts.signatoryEmail`, inline base64 signatures) and new schemas (`contracts.recipients`, Cloud Storage signature URIs).
   - If `recipient.signatureStoragePath` is present, fetch signed URL; else fallback to `formData[fieldKey]` base64 data URL.
2. **Writes:** New submissions write to both Cloud Storage and the normalized schema, maintaining backward compatibility fields until deprecation is complete.
3. **No Destructive Drops:** Old fields (`formData`, `signatoryName`) will never be deleted from historical documents.

### 3.3 Emergency Code Rollback Steps
If an unhandled exception or breaking regression occurs during Phase 1 deployment:

1. **Immediate Git Rollback:**
   ```bash
   # Revert to verified Phase 0 commit
   git checkout main
   git revert --no-commit HEAD
   git commit -m "revert(docsigning): emergency rollback to Phase 0 baseline"
   ```
2. **Feature Flag Circuit Breaker:**
   - In Next.js configuration or environment, set `DOCSIGNING_V2_ENABLED=false` to route public signing traffic through the legacy renderer `/forms/[pdfId]` while investigating root causes.
3. **Data Recovery (If Document Corruption Occurs):**
   ```bash
   gcloud firestore import ${BACKUP_BUCKET}/docsigning-phase0-${TIMESTAMP} \
     --project=${PROJECT_ID} \
     --collection-ids='contracts','pdfs'
   ```

---

## 4. Downstream Integration Safeguards

The following downstream dependencies were mapped in Task 0.1 and must remain 100% operational through all phases:

| Subsystem | Integration Point | Critical Dependency | Safeguard Mechanism |
| :--- | :--- | :--- | :--- |
| **CRM Deals** | `src/lib/deals/deal-event-bus.ts` | Emits `deal.contract.signed` on contract completion, automatically advancing deal probability to 100% and setting `contractStatus: 'signed'`. | Finalization server actions must guarantee this event is emitted exactly once upon final envelope completion. |
| **Automation Engine** | `src/lib/automations/payload-enricher.ts` (L220–240) | Queries `pdfs/{pdfId}/submissions` where `entityId == targetId` to evaluate automation condition triggers and template field values. | All submission records must preserve `entityId`, `pdfId`, and `formData` keys regardless of vector PDF refactoring. |
| **Link Shortener** | `src/app/go/[linkId]/route.ts` | Resolves short URLs (`/go/[linkId]`) and redirects to `/forms/[pdfId]?entityId=...`. | Public signing URLs must maintain backwards compatibility for existing query parameter conventions. |
| **Messaging Engine** | `src/lib/messaging-actions.ts` | Dispatches SMS and Email notifications with sign tokens and completion links. | Dispatch payload schema must support both legacy string tokens and modern hashed JWT/HMAC envelope tokens. |

---

## 5. Phase 0 Acceptance Gate Checklist

Every criteria below has been met and verified against codebase state:

- [x] **P0.1 Code-Path Inventory:** Complete inventory of all routes, server actions, API endpoints, and dependencies documented in `docs/DocSigning/phase-0/code-path-inventory.md`.
- [x] **P0.2 Data & Security Matrix:** Documented schemas, storage architecture, RBAC permissions, and threat register in `docs/DocSigning/phase-0/data-and-security-inventory.md`.
- [x] **P0.3 Baseline Test Suite 1:** Signature processing luminance thresholding and alpha isolation verified (`signature-processing.baseline.test.ts`).
- [x] **P0.3 Baseline Test Suite 2:** PDF dynamic variable resolution and Zod schema generation verified (`pdf-variable-resolution.baseline.test.ts`).
- [x] **P0.3 Baseline Test Suite 3:** Contract lifecycle actions (upsert, dispatch, atomic delete) verified (`contract-actions.baseline.test.ts`).
- [x] **P0.3 Baseline Test Suite 4:** PDF signing finalization and partial progress actions verified (`pdf-actions.baseline.test.ts`).
- [x] **P0.4 Operational Baseline & Known-Gap Register:** Technical debt, rollback playbook, and integration safeguards documented in `docs/DocSigning/phase-0/operational-baseline-and-rehearsal.md`.
- [x] **Strict Type Safety:** Zero `any` or `any[]` introduced across all baseline tests and documents.
- [x] **TypeScript & Lint Verification:** `pnpm typecheck` passed (0 errors); `pnpm lint` passed (0 errors).

---

## 6. Phase 1 Readiness Declaration

Phase 0 discovery and baseline hardening is **100% complete**. The codebase is now prepared to proceed with **Phase 1: Integrity, Unified Vector PDF & Idempotent Finalization**.
