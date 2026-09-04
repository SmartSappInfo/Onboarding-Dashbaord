# SMARTSAPP MEDIA INTELLIGENCE 2.0

## Complete UI/UX Architecture, Interaction System & Phased Design Specification

---

# 1. UX NORTH STAR

Media must never feel like a separate file-management application.

The user should experience it as:

> **the content intelligence layer of SmartSapp.**

The same media object must naturally travel across:

```text
Library
→ Campaign
→ Contact
→ Deal
→ Conversation
→ Meeting
→ Knowledge
→ Automation
→ AI
→ Analytics
```

The UX therefore follows four principles:

### Principle 1 — Content-first

Users start with the asset and decide what to do with it.

### Principle 2 — Context everywhere

Users see media in the context of the contact, deal, campaign, or workflow they are working on.

### Principle 3 — Intelligence without friction

AI appears contextually rather than forcing users into a separate "AI page."

### Principle 4 — Progressive complexity

A beginner sees simple controls.

An advanced user can reveal:

* conditions
* attribution
* event rules
* personalization
* experimentation
* AI controls

---

# 2. INFORMATION ARCHITECTURE

Primary navigation:

```text
MEDIA
│
├── Command Center
│
├── Library
│   ├── All Assets
│   ├── Videos
│   ├── Audio
│   ├── Images
│   ├── Documents
│   ├── Presentations
│   └── External Media
│
├── Collections
├── Packages
├── Experiences
├── Distribution
│   ├── Links
│   ├── Embeds
│   └── QR Codes
│
├── Analytics
│   ├── Overview
│   ├── Engagement
│   ├── Audience
│   ├── Journeys
│   ├── Conversion
│   └── Attribution
│
├── Intelligence
│   ├── Insights
│   ├── Content Health
│   ├── Recommendations
│   └── Media Influence
│
├── AI Studio
│   ├── Copilot
│   ├── Analyze
│   ├── Repurpose
│   └── Generate
│
└── Administration
    ├── Processing
    ├── Templates
    ├── Permissions
    ├── Retention
    ├── Tracking
    └── Settings
```

---

# 3. GLOBAL MEDIA SHELL

Every Media screen uses:

```text
┌─────────────────────────────────────────────────────────────┐
│ SmartSapp      Media             Search      AI      +Create │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ Media nav    │                Workspace                      │
│              │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

Desktop:

* persistent left navigation
* top workspace bar
* global search
* AI command entry
* create action

Tablet:

* collapsible navigation
* persistent top bar
* contextual side panel

Mobile:

* top header
* bottom navigation
* drawers/sheets for secondary actions

---

# 4. RESPONSIVE BREAKPOINTS

```text
Mobile       < 768px
Tablet       768–1199px
Desktop      1200–1599px
Large        ≥ 1600px
```

---

# 5. RESPONSIVE BEHAVIOR

## Mobile

Prioritize:

* preview
* share
* activity
* analytics summary
* AI actions
* quick editing

Defer:

* advanced rule configuration
* large comparison tables
* deep governance settings

These become bottom sheets or dedicated screens.

## Tablet

Use:

* two-pane layouts
* collapsible inspector
* adaptive tables

## Desktop

Use:

* three-pane editors
* dense analytics
* keyboard shortcuts
* multi-select workflows

---

# 6. GLOBAL CREATE MENU

The primary `+ Create` action opens:

```text
Create

Upload Media
Add External Media
Create Experience
Create Package
Create Collection
Generate with AI
```

AI option:

> What are you trying to create?

Suggested:

```text
Sales Package
Campaign Media
School Brochure
Video Experience
Training Resource
```

---

# 7. MEDIA COMMAND CENTER

Route:

```text
/media
```

Purpose:

Immediate operational overview.

Layout:

```text
Media Intelligence
────────────────────────────────────────────

[2,481 Assets] [186 Experiences] [42.9K Views]
[8.4K Contacts] [67% Engagement] [GH₵1.2M Influence]

────────────────────────────────────────────

AI INSIGHTS

⚡ 3 assets drive 61% of influenced pipeline
⚠ Pricing Guide conversion dropped 18%
★ Campus Tour is trending upward

────────────────────────────────────────────

Performance
[Chart]

Top Content
[Asset cards]

Recent Activity
[Timeline]
```

---

# 8. COMMAND CENTER STATES

## First-time empty

```text
Your media intelligence starts here.

Upload your first asset to begin
tracking engagement and generating AI insights.

[Upload Media]
```

## Loading

Skeleton:

* metric cards
* chart blocks
* insight cards

## Error

```text
We couldn't load your Media Intelligence.

[Retry]
```

## Partial data

Show the available metrics and label:

> Analytics are still being calculated.

---

# 9. MEDIA LIBRARY

Route:

```text
/media/library
```

Desktop:

```text
┌───────────────────────────────────────────────────────────────┐
│ Library                                      + Upload          │
├───────────────────────────────────────────────────────────────┤
│ Search media...                                                │
│                                                                │
│ All | Video | Audio | Images | Documents | Presentations      │
│                                                                │
│ Filters: Collection  Tags  Owner  Status  Engagement  AI      │
├───────────────────────────────────────────────────────────────┤
│ [Card] [Card] [Card] [Card]                                   │
│ [Card] [Card] [Card] [Card]                                   │
└───────────────────────────────────────────────────────────────┘
```

---

# 10. LIBRARY CARD

```text
┌───────────────────────────┐
│                           │
│         THUMBNAIL         │
│                           │
│ Video • 08:42             │
├───────────────────────────┤
│ Campus Tour               │
│ 482 views                 │
│ 87% engagement            │
│                           │
│ ● Published               │
└───────────────────────────┘
```

Hover desktop:

```text
Preview
Share
Analytics
More
```

Long-press mobile:

```text
Share
Add to Collection
Analytics
More
```

---

# 11. LIBRARY LIST VIEW

Columns:

```text
Name
Type
Status
Owner
Views
Engagement
Conversion
Updated
```

Sortable.

Column visibility configurable.

---

# 12. LIBRARY FILTER DRAWER

Filters:

```text
Type
Status
Owner
Collection
Tags
Campaign
Created
Updated
Engagement
Conversion
Pipeline Influence
AI Status
Processing Status
```

Smart filters:

```text
High Performing
Underperforming
High Intent
Never Used
Needs Review
AI Recommended
Expiring
Influences Pipeline
```

---

# 13. SAVED VIEWS

Users can save combinations:

```text
"My High-Intent Sales Content"
```

Each saved view contains:

* filters
* columns
* sorting
* grouping

---

# 14. BULK SELECTION

Selection toolbar:

```text
12 selected

Add to Collection
Tag
Move
Archive
Create Package
Analyze with AI
Export
More
```

Sensitive actions require confirmation.

---

# 15. UPLOAD EXPERIENCE

Click `Upload Media`.

Desktop modal:

```text
Upload Media

[ Drag & Drop ]

or

[Choose files]

Supported:
Video • Audio • Image • PDF • Office files

              [Cancel] [Upload]
```

Advanced:

```text
Collection
Tags
Owner
Publishing state
AI analysis
```

---

# 16. UPLOAD PROGRESS

Each file:

```text
CampusTour.mp4
Uploading
██████████████░░ 82%

215 MB / 262 MB
```

After upload:

```text
Uploaded ✓

