# SmartSapp Knowledge & Idea Intelligence 2.0

## Product Requirements & Technical Architecture Document

**Product:** SmartSapp
**Module:** Knowledge & Idea Intelligence
**Version:** 2.0
**Status:** Target Architecture / Implementation PRD
**Classification:** Core Platform Intelligence Subsystem
**Primary surfaces:** Web, Tablet, Mobile, Global Capture, CRM Context, Campaign Intelligence, AI Assistant
**Architecture principle:** Capture once. Connect everything. Understand continuously. Act intelligently.

---

# 1. Executive Summary

SmartSapp Knowledge & Idea Intelligence 2.0 transforms the existing Notes subsystem into a unified organizational knowledge, idea development, evidence, relationship and AI intelligence platform.

The current Notes implementation provides three important experiences:

1. Workspace Quick Notes.
2. CRM/entity-linked operational notes.
3. A globally accessible floating capture HUD.

It also already supports TipTap structured documents, AI summaries, action extraction, semantic search, embeddings, attachments, CRM links, task/call aggregation and multi-tenant Firestore isolation.

2.0 retains those capabilities while changing the underlying conceptual model.

The new platform is based on:

> **Knowledge Objects + Knowledge Relationships + Provenance + AI Intelligence + Cross-Application Context**

Instead of treating SmartSapp as a collection of disconnected modules that happen to contain notes, the Knowledge layer becomes the connective intelligence layer across:

* Contacts
* Leads
* Schools
* Deals
* Campaigns
* Calls
* Meetings
* Tasks
* Forms
* Surveys
* Messaging
* QR campaigns
* Lead Intelligence
* Sales Performance
* Finance
* Training
* Documents
* Customer feedback
* Product ideas
* Strategic planning

The resulting system allows users to:

* capture notes instantly;
* create and develop ideas;
* map ideas visually;
* connect knowledge to CRM records;
* preserve evidence and provenance;
* discover relationships automatically;
* ask questions across organizational knowledge;
* identify recurring customer problems;
* detect opportunities;
* challenge assumptions;
* convert knowledge into tasks;
* generate campaign concepts;
* feed Campaign Intelligence;
* receive AI-generated insights;
* maintain an auditable history of decisions and reasoning.

The strategic evolution is:

```text
Notes
   ↓
Unified Knowledge
   ↓
Knowledge Objects
   ↓
Knowledge Graph
   ↓
Idea & Insight Intelligence
   ↓
AI Knowledge Engine
   ↓
Campaign Intelligence
   ↓
SmartSapp Intelligence Layer
```

---

# 2. Product Vision

## 2.1 Vision

Create the place in SmartSapp where the organization captures, develops, connects, understands and operationalizes everything it knows.

## 2.2 Product Promise

> **Capture anything. Connect everything. Understand what matters. Turn knowledge into action.**

## 2.3 Core Principles

### Principle 1 — Capture before organization

Users should never need to decide where information belongs before capturing it.

### Principle 2 — Knowledge is contextual

A note without context has limited value.

### Principle 3 — Relationships matter

The relationship between two pieces of knowledge may be more valuable than either object independently.

### Principle 4 — AI assists; humans govern

AI may recommend, classify, summarize and infer, but authoritative knowledge must remain governed.

### Principle 5 — Evidence precedes inference

The system must distinguish facts, user opinions, customer statements and AI inferences.

### Principle 6 — One knowledge layer

Knowledge captured in one part of SmartSapp should be discoverable wherever the user's permissions allow.

### Principle 7 — Every insight should be traceable

AI-generated conclusions must be explainable through supporting evidence.

### Principle 8 — Knowledge should produce action

Ideas and insights should naturally become tasks, campaigns, workflows, decisions or experiments.

---

# 3. Objectives

## 3.1 Primary Objectives

1. Replace fragmented note concepts with a unified Knowledge Object model.
2. Establish a cross-platform Knowledge Graph.
3. Make CRM knowledge first-class.
4. Introduce a dedicated Idea Intelligence system.
5. Provide AI-assisted capture and classification.
6. Provide evidence-backed semantic and graph search.
7. Feed knowledge directly into Campaign Intelligence.
8. Allow Campaign Intelligence to create and enrich knowledge.
9. Provide organization-wide AI knowledge querying.
10. Preserve provenance and audit history.
11. Support customizable knowledge types, fields, templates and workflows.
12. Support desktop, tablet and mobile experiences.
13. Preserve backward compatibility with the current Notes implementation.

---

# 4. Non-Goals

2.0 is not intended to become:

* a general-purpose project-management system;
* a replacement for CRM;
* a replacement for Campaign Manager;
* a full document-management platform;
* a generic social network;
* an uncontrolled AI-generated knowledge repository.

Knowledge integrates with these systems rather than replacing them.

---

# 5. Target Users

## 5.1 CRM User

Needs:

* contact history;
* customer observations;
* follow-ups;
* buying signals;
* objections;
* commitments.

## 5.2 Sales Representative

Needs:

* call notes;
* deal context;
* customer intelligence;
* objections;
* opportunity signals.

## 5.3 Marketing User

Needs:

* campaign ideas;
* customer feedback;
* messaging insights;
* market observations;
* campaign evidence.

## 5.4 Manager

Needs:

* team knowledge;
* decisions;
* recurring problems;
* emerging trends;
* strategic summaries.

## 5.5 Product/Strategy User

Needs:

* idea mapping;
* hypotheses;
* evidence;
* research;
* decisions;
* opportunity discovery.

## 5.6 Executive

Needs:

* executive synthesis;
* emerging themes;
* risks;
* opportunities;
* organization-wide intelligence.

## 5.7 AI Assistant

Needs:

* governed access to relevant knowledge;
* provenance;
* permissions;
* semantic retrieval;
* relationship traversal;
* temporal context.

---

# 6. Product Architecture

The platform is divided into nine domains:

```text
Knowledge Capture
Knowledge Objects
Knowledge Relationships
Knowledge Spaces
Knowledge Evidence
Knowledge Intelligence
Idea Intelligence
Knowledge Retrieval
Knowledge Governance
```

