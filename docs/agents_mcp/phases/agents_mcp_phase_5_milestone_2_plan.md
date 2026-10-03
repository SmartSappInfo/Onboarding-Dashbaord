# Phase 5 Milestone 2 Implementation Plan
## Domain-Partitioned MCP Servers & Progressive Tool Discovery Engine
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (All 69 Rules)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partition SmartSapp's canonical capability ecosystem into 6 focused Model Context Protocol (Spec 2026-07-28) domain servers (`crm`, `knowledge`, `messaging`, `sales`, `portals`, `system`), implement a multi-tenant Progressive Tool Discovery Engine with TTL caching, SHA-256 `discoveryETag` validation, and strict token budgeting (< 1,500 tokens) to eliminate LLM context bloat, enforce Least Privilege, and prevent cross-tenant data leakage.

**Architecture:** A decoupled domain factory (`createDomainMcpServer`) queries the canonical capability registry, applies least-privilege filtering based on the authenticated `AgentPrincipal.grantedScopes`, enforces surface isolation for backoffice domains (Rule 61), and maps capabilities into standard MCP tools. An in-memory, tenant-isolated cache manager (`DiscoveryCacheManager`) caches `tools/list` responses with a 5-minute TTL, generates SHA-256 ETags for conditional validation, and listens to the platform `EventBus` to immediately invalidate cached tools upon policy changes, tool re-registrations, or Rule 60 emergency dead-man trips.

**Tech Stack:** Next.js 15 App Router, TypeScript (Strict, Zero `any`/`any[]`), `@modelcontextprotocol/server` SDK v2 (2.1.0), Zod v4, Node.js `crypto`, Cloud Run Serverless Runtime.

---

## 1. Master Rules Compliance Matrix (`agents_mcp_rules.md`)

