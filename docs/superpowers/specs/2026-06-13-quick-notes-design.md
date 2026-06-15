# Design Specification: Quick Notes (Unified Notes Workspace)

**Date**: 2026-06-13
**Status**: Proposal (v2 — decisions locked, risk-reviewed)
**Author**: Engineering
**Skills applied**: `next-best-practices`, `vercel-react-best-practices`, `frontend-design`, `crm-builder`, `ai-integration`, `writing-plans`

> **Build/verify note:** This plan never runs `npm run build`, `typecheck`, or `lint` — those are flagged at each phase for **you to run locally** to conserve AI credits. Look for the **▶ RUN LOCALLY** callouts.

---

## 1. Locked Decisions (from product review)

1. **Editor = Notion-grade block editor.** Built on **TipTap v3**, which is **already a dependency** (`@tiptap/react`, `@tiptap/starter-kit`, link/color/highlight/placeholder/text-align/underline/text-style). An existing editor lives at [TipTapEditor.tsx](src/app/admin/pages/[id]/builder/components/TipTapEditor.tsx) to model on. ⇒ `content` is stored as **TipTap JSON**, not Markdown, with a derived `plainText` projection for search/AI.
2. **Aggregation at launch.** All three legacy sources (`entity_notes`, `tasks.notes[]`, `call_queue_items.notesDraft`) are surfaced from day one.
3. **Semantic "ask your notes" in scope.** A vector **embeddings store** ships (Firestore Vector Search via `findNearest`, embeddings generated with Genkit).

---

## 2. Overview & Objectives

Notes are fragmented across four shapes with no consolidated view:

| Source | Storage | Type | Notes |
|---|---|---|---|
| Entity notes | `entity_notes` (top-level) | `EntityNote` | rich: typed, pinned, threaded, deal-linked; rules at [firestore.rules:850](firestore.rules) |
| Contact notes | embedded `EntityContact.notes[]` | `ContactNote` | id/content/createdAt |
| Task notes | embedded `Task.notes[]` | `TaskNote` | content/author |
| Call notes | `call_queue_items.notesDraft` + disposition `notes` | `string` | [call-centre-service.ts](src/lib/services/call-centre-service.ts) |

**Quick Notes** adds a workspace-scoped notes hub that (a) provides first-class Notion-grade authoring, (b) **aggregates** legacy notes read-only with deep-links to origin, (c) supports bidirectional Entity/Task linking, and (d) layers AI summary/tagging/digest/semantic-search — **without changing any existing notes UI's behaviour**.

### Goals
1. Consolidation at `/admin/quick-notes`.
2. Notion-grade authoring (TipTap blocks, slash menu, media nodes, tables, task lists).
3. Bidirectional Entity/Task linking with reverse panels.
4. AI: per-note summary, auto-tagging, link enrichment (OG thumbnail), workspace digest, semantic search.
5. **Zero regression** in legacy note stores.
6. Conformance to the named skills.

### Non-Goals
- Migrating/rewriting legacy stores.
- Real-time collaborative editing (last-write-wins in v1).
- Replacing `EntityNotesTab` or call-disposition notes.

---

## 3. Clean / Testable / Scalable Architecture

A **hexagonal (ports-&-adapters)** layering keeps I/O at the edges and the logic pure, so most of the system is unit-testable without the Firebase emulator.

```
 UI (client)            NoteEditor, QuickNotesBoard, panels       — React, dynamic-imported editor
   │ calls
 Application (server)   quick-notes-actions / -ai-actions          — 'use server', auth + orchestration, Zod at boundary
   │ uses
 Domain (pure, no I/O)  normalizers, validators, query-builders,   — 100% unit-testable, no Firestore
                        UnifiedNote mapper, plainText extractor
   │ via ports
 Adapters (server-only) QuickNoteRepository, NoteIndexRepository,  — Firestore Admin SDK; emulator-tested
                        EntityNoteAdapter, TaskNoteAdapter,
                        CallNoteAdapter (NoteSourceAdapter strategy)
```

