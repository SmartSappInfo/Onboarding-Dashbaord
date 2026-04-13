Absolutely. This should become a **workspace-scoped Forms app** with three tightly connected parts:

1. **Fields Manager**
2. **Form Builder**
3. **Form Delivery + Submission Actions**

And yes — moving variable management out of Messaging and into **Fields Management** is the right move. Variables should come from structured fields, not be managed as a separate messaging-only concept.

---

# Product Requirements Document

## SmartSapp Forms

### Workspace-Scoped Form Builder for CRM, Campaigns, Automations, and Data Capture

---

# 1. Product vision

SmartSapp Forms is a workspace-scoped form system that allows users to:

* manage native and custom fields
* build professional forms visually
* bind forms to workspace contact scope or make them global
* collect structured submissions
* trigger tags, automations, notifications, and webhooks
* share forms via hosted link, embed code, or full HTML
* reuse field variables across messaging, automations, campaigns, and CRM

This should feel like a blend of:

* Kartra forms
* ActiveCampaign forms
* a simplified survey builder
* CRM field mapping
* automation triggers

But adapted to your:

* multi-organization
* multi-workspace
* workspace contact scope architecture

---

# 2. Core principle

## Forms belong to workspaces, not organizations

That is the correct model.

Reason:

* workspaces define contact scope
* fields used by forms are operationally tied to workspace workflows
* submissions are usually collected into workspace-specific processes
* automations, tags, and notifications are generally workspace-contextual

So the rule is:

> A form is always created inside a workspace.

It may:

* create/update workspace entities
* be marked as global in purpose/usage
* be embedded anywhere externally

But its configuration, fields, tags, automations, and submission handling remain **workspace-scoped**.

---

# 3. Product goals

## Business goals

* make SmartSapp a true data capture layer for CRM and campaigns
* reduce dependency on third-party form tools
* unify fields, variables, messaging, automations, and forms
* improve conversion, onboarding, admissions, and lead capture workflows

## Product goals

* simple enough for non-technical users
* structured enough for clean data capture
* extensible enough for CRM and automation workflows
* professional-looking forms by default
* easy to embed and share
* autosaved and recoverable
* undo/redo supported

---

# 4. Main modules

## A. Fields Manager

For native fields, custom fields, variables, grouping, and data structure.

## B. Forms Builder

For building, styling, structuring, and publishing forms.

## C. Form Delivery & Submission Logic

For links, embeds, HTML export, tags, automations, notifications, webhooks, and submission storage.

---

# 5. Workspace context and scope rules

Each workspace already has a `contactScope`:

* institution
* family
* person

Forms should respect that.

## That means:

If workspace scope is `institution`, bound forms should use institution-compatible fields.
If workspace scope is `family`, bound forms should use family-compatible fields.
If workspace scope is `person`, bound forms should use person-compatible fields.

## Two form modes

### 1. Bound form

Form is explicitly tied to the workspace contact scope and can:

* create/update workspace entities
* apply tags to those entities
* trigger scoped automations
* map fields into workspace data model

### 2. Global form

Form is not tied to a specific entity creation flow by default.
It can still:

* collect submissions
* trigger notifications
* trigger webhooks
* trigger automations
* later map data manually or via automation

This is useful for:

* generic interest forms
* waitlists
* support requests
* event registrations
* campaign contact forms

---

# 6. Fields Manager

This is the foundation.

## 6.1 Why it matters

Right now variable management living under Messaging is too narrow.

Variables should come from fields used across:

* forms
* messaging
* automations
* page builder
* CRM records
* templates

So replace “messaging variables” with:

> **Fields & Variables Manager**

---

## 6.2 Types of fields

### Native app fields

These are built into SmartSapp and reflect the data model.

Examples:

* `name`
* `email`
* `phone`
* `billingAddress`
* `schoolName`
* `nominalRoll`
* `guardianName`
* `childName`
* `childAge`

These should be grouped under sections and clearly marked as native/system fields.

