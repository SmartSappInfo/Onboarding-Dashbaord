# Page Builder Overhaul — Implementation Spec & Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Governing skills (apply on every task):** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `test-driven-development`, `code-refactoring`.
>
> **Build/verify policy:** This plan **never** runs `next build`, `tsc`, `lint`, or `git commit`. Each task ends with a **VERIFY LOCALLY** block listing the exact commands for the human to run, then the commit command for them to run manually. Do not execute them.
>
> **Type policy:** **No `any` / `any[]`.** Storage boundary props use `Record<string, unknown>`; each block declares a typed `Props` interface and validates with `zod`. Where a value is genuinely dynamic, use `unknown` + a narrowing guard, never `any`.

**Goal:** Convert the single-purpose, hardcoded campaign-page renderer into a generic, schema-driven block builder where one component registry powers both the editor canvas and the published page (true WYSIWYG), with a real template library for SaaS, Schools, and Marketing.

**Architecture:** Introduce a single **block registry** (`src/lib/page-builder/`) that defines each block once as `{ type, fields, defaults, schema, render }`. A shared `<BlockRenderer mode="edit|view">` walks the `CampaignPageStructure` tree and renders through the registry. The editor's property panel and the public page both consume the registry, eliminating the two divergent renderers. Tree mutations move into pure, unit-tested functions; the reducer delegates to them.

**Tech Stack:** Next.js 16.2 (App Router, RSC), React 19, TypeScript (strict, no `any`), `@dnd-kit`, `motion`/`framer-motion`, `isomorphic-dompurify`, `zod`, Firestore, Vitest + `@testing-library/react` (jsdom).

---

## 1. Current-State Audit (the review this plan fixes)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F1 | 🔴 P0 | **Published pages 404.** Builder writes versions to top-level `campaign_page_versions`; public server reads `campaign_pages/{id}/campaign_page_versions/{id}` and public client reads `campaign_pages/{id}/versions/{id}`. Three different paths → `version` is `null` → 404 for every real page. | `BuilderClient.tsx:79,116,156`, `p/[slug]/page.tsx:31`, `p/[slug]/PublicPageClient.tsx:285` |
| F2 | 🔴 P0 | **Renderer hardcoded to a payment use-case.** Hero only renders for section id `'hero-section'`; section headings switch on ids `payment-methods-section`/`procedure-section`; `cta-1` is wired to a bespoke "receipt request" modal. | `PublicPageClient.tsx:431,470-479,538` |
| F3 | 🔴 P0 | **Two divergent renderers.** Each block type is implemented twice (editor `BlockPreview` vs public), already disagreeing → no WYSIWYG. | `Canvas.tsx:187-380`, `PublicPageClient.tsx:428-639` |
| F4 | 🟠 P1 | **Dead block types.** `columns`/`container` have no defaults, no nesting render, no recursion; `logo_grid` has no editor/preview; `payment_methods`/`procedure_list` render only publicly and aren't in the palette. | `useBuilderState.ts:269-282`, `BlockPalette.tsx`, `types.ts:3150` |
| F5 | 🟠 P1 | **Forms never render inline** on the public page (only inside trigger modals) — fatal for `lead_capture`/`registration` goals. | `PublicPageClient.tsx:483-635,647` |
| F6 | 🟠 P1 | **Themes barely applied.** Only `themeOverrides.primary` reaches the live page; selected `CampaignPageTheme`, secondary/background/accent ignored; `themeSnapshot` never written. | `PublicPageClient.tsx:342-357` |
| F7 | 🟡 P2 | **XSS surface.** `html` block injects raw HTML/CSS via `dangerouslySetInnerHTML`; `customScriptsAllowed` never enforced. | `PublicPageClient.tsx:624-629` |
| F8 | 🟡 P2 | **Tailwind purge bug.** `grid-cols-${n}` is dynamically built and stripped by JIT. | `PublicPageClient.tsx:614` |
| F9 | 🟡 P2 | **No cross-section drag** (palette is click-only; `moveBlockToSection` unused), no responsive overrides, no autosave, URL-only media, only 2 seeded templates. | `useBuilderState.ts:300,368`, `seed.ts:866` |

**What is good and must be preserved:** the `CampaignPageStructure` data model, the reducer + undo/redo history stack, `@dnd-kit` sortable wiring, the trigger engine, theme/SEO/settings panels, the new-page template gallery, and the dark editor aesthetic.

---

## 2. Target Architecture

```
                       ┌──────────────────────────────────────────┐
                       │  src/lib/page-builder/ (single source)    │
                       │                                          │
   PageBlockType ─────▶│  registry.tsx   blockRegistry[type] =    │
                       │     { fields, defaults, schema, render } │
                       │  fields.ts      field descriptors (DU)   │
                       │  schema.ts      zod: structure + props   │
                       │  tree-operations.ts  pure mutations      │
                       │  resolve-theme.ts     tokens → CSS vars  │
                       │  sanitize.ts          DOMPurify wrapper  │
                       └───────────┬───────────────┬──────────────┘
                                   │               │
                  ┌────────────────▼───┐     ┌─────▼──────────────────┐
                  │ EDITOR             │     │ PUBLIC                 │
                  │ Canvas (mode=edit) │     │ PageRenderer(mode=view)│
                  │ AutoBlockEditor    │     │ /p/[slug]              │
                  │ (fields → panel)   │     │                        │
                  └────────┬───────────┘     └─────┬──────────────────┘
                           │ both call               │
                           └────────► <BlockRenderer> ◄──────┘
                                      walks tree, renders def.render(mode)
```

