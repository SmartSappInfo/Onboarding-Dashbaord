Entity Conarct Redesign:

Yes — this is a strong direction, and it fixes a major structural problem.

The right model is:

> **No direct phone/email contact fields on the entity root**
>
> All contact identity and communication data lives in `entity_contacts`.

That gives you:

* one source of truth for contact data
* cleaner messaging variable generation
* cleaner filtering for campaigns/forms/PDFs
* better support for primary contact and signatory logic
* better fit for institution, family, and person scopes 

---

# 1. Recommended target architecture

## Entity root

The entity should keep only identity/profile data.

It should **not** store:

* `primaryPhone`
* `primaryEmail`
* `contactPhone`
* `contactEmail`
* `focalPersons`

Instead:

```ts
entities/{entityId}
{
  id,
  organizationId,
  entityType, // institution | family | person
  name,
  slug,
  ...profileData,
  entityContacts: [...],
  createdAt,
  updatedAt
}
```

You can also later split `entityContacts` into a subcollection if needed, but for now, keeping it embedded is fine unless contact counts grow large.

---

# 2. Rename `focalPersons` to `entityContacts`

## New shape

```ts
entityContacts: [
  {
    id: "ec_001",
    name: "Prosper Asamoah",
    email: "pros.asamoah@gmail.com",
    phone: "233233146361",
    type: "Owner",
    isSignatory: true,
    isPrimary: true,
    createdAt: "...",
    updatedAt: "..."
  }
]
```

## Rules

* exactly **one** `isPrimary = true`
* exactly **one** `isSignatory = true`
* the same contact may be both primary and signatory
* first contact created defaults to:

  * `isPrimary = true`
  * `isSignatory = true`

That gives you a clean, deterministic model.

---

# 3. Contact type templates by entity type

This is also the right idea.

You need default contact type definitions per entity type, with overrides at org/workspace level.

## Example defaults

### Institution

* Manager
* Accountant
* Owner
* Administrator
* Billing Officer

### Family

* Father
* Mother
* Guardian
* Emergency Contact

### Person

* Personal
* Home
* Office
* Assistant

---

# 4. Recommended configuration model

You need three levels:

## System defaults

Base defaults shipped with the app.

## Organization defaults

Superadmin can customize for the organization.

## Workspace overrides

Workspace/org admin can further refine for a workspace if needed.

## Example config

```ts
contact_type_templates/{scopeId}
{
  scopeType: "system" | "organization" | "workspace",
  organizationId?: "org_1",
  workspaceId?: "workspace_1",
  entityType: "institution" | "family" | "person",
  types: [
    { key: "manager", label: "Manager", active: true, order: 1 },
    { key: "accountant", label: "Accountant", active: true, order: 2 },
    { key: "owner", label: "Owner", active: true, order: 3 }
  ],
  updatedAt,
  updatedBy
}
```

## Merge behavior

When rendering available types:

1. start with system defaults
2. apply organization override
3. apply workspace override

This keeps it flexible without losing a clean base.

---

# 5. Variable generation architecture

This is the most important downstream effect.

Your variable system should no longer treat contacts as hardcoded fields. It should generate variables dynamically from `entityContacts`.

That is much better than fixed variables.

## Role/type-based variables

If entity type is institution and contact type is `Manager`, generate:

```txt
{{contact_name_manager}}
{{contact_email_manager}}
{{contact_phone_manager}}
{{contact_role_manager}}
{{contact_isSignatory_manager}}
{{contact_isPrimary_manager}}
```

If type is `Accountant`:

```txt
{{contact_name_accountant}}
{{contact_email_accountant}}
{{contact_phone_accountant}}
{{contact_role_accountant}}
{{contact_isSignatory_accountant}}
{{contact_isPrimary_accountant}}
```

If family type is `Father`:

```txt
{{contact_name_father}}
{{contact_email_father}}
{{contact_phone_father}}
{{contact_role_father}}
{{contact_isSignatory_father}}
{{contact_isPrimary_father}}
```

## Signatory variables

Global special-purpose variables:

```txt
{{contact_name_signatory}}
{{contact_email_signatory}}
{{contact_phone_signatory}}
{{contact_role_signatory}}
```

## Primary variables

Also:

```txt
{{contact_name_primary}}
{{contact_email_primary}}
{{contact_phone_primary}}
{{contact_role_primary}}
```

This is exactly the right abstraction for:

* messaging
* campaigns
* PDF templates
* document signing flows
* page builder
* automation actions

---

# 6. Important normalization rule

Variable keys must be normalized.

Example:

* `Billing Officer` → `billing_officer`
* `School Owner` → `school_owner`
* `Home Contact` → `home_contact`

