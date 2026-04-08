This can be turned into a strong v2 of the Meetings module without fighting the current architecture.

Your current Meetings feature already has:

* separate meeting types with dedicated public pages and admin create/edit/results flows 
* attendance tracking and results dashboards 
* an existing automation engine with `MEETING_CREATED` and a node-based builder  
* a workspace-aware entity/contact architecture that can support registrant migration cleanly  

So the right move is not to bolt on webinar behavior as a one-off. It is to evolve Meetings into a proper **meeting + webinar lifecycle module**.

## Product direction

I would evolve the module into four layers:

1. **Meeting configuration**
   Covers hero content, schedule, provider link generation, registration rules, public page sections.

2. **Registration and attendance**
   Distinguish:

   * registrants = people who signed up
   * attendees = people who actually joined

3. **Messaging and automations**
   Invite flows, reminders, confirmations, follow-ups, tagging, contact creation, workspace migration.

4. **Provider integrations**
   Google Meet / Google Calendar / Zoom creation and sync.

That fits the current product shape because Meetings already has admin management, public pages, attendance, messaging hooks, and automations.  

---

# Recommended functional expansion

## 1) Make hero title and description editable per meeting

Today each meeting type appears to imply a fixed hero experience by component: `MeetingHero.tsx`, `KickoffMeetingHero.tsx`, `TrainingMeetingHero.tsx`. 

### Proposed behavior

Each meeting record should store:

* `heroTitle`
* `heroDescription`
* `heroTagline` optional
* `heroImageUrl`
* `heroCtaLabel` optional
* `heroVisibilityConfig` optional

### UX

On create/edit:

* prefill title/description from the selected meeting type defaults
* allow full override
* save the override on the meeting record itself

### Why this is the right fit

You keep the convenience of meeting-type templates while giving every meeting its own public-facing messaging. That matches your requirement that the default should show during creation/editing, but remain editable.

### Suggested type defaults

* Parent Engagement: onboarding-focused
* Kickoff: implementation/timeline-focused
* Training: skills enablement-focused
* Webinar: promotional/registration-focused

---

## 2) Add registration requirements before joining

This is the biggest upgrade because it introduces a second funnel before attendance.

### New concept

A meeting can have:

* `registrationEnabled: boolean`
* `registrationRequiredToJoin: boolean`

These are different:

* enabled = show registration form and capture interest
* required = must register before seeing/joining the live link

### Registration form model

Each meeting should define its own registration schema:

* Name
* Phone Number
* Email
* custom fields
* required/not required on each field
* field type: text, email, phone, select, multi-select, checkbox, textarea

### Stronger design

Instead of free-form fields only, define:

```ts
interface MeetingRegistrationField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
  source?: 'system' | 'workspace_contact_field' | 'custom';
  mappedContactFieldKey?: string;
}
```

This gives you:

* reusable standard fields
* mapping to workspace contact fields
* webinar support tied to contact scope

### Public-page behavior

If registration is required:

* hero section shows `Register` CTA instead of direct join
* after successful registration:

  * optionally show “You’re registered”
  * optionally send confirmation email/SMS
  * optionally show join link only near start time
  * optionally require unique access token for joining

### Storage

Use a subcollection pattern similar to attendees:

* `meetings/{meetingId}/registrants`
* `meetings/{meetingId}/attendees`

That is consistent with the current attendee subcollection approach. 

---

## 3) Let creators view registrants

This should become a first-class view, parallel to results.

### New admin routes

Add:

* `/admin/meetings/[id]/registrants`
* `/admin/meetings/[id]/registrants/[registrantId]`

And place access buttons in:

* meetings list
* edit meeting page
* results page

That aligns with the current admin route pattern for results. 

### Registrant list should support

* search
* filter by status:

  * registered
  * attended
  * no-show
  * migrated to workspace
* export CSV
* bulk actions:

  * tag registrants
  * send reminder
  * migrate to workspace
  * mark as attended
  * resend confirmation

### Registrant detail page should show

* submitted data
* registration timestamp
* source meeting
* attendance status
* automation history
* workspace migration status
* tags applied

---

## 4) Break meeting creation into steps

This is a major usability improvement and should replace the current “single dense form” approach.

## Proposed flow

### Step 1: Meeting details

