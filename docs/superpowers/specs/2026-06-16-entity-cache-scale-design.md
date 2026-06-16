# EntityCacheContext Scale Refactor (Dashboard Optimization — Phase 5)

> **For agentic workers:** REQUIRED SUB-SKILL — `executing-plans`. **Conform to** `next-best-practices` (data-patterns, runtime, route-handlers), `vercel-react-best-practices` (`client-swr-dedup`, `async-parallel`, `rerender-*`, `server-serialization`, `bundle-*`), `frontend-design`, `test-driven-development`. Incremental, **one consumer per commit**; the unbounded load is defused early via a lazy subscription (strangler-fig), so no big-bang cutover.

**Goal:** Stop streaming all `workspace_entities` to every admin browser. Replace the unbounded real-time cache with **resolve-by-id** + **server-side search/pagination**, so the client holds only what a view actually shows.

**Architecture:** Keep the `EntityCacheContext` public surface but (1) make the full-collection subscription **lazy** — it activates only if a consumer still reads the whole set; (2) add `useEntityResolver()` (batched by-id) and `useEntitySearch()` (server-paginated); (3) migrate consumers off the full set bucket-by-bucket; (4) delete the unbounded subscription once no consumer triggers it.

**Tech Stack:** Next.js 15, Firestore (client SDK for live subscriptions, Admin SDK for the search route/action), React context, Vitest.

**Date**: 2026-06-16 · **Status**: Plan (v1, code-reviewed) · **Author**: Engineering

> **Build/verify note:** never runs `build`/`typecheck`/`lint`/`git` for you — each phase flags **▶ RUN LOCALLY** incl. the commit.

---

## 1. Problem (verified in code)

[`EntityCacheContext`](src/context/EntityCacheContext.tsx:157) opens a real-time `onSnapshot` on **all** `workspace_entities` (only `workspaceId`, **no `limit`**), mounted in [`admin/layout-client.tsx`](src/app/admin/layout-client.tsx) → **every admin page streams the entire entity collection to the browser, live**. The file's own comment quantifies the bomb:

> "20K entities × ~3KB each = ~60MB per entry, so 3 entries = ~180MB ceiling."

At 50k that's ~150MB **per workspace** held in browser memory (×3 LRU ≈ **450MB**), re-evaluated on every entity change. This compounds the dashboard freeze (same layout) and slows pipeline, tasks, deals, surveys, composer, etc.

## 2. What consumers actually need (access-pattern audit)

| Pattern | Hook | Consumers | Real need |
|---|---|---|---|
| **Resolve by id** | `useEntityLookup` (`byId`/`byEntityId`) | KanbanBoard, DealsListView, PortalsClient, ActivityTimeline | A handful of entities by id (e.g. tags, names) — **never the whole set**. |
| **List / table** | `useSortedEntities` | TasksClient, TaskEditor, activities, finance invoices/contracts, surveys new/edit, pdfs edit, meetings edit, TemplateWorkshopSheet | A **paginated/filtered page**, not 50k rows in memory. |
| **Picker / selector** | `useEntityCache().entities` | ComposerWizard, audiences (Manual/ScopeSelector), triggers, meetings, StageEditor, deals, SurveysClient | **Server-side search** by name/filters with a small result set. |

> Key finding: **KanbanBoard builds a Map of all 50k just to `byEntityId.get(id)` a few tag lists** — the canonical "load everything to look up one thing" anti-pattern.

## 3. Target architecture (strangler-fig)

```
 EntityCacheProvider (lazy)        full onSnapshot only activates if a consumer
                                    still reads `entities` (deprecated path)
 useEntityResolver()  →  resolve(ids[]): Map<id, Entity>   — batched getDocs by id, SWR-cached
 useEntitySearch(q, filters) → { results, loadMore }       — server action / route, paginated, indexed
 useEntityCache().entities (deprecated)  →  warns + lazily loads (shrinks to nothing as consumers migrate)
```

- **`useEntityResolver`** — collects requested ids, batches `getDocs`/`getAll` (chunks of 30 for `in`, or doc refs), caches results (`client-swr-dedup`). Covers all `useEntityLookup` consumers with O(referenced) instead of O(all).
- **`useEntitySearch`** — backed by a server action `searchEntities(workspaceId, { query, filters, cursor, limit })` (Admin SDK, `.select()` projection, indexed prefix/`array-contains`), returns a page + cursor. Covers pickers/lists. (Reuses the projection pattern from the dashboard repo.)
- **Lazy full-set**: the provider does **not** subscribe on mount; it subscribes only when `entities` is first read. So migrating a consumer off `entities` removes its pressure immediately, and the subscription disappears entirely once the last consumer migrates — **the bomb is defused incrementally, not at the end.**

## 4. Failure modes → resolution (code review)

