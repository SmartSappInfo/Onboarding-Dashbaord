# Page Builder — State & Summary

A record of the campaign/landing-page builder: the original overhaul (the
foundation) and the current state after subsequent team merges. For the detailed
implementation plan of the foundation, see
[`docs/superpowers/specs/2026-06-24-page-builder-overhaul-spec.md`](superpowers/specs/2026-06-24-page-builder-overhaul-spec.md).

> **Status:** the foundation (single block registry + WYSIWYG) is in place and has
> since been extended significantly by the team — block variants, a richer editor
> (AI copilot, layers, tabbed properties, variables), a full-featured section
> settings panel, page analytics/tracking, and more blocks & templates.

---

## 1. Architecture (unchanged core idea)

Each block is defined **once** in a registry that powers **both** the editor canvas
and the published page (true WYSIWYG). Adding a block = one file; both surfaces pick
it up automatically.

```
src/lib/page-builder/
  registry.tsx        BlockDefinition { fields, defaults, schema, render, variants?, allowsChildren? }
  fields.ts           BlockField descriptor union (drives the generated property panel)
  schema.ts           zod schemas + parseStructure() (never throws)
  tree-operations.ts  pure, tested section/block mutations (immutable, structural sharing)
  resolve-theme.ts    resolveTheme() (override > theme > branding > default) + themeToCssVars()
  sanitize.ts         DOMPurify wrappers (sanitizeHtml / sanitizeCss)
  migrate.ts          migrateLegacyStructure() — legacy section ids → section.props.heading
  upload.ts           uploadPageImage() + pure buildPageImagePath()
  blocks/*            28 block definitions (see §3)
  templates/*         homepage / SaaS / Schools / Marketing starter libraries

src/components/page-builder/
  BlockRenderer.tsx   recursive tree walker, renders via registry (mode: edit | view)
  PageRenderer.tsx    public page shell (theme vars, section backgrounds/overlays/layouts, reveal)
  AutoBlockEditor.tsx property panel generated from def.fields (+ inline image upload)
  SectionSettings.tsx tabbed section panel (Layout / Media / Spacing / Visibility)
  PageTracking.tsx    client-side page-view + UTM capture for published pages
  DebouncedInputs.tsx debounced input primitives (canvas inline-edit performance)
  useAutosave.ts      debounced autosave hook
  useBlockMotion.ts   emilkowal-compliant motion config (reduced-motion aware)
  embeds/             FormView (presentational), EmbeddedForm (Firestore), EmbeddedSurvey

src/app/admin/pages/[id]/builder/components/
  Canvas.tsx          editor canvas (dnd-kit; droppable sections)
  BlockPalette.tsx    enterprise palette — search, categories, variants, "coming soon" placeholders
  BlockVariantPicker.tsx  modal to choose a block's visual variant (thumbnails)
  PropertiesPanel.tsx tabbed block properties (Properties / Typography / Spacing)
  LayersPanel.tsx     layers/tree view of the page structure with inline rename
  VariablesPanel.tsx  page personalization tokens/variables (e.g. {{name}})
  AiCopilotPanel.tsx  AI copilot assist panel
  PublishTemplateModal.tsx  publish a section/page as a reusable template
  ThemePanel / SettingsPanel / TriggerPanel / HistoryPanel / TipTapEditor
```

## 2. The original problem (foundation, resolved)

The designer was a single-purpose payment-page demo dressed up as a builder. Audit
findings F1–F9, all addressed by the foundation work:

- **F1** published pages 404'd (three-way version-path mismatch) — fixed.
- **F2/F3** hardcoded + divergent renderers — eliminated by the single registry.
- **F4** dead layout/nesting blocks — implemented (`columns`/`container` nest).
- **F5** forms never rendered inline — inline forms via `EmbeddedForm`.
- **F6** themes barely applied — `resolveTheme` consumed by the renderer.
- **F7/F8** XSS surface + Tailwind purge bug — sanitized + static class maps.
- **F9** no autosave/section-settings/upload/templates — all added.

Delivered as phases 0–7 (+ image upload): data-path fix & sanitization → pure
tree-operations & registry scaffolding → theme resolver & `BlockRenderer` → all
blocks ported → editor/public swap onto the registry → autosave & section settings
→ legacy migration & `PAGE_BUILDER_V2` default-on → template library → inline image
upload.

## 3. Current state — blocks (28)

**Content:** `title`, `hero`, `video_hero`, `text`, `cta`, `image`, `video`,
`spacer`, `divider`
**Data / sections:** `stats`, `testimonial`, `testimonial_grid`, `logo_grid`,
`faq`, `countdown`, `step_section`, `app_download`, `payment_methods`,
`procedure_list`
**Layout:** `columns`, `container`, `choice_cards`
**Embeds / app:** `form`, `survey`, `agreement`, `qr`, `meeting`, `html`

