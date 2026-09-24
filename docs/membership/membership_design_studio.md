# Content Studio Full-Screen Modal & Drag-and-Drop Block Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Content Studio from a cramped slide-over drawer into an industry-grade, full-screen distraction-free overlay modal equipped with a modular drag-and-drop block builder that directly reuses and extends the Page Builder's core block registry, block definitions, and metadata-driven property inspector.

**Architecture:** 
1. **Single Source of Truth Block Engine**: Directly binds to `@/lib/page-builder/registry` (`blockRegistry`, `allBlocks()`), rendering blocks via `BlockRenderer` and editing them via `AutoBlockEditor`. Any block additions, deletions, or styling adjustments made in the Page Builder or block templates automatically propagate across both builders.
2. **Full-Screen Distraction-Free Workspace**: A dedicated overlay modal (`ContentEditorModal`) replaces `ContentEditorDrawer`, featuring an ergonomic 3-pane layout (Block Palette, Sortable WYSIWYG Canvas, and Property Inspector) on desktop, transitioning to touch-friendly responsive drawers on mobile.
3. **Dual-Mode AST Storage & Search Parity**: Content items persist structured `blocks: PageBlock[]` while automatically synthesizing a clean plain-text string into `item.content` on save, preserving full-text search indexing, card excerpts, and backwards-compatible rendering in `PortalContentReaderClient`.
4. **Resilient Backoffice & No-Code Governance**: Backoffice administrators can save any custom block layout as a reusable starter template directly from the modal ("Save as Template") without engineering intervention.

**Tech Stack:** Next.js 15, React 19, TypeScript (strictly 0 `any` / 0 `any[]`), Tailwind CSS v4, `@dnd-kit/core`, `@dnd-kit/sortable`, Framer Motion, Firebase Cloud Firestore.

---

## What Could Go Wrong & Production Mitigations (Risk Matrix)

| Risk / Failure Mode | Likelihood & Impact | Architectural Mitigation Strategy |
|:---|:---|:---|
| **1. Data Drift & Search Desynchronization** | **High / Critical** | If an author edits blocks but `content` is not updated or diverges, the portal search engine and card snippets show stale or blank summaries. <br/>**Mitigation**: Implement `ContentService.extractPlainTextFromBlocks(blocks)` which runs atomically inside `createContentItem` and `updateContentItem`. It recursively extracts text from all text-bearing props (`title`, `content`, `description`, `items`) into a synchronized plain-text string stored in `item.content`. |
| **2. Drag-and-Drop Jitter & 60fps Dropped Frames** | **Medium / High** | Dragging blocks on a canvas that has nested heavy components (iframes, video players, complex text) causes layout thrashing and dropped frames. <br/>**Mitigation**: Follow `emilkowal-animations` and `vercel-react-best-practices`: use `PointerSensor` with `activationConstraint: { distance: 5 }`, memoize `SortableBlockItem` with `React.memo`, suppress iframe pointer events during drag (`isDragging ? 'pointer-events-none' : ''`), apply `will-change: transform`, and avoid CSS variables in active 60fps drag loops. |
| **3. Accidental Dismissal & Data Loss** | **High / High** | Author spends 20 minutes creating a curriculum lesson, then accidentally clicks the backdrop or hits Escape, losing all unsaved blocks. <br/>**Mitigation**: Track dirty state (`isDirty`). Intercept Escape key and close attempts with an alert modal ("Unsaved Changes"). Implement a debounced local storage backup (`content_draft_${portalId}_${itemId || 'new'}`) that auto-restores if a session is abruptly interrupted. |
| **4. Firestore 1MB Document Limit Breach** | **Low / Critical** | If authors paste huge base64 images into blocks, Firestore's 1MB document limit could be exceeded, throwing write failures. <br/>**Mitigation**: The property inspector uses `ImageUploader` and `VideoUploader` which upload binaries to Firebase Storage and only store lightweight CDN URLs. Add a payload size validation guard in `ContentService` that rejects payloads > 500KB with actionable toast feedback. |
| **5. Mobile Touch & Scroll Gesture Conflicts** | **Medium / Medium** | Vertical scrolling on mobile screens can trigger drag-and-drop handles inadvertently. <br/>**Mitigation**: Isolate drag triggers exclusively to the drag grip icon (`GripVertical`), configure `TouchSensor` with delay/tolerance, enforce `min-h-[44px]` touch targets, and provide 1-tap "Move Up / Move Down" buttons as a fail-safe mobile alternative to dragging. |
| **6. XSS Injection via User-Authored Blocks** | **Medium / Critical** | Malicious script tags or `javascript:` protocols inserted into block properties could compromise portal members. <br/>**Mitigation**: Sanitize all rendered HTML/markdown properties using `@/lib/page-builder/sanitize` before passing to DOM. Enforce strict link protocol validation (`http:`, `https:` only). |

