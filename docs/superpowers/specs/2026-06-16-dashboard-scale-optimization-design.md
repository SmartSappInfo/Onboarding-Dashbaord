# Dashboard Scale Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use `executing-plans`. **Conform to** `next-best-practices` (data-patterns, server caching, runtime), `vercel-react-best-practices` (`async-parallel`, `server-cache-react`, `server-cache-lru`, `server-after-nonblocking`, `server-serialization`), `frontend-design`, `test-driven-development`. Every phase is TDD where pure logic exists; commit after each green step.

**Goal:** Make the admin dashboard load in sub-second time at **50,000+ entities** by eliminating the full-collection read, replacing in-JS reduces with Firestore aggregations and (at the top end) materialized rollups.

**Architecture:** Keep the existing Server-Component + per-widget `<Suspense>` streaming. Replace the shared 50k-document fetch with (1) `count()`/`sum()` aggregation queries for scalars, (2) a bounded parallel `count()` fan-out for group-bys, and (3) a per-workspace materialized rollup document for O(1) reads. Add cross-request caching with `unstable_cache`.

**Tech Stack:** Next.js 15 (RSC, Suspense), Firestore Admin SDK (`firebase-admin ^12.7.0` — supports `count`/`sum`/`average`), `AggregateField`, `FieldValue.increment`, Vitest.

**Date**: 2026-06-16 · **Status**: Plan (v1, code-reviewed) · **Author**: Engineering

> **Build/verify note:** This plan never runs `npm run build`/`typecheck`/`lint`/`test` for you — each phase flags **▶ RUN LOCALLY**.

---

## 1. Root cause (verified in code)

The dashboard ([admin/page.tsx](src/app/admin/page.tsx)) streams each widget via its own `<Suspense>` — good. The bottleneck is the data layer: every entity widget calls [`getWorkspaceEntities`](src/lib/dashboard-server.ts:28):

```ts
adminDb.collection('workspace_entities')
  .where('workspaceId','==',workspaceId)
  .where('status','!=','archived')   // inequality — least index-friendly
  .get();                            // ← ALL 50,000 full documents
```

Wrapped in React `cache()` so it's fetched **once per request**, but **five widgets** depend on it — Metrics, Monthly, Module, Zone, User-Assignments — and each then iterates the 50k array in JS. Net per dashboard load:
- **50,000 document reads** + transfer of **full** docs (embedded `entityContacts`, location, modules → large payloads), deserialized server-side.
- **Five JS passes** over the 50k array.

**Why the UI sits on skeletons:** cheap widgets (tasks/meetings/surveys/activity/messaging) stream fast; all five entity widgets block on that single multi-second 50k read. None of them need the documents — only **counts and sums**.

Aggregations actually computed: `count`, `sum(capacity)`, group-by-month, group-by-module, group-by-zone, group-by-user.

## 2. "Students → capacity" correction + dead code (code review)

| Finding | Evidence | Action |
|---|---|---|
| The summed metric is **capacity**, not students. Canonical field is `industryData.capacity` (renamed from `enrollmentCapacity`/`companySize`); the denormalized `WorkspaceEntity.nominalRoll` is set **from** `industryData.capacity`. | [contact-adapter.ts:208](src/lib/contact-adapter.ts:208), [entity-actions.ts:197-199](src/lib/entity-actions.ts:197), [types.ts:3644](src/lib/types.ts:3644) | Rename `totalStudents`/`studentCount` → `totalCapacity`/`capacity` in `dashboard-server.ts` + widget labels. |
| **`getMetricStats.totalStudents` is dead** — computed by summing 50k `nominalRoll`, but `MetricsWidgetServer` maps only `totalEntities`; the sum is never rendered. | [MetricsWidgetServer.tsx](src/app/admin/components/widgets/MetricsWidgetServer.tsx) maps `totalSchools: stats.totalEntities` only | Delete the sum from `getMetricStats`; metrics row needs **only `count()`**. |
| Denormalized sum field naming is misleading (`nominalRoll` holds capacity). | — | Denormalize a real `capacity` number onto `workspace_entities` (write path + backfill) so aggregations `sum('capacity')`; keep `nominalRoll` write-through during transition. |

## 3. Target architecture

