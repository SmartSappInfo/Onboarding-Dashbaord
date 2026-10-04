# Phase 7 Milestone 5 Implementation Plan (Updated with 69 Rules)
## MCP Tasks Protocol Extension (Spec 2026-07-28), Deterministic Templates, The Critical Distinction Bridge & Operator Workflow Mission Control (/admin/workflows)
### Fully Aligned with `agents_mcp_rules.md` (Rules 1–69), Cloud Run Architecture & `theme.md` §8

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Platform:** SmartSapp Enterprise Agentic Workflow Platform  
**Phase:** Phase 7 — Durable Agentic Workflow Engine, Distributed Leases & Resilient Execution  
**Milestone:** Milestone 5 — MCP Tasks Protocol Extension (Spec 2026-07-28), Deterministic Templates, The Critical Distinction Bridge & Operator Workflow Mission Control  
**Version:** 2.1.0 (Comprehensive 69-Rules Alignment & Standardized Modal Architecture SSOT)  
**Status:** APPROVED & READY FOR IMPLEMENTATION  
**Authors:** Senior Principal Systems & AI Agentic Architecture Engineer  

---

## 1. Executive Summary & Architectural Invariants (Rule 68 & Rule 69)

Phase 7 Milestone 5 delivers the capstone integration of the SmartSapp Durable Workflow Engine, connecting external systems, autonomous AI agents, legacy automations, and human operators into a cohesive, production-grade orchestration platform.

### 1.1 The Governed Capability Invariant (Rule 69)
The workflow system does not sit as an isolated layer beside SmartSapp. It operates as part of the unified platform capability layer:
```
                      EXTERNAL CLIENTS / AGENTS / USERS
                                      │
                         MCP TASKS PROTOCOL GATEWAY
                         (Spec 2026-07-28 / Streamable HTTP)
                                      │
                         ┌────────────▼────────────┐
                         │     TRUST BOUNDARY      │
                         │   Anti-IDOR & Secrets   │
                         └────────────┬────────────┘
                                      │
                         THE CRITICAL DISTINCTION BRIDGE
                         (Agent-to-Workflow Adapter)
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                  Workflow Templates WorkflowStore Cloud Tasks
                  (Kahn's Sort DAGs) (Checkpoints) (Dispatches)
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  UniversalEventBus         Operator Console
                  (Audit & SSE Stream)      (/admin/workflows)
```

### 1.2 The Five Non-Negotiable Invariants (Rule 68)
1. **Identity is not the user (Rule 16):** Workflows and MCP Tasks execute under authenticated `AgentPrincipal` or verified operator identities. Wildcard (`*`) scopes are strictly prohibited.
2. **Never trust the model (Rule 47):** When autonomous agents trigger workflow templates, model-generated parameters are strictly validated via Zod v4 schemas (`InstantiateTemplateInputSchema`) before workflow instantiation.
3. **Never trust the tool or external client (Rule 48):** External inputs from MCP `tasks/create` or webhook signals are treated as untrusted and containerized inside `<untrusted_reference_data id="...">` (Rule 13 & 30).
4. **High-risk actions require two phases (Rules 21 & 22):** Workflow steps containing high-risk mutations (L3/L4) or non-delegable actions automatically suspend into `WAITING` (approval), binding a canonical SHA-256 `payloadHash`.
5. **Everything must be cancellable and budget-bound (Rules 23 & 26):** External clients can invoke `tasks/cancel` and operators can click "Cancel Workflow" to initiate cooperative cancellation via native `AbortSignal`, revoking Cloud Tasks and executing reverse-LIFO Saga compensations (Rule 27).

---

## 2. Complete 69-Rules Alignment & Enforcement Matrix for Milestone 5

