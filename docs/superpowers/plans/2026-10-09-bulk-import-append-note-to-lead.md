# Bulk Import: Append Incoming Field as CRM Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to assign an incoming spreadsheet column (e.g. "Personal Notes", "Remarks", "Comments") to be automatically created and appended as an authentic `EntityNote` (in the `entity_notes` collection) to each newly created lead during bulk import, rather than storing it as a plain entity field.

**Architecture:** 
- A dedicated `<AppendNoteCard>` component is rendered on the Mapping Page (`MappingStep.tsx`), allowing column selection, auto-detection, live row previews, note category selection (`general`, `call`, `meeting`, `followup`, `escalation`), and optional pinning.
- The selection is passed via `noteConfig` through `BulkUploadClient.tsx` into `ingestBatchAction`.
- The background ingestion worker (`processImportChunkBackground`) reads the note text from each row's raw payload, generates a typed `EntityNote` document, batches it into Firestore's `entity_notes` collection atomically alongside entity creation, and logs the corresponding activity.

**Tech Stack:** Next.js 16 (Turbopack), TypeScript, Firebase Admin SDK (Firestore batch writes), Tailwind CSS, shadcn/ui components (`Card`, `Select`, `Input`, `Badge`, `Switch`), Vitest.

---

### File Structure & Responsibility Map
1. `src/lib/import-types.ts`
   - Define `NoteImportConfig` interface.
   - Extend `IngestBatchOptions` with optional `noteConfig`.
   - Extend `ImportLogDoc._importConfig` with `noteConfig`.
2. `src/app/admin/entities/upload/components/AppendNoteCard.tsx` (New)
   - Self-contained UI card on the Mapping Page adhering to `theme.md` standards.
   - Column selector (`<Select>`), auto-detect badge (`<Sparkles>`), live data sample preview, note type picker, and pin toggle.
3. `src/app/admin/entities/upload/components/MappingStep.tsx`
   - Integrate `<AppendNoteCard>` with `noteConfig` and `setNoteConfig` callbacks.
4. `src/app/admin/entities/upload/BulkUploadClient.tsx`
   - Manage `noteConfig` state and auto-detect initial note column during `autoMapHeaders`.
   - Pass `noteConfig` to `MappingStep` and forward to `ingestBatchAction`.
5. `src/lib/bulk-upload-actions.ts`
   - Persist `noteConfig` in `_importConfig`.
   - In `processImportChunkBackground`, extract note text per row, construct `EntityNote` documents, and atomically write to `entity_notes`.
6. `src/lib/import-export/__tests__/note-import.test.ts` (New)
   - Unit tests verifying note column detection, document shape, and non-empty text validation.

---

### Task 1: Type Definitions (`src/lib/import-types.ts`)

**Files:**
- Modify: `src/lib/import-types.ts`

- [ ] **Step 1: Add `NoteImportConfig` interface**
  Add the following definition to `src/lib/import-types.ts`:
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

- [ ] **Step 2: Update `IngestBatchOptions`**
  Add `noteConfig?: NoteImportConfig | null;` to `IngestBatchOptions`.

- [ ] **Step 3: Verification**
  Run `pnpm typecheck` to verify no breaking type changes.

---

### Task 2: Unit Tests for Note Extraction & Configuration (`src/lib/import-export/__tests__/note-import.test.ts`)

**Files:**
- Create: `src/lib/import-export/__tests__/note-import.test.ts`
- Create/Modify: `src/lib/import-export/note-import-helpers.ts`

- [ ] **Step 1: Write unit tests**
  Test cases:
  1. Auto-detect note column header from list of headers (`['Name', 'Email', 'Personal Notes']` -> `'Personal Notes'`).
  2. Format note content with/without prefix (`formatNoteContent('Lead verified', 'Import Note')` -> `'[Import Note] Lead verified'`).
  3. Validate empty/whitespace strings are skipped (`shouldCreateNote('')` -> `false`).
  4. Validate `buildEntityNoteDoc` produces expected schema with valid timestamps, `entityId`, `workspaceId`, `content`, `createdBy`, and `isPinned`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run src/lib/import-export/__tests__/note-import.test.ts`
  Expected: FAIL (modules not yet implemented).

- [ ] **Step 3: Implement `src/lib/import-export/note-import-helpers.ts`**
  Implement helper functions:
  - `detectNoteColumn(headers: string[]): string | null`
  - `formatNoteContent(rawText: string, prefix?: string): string`
  - `buildEntityNotePayload(params: ...): EntityNote`

- [ ] **Step 4: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run src/lib/import-export/__tests__/note-import.test.ts`
  Expected: PASS (all tests pass).

---

### Task 3: Backend Ingestion Support (`src/lib/bulk-upload-actions.ts`)

**Files:**
- Modify: `src/lib/bulk-upload-actions.ts`

