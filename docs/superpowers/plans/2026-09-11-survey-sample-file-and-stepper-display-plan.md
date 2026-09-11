# Survey Sample-File Downloads & Stepper Display Integrity — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Work phase-by-phase, top to bottom. Do not start a phase until the previous phase's verification step is green.
>
> **Verification policy for this plan (overrides the repo default):** the user explicitly asked the agent to run `pnpm typecheck`, `pnpm lint`, `pnpm test:run` and `git commit` and debug failures. Per `.agents/AGENTS.md` → *Git & Deployment Protocol*, **never run `pnpm build`** for verification, and **never `git push`** unless explicitly instructed in that turn.

**Goal:** Stop raw HTML leaking into the survey stepper and fix the label overflow it causes; and let a survey author attach a downloadable **sample file** to any file-upload question, with author-controlled copy, so a respondent can download it, fill it in, and re-upload through the same question.

**Architecture:** One new presentational component (`SurveySampleFileCard`) is rendered by all three existing file-upload surfaces (public form, builder canvas, response viewer), so the visual language lives in exactly one file. Authoring reuses the existing `MediaSelect` control (library pick **or** direct upload) already used by the `document` layout block — no new uploader, no new storage path, no new dependency. Sample metadata lives on the `SurveyQuestion` element itself, so it rides the existing `elements` array through autosave, version snapshots, cloning and export with zero persistence work. Every string rendered from author copy passes through one display-safety helper so a Word/Docs paste can never print markup again.

**Tech Stack:** Next.js 16.3.3 (App Router, RSC + `'use client'`), React 19.2.1, TypeScript strict (**no `any` / `any[]` / bare `unknown` in new code**), Firebase JS SDK 11 (client Storage) + firebase-admin 12 (server), `react-hook-form` 7, `framer-motion` 12, Tailwind 3.4 + `tailwindcss-animate`, Vitest 2.

**No new runtime dependencies are required.** Every control, helper and animation primitive already exists in the repo (verified below).

---

## 1. Evidence Base (verified before planning)

| # | Finding | Evidence |
|---|---|---|
| E1 | Section titles are rich-text HTML; the page heading renders them via `dangerouslySetInnerHTML`, the stepper renders the **same string as text** → React escapes it → raw tags print. | `survey-form.tsx:2923` vs `survey-form.tsx:1710`, `:1619` |
| E2 | `line-clamp-2` on the stepper label is **dead CSS**. Tailwind emits `lineClamp` at core-plugin index **20** and `display` at index **21**, so the sibling `block` / `hidden sm:block` classes in the same `cn()` override `display:-webkit-box`. With a fixed `h-8` and no `overflow-hidden`, long labels overflow and break alignment. | `node -e` on `tailwindcss/lib/corePlugins.js` → `lineClamp 20, display 21`; `survey-form.tsx:1755` |
| E3 | Same HTML leak exists in the funnel analytics label. | `survey-analytics-utils.ts:124` |
| E4 | A full template-download feature already exists as the **`document` layout block** — `url`, `title`, `description`, `buttonText`, `fileName`, `fileSize`, `fileType`. | `types.ts:4203-4218`, settings `block-settings-sidebar.tsx:1101`, render `survey-form.tsx:1455` |
| E5 | `MediaSelect` already offers **library pick + "Upload New"**, writing to `media/{type}/{ts}-{name}`. | `media-select.tsx:107`, `media-uploader.tsx:312` |
| E6 | Storage `media/**` is `allow read: if true` → an anonymous respondent can download a sample from there. `survey-uploads/**` is `allow read: if isSignedIn()` → it **cannot** host the sample. | `storage.rules:34`, `storage.rules:49` |
| E7 | Respondent upload → storage → answer value → media-library sync already works end-to-end. | `survey-form.tsx:409`, `survey-actions.ts:83` (`syncSurveyUploadedFilesToMedia`) |
| E8 | `autoSaveSurveyAction` persists the payload with **no field whitelist**; `hydrateSurveyDocument` passes `elements` through wholesale (`elements: rawElements`); `synthesizeVersionSnapshot` snapshots `survey.elements` directly. New element fields therefore persist, hydrate and version with no extra work. | `survey-actions.ts:1070`, `survey-hydration-adapter.ts:95`, `:193` |
| E9 | `isSafeRedirectUrl(url, allowedHosts)` already exists, dependency-free and unit-testable — reusable as the sample-URL host guard. | `survey-redirect-safety.ts` |
| E10 | `interpolateWithMapForHtml` already HTML-escapes substituted respondent values (audit F5). Reflected XSS through variables is already closed. | `survey-variable-utils.ts:82`, `survey-form.tsx:761` |
| E11 | **`firebase.json` has no `storage` target.** `storage.rules` is therefore not deployable and the repo file may not match production. | `firebase.json` keys = `firestore`, `apphosting`, `emulators` |
| E12 | `survey-uploads/**` Storage rule allows **unauthenticated writes** with only size + MIME limits, and its MIME allowlist **excludes spreadsheets** (`...spreadsheetml.sheet`), while the UI advertises "Any format" and offers up to 100 MB against a 20 MB rule cap. | `storage.rules:49-53` vs `survey-form.tsx:343` |
| E13 | Cloud Storage rules have **no cross-service Firestore access** (`get()`/`exists()` are Firestore-rules features). A Storage rule cannot verify "this surveyId is published". | Firebase docs via Context7 (`/websites/firebase_google`) |
| E14 | `src/app/surveys/components/survey-preview-renderer.tsx` is **orphaned** — nothing imports it. | repo-wide import grep |
| E15 | The two existing survey "tests" for this area assert on inline re-implementations, not on the shipped functions — they cannot catch regressions here. | `survey-pipeline-automations.test.ts`, `survey-automation-pipeline-lifecycle.test.ts` |
| E16 | `computeSurveyChecksum` is `JSON.stringify` over the whole elements array, so adding fields changes checksums. | `survey-hydration-adapter.ts:21` |
| E17 | Firebase CLI 15.22.3 installed, logged in as `info@smartsapp.com`, default project `studio-9220106300-f74cb`. | `firebase login:list`, `.firebaserc` |

