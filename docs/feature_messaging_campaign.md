# SmartSapp Messaging Campaigns — Full Product Specification

> **SmartSapp Campaign Messaging**
> A workspace-based campaign system for Email and SMS that helps teams create, schedule, personalize, track, and optimize outreach with templates, AI assistance, automations, and engagement analytics. WhatsApp support is planned as a separate specification.

---

# 1. Product Vision

SmartSapp Messaging Campaigns lets a workspace user:

* Create **Email** and **SMS** campaigns (WhatsApp planned separately)
* Draft, schedule, or send immediately
* Pick a template or create custom content
* Use AI to draft and improve copy
* Target the exact right audience using workspace-specific entity filters, tags, and contact roles
* Track delivery, opens, clicks, replies, failures, and non-action segments
* Clone campaigns, reuse templates, and resend intelligently
* Trigger follow-up tags and automations based on message engagement

---

# 2. Core Product Rules

## Workspace-first

Campaigns belong to a workspace. Audience, tags, automations, sender profiles, and logs are all workspace-scoped.

## Channel-specific flows

User picks Email or SMS. The wizard adapts per channel. Email needs richer design, subjects, preview text, conditional sections, and click/open analytics. SMS needs length awareness, sender constraints, compliance controls, and click tracking. WhatsApp integration is deferred to a separate specification.

## Audience first, content second

Users define audience before final send. Segmentation is reusable across campaigns and automations.

## Queue-based delivery

Campaigns are queued, not sent directly from the UI. Messages go through rate limiting, tracked links, and delivery optimization.

---

# 3. Template Taxonomy (Three-Axis Classification)

Templates are classified on **three independent axes**. Every template must declare all three.

## Axis 1: Channel (`channel`)

| Value   | Description |
|---------|-------------|
| `email` | Email via Resend |
| `sms`   | SMS via mNotify |

## Axis 2: Module Context (`category`)

| Value        | Description |
|--------------|-------------|
| `surveys`    | Survey invitations, follow-ups, result notifications |
| `meetings`   | Meeting invites, reminders, follow-ups |
| `forms`      | Doc-signing requests, completion notifications |
| `agreements` | Agreement/contract related messages |
| `campaigns`  | Marketing campaigns, newsletters, announcements |
| `reminders`  | Scheduled reminders (deadlines, tasks, events) |
| `tasks`      | Task assignments and updates |
| `automations`| Automation-triggered messages |
| `qr_codes`   | QR code delivery messages |
| `general`    | Miscellaneous / uncategorized |

## Axis 3: Target Audience (`target`)

| Value             | Label (UI)                 | Description |
|-------------------|----------------------------|-------------|
| `external_client` | Uses workspace terminology (e.g. "Institution", "Parent", "Client") | Messages sent to entities/contacts outside the org |
| `internal_team`   | "Team / Staff"             | Messages sent to workspace users, admins, team members |

### Filtering Rules

When a consumer (Survey, Meeting, Automation, Composer) requests templates, it filters on **all three axes**:

```
// Example: Survey module needs an SMS to send to a client
channel === 'sms' AND category === 'surveys' AND target === 'external_client'

// Example: Meeting module needs an email reminder for team
channel === 'email' AND category === 'meetings' AND target === 'internal_team'
```

### UI Labels

The `target` axis uses workspace terminology for `external_client`. The `useTerminology()` hook provides the display label:
- If workspace calls entities "Institutions" → "Institution Templates"
- If workspace calls entities "Clients" → "Client Templates"
- `internal_team` always renders as "Team Templates"

---

# 4. Email Content Modes

When creating an email template or composing an email campaign, the user selects one of **three content modes**:

## Mode 1: Plain Text

Simple text body with `{{variable}}` placeholders. No HTML rendering. Best for transactional alerts and simple notifications.

## Mode 2: HTML/CSS Code Editor

