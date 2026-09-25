# Architecture & Implementation Plan: List Block Style Variations & Intro Paragraph Architecture

> **Owner:** Principal UI/UX Architect & Senior Frontend Specialist  
> **Status:** Ready for Execution (Plan Phase)  
> **Date:** September 25, 2026  
> **Governing Standards:** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`, `workspace-rules`  
> **Git Protocol:** Strict local-only commits. Zero unprompted push to remote branches (`origin/main`, `deployment`).

---

## 1. Executive Summary & Design Overview

In contemporary digital experience platforms, marketing funnels, and member portals (such as Notion, Linear, Stripe Docs, and Webflow), lists rarely exist solely as raw bullet points. High-converting landing pages and structured LMS lesson outlines frequently require:
1. **An introductory context-setting lead block** (an optional section title and descriptive paragraph) situated immediately above the list items to frame the value proposition (e.g. *"Here is what is included with your tuition:"* or *"Review these key prerequisites before taking the module assessment"*).
2. **Author Flexibility ("List Only" vs. "Text Above + List"):** Authors must have instant, 1-click control in the properties panel to toggle between a standalone compact list and a full editorial introduction, without resorting to stacking separate Text blocks and coping with awkward vertical margins.
3. **8 Distinct Industry-Standard Visual Style Variations:** From high-contrast feature checklists and corporate item cards to gradient-stepped sequences and subtle bordered row dividers, authors need tactile visual wireframe presets to select the exact visual voice of their list.
4. **WYSIWYG Canvas Editing:** Authors should be able to click directly on the canvas to edit the introductory title and lead paragraph via `<InlineEditable />`, with smooth animations and zero layout shift.

This specification elevates the existing `list` block into an industry-grade, backward-compatible, strictly-typed content component with real-time preview, mobile-first touch ergonomics, and uncompromised accessibility.

---

## 2. Industry Research & Competitive Benchmarks

| Platform / Design System | List Pattern | Lead Text Capability | Inspector Presentation |
| :--- | :--- | :--- | :--- |
| **Linear** | Monospaced indices, pill status chips, subtle row dividers | Lead paragraph sits directly above list items with 16px bottom margin and 1.5 line height | Toggle switch for "Show Intro" + segmented style picker |
| **Stripe Docs & Landing** | Elevated item cards, feature checklists with emerald checkmarks | Contextual callout sentence with optional bold kicker text | Visual archetype cards with real CSS preview |
| **Notion** | Minimal dashes, numbered steps, toggle lists | Block headings and intro text can precede any list block seamlessly | Dropdown / card selector with immediate inline editable canvas |
| **Webflow UI** | Multi-column grid lists with responsive stacking | Intro slot with responsive typography and alignment controls | Component properties panel with accordion disclosure |

### Core Architectural Decisions Derived from Research:
1. **Introductory Slot ("Lead Paragraph"):** Add `showIntroText: boolean`, `introTitle: string`, `introText: string`, and `introAlignment: 'left' | 'center'` to the list schema.
2. **Backward Compatibility via Zod Transformation:** If a legacy list block contains `title`, the schema automatically maps it to `introTitle` and activates `showIntroText: true`, preventing data loss or regressions for existing pages.
3. **8 Visual Archetypes:** Expand preset styles from 6 to 8 by introducing `stepped-gradient` (gradient numbered sequence with connecting node) and `bordered-rows` (horizontal divider rows with trailing indicator).
4. **Mobile Responsive Grid:** Strictly enforce `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` so multi-column layouts degrade gracefully on 390px mobile viewports without horizontal scrolling or text clipping.

---

## 3. Data Model & Schema Architecture

### Schema Definition (`src/lib/page-builder/blocks/list.tsx`)
```typescript
export type ListPresetType =
  | 'checklist'
  | 'bullet'
  | 'numbered'
  | 'cards'
  | 'minimal-dash'
  | 'icon-pill'
  | 'stepped-gradient'
  | 'bordered-rows';

export type ListIntroAlignment = 'left' | 'center';
export type ListColumnsType = '1' | '2' | '3';
export type ListSpacingType = 'compact' | 'normal' | 'relaxed';

export const listItemSchema = z.object({
  id: z.string().default(() => `item-${Math.random().toString(36).substring(2, 9)}`),
  title: z.string().default(''),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  checked: z.boolean().optional().default(false),
});

export type ListItem = z.infer<typeof listItemSchema>;

