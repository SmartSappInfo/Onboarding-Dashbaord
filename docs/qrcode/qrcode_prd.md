# SmartSapp QR Platform 2.0 — Product Requirements Document

**Document status:** Proposed
**Product:** SmartSapp QR Platform
**Version:** 2.0
**Primary surfaces:** SmartSapp CRM / Marketing / Forms / Surveys / Meetings / Pages / Payments / Documents / Portals / Automations
**Architecture model:** Multi-tenant, workspace-scoped, event-driven, CRM-aware, AI-assisted
**Primary objective:** Transform QR from a QR-generation utility into a complete physical-to-digital engagement, attribution, automation and intelligence platform.

---

# 1. Executive Summary

SmartSapp currently has a strong QR Studio foundation. The existing implementation already supports workspace-scoped QR entities, dynamic and static QR codes, short-path redirects, scan telemetry, QR customization, poster design, scannability diagnostics, batch import/export, notifications and integrations with SmartSapp Forms, Surveys, Meetings, Pages, Portals, Media and Automations. 

The next release should substantially expand this capability.

SmartSapp QR Platform 2.0 will provide a unified system for:

* QR creation
* QR management
* QR design
* QR templates
* poster/flyer creation
* campaigns
* physical distribution tracking
* placement tracking
* dynamic destinations
* dynamic routing
* scan analytics
* visitor/session intelligence
* CRM attribution
* lead attribution
* conversion tracking
* automation
* AI-assisted design
* AI copy generation
* AI analytics
* security intelligence
* custom short domains
* API/webhooks
* enterprise governance
* billing and usage management

The central product concept changes from:

> **“Create a QR code.”**

to:

> **“Create and manage measurable physical-to-digital journeys.”**

---

# 2. Product Vision

## Vision statement

> **SmartSapp QR Platform enables organizations to connect physical-world interactions to digital experiences, CRM records, campaigns, automations and measurable business outcomes through intelligent, trackable QR experiences.**

The QR itself is only the entry point.

The complete lifecycle becomes:

```text
QR Asset
    ↓
Destination
    ↓
Experience
    ↓
Campaign
    ↓
Distribution
    ↓
Physical Placement
    ↓
Scan
    ↓
Session
    ↓
Visitor Identity
    ↓
CRM Contact / Lead
    ↓
Engagement
    ↓
Conversion
    ↓
Revenue
    ↓
AI Intelligence
    ↓
Optimization
```

---

# 3. Product Goals

## 3.1 Primary goals

### G1 — Build an industry-grade QR platform

Provide scalable QR infrastructure suitable for:

* schools
* SMEs
* marketing teams
* agencies
* enterprise organizations
* multi-location organizations

### G2 — Make QR a SmartSapp platform capability

QR creation should be available directly from:

* Forms
* Surveys
* Meetings
* Landing Pages
* Documents
* Payments
* Invoices
* Portals
* Events
* Canteen
* CRM
* Campaigns
* Media Library

The existing implementation already provides reusable QR entry points through `UnifiedQRSheet` and `CreateQRButton`. 

### G3 — Make every meaningful scan measurable

Track the journey from:

**scan → engagement → identification → conversion.**

### G4 — Make QR CRM-aware

QR interactions should become first-class CRM activities.

### G5 — Make design accessible

Support:

* beginners
* marketing users
* professional designers

without forcing users into a complex Figma/Photoshop-like interface.

### G6 — Introduce AI throughout the lifecycle

AI should assist with:

* creation
* design
* copy
* analytics
* optimization
* routing
* security

### G7 — Support enterprise scale

The architecture must eventually support high-volume scan traffic without making Firestore the synchronous bottleneck.

---

# 4. Non-Goals

The first release of QR 2.0 should **not** attempt to become:

* a complete graphic-design replacement for Figma
* a general-purpose analytics warehouse
* a full marketing automation replacement
* a standalone CRM
* a generic URL shortener marketplace
* a barcode-management platform for every barcode standard

GS1 Digital Link and specialized 2D barcode support should remain future extensions. The current engineering review identifies GS1 compliance as a lower-priority enhancement. 

---

# 5. Existing System Baseline

The current implementation includes:

* `qr_codes`
* `qr_scan_events`
* `short_paths`
* `qr_code_templates`
* QR CRUD
* batch operations
* dynamic redirects
* QR server generation
* ZIP export
* QR designer
* canvas poster designer
* QR preview
* scan analytics
* notifications
* page-builder QR blocks
* cross-module QR sheet

The current QR model already contains organization/workspace IDs, destination metadata, design, tracking, lifecycle state, notifications and statistics. 

The existing scan event model captures timestamp, session, device, browser, operating system, hashed IP, geography, destination and query parameters. 

The upgrade should therefore be an **evolution and refactoring of the existing system**, not a greenfield replacement.

---

# 6. Product Architecture

The target product consists of ten domains.

```text
SmartSapp QR Platform
│
├── QR Assets
│   ├── QR Codes
│   ├── QR Versions
│   ├── QR Collections
│   └── QR Templates
│
├── Destinations
│   ├── URLs
│   ├── SmartSapp Resources
│   └── Experiences
│
├── Design Studio
│   ├── QR Designer
│   ├── Poster Designer
│   ├── Templates
│   └── Brand Integration
│
├── Campaigns
│   ├── Campaigns
│   ├── Distributions
│   └── Placements
│
├── Analytics
│   ├── Scans
│   ├── Sessions
│   ├── Visitors
│   ├── Funnels
│   └── Attribution
│
├── CRM
│   ├── Contacts
│   ├── Leads
│   ├── Activities
│   └── Conversions
│
├── Routing
│   ├── Rules
│   ├── Geo Routing
│   ├── Device Routing
│   └── Time Routing
│
├── Automation
│   ├── Triggers
│   ├── Conditions
│   └── Actions
│
├── AI
│   ├── Creation
│   ├── Design
│   ├── Analytics
│   └── Security
│
└── Administration
    ├── Domains
    ├── API
    ├── Webhooks
    ├── RBAC
    ├── Audit
    └── Billing
```