---

## 2. Locked Decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | Sample metadata lives **on the `SurveyQuestion`**, not as a sibling `document` block. | The author asked for it inside the file-upload question; it also keeps template and dropzone visually paired and avoids an orphaned block when the question moves or is deleted. |
| D2 | Sample files are stored under the existing **`media/`** path via `MediaSelect`. No new storage path. | `media/` is already public-read (E6) and already has an uploader, a library, quotas and an audit trail. `survey-uploads/` cannot serve anonymous reads. |
| D3 | Author copy fields are **plain-text inputs rendered as plain text**, passed through `toDisplayText()` (strip-then-escape). | Rule 4 ("never show HTML tags in the UI") and the exact root cause of E1 — a Word paste. Variables still work via `interpolateText`. |
| D4 | New field names are namespaced `sampleFile*` on `SurveyQuestion`. | `SurveyQuestion.description` is already the question's own description; reusing `description` would collide. |
| D5 | The card is rendered by **one shared component**, `SurveySampleFileCard`, consumed by 3 surfaces. | DRY (rule 7). Prevents the three-way drift that already exists between the file-upload hint strings. |
| D6 | `sampleFileUrl` is validated against a **host allowlist** at save time (server) and again at render time (client). | The survey doc is publicly readable when published (`firestore.rules:1056`); any URL placed on it is world-visible. Defense in depth against malware distribution via a compromised author account. |
| D7 | The `document` layout block is **not** refactored onto the shared card in the core phases. | Behaviour-preserving refactor of a shipped surface is separate risk; offered as optional Phase 11. |
| D8 | The stepper fix uses **strip-to-text**, not rich-text rendering. | It is a 10px uppercase label inside a `<button>` that also feeds `aria-label`. Markup there is meaningless and breaks the accessible name. |

---

## 3. Skill Conformance (apply throughout)

**`vercel-react-best-practices`**
- `js-hoist-regexp` + `js-cache-function-results` — `toDisplayText()` hoists its regex set to module scope and memoises by input string in a bounded `Map` (cap 200 entries, FIFO evict). Today `stripHtml` allocates ~14 regexes per call; the stepper calls it once per section on **every** answer keystroke.
- `rerender-memo` / `rerender-no-inline-components` — `SurveySampleFileCard` is a top-level `React.memo` component, never declared inside a render body.
- `rerender-derived-state-no-effect` — stepper labels and sample-card view-model are derived with `useMemo` during render; no `useEffect`+`setState`.
- `bundle-conditional` — no new import is added to the public bundle unless a sample is configured; `MediaSelect` is already in the settings-sidebar chunk (it serves `document`/`image`/`video`/`audio`), so authoring adds **zero** new bytes.
- `js-early-exit` — the card returns `null` immediately when disabled or URL-less, before any formatting work.

**`next-best-practices`**
- `directives` — all touched components are already `'use client'`; no new `'use server'` surface except the two typed backoffice actions in Phase 10, which authenticate first.
- `server-after-nonblocking` — Phase 10's FER job reuses the existing `scheduleJobExecution` / `after()` path (`job-execution.ts`), never a blocking loop in a request.
- `data-security` — server actions authenticate from the session cookie, never from a caller-supplied `userId` (audit F2 precedent).

