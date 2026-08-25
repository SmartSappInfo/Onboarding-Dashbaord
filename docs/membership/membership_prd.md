Absolutely. I would formalize this as a **new core SmartSapp platform domain**, not as an LMS bolted onto the CRM.

The architecture below is designed around the SmartSapp stack and the existing shared Page Builder, CRM, Contacts, Automations, Tasks, Meetings, Communications, Billing and AI infrastructure. The key principle is:

> **The Experience Platform owns the experience; the CRM remains the system of record for the relationship; shared SmartSapp services remain the system of execution.**

I would also design the learning interoperability layer now so that future LTI 1.3/LTI Advantage, xAPI and Open Badges support does not require a rewrite. LTI 1.3/LTI Advantage is specifically designed for secure integration between learning platforms and external tools, including roster/role provisioning, assignments/grades and deep linking. ([1EdTech][1]) Open Badges 3.0 provides verifiable achievement credentials aligned with the W3C Verifiable Credentials model. ([1EdTech][2])

# SmartSapp Experience Platform

## Target Architecture + Implementation-Grade PRD

---

# Part I — Product Definition

## 1. Product vision

The SmartSapp Experience Platform enables an organization to create a branded digital environment in which visitors, leads, customers, members, students, employees and partners can:

* consume content
* learn
* complete courses
* participate in communities
* complete tasks
* attend events
* interact with instructors
* communicate with staff
* purchase memberships
* access resources
* receive certificates
* interact with AI
* progress through journeys
* become customers
* remain engaged with the organization

The same underlying platform can render as:

**Academy + LMS + Community + Membership + Documentation + Blog + Knowledge Base + Customer Portal + Classroom + Resource Centre + Waiting List + Website**

without creating separate technical products.

---

# 2. Product principles

### P1 — Organization scoped

Every portal and every portal-owned resource belongs to an Organization.

```text
Organization
   ↓
Portal
   ↓
Experience
```

Cross-organization access must be impossible unless explicitly authorized through a controlled integration.

---

### P2 — One content system

Do not create separate page systems for:

* courses
* blogs
* documentation
* membership pages
* websites
* landing pages

The existing SmartSapp Page Builder remains the rendering/editing engine.

---

### P3 — Entitlement-driven access

Never scatter checks like:

```typescript
if (user.isMember)
```

throughout the application.

Instead:

```text
Identity
 ↓
Membership
 ↓
Entitlements
 ↓
Access Policy
 ↓
Resource
```

---

### P4 — Event-driven

Every important interaction becomes an event.

```text
User action
   ↓
Event
   ↓
Event processing
   ├── CRM
   ├── Automation
   ├── Learning
   ├── Analytics
   ├── Notifications
   └── AI
```

---

### P5 — AI is a platform capability

AI isn't a chatbot feature.

AI should understand:

* content
* pages
* courses
* members
* learning progress
* portal configuration
* CRM context
* organization knowledge
* permissions

---

### P6 — Progressive complexity

A school creating a simple public help centre should not see 150 configuration options.

A university creating a certification academy should be able to access them.

---

# Part II — Domain Model

# 3. Bounded contexts

I recommend dividing the domain into these bounded contexts:

```text
┌───────────────────────────────────────────────────────────┐
│                 EXPERIENCE PLATFORM                       │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ Portal       │ Content      │ Learning     │ Community    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Membership   │ Access       │ Events       │ Credentials  │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Affiliate    │ Analytics    │ AI           │ Moderation   │
└──────────────┴──────────────┴──────────────┴──────────────┘
                         │
              ┌──────────┴──────────┐
              │ SmartSapp Platform  │
              ├─────────────────────┤
              │ CRM                 │
              │ Contacts            │
              │ Automations         │
              │ Messaging           │
              │ Billing             │
              │ Meetings            │
              │ Tasks               │
              │ Page Builder        │
              │ Identity            │
              └─────────────────────┘
```

---

# 4. Core entity hierarchy

```text
Organization
│
├── Portal
│   │
│   ├── PortalSettings
│   ├── PortalTheme
│   ├── PortalDomain
│   ├── PortalNavigation
│   ├── PortalBranding
│   ├── PortalAccessPolicy
│   │
│   ├── Spaces
│   │   ├── Community Space
│   │   ├── Course Space
│   │   ├── Resource Space
│   │   ├── Blog Space
│   │   └── Documentation Space
│   │
│   ├── Content
│   │   ├── Page
│   │   ├── Post
│   │   ├── Lesson
│   │   ├── Article
│   │   ├── Resource
│   │   ├── Video
│   │   ├── Audio
│   │   ├── File
│   │   └── Embed
│   │
│   ├── Learning
│   │   ├── Program
│   │   ├── Course
│   │   ├── Module
│   │   ├── Lesson
│   │   ├── Cohort
│   │   ├── Enrollment
│   │   ├── Progress
│   │   ├── Assessment
│   │   ├── Question
│   │   ├── Assignment
│   │   ├── Submission
│   │   ├── Achievement
│   │   ├── Certificate
│   │   └── Badge
│   │
│   ├── Membership
│   │   ├── MembershipPlan
│   │   ├── Subscription
│   │   ├── Entitlement
│   │   ├── AccessGrant
│   │   └── Invitation
│   │
│   ├── Community
│   │   ├── Post
│   │   ├── Comment
│   │   ├── Reaction
│   │   ├── Bookmark
│   │   ├── Follow
│   │   └── ModerationCase
│   │
│   ├── Events
│   │   ├── Event
│   │   ├── Session
│   │   ├── Registration
│   │   └── Attendance
│   │
│   ├── Affiliates
│   │   ├── Affiliate
│   │   ├── Referral
│   │   ├── TrackingLink
│   │   └── Commission
│   │
│   ├── AI
│   │   ├── Agent
│   │   ├── KnowledgeIndex
│   │   ├── Conversation
│   │   ├── Recommendation
│   │   └── GenerationJob
│   │
│   └── Analytics
│       ├── Session
│       ├── LearningRecord
│       ├── EngagementRecord
│       └── ConversionRecord
│
└── CRM relationship references
```

---

# 5. Portal

The Portal is the primary aggregate.