---

# 7. Target Domain Model

## 7.1 Organization

The top-level tenant.

```typescript
Organization {
  id: string;
  name: string;
}
```

---

# 8. Workspace

Operational tenant boundary.

```typescript
Workspace {
  id: string;
  organizationId: string;
  name: string;
}
```

All QR operational entities remain workspace-scoped.

The existing architecture already enforces this boundary. 

---

# 9. QRCode

The core QR asset.

```typescript
QRCode {
  id: string;
  organizationId: string;
  workspaceId: string;

  name: string;
  slug: string;
  description?: string;

  type: QRCodeType;
  mode: "static" | "dynamic";

  destinationId: string;

  designId?: string;

  campaignId?: string;
  collectionId?: string;

  status:
    | "draft"
    | "active"
    | "scheduled"
    | "paused"
    | "expired"
    | "suspended"
    | "archived";

  trackingConfig: QRTrackingConfig;

  routingConfig?: QRRoutingConfig;

  securityConfig?: QRSecurityConfig;

  lifecycleConfig?: QRLifecycleConfig;

  stats: QRStats;

  createdBy: AuditActor;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 10. QR Types

The existing system supports SmartSapp-native resources and protocol/data QR types. 

The target enum should be:

```typescript
type QRCodeType =
  | "url"
  | "form"
  | "survey"
  | "landing_page"
  | "portal"
  | "meeting"
  | "payment"
  | "invoice"
  | "document"
  | "file"
  | "whatsapp"
  | "sms"
  | "email"
  | "vcard"
  | "wifi"
  | "text"
  | "attendance"
  | "event"
  | "campaign"
  | "custom";