These domains sit above the application modules.

```text
                 SMARTSAPP APPLICATIONS
 ┌──────────────────────────────────────────────┐
 │ CRM │ Campaigns │ Calls │ Meetings │ Tasks  │
 │ Forms │ Surveys │ Messaging │ QR │ Leads   │
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
             KNOWLEDGE INTELLIGENCE LAYER
 ┌──────────────────────────────────────────────┐
 │ Objects │ Graph │ Evidence │ AI │ Search    │
 │ Ideas   │ Insights │ Decisions │ Provenance │
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
                CAMPAIGN INTELLIGENCE
```

---

# 7. Core Domain Model

## 7.1 Knowledge Object

The fundamental entity.

```typescript
interface KnowledgeObject {
  id: string;

  organizationId: string;
  workspaceId: string;

  type: KnowledgeObjectType;
  subtype?: string;

  status: KnowledgeObjectStatus;

  title?: string;

  document: NoteDocument;
  plainText: string;

  author: KnowledgeAuthor;

  visibility: KnowledgeVisibility;

  source: KnowledgeSource;

  provenance: KnowledgeProvenance[];

  tags: KnowledgeTag[];
  entities: KnowledgeEntityReference[];

  customFields: Record<string, unknown>;

  ai?: KnowledgeAIState;

  embedding?: KnowledgeEmbeddingState;

  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

---

# 8. Knowledge Object Types

Built-in types:

```text
note
idea
observation
feedback
question
problem
opportunity
insight
hypothesis
decision
commitment
action
research
strategy
meeting_note
call_note
customer_statement
risk
assumption
experiment
campaign_concept
reference
summary
```

Organizations may create custom types.

---

# 9. Knowledge Object Status

Generic lifecycle:

```text
draft
active
under_review
confirmed
actioned
archived
superseded
rejected
deleted
```

Types may define specialized state machines.

---

# 10. Fact vs Inference Model

Every meaningful knowledge statement should be classifiable.

```text
FACT
USER_OPINION
CUSTOMER_STATEMENT
OBSERVATION
INTERPRETATION
AI_INFERENCE
AI_RECOMMENDATION
```

Example:

```text
Fact:
"The school has 620 students."

Customer statement:
"The principal wants automated reminders."

Observation:
"The principal repeatedly asked about payment reporting."

AI inference:
"The school may have high purchase intent."

AI recommendation:
"Prioritize this account for the Billing Automation campaign."
```

AI inference must never silently become fact.

---

# 11. Knowledge Provenance

```typescript
interface KnowledgeProvenance {
  id: string;

  sourceType:
    | 'user'
    | 'call'
    | 'meeting'
    | 'email'
    | 'sms'
    | 'form'
    | 'survey'
    | 'campaign'
    | 'crm_activity'
    | 'document'
    | 'import'
    | 'ai';

  sourceId?: string;
  sourceEventId?: string;

  sourceAuthorId?: string;

  sourceTimestamp?: Timestamp;

  excerpt?: string;

  extractionMethod?:
    | 'manual'
    | 'transcription'
    | 'ocr'
    | 'ai_extraction'
    | 'system_event'
    | 'import';

  confidence?: number;
}
```

---

# 12. Knowledge Relationships

Relationships are first-class objects.

```typescript
interface KnowledgeRelation {
  id: string;

  organizationId: string;
  workspaceId: string;

  fromObjectId: string;
  toObjectId: string;

  relationType: KnowledgeRelationType;

  confidence?: number;

  source:
    | 'user'
    | 'ai'
    | 'system';

  createdBy?: string;

  createdAt: Timestamp;

  metadata?: Record<string, unknown>;
}
```

---

# 13. Relationship Types

Core relationships:

```text
related_to
supports
contradicts
depends_on
derived_from
inspired_by
duplicates
supersedes
blocks
solves
causes
affects
requires
implements
validates
invalidates
expands
summarizes
responds_to
references
evidences
belongs_to
```

CRM relationships:

```text
mentioned_by_contact
about_contact
about_school
about_deal
about_campaign
about_product
about_segment
```

Strategy relationships:

```text
targets
addresses
creates
requires
tests
measures
prioritizes
```

---

# 14. Knowledge Entity References

Knowledge objects can reference non-knowledge application entities.

```typescript
interface KnowledgeEntityReference {
  entityType:
    | 'contact'
    | 'lead'
    | 'school'
    | 'deal'
    | 'campaign'
    | 'task'
    | 'meeting'
    | 'call'
    | 'form'
    | 'survey'
    | 'message'
    | 'product'
    | 'user'
    | 'document';

  entityId: string;

  entityName?: string;

  relationship?: string;

  confidence?: number;
}
```

---

# 15. Knowledge Spaces

Spaces provide organizational context.

Examples:

```text
Marketing
Sales
Product
Research
Strategy
Customer Success
Operations
Personal
```

```typescript
interface KnowledgeSpace {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  icon?: string;
  color?: string;

  visibility: 'private' | 'team' | 'workspace' | 'organization';

  defaultKnowledgeTypes?: string[];

  createdBy: string;
  createdAt: Timestamp;
}
```

---

# 16. Collections

Collections group knowledge without changing ownership.

Examples:

```text
Enrollment Growth
Billing Research
Customer Objections
Product Ideas
Q4 Strategy
School Feedback
```

---

# 17. Knowledge Templates

Templates accelerate structured capture.

Examples:

### Customer Call

```text
Customer
Purpose
Key discussion
Needs
Objections
Commitments
Next steps
Buying signal
```

### Product Idea

```text
Idea
Problem
Audience
Evidence
Assumption
Potential solution
Impact
Dependencies
Next experiment
```

### Campaign Idea

```text
Campaign concept
Audience
Problem
Message
Offer
Evidence
Expected outcome
Channels
```

---

# 18. Knowledge Custom Fields

Administrators can create:

```text
impact
confidence
priority
department
product
market
segment
status
owner
expected_value
risk
```

Field configuration:

```typescript
interface KnowledgeFieldDefinition {
  id: string;
  organizationId: string;
  workspaceId: string;