**`emilkowal-animations`**
- `ease-out-default` + `timing-300ms-max` — card entrance is `opacity` + `translateY(4px)` at **180 ms**, ease-out.
- `props-transform-opacity` — only `transform`/`opacity` animate. Never `height`/`width`.
- `tw-press-scale` / `transform-scale-097` — download button gets `active:scale-[0.97]`.
- `polish-reduced-motion` — all motion gated behind `useReducedMotion()`; falls back to opacity-only.
- `strategy-frequency-matters` — **no** animation on stepper label changes (high frequency, keyboard-initiated).

**`ui-ux-pro-max` / `frontend-design`**
- `touch-target-size` — download button `min-h-[44px]`; full-width below `sm`.
- `focus-states` / `aria-labels` — visible focus ring; the anchor's accessible name includes the file name, not just "Download".
- No new visual language: the card reuses the shipped `document`-block card (extension-tinted icon tile, `rounded-2xl`, `bg-card/70 backdrop-blur-md`).
- Copy is short, everyday English: *"Sample file"*, *"Download sample"*, *"Fill this in and upload it below."*

**`cc-skill-backend-patterns`**
- Service-layer separation: pure, framework-free helpers (`toDisplayText`, `resolveSampleFile`) live in `src/lib/*`, are unit-testable with no Firebase/Next import, and are consumed by the React layer.

**`test-driven-development`** — every phase writes the failing test first, watches it fail, then implements.

---

## 4. File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/utils/display-text.ts` | **New.** `toDisplayText()` — memoised strip-tags-then-normalise for any author string bound for a text sink. | Create |
| `src/lib/survey-file-utils.ts` | File-type presets & validation (pure) | Add `SAMPLE_FILE_ALLOWED_HOSTS`, `isSafeSampleFileUrl()`, `resolveSampleFile()` (returns a typed view-model or `null`) |
| `src/lib/types.ts` | Domain types | Add 6 optional `sampleFile*` fields to `SurveyQuestion`; add `SurveySampleFile` view-model interface |
| `src/components/surveys/SurveySampleFileCard.tsx` | **New.** The one sample card UI, memoised, motion-gated, mobile-first | Create |
| `src/app/surveys/[slug]/components/survey-form.tsx` | Public form | Stepper: `toDisplayText` + clamp fix (2 variants); `FileUpload`: render the card above the dropzone |
| `src/app/admin/surveys/components/block-settings-sidebar.tsx` | Design-mode inspector | Add "Sample file" group to the `file-upload` panel; map sample fields on type-switch; remove 1 `as any` |
| `src/app/admin/surveys/components/question-editor.tsx` | Builder canvas card | Render the card in the `file-upload` preview |
| `src/app/admin/surveys/components/survey-preview-renderer.tsx` | Response viewer | Render the card in the `file-upload` branch |
| `src/lib/survey-analytics-utils.ts` | Funnel labels | `toDisplayText` on step labels |
| `src/lib/survey-actions.ts` | Survey persistence | Validate `sampleFileUrl` host on save; collision-safe respondent upload path |
| `storage.rules` | Storage security | Widen `survey-uploads` MIME set; align size cap; scope the anonymous-write surface |
| `firebase.json` | Deploy config | **Add the missing `storage` target** (E11) |
| `src/lib/backoffice/backoffice-types.ts` | Control-plane types | `SurveySampleTemplate`; `'audit_survey_sample_files'` job type |
| `src/lib/backoffice/survey-sample-templates-actions.ts` | **New.** Backoffice CRUD for the global sample library | Create |
| `src/lib/backoffice/survey-sample-fer-logic.ts` | **New.** FER audit: find broken/unreachable sample links | Create |
| `src/lib/backoffice/job-execution.ts` | Job router | Register the new job type |

---

## 5. Plan Code Review — What Could Go Wrong

Each risk carries the phase that resolves it.

