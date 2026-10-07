# Phase 11 · Milestone 3 Implementation Plan
## Knowledge Inbox & Graph: Candidate Ingestion, Multi-Domain Deduplication, Conflict Detection, Temporal Graph Linking & Embeddings Backfill

**Version:** 1.0.0 (full `agents_mcp_rules.md` conformance; no functionality removed)
**Status:** PLANNING (ready for execution after Milestone 2 close-out).
**Date:** 2026-10-07
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §1.1 (knowledge substrate), §5.1 (Memory SSOT), §5.8 (Knowledge Inbox → memory), §8 (deliverables), §9 (risks), §13 (P11-M3-T1…T4).
**Depends on:**
- M0 (Memory SSOT on Firestore, governed gateway routing, real proposal mutation/rollback, durable approvals, no fallback secrets).
- M1 (Meeting capabilities, ingestion, segments subcollection, consent gate).
- M2 (Meeting Analyst extraction pipeline, outcomes, items, verified tasks and proposals).

**Governing Rules:** [`agents_mcp_rules.md`](../agents_mcp_rules.md) Important 1–10 (Rules 4 and 5 as amended) and Rules 11–69, applied in full; [`.agents/AGENTS.md`](../../../.agents/AGENTS.md); `theme.md` §8.

---

### Change Log & Review Context

| Document Reviewed | Purpose & Invariants Captured |
| :--- | :--- |
| `agents_mcp_rules.md` | Rules 1–69: Zero `any` (Rule 4), trust boundary matrix (Rule 13), non-delegable human decide (Rule 17), idempotency (Rule 19), two-phase binding (Rules 21, 22), supersession not overwrite (Rule 29), anti-poisoning (Rule 30), graph canvas limits (Rule 55), Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Capability SSOT (`executeCapability`). |
| `agents_mcp_roadmap.md` | Phase 11 Knowledge Substrate; §13 test pyramid; §19 retrieval ranking; §20 graph schema; §34 release gates; §35 DoD. |
| `agents_mcp_prd.md` | §22–26 graph; §27–28 ingestion; §32–35 extraction/consolidation/contradictions; §62 Knowledge Inbox; §66–76 permissions/security/retention/deletion. |
| `agents_mcp_tools.md` | Domain 4: Organization Knowledge & Memory 2.0 (Search, Ingestion, Management, Graph, Governance, Context Assembly). |
| `agents_mcp_ui.md` | §14–18 Knowledge Inbox, Inspector, Graph, swipe/undo gestures. |
| `agents_mcp_cloudrun.md` | Stateless execution, Cloud Tasks async processing, Firestore/Qdrant memory persistence. |
| `agents_mcp_idea.md` | Tri-tier memory architecture (Structured Firestore + Semantic Embeddings + Relationship Graph). |

---

## 1. Goal

Milestone 3 transforms raw, unverified items (from post-meeting extraction, note creation, and external communication) into a **curated, high-trust, temporally versioned institutional knowledge graph**:

1. **Governed Candidate Ingestion:** Meeting extractions, notes, and agent observations propose knowledge candidates into `knowledge_inbox_candidates` via governed capability `knowledge.propose_candidate`. Candidates are **never written directly to persistent memory**.
2. **Human-in-the-Loop Review Queue:** Human operators review candidates in the Knowledge Inbox. Deciding a candidate (`knowledge.review_queue.decide`) is **strictly non-delegable to AI agents (Rule 17)** and requires the authenticated `knowledge:review` permission.
3. **Multi-Domain Deduplication & Conflict Detection:** Automated deduplication against existing memory objects and deterministic conflict detection (`memory_conflicts`) flagging contradictory statements across accounts, dates, and stakeholders.
4. **Temporal Fact Supersession (Rule 29):** Approved revisions supersede existing facts by atomically populating `validUntil` and `supersededBy`. **Historic memory records are never destructively overwritten or erased.**
5. **Relationship Graph Projection:** Materializes `graph_nodes` and `graph_edges` linking entities, meetings, commitments, and institutional facts with explicit verification states (`proposed`, `verified`, `disputed`) and strict canvas limits (≤ 80 nodes, ≤ 150 edges; Rule 55).
6. **Embeddings Backfill Migration:** Resumable, idempotent offline script computing 768-dimensional embeddings (`gemini-embedding-001`) for historical accepted `knowledge_insights` with dry-run safety.

---

## 2. Verified Baseline (Code as of `3f949d42`)