```
 Page (RSC)         per-widget <Suspense> (unchanged — streams independently)
 Data layer         dashboard-server.ts → aggregation queries / rollup reads
   ├ scalars        query.count() / query.aggregate(sum('capacity'))      — Phase 1
   ├ group-bys      bounded parallel count() fan-out (Promise.all)        — Phase 2 (interim)
   └ group-bys      read 1 materialized rollup doc                        — Phase 3 (scalable)
 Rollup (server)    dashboard_rollups/{workspaceId} ← FieldValue.increment on entity write
 Cache              unstable_cache({ revalidate: 60 }) around fetchers    — Phase 4
```

**Principle:** no dashboard code path reads more than a handful of documents. Scalars → aggregation queries; group-bys → fan-out now, rollup later; everything cached across requests.

## 4. Failure modes → resolution (code review)

| # | Risk | Consequence | Resolution |
|---|---|---|---|
| D1 | `count()`/`sum()` with `where` need composite indexes | Query throws at runtime | Add indexes to `firestore.indexes.json`; Firestore error names the exact index. |
| D2 | `status != archived` inequality is index-hostile and excludes aggregation simplicity | Slow/blocked aggregations | Denormalize `isArchived: boolean`; filter `== false` (backfill existing). |
| D3 | Group-by **module** uses `modules: {id,…}[]` — `array-contains` on objects is brittle | Wrong/empty counts | Denormalize `moduleIds: string[]`; `array-contains <moduleId>` per module. |
| D4 | Group-by **user** fan-out scales with user count | Many queries for big orgs | Cap fan-out; prefer the Phase-3 rollup for this widget when users are numerous. |
| D5 | Monthly trend by `createdAt` range × 12 needs a queryable, indexed timestamp | Wrong buckets | Ensure `createdAt`/`addedAt` stored as a sortable type; 12 parallel range `count()`s. |
| D6 | **Rollup drift** — a write path bypasses the increment hook | Counters diverge from truth | Single choke point in `denormalization-sync` / entity create-update-delete; **nightly reconcile** job recomputes from aggregation queries; rollup carries `reconciledAt`. |
| D7 | Counter **hot-spotting** on a very high-write workspace | Write contention on the rollup doc | Counter is per-workspace (low contention); shard only if a single workspace exceeds Firestore's ~1 write/sec/doc sustained — documented, not built v1. |
| D8 | Capacity sum changes when an entity's capacity/stage/zone changes | Stale rollup | On update, the hook diffs old→new and `increment(delta)`/moves the bucket. |
| D9 | Caching hides fresh data | Stale dashboard after a write | `revalidate: 60` (dashboards tolerate it) + `revalidateTag` on the rollup write for near-instant refresh. |
| D10 | Removing the shared `getWorkspaceEntities` could break a widget that still needs row data | Regression | Audit **all callers** (§5A Tier A): Metrics/Monthly/Module/Zone/UserAssignments + **ActivityWidgetServer** + **dashboard-actions** — all must be migrated before the function is deleted. |
| D11 | Activity widget serializes 50k entities to the client | Huge payload, slow hydration, freeze | Phase 2b: resolve only referenced entity ids (batched `in` lookup) or use denormalized `displayName`; never pass the full set as props (`server-serialization`). |
| D12 | Renaming/removing `nominalRoll` | Breaks finance/invoices/imports/AI (§5A Tier C) | Capacity is a **write-through alias**; `nominalRoll` stays populated. Dashboard rename is label/variable-only. |
| D13 | Rollup hook misses an entity write path | Counter drift (create via import/lead/deal/meeting-capture/survey, bulk, delete) | Centralize the increment in **one** choke point all writes funnel through (`denormalization-sync` / an entity repository); enumerate every writer in the backfill/reconcile test; nightly reconcile is the net (D6). |
| D14 | `EntityCacheContext` keeps streaming 50k client-side regardless of dashboard fix | Platform-wide freeze persists | Phase 5 (own track) — flagged so the dashboard fix isn't mistaken for a full resolution. |
| D15 | Adding denormalized fields (`capacity`/`isArchived`/`moduleIds`) without backfill | Aggregations under-count legacy rows | Backfill job (batched, bounded concurrency, resumable) **before** switching reads; write path sets them on all new/updated entities. |
| D16 | `getSaasMetrics` fakes MRR from entity count | Not a bug, but coupled to the same fetch | Recompute from `count()` (Phase 1); flagged so the "fake MRR" isn't accidentally broken. |

