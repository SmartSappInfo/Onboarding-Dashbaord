# Deals — Iteration 3 Plan: Pipeline/Stage population, Default assignee, Deal notes

> Status: IMPLEMENTED (all 8 phases). Conforms to `next-best-practices`, `vercel-react-best-practices`, `frontend-design` skills (`.agents/skills`).
> ⚠️ Deploy the new `entity_notes (dealId, workspaceId, createdAt)` composite index **before** using the deal Notes panel in production.
> Verification (lint / typecheck / tests) is run **locally by the user** to conserve credits.

This plan is a self-review. Each feature lists: current state (from code), the fix, what could go wrong + mitigation, testability, and blast radius (other features affected).

---

## A. Pipeline & Stage not populating on the deal detail page

### Current state (verified in code)
- `deals/[id]/page.tsx` initialises `pipelineId`/`stageId` from `deal.pipelineId`/`deal.stageId` in an effect keyed on `[deal]` (lines ~303–315). ✅ correct.
- `pipelines` come from a list query scoped `where('workspaceIds','array-contains', deal.workspaceId)`.
- `stages` come from `where('pipelineId','==', pipelineId)`.
- The Radix `<Select value={pipelineId}>` renders the **placeholder whenever `value` has no matching mounted `<SelectItem>`**. Same for stage.

### Root-cause analysis
Both selects showing placeholder *simultaneously* (even though the board proves the deal has a pipeline+stage) points to one of:
1. **Value-without-matching-item** — the deal's pipeline is not returned by the workspace-scoped list query. This happens with legitimate **data drift**: a pipeline that was shared into the workspace when the deal was created but whose `workspaceIds` array no longer includes it, or a pipeline persisted with a legacy single `workspaceId` field instead of the `workspaceIds` array. The `value` is set but no `SelectItem` matches → placeholder.
2. **`deal.workspaceId` / `deal.pipelineId` missing or stale** on the doc — less likely (the board filters on both), but possible for deals created by older code paths.

Relying on a *filtered list query* to also contain the *current value* is the fragile design here. The board works because it only needs the list; the detail form additionally needs the **current value to be selectable**.

### Fix (robust — "always include the current value")
Decouple "options to switch to" from "the current value must be selectable":
1. **Directly fetch the deal's current pipeline by id** (`useDoc('pipelines', deal.pipelineId)`) and the **current stage by id** (`useDoc('onboardingStages', deal.stageId)`).
2. Build the Select option lists as a **de-duplicated union** of (a) the workspace list query and (b) the directly-fetched current doc. So the current pipeline/stage is *always* a selectable item, regardless of sharing/data drift.
3. Keep the stage list query keyed on the selected `pipelineId` for switching.
4. Extract the union logic into a small pure helper `mergeById(list, current)` in `deal-select-utils.ts` with unit tests.

This eliminates the entire class of "value set but placeholder shown" bugs and is the standard pattern for edit-forms whose value may fall outside the current filter.

### Diagnostics to confirm (user runs locally — no code shipped)
Temporarily log in the component: `console.log({ wsId: deal?.workspaceId, pid: deal?.pipelineId, sid: deal?.stageId, pipelines: pipelines?.length, stages: stages?.length })`. This tells us whether it's (1) data drift or (2) missing fields. The fix above covers **both**.

### What could go wrong / mitigation
| Risk | Mitigation |
|---|---|
| `useDoc` on `pipelines/undefined` when `deal.pipelineId` empty | Guard: only build the ref when the id is a non-empty string (return `null` ref otherwise). |
| Duplicate keys in Select if union not de-duped | `mergeById` keys by `id`; unit-tested. |
| Permission error reading a pipeline in another workspace | Reading by id is allowed by the same rules that allow the board read; if denied, the union simply omits it and we fall back to the list (no crash). |
| Extra reads (1 pipeline doc + 1 stage doc) | Negligible; both are single-doc reads, cached by the Firestore SDK. |

### Testability
`deal-select-utils.test.ts`: `mergeById` — current already in list (no dup), current absent (appended), current null (list unchanged), empty list + current (single item).

### Blast radius
Isolated to `deals/[id]/page.tsx`. No other component reads these selects.

---

## B. Default assignee inherited from the entity (with override)

