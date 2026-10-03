# Phase 5 Milestone 3 Implementation Plan
## Cryptographic Tool Fingerprinting, Server Allowlisting & Supply-Chain Security
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (All 69 Rules)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect SmartSapp against tool poisoning, silent schema tampering, adversarial "rug-pull" attacks (Rule 14), unauthorized external MCP servers (Rule 15), Server-Side Request Forgery (SSRF) targeting Cloud Run metadata (Rule 34), and cross-domain data exfiltration (Rules 32 & 33) by implementing cryptographic SHA-256 tool fingerprinting, a multi-tenant Server Allowlist lifecycle engine, and a content-aware data egress policy scanner.

**Architecture:** 
1. **Tool Fingerprint Service (`ToolFingerprintService`):** Computes canonical SHA-256 digests over tool metadata ($toolId \parallel version \parallel descriptionHash \parallel schemaHash \parallel permissionHash \parallel riskHash$). Enforces runtime drift detection against approved fingerprints stored in `/mcp_tool_fingerprints`, failing closed with `TOOL_FINGERPRINT_DRIFT` and alerting via `EventBus` whenever material parameters, permissions, or risk levels diverge without formal re-consent.
2. **Server Allowlist Service (`ServerAllowlistService`):** Implements the formal 8-stage lifecycle (`DISCOVERED → REVIEWED → TESTED → APPROVED → CONNECTED → MONITORED`) for external MCP servers. Binds outbound connections to `validateSafeEgressUrl` to unconditionally block private IPs, loopback, and the Google Cloud metadata server (`169.254.169.254`).
3. **Data Egress Policy Engine (`EgressDataPolicyEngine`):** Scans tool input and output payloads for sensitive classifications (`public`, `internal`, `confidential`, `restricted`, `financial`, `personal`, `credential`), detecting API keys, JWTs, and PII to prevent unauthorized exfiltration through external channels (email, webhooks, external MCP tools).

**Tech Stack:** Next.js 15 App Router, TypeScript (Strict, Zero `any`/`any[]`), Node.js `crypto`, Zod v4, Undici (SSRF Guard), Firestore (`/mcp_tool_fingerprints`, `/mcp_server_allowlist`), EventBus (`defaultEventBus`), Vitest.

---

## 1. Master 69-Rules Compliance Audit & Architectural Matrix

The following matrix systematically maps every rule from `docs/agents_mcp/agents_mcp_rules.md` to its concrete architectural enforcement in Phase 5 Milestone 3:

### 1.1 Core Security & Supply-Chain Rules (Rules 14, 15, 32, 33, 34)

| Rule # | Principle / Invariant | Specific Milestone 3 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 14** | **MCP Tool Poisoning / Rug-Pull Defense** | **Single Source of Truth Tool Fingerprinting:** Computes deterministic SHA-256 hash over $toolId \parallel version \parallel descriptionHash \parallel schemaHash \parallel permissionHash \parallel riskHash$. At runtime, compares live capability definition against approved fingerprint in `/mcp_tool_fingerprints`. Any unapproved drift in schema, permissions, descriptions, or risk classification immediately halts execution with structured error `TOOL_FINGERPRINT_DRIFT` and emits `mcp.security.tool_drift_detected` to `EventBus`. |
| **Rule 15** | **Server Allowlisting & Supply-Chain Controls** | **Strict External Server Allowlist:** Implements formal 8-stage lifecycle (`DISCOVERED → REVIEWED → TESTED → APPROVED → CONNECTED → MONITORED → SUSPENDED → REVOKED`). Arbitrary remote server URLs are rejected by default. Execution gate (`assertServerAllowed`) permits dispatch only to servers in `approved`, `connected`, or `monitored` states, failing closed with `MCP_SERVER_NOT_ALLOWED`. |
| **Rule 32** | **Cross-Domain Data-Exfiltration Detection** | **Data Egress Classification:** Tool outputs and arguments are classified into 7 sensitivity tiers: `public`, `internal`, `confidential`, `restricted`, `financial`, `personal`, `credential`. Detects attempts where confidential/restricted data read from internal domains (CRM, Memory) is directed into external output channels (email, webhook, external MCP) without authorization. |
| **Rule 33** | **Egress Control** | **Channel Authorization Policy:** Outbound channels enforce strict allowed destinations, payload classes, and credential redactions. High-risk channels (external webhooks, external MCP servers) strictly block credentials and unencrypted financial/PII payloads. |
| **Rule 34** | **SSRF & Network Boundary Controls** | **Universal Outbound SSRF Guard:** All external server registration URLs and outbound network dispatches pass `validateSafeEgressUrl` before network socket creation. Unconditionally blocks `http://169.254.169.254/*` (GCP Metadata), `http://metadata.google.internal/*`, `localhost`, `127.0.0.1`, `::1`, and RFC-1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). |

