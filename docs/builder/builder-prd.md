# SmartSapp AI Experience Builder

## Full Architectural Product Requirements Document (PRD)

**Document Type:** Product Requirements + Technical Architecture
**Product:** SmartSapp CRM
**Module:** AI Experience Builder / Page Builder
**Status:** Proposed Architecture
**Version:** 1.0
**Date:** 24 August 2026

---

# 1. Executive Summary

SmartSapp currently has a substantial visual page-building foundation: a structured `CampaignPage` model, a hierarchical page tree, 28 reusable block types, personalization rules, automation triggers, AI-assisted page generation, reusable templates, merge variables, version history, and page-level analytics.  

The next evolution should not be another conventional website builder.

The product should become an **AI-powered CRM Experience Builder** capable of creating, personalizing, testing, measuring, and continuously optimizing digital experiences based on CRM data and real visitor behavior.

### Product thesis

> **SmartSapp should allow a marketer to define a business goal, have AI generate the required experience and CRM connections, manually refine everything, launch experiments, understand conversion behavior, and continuously improve the experience using AI.**

The architectural shift is therefore:

```text
Current
Page Builder + AI

            ↓

Target
CRM
  +
Experience Builder
  +
AI Agent
  +
Personalization Engine
  +
Experimentation Engine
  +
Analytics & Attribution
  +
Optimization Engine
  +
Automation
```

The page is no longer an isolated web artifact.

It becomes an active component of the CRM, marketing funnel, sales process, and optimization loop.

---

# 2. Product Vision

## 2.1 Vision Statement

Build the intelligent experience layer of SmartSapp's CRM that enables businesses to **create, personalize, connect, test, and optimize customer-facing digital experiences without requiring engineering resources.**

## 2.2 Product Promise

A user should be able to say:

> "Create a landing page for school owners struggling with late fee payments."

and SmartSapp should be capable of:

1. Understanding the campaign objective.
2. Understanding the relevant CRM audience.
3. Understanding the brand.
4. Generating the page.
5. Creating the required lead-capture mechanism.
6. Connecting submissions to the CRM.
7. Creating follow-up automation.
8. Installing conversion tracking.
9. Creating experiment opportunities.
10. Monitoring performance.
11. Identifying optimization opportunities.
12. Proposing or applying improvements.

The user remains in control throughout the workflow.

---

# 3. Product Positioning

The module should not primarily be positioned internally as:

**Website Builder**

or:

**Landing Page Builder**

The strategic category should be:

## **AI Experience Builder**

Because the system manages:

* page creation,
* visitor experience,
* CRM context,
* personalization,
* experimentation,
* conversion goals,
* automation,
* analytics,
* optimization.

---

# 4. Current-State Foundation

The existing architecture provides several foundations that should be retained.

## 4.1 Existing Page Model

`CampaignPage` currently supports:

* multi-tenant ownership,
* page name and slug,
* draft/published/archived lifecycle,
* page goals,
* page type,
* SEO configuration,
* header/footer settings,
* custom head/body injection,
* automation triggers,
* theme overrides,
* performance counters. 

## 4.2 Existing Version System

`CampaignPageVersion` maintains page structure snapshots, theme snapshots, authorship, and a 50-step local undo/redo stack alongside persistent version history. 

## 4.3 Existing Structured Page Tree

The page structure consists of:

```typescript
CampaignPageStructure
  ├── sections
  ├── header
  └── footer

PageSection
  ├── props
  └── blocks[]

PageBlock
  ├── type
  ├── props
  └── nested blocks[]
```



This should remain the foundation of the renderer.

## 4.4 Existing Block Library

The builder already contains 28 functional blocks including:

* hero,
* video,
* forms,
* surveys,
* meetings,
* testimonials,
* FAQ,
* columns,
* containers,
* media,
* QR,
* countdown,
* payment methods,
* custom HTML,
* and other layout primitives. 

## 4.5 Existing Personalization

Sections already support device and CRM/tag-based visibility rules and field comparisons. 

## 4.6 Existing AI Layer

The current AI Copilot uses Gemini-based infrastructure to generate pages/sections, modify themes, produce niche-specific copy, and accept attachments. 

