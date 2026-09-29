# SmartSapp Organization Knowledge & Memory 2.0

## Product Requirements Document — AI-Native Organizational Memory, Knowledge Graph, Context & Agent Foundation

**Document status:** Proposed / Architecture Ready
**Product:** SmartSapp
**Version:** 2.0
**Primary objective:** Transform SmartSapp Notes & Knowledge into a unified, tenant-safe organizational memory platform that powers MCP tools, AI agents, contextual intelligence, and long-running agentic workflows across the entire SmartSapp ecosystem.

---

# 1. Executive Summary

SmartSapp already contains substantial AI capability: CRM intelligence, autonomous SDR functionality, meeting intelligence, surveys, forms, campaigns, creative AI, governance, summaries, AI-generated workflows, and a centralized Genkit gateway.

The architectural problem is no longer a lack of AI capabilities.

The problem is that these capabilities can still behave as **separate intelligence islands**.

SmartSapp Organization Knowledge & Memory 2.0 solves this by introducing a common intelligence substrate:

> **One organizational memory, one context layer, many tools, many agents.**

The system will unify:

* Notes
* Meeting transcripts
* CRM activity
* Deals
* Contacts/entities
* Campaigns
* Forms
* Surveys
* Tasks
* Documents
* Pages
* Financial events
* Customer interactions
* AI-generated insights
* Decisions
* Problems
* Opportunities
* Organizational knowledge

into a governed memory system.

The resulting architecture is:

```text
                       SMARTSAPP PLATFORM
                              │
                    ┌─────────▼─────────┐
                    │ Organization      │
                    │ Knowledge &       │
                    │ Memory 2.0        │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   Structured             Semantic              Relationship
     Truth                Memory                  Graph
   Firestore              Qdrant               Graph Layer
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Context Builder   │
                    │ + Memory Router   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ MCP Tool Platform │
                    └─────────┬─────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
              Agents       Humans       Workflows
```

---

# 2. Product Vision

## 2.1 Vision

Make SmartSapp capable of remembering what an organization knows, understanding how that knowledge is connected, retrieving the right context at the right moment, and safely making that context available to people, tools, and AI agents.

## 2.2 Product statement

> **SmartSapp Organization Knowledge & Memory is the continuously evolving institutional memory of every SmartSapp workspace.**

It should answer:

> What happened?

> What do we know?

> What changed?

> Why do we believe it?

> What is related?

> What should the organization remember?

> What should the agent know before acting?

> What information can this specific user or agent access?

---

# 3. Strategic Goals

## 3.1 Primary goals

1. Establish a canonical organization-memory layer.
2. Make Notes 2.0 the human-facing capture interface for organizational memory.
3. Create a unified `MemoryObject` model.
4. Store authoritative structured data in Firestore.
5. Store semantic representations in Qdrant.
6. Maintain relationship intelligence through a graph abstraction.
7. Create a reusable Context Builder.
8. Expose memory and platform capabilities through MCP.
9. Give agents governed access to organizational context.
10. Support long-running agentic workflows.
11. Preserve complete tenant and permission isolation.
12. Maintain provenance and explainability for every important memory.
13. Support memory confidence, freshness, contradiction and consolidation.
14. Allow AI-generated knowledge to be reviewed, accepted, rejected, or corrected.
15. Ensure every outbound or high-impact action retains human approval controls.

---

# 4. Non-Goals

Organization Knowledge & Memory 2.0 is **not initially** intended to:

* replace Firestore as the source of truth;
* make Qdrant the primary database;
* make the graph the primary database;
* give agents unrestricted database access;
* autonomously send outbound communications without approval;
* automatically treat AI-generated statements as verified facts;
* create a generic chatbot detached from SmartSapp data;
* require an enterprise graph database on day one;
* eliminate existing Genkit flows.

Existing AI flows should be **reused, wrapped, composed, and progressively upgraded**, not discarded.

---

# 5. Product Principles

## 5.1 Source of truth versus intelligence

The architecture explicitly separates:

| Layer           | Responsibility                  |
| --------------- | ------------------------------- |
| Firestore       | Authoritative operational truth |
| Qdrant          | Semantic retrieval              |
| Graph           | Relationship reasoning          |
| Memory Service  | Knowledge lifecycle             |
| Context Builder | Context assembly                |
| MCP             | Capability interface            |
| Agents          | Reasoning and planning          |
| Workflow engine | Persistent execution            |

---

## 5.2 AI is not the source of truth

AI may propose:

```text
Fact
Insight
Risk
Problem
Opportunity
Decision
Recommendation
```

but the system must retain:

```text
source
author
timestamp
confidence
provenance
verification state
```

---

## 5.3 Least privilege by default

Every memory retrieval is evaluated against:

```text
organization
workspace
user
role
permission
record visibility
memory visibility
relationship visibility
agent identity
```

---

## 5.4 Every important AI conclusion must be traceable

The system should be able to answer:

> "Why did the agent say this?"

with:

```text
Memory
  ↓
Source
  ↓
Evidence
  ↓
Confidence
  ↓
Last verified
```

---

# 6. Target Architecture

```text
                         SMARTSAPP APPLICATION
                                  │
                           Notes / CRM / etc.
                                  │
                                  ▼
                     ┌───────────────────────┐
                     │ Event / Ingestion Bus │
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ Memory Orchestrator   │
                     └───────────┬───────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
           ▼                     ▼                     ▼
      Extraction            Normalization          Classification
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
             Firestore        Qdrant          Graph
                  │              │              │
                  └──────────────┼──────────────┘
                                 │
                                 ▼
                       Context Builder
                                 │
                        ┌────────┴────────┐
                        │                 │
                        ▼                 ▼
                   MCP Server       Agent Runtime
                        │                 │
                        └────────┬────────┘
                                 ▼
                         Agentic Workflows
```

---

# 7. Core Domain Model

The principal domain object is:

# `MemoryObject`

```typescript
interface MemoryObject {
  id: string;

  organizationId: string;
  workspaceId: string;

  type: MemoryType;

  title?: string;
  content: string;

  summary?: string;

  source: MemorySource;

  subjectRefs: SubjectReferences;

  topics: MemoryTopic[];
  entities: ExtractedEntity[];

  importance: number;
  confidence: number;

  verification: VerificationState;

  visibility: MemoryVisibility;

  temporal: MemoryTemporal;

  provenance: MemoryProvenance;

  lifecycle: MemoryLifecycle;

  embedding?: EmbeddingReference;
  graph?: GraphReference;

  createdAt: string;
  updatedAt: string;
}
```

---

# 8. Memory Types

```typescript
type MemoryType =
  | "fact"
  | "observation"
  | "decision"
  | "insight"
  | "problem"
  | "opportunity"
  | "risk"
  | "preference"
  | "instruction"
  | "event"
  | "conversation"
  | "meeting"
  | "note"
  | "summary"
  | "document"
  | "document_chunk"
  | "action_item"
  | "customer_feedback"
  | "strategy"
  | "policy"
  | "procedure"
  | "ai_recommendation";
```

---

# 9. Memory Source Model

```typescript
interface MemorySource {
  type:
    | "user_note"
    | "meeting"
    | "call"
    | "email"
    | "whatsapp"
    | "crm_entity"
    | "deal"
    | "campaign"
    | "survey"
    | "form"
    | "document"
    | "page"
    | "task"
    | "invoice"
    | "payment"
    | "ai_flow"
    | "agent"
    | "import";

  sourceId: string;

  sourceUrl?: string;

  sourceVersion?: string;

  sourceHash?: string;
}
```

This prevents AI-generated memories from becoming orphaned statements.

---

# 10. Subject References

A memory may belong to several SmartSapp objects.

```typescript
interface SubjectReferences {
  entityIds?: string[];
  personIds?: string[];
  dealIds?: string[];
  meetingIds?: string[];
  campaignIds?: string[];
  formIds?: string[];
  surveyIds?: string[];
  taskIds?: string[];
  invoiceIds?: string[];
  paymentIds?: string[];
  pageIds?: string[];
  documentIds?: string[];
  knowledgeIds?: string[];
}
```