* workspace / entity / school selection
* meeting type
* title and description
* schedule
* timezone
* provider selection: Google Meet / Zoom / custom link
* slug
* hero image
* recording URL
* brochure
* type tag preview

### Step 2: Registration requirements

* registration on/off
* registration required to join on/off
* which fields to collect
* required flags
* success message / confirmation page
* approval mode:

  * auto approve
  * manual approve
* capacity limits
* waitlist toggle
* privacy checkbox text if needed

### Step 3: Automations, messaging, notifications, tagging

* registration confirmation message
* reminder schedule
* post-event follow-up
* admin alerts
* tags to apply to registrants/attendees
* automation trigger bindings
* workspace migration rules

This is nicely aligned with your existing internal notification and automation patterns.  

---

## 5) Add “Webinar” as a new meeting type

This should be added as a real category, not just a cosmetic label.

Your current module supports three types and type-based public routes.  

### Add:

* `webinar` meeting type
* public route:

  * `/meetings/webinar/[schoolSlug]`
  * or better, eventually unify into `/meetings/[type]/[slug]`

### Webinar-specific defaults

* registration enabled by default
* registration required by default
* presenter/speaker section
* agenda section
* countdown
* event date/time prominence
* calendar add-to-calendar buttons
* replay section after event
* related resources/downloads
* optional questions submission field

---

## 6) Webinar registration based on workspace contact scope

This is one of the smartest parts of your idea because it connects Meetings to the entity model.

Your entity architecture already separates global identity from workspace operational data, and recommends using the adapter rather than hardcoding contact logic.  

### Recommended approach

For webinars, registration fields should be selectable from:

* system fields
* workspace contact fields
* custom meeting-only fields

Example sources:

* `person.firstName`
* `person.lastName`
* `person.email`
* `person.phone`
* `institution.name`
* `family.childCount`
* workspace custom fields
* custom webinar questions

### Why this matters

It avoids duplicating field definitions across the app and makes webinar registration useful for CRM enrichment.

### UX

When meeting category = webinar:

* show “Collect registration details from contact scope”
* user selects contact scope:

  * institution
  * family
  * person
* then choose fields available for that scope

This should be a conditional section in Step 2.

---

## 7) Allow custom sections below the hero

This is a strong content-builder idea.

### Add a flexible `sections` array to the meeting model

Possible section types:

* rich text
* agenda
* speakers
* FAQ
* testimonials
* brochure/resource downloads
* embedded video
* image gallery
* CTA block
* contact/help section

```ts
interface MeetingPageSection {
  id: string;
  type: 'rich_text' | 'agenda' | 'speakers' | 'faq' | 'resources' | 'video' | 'cta';
  title?: string;
  content: Record<string, any>;
  isVisible: boolean;
  order: number;
}
```

### Benefits

* You no longer need to hardcode most of the meeting-type page content
* Parent Engagement, Training, Kickoff, Webinar can all be assembled from reusable sections
* easier to expand into a true event-landing-page system

---

## 8) Always show meeting type as a tag above the hero

Yes, this should be standard across all public pages.

### Display pattern

Small chip above title:

* Parent Engagement
* Kickoff
* Training
* Webinar

This should come from `meeting.type.name`, not hardcoded text, since the meeting type already exists as structured data. 

---

## 9) Webinar-specific option set

Your note trails off, but the missing idea should be expanded into a webinar-specific configuration block.

### Suggested webinar-only options

* require registration
* approval required
* enable waitlist
* limit capacity
* show speakers
* collect questions in advance
* enable reminder sequence
* allow replay after event
* auto-tag registrants
* auto-create/update contact in workspace
* show “Add to Calendar”
* enable unique join links
* enable live chat/Q&A link
* post-webinar survey

This makes webinar a true product mode, not just “another meeting type.”

---

## 10) Registrants/attendants migration into workspaces

This should be designed around the entity architecture, not a one-off import.

The current platform already has a unified identity + workspace operational model and a contact adapter layer.  

## Proposed feature: Workspace Adopter Wizard

From registrants list or registrant detail:

* “Adopt to Workspace”

### Wizard steps

1. Select target workspace
2. Select contact type

   * institution
   * family
   * person
