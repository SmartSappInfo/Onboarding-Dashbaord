# SmartSapp Meetings 2.0

## Industry-Grade Scheduling, Calendar, Conferencing, CRM & Meeting Intelligence Platform

**Document Type:** Product Requirements & Target Architecture
**Version:** 2.0
**Status:** Target Architecture / Implementation Blueprint
**Date:** August 2026
**Product:** SmartSapp CRM
**Primary Stack:** Next.js, TypeScript, Firebase/Firestore, Cloud Functions/Workers
**Architecture Style:** Multi-tenant, event-driven, provider-agnostic, API-first

---

# 1. Executive Summary

SmartSapp currently has a substantial Meetings/Event foundation covering:

* Meeting creation
* Event templates
* Public event pages
* Registration
* Waitlists
* Facilitators
* Tokenized joining
* Attendance
* Invitations
* Reminders
* CRM lead capture
* Surveys
* Webinar/event analytics
* Zoom/Google Meet links
* Post-event workflows

The current architecture, however, is fundamentally centered around:

> **Meeting = scheduled event + registration + communications**

SmartSapp Meetings 2.0 will replace that conceptual limitation with a platform architecture in which:

> **Scheduling, booking, calendar availability, conferencing, meetings, participants, CRM activities, communications, automation and AI are separate but coordinated domains.**

The resulting platform will support:

* Calendly-style booking
* Individual scheduling
* Team scheduling
* Round-robin scheduling
* Collective scheduling
* Group meetings
* Webinars
* Workshops
* Training
* Parent engagement
* Sales demos
* Consultations
* Interviews
* Support meetings
* Recurring meetings
* Drop-in/office hours
* Google Calendar
* Microsoft Outlook/365
* Zoom
* Google Meet
* Microsoft Teams
* Future conferencing providers
* Native SmartSapp meetings
* CRM-aware booking
* CRM activity tracking
* Lead scoring
* Meeting attribution
* Meeting recordings
* Transcription
* AI summaries
* AI action items
* AI meeting preparation
* AI scheduling
* Automated follow-up
* Meeting-driven workflows

The architecture must be designed so that SmartSapp does **not** need another fundamental rewrite when meeting volume reaches millions of bookings or when additional calendar/conferencing providers are introduced.

---

# 2. Product Vision

## 2.1 Vision

Build a unified meeting infrastructure for SmartSapp where every meeting—from a simple internal appointment to a 10,000-person webinar—is represented by a common domain model and can participate in CRM, automation, communication and AI workflows.

## 2.2 Product Principle

The platform must separate:

```text
What can be booked?
        ↓
When can it be booked?
        ↓
Who can host it?
        ↓
What slot was booked?
        ↓
What meeting occurred?
        ↓
How did participants attend?
        ↓
What happened during the meeting?
        ↓
What should SmartSapp do next?
```

---

# 3. Strategic Objectives

SmartSapp Meetings 2.0 must:

1. Provide Calendly-grade scheduling.
2. Provide multi-calendar availability.
3. Provide multi-provider conferencing.
4. Support event/webinar functionality already implemented.
5. Become a first-class CRM activity.
6. Become a first-class automation trigger/action.
7. Support AI before, during and after meetings.
8. Support multi-tenant enterprise operation.
9. Maintain strict tenant and workspace isolation.
10. Support high-volume public booking.
11. Provide auditable state transitions.
12. Be provider-agnostic.
13. Be event-driven.
14. Be resilient to retries and external API failures.
15. Allow future native video infrastructure without redesigning the scheduling domain.

---

# 4. Architectural Principles

## 4.1 Domain separation

Do not make `Meeting` the universal object.

The major domains are:

```text
Scheduling
Calendar
Booking
Meeting
Participant
Conferencing
Communication
CRM
Automation
Intelligence
Analytics
```

---

## 4.2 State versus events

Firestore stores authoritative state.

Events communicate state changes.

Queues execute asynchronous work.

External providers remain external systems of record for their respective resources.

---

## 4.3 API-first

All critical operations must be available through service-layer APIs rather than being implemented directly inside UI components.

Examples:

```text
getAvailability()
createBooking()
confirmBooking()
cancelBooking()
rescheduleBooking()
createConference()
syncCalendar()
getMeetingTimeline()
generateMeetingBrief()
```

---

## 4.4 Provider abstraction

Never allow Zoom, Google Meet, Teams or a specific calendar implementation to become part of the core domain model.

Use adapters.

---

## 4.5 Idempotency

Every externally visible side effect must be idempotent.

This includes:

* Calendar event creation
* Calendar updates
* Conference creation
* Email
* SMS
* WhatsApp
* Webhooks
* CRM activity creation
* AI processing

---

# 5. Target Domain Architecture

```text
Organization
    │
    └── Workspace
          │
          ├── Users
          ├── Teams
          │
          ├── Scheduling Profiles
          │       ├── Individual
          │       ├── Team
          │       └── Routing
          │
          ├── Availability Profiles
          │
          ├── Event Types
          │
          ├── Booking Pages
          │
          ├── Calendar Connections
          │
          ├── Conference Connections
          │
          ├── Bookings
          │
          ├── Meetings
          │
          ├── Participants
          │
          ├── Conference Sessions
          │
          ├── Recordings
          │
          ├── Transcripts
          │
          ├── Meeting Insights
          │
          ├── Meeting Activities
          │
          └── Meeting Events
```

---

# 6. Core Domain Model

## 6.1 Organization

The highest-level tenant boundary.