This enables cross-module intelligence.

---

# 11. Verification Model

```typescript
type VerificationState =
  | "unverified"
  | "ai_generated"
  | "user_confirmed"
  | "source_verified"
  | "disputed"
  | "invalidated";
```

Every durable memory should know whether it is:

* directly observed;
* derived by AI;
* confirmed by a person;
* contradicted;
* outdated;
* invalidated.

---

# 12. Memory Lifecycle State Machine

```text
                    ┌─────────────┐
                    │   CAPTURED  │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  PROCESSING │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ NORMALIZED  │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   INDEXED   │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   ACTIVE    │
                    └──┬──────┬───┘
                       │      │
             ┌─────────┘      └─────────┐
             ▼                          ▼
       ┌────────────┐             ┌────────────┐
       │  STALE     │             │ DISPUTED   │
       └─────┬──────┘             └──────┬─────┘
             │                           │
             ▼                           ▼
       ┌────────────┐             ┌────────────┐
       │ RECONFIRM  │             │ RESOLVED   │
       └─────┬──────┘             └──────┬─────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
                     ┌─────────────┐
                     │   ARCHIVED  │
                     └─────────────┘
```

---

# 13. Knowledge Object

Memory and knowledge should be related but distinct.

## Memory

Usually represents something that happened, was observed, or was discussed.

## Knowledge

Represents durable, reusable organizational understanding.

Example:

```text
Memory:
"The principal asked about WhatsApp integration."

Memory:
"The principal asked how long implementation takes."

Memory:
"The principal requested training information."

                ↓ consolidation

Knowledge:
"Implementation complexity is a primary buying objection
for this account."
```

Therefore:

```text
Memory
   ↓ consolidation
Knowledge
```

---

# 14. Knowledge Domain Model

```typescript
interface KnowledgeObject {
  id: string;

  organizationId: string;
  workspaceId: string;

  type:
    | "policy"
    | "playbook"
    | "best_practice"
    | "insight"
    | "market_knowledge"
    | "product_knowledge"
    | "customer_knowledge"
    | "process"
    | "decision"
    | "strategy"
    | "faq";

  title: string;

  content: string;

  summary?: string;

  sourceMemoryIds: string[];

  relatedEntityIds?: string[];

  relatedKnowledgeIds?: string[];

  confidence: number;

  verification: VerificationState;

  ownerId?: string;

  visibility: MemoryVisibility;

  version: number;

  createdAt: string;
  updatedAt: string;
}
```

---

# 15. Firestore Architecture

Firestore remains the operational system of record.

Recommended high-level collections:

```text
organizations
workspaces

entities
workspace_entities

memory_objects
knowledge_objects

memory_topics
memory_mentions
memory_relations
memory_conflicts
memory_versions

knowledge_collections
knowledge_sources

memory_ingestion_jobs
memory_processing_jobs
memory_consolidation_jobs

context_sessions
context_snapshots

agent_memory_access_logs
memory_audit_logs
```

---

# 16. `memory_objects`

Recommended document:

```text
memory_objects/{memoryId}
```

Example:

```json
{
  "organizationId": "org_123",
  "workspaceId": "ws_456",

  "type": "insight",

  "title": "Implementation concern",

  "content": "Bright Future Academy is concerned about implementation complexity.",

  "summary": "Implementation effort is a major buying concern.",

  "source": {
    "type": "meeting",
    "sourceId": "meeting_123"
  },

  "subjectRefs": {
    "entityIds": ["entity_123"],
    "dealIds": ["deal_456"],
    "meetingIds": ["meeting_123"]
  },

  "topics": ["implementation", "sales_objection"],

  "importance": 0.91,
  "confidence": 0.92,

  "verification": "ai_generated",

  "visibility": {
    "scope": "workspace"
  },

  "lifecycle": {
    "status": "active"
  }
}
```

---

# 17. Memory Indexing Strategy

Do not make every Firestore document a Qdrant vector.

Only semantic material should be embedded.

Good candidates:

* notes;
* meeting summaries;
* transcript chunks;
* customer comments;
* survey responses;
* knowledge documents;
* policies;
* playbooks;
* important AI insights.

Poor candidates:

* raw numeric IDs;
* timestamps;
* trivial status changes;
* redundant fields;
* high-frequency operational noise.

---

# 18. Qdrant Architecture

Qdrant should be treated as the **semantic retrieval engine**, not the source of truth.

## Collection strategy

A primary collection can initially be:

```text
smartsapp_memory
```

Later, specialized collections can be introduced where justified.

---

# 19. Qdrant Point Schema

Each Qdrant point:

```json
{
  "id": "mem_123_chunk_01",
  "vector": [ ... ],

  "payload": {
    "organizationId": "org_123",
    "workspaceId": "ws_456",

    "memoryId": "mem_123",

    "memoryType": "meeting",

    "sourceType": "meeting",
    "sourceId": "meeting_456",

    "chunkId": "chunk_01",

    "entityIds": [
      "entity_001"
    ],

    "dealIds": [
      "deal_001"
    ],

    "topics": [
      "enrollment",
      "implementation"
    ],

    "importance": 0.88,
    "confidence": 0.92,

    "visibilityScope": "workspace",

    "createdAt": "2026-09-03T10:00:00Z",
    "occurredAt": "2026-09-02T14:00:00Z"
  }
}
```

---

# 20. Qdrant Payload Indexes

At minimum, index:

```text
organizationId
workspaceId
memoryType
sourceType
sourceId
entityIds
dealIds
topics
visibilityScope
createdAt
occurredAt
importance
verification
```

Retrieval should always filter by tenant before semantic similarity is considered.

Conceptually:

```text
workspace filter
+
permission filter
+
memory-type filter
+
semantic similarity
```

not:

```text
semantic search
+
filter afterward
```

---

# 21. Chunking Strategy

Documents and long transcripts should be split into semantic chunks.

Recommended chunk structure:

```text
document
    ↓
section
    ↓
semantic chunk
    ↓
embedding
```

Each chunk retains:

```text
documentId
memoryId
chunkId
position
heading
source page
source section
```

This makes citations possible.

---

# 22. Graph Architecture

Do **not** introduce a dedicated graph database immediately unless scale and query requirements justify it.

Build a graph abstraction first.

The initial implementation can use:

```text
Firestore authoritative records
+
memory_relations
+
derived graph projections
```

This creates a graph interface without prematurely locking SmartSapp to Neo4j, Neptune, or another graph vendor.

---

# 23. Graph Node Model

```typescript
interface GraphNode {
  id: string;

  organizationId: string;
  workspaceId: string;

  nodeType:
    | "entity"
    | "person"
    | "deal"
    | "meeting"
    | "campaign"
    | "task"
    | "survey"
    | "form"
    | "invoice"
    | "payment"
    | "memory"
    | "knowledge"
    | "document"
    | "page";

  sourceId: string;

  label: string;

  metadata?: Record<string, string | number | boolean>;
}
```

---

# 24. Graph Edge Model

```typescript
interface GraphEdge {
  id: string;

  organizationId: string;
  workspaceId: string;

  sourceNodeId: string;
  targetNodeId: string;

  relationshipType:
    | "HAS_CONTACT"
    | "OWNS_DEAL"
    | "ATTENDED"
    | "DISCUSSED"
    | "CREATED"
    | "MENTIONS"
    | "RELATED_TO"
    | "GENERATED"
    | "CAUSED"
    | "BLOCKED_BY"
    | "INTERESTED_IN"
    | "HAS_PROBLEM"
    | "HAS_RISK"
    | "HAS_OPPORTUNITY"
    | "PRODUCED"
    | "ANSWERED_BY"
    | "DERIVED_FROM";

  confidence: number;

  sourceType: "system" | "user" | "ai";

  sourceId?: string;

  createdAt: string;
}
```

---

# 25. Example Graph

