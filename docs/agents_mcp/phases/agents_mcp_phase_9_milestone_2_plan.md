# SmartSapp Agentic & MCP Transformation: Phase 9 Milestone 2 Implementation Plan
## Domain Specialist CRM Agents, Personas, Tool Matrix, Evaluation Datasets & Shadow Mode
### Deeply Integrated with `docs/agents_mcp/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 6 specialized CRM agent personas (`crm_assistant`, `crm_researcher`, `lead_analyst`, `deal_strategist`, `task_coordinator`, `knowledge_analyst`), their comprehensive Permission, Tool, Failure, and Rollback matrices, a 20+ scenario gold standard evaluation benchmark, and an enterprise Shadow Mode simulation engine producing Blast Radius Reports in full adherence to the 69 Agentic Development Rules (specifically Rule 67 Agent Implementation Gate, Rule 68 Non-Negotiable Invariants, Rule 69 Capability Layer SSOT, and `agents_mcp_rules.md` lines 1940–1953).

**Architecture:** A domain-partitioned agent workforce where each persona possesses immutable capability boundaries, explicit risk ceilings (`L0_READ` to `L2_STATE_MUTATION`), non-delegable action stripping, and specialized prompt snippets. All mutating operations are governed by reverse-LIFO Saga compensations, evaluated against a 20-scenario ground-truth benchmark, and verified in shadow mode (`dryRun: true`) with zero production database mutations.

**Tech Stack:** TypeScript (strict zero-`any`), Next.js 15 App Router, Zod v4, Firestore Admin SDK, EventBus, Vitest.

---

## 1. Executive Summary & Domain Agent Specialization

In accordance with `agents_mcp_roadmap.md` (§ Phase 9) and `agents_mcp_rules.md` (§ Phase 9–13 Domain Agents), every domain agent must ship with 7 mandatory architectural pillars:
1. **Shadow Mode Harness** (Rule 42)
2. **Evaluation Dataset** (Rule 44 & 67)
3. **Permission Matrix** (Rule 8 & 16)
4. **Tool Matrix** (Rule 12 & 59)
5. **Failure Matrix** (Rule 2 & 48)
6. **Security Tests** (Rule 13, 30, 46)
7. **Rollback Plan** (Rule 27)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 9 MILESTONE 2: SPECIALIZED CRM WORKFORCE PLANE                 │
│                                                                                        │
│   crm_assistant          crm_researcher        lead_analyst       deal_strategist      │
│   (General Account       (Deep Account         (ICP Fit, Scoring  (Pipeline Velocity,  │
│    Copilot & Overview)    Dossiers & Citations) & Enrichment)      Stall & Win Plans)  │
│   Risk: L1_INTERNAL      Risk: L0_READ         Risk: L1_INTERNAL  Risk: L1_INTERNAL    │
│                                                                                        │
│   task_coordinator       knowledge_analyst                                             │
│   (Commitments, Due      (Institutional Memory                                         │
│    Dates & Next Actions)  & Fact Extraction)                                           │
│   Risk: L2_STATE_MUTATION Risk: L1_INTERNAL                                            │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                  GOVERNANCE, MATRICES & EVALUATION HARNESS (RULE 67)                   │
│                                                                                        │
│  [Permission Matrix] -> Strict RBAC mapping per persona (zero wildcard scopes)         │
│  [Tool Matrix]       -> Domain & risk ceilings (L0 to L2; non-delegables stripped)     │
│  [Failure Matrix]    -> Deterministic edge-case resolution (missing, stale, timeout)   │
│  [Rollback Matrix]   -> Reverse-LIFO Saga compensation mapping for every mutation      │
│  [Evaluation Suite]  -> 20+ Ground-truth scenarios (Greenfield, Stalled, Churn, Attack)│
│  [Shadow Simulation] -> executeCrmAgentShadowMode (dryRun: true, Blast Radius Report)  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Architecture: Dual-Tier CRM Data Model Preservation (Rule 69)

In accordance with `agents_mcp_tools.md` lines 505–514, SmartSapp strictly enforces the **dual-tier CRM data model**:
1. **Global Master Identity (`entities`):** `/entities/{entityId}` stores immutable, organization-wide corporate identity (legal name, national registration number, global headquarters address, base website, verified industry). CRM agents may read global identity, but **never** mutate it directly.
2. **Workspace Operational Record (`workspace_entities`):** `/workspace_entities/{workspaceId}_{entityId}` stores workspace-scoped CRM execution state (pipeline, stage, assigned account executive, workspace tags, lead score, local activity log).
3. **Execution Invariant:** Any mutation proposed or simulated by a CRM agent (e.g. adding a tag, transitioning a stage, assigning an owner) must target `/workspace_entities/${workspaceId}_${entityId}`.

---

## 3. Master 69-Rules Alignment & Enforcement Matrix for Milestone 2

| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to Next.js 15 App Router, strict TypeScript, and modular design. All existing CRM features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Full deterministic `CRM_FAILURE_MATRIX` handles missing entities, empty timelines, stale records, network timeouts, and model disconnects. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides operator visibility into persona capabilities, tool matrices, and eval benchmarks on `/admin/intelligence/agents`. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | 100% strict TypeScript types. `unknown` permitted only at raw boundaries, validated immediately with Zod v4 schemas. |
| **Rule 5** | Staged Deployment & Security Verification | All persona permissions, matrices, and simulation runners verified with isolated tests before deployment. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `@modelcontextprotocol/server`, `zod/v4`, and `date-fns`. Documentation verified via Context7 MCP. |
| **Rule 7** | Mobile-First & Plain UI English | All evaluation results, blast radius reports, and persona descriptions formatted in clean, plain English without raw stack traces. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every persona query, eval run, and simulation validates `organizationId` and `workspaceId`. Cross-tenant queries fail closed with HTTP 403. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Bounded evaluation batches ($\le 25$ scenarios), timeout ceilings ($\le 120\text{s}$ per persona), and memory limits enforced. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` documentation detailing architecture, security invariants, Rule mappings, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Persona capabilities and shadow mode tools map directly to Streamable HTTP MCP tools (Spec 2026-07-28). |
| **Rule 12** | Risk Ceilings & Weighted Rank | Enforces persona risk level ceilings (`L0_READ` to `L2_STATE_MUTATION`). `L3`/`L4` operations strictly require human approval proposals. |
| **Rule 13** | Formal Trust Boundary Matrix | Customer notes, emails, and meeting transcripts treated as untrusted and wrapped in `<untrusted_reference_data id="...">` containers. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Pre-execution cryptographic SHA-256 fingerprint verification before capability dispatch in shadow mode. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | External enrichment data validated against allowlisted sources with SSRF prevention. |
| **Rule 16** | Agent Identity as Security Principal | Every persona declares explicit `allowedPermissions` and `allowedDomains`. Wildcard (`*`) scopes are strictly banned. |
| **Rule 17** | Non-Delegable Actions | Destructive actions (entity deletion, workspace deletion, tenant settings wipe) unconditionally stripped from persona capabilities. |
| **Rule 18** | TOCTOU Live Principal / Record Check | Record versions verified before proposing or simulating operational state changes. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Mutating proposals and shadow mode execution compute deterministic idempotency keys (`crm_shadow_${runId}_${stepId}`). |
| **Rule 20** | Replay & Distributed Tracing | Evaluator and shadow mode runs inject `correlationId` and `traceId` into execution metadata and domain events. |
| **Rule 21** | Two-Phase Action Model | Personas can draft proposals (`L1`) or mutate internal workspace state (`L2`); high-risk mutations require Two-Phase Human Approval. |
| **Rule 22** | Cryptographic Approval Binding | Action proposals generate SHA-256 state hashes binding the proposal payload. |
| **Rule 23** | Resource Governance & Budgets | Personas declare deterministic budgets (`maxDurationMs`, `maxTokens`, `maxToolCalls`, `maxRecordsMutated`). |
| **Rule 24** | 5-State Circuit Breakers | Model routers and evaluators protected by circuit breakers (`healthy`, `degraded`, `open`, `half_open`, `recovered`). |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed persona simulations and eval executions log structured diagnostic reports. |
| **Rule 26** | True Cooperative Cancellation | Shadow mode and eval runners accept native `AbortSignal` for instantaneous cooperative cancellation. |
| **Rule 27** | Formal Saga / Compensation Model | `CRM_ROLLBACK_MATRIX` maps every mutating CRM capability to its compensating counterpart (e.g. `crm.entity.tag_add` $\leftrightarrow$ `crm.entity.tag_remove`). |
| **Rule 28** | Context Budgeting | Personas operate on knapsack-compressed 360° account context packages strictly bounded to $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Semantic memory retrieval utilizes temporal decay weighting, prioritizing fresh notes and recent meetings. |
| **Rule 30** | Knowledge Poisoning Defense | Personas prompt snippets enforce explicit instructions to distrust directives inside `<untrusted_reference_data>` XML containers. |
| **Rule 31** | Output Validation Between Agent & Tool | Step validator verifies capability output schema via `safeParse`. |
| **Rule 32** | Cross-Domain Exfiltration Detection | Personas restricted strictly to allowed capability domains (`crm_contacts`, `deals_revenue`, `knowledge_memory`, `tasks_productivity`, `lead_intelligence`). |
| **Rule 33** | Egress Control & Redaction | Shadow mode and eval reports redact sensitive credentials (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | External website links or company URLs validated with `validateSafeEgressUrl` blocking loopback and private subnets. |
| **Rule 35** | MCP Discovery Caching | Discovery schemas cached with deterministic ETag HTTP 304 validation. |
| **Rule 36** | Capability Version Compatibility | Agent definitions declare exact SemVer requirements. |
| **Rule 37** | MCP Spec Compatibility Testing | Verifies context and tool output conforms to MCP Protocol Spec 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Rejects legacy stateful sessions; uses Streamable HTTP. |
| **Rule 39** | OpenTelemetry From Day One | Emits `traceparent` headers and OpenTelemetry span attributes on all persona simulations. |
| **Rule 40** | Audit Log Immutability | Publishes `crm.agent.simulated`, `crm.eval.completed`, and `crm.persona.registered` events via `defaultEventBus`. |
| **Rule 41** | "Why Did You Do This?" Audit View | Every simulated proposal generates WHAT, WHY, and EXPECTED STATE CHANGE. |
| **Rule 42** | Mandatory Shadow Mode | `executeCrmAgentShadowMode` executes plans with `dryRun: true`, producing Blast Radius Reports with 0 database writes. |
| **Rule 43** | Replayable Agent Runs | Evaluation and shadow runs persist full snapshot traces allowing exact replay. |
| **Rule 44** | Deterministic Evaluation Dataset | 20+ realistic enterprise scenarios with ground-truth facts, expected citations, and acceptable actions. |
| **Rule 45** | Chaos Testing | Simulates model timeouts, missing entity relations, and contradictory facts during evaluations. |
| **Rule 46** | Adversarial Security Testing | Red-team test suites against prompt injection via notes, cross-tenant IDOR probing, and unapproved mutations. |
| **Rule 47** | Never Trust the Model | All persona outputs, risk scores, and proposed actions validated against Zod v4 schemas. |
| **Rule 48** | Sanitized Error Reporting | `CrmPersonaError` provides structured error codes and sanitized diagnostic details. |
| **Rule 49** | Production Telemetry & Latency Monitoring | Evaluator tracks latency metrics per scenario ($\le 800\text{ms}$). |
| **Rule 50** | Cache Isolation Rules | Evaluation and shadow mode metrics partitioned strictly by `organizationId` and `workspaceId`. |
| **Rule 51** | App Router & Server Actions Security | All operator actions adhere to Next.js 15 Server Actions with Clerk authentication and Anti-IDOR assertions. |
| **Rule 52** | Event Streaming via SSE | Evaluation progress streamable via Server-Sent Events without polling. |
| **Rule 53** | Idempotent Event Handling | Domain event consumers deduplicate events via `correlationId`. |
| **Rule 54** | Performance Budgets | Persona evaluation $\le 800\text{ms}$; shadow mode simulation $\le 400\text{ms}$. |
| **Rule 55** | Resilient Data Models | Evaluator and shadow mode results partitioned to avoid exceeding Firestore 1MB document ceilings. |
| **Rule 56** | Bounded Prompt Assembly | Prompt tokens strictly capped at 4,000 tokens. |
| **Rule 57** | Fallback Degradations | Gracefully falls back to heuristic summaries if LLM generation times out. |
| **Rule 58** | Model Routing Policy | Fast classification and tag recommendations route to Flash; deep account synthesis and deal strategy route to Pro. |
| **Rule 59** | Tool Selection Evaluation | Personas restricted strictly to allowed capability inventories defined in `CRM_TOOL_MATRIX`. |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` evaluated before running evaluations or shadow mode simulations. |
| **Rule 61** | Surface Isolation | Client vs backoffice surfaces verified. |
| **Rule 62** | Real-Time SSE Reactivity | Evaluation updates consume SSE streams cleanly. |
| **Rule 63** | Operator Intervention Ergonomics | Failed evaluations highlight exact missing facts with actionable debugging guidance. |
| **Rule 64** | Non-Blocking Asynchronous Processing | Heavy evaluations run asynchronously in background tasks without stalling user requests. |
| **Rule 65** | Schema Migration & Backward Compatibility | All schema changes are additive with default fallbacks. |
| **Rule 66** | Cloud Run Stateless Serverless Readiness | Zero reliance on sticky sessions or in-memory state between requests. |
| **Rule 67** | The Agent Implementation Gate | Mandatory 9-point pre-flight checklist verified for all 6 CRM personas. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not user. 2. Never trust model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in UX. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preserves existing built-in personas (`lead_sdr`, `deal_coach`, etc.) while adding specialized CRM personas with clean aliases. Zero regressions. |

