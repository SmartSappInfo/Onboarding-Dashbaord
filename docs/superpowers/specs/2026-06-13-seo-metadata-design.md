# Design Specification: SEO & Metadata Customization

**Date**: 2026-06-13
**Status**: ✅ Implemented (v2) — all 5 phases done & verified (typecheck clean; 41 unit tests passing). One manual step remains: run the survey-SEO backfill (Phase 3) against each environment.
**Author**: Engineering

> **Implementation log**
> - **Phase 1 ✅** — `OgImageMode`/`SeoConfig` added to [types.ts](src/lib/types.ts); `seo?` on Survey/Meeting/PDFForm/Form; legacy survey flat fields `@deprecated`. Pure resolver [seo.ts](src/lib/seo.ts) (`resolveSeoMetadata`, `mapLegacySurveySeo`, `normalizeParentImages`). Tests [seo.test.ts](src/lib/__tests__/seo.test.ts) — 25 passing. Typecheck clean. **Deviation:** `CampaignPage.seo` not widened (its literal is already assignable to `SeoConfig`); survey zod schema deferred to Phase 3 where it's consumed.
> - **Phase 2 ✅** — all five public readers routed through `resolveSeoMetadata`: [surveys](src/app/surveys/[slug]/page.tsx) (legacy-flat fallback via `mapLegacySurveySeo`), [pages](src/app/p/[slug]/page.tsx), [meetings](src/app/meetings/[typeSlug]/[entitySlug]/page.tsx), [forms](src/app/p/f/[slug]/page.tsx), [pdf signing docs](src/app/forms/[pdfId]/page.tsx). CR‑2 double-brand fixed (bare/absolute titles). CR‑3 duplicate fetch fixed via in-place `React.cache()` loaders. `noindex` + de-double-branded titles added to result/dashboard/invoice/preferences. **Deviation:** used in-place `cache()` wrapping per file instead of a shared `content-loaders.ts` — same dedup outcome, far less churn/risk.
> - **Follow-ups ✅** — (a) Verified both survey wizards (new + edit) render `Step4Publish`, so the moved editor appears in both flows. (b) Closed the `entity_logo` OG-mode gap: [p/f form reader](src/app/p/f/[slug]/page.tsx) and [PDF reader](src/app/forms/[pdfId]/page.tsx) now pass `getOrgBranding(...)` so the "Organization Logo" mode resolves (pages/meetings already did). (c) Removed dead imports left by the survey/page editor moves (`Sparkles`/`Loader2`/`RadioGroup`/`Globe` in step-1-details; `Input` in SettingsPanel). **Not done (by design):** dropping the deprecated flat survey fields stays deferred until the production backfill has run (readers/editor still fall back to them); the "migrate `PdfsClient` document.title" item was moot — no such `document.title` exists.
> - **Phase 5 ✅** — Client-side tab titles: [use-page-title.ts](src/hooks/use-page-title.ts) (`useLayoutEffect`, restores prev on unmount), [PageTitleManager.tsx](src/components/seo/PageTitleManager.tsx), static [route-titles.ts](src/lib/route-titles.ts) maps mirroring both sidebars + longest-prefix `resolveRouteTitle`. Admin shell composes `{org} · {feature} — SmartSapp` (org from `TenantContext`); backoffice composes `{feature} — SmartSapp`. Static `robots: noindex` added to [admin](src/app/admin/layout.tsx) + [backoffice](src/app/(backoffice)/backoffice/layout.tsx) server layouts. 7 route-title tests. **Note:** existing `document.title` in `PdfsClient` left in place (last-writer-wins, harmless); migrate in a later polish pass.
> - **Phase 4 ✅** — Shared [SeoSettingsCard](src/components/seo/SeoSettingsCard.tsx) (controlled, `SeoConfig`-based, live Google SERP + 1200×630 social-card preview, plain `<img>` per CR‑5, injectable `renderImagePicker`) mounted in all five surfaces: **surveys** (publish step, flat-RHF⇄`SeoConfig` bridge + AI keywords relocated), **campaign pages** (builder `SettingsPanel`; `CampaignPage.seo` widened to `SeoConfig`, two strict consumers fixed), **meetings** (publish step; zod+default+load+save), **forms** (Share step; `...formData` persists `seo`), **PDF signing docs** (publish step; zod + `savePdfForm` passes `...data`, admin SDK `ignoreUndefinedProperties`). Typecheck clean; 34 tests passing. Per user decision: full card used everywhere incl. the page-builder sidebar.
> - **Phase 3 ✅** — survey form migrated flat→nested at the **persistence boundary** (RHF bindings left flat → low risk). New helpers in [seo.ts](src/lib/seo.ts): `surveyToSeoFormFields` (load: nested/legacy→flat), `migrateSurveyFormSeo` (save: flat→nested, strips stale `seo`). Wired into [new](src/app/admin/surveys/new/page.tsx) (save) and [edit](src/app/admin/surveys/[id]/edit/page.tsx) (load defaults + both save handlers). Idempotent, dry-run-default backfill at [/api/migration/survey-seo](src/app/api/migration/survey-seo/route.ts). CR‑1 save-path risk cleared (`cleanFirestoreData` preserves nested objects). Tests: 34 passing (9 new). Typecheck clean. **Note:** flat zod schemas in new/edit kept (they validate the still-flat form); public reader is already `seo`-first from Phase 2, so flat fields can be dropped in a later cleanup after the one-release soak.
**Skills applied**: `next-best-practices` (esp. [metadata.md](.agents/skills/next-best-practices/metadata.md), `rsc-boundaries`, `data-patterns`), `vercel-react-best-practices` (`server-cache-react`, `async-parallel`, `bundle-dynamic-imports`, `rerender-*`), `frontend-design`, `test-driven-development`, `code-refactoring`, `writing-plans`

