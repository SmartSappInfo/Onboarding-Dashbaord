# Phase 9 Master Implementation Plan: Enterprise Bulk Dispatch Campaigns, Batch Merge Ingestion, Legal Hold & Cryptographic e-Discovery Archival

> **Initiative:** SmartSapp Document & Contract Intelligence Platform  
> **Phase:** 9 of Modernization Roadmap  
> **Status:** Planned & Ready for Implementation  
> **Author:** Antigravity Systems & UI/UX Architect  
> **Dependencies:** Phases 0 through 8 Complete (`5cfb9e9e`)  
> **Primary Rule Compliance:** Strict Zero-Tolerance Typing (0 `any` / 0 `any[]`), Fields & Variables SSOT (`FieldsVariablesService`), Tag Selection SSOT (`<TagSelector>`), Mobile-First Ergonomics (`min-h-[44px]`, `active:scale-[0.97]`), Next.js 15 Async APIs, Vercel React Best Practices, and Emil Kowalski UI micro-interactions.

---

## 1. Executive Summary & Strategic Objectives

With Phases 0 through 8 successfully delivered (100% GA readiness score, 75 test files passed, 464/464 green tests, 0 TypeScript compile errors), the SmartSapp Document Signing platform boasts an authoritative vector PDF generation engine, multi-party sequential/parallel routing, an append-only evidence ledger, CRM deal federation, grounded AI document copilot, self-healing webhooks, live zero-downtime migration, public developer REST APIs, and embedded partner SDK with offline biometric captures.

**Phase 9** elevates the platform into a true enterprise contender (competing directly with DocuSign Enterprise, Adobe Acrobat Sign, and Ironclad CLM) by delivering:
1. **High-Throughput Bulk Dispatch Campaigns**: Programmatically issuing a single approved template to hundreds or thousands of recipients simultaneously via CSV upload or CRM roster ingestion with rate-limited, chunked dispatch queues.
2. **Batch Dynamic Variable Merge Ingestion**: High-fidelity variable mapping with strict pre-flight syntax validation, null-check linting, and CSV formula injection sanitization.
3. **Partial-Failure Isolation & Safe Retry Engine (FM-P9-03)**: Granular per-recipient status tracking (`queued`, `dispatched`, `delivered`, `signed`, `failed`) ensuring partial failures can be retried without resending or disturbing recipients who have already executed.
4. **Enterprise Legal Hold & Statutory Retention Engine (FM-P9-05)**: Litigation hold locks that immediately freeze contracts and envelopes against deletion or modification with HTTP 423 (Locked) enforcement and statutory retention schedules (`financial`, `employment`, `tax`, `ip`).
5. **Cryptographic e-Discovery Archival Package & Merkle Manifest Generator (FM-P9-06)**: One-click export of court-admissible audit ZIP bundles containing authoritative completed PDFs, pre-execution templates, certificates of completion, evidence ledgers, biometric telemetry, and a cryptographic `manifest.json` with Merkle root checksums.
6. **Agreements Hub Console UI Upgrades**: Seamless addition of an 8th tab (**"Campaigns & Compliance"**) in `ContractsClient.tsx` featuring a 4-step Bulk Campaign Wizard, live real-time progress monitor, Legal Hold Manager, and e-Discovery Compliance Vault dock.

---

## 2. Foundational Principles & Non-Negotiable Golden Rules

1. **Rule 1 — Absolute Type Safety & Schema Validation**:
   - Zero `any` or `any[]` typing across all schemas, services, server actions, and UI components.
   - All bulk CSV rows, campaign payloads, legal hold actions, and e-Discovery manifests must parse through strict Zod schemas with complete error formatting.

2. **Rule 2 — Single Source of Truth for Variables & Tags**:
   - Variable interpolation must route exclusively through `FieldsVariablesService.resolveTemplateVariables`.
   - Contact and campaign tags must exclusively use `<TagSelector>` in client/draft mode.

3. **Rule 3 — Idempotent Bulk Dispatch & Deduplication Invariant**:
   - Every bulk campaign item derives an idempotency key: `idemp_${campaignId}_${recipientEmail}_${rowHash}`.
   - Double-clicking dispatch or resuming an interrupted campaign job will never emit duplicate envelopes.

4. **Rule 4 — Non-Blocking Chunked Processing & Serverless Safety**:
   - Bulk dispatches are broken into chunks of 25–50 envelopes with 100ms pacing delays.
   - Heavy tasks run asynchronously with Firestore outbox queueing to prevent Cloud Run / Serverless 60s request timeouts.

