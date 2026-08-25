# SmartSapp Meetings 2.0 — Industry-Grade UI/UX Guide

This guide defines the **target UI/UX system** for the mature SmartSapp Meeting platform. It is intended to sit directly underneath the Meeting PRD and give the product/design/engineering teams a concrete interface specification.

The key design decision is that SmartSapp should **not simply reproduce the existing Meetings module with more screens**. The mature product should be a unified **Scheduling + Meetings + Calendar + Booking + Collaboration + CRM Intelligence** platform.

The core scheduling model should follow proven patterns: reusable event types, availability schedules, booking pages, calendar conflict checking, buffers, minimum notice, booking windows, host selection and invitee questions. These are now standard primitives across Calendly, Google Calendar and Microsoft Bookings. ([Calendly.com][1])

---

# 1. Product UX Architecture

The entire experience should revolve around this model:

```text
                     SMARTSAPP MEETINGS
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
       SCHEDULE            BOOK              MEET
          │                 │                  │
     Availability       Booking Pages      Meeting Room
     Calendars          Event Types         Video Provider
     Working Hours      Routing             Participants
     Resources          Forms               Attendance
     Conflicts          Payments            Recording
          │                 │                  │
          └─────────────────┼──────────────────┘
                            │
                       INTELLIGENCE
                            │
                  ┌─────────┼─────────┐
                  │         │         │
                CRM       AI        AUTOMATION
                  │         │         │
               Contact   Summary    Follow-up
               Lead      Actions    Tasks
               Deal      Insights   Campaigns
```

This should be reflected in the navigation and mental model.

---

# 2. Primary Navigation

The Meetings area should have a dedicated second-level navigation.

```text
Meetings

Overview
Calendar
My Meetings
Bookings
Event Types
Booking Pages
Availability
Routing
Meeting Polls
Meeting Rooms
Recordings
AI Insights
```

### Settings

```text
Meeting Settings
├── Calendar Connections
├── Video Providers
├── Availability
├── Notifications
├── Booking Policies
├── Meeting Defaults
├── Branding
├── Security
└── Integrations
```

Do not put all of these into a single settings screen.

---

# 3. Global Meetings UX

Every Meetings page should retain a consistent header:

```text
┌───────────────────────────────────────────────────────────────┐
│ Meetings                                      + Schedule      │
│                                               + Event Type    │
│                                               + Booking Page  │
└───────────────────────────────────────────────────────────────┘
```

The primary action should always be visible.

### Global actions

```text
+ Schedule Meeting
+ Create Event Type
+ Create Booking Page
```

Secondary actions:

```text
Import
Export
Filters
Search
Settings
```

---

# 4. Meetings Overview

## Purpose

The Overview is the operational dashboard.

It should answer:

> What is happening today, what requires attention, and what is coming next?

### Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Good afternoon, John                                         │
│ Here's what's happening with your meetings.                 │
│                                                              │
│ [ Schedule Meeting ] [ Create Event Type ]                   │
├───────────┬───────────┬───────────┬──────────────────────────┤
│ 12        │ 84        │ 76%       │ 9                        │
│ Meetings  │ Bookings  │ Attended  │ Follow-ups               │
├───────────┴───────────┴───────────┴──────────────────────────┤
│                                                              │
│ TODAY                                                        │
│                                                              │
│ 09:00  ─── School Demo                     45 min            │
│          Acme International School                           │
│          Google Meet                                         │
│          [Join] [View] [⋯]                                  │
│                                                              │
│ 11:30  ─── Enrollment Consultation        60 min             │
│          ABC School                                          │
│          Zoom                                                │
│          [Join] [View] [⋯]                                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ REQUIRES ATTENTION                                           │
│                                                              │
│ • 3 meetings have no video link                             │
│ • 2 follow-ups are overdue                                   │
│ • 1 booking request awaiting approval                         │
└──────────────────────────────────────────────────────────────┘
```

---

# 5. Calendar UX

Calendar is a **first-class application**, not simply a view of Meetings.

## Views

Support:

* Day
* 3-day
* Week
* Month
* Agenda
* Team
* Resource

### Toolbar

```text
‹   Today   ›       August 25 – 31, 2026

