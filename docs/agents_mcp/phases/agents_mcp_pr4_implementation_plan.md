# PR-4 Implementation Plan: Canonical Execution Gateway & Error Contract (Milestone M3)

**Author:** Antigravity  
**Review Status:** Pre-Implementation Architectural Specification (Rule-Enhanced Edition)  
**Governing Source Documents:**  
- `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–10, 11–27, 31, 34, 36, 39–43, 47–54, 60, 64, 67, 68, 69)  
- `docs/agents_mcp/phases/agents_mcp_phase_1_build_plan.md` (§3 Build Order & §4.2 One Execution Gateway)  
- `docs/agents_mcp/phases/agents_mcp_pr2_pr3_implementation_plan.md` (Certified Base: Grade A+)  
- `docs/agents_mcp/agents_mcp_prd.md` (§73 Execution Pipeline)  
- `docs/agents_mcp/agents_mcp_tools.md` (§1 Security Principles, §4 Tool Invocation Pipeline)  
- `docs/agents_mcp/agents_mcp_cloudrun.md` (§4.3 Stateless Handler & Resource Boundaries)  

---

## 1. Executive Summary & Objective

Following the formal certification of **PR-2** (Phase 0 platform security blockers, constant-time secret check, Cloud Tasks OIDC token verification, capability registry invariants, and approval burn prevention) and **PR-3** (Experience Portals permissions, dual-plane RBAC coordinate bridging, and ESLint identity parameter ban) by the Senior Principal Systems Reviewer with an **A+** grade and zero baseline test regressions, the repository is ready to build **Milestone M3**.

**PR-4** constructs the single, authoritative entry point through which **all** execution surfaces invoke capabilities: `executeCapability()`.

No feature, UI Server Action, MCP tool adapter, background task worker, or autonomous agent is permitted to invoke capability handlers or Firestore operations directly. As formulated in **Rule 69** (The Unified Layering Axiom):
> *"Do not build an 'AI layer' beside SmartSapp. Build a governed capability layer underneath SmartSapp that both humans and agents use. Agents operate tools, tools operate capabilities, capabilities operate domain engines, domain engines touch Firestore."*

---

## 2. Exhaustive Governing Rules Analysis & Enforcement

A comprehensive review of `docs/agents_mcp/agents_mcp_rules.md` establishes the non-negotiable architectural constraints that govern PR-4:

### 2.1 The Core 10 Foundational Rules
*   **Rule 1 (Engineering Standards & Skills):** Conform to `next-best-practices`, `vercel-react-best-practices`, `backend-design`, and `frontend-design`. Maintain and improve all pre-existing app functionalities without regression.
*   **Rule 2 (Failure Analysis & Testability):** Explicitly model what could go wrong at every stage and define exact recovery mechanisms. Provide clean, testable, refactored, scalable code. Verify thoroughly with TypeScript, ESLint, and automated tests. *Never push to remote origin without explicit user direction.*
*   **Rule 3 (Cross-Domain Impact & Backoffice Governance):** Ensure the gateway evaluates global, organization, workspace, and capability kill-switches so operations can disable capabilities without code deployments.
*   **Rule 4 (Strict Typing & Unvalidated Unknown Ban):** Never use `any`, `any[]`, or unchecked casts (`as unknown as T`) in domain/platform code. `unknown` is permitted only at external trust boundaries (e.g. invocation payload, tool call input) and must be immediately validated and narrowed via Zod v4 schemas before entering domain logic. Never propagate unvalidated `unknown`.
*   **Rule 6 (Dependencies & Context7 Documentation):** Use current SDK specifications (`@modelcontextprotocol/server` SDK v2 and Zod v4 contracts).
*   **Rule 7 (Mobile Usability & Plain English UI):** Error mappers targeting UI consumers (`toServerActionResult`) must deliver everyday, clear, concise English error messages and actionable guidance.
*   **Rule 8 (Security Standards & Leak Prevention):** Enforce strict tenant isolation. Resource existence must never leak across workspace or organization boundaries (Step 7 returns `NOT_FOUND` instead of `FORBIDDEN` when target records are not owned by the caller's workspace).
*   **Rule 9 (Load Resilience & Resource Exhaustion Defense):** Enforce raw payload byte limits (`maxPayloadSizeBytes`) **before** JSON parsing or schema validation to prevent memory exhaustion or parse-bomb DoS attacks.
*   **Rule 10 (Inline Architectural Documentation & Pointers):** Leave clear explanatory comments in code explaining rationale, caution areas for future maintainers, and testability pointers.

### 2.2 Protocol, Risk & Identity Rules
*   **Rule 11 (MCP Protocol Compliance):** Target MCP SDK v2 (`@modelcontextprotocol/server`) stateless transport. MCP tool handlers must delegate to `executeCapability` and format outcomes via standardized error mappers.
*   **Rule 12 (Server-Side Risk Classification):** Never treat MCP tool annotations (`readOnlyHint`, `destructiveHint`) as security controls. Risk levels (`L0` to `L4`) must be enforced server-side independently in Step 8 (Authorization) and Step 9 (Approval).
*   **Rule 13 (Formal Trust Boundary Matrix):** Enforce the trust boundary:  
    `TRUSTED SYSTEM > USER SESSION > AGENT PRINCIPAL > UNTRUSTED TOOL INPUT > UNTRUSTED HANDLER OUTPUT`.  
    Retrieved data and tool outputs must never impersonate instructions.
*   **Rule 14 (Tool Poisoning / Rug-Pull Defense):** Step 2 checks capability version pins (`major.minor.patch`) and ensures schema compatibility so capabilities cannot be mutated behind an agent's back.
*   **Rule 16 (Agent Identity as First-Class Principal):** Authority is the strict intersection:  
    `User authority ∩ Agent authority ∩ Workspace authority ∩ Tool authority ∩ Delegated scope ∩ Current policy`.  
    An agent must never gain additional authority simply because operating on behalf of a privileged user.
*   **Rule 17 (Non-Delegable Privileges):** Automated agents (`actorType: 'agent'`) can never inherit non-delegable administrative actions (credential rotation, owner transfer, billing ownership, tenant isolation modification, audit disabling).
*   **Rule 18 (TOCTOU Protection & Optimistic Concurrency):** Step 8 evaluates authorization against the **live** principal standing at invocation time. Step 11 checks `expectedVersion` against the target resource's stored version; fails safely with `VERSION_CONFLICT` (`stateChanged: 'no'`) if the resource was modified after planning.
*   **Rule 19 & 20 (Idempotency & Replay Protection):** Every mutating capability must define idempotency behavior. Step 10 enforces `requiresIdempotencyKey`, tracks execution status (`running`, `completed`), returns cached results on replay, and rejects concurrent duplicates with `DUPLICATE_IN_PROGRESS`.
*   **Rule 21 & 22 (Two-Phase Actions & Approval Binding):** High-risk operations (L3/L4) require human approval bound to the exact intended operation and parameter hashes.  
    *Approval Burn Prevention:* Authority (Step 8) is strictly evaluated **before** approval verification (Step 9) so an unauthorized invocation cannot consume a human approval.
*   **Rule 23 (Resource Governance & Explicit StateChanged Error Contract):** Enforce strict `maxDurationMs` timeouts and `maxPayloadSizeBytes` byte budgets.  
    *The Mandatory StateChanged Invariant:* Every error emitted from the gateway must declare `stateChanged: 'no' | 'yes' | 'unknown'`.
*   **Rule 24 (Circuit Breakers):** Shield external providers from cascading failures during execution.
*   **Rule 25 (Dead-Letter & Recovery Queues):** Categorize error codes as retryable vs terminal to allow durable queue workers to route failed steps accurately.
*   **Rule 26 (Cancellation Semantics):** Execution aborts cleanly on timeout via `AbortController`; unconfirmed side effects are flagged `stateChanged: 'unknown'` to prevent stale writes.
*   **Rule 27 (Dual-Write Defense & Outbox Pattern):** Emitted domain events in Step 15 are queued atomically to a durable outbox collection rather than directly dispatched over the network.
*   **Rule 31 (Untrusted Input Schema Validation):** Model and client inputs are untrusted; Step 5 validates and narrows raw inputs strictly using Zod v4 schemas.
*   **Rule 34 (SSRF & Network Boundary Controls):** External requests inside capabilities must route through `safeUrlFetch` to block private IPs, metadata endpoints, and localhost.
*   **Rule 36 (Capability SemVer Version Compatibility):** Resolve capabilities matching SemVer contracts (`major.minor.patch`).
*   **Rule 39 (OpenTelemetry Distributed Tracing):** `CapabilityInvocation` propagates `traceId`, `spanId`, `correlationId`, `causationId` through the pipeline, logging them in execution and audit records.
*   **Rule 40 & 41 (Immutable Audit Log & "Why Did You Do This?" Trace):** Append-only audit logging recording Goal, Principal, Capability, Input Hash, Decision, and Result.
*   **Rule 42 (Shadow Mode / Dry-Run Simulation):** Step 12 executes side-effect-free simulation when `invocation.dryRun === true` and capability `supportsDryRun`, returning a plan diff with `stateChanged: 'no'`.
*   **Rule 47 ("Never Trust the Model" Pipeline):** Enforce the sequential execution sequence:  
    `Model Proposal -> Validator -> Tenant Bind -> Resource Scope -> Policy -> Permission -> Approval -> Executor -> Verifier`.
*   **Rule 48 ("Never Trust the Tool Either" Output Validation):** Handler return values are untrusted data. Step 14 validates output against Zod v4 `outputSchema`. If output fails validation, the gateway returns `INTERNAL` error and never returns unvalidated data to the caller.
*   **Rule 49 & 50 (Public Resource & Tenant Isolation):** Scoped access tokens, minimal data projections, and strict isolation keys (`organizationId`, `workspaceId`).
*   **Rule 51 (Server Action / Route Handler Security Gate):** Defense-in-depth: Every mutation must authenticate and authorize through the gateway.
*   **Rule 52 (Client/Server Boundary Protection & Information Disclosure):** Error mappers (`toServerActionResult`, `toMcpToolError`) sanitize error messages for clients, stripping internal paths, database details, and stack traces. Full diagnostic context is retained server-side in logs.
*   **Rule 53 (UI State Reflection):** UI components receive explicit `stateChanged` guidance so they know whether to refresh lists, display warnings, or retain user drafts.
*   **Rule 54 (Performance Budgets):** Gateway latency overhead budget: ≤ 50 ms p95 latency for read operations.
*   **Rule 60 & 64 (Agent Dead-Man Controls & Feature Flags):** Check global, organization, workspace, and capability level flags.
*   **Rule 67 (Agent Implementation Gate Checklist):** Full adherence across Architecture, Authority, Data, Execution, MCP, Failure, Security, Operations, Testing, and Migration.
*   **Rule 68 (The Five Non-Negotiables):**
    1. The model is never the security boundary.
    2. Tool output is untrusted data.
    3. Every mutation must be idempotent, authorized, version-checked, and auditable.
    4. Every production agent must have bounded authority and bounded resources.
    5. Every autonomous capability must be operable without code.
*   **Rule 69 (The Unified Layering Axiom):** Single Execution Gateway sits between adapters and domain engines.

---

## 3. Architectural Blueprint & Target File Layout

```text
src/platform/capabilities/
  ├── errors/
  │   ├── capability-error.ts            # Typed error hierarchy with stateChanged ('no' | 'yes' | 'unknown')
  │   └── error-mappers.ts               # User-safe mappers for Server Actions, MCP JSON-RPC, & HTTP
  ├── validation/
  │   └── payload-size.ts                # Raw byte size validator (enforced BEFORE JSON parsing)
  ├── execution/
  │   ├── invocation.ts                  # CapabilityInvocation contract & surface builders
  │   ├── execute-capability.ts          # executeCapability(): the single public entry point
  │   └── pipeline/                      # Pure, isolated, unit-testable pipeline steps
  │       ├── 01-resolve-principal.ts    # Surface-specific caller identity resolution (Rules 13, 16)
  │       ├── 02-lookup-capability.ts    # Version pin & capability resolution from registry (Rules 14, 36)
  │       ├── 03-check-flags.ts          # Feature flags & kill-switch evaluation (Rules 60, 64)
  │       ├── 04-validate-payload-size.ts# Byte-budget enforcement before parsing (Rules 9, 23)
  │       ├── 05-validate-input.ts       # Zod v4 schema parsing & sanitization (Rules 4, 31, 47)
  │       ├── 06-bind-tenant.ts          # Tenant isolation & target workspace matching (Rules 8, 50)
  │       ├── 07-resolve-resource-scope.ts # Target record ownership proof; no existence leak (Rules 8, 49)
  │       ├── 08-authorize-principal.ts  # Live RBAC, non-delegable & scope intersection (Rules 12, 16, 17, 18)
  │       ├── 09-verify-approval.ts      # Human approval check & single-use binding (Rules 21, 22)
  │       ├── 10-check-idempotency.ts    # Idempotency deduplication & lease checks (Rules 19, 20)
  │       ├── 11-check-concurrency.ts    # TOCTOU optimistic locking & version checks (Rule 18)
  │       ├── 12-dry-run.ts              # Side-effect-free execution simulation (Rules 21, 42)
  │       ├── 13-execute-handler.ts      # Bounded execution with strict timeout & abort (Rules 23, 24, 26)
  │       ├── 14-validate-output.ts      # Output schema verification (Rule 48)
  │       └── 15-audit-and-events.ts     # Execution record, audit trail & domain events (Rules 27, 39, 40, 41)
  └── __tests__/
      ├── gateway-pipeline.test.ts       # Unit tests for all 16 pipeline steps & refusal codes
      ├── error-mappers.test.ts          # StateChanged integrity and payload sanitization (Rule 52)
      └── gateway-benchmark.test.ts      # Gateway latency budget verification (≤ 50 ms p95) (Rule 54)
