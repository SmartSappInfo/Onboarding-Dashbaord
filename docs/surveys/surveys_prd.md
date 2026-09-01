# SmartSapp Surveys 2.0 — Full Product Requirements & Technical Architecture

**Document type:** Product Requirements Document + Target Architecture
**Product:** SmartSapp CRM
**Module:** Surveys 2.0 / Survey Intelligence Platform
**Status:** Target-state architecture
**Implementation:** Phase 0 → Phase 9
**Primary stack:** Next.js, TypeScript, Firebase/Firestore, Firebase Storage, Firebase Authentication, SmartSapp CRM/Automation infrastructure
**Architecture principle:** Multi-tenant, event-driven, CRM-aware, AI-assisted, analytics-first

---

# 1. Executive Summary

SmartSapp Surveys 2.0 will evolve the existing Surveys module from a capable survey/form builder into a **full survey management, research, customer-experience, assessment, analytics and AI intelligence platform embedded inside SmartSapp CRM**.

The current implementation already provides a strong foundation: a public survey runtime, visual builder, conditional logic, scoring, result pages, file uploads, CRM/entity matching, deal routing, tags, automation, attribution, field-team analytics, AI generation, AI modification and natural-language response analysis. 

The current system also already supports multi-tenant isolation, encrypted identity tokens, dynamic CRM variables, multiple presentation modes, conditional logic and post-submission automation. 

The strategic objective for Surveys 2.0 is therefore **not to replace the existing module**, but to establish a stronger domain architecture around it.

The target product becomes:

> **SmartSapp Survey Intelligence — a unified platform for designing, distributing, collecting, analyzing and activating structured customer, employee, parent, student, market and operational intelligence.**

The platform will support:

* traditional surveys
* NPS
* CSAT
* CES
* polls
* assessments
* quizzes
* evaluations
* audits
* inspections
* research studies
* customer feedback
* employee engagement
* lead qualification
* enrollment research
* customer health
* field research
* CRM-triggered surveys
* longitudinal survey programs
* AI-generated surveys
* AI response analysis
* AI research assistance
* predictive intelligence

The most important architectural shift is to separate:

```text
Survey Definition
Survey Version
Deployment
Audience
Session
Response
Answer
Event
Analytics
Insight
Automation
Experiment
Report
```

rather than allowing the `Survey` document to carry responsibility for all of these concerns.

---

# 2. Product Vision

## 2.1 Vision

Build the intelligence layer through which SmartSapp can continuously understand:

* what customers think
* why they think it
* how sentiment changes
* which segments behave differently
* where experience breaks down
* which CRM records require attention
* what action should happen next

The survey should therefore become a **data-generation mechanism for SmartSapp's broader CRM intelligence architecture**.

---

# 3. Strategic Positioning

SmartSapp Surveys 2.0 should compete conceptually across several categories:

### Survey platform

Create and distribute surveys.

### Experience management

Measure satisfaction, loyalty and customer experience.

### Research platform

Conduct structured research and longitudinal studies.

### Assessment engine

Score and evaluate respondents.

### Feedback platform

Collect qualitative and quantitative feedback.

### CRM intelligence layer

Connect survey responses to contacts, leads, entities and deals.

### AI intelligence platform

Transform response data into insights and recommendations.

---

# 4. Core Product Principles

## 4.1 Multi-tenant by default

Every survey-related resource must belong to a workspace/tenant.

No operation may depend solely on an object ID.

All access paths must establish:

```text
organizationId
workspaceId
resourceId
userId
```

The current implementation already enforces tenant boundaries using workspace matching across queries, security rules and server actions. 

---

## 4.2 Version everything that affects response interpretation

Once a survey is published, its interpretation contract is immutable.

A response must always be attributable to:

```text
surveyId
surveyVersionId
deploymentId
```

This guarantees historical reproducibility.

---

## 4.3 Events are first-class data

Every meaningful survey interaction should produce a canonical event.

This allows:

* funnel analytics
* abandonment analysis
* attribution
* auditing
* automation
* AI analysis
* behavioral intelligence

---

## 4.4 Analytics must not depend on scanning raw responses

Raw responses are transactional data.

Analytics must use derived aggregates.

---

## 4.5 AI interprets data; it does not become the source of truth

AI must operate against validated datasets and structured analytics queries.

AI output must contain:

* evidence
* source data
* filters
* confidence
* model metadata
* timestamp

---

## 4.6 CRM integration is bidirectional

The relationship is:

```text
CRM → Survey
Survey → CRM
```

not merely survey submission → CRM update.

---

# 5. Target Capability Map

```text
SmartSapp Surveys 2.0
│
├── Survey Management
│   ├── Surveys
│   ├── Projects
│   ├── Versions
│   ├── Templates
│   └── Question Bank
│
├── Survey Studio
│   ├── Questions
│   ├── Sections
│   ├── Logic
│   ├── Scoring
│   ├── Outcomes
│   └── Themes
│
├── Distribution
│   ├── Web
│   ├── Embed
│   ├── QR
│   ├── Email
│   ├── SMS
│   ├── WhatsApp
│   ├── Kiosk
│   └── Field
│
├── Response Engine
│   ├── Sessions
│   ├── Responses
│   ├── Answers
│   ├── Events
│   └── Quality
│
├── Analytics
│   ├── Overview
│   ├── Questions
│   ├── Funnels
│   ├── Segments
│   ├── Cross-tabs
│   ├── Trends
│   └── Benchmarks
│
├── Intelligence
│   ├── Sentiment
│   ├── Themes
│   ├── AI Insights
│   ├── Anomalies
│   └── Recommendations
│
├── CRM
│   ├── Contacts
│   ├── Leads
│   ├── Entities
│   ├── Deals
│   ├── Tasks
│   └── Timeline
│
├── Automation
│   ├── Triggers
│   ├── Conditions
│   ├── Actions
│   └── Executions
│
├── Research
│   ├── Projects
│   ├── Waves
│   ├── Cohorts
│   ├── Experiments
│   └── Benchmarks
│
└── Governance
    ├── Permissions
    ├── Audit
    ├── Privacy
    ├── Retention
    └── Billing
```

---

# 6. Target Domain Model

## 6.1 Workspace

The workspace is the fundamental tenant boundary.

```text
Workspace
├── workspaceId
├── organizationId
├── name
├── timezone
├── defaultLocale
├── settings
├── surveySettings
├── branding
├── createdAt
└── updatedAt
```

---

# 7. Survey Project

A Project groups related surveys and survey waves.

Examples:

```text
2026 Parent Experience Study
2026 Employee Engagement Study
Enrollment Research
Customer Satisfaction Program
```

### Schema

```ts
interface SurveyProject {
  id: string;
  workspaceId: string;
  organizationId: string;

  name: string;
  description?: string;

  projectType:
    | "research"
    | "experience"
    | "assessment"
    | "feedback"
    | "engagement"
    | "custom";

  ownerId: string;

  status:
    | "draft"
    | "active"
    | "paused"
    | "completed"
    | "archived";

  startDate?: Timestamp;
  endDate?: Timestamp;

  surveyIds: string[];

  tags: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 8. Survey

The Survey becomes the stable logical identity.

```ts
interface Survey {
  id: string;

  workspaceId: string;
  organizationId: string;

  projectId?: string;

  internalName: string;
  title: string;
  description?: string;

  surveyType: SurveyType;

  status: SurveyStatus;

  currentDraftVersionId?: string;
  publishedVersionId?: string;

  ownerId: string;

  defaultLocale: string;
  supportedLocales: string[];

  defaultThemeId?: string;