---

## Impact Analysis Across Pre-Existing Features

| Feature Subsystem | Potential Impact | Required Integration & Enhancement |
|:---|:---|:---|
| **Portal Content Reader** (`/portal/[slug]/content/*`) | Reader currently expects plain string `item.content`. Structured blocks would render blank. | Update `PortalContentReaderClient` with dual-mode rendering: if `item.blocks?.length` exists, render through `BlockRenderer` with portal brand CSS variables; otherwise render legacy markdown. |
| **Global Portal Search** (`PortalSearchModal`) | Global search queries `content_items` text fields. If text is nested in JSON blocks, matches fail. | Preserved 100% via the atomic `extractPlainTextFromBlocks` synthesis into `item.content`. |
| **Learning Curriculum & Lesson Player** (`/portal/[slug]/learn/*`) | Lessons are content items of type `'lesson'`. Instructors authoring rich lessons with video and checklists need syllabus integration. | Verify that lesson items authored in Content Studio load seamlessly in the curriculum syllabus player. |
| **Downloadable Resource Vault** (`/portal/[slug]/content/resource/*`) | Resources require worksheet download URLs, MIME types, and file size indicators alongside block guides. | Ensure the "Details & SEO" panel keeps `ContentMedia` inputs (file URL, MIME, size) in sync with the block canvas. |
| **Backoffice Content Management** (`PortalContentManager.tsx`) | Admins need visual clarity on which items are block-based vs legacy markdown, plus 1-click template creation. | Add a "Block Studio" badge in the content list and introduce a "Save as Template" action for recurring pedagogical layouts. |

---

## Firebase Indexes & Security Rules Verification

1. **Security Rules (`firestore.rules`)**:
   - `content_items/{itemId}` already allows public read (`allow get, list: if true;`), ensuring member portal access without authentication barriers.
   - `create, update, delete` is strictly guarded by `if isAuthorized();`, ensuring only authenticated organization and workspace managers can author content.
   - Subcollection `versions/{versionId}` is guarded by `if isAuthorized();`.
2. **Composite Indexes (`firestore.indexes.json`)**:
   - Verified that the following composite indexes exist and cover all studio and portal queries:
     - `portalId (ASC) + updatedAt (DESC)`
     - `portalId (ASC) + type (ASC) + updatedAt (DESC)`
     - `portalId (ASC) + type (ASC) + status (ASC) + publishedAt (DESC)`
     - `portalId (ASC) + type (ASC) + category (ASC) + order (ASC)`
     - `portalId (ASC) + workspaceIds (ARRAY_CONTAINS) + status (ASC) + updatedAt (DESC)`
     - `portalId (ASC) + type (ASC) + slug (ASC)`

---

## File Structure & Responsibilities