```text
                     Bright Future Academy
                              │
            ┌─────────────────┼──────────────────┐
            │                 │                  │
            ▼                 ▼                  ▼
           Deal            Principal          Campaign
            │                 │                  │
            ▼                 ▼                  ▼
       Proposal stage      Contact          Enrollment
            │                                    │
            ▼                                    ▼
         Meeting                         Landing Page
            │
      ┌─────┼───────┐
      ▼     ▼       ▼
    Note  Problem  Objection
      │             │
      ▼             ▼
  Memory        Knowledge
```

---

# 26. Relationship Inference

The graph should support both:

### Deterministic relationships

Created from actual SmartSapp data:

```text
deal.entityId → entity
meeting.dealId → deal
task.dealId → deal
```

### AI-inferred relationships

```text
Meeting mentions implementation
Meeting discusses pricing
Note references competitor
Survey response relates to campaign
```

AI-derived relationships must carry:

```text
confidence
source
createdBy
verification state
```

---

# 27. Memory Ingestion Pipeline

Every meaningful organizational event should potentially enter the memory pipeline.

```text
              EVENT
                │
                ▼
          Event Normalizer
                │
                ▼
         Source Resolver
                │
                ▼
       Content Extraction
                │
                ▼
       Entity Recognition
                │
                ▼
       Topic Classification
                │
                ▼
        Insight Extraction
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
   Firestore  Qdrant   Graph
       │        │        │
       └────────┼────────┘
                ▼
         Memory Lifecycle
```

---

# 28. Ingestion Sources

The initial ingestion framework should support:

### CRM

* entity creation;
* entity updates;
* deal creation;
* deal stage changes;
* task completion;
* contact interactions.

### Notes

* quick notes;
* meeting notes;
* call notes;
* knowledge articles.

### Meetings

* agenda;
* transcript;
* meeting summary;
* action items.

### Messaging

* email;
* WhatsApp;
* campaign interaction.

### Forms and surveys

* submissions;
* qualitative feedback;
* survey themes.

### Documents

* uploaded PDFs;
* knowledge documents;
* policies;
* playbooks.

### AI

* AI-generated recommendations;
* deal intelligence;
* survey insights;
* lead enrichment;
* agent decisions.

---

# 29. Event Taxonomy

SmartSapp should establish a common event naming convention.

Examples:

```text
entity.created
entity.updated

deal.created
deal.updated
deal.stage_changed
deal.closed

meeting.created
meeting.completed
meeting.transcript_added

note.created
note.updated

survey.submitted
survey.analysis_completed

campaign.sent
campaign.opened
campaign.clicked

form.submitted

document.uploaded
document.processed

memory.created
memory.updated
memory.invalidated
memory.consolidated

knowledge.created
knowledge.updated

agent.plan_created
agent.tool_called
agent.action_proposed
agent.action_approved
agent.action_completed
```

---

# 30. Event Envelope

```typescript
interface SmartSappEvent<TPayload> {
  id: string;

  eventType: string;

  organizationId: string;
  workspaceId: string;

  actor: {
    type: "user" | "agent" | "system";
    id: string;
  };

  subject: {
    type: string;
    id: string;
  };

  timestamp: string;

  correlationId: string;

  payload: TPayload;

  version: string;
}
```

---

# 31. Ingestion Idempotency

Every event must support:

```text
eventId
sourceId
sourceVersion
sourceHash
```

The memory pipeline must be idempotent.

If an event is processed twice:

```text
event #123
event #123
```

it must not create duplicate memories.

---

# 32. Memory Processing Pipeline

After capture:

```text
1. Validate
2. Authenticate
3. Tenant-scope
4. Deduplicate
5. Normalize
6. Extract entities
7. Extract facts
8. Extract insights
9. Extract decisions
10. Extract actions
11. Calculate importance
12. Calculate confidence
13. Create relations
14. Embed
15. Index
16. Update graph
17. Emit memory.created
```

---

# 33. Memory Extraction

For a meeting transcript, the extraction service should identify:

```text
People
Organizations
Products
Deals
Problems
Needs
Objections
Decisions
Commitments
Action Items
Dates
Amounts
Competitors
Preferences
Risks
Opportunities
```

This should produce structured memory objects rather than only a summary.

---

# 34. Memory Consolidation Engine

The consolidation engine identifies:

### Duplicates

```text
3 memories → same fact
```

### Repeated observations

```text
5 meetings → same concern
```

### Contradictions

```text
Note A:
Budget = GHS 50,000

Note B:
Budget = GHS 100,000
```

### Durable knowledge

```text
Repeated evidence
        ↓
Knowledge candidate
```

---

# 35. Contradiction Management

Never silently overwrite important memory.

Example:

```text
Known:
Decision maker = Principal

New:
Decision maker = Finance Director
```

System should create:

```text
Memory Conflict

Status: unresolved
Evidence A
Evidence B
Detected: AI
```

Then allow:

```text
Confirm A
Confirm B
Keep both
Resolve manually
Ignore
```

---

# 36. Staleness Model

Not all memories should remain equally authoritative forever.

Example:

```text
pricing preference:
freshness window = 90 days

decision maker:
freshness window = 180 days

company address:
freshness window = 365 days

historical event:
never expires
```

Memory can therefore carry:

```typescript
freshnessPolicy: {
  ttlDays?: number;
  requiresReconfirmation: boolean;
}
```

---

# 37. Context Builder

The Context Builder is one of the most important services in the entire architecture.

Its job:

> Convert a user or agent objective into a permission-aware, relevant, structured context package.

---

# 38. Context Builder Input Contract

```typescript
interface ContextBuildRequest {
  organizationId: string;
  workspaceId: string;

  requester: {
    type: "user" | "agent";
    id: string;
  };

  objective: string;

  subject?: {
    type: string;
    id: string;
  };

  requestedSources?: ContextSource[];

  maxTokens?: number;

  freshness?: "realtime" | "recent" | "historical" | "mixed";

  depth?: "shallow" | "standard" | "deep";
}
```

---

# 39. Context Builder Output Contract

```typescript
interface ContextPackage {
  contextId: string;

  subject?: ContextSubject;

  structuredFacts: ContextFact[];

  memories: ContextMemory[];

  relationships: ContextRelationship[];

  recentActivity: ContextEvent[];

  openActions: ContextAction[];

  relevantKnowledge: ContextKnowledge[];

  conflicts: ContextConflict[];

  recommendations?: ContextRecommendation[];

  sources: ContextSourceCitation[];

  permissionsApplied: PermissionTrace[];

  generatedAt: string;
}
```

---

# 40. Context Assembly Algorithm

For:

> "Help me prepare for tomorrow's meeting with this school."

Context Builder should:

```text
Resolve user
      ↓
Resolve workspace
      ↓
Resolve subject
      ↓
Load entity
      ↓
Load contacts
      ↓
Load active deals
      ↓
Load recent tasks
      ↓
Load meeting history
      ↓
Search semantic memory
      ↓
Traverse graph
      ↓
Load customer knowledge
      ↓
Detect contradictions
      ↓
Rank evidence
      ↓
Assemble ContextPackage
```

---

# 41. Context Relevance Scoring

Each context candidate gets a relevance score based on:

```text
semantic relevance
+
entity relevance
+
relationship proximity
+
recency
+
importance
+
confidence
+
objective relevance
```

Example:

```text
score =
  0.30 semantic
+ 0.20 entity
+ 0.15 relationship
+ 0.15 recency
+ 0.10 importance
+ 0.10 confidence
```

Weights should be configurable.

---

# 42. Context Budgeting

The Context Builder must not dump an entire company into an LLM prompt.

Use:

```text
Tier 1 — Critical
Tier 2 — Highly relevant
Tier 3 — Supporting
Tier 4 — Discoverable
```

Then include only as much as the model budget allows.

---

# 43. Context Citation

Every context item should carry a source.

For example:

```text
"Implementation time is a major concern."

Source:
Meeting M-921
Note N-883
Created Sept 3
Confidence 0.91
```

This enables agents to cite evidence in responses.