5. **Rule 5 — Immutable Legal Hold Barrier**:
   - Any contract or envelope marked `legalHold.isUnderLegalHold === true` is completely immutable to deletion, purging, or TTL archival.
   - Calling `deleteContractAction` on a held contract throws an immediate `LOCKED_UNDER_LEGAL_HOLD` exception.

6. **Rule 6 — CSV Injection & Data Sanitization Defense**:
   - CSV inputs are sanitized against formula injection (`=`, `+`, `-`, `@`, `\t`, `\r` stripped or escaped with leading single quotes).
   - Recipient emails are normalized (`toLowerCase().trim()`) and strictly validated with regex.

7. **Rule 7 — Mobile-First Ergonomics & Emil Kowalski Animations**:
   - Touch targets must be `min-h-[44px]`.
   - Micro-interactions must use `active:scale-[0.97]` tactile feedback and ease-out transitions (`transition-all duration-200 ease-out`).
   - Mobile table views collapse into card lists with swipe/tap actions on viewports `< 640px`.
   - Text inputs enforce `text-base sm:text-sm` to prevent iOS Safari auto-zoom.

8. **Rule 8 — Cryptographic e-Discovery Merkle Verification**:
   - Every artifact in an e-Discovery ZIP bundle has its SHA-256 hash calculated and embedded into `manifest.json`.
   - A Merkle root hash is generated and verified to guarantee zero post-export tampering.

---

## 3. Failure Modes & Mitigations Analysis (12 Failure Modes)

| Failure Mode ID | Failure Mode Description | Root Cause | Preventive Architecture & Mitigation |
|---|---|---|---|
| **FM-P9-01** | Cloud Function / Serverless Timeout on Bulk Send | Attempting to process 2,000 envelopes synchronously in a single HTTP request. | Chunked asynchronous queueing in `bulk_campaign_jobs`. Batch processor executes in discrete slices of 25 with persistent progress updates. |
| **FM-P9-02** | Duplicate Issuance on Double-Click or Resume | Network retry or operator re-triggering campaign dispatch. | Deterministic idempotency key per recipient (`idemp_${campaignId}_${email}_${hash}`). Checked before envelope document creation. |
| **FM-P9-03** | Resend Storm on Partial Failure Retry | Operator clicking "Retry" resends the campaign to all recipients including those already signed. | Granular item-level status tracking (`queued`, `dispatched`, `delivered`, `signed`, `failed`). Retry action queries strictly `status == 'failed'`. |
| **FM-P9-04** | Variable Null Injection / Missing Merge Fields | CSV contains empty cells for mandatory template fields. | Pre-flight dry-run validator checks all required variables against template schema, reporting row numbers and blocking dispatch until resolved. |
| **FM-P9-05** | Accidental Destruction under Active Legal Hold | User or automated cron job purges an expired agreement currently under litigation. | Hard invariant check in `deleteContractAction`, `archiveContractAction`, and `purgeContractAction`. Aborts with HTTP 423 (Locked). |
| **FM-P9-06** | e-Discovery Manifest Hash Tampering / Divergence | Files inside the export bundle corrupted or altered during transport. | Compute SHA-256 for each exported file, build a deterministic `manifest.json` with Merkle root hash, and include `verify-manifest.sh`. |
| **FM-P9-07** | CSV Formula Injection (DDE Attack) | Malicious CSV cells starting with `=CMD` or `+` execute commands when opened in Excel. | Sanitize all text fields upon CSV parse by escaping formula operators (`=`, `+`, `-`, `@`) with a leading `'`. |
| **FM-P9-08** | Email Gateway Quota Saturation (HTTP 429) | Firing 1,000 email invitations in 2 seconds triggers SendGrid / Postmark / WhatsApp rate limits. | Rate-limited token bucket throttle (20 dispatches/sec) with exponential backoff on provider HTTP 429 responses. |
| **FM-P9-09** | Large Zip Memory Exhaustion in e-Discovery Export | Generating a multi-gigabyte ZIP archive entirely in Node.js buffer memory causes OOM crash. | Stream ZIP generation using chunked buffer streaming (`archiver` or chunked zip generator) with maximum bundle size bounds. |
| **FM-P9-10** | Mobile Viewport Layout Breakage in Campaign Tables | Wide 10-column data tables causing horizontal scrolling and unclickable buttons on mobile. | Responsive data table with auto-collapse into mobile card layouts (`hidden md:table` vs `md:hidden flex flex-col gap-3`). |
| **FM-P9-11** | Unverified CRM Roster Desynchronization | CRM contacts modified or deleted between campaign staging and dispatch execution. | Pre-dispatch snapshot locks recipient data into campaign manifest; dispatches against immutable snapshot rather than live mutable contacts. |
| **FM-P9-12** | Premature Disposal on Statutory Retention Expiry | Retention countdown deletes contract without notifying compliance officer. | Configurable 30-day and 7-day disposal warning alerts emitted over deal/notification bus; requires human sign-off before actual disposal. |

