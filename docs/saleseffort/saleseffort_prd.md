# SmartSapp Sales Performance & Intelligence 2.0

## Product Requirements Document

**Product:** SmartSapp CRM
**Module:** Sales Performance & Intelligence 2.0
**Document Type:** Product Requirements Document
**Target:** Production / Enterprise-grade
**Primary surfaces:** Sales, CRM, Analytics, AI, Automations, Administration
**Status:** Target Architecture / Implementation Blueprint
**Version:** 2.0

---

# 1. Executive Summary

SmartSapp Sales Performance & Intelligence 2.0 is the organization-wide sales execution, human-agent management, performance management, sales intelligence, coaching, revenue attribution, and AI-assistance layer of SmartSapp CRM.

The module evolves the existing **Sales Effort & Productivity** implementation from an activity-points dashboard into a complete operating system for sales teams.

The target operating model is:

> **Goal → Assignment → Action → Interaction → Buyer Signal → Quality → Outcome → Coaching → Revenue**

The product must continuously answer:

* What should each sales agent do now?
* Which leads, accounts, and deals deserve attention?
* What work has been completed?
* Was the work high quality?
* Did buyers respond?
* Did the activity move an opportunity forward?
* Is the rep on target?
* Which deals are at risk?
* Which reps need coaching?
* What behaviors correlate with revenue?
* What should the manager do next?
* What should AI do automatically?
* How much revenue can be attributed to each sales activity, rep, team, campaign, and touchpoint?

The product is therefore composed of ten interconnected domains:

1. **Sales Workforce**
2. **Sales Execution**
3. **Performance Management**
4. **Targets & Quotas**
5. **Conversation & Coaching Intelligence**
6. **Buyer & Deal Intelligence**
7. **Revenue Attribution & Forecasting**
8. **Sales Orchestration**
9. **AI Sales Agents**
10. **Governance, Security & Administration**

The design principle is that Sales Performance should not be a silo. It should consume signals from the broader SmartSapp ecosystem, including CRM, Leads Intelligence, Campaigns, Messaging, Meetings, Call Centre, Forms, Surveys, Documents, Automations, QR, Billing and Payments.

The current module already establishes a central activity logger and asynchronous scoring pipeline. The 2.0 architecture formalizes that approach into a canonical SmartSapp Event Fabric and Sales Intelligence Graph.

---

# 2. Product Vision

## Vision

Create the operating layer that makes every SmartSapp sales organization more measurable, coachable, predictable, and AI-assisted.

## Product promise

### For sales representatives

> “Tell me what matters most right now and help me execute it.”

### For sales managers

> “Show me where my team stands, why performance is changing, and who needs intervention.”

### For sales operations

> “Give me complete control over targets, processes, scorecards, scoring, attribution, governance, and reporting.”

### For executives

> “Show me what is driving revenue and whether the business is on track.”

### For the organization

> “Turn every interaction into reusable intelligence.”

---

# 3. Current-State Assessment

The existing implementation provides a strong starting point.

It already contains:

* configurable sales-effort rules
* event-based effort capture
* representative summaries
* leaderboard
* activity ledger
* calls
* meetings
* tasks
* deal progression
* email/SMS/WhatsApp events
* documents and signatures
* surveys
* AI deal intelligence
* AI buying-signal extraction
* conversation sentiment
* speech analysis
* explainable scoring.

However, there are architectural issues that must be remediated.

## Mandatory foundation fixes

### Ledger consistency

The backend writes to `effortEvents` while the client queries `effortScoringLedger`, causing representative activity views to return empty data.

### Tenant partitioning

The effort ledger needs mandatory `organizationId` and `workspaceId`.

### Aggregate identity

`userEffortSummary/{actorId}` is not a valid enterprise partitioning model because the same user may operate within multiple workspaces.

### Time dimensions

The current cumulative totals are inadequate for daily, weekly, monthly and quarterly performance analysis.

### Human vs machine activity

Events such as `automation_executed` and `webhook_triggered` should not automatically count as human sales effort. The current catalog includes these as effort rules.

### Scoring model

Activity points must become one dimension of performance rather than the primary definition of performance.

---

# 4. Product Principles

## 4.1 Activity is not performance

A high number of calls does not necessarily mean high performance.

Performance must distinguish:

* activity
* effort
* quality
* effectiveness
* outcome
* revenue

## 4.2 Human work must remain distinguishable

The system must distinguish:

* human activity
* AI activity
* automation
* integration events
* buyer activity
* system events

## 4.3 AI must be explainable

Every AI recommendation or adjustment must expose:

* reason
* evidence
* confidence
* expected outcome
* source signals
* model/version
* human override

## 4.4 AI recommends before it acts

AI should progressively move from:

**Observe → Recommend → Prepare → Execute with approval → Execute automatically under policy**

## 4.5 Event facts are immutable

Historical events must not be rewritten to alter performance history.

Corrections should create adjustment events.

## 4.6 Tenant boundaries are absolute

No performance, activity, attribution, benchmark, or AI context may cross organization/workspace boundaries without explicit permission and approved aggregation.

## 4.7 Performance management must be configurable

Not all organizations use:

* quotas
* public rankings
* commissions
* the same sales methodology
* the same activity model

The system must support custom policies.

---

# 5. Target Product Architecture

## 5.1 Product layers

```text
SmartSapp Experience Layer
        │
        ├── Seller Workspace
        ├── Manager Command Center
        ├── Executive Revenue Intelligence
        ├── RevOps Administration
        └── AI Workspace
                │
                ▼
Sales Intelligence Services
        │
        ├── Performance Engine
        ├── Prioritization Engine
        ├── Coaching Engine
        ├── Deal Intelligence
        ├── Buyer Signal Engine
        ├── Attribution Engine
        ├── Forecast Engine
        └── Orchestration Engine
                │
                ▼
Canonical Sales Intelligence Graph
                │
                ▼
SmartSapp Event Fabric
                │
        ┌───────┼─────────┐
        ▼       ▼         ▼
CRM      Communications   Operational Apps
```

---

# 6. Core Domains

## Domain A — Sales Workforce

Represents the human organization.

Includes:

* sales users
* teams
* managers
* roles
* territories
* regions
* segments
* skills
* capacity
* availability
* targets
* assignments

## Domain B — Sales Execution

Represents actual work.

Includes:

* tasks
* activities
* calls
* meetings
* sequences
* plays
* follow-ups
* work queues
* SLAs

## Domain C — Performance

Measures:

* activity
* effort
* quality
* effectiveness
* outcome
* goal attainment

## Domain D — Intelligence

Generates:

* buying signals
* deal risks
* next-best-actions
* performance explanations
* coaching recommendations

## Domain E — Revenue

Connects sales behavior to:

* pipeline
* opportunities
* closed revenue
* forecast
* attribution

## Domain F — Orchestration

Automates:

* assignments
* plays
* notifications
* escalations
* follow-ups
* interventions

---

# 7. Target Domain Model

```text
Organization
 └── Workspace
      ├── Business Unit
      ├── Team
      │    └── Sales Agent
      │
      ├── Territory
      ├── Sales Methodology
      ├── Performance Policy
      ├── Scorecards
      ├── Targets
      ├── Playbooks
      ├── Attribution Models
      │
      └── Revenue Graph
           ├── Account
           ├── Contact
           ├── Lead
           ├── Opportunity
           ├── Activity
           ├── Conversation
           ├── Meeting
           ├── Proposal
           ├── Contract
           └── Revenue

SmartSapp Event Fabric
       ↓
Performance Engine
       ↓
Intelligence Engine
       ↓
AI Agents
       ↓
Actions / Insights / Analytics
```

---

# 8. Complete Core Schemas

The following represents the target logical schema. Implementation may use multiple Firestore documents and denormalized read models.

## 8.1 SalesAgent