[Day] [3 Days] [Week] [Month] [Agenda]

[ My Calendar ▼ ] [ Team ▼ ] [ Filters ]
```

---

# 6. Calendar Event Design

Meeting cards should expose enough information without becoming visually heavy.

```text
┌─────────────────────────────┐
│ ● Enrollment Consultation   │
│   10:30 – 11:30             │
│   Mary • ABC School         │
│                             │
│   ● Google Meet             │
└─────────────────────────────┘
```

Use visual indicators for:

* Meeting type
* Status
* Video provider
* Internal/external
* CRM relationship
* Booking source

Example:

```text
● Confirmed
○ Pending
× Cancelled
↻ Rescheduled
✓ Completed
```

---

# 7. Calendar Conflict UX

This is critical.

When scheduling:

```text
Tuesday, August 25

13:00  █████████████
13:30  █████████████  Existing meeting
14:00  ──────────────  AVAILABLE
14:30  ──────────────  AVAILABLE
15:00  █████████████  Team meeting
```

If the user selects a conflicting slot:

```text
⚠ Scheduling conflict

John is already scheduled from
14:00–15:00.

Options:

[ Choose another time ]

[ Schedule anyway ]

[ Find team member available ]
```

Do not silently permit double booking.

Google's appointment scheduling model explicitly checks connected calendars to prevent conflicts, and Google supports buffers, minimum lead time, maximum advance booking and maximum bookings per day. These should be baseline SmartSapp UX primitives. ([Google Support][2])

---

# 8. Schedule Meeting UX

There should be two modes.

## Quick Schedule

For internal users who already know what they want.

```text
Schedule Meeting

Title
[ Enrollment Strategy Session ]

Meeting type
[ Consultation ▼ ]

Host
[ John Mensah ▼ ]

Invitees
[ Search contacts ]

Date
[ Aug 26 ]

Time
[ 14:00 ] – [ 15:00 ]

Location
○ Google Meet
○ Zoom
○ Microsoft Teams
○ SmartSapp Room
○ Phone
○ In person

[ More options ]

                         [Cancel] [Schedule]
```

---

# 9. Advanced Scheduling

"More options" opens an expandable configuration panel.

```text
MEETING DETAILS

Description
[................................................]

Agenda
[................................................]

Attachments
[ Add files ]

SCHEDULING

Duration
[ 60 minutes ]

Buffer before
[ 15 minutes ]

Buffer after
[ 15 minutes ]

Start-time interval
[ 30 minutes ]

Minimum notice
[ 4 hours ]

Maximum advance booking
[ 60 days ]

Maximum attendees
[ 10 ]
```

These concepts align with established scheduling systems such as Google Appointment Schedules and Calendly. ([Google Support][3])

---

# 10. Event Types

This is one of the biggest architectural/UI changes I recommend.

The existing Meeting object should **not be the primary reusable scheduling primitive**.

Introduce:

> **Event Type**

An Event Type is a reusable meeting definition.

Examples:

```text
Enrollment Consultation
30 min
1:1
Google Meet

School Demo
45 min
1:1
Zoom

Parent Orientation
60 min
Group
SmartSapp Room

Staff Training
90 min
Group
Teams

Sales Discovery
30 min
Round Robin
Zoom
```

Calendly uses reusable Event Types as the core abstraction and supports one-on-one, group, collective and round-robin meeting formats. SmartSapp should adopt this pattern while extending it with CRM-aware behavior. ([Calendly.com][4])

---

# 11. Event Type Library

```text
Event Types

Search event types...

[ All ] [ Personal ] [ Team ] [ CRM ] [ Hidden ]