### 1.2 Type Safety, Multi-Tenancy & Platform Foundations (Rules 4, 5, 8, 9, 10, 50)

| Rule # | Principle / Invariant | Specific Milestone 3 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 4** | **Zero `any` / Zero `any[]`** | Absolute type safety across all security primitives, stores, scanners, and schemas. Unvalidated external data is typed `unknown` and narrowed via Zod v4 schemas (`ToolFingerprintSchema`, `McpServerRegistrationSchema`, `EgressEvaluationResultSchema`). |
| **Rule 5** | **Inbound Schema Validation** | All fingerprint approvals, server registration requests, and status transition inputs pass strict runtime Zod parsing before reaching service logic. |
| **Rule 8** | **Tenant Isolation & Anti-IDOR** | All fingerprint records and server allowlist entries are strictly scoped by `organizationId` and `workspaceId`. Multi-tenant composite keys prevent cross-tenant enumeration or configuration pollution. |
| **Rule 9** | **Cloud Run 32MB Ceiling** | Egress scanners and fingerprint hashers operate on bounded payload streams, respecting the Cloud Run 32MB payload ceiling (`CLOUD_RUN_MAX_REQUEST_BODY_SIZE`). No local filesystem persistence; all state is ephemeral in-memory or persisted in Firestore. |
| **Rule 10** | **Inline Architectural Documentation** | Every authored file includes a comprehensive `@fileOverview` detailing invariants, security models, testability, failure modes, and maintainer pointers. |
| **Rule 50** | **Cache & Store Isolation Rules** | In-memory verification caches use multi-tenant composite keys: `mcp:fingerprint:${orgId}:${wsId}:${toolId}:${version}` and `mcp:allowlist:${orgId}:${wsId}:${serverId}`. |

### 1.3 Execution, Governance & Protocol Invariants (Rules 11–13, 16–24, 28, 31, 35–40, 42, 47, 48, 51, 52, 54, 56, 60–69)