| Rule # | Requirement | Milestone 5 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, and `backend-design`. All preexisting features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Serverless Cloud Run constraints: 300s HTTP timeout decoupling via Cloud Tasks, 32MB payload ceiling, container SIGTERM handling, SSE disconnection auto-reconnect. |
| **Rule 3** | Backoffice as Agent Control Plane | Dedicated `/admin/workflows` operator mission control allowing operators to inspect runs, view DAGs, resume waiting steps, drain DLQ, and cancel workflows without editing code. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Absolute strict typing. `unknown` permitted only at external JSON-RPC boundaries, immediately narrowed via Zod v4 schemas (`McpTaskCreateInputSchema`, `WorkflowTemplateDefinitionSchema`). |
| **Rule 5** | Staged Deployment & Security Verification | All compound Firestore indexes for `workflows` and `workflow_dlq` verified. Server actions and API routes rigorously tested. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `@google-cloud/tasks`, `@modelcontextprotocol/server`, Zod v4 (`zod/v4`), and Lucide React. Context7 MCP used for library references. |
| **Rule 7** | Mobile-First & Plain UI English | All inputs, buttons, and drawer tabs have `min-h-[44px]` touch targets. UI language uses minimal, clear, non-jargon English ("Processing", "Waiting for approval", "Completed"). |
| **Rule 8 & 47** | Multi-Tenancy & Anti-IDOR Perimeter | Every workflow instance, step, checkpoint, template instantiation, and task lookup immutably binds `organizationId` and `workspaceId`. Rejects mismatched session tenants with `IDOR_VIOLATION`. |
| **Rule 9** | High Load & Resource Exhaustion Defense | List queries clamped between 1 and 100. DAG visualizer bounded to $\le 50$ nodes (Rule 55). Payload size checked against Cloud Run 32MB ceiling. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` detailing state transitions, JSON-RPC schemas, and testability pointers. |
| **Rule 11 & 38** | MCP Spec 2026-07-28 & Tasks Protocol | Formally implements the MCP Tasks draft specification (`tasks/create`, `tasks/get`, `tasks/list`, `tasks/cancel`, `tasks/result`) over Streamable HTTP. No deprecated features (Roots, Sampling, legacy SSE). |
| **Rule 12** | No MCP Annotations as Security Controls | All task operations verify permissions server-side via `evaluatePrincipalAuthority` independently of MCP metadata. |
| **Rule 13 & 30** | Model Distrust & Untrusted Data Containers | Untrusted task inputs and webhook payloads are encapsulated in `<untrusted_reference_data id="...">` containers before entering agent context. |
| **Rule 14** | Tool Fingerprinting & Drift Defense | Capabilities referenced in workflow templates have their composite SHA-256 fingerprints verified via `ToolFingerprintService`. |
| **Rule 15** | Server Allowlisting | External capabilities executed by workflows must be registered in `ServerAllowlistService` in `approved`, `connected`, or `monitored` states. |
| **Rule 16** | Agent Identity as Security Principal | Workflows execute under authenticated `AgentPrincipal` with minted ephemeral session tokens. Wildcard (`*`) scopes are strictly prohibited. |
| **Rule 17** | Non-Delegable Actions | Steps requiring non-delegable permissions cannot be executed autonomously by agents; they must suspend into `WAITING` (approval) state. |
| **Rule 18** | TOCTOU Live Principal / Delegation Check | Prior to executing resumed steps, the runner validates live principal authority and delegation status in Firestore. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Every step in a workflow template computes a deterministic `idempotencyKey` derived from `workflowId`, `stepId`, `attempt`, and input hash. |
| **Rule 20 & 39** | OpenTelemetry & Distributed Tracing | Propagates `x-smartsapp-correlation-id`, `mcp-transaction-id`, `workflowId`, and `taskId` across all Cloud Tasks headers, execution steps, and audit events. |
| **Rule 21 & 22** | Two-Phase Actions & Cryptographic Binding | High-risk workflow steps suspend to `WAITING` (approval), binding a canonical SHA-256 `payloadHash` displayed in the approval drawer. |
| **Rule 23** | Resource Ceilings & Budgets | Hard limits on workflow step counts ($\le 30$), retry attempts ($\le 5$), and overall execution duration ($\le 7$ days). |
| **Rule 24** | 5-State Circuit Breakers | External capability calls route through `WorkflowCircuitBreakerManager` (`healthy` $\to$ `degraded` $\to$ `open` $\to$ `half_open` $\to$ `recovered`). |
| **Rule 25** | Dead-Letter Queues (DLQ) | Poisoned or retry-exhausted steps route to `WorkflowDlqService` with sanitized error messages. |
| **Rule 26** | True Cancellation Semantics | `tasks/cancel` and `cancelWorkflowInstanceAction` cooperative abort marks pending steps `SKIPPED`, revokes leases, and unwinds compensating Sagas. |
| **Rule 27** | Formal Saga Model | Inverse compensating capabilities execute in strict reverse order (LIFO) upon terminal failure or cancellation. |
| **Rule 28 & 56** | Context Budgeting | Task input and output payloads are bounded to prevent memory bloat and context exhaustion. |
| **Rule 31** | Post-Condition Verification | Template steps undergo post-condition schema validation before marking `COMPLETED`. |
| **Rule 32 & 48** | Error Sanitization & Non-Backtracking RegEx | Sanitizes error messages, redacting credentials (`[REDACTED_SECRET:<type>]`) before returning in `tasks/result` or persisting to DLQ. |
| **Rule 33 & 34** | Cloud Tasks Handshake & SSRF Guard | Task callbacks verify Cloud Tasks HMAC and Google OIDC Bearer tokens. External URLs validated via `validateSafeEgressUrl`. |
| **Rule 40** | Immutable Domain Events & Hashing | Emits `workflow.*` and `mcp.task.*` events with SHA-256 hash chaining to the immutable audit store. |
| **Rule 41** | "Why Did You Do This?" View | Workflow drawer displays full execution provenance, wait condition triggers, and audit checkpoints. |
| **Rule 42** | Shadow Mode / Dry-Run | Templates support `dryRun: true` parameter simulation without committing live database writes. |
| **Rule 43 & 44** | Replayable Runs & Simulation | Checkpoint ledger enables deterministic reconstruction of workflow execution trajectories. |
| **Rule 45 & 46** | Chaos & Adversarial Testing | Test suites verify prompt injection defense, cross-tenant isolation, and circuit trip behaviors. |
| **Rule 51** | Server Actions Security | Workflow admin server actions enforce Clerk `requireAuth()`, Anti-IDOR validation, and dead-man pause evaluation. |
| **Rule 54** | Performance Budgets | Task creation latency $\le 50\text{ms}$; status lookup $\le 20\text{ms}$; drawer load $\le 100\text{ms}$. |
| **Rule 55** | Graph Resource Limits | DAG visualizer bounded to $\le 50$ nodes to protect browser DOM performance. |
| **Rule 58** | Model Routing Policy | Low-latency workflow classification routes to Flash; complex exception handling and replanning route to Pro. |
| **Rule 59** | Tool Selection Evaluation | Validates candidate capabilities against workflow definition requirements and agent persona permissions. |
| **Rule 60** | Emergency Dead-Man Controls | `tasks/create` and workflow mutations evaluate `checkGovernanceDeadManSwitch`; fails closed with HTTP 503 / `DEAD_MAN_PAUSED`. |
| **Rule 61** | Backoffice Surface Isolation | `/admin/workflows` route and server actions strictly enforce `APP_SURFACE=backoffice`. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Operator console consumes live SSE event stream (`/api/events/stream`) via `useEventStream` for zero-polling real-time updates. |
| **Rule 63** | Agent Incident Management | Operators can pause workflows globally, abort specific instances, retry failed steps, and drain DLQ queues from the UI. |
| **Rule 64** | Feature Flags at Three Levels | Workflow features gated at System, Organization, and Workspace levels. |
| **Rule 67** | The 12-Point Implementation Gate | Verified across all 12 pre-flight requirements. |
| **Rule 68** | The Five Non-Negotiable Invariants | Strictly maintained: identity != user; model distrust; tool distrust; two-phase high-risk; cancellable & budget-bound. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preexisting automations and call centre triggers wrap new workflow capabilities without regressions. |
| **Modal SSOT** | Standardized Modal Architecture (`theme.md` §8) | Demarcated header, single-circle info tooltip at `z-[10050]`, zero raw description clutter, accessible `sr-only` description, demarcated footer with tactile feedback. |

---

## 3. Failure Mode & Edge Case Analysis (Rule 2)

| Potential Failure Mode | Root Cause | Architectural Defense & Mitigation |
| :--- | :--- | :--- |
| **1. Oversized MCP Task Payload** | External client sends massive payload exceeding Cloud Run 32MB limit. | **Payload Size Clamping**: Handler checks `content-length` header and raw body buffer. Fails fast with HTTP 413 `PAYLOAD_TOO_LARGE` before JSON parsing. |
| **2. Cross-Tenant Task Snooping (IDOR)** | Client with Tenant A API key queries `tasks/get` with Tenant B's `taskId`. | **Immutable Tenant Perimeter**: Lookups query `/organizations/{orgId}/workflows/{workflowId}`. Mismatched tenant IDs trigger immediate `IDOR_VIOLATION` (HTTP 403). |
| **3. Circular Template Dependencies** | User or template author defines mutually dependent steps ($A \to B \to A$). | **Kahn's Topological Sort Gate**: `validateTemplateDag` runs at registration time. Detects cycles and self-dependencies, rejecting template definition with `TEMPLATE_DAG_CYCLE_DETECTED`. |
| **4. Fingerprint Drift on Template Steps** | Capability implementation changes after template registration. | **Runtime Drift Verification**: Step runner verifies composite SHA-256 fingerprint (`ToolFingerprintService`) before dispatching capability. Unapproved drift trips circuit breaker and halts step. |
| **5. Dead-Man Switch Tripped During Task Creation** | Operator activates emergency kill-switch while external tasks are arriving. | **HTTP 503 Return**: Endpoint evaluates `checkGovernanceDeadManSwitch`. Returns HTTP 503 so clients automatically back off without corrupting state. |
| **6. Stale Authority on Task Resumption (TOCTOU)** | Operator removes agent permissions while workflow is suspended awaiting webhook. | **Live Firestore Authority Re-Check**: Runner fetches live principal grants from Firestore immediately before executing resumed capability. Denied access transitions step to `FAILED`. |
| **7. Large Graph Visualizer DOM Bloat** | Workflow has many steps, causing SVG render performance issues on mobile. | **Bounded Graph Limits (Rule 55)**: Visualizer caps rendering at $\le 50$ nodes with SVG viewport virtualization and smooth CSS transitions. |
| **8. Double Cancellation Race Condition** | Operator and external client simultaneously submit cancel requests. | **Atomic Cancellation State**: State machine transition `RUNNING -> CANCELLED` is atomic via Firestore transaction. Subsequent cancel requests return cached cancellation record safely. |

---

## 4. Backoffice Impact & Non-Breaking Enhancement (Rule 3 & Rule 69)

### 4.1 Affected Backoffice Surfaces
- **`/admin/workflows`**: The central operator mission control for workflows. Displays KPI metric cards, status filters, live instance stream with real-time SSE reactivity, and click-to-open detail drawer.
- **`/admin/workflows/LaunchTemplateModal`**: Modal adhering to `theme.md` §8 allowing operators to manually instantiate pre-built templates (`LeadOnboarding`, `DealReview`, `MeetingFollowUp`) with validated inputs.
- **`/admin/approvals`**: Workflows requiring human sign-off automatically link to Phase 3 approval proposals, enabling seamless operator triage.

### 4.2 Non-Breaking Guarantee (Rule 69)
- Preexisting call centre campaigns, automations (`src/lib/services/automation-service.ts`), and Phase 6 agent runs continue operating 100% uninterrupted.
- Modern workflow capabilities wrap legacy services via the Strangler Fig bridge, preserving all legacy routes and tests.

---

## 5. File Structure & Responsibilities

```
src/platform/
├── mcp/
│   └── tasks/
│       ├── mcp-tasks-types.ts                 # Canonical Zod v4 schemas for Spec 2026-07-28 tasks protocol & error taxonomy
│       ├── mcp-tasks-handler.ts               # Streamable HTTP JSON-RPC 2.0 router (create, get, list, cancel, result)
│       └── index.ts                           # Public barrel export
├── workflows/
│   ├── templates/
│   │   ├── workflow-template-types.ts         # Template definition schemas, Kahn's algorithm DAG validator
│   │   ├── lead-onboarding-template.ts        # Lead onboarding 5-step business workflow template
│   │   ├── deal-review-template.ts            # Deal review 4-step workflow template with VP approval gate
│   │   ├── meeting-followup-template.ts       # Meeting transcript recap 4-step workflow template
│   │   ├── workflow-template-registry.ts      # Template registry singleton and instantiation compiler
│   │   └── index.ts                           # Public barrel export
│   └── bridge/
│       ├── agent-workflow-bridge.ts           # The Critical Distinction: Registers templates as Agent capabilities
│       ├── legacy-workflow-bridge.ts          # Strangler Fig wrapper over legacy automation services
│       └── index.ts                           # Public barrel export
src/app/
├── api/mcp/v2/tasks/
│   └── route.ts                               # Streamable HTTP route for MCP Tasks Protocol (Spec 2026-07-28)
├── actions/
│   └── workflow-admin-actions.ts              # Next.js Server Actions ('use server') for operator mission control
└── admin/workflows/
    ├── page.tsx                               # Server route component (surface isolation guard, SEO, Suspense)
    └── WorkflowsClient.tsx                    # Client Three-Zone mission control with SSE reactivity via useEventStream