---

## 4. Rule 67: The Agent Implementation Gate Verification

Before Phase 9 Milestone 2 can be marked complete, the following architectural gate answers must be verified:

### 4.1 Architecture
- **What canonical capability does this use?** Uses CRM, Revenue, Knowledge, and Productivity capabilities (`crm_contacts`, `deals_revenue`, `knowledge_memory`, `tasks_productivity`, `meetings_conversations`).
- **Is this duplicating an existing service?** No. It wraps canonical capability definitions and leverages `AccountContextAssembler` and `AccountTimelineService` (Phase 9 Milestone 1).
- **What is the source of truth?** Firestore `/entities` (master identity) and `/workspace_entities` (operational records).
- **What events are emitted?** `crm.persona.registered`, `crm.agent.simulated`, `crm.eval.completed`.

### 4.2 Authority
- **Who is allowed to use it?** Authenticated workspace users with appropriate RBAC roles (`operations.campuses.view`, `operations.pipeline.view`, etc.).
- **What may the agent do?** Assemble context, synthesize account dossiers, detect stalled deals, score ICP fit, extract facts, propose tags/stage changes, and schedule tasks (`L0` to `L2`).
- **What may the agent never do?** Mutate global master entities (`/entities`), delete workspaces, execute unapproved outbound communications, or bypass human approval for `L3`/`L4` operations.
- **Can a sub-agent inherit this authority?** Only through downward scope attenuation ($P_{\text{child}} = P_{\text{parent}} \cap P_{\text{target}} \cap P_{\text{requested}}$, Rule 16) with non-delegable actions stripped (Rule 17).

