# SmartSapp Agentic & MCP Transformation: Phase 13 Master Implementation Plan
## Multi-Agent Orchestration, Delegated Authority & Enterprise Agentic Organization
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1953, Rules 67–69), `.agents/AGENTS.md`, and `theme.md` §8

**Version:** 1.3.0  
**Status:** COMPLETED (All 5 Milestones Completed 100% · Production Graduated)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Executive Summary & Transformation Destination

Phases 8 through 12 established specialized, domain-specific autonomous agent workforces across CRM, Sales, Meetings, Knowledge, Finance, and School Operations. Each domain functions as an autonomous expert within its bounded scope.

**Phase 13 elevates SmartSapp from a collection of isolated domain bots into a cohesive, genuine agentic enterprise organization.**

Instead of monolithic "do-everything" agents, Phase 13 establishes a hierarchical **Supervisor Agent Architecture**:

```text
                               ┌─────────────────────────────────┐
                               │        Supervisor Agent         │
                               │   (Goal Decomposition & DAG)    │
                               └────────────────┬────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 │                              │                              │
                 ▼                              ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
      │  Knowledge Agent   │         │    Sales Agent     │         │   Finance Agent    │
      │ (Ontology & Memory)│         │(SDR & Intelligence)│         │(Billing & Runway)  │
      └────────────────────┘         └────────────────────┘         └────────────────────┘
                 │                              │                              │
                 ▼                              ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
      │   Meeting Agent    │         │  Operations Agent  │         │   Creative Agent   │
      │(Dossiers & Transc.)│         │(School & Attendance│         │(Campaign Assets)   │
      └────────────────────┘         └────────────────────┘         └────────────────────┘
```

### Core Architectural Mandates of Phase 13
1. **The Delegated Agent Identity Protocol (MCP Delegation Invariant):**
   - In accordance with the Model Context Protocol roadmap on agent identity and delegation, execution identity is never simply `userId`.
   - Every subagent execution receives a cryptographically bound `DelegationContext`:
     `organizationId`, `workspaceId`, `userId`, `supervisorAgentId`, `subAgentId`, `delegationId`, `delegationDepth` ($\le 3$), `permittedScopes`, and `tokenBudget`.
   - **Authority Intersection Algebra:**
     $$\text{Effective Authority} = \text{User Authority} \cap \text{Supervisor Authority} \cap \text{Sub-Agent Authority} \cap \text{Workspace Scopes} \cap \text{Delegated Policy}$$
   - An agent never gains privileges merely because it was triggered by a SuperAdmin (Rule 16).
2. **Non-Delegable Privileges Firewall (Rule 17):**
   - Certain capabilities can *never* be delegated to an autonomous agent or subagent (e.g., credentials rotation, owner changes, security rule modification, live financial write bypass).
   - Any attempt to delegate or execute a non-delegable capability results in instant rejection (`NON_DELEGABLE_ACTION_FORBIDDEN`).
3. **Graph Reasoning & Advanced Relationship Analytics (PRD §29):**
   - Evolves the Phase 11 Knowledge Graph projection into an active **Graph Reasoning Engine**.
   - Computes multi-hop organizational influence paths, decision-maker centrality, cross-campus contagion risks, and fee-default correlation clusters with strict traversal clamping ($\le 80$ nodes, $\le 150$ edges, depth $\le 2$, Rule 55).
4. **Autonomous Goal Decomposition & Topological Execution DAG:**
   - Translates high-level natural language operational directives (e.g., *"Prepare an emergency recovery campaign for inactive schools with fee arrears in Greater Accra"*) into structured, parallelized Directed Acyclic Graphs (DAGs).
   - Bounded concurrency ($\le 4$ parallel operations, Rule 9) and Knapsack context token packing ($\le 4,000$ tokens per subagent step, Rules 28 & 56).
5. **Universal Organization Mission Control Cockpit:**
   - Backoffice and Admin interactive command deck (`/admin/intelligence/organization`) with real-time SSE streaming reactivity (Rule 62) and Three-Zone layout (Rule 61).
   - Interactive Visual Delegation Tree and DAG Timeline Viewer with tactile controls adhering strictly to `theme.md` §8.

---

## 2. Honest Baseline & Pre-existing Asset Re-use (Rule 69 Strangler Fig)

Phase 13 synthesizes and orchestrates existing platform investments without mutating legacy operational records:

| Existing Platform Foundation | Location | Status | Phase 13 Orchestration Role |
| :--- | :--- | :--- | :--- |
| **Agent Persona Registry** | `src/platform/identity/agent-registry.ts` | 19 Built-in Personas | Base catalog for subagent role selection |
| **Unified Approval Store** | `src/platform/approvals/unified-approval-store.ts` | Production (Two-Phase, SHA-256) | Human-in-the-loop interceptor for supervisor proposals |
| **Domain Event Bus** | `src/platform/events/event-bus.ts` | In-memory + Outbox Worker | Transport mesh for inter-agent communication & telemetry |
| **Knowledge Graph Projection** | `src/platform/domains/knowledge_memory/` | Nodes, edges, BFS search | Foundation for Graph Reasoning & Influence Mapping |
| **CRM 360° Context Engine** | `src/platform/agents/crm/context/` | Dual-Tier CRM Aggregator | Entity context provider for supervisor research steps |
| **Revenue Swarm Orchestrator** | `src/platform/agents/sales/swarm/` | 6-stage sales pipeline | Specialized subagent swarm for pipeline missions |
| **Finance Swarm Orchestrator** | `src/platform/agents/finance/swarm/` | 5-stage finance pipeline | Specialized subagent swarm for financial missions |
| **School Operations Service** | `src/platform/agents/school/` | Attendance anomaly engine | Specialized subagent for school operational telemetry |
| **Emergency Control Plane** | `src/platform/policy/finance-control-policy.ts` | 4-switch dead-man controls | Central kill-switch integration (`supervisor_paused`) |

---

## 3. The 5 Milestones of Phase 13

```text
Phase 13: Multi-Agent Orchestration & Enterprise Organization
├── Milestone 1: Delegated Agent Identity Protocol, Security Scoping & Non-Delegable Authority Engine [COMPLETED 100%]
├── Milestone 2: Graph Reasoning, Influence Mapping & Advanced Relationship Analytics Engine [COMPLETED 100%]
├── Milestone 3: Autonomous Supervisor Agent, Goal Decomposition & Multi-Agent Planning Engine [COMPLETED 100%]
├── Milestone 4: Multi-Agent Swarm Mesh, Cooperative Cancellation & Shadow Simulation Suite [COMPLETED 100%]
└── Milestone 5: Enterprise Organization Cockpit, Delegation Tree UI, Red-Team QA & Platform Graduation [COMPLETED 100%]
```

---

### Milestone 1: Delegated Agent Identity Protocol, Security Scoping & Non-Delegable Authority Engine
**Focus:** Grounding cryptographic identity, delegation tokens, authority intersection algebra, and non-delegable action security.

- **Tasks & Deliverables:**
  1. **Canonical Delegation Contracts & Zod Schemas (`src/platform/identity/delegation/delegation-types.ts`):**
     - `DelegationTokenSchema`: Cryptographic token containing `tokenSignature` (SHA-256 over key-sorted payload), `parentRunId`, `supervisorAgentId`, `subAgentId`, `delegatedPrincipal`, `allowedScopes`, `issuedAt`, `expiresAt`, and `delegationDepth` ($\le 3$).
     - `DelegationContextSchema`: Tenant bounding (`organizationId`, `workspaceId`), actor metadata, token budget ($\le 4,000$), timeout ($\le 120$s).
     - `AuthorityIntersectionResultSchema`: Computes the mathematical intersection of scopes and explicitly strips disallowed or non-delegable permissions.
     - `NON_DELEGABLE_CAPABILITIES`: Array of string capability patterns that can never be delegated (`['auth.*', 'tenant.*', 'security.*', 'billing.transfer_ownership', 'platform_config.*']`, Rule 17).
     - Error taxonomy `DELEGATION_ERROR_CODES` with typed `AgentDelegationError` class (Rule 48).
     - Strict Rule 4 typing: zero `any` or `any[]`.
  2. **Delegated Authority Engine (`src/platform/identity/delegation/delegated-authority-service.ts`):**
     - `issueDelegationToken(params)`: Mints cryptographically bound, immutable delegation tokens with depth checks ($depth \le 3$, fails with `DELEGATION_DEPTH_EXCEEDED`).
     - `computeEffectiveAuthority(userPerms, agentPerms, workspacePerms, scope)`: Pure mathematical set intersection ($\text{User} \cap \text{Supervisor} \cap \text{Agent} \cap \text{Workspace} \cap \text{Scope}$).
     - `enforceNonDelegableGuard(requestedCapabilities)`: Strips all capabilities matching `NON_DELEGABLE_CAPABILITIES` (Rule 17).
     - `validateDelegationToken(token, context)`: Verifies SHA-256 signature, expiry, and tenant boundaries.
     - Emergency dead-man switch evaluation via `checkGovernanceDeadManSwitch` failing closed (Rule 60).
  3. **Canonical Capabilities for Delegation (`src/platform/capabilities/supervisor/delegation-capabilities.ts`):**
     - `supervisor.delegation.issue_token` (L0_READ)
     - `supervisor.delegation.validate_token` (L0_READ)
     - `supervisor.delegation.revoke_token` (L2_STATE_MUTATION)
  4. **Server Actions & Test Suites:**
     - Next.js 15 Server Actions (`src/app/actions/delegation-actions.ts`) with Clerk auth and anti-IDOR validation (Rules 8, 47, 51).
     - Dedicated Vitest test suite: `src/platform/__tests__/identity/delegated-authority.test.ts`.