### Custom fields

User-defined workspace fields.

Examples:

* Preferred Program
* Child Allergies
* Lead Source Detail
* Referred By
* Payment Preference
* Interested Campus

These should be fully manageable by users.

---

## 6.3 Field sections / groups

Both native and custom fields should be grouped under sections.

Examples:

### Common

* Full Name
* First Name
* Last Name
* Email
* Phone

### Institution Profile

* School Name
* Billing Address
* Nominal Roll
* Subscription Rate

### Family Profile

* Family Name
* Guardian Name
* Address

### Child Information

* Child Name
* Child Age
* Current Class
* Admission Status

### Custom: Admissions

* Preferred Start Term
* Interview Availability
* Child Special Needs

### Custom: Marketing

* Source Campaign
* Referral Code
* Interest Level

This grouping matters for usability and clean mental models.

---

## 6.4 Variable names

Every field must have a variable name.

Example:

* Field Label: `School Name`
* Variable Name: `school_name`

These variable names will be used everywhere:

* messaging
* automations
* forms
* page builder
* webhooks
* templates

So the Fields Manager becomes the variable registry.

## Rules

* variable names must be unique within workspace scope
* immutable or carefully versioned after use
* slugified and system-safe
* user-editable only with warnings

---

## 6.5 Field properties

Each field should store:

* internal name
* label
* variable name
* help text
* section/group
* field type
* native/custom
* entity compatibility
* default value
* placeholder
* validation rules
* options for select/radio
* visibility settings
* active/inactive

### Field types

* short text
* long text
* email
* phone
* number
* currency
* date
* datetime
* select
* multi-select
* radio
* checkbox
* yes/no
* address
* file upload later
* signature later
* hidden field
* URL

---

## 6.6 Field compatibility

Each field should declare where it can be used:

* common
* institution
* family
* person
* submission-only
* internal-only

This prevents bad builder combinations.

---

## 6.7 Fields Manager UI

### Main page: Fields

Top-level tabs:

* Native Fields
* Custom Fields
* Sections
* Variables Reference

### List columns

* Field Label
* Variable Name
* Section
* Type
* Scope Compatibility
* Source (Native/Custom)
* Status
* Used In

### Actions

* Create Field
* Edit Field
* Duplicate Field
* Archive Field
* Move to Section

### Section management

Users can:

* create section
* rename section
* reorder sections
* archive empty section

### Field detail drawer/page

* General
* Validation
* Options
* Compatibility
* Usage references

### Variables Reference

A searchable documentation-style page showing:

* variable name
* label
* description
* source section
* usable in messaging/forms/automations/webhooks

This replaces the old messaging variable registry.

---

# 7. Form Builder

This should feel like a simplified survey builder, but purpose-built for forms.

## Key rule

Forms have:

* one form body
* no intro section
* no multi-section survey navigation in V1

That keeps it simple and highly adoptable.

---

## 7.1 Form creation flow

### Step 1: Basics

User creates:

* Internal Name
* Slug
* Form Title
* Form Description
* Workspace
* Form Type:

  * Bound form
  * Global form

If bound:

* tied to workspace contact scope

If global:

* not bound to entity creation by default

---

### Step 2: Choose design/template

User can:

* start blank
* use form template

Template affects:

* layout
* spacing
* label alignment
* input style
* CTA style
* theme preset

Examples:

* minimal
* professional
* card style
* admissions
* registration
* CRM opt-in
* compact embed

---

### Step 3: Add fields

User selects fields from Fields Manager.

Field picker UI:

* grouped by section
* searchable
* shows variable name
* shows type
* shows native/custom badge
* shows compatibility badge

User can:

* add field
* mark required / optional
* reorder fields
* remove fields
* edit field label override if allowed
* set placeholder/help text overrides
* set hidden/default values

---

### Step 4: CTA and design

User configures:

* CTA label
* button style
* alignment
* width
* spacing
* container style
* background
* card mode
* label placement
* success message style