**Key inversion:** today each block exists in 2–3 places. After this, a block exists **once**. Adding a block = adding one registry entry; both editor and live page pick it up automatically.

### Core types (defined once, referenced by every later task)

```ts
// src/lib/page-builder/fields.ts
export type BlockField =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'textarea'; key: string; label: string; placeholder?: string }
  | { kind: 'richtext'; key: string; label: string }
  | { kind: 'url'; key: string; label: string; placeholder?: string }
  | { kind: 'image'; key: string; label: string }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number; step?: number }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number }
  | { kind: 'color'; key: string; label: string }
  | { kind: 'boolean'; key: string; label: string }
  | { kind: 'select'; key: string; label: string; options: ReadonlyArray<{ value: string; label: string }> }
  | { kind: 'resource'; key: string; label: string; resource: 'form' | 'survey' | 'agreement' }
  | { kind: 'list'; key: string; label: string; itemFields: ReadonlyArray<BlockField> };
```

```ts
// src/lib/page-builder/registry.tsx
import type { ZodType } from 'zod';
import type { CampaignPageTheme, PageBlock, PageBlockType } from '@/lib/types';

export type BlockMode = 'edit' | 'view';

export interface BlockRenderContext {
  mode: BlockMode;
  theme: ResolvedTheme;                       // from resolve-theme.ts
  interpolate: (text: string) => string;      // {{utm_*}} substitution
  resources: BuilderResources;                // forms/surveys/etc (read-only)
  onPropChange?: (patch: Record<string, unknown>) => void;  // edit-mode inline edits
  fireTrigger?: (event: string, blockId?: string) => void;  // view-mode interactions
  renderChildren?: (slot?: string) => React.ReactNode;       // for layout blocks
}

export interface BlockDefinition<TProps extends Record<string, unknown>> {
  type: PageBlockType;
  label: string;
  category: 'layout' | 'content' | 'data' | 'embed';
  icon: React.ComponentType<{ className?: string }>;
  fields: ReadonlyArray<BlockField>;
  defaults: TProps;
  schema: ZodType<TProps>;
  allowsChildren?: boolean;                   // columns / container / grid
  render: (props: TProps, block: PageBlock, ctx: BlockRenderContext) => React.ReactElement;
}

// Type-erased storage so the map can hold heterogeneous block defs without `any`.
export type AnyBlockDefinition = BlockDefinition<Record<string, unknown>>;
export const blockRegistry: Partial<Record<PageBlockType, AnyBlockDefinition>> = {};
export function registerBlock(def: AnyBlockDefinition): void { blockRegistry[def.type] = def; }
export function getBlock(type: PageBlockType): AnyBlockDefinition | undefined { return blockRegistry[type]; }
```

> `Record<string, unknown>` + `zod` parsing replaces every `Record<string, any>`. Each block's `render` receives already-parsed, typed `TProps` (the `BlockRenderer` calls `def.schema.parse({ ...def.defaults, ...block.props })`), so block bodies are fully typed with no `any`.

---

## 3. File Structure Map

**New files**

| Path | Responsibility |
|------|----------------|
| `src/lib/page-builder/constants.ts` | `VERSIONS_COLLECTION = 'campaign_page_versions'` and other shared literals (single source for the data path). |
| `src/lib/page-builder/fields.ts` | `BlockField` discriminated union. |
| `src/lib/page-builder/registry.tsx` | Registry types + `registerBlock`/`getBlock`/`blockRegistry`. |
| `src/lib/page-builder/schema.ts` | `zod` schemas: `pageStructureSchema`, per-block prop schemas, `parseStructure()`. |
| `src/lib/page-builder/tree-operations.ts` | Pure section/block mutations (no React). |
| `src/lib/page-builder/resolve-theme.ts` | `resolveTheme(theme, overrides, orgBranding) → ResolvedTheme` + `themeToCssVars()`. |
| `src/lib/page-builder/sanitize.ts` | `sanitizeHtml()` / `sanitizeCss()` wrappers over `isomorphic-dompurify`. |
| `src/lib/page-builder/blocks/*.tsx` | One file per block (`hero.tsx`, `text.tsx`, `cta.tsx`, `image.tsx`, `video.tsx`, `spacer.tsx`, `divider.tsx`, `faq.tsx`, `testimonial.tsx`, `stats.tsx`, `logo-grid.tsx`, `form.tsx`, `survey.tsx`, `agreement.tsx`, `html.tsx`, `columns.tsx`, `container.tsx`). |
| `src/lib/page-builder/blocks/index.ts` | Imports every block file for registration side-effects; exported `registerAllBlocks()`. |
| `src/components/page-builder/BlockRenderer.tsx` | Recursive tree walker; renders via registry; shared by editor + public. |
| `src/components/page-builder/PageRenderer.tsx` | Top-level page shell (theme vars, header/footer, sections) used by `/p/[slug]`. |
| `src/components/page-builder/AutoBlockEditor.tsx` | Renders a property panel from `def.fields` (replaces the per-type switch in `BlockEditor`). |
| `src/lib/page-builder/templates/*.ts` | Template definitions per vertical (`saas.ts`, `schools.ts`, `marketing.ts`, `index.ts`). |
| `src/lib/page-builder/__tests__/*.test.ts(x)` | Vitest suites colocated by concern. |

**Modified files**