┌─────────────────────────────────────────────────────────────┐
│ Enrollment Consultation                        Active ●     │
│ 30 minutes • 1:1 • Google Meet                             │
│                                                             │
│ 126 bookings   72% attendance                              │
│                                                             │
│ [Preview] [Copy Link] [Book] [Edit] [⋯]                   │
└─────────────────────────────────────────────────────────────┘
```

Cards should expose:

* Name
* Description
* Duration
* Meeting format
* Host
* Location
* Booking URL
* Status
* Booking count
* Conversion
* Last booking

---

# 12. Event Type Editor

Use a **persistent left navigation + editor canvas** rather than a seven-step wizard.

```text
┌────────────────┬──────────────────────────────────────────┐
│ Event Type     │ Enrollment Consultation                  │
│                │                                          │
│ Overview       │ Event name                               │
│ Availability   │ [ Enrollment Consultation ]              │
│ Hosts          │                                          │
│ Location       │ Description                              │
│ Questions      │ [...................................]    │
│ Booking        │                                          │
│ Notifications  │ Duration                                 │
│ Workflows      │ [30 min ▼]                               │
│ CRM            │                                          │
│ Payments       │ Location                                 │
│ Branding       │ [Google Meet ▼]                          │
│ Advanced       │                                          │
│                │                                          │
│                │ [Save Changes]                           │
└────────────────┴──────────────────────────────────────────┘
```

This is considerably easier to scale than adding more wizard steps.

---

# 13. Event Type Editor Sections

## Overview

```text
Name
Description
Duration
Meeting format
Color
Visibility
```

## Availability

```text
Availability schedule
[ Default Working Hours ▼ ]

Date range
○ Indefinite
○ Specific dates

Minimum notice
[ 4 hours ]

Maximum advance
[ 60 days ]

Buffers
Before [15m]
After  [15m]

Start intervals
[30m]

Daily limit
[5 meetings]
```

---

# 14. Host Configuration

Support:

### One-to-one

```text
Host
John
```

### Group

```text
Host
John

Maximum invitees
25
```

### Collective

```text
All must attend

John
Sarah
Michael
```

### Round robin

```text
Distribution

John      33%
Sarah     33%
Michael   34%

○ Equal distribution
○ Least booked
○ Most available
○ Weighted
```

This should eventually become a **routing engine**, not simply a dropdown.

---

# 15. Availability UX

Availability deserves its own product surface.

```text
Availability

Schedules

┌────────────────────────────────────────────────────────────┐
│ Default Working Hours                                      │
│ Mon–Fri                                                     │
│ 08:00 – 17:00                                               │
│                                                             │
│ Used by 12 event types                                      │
│                                                             │
│ [Edit] [Duplicate] [⋯]                                    │
└────────────────────────────────────────────────────────────┘
```

---

# 16. Availability Editor

```text
Monday

☑ Available

08:00 ─────────────── 12:00

13:00 ─────────────── 17:00

[ + Add time ]

Tuesday

☑ Available

08:00 ─────────────── 17:00
```

Support:

* multiple windows/day
* holidays
* blackout dates
* custom dates
* seasonal schedules
* timezone
* team schedules
* resource schedules

---

# 17. Timezone UX

Never assume the invitee and host share a timezone.

Booking page:

```text
Timezone

🌐 Africa/Accra

Change timezone
```

Allow:

```text
Automatically detect
Africa/Accra
Europe/London
America/New_York
Asia/Dubai
...
```

The displayed time must be localized while the underlying event remains timezone-aware.

---

# 18. Booking Pages

Booking Pages should be a dedicated product.

```text
Booking Pages

My Booking Page

https://meet.smartsapp.com/john

[Preview] [Share] [Copy Link]

Event Types