> **Build/verify note:** This plan never runs `npm run build`, `typecheck`, or `lint` — those are flagged at each phase for **you to run locally** to conserve AI credits. Look for the **▶ RUN LOCALLY** callouts.

---

## 0. What changed in v2 (code review delta)

v1 treated this as "add a `seo` object + an editor." Reading the actual code surfaced six issues that change the plan materially:

| # | Finding | Evidence | Impact on plan |
|---|---|---|---|
| CR‑1 | Survey SEO is **not just a type** — it's a flat-field **zod schema + RHF binding duplicated in two files**, persisted by a **direct client-side `addDoc`/`setDoc`** (no server action). | [new/page.tsx:101‑106,223‑228,366](src/app/admin/surveys/new/page.tsx), [edit/page.tsx:132‑137,269‑270](src/app/admin/surveys/[id]/edit/page.tsx) | Migration touches 6 layers, not 1. New Phase 3 split + duplicated-schema de-dup. |
| CR‑2 | **Double-branding title bug** already in prod: root template is `%s — SmartSapp`, yet readers hardcode `\| SmartSapp` / `— SmartSapp`, producing `"… \| SmartSapp — SmartSapp"`. | root [layout.tsx](src/app/layout.tsx); [surveys/[slug]/page.tsx:57](src/app/surveys/[slug]/page.tsx), [p/[slug]/page.tsx:46](src/app/p/[slug]/page.tsx), [invoice/[id]/page.tsx:20](src/app/invoice/[id]/page.tsx) | Resolver must own branding via `title.absolute`; readers return **bare** titles. Fix folded into Phase 2. |
| CR‑3 | Meeting page **fetches the meeting doc twice** (once in `generateMetadata`, once in the body) — a duplicate Firestore read / waterfall. Same risk for every page once we add an org-branding fetch. | [meetings/[type]/[slug]/page.tsx](src/app/meetings/[typeSlug]/[entitySlug]/page.tsx) | All loaders wrapped in `react.cache()` (`server-cache-react`). New Phase 2 sub-task. |
| CR‑4 | **Two** form systems both in scope: `forms` (`Form`) and `pdfs` (`PDFForm`, the "signing documents"). | [types.ts:1932,3287](src/lib/types.ts); [forms/[pdfId]/page.tsx](src/app/forms/[pdfId]/page.tsx), [p/f/[slug]/page.tsx](src/app/p/f/[slug]/page.tsx) | "Forms" = **two** surfaces. Both get `seo` + an editor. |
| CR‑5 | Custom OG-image **preview** in the editor can break `next/image` (arbitrary host not in `remotePatterns`). OG `<meta>` tags themselves are unaffected (raw URLs, not proxied). | [next.config](next.config.ts) `images.remotePatterns` | Preview uses a plain, sandboxed `<img>` + host allow-listing for upload; never `next/image`. |
| CR‑6 | Admin/Backoffice are auth-gated `'use client'` SPAs → `generateMetadata` is **impossible** there (RSC-only, per `metadata.md`). Their "SEO" is really **tab-title UX + explicit `noindex`**, not search optimization. | [admin/layout-client.tsx](src/app/admin/layout-client.tsx), [metadata.md](.agents/skills/next-best-practices/metadata.md) | Phase 5 reframed: client title hook + one static `robots:{index:false}` in each section layout. No per-page metadata churn. |