### 3.1 Patterns adopted
- **Strategy / Adapter** — every legacy source implements one interface, so adding a future source (e.g. meeting notes) is open/closed:
  ```typescript
  export interface NoteSourceAdapter {
    readonly source: UnifiedNote['source'];
    readForWorkspace(workspaceId: string, cursor?: string, limit?: number): Promise<RawSourceNote[]>;
    toUnifiedNote(raw: RawSourceNote): UnifiedNote;   // pure
    buildOriginHref(raw: RawSourceNote): string;      // pure
  }
  ```
- **Repository** — `QuickNoteRepository` / `NoteIndexRepository` isolate all Firestore reads/writes; actions depend on repositories, not raw `adminDb`.
- **Pure domain functions** — `toUnifiedNote`, `extractPlainText(tiptapJson)`, `validateQuickNoteInput(zod)`, `buildBoardQuery(...)` take data in, return data out. These carry the bulk of test coverage.
- **Zod at every boundary** — server-action inputs and Genkit flow IO are schema-validated (Genkit flows already use Zod).
- **DRY** — a single `UnifiedNote` mapper; one shared set of query builders reused by board, reverse panels, and aggregator.

### 3.2 Scalability decision — `note_index` read-model (the key scaling move)
Read-time aggregation across `entity_notes` + **a full scan of `tasks`** (notes are embedded, not queryable) + `call_queue_items` does **not** scale. The scalable design is a **denormalized projection collection `note_index`**:

- Every note (native + legacy) is projected into `note_index` as a `UnifiedNote` row: `{ workspaceId, source, sourceId, plainText, tags, links, createdAt, isPinned, originHref, embedding? }`.
- The board queries **one** collection with composite indexes + cursor pagination — O(page), not O(all tasks).
- Population is **incremental and non-blocking** via `after()` hooks at each write site, plus a **one-time backfill script**. Legacy write paths get a *single additive line* (a fire-and-forget `projectNote(...)`), which is the minimum necessary touch — no behaviour change.
- **Bootstrap fallback:** Phase 4 ships read-time aggregation first (zero legacy edits) so the feature works immediately; the `note_index` projection + backfill lands in the same phase and the board switches to it once backfilled. Read-time aggregation remains the cold-start fallback.

> Trade-off recorded: read-time aggregation = zero distortion, poor scale; `note_index` = excellent scale, one additive write per legacy source. We ship both and prefer the index.

---

## 4. Data Model

`src/lib/quick-notes-types.ts`:

```typescript
import type { JSONContent } from '@tiptap/react';

export interface QuickNoteAttachment {
  id: string;
  type: 'link' | 'image' | 'video' | 'file';
  url: string;                 // same-origin Firebase Storage URL (see §6.3 — even link thumbnails are re-hosted)
  storagePath?: string;        // set for anything we host, so we can delete on note delete
  title?: string;
  description?: string;
  thumbnailUrl?: string;       // also re-hosted to Storage to satisfy next/image
  mimeType?: string;
  sizeBytes?: number;
}

export interface QuickNoteLinks {
  entityId?: string; entityName?: string;
  taskId?: string;   taskName?: string;
  dealId?: string;   dealName?: string;
}

export interface QuickNoteAiMeta {
  summary?: string;
  suggestedTags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  actionItems?: string[];
  generatedAt?: string;
  model?: string;
}

export interface QuickNote {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  content: JSONContent;        // TipTap document JSON (Notion-grade)
  plainText: string;           // derived from content at write-time — powers search + AI + embeddings
  contentVersion: number;      // schema/version guard for editor migrations
  categoryId?: string;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  pinnedAt?: string;
  ai?: QuickNoteAiMeta;
  embeddingVersion?: number;   // bumped when plainText changes; drives re-embed (see §7)
  createdBy: string;
  createdByName?: string;
  createdAt: string;           // ISO
  updatedAt: string;           // ISO — optimistic-concurrency guard
}

export interface QuickNoteCategory {
  id: string; organizationId: string; workspaceId: string;
  name: string; color: string;  // token key, not hex
  icon?: string; order: number;
  createdBy: string; createdAt: string;
}

/** The board's render model. Native + legacy notes normalise to this. */
export interface UnifiedNote {
  id: string;                  // `${source}:${sourceId}`
  source: 'quick_note' | 'entity_note' | 'task_note' | 'call_note';
  sourceId: string;
  workspaceId: string;
  title?: string;
  plainText: string;           // legacy sources flatten their string/embedded content here
  noteType?: string;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  createdByName?: string;
  createdAt: string;
  originHref: string | null;   // deep-link to source UI; null for native
  editable: boolean;           // true only when source === 'quick_note'
}

/** Projection row stored in `note_index` (server-only writes). */
export interface NoteIndexRow extends Omit<UnifiedNote, 'attachments'> {
  attachmentCount: number;
  embedding?: number[];        // vector for semantic search
  embeddingVersion?: number;
  indexedAt: string;
}
```