| # | Risk | Impact | Resolution | Phase |
|---|---|---|---|---|
| R1 | `stripHtml` allocates ~14 regexes per call; stepper calls it per section per render. A 20-section survey re-renders on every keystroke. | Jank on low-end Android. | `toDisplayText()` hoists regexes to module scope + bounded memo `Map`; stepper labels wrapped in `useMemo`. | 1 |
| R2 | Moving `hidden sm:block` to a wrapper could silently change which labels show at which breakpoint. | Visual regression. | Test asserts the exact class contract on wrapper vs `<p>` at both breakpoints before the change. | 2 |
| R3 | Putting the card **inside** the dropzone would make "Download" also open the file picker. | Broken primary action. | Card is a sibling **above** the dropzone; explicit test asserts the download anchor is not a descendant of the dropzone. | 6 |
| R4 | `download` attribute is **ignored cross-origin**; Firebase Storage is cross-origin, so mobile Safari opens the file in a tab instead of saving. | "Download" doesn't download. | Accept in-tab open as the documented behaviour (`target="_blank" rel="noopener noreferrer"`), and set the label to *"Download sample"* with `aria-label` naming the file. Same-origin proxy route listed as optional Phase 11 if the user wants a true save. **This already affects the shipped `document` block.** | 6 |
| R5 | `sampleFileUrl` sits on a publicly readable doc — a compromised author could point respondents at malware. | Security. | `isSafeSampleFileUrl()` host allowlist, enforced **server-side on save** and **again at render**. Reuses `isSafeRedirectUrl`. | 3, 6 |
| R6 | Author pastes formatted text from Word into the copy fields → tags print (the exact bug being fixed). | Repeat of E1. | All author copy goes through `toDisplayText()`; covered by test. | 3, 6 |
| R7 | Switching question type (`file-upload` ⇄ `document`) silently orphans or drops sample data. | Data loss. | Explicit bidirectional field mapping in `handleTypeChange`, with a test per direction. | 8 |
| R8 | Adding fields changes `computeSurveyChecksum` (E16) → every survey looks "changed" and spawns a spurious version on first save. | Version-history noise. | Documented as expected; no code change. Checksum is already key-order sensitive. Called out in the release note so support isn't surprised. | 12 |
| R9 | `extractFileNameFromStorageUrl` on a non-Storage URL. | Crash or `"Document"` label. | `resolveSampleFile()` falls back to the stored `sampleFileName`, then to a generic label; never throws. Test covers a malformed URL. | 3 |
| R10 | Respondent upload path `{Date.now()}-{name}` collides for two same-millisecond uploads of the same filename. | Silent overwrite of another respondent's file. | Add a short random suffix to the path. | 9 |
| R11 | `survey-uploads/**` accepts **unauthenticated writes** (E12) — free file hosting / storage exhaustion. | Abuse, cost. | Storage rules cannot read Firestore (E13), so: tighten path shape, keep the size cap, widen MIME only to the formats the product needs, and document the residual risk. Server-mediated signed upload offered as optional Phase 11. | 9 |
| R12 | `.xlsx` uploads fail today — the exact staff-data use case in the screenshot. | Feature is broken at the rule layer. | Add spreadsheet + archive MIME types; reconcile the 20 MB rule cap with the 25 MB UI promise. | 9 |
| R13 | `storage.rules` is not deployable (E11) — any rule fix would be a no-op. | Fix never ships. | Add the `storage` target to `firebase.json` **before** touching rules. | 9 |
| R14 | Orphan uploads accumulate (respondent uploads, abandons survey). | Unbounded storage growth. | FER audit job reports orphans; deletion stays a human-approved action. | 10 |
| R15 | A backoffice FER job that loads all surveys at once exhausts memory. | Control-plane outage. | Cursor paging at 100 docs/page via `orderBy(__name__).startAfter()`, bounded concurrency, progress written per page. No composite index needed. | 10 |
| R16 | New tests follow the repo's existing anti-pattern of re-implementing logic inline (E15). | Green tests, broken product. | Every new test **imports the shipped symbol**. No inline re-implementation. Enforced in review checklist. | all |

---

## 6. Edge Cases & Handling

| Case | Handling |
|---|---|
| Sample enabled, no file chosen | Card renders `null`. Inspector shows a quiet hint, not an error. |
| File chosen, then media asset deleted | Link 404s on click. FER job flags it (Phase 10). No client crash. |
| Empty / whitespace-only author copy | Falls back: title → file name; button → `"Download sample"`. |
| Author copy is entirely HTML (`<span></span>`) | `toDisplayText()` → `''` → falls back as above. Never prints tags. |
| Very long file name | `truncate` + full name in `title` and `aria-label`. |
| Very long section title in stepper | Clamped to 2 lines, wrapper `overflow-hidden`. |
| Section hidden by logic | Existing `isSectionVisible` gate is preserved exactly; label falls back to `Step N`. |
| Question is required + respondent only downloads, never uploads | Unchanged — validation still fails. The sample is not an answer. |
| `allowMultipleFiles` off, sample on | Card shows once; dropzone still disappears after 1 upload (`canAddMore`). |
| Sample configured on a non-`file-upload` type | Fields ignored by every renderer; type-switch mapping handles migration (Phase 8). |
| Survey previewed in builder | Builder preview imports the real `SurveyForm`, so it gets the real card automatically. |
| `prefers-reduced-motion` | Opacity-only, no translate. |
| Offline / slow 3G | Card is static markup; no fetch. Download is a plain anchor. |
| Two respondents upload the same filename in the same ms | Random suffix prevents overwrite (R10). |
| Survey doc read anonymously | Only `sampleFile*` strings are exposed — all author-authored, all host-validated. No PII added. |