Processing...
```

Never block the interface waiting for processing.

---

# 17. UPLOAD CONFLICT

If duplicate detected:

```text
This asset may already exist.

Campus Tour.mp4
98% similarity with:
Campus Tour Final.mp4

[Use Existing]
[Upload Anyway]
[Compare]
```

---

# 18. PROCESSING STATE

Asset badge:

```text
Processing
```

Clicking opens:

```text
Processing

✓ Uploaded
✓ Security scan
✓ Metadata
● Transcoding
○ Thumbnail
○ Transcript
○ AI indexing
```

---

# 19. PROCESSING FAILURE

```text
We couldn't finish processing this asset.

Transcoding failed.

[Retry]
[Download Original]
[View Details]
```

Technical details remain collapsed.

---

# 20. ASSET DETAIL SCREEN

Route:

```text
/media/assets/{assetId}
```

Desktop:

```text
┌───────────────────────────────────────────────────────────────┐
│ ← Library     Campus Tour        Share  Edit  More            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                    MEDIA PREVIEW                              │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ Overview Analytics Content Versions Experiences Links        │
│ Automations AI                                                │
└───────────────────────────────────────────────────────────────┘
```

---

# 21. ASSET HEADER

Contains:

* thumbnail/player
* title
* media type
* status
* owner
* last updated
* current version
* Share
* Edit
* More

Context badges:

```text
Used in 4 campaigns
Used by 2 packages
Influenced 7 deals
```

---

# 22. OVERVIEW TAB

Sections:

### Asset Information

### Organization

### Usage

### CRM Context

### Publishing

### AI Summary

Example:

```text
AI SUMMARY

A 14-minute overview of the school's campus,
facilities, academic environment and admissions process.

Topics
Campus
Admissions
Facilities
Academics
```

---

# 23. ANALYTICS TAB

Cards:

```text
Views
Unique Viewers
Avg Engagement
Completion
CTA Conversion
Downloads
```

Charts:

* engagement curve
* viewer breakdown
* source breakdown
* funnel
* CRM impact

---

# 24. CONTENT TAB

For video:

```text
Summary
Transcript
Chapters
Topics
Entities
Keywords
```

For documents:

```text
Summary
Pages
Sections
OCR
Topics
Entities
```

---

# 25. TRANSCRIPT VIEWER

Desktop:

```text
┌──────────────────────────────┬─────────────────────────┐
│ Video                        │ Transcript              │
│                              │                         │
│                              │ 00:00 Welcome           │
│                              │                         │
│                              │ 02:14 Campus overview   │
│                              │                         │
│                              │ 04:37 Fees              │
│                              │                         │
└──────────────────────────────┴─────────────────────────┘
```

Clicking transcript line:

→ jumps player to timestamp.

---

# 26. AI TRANSCRIPT SEARCH

Search field:

```text
Search inside this video...
```

Natural language:

> where does the principal discuss fees?

Result:

```text
04:37
The principal explains the fee structure...

[Jump to 04:37]
```

---

# 27. CHAPTERS

Auto-generated:

```text
00:00 Introduction
02:14 Campus Overview
05:32 Academic Programs
08:47 Fees
12:10 Communication
15:44 Enrollment
```

Users can edit.

---

# 28. VERSIONS TAB

```text
Version 4   CURRENT
Version 3
Version 2
Version 1
```

Each version:

```text
Created by
Created date
Size
Duration
Processing status
```

Actions:

```text
Preview
Compare
Restore
```

---

# 29. VERSION COMPARISON

Split screen:

```text
Version 3                    Version 4

Thumbnail                    Thumbnail

Duration                     Duration

Transcript                    Transcript

AI summary                   AI summary

Analytics                    Analytics
```

Highlight changes.

---

# 30. EXPERIENCES TAB

Show experiences:

```text
Public Campus Tour
Sales Experience
Campaign Experience
Private Experience
```

Card:

```text
Published
142 shares
68% completion
14% CTA conversion

[Open]
```

---

# 31. LINKS TAB

Show:

```text
Link
Experience
Campaign
Contact
Created
Clicks
Engagement
```

---

# 32. AUTOMATIONS TAB

Display human-readable rules.

```text
WHEN
Video reaches 75%

THEN
Apply tag "High Media Intent"

AND
Notify Deal Owner
```

Primary:

```text
[Create Automation]
```

Advanced:

```text
[Open in Automation Builder]
```

This is preferable to creating a permanently separate Media automation engine.

---

# 33. AI TAB

```text
AI STATUS

✓ Summary
✓ Topics
✓ Transcript
✓ Chapters
✓ Embeddings

AI ACTIONS

[Ask about this asset]
[Repurpose]
[Improve]
[Generate thumbnail]
[Find related content]
```

---

# 34. MEDIA EXPERIENCE ARCHITECTURE

Experience builder route:

```text
/media/experiences/{experienceId}/edit
```

This is one of the most important screens in the system.

---

# 35. DESKTOP EXPERIENCE BUILDER

```text
┌────────────────────────────────────────────────────────────────┐
│ ← Experiences     Sales Experience        Preview  Save Publish│
├─────────────┬──────────────────────────────┬───────────────────┤
│ COMPONENTS  │            CANVAS            │ INSPECTOR         │
│             │                              │                   │
│ Media       │                              │ General           │
│ Text        │          LIVE PREVIEW        │ Player            │
│ CTA         │                              │ Appearance        │
│ Form        │                              │ CTA               │
│ Chapters    │                              │ Gates             │
│ Related     │                              │ Tracking          │
│ Download    │                              │ Personalization   │
│ Booking     │                              │ Access            │
├─────────────┴──────────────────────────────┴───────────────────┤
│ Rules / Timeline / Conditions                                   │
└────────────────────────────────────────────────────────────────┘
```

---

# 36. EXPERIENCE BUILDER LEFT PANEL

Categories:

```text
Content
Interaction
Conversion
Personalization
Social
Navigation
Advanced
```

Components:

```text
Media Player
Audio Player
Document Viewer
Image
Text
CTA
Form
Survey
Download
Booking
Related Media
Chapters
Recommendation
Divider
Custom HTML
```

---

# 37. CANVAS

Canvas uses a responsive frame.

Toolbar:

```text
Desktop | Tablet | Mobile
```

Additional:

```text
Zoom
Fit
Preview
```

The canvas is not the actual public DOM.

It is a visual representation of the configured experience.

---

# 38. RIGHT INSPECTOR

Context-sensitive.

When nothing selected:

```text
Experience Settings
Branding
Tracking
Access
```

When player selected:

```text
Player Settings
```

When CTA selected:

```text
CTA Settings
```

When gate selected:

```text
Gate Rules
```

---

# 39. EXPERIENCE BUILDER STATE — EMPTY

```text
Start building your experience

Add a media component to begin.

[Add Media]
```

---

# 40. EXPERIENCE BUILDER STATE — UNSAVED

Header:

```text
Unsaved changes • Saved 15 sec ago
```

Actions:

```text
Save
Discard
```

On navigation:

```text
You have unsaved changes.