✓ Enrollment Consultation
✓ School Demo
✓ Strategy Session
```

Support:

* personal booking pages
* team booking pages
* event-specific pages
* public pages
* private pages
* password-protected pages
* CRM-tokenized pages
* campaign-specific pages
* embedded booking widgets

Google and Microsoft both treat the booking page as a customer-facing scheduling surface rather than merely a calendar URL. ([Google Support][2])

---

# 19. Booking Page Builder

This should eventually use the same design-system philosophy as SmartSapp's existing Page Builder.

```text
┌───────────────┬─────────────────────────────┬───────────────┐
│ COMPONENTS    │       CANVAS                │ SETTINGS      │
│               │                             │               │
│ Header        │   ┌─────────────────────┐   │ Branding      │
│ Profile       │   │ John Mensah         │   │               │
│ Description   │   │ Enrollment Expert   │   │ Logo          │
│ Event List    │   │                     │   │ [Upload]      │
│ Calendar      │   └─────────────────────┘   │               │
│ Testimonials  │                             │ Colors        │
│ FAQ           │   Enrollment Consultation  │               │
│ Custom HTML   │                             │ Button        │
│               │   [ Select a time ]        │               │
└───────────────┴─────────────────────────────┴───────────────┘
```

---

# 20. Booking Experience

This is the **highest-traffic public UX** and must be extremely simple.

Recommended:

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│             SMARTSAPP                               │
│                                                     │
│         Enrollment Consultation                    │
│         30 minutes                                  │
│         Google Meet                                 │
│                                                     │
│ ┌──────────────────┐ ┌───────────────────────────┐ │
│ │ August 2026      │ │ Wednesday, Aug 26         │ │
│ │                  │ │                           │ │
│ │ Mo Tu We Th Fr   │ │ 09:00  [ ]               │ │
│ │ 24 25 26 27 28   │ │ 09:30  [ ]               │ │
│ │                  │ │ 10:00  [ ]               │ │
│ └──────────────────┘ │ 10:30  [ ]               │ │
│                      └───────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

After time selection:

```text
Your details

First name
[                         ]

Last name
[                         ]

Email
[                         ]

Phone
[                         ]

School
[                         ]

What would you like to discuss?
[................................]

[ Confirm Booking ]
```

Avoid unnecessary questions.

---

# 21. CRM-Aware Booking

This is where SmartSapp should differentiate itself.

If the visitor is already recognized:

```text
Welcome back, Kwame.

We found your SmartSapp contact profile.

Kwame Mensah
ABC International School

[ Continue as Kwame ]
[ Use different details ]
```

The booking should associate with:

```text
Contact
↓
Organization
↓
Lead
↓
Deal
↓
Campaign
↓
Meeting
```

---

# 22. Smart Booking Questions

Questions should support conditional logic.

```text
What are you interested in?

○ SmartSapp CRM
○ Fee collection
○ Enrollment
○ School management
○ Other
```

If:

```text
Enrollment
```

then display:

```text
How many students?

[ 500–1,000 ▼ ]
```

This data can influence:

* routing
* host selection
* meeting type
* CRM lead score
* automation
* notifications

---

# 23. Booking Confirmation

Avoid a generic "Success" page.

Use:

```text
✓ You're booked

Enrollment Consultation

Wednesday, August 26
10:30 – 11:00
Africa/Accra

Google Meet
[ Join Google Meet ]

John Mensah
SmartSapp

[ Add to Google Calendar ]
[ Add to Outlook ]
[ Add to Apple Calendar ]

────────────────────────

Need to change this?

[ Reschedule ] [ Cancel ]
```

Below:

```text
What happens next

1. You'll receive a confirmation email.
2. We'll send a reminder 24 hours before.
3. John will review your information before the meeting.
```

---

# 24. Meeting Detail Page

Internal meeting page:

```text
Enrollment Consultation

Wednesday, Aug 26
10:30 – 11:00
Google Meet

[Join Meeting] [Reschedule] [Cancel] [⋯]
```

Then tabs:

```text
Overview | Participants | CRM | Notes | Recording | AI | Activity
```

---

# 25. Overview Tab

```text
MEETING

Enrollment Consultation
30 minutes
Confirmed

LOCATION
Google Meet
[Join]

HOST
John Mensah

PARTICIPANTS
Kwame Mensah
ABC International School

BOOKED
Aug 20, 14:32

SOURCE
Enrollment Campaign

STATUS
Upcoming
```

---

# 26. CRM Tab

This should be a first-class experience.

```text
CRM CONTEXT

Kwame Mensah

Contact
● Warm Lead

ABC International School

Lead Score
78 ↑

Deal
Enrollment Growth — GHS 12,500

Previous interactions
────────────────────────
Email opened ×4
Landing page visited ×3
Survey completed
Meeting booked
```

The meeting becomes an **activity within the CRM timeline**, not an isolated object.

---

# 27. Participant UX

```text
Participants