---

### Step 5: Submission actions

This is critical.

User configures what happens when form is submitted:

#### Tags

Choose tags to apply

#### Automations

Choose automations to trigger

#### Notifications

Choose:

* internal recipients
* external respondent confirmation
* teams/users to notify

#### Webhooks

Enable webhook POST with JSON payload

#### Entity behavior

For bound forms:

* create new entity
* update matching entity
* create or update

For global forms:

* submission only
* optional automation-based creation later

---

### Step 6: Sharing

User chooses how to share:

* hosted link
* embed code
* full HTML export
* webhook endpoint reference
* page builder block insertion later

Default:

* hosted link using slug

---

### Step 7: Publish

User can:

* save draft
* preview
* publish
* unpublish
* duplicate
* archive

---

# 8. Form builder UX specification

## Main builder layout

### Top bar

* Back to Forms
* Form name
* Save status
* Undo
* Redo
* Preview
* Publish
* More menu

### Left panel

Tabs:

* Fields
* Style
* Actions
* Share
* Settings

### Center canvas

Live form preview

### Right panel

Properties for selected field or form container

---

## 8.1 Fields tab

Shows:

* sectioned field library
* search
* drag/drop or click-to-add
* compatibility filtering based on workspace scope/form type

---

## 8.2 Style tab

Controls:

* theme/template
* background
* card width
* border radius
* input style
* label style
* spacing
* CTA style
* desktop/mobile preview

---

## 8.3 Actions tab

Subsections:

* Entity handling
* Tags
* Automations
* Notifications
* Webhooks
* Success behavior

---

## 8.4 Share tab

Shows:

* public link
* slug editor
* iframe embed code
* JS embed snippet later if needed
* raw HTML code export
* QR code later
* copy buttons

---

## 8.5 Settings tab

Shows:

* internal name
* title
* description
* status
* form mode
* required consent later
* spam protection later
* submission limit later
* close form later
* success message / redirect

---

# 9. Form templates

Templates should not just style the form — they should feel outcome-oriented.

Examples:

* Newsletter Signup
* Contact Us
* Request Demo
* School Onboarding
* Parent Registration
* Admissions Inquiry
* Event Registration
* Payment Support Request
* Waitlist Signup
* Simple Lead Capture

Each template includes:

* field arrangement
* spacing
* CTA copy
* suggested success message
* design preset

---

# 10. Submission actions and automation behavior

This is where the form becomes valuable.

## 10.1 Tags

Apply tags on submission.

For bound forms:

* tags can be applied to created/updated entity

For global forms:

* tags may apply only if automation or entity mapping exists

---

## 10.2 Automations

Forms should trigger workspace automations.

Trigger examples:

* form_submitted
* form_submitted:[formId]
* respondent_confirmed later
* webhook_delivery_failed later

Automation payload should include:

* formId
* formSlug
* workspaceId
* submissionId
* submittedData
* entityId if created
* tags applied

---

## 10.3 Notifications

Three categories:

### Internal notifications

Notify:

* specific users
* role groups
* workspace teams later

### External respondent notifications

Send:

* confirmation email
* confirmation SMS
* thank-you message later

### Operational notifications

Webhook failure alert, automation failure alert later

---

## 10.4 Webhooks

User can enable webhook triggers.

Behavior:

* POST JSON payload on submission
* selectable event type: on submit
* signed secret later
* retry policy later

Payload should include:

* workspace
* form metadata
* submission data
* entity data if resolved
* event timestamp

---

# 11. Sharing and delivery

## 11.1 Hosted link

Default and primary.

Pattern:

* `/f/[slug]`
  or workspace-scoped:
* `/w/[workspaceSlug]/f/[slug]`

Recommended:
workspace-aware route to avoid ambiguity.

---

## 11.2 Embed code

Provide iframe embed code.

Example:

```html
<iframe src="https://app.example.com/w/onboarding/f/request-demo" width="100%" height="720" frameborder="0"></iframe>
```

