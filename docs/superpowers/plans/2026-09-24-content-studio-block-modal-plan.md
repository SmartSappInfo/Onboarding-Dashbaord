# Content Studio Full-Screen Modal & Drag-and-Drop Block Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Content Studio from a cramped slide-over drawer into an industry-grade, full-screen distraction-free overlay modal equipped with a modular drag-and-drop block builder that directly reuses and extends the Page Builder's core block registry, block definitions, and metadata-driven property inspector.

**Architecture:** 
1. **Single Source of Truth Block Engine**: Directly binds to `@/lib/page-builder/registry` (`blockRegistry`, `allBlocks()`), rendering blocks via `BlockRenderer` and editing them via `AutoBlockEditor`. Any block additions, deletions, or styling adjustments made in the Page Builder or block templates automatically propagate across both builders.
2. **Full-Screen Distraction-Free Workspace**: A dedicated overlay modal (`ContentEditorModal`) replaces `ContentEditorDrawer`, featuring an ergonomic 3-pane layout (Block Palette, Sortable WYSIWYG Canvas, and Property Inspector) on desktop, transitioning to touch-friendly responsive drawers on mobile.
3. **Dual-Mode AST Storage & Search Parity**: Content items persist structured `blocks: PageBlock[]` while automatically synthesizing a clean plain-text string into `item.content` on save, preserving full-text search indexing, card excerpts, and backwards-compatible rendering in `PortalContentReaderClient`.
4. **Resilient Backoffice & No-Code Governance**: Backoffice administrators can save any custom block layout as a reusable starter template directly from the modal ("Save as Template") without engineering intervention.

**Tech Stack:** Next.js 15, React 19, TypeScript (strictly 0 `any` / 0 `any[]` / 0 unhandled `unknown`), Tailwind CSS v4, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, Framer Motion, Firebase Cloud Firestore.

---

## 10 Mandatory Architectural & Production Standards

Every phase and line of code must strictly conform to these 10 principles:
1. **Skill Conformance & Standards Enforcement**:
   - `next-best-practices`: Dynamic lazy-loading (`next/dynamic`) for heavy canvas, `@dnd-kit`, and modal components to protect initial page bundle. Explicit RSC boundaries in `/portal/[slug]/content/[type]/[itemSlug]`.
   - `vercel-react-best-practices`:
     - `rerender-memo`: Memoize `SortableBlockItem` with `React.memo` to eliminate cascading re-renders during active drag.
     - `rerender-functional-setstate`: Use functional updater forms (`setBlocks(prev => ...)`) for stable callbacks.
     - `rerender-use-deferred-value`: Defer inspector input updates (`useDeferredValue`) so high-frequency typing never blocks 60fps canvas painting.
     - `rendering-content-visibility`: Apply `content-visibility: auto; contain-intrinsic-size: 1px 120px;` to offscreen blocks to support 100+ blocks without layout thrashing.
   - `emilkowal-animations`:
     - `PointerSensor` activation constraints (`activationConstraint: { distance: 5 }`) to distinguish intentional drag from clicks.
     - Suppress iframe pointer events during drag (`isDragging ? 'pointer-events-none' : ''`) so mouse capture is never lost over video players.
     - Hardware acceleration (`will-change: transform`, avoid CSS custom properties inside 60fps drag loops).
     - Standard tactile feedback (`active:scale-[0.97]` on all buttons, duration <= 200ms).
   - `backend-design`:
     - Fetch-Enrich-Restore protocol: fetch item, synthesize AST search plain text, validate payload bounds (500KB cap), restore/persist atomically with version increment in subcollection.
     - Scoped tenant isolation (`organizationId`, `portalId`, `workspaceIds`).
   - `frontend-design`:
     - Unified Figtree typography across studio canvas and portal reader.
     - Dynamic portal CSS variables (`var(--portal-primary)`, `var(--portal-text)`, `var(--portal-background)`).
     - Refined editorial feel, subtle hover boundaries, intuitive drag handles, clear empty state cards.
