

This is a strong evolution of Surveys — you’re essentially turning surveys into:

> **Data collection + lead generation + attribution system**

which is exactly how modern systems treat forms/surveys (Typeform + HubSpot hybrid).

You’re introducing two powerful capabilities:

1. **Survey → Entity creation (with mapping)**
2. **Survey → User attribution via assigned links**

Both fit *perfectly* into your architecture (workspace-scoped, entity-driven, automation-ready).

Let’s structure this cleanly.

---

# 1. Updated Survey Model (New Capabilities)

Surveys should now support **three modes**:

## Mode A — Analytics Only

* Collect responses
* Store in `survey_responses`
* No entity creation

## Mode B — Entity Creation

* Create entity on submission
* Map fields → entity + entity_contacts
* Trigger tags / automations

## Mode C — Hybrid

* Store response
* Optionally create entity
* Link response ↔ entity

👉 This should be controlled by a toggle:

> **“Create entity from responses”**

---

# 2. Updated Survey Creation Flow

Add a new step in survey builder:

## Step 1 — Basics

* Survey name
* Description
* Workspace
* Survey type

## Step 2 — Build Questions

(No change — existing builder)

## Step 3 — Submission Behavior (NEW)

### Toggle:

> ✅ Create entity from responses

If OFF → skip mapping
If ON → show mapping step

---

# 3. Entity Creation Mapping (NEW STEP)

## Purpose

Translate survey answers → structured entity + contacts

---

## 3.1 Minimum required mapping

You defined correctly:

### Required for entity creation:

* Entity Name
* Contact Name
* Contact Email
* Contact Phone

These must be mapped before publishing.

---

## 3.2 Mapping UI

### Layout

Two panels:

#### Left

Survey questions

#### Right

Entity fields (grouped)

---

### Entity Fields Panel

#### Entity

* Entity Name
* (Future: address, metadata, etc.)

#### Contact (entity_contacts)

* Contact Name
* Email
* Phone
* Type (optional override)
* isPrimary (default true)
* isSignatory (default true)

---

### Mapping Interaction

Example:

| Survey Question  | Map To        |
| ---------------- | ------------- |
| “Your Full Name” | Contact Name  |
| “Email Address”  | Contact Email |
| “Phone Number”   | Contact Phone |
| “School Name”    | Entity Name   |

---

## 3.3 Default behaviors

When entity is created:

```ts
entityContacts: [
  {
    name,
    email,
    phone,
    type: defaultType,
    isPrimary: true,
    isSignatory: true
  }
]
```

### Entity type

Derived from:

> workspace.contactScope

---

## 3.4 Advanced mapping (Phase 2)

Later support:

* map to custom fields
* map to tags
* conditional mapping
* multi-contact mapping (guardian, etc.)

---

# 4. Survey Assignment System (NEW)

This is a major feature — treat it like **“Survey Distribution & Attribution”**

---

## 4.1 Concept

A survey can be:

* Public (one URL)
* OR
* **Assigned to users → each gets unique URL**

---

## 4.2 Assignment toggle

In survey settings:

> Enable assignment tracking

If ON:

* survey creator can assign users
* unique URLs generated

---

## 4.3 Assign users

UI:

* Select users from workspace
* Multi-select
* Searchable

Example:

* John (Admissions)
* Sarah (Sales)
* Kofi (Admin)

---

## 4.4 Unique URLs

Base URL:

```
/survey/admissions-form
```

Assigned URLs:

```
/survey/admissions-form?ref=user_123
/survey/admissions-form?ref=user_456
```

OR better:

```
/survey/admissions-form/u/john
```

---

## 4.5 Submission attribution

Each response stores:

```ts
{
  surveyId,
  responseId,
  assignedUserId: "user_123",
  source: "assigned_link"
}
```

---

# 5. Response Analytics (Updated)

## New dimension: Assigned User

Add:

### Metrics

* responses per user
* conversion per user
* entity created per user

---

## Response list filters

Filter by:

* assigned user
* date
* tags
* entity created/not created

---

## Example view

| User  | Responses | Entities Created |
| ----- | --------- | ---------------- |
| John  | 120       | 80               |
| Sarah | 90        | 60               |

---

# 6. Notifications for Assigned Users

When assignment is enabled:

## Option:

> Notify assigned users

Channels:

* Email
* SMS

---