```

---

## 4. The 16-Step Canonical Execution Pipeline (PRD §73, Tools §4 & Rules 1–69)

Every invocation passing into `executeCapability` traverses these exact stages sequentially:

| Step | Component / Step File | Responsibility & Governing Rules | Refusal Code | `stateChanged` |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `01-resolve-principal.ts` | Resolves caller's `AgentPrincipal` from invocation context or session. Rejects unauthenticated callers. *(Rules 13, 16)* | `UNAUTHENTICATED` | `'no'` |
| **2** | `02-lookup-capability.ts` | Retrieves definition from canonical registry matching ID and version pin. Rejects unknown IDs or missing SemVer versions. *(Rules 14, 36)* | `NOT_FOUND` | `'no'` |
| **3** | `03-check-flags.ts` | Checks platform/org/workspace kill switches, emergency autonomous execution pause, and capability disable flags. *(Rules 3, 60, 64)* | `DISABLED` | `'no'` |
| **4** | `04-validate-payload-size.ts` | Validates raw payload byte size against `maxPayloadSizeBytes` **before** parsing. Protects against parse bombs and memory exhaustion. *(Rules 9, 23)* | `VALIDATION` | `'no'` |
| **5** | `05-validate-input.ts` | Parses and sanitizes input through capability's `inputSchema` (Zod v4). Unknown boundary data is validated and narrowed immediately. *(Rules 4, 31, 47)* | `VALIDATION` | `'no'` |
| **6** | `06-bind-tenant.ts` | Enforces that input parameters do not target another organization or workspace. *(Rules 8, 50)* | `TENANT_SCOPE` | `'no'` |
| **7** | `07-resolve-resource-scope.ts`| Executes capability's optional `resolveResourceScope(input, ctx)`. Confirms records belong to tenant. Never reveals existence of records across tenant boundaries. *(Rules 8, 49)* | `NOT_FOUND` *(never reveals existence)* | `'no'` |
| **8** | `08-authorize-principal.ts` | Evaluates principal's live authority against capability permissions, non-delegable flags, and scope intersection (`User ∩ Agent ∩ Workspace ∩ Tool ∩ Policy`). *(Rules 12, 16, 17, 18)* | `FORBIDDEN` | `'no'` |
| **9** | `09-verify-approval.ts` | Checks verified human approval for L3/L4 agent executions. Binds approval **only after** step 8 passes to prevent burning valid human approvals on forbidden calls. *(Rules 21, 22)* | `APPROVAL_REQUIRED` *(carries approval-request ID)* | `'no'` |
| **10**| `10-check-idempotency.ts` | Enforces `requiresIdempotencyKey`. If completed, returns stored result immediately. If in progress, rejects concurrent execution. *(Rules 19, 20)* | `DUPLICATE_IN_PROGRESS` | `'no'` |
| **11**| `11-check-concurrency.ts` | Validates `expectedVersion` against target resource version for optimistic concurrency control. Rejects stale mutations. *(Rule 18)* | `VERSION_CONFLICT` *(carries current version)* | `'no'` |
| **12**| `12-dry-run.ts` | If `invocation.dryRun === true` and capability `supportsDryRun`, returns simulated plan with zero side effects. *(Rules 21, 42)* | — *(Success)* | `'no'` |
| **13**| `13-execute-handler.ts` | Executes capability `handler(input, ctx)` bounded by `maxDurationMs` with `AbortController`. Surface-budget capped. Rejects on timeout or unhandled exception. *(Rules 23, 24, 26)* | `TIMEOUT` / `HANDLER_EXCEPTION` | `'unknown'` on timeout, handler-derived on failure |
| **14**| `14-validate-output.ts` | Validates handler output against `outputSchema` (Rule 48: "Never trust the tool either"). Rejects invalid output; never returns malformed data to caller. *(Rules 4, 13, 48)* | `INTERNAL` | Handler-derived |
| **15**| `15-audit-and-events.ts` | Commits execution audit log and queues emitted `DomainEvent` objects to durable outbox. Dual-write defense. *(Rules 27, 39, 40, 41)* | — | Handler-derived |
| **16**| `execute-capability.ts` | Formats and returns typed `CapabilityExecutionResult<TOutput>`. Orchestrates pipeline and guarantees error contracts. *(Rules 68, 69)* | — *(Success)* | `'yes'` (or `'no'` for read-only L0) |

---

## 5. Contract Specifications

### 5.1 Invocation Contract (`invocation.ts`)

```typescript
import type { AgentPrincipal } from '../contracts/capability-definition';