```typescript
Portal {
  id
  organizationId

  name
  slug
  description

  mode[]
  status

  branding
  themeId

  accessPolicyId

  homepageId
  loginPageId
  dashboardPageId

  navigationId

  domainConfig

  features

  onboardingConfig
  membershipConfig
  learningConfig
  communityConfig
  analyticsConfig
  aiConfig

  seoConfig

  createdBy
  createdAt
  updatedAt
  publishedAt
}
```

### Portal modes

```text
ACADEMY
COURSE
MEMBERSHIP
COMMUNITY
CLASSROOM
DOCUMENTATION
KNOWLEDGE_BASE
BLOG
NEWS
RESOURCE_CENTER
CUSTOMER_ACADEMY
CERTIFICATION
COACHING
PRODUCT_TRAINING
INTERNAL_ACADEMY
WAITLIST
CUSTOM
```

Multiple modes are allowed.

---

# 6. Content model

The most important abstraction:

```text
ContentItem
```

with:

```text
type:
  PAGE
  ARTICLE
  LESSON
  POST
  RESOURCE
  VIDEO
  AUDIO
  FILE
  EMBED
  ANNOUNCEMENT
  ASSESSMENT
```

All content can contain:

```text
title
slug
excerpt
body/pageBuilderDocument
media
author
status
visibility
publicationSchedule
accessPolicy
SEO
version
metadata
```

The Page Builder document should remain the canonical representation for visual pages.

---

# 7. Program → Course → Module → Lesson

```text
Program
 ├── Course
 │    ├── Module
 │    │    ├── Lesson
 │    │    ├── Assessment
 │    │    └── Assignment
 │    └── Module
 └── Course
```

A Program is optional.

This lets you have:

### Simple course

```text
Course → Lessons
```

### Professional academy

```text
Program
 ├── Course A
 ├── Course B
 ├── Course C
 └── Certification
```

---

# 8. Learning object

Every learning object should define:

```typescript
LearningObject {
  id
  type

  contentId

  objectives[]
  prerequisites[]

  completionRule
  unlockRule

  estimatedDuration

  assessmentIds[]
  taskIds[]

  availability

  metadata
}
```

---

# 9. Completion rules

Support:

```text
VIEWED
TIME_SPENT
VIDEO_PERCENTAGE
ASSESSMENT_PASSED
ASSIGNMENT_SUBMITTED
ASSIGNMENT_APPROVED
TASK_COMPLETED
ATTENDANCE
MANUAL_APPROVAL
ALL_CHILDREN_COMPLETED
CUSTOM_RULE
```

Composite rules:

```text
ALL
ANY
SEQUENCE
THRESHOLD
CONDITIONAL
```

Example:

```text
ALL(
    video >= 80%,
    quiz >= 70%,
    task.completed
)
```

---

# 10. Release rules

Create a dedicated entity:

```typescript
ReleaseRule {
  id
  resourceId

  triggerType

  conditions[]

  releaseAt

  relativeOffset

  timezone

  recurrence

  priority
}
```

Supported triggers:

```text
ABSOLUTE_DATE
ENROLLMENT_DATE
SUBSCRIPTION_DATE
COURSE_START
COHORT_START
PREVIOUS_COMPLETION
PREVIOUS_MODULE_COMPLETION
EVENT_DATE
PURCHASE_DATE
MEMBERSHIP_AGE
CUSTOM_EVENT
```

---

# 11. Enrollment

```typescript
Enrollment {
  id

  organizationId
  portalId

  contactId
  identityId

  programId?
  courseId?
  cohortId?

  status

  enrolledAt
  startedAt
  completedAt

  progress

  source
  affiliateId?

  metadata
}
```

---

# 12. Progress

Never store only one percentage.

```typescript
ProgressRecord {
  learnerId
  resourceId

  status

  startedAt
  completedAt

  percent

  timeSpent

  attempts

  lastActivityAt

  completionEvidence[]
}
```

Aggregate progress can then be calculated from underlying records.

---

# 13. Membership

```text
MembershipPlan
       ↓
Subscription
       ↓
Entitlements
       ↓
Access
```

Plan:

```typescript
MembershipPlan {
  id
  portalId

  name
  description

  pricing

  billingInterval
  trial

  entitlementIds[]

  visibility

  status
}
```

---

# 14. Entitlement

This is the central access abstraction.

```typescript
Entitlement {
  id

  organizationId
  portalId

  resourceType
  resourceId

  actions[]

  constraints

  startsAt
  expiresAt

  sourceType
  sourceId
}
```

Example:

```text
course:fee-collection-masterclass
actions:
  VIEW
  ENROLL
  COMMENT
  DOWNLOAD
```

---

# 15. Access Grant

```typescript
AccessGrant {
  id

  subjectType
  subjectId

  entitlementId

  grantSource

  grantedBy

  startsAt
  expiresAt

  status

  revokedAt
  revokedBy
}
```

Grant sources:

```text
PURCHASE
MEMBERSHIP
INVITATION
ADMIN
AUTOMATION
COURSE_ENROLLMENT
CRM_SEGMENT
AFFILIATE
SCHOLARSHIP
COUPON
EVENT
ORGANIZATION
```

---

# Part III — State Machines

# 16. Portal state

```text
DRAFT
  ↓
CONFIGURING
  ↓
PUBLISHED
  ↓
SUSPENDED
  ↓
ARCHIVED
```

Rules:

* DRAFT → not externally accessible
* CONFIGURING → preview allowed
* PUBLISHED → public/member traffic allowed
* SUSPENDED → access blocked or restricted
* ARCHIVED → read-only/history

---

# 17. Content state

```text
DRAFT
 ↓
IN_REVIEW
 ↓
SCHEDULED
 ↓
PUBLISHED
 ↓
UNPUBLISHED
 ↓
ARCHIVED
```

Publishing must create an immutable version.

---

# 18. Course state

```text
DRAFT
 ↓
REVIEW
 ↓
PUBLISHED
 ↓
PAUSED
 ↓
ARCHIVED
```

A published course should not be mutated destructively.

Changes create a new course/content version.

---

# 19. Enrollment state

```text
INVITED
 ↓
REGISTERED
 ↓
ENROLLED
 ↓
ACTIVE
 ├── PAUSED
 ├── SUSPENDED
 └── EXPIRED
 ↓
COMPLETED
```

---

# 20. Membership state

```text
PENDING
 ↓
TRIAL
 ↓
ACTIVE
 ├── PAST_DUE
 │     ↓
 │   GRACE
 │     ↓
 │   SUSPENDED
 │
 └── CANCELLED
```