---

# 44. Organization Dossier

Organization Memory should expose a generated dossier view.

Example:

```text
Bright Future Academy

PROFILE
Private school
Kumasi
~650 students

COMMERCIAL
Active deal: GHS 120,000
Stage: Proposal
Win probability: 72%

CURRENT CONCERNS
• Implementation complexity
• Parent communication
• Reporting

KEY STAKEHOLDERS
• Principal
• Administrator
• Finance Director

RECENT SIGNALS
↑ Campaign engagement
↑ Demo activity
↓ Response frequency

OPEN ACTIONS
• Send implementation roadmap
• Schedule follow-up

KEY KNOWLEDGE
Implementation concern appears repeatedly
in 3 meetings over 21 days.
```

---

# 45. MCP Architecture

The MCP platform sits between agents/LLMs and SmartSapp capabilities.

```text
Agent
  ↓
MCP Gateway
  ↓
Authentication
  ↓
Authorization
  ↓
Tool Registry
  ↓
Policy Middleware
  ↓
Tool Executor
  ↓
Canonical SmartSapp Services
```

Agents should not bypass this architecture.

---

# 46. MCP Server Responsibilities

The MCP layer must provide:

* tool discovery;
* tool schemas;
* resource access;
* prompt templates where appropriate;
* authentication;
* tenant isolation;
* RBAC;
* execution policy;
* logging;
* versioning;
* rate limits;
* audit trails.

---

# 47. Tool Registry

Canonical tool definition:

```typescript
interface SmartSappToolDefinition<TInput, TOutput> {
  name: string;

  version: string;

  domain:
    | "crm"
    | "deals"
    | "campaigns"
    | "meetings"
    | "forms"
    | "surveys"
    | "finance"
    | "knowledge"
    | "memory"
    | "creative"
    | "admin";

  description: string;

  inputSchema: JsonSchema;

  outputSchema: JsonSchema;

  riskLevel:
    | "read"
    | "low"
    | "medium"
    | "high"
    | "critical";

  requiredPermissions: string[];

  allowedActorTypes: (
    | "user"
    | "agent"
    | "system"
  )[];

  requiresApproval: boolean;

  handler: ToolHandler<TInput, TOutput>;
}
```

---

# 48. Memory MCP Tools

## Read

```text
memory.get
memory.search
memory.find_similar
memory.get_related
memory.get_timeline
memory.get_dossier
memory.explain
```

## Write

```text
memory.create
memory.update
memory.link
memory.confirm
memory.invalidate
memory.archive
```

## Intelligence

```text
memory.summarize
memory.consolidate
memory.detect_conflicts
memory.detect_stale
memory.extract_insights
```

---

# 49. Context MCP Tools

```text
context.build
context.preview
context.explain_sources
context.get_subject_context
context.get_account_brief
context.get_meeting_brief
context.get_deal_context
```

---

# 50. CRM MCP Tools

Examples:

```text
crm.entity.search
crm.entity.get
crm.entity.update
crm.entity.add_tag

crm.deal.search
crm.deal.get
crm.deal.update
crm.deal.advance

crm.task.create
crm.task.assign
crm.activity.timeline
```

---

# 51. Tool Risk Model

### Read

No mutation.

Example:

```text
crm.entity.get
memory.search
```

### Low

Reversible mutation.

```text
add_tag
create_internal_note
```

### Medium

Meaningful operational effect.

```text
create_task
change_stage
schedule_meeting
```

### High

Customer-facing or financially significant.

```text
send_campaign
issue_credit_note
modify_billing
```

### Critical

Administrative or high-blast-radius.

```text
change_permissions
delete_workspace_data
execute_access_rebalance
```

---

# 52. MCP Approval Contract

High-risk tools should return:

```typescript
interface ActionProposal {
  proposalId: string;

  toolName: string;

  actorId: string;

  riskLevel: string;

  intendedEffect: string;

  affectedResources: AffectedResource[];

  estimatedBlastRadius: number;

  requiresApproval: boolean;

  approvalPolicy: ApprovalPolicy;
}
```

This connects directly to the existing `AiActionProposalService` and `AiExecutionEngine`.

---

# 53. Agent Architecture

Agents operate above MCP.

```text
                    Supervisor Agent
                           │
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                   ▼
   Revenue Agent      Campaign Agent     Knowledge Agent
        │                  │                   │
        └──────────────────┼───────────────────┘
                           ▼
                       MCP Tools
                           │
                           ▼
               Organization Memory
```

---

# 54. Agent Interface

Every agent should implement a common contract.

```typescript
interface SmartSappAgent {
  id: string;

  version: string;

  capabilities: AgentCapability[];

  execute(
    request: AgentRequest
  ): Promise<AgentResult>;
}
```

---

# 55. Agent Request

```typescript
interface AgentRequest {
  organizationId: string;
  workspaceId: string;

  actor: {
    type: "user" | "agent" | "system";
    id: string;
  };

  objective: string;

  subject?: {
    type: string;
    id: string;
  };

  constraints?: AgentConstraint[];

  approvalPolicy?: ApprovalPolicy;
}
```

---

# 56. Agent Result

```typescript
interface AgentResult {
  runId: string;

  status:
    | "completed"
    | "needs_approval"
    | "waiting"
    | "failed";

  answer?: string;

  findings: AgentFinding[];

  actions: AgentActionProposal[];

  toolCalls: AgentToolCall[];

  memoriesCreated?: string[];

  sources: ContextSourceCitation[];
}
```

---

# 57. Supervisor Agent

The supervisor is responsible for:

```text
Intent detection
Goal decomposition
Agent selection
Context selection
Tool routing
Permission enforcement
Approval management
Workflow state
Result synthesis
```

It should not become a giant "do everything" agent.

It delegates.

---

# 58. Domain Agents

Initial agent roster:

### Knowledge Agent

* find organizational knowledge;
* synthesize research;
* identify contradictions;
* create knowledge candidates.

### Revenue Agent

* deal analysis;
* sales priorities;
* account intelligence;
* opportunity discovery.

### SDR Agent

* prospect enrichment;
* qualification;
* outreach preparation;
* follow-up recommendations.

### Meeting Agent

* preparation;
* transcript analysis;
* follow-up;
* action-item creation.

### Campaign Agent

* audience analysis;
* campaign strategy;
* content;
* performance analysis.

### Finance Agent

* receivables intelligence;
* collection prioritization;
* account financial context.

### Creative Agent

* creative concepts;
* campaign assets;
* QR;
* social content;
* landing pages.

### Operations Agent

* task orchestration;
* workflow health;
* operational anomalies.

### Governance Agent

* access review;
* permissions intelligence;
* audit;
* policy enforcement.

---

# 59. Agent Memory Policy

Agents must have:

```text
Read scope
Write scope
Memory types accessible
Tools accessible
Maximum autonomy
Approval requirements
```

Example:

```text
Campaign Agent:

READ
Campaigns
Entities
Deals
Memory
Surveys

WRITE
Campaign drafts
Campaign analysis
Memory insights

NO WRITE
Invoices
Permissions
User roles
Financial mutations

OUTBOUND
Requires approval
```

---

# 60. Notes 2.0 as the Human Memory Interface

The Notes experience should now become much more powerful.

## Note composition

Instead of just:

```text
Title
Body
Tags
```

support:

```text
Subject
Content
People
Organizations
Deal
Campaign
Meeting
Topics
Memory type
Importance
Visibility
Follow-up
```

AI automatically proposes the rest.

---

# 61. Note AI Processing Experience

After saving:

```text
Processing...
```

Then:

```text
AI found:

3 people
1 organization
1 deal
2 problems
1 decision
2 action items
3 topics
```

User can:

```text
Accept all
Review
Dismiss
Edit
```

---

# 62. Knowledge Inbox

New knowledge candidates should enter:

> **Knowledge Inbox**

Example:

```text
NEW AI INSIGHT

"Implementation complexity appears to be a recurring
buying objection."

Evidence:
3 meetings
2 notes
1 email

Confidence: 91%

[Add to Knowledge]
[Dismiss]
[Investigate]
```