## 5. Clean / testable / scalable (no functionality loss)

- **Pure, unit-tested helpers:** `monthBuckets(now) → [{label,start,end}]`, `mergeZoneCounts`, `rollupDelta(prev,next)` (entity diff → counter increments). No I/O.
- **Repository boundary:** `DashboardRepository` (aggregation queries) and `DashboardRollupRepository` (read/write the rollup) — mirrors the existing repo pattern; widgets call these, not raw `adminDb`.
- **`async-parallel`:** all fan-out `count()`s and independent fetchers run in `Promise.all` (no waterfalls).
- **Caching:** `unstable_cache`/`revalidate` for cross-request reuse (`server-cache-lru`); keep `React.cache` for per-request dedup (`server-cache-react`).
- **Non-blocking maintenance:** rollup updates on entity writes run in `after()` (`server-after-nonblocking`) so entity saves never wait on dashboard counters.
- **No regression:** widgets keep their current props/visuals; only the *source* of the numbers changes. Phase 1/2 need no schema change beyond optional `isArchived`/`moduleIds`/`capacity` denormalization (backfilled).

## 5A. Blast radius — other features affected (verified in code)

### Tier A — directly coupled to these changes (must update in the same phases)
| Feature | Coupling | Plan |
|---|---|---|
| **Activity widget** [ActivityWidgetServer.tsx](src/app/admin/components/widgets/ActivityWidgetServer.tsx) | Calls `getWorkspaceEntities` **and passes all 50k entities as props to a client component** (`RecentActivity`) to resolve names for a ~50-row feed — a double hit: 50k read **+** 50k serialized to the client (`server-serialization` violation). | Phase 2b: resolve only the entityIds the ~50 activities reference (batched `where(documentId in […])`), or use the `displayName` already denormalized on activities. |
| **User-Assignments widget** [UserAssignmentsWidgetServer.tsx](src/app/admin/components/widgets/UserAssignmentsWidgetServer.tsx) | Imports `getWorkspaceEntities` directly (besides `getUserAssignments`). | Phase 2: switch to per-user `count()`/`sum`; drop the direct full fetch. |
| **Client refresh action** [dashboard-actions.ts](src/app/actions/dashboard-actions.ts) | `'use server'` refresh path re-runs `getMetricStats`/`getWorkspaceEntities` (SaaS metrics map entity count → fake MRR). | Phase 1: routes through the same aggregation fetchers automatically once `getMetricStats` is converted; audit the file. |

### Tier B — platform-wide scale issue surfaced by the same root cause
| Feature | Issue | Plan |
|---|---|---|
| **`EntityCacheContext`** [EntityCacheContext.tsx:157](src/context/EntityCacheContext.tsx:157) | A real-time `onSnapshot` on **all** `workspace_entities` (only `workspaceId` filter, **no limit**), mounted in `admin/layout-client.tsx` → **every admin page streams 50k docs to the browser** live. Consumed by pipeline (Kanban/DealsListView/StageEditor), tasks, deals, portals, surveys, composer, templates. **Likely compounds the dashboard freeze** (it loads on the same layout). | **Phase 5** (own track): paginate / lazy-load / move aggregate-only consumers off the full set; replace count-style consumers with server counts; cap the live subscription (e.g. recent N + on-demand fetch by id). Big enough to be its own spec — flagged here so it isn't missed. |
| **Reports / metrics-actions** [metrics-actions.ts:119](src/lib/metrics-actions.ts:119) | Separate heavy `workspace_entities` scans for reporting. | Reuse the new `DashboardRepository` aggregations / rollup; audit in Phase 3. |
| **Migration scripts** (`strip-lifecycle-status-fer-action`, `deal-migration-actions`) | Full-collection `.get()` (some across all workspaces). | Out of hot path (admin-run); note batching, not in scope. |