---

### Milestone 2: Graph Reasoning, Influence Mapping & Advanced Relationship Analytics Engine
**Focus:** Graph intelligence, multi-hop decision-maker traversal, influence scoring, and contagion risk clustering.

- **Tasks & Deliverables:**
  1. **Graph Reasoning Contracts (`src/platform/domains/graph_reasoning/graph-reasoning-types.ts`):**
     - `GraphInfluenceScoreSchema`: Centrality score (0–100), authority weight, direct vs indirect connection counts, key decision-maker indicator.
     - `AccountContagionClusterSchema`: Root account, infected nodes, risk transmission factor, total revenue exposure.
     - `MultiHopPathReasoningSchema`: Source entity, target entity, intermediate relational hops, causal inference narrative.
     - Clamped traversal bounds: $\le 80$ nodes, $\le 150$ edges, depth $\le 2$ (Rule 55).
  2. **Graph Reasoning Engine (`src/platform/domains/graph_reasoning/graph-reasoning-service.ts`):**
     - `analyzeDecisionMakerInfluence(workspaceId, entityId)`: Calculates PageRank / degree centrality of stakeholders across historical deals and meeting transcripts.
     - `detectAccountRiskContagion(workspaceId, sourceEntityId)`: Traverses shared vendor, sibling campus, and regional network ties to calculate contagion probability.
     - Prompt injection defense: neutralizes adversarial directives in node properties and wraps raw narrative context in `<untrusted_reference_data id="...">` (Rules 13 & 30).
     - In-memory tenant caching (3-minute TTL, Rule 50) with reactive EventBus invalidation (`graph.edge.*`, `deal.*`).
  3. **Canonical Graph Reasoning Capabilities (`src/platform/capabilities/graph/graph-reasoning-capabilities.ts`):**
     - `graph.reasoning.get_influence_map` (L0_READ)
     - `graph.reasoning.detect_contagion` (L0_READ)
     - `graph.reasoning.find_causal_path` (L0_READ)
  4. **Server Actions & Test Suites:**
     - Next.js 15 Server Actions (`src/app/actions/graph-reasoning-actions.ts`).
     - Test battery: `src/platform/__tests__/graph/graph-reasoning.test.ts`.

---

### Milestone 3: Autonomous Supervisor Agent, Goal Decomposition & Multi-Agent Planning Engine
**Focus:** High-level intent classification, goal decomposition into execution DAGs, knapsack context packing, and result synthesis.

