# Content Studio Full-Screen Modal & Drag-and-Drop Block Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Content Studio from a cramped slide-over drawer into a full-screen distraction-free overlay modal equipped with a modular drag-and-drop block builder that directly reuses and extends the Page Builder's core block registry, block definitions, and metadata-driven property inspector.

**Architecture:** 
1. **Shared Block Engine**: Content Studio directly imports `blockRegistry` from `@/lib/page-builder/registry`, rendering blocks via `BlockRenderer` and editing them via `AutoBlockEditor`. New blocks or template additions in the Page Builder are instantly available in the Content Studio.
2. **Distraction-Free Modal Workspace**: A full-screen overlay modal (`ContentEditorModal`) replaces `ContentEditorDrawer`, featuring a clean 3-pane studio layout (Block Palette, Sortable WYSIWYG Canvas, and Property Inspector) and a dedicated "Details & SEO" panel with the standardized `<TagSelector>`.
3. **Dual-Mode AST Storage & Search Parity**: Content items store structured `blocks: PageBlock[]` while automatically synthesizing a plain-text `content` string on save, preserving full-text search indexing, card excerpts, and backwards-compatible rendering in `PortalContentReaderClient`.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict typing, 0 `any`), Tailwind CSS, `@dnd-kit/core`, `@dnd-kit/sortable`, Framer Motion, Firebase Cloud Firestore.

---

## File Structure & Responsibilities

| File Path | Action | Architectural Responsibility |
|:---|:---|:---|
| `src/lib/types/content.ts` | Modify | Add `blocks?: PageBlock[]` to `ContentItem`, `CreateContentItemInput`, `UpdateContentItemInput`, and `ContentItemVersion`. |
| `src/lib/services/content-service.ts` | Modify | Persist `blocks`, implement `extractPlainTextFromBlocks`, and store plain-text AST cache into `content` for search indexing. |
| `src/lib/services/__tests__/content-service.test.ts` | Modify | Unit test verifying block persistence, plain-text synthesis, and revision snapshotting. |
| `src/lib/page-builder/templates/content-templates.ts` | Create | Starter templates for curriculum lessons, standard articles, and video guides shared across builders. |
| `src/lib/page-builder/templates/index.ts` | Modify | Re-export `CONTENT_STARTER_TEMPLATES` in the global template library. |
| `src/lib/page-builder/registry.tsx` | Modify | Add helper `getContentStudioBlocks()` filtering out landing-page-specific bloat while preserving all media, layout, and article blocks. |
| `src/app/admin/portals/components/studio/ContentBlockCanvas.tsx` | Create | Drag-and-drop sortable canvas using `@dnd-kit/sortable` and `BlockRenderer`. |
| `src/app/admin/portals/components/studio/SortableBlockItem.tsx` | Create | Individual sortable block wrapper with drag handle, move up/down, duplicate, delete, and focus ring. |
| `src/app/admin/portals/components/studio/ContentBlockPalette.tsx` | Create | Categorized block library sidebar allowing search filtering and 1-click or drag-to-insert. |
| `src/app/admin/portals/components/studio/ContentBlockInspector.tsx` | Create | Dedicated inspector sidebar wrapping `AutoBlockEditor` for editing selected block properties. |
| `src/app/admin/portals/components/ContentEditorModal.tsx` | Create | Full-screen overlay modal with top studio bar, 3-pane builder, Details/SEO tab, and standardized `<TagSelector>`. Replaces `ContentEditorDrawer.tsx`. |
| `src/app/admin/portals/components/PortalContentManager.tsx` | Modify | Mounts `<ContentEditorModal>` instead of `<ContentEditorDrawer>`. |
| `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx` | Modify | Dual-mode content renderer: renders `BlockRenderer` when `item.blocks` exist, falls back to markdown for legacy items. |

---

## Tasks

### Task 1: Extend Content Domain Types & Backend Service AST Support

**Files:**
- Modify: `src/lib/types/content.ts:70-160`
- Modify: `src/lib/services/content-service.ts:25-240`
- Modify: `src/app/actions/content-actions.ts:20-100`
- Test: `src/lib/services/__tests__/content-service.test.ts`

- [ ] **Step 1: Write the failing unit test for block storage and plain-text synthesis**