### 2.1 Reused Assets (Rules 7, 69)

| Asset | Location | State & Use in M3 |
| :--- | :--- | :--- |
| Memory Object Repository | `src/lib/memory/memory-repository.ts` | Multi-tenant CRUD on `/memory_objects` with batch chunking (≤250) and tenant scoping. |
| Graph Repository | `src/lib/memory/graph-repository.ts` | Node and edge storage in `/graph_nodes` and `/graph_edges` with cascade deletion integrity. |
| Conflict Repository | `src/lib/memory/conflict-repository.ts` | Conflict storage in `/memory_conflicts` with resolution audit trails. |
| Knowledge Inbox Repository | `src/lib/knowledge-inbox-repository.ts` | Storage for inbox items and insights (`knowledge_inbox_items`, `knowledge_insights`). |
| Note Vector Index & Embeddings | `src/lib/note-index-repository.ts`, `src/ai/flows/embed-note-flow.ts` | Firestore vector search + `gemini-embedding-001` (768 dimensions). |
| Platform Memory Contracts | `src/platform/memory/contracts/memory-types.ts` | 5-tier memory model, Zod v4 schemas, sensitivity tiers, temporal decay. |
| Governed Capability Gateway | `src/platform/capabilities/execution/pipeline/` | 13-stage governed execution pipeline enforcing auth, tenant isolation, and audit. |
| Meeting Outcomes & Items | `src/lib/meetings/intelligence/pipeline.ts` | Source of meeting-derived facts, decisions, and commitments. |

### 2.2 Gaps Milestone 3 Fixes

| # | Finding / Defect | Remediation in M3 |
| :--- | :--- | :--- |
| **K1** | Inbox candidates are not governed capabilities; client actions write directly via repository | Wrap in canonical capabilities (`knowledge.propose_candidate`, `knowledge.review_queue.decide`) routing through `executeCapability`. |
| **K2** | Any workspace member can decide inbox items without permission checks | Enforce `knowledge:review` permission + workspace membership; agent callers strictly forbidden (Rule 17). |
| **K3** | Accepted insights do not automatically project into `graph_nodes` or `graph_edges` | Automated graph edge synthesis upon candidate acceptance with transactional consistency. |
| **K4** | No automated conflict detection when a new fact contradicts an existing fact | Build deterministic conflict detection evaluating subject-predicate overlap and temporal boundaries. |
| **K5** | Memory updates perform destructive overwrite rather than temporal supersession | Implement Rule 29 immutable supersession: set `validUntil` + `supersededBy` on previous record, create new record with version increment. |
| **K6** | Historical `knowledge_insights` lack vector embeddings | Build resumable backfill script with `--dry-run` and progress tracking. |

---

## 3. Functionality Preservation (Important Rules 1–3)

| Existing Feature | Guarantee | Verification Method |
| :--- | :--- | :--- |
| Quick Notes Inbox (`/admin/brain`) | Preserved 100%; reads and writes to `knowledge_inbox_items` continue working without regression. | Existing Quick Notes test suites stay green. |
| Knowledge Graph Viewer (`/admin/brain/graph`, Backoffice) | Existing graph nodes and edges render unchanged; new verification badges (`proposed`, `verified`) are additive. | Graph UI component tests pass. |
| Note Search (`note_index`) | Untouched; search continues using existing 768-dim embeddings. | Note search contract tests pass. |
| Meeting Intelligence Outcomes (Phase 11 M2) | Preserved; M2 outcomes pipeline can now dispatch candidates to M3 knowledge capabilities. | Pipeline integration tests pass. |

---

## 4. Architecture & Contracts

### 4.1 Knowledge Flow Topology

```text
[Meeting Outcomes / Note / External Source]
                       │
                       ▼ (Rule 13: Untrusted Content)
           <untrusted_reference_data>
                       │
                       ▼
         knowledge.propose_candidate (L1)
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
Deduplication Scan            Conflict Detection
(Hash + Semantic)             (Subject/Predicate Overlap)
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
          knowledge_inbox_candidates
                       │
                       ▼
       HUMAN REVIEW QUEUE (Rule 17: Non-Delegable)
      [Accept]      [Accept with Edit]      [Reject]
          │                  │                  │
          ▼                  ▼                  ▼
    knowledge.review_queue.decide (L2)      Candidate Marked
          │                                   'rejected'
          ├─────────────────────────────────────┐
          ▼                                     ▼
1. Write memory_objects               2. Project Graph Edges
   - Generate 768-dim embedding          - graph_nodes (subject, object)
   - Supersede old fact (Rule 29)        - graph_edges (predicate)
   - verificationState = 'verified'      - verificationState = 'verified'
          │                                     │
          └──────────────────┬──────────────────┘
                             ▼
              Publish EventBus Domain Events:
              - knowledge.candidate.decided
              - memory.created / memory.superseded
```