[Stay]
[Discard]
```

---

# 41. EXPERIENCE BUILDER STATE — AUTOSAVE

Autosave silently.

Small status:

```text
Saving...
Saved ✓
```

No interruptive modals.

---

# 42. EXPERIENCE BUILDER STATE — INVALID

Publish button disabled.

Inline warnings:

```text
CTA requires a destination
Experience has no media
```

Publish checklist:

```text
✓ Media
✓ Branding
⚠ CTA destination
✓ Tracking
✓ Access
```

---

# 43. EXPERIENCE BUILDER PREVIEW

Modes:

```text
Anonymous
Identified Contact
High-Intent Contact
Deal
Mobile
Desktop
```

This is crucial for testing personalization.

---

# 44. EXPERIENCE PLAYER SETTINGS

```text
Autoplay
Controls
Playback Speed
Captions
Quality
Poster
Watermark
Download
Fullscreen
PiP
```

---

# 45. DOCUMENT EXPERIENCE SETTINGS

```text
Page Mode
Single / Continuous

Navigation
Swipe
Arrow Keys
Page Thumbnails

Search
Enable / Disable

Download
Allowed / Disabled
```

The existing document viewer already supports high-DPI rendering, touch/swipe navigation and keyboard navigation; those capabilities become standardized Experience Builder options.

---

# 46. CTA EDITOR

```text
CTA

Type
[Book Meeting ▼]

Label
Book a Consultation

Trigger
[75% ▼]

Destination
[Meeting Link]

Visibility
[All Viewers]
```

---

# 47. CTA TYPES

```text
Book Meeting
Form
Survey
Download
URL
Phone
Email
WhatsApp
CRM Action
Custom
```

---

# 48. GATE BUILDER

Simple mode:

```text
Show CTA when:

○ Immediately
○ 25%
○ 50%
○ 75%
○ 100%
○ Custom
```

Advanced:

```text
WHEN

Watch progress >= 75%

AND

Contact is identified

AND

Deal stage = Qualified

THEN

Display CTA
```

---

# 49. CONDITION BUILDER

Structured builder:

```text
[Contact] [Deal Stage] [equals] [Qualified]

+ Add condition
```

Groups:

```text
ALL
ANY
NONE
```

---

# 50. PERSONALIZATION EDITOR

```text
Personalize content

Hello {{firstName}}

Recommended for {{companyName}}.

Recommended content:
{{nextBestAsset}}
```

Preview with:

```text
Kwame
ABC School
```

---

# 51. AI PERSONALIZATION

Button:

```text
✨ Improve with AI
```

Options:

```text
More persuasive
More professional
Shorter
Parent-friendly
Sales-focused
```

AI shows before/after preview.

---

# 52. RECOMMENDATION COMPONENT

Insert:

```text
Recommended for you
```

Configuration:

```text
AI Recommended
Same Topic
Related Campaign
Next Best Content
Manual Selection
```

---

# 53. EXPERIENCE PUBLISH FLOW

Click Publish.

Step 1:

```text
Publish Experience

✓ Content
✓ Branding
✓ Tracking
✓ Permissions
```

Step 2:

```text
Distribution

Public Link
Custom Slug
Campaign
Contact
```

Step 3:

```text
[Publish]
```

Success:

```text
Experience published ✓

[Copy Link]
[Open]
[Create Campaign]
```

---

# 54. MEDIA PACKAGE BUILDER

Route:

```text
/media/packages/new
```

Canvas:

```text
Package name

[ + Add Media ]

1. Welcome Video
2. Campus Tour
3. Fee Guide
4. Testimonial
5. Booking CTA
```

Right side:

```text
Audience
Personalization
Brand
Experience
Tracking
```

---

# 55. PACKAGE → DEAL FLOW

Inside Deal:

```text
Media

Create Package
```

Pre-populate:

```text
Contact: Kwame
Deal: ABC School Enrollment
```

AI recommends:

```text
Campus Tour
Fee Guide
Parent Testimonial
```

---

# 56. DISTRIBUTION CENTER

Route:

```text
/media/distribution
```

Tabs:

```text
Links
Embeds
QR Codes
Packages
```

Link table:

```text
Name
Experience
Campaign
Recipient
Clicks
Engagement
Conversion
Status
```

---

# 57. LINK CREATOR

```text
Create Tracked Link

Experience
[Campus Tour]

Audience
[Kwame]

Campaign
[Enrollment Growth]

Deal
[ABC School]

Expiration
[30 days]

[Create Link]
```

---

# 58. QR CODE CREATOR

```text
Generate QR Code

Experience
Campaign
UTM
Expiration

[Download QR]
```

Useful for:

* school events
* flyers
* brochures
* posters
* admissions offices

---

# 59. ANALYTICS INFORMATION ARCHITECTURE

```text
Analytics
│
├── Overview
├── Engagement
├── Audience
├── Journeys
├── Conversion
├── CRM Influence
├── Campaign Influence
└── Attribution
```

---

# 60. ANALYTICS GLOBAL FILTER BAR

Always visible:

```text
Date
Asset
Experience
Campaign
Audience
Team
Device
Region
```

Filters persist across tabs.

---

# 61. OVERVIEW ANALYTICS

```text
Views
Unique Viewers
Engagement
Completion
CTA Conversion
Downloads
Meetings
Deals
Pipeline
```

---

# 62. ENGAGEMENT ANALYTICS

For video:

```text
Viewer Retention

100% ┤████████
 75% ┤████████████
 50% ┤██████████████
 25% ┤████████████████
```

Overlay:

* chapters
* CTA
* drop-off
* replay
* conversion

---

# 63. AUDIENCE ANALYTICS

Segments:

```text
Anonymous
Identified Contacts
Leads
Qualified Leads
Deals
Customers
```

Dimensions:

```text
device
browser
region
campaign
source
```

---

# 64. JOURNEY ANALYTICS

Example:

```text
First interaction
↓
Campus Tour
↓
Fee Guide
↓
Testimonial
↓
CTA
↓
Meeting
↓
Deal
```

Users can click every node.

---

# 65. CONVERSION ANALYTICS

Funnel:

```text
Views
   ↓
Starts
   ↓
Meaningful Engagement
   ↓
CTA
   ↓
Form
   ↓
Meeting
   ↓
Deal
   ↓
Won
```

---

# 66. CRM INFLUENCE SCREEN

```text
Media Influence

Touched       1,824
Engaged         940
Assisted        384
Influenced      172
Converted        61

Pipeline
GH₵1.2M
```

---

# 67. ATTRIBUTION SCREEN

Models:

```text
First Touch
Last Touch
Linear
Time Decay
Position Based
Data Driven
```

Toggle model without changing raw event history.

---

# 68. SESSION EXPLORER

Route:

```text
/media/analytics/sessions
```

Desktop table:

```text
Viewer
Asset
Campaign
Duration
Engagement
CTA
CRM
Last Active
```

Clicking opens session drawer.

---

# 69. SESSION DETAIL DRAWER

```text
Kwame
Identified Contact

Campus Tour
14:32

Timeline

09:42 Viewed
09:43 Started
09:46 25%
09:49 50%
09:54 Pricing chapter
09:58 75%
10:00 CTA clicked
10:04 Form complete
```

---

# 70. LIVE VIEWERS

Optional "Live" panel:

```text
LIVE NOW

Kwame
Campus Tour
74%

Ama
Pricing Guide
Page 7

