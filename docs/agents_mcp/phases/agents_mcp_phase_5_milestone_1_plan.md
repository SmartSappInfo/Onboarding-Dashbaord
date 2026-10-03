# Phase 5 Milestone 1: Stateless Streamable HTTP Transport Engine, Protocol Spec 2026-07-28 Wiring & Multi-Tenant Auth Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the production-grade, stateless Streamable HTTP transport engine for MCP (Protocol Spec 2026-07-28) on Google Cloud Run, featuring multi-round-trip transaction header routing (`Mcp-Transaction-Id`), 32MB payload ceiling enforcement, hardened multi-tenant authentication with Anti-IDOR invariants, and emergency dead-man pause evaluation (Rule 60) — fully conforming to all 69 SmartSapp Agentic Development Rules (`docs/agents_mcp/agents_mcp_rules.md`).

**Architecture:** Integrate `@modelcontextprotocol/server` SDK v2 (`createMcpHandler` and `WebStandardStreamableHTTPServerTransport`) into Next.js App Router dynamic route handlers (`POST /api/mcp/v2/[domain]`), fronted by a sessionless ingress authentication gateway that resolves Clerk JWTs and Bearer API keys into canonical `AgentPrincipal` records, enforces fail-closed tenant isolation, checks the 10-second TTL dead-man switch, and propagates distributed tracing headers.

**Tech Stack:** TypeScript (strict zero-`any`), Next.js 15 App Router, `@modelcontextprotocol/server` v2.1.0, Zod v4, Cloud Run serverless constraints, Vitest test suite.

---

## 1. Compliance Matrix: 69 SmartSapp Agentic Development Rules

Every requirement in this milestone maps directly to the governing principles in [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md):