---

# 21. Subscription state

```text
INCOMPLETE
 ↓
ACTIVE
 ↓
PAST_DUE
 ↓
GRACE_PERIOD
 ↓
SUSPENDED
 ↓
CANCELLED
```

Renewal returns:

```text
PAST_DUE → ACTIVE
```

---

# 22. Assignment state

```text
NOT_STARTED
 ↓
IN_PROGRESS
 ↓
SUBMITTED
 ↓
UNDER_REVIEW
 ├── REVISION_REQUIRED
 │       ↓
 │    RESUBMITTED
 │
 └── APPROVED
```

---

# 23. Assessment state

```text
AVAILABLE
 ↓
STARTED
 ↓
SUBMITTED
 ↓
GRADED
 ├── PASSED
 └── FAILED
```

---

# 24. Certificate state

```text
ELIGIBLE
 ↓
ISSUING
 ↓
ISSUED
 ↓
REVOKED
```

---

# 25. Invitation state

```text
CREATED
 ↓
SENT
 ↓
OPENED
 ↓
ACCEPTED
```

Alternative:

```text
SENT → EXPIRED
SENT → REVOKED
```

---

# 26. Event/session state

```text
DRAFT
 ↓
SCHEDULED
 ↓
LIVE
 ↓
ENDED
 ↓
PROCESSING
 ↓
COMPLETED
```

Processing can include:

* recording
* transcript
* summary
* attendance reconciliation
* action item extraction

---

# Part IV — Event Model

# 27. Event architecture

Every event should contain:

```typescript
DomainEvent {
  id
  eventType

  organizationId
  portalId?

  actor
  subject

  entityType
  entityId

  timestamp

  correlationId
  causationId

  source

  payload

  version

  privacyClass
}
```

---

# 28. Portal events

```text
portal.created
portal.updated
portal.published
portal.suspended
portal.archived
portal.domain.connected
portal.domain.verified
```

---

# 29. Identity events

```text
portal.identity.invited
portal.identity.registered
portal.identity.activated
portal.identity.deactivated
portal.identity.deleted
```

---

# 30. Membership events

```text
membership.created
membership.activated
membership.paused
membership.expired
membership.cancelled

subscription.created
subscription.started
subscription.renewed
subscription.payment_failed
subscription.recovered
subscription.cancelled
```

---

# 31. Learning events

```text
course.enrolled
course.started
course.completed

module.started
module.completed

lesson.available
lesson.viewed
lesson.started
lesson.progressed
lesson.completed

assessment.started
assessment.submitted
assessment.passed
assessment.failed

assignment.started
assignment.submitted
assignment.reviewed
assignment.approved
assignment.revision_requested

certificate.eligible
certificate.issued
certificate.revoked

badge.earned
```

---

# 32. Community events

```text
post.created
post.edited
post.deleted

comment.created
comment.edited
comment.deleted

reaction.created
reaction.removed

post.bookmarked
post.shared

member.followed
member.unfollowed

content.reported
moderation.case_created
moderation.case_resolved
```

---

# 33. Engagement events

```text
portal.visited
portal.session_started

content.viewed
content.downloaded

video.started
video.progressed
video.completed

search.performed

resource.opened
```

---

# 34. Event/meeting events

```text
event.created
event.registered
event.cancelled

session.started
session.ended

attendance.joined
attendance.left
attendance.completed

recording.available
transcript.available
summary.generated
```

---

# 35. Affiliate events

```text
affiliate.created
affiliate.link_clicked
affiliate.lead_attributed
affiliate.enrollment_attributed
affiliate.purchase_attributed
affiliate.commission_created
affiliate.commission_approved
affiliate.commission_paid
```

---

# 36. AI events

```text
ai.question_asked
ai.answer_generated
ai.answer_feedback

ai.course_generation_started
ai.course_generation_completed

ai.page_generation_started
ai.page_generation_completed

ai.recommendation_generated
ai.recommendation_accepted

ai.assessment_generated
ai.summary_generated
```

---

# Part V — Entitlement and Access Architecture

# 37. The access decision pipeline

Every protected request follows:

```text
Request
 ↓
Identify Actor
 ↓
Resolve Organization
 ↓
Resolve Portal
 ↓
Resolve Resource
 ↓
Evaluate Public Access
 ↓
Evaluate Identity
 ↓
Evaluate Membership
 ↓
Evaluate Entitlements
 ↓
Evaluate Time Restrictions
 ↓
Evaluate Conditional Rules
 ↓
ALLOW / DENY
```

The frontend must never be trusted to make this decision.

---

# 38. Access policy

```typescript
AccessPolicy {
  id

  visibility

  authenticationRequired

  allowedRoles[]

  requiredEntitlements[]

  conditions[]

  schedule

  geographicRules?

  deviceRules?

  passwordRequired?

  approvalRequired?
}
```

---

# 39. Public content

Public access:

```text
Anonymous
 ↓
Portal
 ↓
Resource
 ↓
ALLOW
```

No member account required.

Useful for:

* blog
* news
* SEO pages
* documentation
* landing pages
* waitlists

---

# 40. Private content

```text
Anonymous
 ↓
Resource
 ↓
Authentication required
 ↓
Login
 ↓
Entitlement check
 ↓
ALLOW
```

---

# 41. Conditional access

Example:

```text
IF
member.plan == PREMIUM
AND
course.enrollment.status == ACTIVE
AND
currentDate >= releaseDate

THEN
ALLOW
```

This rules engine should be reusable by:

* courses
* pages
* resources
* communities
* events
* downloads
* certificates

---

# 42. Security architecture

Never expose entitlement IDs or privileged configuration as the authority.

Server-side authorization must validate:

```text
organizationId
portalId
identityId
resourceId
entitlements
role
status
time
```

Use:

* deny by default
* server-side authorization
* signed session/token claims where appropriate
* short-lived privileged tokens
* audit logging
* rate limiting
* CSRF protection
* XSS sanitization
* upload validation
* MIME verification
* malware scanning
* content-security policy
* secure cookies
* MFA capability
* abuse detection

---

# Part VI — Processing Architecture

# 43. High-level processing architecture