src/components/workflows/
├── WorkflowMetricsCards.tsx                   # 4 Executive KPI cards with glowing health indicators
├── WorkflowDeadManBanner.tsx                  # High-visibility emergency kill-switch pause banner
├── WorkflowFilterToolbar.tsx                  # Debounced search (300ms), status filter pills, template launch trigger
├── WorkflowInstancesTable.tsx                 # Multi-column paged instance table with duration, progress, inspect trigger
├── WorkflowDagVisualizer.tsx                  # Interactive SVG DAG topology visualizer bounded to <= 50 nodes (Rule 55)
├── LaunchTemplateModal.tsx                    # Template launch modal adhering strictly to theme.md §8
└── WorkflowDetailDrawer.tsx                   # Standardized detail drawer adhering strictly to theme.md §8
```

---

## 6. Step-by-Step Implementation Tasks

### Task 1: MCP Tasks Protocol Extension (Spec 2026-07-28)
**Files to create/modify:**
- Create: `src/platform/mcp/tasks/mcp-tasks-types.ts`
- Create: `src/platform/mcp/tasks/mcp-tasks-handler.ts`
- Create: `src/platform/mcp/tasks/index.ts`
- Create: `src/app/api/mcp/v2/tasks/route.ts`
- Test: `src/platform/__tests__/mcp/mcp-tasks-protocol.test.ts`

- [ ] **Step 1: Write failing tests for MCP Tasks Protocol types, schemas, and error taxonomy**
  - Test `TaskCreateInputSchema`, `TaskGetResultSchema`, `TaskListInputSchema`, `TaskCancelInputSchema`, `TaskResultResponseSchema`.
  - Verify error taxonomy `MCP_TASKS_ERROR_CODES` and typed `McpTasksError`.
  - Verify Zod v4 parsing and strict typing (zero `any`).

- [ ] **Step 2: Implement `src/platform/mcp/tasks/mcp-tasks-types.ts`**
  - Full TypeScript types and Zod v4 schemas for `tasks/create`, `tasks/get`, `tasks/list`, `tasks/cancel`, `tasks/result`.
  - Task status mapping: `working`, `suspended`, `completed`, `failed`, `cancelled`.
  - Error codes: `TASK_NOT_FOUND`, `INVALID_TASK_STATE`, `TASK_ALREADY_CANCELLED`, `TASK_CREATION_FAILED`, `DEAD_MAN_PAUSED`, `IDOR_VIOLATION`.

- [ ] **Step 3: Implement `src/platform/mcp/tasks/mcp-tasks-handler.ts`**
  - Expose `McpTasksHandler` class with methods `handleCreateTask`, `handleGetTask`, `handleListTasks`, `handleCancelTask`, `handleGetTaskResult`.
  - Integrate `McpAuthGateway` for tenant verification (`organizationId`, `workspaceId`).
  - Integrate Rule 60 `checkGovernanceDeadManSwitch` failing closed with HTTP 503.
  - Integrate `WorkflowStore`, `CloudTasksWorkflowDispatcher`, and `WorkflowCancellationEngine`.
  - Emit `mcp.task.*` domain events via `defaultEventBus`.

- [ ] **Step 4: Implement Route Handler `src/app/api/mcp/v2/tasks/route.ts`**
  - Streamable HTTP POST and OPTIONS route handler conforming to Protocol Spec 2026-07-28.
  - Enforce Cloud Run 32MB payload ceiling (Rule 9).
  - Extract and validate `mcp-transaction-id`, `x-smartsapp-correlation-id`, `organizationId`, `workspaceId`.
  - Authenticate via `authenticateMcpRequest` (Clerk session or API key).

- [ ] **Step 5: Run tests and verify 100% pass**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-tasks-protocol.test.ts`
  - Expected: PASS.

