# Geographic Zone — "Unassigned" Default Plan

> **Status:** Implementation complete (Phases 0–12); Phase 13 backfill deferred. Pending local build/test/lint + commits.
> **Date:** 2026-06-23
> **Author:** Joseph Aidoo
> **Scope:** Make "Unassigned" the universal default for geographic zones — on import, entity creation, entity edit, and bulk upload. Null or blank zone values are treated as "Unassigned" everywhere. No data is deleted; all changes are additive or defensive defaults.

---

## Problem Statement

Geographic zones currently default to `null` when not explicitly assigned. This causes:

1. **Silent chart exclusion** — `report-actions.ts` line 49 skips `null`-zone entities entirely (`if (!zoneId) continue`), so zone health charts always undercount.
2. **Inconsistent UI labels** — Five components show three different fallback strings: `'Global'`, `'Unassigned Zone'`, and `'Unassigned'`.
3. **Import data loss** — Bulk upload and AI normalization fall back to `null` on zone miss; no indication to the user that the field was unmapped.
4. **Broken messaging context** — `{{zone_name}}` template variable is empty only by accident; no explicit contract.
5. **Dashboard gaps** — Zone distribution charts exclude unassigned entities, hiding the true scope of unmapped records.

---

## Scope — 14 Touch Points

The original plan identified 6. A full audit found 14:

| # | File | Nature | Status |
|---|------|--------|--------|
| 1 | `src/lib/zone-constants.ts` | New constants + pure helpers (incl. `withUnassignedZone`) | ✅ Done |
| 2 | `src/lib/types.ts` | (No change — virtual sentinel needs no `isSystem` doc flag) | ✅ Done |
| 3 | `src/lib/__tests__/zone-constants.test.ts` | Unit tests for helpers | ✅ Done |
| 4 | `src/lib/organization-actions.ts` | (No seed — Unassigned is virtual, not a per-org doc) | ✅ Done |
| 6 | `src/app/admin/entities/components/ZoneSelect.tsx` | Pin Unassigned first, handle null value, add animation | ✅ Done |
| 7 | `src/app/admin/entities/[id]/edit/page.tsx` | Default zone to Unassigned on form init + submit | ✅ Done |
| 8 | `src/app/admin/entities/new/page.tsx` | Eliminate `any` types, default zone, **fix zone-drop bug** | ✅ Done |
| 9 | `src/lib/entity-actions.ts` | Guarantee Unassigned on create + update (both zone paths) | ✅ Done |
| 10 | `src/lib/bulk-upload-actions.ts` | Fallback to Unassigned on fuzzy-match miss (3 locations) | ✅ Done |
| 11 | `src/ai/flows/bulk-normalization-flow.ts` | Remove nullable zoneId, default to sys-unassigned | ✅ Done |
| 12 | `src/lib/reports/report-actions.ts` + `dashboard.ts` + `dashboard-server.ts` + `ReportsClient.tsx` | Include Unassigned entities in zone charts | ✅ Done |
| 13 | `src/lib/contact-adapter.ts` (+ `messaging-engine.ts`/`messaging-actions.ts` already handle `|| ''`) | `zone_name` var = `''` for Unassigned (not the word "Unassigned") | ✅ Done |
| 14 | `src/lib/contacts/contact-projection-domain.ts` (+ test) | `zoneIdOf` returns `sys-unassigned` not null; `ContactDoc.zoneId` non-nullable | ✅ Done |
| 15 | `src/app/admin/entities/components/EntityCard.tsx` | Normalize label to "Unassigned" | ✅ Done |
| 16 | `src/app/admin/entities/components/entity-details-modal.tsx` | Normalize label to "Unassigned", rename "Territory"→"Geographic Zone" | ✅ Done |
| 17 | `src/app/admin/finance/contracts/ContractsClient.tsx` | Normalize label to "Unassigned" | ✅ Done |
| 18 | `src/app/admin/entities/[id]/page.tsx` | Use `UNASSIGNED_ZONE.name` constant | ✅ Done |
| 19 | `src/app/admin/entities/imports/components/DuplicateResolutionPortal.tsx` | Default zone to Unassigned on import conflict | ✅ Done |
| 20 | `src/app/actions/backfill-unassigned-zones-action.ts` | Operator-triggered backfill — **deferred** (reads tolerate null via `?? UNASSIGNED_ZONE.id`, so optional) | ⬜ Deferred |
| — | `ActivitiesClient.tsx` zone filter | Skipped — filter is a documented non-functional placeholder (ActivityTimeline.tsx:85) | ⏭️ N/A |