| Path | Change |
|------|--------|
| `src/lib/types.ts` | `PageBlock.props: Record<string, unknown>` (was `any`); add `ResolvedTheme`, `BuilderResources`; widen `PageTriggerAction.config` typing. |
| `src/app/admin/pages/[id]/builder/hooks/useBuilderState.ts` | Delegate all mutations to `tree-operations.ts`. |
| `src/app/admin/pages/[id]/builder/components/Canvas.tsx` | Replace local `BlockPreview` with `<BlockRenderer mode="edit">`; wire cross-section drag. |
| `src/app/admin/pages/[id]/builder/components/BlockEditor.tsx` | Replace per-type switch with `<AutoBlockEditor>`. |
| `src/app/admin/pages/[id]/builder/components/BlockPalette.tsx` | Build groups from `blockRegistry` (categories) instead of hardcoded arrays. |
| `src/app/p/[slug]/page.tsx` | Read version from `VERSIONS_COLLECTION`; validate with `parseStructure`. |
| `src/app/p/[slug]/PublicPageClient.tsx` | Replace bespoke body with `<PageRenderer>`; keep trigger engine + modal host. |
| `src/lib/seed.ts` | Replace 2 templates with the vertical template library import. |

---

## 4. Design Principles & Skill Compliance

**`next-best-practices`**
- `/p/[slug]/page.tsx` stays a Server Component; data fetch hoisted via `react`'s `cache()` (already present) and the version read parallelised with branding (`Promise.all`). No `any` in `params`/`searchParams` (already `Promise<…>`).
- Replace `<img>` in published output with `next/image` where dimensions are known (logo grid, image block) with `sizes`; raw `<img>` only where author supplies arbitrary remote URLs without dimensions (documented exception).
- SEO stays in `generateMetadata` (server). Remove the hidden in-body `<title>`/`<meta>` hack (F-cleanup).
- Google Font injection moves from imperative DOM mutation to `<link rel="preconnect">` resource hints + a single stylesheet link rendered server-side.

**`vercel-react-best-practices`**
- `async-parallel`: `Promise.all([getPageVersion, getOrgBranding])` in the route.
- `server-cache-react`: keep `cache()` dedupe across `generateMetadata` + page.
- `rerender-no-inline-components`: `BlockRenderer` and block bodies are module-level, never defined inside another component (current `BlockPreview` is fine but will be extracted).
- `bundle-dynamic-imports`: lazy-load the editor-only `TipTapEditor` and `html`/`code` editors via `next/dynamic` so the public bundle stays lean; the public page imports only `view`-mode renderers.
- `rerender-memo`: memoise `BlockRenderer` by block id + props reference; tree-ops return new references only for changed branches (structural sharing) to keep memo effective.
- `js-set-map-lookups`: registry is a `Record` (O(1)); `findBlock` builds a parent map for moves.

**`emilkowal-animations`** (use `motion`/`framer-motion`, already installed)
- Enter = `ease-out`, exit = `ease-in`; durations 150–250ms; animate **only** `transform`/`opacity` (never `height`/`top`).
- Block insert/reorder uses `motion`'s `layout` with a spring `{ stiffness: 500, damping: 40 }` for interruptible drags; honor `prefers-reduced-motion` (wrap in `useReducedMotion()` → disable transforms).
- Public-page section reveal: one orchestrated staggered fade/translate on load (not scattered per-element micro-animations).
- Origin-aware transforms for the property panel slide-in; no layout-thrash animations on the canvas.

**`frontend-design`**
- Templates commit to distinct aesthetic directions per vertical (SaaS = refined/precise, Schools = warm/trustworthy, Marketing = bold/high-contrast). Use CSS variables driven by `ResolvedTheme`. Avoid generic Inter-on-white defaults in seeded templates; pair a display font with a body font per vertical (fonts limited to the already-allowed `ThemePanel` list to avoid layout shift).

**`code-refactoring` / clean code**
- Tree mutations are pure functions ≤20 lines, single responsibility, fully unit-tested (no React, no Firestore).
- DRY: block rendering centralised; the editor/public divergence is deleted, not duplicated.
- Behavior preservation: each refactor task ports existing behavior under test before the switch is flipped.

---

## 5. Risk Register — what could go wrong & mitigation