Raw HTML/CSS editor with syntax highlighting. Full control over markup. Includes:
- Live preview pane
- HTML validation warnings
- Variable insertion toolbar
- `{{content}}` compatibility for style wrapper injection

## Mode 3: Rich Email Builder (Block Editor)

Visual drag-and-drop block editor. Available block types:

| Block Type   | Description |
|--------------|-------------|
| `heading`    | H1/H2/H3 with styling |
| `text`       | Rich text paragraph |
| `image`      | Image with URL and alt text |
| `button`     | CTA button with link |
| `divider`    | Horizontal separator |
| `spacer`     | Vertical spacing |
| `list`       | Ordered/unordered list |
| `logo`       | **Dynamic** — pulls from organization logo |
| `header`     | Pre-built header section with dynamic logo |
| `footer`     | Pre-built footer with dynamic org details |
| `score-card` | Data display card |
| `quote`      | Blockquote styling |
| `video`      | Video embed |

Each block supports `visibilityLogic` for conditional display based on variable values.

### Content Mode Storage

```typescript
contentMode: 'plain_text' | 'html_code' | 'rich_builder'
```

- `plain_text` → body field contains raw text
- `html_code` → body field contains raw HTML
- `rich_builder` → blocks[] array contains structured block data

---

# 5. Dynamic Organization Branding

## Dynamic Logo Resolution

Logos in email templates are **never hardcoded**. The `logo` and `header` block types resolve the image URL at render time from the organization record:

```
Resolution order:
1. Organization.logoUrl (from the sending org)
2. Workspace-level override (if configured)
3. Fallback placeholder image
```

The variable `{{org_logo_url}}` is automatically available in all templates and resolves to the organization's current logo URL.

## Dynamic Footer Content

Footer blocks and style wrapper footers use **organization-level placeholders**, not hardcoded values:

| Variable              | Source                       |
|-----------------------|------------------------------|
| `{{org_name}}`        | Organization.name            |
| `{{org_email}}`       | Organization.email           |
| `{{org_phone}}`       | Organization.phone           |
| `{{org_address}}`     | Organization.address         |
| `{{org_website}}`     | Organization.website         |
| `{{org_logo_url}}`    | Organization.logoUrl         |
| `{{current_year}}`    | Computed at send time        |

### Style Wrapper Convention

All style wrappers (`message_styles`) should use these placeholders in their header/footer sections rather than embedding literal organization details. This ensures that when an organization updates their contact info or logo, all future sends automatically reflect the change.

---

# 6. Style Wrapper Rules

## Style is Optional

A template can exist **without** a style wrapper. When `styleId` is `null`, `undefined`, or `'none'`, the template body renders without any wrapper envelope.

- SMS templates never use styles
- Email templates may optionally attach a style
- Plain text emails typically skip styles
- HTML code and Rich Builder emails may optionally use a style

## Style Wrapper Structure

Styles contain a `{{content}}` injection point plus dynamic organization variables:

```html
<html>
<body>
  <div class="header">
    <img src="{{org_logo_url}}" alt="{{org_name}}" />
  </div>
  <div class="content">
    {{content}}
  </div>
  <div class="footer">
    <p>{{org_name}} | {{org_address}}</p>
    <p>{{org_email}} | {{org_phone}}</p>
    <p>© {{current_year}} {{org_name}}</p>
  </div>
</body>
</html>
```

---

# 7. Updated Data Model

## `message_templates` (Updated)