┌─────────────────────────────────────────────────────────┐
│ Kwame Mensah                                             │
│ ABC International School                                │
│                                                         │
│ Registered    ✓                                          │
│ Confirmed     ✓                                          │
│ Attended      —                                          │
│                                                         │
│ Email: kwame@...                                        │
│ Phone: +233...                                         │
│                                                         │
│ [View Contact] [Send Message]                           │
└─────────────────────────────────────────────────────────┘
```

---

# 28. Meeting Room UX

SmartSapp should eventually have a native meeting-room experience.

```text
┌───────────────────────────────────────────────────────────────┐
│ SmartSapp Meeting                              10:32          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                         VIDEO                                 │
│                                                               │
│                                                               │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ 🎤   📹   🖥   💬   👥   ✋   ⋯                     🔴 Leave   │
└───────────────────────────────────────────────────────────────┘
```

But the UX should support external providers equally:

```text
Google Meet
Zoom
Microsoft Teams
SmartSapp Room
```

The user should not care which provider is underneath.

---

# 29. Provider UX

Under:

**Settings → Video Providers**

```text
Video Providers

Google Meet
● Connected
SmartSapp can automatically generate meeting links.

[Configure]

Zoom
● Connected

[Configure]

Microsoft Teams
○ Not connected

[Connect]

SmartSapp Rooms
● Available
```

When creating an event:

```text
Location

[ Google Meet ▼ ]

Automatically generate meeting link
☑

Fallback provider
[ Zoom ▼ ]
```

---

# 30. Meeting Intelligence

After the meeting:

```text
AI INSIGHTS

Meeting Summary

The school is currently experiencing...
.........................................

Key Topics

• Fee collection
• Enrollment
• Parent communication

Decisions

✓ Schedule enrollment audit
✓ Send pricing information

Action Items

□ John — Send proposal
□ Kwame — Provide student numbers

CRM Insights

Lead intent: HIGH
Buying stage: CONSIDERATION
Primary concern: Enrollment
Recommended next action: Proposal
```

---

# 31. AI Assistant

Add an AI side panel.

```text
┌──────────────────────────────┐
│ Meeting AI                   │
├──────────────────────────────┤
│ Ask about this meeting...    │
│                              │
│ "What did they object to?"  │
│                              │
│ "Create follow-up task"      │
│                              │
│ "Draft follow-up email"      │
│                              │
│ "Update lead score"          │
│                              │
│ "Summarize for management"   │
└──────────────────────────────┘
```

AI should be **action-capable**, but destructive CRM actions must require confirmation.

---

# 32. Recording UX

```text
Recording

▶ 00:00 ───────────────── 43:21

Chapters

00:00 Introduction
04:32 Enrollment challenges
13:10 Fee collection
27:45 Product discussion
38:20 Next steps

Transcript

[ Search transcript... ]

Speaker 1
....................................

Speaker 2
....................................
```

AI-generated chapters should be clickable and jump to timestamps.

---

# 33. Meeting Activity Timeline

Every meeting should have an immutable activity timeline.

```text
ACTIVITY

10:32
Meeting started

10:31
Kwame joined

10:29
John joined

Yesterday
Reminder sent

Aug 20
Booking created

Aug 20
CRM contact linked

Aug 19
Invitation sent
```

This should integrate into the global SmartSapp activity/event system.

---

# 34. Booking Management

Create a dedicated **Bookings** interface.

```text
Bookings

[All] [Upcoming] [Pending] [Completed] [Cancelled] [No-show]

Search...

┌────────────┬──────────────────────┬──────────────┬─────────────┐
│ Contact    │ Event                │ Date         │ Status      │
├────────────┼──────────────────────┼──────────────┼─────────────┤
│ Kwame      │ Enrollment Consult   │ Aug 26 10:30 │ Confirmed   │
│ Ama        │ School Demo          │ Aug 26 14:00 │ Confirmed   │
│ Kojo       │ Strategy Session     │ Aug 27 09:00 │ Pending     │
└────────────┴──────────────────────┴──────────────┴─────────────┘
```

---

# 35. Booking Status Design

Use consistent semantic states:

```text
Pending
Confirmed
Checked-in
In progress
Completed
Cancelled
Rescheduled
No-show
Expired
```

Do not create dozens of visually different status badges.

---

# 36. Meeting Polls

For meetings involving many participants:

```text
Create Meeting Poll