| Rule # | Principle / Invariant | Specific Milestone 3 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 11** | **MCP Spec 2026-07-28 & SDK v2** | Security checks integrate seamlessly into `@modelcontextprotocol/server` SDK v2 tool registration and stateless Streamable HTTP dispatch. |
| **Rule 12** | **Annotations Are Hints** | Tool risk levels (L0–L4) and non-delegable flags are cryptographically sealed into the fingerprint and checked server-side regardless of client hints. |
| **Rule 13** | **Never Trust the Model** | Agent-generated tool requests and arguments are subjected to schema validation, allowlist verification, and egress scanning before execution. |
| **Rule 16** | **Agent Identity as Principal** | Fingerprint and allowlist checks respect `AgentPrincipal` boundaries; unprivileged agents cannot invoke tools with drifted or unapproved fingerprints. |
| **Rule 17** | **Non-Delegable Action Stripping** | Banned administrative actions (`isNonDelegableAction`) cannot be approved as delegated tools for agent callers. |
| **Rule 18** | **TOCTOU & Concurrency** | Optimistic concurrency versioning on fingerprint and allowlist record updates (`version`, `updatedAt`). |
| **Rule 19** | **Mutating Idempotency** | Fingerprint approval and allowlist status transitions are idempotent; duplicate approval requests with identical hashes produce identical records. |
| **Rule 20 & 39** | **Distributed Tracing** | Propagates `mcp-transaction-id`, `x-smartsapp-correlation-id`, and W3C `traceparent` through all security checks and audit events. |
| **Rule 21 & 22** | **Human Approval & Hash Binding** | Material fingerprint changes and server approvals require cryptographic hash binding and operator signature before tool re-activation. |
| **Rule 23** | **Bounded Loops & Depth** | Egress payload traversal limits object depth (max 10) and array lengths to prevent ReDoS or resource exhaustion. |
| **Rule 24** | **Circuit Breaker & Fallback** | In-memory fallback cache ensures tool execution continues safely if Firestore is temporarily degraded, maintaining fail-closed semantics. |
| **Rule 28 & 54** | **Performance & Context Budgets** | Fingerprint calculation overhead $< 2\text{ms}$; egress scan overhead $< 10\text{ms}$ on 100KB payloads. |
| **Rule 31** | **Tool Description Engineering** | Tool descriptions are hashed and monitored; silent prompt injection alterations in descriptions trigger drift errors. |
| **Rule 35** | **Discovery Caching Invalidation** | Any tool fingerprint drift or server status change triggers automatic discovery cache eviction via `EventBus`. |
| **Rule 36** | **Capability SemVer Versioning** | Fingerprint binding strictly pairs `toolId` with SemVer `version` (`major.minor.patch`). |
| **Rule 37** | **Spec Compatibility Testing** | Security layer operates seamlessly across MCP 2026-07-28 stateless requests. |
| **Rule 38** | **Banned Deprecated Features** | Zero reliance on legacy sticky sessions or deprecated SDK features. |
| **Rule 40** | **Append-Only Audit Logging** | Emits `mcp.security.tool_drift_detected`, `mcp.security.server_status_changed`, and `mcp.security.exfiltration_blocked` to `defaultEventBus`. |
| **Rule 42** | **Shadow Mode Simulation** | Capabilities advertise `supportsDryRun: true` in metadata where applicable. |
| **Rule 47** | **Execution Gate Invariant** | Model outputs are untrusted; all execution inputs pass through the Security Verification Gate. |
| **Rule 48** | **Sanitize Tool Errors** | Security rejection errors are masked to generic error codes (`TOOL_FINGERPRINT_DRIFT`, `SSRF_EGRESS_BLOCKED`, `MCP_SERVER_NOT_ALLOWED`, `DATA_EXFILTRATION_DETECTED`) with internal details logged. |
| **Rule 51** | **Authenticated Gate** | Security administrative operations (fingerprint approval, allowlist updates) require authenticated admin sessions. |
| **Rule 52** | **Client/Server Boundary** | Zero server secrets or database credentials leaked into tool schemas or error responses. |
| **Rule 56** | **Context Compression** | Compact descriptions prevent LLM context window saturation. |
| **Rule 60** | **Emergency Dead-Man Controls** | If emergency dead-man pause is tripped, allowlist and tool invocation fail closed with HTTP 503 `MCP_EXECUTION_PAUSED`. |
| **Rule 61** | **Surface Isolation (`APP_SURFACE`)** | Server allowlisting and fingerprint approvals are restricted to `APP_SURFACE=backoffice`. |
| **Rule 62** | **Security Command Center & Real-Time SSE** | Security events stream to Backoffice command center via `useEventStream`. |
| **Rule 64** | **Non-Interactive Mode Resilience** | Background tasks and subagents execute safely without hanging prompts. |
| **Rule 66 & 67** | **The Agent Implementation Gate** | 100% compliance across all 10 architectural criteria verified prior to milestone completion. |
| **Rule 68** | **Five Non-Negotiable Rules** | Model is not a boundary; outputs are untrusted; idempotent execution; bounded authority; operable without code. |
| **Rule 69** | **Strangler Fig Pattern SSOT** | Legacy `src/lib/mcp/` remains fully operational with 21/21 passing tests; canonical security wraps legacy and modern tools uniformly. |

---

## 2. File Decomposition & Responsibility Map

