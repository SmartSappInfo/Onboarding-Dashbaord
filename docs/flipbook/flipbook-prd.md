# SmartSapp Document Experience Platform

## Full Product Requirements, Domain Model, Event Model, Processing Architecture & Implementation Roadmap

**Product:** SmartSapp CRM
**Platform:** Document Experience Platform
**Current Feature:** Flipbook
**Target:** Enterprise-grade, CRM-aware interactive document publishing and engagement platform
**Status:** Target Architecture & Product Requirements
**Date:** August 2026

---

# 1. Executive Summary

SmartSapp's existing Flipbook feature should evolve into a broader **Document Experience Platform** rather than remain a narrowly scoped flipbook implementation.

The existing implementation provides a strong starting point:

* Next.js App Router
* React
* TypeScript
* Firestore
* Firebase Admin SDK
* PDF.js
* page-level document records
* interactive hotspots
* lead gates
* public sharing
* responsive viewing
* analytics counters
* workspace-level access control
* server actions
* optimistic editing
* batched writes.

However, the current domain model is centered on `FlipbookConfig`. It combines document identity, source file, presentation, interactions, access, lead capture and analytics into a single aggregate.

The target architecture changes the fundamental abstraction:

> **A Flipbook becomes a viewing mode of a Document.**

The resulting platform will support:

* PDFs
* DOCX
* PPTX
* EPUB
* image collections
* scanned documents
* brochures
* prospectuses
* catalogues
* reports
* handbooks
* proposals
* manuals
* portfolios
* presentations
* other paginated/page-based content

The platform will allow organizations to:

1. Upload documents.
2. Process and convert them into structured pages.
3. Publish them as interactive digital experiences.
4. Customize the viewer.
5. Add interactive elements.
6. Share through multiple channels.
7. Track anonymous and known visitors.
8. Associate engagement with CRM contacts.
9. Calculate engagement and intent.
10. Trigger CRM automations.
11. Analyze document performance.
12. Use AI to understand, create and optimize document experiences.

---

# 2. Product Vision

## 2.1 Vision

> Make every document in SmartSapp an interactive, measurable and CRM-aware digital experience.

The platform should move documents from:

**static files**

to:

**interactive experiences**

to:

**measurable engagement**

to:

**CRM intelligence**

to:

**automated business action**.

---

# 3. Strategic Position

The platform is not simply:

> "A PDF flipbook."

It is:

> **SmartSapp's document publishing, interaction, distribution and engagement intelligence layer.**

The flipbook viewer is one presentation mode.

Other presentation modes should eventually include:

* Single-page reader
* Double-page reader
* Continuous document
* Presentation mode
* Mobile reading mode
* Embedded reader

---

# 4. Product Goals

## 4.1 Primary Goals

The platform must:

1. Provide a premium desktop flipbook experience.
2. Provide an equally strong mobile experience.
3. Support multiple document formats.
4. Process documents asynchronously.
5. Support large documents.
6. Provide highly configurable viewer experiences.
7. Support interactive page elements.
8. Support public and private distribution.
9. Identify known contacts where possible.
10. Track meaningful engagement.
11. Feed engagement into SmartSapp CRM.
12. Support lead scoring.
13. Support automation triggers.
14. Support campaign attribution.
15. Provide document analytics.
16. Support document versions.
17. Provide strong tenant isolation.
18. Scale independently between processing, delivery, analytics and CRM workloads.
19. Support AI-powered document intelligence.
20. Preserve backward compatibility with the existing flipbook implementation.

---

# 5. Non-Goals

The initial platform should not attempt to become:

* a full word processor
* a general-purpose graphic design application
* a complete PDF editing suite
* a desktop publishing replacement
* a DRM platform
* a general cloud storage replacement

The platform should focus on:

**document ingestion + presentation + interaction + distribution + engagement intelligence.**

---

# 6. Core Product Concepts

The platform should use these concepts consistently.

```text
Workspace
    ↓
Document
    ↓
Document Version
    ↓
Document Pages
    ↓
Interactive Layers
    ↓
Viewer Experience
    ↓
Distribution
    ↓
Viewer Session
    ↓
Events
    ↓
Analytics
    ↓
CRM Intelligence
    ↓
Automation
```

---

# 7. Target Domain Model

## 7.1 Workspace

The existing system already scopes flipbooks using `workspaceId`.

The target platform continues to use Workspace as the tenant boundary.

```typescript
Workspace {
  id
  name
  status
  settings
  createdAt
}
```

Every persistent platform object must have an explicit tenant relationship.

---

# 8. Document

The central entity becomes `Document`.

```typescript
Document {
  id
  workspaceId

  title
  description

  slug

  status
  // draft | processing | ready | published | archived

  documentType
  // brochure | report | prospectus | catalogue | manual |
  // presentation | proposal | handbook | other

  activeVersionId

  defaultViewerMode

  coverPageId

  metadata

  createdBy
  createdAt
  updatedAt
  publishedAt
}
```

### Important rule

The Document represents the logical content.

It does **not** represent a particular uploaded file.

---

# 9. Document Version

Every published document should be versioned.

```typescript
DocumentVersion {
  id
  documentId
  workspaceId

  versionNumber

  sourceId

  pageCount

  status
  // processing | ready | published | superseded | failed

  checksum

  createdBy
  createdAt
  publishedAt
}
```