---

## Key Design Decisions

### 1. Virtual sentinel — NOT a Firestore document
`UNASSIGNED_ZONE = { id: 'sys-unassigned', name: 'Unassigned' }` is a single global constant. It is **not** seeded as a per-org Firestore doc.

**Why not a doc:** the `zones` collection is shared across all organizations, distinguished by an `organizationId` field with random doc IDs. A fixed doc ID (`sys-unassigned`) can only exist once per collection globally — so the second org to provision would overwrite the first org's `organizationId`, breaking the first org's `where('organizationId','==',...)` zone queries. Entities store the constant `{id,name}` directly; surfaces that enumerate zones inject the sentinel via `withUnassignedZone()`.

### 2. No `isSystem` flag needed
Because "Unassigned" is virtual (never a doc), it never appears in the zone-management/edit UI, so it cannot be deleted or renamed by users — no flag or security rule required.

### 3. `{{zone_name}}` messaging variable renders empty string
`zoneDisplayName()` returns `''` for `sys-unassigned`. This preserves the previous behaviour in outbound SMS/email — recipients never see the word "Unassigned" in their messages.

### 4. Reports show "Unassigned" bucket
After Phase 5 (reports fix), entities with null zones appear in zone health charts under the "Unassigned" bucket. This surfaces previously hidden data and is intentional.

### 5. ZoneSelect ordering
The Firestore query `orderBy('name', 'asc')` sorts "Unassigned" into position U. The component manually prepends it as the first option, separate from the Firestore list.

### 6. No immediate backfill
Existing Firestore entities with `zone: null` are NOT updated as part of this plan. A deferred operator-triggered action (Phase 13) handles that separately after Phases 0–12 have been live and validated.

---

## Architecture — Dependency Graph

```
Phase 0 (constants + types)             ← must be first, everything imports from here
    │
    ├── Phase 1 (org seeding)           ← independent, can run parallel with Phase 2
    │
    ├── Phase 2 (ZoneSelect UI)         ← reads from Phase 0 constants
    │       │
    │       ├── Phase 3 (edit form)     ← imports ZoneSelect
    │       └── Phase 4 (new entity)   ← imports ZoneSelect, fixes any[] types
    │               │
    │               └── Phase 5 (entity-actions backend)   ← write path
    │                       │
    │                       ├── Phase 6 (bulk-upload)      ← parallel with Phase 7
    │                       └── Phase 7 (AI flow)          ← parallel with Phase 6
    │
    ├── Phase 8 (reports + dashboard)   ← independent after Phase 0
    ├── Phase 9 (messaging variables)   ← independent after Phase 0
    └── Phase 10 (contact projection)  ← independent after Phase 0
            │
            ├── Phase 11 (display normalization)   ← parallel, no dependencies
            ├── Phase 12 (DuplicateResolutionPortal)
            └── Phase 13 (backfill)    ← deferred, operator-triggered
```

---

## Phase-by-Phase Implementation

---

### ✅ Phase 0 — Foundation: Constants & Types
**Files:**
- `src/lib/zone-constants.ts` *(new)*
- `src/lib/types.ts`
- `src/lib/__tests__/zone-constants.test.ts` *(new)*