### 4.2 Trust-Boundary Matrix (Rule 13)

| Data Entity | Trust Tier | Boundary Control |
| :--- | :--- | :--- |
| Candidate Content (from meeting/note) | **UNTRUSTED** | XML containerization (`<untrusted_reference_data>`); scanned for injection directives (`ADVERSARIAL_DIRECTIVE_PATTERNS`). |
| Inferred Graph Relationships | **MODEL-GENERATED** | Marked `verificationState: 'proposed'` until confirmed by human operator. |
| Human Decision & Notes | **USER TRUST** | Authenticated session (`requireAuth`); sanitized before persistence. |
| Existing Memory Objects | **INTERNAL DATA** | Multi-tenant boundary assertion (`organizationId`, `workspaceId`). |
| Restrictive Sensitivity (`confidential`/`restricted`) | **SENSITIVE** | Masked from general retrieval; requires elevated scope `knowledge:read_restricted`. |

### 4.3 Governed Capability Inventory

| Capability | Risk Level | Idempotency Key Formula | Non-Delegable? |
| :--- | :--- | :--- | :--- |
| `knowledge.propose_candidate` | L1_INTERNAL_DRAFT | `kn_prop_${workspaceId}_${sourceId}_${contentHash}` | No (Agents & humans) |
| `knowledge.candidate.get` | L0_READ | n/a (Read-only) | No |
| `knowledge.candidate.list` | L0_READ | n/a (Read-only) | No |
| `knowledge.review_queue.decide` | L2_STATE_MUTATION | `kn_dec_${candidateId}_${decision}_${version}` | **YES (Human-only; Rule 17)** |
| `knowledge.conflict.list` | L0_READ | n/a (Read-only) | No |
| `knowledge.conflict.resolve` | L2_STATE_MUTATION | `kn_cnf_res_${conflictId}_${version}` | **YES (Human-only; Rule 17)** |
| `knowledge.graph.get_neighbors` | L0_READ | n/a (Read-only, bounded ≤80) | No |
| `knowledge.graph.find_path` | L0_READ | n/a (Read-only, maxDepth ≤3) | No |

---

## 5. Milestone 3 Bite-Sized Task Breakdown

### Task P11-M3-T1: Governed Candidate Ingestion & Review Queue
- **Files to touch:**
  - Create: `src/platform/domains/knowledge/contracts/knowledge-capabilities.contract.ts`
  - Create: `src/platform/domains/knowledge/contracts/knowledge-schemas.ts`
  - Create: `src/platform/domains/knowledge/services/knowledge-candidate-service.ts`
  - Modify: `src/platform/capabilities/registry/capability-registry.ts`
  - Test: `src/platform/__tests__/knowledge/knowledge-candidate-capabilities.test.ts`
- **Sub-tasks:**
  - [ ] **Step 1:** Author Zod v4 schemas for `KnowledgeCandidate`, `ProposeCandidateInput`, `ReviewQueueDecideInput`, and `KnowledgeConflict`.
  - [ ] **Step 2:** Write failing tests for `knowledge.propose_candidate` and `knowledge.review_queue.decide`.
  - [ ] **Step 3:** Implement `knowledge.propose_candidate` with `<untrusted_reference_data>` isolation, prompt injection scanning, and idempotency key enforcement.
  - [ ] **Step 4:** Implement `knowledge.review_queue.decide` with live authority check asserting caller is human (rejecting agent callers with `NON_DELEGABLE_ACTION`).
  - [ ] **Step 5:** Run tests, verify 100% pass, and commit.

### Task P11-M3-T2: Deduplication, Conflict Detection & Immutable Fact Supersession (Rule 29)
- **Files to touch:**
  - Create: `src/platform/domains/knowledge/services/knowledge-deduplication-service.ts`
  - Create: `src/platform/domains/knowledge/services/knowledge-conflict-service.ts`
  - Modify: `src/platform/memory/services/canonical-memory-service.ts`
  - Test: `src/platform/__tests__/knowledge/knowledge-conflict-and-supersession.test.ts`
