# SmartSapp Forms 2.0 — Complete Product Requirements & Technical Architecture

**Document status:** Target-state PRD
**Product:** SmartSapp CRM
**Module:** Forms 2.0
**Architecture target:** Multi-tenant, CRM-native, event-driven, AI-assisted, analytics-first
**Primary persistence:** Cloud Firestore, with an analytical store introduced when event volume warrants it
**Primary application stack:** Next.js / TypeScript / Firebase
**Supersedes:** Current Forms implementation and its four-step wizard as the long-term product model

---

# 1. Executive Summary

SmartSapp Forms should evolve from its current form-builder implementation into a **full intelligent form experience platform** embedded within the SmartSapp ecosystem.

The existing implementation already provides a substantial foundation:

* visual drag-and-drop builder,
* bound/global forms,
* contact scopes,
* public hosted forms,
* landing-page embeds,
* headless submission,
* conditional visibility,
* themes,
* CRM entity resolution,
* tagging,
* webhooks,
* notifications,
* automations,
* QR distribution,
* submissions management,
* UTM/source tracking,
* autosave,
* undo/redo,
* optimistic concurrency protection.  

The existing implementation also exposes several architectural issues that must be addressed before scale, particularly:

1. workspace-wide CRM deduplication queries,
2. unscoped custom-field queries,
3. unsafe/incorrect deletion pagination,
4. inconsistent tag-selection implementation,
5. two divergent submission-processing pipelines. 

Forms 2.0 therefore should not simply be "Forms 1.0 plus more fields."

The target architecture is:

> **Form Definition → Form Experience → Session → Events → Response → Identity → CRM → Intelligence → Automation → Outcome → Analytics → Optimization**

The form becomes an **executable data experience**, not a static collection of fields.

---

# 2. Product Vision

## 2.1 Vision statement

> **SmartSapp Forms enables organizations to create intelligent, branded, CRM-aware data experiences that capture information, understand respondents, trigger workflows, and continuously optimize outcomes.**

---

# 3. Product Mission

SmartSapp Forms must allow an organization to:

### Create

* forms,
* applications,
* registrations,
* lead capture experiences,
* qualification flows,
* feedback experiences,
* research instruments,
* onboarding workflows,
* payment forms,
* internal operational forms.

### Publish

* hosted forms,
* embedded forms,
* landing-page forms,
* campaign forms,
* QR forms,
* API/headless forms.

### Understand

* who responded,
* what they answered,
* where they came from,
* where they abandoned,
* what they are likely to do,
* how valuable they are,
* what their responses mean.

### Act

* create/update CRM entities,
* score leads,
* create deals,
* create tasks,
* assign owners,
* send messages,
* trigger automations,
* create segments,
* book meetings,
* initiate payments,
* invoke external APIs.

### Improve

* analyze conversion,
* detect friction,
* optimize questions,
* recommend logic,
* identify anomalies,
* generate reports,
* use AI to improve the experience.

---

# 4. Product Principles

## P1 — CRM-native

Forms must understand SmartSapp Contacts, Families, Institutions, Leads, Deals, Tasks, Segments and Activities.

## P2 — Experience-first

A form is a user experience, not a database schema.

## P3 — Event-first

Important respondent behaviour must be observable.

## P4 — Version-safe

Published form schemas must be immutable.

## P5 — Multi-channel

Hosted, embedded, API and future SDK submissions must use the same processing core.

## P6 — AI-assisted, not AI-dependent

AI improves creation and analysis but must never become a mandatory dependency for core form functionality.

## P7 — Secure by default

Public ingestion must be treated as an untrusted boundary.

## P8 — Analytics-native

Analytics must be designed into the runtime rather than reconstructed from submissions later.

## P9 — Composable

Forms must share infrastructure with Surveys, Campaigns, Pages, CRM and Automations.

## P10 — Enterprise-ready

Permissions, auditability, versioning, retention and governance must exist at the architectural level.

---

# 5. Product Scope

## Core domains

```text
Forms Home
Form Studio
Logic Studio
Theme Studio
Template Library
Component Library
Distribution Center
Response Center
Analytics
Reports
AI Studio
Automations
CRM Integration
Research Workspace
Governance
Public Form Runtime
API Platform
```

---

# 6. Target Information Architecture

## SmartSapp navigation

```text
Forms
│
├── Home
├── All Forms
├── Templates
├── Components
├── Themes
│
├── Analytics
├── Responses
├── Reports
├── AI Insights
│
├── Automations
└── Research
```

## Individual form navigation

```text
Form
│
├── Overview
├── Studio
├── Logic
├── Design
├── CRM
├── Automations
├── Distribution
├── Responses
├── Analytics
├── Reports
└── Settings
```

---

# 7. Form Types

Forms should have a normalized `purpose`, rather than relying only on the current `bound` versus `global` distinction.

### Form purpose

```typescript
type FormPurpose =
  | 'lead_capture'
  | 'contact'
  | 'qualification'
  | 'application'
  | 'registration'
  | 'onboarding'
  | 'feedback'
  | 'assessment'
  | 'research'
  | 'booking_intake'
  | 'payment'
  | 'support'
  | 'internal_request'
  | 'data_update'
  | 'custom';
```

### Audience mode

```typescript
type AudienceMode =
  | 'anonymous'
  | 'known_contact'
  | 'crm_bound'
  | 'authenticated'
  | 'mixed';
```

### Form lifecycle

```typescript
type FormStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'paused'
  | 'archived';
```

---

# 8. Target Domain Model

The target domain model should be divided into six major bounded contexts.

```text
                    SMARTSAPP FORMS
                          │
 ┌────────────────────────┼─────────────────────────┐
 │                        │                         │
 ▼                        ▼                         ▼
DEFINITION              RUNTIME                  INTELLIGENCE
 │                        │                         │
 Form                    Session                   Analytics
 Version                 Event                     AI
 Page                    Response                  Insights
 Component               Attribution               Reports
 Field                   Identity                  Experiments
 Logic
 Theme
 Distribution
 │
 └────────────────────────┬─────────────────────────┐
                          │                         │
                          ▼                         ▼
                       CRM                       ACTIONS
                          │                         │
                       Contact                  Automation
                       Family                   Messaging
                       Institution              Tasks
                       Lead                     Deals
                       Deal                     Meetings
                       Segment                  Webhooks
```

---

# 9. Complete Entity Inventory

## Definition entities

* `Form`
* `FormVersion`
* `FormPage`
* `FormComponent`
* `FormField`
* `FormLogicRule`
* `FormCalculation`
* `FormScoreRule`
* `FormTheme`
* `FormThemeVersion`
* `FormTemplate`
* `FormComponentTemplate`
* `FormValidationRule`
* `FormOptionSet`

## Distribution entities

* `FormDistribution`
* `FormCampaign`
* `FormEmbed`
* `FormApiCredential`
* `FormWebhook`

## Runtime entities

* `FormSession`
* `FormEvent`
* `FormResponse`
* `FormAnswer`
* `FormAttachment`
* `FormAttribution`
* `FormConsent`

## CRM entities

* `FormIdentityMatch`
* `FormCrmMapping`
* `FormCrmAction`
* `FormLeadScore`
* `FormAssignment`

## Automation entities

* `FormAutomation`
* `FormAutomationExecution`
* `FormNotification`
* `FormMessage`

## Analytics

* `FormMetricDaily`
* `FormFieldMetricDaily`
* `FormPageMetricDaily`
* `FormSourceMetricDaily`
* `FormCampaignMetricDaily`
* `FormCohortMetric`
* `FormExperiment`
* `FormExperimentVariant`

## AI

* `FormAiGeneration`
* `FormAiJob`
* `FormAiInsight`
* `FormAiClassification`
* `FormAiRecommendation`

## Governance

* `FormPermission`
* `FormApproval`
* `FormAuditEvent`
* `FormRetentionPolicy`

---

# 10. Core `Form` Schema

```typescript
interface Form {
  id: string;

  organizationId: string;
  workspaceId: string;

  internalName: string;
  title: string;
  description?: string;

  slug: string;

  purpose: FormPurpose;
  audienceMode: AudienceMode;

  status: FormStatus;

  currentVersionId?: string;
  publishedVersionId?: string;

  defaultLocale: string;
  supportedLocales?: string[];

  folderId?: string;

  ownerId?: string;

  templateId?: string;

  branding: {
    themeId?: string;
    brandKitId?: string;
    inheritWorkspaceBrand: boolean;
  };

  settings: FormSettings;

  crm: FormCrmConfiguration;

  analytics: FormAnalyticsConfiguration;

  ai: FormAiConfiguration;

  security: FormSecurityConfiguration;

  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt: Timestamp;

  archivedAt?: Timestamp;
}
```