| Risk | Likelihood | Impact | Mitigation (encoded in plan) |
|------|-----------|--------|------------------------------|
| **R1 — Data-path fix breaks the working `subscription-payment` page** (only currently-live page, served from static JSON fallback). | Med | High | Phase 0 keeps the static-JSON fallback path intact and adds a Vitest test asserting the fallback still resolves. The path change only affects the Firestore branch. |
| **R2 — `props: any → unknown` causes a cascade of TS errors** across `Canvas`, `BlockEditor`, public page. | High | Med | Migrate incrementally: keep `props` accesses behind the registry's parsed `TProps`. Legacy direct accesses are removed only in the task that ports that block. The union change lands **after** the registry exists, per-block. |
| **R3 — Published pages built on the OLD schema (e.g. `hero-section` id, `payment_methods`) stop rendering** after renderer swap. | Med | High | `PageRenderer` registers `payment_methods`/`procedure_list` as real blocks; a `migrateLegacyStructure()` pass (Phase 6) maps legacy section ids/headings into `section.props.heading`. Snapshot test against the real `payment-guide-data.json`. |
| **R4 — `zod` parse throws on unknown/legacy props and blanks the page.** | Med | High | `parseStructure` uses `.safeParse` + per-block `.catch(defaults)`; unknown block types render a non-throwing fallback. Never throw in `view` mode. Test with malformed fixtures. |
| **R5 — DOMPurify differs server vs client → hydration mismatch** on `html` blocks. | Med | Med | Sanitize once on the server (in the RSC/`getPageVersion`) and pass sanitized strings down; client renders the same string. Gate behind `customScriptsAllowed`. Test sanitization removes `<script>`/`onerror`. |
| **R6 — `next/dynamic` for editor-only deps accidentally ships to public bundle.** | Low | Med | `view`-mode block bodies import zero editor deps; editor-only widgets imported only inside `mode === 'edit'` branches via `dynamic(() => …, { ssr: false })`. Verify via bundle analysis locally. |
| **R7 — Undo/redo regressions when reducer delegates to tree-ops.** | Med | Med | Port tree-ops under test FIRST (Phase 1), then swap the reducer to call them in a behavior-preserving task with existing-behavior tests. |
| **R8 — dnd-kit cross-section moves corrupt the tree** (lost block / duplicate id). | Med | High | `moveBlockToSection` is a pure, property-tested function (id-count invariant: total blocks before == after). |
| **R9 — Firestore rules block the new read path / template writes.** | Med | High | Audit `firestore.rules` for `campaign_page_versions` and `page_templates` (use `firebase-security-rules-auditor` skill); include a rules task. Flag for human to deploy rules. |
| **R10 — Scope creep stalls delivery.** | High | Med | Phases are independently shippable; Phase 0 alone restores published pages. Feature-flag the new renderer (`NEXT_PUBLIC_PAGE_BUILDER_V2`) so it can roll back. |
| **R11 — Inline-edit in `view`-shared renderer leaks edit affordances to public.** | Low | High | `onPropChange` is only passed in `mode==='edit'`; block bodies must guard interactive editors on `mode`. A test renders each block in `view` mode and asserts no `contentEditable`/inputs. |

---

## 6. Other Features Affected (and where they're handled)

| Feature | Why affected | Handled in |
|---------|-------------|-----------|
| **Trigger engine** (`page_load`/`block_click`/modals/webhooks/automations) | Lives in `PublicPageClient`; must keep working when body becomes `<PageRenderer>`. `block_click` needs block ids wired through `ctx.fireTrigger`. | Phase 4 (renderer passes `fireTrigger` into `ctx`; modal host stays in `PublicPageClient`). |
| **Embedded form submission** (`submitStandaloneFormAction`, lead capture, automations) | Form must render **inline** + in modal, both submitting correctly. | Phase 3 (`form` block `view` render reuses `EmbeddedForm`). |
| **`subscription-payment` static page** | Only live page; uses `payment_methods`/`procedure_list` + hardcoded headings + `cta-1` receipt modal. | Phase 0 (untouched), Phase 3 (`payment_methods`/`procedure_list` become real blocks), Phase 6 (legacy migration + `cta-1` → trigger). |
| **Analytics** (`recordPageViewAction`, `recordInteractionAction`) | Called from `PublicPageClient`; CTA/interaction tracking must still fire. | Phase 4 (interaction recording moves into `ctx.fireTrigger`/CTA handler). |
| **New-page template gallery** (`NewPageClient`) | Reads `page_templates`; thumbnails switch on block types. | Phase 7 (extend thumbnail map for new blocks; richer preview optional). |
| **Section template library** (`saveSectionAction`/`getSectionTemplatesAction`, HistoryPanel) | Saves a `PageSection`; must round-trip through validated schema. | Phase 5 (validate section on save/insert via `pageSectionSchema`). |
| **Themes** (`getThemesAction`, `CampaignPageTheme`, ThemePanel) | Currently mostly ignored on live page. | Phase 2 (`resolveTheme` consumes full theme + writes `themeSnapshot` on publish). |
| **QR Studio deep-link** (`CreateQRButton resourceType="landing_page"`) | Points at `/p/{slug}`; depends on F1 fix. | Phase 0 (restored by data-path fix; no code change in QR). |
| **SEO/OG** (`generateMetadata`, `resolveSeoMetadata`) | Remove in-body `<title>` hack; keep server metadata. | Phase 4. |
| **`/p/f/[slug]` standalone forms** | Separate route, shares `EmbeddedForm` styling only. | No change; regression-check in Phase 3. |

---

## 7. Phased Plan

> Each phase is independently shippable. Tests are written **first** (RED), watched fail, then implemented (GREEN), then refactored. Test commands use Vitest. **Do not run them or commit — the human does.**

### Phase 0 — Restore published pages (P0 hotfix, no architecture change)

**Outcome:** real built pages render again; XSS + Tailwind purge bugs fixed. Ships value on day one.

**Files**
- Create: `src/lib/page-builder/constants.ts`, `src/lib/page-builder/sanitize.ts`
- Create test: `src/lib/page-builder/__tests__/sanitize.test.ts`
- Modify: `src/app/p/[slug]/page.tsx`, `src/app/p/[slug]/PublicPageClient.tsx`

