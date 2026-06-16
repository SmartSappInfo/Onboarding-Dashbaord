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

### Phase 5.0 — Foundation (no behavior change) ✅ DONE
- [x] Pure helpers `chunkIds`/`dedupeIds`/`buildEntityMaps` + `toSearchKey` + tests.
- [x] `useEntityResolver()` (batched by-`entityId`, cached). **Deviation (intentional):** `useEntitySearch()` is a **client-side** paginated Firestore query ([use-entity-search.ts](src/hooks/use-entity-search.ts)) — **not** a server action. Rationale: workspace_entities reads are already gated by firestore rules (no auth plumbing/idToken), it fetches only a **page** (cursor pagination), and avoids a server round-trip. `.select()` projection isn't available client-side, but at page sizes (25) full docs are negligible. The dashboard repo keeps the server-action+projection pattern for aggregates.
- [x] Lazy subscription via **`requestFullSet()`** opt-in (rather than "subscribe on first `entities` read"): `useEntityCache`/`useSortedEntities`/`useActiveEntities`/`useEntityLookup` call it on mount, so behavior is unchanged; resolver/search consumers don't, so the subscription stops activating as consumers migrate.
- [x] **Search infra:** `displayNameLower` denormalization (write path: entity-actions create/update + denormalization-sync) + cursor-based resumable **backfill** ([backfill-display-name-lower.ts](src/lib/entities/backfill-display-name-lower.ts)) + one-click **Backfill** button on `/admin/seeds` + composite index `(workspaceId, displayNameLower)`.
- [ ] **▶ RUN LOCALLY / Commit** (deferred — run locally).

### Phase 5.1 — Migrate resolve-by-id consumers ✅ DONE
- [x] **KanbanBoard, DealsListView, PortalsClient, ActivityTimeline, StageEditor** → `useEntityResolver` (or removed dead full-set use). **Pipeline + Portals pages no longer trigger the subscription.**
- [ ] **▶ RUN LOCALLY / Commit per consumer** (deferred).

### Phase 5.2 — Migrate pickers/selectors to server search *(in progress)*
**Accelerator:** reusable **`EntityCombobox`** ([EntityCombobox.tsx](src/components/entities/EntityCombobox.tsx)) — search-backed picker; `valueKey: 'entityId' | 'id'`; resolves the selected label by key; passes the picked entity to `onChange` for denormalized-field sync. **Needed primitive:** `useEntityByDocId(id)` (doc-id sibling of `useEntityResolver`) for consumers whose selected entity (by doc id) is consumed elsewhere (e.g. pdfs `selectedSchool` → FieldMapper/preview).
- [x] **CreateDealModal** (`useEntitySearch` directly), **TaskEditor** (`EntityCombobox`, entityId), **InvoicesClient** (`EntityCombobox`, doc-id).
- [x] **pdfs/[id]/edit** (doc-id + `selectedSchool` via `useEntityByDocId`).
- [x] **surveys/new + edit** — `Step1Details` child: kept its grouped/iconified UI, swapped the data source to `useEntitySearch` + `useEntityResolver` (selected); removed the `institutions` prop from both parents.
- [x] **meetings/[id]/edit** — mixed: form stores the full entity object, picker keyed by doc id (+ `meetingSlug` side-effect), init resolves by `entityId` (`useEntityResolver`); `EntityCombobox` `valueKey='id'` + `onChange(value, entity)`.
- [x] **TemplateWorkshop / simulation-studio** — the sim-record School picker → `EntityCombobox` (doc-id). Removed the `entities` prop from the component + all 5 callers (TemplateWorkshopSheet, templates/page, TemplatesClient, BlueprintsHubClient, triggers/page) and their `useSortedEntities`/`useEntityCache` reads. **Templates, Triggers & Blueprints pages no longer trigger the subscription.**
- [x] **meetings/new** — same shape as meetings/[id]/edit: `EntityCombobox` `valueKey='id'` (form stores full entity + `meetingSlug` side-effect); URL `?entityId=` init resolves via `useEntityByDocId`; dropped the full-page `isLoadingEntities` gate (→ `isLoadingCustomTemplates`).
- [x] **ActivitiesClient** — the entity *filter* `<Select>` (keyed by `entityId`, with an "All" sentinel) → `EntityCombobox` `noneValue='all'`.
- [ ] audiences (ManualContactSelector / ContactScopeSelector — contact-level, hardest), campaign-wizard, ComposerWizard, deals/[id]/page contact-add, meetings/[id]/invitations, AssignContactsToTagDialog. **These remain — see "Remaining: the audience cluster" below.**
- [ ] **Commit per consumer.** ▶ **RUN LOCALLY** typecheck each.