Benefits:

* safe updates
* rollback
* historical analytics
* reproducible campaign experiences
* auditability

---

# 10. Document Source

```typescript
DocumentSource {
  id
  documentId
  versionId
  workspaceId

  fileName
  mimeType
  sourceType

  storagePath
  sourceUrl

  fileSize
  checksum

  uploadedBy
  uploadedAt
}
```

Supported initial formats:

```text
PDF
DOCX
PPTX
EPUB
JPG
PNG
WEBP
SVG
image collection
```

Future formats may be added through the processing abstraction.

---

# 11. Document Page

The current system already stores page image URLs, thumbnails, dimensions and extracted text.

The target page model expands this considerably.

```typescript
DocumentPage {
  id
  documentId
  versionId
  workspaceId

  pageNumber

  width
  height
  aspectRatio

  sourceAssetId
  renderedAssetId
  thumbnailAssetId

  extractedText
  textStatus

  ocrStatus

  processingStatus

  metadata

  createdAt
  updatedAt
}
```

---

# 12. Document Asset

Do not store every asset directly inside the page object.

Create an asset abstraction.

```typescript
DocumentAsset {
  id
  workspaceId

  documentId
  versionId?
  pageId?

  assetType
  // source | page | thumbnail | preview | audio | video | image

  storagePath
  cdnUrl

  mimeType
  size

  width?
  height?

  checksum

  createdAt
}
```

This enables:

* CDN optimization
* replacement
* caching
* lifecycle management
* deduplication

---

# 13. Interactive Layer

The current hotspot model uses percentage-based coordinates.

Retain that principle, but generalize it.

```typescript
DocumentLayer {
  id

  documentId
  versionId
  pageId

  type

  x
  y
  width
  height
  rotation

  zIndex

  visible

  style
  behavior
  content
  action

  tracking

  createdAt
  updatedAt
}
```

---

# 14. Interactive Layer Types

Initial types:

```text
link
button
video
audio
image
embed
form
CTA
WhatsApp
phone
email
page-navigation
document-navigation
download
calendar
CRM-action
```

Future:

```text
poll
quiz
signature
payment
appointment
AI-assistant
dynamic-content
```

---

# 15. Layer Actions

Every interactive element should have an action model.

```typescript
LayerAction {
  type

  target?
  url?
  pageNumber?
  documentId?
  formId?
  campaignId?
  automationId?

  parameters?
}
```

This prevents interaction logic from being hard-coded into individual hotspot types.

---

# 16. Viewer Experience

Viewer configuration becomes its own entity.

```typescript
ViewerExperience {
  id
  documentId
  workspaceId

  mode

  layout
  theme

  navigation
  animation

  controls

  branding

  behavior

  accessibility

  mobile

  sharing

  download

  createdAt
  updatedAt
}
```

---

# 17. Viewer Modes

```text
flipbook
single-page
double-page
continuous
presentation
mobile-reader
```

---

# 18. Viewer Animation Configuration

```typescript
AnimationConfig {
  type
  duration
  easing

  shadow
  perspective

  pageCurl

  sound
  soundVolume

  reducedMotionFallback
}
```

Animation options may include:

```text
page-flip
slide
fade
cover-flow
none
```

---

# 19. Access Policy

Replace the current plain password property with a proper policy.

```typescript
AccessPolicy {
  documentId
  workspaceId

  visibility
  // public | private | protected | authenticated | tokenized

  passwordHash?

  allowedDomains?

  allowedContacts?

  tokenRequired?

  tokenExpiration?

  downloadPolicy

  printPolicy

  watermarkPolicy
}
```

---

# 20. Distribution

A document should be distributable through multiple channels.

```typescript
DocumentDistribution {
  id

  workspaceId
  documentId
  versionId

  type
  // public-link | campaign | email | whatsapp | sms |
  // embed | qr | contact-link

  campaignId?
  contactId?

  token?

  trackingParameters

  expiresAt?

  status

  createdAt
}
```

This allows the same document to have different tracking contexts.

---

# 21. Viewer Session

A session represents one viewing period.

```typescript
ViewerSession {
  id

  workspaceId
  documentId
  versionId

  visitorId
  contactId?

  distributionId?

  startedAt
  lastActivityAt
  endedAt?

  device
  browser
  operatingSystem

  country?
  region?

  source
  campaignId?

  pagesViewed
  completionPercentage

  engagementScore
}
```

---

# 22. Visitor Identity

Anonymous and known visitors must be supported.

```typescript
Visitor {
  id
  workspaceId

  firstSeenAt
  lastSeenAt

  contactId?

  metadata
}
```

When a visitor becomes identifiable:

```text
visitorId
    ↓
contactId
```

Historical sessions can then be associated with the CRM contact.

---

# 23. Contact Association

A document session may be associated with:

```text
Contact
Lead
Company/School
Deal
Campaign
Sales Executive
```

The association should be flexible rather than hard-coded to only contacts.

---

# 24. Document Event Model

The event model is one of the most important components of the architecture.

Every meaningful viewer interaction becomes a standardized event.