export type InvocationSurface = 'ui' | 'mcp' | 'agent' | 'automation' | 'task_worker' | 'api';

export interface CapabilityInvocation<TInput = unknown> {
  capabilityId: string;
  version?: string; // Pinned SemVer or default to latest
  surface: InvocationSurface;
  input: TInput;
  rawPayloadSize?: number; // Optional pre-calculated raw byte length
  correlationId: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  idempotencyKey?: string;
  expectedVersion?: number;
  dryRun?: boolean;
  approvalId?: string;
  callDepth?: number;
  principal?: AgentPrincipal; // Pre-resolved or derived by gateway
}

export interface CapabilityExecutionResult<TOutput> {
  success: true;
  output: TOutput;
  executionId: string;
  correlationId: string;
  durationMs: number;
  stateChanged: 'no' | 'yes';
}
```

### 5.2 Error Contract (`capability-error.ts`)

```typescript
export type StateChanged = 'no' | 'yes' | 'unknown';

export type CapabilityErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'VALIDATION'
  | 'TENANT_SCOPE'
  | 'FORBIDDEN'
  | 'APPROVAL_REQUIRED'
  | 'DUPLICATE_IN_PROGRESS'
  | 'VERSION_CONFLICT'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'HANDLER_EXCEPTION'
  | 'INTERNAL';