- **Tasks & Deliverables:**
  1. **Supervisor Plan Contracts (`src/platform/agents/supervisor/supervisor-types.ts`):**
     - `SupervisorGoalInputSchema`: Objective prompt, operational constraints, budget cap, priority level.
     - `ExecutionDagSchema`: Directed Acyclic Graph containing `nodes` (PlanStep), `edges` (Dependencies), and `topologicalOrder`.
     - `PlanStepSchema`: Step ID, assigned domain agent (`crm_assistant`, `lead_sdr`, `reconciliation_agent`, etc.), required capability, delegated scope, execution state (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`).
     - `SupervisorSynthesisResultSchema`: Unified executive narrative, grounded citations, consolidated risk assessment, and executable multi-agent proposals.
  2. **Supervisor Planning & Decomposition Engine (`src/platform/agents/supervisor/supervisor-planner.ts`):**
     - Intent classification & decomposition: Parses goals into sub-tasks with strict dependency resolution (cycle detection with Kahn's algorithm).
     - Knapsack token budgeting: Distributes token allocations ($\le 4,000$ per subagent step) to avoid context exhaustion (Rules 28 & 56).
     - Anti-Elevation Guard: Validates that each step's assigned capabilities are within the subagent's immutable risk ceiling.
  3. **Supervisor Orchestration Engine (`src/platform/agents/supervisor/supervisor-orchestrator.ts`):**
     - Coordinates parallel step execution with bounded batch concurrency ($\le 4$, Rule 9).
     - Mints scoped `DelegationTokens` before invoking each domain subagent.
     - Cooperative cancellation propagation via root `AbortSignal` (Rule 26).
     - Domain event publishing (`supervisor.mission.started`, `supervisor.step.completed`, `supervisor.mission.completed`).
  4. **Server Actions & Test Suites:**
     - Next.js 15 Server Actions (`src/app/actions/supervisor-actions.ts`).
     - Test battery: `src/platform/__tests__/agents/supervisor/supervisor-orchestrator.test.ts`.

---

### Milestone 4: Multi-Agent Swarm Mesh, Cooperative Cancellation & Shadow Simulation Suite (COMPLETED 100%)
**Focus:** Inter-agent communication bus, reverse-LIFO multi-agent compensation, Shadow Mode simulation, and gold-standard evaluation scenarios.

- **Tasks & Deliverables:**
  1. **Multi-Agent Swarm Mesh (`src/platform/agents/supervisor/mesh/agent-swarm-mesh.ts`):**
     - Standardized inter-agent request/response protocol (`AgentHandoffEnvelope`).
     - Dynamic context sharing: passes grounded reference data between pipeline nodes without raw prompt leakage.
     - Distributed reverse-LIFO Saga compensation: if Step 3 fails, steps 2 and 1 execute compensating capabilities in reverse order (Rule 27).
  2. **Multi-Agent Shadow Mode Runner (`src/platform/agents/supervisor/evaluation/supervisor-shadow-mode.ts`):**
     - Simulates end-to-end multi-agent execution with `dryRun: true`, producing 0 live database writes (Rule 42).
     - Aggregates multi-agent mutations into a comprehensive `MultiAgentBlastRadiusReport`.
  3. **24 Gold-Standard Multi-Agent Evaluation Scenarios (`src/platform/agents/supervisor/evaluation/supervisor-eval-dataset.ts`):**
     - 4 Cross-Domain Recovery Campaigns (Tuition default + Attendance dip + Outreach sequence).
     - 4 Multi-Campus Academic & Financial Audits.
     - 4 Lead-to-Invoice Accelerated Onboarding Workflows.
     - 4 Crisis Intervention & Churn Prevention Missions.
     - 4 High-Volume Data Hygiene & Deduping Missions.
     - 4 Dedicated Adversarial Security Attacks (Confused Deputy, Token Flooding, Depth Overflow, Cross-Tenant Probing).
  4. **Verification Battery:**
     - Test battery: `src/platform/__tests__/agents/supervisor/supervisor-mesh.test.ts`, `supervisor-shadow-mode.test.ts`, `supervisor-eval-dataset.test.ts`.

---

### Milestone 5: Enterprise Organization Cockpit, Delegation Tree UI, Red-Team QA & Platform Graduation [COMPLETED 100%]
**Focus:** Visual mission control, interactive DAG/Delegation tree, standardized modals, 6-vector adversarial red-team battery, and Senior Principal Architect sign-off.

- **Tasks & Deliverables:**
  1. **Operator UI Surfaces (`theme.md` §8 Compliant):**
     - `SupervisorMissionModal.tsx`: Goal formulation, budget parameters, and live mission launcher with single-circle info tooltip at `z-[10050]`.
     - `DelegationTreeModal.tsx`: Visual tree representation of active supervisor delegation tokens, subagent statuses, and latency meters.
     - `GraphReasoningModal.tsx`: Interactive SVG visualization of influence paths and contagion clusters.
     - `OrganizationMissionControlClient.tsx`: Three-Zone Mission Control layout (Rule 61) with real-time SSE streaming reactivity (Rule 62) via `useEventStream`.
     - Page route: `src/app/admin/intelligence/organization/page.tsx`.
  2. **Admin Sidebar Navigation Unification (Rule 69 Strangler Invariant):**
     - Mounted `/admin/intelligence/organization` under the `INTELLIGENCE` group in `AdminSidebar.tsx` with `Network` icon.
     - 100% preservation of all 52 preexisting navigation items and route permissions.
  3. **Adversarial Security Red-Team QA Battery (`src/platform/__tests__/agents/supervisor/supervisor-adversarial-red-team.test.ts`):**
     - Attack Vector 1: Confused deputy privilege escalation via subagent delegation.
     - Attack Vector 2: Delegation depth overflow ($depth > 3$).
     - Attack Vector 3: Cross-tenant IDOR propagation between supervisor and subagents.
     - Attack Vector 4: Prompt injection directive escalation in subagent output during supervisor synthesis.
     - Attack Vector 5: Tampered SHA-256 delegation token signature rejection.
     - Attack Vector 6: Emergency dead-man kill switch (`supervisor_paused`) instant halting.
  4. **Senior Principal Architect Review & Sign-Off:**
     - Formal architectural code review dispatched to subagent.
     - Production-readiness audit, completion report, and local git commit.

---

## 4. The 7 Mandatory Domain Agent Deliverables Gate (Rules 1940–1953)

To conform to lines 1940–1953 of `agents_mcp_rules.md`, Phase 13 provides all 7 required components for the Supervisor and Delegated Multi-Agent Swarm:

1. **Shadow Mode (`supervisor-shadow-mode.ts`):** Zero-write dry-run simulator producing complete multi-agent blast radius reports (Rule 42).
2. **Evaluation Dataset (`supervisor-eval-dataset.ts`):** 24 gold-standard scenarios across 6 categories (Recovery, Audits, Onboarding, Crisis, Hygiene, Security).
3. **Permission Matrix (`SUPERVISOR_PERMISSION_MATRIX`):** Explicit non-wildcard RBAC per delegated persona with authority intersection algebra (Rule 16).
4. **Tool Matrix (`SUPERVISOR_TOOL_MATRIX`):** Canonical inventory of all capabilities routable by the supervisor with immutable risk levels (Rule 12).
5. **Failure Matrix (`SUPERVISOR_FAILURE_MATRIX`):** Deterministic handling for cycle errors, deadlocks, subagent timeouts, and partial plan failures (Rule 48).
6. **Security Tests (`supervisor-adversarial-red-team.test.ts`):** 6-vector red-team test battery covering confused deputy, depth overflow, IDOR, and injection.
7. **Rollback Plan (`SUPERVISOR_ROLLBACK_MATRIX`):** Reverse-LIFO Saga compensation mapping for every multi-agent state mutation (Rule 27).

---

## 5. The Rule 67 "Agent Implementation Gate"

| Category | Compliance Guarantee | Architectural Evidence |
| :--- | :--- | :--- |
| **Architecture** | Uses canonical capabilities; zero duplication of underlying CRM/Finance services; Firestore is source of truth. | CapabilityRegistry routing; events published on `defaultEventBus`. |
| **Authority** | Governed by Authority Intersection Algebra ($\text{User} \cap \text{Supervisor} \cap \text{Agent} \cap \text{Workspace}$). Subagents cannot inherit admin or non-delegable permissions. | `DelegatedAuthorityService.computeEffectiveAuthority()`. |
| **Data** | Untrusted data from subagents wrapped in `<untrusted_reference_data id="...">`. PII / secrets redacted. | Regex injection scanner (`ADVERSARIAL_DIRECTIVE_PATTERNS`). |
| **Execution** | Idempotency keys (`sup_mission_${orgId}_${hash}`), cooperative `AbortSignal` cancellation, TOCTOU version checking. | Deterministic hash binding; root `AbortSignal` cascade. |
| **MCP** | Protocol revision 2026-07-28 compliant; client/server identity separation; tool fingerprints. | Structured capability definitions in `CapabilityRegistry`. |
| **Failure** | Exponential backoff with jitter on 429; circuit breaker fail-closed; fallback to safe partial synthesis. | `SUPERVISOR_FAILURE_MATRIX`. |
| **Security** | Neutralizes prompt injection, SSRF, confused deputy, and cross-tenant IDOR. | `assertTenantContext` + `validateDelegationToken`. |
| **Operations** | Zero-redeploy dead-man switch (`supervisor_paused`); audit logs $\ge 5$ chars. | `FinanceControlPolicy` / `platform_config/supervisor_controls`. |
| **Testing** | 100% Vitest coverage: Unit, Integration, Contract, E2E, Chaos, Adversarial Red-Team. | 5 dedicated Phase 13 test suites. |
| **Migration** | Strangler Fig preservation: 100% preservation of all 52 preexisting routes and permissions in `AdminSidebar.tsx`. | Accordion regression test suite. |

---

## 6. The Rule 68 Five Non-Negotiables

1. **The Model is Never the Security Boundary:** Authority intersection and non-delegable guards are implemented in deterministic TypeScript code before any model invocation.
2. **Tool & Subagent Output is Untrusted Data:** Output from subagents is sanitized, scanned for prompt injections, and isolated in XML containers.
3. **Every Mutation is Idempotent, Authorized, Version-Checked and Auditable:** Multi-agent proposals route through `ApprovalStore` with SHA-256 payloadHash.
4. **Bounded Authority & Bounded Resources:** Concurrency $\le 4$, delegation depth $\le 3$, token budget $\le 4,000$ per subagent step.
5. **Operable Without Code:** Backoffice emergency dead-man controls pause supervisor operations without code redeployment.

---

## 7. Master 69-Rules Compliance Matrix

| Rule # | Requirement | Phase 13 Implementation Standard | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Rule 4** | Zero `any` / Zero `any[]` | 100% strict TypeScript types across all schemas, contracts, and components. | Static typecheck & Lint |
| **Rule 7** | Mobile-First & Touch Targets | Minimum 44px touch targets (`min-h-[44px]`), tactile buttons (`active:scale-[0.97]`). | Vitest UI component tests |
| **Rule 8 & 47** | Multi-Tenant Anti-IDOR | `assertTenantContext` and `requireAuth` boundary validation across all supervisor actions. | Unit & Red-Team tests |
| **Rule 9 & 23** | Bounded Resources & Concurrency | Supervisor batch concurrency $\le 4$, subagent duration $\le 120$s, delegation depth $\le 3$. | Runtime bounds tests |
| **Rule 13 & 30** | Untrusted Data Isolation | `<untrusted_reference_data>` containerization for subagent notes, prompt injection neutralization. | Adversarial Red-Team tests |
| **Rule 16** | Least Privilege & Explicit Scopes | Explicit non-wildcard RBAC per delegated token; authority intersection algebra. | Delegation unit tests |
| **Rule 17** | Non-Delegable Privileges | Mandatory stripping of L4 / administrative capabilities from delegation tokens. | Security guard tests |
| **Rule 19** | Deterministic Idempotency Keys | Key derivation: `sup_mission_${orgId}_${hash}` and `sup_step_${runId}_${stepId}`. | Idempotency replay tests |
| **Rule 21 & 22** | Two-Phase Approval Binding | Mutating supervisor plans route to `ApprovalStore` with key-sorted SHA-256 `payloadHash`. | Cryptographic tamper tests |
| **Rule 26** | Cooperative Cancellation | Root `AbortSignal` checks before every DAG step execution. | Cancellation tests |
| **Rule 27** | Reverse-LIFO Saga Rollback | Compensating capabilities mapped in `SUPERVISOR_ROLLBACK_MATRIX`. | Saga failure recovery tests |
| **Rule 28 & 56** | Knapsack Context Budgeting | Stratified token budgeting packing prompt context $\le 4,000$ tokens per subagent step. | Token budget overflow tests |
| **Rule 40** | Domain Event Publishing | Emits `supervisor.*`, `delegation.*`, and `mesh.*` via `defaultEventBus`. | EventBus subscriber tests |
| **Rule 42** | Shadow Mode Simulation | `dryRun: true` produces 0 live database writes with `MultiAgentBlastRadiusReport`. | Shadow Mode tests |
| **Rule 55** | Clamped Graph Traversals | Hard bounds: nodes $\le 80$, edges $\le 150$, depth $\le 2$. | Graph query tests |
| **Rule 60** | Emergency Dead-Man Switch | Fail-closed dead-man switch evaluation (`supervisor_paused`) with 10s TTL cache. | Kill-switch tests |
| **Rule 61** | Operational Control & Audit | Mandatory audit justification notes $\ge 5$ characters. Three-zone mission control. | Policy & UI tests |
| **Rule 62** | Real-Time SSE Reactivity | `useEventStream` subscribing to `supervisor.*` domain events. | Reactivity tests |
| **Rule 69** | Strangler Fig Invariant | Preserves 100% of preexisting 52 routes and permissions in `AdminSidebar.tsx`. | Accordion regression test |
| **theme.md §8** | Standardized Modal System | Demarcated header/footer, single-circle info tooltip at `z-[10050]`, sr-only description. | Visual DOM layout tests |

---

## 8. Implementation Notice

> [!IMPORTANT]
> **Implementation of Phase 13 is strictly BLOCKED until this Master Implementation Plan is formally reviewed and approved by the user.**  
> No code changes or milestone executions will commence without explicit user authorization.