```typescript
DocumentEvent {
  id

  workspaceId

  documentId
  versionId

  sessionId
  visitorId

  contactId?

  distributionId?
  campaignId?

  eventType

  occurredAt

  pageNumber?

  previousPage?
  nextPage?

  durationMs?

  elementId?

  metadata

  device
  browser
}
```

---

# 25. Event Taxonomy

## Document Events

```text
document_loaded
document_opened
document_closed
document_completed
document_shared
document_downloaded
document_printed
```

## Page Events

```text
page_entered
page_viewed
page_exited
page_flipped
page_jump
page_zoomed
```

## Interaction Events

```text
layer_viewed
link_clicked
button_clicked
video_started
video_completed
audio_started
form_started
form_completed
cta_clicked
```

## Viewer Events

```text
viewer_loaded
fullscreen_entered
fullscreen_exited
thumbnail_opened
thumbnail_clicked
search_opened
search_performed
```

## Lead Events

```text
lead_gate_shown
lead_gate_started
lead_gate_submitted
contact_identified
```

## Distribution Events

```text
share_started
share_completed
qr_opened
embed_loaded
```

---

# 26. Event Properties

Each event should support common properties.

```typescript
EventContext {
  workspaceId
  documentId
  versionId

  sessionId
  visitorId
  contactId?

  distributionId?
  campaignId?

  timestamp

  source
  referrer

  device
  browser
  os

  pageNumber?
  elementId?

  metadata
}
```

---

# 27. Event Ingestion Architecture

Do not make high-volume public analytics dependent on direct Firestore writes.

The target flow is:

```text
Viewer
  ↓
Event Collector
  ↓
Validation
  ↓
Rate Limiting
  ↓
Deduplication
  ↓
Queue
  ↓
Event Processor
  ↓
 ┌──────────────┬───────────────┬──────────────┐
 ↓              ↓               ↓
Analytics      CRM            Automation
Storage        Intelligence    Engine
```

This is critical for scale.

---

# 28. Event Reliability

The event system should provide:

* idempotency
* event IDs
* retry handling
* dead-letter handling
* timestamp validation
* payload limits
* schema validation
* rate limiting
* bot filtering
* duplicate detection

---

# 29. Analytics Architecture

Separate three layers.

## Layer 1: Raw Events

High-volume immutable events.

```text
document_events
```

## Layer 2: Session Aggregates

```text
viewer_sessions
```

Contains:

* pages viewed
* duration
* completion
* interaction count
* engagement score

## Layer 3: Business Analytics

```text
document_analytics
contact_document_insights
campaign_document_analytics
```

This avoids expensive real-time aggregation against raw events.

---

# 30. Engagement Score

The document platform should generate an engagement score.

Example:

```text
Open                         +2
View page                    +1
25% completion               +3
50% completion               +5
75% completion               +7
100% completion             +10
Return visit                 +5
CTA click                   +10
Video completed             +8
Download                     +5
Lead submission             +20
```

These should be configurable at workspace level.

---

# 31. CRM Integration

Document events should become native SmartSapp activities.

Example CRM timeline:

```text
John Doe

09:42 — Opened Enrollment Guide
09:43 — Viewed page 4
09:45 — Viewed pricing page
09:46 — Watched admission video
09:47 — Completed 82% of document
09:48 — Clicked "Book Assessment"
```

This should appear alongside:

* emails
* calls
* forms
* meetings
* tasks
* campaigns
* website interactions
* sales activity

---

# 32. Lead Scoring Integration

The platform should expose events to SmartSapp's lead scoring engine.

Example:

```text
Document opened
        ↓
+2

Viewed pricing page
        ↓
+8

Returned next day
        ↓
+5

Clicked CTA
        ↓
+10
```

Then:

```text
Score threshold exceeded
        ↓
CRM automation
        ↓
Create sales task
        ↓
Notify sales executive
```

---

# 33. Automation Triggers

The platform should expose triggers such as:

```text
Document opened
Page viewed
Page viewed N times
Document completed
CTA clicked
Video watched
Download occurred
Engagement score exceeded
Document viewed after campaign
Document revisited
Contact reached engagement threshold
```

---

# 34. Automation Actions

SmartSapp automation should be able to:

```text
Add score
Reduce score
Set score
Add tag
Remove tag
Create task
Assign task
Send email
Send SMS
Send WhatsApp
Notify team member
Move deal
Update contact field
Start campaign
Stop campaign
Create activity
```

---

# 35. Processing Architecture

The document-processing system should be asynchronous.

```text
Upload
  ↓
Create Document
  ↓
Create Version
  ↓
Create Processing Job
  ↓
Queue
  ↓
Format Detector
  ↓
Document Processor
  ↓
Page Extractor
  ↓
Renderer
  ↓
Thumbnail Generator
  ↓
Text Extractor
  ↓
OCR
  ↓
Search Indexer
  ↓
Asset Optimizer
  ↓
Validation
  ↓
READY
```

---

# 36. Processing Jobs

```typescript
DocumentProcessingJob {
  id

  workspaceId
  documentId
  versionId

  jobType

  status
  // queued | processing | completed | failed

  progress

  attempts

  errorCode?
  errorMessage?

  startedAt?
  completedAt?

  createdAt
}
```

---

# 37. Processing Job Types