---

### Task 2: Deterministic Business Workflow Templates
**Files to create/modify:**
- Create: `src/platform/workflows/templates/workflow-template-types.ts`
- Create: `src/platform/workflows/templates/lead-onboarding-template.ts`
- Create: `src/platform/workflows/templates/deal-review-template.ts`
- Create: `src/platform/workflows/templates/meeting-followup-template.ts`
- Create: `src/platform/workflows/templates/workflow-template-registry.ts`
- Create: `src/platform/workflows/templates/index.ts`
- Test: `src/platform/__tests__/workflows/workflow-templates.test.ts`

- [ ] **Step 1: Write failing tests for Workflow Templates**
  - Test DAG acyclicity validation using Kahn's algorithm (`validateTemplateDag`).
  - Test parameter validation and missing required input detection.
  - Test instantiation of `LeadOnboardingWorkflow`, `DealReviewWorkflow`, `MeetingFollowUpWorkflow`.
  - Verify compiled step definitions, dependencies, and wait conditions.

- [ ] **Step 2: Implement `src/platform/workflows/templates/workflow-template-types.ts`**
  - Zod v4 schemas: `WorkflowTemplateDefinitionSchema`, `WorkflowStepTemplateSchema`, `InstantiateTemplateInputSchema`.
  - Kahn's algorithm implementation `validateTemplateDag` guaranteeing zero cycles, self-dependencies, or dangling dependencies (Rule 47).
  - Bounded step limits: $\le 30$ steps per template.