### 4.3 Data
- **What data enters the agent?** 360° Account Context packages (timeline, meetings, notes, deals, tasks).
- **What data leaves the system?** Grounded dossiers, analytical scores, proposed action plans, and simulated Blast Radius Reports.
- **What is trusted?** Verified entity identities, internal workspace settings, system policy configurations.
- **What is untrusted?** Customer notes, external email bodies, meeting transcripts, third-party web content (wrapped in `<untrusted_reference_data id="...">`).
- **What is sensitive?** Passwords, API keys, credentials, financial details (masked via `[REDACTED_SECRET:<type>]`).

### 4.4 Execution
- **Is it idempotent?** Yes. All mutating operations and shadow simulations use deterministic idempotency keys (`crm_shadow_${runId}_${stepId}`).
- **Can it be retried?** Yes, safe read-only operations and idempotent simulations can be retried with exponential backoff.
- **Can it be cancelled?** Yes, via native `AbortSignal` cooperative cancellation.
- **Can it be duplicated?** No, deduplicated via `correlationId` and idempotency keys.
- **What if the underlying record changes?** Optimistic concurrency version checks detect TOCTOU conflicts (`VERSION_MISMATCH`) and trigger re-fetch.
- **What if the response is lost?** Read operations are re-runnable; simulations are re-executable with zero side-effects.

### 4.5 MCP & Governance
- **What protocol version?** Spec 2026-07-28 (Streamable HTTP).
- **What is the blast radius?** In shadow mode (`dryRun: true`): strictly zero database mutations. In execution mode: bounded to `/workspace_entities/${workspaceId}_${entityId}`.
- **What is the risk level?** `L0_READ` (researcher), `L1_INTERNAL_DRAFT` (assistant, analysts, strategist), `L2_STATE_MUTATION` (coordinator).
- **Is approval required?** All `L3`/`L4` and outbound actions require Two-Phase Human Approval.
- **Can it be rolled back?** Yes, via reverse-LIFO Saga compensations mapped in `CRM_ROLLBACK_MATRIX`.
- **What does the operator see?** Blast Radius Reports with targeted domains, records at risk, risk breakdown, and proposed actions on `/admin/intelligence/agents`.

---

## 5. Architectural Specifications & Data Contracts

### 5.1 Specialized Persona Declarations (`src/platform/agents/crm/personas/crm-persona-definitions.ts`)

```typescript
import { AgentPersonaDefinition } from '@/platform/identity/agent-persona-types';

export const CRM_PERSONA_DEFINITIONS: Record<string, AgentPersonaDefinition> = {
  crm_assistant: {
    id: 'crm_assistant',
    name: 'Universal CRM Assistant & Account Copilot',
    version: '1.0.0',
    role: 'General CRM Copilot & Account Intelligence Specialist',
    description: 'Provides holistic 360° account summaries, answers user queries, and prepares meeting dossiers.',
    icon: 'Bot',
    allowedDomains: ['crm_contacts', 'deals_revenue', 'knowledge_memory', 'tasks_productivity', 'meetings_conversations'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.pipeline.view',
      'rbac:operations.tasks.view',
      'rbac:operations.dashboard.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Universal CRM Assistant. You answer inquiries about accounts, synthesize recent interactions, and prepare meeting dossiers. All mutating actions must be structured as proposals.',
  },
  crm_researcher: {
    id: 'crm_researcher',
    name: 'CRM Researcher Agent',
    version: '1.0.0',
    role: 'Account Intelligence Specialist',
    description: 'Reconstructs comprehensive 360-degree account histories across entities, notes, meetings, and communications with exact citations.',
    icon: 'UserSearch',
    allowedDomains: ['crm_contacts', 'knowledge_memory', 'meetings_conversations', 'tasks_productivity'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:studios.tags.view',
      'rbac:operations.tasks.view',
      'rbac:operations.dashboard.view',
      'workspace:read',
      'crm:timeline:view',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp CRM Researcher Agent. You explore account histories, synthesize notes, analyze timelines, and build structured dossiers with exact citations. You are strictly read-only.',
  },
  lead_analyst: {
    id: 'lead_analyst',
    name: 'Lead Qualification & Enrichment Analyst',
    version: '1.0.0',
    role: 'ICP Fit & Lead Intelligence Specialist',
    description: 'Analyzes inbound leads, scores ICP fit, technographically enriches company profiles, and proposes qualification tags.',
    icon: 'Target',
    allowedDomains: ['lead_intelligence', 'crm_contacts', 'knowledge_memory'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:studios.tags.view',
      'rbac:operations.pipeline.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Lead Qualification & Enrichment Analyst. You evaluate inbound prospects against ICP criteria, score qualification, and propose enrichment tags.',
  },
  deal_strategist: {
    id: 'deal_strategist',
    name: 'Deal Strategy & Velocity Analyst',
    version: '1.0.0',
    role: 'Pipeline Velocity & Win Strategy Specialist',
    description: 'Monitors deal pipeline velocity, detects stalled opportunities, identifies competitor objections, and formulates tactical win plans.',
    icon: 'TrendingUp',
    allowedDomains: ['deals_revenue', 'crm_contacts', 'knowledge_memory'],
    allowedPermissions: [
      'rbac:operations.pipeline.view',
      'rbac:operations.campuses.view',
      'rbac:operations.tasks.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Deal Strategy Analyst. You analyze pipeline velocity, diagnose stalled deals, and propose tactical win plans for account executives.',
  },
  task_coordinator: {
    id: 'task_coordinator',
    name: 'CRM Task & Commitment Coordinator',
    version: '1.0.0',
    role: 'Follow-Up & Commitment Specialist',
    description: 'Extracts verbal commitments from meeting transcripts and notes, schedules follow-ups, and manages CRM tasks.',
    icon: 'CalendarCheck',
    allowedDomains: ['tasks_productivity', 'meetings_conversations', 'crm_contacts'],
    allowedPermissions: [
      'rbac:operations.tasks.view',
      'rbac:operations.tasks.create',
      'rbac:operations.tasks.edit',
      'rbac:operations.campuses.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 20,
      maxRecordsMutated: 25,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp CRM Task Coordinator. You extract commitments, assign follow-up tasks to account team members, and ensure no deal promises slip through the cracks.',
  },
  knowledge_analyst: {
    id: 'knowledge_analyst',
    name: 'Account Knowledge & Memory Analyst',
    version: '1.0.0',
    role: 'Institutional Memory Specialist',
    description: 'Extracts grounded entity facts, key stakeholder preferences, and organizational changes into structured institutional memory.',
    icon: 'Brain',
    allowedDomains: ['knowledge_memory', 'crm_contacts'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Account Knowledge Analyst. You distill grounded entity facts, executive preferences, and relationship milestones into structured memory.',
  },
};
```