  name: string;
  key: string;

  type:
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'select'
    | 'multi_select'
    | 'user'
    | 'entity';

  required: boolean;

  options?: string[];

  aiExtractable: boolean;

  createdAt: Timestamp;
}
```

---

# 19. Idea Intelligence

Ideas become a first-class domain.

```typescript
interface Idea {
  id: string;

  knowledgeObjectId: string;

  problem?: string;
  proposedSolution?: string;

  audience?: KnowledgeEntityReference[];

  assumptions: string[];

  hypotheses: string[];

  evidenceIds: string[];

  impact?: number;
  effort?: number;

  confidence?: number;

  validationStatus:
    | 'unvalidated'
    | 'testing'
    | 'supported'
    | 'validated'
    | 'invalidated';

  priority?: number;

  relatedIdeaIds: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 20. Idea Lifecycle

```text
Captured
   ↓
Exploring
   ↓
Structured
   ↓
Evidence Gathering
   ↓
Validating
   ↓
Validated
   ↓
Approved
   ↓
Implemented
   ↓
Measured
   ↓
Archived
```

Alternative exit:

```text
Exploring → Rejected
Validating → Invalidated
Approved → Superseded
```

---

# 21. Idea Canvas

The Idea Canvas is a visual graph editor.

Nodes are Knowledge Objects.

Edges are Knowledge Relations.

Example:

```text
                  CORE IDEA
                      │
       ┌──────────────┼───────────────┐
       ↓              ↓               ↓
    Problem       Audience         Outcome
       │
       ├──── Evidence
       │
       ├──── Assumption
       │
       └──── Solution
                  │
                  ↓
              Experiment
                  │
                  ↓
               Result
```

Every node remains independently searchable.

---

# 22. Insight Model

```typescript
interface KnowledgeInsight {
  id: string;

  organizationId: string;
  workspaceId: string;

  title: string;
  description: string;

  insightType:
    | 'trend'
    | 'pattern'
    | 'risk'
    | 'opportunity'
    | 'customer_signal'
    | 'campaign_signal'
    | 'product_signal';

  evidenceIds: string[];

  confidence: number;

  impact?: number;

  status:
    | 'detected'
    | 'reviewing'
    | 'confirmed'
    | 'actioned'
    | 'dismissed';

  generatedBy: 'ai' | 'system' | 'user';

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 23. Decision Model

```typescript
interface KnowledgeDecision {
  id: string;

  knowledgeObjectId: string;

  decision: string;

  rationale?: string;

  alternatives?: string[];

  evidenceIds: string[];

  decisionOwnerId: string;

  status:
    | 'proposed'
    | 'under_review'
    | 'approved'
    | 'superseded';

  effectiveFrom?: Timestamp;

  supersededBy?: string;
}
```

---

# 24. Action Model

Actions extracted from knowledge should reference the source.

```typescript
interface KnowledgeAction {
  id: string;

  sourceKnowledgeId: string;

  title: string;

  ownerId?: string;

  dueAt?: Timestamp;

  priority:
    | 'low'
    | 'medium'
    | 'high'
    | 'urgent';

  status:
    | 'suggested'
    | 'accepted'
    | 'converted'
    | 'dismissed';

  taskId?: string;
}
```

---

# 25. AI State

```typescript
interface KnowledgeAIState {
  summary?: string;

  classification?: {
    type: string;
    confidence: number;
  };

  topics?: string[];

  entities?: KnowledgeEntityReference[];

  sentiment?: {
    value: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };

  intent?: string;

  urgency?: number;

  risks?: string[];

  opportunities?: string[];

  actionItems?: KnowledgeAction[];

  contradictions?: string[];

  relatedObjects?: {
    objectId: string;
    score: number;
    reason?: string;
  }[];

  generatedAt?: Timestamp;

  modelVersion?: string;
}
```

---

# 26. Embedding Architecture

Embeddings should no longer be attached only to Quick Notes.

```typescript
interface KnowledgeEmbedding {
  objectId: string;

  embeddingVersion: number;

  model: string;

  dimensions: number;

  vectorReference: string;