## Notification scenarios

### A. When assigned

“You have been assigned this survey”

### B. When response received

“New response received via your link”

### C. Daily summary (later)

“You received 12 responses today”

---

# 7. Survey Submission Flow (Final)

## User submits survey

### System flow:

1. Capture response
2. Detect `assignedUserId` (if exists)
3. Store response
4. If entity creation enabled:

   * map fields
   * create entity
   * create entity_contacts
5. Link response → entity (if created)
6. Trigger:

   * tags
   * automations
   * notifications
7. Attribute response to assigned user
8. Update analytics

---

# 8. Data Model Changes

---

## 8.1 Survey config

```ts
surveys {
  id,
  workspaceId,
  name,
  createEntity: boolean,
  entityMapping: {
    entityNameFieldId,
    contactNameFieldId,
    contactEmailFieldId,
    contactPhoneFieldId,
    additionalMappings: []
  },
  assignmentEnabled: boolean,
  assignedUsers: string[],
  notifyAssignedUsers: {
    email: boolean,
    sms: boolean
  }
}
```

---

## 8.2 Survey responses

```ts
survey_responses {
  id,
  surveyId,
  workspaceId,
  assignedUserId?: string,
  entityId?: string,
  data: {},
  createdAt
}
```

---

## 8.3 Survey assignments (optional normalized)

```ts
survey_assignments {
  id,
  surveyId,
  userId,
  uniqueSlug,
  createdAt
}
```

---

# 9. UI Pages

---

## Survey Builder (Updated)

New step:

> Submission Behavior

Sections:

* Create entity toggle
* Field mapping UI
* Assignment toggle
* Assign users
* Notifications

---

## Survey Share Page

Show:

### Public Link

### Assigned Links

List:

* User
* Link
* Copy button

---

## Survey Responses Page

Add:

* filter by assigned user
* show assigned user column
* show entity created status

---

## Survey Analytics Page

Add:

* breakdown by assigned user
* conversion per user
* leaderboard style metrics

---

# 10. What could go wrong

---

## 1. Missing required mappings

User forgets to map required fields

### Fix

Block publish until:

* entity name mapped
* contact name mapped
* email or phone mapped

---

## 2. Duplicate entities

Same person submits multiple times

### Fix (Phase 2)

* dedupe logic:

  * match by email/phone
* option:

  * create new
  * update existing

---

## 3. Invalid data mapping

Email field mapped to text question

### Fix

Field type validation:

* email → email field
* phone → phone field

---

## 4. Assigned user manipulation

User shares link incorrectly

### Fix

* signed tokens later
* track source and IP
* optional verification later

---

## 5. Overwriting contact roles

Wrong contact type used

### Fix

Default type:

* based on workspace contact type templates

---

# 11. Phase-by-Phase Implementation

---

## Phase 1 — Foundation

* add createEntity toggle
* basic field mapping
* entity + entity_contact creation
* required field validation
* response → entity linking

---

## Phase 2 — Assignment system

* assignment toggle
* assign users
* unique URLs
* store assignedUserId
* response attribution
* response filtering

---

## Phase 3 — Notifications

* notify assigned users
* email + SMS notifications
* response alerts

---

## Phase 4 — Analytics

* per-user breakdown
* conversion tracking
* dashboards

---

## Phase 5 — Advanced mapping

* custom field mapping
* conditional mapping
* multi-contact creation

---

## Phase 6 — Intelligence

* deduplication
* lead scoring
* automation triggers
* attribution analytics

---

# 12. Final positioning

This turns Surveys into:

> **Survey + Lead Capture + Attribution Engine**

It now powers:

* admissions
* onboarding
* campaigns
* field data collection
* sales attribution
* performance tracking

And integrates cleanly with:

* entity model
* entity_contacts
* automations
* messaging campaigns
* tags
* analytics

---

# Final advice

The most important things to enforce:

1. **Mapping must be explicit and validated**
2. **Assignment must be optional but powerful**
3. **Attribution must be first-class**
4. **Entity creation must be deterministic**
5. **Everything must remain workspace-scoped**

review and plan the implementation of these features in the surveys flow.

also include a step where tags and automations can be assigned, when an entity should be created. survey creator can specify which automation or tags will be associated with the newly creqted entity from the survey.

let's plan this within the scope of the app. ensure other functionalities remain intact.