```typescript
Organization {
  id: string
  name: string
  status: OrganizationStatus
  defaultTimezone: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 7. Workspace

A workspace is the operational isolation boundary inside an organization.

```typescript
Workspace {
  id: string
  organizationId: string
  name: string
  slug: string
  defaultTimezone: string
  status: WorkspaceStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Every Meetings entity must ultimately resolve to:

```text
organizationId
workspaceId
```

---

# 8. User

Users may act as:

* host
* co-host
* scheduler
* administrator
* facilitator
* meeting owner
* participant

```typescript
UserReference {
  userId: string
  workspaceId: string
  displayName: string
  email: string
  avatarUrl?: string
}
```

---

# 9. Team

Teams support pooled and collective scheduling.

```typescript
SchedulingTeam {
  id: string
  workspaceId: string
  name: string
  description?: string

  memberIds: string[]

  schedulingMode:
    | "round_robin"
    | "weighted_round_robin"
    | "pooled"
    | "collective"

  status: "active" | "archived"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 10. Scheduling Profile

A scheduling profile answers:

> Who receives the booking?

```typescript
SchedulingProfile {
  id: string
  workspaceId: string

  type:
    | "individual"
    | "team"

  userId?: string
  teamId?: string

  availabilityProfileId: string

  routingConfig?: RoutingConfig

  timezone: string

  status: "active" | "inactive"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 11. Availability Profile

```typescript
AvailabilityProfile {
  id: string
  workspaceId: string

  timezone: string

  weeklyRules: AvailabilityRule[]

  overrides: AvailabilityOverride[]

  holidayCalendarIds?: string[]

  minimumNoticeMinutes: number

  maximumBookingHorizonDays: number

  defaultBufferBeforeMinutes: number

  defaultBufferAfterMinutes: number

  status: "active" | "inactive"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Example:

```typescript
AvailabilityRule {
  dayOfWeek: 1
  intervals: [
    {
      start: "09:00",
      end: "12:00"
    },
    {
      start: "13:00",
      end: "17:00"
    }
  ]
}
```

---

# 12. Availability Overrides

Overrides take precedence over weekly rules.

```typescript
AvailabilityOverride {
  id: string
  date: string

  type:
    | "available"
    | "unavailable"

  intervals?: TimeInterval[]

  reason?: string
}
```

Examples:

* vacation
* public holiday
* school event
* staff training
* special Saturday availability

---

# 13. Event Type

This is one of the most important entities.

An Event Type defines what people can book.

```typescript
EventType {
  id: string
  workspaceId: string

  name: string
  slug: string

  description?: string

  purpose:
    | "sales"
    | "consultation"
    | "support"
    | "training"
    | "interview"
    | "parent_engagement"
    | "webinar"
    | "internal"
    | "custom"

  format:
    | "one_to_one"
    | "group"
    | "webinar"
    | "panel"
    | "round_robin"
    | "collective"
    | "recurring"
    | "drop_in"

  durationMinutes: number

  bufferBeforeMinutes: number
  bufferAfterMinutes: number

  minimumNoticeMinutes: number
  maximumBookingHorizonDays: number

  schedulingProfileId: string

  availabilityProfileId?: string

  conferenceConfig?: ConferenceConfig

  registrationConfig?: RegistrationConfig

  formConfig?: BookingFormConfig

  messagingConfig?: MeetingMessagingConfig

  crmConfig?: MeetingCRMConfig

  automationConfig?: MeetingAutomationConfig

  brandingConfig?: BookingBrandingConfig

  status:
    | "draft"
    | "active"
    | "archived"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 14. Booking Page

A Booking Page is the public or authenticated experience through which an Event Type is booked.

```typescript
BookingPage {
  id: string
  workspaceId: string

  name: string
  slug: string

  eventTypeIds: string[]

  ownerType:
    | "user"
    | "team"
    | "workspace"

  ownerId: string

  branding: BookingPageBranding

  customDomain?: string

  seoConfig?: SEOConfig

  trackingConfig?: TrackingConfig

  status:
    | "draft"
    | "published"
    | "archived"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 15. Booking

A Booking is the reservation transaction.

```typescript
Booking {
  id: string
  workspaceId: string
  organizationId: string

  eventTypeId: string
  schedulingProfileId: string

  meetingId?: string

  booker: Booker

  hostAssignments: HostAssignment[]

  startAt: Timestamp
  endAt: Timestamp

  timezone: string

  status:
    | "pending"
    | "held"
    | "confirmed"
    | "rescheduled"
    | "cancelled"
    | "declined"
    | "expired"
    | "completed"
    | "no_show"
    | "failed"

  bookingSource:
    | "booking_page"
    | "crm"
    | "admin"
    | "api"
    | "ai"
    | "import"
    | "automation"

  sourceMetadata?: SourceMetadata

  confirmationConfig?: ConfirmationConfig

  cancellation?: CancellationInfo

  rescheduling?: ReschedulingInfo

  idempotencyKey: string

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 16. Booking Hold

Temporary reservation of a slot.

```typescript
BookingHold {
  id: string

  workspaceId: string

  eventTypeId: string
  schedulingProfileId: string

  startAt: Timestamp
  endAt: Timestamp

  sessionId?: string

  expiresAt: Timestamp

  status:
    | "active"
    | "converted"
    | "expired"
    | "cancelled"

  createdAt: Timestamp
}
```

Default hold duration may be 5–10 minutes and should be configurable.

---

# 17. Meeting

Meeting represents the actual occurrence/session.

```typescript
Meeting {
  id: string

  organizationId: string
  workspaceId: string

  bookingId?: string
  eventTypeId?: string
  recurringSeriesId?: string

  title: string
  description?: string

  purpose: MeetingPurpose
  format: MeetingFormat

  startAt: Timestamp
  endAt: Timestamp
  timezone: string

  status:
    | "draft"
    | "scheduled"
    | "active"
    | "completed"
    | "cancelled"

  locationType:
    | "online"
    | "physical"
    | "hybrid"
    | "custom"

  physicalLocation?: PhysicalLocation

  conferenceSessionId?: string

  ownerId?: string

  metadata?: Record<string, unknown>

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 18. Meeting Participant

Participants become a generalized domain object.

```typescript
MeetingParticipant {
  id: string

  meetingId: string

  contactId?: string
  userId?: string
  externalIdentity?: ExternalParticipantIdentity

  role:
    | "host"
    | "co_host"
    | "facilitator"
    | "attendee"
    | "panelist"
    | "guest"

  rsvpStatus:
    | "pending"
    | "accepted"
    | "declined"
    | "tentative"

  attendanceStatus:
    | "not_joined"
    | "joined"
    | "left"
    | "no_show"

  registrationId?: string

  joinedAt?: Timestamp
  leftAt?: Timestamp

  totalAttendanceSeconds?: number

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 19. Registration

The current `MeetingRegistrant` becomes a specialized capability.

```typescript
Registration {
  id: string

  meetingId: string

  participantId: string

  tokenHash: string

  registrationData: Record<string, unknown>

  status:
    | "pending"
    | "registered"
    | "approved"
    | "waitlisted"
    | "cancelled"

  registeredAt: Timestamp
  approvedAt?: Timestamp

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Never store raw bearer join tokens when a secure hash can be used for validation.

---

# 20. Conference Connection

Represents an authenticated provider account.

```typescript
ConferenceConnection {
  id: string

  workspaceId: string
  userId?: string

  provider:
    | "zoom"
    | "google_meet"
    | "microsoft_teams"
    | "daily"
    | "smart_sapp"

  externalAccountId?: string

  credentialReference: string

  scopes: string[]

  status:
    | "connected"
    | "expired"
    | "revoked"
    | "error"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Credentials must be encrypted and stored through a secure secret/credential mechanism rather than ordinary application fields.

---

# 21. Conference Session

```typescript
ConferenceSession {
  id: string

  meetingId: string

  provider: ConferenceProvider

  connectionId?: string

  externalMeetingId?: string

  joinUrl?: string
  hostUrl?: string

  passwordReference?: string

  dialIn?: DialInInformation

  providerMetadata?: Record<string, unknown>

  status:
    | "pending"
    | "creating"
    | "active"
    | "ended"
    | "cancelled"
    | "failed"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 22. Calendar Connection

```typescript
CalendarConnection {
  id: string

  workspaceId: string
  userId: string

  provider:
    | "google"
    | "microsoft"
    | "apple"
    | "ical"

  externalAccountId: string

  selectedCalendarIds: string[]

  freeBusyEnabled: boolean

  eventSyncEnabled: boolean

  credentialReference: string

  webhookReference?: string

  syncCursor?: string

  status:
    | "connected"
    | "syncing"
    | "expired"
    | "revoked"
    | "error"

  lastSyncedAt?: Timestamp

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 23. Calendar Event

External calendar state should have its own representation.

```typescript
CalendarEvent {
  id: string

  calendarConnectionId: string

  externalEventId: string

  meetingId?: string
  bookingId?: string

  startAt: Timestamp
  endAt: Timestamp

  status:
    | "confirmed"
    | "cancelled"
    | "tentative"

  isBusy: boolean

  etag?: string

  externalUpdatedAt?: Timestamp

  lastSyncedAt: Timestamp
}
```

---

# 24. Recurring Series

```typescript
RecurringSeries {
  id: string

  workspaceId: string

  eventTypeId?: string

  title: string

  recurrenceRule: string

  timezone: string

  startDate: string
  endDate?: string

  occurrencePolicy:
    | "materialize_on_demand"
    | "materialize_window"

  status:
    | "active"
    | "paused"
    | "cancelled"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Use RFC 5545-compatible recurrence rules where practical.

---

# 25. Recording

```typescript
MeetingRecording {
  id: string

  meetingId: string

  provider: ConferenceProvider

  externalRecordingId?: string

  recordingUrl?: string

  storageObjectReference?: string

  durationSeconds?: number

  format?: string

  status:
    | "pending"
    | "processing"
    | "available"
    | "failed"
    | "deleted"

  retentionUntil?: Timestamp

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 26. Transcript

```typescript
MeetingTranscript {
  id: string

  meetingId: string
  recordingId?: string

  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"

  language?: string

  segments: TranscriptSegment[]

  speakers: TranscriptSpeaker[]

  createdAt: Timestamp
  completedAt?: Timestamp
}
```

For very large transcripts, segments should not necessarily live in one Firestore document. Store large transcript artifacts in object storage and maintain indexed metadata in Firestore.

---

# 27. Meeting Intelligence

```typescript
MeetingInsight {
  id: string

  meetingId: string

  summary?: string

  keyTopics?: string[]

  decisions?: string[]

  questions?: string[]

  objections?: string[]

  buyingSignals?: string[]

  risks?: string[]

  sentiment?: SentimentResult

  actionItems?: ActionItem[]

  commitments?: Commitment[]

  nextSteps?: string[]

  confidence?: number

  modelMetadata?: AIModelMetadata

  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

# 28. Meeting Activity

Every meaningful interaction should become an activity.

```typescript
MeetingActivity {
  id: string

  workspaceId: string

  meetingId: string

  contactId?: string
  dealId?: string
  companyId?: string

  actorType:
    | "user"
    | "system"
    | "ai"
    | "external"

  actorId?: string

  type: MeetingActivityType

  metadata: Record<string, unknown>

  createdAt: Timestamp
}
```

Examples:

```text
booking_created
booking_confirmed
participant_joined
participant_left
meeting_completed
recording_available
transcript_completed
summary_generated
followup_created
```

---

# 29. Booking Forms

SmartSapp's existing dynamic registration fields should evolve into a reusable form system.

```typescript
BookingFormConfig {
  fields: BookingField[]

  identityResolution:
    | "email"
    | "phone"
    | "email_or_phone"
    | "none"

  crmPrefillEnabled: boolean

  customQuestionsEnabled: boolean

  consentRequirements?: ConsentRequirement[]
}
```

This enables CRM-aware booking.

---

# 30. CRM Integration Model

A booking may resolve to:

```text
Contact
Company
Lead
Deal
Campaign
Owner
```

Example:

```text
Booking
   │
   ├── Contact
   ├── Company
   ├── Deal
   ├── Campaign
   └── Owner
```

The booking should preserve attribution:

```typescript
SourceMetadata {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string

  landingPage?: string
  referrer?: string

  formId?: string
  bookingPageId?: string
}
```

---

# 31. State Machines

# 31.1 Booking State Machine

```text
                 ┌──────────────┐
                 │    PENDING   │
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │     HELD     │
                 └──────┬───────┘
                        │
                 payment/validation
                        │
                        ▼
                 ┌──────────────┐
                 │  CONFIRMED   │
                 └──────┬───────┘
                        │
              ┌─────────┼──────────┐
              │         │          │
              ▼         ▼          ▼
         RESCHEDULED  CANCELLED  COMPLETED
              │
              ▼
         CONFIRMED

CONFIRMED ───────────────► NO_SHOW
HELD ────────────────────► EXPIRED
PENDING ─────────────────► FAILED
```

---

# 32. Booking Transition Rules

### `pending → held`

Allowed when:

* slot is valid
* event type is active
* availability is valid

### `held → confirmed`

Requires:

* hold is still valid
* conflict check passes
* booking data is valid
* required confirmation succeeds

### `held → expired`

Automatic when:

```text
now > expiresAt
```

### `confirmed → rescheduled`

Requires:

* new slot validation
* old slot release
* new booking confirmation

### `confirmed → cancelled`

Requires:

* cancellation policy evaluation
* calendar cancellation
* conference cancellation where applicable
* notifications

---

# 33. Meeting State Machine

```text
DRAFT
  │
  ▼
SCHEDULED
  │
  ├──────────────► CANCELLED
  │
  ▼
ACTIVE
  │
  ▼
COMPLETED
```

Automatic transitions:

```text
startAt reached → ACTIVE
endAt passed → COMPLETED
```

Manual override may be permitted to authorized users.

---

# 34. Participant State Machine

RSVP:

```text
PENDING
 ├── ACCEPTED
 ├── DECLINED
 └── TENTATIVE
```

Attendance:

```text
NOT_JOINED
     │
     ▼
   JOINED
     │
     ▼
    LEFT
```

Rejoin events must not overwrite the original attendance history.

Instead record sessions:

```text
AttendanceSession {
  joinedAt
  leftAt
  durationSeconds
}
```

---

# 35. Registration State Machine

```text
PENDING
   │
   ├── APPROVED
   │      │
   │      ▼
   │   REGISTERED
   │
   ├── WAITLISTED
   │
   └── CANCELLED
```

---

# 36. Conference State Machine

```text
PENDING
   │
   ▼
CREATING
   │
   ├──────────────► FAILED
   │
   ▼
ACTIVE
   │
   ▼
ENDED
   │
   ▼
RECORDING_AVAILABLE
```

---

# 37. Calendar Synchronization State Machine

```text
CONNECTED
   │
   ▼
SYNCING
   │
   ├──────────────► ERROR
   │                   │
   │                   ▼
   │                 RETRY
   │
   ▼
SYNCHRONIZED
```

Credential failures:

```text
CONNECTED
   ↓
TOKEN_EXPIRED
   ↓
REAUTH_REQUIRED
```

---

# 38. Event Model

SmartSapp Meetings must use a canonical event envelope.

```typescript
DomainEvent {
  id: string

  eventType: string
  eventVersion: number

  organizationId: string
  workspaceId: string

  aggregateType: string
  aggregateId: string

  actorType:
    | "user"
    | "system"
    | "ai"
    | "external"

  actorId?: string

  occurredAt: Timestamp

  correlationId: string
  causationId?: string

  idempotencyKey: string

  payload: Record<string, unknown>

  metadata?: Record<string, unknown>
}
```

---

# 39. Core Domain Events

## Meeting

```text
meeting.created
meeting.updated
meeting.published
meeting.started
meeting.ended
meeting.cancelled
```

## Booking

```text
booking.created
booking.held
booking.confirmed
booking.rescheduled
booking.cancelled
booking.expired
booking.completed
booking.no_show
booking.failed
```

## Participant

```text
participant.invited
participant.registered
participant.approved
participant.accepted
participant.declined
participant.joined
participant.left
participant.no_show
```

## Calendar

```text
calendar.connected
calendar.disconnected
calendar.sync.started
calendar.sync.completed
calendar.sync.failed
calendar.event.created
calendar.event.updated
calendar.event.deleted
calendar.event.conflict_detected
```

## Conference

```text
conference.created
conference.creation_failed
conference.started
conference.ended
conference.cancelled
conference.recording_available
conference.participant_joined
conference.participant_left
```

## Intelligence

```text
recording.processing_started
recording.processing_completed

transcript.processing_started
transcript.completed

meeting.ai_analysis.started
meeting.ai_analysis.completed
meeting.ai_analysis.failed

meeting.action_item.created
meeting.insight.created
```

---

# 40. Event Processing Architecture

```text
                Domain Operation
                       │
                       ▼
                Firestore State
                       │
                       ▼
                Domain Event
                       │
                       ▼
                Event Dispatcher
                       │
              ┌────────┼────────┐
              │        │        │
              ▼        ▼        ▼
          Calendar   CRM    Messaging
          Worker     Worker    Worker
              │        │        │
              └────────┼────────┘
                       ▼
                  Automation
                       │
                       ▼
                     AI
```

---

# 41. Event Categories

Use four major categories.

## Synchronous domain commands

Examples:

```text
CreateBooking
CancelBooking
RescheduleBooking
CreateMeeting
```

## Domain events

Examples:

```text
booking.confirmed
meeting.completed
```

## Integration events

Examples:

```text
google.calendar.event.updated
zoom.recording.available
```

## Automation events

Examples:

```text
meeting.completed
→ workflow trigger
```

---

# 42. Command vs Event

Commands:

> "Do this."

Events:

> "This happened."

Example:

```text
CreateBookingCommand
```

results in:

```text
booking.created
```

Then:

```text
booking.created
```

may result in:

```text
calendar.event.create.requested
conference.create.requested
notification.send.requested
crm.activity.create.requested
```

---

# 43. Integration Architecture

SmartSapp should have a dedicated Integration Gateway.

```text
                SMARTSAPP
                    │
            Integration Gateway
                    │
       ┌────────────┼────────────┐
       │            │            │
    Calendar    Conference    Messaging
       │            │            │
   ┌───┼───┐    ┌───┼────┐   ┌──┼───┐
   │   │   │    │   │    │   │  │   │
 Google MS  iCal Zoom Meet Teams Email SMS WhatsApp
```

---

# 44. Calendar Provider Interface

Conceptually:

```typescript
interface CalendarProvider {
  authorize(): Promise<AuthResult>

  listCalendars(): Promise<Calendar[]>

  getFreeBusy(
    request: FreeBusyRequest
  ): Promise<BusyInterval[]>

  createEvent(
    request: CalendarEventRequest
  ): Promise<ExternalCalendarEvent>

  updateEvent(
    request: CalendarEventUpdate
  ): Promise<ExternalCalendarEvent>

  deleteEvent(
    request: CalendarEventDelete
  ): Promise<void>

  subscribeWebhook(
    request: WebhookSubscriptionRequest
  ): Promise<WebhookSubscription>
}
```

Implement:

```text
GoogleCalendarAdapter
MicrosoftCalendarAdapter
ICalendarAdapter
```

---

# 45. Conference Provider Interface

```typescript
interface ConferenceProvider {
  createMeeting(
    request: ConferenceCreateRequest
  ): Promise<ConferenceSession>

  updateMeeting(
    request: ConferenceUpdateRequest
  ): Promise<ConferenceSession>

  cancelMeeting(
    request: ConferenceCancelRequest
  ): Promise<void>

  getMeeting(
    externalId: string
  ): Promise<ConferenceSession>

  getParticipants(
    externalId: string
  ): Promise<ConferenceParticipant[]>

  listRecordings(
    externalId: string
  ): Promise<Recording[]>
}
```

Adapters:

```text
ZoomAdapter
GoogleMeetAdapter
MicrosoftTeamsAdapter
DailyAdapter
SmartSappVideoAdapter
```

---

# 46. Scheduling Engine Architecture

The Scheduling Engine must be independent of the UI.

```text
Availability API
       │
       ▼
Scheduling Engine
       │
       ├── Availability Rules
       ├── Calendar Free/Busy
       ├── Existing Meetings
       ├── Buffers
       ├── Timezone
       ├── Booking Horizon
       ├── Minimum Notice
       ├── Holidays
       ├── Overrides
       ├── Team Rules
       └── Routing Rules
       │
       ▼
Available Slots
```

---

# 47. Slot Calculation Algorithm

For each requested date:

1. Load scheduling profile.
2. Resolve hosts.
3. Resolve availability profile.
4. Load working intervals.
5. Apply date overrides.
6. Apply holidays.
7. Query connected calendars.
8. Query SmartSapp meetings.
9. Merge busy intervals.
10. Apply buffers.
11. Apply minimum notice.
12. Apply booking horizon.
13. Generate candidate slots.
14. Validate host availability.
15. Validate group/team constraints.
16. Validate capacity.
17. Return slots.

The final booking must perform the calculation again.

Never trust the slot displayed to the user.

---

# 48. Conflict Detection

Conflict detection must operate across:

```text
SmartSapp meetings
External calendar events
Temporary booking holds
Team allocations
Conference conflicts
```

The system must distinguish:

```text
hard conflict
soft conflict
ignored event
```

Example:

```text
Calendar event marked "Free"
→ does not block slot
```

while:

```text
Calendar event marked "Busy"
→ blocks slot
```

---

# 49. Booking Transaction

A booking transaction should conceptually execute:

```text
Validate Event Type
       ↓
Validate Host
       ↓
Recalculate Availability
       ↓
Acquire Booking Hold
       ↓
Create Booking
       ↓
Create Meeting
       ↓
Create Conference
       ↓
Create Calendar Event
       ↓
Commit Confirmation
       ↓
Emit booking.confirmed
```

External operations should be orchestrated asynchronously where possible.

If external creation fails:

```text
booking.confirmed
```

must not be emitted prematurely.

Instead:

```text
booking.pending_provisioning
```

or equivalent internal state should be used.

---

# 50. Distributed Transaction Strategy

Because SmartSapp cannot have a true distributed transaction across Firestore, Google Calendar and Zoom, use a saga/orchestration pattern.

Example:

```text
Booking
  │
  ▼
Booking Orchestrator
  │
  ├── Create Calendar Event
  │       │
  │       └── success
  │
  ├── Create Conference
  │       │
  │       └── success
  │
  └── Confirm Booking
```

Failure:

```text
Conference creation failed
       ↓
Retry
       ↓
if permanently failed
       ↓
compensate calendar event
       ↓
mark booking failed
       ↓
notify user
```

---

# 51. Queue Architecture

Recommended:

```text
Firestore
    │
    ▼
Event Dispatcher
    │
    ▼
Durable Queue
    │
    ├── booking-worker
    ├── calendar-worker
    ├── conference-worker
    ├── notification-worker
    ├── crm-worker
    ├── automation-worker
    ├── recording-worker
    └── ai-worker
```

Use retries with exponential backoff.

All workers must support:

* idempotency
* retry
* dead-letter handling
* observability
* correlation IDs

---

# 52. Notification Architecture

Meeting notifications should be a capability of SmartSapp's existing messaging platform.

```text
Meeting Event
      ↓
Notification Policy
      ↓
Message Job
      ↓
Channel Adapter
```

Channels:

```text
Email
SMS
WhatsApp
Push
In-app
```

---

# 53. Notification Events

Examples:

```text
booking.confirmed
booking.rescheduled
booking.cancelled

meeting.starting_24h
meeting.starting_1h
meeting.starting_15m

meeting.completed
meeting.no_show
recording.available
followup.required
```

Users should be able to customize:

* channel
* template
* timing
* audience
* conditions

---

# 54. CRM Event Processing

Example:

```text
booking.confirmed
       ↓
CRM Worker
       ↓
Resolve Contact
       ↓
Create Meeting Activity
       ↓
Update Lead Score
       ↓
Associate Deal
       ↓
Trigger Automation
```

---

# 55. Meeting Scoring

Meetings should feed SmartSapp's existing lead-scoring model.

Configurable actions:

```text
booking_created        +5
booking_confirmed     +10
meeting_attended      +20
meeting_completed     +10
no_show                -5
cancelled              -2
high_intent_AI_signal +25
```

Scores must be configurable by workspace.

---

# 56. Meeting Attribution

Every meeting should support attribution to:

```text
campaign
source
medium
landing page
form
salesperson
CRM record
deal
booking page
referral
```

This allows reporting such as:

> Which campaign produced the most attended sales meetings?

and:

> Which campaign produced the most revenue after meetings?

---

# 57. Automation Integration

Meeting triggers:

```text
Meeting Created
Booking Confirmed
Booking Cancelled
Booking Rescheduled
Meeting Started
Meeting Completed
Participant Joined
Participant No-Show
Recording Available
Transcript Completed
AI Insight Generated
```

Meeting actions:

```text
Create Meeting
Cancel Meeting
Reschedule Meeting
Send Invitation
Send Reminder
Create Task
Update Contact
Update Lead Score
Update Deal
Assign Owner
Send Webhook
Run AI Agent
```

---

# 58. AI Architecture

The AI subsystem should not directly mutate arbitrary meeting state.

Use controlled tools.

```text
AI Agent
   │
   ├── searchContacts()
   ├── getMeeting()
   ├── getAvailability()
   ├── suggestSlots()
   ├── createBooking()
   ├── rescheduleBooking()
   ├── cancelBooking()
   ├── summarizeMeeting()
   ├── createTask()
   └── updateCRM()
```

All destructive operations require authorization and policy enforcement.

---

# 59. AI Scheduling Flow

User:

> "Schedule a 30-minute demo with John next week."

AI:

```text
Resolve John
       ↓
Determine demo Event Type
       ↓
Determine host
       ↓
Determine timezone
       ↓
Query availability
       ↓
Return options
```

If user authorizes:

```text
Create booking
       ↓
Calendar
       ↓
Conference
       ↓
CRM
       ↓
Notifications
```

---

# 60. AI Meeting Preparation

Before a meeting:

```text
Meeting
 ↓
Contact history
 ↓
Previous meetings
 ↓
Open tasks
 ↓
Deal
 ↓
Messages
 ↓
Forms
 ↓
Surveys
 ↓
AI context engine
 ↓
Meeting Brief
```

Output:

```text
Objective
Relationship history
Open issues
Previous commitments
Likely objections
Recommended questions
Recommended next step
```

---

# 61. AI Post-Meeting Processing

```text
Recording
 ↓
Transcription
 ↓
Speaker identification
 ↓
Meeting analysis
 ↓
Structured insights
```

Then:

```text
Summary
Actions
Commitments
Objections
Buying signals
CRM changes
Follow-up
```

Human approval should be configurable before AI updates sensitive CRM data.

---

# 62. Public Booking Security

Public booking is an attack surface.

Implement:

* rate limiting
* bot detection
* CAPTCHA/Turnstile-style protection
* abuse scoring
* IP throttling
* email verification where appropriate
* phone verification where appropriate
* signed booking sessions
* short-lived booking holds
* CSRF protection
* strict validation
* payload size limits

Never expose:

* internal IDs unnecessarily
* calendar credentials
* provider credentials
* private availability details
* internal participant information

---

# 63. Token Security

The current tokenized meeting links should be retained conceptually but hardened.

Use:

```text
cryptographically random token
       ↓
hash token
       ↓
store hash
       ↓
present raw token only to participant
```

For sensitive host actions, use separate host capability tokens with:

* expiry
* scope
* revocation
* audit trail

---

# 64. Multi-Tenant Security

Every request must establish:

```text
Organization
Workspace
User
Role
Permissions
```

Then verify:

```text
resource.workspaceId === activeWorkspaceId
```

Do not rely only on frontend workspace selection.

---

# 65. RBAC

Recommended permissions:

```text
meetings.view
meetings.create
meetings.edit
meetings.delete
meetings.publish

bookings.view
bookings.create
bookings.cancel
bookings.reschedule

availability.view
availability.manage

calendar.connect
calendar.manage

conference.connect
conference.manage

meeting.recordings.view
meeting.recordings.delete

meeting.transcripts.view

meeting.ai.view
meeting.ai.manage

meeting.analytics.view

meeting.export
```

---

# 66. Audit Logging

Record security-sensitive and operational actions:

```text
booking.created
booking.cancelled
booking.rescheduled

calendar.connected
calendar.disconnected

conference.created
conference.cancelled

meeting.updated
meeting.deleted

recording.accessed
recording.deleted

transcript.accessed

AI CRM update approved
AI CRM update rejected
```

---

# 67. Existing Meeting Module Migration

Do not perform a destructive rewrite.

Use a migration strategy.

## Current

```text
meetings/{meetingId}
```

Continue supporting this during migration.

Introduce new entities alongside it.

---

# 68. Migration Mapping

Current:

```text
Meeting
```

maps to:

```text
Meeting
+
EventType
+
Participants
+
ConferenceSession
```

Current:

```text
meetingTime
```

maps to:

```text
startAt
endAt
timezone
```

Current:

```text
meetingLink
```

maps to:

```text
ConferenceSession.joinUrl
```

Current:

```text
MeetingRegistrant
```

maps to:

```text
Participant
+
Registration
```

Current:

```text
MeetingFacilitator
```

maps to:

```text
MeetingParticipant(role=facilitator)
```

Current:

```text
messagingConfig
```

maps to:

```text
Notification Policies
+
Automation
```

---

# 69. Backward Compatibility

Existing URLs must continue working.

For example:

```text
/meetings/[typeSlug]/[entitySlug]
```

should resolve through a compatibility resolver:

```text
Legacy URL
   ↓
Meeting Resolver
   ↓
New Meeting Domain
```

Existing registration APIs should remain operational during migration.

---

# 70. Public API

Recommended API namespaces:

```text
/api/v2/meetings
/api/v2/event-types
/api/v2/booking-pages
/api/v2/bookings
/api/v2/availability
/api/v2/calendars
/api/v2/conferences
/api/v2/participants
/api/v2/recordings
/api/v2/transcripts
/api/v2/meeting-insights
```

---

# 71. Key API Operations

### Availability

```text
GET /availability
POST /availability/preview
```

### Booking

```text
POST /bookings
GET /bookings/:id
POST /bookings/:id/confirm
POST /bookings/:id/reschedule
POST /bookings/:id/cancel
```

### Event Types

```text
GET /event-types
POST /event-types
PATCH /event-types/:id
DELETE /event-types/:id
```

### Meetings

```text
GET /meetings
POST /meetings
GET /meetings/:id
PATCH /meetings/:id
POST /meetings/:id/cancel
```

---

# 72. Booking API Contract

Conceptually:

```typescript
CreateBookingRequest {
  eventTypeId: string

  startAt: string
  timezone: string

  booker: {
    name: string
    email: string
    phone?: string
  }

  answers?: Record<string, unknown>

  contactId?: string

  source?: SourceMetadata

  idempotencyKey: string
}
```

Response:

```typescript
BookingResponse {
  bookingId: string

  status: "confirmed"

  startAt: string
  endAt: string
  timezone: string

  meetingId: string

  conference?: {
    provider: string
    joinUrl: string
  }

  calendar?: {
    status: string
  }
}
```

---

# 73. Database Strategy

Firestore remains appropriate for the operational domain, provided the architecture is designed for:

* cursor pagination
* denormalized read models
* controlled indexes
* asynchronous aggregation
* partitioning by workspace
* avoiding giant documents
* avoiding unbounded arrays

Avoid unbounded arrays for:

* participants
* attendees
* transcript segments
* activity history
* booking history

---

# 74. Recommended Collection Strategy

Conceptually:

```text
organizations/{organizationId}

workspaces/{workspaceId}

eventTypes/{eventTypeId}

schedulingProfiles/{profileId}

availabilityProfiles/{availabilityProfileId}

bookingPages/{bookingPageId}

bookingHolds/{holdId}

bookings/{bookingId}

meetings/{meetingId}

meetingParticipants/{participantId}

registrations/{registrationId}

calendarConnections/{connectionId}

calendarEvents/{calendarEventId}

conferenceConnections/{connectionId}

conferenceSessions/{conferenceSessionId}

recurringSeries/{seriesId}

recordings/{recordingId}

transcripts/{transcriptId}

meetingInsights/{insightId}

meetingActivities/{activityId}

domainEvents/{eventId}

automationJobs/{jobId}
```

Depending on access patterns, some may be scoped under workspace paths instead:

```text
workspaces/{workspaceId}/meetings/{meetingId}
```

The final choice should follow Firestore security and query requirements.

---

# 75. Read Models

For high-performance UI, maintain specialized read models.

Examples:

```text
meetingSummary
bookingSummary
calendarDayView
meetingTimeline
meetingAnalytics
```

Do not repeatedly assemble large views from many Firestore queries in the browser.

---

# 76. Analytics Architecture

Operational data:

```text
Firestore
```

Analytics data:

```text
Event Stream
     ↓
Analytics Pipeline
     ↓
Aggregated Metrics
```

Metrics:

```text
booking conversion
booking cancellation
no-show rate
attendance rate
average attendance
host utilization
calendar utilization
event conversion
meeting conversion
lead-to-meeting
meeting-to-deal
meeting-to-revenue
```

---

# 77. Meeting Utilization

For each host:

```text
Available Time
Booked Time
Meeting Time
Buffer Time
Unbooked Time
```

Calculate:

```text
Utilization =
Booked Meeting Time /
Available Time
```

This becomes important for team scheduling.

---

# 78. Scheduling Analytics

Track:

* slot views
* slot selections
* booking starts
* booking completions
* abandoned bookings
* cancellation
* rescheduling
* no-shows
* booking lead time
* preferred times
* timezone distribution

---

# 79. Webinar Analytics

The existing webinar model remains supported.

Add:

```text
registration conversion
attendance conversion
attendance duration
drop-off
rejoin rate
poll participation
survey completion
CTA clicks
CRM conversion
```

---

# 80. Reliability Requirements

Target:

### Public booking availability

```text
99.9%+
```

### Booking creation

```text
99.95%+
```

### Calendar synchronization

Asynchronous with retry and eventual consistency.

### External provider failure

Must not crash the booking experience.

---

# 81. Idempotency Requirements

Every external side-effecting operation requires:

```text
idempotencyKey
```

Example:

```text
bookingId + operation + provider
```

Workers must check whether the operation has already succeeded before repeating it.

---

# 82. Retry Policy

Suggested classes:

### Transient

Retry:

* network timeout
* HTTP 429
* HTTP 500
* provider temporary outage

### Permanent

Don't retry blindly:

* invalid OAuth credentials
* invalid meeting request
* revoked connection
* invalid calendar

### Dead Letter

After retry exhaustion:

```text
DLQ
 ↓
Admin diagnostics
 ↓
manual retry
```

---

# 83. Observability

Every request and event must carry:

```text
correlationId
causationId
workspaceId
organizationId
aggregateId
```

Track:

* API latency
* booking latency
* calendar sync latency
* provider API errors
* queue depth
* worker failures
* notification failures
* AI processing latency
* booking conversion
* slot-generation latency

---

# 84. External Provider Webhooks

Every provider webhook should flow through:

```text
Webhook Gateway
      ↓
Signature Verification
      ↓
Provider Adapter
      ↓
Normalized Event
      ↓
Event Dispatcher
```

Never allow provider-specific webhook payloads to propagate throughout the application.

---

# 85. Calendar Sync Loop Prevention

Every outbound event should contain internal metadata allowing SmartSapp to recognize events it created.

Example:

```text
smartSappManaged = true
smartSappMeetingId = ...
smartSappBookingId = ...
```

When receiving an external event:

```text
Is this ours?
      │
   yes ─────► reconcile
      │
    no
      │
      ▼
external busy event
```

---

# 86. Timezone Architecture

Store timestamps in UTC.

Always store the user's/event's IANA timezone:

```text
Africa/Accra
America/New_York
Europe/London
```

Never use:

```text
GMT+0
```

as the authoritative timezone identifier.

Display local time at the presentation layer.

---

# 87. DST Handling

The scheduling engine must use timezone-aware libraries and IANA timezone data.

Never calculate recurrence or availability using naive timestamps.

---

# 88. Booking Page Localization

Future-ready architecture should support:

* language
* timezone
* date format
* time format
* currency where applicable
* locale

---

# 89. Capacity Management

Event Types should support:

```text
capacity
minimumParticipants
maximumParticipants
waitlistEnabled
```

For webinars:

```text
10,000+
```

should be supported without loading all participants into one client query.

---

# 90. Public Registration Scaling

For high-volume webinars:

```text
Public Request
      ↓
API
      ↓
Validation
      ↓
Fast registration write
      ↓
Immediate response
      ↓
Async:
    CRM
    notifications
    analytics
    workflows
```

The registration API should not synchronously perform every downstream operation.

---

# 91. CRM Deduplication

Identity resolution should support:

Priority:

```text
CRM contact ID
↓
verified email
↓
verified phone
↓
workspace-specific matching rules
```

Never create duplicate CRM records simply because registration originated from another booking page.

---

# 92. Booking Policies

Event Types should support:

```text
CancellationPolicy
ReschedulingPolicy
LateBookingPolicy
NoShowPolicy
```

Example:

```text
Cancel up to 12 hours before meeting.
Reschedule up to 2 hours before meeting.
```

Policies can trigger:

```text
fee
approval
notification
CRM activity
```

where relevant.

---

# 93. Approval Workflows

Some meetings may require approval.

```text
Booking Request
      ↓
Pending Approval
      ↓
Approved
      ↓
Conference + Calendar
      ↓
Confirmed
```

This preserves the current:

```text
approval_required
```

capability.

---

# 94. Waiting Room Architecture

The current waiting room should become a configurable Meeting Experience.

Modes:

```text
external_provider_redirect
embedded_provider
smart_sapp_room
webinar_stage
waiting_room_only
```

This permits future native video without forcing it today.

---

# 95. SmartSapp Native Meeting Room

Future architecture:

```text
Meeting
 ↓
ConferenceSession(provider=smart_sapp)
 ↓
SmartSapp Meeting Room
```

Potential capabilities:

* video
* audio
* screen sharing
* chat
* reactions
* polls
* Q&A
* breakout rooms
* participant management
* recording
* transcription

This should be implemented only after the scheduling/provider architecture is stable.

---

# 96. Security Model for Recordings

Recordings are sensitive.

Use:

* private object storage
* signed URLs
* short expiration
* permission checks
* access audit logs
* configurable retention
* deletion policies

Never expose permanent public recording URLs.

---

# 97. AI Data Governance

AI processing must respect:

* workspace access
* participant permissions
* recording consent
* retention policies
* data residency requirements where applicable
* provider terms
* user-configured AI settings

AI must never bypass normal CRM authorization.

---

# 98. Meeting Consent

Support:

```text
recordingConsent
transcriptionConsent
aiProcessingConsent
marketingConsent
```

These should be independently configurable.

---

# 99. Event Type Templates

Your existing meeting templates should evolve into reusable SmartSapp templates.

Examples:

```text
Sales Demo
Enrollment Consultation
Parent Consultation
School Onboarding
Staff Training
Customer Success Review
Webinar
Parent Webinar
Internal Team Meeting
Interview
Support Session
```

Each template should define defaults, not hard-code behavior.

---

# 100. Integration with SmartSapp Forms

Any SmartSapp form should be able to submit to:

```text
Create Booking
```

Example:

```text
Lead Form
   ↓
Qualifying questions
   ↓
Routing
   ↓
Meeting booking
```

This enables:

```text
Lead generation
→ qualification
→ scheduling
```

in one journey.

---

# 101. Integration with Landing Pages

Landing pages should have:

```text
Book Meeting
Schedule Demo
Talk to Consultant
Schedule Consultation
```

components that invoke the Meetings API.

---

# 102. Integration with Campaigns

Campaign links should support:

```text
campaignId
contactId
bookingPageId
eventTypeId
```

This allows campaign-level meeting attribution.

---

# 103. Integration with Email

Emails can include:

```text
Book a Meeting
Reschedule
Cancel
Accept
Decline
```

All actions should use secure signed links.

---

# 104. Integration with WhatsApp/SMS

Example:

```text
Your consultation is confirmed for Tuesday at 10:00 AM.

[Join Meeting]

[Reschedule]

[Cancel]
```

Actions resolve through secure booking endpoints.

---

# 105. Integration with Tasks

Meeting outcomes can create tasks:

```text
Follow up with school
Send proposal
Send pricing
Schedule implementation call
```

Tasks should be linked to:

```text
meetingId
contactId
dealId
companyId
```

---

# 106. Integration with Deals

A meeting can:

```text
create deal
advance deal
change owner
change stage
add activity
```

AI can recommend but should not necessarily execute these actions without policy/approval.

---

# 107. Integration with Sales Effort

Meeting activities can become sales-effort events:

```text
meeting_booked
meeting_attended
meeting_completed
followup_completed
```

This fits directly into SmartSapp's existing sales effort model.

---

# 108. Admin Experience

The Meetings hub should eventually contain:

```text
Calendar
Bookings
Meetings
Event Types
Booking Pages
Availability
Teams
Calendar Connections
Conference Connections
Templates
Analytics
Automation
AI
```

---

# 109. Meeting Detail Page

Recommended tabs:

```text
Overview
Participants
Timeline
Calendar
Conference
Registration
Communications
CRM
Notes
Recording
Transcript
AI Insights
Tasks
Automation
Analytics
Settings
```

Tabs should be permission-aware.

---

# 110. Calendar UI

Support:

```text
Day
Week
Month
Agenda
Team
Resource
```

Filters:

```text
Host
Team
Meeting Type
Status
CRM Owner
Workspace
```

---

# 111. Scheduling Page UX

The booking flow should be optimized for:

```text
Mobile
Desktop
Embedded iframe
Popup
Direct URL
QR
Email
SMS
WhatsApp
```

---

# 112. Embedding

SmartSapp should expose:

```text
Inline embed
Popup embed
Button embed
Calendar embed
```

Example conceptual API:

```text
<SmartSappBooking
  eventType="..."
/>
```

Implementation details should be finalized during the frontend architecture phase.

---

# 113. Webhooks

Workspace administrators should be able to subscribe to events.

Examples:

```text
booking.confirmed
booking.cancelled
meeting.completed
participant.joined
recording.available
meeting.ai_analysis.completed
```

Webhook requirements:

* HTTPS only
* HMAC signatures
* timestamp
* replay protection
* retries
* delivery logs
* dead-letter handling

---

# 114. API Keys

External integrations should support:

```text
workspace API key
organization API key
service credentials
OAuth applications
```

Keys must have:

```text
scope
expiration
revocation
lastUsedAt
```

---

# 115. Enterprise Requirements

Future enterprise functionality:

* SSO
* SCIM
* audit exports
* advanced RBAC
* data retention policies
* regional data controls
* API governance
* rate limits
* dedicated integrations
* enterprise reporting

---

# 116. Performance Targets

Target:

### Availability request

P95:

```text
< 500ms
```

under normal operating conditions.

### Booking creation

P95:

```text
< 2 seconds
```

excluding slow third-party provider operations.

### Public booking page

Initial response:

```text
< 1 second target
```

where infrastructure and geography permit.

### Registration

Initial API response:

```text
< 500ms target
```

with downstream operations asynchronous.

---

# 117. Scalability Targets

Architecture should support:

```text
10M+ bookings
1M+ meetings
100K+ event types
100K+ scheduling profiles
10K+ concurrent webinar participants
millions of calendar events
```

without redesigning the core model.

Exact infrastructure sizing should be validated through load testing.

---

# 118. Testing Strategy

## Unit

Test:

* availability calculation
* timezone
* recurrence
* buffers
* booking policies
* state transitions
* routing
* round robin

## Integration

Test:

* Google Calendar
* Outlook
* Zoom
* Meet
* Teams
* messaging
* CRM

## Contract

Validate provider adapters against their expected API behavior.

## Load

Test:

* large webinar registration
* slot generation
* simultaneous booking attempts
* webhook bursts
* reminder spikes

## Chaos

Simulate:

* provider outage
* duplicate webhooks
* delayed webhooks
* token expiration
* queue failures
* Firestore transient failures

---

# 119. Critical Race-Condition Tests

Must test:

```text
100 users
same slot
same millisecond
```

Expected:

```text
only valid capacity bookings succeed
```

For one-to-one scheduling:

```text
1 booking
99 conflicts
```

For capacity 10:

```text
10 confirmed
remaining requests rejected/waitlisted
```

---

# 120. Migration Strategy

## Stage 1

Introduce new domain entities.

No user-visible change.

## Stage 2

Create mapping layer between legacy Meeting and new Meeting.

## Stage 3

Migrate existing meetings.

## Stage 4

Migrate registrations.

## Stage 5

Introduce Event Types.

## Stage 6

Introduce Booking Pages.

## Stage 7

Introduce availability.

## Stage 8

Introduce calendar connections.

## Stage 9

Introduce provider provisioning.

## Stage 10

Move automation and messaging to event-driven architecture.

## Stage 11

Retire legacy meeting-specific infrastructure.

---

# 121. Phase-by-Phase Implementation Roadmap

## Phase 1 — Domain Foundation

Build:

* domain types
* Firestore collections
* repositories
* service layer
* state machines
* event envelope
* authorization
* audit model
* idempotency framework

**Do not build the public booking experience yet.**

---

## Phase 2 — Meeting Refactor

Migrate current:

* Meeting
* Registrant
* Facilitator
* Attendee
* registration
* meeting link

into:

```text
Meeting
Participant
Registration
ConferenceSession
MeetingActivity
```

Maintain backward compatibility.

---

## Phase 3 — Event Types

Build:

* event type CRUD
* templates
* durations
* buffers
* capacity
* registration
* CRM settings
* messaging policies
* conference settings

---

## Phase 4 — Availability Engine

Build:

* working hours
* overrides
* holidays
* timezone
* buffers
* minimum notice
* booking horizon
* conflict detection
* slot calculation

This phase should receive extensive automated testing.

---

## Phase 5 — Booking Engine

Build:

* booking holds
* booking transactions
* confirmation
* cancellation
* rescheduling
* capacity
* waitlists
* approval

---

## Phase 6 — Booking Pages

Build:

* public pages
* calendar UI
* time slots
* forms
* branding
* responsive design
* embeds
* tracking
* SEO

---

## Phase 7 — Google Calendar

Build:

* OAuth
* calendar selection
* free/busy
* event creation
* updates
* cancellation
* webhooks
* sync recovery

---

## Phase 8 — Microsoft Calendar

Add:

* Outlook
* Microsoft 365
* Graph API
* free/busy
* event synchronization

---

## Phase 9 — Conference Providers

Implement adapter architecture.

Then:

```text
Zoom
Google Meet
Microsoft Teams
```

Each must support:

* create
* update
* cancel
* join link
* host link
* provider events
* participant events
* recording metadata

---

## Phase 10 — Advanced Scheduling

Build:

* round robin
* weighted round robin
* collective
* pooled
* routing forms
* recurring
* group
* drop-in

---

## Phase 11 — CRM Integration

Build:

* contact resolution
* meeting activity
* lead scoring
* deal association
* campaign attribution
* sales effort
* task creation
* timeline

---

## Phase 12 — Event-Driven Automation

Migrate:

```text
reminders
invitations
post-event surveys
CRM actions
```

to canonical events and workers.

---

## Phase 13 — Meeting Intelligence

Build:

* recordings
* transcription
* summaries
* action items
* insights
* CRM extraction

---

## Phase 14 — AI Meeting Assistant

Build:

* meeting preparation
* scheduling assistant
* conversational booking
* follow-up generation
* CRM recommendations
* natural-language meeting commands

---

## Phase 15 — Native Meeting Experience

Evaluate:

* SmartSapp video rooms
* native chat
* recording
* transcription
* polls
* Q&A
* breakout rooms

This should be a later strategic investment rather than a prerequisite for the scheduling platform.

---

# 122. Definition of Done for Meetings 2.0

SmartSapp Meetings 2.0 should not be considered mature until a workspace can:

1. Create an Event Type.
2. Configure availability.
3. Connect Google Calendar.
4. Connect Microsoft Calendar.
5. Connect Zoom.
6. Automatically generate conferencing links.
7. Publish a booking page.
8. Accept public bookings.
9. Prevent double bookings.
10. Handle timezone conversion.
11. Send confirmation.
12. Send reminders.
13. Reschedule.
14. Cancel.
15. Handle no-shows.
16. Support team scheduling.
17. Support round robin.
18. Support group meetings.
19. Support webinars.
20. Support recurring meetings.
21. Associate meetings with CRM contacts.
22. Associate meetings with deals.
23. Track meeting activities.
24. Trigger automations.
25. Track campaign attribution.
26. Capture attendance.
27. Ingest recordings.
28. Generate transcripts.
29. Generate AI summaries.
30. Extract action items.
31. Create follow-up tasks.
32. Expose meeting analytics.
33. Maintain a complete audit trail.
34. Survive provider/API failures.
35. Process duplicate webhooks safely.
36. Scale public registration.
37. Maintain strict workspace isolation.
38. Support API access.
39. Support webhooks.
40. Allow future conferencing providers without core-domain changes.

---

# 123. Final Target Architecture

The completed platform should conceptually operate as:

```text
                           SMARTSAPP
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
       CRM               AUTOMATION              AI PLATFORM
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                              │
                    SMARTSAPP MEETINGS
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   SCHEDULING             CALENDAR             CONFERENCE
        │                     │                     │
   Availability          Google Calendar          Zoom
   Event Types           Microsoft 365            Meet
   Booking Pages         iCal                     Teams
   Routing               Free/Busy                Daily
   Round Robin           Sync                     SmartSapp
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                           BOOKING
                              │
                           MEETING
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
       Participants      Attendance        Registration
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                       MEETING TIMELINE
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                Recording Transcript   Notes
                    │         │         │
                    └─────────┼─────────┘
                              │
                       AI INTELLIGENCE
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Summary        Action Items     Buying Signals
             │                │                │
             └────────────────┼────────────────┘
                              │
                        CRM ACTIVITIES
                              │
                  ┌───────────┼───────────┐
                  │           │           │
                Lead        Deal        Tasks
                  │           │           │
                  └───────────┼───────────┘
                              │
                       AUTOMATION ENGINE
                              │
              ┌───────────────┼────────────────┐
              │               │                │
            Email            SMS            WhatsApp
```

---

# 124. Architectural North Star

The most important rule for engineering this system is:

> **Meeting is an occurrence. Booking is a reservation. Event Type is a product that can be booked. Availability determines when it can be booked. Calendar determines external conflicts. Conference Session determines where it happens. Participant determines who attends. CRM Activity determines its business significance. Domain Events determine what the rest of SmartSapp does because it happened. AI determines what SmartSapp can understand and automate about it.**

This separation is what allows the existing SmartSapp webinar/event functionality to coexist with a genuinely scalable Calendly-style scheduling platform.

The existing implementation should therefore be **evolved, not discarded**. Its registration, branding, public-page, facilitator, CRM capture, messaging and webinar capabilities become specialized capabilities sitting on top of the new Meetings Platform rather than defining the platform itself.

# 125. Strategic End State

At maturity, SmartSapp should be able to turn any customer interaction into a schedulable, trackable and intelligent workflow:

```text
Marketing
   ↓
Lead
   ↓
Qualification
   ↓
Routing
   ↓
Booking
   ↓
Calendar
   ↓
Conference
   ↓
Meeting
   ↓
Attendance
   ↓
Recording
   ↓
Transcript
   ↓
AI Intelligence
   ↓
CRM Update
   ↓
Lead Score
   ↓
Deal
   ↓
Follow-up
   ↓
Next Meeting
```