### Current state (verified)
- `createDeal` already resolves `assignedTo = entity.assignedTo` when `assignmentStrategy === 'direct'`, and `'direct'` is the default in `CreateDealModal`, `BulkCreateDealModal`, automation (`deal-automation-actions.ts`), and seed automation. ✅ The *server* default is already correct.
- **Gap:** `CreateDealModal` has **no assignee field at all** — only an "Assignment Routing" strategy select. The creator can't *see* who will be assigned, nor override to a specific person without changing strategy. `WorkspaceEntity.assignedTo` is `{ userId, name, email }`.
- The new-entity page passes `assignedTo` explicitly (already inherits). The deal detail page already has an editable "Assigned User".

### Fix
1. **Surface + override in `CreateDealModal`:** when an entity is resolved, fetch its `workspace_entities/{wsId}_{entityId}.assignedTo` and pre-select it in a new **Owner** dropdown (workspace users). Default = entity owner; the creator may change it.
   - If the creator leaves it on the inherited owner → send no explicit `assignedTo` (let server `'direct'` resolve, single source of truth).
   - If the creator picks someone else → send explicit `assignedTo: { userId, name, email }` (overrides strategy on the server, which already honours an explicit `assignedTo`).
   - Keep the existing routing select but **only show it when no specific owner is chosen** (i.e., "Auto" mode) to avoid a confusing "strategy vs explicit person" conflict.
2. **Confirm non-UI paths unchanged:** bulk/automation/import keep `'direct'` → inherit entity owner. No change needed; add a regression test on `createDeal` to lock the behaviour.

### Reuse / clean-code
- Reuse the workspace-users query already added to `PipelineClient`/deal-detail — extract a tiny `useWorkspaceUsers(workspaceId)` hook (`src/app/admin/pipeline/hooks` or `src/hooks`) so the modal, detail page, and filter bar share one query (DRY; today the same query is written in 3 places). Per `vercel-react-best-practices` (avoid duplicated data fetching).

### What could go wrong / mitigation
| Risk | Mitigation |
|---|---|
| Entity has no `assignedTo` → Owner shows blank | Show "Unassigned" as the resolved default; behaviour identical to today. |
| `assignedTo.name/email` stale vs the user record | When the creator picks from the users list, build `assignedTo` from the **user doc**, not the entity snapshot. |
| Two sources of truth (strategy + explicit) | UX rule above: explicit owner overrides; routing select hidden once a person is chosen. Document in code comment. |
| Fetching entity assignee adds a read on entity-select | Single doc read, only when entity changes; reuse the `getEntityContactsAction` round-trip by extending it to also return `assignedTo` (one server call, not two). |

### Testability
- `createDeal` unit/integration (emulator): direct strategy inherits entity owner; explicit `assignedTo` overrides; `unassigned` clears. These are server-action tests (the repo already has `test:emulator`).

### Blast radius
- `CreateDealModal` (UI), `entity-contact-actions.ts` (extend return), optional shared hook. Bulk/automation/new-entity untouched (already inherit). Deal detail unaffected.

---

## C. Deal notes + deal attribution in the entity notes panel

### Current state (verified)
- Canonical notes store is the **`entity_notes`** collection (`EntityNote` type), used by `EntityNotesTab` (entity page panel) and `EntityNotesWidget`. (An older `NotesSection` writes notes as `activities` with `type:'note'` — **not** the entity page panel; leave it alone.)
- `EntityNotesTab` queries `where('entityId','==',X) && where('workspaceId','==',ws)` orderBy `createdAt`. Composite index exists `(entityId, workspaceId, createdAt)`.
- `EntityNote` has no deal linkage today. The deal detail page has **no notes UI** (only a free-text `description`).
- `entity-summarizer` AI flow consumes `EntityNote` fields `createdAt/createdByName/noteType/content` — additive fields are safe.

### Fix
1. **Schema (additive, backward-compatible):** add optional `dealId?: string` and `dealName?: string` to `EntityNote`.
2. **Deal detail page — Notes section:** reuse `EntityNotesTab` with a new optional `dealId` prop:
   - When `dealId` is set: the query becomes `where('dealId','==',dealId) && where('workspaceId','==',ws)` orderBy `createdAt`; new notes are written with `{ entityId: deal.entityId, dealId: deal.id, dealName: deal.name, workspaceId, ... }`.
   - When `dealId` is absent (entity page): unchanged `entityId` query.
   - This reuses one component for both surfaces (DRY) rather than duplicating note CRUD.