John
Demo Video
Playing
```

Action:

```text
[View Contact]
[Open Deal]
```

---

# 71. INTELLIGENCE CENTER

Route:

```text
/media/intelligence
```

Sections:

```text
Insights
Content Health
Recommendations
Media Influence
```

---

# 72. AI INSIGHT CARD

```text
⚡ Engagement opportunity

Pricing Guide has 68% completion
but only 4% CTA conversion.

Likely issue:
CTA is appearing too late.

[Investigate]
[Ask AI]
```

---

# 73. CONTENT HEALTH

Example:

```text
Media Health

Freshness        74
Engagement       82
Conversion       68
AI Coverage      91
Governance       89

Overall
82 / 100
```

---

# 74. CONTENT DECAY CARD

```text
⚠ Needs review

Fee Guide

823 views
Published 14 months ago

AI detected references that may be outdated.

[Review]
[Archive]
```

---

# 75. AI COPILOT GLOBAL SURFACE

Every Media screen has:

```text
✨ Ask Media AI
```

Opening:

```text
┌─────────────────────────────────────────────┐
│ Media AI                                    │
│                                             │
│ What would you like to know?                │
│                                             │
│ "Which assets are underperforming?"         │
│ "What should I send this deal?"             │
│ "Find all pricing content."                 │
│                                             │
└─────────────────────────────────────────────┘
```

---

# 76. AI CONTEXT AWARENESS

When launched from an asset:

AI automatically receives:

```text
asset
version
analytics
transcript
CRM relationships
campaigns
```

When launched from a Deal:

AI receives:

```text
deal
contact
media history
campaign
relevant content
```

The user should never have to manually attach context that SmartSapp already knows.

---

# 77. AI ANSWER DESIGN

Every answer uses:

```text
Answer
↓
Evidence
↓
Recommended Action
```

Example:

```text
The Campus Tour is one of your strongest
high-intent assets.

Evidence
• 87% average engagement
• 14% CTA conversion
• 7 influenced deals

Recommended
Use it earlier in qualified-lead campaigns.

[Apply Recommendation]
```

---

# 78. AI ACTION CONFIRMATION

AI may recommend actions.

Actions that change data require user confirmation.

Example:

> I found 24 prospects who watched the pricing guide but haven't booked a meeting.

[Create Segment]

After click:

> Add "Pricing Engaged" tag to 24 contacts?

[Confirm]

---

# 79. AI NO-DATA STATE

```text
I don't have enough media data to answer this reliably.

Try:
"Which videos have the highest completion?"
```

Never fabricate analytics.

---

# 80. AI GENERATION PANEL

```text
Generate with AI

Thumbnail
Summary
Description
Chapters
Captions
Email
Social Posts
Sales Summary
FAQ
Landing Page
```

---

# 81. AI REPURPOSING FLOW

Select asset:

```text
Repurpose

Source:
30-minute webinar

Generate:

☑ Summary
☑ Blog article
☑ Email
☑ Social posts
☑ FAQ
☑ Short-video ideas

[Generate]
```

Results grouped by artifact.

---

# 82. AI GENERATED CONTENT REVIEW

Never immediately publish generated content.

State:

```text
AI Draft
```

Actions:

```text
Edit
Approve
Regenerate
Compare
Publish
```

---

# 83. CRM CONTACT SURFACE

Contact record:

```text
Overview | Activity | Media | Deals | Messages
```

Media tab:

```text
MEDIA ENGAGEMENT

Score        84
Intent       High

Recent Content

Campus Tour      92%
Fee Guide        100%
Testimonial      78%

Downloads
3

CTAs
2
```

---

# 84. CONTACT MEDIA JOURNEY

```text
Aug 30
Viewed Campus Tour

Aug 31
Downloaded Fee Guide

Sep 1
Watched Testimonial

Sep 1
Clicked Book Consultation
```

---

# 85. DEAL MEDIA SURFACE

Inside Deal:

```text
MEDIA INTELLIGENCE

Intent: HIGH

Content Engagement

Campus Tour      94%
Fee Guide        100%
Testimonial       78%

Next Best Content
★ Parent Success Story

[Send]
```

---

# 86. DEAL TIMELINE INTEGRATION

Example:

```text
10:21
Contact completed Pricing Guide.

10:22
Media Intent Score → 81

10:22
AI recommended follow-up.

[View recommendation]
```

---

# 87. LEAD SURFACE

Lead cards display:

```text
Media Intent
High

Last asset:
Pricing Guide

Engagement:
88%

[View Media Journey]
```

---

# 88. CRM BULK MEDIA ACTIONS

From analytics:

```text
37 contacts selected

Apply Tag
Move Stage
Create Task
Add to Campaign
Send Media
Notify Owner
```

---

# 89. MESSAGING HANDOFF

Inside message composer:

```text
Insert
│
├── Media
├── Package
├── Experience
└── Link
```

Selecting media:

```text
Campus Tour

Preview
Thumbnail
Duration
Tracked link

[Insert]
```

The existing Messaging integration already supports selecting media share links and populating media metadata into templates; the 2.0 interaction should preserve this but make the reference reusable across messaging surfaces.

---

# 90. CAMPAIGN INTELLIGENCE HANDOFF

Campaign builder component:

```text
Media

Recommended Media

★ Campus Tour
★ Parent Testimonial
★ Fee Guide
```

Reason:

```text
Selected because these assets
perform best with this audience.
```

---

# 91. CAMPAIGN → MEDIA

From Campaign Intelligence:

```text
Create Media Experience
```

Prepopulate:

```text
Campaign
Audience
Message
CTA
Tracking
```

---

# 92. MEDIA → CAMPAIGN

From asset:

```text
Use in Campaign
```

Options:

```text
Existing Campaign
New Campaign
Add to Automation
```

Campaign reporting later shows:

```text
Media contribution
Engagement
Conversion
Influenced pipeline
```

---

# 93. CAMPAIGN INTELLIGENCE RECOMMENDATION

Example:

> This asset historically converts qualified leads 2.1× better than your campaign average.

Actions:

```text
[Add to Campaign]
[Create Experience]
[Dismiss]
```

---

# 94. MEETING HANDOFF

Meeting record can display:

```text
PRE-MEETING MEDIA INTELLIGENCE

Prospect watched:
Campus Tour — 94%
Pricing Guide — 100%

Likely interests:
Fees
Facilities
Enrollment

Suggested talking points:
...
```

---

# 95. KNOWLEDGE HANDOFF

Knowledge search result:

```text
MEDIA

Campus Tour

Related Knowledge:
Facilities
Admissions
Fee Structure

[Open Asset]
```

---

# 96. MEDIA → KNOWLEDGE

Asset Content tab:

```text
Publish to Knowledge
```

AI can generate:

```text
FAQ
Knowledge article
Summary
```

---

# 97. IDEA CANVAS

The Media module should include an **Idea Canvas** as an AI-assisted planning surface.

Purpose:

Turn media from an uploaded object into a strategic content concept.

Route:

```text
/media/ideas
```

---

# 98. IDEA CANVAS — DESKTOP

```text
┌──────────────────────────────────────────────────────────────┐
│ Idea Canvas                                   AI Assist       │
├────────────┬───────────────────────────────────┬─────────────┤
│ Ideas      │             CANVAS               │ AI INSIGHT   │
│            │                                   │             │
│ Hooks      │ "Create a video explaining      │ Audience    │
│ Topics     │  school fees to parents."       │             │
│ Content    │                                   │             │
│ References │ [card] [card] [card]            │ References  │
│            │                                   │             │
├────────────┴───────────────────────────────────┴─────────────┤
│ Convert to Asset | Experience | Campaign | Package           │
└──────────────────────────────────────────────────────────────┘
```

---

# 99. IDEA CANVAS OBJECT TYPES

```text
Idea
Question
Audience
Topic
Hook
Asset
Reference
Campaign
CTA
Persona
Insight
```

---

# 100. IDEA CANVAS AI ACTIONS

User enters:

> "We need a campaign for parents worried about school fees."

AI can create:

```text
Audience
Parent decision makers