  settings: SurveySettings;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
}
```

### Survey types

```ts
type SurveyType =
  | "feedback"
  | "nps"
  | "csat"
  | "ces"
  | "poll"
  | "assessment"
  | "quiz"
  | "evaluation"
  | "research"
  | "audit"
  | "inspection"
  | "registration"
  | "intake"
  | "lead_qualification"
  | "customer_health"
  | "employee_engagement"
  | "market_research"
  | "custom";
```

---

# 9. Survey Version

This is one of the most important additions.

```ts
interface SurveyVersion {
  id: string;

  surveyId: string;
  workspaceId: string;

  versionNumber: number;

  status:
    | "draft"
    | "in_review"
    | "approved"
    | "published"
    | "superseded";

  locale: string;

  sections: SurveySection[];

  questions: SurveyQuestion[];

  logicRules: LogicRule[];

  scoreDefinitions: ScoreDefinition[];

  outcomeDefinitions: OutcomeDefinition[];

  resultPageId?: string;

  themeId?: string;

  checksum: string;

  createdBy: string;
  approvedBy?: string;
  publishedBy?: string;

  createdAt: Timestamp;
  approvedAt?: Timestamp;
  publishedAt?: Timestamp;
}
```

---

# 10. Survey Section

```ts
interface SurveySection {
  id: string;

  surveyVersionId: string;

  title?: string;
  description?: string;

  order: number;

  renderAsPage: boolean;

  validateBeforeNext: boolean;

  navigation:
    | "next"
    | "auto"
    | "free";

  questionIds: string[];
}
```

---

# 11. Survey Question

```ts
interface SurveyQuestion {
  id: string;

  surveyVersionId: string;

  questionType: QuestionType;

  key: string;

  title: string;

  description?: string;

  helpText?: string;

  required: boolean;

  order: number;

  sectionId: string;

  options?: QuestionOption[];

  validation?: ValidationRule[];

  display?: QuestionDisplaySettings;

  logic?: QuestionLogicReference[];

  scoring?: QuestionScoringConfig;

  crmMapping?: CRMFieldMapping;

  metadata?: Record<string, unknown>;
}
```

---

# 12. Question Types

The target architecture should support:

### Text

* short text
* long text
* email
* phone
* URL

### Numeric

* number
* currency
* percentage

### Date

* date
* time
* datetime

### Choice

* single choice
* multiple choice
* dropdown
* searchable dropdown
* yes/no
* image choice

### Rating

* stars
* numeric scale
* slider
* NPS
* CSAT
* CES

### Matrix

* Likert
* matrix
* semantic differential

### Ranking

* ranking
* drag-and-drop ranking

### Media

* image
* audio
* video
* file upload

### Advanced

* address
* location
* signature
* barcode
* QR
* calculated field

### Research

* max-diff
* constant sum
* conjoint/choice experiment

---

# 13. Question Bank

```ts
interface QuestionBankItem {
  id: string;

  workspaceId?: string;

  visibility:
    | "private"
    | "workspace"
    | "system";

  questionType: QuestionType;

  questionText: string;

  description?: string;

  category: string;

  industry?: string;

  metric?: string;

  tags: string[];

  benchmarkId?: string;

  translations?: Record<string, string>;

  version: number;

  createdBy?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

System question libraries can include:

* NPS
* parent satisfaction
* employee engagement
* customer service
* enrollment experience
* payment experience
* school communication
* child safety
* academic satisfaction

---

# 14. Logic Rule

The existing engine already supports operators such as equality, containment, emptiness and numerical comparisons, together with actions including jump, require, show, hide and disable submit. 

Surveys 2.0 should formalize this as:

```ts
interface LogicRule {
  id: string;

  surveyVersionId: string;

  priority: number;

  conditions: LogicCondition[];

  conditionOperator: "AND" | "OR";

  actions: LogicAction[];

  enabled: boolean;
}
```

### Conditions

```ts
interface LogicCondition {
  sourceQuestionId: string;

  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "is_empty"
    | "is_not_empty"
    | "greater_than"
    | "less_than"
    | "greater_than_or_equal"
    | "less_than_or_equal"
    | "between";

  value?: unknown;
}
```

### Actions

```ts
type LogicAction =
  | ShowAction
  | HideAction
  | JumpAction
  | RequireAction
  | DisableSubmitAction
  | SetValueAction
  | EndSurveyAction
  | TriggerOutcomeAction;
```

---

# 15. Scoring Model

```ts
interface ScoreDefinition {
  id: string;

  surveyVersionId: string;

  name: string;

  metricType:
    | "points"
    | "percentage"
    | "weighted"
    | "category"
    | "composite"
    | "benchmark";

  maxScore?: number;

  weights?: Record<string, number>;

  categoryDefinitions?: ScoreCategory[];

  calculationExpression?: string;
}
```

---

# 16. Score Result

```ts
interface ScoreResult {
  responseId: string;

  scores: {
    scoreDefinitionId: string;
    value: number;
    percentage?: number;
    percentile?: number;
  }[];

  overallScore?: number;

  calculatedAt: Timestamp;
}
```

---

# 17. Outcome Definition

```ts
interface OutcomeDefinition {
  id: string;

  surveyVersionId: string;

  name: string;

  priority: number;

  conditions: LogicCondition[];

  scoreRange?: {
    min?: number;
    max?: number;
  };

  resultPageId?: string;

  tags?: string[];

  crmActions?: CRMAction[];

  automationIds?: string[];

  recommendation?: string;
}
```

---

# 18. Result Page

The current implementation already has a modular result page builder with blocks including headings, text, media, buttons, score cards, lists, logos and outcome categories. 

Surveys 2.0 retains this capability but makes result pages version-aware.

```ts
interface ResultPage {
  id: string;

  surveyVersionId: string;

  name: string;

  isDefault: boolean;

  blocks: ResultBlock[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 19. Deployment

A deployment represents a specific distribution instance.

```ts
interface SurveyDeployment {
  id: string;

  workspaceId: string;

  surveyId: string;
  surveyVersionId: string;

  name: string;

  channel:
    | "web"
    | "embed"
    | "modal"
    | "qr"
    | "email"
    | "sms"
    | "whatsapp"
    | "kiosk"
    | "field";

  campaignId?: string;

  audienceId?: string;

  fieldAgentId?: string;

  status:
    | "draft"
    | "scheduled"
    | "active"
    | "paused"
    | "closed";

  startsAt?: Timestamp;
  endsAt?: Timestamp;

  quotas?: QuotaDefinition[];

