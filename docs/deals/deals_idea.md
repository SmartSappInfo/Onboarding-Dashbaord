Yes. I’ve reviewed the extracted Deals & Pipeline specification. The current implementation is a **strong CRM pipeline foundation**, but it is not yet a complete **Deals Management Platform**. The important distinction is that the current system is primarily **pipeline-centric**, while the mature SmartSapp version should be **deal-centric, CRM-aware, revenue-aware, automation-aware, and intelligence-aware**.

The extracted specification already establishes the important foundations: multi-tenancy, Kanban/List views, optimistic updates, stage automation, contact association, bulk operations, RBAC, and currency handling. 

# 1. My assessment of the current Deals module

### Current maturity: ~60–65%

| Area                    |                         Current |             Target |
| ----------------------- | ------------------------------: | -----------------: |
| Pipeline management     |                       🟢 Strong |         Enterprise |
| Kanban/List UX          |                       🟢 Strong |         Enterprise |
| Deal CRUD               |                         🟢 Good |         Enterprise |
| Stage management        |                         🟢 Good |         Enterprise |
| RBAC / tenancy          |                         🟢 Good |         Enterprise |
| Automation              |                   🟡 Foundation |           Advanced |
| Contact/CRM integration |                   🟡 Foundation |               Deep |
| Activity tracking       |                        🟡 Basic |           Complete |
| Revenue management      |                        🟡 Basic |           Advanced |
| Forecasting             |                      🔴 Limited |         Enterprise |
| Products / line items   |                      🔴 Missing |           Required |
| Quotes / proposals      |                      🔴 Missing |           Required |
| Deal participants       |                     🟡 Embedded | Relationship model |
| Stage history           | 🔴 Missing as first-class model |           Required |
| Attribution             |                      🔴 Missing |           Required |
| Lead → Deal conversion  |                      🔴 Missing |           Required |
| AI                      |            🔴 Future ideas only |    Native AI layer |
| Deal health             |                      🔴 Missing |           Required |
| Sales performance       |                      🔴 Missing |           Required |
| Revenue analytics       |                      🟡 Planned |           Advanced |
| Governance / audit      |                        🟡 Basic |         Enterprise |

So I would **not simply add the five AI enhancements listed at the end of the current document**. Those are useful, but they sit on top of a domain model that needs to be expanded first. The current document itself identifies AI probability, summaries, forecasting, dynamic deal variables, and stage gating as future opportunities. 

---

# 2. The biggest architectural issue

The current domain essentially looks like:

```text
Workspace
   │
   ├── Pipeline
   │     └── Stage
   │
   └── Deal
          ├── Entity
          ├── Contacts
          └── Tasks
```

That is good for a basic CRM.

For **SmartSapp Deals 2.0**, I recommend:

```text
                         ORGANIZATION
                              │
                         WORKSPACE
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       PIPELINES           CRM DATA          AUTOMATIONS
          │                   │                   │
       STAGES              Accounts             Rules
          │                Contacts             Actions
          │                Leads                Triggers
          ▼                Activities
        DEALS              Campaigns
          │
    ┌─────┼─────────┬──────────┬───────────┐
    │     │         │          │           │
   Team  Contacts  Products   Activities  Documents
    │     │         │          │           │
    │     │         │       Calls/Emails   Quotes
    │     │         │       Meetings       Contracts
    │     │         │       Tasks          Attachments
    │     │         │
    │     │      Line Items
    │     │
    │   Participants
    │
    └──────────── Revenue / Forecast / Attribution
                         │
                         ▼
                    AI Intelligence
```

This is the fundamental evolution I recommend.

---

# 3. Rename `OnboardingStage`

This is one of the first things I would change.

The current model uses:

```typescript
OnboardingStage
```

for a general deal pipeline stage. That will eventually become confusing because SmartSapp already has an **onboarding domain**.

Use:

```typescript
DealStage
```

instead.

Likewise:

```text
OnboardingStage
```

→

```text
DealStage
```

and:

```text
PipelineActions
```

could eventually become:

```text
PipelineAutomationRules
```

This makes the domain semantically correct.

---

# 4. Pipelines should become configurable business processes

Currently a pipeline has:

* name
* description
* expected close days
* assignment strategy
* ordering

That is a good beginning. 

But a mature pipeline should define an entire **sales process**.

### Target Pipeline

```typescript
Pipeline {
  id
  organizationId
  workspaceId

  name
  description

  objectType
  pipelineType

  currencyPolicy

  defaultProbability
  defaultExpectedCloseDays

  assignmentStrategy

  visibility
  accessPolicy

  stageOrder

  settings

  forecastingSettings

  automationSettings

  createdBy
  createdAt
  updatedAt
}
```

### Pipeline types could include

```text
Sales
Enrollment
Renewal
Upsell
Cross-sell
Partnership
Procurement
Fundraising
Implementation
Customer Success
Custom
```

This is particularly important for SmartSapp because a school CRM may eventually have different revenue processes.

For example:

```text
New School Acquisition
        ↓
Demo
        ↓
Proposal
        ↓
Negotiation
        ↓
Contract
        ↓
Won
```

while:

```text
School Renewal
        ↓
Renewal Identified
        ↓
Engagement
        ↓
Renewal Proposal
        ↓
Negotiation
        ↓
Renewed
```

Both are deals, but they are different processes.

---

# 5. A Deal needs to become much richer

The current `Deal` is currently centered around:

```text
name
value
currency
status
pipeline
stage
owner
contacts
expectedCloseDate
customFields
```



That is insufficient for a full deal-management system.

I recommend something closer to:

```typescript
Deal {
  id

  organizationId
  workspaceId

  pipelineId
  stageId

  accountId
  primaryContactId

  name
  description

  status
  outcome

  ownerId
  teamId

  source
  sourceDetail

  amount
  currency

  probability
  weightedAmount

  expectedCloseDate
  actualCloseDate

  forecastCategory

  priority

  healthScore

  temperature

  nextStep
  nextStepDueAt

  leadId
  campaignId

  createdBy
  createdAt
  updatedAt

  customFields
}
```

---

# 6. Separate `status` from `stage`

This is important.

Currently:

```text
status = open | won | lost
```

while stage describes where the deal is.

That works, but mature CRM systems need a cleaner state model.

### Deal lifecycle

```text
                 ┌──────────────┐
                 │     OPEN     │
                 └──────┬───────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
           ACTIVE     ON HOLD   AT RISK
              │
        ┌─────┴─────┐
        ▼           ▼
      WON          LOST
```

And stage remains independent:

```text
Qualification
     ↓
Discovery
     ↓
Demo
     ↓
Proposal
     ↓
Negotiation
     ↓
Contract
```

A deal can therefore be:

```text
Stage: Negotiation
Status: Open
Health: At Risk
Probability: 62%
Forecast: Commit
```

That's substantially more expressive.

---

# 7. Stage history needs to be a first-class entity

The current system records activity/audit information, but stage history should become its own domain object.

```text
Deal
 │
 ├── Stage History
 │     ├── Qualification → Discovery
 │     ├── Discovery → Demo
 │     ├── Demo → Proposal
 │     └── Proposal → Negotiation
 │
 └── Activities
```

### DealStageHistory

```typescript
DealStageHistory {
  id
  dealId

  fromStageId
  toStageId

  changedBy
  changedAt

  durationInPreviousStage

  reason
  source

  automationTriggered
}
```

This enables:

* stage velocity
* average time per stage
* bottleneck detection
* conversion rates
* rep performance
* AI win probability
* forecast accuracy

Without this, your AI will eventually be forced to infer historical behavior from generic audit logs.

---

# 8. Don't store focal contacts directly inside the Deal

The current model embeds:

```typescript
focalContacts?: DealFocalContact[];
```