---

## 4. Architectural Domain Model & Schema Specifications

### Data Structures (`src/lib/types/document-signing.ts`):

```ts
// 1. Bulk Campaign Status
export const BulkCampaignStatusSchema = z.enum([
  'draft',
  'validating',
  'ready',
  'dispatching',
  'active',
  'paused',
  'completed',
  'failed',
]);
export type BulkCampaignStatus = z.infer<typeof BulkCampaignStatusSchema>;

// 2. Bulk Campaign Recipient Item
export const BulkCampaignRecipientSchema = z.object({
  id: z.string().min(1),
  rowIndex: z.number().int().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  variables: z.record(z.string(), z.string()),
  status: z.enum(['queued', 'dispatched', 'delivered', 'signed', 'failed']),
  envelopeId: z.string().optional(),
  error: z.string().optional(),
  dispatchedAt: z.string().optional(),
  signedAt: z.string().optional(),
  idempotencyKey: z.string(),
});
export type BulkCampaignRecipient = z.infer<typeof BulkCampaignRecipientSchema>;

// 3. Bulk Campaign Aggregate Record
export const BulkCampaignSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  templateId: z.string().min(1),
  templateVersionId: z.string().optional(),
  status: BulkCampaignStatusSchema,
  totalCount: z.number().int().min(0),
  dispatchedCount: z.number().int().min(0),
  signedCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  routingMode: z.enum(['single_signer', 'sequential_countersign']),
  countersignerEmail: z.string().email().optional(),
  countersignerName: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type BulkCampaign = z.infer<typeof BulkCampaignSchema>;

// 4. e-Discovery Archival Manifest
export const EDiscoveryFileEntrySchema = z.object({
  path: z.string(),
  description: z.string(),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().min(0),
  mimeType: z.string(),
});

export const EDiscoveryManifestSchema = z.object({
  manifestVersion: z.literal('1.0.0'),
  contractId: z.string().min(1),
  envelopeId: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  exportedAt: z.string(),
  exportedByUserId: z.string().min(1),
  files: z.array(EDiscoveryFileEntrySchema).min(1),
  merkleRootSha256: z.string().length(64),
  legalHoldActive: z.boolean(),
  legalHoldDetails: z.object({
    matterId: z.string().optional(),
    reason: z.string().optional(),
    placedAt: z.string().optional(),
  }).optional(),
});
export type EDiscoveryManifest = z.infer<typeof EDiscoveryManifestSchema>;
```

---

## 5. Trackable Implementation Tasks & Milestones

### Task 1: Domain Schemas & Validation Contracts
**Files:**
- Modify: `src/lib/types/document-signing.ts`
- Create: `src/lib/documents/__tests__/bulk-campaign-schemas.test.ts`

- [ ] **Step 1: Define Phase 9 schemas in `document-signing.ts`**
  - Add `BulkCampaignStatusSchema`, `BulkCampaignRecipientSchema`, `BulkCampaignSchema`, `CreateBulkCampaignRequestSchema`, `EDiscoveryFileEntrySchema`, and `EDiscoveryManifestSchema`.
  - Export inferred TypeScript types.
  - Ensure zero `any` or `any[]` typing.

- [ ] **Step 2: Write domain schema test suite**
  - Verify valid payload validation, invalid email rejection, CSV formula sanitization schema checks, and Merkle manifest integrity.

- [ ] **Step 3: Verify and commit**
  - `pnpm test:run src/lib/documents/__tests__/bulk-campaign-schemas.test.ts`
  - `git commit -m "feat(docsigning): implement strict domain schemas for bulk campaigns, legal hold, and e-discovery manifests"`

---

### Task 2: CSV Parsing, Sanitization & Dry-Run Variable Merge Engine
**Files:**
- Create: `src/lib/documents/bulk-csv-merge-service.ts`
- Create: `src/lib/documents/__tests__/bulk-csv-merge-service.test.ts`

