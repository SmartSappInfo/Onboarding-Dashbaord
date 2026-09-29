# Unified 5-Tier Memory & Knowledge Architecture (Phase 0)
**Document 08 in the Agentic Architecture Suite**

---

## 1. The Five Memory Classes

SmartSapp unifies knowledge into five structured memory tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ORGANIZATIONAL MEMORY                           │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ Working Memory  │ Episodic Memory  │ Semantic Memory │ Relational Graph│
│ (Active Run)    │ (What Happened)  │ (What We Know)  │ (Connections)   │
├─────────────────┴──────────────────┴─────────────────┴─────────────────┤
│                          Procedural Memory                             │
│                  (How SmartSapp Executes: SOPs/Skills)                 │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Working Memory**: In-memory and transient run state (current goal, active step, temporary tool results, active assumptions). Discarded after run completion.
2. **Episodic Memory**: Event logs of what agents, users, and tools executed, including successes, user edits, corrections, and post-action outcomes.
3. **Semantic Memory**: Unstructured and semi-structured institutional knowledge (call notes, meeting transcripts, research dossiers, course lessons, policies) vectorized in **Qdrant** with payload filtering.
4. **Relational Memory (Context Graph)**: Entity-to-entity relationship graph modeling connections across schools, deals, attendees, invoices, and campaigns.
5. **Procedural Memory**: Governed playbooks, SOPs, prompt templates, and execution blueprints stored in the Prompt Management System (`PMS`).

---

## 2. Qdrant Multi-Tenant Semantic Vector Architecture

* **Collection**: `smartsapp_memory_v1`
* **Mandatory Payload Filtering**:
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
* Under no circumstances can a vector similarity search execute without tenant filtering.

---

## 3. Memory Governance & Temporal Validity (Rule 29)

Every memory record stores temporal and provenance metadata:
```typescript
interface MemoryObject {
  id: string;
  organizationId: string;
  workspaceId: string;
  content: string;
  sourceType: 'note' | 'meeting' | 'transcript' | 'crm' | 'portal_lesson';
  sourceId: string;
  authorId: string;
  confidence: number; // 0.0 to 1.0
  validFrom: string; // ISO 8601
  validUntil?: string; // Temporal invalidation support
  supersededBy?: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
}
```

---

## 4. Knowledge Poisoning & Prompt Injection Defense (Rule 30)

Retrieved memory documents are treated strictly as **untrusted data**, never as executable instructions:
* External content (customer notes, uploaded PDFs, meeting transcripts) is wrapped in isolation tags:
  ```xml
  <untrusted_reference_data source="meeting_transcript" id="123">
  ... content ...
  </untrusted_reference_data>
  ```
* Instructions inside untrusted data blocks are detected and neutralized by pre-retrieval filters.