| Rule # | Principle / Invariant | Specific Milestone 2 Enforcement & Architectural Design |
| :---: | :--- | :--- |
| **Rule 1** | Best Practice Guidance | Conforms to `next-best-practices`, `vercel-react-best-practices`, `backend-design`. Zero sequential awaits; zero un-memoized heavy regex operations. |
| **Rule 2** | Failure Mode Foresight | Comprehensive failure modes analysis (Section 4): cache poisoning, ETag desync, token overflow, and dead-man fail-closed guards. |
| **Rule 3** | Impact & Backoffice SSOT | Backoffice control plane surface isolation (Rule 61); preserves legacy `/api/mcp` routes without degradation. |
| **Rule 4** | Zero `any` / Zero `any[]` | Fully typed schemas, generics, and execution contexts. Unvalidated external data is typed `unknown` and immediately narrowed via Zod. |
| **Rule 5** | Inbound Schema Validation | All discovery query parameters, header options, and cache requests pass strict Zod validation (`McpDomainSchema`, `DiscoveryOptionsSchema`). |
| **Rule 8** | Tenant Isolation | Multi-tenant cache key structure: `mcp:discovery:${orgId}:${wsId}:${domain}:${effectiveRole}:${scopesHash}`. Zero cross-tenant cache bleeding. |
| **Rule 9** | Cloud Run Resource Bounds | Discovery payload token budgeting ceiling ($< 1,500$ tokens); in-memory cache bounds (max 500 entries) preventing memory exhaustion. |
| **Rule 10** | Inline Architectural Docs | Every authored file includes comprehensive `@fileOverview` detailing invariants, security models, testability, and maintainer guidance. |
| **Rule 11** | MCP Spec 2026-07-28 | Stateless Streamable HTTP domain servers exposing standard JSON-RPC 2.0 `tools/list` and `tools/call`. |
| **Rule 12** | Annotations Are Hints | Risk levels (L0–L4) and authorizations are enforced server-side independently of MCP tool annotations. |
| **Rule 16** | Agent Identity as Principal | Tools are filtered against `AgentPrincipal.grantedScopes`. Unprivileged tools are hidden from caller discovery (`tools/list`). Wildcard (`*`) scopes prohibited. |
| **Rule 17** | Non-Delegable Actions Guard | Banned administrative actions (`isNonDelegableAction`: `change_owner`, `rotate_keys`, `delete_workspace`, `manage_billing`) are filtered out of all domain toolsets. |
| **Rule 18** | TOCTOU Optimistic Concurrency | Tool schema includes `expectedVersion` for mutating capabilities. |
| **Rule 19** | Mutating Idempotency | Mutating tools declare idempotency requirements and schema keys (`idempotencyKey`). |
| **Rule 20 & 39** | Distributed Tracing | Propagates `mcp-transaction-id`, `x-smartsapp-correlation-id`, and W3C `traceparent` through all tool discovery steps. |
| **Rule 21 & 22** | Human Approval & Hash Binding | High-risk tools (L3/L4) indicate `requiresHumanApproval: true` and enforce cryptographic approval token requirements. |
| **Rule 24** | Fallback & Degradation | Cache manager falls back to live registry computation on cache corruption or Redis/in-memory eviction without crashing. |
| **Rule 28** | Context Budgeting | Strict discovery token ceiling ($< 1,500$ tokens per domain payload) avoiding context bloat in external LLMs. |
| **Rule 31** | Tool Description Engineering | Strict `<domain>.<entity>.<action>` naming; concise imperative descriptions ($< 300$ chars) avoiding ambiguity. |
| **Rule 35** | Discovery Caching with TTL & Invalidation | `tools/list` payloads cached with TTL (5m), SHA-256 `discoveryETag`, and automated EventBus invalidation on capability/policy changes. |
| **Rule 36** | Capability SemVer Versioning | Every tool specifies SemVer version (`major.minor.patch`). Clients negotiate supported versions. |
| **Rule 37** | MCP Spec Compatibility Testing | Conformance testing verifying stateless Streamable HTTP behavior across all 6 domain endpoints. |
| **Rule 38** | Banned Deprecated Features | Zero reliance on legacy Roots, Sampling, Logging, or sticky SSE connections. |
| **Rule 40** | Append-Only Audit Logging | Tool discovery and invocation events publish domain events to `defaultEventBus`. |
| **Rule 42** | Shadow Mode Simulation | Capabilities advertise `supportsDryRun: true` in metadata where applicable. |
| **Rule 44** | Deterministic Test Harness | Comprehensive offline mocks and fixtures; zero external network dependencies in test suites. |
| **Rule 47** | "Never Trust the Model" Gate | Model-requested tool invocations pass schema validation, business validation, and tenant boundary checks before execution. |
| **Rule 48** | Sanitize Tool Errors | `formatJsonRpcError` masks internal stack traces and returns traceable correlation IDs. |
| **Rule 50** | Cache Isolation Rules | Cache keys strictly prefix `organizationId` and `workspaceId`. No shared un-scoped cache entries. |
| **Rule 51** | Authenticated Route Gate | Dynamic route handler `POST` enforces `authenticateMcpRequest` before executing transport logic. |
| **Rule 52** | Client/Server Boundary | Zero server secrets or database credentials leaked into tool schemas or client responses. |
| **Rule 54** | Performance Budgets | Discovery cache hit latency $< 30\text{ms}$; cold start $< 80\text{ms}$; discovery payload $< 1,500$ tokens. |
| **Rule 56** | Context Compression | Compact, concise tool descriptions preventing LLM context window saturation. |
| **Rule 60** | Emergency Dead-Man Controls | If emergency dead-man pause is tripped, discovery cache is cleared and returns HTTP 503 `MCP_EXECUTION_PAUSED`. |
| **Rule 61** | Surface Isolation | `system` domain strictly restricted to Backoffice control plane (`APP_SURFACE=backoffice`). |
| **Rule 62** | Security Command Center & Real-Time SSE | Discovery events and tool invocation telemetry emit domain events consumable by real-time streams. |
| **Rule 66 & 67** | The Agent Implementation Gate | Verification of all 10 architectural checklist criteria before marking milestone complete. |
| **Rule 68** | Five Non-Negotiable Rules | Model not security boundary; tool output untrusted; idempotent mutations; bounded authority; operable without code. |
| **Rule 69** | Strangler Fig Pattern SSOT | Legacy MCP routes (`src/lib/mcp/`) remain 100% operational; zero regressions to existing tools. |

---

## 2. File Decomposition & Responsibility Map

```
src/platform/mcp/
├── servers/
│   ├── domain-server-types.ts         # Domain mapping constants, domain-to-capability rules, token budgets
│   └── domain-mcp-factory.ts          # Factory creating domain-partitioned McpServer instances with least privilege
├── discovery/
│   ├── discovery-cache-types.ts       # Discovery cache entry schema, ETag computation contracts, invalidation events
│   └── discovery-cache-manager.ts     # Multi-tenant in-memory cache manager, TTL, ETag verification, EventBus listener
└── transport/
    └── streamable-http-handler.ts     # (Augmented) Integrates domain factory and discovery cache into transport

src/platform/capabilities/registry/
└── register-capabilities.ts           # (Augmented) Unifies DOMAIN_REGISTRARS across CRM, Deals, Tasks, Memory, Identity

src/platform/__tests__/mcp/
├── domain-server-types.test.ts        # Unit tests for domain mappings and context budgeting
├── domain-mcp-factory.test.ts         # Unit & integration tests for domain partitioning, least privilege, token budgeting
└── discovery-cache.test.ts            # Unit & integration tests for multi-tenant cache isolation, TTL, ETags, invalidation
```