```text
validate_source
detect_format
extract_pages
render_pages
generate_thumbnails
extract_text
ocr
generate_preview
index_search
optimize_assets
generate_embeddings
finalize_document
```

---

# 38. Processing Reliability

Jobs must support:

* retries
* exponential backoff
* idempotency
* checkpointing
* progress reporting
* dead-letter queue
* failed-job inspection
* manual retry

Large documents must not need to restart from page 1 after a page-level failure.

---

# 39. Page-Level Processing

For large documents:

```text
Document
 ↓
100 pages
 ↓
100 page jobs
```

rather than one monolithic processing task.

This allows:

* parallelism
* retries
* progress
* partial recovery

---

# 40. Asset Delivery

The viewer should primarily consume optimized assets through a CDN.

Recommended flow:

```text
Object Storage
      ↓
Image Optimization
      ↓
CDN
      ↓
Viewer
```

Page images should support multiple resolutions:

```text
thumbnail
small
medium
large
retina
```

The viewer selects the appropriate asset based on:

* viewport
* DPR
* zoom level
* connection
* device

---

# 41. Viewer Performance

The reader must not load an entire 300-page document at once.

Use:

```text
current page
+ previous page
+ next page
+ adjacent spread
```

as the initial preload window.

Then dynamically expand the cache.

---

# 42. Virtualization

For large documents:

```text
Page 1
Page 2
Page 3
...
Page 300
```

only a small window should remain mounted.

This is particularly important on mobile.

---

# 43. Caching

Cache:

* document metadata
* page metadata
* thumbnails
* rendered pages
* viewer configuration

Do not repeatedly fetch unchanged configuration from Firestore during navigation.

---

# 44. Mobile Architecture

Mobile is not simply a smaller desktop viewer.

The mobile reader should explicitly support:

* swipe
* drag
* tap navigation
* pinch zoom
* double-tap zoom
* orientation change
* dynamic toolbar
* bottom navigation
* page indicator
* mobile-friendly hotspot sizing

The existing implementation already reflows desktop double-page viewing into single-page mobile viewing.

The mature version should make this a configurable viewer strategy rather than a breakpoint-only behavior.

---

# 45. Gesture Engine

The viewer should distinguish:

```text
tap
drag
swipe
pinch
double tap
long press
```

Gesture interpretation must avoid conflicts between:

* page flipping
* scrolling
* hotspot interaction
* zooming

---

# 46. Desktop Interaction

Support:

```text
mouse click
mouse drag
mouse wheel
keyboard arrows
PageUp/PageDown
Home
End
spacebar
thumbnail click
navigation buttons
```

---

# 47. Accessibility

The platform should support:

* keyboard-only navigation
* ARIA labels
* semantic buttons
* focus management
* accessible page numbering
* alternative text for interactive elements
* reduced motion
* high-contrast themes
* screen-reader-compatible controls

---

# 48. Search

The existing extracted text capability should evolve into document-wide search.

Search flow:

```text
Search query
 ↓
Search index
 ↓
matching pages
 ↓
page navigation
 ↓
highlighted text
```

---

# 49. Document Editor

The existing two-column Studio is a useful foundation.

The mature Studio should include:

```text
Pages
Canvas
Layers
Inspector
Viewer settings
Interactions
CRM
Analytics
Versioning
Publishing
```

---

# 50. Page Manager

Support:

* reorder
* duplicate
* delete
* rotate
* replace
* insert
* extract
* bulk select
* bulk delete
* bulk reorder

---

# 51. Layer Editor

Users should be able to select an element and configure:

```text
Position
Size
Rotation
Appearance
Animation
Action
Tracking
Visibility
```

---

# 52. CRM Inspector

Every interactive element should optionally expose:

```text
Track interaction
Add lead score
Trigger automation
Associate campaign
```

Example:

> CTA "Book Assessment"

Configuration:

```text
Event: CTA clicked
Score: +10
Tag: assessment-interest
Automation: Enrollment Growth — High Intent
```

---

# 53. Viewer Customization

Configuration should include:

### Layout

* single page
* double page
* continuous
* presentation

### Animation

* page flip
* slide
* fade
* none

### Navigation

* arrows
* thumbnails
* progress
* page number
* keyboard

### Branding

* logo
* colors
* fonts
* favicon
* watermark

### Background

* solid
* gradient
* image

### Controls

* search
* share
* download
* print
* fullscreen
* zoom

---

# 54. Distribution

Every published document receives a canonical URL.

Example:

```text
/d/enrollment-growth-guide
```

Legacy:

```text
/f/enrollment-growth-guide
```

should continue functioning during migration.

---

# 55. Contact-Specific Links

Example:

```text
/d/enrollment-guide?t=<signed-token>
```

Token resolves to:

```text
workspace
document
version
contact
campaign
distribution
expiration
```

This enables anonymous-but-attributed engagement.

---

# 56. Embedding

Generate an embeddable viewer.

Requirements:

* responsive iframe
* configurable height
* toolbar configuration
* branding
* domain allowlist
* tracking
* campaign attribution
* mobile compatibility

---

# 57. QR Codes

Every distribution can generate a QR code.

QR analytics should identify:

```text
document
distribution
campaign
source
```

---

# 58. Sharing

Support:

* copy link
* native share
* WhatsApp
* email
* social sharing
* QR
* embed

