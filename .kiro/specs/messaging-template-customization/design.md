# Design Document: Messaging Template Customization System

## Overview

The Messaging Template Customization System introduces a comprehensive two-tier template management architecture that enables SmartSapp CRM to maintain global default message templates while allowing individual organizations to customize templates for their specific branding and communication needs. This system categorizes all messaging touchpoints across the application and provides a unified interface for template selection, customization, and variable management.

### Design Goals

1. **Two-Tier Architecture**: Global templates (super admin managed) with organization-level overrides
2. **Template Categorization**: 7 primary categories with specific template types per category
3. **Dynamic Variable System**: Context-aware variable resolution with dynamic schema harvesting from forms/surveys
4. **Seamless Integration**: Integrate with existing `ComposerWizard`, automation engine, and messaging engine
5. **Reminder Scheduling**: Time-based reminder templates with automated scheduling
6. **Performance**: Caching and query optimization for high-volume template rendering
7. **Migration**: Backward compatibility with existing `message_templates` collection

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                        │
│  ComposerWizard  │  Back Office UI  │  Org Template Manager     │
└──────────────────┬──────────────────┬───────────────────────────┘
                   │                  │
┌──────────────────▼──────────────────▼───────────────────────────┐
│                       Application Layer                          │
│  template-actions.ts  │  variable-registry.ts  │  reminder-     │
│  template-resolver.ts │  messaging-engine.ts   │  scheduler.ts  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                          Data Layer (Firestore)                  │
│  message_templates  │  template_variables  │  scheduled_messages │
└─────────────────────────────────────────────────────────────────┘
```

### Template Resolution Flow

```
Request to send message
        │
        ▼
Does org have override for this category+type?
        │
   YES  │  NO
        │   └──► Use global template
        ▼
Use org template
        │
        ▼
Resolve variables from context (meeting/form/survey/entity)
        │
        ▼
Render template → Send via messaging engine
```

---

## Data Models

### MessageTemplate (updated schema)

Extends the existing `message_templates` Firestore collection.

```typescript
interface MessageTemplate {
  id: string;

  // Two-tier scope
  scope: 'global' | 'organization';
  organizationId?: string;        // null for global templates
  globalTemplateId?: string;      // set when this is an org override

  // Categorization
  category: TemplateCategory;     // 'forms' | 'surveys' | 'meetings' | 'agreements' | 'campaigns' | 'reminders' | 'general'
  templateType: string;           // e.g. 'submission_confirmation', 'meeting_invitation'

  // Content
  name: string;
  channel: 'email' | 'sms';
  subject?: string;               // email only
  body: string;                   // supports {{variable}} syntax
  bodyBlocks?: ContentBlock[];    // rich text blocks for email

  // Variables
  variableContext: VariableContext;  // 'meeting' | 'form' | 'survey' | 'agreement' | 'entity' | 'common'
  declaredVariables: string[];       // list of {{var}} names used in body

  // Reminder config (for reminder category only)
  reminderConfig?: ReminderConfig;