Conventions honoured: ISO timestamps, write-time denormalised display names, `organizationId` + `workspaceId` on every doc.

---

## 5. Risk Register — What Could Go Wrong & How It's Resolved

| # | Risk | Likelihood/Impact | Resolution (where it lands in the plan) |
|---|---|---|---|
| **R1** | Aggregation scans the entire `tasks` collection (notes are embedded, unqueryable) → slow, costly, unbounded reads. | High / High | `note_index` projection (§3.2) + cursor pagination + per-source caps; read-time aggregation only as cold-start fallback. **Phase 4.** |
| **R2** | **Firebase Storage rules deny uploads.** [storage.rules](storage.rules) only allows writes under `/media`, `/profile-pictures`, `/survey-uploads`, `/pdfs`. A new `/quick-notes` path fails silently. | Certain / High | Add `match /quick-notes/{allPaths=**} { allow write: if request.auth != null; }` and **deploy storage rules**. **Phase 0.** |
| **R3** | **`next/image` blocks external OG thumbnails.** [next.config](next.config.ts) `images.remotePatterns` whitelists only a few hosts; arbitrary link/og images 400. | Certain / Medium | During link enrichment, **fetch the OG image server-side and re-upload to Storage**, so every `thumbnailUrl` is same-origin. Fixes the allowlist *and* hotlink rot. **Phase 3.** |
| **R4** | **Permission lockout / compile break.** Adding an `operations` feature without seeding role defaults denies all non-admins; widening `AppFeatureId` may break exhaustive `switch`es. | High / High | Add permission feature + **seed defaults via permissions-migration**; add `ROUTE_PERMISSION_MAP` entry; audit exhaustive switches. **Phase 0** (▶ run typecheck locally). |
| **R5** | **Stale denormalised link names.** `links.entityName`/`taskName` go stale on rename; [denormalization-sync.ts](src/lib/denormalization-sync.ts) only covers `workspace_entities`. | Medium / Low | Store IDs as source of truth; resolve display name on read (cheap `get`) with denormalised value as fallback; optionally extend denorm-sync later. **Phase 5.** |
| **R6** | **TipTap content is JSON, not text + SSR hazards.** AI/search need text; rendering attacker-authored JSON risks XSS; TipTap SSR causes hydration mismatch. | High / Medium | Derive `plainText` at write-time; render read-only via TipTap's sanitised renderer (never `dangerouslySetInnerHTML`); editor is client-only, `next/dynamic` with `ssr:false` and `immediatelyRender:false`. **Phase 2.** |
| **R7** | **Vector search ops.** Firestore Vector Search needs a CLI/`gcloud`-created KNN index (not expressible in `firestore.indexes.json`) and a region that supports it; embedding backfill costs; embeddings go stale on edit. | Medium / Medium | Document the `gcloud firestore indexes composite create` step; re-embed via `after()` when `embeddingVersion` bumps; backfill script. **Phase 7.** |
| **R8** | **AI cost / prompt injection / abuse.** | Medium / Medium | Token caps + truncation; cache `note.ai`; per-user rate limit; sanitise input; server-auth before any model call (`ai-integration`, `server-auth-actions`). **Phase 6.** |
| **R9** | **Cross-workspace leakage** in aggregation. | Low / High | Every adapter query filters `workspaceId`; aggregator runs under caller auth; rules mirror `entity_notes`. **Phase 4 + tests.** |
| **R10** | **Activity feed clutter.** Note writes spam `/admin/activities`. | Medium / Low | Reuse existing `note_added` (icon already mapped in [activity-icons.tsx](src/lib/activity-icons.tsx)); tag `metadata.source='quick_note'`; add a feed filter. **Phase 8.** |
| **R11** | **Bundle bloat** from TipTap + extensions on the board route. | Medium / Medium | Editor is `next/dynamic` (`bundle-dynamic-imports`); board ships without it; ▶ run `build` locally to inspect bundle. **Phase 2.** |
| **R12** | **Lost updates** (two editors, last-write-wins). | Low / Medium | `updatedAt` precondition check in `updateNote`; reject stale writes with a toast; no realtime collab in v1 (documented). **Phase 2.** |
| **R13** | **Orphaned Storage objects** when a note/attachment is deleted. | Medium / Low | Delete owned `storagePath`s best-effort on note delete (logged), via `after()`. **Phase 3.** |
| **R14** | **Tags divergence** — free-form note tags vs the existing scoped-tag system ([tag-actions.ts](src/lib/tag-actions.ts)). | Medium / Low | **Decision needed (D1)** — default to free-form strings in v1, optional scoped-tag reuse later. **Phase 1.** |