## 4.7 Existing CRM Variables

Dynamic values are centralized through `FieldsVariablesService`, with merge tags such as:

```text
{{contact.first_name}}
{{contact.email}}
{{workspace.name}}
```



## 4.8 Existing Analytics

The page analytics system already captures:

* views,
* unique visitors,
* CTA clicks,
* conversions,
* video starts,
* 50% video milestone,
* completions,
* form submissions,
* form abandonments,
* meetings,
* survey starts/completions. 

The existing analytics dashboard already contains KPI cards, conversion gauges, video engagement, interactive funnel metrics, and captured-lead reporting. 

---

# 5. Problem Statement

The current system is capable of creating and measuring pages, but several capabilities are fragmented or insufficiently interconnected.

The core problems are:

### Problem 1 — AI is primarily generative

AI can create or modify content, but it is not yet a deeply context-aware application agent.

### Problem 2 — CRM data is underutilized

CRM variables and tags are available, but the page experience does not fully understand contact lifecycle, campaign history, behavior, pipeline, lead score, or attribution.

### Problem 3 — Personalization is too rule-centric

The existing model focuses primarily on section visibility conditions rather than a reusable audience/experience architecture.

### Problem 4 — Analytics are descriptive rather than prescriptive

The system records events but needs a reasoning layer that explains **why** performance is occurring and what should change.

### Problem 5 — Versioning does not equal experimentation

Historical snapshots are useful for rollback but do not constitute a controlled experimentation system.

### Problem 6 — Page and automation creation are disconnected

The system should eventually allow AI to create the page and the associated CRM workflow as a single campaign operation.

### Problem 7 — No closed optimization loop

The target product should create the experience, observe results, identify opportunities, generate a change, test it, and learn from the result.

---

# 6. Strategic Objectives

## Objective A — Make AI the intelligent operating layer

AI should understand:

* page context,
* campaign,
* audience,
* CRM,
* brand,
* analytics,
* experiments,
* conversion goals.

## Objective B — Preserve manual control

AI must augment the user, not remove design control.

Every AI modification must be reviewable and reversible.

## Objective C — Make the builder CRM-native

Page interactions should be able to affect CRM state, while CRM state should be able to affect page experience.

## Objective D — Make personalization reusable

Build a shared audience and experience engine rather than embedding increasingly complex conditions inside individual sections.

## Objective E — Introduce experimentation

Allow A/B and subsequent multivariate experimentation.

## Objective F — Build closed-loop optimization

Analytics → intelligence → recommendation → experiment → result → optimization.

## Objective G — Create an extensible architecture

New blocks, AI capabilities, analytics events, and experience rules should be introduced without creating tightly coupled application logic.

---

# 7. Target User Personas

## 7.1 Marketing Manager

Needs to:

* create campaigns quickly,
* test messages,
* understand conversion,
* personalize experiences,
* avoid dependence on developers.

## 7.2 Sales/Business Development User

Needs:

* lead capture,
* qualification,
* booking,
* pipeline integration,
* lead context.

## 7.3 School/Business Administrator

Needs:

* simple page creation,
* templates,
* forms,
* payment options,
* automation.

## 7.4 Designer

Needs:

* granular visual control,
* responsive editing,
* design tokens,
* reusable components,
* pixel-level customization.

## 7.5 Growth/Performance Marketer

Needs:

* experiments,
* attribution,
* conversion goals,
* segmentation,
* AI recommendations,
* optimization.

## 7.6 Administrator

Needs:

* permissions,
* approvals,
* audit logs,
* publishing governance,
* code controls.

---

# 8. Product Principles

## 8.1 AI First, Not AI Only

Every major workflow should have AI assistance, but every important AI action must remain manually controllable.

## 8.2 Structured Data Over Generated Freeform Output

AI should modify validated application structures rather than directly manipulate arbitrary HTML wherever possible.

## 8.3 One Source of Truth

Audiences, CRM fields, design tokens, conversion goals, and events should be centralized.

## 8.4 Explainable AI

The product must tell users:

* what changed,
* why it changed,
* what data informed the recommendation,
* what will happen when applied.

## 8.5 Reversible AI

Every AI operation must be undoable.

## 8.6 Measurement Before Optimization

Do not allow automated optimization on unreliable or insufficient event data.

## 8.7 Experience Over Page

A page is one component of a broader customer experience.

---

# 9. Target User Journey

```text
Campaign Objective
        ↓
Audience Selection
        ↓
AI Campaign Brief
        ↓
AI Experience Generation
        ↓
Manual / AI Editing
        ↓
CRM Connection
        ↓
Personalization
        ↓
Conversion Goal
        ↓
QA
        ↓
Experiment
        ↓
Publish
        ↓
Traffic
        ↓
Analytics
        ↓
AI Insights
        ↓
Optimization Recommendation
        ↓
New Experiment
        ↓
Learning Loop
```

---

# 10. Functional Requirements

# 10.1 Campaign Initialization

The system shall allow users to start with a campaign objective.

### Supported objectives

* Lead generation
* Registration
* Appointment/meeting booking
* Payment
* Product/service promotion
* Information/education
* Assessment/qualification
* Thank-you/confirmation

Existing page goals already provide an initial model for this behavior. 

### Requirement

The campaign wizard shall collect:

```text
Campaign
Objective
Audience
Offer
Primary conversion
Brand
Traffic source
Desired action
```

AI may infer missing fields but must clearly identify assumptions.

---

# 10.2 AI Page Agent

The existing Copilot should evolve into an agent capable of performing structured page operations.

### Required operations

```text
getPage
getSection
getBlock
getCampaign
getAudience
getBrand
getAnalytics
getExperiment
getConversionGoal

addSection
addBlock
deleteBlock
updateBlock
moveBlock
duplicateBlock
updateStyle
updateVisibility

createVariant
createExperiment
createForm
createCTA
createConversionGoal

createWorkflow
createAudience
```

---

# 10.3 AI Context Layer

The AI must receive structured context rather than relying exclusively on the conversational prompt.

### Context

```typescript
PageContext {
  page
  selectedBlock
  selectedSection
  campaign
  audience
  brand
  crmContext
  analytics
  experiments
  conversionGoals
}
```

---

# 10.4 AI Change Set System

Every AI modification shall generate an immutable change set before application.

```typescript
AIChangeSet {
  id
  pageId
  request
  operations[]
  rationale
  beforeSnapshot
  afterSnapshot
  createdBy
  createdAt
  status
}
```

### Operations

```text
replaceText
addBlock
deleteBlock
moveBlock
duplicateBlock
updateStyle
updateVisibility
updateComponent
createVariant
```

### Statuses

```text
proposed
previewed
approved
rejected
applied
reverted
```

---

# 10.5 Visual Builder

The manual builder must support:

* drag/drop,
* resize,
* alignment,
* spacing,
* typography,
* color,
* layout,
* responsive breakpoints,
* section reordering,
* nested components,
* reusable components.

The existing layout controls provide the base for this system. 

---

# 10.6 Design System

Introduce:

```text
DesignSystem
 ├── colors
 ├── typography
 ├── spacing
 ├── radii
 ├── shadows
 ├── containers
 ├── breakpoints
 └── componentStyles
```

Components should use design tokens rather than storing arbitrary styling whenever possible.

---

# 10.7 Component Registry

Every block shall be represented by a standard definition.

```typescript
BlockDefinition {
  type
  version
  schema
  defaults
  renderer
  editor
  responsiveConfig
  analyticsEvents
  accessibilityRules
  aiCapabilities
}
```

This allows engineering teams to add components without modifying unrelated subsystems.

---

# 10.8 Reusable Smart Components

Support reusable components that can be instantiated across pages.

Examples:

* Hero
* Testimonial
* Pricing
* FAQ
* CTA
* Lead Form
* Meeting Scheduler
* Payment
* Social proof
* Logo grid

Master components shall have versioning and controlled propagation.

---

# 10.9 Audience Engine

Introduce reusable audiences independent from specific pages.

```typescript
Audience {
  id
  organizationId
  name
  description
  conditions[]
}
```