---

# 11. Form Settings

```typescript
interface FormSettings {
  allowResubmission: boolean;

  maxSubmissionsPerRespondent?: number;

  submissionWindow?: {
    startsAt?: Timestamp;
    endsAt?: Timestamp;
  };

  saveProgress: boolean;

  allowResume: boolean;

  showProgress: boolean;

  progressStyle:
    | 'percentage'
    | 'steps'
    | 'bar'
    | 'none';

  confirmation: {
    type:
      | 'inline'
      | 'modal'
      | 'thank_you_page'
      | 'redirect';

    message?: string;
    redirectUrl?: string;
    countdownSeconds?: number;
  };

  localeDetection: boolean;

  timezoneMode:
    | 'respondent'
    | 'workspace'
    | 'fixed';

  accessibilityMode: 'standard' | 'enhanced';

  spamProtection: {
    enabled: boolean;
    provider?: string;
    threshold?: number;
  };
}
```

---

# 12. Form Version

This is mandatory.

```typescript
interface FormVersion {
  id: string;

  formId: string;

  versionNumber: number;

  status:
    | 'draft'
    | 'in_review'
    | 'approved'
    | 'published'
    | 'superseded';

  schemaVersion: string;

  pages: FormPage[];

  globalLogic: FormLogicRule[];

  calculations: FormCalculation[];

  scoreRules: FormScoreRule[];

  themeVersionId?: string;

  checksum: string;

  createdBy: string;
  createdAt: Timestamp;

  publishedBy?: string;
  publishedAt?: Timestamp;

  supersededAt?: Timestamp;
}
```

### Critical requirement

A published version is immutable.

If a user edits a published form:

```text
Published v4
     ↓
Create draft v5
     ↓
Edit
     ↓
Test
     ↓
Approve
     ↓
Publish v5
```

Existing responses remain associated with `v4`.

---

# 13. Form Page

```typescript
interface FormPage {
  id: string;

  versionId: string;

  title?: string;
  description?: string;

  order: number;

  components: FormComponent[];

  entryRules?: FormLogicRule[];
  exitRules?: FormLogicRule[];

  analyticsLabel?: string;

  progressWeight?: number;
}
```

---

# 14. Form Component

The field should no longer be the only structural object.

```typescript
interface FormComponent {
  id: string;

  type:
    | 'field'
    | 'section'
    | 'heading'
    | 'paragraph'
    | 'image'
    | 'video'
    | 'divider'
    | 'button'
    | 'card'
    | 'accordion'
    | 'field_group'
    | 'consent'
    | 'payment'
    | 'signature'
    | 'file'
    | 'calendar';

  order: number;

  fieldId?: string;

  parentComponentId?: string;

  layout: {
    width: 'full' | 'half' | 'third';
    alignment?: 'left' | 'center' | 'right';
  };

  visibility?: VisibilityConfiguration;

  content?: Record<string, unknown>;

  style?: Record<string, unknown>;
}
```

---

# 15. Form Field

```typescript
interface FormField {
  id: string;

  versionId: string;

  appFieldId?: string;

  semanticType: FieldSemanticType;

  label: string;

  description?: string;

  placeholder?: string;

  helpText?: string;

  required: boolean;

  hidden: boolean;

  readonly?: boolean;

  defaultValue?: unknown;

  options?: FormFieldOption[];

  optionSetId?: string;

  validation: ValidationRule[];

  crmMapping?: CrmFieldMapping;

  analytics?: FieldAnalyticsConfiguration;

  privacy?: FieldPrivacyConfiguration;

  ai?: FieldAiConfiguration;

  settings?: Record<string, unknown>;
}
```

---

# 16. Field Types

```typescript
type FieldSemanticType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'radio'
  | 'checkbox'
  | 'rating'
  | 'ranking'
  | 'slider'
  | 'matrix'
  | 'likert'
  | 'address'
  | 'location'
  | 'file'
  | 'image'
  | 'signature'
  | 'otp'
  | 'contact'
  | 'institution'
  | 'family'
  | 'deal'
  | 'owner'
  | 'tag'
  | 'hidden'
  | 'formula'
  | 'consent'
  | 'payment'
  | 'calendar';
```

---

# 17. Logic Model

The current implementation supports `show`/`hide` and a small set of comparison operators. 

Forms 2.0 should use a normalized expression tree.

```typescript
interface FormLogicRule {
  id: string;

  versionId: string;

  enabled: boolean;

  trigger: LogicTrigger;

  conditions: LogicConditionGroup;

  actions: LogicAction[];

  priority: number;
}
```

```typescript
interface LogicConditionGroup {
  operator: 'AND' | 'OR';

  conditions: Array<
    LogicCondition | LogicConditionGroup
  >;
}
```

---

# 18. Logic Conditions

```typescript
interface LogicCondition {
  fieldId: string;

  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'greater_or_equal'
    | 'less_or_equal'
    | 'between'
    | 'in'
    | 'not_in'
    | 'empty'
    | 'not_empty'
    | 'regex'
    | 'date_before'
    | 'date_after';

  value?: unknown;
}
```

---

# 19. Logic Actions

```typescript
type LogicAction =
  | ShowAction
  | HideAction
  | RequireAction
  | DisableAction
  | SetValueAction
  | ClearValueAction
  | JumpPageAction
  | SkipPageAction
  | CalculateAction
  | ScoreAction
  | AddTagAction
  | AssignOwnerAction
  | TriggerAutomationAction
  | ShowMessageAction
  | RedirectAction
  | EndFormAction;
```

---

# 20. Calculation Engine

```typescript
interface FormCalculation {
  id: string;

  name: string;

  targetFieldId: string;

  expression: string;

  dependencies: string[];

  format?: {
    type: 'number' | 'currency' | 'percentage' | 'date';
    currency?: string;
    decimals?: number;
  };
}
```

Examples:

```text
quantity * unitPrice

baseFee + transportFee - discount

TODAY() - dateOfBirth
```

The calculation engine must use a **safe expression parser**, never arbitrary JavaScript evaluation.

---

# 21. Scoring Engine

```typescript
interface FormScoreRule {
  id: string;

  name: string;

  conditions: LogicConditionGroup;

  points: number;

  category?: string;

  explanation?: string;
}
```

Result:

```typescript
interface FormLeadScore {
  submissionId: string;

  totalScore: number;

  category:
    | 'very_low'
    | 'low'
    | 'medium'
    | 'high'
    | 'very_high';

  factors: Array<{
    ruleId: string;
    points: number;
    explanation: string;
  }>;

  calculatedAt: Timestamp;
}
```

---

# 22. Theme Architecture

```typescript
interface FormTheme {
  id: string;

  organizationId: string;
  workspaceId: string;

  name: string;

  tokens: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    spacing: Record<string, string>;
    radius: Record<string, string>;
    shadows: Record<string, string>;
  };

  components: {
    input: Record<string, unknown>;
    button: Record<string, unknown>;
    card: Record<string, unknown>;
    label: Record<string, unknown>;
    error: Record<string, unknown>;
  };

  responsive: Record<string, unknown>;

  accessibility: Record<string, unknown>;

  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 23. Distribution Model

```typescript
interface FormDistribution {
  id: string;

  formId: string;
  versionId: string;

  type:
    | 'hosted'
    | 'embed'
    | 'landing_page'
    | 'qr'
    | 'email'
    | 'sms'
    | 'whatsapp'
    | 'campaign'
    | 'api';

  name: string;

  slug?: string;

  campaignId?: string;

  source?: string;
  medium?: string;

  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  status: 'active' | 'paused' | 'expired';

  createdAt: Timestamp;
}
```

---

# 24. Form Session

This is a new foundational entity.

```typescript
interface FormSession {
  id: string;

  formId: string;
  versionId: string;

  organizationId: string;
  workspaceId: string;

  distributionId?: string;

  anonymousId?: string;

  respondentId?: string;

  crmEntityId?: string;

  status:
    | 'created'
    | 'started'
    | 'in_progress'
    | 'abandoned'
    | 'resumed'
    | 'completed'
    | 'expired';

  currentPageId?: string;

  startedAt?: Timestamp;