---

## 6. Architecture & Module Decomposition

### 6.1 RSC boundaries (`next-best-practices`)
| Component | Boundary | Why |
|---|---|---|
| `page.tsx` | Server | `metadata`, static chrome, `<Suspense>` streaming; no async client components |
| `loading.tsx` | Server | route skeleton |
| `error.tsx` | Client (required) | per-segment boundary, `reset()` |
| `QuickNotesBoard.tsx` | Client | live subscription, filters, selection |
| `NoteEditor.tsx` | Client + `next/dynamic ssr:false` | heavy TipTap; keep off initial bundle + avoid hydration mismatch (R6/R11) |
| `quick-notes-aggregator.ts`, repositories, adapters | `server-only` + `React.cache()` | multi-collection reads, per-request dedup |
| `quick-notes-actions.ts`, `quick-notes-ai-actions.ts` | Server Action | authenticated like API routes (`server-auth-actions`) |

`useSearchParams` (deep-link `?category=`/`?filter=`) is read in a client child inside `<Suspense>` to avoid CSR bailout (`suspense-boundaries`).

### 6.2 File / Module Map (`writing-plans`)
```
src/app/admin/quick-notes/
  page.tsx                         [NEW] Server shell + metadata + Suspense
  loading.tsx                      [NEW]
  error.tsx                        [NEW] 'use client'
  components/
    QuickNotesBoard.tsx            [NEW] 'use client'
    QuickNoteCard.tsx              [NEW] React.memo
    NoteEditor.tsx                 [NEW] 'use client' + next/dynamic (TipTap)
    editor/                        [NEW] TipTap config, slash menu, media nodes, toolbar
    NoteAttachmentList.tsx         [NEW] thumbnails via next/image
    CategoryRail.tsx               [NEW] categories + smart filters
    AiInsightsPanel.tsx            [NEW] summary/tags/digest/semantic search
    LinkRecordPicker.tsx           [NEW] entity & task linking
    AggregatedNoteCard.tsx         [NEW] read-only legacy note + deep-link

src/lib/
  quick-notes-types.ts             [NEW] models + Zod schemas
  quick-notes-domain.ts            [NEW] PURE: normalizers, extractPlainText, query builders, UnifiedNote mapper
  quick-notes-repository.ts        [NEW] server-only QuickNoteRepository
  note-index-repository.ts         [NEW] server-only NoteIndexRepository (projection + vector)
  note-source-adapters/            [NEW] EntityNoteAdapter, TaskNoteAdapter, CallNoteAdapter (+ index)
  quick-notes-aggregator.ts        [NEW] server-only orchestration (React.cache, Promise.all)
  quick-notes-actions.ts           [NEW] 'use server' CRUD + projection + activity logging
  quick-notes-ai-actions.ts        [NEW] 'use server' AI entrypoints
  quick-notes-hooks.ts             [NEW] 'use client' useQuickNotes/useNoteCategories (useMemoFirebase)
  __tests__/quick-notes-domain.test.ts     [NEW] pure-function coverage (no emulator)
  __tests__/quick-notes-adapters.test.ts   [NEW] adapter normalisation (mocked/emulator)
  __tests__/quick-notes-ai.test.ts         [NEW] AI input guards (Genkit mocked)

src/ai/flows/
  summarize-quick-note-flow.ts     [NEW] Genkit: TL;DR/tags/sentiment/actions
  quick-notes-digest-flow.ts       [NEW] Genkit: workspace/category digest
  embed-note-flow.ts               [NEW] Genkit: embedding generation

scripts/
  backfill-note-index.ts           [NEW] one-time projection + embedding backfill

# Cross-feature wiring (see §8)
firestore.rules                    [MODIFY] quick_notes, quick_note_categories, note_index
firestore.indexes.json             [MODIFY] composite indexes
storage.rules                      [MODIFY] /quick-notes write rule (R2)
next.config.ts                     [MODIFY] (only if any remote thumbnails remain — see R3)
src/lib/types.ts                   [MODIFY] APP_FEATURES += quick_notes; permission feature key
src/lib/route-permissions.ts       [MODIFY] ROUTE_PERMISSION_MAP entry
src/lib/permissions-migration.ts   [MODIFY] seed default grant for quick_notes
src/app/admin/components/AdminSidebar.tsx [MODIFY] nav entry
src/app/admin/entities/[id]/page.tsx      [MODIFY] reverse "Quick Notes" panel (additive)
src/app/admin/tasks/...                    [MODIFY] reverse "Quick Notes" panel (additive)
```