### 5.2 Agent Matrices (`src/platform/agents/crm/personas/crm-agent-matrix.ts`)

```typescript
import { z } from 'zod/v4';

export const CrmToolMatrixEntrySchema = z.object({
  capabilityId: z.string().min(1),
  domain: z.string().min(1),
  riskLevel: z.enum(['L0_READ', 'L1_INTERNAL_DRAFT', 'L2_STATE_MUTATION', 'L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE']),
  description: z.string().min(1),
  compensatingCapabilityId: z.string().optional(),
});

export type CrmToolMatrixEntry = z.infer<typeof CrmToolMatrixEntrySchema>;

export const CRM_PERMISSION_MATRIX: Record<string, readonly string[]> = {
  crm_assistant: [
    'rbac:operations.campuses.view',
    'rbac:operations.pipeline.view',
    'rbac:operations.tasks.view',
    'rbac:operations.dashboard.view',
    'workspace:read',
  ],
  crm_researcher: [
    'rbac:operations.campuses.view',
    'rbac:studios.tags.view',
    'rbac:operations.tasks.view',
    'rbac:operations.dashboard.view',
    'workspace:read',
    'crm:timeline:view',
  ],
  lead_analyst: [
    'rbac:operations.campuses.view',
    'rbac:studios.tags.view',
    'rbac:operations.pipeline.view',
    'workspace:read',
  ],
  deal_strategist: [
    'rbac:operations.pipeline.view',
    'rbac:operations.campuses.view',
    'rbac:operations.tasks.view',
    'workspace:read',
  ],
  task_coordinator: [
    'rbac:operations.tasks.view',
    'rbac:operations.tasks.create',
    'rbac:operations.tasks.edit',
    'rbac:operations.campuses.view',
    'workspace:read',
  ],
  knowledge_analyst: [
    'rbac:operations.campuses.view',
    'workspace:read',
  ],
};

export const CRM_TOOL_MATRIX: Record<string, readonly CrmToolMatrixEntry[]> = {
  crm_assistant: [
    { capabilityId: 'crm.account.get_context', domain: 'crm_contacts', riskLevel: 'L0_READ', description: 'Fetch full 360 account context package' },
    { capabilityId: 'crm.timeline.get_events', domain: 'crm_contacts', riskLevel: 'L0_READ', description: 'Retrieve chronological account timeline events' },
    { capabilityId: 'knowledge.memory.query', domain: 'knowledge_memory', riskLevel: 'L0_READ', description: 'Search semantic memory for account notes' },
    { capabilityId: 'deal.pipeline.get', domain: 'deals_revenue', riskLevel: 'L0_READ', description: 'View active pipeline stage and deal health' },
    { capabilityId: 'crm.proposal.draft', domain: 'crm_contacts', riskLevel: 'L1_INTERNAL_DRAFT', description: 'Draft account update proposal for operator review' },
  ],
  crm_researcher: [
    { capabilityId: 'crm.account.get_context', domain: 'crm_contacts', riskLevel: 'L0_READ', description: 'Fetch full 360 account context package' },
    { capabilityId: 'crm.timeline.get_events', domain: 'crm_contacts', riskLevel: 'L0_READ', description: 'Retrieve chronological account timeline events' },
    { capabilityId: 'knowledge.memory.query', domain: 'knowledge_memory', riskLevel: 'L0_READ', description: 'Search semantic memory for account notes' },
    { capabilityId: 'meetings.transcript.get', domain: 'meetings_conversations', riskLevel: 'L0_READ', description: 'Read past meeting transcripts' },
  ],
  lead_analyst: [
    { capabilityId: 'lead.intelligence.profile', domain: 'lead_intelligence', riskLevel: 'L0_READ', description: 'Retrieve technographic and firmographic profiles' },
    { capabilityId: 'crm.account.get_context', domain: 'crm_contacts', riskLevel: 'L0_READ', description: 'Fetch lead context package' },
    { capabilityId: 'lead.proposal.tag_add', domain: 'crm_contacts', riskLevel: 'L1_INTERNAL_DRAFT', description: 'Propose lead qualification tags', compensatingCapabilityId: 'lead.proposal.tag_remove' },
  ],
  deal_strategist: [
    { capabilityId: 'deal.pipeline.get', domain: 'deals_revenue', riskLevel: 'L0_READ', description: 'Inspect deal stage history and velocity' },
    { capabilityId: 'deal.stage.analyze_stall', domain: 'deals_revenue', riskLevel: 'L0_READ', description: 'Calculate deal stall duration and risk metrics' },
    { capabilityId: 'deal.proposal.stage_transition', domain: 'deals_revenue', riskLevel: 'L1_INTERNAL_DRAFT', description: 'Propose stage transition or tactical win action' },
  ],
  task_coordinator: [
    { capabilityId: 'meetings.commitments.extract', domain: 'meetings_conversations', riskLevel: 'L0_READ', description: 'Extract action items and promises from meeting' },
    { capabilityId: 'task.create', domain: 'tasks_productivity', riskLevel: 'L2_STATE_MUTATION', description: 'Create task assigned to team member', compensatingCapabilityId: 'task.cancel' },
    { capabilityId: 'task.update', domain: 'tasks_productivity', riskLevel: 'L2_STATE_MUTATION', description: 'Update due date or priority of task', compensatingCapabilityId: 'task.update' },
    { capabilityId: 'task.cancel', domain: 'tasks_productivity', riskLevel: 'L2_STATE_MUTATION', description: 'Cancel open task', compensatingCapabilityId: 'task.create' },
  ],
  knowledge_analyst: [
    { capabilityId: 'knowledge.memory.query', domain: 'knowledge_memory', riskLevel: 'L0_READ', description: 'Query existing entity memory facts' },
    { capabilityId: 'knowledge.proposal.fact_record', domain: 'knowledge_memory', riskLevel: 'L1_INTERNAL_DRAFT', description: 'Propose new verified fact for entity memory' },
  ],
};

export const CRM_FAILURE_MATRIX: Record<string, { strategy: string; fallbackCode: string; description: string }> = {
  ENTITY_NOT_FOUND: { strategy: 'FAIL_CLOSED', fallbackCode: 'ACCOUNT_NOT_FOUND', description: 'Halt execution; alert user entity does not exist in workspace' },
  STALE_RECORD: { strategy: 'RE_FETCH_AND_VERIFY', fallbackCode: 'VERSION_MISMATCH', description: 'Re-fetch latest workspace entity state and retry proposal synthesis' },
  EMPTY_TIMELINE: { strategy: 'FALLBACK_TO_STATIC', fallbackCode: 'NO_ACTIVITY_LOGGED', description: 'Provide static account profile with clear notice of no recent activity' },
  MODEL_TIMEOUT: { strategy: 'DEGRADE_GRACEFULLY', fallbackCode: 'AI_TIMEOUT_FALLBACK', description: 'Return rule-based heuristic summary instead of failing entirely' },
  UNAPPROVED_MUTATION: { strategy: 'ROUTE_TO_PROPOSAL', fallbackCode: 'PROPOSAL_REQUIRED', description: 'Intercept mutation and wrap into human approval proposal' },
  RATE_LIMITED: { strategy: 'CIRCUIT_BREAKER_BACKOFF', fallbackCode: 'RATE_LIMIT_BACKOFF', description: 'Trip circuit breaker, back off exponentially, and notify caller' },
};

export const CRM_ROLLBACK_MATRIX: Record<string, string> = {
  'task.create': 'task.cancel',
  'task.update': 'task.update',
  'task.cancel': 'task.create',
  'crm.entity.tag_add': 'crm.entity.tag_remove',
  'crm.entity.tag_remove': 'crm.entity.tag_add',
  'crm.entity.assign_owner': 'crm.entity.assign_owner',
  'deal.stage.transition': 'deal.stage.transition',
};
```