| Rule # | Requirement / Principle | Phase 5 Milestone 1 Concrete Guarantee | Verification Gate |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Adheres to Next.js 15 App Router Web Standards (`Request`/`Response`), strict Zod schemas, modular `src/platform/mcp/transport/`. Preexisting CRM and Messaging features remain untouched. | Clean static analysis and architecture reviews. |
| **Rule 2** | Reflection Q1: Failure Modes | Analyzed 6 failure modes: Cloud Run timeout, cross-tenant header injection, 32MB payload spikes, missing accept headers, legacy sticky session reliance, dead-man state lag. | Unit & integration tests simulating each failure mode. |
| **Rule 3** | Reflection Q2 & Q3: Affected Features & UI | Preexisting MCP 1.0 routes (`/api/mcp`) remain 100% operational via the Strangler pattern (Rule 69); new v2 endpoints mount under `/api/mcp/v2/[domain]`. Backoffice operators gain dead-man control. | 100% baseline regression pass across existing MCP test suites. |
| **Rule 4** | Zero `any` & Safe `unknown` | Strictly prohibits `any` or `any[]`. `unknown` is permitted only at external HTTP/JSON-RPC trust boundaries and must be immediately narrowed with Zod schemas. | `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` exits with 0 errors. |
| **Rule 5** | Verification Before Production | All transports, auth gateways, and routes are verified via local unit, integration, and security test suites before deployment. | Vitest test runner green across all test files. |
| **Rule 7** | Plain English & Minimal Jargon | Error responses use standard JSON-RPC 2.0 codes and human-readable, actionable error messages (e.g. `"Authentication required: valid Bearer token or Clerk session required"`). | Error message assertions in unit tests. |
| **Rule 8 & 47** | Fail-Closed Multi-Tenant Anti-IDOR | Tenant context (`organizationId`, `workspaceId`) extracted exclusively from verified credentials (`requireAuth()` or `mcp_keys`). External caller-supplied headers cannot override tenant scope. | Anti-IDOR spoofing test suite. |
| **Rule 9** | Cloud Run 32MB Payload Ceiling | Enforces 32MB request body size ceiling (`CLOUD_RUN_MAX_REQUEST_BODY_SIZE = 32 * 1024 * 1024`). Rejects oversized payloads with HTTP 413 `PAYLOAD_TOO_LARGE`. | Payload size boundary test. |
| **Rule 10** | Inline Architectural Documentation | Every authored file features `@fileOverview` with maintainer notes, failure mode analysis, architectural invariants, and testability pointers. | Automated code comment audits pass. |
| **Rule 11** | Current MCP Spec Compliance (2026-07-28 / SDK v2) | Implements stateless Streamable HTTP transport using `@modelcontextprotocol/server` SDK v2. Multi-round-trip requests carry `Mcp-Transaction-Id`. | Protocol conformance test suite. |
| **Rule 12** | Annotations Are Hints, Not Security Controls | Server-side policy engine enforces actual risk levels (L0–L4) and authorization independently of MCP tool hints (`readOnlyHint`, `destructiveHint`). | Policy enforcement test suite. |
| **Rule 13** | Formal Trust Boundary Matrix | External tool inputs and HTTP bodies classified as untrusted. Sanitized and narrowed with Zod schemas. | Schema parsing test suite. |
| **Rule 16** | Agent Identity as First-Class Security Principal | Resolves incoming calls into canonical `AgentPrincipal` with `actorType: 'agent'`. Strict ban on wildcard `*` permissions. | Principal evaluator test suite. |
| **Rule 17** | Non-Delegable Actions Guard | Banned administrative operations (`change_owner`, `rotate_keys`, `delete_workspace`) can never be executed via automated MCP callers. | Non-delegable rejection test. |
| **Rule 18** | TOCTOU Protection | Mutating tools validate resource versions (`expectedVersion`, `expectedUpdatedAt`) before applying mutations. | Concurrency unit tests. |
| **Rule 19 & 20** | Idempotency & Replay Protection | Derives deterministic idempotency keys for mutating tools (`mcp:sha256(...)`); tracks `X-SmartSapp-Correlation-Id` across requests. | Idempotency test suite. |
| **Rule 21 & 22** | Two-Phase Action Model & Approval Binding | L3 and L4 capabilities return an `ActionProposal` in `/admin/approvals` rather than directly mutating production state. Payload bound to SHA-256 `payloadHash`. | Action proposal generation test. |
| **Rule 24** | Resilient Error Handling & Circuit Breakers | Outbound MCP connections and external services monitored via 5-state circuit breaker. | Circuit breaker integration test. |
| **Rule 34** | SSRF & Network Boundary Controls | Inbound endpoints validate request origin and block private IP redirection (`169.254.169.254`, `localhost`, RFC-1918). | Network boundary test. |
| **Rule 37** | MCP Spec Compatibility Testing | Conformance testing verifying stateless Streamable HTTP behavior (`POST`, `Accept: application/json, text/event-stream`). | Spec compliance test runner. |
| **Rule 38** | Banned Deprecated MCP Features | Zero reliance on legacy Roots, Sampling, Logging, or sticky SSE connections (`Mcp-Session-Id` banned). | Deprecation check in route handler. |
| **Rule 39** | OpenTelemetry Distributed Tracing | Propagates `traceparent`, `tracestate`, and `X-SmartSapp-Correlation-Id` across incoming HTTP requests and internal domain services. | Trace context header test. |
| **Rule 40** | Append-Only Immutable Audit Log | Every tool invocation, decision, and outcome is recorded in an immutable append-only audit ledger (`mcp_audit_logs`). | Audit record integrity test. |
| **Rule 47** | "Never Trust the Model" Execution Gate | Model tool call arguments pass through strict Zod v4 schemas, tenant boundary checks, and capability policy validation before execution. | Model untrusted execution test. |
| **Rule 48** | "Never Trust the Tool Either" Invariant | Tool results sanitized and formatted cleanly before returning to callers. Internal errors return generic references. | Error sanitization test. |
| **Rule 50** | Cache Isolation Rules | All cached MCP responses and discovery payloads include `organizationId` and `workspaceId` in the cache key. | Tenant cache isolation test. |
| **Rule 51** | Server Actions & Route Handlers Security Gate | Route handlers verify authentication, tenant equality, and surface isolation. Marked as authenticated route handlers. | Next.js security audit passes. |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` checks if autonomous or MCP execution is paused; if tripped, aborts with HTTP 503 `MCP_EXECUTION_PAUSED`. | Dead-man kill switch unit test. |
| **Rule 61** | Surface Isolation (Backoffice vs Client) | Backoffice-only domains (e.g. `system`) enforce `isBackofficeSurface()`; client web app cannot execute backoffice domains. | Surface access control test. |
| **Rule 66** | Cross-Cutting Phase 5 Gates | Enforces OAuth issuer validation, client identity, server identity, and protocol spec compliance. | Phase 5 gate audit. |
| **Rule 68** | The Five Non-Negotiable Rules | 1. Model is never security boundary; 2. Tool output is untrusted; 3. Mutations idempotent & authorized; 4. Bounded authority & resources; 5. Operable without code. | Non-negotiable review sign-off. |
| **Rule 69** | Strangler Fig Pattern SSOT | Build governed capability layer underneath SmartSapp. Legacy MCP in `src/lib/mcp/` remains 100% operational via compatibility adapters. | Preexisting MCP regression tests pass. |

---

## 2. Architectural Reflections (Rules 2 & 3)

### Reflection Q1: What could go wrong and how is it resolved?
1. **Cloud Run Instance Scaling & Session Loss:** Legacy MCP implementations rely on in-memory SSE sessions with `Mcp-Session-Id`. On Cloud Run, instances scale down to zero or scale horizontally, causing connection dropouts.  
   *Resolution:* Adopt MCP `2026-07-28` Stateless Streamable HTTP. Every HTTP POST is self-contained. Multi-round-trip requests carry `Mcp-Transaction-Id` and `X-SmartSapp-Correlation-Id` in standard headers, allowing any Cloud Run container behind Google Cloud Load Balancer to service any step of an interaction.
2. **Cross-Tenant IDOR & Header Injection:** An attacker or malicious external client authenticates with Key A (Org A) but sends header `x-organization-id: org_b` or `x-workspace-id: ws_b` to manipulate Org B's data.  
   *Resolution:* Enforce Finding N4 Anti-Spoofing. The tenant context (`organizationId`, `workspaceId`) is bound strictly and immutably to the verified database record (`mcp_keys` or Clerk session). External caller-supplied tenant headers are strictly ignored and rejected if they conflict.
3. **Cloud Run 32MB Memory Spike / OOM:** A client sends a 50MB payload (e.g. raw audio or multi-megabyte PDF) directly in tool arguments, triggering container OOM.  
   *Resolution:* Enforce Cloud Run 32MB payload ceiling (`CLOUD_RUN_MAX_REQUEST_BODY_SIZE = 32 * 1024 * 1024`). The transport handler checks `content-length` and stream size before JSON parsing, returning HTTP 413 `PAYLOAD_TOO_LARGE` immediately.
4. **Dead-Man Switch State Lag:** A governance administrator pauses MCP execution in Backoffice, but active container instances continue executing mutations.  
   *Resolution:* Rule 60 `checkGovernanceDeadManSwitch` uses a short 10-second in-memory TTL cache with instant EventBus invalidation, ensuring all instances halt execution within seconds.
5. **Client Accept Header Mismatch:** MCP clients send standard `accept: application/json` without `text/event-stream`, causing the MCP SDK to return HTTP 406.  
   *Resolution:* Transport handler inspects the incoming `accept` header and normalizes it to include `text/event-stream` when communicating with Streamable HTTP transports, ensuring seamless client interop.

### Reflection Q2 & Q3: Affected Features & Backoffice Enhancement
- **Affected Features:** Preexisting MCP 1.0 routes (`/api/mcp` and `/api/mcp/sse`) and existing tools in `src/lib/mcp/` remain untouched. The new v2 protocol endpoints live under `/api/mcp/v2/[domain]`. All 12 legacy MCP test suites continue to pass 100%.
- **Backoffice Operability Without Code (Rule 61):** Backoffice operators can inspect active MCP endpoints, view live traffic metrics, and trigger the emergency dead-man pause switch without code changes or redeployments.

---

## 3. The Agent Implementation Gate (Rule 67)

Before implementing Milestone 1, the architecture satisfies all 8 dimensions of the mandatory gate:

1. **ARCHITECTURE:**
   - Canonical capability: Integrates `buildDomainMcpServer` and `createCapabilityToolHandler` with `@modelcontextprotocol/server`'s `createMcpHandler` and `WebStandardStreamableHTTPServerTransport`.
   - Source of truth: Unified Capability Registry (`src/platform/capabilities/registry/`).
   - Events emitted: `mcp.tool.invoked`, `mcp.transport.error`, `governance.dead_man.tripped`.
2. **AUTHORITY:**
   - Evaluates caller authority via `McpAuthGateway`.
   - Forces `actorType: 'agent'`. Strips wildcard `*` permissions and non-delegable actions.
   - Authority formula:
     $$\text{Authority} = \text{User Authority} \cap \text{Agent Authority} \cap \text{Workspace Authority} \cap \text{Tool Authority} \cap \text{Delegated Scope} \cap \text{Current Policy}$$
3. **DATA:**
   - Ingress: JSON-RPC 2.0 requests over Streamable HTTP POST.
   - Egress: JSON-RPC 2.0 responses over `text/event-stream` or `application/json`.
   - Isolation: Tenant scope strictly bound to verified credentials.
4. **EXECUTION:**
   - Stateless Streamable HTTP with `Mcp-Transaction-Id`.
   - Deterministic idempotency keys for mutating capabilities:
     $$\text{IdempotencyKey} = \text{mcp:sha256}([\text{orgId}, \text{wsId}, \text{userId}, \text{agentId}, \text{capId}, \text{capVersion}, \text{inputCandidate}])$$
5. **MCP:**
   - Protocol version: `2026-07-28` (and SDK v2 `2025-11-25` compatibility).
   - Transport: Stateless Streamable HTTP (`WebStandardStreamableHTTPServerTransport`).
   - Deprecated features: Roots, Sampling, Logging, and sticky SSE explicitly banned.
6. **FAILURE:**
   - Unauthenticated $\rightarrow$ HTTP 401 / JSON-RPC `-32000`.
   - Dead-man paused $\rightarrow$ HTTP 503 `MCP_EXECUTION_PAUSED`.
   - Oversized payload $\rightarrow$ HTTP 413 `PAYLOAD_TOO_LARGE`.
   - Tool failure $\rightarrow$ sanitized generic error with correlation ID.
7. **SECURITY:**
   - Anti-IDOR tenant validation (Finding N4).
   - Surface isolation (Rule 61).
   - SSRF and private IP blocking (Rule 34).
8. **OPERATIONS & TESTING:**
   - Operable from Backoffice via `/admin/mcp` and dead-man switch.
   - 100% test coverage across transport types, auth gateway, streamable handler, and route handlers.

---

## 4. File Structure & Responsibilities

```
src/
├── platform/
│   ├── mcp/
│   │   ├── transport/
│   │   │   ├── transport-types.ts            # Canonical transport contracts, headers, error codes, constants
│   │   │   └── streamable-http-handler.ts    # WebStandardStreamableHTTPServerTransport & createMcpHandler wrapper
│   │   ├── auth/
│   │   │   └── mcp-auth-gateway.ts           # Clerk JWT + Bearer API Key resolver with Anti-IDOR & Dead-Man check
│   │   ├── create-stateless-handler.ts       # Existing server builder & per-tool handler (Phase 0 bedrock)
│   │   └── to-mcp-tool-schema.ts             # Zod v4 / SchemaParser → StandardSchema adapter
│   └── __tests__/
│       └── mcp/
│           ├── transport-types.test.ts       # Validates transport types, headers, and error mapping
│           ├── mcp-auth-gateway.test.ts      # Validates authentication, anti-IDOR, and dead-man evaluation
│           ├── streamable-http-transport.test.ts # Tests Streamable HTTP handshake, transaction headers, 32MB limit
│           └── mcp-route-v2.test.ts          # Tests Next.js dynamic route handler, domain dispatch, surface isolation
└── app/
    └── api/
        └── mcp/
            └── v2/
                └── [domain]/
                    └── route.ts              # Next.js App Router dynamic endpoint POST /api/mcp/v2/[domain]
