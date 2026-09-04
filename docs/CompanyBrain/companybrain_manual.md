# CompanyBrain: Operations & Maintenance Runbook
**File:** `docs/CompanyBrain/companybrain_manual.md`  
**Current Milestone:** Phases 1–7 Deployed & Active (Notes, Semantic Search, Knowledge Graph, Conflict Engine, Unified Context Builder, MCP Platform & Tool Registry, and Supervisor Agent & Dynamic Tool Orchestration)  
**Status:** Operational (Low-Noise Runbook)

---

## 1. System Status & Infrastructure Health

All foundational infrastructure for Phases 1, 2, 3, 4, 5, 6, and 7 is deployed, indexed, and active:

| Subsystem | Deployed Component | Status | Location / Cluster |
| :--- | :--- | :--- | :--- |
| **Firestore Security Rules** | `/memory_objects`, `/graph_nodes`, `/graph_edges`, `/memory_conflicts`, `/context_snapshots`, `/mcp_keys`, `/mcp_audit_logs`, `/mcp_pending_approvals`, `/mcp_approval_policies`, `/agent_runs` | **LIVE** | Project `studio-9220106300-f74cb` |
| **Firestore Compound Indexes** | 6 memory + 9 graph + 4 conflict + 2 snapshot + 4 MCP + 2 agent_runs composite indexes | **LIVE** | Compiled & active in cloud |
| **Qdrant Vector Engine** | Collection `smartsapp_memory` (768d Cosine) | **HEALTHY** | Qdrant Cloud (GCP `australia-southeast1-0`) |
| **Context Builder Engine** | 4-Tier Stratified Budgeting, Relevance Scorer & Grounded Citations | **ACTIVE** | Server Actions & Context Panel UI |
| **MCP Platform & Registry** | 12 Governed Tools (Memory, Context, CRM, Deal, Task) | **ACTIVE** | JSON-RPC 2.0 (`/api/mcp`) & SSE (`/api/mcp/sse`) |
| **Approval Engine & RBAC** | Risk Tiers (`read_only`, `low_risk`, `high_risk`), SHA-256 API Keys & Queue | **ACTIVE** | Human-in-the-Loop Control Plane |
| **Supervisor Agent & Registry** | `SupervisorEngine`, `AgentRegistry`, Plan Graph, Step Inspector & Briefing Synthesis | **ACTIVE** | Mission Control (`/admin/companybrain/supervisor`) |
| **Circuit Breakers** | Deterministic embeddings, graph traversal, contradiction detection, and in-memory sort fallbacks | **ACTIVE** | Auto-engages on network, API, or building index states |

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
| **9. High-Risk Tool Execution Adjudication** | Approving or rejecting gated tool mutations (e.g. `memory.resolve_conflict`, `deal.update_stage`, or custom high-risk actions). | Automated agents cannot self-authorize high-impact commercial or truth-altering operations. Gating requires human administrator audit. | Review and adjudicate in `/admin/companybrain/tools?tab=approvals`. |
| **10. MCP API Key Cryptographic Issuance & Rotation** | Generating, sharing, and revoking `sk_mcp_...` keys for external IDEs (Cursor, Windsurf, Claude Desktop) and autonomous agents. | Plaintext keys are generated once and never stored. Human operators must securely copy and distribute keys to trusted tools. | Generate and revoke keys via `/admin/companybrain/tools?tab=keys`. |
| **11. Workspace Tool Governance Policy Customization** | Toggling tool permissions, setting mandatory human approval requirements, or overriding tool risk classifications. | Enterprise security compliance policies, external integrations, and delegation boundaries require human organizational authority. | Configure policies in `/admin/companybrain/tools?tab=catalog`. |
| **12. Mission Autonomy & Delegation Scope Authorization** | Authorizing autonomous vs step-by-step mission execution modes and restricting high-risk tool dispatch per workspace. | Autonomous multi-step operations carry compounding risk. Human operators must choose the level of supervision before launching missions. | Select execution mode in `/admin/companybrain/supervisor`. |
| **13. Intercepted Mission Adjudication & Resumption** | Reviewing missions halted at status `needs_approval` (-32003) and authorizing paused tool parameters before resuming execution. | High-risk actions (e.g. deal pipeline transitions, contradictory memory resolutions) cannot self-execute without human sign-off. | Adjudicate via `<SupervisorApprovalBanner>` in Mission Control or `/admin/companybrain/tools?tab=approvals`. |
| **14. Runaway Mission Abort & Force-Cancellation** | Halting, canceling, and documenting reasons for misdirected or obsolete agent runs. | Fiduciary and operational control requires human ability to terminate agent reasoning when business conditions shift mid-flight. | Click "Cancel Mission" in Mission Control (`/admin/companybrain/supervisor`). |
| **15. Proposed Action Execution Sign-Off** | Validating and triggering actionable proposals produced by the supervisor (e.g. creating follow-up onboarding tasks or scheduling meetings). | AI synthesizes recommendations based on evidence, but final authorization to create CRM work items or reach out to customers remains with human managers. | Click "Execute Proposed Action" in `<SupervisorResultCard>`. |

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

### 3.6. Verify MCP Gateway & Governed Tool Registry
Verifies registry bootstrapping, JSON-RPC 2.0 dispatch, risk-gated approval interception, API key cryptographic hashing, and non-blocking audit logging:
```bash
# Full MCP Platform & Gateway Verification
npx tsx scripts/fer-test-mcp-gateway.ts

# Target specific workspace
npx tsx scripts/fer-test-mcp-gateway.ts --workspace-id=<workspace_id>
```

