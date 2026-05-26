# Message Template Filtering Criteria

**Date**: 2025-01-XX  
**Component**: SmartTemplateDropdown & MessagingTemplateSelector

## Overview

The app uses a **three-axis classification system** to filter and display message templates across various studios (Composer, Surveys, Meetings, Automations, Contracts, etc.). This ensures users only see relevant templates for their specific context.

---

## Three-Axis Classification System

### 1. **Category** (TemplateCategory)
Defines the functional purpose or studio context.

**Available Categories**:
- `general` - General-purpose messages
- `campaigns` - Marketing/outreach campaigns
- `meetings` - Meeting invitations and reminders
- `surveys` - Survey notifications
- `agreements` - Contract/agreement notifications
- `reminders` - Reminder messages
- `automations` - Automation-triggered messages
- `forms` - Form submission notifications
- `invoices` - Invoice/billing notifications
- `tasks` - Task notifications
- `alerts` - System alerts

### 2. **Channel** (MessageChannel)
Defines the delivery method.

**Available Channels**:
- `email` - Email messages
- `sms` - SMS/text messages

### 3. **Recipient Type** (RecipientType)
Defines the target audience.

**Available Recipient Types**:
- `entity` - External clients (institutions, families, persons)
- `external_alert` - External notifications (e.g., meeting reminders)
- `internal_alert` - Internal team notifications
- `respondent` - Survey respondents

---

## Filtering Logic

### Server-Side Filtering (`getFilteredTemplatesAction`)

Located in: `src/app/actions/get-filtered-templates-action.ts`

**Step 1: Fetch Global Templates**
```typescript
adminDb.collection('message_templates')
  .where('scope', '==', 'global')
  .where('category', '==', category)           // ✅ FILTER 1
  .where('recipientType', '==', recipientType) // ✅ FILTER 2
  .where('channel', '==', channel)             // ✅ FILTER 3
  .where('status', '==', 'active')             // ✅ FILTER 4
  .get()
```

**Step 2: Fetch Organization/Workspace Overrides**
```typescript
adminDb.collection('message_templates')
  .where('category', '==', category)           // ✅ FILTER 1
  .where('recipientType', '==', recipientType) // ✅ FILTER 2
  .where('channel', '==', channel)             // ✅ FILTER 3
  .where('status', '==', 'active')             // ✅ FILTER 4
  .get()
  
// Then filter in-memory:
.filter(t => t.scope === 'organization' && (
  (organizationId && t.organizationId === organizationId) || 
  (workspaceId && t.workspaceIds?.includes(workspaceId))
))
```

**Step 3: Deduplication (Org Overrides Take Precedence)**
- Organization overrides are added first
- Global templates are added only if no override exists for that `templateType`
- Uses `templateType` as the unique key (e.g., `'forms_respondent_standard'`)

**Step 4: Sort by Name**
```typescript
resultTemplates.sort((a, b) => a.name.localeCompare(b.name))
```

### Client-Side Filtering (Optional)

Located in: `src/app/admin/components/SmartTemplateDropdown.tsx`

**Additional Filter: Template Type Prefix**
```typescript
const filtered = templateTypePrefix
  ? result.filter(t => t.templateType?.startsWith(templateTypePrefix))
  : result;
```

This allows further narrowing by template sub-type (e.g., only show templates starting with `'meeting_invitation_'`).

---

## Template Status Lifecycle

Templates must have `status: 'active'` to appear in studio selectors.

**Status Values**:
- `draft` - Work-in-progress, **NOT visible** in selectors
- `active` - Published and **VISIBLE** in selectors
- `archived` - Soft-deleted, **NOT visible** in selectors (but can be unarchived)

**Status Transitions**:
```
draft → active → archived
  ↑                ↓
  └────────────────┘
     (unarchive)
```

---

## Template Scope Hierarchy

### Global Templates (`scope: 'global'`)
- Created by super admins in Backoffice
- Available to all organizations
- Serve as default blueprints
- Badge: "Auto Default" (blue)

### Organization Overrides (`scope: 'organization'`)
- Created by org admins or auto-generated from global templates
- Customized for specific organization
- Override global templates with same `templateType`
- Badge: "Auto Custom" (green)

**Resolution Logic**:
```
IF organization override exists for templateType
  THEN show organization override
ELSE
  THEN show global template
```