**What was done:**
- Created `UNASSIGNED_ZONE = { id: 'sys-unassigned', name: 'Unassigned' }` constant
- Created `ZoneRef` type: `{ id: string; name: string }`
- Created three pure, testable helpers:
  - `zoneOrUnassigned(zone)` — returns zone if valid, else `UNASSIGNED_ZONE`. Never returns null.
  - `isUnassignedZone(zone)` — true if null, undefined, empty id, or sys-unassigned id
  - `zoneDisplayName(zone)` — returns `''` for Unassigned (safe for message templates)
- Added `isSystem?: boolean` to the `Zone` interface in `types.ts`
- Wrote 14 unit tests covering null, undefined, empty string, whitespace, sys-unassigned, and real zone inputs

**Git commit:** `feat(zones): add UNASSIGNED_ZONE constant, ZoneRef type, and zone utility helpers`

---

### ✅ Phase 1 — Virtual Sentinel Helper (revised)
**Files:**
- `src/lib/zone-constants.ts` (added `withUnassignedZone()`)
- `src/lib/__tests__/zone-constants.test.ts` (added 6 tests)
- `src/lib/organization-actions.ts` (reverted — no per-org seed)

**Design correction:** The original plan seeded a per-org Firestore doc with a fixed ID. That collides because the `zones` collection is shared across orgs (see Key Design Decision #1). Reverted to a **virtual sentinel** approach: no Firestore doc; instead a generic `withUnassignedZone<T>(zones)` helper prepends the sentinel to any zone list for display/aggregation surfaces. Generic over the zone shape so callers keep their own type (no `any`).

**No separate seed/backfill-for-orgs action needed** — there is nothing to seed.

**Git commit:** `feat(zones): add withUnassignedZone helper, treat Unassigned as virtual sentinel`

---

### ⬜ Phase 2 — ZoneSelect Component
**File:** `src/app/admin/entities/components/ZoneSelect.tsx`

**Changes:**
- Type zones as `Zone[]`, remove implicit `any`
- Normalize incoming `value`: `const resolved = zoneOrUnassigned(value)` — null/undefined shows as Unassigned selected
- Render "Unassigned" as first `<SelectItem>` (hardcoded, not from Firestore list)
- Remaining zones render from Firestore in alphabetical order below it
- `onValueChange` handler: if `id === UNASSIGNED_ZONE.id`, call `onValueChange(UNASSIGNED_ZONE)` directly
- Apply Emil animations on trigger: `transition-all duration-[150ms] ease-out active:scale-[0.97] active:duration-[100ms]`

**Why this ordering matters:** Firestore `orderBy('name', 'asc')` places "Unassigned" at the bottom alphabetically. It must be pinned first.

**Git commit:** `feat(zones): ZoneSelect pins Unassigned first, normalizes null value, adds press animation`

---

### ⬜ Phase 3 — Entity Edit Form
**File:** `src/app/admin/entities/[id]/edit/page.tsx`

**Changes:**
- Zod schema: change `zone` from required with `required_error` to optional with `zoneOrUnassigned` transform, so entities without zones load without validation errors
- Form `defaultValues`: add `zone: UNASSIGNED_ZONE`
- Form init `useEffect`: `zone: zoneOrUnassigned(entityData.location?.zone)`
- Submit payload `location.zone`: already written from `data.zone` which is now guaranteed non-null by the Zod transform

**Git commit:** `feat(zones): entity edit form defaults zone to Unassigned on init and submit`

---

> **Bug found & fixed during Phase 4:** The new-entity form built its submit payload's
> `location` from `data.location` only (country/region/district), while `zone` was a
> separate top-level form field never merged in — so the selected zone was **silently
> dropped on every entity creation**. Fixed by merging `zone: zoneOrUnassigned(data.zone)`
> into the location object. This means previously, ALL new entities were created with no
> zone; this plan corrects that.

### ✅ Phase 4 — Entity New Page
**File:** `src/app/admin/entities/new/page.tsx`

**Changes:**
- `useCollection<any>` → `useCollection<Zone>` (import `Zone` from types)
- `zones.find((z: any) =>` → `zones.find((z: Zone) =>`
- `matchedModules: any[]` → `matchedModules: Array<{ id: string; name: string; abbreviation: string; color: string }>`
- `modules.find((m: any) =>` → `modules.find((m: Module) =>` (import `Module` type)
- Form `defaultValues`: add `zone: UNASSIGNED_ZONE`
- AI zone matching: when no zone found, set `UNASSIGNED_ZONE` instead of leaving field unset

**Git commit:** `feat(zones): remove any[] types from new entity page, default zone to Unassigned`

---

### ⬜ Phase 5 — Entity Actions (backend write paths)
**File:** `src/lib/entity-actions.ts`

**Changes — createEntity (line ~436):**
```ts
zone: zoneOrUnassigned(data.location?.zone),
```

**Changes — updateEntity (line ~729):**
```ts
weUpdate.zone = zoneOrUnassigned(data.location?.zone);
```

**Note:** `WorkspaceEntity` stores zone in two places — `zone` (root, legacy) and `location.zone` (new). Both must be written. The `location` object write at line ~431 already passes `data.location` through; the `zone` root field at line ~436 needs the `zoneOrUnassigned` guard added.

**Git commit:** `fix(zones): guarantee Unassigned zone on entity create and update — no null zone writes`

---

### ⬜ Phase 6 — Bulk Upload Actions
**File:** `src/lib/bulk-upload-actions.ts`

**Three locations to update:**

Line ~751 (new entity creation):
```ts
// Before
zone: selectedZone ? { id: selectedZone.id, name: selectedZone.name } : null,
// After
zone: zoneOrUnassigned(selectedZone),
```

Line ~1009 (second entity creation path):
```ts
zone: zoneOrUnassigned(selectedZone),
```

Lines ~1670–1671 (existing entity update):
```ts
existingEntity.location.zone = zoneOrUnassigned(selectedZone);
existingEntity.zone = zoneOrUnassigned(selectedZone);
```

No change needed to the context fetch — once Phase 1 is live, the Unassigned zone document exists in Firestore and is fetched automatically.

**Git commit:** `fix(zones): bulk upload falls back to Unassigned zone on fuzzy-match miss`

---

### ⬜ Phase 7 — AI Normalization Flow
**File:** `src/ai/flows/bulk-normalization-flow.ts`

**Changes:**
- `zoneId` output schema: `z.string().nullable()` → `z.string().default(UNASSIGNED_ZONE.id)`
- Prompt addition under FUZZY MATCHING RULES:
  > **Zone**: If no zone from the context matches confidently, set `zoneId` to `"sys-unassigned"`. Never return null or omit the field.
- Import `UNASSIGNED_ZONE` at top of file

**Git commit:** `feat(zones): AI normalization defaults to sys-unassigned zone, removes nullable zoneId`

---

### ⬜ Phase 8 — Reports & Dashboard (fix silent exclusion)
**Files:**
- `src/lib/reports/report-actions.ts`
- `src/lib/dashboard.ts`
- `src/lib/dashboard-server.ts`

**`report-actions.ts` — the live bug:**
```ts
// Before (line 49) — silently drops null-zone entities from charts
const zoneId = p.zone?.id;
if (!zoneId) continue;

// After — unassigned entities counted under sys-unassigned bucket
const zoneId = p.zone?.id ?? UNASSIGNED_ZONE.id;
```

**`dashboard.ts` and `dashboard-server.ts`:**
```ts
// Before
const entitiesInZone = entities.filter((we) => we.zone?.id === zone.id);

// After — matches both null/undefined entities and explicit sys-unassigned
const entitiesInZone = entities.filter(
  (we) => (we.zone?.id ?? UNASSIGNED_ZONE.id) === zone.id
);
```

**Side effect (intentional):** Zone health charts now show an "Unassigned" bucket revealing how many entities haven't been mapped to a zone. This is accurate data previously hidden.

**Git commit:** `fix(zones): include Unassigned entities in zone health reports and dashboard charts`

---

### ⬜ Phase 9 — Messaging Variables
**Files:**
- `src/lib/contact-adapter.ts`
- `src/lib/messaging-engine.ts`
- `src/lib/messaging-actions.ts`

**Decision:** `{{zone_name}}` in templates must **not** render the word "Unassigned" in outbound messages. `zoneDisplayName()` returns `''` for `sys-unassigned`.

**`contact-adapter.ts` (line 154):**
```ts
// Before
zoneName: entity.location?.zone?.name || (entity as any).zone?.name,

// After — uses zoneDisplayName() which returns '' for Unassigned
zoneName: zoneDisplayName(entity.location?.zone ?? (entity as LegacyEntity).zone),
```

`messaging-engine.ts` (line 195) and `messaging-actions.ts` (line 1282) both already use `contact.zoneName || ''` — no change needed once contact-adapter is fixed.

**Git commit:** `fix(zones): zone_name messaging variable returns empty string for Unassigned zone`

---

### ⬜ Phase 10 — Contact Projection
**File:** `src/lib/contacts/contact-projection-domain.ts`

**`zoneIdOf` function (line 159):**
```ts
// Before — returns null for entities without zone
function zoneIdOf(we: WorkspaceEntity): string | null {
  return we.zone?.id ?? we.location?.zone?.id ?? null;
}

// After — returns sys-unassigned, enabling clean type (string not string | null)
function zoneIdOf(we: WorkspaceEntity): string {
  return we.zone?.id ?? we.location?.zone?.id ?? UNASSIGNED_ZONE.id;
}
```

**`ContactDoc.zoneId` type (line 55):**
```ts
// Before
zoneId: string | null;

// After
zoneId: string;
```

**Note:** `AudienceSegment.zoneId` stays `string | null` — the value `null` there means "no filter applied" (the `'all'` state), which is a different concept from the zone sentinel.

**Git commit:** `refactor(zones): zoneIdOf always returns string, ContactDoc.zoneId non-nullable`

---

### ⬜ Phase 11 — Display Component Normalization
**Files:**
- `src/app/admin/entities/components/EntityCard.tsx` (line 164) — shows `'Global'`
- `src/app/admin/entities/components/entity-details-modal.tsx` (line 165) — shows `'Global'`, label says "Territory"
- `src/app/admin/finance/contracts/ContractsClient.tsx` (line 436) — shows `'Unassigned Zone'`
- `src/app/admin/entities/[id]/page.tsx` (line 323) — already shows `'Unassigned'` ✅

**All updated to:**
```ts
entity.location?.zone?.name ?? entity.zone?.name ?? UNASSIGNED_ZONE.name
```

**Label "Territory" in entity-details-modal** updated to "Geographic Zone" to match the rest of the app.

**Git commit:** `fix(zones): normalize fallback zone label to "Unassigned" across all entity display components`

---

### ⬜ Phase 12 — DuplicateResolutionPortal
**File:** `src/app/admin/entities/imports/components/DuplicateResolutionPortal.tsx`

**Line 166 — zone resolution fallback:**
```ts
// Before
zone: get('zone') || payload.Zone || payload.zone || defaultValues['zone'] || '',

// After
zone: get('zone') || payload.Zone || payload.zone || defaultValues['zone'] || UNASSIGNED_ZONE.name,
```

**Line 1036 — zone display in conflict UI:**
```ts
// Before
return ... || '';

// After
return ... || UNASSIGNED_ZONE.name;
```

**Git commit:** `fix(zones): DuplicateResolutionPortal defaults zone to Unassigned on import conflict`

---

### ⬜ Phase 13 — Backfill (deferred, operator-triggered)
**File:** `src/app/actions/seed-unassigned-zone-action.ts` *(new)*
**File:** `src/app/actions/backfill-unassigned-zones-action.ts` *(new)*

**Deploy timing:** Run 2–4 weeks after Phases 0–12 have been live and validated.

**`seed-unassigned-zone-action.ts`:**
- Admin-only server action
- Iterates all organizations in Firestore
- For each org: checks if `zones/sys-unassigned` doc exists scoped to that org
- Creates it with `{ merge: true }` where missing
- Returns `{ seeded: number, skipped: number }`

**`backfill-unassigned-zones-action.ts`:**
- Admin-only server action, org-scoped
- Queries all `workspace_entities` where `zone == null` OR `zone.id == ''`
- Batch-updates `zone = UNASSIGNED_ZONE` and `location.zone = UNASSIGNED_ZONE` (max 500 per batch)
- Re-projects contacts via `syncContactProjectionForWE` for each affected entity
- Returns `{ updated: number, errors: string[] }` for audit trail

**Git commit:** `feat(zones): add operator-triggered seed and backfill actions for Unassigned zone`

---

## What Could Go Wrong

| Risk | Mitigation |
|------|-----------|
| `fuzzyMatch` against `sys-unassigned` in bulk upload returns wrong zone | Unassigned is NOT passed to `fuzzyMatch()` — it's only the fallback *after* fuzzyMatch returns null |
| User deletes the "Unassigned" zone doc in Firestore | `isSystem: true` flag; zone management UI must check flag before allowing delete |
| `{{zone_name}}` renders "Unassigned" in sent messages | `zoneDisplayName()` explicitly returns `''` for `sys-unassigned` — tested in Phase 0 |
| Reports show unexpected "Unassigned" bucket after Phase 8 | Intentional — it shows unmapped entities. Document as a feature for ops team |
| Duplicate "Unassigned" zone docs per org if seeding runs twice | `doc(UNASSIGNED_ZONE.id)` + `{ merge: true }` — idempotent by design |
| `ContactDoc.zoneId` becomes non-nullable — breaks callers expecting `null` | `AudienceSegment.zoneId` stays nullable (different concept). Only `ContactDoc` changes |
| AI normalization returns `sys-unassigned` for zones it could have matched | Prompt instructs AI to try matching first; `sys-unassigned` is only for confident misses |

---

## Safety Guarantees

- No existing zone document is deleted or renamed
- No existing entity's zone is changed until the opt-in Phase 13 backfill runs
- All write-path changes are defensive defaults (`?? UNASSIGNED_ZONE`) — they only fire when zone is null/undefined
- Each phase is a self-contained git commit, independently revertable
- `UNASSIGNED_ZONE.id` is a fixed string — no random IDs that can't be looked up later

---

## Testing Checklist

Run after each phase:

- [ ] `pnpm test src/lib/__tests__/zone-constants.test.ts` — Phase 0 pure helpers
- [ ] Create a new organization → verify `zones/sys-unassigned` doc exists in Firestore
- [ ] Open ZoneSelect with `value=null` → "Unassigned" shown as selected, pinned at top of list
- [ ] Create entity with no zone selected → Firestore doc has `zone.id === 'sys-unassigned'`
- [ ] Edit entity with null zone → form loads without validation error, shows "Unassigned"
- [ ] Bulk import with no zone column → all rows get `zone.id === 'sys-unassigned'`
- [ ] Zone health chart → entities with sys-unassigned appear in "Unassigned" bucket
- [ ] Send test SMS to entity with Unassigned zone → `{{zone_name}}` renders empty string, not "Unassigned"
- [ ] EntityCard, entity detail modal, contracts list → all show "Unassigned" (not "Global" or "Unassigned Zone")
- [ ] Import duplicate resolution → zone field defaults to "Unassigned" when blank