  // Status & lifecycle
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'archived';
  isActive: boolean;
  version: number;
  previousVersionId?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

type TemplateCategory =
  | 'forms'
  | 'surveys'
  | 'meetings'
  | 'agreements'
  | 'campaigns'
  | 'reminders'
  | 'general';

type VariableContext =
  | 'meeting'
  | 'form'
  | 'survey'
  | 'agreement'
  | 'entity'
  | 'campaign'
  | 'common';
```

### ReminderConfig

```typescript
interface ReminderConfig {
  triggerType: 'before_event' | 'after_event' | 'on_deadline';
  offsetMinutes: number;   // e.g. 60 = 1 hour before, 1440 = 1 day before
  offsetLabel: string;     // e.g. '1 hour before', '1 day before'
  eventType: 'meeting' | 'form_deadline' | 'survey_deadline' | 'payment_due';
}

// Predefined reminder offsets
const REMINDER_OFFSETS = {
  FIFTEEN_MINUTES: { offsetMinutes: 15,   offsetLabel: '15 minutes before' },
  ONE_HOUR:        { offsetMinutes: 60,   offsetLabel: '1 hour before' },
  TWO_HOURS:       { offsetMinutes: 120,  offsetLabel: '2 hours before' },
  ONE_DAY:         { offsetMinutes: 1440, offsetLabel: '1 day before' },
  TIME_UP:         { offsetMinutes: 0,    offsetLabel: 'At event time' },
} as const;
```

### TemplateVariable (variable registry)

Stored in `template_variables` Firestore collection.

```typescript
interface TemplateVariable {
  id: string;
  name: string;           // e.g. 'meeting_link'
  label: string;          // e.g. 'Meeting Link'
  description: string;
  dataType: 'string' | 'date' | 'number' | 'url' | 'html';
  context: VariableContext;
  exampleValue: string;
  // For dynamic form/survey variables
  isDynamic: boolean;
  sourceFormId?: string;   // form/survey this variable belongs to
  sourceFieldId?: string;  // field within the form/survey
  // Computed variables
  isComputed: boolean;
  computeExpression?: string;  // e.g. 'firstName + " " + lastName'
}
```

### ScheduledMessage

Stored in `scheduled_messages` Firestore collection.

```typescript
interface ScheduledMessage {
  id: string;
  organizationId: string;
  workspaceId?: string;
  templateId: string;
  channel: 'email' | 'sms';
  recipientContact: string;   // email or phone
  recipientEntityId?: string;
  variables: Record<string, any>;
  scheduledAt: string;        // ISO timestamp
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  // Reminder linkage
  reminderType?: string;      // e.g. 'meeting_1_hour'
  sourceEventId?: string;     // meetingId, formId, etc.
  sourceEventType?: string;
  sentAt?: string;
  error?: string;
  createdAt: string;
}
```

---

## Template Categories & Default Templates

### Category: Meetings

| Template Type | Channel | Key Variables |
|---|---|---|
| `meeting_invitation` | email + sms | `{{meeting_title}}`, `{{meeting_time}}`, `{{meeting_link}}`, `{{organizer_name}}` |
| `meeting_confirmation` | email | `{{meeting_title}}`, `{{meeting_time}}`, `{{meeting_link}}` |
| `meeting_cancellation` | email + sms | `{{meeting_title}}`, `{{meeting_time}}`, `{{cancellation_reason}}` |
| `meeting_update` | email + sms | `{{meeting_title}}`, `{{old_meeting_time}}`, `{{new_meeting_time}}`, `{{meeting_link}}` |

**Reminder sub-types** (category: `reminders`, eventType: `meeting`):

| Template Type | Offset | Channel |
|---|---|---|
| `meeting_reminder_15min` | 15 min | email + sms |
| `meeting_reminder_1hour` | 60 min | email + sms |
| `meeting_reminder_2hours` | 120 min | email + sms |
| `meeting_reminder_1day` | 1440 min | email |
| `meeting_time_up` | 0 min | sms |

### Category: Forms

| Template Type | Channel | Key Variables |
|---|---|---|
| `form_invitation` | email + sms | `{{form_name}}`, `{{form_link}}`, `{{submission_deadline}}`, `{{respondent_name}}` |
| `submission_confirmation` | email | `{{form_name}}`, `{{respondent_name}}`, `{{submission_date}}`, `{{form_fields.*}}` |
| `submission_reminder` | email + sms | `{{form_name}}`, `{{form_link}}`, `{{deadline}}`, `{{days_remaining}}` |

### Category: Surveys

| Template Type | Channel | Key Variables |
|---|---|---|
| `survey_invitation` | email + sms | `{{survey_title}}`, `{{survey_link}}`, `{{respondent_name}}` |
| `survey_completion` | email | `{{survey_title}}`, `{{score}}`, `{{result_message}}`, `{{completion_date}}` |
| `survey_reminder` | email + sms | `{{survey_title}}`, `{{survey_link}}`, `{{days_remaining}}` |

### Category: Agreements

| Template Type | Channel | Key Variables |
|---|---|---|
| `contract_sent` | email | `{{contract_name}}`, `{{signatory_name}}`, `{{contract_link}}`, `{{deadline}}` |
| `contract_signed` | email | `{{contract_name}}`, `{{signatory_name}}`, `{{signing_date}}` |
| `contract_pending` | email + sms | `{{contract_name}}`, `{{signatory_name}}`, `{{deadline}}`, `{{days_remaining}}` |
| `contract_reminder` | email + sms | `{{contract_name}}`, `{{contract_link}}`, `{{deadline}}` |

### Category: General

| Template Type | Channel | Key Variables |
|---|---|---|
| `welcome_message` | email | `{{contact_name}}`, `{{organization_name}}`, `{{workspace_name}}` |
| `stage_change` | email + sms | `{{entity_name}}`, `{{old_stage}}`, `{{new_stage}}`, `{{assigned_to}}` |
| `assignment_notification` | email | `{{entity_name}}`, `{{assigned_to}}`, `{{assigner_name}}` |
| `status_update` | email + sms | `{{entity_name}}`, `{{old_status}}`, `{{new_status}}` |

### Common Variables (all contexts)

```
{{contact_name}}       {{contact_email}}      {{contact_phone}}
{{entity_name}}        {{organization_name}}  {{workspace_name}}
{{user_name}}          {{current_date}}       {{current_time}}
{{current_year}}
```

---

## Variable Registry Design

### Static Variables

Defined at system boot in `src/lib/template-variable-registry.ts`:

```typescript
export const STATIC_VARIABLES: TemplateVariable[] = [
  // Common
  { name: 'contact_name',       context: 'common',   label: 'Contact Name',       ... },
  { name: 'organization_name',  context: 'common',   label: 'Organization Name',  ... },
  // Meeting
  { name: 'meeting_link',       context: 'meeting',  label: 'Meeting Link',       dataType: 'url', ... },
  { name: 'meeting_time',       context: 'meeting',  label: 'Meeting Time',       dataType: 'date', ... },
  { name: 'meeting_title',      context: 'meeting',  label: 'Meeting Title',      ... },
  // Form
  { name: 'form_name',          context: 'form',     label: 'Form Name',          ... },
  { name: 'form_link',          context: 'form',     label: 'Form Link',          dataType: 'url', ... },
  // Survey
  { name: 'survey_title',       context: 'survey',   label: 'Survey Title',       ... },
  { name: 'survey_link',        context: 'survey',   label: 'Survey Link',        dataType: 'url', ... },
  { name: 'score',              context: 'survey',   label: 'Score',              dataType: 'number', ... },
  // Agreement
  { name: 'contract_name',      context: 'agreement', label: 'Contract Name',     ... },
  { name: 'contract_link',      context: 'agreement', label: 'Contract Link',     dataType: 'url', ... },
  { name: 'signatory_name',     context: 'agreement', label: 'Signatory Name',    ... },
];
```

### Dynamic Variables (Form/Survey fields)

When a form or survey is created/updated, its fields are registered as dynamic variables scoped to that form:

```typescript
// Called from survey-actions.ts and pdf-actions.ts on save
async function registerFormVariables(formId: string, fields: FormField[]) {
  const variables = fields.map(field => ({
    name: `form_fields.${field.id}`,
    label: field.label,
    context: 'form',
    isDynamic: true,
    sourceFormId: formId,
    sourceFieldId: field.id,
    dataType: 'string',
  }));
  // Batch write to template_variables collection
}
```

### Variable Resolution

```typescript
// src/lib/template-resolver.ts
async function resolveTemplate(
  templateId: string,
  organizationId: string,
  context: VariableResolutionContext
): Promise<string> {
  // 1. Resolve template (org override or global)
  const template = await resolveTemplateForOrg(templateId, organizationId);

  // 2. Build variable map from context
  const vars = await buildVariableMap(template.variableContext, context);

  // 3. Render: replace {{var}} placeholders
  return renderTemplate(template.body, vars);
}

interface VariableResolutionContext {
  entityId?: string;
  meetingId?: string;
  formId?: string;
  surveyId?: string;
  agreementId?: string;
  responseId?: string;
  submissionId?: string;
  workspaceId?: string;
  extraVars?: Record<string, any>;
}
```

---

## Two-Tier Resolution Logic

```typescript
// src/lib/template-resolver.ts
async function resolveTemplateForOrg(
  templateIdOrType: string,
  organizationId: string,
  category?: TemplateCategory,
  templateType?: string
): Promise<MessageTemplate> {
  // 1. Check for org-level override
  const orgOverride = await db.collection('message_templates')
    .where('scope', '==', 'organization')
    .where('organizationId', '==', organizationId)
    .where('category', '==', category)
    .where('templateType', '==', templateType)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!orgOverride.empty) return orgOverride.docs[0].data() as MessageTemplate;