Who should attend?

[ Sarah ]
[ John ]
[ Michael ]
[ + ]

Find times

☑ Check connected calendars

Proposed dates:

Wed Aug 26
10:00
11:00
14:00

Thu Aug 27
09:00
13:00
15:00

[ Send Poll ]
```

Poll results:

```text
               Wed 10   Wed 11   Thu 13
Sarah             ✓       ✓        ×
John              ✓       ×        ✓
Michael           ✓       ✓        ✓

Best time
★★★★★ Wed 10:00

[ Schedule ]
```

---

# 37. Routing UX

This should become a major SmartSapp differentiator.

```text
Routing Rules

New booking
      │
      ▼
What type of lead?
      │
 ┌────┴─────┐
 │          │
School     Other
 │
 ▼
Student count?
 │
 ┌──────┬───────┐
 <500   500+
 │       │
Sarah   John
```

Routing criteria:

* CRM lead score
* organization
* school size
* geography
* product interest
* campaign
* owner
* language
* availability
* round-robin
* workload

---

# 38. Automation UX

Each Event Type should have:

```text
Workflows

BEFORE MEETING

○ Immediately after booking
○ 24 hours before
○ 1 hour before
○ 15 minutes before

AFTER MEETING

○ Immediately after
○ 1 hour after
○ 1 day after

Actions

Send Email
Send SMS
Send WhatsApp
Create Task
Update Contact
Update Lead Score
Add Tag
Create Deal
Notify User
Trigger Automation
```

---

# 39. CRM Timeline Integration

Meeting events should appear naturally in the CRM.

```text
CONTACT TIMELINE

Aug 26
🎥 Meeting completed
Enrollment Consultation
30 min
[View Meeting]

Aug 25
✉ Email opened
Enrollment Growth #4

Aug 24
📄 Assessment completed
Score: 82

Aug 23
📞 Call completed
```

This is essential.

The Meeting platform should **feed the CRM rather than compete with it**.

---

# 40. Mobile UX

Do not simply shrink desktop screens.

Mobile should prioritize:

```text
Today

10:30
Enrollment Consultation

ABC International School

[Join]

14:00
School Demo

[Join]
```

Bottom navigation:

```text
Home | Calendar | Meetings | Inbox | More
```

Meeting actions:

```text
Join
Reschedule
Cancel
Message
View Contact
Notes
```

---

# 41. Responsive Breakpoints

Recommended:

```text
Mobile
< 640px

Tablet
640–1023px

Desktop
1024–1439px

Large desktop
1440px+
```

Calendar should switch from grid to agenda mode on smaller screens.

---

# 42. SmartSapp Visual Language

Continue the SmartSapp design system:

### Primary

```text
#3A86FF
```

Typography:

* Poppins
* Figtree
* Didact where appropriate

Use the primary blue primarily for:

* primary CTAs
* active navigation
* selected states
* links
* scheduling actions

Do **not** turn the entire Meeting UI blue.

---

# 43. Component Standards

Build reusable components:

```text
MeetingCard
MeetingStatusBadge
MeetingTimeline
CalendarGrid
CalendarEvent
AvailabilityEditor
EventTypeCard
EventTypeEditor
BookingCalendar
BookingTimeSlots
BookingForm
BookingConfirmation
ParticipantList
HostSelector
RoutingRuleBuilder
MeetingRoom
MeetingTranscript
AIInsightPanel
MeetingActivityTimeline
ProviderSelector
CalendarConnectionCard
```

These should be shared across Meetings, CRM, Tasks and Automations.

---

# 44. Form UX Standards

All forms should use:

### Labels above fields

```text
Meeting duration
[ 30 minutes ▼ ]
```

Not:

```text
[ 30 minutes ▼ ]
Meeting duration
```

### Inline validation

```text
Meeting duration
[             ]

⚠ Duration must be greater than 0.
```

### Progressive disclosure

Do not expose 50 settings at once.

Basic:

```text
Title
Host
Duration
Location
Availability
```

Advanced:

```text
Booking limits
Buffers
Routing
CRM
Notifications
Security
```

---

# 45. Destructive Actions

Never use ambiguous buttons.

Bad:

```text
[Delete]
```

Better:

```text
Delete event type?