---

## 3. Bite-Sized Implementation Tasks

### Task 1: Domain Server Types, Domain Mappings & Context Budgeting
**Files:**
- Create: `src/platform/mcp/servers/domain-server-types.ts`
- Test: `src/platform/__tests__/mcp/domain-server-types.test.ts`
- Rules: **Rule 4, Rule 9, Rule 10, Rule 28, Rule 31, Rule 36, Rule 54, Rule 56**

- [ ] **Step 1: Write failing unit test for domain server types and mappings**
  - Verify domain partitioning mapping for each of the 6 canonical domains:
    * `crm`: `crm_contacts`, `deals_revenue`, `tasks_productivity`
    * `knowledge`: `knowledge_memory`
    * `messaging`: `communication_messaging`
    * `sales`: `lead_intelligence`, `campaigns_marketing`
    * `portals`: `experience_portal`, `school_operations`
    * `system`: `identity_access`, `ai_governance`
  - Verify context budget constants: `MAX_DISCOVERY_PAYLOAD_TOKENS = 1500`, `MAX_TOOL_DESCRIPTION_LENGTH = 300`.
  - Verify token estimation helper (`estimateToolDiscoveryTokens`).
  - Verify SemVer validation for capability tools.
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/domain-server-types.test.ts`
  - Expected: FAIL with missing module.
- [ ] **Step 3: Implement domain server types and mapping contracts**
  - Author `src/platform/mcp/servers/domain-server-types.ts` with strict Zod v4 schemas, typed constants, domain mapping dictionary, and token estimator.
- [ ] **Step 4: Run test to verify pass**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/domain-server-types.test.ts`
  - Expected: PASS (all tests green).

---

### Task 2: Domain-Partitioned MCP Server Factory with Least Privilege & Surface Isolation
**Files:**
- Create: `src/platform/mcp/servers/domain-mcp-factory.ts`
- Test: `src/platform/__tests__/mcp/domain-mcp-factory.test.ts`
- Rules: **Rule 4, Rule 8, Rule 11, Rule 12, Rule 16, Rule 17, Rule 38, Rule 47, Rule 48, Rule 61, Rule 68**

- [ ] **Step 1: Write failing unit test for `createDomainMcpServer`**
  - Verify domain filtering: `crm` server only exposes CRM, deal, and task capabilities; excludes memory, messaging, and system capabilities.
  - Verify least privilege filtering: an agent with only `app:crm_view` receives read capabilities (`crm.entity.get`, `crm.entity.search`); write capabilities (`crm.entity.create`, `crm.entity.update`) are hidden.
  - Verify non-delegable action stripping (Rule 17): capabilities requiring non-delegable permissions are never mounted.
  - Verify surface isolation (Rule 61): `system` domain creation fails closed when `APP_SURFACE !== 'backoffice'`.
  - Verify context budget limit: total discovery tokens for the generated server remain strictly $< 1,500$ tokens.
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/domain-mcp-factory.test.ts`
  - Expected: FAIL with missing factory function.
- [ ] **Step 3: Implement `createDomainMcpServer`**
  - Query capabilities matching domain prefix and domain categories from `canonicalCapabilityRegistryStore`.
  - Filter by `principal.grantedScopes` against `capability.permissions`.
  - Strip non-delegable actions via `isNonDelegableAction`.
  - Mount capabilities using `createCapabilityToolHandler` and `@modelcontextprotocol/server` `McpServer`.
- [ ] **Step 4: Run test to verify pass**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/domain-mcp-factory.test.ts`
  - Expected: PASS (all tests green).

---

### Task 3: Progressive Tool Discovery Cache & Invalidation Engine
**Files:**
- Create: `src/platform/mcp/discovery/discovery-cache-types.ts`
- Create: `src/platform/mcp/discovery/discovery-cache-manager.ts`
- Test: `src/platform/__tests__/mcp/discovery-cache.test.ts`
- Rules: **Rule 8, Rule 35, Rule 47, Rule 50, Rule 54, Rule 60**