Later:
JS auto-resize embed snippet.

---

## 11.3 Full HTML export

Provide full HTML output for implementation elsewhere.

Caveat:

* styling exported
* behavior preserved via POST endpoint or embed script
* limited compared to hosted version

This should be available, but hosted link remains the recommended default.

---

# 12. Autosave, undo/redo, and recovery

These are essential.

## 12.1 Autosave

* autosave draft every few seconds after changes
* save to draft version / builder state doc
* show save state clearly

## 12.2 Undo/redo

* local builder session state
* optionally persisted in draft snapshot trail

## 12.3 Recovery

When user returns:

* restore unsaved draft
* show “Recovered draft from last session”
* allow discard or continue

This is very important for user trust.

---

# 13. Data model

---

## 13.1 `workspace_field_sections`

```ts
{
  id,
  workspaceId,
  name,
  description?,
  order,
  source: "native" | "custom" | "mixed",
  createdAt,
  updatedAt
}
```

## 13.2 `workspace_fields`

```ts
{
  id,
  workspaceId,
  label,
  internalName,
  variableName,
  description?,
  type,
  source: "native" | "custom",
  sectionId,
  compatibility: {
    common: boolean,
    institution: boolean,
    family: boolean,
    person: boolean,
    submissionOnly: boolean
  },
  settings: {
    placeholder?: string,
    helpText?: string,
    defaultValue?: unknown,
    requiredByDefault?: boolean,
    options?: Array<{ label: string; value: string }>,
    validation?: {
      minLength?: number,
      maxLength?: number,
      min?: number,
      max?: number,
      pattern?: string
    }
  },
  usage: {
    formsCount: number,
    automationsCount?: number,
    messagingCount?: number
  },
  status: "active" | "archived",
  createdAt,
  updatedAt
}
```

## 13.3 `workspace_forms`

```ts
{
  id,
  workspaceId,
  internalName,
  slug,
  title,
  description?,
  mode: "bound" | "global",
  boundEntityType?: "institution" | "family" | "person" | null,
  templateId?: string | null,
  status: "draft" | "published" | "archived",
  currentDraftVersionId?: string | null,
  publishedVersionId?: string | null,
  successBehavior: {
    mode: "message" | "redirect",
    message?: string,
    redirectUrl?: string
  },
  createdBy,
  updatedBy?,
  createdAt,
  updatedAt,
  publishedAt?
}
```

## 13.4 `workspace_form_versions`

```ts
{
  id,
  formId,
  workspaceId,
  versionNumber,
  structureJson,
  styleSnapshot,
  createdBy,
  createdAt,
  isPublishedVersion
}
```

## 13.5 `workspace_form_submissions`

```ts
{
  id,
  workspaceId,
  formId,
  formVersionId,
  submittedAt,
  data: Record<string, unknown>,
  tagsApplied?: string[],
  automationIdsTriggered?: string[],
  webhookIdsTriggered?: string[],
  notificationsSent?: {
    internal?: boolean,
    external?: boolean
  },
  entityResolution?: {
    mode: "none" | "created" | "updated" | "matched",
    entityId?: string,
    entityType?: string
  },
  source?: {
    url?: string,
    referrer?: string,
    utmSource?: string,
    utmMedium?: string,
    utmCampaign?: string
  }
}
```

## 13.6 `workspace_form_templates`

```ts
{
  id,
  workspaceId?: string,
  scope: "system" | "workspace",
  name,
  category,
  description?,
  previewImageUrl?,
  structureJson,
  styleSnapshot,
  createdAt,
  updatedAt
}
```

---

# 14. Structure JSON for forms

Because forms are one-section only, keep structure simple.

```ts
type FormStructure = {
  fields: FormFieldInstance[];
  cta: {
    label: string;
    align: "left" | "center" | "right";
    fullWidth: boolean;
  };
};

type FormFieldInstance = {
  id: string;
  fieldId: string;
  required: boolean;
  order: number;
  overrides?: {
    label?: string;
    placeholder?: string;
    helpText?: string;
    defaultValue?: unknown;
    hidden?: boolean;
  };
};
```