- [ ] **Step 1: Implement `bulk-csv-merge-service.ts`**
  - Functions:
    - `parseBulkRecipientCsv(csvContent: string): Promise<ParsedCsvResult>`
    - `sanitizeCsvCell(val: string): string` (strips formula injection `=`, `+`, `-`, `@`, `\t`, `\r` per FM-P9-07)
    - `validateTemplateVariableMapping(templateVariables: string[], rows: ParsedRow[]): VariableLintResult` (FM-P9-04)
    - `generateDryRunMergePreview(templateId: string, rows: ParsedRow[], sampleLimit = 5): Promise<MergePreviewResult>`
  - Route through `FieldsVariablesService.resolveTemplateVariables` (Rule 2).

- [ ] **Step 2: Write test suite**
  - Verify RFC 4180 CSV parsing, formula injection sanitization, missing variable detection, and dry-run preview formatting.

- [ ] **Step 3: Verify and commit**
  - `pnpm test:run src/lib/documents/__tests__/bulk-csv-merge-service.test.ts`
  - `git commit -m "feat(docsigning): implement bulk csv merge parser with dry-run linting and formula sanitization"`

---

### Task 3: Chunked Bulk Campaign Dispatch Queue & Idempotent Worker
**Files:**
- Create: `src/lib/documents/bulk-campaign-dispatcher-service.ts`
- Create: `src/lib/documents/__tests__/bulk-campaign-dispatcher-service.test.ts`

- [ ] **Step 1: Implement `bulk-campaign-dispatcher-service.ts`**
  - Functions:
    - `createBulkCampaign(workspaceId: string, input: CreateBulkCampaignInput): Promise<BulkCampaign>`
    - `stageBulkRecipients(campaignId: string, recipients: BulkCampaignRecipientInput[]): Promise<void>`
    - `dispatchCampaignBatchSlice(campaignId: string, batchSize = 25): Promise<DispatchSliceResult>` (FM-P9-01)
    - `retryFailedCampaignRecipients(campaignId: string): Promise<RetryResult>` (FM-P9-03)
    - `getCampaignProgress(campaignId: string): Promise<BulkCampaignProgress>`
  - Integrate token-bucket rate limiter (`api-rate-limiter-service.ts`) to cap gateway dispatch to 20/sec (FM-P9-08).
  - Use deterministic idempotency key per recipient (`idemp_${campaignId}_${email}_${hash}`) (FM-P9-02).

- [ ] **Step 2: Write test suite**
  - Test batch slicing, idempotency deduplication on resume, partial failure isolation, and retry targeting only failed rows.

- [ ] **Step 3: Verify and commit**
  - `pnpm test:run src/lib/documents/__tests__/bulk-campaign-dispatcher-service.test.ts`
  - `git commit -m "feat(docsigning): implement chunked bulk campaign dispatcher with partial-failure isolation and rate limiting"`

---

### Task 4: Enterprise Legal Hold & Statutory Retention Guard Engine
**Files:**
- Create: `src/lib/documents/legal-hold-service.ts`
- Modify: `src/app/actions/contract-actions.ts`
- Create: `src/lib/documents/__tests__/legal-hold-service.test.ts`

- [ ] **Step 1: Implement `legal-hold-service.ts`**
  - Functions:
    - `placeContractLegalHold(workspaceId: string, contractId: string, input: PlaceHoldInput): Promise<LegalHoldResult>`
    - `releaseContractLegalHold(workspaceId: string, contractId: string, input: ReleaseHoldInput): Promise<LegalHoldResult>`
    - `assertContractNotUnderLegalHold(contractId: string): Promise<void>` (Throws `LOCKED_UNDER_LEGAL_HOLD` if true)
    - `calculateRetentionSchedule(category: RetentionCategory, executedAt: string): RetentionSchedule`
  - Append immutable audit record to `signing_evidence` on hold toggle.

- [ ] **Step 2: Hook deletion guard into `deleteContractAction`**
  - In `src/app/actions/contract-actions.ts:deleteContractAction`, call `assertContractNotUnderLegalHold(contractId)` before deleting documents or Cloud Storage objects (FM-P9-05).

- [ ] **Step 3: Write test suite**
  - Test placing hold, releasing hold, deletion block when hold is active, and retention schedule calculation.

- [ ] **Step 4: Verify and commit**
  - `pnpm test:run src/lib/documents/__tests__/legal-hold-service.test.ts`
  - `git commit -m "feat(docsigning): implement enterprise legal hold enforcement and deletion guard"`