- [ ] **Step 1: Write failing unit test for `DiscoveryCacheManager`**
  - Multi-tenant cache key isolation (Rule 50): Tenant A and Tenant B never share cache entries even for identical domains.
  - TTL expiration: entries expire after 5 minutes (configurable).
  - SHA-256 `discoveryETag`: computes deterministic hash over the serialized tools list. Returns `isMatch: true` when client provides matching `If-None-Match`.
  - Staleness Guard (Rule 35): changing a tool's description or schema immediately produces a new ETag and cache entry.
  - EventBus Invalidation: firing `capability.registered`, `policy.updated`, or `governance.dead_man.tripped` purges cached entries for the affected tenant/domain.
  - Emergency Dead-Man Tripped: clears cache and returns paused error (Rule 60).
- [ ] **Step 2: Run test to verify failure**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/discovery-cache.test.ts`
  - Expected: FAIL with missing cache manager.
- [ ] **Step 3: Implement `DiscoveryCacheManager`**
  - Multi-tenant key generator: `mcp:discovery:${orgId}:${wsId}:${domain}:${effectiveRole}:${scopesHash}`.
  - In-memory cache map with cleanup on read when TTL expired.
  - SHA-256 ETag generator using `crypto.createHash('sha256')`.
  - Wire EventBus listeners on `defaultEventBus`.
- [ ] **Step 4: Run test to verify pass**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/discovery-cache.test.ts`
  - Expected: PASS (all tests green).

---

### Task 4: Unify Domain Capability Registrars in Platform Registry
**Files:**
- Modify: `src/platform/capabilities/registry/register-capabilities.ts`
- Test: `src/platform/__tests__/mcp/registry-unification.test.ts`
- Rules: **Rule 10, Rule 40, Rule 69**

- [ ] **Step 1: Write test verifying unified capability registration**
  - Verify that invoking `ensureCapabilitiesRegistered()` registers capabilities across:
    * `memory` (`memory.semantic_search`, `memory.get_context`, etc.)
    * `crm_contacts` (`crm.entity.search`, `crm.entity.get`, `crm.tag.list`, etc.)
    * `deals_revenue` (`deal.search`, `deal.get`, `pipeline.list`, etc.)
    * `tasks_productivity` (`task.search`, `task.get`, `task.create`, etc.)
    * `identity_access` (`access.get_workspace`, `access.list_workspaces`, etc.)
- [ ] **Step 2: Run test to verify status**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/registry-unification.test.ts`
  - Expected: Identify missing registrars in `DOMAIN_REGISTRARS`.
- [ ] **Step 3: Update `register-capabilities.ts`**
  - Import `registerCrmContactsCapabilities`, `registerDealsRevenueCapabilities`, `registerTasksProductivityCapabilities`, `registerIdentityAccessCapabilities`, `registerMemoryCapabilities`.
  - Add them to `DOMAIN_REGISTRARS` ensuring idempotent module loading.
- [ ] **Step 4: Run test to verify pass**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/registry-unification.test.ts`
  - Expected: PASS.

---

### Task 5: Wire Domain Factory & Discovery Cache into Transport Engine
**Files:**
- Modify: `src/platform/mcp/transport/streamable-http-handler.ts`
- Modify: `src/app/api/mcp/v2/[domain]/route.ts`
- Test: `src/platform/__tests__/mcp/streamable-http-transport.test.ts`
- Test: `src/platform/__tests__/mcp/mcp-route-v2.test.ts`
- Rules: **Rule 11, Rule 20, Rule 35, Rule 39, Rule 50, Rule 51, Rule 60, Rule 61**

- [ ] **Step 1: Update `StreamableHttpHandler`**
  - Inject `createDomainMcpServer` and `discoveryCacheManager`.
  - When handling `tools/list`, check `discoveryCacheManager` for cached response and ETag.
  - Return HTTP 304 Not Modified if client sends matching `If-None-Match`.
  - Attach `ETag` header to response.
- [ ] **Step 2: Update `route.ts`**
  - Handle `If-None-Match` request headers.
  - Echo `ETag` in response headers for caching clients.