  lastActivityAt: Timestamp;

  completedAt?: Timestamp;

  device: DeviceContext;

  attribution?: FormAttribution;

  progress: {
    currentPage: number;
    totalPages: number;
    percentage: number;
  };
}
```

---

# 25. Form Event

```typescript
interface FormEvent {
  id: string;

  formId: string;
  versionId: string;

  sessionId: string;

  organizationId: string;
  workspaceId: string;

  respondentId?: string;
  crmEntityId?: string;

  type: FormEventType;

  timestamp: Timestamp;

  pageId?: string;
  componentId?: string;
  fieldId?: string;

  valueMetadata?: {
    changed?: boolean;
    optionCount?: number;
    validationPassed?: boolean;
  };

  attribution?: FormAttribution;

  device?: DeviceContext;

  metadata?: Record<string, unknown>;
}
```

---

# 26. Event Taxonomy

## Lifecycle

```text
FORM_CREATED
FORM_UPDATED
FORM_PUBLISHED
FORM_PAUSED
FORM_ARCHIVED
FORM_VERSION_CREATED
FORM_VERSION_PUBLISHED
```

## Runtime

```text
FORM_VIEWED
FORM_STARTED
FORM_RESUMED
FORM_ABANDONED
FORM_SUBMITTED
FORM_COMPLETED
FORM_EXPIRED
```

## Page

```text
PAGE_VIEWED
PAGE_STARTED
PAGE_COMPLETED
PAGE_SKIPPED
PAGE_VALIDATION_FAILED
```

## Field

```text
FIELD_VIEWED
FIELD_FOCUSED
FIELD_CHANGED
FIELD_COMPLETED
FIELD_VALIDATION_FAILED
FIELD_SKIPPED
FIELD_ABANDONED
```

## Logic

```text
LOGIC_EVALUATED
LOGIC_ACTION_EXECUTED
BRANCH_TAKEN
PAGE_JUMPED
```

## CRM

```text
CRM_MATCH_ATTEMPTED
CRM_MATCHED
CRM_CREATED
CRM_UPDATED
CRM_MATCH_FAILED
```

## Automation

```text
AUTOMATION_TRIGGERED
AUTOMATION_COMPLETED
AUTOMATION_FAILED
```

## AI

```text
AI_GENERATION_STARTED
AI_GENERATION_COMPLETED
AI_CLASSIFICATION_COMPLETED
AI_INSIGHT_CREATED
AI_RECOMMENDATION_CREATED
```

---

# 27. Form Response

```typescript
interface FormResponse {
  id: string;

  formId: string;
  versionId: string;

  sessionId: string;

  organizationId: string;
  workspaceId: string;

  respondentId?: string;

  crmEntityId?: string;

  status:
    | 'received'
    | 'validating'
    | 'validated'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'quarantined';

  answers: Record<string, FormAnswer>;

  attribution?: FormAttribution;

  score?: FormLeadScore;

  processing: ProcessingState;

  submittedAt: Timestamp;

  completedAt?: Timestamp;
}
```

---

# 28. Form Answer

```typescript
interface FormAnswer {
  fieldId: string;

  value: unknown;

  normalizedValue?: unknown;

  displayValue?: string;

  metadata?: {
    source: 'respondent' | 'default' | 'calculated' | 'crm';
    confidence?: number;
  };

  submittedAt: Timestamp;
}
```

---

# 29. Attribution Model

```typescript
interface FormAttribution {
  firstTouch?: AttributionTouch;

  lastTouch?: AttributionTouch;

  currentTouch?: AttributionTouch;

  referrer?: string;

  landingPageId?: string;

  campaignId?: string;

  distributionId?: string;

  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}
```

---

# 30. CRM Integration Model

The CRM integration should become a dedicated bounded context.

```text
Form
 │
 ▼
Identity Resolution
 │
 ├── Existing Person
 ├── Existing Family
 ├── Existing Institution
 └── New Entity
       │
       ▼
CRM Mutation Plan
       │
 ├── Create
 ├── Update
 ├── Link
 ├── Tag
 ├── Assign
 ├── Score
 ├── Create Lead
 ├── Create Deal
 └── Create Task
```

---

# 31. CRM Matching

The current implementation performs email/phone matching, but the extracted review correctly identifies its current workspace-wide document scan as a serious scalability issue. 

Replace it with:

```typescript
interface IdentityResolutionRequest {
  workspaceId: string;

  email?: string;
  phone?: string;

  firstName?: string;
  lastName?: string;

  institutionName?: string;

  externalId?: string;
}
```

Resolution order:

```text
1. CRM ID
2. External ID
3. Normalized email
4. Normalized phone
5. Email + name
6. Phone + name
7. Institution + person
8. Fuzzy candidate matching
```

---

# 32. Match confidence

```typescript
interface IdentityMatch {
  entityId: string;

  entityType:
    | 'person'
    | 'family'
    | 'institution';

  confidence: number;

  method:
    | 'crm_id'
    | 'external_id'
    | 'email'
    | 'phone'
    | 'composite'
    | 'fuzzy';

  requiresReview: boolean;
}
```

---

# 33. CRM Mapping

```typescript
interface FormCrmMapping {
  fieldId: string;

  entityType:
    | 'person'
    | 'family'
    | 'institution'
    | 'lead'
    | 'deal';

  property: string;

  direction:
    | 'form_to_crm'
    | 'crm_to_form'
    | 'bidirectional';

  updateStrategy:
    | 'always'
    | 'if_empty'
    | 'if_newer'
    | 'never';

  transform?: string;
}
```

---

# 34. CRM Action Plan

Every submission generates a deterministic action plan.

Example:

```text
1. Resolve Person
2. Resolve Institution
3. Create/update Person
4. Create/update Institution
5. Create Lead
6. Apply Tags
7. Calculate Score
8. Assign Owner
9. Create Deal
10. Create Task
```

The plan should be stored for auditability.

---

# 35. CRM Event Integration

Forms should emit:

```text
form.submitted
form.qualified
form.lead.created
form.entity.updated
form.deal.created
form.followup.required
```

This allows the rest of SmartSapp to react without Forms directly owning every workflow.

---

# 36. Automation Architecture

The current implementation already triggers workspace automation from `FORM_SUBMITTED`. 

Forms 2.0 should expose a richer trigger model.

## Triggers

```text
FORM_VIEWED
FORM_STARTED
FORM_ABANDONED
FORM_RESUMED
PAGE_COMPLETED
FIELD_COMPLETED
FORM_SUBMITTED
FORM_COMPLETED
SCORE_CHANGED
CRM_MATCHED
CRM_CREATED
CRM_UPDATED
AI_INTENT_DETECTED
```

---

# 37. Automation Action Model

```typescript
type AutomationAction =
  | 'send_email'
  | 'send_sms'
  | 'send_whatsapp'
  | 'create_contact'
  | 'update_contact'
  | 'create_lead'
  | 'create_deal'
  | 'update_deal'
  | 'create_task'
  | 'assign_owner'
  | 'apply_tag'
  | 'remove_tag'
  | 'add_segment'
  | 'remove_segment'
  | 'book_meeting'
  | 'request_payment'
  | 'send_webhook'
  | 'wait'
  | 'branch'
  | 'invoke_ai';
```

---

# 38. Automation execution

Every execution needs:

```typescript
interface FormAutomationExecution {
  id: string;

  automationId: string;

  formId: string;

  submissionId?: string;

  triggerEventId: string;

  status:
    | 'queued'
    | 'running'
    | 'waiting'
    | 'completed'
    | 'failed'
    | 'cancelled';

  attempt: number;

  startedAt?: Timestamp;
  completedAt?: Timestamp;

  error?: {
    code: string;
    message: string;
  };
}
```

---

# 39. AI Architecture

AI should be treated as a separate processing subsystem.

```text
Form Studio
     │
     ├── AI Generation
     ├── AI Optimization
     ├── AI Logic
     └── AI Design
             │
             ▼
       AI Orchestration
             │
             ▼
        Model Gateway
             │
      ┌──────┼───────┐
      ▼      ▼       ▼
    LLM    Embedding Vision
      │      │       │
      └──────┼───────┘
             ▼
       Structured Output