---

## 7. Blast Radius — Other Features Touched

| Feature | Effect | Action |
|---|---|---|
| Survey versioning (`versions`) | New fields ride in snapshots automatically (E8). Checksums shift once (R8). | Release note only |
| Survey clone (`cloneSurvey`) | Copies `elements` wholesale → sample copies too. | Regression test |
| AI survey generation | Zod schemas don't declare `sampleFile*`; AI simply won't emit them. Non-breaking. | Optional: teach the generator later |
| Question Bank | Stores/reloads question objects → sample fields carried. | Regression test |
| CRM field mapping / `syncSurveyUploadedFilesToMedia` | Operate on **answers**, not on the sample. Unaffected. | Assert unchanged |
| `registerSurveyVariables` | Iterates elements for variable registration; unknown fields ignored. | Assert unchanged |
| Results export | Exports answers; sample is config, not an answer. Unaffected. | Assert unchanged |
| Funnel analytics | Labels get `toDisplayText` (E3) — a visible **improvement**, same data. | Test |
| `document` layout block | Untouched in core phases (D7). Shares the same cross-origin download caveat (R4). | Optional Phase 11 |
| Orphaned `src/app/surveys/components/survey-preview-renderer.tsx` (E14) | Left alone. | Flag for separate deletion |

---

## 8. Firebase — Rules, Indexes, Functions, Deploy

### 8.1 Firestore rules
**No change required.** Verified:
- `surveys/{id}` already allows anonymous `get` when `status == 'published'` (`firestore.rules:1056`) — the public page loads sample metadata with no login. ✅
- `surveys/{id}/responses/{rId}` already allows anonymous `create`. ✅
- The sample file is served from **Cloud Storage**, not Firestore — the respondent needs no `media` document read. ✅

New backoffice collection `system_settings/survey_sample_templates` falls under the existing catch-all `match /system_settings/{settingId} { allow read, write: if false; }` — client SDK denied, Admin SDK only, which is exactly right for a control-plane doc.

### 8.2 Firestore indexes
**No new composite index required.** Justification: the feature adds no query — sample data is read as part of the survey document that is already fetched by ID. The Phase 10 FER job pages with `orderBy(__name__).startAfter(cursor)`, which needs no composite index. (The repo already carries 621 indexes; adding an unused one is pure cost.)

### 8.3 Cloud Functions
**None required.** All server work runs in Next.js Server Actions on the Node runtime with `firebase-admin`, matching every existing survey/backoffice path in this repo.

### 8.4 Storage rules — changes required

```
// firebase.json — ADD (E11: storage.rules is currently undeployable)
"storage": { "rules": "storage.rules" }
```

`storage.rules` → `survey-uploads/**`:
- Widen the MIME allowlist to the formats the product actually offers: spreadsheets (`...spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv`), archives (`application/zip`, `application/x-7z-compressed`, `application/vnd.rar`) alongside the existing image / PDF / text / Word set.
- Raise the size cap from 20 MB to **25 MB** so the rule matches the UI's advertised maximum, and cap the settings dropdown at 25 MB so the two can never diverge again.
- Keep reads signed-in only (respondent answers are tenant data).
- Anonymous write stays (public surveys need it) — Storage rules cannot verify the surveyId against Firestore (E13). Residual risk documented; server-mediated signed upload offered as optional Phase 11.

`media/**` — **no change**: already `read: if true` (respondents) + `write: if isSignedIn()` (authors), 50 MB cap. Exactly the posture a public sample download needs.

### 8.5 Deploy (final phase, after approval)
```bash
firebase deploy --only firestore:rules,storage --project studio-9220106300-f74cb
```
CLI 15.22.3 is installed and authenticated as `info@smartsapp.com` (E17).

---

## 9. FER / Migration / Seeding Protocols

