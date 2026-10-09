# Bulk Import: Append Incoming Field as CRM Note & Duplicate Tagging Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. Allow users to assign an incoming spreadsheet column (e.g. "Personal Notes", "Remarks", "Comments") on the Mapping page to be automatically created and appended as an authentic `EntityNote` (in the `entity_notes` collection) to each newly created lead during bulk import, rather than storing it as a plain entity field.
2. Provide a dedicated toggle in the Tag Configuration Card ("Add tags if lead already exists") allowing users to control whether the batch's tags are automatically appended to existing matching leads when duplicates are encountered, including when "Skip Identical" or other resolution options are chosen.

**Architecture:** 
- A dedicated `<AppendNoteCard>` component is rendered on the Mapping Page (`MappingStep.tsx`), providing column selection, auto-detection, live row previews, note category selection (`general`, `call`, `meeting`, `followup`, `escalation`), and optional pinning.
- A toggle switch is placed in the Tag Configuration Card (`DefaultSettingsStep.tsx`) to configure `addTagsToDuplicates: boolean`.
- Both settings are passed via `noteConfig` and `addTagsToDuplicates` through `BulkUploadClient.tsx` into `ingestBatchAction` and stored in `_importConfig`.
- In `processImportChunkBackground`, when a new entity is created, non-empty note text from the configured column is instantiated as a typed `EntityNote` document and atomically committed to Firestore's `entity_notes` collection within the chunk batch.
- In `resolveDuplicatesAction`, when `addTagsToDuplicates` is enabled, the `SKIP` resolution branch (including "Skip Identical") uses safe array length validation `(tagIds && tagIds.length > 0) ? tagIds : effectiveResolutionTags` to append the import's tags to existing records via `FieldValue.arrayUnion`. When disabled, `SKIP` leaves the existing lead untouched.

**Tech Stack:** Next.js 16 (Turbopack), TypeScript, Firebase Admin SDK (Firestore batch writes & atomic arrayUnion), Tailwind CSS, shadcn/ui (`Card`, `Select`, `Input`, `Badge`, `Switch`), Vitest.

---

### Governance & Compliance Review against `agent_mcp_rules.md`

| Rule | Requirement | How This Plan Conforms |
| :--- | :--- | :--- |
| **Rule 1: Best Practices & Framework Guidance** | Conform to `next-best-practices`, `vercel-react-best-practices`, `frontend-design`, `backend-design`. | Modular component decomposition, server action boundaries, zero client hydration mismatch. |
| **Rule 2: What Could Go Wrong & Edge Cases** | Identify failure modes and scalability bottlenecks. | Handled: empty/whitespace notes skipped; max note length protected; array truthiness bug resolved; idempotent tag unioning. |
| **Rule 3: Downstream & Backoffice Impact** | Ensure no breakage across modules; backoffice inherits automatically. | Writes to canonical `entity_notes` collection, which is automatically surfaced in `EntityNotesTab`, `EntityNotesWidget`, timeline, and quick notes aggregator without backoffice code changes. |
| **Rule 4: Strict Typing Protocol** | Zero `any`, `any[]`, or unchecked casts. | Strictly typed interfaces: `NoteImportConfig`, `EntityNote`, `IngestBatchOptions`, `DuplicateStrategy`. |
| **Rule 5: Deployment Protocol** | Staging verification before production; no unattended pushes. | No commits will be pushed to `origin/main` without explicit user instruction. |
| **Rule 7: Mobile & Accessibility First** | Touch targets $\ge$ 44px, clean everyday English, minimal clutter. | `min-h-[44px]` touch targets, `<CardInfoTooltip>` for descriptions, responsive layout, tactile `active:scale-[0.97]`. |
| **Rule 8: Security & Multi-Tenancy** | Guard against data leaks, injection, and unauthorized writes. | `requireAuth()`, tenant isolation (`workspaceId` and `organizationId` enforced), string trimming/sanitization. |
| **Rule 9: Load & Batch Scalability** | Prevent batch processing overload or resource exhaustion. | Reuses existing chunking (`IMPORT_CHUNK_SIZE = 30`), ensuring writes stay well within Firestore's 500-op batch limit. |
| **Rule 10: Inline Architectural Guides** | Leave explanatory comments detailing what changed and why. | Every file touched will contain clear architectural headers and inline comments. |

---

### File Structure & Responsibility Map

1. `src/lib/import-types.ts`
   - Define `NoteImportConfig` interface.
   - Extend `IngestBatchOptions` with `noteConfig` and `addTagsToDuplicates`.
   - Extend `ImportLogDoc._importConfig` with `noteConfig` and `addTagsToDuplicates`.
2. `src/lib/import-export/note-import-helpers.ts` (New)
   - Pure, testable helper functions: `detectNoteColumn`, `formatNoteContent`, and `buildEntityNotePayload`.