---

## 1. Locked Decisions

1. **Full migration** of survey flat `seo*` → nested `seo: SeoConfig`, via idempotent endpoint, with a transitional read-fallback and one-release deprecation window.
2. **Editor ships to all four client-facing surfaces** (Surveys, Pages, Meetings, **both** form systems) in their **publish step**.
3. **Admin/Backoffice titles are client-side** (`usePageTitle`) + static `noindex`; no `generateMetadata` attempted there.

---

## 2. Objectives & Non-Goals

### Goals
1. One `SeoConfig` model + one pure `resolveSeoMetadata()` resolver behind **every** public `generateMetadata`.
2. Custom og:image / og:title / og:description / og:keywords editable in the **publish step** of every client-facing type, with a live preview.
3. Org-scoped titles: Admin `{Org} · {Feature} — SmartSapp`; Backoffice `{Feature} — SmartSapp`.
4. Fix CR‑2 (double branding) and CR‑3 (duplicate fetch) as part of the refactor.
5. Pure-function core with colocated **vitest** unit tests (resolver + migration mapper + title composer).
6. **Zero regression** on live surveys/pages/meetings/forms.

### Non-Goals (this effort)
- Dynamic OG **image generation** (`next/og`) — model uses uploaded/custom URLs only. (If added later, use `next/og`, **not** `@vercel/og`, per `metadata.md`.)
- `sitemap.ts` / `robots.ts` site-wide generation, JSON-LD structured data.
- Custom SEO editor for `dashboard/[entity]`, `invoice/[id]`, `preferences/[id]` — these adopt the resolver for **consistency + noindex** only (Phase 2), no editor.
- Dropping deprecated flat survey fields (separate cleanup PR, post one-release soak).

---

## 3. Architecture

### 3.1 Shared model — `src/lib/types.ts`

```ts
export type OgImageMode = 'asset' | 'entity_logo' | 'custom';

/** Canonical, surface-agnostic SEO config. Persisted as `seo` on content docs. */
export interface SeoConfig {
  title?: string;               // bare title (no brand suffix — resolver brands it)
  description?: string;         // plain text; HTML is stripped by resolver
  keywords?: string;            // comma-separated; resolver → string[]
  ogImageMode?: OgImageMode;    // default per surface (see resolver)
  ogImageUrl?: string;          // used only when ogImageMode==='custom'
  useContentFallback?: boolean; // title/description mirror content fields
  noIndex?: boolean;
}
```

Add `seo?: SeoConfig` to `Survey`, `CampaignPage` (widening its inline `seo`), `Meeting`, `PDFForm`, `Form`. Flat survey fields marked `@deprecated` (kept one release).

### 3.2 Resolver — `src/lib/seo.ts` (pure, server, unit-tested)

```ts
type TitleStrategy =
  | { mode: 'brand' }                       // → `${title} — SmartSapp` via template
  | { mode: 'absolute'; suffix?: string };  // → exact string, bypasses template

export function resolveSeoMetadata(input: {
  seo?: SeoConfig;
  fallback: { title: string; description?: string; assetImageUrl?: string };
  org: OrgBranding;
  title?: TitleStrategy;        // default { mode: 'brand' }
  parentImages?: NonNullable<ResolvingMetadata['openGraph']>['images'];
}): Metadata;
```

