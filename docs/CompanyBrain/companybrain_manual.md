# CompanyBrain: Operations & Maintenance Runbook
**File:** `docs/CompanyBrain/companybrain_manual.md`  
**Current Milestone:** Phases 1–5 Deployed & Active (Notes, Semantic Search, Knowledge Graph, Conflict Engine, and Unified Context Builder)  
**Status:** Operational (Low-Noise Runbook)

---

## 1. System Status & Infrastructure Health

All foundational infrastructure for Phases 1, 2, 3, 4, and 5 is deployed, indexed, and active:

| Subsystem | Deployed Component | Status | Location / Cluster |
| :--- | :--- | :--- | :--- |
| **Firestore Security Rules** | `/memory_objects`, `/graph_nodes`, `/graph_edges`, `/memory_conflicts`, `/context_snapshots` | **LIVE** | Project `studio-9220106300-f74cb` |
| **Firestore Compound Indexes** | 6 memory indexes + 9 graph composite indexes + 4 conflict composite indexes + 2 snapshot indexes | **LIVE** | Compiled & active |
| **Qdrant Vector Engine** | Collection `smartsapp_memory` (768d Cosine) | **HEALTHY** | Qdrant Cloud (GCP `australia-southeast1-0`) |
| **Context Builder Engine** | 4-Tier Stratified Budgeting, Relevance Scorer & Grounded Citations | **ACTIVE** | Server Actions & Context Panel UI |
| **Circuit Breakers** | Deterministic embeddings, graph traversal, contradiction detection, and dossier fallbacks | **ACTIVE** | Auto-engages on network or API failures |

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

## 2.5. Human-Only Operational Responsibilities (Tasks That Cannot Be Done with AI)

To ensure legal compliance, financial safety, and institutional integrity, the following responsibilities **cannot and must not be delegated to AI agents**. They require explicit human intervention and authority:

| Category | Human-Only Responsibility | Why AI Cannot Automate | Action Required & Location |
| :--- | :--- | :--- | :--- |
| **1. Secret & Key Provisioning** | Generating Google AI API keys in [Google AI Studio](https://aistudio.google.com) and rotating production secrets. | AI cannot enter third-party commercial contracts, accept cloud terms of service, or bind credit cards. | Set `GEMINI_API_KEY` in `.env.local` and Cloud Secret Managers. |
| **2. Executive Dispute Adjudication** | Resolving contradictory institutional claims (e.g. Bursar fee agreement vs MD override). | AI can detect contradictions and propose resolutions, but cannot decide corporate policy or validate off-the-record handshake deals. | Navigate to `/admin/quick-notes/conflicts` and select `Confirm Claim A`, `Confirm Claim B`, or `Keep Both`. |
| **3. Stale Truth Reconfirmation** | Reviewing expired memories that exceeded category TTL (e.g. 90-day pricing). | AI cannot verify whether an expired quote remains active without a human confirming current business terms. | Open the "Decaying / Stale" tab in `/admin/quick-notes` and click **"Reconfirm Truth"**. |
| **4. Cloud Infrastructure & Cost Approvals** | Upgrading Qdrant Cloud cluster tiers, scaling replicas, or adjusting billing quotas. | Financial commitments and cluster provisioning require authorized human legal signatures. | Manage via [Qdrant Cloud Console](https://cloud.qdrant.io) and Google Cloud Console. |
| **5. Irreversible Compliance Purging** | Executing permanent GDPR "Right to Be Forgotten" purges or hard-deletions across storage backups. | AI operations are strictly restricted to non-destructive invalidation (`status: 'archived'`). Permanent data removal requires authorized Data Protection Officer (DPO) action. | Perform via platform administrator database consoles when legally mandated. |
| **6. Token Budget & Cost Policies** | Setting prompt ceiling limits (e.g. 2,000 vs 8,000 max tokens) and tier ratios across enterprise workspaces. | Trade-offs between LLM inference cost, latency SLAs, and context recall depth require business owner budgeting. | Configure via `/backoffice/companybrain` *(Context Simulator tab)*. |
| **7. External Commercial Dossier Sign-Off** | Approving synthesized commercial outlooks and deal risk assessments before sharing with high-stakes prospects or board members. | AI extracts facts and computes trends, but legal and fiduciary accountability for commercial representations remains with the human Account Executive or Director. | Review via Entity Profile *(AI Context & Dossier tab)* at `/admin/entities/[id]`. |
| **8. Tier 1 Disputed Fact Authoritative Overrides** | Overriding active contradiction blocks when an AI workflow flags a disputed fact in Tier 1. | When an active dispute exists, AI safety gates refuse to guess truth. A human operator must determine the authoritative claim to unblock automated actions. | Review the red conflict banner in `<ContextPanel>` or resolve in `/admin/quick-notes/conflicts`. |

### 2.5.1. Compliance Data Purges and Hard-Deletion Protocol (GDPR)

* **Automated Non-Destructive Invalidation**: By default, all AI and user actions in CompanyBrain operate non-destructively. Invalidation marks records with `status: 'archived'` or `superseded` to preserve complete audit trails and provenance.
* **Human-Authorized Hard Deletions**: Permanent data removal from Firestore (`memory_objects`, `memory_conflicts`, `graph_nodes`, `graph_edges`) and Qdrant Cloud vector clusters requires explicit written authorization from a designated Data Protection Officer (DPO). Automated agents do not have permission or credentials to execute hard purges.
* **Execution Procedure**:
  1. Submit a formal GDPR / Right to Be Forgotten request to the designated DPO.
  2. DPO reviews legal requirements, verifies tenant scoping, and signs off.
  3. Platform administrator executes targeted document deletion via Firebase Console and Qdrant Cloud REST API (`DELETE /collections/smartsapp_memory/points/delete` with filter `{ "must": [{ "key": "memoryId", "match": { "value": "<TARGET_ID>" } }] }`).
  4. Log the purge event in compliance audit logs.

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

### 3.5. Simulate & Test Unified Context Assembly
Simulates multi-store context package assembly, token budget enforcement, conflict detection, and Genkit AI dossier synthesis:
```bash
# Full Simulation Test with Mock Data
npx tsx scripts/fer-test-context-builder.ts

# Target a specific workspace and real subject
TARGET_WORKSPACE_ID=<workspace_id> SUBJECT_ID=<entity_id> npx tsx scripts/fer-test-context-builder.ts
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
| **Entity AI Context & Dossier** | `/admin/entities/[id]` *(AI Context & Dossier tab)* | Real-time commercial outlook, known risks, key stakeholders, open commitments, citations, and 1-click brief synthesis. |
| **Vector & Governance Control Plane** | `/backoffice/companybrain` | Qdrant cluster latency/health, live search playground, LRU cache purge, on-demand re-index, and batch contradiction audits. |
| **Context Simulator & Workbench** | `/backoffice/companybrain` *(Context Simulator tab)* | Live multi-tier token budgeting playground, latency telemetry, raw context JSON inspection, and live prompt simulation. |
| **Knowledge Graph Console** | `/backoffice/knowledge-graph` | Node/edge distribution metrics, cycle-safe 3-hop shortest path simulator, in-browser tenant mesh sync. |

---

## 5. Troubleshooting Matrix

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Zero results on semantic search** | Memory records exist in Firestore but have not been indexed to Qdrant. | Run `npx tsx scripts/fer-sync-memories-to-qdrant.ts` or click "Start Vector Re-index" in `/backoffice/companybrain`. |
| **Graph empty for a workspace** | Relations have not yet been projected into the graph collections. | Run `TARGET_WORKSPACE_ID=<ws_id> npx tsx scripts/fer-sync-graph-relations.ts` or click "Sync Graph Mesh" in `/backoffice/knowledge-graph`. |
| **Unresolved contradiction alerts** | Mutually opposing claims detected between two notes or meetings. | Navigate to `/admin/quick-notes/conflicts` to adjudicate which claim is authoritative. |
| **Memories showing as "Stale"** | Memory age has exceeded category TTL (e.g. 90d pricing, 180d stakeholder). | Open the "Decaying / Stale" tab in `/admin/quick-notes` and click "Reconfirm Truth" (1-click refresh). |
| **Context token budget truncation** | Retrieved facts and memories exceed specified max token ceiling. | Review the 4-tier token budget allocation in `/backoffice/companybrain`. Lower priority Tier 4 items are safely omitted first. |
| **"API Key Leaked" or AI Explanation Fallback** | `GEMINI_API_KEY` was revoked or quota exceeded. | Replace with a fresh key from Google AI Studio. Fallback engine automatically produces deterministic explanations in the interim. |
| **Qdrant Cluster degraded/offline** | Network connectivity issue or Qdrant Cloud maintenance. | The application automatically routes queries through the in-memory fallback store with zero downtime. |
| **Permission Denied on graph or conflict writes** | Direct client SDK mutation attempt. | Collections are server-side write protected (`allow write: if false;`). Mutations must flow through Server Actions. |

---

## 6. Forward Look: Phase 6 Preparation

Upcoming milestone: **MCP Platform & Governed Tool Registry**:
1. Expose CompanyBrain retrieval tools as Model Context Protocol (MCP) endpoints for external AI agents.
2. RBAC and policy-governed memory query authorization for tool execution.
3. Automated tool execution telemetry, audit logs, and rate-limiting safeguards.