This will prevent new bookings, but existing meetings will remain unchanged.

[Cancel] [Delete Event Type]
```

For cancellation:

```text
Cancel meeting?

☑ Notify attendees

Message:
[................................]

[Keep Meeting] [Cancel Meeting]
```

---

# 46. Empty States

Every page needs a meaningful empty state.

Example:

```text
No event types yet

Create reusable meeting types that people
can book from your SmartSapp booking pages.

[ Create Event Type ]
```

Not:

```text
No data.
```

---

# 47. Loading States

Never use a full-page spinner for normal operations.

Use skeletons:

```text
┌────────────────────────────┐
│ █████████████████          │
│ ███████                    │
│ ███████████████            │
└────────────────────────────┘
```

Booking availability should use slot-level loading:

```text
10:00  [······]
10:30  [······]
11:00  [······]
```

---

# 48. Error UX

Errors should explain:

**What happened → Why → What to do.**

Example:

```text
Unable to create Google Meet link

Your Google Calendar connection has expired.

[Reconnect Google Calendar]
```

Not:

```text
Error 500
```

---

# 49. Permission UX

Meeting permissions should be understandable.

```text
Meeting permissions

Who can view?
○ Everyone in workspace
○ Team members
○ Hosts only
○ Specific users

Who can edit?
○ Workspace admins
○ Hosts
○ Assigned team
```

For external booking:

```text
Public
Private
Secret
Password protected
CRM authenticated
```

---

# 50. Accessibility Requirements

Industry-grade means:

* WCAG 2.2 AA target
* full keyboard navigation
* visible focus states
* semantic HTML
* ARIA only where necessary
* screen-reader compatible calendar
* accessible modal dialogs
* 4.5:1 minimum normal text contrast
* 3:1 large text/UI component contrast
* no color-only status indication
* reduced-motion support
* accessible date/time picker
* accessible drag-and-drop alternatives

Calendar drag-and-drop must have a keyboard alternative.

---

# 51. Design-System Rules

Establish tokens rather than styling individual screens.

```text
spacing-xs
spacing-sm
spacing-md
spacing-lg
spacing-xl

radius-sm
radius-md
radius-lg

shadow-sm
shadow-md

text-primary
text-secondary
text-muted

surface-primary
surface-secondary
surface-hover

status-success
status-warning
status-error
status-info
```

This will prevent the Meeting platform from becoming visually inconsistent with the rest of SmartSapp.

---

# 52. Critical UX Principle: Don't Make Users Understand the Architecture

Internally SmartSapp may have:

```text
EventType
AvailabilitySchedule
BookingPage
Booking
Meeting
MeetingParticipant
MeetingProvider
CalendarConnection
MeetingRoom
Recording
Transcript
MeetingInsight
```

But users should experience:

```text
What are you offering?
        ↓
When are you available?
        ↓
Who should attend?
        ↓
Where will you meet?
        ↓