---

## 7. AI & Semantic Search (Genkit + Firestore Vector Search)

Uses the existing **Genkit** stack ([genkit.ts](src/ai/genkit.ts), default `anthropic/claude-3-5-sonnet`, per-org key routing via `getModel`) — inherits provider fallback, caching, and org-key resolution.

- **Per-note insight** — `summarize-quick-note-flow.ts` modeled on [entity-summarizer.ts](src/ai/flows/entity-summarizer.ts): summary, ≤6 suggested tags, sentiment, action items. Cache on `QuickNote.ai`; re-run only on demand or material change. Action items get one-click **Create Task** (links back via `links.taskId`).
- **Link enrichment** — reuse [get-link-metadata-flow.ts](src/ai/flows/get-link-metadata-flow.ts) for OG title/description/image, then re-host the image (R3).
- **Digest** — `quick-notes-digest-flow.ts` over the unified set.
- **Semantic search** — `embed-note-flow.ts` generates an embedding from `plainText`; stored on the `note_index` row; queried with Firestore `findNearest` (KNN). Re-embed via `after()` when `embeddingVersion` bumps; **vector index created out-of-band** (`gcloud firestore indexes composite create … --query-scope=COLLECTION --field-config field-path=embedding,vector-config='{"dimension":N,"flat":{}}'`). Backfill via `scripts/backfill-note-index.ts`.
- **Safety/cost** (`ai-integration`): input truncation + token caps, result caching, per-user rate limit, input sanitisation, server-auth before model calls; no keys on client; AI tests mock Genkit (deterministic).

---

## 8. Cross-Feature Impact Register — What Else Is Affected

These are the systems Quick Notes touches; each is wired in an explicit phase so nothing silently breaks.