```typescript
interface MessageTemplate {
  id: string;

  // Scope
  scope: 'global' | 'organization';
  organizationId?: string;
  globalTemplateId?: string;

  // THREE-AXIS CLASSIFICATION
  channel: 'email' | 'sms';
  category: TemplateCategory;
  target: 'external_client' | 'internal_team';

  // Content
  name: string;
  contentMode: 'plain_text' | 'html_code' | 'rich_builder';
  subject?: string;
  previewText?: string;
  body: string;
  blocks?: MessageBlock[];

  // Template sub-type (e.g. 'invitation', 'reminder', 'follow_up')
  templateType: string;
  recipientType?: RecipientType;

  // Variables
  variableContext: VariableContext;
  declaredVariables: string[];

  // Reminder config
  reminderConfig?: ReminderConfig;

  // Style (OPTIONAL — null means no wrapper)
  styleId?: string | null;

  // Status & lifecycle
  // draft: work-in-progress, not usable in selectors
  // active: published and available in template selectors
  // archived: soft-hidden, excluded from all consumer template lists, easy to unarchive
  status: 'draft' | 'active' | 'archived';
  version: number;
  previousVersionId?: string;

  // Workspace binding
  workspaceIds?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
```

## `message_campaigns` (New)

```typescript
interface MessageCampaign {
  id: string;
  workspaceId: string;
  organizationId: string;

  // Identity
  internalName: string;
  channel: 'email' | 'sms';
  target: 'external_client' | 'internal_team';

  // Content source
  templateId?: string;
  contentMode: 'plain_text' | 'html_code' | 'rich_builder';
  customSubject?: string;
  customBody?: string;
  customBlocks?: MessageBlock[];

  // Audience
  audienceDefinition: AudienceDefinition;
  audienceSnapshotId?: string; // Frozen at send time

  // Sender
  senderProfileId: string;

  // Schedule
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed' | 'archived';
  scheduledAt?: string;
  sentAt?: string;

  // Post-send behavior
  postSendTagIds?: string[];
  postSendAutomationIds?: string[];

  // Stats (denormalized for list view)
  stats: {
    totalTargeted: number;
    totalSent: number;
    totalFailed: number;
    totalOpened: number;
    totalClicked: number;
  };

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## `message_audiences` (New)

```typescript
interface MessageAudience {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  filters: AudienceFilter[];
  filterLogic: 'AND' | 'OR';
  estimatedCount?: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AudienceFilter {
  field: string; // e.g. 'tags', 'contactRole', 'stage', 'status'
  operator: 'is' | 'is_not' | 'contains' | 'not_contains' | 'any_of' | 'all_of';
  value: any;
}
```

---

# 8. Audience Builder

## Audience Sources

### A. All entities in workspace
Start from all workspace-linked entities.

### B. Role-based contact targeting
Pull recipients by contact role: School Owner, Champion, Billing Officer, Parent, Primary Contact, etc.

### C. Tag-based targeting
- has tag / has any of these tags / has all of these tags / does not have tag

### D. Manual selection
Search and pick specific entities or contacts.

### E. Saved audiences
Save a segment definition for reuse across campaigns.

## Audience Filter Conditions

- Entity type, tags, contact role, assigned owner
- Pipeline, stage, status
- Date created, activity dates
- Survey completion, form submission, task completion
- Invoice status
- Message activity (opened, clicked, replied, failed, never opened, etc.)

---

# 9. Campaign Creation Wizard

## Step 1: Channel + Target
- Select Email or SMS
- Select External Client or Internal Team

## Step 2: Content
- Channel-specific builder (Plain Text / HTML Code / Rich Builder for email; text editor for SMS)
- Template selection or compose from scratch
- AI assistance for drafting/refining
- Variable picker

## Step 3: Audience
- Select from saved audiences or build new
- Tag-based filtering
- Manual entity/contact selection
- Live recipient count

## Step 4: Behavior (Tags & Automations)
- Post-send tagging rules
- Automation triggers on delivery/open/click/failure

## Step 5: Review & Send
- Preview with sample recipient data
- Test send
- Schedule or send now
- Save as draft

---

# 10. Tracking & Analytics

## Metrics per Campaign
- Total targeted, queued, sent, delivered, failed, bounced
- Opened, clicked, replied, unsubscribed (later)

## Recovery Actions
- Resend to failed
- Resend to not opened / not clicked / not replied
- Clone campaign to new audience subset
- Create follow-up automation from campaign results

---

# 11. Post-Send Tagging & Automations

## Tagging Actions
Tag: all targeted, delivered, openers, clickers, repliers, failed, non-openers after X time, non-clickers after X time.

## Automation Hooks
- Email: on delivered, on opened, on clicked, on not opened/clicked after X days, on bounce/failure
- SMS: on delivered, on failed, on replied, on no reply after X time, on clicked (tracked link)

---

# 12. Information Architecture

Inside a workspace:

**Messaging**
- Dashboard (overview + stats)
- Campaigns (list + wizard)
- Templates (gallery + workshop)
- Audiences (saved segments)
- Sender Profiles
- Visual Styles
- Delivery Logs
- Analytics
- AI Assistant
- Settings / Preferences

---

# 13. Phased Rollout

## Phase 1: Template Taxonomy & Dynamic Branding
- Add `target` axis to templates (`external_client` | `internal_team`)
- Add `contentMode` field to templates
- Make `styleId` optional (nullable)
- Implement dynamic org variables (`{{org_logo_url}}`, `{{org_name}}`, etc.)
- Update template filters across Survey, Meeting, and Automation consumers
- Update template gallery UI with three-axis filtering

## Phase 2: Email Content Modes
- Plain text editor
- HTML/CSS code editor with preview
- Rich block editor enhancements (dynamic logo block, dynamic footer block)
- Style wrapper templates using org placeholders
- Template preview with live org branding

## Phase 3: Campaign Entity & Management
- `message_campaigns` collection and types
- Campaign list view (drafts, scheduled, sending, sent, archived)
- Campaign creation wizard (5-step flow)
- Draft save/resume
- Campaign cloning
- Audience snapshot at send time

## Phase 4: Audience Builder & Segments
- Saved audience definitions (`message_audiences` collection)
- Advanced filter builder (tag, role, stage, status, activity)
- Live recipient count
- Audience reuse across campaigns

## Phase 5: Analytics & Engagement
- Campaign-level analytics dashboard
- Open/click/bounce tracking per campaign
- Engagement cohort segmentation
- Resend to failed / non-openers / non-clickers

## Phase 6: Post-Send Automation & Intelligence
- Post-send tagging rules
- Engagement-based automation triggers
- AI copy improvement integration
- A/B subject/body variants (later)

## Phase 7: Advanced Features
- Link tracking (branded shortened links)
- Multilingual templates
- Unsubscribe / preference center (email `List-Unsubscribe` header)
- Send time optimization
- Throttling policies

> **Note:** WhatsApp channel support is planned as a separate product specification.

---

# 14. Strongest Recommendations

1. **Build around campaigns, not messages** — campaigns are the right unit for scheduling, analytics, retries, cloning, and automation hooks.
2. **Keep it workspace-scoped** — all entities respect workspace boundaries.
3. **Three-axis template classification** — channel × category × target eliminates ambiguity and enables precise template filtering.
4. **Dynamic branding over hardcoded assets** — logos and footers always resolve from org data.
5. **Style is optional** — not every template needs a wrapper.
6. **Audience building is reusable** — saved segments are critical for operational efficiency.
7. **Treat SMS differently from email** — character count, tracked links, response segmentation.
8. **Use queue + provider webhooks** — reliability, retries, and performance.

[1]: https://help.activecampaign.com/hc/en-us/articles/220358207-Use-Conditional-Content "Use Conditional Content – ActiveCampaign"
[2]: https://help.activecampaign.com/hc/en-us/articles/221483407-Get-started-with-segments-in-ActiveCampaign "Segments – ActiveCampaign"
[3]: https://www.twilio.com/docs/messaging/features/link-shortening "Link Shortening | Twilio"
[4]: https://resend.com/docs/dashboard/broadcasts/introduction "Managing Broadcasts - Resend"
[5]: https://help.activecampaign.com/hc/en-us/articles/17035619690140-ActiveCampaign-SMS-segment-conditions "SMS segment conditions – ActiveCampaign"
