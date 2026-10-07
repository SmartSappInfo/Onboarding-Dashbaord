# Phase 11 Milestone 3 Completion Report: Knowledge Inbox & Graph: Candidate Ingestion, Multi-Domain Deduplication, Conflict Detection, Temporal Graph Linking & Embeddings Backfill

**Document ID:** `agents_mcp_phase_11_milestone_3_completion_report`  
**Phase:** 11 — Agentic Knowledge Base & Enterprise Memory  
**Milestone:** 3 — Candidate Ingestion, Multi-Domain Deduplication, Conflict Detection, Temporal Graph Linking & Embeddings Backfill  
**Author:** AI Agentic Architecture Engineer  
**Status:** COMPLETE (Ready for Senior Principal Systems & AI Agentic Architecture Review)  
**Verification Date:** 2026-10-07  

---

## 1. Executive Summary

Milestone 3 establishes the enterprise knowledge curation and graph governance layer of the SmartSapp platform. It bridges unstructured candidate facts extracted from meeting transcripts, conversational copilot sessions, and autonomous agent runs into verified institutional memory.

In strict compliance with `agents_mcp_rules.md`, `theme.md` §8 (Standardized Modal & Dialog System Architecture), and Cloud Run serverless constraints, Milestone 3 delivers:

1. **Knowledge & Review Queue Contracts (`knowledge-schemas.ts`, `knowledge-errors.ts`)**:
   - Canonical Zod v4 schemas for knowledge candidates, review queue decisions, factual conflict records, conflict resolutions, and bounded graph queries.
   - Structured error taxonomy (`KNOWLEDGE_ERROR_CODES`) and typed `KnowledgeDomainError` class.
   - Strict Rule 4 adherence: zero `any` or `any[]`.

2. **Governed Candidate Ingestion & Capability Registration (`knowledge-candidate-service.ts`)**:
   - Ingestion pipeline with automated prompt injection scanning (`ADVERSARIAL_DIRECTIVE_PATTERNS`, Rule 30).
   - Strict XML isolation containerization (`<untrusted_reference_data id="..." source="...">`, Rules 13 & 30).
   - Core capabilities registered: `knowledge.propose_candidate` (L1_INTERNAL_DRAFT), `knowledge.candidate.get` (L0_READ), `knowledge.candidate.list` (L0_READ).

3. **Human-in-the-Loop Review Queue & Rule 17 Non-Delegable Decider**:
   - `knowledge.review_queue.decide` (L2_STATE_MUTATION, Non-Delegable).
   - Programmatically rejects AI agents and autonomous subagents with `NON_DELEGABLE_ACTION` (Rule 17).
   - Atomic concurrency protection preventing double-spending on candidate decisions.

4. **Multi-Domain Deduplication Engine & Contradiction / Conflict Detection**:
   - Deduplication via normalized exact hashing and Jaccard word-token overlap ($\ge 0.80$, Rule 19).
   - Factual contradiction detection evaluating subject reference overlap and conflicting predicates.
   - Registered capabilities: `knowledge.deduplicate_candidate` (L0_READ), `knowledge.conflict.list` (L0_READ), `knowledge.conflict.resolve` (L2_STATE_MUTATION, Non-Delegable).

5. **Rule 29 Immutable Fact Supersession & Transactional Bridge (`knowledge-memory-bridge.ts`)**:
   - Eliminates destructive data loss: historic memory updated non-destructively with `validUntil: timestamp` and `supersededBy: newMemoryId`.
   - New memory inserted with `version: oldVersion + 1` and `validFrom: timestamp`.
   - Preserves complete point-in-time time-travel recovery.

6. **Relationship Graph Projection & Rule 55 Traversal Ceilings (`knowledge-graph-projection-service.ts`)**:
   - Automatically projects verified candidates into `graph_nodes` and `graph_edges`.
   - Strict Rule 55 query clamping: max $\le 80$ nodes, max $\le 150$ edges, depth $\le 2$ (or $\le 3$ for pathfinding) preventing browser freeze and memory exhaustion.
   - Registered capabilities: `knowledge.graph.get_neighbors` (L0_READ, clamped), `knowledge.graph.find_path` (L0_READ, clamped).

7. **Offline Embeddings Backfill Migration (`backfill-knowledge-embeddings.ts`)**:
   - Migration runner with `--dry-run` flag support and persistent checkpointing in `_migrations`.
   - Exponential backoff with jitter on HTTP 429 rate limits.
   - 768-dimensional embeddings generated matching the vector memory space.