### Conditions

```text
CRM field
Tag
Lifecycle stage
Lead score
Pipeline stage
Location
Device
Campaign
UTM
Behavior
Time
```

---

# 10.10 Experience Engine

The Experience Engine determines which page experience a visitor receives.

```typescript
Experience {
  id
  pageId
  audienceId
  conditions[]
  variantId
  priority
  status
}
```

### Example

```text
Audience:
Returning Lead

Experience:
Hero Variant B

Priority:
10
```

---

# 10.11 Personalization

Support personalization using:

### CRM

* contact
* company
* lifecycle stage
* lead score
* tags
* pipeline stage
* owner
* customer status

### Behavioral

* page visits
* CTA clicks
* video watch percentage
* form activity
* assessment progress
* meeting activity

### Acquisition

* source
* medium
* campaign
* referrer
* UTM

### Environment

* device
* browser
* location
* language
* timezone

### Temporal

* day/time
* campaign period
* returning within N days

---

# 10.12 Dynamic Content

Dynamic components should be able to display:

```text
CRM field
Audience-derived content
Campaign-specific content
Conditional CTA
Conditional section
Conditional offer
```

---

# 10.13 CRM Actions

Page events shall be capable of triggering:

```text
Create contact
Update contact
Apply tag
Remove tag
Update field
Adjust lead score
Create opportunity
Move pipeline stage
Assign owner
Trigger workflow
Send notification
```

---

# 10.14 Forms

Forms shall support:

* contact resolution,
* field validation,
* consent,
* progressive profiling,
* CRM mapping,
* lead scoring,
* tagging,
* pipeline creation,
* automation,
* conversion tracking,
* abandonment tracking.

The existing form block already supports workspace form embedding, tag assignment, and lead creation and should be expanded rather than replaced. 

---

# 10.15 Conversion Goals

Introduce a dedicated `ConversionGoal`.

```typescript
ConversionGoal {
  id
  pageId
  name
  type
  event
  value?
  attributionWindow
}
```

### Goal types

```text
Lead
Form submission
Meeting booked
Payment
Assessment completion
CTA click
Revenue
Custom event
```

Multiple goals may exist, but one primary goal must be designated per experiment.

---

# 10.16 Experiment Engine

Introduce:

```typescript
Experiment {
  id
  pageId
  name
  hypothesis
  primaryMetric
  secondaryMetrics[]
  audienceId?
  variants[]
  trafficAllocation
  status
  winner?
}
```

### MVP experiment types

* A/B
* page variant
* block variant

### Later

* multivariate
* audience-specific
* AI allocation

---

# 10.17 Experiment Lifecycle

```text
Draft
 ↓
Configured
 ↓
QA
 ↓
Running
 ↓
Sufficient Data
 ↓
Completed
 ↓
Winner Selected
 ↓
Deployed
```

AI must not automatically declare a winner without meeting configured data-confidence criteria.

---

# 10.18 AI Optimization Engine

The optimization engine consumes analytics and produces recommendations.

```typescript
OptimizationRecommendation {
  id
  pageId
  experimentId?
  evidence[]
  issue
  recommendation
  expectedImpact
  confidence
  proposedChanges[]
  status
}
```

### Example

```text
Problem:
Mobile form completion is low.

Evidence:
Form abandonment increases sharply at phone-number field.

Recommendation:
Reduce initial form fields.

Confidence:
High
```

---

# 10.19 Adaptive Traffic

Later-stage functionality should dynamically allocate traffic based on measured performance.

Potential modes:

```text
Fixed A/B
AI-assisted
Adaptive
Auto-winner
```

Adaptive optimization should only be activated after the underlying event and experiment systems meet data-quality requirements.

---

# 10.20 Analytics Event Architecture

Introduce one canonical event structure.

```typescript
PageEvent {
  id
  visitorId
  sessionId
  contactId?
  pageId
  experimentId?
  variantId?
  eventType
  timestamp
  properties
  attribution
}
```

### Core events

```text
page_view
cta_click
form_start
form_field_complete
form_submit
form_abandon
video_start
video_50
video_complete
survey_start
survey_complete
meeting_start
meeting_booked
payment_start
payment_complete
```

