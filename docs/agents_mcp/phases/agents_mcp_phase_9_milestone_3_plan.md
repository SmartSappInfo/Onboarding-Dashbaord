# SmartSapp Agentic & MCP Transformation: Phase 9 Milestone 3 Implementation Plan
## CRM AI Overview, Knowledge Panel & In-Context Intelligence Surfaces (Entity & Deal Views)
### Deeply Integrated with `docs/agents_mcp/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the agent-native CRM redesign specified in `docs/agents_mcp/agents_mcp_ui.md` (§ 30–35 & Phase 9 CRM redesign: Contact AI Overview, Knowledge, Recommendations, Deal Intelligence, Meeting Brief), embedded directly into existing entity and deal pages without breaking existing functionality (Rule 69 Strangler Fig).

**Architecture:** Build canonical CRM intelligence domain contracts and a pure synthesis service in `src/platform/agents/crm/intelligence/` that consumes `Account360Context` from Milestone 1 and evaluates deterministic heuristics + AI grounding. Expose 5 strictly typed Server Actions in `src/app/actions/crm-agent-actions.ts` with Clerk session auth, Anti-IDOR validation, dead-man switch evaluation, and domain event publishing. Create modular, accessible, mobile-first UI components adhering to `theme.md` §8 and embed them smoothly into `/admin/entities/[id]` and `/admin/deals/[id]`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (zero `any`/`any[]`), Zod v4, Lucide React, Tailwind CSS, Firestore Admin SDK, Vitest.

---

## 1. Executive Summary & UI Redesign Vision

In Phase 9 Milestone 1, we built the foundational Multi-Domain Context Assembler and Chronological Account Timeline (`Account360Context`). In Milestone 2, we engineered the specialized CRM Agent workforce (`crm_assistant`, `crm_researcher`, `lead_analyst`, `deal_strategist`, `task_coordinator`, `knowledge_analyst`), complete with permission/tool/failure/rollback matrices, 24 gold-standard evaluation scenarios, and shadow mode simulation.

Milestone 3 elevates the customer relationship workspace from a passive record-storage system to an **agent-native CRM context hub**:
1. **Contact AI Overview (`AccountAiOverviewCard.tsx`):** Displays overall relationship health (0–100 score + status badge), executive narrative summary, active momentum (`ACCELERATING`, `STEADY`, `SLOWING`, `STALLED`), key risk tags, stakeholder engagement breakdown, and recent chronological signal chips.
2. **Account Knowledge Panel (`AccountKnowledgePanel.tsx`):** Displays grounded facts, meeting takeaways, and source citations with a slide-over Citation Drawer that encapsulates raw notes and transcripts inside `<untrusted_reference_data id="...">` containers (Rule 13 & 30).
3. **Account Recommendations Card (`AccountRecommendationsCard.tsx`):** Prioritized Next-Best-Action chips with Rule 41 explainability grids (WHAT, WHY, IMPACT) and one-click execution triggers.
4. **Deal Intelligence Card (`DealIntelligenceCard.tsx`):** Displays deal stage velocity (days in stage vs threshold), win probability forecast, competitor objection breakdowns, and tactical playbooks.
5. **Meeting Brief Drawer (`MeetingBriefDrawer.tsx`):** Pre-meeting briefing dossier detailing attendee dossiers, open commitments, likely objectives, objections, suggested questions, and recommended strategy.
6. **Zero-Regression Surface Embedding:** Integrates into `/admin/entities/[id]` and `/admin/deals/[id]` while preserving 100% of preexisting tabs, widgets, notes, and actions (Rule 69 Strangler Fig).

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CRM IN-CONTEXT INTELLIGENCE ARCHITECTURE                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                 OPERATOR SURFACES                                      │
│  Entity View: /admin/entities/[id]              Deal View: /admin/deals/[id]           │
│  ├── AccountAiOverviewCard                      └── DealIntelligenceCard               │
│  ├── AccountKnowledgePanel                          ├── Stage Velocity Meter           │
│  │   └── Citation Drawer (theme.md §8)              ├── Win Probability Forecast       │
│  └── AccountRecommendationsCard                     └── Competitor Playbook            │
│      └── Explainability Grid (Rule 41)                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         SECURE NEXT.JS 15 SERVER ACTIONS                               │
│                         (src/app/actions/crm-agent-actions.ts)                         │
│  ├── requireAuth() [Clerk Session Authentication]                                      │
│  ├── assertTenantContext() [Anti-IDOR Multi-Tenant Lock] (Rule 8 & 47)                 │
│  ├── checkGovernanceDeadManSwitch() [Emergency Pause Evaluation] (Rule 60)             │
│  └── defaultEventBus.publish() [Tamper-Evident Domain Events] (Rule 40)                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         CORE CRM INTELLIGENCE SYNTHESIS ENGINE                         │
│             (src/platform/agents/crm/intelligence/crm-intelligence-service.ts)          │
│  ├── Health Score Algorithm (Recency 30%, Sentiment 25%, Activity 20%, Receivables 25%) │
│  ├── Stage Velocity Meter (Days in stage vs 14d baseline threshold)                   │
│  ├── Grounded Citation Extraction (<untrusted_reference_data id="...">) (Rule 13/30)   │
│  └── Next-Best-Action Formulation (Prioritized, Actionable, Explainable) (Rule 41)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         FOUNDATIONAL CONTEXT & PERSISTENCE                             │
│  ├── Account360Context [Multi-Domain Context Assembler - Milestone 1]                  │
│  ├── Master Identity: /entities/{entityId} [Read-Only Corporate Master] (Rule 69)      │
│  └── Operational State: /workspace_entities/{workspaceId}_{entityId} (Rule 69)         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Architecture: Dual-Tier CRM Data Model Preservation (Rule 69)