8. **Review Desk UI, Server Actions & Standardized Modals (`theme.md` §8)**:
   - 5 typed Next.js Server Actions with Clerk authentication, Anti-IDOR validation, and Rule 60 dead-man switch checks.
   - `KnowledgeCandidateCard.tsx`: Triage card with `<untrusted_reference_data>` container, confidence chips, and tactile action buttons (`min-h-[44px]`).
   - `KnowledgeItemInspector.tsx`: Standardized inspector drawer showing temporal validity (`validFrom`, `validUntil`, `supersededBy`), source citations, and graph connections.
   - `KnowledgeConflictModal.tsx`: Standardized modal (`theme.md` §8) comparing candidate claim vs existing memory with 3 tactile resolution buttons.

9. **Verification, Adversarial Red-Team & Chaos Resilience Suite**:
   - 5 adversarial attack vectors verified in `knowledge-red-team.test.ts`.
   - 4 chaos and resilience scenarios verified in `knowledge-chaos.test.ts`.
   - 71/71 tests passing across 11 test suites (100% pass rate).

---

## 2. Deliverables Inventory

| Deliverable | Path | Description & Governance Role | Status |
| :--- | :--- | :--- | :--- |
| **Knowledge Schemas** | `src/platform/domains/knowledge_memory/contracts/knowledge-schemas.ts` | Zod v4 schemas for candidates, decisions, conflicts, graph queries. Rule 4 (zero `any`). | Complete |
| **Knowledge Error Taxonomy** | `src/platform/domains/knowledge_memory/contracts/knowledge-errors.ts` | Typed `KnowledgeDomainError` with `KNOWLEDGE_ERROR_CODES` and HTTP status mapping. | Complete |
| **Contracts Barrel** | `src/platform/domains/knowledge_memory/contracts/index.ts` | Export barrel for knowledge memory contracts. | Complete |
| **Domain Re-exports** | `src/platform/domains/knowledge/contracts/index.ts` | Forwarding barrel for backwards compatibility. | Complete |
| **Candidate Ingestion Service** | `src/platform/domains/knowledge_memory/services/knowledge-candidate-service.ts` | Governed candidate ingestion, prompt injection scanning, XML wrapping, and human review queue. | Complete |
| **Knowledge Capabilities** | `src/platform/domains/knowledge_memory/contracts/knowledge-capabilities.contract.ts` | Registration of 8 knowledge capabilities in `CapabilityRegistry`. | Complete |
| **Deduplication Engine** | `src/platform/domains/knowledge_memory/services/knowledge-deduplication-service.ts` | Exact hash and Jaccard token overlap deduplication. | Complete |
| **Conflict Detection Service** | `src/platform/domains/knowledge_memory/services/knowledge-conflict-service.ts` | Factual contradiction detection and human-only conflict resolution. | Complete |
| **Memory Supersession Bridge** | `src/platform/domains/knowledge_memory/services/knowledge-memory-bridge.ts` | Rule 29 immutable temporal supersession bridge. | Complete |
| **Graph Projection Service** | `src/platform/domains/knowledge_memory/services/knowledge-graph-projection-service.ts` | Graph node/edge projection with Rule 55 traversal ceilings. | Complete |
| **Embeddings Backfill Migration** | `scripts/migrations/backfill-knowledge-embeddings.ts` | Offline migration runner with `--dry-run`, checkpoints, and HTTP 429 retry. | Complete |
| **Server Actions** | `src/app/actions/knowledge-inbox-actions.ts` | 5 typed Server Actions with auth, Anti-IDOR, and dead-man pause. | Complete |
| **Candidate Card Component** | `src/components/knowledge/KnowledgeCandidateCard.tsx` | Triage card with XML container, confidence badge, and tactile buttons. | Complete |
| **Item Inspector Drawer** | `src/components/knowledge/KnowledgeItemInspector.tsx` | Standardized drawer adhering to `theme.md` §8 with temporal validity panel. | Complete |
| **Conflict Resolution Modal** | `src/components/knowledge/KnowledgeConflictModal.tsx` | Standardized modal adhering to `theme.md` §8 with 3 tactile resolution options. | Complete |
| **Components Barrel** | `src/components/knowledge/index.ts` | Export barrel for knowledge UI components. | Complete |
| **Contracts Test Suite** | `src/platform/__tests__/knowledge/knowledge-contracts.test.ts` | 10 tests verifying schemas, Zod validation, and error taxonomy. | Complete |
| **Candidate Capabilities Test** | `src/platform/__tests__/knowledge/knowledge-candidate-capabilities.test.ts` | 10 tests verifying capability execution and permissions. | Complete |
| **Review Queue Test Suite** | `src/platform/__tests__/knowledge/knowledge-review-queue.test.ts` | 7 tests verifying human decider gate, agent rejection, and version checks. | Complete |
| **Deduplication & Conflict Test** | `src/platform/__tests__/knowledge/knowledge-deduplication-and-conflicts.test.ts` | 9 tests verifying exact/token dedup and conflict detection. | Complete |
| **Supersession Test Suite** | `src/platform/__tests__/knowledge/knowledge-supersession.test.ts` | 4 tests verifying Rule 29 temporal immutability and dual doc updates. | Complete |
| **Graph Projection Test Suite** | `src/platform/__tests__/knowledge/knowledge-graph-projection.test.ts` | 6 tests verifying node/edge projection and Rule 55 traversal limits. | Complete |
| **Backfill Migration Test Suite** | `src/platform/__tests__/knowledge/knowledge-backfill-migration.test.ts` | 3 tests verifying `--dry-run`, batching, and embedding generation. | Complete |
| **Server Actions Test Suite** | `src/platform/__tests__/ui/knowledge-inbox-actions.test.ts` | 6 tests verifying auth, IDOR, dead-man pause, and capability dispatch. | Complete |
| **UI Components Test Suite** | `src/platform/__tests__/ui/knowledge-inbox-components.test.tsx` | 5 React Testing Library tests verifying `theme.md` §8 compliance. | Complete |
| **Adversarial Red-Team Suite** | `src/platform/__tests__/knowledge/knowledge-red-team.test.ts` | 6 tests verifying 5 adversarial attack vectors. | Complete |
| **Chaos & Resilience Suite** | `src/platform/__tests__/knowledge/knowledge-chaos.test.ts` | 5 tests verifying double-spend races, 429 backoff, schema rejection, and load. | Complete |