| File Path | Action | Architectural Responsibility |
|:---|:---|:---|
| `src/lib/types/content.ts` | Modify | Add `blocks?: PageBlock[]` to `ContentItem`, `CreateContentItemInput`, `UpdateContentItemInput`, and `ContentItemVersion`. Zero `any`. |
| `src/lib/services/content-service.ts` | Modify | Persist `blocks`, implement `extractPlainTextFromBlocks`, validate document payload size, and store plain-text AST cache. |
| `src/lib/services/__tests__/content-service.test.ts` | Modify | Unit test verifying block persistence, plain-text synthesis, and revision snapshotting. |
| `src/lib/page-builder/templates/content-templates.ts` | Create | Starter templates for curriculum lessons, standard articles, and video guides shared across builders. |
| `src/lib/page-builder/templates/index.ts` | Modify | Re-export `CONTENT_STARTER_TEMPLATES` in the global template library. |
| `src/lib/page-builder/registry.tsx` | Modify | Add helper `getContentStudioBlocks()` filtering out landing-page-specific bloat while preserving all media, layout, and article blocks. |
| `src/app/admin/portals/components/studio/ContentBlockCanvas.tsx` | Create | Drag-and-drop sortable canvas using `@dnd-kit/sortable` and `BlockRenderer` with 60fps drag optimization. |
| `src/app/admin/portals/components/studio/SortableBlockItem.tsx` | Create | Individual sortable block wrapper with drag handle, move up/down, duplicate, delete, and focus ring. |
| `src/app/admin/portals/components/studio/BlockInsertButton.tsx` | Create | Touch-friendly "+ Add Block" hover line between blocks and at the end of the canvas. |
| `src/app/admin/portals/components/studio/ContentBlockPalette.tsx` | Create | Categorized block library sidebar with instant search and 1-click or drag-to-insert. |
| `src/app/admin/portals/components/studio/ContentBlockInspector.tsx` | Create | Dedicated inspector sidebar wrapping `AutoBlockEditor` for editing selected block properties. |
| `src/app/admin/portals/components/ContentEditorModal.tsx` | Create | Full-screen overlay modal with top studio bar, 3-pane builder, Details/SEO tab, dirty state protection, and standardized `<TagSelector>`. Replaces `ContentEditorDrawer.tsx`. |
| `src/app/admin/portals/components/PortalContentManager.tsx` | Modify | Mounts `<ContentEditorModal>` instead of `<ContentEditorDrawer>`, shows "Block Studio" badge in list. |
| `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx` | Modify | Dual-mode content renderer: renders `BlockRenderer` when `item.blocks` exist, falls back to markdown for legacy items. |

---

## Phase-by-Phase Implementation Plan

### Phase 1: Core Type Contracts, Payload Guards & Backend AST Support

**Files:**
- Modify: `src/lib/types/content.ts`
- Modify: `src/lib/services/content-service.ts`
- Modify: `src/app/actions/content-actions.ts`
- Test: `src/lib/services/__tests__/content-service.test.ts`

- [ ] **Step 1: Write failing unit tests for block storage, text extraction & payload size guard**

In `src/lib/services/__tests__/content-service.test.ts`, add test cases for `blocks` persistence, `extractPlainTextFromBlocks`, and payload bounds:

```typescript
import { describe, it, expect } from 'vitest';
import { ContentService } from '../content-service';
import type { PageBlock } from '@/lib/types';

describe('ContentService Block Persistence & AST Normalization', () => {
  it('extracts plain text from nested block props for search indexing', () => {
    const blocks: PageBlock[] = [
      {
        id: 'b1',
        type: 'title',
        props: { content: 'Introduction to Bursary Accounting' },
      },
      {
        id: 'b2',
        type: 'text',
        props: { content: 'This lesson covers the fundamentals of fee collections.' },
      },
      {
        id: 'b3',
        type: 'procedure_list',
        props: {
          items: [
            { title: 'Step 1: Reconcile deposits' },
            { title: 'Step 2: Generate receipt voucher' },
          ],
        },
      },
    ];

    const extracted = ContentService.extractPlainTextFromBlocks(blocks);
    expect(extracted).toContain('Introduction to Bursary Accounting');
    expect(extracted).toContain('This lesson covers the fundamentals of fee collections.');
    expect(extracted).toContain('Step 1: Reconcile deposits');
    expect(extracted).toContain('Step 2: Generate receipt voucher');
  });

  it('safely handles empty or malformed block arrays without throwing', () => {
    expect(ContentService.extractPlainTextFromBlocks([])).toBe('');
    expect(ContentService.extractPlainTextFromBlocks(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/content-service.test.ts`