3. `src/lib/import-export/__tests__/note-import.test.ts` (New)
   - Unit tests verifying note detection, prefix formatting, empty/whitespace validation, and note payload schema.
4. `src/app/admin/entities/upload/components/AppendNoteCard.tsx` (New)
   - Self-contained UI card on the Mapping Page adhering to `theme.md` standards.
   - Column selector (`<Select>`), auto-detect badge (`<Sparkles>`), live data sample preview, note type picker, and pin toggle.
5. `src/app/admin/entities/upload/components/MappingStep.tsx`
   - Integrate `<AppendNoteCard>` with `noteConfig` and `setNoteConfig` callbacks.
6. `src/app/admin/entities/upload/components/DefaultSettingsStep.tsx`
   - Add the **"Add Tags If Lead Already Exists (Duplicates)"** toggle in the Tag Configuration Card.
7. `src/app/admin/entities/upload/BulkUploadClient.tsx`
   - Manage `noteConfig` and `addTagsToDuplicates` state.
   - Auto-detect initial note column during `autoMapHeaders`.
   - Pass both configurations through to `ingestBatchAction`.
8. `src/lib/bulk-upload-actions.ts`
   - Persist `noteConfig` and `addTagsToDuplicates` in `_importConfig`.
   - In `processImportChunkBackground`, extract note text per row, construct `EntityNote` documents, and atomically write to `entity_notes`.
   - In `resolveDuplicatesAction`, fix the array truthiness check `(tagIds && tagIds.length > 0) ? tagIds : effectiveResolutionTags` and respect `addTagsToDuplicates` for `SKIP`.
9. `src/app/admin/entities/imports/components/DuplicateResolutionPortal.tsx`
   - Update `handleSkipIdentical` to respect `addTagsToDuplicates` and display a clear indicator in the duplicate resolution toolbar.

---

### Task 1: Type Definitions (`src/lib/import-types.ts`)

**Files:**
- Modify: `src/lib/import-types.ts`

- [ ] **Step 1: Add `NoteImportConfig` and extend options**
  ```typescript
  export interface NoteImportConfig {
    /** Incoming column header from the spreadsheet */
    columnHeader: string;
    /** Note category type (defaults to 'general') */
    noteType?: 'general' | 'call' | 'meeting' | 'escalation' | 'followup';
    /** Whether the note should be pinned to the top of the entity's notes */
    isPinned?: boolean;
    /** Optional prefix prepended to note body (e.g. "Imported Note") */
    prefix?: string;
  }
  ```
  Add to `IngestBatchOptions`:
  ```typescript
  noteConfig?: NoteImportConfig | null;
  addTagsToDuplicates?: boolean;
  ```

- [ ] **Step 2: Verification**
  Run `pnpm typecheck` to verify no breaking type changes.

---

### Task 2: Helper Functions & Unit Tests (`note-import-helpers.ts` & `note-import.test.ts`)

**Files:**
- Create: `src/lib/import-export/note-import-helpers.ts`
- Create: `src/lib/import-export/__tests__/note-import.test.ts`

- [ ] **Step 1: Write unit tests in `note-import.test.ts`**
  Test cases:
  1. Auto-detect note column header from list of headers (`['Name', 'Email', 'Personal Notes']` -> `'Personal Notes'`).
  2. Format note content with prefix (`formatNoteContent('Lead verified', 'Import Note')` -> `'[Import Note] Lead verified'`).
  3. Validate empty/whitespace strings are rejected (`isValidNoteText('   ')` -> `false`).
  4. Validate `buildEntityNotePayload` creates complete `EntityNote` shape with ISO dates, author info, and `source: 'bulk_import'`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run src/lib/import-export/__tests__/note-import.test.ts`
  Expected: FAIL (modules not yet implemented).

- [ ] **Step 3: Implement `note-import-helpers.ts`**
  Implement:
  - `detectNoteColumn(headers: string[]): string | null`
  - `formatNoteContent(rawText: string, prefix?: string): string`
  - `isValidNoteText(text: unknown): boolean`
  - `buildEntityNotePayload(...)`

- [ ] **Step 4: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run src/lib/import-export/__tests__/note-import.test.ts`
  Expected: PASS (all tests pass).

---

### Task 3: Backend Ingestion & Duplicate Resolution Updates (`bulk-upload-actions.ts`)

**Files:**
- Modify: `src/lib/bulk-upload-actions.ts`

- [ ] **Step 1: Persist configuration in `ingestBatchAction`**
  Extract `noteConfig` and `addTagsToDuplicates = true` from `options` and store in `_importConfig`.

- [ ] **Step 2: Construct and batch write notes in `processImportChunkBackground`**
  In `processImportChunkBackground`:
  - When a new entity is created (`existingEntity` is false), inspect `cfg.noteConfig?.columnHeader`.
  - If raw row has valid note text, construct `EntityNote` document and push to `pendingNoteDocs`.
  - In `wb.commit()`: write `pendingNoteDocs` to `adminDb.collection('entity_notes').doc(noteDoc.id)`.