Pain points
Fee uncertainty
Payment flexibility

Content ideas
1. Fee breakdown video
2. Payment guide PDF
3. Principal Q&A

Recommended CTA
Book a consultation
```

---

# 101. IDEA → MEDIA

Action:

```text
Create Media From Idea
```

AI preconfigures:

* title
* description
* target audience
* suggested format
* CTA
* related collection

---

# 102. IDEA → CAMPAIGN

```text
Convert to Campaign

Idea
↓
Message
↓
Media
↓
Audience
↓
Automation
```

This creates a direct handoff to Campaign Intelligence.

---

# 103. IDEA CANVAS MOBILE

Use cards instead of a freeform infinite canvas.

```text
Idea

"Fee anxiety campaign"

Audience
Parents

Content
3 recommended assets

CTA
Book Consultation

[Build]
```

Drag-and-drop is secondary on mobile.

---

# 104. MEDIA SEARCH UX

Global search supports:

```text
keyword
semantic
transcript
OCR
CRM
campaign
```

Query:

> "pricing content for school owners"

Results:

```text
Assets
Experiences
Packages
Contacts
Campaigns
Knowledge
```

---

# 105. SEARCH RESULT CARD

```text
Fee Guide

PDF
Used in 8 campaigns

AI Summary:
Explains...
```

---

# 106. SEARCH RESULT ACTIONS

```text
Open
Preview
Add to Collection
Use in Campaign
Create Package
Ask AI
```

---

# 107. SMART EMPTY STATES

## Library

> Start building your content library.

## Collections

> Collections help your team organize content by campaign, topic, audience, or client.

## Packages

> Turn related content into a single tracked experience.

## Experiences

> Build a customized media experience.

## Analytics

> Once people interact with your media, intelligence will appear here.

## AI

> AI intelligence is generated as your content is processed.

---

# 108. LOADING SYSTEM

Do not use generic full-screen spinners.

Use skeletons:

```text
MetricSkeleton
CardSkeleton
TableRowSkeleton
ChartSkeleton
PreviewSkeleton
TimelineSkeleton
```

For processing, use explicit progress.

---

# 109. ERROR SYSTEM

Three levels:

### Inline

For field-level issues.

### Component

For failed sections.

### Page

For unavailable screens.

Example:

```text
Analytics unavailable

Your media is still processing.

[Refresh]
```

---

# 110. OFFLINE / WEAK NETWORK

Especially important for mobile users.

Display:

```text
You're offline.

Your changes will be saved when connection returns.
```

Only use offline mutation support where data consistency is safe.

---

# 111. NOTIFICATION CENTER

Media notifications:

```text
Campus Tour processing complete
Pricing Guide conversion dropped
High-intent prospect detected
New AI recommendation available
Asset expires in 7 days
```

---

# 112. TOAST SYSTEM

Success:

> Experience published.

Warning:

> This asset is still being processed.

Error:

> We couldn't save your changes.

Never use toasts for information requiring a decision.

---

# 113. CONFIRMATION MODALS

Required for:

* delete
* archive
* publish
* restore
* large bulk modifications
* CRM stage changes
* destructive AI replacement

Not needed for:

* save
* tag
* opening preview

---

# 114. UNDO SYSTEM

Destructive but reversible actions:

```text
Archived "Campus Tour"

[Undo]
```

Use immediate undo where possible.

---

# 115. KEYBOARD SHORTCUTS

Desktop:

```text
/
Global search

N
New media

E
Edit

P
Preview

Cmd/Ctrl + S
Save

Cmd/Ctrl + Enter
Publish

Escape
Close drawer
```

Do not rely only on shortcuts.

---

# 116. ACCESSIBILITY

All controls:

* keyboard reachable
* visible focus
* semantic labels
* accessible names
* screen-reader state
* color-independent status

Player:

* keyboard controls
* captions
* transcript access
* accessible fullscreen
* accessible CTA

---

# 117. MOTION

Use subtle motion for:

* panel transitions
* card feedback
* save state
* drag/drop
* AI progress

Respect:

```text
prefers-reduced-motion
```

The current implementation already uses tactile micro-interactions and 44px touch targets; preserve those patterns while centralizing them in the SmartSapp design system.

---

# 118. MOBILE PLAYER

Full-screen by default.

Controls:

```text
Back
Title

Player

Play
Progress
Captions
Speed
Fullscreen

CTA
```

CTA should never cover essential player controls.

---

# 119. MOBILE DOCUMENT VIEWER

Controls:

```text
Page 7 / 24
Search
Download
More
```

Swipe between pages.

Bottom sheet for search/results.

---

# 120. MOBILE ANALYTICS

Do not replicate desktop charts.

Use:

```text
Score
Trend
Top 3 metrics
Compact funnel
Activity timeline
```

Tap a metric to expand.

---

# 121. MOBILE CRM MEDIA CARD

```text
Media Engagement

84
High Intent

Campus Tour      92%
Fee Guide        100%
Testimonial      78%

[View Journey]
[Send Next Content]
```

---

# 122. MOBILE CAMPAIGN HANDOFF

```text
Recommended Media

Campus Tour
Why:
High conversion with this audience.

[Add to Campaign]
```

---

# 123. MOBILE AI

Use full-height sheet:

```text
Media AI

Ask anything...

Suggested:
"What should I send this contact?"
"Find high-converting videos."

[Input]
```

---

# 124. DESIGN COMPONENT HIERARCHY

## Foundation

```text
Button
Input
Select
Tabs
Badge
Tooltip
Popover
Dialog
Drawer
Toast
Skeleton
```

## Media

```text
MediaCard
MediaThumbnail
MediaPreview
MediaPlayer
MediaViewer
MediaMeta
```

## Intelligence

```text
InsightCard
ScoreCard
EngagementChart
FunnelChart
AttributionCard
AIRecommendationCard
```

## CRM

```text
ContactMediaPanel
DealMediaPanel
MediaTimeline
IntentScore
```

## Builder

```text
BuilderShell
Canvas
Inspector
ComponentLibrary
RuleBuilder
GateBuilder
PersonalizationEditor
PreviewSwitcher
```

---

# 125. STATE MODEL FOR COMPONENTS

Every major async component supports:

```text
idle
loading
ready
empty
error
stale
refreshing
```

Every editor supports:

```text
clean
dirty
saving
saved
saveError
publishing
published
publishError
invalid
locked
```

---

# 126. MEDIA CARD STATES

```text
Draft
Processing
Ready
Published
Archived
Failed
```

Visual state must not rely only on color.

---

# 127. EXPERIENCE STATE BADGES

```text
Draft
In Review
Approved
Published
Archived
```

Publishing controls depend on permissions.

---

# 128. AI STATE BADGES

```text
AI Ready
Analyzing
Needs Review
AI Failed
Human Edited
```

---

# 129. PROCESSING SCREEN

Administration:

```text
Processing Center

