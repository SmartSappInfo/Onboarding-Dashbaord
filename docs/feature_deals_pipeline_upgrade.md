# Deals & Pipeline Upgrade — Implementation Plan

> Status: Implemented — pending local verification (typecheck/lint/test)
> Owner: Engineering
> Scope: Pipeline board filtering, stage column height capping, deals list view, native `focalContacts` field, deal card redesign, downstream display fixes.

This document is the canonical implementation plan for upgrading the Deals/Pipeline experience to industry grade. It conforms to the `next-best-practices`, `vercel-react-best-practices`, `frontend-design`, and `table-filters` skills in `.agents/skills`.

---

## Goals

1. **Comprehensive filtering** — status, assignee, value range, forecast date range, and stage multi-select, with active-filter chips.
2. **Capped stage height** — columns become content-height with a scroll cap (industry-standard kanban behaviour) instead of stretching full-viewport.
3. **List view tab** — a third pipeline view: a sortable table of deals showing name, entity, focal contacts, forecast date, value, assignee, stage, status.
4. **Native `focalContacts` field** — at deal creation the user selects one or more contacts from the deal's entity (`entityContacts`) to be focal for that deal.
5. **Redesigned deal card** — deal name (clickable), focal contacts, value, forecast countdown with urgency colour (red overdue / amber due-soon / green on-track); remove Add Task, Session, and Open Deal; fix clipped borders.

---

## Architectural Notes

### Two distinct contact concepts on a Deal
- `Deal.contacts: DealContact[]` (pre-existing) — cross-**entity** associations (contacts that belong to *other* entities in the workspace). Managed by `addDealContactAction`/`removeDealContactAction`, shown in the deal detail "Contacts" tab.
- `Deal.focalContacts: DealFocalContact[]` (**new**) — focal **persons** selected from the deal's *own* entity's `entityContacts[]`.

These are intentionally separate fields and must not be conflated.

### Deal document writers (three, divergent)
- `createDeal` (`deal-actions.ts`) — builds the doc inline. `focalContacts` is set **explicitly**, not via `...rest`.
- `buildDealDocument` (`deal-writer.ts`) — utility used by automations/real-estate. `focalContacts` defaults to `[]`.
- `bulkCreateDealsAction` (`bulk-deal-actions.ts`) — bulk path, no person context, `focalContacts` stays `[]`.

Bulk creation, automation creation, and CSV import do **not** populate `focalContacts` (no person-selection context). They default to an empty array.

### Filter conflict resolution
`KanbanBoard` already reads `assignedUserId` from `GlobalFilterProvider`. The new local "Assigned To" filter **overrides** the global one when set: `effectiveAssigneeId = filters.assignedToId ?? assignedUserId`.

---

## Risk Register (summary)

| # | Risk | Resolution |
|---|---|---|
| R1 | `contacts` vs `focalContacts` confusion | Separate fields; detail page shows both distinctly (Phase 8) |
| R2 | Three divergent deal writers | Set `focalContacts` explicitly in `createDeal`; default `[]` in `deal-writer` |
| R3 | Filter type inlined in 2 places | Extract `KanbanFilters` to `pipeline-types.ts` (Phase 0) |
| R4 | Global + local assignee double-filter | Local overrides global (Phase 6) |
| R5 | `ring-1` + `overflow-hidden` border clip | Switch to `border border-border` (Phase 3) |
| R6 | `h-full` cascade vs height cap | Auto-height columns + `items-start` (Phase 4) |
| R7 | Removing `taskStats` breaks callers | Keep prop optional, stop rendering (Phase 3) |
| R8 | `entityContacts` fetch timing/null | Server action read, skeleton, empty state (Phase 5) |
| R9 | `EntityDealsTab` won't show new field | Update inline cards (Phase 8) |
| R10 | No tests for date logic | Extract `getForecastUrgency` + Vitest (Phase 0) |

---

## Phase-by-Phase Plan