```

---

# 40. AI Form Generation

Input:

```text
Create a lead qualification form for private schools
interested in SmartSapp.
```

Output:

```text
Form title
Description
Pages
Fields
Questions
Logic
Validation
CRM mappings
Scoring
Theme
Confirmation
Automations
```

AI must output a **validated structured schema**, not arbitrary UI code.

---

# 41. AI optimization

AI analyses:

* question length,
* number of questions,
* duplication,
* required fields,
* complexity,
* reading level,
* mobile friction,
* likely abandonment.

Example:

> Remove 3 questions.

> Move budget to page 3.

> Combine first and last name.

> Make "number of students" required for qualification.

---

# 42. AI response intelligence

```typescript
interface FormAiClassification {
  submissionId: string;

  intent?: string;

  sentiment?: 'positive' | 'neutral' | 'negative';

  urgency?: 'low' | 'medium' | 'high';

  topics?: string[];

  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;

  summary?: string;

  recommendedActions?: string[];

  confidence: number;

  model: string;

  createdAt: Timestamp;
}
```

---

# 43. AI confidence policy

AI outputs should have explicit confidence.

```text
95–100% → eligible for automation
85–94%  → automation + audit
70–84%  → recommendation
<70%    → human review
```

The exact thresholds should be configurable per AI capability.

---

# 44. AI Insight Engine

An insight is different from a classification.

```typescript
interface FormAiInsight {
  id: string;

  formId: string;

  type:
    | 'conversion_drop'
    | 'field_friction'
    | 'campaign_anomaly'
    | 'lead_quality'
    | 'response_pattern'
    | 'segment_pattern'
    | 'recommendation';

  title: string;

  description: string;

  evidence: Array<{
    metric: string;
    value: number;
    comparison?: number;
  }>;

  confidence: number;

  severity: 'info' | 'warning' | 'critical';

  status: 'new' | 'reviewed' | 'dismissed' | 'actioned';

  createdAt: Timestamp;
}
```

---

# 45. AI Form Assistant

The builder should have an embedded assistant capable of:

> "Create a qualification flow."

> "Make this form shorter."

> "Add logic for schools interested in billing."

> "Map these fields to CRM."

> "Improve conversion."

> "Explain why people are abandoning this form."

> "Create a weekly report."

---

# 46. Analytics Architecture

The most important architectural decision:

**Do not make raw Firestore submissions the analytical engine.**

Firestore is excellent for transactional state, but high-volume analytical workloads require deliberate indexing, aggregation and eventually an analytical store. Firebase's current guidance specifically highlights index fanout, high-write considerations, avoiding offsets, cursor pagination, and careful handling of large arrays/maps. ([Firebase][1])

---

# 47. Three-layer data architecture

```text
             OPERATIONAL DATA
                  Firestore
                     │
                     ▼
                EVENT STREAM
                     │
                     ▼
             ANALYTICS PIPELINE
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    Aggregated Metrics       Warehouse
      Firestore              Optional
          │                     │
          └──────────┬──────────┘
                     ▼
                 Analytics
```

---

# 48. Operational Firestore Collections

Recommended top-level collections:

```text
forms
form_versions
form_sessions
form_events
form_responses
form_distributions
form_automations
form_webhooks
form_ai_jobs
form_ai_insights
form_reports
form_themes
form_templates
```

Tenant-specific data should always include:

```text
organizationId
workspaceId
```

---

# 49. Firestore form structure

Recommended:

```text
forms/{formId}

forms/{formId}/versions/{versionId}

forms/{formId}/versions/{versionId}/pages/{pageId}

forms/{formId}/versions/{versionId}/fields/{fieldId}
```

Runtime:

```text
form_sessions/{sessionId}
form_events/{eventId}
form_responses/{responseId}
```

I would avoid storing a huge complete form definition plus all runtime data in one document.

---

# 50. Firestore indexing strategy

Key indexes:

```text
forms:
workspaceId + status
workspaceId + updatedAt
workspaceId + purpose

form_sessions:
formId + startedAt
formId + status
workspaceId + lastActivityAt

form_responses:
formId + submittedAt
formId + status
workspaceId + submittedAt
crmEntityId + submittedAt

form_events:
formId + timestamp
sessionId + timestamp
workspaceId + timestamp
```

Avoid indexing fields that will never be queried.

Firebase specifically recommends index exemptions where large strings, high-write sequential fields, TTL fields, or large arrays/maps would otherwise create unnecessary index overhead. ([Firebase][1])

---

# 51. Do not create one giant response document

Avoid:

```text
response.data = enormous arbitrary object
```

as the only model.

Instead:

```text
FormResponse
 ├── metadata
 ├── answer summary
 └── answer references/data
```

For high-volume/large-answer forms, consider separate answer documents or an analytical representation.

---

# 52. Analytics metrics

## Form metrics

```text
views
starts
submissions
completions
conversionRate
abandonmentRate
averageCompletionTime
```

## Page metrics

```text
views
starts
completions
dropOff
averageTime
validationErrors
```

## Field metrics

```text
views
interactions
completions
errors
skips
abandonmentAfterField
averageTime
```

## CRM metrics

```text
contactsCreated
contactsMatched
leadsCreated
qualifiedLeads
dealsCreated
dealValue
revenueInfluenced
```

---

# 53. Daily aggregate schema

```typescript
interface FormMetricDaily {
  id: string;

  formId: string;

  workspaceId: string;

  date: string;

  views: number;
  starts: number;
  submissions: number;
  completions: number;
  abandonments: number;

  conversionRate: number;

  averageCompletionTimeSeconds: number;

  contactsCreated: number;
  leadsCreated: number;
  qualifiedLeads: number;
  dealsCreated: number;

  influencedRevenue?: number;
}
```

---

# 54. Field analytics

```typescript
interface FormFieldMetricDaily {
  formId: string;

  versionId: string;

  fieldId: string;

  date: string;

  views: number;

  interactions: number;

  completions: number;

  validationErrors: number;

  skips: number;

  abandonmentAfterField: number;

  averageTimeSeconds: number;
}
```

---

# 55. Funnel architecture

A funnel should be generated from events:

```text
FORM_VIEWED
     ↓
FORM_STARTED
     ↓
PAGE_COMPLETED
     ↓
PAGE_COMPLETED
     ↓
FORM_SUBMITTED
     ↓
CRM_QUALIFIED
     ↓
DEAL_CREATED
```

This allows both UX and commercial funnels.

---

# 56. Analytics UI

Each form should have:

### Overview

```text
Views
Starts
Completion
Conversion
Qualified leads
Revenue
```

### Funnel

```text
Views
 ↓
Starts
 ↓
Page 2
 ↓
Page 3
 ↓
Completed
```

### Sources

```text
Facebook
Google
WhatsApp
Direct
Email
QR
```

### Devices

```text
Mobile
Desktop
Tablet
```

### CRM

```text
Contacts
Leads
Qualified
Deals
Revenue
```

---

# 57. Reporting architecture

Reports should be defined as reusable objects.

```typescript
interface FormReport {
  id: string;

  workspaceId: string;

  name: string;

  formIds: string[];

  widgets: ReportWidget[];

  filters: ReportFilter[];

  schedule?: ReportSchedule;

  createdBy: string;

  createdAt: Timestamp;
}
```

---

# 58. Report widgets

```typescript
type ReportWidgetType =
  | 'metric'
  | 'line_chart'
  | 'bar_chart'
  | 'funnel'
  | 'table'
  | 'cohort'
  | 'heatmap'
  | 'map'
  | 'segment'
  | 'ai_summary';
```

---

# 59. Search Architecture

Forms need two search layers.

## Operational search

Firestore queries for:

* form name
* status
* owner
* date
* workspace.

## Full-text/semantic search

Introduce a search index for:

* form content,
* questions,
* response text,
* AI summaries,
* topics,
* CRM entities.

Potential architecture:

```text
Firestore
   │
   └── Event / Change Pipeline
             │
             ▼
        Search Index
             │
      ┌──────┴──────┐
      ▼             ▼