- [ ] **Step 1 — RED: sanitize test**
```ts
// src/lib/page-builder/__tests__/sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../sanitize';

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });
  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).not.toContain('onerror');
  });
  it('keeps safe formatting', () => {
    expect(sanitizeHtml('<strong>hi</strong>')).toBe('<strong>hi</strong>');
  });
});
```
- [ ] **Step 2 — Verify RED:** `npx vitest run src/lib/page-builder/__tests__/sanitize.test.ts` → FAIL (`sanitize` not found).
- [ ] **Step 3 — GREEN: constants + sanitize**
```ts
// src/lib/page-builder/constants.ts
export const VERSIONS_COLLECTION = 'campaign_page_versions';
```
```ts
// src/lib/page-builder/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}
export function sanitizeCss(dirty: string): string {
  // Strip anything that can break out of a <style> context.
  return dirty.replace(/<\/?(style|script)[^>]*>/gi, '').replace(/expression\s*\(/gi, '');
}
```
- [ ] **Step 4 — Verify GREEN:** same command → PASS.
- [ ] **Step 5 — Fix the data path (server).** In `src/app/p/[slug]/page.tsx`, change `getPageVersion` to read the top-level collection and parallelise with branding:
```ts
import { VERSIONS_COLLECTION } from '@/lib/page-builder/constants';

async function getPageVersion(versionId: string) {
  try {
    const snap = await adminDb.collection(VERSIONS_COLLECTION).doc(versionId).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() }) : null;
  } catch { return null; }
}
// in the route body:
const page = await getPageBySlug(slug);
let version = null, orgBranding = null;
if (page) {
  [orgBranding, version] = await Promise.all([
    getOrgBranding(page.organizationId),
    page.publishedVersionId ? getPageVersion(page.publishedVersionId) : Promise.resolve(null),
  ]);
}
```
- [ ] **Step 6 — Fix the data path (client fallback).** In `PublicPageClient.tsx`, replace the subcollection read with the top-level collection (keep the `subscription-payment` static fallback **above** it untouched):
```ts
import { VERSIONS_COLLECTION } from '@/lib/page-builder/constants';
// ...
if (pageData.publishedVersionId) {
  const vSnap = await getDoc(doc(db, VERSIONS_COLLECTION, pageData.publishedVersionId));
  if (vSnap.exists()) setVersion({ id: vSnap.id, ...vSnap.data() } as CampaignPageVersion);
}
```
- [ ] **Step 7 — Gate + sanitize `html` blocks** in `PublicPageClient.tsx`:
```tsx
{block.type === 'html' && page.settings.customScriptsAllowed && block.props.html ? (
  <>
    {typeof block.props.css === 'string' && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(block.props.css) }} />}
    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(block.props.html)) }} />
  </>
) : null}
```
- [ ] **Step 8 — Fix Tailwind purge** for `stats` (`PublicPageClient.tsx:614`): replace `` `grid-cols-${n}` `` with a static map `{1:'grid-cols-1',2:'grid-cols-2',3:'grid-cols-3',4:'grid-cols-4'}[count] ?? 'grid-cols-2 md:grid-cols-4'`.
- [ ] **Step 9 — RED: regression test for the static fallback** (`src/lib/page-builder/__tests__/legacy-payment-fixture.test.ts`) asserting `payment-guide-data.json` parses and contains the `payment_methods` block (locks R1/R3 before later phases touch it).
- [ ] **Step 10 — VERIFY LOCALLY (human runs):**
```bash
npx vitest run src/lib/page-builder
npx tsc --noEmit
npm run lint
```
Then commit:
```bash
git add src/lib/page-builder src/app/p/[slug]/page.tsx src/app/p/[slug]/PublicPageClient.tsx
git commit -m "fix(pages): restore published page rendering; sanitize html blocks; fix stats grid"
```

---

### Phase 1 — Pure tree-operations + registry skeleton (no UI change yet)

**Outcome:** every section/block mutation is a pure, tested function; the reducer delegates to them. Registry/field/schema types exist. Behavior identical.

**Files**
- Create: `fields.ts`, `registry.tsx`, `schema.ts`, `tree-operations.ts` (+ tests) under `src/lib/page-builder/`
- Modify: `useBuilderState.ts`, `types.ts` (add `ResolvedTheme`, `BuilderResources`; **do not** change `props` yet)

