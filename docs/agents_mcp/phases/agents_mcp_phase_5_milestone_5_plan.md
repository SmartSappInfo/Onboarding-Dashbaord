# Phase 5 Milestone 5 Implementation Plan
## Native In-Process Genkit Adapter, External Client Interop, Supply-Chain DNS Pinning & Strangler Fig Bridge
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (All 69 Rules) & Milestone 3 Review Recommendations

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the final, unifying milestone of Phase 5 by providing a native in-process Genkit tool adapter for internal agents, validating external MCP client interoperability (Cursor, Claude Desktop, custom HTTP clients), eliminating TOCTOU DNS-rebinding attacks via outbound DNS pinning (addressing Milestone 3 Review Recommendation #2), harmonizing legacy MCP and modern capability registries via a bi-directional Strangler Fig bridge (Rule 69), and conducting comprehensive adversarial red-team and regression verification across all Phase 5 milestones without compromising existing functionality.

**Architecture:**
1. **In-Process Genkit Tool Adapter (`src/platform/mcp/adapters/genkit-tool-adapter.ts`):** Converts canonical `CapabilityDefinition` records into Genkit tools compatible with `ai.defineTool`. Binds execution directly in-memory without HTTP network serialization overhead, while enforcing all security invariants: tenant scoping, agent principal authority (`evaluatePrincipalAuthority`), non-delegable action stripping (Rule 17), tool fingerprint drift verification (Rule 14), content-aware egress policy evaluation (Rule 32/33), dead-man switch evaluation (Rule 60), shadow-mode dry-run support (Rule 42), and append-only audit event emission (Rule 40).
2. **Outbound DNS Pinning & Anti-Rebinding Guard (`src/platform/mcp/security/safe-dns-pinning.ts`):** Implements socket-level IP resolution, caching, and pinning (`safeFetchWithDnsPinning`) for outbound HTTP/SSE external server connections. Resolves hostnames once, validates resolved IP addresses against Cloud Run metadata (`169.254.169.254`), loopback, and RFC-1918 subnets, and forces socket connections directly to the pinned IP while preserving original `Host` headers—permanently neutralizing Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks (Milestone 3 Review Rec #2).
3. **External Client Interoperability Test Harness (`src/platform/__tests__/mcp/client-interop.test.ts`):** Validates end-to-end integration over Streamable HTTP endpoints (`/api/mcp/v2/[domain]`) simulating real-world MCP clients (Cursor, Claude Desktop). Covers `initialize` handshake, `tools/list` progressive discovery with ETag conditional validation (HTTP 304), and `tools/call` invocation with transaction/correlation ID propagation.
4. **Strangler Fig Bi-Directional Bridge (`src/platform/mcp/bridge/strangler-bridge.ts`):** Establishes bi-directional synchronization between `src/lib/mcp/registry.ts` and `src/platform/capabilities/registry/capability-registry.ts`. Ensures legacy tools and modern capabilities are interchangeably available and that all 21 preexisting legacy tests pass with zero regression (Rule 69).
5. **Full Platform QA & Adversarial Red-Team Suite (`src/platform/__tests__/mcp/mcp-full-qa.test.ts`, `adversarial-red-team.test.ts`):** Exercises end-to-end platform workflows, edge cases, fault injection, and adversarial attacks (prompt injection, rug-pull drift, cross-tenant leaks, SSRF rebinding, dead-man pause, non-delegable bypass).

**Tech Stack:** Next.js 15 App Router, TypeScript (Strict, Zero `any`/`any[]`), Genkit (`^1.42.0`), `@modelcontextprotocol/server` (2.1.0), Zod v4, Node.js `crypto`, Node.js `dns`, EventBus (`defaultEventBus`), Vitest.

---

## 1. Master 69-Rules Compliance Audit & Architectural Matrix

The following matrix systematically maps the rules from `docs/agents_mcp/agents_mcp_rules.md` to their concrete architectural enforcement in Phase 5 Milestone 5:

### 1.1 Core Execution, Protocol & Supply-Chain Rules (Rules 11, 14, 15, 16, 17, 34, 69)

| Rule # | Principle / Invariant | Specific Milestone 5 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 11** | **MCP Spec 2026-07-28 & SDK v2** | Streamable HTTP endpoints and external client interop harness validate full compliance with MCP `2026-07-28` specification: JSON-RPC 2.0 handshake, progressive discovery, standard error formats, and transaction tracing. |
| **Rule 14** | **MCP Tool Poisoning / Rug-Pull Defense** | In-process Genkit adapter evaluates `verifyCapabilityFingerprint` before invoking any capability. Any unapproved drift in schema, permissions, descriptions, or risk classification blocks execution with `TOOL_FINGERPRINT_DRIFT`. |
| **Rule 15** | **Server Allowlisting & Supply-Chain Controls** | External server invocations and subscriptions enforce the formal 8-stage allowlist lifecycle. Dispatches to unapproved or suspended servers fail closed. |
| **Rule 16** | **Agent Identity as Principal** | Internal agent execution via Genkit adapter evaluates `evaluatePrincipalAuthority` against the agent's `grantedScopes`. Tools outside granted scopes are stripped or blocked. |
| **Rule 17** | **Non-Delegable Action Stripping** | In-process adapter unconditionally strips capabilities marked `isNonDelegable: true` from agent tool sets (`createGenkitToolsForAgent`). |
| **Rule 34** | **Universal SSRF Guard & DNS Pinning** | Implements socket-level DNS pinning (`safeFetchWithDnsPinning`), resolving IP addresses once and pinning the connection to prevent TOCTOU DNS rebinding targeting GCP metadata (`169.254.169.254`) or loopback (Milestone 3 Review Rec #2). |
| **Rule 69** | **Strangler Fig Pattern SSOT** | Bi-directional bridge (`strangler-bridge.ts`) harmonizes `src/lib/mcp/registry.ts` and `src/platform/capabilities/registry/capability-registry.ts`. All 21 legacy MCP tests pass 100% without regression. |

### 1.2 Type Safety, Security & Fault-Tolerance Rules (Rules 1, 2, 4, 8, 9, 10, 12, 13, 18, 19, 20, 21, 22, 23, 24, 28, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 42, 47, 48, 50, 51, 52, 54, 56, 58, 60, 61, 62, 64, 66, 67, 68)

| Rule # | Principle / Invariant | Specific Milestone 5 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 1 & 4** | **Zero `any` / Zero `any[]`** | Strict typing across all Genkit adapters, interop harnesses, DNS pinners, and bridge utilities. `unknown` is narrowed immediately at external boundaries via Zod schemas. Zero `any` or `any[]` across all code. |
| **Rule 2** | **Architecture for Failure** | Comprehensive fault injection and error recovery: handles upstream timeouts, DNS resolution failures, store degradation, and payload rejection gracefully. |
| **Rule 8 & 47** | **Multi-Tenancy & Anti-IDOR** | In-process adapter immutably binds the authenticated principal's `organizationId` and `workspaceId` into `CapabilityExecutionContext`. Cross-tenant parameters are rejected with fail-closed errors. |
| **Rule 9** | **Cloud Run 32MB Ceiling** | Interop harness tests that ingress requests $> 32\text{MB}$ receive HTTP 413 `PAYLOAD_TOO_LARGE`. In-process tool execution operates within memory bounds. |
| **Rule 10** | **Inline Architectural Documentation** | Every authored file includes a comprehensive `@fileOverview` detailing invariants, security models, testability, failure modes, and maintainer pointers. |
| **Rule 12** | **Annotations Are Hints** | Risk levels and execution requirements are enforced on the server/in-process engine independently of model-provided hints or tool descriptions. |
| **Rule 13** | **Never Trust the Model** | Model-generated tool arguments are parsed through runtime Zod schemas before reaching capability business logic. Tool outputs pass through egress scanning. |
| **Rule 18 & 19** | **TOCTOU Concurrency & Idempotency** | In-process executions maintain idempotency keys; mutations verify state versioning to prevent race conditions. |
| **Rule 20 & 39** | **Distributed Tracing & Correlation IDs** | Propagates `mcp-transaction-id`, `x-smartsapp-correlation-id`, and W3C `traceparent` across in-process Genkit executions and remote HTTP dispatches. |
| **Rule 21 & 22** | **Human Approval & Hash Binding** | High-risk capabilities (L3/L4) trigger Proposal Interception when invoked autonomously, requiring cryptographic hash binding and operator signature before execution. |
| **Rule 23** | **Bounded Loops & Depth** | Traversal depth and retry loops in the interop client harness are bounded to prevent infinite hangs. |
| **Rule 24** | **Circuit Breaker & Fallback** | In-process adapter gracefully falls back to structured error responses when underlying services degrade, maintaining fail-closed semantics. |
| **Rule 28 & 54** | **Performance & Context Budgets** | In-process tool conversion adds $< 1\text{ms}$ overhead; discovery payload token budgets remain capped at $\le 1500$ tokens. |
| **Rule 30** | **Untrusted Reference Data Isolation** | Interop responses and test fixtures format untrusted data inside `<untrusted_reference_data id="...">` containers. |
| **Rule 31** | **Tool Description Engineering** | In-process adapter validates that live capability descriptions match their approved fingerprint hashes, preventing silent prompt-injection poisoning. |
| **Rule 32 & 33** | **Egress Policy & Redaction** | Tool outputs from in-process Genkit executions pass through `EgressDataPolicyEngine` before returning to the model context. Sensitive credentials/PII are blocked or redacted. |
| **Rule 35** | **Discovery Cache Invalidation** | Registry bridge updates trigger discovery cache invalidation via EventBus events. |
| **Rule 36** | **Capability SemVer Versioning** | In-process adapter pairs tool names with canonical SemVer versions. |
| **Rule 37** | **Spec Compatibility Testing** | Client interop suite verifies protocol handshake and execution against MCP specification 2026-07-28. |
| **Rule 38** | **Banned Deprecated Features** | Zero use of deprecated session stickiness (`Mcp-Session-Id`) or deprecated SDK v1 interfaces. |
| **Rule 40** | **Append-Only Audit Logging** | In-process adapter emits `mcp.tool.invoked` events with execution duration, actor, entity, and outcome to `defaultEventBus`. |
| **Rule 42** | **Shadow Mode Simulation** | Capabilities supporting dry-run (`execution.supportsDryRun: true`) can be executed in shadow mode without side effects. |
| **Rule 48** | **Sanitize Tool Errors** | Rejections return sanitized error codes (`TOOL_FINGERPRINT_DRIFT`, `SSRF_EGRESS_BLOCKED`, `MCP_DEAD_MAN_PAUSED`) without leaking internal stack traces. |
| **Rule 50** | **Multi-Tenant Cache Isolation** | DNS and adapter cache keys partition cleanly by `organizationId` and `workspaceId`. |
| **Rule 51** | **Authenticated Gate** | In-process execution requires an authenticated `AgentPrincipal` or user principal. |
| **Rule 52** | **Client/Server Boundary** | Zero secrets, private API keys, or raw connection strings leaked into tool schemas or outputs. |
| **Rule 56** | **Context Compression** | Output schemas and descriptions are compact to prevent LLM context saturation. |
| **Rule 58** | **Model Routing Policy** | In-process tool definitions preserve domain and risk annotations enabling intelligent model routing. |
| **Rule 60** | **Emergency Dead-Man Controls** | When emergency dead-man pause is tripped, both in-process Genkit tool execution and remote HTTP dispatches fail closed with `MCP_EXECUTION_PAUSED`. |
| **Rule 61** | **Surface Isolation (`APP_SURFACE`)** | Restricts administrative operations and `system` domain execution to `APP_SURFACE=backoffice`. |
| **Rule 62** | **Security Command Center & Real-Time SSE** | Real-time SSE streams reflect in-process and remote tool invocations without client polling. |
| **Rule 64** | **Non-Interactive Resilience** | Background tasks and agent workflows execute safely without hanging on unhandled interactive prompts. |
| **Rule 66 & 67** | **The Agent Implementation Gate** | 100% compliance across all 10 architectural criteria verified prior to milestone completion. |
| **Rule 68** | **Five Non-Negotiable Rules** | Model is not a boundary; outputs are untrusted; idempotent execution; bounded authority; operable without code. |

---

## 2. File Decomposition & Responsibility Map

```
src/platform/mcp/
├── adapters/
│   ├── genkit-tool-adapter.ts          # In-process capability conversion to Genkit ToolAction (Task 1)
│   ├── genkit-adapter-types.ts         # Types, options, and error taxonomy for Genkit adapter (Task 1)
│   └── index.ts                        # Public barrel for adapters
├── security/
│   ├── safe-dns-pinning.ts             # Socket-level DNS resolution, IP caching & anti-rebinding guard (Task 3)
│   └── index.ts                        # (Augment) Export safe-dns-pinning
├── bridge/
│   ├── strangler-bridge.ts             # Bi-directional sync between legacy and canonical capability registries (Task 4)
│   └── index.ts                        # Public barrel for bridge
└── index.ts                            # Platform MCP public exports

src/platform/__tests__/mcp/
├── genkit-tool-adapter.test.ts         # In-process tool conversion, policy check, drift check, egress scan (Task 1)
├── client-interop.test.ts              # Cursor & Claude Desktop HTTP simulation over /api/mcp/v2 (Task 2)
├── safe-dns-pinning.test.ts            # Socket-level DNS pinning, IP validation, rebinding defense (Task 3)
├── strangler-bridge.test.ts            # Bi-directional registry sync and legacy test compatibility (Task 4)
├── mcp-full-qa.test.ts                 # Full platform QA regression across all 5 milestones (Task 5)
└── adversarial-red-team.test.ts        # Fault injection, prompt injection, rug-pull, SSRF, dead-man attacks (Task 5)
```

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Native In-Process Genkit Tool Adapter
**Files:**
- Create: `src/platform/mcp/adapters/genkit-adapter-types.ts`
- Create: `src/platform/mcp/adapters/genkit-tool-adapter.ts`
- Create: `src/platform/mcp/adapters/index.ts`
- Test: `src/platform/__tests__/mcp/genkit-tool-adapter.test.ts`
- Rules: **Rule 1, Rule 4, Rule 8, Rule 10, Rule 12, Rule 13, Rule 14, Rule 16, Rule 17, Rule 20, Rule 31, Rule 32, Rule 33, Rule 40, Rule 42, Rule 47, Rule 48, Rule 60**

- [ ] **Step 1: Define `genkit-adapter-types.ts`**
  - Define `GenkitToolAdapterOptions` (principal, tenant, bypassEgressScan, eventBus, toolFingerprintStore, dryRun).
  - Define `GenkitToolExecutionResult` and structured error taxonomy `GENKIT_ADAPTER_ERROR_CODES` (`DEAD_MAN_PAUSED`, `FINGERPRINT_DRIFT`, `PRINCIPAL_UNAUTHORIZED`, `NON_DELEGABLE_ACTION`, `DATA_EXFILTRATION_BLOCKED`, `EXECUTION_FAILED`).
  - Strict zero `any` / zero `any[]` typing.
- [ ] **Step 2: Implement `genkit-tool-adapter.ts`**
  - Implement `createGenkitToolFromCapability(cap, options)`:
    * Wraps `cap.inputSchema` and `cap.outputSchema` cleanly for Genkit.
    * Executes in-memory without HTTP network call.
    * Evaluates `checkGovernanceDeadManSwitch` (Rule 60).
    * Evaluates `verifyCapabilityFingerprint` against `ToolFingerprintStore` (Rule 14).
    * Evaluates `evaluatePrincipalAuthority` for `AgentPrincipal` (Rule 16).
    * Respects `dryRun` mode for capabilities where `execution.supportsDryRun: true` (Rule 42).
    * Executes `cap.execute(input, context)`.
    * Scans output via `EgressDataPolicyEngine` (Rule 32/33).
    * Emits `mcp.tool.invoked` domain event via `EventBus` (Rule 40).
  - Implement `createGenkitToolsForDomain(domain, options)`.
  - Implement `createGenkitToolsForAgent(principal, domains, options)`.
- [ ] **Step 3: Author and execute `genkit-tool-adapter.test.ts`**
  - Verify in-process tool conversion and execution.
  - Verify dead-man pause blocks execution with `DEAD_MAN_PAUSED`.
  - Verify fingerprint drift blocks execution with `FINGERPRINT_DRIFT`.
  - Verify non-delegable actions stripped for agents.
  - Verify egress exfiltration scanner blocks sensitive output.
  - Verify audit event published on execution.

---

### Task 2: External Client Interoperability Test Harness
**Files:**
- Create: `src/platform/__tests__/mcp/client-interop.test.ts`
- Rules: **Rule 9, Rule 11, Rule 20, Rule 28, Rule 35, Rule 37, Rule 38, Rule 48**

- [ ] **Step 1: Implement `client-interop.test.ts`**
  - Construct an HTTP client simulator modeling Cursor and Claude Desktop.
  - Test Case 1: `initialize` handshake negotiating protocol `2026-07-28` and server capabilities.
  - Test Case 2: `tools/list` progressive discovery returning Draft-2020-12 input schemas and ETag headers.
  - Test Case 3: HTTP 304 `Not Modified` response when client sends matching `If-None-Match`.
  - Test Case 4: `tools/call` invoking capability with parameters, validating response content format (`[{ type: "text", text: ... }]`).
  - Test Case 5: Propagation of `Mcp-Transaction-Id` and `X-SmartSapp-Correlation-Id`.
  - Test Case 6: Cloud Run 32MB payload ceiling rejection (HTTP 413).
  - Test Case 7: Sanitized JSON-RPC error codes on failure.

---

### Task 3: Supply-Chain Hardening & DNS Pinning (Milestone 3 Rec #2)
**Files:**
- Create: `src/platform/mcp/security/safe-dns-pinning.ts`
- Modify: `src/platform/mcp/security/server-allowlist-service.ts`
- Modify: `src/platform/mcp/security/index.ts`
- Test: `src/platform/__tests__/mcp/safe-dns-pinning.test.ts`
- Rules: **Rule 4, Rule 8, Rule 10, Rule 15, Rule 34, Rule 50**

- [ ] **Step 1: Implement `safe-dns-pinning.ts`**
  - Implement `resolveAndValidateIp(hostname)`: resolves A/AAAA records via `dns.promises.resolve` and verifies no addresses fall within Cloud Run metadata (`169.254.169.254`), loopback (`127.0.0.1`), or private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Implement `safeFetchWithDnsPinning(url, options)`: connects to the pre-validated IP address while maintaining the original `Host` header and SNI hostname.
  - Cache validated IP with TTL (60s) to prevent redundant DNS queries and prevent TOCTOU DNS rebinding.
- [ ] **Step 2: Integrate into `ServerAllowlistService`**
  - Connect `safeFetchWithDnsPinning` to external server health checks and SSE connections.
- [ ] **Step 3: Author and execute `safe-dns-pinning.test.ts`**
  - Verify resolution of valid public IPs.
  - Verify immediate rejection of DNS rebinding targeting GCP metadata (`169.254.169.254`).
  - Verify socket connection uses pinned IP with correct `Host` header.

---

### Task 4: Strangler Fig Bi-Directional Bridge & Registry Harmonization
**Files:**
- Create: `src/platform/mcp/bridge/strangler-bridge.ts`
- Create: `src/platform/mcp/bridge/index.ts`
- Modify: `src/lib/mcp/registry.ts`
- Test: `src/platform/__tests__/mcp/strangler-bridge.test.ts`
- Rules: **Rule 4, Rule 8, Rule 10, Rule 69**

- [ ] **Step 1: Implement `strangler-bridge.ts`**
  - Bi-directional bridge synchronizing `src/lib/mcp/registry.ts` and `src/platform/capabilities/registry/capability-registry.ts`.
  - Expose `harmonizeMcpRegistries()`: ensures capabilities registered in the platform registry are accessible to legacy MCP callers and vice versa.
  - Prevents circular dependency loops and duplicate execution layers.
- [ ] **Step 2: Author and execute `strangler-bridge.test.ts`**
  - Verify modern capabilities can be resolved through legacy registry adapter.
  - Verify legacy tools can be resolved through canonical capability registry.
  - Verify all 21 preexisting tests in `src/lib/mcp/__tests__/` pass 100%.

---

### Task 5: Comprehensive QA & Adversarial Red-Team Suite
**Files:**
- Create: `src/platform/__tests__/mcp/mcp-full-qa.test.ts`
- Create: `src/platform/__tests__/mcp/adversarial-red-team.test.ts`
- Rules: **Rule 2, Rule 4, Rule 8, Rule 13, Rule 14, Rule 15, Rule 17, Rule 30, Rule 32, Rule 34, Rule 47, Rule 48, Rule 60**

- [ ] **Step 1: Implement `mcp-full-qa.test.ts`**
  - End-to-end regression covering all Phase 5 milestones (Transport, Discovery, Fingerprinting, Allowlisting, Console, Genkit Adapter).
  - Fault injection: Server timeout, malformed payload, store unavailability.
- [ ] **Step 2: Implement `adversarial-red-team.test.ts`**
  - Red-team Attack 1: Indirect prompt injection in tool execution return value (Rule 13, 30).
  - Red-team Attack 2: Silent schema tampering / rug-pull drift attempt (Rule 14).
  - Red-team Attack 3: Cross-tenant data extraction attempt (IDOR, Rule 8, 47).
  - Red-team Attack 4: SSRF DNS rebinding attempt against GCP metadata (Rule 34 + DNS Pinning).
  - Red-team Attack 5: Emergency kill-switch bypass attempt (Rule 60).
  - Red-team Attack 6: Unprivileged agent executing non-delegable action (Rule 16, 17).
  - Red-team Attack 7: Sensitive data exfiltration attempt through tool outputs (Rule 32, 33).

---

### Task 6: Verification, Typecheck, Lint & Master Implementation Gate
**Files:**
- Create: `docs/agents_mcp/phases/agents_mcp_phase_5_milestone_5_completion_report.md`
- Rules: **Rule 4, Rule 66, Rule 67, Rule 68, Rule 69**

- [ ] **Step 1: Execute all platform test suites**
  - Run all MCP tests: `pnpm vitest run src/platform/__tests__/mcp/`
  - Run all UI tests: `pnpm vitest run src/platform/__tests__/ui/`
  - Run legacy regression tests: `pnpm vitest run src/lib/mcp/__tests__/`
- [ ] **Step 2: Execute static analysis and compilation**
  - Run full TypeScript typecheck: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Run ESLint static analysis: `pnpm lint`
- [ ] **Step 3: Verify all 10 criteria of the Phase 5 Master Implementation Gate**

---

## 4. Implementation Gate: 10 Architectural Criteria

Before Phase 5 Milestone 5 and Phase 5 as a whole are declared complete, all 10 criteria must be verified:

1. [ ] **In-Process Genkit Execution:** Internal agents execute capabilities directly in-memory via `GenkitToolAdapter` without HTTP network serialization overhead, while maintaining full policy and audit checks.
2. [ ] **External Client Protocol Compliance:** Cursor, Claude Desktop, and standard HTTP clients successfully complete protocol handshake (`initialize`), discovery (`tools/list`), and execution (`tools/call`) over `/api/mcp/v2/[domain]`.
3. [ ] **Outbound DNS Pinning (Milestone 3 Rec #2):** Outbound connections validate and pin resolved IP addresses, permanently closing TOCTOU DNS rebinding windows targeting GCP metadata (`169.254.169.254`).
4. [ ] **Supply-Chain Rug-Pull Defense:** In-process and remote tool invocations fail closed with `TOOL_FINGERPRINT_DRIFT` if material schemas, permissions, or risk levels diverge without formal re-consent (Rule 14).
5. [ ] **Non-Delegable Action Stripping:** Administrative and sensitive actions (`isNonDelegableAction`) are stripped from agent tool catalogs and blocked from delegated execution (Rule 17).
6. [ ] **Rule 60 Dead-Man Controls:** Emergency kill switch halts both in-process and remote tool dispatches with `MCP_EXECUTION_PAUSED`.
7. [ ] **Rule 69 Strangler Fig Invariant:** Bi-directional synchronization maintains full compatibility with legacy `src/lib/mcp/`, and all 21 legacy MCP tests pass cleanly.
8. [ ] **Adversarial Red-Team Resilience:** The platform repels prompt injection, IDOR tenant crossing, metadata SSRF, and unprivileged execution in red-team tests.
9. [ ] **Zero `any` / Zero `any[]`:** Absolute strict typing across all authored adapters, bridges, security utilities, and test suites (Rule 4).
10. [ ] **Clean Production Verification:** Project-wide TypeScript typechecking (`pnpm typecheck`) and ESLint static analysis pass with 0 errors.