In accordance with `docs/agents_mcp/agents_mcp_rules.md` (Rule 69) and `docs/agents_mcp/agents_mcp_tools.md`:
1. **Global Master Identity (`entities`):** `/entities/{entityId}` stores immutable, organization-wide corporate identity (legal name, registration, headquarters address, base website, verified industry). Intelligence surfaces read global identity, but **never** mutate it directly.
2. **Workspace Operational Record (`workspace_entities`):** `/workspace_entities/{workspaceId}_{entityId}` stores workspace-scoped CRM execution state (pipeline, stage, assigned owner, workspace tags, lead score, local activity log).
3. **Execution Invariant:** Any recommendation or action triggered from the intelligence surfaces (e.g., adding a tag, transitioning a stage, assigning an owner) targets `/workspace_entities/${workspaceId}_${entityId}`.
4. **Strangler Fig Invariant:** Pre-existing tabs (`overview`, `deals`, `meetings`, `tasks`, `billing`, `surveys`, `automations`, `graph`, `ai-context`) on the entity page and controls on the deal page continue functioning without behavioral modification.

---

## 3. Master 69-Rules Alignment & Enforcement Matrix for Milestone 3

| Rule # | Requirement | Milestone 3 Architectural Implementation & Verification |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to Next.js 15 App Router, React 19, Tailwind CSS, TypeScript strict mode, and modular decomposition. All legacy features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Graceful fallback when AI synthesis fails, network drops, or records are missing. UI displays helpful empty states with No Dead Ends. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Embeds directly into `/admin/entities/[id]` and `/admin/deals/[id]` without breaking any existing tab, widget, or action. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | 100% strictly typed props, state, actions, and schema returns. `unknown` permitted only at raw boundaries, validated immediately with Zod v4. |
| **Rule 5** | Staged Deployment & Security Verification | All contracts, synthesis algorithms, server actions, and UI components verified with isolated tests before production integration. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `zod/v4`, `lucide-react`, and `date-fns`. Next.js 15 App Router patterns verified via Context7. |
| **Rule 7** | Mobile-First & Plain UI English | All touch targets $\ge 44\text{px}$ (`min-h-[44px]`), Emil Kowalski tactile clicks (`active:scale-[0.97]`), and plain human language for health status, win probabilities, and recommendations. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every server action enforces caller session `organizationId` matching requested `workspaceId`/`entityId` boundaries. IDOR attempts fail closed with HTTP 403. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Context retrieval queries bounded to 50 items; payload sizes $< 2\text{KB}$; execution timeouts capped at 5,000ms. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` documentation detailing architecture, security invariants, Rule mappings, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Intelligence insights bind to canonical MCP tool outputs; Spec 2026-07-28 Streamable HTTP compatible. |
| **Rule 12** | Risk Ceilings & Weighted Rank | Overview and Knowledge panels operate at `L0_READ`; Next-Best-Action triggers classified by risk, with `L3`/`L4` routing through approval proposals. |
| **Rule 13** | Formal Trust Boundary Matrix | Customer notes, meeting transcripts, emails, and citations wrapped in `<untrusted_reference_data id="...">` containers. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Action triggers verify cryptographic composite SHA-256 fingerprints before executing bound capabilities. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | External links and citation URLs validated against allowlists with SSRF prevention. |
| **Rule 16** | Agent Identity as Security Principal | Intelligence synthesis executes under authenticated caller identity with explicit RBAC scopes; no wildcard (`*`) permissions. |
| **Rule 17** | Non-Delegable Actions | Entity deletion, workspace destruction, and billing modifications stripped from autonomous execution affordances. |
| **Rule 18** | TOCTOU Live Principal / Record Check | Record versions verified before applying recommendation stage updates or owner assignments. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Mutating recommendation triggers generate deterministic idempotency keys (`crm_action_${entityId}_${hash}`). |
| **Rule 20** | Replay & Distributed Tracing | Injects `correlationId` and `toolInvocationId` into domain event metadata and Server Action responses. |
| **Rule 21** | Two-Phase Action Model | State-changing recommendations create action proposals requiring operator review before execution. |
| **Rule 22** | Cryptographic Approval Binding | Mutating proposals bound to canonical key-sorted SHA-256 `payloadHash`. |
| **Rule 23** | Resource Governance & Budgets | Context assembler enforces 4,000-token ceiling; synthesis duration bounded to 5,000ms. |
| **Rule 24** | 5-State Circuit Breakers | Tiered Model Router fallback protected by 5-state circuit breakers (`healthy`, `degraded`, `open`, `half_open`, `recovered`). |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed synthesis operations report structured diagnostics and log to EventBus audit log. |
| **Rule 26** | True Cooperative Cancellation | Actions and fetch requests support native `AbortSignal` cooperative cancellation. |
| **Rule 27** | Formal Saga / Compensation Model | Mutating recommendations bind compensating capabilities for 1-click rollback via `CRM_ROLLBACK_MATRIX`. |
| **Rule 28** | Context Budgeting | Greedy knapsack packing bounds account context strictly $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Temporal decay weighting prioritizes fresh meetings, recent notes, and open deals. |
| **Rule 30** | Knowledge Poisoning Defense | Prompts and UI renderers distrust instructions inside `<untrusted_reference_data>` XML containers. |
| **Rule 31** | Output Validation Between Agent & Tool | Zod schema validation on all synthesis outputs via `safeParse`. |
| **Rule 32** | Cross-Domain Exfiltration Detection | Synthesis queries restricted strictly to CRM domain scopes (`crm_contacts`, `deals_revenue`, `knowledge_memory`). |
| **Rule 33** | Egress Control & Redaction | Redacts sensitive credentials, API keys, and PII from UI summaries (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | Outbound company URLs and citations validated via `validateSafeEgressUrl` blocking loopback and private subnets. |
| **Rule 35** | MCP Discovery Caching | Deterministic ETag HTTP 304 caching for intelligence schemas. |
| **Rule 36** | Capability Version Compatibility | Declares exact SemVer contracts for intelligence outputs. |
| **Rule 37** | MCP Spec Compatibility Testing | Conforms to Spec 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Uses Streamable HTTP; no stateful session leaks. |
| **Rule 39** | OpenTelemetry From Day One | Propagates W3C `traceparent` headers across server actions and domain events. |
| **Rule 40** | Audit Log Immutability | Publishes `crm.intelligence.overview_viewed`, `crm.intelligence.deal_analyzed`, `crm.intelligence.meeting_briefed` to EventBus. |
| **Rule 41** | "Why Did You Do This?" Audit View | Every recommendation card features WHAT, WHY, and IMPACT explainability dimensions. |
| **Rule 42** | Mandatory Shadow Mode | All recommendation triggers can be previewed/simulated with `dryRun: true` and Blast Radius Reports. |
| **Rule 43** | Replayable Agent Runs | Insight generation inputs and outputs capture full snapshots allowing deterministic replay. |
| **Rule 44** | Deterministic Evaluation Dataset | Validated against the 24 gold-standard evaluation scenarios from Milestone 2. |
| **Rule 45** | Chaos Testing | Handles missing notes, empty deals, zero meetings, or corrupt timestamps gracefully with fallback UI. |
| **Rule 46** | Adversarial Security Testing | Guarded against prompt injection in notes, cross-tenant IDOR probing, and parameter tampering. |
| **Rule 47** | Never Trust the Model | All model outputs parsed via Zod; invalid formats fallback to heuristic summaries. |
| **Rule 48** | Sanitized Error Reporting | All client-facing errors sanitized; internal database paths, keys, and stack traces stripped. |
| **Rule 49** | Production Telemetry & Latency Monitoring | UI tracks time-to-first-render and server action latency $\le 500\text{ms}$. |
| **Rule 50** | Cache Isolation Rules | Intelligence caches partitioned strictly by `organizationId` and `workspaceId`. |
| **Rule 51** | App Router & Server Actions Security | `'use server'`, Clerk session authentication via `requireAuth()`, and Anti-IDOR validation via `assertTenantContext`. |
| **Rule 52** | Event Streaming via SSE | Live updates consume Server-Sent Events via `useEventStream` without polling. |
| **Rule 53** | Idempotent Event Handling | Event consumers deduplicate by `correlationId`. |
| **Rule 54** | Performance Budgets | AI Overview render $\le 300\text{ms}$, Server Action response $\le 800\text{ms}$. |
| **Rule 55** | Resilient Data Models | Subcollection partitioning avoids Firestore 1MB document limit. |
| **Rule 56** | Bounded Prompt Assembly | Context assembly strictly bounded $\le 4,000$ tokens. |
| **Rule 57** | Fallback Degradations | If AI model times out or is degraded, deterministic heuristics compute health score and summary. |
| **Rule 58** | Model Routing Policy | Fast signal extraction routes to Flash; strategic deal playbooks and deep account synthesis route to Pro. |
| **Rule 59** | Tool Selection Evaluation | Capabilities restricted strictly to CRM domain scopes defined in `CRM_TOOL_MATRIX`. |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` halts actions with `CRM_DEAD_MAN_PAUSED` and disables action triggers. |
| **Rule 61** | Surface Isolation | Client vs backoffice surfaces verified. |
| **Rule 62** | Real-Time SSE Reactivity | Activity and intelligence stream updates react to backend events without polling. |
| **Rule 63** | Operator Intervention Ergonomics | Clear error banners with retry and configuration links; No Dead Ends. |
| **Rule 64** | Non-Blocking Asynchronous Processing | Deep analysis runs asynchronously with skeleton loading states. |
| **Rule 65** | Schema Migration & Backward Compatibility | Additive schemas; legacy fields preserved. |
| **Rule 66** | Cloud Run Stateless Serverless Readiness | Zero sticky sessions; compatible with Cloud Run auto-scaling. |
| **Rule 67** | The Agent Implementation Gate | Mandatory 9-point pre-flight checklist verified across all dimensions. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not user. 2. Never trust model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in UX. |
| **Rule 69** | Strangler Fig Pattern SSOT & Dual-Tier CRM Data Model Preservation | Preserves existing tabs, notes, and actions on `/admin/entities/[id]` and `/admin/deals/[id]`. Global identity in `/entities` remains immutable; operational CRM state updates `/workspace_entities`. |