- [ ] **Step 1 — RED: tree-operations tests** (one behavior each; full file in repo). Examples:
```ts
// src/lib/page-builder/__tests__/tree-operations.test.ts
import { describe, it, expect } from 'vitest';
import { addBlock, moveBlockToSection, duplicateBlock, findBlock } from '../tree-operations';
import type { CampaignPageStructure } from '@/lib/types';

const base: CampaignPageStructure = {
  sections: [
    { id: 's1', type: 'section', props: {}, blocks: [{ id: 'b1', type: 'text', props: { content: 'x' } }] },
    { id: 's2', type: 'section', props: {}, blocks: [] },
  ],
};

it('moveBlockToSection preserves total block count (no loss/dupe)', () => {
  const before = base.sections.flatMap(s => s.blocks).length;
  const next = moveBlockToSection(base, 'b1', 's1', 's2', 0);
  const after = next.sections.flatMap(s => s.blocks).length;
  expect(after).toBe(before);
  expect(next.sections[1].blocks[0].id).toBe('b1');
});

it('duplicateBlock inserts a clone with a new id directly after the source', () => {
  const next = duplicateBlock(base, 'b1');
  expect(next.sections[0].blocks).toHaveLength(2);
  expect(next.sections[0].blocks[1].id).not.toBe('b1');
});
```
- [ ] **Step 2 — Verify RED:** `npx vitest run src/lib/page-builder/__tests__/tree-operations.test.ts` → FAIL.
- [ ] **Step 3 — GREEN:** implement `tree-operations.ts` as pure functions `(structure, …args) => structure` for: `addSection`, `removeSection`, `moveSection`, `reorderSections`, `updateSectionProps`, `addBlock`, `removeBlock`, `updateBlockProps`, `moveBlock`, `reorderBlocks`, `moveBlockToSection`, `duplicateBlock`, `findBlock`. Use structural sharing (only changed branches get new references). Ids via an injectable `makeId()` (default `crypto.randomUUID()`) so tests are deterministic.
- [ ] **Step 4 — Verify GREEN.**
- [ ] **Step 5 — RED: property test** (`tree-operations.property.test.ts`, `@fast-check/vitest`): for random structures + random move sequences, the multiset of block ids is invariant under `moveBlock`/`moveBlockToSection`/`reorder*`. (Locks R8.)
- [ ] **Step 6 — GREEN + Verify.**
- [ ] **Step 7 — Add registry/field/schema type files** (`fields.ts`, `registry.tsx`, `schema.ts`) exactly as in §2/§3. `schema.ts` exports `pageStructureSchema`, `pageSectionSchema`, and `parseStructure(raw): CampaignPageStructure` using `.safeParse` with a defaults-fallback (locks R4). Add `schema.test.ts` (RED→GREEN): malformed JSON returns a valid empty structure, not a throw.
- [ ] **Step 8 — Refactor `useBuilderState.ts`** to import tree-ops and delegate (behavior-preserving). Keep the existing reducer/history shape. This is the `code-refactoring` step: no behavior change, existing builder tests (if any) + manual parity.
- [ ] **Step 9 — Add `ResolvedTheme` & `BuilderResources` to `types.ts`** (typed, no `any`):
```ts
export interface ResolvedTheme {
  colors: { primary: string; secondary: string; background: string; text: string; accent: string };
  typography: { headingFont: string; bodyFont: string; baseSize: string };
  ui: { borderRadius: string; buttonStyle: 'flat' | 'glow' | 'glass' };
}
export interface BuilderResources {
  forms: ReadonlyArray<{ id: string; title: string; internalName?: string }>;
  surveys: ReadonlyArray<{ id: string; title: string }>;
  agreements: ReadonlyArray<{ id: string; title: string }>;
}
```
- [ ] **Step 10 — VERIFY LOCALLY (human):** `npx vitest run src/lib/page-builder` · `npx tsc --noEmit` · `npm run lint`. Commit:
```bash
git add src/lib/page-builder src/app/admin/pages/[id]/builder/hooks/useBuilderState.ts src/lib/types.ts
git commit -m "refactor(pages): extract pure tree-operations + registry/schema scaffolding (behavior-preserving)"
```

---

### Phase 2 — Theme resolution + `BlockRenderer` core (with first 4 blocks)

**Outcome:** `resolveTheme` + CSS-var emission; `BlockRenderer` renders `hero`, `text`, `cta`, `image` through the registry in **both** modes. Editor + public still use their old paths (renderer not yet wired in) — proven by tests only.

**Files**
- Create: `resolve-theme.ts` (+test), `blocks/hero.tsx`, `blocks/text.tsx`, `blocks/cta.tsx`, `blocks/image.tsx`, `blocks/index.ts`, `components/page-builder/BlockRenderer.tsx` (+tests)

- [ ] **Step 1 — RED: resolveTheme test** — given a `CampaignPageTheme` + overrides + branding, returns merged tokens with override precedence; `themeToCssVars()` yields `--pb-color-primary` etc.
- [ ] **Step 2 — GREEN:** `resolve-theme.ts` (override > theme > branding > built-in default). No `any`.
- [ ] **Step 3 — RED: BlockRenderer tests** (`@testing-library/react`): renders a `text` block's content in `view`; renders editable affordance in `edit`; renders a non-throwing fallback for an unregistered type (locks R4); a `view`-mode render of every registered block contains **no** `contentEditable`/`<input>` (locks R11).
- [ ] **Step 4 — GREEN:** implement `blocks/hero|text|cta|image.tsx` (each: `Props` interface, `zod` schema, `fields`, `defaults`, `render(props, block, ctx)` branching on `ctx.mode`). `image` uses `next/image` when width/height known. `BlockRenderer.tsx` recursive walker: parse props via `def.schema`, memoised, passes `renderChildren` for `allowsChildren` blocks. `blocks/index.ts` calls `registerBlock` for each + `registerAllBlocks()`.
- [ ] **Step 5 — Verify GREEN.**
- [ ] **Step 6 — Animations** (emilkowal): block enter/reorder via `motion` `layout` + reduced-motion guard; extract a tiny `useBlockMotion()` hook (tested for the reduced-motion branch).
- [ ] **Step 7 — VERIFY LOCALLY (human)** + commit:
```bash
git add src/lib/page-builder src/components/page-builder
git commit -m "feat(pages): add theme resolver and shared BlockRenderer with hero/text/cta/image blocks"
```

---

### Phase 3 — Port all remaining blocks to the registry

**Outcome:** every block (incl. `form`, `survey`, `agreement`, `logo_grid`, `payment_methods`, `procedure_list`, `columns`, `container`) exists once. `form` renders inline + in modal (fixes F5). Layout blocks nest (fixes F4).

**Files:** `blocks/{video,spacer,divider,faq,testimonial,stats,logo-grid,form,survey,agreement,html,columns,container,payment-methods,procedure-list}.tsx` (+ tests), update `blocks/index.ts`, extend `PageBlockType` union if needed.