Keyword          Semantic
Search           Search
```

The exact search provider should be selected based on SmartSapp's existing platform-wide search architecture rather than creating a Forms-only search technology.

---

# 60. API Architecture

Use a versioned API.

```text
/api/v1/forms
/api/v1/forms/{id}
/api/v1/forms/{id}/versions
/api/v1/forms/{id}/publish
/api/v1/forms/{id}/responses
/api/v1/forms/{id}/sessions
/api/v1/forms/{id}/events
/api/v1/forms/{id}/analytics
/api/v1/forms/{id}/reports
```

---

# 61. Public submission API

```http
POST /api/v1/public/forms/{formId}/responses
```

Request:

```json
{
  "sessionId": "sess_123",
  "idempotencyKey": "abc123",
  "answers": {
    "field_1": "Kwame",
    "field_2": "kwame@example.com"
  },
  "attribution": {
    "utmSource": "facebook",
    "utmCampaign": "demo"
  }
}
```

Response:

```json
{
  "success": true,
  "responseId": "resp_123",
  "sessionId": "sess_123",
  "status": "accepted"
}
```

---

# 62. API authentication

Public forms do not require end-user authentication, but the endpoint itself needs abuse controls.

Authenticated APIs:

```text
OAuth
API keys
workspace credentials
service accounts
```

External API access should use scoped credentials.

---

# 63. Idempotency

Every public submission should support:

```http
Idempotency-Key: <unique-value>
```

Repeated requests with the same key must return the same response rather than create duplicates.

---

# 64. Webhook API

```http
POST /api/v1/webhooks
```

Webhook object:

```typescript
interface FormWebhook {
  id: string;

  formId: string;

  url: string;

  events: string[];

  secret: string;

  status: 'active' | 'paused';

  retryPolicy: {
    maxAttempts: number;
    backoffSeconds: number;
  };
}
```

Never blindly fetch arbitrary webhook URLs.

Webhook destinations require SSRF protection and URL validation because SSRF is specifically recognized by OWASP as a major API risk, particularly around integrations and webhooks. ([OWASP Foundation][2])

---

# 65. Submission Processing Architecture

The current system has divergent pipelines between hosted and embedded/headless submission paths. 

Replace this with:

```text
              ALL INPUT CHANNELS
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
    Hosted        Embedded       API
       │             │             │
       └─────────────┼─────────────┘
                     ▼
              Submission Gateway
                     │
                     ▼
              Authentication/
              Abuse Protection
                     │
                     ▼
                  Validate
                     │
                     ▼
               Logic Engine
                     │
                     ▼
              Persist Response
                     │
                     ▼
                Emit Events
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
      CRM           AI          Analytics
       │             │             │
       └─────────────┼─────────────┘
                     ▼
                 Automation
                     │
                     ▼
                Notifications
```

---

# 66. Synchronous vs asynchronous processing

## Synchronous

Must complete before returning:

* schema validation,
* required field validation,
* logic evaluation,
* anti-abuse decision,
* response persistence,
* idempotency check.

## Asynchronous

Should generally execute through jobs:

* CRM enrichment,
* AI processing,
* email,
* SMS,
* WhatsApp,
* webhooks,
* heavy analytics aggregation,
* report generation,
* document processing.

Firestore transactions are appropriate where state changes must be atomic; Firestore transactions retry on concurrent changes and do not partially apply their writes. ([Firebase][3])

---

# 67. Queue/job model

```typescript
interface FormJob {
  id: string;

  type:
    | 'crm_resolution'
    | 'crm_mutation'
    | 'ai_analysis'
    | 'notification'
    | 'webhook'
    | 'analytics'
    | 'report';

  formId: string;

  responseId?: string;

  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'dead_letter';

  attempts: number;

  maxAttempts: number;

  availableAt: Timestamp;

  createdAt: Timestamp;

  completedAt?: Timestamp;

  error?: string;
}
```

---

# 68. Retry policy

Use:

```text
1st failure → 5 sec
2nd         → 30 sec
3rd         → 2 min
4th         → 10 min
5th         → dead letter
```

Different providers may have different retry policies.

---

# 69. Transaction boundaries

A response transaction should not attempt to atomically update:

* CRM,
* messaging provider,
* analytics,
* webhook endpoint,
* AI.

That would create an extremely fragile distributed transaction.

Instead:

```text
Transaction:
Response + processing state + outbox event
```

Then workers consume the events.

---

# 70. Outbox/Event reliability

Use an outbox pattern:

```text
Response
   +
Outbox Event
```

persisted atomically.

Then:

```text
Outbox
 ↓
Dispatcher
 ↓
Workers
```

This prevents a response from being saved while the corresponding event is accidentally lost.

---

# 71. Security Architecture

The current extracted review identifies tenant isolation as a serious issue. 

Forms 2.0 should treat every public endpoint as hostile.

OWASP specifically identifies broken object-level authorization, broken object-property authorization, unrestricted resource consumption, broken function-level authorization, SSRF and unsafe API consumption among the primary API security risks. ([OWASP Foundation][4])

---

# 72. Authorization model

Every request must resolve:

```text
Organization
Workspace
User
Role
Permissions
Resource
Action
```

Authorization:

```typescript
authorize(
  user,
  workspace,
  resource,
  action
)
```

---

# 73. RBAC

Roles:

### Forms Viewer

* view forms
* view analytics

### Forms Creator

* create
* edit
* duplicate

### Forms Manager

* publish
* manage logic
* manage CRM
* manage automations

### Forms Analyst

* responses
* analytics
* reports
* exports

### Forms Admin

* all Forms capabilities

### Forms Publisher

* approve/publish

### Forms Developer

* API
* webhooks
* integrations

---

# 74. Permission matrix

```text
Permission                     Viewer Creator Manager Analyst Admin
-------------------------------------------------------------------
forms.view                       ✓      ✓       ✓       ✓      ✓
forms.create                            ✓       ✓              ✓
forms.edit                              ✓       ✓              ✓
forms.logic                                     ✓              ✓
forms.crm                                       ✓              ✓
forms.publish                                   ✓              ✓
forms.responses                          ✓       ✓       ✓      ✓
forms.export                                      ✓       ✓      ✓
forms.analytics                                   ✓       ✓      ✓
forms.automations                                ✓              ✓
forms.integrations                               ✓              ✓
forms.ai                                         ✓       ✓      ✓
forms.admin                                                     ✓
```

---

# 75. Tenant isolation

Every repository method should require tenant context.

Bad:

```typescript
getForm(id)
```

Preferred:

```typescript
getForm({
  organizationId,
  workspaceId,
  formId
})
```

This prevents ID-based cross-tenant access.

OWASP explicitly recommends object-level authorization checks for functions accessing resources using client-supplied identifiers. ([OWASP Foundation][4])

---

# 76. Data classification

Each field should support:

```text
public
internal
confidential
sensitive
restricted
```

This classification affects:

* logging,
* AI,
* analytics,
* export,
* permissions,
* retention.

---

# 77. PII handling

Avoid logging raw:

* email,
* phone,
* address,
* IDs,
* uploaded documents.

Logs should contain:

```text
entityId
fieldId
operation
hash/reference
```

rather than raw sensitive values wherever possible.

---

# 78. Public API abuse protection

Implement:

* rate limiting,
* IP throttling,
* device fingerprinting where legally appropriate,
* CAPTCHA,
* request size limits,
* file limits,
* content-type validation,
* bot detection,
* duplicate detection,
* anomaly detection.

OWASP identifies unrestricted resource consumption and unrestricted access to sensitive business flows as specific API risks, making these controls important for a public form submission surface. ([OWASP Foundation][4])

---

# 79. File upload security

Uploads require:

```text
MIME validation
extension validation
size limits
virus/malware scanning
storage isolation
signed access URLs
expiration
content-disposition controls
```

Never trust the client-supplied MIME type.

---

# 80. Webhook security

Validate:

* HTTPS,
* destination hostname,
* DNS resolution,
* private IP ranges,
* redirect behaviour,
* response size,
* timeout,
* allowlists.

This directly addresses SSRF risk.

---

# 81. Audit model

```typescript
interface FormAuditEvent {
  id: string;

  organizationId: string;
  workspaceId: string;

  actorType: 'user' | 'system' | 'ai';

  actorId?: string;

  action: string;

  resourceType: string;

  resourceId: string;

  before?: Record<string, unknown>;

  after?: Record<string, unknown>;

  timestamp: Timestamp;

  ipAddress?: string;
}
```

---

# 82. Retention

Forms should support configurable:

```text
Response retention
Event retention
Session retention
Audit retention
AI processing retention
Attachment retention
```

Example:

```text
Responses: 7 years
Events: 24 months
Sessions: 90 days
AI intermediate data: 30 days
```

These should be configurable rather than hardcoded.

---

# 83. Billing & Entitlements

Forms should use the SmartSapp-wide entitlement framework.

Do not build an independent Forms billing system.

---

# 84. Usage dimensions

Possible billable dimensions:

```text
Active forms
Responses
Monthly respondents
AI generations
AI analyses
Automation executions
Webhook deliveries
File storage
Analytics retention
API calls
Advanced reports
```

---

# 85. Example entitlement model

```typescript
interface FormsEntitlements {
  maxActiveForms: number;