The current implementation already includes social sharing and clipboard functionality.

---

# 59. Security Architecture

## Tenant Isolation

Every request must resolve:

```text
workspaceId
```

before accessing workspace-owned data.

---

# 60. Public Access

Published documents may be publicly readable.

However, public access should be mediated through:

```text
Document Access Service
```

rather than exposing arbitrary Firestore records.

---

# 61. Signed Assets

For protected documents:

```text
Viewer token
 ↓
Access validation
 ↓
Short-lived signed asset URL
 ↓
CDN
```

---

# 62. Passwords

Never store viewer passwords in plaintext.

Use:

```text
passwordHash
```

and short-lived authenticated viewing sessions.

---

# 63. Analytics Security

Do not allow unrestricted public writes to the permanent analytics data store.

The existing implementation currently permits public creation of analytics events.

Target:

```text
Public viewer
 ↓
Event API
 ↓
validation
 ↓
rate limiting
 ↓
queue
 ↓
analytics storage
```

---

# 64. Lead Security

The existing public lead creation rule should also be replaced with controlled ingestion.

Protection:

* signed document context
* rate limiting
* bot protection
* validation
* email normalization
* duplicate handling
* tenant resolution
* abuse detection

---

# 65. Download Policy

A disabled download button should not be represented as DRM.

Protected content should use:

* signed URLs
* expiration
* watermarking
* viewer-specific access
* optional viewer identity watermark

---

# 66. Audit Logging

Record administrative actions:

```text
document_created
document_updated
version_created
version_published
version_rolled_back
document_deleted
access_policy_changed
viewer_config_changed
layer_created
layer_updated
layer_deleted
distribution_created
```

---

# 67. Versioning Workflow

```text
Draft
 ↓
Processing
 ↓
Ready
 ↓
Preview
 ↓
Published
 ↓
Superseded
```

Never mutate an active published version destructively.

---

# 68. Publishing

Publishing should validate:

* document ready
* all required pages available
* viewer configuration valid
* access policy valid
* slug unique
* cover available
* required assets available

Then:

```text
publishVersion()
```

updates:

```text
document.activeVersionId
```

atomically.

---

# 69. AI Architecture

AI should be an extension of the document platform.

Pipeline:

```text
Document
 ↓
Text
 ↓
Chunks
 ↓
Embeddings
 ↓
AI Document Intelligence
```

Capabilities:

* summarize
* classify
* extract metadata
* identify topics
* generate title
* generate description
* generate CTA
* generate tags
* answer document questions
* identify important pages
* analyze engagement

---

# 70. AI Engagement Analysis

AI can analyze aggregated engagement:

```text
Most viewed pages
Longest dwell time
Most clicked sections
High-intent interactions
Conversion paths
```

Possible output:

> "Prospects who view pages 8–11 and then click the assessment CTA are significantly more engaged than general readers."

This should be based on aggregate behavioral data rather than unsupported inference from a single visitor.

---

# 71. AI Document Assistant

Eventually:

> "Create an interactive prospectus from this PDF."

AI can:

1. inspect document
2. identify sections
3. generate metadata
4. recommend viewer mode
5. detect URLs
6. suggest interactive elements
7. suggest CTAs
8. create CRM tracking configuration

---

# 72. Analytics Dashboard

Document dashboard:

```text
Views
Unique viewers
Returning viewers
Completion rate
Average duration
Pages/viewer
CTA clicks
Downloads
Shares
Leads
Conversions
Engagement score
```

---

# 73. Page Analytics

For every page:

```text
Views
Unique viewers
Average dwell time
Exit rate
CTA clicks
Video engagement
Next-page rate
```

Visualize as a document heatmap.

---

# 74. Contact Analytics

For each CRM contact:

```text
Documents viewed
Total views
Pages viewed
Completion
Time spent
Interactions
Last viewed
Engagement score
```

---

# 75. Campaign Analytics

For every distribution:

```text
Sent
Opened
Clicked
Viewer sessions
Unique viewers
Completion
CTA clicks
Leads
Conversions
```

---

# 76. Performance KPIs

Target platform performance:

### Viewer

* initial viewer shell: <2 seconds under normal conditions
* first visible page: <3 seconds under normal conditions
* subsequent page navigation: near-instant from cache
* no full-document preload

### Processing

* asynchronous
* progress visible
* retryable
* horizontally scalable

### Reliability

Target:

* 99.9% viewer availability
* no tenant data leakage
* no unbounded analytics writes

These are product targets and should be validated through load testing before being treated as contractual SLAs.

---

# 77. Cost Controls

The system must avoid:

* rendering every page on every request
* excessive Firestore reads
* direct raw analytics aggregation for dashboards
* storing duplicate assets
* processing identical documents repeatedly

Use:

* content checksums
* cached processing
* CDN
* batched operations
* aggregation
* lifecycle policies
* lazy loading

---

# 78. Firestore Strategy

Firestore should remain appropriate for:

* document metadata
* configuration
* permissions
* page metadata
* viewer configuration
* distributions
* sessions
* aggregated analytics
* CRM associations

High-volume event ingestion should be designed so it can be moved to a more appropriate event/analytics store without changing the viewer contract.

---

# 79. Storage Strategy

Object storage should hold:

