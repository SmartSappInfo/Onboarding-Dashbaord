# Page Builder Overhaul — Summary

A record of the campaign/landing-page builder overhaul: what was wrong, what was
built, and what remains. For the full phase-by-phase implementation plan see
[`docs/superpowers/specs/2026-06-24-page-builder-overhaul-spec.md`](superpowers/specs/2026-06-24-page-builder-overhaul-spec.md).

---

## 1. The problem

The page designer (`/admin/pages/[id]/builder` editor + public `/p/[slug]`) was a
single-purpose payment-page demo dressed up as a generic builder. Audit findings:

| # | Severity | Finding |
|---|----------|---------|
| F1 | 🔴 P0 | **Published pages 404'd.** Versions were written to the top-level `campaign_page_versions` collection but read from two different (non-existent) subcollection paths. Only the static `subscription-payment` page worked. |
| F2 | 🔴 P0 | **Renderer hardcoded** to one payment use-case (section ids `hero-section`/`payment-methods-section`, `cta-1` → bespoke receipt modal). |
| F3 | 🔴 P0 | **Two divergent renderers** — every block implemented twice (editor preview vs public), already disagreeing → no WYSIWYG. |
| F4 | 🟠 P1 | **Dead block types** — `columns`/`container`/`logo_grid` had no real implementation; nesting unimplemented. |
| F5 | 🟠 P1 | **Forms never rendered inline** on the public page (modal-only) — fatal for lead capture. |
| F6 | 🟠 P1 | **Themes barely applied** — only `themeOverrides.primary` reached the live page. |
| F7 | 🟡 P2 | **XSS surface** — `html` blocks injected raw HTML/CSS unsanitized; `customScriptsAllowed` unenforced. |
| F8 | 🟡 P2 | **Tailwind purge bug** — dynamic `grid-cols-${n}` stripped from the production bundle. |
| F9 | 🟡 P2 | No cross-section drag, no responsive controls, no autosave, URL-only media, only 2 (one broken) templates. |

## 2. The solution — a single block registry

The core architectural move: **define each block once**, in a registry that powers
**both** the editor canvas and the published page. Adding a block = one file; both
surfaces pick it up automatically. This eliminates F2/F3 and the dead-block problem
in one stroke.

```
src/lib/page-builder/
  registry.tsx        BlockDefinition { fields, defaults, schema, render }, registerBlock/getBlock/allBlocks
  fields.ts           BlockField descriptor union (drives the auto-generated panel)
  schema.ts           zod schemas + parseStructure() (never throws)
  tree-operations.ts  pure, tested section/block mutations (immutable, structural sharing)
  resolve-theme.ts    resolveTheme() (override > theme > branding > default) + themeToCssVars()
  sanitize.ts         DOMPurify wrappers (sanitizeHtml / sanitizeCss)
  migrate.ts          migrateLegacyStructure() — legacy section ids → section.props.heading
  upload.ts           uploadPageImage() + pure buildPageImagePath()
  blocks/*            19 block definitions (hero, text, cta, image, video, spacer, divider,
                      faq, testimonial, stats, logo-grid, payment-methods, procedure-list,
                      columns, container, form, survey, agreement, html)
  templates/*         SaaS / Schools / Marketing starter library

src/components/page-builder/
  BlockRenderer.tsx   recursive tree walker, renders via registry (mode: edit | view)
  PageRenderer.tsx    public page shell (theme CSS vars, sections, CSS-only staggered reveal)
  AutoBlockEditor.tsx property panel generated from def.fields (replaces per-type switch)
  SectionSettings.tsx section-level panel (heading, background)
  useAutosave.ts      debounced autosave hook
  useBlockMotion.ts   emilkowal-compliant motion config (reduced-motion aware)
  embeds/             FormView (presentational), EmbeddedForm (Firestore), EmbeddedSurvey
```

## 3. What was delivered (Phases 0–7 + 5b image upload)

