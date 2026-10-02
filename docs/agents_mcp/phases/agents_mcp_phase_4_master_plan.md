# SmartSapp Agentic & MCP Transformation: Phase 4 Master Implementation Plan
## Unified Memory, Context & Knowledge Plane (The 5-Tier Memory Architecture & Company Brain 2.0)
### Deeply Integrated with `docs/CompanyBrain/`, `docs/agentic/`, `docs/agents_mcp/`, `theme.md` §8 & Anti-Distortion Invariants

**Version:** 2.0.0 (Comprehensive Source-Document Synthesis)  
**Status:** PROPOSED FOR USER APPROVAL  
**Authors:** Senior Principal Systems & AI Agentic Architecture Engineer  
**Governing Documents & Source Foundations:**
- **CompanyBrain Foundation:**
  - [`docs/CompanyBrain/companybrain_prd.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/CompanyBrain/companybrain_prd.md) (131 Sections: Domain Model, State Machine, Qdrant Schema, Context Builder, Dossiers, MCP Tools)
  - [`docs/CompanyBrain/companybrain_ui.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/CompanyBrain/companybrain_ui.md) (100 Sections: Knowledge Home, Inbox, Inspector, Graph Canvas, CRM Context Panel, Mobile UX)
  - [`docs/CompanyBrain/companybrain_idea.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/CompanyBrain/companybrain_idea.md) & [`docs/CompanyBrain/companybrain_manual.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/CompanyBrain/companybrain_manual.md)
- **Agentic & MCP Transformation Foundation:**
  - [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§5 Phase 4, §8 5 Memory Classes, §19 Retrieval Algorithm, §20 Graph Schema, §28 Qdrant, §33 Strangler Rule)
  - [`docs/agents_mcp/agents_mcp_ui.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_ui.md) (§PHASE 4 — Memory / Knowledge Deliverables)
  - [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) (Rules 1–69, specifically Rules 4, 7, 8, 9, 10, 13, 16, 21, 22, 28, 29, 30, 31, 32, 33, 34, 40, 47, 51, 60, 61, 62, 64, 69)
  - [`docs/agentic/08-memory-model.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agentic/08-memory-model.md) (Unified 5-Tier Memory Architecture, Qdrant Multi-Tenant Filtering, Temporal Validity, Poisoning Defense)
  - [`docs/agentic/00-master-architecture.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agentic/00-master-architecture.md) & [`docs/agentic/07-agent-model.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agentic/07-agent-model.md)