---

## 4. Rule 67: The Agent Implementation Gate Verification

Before Phase 9 Milestone 3 can be marked complete, the following architectural gate answers must be verified:

### 4.1 Architecture
- **What canonical capability does this use?** Consumes `Account360Context` (assembled from CRM, Revenue, Knowledge, Tasks, Meetings) and integrates with canonical capabilities (`crm_contacts`, `deals_revenue`, `knowledge_memory`).
- **Is this duplicating an existing service?** No. It wraps `AccountContextAssembler` and unifies disparate insights into standardized UI intelligence surfaces.
- **What is the source of truth?** Dual-tier model: `/entities/{entityId}` for global master identity and `/workspace_entities/{workspaceId}_{entityId}` for operational state.
- **What events are emitted?** `crm.intelligence.overview_viewed`, `crm.intelligence.deal_analyzed`, `crm.intelligence.meeting_briefed`.

### 4.2 Authority
- **Who is allowed to use it?** Authenticated workspace users with permissions (`operations.campuses.view`, `operations.pipeline.view`).
- **What may the agent do?** Read account context, synthesize health scores, generate grounded summaries, and display recommendations (`L0_READ`).
- **What may the agent never do?** Mutate global master entities (`/entities`), execute unconfirmed stage changes, or delete customer records.
- **Can a sub-agent inherit this authority?** Only through monotonic downward scope attenuation ($P_{\text{child}} = P_{\text{parent}} \cap P_{\text{target}} \cap P_{\text{requested}}$, Rule 16) with non-delegable actions stripped (Rule 17).