```

---

## 5. Granular Task Decomposition

### Task 1: Transport Types, Constants & Error Taxonomy

**Files:**
- Create: `src/platform/mcp/transport/transport-types.ts`
- Test: `src/platform/__tests__/mcp/transport-types.test.ts`

- [ ] **Step 1: Write the failing test**
  - Create `src/platform/__tests__/mcp/transport-types.test.ts` verifying:
    * `McpTransactionHeadersSchema` parses valid `mcp-transaction-id`, `x-smartsapp-correlation-id`, `traceparent`, `tracestate`.
    * Rejects malformed or oversized header values.
    * `CLOUD_RUN_MAX_REQUEST_BODY_SIZE` is strictly $32 \times 1024 \times 1024$ bytes ($33,554,432$).
    * `MCP_TRANSPORT_ERROR_CODES` contains all canonical codes (`UNAUTHENTICATED`, `TENANT_SCOPE_VIOLATION`, `MCP_EXECUTION_PAUSED`, `PAYLOAD_TOO_LARGE`, `INVALID_DOMAIN`, `SURFACE_RESTRICTED`, `DEPRECATED_FEATURE_REJECTED`).
    * `SUPPORTED_MCP_DOMAINS` matches `['crm', 'knowledge', 'messaging', 'sales', 'portals', 'system']`.
    * `formatJsonRpcError` produces compliant JSON-RPC 2.0 error payloads with error code, message, and correlation ID.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/transport-types.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**
  - Create `src/platform/mcp/transport/transport-types.ts`:
    * Strict Zod schemas for headers, request metadata, and domain names.
    * Constants for payload ceiling and supported protocol versions (`2026-07-28`, `2025-11-25`).
    * JSON-RPC 2.0 error formatting helpers.
    * Strict Zero `any` or `any[]` (Rule 4).

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/transport-types.test.ts`
  - Expected: PASS.