2. **What Could Go Wrong & Systematic Resolutions**: All failure modes, edge cases, and quota bounds mapped in the Risk Matrix below.
3. **Cross-Subsystem Impact & No-Code Backoffice Governance**: Reader, search, syllabus player, and resource vault protected. Backoffice empowered with no-code template saving and studio badge indicators.
4. **Strict Typing & Everyday UI English**: Strictly 0 `any`, 0 `any[]`, 0 unhandled `unknown`. Clean everyday UI English ("Text & Headings", "Add Block", "Move Up", "Move Down", "Save Draft", "Publish Now"). Zero raw HTML or CSS leakage.
5. **Firebase Indexes, Security Rules & Protocols**: Firestore rules permit public read for published content; writes strictly guarded by `if isAuthorized()`. Composite indexes verified.
6. **Dependencies & Documentation**: Modern tooling (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) properly configured.
7. **Mobile-First & Touch Ergonomics**: `min-h-[44px]` touch targets, responsive sheets on mobile, 1-tap "Move Up / Move Down" buttons as a fail-safe mobile alternative to dragging.
8. **Security & Data Protection**: DOMPurify HTML sanitization, URL protocol validation (`http:`, `https:` only), rejection of embedded base64 data URIs.
9. **Performance Under Extreme Load**: Support 100+ blocks, heap memory management (8GB max-old-space-size for tsc), 500 KB block payload cap.
10. **Inline Architectural Documentation**: Explanatory comments detailing change rationales, caution zones, and testability pointers.

---

## What Could Go Wrong & Production Mitigations (Risk Matrix)

| Risk / Failure Mode | Likelihood & Impact | Architectural Mitigation Strategy |
|:---|:---|:---|
| **1. Data Drift & Search Desynchronization** | **High / Critical** | If an author edits blocks but `content` is not updated or diverges, the portal search engine and card snippets show stale or blank summaries. <br/>**Mitigation**: Implement `ContentService.extractPlainTextFromBlocks(blocks)` which runs atomically inside `createContentItem` and `updateContentItem`. It recursively extracts text from all text-bearing props (`title`, `content`, `description`, `caption`, `items`, etc.) into a synchronized plain-text string stored in `item.content`. |
| **2. Drag-and-Drop Jitter & 60fps Dropped Frames** | **Medium / High** | Dragging blocks on a canvas with heavy nested components (iframes, video players, rich text) causes layout thrashing and dropped frames. <br/>**Mitigation**: Follow `emilkowal-animations` and `vercel-react-best-practices`: use `PointerSensor` with `activationConstraint: { distance: 5 }`, memoize `SortableBlockItem` with `React.memo`, suppress iframe pointer events during drag (`isDragging ? 'pointer-events-none' : ''`), apply `will-change: transform`, and avoid CSS variables in active 60fps drag loops. |
| **3. Accidental Dismissal & Data Loss** | **High / High** | Author spends 20 minutes creating a curriculum lesson, then accidentally clicks the backdrop or hits Escape, losing all unsaved blocks. <br/>**Mitigation**: Track dirty state (`isDirty`). Intercept Escape key and close attempts with an alert modal ("Unsaved Changes"). Implement a debounced local storage backup (`content_draft_${portalId}_${itemId || 'new'}`) that auto-restores if a session is abruptly interrupted. |
| **4. Firestore 1MB Document Limit Breach** | **Low / Critical** | If authors paste huge base64 images into blocks, Firestore's 1MB document limit could be exceeded, throwing write failures. <br/>**Mitigation**: The property inspector uses `ImageUploader` and `VideoUploader` which upload binaries to Firebase Storage and only store lightweight CDN URLs. Add a payload size validation guard in `ContentService` that rejects payloads > 500KB with actionable toast feedback. |
| **5. Mobile Touch & Scroll Gesture Conflicts** | **Medium / Medium** | Vertical scrolling on mobile screens can trigger drag-and-drop handles inadvertently. <br/>**Mitigation**: Isolate drag triggers exclusively to the drag grip icon (`GripVertical`), configure `TouchSensor` with delay/tolerance, enforce `min-h-[44px]` touch targets, and provide 1-tap "Move Up / Move Down" buttons as a fail-safe mobile alternative to dragging. |
| **6. XSS Injection via User-Authored Blocks** | **Medium / Critical** | Malicious script tags or `javascript:` protocols inserted into block properties could compromise portal members. <br/>**Mitigation**: Sanitize all rendered HTML/markdown properties using `@/lib/page-builder/sanitize` before passing to DOM. Enforce strict link protocol validation (`http:`, `https:` only). |
| **7. Duplicate Block IDs in Cloned Templates** | **High / Medium** | Inserting a starter template twice or duplicating a block produces identical IDs, breaking `@dnd-kit` sortable keys. <br/>**Mitigation**: `instantiateContentTemplate()` and block clone handlers recursively generate fresh `blk_${type}_${Date.now()}_${random}` IDs for every block and nested child. |
| **8. Schema Desynchronization / Invalid Props** | **Medium / High** | Saved blocks missing required props could throw runtime errors inside `BlockRenderer`. <br/>**Mitigation**: Pass all blocks through `validateBlockProps(block)` which uses registered Zod schemas with fallback defaults, ensuring robust rendering without unhandled exceptions. |
| **9. Theme Color Inconsistency in Light/Dark Modes** | **Medium / Medium** | Blocks with hardcoded background or text colors clash when members toggle light/dark modes. <br/>**Mitigation**: Blocks use semantic classes and portal CSS variables (`var(--portal-primary)`, `var(--portal-text)`, `var(--portal-background)`). |
| **10. Ghost Search Results on Block Removal** | **Low / High** | Author removes all blocks on the canvas; stale plain text remains cached in `item.content`. <br/>**Mitigation**: `updateContentItem` explicitly checks if `input.blocks.length === 0` and resets `content = ''` unless explicit markdown body is provided (resolved in commit `a0377b35`). |