Running        18
Queued         42
Failed          3
Completed    2,418
```

Filters:

```text
Job Type
Asset
Status
Created
Owner
```

---

# 130. ADMIN — TEMPLATE MANAGEMENT

Templates:

```text
Public Media
Sales Experience
Campaign Experience
Training Experience
Sales Package
```

Actions:

```text
Create
Duplicate
Edit
Archive
```

---

# 131. ADMIN — TRACKING SETTINGS

```text
Anonymous Tracking
Identity Resolution
IP Retention
Geolocation
Session Retention
Consent
```

---

# 132. ADMIN — PERMISSIONS

Resource-level:

```text
Collection
Asset
Package
Experience
```

Roles:

```text
Viewer
Contributor
Editor
Publisher
Analyst
Manager
Admin
```

---

# 133. ADMIN — AUDIT LOG

Table:

```text
User
Action
Resource
Before
After
Timestamp
```

---

# 134. MEDIA → AUTOMATION UX

Do not force users to learn a new automation syntax.

Basic mode:

```text
When
[Video reaches 75%]

Do
[Apply tag]
```

Advanced:

```text
Open Automation Builder
```

---

# 135. MEDIA → AI → AUTOMATION

AI may suggest:

> Prospects who watched 75%+ of this video and opened the pricing guide have high intent.

Button:

```text
Create Automation
```

AI generates a draft.

User reviews.

Then confirms.

---

# 136. AI INSIGHT → ACTION MODEL

Every insight should have:

```text
What happened
Why it matters
Evidence
Recommended action
```

Avoid passive AI dashboards.

---

# 137. MEDIA INTELLIGENCE SCORE CARD

```text
Media Intent

84 / 100
HIGH

Why:
• Watched 3 high-intent assets
• Completed pricing guide
• Clicked consultation CTA

[View Evidence]
```

---

# 138. EVIDENCE DRAWER

Every AI/analytics conclusion can open:

```text
Evidence

Asset
Pricing Guide

Event
Completed

Timestamp
10:21

CRM
Deal #482

Source
Media Session
```

This creates trust.

---

# 139. CAMPAIGN MEDIA PERFORMANCE

Within Campaign Intelligence:

```text
MEDIA PERFORMANCE

Asset              Views   Eng.   CTA   Deals
Campus Tour         482    87%    14%     7
Fee Guide           341    91%     9%     4
Testimonial         284    78%    18%     5
```

---

# 140. MEDIA RECOMMENDATION EXPERIENCE

When selecting campaign content:

```text
Recommended

Campus Tour
★★★★☆

Why:
Strong performance with qualified parents.

[Use]
```

---

# 141. SALES MEDIA RECOMMENDATION

Contact page:

```text
Next Best Content

Fee Guide

Because:
Kwame has viewed the campus
and testimonial but hasn't
consumed pricing content.

[Send]
```

---

# 142. MEDIA PACKAGE ANALYTICS

Package-level funnel:

```text
Package Opened
↓
Video Viewed
↓
Document Opened
↓
CTA
↓
Meeting
↓
Deal
```

---

# 143. PACKAGE SESSION TIMELINE

```text
Kwame opened package
 ↓
Campus Tour 94%
 ↓
Fee Guide downloaded
 ↓
Testimonial 76%
 ↓
Booking clicked
```

---

# 144. EXPERIMENT BUILDER

Route:

```text
Experience → Experiments
```

```text
A/B Test

Variant A
Campus Tour + CTA

Variant B
Campus Tour + Different CTA

Audience
Qualified leads

Primary metric
Meeting booking
```

---

# 145. EXPERIMENT RESULTS

```text
Variant A
12.4% booking rate

Variant B
16.8%

Confidence
...
```

Avoid declaring winners where data is insufficient.

---

# 146. MEDIA INSIGHTS FEED

Scrollable feed:

```text
Today

⚡ High-intent prospect
Kwame consumed 3 high-value assets.

⚠ Conversion drop
Pricing Guide CTA conversion declined 18%.

★ Content winner
Campus Tour is outperforming peers.
```

---

# 147. AI COMMAND ACTIONS

Natural-language command:

> "Create a package for this deal."

AI responds:

```text
Recommended package

Campus Tour
Fee Guide
Parent Testimonial
Enrollment Guide

CTA:
Book Consultation

[Create Draft]
```

---

# 148. AI COMMAND — ANALYTICS

> "Why are people dropping out of this video?"

Answer:

```text
Largest drop:
08:47–09:12

This is the Fees chapter.

The drop is 2.4× higher than
your average chapter drop.

[Open Chapter]
[Optimize]
```

---

# 149. AI COMMAND — CRM

> "Which qualified leads watched the pricing guide this week?"

Result:

```text
24 contacts

[View Contacts]
[Create Segment]
[Create Task]
```

---

# 150. AI COMMAND — CAMPAIGN

> "Which content should replace this underperforming asset?"

AI:

```text
Recommended:
Parent Testimonial

Evidence:
3.1× higher CTA conversion with
this audience.