### 3.7. Verify Supervisor Agent & Dynamic Tool Orchestration
Verifies the autonomous agent registry, goal decomposition into bounded plan steps, step-by-step tool routing, human approval interception, state persistence, and executive briefing synthesis:
```bash
# Run automated unit tests
npx vitest run src/lib/supervisor/__tests__/supervisor-engine.test.ts

# Full Supervisor Agent Verification & End-to-End Mission Execution
npx tsx scripts/fer-test-supervisor-agent.ts

# Target specific workspace
npx tsx scripts/fer-test-supervisor-agent.ts --workspace-id=<workspace_id>
```

---

## 4. UI Surfaces & Backoffice Governance

Administrators and operators can inspect, query, and manage CompanyBrain across these surfaces:

| Surface | URL Path | Capabilities |
| :--- | :--- | :--- |
| **Supervisor Agent Mission Control** | `/admin/companybrain/supervisor` | Autonomous multi-step goal execution, interactive plan timeline graph, live step inspector drawer, approval alerts, findings, and executable action proposals. |
| **Quick Notes & Memory Extractor** | `/admin/quick-notes` | Dual-view notes/memories, human-in-the-loop candidate confirmation, semantic badges. |
| **Knowledge Conflict Center** | `/admin/quick-notes/conflicts` | Full-page contradiction review, side-by-side claim comparison, 1-click supersede adjudication, custom audit notes. |
| **Global Semantic Search** | `/admin/quick-notes/search` | Natural language vector search, cosine scores, "Why this matched" attribution, verbatim evidence drawer. |
| **MCP Platform & Tool Governance** | `/admin/companybrain/tools` | Governed tool catalog, interactive browser tool runner, pending approval adjudication queue, API keys card, and real-time audit trail. |
| **Entity Knowledge Graph** | `/admin/entities/[id]` *(Knowledge Graph tab)* | Contextual relationship topology, 1-click AI connection explanation, connected memory timeline. |
| **Entity AI Context & Dossier** | `/admin/entities/[id]` *(AI Context & Dossier tab)* | Real-time commercial outlook, known risks, key stakeholders, open commitments, citations, and 1-click brief synthesis. |
| **Vector & Governance Control Plane** | `/backoffice/companybrain` | Qdrant cluster latency/health, live search playground, LRU cache purge, on-demand re-index, batch contradiction audits, and MCP tools overview. |
| **Supervisor & Agents Console** | `/backoffice/companybrain` *(Supervisor & Agents tab)* | Platform agent registry inspector, cross-workspace live mission monitor, loop bounds (10 steps), and execution boundaries. |
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
| **Tool execution blocked (-32003)** | Tool carries `high_risk` or workspace policy requires human review. | Navigate to `/admin/companybrain/tools?tab=approvals` or click "Approve & Resume" on the Mission Control banner. |
| **Mission paused at `needs_approval`** | Supervisor plan stepped into a gated tool requiring operator authorization. | Open `/admin/companybrain/supervisor?runId=<id>`, review the intercepted step in `<SupervisorApprovalBanner>`, and click **"Approve & Resume Mission"**. |
| **Mission cancelled mid-flight** | Human operator aborted the mission due to changed requirements. | Review cancellation reason in the mission history table. Re-launch with revised goal if necessary. |
| **Loop ceiling reached (10 steps)** | Goal was overly broad or tool calls failed to converge on the objective. | Hard safety ceiling prevented infinite loop. Review intermediate step outputs in Step Inspector Drawer and refine the mission goal. |
| **MCP Unauthorized (-32001)** | Missing, invalid, or revoked `sk_mcp_...` key in `Authorization: Bearer` header. | Verify key status or generate a new API key in `/admin/companybrain/tools?tab=keys`. |
| **Max Depth Exceeded (-32006)** | Recursive tool calling chain exceeded depth limit of 5. | Inspect agent plan loop and reduce recursive dependencies. |
| **Context token budget truncation** | Retrieved facts and memories exceed specified max token ceiling. | Review the 4-tier token budget allocation in `/backoffice/companybrain`. Lower priority Tier 4 items are safely omitted first. |
| **"API Key Leaked" or AI Explanation Fallback** | `GEMINI_API_KEY` was revoked or quota exceeded. | Replace with a fresh key from Google AI Studio. Fallback engine automatically produces deterministic explanations in the interim. |
| **Qdrant Cluster degraded/offline** | Network connectivity issue or Qdrant Cloud maintenance. | The application automatically routes queries through the in-memory fallback store with zero downtime. |
| **Permission Denied on MCP or graph writes** | Direct client SDK mutation attempt. | Collections are server-side write protected (`allow write: if false;`). Mutations must flow through Server Actions. |

---

## 6. Forward Look: Phase 8 Preparation

Upcoming milestone: **Phase 8: Domain Specialists & Agent Swarm Collaboration**:
1. Domain-specialized subagents: Research Specialist, CRM Specialist, Pipeline Specialist, and Governance Auditor.
2. Inter-agent communication protocols and hierarchical delegation from the Supervisor Agent.
3. Collective intelligence workflows and multi-agent debate/consensus mechanisms.