```

---

# 11. QRDestination

Destinations become first-class entities.

```typescript
QRDestination {
  id: string;

  organizationId: string;
  workspaceId: string;

  type: QRDestinationType;

  url?: string;

  resourceType?: string;
  resourceId?: string;

  fallbackUrl?: string;

  title: string;

  metadata?: Record<string, unknown>;

  status: "active" | "inactive";

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

This separates:

> QR identity

from:

> destination identity.

A QR can therefore retain its scan history while its destination evolves.

---

# 12. QR Version

Dynamic destinations should be versioned.

```typescript
QRVersion {
  id: string;

  qrCodeId: string;

  version: number;

  destinationId: string;

  routingConfig?: QRRoutingConfig;

  changeReason?: string;

  createdBy: AuditActor;

  createdAt: Timestamp;
}
```

Historical scan events must always reference the effective version.

---

# 13. QRDesign

```typescript
QRDesign {
  id: string;

  organizationId: string;
  workspaceId: string;

  qrCodeId?: string;

  mode: "simple" | "advanced";

  pattern: QRPatternConfig;
  eyes: QREyeConfig;
  colors: QRColorConfig;
  gradients?: QRGradientConfig;
  logo?: QRLogoConfig;
  frame?: QRFrameConfig;

  poster?: CanvasState;

  brandKitId?: string;

  qualityScore?: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

This also resolves the current `posterData: any` technical debt identified in the review. 

---

# 14. CanvasState

Replace untyped poster state.

```typescript
CanvasState {
  width: number;
  height: number;

  background: CanvasBackground;

  elements: CanvasElement[];

  guides?: CanvasGuide[];
  grid?: CanvasGrid;

  metadata?: {
    bleed?: number;
    dpi?: number;
  };
}
```

Elements:

```typescript
CanvasElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | QRCanvasElement
  | DividerElement;
```

---

# 15. QRCampaign

```typescript
QRCampaign {
  id: string;

  organizationId: string;
  workspaceId: string;

  name: string;
  description?: string;

  objective:
    | "awareness"
    | "lead_generation"
    | "registration"
    | "engagement"
    | "payment"
    | "conversion"
    | "feedback"
    | "other";

  startAt?: Timestamp;
  endAt?: Timestamp;

  channel?: string;

  targetAudience?: SegmentReference;

  qrCodeIds: string[];

  attributionConfig: AttributionConfig;

  metrics: CampaignMetrics;

  status:
    | "draft"
    | "active"
    | "paused"
    | "completed"
    | "archived";

  createdBy: AuditActor;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 16. QRDistribution

A QR can have many physical or digital distributions.

```typescript
QRDistribution {
  id: string;

  qrCodeId: string;
  campaignId?: string;

  channel:
    | "poster"
    | "flyer"
    | "brochure"
    | "website"
    | "email"
    | "sms"
    | "whatsapp"
    | "social"
    | "document"
    | "presentation"
    | "digital_screen"
    | "signage"
    | "table_tent"
    | "business_card"
    | "other";

  placementId?: string;

  assetId?: string;

  audienceId?: string;

  distributedAt?: Timestamp;

  metadata?: Record<string, unknown>;

  createdAt: Timestamp;
}
```

---

# 17. QRPlacement

Physical-world intelligence requires a placement entity.

```typescript
QRPlacement {
  id: string;

  organizationId: string;
  workspaceId: string;

  name: string;

  locationType:
    | "school_gate"
    | "reception"
    | "office"
    | "classroom"
    | "bus"
    | "canteen"
    | "event"
    | "notice_board"
    | "website"
    | "other";

  locationName?: string;

  building?: string;
  area?: string;

  latitude?: number;
  longitude?: number;

  description?: string;

  createdAt: Timestamp;
}
```

---

# 18. QRCollection

```typescript
QRCollection {
  id: string;

  organizationId: string;
  workspaceId: string;

  name: string;
  description?: string;

  qrCodeIds: string[];

  campaignId?: string;

  color?: string;

  createdBy: AuditActor;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Example:

**2026 Admissions**

containing:

* Admissions QR
* Open Day QR
* Prospectus QR
* Application QR
* WhatsApp QR
* Meeting QR

---

# 19. QRScanEvent

The existing event becomes the canonical telemetry event. 

```typescript
QRScanEvent {
  id: string;

  organizationId: string;
  workspaceId: string;

  qrCodeId: string;
  qrVersionId?: string;

  campaignId?: string;
  distributionId?: string;
  placementId?: string;

  sessionId: string;
  visitorId?: string;

  contactId?: string;
  leadId?: string;

  scannedAt: Timestamp;

  device: DeviceContext;
  browser: BrowserContext;
  operatingSystem: OSContext;

  geo?: GeoContext;

  referrer?: string;

  queryParams?: Record<string, string>;

  utm?: UTMContext;

  destination: DestinationSnapshot;

  consent?: ConsentSnapshot;

  attribution?: AttributionSnapshot;

  eventVersion: number;
}
```

---

# 20. QRVisitor

Anonymous visitors should have a persistent privacy-aware identity.

```typescript
QRVisitor {
  id: string;

  organizationId: string;
  workspaceId: string;

  firstSeenAt: Timestamp;
  lastSeenAt: Timestamp;

  sessionCount: number;
  scanCount: number;

  firstQrCodeId?: string;
  lastQrCodeId?: string;

  contactId?: string;
  leadId?: string;

  consentStatus: ConsentStatus;
}
```

---

# 21. QRSession

```typescript
QRSession {
  id: string;

  organizationId: string;
  workspaceId: string;

  visitorId?: string;

  qrCodeId: string;
  campaignId?: string;

  startedAt: Timestamp;
  lastActivityAt: Timestamp;

  device?: DeviceContext;
  geo?: GeoContext;

  events: number;

  identifiedAt?: Timestamp;

  conversion?: ConversionSnapshot;
}
```

---

# 22. Identity Resolution

The platform must support:

```text
Anonymous Visitor
        ↓
Identified Visitor
        ↓
Contact
        ↓
Lead
        ↓
Customer
```

Identification may occur through:

* form submission
* survey response
* meeting booking
* login
* portal access
* payment
* explicit contact capture

The QR system must never assume that an anonymous scan is automatically a known CRM contact.

---

# 23. QRConversion

```typescript
QRConversion {
  id: string;

  qrCodeId: string;

  campaignId?: string;

  sessionId?: string;

  visitorId?: string;

  contactId?: string;
  leadId?: string;

  conversionType:
    | "form_submission"
    | "survey_completion"
    | "meeting_booking"
    | "payment"
    | "document_signature"
    | "lead_created"
    | "deal_created"
    | "customer_created"
    | "custom";

  value?: number;
  currency?: string;

  occurredAt: Timestamp;
}
```

---

# 24. QR Routing Rules

```typescript
QRRoutingRule {
  id: string;

  qrCodeId: string;

  priority: number;

  conditions: RoutingCondition[];

  destinationId: string;

  enabled: boolean;

  createdAt: Timestamp;
}
```

Supported conditions:

* country
* region
* city
* language
* device
* OS
* time
* date
* campaign
* visitor identity
* CRM segment
* lead status
* contact status
* query parameter

---

# 25. QR Security Configuration

```typescript
QRSecurityConfig {
  destinationSecurity: "standard" | "strict";

  passwordEnabled: boolean;

  passwordHash?: string;

  geoRestrictions?: GeoRestriction[];

  scanLimit?: number;

  expirationEnabled: boolean;

  expiresAt?: Timestamp;

  malwareScanningEnabled: boolean;

  domainMonitoringEnabled: boolean;
}
```

---

# 26. QR Lifecycle

## State machine

```text
DRAFT
  │
  ▼
SCHEDULED
  │
  ▼
ACTIVE
  │
  ├────► PAUSED
  │        │
  │        └────► ACTIVE
  │
  ├────► EXPIRED
  │
  ├────► SUSPENDED
  │
  └────► ARCHIVED
```

### Draft

Not publicly active.

### Scheduled

Configured for future activation.

### Active

Redirects normally.

### Paused

Returns a branded pause experience.

### Expired

Returns expiration experience.

### Suspended

Security/governance suspension.

### Archived

No longer operational.

The existing implementation currently supports `active`, `paused` and `archived`, including branded pause behavior and HTTP 410 handling for archived codes. 

---

# 27. Event Taxonomy

The platform must introduce canonical events.

## QR lifecycle

```text
qr.created
qr.updated
qr.published
qr.scheduled
qr.paused
qr.resumed
qr.expired
qr.suspended
qr.archived
```

## Scan

```text
qr.scanned
qr.unique_scan
qr.returning_scan
qr.session_started
qr.destination_opened
```

## Identity

```text
qr.identity_detected
qr.identity_resolved
qr.contact_linked
qr.lead_linked
```

## Engagement

```text
qr.form_started
qr.form_submitted
qr.survey_started
qr.survey_completed
qr.meeting_started
qr.meeting_booked
qr.document_opened
qr.document_signed
qr.payment_started
qr.payment_completed
```

## CRM

```text
qr.lead_created
qr.lead_updated
qr.deal_created
qr.converted
```

## Security

```text
qr.security_warning
qr.destination_blocked
qr.domain_warning
qr.anomaly_detected
```

---

# 28. Event Architecture

The event pipeline should be:

```text
Scan
 │
 ▼
Edge Redirect
 │
 ├──────────► Destination
 │
 ▼
Event Ingestion
 │
 ▼
Queue / Stream
 │
 ├──► Raw Telemetry
 ├──► Aggregation
 ├──► CRM
 ├──► Automation
 ├──► Webhooks
 └──► AI
```

The current architecture already asynchronously logs scans so redirect latency is not blocked by telemetry writes. 

This principle must remain.

---

# 29. Redirect Architecture

## Current

```text
/q/:shortPath
      ↓
Firestore
      ↓
Async logging
      ↓
302
```

## Target

```text
User
 ↓
Edge
 ↓
KV/cache
 ↓
QR routing
 ↓
302/307
 ↓
Event queue
```

Use:

* edge execution
* cache
* short-path index
* event queue
* asynchronous processing

The existing engineering recommendation specifically proposes Edge Middleware plus Redis/KV-style caching for global redirect performance. 

---

# 30. Short Path Architecture

Retain:

```text
short_paths/{shortPath}
```

with:

```typescript
ShortPathIndex {
  organizationId: string;
  workspaceId: string;
  qrCodeId: string;
  createdAt: Timestamp;
}
```

The current design intentionally provides an O(1)-style lookup instead of collection-group scanning. 

This should remain.

---

# 31. Destination Security

The existing system already performs safe URL validation and blocks several suspicious patterns including raw IPs, selected suspicious TLDs and executable file destinations. 

The target security layer should include:

### Static validation

* HTTPS requirement
* malformed URL rejection
* raw IP detection
* dangerous protocol rejection
* executable destination rejection

### Reputation

* domain reputation
* malware detection
* phishing detection
* redirect chain analysis

### Continuous monitoring

* destination changed
* domain expired
* domain reputation changed
* unexpected redirects
* defacement

---

# 32. QR Quality Engine

The current engine checks:

* luminance contrast
* inversion
* logo size
* error correction
* quiet zone. 

Convert this into a formal scoring engine.

```text
QR Quality Score
----------------
Contrast             20
Finder visibility    20
Quiet zone           15
Logo obstruction     15
Error correction     10
Resolution            10
Print suitability     10
------------------------
Total                100
```

Statuses:

```text
90–100 Excellent
75–89 Good
60–74 Warning
<60 Unsafe
```

---

# 33. Print Intelligence

The platform should evaluate:

* physical size
* estimated viewing distance
* QR density
* print resolution
* contrast
* quiet zone
* medium
* poster dimensions

Recommended outputs:

> “Increase QR size to at least 45mm for this A4 poster.”

> “Logo is reducing the safety margin.”

> “Current contrast may perform poorly under low-quality printing.”

---

# 34. Design System

## Simple Designer

For everyday users.

```text
Template
Brand
Color
Logo
Frame
CTA
Preview
```

## Brand Designer

```text
Pattern
Eyes
Gradients
Logo
Typography
CTA
Brand kit
```

## Advanced Designer

```text
Canvas
Layers
Text
Shapes
Images
QR
Alignment
Grid
Guides
Print settings
Bleed
Safe zones
```

---

# 35. Existing Design Capabilities to Preserve

The current implementation supports:

* multiple dot styles
* multiple eye styles
* color customization
* gradients
* logo overlays
* frame styles
* CTA badges
* canvas elements
* poster presets
* PNG/JPG/PDF export. 

These capabilities should be retained and reorganized rather than removed.

---

# 36. QR Templates

Template categories:

```text
Admissions
Open Day
Events
Payments
Feedback
Survey
Registration
Meetings
Documents
Menus
Contact
Marketing
Social
```

Template ownership:

```text
SmartSapp System
Organization
Workspace
Personal
```

---

# 37. Brand Kit Integration

QR Designer should consume the organization's existing branding.

```text
Logo
Primary Color
Secondary Color
Fonts
Brand Assets
Button Style
```

One-click action:

> **Apply Brand**

---

# 38. AI Creation

Add:

**Create with AI**

Example:

> “Create a QR poster for our 2026 Open Day.”

AI should infer:

```text
Destination
Campaign
CTA
Design
Brand
Placement
Tracking
```

The user should review the generated configuration before publishing.

---

# 39. AI Copy Assistant

Generate:

* QR headline
* CTA
* supporting text
* poster copy
* instructions
* email copy
* SMS copy
* WhatsApp copy
* social copy

Example:

> **Scan to Register for Open Day**

---

# 40. AI Design Assistant

AI should be able to:

* recommend template
* recommend QR size
* recommend contrast
* recommend CTA
* recommend frame
* suggest placement
* adapt existing poster
* generate supporting visual concepts

AI must never knowingly generate a visually attractive but technically unscannable QR.

---

# 41. AI Analytics Assistant

Natural language queries:

```text
Why did scans fall this week?

Which QR is performing best?

Which campaign produces the most leads?

Which location converts best?

Which QR should I pause?

What changed this month?

Where should we place another QR?
```

Responses should include:

* finding
* evidence
* contributing factors
* recommendation
* confidence
* action

---

# 42. AI Anomaly Detection

Detect:

* unusual scan spikes
* sudden scan drops
* geographic anomalies
* suspicious traffic
* bot-like behavior
* destination changes
* abnormal conversion drops

Example:

> “Scans increased 480% within 20 minutes from one location. Traffic appears anomalous.”

---

# 43. AI Portfolio Management

Portfolio-level AI:

> “You have 11 QR codes with fewer than five scans in the last 30 days.”

Suggested actions:

```text
Review
Archive
Move
Redesign
Change destination
```

---

# 44. Dynamic Routing

One QR can support multiple destinations.

Example:

```text
Ghana → Ghana Admissions
Nigeria → Nigeria Admissions

Existing lead → Applicant Portal
New visitor → Registration Form

Before 6PM → Booking
After 6PM → WhatsApp
```

---

# 45. Routing Rule Builder

UX:

```text
WHEN
QR is scanned

IF
Country = Ghana

AND
Lead status = New

THEN
Open Admissions Form
```

Users should be able to add:

* AND
* OR
* nested groups
* priority
* fallback

---

# 46. CRM Integration

QR must appear inside CRM contact timelines.

Example:

```text
10:42
Scanned Open Day QR

10:43
Opened registration form

10:45
Submitted enquiry

10:46
Lead created

11:15
Admissions task created
```

The QR ID and campaign metadata must survive throughout the journey.

---

# 47. Forms Integration

Flow:

```text
QR
 ↓
Form
 ↓
Submission
 ↓
Visitor identification
 ↓
Contact
 ↓
Lead
```

Submission metadata should preserve:

```text
qrCodeId
qrVersionId
campaignId
distributionId
placementId
sessionId
visitorId
```

---

# 48. Surveys Integration

Flow:

```text
QR
 ↓
Survey
 ↓
Response
 ↓
Contact
 ↓
Segment
 ↓
Automation
```

Use cases:

* parent feedback
* event feedback
* NPS
* staff feedback
* service evaluation

---

# 49. Meetings Integration

```text
Physical QR
 ↓
Meeting landing page
 ↓
Calendar booking
 ↓
Lead/contact
 ↓
CRM activity
```

The meeting must retain QR attribution.

---

# 50. Payments Integration

Support:

```text
Fee payment
Invoice payment
Event payment
Registration payment
Donation
```

Track:

```text
Scans
Payment starts
Payment attempts
Successful payments
Revenue
Conversion rate
```

---

# 51. Documents Integration

```text
QR
 ↓
Document
 ↓
Open
 ↓
Download
 ↓
Sign
```

Track each stage.

---

# 52. Canteen Integration

Potential QR experiences:

* menu
* ordering
* meal claim
* payment
* student identification

The QR event can become part of the existing canteen transaction journey.

---

# 53. Landing Page Integration

Page Builder:

> **Add QR**

QR Studio:

> **Use Landing Page**

The QR block should support:

* live QR preview
* responsive rendering
* destination validation
* design synchronization

The current system already provides a page-builder QR block. 

---

# 54. Media Library Integration

Generated assets should automatically become reusable Media Library assets.

Formats:

* PNG
* SVG
* JPG
* PDF
* poster
* flyer
* social image

---

# 55. Automation Engine

Existing functionality includes a `qr_scan_alert` notification trigger and `scanned_qr` automation condition. 

Expand to:

## Triggers

```text
QR scanned
Unique scan
Returning scan
Known contact scans
Lead scans
Scan threshold
Destination opened
Conversion
Payment completed
Meeting booked
```

## Actions

```text
Create lead
Update contact
Add tag
Remove tag
Send email
Send SMS
Send WhatsApp
Create task
Assign owner
Update deal
Start campaign
Create meeting
Create payment
Webhook
API call
```

---

# 56. Example Automation

```text
QR SCANNED
    ↓
Known contact?
 ┌──┴───┐
YES    NO
 │      │
Update  Create
CRM     visitor
 │      │
Add tag Start journey
 │
Create task
 │
Notify admissions
```

---

# 57. QR Campaign Analytics

Campaign dashboard:

```text
Campaign: 2026 Open Day

QR Codes              7
Scans              8,420
Unique visitors    6,970
Leads              1,240
Meetings             186
Payments              64
Revenue          GHS XX,XXX
Conversion          XX%
```

---

# 58. Funnel Analytics

The analytics engine must support:

```text
Scans
 ↓
Destination visits
 ↓
Engaged sessions
 ↓
CTA clicks
 ↓
Form starts
 ↓
Form submissions
 ↓
Leads
 ↓
Qualified leads
 ↓
Meetings
 ↓
Payments
 ↓
Customers
```

---

# 59. Attribution Models

Support:

### First-touch

First QR interaction receives attribution.

### Last-touch

Most recent QR interaction receives attribution.

### Multi-touch

Multiple QR interactions receive weighted attribution.

Configuration:

```typescript
AttributionConfig {
  model: "first_touch" | "last_touch" | "multi_touch";

  lookbackDays: number;

  includeAnonymous: boolean;
}
```

---

# 60. Analytics Dashboard

## Overview

Metrics:

* scans
* unique visitors
* returning visitors
* sessions
* conversions
* leads
* revenue

## Acquisition

* campaign
* channel
* UTM
* referrer

## Audience

* visitor type
* contact status
* lead status

## Technology

* OS
* browser
* device

## Geography

* country
* region
* city

## Placement

* physical location
* campaign
* distribution

## Conversion

* conversion type
* conversion rate
* revenue

---

# 61. QR Home

Navigation:

```text
QR Studio

Home
QR Codes
Collections
Campaigns
Distribution
Templates
Analytics
Automations
AI Insights
Domains
API & Webhooks
Settings
```

---

# 62. QR Dashboard UX

Header:

```text
QR Studio

[Create QR]
[Create with AI]
[Bulk Create]
```

Metrics:

```text
Active QR
Total Scans
Unique Visitors
Conversions
Revenue
```

Panels:

* scan trend
* top QR codes
* top campaigns
* top placements
* conversion funnel
* AI recommendations

---

# 63. QR Table

Columns:

```text
QR
Type
Destination
Campaign
Status
Scans
Unique
Conversion
Last Scan
Owner
```

Filters:

```text
Status
Type
Campaign
Owner
Date
Location
Performance
```

Saved views:

```text
My QR Codes
Top Performing
Needs Attention
Admissions
Payments
Events
Archived
```

---

# 64. QR Detail

Tabs:

```text
Overview
Analytics
Design
Destination
Routing
Campaign
Distribution
CRM
Automations
Activity
Settings
```

Header actions:

```text
Scan
Edit
Pause
Share
Download
Duplicate
Archive
```

---

# 65. Creation Wizard

The current four-step wizard should evolve into a guided six-step workflow. 

## Step 1 — Destination

> What should people access?

## Step 2 — Experience

Choose:

* direct destination
* SmartSapp experience
* dynamic routing

## Step 3 — Tracking

Configure:

* campaign
* UTM
* attribution
* identity tracking

## Step 4 — Design

Choose:

* template
* brand
* customization

## Step 5 — Quality & Security

Show:

* QR Quality Score
* security status
* print recommendations

## Step 6 — Publish

Configure:

* name
* short path
* domain
* expiration
* status

---

# 66. AI Creation UX

Alternative entry point:

```text
Create QR with AI
```

User enters natural language.

AI generates draft.

The UI displays:

```text
Destination
Campaign
CTA
Design
Tracking
Security
```

User confirms.

No AI-generated QR should automatically become public without confirmation unless an explicit organizational automation policy permits it.

---

# 67. Bulk QR Generation

The current system supports CSV import up to 500 rows and chunked processing. 

Upgrade to:

* CSV
* Excel
* API
* CRM contacts
* Form submissions
* data imports

Example:

```text
Student ID
Student Name
Class
Destination
```

Generate:

```text
500 unique QR codes
```

Each code must have independent tracking.

---

# 68. Batch Export

Retain ZIP generation and memory-throttled processing.

Exports:

```text
PNG
SVG
JPG
PDF
ZIP
CSV analytics
```

---

# 69. Custom Domains

Enterprise users should be able to configure:

```text
go.school.com/q/admissions
```

rather than:

```text
smartsapp.com/q/admissions
```

Capabilities:

* domain verification
* CNAME
* SSL
* routing
* domain health
* default QR domain
* branded fallback pages

---

# 70. QR API

Provide REST APIs.

### Create

```http
POST /v1/qr-codes
```

### List

```http
GET /v1/qr-codes
```

### Retrieve

```http
GET /v1/qr-codes/:id
```

### Update

```http
PATCH /v1/qr-codes/:id
```

### Archive

```http
POST /v1/qr-codes/:id/archive
```

### Generate

```http
POST /v1/qr-codes/:id/generate
```

### Analytics

```http
GET /v1/qr-codes/:id/analytics
```

### Bulk

```http
POST /v1/qr-codes/bulk
```

---

# 71. Webhooks

Provide:

```text
qr.created
qr.updated
qr.published
qr.scanned
qr.unique_scan
qr.identity_resolved
qr.destination_opened
qr.converted
qr.paused
qr.expired
qr.security_warning
```

The current technical review specifically recommends QR scan/conversion webhooks, which should become part of this broader event contract. 

---

# 72. Security

## Application security

* tenant isolation
* RBAC
* authorization checks
* audit logs
* input validation
* signed operations
* rate limiting

## Redirect security

* HTTPS
* destination validation
* SSRF prevention
* phishing detection
* malware scanning
* redirect chain validation

## QR abuse

* scan rate limiting
* bot detection
* enumeration protection
* suspicious traffic detection

---

# 73. Privacy

Support configurable telemetry policies.

### Standard

Anonymous telemetry.

### Enhanced

CRM attribution where permitted.

### Strict

Minimal telemetry.

Retention:

```text
30 days
90 days
1 year
Custom
```

IP information must remain privacy-preserving rather than storing raw IPs.

The current implementation already uses salted SHA-256 hashing for IP telemetry. 

---

# 74. RBAC

Permissions:

```text
qr.view
qr.create
qr.edit
qr.design
qr.publish
qr.pause
qr.archive
qr.delete
qr.analytics
qr.export
qr.campaign.manage
qr.distribution.manage
qr.automation.manage
qr.domain.manage
qr.bulk.manage
qr.api.manage
qr.admin
```

Suggested roles:

### QR Viewer

View QR and basic analytics.

### QR Editor

Create/edit/design.

### QR Manager

Publish, campaign, analytics and automation.

### QR Administrator

Domains, governance, API, billing and security.

---

# 75. Audit Logs

Record:

```text
Actor
Action
Timestamp
QR
Workspace
IP/device metadata where appropriate
Previous value
New value
Reason
```

Examples:

```text
Destination changed
QR published
QR paused
QR archived
Design changed
Domain connected
Bulk export performed
```

---

# 76. Billing & Entitlements

Integrate QR into SmartSapp's centralized entitlement system.

Entitlements:

```text
qr.codes
qr.dynamic_codes
qr.scans
qr.analytics
qr.ai
qr.bulk
qr.custom_domains
qr.routing
qr.automation
qr.api
qr.webhooks
qr.white_label
```

Usage metrics:

```text
Active dynamic QR
Monthly scans
AI operations
Bulk codes
API requests
Storage
Custom domains
```

---

# 77. White Label

Enterprise capability:

* remove SmartSapp branding
* custom domains
* branded pause page
* branded expiration page
* custom templates
* branded analytics
* custom notification identity

---

# 78. Reporting

Reports:

### QR Performance

* QR
* scans
* unique visitors
* conversions
* leads
* revenue

### Campaign Performance

* campaign
* scans
* conversion
* revenue

### Placement Performance

* location
* scans
* leads
* conversion

### Portfolio Report

* active
* paused
* expired
* underperforming
* security warnings

Export:

* CSV
* XLSX
* PDF

---

# 79. Scheduled Reporting

Users can schedule:

```text
Daily
Weekly
Monthly
Campaign completion
```

Recipients can be:

* users
* teams
* configured email recipients

---

# 80. Firestore Target Architecture

Recommended:

```text
organizations/{orgId}
  workspaces/{workspaceId}

    qr_codes/{qrId}
    qr_destinations/{destinationId}
    qr_designs/{designId}
    qr_versions/{versionId}

    qr_campaigns/{campaignId}
    qr_collections/{collectionId}
    qr_distributions/{distributionId}
    qr_placements/{placementId}

    qr_scan_events/{eventId}
    qr_sessions/{sessionId}
    qr_visitors/{visitorId}

    qr_templates/{templateId}
    qr_routing_rules/{ruleId}
    qr_automations/{automationId}

    qr_analytics_daily/{date}
    qr_campaign_analytics/{campaignId}
```

Global:

```text
short_paths/{shortPath}
custom_domains/{domain}
```

---

# 81. Analytics Data Architecture

Do not rely indefinitely on raw Firestore queries for high-volume analytics.

Target:

```text
Scan
 ↓
Event Queue
 ↓
Stream Processor
 ├── Firestore operational data
 ├── daily aggregates
 ├── campaign aggregates
 ├── CRM events
 ├── automation
 └── analytical warehouse
```

Firestore remains the operational source.

Analytical infrastructure becomes responsible for:

* historical analytics
* complex funnels
* cohort analysis
* attribution
* AI queries

---

# 82. Search Architecture

QR search should support:

* name
* slug
* campaign
* destination
* QR type
* owner
* status
* tags
* collection

Eventually support indexed search for:

```text
"admissions QR"
"payment QR"
"QRs with >1000 scans"
"QRs created this month"
```

AI search can sit above structured search.

---

# 83. Observability

Monitor:

### Redirect

* p50 latency
* p95 latency
* p99 latency
* error rate

### Event ingestion

* event throughput
* queue depth
* processing latency
* dropped events

### Analytics

* aggregation lag
* processing failures

### AI

* generation latency
* failure rate
* token usage
* cost

### Security

* blocked destinations
* suspicious scans
* abuse events

---

# 84. Reliability Requirements

Target:

### Redirect availability

**99.99%**

### Analytics processing

**99.9%**

### Management UI

**99.9%**

### Event durability

No intentional loss of accepted scan events.

If analytics processing fails, events must be replayable.

---

# 85. Performance Requirements

### QR redirect

Target:

**<100ms server-side decision latency**, with edge caching targeting significantly lower latency.

### QR preview

Initial render:

**<2 seconds**

### Designer interactions

Target:

**60 FPS** under normal canvas workloads.

### Analytics dashboard

Initial visible metrics:

**<2 seconds**

---

# 86. Accessibility

The management UI must meet WCAG 2.2 AA principles.

Requirements:

* keyboard navigation
* focus states
* accessible dialogs
* accessible tabs
* screen-reader labels
* sufficient contrast
* reduced-motion support
* accessible charts
* non-color-only indicators

QR itself must have technical scannability safeguards.

---

# 87. Responsive UX

### Desktop

Full workspace.

### Tablet

Condensed navigation and simplified designer.

### Mobile

Prioritize:

* create
* share
* scan
* analytics
* pause
* resume

Advanced canvas editing should remain desktop-first.

---

# 88. Empty States

Examples:

### No QR codes

> “Create your first QR code and connect a physical touchpoint to a SmartSapp experience.”

Actions:

```text
Create QR
Create with AI
Browse Templates
```

### No scans

> “No scans yet. Share or print your QR code to start collecting engagement data.”

### No campaigns

> “Organize QR codes into campaigns to measure physical marketing performance.”

---

# 89. Loading States

Use skeletons for:

* QR tables
* analytics
* campaign metrics
* QR detail
* designer assets

Do not block the entire workspace for individual analytics panels.

---

# 90. Error States

Examples:

### Destination invalid

> “This destination could not be validated.”

### QR generation failed

> “We couldn't generate this QR code. Try again.”

### Security block

> “This destination has been blocked because it may be unsafe.”

### Analytics unavailable

> “Analytics are temporarily unavailable. Your scan data is being retained and will appear when processing completes.”

---

# 91. QR Public Experience Requirements

The public scan experience must prioritize:

1. speed
2. reliability
3. mobile UX
4. security
5. destination accuracy

Avoid unnecessary interstitial pages.

---

# 92. Public Experience Types

Support:

```text
Direct Redirect
SmartSapp Landing Page
Form
Survey
Meeting
Payment
Portal
Document
File
WhatsApp
SMS
Email
Custom Experience
```

---

# 93. Conversion Attribution

A QR-generated conversion must preserve:

```text
QR
QR version
Campaign
Distribution
Placement
Visitor
Session
Contact
Lead
Conversion
Revenue
```

This enables:

> “This school generated GHS 14,200 in payments from its Open Day QR campaign.”

---

# 94. Security State Machine

```text
UNKNOWN
   ↓
SCANNING
   ↓
VALIDATED
   │
   ├── SAFE
   │
   ├── WARNING
   │
   └── BLOCKED
```

A security block must override routing.

---

# 95. AI Governance

AI-generated:

* destinations
* designs
* copy
* routing rules
* automations

should be treated as **drafts** unless an explicit automation policy authorizes execution.

AI must explain important recommendations.

For example:

> “Recommended because the Main Gate generates 62% of scans but only 14% of conversions.”

---

# 96. AI Cost Controls

Track:

```text
AI generations
AI analytics queries
AI image generations
AI optimization runs
```

Apply:

* plan limits
* credit consumption
* rate limits
* caching
* model selection

---

# 97. Migration Strategy

Existing documents:

```text
qr_codes
qr_scan_events
short_paths
qr_code_templates
```

should be migrated incrementally.

### Migration sequence

```text
Existing QR
 ↓
Create QRDestination
 ↓
Create QRDesign
 ↓
Create QRVersion
 ↓
Map campaign metadata
 ↓
Preserve existing shortPath
 ↓
Continue existing scan history
```

Do not regenerate existing short paths.

Existing QR links must remain functional.

---

# 98. Backward Compatibility

Existing URLs:

```text
/q/{shortPath}
```

must continue to work.

Existing QR images must remain valid.

Existing QR IDs must remain stable.

Existing scan events must remain queryable.

Existing integrations must continue functioning while the new architecture is introduced.

---

# 99. API Versioning

Use:

```text
/v1/
```

for public API.

Internal event schemas should include:

```typescript
eventVersion: number;
```

Schema evolution must be backward compatible.

---

# 100. Testing Requirements

## Unit tests

* QR encoding
* short-path generation
* collision detection
* destination validation
* routing
* quality scoring
* analytics
* attribution
* identity resolution

## Integration tests

* QR → Form
* QR → Survey
* QR → CRM
* QR → Meeting
* QR → Payment
* QR → Document
* QR → Automation

## E2E

```text
Create
 ↓
Design
 ↓
Publish
 ↓
Scan
 ↓
Redirect
 ↓
Track
 ↓
Identify
 ↓
Convert
 ↓
CRM
```

## Load testing

Test:

* 1,000 scans/min
* 10,000 scans/min
* 100,000 scans/min
* 1M scans/day

---

# 101. Phase-by-Phase Implementation

## PHASE 1 — QR Core Infrastructure

### Engineering

* domain model refactor
* destination entities
* QR versions
* lifecycle
* canonical events
* strict typing
* security hardening
* redirect optimization
* migration framework

### UX

* new QR Home
* QR table
* QR detail
* improved creation wizard
* lifecycle controls

### Deliverable

**Production-grade QR infrastructure.**

---

# 102. PHASE 2 — Professional QR Studio

### Engineering

* design entity
* template engine
* CanvasState
* brand integration
* export pipeline
* QR quality engine

### UX

* Simple Designer
* Brand Designer
* Advanced Designer
* Template gallery
* poster studio
* quality inspector

### Deliverable

**Professional QR creation platform.**

---

# 103. PHASE 3 — Campaign & Distribution

### Engineering

* campaigns
* collections
* distributions
* placements
* bulk generation
* campaign attribution

### UX

* Campaign workspace
* Distribution Manager
* Placement Manager
* QR Collections
* bulk generator

### Deliverable

**Physical campaign management.**

---

# 104. PHASE 4 — Analytics & CRM

### Engineering

* visitor identity
* sessions
* CRM attribution
* conversion model
* funnel analytics
* revenue attribution
* analytical aggregation

### UX

* Analytics
* Funnels
* Attribution
* CRM timeline
* Conversion dashboard

### Deliverable

**QR-to-CRM intelligence.**

---

# 105. PHASE 5 — Automation

### Engineering

* event triggers
* conditions
* actions
* webhook integration
* automation execution

### UX

* QR automation builder
* trigger configuration
* activity monitoring

### Deliverable

**QR-triggered customer journeys.**

---

# 106. PHASE 6 — AI

### Engineering

* AI assistant
* analytics reasoning
* design generation
* anomaly detection
* security intelligence
* recommendation engine

### UX

* AI Create
* AI Design
* Ask QR Intelligence
* AI Insights
* AI Portfolio Health

### Deliverable

**AI-assisted QR management.**

---

# 107. PHASE 7 — Enterprise

### Engineering

* edge infrastructure
* custom domains
* advanced routing
* enterprise RBAC
* audit
* API
* webhooks
* billing
* white-label

### UX

* Domains
* API console
* webhook console
* enterprise settings
* usage dashboard

### Deliverable

**Enterprise QR infrastructure platform.**

---

# 108. Phase Dependencies

```text
PHASE 1
   │
   ├────► PHASE 2
   │
   ├────► PHASE 3
   │          │
   │          ▼
   └────► PHASE 4
              │
              ▼
          PHASE 5
              │
              ▼
          PHASE 6
              │
              ▼
          PHASE 7
```

Phase 1 must establish the canonical domain/event architecture before large-scale analytics and automation are built.

---

# 109. Success Metrics

## Adoption

* QR codes created
* active QR codes
* organizations using QR
* workspaces using QR
* repeat creators

## Engagement

* total scans
* unique visitors
* returning visitors
* sessions

## CRM

* contacts identified
* leads generated
* meetings booked
* deals created

## Conversion

* conversion rate
* payment conversions
* revenue attributed

## Design

* templates used
* AI designs generated
* exports
* print-ready QR percentage

## AI

* AI creation adoption
* AI analytics queries
* recommendations accepted

## Platform

* redirect latency
* uptime
* event processing latency
* error rate

---

# 110. Product KPIs

The primary north-star metric should not be:

> **QR codes created.**

Instead:

> **Attributed QR Engagements That Produce a Meaningful Digital Outcome**

Supporting metric:

> **QR-to-Conversion Rate**

This aligns QR with SmartSapp's CRM and business-outcome orientation.

---

# 111. Example End-to-End SmartSapp Journey

Consider a school running an Open Day campaign.

### Marketing creates campaign

```text
2026 Open Day
```

### Creates QR

```text
Open Day Registration
```

### AI creates design

```text
School branding
CTA:
Scan to Register
```

### Designer creates:

* A4 poster
* social graphic
* table tent
* reception signage

### Each distribution gets an identifier

```text
Main Gate
Reception
Facebook
WhatsApp
```

### Parent scans

```text
QR
 ↓
Session
 ↓
Registration page
```

### Parent submits form

```text
Anonymous visitor
 ↓
Contact
 ↓
Lead
```

### CRM records

```text
Source:
Open Day QR

Placement:
Main Gate

Campaign:
2026 Open Day
```

### Automation executes

```text
Create lead
 ↓
Assign admissions officer
 ↓
Send confirmation
 ↓
Create follow-up task
```

### Parent books meeting

```text
QR
 ↓
Meeting
 ↓
CRM
```

### Parent pays registration fee

```text
Payment
 ↓
Conversion
 ↓
Revenue attribution
```

### AI reports

> “The Main Gate QR generated 61% of registrations, but the Reception QR converted 2.4× better. Move the primary CTA closer to Reception traffic.”

That is the end-state product vision.

---

# 112. Final Target State

The completed SmartSapp QR Platform 2.0 should provide this unified lifecycle:

```text
                    SMARTSAPP QR PLATFORM
                              │
             ┌────────────────┼────────────────┐
             │                │                │
           CREATE           DESIGN         DISTRIBUTE
             │                │                │
             └────────────────┼────────────────┘
                              │
                         QR EXPERIENCE
                              │
                         ┌────┴────┐
                         │         │
                       SCAN      ROUTE
                         │         │
                         └────┬────┘
                              │
                           SESSION
                              │
                           VISITOR
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 ANONYMOUS           KNOWN
                    │                   │
                    └─────────┬─────────┘
                              │
                           CRM
                              │
                  ┌───────────┼───────────┐
                  │           │           │
                 LEAD       MEETING     PAYMENT
                  │           │           │
                  └───────────┼───────────┘
                              │
                         CONVERSION
                              │
                           REVENUE
                              │
                 ┌────────────┴────────────┐
                 │                         │
             AUTOMATION                   AI
                 │                         │
             JOURNEYS                 INSIGHTS
                 │                         │
                 └────────────┬────────────┘
                              │
                         OPTIMIZATION
```

## The strategic outcome

SmartSapp should no longer describe QR as:

> **“a tool for generating QR codes.”**

It should be positioned internally as:

> **SmartSapp QR is the physical-to-digital engagement infrastructure of the SmartSapp ecosystem.**

That distinction should drive the engineering, UX, data model, API, CRM, analytics, AI and billing decisions throughout the upgrade.

The current implementation gives SmartSapp a credible foundation—particularly the workspace isolation, dynamic redirect architecture, telemetry, designer, poster studio, scannability engine and cross-module integrations.  The 2.0 program should preserve those investments while adding the missing **destination, campaign, distribution, placement, identity, conversion, attribution, automation, AI and enterprise layers**.

The result is not merely a better QR generator. It becomes a **full SmartSapp QR management and intelligence platform that can participate in virtually every major customer journey across the application.**