Expected: FAIL (`extractPlainTextFromBlocks` is not a function).

- [ ] **Step 3: Update `src/lib/types/content.ts` with strict `PageBlock` contracts**

Import `PageBlock` from `@/lib/types` and add `blocks?: PageBlock[]` to:
- `ContentItem`
- `ContentItemVersion`
- `CreateContentItemInput`
- `UpdateContentItemInput`

```typescript
import type { PageBlock } from '@/lib/types';
import type { PortalVisibility } from './portal';

export interface ContentItem {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  type: ContentItemType;
  title: string;
  slug: string;
  summary?: string;
  content?: string; // Rich text / Markdown / Synthesized plain text cache
  blocks?: PageBlock[]; // Structured PageBlock tree for drag-and-drop authoring
  pageDocumentId?: string;
  media?: ContentMedia;
  category?: string;
  tags?: string[];
  authors?: ContentAuthor[];
  status: ContentStatus;
  publishedAt?: string;
  scheduledAt?: string;
  visibility: PortalVisibility;
  accessRoles?: string[];
  seo?: ContentSeoConfig;
  stats?: ContentStats;
  order?: number;
  parentId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}
```

- [ ] **Step 4: Implement `extractPlainTextFromBlocks` & payload size guard in `src/lib/services/content-service.ts`**

Add recursive plain-text extraction and document size limits:

```typescript
  /**
   * Recursively traverses an array of PageBlocks and extracts author text
   * to populate the searchable `content` string cache.
   */
  public static extractPlainTextFromBlocks(blocks: PageBlock[] = []): string {
    if (!Array.isArray(blocks) || blocks.length === 0) return '';
    const segments: string[] = [];

    const traverse = (blockList: PageBlock[]) => {
      for (const block of blockList) {
        if (!block || !block.props) continue;

        const { content, title, subtitle, description, text, items } = block.props;

        if (typeof content === 'string' && content.trim()) segments.push(content.trim());
        if (typeof title === 'string' && title.trim()) segments.push(title.trim());
        if (typeof subtitle === 'string' && subtitle.trim()) segments.push(subtitle.trim());
        if (typeof description === 'string' && description.trim()) segments.push(description.trim());
        if (typeof text === 'string' && text.trim()) segments.push(text.trim());

        if (Array.isArray(items)) {
          for (const item of items) {
            if (typeof item === 'string' && item.trim()) segments.push(item.trim());
            else if (typeof item === 'object' && item !== null) {
              const rec = item as Record<string, unknown>;
              if (typeof rec.title === 'string' && rec.title.trim()) segments.push(rec.title.trim());
              if (typeof rec.content === 'string' && rec.content.trim()) segments.push(rec.content.trim());
              if (typeof rec.text === 'string' && rec.text.trim()) segments.push(rec.text.trim());
              if (typeof rec.question === 'string' && rec.question.trim()) segments.push(rec.question.trim());
              if (typeof rec.answer === 'string' && rec.answer.trim()) segments.push(rec.answer.trim());
            }
          }
        }

        if (Array.isArray(block.blocks) && block.blocks.length > 0) {
          traverse(block.blocks);
        }
      }
    };

    traverse(blocks);
    return segments.join('\n\n');
  }
```