```
src/platform/mcp/
├── security/
│   ├── tool-fingerprint-types.ts      # Canonical fingerprint schemas, formula, drift models, Zod validation
│   ├── tool-fingerprint-service.ts    # Fingerprint computation, Firestore/memory store, drift detection, approval lifecycle
│   ├── server-allowlist-types.ts      # External MCP server schemas, lifecycle state (Discovered->Monitored), Zod validation
│   ├── server-allowlist-service.ts    # Allowlist management, SSRF guard wrapping, lifecycle transitions, state enforcement
│   ├── egress-data-policy-types.ts    # Egress sensitivity levels, channel classification, violation taxonomy
│   ├── egress-data-policy.ts          # Egress scanner, credential/PII detector, cross-domain exfiltration policy engine
│   └── index.ts                       # Public barrel exporting all security contracts and services
├── servers/
│   └── domain-mcp-factory.ts          # (Augment) Wire fingerprint check and egress scanner into tool execution
└── transport/
    └── streamable-http-handler.ts     # (Augment) Inject fingerprint drift handling and egress security into handler

src/platform/__tests__/mcp/
├── tool-fingerprint.test.ts           # 8 tests: canonical hashing, schema drift, permission tampering, approval workflow, store isolation
├── server-allowlist.test.ts           # 8 tests: lifecycle state transitions, status gating, SSRF egress validation, anti-IDOR tenant isolation
├── egress-data-policy.test.ts         # 8 tests: classification levels, credential detection, PII exfiltration blocking, channel policy enforcement
└── security-integration.test.ts       # 4 tests: end-to-end integration with domain factory, execution blocking on drift/exfiltration
```

---

## 3. Bite-Sized Implementation Tasks

### Task 1: Tool Fingerprint Types, Canonical Hashing & Drift Models
**Files:**
- Create: `src/platform/mcp/security/tool-fingerprint-types.ts`
- Test: `src/platform/__tests__/mcp/tool-fingerprint.test.ts`
- Rules: **Rule 4, Rule 8, Rule 10, Rule 12, Rule 14, Rule 22, Rule 31, Rule 36**

- [x] **Step 1: Write failing tests for canonical fingerprint computation and drift detection**
  - Verify deterministic SHA-256 fingerprint generation:
    * `computeToolFingerprint(capability)` produces stable 64-char hex digest.
    * Altering parameter schema changes `schemaHash` and `compositeHash`.
    * Altering description changes `descriptionHash` and `compositeHash` (Rule 31).
    * Altering permissions changes `permissionHash` and `compositeHash`.
    * Altering risk level changes `riskHash` and `compositeHash` (Rule 12).
  - Verify drift categorization:
    * Returns `driftType: 'schema' | 'description' | 'permission' | 'risk' | 'version' | 'none'`.
- [x] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/tool-fingerprint.test.ts`
  - Expected: FAIL with missing module.
- [x] **Step 3: Implement `tool-fingerprint-types.ts`**
  - Define `ToolFingerprintSchema`:
    * `toolId: string`
    * `version: string`
    * `schemaHash: string` (SHA-256 of canonical JSON input & output schemas)
    * `descriptionHash: string` (SHA-256 of normalized description)
    * `permissionHash: string` (SHA-256 of canonical JSON sorted permissions)
    * `riskHash: string` (SHA-256 of risk level string)
    * `compositeHash: string` (SHA-256 of all components joined)
    * `approvedAt: string`
    * `approvedBy: string`
    * `organizationId: string`
    * `workspaceId: string`
  - Define `ToolDriftReportSchema` and `FINGERPRINT_ERROR_CODES`.
  - Implement helper `computeToolFingerprint(capability, tenant, approvedBy)`.
- [x] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/tool-fingerprint.test.ts`
  - Expected: PASS.

---

### Task 2: Tool Fingerprint Service & Persistence Store
**Files:**
- Create: `src/platform/mcp/security/tool-fingerprint-service.ts`
- Test: `src/platform/__tests__/mcp/tool-fingerprint.test.ts`
- Rules: **Rule 4, Rule 8, Rule 14, Rule 18, Rule 19, Rule 21, Rule 22, Rule 24, Rule 35, Rule 40, Rule 50**

- [x] **Step 1: Write failing tests for `ToolFingerprintService`**
  - Test registering and approving an initial fingerprint.
  - Test verifying an identical capability returns `isValid: true`.
  - Test verifying a modified capability throws or returns `TOOL_FINGERPRINT_DRIFT`.
  - Test re-approval workflow updating the stored fingerprint with operator signature (Rule 21 & 22).
  - Test `EventBus` publication of `mcp.security.tool_drift_detected` (Rule 40).
  - Test multi-tenant isolation: Tenant A's fingerprint cannot validate Tenant B's capability (Rule 8, 50).