I would change this.

Use:

```text
Deal
   │
   └── DealParticipant
```

### DealParticipant

```typescript
DealParticipant {
  id
  dealId
  contactId

  role
  influence
  relationship
  sentiment

  isPrimary
  isDecisionMaker

  createdAt
  updatedAt
}
```

Roles can be configurable:

```text
Decision Maker
Champion
Influencer
Technical Buyer
Economic Buyer
Procurement
End User
Legal
Finance
Parent
Principal
Administrator
Other
```

And users should be able to create their own.

---

# 9. Add Products and Line Items

This is one of the biggest missing capabilities.

A real deals platform shouldn't only say:

> Deal value = GHS 50,000

It should be able to say:

```text
SmartSapp Enterprise
100 students × GHS 89.95
                    = GHS 8,995

SmartSapp Pay
Implementation        = GHS 5,000

Training
                    = GHS 2,500

──────────────────────────
Subtotal             GHS 16,495
Discount             GHS 1,000
Tax                  GHS ...
──────────────────────────
Total                GHS ...
```

### New domain

```text
Product
ProductCategory
PriceBook
PriceBookItem
DealLineItem
Discount
Tax
```

Then:

```text
Deal
 ├── Line Items
 ├── Quote
 ├── Invoice
 └── Contract
```

This will also make Deals naturally connect to the **SmartSapp Finance/Billing architecture** you have been developing.

---

# 10. Deals must become CRM-aware

This is probably the most important part of your requirement.

The Deal should not be an isolated object.

It should be an **aggregation point for CRM activity**.

For example:

```text
School: Galaxy International School

        │
        ├── Contacts
        │
        ├── Lead
        │
        ├── Campaign interactions
        │
        ├── Emails
        │
        ├── WhatsApp
        │
        ├── Calls
        │
        ├── Meetings
        │
        ├── Surveys
        │
        ├── Tasks
        │
        ├── Notes
        │
        └── Deal
              │
              ├── Activities
              ├── Stage History
              ├── Participants
              ├── Products
              ├── Documents
              ├── Quotes
              ├── Forecast
              └── AI Intelligence
```

Then an executive can open a deal and see:

### Deal intelligence timeline

```text
Aug 28
09:42 — Principal opened proposal email
10:15 — Sales executive called principal
11:05 — Meeting booked
14:20 — Proposal viewed
15:10 — WhatsApp response received

AI:
⚠ High engagement detected.
Recommended action:
Schedule commercial follow-up within 48 hours.
```

That is **CRM-aware deal management**.

---

# 11. Activities need a unified model

Instead of every module independently attaching things to deals, introduce a common activity abstraction.

```typescript
Activity {
  id

  organizationId
  workspaceId

  type

  actorId

  subject

  description

  relatedEntityType
  relatedEntityId

  relatedDealId
  relatedContactId
  relatedAccountId

  occurredAt

  duration

  outcome

  metadata
}
```

Types:

```text
EMAIL
SMS
WHATSAPP
CALL
MEETING
TASK
NOTE
FORM_SUBMISSION
SURVEY
PAGE_VIEW
DOCUMENT_VIEW
PROPOSAL_VIEW
PAYMENT
QUOTE
CONTRACT
STAGE_CHANGE
OWNER_CHANGE
```

This gives SmartSapp one unified activity graph.

---

# 12. Lead → Deal conversion

This is essential.

The natural CRM lifecycle should become:

```text
Lead
 │
 │ qualification
 ▼
Qualified Lead
 │
 │ conversion
 ▼
Deal
 │
 ├── Contact
 ├── Account/Entity
 └── Activities
```

But **conversion must preserve history**.

Don't create a new disconnected Deal.

Instead:

```text
Lead
 │
 ├── convertedAt
 ├── convertedBy
 ├── convertedDealId
 └── historical activities
```

Then the deal inherits relevant:

* source
* campaign
* attribution
* contact
* account
* engagement history
* lead score