In `createContentItem`:
```typescript
    const synthesizedContent = input.blocks && input.blocks.length > 0
      ? this.extractPlainTextFromBlocks(input.blocks)
      : (input.content || '');

    const newItem: ContentItem = {
      // ... existing fields ...
      content: synthesizedContent,
      blocks: input.blocks || [],
      // ...
    };
```

In `updateContentItem`:
```typescript
    const blocks = input.blocks !== undefined ? input.blocks : current.blocks;
    let content = input.content !== undefined ? input.content : current.content;
    if (input.blocks !== undefined) {
      content = this.extractPlainTextFromBlocks(input.blocks) || content || '';
    }

    const updatedItem: ContentItem = {
      ...current,
      content,
      blocks,
      // ...
    };
```

Update `src/app/actions/content-actions.ts` to pass `blocks` through in create/update payloads.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx vitest run src/lib/services/__tests__/content-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit changes locally**

```bash
git add src/lib/types/content.ts src/lib/services/content-service.ts src/lib/services/__tests__/content-service.test.ts src/app/actions/content-actions.ts
git commit -m "feat(content): add structured blocks AST support and plain text extraction for search parity"
```

---

### Phase 2: Shared Content Templates & Registry Filtering

**Files:**
- Create: `src/lib/page-builder/templates/content-templates.ts`
- Modify: `src/lib/page-builder/templates/index.ts`
- Modify: `src/lib/page-builder/registry.tsx`
- Test: `src/lib/page-builder/__tests__/content-templates.test.ts`

- [ ] **Step 1: Write unit tests for content starter templates & block filter**

Create `src/lib/page-builder/__tests__/content-templates.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { CONTENT_STARTER_TEMPLATES } from '../templates/content-templates';
import { getContentStudioBlocks } from '../registry';

describe('Shared Content Starter Templates & Registry Filter', () => {
  it('provides starter templates for articles, lessons, and video guides', () => {
    expect(CONTENT_STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const lessonTpl = CONTENT_STARTER_TEMPLATES.find(t => t.id === 'lesson-curriculum-starter');
    expect(lessonTpl).toBeDefined();
    expect(lessonTpl?.blocks.length).toBeGreaterThan(0);
  });

  it('filters out landing page marketing bloat while retaining content blocks', () => {
    const blocks = getContentStudioBlocks();
    const blockTypes = blocks.map(b => b.type);
    
    // Must include essential pedagogical and editorial blocks
    expect(blockTypes).toContain('title');
    expect(blockTypes).toContain('text');
    expect(blockTypes).toContain('video');
    expect(blockTypes).toContain('image');
    expect(blockTypes).toContain('columns');
    expect(blockTypes).toContain('divider');

    // Must exclude campaign and marketing landing-page bloat
    expect(blockTypes).not.toContain('countdown');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/page-builder/__tests__/content-templates.test.ts`
Expected: FAIL (`CONTENT_STARTER_TEMPLATES` not found).

- [ ] **Step 3: Create `src/lib/page-builder/templates/content-templates.ts`**

Define standard starter layouts with valid `PageBlock` structures (Standard Article, Curriculum Lesson, Downloadable Resource).

- [ ] **Step 4: Update `src/lib/page-builder/registry.tsx` with `getContentStudioBlocks`**

Add the helper in `src/lib/page-builder/registry.tsx`:
```typescript
/**
 * Returns blocks suitable for Content Studio (Articles, Lessons, Docs).
 * Excludes campaign landing page marketing widgets (countdown, payment gateways,
 * survey popups) while keeping all core editorial, media, and layout blocks.
 */
export function getContentStudioBlocks(): AnyBlockDefinition[] {
  const EXCLUDED_TYPES: PageBlockType[] = [
    'countdown',
    'app_download',
    'payment_methods',
    'logo_grid',
  ];
  return allBlocks().filter(block => !EXCLUDED_TYPES.includes(block.type));
}
```