  attribution?: AttributionConfig;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

This formalizes the current tracking-link capability, which currently uses encrypted `?ref=` tokens and field-team yield analytics. 

---

# 20. Audience

```ts
interface SurveyAudience {
  id: string;

  workspaceId: string;

  name: string;

  type:
    | "crm_segment"
    | "contacts"
    | "entities"
    | "uploaded"
    | "public"
    | "field_assignment";

  sourceId?: string;

  estimatedSize?: number;

  filters?: AudienceFilter[];

  createdAt: Timestamp;
}
```

---

# 21. Session

Sessions track the respondent journey.

```ts
interface SurveySession {
  id: string;

  workspaceId: string;

  surveyId: string;
  surveyVersionId: string;

  deploymentId?: string;

  respondentId?: string;
  entityId?: string;

  sessionTokenHash: string;

  status:
    | "created"
    | "started"
    | "in_progress"
    | "completed"
    | "abandoned"
    | "expired";

  currentSectionId?: string;

  currentQuestionId?: string;

  startedAt?: Timestamp;
  completedAt?: Timestamp;
  lastActivityAt: Timestamp;

  device?: DeviceMetadata;

  attribution?: AttributionData;
}
```

---

# 22. Response

```ts
interface SurveyResponse {
  id: string;

  workspaceId: string;

  surveyId: string;
  surveyVersionId: string;

  deploymentId?: string;
  sessionId?: string;

  respondent: RespondentReference;

  answers: Answer[];

  scores: ScoreResult[];

  outcome?: OutcomeResult;

  quality: ResponseQuality;

  crm: CRMResponseLink;

  ai?: AIResponseAnalysisReference;

  submittedAt: Timestamp;

  createdAt: Timestamp;
}
```

---

# 23. Respondent Reference

```ts
interface RespondentReference {
  mode:
    | "anonymous"
    | "confidential"
    | "identified"
    | "crm_linked";

  contactId?: string;
  entityId?: string;

  name?: string;
  email?: string;
  phone?: string;

  externalReference?: string;
}
```

---

# 24. Answer

```ts
interface Answer {
  questionId: string;

  questionKey: string;

  value: unknown;

  displayValue?: string;

  answeredAt: Timestamp;

  source:
    | "respondent"
    | "crm_variable"
    | "calculated"
    | "system";

  metadata?: Record<string, unknown>;
}
```

---

# 25. Response Quality

```ts
interface ResponseQuality {
  score: number;

  status:
    | "valid"
    | "suspect"
    | "review"
    | "rejected";

  signals: QualitySignal[];

  evaluatedAt: Timestamp;
}
```

Potential signals:

* completion speed
* duplicate identity
* duplicate device
* suspicious IP
* straight-lining
* bot behavior
* repeated submissions
* invalid contact information

---

# 26. Survey Event

```ts
interface SurveyEvent {
  id: string;

  workspaceId: string;

  surveyId: string;
  surveyVersionId?: string;

  deploymentId?: string;
  sessionId?: string;
  responseId?: string;

  eventType: SurveyEventType;

  actorType:
    | "respondent"
    | "user"
    | "system"
    | "ai"
    | "automation";

  actorId?: string;

  occurredAt: Timestamp;

  metadata?: Record<string, unknown>;

  correlationId?: string;
}
```

---

# 27. Event Taxonomy

## Survey lifecycle

```text
SURVEY_CREATED
SURVEY_UPDATED
SURVEY_ARCHIVED
SURVEY_DELETED
SURVEY_VERSION_CREATED
SURVEY_VERSION_SUBMITTED_FOR_REVIEW
SURVEY_VERSION_APPROVED
SURVEY_PUBLISHED
SURVEY_PAUSED
SURVEY_RESUMED
SURVEY_CLOSED
```

## Distribution

```text
SURVEY_DEPLOYMENT_CREATED
SURVEY_DEPLOYMENT_ACTIVATED
SURVEY_DEPLOYMENT_PAUSED
SURVEY_DEPLOYMENT_CLOSED
SURVEY_LINK_CREATED
SURVEY_QR_CREATED
```

## Respondent

```text
SURVEY_VIEWED
SURVEY_STARTED
SURVEY_SECTION_VIEWED
SURVEY_QUESTION_VIEWED
SURVEY_QUESTION_ANSWERED
SURVEY_QUESTION_CHANGED
SURVEY_VALIDATION_FAILED
SURVEY_FILE_UPLOADED
SURVEY_PAUSED_BY_RESPONDENT
SURVEY_RESUMED
SURVEY_ABANDONED
SURVEY_COMPLETED
SURVEY_SUBMITTED
SURVEY_RESULT_VIEWED
SURVEY_CTA_CLICKED
```

## Scoring

```text
SURVEY_SCORE_CALCULATED
SURVEY_OUTCOME_RESOLVED
```

## CRM

```text
SURVEY_ENTITY_MATCHED
SURVEY_CONTACT_MATCHED
SURVEY_ENTITY_CREATED
SURVEY_CONTACT_CREATED
SURVEY_CRM_FIELD_UPDATED
SURVEY_TAG_ADDED
SURVEY_TAG_REMOVED
SURVEY_DEAL_CREATED
SURVEY_DEAL_UPDATED
SURVEY_DEAL_STAGE_CHANGED
```

## AI

```text
SURVEY_AI_GENERATION_STARTED
SURVEY_AI_GENERATION_COMPLETED
SURVEY_AI_ANALYSIS_STARTED
SURVEY_AI_ANALYSIS_COMPLETED
SURVEY_AI_SENTIMENT_CLASSIFIED
SURVEY_AI_THEME_DETECTED
SURVEY_AI_ANOMALY_DETECTED
SURVEY_AI_INSIGHT_CREATED
SURVEY_AI_RECOMMENDATION_CREATED
```

## Automation

```text
SURVEY_AUTOMATION_TRIGGERED
SURVEY_AUTOMATION_COMPLETED
SURVEY_AUTOMATION_FAILED
SURVEY_NOTIFICATION_SENT
SURVEY_WEBHOOK_SENT
```

---

# 28. Event Envelope

All events should use a common SmartSapp event envelope.

```ts
interface SmartSappEvent<T = unknown> {
  eventId: string;

  eventType: string;

  version: string;

  organizationId: string;
  workspaceId: string;

  occurredAt: Timestamp;

  actor?: {
    type: string;
    id?: string;
  };

  source: string;

  correlationId: string;

  causationId?: string;

  payload: T;
}
```

This enables the Surveys subsystem to integrate cleanly with the rest of SmartSapp.

---

# 29. Survey State Machines

## 29.1 Survey lifecycle

```text
DRAFT
  ↓
IN_REVIEW
  ├── reject → DRAFT
  ↓
APPROVED
  ↓
SCHEDULED
  ↓
PUBLISHED
  ├── pause → PAUSED
  │             ↓
  │          PUBLISHED
  │
  └── close → CLOSED
                 ↓
              ARCHIVED
```

---

# 30. Survey Version State Machine

```text
DRAFT
 ↓
IN_REVIEW
 ├── REJECTED → DRAFT
 ↓
APPROVED
 ↓
PUBLISHED
 ↓
SUPERSEDED
```

Published versions cannot be mutated.

---

# 31. Deployment State Machine

```text
DRAFT
 ↓
SCHEDULED
 ↓
ACTIVE
 ├── PAUSED
 │     ↓
 │   ACTIVE
 │
 └── CLOSED
```

---

# 32. Session State Machine

```text
CREATED
 ↓
STARTED
 ↓
IN_PROGRESS
 ├── PAUSED
 │     ↓
 │   IN_PROGRESS
 │
 ├── ABANDONED
 │
 └── COMPLETED
```

---

# 33. Response State Machine

```text
RECEIVED
 ↓
VALIDATING
 ↓
VALIDATED
 ├── QUALITY_REVIEW
 │      ├── VALID
 │      └── REJECTED
 │
 ↓
PROCESSING
 ↓
PROCESSED
 ↓
ANALYZING
 ↓
ANALYZED
```

---

# 34. Automation Execution State Machine

```text
QUEUED
 ↓
RUNNING
 ├── RETRYING
 │      ↓
 │    RUNNING
 │
 ├── FAILED
 │
 └── COMPLETED
```

---

# 35. Processing Architecture

The overall system should use an event-driven pipeline:

```text
                  PUBLIC RUNTIME
                       │
                       ▼
                 SESSION SERVICE
                       │
                       ▼
                 RESPONSE API
                       │
                       ▼
              RESPONSE VALIDATION
                       │
             ┌─────────┼──────────┐
             ▼         ▼          ▼
          Scoring    CRM       Events
             │         │          │
             ▼         ▼          ▼
         Outcomes   Matching   Event Bus
             │         │          │
             └─────────┼──────────┘
                       ▼
               ANALYTICS PIPELINE
                       │
            ┌──────────┼───────────┐
            ▼          ▼           ▼
         Metrics    Segments       AI
            │          │           │
            └──────────┼───────────┘
                       ▼
                   INSIGHTS
                       │
                       ▼
                 AUTOMATION
                       │
                       ▼
                     CRM
```

---

# 36. Submission Processing Pipeline

When a respondent submits:

### Step 1 — Validate request

Validate:

* deployment
* survey version
* session
* payload
* required questions
* allowed options
* upload references
* security token

### Step 2 — Prevent replay

Validate:

```text
sessionToken
submissionToken
idempotencyKey
```

### Step 3 — Persist raw response

Store immutable submission.

### Step 4 — Calculate scores

Execute deterministic scoring.

### Step 5 — Resolve outcome

Evaluate outcome rules.

### Step 6 — Resolve identity

Run CRM matching.

The existing system already has a four-tier identity/deduplication process. 

### Step 7 — Emit event

```text
SURVEY_SUBMITTED
```

### Step 8 — Trigger downstream processors

* analytics
* AI
* CRM
* automation
* notifications

### Step 9 — Return result

The respondent should not wait for every downstream process.

---

# 37. Synchronous vs asynchronous processing

## Synchronous

Must complete before submission succeeds:

* schema validation
* required-field validation
* answer validation
* score calculation
* outcome resolution
* basic identity validation
* response persistence

## Asynchronous

Should execute after submission:

* sentiment analysis
* theme extraction
* AI summary
* analytics aggregation
* CRM enrichment
* notifications
* webhook delivery
* automation
* anomaly detection

This prevents AI or external systems from slowing the respondent experience.

---

# 38. Analytics Architecture

The analytics system should consist of:

```text
Raw Events
    ↓
Event Processor
    ↓
Aggregation Jobs
    ↓
Analytics Collections
    ↓
Analytics API
    ↓
Dashboard
```

---

# 39. Analytics Dimensions

Every analytical record should support dimensions such as:

```text
survey
version
project
deployment
channel
campaign
date
time
respondent type
CRM segment
entity
campus
location
field agent
question
question category
outcome
score band
sentiment
theme
```

---

# 40. Analytics Measures

### Volume

* views
* starts
* responses
* completions
* submissions

### Funnel

* view → start
* start → completion
* completion → submission

### Time

* average completion time
* median completion time
* question dwell time

### Scores

* average
* median
* minimum
* maximum
* distribution
* percentile

### Experience

* NPS
* CSAT
* CES

### CRM

* leads created
* leads converted
* deals created
* deals won
* pipeline value influenced

---

# 41. Analytics Aggregate Schema

```ts
interface SurveyMetricAggregate {
  workspaceId: string;

  surveyId: string;

  surveyVersionId?: string;

  deploymentId?: string;

  date: string;

  dimensions: Record<string, string>;

  metrics: {
    views?: number;
    starts?: number;
    completions?: number;
    submissions?: number;

    completionRate?: number;

    averageScore?: number;

    nps?: number;

    csat?: number;

    ces?: number;
  };

  updatedAt: Timestamp;
}
```

---

# 42. Question Analytics

```ts
interface QuestionAnalytics {
  surveyId: string;
  surveyVersionId: string;

  questionId: string;

  responseCount: number;

  responseRate: number;

  distribution?: Record<string, number>;

  numericStats?: {
    average: number;
    median: number;
    min: number;
    max: number;
    standardDeviation?: number;
  };

  textStats?: {
    averageLength: number;
    sentimentDistribution?: Record<string, number>;
    themeDistribution?: Record<string, number>;
  };
}
```

---

# 43. Cross-tab Engine

Cross-tabs are essential for a mature research platform.

Query structure:

```text
Dimension
×
Measure
×
Filter
×
Time period
```

Example:

```text
Metric:
Average Satisfaction

Rows:
Campus

Columns:
Parent Type

Filter:
Survey = Parent Satisfaction
```

Result:

```text
             New Parent   Existing Parent
Campus A         82             87
Campus B         68             74
Campus C         91             89
```

---

# 44. Segmentation Engine

```ts
interface SurveySegment {
  id: string;

  workspaceId: string;

  name: string;

  description?: string;

  source:
    | "survey"
    | "crm"
    | "hybrid";

  rules: SegmentRule[];

  dynamic: boolean;

  createdAt: Timestamp;
}
```

Example:

```text
NPS <= 6
AND
Parent Type = Existing
AND
Campus = Campus B
```

---

# 45. Funnel Analytics

The system should automatically produce:

```text
Views
 ↓
Starts
 ↓
Section 1
 ↓
Section 2
 ↓
Question 5
 ↓
Question 10
 ↓
Completion
 ↓
Submission
```

This identifies abandonment at question-level granularity.

---

# 46. Cohort Analytics

Support:

```text
First response month
Enrollment year
Customer lifecycle
Parent tenure
Campaign
Campus
Product adoption
```

Then compare cohorts over time.

---

# 47. Longitudinal Research

Projects can contain survey waves:

```text
Project
│
├── Wave 1 — January
├── Wave 2 — April
├── Wave 3 — July
└── Wave 4 — October
```

AI can identify:

* improving themes
* deteriorating themes
* persistent problems
* new issues
* segment shifts

---

# 48. Benchmark Architecture

Benchmarks can be:

```text
internal
workspace
organization
industry
historical
project
```

Example:

```text
Current NPS: +42
Previous Wave: +34
Organization Benchmark: +39
```

---

# 49. AI Architecture

The existing AI architecture uses three generation phases—blueprint, questions, then logic/scoring—to avoid LLM token exhaustion and gateway timeouts. 

Retain that architecture.

Expand AI into:

```text
AI Survey Builder
AI Survey Reviewer
AI Question Optimizer
AI Response Analyst
AI Research Assistant
AI Insight Engine
AI Recommendation Engine
AI CRM Action Assistant
```

---

# 50. AI Survey Generator

Input:

```text
Natural language
URL
PDF
Document
Image
Existing survey
```

Pipeline:

```text
Source
 ↓
Document understanding
 ↓
Research objective
 ↓
Blueprint
 ↓
Question generation
 ↓
Logic/scoring
 ↓
Quality validation
 ↓
Survey draft
```

---

# 51. AI Survey Reviewer

Before publication:

```text
AI Review
```

checks:

* leading questions
* double-barreled questions
* ambiguity
* redundant questions
* excessive survey length
* inconsistent scales
* missing demographic variables
* poor branching
* bias
* inaccessible wording

Output:

```text
Critical
Warning
Suggestion
```

---

# 52. AI Question Optimizer

Example:

> “Make this question less leading.”

AI proposes alternatives.

But the system should preserve the original.

```text
Original
Variant A
Variant B
Variant C
```

The user explicitly chooses.

---

# 53. Response AI Pipeline

```text
Raw text
 ↓
Language detection
 ↓
Normalization
 ↓
Sentiment
 ↓
Intent
 ↓
Topic
 ↓
Theme
 ↓
Emotion
 ↓
Urgency
 ↓
Risk
 ↓
Recommendation
```

---

# 54. AI Response Classification

```ts
interface AIResponseClassification {
  responseId: string;

  sentiment?: {
    label: "positive" | "neutral" | "negative";
    score: number;
    confidence: number;
  };

  topics: AITheme[];

  intents?: AIIntent[];

  emotions?: AIEmotion[];

  urgency?: {
    level: "low" | "medium" | "high" | "critical";
    confidence: number;
  };

  risk?: {
    category: string;
    score: number;
  };

  model: AIModelMetadata;

  createdAt: Timestamp;
}
```

---

# 55. AI Insight

```ts
interface SurveyInsight {
  id: string;

  workspaceId: string;

  surveyId: string;

  projectId?: string;

  type:
    | "trend"
    | "anomaly"
    | "theme"
    | "segment"
    | "risk"
    | "opportunity"
    | "recommendation";

  title: string;

  summary: string;

  evidence: InsightEvidence[];

  confidence: number;

  recommendedActions?: RecommendedAction[];

  status:
    | "new"
    | "reviewed"
    | "dismissed"
    | "acted_on";

  modelMetadata?: AIModelMetadata;

  createdAt: Timestamp;
}
```

---

# 56. Evidence-backed AI

Every insight must be traceable.

Example:

```text
Insight:
Parent satisfaction declined in Campus B.

Evidence:
327 responses
↓
Average score:
74 → 63

Primary themes:
Communication: 38%
Fees: 27%
Transport: 19%

Confidence:
High
```

The AI should never produce an unsupported executive statement when underlying evidence is unavailable.

---

# 57. Natural-language analytics

The existing platform already supports natural-language response querying and quantitative/qualitative analysis. 

Surveys 2.0 should formalize the architecture:

```text
User Question
 ↓
Intent Parser
 ↓
Structured Query
 ↓
Validation
 ↓
Analytics Engine
 ↓
Dataset
 ↓
AI Interpretation
 ↓
Answer + Evidence
```

Example structured query:

```json
{
  "metric": "average_score",
  "surveyId": "survey_123",
  "groupBy": ["campus"],
  "filters": [
    {
      "field": "parentType",
      "operator": "equals",
      "value": "new"
    }
  ],
  "period": {
    "from": "2026-01-01",
    "to": "2026-08-31"
  }
}
```

The LLM must not directly generate unrestricted database queries.

---

# 58. AI Research Assistant

Users can ask:

> What should we investigate next?

The assistant can inspect:

* trends
* weak segments
* anomalies
* open-text themes
* unanswered questions
* benchmark gaps

and propose:

```text
Research question
Supporting evidence
Suggested questions
Target audience
Recommended sample
```

---

# 59. AI Adaptive Surveys

Long-term capability:

```text
Response
 ↓
Sentiment / score
 ↓
Decision
 ↓
Follow-up question
```

Example:

> Respondent gives a low satisfaction score.

The system asks:

> “What was the main reason for your rating?”

This must remain controlled by configured adaptive-question policies.

AI should not arbitrarily change a regulated assessment without approval.

---

# 60. CRM Integration Architecture

The existing platform already performs CRM matching and deal routing. It can identify contacts by phone/email, match entities, prevent generic survey answers from overwriting CRM names, and either update an existing deal or create a new one. 

Surveys 2.0 formalizes this.

---

# 61. CRM → Survey

Possible triggers:

```text
CONTACT_CREATED
LEAD_CREATED
LEAD_STATUS_CHANGED
DEAL_CREATED
DEAL_WON
DEAL_LOST
DEAL_STAGE_CHANGED
MEETING_COMPLETED
INVOICE_PAID
INVOICE_OVERDUE
CAMPAIGN_COMPLETED
STUDENT_ENROLLED
PARENT_ONBOARDED
```

Example:

```text
Deal Won
 ↓
Wait 14 days
 ↓
CSAT Survey
```

---

# 62. Survey → CRM

Actions:

```text
UPDATE_CONTACT
UPDATE_ENTITY
UPDATE_CUSTOM_FIELD
ADD_TAG
REMOVE_TAG
CHANGE_LIFECYCLE
UPDATE_LEAD_SCORE
CREATE_TASK
CREATE_DEAL
MOVE_DEAL
ASSIGN_OWNER
CREATE_NOTE
CREATE_ALERT
START_CAMPAIGN
SEND_MESSAGE
```

---

# 63. CRM Mapping

Questions can map directly to CRM fields.

```ts
interface CRMFieldMapping {
  target:
    | "contact"
    | "entity"
    | "lead"
    | "deal";

  fieldId: string;

  transform?:
    | "none"
    | "normalize_phone"
    | "normalize_email"
    | "uppercase"
    | "lowercase"
    | "number"
    | "date";
}
```

---

# 64. CRM Timeline

Every important survey event should appear on the entity timeline.

Example:

```text
Survey Started
Parent Satisfaction Survey

Survey Submitted
Score: 82%

AI Insight
Communication rated positively

CRM Action
Tag: Parent Promoter

Automation
Follow-up campaign initiated
```

---

# 65. Deal Integration

The current implementation already supports open-deal lookup, stage movement, score metadata and deal creation. 

The target architecture adds configurable routing:

```text
Survey Outcome
 ↓
Pipeline
 ↓
Stage
 ↓
Deal action
```

Example:

```text
NPS Promoter
→ Add "Promoter" tag

NPS Passive
→ Customer-success task

NPS Detractor
→ Create intervention task
→ Alert account manager
```

---

# 66. Automation Architecture

Survey automation should use the central SmartSapp automation engine.

The survey module should **emit events**, not build a separate automation platform.

Architecture:

```text
Survey Event
 ↓
SmartSapp Event Bus
 ↓
Automation Rules
 ↓
Conditions
 ↓
Action Executor
```

---

# 67. Survey Automation Trigger

```ts
interface SurveyAutomationTrigger {
  event:
    | "submitted"
    | "completed"
    | "score_calculated"
    | "outcome_resolved"
    | "negative_sentiment"
    | "anomaly_detected"
    | "quota_reached";

  conditions: AutomationCondition[];
}
```

---

# 68. Automation Actions

```text
Add tag
Remove tag
Update CRM
Create task
Assign user
Create deal
Move deal
Send email
Send SMS
Send WhatsApp
Send notification
Webhook
Start campaign
Generate report
Request AI analysis
```

The current implementation already coordinates webhooks, outcome-specific email/SMS/WhatsApp, internal/external notifications, assigned-representative notifications and the global `SURVEY_SUBMITTED` event. 

Surveys 2.0 should move these into standardized automation contracts.

---

# 69. Security Architecture

## 69.1 Tenant isolation

Every request must establish:

```text
authenticated user
→ organization
→ workspace
→ survey
```

Never trust a client-provided workspace ID without server-side authorization.

---

# 70. Authentication

Use SmartSapp Authentication for administrators.

Public respondents use:

```text
anonymous session
signed token
optional CRM identity token
```

---

# 71. Public survey security

Implement:

* signed deployment tokens
* session tokens
* nonce/replay protection
* rate limiting
* submission idempotency
* origin validation
* bot protection
* file validation
* upload authorization

The existing encrypted identity-token system remains useful for personalized survey links. 

---

# 72. PII Protection

Separate:

```text
Response Data
```

from:

```text
Identity Data
```

where appropriate.

Sensitive fields should have stricter access controls.

---

# 73. Anonymous Survey Protection

Anonymous surveys must not accidentally reveal identity through:

* CRM variables
* URL parameters
* exports
* analytics filters
* AI prompts
* logs

---

# 74. AI Data Governance

AI requests should pass through:

```text
Permission Check
 ↓
Data Scope Check
 ↓
PII Policy
 ↓
Prompt Builder
 ↓
AI Provider
```

AI should only receive data the requesting user is authorized to access.

---

# 75. Audit Logging

Record:

```text
survey created
survey edited
version published
response exported
PII viewed
AI analysis generated
CRM action executed
automation modified
permissions changed
```

---

# 76. CSV/Export Security

The current implementation already neutralizes spreadsheet formula injection characters in CSV exports. 

Retain this.

Also introduce:

* export permissions
* export audit logs
* PII masking
* export expiration
* signed download URLs

---

# 77. Data Retention

Workspace administrators should configure:

```text
Response retention
Event retention
AI analysis retention
Uploaded media retention
Export retention
```

Possible policy:

```text
30 days
90 days
1 year
3 years
7 years
indefinite
```

---

# 78. Firestore Architecture

Recommended structure:

```text
/workspaces/{workspaceId}

/surveyProjects/{projectId}

/surveys/{surveyId}

/surveyVersions/{versionId}

/surveyDeployments/{deploymentId}

/surveyAudiences/{audienceId}

/surveySessions/{sessionId}

/surveyResponses/{responseId}

/surveyEvents/{eventId}

/surveyInsights/{insightId}

/surveySegments/{segmentId}

/surveyReports/{reportId}

/surveyExperiments/{experimentId}

/surveyQuestionBank/{questionId}

/surveyBenchmarks/{benchmarkId}

/surveyAutomations/{automationId}
```

For very high-volume responses, consider workspace-scoped collection groups or partitioning strategies rather than putting all responses into one hot collection.

---

# 79. Firestore Document Design Principles

Documents should remain small.

Do not place:

```text
10,000 responses
```

inside a survey document.

Do not store huge analytics arrays.

Do not embed large AI outputs in transactional survey records.

Use references.

---

# 80. Firestore Index Strategy

Core indexes should include:

### Surveys

```text
workspaceId + status + updatedAt DESC
workspaceId + ownerId + updatedAt DESC
workspaceId + projectId + updatedAt DESC
workspaceId + surveyType + status
```

### Versions

```text
surveyId + versionNumber DESC
surveyId + status
workspaceId + publishedAt DESC
```

### Deployments

```text
workspaceId + status + startsAt
surveyId + status
campaignId + surveyId
```

### Responses

```text
workspaceId + surveyId + submittedAt DESC
surveyId + surveyVersionId + submittedAt DESC
surveyId + deploymentId + submittedAt DESC
surveyId + outcome + submittedAt DESC
surveyId + entityId + submittedAt DESC
workspaceId + submittedAt DESC
```

### Events

```text
workspaceId + eventType + occurredAt DESC
surveyId + eventType + occurredAt DESC
sessionId + occurredAt ASC
responseId + occurredAt ASC
```

### AI

```text
workspaceId + surveyId + createdAt DESC
surveyId + type + createdAt DESC
status + createdAt DESC
```

Indexes should be introduced based on actual query plans rather than indiscriminately creating every theoretical compound index.

---

# 81. Analytics Storage Strategy

Firestore can remain the transactional source.

Derived analytical data should be stored separately.

Recommended:

```text
Raw
Firestore

Derived
Firestore aggregate collections

Heavy analytics
Dedicated analytical store when scale justifies it
```

This allows SmartSapp to transition to a warehouse/OLAP architecture without rewriting the transactional survey system.

---

# 82. API Architecture

Although the existing application uses Next.js Server Actions, the mature architecture should expose a stable domain API layer behind those actions.

Recommended structure:

```text
UI
 ↓
Server Action / API Route
 ↓
Application Service
 ↓
Domain Service
 ↓
Repository
 ↓
Firestore
```

Do not allow UI components to become direct Firestore business-logic clients.

---

# 83. Survey API Contracts

## Create survey

```http
POST /api/v2/surveys
```

Request:

```json
{
  "name": "Parent Satisfaction",
  "surveyType": "csat",
  "projectId": "project_123"
}
```

Response:

```json
{
  "id": "survey_123",
  "status": "draft",
  "currentDraftVersionId": "version_1"
}
```

---

# 84. Create Version

```http
POST /api/v2/surveys/{surveyId}/versions
```

---

# 85. Publish Version

```http
POST /api/v2/surveys/{surveyId}/versions/{versionId}/publish
```

The operation should:

1. verify permissions
2. validate survey definition
3. validate logic graph
4. validate scoring
5. validate translations
6. validate result pages
7. generate checksum
8. freeze version
9. publish

---

# 86. Create Deployment

```http
POST /api/v2/surveys/{surveyId}/deployments
```

---

# 87. Public Survey Definition

```http
GET /api/v2/public/surveys/{deploymentSlug}
```

Only return information necessary for the public runtime.

Never return:

* internal CRM fields
* private automation configuration
* admin metadata
* hidden scoring rules where disclosure is undesirable

---

# 88. Start Session

```http
POST /api/v2/public/surveys/{deploymentId}/sessions
```

---

# 89. Save Session

```http
PATCH /api/v2/public/sessions/{sessionId}
```

Used for resumable surveys.

---

# 90. Submit Response

```http
POST /api/v2/public/sessions/{sessionId}/submit
```

Headers:

```text
Idempotency-Key
```

Response:

```json
{
  "responseId": "response_123",
  "status": "accepted",
  "score": 82,
  "outcome": "satisfied",
  "resultPage": "result_123"
}
```

---

# 91. Analytics API

```http
GET /api/v2/surveys/{surveyId}/analytics
```

Parameters:

```text
from
to
segment
deployment
channel
groupBy
metric
```

---

# 92. Natural-language Analytics API

```http
POST /api/v2/surveys/{surveyId}/ai/query
```

Request:

```json
{
  "question": "Why are parents less satisfied this quarter?"
}
```

Response:

```json
{
  "answer": "...",
  "confidence": 0.91,
  "evidence": [],
  "query": {},
  "insights": []
}
```

---

# 93. AI Architecture Provider Layer

The existing implementation supports Genkit-based providers and OpenRouter fallback. 

Surveys 2.0 should introduce a provider abstraction:

```text
AI Gateway
│
├── Provider A
├── Provider B
├── Provider C
└── Fallback Provider
```

Capabilities:

```text
generation
classification
summarization
embedding
structured extraction
reasoning
```

The survey domain should never depend directly on a specific model.

---

# 94. AI Model Registry

```ts
interface AIModelMetadata {
  provider: string;

  model: string;

  version?: string;

  promptVersion: string;

  temperature?: number;

  inputTokens?: number;

  outputTokens?: number;

  latencyMs?: number;

  createdAt: Timestamp;
}
```

---

# 95. Automation Reliability

Every automation must support:

```text
idempotency
retry
backoff
dead-letter state
execution logs
correlation ID
```

The existing batch processing already handles Firestore's 30-item `in` limitation by chunking IDs, which should remain part of the scalable implementation pattern. 

---

# 96. Messaging Integration

Survey automation can invoke SmartSapp messaging:

```text
Email
SMS
WhatsApp
```

Examples:

### Invitation

```text
Survey audience
→ WhatsApp invitation
```

### Reminder

```text
Not completed
→ Wait 48 hours
→ Reminder
```

### Outcome

```text
Negative outcome
→ Customer-success SMS
```

---

# 97. Webhooks

Support:

```text
survey.created
survey.started
survey.submitted
survey.completed
survey.outcome
survey.score
survey.insight
survey.anomaly
```

Webhook requirements:

* signed requests
* retry
* exponential backoff
* delivery logs
* replay
* endpoint verification

---

# 98. Billing & Credits

Surveys should integrate with SmartSapp's centralized entitlement system.

## Billable dimensions

```text
Survey responses
AI generations
AI analyses
AI queries
AI classifications
Storage
SMS
WhatsApp
Email
Exports
Advanced analytics
Automations
```

---

# 99. Credit Model

Possible:

```text
Survey Responses
AI Credits
Messaging Credits
Automation Credits
Storage
```

AI actions can consume different amounts depending on complexity.

Example:

```text
Generate survey: 5 AI credits
Analyze 100 responses: 10 AI credits
Deep research analysis: 25 AI credits
```

Exact commercial pricing should be configured outside the domain model.

---

# 100. Entitlement Checks

Before expensive operations:

```text
Request
 ↓
Permission Check
 ↓
Entitlement Check
 ↓
Quota Check
 ↓
Execution
```

This prevents unauthorized consumption.

---

# 101. Reporting Architecture

Report definitions:

```ts
interface SurveyReport {
  id: string;

  workspaceId: string;

  surveyId?: string;
  projectId?: string;

  name: string;

  reportType:
    | "executive"
    | "detailed"
    | "research"
    | "operational"
    | "ai";

  configuration: ReportConfiguration;

  schedule?: ReportSchedule;

  recipients?: string[];

  createdAt: Timestamp;
}
```

---

# 102. Report Formats

Support:

* PDF
* CSV
* Excel
* PowerPoint
* web report

The web report should be the canonical analytical representation; exported documents should be generated from it.

---

# 103. Experimentation Architecture

```ts
interface SurveyExperiment {
  id: string;

  surveyId: string;

  baseVersionId: string;

  variants: ExperimentVariant[];

  allocation: number[];

  primaryMetric:
    | "completion_rate"
    | "response_rate"
    | "conversion_rate"
    | "score";

  status:
    | "draft"
    | "running"
    | "completed"
    | "cancelled";
}
```

Test:

* wording
* order
* theme
* CTA
* introduction
* survey length
* result page

---

# 104. Response Quality Architecture

The quality engine should run after submission.

```text
Response
 ↓
Duplicate Check
 ↓
Speed Check
 ↓
Pattern Check
 ↓
Device/IP Check
 ↓
Contact Validation
 ↓
Quality Score
```

Responses flagged as suspect should remain stored but be excluded from official analytics unless explicitly included.

---

# 105. Offline Architecture

For field collection:

```text
PWA
 ↓
Local IndexedDB
 ↓
Encrypted local queue
 ↓
Connectivity restored
 ↓
Sync
 ↓
Idempotency validation
 ↓
Server
```

The existing roadmap already identifies offline PWA/IndexedDB as an important future capability. 

---

# 106. Conflict Resolution

If the same session syncs twice:

```text
submissionId
+
idempotencyKey
```

must prevent duplication.

For partially completed sessions:

```text
lastUpdatedAt
version
deviceId
```

can be used for conflict resolution.

---

# 107. Accessibility

Target:

* WCAG 2.2 AA baseline
* keyboard navigation
* screen reader compatibility
* focus management
* error announcements
* accessible labels
* sufficient contrast
* reduced motion

The current runtime already uses 44px minimum interactive targets and dynamic contrast handling. 

These should become formal design-system requirements.

---

# 108. Internationalization

Survey versions should support locale-specific content:

```text
English
French
...
```

All analytical dimensions should remain linked to canonical question IDs.

---

# 109. Translation Architecture

```text
Canonical Question
        │
 ┌──────┴───────┐
 ▼              ▼
English        French
```

The translated text changes.

The underlying:

```text
questionId
metric
scoring
logic
```

does not.

---

# 110. Audit Architecture

Every administrative change should create:

```ts
interface SurveyAuditEvent {
  id: string;

  workspaceId: string;

  actorId: string;

  action: string;

  resourceType: string;

  resourceId: string;

  before?: unknown;

  after?: unknown;

  occurredAt: Timestamp;

  ipHash?: string;
}
```

---

# 111. Permission Model

Recommended permissions:

```text
survey.view
survey.create
survey.edit
survey.delete

survey.version.create
survey.version.review
survey.publish

survey.deploy
survey.distribute

survey.responses.view
survey.responses.export
survey.responses.delete

survey.analytics.view
survey.analytics.export

survey.ai.use
survey.ai.analyze

survey.automation.view
survey.automation.manage

survey.integrations.view
survey.integrations.manage

survey.question_bank.manage

survey.project.manage

survey.experiment.manage

survey.billing.view
```

---

# 112. Data-level permissions

Separately control:

```text
View anonymous responses
View respondent identity
View CRM information
View sensitive answers
Export PII
Use AI on responses
Create CRM actions
```

This is important because survey administrators and CRM administrators do not necessarily require identical data access.

---

# 113. Observability

Every major process should produce:

```text
structured logs
metrics
traces
events
```

Track:

* submission latency
* validation failure
* AI latency
* AI error rate
* automation failure
* webhook failure
* CRM matching failure
* response processing backlog
* analytics processing delay

---

# 114. Operational dashboards

Engineering dashboard:

```text
Survey submissions/minute
Processing latency
Failed submissions
AI jobs
Automation failures
Webhook failures
Storage errors
```

Product dashboard:

```text
Active surveys
Responses
Completion
Engagement
AI insights
```

---

# 115. Testing Strategy

## Unit

Test:

* scoring
* logic
* outcomes
* identity matching
* segmentation
* analytics calculations
* quota calculations

## Integration

Test:

* Firestore
* CRM
* automation
* messaging
* AI provider
* storage

## End-to-end

Test:

```text
Create
→ Publish
→ Deploy
→ Respond
→ Submit
→ CRM
→ Analytics
→ AI
→ Automation
```

---

# 116. AI Evaluation

AI requires a dedicated evaluation framework.

Test:

### Survey generation

* schema validity
* question quality
* logic validity
* hallucination
* redundancy

### Classification

* sentiment accuracy
* theme accuracy
* confidence calibration

### Analytics

* numerical correctness
* evidence correctness
* filter correctness

### Recommendations

* relevance
* safety
* unsupported claims

---

# 117. Data Migration Strategy

Do not perform a destructive rewrite.

Current:

```text
Survey
 ├── elements
 ├── scoring
 ├── result rules
 ├── CRM settings
 └── automation
```

Migration:

```text
Legacy Survey
 ↓
Survey 2.0 Adapter
 ↓
Survey
SurveyVersion
ResultPage
Automation references
CRM configuration
```

Run both schemas temporarily if required.

---

# 118. Backward Compatibility

Existing public URLs:

```text
/surveys/[slug]
```

must continue to work.

Existing identity links:

```text
?ref=...
```

must continue to resolve.

Existing CRM automations should continue to receive:

```text
SURVEY_SUBMITTED
```

while the new event taxonomy is introduced.

---

# 119. Phase 0 — Architecture Hardening

### Objective

Create a safe foundation without changing the user-facing product dramatically.

### Work

* split `survey-actions.ts`
* decompose question editor
* decompose result page builder
* introduce repositories
* introduce application services
* establish event contracts
* establish audit logging
* introduce API abstraction
* establish testing harness
* establish feature flags

The source review specifically recommends decomposing the 2,500-line server action module and oversized builder components. 

### Deliverables

```text
SurveyRepository
SurveyVersionRepository
ResponseRepository
DeploymentRepository
AnalyticsRepository
AIService
CRMIntegrationService
SurveyEventPublisher
```

### Exit criteria

* no critical regression
* existing surveys still work
* existing CRM integrations still work
* existing public URLs still work
* test coverage established

---

# 120. Phase 1 — Survey Platform Core

### Build

* Survey Projects
* Survey Types
* Survey Versions
* lifecycle
* approvals
* Question Bank
* templates
* deployments
* audience model
* anonymous/confidential/identified modes
* collaboration

### Exit criteria

Users can create a structured survey project and publish immutable versions.

---

# 121. Phase 2 — Advanced Survey Studio

### Build

* advanced question types
* calculated fields
* advanced scoring
* outcome engine
* visual logic graph
* reusable blocks
* multilingual content
* advanced themes
* accessibility

### Exit criteria

SmartSapp can build professional research, assessment and experience surveys without custom development.

---

# 122. Phase 3 — Distribution & Field Operations

### Build

* QR
* email
* SMS
* WhatsApp
* embed
* modal
* kiosk
* field campaigns
* quotas
* scheduling
* attribution
* offline PWA
* sync engine
* field-agent performance

The existing platform already has field-team yield analytics and multi-channel notification infrastructure to build upon. 

### Exit criteria

A survey can be deployed through every major SmartSapp channel and collected online/offline.

---

# 123. Phase 4 — Analytics 2.0

### Build

* analytics pipeline
* response aggregates
* question analytics
* funnel analytics
* cross-tabs
* segments
* cohort analysis
* trend analysis
* benchmarks
* response quality
* exports
* scheduled reports

### Exit criteria

An administrator can answer:

> Who responded?

> What did they say?

> Where did they drop?

> Which segments differ?

> How has performance changed?

> How do we compare with previous periods?

without manually exporting raw data.

---

# 124. Phase 5 — Survey Intelligence AI

### Build

* AI survey generator
* AI reviewer
* AI question optimizer
* sentiment
* theme extraction
* intent
* anomaly detection
* AI summaries
* AI research assistant
* NL analytics
* evidence-backed insights

The existing three-stage AI generation pipeline should become the base architecture rather than being discarded. 

### Exit criteria

AI can create, analyze and explain surveys while preserving analytical evidence.

---

# 125. Phase 6 — CRM Intelligence

### Build

CRM → Survey:

* lifecycle triggers
* deal triggers
* campaign triggers
* meeting triggers
* enrollment triggers

Survey → CRM:

* field mapping
* tags
* lead scoring
* tasks
* deals
* pipeline movement
* timeline
* ownership

### Exit criteria

Survey activity becomes a first-class CRM signal.

---

# 126. Phase 7 — Automation & Decisioning

### Build

* event triggers
* score triggers
* outcome triggers
* sentiment triggers
* anomaly triggers
* quota triggers
* delayed actions
* retries
* branching
* CRM actions
* messaging actions
* AI recommended actions

### Exit criteria

Survey results can automatically initiate complete CRM workflows.

---

# 127. Phase 8 — Research & Enterprise

### Build

* longitudinal projects
* waves
* benchmarks
* experiments
* A/B testing
* advanced research question types
* research reports
* collaboration
* governance
* advanced permissions
* retention policies
* audit
* enterprise exports

### Exit criteria

SmartSapp can support serious multi-wave organizational research.

---

# 128. Phase 9 — Predictive Survey Intelligence

This is the strategic end state.

Combine:

```text
Survey Data
+
CRM Data
+
Messaging
+
Meetings
+
Billing
+
Enrollment
+
Engagement
```

into SmartSapp Intelligence.

Capabilities:

* churn-risk prediction
* satisfaction-risk prediction
* lead conversion prediction
* enrollment propensity
* promoter identification
* account health
* intervention prioritization
* next-best-action

The survey is now one of SmartSapp's intelligence sensors.

---

# 129. End-to-End Example

Consider a school running:

**2026 Parent Experience Study**

### Step 1

Administrator creates Project.

### Step 2

AI generates survey blueprint.

### Step 3

Administrator reviews questions.

### Step 4

Survey Version 1 is published.

### Step 5

Deployment created:

```text
WhatsApp
Email
QR
Website
```

### Step 6

Parents respond.

### Step 7

Sessions/events track the journey.

### Step 8

Responses are scored.

### Step 9

CRM identity is resolved.

### Step 10

Survey events enter the event bus.

### Step 11

Analytics aggregates update.

### Step 12

AI analyzes open-text responses.

### Step 13

AI detects:

> Communication dissatisfaction increased 18% among new parents.

### Step 14

SmartSapp creates:

```text
At-Risk Parent Segment
```

### Step 15

CRM automation:

```text
Create task
→ Account manager
```

### Step 16

AI recommends:

> Send a follow-up survey specifically about communication.

### Step 17

Administrator approves.

### Step 18

SmartSapp creates the follow-up survey.

That is the full intelligence loop.

---

# 130. Target SmartSapp Survey Data Flow

```text
                  ┌──────────────────┐
                  │     CRM DATA     │
                  └────────┬─────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   AUDIENCE  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ DEPLOYMENT  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   SESSION   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  RESPONSE   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           SCORING        CRM         EVENTS
              │            │            │
              ▼            ▼            ▼
          OUTCOME       TIMELINE     ANALYTICS
              │            │            │
              └────────────┼────────────┘
                           ▼
                          AI
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
          INSIGHTS      SEGMENTS      RECOMMENDATIONS
             │             │              │
             └─────────────┼──────────────┘
                           ▼
                       AUTOMATION
                           │
                           ▼
                          CRM
```

---

# 131. Definition of Done for Surveys 2.0

The platform should not be considered mature merely because the builder works.

Surveys 2.0 is complete when SmartSapp can reliably support:

### Create

A user can build any standard survey without engineering intervention.

### Version

Every published survey is immutable and reproducible.

### Distribute

The same survey can be deployed through multiple channels.

### Collect

Responses can be collected reliably online and offline.

### Understand

Administrators can analyze responses quantitatively and qualitatively.

### Segment

Users can compare audiences dynamically.

### Explain

AI can explain important patterns with evidence.

### Activate

Insights can trigger CRM actions.

### Automate

Survey results can drive SmartSapp workflows.

### Research

Organizations can conduct multi-wave studies.

### Govern

PII, permissions, audit and retention are controlled.

### Scale

High response volumes do not degrade the public respondent experience.

---

# 132. Architectural North Star

The ultimate architecture should be:

```text
                       SMARTSAPP
                           │
                    INTELLIGENCE LAYER
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
       CRM              SURVEYS           AI/ML
        │                  │                  │
   Contacts             Responses          Models
   Leads                Events             Insights
   Deals                Analytics          Agents
   Accounts             Research           Predictions
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                     AUTOMATION BUS
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    Messaging           Tasks              CRM
    Email/SMS          Activities          Updates
    WhatsApp           Meetings            Deals
```

The crucial strategic decision is that **Surveys should not become an isolated feature island**. It should become one of the structured intelligence sources feeding the entire SmartSapp platform.

---

# 133. Final Architectural Recommendation

The existing subsystem gives SmartSapp a strong starting point. Its public runtime, four presentation modes, conditional logic, scoring, result pages, CRM matching, deal routing, tagging, notifications, field-team attribution and AI generation/analytics are all valuable foundations. 

The most important work now is **architectural maturation rather than feature accumulation**.

The target hierarchy should be:

```text
                         SURVEY PROJECT
                               │
                             SURVEY
                               │
                         SURVEY VERSION
                               │
       ┌───────────────┬───────┼────────┬──────────────┐
       ▼               ▼       ▼        ▼              ▼
   QUESTIONS        LOGIC   SCORING  OUTCOMES       THEME
       │               │       │        │
       └───────────────┴───────┼────────┘
                               ▼
                         DEPLOYMENT
                               │
                            AUDIENCE
                               │
                            SESSION
                               │
                           RESPONSE
                               │
                             ANSWERS
                               │
                  ┌────────────┼─────────────┐
                  ▼            ▼             ▼
               EVENTS        CRM           AI
                  │            │             │
                  ▼            ▼             ▼
              ANALYTICS    TIMELINE      INSIGHTS
                  │            │             │
                  └────────────┼─────────────┘
                               ▼
                          AUTOMATION
                               │
                               ▼
                       SMARTSAPP CRM


That model gives SmartSapp the ability to move from the current **survey builder + CRM integration** architecture toward a genuinely scalable **Survey Intelligence Platform**.