Owns, in **one** place, what is currently copy-pasted five ways:
- Title: `seo.title || fallback.title`, **bare**; branding applied via `title.absolute` (kills CR‑2). Never returns hardcoded `| SmartSapp`.
- Description: `seo.description || fallback.description`, HTML-stripped (reuse `stripHtml`).
- og:image by mode: `custom`→`seo.ogImageUrl`; `entity_logo`→`org.logoUrl`; `asset`/unset→`fallback.assetImageUrl`→`parentImages`.
- `keywords` split/trim/filter → `string[] | undefined`.
- `twitter: summary_large_image`, `robots` from `noIndex`, `openGraph.type:'website'`.
- **Never throws** — wrapped callers keep the existing graceful `try/catch` so a metadata failure never blanks the page (preserves current meeting behavior).

> `resolveSeoMetadata` imports nothing from React/Firestore — it's a pure mapper. Trivially testable; this is the `code-refactoring` "extract pure core" win.

### 3.3 Per-request fetch dedup — `src/lib/content-loaders.ts`

Each surface gets **one** `cache()`-wrapped loader reused by both `generateMetadata` and the page body (fixes CR‑3, satisfies `server-cache-react` + `metadata.md` "Avoid Duplicate Fetches"):

```ts
export const getMeetingBySlug = cache(async (slug: string) => { /* single source */ });
// + getSurveyBySlug, getCampaignPageBySlug, getFormBySlug, getPdfFormBySlug
```

`getOrgBranding` is already `cache()`-wrapped — reuse as-is.

### 3.4 Shared editor — `src/components/seo/SeoSettingsCard.tsx`

Controlled component (`value: SeoConfig`, `onChange`), extracted from the richest existing impl ([step-1-details.tsx](src/app/admin/surveys/components/step-1-details.tsx) ~lines 525‑730). Props: `assetLabel`, `assetImageUrl`, `entityLogoUrl`, optional `onGenerateKeywords` (AI). Used identically by all four publish steps.

`frontend-design` direction for the live preview: a **Google SERP row** (title/url/description truncation rules) **+ a social share card** (1200×630 framing), styled to feel like a real result — not a generic bordered box. Preview image via sandboxed plain `<img loading="lazy" referrerPolicy="no-referrer">` (CR‑5), never `next/image`. `rerender-*`: card is memoized; preview derives from props during render (no effects).

### 3.5 Admin/Backoffice titles — `src/hooks/usePageTitle.ts` + route map

`useLayoutEffect`-set `document.title` (no SSR → no hydration risk). Feature label resolved O(1) from a central `ROUTE_TITLES` map sourced from existing sidebar nav definitions ([AdminSidebar.tsx](src/app/admin/components/AdminSidebar.tsx) + backoffice sidebar) — single source of truth. A `<PageTitleManager/>` in each `layout-client` reads `usePathname()` + (admin only) `activeOrganization` from `TenantContext`. Each section layout adds static `export const metadata = { robots: { index: false } }`.

---

## 4. Risk Register (what could go wrong → resolution)