export const rawListSchema = z.object({
  title: z.string().optional().default(''), // Legacy fallback
  showIntroText: z.boolean().default(false), // Toggle: show list only vs intro + list
  introTitle: z.string().optional().default(''), // Headline above intro paragraph
  introText: z.string().optional().default(''), // Lead paragraph preceding list items
  introAlignment: z.enum(['left', 'center']).default('left'),
  preset: z.enum([
    'checklist',
    'bullet',
    'numbered',
    'cards',
    'minimal-dash',
    'icon-pill',
    'stepped-gradient',
    'bordered-rows',
  ]).default('checklist'),
  columns: z.enum(['1', '2', '3']).default('1'),
  spacing: z.enum(['compact', 'normal', 'relaxed']).default('normal'),
  bulletColor: z.string().optional().default(''),
  textColor: z.string().optional().default(''),
  showDescriptions: z.boolean().default(true),
  items: z.array(listItemSchema).default([
    {
      id: '1',
      title: 'Streamlined workspace onboarding',
      description: 'Configure student rosters and administrative permissions with zero delay.',
    },
    {
      id: '2',
      title: 'Automated compliance validations',
      description: 'Run automated checks against regional databases and education registries.',
    },
    {
      id: '3',
      title: 'One-click roster synchronizations',
      description: 'Export and sync verified student data across internal databases seamlessly.',
    },
  ]),
}).catchall(z.unknown());

export const listSchema = rawListSchema.transform((data) => {
  // Backward-compatibility: map legacy title if present and introTitle is empty
  const resolvedIntroTitle = data.introTitle || data.title || '';
  const resolvedShowIntro = data.showIntroText || Boolean(resolvedIntroTitle || data.introText);
  return {
    ...data,
    introTitle: resolvedIntroTitle,
    showIntroText: resolvedShowIntro,
  };
});

export type ListProps = z.infer<typeof listSchema>;
```

---

## 4. Visual Style Archetypes (Presets)

| # | Preset Key | Style Name | Visual Treatment | Iconography & Node | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `checklist` | **Feature Checklist** | Theme-tinted circular badges with bold checkmarks | Emerald / Primary check `<Check />` | Product features, "What's Included", perks |
| 2 | `bullet` | **Classic Bulleted** | Solid circular accent dots with refined typographic baseline | Accent dot `<div className="w-2 h-2 rounded-full" />` | Editorial summaries, key takeaways |
| 3 | `numbered` | **Numbered Steps** | High-contrast circular indices (`1`, `2`, `3`...) | Numbered bubble with subtle shadow | Ordered workflows, ranked instructions |
| 4 | `cards` | **Item Cards** | Bordered card shells with hover elevation | Boxed card with top checkmark node | Modular benefits, deliverable packages |
| 5 | `minimal-dash` | **Minimal Dash** | Subtle horizontal em-dash markers | Typographic stroke `<Minus />` | Modern minimal landing pages, legal notes |
| 6 | `icon-pill` | **Compact Pills** | High-density pill chips with leading accent dot | Rounded badge `<span className="rounded-xl" />` | Skill tags, prerequisites, compact specs |
| 7 | `stepped-gradient` | **Stepped Gradient** | Gradient circular nodes (`from-primary to-accent`) with connecting vertical trace | Gradient index badge | Milestones, onboarding stages, progression |
| 8 | `bordered-rows` | **Bordered Rows** | Clean horizontal divider borders between items with trailing chevron | Border bottom + trailing `<ChevronRight />` | FAQ-adjacent lists, curriculum syllabi |

---

## 5. Visual Wireframe Selector (`ListPresetSelector.tsx`)

The properties panel visual picker presents an interactive $2\times 4$ grid of tactile thumbnail cards. Each card renders an exact SVG / CSS wireframe representation:
- **Active state:** `border-primary bg-primary/5 shadow-xs` with a top-right checkmark indicator `<CheckCircle2 />`.
- **Roving tabindex & Arrow Navigation:** Exactly one element has `tabIndex={0}` (`effectiveSelectedIndex`), allowing seamless Arrow Up/Down/Left/Right cycling.
- **Mobile ergonomics:** Min touch target of $\ge 44\text{px}$ (`min-h-[68px]`) with `active:scale-[0.98]` tactile press response and `touch-manipulation`.

---

## 6. What Could Go Wrong & Edge Cases Analysis

| # | Risk Scenario | Technical Severity | Exact Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **1** | **Legacy Data Loss on Title:** Existing published pages or saved templates with `{ title: "Features" }` lose their header. | **High** | Zod `.transform()` adapter automatically migrates `data.title` into `introTitle` and sets `showIntroText: true` on parse if either is populated. |
| **2** | **XSS in Intro Paragraph or Titles:** User injects malicious script tags via `<InlineEditable />` or properties panel inputs into `introTitle` or `introText`. | **High** | All user strings are processed through `sanitizeHtml(ctx.interpolate(...))` prior to rendering or `dangerouslySetInnerHTML`. |
| **3** | **Canvas Text Flashing / Layout Shift (CLS):** Toggling "Include Intro Paragraph" causing abrupt jump on canvas. | **Medium** | Apply Emil Kowalski smooth entrance animations (`animate-in fade-in duration-200`) and ensure zero height layout jumps. |
| **4** | **Empty Intro Text in View Mode:** When author enables "Include Intro Paragraph" but leaves both `introTitle` and `introText` blank, an ugly empty margin appears for visitors. | **Medium** | In view mode (`ctx.mode === 'view'`), guard: `if (!hasIntroTitle && !hasIntroText) return null;` so published pages render cleanly without empty padding. |
| **5** | **Mobile Grid Overflow:** 2-column or 3-column list overflowing narrow mobile screens (390px iPhone viewport). | **Medium** | Strict responsive Tailwind classes: `columns === '3' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : columns === '2' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'`. |
| **6** | **Search Indexing Omission:** AI copilot, search bar, and portal discovery engine failing to index the new `introTitle` and `introText`. | **Medium** | Update `ContentService.extractPlainTextFromBlocks` to extract `block.props.introTitle` and `block.props.introText` alongside `items`. |
| **7** | **Variable Parsing Single Source of Truth:** Author uses `{{contact.first_name}}` inside intro paragraph, but custom regex breaks formatting. | **High** | Route interpolation exclusively through `ctx.interpolate` which delegates to `FieldsVariablesService.resolveTemplateVariables`. |
| **8** | **Inspector Duplicate Outer Labels:** AutoBlockEditor printing an outer `<Label>Preset Style</Label>` above the visual wireframe selector. | **Low** | Add `isListPreset` to suppressed labels in `AutoBlockEditor.tsx`. |