### 4.3 Data
- **What data enters the agent?** 360° Account Context packages (timeline, meetings, notes, deals, tasks, finances).
- **What data leaves the system?** Executive summaries, health metrics, grounded citations, next-best-actions, and deal playbooks.
- **What is trusted?** Verified entity identities, internal workspace settings, system policy configurations.
- **What is untrusted?** Raw notes, external email bodies, meeting transcripts, third-party web content (wrapped in `<untrusted_reference_data id="...">`).
- **What is sensitive?** Passwords, API keys, credentials, financial details (masked via `[REDACTED_SECRET:<type>]`).

### 4.4 Execution
- **Is it idempotent?** Yes. All read-only synthesis operations are pure functions. Action triggers compute deterministic idempotency keys (`crm_action_${entityId}_${hash}`).
- **Can it be retried?** Yes, safe read-only operations can be retried with exponential backoff.
- **Can it be cancelled?** Yes, via native `AbortSignal` cooperative cancellation.
- **Can it be duplicated?** No, deduplicated via `correlationId` and idempotency keys.
- **What if the underlying record changes?** Optimistic concurrency version checks detect TOCTOU conflicts (`VERSION_MISMATCH`) and trigger re-fetch.
- **What if the response is lost?** Read operations are re-runnable; simulations are re-executable with zero side-effects.

### 4.5 MCP & Governance
- **What protocol version?** Spec 2026-07-28 (Streamable HTTP).
- **What is the blast radius?** Read-only synthesis: strictly zero database mutations. Mutating recommendation triggers: bounded to `/workspace_entities/${workspaceId}_${entityId}`.
- **What is the risk level?** `L0_READ` (Overview, Knowledge, Deal Intelligence, Meeting Brief), `L1_INTERNAL_DRAFT` / `L2_STATE_MUTATION` (Action Recommendations).
- **Is approval required?** Any `L3`/`L4` or external communication action triggered from recommendations requires Two-Phase Human Approval.
- **Can it be rolled back?** Yes, via reverse-LIFO Saga compensations mapped in `CRM_ROLLBACK_MATRIX`.
- **What does the operator see?** Transparent health scores, grounded facts with citations, explainability grids (WHAT, WHY, IMPACT), and stage velocity metrics.

---

## 5. Architectural Specifications & Data Contracts