```text
                    CLIENT
                      │
          ┌───────────┴───────────┐
          │                       │
      Portal Web             Admin Studio
          │                       │
          └───────────┬───────────┘
                      │
                 API / Server
                      │
              Authorization
                      │
              Domain Services
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   Content        Learning       Membership
       │              │              │
       └──────────────┼──────────────┘
                      │
                  Event Bus
                      │
       ┌──────────────┼──────────────┐
       │              │              │
      CRM        Automation      Analytics
       │              │              │
       └──────────────┼──────────────┘
                      │
                     AI
```

---

# 44. Recommended technical architecture

Given the existing SmartSapp architecture, retain:

```text
Next.js
React
TypeScript
Firebase
Firestore
Firebase Authentication / Identity layer
Cloud Functions / server-side workers
Cloud Storage
```

But architect the Experience Platform as domain services rather than putting everything directly into React/Firebase calls.

---

# 45. Firestore principle

Do not create one giant:

```text
portals/{portalId}
```

document containing everything.

Use bounded collections.

Conceptually:

```text
organizations/{organizationId}
portals/{portalId}

portals/{portalId}/content/{contentId}
portals/{portalId}/courses/{courseId}
portals/{portalId}/modules/{moduleId}
portals/{portalId}/enrollments/{enrollmentId}
portals/{portalId}/memberships/{membershipId}
portals/{portalId}/entitlements/{entitlementId}
portals/{portalId}/posts/{postId}
portals/{portalId}/events/{eventId}
```

High-volume activity should not be stored as deeply nested operational documents.

---

# 46. High-volume event storage

Separate:

```text
Operational State
```

from:

```text
Event / Analytics Data
```

For example:

```text
Firestore
    ↓
Event Collector
    ↓
Queue
    ↓
Analytics/Event Store
```

This prevents analytics writes from destroying transactional performance.

---

# 47. Event ingestion

The event collector should:

1. authenticate
2. validate schema
3. resolve organization
4. resolve portal
5. rate-limit
6. deduplicate
7. assign event ID
8. persist event
9. enqueue processing
10. acknowledge

```text
Client
 ↓
Event Collector
 ↓
Validation
 ↓
Deduplication
 ↓
Queue
 ↓
Workers
```

---

# 48. Idempotency

Every command/event that can be retried should support:

```text
idempotencyKey
```

Example:

```text
course.enrollment.create
```

must not accidentally create two enrollments because a request was retried.

---

# 49. Background jobs

Use asynchronous processing for:

* video processing
* transcription
* AI generation
* document extraction
* indexing
* certificates
* bulk invitations
* email batches
* analytics aggregation
* course imports
* affiliate reconciliation

---

# 50. Content processing pipeline

```text
Upload
 ↓
Validation
 ↓
Virus/Malware Scan
 ↓
Metadata Extraction
 ↓
Media Processing
 ↓
Transcoding
 ↓
Thumbnail
 ↓
Transcript/OCR
 ↓
Search Index
 ↓
AI Knowledge Index
 ↓
Ready
```

This can reuse patterns from the existing SmartSapp Document/Experience processing architecture.

---

# Part VII — AI Architecture

# 51. AI orchestration layer

```text
                 AI ORCHESTRATOR
                       │
       ┌───────────────┼────────────────┐
       │               │                │
 Content Agent    Learning Agent    Admin Agent
       │               │                │
       ├── Writer      ├── Tutor        ├── Builder
       ├── Editor      ├── Coach        ├── Analyzer
       ├── Generator   ├── Quiz         ├── Optimizer
       └── Translator  └── Recommender  └── Automation
```

---

# 52. AI knowledge hierarchy

The AI should retrieve knowledge in this order:

```text
Current block/page
        ↓
Current lesson
        ↓
Current course
        ↓
Current portal
        ↓
Organization knowledge
        ↓
Authorized external knowledge
```

The narrower context should have priority.

---

# 53. AI permission model

AI must inherit user permissions.

If:

```text
User cannot access Course B
```

then:

```text
AI cannot retrieve Course B
```

This is absolutely critical.

The AI knowledge layer must never become a side channel around authorization.

---

# 54. AI tutor

Context:

```text
Current user
Current portal
Current course
Current lesson
Current progress
Current assessment
Authorized content
```

Capabilities:

* explain
* summarize
* simplify
* translate
* contextualize
* quiz
* generate examples
* generate exercises
* answer questions
* recommend resources
* explain mistakes
* compare concepts

---

# 55. AI course builder

Input:

```text
Create a course for Ghanaian school owners
about improving enrollment.
```

Output:

```text
Course
 ├── Objectives
 ├── Audience
 ├── Prerequisites
 ├── Modules
 ├── Lessons
 ├── Exercises
 ├── Assessments
 ├── Discussion prompts
 ├── Daily tasks
 ├── Completion criteria
 └── Certificate
```

But AI should create a **draft**, never silently publish it.

---

# 56. AI portal builder

The AI should be able to operate the same Page Builder command system used elsewhere in SmartSapp.

For example:

```text
create_page
update_page
duplicate_page
delete_page
add_component
remove_component
configure_component
create_navigation
create_course
create_module
create_lesson
create_assessment
create_release_rule
create_membership_plan
create_onboarding
```

Every tool invocation is:

```text
AI
 ↓
Tool
 ↓
Authorization
 ↓
Validation
 ↓
Preview/Diff
 ↓
Commit
 ↓
Audit Event
```

---

# 57. AI-generated content safety

AI-generated content should have:

```text
DRAFT
AI_GENERATED
HUMAN_REVIEWED
APPROVED
PUBLISHED
```

Metadata should record:

```text
generatedBy
model
prompt/reference
generationId
reviewedBy
approvedAt
```

---

# Part VIII — Integration Architecture

# 58. CRM integration

Portal activity maps to the CRM contact.

```text
Portal Member
      ↕
CRM Contact
```

A contact timeline receives:

```text
Joined portal
Enrolled
Viewed lesson
Completed course
Attended event
Downloaded resource
Posted
Commented
Purchased
Earned certificate
```

---

# 59. Lead scoring

Existing SmartSapp lead scoring should consume portal events.

Example:

```text
Course enrolled       +10
Lesson completed       +2
Assessment passed      +5
Event attended         +8
Community post         +3
Consultation booked   +20
Course completed      +25
```

The values must be configurable.

---

# 60. Automation integration

The Experience Platform becomes another trigger provider for the existing Automation Engine.

Example:

```text
WHEN
course.completed

IF
membership.plan == free

THEN
send email
+
create CRM task
+
add tag
+
invite to premium course
```