- [x] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/tool-fingerprint.test.ts`
  - Expected: FAIL with missing service.
- [x] **Step 3: Implement `ToolFingerprintService`**
  - Support memory store for unit testing and Firestore collection `/mcp_tool_fingerprints` for production.
  - Implement methods:
    * `computeFingerprint(capability, tenant, approver)`
    * `approveFingerprint(capability, tenant, approverId)`
    * `verifyCapabilityFingerprint(capability, tenant)`
    * `getApprovedFingerprint(toolId, version, tenant)`
    * `listFingerprints(tenant)`
  - Multi-tenant key: `mcp:fingerprint:${tenant.organizationId}:${tenant.workspaceId}:${toolId}:${version}`.
  - Publish `mcp.security.tool_drift_detected` to `EventBus` on drift.
  - Invalidate discovery cache on fingerprint update via EventBus `capability.registered` event (Rule 35).
  - HMR preservation via `globalThis.__smartsappFingerprintService`.
- [x] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/tool-fingerprint.test.ts`
  - Expected: PASS (8/8 tests).

---

### Task 3: Server Allowlist Types & Lifecycle Engine
**Files:**
- Create: `src/platform/mcp/security/server-allowlist-types.ts`
- Test: `src/platform/__tests__/mcp/server-allowlist.test.ts`
- Rules: **Rule 4, Rule 8, Rule 10, Rule 15, Rule 34**

- [x] **Step 1: Write failing tests for server allowlist schemas and lifecycle validation**
  - Verify 8 lifecycle statuses:
    `discovered → reviewed → tested → approved → connected → monitored` (plus `suspended`, `revoked`).
  - Verify valid state transitions:
    * `discovered` can only transition to `reviewed` or `revoked`.
    * `reviewed` can transition to `tested` or `revoked`.
    * `tested` can transition to `approved` or `reviewed`.
    * `approved` can transition to `connected` or `suspended`.
    * `connected` can transition to `monitored` or `suspended`.
    * `monitored` can transition to `suspended` or `revoked`.
    * Invalid transitions throw `INVALID_LIFECYCLE_TRANSITION`.
  - Verify execution gating: only `approved`, `connected`, and `monitored` allow execution.
- [x] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/server-allowlist.test.ts`
  - Expected: FAIL with missing types.
- [x] **Step 3: Implement `server-allowlist-types.ts`**
  - Define `McpServerStatus` union and `McpServerRegistrationSchema`:
    * `serverId: string`
    * `organizationId: string`
    * `workspaceId: string`
    * `serverUrl: string` (Zod `.url()`)
    * `transportType: 'http' | 'sse'`
    * `status: McpServerStatus`
    * `pinnedVersion?: string`
    * `allowedDomains: McpDomain[]`
    * `allowedTools: string[]`
    * `provenance: { vendor?: string, repository?: string, integrityHash?: string }`
    * `reviewedBy?: string`, `reviewedAt?: string`
    * `approvedBy?: string`, `approvedAt?: string`
    * `healthStatus: 'healthy' | 'degraded' | 'unhealthy'`
    * `lastHealthCheckAt?: string`
  - Implement state transition matrix and validation helper `isValidLifecycleTransition(from, to)`.
- [x] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/server-allowlist.test.ts`
  - Expected: PASS.

---

### Task 4: Server Allowlist Service with SSRF Egress Defense
**Files:**
- Create: `src/platform/mcp/security/server-allowlist-service.ts`
- Test: `src/platform/__tests__/mcp/server-allowlist.test.ts`
- Rules: **Rule 4, Rule 8, Rule 15, Rule 18, Rule 24, Rule 34, Rule 40, Rule 60**