### 5.1 Canonical Intelligence Contracts (`src/platform/agents/crm/intelligence/crm-intelligence-types.ts`)

```typescript
import { z } from 'zod/v4';

// 1. Account AI Overview Schema
export const AccountAiOverviewSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  healthStatus: z.enum(['HEALTHY', 'ATTENTION_NEEDED', 'AT_RISK', 'DORMANT']),
  healthScore: z.number().int().min(0).max(100),
  executiveSummary: z.string().min(1),
  activeMomentum: z.enum(['ACCELERATING', 'STEADY', 'SLOWING', 'STALLED']),
  keyRisks: z.array(z.object({
    id: z.string().min(1),
    tag: z.string().min(1),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    description: z.string().min(1),
  })).default([]),
  stakeholders: z.array(z.object({
    contactId: z.string().min(1),
    name: z.string().min(1),
    role: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    engagementLevel: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNRESPONSIVE']),
    isPrimary: z.boolean().default(false),
  })).default([]),
  recentSignals: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['DEAL', 'MEETING', 'NOTE', 'BILLING', 'TASK', 'COMMUNICATION']),
    title: z.string().min(1),
    timestamp: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  })).default([]),
  generatedAt: z.string(),
});

// 2. Account Knowledge Schema
export const AccountKnowledgeSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  groundedFacts: z.array(z.object({
    id: z.string().min(1),
    statement: z.string().min(1),
    category: z.string().min(1),
    confidence: z.number().min(0).max(1),
    citationId: z.string().min(1),
    sourceTitle: z.string().min(1),
    sourceType: z.string().min(1),
  })).default([]),
  meetingTakeaways: z.array(z.object({
    meetingId: z.string().min(1),
    meetingTitle: z.string().min(1),
    date: z.string(),
    takeaways: z.array(z.string()).default([]),
    decisions: z.array(z.string()).default([]),
  })).default([]),
  citations: z.array(z.object({
    id: z.string().min(1),
    sourceType: z.enum(['note', 'meeting', 'deal', 'invoice', 'memory']),
    sourceId: z.string().min(1),
    title: z.string().min(1),
    snippet: z.string().min(1),
    timestamp: z.string(),
    isolatedSnippet: z.string(), // Wrapped in <untrusted_reference_data id="...">
  })).default([]),
  generatedAt: z.string(),
});

// 3. Account Recommendations Schema (Rule 41 Explainability Grid)
export const AccountRecommendationItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.string().min(1),
  actionType: z.enum(['DRAFT_EMAIL', 'CREATE_TASK', 'SCHEDULE_MEETING', 'UPDATE_STAGE', 'ADD_NOTE', 'LAUNCH_RESEARCH']),
  explainability: z.object({
    what: z.string().min(1),
    why: z.string().min(1),
    impact: z.string().min(1),
  }),
  payloadDelta: z.record(z.string(), z.unknown()).optional(),
  targetCapabilityId: z.string().optional(),
});

export const AccountRecommendationsSchema = z.object({
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  items: z.array(AccountRecommendationItemSchema).default([]),
  generatedAt: z.string(),
});

// 4. Deal Intelligence Schema
export const DealIntelligenceSchema = z.object({
  dealId: z.string().min(1),
  dealTitle: z.string().min(1),
  dealValue: z.number().nonnegative(),
  currency: z.string().default('USD'),
  stageVelocity: z.object({
    daysInStage: z.number().int().nonnegative(),
    averageDaysInStage: z.number().int().nonnegative(),
    velocityStatus: z.enum(['FAST', 'NORMAL', 'SLOW', 'STALLED']),
  }),
  winProbability: z.number().int().min(0).max(100),
  healthScore: z.number().int().min(0).max(100),
  healthCategory: z.enum(['STRONG', 'MODERATE', 'VULNERABLE', 'CRITICAL']),
  stallRisk: z.object({
    isStalled: z.boolean(),
    reason: z.string().optional(),
    daysSinceActivity: z.number().int().nonnegative(),
  }),
  buyingSignals: z.array(z.object({
    signal: z.string().min(1),
    detectedAt: z.string(),
    confidence: z.number().min(0).max(1),
  })).default([]),
  riskFactors: z.array(z.object({
    risk: z.string().min(1),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    mitigationPrompt: z.string().min(1),
  })).default([]),
  competitorAnalysis: z.array(z.object({
    competitorName: z.string().min(1),
    objection: z.string().min(1),
    counterStrategy: z.string().min(1),
  })).default([]),
  recommendedPlaybook: z.object({
    strategyName: z.string().min(1),
    tacticalSteps: z.array(z.string()).default([]),
    expectedOutcome: z.string().min(1),
  }),
  generatedAt: z.string(),
});

// 5. Meeting Brief Schema
export const MeetingBriefSchema = z.object({
  meetingId: z.string().min(1),
  title: z.string().min(1),
  startTime: z.string(),
  attendees: z.array(z.object({
    name: z.string().min(1),
    email: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    pastInteractionsCount: z.number().int().nonnegative().default(0),
    lastSentiment: z.string().optional(),
  })).default([]),
  relationshipSummary: z.string().min(1),
  openCommitments: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    dueDate: z.string().nullable().optional(),
    isOverdue: z.boolean().default(false),
  })).default([]),
  likelyObjectives: z.array(z.string()).default([]),
  potentialObjections: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  recommendedStrategy: z.string().min(1),
  generatedAt: z.string(),
});

// Error taxonomy (Rule 48)
export const CRM_INTELLIGENCE_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
  CRM_DEAD_MAN_PAUSED: 'CRM_DEAD_MAN_PAUSED',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  DEAL_NOT_FOUND: 'DEAL_NOT_FOUND',
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  SYNTHESIS_FAILED: 'SYNTHESIS_FAILED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;
```

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Canonical CRM Intelligence Contracts & Error Taxonomy
**Files:**
- Create: `src/platform/agents/crm/intelligence/crm-intelligence-types.ts`
- Create: `src/platform/agents/crm/intelligence/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts`