```typescript
interface SalesAgent {
  id: string;

  organizationId: string;
  workspaceId: string;
  teamId?: string;

  userId: string;

  roleId: string;
  managerId?: string;

  status:
    | "invited"
    | "active"
    | "inactive"
    | "suspended"
    | "archived";

  jobTitle?: string;

  territories: string[];
  segments: string[];

  skills: SalesSkill[];
  methodologies: string[];

  capacity: {
    weeklyHours: number;
    productiveHours: number;
    maxOpenLeads?: number;
    maxOpenDeals?: number;
  };

  availability: {
    timezone: string;
    workingHours: WorkingHours[];
  };

  performancePolicyId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 8.2 SalesTeam

```typescript
interface SalesTeam {
  id: string;
  organizationId: string;
  workspaceId: string;

  name: string;
  description?: string;

  managerIds: string[];
  memberIds: string[];

  territoryIds: string[];
  segmentIds: string[];

  targetProfileId?: string;

  status: "active" | "inactive" | "archived";

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 8.3 PerformancePolicy

```typescript
interface PerformancePolicy {
  id: string;

  organizationId: string;
  workspaceId: string;

  name: string;
  description?: string;

  dimensions: {
    activityWeight: number;
    effortWeight: number;
    qualityWeight: number;
    effectivenessWeight: number;
    outcomeWeight: number;
  };

  antiGamingRules: AntiGamingRule[];

  leaderboardMode:
    | "disabled"
    | "private"
    | "team"
    | "organization";

  status: "draft" | "active" | "archived";

  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;

  version: number;
}
```

---

# 9. Canonical Event Model

The current event model must evolve into a complete fact model.

```typescript
interface SalesPerformanceEvent {
  id: string;

  organizationId: string;
  workspaceId: string;

  teamId?: string;
  territoryId?: string;

  actorId?: string;

  actorType:
    | "human"
    | "ai"
    | "automation"
    | "integration"
    | "buyer"
    | "system";

  eventType: string;
  eventCategory:
    | "prospecting"
    | "communication"
    | "meeting"
    | "task"
    | "deal"
    | "document"
    | "buyer_signal"
    | "customer"
    | "system"
    | "performance";

  entityType: string;
  entityId: string;

  accountId?: string;
  contactId?: string;
  leadId?: string;
  opportunityId?: string;
  campaignId?: string;

  source:
    | "crm"
    | "call_centre"
    | "meetings"
    | "email"
    | "sms"
    | "whatsapp"
    | "campaign"
    | "forms"
    | "surveys"
    | "documents"
    | "automation"
    | "api"
    | "ai";

  occurredAt: Timestamp;
  recordedAt: Timestamp;

  outcome?: string;
  intent?: string;

  durationSeconds?: number;

  metrics?: {
    qualityScore?: number;
    effortScore?: number;
    effectivenessScore?: number;
    outcomeScore?: number;
    revenueValue?: number;
  };

  attribution?: {
    modelId?: string;
    weight?: number;
  };

  metadata: Record<string, unknown>;

  correlationId?: string;
  causationId?: string;

  sourceVersion?: string;

  idempotencyKey: string;
}
```

---

# 10. Event Taxonomy

## 10.1 Lead events

```text
lead.created
lead.assigned
lead.accepted
lead.reassigned
lead.enriched
lead.qualified
lead.disqualified
lead.converted
lead.archived
lead.reactivated
```

## 10.2 Account/contact events

```text
account.created
account.updated
contact.created
contact.updated
contact.enriched
contact_role.added
decision_maker.identified
stakeholder.added
```

## 10.3 Communication events

```text
call.initiated
call.connected
call.completed
call.voicemail
call.missed
call.disconnected
email.sent
email.delivered
email.opened
email.clicked
email.replied
sms.sent
sms.delivered
sms.replied
whatsapp.sent
whatsapp.delivered
whatsapp.replied
```

## 10.4 Meeting events

```text
meeting.created
meeting.scheduled
meeting.confirmed
meeting.rescheduled
meeting.started
meeting.attended
meeting.no_show
meeting.completed
meeting.cancelled
meeting.notes_added
meeting.transcript_available
meeting.ai_analyzed
```

## 10.5 Task events

```text
task.created
task.assigned
task.started
task.completed
task.overdue
task.reopened
task.cancelled
task.escalated
```

## 10.6 Deal events

```text
deal.created
deal.assigned
deal.stage_changed
deal.amount_changed
deal.forecast_changed
deal.stalled
deal.reactivated
deal.proposal_sent
deal.contract_sent
deal.contract_signed
deal.won
deal.lost
```

## 10.7 Buyer signal events

```text
buyer.intent_detected
buyer.high_engagement
buyer.low_engagement
proposal.viewed
proposal.revisited
email_replied
meeting_requested
pricing_question
competitor_signal
buying_signal_detected
decision_maker_engaged
```

## 10.8 Performance events

```text
target.created
target.updated
target.attainment_changed
quota.attainment_changed
performance.threshold_reached
performance.anomaly_detected
coaching.recommended
coaching.completed
```

## 10.9 AI events

```text
ai.recommendation_created
ai.recommendation_accepted
ai.recommendation_rejected
ai.action_executed
ai.prediction_generated
ai.score_generated
ai.score_overridden
```

---

# 11. Event Idempotency

Every event must carry an idempotency key.

```text
workspaceId
+
source
+
sourceEventId
+
eventType
```

Duplicate ingestion must never:

* double-award points
* double-count activity
* double-attribute revenue
* create duplicate tasks
* create duplicate AI recommendations

---

# 12. State Machines

## 12.1 Sales Agent lifecycle

```text
INVITED
   ↓
ACTIVE
   ↓
INACTIVE
   ↓
ARCHIVED
```

Suspension can occur from any active state.

---

# 13. Lead-to-Sales Execution State

```text
NEW
 ↓
ASSIGNED
 ↓
ATTEMPTING_CONTACT
 ↓
CONNECTED
 ↓
QUALIFYING
 ↓
QUALIFIED
 ↓
OPPORTUNITY
 ↓
CUSTOMER

Alternative:
DISQUALIFIED
ARCHIVED
NURTURE
```

---

# 14. Sales Task State Machine

```text
CREATED
 ↓
ASSIGNED
 ↓
READY
 ↓
IN_PROGRESS
 ↓
COMPLETED
```

Alternative transitions:

```text
READY → OVERDUE
IN_PROGRESS → BLOCKED
BLOCKED → READY
COMPLETED → REOPENED
CREATED → CANCELLED
```

---

# 15. AI Recommendation State Machine

```text
GENERATED
   ↓
PRESENTED
   ↓
ACCEPTED
   ↓
EXECUTING
   ↓
COMPLETED
```

Alternative:

```text
PRESENTED → DISMISSED
PRESENTED → EXPIRED
ACCEPTED → FAILED
```

The system must measure:

* recommendation acceptance rate
* execution rate
* outcome rate
* revenue influence

---

# 16. Performance Scoring Architecture

The old model:

```text
Activity → Points
```

becomes:

```text
Activity
   ↓
Effort
   ↓
Quality
   ↓
Effectiveness
   ↓
Outcome
   ↓
Revenue
```

## 16.1 Six performance dimensions

### Activity Score

Volume of work.

### Effort Score

Intentional human effort.

### Quality Score

Quality of execution.

### Effectiveness Score

Ability to produce meaningful buyer response.

### Outcome Score

Ability to move CRM outcomes.

### Revenue Score

Contribution to pipeline and revenue.

---

# 17. Composite Performance Index

Example configuration:

```text
Activity        10%
Effort          15%
Quality         20%
Effectiveness   20%
Outcome         20%
Revenue         15%
```

But every organization can configure these.

The score must always expose the individual components.

Example:

> Performance Index: 84

```text
Activity        91
Effort          87
Quality         76
Effectiveness   82
Outcome         88
Revenue         79
```

---

# 18. Effort Scoring Rules Engine

The rules engine must support:

* event filters
* conditions
* thresholds
* multipliers
* caps
* penalties
* exclusions
* segments
* roles
* teams
* territories
* time windows
* effective dates

Example:

```text
WHEN:
call.completed

IF:
duration > 120 seconds
AND
lead.status = qualified
AND
outcome = meaningful_conversation

THEN:

Effort = 8
Quality = +4
```

---

# 19. Quality Scoring

Quality must be determined from multiple sources.

Possible inputs:

* call duration
* call outcome
* notes completeness
* next-step quality
* discovery questions
* buyer sentiment
* objection handling
* methodology adherence
* CRM completeness
* follow-up timing

The AI can contribute a score but cannot silently alter the base facts.

---

# 20. Effectiveness Scoring

Effectiveness measures whether work generated a meaningful buyer response.

Examples:

```text
Call → Meeting
Meeting → Opportunity
Opportunity → Proposal
Proposal → Contract
Contract → Revenue
```

A call that connects but produces no progress should not necessarily score the same as a call that results in a scheduled discovery meeting.

---

# 21. Outcome Scoring

Outcome scoring should incorporate:

* qualified leads
* pipeline created
* opportunities advanced
* deals won
* revenue generated
* customer expansion
* retention

---

# 22. Anti-Gaming Engine

The engine must support:

### Frequency controls

Repeated actions within a configurable time threshold receive reduced credit.

### Daily caps

Example:

> First 40 calls = full value
> Next 30 = partial value
> Beyond threshold = no effort credit

### Minimum duration

Short calls may receive limited credit.

### Outcome weighting

Connected conversations are weighted above unconnected attempts.

### Data-quality requirements

Incomplete CRM records reduce quality credit.

### Automation exclusion

Automation-created events cannot be mistaken for human effort.

### Anomaly detection

AI can detect unusual activity patterns.

---

# 23. Human vs Machine Effort

Each activity must be classified.

```text
Human Work
AI Work
Automation Work
Buyer Work
Integration Work
System Work
```

Example:

```text
AI drafted email
↓
Human edited
↓
Human sent
↓
Buyer opened
↓
Buyer replied
↓
AI detected buying signal
↓
Human called
↓
Meeting booked
```

Every stage remains individually measurable.

---

# 24. Workforce Management

The platform must manage the sales workforce as operational capacity.

## Workforce dimensions

* role
* skills
* territory
* workload
* availability
* capacity
* current assignments
* pipeline responsibilities
* SLA commitments

## Workload score

```text
Open leads
+
Open deals
+
Tasks
+
Meetings
+
Follow-ups
+
SLA pressure
```

AI converts this into:

> 124% workload

and recommends redistribution.

---

# 25. Lead/Opportunity Assignment Engine

Support:

### Round robin

### Territory-based

### Account-owner based

### Segment-based

### Skill-based

### Capacity-based

### AI-based

Example:

> Route education-sector enterprise lead to the available representative with the highest historical close rate for this segment.

Assignment decisions must be explainable.

---

# 26. Targets & Quotas

Targets can be configured at:

```text
Organization
Business Unit
Team
Manager
Rep
Territory
Segment
Product
```

Supported measures:

* revenue
* pipeline
* opportunities
* qualified leads
* meetings
* calls
* conversion
* renewals
* collections
* customer expansion
* quality

---

# 27. Target Schema

```typescript
interface SalesTarget {
  id: string;

  organizationId: string;
  workspaceId: string;

  ownerType:
    | "organization"
    | "team"
    | "manager"
    | "agent"
    | "territory";

  ownerId: string;

  metric:
    | "revenue"
    | "pipeline"
    | "meetings"
    | "qualified_leads"
    | "opportunities"
    | "conversion"
    | "activities"
    | "quality";

  period:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "annual";

  baseline?: number;
  target: number;
  stretchTarget?: number;

  actual: number;

  attainmentPercent: number;

  startAt: Timestamp;
  endAt: Timestamp;

  status:
    | "upcoming"
    | "active"
    | "achieved"
    | "missed"
    | "closed";
}
```

---

# 28. Forecasted Attainment

Every active target should have:

```text
Actual
Required pace
Current pace
Predicted outcome
Probability
```

Example:

> Target: GHS 500,000
> Actual: GHS 310,000
> Attainment: 62%
> Days remaining: 11
> Required daily pace: GHS 17,273
> Predicted: GHS 472,000
> Probability: 68%

---

# 29. Sales Command Center

The manager homepage.

## Header

**Sales Command Center**

Filters:

* period
* team
* manager
* territory
* segment
* product

## KPI row

* Revenue
* Pipeline
* Quota Attainment
* Win Rate
* Pipeline Velocity
* Active Reps
* At-Risk Deals
* SLA Breaches

## AI summary

> Pipeline is 11% below target.
> Two enterprise opportunities account for 47% of projected shortfall.
> Three reps are trending below expected attainment.

## Team health

Each rep receives:

```text
Performance
Quota
Pipeline
Activity
Quality
Risk
```

---

# 30. Seller Workspace

The seller should not begin their day in a leaderboard.

The default page should be:

# My Day

## Today's priorities

```text
1. Call ABC School
   High impact
   Proposal viewed 3×

2. Follow up with Greenfield Academy
   SLA expires in 2h

3. Prepare for 3:00 PM meeting
   Decision-maker attending
```

Actions:

* Call
* Email
* WhatsApp
* View deal
* Draft follow-up
* Create task
* Snooze
* Dismiss

The principle is **action from the surface**.

---

# 31. AI Priority Queue

Each work item receives:

```text
Priority Score
Impact
Urgency
Confidence
Reason
Recommended Action
```

Priority should consider:

* deal value
* stage
* buyer engagement
* recency
* historical conversion
* SLA
* rep target
* deal risk
* account importance
* next-step status

Salesloft's current Rhythm/Conductor approach is a useful benchmark: AI continuously prioritizes seller actions using buyer engagement, opportunity context and outcome likelihood rather than merely displaying tasks.

---

# 32. Next-Best-Action Engine

Every recommendation must contain:

### Action

What should be done?

### Why

Why now?

### Evidence

Which CRM/events/signals support it?

### Expected impact

What may happen if completed?

### Confidence

How certain is the model?

### Execution

What will SmartSapp do?

Example:

> **Call Michael at Sunrise Academy**
>
> Their proposal was opened 4 times in 24 hours and the decision-maker attended the last meeting.
>
> **Expected impact:** High
> **Confidence:** 89%
>
> Suggested conversation:
> “Confirm implementation timing and decision process.”

---

# 33. Sales Plays

A Play is a structured response to a signal.

## Play structure

```text
Trigger
↓
Qualification
↓
Recommended actions
↓
Timing
↓
Escalation
↓
Exit condition
```

Example:

### Proposal Viewed Play

Trigger:

> proposal viewed ≥ 3 times

Actions:

1. raise priority
2. notify owner
3. generate AI brief
4. create call task
5. prepare personalized follow-up
6. escalate after 48 hours

---

# 34. Play Builder

No-code administration interface.

Components:

* Trigger
* Condition
* Action
* Delay
* Branch
* Approval
* AI action
* Notification
* SLA
* Escalation
* Exit

This should use SmartSapp's existing automation philosophy rather than introducing an unrelated workflow paradigm.

---

# 35. Sales Performance Profile

Every agent receives a permanent profile.

## Example

**Performance Index:** 84

### Strengths

* discovery
* meeting preparation
* follow-up consistency

### Weaknesses

* objection handling
* late-stage conversion

### Trend

↑ 8% month-over-month

### Coaching opportunities

2

### Risk

Medium

### Forecast

88% quota attainment

### Benchmark

Top 25% of comparable reps

---

# 36. Performance Health Score

The platform should automatically evaluate:

```text
Activity health
Pipeline health
Conversion health
Quality health
Revenue health
CRM hygiene
Workload health
Coaching health
```

Example:

> **Performance Health: 78**

The system must answer:

> Why?

---

# 37. “What Changed?” Intelligence

Every major dashboard should have a **Why?** interaction.

Example:

> Performance ↓ 9%

AI explanation:

> Meeting volume remained stable, but meeting-to-opportunity conversion declined from 31% to 19%. Four opportunities were affected by unresolved pricing objections.

This is a mandatory intelligence pattern.

---

# 38. Conversation Intelligence

The current platform already extracts buying signals, objections, sentiment, talk/listen ratio, pacing, monologues and discovery question frequency.

2.0 expands this into a comprehensive interaction intelligence system.

## Extract:

* buying signals
* objections
* sentiment
* intent
* competitors
* pricing
* timing
* authority
* urgency
* pain
* desired outcome
* decision process
* next steps
* commitments
* risks

---

# 39. Conversation Scorecards

Admins create structured scorecards.

Examples:

### Discovery Scorecard

* agenda established
* pain identified
* urgency established
* decision process identified
* budget explored
* next step agreed

### Demo Scorecard

* relevant features
* value linkage
* proof
* objections
* engagement
* close

### Closing Scorecard

* decision criteria
* stakeholders
* objections
* commercial discussion
* commitment
* next step

Gong's current AI Call Reviewer and scorecard system provides a relevant category benchmark: structured criteria can be created from templates or with AI and automatically applied to conversations.

---

# 40. Coaching System

Managers can create:

* coaching plans
* coaching goals
* weekly coaching sessions
* assigned calls
* improvement exercises
* roleplay scenarios
* scorecard reviews

## Coaching loop

```text
Observe
↓
Identify gap
↓
Recommend coaching
↓
Practice
↓
Measure
↓
Compare
↓
Improve
```

---

# 41. AI Sales Coach

The AI Coach should analyze:

* conversations
* performance trends
* outcomes
* scorecards
* manager feedback
* target attainment

Example:

> Your discovery calls score strongly on pain identification but weakly on decision process discovery.

Then:

> Practice asking three questions about timeline, authority and approval process.

---

# 42. Sales Practice Lab

AI becomes the buyer.

Scenarios include:

* pricing objection
* competitor
* “send me information”
* budget issue
* timing issue
* existing vendor
* decision-maker unavailable
* procurement challenge

After the simulation:

```text
Discovery          84
Question Quality   89
Objection Handling 71
Listening          78
Closing            62
```

The platform recommends another scenario based on the weakest dimension.

---

# 43. Deal Intelligence

The current system already provides deal summary, win probability, risk analysis, stalled-deal warnings and next-best actions.

2.0 formalizes this into a persistent Deal Intelligence object.

```typescript
interface DealIntelligence {
  dealId: string;

  healthScore: number;
  winProbability: number;

  momentumScore: number;
  engagementScore: number;

  riskLevel: "low" | "medium" | "high" | "critical";

  risks: DealRisk[];
  buyingSignals: BuyingSignal[];

  nextBestActions: RecommendedAction[];

  stakeholderCoverage: number;

  stageAgeDays: number;
  expectedCloseVariance?: number;

  generatedAt: Timestamp;
  modelVersion: string;
}
```

---

# 44. Deal Health

Inputs:

* recent activity
* buyer engagement
* meeting attendance
* stakeholder count
* stage duration
* proposal behavior
* contract status
* sentiment
* objections
* next step
* communication frequency

Output:

> **Deal Health: 63 — At Risk**

Reason:

* 11 days without meaningful progression
* only one stakeholder engaged
* pricing objection unresolved
* expected close date slipped twice

---

# 45. Revenue Attribution Engine

The attribution engine answers:

> Who and what influenced the revenue?

## Attribution dimensions

* person
* team
* campaign
* channel
* activity
* meeting
* lead source
* sequence
* play
* content
* opportunity stage

## Models

### First-touch

100% to origin.

### Last-touch

100% to closing touch.

### Linear

Equal distribution.

### Weighted

Configurable weights.

### Time-decay

Recent interactions receive more weight.

### Position-based

Example:

20% first
20% last
60% distributed middle

### Custom

Organization-defined formula.

---

# 46. Attribution Example

Deal value:

> GHS 100,000

Touches:

```text
Lead source                  20%
Discovery meeting            25%
Product demo                 25%
Proposal interaction         15%
Closing interaction          15%
```

SmartSapp records both:

**Activity credit**

and

**Revenue influence**

so performance scores and revenue attribution are not conflated.

---

# 47. Multi-Rep Attribution

Support situations where multiple reps contribute.

Example:

```text
Rep A — sourced
Rep B — qualified
Rep C — demo
Rep A — negotiated
Rep D — closed
```

The system produces:

```text
Sourcing        15%
Qualification   20%
Demo            25%
Negotiation     20%
Closing         20%
```

Managers can switch models.

---

# 48. Pipeline Velocity

Measure:

```text
Lead → Qualified
Qualified → Opportunity
Opportunity → Proposal
Proposal → Contract
Contract → Won
```

Metrics:

* average duration
* median duration
* stage conversion
* time in stage
* velocity trend
* rep variance
* team variance

---

# 49. Revenue Intelligence

The system must provide:

### Pipeline

* value
* coverage
* stage mix
* velocity

### Forecast

* committed
* best case
* likely
* upside
* AI forecast

### Risk

* stalled
* slipping
* low engagement
* weak stakeholder coverage

### Revenue drivers

* reps
* teams
* segments
* campaigns
* sources
* products

Clari's current positioning is a useful reference: its revenue intelligence and forecasting model connects deal signals, historical data, pipeline health and predictive insight instead of relying solely on manual forecast inputs.

---

# 50. Win/Loss Intelligence

After a deal closes:

## Win analysis

* lead source
* sales actions
* engagement
* meetings
* objections
* stakeholders
* cycle length
* product
* rep
* competitor

## Loss analysis

* pricing
* competitor
* feature gap
* timing
* procurement
* authority
* lack of engagement
* response time

AI generates organizational patterns.

Example:

> Deals with three or more engaged stakeholders close 27% faster.

---

# 51. Benchmark Engine

Benchmarks:

### Self benchmark

Rep vs previous performance.

### Team benchmark

Rep vs team.

### Role benchmark

Rep vs same role.

### Segment benchmark

Rep vs comparable segment.

### Top-performer benchmark

Rep vs top quartile.

This prevents simplistic leaderboard interpretations.

---

# 52. AI Agent Architecture

SmartSapp should use multiple specialized agents rather than one generic sales chatbot.

## 52.1 Sales Prioritization Agent

Determines:

> What should happen next?

Inputs:

* buyer signals
* deals
* tasks
* targets
* SLAs
* opportunity value
* rep capacity

Outputs:

* ranked actions

---

# 53. Deal Intelligence Agent

Determines:

* health
* risk
* probability
* next action
* stakeholder gaps

---

# 54. Sales Coaching Agent

Determines:

* skill gaps
* coaching opportunities
* practice scenarios
* improvement trends

---

# 55. Conversation Agent

Determines:

* buying signals
* sentiment
* objection
* intent
* commitments
* next steps

---

# 56. CRM Hygiene Agent

Detects:

* missing fields
* stale records
* inconsistent stages
* duplicate contacts
* missing next steps
* missing decision-makers

The agent can recommend or perform governed repairs.

---

# 57. Workload Agent

Monitors:

* capacity
* open tasks
* meetings
* deals
* SLA pressure

Recommendations:

> Reassign 6 low-priority leads.

---

# 58. Forecast Agent

Predicts:

* target attainment
* pipeline outcome
* slipped revenue
* expected close date
* forecast confidence

---

# 59. Manager Agent

The manager can ask:

> Who is falling behind?

> Why?

> Which deals need my attention?

> Which rep should I coach?

> What changed this week?

> What should I discuss in tomorrow's 1:1?

The agent must answer from SmartSapp organizational data.

---

# 60. AI Context Architecture

AI agents should consume a governed context layer:

```text
Organization
Workspace
User
Team
Lead
Account
Contact
Opportunity
Activities
Conversations
Meetings
Targets
Performance
Revenue
Buyer Signals
Policies
Permissions
```

Agents must never receive broader data than the initiating user is entitled to see.

---

# 61. AI Governance

Every AI decision should record:

```typescript
interface AIExecution {
  id: string;

  organizationId: string;
  workspaceId: string;

  agentType: string;
  actionType: string;

  requestedBy: string;

  inputContextIds: string[];

  modelProvider: string;
  modelName: string;
  modelVersion?: string;

  output: unknown;

  confidence?: number;

  policyCheck: {
    passed: boolean;
    policyIds: string[];
  };

  humanApprovalRequired: boolean;
  humanApprovedBy?: string;

  executed: boolean;

  createdAt: Timestamp;
}
```

---

# 62. AI Action Levels

## Level 0 — Observe

AI only analyzes.

## Level 1 — Recommend

AI recommends.

## Level 2 — Prepare

AI drafts.

## Level 3 — Execute with approval

Human approves.

## Level 4 — Governed autonomous execution

AI executes within explicit policies.

This becomes the long-term SmartSapp AI operating model.

---

# 63. AI Confidence Policy

Low confidence:

> Recommend only.

Medium confidence:

> Prepare action.

High confidence + approved play:

> Execute automatically.

Sensitive actions must always require approval.

---

# 64. CRM Integration

Sales Performance must integrate directly with:

## Leads

* source
* qualification
* assignments
* lead score

## Contacts

* engagement
* communication
* stakeholder roles

## Accounts

* ownership
* opportunity coverage
* account engagement

## Deals

* stages
* value
* progression
* forecast

## Activities

* calls
* tasks
* emails
* notes

---

# 65. SmartSapp Ecosystem Integrations

## Call Centre

Capture:

* attempts
* connects
* duration
* outcomes
* recordings
* transcripts

The current call-centre implementation already emits call completion events into the scoring flow.

## Meetings

Capture:

* booked
* attended
* no-show
* completed
* transcript
* AI analysis

## Messaging

Capture:

* sent
* delivered
* opened
* clicked
* replied

## Campaigns

Capture:

* campaign touches
* engagement
* conversions

## Forms

Capture:

* submission
* qualification
* conversion

## Surveys

Capture:

* completion
* sentiment
* feedback

## Documents

Capture:

* proposal
* quote
* contract
* signature

## Billing

Capture:

* invoice
* payment
* renewal
* revenue

---

# 66. Shared SmartSapp Event Fabric

The Sales Performance module should subscribe to a canonical platform event system.

```text
SmartSapp Modules
      ↓
Canonical Events
      ↓
Event Router
      ├── Performance
      ├── Lead Scoring
      ├── Automation
      ├── Analytics
      ├── AI
      └── Attribution
```

The existing `activity-logger.ts` concept should evolve into this platform primitive.

---

# 67. Firestore Architecture

Recommended logical hierarchy:

```text
organizations/{organizationId}

workspaces/{workspaceId}

workspaces/{workspaceId}/salesAgents/{agentId}

workspaces/{workspaceId}/salesTeams/{teamId}

workspaces/{workspaceId}/salesTargets/{targetId}

workspaces/{workspaceId}/performancePolicies/{policyId}

workspaces/{workspaceId}/performanceRules/{ruleId}

workspaces/{workspaceId}/salesEvents/{eventId}

workspaces/{workspaceId}/salesDaily/{bucketId}

workspaces/{workspaceId}/salesWeekly/{bucketId}

workspaces/{workspaceId}/salesMonthly/{bucketId}

workspaces/{workspaceId}/scorecards/{scorecardId}

workspaces/{workspaceId}/coachingPlans/{planId}

workspaces/{workspaceId}/buyerSignals/{signalId}

workspaces/{workspaceId}/dealIntelligence/{dealId}

workspaces/{workspaceId}/recommendations/{recommendationId}

workspaces/{workspaceId}/plays/{playId}

workspaces/{workspaceId}/attributionModels/{modelId}

workspaces/{workspaceId}/revenueAttribution/{recordId}
```

---

# 68. Performance Aggregate Strategy

Never rely solely on all-time mutable totals.

Maintain:

```text
Daily
Weekly
Monthly
Quarterly
Current period
Historical snapshots
```

This enables:

* trend reporting
* leaderboard periods
* target calculations
* forecasting
* benchmarking
* rebuilding aggregates

---

# 69. Example Daily Aggregate

```typescript
interface SalesPerformanceDaily {
  id: string;

  organizationId: string;
  workspaceId: string;

  date: string;

  agentId?: string;
  teamId?: string;

  activityCount: number;

  effortScore: number;
  qualityScore: number;
  effectivenessScore: number;
  outcomeScore: number;
  revenueInfluence: number;

  calls: number;
  meetings: number;
  emails: number;
  messages: number;
  tasks: number;

  leadsQualified: number;
  opportunitiesCreated: number;
  opportunitiesAdvanced: number;
  dealsWon: number;

  pipelineCreated: number;
  revenueClosed: number;

  updatedAt: Timestamp;
}
```

---

# 70. Search Architecture

Firestore should remain the transactional system.

A search/index layer should support:

* activity search
* conversation search
* contact search
* account search
* deal search
* event search
* AI insight retrieval

Search dimensions:

* entity
* user
* team
* date
* event
* channel
* outcome
* score
* source

---

# 71. Analytics Architecture

Separate operational queries from analytical workloads.

## Operational analytics

Firestore read models.

## Historical analytics

Aggregated buckets.

## Advanced analytics

Analytics warehouse / analytical store where required.

## Real-time analytics

Incremental aggregate updates.

---

# 72. Analytics Metrics Dictionary

Every metric should have a formal definition.

Example:

### Connected Call Rate

```text
Connected calls
÷
Call attempts
```

### Meeting Conversion

```text
Meetings booked
÷
Qualified leads
```

### Pipeline Conversion

```text
Won opportunities
÷
Qualified opportunities
```

### Rep Productivity

```text
Meaningful outcomes
÷
Available productive hours
```

Metrics must never change meaning silently.

---

# 73. Reporting

Reports should include:

## Rep performance

## Team performance

## Target attainment

## Activity quality

## Pipeline execution

## Revenue attribution

## Forecast

## Coaching

## AI recommendations

## SLA performance

## Workforce capacity

---

# 74. Scheduled Reports

Support:

* daily summaries
* weekly team reports
* monthly executive reports
* quarterly performance reviews

Delivery:

* email
* SmartSapp notification
* downloadable PDF
* CSV/Excel
* webhook

---

# 75. Manager 1:1 Intelligence

Automatically generate:

## Weekly Rep Brief

```text
Performance: ↑ 8%

Strongest area:
Discovery

Weakest area:
Closing

Pipeline:
GHS 820k

Risk:
2 stalled opportunities

Target:
76%

Forecast:
88%

Suggested coaching:
Late-stage objection handling

Recommended discussion:
Three opportunities slipped after pricing discussions.
```

---

# 76. Intervention Center

Managers see:

### Critical

* quota risk
* high-value deal risk
* SLA breach
* rep performance collapse

### Warning

* declining conversion
* inactive leads
* workload overload

### Opportunity

* high-intent buyer
* fast-moving deal
* breakout rep

Each intervention supports:

**Review → Assign → Coach → Resolve → Dismiss**

---

# 77. Performance Alerts

Examples:

> John is 30% behind target.

> Proposal has been viewed 5 times.

> Opportunity has been stalled for 9 days.

> Rep activity is up 40%, but conversion is down 22%.

> New lead has not been contacted within SLA.

> AI predicts quota miss.

---

# 78. UI/UX Architecture

The experience should be role-specific.

## Seller

```text
My Day
My Work
My Leads
My Accounts
My Deals
My Meetings
My Performance
My Coaching
AI Assistant
```

## Manager

```text
Command Center
Team
Reps
Pipeline
Targets
Coaching
Interventions
AI Manager
```

## Revenue Leader

```text
Revenue
Forecast
Pipeline
Performance
Attribution
Benchmarking
Trends
```

## RevOps/Admin

```text
Policies
Scoring
Targets
Scorecards
Playbooks
Attribution
AI Governance
Integrations
```

---

# 79. Seller UI

## Primary layout

```text
┌───────────────────────────────────────────────┐
│ Good morning, Ama                 Target 82%  │
├───────────────────────────────────────────────┤
│ AI PRIORITIES                                  │
│ 1. Call Sunrise Academy                 HIGH   │
│ 2. Follow up on proposal                HIGH   │
│ 3. Prepare for 3PM meeting              MED    │
├───────────────────────┬───────────────────────┤
│ Today's meetings      │ Pipeline              │
│ 3                     │ GHS 820k              │
├───────────────────────┼───────────────────────┤
│ Tasks                 │ Performance            │
│ 12                    │ 84 / 100              │
└───────────────────────┴───────────────────────┘
```

---

# 80. Rep Detail Page

Sections:

### Overview

### Activity

### Performance

### Targets

### Pipeline

### Conversations

### Coaching

### AI Insights

### Workload

### History

---

# 81. Manager Dashboard UX

Use a layered hierarchy.

### Level 1

Executive KPIs.

### Level 2

Team health.

### Level 3

Exceptions.

### Level 4

Individual reps.

### Level 5

Underlying evidence.

No chart should require managers to navigate away to understand why it changed.

---

# 82. Rep Comparison

Support side-by-side comparison:

```text
Rep A
Performance 88
Target 93%
Pipeline 1.2m
Win rate 31%

Rep B
Performance 81
Target 76%
Pipeline 950k
Win rate 28%
```

But show contextual factors such as:

* tenure
* segment
* territory
* opportunity mix
* capacity

to avoid unfair comparisons.

---

# 83. Responsive Design

## Desktop

Full command center.

## Tablet

Two-column workspace.

## Mobile

Priority-first experience.

Mobile should emphasize:

* next action
* call
* message
* meeting
* task
* buyer signal
* deal risk

The current implementation already uses responsive container patterns and 44px interaction targets.

Maintain and extend this standard.

---

# 84. UI State Model

Every screen must support:

### Loading

Skeletons.

### Empty

Educational next action.

### Error

Recoverable error with action.

### Partial

Show available data and identify unavailable sections.

### Permission restricted

Explain why access is unavailable.

### AI processing

Explicit AI state.

### Stale data

Display data freshness timestamp.

---

# 85. Performance Settings

Replace the current basic point configuration panel with:

# Performance Policy Studio

Tabs:

### Scoring

### Targets

### Quality

### Scorecards

### Playbooks

### Attribution

### Leaderboards

### AI

### Governance

---

# 86. Scoring Builder UX

Visual builder:

```text
WHEN
[Meeting Completed]

IF
[Duration] > [30 min]
AND
[Outcome] = [Qualified]

AWARD
Effort [10]

QUALITY
+ [5]

CAP
[1 per opportunity per day]
```

Preview:

> 24 matching events this month.

Estimated impact:

> Score distribution would increase 7%.

---

# 87. Attribution Builder UX

Select:

```text
Attribution model
[Weighted]

First touch       20%
Discovery         25%
Demo              25%
Proposal          15%
Closing           15%
```

Show live examples before publishing.

---

# 88. Scorecard Builder

Support:

* question
* weight
* scoring method
* AI guidance
* evidence requirements
* call filters
* role
* methodology

AI can generate an initial scorecard, but the administrator reviews and publishes it.

Gong's current workflow explicitly supports AI-generated scorecards alongside templates and manually created scorecards; that is an appropriate pattern for SmartSapp's builder.

---

# 89. Data Governance

All performance records must be:

* tenant scoped
* permission checked
* audit logged
* timestamped
* attributable
* immutable where required

---

# 90. RBAC Model

Base permissions:

```text
sales.view_self
sales.view_team
sales.view_workspace
sales.manage_assignments
sales.manage_targets
sales.manage_scoring
sales.manage_scorecards
sales.manage_playbooks
sales.view_revenue
sales.view_forecast
sales.manage_attribution
sales.manage_ai
sales.export
sales.coach_team
sales.manage_workforce
```

---

# 91. Attribute-Based Access

RBAC alone is insufficient.

Policies must also consider:

* workspace
* team
* region
* territory
* manager relationship
* record ownership
* sensitive financial data

Example:

> Manager may view performance of direct and indirect reports but not another regional business unit.

---

# 92. Compensation-Safe Controls

If performance contributes to:

* bonuses
* commissions
* promotion
* payroll

the system must lock published periods.

Corrections require:

* adjustment reason
* approver
* timestamp
* audit record

AI cannot silently modify compensation-impacting records.

---

# 93. Audit Trail

Audit:

* score changes
* policy changes
* target changes
* attribution changes
* AI overrides
* performance adjustments
* rep reassignment
* data corrections

---

# 94. Billing and Credits

Sales Performance 2.0 should use SmartSapp's existing entitlement architecture.

Billing dimensions should not simply be “number of sales reps.”

Meterable resources may include:

### Seats

Active sales agents.

### AI usage

* AI summaries
* AI recommendations
* AI coaching
* AI roleplay
* AI research
* AI scorecards

### Conversation processing

* transcription minutes
* AI analysis minutes

### Automation

* sales plays
* AI-triggered actions

### Advanced analytics

* forecast
* attribution
* benchmarking

---

# 95. Example Packaging

## Sales Performance

* rep management
* targets
* activity
* basic scoring
* team dashboards

## Sales Intelligence

Adds:

* AI priorities
* deal intelligence
* buyer signals
* advanced analytics
* conversation intelligence

## Revenue Intelligence

Adds:

* forecast
* attribution
* revenue intelligence
* benchmark engine
* executive analytics

## AI Sales Workforce

Adds:

* AI coaching
* roleplay
* autonomous plays
* manager agent
* advanced AI automation

Actual SmartSapp pricing and credit quantities should remain configurable in the central billing system.

---

# 96. AI Credit Model

Usage examples:

```text
1 AI deal analysis = 1 credit

1 AI meeting analysis =
credits based on transcript duration

1 roleplay =
credits based on session length

1 AI recommendation batch =
credits based on context size

1 AI forecast refresh =
credits based on model complexity
```

Credits must never be deducted for failed jobs.

Retries due to platform failure should not consume user credits.

---

# 97. Credit Governance

Every credit transaction records:

```text
organization
workspace
user
feature
action
units
credits
timestamp
status
```

Provide:

> AI Usage → Feature → User → Period

analytics.

---

# 98. Feature Entitlements

Feature access should support:

```text
plan
role
workspace
feature flag
AI policy
credit balance
```

Example:

> AI autonomous plays enabled only for Enterprise workspaces.

---

# 99. API Architecture

Representative APIs:

```text
POST /sales/events
GET /sales/events
GET /sales/performance
GET /sales/agents/:id/performance
GET /sales/agents/:id/work
GET /sales/targets
POST /sales/targets
GET /sales/recommendations
POST /sales/recommendations/:id/accept
POST /sales/plays
POST /sales/plays/:id/execute
GET /sales/deals/:id/intelligence
GET /sales/conversations/:id/insights
GET /sales/coaching
GET /sales/attribution
GET /sales/forecast
```

---

# 100. Event API Requirements

POST `/sales/events`

Requirements:

* authenticated
* workspace scoped
* schema validated
* idempotent
* versioned
* asynchronous where appropriate

Response:

```json
{
  "eventId": "evt_123",
  "accepted": true,
  "processingStatus": "queued"
}
```

---

# 101. Background Processing

Use queues/background workers for:

* AI analysis
* aggregation
* scoring
* attribution
* forecasting
* search indexing
* notifications

The current non-blocking scoring approach should be retained and formalized.

---

# 102. Processing Pipeline

```text
Operational Action
       ↓
Event Validation
       ↓
Idempotency
       ↓
Persist Immutable Event
       ↓
Event Router
       ├── Performance
       ├── Buyer Signal
       ├── Lead Score
       ├── Deal Intelligence
       ├── Attribution
       ├── Automation
       └── Analytics
```

---

# 103. Failure Handling

Events should support:

```text
received
validated
queued
processing
processed
failed
dead_letter
replayed
```

Failed events must be replayable.

---

# 104. Observability

Track:

* event processing latency
* event failure rate
* duplicate rate
* scoring latency
* AI latency
* recommendation acceptance
* automation success
* aggregate freshness

---

# 105. AI Quality Metrics

Track:

### Recommendation acceptance

```text
accepted recommendations ÷ presented recommendations
```

### Recommendation outcome

```text
successful outcomes ÷ executed recommendations
```

### AI-assisted revenue

Revenue where AI significantly influenced an action.

### Coaching improvement

Performance before vs after coaching.

### Forecast accuracy

Predicted vs actual.

---

# 106. Machine Learning Feedback Loop

The system should learn from outcomes.

```text
Recommendation
↓
Human action
↓
Buyer response
↓
Outcome
↓
Revenue
↓
Model feedback
```

Models should learn organization-specific correlations while preserving privacy and tenant boundaries.

---

# 107. Ethical and Fair Performance Design

The platform must avoid interpreting activity blindly.

Performance comparisons should account for:

* territory
* segment
* lead quality
* tenure
* opportunity mix
* assigned capacity
* working hours

AI should explicitly warn:

> Comparison confidence is low because representatives have materially different opportunity mixes.

---

# 108. Performance Privacy

Organizations can choose:

### Private performance

Only rep + manager.

### Team-visible

Team metrics visible.

### Competitive

Leaderboard enabled.

### Executive-only

Detailed metrics restricted.

---

# 109. Notifications

Notification channels:

* in-app
* email
* SMS
* WhatsApp
* push
* Teams/webhook integrations where connected

Examples:

> High-value deal risk detected.

> Target attainment dropped below threshold.

> Buyer engagement increased.

> Coaching opportunity identified.

---

# 110. Notification Rules

Avoid notification overload.

Every notification has:

```text
importance
urgency
channel
frequency cap
quiet hours
recipient
```

AI may bundle low-priority notices into a digest.

---

# 111. Executive Experience

## Revenue Pulse

Displays:

```text
Revenue
Pipeline
Forecast
Quota
Win Rate
Velocity
Risk
```

## AI Executive Summary

> Revenue is projected 6% below quarterly target.
> Two segments explain 73% of the shortfall.
> The highest-risk pipeline concentration is in enterprise opportunities with low stakeholder coverage.

---

# 112. Manager AI Assistant

Sample prompts:

> Summarize my team's performance.

> Who needs attention?

> What should I coach this week?

> Which deals are slipping?

> Which reps are overloaded?

> Which activities correlate with wins?

> Prepare my weekly team meeting.

---

# 113. Rep AI Assistant

Sample prompts:

> What should I work on next?

> Prepare me for my 3 PM meeting.

> Summarize this account.

> Draft a follow-up.

> What objection should I anticipate?

> Why is this deal at risk?

> Help me handle the pricing objection.

---

# 114. Account Intelligence

The AI should compile:

```text
Account Summary
Stakeholders
Open Opportunities
Recent Interactions
Buyer Sentiment
Product Interest
Risk
Previous Outcomes
Recommended Strategy
```

---

# 115. Meeting Preparation

Before a meeting:

> **Meeting Brief**

Includes:

* account summary
* attendees
* prior conversation
* open opportunities
* previous objections
* buyer signals
* recommended questions
* target outcome

After the meeting:

> AI updates CRM + tasks + deal intelligence + follow-up.

---

# 116. Post-Meeting Automation

Meeting completion should trigger:

```text
Transcript available
↓
AI analysis
↓
Extract commitments
↓
Create tasks
↓
Update deal intelligence
↓
Update buyer score
↓
Generate follow-up draft
↓
Update performance
```

The existing SmartSapp architecture already links meeting lifecycle events with effort and revenue attribution, making this a natural extension.

---

# 117. Sales Methodology

Support organization-defined methodologies.

Examples:

* SPIN
* MEDDICC
* BANT
* Challenger
* custom SmartSapp framework

Methodology affects:

* scorecards
* coaching
* recommended actions
* playbooks
* quality scoring

---

# 118. Methodology Enforcement

AI can evaluate:

> Was the methodology followed?

But it should not penalize a rep unless the organization has explicitly enabled methodology-based scoring.

---

# 119. Sales Enablement Library

Connect coaching with content.

AI can recommend:

* sales scripts
* case studies
* product sheets
* objection guides
* videos
* training courses

This can connect directly to the wider SmartSapp Training/Membership ecosystem.

---

# 120. Sales Knowledge Graph

Build a reusable graph:

```text
Rep
 ↓
Skill
 ↓
Conversation
 ↓
Buyer Signal
 ↓
Outcome
 ↓
Revenue
```

This allows SmartSapp to learn:

> Which behaviors produce which outcomes?

---

# 121. Core Product KPIs

## Adoption

* weekly active reps
* daily active reps
* AI assistant usage
* work-queue completion

## Execution

* activity completion
* SLA compliance
* follow-up time

## Effectiveness

* meeting conversion
* opportunity conversion
* win rate

## Performance

* target attainment
* quality score
* productivity

## Revenue

* pipeline generated
* revenue influenced
* revenue closed
* forecast accuracy

## AI

* recommendation acceptance
* AI-assisted outcomes
* coaching improvement
* autonomous action success

---

# 122. Primary UX Metrics

The platform should optimize for:

### Time to first meaningful action

How long does it take for a rep to begin useful work?

### Time to insight

How quickly does a manager understand what changed?

### Time to intervention

How quickly can a manager act on risk?

### AI usefulness

Accepted recommendation rate.

### Friction

Clicks required to execute common sales actions.

---

# 123. Phase-by-Phase Implementation Plan

# Phase 0 — Architecture Integrity

### Objective

Make the existing module safe and reliable.

### Build

* unify ledger collection naming
* add workspace/organization to events
* partition aggregates
* eliminate `any`
* add event IDs
* add idempotency
* introduce canonical event type definitions
* separate human/system/AI activity
* introduce daily aggregates

### UX

No major redesign.

### Exit criteria

* zero cross-workspace leakage
* ledger works
* historical records accurate
* event duplication prevented
* automated tests passing

---

# Phase 1 — Sales Performance Core

### Objective

Move from activity points to multidimensional performance.

### Build

* SalesAgent
* SalesTeam
* PerformancePolicy
* PerformanceIndex
* effort/quality/effectiveness/outcome dimensions
* targets
* quotas
* time-based dashboards
* benchmark basics

### UX

New:

* Performance Overview
* Team Performance
* Rep Performance
* Targets

---

# Phase 2 — Seller Workspace

### Objective

Turn Sales Performance into an execution system.

### Build

* My Day
* My Work
* priority queue
* SLA
* workload
* next-best-action foundation
* activity execution surfaces

### UX

Default CRM sales landing page becomes:

> **My Day**

---

# Phase 3 — Manager Command Center

### Objective

Create operational sales management.

### Build

* team command center
* interventions
* performance health
* workload analytics
* target risk
* manager alerts
* 1:1 briefs

### UX

Manager dashboard with drill-down from:

> Organization → Team → Rep → Deal → Activity

---

# Phase 4 — Performance Policy Studio

### Objective

Make sales performance fully customizable.

### Build

* scoring builder
* conditions
* multipliers
* caps
* exclusions
* anti-gaming
* methodologies
* leaderboard policies

### UX

No-code visual policy builder.

---

# Phase 5 — Conversation Intelligence & Coaching

### Objective

Turn conversations into coaching data.

### Build

* transcript pipeline
* buying signals
* objection extraction
* sentiment
* scorecards
* AI call review
* coaching plans
* roleplay

The category benchmark from Gong validates this model of structured scorecards plus AI-assisted automatic review.

---

# Phase 6 — Deal & Buyer Intelligence

### Objective

Understand deal risk and buyer intent.

### Build

* deal health
* buyer signals
* stakeholder intelligence
* next-best-actions
* account intelligence
* meeting preparation
* post-meeting intelligence

---

# Phase 7 — Revenue Intelligence

### Objective

Connect sales activity to revenue.

### Build

* attribution engine
* revenue graph
* pipeline velocity
* forecast
* win/loss analysis
* revenue correlation
* executive reporting

---

# Phase 8 — Sales Orchestration

### Objective

Convert intelligence into repeatable action.

### Build

* plays
* play builder
* signal triggers
* AI-triggered actions
* escalation
* routing
* approvals
* governed autonomous workflows

Salesloft's current model of translating buyer signals into prioritized seller actions and structured Plays is a relevant benchmark for this phase.

---

# Phase 9 — AI Sales Workforce

### Objective

Create specialized AI agents.

### Build

* Prioritization Agent
* Deal Agent
* Coaching Agent
* Conversation Agent
* CRM Hygiene Agent
* Workload Agent
* Forecast Agent
* Manager Agent

### AI maturity

```text
Observe
→ Recommend
→ Prepare
→ Approve
→ Autonomously execute
```

---

# Phase 10 — Advanced Revenue Operating System

### Objective

Make SmartSapp predictive and continuously learning.

### Build

* organizational behavioral models
* predictive attainment
* predictive churn
* scenario simulations
* capacity planning
* AI revenue strategy
* advanced benchmarking
* autonomous intervention

Clari's current revenue-platform architecture provides a useful category benchmark for connecting pipeline, forecasting, deal signals and revenue strategy at this stage.

---

# 124. Phase Dependencies

```text
Phase 0
  ↓
Phase 1
  ↓
Phase 2 ─────┐
  ↓          │
Phase 3      │
  ↓          │
Phase 4      │
  └──────────┤
             ↓
Phase 5 → Phase 6
             ↓
          Phase 7
             ↓
          Phase 8
             ↓
          Phase 9
             ↓
          Phase 10
```

Phase 5+ should not become the excuse to postpone Phase 0–4 data integrity.

---

# 125. Engineering Workstreams

Development should run as parallel workstreams.

## Workstream A

Event Fabric.

## Workstream B

Performance Engine.

## Workstream C

Workforce.

## Workstream D

Seller Experience.

## Workstream E

Manager Experience.

## Workstream F

AI.

## Workstream G

Analytics.

## Workstream H

Governance.

## Workstream I

Billing.

---

# 126. Testing Strategy

## Unit tests

* scoring
* attribution
* targets
* policy rules
* event validation

## Integration tests

* CRM → event
* event → scoring
* meeting → AI
* proposal → buyer signal
* deal → revenue

## Tenant tests

Explicit cross-workspace access tests.

## AI tests

* hallucination
* unsupported recommendation
* confidence thresholds
* policy enforcement

## Load tests

* event ingestion
* aggregation
* dashboards
* AI queue

---

# 127. Security Requirements

Mandatory:

* tenant isolation
* least privilege
* encryption
* secure webhooks
* signed events
* rate limiting
* immutable audit trail
* sensitive-data controls
* AI context authorization

---

# 128. Data Retention

Policies must support:

* event retention
* transcript retention
* AI artifact retention
* analytics retention
* deletion requests

Retention policies should be configurable within organizational governance.

---

# 129. Migration from Current Sales Effort

Migration strategy:

### Step 1

Freeze current schema.

### Step 2

Create canonical event schema.

### Step 3

Migrate effort rules.

### Step 4

Rebuild user summaries as period-based aggregates.

### Step 5

Backfill historical events where trustworthy.

### Step 6

Validate totals.

### Step 7

Switch dashboards.

### Step 8

Retire legacy collections.

No destructive migration should occur without reconciliation reports.

---

# 130. Migration Mapping

Current:

```text
effortEvents
```

Target:

```text
salesEvents
```

Current:

```text
userEffortSummary
```

Target:

```text
salesDaily
salesWeekly
salesMonthly
salesAgentPerformance
```

Current:

```text
effortRules
```

Target:

```text
performancePolicies
performanceRules
```

---

# 131. Feature Flags

Every major feature should be independently flaggable:

```text
salesPerformanceV2
sellerWorkQueue
nextBestAction
salesCoaching
dealIntelligence
revenueAttribution
salesPlays
aiSalesAgents
autonomousSalesActions
```

---

# 132. Rollout Strategy

Use:

```text
Internal
↓
Pilot Workspace
↓
Selected Customers
↓
10%
↓
25%
↓
50%
↓
100%
```

Monitor:

* errors
* event lag
* scoring discrepancies
* adoption
* AI acceptance
* performance impact

---

# 133. Definition of Done — Platform

The module is production-ready only when:

* tenant isolation is proven
* events are idempotent
* scoring is reproducible
* historical totals reconcile
* metrics have definitions
* AI is governed
* performance is explainable
* permissions are tested
* UI supports all required states
* monitoring exists
* billing is enforceable

---

# 134. Definition of Done — User Experience

A sales representative should be able to:

1. Open SmartSapp.
2. See their highest-priority work.
3. Understand why each item matters.
4. Execute it without unnecessary navigation.
5. See the resulting buyer signal.
6. Receive AI assistance.
7. Track target progress.
8. Understand their strengths and weaknesses.
9. Practice a weak sales skill.
10. See how their work influences outcomes.

---

# 135. Definition of Done — Manager

A manager should be able to:

1. Understand team health immediately.
2. Find at-risk reps.
3. Find at-risk deals.
4. Understand why performance changed.
5. Compare fairly.
6. Review conversations.
7. Assign coaching.
8. Intervene on deals.
9. Rebalance workloads.
10. Forecast target attainment.

---

# 136. Definition of Done — Executive

An executive should be able to:

1. See revenue.
2. See forecast.
3. See pipeline.
4. See performance.
5. Understand drivers.
6. Identify risks.
7. Compare teams and segments.
8. Understand attribution.
9. Ask AI questions.
10. Make decisions without spreadsheet reconstruction.

---

# 137. Strategic Differentiation

SmartSapp should not attempt to become merely another:

* activity tracker
* leaderboard
* sales dialer
* conversation intelligence application
* forecasting application

Its differentiation should be:

> **An integrated sales intelligence operating layer embedded directly inside the CRM and connected to the entire SmartSapp customer journey.**

The platform can connect:

```text
Campaign
↓
QR
↓
Landing Page
↓
Form
↓
Lead
↓
Communication
↓
Meeting
↓
Conversation
↓
Opportunity
↓
Proposal
↓
Contract
↓
Invoice
↓
Payment
↓
Customer
```

and then ask:

> Which human actions, buyer behaviors and system interventions actually produced the outcome?

That becomes a much stronger long-term moat than simple activity scoring.

---

# 138. Target End-State

The finished SmartSapp experience should feel like:

### For the rep

> “SmartSapp runs my selling day.”

### For the manager

> “SmartSapp runs my team's performance system.”

### For RevOps

> “SmartSapp runs my sales operating policies.”

### For the executive

> “SmartSapp explains the revenue machine.”

### For AI

> “SmartSapp has enough context to recommend and, under governance, execute the next best action.”

---

# 139. Final Product Structure

The finished navigation should be:

```text
SALES
│
├── Command Center
├── My Day
├── Work Queue
├── Leads
├── Accounts
├── Opportunities
├── Activities
├── Meetings
├── Conversations
│
├── PERFORMANCE
│   ├── Overview
│   ├── Team
│   ├── Reps
│   ├── Targets
│   ├── Leaderboard
│   └── Benchmarks
│
├── INTELLIGENCE
│   ├── AI Insights
│   ├── Next Best Action
│   ├── Buyer Signals
│   ├── Deal Intelligence
│   ├── Revenue Intelligence
│   └── Forecast
│
├── COACHING
│   ├── Scorecards
│   ├── Coaching
│   ├── Practice Lab
│   └── Methodologies
│
├── PLAYS
│   ├── Active Plays
│   ├── Play Library
│   └── Play Builder
│
└── ADMINISTRATION
    ├── Workforce
    ├── Performance Policies
    ├── Scoring
    ├── Targets
    ├── Scorecards
    ├── Attribution
    ├── AI Governance
    ├── Billing & Credits
    └── Audit
```

# 140. Final Strategic Recommendation

The existing **Sales Effort & Productivity** module should be retained as the foundation but should no longer be treated as the final product architecture.

The target hierarchy should be:

**Sales Effort**
↓
**Sales Performance**
↓
**Sales Productivity**
↓
**Sales Intelligence**
↓
**Revenue Intelligence**
↓
**AI Sales Workforce**

The most important architectural decision is to establish the **canonical SmartSapp Event Fabric + Sales Intelligence Graph** before aggressively layering on AI. The current implementation already has the beginnings of this event-driven approach, but its ledger mismatch, tenant-scoping defects, lifetime-only aggregates and undifferentiated automated/system effort make foundational remediation necessary.

The strongest current category patterns are likewise converging on the same direction: AI-prioritized seller workflows from Salesloft, structured AI-assisted conversation scoring/coaching from Gong, and unified pipeline/forecast/revenue intelligence from Clari.

SmartSapp's opportunity is to combine those capabilities **inside one CRM-native operating system**, while extending them across SmartSapp's campaigns, forms, meetings, messaging, documents, automations, billing and customer lifecycle.

That should be the strategic definition of **SmartSapp Sales Performance & Intelligence 2.0**.