---

## Usage Across Studios

### 1. **Messaging Composer**
**Location**: `src/app/admin/messaging/composer/`

**Filters**:
```typescript
<MessagingTemplateSelector 
  category="general"           // or composerContext?.category
  recipientType="entity"       // External clients
  channel={userSelectedChannel} // email or sms
/>
```

**Use Case**: Ad-hoc messaging to entities

---

### 2. **Campaigns**
**Location**: `src/app/admin/messaging/campaigns/`

**Filters**:
```typescript
<MessagingTemplateSelector 
  category="campaigns"
  recipientType={state.target === 'external_client' ? 'entity' : 'internal_alert'}
  channel={state.channel}
/>
```

**Use Case**: Bulk marketing/outreach campaigns

---

### 3. **Meetings**
**Location**: `src/app/admin/meetings/`

**Filters**:
```typescript
<MessagingTemplateSelector 
  category="meetings"
  recipientType="external_alert"
  channel="email" // or "sms"
/>
```

**Use Case**: Meeting invitations and reminders

---

### 4. **Surveys**
**Location**: `src/app/admin/surveys/`

**Filters**:
```typescript
<MessagingTemplateSelector 
  category="surveys"
  recipientType={prefix === 'externalAlert' ? 'external_alert' : 'internal_alert'}
  channel={channel}
/>
```

**Use Case**: Survey submission notifications

---

### 5. **Contracts/Agreements**
**Location**: `src/app/admin/finance/contracts/`

**Filters**:
```typescript
<MessagingTemplateSelector 
  category="agreements"
  recipientType="entity"
  channel="email" // or "sms"
/>
```

**Use Case**: Contract signing notifications

---

### 6. **Automations**
**Location**: `src/app/admin/automations/`

**Filters**:
```typescript
<MessagingTemplateSelector 
  category={inferredCategory} // Based on trigger type
  recipientType="entity"
  channel="email" // or "sms"
/>
```

**Use Case**: Automated workflow messages

---

## Template Type Conventions

Templates use a naming convention for `templateType` field:

**Format**: `{category}_{recipientType}_{variant}`

**Examples**:
- `meetings_invitation_standard`
- `meetings_reminder_24h`
- `surveys_respondent_thank_you`
- `agreements_signatory_request`
- `campaigns_entity_promotional`
- `forms_respondent_confirmation`

This allows:
1. Unique identification across categories
2. Variant management (e.g., multiple reminder templates)
3. Client-side prefix filtering

---

## Auto-Selection Behavior

**SmartTemplateDropdown** automatically selects the first template if:
1. No value is provided initially
2. Templates are available after fetch
3. Auto-selection hasn't been triggered yet

**Logic**:
```typescript
if (filtered.length > 0 && !value && !hasAutoSelectedRef.current) {
  hasAutoSelectedRef.current = true;
  const defaultTemplate = filtered[0];
  handleValueChange(defaultTemplate.id);
}
```

---

## Template Management Actions

### Global Templates (Super Admin)
Located in: `src/lib/template-actions.ts`

- `createGlobalTemplate()` - Create new global blueprint
- `updateGlobalTemplate()` - Update global blueprint
- `deleteGlobalTemplate()` - Delete global blueprint
- `listGlobalTemplates()` - List all global templates
- `getBlueprintAdoptionStats()` - Get adoption statistics

### Organization Templates (Org Admin)
- `createOrgOverride()` - Create org-specific override
- `updateOrgTemplate()` - Update org template
- `revertToGlobal()` - Delete override, revert to global
- `listTemplates()` - List merged templates (org + global)

### Status Management
- `activateTemplate()` - Make template visible in selectors
- `archiveTemplate()` - Hide template from selectors
- `unarchiveTemplate()` - Restore archived template

---

## Database Schema

### Collection: `message_templates`

