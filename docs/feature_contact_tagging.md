# Feature: Contact Tagging System

## 1. Purpose

A flexible labeling system for organizing contacts (schools, prospects, focal persons) into meaningful segments. Tags enable targeted campaigns, automation triggers, behavioral tracking, and intelligent filtering — all without modifying core contact fields.

---

## 2. Tag Management

Navigate to **Contacts → Tag Management** to create and maintain your tag library.

### Creating a Tag

1. Click **New Tag** in the top-right corner.
2. Fill in the required fields:
   - **Name** — descriptive label, max 50 characters
   - **Category** — choose from the predefined categories below
   - **Color** — pick from the color palette for visual identification
   - **Description** (optional) — explain the tag's purpose for your team
3. Click **Create Tag**.

Tag names must be unique within your workspace (case-insensitive). The system will warn you if a duplicate exists.

### Editing a Tag

Click the **Edit** (pencil) icon on any tag row. You can update the name, description, color, and category. Changes propagate immediately to all contacts carrying that tag.

> System-generated tags (marked with a lock icon) are read-only and cannot be edited.

### Deleting a Tag

Click the **Delete** (trash) icon. A confirmation dialog shows how many contacts will be affected. Deleting a tag removes it from every contact in your workspace — this action is logged in the audit trail.

### Merging Tags

Use the **Merge** action to consolidate duplicate or redundant tags:

1. Select the source tag(s) you want to eliminate.
2. Choose the target tag that will survive.
3. Confirm the merge.

All contacts that had any source tag will receive the target tag. Source tags are deleted after the merge. The merge is recorded in the audit log.

### Tag Categories

| Category | Purpose | Examples |
|---|---|---|
| **Behavioral** | Actions a contact has taken | `Downloaded Brochure`, `Attended Webinar` |
| **Demographic** | Location, size, or type | `Urban School`, `Large Institution` |
| **Interest** | Product or service interest | `Interested in Analytics`, `Wants Training` |
| **Status** | Current relationship state | `Hot Lead`, `Active Customer`, `VIP` |
| **Lifecycle** | Journey stage | `Prospect`, `Onboarding`, `Renewal Due` |
| **Engagement** | Activity level | `Highly Engaged`, `Inactive`, `Re-engaged` |
| **Custom** | Anything that doesn't fit above | Team-specific labels |

---

## 3. Applying Tags to Contacts

### From a Contact Detail Page

Open any school or prospect record. In the **Tags** section, click **Add Tags**, search for existing tags or type to create a new one inline, then confirm. Tags appear as colored badges on the contact profile.

### From the Contact List (Single Contact)

In the schools or prospects list, hover over a row and use the tag icon in the actions column to quickly add or remove tags without opening the full record.

### Viewing Tags

Tags display as colored badges on contact cards and list rows. Hovering over a badge shows the tag description and the date it was applied. Clicking a badge filters the list to show all contacts with that tag.

---

## 4. Bulk Tag Operations

Bulk operations let you apply or remove tags across hundreds of contacts in a single action.

### Step-by-Step

1. Go to **Schools** or **Prospects**.
2. Select contacts using the checkboxes — use the header checkbox to select all visible contacts, or select individual rows.
3. Click **Bulk Actions** in the toolbar that appears.
4. Choose **Add Tags** or **Remove Tags**.
5. In the dialog, pick the tags you want to apply or remove.
6. Click **Apply** to start the operation.

### Progress Tracking

For operations involving more than 100 contacts, a progress bar shows real-time status: `Processed X of Y contacts`. The system processes contacts in batches of 100 to stay responsive.

When the operation completes, a summary shows:
- How many contacts were successfully updated
- How many failed (if any), with error details

Partial failures are handled gracefully — if one batch fails, the remaining batches continue processing.

### Removing Tags in Bulk

The same flow applies for removal. Select contacts → Bulk Actions → Remove Tags → choose tags → confirm. A confirmation dialog appears before any tags are removed.

---

## 5. Tag-Based Filtering

### Filtering the Contact List

Use the **Filter** panel in the schools or prospects list to filter by tags:

- **Has any of these tags** — shows contacts with at least one of the selected tags (OR logic)
- **Has all of these tags** — shows contacts that have every selected tag (AND logic)
- **Does not have tag** — excludes contacts with the specified tag

Tag filters combine with other filters (status, stage, region, etc.) for precise targeting.

### Tag Search

The tag selector includes a live search field. Start typing to see matching tags — results show the tag name, category, and how many contacts currently carry it. Recent tags appear first.

---

## 6. Tag Naming Best Practices

Consistent naming makes your tag library easy to navigate and prevents duplicates. Pick one convention and stick to it across your team.

### Naming Conventions

**Bracket Notation** — recommended for clarity:
```
[CATEGORY] Descriptor
```
Examples: `[STATUS] Hot Lead`, `[ACTION] Downloaded Brochure`, `[STAGE] Onboarding`

**Colon Notation** — clean and readable:
```
Category: Descriptor
```
Examples: `Interest: Analytics Dashboard`, `Engagement: Highly Active`

**Dash Notation** — compact:
```
Category - Descriptor
```
Examples: `Location - Greater Accra`, `Product - Premium Package`

### Naming Rules

1. **Be specific** — `Downloaded Pricing Guide` is better than `Downloaded Something`
2. **Use Title Case** — `Hot Lead` not `hot lead` or `HOT LEAD`
3. **Use present tense for actions** — `Attended Webinar` not `Attend Webinar`
4. **Avoid acronyms** unless your whole team knows them
5. **Keep it under 50 characters** — the system enforces this limit
6. **Allowed characters**: letters, numbers, spaces, hyphens, underscores, brackets `[]`, and colons `:`