- [x] **Step 1: Write failing tests for `ServerAllowlistService`**
  - Test server registration with URL validation.
  - Test SSRF defense: registering `http://169.254.169.254/mcp`, `http://metadata.google.internal/`, `http://localhost:8080`, or `http://10.0.0.1` is strictly rejected with `SSRF_EGRESS_BLOCKED` (Rule 34).
  - Test lifecycle transitions and audit event emission (`mcp.security.server_status_changed`) (Rule 40).
  - Test execution gate: `assertServerAllowed(serverId, tenant)` allows `connected` and throws for `discovered` or `suspended`.
  - Test Rule 60 dead-man pause: if dead-man switch is tripped, all external server execution is paused with HTTP 503 `MCP_EXECUTION_PAUSED`.
- [x] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/server-allowlist.test.ts`
  - Expected: FAIL with missing service.
- [x] **Step 3: Implement `ServerAllowlistService`**
  - Integrate `validateSafeEgressUrl` from `src/platform/security/safe-url-fetch.ts` on server registration and connection URLs.
  - In-memory store for hermetic testing and Firestore `/mcp_server_allowlist` for production.
  - Implement methods:
    * `registerServer(input, tenant, creatorId)`
    * `transitionStatus(serverId, nextStatus, tenant, actorId, notes)`
    * `assertServerAllowed(serverId, tenant)`
    * `getServer(serverId, tenant)`
    * `listServers(tenant)`
  - Multi-tenant isolation: `mcp:allowlist:${tenant.organizationId}:${tenant.workspaceId}:${serverId}`.
  - HMR preservation via `globalThis.__smartsappAllowlistService`.
- [x] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/server-allowlist.test.ts`
  - Expected: PASS (8/8 tests).

---

### Task 5: Data Egress Policy Engine & Exfiltration Detection Scanner
**Files:**
- Create: `src/platform/mcp/security/egress-data-policy-types.ts`
- Create: `src/platform/mcp/security/egress-data-policy.ts`
- Test: `src/platform/__tests__/mcp/egress-data-policy.test.ts`
- Rules: **Rule 4, Rule 9, Rule 13, Rule 23, Rule 32, Rule 33, Rule 40, Rule 48**

- [x] **Step 1: Write failing tests for data egress classification and scanning**
  - Test sensitivity hierarchy: `public < internal < confidential < restricted < financial < personal < credential`.
  - Test detection of credentials (JWT, API keys, private keys, authorization tokens).
  - Test detection of PII / Financial records (credit cards, SSNs).
  - Test bounded depth traversal (max depth 10) preventing recursion exhaustion (Rule 23).
  - Test cross-domain policy check:
    * Passing `confidential` CRM data to `internal_memory` is allowed.
    * Passing `credential` or `financial` data to `external_email` or `external_webhook` is BLOCKED with `DATA_EXFILTRATION_DETECTED` (Rule 32, 33).
    * Redaction mode: sanitizes sensitive patterns when enabled.
  - Test `EventBus` publication of `mcp.security.exfiltration_blocked` (Rule 40).
- [x] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/egress-data-policy.test.ts`
  - Expected: FAIL with missing scanner.
- [x] **Step 3: Implement `egress-data-policy-types.ts` and `egress-data-policy.ts`**
  - Define `SensitivityLevel`: `'public' | 'internal' | 'confidential' | 'restricted' | 'financial' | 'personal' | 'credential'`.
  - Define `EgressDestination`: `'internal_database' | 'internal_memory' | 'external_email' | 'external_webhook' | 'external_mcp_tool' | 'public_portal'`.
  - Implement `EgressDataPolicyEngine`:
    * Pattern matchers: `CREDENTIAL_PATTERNS`, `FINANCIAL_PATTERNS`, `PII_PATTERNS`.
    * `scanPayload(data: unknown): DetectedSensitivity[]`
    * `evaluateEgress(data: unknown, destination: EgressDestination, options?: EgressOptions): EgressEvaluationResult`
    * `sanitizePayload(data: unknown): unknown` (redacts matches with `[REDACTED_SECRET]`)
  - Publish `mcp.security.exfiltration_blocked` on violations.
- [x] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/egress-data-policy.test.ts`
  - Expected: PASS (8/8 tests).

---