---

## 3. Rule 67 Agent Implementation Gate Verification

### 3.1. Identity & Authority
- **Canonical Capability Domain:** `knowledge_memory` (defined in `CAPABILITY_DOMAINS` at `capability-definition.ts:18`).
- **Principal & Authentication:** All mutations route through Clerk session authentication (`requireAuth()`) extracting verified `userId` and `organizationId`.
- **Anti-IDOR Multi-Tenant Lock:** Server Actions enforce `assertTenantAccess(auth, workspaceId)` matching session tenant boundaries against requested entity/workspace IDs (Rules 8 & 47).
- **Rule 17 Non-Delegable Decider:** Candidate decisions (`knowledge.review_queue.decide`) and conflict resolutions (`knowledge.conflict.resolve`) require `actor.type === 'user'`. Any AI agent or subagent attempting to decide is rejected with `NON_DELEGABLE_ACTION`.

### 3.2. Risk & Blast Radius
- **Risk Taxonomy Adherence:**
  - `knowledge.candidate.get`, `knowledge.candidate.list`, `knowledge.deduplicate_candidate`, `knowledge.conflict.list`, `knowledge.graph.get_neighbors`, `knowledge.graph.find_path`: `L0_READ`
  - `knowledge.propose_candidate`: `L1_INTERNAL_DRAFT` (proposals do not mutate production memory)
  - `knowledge.review_queue.decide`, `knowledge.conflict.resolve`: `L2_STATE_MUTATION` (human-only, non-delegable)
- **Zero Raw Mutations:** Candidate ingestion writes exclusively to `knowledge_inbox_candidates`. Production `memory_objects` are only touched upon explicit human review acceptance.

### 3.3. Invariants & Isolation
- **Rule 13 & 30 Untrusted Reference Data Container:** Candidate content is scanned for `ADVERSARIAL_DIRECTIVE_PATTERNS` and wrapped in `<untrusted_reference_data id="..." source="...">` XML containers.
- **Rule 29 Immutable Temporal Fact Supersession:** Old memories are never deleted or destructively overwritten. Old record receives `validUntil: timestamp` + `supersededBy: newId`; new record is created with `validFrom: timestamp` and `version: oldVersion + 1`.
- **Rule 55 Graph Canvas Ceilings:** Traversal clamped to $\le 80$ nodes, $\le 150$ edges, depth $\le 2$ (or $\le 3$ for pathfinding).

### 3.4. Resilience & Observability
- **Emergency Governance Dead-Man Switch:** Evaluated at Step 1 of all server actions and candidate services (`checkGovernanceDeadManSwitch`), failing closed with `KNOWLEDGE_DEAD_MAN_PAUSED` (Rule 60).
- **Domain Event Publishing:** Emits typed domain events (`knowledge.candidate.proposed`, `knowledge.candidate.decided`, `knowledge.conflict.detected`, `knowledge.conflict.resolved`, `knowledge.graph.projected`) via `defaultEventBus` (Rule 40).
- **Concurrency & Idempotency:** Mutual exclusion decision locks prevent double-spend races. Versions checked atomically to prevent TOCTOU overwrites.

---

## 4. Verification Evidence & Test Results

```bash
pnpm vitest run src/platform/__tests__/knowledge/ src/platform/__tests__/ui/knowledge-inbox-actions.test.ts src/platform/__tests__/ui/knowledge-inbox-components.test.tsx
```