---

## 7. Backoffice Impact & Enhancements (No-Code Governance)

### How This Affects the Backoffice:
1. **Portal Content Studio & Page Builder:**
   - Authors can configure whether a list displays as a pure compact bullet/checklist or as an editorial section with a lead paragraph.
   - The properties panel exposes a dedicated **Display Mode** segmented control:
     - `[ List Only ]` (compact, no introductory header)
     - `[ With Intro Text ]` (reveals Intro Title, Intro Paragraph textarea, and Alignment options)
2. **Template Workshop & Portal Templates:**
   - Templates in `src/lib/templates/content-templates.ts` can use the new `stepped-gradient` or `bordered-rows` presets with intro paragraphs for school syllabi, tuition payment steps, and onboarding checklists.
3. **Database Permissions & Unauthenticated Public Access:**
   - Public landing pages (`/p/[slug]`) and shared portal resources read published page versions via Firestore public rules.
   - No new Firestore collections or indexes are required because the list block payload is nested within the existing `structureJson.sections[].blocks[]` document structure.
   - Security rules in `firestore.rules` for `campaign_pages` and `published_versions` already permit public read access on published content.

---

## 8. Phase-by-Phase TDD Implementation Plan

### Phase 1: Schema Extension & Backward-Compatibility Adapter (TDD)
- **Files:**
  - Create: `src/components/page-builder/__tests__/ListBlockIntroSchema.test.tsx`
  - Modify: `src/lib/page-builder/blocks/list.tsx`
- [ ] **Step 1: Write failing schema tests**
  - Test default schema with `showIntroText: false`.
  - Test transformation when legacy `title` is present (maps to `introTitle` and sets `showIntroText: true`).
  - Test valid presets accepting all 8 styles (`checklist`, `bullet`, `numbered`, `cards`, `minimal-dash`, `icon-pill`, `stepped-gradient`, `bordered-rows`).
- [ ] **Step 2: Run test to verify it fails**
  - Command: `npx vitest run src/components/page-builder/__tests__/ListBlockIntroSchema.test.tsx`
- [ ] **Step 3: Implement extended schema and types in `list.tsx`**
  - Add `rawListSchema` with `showIntroText`, `introTitle`, `introText`, `introAlignment`.
  - Add Zod `.transform()` adapter.
  - Export `ListProps`, `ListPresetType`, `ListIntroAlignment`.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit locally** (`git commit -m "feat(list): extend schema with intro paragraph and 8 visual presets"`)

---

### Phase 2: Visual Wireframe Selector Overhaul (`ListPresetSelector.tsx`)
- **Files:**
  - Modify: `src/components/page-builder/__tests__/ListPresetSelector.test.tsx`
  - Modify: `src/components/page-builder/ListPresetSelector.tsx`