- [ ] **Step 3: Fix duplicate tagging fallback in `resolveDuplicatesAction`**
  - Read `addTagsToDuplicates = cfg.addTagsToDuplicates !== false`.
  - Replace naive `tagIds || effectiveResolutionTags` with:
    ```typescript
    const finalTagsForReconciliation = (tagIds && tagIds.length > 0) ? tagIds : effectiveResolutionTags;
    ```
  - For `strategy === 'SKIP'`:
    - If `addTagsToDuplicates` is `true`: update `existingEntityRef` with `FieldValue.arrayUnion(...finalTagsForReconciliation)`.
    - If `addTagsToDuplicates` is `false`: do not perform tag update.

- [ ] **Step 4: Verification**
  Run `pnpm typecheck` to verify zero type regressions.

---

### Task 4: UI Card Component: `<AppendNoteCard>` (`AppendNoteCard.tsx`)

**Files:**
- Create: `src/app/admin/entities/upload/components/AppendNoteCard.tsx`

- [ ] **Step 1: Component Implementation**
  - Design standard: Card with `rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden`.
  - CardHeader: `StickyNote` icon in `bg-amber-500/10 text-amber-600` container, title: **"Append Note to Lead"**, with `<CardInfoTooltip>` explanation.
  - Column dropdown (`<Select>`) with option `-- Do not append a note --` and all file `headers`.
  - Auto-detection chip with `<Sparkles>` if a note column is recognized.
  - Live data sample preview showing first 2–3 non-empty values from the selected column across `rawData`.
  - Options panel:
    - Note Type Selector: `general`, `followup`, `call`, `meeting`, `escalation`.
    - Pin Note Toggle: `<Switch>` for `isPinned`.
    - Optional Prefix Input: text input (e.g. `[Imported Note]`).
  - Mobile touch targets $\ge$ 44px (`min-h-[44px]`).

- [ ] **Step 2: Component Verification**
  Run ESLint on `AppendNoteCard.tsx`.

---

### Task 5: Tag Configuration Card Update (`DefaultSettingsStep.tsx`)

**Files:**
- Modify: `src/app/admin/entities/upload/components/DefaultSettingsStep.tsx`

- [ ] **Step 1: Add "Add Tags If Lead Already Exists" Toggle**
  Inside the Tag Configuration Card right below the `<TagSelector>`:
  - Add switch for `addTagsToDuplicates`.
  - Clear label: **"Add Tags If Lead Already Exists (Duplicates)"**.
  - Subtext: *"Append the selected batch tags to matching existing leads, even when 'Skip Identical' or other duplicate resolutions are selected."*
  - Strict touch target sizing (`min-h-[44px]`).

---

### Task 6: Client Wiring & Duplicate Portal Updates

**Files:**
- Modify: `src/app/admin/entities/upload/BulkUploadClient.tsx`
- Modify: `src/app/admin/entities/upload/components/MappingStep.tsx`
- Modify: `src/app/admin/entities/imports/components/DuplicateResolutionPortal.tsx`

- [ ] **Step 1: Manage state in `BulkUploadClient.tsx`**
  - Add state for `noteConfig` and `addTagsToDuplicates` (defaulting to `true`).
  - Auto-detect note column in `autoMapHeaders`.
  - Pass `noteConfig` to `MappingStep` and `addTagsToDuplicates` to `DefaultSettingsStep`.
  - Forward both to `ingestBatchAction`.

- [ ] **Step 2: Integrate `<AppendNoteCard>` in `MappingStep.tsx`**
  - Render `<AppendNoteCard>` on the Mapping page.

- [ ] **Step 3: Update `DuplicateResolutionPortal.tsx`**
  - In `handleSkipIdentical`, respect `addTagsToDuplicates` from `importLog._importConfig`.
  - Surface a subtle badge in the resolution toolbar: `🏷️ Add tags to duplicates: Enabled/Disabled`.

---

### Task 7: Comprehensive Verification & Quality Assurance

- [ ] **Step 1: Unit Tests**
  Run: `./node_modules/.bin/vitest run src/lib/import-export/__tests__/note-import.test.ts src/lib/import-export/__tests__/header-matcher.test.ts`
  Verify all tests pass.

- [ ] **Step 2: ESLint**
  Run: `./node_modules/.bin/eslint src/app/admin/entities/upload/BulkUploadClient.tsx src/app/admin/entities/upload/components/MappingStep.tsx src/app/admin/entities/upload/components/DefaultSettingsStep.tsx src/app/admin/entities/upload/components/AppendNoteCard.tsx src/lib/bulk-upload-actions.ts src/lib/import-types.ts src/app/admin/entities/imports/components/DuplicateResolutionPortal.tsx`
  Verify 0 errors and 0 warnings.

- [ ] **Step 3: TypeScript Verification**
  Run: `pnpm typecheck`
  Verify code 0 (zero errors).