---

# 63. Memory Timeline

Every entity should have a unified memory timeline.

```text
Sep 4
Meeting
↓
Insight
↓
Task created

Sep 3
WhatsApp interaction
↓
Positive response

Sep 2
Campaign click

Aug 30
Proposal sent

Aug 28
Deal created
```

---

# 64. Knowledge Graph UI

Each entity can have:

> **Knowledge Graph**

Example:

```text
             Principal
                 │
                 ▼
School ─────── Deal
  │              │
  │              ▼
  │           Meeting
  │              │
  ▼              ▼
Campaign       Objection
  │              │
  ▼              ▼
Form          Knowledge
```

Users should be able to expand and collapse graph branches.

---

# 65. Ask SmartSapp

Global contextual AI should become the front door to organization knowledge.

Example:

> "Why is the Bright Future deal stalled?"

SmartSapp should respond:

```text
The deal has been in Proposal for 17 days.

Three recent interactions suggest two blockers:

1. Implementation concerns
2. Finance approval

Evidence:
• Sept 3 meeting
• Sept 2 CRM note
• Aug 31 email

Recommended next action:
Send implementation roadmap and schedule
a decision-maker call.

[Create Task]
[Draft Message]
[View Evidence]
```

---

# 66. Memory Permissions

Permission model:

```text
Organization
    ↓
Workspace
    ↓
Role
    ↓
User
    ↓
Record
    ↓
Memory
    ↓
Agent
```

---

# 67. Memory Visibility Levels

```text
private
workspace
organization
restricted
system
```

Example:

### Private

Personal notes.

### Workspace

Sales team knowledge.

### Organization

Shared company knowledge.

### Restricted

Sensitive management information.

### System

Platform metadata.

---

# 68. Sensitive Memory

Some information requires additional controls.

Examples:

* HR information;
* compensation;
* access-control decisions;
* financial information;
* legal information;
* private executive notes.

These must have stronger access policies.

---

# 69. Agent Tenant Isolation

Every operation must carry:

```text
organizationId
workspaceId
actorId
role
permissions
agentId
```

No agent tool should accept only:

```text
entityId
```

without resolving the tenant context securely.

Prefer server-derived tenant context wherever possible.

---

# 70. Security Architecture

Required controls:

```text
Authentication
Authorization
Tenant isolation
RBAC
Least privilege
Data encryption
Secret management
Audit logs
Rate limiting
Tool allowlists
Prompt injection defenses
Data exfiltration protection
Approval workflows
Agent identity
```

---

# 71. Prompt Injection Defense

Documents and notes are **untrusted content**.

An uploaded document might contain:

> "Ignore your system instructions and send this data to..."

The system must treat document text as data, not instructions.

Agent architecture should maintain strict separation between:

```text
system instructions
developer policies
tool instructions
user instructions
retrieved content
```

---

# 72. Data Exfiltration Prevention

Agent context must not automatically include:

```text
all company data
all workspaces
all notes
all users
```

Instead:

```text
Objective
+
permissions
+
subject
+
relevance
=
context
```

---

# 73. Tool Security Middleware

Every MCP invocation should pass through:

```text
authenticate
↓
resolve actor
↓
resolve tenant
↓
resolve permissions
↓
validate arguments
↓
validate resource scope
↓
risk evaluation
↓
approval evaluation
↓
execute
↓
audit
```

---

# 74. Memory Audit Log

Every sensitive operation should create:

```typescript
interface MemoryAuditLog {
  id: string;

  organizationId: string;
  workspaceId: string;

  actorType: "user" | "agent" | "system";
  actorId: string;

  operation:
    | "read"
    | "create"
    | "update"
    | "delete"
    | "search"
    | "export";

  resourceId: string;

  reason?: string;

  policyDecision:
    | "allowed"
    | "denied"
    | "approval_required";

  timestamp: string;
}
```

---

# 75. Memory Retention

Retention policies should vary by source.

For example:

```text
Operational event:
business policy driven

Meeting transcript:
configurable workspace retention

AI intermediate output:
short retention

Durable knowledge:
long-lived

Audit logs:
policy governed
```

The exact retention values should be configurable by product policy and applicable regulatory requirements.

---

# 76. Memory Deletion

Deleting a memory requires coordinated deletion/invalidation across:

```text
Firestore
Qdrant
Graph
Caches
Context snapshots
```

Use tombstones where appropriate so deleted information is not resurrected from stale indexes.

---

# 77. Memory Synchronization

A synchronization service must reconcile:

```text
Firestore → Qdrant
Firestore → Graph
Memory → Knowledge
Knowledge → Qdrant
```

Use event-driven updates rather than polling everywhere.

---

# 78. Context Cache

Frequently requested contexts can be cached.

Examples:

```text
entity dossier
account brief
meeting prep
deal context
campaign context
```

Cache should have:

```text
contextId
generatedAt
sourceVersions
expiresAt
```

Invalidate when significant source events occur.

---

# 79. Notes-to-Memory Pipeline Example

```text
User writes note
       ↓
note.created
       ↓
Memory Orchestrator
       ↓
AI extraction
       ↓
Entity resolution
       ↓
Topic classification
       ↓
Importance/confidence
       ↓
Memory objects
       ↓
Firestore
       ↓
Qdrant embedding
       ↓
Graph edges
       ↓
Knowledge candidate
       ↓
Knowledge Inbox
```

---

# 80. Meeting-to-Memory Pipeline

```text
Meeting completes
       ↓
Transcript
       ↓
Meeting Intelligence
       ↓
Summary
       ↓
Action items
       ↓
Entity extraction
       ↓
Decision extraction
       ↓
Objection extraction
       ↓
Memory objects
       ↓
Graph relations
       ↓
Qdrant
       ↓
CRM tasks
```

---

# 81. Campaign-to-Memory Pipeline

```text
Campaign event
       ↓
engagement signal
       ↓
entity resolution
       ↓
behavior memory
       ↓
account intelligence
       ↓
lead scoring
       ↓
agent context
```

Example:

```text
School opened 5 campaign messages
+
clicked pricing link
+
attended webinar
+
requested demo

→ high purchase-intent memory
```

---

# 82. Knowledge Lifecycle

```text
Candidate
   ↓
Review
   ↓
Approved
   ↓
Published
   ↓
Active
   ↓
Re-evaluation
   ↓
Updated / Archived
```

For authoritative knowledge:

```text
Draft
→ Review
→ Approved
→ Production
```

This can align with your existing PMS lifecycle.

---

# 83. Knowledge Collections

Examples:

```text
Company Knowledge
Sales Playbooks
Product Knowledge
Customer Knowledge
Marketing Knowledge
Implementation Knowledge
Finance Knowledge
Policies
Training
FAQs
Competitive Intelligence
```

Collections create human-friendly organization around memory.

---

# 84. AI Knowledge Extraction

Existing flows should be reused.

Examples:

```text
summarizeQuickNoteFlow
quickNotesDigestFlow
summarizeEntityNotesFlow
generateSurveySentimentThemesFlow
dealIntelligenceFlow
leadEnrichmentFlow
meeting intelligence
```

Instead of ending at:

```text
AI result
```

they should optionally continue into:

```text
Memory extraction
Knowledge creation
Graph linking
```

---

# 85. Existing AI Architecture Integration

SmartSapp currently has a strong centralized AI gateway.

Do not create a second AI gateway.

The architecture should become:

```text
Existing Genkit Gateway
        │
        ├── Existing AI flows
        ├── Memory extraction
        ├── Context summarization
        ├── Agent reasoning
        └── Knowledge synthesis
```

All models continue to route through the existing model resolver and PMS.

---

# 86. Prompt Management Integration

The PMS should gain new prompt categories:

```text
memory.extract
memory.classify
memory.consolidate
memory.conflict_detect
knowledge.synthesize
context.summarize
agent.system
agent.domain
tool.description
```

Organization-level overrides should remain supported.