Current analytics already cover many of these behaviors. 

---

# 10.21 Attribution

Track the journey:

```text
Traffic Source
 ↓
Campaign
 ↓
Visitor
 ↓
Session
 ↓
Page
 ↓
Interaction
 ↓
Lead
 ↓
Opportunity
 ↓
Customer
 ↓
Revenue
```

At minimum:

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
referrer
landing_page
first_touch
last_touch
```

---

# 10.22 AI Analytics

Analytics should have three layers:

### Layer 1 — Measurement

What happened?

### Layer 2 — Diagnosis

Why did it happen?

### Layer 3 — Recommendation

What should we change?

Example:

```text
Measurement:
Conversion = 3.2%

Diagnosis:
Mobile visitors abandon the form at step 2.

Recommendation:
Shorten the mobile form.

Action:
[Create Experiment]
```

---

# 10.23 AI Brand Brain

Introduce:

```typescript
BrandProfile {
  brandName
  positioning
  voice
  targetAudience
  approvedClaims[]
  prohibitedClaims[]
  products[]
  services[]
  faqs[]
  testimonials[]
  visualIdentity
}
```

AI generation should use the Brand Profile as system context.

---

# 10.24 AI Asset Studio

The asset layer should support:

* AI image generation,
* image resizing,
* background removal,
* alt text generation,
* OG image generation,
* image variation,
* asset tagging.

---

# 10.25 SEO + AEO

Existing SEO metadata should be retained. 

Add:

```text
Structured data
FAQ schema
Organization schema
Product/service schema
Entity metadata
Semantic content structure
AI crawler accessibility
Question-answer optimization
```

Provide:

**SEO Score**

and

**AEO Score**

within page QA.

---

# 10.26 Accessibility Engine

Automated checks should cover:

* heading hierarchy,
* color contrast,
* alt attributes,
* keyboard navigation,
* form labels,
* focus visibility,
* semantic structure.

AI should be able to propose fixes.

---

# 10.27 Performance Engine

Before publishing, evaluate:

```text
Performance
Mobile
SEO
AEO
Accessibility
Conversion
CRM
```

Example:

```text
PAGE HEALTH

Performance   82
Mobile        94
SEO           91
AEO           77
Accessibility 96
CRM           100
Conversion    84
```

---

# 10.28 Publishing Workflow

The publishing lifecycle shall become:

```text
Draft
 ↓
AI/Manual Build
 ↓
QA
 ↓
Review
 ↓
Approval
 ↓
Publish
 ↓
Monitor
```

Existing draft/published/archived states can be extended into this workflow. 

---

# 10.29 Governance

Support:

* user roles,
* page permissions,
* AI permissions,
* publishing permissions,
* custom code permissions,
* experiment permissions,
* audit logs.

---

# 10.30 Custom Code Security

The existing custom HTML/CSS/JS block provides flexibility but must be isolated behind security boundaries. 

Implement:

* sandboxing,
* CSP,
* allowed domains,
* trusted scripts,
* permissions,
* code audit trail.

---

# 11. High-Level Technical Architecture

```text
┌───────────────────────────────────────────────────────────┐
│                    SMARTSAPP EXPERIENCE UI                │
│                                                           │
│ Builder │ AI Copilot │ Analytics │ Experiments │ Assets  │
└────────────────────────────┬──────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────┐
│                  EXPERIENCE APPLICATION LAYER             │
│                                                           │
│ Page Service │ Component Service │ Experience Service     │
│ Audience      │ Experiment       │ Conversion Goal       │
└────────────────────────────┬──────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌──────────────┐
       │ AI ENGINE  │ │ CRM ENGINE │ │ EVENT ENGINE │
       └────────────┘ └────────────┘ └──────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │ Intelligence     │
                    │ / Optimization   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Analytics / Data │
                    └──────────────────┘
```

---

# 12. Data Architecture

The core entities should become:

```text
Organization
Workspace
Campaign
CampaignPage
CampaignPageVersion

DesignSystem
Component
ComponentVersion

BrandProfile
Asset