- [ ] **Step 1: Unpack and persist `noteConfig` in `ingestBatchAction`**
  Extract `noteConfig` from `options` and add to `_importConfig` in `importLogRef.set`:
  ```typescript
  _importConfig: {
      ...
      noteConfig: noteConfig || null,
  }
  ```

- [ ] **Step 2: Construct and batch write notes in `processImportChunkBackground`**
  In `processImportChunkBackground`:
  - Initialize `const pendingNoteDocs: any[] = [];` before row loop.
  - When an entity is successfully created (`existingEntity` is false), check if `cfg.noteConfig?.columnHeader` is present.
  - Extract note text from `rawPayload[cfg.noteConfig.columnHeader]`.
  - If text is non-empty, generate document with `id: adminDb.collection('entity_notes').doc().id` and push to `pendingNoteDocs`.
  - In `wb.commit()`:
    ```typescript
    for (const noteDoc of pendingNoteDocs) {
        wb.set(adminDb.collection('entity_notes').doc(noteDoc.id), noteDoc);
    }
    ```
  - Log activity `note_added` for the entity so it appears in the entity activity stream and unified timeline.

- [ ] **Step 3: Verification**
  Run `pnpm typecheck` to verify strict typing compliance.

---

### Task 4: Create `<AppendNoteCard>` Component (`src/app/admin/entities/upload/components/AppendNoteCard.tsx`)

**Files:**
- Create: `src/app/admin/entities/upload/components/AppendNoteCard.tsx`

- [ ] **Step 1: Component Implementation**
  - Card Header: `StickyNote` icon in theme container (`bg-amber-500/10 text-amber-600`), title: **"Append Note to Lead"**, with a single-circle info tooltip explaining: *"Select a column from your spreadsheet to automatically create and append as an official CRM note to each lead upon creation."*
  - Incoming Column Selector: `<Select>` listing all `headers`, with `-- No Note Column (Disabled) --` option.
  - Auto-detection trigger: If an incoming column like `"Personal Notes"`, `"Notes"`, `"Remarks"` is detected, show a "Suggested" badge with a `<Sparkles>` icon and one-click apply button.
  - Live Sample Preview Box: Renders the first 2-3 non-empty values from the selected column across `rawData` so the user can inspect actual note text before importing.
  - Note Options Accordion/Row:
    - **Note Type**: Selector for `general`, `followup`, `call`, `meeting`, `escalation`.
    - **Pin Note**: `<Switch>` or toggle for pinning note to the top of the entity's notes tab.
    - **Optional Prefix**: Input allowing custom prefixes (e.g. `[Imported]`, `[Initial Assessment]`).
  - Strict typing: Zero `any` or `any[]`.

- [ ] **Step 2: Component Verification**
  Run ESLint and TypeScript checks on the component.

---

### Task 5: Integration in Mapping Page & Client State (`BulkUploadClient.tsx` & `MappingStep.tsx`)

**Files:**
- Modify: `src/app/admin/entities/upload/BulkUploadClient.tsx`
- Modify: `src/app/admin/entities/upload/components/MappingStep.tsx`

- [ ] **Step 1: Manage `noteConfig` state in `BulkUploadClient.tsx`**
  - Add `const [noteConfig, setNoteConfig] = React.useState<NoteImportConfig | null>(null);`.
  - In `autoMapHeaders`, detect potential note columns using `detectNoteColumn(fileHeaders)`. If found, pre-populate `noteConfig`.
  - Pass `noteConfig` and `setNoteConfig` to `<MappingStep>`.
  - Pass `noteConfig` into `ingestBatchAction` call in `startExecution`.

- [ ] **Step 2: Render `<AppendNoteCard>` in `MappingStep.tsx`**
  - Place `<AppendNoteCard>` as a distinct card right after the Field Mapping Card.
  - Pass `headers`, `rawData`, `noteConfig`, and `setNoteConfig`.

- [ ] **Step 3: Verification**
  Verify the UI builds and behaves cleanly with zero regressions.

---

### Task 6: Final Verification & Test Execution

- [ ] **Step 1: Run Vitest Unit Tests**
  Run: `./node_modules/.bin/vitest run src/lib/import-export/__tests__/note-import.test.ts src/lib/import-export/__tests__/header-matcher.test.ts`
  Verify all tests pass.

- [ ] **Step 2: Run ESLint**
  Run: `./node_modules/.bin/eslint src/app/admin/entities/upload/BulkUploadClient.tsx src/app/admin/entities/upload/components/MappingStep.tsx src/app/admin/entities/upload/components/AppendNoteCard.tsx src/lib/bulk-upload-actions.ts src/lib/import-types.ts`
  Verify 0 errors and 0 warnings.

- [ ] **Step 3: Run Full TypeScript Check**
  Run: `pnpm typecheck`
  Verify exit code 0.