---

# 61. Messaging integration

Do not build a second messaging system.

Use existing SmartSapp Communications.

Channels:

```text
Email
SMS
WhatsApp
Push
In-App
```

Portal supplies the event.

Communications supplies the delivery.

---

# 62. Billing integration

Do not create another payment ledger.

Portal membership generates commercial objects through SmartSapp Billing.

```text
Portal
 ↓
Membership Plan
 ↓
Checkout
 ↓
Billing
 ↓
Subscription
 ↓
Entitlements
```

Payment success:

```text
payment.succeeded
 ↓
subscription.activate
 ↓
grant entitlement
 ↓
enroll course
 ↓
trigger onboarding
```

Payment failure:

```text
payment.failed
 ↓
subscription.past_due
 ↓
notification
 ↓
grace period
 ↓
access restriction
```

---

# 63. Meetings integration

The portal should consume the existing SmartSapp Meetings infrastructure.

```text
Course
 ↓
Event
 ↓
Meeting
 ↓
Google Meet / Zoom
```

Attendance flows back into learning progress.

---

# 64. Tasks integration

Learning tasks should use the existing Task domain where possible.

```text
Lesson
 ↓
Task
 ↓
Task completion
 ↓
Learning event
 ↓
Progress
```

This allows CRM users to see:

> “John has an outstanding onboarding task.”

---

# 65. Page Builder integration

This is non-negotiable.

The Experience Platform should not fork the editor.

Use:

```text
PageDocument
ComponentTree
ComponentSchema
Theme
ResponsiveRules
AssetReferences
```

The portal renderer adds:

```text
PortalContext
MemberContext
CourseContext
LearningContext
```

This enables dynamic components:

* My Progress
* My Courses
* Upcoming Sessions
* Membership Status
* Recommended Lessons
* AI Tutor
* Community Feed
* Certificates
* Leaderboard

---

# 66. External learning interoperability

Architecture should reserve integration boundaries for:

### LTI 1.3 / LTI Advantage

Use for:

* external learning tools
* external assessment tools
* grade synchronization
* roster provisioning
* deep linking

LTI Advantage includes Assignment and Grade Services, Names and Role Provisioning Services, and Deep Linking. ([1EdTech][3])

### xAPI

Use the internal learning event architecture so that an xAPI adapter can later expose standardized learning statements.

### Open Badges 3.0

Certificates/achievements should have an internal achievement model capable of producing OpenBadgeCredentials later. Open Badges 3.0 is currently a final standard and its implementation guidance was updated as recently as June 2026. ([1EdTech Standards][4])

---

# Part IX — Full PRD

# 67. PRD metadata

**Product:** SmartSapp Experience Platform
**Domain:** Experience / Learning / Membership
**Platform:** SmartSapp
**Primary stack:** Next.js, TypeScript, Firebase/Firestore
**Architecture:** Multi-tenant, organization-scoped, event-driven
**Primary users:** Organizations, administrators, instructors, staff, members, learners, visitors

---

# 68. Personas

## Portal Owner

Creates and monetizes experiences.

Needs:

* simple setup
* analytics
* billing
* AI creation
* member management

## Portal Administrator

Manages:

* content
* members
* access
* automation
* moderation

## Instructor

Manages:

* courses
* lessons
* assignments
* assessments
* learners

## Community Manager

Manages:

* discussions
* moderation
* engagement

## Member

Consumes:

* courses
* resources
* community
* events

## Learner

Needs:

* progress
* tasks
* assessments
* feedback
* certificates

## Visitor

Consumes public content and converts to:

* lead
* member
* subscriber
* learner

---

# 69. Core user journeys

## Journey A — Create portal

```text
Create Portal
 ↓
Select Experience
 ↓
AI setup wizard
 ↓
Generate structure
 ↓
Customize branding
 ↓
Review
 ↓
Publish
```

---

## Journey B — Invite member

```text
Admin
 ↓
Invite
 ↓
Invitation
 ↓
Registration
 ↓
Membership created
 ↓
Entitlements granted
 ↓
Onboarding started
```

---

## Journey C — Purchase course

```text
Landing Page
 ↓
Checkout
 ↓
Payment
 ↓
Subscription
 ↓
Entitlement
 ↓
Enrollment
 ↓
Welcome
 ↓
Course
```

---

## Journey D — Complete course

```text
Lesson
 ↓
Task
 ↓
Assessment
 ↓
Completion
 ↓
Certificate eligibility
 ↓
Certificate
 ↓
CRM event
 ↓
Automation
```

---

## Journey E — Community engagement

```text
Member
 ↓
Post
 ↓
Comments
 ↓
AI assistance
 ↓
Engagement score
 ↓
CRM activity
```

---

# 70. Portal creation requirements

The system MUST allow an administrator to:

* create a portal
* select one or more modes
* configure branding
* configure domain
* choose access model
* create navigation
* create pages
* configure onboarding
* configure memberships
* configure courses
* configure community
* configure AI
* publish

---

# 71. AI portal creation requirements

AI SHOULD be able to generate:

* portal structure
* navigation
* pages
* courses
* modules
* lessons
* assessments
* onboarding
* tasks
* community spaces
* membership plans
* release schedules

All AI changes MUST support preview and approval.

---

# 72. Page requirements

Pages MUST support:

* Page Builder
* responsive rendering
* SEO
* versioning
* scheduling
* access control
* comments where enabled
* AI assistance
* analytics
* related content

---

# 73. Course requirements

Courses MUST support:

* modules
* lessons
* assessments
* assignments
* tasks
* prerequisites
* release rules
* completion rules
* progress
* cohorts
* instructors
* certificates
* discussion
* AI tutor

---

# 74. Membership requirements

Memberships MUST support:

* free plans
* paid plans
* subscriptions
* trials
* one-time purchases
* recurring billing
* expiration
* access grants
* invitations
* roles
* entitlements
* automated onboarding

---

# 75. Community requirements

Community MUST support:

* spaces
* posts
* comments
* reactions
* replies
* mentions
* moderation
* notifications
* search
* member profiles
* bookmarks
* reporting
* AI assistance

---

# 76. Onboarding requirements

Each portal MUST have independent onboarding configuration.

Support:

```text
welcome page
profile completion
required content
required tasks
required assessment
community introduction
event registration
meeting booking
completion criteria
```