- [ ] **Step 1: Update selector tests for all 8 presets**
  - Test rendering wireframes for `stepped-gradient` and `bordered-rows`.
  - Test WAI-ARIA `role="radiogroup"` / `role="radio"` and roving tabindex.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement wireframe previews in `ListPresetSelector.tsx`**
  - Wireframe for `stepped-gradient` (gradient numbered nodes with connecting trace).
  - Wireframe for `bordered-rows` (horizontal borders with chevron marker).
  - Ensure `touch-manipulation`, active states, and mobile touch targets $\ge 44\text{px}$.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit locally** (`git commit -m "feat(inspector): upgrade ListPresetSelector with 8 visual wireframe styles"`)

---

### Phase 3: Runtime Renderer & Canvas WYSIWYG Experience
- **Files:**
  - Create: `src/components/page-builder/__tests__/ListRuntimeIntroRender.test.tsx`
  - Modify: `src/lib/page-builder/blocks/list.tsx`
  - Modify: `src/app/p/[slug]/PublicPageClient.tsx`
  - Modify: `src/lib/services/content-service.ts`
- [ ] **Step 1: Write failing runtime tests**
  - Test rendering "List Only" mode (no intro header rendered).
  - Test rendering "With Intro Text" (title + paragraph rendered above list).
  - Test rendering `stepped-gradient` and `bordered-rows` presets.
  - Test edit mode inline editable title and paragraph.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement runtime rendering in `list.tsx`**
  - Render intro header with `<InlineEditable />` in edit mode for `introTitle` and `introText`.
  - Render `stepped-gradient` layout with gradient badge and connecting vertical line.
  - Render `bordered-rows` layout with bottom borders and trailing indicators.
  - Implement interactive empty state with `[ + Add First Item ]` button in edit mode.
- [ ] **Step 4: Update `content-service.ts` and `PublicPageClient.tsx`**
  - In `content-service.ts`: extract `props.introTitle` and `props.introText` in plain text search extraction.
  - In `PublicPageClient.tsx`: ensure fallback list rendering supports intro text.
- [ ] **Step 5: Run tests to verify they pass**
- [ ] **Step 6: Commit locally** (`git commit -m "feat(list): implement runtime intro text and new preset styles"`)

---

### Phase 4: Properties Panel Inspector Integration (`AutoBlockEditor.tsx` & `list.tsx`)
- **Files:**
  - Create: `src/components/page-builder/__tests__/AutoBlockEditorListIntro.test.tsx`
  - Modify: `src/lib/page-builder/blocks/list.tsx` (fields definition)
  - Modify: `src/components/page-builder/AutoBlockEditor.tsx`
- [ ] **Step 1: Write failing inspector tests**
  - Test that `preset` routes to `ListPresetSelector`.
  - Test that `showIntroText` toggle controls visibility of `introTitle`, `introText`, and `introAlignment`.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Configure inspector fields in `list.tsx` and wire in `AutoBlockEditor.tsx`**
  - Register fields: `preset`, `showIntroText` (`boolean`), `introTitle` (`text`), `introText` (`textarea`), `introAlignment` (`select`), `items` (`list`), `columns`, `spacing`, `bulletColor`, `textColor`, `showDescriptions`.
  - Suppress duplicate outer labels for `preset`.
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit locally** (`git commit -m "feat(inspector): wire intro paragraph toggle and fields in AutoBlockEditor"`)

---

### Phase 5: Full Verification, Quality Gates & Local Commit
- **Files:**
  - All test files across `src/components/page-builder/__tests__/` and `src/lib/services/__tests__/`
- [ ] **Step 1: Run complete page builder test suite**
  - Command: `npx vitest run src/components/page-builder/__tests__/`
  - Target: 100% tests passing.
- [ ] **Step 2: Run TypeScript strict check**
  - Command: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
  - Target: 0 errors, strictly zero `any`/`any[]`/`unknown`.
- [ ] **Step 3: Run ESLint verification**
  - Command: `npm run lint`
  - Target: 0 errors.
- [ ] **Step 4: Final local commit** (`git commit -m "refactor(list): complete list block overhaul with verification"`)
  - **Strictly local commit — zero push to remote.**

---

## 9. Guidelines & Documentation Commitments
In all modified and created files:
1. Include file header blocks explaining the purpose, standards, and architecture.
2. Add inline comments explaining non-obvious design decisions (e.g. why Zod union normalizer preserves legacy `title`).
3. Add caution areas for future maintainers (e.g. why mobile breakpoints must enforce `grid-cols-1`).
4. Ensure all interactive buttons maintain $\ge 44\text{px}$ touch targets and `active:scale-[0.97]` feedback.