- **Design System & Workspace Rules:**
  - [`theme.md` Section 8](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/theme.md#L396-L442) (Standardized Modal Architecture SSOT)
  - [`.agents/AGENTS.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/.agents/AGENTS.md) (SSOT: TagSelector, FieldsVariablesService, Relative Toast Navigation)
- **Preexisting Working Implementation:**
  - `src/lib/memory/` (12 test suites, 60 tests currently passing in `src/lib/memory/__tests__/`)

---

## 1. Executive Summary & Strategic Architecture

### 1.1 The Destination: From Fragmented Notes to a Living Organization Memory
In Phases 0, 1, 2, and 3, SmartSapp established the bedrock of the agentic platform:
1. **Phase 0:** 1,964 capability AST inventory, risk classification (L0–L4), baseline regression fixtures, and Cloud Tasks security.
2. **Phase 1:** The 15-step Canonical Execution Gateway (`executeCapability`), Unified Capability Registry, 5 core domain adapters, idempotency replay, and SSRF egress security.
3. **Phase 2:** The Unified Reactive Event & Activity Backbone — Transactional Outbox, Cloud Tasks dispatcher worker, DLQ, Universal Multi-Tenant Event Bus, SSE real-time streaming, and Activity Timeline 2.0.
4. **Phase 3:** Agent Identity, Canonical Personas, Ephemeral HMAC Tokens, Bounded Delegation Engine, Scope Attenuation, Operator Approval Center (`/admin/approvals`), Dead-Man Controls (Rule 60), and Policy Matrix (UI #38).

However, autonomous agents currently run **stateless and amnesic**. When an agent assists an operator with a deal, answers a customer inquiry, or prepares a meeting:
- It does not remember past interactions, corrections, or user preferences.
- It cannot reason across interconnected entities (e.g. associating an email with a meeting, a deal, and an overdue invoice).
- It relies on crude keyword lookups or isolated notes rather than a unified context graph.

**Phase 4 transforms SmartSapp into a platform that truly remembers.** In accordance with `companybrain_prd.md` (§1) and `agents_mcp_roadmap.md` (§5, §8), Phase 4 delivers:
> **One organizational memory, one context layer, many tools, many agents.**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AUTHENTICATED OPERATOR / USER                                  │
│                                (Clerk Session + D6 RBAC Role Permissions)                        │
└─────────────────────────────────┬──────────────────────────────┬─────────────────────────────────┘
                                  │                              │
                                  ▼                              ▼
┌──────────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐
│       OPERATOR UI SURFACES (Milestone 4 & 5)     │ │        CRM EMBEDDED CONTEXT (Milestone 5)    │
│  • Company Brain Dashboard (/admin/brain)        │ │  • <KnowledgeContextPanel> in Contacts/Deals │
│  • Knowledge Inbox & Triage (/admin/knowledge)   │ │  • Interactive Entity Context Graph v1       │
│  • KnowledgeItemDrawer (theme.md §8 Standard)    │ │  • Clickable Evidence Links + Provenance     │
│  • Memory Settings (Retention & Sensitivity)     │ │  • Instant Source Attribution                │
└─────────────────────────┬────────────────────────┘ └──────────────────────┬───────────────────────┘
                          │                                                 │
                          └───────────────────────┬─────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     CONTEXT RETRIEVAL, BUDGETING & EVIDENCE PIPELINE (Milestone 2)               │
│                                                                                                  │
│   User Goal / Query ──► Context Classifier ──► Structured Tenant Filters (Rule 47)               │
│                                  │                                                               │
│          ┌───────────────────────┼──────────────────────────────┐                                │
│          ▼                       ▼                              ▼                                │
│   Semantic Search        Context Graph v1             Episodic History                           │
│   (Qdrant Dense+Sparse)  (Relational Traversal)       (Activity Timeline V2)                     │
│          │                       │                              │                                │
│          └───────────────────────┼──────────────────────────────┘                                │
│                                  ▼                                                               │
│                    Temporal Validity Gate (Rule 29: validFrom/validUntil/supersededBy)           │
│                                  ▼                                                               │
│                    Context Budgeting (Rule 28: <= 4,000 tokens) & Re-Ranking (RRF)               │
│                                  ▼                                                               │
│            Anti-Poisoning Isolation: <untrusted_reference_data> (Rule 30)                        │
│                                  ▼                                                               │
│                  Synthesized Structured Evidence Pack                                            │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │ Fed into Execution Gateway / Agent Step Worker
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             CANONICAL 5-TIER MEMORY STORAGE (Milestone 1)                        │
│                                                                                                  │
│   1. Working Memory    ──► Run-scoped scratchpad (agent_runs/{runId}/working_memory)              │
│   2. Episodic Memory   ──► Materialized event sink (workspaces/{wsId}/activities)                │
│   3. Semantic Memory   ──► Qdrant Vector Engine (smartsapp_memory_v1 with mandatory ACL)        │
│   4. Relational Memory ──► Firestore Entity Graph (workspaces/{wsId}/entity_edges)               │
│   5. Procedural Memory ──► Prompt Management System (system_settings/prompt_playbooks)           │
│                                                                                                  │
│   * Strangler Layer wraps existing src/lib/memory/ with zero functionality distortion             │
└─────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                  │ Emits domain events on ingestion/mutation
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            DOCUMENT INGESTION & CHUNKING ENGINE (Milestone 3)                    │
│                                                                                                  │
│  • Sources: CRM Notes, Meeting Transcripts, Uploaded PDFs, Course Content, Email Threads         │
│  • Document Chunker: Recursive token-aware chunking (500 tokens / 50 overlap + SHA-256)          │
│  • Embedding Generator: 768-dim normalized dense embeddings with local caching                   │
│  • Cloud Tasks Dispatcher: Async background indexing via /api/tasks/memory-indexer               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Synthesis of All Source Documents

### 2.1 The 5 Memory Classes (`08-memory-model.md` §1 & `agents_mcp_roadmap.md` §8)
1. **Working Memory:** Run-scoped transient state (active goal, sub-step plan, assumptions, temporary tool results). Stored against the active agent execution (`agent_runs/{runId}/working_memory`) and purged or promoted upon run termination.
2. **Episodic Memory:** Materialized record of actions taken by users, agents, and automations, including user edits, corrections, and post-action outcomes. Bridges directly from Phase 2 `ActivityRecordV2`.
3. **Semantic Memory:** Unstructured and semi-structured organizational knowledge (notes, transcripts, documents, course lessons, policies) vectorized in **Qdrant** with mandatory tenant payload filtering.
4. **Relational Memory (Context Graph v1):** Entity-to-entity relationship graph modeling connections across organizations, contacts, deals, tasks, meetings, messages, invoices, and documents. Per PRD Section 122, this is modeled cleanly in Firestore (`workspaces/{wsId}/entity_edges`) using typed directed edges without premature graph database complexity.
5. **Procedural Memory:** Governed playbooks, SOPs, prompt templates, and execution blueprints stored in the Prompt Management System (`PMS`).

### 2.2 The Strangler Migration Invariant (Roadmap §33 & Rule 69)
SmartSapp already contains 12 passing test suites (60 tests) in `src/lib/memory/` implementing core components of CompanyBrain 2.0 (`OrganizationMemoryService`, `SemanticSearchService`, `QdrantClient`, `ContextBuilderService`, `KnowledgeGraphService`, `FreshnessEngine`, `ConflictEngine`).
**We do not throw this away.** 
Following Section 33 of the Master Roadmap, Phase 4 wraps these working implementations into canonical platform contracts (`src/platform/memory/`), hardens them with the 69 rules (zero `any`, mandatory tenant ACLs, anti-poisoning isolation, circuit breakers, OpenTelemetry tracing), exposes them as typed capabilities in the Gateway (`executeCapability`), and delivers modern operator UI surfaces adhering to `theme.md` Section 8.

---

## 3. Compliance Matrix: 69 SmartSapp Agentic Development Rules

| Rule # | Requirement / Principle | Phase 4 Implementation Guarantee | Verification Gate |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Next.js 15 Server Actions, React 19 RSC boundaries, strict Zod schemas, modular `src/platform/memory/`. | Clean static analysis and architecture reviews. |
| **Rule 2** | Reflection Q1: What could go wrong? | Analyzed 6 failure modes: cross-tenant vector bleed, prompt injection poisoning, stale memory persistence, Qdrant connection outages, memory drift, and unbounded chunk indexing. | Tenant payload filters, `<untrusted_reference_data>` sanitization, temporal invalidation, memory fallback adapters. |
| **Rule 3** | Reflection Q2 & Q3: Affected Features & UI | Preexisting notes, meetings, and CRM features remain untouched; new memory UI surfaces mount cleanly; backoffice operators gain full memory inspector and retention controls. | 100% baseline regression pass across all 89 test suites. |
| **Rule 4** | Zero `any` & Strict Typing | All memory DTOs, vector payloads, graph nodes, and search queries use strict Zod schemas (`MemoryObjectSchema`, `ContextQuerySchema`). Zero `any` or `any[]`. | `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` exits with 0 errors. |
| **Rule 7** | Plain English & Mobile Ergonomics | Memory insights, evidence badges, and source links use natural human prose. Mobile touch targets maintain $\ge 44\text{px}$. | Responsive inspection on mobile/tablet viewports. |
| **Rule 8** | Defensive Fail-Closed Architecture | Vector queries without valid `organizationId` or `workspaceId` fail closed immediately (`TENANT_REQUIRED`). | Multi-tenant security tests prove zero cross-tenant query capability. |
| **Rule 9** | Cloud Run Serverless Limits | Vector batch sizes bounded to $\le 50$ chunks; indexing jobs dispatch asynchronously via Cloud Tasks; zero in-memory listener leaks. | Serverless memory stays $\ll 1\text{GB}$. |
| **Rule 10** | Inline Architectural Documentation | Every memory module features `@fileOverview` with maintainer notes, failure mode analysis, and schema citations. | Automated documentation audit passes. |
| **Rule 13** | Model Distrust & Anti-Poisoning | Retrieved memory documents are treated as untrusted data, never executable system instructions. External text is strictly isolated in `<untrusted_reference_data>`. | Prompt injection attack simulation test suite. |
| **Rule 16** | Provenance & Evidence Citation | Every retrieved memory chunk includes source entity ID, author ID, timestamp, confidence score, and immutable citation URI. | Evidence links navigate to source entity in CRM. |
| **Rule 21 & 41** | Two-Phase Approval Integration | High-risk memory operations (bulk memory purges, sensitive document indexing, policy overrides) trigger `ActionProposal` in `/admin/approvals`. | Verified proposal generation on L4 memory operations. |
| **Rule 22** | Cryptographic Hash Verification | Ingested document chunks store SHA-256 content hashes to detect upstream modification and prevent duplicate indexing. | Chunk hash deduplication verified in tests. |
| **Rule 24** | Resilient Error Handling & Circuit Breakers | Qdrant connections implement circuit breakers (`CLOSED`, `OPEN`, `HALF_OPEN`) with in-memory / Firestore vector fallback if Qdrant is unavailable. | In-memory vector fallback verified in unit tests. |
| **Rule 28** | Context Budgeting & Token Limits | Caps retrieved context strictly to $\le 4,000$ tokens, applying relevance scoring and deduplication to prevent context window bloat. | Context budget manager unit tests pass. |
| **Rule 29** | Temporal Validity & Memory Decay | Memories carry `validFrom`, `validUntil`, and `supersededBy`. Expired or superseded memories are automatically down-ranked or filtered out. | Temporal expiration unit tests pass. |
| **Rule 30** | Knowledge Poisoning Defense | Injection detector scans memory candidate text for instruction override patterns (e.g. `"Ignore previous instructions"`, `"System prompt:"`) and neutralizes them. | Poisoning sanitization test suite passes. |
| **Rule 31** | Observability & Telemetry | Memory retrieval latency, vector distance, chunk count, and cache hit rates are tracked with OpenTelemetry trace contexts. | Telemetry spans emitted on every retrieval. |
| **Rule 32 & 33**| Qdrant Tenant Filtering & Hybrid Search | Qdrant searches mandate `must: [{ key: "organizationId" }, { key: "workspaceId" }]`. Combines dense vectors with sparse BM25 keyword matching. | Multi-tenant isolation verified in vector test suite. |
| **Rule 34** | Graph Traversal & Entity Connections | Relational memory models typed edges (`CONTACTED`, `RELATED_TO`, `DISCUSSED_IN`) up to 2 hops without graph explosion. | Bounded graph query execution verified. |
| **Rule 40** | Append-Only Audit & Immutability | Memory creation, edits, and deletions emit immutable domain events (`memory.item.created`, `memory.item.superseded`, `memory.item.deleted`). | Event Bus verification in test suite. |
| **Rule 47** | Multi-Tenant Anti-IDOR | All Server Actions (`searchMemoryAction`, `updateMemorySettingsAction`, `inspectMemoryItemAction`) enforce `requireAuth()` and tenant equality. | IDOR attack simulation passes. |
| **Rule 51** | Server Actions Security | Marked `'use server'` and verified via `requireAuth()` and session cookie validation. | Zero unauthenticated endpoints. |
| **Rule 60** | Emergency Dead-Man Controls | If emergency dead-man pause is active, memory indexing and autonomous vector modifications are immediately halted. | Dead-man switch test verified. |
| **Rule 61** | Dedicated Operator Console | Company Brain UI at `/admin/brain` and Knowledge Inbox at `/admin/knowledge/inbox`. | Dedicated UI surface operational. |
| **Rule 62** | Live SSE Stream Reactivity | Live memory ingestion and indexing progress stream to `/admin/brain` via `useEventStream`. | Real-time SSE updates verified in UI tests. |
| **Rule 64** | Tactile Micro-Interactions | All buttons, filters, and cards use Emil Kowalski tactile scaling `active:scale-[0.97]`. | Motion tests verified in UI suites. |
| **theme.md §8** | Standardized Modal Architecture | `KnowledgeItemDrawer.tsx` strictly adheres to `border-border/80 bg-card shadow-2xl rounded-2xl`, `<DialogHeader demarcated>`, `<CardInfoTooltip>`, `<DialogDescription className="sr-only">`. | Strict §8 modal test pass. |
| **Rule 69** | Master Layering Axiom | Memory layer is decoupled from model runtime and tool execution protocols. Memory capabilities execute identically via MCP or internal agents. | Architectural decoupling verified. |

---

## 4. The 5 Phased Milestones of Phase 4

```
Phase 4: Unified Memory, Context & Knowledge Plane
├── Milestone 1: Canonical Memory Contracts, Storage Adapters & Vector Engine Hardening
├── Milestone 2: Context Retrieval Algorithm, Context Budgeting & Hybrid Search Pipeline
├── Milestone 3: Knowledge Ingestion Pipeline, Document Chunking & Cloud Tasks Indexer
├── Milestone 4: Operator UI Surfaces — Company Brain, Knowledge Inbox & Inspector
└── Milestone 5: CRM Contextual Surfaces, Knowledge Graph Visualizer v1 & MCP Capabilities
```

---

### Milestone 1: Canonical Memory Contracts, Storage Adapters & Vector Engine Hardening
**Target:** Formalize canonical 5-tier memory contracts, establish the Strangler Fig adapter over `src/lib/memory/`, harden Qdrant with mandatory multi-tenant payload filtering, implement temporal validity checks (Rule 29), and provide anti-poisoning isolation tags (Rule 30).

#### Architectural Deliverables:
1. `src/platform/memory/contracts/memory-types.ts`:
   - Zod v4 schemas for `MemoryObject`, `MemoryTier` (`working`, `episodic`, `semantic`, `relational`, `procedural`), `SensitivityLevel` (`public`, `internal`, `confidential`, `restricted`), `TemporalValidity`, `SubjectReference`, and `MemoryEvidence`.
   - Explicit domain error taxonomy: `MEMORY_ERROR_CODES` (`TENANT_REQUIRED`, `MEMORY_EXPIRED`, `MEMORY_SUPERSEDED`, `VECTOR_UNAVAILABLE`, `INJECTION_DETECTED`, `SENSITIVITY_VIOLATION`).
2. `src/platform/memory/adapters/vector-store.interface.ts`:
   - Decoupled `VectorStore` interface supporting `upsertVectors`, `searchVectors`, `deleteVectors`, and `deleteTenantCollection`.
3. `src/platform/memory/adapters/memory-vector-store.ts`:
   - High-precision in-memory cosine similarity vector store for isolated unit tests, offline development, and fallback.
4. `src/platform/memory/adapters/qdrant-vector-store.ts`:
   - Production Qdrant client adapter wrapping `src/lib/memory/qdrant/qdrant-client.ts`.
   - Enforces mandatory tenant payload filtering:
     ```json
     {
       "filter": {
         "must": [
           { "key": "organizationId", "match": { "value": "org_123" } },
           { "key": "workspaceId", "match": { "value": "ws_456" } }
         ]
       }
     }
     ```
   - Circuit breaker integration: Automatically fails over to in-memory/Firestore fallback if Qdrant health checks fail (Rule 24).
5. `src/platform/memory/governance/anti-poisoning.ts`:
   - Implements Rule 30: Scans incoming candidate memory text for prompt injection keywords and wraps external retrieved data in `<untrusted_reference_data source="..." id="...">` tags.
6. `src/platform/__tests__/memory/memory-contracts.test.ts`:
   - Exhaustive tests verifying schema validation, tenant payload isolation, cosine similarity math, circuit breaker fallback, and injection neutralization.

---

### Milestone 2: Context Retrieval Algorithm, Context Budgeting & Hybrid Search Pipeline
**Target:** Implement the 8-step Context Retrieval Algorithm from Roadmap Section 19 and PRD Sections 37–44, combining dense vector search, sparse keyword matching, context graph traversal, context budgeting, and temporal re-ranking.

#### Architectural Deliverables:
1. `src/platform/memory/retrieval/context-classifier.ts`:
   - Analyzes user query/goal to identify target entities (`contact`, `deal`, `meeting`), relevant domain, and temporal window.
2. `src/platform/memory/retrieval/hybrid-retriever.ts`:
   - Implements dense vector retrieval (Qdrant) + sparse BM25 keyword matching with Reciprocal Rank Fusion (RRF):
     $$RRF(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
   - Applies Rule 29 temporal filtering: down-ranks memories older than 30 days unless marked permanent; suppresses superseded items.
3. `src/platform/memory/retrieval/context-budget-manager.ts`:
   - Implements Rule 28: Enforces token budget ceilings ($\le 4,000$ tokens of context). Uses greedy relevance knapsack selection to maximize density while guaranteeing token limits.
4. `src/platform/memory/retrieval/evidence-compiler.ts`:
   - Assembles retrieved chunks into a structured, de-duplicated `EvidencePack`:
     - Highlights exact source citations (e.g. `[Call Note: 2026-09-12 by Joseph Aidoo]`).
     - Attaches confidence scores and sensitivity badges.
     - Formats evidence for seamless consumption by Agent Personas (`crm_researcher`, `deal_coach`, etc.).
5. `src/platform/__tests__/memory/retrieval-algorithm.test.ts`:
   - 15 test cases covering RRF fusion, tenant boundary enforcement, context budgeting, temporal decay, and evidence pack compilation.

---

### Milestone 3: Knowledge Ingestion Pipeline, Document Chunking & Cloud Tasks Indexer
**Target:** Automated ingestion pipeline converting CRM notes, meeting transcripts, uploaded PDFs, and portal lessons into vectorized memory records via Cloud Tasks.

#### Architectural Deliverables:
1. `src/platform/memory/ingestion/document-chunker.ts`:
   - Recursive token-aware chunker: splits text into 500-token chunks with 50-token overlap, preserving paragraph boundaries and extracting section titles.
   - Computes SHA-256 content hash per chunk for deduplication (Rule 22).
2. `src/platform/memory/ingestion/embedding-service.ts`:
   - Generates normalized dense embeddings using Firebase AI Logic / Gemini Embedding API (`text-embedding-004`, 768 dimensions) with local caching.
3. `src/platform/memory/ingestion/memory-ingestion-worker.ts`:
   - Background worker processing indexing jobs dispatched via Cloud Tasks (`/api/tasks/memory-indexer`).
   - Bounded batch sizes ($\le 20$ documents per lease) to respect Cloud Run memory limits (Rule 9).
4. `src/platform/memory/subscribers/domain-event-indexer.ts`:
   - EventBus subscriber listening to `crm.note.created`, `meeting.completed`, `deal.stage_changed` and enqueuing indexing tasks automatically.
5. `src/platform/__tests__/memory/ingestion-pipeline.test.ts`:
   - Tests covering chunking boundary preservation, embedding generation, Cloud Tasks OIDC authorization, and idempotent duplicate suppression.

---

### Milestone 4: Operator UI Surfaces — Company Brain, Knowledge Inbox & Standardized Inspector
**Target:** Deliver the first major agent product release UI: Company Brain (`/admin/brain`), Knowledge Inbox (`/admin/knowledge/inbox`), and Knowledge Item Inspector adhering to `theme.md` §8.

#### Architectural Deliverables:
1. `src/app/actions/memory-actions.ts`:
   - Next.js Server Actions: `searchMemoryAction`, `listKnowledgeInboxAction`, `inspectMemoryItemAction`, `deleteMemoryItemAction`, `updateMemorySettingsAction`.
   - Strict multi-tenant anti-IDOR checks (Rule 47) and Clerk authentication.
2. `src/components/brain/KnowledgeItemDrawer.tsx`:
   - Strictly conforms to `theme.md` Section 8:
     - Demarcated header (`<DialogHeader demarcated>`)
     - `<CardInfoTooltip text="..." />` single-circle icon elevated at `z-[10050]`
     - Zero raw visible description text; screen readers receive `<DialogDescription className="sr-only">`
     - Demarcated footer with tactile buttons (`active:scale-[0.97]`)
     - Renders chunk content, SHA-256 hash, temporal validity, source entity badge, and sensitivity pills.
3. `src/components/brain/CompanyBrainMetrics.tsx`:
   - 4 KPI cards: `Total Indexed Knowledge`, `Semantic Vectors`, `Active Sources`, `Memory Health & Sync`.
4. `src/components/brain/KnowledgeSearchBox.tsx`:
   - Real-time semantic search input with hybrid filter chips (`Notes`, `Meetings`, `Deals`, `Transcripts`).
5. `src/components/brain/MemorySettingsPanel.tsx`:
   - Sliders and switches for retention periods (30d, 90d, 365d, permanent), sensitivity classification, and Qdrant sync controls.
6. `src/app/admin/brain/page.tsx` & `src/app/admin/brain/BrainClient.tsx`:
   - Three-Zone layout (Header/Metrics, Search & Filter Bar, Knowledge Stream / Tabs).
   - Live real-time ingestion updates via `useEventStream` (Rule 62).
   - Legacy redirect from `/admin/companybrain` $\rightarrow$ `/admin/brain`.
7. `src/platform/__tests__/ui/company-brain.test.tsx`:
   - 12 UI unit & integration tests covering search interaction, drawer inspection, modal §8 invariants, and server action dispatch.

---

### Milestone 5: CRM Contextual Surfaces, Knowledge Graph Visualizer v1 & MCP Capabilities
**Target:** Embed institutional memory directly into CRM records, provide an interactive canvas visualizer for organizational entity connections, and expose memory capabilities to MCP and Agent Personas.

#### Architectural Deliverables:
1. `src/components/crm/KnowledgeContextPanel.tsx`:
   - Embedded sidebar component mounted in Contact and Deal views (`/admin/contacts/[id]`, `/admin/deals/[id]`).
   - Displays real-time AI context: recent customer mentions, key deal insights, previous meeting takeaways, and clickable evidence links.
2. `src/components/brain/KnowledgeGraphCanvas.tsx`:
   - Interactive canvas visualizer (UI #38 / Graph v1) rendering entity nodes (Companies, Contacts, Deals, Meetings, Notes) and relationship edges (`WORKS_AT`, `DISCUSSED_IN`, `RESULTED_IN`).
   - Click node to inspect entity in `KnowledgeItemDrawer.tsx`.
3. `src/platform/capabilities/domains/memory/memory-capabilities.ts`:
   - Registers typed capabilities in `globalCapabilityRegistry`:
     - `memory:semantic_search` (L0_READ)
     - `memory:get_context` (L0_READ)
     - `memory:create_item` (L2_STATE_MUTATION)
     - `memory:inspect_graph` (L0_READ)
     - `memory:purge_tenant_memory` (L4_PRIVILEGED_DESTRUCTIVE — triggers Two-Phase Action Proposal in `/admin/approvals`)
4. `src/platform/__tests__/ui/crm-knowledge-panel.test.tsx`:
   - Unit tests covering context generation, evidence link navigation, and empty states.

---

## 5. Verification & Quality Gates

Every milestone in Phase 4 must satisfy the rigorous 4-step quality gate before completion:
1. **Dedicated Unit & Integration Tests:** 100% pass rate in `src/platform/__tests__/memory/` and `src/platform/__tests__/ui/`.
2. **Platform Baseline Suite:** 100% green pass rate across all 89 test files (862+ tests) with zero regressions.
3. **Full TypeScript Compilation:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` must exit with code 0 and 0 errors.
4. **ESLint Static Analysis:** `pnpm lint` must exit with code 0 and 0 newly introduced lint errors.

---

## 6. Execution Sequence & Next Step

```
[Phase 4 Planning Approved]
           │
           ▼
[Milestone 1 Execution: Contracts, Storage Adapters & Vector Engine]
           │
           ▼
[Milestone 2 Execution: Retrieval Algorithm, Budgeting & Hybrid Search]
           │
           ▼
[Milestone 3 Execution: Ingestion, Chunking & Cloud Tasks Indexing]
           │
           ▼
[Milestone 4 Execution: Company Brain UI, Knowledge Inbox & Inspector]
           │
           ▼
[Milestone 5 Execution: CRM Context Panel & Knowledge Graph Canvas]
           │
           ▼
[Phase 4 Full QA & Architectural Code Review]
```