---

### Task 5: Cryptographic e-Discovery Archival Package & Merkle Manifest Generator
**Files:**
- Create: `src/lib/documents/ediscovery-archival-service.ts`
- Create: `src/lib/documents/__tests__/ediscovery-archival-service.test.ts`

- [ ] **Step 1: Implement `ediscovery-archival-service.ts`**
  - Functions:
    - `buildEDiscoveryManifest(contractId: string, artifacts: ArtifactPayload[]): EDiscoveryManifest`
    - `computeMerkleRootSha256(leafDigests: string[]): string` (FM-P9-06)
    - `assembleEDiscoveryZipBundle(workspaceId: string, contractId: string): Promise<{ zipBuffer: Buffer; manifest: EDiscoveryManifest }>`
  - Manifest bundle includes:
    1. `completed-contract.pdf` (vector signed PDF)
    2. `pre-execution-document.pdf` (original template PDF)
    3. `certificate-of-completion.pdf` (Phase 1 vector certificate)
    4. `evidence-ledger.json` (Phase 1 append-only evidence)
    5. `biometric-telemetry.json` (Phase 8 stroke entropy data if present)
    6. `manifest.json` (SHA-256 digests and Merkle root)
    7. `verify-manifest.sh` (standalone verification shell script)

- [ ] **Step 2: Write test suite**
  - Test SHA-256 calculation, Merkle root tree hashing, tamper detection (corrupted file causes verification failure), and bundle assembly.

- [ ] **Step 3: Verify and commit**
  - `pnpm test:run src/lib/documents/__tests__/ediscovery-archival-service.test.ts`
  - `git commit -m "feat(docsigning): implement cryptographic e-discovery archival package and merkle manifest generator"`

---

### Task 6: Server Actions for Bulk Campaigns, Legal Hold & e-Discovery
**Files:**
- Create: `src/app/actions/bulk-campaign-actions.ts`
- Create: `src/app/actions/compliance-archival-actions.ts`
- Create: `src/lib/documents/__tests__/phase9-server-actions.test.ts`

- [ ] **Step 1: Implement `bulk-campaign-actions.ts`**
  - `createBulkCampaignAction(input: unknown)`
  - `previewBulkCsvMergeAction(input: unknown)`
  - `dispatchBulkCampaignSliceAction(campaignId: string)`
  - `retryFailedCampaignRecipientsAction(campaignId: string)`
  - `getBulkCampaignProgressAction(campaignId: string)`
  - Enforce `requireAuth()` and `requireWorkspace()`.

- [ ] **Step 2: Implement `compliance-archival-actions.ts`**
  - `toggleContractLegalHoldAction(input: unknown)`
  - `updateRetentionCategoryAction(input: unknown)`
  - `generateEDiscoveryPackageAction(contractId: string)`
  - Enforce `requireAuth()` and `requireWorkspace()`.

- [ ] **Step 3: Write server action test suite**
  - Test authentication guards, workspace isolation, Zod input validation, and standardized error envelopes.

- [ ] **Step 4: Verify and commit**
  - `pnpm test:run src/lib/documents/__tests__/phase9-server-actions.test.ts`
  - `git commit -m "feat(docsigning): implement server actions for bulk campaigns, legal hold, and e-discovery compliance"`

---

### Task 7: Bulk Campaigns, Legal Hold & Compliance Vault Tab UI
**Files:**
- Create: `src/app/admin/finance/contracts/components/BulkCampaignsTab.tsx`
- Create: `src/app/admin/finance/contracts/components/BulkCampaignWizardModal.tsx`
- Create: `src/app/admin/finance/contracts/components/LegalHoldManagerModal.tsx`
- Modify: `src/app/admin/finance/contracts/ContractsClient.tsx`

- [ ] **Step 1: Implement `BulkCampaignWizardModal.tsx`**
  - 4-Step Stepper:
    1. Select Template (from published templates)
    2. Upload CSV / Select CRM Roster (file dropzone + CSV parser)
    3. Map Variables & Pre-Flight Lint (table showing CSV columns -> Template variables, dry-run preview)
    4. Confirm & Schedule Dispatch (review summary, countersigner option, dispatch confirmation)
  - Mobile ergonomics: touch targets `min-h-[44px]`, `active:scale-[0.97]`.