  monthlyResponses: number;

  monthlyUniqueRespondents: number;

  maxFieldsPerForm: number;

  maxPagesPerForm: number;

  aiGenerationsPerMonth: number;

  aiAnalysisCredits: number;

  automationExecutions: number;

  webhookDeliveries: number;

  fileStorageBytes: number;

  analyticsRetentionDays: number;

  advancedAnalytics: boolean;

  customThemes: boolean;

  customDomains: boolean;

  apiAccess: boolean;

  collaboration: boolean;

  approvalWorkflow: boolean;
}
```

---

# 86. Credits

AI should use a centralized SmartSapp AI credit system rather than Forms inventing its own currency.

Example:

```text
AI form generation       5 credits
AI optimization          2 credits
AI response analysis     variable
AI report                variable
AI bulk classification   variable
```

Actual pricing should be defined by the platform billing model.

---

# 87. Usage metering

Every usage event:

```typescript
interface FormUsageEvent {
  organizationId: string;
  workspaceId: string;

  metric:
    | 'response'
    | 'ai_generation'
    | 'ai_analysis'
    | 'automation'
    | 'webhook'
    | 'api_call'
    | 'storage';

  quantity: number;

  resourceId?: string;

  timestamp: Timestamp;
}
```

---

# 88. Entitlement enforcement

Enforcement points:

```text
Form creation
Form publishing
Response ingestion
AI generation
AI processing
Automation
API calls
File upload
Report generation
```

Graceful failure:

> You have reached your monthly response allowance.

Never silently discard a response because of billing.

---

# 89. State Machines

## Form state

```text
DRAFT
  │
  ▼
IN_REVIEW
  │
  ▼
APPROVED
  │
  ▼
PUBLISHED
  │
  ├──────────────► PAUSED
  │                  │
  │                  ▼
  └────────────── PUBLISHED
  │
  ▼
ARCHIVED
```

---

# 90. Form version state

```text
DRAFT
 ↓
REVIEW
 ↓
APPROVED
 ↓
PUBLISHED
 ↓
SUPERSEDED
```

Published versions cannot be edited.

---

# 91. Session state

```text
CREATED
 ↓
STARTED
 ↓
IN_PROGRESS
 ├── ABANDONED
 │      ↓
 │    RESUMED
 │      ↓
 └──────┘
 ↓
COMPLETED
```

---

# 92. Submission state

```text
RECEIVED
 ↓
VALIDATING
 ├── INVALID → REJECTED
 └── VALID
       ↓
    PERSISTED
       ↓
    PROCESSING
       │
       ├── CRM
       ├── AI
       ├── ANALYTICS
       └── AUTOMATION
       ↓
    COMPLETED
```

---

# 93. Automation state

```text
QUEUED
 ↓
RUNNING
 ├── WAITING
 │     ↓
 │   RUNNING
 ├── FAILED
 │     ↓
 │   RETRYING
 │     ↓
 │   DEAD_LETTER
 └── COMPLETED
```

---

# 94. AI job state

```text
QUEUED
 ↓
RUNNING
 ↓
COMPLETED

or

RUNNING
 ↓
FAILED
 ↓
RETRYING
 ↓
DEAD_LETTER
```

---

# 95. Form Publishing Workflow

Publishing should run a validation pipeline.

```text
Validate schema
      ↓
Validate logic
      ↓
Validate CRM mappings
      ↓
Validate automations
      ↓
Validate public URL
      ↓
Validate security settings
      ↓
Accessibility check
      ↓
Performance check
      ↓
Approval
      ↓
Publish
```

---

# 96. Pre-publish validation

The system should identify:

### Errors

* broken logic references,
* missing required mappings,
* invalid redirect,
* unavailable CRM field,
* circular calculation,
* duplicate field IDs.

### Warnings

* no confirmation,
* excessive required fields,
* low accessibility score,
* no spam protection,
* no analytics,
* sensitive fields without classification.

---

# 97. Testing Architecture

Every form should have a **Test Mode**.

Test Mode should simulate:

* valid submission,
* invalid submission,
* logic paths,
* branching,
* CRM matching,
* scoring,
* automations,
* notifications.

---

# 98. Logic simulator

Example:

```text
Input:
School type = Private
Students = 700
Interested in billing = Yes

Expected:

✓ Enterprise questions visible
✓ Billing questions visible
✓ Lead score = 85
✓ Institution matched
✓ Lead created
✓ Sales automation triggered
```

---

# 99. Preview modes

```text
Desktop
Tablet
Mobile
Embedded
Hosted
Conversational
```

---

# 100. Form Runtime Architecture

The public runtime should be isolated from admin code.

```text
Admin App
    │
    │ publishes immutable schema
    ▼
Form Runtime API
    │
    ▼
Cached Form Version
    │
    ▼
Client Runtime
```

Use versioned schemas so published forms can be aggressively cached.

---

# 101. Runtime performance goals

Target:

* fast initial render,
* minimal JavaScript,
* lazy-loaded field components,
* CDN-hosted assets,
* edge-friendly rendering,
* no unnecessary CRM reads,
* no admin bundle dependencies.

The current implementation's dynamic loading and rendering optimization should be retained. 

---

# 102. Anonymous sessions

Do not require authentication merely to measure:

```text
FORM_VIEWED
FORM_STARTED
FORM_ABANDONED
```

Use an anonymous session identifier.

When identity is discovered, merge the anonymous journey into the known respondent journey.

---

# 103. Respondent identity

```typescript
interface RespondentIdentity {
  id: string;

  anonymousIds?: string[];

  crmEntityId?: string;

  emailHash?: string;

  phoneHash?: string;

  firstSeenAt: Timestamp;

  lastSeenAt: Timestamp;
}
```

Do not duplicate the CRM contact as a second master identity.

---

# 104. Analytics attribution flow

```text
Ad
 ↓
Landing Page
 ↓
Form Distribution
 ↓
Form Session
 ↓
Response
 ↓
CRM Lead
 ↓
Meeting
 ↓
Deal
 ↓
Revenue
```

This enables SmartSapp to calculate:

**Form → Lead → Revenue conversion**

rather than simply:

**Form → Submission**

---

# 105. Experiments

Forms should eventually support A/B experiments.

```typescript
interface FormExperiment {
  id: string;

  formId: string;

  hypothesis: string;

  metric:
    | 'completion'
    | 'qualification'
    | 'meeting'
    | 'deal'
    | 'revenue';

  variants: FormExperimentVariant[];

  status: 'draft' | 'running' | 'completed';

  startedAt?: Timestamp;
  endedAt?: Timestamp;
}
```

---

# 106. Optimization engine

The future optimization loop:

```text
Collect
 ↓
Analyze
 ↓
Detect friction
 ↓
AI recommendation
 ↓
Create variant
 ↓
A/B test
 ↓
Measure
 ↓
Promote winner
```

This makes Forms a continuous optimization system.

---

# 107. Templates Architecture

Templates should be structured, not screenshots.

```typescript
interface FormTemplate {
  id: string;

  name: string;

  category: string;

  purpose: FormPurpose;

  description: string;

  version: number;

  schema: FormTemplateSchema;

  previewImage?: string;

  visibility:
    | 'system'
    | 'organization'
    | 'workspace'
    | 'private';

  createdAt: Timestamp;
}
```

---

# 108. Reusable component library

Users should be able to save:

```text
Contact Details
School Details
Parent Details
Child Details
Billing Details
Consent Block
Lead Qualification
Address Block
```

as reusable components.

---

# 109. Research Workspace

Forms and Surveys should share a common engine.

```text
SmartSapp Data Experience Engine
           │
     ┌─────┴──────┐
     ▼            ▼
   Forms       Surveys
     │            │
   CRM        Research
   Leads      Segments
   Deals      Analysis
   Payments   AI Insights