[Replace Draft]
```

---

# 151. IMPLEMENTATION PHASE UI MAPPING

## PHASE 0 — FOUNDATION / INSTRUMENTATION

### UX deliverables

* preserve existing Media UI
* analytics instrumentation
* event-state mapping
* compatibility layer
* tracking debug interface
* developer event inspector

### Screens

```text
Processing Debug
Event Inspector
Identity Debug
Migration Status
```

### Do not redesign heavily yet.

---

# 152. PHASE 1 — MEDIA FOUNDATION 2.0

### Screens

```text
Media Command Center
Library
Collections
Asset Detail
Versions
Processing Center
Packages
Permissions
Audit
```

### Components

```text
MediaCard
MediaGrid
MediaTable
Upload
VersionSwitcher
CollectionPicker
ProcessingStatus
```

### UX priority

Information architecture and asset lifecycle.

---

# 153. PHASE 2 — DELIVERY PLATFORM

### Screens

```text
Experience List
Experience Builder
Preview
Publishing
Distribution
Links
Embeds
QR Codes
```

### Components

```text
BuilderShell
Canvas
Inspector
ComponentLibrary
PreviewSwitcher
CTAEditor
GateBuilder
```

---

# 154. PHASE 3 — CONTENT INTELLIGENCE

### Screens

```text
Content Intelligence
Transcript Viewer
Semantic Search
AI Content Panel
Chapter Editor
AI Metadata
```

### Components

```text
Transcript
ChapterTimeline
SemanticSearch
AIInsight
ContentSummary
```

---

# 155. PHASE 4 — CRM INTELLIGENCE

### CRM screens

```text
Contact → Media
Lead → Media
Deal → Media
Company → Media
```

### Components

```text
ContactMediaPanel
DealMediaPanel
MediaTimeline
IntentScore
NextBestContent
```

---

# 156. PHASE 5 — EXPERIENCE STUDIO

### New UX

* advanced visual builder
* conditions
* personalization
* dynamic recommendations
* visual CTA rules
* preview personas

This phase delivers the full customization vision.

---

# 157. PHASE 6 — ANALYTICS & ATTRIBUTION

### Screens

```text
Analytics Overview
Engagement
Audience
Journey
Conversion
Influence
Attribution
Experiments
```

### Components

```text
FunnelChart
RetentionChart
AttributionModel
SessionExplorer
InfluenceGraph
```

---

# 158. PHASE 7 — MEDIA COPILOT

### Screens

```text
AI Studio
Media Copilot
Repurpose
Generate
Recommendations
```

### Contextual AI

Available from:

```text
Asset
Library
Deal
Contact
Campaign
Package
Analytics
Experience Builder
```

---

# 159. PHASE 8 — OPTIMIZATION

### Screens

```text
Experiments
Predictions
Content Decay
Optimization
Recommendation Center
```

### Components

```text
ExperimentBuilder
ExperimentResults
PredictionCard
OptimizationSuggestion
```

---

# 160. PHASE 9 — ENTERPRISE

### Screens

```text
Enterprise Governance
API
Webhooks
Access
Retention
Audit
Developer
```

---

# 161. FULL PHASE UI MATRIX

| UX Surface            | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 |
| --------------------- | -: | -: | -: | -: | -: | -: | -: | -: | -: | -: |
| Command Center        |  ✓ |  ✓ |    |    |    |    |  ✓ |  ✓ |  ✓ |    |
| Library               |  ✓ |  ✓ |    |    |    |    |    |    |    |    |
| Collections           |    |  ✓ |    |    |    |    |    |    |    |    |
| Packages              |    |  ✓ |  ✓ |    |  ✓ |    |    |    |    |    |
| Versions              |    |  ✓ |    |    |    |    |    |    |    |    |
| Processing            |  ✓ |  ✓ |  ✓ |  ✓ |    |    |    |    |    |    |
| Experiences           |    |    |  ✓ |    |    |  ✓ |    |    |    |    |
| Experience Builder    |    |    |  ✓ |    |    |  ✓ |    |    |    |    |
| CTA/Gates             |  ✓ |    |  ✓ |    |    |  ✓ |    |    |    |    |
| Personalization       |    |    |    |    |    |  ✓ |    |  ✓ |    |    |
| Distribution          |    |    |  ✓ |    |    |    |    |    |    |    |
| Transcript            |    |    |    |  ✓ |    |    |    |    |    |    |
| Semantic Search       |    |    |    |  ✓ |    |    |  ✓ |    |    |    |
| Contact Media         |    |    |    |    |  ✓ |    |    |    |    |    |
| Deal Media            |    |    |    |    |  ✓ |    |    |    |    |    |
| Campaign handoff      |    |    |    |    |  ✓ |  ✓ |  ✓ |  ✓ |    |    |
| Analytics             |  ✓ |    |    |    |    |    |  ✓ |  ✓ |  ✓ |    |
| Attribution           |    |    |    |    |    |    |  ✓ |    |    |    |
| Experimentation       |    |    |    |    |    |    |  ✓ |    |  ✓ |    |
| AI Studio             |    |    |    |  ✓ |    |    |    |  ✓ |    |    |
| Copilot               |    |    |    |    |    |    |    |  ✓ |    |    |
| Repurposing           |    |    |    |    |    |    |  ✓ |    |    |    |
| Content Health        |    |    |    |  ✓ |    |    |  ✓ |  ✓ |    |    |
| Prediction            |    |    |    |    |    |    |    |    |  ✓ |    |
| Enterprise Governance |    |  ✓ |    |    |    |    |    |    |    |  ✓ |

---

# 162. SCREEN INVENTORY

The production design backlog should contain at least these surfaces:

### Command

1. Media Command Center

### Library

2. Library Grid
3. Library List
4. Saved Views
5. Search
6. Upload
7. Processing

### Asset

8. Asset Overview
9. Asset Analytics
10. Asset Content
11. Asset Transcript
12. Asset Versions
13. Asset Experiences
14. Asset Links
15. Asset Automations
16. Asset AI

### Organization

17. Collections
18. Collection Detail
19. Packages
20. Package Builder
21. Package Analytics

### Experiences

22. Experience List
23. Experience Builder
24. CTA Editor
25. Gate Builder
26. Personalization Editor
27. Preview
28. Publishing

### Distribution

29. Links
30. Link Creator
31. Embeds
32. QR Generator

### Analytics

33. Overview
34. Engagement
35. Audience
36. Journeys
37. Conversion
38. Sessions
39. Session Detail
40. Influence
41. Attribution
42. Experiments

### Intelligence

43. Insights
44. Content Health
45. Recommendations
46. Influence

### AI

47. Media Copilot
48. AI Search
49. AI Analyze
50. Repurpose
51. Generate
52. AI Review

### CRM

53. Contact Media
54. Lead Media
55. Deal Media
56. Company Media

### Admin

57. Processing Center
58. Templates
59. Permissions
60. Audit
61. Tracking
62. Retention
63. Settings

### Planning

64. Idea Canvas

---

# 163. PRIMARY USER JOURNEYS

## Journey A — Upload → Publish

```text
Upload
↓
Process
↓
AI enrichment
↓
Asset Detail
↓
Create Experience
↓
Configure CTA
↓
Preview
↓
Publish
↓
Create Link
```

---

# 164. JOURNEY B — Salesperson → Deal

```text
Deal
↓
Media Intelligence
↓
AI recommendation
↓
Create Package
↓
Personalize
↓
Create tracked link
↓
Send
↓
Contact engages
↓
CRM timeline
↓
Follow-up
```

---

# 165. JOURNEY C — Campaign Manager

```text
Campaign
↓
Select Audience
↓
Recommended Media
↓
Select Experience
↓
Configure CTA
↓
Publish
↓
Campaign
↓
Analytics
↓
Optimization
```

---

# 166. JOURNEY D — AI CONTENT REPURPOSING

```text
Asset
↓
AI Studio
↓
Repurpose
↓
Generate artifacts
↓
Human review
↓
Approve
↓
Publish to:
Campaign / Knowledge / Messaging
```

---

# 167. JOURNEY E — CRM INTELLIGENCE

```text
Media Event
↓
Identity resolution
↓
Contact
↓
Engagement score
↓
Intent score
↓
Deal
↓
Automation
↓
Next best action
```

---

# 168. MEDIA EXPERIENCE BUILDER INTERACTION RULES

1. Clicking a component selects it.
2. Double click enters inline editing where appropriate.
3. Escape closes active inline editing.
4. Delete removes component after undo availability.
5. Dragging uses explicit drag handles.
6. Side panels do not cause canvas loss of position.
7. Changes autosave.
8. Publish always validates the complete experience.
9. Preview never mutates production state.
10. Draft and published states are distinct.

---

# 169. MOBILE EDITOR RULES

Mobile should not mimic desktop.

Use:

```text
Canvas
↓
Tap component
↓
Bottom Sheet Inspector
```

Primary action remains sticky:

```text
[Save]
```

Publishing:

```text
[Publish]
```

Advanced conditions open full-screen.

---

# 170. DESKTOP EDITOR RULES

Desktop supports:

* drag/drop
* keyboard shortcuts
* multi-select
* side-by-side preview
* persistent inspector
* timeline/rule builder

---

# 171. TABLET EDITOR RULES

Tablet:

```text
Canvas
+
Collapsible inspector
```

Use overlay inspector rather than permanently consuming screen width.

---

# 172. ACCESSIBLE BUILDER

Every component must expose:

```text
name
role
position
visibility
state
```

Keyboard:

```text
Tab
Arrow keys
Enter
Escape
Delete
```

---

# 173. MEDIA PLAYER ACCESSIBILITY

Required:

* captions
* transcript
* keyboard playback
* accessible progress
* audio descriptions where supported
* proper focus restoration
* screen-reader announcements for CTA unlock

Example:

> "Booking button is now available."

---

# 174. ANALYTICS ACCESSIBILITY

Do not communicate metrics through color alone.

Instead:

```text
↑ 18%
↓ 7%
Stable
```

Charts provide accessible summaries.

---

# 175. AI ACCESSIBILITY

AI-generated suggestions should be:

* readable
* dismissible
* keyboard-accessible
* clearly labeled as AI-generated

---

# 176. DESIGN TOKEN MODEL

Use shared SmartSapp tokens.

Categories:

```text
color
spacing
radius
shadow
typography
motion
z-index
breakpoint
```

Media cannot invent a parallel design system.

---

# 177. COMPONENT STATES

Buttons:

```text
default
hover
pressed
focus
disabled
loading
success
```

Inputs:

```text
empty
filled
focused
error
warning
disabled
readonly
```

---

# 178. AI COMPONENT STATES

```text
Idle
Thinking
Streaming
Complete
Needs Confirmation
Failed
```

Streaming AI should render incrementally where appropriate.

---

# 179. REAL-TIME DATA STATES

For live analytics:

```text
Live
Updating
Delayed
Offline
```

Example:

> Updated 5 sec ago.

This is preferable to falsely implying real-time data.

---

# 180. DATA FRESHNESS

Analytics pages show:

```text
Updated just now
Updated 2 min ago
Updated today
```

For batch metrics:

> "Some metrics may take a few minutes to update."

---

# 181. MEDIA HOME PERSONALIZATION

For managers:

```text
Performance
Influence
Health
```

For marketers:

```text
Content
Campaigns
AI
```

For sales:

```text
Contacts
Deals
Recommended Content
```

Same product; different default emphasis.

---

# 182. ROLE-ADAPTIVE COMMAND CENTER

Marketing:

```text
Top Campaign Media
Content Performance
AI recommendations
```

Sales:

```text
High Intent
Contact Activity
Next Best Content
```

Management:

```text
Pipeline Influence
Revenue
Content ROI
```

---

# 183. GLOBAL AI CONTEXT

AI must understand where it was invoked.

From:

```text
Deal
```

"Create a package"

means:

> create package for this deal/contact.

From:

```text
Campaign
```

"Recommend media"

means:

> recommend content suitable for this audience/campaign.

From:

```text
Asset
```

"Improve"

means:

> optimize this asset/experience.

---

# 184. CRM CONTEXTUAL ACTIONS

Whenever a media object is associated with a CRM record, show:

```text
Open Contact
Open Deal
Open Company
Open Campaign
```

Do not make users search for the originating object.

---

# 185. MEDIA ↔ CRM RELATIONSHIP DISPLAY

```text
Relationships