Audience
AudienceRule

Experience
ExperienceRule

ConversionGoal

Experiment
ExperimentVariant

PageEvent
AttributionRecord

OptimizationRecommendation
OptimizationRun

AIChangeSet
AIInstruction

Approval
AuditLog
```

---

# 13. Entity Relationships

```text
Organization
    │
    ├── Workspace
    │
    ├── BrandProfile
    │
    ├── DesignSystem
    │
    ├── Audience
    │
    └── Campaign
          │
          └── CampaignPage
                │
                ├── Versions
                ├── Experiences
                ├── Experiments
                ├── Conversion Goals
                ├── Events
                └── Optimization Recommendations
```

---

# 14. AI Architecture

The AI layer should have five major components.

## 14.1 Context Manager

Assembles:

```text
Page
CRM
Campaign
Audience
Brand
Analytics
Experiment
User permissions
```

## 14.2 Planner

Converts natural language into structured operations.

## 14.3 Tool Layer

Executes validated product operations.

## 14.4 Change Set Manager

Maintains preview/approval/reversal.

## 14.5 Intelligence Layer

Generates:

* recommendations,
* explanations,
* experiment hypotheses,
* optimization suggestions.

---

# 15. AI Safety Model

AI actions should have permission levels.

### Level 1 — Suggest

AI can recommend.

### Level 2 — Preview

AI can construct changes.

### Level 3 — Apply

User explicitly approves.

### Level 4 — Automate

User authorizes automated optimization.

This prevents AI from unexpectedly altering published experiences.

---

# 16. API / Service Boundaries

Recommended service boundaries:

```text
PageService
ComponentService
DesignSystemService
AudienceService
ExperienceService
ExperimentService
ConversionService
AnalyticsService
AttributionService
OptimizationService
AIService
AssetService
ApprovalService
AuditService
```

These should be independently testable even if initially deployed inside the same application.

---

# 17. Rendering Architecture

Public rendering should remain separate from builder editing.

```text
Builder JSON
    ↓
Validated Structure
    ↓
Renderer
    ↓
Experience Resolution
    ↓
Variant Resolution
    ↓
Personalization
    ↓
Public HTML
```

The public renderer should not require the full builder application.

This improves:

* performance,
* reliability,
* security,
* caching,
* scalability.

---

# 18. Page Rendering Decision Pipeline

When a visitor loads a page:

```text
1. Resolve page
2. Resolve visitor/session
3. Resolve CRM identity if available
4. Resolve attribution
5. Resolve audience
6. Resolve experience rules
7. Resolve experiment
8. Resolve variant
9. Apply personalization
10. Render
11. Initialize tracking
12. Register conversion goals
```

---

# 19. Performance Requirements

The system should be designed so that AI functionality does not materially slow public page rendering.

AI should never be required at runtime for basic page rendering.

Bad architecture:

```text
Visitor
 ↓
AI API
 ↓
Page
```

Preferred:

```text
AI
 ↓
Precomputed Experience Configuration
 ↓
Visitor
 ↓