---

## Impact Analysis Across Pre-Existing Features

| Feature Subsystem | Potential Impact | Required Integration & Enhancement |
|:---|:---|:---|
| **Portal Content Reader** (`/portal/[slug]/content/*`) | Reader currently expects plain string `item.content`. Structured blocks would render blank. | Update `PortalContentReaderClient` with dual-mode rendering: if `item.blocks?.length` exists, render through `BlockRenderer` with portal brand CSS variables; otherwise render legacy markdown. |
| **Global Portal Search** (`PortalSearchModal`) | Global search queries `content_items` text fields. If text is nested in JSON blocks, matches fail. | Preserved 100% via the atomic `extractPlainTextFromBlocks` synthesis into `item.content`. |
| **Learning Curriculum & Lesson Player** (`/portal/[slug]/learn/*`) | Lessons are content items of type `'lesson'`. Instructors authoring rich lessons with video and checklists need syllabus integration. | Verify that lesson items authored in Content Studio load seamlessly in the curriculum syllabus player. |
| **Downloadable Resource Vault** (`/portal/[slug]/content/resource/*`) | Resources require worksheet download URLs, MIME types, and file size indicators alongside block guides. | Ensure the "Details & SEO" panel keeps `ContentMedia` inputs (file URL, MIME, size) in sync with the block canvas. |
| **Backoffice Content Management** (`PortalContentManager.tsx`) | Admins need visual clarity on which items are block-based vs legacy markdown, plus 1-click template creation. | Add a "Block Studio" badge in the content list and introduce a "Save as Template" action for recurring pedagogical layouts. |
| **No-Code Template Governance** (`portal_content_templates`) | Administrators need to create and curate reusable lesson/article templates without developer intervention. | Provide a "Save as Reusable Template" action in the studio top bar that persists layouts to Firestore with immediate availability in the template picker. |

---

## Firebase Indexes, Security Rules & Protocols

1. **Security Rules (`firestore.rules`)**:
   - `content_items/{itemId}` allows public read (`allow get, list: if true;`), ensuring member portal access without authentication barriers.
   - `create, update, delete` is strictly guarded by `if isAuthorized();`, ensuring only authenticated organization and workspace managers can author content.
   - Subcollection `versions/{versionId}` is guarded by `if isAuthorized();`.
   - `portal_content_templates/{templateId}` allows public read (`allow get, list: if true;`) and authenticated write (`allow create, update, delete: if isAuthorized();`).