  // 2. Fall back to global template
  const global = await db.collection('message_templates')
    .where('scope', '==', 'global')
    .where('category', '==', category)
    .where('templateType', '==', templateType)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!global.empty) return global.docs[0].data() as MessageTemplate;

  throw new Error(`No template found for ${category}/${templateType}`);
}
```

---

## Reminder Scheduling System

### Scheduling Flow

```
Meeting created/updated
        │
        ▼
For each enabled reminder type:
  scheduledAt = meetingTime - offsetMinutes
        │
        ▼
Write ScheduledMessage doc to Firestore
  { status: 'pending', scheduledAt, templateId, ... }
        │
        ▼
Cloud Function / cron job polls pending messages
  WHERE scheduledAt <= now AND status == 'pending'
        │
        ▼
Send via messaging engine → update status to 'sent'
```

### Reminder Actions (server actions)

```typescript
// src/lib/reminder-actions.ts

export async function scheduleRemindersForMeeting(
  meeting: Meeting,
  enabledReminderTypes: string[],
  organizationId: string
): Promise<void>

export async function cancelRemindersForMeeting(meetingId: string): Promise<void>

export async function rescheduleRemindersForMeeting(
  meeting: Meeting,
  organizationId: string
): Promise<void>

export async function processScheduledMessages(): Promise<{ sent: number; failed: number }>
```

---

## Message Composer Integration

### Context-Aware Template Filtering

The existing `ComposerWizard.tsx` Firestore query for templates will be updated to filter by category based on the composer's context prop:

```typescript
// Updated query in ComposerWizard
const templatesQuery = useMemoFirebase(() => {
  if (!firestore) return null;
  let q = query(
    collection(firestore, 'message_templates'),
    where('isActive', '==', true),
    where('channel', '==', watchedChannel),
    where('status', '==', 'approved'),
  );
  // Filter by category if context is provided
  if (composerContext?.category) {
    q = query(q, where('category', '==', composerContext.category));
  }
  return q;
}, [firestore, watchedChannel, composerContext?.category]);
```

### ComposerContext prop

```typescript
interface ComposerContext {
  category?: TemplateCategory;
  meetingId?: string;
  formId?: string;
  surveyId?: string;
  agreementId?: string;
}
```

### Variable Picker UI

A new `VariablePicker` component will be added to the composer's Step 2 (Builder):

```
┌─────────────────────────────────────────┐
│  Insert Variable                        │
│  ┌─────────────────────────────────┐    │
│  │ 🔍 Search variables...          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Common                                 │
│  ├── {{contact_name}}                   │
│  ├── {{organization_name}}              │
│  └── {{current_date}}                   │
│                                         │
│  Meeting                                │
│  ├── {{meeting_link}}                   │
│  ├── {{meeting_time}}                   │
│  └── {{meeting_title}}                  │
└─────────────────────────────────────────┘
```

---

## Back Office UI

### Route Structure

```
/backoffice/messaging/
  templates/                    ← Global template list
    new/                        ← Create global template
    [templateId]/               ← Edit global template
      preview/                  ← Preview with sample data