---

# 13. Deal attribution

This is currently missing and will become extremely valuable for SmartSapp marketing.

A deal should answer:

> **Where did this revenue opportunity come from?**

For example:

```text
Original Source:
Google Search

First Campaign:
Enrollment Growth

First Touch:
Fee Collection Guide

Last Touch:
Webinar

Converted From:
Lead #1234

Campaign:
August School Growth Campaign
```

And eventually:

```text
Marketing Influenced Revenue
Sales Sourced Revenue
Organic Revenue
Referral Revenue
Partner Revenue
```

This connects **Marketing → CRM → Deals → Revenue**.

---

# 14. Deal scoring should become a platform service

The current document proposes an AI win probability score. 

I would separate three concepts:

### 1. Engagement Score

How engaged is the prospect?

```text
0–100
```

### 2. Deal Health

How healthy is the opportunity?

```text
Healthy
At Risk
Stalled
Critical
```

### 3. Win Probability

What is the estimated probability of closing?

```text
0–100%
```

These are not the same thing.

For example:

```text
Engagement:       92
Deal Health:      At Risk
Win Probability:  58%
```

because the prospect may be highly engaged but procurement has stalled.

---

# 15. AI should become an intelligence layer, not a button

The current specification treats AI as several future enhancements.

I recommend an **AI Deal Intelligence Engine**.

### AI capabilities

#### Deal summary

> "The prospect has completed a demo, reviewed the proposal twice and engaged with the commercial team. Procurement has not yet responded."

#### Next best action

> "Follow up with the procurement contact."

#### Win probability

```text
68%
```

#### Deal risk

```text
MEDIUM
```

#### Stagnation detection

> "Deal has remained in Negotiation 2.4× longer than similar won deals."

#### Stakeholder analysis

```text
Champion       → Strong
Decision Maker → Unknown
Procurement    → Weak
Finance        → Unknown
```

#### Sentiment

```text
Positive
```

#### Missing information

> "Expected implementation date has not been captured."

#### Automatic deal briefing

Before a salesperson enters a meeting:

```text
DEAL BRIEF

Galaxy International School

Value: GHS 48,500
Stage: Negotiation
Probability: 71%

Decision Maker:
John Doe

Champion:
Jane Doe

Last interaction:
2 days ago

Primary concern:
Implementation timeline

Recommended objective:
Confirm implementation date and procurement approval.
```

That is where AI becomes genuinely useful.

---

# 16. AI must not silently mutate important CRM state

I would establish an AI action architecture:

```text
AI analyzes
    ↓
AI recommends
    ↓
User approves
    ↓
System executes
    ↓
Audit event recorded
```

For low-risk actions:

```text
Create suggested task
Generate summary
Draft email
Generate meeting brief
```

AI can act automatically if configured.

For high-impact actions:

```text
Change deal value
Change owner
Move stage
Mark won
Mark lost
Send external communication
```

require explicit authorization unless an automation policy permits it.

---

# 17. Forecasting needs its own domain

The current specification already proposes:

```text
value × stage_probability
```

for weighted forecasting. 

We should take that much further.

### Forecast categories

```text
Pipeline
Best Case
Commit
Closed
Omitted
```

### Forecast dimensions

```text
Month
Quarter
Year

Pipeline
Team
Owner
Pipeline
Region
Product
Source
Segment
```

Example:

```text
Q4 FORECAST

Pipeline              GHS 1.8M
Best Case             GHS 1.25M
Commit                GHS 890K
Closed Won            GHS 420K

Forecast Confidence   74%
```

And:

```text
Expected Revenue
=
Σ Deal Amount × Probability × Forecast Adjustment
```

Eventually AI can calibrate probability using historical SmartSapp conversion data rather than relying only on manually assigned stage probabilities.

---

# 18. Add deal velocity analytics

Once stage history exists:

```text
Average Sales Cycle
Average Stage Duration
Stage Conversion Rate
Time to First Contact
Time to Proposal
Time to Close
Win Rate
Loss Rate
Average Deal Size
Revenue per Rep
Pipeline Coverage
```

You can identify:

> "Negotiation is the largest bottleneck across the organization."

Or:

> "Deals involving procurement take 37% longer to close."

This is much more valuable than a basic Kanban board.

---

# 19. Stage configuration should become a process engine

The current specification already has stage gating as a future feature. 

Make it a first-class configuration system.

For each stage:

```text
Stage
 ├── Entry Criteria
 ├── Required Fields
 ├── Required Activities
 ├── Exit Criteria
 ├── Probability
 ├── SLA
 ├── Automations
 ├── Notifications
 ├── AI Instructions
 └── Permissions
```

Example:

### Proposal

Required:

```text
✓ Deal value
✓ Decision maker
✓ Product
✓ Expected close date
✓ Proposal document
✓ Next step
```

Cannot advance until satisfied.

---

# 20. SLA and aging engine

A mature deals platform should detect:

```text
Deal overdue
Stage overdue
No activity
No next step
Expected close missed
Owner hasn't responded
Customer hasn't responded
```

Example:

```text
🔴 STALLED

No meaningful activity for 11 days.

Stage SLA:
5 days

Actual:
11 days

AI recommendation:
Contact decision maker.
```

---

# 21. Documents and commercial artifacts

Deals should eventually support:

```text
Quotes
Proposals
Contracts
Attachments
Purchase Orders
Invoices
Receipts
Meeting documents
```

This creates a natural lifecycle:

```text
Lead
 ↓
Deal
 ↓
Quote
 ↓
Proposal
 ↓
Negotiation
 ↓
Contract
 ↓
Won
 ↓
Invoice
 ↓
Payment
```

That connects directly into SmartSapp's broader CRM and Finance ecosystem.

---

# 22. The Deal page should become the command center

The current Deal Details page already contains configuration, contacts, tasks, custom fields and activity. 

I would evolve it into:

```text
┌───────────────────────────────────────────────────────┐
│ Deal Name                           GHS 48,500        │
│ Galaxy International School         71% Win Prob.    │
│ Negotiation                         🟢 Healthy        │
├───────────────────────────────────────────────────────┤
│ Pipeline Stage                                        │
│ Qualification → Demo → Proposal → [Negotiation] → Won│
├───────────────────────────────────────────────────────┤
│ AI DEAL BRIEF                                         │
│ Summary | Risks | Next Best Action | Probability     │
├───────────────────────────────────────────────────────┤
│ Activity Timeline                                     │
│                                                       │
│ Emails • Calls • WhatsApp • Meetings • Tasks         │
├──────────────────────┬────────────────────────────────┤
│ Contacts             │ Deal Information               │
│                      │                                │
│ Decision Maker       │ Value                          │
│ Champion             │ Probability                    │
│ Procurement          │ Expected Close                │
│                      │ Source                         │
├──────────────────────┼────────────────────────────────┤
│ Products / Items     │ Forecast                       │
│                      │                                │
│ Product A            │ Commit                         │
│ Product B            │ Q4                            │
├──────────────────────┴────────────────────────────────┤
│ Tasks | Notes | Documents | Quotes | Audit           │
└───────────────────────────────────────────────────────┘
```

---

# 23. The Deal list should become an operational workspace

Beyond:

* name
* entity
* value
* stage
* status
* close date
* owner

the user should be able to configure columns such as:

```text
Health
Probability
Forecast
Age
Stage Age
Last Activity
Next Activity
Next Step
Source
Campaign
Product
Contact
Owner
Team
Created Date
Expected Close
Days to Close
Amount
Weighted Amount
```

And save views:

```text
My Deals
Hot Deals
Closing This Month
At Risk
Stalled
Large Opportunities
New School Opportunities
Renewals
My Team's Deals
Deals Without Next Steps
```

This is where **full customization** becomes meaningful.