  indexedAt: Timestamp;
}
```

Embedding strategy:

```text
Object title
+
plain text
+
type
+
tags
+
entity context
+
selected metadata
```

Sensitive metadata must never be embedded unless policy permits it.

---

# 27. Knowledge Retrieval Architecture

Use hybrid retrieval:

```text
Keyword Search
       +
Semantic Search
       +
Entity Search
       +
Metadata Filtering
       +
Graph Traversal
       +
Recency
       +
Authority
       +
Permissions
```

Retrieval pipeline:

```text
User Query
   ↓
Query Understanding
   ↓
Intent Detection
   ↓
Entity Resolution
   ↓
Keyword Retrieval
   ↓
Vector Retrieval
   ↓
Graph Retrieval
   ↓
Permission Filter
   ↓
Ranking
   ↓
Evidence Selection
   ↓
LLM Synthesis
   ↓
Citation / Evidence
```

---

# 28. "Ask SmartSapp Knowledge"

The successor to "Ask Your Notes."

Users can ask:

> What payment concerns have schools raised recently?

> Which customers mentioned automated reminders?

> What decisions have we made about the enrollment campaign?

> What ideas address low conversion?

> What evidence supports this campaign strategy?

> What customer objections remain unresolved?

> Which ideas contradict our current strategy?

Responses should contain:

```text
Answer
Confidence
Evidence
Related records
Recommended actions
```

---

# 29. RAG Architecture

The RAG system must be permission-aware.

```text
Query
 ↓
Authentication
 ↓
Authorization Context
 ↓
Query Planner
 ↓
Retrieval
 ├── Firestore
 ├── Search Index
 ├── Vector Store
 └── Knowledge Graph
 ↓
Evidence Ranking
 ↓
Context Assembly
 ↓
LLM
 ↓
Grounded Answer
 ↓
Citations
```

No retrieval result may bypass SmartSapp permissions.

---

# 30. RAG Chunking

Documents should be chunked by semantic structure rather than arbitrary character count where possible.

Chunk metadata:

```text
organizationId
workspaceId
objectId
chunkId
objectType
section
sourceType
sourceId
createdAt
updatedAt
visibility
permissions
embeddingVersion
```

---

# 31. AI Agent Architecture

## Capture Agent

Responsibilities:

* interpret raw capture;
* classify object;
* derive title;
* identify entities;
* extract actions;
* identify dates;
* suggest relationships.

## Classification Agent

Determines:

* knowledge type;
* subtype;
* intent;
* topic;
* urgency;
* confidence.

## Linking Agent

Finds:

* contacts;
* schools;
* deals;
* campaigns;
* related knowledge;
* duplicate knowledge.

## Evidence Agent

Finds supporting and contradictory evidence.

## Idea Agent

Can:

* expand ideas;
* identify assumptions;
* challenge ideas;
* generate alternatives;
* structure hypotheses;
* recommend experiments.

## Insight Agent

Detects:

* trends;
* recurring problems;
* risks;
* opportunities;
* emerging themes.

## Campaign Agent

Connects knowledge to:

* audiences;
* campaigns;
* messaging;
* offers;
* segments;
* performance.

## Action Agent

Converts knowledge into:

* tasks;
* reminders;
* workflows;
* campaigns;
* meetings;
* follow-ups.

## Governance Agent

Checks:

* sensitive information;
* unsupported assertions;
* permission boundaries;
* hallucinations;
* duplicate insights;
* inappropriate auto-publishing.

---

# 32. Human-in-the-Loop Architecture

AI-generated knowledge enters:

## Knowledge Inbox

Example:

```text
AI detected a recurring customer concern.

"Payment reconciliation appears to be a recurring
objection among medium-sized schools."

Evidence:
7 CRM notes
4 calls
2 meetings

Confidence: High

[Confirm]
[Review Evidence]
[Dismiss]
```

Only confirmed knowledge should be promoted to authoritative insight when configured by the organization.

---

# 33. Contradiction Detection

AI should identify conflicting knowledge.

Example:

```text
Assumption:
Schools dislike automated reminders.

Contradictory evidence:
8 schools requested automated reminders.
```

The system should not automatically delete either statement.

Instead:

```text
Contradiction detected
[Review evidence]
[Create investigation]
[Resolve]
```

---

# 34. Duplicate Detection

When users create knowledge:

```text
Possible duplicate

"Automated fee reminders are a major customer request."

Similar:
"Schools repeatedly request automatic fee reminders."

Similarity: 94%

[Merge]
[Link]
[Keep Separate]
```

---

# 35. Knowledge Timeline

Every important entity should have a knowledge timeline.

Example:

```text
CONTACT
──────────────────────────────

Sep 4
Strong buying signal detected

Sep 3
Requested payment report

Sep 1
Attended Billing webinar

Aug 29
Raised reconciliation concern

Aug 25
Initial sales conversation
```

Timeline can combine:

* notes;
* calls;
* meetings;
* emails;
* campaign events;
* tasks;
* decisions;
* AI insights.

---

# 36. CRM Integration

Knowledge must be embedded throughout CRM.

## Contact

Tabs:

```text
Overview
Activity
Knowledge
Deals
Messages
Campaigns
```

Knowledge section:

```text
Notes
Customer Statements
Pain Points
Buying Signals
Commitments
Insights
Ideas
AI Summary
```

## Deal

Knowledge should capture:

* objections;
* decision criteria;
* stakeholders;
* commitments;
* risks;
* opportunities;
* next steps.

## Lead

Knowledge contributes to:

* qualification;
* lead scoring;
* intent;
* campaign routing.

---

# 37. Campaign Intelligence Integration

Campaign Intelligence consumes:

```text
Customer feedback
Customer objections
Ideas
Insights
Buying signals
Problems
Opportunities
Historical campaign knowledge
```

Campaign Intelligence can generate:

```text
Audience hypotheses
Message hypotheses
Offer ideas
Content ideas
Objection handling
Campaign concepts
Segment insights
```

---

# 38. Bidirectional Campaign Integration

```text
Knowledge
    ↓
Campaign Intelligence
    ↓
Campaign recommendation
    ↓
Campaign
    ↓
Performance
    ↓
Campaign Intelligence
    ↓
Knowledge Insight
```

Example:

```text
Customer feedback
      ↓
Payment reconciliation concern
      ↓
Campaign insight
      ↓
Billing campaign concept
      ↓
Campaign execution
      ↓
Performance data
      ↓
New knowledge
```

---

# 39. Cross-App Integration

## Meetings

Meeting transcripts automatically produce:

* summary;
* decisions;
* action items;
* customer statements;
* ideas;
* risks.

## Calls

Call notes/transcripts become knowledge candidates.

## Forms

Form responses can produce aggregated insights.

## Surveys

Survey findings can become research knowledge.

## Messaging

Important customer conversations can be promoted to knowledge.

## QR

QR interaction insights can be associated with campaigns and entities.

## Lead Intelligence

Discovered lead information can become contextual knowledge.

## Sales Performance

Performance trends can produce insights.

## Finance

Customer payment behavior can provide contextual intelligence where permitted.

---

# 40. Event Taxonomy

Core events:

```text
knowledge.created
knowledge.updated
knowledge.deleted
knowledge.archived
knowledge.restored
knowledge.version_created

knowledge.classified
knowledge.linked
knowledge.unlinked
knowledge.merged

knowledge.embedding.created
knowledge.embedding.updated
knowledge.indexed

knowledge.ai.summary_generated
knowledge.ai.tags_generated
knowledge.ai.actions_extracted
knowledge.ai.entities_extracted
knowledge.ai.insight_detected
knowledge.ai.contradiction_detected
knowledge.ai.duplicate_detected

idea.created
idea.updated
idea.mapped
idea.validated
idea.invalidated
idea.approved
idea.implemented

insight.detected
insight.reviewed
insight.confirmed
insight.dismissed
insight.actioned

decision.proposed
decision.approved
decision.superseded

knowledge.action.created
knowledge.action.accepted
knowledge.action.converted

knowledge.campaign_signal.detected
knowledge.campaign_signal.confirmed
knowledge.campaign_signal.dismissed
```

---

# 41. Event Envelope

```typescript
interface KnowledgeEvent {
  id: string;