### Task 6: Wire Security Gates into MCP Factory & Transport
**Files:**
- Modify: `src/platform/mcp/servers/domain-mcp-factory.ts`
- Modify: `src/platform/mcp/transport/streamable-http-handler.ts`
- Create: `src/platform/mcp/security/index.ts`
- Test: `src/platform/__tests__/mcp/security-integration.test.ts`
- Rules: **Rule 4, Rule 11, Rule 14, Rule 15, Rule 16, Rule 17, Rule 32, Rule 34, Rule 40, Rule 48, Rule 60, Rule 69**

- [x] **Step 1: Write failing integration tests**
  - Test that modifying a registered capability in memory causes tool invocation through `domain-mcp-factory` to fail with `TOOL_FINGERPRINT_DRIFT`.
  - Test that tool execution with egress violations fails closed with `DATA_EXFILTRATION_DETECTED`.
  - Test that unapproved external MCP server requests fail closed with `MCP_SERVER_NOT_ALLOWED`.
  - Test that all legacy tests continue passing (Rule 69 Strangler Invariant).
- [x] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/security-integration.test.ts`
  - Expected: FAIL with unwired gates.
- [x] **Step 3: Wire security engines into MCP execution flow**
  - In `domain-mcp-factory.ts`:
    * Before tool execution: call `toolFingerprintService.verifyCapabilityFingerprint(cap, tenant)`.
    * If drift is detected, abort call with structured error result and audit log.
    * After execution: call `egressPolicyEngine.evaluateEgress(result, destination)`. If blocked, throw or return sanitized error.
  - Export unified security engine singletons and helper functions in `src/platform/mcp/security/index.ts`.
- [x] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/security-integration.test.ts`
  - Expected: PASS (4/4 tests).

---

### Task 7: Full Verification Gates & Quality Checks
**Files:**
- All platform test suites
- Full TypeScript compilation
- ESLint static analysis
- Rules: **Rule 1, Rule 4, Rule 10, Rule 44, Rule 54, Rule 66, Rule 67, Rule 68, Rule 69**