| Protocol | Needed? | Detail |
|---|---|---|
| **Data migration** | **No.** | All 6 fields are optional and additive. Existing surveys render byte-identically (the card early-returns `null`). This follows the repo's established "fallback, no migration" posture. |
| **Backfill** | **No.** | Nothing to backfill — absence of a sample is a valid, intended state. |
| **Seeding** | **Yes (idempotent, lazy).** | `system_settings/survey_sample_templates` self-seeds a small starter library on first read if the doc is absent — the exact pattern already used by `getSystemCrmFieldMappingTemplatesAction` (`survey-crm-sync-actions.ts:617`). Starter entries: *Staff Roster*, *Student & Parent List*, *Fee Schedule*. |
| **FER (Fetch-Enrich-Restore)** | **Yes (audit-only by default).** | `survey-sample-fer-logic.ts`, modelled on `forms-fer-logic.ts`. **Fetch:** page every survey (100/page, cursor). **Enrich:** for each `file-upload` element with `sampleFileEnabled`, check URL present, host allowlisted, `sampleFileName` populated, and (HEAD request, bounded concurrency 5) reachable. **Restore:** only with `autoRepair`, and only safe repairs — backfill a missing `sampleFileName` from the URL; clear `sampleFileEnabled` when the URL is absent. Never deletes files. Dry-run is the default. |
| **Rollback** | **Yes.** | Revert the commit. No schema change, no data written to existing docs by the core phases, so rollback is a pure code revert. |

---

## 10. Backoffice — Managing This Without Touching Code

Answering *"how does it affect the backoffice, and how can the backoffice manage this feature without touching code?"*

Today nothing about survey sample files is manageable centrally: each author re-uploads their own spreadsheet, and a bad or dead link can only be found by opening every survey. Three additions fix that, all reusing existing control-plane machinery (`authorizeBackoffice` + `logBackofficeAction` + `platform_jobs`).

1. **Global Sample Template Library** — `system_settings/survey_sample_templates`, CRUD'd from the backoffice. Authors get a "Pick from library" option in the inspector alongside their own upload. Ops can publish a corrected template once and every new survey picks it up — no deploy.
2. **Sample-file health audit job** — `audit_survey_sample_files` registered in `job-execution.ts`, runnable from the existing Platform Jobs screen with dry-run and scope (platform / organization / workspace). Surfaces dead links, non-allowlisted hosts and orphaned uploads. Rule 9 compliant: cursor-paged, bounded concurrency, progress persisted per page.
3. **Host allowlist as configuration** — `SAMPLE_FILE_ALLOWED_HOSTS` seeds from code but is overridable in `system_settings`, so onboarding a new CDN is a backoffice edit, not a release.

Every action is `authorizeBackoffice(idToken, 'survey_governance', …)` gated and written to the audit log, matching `backoffice-survey-actions.ts`.

---

## 11. Phases

Legend: **[CORE]** must ship · **[HARDEN]** strongly recommended · **[OPT]** needs a scope decision.

### Phase 0 — Baseline **[CORE]**
- [ ] Record current green state: `pnpm typecheck`, `pnpm lint`, `pnpm test:run`. Note any **pre-existing** failures so they are never attributed to this work.
- [ ] Confirm working tree is clean and the branch is correct.

### Phase 1 — `toDisplayText()` helper **[CORE]**
**Files:** Create `src/lib/utils/display-text.ts`; Test `src/lib/__tests__/display-text.test.ts`
- [ ] Write failing tests: strips tags from a Word-paste `<span style="color:rgb(15,23,42)">Upload Staff Data</span>` → `Upload Staff Data`; decodes entities; collapses whitespace; returns `''` for tag-only input; returns `''` for `null`/`undefined`; is idempotent; memo cache is bounded (201st distinct input does not grow the map past the cap).
- [ ] Run tests — watch them fail.
- [ ] Implement: module-scope hoisted regexes (`js-hoist-regexp`), bounded FIFO memo `Map` (`js-cache-function-results`), delegating to the existing `stripHtml` semantics so behaviour matches the rest of the app.
- [ ] Header comment: what it is for, why the stepper needs it, and the caution that this is a **text sink only** helper — never a substitute for `DOMPurify` on an HTML sink.
- [ ] Tests pass → `git commit`.

### Phase 2 — Stepper display fix **[CORE]**
**Files:** Modify `survey-form.tsx` (`full` ~1700-1765, `linear` ~1619/1660), `survey-analytics-utils.ts:124`; Test `src/lib/__tests__/survey-stepper-label.test.ts`
- [ ] Extract the label resolution (`stepperTitle → title → "Step N"`, honouring `isSectionVisible`) into an exported pure function so it is testable without rendering.
- [ ] Write failing tests: HTML title → clean text; `stepperTitle` still wins; hidden section → `Step N`; empty-after-strip → `Step N`; analytics funnel label identical treatment.
- [ ] Run tests — watch them fail.
- [ ] Implement label resolution + apply to `full`, `linear` and `aria-label`. Memoise per render with `useMemo`.
- [ ] Fix the clamp (E2): move `hidden sm:block` to a wrapper `<div>` carrying `overflow-hidden`; leave `line-clamp-2` alone on the `<p>`. Add an inline comment citing the Tailwind plugin-order finding so nobody re-merges the classes.
- [ ] Manually verify both breakpoints and both stepper variants in the builder preview.
- [ ] Tests pass → `git commit`.