### Tier C — load-bearing fields (do NOT break)
| Field | Used by | Rule |
|---|---|---|
| **`nominalRoll`** | Finance/billing ([EntityBillingTab](src/app/admin/entities/components/EntityBillingTab.tsx), `ratePerStudent`, invoices [types.ts:1263](src/lib/types.ts:1263)), imports/bulk-upload, reports, AI extraction flows, signup forms | **Never remove or rename in place.** Add `capacity` as a write-through denormalization; keep `nominalRoll` populated indefinitely (alias). The capacity rename is **label/variable-only** in the dashboard, not a data migration. |

## 6. Phased plan (TDD, bite-sized)

> **Git:** each phase ends with a **commit** step (listed, not auto-run). **Do NOT run** `build`/`typecheck`/`lint`/`git commit` — they're flagged **▶ RUN LOCALLY** for you. Work on a branch off `main`.

### Phase 1 — Aggregation-query scalars *(biggest win, lowest risk)*
**Files:** Modify [dashboard-server.ts](src/lib/dashboard-server.ts) (`getMetricStats`); add `firestore.indexes.json` entries as surfaced.
- [ ] `getMetricStats`: replace `getWorkspaceEntities` with `query.count().get()` for `totalEntities`; **delete** the dead `totalStudents` sum (§2).
- [ ] Keep meetings/surveys as the existing `count()`-able quick reads (they already `.get()` then `.size` — switch to `.count()`).
- [ ] Audit `dashboard-actions.ts` `getSaasMetrics` (D16) — it now reads through the converted `getMetricStats`; confirm no residual full fetch.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck`; load the dashboard — metrics row should pop in immediately.
- [ ] **Commit (run locally):** `git commit -am "perf(dashboard): metrics via count() aggregation; remove dead capacity sum"`

### Phase 2 — Group-by widgets via bounded `count()` fan-out + capacity rename
**Files:** Modify `getZoneDistribution`, `getMonthlyTrend`, `getModuleFootprint`, `getUserAssignments`; add `monthBuckets` + tests; add denormalized `isArchived`/`moduleIds` + backfill (D15).
- [ ] Pure: `monthBuckets(now)` unit tests.
- [ ] Zone → `count()` (+ `sum('capacity')`) per zone in `Promise.all`; rename `studentCount` → `capacity`.
- [ ] Monthly → 12 range `count()`s in `Promise.all`.
- [ ] Module → `count()` per `moduleId` (`array-contains`) after denormalizing `moduleIds`.
- [ ] User-assignments → `count()`/`sum` per user; drop its direct `getWorkspaceEntities` import (D10); rename `totalStudents` → `totalCapacity` (label too).
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`. Add any indexes Firestore names.
- [ ] **Commit (run locally):** `git commit -am "perf(dashboard): group-by widgets via parallel count() fan-out; capacity rename"`

### Phase 2b — Activity widget + serialization fix (D11)
**Files:** Modify [ActivityWidgetServer.tsx](src/app/admin/components/widgets/ActivityWidgetServer.tsx), `RecentActivity` props, `getRecentActivities`.
- [ ] Stop passing the full entity set to the client. Resolve only the entity ids referenced by the fetched activities — batched `where(documentId() in [...])` (chunks of 30) or use the `displayName` already denormalized on activities.
- [ ] Trim `RecentActivity` props to the small resolved map (`server-serialization`).
- [ ] **▶ RUN LOCALLY:** `npm run typecheck`; verify activity names still render.
- [ ] **Commit (run locally):** `git commit -am "perf(dashboard): resolve activity entity names by id, stop 50k client serialize"`