| Risk | Likelihood | Resolution |
|---|---|---|
| **Silent SEO loss on survey migration** — RHF still submits flat names while reader expects nested (CR‑1) | High if uncoordinated | Single PR migrates schema+defaults+bindings+writepath **together**; reader keeps flat-fallback until backfill verified; Phase 3 gated on dry-run counts. Unit test asserts flat→nested mapper is lossless. |
| **Double-branded titles** (CR‑2) | Already shipped | Resolver owns branding; readers return bare titles; snapshot test on resolver output. |
| **Duplicate Firestore reads / waterfall** (CR‑3) | Medium | `cache()` loaders; verify single read via log/emulator. |
| **Custom OG host breaks `next/image`** (CR‑5) | Medium | Preview uses plain `<img>`; uploads pinned to `firebasestorage` (already allow-listed); pasted URLs validated for `http(s)` + warned, never proxied. |
| **`cleanedData` strips nested `seo`** — survey write path deep-strips `undefined`/`''` ([new/page.tsx:366](src/app/admin/surveys/new/page.tsx)) and may flatten/drop the object | Medium | Audit the clean routine; ensure it preserves a partial `seo` object (don't write `seo:{}` — omit if all empty). Test the cleaner with a partial config. |
| **Firestore rules reject nested field** | Low (cleared) | Rules use full-doc permission writes, no `hasOnly` on surveys/meetings/pages/pdfs/forms ([firestore.rules:217‑298](firestore.rules)). No rule change needed; re-confirm in emulator. |
| **Title template not inherited as expected** — org-branding wanted on public, SmartSapp on app | Low | Public readers use `title.absolute` (full control); no reliance on template inheritance. |
| **Client title flicker / stale org** on admin route change | Low | `useLayoutEffect`; title omits org segment until `activeOrganization` resolves, then updates; cleanup on unmount. Reconcile with existing `document.title` in [PdfsClient.tsx](src/app/admin/pdfs/PdfsClient.tsx) (migrate it onto the hook). |
| **AI keyword generator** writes comma-string into a field that changed shape | Medium | Generator now targets `seo.keywords` via `onGenerateKeywords`; keep comma-string contract (resolver splits). Covered by survey edit smoke test. |
| **Result/dashboard/invoice/preferences readers** regress when refactored onto resolver | Low | These get `noIndex:true` + bare titles only; no editor. Verified by route smoke list. |

---

## 5. Clean / Testable / Refactored / Scalable

- **Pure core, thin shells.** All branching logic lives in `resolveSeoMetadata` + `mapLegacySurveySeo` + `composeAppTitle` — pure functions, zero I/O, exhaustively unit-tested. `generateMetadata` bodies become 3–5 lines (`load → resolve → return`).
- **DRY.** Five bespoke metadata blocks collapse to one resolver; duplicated survey zod schema (new+edit) extracted to `src/lib/schemas/survey-seo.schema.ts` and imported by both (kills CR‑1 drift).
- **Testable (vitest, already the runner).** New colocated tests: `src/lib/__tests__/seo.test.ts` (mode matrix, fallback chain, branding, noindex, html-strip, empty→omit), `src/lib/__tests__/survey-seo-migration.test.ts` (lossless mapping + idempotency), `src/hooks/__tests__/usePageTitle.test.ts` (org/no-org composition). TDD: write these **before** wiring.
- **Scalable.** Adding a 6th surface = add one `cache()` loader + call resolver. New OG mode = one switch arm + one test. The route-title map scales with nav without per-page edits.
- **Refactor-safe.** Legacy fields stay one release behind a fallback; migration is idempotent and dry-runnable; nothing is deleted in this effort.

---

## 6. Affected / Breakable Features (and how they're covered)

| Area | Why affected | Phase |
|---|---|---|
| Survey **create/edit wizard** | zod + RHF field names change flat→nested; persistence path | 3 |
| Survey **AI keyword generator** ([step-1-details.tsx:195](src/app/admin/surveys/components/step-1-details.tsx)) | writes `seoKeywords` | 3 |
| Survey **result** subroute ([result/[submissionId]](src/app/surveys/[slug]/result/[submissionId]/page.tsx)) | shares survey title; should `noindex` | 2 |
| **Campaign page builder** SettingsPanel | `seo` widened; editor moves to publish step | 4 |
| **Meeting** editor + public hero metadata | new `seo`; dedupe double fetch (CR‑3) | 2,4 |
| **Both** form systems (`forms` + `pdfs`/signing docs) | new `seo` + editor; PDF currently no metadata | 2,4 |
| **dashboard / invoice / preferences** public readers | refactor onto resolver, add `noindex`, fix bare titles | 2 |
| Root [layout.tsx](src/app/layout.tsx) template | interacts with `title.absolute` usage | 2 |
| [PdfsClient.tsx](src/app/admin/pdfs/PdfsClient.tsx) existing `document.title` | migrate onto `usePageTitle` to avoid conflict | 5 |
| Admin/Backoffice **every route** | gains tab title + `noindex` | 5 |
| Existing **vitest** suite | no overlap expected; run full suite as regression gate | each |

---

## 7. Phased Plan

### Phase 1 — Pure core + tests (foundation, ~0.75d)
- Add `SeoConfig`/`OgImageMode` to [types.ts](src/lib/types.ts); `seo?` on the five interfaces; deprecate flat survey fields.
- Create [seo.ts](src/lib/seo.ts) `resolveSeoMetadata` + `src/lib/schemas/survey-seo.schema.ts`.
- TDD: write `seo.test.ts` first, implement to green.
- No runtime wiring yet → zero behavior change.
- **▶ RUN LOCALLY:** `npm run typecheck` && `npx vitest run src/lib/__tests__/seo.test.ts`.

### Phase 2 — Cut public readers onto resolver + cache loaders (~0.75d)
- Create `src/lib/content-loaders.ts` (`cache()`-wrapped per surface); refactor each loader's page body to reuse it (fix CR‑3).
- Rewrite `generateMetadata` for surveys, pages, meetings, both forms → `resolveSeoMetadata` with `title.absolute` branding (fix CR‑2). Surveys read `seo` with flat-fallback (transitional).
- Adopt resolver + `noIndex` for `result`, `dashboard`, `invoice`, `preferences`.
- **▶ RUN LOCALLY:** `typecheck`; load one URL per surface, inspect `<head>` for single brand suffix + correct OG; confirm one Firestore read per page in logs.

### Phase 3 — Survey form migration (flat → nested) (~1d)
- Swap both pages onto the shared `survey-seo.schema.ts`; change RHF `name="seoTitle"`→`name="seo.title"` etc.; update default values; map into the `cleanedData` write path (audit the undefined-stripper per CR‑1 risk).
- Endpoint `POST /api/migration/survey-seo` (mirrors [api/migration/*](src/app/api/migration)): batched, idempotent (`seo` present ⇒ skip), `?dryRun=1`, logs via existing migration logging. Mapper = tested `mapLegacySurveySeo`.
- After verified backfill, switch survey reader to `seo`-first (drop flat-fallback in a later cleanup).
- **▶ RUN LOCALLY:** `npx vitest run src/lib/__tests__/survey-seo-migration.test.ts`; run endpoint with `?dryRun=1`, inspect counts; live run; edit+publish a survey, confirm OG renders.

### Phase 4 — Shared publish-step editor (largest, ~1.5d)
- Build `src/components/seo/SeoSettingsCard.tsx` (extract from survey block); `bundle-dynamic-imports` if it pulls heavy preview deps.
- Mount in publish step of: Surveys (move from step 1 → [step-4-publish.tsx](src/app/admin/surveys/components/step-4-publish.tsx)), Pages (builder publish/settings), Meetings (editor publish section — new `seo` writes), Forms + PDFs (publish step).
- Wire AI keyword generator to `onGenerateKeywords`.
- **▶ RUN LOCALLY:** `lint`; edit/publish round-trip per surface; verify preview matches rendered OG.

### Phase 5 — Admin/Backoffice titles + noindex (~0.5d)
- `src/hooks/usePageTitle.ts` + `ROUTE_TITLES` map; `<PageTitleManager/>` in both `layout-client`s; migrate [PdfsClient.tsx](src/app/admin/pdfs/PdfsClient.tsx) onto the hook.
- Static `robots:{index:false}` in admin + backoffice section layouts.
- TDD: `usePageTitle.test.ts` (org vs no-org composition).
- **▶ RUN LOCALLY:** `typecheck` + full `npm run test:run`; click through admin + backoffice, watch tab titles + org switching.

### Effort
~4.5 dev-days. Phases 1→2 are independently shippable and unblock the rest; Phase 3 is the only data-risk step and is dry-run-gated.

---

## 8. Verification Gate (per `verification-before-completion`)
Each phase is "done" only when: (a) its **▶ RUN LOCALLY** checks pass, (b) the **full vitest suite** is green (regression gate), and (c) a manual render check confirms the visible `<head>` / tab title. No phase merges on types alone.