### Phase 3 — Types + sample resolution helper **[CORE]**
**Files:** Modify `src/lib/types.ts`, `src/lib/survey-file-utils.ts`; Test `src/lib/__tests__/survey-sample-file.test.ts`
- [ ] Add to `SurveyQuestion`: `sampleFileEnabled?: boolean`, `sampleFileUrl?: string`, `sampleFileName?: string`, `sampleFileTitle?: string`, `sampleFileDescription?: string`, `sampleFileButtonText?: string`. Add exported `SurveySampleFile` view-model interface. **No `any`.**
- [ ] Write failing tests for `isSafeSampleFileUrl()`: accepts `firebasestorage.googleapis.com` and `*.firebasestorage.app`; rejects `javascript:`, `data:`, `//evil.test`, `http://evil.test`, empty.
- [ ] Write failing tests for `resolveSampleFile(question)`: returns `null` when disabled / no URL / unsafe host; derives name from URL when `sampleFileName` absent; falls back to a generic name for a malformed URL (never throws); strips HTML from title/description; defaults the button label to `"Download sample"`; falls back title → file name.
- [ ] Run tests — watch them fail.
- [ ] Implement both, reusing `isSafeRedirectUrl` (E9) and `extractFileNameFromStorageUrl`.
- [ ] Comment the trust boundary: *this URL is published on a world-readable document.*
- [ ] Tests pass → `git commit`.

### Phase 4 — Shared `SurveySampleFileCard` **[CORE]**
**Files:** Create `src/components/surveys/SurveySampleFileCard.tsx`; Test `src/components/__tests__/SurveySampleFileCard.test.tsx`
- [ ] Write failing tests: renders nothing when `resolveSampleFile` yields `null`; renders title, file name and button label; anchor has `rel="noopener noreferrer"`; `aria-label` includes the file name; button meets `min-h-[44px]`; no raw tags in output for an HTML-laden title.
- [ ] Run tests — watch them fail.
- [ ] Implement: top-level `React.memo`; props are a typed `SurveySampleFile` + optional `interpolate` callback (so the public form can pass variable substitution and the previews can pass identity — no duplicated interpolation logic); extension-tinted icon tile reusing the `document`-block visual; `w-full sm:w-auto` button; `active:scale-[0.97]`; `framer-motion` entrance at 180 ms ease-out gated by `useReducedMotion()`.
- [ ] Comment: why this component exists (3 consumers), and the caution that changing its markup changes all three.
- [ ] Tests pass → `git commit`.

### Phase 5 — Design-mode authoring **[CORE]**
**Files:** Modify `block-settings-sidebar.tsx` (`file-upload` panel, ~544)
- [ ] Add a "Sample file" group **above** "Allowed File Types": `Switch` (copying the "Allow Multiple Files" row pattern exactly), then — revealed only when on — `MediaSelect filterType="document"`, `Title`, `Short note` (`Textarea`), `Button text`.
- [ ] Use that panel's own control conventions (`Label text-sm font-semibold`, `h-11 bg-card border border-border/50 rounded-xl font-bold`), **not** the older `document`-block styling.
- [ ] Derive and persist `sampleFileName` when a file is chosen.
- [ ] Copy stays minimal: *"Offer a sample"* / *"Let people download a file to fill in."*
- [ ] Remove the existing `filterType={element.type as any}` (line ~1163) via a typed narrowing — rule 4, in a file we are already touching.
- [ ] Manually verify the panel on a 375 px viewport.
- [ ] `pnpm typecheck` → `git commit`.

### Phase 6 — Public client render **[CORE]**
**Files:** Modify `survey-form.tsx` (`FileUpload`, ~573)
- [ ] Write failing test: card renders **above** and **outside** the dropzone; clicking the download anchor does not open the file picker (R3).
- [ ] Run test — watch it fail.
- [ ] Render `<SurveySampleFileCard>` as the first child of the `FileUpload` wrapper, passing `interpolateText` for variable support.
- [ ] Confirm every existing upload path is untouched (staging, progress, cancel, multi-file, errors, `notifyChange`).
- [ ] Comment the ordering constraint: *the card must remain a sibling of the dropzone — nesting it makes Download open the file picker.*
- [ ] Tests pass → `git commit`.

### Phase 7 — Design-mode previews **[CORE]**
**Files:** Modify `question-editor.tsx:1819`, `admin/.../survey-preview-renderer.tsx:127`
- [ ] Render the shared card in both `file-upload` branches so design mode matches the client.
- [ ] Leave the orphaned `src/app/surveys/components/survey-preview-renderer.tsx` untouched (E14); note it for separate deletion.
- [ ] `pnpm typecheck` → `git commit`.