| # | Risk | Consequence | Resolution |
|---|---|---|---|
| E1 | Migrating a consumer changes behavior (sort/filter done client-side over the full set) | Subtle regressions (missing rows, wrong order) | Move the exact filter/sort to the server query; snapshot-test each migrated view's output against the old client-side result. |
| E2 | Loss of real-time updates when moving off `onSnapshot` | Stale lists until refresh | Pickers/lists tolerate eventual consistency (revalidate on focus/mutation, `client-swr-dedup`); keep a bounded live subscription only where live is essential (e.g. Kanban board of the *current* stage page). |
| E3 | Server search needs indexes (prefix/`array-contains`/range) | Query throws | Add composite indexes as Firestore names them; document a `displayNameLower` denormalization for case-insensitive prefix search if needed. |
| E4 | `in`/`getAll` id batches exceed limits | Partial resolution | Chunk ids (≤30 for `in`; `getAll` handles many refs); dedupe; unit-test the chunker. |
| E5 | Lazy subscription still triggered by one stray `entities` reader | Bomb persists silently | A dev-only warning logs which consumer read `entities`; CI grep test forbids new `useSortedEntities`/`entities` usage after migration. |
| E6 | Big-bang refactor breaks many pages at once | High blast radius | **One consumer per commit**, behind the unchanged public API; the lazy subscription keeps un-migrated consumers working throughout. |
| E7 | Pagination UX (infinite scroll/virtualization) regresses tables | Worse UX than the in-memory list | Use a virtualized list (`content-visibility`/windowing) + cursor `loadMore`; keep counts via server `count()` (from the dashboard repo). |
| E8 | Memory cache (`MAX_CACHE_ENTRIES=3`) across workspace switches | Still holds large sets during migration | Shrinks automatically as consumers stop populating `entities`; cap resolver cache by id-count, not workspace. |

## 5. Clean / testable / scalable (no functionality loss)
- **Pure, unit-tested:** `chunkIds`, `dedupeIds`, `buildEntityMaps(entities)`, `searchParamsToQueryShape(filters)` — no I/O.
- **Boundaries:** `entity-search-service` (server, Admin SDK projection + cursor) and `entity-resolver` (client, batched+cached). The context becomes a thin orchestrator.
- **`async-parallel`:** resolver batches resolve concurrently; search prefetches next cursor on idle (`bundle-preload`).
- **No regression:** public hooks keep working via the lazy path; each migrated consumer is snapshot-verified (E1).

## 6. Phased plan (TDD, one consumer per commit)

### Phase 5.0 — Foundation (no behavior change)
- [ ] Pure helpers `chunkIds`/`dedupeIds`/`buildEntityMaps` + tests.
- [ ] `useEntityResolver()` (batched by-id, cached) + `useEntitySearch()` + `searchEntities` server action (projection + cursor).
- [ ] Make the provider subscription **lazy** (subscribe on first `entities` read; dev warning naming the reader).
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`.
- [ ] **Commit:** `git commit -m "feat(entities): lazy entity cache + resolver/search foundation (no behavior change)"`

### Phase 5.1 — Migrate resolve-by-id consumers *(biggest, easiest wins)*
KanbanBoard, DealsListView, PortalsClient, ActivityTimeline → `useEntityResolver`.
- [ ] Per consumer: replace `useEntityLookup` map-over-all with `resolve(referencedIds)`; snapshot-verify output (E1); **commit per consumer**.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test` after each.

### Phase 5.2 — Migrate pickers/selectors to server search
ComposerWizard, audiences (Manual/Scope), triggers, meetings selectors, StageEditor.
- [ ] Replace in-memory filter with `useEntitySearch`; debounced query; virtualized results.
- [ ] **Commit per consumer.** ▶ **RUN LOCALLY** typecheck/test each.

### Phase 5.3 — Migrate lists/tables to paginated search
Tasks, activities, finance invoices/contracts, surveys, pdfs, meetings edit, TemplateWorkshopSheet.
- [ ] Cursor pagination + virtualization (E7); server `count()` for totals.
- [ ] **Commit per consumer.**

### Phase 5.4 — Retire the unbounded subscription
- [ ] Confirm no consumer reads `entities`/`useSortedEntities` (E5 grep test).
- [ ] Delete the full `onSnapshot`; keep only resolver/search. Remove the LRU full-set cache.
- [ ] **▶ RUN LOCALLY:** `npm run build`.
- [ ] **Commit:** `git commit -m "perf(entities): remove unbounded workspace_entities subscription"`

## 7. Skill conformance
- **vercel-react:** `client-swr-dedup` (resolver/search caching), `async-parallel` (batched resolve), `bundle-preload` (prefetch next page), `server-serialization` (no 50k to client), `rendering-content-visibility` (virtualized lists).
- **next-best-practices:** server action / route handler for search (`data-patterns`); Node runtime for Admin-SDK search.
- **frontend-design:** lists gain search + virtualization; visuals unchanged otherwise.

## 8. Risks & open questions
- Some views may genuinely want **live** data (Kanban). Decide per view: live-but-bounded (current page) vs fetch-on-mutation.
- Case-insensitive search → denormalize `displayNameLower` (+ backfill)?
- Sequencing: ship 5.0 + 5.1 first (defuses most memory pressure with least risk); 5.2/5.3 as follow-ups; 5.4 only after a clean grep.
- This is an **epic** — expect multiple PRs. The lazy subscription means each is independently shippable and safe.