- [ ] **Step 3: Implement Pre-Built Enterprise Templates**
  - `lead-onboarding-template.ts`: 5 steps (create contact, qualify lead, send welcome email, wait 3 days, schedule SDR call).
  - `deal-review-template.ts`: 4 steps (get deal, evaluate discount, wait for VP approval if > 20%, send notification).
  - `meeting-followup-template.ts`: 4 steps (get transcript, save episodic memory, create CRM note, send attendee recap).

- [ ] **Step 4: Implement `src/platform/workflows/templates/workflow-template-registry.ts`**
  - Template registry singleton `getWorkflowTemplateRegistry()`.
  - Methods: `registerTemplate`, `getTemplate`, `listTemplates`, `instantiateTemplate`.
  - `instantiateTemplate` compiles template + inputs into `CreateWorkflowInstanceInput` and `CreateWorkflowStepInput[]`, saving them atomically in `WorkflowStore` and queuing Step 0 via `CloudTasksWorkflowDispatcher`.

- [ ] **Step 5: Run tests and verify 100% pass**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-templates.test.ts`
  - Expected: PASS.

---

### Task 3: The Critical Distinction Bridge (Agent-to-Workflow Adapter) & Legacy Bridge
**Files to create/modify:**
- Create: `src/platform/workflows/bridge/agent-workflow-bridge.ts`
- Create: `src/platform/workflows/bridge/legacy-workflow-bridge.ts`
- Create: `src/platform/workflows/bridge/index.ts`
- Test: `src/platform/__tests__/workflows/agent-workflow-bridge.test.ts`
- Test: `src/platform/__tests__/workflows/legacy-workflow-bridge.test.ts`

- [ ] **Step 1: Write failing tests for Agent-to-Workflow Bridge**
  - Test capability registration for workflow operations (`workflow.instantiate_template`, `workflow.get_instance_status`, `workflow.cancel_instance`).
  - Test autonomous agent invoking `workflow.instantiate_template` with valid inputs and getting workflow ID back.
  - Test agent polling `workflow.get_instance_status` and getting current state without running steps directly.
  - Test legacy automations bridge translating legacy configs into workflows with zero regressions (Rule 69).

- [ ] **Step 2: Implement `src/platform/workflows/bridge/agent-workflow-bridge.ts`**
  - Enforce architectural distinction: Agents plan goals; Workflows execute state machines.
  - Register canonical capabilities in `CapabilityRegistry`:
    - `workflow.instantiate_template`: Risk level `L2_STATE_MUTATION`.
    - `workflow.get_instance_status`: Risk level `L0_READ`.
    - `workflow.cancel_instance`: Risk level `L3_EXTERNAL_COMMUNICATION_FINANCE` (requires human approval if agent caller, Rule 17 & 21).
  - Generate dynamic input schemas based on registered templates.

- [ ] **Step 3: Implement `src/platform/workflows/bridge/legacy-workflow-bridge.ts`**
  - Adapts legacy automations service (`src/lib/services/automation-service.ts`) into durable workflows.
  - Safely falls back to legacy execution when feature flag is disabled.

- [ ] **Step 4: Run bridge tests and verify 100% pass**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/agent-workflow-bridge.test.ts src/platform/__tests__/workflows/legacy-workflow-bridge.test.ts`
  - Expected: PASS.