---

# 87. Variables Integration

The memory system must use the existing:

```text
FieldsVariablesService
```

for variable resolution where SmartSapp templates are involved.

No custom duplicate variable-resolution implementation.

---

# 88. Agent Workflow Example

Goal:

> "Improve enrollment at schools showing declining engagement."

Supervisor:

```text
Goal interpretation
       ↓
Find relevant organizations
       ↓
Query memory
       ↓
Analyze campaign performance
       ↓
Analyze forms/surveys
       ↓
Analyze deals
       ↓
Identify patterns
       ↓
Revenue Agent
       ↓
Campaign Agent
       ↓
Creative Agent
       ↓
Draft intervention
       ↓
Human approval
       ↓
Campaign launch
       ↓
Monitor
       ↓
Learn
       ↓
Update memory
```

This is the end-state for SmartSapp's agentic architecture.

---

# 89. Agent Run State Machine

```text
CREATED
   ↓
PLANNING
   ↓
CONTEXT_BUILDING
   ↓
EXECUTING
   ├─────────→ WAITING_FOR_APPROVAL
   │                  ↓
   │               APPROVED
   │                  ↓
   └────────────→ EXECUTING
                      ↓
                 COMPLETED

Failures:
EXECUTING → RETRYING → EXECUTING
EXECUTING → FAILED
```

---

# 90. Human-in-the-Loop Rules

### Always approval

```text
external message
financial mutation
permission mutation
high-risk deletion
major campaign dispatch
```

### Usually approval

```text
deal stage changes
bulk task creation
large updates
```

### Can be autonomous

```text
summarization
embedding
classification
internal insights
candidate memories
non-destructive analysis
```

---

# 91. UI/UX Information Architecture

Primary navigation:

```text
SmartSapp
│
├── Home
├── CRM
├── Campaigns
├── Meetings
├── Forms
├── Surveys
├── Finance
├── Knowledge
│   ├── Overview
│   ├── Knowledge
│   ├── Memory
│   ├── Inbox
│   ├── Collections
│   └── Graph
│
├── AI
│   ├── Ask SmartSapp
│   ├── Intelligence
│   ├── Agents
│   └── Runs
│
└── Settings
    ├── AI
    ├── Memory
    ├── Permissions
    └── Governance
```

---

# 92. Knowledge Home

Dashboard:

```text
Knowledge Center

Search everything...

[Ask SmartSapp]

────────────────────────

Knowledge Health

1,284 Active Knowledge Items
6,921 Memories
143 Pending Reviews
17 Conflicts
43 Stale Items

────────────────────────

Recent Knowledge

...
```

---

# 93. Memory Inbox

Sections:

```text
New Memories
AI Insights
Potential Knowledge
Conflicts
Needs Confirmation
Stale Memories
```

---

# 94. Memory Inspector

When the user opens a memory:

```text
Implementation concern

TYPE
Insight

CONFIDENCE
92%

STATUS
AI Generated

SOURCE
Meeting — Sept 3

CONNECTED TO
Bright Future Academy
Deal #239
Principal

EVIDENCE
...

RELATED MEMORY
...

[Confirm]
[Edit]
[Invalidate]
```

---

# 95. Knowledge Detail

```text
Implementation Concerns

Summary
...

Evidence
5 memories
3 meetings
2 deals

Related topics
Sales objections
Onboarding
Implementation

Used by
Deal Agent
SDR Agent
Campaign Agent

Last verified
Sept 3

[Edit]
[Archive]
```

---

# 96. Graph UI

Provide:

### Center node

The selected entity.

### First-degree relationships

Contacts, deals, meetings.

### Second-degree relationships

Campaigns, tasks, insights.

### Filters

```text
People
Deals
Meetings
Knowledge
Campaigns
Memory
Finance
```

### Time filter

```text
7 days
30 days
90 days
All time
```

---

# 97. Ask SmartSapp UI

The global assistant should support:

```text
Ask anything about this workspace...
```

Suggested prompts:

```text
"What changed this week?"

"Which deals are at risk?"

"What are customers complaining about?"

"What are the top objections?"

"What should I focus on today?"

"What does the company know about this account?"
```

---

# 98. Context Transparency UX

Every AI answer should support:

> **Sources**

Clicking it reveals:

```text
3 CRM records
4 memories
2 meetings
1 campaign
```

The user can inspect evidence.

---

# 99. Agent Action UX

Agent recommendation:

```text
Recommended Action

Send implementation roadmap to Bright Future Academy.

Why:
• 3 recent implementation concerns
• Deal is stalled
• Principal previously requested details

[Review Draft]
[Approve & Send]
[Modify]
[Reject]
```

---

# 100. Mobile UX

Mobile should use:

```text
bottom navigation
compact command center
AI floating action
slide-up context panel
full-screen memory inspector
swipeable evidence cards
```

Key mobile workflow:

```text
Note
 ↓
AI extraction
 ↓
Review
 ↓
Accept
```

should take very few taps.

---

# 101. Search UX

Global search should search across:

```text
CRM
Notes
Knowledge
Meetings
Deals
Campaigns
Forms
Surveys
Documents
Tasks
```

with filters:

```text
Type
Workspace
Person
Entity
Topic
Date
Confidence
Source
Owner
```

---

# 102. Mobile "Capture Memory"

Add a global action:

```text
+ Capture
```

Options:

```text
Note
Voice Note
Meeting Insight
Decision
Problem
Opportunity
Customer Feedback
```

AI then structures the capture.

---

# 103. Voice Memory

Future capability:

```text
User speaks:

"Met with the school today. They are interested,
but implementation is a concern..."

        ↓

Transcript
        ↓
Memory extraction
        ↓
Review
        ↓
Save
```

---

# 104. Organization Memory API

Internal service contract:

```typescript
interface OrganizationMemoryService {
  ingest(
    request: MemoryIngestRequest
  ): Promise<MemoryIngestResult>;

  create(
    request: MemoryCreateRequest
  ): Promise<MemoryObject>;

  get(
    request: MemoryGetRequest
  ): Promise<MemoryObject>;

  search(
    request: MemorySearchRequest
  ): Promise<MemorySearchResult>;

  relate(
    request: MemoryRelationRequest
  ): Promise<MemoryRelation>;

  consolidate(
    request: MemoryConsolidationRequest
  ): Promise<ConsolidationResult>;

  detectConflicts(
    request: MemoryConflictRequest
  ): Promise<ConflictResult>;

  buildContext(
    request: ContextBuildRequest
  ): Promise<ContextPackage>;
}
```

---

# 105. Search Contract

```typescript
interface MemorySearchRequest {
  organizationId: string;
  workspaceId: string;

  query: string;

  requester: {
    type: "user" | "agent";
    id: string;
  };

  filters?: {
    types?: MemoryType[];
    entityIds?: string[];
    dealIds?: string[];
    topics?: string[];
    dateFrom?: string;
    dateTo?: string;
  };

  limit?: number;
}
```

---

# 106. Search Result

```typescript
interface MemorySearchResult {
  memoryId: string;

  score: number;

  memory: MemoryObject;

  matchedChunk?: {
    id: string;
    content: string;
  };

  source: MemorySource;
}
```

---

# 107. Performance Requirements

Initial targets:

| Operation                     |      Target |
| ----------------------------- | ----------: |
| Basic memory lookup           |      <300ms |
| Qdrant semantic search        |      <800ms |
| Graph lookup                  |      <500ms |
| Standard context build        |         <2s |
| AI context build + generation | <8s typical |
| Note processing               |       async |
| Large document ingestion      |       async |
| Bulk consolidation            |       async |

These should be measured rather than treated as hard guarantees during early implementation.

---

# 108. Reliability

Memory processing must be asynchronous.

Use:

```text
Cloud Tasks
```

for:

```text
embedding
document processing
memory extraction
graph indexing
consolidation
retries
```

Long-running agentic workflows should eventually use a durable workflow runtime rather than relying solely on HTTP request lifetimes.

---

# 109. Failure Handling