2. **Composite Indexes (`firestore.indexes.json`)**:
   - Verified that the following composite indexes exist and cover all studio and portal queries:
     - `portalId (ASC) + updatedAt (DESC)`
     - `portalId (ASC) + type (ASC) + updatedAt (DESC)`
     - `portalId (ASC) + type (ASC) + status (ASC) + publishedAt (DESC)`
     - `portalId (ASC) + type (ASC) + category (ASC) + order (ASC)`
     - `portalId (ASC) + workspaceIds (ARRAY_CONTAINS) + status (ASC) + updatedAt (DESC)`
     - `portalId (ASC) + type (ASC) + slug (ASC)`
3. **Fetch-Enrich-Restore Protocol**:
   - Fetch item document and verify tenant tenancy.
   - Synthesize search text via `extractPlainTextFromBlocks(blocks)`.
   - Validate payload size <= 500 KB and reject base64 data URIs.
   - Restore/persist document atomically and create an immutable revision snapshot in `versions/{versionId}`.

---

## File Structure & Responsibilities

| File Path | Action | Architectural Responsibility |
|:---|:---|:---|
| `src/lib/types/content.ts` | Complete | Add `blocks?: PageBlock[]` to `ContentItem`, `CreateContentItemInput`, `UpdateContentItemInput`, and `ContentItemVersion`. Zero `any`. |
| `src/lib/services/content-service.ts` | Complete | Persist `blocks`, implement `extractPlainTextFromBlocks`, validate document payload size, and store plain-text AST cache. |
| `src/lib/services/__tests__/content-service.test.ts` | Complete | Unit test verifying block persistence, plain-text synthesis, empty-block reset, and revision snapshotting. |
| `src/lib/page-builder/templates/content-templates.ts` | Create | Starter templates for curriculum lessons, standard articles, downloadable resources, and knowledge base docs; ID regeneration helper. |
| `src/lib/page-builder/templates/index.ts` | Modify | Re-export `CONTENT_STARTER_TEMPLATES` in the global template library. |
| `src/lib/page-builder/registry.tsx` | Modify | Add `getContentStudioBlocks()` and `getContentStudioBlockCategories()` for clean palette rendering without marketing bloat. |
| `src/lib/page-builder/__tests__/content-templates.test.ts` | Create | Unit tests validating template catalog, schema compliance, ID uniqueness, and registry filters. |
| `src/app/admin/portals/components/studio/ContentBlockCanvas.tsx` | Create | Drag-and-drop sortable canvas using `@dnd-kit/sortable` and `BlockRenderer` with 60fps drag optimization, empty-state template picker. |
| `src/app/admin/portals/components/studio/SortableBlockItem.tsx` | Create | Individual sortable block wrapper with drag handle, move up/down, duplicate, delete, and focus ring. Suppresses nested iframe events. |
| `src/app/admin/portals/components/studio/BlockInsertButton.tsx` | Create | Touch-friendly "+ Add Block" hover line between blocks and at the end of the canvas. `min-h-[44px]` touch target. |
| `src/app/admin/portals/components/studio/ContentBlockPalette.tsx` | Create | Categorized block library sidebar with instant search and 1-click or drag-to-insert using `getContentStudioBlockCategories()`. |
| `src/app/admin/portals/components/studio/ContentBlockInspector.tsx` | Create | Dedicated inspector sidebar wrapping `AutoBlockEditor` for editing selected block properties with deferred input handling. |
| `src/app/admin/portals/components/ContentEditorModal.tsx` | Create | Full-screen overlay modal with top studio bar, 3-pane builder, Details/SEO tab, dirty state protection, `<TagSelector>`, and "Save as Template" no-code action. Replaces `ContentEditorDrawer.tsx`. |
| `src/app/admin/portals/components/PortalContentManager.tsx` | Modify | Mounts `<ContentEditorModal>` instead of `<ContentEditorDrawer>`, shows "Block Studio" badge in list. |
| `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx` | Modify | Dual-mode content renderer: renders `BlockRenderer` when `item.blocks` exist, falls back to markdown for legacy items. |

---

## Phase-by-Phase Implementation Plan

### Phase 1: Core Type Contracts, Payload Guards & Backend AST Support (COMPLETED)

**Files:**
- Modify: `src/lib/types/content.ts`
- Modify: `src/lib/services/content-service.ts`
- Modify: `src/app/actions/content-actions.ts`
- Test: `src/lib/services/__tests__/content-service.test.ts`