```text
Test Files  11 passed (11)
     Tests  71 passed (71)
  Duration  3.27s

✓ src/platform/__tests__/knowledge/knowledge-contracts.test.ts (10)
✓ src/platform/__tests__/knowledge/knowledge-candidate-capabilities.test.ts (10)
✓ src/platform/__tests__/knowledge/knowledge-review-queue.test.ts (7)
✓ src/platform/__tests__/knowledge/knowledge-deduplication-and-conflicts.test.ts (9)
✓ src/platform/__tests__/knowledge/knowledge-supersession.test.ts (4)
✓ src/platform/__tests__/knowledge/knowledge-graph-projection.test.ts (6)
✓ src/platform/__tests__/knowledge/knowledge-backfill-migration.test.ts (3)
✓ src/platform/__tests__/ui/knowledge-inbox-actions.test.ts (6)
✓ src/platform/__tests__/ui/knowledge-inbox-components.test.tsx (5)
✓ src/platform/__tests__/knowledge/knowledge-red-team.test.ts (6)
✓ src/platform/__tests__/knowledge/knowledge-chaos.test.ts (5)
```

**Pass Rate:** 100% (71 tests passing out of 71).

---

## 5. Master Rules Compliance Matrix

| Rule | Description | Implementation Mechanism | Evidence |
| :---: | :--- | :--- | :--- |
| **Rule 4** | Zero `any`/`any[]` | Strict TypeScript types across contracts, services, actions, components, tests. | Zero `any` in all authored files |
| **Rule 7** | Mobile Touch Targets | Buttons configured with `min-h-[44px]` and tactile `active:scale-[0.97]`. | `KnowledgeCandidateCard.tsx`, `KnowledgeConflictModal.tsx` |
| **Rule 8** | Multi-Tenant Scoping | Workspace boundaries asserted on all candidate queries and mutations. | `knowledge-inbox-actions.ts:25-35` |
| **Rule 10** | Zod v4 Schemas | All schemas authored via `zod/v4`. | `knowledge-schemas.ts` |
| **Rule 13** | Untrusted Tool Data | Content wrapped in `<untrusted_reference_data id="..." source="...">`. | `knowledge-candidate-service.ts:60` |
| **Rule 17** | Non-Delegable Decider | Candidate and conflict decisions restricted strictly to `actor.type === 'user'`. | `knowledge-candidate-service.ts:237` |
| **Rule 19** | Idempotency | Deterministic keys and mutual exclusion locks prevent duplicate writes. | `knowledge-candidate-service.ts:245` |
| **Rule 29** | Fact Supersession | Dual document transactional updates with `validUntil` and `supersededBy`. | `knowledge-memory-bridge.ts:35` |
| **Rule 30** | Injection Scanning | Non-backtracking regex scanner rejects prompt injection attempts. | `knowledge-candidate-service.ts:28` |
| **Rule 40** | Domain Events | Published via `defaultEventBus.publish(createDomainEvent(...))`. | `knowledge-candidate-service.ts:292` |
| **Rule 45** | Chaos & Resilience | Double-spend protection, 429 backoff, high-concurrency 50-item benchmark. | `knowledge-chaos.test.ts` |
| **Rule 46** | Adversarial Red-Team | 5 attack vectors (prompt injection, agent decider spoofing, IDOR, etc.). | `knowledge-red-team.test.ts` |
| **Rule 47** | Anti-IDOR Scoping | Validates session organization and workspace against candidate workspace. | `knowledge-inbox-actions.ts` |
| **Rule 48** | Error Taxonomy | Typed `KnowledgeDomainError` with canonical error codes. | `knowledge-errors.ts` |
| **Rule 51** | Server Actions | Secure `'use server'` actions with `requireAuth()`. | `knowledge-inbox-actions.ts` |
| **Rule 55** | Graph Canvas Ceilings | Clamped to $\le 80$ nodes, $\le 150$ edges, depth $\le 2$. | `knowledge-graph-projection-service.ts:160` |
| **Rule 60** | Dead-Man Switch | Evaluated at Step 1, returning `KNOWLEDGE_DEAD_MAN_PAUSED`. | `knowledge-candidate-service.ts:71` |
| **Rule 68** | Five Non-Negotiables | Complete compliance across boundaries, auditability, and operability. | Section 3 of this report |
| **Rule 69** | Strangler Fig Invariant | Zero breaking changes to existing brain or graph features. | Re-export barrels maintained |
| **theme.md §8** | Standardized Modals | Surface, demarcated header/footer, single-circle info tooltip at `z-[10050]`. | `KnowledgeItemInspector.tsx`, `KnowledgeConflictModal.tsx` |

---

## 6. Conclusion & Readiness

Phase 11 Milestone 3 has achieved 100% completion against all requirements, specifications, and governance rules. All 9 tasks (P11-M3-T0 through P11-M3-T8) have been executed with complete test verification.

The subsystem is fully prepared for Senior Principal Systems & AI Agentic Architecture Review.