| # | System | Effect | Handling (phase) |
|---|---|---|---|
| **F1** | **`APP_FEATURES` / `AppFeatureId`** ([types.ts](src/lib/types.ts)) | Adding `quick_notes` widens the union → may break exhaustive `switch`/`Record<AppFeatureId,...>` (e.g. widget registry, feature-toggle UI). | Add the entry; ▶ **run `typecheck` locally** to find every exhaustive site; fix. **Phase 0.** |
| **F2** | **Permissions & roles** (`PermissionsSchema.operations`, `PERMISSION_ACTIONS`, default roles, [permissions-migration.ts](src/lib/permissions-migration.ts), [route-permissions.ts](src/lib/route-permissions.ts)) | New feature needs a permission key + route check, else lockout (R4). | Add feature/action, seed default grant, add route map entry. **Phase 0.** |
| **F3** | **Dashboard widget registry** ([widget-registry.ts](src/lib/widget-registry.ts)) | Widgets are keyed by `featureId`; no widget is *required*, but a "Recent Notes" widget is a natural add and confirms the feature id resolves. | Optional `quick_notes` widget. **Phase 8.** |
| **F4** | **Activities feed** ([activity-icons.tsx](src/lib/activity-icons.tsx), `/admin/activities`) | Note writes log `note_added` (icon already mapped). Risk: clutter (R10). | Tag `metadata.source`; add feed filter. **Phase 8.** |
| **F5** | **Firebase Storage rules** ([storage.rules](storage.rules)) | Uploads denied without a `/quick-notes` rule (R2). | Add rule + deploy. **Phase 0.** |
| **F6** | **Entity & Task detail pages** | Reverse "Quick Notes" panels added. | Additive panels querying `links.entityId`/`links.taskId`; no edits to existing tabs. **Phase 5.** |
| **F7** | **Scoped tags system** ([tag-actions.ts](src/lib/tag-actions.ts)) | Potential divergence between note tags and scoped tags (R14). | **D1**: free-form strings in v1. **Phase 1.** |
| **F8** | **Automations** (trigger map) | Teams may expect note creation to fire automations; currently it won't. | Out of scope v1; leave a documented hook point in `quick-notes-actions`. **Phase 8 note.** |
| **F9** | **Workspace feature-toggle settings UI** | Auto-renders from `APP_FEATURES`; new entry appears with its `label`/`icon`. | Verify icon (`NotebookPen`) resolves in the icon map. **Phase 0.** |
| **F10** | **Firestore indexes + vector index** | New composite indexes; vector index is CLI-only (R7). | `firestore.indexes.json` + documented `gcloud` step. **Phase 4 / 7.** |
| **F11** | **`next.config` images** | External thumbnails blocked (R3). | Re-host to Storage; touch config only if any remote host remains. **Phase 3.** |

---

## 9. Frontend Design Direction (`frontend-design`)

**Aesthetic — "Editorial Index Cards":** a calm paper-and-ink editorial system, deliberately not default shadcn-grey.
- **Typography**: characterful display serif for titles/category headers (e.g. *Fraunces* / *Instrument Serif*) via `next/font`, paired with the app sans for UI/body. No Inter-as-display.
- **Color**: warm neutral paper base, one confident accent per category, **token-driven** (`QuickNoteCategory.color` is a token key, no raw hex). Light/dark aware.
- **Motion**: one orchestrated entrance — cards stagger in (`animation-delay`); hover lifts a card + reveals quick actions; AI panel reveals once, deliberately. CSS-first; `prefers-reduced-motion` degrades to instant.
- **Composition**: masonry-ish grid, pinned row separated with a dog-ear motif; designed empty states (`crm-builder`): *"No notes yet — capture your first thought."*
- **`crm-builder` patterns**: everything links to everything (clickable entity/task chips), always-reachable quick-add (header + shortcut), global note search, `Sonner` toasts, `AlertDialog` for destructive actions, `Badge variant="outline"` for link chips.

**Accessibility**: real buttons/links + focus-visible rings; keyboard-navigable board; color never the sole signal; focus-trapped editor dialog; meaningful `alt` on thumbnails.

---

## 10. Phase-by-Phase Implementation Plan

Each phase produces working, testable software. Tests use **Vitest**. After each phase, **▶ RUN LOCALLY**: `npm run typecheck`, `npm run lint`, `npm run test:run` (and `npm run build` where bundle/SSR matters). Commit frequently. Pure-domain tests run without the emulator; adapter/rules tests use `npm run test:emulator`.