### 5.3 Evaluation Dataset (`src/platform/agents/crm/evaluation/crm-eval-dataset.ts`)

```typescript
import { z } from 'zod/v4';

export const CrmEvalScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    'FLAGSHIP_ACCOUNT',
    'STALLED_DEAL',
    'DUPLICATE_LEAD',
    'AT_RISK_CHURN',
    'RE_ENGAGEMENT',
    'SECURITY_ATTACK',
  ]),
  inputQuery: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  groundTruthFacts: z.array(z.string().min(1)).min(1),
  expectedPersona: z.string().min(1),
  expectedRiskLevel: z.enum(['L0_READ', 'L1_INTERNAL_DRAFT', 'L2_STATE_MUTATION', 'L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE']),
  expectedActions: z.array(z.string().min(1)),
  adversarialDirectives: z.array(z.string()).optional(),
  forbiddenActions: z.array(z.string()).optional(),
});

export type CrmEvalScenario = z.infer<typeof CrmEvalScenarioSchema>;
```

### 5.4 Shadow Mode Simulation Engine (`src/platform/agents/crm/evaluation/crm-shadow-mode.ts`)

```typescript
import { z } from 'zod/v4';

export const BlastRadiusReportSchema = z.object({
  targetedDomains: z.array(z.string()),
  recordsAtRiskCount: z.number().int().nonnegative(),
  highestRiskLevel: z.string(),
  requiresHumanApproval: z.boolean(),
  simulatedMutationsCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export type BlastRadiusReport = z.infer<typeof BlastRadiusReportSchema>;

export const CrmShadowModeResultSchema = z.object({
  runId: z.string().min(1),
  personaId: z.string().min(1),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  dryRun: z.literal(true),
  mutationsInterceptedCount: z.number().int().nonnegative(),
  simulatedMutations: z.array(
    z.object({
      capabilityId: z.string(),
      riskLevel: z.string(),
      targetRecord: z.string(),
      mockStateChange: z.record(z.string(), z.unknown()),
      idempotencyKey: z.string(),
    })
  ),
  blastRadiusReport: BlastRadiusReportSchema,
  durationMs: z.number().nonnegative(),
});

export type CrmShadowModeResult = z.infer<typeof CrmShadowModeResultSchema>;
```

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Augment Persona Registry & Canonical CRM Personas