### Phase 0 — Shared infrastructure (zero UI risk)
- `src/app/admin/pipeline/pipeline-types.ts` — `KanbanFilters`, `DEFAULT_FILTERS`, `isFilterActive`, `activeFilterCount`.
- `src/lib/types.ts` — add `DealFocalContact`; add optional `Deal.focalContacts`.
- `src/app/admin/pipeline/utils/deal-urgency.ts` — `getForecastUrgency()`.
- `src/app/admin/pipeline/utils/deal-urgency.test.ts` — pure Vitest coverage.

### Phase 1 — README + root cleanup
- Rewrite `README.md` to describe SmartSapp.
- Move root status `.md` files into `docs/archive/`.

### Phase 2 — Data layer
- `deal-actions.ts` — `focalContacts` on `DealCreationData`, `createDeal`, `updateDealDetailsAction`.
- `deal-writer.ts` — `focalContacts` on `WriteDealParams`, default `[]` in `buildDealDocument`.

### Phase 3 — DealCard redesign
- Remove actions hub; keep `taskStats` prop unused.
- `border border-border` (fix clipping).
- Clickable deal-name `Link` with `onPointerDown` stopPropagation.
- Forecast urgency display; focal-contact chips.

### Phase 4 — Stage column max height
- `StageColumn.tsx` — drop `h-full`, cap ScrollArea at `min(600px,70vh)`.
- `KanbanBoard.tsx` — column container `items-start`.

### Phase 5 — Focal contact picker
- `src/app/actions/entity-contact-actions.ts` — `getEntityContactsAction`.
- `CreateDealModal.tsx` — multi-select picker, skeleton/empty states, pass `focalContacts`.

### Phase 6 — Extended filters
- `PipelineClient.tsx` — `KanbanFilters` state, filter popover sections, active-filter chips, toolbar visible in board + list views.
- `KanbanBoard.tsx` — typed filters, value/date/stage clauses, assignee override.

### Phase 7 — List view tab
- `src/app/admin/pipeline/components/DealsListView.tsx` — sortable table.
- `PipelineClient.tsx` — third `list` view + switcher button.

### Phase 8 — Downstream fixes
- `deals/[id]/page.tsx` — focal contacts section + urgency on Overview.
- `EntityDealsTab.tsx` — focal-contact chips + urgency date.

---

## Iteration 2 — Deal detail restructure + inline filters

1. **Bug fix (pipeline/stage not populating)** — the deal detail page queried `pipelines`/`onboardingStages` globally (no workspace filter), which Firestore rules return empty for. Now `pipelines` is scoped `where('workspaceIds','array-contains', deal.workspaceId)`, `onboardingStages` by the selected `pipelineId`, and `users` by `array-contains` the workspace.
2. **Tabs removed** on the deal detail page. Left column = Deal Configuration + Custom Fields + Associated Contacts (Contacts is no longer a tab). Right column = Upcoming Tasks (with Add Task) then Activity Feed. Key Info (close date + urgency, created) merged into the top header card. "View Linked Entity" → "View Linked {terminology.singular}".
3. **Inline filter card** (`PipelineFilterBar.tsx`) replaces the fly-out popover above the board/list. Primary controls (search, status, owner, tags) always visible; value/date/stage behind an inline "More" disclosure (not a separate fly-out). Owners and tags are **workspace-scoped** (`users` via `workspaceIds array-contains`; `tags` via `workspaceId ==`).
4. **Tag filtering** — deals have no native tags, so a deal matches a selected tag when its linked entity's `workspaceTags` intersect. `applyDealFilters` takes an optional `getEntityTags` resolver (entity lookup) to keep the function pure/testable. `KanbanFilters.tagIds` added.

## Verification

Run locally (not run by the agent to conserve credits):

```bash
pnpm typecheck
pnpm lint
pnpm test:run src/app/admin/pipeline/utils/deal-urgency.test.ts
pnpm test:run
```

Manual QA: create a deal with focal contacts, confirm card/list/detail display, drag across stages, exercise every filter dimension, verify column scroll cap, verify borders render on all sides in light + dark themes.