- [x] **Step 1: Write the failing contract tests**
Author `src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts` validating:
  - `AccountAiOverviewSchema` parses valid payload and rejects out-of-range health scores ($< 0$ or $> 100$).
  - `AccountKnowledgeSchema` validates grounded facts, meeting takeaways, and citations.
  - `AccountRecommendationsSchema` validates priority, action types, and Rule 41 explainability grids (`what`, `why`, `impact`).
  - `DealIntelligenceSchema` validates stage velocity, win probability, and competitor playbooks.
  - `MeetingBriefSchema` validates attendee briefings, open commitments, and suggested questions.
  - `CRM_INTELLIGENCE_ERROR_CODES` contains all canonical error keys.

- [x] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts`
Expected: FAIL ("Cannot find module '@/platform/agents/crm/intelligence/crm-intelligence-types'").

- [x] **Step 3: Implement `crm-intelligence-types.ts` and `index.ts`**
Author `crm-intelligence-types.ts` with strict Zod v4 schemas, type exports, error taxonomy, and `CrmIntelligenceError` class. Re-export via barrel `index.ts`. Ensure zero `any` or `any[]` (Rule 4).

- [x] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add src/platform/agents/crm/intelligence/ src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts
git commit -m "feat(crm-agent): add canonical CRM intelligence contracts and error taxonomy"
```

---

### Task 2: Core Domain Synthesis Engine (`crm-intelligence-service.ts`)
**Files:**
- Create: `src/platform/agents/crm/intelligence/crm-intelligence-service.ts`
- Modify: `src/platform/agents/crm/intelligence/index.ts`
- Modify: `src/platform/agents/crm/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts`

- [x] **Step 1: Write the failing service tests**
Author `src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts` testing:
  - `synthesizeAccountAiOverview`: computes correct health score using weighted formula (recency, sentiment, overdue tasks, receivables aging) and status band.
  - `synthesizeAccountKnowledge`: compiles grounded facts and wraps raw notes/transcripts inside `<untrusted_reference_data id="...">` containers (Rule 13 & 30).
  - `synthesizeAccountRecommendations`: detects overdue commitments, stalled deals, or aging invoices and generates prioritized Next-Best-Actions with Rule 41 explainability grids.
  - `synthesizeDealIntelligence`: evaluates stage velocity against 14-day threshold and forecasts win probability.
  - `synthesizeMeetingBrief`: compiles attendee history and unresolved commitments.
  - Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`) throwing `CRM_DEAD_MAN_PAUSED` when tripped (Rule 60).

- [x] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts`
Expected: FAIL ("Cannot find module '@/platform/agents/crm/intelligence/crm-intelligence-service'").

- [x] **Step 3: Implement `crm-intelligence-service.ts`**
Author pure synthesis methods:
  - Mathematical health score calculation:
    $$\text{HealthScore} = \text{clamp}(0, 100, S_{\text{recency}} \times 0.30 + S_{\text{sentiment}} \times 0.25 + S_{\text{tasks}} \times 0.20 + S_{\text{finances}} \times 0.25)$$
  - XML containerization using `<untrusted_reference_data id="citation_${id}">`.
  - Next-Best-Action generation prioritizing immediate operational and commercial risks.
  - Stage velocity and deal risk synthesis.
  - Export service class `CrmIntelligenceService` and singleton `getCrmIntelligenceService()`.