3. Field mapping preview
4. Tag selection for segmentation
5. Deduplication check

   * existing by email
   * existing by phone
   * existing by name + org
6. Create new or merge with existing
7. Confirm adoption

### Storage outcome

* create/update `entities`
* create/update `workspace_entities`
* preserve link back to source meeting + registrant ID

### Good follow-on automations

Once adopted:

* apply tags like `registered-webinar`, `attended-training`, `no-show-kickoff`
* create task
* enroll in nurture flow
* send onboarding resources

This is exactly where the existing automation engine becomes valuable. 

---

# Add new automation trigger: “REGISTERED_FOR_MEETING”

This is a natural extension of the current triggers list, which already includes `MEETING_CREATED`. 

## Proposed trigger

`MEETING_REGISTERED` or user-facing label `Registered for Meeting`

### Payload

```ts
{
  meetingId,
  meetingType,
  workspaceId,
  entityId?,
  entityType?,
  schoolId?,
  registrantId,
  registrantName,
  registrantEmail?,
  registrantPhone?,
  registrationData,
  registeredAt
}
```

### Trigger configuration

In automations page:

* select trigger = Registered for Meeting
* choose one meeting, multiple meetings, or all meetings
* optional filter by meeting type
* optional filter by registration status
* optional filter by tags

### Example automation recipes

* send confirmation email immediately
* wait 1 day, send reminder
* tag as `webinar-interest`
* create follow-up task if high-value registration
* push to workspace adoption
* notify admin if VIP registrant submits form

This fits the existing trigger/action/condition/delay engine without architectural strain.  

---

# Public page lifecycle redesign

The public meeting page should become stateful:

## Before registration

* hero with meeting type tag
* title/description
* date/time/countdown
* custom sections
* register CTA or join CTA depending on configuration

## After registration, before event

* registration confirmation state
* optional “Add to Calendar”
* optional join link hidden until allowed window
* reminder status

## During join window

* join button visible
* attendance captured separately from registration

## After event

* replay/video section
* resources/downloads
* post-event CTA
* follow-up survey

This improves the current public-page model, which already supports countdowns, recordings, brochures, and dynamic states. 

---

# Google and Zoom integrations

You asked for automatic link creation. This should be handled as a provider abstraction.

## Provider model

```ts
type MeetingProvider = 'google_meet' | 'zoom' | 'custom';

interface ProviderConfig {
  provider: MeetingProvider;
  externalMeetingId?: string;
  externalJoinUrl?: string;
  externalHostUrl?: string;
  externalPayload?: Record<string, any>;
  syncStatus?: 'pending' | 'synced' | 'failed';
  syncError?: string;
}
```

## Google services integration

### Google Calendar

When creating a meeting:

* create a Google Calendar event
* request Google Meet conferencing
* save:

  * calendar event ID
  * meet link
  * host link if available
  * sync status

### Benefits

* instant meeting link generation
* calendar invites
* reminder support from Google side
* easy rescheduling sync

### Good UX

In Step 1:

* provider = Google Meet
* “Connect Google”
* “Create Google Calendar event”
* “Auto-generate Google Meet link”

## Zoom integration

### On create

* create Zoom meeting/webinar via API
* save join URL, host URL, external meeting ID
* if webinar product is supported, use Zoom Webinar endpoints for webinar type

### Webinar-specific advantage

Zoom is especially strong for:

* registration-managed webinars
* approval workflows
* unique join links
* attendance reporting

### Recommended strategy

* use Google Meet for standard meetings
* use Zoom Meeting or Zoom Webinar for webinar-heavy workflows
* keep custom link as fallback

---

# Messaging and reminders inside the meeting flow

This is the right place for it. Do not make users leave meeting creation to configure communications.

Your current platform already supports template-driven messaging and admin alerts, and automations can send messages/create tasks.  

## Put these controls in Step 3

### Messaging presets

* registration confirmation
* registration approval
* meeting reminder 24 hours before
* meeting reminder 1 hour before
* meeting started now
* replay available
* no-show follow-up
* attendee thank-you

### Channels

* email
* SMS
* both

### Personalization variables

Use existing variable style from automations/messaging:

* `{{meeting_title}}`
* `{{meeting_type}}`
* `{{meeting_date}}`
* `{{meeting_time}}`
* `{{meeting_link}}`
* `{{registrant_name}}`