Fast deterministic rendering
```

AI generates decisions/configuration ahead of runtime wherever possible.

---

# 20. Security Requirements

The system shall enforce:

* tenant isolation,
* role-based authorization,
* signed/validated page data,
* sanitized AI output,
* secure custom-code boundaries,
* audit logging,
* API authorization,
* CRM data access controls.

AI context must obey the same organization/workspace permissions as human users.

---

# 21. Observability

Track:

### Application

* builder errors,
* renderer failures,
* API failures,
* AI failures.

### AI

* prompt latency,
* generation latency,
* tool execution,
* rejected changes,
* reverted changes,
* hallucination/schema failures.

### Page

* render time,
* JS failures,
* tracking failures.

### Experiments

* traffic allocation,
* event integrity,
* conversion discrepancies.

---

# 22. Acceptance Criteria

The first major release should satisfy the following.

## AI

* User can generate a page from a campaign objective.
* AI can modify selected blocks.
* AI understands page context.
* AI understands CRM audience context.
* AI produces structured changes.
* User can preview changes.
* User can approve/reject changes.
* All changes are reversible.

## Builder

* All current major blocks continue to function.
* Responsive editing works.
* Design tokens work globally.
* Components can be reused.

## CRM

* Forms create/update CRM records.
* Page events can modify CRM state.
* CRM state can influence page content.

## Personalization

* Audience-based experiences work.
* Rules can combine CRM, behavioral, acquisition and environment data.

## Experimentation

* A/B experiments can be configured.
* Traffic can be distributed by variant.
* Primary conversion goal is tracked.
* Results can be evaluated.
* Winner can be deployed.

## Analytics

* Visitor → lead attribution works.
* Events are normalized.
* Campaign attribution is stored.
* AI insights can be generated from measured data.

## Governance

* Changes are versioned.
* AI changes are auditable.
* Page publishing requires appropriate permissions.

---

# 23. Implementation Roadmap

## Phase 0 — Architecture Preparation

### Deliverables

* canonical event schema
* block registry
* page schema validation
* design token specification
* AI tool specification
* entity model
* permissions model

### Exit criteria

The platform has a stable underlying contract for all subsequent features.

---

# Phase 1 — Builder Foundation

### Deliverables

1. Block registry
2. Block schemas
3. Design system
4. Responsive system
5. Component registry
6. component versioning
7. page schema validation

### Goal

Make the page engine structurally extensible.

---

# Phase 2 — AI Agent

### Deliverables

1. AI Context Manager
2. AI tool layer
3. AI planner
4. structured operations
5. AI change sets
6. diff preview
7. revert capability

### Goal

Transform Copilot into a real page-building agent.

---

# Phase 3 — CRM Experience Engine

### Deliverables

1. Audience model
2. Audience builder
3. Experience model
4. Experience rules
5. CRM context resolver
6. dynamic content
7. CRM actions

### Goal

Make the page genuinely CRM-native.

---

# Phase 4 — Analytics and Attribution

### Deliverables

1. canonical event pipeline
2. visitor identity
3. session identity
4. attribution
5. funnel tracking
6. CRM conversion attribution
7. revenue attribution

### Goal

Connect digital interactions to business outcomes.

---

# Phase 5 — Experimentation

### Deliverables

1. Experiment model
2. Variant model
3. traffic allocation
4. conversion goals
5. experiment analytics
6. winner management
7. experiment history

### Goal

Make optimization scientifically measurable.

---

# Phase 6 — AI Intelligence

### Deliverables

1. AI analytics
2. anomaly detection
3. conversion insights
4. recommendation engine
5. change generation
6. experiment generation

### Goal

Turn data into actionable recommendations.

---

# Phase 7 — Automated Optimization

### Deliverables

1. adaptive traffic
2. AI winner allocation
3. automated experiment creation
4. optimization safeguards
5. confidence thresholds
6. monitoring

### Goal

Create the self-improving experience engine.

---

# Phase 8 — AI Campaign Orchestration

### Deliverables

AI generates:

```text
Page
+
Form
+
Audience
+
Experiment
+
Workflow
+
Tracking
+
Follow-up
```

### Goal

Turn the page builder into a complete campaign-building system.

---

# Phase 9 — Enterprise Layer

### Deliverables

* approval workflows,
* granular permissions,
* collaboration,
* audit logs,
* custom-code governance,
* publishing governance,
* enterprise observability.

---

# 24. Recommended Priority Matrix

| Feature                | Priority | Strategic Value |
| ---------------------- | -------- | --------------- |
| AI Change Sets         | P0       | Critical        |
| AI Context Layer       | P0       | Critical        |
| Block Registry         | P0       | Critical        |
| Event Normalization    | P0       | Critical        |
| Design System          | P0       | High            |
| Audience Engine        | P1       | Critical        |
| Experience Engine      | P1       | Critical        |
| CRM-native actions     | P1       | Critical        |
| Experiment Engine      | P1       | Critical        |
| Attribution            | P1       | Critical        |
| AI Analytics           | P1       | High            |
| Reusable Components    | P1       | High            |
| Brand Brain            | P1       | High            |
| Adaptive Traffic       | P2       | Very High       |
| AI Workflow Generation | P2       | Very High       |
| AI Asset Studio        | P2       | Medium          |
| AEO                    | P2       | High            |
| Accessibility AI       | P2       | High            |
| Enterprise Governance  | P3       | High            |

---

# 25. Success Metrics

The product should not be measured primarily by page creation volume.

## Creation efficiency

* Time to first page
* Time to publish
* AI-generated page acceptance rate
* AI edit acceptance rate
* Manual edits per generated page

## Engagement

* Pages created
* Pages published
* Components reused
* Experiments launched

## Conversion

* Average CVR improvement
* Lead generation
* Meeting bookings
* Payment conversion
* Revenue per visitor

## AI

* AI recommendation acceptance
* AI recommendation impact
* AI change rollback rate
* AI-generated experiment win rate

## Optimization

* Percentage of pages running experiments
* Experiment completion rate
* AI optimization adoption
* Conversion uplift from optimization

## CRM

* Visitor → lead attribution rate
* Lead → opportunity attribution rate
* Opportunity → revenue attribution rate

---

# 26. Product North Star Metric

The strongest north-star metric would be:

## **Incremental Revenue Generated Through SmartSapp Experiences**

rather than:

* pages created,
* visitors,
* AI prompts,
* or blocks inserted.

A secondary product metric should be:

## **Conversion Lift Generated by SmartSapp Optimization**

This directly measures whether the system is improving customer outcomes.

---

# 27. Final Architecture

The final conceptual architecture should be:

```text
                         SMARTSAPP CRM
                              │
               ┌──────────────┴───────────────┐
               │                              │
            CRM DATA                      CAMPAIGNS
               │                              │
               └──────────────┬───────────────┘
                              │
                       AI CONTEXT LAYER
                              │
                              ▼
                        AI PAGE AGENT
                              │
                 ┌────────────┼─────────────┐
                 │            │             │
                 ▼            ▼             ▼
             BUILDER      AUDIENCE       BRAND BRAIN
                 │            │             │
                 └────────────┼─────────────┘
                              ▼
                      EXPERIENCE ENGINE
                              │
                     ┌────────┴────────┐
                     │                 │
                  VARIANTS          RULES
                     │                 │
                     └────────┬────────┘
                              ▼
                       PUBLIC EXPERIENCE
                              │
                              ▼
                        EVENT ENGINE
                              │
                 ┌────────────┼─────────────┐
                 ▼            ▼             ▼
             ANALYTICS    ATTRIBUTION     CRM
                 │
                 ▼
             AI INSIGHTS
                 │
                 ▼
          OPTIMIZATION ENGINE
                 │
          ┌──────┴───────┐
          ▼              ▼
       EXPERIMENT       AI CHANGE
          │              │
          └──────┬───────┘
                 ▼
            NEW EXPERIENCE
                 │
                 └───────────────► CONTINUOUS LEARNING
```

# 28. The Core Product Transformation

The current SmartSapp architecture is already a credible visual page-builder foundation: structured sections and blocks, reusable templates, dynamic variables, triggers, AI generation, and analytics are present.  

The architectural PRD therefore defines an evolution rather than a rebuild:

```text
                CURRENT
                  │
                  ▼
       Visual Page Builder
                  +
            AI Generation
                  +
              Analytics
                  │
                  ▼
              TARGET
                  │
                  ▼
      CRM-NATIVE EXPERIENCE PLATFORM
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
       AI       CRM       EXPERIENCE
        │         │         │
        └─────────┼─────────┘
                  ▼
            EXPERIMENTATION
                  │
                  ▼
             INTELLIGENCE
                  │
                  ▼
             OPTIMIZATION
                  │
                  ▼
         CONTINUOUS LEARNING
```

The defining capability of the upgraded SmartSapp system is therefore not simply **"build a webpage with AI."**

It is:

> **Define a business goal → generate an experience → connect the CRM → personalize it → measure the entire funnel → experiment → let AI identify opportunities → optimize the experience → attribute the business outcome.**

That is the product architecture I would use as the master specification for engineering the next generation of the SmartSapp CRM Page Builder.