export interface CapabilityErrorOptions {
  code: CapabilityErrorCode;
  message: string;
  stateChanged: StateChanged;
  retryable?: boolean;
  httpStatus?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class CapabilityError extends Error {
  readonly code: CapabilityErrorCode;
  readonly stateChanged: StateChanged;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(options: CapabilityErrorOptions) {
    super(options.message);
    this.name = 'CapabilityError';
    this.code = options.code;
    this.stateChanged = options.stateChanged;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus ?? 500;
    this.details = options.details;
    if (options.cause) this.cause = options.cause;
  }
}
```

### 5.3 Error Mappers (`error-mappers.ts`)

1. **`toServerActionResult(error: unknown)`**:
   Returns standardized `{ success: false, error: string, code: string, stateChanged: StateChanged }`.
   - Formats user-safe messages in plain everyday English (Rule 7).
   - Strips stack traces, internal database paths, and secrets (Rule 52).
2. **`toMcpToolError(error: unknown)`**:
   Returns `{ content: [{ type: 'text', text: string }], isError: true }` compatible with MCP SDK v2 (Rule 11).
3. **`toHttpError(error: unknown)`**:
   Maps `CapabilityError` to standard HTTP status codes:
   - `401`: `UNAUTHENTICATED`
   - `403`: `FORBIDDEN`, `APPROVAL_REQUIRED`, `DISABLED`
   - `404`: `NOT_FOUND`
   - `400`: `VALIDATION`, `TENANT_SCOPE`
   - `409`: `DUPLICATE_IN_PROGRESS`, `VERSION_CONFLICT`
   - `503`: `TIMEOUT` (retryable), `PROVIDER_ERROR` (retryable)
   - `500`: `INTERNAL`, `HANDLER_EXCEPTION`

---

## 6. What Could Go Wrong & Mitigation Strategies (Rule 2 Analysis)

| Potential Failure Mode | Root Cause / Vulnerability | Architectural Mitigation in PR-4 |
| :--- | :--- | :--- |
| **JSON Parse Bomb / Memory Exhaustion** | Client or agent sends a 50MB payload that blocks the event loop during parsing. | **Step 4 (`validatePayloadSize`)** checks byte size before JSON parsing/schema validation (Rules 9, 23). |
| **Cross-Tenant Entity Existence Leak** | Attacker probes entity IDs from other tenants to confirm their existence via `403 Forbidden`. | **Step 7 (`resolveResourceScope`)** returns `NOT_FOUND` (`404`) instead of `FORBIDDEN` if a record is not owned by the caller's workspace (Rule 8). |
| **Approval Burning on Forbidden Action** | Human approves an action, but caller lacks RBAC permissions, consuming the approval token fruitlessly. | **Step 8 (Authorize)** runs **strictly before** Step 9 (Verify Approval). Approvals are never burned if base RBAC fails (Rule 22). |
| **Unvalidated Tool Output Poisoning** | Tool returns an unexpected object format containing prompt injections or malformed types that crash the caller. | **Step 14 (`validateOutput`)** parses handler output with Zod v4 `outputSchema`. Mismatch raises `INTERNAL` error and withholds output (Rule 48). |
| **Hanging Execution & Unbounded Spend** | External HTTP call or loop hangs indefinitely, consuming serverless Cloud Run resources. | **Step 13 (`executeHandler`)** enforces strict `maxDurationMs` timeout using `AbortController` and signals `stateChanged: 'unknown'` (Rule 23, 26). |
| **Split-Brain on Network Disconnect** | Capability writes to Firestore, then crashes before sending events or returning, leaving state ambiguous. | **Step 15 (`auditAndEvents`)** records state and queues domain events to an atomic transactional outbox (Rule 27). |
| **Internal Stack Leakage to Browser** | Unhandled exception exposes internal file paths or Firestore connection strings to frontend users. | **`toServerActionResult` (Rule 52)** sanitizes error messages, returning plain English messages while logging stack traces to server telemetry. |

---

## 7. Refactoring Plan (Existing Adapters onto the Gateway)

To enforce Rule 69 without duplicating policy or execution logic, existing consumers will be migrated to call `executeCapability()`:

1. **`src/platform/tasks/agent-step-executor.ts`**:
   Refactor `processAgentStep` to delegate the validation, scoping, authorization, approval verification, and execution stages to `executeCapability`. Retain Cloud Tasks lease claiming and Firestore step store updates around the gateway invocation.
2. **`src/platform/mcp/create-stateless-handler.ts`**:
   Refactor `createCapabilityToolHandler` so that MCP tool calls construct a `CapabilityInvocation` (`surface: 'mcp'`) and execute via `executeCapability`. The MCP handler formats the gateway outcome into an MCP SDK v2 response via `toMcpToolError`.
3. **Regression Safety**:
   The existing test suites (`agent-step-worker.test.ts`, `approval-binding.test.ts`, and `mcp-server-builder.test.ts`) must pass with **100% fidelity without modifying test assertions**.

---

## 8. Implementation Steps & Task Breakdown

| Task # | Scope | Files to Create / Modify | Verification Check |
| :--- | :--- | :--- | :--- |
| **Task 1** | **Contracts & Error Hierarchy** | `src/platform/capabilities/errors/capability-error.ts`<br>`src/platform/capabilities/errors/error-mappers.ts`<br>`src/platform/capabilities/execution/invocation.ts` | Unit tests for error hierarchy & mappers (`error-mappers.test.ts`) |
| **Task 2** | **Payload Size Validator** | `src/platform/capabilities/validation/payload-size.ts` | Buffer/string byte size unit tests |
| **Task 3** | **Pipeline Steps (1 to 15)** | `src/platform/capabilities/execution/pipeline/*.ts` (01 to 15) | Unit test suite per pipeline refusal code |
| **Task 4** | **Gateway Orchestrator** | `src/platform/capabilities/execution/execute-capability.ts` | End-to-end gateway execution test |
| **Task 5** | **Worker Adapter Refactor** | `src/platform/tasks/agent-step-executor.ts` | `agent-step-worker.test.ts` & `approval-binding.test.ts` pass |
| **Task 6** | **MCP Adapter Refactor** | `src/platform/mcp/create-stateless-handler.ts` | `mcp-server-builder.test.ts` passes |
| **Task 7** | **Gateway Test Suite & Benchmark** | `src/platform/__tests__/gateway-pipeline.test.ts`<br>`src/platform/__tests__/gateway-benchmark.test.ts` | P95 latency ≤ 50 ms microbenchmark |
| **Task 8** | **Full Verification & Sweep** | Entire test suite + Typecheck + ESLint | 0 type errors, 0 lint warnings, 478+ baseline tests pass |

---

## 9. Definition of Done & Exit Criteria

1. `src/platform/capabilities/execution/execute-capability.ts` is the single entry point for capability execution across all surfaces.
2. Every refusal step in the 16-step pipeline has a dedicated test in `src/platform/__tests__/gateway-pipeline.test.ts`.
3. Every error emitted from the gateway exposes `stateChanged: 'no' | 'yes' | 'unknown'`.
4. `agent-step-executor.ts` and `create-stateless-handler.ts` delegate directly to `executeCapability`.
5. Gateway read overhead benchmark records ≤ 50 ms p95 in `src/platform/__tests__/gateway-benchmark.test.ts`.
6. `pnpm typecheck` returns 0 errors.
7. `pnpm lint` / `pnpm eslint` returns 0 errors and 0 warnings.
8. `pnpm test:agentic:baseline` (all 47 test suites / 478+ tests) passes with 100% fidelity.