This keeps the builder much cleaner than the survey builder.

---

# 15. Multi-workspace behavior rules

## Hard rules

1. Forms are owned by a workspace
2. Fields are owned by a workspace
3. Custom fields are workspace-specific
4. Native fields are surfaced within workspace context
5. Variable names are unique within workspace
6. Bound forms can only use fields compatible with workspace scope
7. Automations/tags/notifications selected in form setup must belong to that workspace context

This preserves operational clarity.

---

# 16. UI pages

## 16.1 Forms Dashboard

Widgets:

* total forms
* published forms
* draft forms
* submissions this week
* top converting forms

List:

* title
* mode
* status
* submissions
* updated at
* share link
* actions

---

## 16.2 Fields Manager

Tabs:

* Native Fields
* Custom Fields
* Sections
* Variables Reference

Actions:

* create field
* create section
* edit
* archive

---

## 16.3 New Form Wizard

Steps:

1. Basics
2. Template
3. Build
4. Actions
5. Share
6. Publish

---

## 16.4 Form Builder

Three-pane builder:

* left controls
* center live preview
* right properties

---

## 16.5 Form Submissions Page

List submissions with:

* timestamp
* form
* source
* entity result
* status

---

## 16.6 Form Detail Analytics

* views later if tracked
* submissions
* conversion rate if linked with page traffic
* source breakdown

---

# 17. Technical architecture for Next.js + Firebase

## Frontend

* Next.js App Router
* TypeScript
* Tailwind
* existing UI system / shadcn-style patterns
* Zustand or reducer-based builder state
* React Hook Form for admin/editor forms

## Backend

* Firestore for fields/forms/submissions
* Storage for assets and template previews
* Cloud Functions / route handlers for submission processing
* Auth + workspace permission enforcement

## Rendering

* public hosted form route reads only published version
* builder reads draft version
* renderer component registry maps field types to form inputs

## Submission flow

1. public user submits form
2. server validates against form version schema
3. save submission
4. resolve bound/global behavior
5. apply tags
6. trigger automations
7. send notifications
8. send webhooks
9. return success state

---

# 18. Phased rollout

## Phase 1

* Fields Manager
* field sections
* native/custom fields
* variable names
* form CRUD
* one-section builder
* hosted form link
* submissions storage

## Phase 2

* templates
* styling presets
* autosave
* undo/redo
* recovery draft
* embed code
* HTML export

## Phase 3

* tags
* automations
* notifications
* webhooks
* entity create/update binding

## Phase 4

* analytics
* better submission views
* usage references
* variable docs replacement for messaging

## Phase 5

* anti-spam
* advanced embeds
* conditional fields
* file upload
* signature field
* partial save

---

# 19. Key UX recommendations

## Keep it simple

Do not make the first experience feel technical.

## Make fields the source of truth

Users should trust Fields Manager as the central place for:

* data structure
* variables
* messaging merge fields
* form field choices

## Prefer templates and defaults

Users adopt faster when:

* design is already good
* CTA copy is suggested
* field groupings are clean
* compatibility is automatic

## Make actions feel powerful but safe

Use plain language:

* “Apply tags”
* “Run automations”
* “Notify team”
* “Send confirmation”
* “Send webhook”

not overly technical jargon.

---

# 20. Final recommendation

This should be positioned as:

> **SmartSapp Forms**
> A workspace-based form builder for capturing structured data, creating leads and records, triggering automations, and powering messaging and CRM workflows.

The biggest architectural decision here is the right one:

> **Move variable management into Fields Management**
> because fields are the true source of reusable variables across the app.

That will make Forms, Messaging, Automations, Pages, and CRM all feel like parts of one system.

I can turn this next into a **full Firestore schema + TypeScript interfaces + recommended folder/module structure for implementation**.