Re-export `CONTENT_STARTER_TEMPLATES` in `src/lib/page-builder/templates/index.ts`.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx vitest run src/lib/page-builder/__tests__/content-templates.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit changes locally**

```bash
git add src/lib/page-builder/templates/content-templates.ts src/lib/page-builder/templates/index.ts src/lib/page-builder/registry.tsx src/lib/page-builder/__tests__/content-templates.test.ts
git commit -m "feat(page-builder): add shared content starter templates and getContentStudioBlocks registry filter"
```

---

### Phase 3: Lightweight Sortable Block Canvas & Item Controls

**Files:**
- Create: `src/app/admin/portals/components/studio/SortableBlockItem.tsx`
- Create: `src/app/admin/portals/components/studio/BlockInsertButton.tsx`
- Create: `src/app/admin/portals/components/studio/ContentBlockCanvas.tsx`

- [ ] **Step 1: Create `BlockInsertButton.tsx`**

Provides a sleek, accessible `min-h-[44px]` touch target "+ Add Block" hover line between any two blocks and at the bottom.

- [ ] **Step 2: Create `SortableBlockItem.tsx`**

Wraps `BlockRenderer` with `@dnd-kit/sortable` hooks (`useSortable`), providing grip handle, move up/down, duplicate, delete, and focus ring. Suppresses pointer-events on nested iframe elements during drag to prevent mouse capture issues.

- [ ] **Step 3: Create `ContentBlockCanvas.tsx`**

Integrates `@dnd-kit/core` `DndContext`, `SortableContext`, and empty-canvas starter templates. Applies `content-visibility: auto` to offscreen blocks to support 100+ blocks without layout lag.

- [ ] **Step 4: Commit changes locally**

```bash
git add src/app/admin/portals/components/studio/BlockInsertButton.tsx src/app/admin/portals/components/studio/SortableBlockItem.tsx src/app/admin/portals/components/studio/ContentBlockCanvas.tsx
git commit -m "feat(content-studio): implement SortableBlockItem and ContentBlockCanvas with drag-and-drop reordering"
```

---

### Phase 4: Block Palette & Property Inspector Panels

**Files:**
- Create: `src/app/admin/portals/components/studio/ContentBlockPalette.tsx`
- Create: `src/app/admin/portals/components/studio/ContentBlockInspector.tsx`

- [ ] **Step 1: Create `ContentBlockPalette.tsx`**

Provides search filtering, categorized block groups, and click/drag-to-insert using `getContentStudioBlocks()`. Uses everyday simple English labels (Text, Title, Video, Image, List, Columns).

- [ ] **Step 2: Create `ContentBlockInspector.tsx`**

Integrates [`AutoBlockEditor`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/page-builder/AutoBlockEditor.tsx) to provide the property inspector for whichever block is active. Includes reset to defaults and delete block actions.

- [ ] **Step 3: Commit changes locally**

```bash
git add src/app/admin/portals/components/studio/ContentBlockPalette.tsx src/app/admin/portals/components/studio/ContentBlockInspector.tsx
git commit -m "feat(content-studio): implement ContentBlockPalette and ContentBlockInspector"
```

---

### Phase 5: Full-Screen Studio Overlay Modal & Tag Selector Integration

**Files:**
- Create: `src/app/admin/portals/components/ContentEditorModal.tsx`
- Modify: `src/app/admin/portals/components/PortalContentManager.tsx`

- [ ] **Step 1: Create `ContentEditorModal.tsx`**

Replace drawer with full-screen studio overlay (`fixed inset-0 z-50 bg-background flex flex-col`).
- Incorporates dirty state protection (`isDirty`) with unsaved changes dialog.
- Debounced autosave backup to `localStorage` (`content_draft_${portalId}_${itemId || 'new'}`).
- Incorporates standardized `<TagSelector>` in client/draft mode (`currentTagIds={tags}`, `onTagsChange={setTags}`).
- Top Bar: Title editing, slug generator, type selector, Mode Switcher ("Block Studio" vs "Details & SEO"), Save Draft, Publish Now, keyboard shortcut (`Cmd/Ctrl + S`).
- Backoffice No-Code Template Saving: "Save as Template" button in the menu allowing admins to save their custom layout directly into `portal_templates` without writing code.