---

### Task 4: Operator Server Actions & Admin Mission Control Page
**Files to create/modify:**
- Create: `src/app/actions/workflow-admin-actions.ts`
- Create: `src/app/admin/workflows/page.tsx`
- Create: `src/app/admin/workflows/WorkflowsClient.tsx`
- Test: `src/platform/__tests__/workflows/workflow-admin-actions.test.ts`

- [ ] **Step 1: Write failing tests for Operator Server Actions**
  - Test `listWorkflowsAction`: pagination, status filters, tenant isolation (Rule 8 & 47).
  - Test `getWorkflowDetailsAction`: full details including steps, checkpoints, wait conditions, DLQ entries.
  - Test `pauseWorkflowInstanceAction` & `resumeWorkflowInstanceAction`.
  - Test `cancelWorkflowInstanceAction`: triggers cancellation token and Saga rollback (Rule 26 & 27).
  - Test `getWorkflowPlatformMetricsAction`: 4 KPI counts.
  - Test `instantiateWorkflowTemplateAction`: operator-triggered template execution.
  - Test Rule 60 dead-man switch rejection and Anti-IDOR validation.

- [ ] **Step 2: Implement `src/app/actions/workflow-admin-actions.ts`**
  - Next.js Server Actions convention (`'use server'`) (Rule 51).
  - Session authentication via `requireAuth()` (`uid`, `profile.organizationId`).
  - Strict Anti-IDOR tenant lock cross-validating session tenant against parameters.
  - Dead-man pause evaluation (`checkGovernanceDeadManSwitch`) blocking mutations.
  - Backoffice surface check (`isBackofficeSurface()`) (Rule 61).