**Required Fields**:
```typescript
{
  id: string;
  scope: 'global' | 'organization';
  category: TemplateCategory;        // ✅ FILTER AXIS 1
  channel: MessageChannel;           // ✅ FILTER AXIS 2
  recipientType: RecipientType;      // ✅ FILTER AXIS 3
  status: TemplateStatus;            // ✅ FILTER AXIS 4
  name: string;
  body: string;
  templateType: string;              // Unique identifier
  variableContext: VariableContext;
  declaredVariables: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

**Optional Fields**:
```typescript
{
  organizationId?: string;           // For org-scoped templates
  workspaceIds?: string[];           // For workspace-scoped templates
  globalTemplateId?: string;         // Reference to overridden global template
  subject?: string;                  // Email subject
  previewText?: string;              // Email preview text
  contentMode?: ContentMode;         // 'rich_builder' | 'plain_text'
  blocks?: MessageBlock[];           // Rich content blocks
  reminderConfig?: ReminderConfig;   // For reminder templates
  styleId?: string;                  // Email wrapper style
  target?: TemplateTarget;           // Deprecated, use recipientType
}
```

---

## Composite Indexes Required

For optimal query performance, Firestore requires these composite indexes:

```
message_templates:
  - scope, category, recipientType, channel, status
  - scope, organizationId, category, recipientType, channel, status
  - scope, workspaceIds (array), category, recipientType, channel, status
```

---

## Adding New Template Categories

To add a new studio/category:

### 1. Update Type Definition
**File**: `src/lib/types.ts`

```typescript
export type TemplateCategory =
  | 'general'
  | 'campaigns'
  | 'meetings'
  | 'surveys'
  | 'agreements'
  | 'reminders'
  | 'automations'
  | 'forms'
  | 'invoices'
  | 'tasks'
  | 'alerts'
  | 'your_new_category'; // ✅ Add here
```

### 2. Create Global Templates
Use Backoffice to create global templates with:
- `category: 'your_new_category'`
- `recipientType: 'entity'` (or appropriate type)
- `channel: 'email'` or `'sms'`
- `status: 'active'`

### 3. Use in Studio
```typescript
<MessagingTemplateSelector 
  category="your_new_category"
  recipientType="entity"
  channel="email"
  value={templateId}
  onValueChange={setTemplateId}
/>
```

**That's it!** The filtering system automatically handles the new category.

---

## Troubleshooting

### Templates Not Showing

**Check**:
1. ✅ Template `status` is `'active'`
2. ✅ Template `category` matches selector
3. ✅ Template `recipientType` matches selector
4. ✅ Template `channel` matches selector
5. ✅ Template `scope` is `'global'` OR matches `organizationId`/`workspaceId`
6. ✅ No organization override exists for same `templateType`

### Wrong Templates Showing

**Check**:
1. ✅ Selector is passing correct `category`
2. ✅ Selector is passing correct `recipientType`
3. ✅ Selector is passing correct `channel`
4. ✅ Optional `templateTypePrefix` is not over-filtering

### Organization Override Not Showing

**Check**:
1. ✅ Override has same `templateType` as global template
2. ✅ Override `organizationId` matches current org
3. ✅ Override `status` is `'active'`
4. ✅ Override `category`, `recipientType`, `channel` match selector

---

## Related Files

### Core Logic
- `src/lib/template-actions.ts` - Template CRUD operations
- `src/app/actions/get-filtered-templates-action.ts` - Filtering logic
- `src/app/admin/components/SmartTemplateDropdown.tsx` - UI component
- `src/app/admin/components/MessagingTemplateSelector.tsx` - Wrapper component

### Type Definitions
- `src/lib/types.ts` - MessageTemplate, TemplateCategory, RecipientType, etc.

### Usage Examples
- `src/app/admin/messaging/composer/` - Composer usage
- `src/app/admin/messaging/campaigns/` - Campaign usage
- `src/app/admin/meetings/` - Meeting usage
- `src/app/admin/surveys/` - Survey usage
- `src/app/admin/finance/contracts/` - Contract usage
- `src/app/admin/automations/` - Automation usage

---

## Summary

The app uses a **strict three-axis filtering system** to ensure users only see relevant templates:

1. **Category** - What studio/purpose (meetings, surveys, campaigns, etc.)
2. **Channel** - How to send (email or SMS)
3. **Recipient Type** - Who receives (entity, external_alert, internal_alert, respondent)

Plus:
4. **Status** - Must be `'active'` to be visible
5. **Scope** - Organization overrides take precedence over global templates

This architecture ensures:
- ✅ No template bloat in selectors
- ✅ Context-aware template lists
- ✅ Organization customization support
- ✅ Automatic deduplication
- ✅ Easy extensibility for new studios