Onboarding can be:

```text
immediate
date-based
relative
conditional
AI-adaptive
```

---

# 77. Daily task requirements

Tasks MUST support:

* title
* description
* due date
* relative due date
* checklist
* attachment
* submission
* approval
* completion criteria
* reminders
* CRM activity
* automation trigger

---

# 78. Scheduling requirements

Administrators MUST be able to release content:

* at specific dates
* at specific times
* relative to enrollment
* relative to subscription
* relative to course start
* relative to cohort start
* after completion
* after assessment
* after task
* conditionally

Timezone handling must be explicit.

---

# 79. AI tutor requirements

The tutor MUST:

* respect access permissions
* understand page context
* retrieve authorized content
* provide grounded answers
* identify uncertainty
* explain
* summarize
* quiz
* recommend
* generate exercises

The system SHOULD show the content sources used by the AI when appropriate.

---

# 80. AI administrator requirements

Admin AI MUST be able to:

* create portal
* modify portal
* create content
* update content
* create courses
* modify courses
* create assessments
* create release rules
* configure onboarding
* create membership plans
* analyze portal performance

All mutating operations require:

```text
authorization
+
validation
+
audit
```

---

# 81. Search

Global portal search should index:

* pages
* articles
* courses
* lessons
* resources
* posts
* comments
* files
* transcripts

Respect entitlement filtering at query time.

---

# 82. Recommendations

Recommendation engine should eventually consider:

```text
current course
current lesson
previous activity
completion
assessment results
interests
membership
role
cohort
community activity
```

Output:

> Recommended next lesson

> Recommended resource

> Recommended discussion

> Recommended event

> Recommended course

---

# 83. Notifications

Notification engine must consume events rather than being directly embedded inside each feature.

Example:

```text
lesson.available
 ↓
Notification Rule
 ↓
Communication Template
 ↓
Email/SMS/WhatsApp/In-App
```

---

# 84. Affiliate requirements

Affiliate system must support:

* affiliate registration
* approval
* tracking links
* referral attribution
* cookie/session attribution
* CRM attribution
* purchase attribution
* commission rules
* commission approval
* payouts
* affiliate dashboard

---

# 85. Analytics requirements

Track:

### Acquisition

* visitors
* sources
* affiliates
* conversions

### Engagement

* sessions
* active users
* posts
* comments
* resource usage

### Learning

* starts
* completion
* progress
* drop-off
* assessments
* time spent

### Revenue

* purchases
* subscriptions
* MRR
* churn
* affiliate revenue

---

# 86. AI analytics

AI should generate insights such as:

```text
"Lesson 4 has a 42% completion drop."

"Members who attend the live session are 2.1x more likely to complete the course."

"Users who join the community during onboarding have higher retention."

"The assessment question about cash-flow forecasting has the highest failure rate."
```

These should be derived from actual analytics, not invented narratives.

---

# 87. Moderation

AI moderation pipeline:

```text
User Content
 ↓
Pre-moderation
 ↓
Risk classification
 ↓
Publish / Hold
 ↓
Human review if necessary
 ↓
Audit
```

Categories:

* spam
* harassment
* hate
* sexual content
* threats
* scams
* malicious links
* policy violations

---

# 88. Multi-tenancy

Every resource MUST carry organization scope either directly or through a validated parent.

Authorization must enforce:

```text
request.organizationId
==
resource.organizationId
```

Portal access additionally requires:

```text
resource.portalId
==
activePortal.id
```

Cross-organization reads must be explicitly authorized.

---

# 89. Organization hierarchy

Support:

```text
Organization
 ├── Portal A
 ├── Portal B
 └── Portal C
```

Eventually:

```text
Parent Organization
 ├── Organization A
 ├── Organization B
 └── Organization C
```

This is useful for franchises, school groups and enterprise structures.

---

# 90. RBAC + ABAC

RBAC alone isn't sufficient.

Use:

### RBAC

```text
Instructor
Moderator
Administrator
Member
```

plus:

### ABAC

```text
organization
portal
resource
membership
course
cohort
time
ownership
entitlement
```

Therefore:

> Instructor can edit courses they own in Portal A but cannot modify Portal B.

---

# 91. Audit architecture

Record:

```text
who
did what
to what
when
from where
using what mechanism
before
after
```

Especially for:

* access changes
* billing
* certificates
* content publishing
* AI changes
* membership changes
* moderation
* administrator changes

---

# 92. API architecture

Use domain-oriented APIs rather than generic CRUD everywhere.

Examples:

```text
POST /api/portals
POST /api/portals/{id}/publish

POST /api/courses/{id}/enroll
POST /api/courses/{id}/publish

POST /api/lessons/{id}/complete

POST /api/memberships/{id}/grant

POST /api/invitations

POST /api/events

POST /api/ai/portal-builder
POST /api/ai/tutor
POST /api/ai/course-builder
```

Commands should represent business operations.

---

# 93. API security

Every protected API request:

```text
Authentication
 ↓
Organization resolution
 ↓
Portal resolution
 ↓
Permission check
 ↓
Entitlement check
 ↓
Validation
 ↓
Command
```

Never:

```text
client → Firestore direct write
```

for sensitive domain operations.

---

# 94. Performance requirements

Target:

### Public page

**<2 seconds perceived load** under normal conditions.

### Authenticated dashboard

**<2 seconds initial application response** under normal conditions.

### Access decision

Target:

**<100 ms server-side** excluding network latency for normal cached decisions.

### Search

Target:

**<500 ms** for normal queries.

### AI

Streaming responses should begin as quickly as model/provider latency permits.

---

# 95. Reliability

Critical operations need:

* retries
* idempotency
* dead-letter queues
* structured logs
* tracing
* alerting
* circuit breakers where appropriate
* graceful degradation

For example:

If AI is unavailable:

> Portal still works.

If analytics is unavailable:

> Learning still works.

If notifications fail:

> Enrollment still succeeds.

The Experience Platform should never make non-critical services a hard dependency for core transactions.

---

# 96. Data consistency

Use strong transactional consistency for:

* entitlement grants
* subscription state
* enrollment
* certificate issuance
* assessment grading

Use eventual consistency for:

* analytics
* recommendations
* search indexing
* AI indexing
* engagement counters

---

# 97. Content versioning

Every publish creates:

```text
Content
 ├── Version 1
 ├── Version 2
 └── Version 3
```

Published versions are immutable.

This is particularly important for:

* documentation
* regulated training
* certification
* customer education

---

# 98. Course versioning

A course should have:

```text
Course
 ├── Version 1
 └── Version 2
```

Existing learners should not unexpectedly lose their learning history when curriculum changes.

---

# 99. GDPR/privacy-style architecture

Even though SmartSapp is Ghana-focused, design to strong international privacy principles.

Support:

* consent
* data minimization
* export
* deletion
* retention policies
* access logs
* private learner records
* configurable analytics collection

Especially important for educational users.

---

# 100. Accessibility

Target:

**WCAG 2.2 AA**

including:

* keyboard navigation
* semantic HTML
* focus states
* captions
* transcripts
* screen-reader support
* contrast
* accessible forms
* accessible assessments
* reduced motion

---

# Part X — Firestore Domain Layout

A practical starting model:

```text
organizations/{orgId}

portals/{portalId}

portals/{portalId}/settings/{doc}

portals/{portalId}/domains/{domainId}

portals/{portalId}/navigation/{navId}

portals/{portalId}/content/{contentId}

portals/{portalId}/contentVersions/{versionId}

portals/{portalId}/programs/{programId}

portals/{portalId}/courses/{courseId}

portals/{portalId}/modules/{moduleId}

portals/{portalId}/lessons/{lessonId}

portals/{portalId}/cohorts/{cohortId}

portals/{portalId}/enrollments/{enrollmentId}

portals/{portalId}/progress/{progressId}

portals/{portalId}/assessments/{assessmentId}

portals/{portalId}/submissions/{submissionId}

portals/{portalId}/membershipPlans/{planId}

portals/{portalId}/subscriptions/{subscriptionId}

portals/{portalId}/entitlements/{entitlementId}

portals/{portalId}/accessGrants/{grantId}

portals/{portalId}/invitations/{invitationId}

portals/{portalId}/spaces/{spaceId}

portals/{portalId}/posts/{postId}

portals/{portalId}/comments/{commentId}

portals/{portalId}/events/{eventId}

portals/{portalId}/attendance/{attendanceId}

portals/{portalId}/affiliates/{affiliateId}

portals/{portalId}/commissions/{commissionId}

portals/{portalId}/aiConversations/{conversationId}
```

High-volume events should be streamed into an event/analytics subsystem rather than becoming massive Firestore collections.

---

# Part XI — Processing Pipelines

## 101. Enrollment pipeline

```text
Enrollment Command
       ↓
Validate
       ↓
Resolve Contact
       ↓
Create Enrollment
       ↓
Grant Entitlements
       ↓
Create Onboarding State
       ↓
Emit course.enrolled
       ↓
Automation
       ↓
Notifications
       ↓
CRM Timeline
```

---

# 102. Purchase pipeline

```text
Checkout
 ↓
Billing
 ↓
Payment
 ↓
Subscription
 ↓
Entitlement Grant
 ↓
Enrollment
 ↓
Onboarding
```

---

# 103. Content release pipeline

```text
Scheduler
 ↓
Evaluate Release Rules
 ↓
Find Eligible Learners
 ↓
Create Availability
 ↓
Emit lesson.available
 ↓
Notification
```

Do not repeatedly query every learner every minute.

Use scheduled jobs and indexed eligibility conditions.

---

# 104. Completion pipeline

```text
Activity
 ↓
Progress Processor
 ↓
Evaluate Completion Rule
 ↓
Complete Resource
 ↓
Evaluate Parent
 ↓
Evaluate Unlock Rules
 ↓
Grant Availability
 ↓
Emit Events
 ↓
Automation
```

---

# 105. AI indexing pipeline

```text
Content Published
 ↓
Extract
 ↓
Normalize
 ↓
Chunk
 ↓
Embed
 ↓
Index
 ↓
Attach ACL Metadata
 ↓
Knowledge Ready
```

Every chunk needs authorization metadata.

For example:

```text
organizationId
portalId
resourceId
requiredEntitlements
visibility
```

This prevents unauthorized retrieval.

---

# Part XII — Admin UX

The administrator's main navigation should be approximately:

```text
Experience
│
├── Overview
├── Portal Builder
├── Content
├── Courses
├── Members
├── Community
├── Events
├── Memberships
├── Affiliates
├── Onboarding
├── Automations
├── AI
├── Analytics
└── Settings
```

---

# 106. Portal Builder

The builder should show:

```text
Pages
Navigation
Theme
Header
Footer
Domains
Access
SEO
```

using the existing Page Builder.

---

# 107. Course Builder

```text
Course
│
├── Overview
├── Curriculum
├── Content
├── Assessments
├── Assignments
├── Tasks
├── Cohorts
├── Access
├── Release Schedule
├── Certificates
├── Discussions
└── AI
```

---

# 108. Member management

```text
Members
│
├── All Members
├── Active
├── Pending
├── Inactive
├── Invitations
├── Memberships
├── Enrollments
├── Progress
├── Certificates
└── Activity
```

---

# 109. AI control centre

```text
AI
│
├── AI Builder
├── AI Tutor
├── AI Content
├── AI Assessments
├── AI Recommendations
├── AI Analytics
├── Knowledge
├── Conversations
└── AI Settings
```

---

# Part XIII — Member UX

Member dashboard:

```text
Good morning, John

Continue Learning
──────────────────
Fee Collection Masterclass
72% complete
[Continue]

Today's Tasks
──────────────────
□ Review payment process
□ Complete Lesson 6

Upcoming
──────────────────
Live Workshop
Thursday 4:00 PM

Community
──────────────────
3 new replies

Recommended
──────────────────
Advanced Enrollment Strategy
```

The dashboard should dynamically adapt to the portal mode.

---

# 110. Adaptive portal navigation

For a documentation portal:

```text
Documentation
Guides
API
Search
```

For an academy:

```text
Dashboard
My Courses
Learning Paths
Community
Events
Certificates
```

For a membership:

```text
Home
Community
Resources
Events
Members
Account
```

Same platform. Different experience configuration.

---

# Part XIV — MVP Scope

I would **not** attempt the complete architecture in the first release.

The first production release should contain:

### Foundation

* Portal
* Organization scoping
* custom branding
* domains
* public/private access
* identity
* invitations
* roles
* entitlements

### Content