- [x] **Step 1: Write failing unit tests for block storage, text extraction & payload size guard**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update `src/lib/types/content.ts` with strict `PageBlock` contracts** (0 `any` / 0 `any[]`)
- [x] **Step 4: Implement `extractPlainTextFromBlocks` & payload size guard in `src/lib/services/content-service.ts`**
- [x] **Step 5: Run tests and verify they pass (10/10 passed)**
- [x] **Step 6: Commit changes locally** (`2d6d335e`, refined in `a0377b35`)

---

### Phase 2: Shared Content Templates & Registry Filtering (COMPLETED)

**Files:**
- Create: `src/lib/page-builder/templates/content-templates.ts`
- Modify: `src/lib/page-builder/templates/index.ts`
- Modify: `src/lib/page-builder/registry.tsx`
- Test: `src/lib/page-builder/__tests__/content-templates.test.ts`

- [x] **Step 1: Write failing unit tests for content starter templates & block filter**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Create `src/lib/page-builder/templates/content-templates.ts`**
- [x] **Step 4: Update `src/lib/page-builder/registry.tsx`**
- [x] **Step 5: Run tests and verify they pass (6/6 passing)**
- [x] **Step 6: Run strict static analysis (0 errors, 0 lint warnings)**
- [x] **Step 7: Commit changes locally** (`b008312a`)

---

### Phase 3: Lightweight Sortable Block Canvas & Item Controls

**Files:**
- Create: `src/app/admin/portals/components/studio/BlockInsertButton.tsx`
- Create: `src/app/admin/portals/components/studio/SortableBlockItem.tsx`
- Create: `src/app/admin/portals/components/studio/ContentBlockCanvas.tsx`

- [ ] **Step 1: Create `BlockInsertButton.tsx`**
  - Accessible `min-h-[44px]` touch target "+ Add Block" hover line between blocks and at canvas bottom.
  - Plain English label, tactile feedback with `active:scale-[0.97]`.
- [ ] **Step 2: Create `SortableBlockItem.tsx`**
  - Wraps `BlockRenderer` with `@dnd-kit/sortable` `useSortable`.
  - Suppresses pointer events on nested iframes during drag (`isDragging ? 'pointer-events-none' : ''`).
  - Controls toolbar: Drag Grip, Move Up, Move Down, Duplicate, Delete, Focus Outline.
  - 1-tap Move Up / Move Down buttons provide mobile-friendly alternative to dragging.
  - Memoized via `React.memo` for 60fps performance (`vercel-react-best-practices`).
- [ ] **Step 3: Create `ContentBlockCanvas.tsx`**
  - Wraps canvas in `@dnd-kit/core` `DndContext` and `SortableContext`.
  - Configures `PointerSensor` (`activationConstraint: { distance: 5 }`) and `TouchSensor` (`delay: 150, tolerance: 5`).
  - **Empty Canvas State**: Displays 4 interactive starter template cards (`CONTENT_STARTER_TEMPLATES`). 1-click hydration using `instantiateContentTemplate()`.
  - Applies `content-visibility: auto; contain-intrinsic-size: 1px 120px;` to support 100+ blocks without layout lag.
- [ ] **Step 4: Commit changes locally**
  - `git commit -m "feat(content-studio): implement SortableBlockItem and ContentBlockCanvas with drag-and-drop reordering"`

---

### Phase 4: Block Palette & Property Inspector Panels

**Files:**
- Create: `src/app/admin/portals/components/studio/ContentBlockPalette.tsx`
- Create: `src/app/admin/portals/components/studio/ContentBlockInspector.tsx`

- [ ] **Step 1: Create `ContentBlockPalette.tsx`**
  - Renders blocks grouped by `getContentStudioBlockCategories()`.
  - Everyday plain-English labels (Text & Headings, Media & Forms, Steps & Lists, Layout Containers, Callouts & Quotes).
  - Search filter input for instant lookup.
  - 1-click or drag-to-insert into canvas.
- [ ] **Step 2: Create `ContentBlockInspector.tsx`**
  - Dedicated property inspector wrapping `AutoBlockEditor`.
  - Uses `useDeferredValue` for high-frequency text input to prevent canvas jank.
  - Actions: Reset to Defaults, Delete Block, Deselect.