So always generate variables from a normalized key, not raw label text.

## Example

```ts
normalizeContactType("Billing Officer") => "billing_officer"
```

Then variables become:

```txt
{{contact_email_billing_officer}}
{{contact_phone_billing_officer}}
```

This avoids broken variable names.

---

# 7. What could go wrong if implemented badly

## A. Multiple primaries or signatories

If not enforced, filters and variables become ambiguous.

### Fix

At write-time:

* setting one contact `isPrimary = true` must unset all others
* setting one contact `isSignatory = true` must unset all others

## B. Type labels change and variables break

If user renames `Manager` to `Operations Manager`, old templates could break.

### Fix

Each contact type needs:

* stable `key`
* editable `label`

Example:

```ts
{ key: "manager", label: "Manager" }
```

Variables use `key`, UI uses `label`.

Never build variables from mutable display labels.

## C. Missing contact type values

A contact without type breaks role-based variables.

### Fix

Require type on every contact.
For person scope, default to `personal`.

## D. Multiple contacts of same type

What if there are two `Guardian` contacts or two `Manager` contacts?

This is a major design question.

### Recommended answer

For V1:

* allow multiple contacts of same type if needed
* but role-based variables resolve to the **first matching active contact** by deterministic order

Better yet:

* store an `order` field
* first matching by order wins

Example:

```ts
entityContacts sorted by order ASC
```

Then:
`{{contact_email_guardian}}` resolves to first guardian.

Later you can support indexed/multi-value role variables if needed.

## E. Legacy root fields remain in use

Developers may keep reading entity root phone/email out of habit.

### Fix

Deprecate and remove root contact fields completely after migration.
Add linting/schema validation and service-layer guards.

---

# 8. FER protocol — refactor and migration plan

I’ll treat “FER protocol” as a formal engineering refactor/migration protocol.

## FER-01: Contact Model Refactor Protocol

### Objective

Move all contact communication fields from legacy entity root / `focalPersons` into `entityContacts`, and establish primary/signatory/type-driven variable generation.

---

## Phase A — Preparation

### A1. Define canonical `entityContacts` schema

```ts
type EntityContact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: string;       // stable key preferred in storage
  label?: string;     // optional display label if needed
  isPrimary: boolean;
  isSignatory: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
};
```

### A2. Define contact type template collections

Create:

* system defaults
* org overrides
* workspace overrides

### A3. Define variable resolution layer

Refactor variable engine to read from:

* `entityContacts`
* contact type template keys
* `isPrimary`
* `isSignatory`

Do this before UI rollout if possible.

### A4. Audit all code paths

Find all places using:

* `focalPersons`
* `primaryPhone`
* `primaryEmail`
* direct `contactPhone`
* direct `contactEmail`

Affected areas likely include:

* messaging
* campaigns
* PDF variable injection
* forms mapping
* entity details page
* automations
* filters
* exports/imports

---

## Phase B — Introduce backward-compatible support

### B1. Add `entityContacts` to entity schema

Do not remove old fields yet.

### B2. Add adapter layer

Anywhere old code reads contact data, temporarily resolve through:

```ts
getEntityPrimaryContact(entity)
getEntitySignatoryContact(entity)
getEntityContactByType(entity, typeKey)
```

This prevents direct field dependence.

### B3. Seed contact type templates

Seed defaults for:

* institution
* family
* person

System-level first, then org/workspace override UI later.

---

## Phase C — Data migration

### C1. Migrate `focalPersons` → `entityContacts`

Transform each entry:

#### Before

```json
{
  "name": "Prosper Asamoah",
  "email": "pros.asamoah@gmail.com",
  "phone": "233233146361",
  "type": "School Owner",
  "isSignatory": true
}
```

#### After

```json
{
  "id": "generated_id",
  "name": "Prosper Asamoah",
  "email": "pros.asamoah@gmail.com",
  "phone": "233233146361",
  "type": "school_owner",
  "label": "School Owner",
  "isSignatory": true,
  "isPrimary": true,
  "order": 0
}
```

### C2. Mark all signatories as primary

Per your rule, foundation migration should mark existing signatories as primary.

#### Migration rule

* if one contact has `isSignatory = true`, set same contact `isPrimary = true`
* unset `isPrimary` for all others
* if no signatory exists, set first contact as both primary and signatory
* if multiple signatories exist from bad legacy data:

  * keep first by order as signatory and primary
  * unset others
  * write migration warning log

### C3. Normalize type keys

Examples:

* `"School Owner"` → `school_owner`
* `"Champion"` → `champion`
* `"Father"` → `father`

Store both:

* `typeKey`
* `typeLabel`

Prefer this final structure:

```ts
typeKey: "school_owner"
typeLabel: "School Owner"
```

### C4. Remove root contact fields from new writes

After migration, all new entity writes must stop writing:

* root email/phone
* focalPersons

---

## Phase D — Switch application reads

### D1. Update all UI

Replace focal person UI with entity contacts UI.

### D2. Update filters

Add filters for:

* contact type
* isPrimary
* isSignatory
* contact has email
* contact has phone

### D3. Update variable picker

Show variables grouped:

#### Contact Types

* `contact_name_manager`
* `contact_email_manager`

#### Primary Contact

* `contact_name_primary`
* `contact_phone_primary`

#### Signatory Contact

* `contact_name_signatory`
* `contact_email_signatory`

### D4. Update message/campaign/template rendering

Variable resolution must now come from `entityContacts`.

---

## Phase E — Cleanup

### E1. Remove legacy fields

Once all reads and writes are migrated:

* remove `focalPersons`
* remove any direct root contact fields

### E2. Add schema validation

Reject new writes containing legacy root contact fields.

### E3. Add audit checks

Scheduled validation to flag:

* zero primary contacts
* zero signatories
* multiple primaries
* multiple signatories
* contacts without typeKey

---

# 9. Seeding protocol

## Seed 1: System contact types

Create base defaults.

### Institution

* manager
* accountant
* owner
* administrator
* billing_officer

### Family

* father
* mother
* guardian
* emergency_contact

### Person

* personal
* home
* office
* assistant

## Seed 2: Existing entity type mapping

When migrating existing data:

* infer entity type
* map focal person labels to closest normalized keys

### Example mapping table

* `School Owner` → `owner`
* `Owner` → `owner`
* `Champion` → `champion`
* `Father` → `father`

Where no mapping exists:

* create custom type in workspace/org override set if needed
* or fallback to `other`

---

# 10. UI changes needed

## Entity detail page

Replace “Focal Persons” with **Entity Contacts**

### Features

* add contact
* edit contact
* reorder contacts
* set as primary
* set as signatory
* change type
* filter by type
* enforce one primary / one signatory

## Contact type settings page

Workspace/org admins can:

* view defaults by entity type
* add type
* rename label
* disable type
* reorder types

## Variable reference page

Grouped by:

* entity fields
* entity contact by role/type
* primary contact
* signatory contact

---

# 11. Best-fit implementation recommendation

## Store contacts embedded first

For now:

```ts
entities/{id}.entityContacts[]
```

This keeps migration simpler and aligns with your current embedded `focalPersons` pattern.

## Use stable keys

Store:

* `typeKey`
* `typeLabel`

Do not store only raw `type`.

## Build resolver helpers

Everything should read through helpers:

```ts
getPrimaryContact(entity)
getSignatoryContact(entity)
getContactByType(entity, typeKey)
getContactVariables(entity)
```

This will make messaging, campaigns, PDFs, and filters much easier to maintain.

---

# 12. Phase-by-phase implementation plan

## Phase 1 — Foundation

* define `entityContacts` schema
* define type template schema
* seed system defaults
* create resolver helpers
* add UI for entity contacts
* add primary/signatory enforcement

## Phase 2 — Migration

* migrate `focalPersons` → `entityContacts`
* mark signatories as primary
* normalize type keys
* log migration issues
* stop new writes to legacy fields

## Phase 3 — Variable system overhaul

* move messaging variable logic to field/contact variable engine
* add dynamic role/type variables
* add primary/signatory variables
* update variable pickers in messaging/PDF/templates/campaigns

## Phase 4 — Filters and campaigns

* add contact-type filters
* primary/signatory filters
* targeting by role + tag combinations
* manual contact selection improvements

## Phase 5 — Admin customization

* org superadmin default type templates
* workspace/org admin overrides
* type management UI
* seeded/custom merge logic

## Phase 6 — Cleanup and enforcement

* remove legacy `focalPersons`
* remove root contact fields
* add schema guards
* add validation/audit jobs

---

# 13. Final advice

This fits very well with your architecture.

The most important things to preserve are:

1. **All contact channels live only in `entityContacts`**
2. **Primary and signatory are explicit flags**
3. **Exactly one primary and one signatory**
4. **Contact type variables are generated from stable keys, not labels**
5. **Messaging/templates/PDFs/campaigns must resolve contacts through helpers, never direct fields**
6. **Migrate signatories to primary as the baseline**
7. **Deprecate and remove root-level contact fields completely**

That gives you a much cleaner CRM foundation and a far better variable system.

I can turn this next into a **concrete Firestore schema, migration script plan, and TypeScript interfaces** for `entityContacts`, contact type templates, and variable generation.