```

### Organization Template Management

```
/admin/settings/messaging/
  templates/                    ← Org template list (global + overrides)
    [templateId]/override/      ← Create/edit org override
```

### Template List UI

```
┌──────────────────────────────────────────────────────────────────┐
│  Message Templates                          [+ New Template]     │
│                                                                  │
│  Filter: [All Categories ▼]  [Email/SMS ▼]  [Status ▼]         │
│                                                                  │
│  MEETINGS                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Meeting Invitation (Email)          ● Approved  [Edit]     │  │
│  │ Meeting Invitation (SMS)            ● Approved  [Edit]     │  │
│  │ Meeting Reminder - 1 Hour (Email)   ● Approved  [Edit]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  FORMS                                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Form Invitation (Email)             ● Approved  [Edit]     │  │
│  │ Submission Confirmation (Email)     ○ Draft     [Edit]     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Firestore Schema & Indexes

### Collection: `message_templates`

Updated fields (backward compatible — existing fields preserved):

```
scope              (string)   'global' | 'organization'
organizationId     (string)   null for global
globalTemplateId   (string)   reference to global template being overridden
category           (string)   'forms' | 'surveys' | 'meetings' | ...
templateType       (string)   e.g. 'meeting_invitation'
variableContext    (string)   'meeting' | 'form' | ...
declaredVariables  (array)    ['meeting_link', 'meeting_time', ...]
status             (string)   'draft' | 'approved' | ...
version            (number)
reminderConfig     (map)      optional
```