### Phase 0 — Integration wiring & de-risking (no UI yet)
Derisks the highest-impact breakages (R2, R4, F1, F2, F5, F9) before any feature code.
1. `types.ts`: add `{ id: 'quick_notes', label: 'Quick Notes', category: 'Operations', icon: 'NotebookPen', defaultEnabled: true }` to `APP_FEATURES`.
2. Permissions: add `quickNotes` feature to `operations` in `PermissionsSchema`; add `PERMISSION_ACTIONS` entries; seed default grant in `permissions-migration.ts`.
3. `route-permissions.ts`: add `{ path: '/admin/quick-notes', check: { label: 'Quick Notes', section: 'operations', feature: 'quickNotes' } }` (before the `/admin` catch-all).
4. `firestore.rules`: add `quick_notes`, `quick_note_categories`, `note_index` blocks (mirror `entity_notes:850`).
5. `storage.rules`: add `match /quick-notes/{allPaths=**} { allow write: if request.auth != null; }`.
6. `firestore.indexes.json`: composite indexes (board: `workspaceId,isPinned,updatedAt`; category; `note_index` by `workspaceId,createdAt`; reverse-link indexes).
7. **▶ RUN LOCALLY:** `typecheck` (catches every exhaustive `AppFeatureId` switch — F1), `lint`; deploy rules to emulator and run a rules test asserting cross-workspace denial + `createdBy`-scoped update/delete.

### Phase 1 — Domain & data layer (pure + repository, TDD)
1. `quick-notes-types.ts` + Zod schemas.
2. `quick-notes-domain.ts`: `extractPlainText(JSONContent)`, `validateQuickNoteInput`, `toUnifiedNote` per source, `buildBoardQuery`. **Test first** (`quick-notes-domain.test.ts`) — title required, tag de-dup (D1 free-form), plainText extraction from nested TipTap nodes, mapper correctness.
3. `quick-notes-repository.ts`: CRUD against `quick_notes` (Admin SDK), `updatedAt` precondition on update (R12).
4. **▶ RUN LOCALLY:** `test:run` (domain) + `test:emulator` (repository).

### Phase 2 — Native CRUD + Notion-grade editor
1. `quick-notes-actions.ts`: `createNote/updateNote/deleteNote/togglePin` — authenticated, write `organizationId`+`workspaceId`+`plainText`+denormalised names; `logActivity('note_added', metadata.source='quick_note')` via `after()`.
2. `quick-notes-hooks.ts`: `useQuickNotes`, `useNoteCategories` (`useMemoFirebase`, matching `EntityNotesTab`).
3. Route shell (`page.tsx`/`loading.tsx`/`error.tsx`), `QuickNotesBoard`, `QuickNoteCard` (memoized), `CategoryRail` — list/grid, pinned-first, `useDeferredValue` search, `startTransition` view switch, `content-visibility` lists.
4. `editor/` TipTap config (StarterKit + installed extensions + slash menu, task lists, tables, code, headings) and `NoteEditor.tsx` via `next/dynamic({ ssr:false })`, `immediatelyRender:false` (R6/R11); read-only render via TipTap renderer (no `dangerouslySetInnerHTML`).
5. `AdminSidebar` entry (Operations group, `isFeatureEnabled('quick_notes')` + `can('operations','quickNotes','view')`).
6. **▶ RUN LOCALLY:** `typecheck`, `lint`, `test:run`, and **`build`** (inspect that TipTap is code-split out of the board chunk — R11).

### Phase 3 — Media & link attachments
1. `NoteAttachmentList` + uploader reusing [media-uploader.tsx](src/app/admin/media/components/media-uploader.tsx) Storage pattern; upload to `/quick-notes/{workspaceId}/...`; store `storagePath`.
2. Link enrichment action: `get-link-metadata-flow` → **fetch OG image server-side → re-upload to Storage → same-origin `thumbnailUrl`** (R3). Thumbnails render via `next/image` with `sizes`/blur.
3. Delete-note deletes owned `storagePath`s best-effort via `after()` (R13).
4. **▶ RUN LOCALLY:** `test:run` (attachment add/remove, enrichment with mocked flow), `typecheck`.

### Phase 4 — Aggregation + `note_index` (scalability)
1. `note-source-adapters/`: `EntityNoteAdapter` (`entity_notes` where `workspaceId`), `TaskNoteAdapter` (capped/paginated scan of `tasks`, flatten `notes[]`), `CallNoteAdapter` (`call_queue_items` where `workspaceId`, `notesDraft`/disposition `notes`). Pure `toUnifiedNote`/`buildOriginHref`. **Test normalisation + workspace isolation (R9).**
2. `quick-notes-aggregator.ts`: `React.cache` + `Promise.all` fan-out (read-time fallback).
3. `note-index-repository.ts` + `projectNote()`; add a **single `after()` projection line** at each write site (quick note action + the three legacy writers — minimal additive touch); `scripts/backfill-note-index.ts` for the one-time backfill.
4. Board switches to `note_index` (cursor pagination) once backfilled; aggregator stays as cold-start fallback.
5. `AggregatedNoteCard` (read-only + "open in context").
6. **▶ RUN LOCALLY:** `test:run` + `test:emulator`; run backfill against emulator data.