---

### Task 2: Multi-Tenant Ingress Authentication Gateway & Anti-IDOR Engine

**Files:**
- Create: `src/platform/mcp/auth/mcp-auth-gateway.ts`
- Test: `src/platform/__tests__/mcp/mcp-auth-gateway.test.ts`

- [ ] **Step 1: Write the failing test**
  - Create `src/platform/__tests__/mcp/mcp-auth-gateway.test.ts` verifying:
    * Resolves valid Bearer API key from Firestore `/mcp_keys` via `resolvePrincipalFromMcpKey`.
    * Resolves valid Clerk interactive session via `requireAuth()`.
    * Fails closed (`UNAUTHENTICATED`) when no Authorization header or session exists.
    * Rejects revoked or expired API keys immediately.
    * Anti-IDOR: Rejects request if caller provides conflicting `x-organization-id` or `x-workspace-id` headers (`TENANT_SCOPE_VIOLATION`).
    * Dead-Man Switch: If `checkGovernanceDeadManSwitch(tenant)` is true, throws `MCP_EXECUTION_PAUSED` with HTTP 503.
    * Strips non-delegable actions and wildcard `*` from granted scopes (Rule 16 & 17).
    * Handles OAuth issuer and client registration metadata when provided (Rule 66).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-auth-gateway.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**
  - Create `src/platform/mcp/auth/mcp-auth-gateway.ts`:
    * `authenticateMcpRequest(req: Request): Promise<McpAuthResult>`
    * Extracts Bearer token or session cookies.
    * Validates against Firestore `/mcp_keys` (with caching) or Clerk.
    * Anti-IDOR tenant validation matching Finding N4.
    * Calls `checkGovernanceDeadManSwitch({ organizationId, workspaceId })`.
    * Returns strictly typed `AgentPrincipal` with `actorType: 'agent'`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-auth-gateway.test.ts`
  - Expected: PASS.

---

### Task 3: Stateless Streamable HTTP Transport Engine (Spec 2026-07-28)

**Files:**
- Create: `src/platform/mcp/transport/streamable-http-handler.ts`
- Test: `src/platform/__tests__/mcp/streamable-http-transport.test.ts`

- [ ] **Step 1: Write the failing test**
  - Create `src/platform/__tests__/mcp/streamable-http-transport.test.ts` verifying:
    * `StreamableHttpHandler.handleRequest(req, options)` handles MCP `initialize` handshake over HTTP POST.
    * Enforces 32MB payload limit: returns HTTP 413 `PAYLOAD_TOO_LARGE` when `content-length` exceeds 32MB.
    * Normalizes client `accept` headers so both `application/json` and `text/event-stream` are supported.
    * Preserves and echoes `Mcp-Transaction-Id` and `X-SmartSapp-Correlation-Id` on responses.
    * Rejects requests containing deprecated `Mcp-Session-Id` with HTTP 400 (Rule 38).
    * Routes tool call through `buildDomainMcpServer` and records audit entry to audit sink (`mcp_audit_logs`).
    * Returns HTTP 503 when dead-man switch is active.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/streamable-http-transport.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**
  - Create `src/platform/mcp/transport/streamable-http-handler.ts`:
    * Leverages `createMcpHandler` from `@modelcontextprotocol/server`.
    * Implements `StreamableHttpHandler` class with `handleRequest(req, options)`.
    * 32MB payload boundary check.
    * Deprecated header detection (`Mcp-Session-Id`).
    * Header extraction and propagation (`Mcp-Transaction-Id`, `X-SmartSapp-Correlation-Id`, `traceparent`).
    * Factory callback dynamically builds domain `McpServer` bound to authenticated principal via `buildDomainMcpServer`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/streamable-http-transport.test.ts`
  - Expected: PASS.