---

# 24. Customization architecture

Do not hard-code every Deal field.

Create a metadata-driven field system:

```text
DealFieldDefinition
```

with:

```text
text
number
currency
date
datetime
boolean
select
multi-select
user
team
contact
account
product
URL
email
phone
formula
```

Then allow:

```text
Required
Hidden
Read-only
Searchable
Filterable
Sortable
AI-visible
Automation-visible
Reportable
```

This allows administrators to configure Deals without engineering intervention.

---

# 25. Event architecture

I strongly recommend making Deals event-driven.

Core events:

```text
deal.created
deal.updated
deal.deleted

deal.stage.changed

deal.status.changed
deal.won
deal.lost

deal.owner.changed

deal.value.changed
deal.close_date.changed

deal.participant.added
deal.participant.removed

deal.activity.created

deal.task.created
deal.task.completed

deal.line_item.added
deal.line_item.removed

deal.quote.created
deal.quote.accepted

deal.contract.created
deal.contract.signed

deal.health.changed
deal.probability.changed

deal.stalled.detected
deal.sla.breached
```

These events then feed:

```text
Automation Engine
Analytics
Notifications
Audit
AI
Forecasting
Integrations
```

This is significantly more scalable than putting all behavior directly inside `updateDealStageAction`.

---

# 26. Firestore architecture

I would move toward something like:

```text
organizations/{organizationId}

workspaces/{workspaceId}

workspaces/{workspaceId}/pipelines/{pipelineId}

workspaces/{workspaceId}/pipelines/{pipelineId}/stages/{stageId}

workspaces/{workspaceId}/deals/{dealId}

workspaces/{workspaceId}/deals/{dealId}/participants/{participantId}

workspaces/{workspaceId}/deals/{dealId}/stageHistory/{historyId}

workspaces/{workspaceId}/deals/{dealId}/activities/{activityId}

workspaces/{workspaceId}/deals/{dealId}/lineItems/{lineItemId}

workspaces/{workspaceId}/deals/{dealId}/documents/{documentId}

workspaces/{workspaceId}/deals/{dealId}/quotes/{quoteId}
```

For very high-volume analytics, I would **not depend entirely on Firestore queries**.

Use an event pipeline:

```text
Firestore
   ↓
Domain Events
   ↓
Event Processing
   ↓
Analytics Projection
   ↓
Forecast / Reporting
```

That gives you a proper CQRS-style read model where appropriate.

---

# 27. Security model

The current RBAC implementation is a good foundation: mutations validate permissions and explicitly check workspace boundaries. 

The mature system should add:

```text
Organization
   ↓
Workspace
   ↓
Team
   ↓
User
```

with permissions at multiple levels:

```text
View
Create
Edit
Delete
Assign
Move Stage
Change Value
View Financials
Export
Bulk Edit
Manage Pipeline
Manage Automation
View Forecast
Manage Forecast
View AI
Execute AI Actions
```

And record-level visibility:

```text
All Deals
Team Deals
Owned Deals
Assigned Deals
Custom Rule
```

---

# 28. What I would preserve from the current implementation

There is quite a lot worth keeping.

### Keep

**Kanban**

* `@dnd-kit`
* optimistic movement
* rollback
* column ordering
* stage counters
* inline add

**List**

* sorting
* multi-select
* bulk actions
* floating action bar

**Multi-tenancy**

* workspace validation
* organization validation
* server-side permission checks

**Automation**

* stage triggers
* throttled dispatch
* automation logs
* pause/resume

**Currency**

* `Intl.NumberFormat`
* locale-aware rendering

**Contact search**

* entity/contact resolution
* automatic contact pre-selection

These are good foundations. 

---

# 29. What I would change immediately

Before adding more UI or AI, I would make these architectural changes:

### Priority 1 — Domain correction

```text
OnboardingStage → DealStage
```

### Priority 2 — Deal lifecycle

Separate:

```text
Stage
Status
Outcome
Health
Probability
Forecast
```

### Priority 3 — Relationships

Create first-class:

```text
DealParticipant
DealStageHistory
DealActivity
DealLineItem
```

### Priority 4 — CRM integration

Connect Deals to:

```text
Leads
Accounts/Entities
Contacts
Activities
Campaigns
Calls
Meetings
Messaging
Tasks
Forms
Surveys
```

### Priority 5 — Revenue model

Add:

```text
Products
Price Books
Line Items
Quotes
Contracts
```

### Priority 6 — Intelligence

Add:

```text
Deal Health
Win Probability
Next Best Action
Risk Detection
Stagnation Detection
AI Summary
Forecast Intelligence
```

### Priority 7 — Platform extensibility

Add:

```text
Custom fields
Custom views
Custom stages
Custom roles
Custom automations
Custom reports
Custom statuses/outcomes
```

---

# 30. Recommended SmartSapp Deals 2.0 architecture

The final architecture I would target is:

```text
                         SMARTSAPP CRM
                              │
                ┌─────────────┴─────────────┐
                │                           │
             CRM CORE                  DEALS PLATFORM
                │                           │
       ┌────────┼────────┐          ┌───────┼────────┐
       │        │        │          │       │        │
     Leads   Contacts  Accounts   Pipeline Deals  Products
                                  │       │        │
                                  │       │     Line Items
                                  │       │
                                Stages   Participants
                                  │       │
                                  └───┬───┘
                                      │
                                  Activities
                                      │
                  ┌───────────────────┼───────────────────┐
                  │                   │                   │
              Automation          Analytics           AI Engine
                  │                   │                   │
          ┌───────┼───────┐      Forecasting       Summaries
          │       │       │      Conversion        Risk
        Email  WhatsApp Tasks     Velocity         Next Action
                                  Revenue           Probability
                                      │
                                  Reporting
                                      │
                              Finance / Billing
                                      │
                              Quotes / Invoices
                                      │
                                  Payments
```

## The strategic shift

The most important conceptual change is this:

> **Don't build Deals as a better Kanban board. Build Deals as the revenue operating system of the SmartSapp CRM.**

The Kanban board then becomes merely **one interface into the Deal domain**.

The same deal should be accessible from:

* CRM contact
* school/entity profile
* lead
* campaign
* sales dashboard
* pipeline
* task
* meeting
* call centre
* messaging
* finance
* quote
* invoice
* reporting
* AI assistant

without duplicating the underlying deal.

That is what will make it genuinely **CRM-aware and platform-wide**.

---

## Recommended next step

I would **not jump straight into the UI PRD yet**.

The correct sequence is:

### Phase 1 — Target Domain Architecture

Define the complete:

* Deal domain model
* Pipeline model
* Stage state machine
* Deal state machine
* Participant model
* Activity model
* Product/line-item model
* Revenue model
* Forecast model
* Attribution model
* Custom-field model
* Permission model

### Phase 2 — Event Architecture

Define every:

* Deal event
* Stage event
* Activity event
* Revenue event
* AI event
* Automation event

and how they flow through SmartSapp.

### Phase 3 — Processing Architecture

Define:

```text
Firestore
→ Domain Services
→ Event Bus
→ Automation Engine
→ AI Engine
→ Analytics Projections
→ Notifications
→ External Integrations
```

### Phase 4 — UX Architecture

Then design the complete:

* Deals workspace
* Pipeline board
* List
* Deal detail
* Deal creation
* Bulk management
* Forecast
* Analytics
* AI intelligence
* Pipeline builder
* Stage builder
* Custom fields
* Views
* Automation builder

### Phase 5 — Implementation Roadmap

Finally break it into **production-safe phases from the current implementation to Deals 2.0**, including migration strategy so the existing SmartSapp deals don't have to be thrown away.

**That is the architecture I recommend we use as the foundation for the full SmartSapp Deals 2.0 PRD.**