```text
originals/
documents/
versions/
pages/
thumbnails/
previews/
media/
```

The application database stores references, not large binary payloads.

---

# 80. API Boundary

Create logical services even if initially implemented inside the same Next.js/Firebase application.

```text
Document Service
Processing Service
Asset Service
Viewer Service
Distribution Service
Event Service
Analytics Service
CRM Integration Service
AI Service
```

This creates future extraction boundaries without premature microservices.

---

# 81. Recommended Application Architecture

```text
Next.js
│
├── Document Studio
├── Viewer
├── Distribution UI
├── Analytics UI
│
├── Domain Services
│   ├── Documents
│   ├── Versions
│   ├── Pages
│   ├── Layers
│   ├── Viewer
│   ├── Distribution
│   ├── Access
│   └── CRM
│
├── Server Actions / API
│
└── Background Jobs
    ├── Processing
    ├── Analytics
    ├── AI
    └── Notifications
```

---

# 82. Repository Organization

Recommended logical structure:

```text
src/
  domains/
    documents/
    document-versions/
    pages/
    layers/
    viewers/
    distributions/
    access/
    events/
    analytics/
    crm/
    ai/

  infrastructure/
    firebase/
    storage/
    queues/
    search/
    ai/

  components/
    document-studio/
    document-viewer/
    document-analytics/

  app/
    admin/content/
    d/[slug]/
    f/[slug]/
```

---

# 83. Migration Strategy

Do not perform a destructive rewrite.

Existing:

```text
flipbooks
flipbook_pages
flipbook_leads
flipbook_analytics
```

should map to:

```text
documents
document_versions
document_pages
document_distributions
document_events
```

Create migration adapters.

---

# 84. Backward Compatibility

Existing URLs:

```text
/f/[slug]
```

must continue working.

The resolver should translate:

```text
legacy flipbook
      ↓
Document
      ↓
Viewer
```

until all existing content has migrated.

---

# 85. Phase-by-Phase Implementation

# Phase 0 — Architecture Freeze & Baseline

### Objectives

Prevent further feature expansion from making migration harder.

### Tasks

* freeze current schema changes
* document current collections
* inventory existing components
* inventory server actions
* inventory routes
* inventory analytics
* inventory security rules
* establish architecture decision records
* define target domain model
* define event taxonomy

### Deliverables

* architecture document
* domain model
* event schema
* migration plan
* security threat model

### Exit Criteria

All future development follows the target domain model.

---

# Phase 1 — Foundation Hardening

### Objectives

Make the current system safe enough to evolve.

### Tasks

* harden Firestore rules
* remove plaintext password storage
* introduce access service
* protect public analytics ingestion
* protect lead ingestion
* validate all public payloads
* add rate limiting
* add abuse detection
* add audit logging
* add observability
* improve error handling

### Exit Criteria

No unrestricted permanent public writes to tenant-owned analytics/lead datasets.

---

# Phase 2 — Domain Model Migration

### Objectives

Introduce Document as the core abstraction.

### Tasks

Create:

```text
documents
document_versions
document_sources
document_pages
document_assets
document_layers
viewer_experiences
access_policies
document_distributions
```

Build:

```text
Flipbook → Document adapter
```

Migrate existing flipbooks.

### Exit Criteria

Every flipbook can be represented as a Document + Viewer Experience.

---

# Phase 3 — Document Processing Platform

### Objectives

Move document conversion out of the viewer.

### Tasks

Implement:

* source validation
* format detection
* page extraction
* page rendering
* thumbnails
* text extraction
* OCR
* asset optimization
* job tracking
* retry
* progress
* failure handling

### Exit Criteria

A supported source file can be processed asynchronously into a production-ready document.

---

# Phase 4 — Viewer Engine 2.0

### Objectives

Create an industry-grade reader.

### Tasks

Implement:

* desktop flip
* mobile flip
* drag
* swipe
* touch
* pinch zoom
* double tap
* keyboard
* thumbnails
* fullscreen
* continuous reading
* presentation mode
* configurable animation
* sound
* reduced motion
* accessibility

### Exit Criteria

The viewer behaves correctly across desktop, tablet and mobile.

---

# Phase 5 — Document Studio 2.0

### Objectives

Turn the existing editor into a real document experience studio.

### Tasks

* page manager
* page reorder
* page operations
* layer editor
* interactive elements
* style system
* viewer configuration
* mobile preview
* desktop preview
* publishing workflow
* versioning
* rollback

### Exit Criteria

A non-technical user can produce and publish a polished interactive document without developer intervention.

---

# Phase 6 — Interactive Document Engine

### Objectives

Make pages interactive.

### Tasks

Implement:

* links
* buttons
* video
* audio
* images
* forms
* CTA
* WhatsApp
* phone
* email
* calendar
* page navigation
* document navigation
* downloads

### Exit Criteria

Interactive elements are reusable, configurable and independently trackable.

---

# Phase 7 — Distribution Platform

### Objectives

Make documents distributable everywhere.

### Tasks

* public URLs
* protected URLs
* contact-specific links
* campaign links
* QR codes
* embeds
* domain allowlisting
* expiration
* campaign attribution
* sharing

### Exit Criteria

One document can have multiple distribution contexts with independent analytics.

---