- [ ] **Step 1 — RED per block**: one render test in `view` + one in `edit` per block. For `form`: `view` mode renders fields and calls `submitStandaloneFormAction` on submit (mock the action, assert called with form id) — reuse existing `EmbeddedForm` as the `view` body. For `columns`: `allowsChildren` true; renders `ctx.renderChildren()` into N slots; nested block count invariant.
- [ ] **Step 2 — Verify RED → GREEN per block** (work one block at a time; commit-sized). Each block file is self-contained ≤ ~120 lines.
- [ ] **Step 3 — Worked example (`stats`)** — the pattern every block follows:
```tsx
// src/lib/page-builder/blocks/stats.tsx
import { z } from 'zod';
import { BarChart3 } from 'lucide-react';
import { registerBlock } from '../registry';

const statItem = z.object({ id: z.string(), value: z.string(), label: z.string() });
const schema = z.object({ items: z.array(statItem).default([]) });
type StatsProps = z.infer<typeof schema>;
const GRID: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

registerBlock({
  type: 'stats', label: 'Stats', category: 'data', icon: BarChart3,
  fields: [{ kind: 'list', key: 'items', label: 'Stat Items',
    itemFields: [{ kind: 'text', key: 'value', label: 'Value' }, { kind: 'text', key: 'label', label: 'Label' }] }],
  defaults: { items: [] }, schema,
  render: (props: StatsProps, _block, ctx) => {
    const cols = GRID[props.items.length] ?? 'grid-cols-2 md:grid-cols-4';
    return (
      <div className={`grid gap-6 text-center ${cols}`}>
        {props.items.map(i => (
          <div key={i.id} className="p-6 rounded-2xl border" style={{ borderColor: ctx.theme.colors.accent }}>
            <p className="text-3xl font-black" style={{ color: ctx.theme.colors.primary }}>{i.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-2">{ctx.interpolate(i.label)}</p>
          </div>
        ))}
      </div>
    );
  },
});
```
- [ ] **Step 4 — `payment_methods` / `procedure_list`** ported as real blocks so the legacy payment page renders generically (supports R3/legacy migration). Snapshot-test against `payment-guide-data.json`.
- [ ] **Step 5 — VERIFY LOCALLY (human)** + commit (one commit per logical group, e.g. content / data / embed / layout):
```bash
git add src/lib/page-builder/blocks
git commit -m "feat(pages): port all blocks to registry; inline form rendering; nestable layout blocks"
```

---

### Phase 4 — Swap editor canvas + public page onto `BlockRenderer`

**Outcome:** the two divergent renderers are **deleted**; WYSIWYG achieved (fixes F2/F3). Trigger engine, analytics, modal host preserved. Behind `NEXT_PUBLIC_PAGE_BUILDER_V2` flag (R10).

**Files:** `Canvas.tsx`, `BlockEditor.tsx`→`AutoBlockEditor.tsx`, `BlockPalette.tsx`, `PageRenderer.tsx`, `PublicPageClient.tsx`.

- [ ] **Step 1 — RED:** `PageRenderer.test.tsx` renders a multi-section fixture and asserts each block's `view` output appears; CTA click calls `fireTrigger`. `AutoBlockEditor.test.tsx`: given `hero` def, renders inputs for each field and emits `onPropChange` patches.
- [ ] **Step 2 — GREEN:** `PageRenderer.tsx` (theme CSS vars from `resolveTheme`, header/footer from settings, sections via `BlockRenderer mode="view"`, `interpolate` from `searchParams`, `fireTrigger`/`recordInteractionAction` in `ctx`). `AutoBlockEditor.tsx` maps `BlockField.kind` → control; lazy-load `TipTapEditor`/code editors via `next/dynamic` (R6). `BlockPalette.tsx` derives groups from `blockRegistry` by `category`.
- [ ] **Step 3 — Wire `Canvas.tsx`** to `<BlockRenderer mode="edit">` (delete local `BlockPreview`); wire cross-section drag to `moveBlockToSection`.
- [ ] **Step 4 — Wire `PublicPageClient.tsx`**: body becomes `<PageRenderer>`; keep `useTriggerEngine`, the `Dialog` modal host, and `receipt_request`. Remove the in-body `<title>`/`<meta>` hack (metadata is server-side). Behind the V2 flag with the old body as fallback.
- [ ] **Step 5 — Move font injection** to server resource hints in `page.tsx` (`next-best-practices`).
- [ ] **Step 6 — VERIFY LOCALLY (human)** + commit:
```bash
git add src/app/admin/pages/[id]/builder src/app/p/[slug] src/components/page-builder
git commit -m "feat(pages): unify editor + public rendering via BlockRenderer (true WYSIWYG, flagged)"
```

---

### Phase 5 — Section settings, cross-section drag UX, autosave, media

**Outcome:** section background/padding/width UI (props already exist); drag-from-palette; debounced autosave; image upload.