```

This prevents duplicated builders and runtime technology.

---

# 110. Forms vs Surveys

### Forms specialize in

* transaction,
* CRM capture,
* workflows,
* applications,
* lead generation,
* payments.

### Surveys specialize in

* research,
* opinion,
* measurement,
* question banks,
* statistical analysis,
* research workspace.

Shared infrastructure:

* field engine,
* logic engine,
* runtime,
* themes,
* events,
* sessions,
* analytics,
* AI,
* reports.

---

# 111. API security requirements

The public API must explicitly address the OWASP API risks:

| Risk                   | Forms control                   |
| ---------------------- | ------------------------------- |
| BOLA                   | tenant + resource authorization |
| Broken auth            | scoped credentials              |
| Property authorization | field-level permissions         |
| Resource consumption   | rate limits/quotas              |
| Function authorization | RBAC                            |
| Sensitive flows        | abuse detection                 |
| SSRF                   | webhook destination validation  |
| Misconfiguration       | environment policies            |
| Inventory              | versioned API registry          |
| Unsafe API consumption | provider validation             |

OWASP's current API Top 10 explicitly identifies these categories. ([OWASP Foundation][4])

---

# 112. Observability

Every Forms subsystem must emit:

### Logs

* structured JSON,
* correlation ID,
* tenant ID,
* form ID,
* request ID.

### Metrics

```text
submission_latency
submission_success_rate
submission_failure_rate
crm_resolution_latency
ai_latency
webhook_success_rate
automation_success_rate
```

### Traces

Trace:

```text
HTTP request
→ submission
→ CRM
→ automation
→ messaging
```

---

# 113. Operational dashboards

Engineering dashboard:

```text
Submission success: 99.97%

P95 response latency: 320ms

CRM resolution:
P95 180ms

Webhook success:
99.2%

AI processing:
97.4%
```

---

# 114. Alerting

Alerts:

* submission failure spike,
* CRM resolution failures,
* queue backlog,
* webhook failures,
* AI provider outage,
* suspicious traffic,
* Firestore contention,
* rate-limit spike.

---

# 115. Data deletion

Deleting a form should not blindly delete everything synchronously.

Use:

```text
Form archived
 ↓
Deletion requested
 ↓
Export/retention check
 ↓
Background deletion
 ↓
Attachments
 ↓
Responses
 ↓
Sessions
 ↓
Events
 ↓
Analytics
```

The existing deletion cursor issue should be fixed as part of the foundation work. 

---

# 116. Data export

Support:

```text
CSV
XLSX
JSON
PDF report
```

Exports should be asynchronous for large datasets.

```text
Export requested
 ↓
Job queued
 ↓
File generated
 ↓
Secure temporary URL
```

---

# 117. Bulk operations

Response Center should support:

* bulk assign,
* bulk tag,
* bulk status,
* bulk export,
* bulk delete,
* bulk CRM update,
* bulk automation,
* bulk AI analysis.

---

# 118. Notification architecture

The current implementation already supports team alerts, respondent confirmations and external distribution lists across multiple channels. 

Forms 2.0 should make this part of the central SmartSapp Messaging Engine.

Forms should only emit:

```text
notification.requested
```

The Messaging Engine handles:

* channel,
* template,
* provider,
* retry,
* delivery,
* opt-out,
* compliance.

---

# 119. Form notifications

```text
Respondent
Team
Owner
Manager
External recipient
```

Each can have:

```text
Email
SMS
WhatsApp
Push
In-app
```

---

# 120. Form lifecycle analytics

The form dashboard should answer five questions:

### 1. Are people finding it?

Traffic.

### 2. Are they starting?

Engagement.

### 3. Are they finishing?

Conversion.

### 4. Are the responses valuable?

CRM quality.

### 5. Is it producing business outcomes?

Deals/revenue.

---

# 121. Executive KPI model

For a lead-generation form:

```text
2,400 Views
1,500 Starts
920 Submissions
61.3% Completion

740 CRM Matches
180 New Leads
94 Qualified Leads
22 Meetings
8 Deals

GHS 184,000 Pipeline
```

This is the level of reporting SmartSapp should eventually provide.

---

# 122. AI Executive Summary

Example:

> **Performance improved 18% this month.**
>
> Facebook generated the most submissions, while Google generated the highest-qualified leads.
>
> Mobile users abandon primarily on the budget question.
>
> Schools with more than 500 students convert to meetings 2.3× more frequently.
>
> Recommendation: move budget questions after qualification and create a high-volume/enterprise branch.

---

# 123. Phase-by-Phase Engineering Roadmap

## Phase 0 — Architecture Stabilization

**Goal:** Make current Forms safe and scalable.

### Deliverables

* unified submission pipeline,
* tenant-scoped repositories,
* indexed CRM identity lookup,
* correct deletion strategy,
* canonical TagSelector,
* API security,
* idempotency,
* structured logging,
* correlation IDs,
* form version foundation.

### Acceptance criteria

* no workspace-wide entity scans,
* no global field reads,
* no divergent submission paths,
* public submission is rate-limited,
* all mutations tenant-authorized.

---

# 124. Phase 1 — Form Definition Platform

### Deliver

* `Form`
* `FormVersion`
* `FormPage`
* `FormComponent`
* `FormField`
* templates,
* reusable blocks,
* publish lifecycle.

### UI

Build:

* Forms Home,
* Form Studio,
* Preview,
* Version History.

### Engineering

Create repositories:

```text
FormRepository
FormVersionRepository
FormFieldRepository
FormTemplateRepository
```

---

# 125. Phase 2 — Logic Studio

### Deliver

* expression tree,
* AND/OR,
* branching,
* calculations,
* validation,
* dynamic options,
* score rules,
* logic simulator.

### Acceptance

A non-developer can build:

```text
If A AND B
→ show C
→ calculate D
→ score +20
→ jump to Page 4
```

without code.

---

# 126. Phase 3 — Public Runtime

### Deliver

* hosted runtime,
* multi-page,
* responsive,
* accessibility,
* autosave,
* resume later,
* anonymous session,
* session events.

### Performance target

Public runtime must be substantially lighter than the administrative application.

---

# 127. Phase 4 — CRM Integration

### Deliver

* Identity Resolution Service,
* CRM mappings,
* progressive profiling,
* contact/family/institution matching,
* lead creation,
* deal creation,
* tasks,
* assignments,
* tags,
* segments.

---

# 128. Phase 5 — Event & Analytics Foundation

### Deliver

* event schema,
* session tracking,
* event ingestion,
* daily aggregates,
* funnels,
* field analytics,
* attribution.

This phase must precede sophisticated AI because AI recommendations depend on trustworthy behavioural data.

---

# 129. Phase 6 — Response Center

### Deliver

* submission inbox,
* saved views,
* filters,
* grouping,
* bulk actions,
* CRM context,
* AI classification,
* exports.

---

# 130. Phase 7 — Distribution Center

### Deliver

* hosted links,
* embeds,
* campaign distributions,
* QR,
* UTM tracking,
* API v1,
* webhooks,
* attribution.

The current system already provides direct links, embeds and QR generation, so this phase is primarily about turning those capabilities into a coherent distribution platform. 

---

# 131. Phase 8 — Automation

### Deliver

* event triggers,
* action engine,
* wait,
* branch,
* messaging,
* CRM actions,
* tasks,
* deals,
* meetings,
* webhooks,
* retries.

---

# 132. Phase 9 — AI Form Creation

### Deliver

* AI form generator,
* AI question generator,
* AI logic generator,
* AI validation generator,
* AI CRM mapping,
* AI theme generation.

The existing technical roadmap already identifies AI form generation as a natural expansion. 

---

# 133. Phase 10 — AI Response Intelligence

### Deliver

* sentiment,
* intent,
* topics,
* entity extraction,
* classification,
* summaries,
* lead quality,
* recommended actions,
* anomaly detection.

---

# 134. Phase 11 — Reports & Advanced Analytics

### Deliver

* report builder,
* scheduled reports,
* executive dashboards,
* cohort analytics,
* source analytics,
* CRM outcome analytics,
* revenue attribution.

---

# 135. Phase 12 — Optimization

### Deliver

* A/B testing,
* AI recommendations,
* form health score,
* automatic anomaly detection,
* conversion optimization.

---

# 136. Phase 13 — Enterprise

### Deliver

* collaboration,
* comments,
* approvals,
* advanced RBAC,
* audit,
* governance,
* retention,
* enterprise reporting,
* advanced integrations.

---

# 137. Phase 14 — Research Platform

### Deliver

* Research Workspace,
* qualitative analysis,
* AI theme extraction,
* survey/form interoperability,
* research reports,
* respondent segments,
* longitudinal research.

---

# 138. Engineering Workstreams

Each phase should be divided into parallel workstreams.

## Workstream A — Frontend

* Studio
* Runtime
* Analytics
* Response Center

## Workstream B — Backend

* repositories
* APIs
* services
* processing

## Workstream C — Data

* Firestore
* indexes
* event model
* aggregates
* warehouse

## Workstream D — CRM

* identity resolution
* entity mutation
* scoring
* lifecycle

## Workstream E — AI

* generation
* analysis
* insights

## Workstream F — Automation

* events
* workflows
* actions

## Workstream G — Security

* RBAC
* tenant isolation
* abuse prevention
* audit

## Workstream H — QA

* unit
* integration
* E2E
* load
* security
* accessibility.

---

# 139. Testing Strategy

## Unit tests

* logic evaluation,
* calculations,
* validation,
* identity resolution,
* scoring,
* attribution.

## Integration tests

* Firestore,
* CRM,
* messaging,
* webhooks,
* automation.

## E2E

```text
Create
→ Publish
→ Submit
→ CRM match
→ Lead creation
→ Automation
→ Notification
```

## Load tests

Test:

```text
100 submissions/min
1,000/min
10,000/min
```

as the platform scales.

---

# 140. Security testing

Required:

* authorization tests,
* tenant escape tests,
* API fuzzing,
* rate-limit tests,
* SSRF tests,
* upload tests,
* payload abuse tests,
* webhook security tests,
* IDOR/BOLA testing.

OWASP's emphasis on object-level and function-level authorization makes these particularly important for the Forms API. ([OWASP Foundation][4])

---

# 141. Accessibility testing

Automate:

* axe,
* keyboard navigation,
* focus order,
* screen-reader checks,
* contrast.

Manual testing for critical form templates.

---

# 142. Performance testing

Measure:

```text
Form load
First interaction
Field interaction
Page transition
Submission latency
API response
Analytics dashboard load
Response table load
```

Use realistic large forms:

```text
100 fields
25 pages
100+ logic rules
10,000 responses
```

---

# 143. Migration Strategy

The current schema can be migrated.

Current:

```text
Form
 └── fields[]