### Phase 3 — Materialized rollups (O(1) end-state)
**Files:** Create `dashboard-rollup-repository.ts`, `rollup-domain.ts` (+ tests), backfill action, reconcile job; hook `denormalization-sync.ts` / entity create-update-delete.
- [ ] Pure: `rollupDelta(prev,next)` tests (capacity change, stage/zone move, create, delete).
- [ ] `dashboard_rollups/{workspaceId}` schema: `total`, `totalCapacity`, `byStage`, `byZone`, `byModule`, `byMonth`, `byUser`, `reconciledAt`.
- [ ] Maintenance hook in **one choke point** all writers funnel through (D13: create/update/delete + import/lead/deal/meeting-capture/survey/bulk), run in `after()`; one-time backfill (batched, bounded concurrency, resumable); nightly reconcile (D6).
- [ ] Dashboard fetchers read the single rollup doc; `metrics-actions`/reports reuse it where applicable.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`.
- [ ] **Commit (run locally):** `git commit -am "perf(dashboard): materialized per-workspace rollups + backfill + reconcile"`

### Phase 4 — Cross-request caching + cleanup
- [ ] Wrap aggregate/rollup fetchers in `unstable_cache({ revalidate: 60, tags: ['dashboard:'+workspaceId] })`; `revalidateTag` on rollup write (D9).
- [ ] Delete now-unused `getWorkspaceEntities` once **all** callers (§5A Tier A) are migrated (D10); `.select()` any residual row reads.
- [ ] **▶ RUN LOCALLY:** `npm run build`.
- [ ] **Commit (run locally):** `git commit -am "perf(dashboard): cross-request cache + remove full-collection fetch"`

### Phase 5 — `EntityCacheContext` platform-wide scale *(separate track; biggest systemic win)*
**Files:** [EntityCacheContext.tsx](src/context/EntityCacheContext.tsx) + its consumers (pipeline/tasks/deals/surveys/portals/composer/templates).
- [ ] Audit consumers: which need the **full** set vs an **aggregate** vs a **page/lookup-by-id**.
- [ ] Replace the unbounded live `onSnapshot` with: server-side counts for aggregate consumers; paginated/virtualized lists; on-demand `getDoc`/batched `in` lookups for detail; optionally a bounded "recent N" live window.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run build`. *(Large enough to warrant its own spec — keep this phase last and incremental, one consumer at a time.)*
- [ ] **Commit (run locally):** per-consumer, e.g. `git commit -am "perf(entities): paginate KanbanBoard off the full entity cache"`

## 7. Data-model & index changes
- Denormalize onto `workspace_entities`: `capacity: number` (write-through from `industryData.capacity`), `isArchived: boolean`, `moduleIds: string[]`. Backfill once.
- New collection `dashboard_rollups/{workspaceId}` — server-only (`allow read,write: if false`).
- Composite indexes (added as Firestore errors name them): `(workspaceId, isArchived)`, `(workspaceId, isArchived, zone.id)`, `(workspaceId, isArchived, createdAt)`, `(workspaceId, isArchived, moduleIds array)`, `(workspaceId, isArchived, assignedTo.userId)`.

## 8. Skill conformance
- **next-best-practices:** Server Components + Suspense streaming retained; Node runtime; `data-patterns` (server-side aggregation, no client over-fetch).
- **vercel-react:** `async-parallel` (fan-out), `server-cache-lru`/`server-cache-react` (caching), `server-after-nonblocking` (rollup writes), `server-serialization` (no 50k transfer to client).
- **frontend-design:** widget visuals unchanged; relabel "Students" → "Capacity"; skeletons now resolve fast and independently.
- *(find-skills surfaced `firebase/agent-skills@firebase-firestore-standard` — aggregation/index conventions; external-install blocked by the safety classifier, patterns followed manually.)*

## 9. Recommendation & open questions
- **Phase 1 + 2 + 2b immediately** — removes the server-side 50k fetch *and* the 50k client serialization, with only additive denormalized fields (no breaking change to `nominalRoll`/finance). Multi-second → sub-second dashboard.
- **Then Phase 4** (caching) and **Phase 3** (rollups) for the O(1) end-state and headroom past 50k.
- **Phase 5 is the biggest systemic win but the largest change** — `EntityCacheContext` streams 50k to every admin page and likely compounds the freeze. Treat it as its own incremental track (one consumer at a time); the dashboard fix alone will *not* fully resolve admin-wide slowness while this remains.
- **Do not break Tier C** (`nominalRoll`): capacity is a write-through alias; the rename is dashboard label/variable-only.
- Open: (1) acceptable dashboard staleness window (drives `revalidate`)? (2) rollup maintenance via app hooks vs a Cloud Function trigger (D13 coverage)? (3) keep `nominalRoll` as a write-through alias indefinitely, or migrate fully to `capacity`? (4) is Phase 5 (`EntityCacheContext`) split into its own spec/epic?