---

### Task 4: Dynamic Domain App Router Route Handler (`/api/mcp/v2/[domain]`)

**Files:**
- Create: `src/app/api/mcp/v2/[domain]/route.ts`
- Test: `src/platform/__tests__/mcp/mcp-route-v2.test.ts`

- [ ] **Step 1: Write the failing test**
  - Create `src/platform/__tests__/mcp/mcp-route-v2.test.ts` verifying:
    * `POST /api/mcp/v2/crm` executes successfully with valid credentials.
    * `POST /api/mcp/v2/invalid-domain` returns HTTP 404 with structured error code.
    * Surface isolation: `POST /api/mcp/v2/system` on client surface (`APP_SURFACE=client`) returns HTTP 403 `SURFACE_RESTRICTED`.
    * `OPTIONS /api/mcp/v2/[domain]` handles CORS preflight cleanly.
    * Header propagation verification across route invocation.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-route-v2.test.ts`
  - Expected: FAIL with route not found.

- [ ] **Step 3: Write minimal implementation**
  - Create `src/app/api/mcp/v2/[domain]/route.ts`:
    * Next.js App Router dynamic route handler.
    * Validates `params.domain` against `SUPPORTED_MCP_DOMAINS`.
    * Checks `isBackofficeSurface()` for restricted domains.
    * Calls `authenticateMcpRequest(req)`.
    * Dispatches to `StreamableHttpHandler`.
    * Exports `OPTIONS` for CORS preflight.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/mcp-route-v2.test.ts`
  - Expected: PASS.