```

Target:

```text
Form
 └── currentVersionId
       └── Version
            ├── pages
            ├── components
            ├── fields
            ├── logic
            └── calculations
```

Migration process:

```text
Existing Form
 ↓
Create Version 1
 ↓
Transform fields
 ↓
Transform logic
 ↓
Transform theme
 ↓
Transform actions
 ↓
Validate
 ↓
Mark published version
```

No response data should be lost.

---

# 144. Backward compatibility

Existing public URLs must continue to work:

```text
/p/f/[slug]
```

but resolve to:

```text
form
 ↓
publishedVersion
 ↓
runtime
```

Existing embedded forms should continue working while the new runtime is introduced.

---

# 145. Current implementation mapping

| Existing capability   | Forms 2.0 destination |
| --------------------- | --------------------- |
| 4-step wizard         | Form Studio           |
| DnD fields            | Component canvas      |
| Properties sidebar    | Inspector             |
| Logic                 | Logic Studio          |
| Themes                | Theme Studio          |
| Hosted URL            | Runtime               |
| Embed                 | Distribution          |
| REST submit           | API Platform          |
| Submissions table     | Response Center       |
| Notifications         | Messaging/Automation  |
| Tags                  | CRM action            |
| Webhooks              | Integration platform  |
| QR                    | Distribution Center   |
| UTM                   | Attribution           |
| CRM resolution        | Identity Resolution   |
| Submission count      | Analytics aggregates  |
| AI generator roadmap  | AI Studio             |
| Multi-step roadmap    | Form Pages            |
| Collaboration roadmap | Collaboration Layer   |
| Analytics roadmap     | Analytics Platform    |

The current implementation's four-step structure is therefore not discarded; it is **decomposed into specialized product surfaces**. 

---

# 146. Definition of Done for Forms 2.0

Forms 2.0 should not be considered mature merely because the builder works.

It is mature when:

### Creation

* users can build sophisticated forms without developers.

### Runtime

* public forms are fast, responsive and accessible.

### Logic

* complex branching is manageable.

### CRM

* identities resolve accurately.

### Data

* responses are version-safe and auditable.

### Analytics

* the organization understands the complete funnel.

### Automation

* responses produce meaningful actions.

### AI

* AI materially improves creation and interpretation.

### Security

* public ingestion is hardened.

### Scale

* large workspaces do not produce linear scans.

### Governance

* organizations can control who creates, publishes and exports.

### Business intelligence

* SmartSapp can connect form activity to CRM outcomes.

---

# 147. Final Target Architecture

The final architecture should look like this:

```text
                           SMARTSAPP FORMS 2.0
                                    │
         ┌──────────────────────────┼───────────────────────────┐
         │                          │                           │
         ▼                          ▼                           ▼
   DEFINITION PLATFORM        PUBLIC EXPERIENCE          INTELLIGENCE
         │                          │                           │
   Form Studio                  Runtime                    Analytics
   Components                   Sessions                   Reports
   Fields                       Events                     AI
   Logic                        Responses                  Insights
   Themes                       Identity                   Experiments
   Versions                     Attribution                Optimization
         │                          │                           │
         └──────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
                         CRM INTEGRATION LAYER
                                    │
              ┌─────────────┬───────┼────────┬──────────────┐
              ▼             ▼       ▼        ▼              ▼
           Contacts       Leads   Deals    Tasks         Segments
              │             │       │        │              │
              └─────────────┴───────┼────────┴──────────────┘
                                    │
                                    ▼
                           AUTOMATION ENGINE
                                    │
           ┌────────────────────────┼─────────────────────────┐
           ▼                        ▼                         ▼
       Messaging                 Meetings                  Webhooks
           │                        │                         │
           └────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                         SMARTSAPP ECOSYSTEM
                                    │
       ┌──────────────┬─────────────┼──────────────┬──────────────┐
       ▼              ▼             ▼              ▼              ▼
   Campaigns        Pages        Surveys       Payments       Research
```

---

# 148. Strategic conclusion

The critical decision is **not** whether SmartSapp should add more field types, themes, analytics or AI.

It should.

But those features should sit on top of a stronger conceptual foundation.

The target product should be:

> **SmartSapp Forms = Intelligent Data Experience Platform + CRM Capture Engine + Conversion Intelligence + Workflow Engine.**

The existing codebase gives SmartSapp a useful starting point. Its current visual builder, public rendering, embed architecture, CRM ingestion, webhooks, notifications and automation hooks are valuable foundations. 

The immediate architectural priority, however, is to eliminate the current scale/security weaknesses and consolidate the submission pipelines before layering advanced intelligence on top. The extracted review's identified CRM scan, tenant-isolation issue, deletion cursor issue and pipeline duplication should therefore be treated as **Phase 0 blockers**, not future cleanup. 

From there, the strategic sequence is:

**Definition → Runtime → Logic → CRM → Events → Analytics → Automation → AI → Optimization → Enterprise/Research**

That architecture also gives SmartSapp an important platform-level advantage: **Forms and the previously defined Surveys 2.0 platform can share a common Data Experience Engine**, while retaining different specialized experiences. Forms can become transaction/CRM/workflow oriented; Surveys can become research/measurement oriented. They should not become two independent technical platforms.

The resulting capability is substantially broader than a traditional form builder:

```text
CREATE
   ↓
DESIGN
   ↓
LOGIC
   ↓
PUBLISH
   ↓
DISTRIBUTE
   ↓
CAPTURE
   ↓
UNDERSTAND
   ↓
RESOLVE IDENTITY
   ↓
UPDATE CRM
   ↓
SCORE
   ↓
AUTOMATE
   ↓
MEASURE
   ↓
ANALYZE
   ↓
OPTIMIZE
   ↓
LEARN
   ↓
VERSION
   └──────────────→ CREATE BETTER EXPERIENCE
```

That is the architecture I would use as the **engineering source of truth for SmartSapp Forms 2.0**.

[1]: https://firebase.google.com/docs/firestore/best-practices?hl=en&utm_source=chatgpt.com "Best practices for Cloud Firestore  |  Firebase"
[2]: https://owasp.org/www-project-api-security/?utm_source=chatgpt.com "OWASP API Security Project | OWASP Foundation"
[3]: https://firebase.google.com/docs/firestore/manage-data/transactions?utm_source=chatgpt.com "Transactions and batched writes  |  Firestore  |  Firebase"
[4]: https://owasp.org/API-Security/editions/2023/en/0x11-t10/?utm_source=chatgpt.com "OWASP Top 10 API Security Risks – 2023 - OWASP API Security Top 10"