3. **Entity notes panel — deal attribution:** because deal notes share the same `entityId`, they already appear in the entity panel. Render a small **"On deal: {dealName}"** chip (linking to `/admin/deals/{dealId}`) on any note where `note.dealId` is set. Optionally add a "Deal" quick-filter to the existing `filterType` control.
4. **Denormalisation upkeep:** store `dealName` at write time; if a deal is renamed, existing chips show the old name (acceptable, consistent with the app's denormalisation pattern used elsewhere, e.g. `stageName`). A future `denormalization-sync` entry can refresh it; out of scope here.

### What could go wrong / mitigation
| Risk | Mitigation |
|---|---|
| New query `where('dealId','==') && where('workspaceId','==') orderBy createdAt` needs a **composite index** | Add `(dealId, workspaceId, createdAt DESC)` to `firestore.indexes.json` **and deploy it** before shipping the deal-notes query. Flag this explicitly in the deploy checklist. |
| `EntityNotesTab` branching grows complex | Keep one `notesQuery` memo that switches the `where` clause on `dealId`; everything else (render, edit, delete, pin, reply) is identical. Add a `scope: 'entity' | 'deal'` derived const for readability. |
| Firestore rules for `entity_notes` may not allow `dealId` writes | Rules validate fields by allow-list in some projects — verify `entity_notes` create/update rules permit the new optional fields (most rules allow unknown fields unless explicitly locked). |
| Deleting a deal orphans its notes | Notes remain attached to the entity (still valid as entity history). Optionally show "(deal removed)" if the deal doc is gone — low priority. |
| Reply threading + dealId | Replies inherit the parent's `dealId`/`entityId` so a thread stays consistent. |
| AI summarizer double-counts deal notes under the entity | Acceptable — they are genuine entity history. If undesired, pass a flag to exclude `dealId` notes; defer. |

### Testability
- Pure helper `noteScopeQueryFields(scope, ids)` returning the `where` tuples → unit test.
- Component test: deal-scoped tab writes `dealId`; entity tab renders the deal chip when `dealId` present.

### Blast radius
- `EntityNote` type (+2 optional fields), `EntityNotesTab` (prop + query branch + chip), deal detail page (mount the tab), `firestore.indexes.json` (+1 index). `EntityNotesWidget` and `entity-summarizer` unaffected (additive fields). Old `NotesSection` (activities) untouched.

---

## Cross-cutting: clean / testable / scalable

- **Extract pure helpers** (`mergeById`, `noteScopeQueryFields`, reuse `getForecastUrgency`/`applyDealFilters`) so logic is unit-tested without Firebase — matches the existing `pipeline/utils` test pattern.
- **One workspace-users query** behind a shared hook to remove the 3× duplication (modal, detail, filter bar).
- **No new effects where derived state suffices** (`vercel-react-best-practices`): pipeline/stage option lists are `useMemo` over query results, not `useState`+effect.
- **Server actions for all writes** (`'use server'`), client components only read via `useCollection`/`useDoc` (`next-best-practices` RSC boundary respected).
- **Additive, backward-compatible schema** — every new field optional; no migration required, no read-path breakage.

## Suggested phase order (each independently shippable & verifiable)

| Phase | Scope | New index? | Risk |
|---|---|---|---|
| 1 | `mergeById` util + tests | no | none |
| 2 | Pipeline/stage robust population (direct-fetch + union) | no | low |
| 3 | `useWorkspaceUsers` shared hook + extend `getEntityContactsAction` to return `assignedTo` | no | low |
| 4 | CreateDealModal Owner picker (inherit + override) | no | med (UX) |
| 5 | `createDeal` assignee regression tests | no | none |
| 6 | `EntityNote` schema +`dealId/dealName`; `firestore.indexes.json` +1 index (deploy first) | **yes** | low |
| 7 | `EntityNotesTab` `dealId` prop + query branch + deal chip | no | med |
| 8 | Mount Notes section on deal detail page | no | low |

## Local verification (run by user)
```bash
pnpm test:run src/app/admin/pipeline/utils      # helpers
pnpm typecheck && pnpm lint
firebase deploy --only firestore:indexes         # BEFORE shipping phase 7 query
pnpm test:emulator                               # createDeal assignee + notes rules
```
Manual QA: open a deal from the board and from a stage → pipeline+stage prefilled; create a deal → owner defaults to entity assignee and is overridable; add a note on a deal → appears on the deal and in the entity notes panel with an "On deal: …" chip.