**Files:**
- Modify: `src/platform/identity/agent-persona-types.ts`
- Modify: `src/platform/identity/agent-registry.ts`
- Create: `src/platform/agents/crm/personas/crm-persona-definitions.ts`
- Create: `src/platform/agents/crm/personas/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-personas.test.ts`

- [ ] **Step 1: Write failing persona tests**
  - Verify that `crm_assistant`, `crm_researcher`, `lead_analyst`, `deal_strategist`, `task_coordinator`, and `knowledge_analyst` are registered and valid.
  - Verify persona risk ceilings (`L0_READ` for researchers, `L1_INTERNAL_DRAFT` for assistant/analysts/strategists, `L2_STATE_MUTATION` for coordinators).
  - Verify that wildcard permissions (`*`) are banned and non-delegable permissions are strictly absent.
  - Verify backward compatibility: existing personas (`lead_sdr`, `deal_coach`, etc.) remain fully registered without regression (Rule 69).
- [ ] **Step 2: Run test to verify failure**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-personas.test.ts`
- [ ] **Step 3: Implement persona augmentation**
  - Augment `AGENT_PERSONA_IDS` in `agent-persona-types.ts` with `'crm_assistant'`, `'lead_analyst'`, `'deal_strategist'`, `'task_coordinator'`, `'knowledge_analyst'`.
  - Author `src/platform/agents/crm/personas/crm-persona-definitions.ts`.
  - Register in `BUILT_IN_AGENT_PERSONAS` in `agent-registry.ts`.
  - Export public API in `src/platform/agents/crm/personas/index.ts`.
- [ ] **Step 4: Run test to verify passing**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-personas.test.ts`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(crm-agent): add specialized CRM agent persona definitions and registry integration"`

---

### Task 2: Permission, Tool, Failure & Rollback Matrices

**Files:**
- Create: `src/platform/agents/crm/personas/crm-agent-matrix.ts`
- Test: `src/platform/__tests__/agents/crm/crm-agent-matrix.test.ts`

- [ ] **Step 1: Write failing matrix tests**
  - Test `validateCrmPersonaToolAccess` against allowed capabilities and verify it rejects unauthorized domains and risk breaches.
  - Test `getCrmRollbackCapability` for all mutating tools, verifying reverse-LIFO mapping.
  - Test `resolveCrmFailureStrategy` for edge cases (`ENTITY_NOT_FOUND`, `STALE_RECORD`, `EMPTY_TIMELINE`, `MODEL_TIMEOUT`).
  - Test that all permissions in `CRM_PERMISSION_MATRIX` contain zero wildcards (`*`).
- [ ] **Step 2: Run test to verify failure**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-agent-matrix.test.ts`
- [ ] **Step 3: Implement matrices & helper functions**
  - Author `crm-agent-matrix.ts` with strict Zod v4 schemas, zero `any`, and full matrix definitions.
- [ ] **Step 4: Run test to verify passing**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-agent-matrix.test.ts`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(crm-agent): implement permission, tool, failure, and rollback matrices"`

---

### Task 3: Ground-Truth Evaluation Benchmark Dataset (20+ Scenarios)

**Files:**
- Create: `src/platform/agents/crm/evaluation/crm-eval-dataset.ts`
- Create: `src/platform/agents/crm/evaluation/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-eval-dataset.test.ts`

