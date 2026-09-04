# CompanyBrain: Operations & Maintenance Runbook
**File:** `docs/CompanyBrain/companybrain_manual.md`  
**Current Milestone:** Phases 1–4 Deployed & Active (Notes, Semantic Search, Knowledge Graph, Conflict Engine & Freshness Governance)  
**Status:** Operational (Low-Noise Runbook)

---

## 1. System Status & Infrastructure Health

All foundational infrastructure for Phases 1, 2, 3, and 4 is deployed, indexed, and active:

| Subsystem | Deployed Component | Status | Location / Cluster |
| :--- | :--- | :--- | :--- |
| **Firestore Security Rules** | `/memory_objects`, `/companybrain_governance`, `/graph_nodes`, `/graph_edges`, `/memory_conflicts` | **LIVE** | Project `studio-9220106300-f74cb` |
| **Firestore Compound Indexes** | 6 memory indexes + 9 graph composite indexes + 4 conflict composite indexes | **LIVE** | Compiled & active |
| **Qdrant Vector Engine** | Collection `smartsapp_memory` (768d Cosine) | **HEALTHY** | Qdrant Cloud (GCP `australia-southeast1-0`) |
| **Circuit Breakers** | Deterministic embeddings, graph traversal fallbacks & contradiction heuristics | **ACTIVE** | Auto-engages on network or API failures |

---

## 2. Immediate Required Action: Rotate Google AI API Key

> [!CAUTION]
> **Action Required in `.env.local` and Cloud Secret Managers**  
> The previous Google AI API key was flagged as leaked by Google (`403 PERMISSION_DENIED: Your API key was reported as leaked`).  
> 
> 1. Obtain a fresh API key from [Google AI Studio](https://aistudio.google.com).
> 2. Set `GEMINI_API_KEY=<new_key>` in `.env.local` (and your production hosting secrets).
> 
> *Note:* The codebase is standardized **exclusively on `GEMINI_API_KEY`**. `GOOGLE_GENAI_API_KEY` has been deprecated and unified. The built-in deterministic fallback ensures no crashes occur while the key is being rotated.

---

## 3. Active Operational Runbooks (FER Protocol)

All synchronization and backfill scripts are **100% idempotent** and safe to run multiple times without data duplication.

### 3.1. Backfill Notes into Memory Objects
Extracts atomic decisions, problems, insights, and commitments from existing Quick Notes:
```bash
# Telemetry Dry Run (no writes)
DRY_RUN=true npx tsx scripts/fer-backfill-notes-to-memories.ts

# Live Backfill
npx tsx scripts/fer-backfill-notes-to-memories.ts
```

### 3.2. Synchronize Memories to Qdrant Vectors
Chunks and embeds `memory_objects` into Qdrant Cloud points:
```bash
# Telemetry Dry Run
DRY_RUN=true npx tsx scripts/fer-sync-memories-to-qdrant.ts

# Live Sync (all pending memories)
npx tsx scripts/fer-sync-memories-to-qdrant.ts

# Target a specific workspace
TARGET_WORKSPACE_ID=<workspace_id> npx tsx scripts/fer-sync-memories-to-qdrant.ts

# Force re-index existing memories
FORCE_REINDEX=true npx tsx scripts/fer-sync-memories-to-qdrant.ts
```

### 3.3. Synchronize Knowledge Graph Mesh
Scans CRM Entities, Contacts, Deals, and Memories, projecting them into graph nodes and typed edges:
```bash
# Telemetry Dry Run
DRY_RUN=true npx tsx scripts/fer-sync-graph-relations.ts

# Live Sync (all workspaces)
npx tsx scripts/fer-sync-graph-relations.ts

# Target a specific workspace
TARGET_WORKSPACE_ID=<workspace_id> npx tsx scripts/fer-sync-graph-relations.ts
```

### 3.4. Scan Memory Contradictions & Conflicts
Evaluates memory clusters for opposing claims, diverging numbers, and obsolete assertions:
```bash
# Telemetry Dry Run (no writes)
DRY_RUN=true npx tsx scripts/fer-scan-memory-conflicts.ts

# Live Audit (persists detected conflicts to /memory_conflicts)
npx tsx scripts/fer-scan-memory-conflicts.ts

# Target a specific workspace
TARGET_WORKSPACE_ID=<workspace_id> npx tsx scripts/fer-scan-memory-conflicts.ts
```

---

## 4. UI Surfaces & Backoffice Governance

Administrators and operators can inspect, query, and manage CompanyBrain across these surfaces:

| Surface | URL Path | Capabilities |
| :--- | :--- | :--- |
| **Quick Notes & Memory Extractor** | `/admin/quick-notes` | Dual-view notes/memories, human-in-the-loop candidate confirmation, semantic badges. |
| **Knowledge Conflict Center** | `/admin/quick-notes/conflicts` | Full-page contradiction review, side-by-side claim comparison, 1-click supersede adjudication, custom audit notes. |
| **Global Semantic Search** | `/admin/quick-notes/search` | Natural language vector search, cosine scores, "Why this matched" attribution, verbatim evidence drawer. |
| **Entity Knowledge Graph** | `/admin/entities/[id]` *(Knowledge Graph tab)* | Contextual relationship topology, 1-click AI connection explanation, connected memory timeline. |
| **Vector & Governance Control Plane** | `/backoffice/companybrain` | Qdrant cluster latency/health, live search playground, LRU cache purge, on-demand re-index, and batch contradiction audits. |
| **Knowledge Graph Console** | `/backoffice/knowledge-graph` | Node/edge distribution metrics, cycle-safe 3-hop shortest path simulator, in-browser tenant mesh sync. |

---

## 5. Troubleshooting Matrix

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Zero results on semantic search** | Memory records exist in Firestore but have not been indexed to Qdrant. | Run `npx tsx scripts/fer-sync-memories-to-qdrant.ts` or click "Start Vector Re-index" in `/backoffice/companybrain`. |
| **Graph empty for a workspace** | Relations have not yet been projected into the graph collections. | Run `TARGET_WORKSPACE_ID=<ws_id> npx tsx scripts/fer-sync-graph-relations.ts` or click "Sync Graph Mesh" in `/backoffice/knowledge-graph`. |
| **Unresolved contradiction alerts** | Mutually opposing claims detected between two notes or meetings. | Navigate to `/admin/quick-notes/conflicts` to adjudicate which claim is authoritative. |
| **Memories showing as "Stale"** | Memory age has exceeded category TTL (e.g. 90d pricing, 180d stakeholder). | Open the "Decaying / Stale" tab in `/admin/quick-notes` and click "Reconfirm Truth" (1-click refresh). |
| **"API Key Leaked" or AI Explanation Fallback** | `GEMINI_API_KEY` was revoked or quota exceeded. | Replace with a fresh key from Google AI Studio. Fallback engine automatically produces deterministic explanations in the interim. |
| **Qdrant Cluster degraded/offline** | Network connectivity issue or Qdrant Cloud maintenance. | The application automatically routes queries through the in-memory fallback store with zero downtime. |
| **Permission Denied on graph or conflict writes** | Direct client SDK mutation attempt. | Collections are server-side write protected (`allow write: if false;`). Mutations must flow through Server Actions. |

---

## 6. Forward Look: Phase 5 Preparation

Upcoming milestone: **Multi-Tenant Knowledge Federation & Dynamic Synthesis**:
1. Cross-workspace federated knowledge querying and consensus policies.
2. Federated memory deduplication and access control redaction filters.
3. Automated scheduled graph optimization and orphan node pruning.