- [ ] **Step 3: Implement `src/app/admin/workflows/page.tsx` & `WorkflowsClient.tsx`**
  - Server route `page.tsx` with SEO metadata, surface isolation guard (Rule 61), and Suspense boundary.
  - Client component `WorkflowsClient.tsx` implementing Three-Zone operator mission control layout:
    - Zone 1: Executive KPI Metrics Cards.
    - Zone 2: Filter Toolbar (search, status pills, definition selector, template launch trigger).
    - Zone 3: Workflow Instances Table with live SSE updates via `useEventStream` (Rule 62).

- [ ] **Step 4: Run server actions tests and verify 100% pass**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-admin-actions.test.ts`
  - Expected: PASS.

---

### Task 5: Operator Mission Control UI Components & Standardized Detail Drawer (`theme.md` §8)
**Files to create/modify:**
- Create: `src/components/workflows/WorkflowMetricsCards.tsx`
- Create: `src/components/workflows/WorkflowDeadManBanner.tsx`
- Create: `src/components/workflows/WorkflowFilterToolbar.tsx`
- Create: `src/components/workflows/WorkflowInstancesTable.tsx`
- Create: `src/components/workflows/WorkflowDagVisualizer.tsx`
- Create: `src/components/workflows/LaunchTemplateModal.tsx`
- Create: `src/components/workflows/WorkflowDetailDrawer.tsx`
- Test: `src/platform/__tests__/ui/workflow-mission-control.test.tsx`

- [ ] **Step 1: Write failing UI tests**
  - Test `WorkflowMetricsCards` rendering 4 KPI cards with health status indicators.
  - Test `WorkflowDeadManBanner` rendering emergency banner and modal adherence to `theme.md` §8.
  - Test `WorkflowInstancesTable` rendering rows, status chips, duration, and inspect click handler.
  - Test `WorkflowDagVisualizer` rendering SVG graph bounded to $\le 50$ nodes (Rule 55).
  - Test `WorkflowDetailDrawer` strict compliance with `theme.md` §8:
    * Surface geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
    * Demarcated header (`<DialogHeader demarcated>`).
    * Single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`.
    * Accessible screen reader support (`<DialogDescription className="sr-only">`).
    * Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`).
    * 4 tabbed panels: `DAG Topology`, `Execution Timeline`, `Checkpoints & State`, `Wait Conditions & Tokens`.
    * Touch targets $\ge 44\text{px}$ (Rule 7).
  - Test `LaunchTemplateModal` strict compliance with `theme.md` §8.

- [ ] **Step 2: Implement UI Components**
  - Build `WorkflowMetricsCards.tsx`, `WorkflowDeadManBanner.tsx`, `WorkflowFilterToolbar.tsx`, `WorkflowInstancesTable.tsx`, `WorkflowDagVisualizer.tsx`, and `LaunchTemplateModal.tsx`.
  - Ensure zero raw HTML/CSS leaks, strict typing (zero `any`), mobile touch targets $\ge 44\text{px}$, and tactile buttons (`active:scale-[0.97]`).

- [ ] **Step 3: Implement `src/components/workflows/WorkflowDetailDrawer.tsx`**
  - Multi-tab inspector drawer adhering strictly to `theme.md` Section 8.
  - Display DAG visualization, step progression timeline, hash-chained checkpoints with SHA-256 copy actions, and active wait conditions (approval link, webhook URL, schedule timestamp).

- [ ] **Step 4: Run UI tests and verify 100% pass**
  - Run: `pnpm vitest run src/platform/__tests__/ui/workflow-mission-control.test.tsx`
  - Expected: PASS.

---

### Task 6: End-to-End Workflow Milestone 5 Integration Suite
**Files to create:**
- Create: `src/platform/__tests__/workflows/workflow-e2e-milestone-5.test.ts`

- [ ] **Step 1: Implement Comprehensive End-to-End Test Suite**
  - Test 1: External MCP client calls `tasks/create` via Streamable HTTP, queues a template workflow, polls `tasks/get`, and verifies `tasks/result`.
  - Test 2: Autonomous Agent Planner discovers workflow template capability, instantiates it with dynamic inputs, and verifies state advancement.
  - Test 3: Multi-day workflow suspends on `approval`, operator inspects proposal in mission control drawer, approves it, and workflow resumes to completion.
  - Test 4: Cooperative cancellation via `tasks/cancel` revokes active Cloud Task, triggers reverse-LIFO Saga compensation, and records audit checkpoint.
  - Test 5: Emergency Dead-Man Switch trips: blocks `tasks/create` and operator mutations with HTTP 503 `DEAD_MAN_PAUSED`.

- [ ] **Step 2: Run End-to-End Test Suite and verify 100% pass**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-e2e-milestone-5.test.ts`
  - Expected: PASS.