- [ ] **Step 1: Write failing eval dataset tests**
  - Verify dataset contains $\ge 20$ valid scenarios conforming to `CrmEvalScenarioSchema`.
  - Verify scenarios cover all 6 categories:
    1. `FLAGSHIP_ACCOUNT` (3+ scenarios)
    2. `STALLED_DEAL` (4+ scenarios)
    3. `DUPLICATE_LEAD` (3+ scenarios)
    4. `AT_RISK_CHURN` (4+ scenarios)
    5. `RE_ENGAGEMENT` (3+ scenarios)
    6. `SECURITY_ATTACK` (3+ scenarios testing prompt injection & IDOR)
  - Verify all scenarios have non-empty `groundTruthFacts`, valid `expectedPersona`, and deterministic `expectedActions`.
- [ ] **Step 2: Run test to verify failure**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-eval-dataset.test.ts`
- [ ] **Step 3: Implement 20+ enterprise scenarios**
  - Author `crm-eval-dataset.ts` with realistic enterprise data, adversarial injection scenarios, and evaluation criteria.
- [ ] **Step 4: Run test to verify passing**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-eval-dataset.test.ts`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(crm-agent): author 20-scenario ground-truth evaluation benchmark dataset"`

---

### Task 4: Shadow Mode Simulation Engine & Blast Radius Generator

**Files:**
- Create: `src/platform/agents/crm/evaluation/crm-shadow-mode.ts`
- Update: `src/platform/agents/crm/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-shadow-mode.test.ts`

- [ ] **Step 1: Write failing shadow mode tests**
  - Verify zero writes occur on live databases (`dryRun: true`).
  - Verify mutating capabilities are intercepted, simulated, and recorded in `BlastRadiusReport`.
  - Verify dead-man switch halt throws `AgentGovernanceEmergencyPausedError` (Rule 60).
  - Verify cooperative cancellation via `AbortSignal` (Rule 26).
  - Verify Anti-IDOR validation rejects cross-tenant requests with HTTP 403 (Rule 8).
  - Verify domain event emission `crm.agent.simulated` via `defaultEventBus` (Rule 40).
- [ ] **Step 2: Run test to verify failure**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-shadow-mode.test.ts`
- [ ] **Step 3: Implement `CrmShadowModeRunner`**
  - Author `crm-shadow-mode.ts` with full interception, simulation state tracking, Blast Radius computation, and event publishing.
- [ ] **Step 4: Run test to verify passing**
  - `pnpm vitest run src/platform/__tests__/agents/crm/crm-shadow-mode.test.ts`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(crm-agent): implement CRM shadow mode simulation engine and blast radius reporter"`

---

### Task 5: Full Platform QA, Typecheck & Verification Gates

**Files:**
- Run all Milestone 2 test suites.
- Run baseline regression suites.
- Run `pnpm typecheck` and `pnpm lint`.

- [ ] **Step 1: Run all CRM test suites**
  - `pnpm vitest run src/platform/__tests__/agents/crm/`
- [ ] **Step 2: Run baseline regression tests**
  - `pnpm vitest run src/platform/__tests__/baseline/`
- [ ] **Step 3: Run static typecheck**
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
- [ ] **Step 4: Run linting**
  - `pnpm lint`
- [ ] **Step 5: Commit documentation and report**
  - Author completion report and commit clean state.

---

## 7. Verification Checklists & Acceptance Criteria

### 7.1 Strict Typing & Quality
- [ ] Absolute zero `any` or `any[]` (Rule 4).
- [ ] All schemas authored with `import { z } from 'zod/v4'` (Rule 10).
- [ ] Clean TypeScript static compilation (`tsc --noEmit`).
- [ ] Clean ESLint analysis with zero new warnings.

### 7.2 Security & Authority (Rule 67)
- [ ] Wildcard (`*`) scopes strictly banned on all 6 personas (Rule 16).
- [ ] Non-delegable actions unconditionally stripped (Rule 17).
- [ ] Destructive operations restricted to proposals with human approval (Rule 21).
- [ ] Emergency dead-man switch evaluated before simulation and eval runs (Rule 60).
- [ ] Customer content isolated with `<untrusted_reference_data id="...">` containers (Rule 13 & 30).

### 7.3 Dual-Tier CRM Data Model (Rule 69)
- [ ] All state mutations target `/workspace_entities/{workspaceId}_{entityId}`.
- [ ] Global entity records in `/entities/{entityId}` are immutable to CRM agents.

### 7.4 The 7 Mandatory Domain Agent Deliverables
- [ ] **Shadow Mode:** `executeCrmAgentShadowMode` verified with zero database writes.
- [ ] **Evaluation Dataset:** $\ge 20$ realistic scenarios with ground-truth facts.
- [ ] **Permission Matrix:** Explicit RBAC mapping per persona.
- [ ] **Tool Matrix:** Explicit allowed capability inventory and risk ceilings.
- [ ] **Failure Matrix:** Deterministic handling for missing/stale/timeout conditions.
- [ ] **Security Tests:** Adversarial red-team suite passing.
- [ ] **Rollback Plan:** Reverse-LIFO Saga compensation mapping verified for all mutations.