### Required Composite Indexes

```json
// Org override resolution
{ "collectionGroup": "message_templates",
  "fields": [
    { "fieldPath": "scope" },
    { "fieldPath": "organizationId" },
    { "fieldPath": "category" },
    { "fieldPath": "templateType" },
    { "fieldPath": "isActive" }
  ]
}

// Global template lookup
{ "collectionGroup": "message_templates",
  "fields": [
    { "fieldPath": "scope" },
    { "fieldPath": "category" },
    { "fieldPath": "templateType" },
    { "fieldPath": "isActive" }
  ]
}

// Scheduled messages processing
{ "collectionGroup": "scheduled_messages",
  "fields": [
    { "fieldPath": "status" },
    { "fieldPath": "scheduledAt" }
  ]
}
```

### Collection: `template_variables`

```
name               (string)   variable name
label              (string)   display label
context            (string)   variable context
isDynamic          (boolean)
sourceFormId       (string)   optional
dataType           (string)
exampleValue       (string)
```

### Collection: `scheduled_messages`

```
organizationId     (string)
templateId         (string)
channel            (string)
recipientContact   (string)
variables          (map)
scheduledAt        (timestamp)
status             (string)   'pending' | 'sent' | 'failed' | 'cancelled'
sourceEventId      (string)
sourceEventType    (string)
reminderType       (string)
```

---

## Server Actions

### `src/lib/template-actions.ts`

```typescript
// Global template management (super admin)
createGlobalTemplate(data: CreateTemplateInput): Promise<MessageTemplate>
updateGlobalTemplate(id: string, data: Partial<MessageTemplate>): Promise<void>
deleteGlobalTemplate(id: string): Promise<void>
listGlobalTemplates(filters?: TemplateFilters): Promise<MessageTemplate[]>

// Org template management
createOrgOverride(globalTemplateId: string, orgId: string, data: Partial<MessageTemplate>): Promise<MessageTemplate>
updateOrgTemplate(id: string, orgId: string, data: Partial<MessageTemplate>): Promise<void>
revertToGlobal(orgTemplateId: string): Promise<void>
listOrgTemplates(orgId: string, filters?: TemplateFilters): Promise<MessageTemplate[]>

// Resolution
resolveTemplate(category: TemplateCategory, type: string, orgId: string): Promise<MessageTemplate>
```

### `src/lib/template-resolver.ts`

```typescript
renderTemplate(body: string, variables: Record<string, any>): string
resolveVariables(context: VariableResolutionContext): Promise<Record<string, any>>
resolveTemplateForOrg(category: string, type: string, orgId: string): Promise<MessageTemplate>
```

### `src/lib/reminder-actions.ts`