- [x] **Step 1: Run all platform MCP test suites**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/`
  - Expected: 100% PASS across all suites (target $\ge 100$ tests).
- [x] **Step 2: Run legacy MCP tests (Rule 69 Strangler Invariant)**
  - Run: `pnpm vitest run src/lib/mcp/__tests__/`
  - Expected: 21/21 PASS with 0 regressions.
- [x] **Step 3: Run project-wide TypeScript typechecking**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Expected: Clean exit code 0, 0 errors, strict typing preserved (Rule 4).
- [x] **Step 4: Run ESLint on all authored deliverables**
  - Run: `pnpm eslint src/platform/mcp/security/`
  - Expected: Clean exit code 0, 0 errors, 0 warnings.

---

## 4. Architectural Failure Modes & Mitigation Strategies (Rule 2)

| Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **1. Tool Rug-Pull via Schema Alteration** | Malicious or unintentional update to tool arguments or types | Agent executes unintended commands or injects hostile payloads | Canonical SHA-256 fingerprint verification at execution time. Any diff between database record and live definition halts execution immediately (Rule 14). |
| **2. SSRF via External Server URL** | Malicious administrator or model input pointing MCP server to `169.254.169.254` | Exfiltration of Google Cloud IAM service account token | All server URLs pass `validateSafeEgressUrl` before registration or network dispatch, blocking link-local, loopback, and private subnets (Rule 34). |
| **3. Cross-Tenant Allowlist Pollution** | Shared allowlist across organizations | Tenant B connects to Tenant A's internal MCP server | All allowlist and fingerprint records are prefixed with `orgId:wsId`. Multi-tenant queries filter strictly by caller identity (Rule 8, 50). |
| **4. Silent PII Exfiltration via Agent** | Agent reads CRM contacts and posts data into external webhook or marketing channel | Customer data leak violating GDPR/CCPA | `EgressDataPolicyEngine` inspects tool outputs for credentials and PII, enforcing strict clearance rules per channel (Rule 32, 33). |
| **5. Database Outage during Verification** | Firestore temporary unavailability during tool invocation | False-positive security blocks or complete platform halt | In-memory verified cache with 5-minute TTL allows uninterrupted validation during brief database blips while preserving fail-closed semantics (Rule 24). |
| **6. Regex Catastrophic Backtracking (ReDoS)** | Nested structures in tool output matched by complex regex | CPU thread starvation on Cloud Run instance | Enforce max scanning payload size (100KB), max object depth (10), and use linear non-backtracking regex patterns (Rule 9, 23). |

---

## 5. The 10-Criteria Implementation Gate Verification (Rules 66 & 67)

Before marking Phase 5 Milestone 3 as complete, the following 10 mandatory criteria must be strictly verified:

1. [x] **Criteria 1 (Contract & Fingerprint Coverage):** Every canonical tool has an approved cryptographic SHA-256 fingerprint binding $toolId \parallel version \parallel descriptionHash \parallel schemaHash \parallel permissionHash \parallel riskHash$.
2. [x] **Criteria 2 (Rug-Pull Defense Active):** Runtime fingerprint drift check fails closed with `TOOL_FINGERPRINT_DRIFT` upon any unapproved modification.
3. [x] **Criteria 3 (Server Allowlist Enforced):** External MCP server requests verify status $\in \{\text{'approved'}, \text{'connected'}, \text{'monitored'}\}$; unapproved servers fail closed.
4. [x] **Criteria 4 (Universal SSRF Defense):** External server connections validate against `validateSafeEgressUrl`, blocking `169.254.169.254`, `metadata.google.internal`, and RFC-1918 IPs.
5. [x] **Criteria 5 (Data Egress Scanner Active):** Egress policy inspects payloads for credentials and PII, blocking cross-domain exfiltration.
6. [x] **Criteria 6 (Audit & EventBus Propagation):** Security events (`mcp.security.tool_drift_detected`, `mcp.security.server_status_changed`, `mcp.security.exfiltration_blocked`) publish to `defaultEventBus`.
7. [x] **Criteria 7 (Strict Multi-Tenancy):** Fingerprints, allowlists, and egress policies are isolated by `organizationId` and `workspaceId`.
8. [x] **Criteria 8 (Emergency Dead-Man Gate):** Rule 60 kill-switch immediately disables external server invocation with HTTP 503 `MCP_EXECUTION_PAUSED`.
9. [x] **Criteria 9 (Zero Regression / Strangler Invariant):** All 21 legacy MCP tests pass without regression (Rule 69).
10. [x] **Criteria 10 (Zero `any` / Zero `any[]`):** Complete codebase typecheck exits 0 with zero `any` types (Rule 4).

---

## 6. The Five Non-Negotiable Axioms (Rule 68)

1. **The Model Is Never the Security Boundary:** Authorization, risk gating, fingerprinting, and egress scanning are enforced in server-side TypeScript code, never in LLM prompts.
2. **Model Outputs Are Always Untrusted:** Every tool argument, proposal, and output is validated via Zod schemas and egress scanners before execution or client dispatch.
3. **Idempotency & Replay Protection:** Fingerprint approvals and allowlist status mutations are strictly idempotent.
4. **Bounded Authority & Monotonic Downward Scope:** External MCP servers cannot escalate privileges beyond the tenant's assigned boundaries.
5. **Operability Without Code Deployments:** Operators can suspend, revoke, or re-approve fingerprints and external servers dynamically through Firestore/Backoffice controls.

---

## 7. Definition of Done for Phase 5 Milestone 3

Milestone 3 will be marked complete only when:
1. `ToolFingerprintService` deterministically hashes tool components, detects schema/description/permission drift, and fails closed on unapproved modifications (Rule 14).
2. `ServerAllowlistService` enforces the 8-stage lifecycle and blocks SSRF egress to Google Cloud metadata and private IPs (Rule 15, 34).
3. `EgressDataPolicyEngine` detects credentials and PII, blocking unauthorized cross-domain data leakage (Rule 32, 33).
4. All platform MCP tests pass 100% (target $\ge 100$ tests).
5. All legacy MCP tests (21/21) pass 100% with zero regressions (Rule 69).
6. TypeScript static compilation (`pnpm typecheck`) exits 0 with zero `any` or `any[]` (Rule 4).
7. ESLint passes cleanly with 0 errors and 0 warnings.
8. Architectural code review is conducted with the Senior Principal Systems & AI Agentic Architecture Reviewer.