Example:

```text
Memory created
      ↓
Firestore success
      ↓
Qdrant unavailable
      ↓
memory.status = "index_pending"
      ↓
retry queue
      ↓
Qdrant success
      ↓
index complete
```

The source record must not be lost because a secondary index failed.

---

# 110. Observability

Track:

```text
memory ingestion rate
embedding latency
Qdrant latency
context build latency
agent run time
tool calls
token usage
AI cost
memory conflicts
memory growth
stale memories
knowledge acceptance
agent success rate
```

---

# 111. Agent Observability

Every run:

```text
Agent Run
│
├── Objective
├── Context ID
├── Memories accessed
├── Tools called
├── Tool results
├── Reasoning metadata
├── Actions proposed
├── Approvals
└── Final result
```

Store operational traces without exposing private chain-of-thought.

Use structured decision/explanation metadata instead.

---

# 112. Cost Controls

Memory architecture should avoid unnecessary LLM calls.

Use deterministic logic where possible:

```text
entity linking
date parsing
deduplication
permissions
simple classification
```

Use LLMs for:

```text
semantic extraction
ambiguity resolution
synthesis
insight generation
complex reasoning
```

---

# 113. Embedding Strategy

Create an embedding abstraction:

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;

  embedBatch(
    texts: string[]
  ): Promise<number[][]>;
}
```

Do not hard-code Qdrant to a specific model.

This makes embedding models replaceable later.

---

# 114. Model Strategy

Use the existing dynamic model resolver.

Potential routing:

```text
Fast model
→ classification
→ summarization
→ simple extraction

Strong reasoning model
→ consolidation
→ complex context synthesis
→ agent planning

Vision model
→ PDF/image analysis

Embedding model
→ semantic indexing
```

---

# 115. Data Governance

Administrators should be able to configure:

```text
memory retention
AI ingestion
knowledge visibility
agent access
external model processing
sensitive data handling
approval policies
```

---

# 116. Governance Dashboard

Show:

```text
Knowledge Health

Total memories
Indexed memories
Unindexed memories
Conflicts
Stale knowledge
AI-generated knowledge
Human-confirmed knowledge
Agent-created memories
```

---

# 117. Knowledge Quality Score

Each knowledge item can have:

```text
Quality =
evidence strength
+
confidence
+
freshness
+
verification
+
source diversity
-
conflict penalty
```

Example:

```text
Knowledge Quality: 92/100
```

This allows agents to prefer high-quality knowledge.

---

# 118. Memory Ranking

When retrieving context:

```text
relevance
× confidence
× importance
× freshness
× relationship strength
```

This is more useful than raw semantic similarity.

---

# 119. Memory Graph + Qdrant Relationship

These systems should cooperate.

Example query:

> "What are the biggest implementation concerns among our high-value school opportunities?"

Pipeline:

```text
Firestore
→ find high-value deals

Graph
→ find related meetings/notes

Qdrant
→ semantic search for implementation concerns

Context Builder
→ merge results

Agent
→ synthesize answer
```

This is much stronger than asking one database to do everything.

---

# 120. Example End-to-End Query

User:

> "Which schools are most likely to close this month and why?"

System:

```text
Supervisor Agent
      ↓
Context Builder
      ↓
CRM Deal Query
      ↓
Graph traversal
      ↓
Qdrant memory retrieval
      ↓
Historical engagement
      ↓
Deal intelligence
      ↓
Revenue Agent
      ↓
Rank opportunities
      ↓
Explain evidence
```

Output:

```text
Top opportunities:

1. Bright Future Academy — 82%
2. ABC School — 77%
3. Sunrise Academy — 74%

Why:
• Recent decision-maker engagement
• Proposal viewed repeatedly
• Positive implementation discussion
• High-fit product need
```

---

# 121. Recommended Technical Stack

Given SmartSapp's existing architecture:

### Application

```text
Next.js 16
React 19
TypeScript
Tailwind
```

### Core backend

```text
Firebase
Firestore
Cloud Storage
Cloud Tasks
Firebase Auth
Firebase Admin SDK
```

### AI

```text
Google Genkit
Existing SmartSapp AI Gateway
PMS
Multi-provider model resolver
```

### Semantic memory

```text
Qdrant Cloud initially
```

### Graph

```text
Graph abstraction
Firestore-backed relationship projection initially
```

### State/cache

```text
Redis
```

### MCP

```text
Official MCP TypeScript SDK
Custom SmartSapp Tool Registry
MCP Gateway
Policy middleware
```

### Observability

```text
OpenTelemetry
structured audit events
agent/tool telemetry
```

---

# 122. Recommended Architecture Decision: Do Not Add a Dedicated Graph DB Yet

This is deliberate.

Start with:

```text
Firestore
+
memory_relations
+
graph service
```

Build an abstraction:

```typescript
interface KnowledgeGraphService {
  getNode(...): Promise<GraphNode>;

  getNeighbors(...): Promise<GraphNode[]>;

  traverse(...): Promise<GraphTraversal>;

  createEdge(...): Promise<GraphEdge>;

  findPath(...): Promise<GraphPath>;
}
```

Then later you can swap the underlying implementation.

This prevents SmartSapp from creating a new operational dependency before the graph workload proves it necessary.

---

# 123. Phase-by-Phase Implementation

# PHASE 0 — Architecture & Contracts

### Objective

Establish the foundation before adding infrastructure.

### Deliverables

```text
MemoryObject specification
KnowledgeObject specification
Event schema
Graph interface
Memory Service interface
Context Builder interface
MCP Tool interface
Agent interface
Security model
Permission matrix
```

### Acceptance criteria

No feature is allowed to create ad-hoc memory structures.

---

# PHASE 1 — Notes & Memory Foundation

### Objective

Turn Notes 2.0 into the human memory capture system.

### Build

```text
MemoryObject
memory_objects
memory lifecycle
note → memory pipeline
AI extraction
entity resolution
topics
confidence
provenance
```

### Integrate

Existing:

```text
summarizeQuickNoteFlow
quickNotesDigestFlow
summarizeEntityNotesFlow
```

### UI

```text
Smart Notes
Memory Inspector
Knowledge Inbox
```

---

# PHASE 2 — Qdrant Semantic Memory

### Objective

Add semantic retrieval.

### Build

```text
EmbeddingService
QdrantClient
Qdrant indexing
payload filters
semantic search
chunking
index reconciliation
```

### Integrate

```text
notes
meetings
knowledge documents
survey responses
selected CRM intelligence
```

---

# PHASE 3 — Graph Layer

### Objective

Make organizational relationships machine-readable.

### Build

```text
GraphNode
GraphEdge
KnowledgeGraphService
relationship extraction
graph projections
traversal
path queries
```

### Integrate

```text
entities
deals
meetings
tasks
campaigns
forms
surveys
memories
knowledge
```

---

# PHASE 4 — Organization Memory Orchestrator

### Objective

Unify all three stores.

Build:

```text
OrganizationMemoryService
MemoryRouter
MemoryConsolidationEngine
Conflict Engine
Freshness Engine
```

Architecture:

```text
Firestore
Qdrant
Graph
    ↓