---

### Task 7: Full Subsystem Regression, Project-Wide Typecheck & Code Review Gate
**Verification Gates:**
- [ ] Run full workflow test suite: `pnpm vitest run src/platform/__tests__/workflows/` (all 19+ test files passing).
- [ ] Run full platform test suite: `pnpm vitest run src/platform/__tests__/` (all suites passing).
- [ ] Run project-wide TypeScript typecheck: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` (0 errors, exit code 0).
- [ ] Run ESLint static analysis: `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` (0 errors, exit code 0).
- [ ] Verify 12-point Workflow Implementation Gate (Rule 67).
- [ ] Dispatch Senior Principal Systems & AI Agentic Architecture Reviewer subagent for Phase 7 Milestone 5.
- [ ] Author `docs/agents_mcp/phases/agents_mcp_phase_7_milestone_5_completion_report.md`.
- [ ] Author `docs/agents_mcp/phases/agents_mcp_phase_7_milestone_5_code_review.md`.

---

## 7. The 12-Point Workflow Implementation Gate (Rule 67 Verification)

Before Phase 7 Milestone 5 is declared complete, the implementation must satisfy all 12 points:

```text
[ ] 1. Protocol & Version Compliance: Targets MCP Tasks extension spec 2026-07-28 & Cloud Tasks SDK (Rule 11 & 38).
[ ] 2. Identity & Tenant Isolation: Executes under AgentPrincipal; Anti-IDOR validated on all checkpoints (Rule 8, 16 & 47).
[ ] 3. Scope & Delegation Check: Attenuated scopes verified; non-delegables stripped into WAITING state (Rule 16 & 17).
[ ] 4. TOCTOU Authority Verification: Live check in Firestore prior to resumed step execution (Rule 18).
[ ] 5. Idempotency & Distributed Tracing: Deterministic idempotencyKey and correlation IDs across all steps (Rule 19 & 20).
[ ] 6. Two-Phase Action Model: High-risk steps suspend to WAITING (approval) and bind SHA-256 payloadHash (Rule 21 & 22).
[ ] 7. Resource Ceilings & Budgets: Hard limits on step counts, retry attempts, and total workflow duration (Rule 23 & 54).
[ ] 8. True Cancellation & Sagas: Cooperative abort revokes Cloud Tasks; compensating Sagas execute in LIFO order (Rule 26 & 27).
[ ] 9. Context Budgeting & Injection Isolation: Payloads containerized in <untrusted_reference_data> (Rule 28 & 30).
[ ] 10. Post-Condition Verification: Verifies expected state changes before advancing to COMPLETED (Rule 31).
[ ] 11. Error Sanitization & Egress Control: Credentials and DB internals masked; safe egress URLs enforced (Rule 32 & 34).
[ ] 12. Immutable Domain Events & Hashing: Emits hash-chained events to UniversalEventBus (Rule 40).
```

---

## 8. Definition of Done (Rule 67 & Rule 68 Verification)

Before Phase 7 Milestone 5 is declared complete, the following criteria must be satisfied:
1. **MCP Tasks Spec 2026-07-28:** Full JSON-RPC 2.0 implementation of `tasks/create`, `tasks/get`, `tasks/list`, `tasks/cancel`, `tasks/result` over Streamable HTTP with 32MB payload ceiling.
2. **Deterministic Templates:** 3 verified business workflow templates with topological sorting (Kahn's algorithm) and schema validation.
3. **The Critical Distinction Bridge:** Seamless agent capability discovery and execution without entangling agent planners in low-level workflow step mechanics.
4. **Mission Control UI:** `/admin/workflows` and `WorkflowDetailDrawer` strictly compliant with `theme.md` §8 (demarcated header/footer, single-circle info tooltip at `z-[10050]`, zero raw descriptions, mobile touch targets $\ge 44\text{px}$).
5. **Real-Time SSE Reactivity:** Live updates via `useEventStream` for zero-polling operator monitoring.
6. **Zero Regressions (Rule 69):** 100% pass rate across preexisting automation tests, memory tests, runtime tests, and UI tests.
7. **Strict Typing (Rule 4):** Zero `any` or `any[]` across all authored files.
8. **Static Verification:** Clean exit code 0 on `pnpm typecheck` and `pnpm lint`.