```typescript
scheduleRemindersForMeeting(meeting: Meeting, types: string[], orgId: string): Promise<void>
cancelRemindersForMeeting(meetingId: string): Promise<void>
rescheduleRemindersForMeeting(meeting: Meeting, orgId: string): Promise<void>
scheduleFormReminders(formId: string, deadline: string, orgId: string): Promise<void>
processScheduledMessages(): Promise<ProcessResult>
```

---

## Migration Strategy

### Phase 1: Schema Extension (non-breaking)

Add new fields to existing `message_templates` documents with defaults:
- `scope: 'organization'` (all existing templates are org-scoped)
- `category: 'general'` (default, to be updated)
- `templateType: 'custom'`
- `status: 'approved'` (existing templates are already in use)
- `version: 1`

### Phase 2: Seed Global Templates

Run a migration script `scripts/seed-global-templates.ts` that creates the full set of global default templates for all categories.

### Phase 3: Categorize Existing Templates

Provide a UI in the back office to bulk-assign categories and types to existing org templates.

### Phase 4: Update Composer & Engine

Update `ComposerWizard.tsx` to pass `composerContext` and filter templates by category. Update `messaging-engine.ts` to use `resolveTemplateForOrg` instead of direct template ID lookup.

---

## Component Architecture

```
src/
  app/
    admin/
      messaging/
        composer/
          components/
            ComposerWizard.tsx          ← updated: context-aware filtering
            VariablePicker.tsx          ← new: variable insertion UI
            TemplatePreview.tsx         ← new: live preview with sample data
        templates/
          page.tsx                      ← org template list
          [id]/
            page.tsx                    ← edit org template / override
    backoffice/
      messaging/
        templates/
          page.tsx                      ← global template list
          new/page.tsx                  ← create global template
          [id]/page.tsx                 ← edit global template
  lib/
    template-actions.ts                 ← new: CRUD for templates
    template-resolver.ts                ← new: resolution + rendering
    template-variable-registry.ts       ← new: static variable definitions
    reminder-actions.ts                 ← new: reminder scheduling
  components/
    messaging/
      TemplateEditor.tsx                ← new: shared editor (email/sms)
      TemplateCard.tsx                  ← new: template list item
      VariablePicker.tsx                ← new: variable picker dropdown
      ReminderConfig.tsx                ← new: reminder timing config
```

---

## Security & Permissions

| Action | Super Admin | Org Admin | Team Member |
|---|---|---|---|
| Create global template | ✅ | ❌ | ❌ |
| Edit global template | ✅ | ❌ | ❌ |
| Delete global template | ✅ | ❌ | ❌ |
| View global templates | ✅ | ✅ (read-only) | ✅ (read-only) |
| Create org override | ✅ | ✅ | ❌ |
| Edit org template | ✅ | ✅ | ❌ |
| Delete org template | ✅ | ✅ | ❌ |
| Use template in composer | ✅ | ✅ | ✅ |

Firestore security rules will enforce these constraints using the existing `organizationId` and role-based patterns already in the codebase.

---

## Property-Based Testing

### Correctness Properties

1. **Resolution invariant**: For any `(category, type, orgId)`, `resolveTemplateForOrg` always returns the org override if one exists, otherwise the global template.

2. **Rendering completeness**: For any template body and variable map, `renderTemplate` replaces all `{{var}}` placeholders — no unreplaced placeholders remain in the output.

3. **Reminder scheduling invariant**: For any meeting with time `T` and reminder offset `O`, the scheduled message's `scheduledAt` equals `T - O` (in minutes).

4. **Scope isolation**: An org template with `organizationId = A` is never returned when resolving for `organizationId = B`.

```typescript
// Example property test (fast-check)
it('renders all declared variables', () => {
  fc.assert(fc.property(
    fc.record({ body: fc.string(), vars: fc.dictionary(fc.string(), fc.string()) }),
    ({ body, vars }) => {
      const bodyWithVars = Object.keys(vars).reduce(
        (b, k) => b + ` {{${k}}}`, body
      );
      const rendered = renderTemplate(bodyWithVars, vars);
      return !rendered.includes('{{');
    }
  ));
});
```