Used by:
3 Campaigns

Viewed by:
94 Contacts

Associated with:
12 Deals

Influenced:
7 Won Deals
```

---

# 186. MEDIA → BUSINESS VALUE

All advanced analytics should ultimately be able to answer:

```text
Who engaged?
With what?
When?
How deeply?
After which campaign?
What happened next?
Did it influence a CRM outcome?
What should we do now?
```

---

# 187. FINAL UX ARCHITECTURE

The complete experience becomes:

```text
                         SMARTSAPP
                            │
                            ▼
                     MEDIA COMMAND CENTER
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
       LIBRARY           IDEAS              AI
          │                 │                  │
          ▼                 ▼                  ▼
      ASSETS            CANVAS            COPILOT
          │
          ▼
       VERSION
          │
          ▼
    AI UNDERSTANDING
          │
          ▼
      EXPERIENCE
          │
     ┌────┼─────┐
     ▼    ▼     ▼
   CTA  GATE  PERSONALIZE
     │    │     │
     └────┼─────┘
          ▼
      DISTRIBUTION
          │
     ┌────┼────────┐
     ▼    ▼        ▼
  MESSAGE CAMPAIGN  CRM
     │    │        │
     └────┼────────┘
          ▼
        SESSION
          │
          ▼
        EVENTS
          │
          ▼
     INTELLIGENCE
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
 SCORING ATTRIB AI
    │     │     │
    └─────┼─────┘
          ▼
     NEXT BEST ACTION
          │
          ▼
     AUTOMATION
          │
          ▼
       OUTCOME
```

---

# 188. THE UX RULE THAT DEFINES 2.0

The user should rarely need to ask:

> "Where is Media?"

Instead:

```text
Contact → Media
Deal → Media
Campaign → Media
Meeting → Media
Message → Media
Knowledge → Media
AI → Media
```

And from Media:

```text
Media → CRM
Media → Campaign
Media → Messaging
Media → Knowledge
Media → Meetings
Media → AI
```

That bidirectional relationship is what turns the feature into a true SmartSapp platform layer.

---

# 189. IMPLEMENTATION PRIORITY

The UI should be built in this order:

```text
1. Foundation shell
2. Library
3. Asset Detail
4. Processing
5. Collections
6. Versions
7. Experiences
8. Experience Builder
9. Distribution
10. Analytics
11. CRM surfaces
12. Content Intelligence
13. AI Copilot
14. Attribution
15. Experimentation
16. Enterprise administration
```

The temptation should be avoided to build the Copilot before the underlying asset, event, identity, and analytics UX is reliable.

---

# 190. DEFINITION OF DONE FOR THE UI/UX SYSTEM

Media Intelligence 2.0 is considered UX-complete when:

### Content management

A user can:

```text
Upload
Organize
Version
Search
Review
Publish
Archive
```

### Experience

A user can:

```text
Design
Customize
Gate
Personalize
Track
Publish
```

### Distribution

A user can:

```text
Link
Embed
QR
Message
Campaign
Package
```

### Intelligence

A user can:

```text
Analyze
Compare
Investigate
Attribute
Optimize
```

### CRM

A user can:

```text
See media on Contacts
See media on Deals
Identify intent
Send next content
Trigger actions
```

### AI

A user can:

```text
Ask
Search
Analyze
Generate
Repurpose
Recommend
Optimize
```

### Enterprise

A user can:

```text
Permission
Approve
Audit
Govern
Export
Integrate
```

---

# 191. FINAL DESIGN PHILOSOPHY

SmartSapp Media Intelligence 2.0 should feel less like:

> **"Dropbox with analytics"**

and more like:

> **"A content operating system connected directly to the customer lifecycle."**

The final UX loop is:

```text
CREATE
   ↓
UNDERSTAND
   ↓
PACKAGE
   ↓
EXPERIENCE
   ↓
DISTRIBUTE
   ↓
ENGAGE
   ↓
IDENTIFY
   ↓
SCORE
   ↓
CONVERT
   ↓
ATTRIBUTE
   ↓
LEARN
   ↓
OPTIMIZE
   ↓
CREATE AGAIN
```

That loop should be visible throughout the product architecture.

The strongest aspect of the current Media implementation—its connection between engagement events, CTAs, CRM identity, automation, and analytics—should therefore become the central interaction paradigm rather than a collection of isolated features.