What happens automatically?
```

The domain architecture should be complex.

The UX should not be.

---

# 53. Recommended Primary User Journeys

The design system should explicitly support these journeys.

### Journey A — Internal meeting

```text
Calendar
→ Schedule Meeting
→ Select contact
→ Select time
→ Generate video link
→ Schedule
```

### Journey B — Public booking

```text
Booking Page
→ Event Type
→ Date
→ Time
→ Questions
→ Confirmation
→ Calendar invite
```

### Journey C — CRM booking

```text
Contact
→ Schedule Meeting
→ Select Event Type
→ Available slots
→ Confirm
→ CRM activity created
```

### Journey D — Sales routing

```text
Booking
→ Identify contact
→ Evaluate CRM data
→ Apply routing rules
→ Select host
→ Book
→ Update lead
→ Trigger automation
```

### Journey E — Meeting intelligence

```text
Meeting
→ Record
→ Transcribe
→ Summarize
→ Extract decisions
→ Extract action items
→ Update CRM
→ Create tasks
→ Trigger follow-up
```

---

# 54. What Should Be Avoided

I would explicitly prohibit the following patterns in the implementation.

### ❌ Giant meeting configuration wizard

Replace with:

**Editor + progressive disclosure.**

### ❌ Meeting as the only scheduling primitive

Introduce:

**Event Type + Availability + Booking + Meeting.**

### ❌ Calendar as a decorative view

Calendar must be a scheduling engine interface.

### ❌ Separate CRM and Meeting identities

One contact should remain one contact throughout the system.

### ❌ Provider-specific UI

Don't build:

```text
Zoom Meeting
Google Meeting
Teams Meeting
```

as separate concepts.

Build:

```text
Meeting Location
→ Provider Adapter
```

### ❌ Hard-coded reminder logic

Expose workflows.

### ❌ Massive booking forms

Use conditional questions.

### ❌ AI as a chatbot bolted onto the page

AI should understand the meeting context and provide **actions**, not merely conversation.

---

# 55. The Target Experience

The final SmartSapp experience should feel like this:

```text
                    SMARTSAPP
                       │
          ┌────────────┴────────────┐
          │                         │
       CALENDAR                  CRM
          │                         │
          └──────────┬──────────────┘
                     │
                 SCHEDULING
                     │
        ┌────────────┼────────────┐
        │            │            │
     Event       Availability   Routing
      Type
        │            │            │
        └────────────┼────────────┘
                     │
                  BOOKING
                     │
                     ▼
                  MEETING
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    Video        Attendance     Recording
       │             │             │
       └─────────────┼─────────────┘
                     │
                     ▼
                    AI
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    Summary       Actions       Insights
       │             │             │
       └─────────────┼─────────────┘
                     │
                     ▼
                  CRM + AI
                     │
              ┌──────┼──────┐
              │      │      │
            Tasks  Deals  Automation
```

That is the UX architecture I would recommend implementing.

## 56. Industry Benchmark Baseline

SmartSapp should treat the following as **table stakes**, not premium enhancements:

| Capability                  | Target                       |
| --------------------------- | ---------------------------- |
| Event Types                 | Required                     |
| One-to-one meetings         | Required                     |
| Group meetings              | Required                     |
| Collective meetings         | Required                     |
| Round-robin                 | Required                     |
| Availability schedules      | Required                     |
| Calendar conflict detection | Required                     |
| Buffers                     | Required                     |
| Minimum booking notice      | Required                     |
| Maximum advance booking     | Required                     |
| Timezone handling           | Required                     |
| Booking pages               | Required                     |
| Custom booking forms        | Required                     |
| Conditional questions       | Required                     |
| Google Calendar             | Required                     |
| Outlook/Microsoft 365       | Required                     |
| Zoom                        | Required                     |
| Google Meet                 | Required                     |
| Microsoft Teams             | Required                     |
| Automated reminders         | Required                     |
| Rescheduling                | Required                     |
| Cancellation                | Required                     |
| CRM association             | **SmartSapp differentiator** |
| Lead scoring                | **SmartSapp differentiator** |
| Routing based on CRM data   | **SmartSapp differentiator** |
| AI meeting intelligence     | **SmartSapp differentiator** |
| AI → CRM actions            | **SmartSapp differentiator** |
| Native meeting room         | Strategic                    |
| Meeting recording           | Strategic                    |
| Meeting polls               | Strategic                    |
| Resource scheduling         | Strategic                    |
| Payments                    | Strategic                    |

The benchmark is consistent with current scheduling products: reusable event types, booking pages, availability rules, buffers, invitee forms, notifications, team/host configuration and meeting polls are now established patterns rather than experimental features. ([Calendly.com][1])


[1]: https://calendly.com/help/how-to-organize-and-manage-your-event-types?utm_source=chatgpt.com "How to organize and manage your event types | Calendly Help"
[2]: https://support.google.com/calendar/answer/11608416?hl=en&utm_source=chatgpt.com "Learn about appointment schedules in Google Calendar - Google Calendar Help"
[3]: https://support.google.com/calendar/answer/10729749?hl=en&utm_source=chatgpt.com "Create an appointment schedule - Google Calendar Help"
[4]: https://calendly.com/help/event-types-overview?utm_source=chatgpt.com "Event types overview | Calendly Help"