**Block variants:** a block may declare `variants` (each with a label, description,
thumbnail, and prop `defaults`). Choosing such a block in the palette opens
`BlockVariantPicker` to pick a starting look; blocks without variants add directly.
The palette also lists "coming soon" placeholders (AI panels, pricing tables,
carousels, school modules, etc.) that toast rather than insert.

## 4. Current state — editor experience

- **WYSIWYG canvas** (dnd-kit, droppable sections) rendering through `BlockRenderer`
  in edit mode, with debounced inline text editing.
- **Property panel** — generated from each block's `fields`, now surfaced via a
  tabbed `PropertiesPanel` (Properties / Typography / Spacing) plus inline **image
  upload** to `media/page-builder/…`.
- **Section settings** — tabbed (Layout / Media / Spacing / Visibility): column
  layouts, vertical alignment, background color/gradient (presets)/image/video via
  the media library, overlays, spacing presets + min-height, and device/behaviour
  visibility rules.
- **Layers panel** — tree view of sections/blocks with inline rename.
- **Variables panel** — personalization tokens (e.g. `{{name}}`) for dynamic copy.
- **AI copilot panel** — assisted page building.
- **Autosave** — debounced silent draft persistence (gated on first edit).
- **Publish as template** — save a section/page into the reusable library.
- **Inline title/slug editors + breadcrumbs** in the toolbar.

## 5. Current state — published page

`PageRenderer` renders the section/block tree generically in view mode: theme
tokens as CSS variables, section headings/backgrounds/overlays/layouts from
`section.props`, and CSS-only staggered reveal (reduced-motion aware).
`PageTracking` records page views + UTM parameters. Embeds support a `postMessage`
iframe resizer and responsive modal auto-scaling.

`NEXT_PUBLIC_PAGE_BUILDER_V2` is **ON by default** (`!== 'false'`); set the env var
to `'false'` for an instant rollback to the legacy body (still present in
`PublicPageClient.tsx`).

## 6. Current state — templates

- **Homepage:** SmartSapp Homepage & Onboarding Portal (persona selector, app
  downloads, etc.).
- **SaaS:** Product Launch Waitlist, Free Trial Signup, Request a Demo.
- **Schools:** Admissions/Enrollment, Open Day RSVP, Fee Payment Guide.
- **Marketing:** Lead-Gen Landing, Webinar Registration, Thank You.

`templates.test.ts` validates every template: schema passes, all (incl. nested)
block types are registered, unique block ids, valid goal.

## 7. Engineering standards

- **TDD** — `src/lib/page-builder/__tests__/` (tree-operations + property tests,
  schema, resolve-theme, sanitize, migrate, upload-path, blocks, templates, legacy
  fixture) and `src/components/page-builder/__tests__/`.
- **No `any` / `any[]`** in the foundation — storage props are
  `Record<string, unknown>`, typed per-block via `zod`; the single type-erasure
  cast lives in `registerBlock`.
- **next / vercel-react best practices** — parallelized route reads, `cache()`
  dedupe, memoization, O(1) registry lookups, debounced inputs.
- **emilkowal-animations** — transform/opacity, CSS-only staggered reveal,
  reduced-motion opt-out.
- **frontend-design** — distinct per-vertical template tone; theme-token styling.

> Note: newer team-merged additions (variants, the expanded panels, richer section
> settings) should be held to the same no-`any` / TDD bar as they mature; a few of
> the newer surfaces are UI-heavy and less test-covered than the foundation.

## 8. Remaining / optional work

- **Drag-from-palette** — Canvas now exposes droppable sections; the palette-side
  `useDraggable` + `DragOverlay` half still needs wiring and hands-on (visual)
  verification.
- **Retire the legacy public body** in `PublicPageClient.tsx` once V2 is confirmed
  stable in production.
- **Placeholder blocks** — the palette's "coming soon" items (AI chat, pricing
  table, carousel, file upload, signature, school modules, etc.) are stubs awaiting
  implementation.
- **Responsive per-breakpoint overrides** — section visibility rules exist; true
  per-breakpoint prop overrides (`block.responsive.mobile`) are not yet in place.

## 9. Verification & deployment notes

- Foundation phases were implemented **without** the agent running
  `build`/`tsc`/`lint`/`git commit` — each was handed off with exact verify commands.
- Before relying on V2 in production, run `npm run dev` and click through a
  published page (e.g. `/p/subscription-payment`) plus the builder (variants,
  section settings, layers, autosave, image upload).
- Run `npx vitest run src/lib/page-builder src/components/page-builder`,
  `npx tsc --noEmit`, and `npm run lint` after changes. Note that block additions
  should be reflected in `blocks.test.tsx`'s expected-type list.