- [x] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add src/platform/agents/crm/intelligence/ src/platform/agents/crm/index.ts src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts
git commit -m "feat(crm-agent): implement CRM intelligence synthesis service"
```

---

### Task 3: Secure Operator Server Actions (`crm-agent-actions.ts`)
**Files:**
- Create: `src/app/actions/crm-agent-actions.ts`
- Test: `src/platform/__tests__/agents/crm/crm-agent-actions.test.ts`

- [x] **Step 1: Write the failing server action tests**
Author `src/platform/__tests__/agents/crm/crm-agent-actions.test.ts` testing:
  - Next.js Server Actions convention (`'use server'`).
  - Clerk session authentication via `requireAuth()` (rejects unauthenticated callers with `AUTHENTICATION_REQUIRED`).
  - Anti-IDOR validation: verifies caller's session `organizationId` matches requested tenant boundary, returning `IDOR_VIOLATION` on mismatch (Rule 8 & 47).
  - Emergency dead-man pause check: returns `CRM_DEAD_MAN_PAUSED` when dead-man switch is active (Rule 60).
  - Integrates with `getAccount360Context` and `getCrmIntelligenceService()`.
  - Publishes domain events via `defaultEventBus.publish` (`crm.intelligence.overview_viewed`, `crm.intelligence.deal_analyzed`, `crm.intelligence.meeting_briefed`) (Rule 40).

- [x] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-agent-actions.test.ts`
Expected: FAIL ("Cannot find module '@/app/actions/crm-agent-actions'").

- [x] **Step 3: Implement `crm-agent-actions.ts`**
Author 5 typed server actions:
  - `getAccountAiOverviewAction({ workspaceId, entityId })`
  - `getAccountKnowledgeAction({ workspaceId, entityId })`
  - `getAccountRecommendationsAction({ workspaceId, entityId })`
  - `getDealIntelligenceAction({ workspaceId, entityId, dealId })`
  - `getMeetingBriefAction({ workspaceId, entityId, meetingId })`

- [x] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-agent-actions.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add src/app/actions/crm-agent-actions.ts src/platform/__tests__/agents/crm/crm-agent-actions.test.ts
git commit -m "feat(crm-agent): implement secure CRM intelligence server actions"
```

---

### Task 4: Contact AI Overview & Account Knowledge Components
**Files:**
- Create: `src/components/crm/intelligence/AccountAiOverviewCard.tsx`
- Create: `src/components/crm/intelligence/AccountKnowledgePanel.tsx`
- Create: `src/components/crm/intelligence/index.ts`
- Test: `src/platform/__tests__/ui/crm-ai-overview.test.tsx`

- [x] **Step 1: Write the failing UI tests**
Author `src/platform/__tests__/ui/crm-ai-overview.test.tsx` verifying:
  - `AccountAiOverviewCard`: renders health status badge (`HEALTHY`, `ATTENTION_NEEDED`, `AT_RISK`, `DORMANT`), circular/score meter, executive narrative summary, stakeholder pills, recent signal carousel, and single-circle info tooltip at `z-[10050]`.
  - `AccountKnowledgePanel`: renders grounded facts with source chips, category filtering, and Citation Drawer adhering to `theme.md` §8 with `<UntrustedReferenceData>`.
  - Touch targets $\ge 44\text{px}$ (`min-h-[44px]`) and tactile buttons (`active:scale-[0.97]`).

- [x] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-ai-overview.test.tsx`
Expected: FAIL ("Cannot find module '@/components/crm/intelligence/AccountAiOverviewCard'").

- [x] **Step 3: Implement `AccountAiOverviewCard.tsx` and `AccountKnowledgePanel.tsx`**
- Strict adherence to `theme.md` §8:
  - Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
  - Demarcated header: `<DialogHeader demarcated>`.
  - Single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`.
  - Screen reader `<DialogDescription className="sr-only">`.
  - Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`).
- Untrusted text wrapped inside `<UntrustedReferenceData>`.

- [x] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-ai-overview.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add src/components/crm/intelligence/ src/platform/__tests__/ui/crm-ai-overview.test.tsx
git commit -m "feat(crm-ui): add Account AI Overview card and Knowledge panel components"
```

---

### Task 5: Account Recommendations & Deal Intelligence Cards
**Files:**
- Create: `src/components/crm/intelligence/AccountRecommendationsCard.tsx`
- Create: `src/components/crm/intelligence/DealIntelligenceCard.tsx`
- Create: `src/components/crm/intelligence/MeetingBriefDrawer.tsx`
- Modify: `src/components/crm/intelligence/index.ts`
- Test: `src/platform/__tests__/ui/deal-intelligence.test.tsx`

- [x] **Step 1: Write the failing UI tests**
Author `src/platform/__tests__/ui/deal-intelligence.test.tsx` testing:
  - `AccountRecommendationsCard`: renders priority-badged recommendations (`URGENT`, `HIGH`, `MEDIUM`), Rule 41 explainability grid (WHAT, WHY, IMPACT), and tactile execution trigger buttons.
  - `DealIntelligenceCard`: renders stage velocity meter, win probability gauge, competitor objections breakdown, and recommended tactical playbooks.
  - `MeetingBriefDrawer`: renders pre-meeting briefing drawer conforming to `theme.md` §8 (attendee dossiers, open commitments checklist, suggested questions, recommended strategy).

- [x] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/ui/deal-intelligence.test.tsx`
Expected: FAIL ("Cannot find module '@/components/crm/intelligence/AccountRecommendationsCard'").