This follows the variable-based automation design already in place. 

## Recommended operating modes

1. **Simple mode**
   Toggle-based reminders for non-technical admins.

2. **Advanced mode**
   Generates or links an automation blueprint under the hood.

That way, power users can go deeper, but ordinary admins are not forced into the full visual automation builder.

---

# Recommended data model expansion

Below is the cleanest direction.

## Meeting

Extend the current meeting document:

```ts
interface MeetingV2 {
  id: string;
  workspaceIds: string[];
  entityId?: string;
  entityType?: string;
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;

  type: {
    id: string;
    name: string;
    slug: string;
  };

  meetingTime: string;
  timezone?: string;

  provider: 'google_meet' | 'zoom' | 'custom';
  meetingLink?: string;
  hostLink?: string;
  externalMeetingId?: string;
  calendarEventId?: string;

  heroTitle: string;
  heroDescription: string;
  heroImageUrl?: string;

  registrationEnabled: boolean;
  registrationRequiredToJoin: boolean;
  registrationMode?: 'open' | 'approval_required';
  registrationFields?: MeetingRegistrationField[];

  sections?: MeetingPageSection[];

  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';

  messagingConfig?: {
    sendConfirmation: boolean;
    sendReminders: boolean;
    reminderOffsets: Array<{ value: number; unit: 'minutes' | 'hours' | 'days' }>;
    sendReplayMessage: boolean;
    tagRegistrants?: string[];
    tagAttendees?: string[];
  };

  recordingUrl?: string;
  brochureUrl?: string;
}
```

## Registrant

```ts
interface MeetingRegistrant {
  id: string;
  meetingId: string;
  workspaceIds: string[];
  entityId?: string;
  entityType?: string;
  schoolId?: string;

  status: 'registered' | 'approved' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';
  registrationData: Record<string, any>;

  name?: string;
  email?: string;
  phone?: string;

  registeredAt: string;
  approvedAt?: string;
  attendedAt?: string;

  adoptedToWorkspace?: boolean;
  adoptedWorkspaceId?: string;
  adoptedEntityId?: string;
  tagsApplied?: string[];
}
```

---

# UI changes across the app

## Meetings list

Add columns/actions:

* Type
* Registration enabled
* Registrants count
* Attendees count
* View registrants
* View attendees/results
* Edit
* Public page

## Edit meeting page

Turn into wizard with progress stepper.

## Results page

Split tabs:

* Overview
* Registrants
* Attendees
* Messaging history
* Automation runs

## Public page

Unified rendering engine with type-specific defaults plus section builder.

## Automations page

Add trigger:

* Registered for Meeting

With filter:

* specific meeting
* any meeting of type
* all meetings

---

# Implementation order

## Phase 1

* add Webinar type
* add editable hero title/description
* add type tag on hero
* add multi-step create/edit flow

## Phase 2

* add registration config
* add registrants subcollection
* add registrants list/detail UI
* add public registration flow

## Phase 3

* add workspace adopter wizard
* add automation trigger `REGISTERED_FOR_MEETING`
* add reminder/message controls in meeting flow

## Phase 4

* integrate Google Calendar + Meet
* integrate Zoom Meetings / Zoom Webinar
* add sync states and retry handling

---

# Strategic expansion to make this a real meetings + webinar app

To make this truly strong, I would also add:

* recurring events
* capacity limits and waitlists
* speaker profiles
* agenda builder
* replay/replay gating
* post-event surveys
* no-show and attendee segmentation
* join analytics: registration rate, attendance rate, drop-off rate
* source attribution: how the registrant found the webinar
* calendar invite attachments
* unique access links for approved registrants
* staff/internal notes on a meeting

That would turn Meetings from “schedule and track sessions” into a real engagement funnel product.

## Bottom line

The cleanest path is to evolve Meetings into a configurable event engine with:

* type templates
* editable public content
* registration and attendance as separate lifecycle stages
* workspace-aware registrant adoption
* automation-driven messaging
* provider-managed link generation

That is fully compatible with the current Meetings structure, the current automation engine, and the current entity/workspace architecture.   

I can turn this into a PRD with user stories, flows, data schemas, and phased engineering tickets.