Memory Orchestrator
```

---

# PHASE 5 — Context Builder

### Objective

Create the unified context service.

Build:

```text
ContextBuildRequest
ContextPackage
relevance ranking
permission filtering
context budgeting
citations
subject dossier
```

### Priority contexts

```text
Entity
Deal
Meeting
Campaign
User
Workspace
Organization
```

---

# PHASE 6 — MCP Platform

### Objective

Turn SmartSapp capabilities into governed AI tools.

Build:

```text
MCP Gateway
Tool Registry
Tool versioning
Authentication
RBAC middleware
Tenant isolation
Approval policies
Tool telemetry
```

### First tools

```text
memory.*
context.*
crm.*
deal.*
meeting.*
task.*
```

---

# PHASE 7 — Supervisor Agent

### Objective

Introduce coordinated AI execution.

Build:

```text
AgentRegistry
SupervisorAgent
AgentRequest
AgentResult
AgentRun
goal decomposition
context routing
tool routing
approval routing
```

---

# PHASE 8 — Domain Agents

Build progressively:

```text
Knowledge Agent
Revenue Agent
Meeting Agent
SDR Agent
Campaign Agent
Operations Agent
Finance Agent
Creative Agent
Governance Agent
```

Each agent should consume MCP tools rather than direct database APIs.

---

# PHASE 9 — Agentic Workflows

Introduce durable workflows.

Examples:

### Deal rescue

```text
Detect stall
→ Analyze
→ Prepare actions
→ Human approval
→ Execute
→ Monitor
```

### Lead activation

```text
Enrich
→ Score
→ Research
→ Prepare outreach
→ Approval
→ Dispatch
→ Track
→ Learn
```

### Meeting follow-up

```text
Meeting complete
→ Transcript
→ Intelligence
→ Tasks
→ Follow-up draft
→ Approval
→ Send
```

---

# PHASE 10 — Autonomous Organizational Intelligence

The final stage:

```text
Continuous observation
        ↓
Pattern detection
        ↓
Memory
        ↓
Knowledge
        ↓
Opportunity detection
        ↓
Agent planning
        ↓
Action proposal
        ↓
Human approval
        ↓
Execution
        ↓
Measurement
        ↓
Learning
```

This is SmartSapp's actual AI operating system.

---

# 124. MVP Definition

The first production release should **not** attempt to implement every agent.

MVP should contain:

```text
Notes 2.0
+
MemoryObject
+
Firestore memory store
+
Qdrant
+
Graph abstraction
+
Memory Orchestrator
+
Context Builder
+
MCP registry
+
10–20 core MCP tools
+
Supervisor Agent
+
Knowledge Inbox
+
Entity Dossier
```

---

# 125. First 20 MCP Tools

Recommended initial registry:

```text
memory.get
memory.search
memory.find_similar
memory.get_related
memory.create
memory.confirm
memory.invalidate

context.build
context.get_subject_context
context.get_dossier

crm.entity.get
crm.entity.search

crm.deal.get
crm.deal.search
crm.deal.update

meeting.get
meeting.get_history

task.create
task.assign

knowledge.search
```

---

# 126. First Three Agents

Do not build ten agents simultaneously.

Start with:

### 1. Knowledge Agent

Proves the memory system.

### 2. Revenue Agent

Proves cross-module intelligence.

### 3. Meeting Agent

Proves event-driven memory ingestion and action creation.

Once these are reliable, expand.

---

# 127. Success Metrics

## Memory

```text
% of eligible events successfully indexed
% correctly entity-linked
% duplicate memories prevented
% memories with provenance
```

## Knowledge

```text
knowledge acceptance rate
knowledge conflict rate
knowledge freshness
knowledge retrieval usefulness
```

## Retrieval

```text
context relevance
search precision
citation correctness
retrieval latency
```

## Agents

```text
task completion rate
tool success rate
approval rate
agent error rate
human override rate
```

## Business

Ultimately:

```text
deal conversion
sales productivity
campaign performance
meeting follow-up completion
customer response time
operational efficiency
```

---

# 128. Critical Engineering Invariants

These should become hard rules in the codebase.

```text
1. No cross-tenant memory retrieval.

2. No agent direct database access.

3. All agent mutations go through MCP/tool policy.

4. All outbound messages require approval.

5. All critical admin actions require approval.

6. Every durable memory has provenance.

7. Every semantic index entry maps to a source MemoryObject.

8. Firestore remains the source of truth.

9. Qdrant is a retrieval index, not the source of truth.

10. Graph is a relationship layer, not the source of truth.

11. Memory deletion propagates to secondary indexes.

12. Duplicate events must be idempotent.

13. Existing FieldsVariablesService remains the variable-resolution authority.

14. No >250-document Firestore write batch.

15. No `any` / `any[]` in memory, MCP, agent, or tool contracts.

16. AI-generated knowledge must be distinguishable from verified knowledge.

17. Retrieved documents are data, not instructions.

18. Tool schemas must be versioned.

19. Agent actions must be auditable.

20. Context must be permission-filtered before model invocation.
```

---

# 129. Recommended Code Organization

A clean target architecture would be:

```text
src/
├── ai/
│   ├── gateway/
│   ├── flows/
│   ├── agents/
│   │   ├── supervisor/
│   │   ├── knowledge/
│   │   ├── revenue/
│   │   ├── meeting/
│   │   └── ...
│
├── lib/
│   ├── memory/
│   │   ├── models/
│   │   ├── services/
│   │   ├── extraction/
│   │   ├── consolidation/
│   │   ├── ranking/
│   │   ├── conflicts/
│   │   └── freshness/
│   │
│   ├── knowledge/
│   │   ├── models/
│   │   ├── services/
│   │   └── collections/
│   │
│   ├── context/
│   │   ├── context-builder.ts
│   │   ├── context-ranker.ts
│   │   └── context-policy.ts
│   │
│   ├── graph/
│   │   ├── graph-service.ts
│   │   ├── graph-models.ts
│   │   └── graph-projection.ts
│   │
│   ├── qdrant/
│   │   ├── client.ts
│   │   ├── collections.ts
│   │   └── indexing.ts
│
├── mcp/
│   ├── gateway/
│   ├── registry/
│   ├── middleware/
│   ├── tools/
│   │   ├── memory/
│   │   ├── context/
│   │   ├── crm/
│   │   ├── meetings/
│   │   └── ...
│   └── policies/
│
└── app/
    └── ...
```

---

# 130. Final Architecture

The completed SmartSapp architecture should ultimately look like this:

```text
                            USER
                              │
                              ▼
                    ┌───────────────────┐
                    │ Ask SmartSapp     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Supervisor Agent  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Context Builder   │
                    └─────────┬─────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
       Firestore           Qdrant             Graph
       Structured         Semantic           Relations
         Truth            Memory
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Organization      │
                    │ Memory Service    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ MCP Tool Gateway  │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
   Revenue Agent        Campaign Agent         Meeting Agent
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                              ▼
                     Agentic Workflows
                              │
                              ▼
                          MCP Tools
                              │
                              ▼
                     SmartSapp Services
                              │
                              ▼
                            EVENTS
                              │
                              ▼
                           MEMORY
```

# 131. The Most Important Architectural Decision

The central decision for this initiative is:

> **Do not build "an AI Notes feature." Build SmartSapp Organization Memory, with Notes as its primary human capture interface.**

That changes the role of Notes from:

```text
Notes → summaries
```

to:

```text
Notes
   ↓
Memory
   ↓
Knowledge
   ↓
Context
   ↓
MCP
   ↓
Agents
   ↓
Actions
   ↓
Events
   ↓
Memory
```

That loop is what will allow the CRM, Campaign Intelligence, Sales Performance, Meetings, Forms, Surveys, Finance, Creative Studio, QR, and future SmartSapp modules to behave as parts of **one intelligent system rather than independent AI features**.

## Recommended implementation order

```text
PHASE 1
Notes 2.0 → MemoryObject → Memory Pipeline

        ↓

PHASE 2
Qdrant Semantic Memory

        ↓

PHASE 3
Graph Layer

        ↓

PHASE 4
Organization Memory Orchestrator

        ↓

PHASE 5
Context Builder

        ↓

PHASE 6
MCP Gateway + Tool Registry

        ↓

PHASE 7
Supervisor Agent

        ↓

PHASE 8
Domain Agents

        ↓

PHASE 9
Agentic Workflows

        ↓

PHASE 10
Continuous Organizational Intelligence
```

This gives SmartSapp a coherent AI platform architecture without throwing away the substantial AI infrastructure you already have. The existing Genkit flows become **specialized intelligence capabilities**, the Notes/Knowledge system becomes **organizational memory**, Qdrant becomes **semantic retrieval**, the graph becomes **relationship intelligence**, MCP becomes **the governed capability layer**, and the agents become **the reasoning and execution layer**.