- [x] **Step 3: Implement `AccountRecommendationsCard.tsx`, `DealIntelligenceCard.tsx`, and `MeetingBriefDrawer.tsx`**
- Strictly typed props.
- Emil Kowalski mechanical feedback (`active:scale-[0.97]`).
- Modal/Drawer adherence to `theme.md` §8.

- [x] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/ui/deal-intelligence.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add src/components/crm/intelligence/ src/platform/__tests__/ui/deal-intelligence.test.tsx
git commit -m "feat(crm-ui): add Account Recommendations, Deal Intelligence, and Meeting Brief components"
```

---

### Task 6: Surface Embeddings into Entity & Deal Pages (Rule 69 Strangler Invariant)
**Files:**
- Create: `src/app/admin/entities/components/EntityAiOverviewSection.tsx`
- Modify: `src/app/admin/entities/[id]/page.tsx`
- Modify: `src/app/admin/deals/[id]/components/DealAiIntelligencePanel.tsx`
- Modify: `src/app/admin/deals/[id]/page.tsx`
- Test: `src/platform/__tests__/ui/crm-page-integration.test.tsx`

- [x] **Step 1: Write the failing page integration tests**
Author `src/platform/__tests__/ui/crm-page-integration.test.tsx` validating:
  - `EntityAiOverviewSection` loads overview, knowledge, and recommendations.
  - Existing entity tabs (`overview`, `deals`, `meetings`, `tasks`, etc.) remain 100% functional.
  - Deal intelligence card renders seamlessly inside deal workspace without displacing legacy components.

- [x] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-page-integration.test.tsx`
Expected: FAIL ("Cannot find module '@/app/admin/entities/components/EntityAiOverviewSection'").

- [x] **Step 3: Implement `EntityAiOverviewSection.tsx` and embed into pages**
- In `src/app/admin/entities/[id]/page.tsx`, mount `EntityAiOverviewSection` at the top of the entity page or inside the `overview` and `ai-context` tab flows.
- In `src/app/admin/deals/[id]/components/DealAiIntelligencePanel.tsx`, enhance the panel to render `DealIntelligenceCard`.
- Verify zero regressions on legacy functionality.

- [x] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-page-integration.test.tsx`
Expected: PASS.

- [x] **Step 5: Full verification gates**
Run:
```bash
# 1. CRM Platform test suites
pnpm vitest run src/platform/__tests__/agents/crm/

# 2. UI test suites
pnpm vitest run src/platform/__tests__/ui/

# 3. Platform baseline regression suites
pnpm vitest run src/platform/__tests__/baseline/

# 4. TypeScript static typecheck
NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck

# 5. ESLint static analysis
NODE_OPTIONS='--max-old-space-size=8192' pnpm lint
```

- [x] **Step 6: Commit**
```bash
git add src/app/admin/entities/ src/app/admin/deals/ src/platform/__tests__/ui/crm-page-integration.test.tsx
git commit -m "feat(crm-page): embed CRM AI intelligence surfaces into entity and deal pages"
```

---

## 7. Verification Checklists & Acceptance Criteria

### 7.1 Strict Typing & Quality (Rule 4 & 10)
- [x] 100% strict TypeScript types across all schemas, server actions, and UI components.
- [x] Zero `any` or `any[]` throughout codebase.
- [x] All contracts validated with Zod v4 (`zod/v4`).
- [x] Clean typecheck: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` exits with code 0.
- [x] Clean linter: `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` exits with code 0.

### 7.2 Security & Authority (Rule 67)
- [x] Anti-IDOR validation enforced on all 5 Server Actions.
- [x] Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`) returns `CRM_DEAD_MAN_PAUSED` when active.
- [x] Untrusted customer notes, transcripts, and citations wrapped in `<untrusted_reference_data id="...">` containers.
- [x] Sensitive tokens (credentials, API keys, PII) redacted via `[REDACTED_SECRET:<type>]`.
- [x] All recommendation items provide Rule 41 explainability grids (`what`, `why`, `impact`).

### 7.3 Modal Architecture SSOT (`theme.md` §8)
- [x] All drawers and modals use semantic token binding (`border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`).
- [x] Demarcated header (`<DialogHeader demarcated>`) with baseline dividing border.
- [x] Single-circle info tooltip button with `<CardInfoTooltip text="..." />` elevated at `z-[10050]`.
- [x] Zero raw descriptions visible under title; screen-reader accessible via `<DialogDescription className="sr-only">`.
- [x] Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`).
- [x] Touch targets $\ge 44\text{px}$ (`min-h-[44px]`).

### 7.4 Dual-Tier CRM Data Model & Strangler Fig (Rule 69)
- [x] Global corporate master identity in `/entities/{entityId}` remains immutable.
- [x] All operational state mutations target `/workspace_entities/${workspaceId}_${entityId}`.
- [x] Pre-existing tabs and widgets on `/admin/entities/[id]` and `/admin/deals/[id]` remain 100% functional.
- [x] 100% pass on platform baseline regression test suites (43/43 tests passing).
- [x] Senior Principal Systems & AI Agentic Architecture Reviewer code review completed and approved.