### Phase 5 — Linking & reverse panels
1. `LinkRecordPicker` — link to Entity and/or Task; write `links.*` with denormalised names; resolve display name on read with denormalised fallback (R5).
2. Additive "Quick Notes" panels on entity ([page.tsx](src/app/admin/entities/[id]/page.tsx)) and task detail, querying `where('links.entityId'|'links.taskId','==',id)` — no edits to existing notes UIs (F6).
3. **▶ RUN LOCALLY:** `test:run`, `typecheck`.

### Phase 6 — AI insights
1. `summarize-quick-note-flow.ts` + `quick-notes-digest-flow.ts`; `quick-notes-ai-actions.ts` (auth, input-cap, cache on `note.ai`, rate-limit, sanitise — R8).
2. `AiInsightsPanel`: summary, apply suggested tags, action-item → Create Task, digest.
3. **▶ RUN LOCALLY:** `test:run` (AI input guards, Genkit mocked), `typecheck`.

### Phase 7 — Semantic "ask your notes" (embeddings)
1. `embed-note-flow.ts`; embed `plainText` on write via `after()` when `embeddingVersion` bumps; store on `note_index.embedding`.
2. **Create the vector index** (documented `gcloud` step — R7/F10); extend backfill to embeddings.
3. Semantic search UI in `AiInsightsPanel` using `findNearest`.
4. **▶ RUN LOCALLY:** `test:run`; verify `findNearest` against emulator/test project.

### Phase 8 — Cross-feature polish & hardening
1. `note_added` feed filter + `metadata.source` tagging (R10/F4).
2. Optional "Recent Notes" dashboard widget (F3).
3. Documented automation hook point in `quick-notes-actions` (F8).
4. Global note search entry (reuse [command.tsx](src/components/ui/command.tsx)); empty/error states; reduced-motion; a11y pass.
5. **▶ RUN LOCALLY:** full `typecheck` + `lint` + `test:run` + `build`; manual `verify`/`run` against `next dev -p 9002` (`verification-before-completion`).

---

## 11. Open Decisions

- **D1 — Note tags:** *Recommended* free-form strings in v1 (decouples from the scoped-tag system; reuse can come later). Alternative: integrate scoped tags now (F7/R14).
- **D2 — `note_index` write coupling:** *Recommended* add the one `after()` projection line to legacy writers in Phase 4 (best scale). Alternative: read-time aggregation only (zero legacy edits, worse scale) — already the fallback.
- **D3 — Embedding model/dimensions:** confirm Genkit embedding model + vector dimension before creating the Firestore vector index (index dimension is fixed at creation — R7).

---

## 12. Conformance Checklist
- [ ] `next-best-practices`: RSC boundaries; `page`/`loading`/`error`; `metadata`; `next/image`; `next/font`; server actions; dynamic editor with `ssr:false`.
- [ ] `vercel-react-best-practices`: `Promise.all` aggregation; `React.cache`; `next/dynamic`; `useMemoFirebase`; `React.memo`/`useDeferredValue`/`startTransition`; `content-visibility`; `after()`; hoisted static config.
- [ ] `frontend-design`: committed "Editorial Index Cards" direction; distinctive type via `next/font`; token color; orchestrated entrance; designed empty states; reduced-motion.
- [ ] `ai-integration`: server-auth before model calls; input caps; cached results; deterministic mocked tests; no client keys; rate-limit + sanitise.
- [ ] `crm-builder`: everything-links-to-everything; global search; quick-add everywhere; guided empty states; standard shadcn mapping.
- [ ] Clean/testable/scalable: hexagonal layering; adapter/repository/strategy patterns; pure-function test core; `note_index` for scale; Zod boundaries.