In `src/lib/services/__tests__/content-service.test.ts`, add test cases for `blocks` persistence and `extractPlainTextFromBlocks`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/content-service.test.ts`
Expected: FAIL (`extractPlainTextFromBlocks` is not a function).

- [ ] **Step 3: Update `src/lib/types/content.ts` with `PageBlock` contracts**

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

- [ ] **Step 4: Implement `extractPlainTextFromBlocks` and update `ContentService` in `src/lib/services/content-service.ts`**

Add recursive plain-text extraction and update `createContentItem` / `updateContentItem`:

```typescript
  /**
   * Recursively traverses an array of PageBlocks and extracts author text
   * to populate the searchable `content` string cache.
   */
  public static extractPlainTextFromBlocks(blocks: PageBlock[] = []): string {
    const segments: string[] = [];

    const traverse = (blockList: PageBlock[]) => {
      for (const block of blockList) {
        if (!block || !block.props) continue;

        // Check common text-bearing props across registry blocks
        const { content, title, subtitle, description, text, items } = block.props;

        if (typeof content === 'string' && content.trim()) segments.push(content.trim());
        if (typeof title === 'string' && title.trim()) segments.push(title.trim());
        if (typeof subtitle === 'string' && subtitle.trim()) segments.push(subtitle.trim());
        if (typeof description === 'string' && description.trim()) segments.push(description.trim());
        if (typeof text === 'string' && text.trim()) segments.push(text.trim());

        // Check arrays (e.g. procedure lists, FAQs, feature items)
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

        // Traverse nested layout blocks (columns, containers)
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

### Task 2: Shared Content Templates & Registry Filtering

**Files:**
- Create: `src/lib/page-builder/templates/content-templates.ts`
- Modify: `src/lib/page-builder/templates/index.ts`
- Modify: `src/lib/page-builder/registry.tsx:80-120`
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

Define standard starter layouts with valid `PageBlock` structures:
```typescript
import type { PageBlock } from '@/lib/types';

export interface ContentStarterTemplate {
  id: string;
  name: string;
  description: string;
  type: 'article' | 'lesson' | 'resource' | 'video';
  blocks: PageBlock[];
}

export const CONTENT_STARTER_TEMPLATES: ContentStarterTemplate[] = [
  {
    id: 'article-standard-starter',
    name: 'Standard Article / Guide',
    description: 'Clean editorial structure with title, summary callout, structured paragraphs, and key takeaways.',
    type: 'article',
    blocks: [
      {
        id: 'block-title-1',
        type: 'title',
        props: {
          content: 'Title of Your Guide or Article',
          tag: 'h1',
          align: 'left',
          fontSize: 'text-3xl md:text-4xl font-black tracking-tight',
        },
      },
      {
        id: 'block-text-intro',
        type: 'text',
        props: {
          content: 'A brief introduction outlining the objectives and scope of this guide.',
        },
      },
      {
        id: 'block-divider-1',
        type: 'divider',
        props: { style: 'subtle', margin: 'my-6' },
      },
      {
        id: 'block-title-2',
        type: 'title',
        props: {
          content: 'Key Principles & Implementation',
          tag: 'h2',
          align: 'left',
          fontSize: 'text-2xl font-bold tracking-tight',
        },
      },
      {
        id: 'block-text-body',
        type: 'text',
        props: {
          content: 'Elaborate your main points, best practices, and actionable procedures here.',
        },
      },
    ],
  },
  {
    id: 'lesson-curriculum-starter',
    name: 'Curriculum Lesson + Video Walkthrough',
    description: 'Optimized for masterclasses: video lecture embed, syllabus notes, and procedure checklist.',
    type: 'lesson',
    blocks: [
      {
        id: 'block-lesson-title',
        type: 'title',
        props: {
          content: 'Lesson: Bursary Financial Controls & Audit Prep',
          tag: 'h1',
          align: 'left',
          fontSize: 'text-3xl md:text-4xl font-black tracking-tight',
        },
      },
      {
        id: 'block-lesson-video',
        type: 'video',
        props: {
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          aspectRatio: '16/9',
          autoPlay: false,
          controls: true,
        },
      },
      {
        id: 'block-lesson-notes-title',
        type: 'title',
        props: {
          content: 'Core Learning Objectives',
          tag: 'h2',
          align: 'left',
          fontSize: 'text-2xl font-bold',
        },
      },
      {
        id: 'block-lesson-notes-text',
        type: 'text',
        props: {
          content: '1. Master cashflow reconciliation.\n2. Configure audit trails for fee waivers.\n3. Validate daily banking slips against bank statements.',
        },
      },
    ],
  },
  {
    id: 'resource-download-starter',
    name: 'Downloadable Toolkit & Instructions',
    description: 'Cover sheet, overview instructions, download banner, and usage criteria.',
    type: 'resource',
    blocks: [
      {
        id: 'block-res-title',
        type: 'title',
        props: {
          content: 'Bursary Fee Collection Excel Model & Ledger Guide',
          tag: 'h1',
          align: 'left',
          fontSize: 'text-3xl font-black tracking-tight',
        },
      },
      {
        id: 'block-res-text',
        type: 'text',
        props: {
          content: 'This toolkit provides pre-configured formulas for automatic student ledger balancing and penalty calculations.',
        },
      },
      {
        id: 'block-res-divider',
        type: 'divider',
        props: { style: 'subtle', margin: 'my-6' },
      },
      {
        id: 'block-res-instructions',
        type: 'text',
        props: {
          content: '### How to use this workbook:\n- Input term dates on sheet 1.\n- Paste student IDs and billing classes.\n- Export reconciliation reports weekly.',
        },
      },
    ],
  },
];
```

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

### Task 3: Lightweight Sortable Block Canvas & Item Controls

**Files:**
- Create: `src/app/admin/portals/components/studio/SortableBlockItem.tsx`
- Create: `src/app/admin/portals/components/studio/BlockInsertButton.tsx`
- Create: `src/app/admin/portals/components/studio/ContentBlockCanvas.tsx`

- [ ] **Step 1: Create `BlockInsertButton.tsx`**

Provides a sleek "+ Add Block" hover line between any two blocks and at the bottom:
```typescript
'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlockInsertButtonProps {
  onInsert: () => void;
  label?: string;
  isEnd?: boolean;
}

export function BlockInsertButton({ onInsert, label = 'Add block here', isEnd = false }: BlockInsertButtonProps) {
  if (isEnd) {
    return (
      <div className="py-6 flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={onInsert}
          className="h-10 px-4 rounded-xl border-dashed border-border hover:border-primary hover:bg-primary/5 text-xs font-bold text-muted-foreground hover:text-primary transition-all gap-1.5 shadow-2xs"
        >
          <Plus className="w-4 h-4" /> Add Next Block
        </Button>
      </div>
    );
  }

  return (
    <div className="group/insert relative py-2 flex items-center justify-center -my-2 z-10">
      <div className="absolute inset-x-4 h-px bg-border/40 group-hover/insert:bg-primary/40 transition-colors" />
      <button
        type="button"
        onClick={onInsert}
        title={label}
        className="relative z-10 w-6 h-6 rounded-full bg-card border border-border shadow-xs flex items-center justify-center opacity-0 group-hover/insert:opacity-100 scale-90 group-hover/insert:scale-100 text-muted-foreground hover:text-primary hover:border-primary transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `SortableBlockItem.tsx`**

Wraps `BlockRenderer` with `@dnd-kit/sortable` hooks (`useSortable`), providing grip handle, move up/down, duplicate, delete, and focus ring:
```typescript
'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUp, ArrowDown, Copy, Trash2, Settings2 } from 'lucide-react';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import { getBlock, type BlockRenderContext } from '@/lib/page-builder/registry';
import type { PageBlock } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SortableBlockItemProps {
  block: PageBlock;
  isSelected: boolean;
  onSelect: (blockId: string) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  isFirst: boolean;
  isLast: boolean;
  renderCtx: BlockRenderContext;
}

export function SortableBlockItem({
  block,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  isFirst,
  isLast,
  renderCtx,
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const def = getBlock(block.type);
  const blockTitle = def?.label || block.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
      className={cn(
        'group/block relative rounded-2xl transition-all duration-150',
        isDragging && 'opacity-40 z-30 ring-2 ring-primary/40',
        isSelected
          ? 'ring-2 ring-primary bg-primary/[0.02] shadow-sm'
          : 'hover:ring-1 hover:ring-border/80'
      )}
    >
      {/* Top Floating Control Bar */}
      <div
        className={cn(
          'absolute -top-3.5 right-4 z-20 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card/95 backdrop-blur-xs border border-border shadow-sm text-xs transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
        )}
      >
        <span className="text-[10px] font-bold text-muted-foreground mr-1 uppercase tracking-wider">
          {blockTitle}
        </span>

        {/* Drag Grip */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Move Up */}
        <button
          type="button"
          disabled={isFirst}
          onClick={(e) => { e.stopPropagation(); onMoveUp(block.id); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Move Down */}
        <button
          type="button"
          disabled={isLast}
          onClick={(e) => { e.stopPropagation(); onMoveDown(block.id); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>

        {/* Duplicate */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
          className="p-1 rounded-md text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Block Body Content */}
      <div className="p-4">
        <BlockRenderer block={block} ctx={renderCtx} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ContentBlockCanvas.tsx`**

Integrates `@dnd-kit/core` `DndContext`, `SortableContext`, and empty-canvas starter templates:
```typescript
'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SortableBlockItem } from './SortableBlockItem';
import { BlockInsertButton } from './BlockInsertButton';
import { CONTENT_STARTER_TEMPLATES } from '@/lib/page-builder/templates/content-templates';
import type { PageBlock, ResolvedTheme } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { Sparkles, FileText, Video, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContentBlockCanvasProps {
  blocks: PageBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onBlocksChange: (blocks: PageBlock[]) => void;
  onRequestInsert: (index: number) => void;
  theme?: ResolvedTheme;
}

export function ContentBlockCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onBlocksChange,
  onRequestInsert,
  theme,
}: ContentBlockCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
      }
    }
  };

  const handleMoveUp = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx > 0) onBlocksChange(arrayMove(blocks, idx, idx - 1));
  };

  const handleMoveDown = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < blocks.length - 1 && idx !== -1) onBlocksChange(arrayMove(blocks, idx, idx + 1));
  };

  const handleDuplicate = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx !== -1) {
      const target = blocks[idx];
      const copy: PageBlock = {
        ...target,
        id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        props: JSON.parse(JSON.stringify(target.props)),
      };
      const updated = [...blocks];
      updated.splice(idx + 1, 0, copy);
      onBlocksChange(updated);
      onSelectBlock(copy.id);
    }
  };

  const handleDelete = (id: string) => {
    onBlocksChange(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) onSelectBlock(null);
  };

  // Mock theme context for editor rendering
  const defaultTheme: ResolvedTheme = theme || {
    id: 'studio-default',
    name: 'Studio Default',
    colors: {
      primary: '#3B82F6',
      secondary: '#64748B',
      accent: '#10B981',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      border: '#E2E8F0',
      muted: '#94A3B8',
    },
    typography: {
      headingFont: 'Figtree',
      bodyFont: 'Figtree',
      scaleRatio: 1.25,
      baseSize: '16px',
    },
    ui: {
      borderRadius: 'rounded',
      buttonStyle: 'flat',
      cardStyle: 'bordered',
    },
    modePolicy: 'light_first',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const renderCtx: BlockRenderContext = {
    mode: 'edit',
    theme: defaultTheme,
    interpolate: (str: string) => str,
    resources: { forms: [], surveys: [], agreements: [] },
    onPropChange: (patch) => {
      if (!selectedBlockId) return;
      onBlocksChange(
        blocks.map(b => b.id === selectedBlockId ? { ...b, props: { ...b.props, ...patch } } : b)
      );
    },
  };

  if (blocks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Start Building Your Content</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Choose a pre-built starter layout below or add individual building blocks from the left palette.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {CONTENT_STARTER_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onBlocksChange(JSON.parse(JSON.stringify(tpl.blocks)))}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm text-left transition-all group"
            >
              <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1.5">
                {tpl.type === 'video' ? <Video className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                {tpl.name}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>

        <div className="pt-4">
          <Button
            type="button"
            onClick={() => onRequestInsert(0)}
            className="rounded-xl font-bold text-xs gap-1.5"
          >
            <Layers className="w-4 h-4" /> Add Blank Block
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-4" onClick={() => onSelectBlock(null)}>
          {blocks.map((block, index) => (
            <React.Fragment key={block.id}>
              {index > 0 && (
                <BlockInsertButton onInsert={() => onRequestInsert(index)} />
              )}
              <SortableBlockItem
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={onSelectBlock}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                isFirst={index === 0}
                isLast={index === blocks.length - 1}
                renderCtx={renderCtx}
              />
            </React.Fragment>
          ))}
          <BlockInsertButton isEnd onInsert={() => onRequestInsert(blocks.length)} />
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 4: Commit changes locally**

```bash
git add src/app/admin/portals/components/studio/BlockInsertButton.tsx src/app/admin/portals/components/studio/SortableBlockItem.tsx src/app/admin/portals/components/studio/ContentBlockCanvas.tsx
git commit -m "feat(content-studio): implement SortableBlockItem and ContentBlockCanvas with drag-and-drop reordering"
```

---

### Task 4: Block Palette & Property Inspector Panels

**Files:**
- Create: `src/app/admin/portals/components/studio/ContentBlockPalette.tsx`
- Create: `src/app/admin/portals/components/studio/ContentBlockInspector.tsx`

- [ ] **Step 1: Create `ContentBlockPalette.tsx`**

Provides search filtering, categorized block groups, and click/drag-to-insert using `getContentStudioBlocks()`:
```typescript
'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, Sparkles, Type, Video, Image, List, Layout, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getContentStudioBlocks, type AnyBlockDefinition } from '@/lib/page-builder/registry';
import type { PageBlock, PageBlockType } from '@/lib/types';
import '@/lib/page-builder/blocks'; // Register all blocks

interface ContentBlockPaletteProps {
  onAddBlock: (type: PageBlockType) => void;
}

export function ContentBlockPalette({ onAddBlock }: ContentBlockPaletteProps) {
  const [query, setQuery] = useState('');

  const registeredBlocks = useMemo(() => getContentStudioBlocks(), []);

  const filteredBlocks = useMemo(() => {
    if (!query.trim()) return registeredBlocks;
    const q = query.toLowerCase();
    return registeredBlocks.filter(
      b => b.label.toLowerCase().includes(q) || b.type.toLowerCase().includes(q)
    );
  }, [registeredBlocks, query]);

  return (
    <aside className="w-64 border-r border-border bg-card/60 flex flex-col h-full overflow-hidden select-none">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">Blocks Library</span>
          <span className="text-[10px] text-muted-foreground font-semibold px-1.5 py-0.5 bg-muted rounded-md">
            {filteredBlocks.length}
          </span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks..."
            className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredBlocks.map((block) => {
          const IconComp = block.icon || Sparkles;
          return (
            <button
              key={block.type}
              type="button"
              onClick={() => onAddBlock(block.type)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:bg-primary/[0.04] text-left transition-all group shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold truncate text-foreground group-hover:text-primary transition-colors">
                    {block.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {block.category}
                  </div>
                </div>
              </div>
              <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create `ContentBlockInspector.tsx`**

Integrates [`AutoBlockEditor`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/page-builder/AutoBlockEditor.tsx) to provide the property inspector for whichever block is active:
```typescript
'use client';

import React from 'react';
import { SlidersHorizontal, X, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoBlockEditor } from '@/components/page-builder/AutoBlockEditor';
import { getBlock } from '@/lib/page-builder/registry';
import type { PageBlock } from '@/lib/types';

interface ContentBlockInspectorProps {
  block: PageBlock | null;
  onClose: () => void;
  onUpdateProps: (patch: Record<string, unknown>) => void;
  onDeleteBlock: (id: string) => void;
  workspaceId?: string;
}

export function ContentBlockInspector({
  block,
  onClose,
  onUpdateProps,
  onDeleteBlock,
  workspaceId,
}: ContentBlockInspectorProps) {
  if (!block) {
    return (
      <aside className="w-80 border-l border-border bg-card/60 p-6 flex flex-col items-center justify-center text-center space-y-3 select-none h-full">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-foreground">No Block Selected</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Click on any block on the canvas to configure its properties, media, or layout options.
          </p>
        </div>
      </aside>
    );
  }

  const def = getBlock(block.type);
  const blockTitle = def?.label || block.type;

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col h-full overflow-hidden select-none">
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold truncate text-foreground">{blockTitle} Settings</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Property Editor Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AutoBlockEditor
          block={block}
          onChange={onUpdateProps}
          workspaceId={workspaceId}
        />
      </div>

      {/* Inspector Footer Actions */}
      <div className="p-3 border-t border-border flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (def?.defaults) onUpdateProps(JSON.parse(JSON.stringify(def.defaults)));
          }}
          className="h-8 text-xs font-bold rounded-xl gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDeleteBlock(block.id)}
          className="h-8 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl gap-1"
        >
          <Trash2 className="w-3 h-3" /> Delete Block
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit changes locally**

```bash
git add src/app/admin/portals/components/studio/ContentBlockPalette.tsx src/app/admin/portals/components/studio/ContentBlockInspector.tsx
git commit -m "feat(content-studio): implement ContentBlockPalette and ContentBlockInspector"
```

---

### Task 5: Full-Screen Studio Overlay Modal & Tag Selector Integration

**Files:**
- Create: `src/app/admin/portals/components/ContentEditorModal.tsx`
- Modify: `src/app/admin/portals/components/PortalContentManager.tsx:370-395`

- [ ] **Step 1: Create `ContentEditorModal.tsx`**

Replace drawer with full-screen studio overlay. Incorporate standardized `<TagSelector>` (in draft mode per Workspace Rules) and dual-mode builder/details tabs:
```typescript
'use client';

import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TagSelector } from '@/components/tags/TagSelector';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSlug } from '@/lib/utils/slug-utils';
import { createContentItemAction, updateContentItemAction } from '@/app/actions/content-actions';
import { ContentBlockCanvas } from './studio/ContentBlockCanvas';
import { ContentBlockPalette } from './studio/ContentBlockPalette';
import { ContentBlockInspector } from './studio/ContentBlockInspector';
import { getBlock } from '@/lib/page-builder/registry';
import type { ContentItem, ContentItemType, ContentStatus, ContentMedia } from '@/lib/types/content';
import type { PageBlock, PageBlockType } from '@/lib/types';
import type { PortalVisibility } from '@/lib/types/portal';
import {
  Save, Rocket, FileText, Video, FileSpreadsheet, Globe, Share2,
  Loader2, Sparkles, X, Layers, Settings, ChevronLeft
} from 'lucide-react';

interface ContentEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  organizationId: string;
  workspaceIds: string[];
  initialItem?: ContentItem | null;
  defaultType?: ContentItemType;
  onSaved?: (item: ContentItem) => void;
}

const TYPE_OPTIONS: { id: ContentItemType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'article', label: 'Article / Blog Post', icon: FileText },
  { id: 'lesson', label: 'Curriculum Lesson', icon: Sparkles },
  { id: 'resource', label: 'Downloadable Resource', icon: FileSpreadsheet },
  { id: 'page', label: 'Documentation Page', icon: Globe },
  { id: 'announcement', label: 'Announcement / News', icon: Share2 },
  { id: 'video', label: 'Video Lecture', icon: Video },
];

export function ContentEditorModal({
  open,
  onOpenChange,
  portalId,
  organizationId,
  workspaceIds,
  initialItem,
  defaultType = 'article',
  onSaved,
}: ContentEditorModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'studio' | 'details'>('studio');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Content Details State
  const [type, setType] = React.useState<ContentItemType>(defaultType);
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [category, setCategory] = React.useState('General');
  const [tags, setTags] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<ContentStatus>('draft');
  const [visibility, setVisibility] = React.useState<PortalVisibility>('public');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [media, setMedia] = React.useState<ContentMedia>({});
  const [metaTitle, setMetaTitle] = React.useState('');
  const [metaDescription, setMetaDescription] = React.useState('');

  // Block Builder State
  const [blocks, setBlocks] = React.useState<PageBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);

  // Initialize or Seed from initialItem
  React.useEffect(() => {
    if (initialItem) {
      setType(initialItem.type);
      setTitle(initialItem.title);
      setSlug(initialItem.slug);
      setSummary(initialItem.summary || '');
      setCategory(initialItem.category || 'General');
      setTags(initialItem.tags || []);
      setStatus(initialItem.status);
      setVisibility(initialItem.visibility || 'public');
      setScheduledAt(initialItem.scheduledAt || '');
      setMedia(initialItem.media || {});
      setMetaTitle(initialItem.seo?.metaTitle || '');
      setMetaDescription(initialItem.seo?.metaDescription || '');

      // Seed blocks: if item has blocks use them; if only legacy content exists, seed a text block
      if (initialItem.blocks && initialItem.blocks.length > 0) {
        setBlocks(initialItem.blocks);
      } else if (initialItem.content?.trim()) {
        setBlocks([
          {
            id: `block-${Date.now()}`,
            type: 'text',
            props: { content: initialItem.content },
          },
        ]);
      } else {
        setBlocks([]);
      }
    } else {
      setType(defaultType);
      setTitle('');
      setSlug('');
      setSummary('');
      setCategory('General');
      setTags([]);
      setStatus('draft');
      setVisibility('public');
      setScheduledAt('');
      setMedia({});
      setMetaTitle('');
      setMetaDescription('');
      setBlocks([]);
    }
    setSelectedBlockId(null);
  }, [initialItem, defaultType, open]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!initialItem) setSlug(sanitizeSlug(val));
  };

  const handleAddBlock = (blockType: PageBlockType, insertIndex?: number) => {
    const def = getBlock(blockType);
    const newBlock: PageBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: blockType,
      props: def?.defaults ? JSON.parse(JSON.stringify(def.defaults)) : {},
    };

    const nextBlocks = [...blocks];
    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= nextBlocks.length) {
      nextBlocks.splice(insertIndex, 0, newBlock);
    } else {
      nextBlocks.push(newBlock);
    }

    setBlocks(nextBlocks);
    setSelectedBlockId(newBlock.id);
  };

  const handleSave = async (publishImmediately: boolean = false) => {
    if (!title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a title for this content item.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const targetStatus: ContentStatus = publishImmediately ? 'published' : status;

      const payload = {
        title,
        slug,
        summary,
        blocks,
        category,
        tags,
        status: targetStatus,
        visibility,
        scheduledAt: scheduledAt || undefined,
        media,
        seo: {
          metaTitle: metaTitle || title,
          metaDescription: metaDescription || summary,
        },
      };

      if (initialItem) {
        const res = await updateContentItemAction(initialItem.id, payload, portalId);
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to update item.');
        toast({ title: 'Saved 🎉', description: `Updated "${title}".` });
        onSaved?.(res.data);
        onOpenChange(false);
      } else {
        const res = await createContentItemAction({
          ...payload,
          organizationId,
          portalId,
          workspaceIds,
          type,
        });
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to create item.');
        toast({ title: 'Content Created! 🎉', description: `Created "${title}".` });
        onSaved?.(res.data);
        onOpenChange(false);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Save failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBlock = React.useMemo(() => {
    return blocks.find(b => b.id === selectedBlockId) || null;
  }, [blocks, selectedBlockId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-screen p-0 m-0 rounded-none border-none bg-background flex flex-col overflow-hidden outline-none">
        {/* ── Studio Top Bar ──────────────────────────────────────────────── */}
        <header className="h-14 px-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-30">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs h-9 gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5 shrink-0">
                <FileText className="w-4 h-4" /> Content Studio
              </span>
              <span className="text-muted-foreground text-xs">/</span>
              <Input
                value={title}
                onChange={handleTitleChange}
                placeholder="Enter title here..."
                className="h-8 border-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 font-bold text-sm w-64 md:w-80 truncate rounded-lg px-2"
              />
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'studio'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Block Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'details'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Details & SEO
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="rounded-xl font-bold text-xs h-9 gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || !title.trim()}
              onClick={() => handleSave(true)}
              className="rounded-xl font-bold text-xs h-9 bg-primary text-white hover:bg-primary/90 gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              Publish Now
            </Button>
          </div>
        </header>

        {/* ── Studio Main Viewport ────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'studio' ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Block Palette */}
              <ContentBlockPalette onAddBlock={(t) => handleAddBlock(t)} />

              {/* Center Sortable WYSIWYG Canvas */}
              <main className="flex-1 overflow-y-auto bg-muted/20">
                <ContentBlockCanvas
                  blocks={blocks}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onBlocksChange={setBlocks}
                  onRequestInsert={(idx) => handleAddBlock('text', idx)}
                />
              </main>

              {/* Right Property Inspector */}
              <ContentBlockInspector
                block={selectedBlock}
                onClose={() => setSelectedBlockId(null)}
                onUpdateProps={(patch) => {
                  if (!selectedBlockId) return;
                  setBlocks(
                    blocks.map(b => b.id === selectedBlockId ? { ...b, props: { ...b.props, ...patch } } : b)
                  );
                }}
                onDeleteBlock={(id) => {
                  setBlocks(blocks.filter(b => b.id !== id));
                  if (selectedBlockId === id) setSelectedBlockId(null);
                }}
                workspaceId={workspaceIds[0]}
              />
            </div>
          ) : (
            /* Details & SEO Tab */
            <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-4xl mx-auto w-full space-y-8">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Content Attributes & Visibility</h3>
                <p className="text-xs text-muted-foreground">
                  Configure classification, access permissions, tags, and search engine previews.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Content Type</Label>
                  <Select value={type} onValueChange={(val: ContentItemType) => setType(val)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.id} value={opt.id} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">URL Slug</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                    className="h-10 rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Category</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Visibility</Label>
                  <Select value={visibility} onValueChange={(val: PortalVisibility) => setVisibility(val)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="authenticated">Member Sign-in Required</SelectItem>
                      <SelectItem value="password_protected">Password Protected</SelectItem>
                      <SelectItem value="membership_required">Premium Membership Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Standardized Tag Selector (Strict Rule Compliance) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold">Tags</Label>
                <TagSelector
                  currentTagIds={tags}
                  onTagsChange={setTags}
                  allowCreation
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Summary / Excerpt</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short excerpt for cards and search snippets..."
                  className="rounded-xl text-xs min-h-[80px]"
                />
              </div>

              {/* SEO Configurations */}
              <div className="pt-6 border-t border-border space-y-4">
                <h4 className="text-sm font-bold">Search Engine Optimization (SEO)</h4>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">SEO Meta Title</Label>
                    <Input
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder={title || 'Meta Title'}
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">SEO Meta Description</Label>
                    <Textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder={summary || 'Meta Description'}
                      className="rounded-xl text-xs min-h-[64px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Update `PortalContentManager.tsx` to mount `<ContentEditorModal>`**

In `src/app/admin/portals/components/PortalContentManager.tsx`:
Replace `ContentEditorDrawer` with `ContentEditorModal`.

- [ ] **Step 3: Commit changes locally**

```bash
git add src/app/admin/portals/components/ContentEditorModal.tsx src/app/admin/portals/components/PortalContentManager.tsx
git commit -m "feat(content-studio): replace slide-over drawer with full-screen ContentEditorModal and standardized TagSelector"
```

---

### Task 6: Portal Content Reader Dual-Mode Rendering

**Files:**
- Modify: `src/app/portal/[slug]/content/[type]/[itemSlug]/PortalContentReaderClient.tsx:420-435`

- [ ] **Step 1: Update `PortalContentReaderClient.tsx` to render `BlockRenderer` for structured blocks**

Import `BlockRenderer` and `BlockRenderContext` in `PortalContentReaderClient.tsx`:
```typescript
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
```

Construct the reader's `BlockRenderContext` with the portal's active `theme` tokens:
```typescript
  const blockRenderCtx = React.useMemo<BlockRenderContext>(() => {
    return {
      mode: 'view',
      theme: {
        id: portal.id,
        name: portal.name,
        colors: {
          primary: activeColors.primary,
          secondary: '#64748B',
          accent: activeColors.accent || '#10B981',
          background: activeColors.background,
          surface: activeColors.surface,
          textPrimary: activeColors.text,
          textSecondary: activeColors.muted,
          border: activeColors.border,
          muted: activeColors.muted,
        },
        typography: {
          headingFont: theme.typography?.headingFont || 'Figtree',
          bodyFont: theme.typography?.bodyFont || 'Figtree',
          scaleRatio: 1.25,
          baseSize: '16px',
        },
        ui: {
          borderRadius: theme.ui?.borderRadius || 'rounded',
          buttonStyle: theme.ui?.buttonStyle || 'flat',
          cardStyle: theme.ui?.cardStyle || 'bordered',
        },
        modePolicy: theme.modePolicy || 'light_first',
        createdAt: portal.createdAt,
        updatedAt: portal.updatedAt,
      },
      interpolate: (text: string) => text,
      resources: { forms: [], surveys: [], agreements: [] },
    };
  }, [portal, activeColors, theme]);
```

In the JSX article section:
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

### Task 7: Verification, Strict Type Checking & Browser Audit

**Files:**
- Test all touched files and runtime behavior

- [ ] **Step 1: Run complete Vitest suite**

Run: `npx vitest run src/lib/services/__tests__/content-service.test.ts src/lib/page-builder/__tests__/content-templates.test.ts`
Expected: 100% tests passing.

- [ ] **Step 2: Run strict TypeScript static analysis**

Run: `npx tsc --noEmit`
Expected: 0 errors. Confirm zero `any` or `any[]` introduced.

- [ ] **Step 3: Run ESLint**

Run: `npx eslint src/app/admin/portals/components/ContentEditorModal.tsx src/app/admin/portals/components/studio/`
Expected: 0 lint errors.

- [ ] **Step 4: DevTools browser verification**

Navigate to `http://localhost:9002/admin/portals` in Chrome DevTools MCP.
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