- [ ] **Step 1 — Section settings panel** driven by a `sectionFields` descriptor (RED: renders bg/padding/width controls, emits `updateSectionProps`).
- [ ] **Step 2 — Drag-from-palette** using `@dnd-kit` draggable palette items + droppable sections (RED: dropping a palette item calls `addBlock(type, sectionId)`).
- [ ] **Step 3 — Debounced autosave** hook `useAutosave(version)` (RED: batches writes, fires after 1.5s idle, cancels on unmount; uses `rerender-functional-setstate`/refs to avoid stale closures).
- [ ] **Step 4 — Image upload** to existing storage + media-URL field (reuse app's upload util; RED: returns a URL the `image`/`logo_grid` field consumes).
- [ ] **Step 5 — VERIFY LOCALLY (human)** + commit:
```bash
git commit -m "feat(pages): section settings, palette drag-drop, autosave, image upload"
```

---

### Phase 6 — Legacy migration + flip the flag

**Outcome:** old pages render under V2; `NEXT_PUBLIC_PAGE_BUILDER_V2` defaults on; old renderer deleted.

- [ ] **Step 1 — RED:** `migrate.test.ts` — `migrateLegacyStructure(old)` maps `hero-section`/`payment-methods-section`/`procedure-section` ids into `section.props.heading`/`section.props.icon`, and `cta-1` into a `page_load`-independent trigger or CTA action. Snapshot equals the rendered legacy payment page.
- [ ] **Step 2 — GREEN:** `migrate.ts`; run on load in `PublicPageClient`/`page.tsx` (idempotent).
- [ ] **Step 3 — Default the flag on**, keep the old code path one release behind a const for fast rollback, then delete in a follow-up task.
- [ ] **Step 4 — Firestore rules** (R9): audit/adjust `firestore.rules` for `campaign_page_versions` read on publish and `page_templates`. **Flag for human to deploy** (`firebase deploy --only firestore:rules`).
- [ ] **Step 5 — VERIFY LOCALLY (human)** + commit:
```bash
git commit -m "feat(pages): legacy structure migration; enable BlockRenderer by default"
```

---

### Phase 7 — Template library (SaaS / Schools / Marketing)

**Outcome:** a real, seeded template library replacing the 2 stub templates.

**Files:** `src/lib/page-builder/templates/{saas,schools,marketing,index}.ts` (+ a schema test), `seed.ts`, optional `NewPageClient.tsx` thumbnail map extension.

- [ ] **Step 1 — RED:** `templates.test.ts` — every template's `structureJson` passes `pageStructureSchema`; every referenced block `type` exists in the registry; `goal` is valid. (Prevents shipping a broken template — the original sin in `seed.ts:917`.)
- [ ] **Step 2 — GREEN:** author templates as typed `PageTemplate[]` per vertical. Each builds from registry blocks only.

  **SaaS:** Product-launch / waitlist · Free-trial signup (split hero + inline form) · Demo request · Pricing (columns) · Changelog.
  **Schools:** Admissions / enrollment (registration form) · Open-day RSVP · **Fee payment guide** (generalised from the legacy hardcode) · Parent/student onboarding (procedure_list + agreement) · Scholarship application.
  **Marketing:** Lead-gen landing · Promo/countdown · Webinar registration · Case study (stats + media) · Thank-you / confirmation.

  Each commits to a distinct `frontend-design` aesthetic via theme tokens + the allowed font pairings (no generic Inter-on-white).
- [ ] **Step 3 — Wire `seed.ts`** `seedPageTemplates` to import `templates/index.ts`. Keep `blank-page`.
- [ ] **Step 4 — VERIFY LOCALLY (human)** + commit:
```bash
git add src/lib/page-builder/templates src/lib/seed.ts
git commit -m "feat(pages): seed SaaS/Schools/Marketing template library"
```

---

## 8. Testing Strategy

- **Unit (pure, fast):** `tree-operations`, `schema`/`parseStructure`, `resolve-theme`, `sanitize`, `migrate`, `templates` — no React, no Firestore. Highest ROI; lock invariants (block-id multiset, override precedence, no-throw parsing).
- **Property tests** (`@fast-check/vitest`): tree-op id invariants (R8).
- **Component (`@testing-library/react`, jsdom):** `BlockRenderer` per block in `view`+`edit`; `view`-mode has no edit affordances (R11); `AutoBlockEditor` field→control mapping; `PageRenderer` section/trigger wiring.
- **Snapshot:** legacy `payment-guide-data.json` through `PageRenderer` (R1/R3).
- **Not in scope for CI here:** Playwright e2e (excluded by `vitest.config.ts`); add a manual smoke checklist in the PR.

## 9. Rollout & Safety

1. Phase 0 ships alone (restores production).
2. Phases 1–3 are invisible (additive + behavior-preserving) — safe to merge incrementally.
3. Phase 4 is **flagged** (`NEXT_PUBLIC_PAGE_BUILDER_V2=false` until verified).
4. Phase 6 flips the flag after the legacy snapshot passes; old code deleted one release later.
5. Firestore rules deploy is a **human gate**.

## 10. Self-Review (writing-plans checklist)

- **Spec coverage:** F1→P0; F2/F3→P4; F4→P3; F5→P3; F6→P2; F7/F8→P0; F9→P5. Every audit finding maps to a phase. ✅
- **Placeholder scan:** keystone code (constants, sanitize, registry types, tree-ops tests, stats block, theme types, data-path fix) is concrete. Repetitive block bodies follow the worked `stats` example + per-block test contract — not "TODO". ✅
- **Type consistency:** `BlockDefinition`/`BlockRenderContext`/`ResolvedTheme`/`BuilderResources`/`VERSIONS_COLLECTION`/`parseStructure`/`moveBlockToSection` names are used identically across §2, §3, and all phases. ✅
- **No `any`:** storage props are `Record<string, unknown>`; blocks parse to typed `TProps` via `zod`; dynamic values use `unknown` + guards. ✅

## 11. Open Decisions (need your input before/around Phase 2–4)

1. **`PageBlock.props` type change** (`any → unknown`): land it incrementally per-block (recommended, lower risk) vs one big task?
2. **Build-your-own registry (this plan)** vs adopt **`@measured/puck`**: plan assumes build-your-own to keep the existing editor shell, triggers, and Firestore model. Confirm.
3. **Feature flag mechanism:** env var (`NEXT_PUBLIC_PAGE_BUILDER_V2`) vs per-org Firestore flag for gradual rollout?
4. **Migration timing:** migrate on read (lazy, in `PageRenderer`) vs a one-time backfill script over `campaign_page_versions`?