- [ ] **Step 2: Implement `LegalHoldManagerModal.tsx`**
  - View current legal hold status, matter reference, reason input, place/release buttons with confirm step.

- [ ] **Step 3: Implement `BulkCampaignsTab.tsx`**
  - Sub-views:
    - **Active Campaigns**: List of bulk campaigns with live progress bar, metrics (queued, dispatched, signed, failed), "Retry Failed" button.
    - **Compliance & Legal Hold**: Table of executed contracts with Legal Hold status badge, retention schedule, "Place Hold" / "Release Hold" trigger.
    - **e-Discovery Compliance Vault**: One-click "Export e-Discovery Package" with download loading spinner and verification summary.

- [ ] **Step 4: Mount 8th Tab in `ContractsClient.tsx`**
  - Add 8th tab: "Bulk Campaigns & Compliance" (`Layers` icon) alongside all existing 7 tabs.
  - Update `activeTab` state union: `'contracts' | 'templates' | 'obligations' | 'analytics' | 'governance' | 'migration' | 'developer' | 'campaigns'`.
  - Preserve all existing 7 tabs and modals completely intact.

- [ ] **Step 5: Verify and commit**
  - `git commit -m "feat(docsigning): implement agreements hub bulk campaigns and compliance vault console ui"`

---

### Task 8: Dedicated Phase 9 Integration & End-to-End Test Suite
**Files:**
- Create: `src/lib/__tests__/document-phase9.test.ts`

- [ ] **Step 1: Write comprehensive Phase 9 integration test suite**
  - Test 1: Full CSV parsing, formula injection sanitization, and variable mapping validation.
  - Test 2: Bulk campaign creation, recipient staging, and chunked slice dispatch execution.
  - Test 3: Idempotency deduplication preventing double-send on repeated slice requests (FM-P9-02).
  - Test 4: Partial-failure retry targeting only failed rows without resending signed ones (FM-P9-03).
  - Test 5: Legal hold placement freezing contract against deletion with `deleteContractAction` (FM-P9-05).
  - Test 6: Legal hold release audit logging and deletion unblocking.
  - Test 7: e-Discovery ZIP bundle assembly and Merkle root calculation (FM-P9-06).
  - Test 8: Merkle manifest tamper verification test (detecting altered files).
  - Test 9: End-to-end multi-tenant isolation across bulk campaigns and legal holds.

- [ ] **Step 2: Run test suite**
  - `pnpm test:run src/lib/__tests__/document-phase9.test.ts`
  - Expected: PASS (9/9 tests green).

- [ ] **Step 3: Verify and commit**
  - `git commit -m "test(docsigning): implement dedicated Phase 9 end-to-end integration test suite"`

---

### Task 9: Acceptance Gate & TypeScript/Lint Alignment
**Files:**
- Verification only

- [ ] **Step 1: Run comprehensive document test suite across all phases (Phases 0 through 9)**
  - Run: `pnpm test:run src/lib/documents/__tests__/*.test.ts src/lib/__tests__/document-phase*.test.ts src/lib/__tests__/*baseline.test.ts`
  - Expected: 80+ test files passed, 500+ tests green.

- [ ] **Step 2: Run strict TypeScript compiler verification**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Expected: 0 errors (`tsc --noEmit`).

- [ ] **Step 3: Run repository linter**
  - Run: `pnpm lint`
  - Expected: 0 errors, warnings within ceiling.

- [ ] **Step 4: Update Master Plan and mark tasks completed**
  - Commit final verification state to local git branch `main`.

---

## 6. Review Checkpoints & Acceptance Gate

Before Phase 9 is declared complete and ready for production, the following criteria must be satisfied:
1. **Zero `any` or `any[]` Typing**: Strict Zod schemas and TypeScript types on all CSV rows, bulk campaigns, legal hold actions, and e-Discovery manifests.
2. **Chunked Asynchronous Scalability**: Large recipient batches (500–5,000) execute in bounded slices (25–50) with token-bucket rate limiting without serverless timeouts.
3. **Partial-Failure Isolation**: Failed campaign rows are isolated and retryable without resending signed or delivered envelopes.
4. **Litigation Defense & Legal Hold**: Contracts under active legal hold cannot be deleted or purged under any circumstance.
5. **Cryptographic e-Discovery Completeness**: Export bundles include all 6 requisite artifacts with SHA-256 Merkle root verification.
6. **Continuous Quality Gate**: `pnpm typecheck` (0 errors), `pnpm test:run` (100% green across all 80+ suites), and zero uncommitted files.