  eventType: string;

  organizationId: string;
  workspaceId: string;

  actorId?: string;

  objectId?: string;

  entityType?: string;
  entityId?: string;

  timestamp: Timestamp;

  correlationId?: string;

  causationId?: string;

  payload: Record<string, unknown>;

  schemaVersion: number;
}
```

---

# 42. State Machine: Knowledge Object

```text
DRAFT
  ↓
ACTIVE
  ↓
UNDER_REVIEW
  ↓
CONFIRMED
  ↓
ACTIONED
  ↓
ARCHIVED
```

Alternate:

```text
ACTIVE → REJECTED
ACTIVE → ARCHIVED
CONFIRMED → SUPERSEDED
```

---

# 43. State Machine: AI Insight

```text
DETECTED
   ↓
REVIEWING
   ↓
CONFIRMED
   ↓
ACTIONED
```

Alternative:

```text
DETECTED → DISMISSED
REVIEWING → DISMISSED
CONFIRMED → SUPERSEDED
```

---

# 44. State Machine: Idea

```text
CAPTURED
   ↓
EXPLORING
   ↓
STRUCTURED
   ↓
EVIDENCE_GATHERING
   ↓
VALIDATING
   ↓
VALIDATED
   ↓
APPROVED
   ↓
IMPLEMENTED
   ↓
MEASURED
```

---

# 45. State Machine: Decision

```text
PROPOSED
   ↓
UNDER_REVIEW
   ↓
APPROVED
   ↓
ACTIVE
```

or:

```text
APPROVED → SUPERSEDED
PROPOSED → REJECTED
```

---

# 46. Firestore Architecture

Recommended target:

```text
/organizations/{organizationId}

/organizations/{organizationId}/workspaces/{workspaceId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge/{knowledgeId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_relations/{relationId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_spaces/{spaceId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_collections/{collectionId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_fields/{fieldId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_templates/{templateId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_insights/{insightId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_decisions/{decisionId}

/organizations/{organizationId}/workspaces/{workspaceId}/knowledge_events/{eventId}
```

---

# 47. Search Projections

Do not perform expensive graph or aggregation queries directly against primary documents.

Create projections:

```text
knowledge_search_index
knowledge_embedding_index
knowledge_entity_index
knowledge_timeline_index
knowledge_graph_edges
knowledge_ai_index
```

These are derived and rebuildable.

---

# 48. Migration Strategy

Existing collections:

```text
quick_notes
entity_notes
task_notes
call_notes
note_index
quick_note_categories
```

should be treated as legacy/source collections during migration.

The existing adapter pattern already provides a useful abstraction for these sources.

Migration:

```text
Legacy Note
    ↓
Normalizer
    ↓
Knowledge Object
    ↓
Entity Resolution
    ↓
Relationship Creation
    ↓
Embedding
    ↓
Search Projection
```

---

# 49. Backward Compatibility

For a defined migration period:

```text
Old Notes API
     ↓
Compatibility Layer
     ↓
Knowledge Service
```

Existing components should continue functioning while progressively moving to the new service.

Do not perform a destructive big-bang migration.

---

# 50. Data Migration Rules

### Quick Notes

Map to:

```text
type = note
sourceType = user
```

### Entity Notes

Map to:

```text
type = note
entityReferences = target CRM entity
```

### Task Notes

Map to:

```text
type = observation/action
sourceType = task
```

### Call Notes

Map to:

```text
type = call_note
sourceType = call
```

### AI Metadata

Existing summaries/tags/actions should be preserved and versioned.

### Categories

Map to:

```text
space
collection
or classification metadata
```

---

# 51. API Architecture

Expose a Knowledge Service rather than individual note APIs.

## Create

```http
POST /api/v2/knowledge
```

## Retrieve

```http
GET /api/v2/knowledge/:id
```

## Update

```http
PATCH /api/v2/knowledge/:id
```

## Delete

```http
DELETE /api/v2/knowledge/:id
```

## Search

```http
POST /api/v2/knowledge/search
```

## Ask

```http
POST /api/v2/knowledge/ask
```

## Related

```http
GET /api/v2/knowledge/:id/related
```

## Graph

```http
GET /api/v2/knowledge/:id/graph
```

## Insights

```http
GET /api/v2/knowledge/insights
```

## Ideas

```http
POST /api/v2/knowledge/ideas
```

## Relationships

```http
POST /api/v2/knowledge/relations
```

---

# 52. Search Request

```typescript
interface KnowledgeSearchRequest {
  query?: string;

  types?: string[];

  statuses?: string[];

  spaceIds?: string[];

  collectionIds?: string[];

  entityIds?: string[];

  authorIds?: string[];

  tags?: string[];

  dateFrom?: string;
  dateTo?: string;

  includeArchived?: boolean;

  mode:
    | 'keyword'
    | 'semantic'
    | 'hybrid'
    | 'graph';

  limit?: number;
}
```

---

# 53. Ask API

```typescript
interface KnowledgeAskRequest {
  question: string;

  workspaceId: string;

  contextEntity?: {
    type: string;
    id: string;
  };

  filters?: KnowledgeSearchRequest;

  includeEvidence: boolean;

  maxSources?: number;
}
```

Response:

```typescript
interface KnowledgeAskResponse {
  answer: string;

  confidence?: number;

  evidence: KnowledgeEvidence[];

  relatedObjects: string[];

  suggestedActions?: string[];

  generatedAt: string;

  modelVersion: string;
}
```

---

# 54. Security Architecture

Every request must enforce:

```text
organization boundary
+
workspace boundary
+
object visibility
+
role permissions
+
team permissions
+
entity permissions
+
AI retrieval permissions
```

AI retrieval must use the same authorization model as direct UI retrieval.

---

# 55. Permission Model

Capabilities:

```text
knowledge.view
knowledge.create
knowledge.edit
knowledge.delete
knowledge.share
knowledge.export
knowledge.manage
knowledge.ai
knowledge.graph
knowledge.insights
knowledge.ideas
knowledge.decisions
knowledge.admin
```

Object visibility:

```text
private
team
department
workspace
organization
```

---

# 56. Sensitive Knowledge

Organizations may designate knowledge as:

```text
normal
confidential
restricted
```

Restricted knowledge should:

* require elevated permissions;
* be excluded from general AI retrieval;
* appear only in authorized contexts;
* be audited when accessed.

---

# 57. Audit Architecture

Record:

```text
created
edited
viewed
shared
linked
unlinked
exported
AI generated
AI accessed
approved
rejected
deleted
restored
```

AI-generated changes should record:

```text
model
prompt/template version
source evidence
actor
timestamp
confidence
```

---

# 58. AI Governance

AI may:

* recommend;
* summarize;
* classify;
* extract;
* link;
* detect;
* suggest.

AI should not automatically:

* alter authoritative facts;
* overwrite decisions;
* delete knowledge;
* expose restricted information;
* make irreversible CRM changes;
* publish campaigns without configured authorization.

High-impact actions require explicit approval.

---

# 59. Billing & Entitlements

Knowledge should use a combination of feature entitlements and AI consumption.

Core limits may include:

```text
knowledge objects
storage
attachments
AI generations
AI queries
embeddings
transcription minutes
OCR pages
graph size
automation executions
```

Potential entitlement tiers:

```text
Knowledge Core
Knowledge Pro
Knowledge Intelligence
Knowledge Enterprise
```

---

# 60. Usage Metering

Meter:

```text
knowledge.created
ai.request
ai.tokens
embedding.created
transcription.minute
ocr.page
search.semantic
knowledge.ask
graph.query
attachment.processed
```

AI usage should be tracked by:

```text
organization
workspace
user
feature
model
request
token usage
```

---

# 61. Cost Controls

Implement:

* per-user rate limits;
* workspace quotas;
* organization quotas;
* AI budget alerts;
* model routing;
* caching;
* embedding reuse;
* result caching;
* batch processing;
* low-cost model selection for simple operations.

---

# 62. Observability

Monitor:

```text
knowledge creation latency
search latency
RAG latency
AI latency
embedding failures
index failures
graph traversal latency
AI cost
token consumption
error rate
permission failures
migration status
```

Key SLO targets:

* normal capture: <500ms perceived response;
* search: <1.5s target;
* semantic search: <2.5s target;
* AI synthesis: streaming response begins quickly;
* background indexing: eventual consistency within defined SLA.

---

# 63. Reliability

Use:

```text
idempotency keys
event retries
dead-letter queues
transactional writes
optimistic concurrency
versioned schemas
rebuildable projections
```

The existing optimistic concurrency mechanism should be retained and generalized to Knowledge Objects.

---

# 64. Offline Architecture

Mobile should support:

```text
local draft
offline queue
sync state
conflict detection
retry
```

Recommended architecture:

```text
UI
 ↓
Local Knowledge Store
 ↓
Sync Queue
 ↓
Knowledge API
 ↓
Firestore
```

---

# 65. Collaboration

Future collaborative editing can use CRDT-based document synchronization.

The current roadmap's consideration of TipTap collaboration infrastructure provides a logical extension point.

Collaboration should support:

* multiple editors;
* presence;
* comments;
* mentions;
* suggestions;
* version history.

---

# 66. Attachments

Supported:

```text
images
PDF
DOCX
XLSX
audio
video
web pages
screenshots
```

Pipeline:

```text
Upload
 ↓
Security Scan
 ↓
Metadata
 ↓
OCR / Transcription
 ↓
Text Extraction
 ↓
Chunking
 ↓
Embedding
 ↓
Knowledge Index
```

---

# 67. Voice Capture

Global capture should support:

```text
Tap record
 ↓
Speak
 ↓
Transcribe
 ↓
Classify
 ↓
Extract
 ↓
Link
 ↓
Preview
 ↓
Save
```

Example:

```text
"The principal wants the payment report before Friday."

AI detects:

Customer statement
Deadline
Contact
School
Task
Payment topic
```

---

# 68. Global Capture Experience

The existing `Alt + N` global capture concept should remain, but evolve from a note composer into a universal Knowledge Capture surface.

Modes:

```text
Note
Idea
Feedback
Observation
Question
Decision
Task
Voice
```

AI may automatically classify the capture.

---

# 69. AI Command System

Inside the editor:

```text
/summarize
/expand
/rewrite
/brainstorm
/challenge
/find-related
/find-evidence
/extract-actions
/create-task
/create-idea
/create-campaign
/link-contact
/link-deal
/ask
```

---

# 70. Campaign Intelligence Outputs

Knowledge should produce:

```text
customer pain point
customer objection
buying signal
market signal
content opportunity
campaign idea
audience insight
message opportunity
product opportunity
risk
```

---

# 71. Analytics Model

Core metrics:

### Knowledge Activity

```text
objects created
objects updated
active contributors
knowledge growth
```

### Knowledge Quality

```text
linked objects
confirmed insights
duplicate rate
AI confidence
evidence coverage
```

### Idea Intelligence

```text
ideas created
ideas validated
ideas implemented
validation rate
idea-to-action conversion
```

### CRM Intelligence

```text
customer insights
buying signals
objections
follow-ups
knowledge per account
```

### Campaign Intelligence

```text
knowledge signals
campaign insights
ideas generated
campaign recommendations
insight-to-campaign conversion
```

---

# 72. Knowledge Health Score

Each workspace can have:

```text
Knowledge Health
────────────────────

Coverage       82%
Connectivity   74%
Freshness      88%
Evidence       79%
Actionability  71%
AI readiness   91%
```

This gives administrators visibility into knowledge quality.

---

# 73. Knowledge Graph Analytics

Track:

```text
most connected entities
emerging topics
knowledge clusters
relationship density
isolated knowledge
rapidly growing topics
contradiction clusters
```

These can reveal strategic signals.

---

# 74. Data Retention

Organizations should configure:

```text
active retention
archive retention
deleted retention
audit retention
AI artifact retention
```

Deletion should support soft deletion and governed hard deletion.

---

# 75. Export

Supported:

```text
Markdown
PDF
DOCX
JSON
CSV
```

Graph export:

```text
nodes
edges
metadata
```

AI-generated content must preserve provenance in export metadata.

---

# 76. UI/UX Architecture

## Primary Navigation

Desktop:

```text
Knowledge
├── Home
├── Inbox
├── Notes
├── Ideas
├── Insights
├── Decisions
├── Research
├── Collections
├── Canvas
├── Graph
├── Timeline
└── AI
```

The interface should avoid forcing users to understand this taxonomy initially.

The default experience should be:

```text
Capture
Search
Recent
AI
```

Advanced areas progressively reveal themselves.

---

# 77. Knowledge Home

Desktop layout:

```text
┌──────────────────────────────────────────────────────┐
│ Knowledge                       Search / Ask AI       │
├────────────┬────────────────────────┬────────────────┤
│ Spaces     │ Recent Knowledge       │ AI Signals     │
│            │                        │                │
│ Marketing  │ Notes                  │ 3 emerging     │
│ Sales      │ Ideas                  │ themes         │
│ Strategy   │ Insights               │                │
│ Research   │ Decisions              │                │
│            │                        │                │
├────────────┴────────────────────────┴────────────────┤
│                    Capture                            │
└──────────────────────────────────────────────────────┘
```

---

# 78. Mobile Navigation

Mobile should use:

```text
Home
Search
Capture
Ideas
AI
```

Secondary functionality lives behind contextual menus and sheets.

---

# 79. Knowledge Card

Each card should show:

```text
Type
Title
Summary
Author
Related entities
Tags
AI signals
Last updated
```

Optional:

```text
Confidence
Evidence count
Action count
```

---

# 80. Note Editor

Editor capabilities:

```text
rich text
slash commands
attachments
mentions
CRM links
AI commands
checklists
tables
callouts
knowledge blocks
```

AI toolbar:

```text
Improve
Summarize
Extract
Connect
Challenge
Act
```

---

# 81. Idea Canvas UX

Desktop-first.

Toolbar:

```text
Select
Move
Connect
Create
Group
AI
Zoom
Fit
```

AI actions:

```text
Expand idea
Find evidence
Challenge
Generate alternatives
Find related ideas
Convert to campaign
```

Mobile should use a simplified node stack rather than attempting full desktop graph manipulation.

---

# 82. Graph View

Graph controls:

```text
Depth
Object type
Relationship type
Entity
Time
Confidence
```

Example:

```text
Campaign
   │
   ├── Customer Feedback
   │
   ├── Insight
   │
   ├── Idea
   │
   └── Task
```

---

# 83. AI Workspace

The AI surface should provide:

```text
Ask
Summarize
Investigate
Brainstorm
Challenge
Plan
```

Conversation context can be:

```text
Current note
Current contact
Current deal
Current campaign
Current space
Entire workspace
```

---

# 84. Phase-by-Phase Implementation

# Phase 0 — Architecture & Safety Foundation

### Objectives

Create the new Knowledge domain without disrupting production.

### Backend

* Knowledge Object schema.
* Relation schema.
* Provenance schema.
* permission model.
* event envelope.
* API contracts.
* migration framework.

### Frontend

* Knowledge navigation shell.
* capture abstraction.
* object renderer.

### AI

* model abstraction.
* AI policy engine.
* audit hooks.

### Deliverable

New Knowledge service running beside existing Notes.

---

# Phase 1 — Unified Knowledge Core

### Build

* Knowledge Objects.
* CRUD.
* versioning.
* visibility.
* tags.
* custom fields.
* templates.
* spaces.
* collections.

### Migration

Migrate Quick Notes first.

### UX

* Knowledge Home.
* Notes view.
* editor.
* filters.
* search.

### Exit Criteria

Users can create and manage Knowledge Objects without using legacy Quick Notes directly.

---

# Phase 2 — Universal Capture

### Build

* global capture.
* entity-aware capture.
* AI classification.
* mobile capture.
* voice capture.
* drafts.
* attachments.

### AI

Capture Agent.

### UX

* universal composer;
* capture modes;
* AI preview;
* confirmation flow.

---

# Phase 3 — CRM Knowledge

### Build

* Contact Knowledge.
* Lead Knowledge.
* School Knowledge.
* Deal Knowledge.
* Call Knowledge.
* Meeting Knowledge.
* Task Knowledge.

### Build

Knowledge Timeline.

### AI

Entity Resolution Agent.

### Exit Criteria

A user can open any CRM entity and understand its complete knowledge history.

---

# Phase 4 — Search & RAG

### Build

* hybrid search;
* embeddings;
* semantic search;
* entity filtering;
* permission-aware retrieval;
* Ask SmartSapp Knowledge.

### AI

RAG orchestration.

### UX

* global search;
* Ask interface;
* evidence panel;
* related knowledge.

---

# Phase 5 — Knowledge Graph

### Build

* typed relationships;
* graph storage;
* graph traversal;
* relationship UI;
* automatic relationship detection.

### AI

Linking Agent.

### UX

* Graph View;
* Related Knowledge;
* relationship editor.

---

# Phase 6 — Idea Intelligence

### Build

* Idea objects;
* idea states;
* assumptions;
* hypotheses;
* evidence;
* experiments;
* validation.

### UX

Idea Studio.

### AI

Idea Agent.

### Exit Criteria

Users can take a raw thought and develop it into an evidence-backed idea.

---

# Phase 7 — Insights & Governance

### Build

* AI Insights;
* Knowledge Inbox;
* contradiction detection;
* duplicate detection;
* evidence scoring;
* human approval.

### UX

Insight Center.

### AI

Insight Agent + Governance Agent.

---

# Phase 8 — Campaign Intelligence Integration

### Build

Knowledge → Campaign signals.

Campaign → Knowledge.

### AI

Campaign Agent.

### Outputs

* campaign ideas;
* audience insights;
* message recommendations;
* objection analysis;
* content opportunities.

### Exit Criteria

Campaign Intelligence can use governed Knowledge as a first-class intelligence source.

---

# Phase 9 — Cross-Platform Intelligence

Integrate:

* Forms;
* Surveys;
* Messaging;
* QR;
* Lead Intelligence;
* Sales Performance;
* Meetings;
* Finance;
* Training;
* other SmartSapp modules.

Build organization-wide Knowledge Graph.

---

# Phase 10 — Advanced Intelligence

Future:

* predictive knowledge;
* emerging-theme detection;
* strategic simulations;
* autonomous research;
* continuous campaign learning;
* organization memory;
* executive intelligence;
* advanced AI agents.

---

# 85. Phase-to-Architecture Mapping

| Domain                 | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 |
| ---------------------- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Knowledge Object       | ✓  | ✓  |    |    |    |    |    |    |    |    |
| Provenance             | ✓  | ✓  | ✓  | ✓  | ✓  |    |    | ✓  | ✓  |    |
| Capture                |    | ✓  | ✓  |    |    |    |    |    |    |    |
| CRM                    |    |    |    | ✓  |    |    |    |    | ✓  | ✓  |
| Search                 | ✓  |    |    |    | ✓  | ✓  |    |    |    |    |
| RAG                    |    |    |    |    | ✓  | ✓  |    | ✓  | ✓  | ✓  |
| Graph                  |    |    |    |    |    | ✓  | ✓  | ✓  | ✓  | ✓  |
| Ideas                  |    |    |    |    |    |    | ✓  |    | ✓  | ✓  |
| Insights               |    |    |    |    |    |    |    | ✓  | ✓  | ✓  |
| Campaign Intelligence  |    |    |    |    |    |    |    |    | ✓  | ✓  |
| Cross-App Intelligence |    |    |    |    |    |    |    |    |    | ✓  |

---

# 86. Testing Strategy

## Unit Tests

Test:

* document parsing;
* validation;
* title extraction;
* classification;
* relationship rules;
* permission evaluation.

## Integration Tests

Test:

* CRM linking;
* Firestore;
* search;
* embeddings;
* event processing;
* AI orchestration.

## Security Tests

Test:

* tenant isolation;
* workspace isolation;
* restricted knowledge;
* AI retrieval;
* export permissions.

## AI Evaluation

Measure:

```text
classification accuracy
entity resolution accuracy
relationship precision
RAG groundedness
citation correctness
hallucination rate
action extraction accuracy
duplicate detection precision
```

---

# 87. AI Quality Gates

AI features should not launch merely because they produce plausible text.

Each production AI workflow requires:

```text
offline evaluation
golden datasets
permission tests
hallucination tests
adversarial tests
cost tests
latency tests
regression tests
```

---

# 88. Rollout Strategy

Use feature flags:

```text
knowledge_v2
knowledge_capture_v2
knowledge_search_v2
knowledge_graph
knowledge_ai
knowledge_ideas
knowledge_campaign_intelligence
```

Roll out:

```text
internal users
↓
pilot workspaces
↓
5%
↓
25%
↓
50%
↓
100%
```

---

# 89. Migration Rollback

Never delete legacy data until:

```text
migration verified
search verified
permissions verified
AI indexing verified
analytics verified
user acceptance completed
```

Legacy collections should remain read-only during the final migration period.

---

# 90. Success Metrics

## Adoption

* % active users creating knowledge.
* weekly knowledge contributors.
* capture frequency.
* mobile capture usage.

## Intelligence

* % knowledge linked to entities.
* % knowledge with provenance.
* AI-assisted capture rate.
* evidence-backed insight rate.

## Productivity

* knowledge → task conversion.
* knowledge → campaign conversion.
* search success rate.
* time-to-find information.

## Strategic Value

* validated ideas.
* implemented ideas.
* insights acted upon.
* campaign recommendations accepted.
* customer problems detected.

---

# 91. North Star Metric

## **Knowledge-to-Action Rate**

Percentage of meaningful knowledge objects that result in one or more valuable downstream actions:

```text
task
decision
campaign
follow-up
experiment
workflow
product change
```

This ensures the platform is measured on business value rather than note volume.

---

# 92. Final Target Architecture

```text
                         SMARTSAPP
                             │
      ┌──────────────────────┼──────────────────────┐
      │                      │                      │
   APPLICATIONS           KNOWLEDGE             AI LAYER
      │                      │                      │
 CRM / Campaigns       Objects                   Agents
 Calls / Meetings      Relations                 RAG
 Tasks / Forms         Evidence                  Synthesis
 Surveys / Messaging   Provenance                Recommendations
 QR / Lead Intel       Ideas                     Governance
 Finance / Training    Insights
      │                      │
      └──────────────────────┼──────────────────────┘
                             │
                      KNOWLEDGE GRAPH
                             │
                ┌────────────┼────────────┐
                │            │            │
              Search       Timeline     Analytics
                │            │            │
                └────────────┼────────────┘
                             │
                   CAMPAIGN INTELLIGENCE
                             │
                   SALES INTELLIGENCE
                             │
                  CUSTOMER INTELLIGENCE
                             │
                    SMARTSAPP AI
```

---

# 93. Product Definition

SmartSapp Knowledge & Idea Intelligence 2.0 should ultimately be understood as:

> **SmartSapp's organizational memory and thinking layer.**

It captures what people know.

It remembers what customers said.

It preserves why decisions were made.

It connects ideas to evidence.

It detects patterns humans may miss.

It challenges assumptions.

It turns knowledge into actions.

And it gives Campaign Intelligence access to the qualitative context that structured CRM and campaign events alone cannot provide.

The existing Notes module therefore becomes the **foundation**, not the destination.

The target architecture is:

```text
                    CAPTURE
                       ↓
                 KNOWLEDGE
                       ↓
                 CONTEXTUALIZE
                       ↓
                  CONNECT
                       ↓
                   EVIDENCE
                       ↓
                    REASON
                       ↓
                    INSIGHT
                       ↓
                     IDEA
                       ↓
                    DECISION
                       ↓
                    ACTION
                       ↓
                  OUTCOME
                       ↓
                  NEW KNOWLEDGE
```

This creates a continuous intelligence loop across the entire SmartSapp platform.