- **Sub-tasks:**
  - [ ] **Step 1:** Write failing tests asserting duplicate candidate detection and contradiction detection across overlapping facts.
  - [ ] **Step 2:** Implement exact-hash and token-overlap deduplication against `memory_objects`.
  - [ ] **Step 3:** Implement conflict detection engine generating `memory_conflicts` when candidate contradicts an active fact.
  - [ ] **Step 4:** Implement Rule 29 atomic supersession: previous memory object updated with `validUntil: now` and `supersededBy: newId`; new object created with `version: prev + 1`. Zero destructive overwrites.
  - [ ] **Step 5:** Run tests, verify 100% pass, and commit.

### Task P11-M3-T3: Relationship Graph Projection & Traversal Limits (Rule 55)
- **Files to touch:**
  - Create: `src/platform/domains/knowledge/services/knowledge-graph-projection-service.ts`
  - Modify: `src/lib/memory/graph-repository.ts`
  - Test: `src/platform/__tests__/knowledge/knowledge-graph-projection.test.ts`
- **Sub-tasks:**
  - [ ] **Step 1:** Write failing tests for graph node/edge creation on candidate acceptance and bounded neighbor traversal.
  - [ ] **Step 2:** Implement projection service extracting subject/object nodes and relationship edges with `verificationState: 'verified'`.
  - [ ] **Step 3:** Enforce Rule 55 canvas ceilings: queries clamp results to ≤ 80 nodes and ≤ 150 edges with depth limits ≤ 2.
  - [ ] **Step 4:** Run tests, verify 100% pass, and commit.

### Task P11-M3-T4: Offline Embeddings Backfill Migration
- **Files to touch:**
  - Create: `scripts/migrations/backfill-knowledge-embeddings.ts`
  - Test: `src/platform/__tests__/knowledge/knowledge-backfill-migration.test.ts`
- **Sub-tasks:**
  - [ ] **Step 1:** Write failing tests for the backfill migration runner using mocked embedding provider.
  - [ ] **Step 2:** Implement idempotent batch reader scanning un-embedded `knowledge_insights` and generating 768-dim vectors.
  - [ ] **Step 3:** Add `--dry-run` flag reporting items to embed without mutating Firestore.
  - [ ] **Step 4:** Store progress in `_migrations/backfill_knowledge_embeddings_{workspaceId}` to enable safe crash recovery and resumption.
  - [ ] **Step 5:** Run tests, verify 100% pass, and commit.

---

## 6. Risk Register & Failure Matrix (Important Rule 2)

| # | Risk | Likelihood / Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **R1** | Poisoned candidates enter memory through auto-acceptance | Med / High | Auto-accept is **disabled by default**; requires manual Backoffice activation per workspace; injection flag blocks auto-accept unconditionally. |
| **R2** | Infinite relationship expansion causes graph traversal out-of-memory | Med / Med | Strict query bounds enforced in code (≤ 80 nodes, ≤ 150 edges, max depth 2; Rule 55). |
| **R3** | Concurrent operator decisions on same candidate (race condition) | Med / Low | Atomic transaction on `knowledge_inbox_candidates` checking `status === 'pending'`. Second attempt fails cleanly with `CANDIDATE_ALREADY_DECIDED`. |
| **R4** | Backfill script hits Gemini API rate limits (429) | High / Med | Rate-limited chunk dispatcher with exponential backoff and persistent progress checkpointing. |

---

## 7. Definition of Done (Rule 67 Agent Implementation Gate)

Every task in Milestone 3 must fulfill:
1. **Architecture:** Single Source of Truth through `executeCapability` and `CanonicalMemoryService`; domain events emitted (`knowledge.candidate.created`, `knowledge.candidate.decided`, `memory.created`, `memory.superseded`).
2. **Authority:** Human-only enforcement on `knowledge.review_queue.decide` (Rule 17); agent callers strictly rejected.
3. **Data:** `<untrusted_reference_data>` isolation; linear secret redaction; sensitivity tiering (`public`, `internal`, `confidential`, `restricted`).
4. **Execution:** Idempotent keys (`kn_prop_*`, `kn_dec_*`); zero destructive deletes; atomic supersession (Rule 29).
5. **Testing:** 100% test coverage across contracts, deduplication, conflict detection, graph projection, and backfill migration. Zero `any` or `any[]` (Rule 4).