### Recommended Tag Sets by Category

| Category | Suggested Tags |
|---|---|
| Status | `[STATUS] Hot Lead`, `[STATUS] Active Customer`, `[STATUS] Churned`, `[STATUS] VIP` |
| Lifecycle | `[STAGE] Prospect`, `[STAGE] Onboarding`, `[STAGE] Renewal Due` |
| Engagement | `[ENGAGEMENT] Highly Engaged`, `[ENGAGEMENT] Inactive`, `[ENGAGEMENT] Re-engaged` |
| Behavioral | `[ACTION] Downloaded Brochure`, `[ACTION] Attended Demo`, `[ACTION] Visited Pricing` |
| Interest | `[INTEREST] Analytics`, `[INTEREST] Training`, `[INTEREST] Consulting` |
| Location | `[LOCATION] Greater Accra`, `[LOCATION] Ashanti Region` |

### Avoiding Tag Proliferation

- Before creating a new tag, search for existing ones that might already cover the use case.
- Use the **Tag Usage Dashboard** (Tag Management → Analytics) to identify unused tags and clean them up.
- Use **Merge Tags** to consolidate near-duplicates (e.g., `Hot Lead` and `Hot-Lead`).
- Assign tag creation permissions to a small group of admins to maintain governance.

---

## 7. Automation Integration

Tags integrate directly with the SmartSapp automation engine as triggers, conditions, and actions.

### Tag-Based Triggers

Start an automation when a tag is added to or removed from a contact.

| Trigger | When it fires |
|---|---|
| `TAG_ADDED` | Immediately when a tag is applied to a contact |
| `TAG_REMOVED` | Immediately when a tag is removed from a contact |

**Setting up a tag trigger:**

1. Open the Automation Builder and create a new rule.
2. Set the **Trigger** to `Tag Added` or `Tag Removed`.
3. In the trigger configuration, specify:
   - **Tag(s)** — which tags should fire this automation (leave empty to trigger on any tag)
   - **Contact Type** — limit to schools or prospects (optional)
   - **Applied By** — `Manual` (user-applied only) or `Automatic` (system/automation-applied only)

**Example**: Send a welcome sequence when `[STAGE] Onboarding` is added to a school.

### Tag Conditions

Use tag conditions inside automation flows to branch logic based on a contact's current tags.

| Condition | Logic |
|---|---|
| `has_tag` | Contact has at least one of the specified tags |
| `has_any_tag` | Same as `has_tag` — contact has at least one |
| `has_all_tags` | Contact has every one of the specified tags |
| `not_has_tag` | Contact has none of the specified tags |

**Example flow**:
```
Trigger: Form Submitted
  → Condition: has_tag [STATUS] VIP
      → Yes: Send premium onboarding message
      → No: Send standard onboarding message
```

Conditions evaluate in real-time against the contact's current tags at the moment the flow reaches that node.

### Tag Actions

Add or remove tags as steps within an automation flow.

| Action | What it does |
|---|---|
| `add_tags` | Applies one or more tags to the contact |
| `remove_tags` | Removes one or more tags from the contact |

**Example**: After a contact completes onboarding, automatically remove `[STAGE] Onboarding` and add `[STATUS] Active Customer`.

All tag changes made by automations are logged in the audit trail with `appliedBy: automation`.

### Common Automation Patterns

**Lead Scoring via Tags**
```
Trigger: TAG_ADDED ([ACTION] Attended Demo)
  → Action: add_tags [STATUS] Hot Lead
  → Action: Create Task "Follow up within 24 hours"
```

**Re-engagement Campaign**
```
Trigger: TAG_ADDED ([ENGAGEMENT] Inactive)
  → Send Message: Re-engagement email template
  → Wait 7 days
  → Condition: not_has_tag [ENGAGEMENT] Re-engaged
      → Yes: Send follow-up SMS
```

**Lifecycle Progression**
```
Trigger: TAG_ADDED ([STAGE] Renewal Due)
  → Condition: has_tag [STATUS] VIP
      → Yes: Assign to senior account manager
      → No: Send automated renewal reminder
```

---

## 8. Tag Governance & Audit

### Permissions

| Permission | What it allows |
|---|---|
| `View Tags` | See tags on contacts and in the tag library |
| `Apply Tags` | Add and remove tags from contacts |
| `Manage Tags` | Create, edit, delete, and merge tags |

System admins have full tag management access. Regular users can apply existing tags but cannot create or delete them unless granted the `Manage Tags` permission.

### Audit Trail

Every tag operation is logged. Go to **Tag Management → Audit Log** to view:

- Tag created, updated, or deleted
- Tag applied to or removed from a contact
- Bulk operations (with affected contact count)
- Merge operations (with source and target tags)

Each log entry includes the user who performed the action, the timestamp, and relevant metadata.

### Tag Cleanup Tools

The **Tag Management** page includes cleanup utilities:

- **Unused Tags** — lists tags with zero contacts; safe candidates for deletion
- **Merge Duplicates** — identify and consolidate near-identical tags
- **Usage Dashboard** — visualizes tag distribution, growth trends, and most-used tags

---

## 9. System Integrations

| Integration | How tags are used |
|---|---|
| **Automation Engine** | Triggers, conditions, and actions (see Section 7) |
| **Campaign Composer** | Target or exclude contacts by tag when sending bulk messages |
| **Activity Timeline** | Tag changes appear as activity entries on contact records |
| **Contact Filtering** | Tag-based filters in schools and prospects list views |