- [ ] **Step 3: Commit changes locally**
  - `git commit -m "feat(content-studio): implement ContentBlockPalette and ContentBlockInspector"`

---

### Phase 5: Full-Screen Studio Overlay Modal & Tag Selector Integration

**Files:**
- Create: `src/app/admin/portals/components/ContentEditorModal.tsx`
- Modify: `src/app/admin/portals/components/PortalContentManager.tsx`

- [ ] **Step 1: Create `ContentEditorModal.tsx`**
  - Full-screen distraction-free modal (`fixed inset-0 z-50 bg-background flex flex-col`).
  - Dirty state tracking (`isDirty`) with unsaved changes dialog.
  - Debounced auto-save backup to `localStorage` (`content_draft_${portalId}_${itemId || 'new'}`).
  - Standardized `<TagSelector>` in client/draft mode (`currentTagIds={tags}`, `onTagsChange={setTags}`).
  - Top Studio Bar: Title inline editor, slug editor, type selector, Mode Switcher ("Block Studio" vs "Details & SEO"), Save Draft, Publish Now, keyboard shortcut (`Cmd/Ctrl + S`).
  - **No-Code Template Saving**: "Save as Template" action saving layout to `portal_content_templates`.
- [ ] **Step 2: Update `PortalContentManager.tsx`**
  - Mount `<ContentEditorModal>` instead of `ContentEditorDrawer`.
  - Add visual "Block Studio" badge in content list for block-authored items.
- [ ] **Step 3: Commit changes locally**
  - `git commit -m "feat(content-studio): replace slide-over drawer with full-screen ContentEditorModal and standardized TagSelector"`

---

### Phase 6: Portal Content Reader Dual-Mode Rendering

**Files:**
- Modify: `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx`

- [ ] **Step 1: Update `PortalContentReaderClient.tsx` to render `BlockRenderer` for structured blocks**
  - Dual-mode body: If `item.blocks && item.blocks.length > 0`, render `BlockRenderer` with portal brand CSS variables (`var(--portal-primary)`); otherwise render legacy markdown.
  - Figtree typography preserved throughout.
- [ ] **Step 2: Commit changes locally**
  - `git commit -m "feat(portal-reader): enable dual-mode BlockRenderer with fallback to legacy markdown"`

---

### Phase 7: Verification, Strict Type Checking & Browser Audit

**Files:**
- Complete verification across all modified subsystems

- [ ] **Step 1: Run complete Vitest suite**
  - Run: `npx vitest run src/lib/services/__tests__/content-service.test.ts src/lib/page-builder/__tests__/content-templates.test.ts`
  - Expected: 100% tests passing.
- [ ] **Step 2: Run strict TypeScript static analysis**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
  - Expected: 0 errors. Confirm strictly 0 `any` / 0 `any[]` / 0 unhandled `unknown`.
- [ ] **Step 3: Run ESLint**
  - Run: `npx eslint src/app/admin/portals/components/ContentEditorModal.tsx src/app/admin/portals/components/studio/`
  - Expected: 0 lint errors.
- [ ] **Step 4: DevTools browser verification**
  - Navigate to `http://localhost:9002/admin/portals` in Chrome DevTools MCP:
    1. Click "Add Content" -> Verify full-screen overlay opens smoothly without horizontal scroll or FOUC.
    2. Empty canvas shows 4 starter template cards. Click "Interactive Curriculum Lesson" -> Verify canvas populates instantly with video, objectives, checklist, and FAQ.
    3. Drag and drop / reorder blocks with 60fps fluidity.
    4. Select a block -> Verify `AutoBlockEditor` opens in inspector and updates canvas live.
    5. Switch to "Details & SEO" -> Verify `<TagSelector>` functions smoothly.
    6. Click "Save Draft" -> Verify document saves with structured `blocks` and synthesized plain-text `content`.
    7. Open `/portal/academy/content/...` in reader -> Verify blocks render crisply with Figtree typography and zero hydration errors.
- [ ] **Step 5: Final local commit**
  - `git commit -am "chore(content-studio): finalize verified full-screen modal block builder"`