# Phase 8 — Event & Analytics Platform

### Objectives

Build reliable behavioral intelligence.

### Tasks

* event collector
* event schema
* event validation
* event queue
* deduplication
* session tracking
* visitor identity
* aggregation
* document analytics
* page analytics
* distribution analytics

### Exit Criteria

All viewer interactions are measurable without compromising viewer performance or database stability.

---

# Phase 9 — CRM Integration

### Objectives

Make document engagement native to SmartSapp CRM.

### Tasks

* visitor/contact association
* contact timeline
* document activity
* lead scoring
* contact insights
* campaign attribution
* deal association
* sales activity

### Exit Criteria

A sales executive can see meaningful document engagement directly inside the CRM.

---

# Phase 10 — Automation Integration

### Objectives

Turn engagement into action.

### Tasks

Create triggers:

```text
document opened
page viewed
document completed
CTA clicked
engagement threshold reached
document revisited
```

Create actions:

```text
score
tag
task
notification
email
SMS
WhatsApp
campaign
deal update
```

### Exit Criteria

Document engagement can trigger SmartSapp automation workflows.

---

# Phase 11 — Advanced Analytics

### Objectives

Provide strategic insights.

### Tasks

* engagement heatmaps
* page drop-off
* content performance
* conversion funnels
* campaign comparison
* contact engagement
* document comparison
* cohort analysis
* returning viewer analysis

### Exit Criteria

Administrators can understand not merely how many people viewed a document, but how the document contributed to business outcomes.

---

# Phase 12 — AI Document Intelligence

### Objectives

Introduce AI-powered document understanding.

### Tasks

* metadata generation
* summaries
* semantic search
* document Q&A
* topic extraction
* CTA recommendations
* interactive element suggestions
* engagement analysis
* intent detection
* AI-generated document experiences

### Exit Criteria

AI materially reduces document creation, optimization and analysis effort.

---

# Phase 13 — Scale & Enterprise Hardening

### Objectives

Prepare for high-volume production.

### Tasks

* load testing
* event throughput testing
* processing concurrency testing
* CDN optimization
* storage lifecycle policies
* queue capacity planning
* database cost analysis
* tenant isolation testing
* penetration testing
* disaster recovery
* backup/restore
* observability
* alerting
* SLO monitoring

### Exit Criteria

The platform can operate reliably at SmartSapp's projected multi-tenant scale.

---

# 86. Testing Strategy

## Unit Tests

Test:

* domain logic
* event validation
* access policies
* score calculation
* slug generation
* publishing
* versioning

## Integration Tests

Test:

* document processing
* storage
* Firestore
* viewer configuration
* CRM events
* automation triggers

## Viewer Tests

Test:

* page flip
* swipe
* drag
* zoom
* responsive layouts
* keyboard
* hotspots
* fullscreen

## Security Tests

Test:

* tenant isolation
* unauthorized document access
* expired tokens
* malicious event payloads
* lead spam
* analytics flooding
* XSS
* malicious URLs

The current implementation already reports 17 passing tests and zero TypeScript errors; those tests should become the baseline rather than the final quality bar.

---

# 87. Observability

Monitor:

```text
Document processing failures
Processing duration
Page rendering failures
Viewer errors
Asset delivery latency
Event ingestion rate
Event rejection rate
Queue depth
Analytics processing latency
CRM processing failures
AI processing failures
```

---

# 88. Product Roles

## Workspace Administrator

Can:

* create
* edit
* publish
* delete
* distribute
* analyze

## Content Manager

Can:

* create
* edit
* publish
* manage pages

## Marketing User

Can:

* distribute
* create campaigns
* view analytics

## Sales Executive

Can:

* view contact engagement
* create tracked links
* see document activity
* trigger follow-up

## Viewer

Can:

* read
* interact
* submit forms according to access policy

---

# 89. Permissions

Permission model should support:

```text
documents.view
documents.create
documents.edit
documents.publish
documents.delete
documents.share
documents.analytics
documents.manage_access
documents.manage_templates
documents.manage_integrations
```

---

# 90. Product UX

The main navigation should eventually expose:

```text
Content
  └── Documents
```

rather than:

```text
Marketing
  └── Flipbooks
```

A document can then be used throughout SmartSapp.

---

# 91. CRM Context

Documents should appear in:

### Contact

```text
Documents
 ├── Viewed
 ├── Completed
 ├── Downloaded
 └── Interacted
```

### Campaign

```text
Documents
 ├── Distribution
 ├── Engagement
 └── Conversion
```

### Deal

```text
Documents
 ├── Sent
 ├── Viewed
 └── Engagement
```

### Automation

```text
Triggers
 └── Document engagement
```

---

# 92. Document Templates

Introduce templates as a separate entity.

```typescript
DocumentTemplate {
  id
  workspaceId

  name
  category

  viewerConfig
  pageStructure
  defaultLayers

  createdAt
  updatedAt
}
```

Templates can be:

* SmartSapp system templates
* workspace templates
* AI-generated templates

---

# 93. White Label / Branding

Future enterprise capability:

* custom logo
* custom colors
* custom domain
* custom viewer branding
* custom email metadata
* custom favicon
* hide SmartSapp branding

---

# 94. Internationalization

Design for:

* RTL documents
* multiple languages
* localized UI
* locale-aware dates
* localized CTAs
* multilingual AI

---

# 95. Compliance and Privacy

The platform should support:

* data retention policies
* event retention
* contact deletion
* consent tracking
* privacy-aware analytics
* export
* workspace data deletion

Where analytics identify contacts, the system must respect SmartSapp's broader privacy and data-governance policies.

---

# 96. Data Lifecycle

Document assets:

```text
uploaded
 ↓
processed
 ↓
published
 ↓
active
 ↓
superseded
 ↓
archived
 ↓
deleted
```

Events should have configurable retention.

---

# 97. Disaster Recovery

Critical data:

* document metadata
* versions
* access policies
* CRM associations
* configuration

must be recoverable.

Source files should remain the authoritative reconstruction source wherever practical.

---

# 98. Migration Acceptance Criteria

Migration is complete when:

* every existing flipbook has a Document
* every existing page belongs to a Document Version
* existing URLs work
* analytics continue functioning
* lead capture continues functioning
* existing hotspots work
* existing styling is preserved
* no tenant data is exposed
* existing published content remains accessible

---

# 99. Final Target Architecture

```text
                         SMARTSAPP
                            │
                            ▼
                  DOCUMENT EXPERIENCE
                       PLATFORM
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
   DOCUMENT             PROCESSING           DISTRIBUTION
   STUDIO                 ENGINE                ENGINE
       │                    │                    │
       │             ┌──────┼──────┐             │
       │             │      │      │             │
       │            PDF   DOCX   PPTX           │
       │             │      │      │             │
       │             └──────┼──────┘             │
       │                    │                    │
       └────────────────────┼────────────────────┘
                            ▼
                     DOCUMENT MODEL
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
           PAGES          LAYERS         ASSETS
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                      VIEWER ENGINE
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Desktop         Mobile         Embed
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                     EVENT COLLECTOR
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
              SESSIONS   ANALYTICS    CRM
                 │          │          │
                 │          │          ├── Contact
                 │          │          ├── Lead
                 │          │          ├── Deal
                 │          │          └── Sales Activity
                 │          │
                 │          └── Dashboards
                 │
                 └──────────────┐
                                ▼
                           AUTOMATION
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
           Email              SMS             WhatsApp
              │                 │                 │
              └─────────────────┼─────────────────┘
                                ▼
                              SALES
                                │
                                ▼
                           CONVERSION
```

---

# 100. Definition of Full Maturity

SmartSapp should consider the Document Experience Platform "mature" only when it satisfies all of these conditions:

### Document

* Multiple source formats
* Versioning
* Page model
* Asset model
* Search
* Processing pipeline

### Viewer

* Desktop
* Mobile
* Touch
* Mouse
* Keyboard
* Zoom
* Multiple layouts
* Configurable animation
* Accessibility

### Interactive

* Links
* Media
* Forms
* CTAs
* Navigation
* CRM actions

### Distribution

* Public URLs
* Private links
* Contact links
* Campaigns
* Embeds
* QR
* Domains

### Analytics

* Event tracking
* Sessions
* Page analytics
* Completion
* Dwell
* Interaction
* Attribution

### CRM

* Contact resolution
* Timeline
* Lead scoring
* Deal association
* Sales intelligence

### Automation

* Document triggers
* Page triggers
* Interaction triggers
* Score triggers
* Follow-up actions

### Security

* Tenant isolation
* Signed access
* Protected documents
* Rate limiting
* Abuse prevention
* Audit logs

### AI

* Document intelligence
* Search
* Summaries
* Metadata
* Engagement analysis
* Content assistance
* AI document creation

### Scale

* asynchronous processing
* CDN
* queue-based events
* lazy loading
* caching
* aggregation
* retryable jobs
* observability

---

# 101. Recommended Implementation Order

The most important sequencing decision is:

```text
1. Domain Model
        ↓
2. Security
        ↓
3. Processing Pipeline
        ↓
4. Document Storage/Versioning
        ↓
5. Viewer Engine
        ↓
6. Studio
        ↓
7. Interactive Layers
        ↓
8. Distribution
        ↓
9. Event Infrastructure
        ↓
10. Analytics
        ↓
11. CRM
        ↓
12. Automation
        ↓
13. AI
        ↓
14. Enterprise Scale
```

Do **not** build advanced CRM analytics before the event model is stable.

Do **not** build AI before extracted text, page structure and engagement data are reliable.

Do **not** build multiple document formats before the processing abstraction exists.

Do **not** heavily extend the existing `FlipbookConfig` model; migrate toward the Document domain model instead.

---

# 102. Final Architectural Principle

The single most important principle for this project is:

> **The viewer should generate standardized document events; it should not own CRM intelligence.**

The viewer knows:

```text
"John viewed page 12."
```

The event platform knows:

```text
"John viewed page 12."
```

The CRM decides:

```text
"This increases John's engagement score."
```

The automation engine decides:

```text
"John has reached high intent; create a sales task."
```

This separation keeps the Document Experience Platform reusable across the entire SmartSapp ecosystem while allowing CRM, Marketing, Sales, Campaigns, Lead Scoring and Automation to consume the same engagement signals.

That is the architecture that turns the current Flipbook feature into a **platform capability rather than a feature silo**.