| Phase | Outcome | Key files |
|-------|---------|-----------|
| **0** | Restored published pages (F1), sanitized `html` blocks (F7), fixed stats grid (F8) | `constants.ts`, `sanitize.ts`, `p/[slug]/page.tsx`, `PublicPageClient.tsx` |
| **1** | Pure `tree-operations` + registry/schema scaffolding; reducer delegates to tree-ops | `tree-operations.ts`, `schema.ts`, `registry.tsx`, `fields.ts` |
| **2** | Theme resolver + shared `BlockRenderer` + first 4 blocks | `resolve-theme.ts`, `BlockRenderer.tsx`, `blocks/{hero,text,cta,image}` |
| **3** | All 19 blocks ported; inline forms (F5); nestable layout blocks (F4) | `blocks/*`, `embeds/*` |
| **4** | Editor canvas + public page swapped onto `BlockRenderer` (WYSIWYG, F2/F3); field-driven panel | `PageRenderer.tsx`, `AutoBlockEditor.tsx`, `Canvas.tsx`, `BlockPalette.tsx` |
| **5** | Debounced autosave + section settings panel | `useAutosave.ts`, `SectionSettings.tsx` |
| **6** | Legacy migration (payment page headings + `cta-1` shim); **`PAGE_BUILDER_V2` flag flipped ON by default** | `migrate.ts`, `PublicPageClient.tsx` |
| **7** | SaaS / Schools / Marketing template library (replaces 2 stubs) | `templates/{saas,schools,marketing,index}.ts`, `seed.ts` |
| **5b (part 1)** | Inline image upload in the property panel | `upload.ts`, `AutoBlockEditor.tsx` |

### Template library (Phase 7)
- **SaaS:** Product Launch Waitlist, Free Trial Signup, Request a Demo
- **Schools:** Admissions/Enrollment, Open Day RSVP, Fee Payment Guide
- **Marketing:** Lead-Gen Landing, Webinar Registration, Thank You

Each is validated by a test: schema passes, all (incl. nested) block types are
registered, unique block ids, valid goal.

## 4. Engineering standards applied

- **TDD** — tests written first across all phases (`src/lib/page-builder/__tests__/`, `src/components/page-builder/__tests__/`). Pure logic (tree-ops, schema, theme, migrate, sanitize, upload-path) is unit-tested; components via `@testing-library/react`; tree invariants via `fast-check` property tests.
- **No `any` / `any[]`** — storage props are `Record<string, unknown>`; each block declares a typed `Props` interface validated by `zod`; the one type-erasure cast is contained in `registerBlock`.
- **next-best-practices / vercel-react-best-practices** — `Promise.all` in the public route, `cache()` dedupe, memoization, registry as O(1) `Record`, `next/dynamic`-eligible editor deps kept out of the public path.
- **emilkowal-animations** — transform/opacity only, CSS-only staggered section reveal with `motion-reduce:` opt-out; `useBlockMotion` reduced-motion-aware.
- **frontend-design** — templates commit to distinct per-vertical tone; theme tokens drive styling via CSS variables.

## 5. The V2 flag

`NEXT_PUBLIC_PAGE_BUILDER_V2` controls which renderer published pages use:
- **Default ON** (`!== 'false'`) — pages render through the new `PageRenderer`.
- Set the env var to `'false'` for an instant rollback to the legacy body (still
  present in `PublicPageClient.tsx`).

## 6. Risks tracked & resolved

The spec's risk register (R1–R11) was worked through: data-path fix preserved the
static payment page (R1), the `any → unknown` migration was staged per-block (R2),
`parseStructure` never throws on legacy/unknown data (R4), DOMPurify runs
isomorphically to avoid hydration mismatch (R5), tree-op id-multiset invariants are
property-tested (R8), and a Firestore-rules audit confirmed **no rules change is
needed** (public reads go through the server admin SDK) (R9).

## 7. Remaining / optional work

- **Drag-from-palette** (the other half of 5b) — needs the dnd-kit `DndContext`
  hoisted above the sidebar + canvas with a `DragOverlay`. Deferred because DnD
  needs interactive (visual) verification and risks regressing the working
  section-reorder. Best done in a hands-on session.
- **Delete the legacy public body** in `PublicPageClient.tsx` once V2 is confirmed
  stable in production.
- **More templates** — trivial to add now (one entry per template file).
- **Responsive per-breakpoint overrides** — `block.responsive.mobile` (spec Phase 3,
  Step 11) was scoped out of the delivered work; the viewport toggle is still
  preview-only.

## 8. Verification & deployment notes

- This work was implemented **without running** `build` / `tsc` / `lint` / `git
  commit` from the agent — each phase was handed off with exact verify commands and
  a commit message for local execution.
- The branch `feat/unify-whatsapp-templates` carries **3 pre-existing `tsc` errors**
  in `messaging/templates/*` (GalleryTemplate / `_source` / RecipientType) that are
  unrelated to this overhaul.
- Before relying on V2 in production, run `npm run dev` and click through a
  published page (e.g. `/p/subscription-payment`): confirm headings, blocks, the
  Request Receipt CTA, autosave, section settings, and image upload all work.