---

### Task 5: Platform Regression & Verification Gates

**Files:**
- Test: `src/platform/__tests__/mcp/`
- Verification: Full Vitest suite, TypeScript compilation, and ESLint static analysis.

- [ ] **Step 1: Run all Milestone 1 unit and integration tests**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/`
  - Expected: All tests PASS.

- [ ] **Step 2: Run full platform baseline regression suite**
  - Run: `pnpm vitest run src/platform/__tests__/baseline/`
  - Expected: All 5 baseline regression test suites pass 100%.

- [ ] **Step 3: Run existing legacy MCP test suite (Rule 69 Strangler Invariant)**
  - Run: `pnpm vitest run src/lib/mcp/__tests__/`
  - Expected: All legacy MCP tests pass with zero regression.

- [ ] **Step 4: Run full TypeScript compilation**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Expected: Clean exit code 0, 0 errors, zero `any` or `any[]` (Rule 4).

- [ ] **Step 5: Run ESLint static analysis**
  - Run: `pnpm lint`
  - Expected: Clean exit code 0, 0 errors.

---

## 6. Definition of Done for Milestone 1

1. **Protocol 2026-07-28 Conformance:** Stateless Streamable HTTP transport operational over `POST /api/mcp/v2/[domain]` using `@modelcontextprotocol/server` SDK v2.
2. **Transaction Routing:** Multi-round-trip requests carry and propagate `Mcp-Transaction-Id` and `X-SmartSapp-Correlation-Id`.
3. **Multi-Tenant Security:** Anti-IDOR tenant binding verified; external caller-selected tenant headers strictly blocked.
4. **Cloud Run Limits:** 32MB payload ceiling enforced at ingress; oversized requests rejected with HTTP 413.
5. **Dead-Man Controls:** Rule 60 emergency dead-man switch pauses execution with HTTP 503 `MCP_EXECUTION_PAUSED`.
6. **Banned Features:** Sticky SSE connections and `Mcp-Session-Id` are strictly rejected.
7. **Zero Regression:** All preexisting test suites (baseline, legacy MCP, memory, identity) pass 100%.
8. **Code Quality:** Project passes typecheck and lint with zero errors.