- [ ] **Step 3: Run existing MCP test suite to ensure zero regressions**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/`
  - Expected: 100% PASS across all files.

---

### Task 6: Full Verification, Performance Benchmarks & Typecheck
**Files:**
- Test: `src/platform/__tests__/mcp/`
- Test: `src/lib/mcp/__tests__/` (Rule 69 Strangler Fig Invariant)
- Script: `pnpm typecheck`
- Rules: **Rule 4, Rule 37, Rule 44, Rule 45, Rule 46, Rule 67, Rule 68, Rule 69**

- [ ] **Step 1: Run complete MCP platform test suite**
  - Run: `pnpm vitest run src/platform/__tests__/mcp/`
  - Expected: All tests pass.
- [ ] **Step 2: Run legacy MCP test suite (Rule 69)**
  - Run: `pnpm vitest run src/lib/mcp/__tests__/`
  - Expected: 21/21 tests pass with zero regressions.
- [ ] **Step 3: Run TypeScript compiler**
  - Run: `pnpm typecheck`
  - Expected: Exit code 0, 0 errors.
- [ ] **Step 4: Verify zero `any` or `any[]` (Rule 4)**
  - Run: `pnpm lint`

---

## 4. Potential Failure Modes & Defenses

1. **Failure Mode: Cross-Tenant Discovery Cache Bleeding (Rule 50)**
   - *Risk:* Tenant B inspects cached tools list containing custom capabilities or schema hints meant exclusively for Tenant A.
   - *Defense:* The cache key strictly prefixes `organizationId` and `workspaceId` alongside `effectiveRole` and `scopesHash`. Cache retrieval fails closed if tenant context does not match.

2. **Failure Mode: Stale Capabilities Executing Dangerous Mutations (Rule 35)**
   - *Risk:* An operator removes a write permission or engages a dead-man pause, but an external client continues executing cached tool definitions.
   - *Defense:* EventBus listener automatically purges discovery cache entries on `policy.updated` and `governance.dead_man.tripped`. Moreover, execution authorization is evaluated *live* at runtime during `tools/call`, independent of cached discovery metadata.

3. **Failure Mode: Context Window Overflow in Small LLMs (Rule 54 & 56)**
   - *Risk:* Exposing 50+ tool schemas in a single monolithic discovery payload overwhelms smaller model context windows (e.g., Claude 3 Haiku, Gemini Flash).
   - *Defense:* Focused domain partitioning partitions tools into 6 distinct endpoints. Discovery payloads are bounded to $< 1,500$ tokens per domain, with descriptions truncated to 300 characters.

4. **Failure Mode: Infinite Discovery Re-fetch Loop**
   - *Risk:* External clients re-request `tools/list` on every turn, causing latency spikes.
   - *Defense:* Support HTTP conditional validation via `ETag` and `If-None-Match`. Cache hits respond in $< 30\text{ms}$.

5. **Failure Mode: Surface Boundary Bypass on System Domain (Rule 61)**
   - *Risk:* An external client calls `POST /api/mcp/v2/system` to discover or execute administrative governance capabilities on the public app surface.
   - *Defense:* Both the dynamic route handler and `domain-mcp-factory` verify `isBackofficeSurface()`. If `APP_SURFACE !== 'backoffice'`, creation and execution fail closed with HTTP 403 `SURFACE_RESTRICTED`.

---

## 5. Agent Implementation Gate Checklist (Rule 67)

Before Milestone 2 is marked complete, all 10 criteria must be verified with concrete evidence:

- [ ] **1. Spec & Rule Alignment:** Protocol Spec 2026-07-28 compliant; all applicable rules in `agents_mcp_rules.md` verified.
- [ ] **2. Architecture & Invariants:** Stateless Streamable HTTP; 6 domain servers; context budgeting $< 1,500$ tokens.
- [ ] **3. Multi-Tenancy & Tenant Boundaries:** Cache keys isolate `orgId`, `wsId`, `effectiveRole`, `scopesHash`; Anti-IDOR verified.
- [ ] **4. Error Handling & Resilience:** Structured JSON-RPC error responses with correlation IDs; circuit breakers on cache failures.
- [ ] **5. State & Storage:** In-memory discovery cache with TTL and EventBus invalidation; zero unmanaged persistent state.
- [ ] **6. Background Work & Durability:** Asynchronous cache cleanup on read; zero dangling promises during serverless cold starts.
- [ ] **7. Observability & Auditing:** Distributed tracing headers propagated; discovery events published to `defaultEventBus`.
- [ ] **8. Test Strategy & Evidence:** Comprehensive Vitest coverage across domain factory, discovery cache, and route v2.
- [ ] **9. Code Quality & Typing:** Zero `any` or `any[]` (Rule 4); clean `pnpm typecheck` exit code 0.
- [ ] **10. Forward Compatibility & Migration:** Strangler Fig pattern preserved (Rule 69); ready for Milestone 3 (Tool Fingerprinting & Rug-Pull Defense).