* Page Builder
* pages
* articles
* resources
* video
* files
* search

### Learning

* courses
* modules
* lessons
* enrollment
* progress
* release scheduling
* tasks
* basic assessments

### Membership

* plans
* subscriptions
* billing integration
* access grants

### Community

* spaces
* posts
* comments
* reactions
* moderation

### CRM

* contact linkage
* timeline
* lead scoring
* automation triggers

### AI

* AI portal builder
* AI course builder
* page AI
* contextual AI tutor

---

# Part XV — Phase 2

Add:

* cohorts
* assignments
* grading
* certificates
* live classes
* Zoom/Meet
* advanced onboarding
* affiliate engine
* advanced analytics
* gamification
* recommendations

---

# Part XVI — Phase 3

Add:

* adaptive learning
* AI instructional analytics
* AI community moderation
* AI course optimization
* competency framework
* advanced credentials
* Open Badges 3.0
* xAPI export
* LTI 1.3/LTI Advantage
* enterprise SSO

Open Badges 3.0 is particularly appropriate for the eventual credential layer because its credentials can contain achievement metadata, evidence and issuer/earner information and are cryptographically verifiable. ([1EdTech][2])

---

# Part XVII — Definition of Done

The Experience Platform should not be considered production-grade until:

### Architecture

* [ ] All data is organization scoped
* [ ] All authorization is server-side
* [ ] Entitlements are centralized
* [ ] Events are versioned
* [ ] Commands are idempotent
* [ ] Async processing has retries
* [ ] Audit logging exists

### Content

* [ ] Page Builder reused
* [ ] Content versioning
* [ ] Scheduling
* [ ] Search
* [ ] SEO
* [ ] Media processing

### Learning

* [ ] Enrollment
* [ ] Progress
* [ ] Completion
* [ ] Assessments
* [ ] Tasks
* [ ] Release rules
* [ ] Cohorts
* [ ] Certificates

### Membership

* [ ] Plans
* [ ] Billing
* [ ] Entitlements
* [ ] Access grants
* [ ] Invitations
* [ ] Expiration
* [ ] Cancellation

### Community

* [ ] Posts
* [ ] Comments
* [ ] Reactions
* [ ] Moderation
* [ ] Notifications

### CRM

* [ ] Contact linkage
* [ ] Timeline
* [ ] Lead scoring
* [ ] Automation
* [ ] Messaging

### AI

* [ ] Contextual retrieval
* [ ] Permission-aware retrieval
* [ ] AI builder
* [ ] AI tutor
* [ ] AI content generation
* [ ] Audit trail
* [ ] Human approval for mutations

### Infrastructure

* [ ] Rate limiting
* [ ] Abuse prevention
* [ ] Monitoring
* [ ] Error tracking
* [ ] Queue monitoring
* [ ] Dead-letter handling
* [ ] Backups
* [ ] Disaster recovery
* [ ] Security testing
* [ ] Accessibility testing

---

# Part XVIII — The most important architectural decision

There is one concept I would make foundational to the entire implementation:

## **Experience = Content + Access + Context + Progress + Interaction**

A resource doesn't inherently need to be a:

> “course lesson”

or:

> “blog post”

or:

> “documentation page.”

It is simply a **Content Item**.

Its meaning comes from context.

```text
             CONTENT ITEM
                  │
       ┌──────────┼──────────┐
       │          │          │
     ACCESS    CONTEXT    PROGRESS
       │          │          │
       ↓          ↓          ↓
 Membership     Course      Completion
 Public         Blog        Score
 Role           Docs        Achievement
 Subscription   Classroom   Certification
```

That is what allows the same SmartSapp infrastructure to support all these experiences without creating six different products.

---

# Part XIX — Final system architecture

The target SmartSapp architecture becomes:

```text
                              SMARTSAPP
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
      CRM                    EXPERIENCE                 PLATFORM
       │                       PLATFORM                      │
       │                          │                          │
       │              ┌───────────┼───────────┐              │
       │              │           │           │              │
       │           Content     Learning   Community          │
       │              │           │           │              │
       │              └───────────┼───────────┘              │
       │                          │                          │
       │                    Membership                       │
       │                          │                          │
       │                       Events                         │
       │                          │                          │
       │                      Affiliates                      │
       │                          │                          │
       └──────────────────────────┼──────────────────────────┘
                                  │
                     ┌────────────┼────────────┐
                     │            │            │
                 Automation   Communications  Billing
                     │            │            │
                     └────────────┼────────────┘
                                  │
                           Page Builder
                                  │
                                  │
                                AI
                                  │
                     ┌────────────┼────────────┐
                     │            │            │
                  Builder       Tutor       Analytics
                     │            │            │
                     └────────────┼────────────┘
                                  │
                          Event Architecture
                                  │
                     ┌────────────┼────────────┐
                     │            │            │
                 Analytics       CRM        Learning
```

## Strategic result

This gives SmartSapp something considerably more powerful than an LMS.

A school could create:

**schoolname.com/academy**

and use it for parent training.

A training company could create:

**academy.company.com**

and sell courses.

A software company could create:

**learn.company.com**

and turn it into a customer academy.

A professional organization could create:

**members.organization.com**

and operate a paid membership community.

A university could create:

**learn.university.edu**

and run structured courses and cohorts.

A company could create:

**academy.company.com**

for employee onboarding.

And a business could simply create:

**docs.company.com**

and use exactly the same infrastructure as its documentation centre.

All of those experiences ultimately feed the **same CRM, contact record, automation engine, communication engine, billing engine, task system, meeting system and AI layer**.

That is the architecture I would use as the **source-of-truth specification before implementation begins**. It also leaves the platform structurally ready for LTI interoperability and portable digital credentials rather than having to retrofit those later. ([1EdTech][1])


[1]: https://www.1edtech.org/standards/lti?utm_source=chatgpt.com "Learning Tools Interoperability | 1EdTech"
[2]: https://www.1edtech.org/standards/open-badges?utm_source=chatgpt.com "Open Badges | 1EdTech"
[3]: https://www.1edtech.org/standards/lti/why-adopt-lti-1p3?utm_source=chatgpt.com "Why Platforms and Tools Should Adopt LTI 1.3 | 1EdTech"
[4]: https://standards.1edtech.org/open-badges/guides/standards/v3p0/impl?utm_source=chatgpt.com "Open Badges Implementation Guide"