### Phase 5.3 — Migrate lists/tables to paginated search
- [x] **Logo/email/assignee lookup lists** (TasksClient, SurveysClient, MeetingsClient) — these only built an `entityId → logoUrl/email/assignedTo` map for the rows already on screen, so they migrated to **`useEntityResolver`** (resolve only the loaded rows' `entityId`s in an effect), *not* full pagination. No virtualization needed — the row source (tasks/surveys/meetings) is already its own bounded collection.
- [ ] **ContractsClient** — genuinely lists *entities* as the base table (joined with contracts + org `entities`). Needs cursor pagination + `count()` for totals (E7).
- [ ] **Commit per consumer.**

### Remaining: the audience cluster *(needs a server-side design decision)*
Seven consumers still read the full set because they build a **contact-level recipient pool** or a **cross-entity aggregate**, which resolve-by-id / prefix-search can't serve as-is:
- **ManualContactSelector, ComposerWizard, campaign-wizard, ContactScopeSelector, meetings/[id]/invitations** — flatten every entity into its `entityContacts`, then offer search + **"Select All Match"**. "Select all matching" needs *every* matching contact, not a page — so naive cursor pagination silently breaks the selection semantics. Requires a server action that returns matching **contact IDs in bulk** (or an audience-segment query), plus a paged display.
- **deals/[id]/page (contact-add), AssignContactsToTagDialog** — entity search whose query matches `displayName` **and** `entityName`/`primaryEmail`. `useEntitySearch` is `displayNameLower`-prefix only; migrating as-is drops email/secondary-name matching. Needs either added denormalized search keys or an accepted scope reduction.
- **ReportsClient** — iterates all entities to build per-zone counts + `sum(nominalRoll)`. Should move to the dashboard's server **aggregation** pattern (`count()` / `AggregateField.sum()` grouped by zone), not the client cache.
- [ ] **Decision needed** before migrating these (see open question O3).

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
- Some views may genuinely want **live** data (Kanban). Decide per view: live-but-bounded (current page) vs fetch-on-mutation. *(Resolved so far: migrated pickers are fetch-on-open, not live — acceptable; tag-filter resolution is async, a minor delta.)*
- ~~Case-insensitive search → denormalize `displayNameLower` (+ backfill)?~~ **RESOLVED: yes** — `displayNameLower` denormalized on the write path + cursor-resumable backfill (one-click on `/admin/seeds`) + composite index. Search is **prefix** (not substring) — a substring need would require an external search service.
- Sequencing: ship 5.0 + 5.1 first (defuses most memory pressure with least risk); 5.2/5.3 as follow-ups; 5.4 only after a clean grep.
- This is an **epic** — expect multiple PRs. The lazy subscription means each is independently shippable and safe.
- **O3 (RESOLVED → Phase 6).** The audience cluster gets a flattened **`workspace_contacts` projection** (data model of option *b*) with a **server query layer** on top (option *a*), and "Select All Match" is represented as a **saved segment filter, not an enumerated ID list** (so the browser never holds 150k IDs; the send pipeline re-queries by filter, paginated). Entity-search-by-email (deals contact-add, AssignContactsToTag) is served by the same contact docs, which carry `nameLower`/`emailLower`/`phone` search keys. Full design + phased plan in **§9**.

---

## 9. Phase 6 — Contact projection & audience cluster

### 9.1 Why a new collection (verified in code)
- Contacts live **embedded** as `entityContacts[]` on `entities`, denormalized onto `workspace_entities` ([entity-actions.ts:688](src/lib/entity-actions.ts)). There is **no per-contact row**, so "give me every contact with an email + tag X" is unanswerable without scanning every entity.
- The existing server seam **`contact-adapter.ts`** (`searchContacts`, `getWorkspaceContacts`) already does this the wrong way — `.get()` **all** `workspace_entities` then filters in memory ([contact-adapter.ts:124](src/lib/contact-adapter.ts)). Same unbounded scan, just server-side. These are the functions we replace.
- **No Cloud Functions** in this repo (App Hosting only; `functions` is deploy-ignored in [firebase.json](firebase.json)). The projection is therefore maintained **synchronously from server-action write paths**, not a Firestore trigger.

### 9.2 Target model
- **`workspace_contacts`** — one doc per (workspaceId, entityId, contactId). Fields: `workspaceId`, `entityId`, `contactId`, `name`, `nameLower`, `emailLower`, `phone`, `channels` (`['email','sms','call']` — which contactVals exist), `typeKey`, `isPrimary`, `workspaceTags` (denormalized from the entity), `zoneId`, `assignedUserId`, `entityName`, `updatedAt`. Admin-SDK writes **only**.
- **`AudienceSegment`** (saved filter, not an ID list): `{ channel, search?, tags?, types?, zoneId?, assignedUserId?, excludeUnsubscribed }`. "Select All Match" stores the segment; counts come from `count()`; the send pipeline pages the matching docs at send time.

### 9.3 What could go wrong → resolution
| # | Failure mode | Resolution |
|---|---|---|
| 1 | **Projection drift** — a contact write site forgets to update `workspace_contacts` (≈20 writers today). | Funnel **all** contact mutations through one server fn `writeEntityContacts(entityId, contacts)` that updates the entity, the WE denorm, **and** the projection in one batch. A **property test** asserts `projection(ws) == flatten(entityContacts)` for random entities. A **resumable reconcile job** (`/admin/seeds` button) rebuilds from canonical and deletes orphans — the safety net for any missed path. |
| 2 | **No trigger → partial writes** if a server action throws mid-way. | Single `WriteBatch` per entity (entity doc + WE docs + contact docs commit atomically). Reconcile heals anything that still slips. |
| 3 | **Select-All materializes 150k IDs** in the browser → the very memory problem we're killing. | Never enumerate. Store the **segment filter**; show a `count()` ("12,431 contacts"); resolve to actual recipients **server-side, paginated**, at send time. |
| 4 | **Stale rows on contact/entity delete or contact removal.** | The same `writeEntityContacts` diffs and **deletes** removed contact docs; entity delete cascades a projection delete; reconcile sweeps orphans. |
| 5 | **Multi-field (email) search.** | Contact docs carry `nameLower` + `emailLower`; search runs a prefix range per field and merges (bounded, paged). Covers the two entity-picker cases too. |
| 6 | **Composite-index sprawl / unsupported query shape.** Firestore can't range-filter two fields at once. | One range field per query (prefix on `nameLower` **or** `emailLower`), everything else equality (`workspaceId`, `channels array-contains`, `workspaceTags array-contains`). Enumerate the ≤6 needed composite indexes up front. |
| 7 | **Backfill at 150k+ docs** times out / double-writes. | Cursor-resumable, **idempotent** (deterministic doc id `ws_entity_contact`), batched (≤400/commit) — the proven `displayNameLower` playbook. One-click on `/admin/seeds`. |
| 8 | **Eventual-consistency window** (projection lags the canonical write by one action). | Acceptable for audience building. On send/confirm, recipients are re-resolved from the **segment** against the latest projection; the picker resolves the *selected* label from canonical, not the projection. |
| 9 | **Security** — a client forging cross-workspace contact reads. | `workspace_contacts` read rule mirrors `workspace_entities` (workspace-membership scoped); **writes denied to clients** (Admin SDK only). |
| 10 | **Behavior regression** in the 7 consumers (lost "primary" badge, channel filter, dedupe keys). | Port each consumer's exact display/selection semantics; keep the `${entityId}:${contactId}` selection key; snapshot-test the flatten output against current ManualContactSelector logic before swapping. |

### 9.4 Clean / testable / scalable
- **Pure domain** `lib/contacts/contact-projection-domain.ts` — `flattenEntityContacts(entity) → ContactDoc[]`, `contactDocId(ws,entity,contact)`, `diffContactDocs(prev,next)`. No I/O → fully unit-testable; this is where the flatten logic currently duplicated in ManualContactSelector/ComposerWizard lives **once**.
- **Repository** `lib/contacts/contact-repository.ts` (Admin SDK) — `searchContacts`, `countSegment`, `pageSegment`, `resolveSegmentRecipients`. Replaces the full-scan bodies of `contact-adapter.ts`.
- **Single mutation** `writeEntityContacts()` — the only path that touches contact data.
- **Client hook** `useContactSearch` — mirrors `useEntitySearch` (debounced, cursor-paged, `enabled`).
- **No functionality lost:** embedded `entityContacts` is untouched, so every existing reader keeps working; the projection is purely additive read-acceleration.

### 9.5 Blast radius — other features touching contacts (Q3)
The projection is **additive**, so nothing that reads `entityContacts` breaks. But these *also* flatten/scan contacts and should be tracked so the epic finishes coherently:
- **Same data-source migration (in this epic):** `EntitySelector.tsx` (composer) + its test, `ContactScopeSelector` scope counts.
- **Send-time resolution — must use the new repo so "Select All" segments resolve correctly:** [messaging-engine.ts](src/lib/messaging-engine.ts), [sequential-scheduler.ts](src/lib/sequential-scheduler.ts), [messaging-actions.ts](src/lib/messaging-actions.ts), call-centre service.
- **Server-side bulk readers — already server-side, leave as-is but note the duplication:** [export-service.ts](src/lib/import-export/export-service.ts), [hygiene-repository.ts](src/lib/hygiene-repository.ts) / phone-hygiene, [unsubscribe-service.ts](src/lib/services/unsubscribe-service.ts), lead-scoring, [scoring-rules-engine.ts](src/lib/scoring-rules-engine.ts).
- **Gating dependency:** **Phase 5.4 (delete the `onSnapshot`) cannot run until 6.3/6.4 land** — these 7 consumers are the last full-set readers. The grep test in 5.4 is the gate.

### 9.6 Phased plan (TDD; one commit per phase — **run locally, do not auto-commit**)
- **6.0 Foundation (no consumer change).** `contact-projection-domain.ts` + tests; `ContactDoc`/`AudienceSegment` types; `workspace_contacts` security rule; composite indexes; resumable **backfill** + `/admin/seeds` button. ▶ RUN LOCALLY: typecheck + `firebase deploy --only firestore:indexes,firestore:rules`. **Commit:** `feat(contacts): workspace_contacts projection foundation + backfill`.
- **6.1 Write path.** `writeEntityContacts()` choke point; route the ~20 contact writers through it; reconcile job + `/admin/seeds` button. Property test: projection == flatten. ▶ RUN LOCALLY: typecheck + `npm test contact-projection`. **Commit:** `feat(contacts): single-writer projection sync + reconcile`.
- **6.2 Query layer.** `contact-repository.ts` (`searchContacts`/`countSegment`/`pageSegment`/`resolveSegmentRecipients`) replacing `contact-adapter` scans; `useContactSearch` hook. ▶ RUN LOCALLY: typecheck + tests. **Commit:** `feat(contacts): server contact search/segment repository`.
- **6.3 Light consumers.** ContactScopeSelector → `countSegment`; deals/[id]/page contact-add + AssignContactsToTagDialog → `useContactSearch`. ▶ RUN LOCALLY typecheck each. **Commit per consumer.**
- **6.4 Recipient builders.** ManualContactSelector, ComposerWizard, campaign-wizard, meetings/[id]/invitations → paged `useContactSearch` + segment-based Select-All; send paths (§9.5) resolve via `resolveSegmentRecipients`. ▶ RUN LOCALLY typecheck + a send smoke test each. **Commit per consumer.**
- **6.5 Reports.** ReportsClient → server zone aggregation (`count()` + `AggregateField.sum('nominalRoll')` grouped by zone), reusing the dashboard repository pattern. **Commit:** `perf(reports): server-side zone aggregation`.
- **6.6 Retire subscription (= Phase 5.4).** Grep confirms zero `useEntityCache`/`useSortedEntities` full-set readers → delete the `onSnapshot` + LRU full-set cache in [EntityCacheContext.tsx](src/context/EntityCacheContext.tsx); keep resolver/search. ▶ RUN LOCALLY: `npm run build`. **Commit:** `perf(entities): remove unbounded workspace_entities subscription`.
- **6.7 Cleanup.** Delete the old full-scan `contact-adapter` bodies + the now-duplicated in-component flatten code. **Commit:** `refactor(contacts): remove legacy full-scan contact resolution`.