### Phase 8 — Type-switch data preservation **[HARDEN]**
**Files:** Modify `block-settings-sidebar.tsx` (`handleTypeChange`, ~140)
- [ ] Write failing tests: `file-upload` → `document` carries `sampleFileUrl`/copy into `url`/`title`/`description`/`buttonText`; `document` → `file-upload` carries them back; neither direction drops data.
- [ ] Run tests — watch them fail. Implement. Tests pass → `git commit`.

### Phase 9 — Storage rules & upload hardening **[HARDEN]**
**Files:** Modify `firebase.json`, `storage.rules`, `survey-form.tsx:409`, `block-settings-sidebar.tsx` (size options)
- [ ] Add the `storage` target to `firebase.json` **first** (R13) — without it nothing here deploys.
- [ ] Widen `survey-uploads` MIME allowlist (spreadsheets + archives) — unblocks the staff-data use case (R12).
- [ ] Raise the rule cap to 25 MB and cap the settings dropdown at 25 MB so rule and UI cannot diverge (R12).
- [ ] Add a random suffix to the respondent upload path (R10).
- [ ] Run the `firebase-security-rules-auditor` skill over the edited rules; record the score and findings in this document.
- [ ] `firebase deploy --only storage --dry-run`-equivalent validation before any real deploy.
- [ ] `git commit` (deploy happens in Phase 12).

### Phase 10 — Backoffice **[OPT — needs approval]**
**Files:** Create `survey-sample-templates-actions.ts`, `survey-sample-fer-logic.ts`; modify `backoffice-types.ts`, `job-execution.ts`
- [ ] Add `SurveySampleTemplate` type and `'audit_survey_sample_files'` to `PlatformJobType`.
- [ ] Implement lazily-seeded global template library (mirrors `getSystemCrmFieldMappingTemplatesAction`), `authorizeBackoffice`-gated, audit-logged.
- [ ] Implement the FER audit: cursor paging 100/page, HEAD concurrency 5, progress per page, dry-run default, safe repairs only (R14, R15).
- [ ] Register in the job router. Tests for the pure paging/report logic.
- [ ] `git commit`.

### Phase 11 — Optional extras **[OPT — needs approval]**
- [ ] Refactor the `document` layout block onto `SurveySampleFileCard` (behaviour-preserving, test-guarded) — D7.
- [ ] Same-origin download proxy route so "Download" truly saves on mobile Safari — R4.
- [ ] Server-mediated signed upload to close the anonymous `survey-uploads` write surface — R11.
- [ ] Delete the orphaned preview renderer — E14.

### Phase 12 — Verification, deploy, release note **[CORE]**
- [ ] `pnpm typecheck` — fix every error.
- [ ] `pnpm lint` — fix every new warning; do not raise the `--max-warnings` ceiling.
- [ ] `pnpm test:run` — all green; compare against the Phase 0 baseline.
- [ ] Manual matrix: iOS Safari + Android Chrome at 375 px; desktop; light + dark; reduced-motion on; keyboard-only; screen-reader label on the download anchor.
- [ ] `firebase deploy --only firestore:rules,storage --project studio-9220106300-f74cb`.
- [ ] Append a release note to this document: the one-off checksum shift (R8) and the cross-origin download behaviour (R4).
- [ ] Final `git commit`. **Do not `git push`** without explicit instruction.

---

## 12. Commenting Standard (rule 10)

Every file created or modified gets a header block in the repo's established voice:

```
/**
 * @fileOverview <what this is>
 *
 * WHY THIS EXISTS / WHAT CHANGED:
 * - <the concrete reason, with the finding ID from this plan>
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - <the thing that will silently break if someone "tidies" this>
 *
 * @testability <which test file covers it, and what it asserts>
 * @trustBoundary <who can reach this and what is validated>
 */
```

Two caution comments are mandatory:
1. **`survey-form.tsx` stepper** — the Tailwind plugin-order finding (E2), so nobody merges `block` back onto the clamped `<p>`.
2. **`FileUpload`** — the card must stay a sibling of the dropzone (R3).

---

## 13. Open Questions for the User

1. **Scope:** approve **[OPT]** Phase 10 (backoffice) and Phase 11 (extras), or ship CORE + HARDEN only?
2. **Mobile download (R4):** accept "opens in a new tab" on iOS Safari, or build the same-origin proxy route so it truly saves?
3. **Anonymous uploads (R11):** leave `survey-uploads` publicly writable (status quo, needed by public surveys) or move to server-mediated signed uploads this cycle?