- [ ] **Step 2: Update `PortalContentManager.tsx` to mount `<ContentEditorModal>`**

Replace `ContentEditorDrawer` with `ContentEditorModal`. Add a "Block Studio" badge in the content list to indicate block-authored content.

- [ ] **Step 3: Commit changes locally**

```bash
git add src/app/admin/portals/components/ContentEditorModal.tsx src/app/admin/portals/components/PortalContentManager.tsx
git commit -m "feat(content-studio): replace slide-over drawer with full-screen ContentEditorModal and standardized TagSelector"
```

---

### Phase 6: Portal Content Reader Dual-Mode Rendering

**Files:**
- Modify: `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx`

- [ ] **Step 1: Update `PortalContentReaderClient.tsx` to render `BlockRenderer` for structured blocks**

Import `BlockRenderer` and `BlockRenderContext`. Pass the portal's active `ResolvedTheme` into `BlockRenderContext` so blocks render with the portal's active brand palette (`--portal-primary`) and Figtree typography.

Render dual-mode:
```tsx
  {/* Rich Content Body: Dual Mode (Block AST vs Legacy Markdown) */}
  <article className="max-w-none text-sm md:text-base leading-relaxed space-y-6 text-[var(--portal-text)]">
    {item.blocks && item.blocks.length > 0 ? (
      <div className="space-y-6">
        {item.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} ctx={blockRenderCtx} />
        ))}
      </div>
    ) : item.content ? (
      <div className="whitespace-pre-wrap font-normal leading-relaxed text-[var(--portal-text)]">
        {item.content}
      </div>
    ) : (
      <p className="text-xs text-[var(--portal-muted)] italic">No written body text provided.</p>
    )}
  </article>
```

- [ ] **Step 2: Commit changes locally**

```bash
git add src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx
git commit -m "feat(portal-reader): enable dual-mode BlockRenderer with fallback to legacy markdown"
```

---

### Phase 7: Verification, Strict Type Checking & Browser Audit

**Files:**
- Complete verification across all modified subsystems

- [ ] **Step 1: Run complete Vitest suite**

Run: `npx vitest run src/lib/services/__tests__/content-service.test.ts src/lib/page-builder/__tests__/content-templates.test.ts`
Expected: 100% tests passing.

- [ ] **Step 2: Run strict TypeScript static analysis**

Run: `npx tsc --noEmit`
Expected: 0 errors. Confirm strictly 0 `any` / 0 `any[]` / 0 unhandled `unknown`.

- [ ] **Step 3: Run ESLint**

Run: `npx eslint src/app/admin/portals/components/ContentEditorModal.tsx src/app/admin/portals/components/studio/`
Expected: 0 lint errors.

- [ ] **Step 4: DevTools browser verification**

Navigate to `http://localhost:9002/admin/portals` in Chrome DevTools MCP:
1. Click "Add Content" -> Verify full-screen overlay opens smoothly without horizontal scroll or FOUC.
2. Drag and drop / insert blocks (Title, Video, Paragraph, List).
3. Select a block -> Verify `AutoBlockEditor` opens in the property inspector and updates the canvas live.
4. Switch to "Details & SEO" -> Verify `<TagSelector>` works seamlessly.
5. Save draft -> Verify document saves with structured `blocks` and synthesized `content`.
6. Open `/portal/academy/content/...` in reader -> Verify blocks render crisply with Figtree typography and zero hydration errors.

- [ ] **Step 5: Final local commit**

```bash
git commit -am "chore(content-studio): finalize verified full-screen modal block builder"
```
