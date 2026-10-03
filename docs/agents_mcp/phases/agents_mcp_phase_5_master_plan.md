# SmartSapp Agentic & MCP Transformation: Phase 5 Master Implementation Plan
## Universal MCP Capability Platform, Domain Servers & Operator Capability Console
### Deeply Integrated with `docs/agents_mcp/`, `docs/CompanyBrain/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

**Version:** 1.0.0 (Comprehensive Source-Document Synthesis)  
**Status:** PROPOSED FOR USER APPROVAL  
**Authors:** Senior Principal Systems & AI Agentic Architecture Engineer  
**Governing Documents & Source Foundations:**
- **Agentic & MCP Transformation Foundation:**
  - [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§36 Phase 5: "MCP Platform: Capabilities become universally consumable", §33 Strangler Rule)
  - [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) (All 69 Rules, specifically Rules 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69)
  - [`docs/agents_mcp/agents_mcp_prd.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_prd.md) (§§45–52: MCP Architecture, Server Responsibilities, Tool Registry, Tool Risk Model, Approval Contract)
  - [`docs/agents_mcp/agents_mcp_ui.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_ui.md) (§43: MCP Capability Registry UI, §82: PHASE 5 — MCP Delivery Map)
  - [`docs/agents_mcp/agents_mcp_cloudrun.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_cloudrun.md) (Stateless Streamable HTTP, Protocol Spec `2026-07-28`, Domain-Partitioned Endpoints `/api/mcp/v2/*`, 32MB Payload Ceiling, Ambient GCP Credentials, SSRF & Metadata Server Protection)
  - [`docs/agents_mcp/agents_mcp_tools.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_tools.md) (Master Tool Taxonomy, MCP vs Agent vs Workflow Actions, Capability Manifests)
  - [`docs/agents_mcp/agents_mcp_idea.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_idea.md) (Organization Memory Context Provider for MCP and Agents)
- **Foundation Architecture & Identity:**
  - [`docs/agentic/00-master-architecture.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agentic/00-master-architecture.md) through [`16-testing-matrix.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agentic/16-testing-matrix.md)
  - [`docs/agentic/inventory.json`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agentic/inventory.json) (2,337 capabilities across 18 domains)
- **Design System & Workspace Rules:**
  - [`theme.md` Section 8](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/theme.md#L396-L442) (Standardized Modal & Dialog Architecture SSOT)
  - [`.agents/AGENTS.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/.agents/AGENTS.md) (SSOT: TagSelector, FieldsVariablesService, Relative Toast Navigation, Strict Typing)
- **Existing Implementation Bedrock:**
  - `src/platform/capabilities/` (Execution Gateway, Contracts, Registry, Risk Levels)
  - `src/platform/identity/` (Agent Personas, Ephemeral HMAC Tokens)
  - `src/platform/policy/` (Bounded Delegation, Scope Attenuation, Action Proposals, Dead-Man Pause)
  - `src/platform/memory/` (5-Tier Canonical Memory, Qdrant Vector Adapter, Hybrid RRF Retriever, Cloud Tasks Indexer)
  - `src/platform/mcp/` (`create-stateless-handler.ts`, `to-mcp-tool-schema.ts`)
  - `src/lib/mcp/` (Legacy MCP 1.0 subsystem with passing tests, protected under Rule 69 Strangler Invariant)

---

## 1. Executive Summary & Foresight

### 1.1 The Completed Foundations (Phases 0 through 4)
SmartSapp has systematically engineered a production-grade agentic bedrock:
1. **Phase 0 (Inventory & Baseline):** Audited all 2,337 capabilities across 18 domains; established frozen regression fixtures, Cloud Tasks security, and risk level taxonomy (L0–L4).
2. **Phase 1 (Canonical Capability Layer):** Delivered the 15-step Canonical Execution Gateway (`executeCapability`), Unified Capability Registry, idempotency deduplication, and SSRF egress security.
3. **Phase 2 (Reactive Event Backbone):** Built the Transactional Outbox, Cloud Tasks background dispatcher, DLQ, Universal Multi-Tenant Event Bus, live SSE streaming, and Activity Timeline 2.0.
4. **Phase 3 (Agent Identity & Governance Plane):** Established Agent Identity as a first-class security principal (Rule 16), ephemeral HMAC session tokens, bounded delegation with monotonic scope attenuation, Two-Phase Action Proposals with SHA-256 approval binding, Rule 60 emergency dead-man pause switch, and the Operator Approval Center (`/admin/approvals`).
5. **Phase 4 (Institutional Memory & Knowledge Plane):** Built the 5-Tier Memory Architecture (Working, Episodic, Semantic, Relational, Procedural), Qdrant REST vector engine with circuit breaker, Okapi BM25 sparse retriever, RRF hybrid search pipeline, 4-tier knapsack token budgeting ($\le 4,000$ tokens), prompt injection `<untrusted_reference_data>` isolation, Cloud Tasks memory indexer, `/admin/brain`, `/admin/knowledge/inbox`, Knowledge Graph visualizer v1, and CRM contextual panels. Shipped to `origin main` with 100% green CI/CD.

### 1.2 The Destination of Phase 5
With capabilities, events, policies, and institutional memory operational, SmartSapp enters **Phase 5: Universal MCP Capability Platform**.

According to `agents_mcp_roadmap.md` (§36 & §66) and `agents_mcp_prd.md` (§§45–52):
> **In Phase 5, SmartSapp capabilities become universally consumable.**
> Both internal autonomous agents (Genkit, Phase 6 Agent Runtime) and external MCP-compliant clients (Cursor, Claude Desktop, autonomous external orchestrators) can discover, inspect, and execute SmartSapp capabilities through a unified, stateless, secure Model Context Protocol gateway.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXTERNAL & INTERNAL CONSUMERS                                  │
│   • Cursor IDE / Windsurf    • Claude Desktop Client    • SmartSapp Internal Agents (Genkit)     │
└─────────────────────────────────┬──────────────────────────────┬─────────────────────────────────┘
                                  │ (Streamable HTTP)            │ (In-Process Adapter)
                                  ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 5: UNIVERSAL MCP CAPABILITY PLATFORM (Spec 2026-07-28)                   │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Multi-Tenant Auth & Ingress Gateway (Rule 8, 16, 47)                                    │  │
│  │    • Bearer Token / Clerk JWT / McpApiKey verification                                     │  │
│  │    • Anti-IDOR: Tenant strictly bound to verified credential (never caller-selected)       │  │
│  │    • Emergency Dead-Man Switch Gate (Rule 60)                                              │  │
│  └─────────────────────────────────────────────┬──────────────────────────────────────────────┘  │
│                                                │                                                 │
│  ┌─────────────────────────────────────────────▼──────────────────────────────────────────────┐  │
│  │ 2. Domain-Partitioned Stateless Streamable HTTP Endpoints (Cloud Run Serverless, Rule 3, 11)│  │
│  │    POST /api/mcp/v2/crm         (Contacts, Deals, Pipelines, Activities)                   │  │
│  │    POST /api/mcp/v2/knowledge   (Semantic Memory, Notes, Dossiers, Context Builder)        │  │
│  │    POST /api/mcp/v2/messaging   (Omnichannel Dispatch, Templates, Verification)            │  │
│  │    POST /api/mcp/v2/sales       (SDR Enrichment, Lead Scoring, Research)                   │  │
│  │    POST /api/mcp/v2/portals     (Portals, Memberships, Courses, Community, Credentials)   │  │
│  │    POST /api/mcp/v2/system      (Governance, Audit, Dead-Man Controls)                    │  │
│  └─────────────────────────────────────────────┬──────────────────────────────────────────────┘  │
│                                                │                                                 │
│  ┌─────────────────────────────────────────────▼──────────────────────────────────────────────┐  │
│  │ 3. Progressive Tool Discovery & Caching Engine (Rule 35, 50)                               │  │
│  │    • tools/list dynamic generation with tenant-isolated TTL caching                        │  │
│  │    • Cryptographic schema hashing & automatic invalidation on capability/policy change     │  │
│  └─────────────────────────────────────────────┬──────────────────────────────────────────────┘  │
│                                                │                                                 │
│  ┌─────────────────────────────────────────────▼──────────────────────────────────────────────┐  │
│  │ 4. Cryptographic Tool Fingerprinting & Rug-Pull Defense (Rule 14, 15, 34)                  │  │
│  │    • SHA-256 fingerprinting of schema, description, permissions, and risk level            │  │
│  │    • Runtime tamper check: fails closed on unauthorized capability drift                   │  │
│  │    • External MCP Server Allowlist & SSRF Egress Defense (metadata server blocked)         │  │
│  └─────────────────────────────────────────────┬──────────────────────────────────────────────┘  │
│                                                │                                                 │
│  ┌─────────────────────────────────────────────▼──────────────────────────────────────────────┐  │
│  │ 5. Canonical Execution Gateway Delegation (Rule 12, 19, 21, 22, 69)                        │  │
│  │    • Evaluates principal authority (no wildcard, no non-delegable)                         │  │
│  │    • 15-step execution gateway: safe validation -> policy -> execution -> audit           │  │
│  │    • High-risk operations (L3/L4) return ActionProposal with cryptographic payloadHash     │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                   OPERATOR CAPABILITY CONSOLE & MISSION CONTROL (Milestone 4)                    │
│   • Capability Registry (/settings/ai/capabilities & /admin/mcp)                                 │
│   • Standardized Tool Inspector Drawer (theme.md §8 SSOT compliant)                              │
│   • Live MCP Activity Stream via useEventStream (Rule 62)                                        │
│   • Emergency Dead-Man Pause & Tool Kill-Switches (Rule 60, 61)                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive 69-Rule Compliance Matrix (agents_mcp_rules.md)

Every aspect of Phase 5 is cross-referenced with `docs/agents_mcp/agents_mcp_rules.md` to guarantee complete rule compliance without sacrificing speed or developer ergonomics:

| Rule # | Title / Requirement | Phase 5 Enforcement Architecture | Verification Gate |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Adheres to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`. Zero regression to existing CRM/Messaging features. | Static code review & automated lint. |
| **Rule 2** | Failure Mode & Scalability Analysis | Comprehensive failure mode analysis documented for every milestone: network disconnects, schema drift, token expiration, replay attacks, resource exhaustion. | Unit & integration tests simulating each failure mode. |
| **Rule 3** | Impact & Backoffice Governance | All MCP tools, servers, and capabilities are inspectable, pausable, and manageable from the Backoffice surface without code changes. | Backoffice Capability Console UI verified. |
| **Rule 4** | Zero `any`, `any[]`, or Unchecked Casts | Absolute ban on `any` / `any[]`. `unknown` permitted solely at external HTTP/JSON trust boundaries, immediately parsed and narrowed via Zod schemas. | `pnpm typecheck` exits 0 with zero warnings. |
| **Rule 5** | Staging & Verification Gate | No unapproved production deployments. Automated CI/CD verification runs all linters, typechecks, and tests before merge. | GitHub Actions CI/CD green. |
| **Rule 6** | Dependency Governance | Built upon `@modelcontextprotocol/server` v2.1.0 (SDK v2) and `zod/v4`. No unpinned floating dependencies. | `pnpm-lock.yaml` verification. |
| **Rule 7** | Mobile-First & Touch Ergonomics | Operator console and tool inspector drawer optimized for mobile viewports ($\ge 44\text{px}$ touch targets, responsive drawer layout). Everyday clear English copy. | Chrome DevTools mobile audit & tap target tests. |
| **Rule 8** | Defensive Multi-Tenancy & Anti-IDOR | Tenant context (`organizationId`, `workspaceId`) extracted exclusively from verified credentials (`requireAuth()` or `mcp_keys`). External headers (`x-workspace-id`) cannot override. | Anti-IDOR spoofing test suite. |
| **Rule 9** | Cloud Run Serverless Limits & 32MB Ceiling | Enforces 32MB HTTP payload limit on MCP endpoints. Rejects oversized payloads with HTTP 413. Large attachments route via signed Firebase Storage URIs. | Payload size boundary test. |
| **Rule 10** | Inline Architectural Documentation | Every module includes `@fileOverview` with architectural rationale, failure modes, maintainer warnings, and test pointers. | Codebase documentation audit. |
| **Rule 11** | Current MCP Spec Compliance (2026-07-28 / SDK v2) | Implements stateless Streamable HTTP transport using `@modelcontextprotocol/server` SDK v2. Multi-round-trip requests carry transaction headers. | MCP protocol conformance test suite. |
| **Rule 12** | Annotations Are Hints, Not Security Controls | Server-side policy engine enforces actual risk levels (L0–L4) and authorization independently of MCP tool hints (`readOnlyHint`, `destructiveHint`). | Annotation bypass spoofing test. |
| **Rule 13** | Formal Trust Boundary Matrix | External tool inputs, tool return values, and model outputs classified as untrusted. Isolated in `<untrusted_reference_data>` containers. | Prompt injection & data taint tests. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | SHA-256 fingerprinting of tool schemas, descriptions, permissions, and risk levels (`mcp_tool_fingerprints`). Execution fails closed on drift. | Tamper simulation & fingerprint drift tests. |
| **Rule 15** | Server Allowlisting & Supply-Chain Controls | External MCP servers must be allowlisted, provenance-verified, and approved through a formal lifecycle before connection. | Outbound MCP server allowlist test. |
| **Rule 16** | Agent Identity as First-Class Security Principal | Resolves incoming calls into canonical `AgentPrincipal` (`actorType: 'agent'`). Strict ban on wildcard `*` permissions. | Principal evaluator test suite. |
| **Rule 17** | Non-Delegable Actions Guard | Banned administrative operations (`change_owner`, `rotate_keys`, `delete_workspace`) can never be executed via automated MCP callers. | Non-delegable rejection test. |
| **Rule 18** | Time-of-Check / Time-of-Use (TOCTOU) Protection | Mutating tools validate resource versions (`expectedVersion`, `expectedUpdatedAt`) before applying mutations. | Concurrent modification test. |
| **Rule 19** | Idempotency Keys on Mutating Tools | Mutating MCP tools require or deterministically compute `idempotencyKey` (`mcp:sha256(...)`). Duplicate deliveries return cached result. | Idempotent replay test suite. |
| **Rule 20** | Replay & Duplicate Delivery Protection | Tracks `correlationId`, `causationId`, `toolInvocationId`, and `attempt` across multi-round-trip MCP flows. | Duplicate webhook & replay tests. |
| **Rule 21** | Two-Phase Action Model for High Risk | L3 and L4 capabilities return an `ActionProposal` in `/admin/approvals` rather than directly mutating production state. | Approval proposal creation test. |
| **Rule 22** | Cryptographic Approval Binding | Action proposals bind to SHA-256 `payloadHash`. If arguments or context change post-approval, proposal is invalidated. | Payload tampering rejection test. |
| **Rule 23** | Execution Budgets & Resource Ceilings | Enforces limits on request duration, tool call frequency, batch size, and memory allocation. | Rate limit & timeout tests. |
| **Rule 24** | 5-State Circuit Breakers | Outbound MCP connections and external services monitored via 5-state circuit breaker (`CLOSED` -> `DEGRADED` -> `OPEN` -> `HALF_OPEN` -> `CLOSED`). | Circuit breaker trip & probe tests. |
| **Rule 25** | Dead-Letter & Recovery Handling | Asynchronous tool tasks that fail permanently route to dead-letter queues with structured error codes. | DLQ dispatch verification test. |
| **Rule 26** | Explicit Cancellation Semantics | Long-running MCP tasks support cancellation signals; cleans up in-flight state without partial corruption. | Cancellation handler test. |
| **Rule 27** | Formal Saga / Compensation Model | Multi-step tool flows specify compensating undo actions where technically feasible. | Saga rollback verification test. |
| **Rule 28** | Context Budgeting ($\le 4,000$ tokens) | Memory and context retrieval tools strictly enforce token ceilings to prevent LLM context overflow. | Token budget ceiling test. |
| **Rule 29** | Memory Governance & Temporal Half-Life | Memory tools apply temporal validity (`validFrom`, `validUntil`, `supersededBy`) and exponential decay. | Memory staleness test. |
| **Rule 30** | Knowledge Poisoning & Prompt Injection Defense | Text ingested or returned by tools is scanned for injection directives (`[REDACTED_INSTRUCTION]`) and wrapped in XML isolation tags. | Red team injection test. |
| **Rule 31** | Output Validation Between Agent & Tool | Tool responses undergo schema validation before being returned to callers or models. | Invalid output schema test. |
| **Rule 32** | Cross-Domain Data Exfiltration Detection | Monitors tool responses for sensitive data classes (`pii`, `financial`, `credentials`) escaping across untrusted boundaries. | Data egress scanner test. |
| **Rule 33** | Server-Side Egress Controls | Validates destination domains, webhooks, and communication channels against tenant allowlists. | Egress restriction test. |
| **Rule 34** | SSRF & Network Boundary Controls | Shared `safeUrlFetch` blocks `169.254.169.254` (GCP metadata), localhost, and RFC-1918 private ranges. | SSRF penetration test suite. |
| **Rule 35** | MCP Discovery Caching with TTL & Invalidation | `tools/list` results cached with TTL and tenant isolation. Automatically invalidated on capability updates. | Discovery cache invalidation test. |
| **Rule 36** | Capability Version Compatibility (SemVer) | Every tool specifies SemVer version (`major.minor.patch`). Clients negotiate supported versions. | Version mismatch negotiation test. |
| **Rule 37** | MCP Spec Compatibility Testing | Conformance testing verifying stateless Streamable HTTP behavior and backward compatibility adapters. | Spec compliance test runner. |
| **Rule 38** | Banned Deprecated MCP Features | Zero reliance on legacy Roots, Sampling, Logging, or sticky SSE connections. Central Genkit gateway used for model inference. | Deprecation scan & architectural audit. |
| **Rule 39** | OpenTelemetry Distributed Tracing | End-to-end tracing propagating `traceId`, `spanId`, `correlationId` across MCP HTTP requests and internal domain services. | Trace context header test. |
| **Rule 40** | Append-Only Immutable Audit Log | Every tool invocation, decision, and outcome is recorded in an immutable append-only audit ledger (`mcp_audit_logs`). | Audit record integrity test. |
| **Rule 41** | "Why Did You Do This?" Decision Trace | High-risk actions log structured WHAT, WHY, WHO, BLAST RADIUS, and EVIDENCE attributes for human review. | Audit view inspection test. |
| **Rule 42** | Shadow Mode Simulation Support | Supports dry-run execution mode where tools plan and validate without committing database mutations. | Shadow mode test execution. |
| **Rule 43** | Replayable Agent Runs | Stores sufficient execution metadata (inputs, tool versions, context snapshot) to reproduce runs in test environments. | Replay harness test. |
| **Rule 44** | Deterministic Simulation Harness | Mock MCP server and test fixtures allow end-to-end testing without external network dependencies. | Offline test suite verification. |
| **Rule 45** | Chaos & Fault-Injection Testing | Injects simulated network timeouts, 500s, malformed JSON, and service throttling into MCP handlers. | Chaos test suite passes. |
| **Rule 46** | Adversarial Red-Team Testing | Automated security tests attempting prompt injection, parameter tampering, cross-tenant leaks, and approval bypasses. | Red team test suite passes. |
| **Rule 47** | "Never Trust the Model" Execution Gate | Model outputs must pass schema validation, business validation, policy evaluation, and tenant boundary checks before execution. | Model untrusted execution test. |
| **Rule 48** | "Never Trust the Tool Either" Invariant | Tool results sanitized, schema-validated, and scrubbed of executable instructions before entering context. | Tool output distrust test. |
| **Rule 49** | Public Resource Isolation | Public endpoints never permit arbitrary unauthenticated tool invocation or unrestricted Firestore reads. | Public access boundary test. |
| **Rule 50** | Cache Isolation Rules | All cached MCP responses and discovery payloads include `organizationId` and `workspaceId` in the cache key. | Cross-tenant cache bleed test. |
| **Rule 51** | Server Actions / Route Handlers Security Gate | Route handlers verify `requireAuth()` or token validation. Marked `'use server'` / authenticated route handlers. | Next.js security audit passes. |
| **Rule 52** | Client/Server Boundary Enforcement | Server-only secrets and database credentials never leaked to client bundles. | Bundle analysis & leak check. |
| **Rule 53** | Dependency Governance | Strict lockfile enforcement (`pnpm-lock.yaml`). No unreviewed dependencies. | Dependency audit passes. |
| **Rule 54** | Performance Budgets | Tool discovery latency $< 50\text{ms}$; handler dispatch overhead $< 10\text{ms}$; bundle size within limits. | Benchmark test verification. |
| **Rule 55** | Graph & Canvas Resource Limits | Bounded entity results; paginated tool outputs. | Pagination & limit tests. |
| **Rule 56** | Agent Context Compression | Context summaries retain source references, entity IDs, and uncertainty metrics without evidence loss. | Context compression test. |
| **Rule 57** | Data Residency & Retention Awareness | Policy metadata tracks data residency constraints and restricts external model dispatch accordingly. | Data residency policy test. |
| **Rule 58** | Model Routing Policy | Task risk and data sensitivity govern AI model routing via central gateway. | Gateway routing unit tests. |
| **Rule 59** | Tool Selection Evaluation | Tracks tool invocation accuracy, false positive calls, and unused capabilities. | Telemetry evaluation metrics. |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` allows immediate platform-wide or workspace-wide MCP tool pause without redeployment. | Dead-man kill switch unit test. |
| **Rule 61** | Backoffice as Agent Control Plane | Operator mission control hosted on backoffice surface (`/admin/mcp`) for zero-code management. | Surface access control test. |
| **Rule 62** | Security Command Center & Real-Time SSE | Live MCP activity and security alerts stream via `useEventStream` and `EventBus`. | Real-time SSE stream test. |
| **Rule 63** | Agent Incident Management | Tools and runs link to incident triage records for operational post-mortems. | Incident creation test. |
| **Rule 64** | Feature Flags at 3 Levels | Granular feature flags (Global, Organization, Workspace) control MCP domain rollout. | Feature flag toggle test. |
| **Rule 65** | Canary Rollouts | Safe staged deployment of tool versions with automatic rollback thresholds. | Rollout configuration test. |
| **Rule 66** | Cross-Cutting Phase Gates | Phase 5 gates: MCP 2026-07-28 compliance, SDK v2, server allowlist, tool fingerprints, discovery cache policy. | Phase 5 completion audit. |
| **Rule 67** | The Agent Implementation Gate | 10-point architectural checklist verified before any milestone is marked complete. | Implementation gate sign-off. |
| **Rule 68** | The Five Non-Negotiable Rules | 1. Model is not security boundary; 2. Tool output is untrusted; 3. Mutations idempotent & authorized; 4. Bounded authority & resources; 5. Operable without code. | Non-negotiable review sign-off. |
| **Rule 69** | Strangler Fig Pattern SSOT | Build governed capability layer underneath SmartSapp. Legacy MCP in `src/lib/mcp/` remains 100% operational via compatibility adapters. | Preexisting MCP regression tests pass. |

---

## 3. Five Granular Milestones for Phase 5 Execution

Phase 5 is structured into 5 sequential, verifiable milestones:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASE 5 MILESTONE EXECUTION PIPELINE                             │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 1: Stateless Streamable HTTP Transport Engine & Protocol 2026-07-28 Wiring             │
│ • Next.js App Router Web Standard Route Handler integration via createMcpHandler                 │
│ • Mcp-Transaction-Id & X-SmartSapp-Correlation-Id header-based routing                           │
│ • Multi-tenant credential verification (Bearer token, Clerk JWT, McpApiKey)                      │
│ • Emergency Dead-Man Switch integration (Rule 60) & 32MB payload ceiling (Rule 9)                │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 2: Domain-Partitioned MCP Servers & Progressive Tool Discovery Engine                  │
│ • Focused domain endpoints: /crm, /knowledge, /messaging, /sales, /portals, /system              │
│ • Dynamic tool discovery mapping canonical capabilities to McpServer                             │
│ • Tenant-scoped discovery caching (tools/list) with TTL & automated invalidation (Rule 35)       │
│ • Domain registrars expansion (CRM, Sales, Messaging, Portals)                                   │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 3: Cryptographic Tool Fingerprinting, Server Allowlisting & Supply-Chain Security      │
│ • SHA-256 tool fingerprint calculation & runtime drift detection (Rule 14 Rug-Pull Defense)      │
│ • External MCP Server Allowlist lifecycle & approval engine (Rule 15)                            │
│ • Outbound SSRF protection blocking GCP metadata server (169.254.169.254) (Rule 34)             │
│ • Data egress classification & exfiltration scanner (Rule 32, 33)                                │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 4: Operator Capability Console, Live Activity Stream & Standardized Tool Inspector     │
│ • Technical Administrator Console (/settings/ai/capabilities) & Backoffice Hub (/admin/mcp)     │
│ • Standardized Tool Inspector Drawer (theme.md §8: demarcated header, single-circle info tooltip)│
│ • Real-time MCP activity stream powered by useEventStream & mcp.tool.invoked events (Rule 62)    │
│ • Next.js Server Actions with Anti-IDOR validation & dead-man controls (Rule 47, 51, 60)         │
└─────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 5: Native In-Process Genkit Adapter, External Client Interop & Strangler Fig Bridge    │
│ • Genkit tool adapter: in-process capability execution for internal agents without HTTP overhead │
│ • Interop testing with Claude Desktop, Cursor, and custom HTTP clients                           │
│ • Strangler Fig bi-directional harmonization with legacy src/lib/mcp/ (Rule 69)                  │
│ • Full platform QA suite: unit, integration, chaos, and adversarial red-team verification       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Milestone 1: Stateless Streamable HTTP Transport Engine, Protocol Spec 2026-07-28 Wiring & Multi-Tenant Auth Gateway

#### 1. Objectives & Scope
- Deliver the production-ready HTTP transport for MCP `2026-07-28` operating statelessly over HTTP POST endpoints.
- Support multi-round-trip requests carrying `Mcp-Transaction-Id` and `X-SmartSapp-Correlation-Id` headers across horizontally autoscaling Cloud Run container instances.
- Build a hardened multi-tenant authentication gateway extracting and verifying caller identity without allowing external caller-selected tenant spoofing.
- Integrate the Rule 60 emergency dead-man pause check and Cloud Run 32MB payload ceiling.

#### 2. Key Deliverables
1. `src/platform/mcp/transport/streamable-http-handler.ts`:
   - Wraps `@modelcontextprotocol/server`'s `createMcpHandler` and `WebStandardStreamableHTTPServerTransport`.
   - Parses and propagates transaction headers: `Mcp-Transaction-Id`, `X-SmartSapp-Correlation-Id`, `traceparent`.
   - Handles Cloud Run 32MB payload limit: checks `content-length` and rejects requests exceeding 32MB with HTTP 413 `PAYLOAD_TOO_LARGE`.
   - Formats clean JSON-RPC 2.0 error responses without leaking internal stack traces (Rule 48).
2. `src/platform/mcp/auth/mcp-auth-gateway.ts`:
   - Dual authentication support:
     * Clerk Session JWT (`requireAuth()` for interactive web sessions).
     * Bearer API Keys (resolving against `/mcp_keys` via `resolvePrincipalFromMcpKey`).
   - Anti-IDOR enforcement: `organizationId` and `workspaceId` are bound strictly to the authenticated identity, rejecting any caller attempts to inject mismatched headers (Rule 8, 47).
   - Rule 60 Dead-Man evaluation: calls `checkGovernanceDeadManSwitch(tenant)`. If paused, immediately rejects the request with HTTP 503 and code `MCP_EXECUTION_PAUSED`.
3. `src/app/api/mcp/v2/[domain]/route.ts`:
   - Dynamic Next.js App Router Route Handler (`POST`).
   - Routes request to the appropriate domain server based on `params.domain`.
   - Enforces surface isolation (Rule 61): restricts backoffice-only domains to `isBackofficeSurface()`.

#### 3. Verification & Quality Gates
- **Tests:** `src/platform/__tests__/mcp/streamable-http-transport.test.ts` (12 tests covering handshake, transaction headers, 32MB ceiling, auth failure, dead-man pause, and anti-IDOR validation).
- **TypeScript:** Clean typecheck, zero `any` or `any[]` (Rule 4).

---

### Milestone 2: Domain-Partitioned MCP Servers & Progressive Tool Discovery Engine

#### 1. Objectives & Scope
- Partition capabilities into 6 focused MCP domain servers to prevent LLM context bloat and optimize memory.
- Implement progressive tool discovery with tenant-isolated TTL caching and automated invalidation (Rule 35, 50).
- Expand canonical domain capability registrations across CRM, Knowledge, Messaging, Sales, Portals, and System.

#### 2. Key Deliverables
1. `src/platform/mcp/servers/domain-mcp-factory.ts`:
   - Factory function `createDomainMcpServer({ domain, tenant, principal })`.
   - Canonical domain partitioning:
     * `crm`: Contacts, Deals, Pipelines, Activities.
     * `knowledge`: Notes, Semantic Memory, Context Builder, Dossiers.
     * `messaging`: Templates, Omnichannel Dispatch, Verification.
     * `sales`: SDR Research, Lead Scoring, Intelligence.
     * `portals`: Portals, Memberships, Courses, Community, Credentials.
     * `system`: Governance, Audit Logs, Dead-Man Controls.
   - Automatically registers tools from `capabilityRegistry` filtering by domain and principal permissions.
2. `src/platform/mcp/discovery/discovery-cache-manager.ts`:
   - Caches `tools/list` payloads in memory with a 5-minute TTL.
   - Multi-tenant cache key: `mcp:discovery:${orgId}:${wsId}:${domain}:${effectiveRole}`.
   - Computes SHA-256 `discoveryETag` allowing clients to perform conditional `If-None-Match` requests.
   - EventBus listener: invalidates cached entries upon `capability.registered`, `policy.updated`, or `governance.dead_man.tripped`.
3. Domain Capability Registrars:
   - Expand `DOMAIN_REGISTRARS` in `src/platform/capabilities/registry/register-capabilities.ts` to include initial capabilities for CRM, Messaging, Sales, and Portals.

#### 3. Verification & Quality Gates
- **Tests:** `src/platform/__tests__/mcp/domain-mcp-factory.test.ts` and `src/platform/__tests__/mcp/discovery-cache.test.ts` (14 tests covering domain partitioning, tool mapping, cache hit/miss, tenant isolation, and invalidation).
- **Performance:** Tool discovery response time $< 30\text{ms}$ on cache hit, $< 80\text{ms}$ on cold load.

---

### Milestone 3: Cryptographic Tool Fingerprinting, Server Allowlisting & Supply-Chain Security

#### 1. Objectives & Scope
- Protect against tool poisoning and "rug-pull" attacks where tool definitions change maliciously (Rule 14).
- Establish external MCP server allowlisting, approval workflows, and lifecycle state management (Rule 15).
- Enforce strict SSRF protection preventing MCP tools from accessing Google Cloud metadata or private IP ranges (Rule 34).
- Build data egress classification and exfiltration detection (Rule 32, 33).

#### 2. Key Deliverables
1. `src/platform/mcp/security/tool-fingerprint-service.ts`:
   - Canonical fingerprint formula:
     $$\text{Fingerprint} = \text{SHA256}(\text{id} \parallel \text{version} \parallel \text{description} \parallel \text{inputSchemaJSON} \parallel \text{outputSchemaJSON} \parallel \text{permissions} \parallel \text{riskLevel})$$
   - Persists approved fingerprints in Firestore `/mcp_tool_fingerprints`.
   - Runtime check: if a capability definition's fingerprint does not match the approved database record, execution fails closed with `TOOL_FINGERPRINT_DRIFT` and raises a security event.
2. `src/platform/mcp/security/server-allowlist-service.ts`:
   - External server registration and approval engine: `DISCOVERED` -> `REVIEWED` -> `TESTED` -> `APPROVED` -> `CONNECTED` -> `MONITORED`.
   - Rejects unapproved outbound MCP server connections.
   - Wraps external network calls in `validateSafeEgressUrl` (blocking `169.254.169.254`, `localhost`, RFC-1918).
3. `src/platform/mcp/security/egress-data-policy.ts`:
   - Inspects tool output payloads for sensitive classifications (`confidential`, `pii`, `financial`).
   - Flags or blocks cross-domain exfiltration attempts where private data is routed to external communication tools without explicit authorization.

#### 3. Verification & Quality Gates
- **Tests:** `src/platform/__tests__/mcp/tool-fingerprint.test.ts` and `src/platform/__tests__/mcp/server-allowlist.test.ts` (16 tests covering fingerprint drift, unauthorized modification, SSRF blocking, and egress monitoring).
- **Adversarial:** Passes red-team attack simulation for rug-pull tampering.

---

### Milestone 4: Operator Capability Console (`/settings/ai/capabilities` & `/admin/mcp`), Live Activity Stream & Standardized Tool Inspector Drawer (`theme.md` §8)

#### 1. Objectives & Scope
- Provide technical operators with a centralized UI to inspect, configure, and monitor MCP tools and capabilities.
- Build the `ToolInspectorDrawer` strictly compliant with `theme.md` Section 8 (Standardized Modal & Drawer Architecture).
- Deliver real-time MCP activity monitoring powered by `useEventStream` and `EventBus` (Rule 62).
- Create typed Next.js Server Actions with Anti-IDOR validation and dead-man switch protection.

#### 2. Key Deliverables
1. Server Actions (`src/app/actions/mcp-actions.ts`):
   - `listMcpCapabilitiesAction(filter)`: Lists capabilities with risk levels, versions, fingerprint status, and usage metrics.
   - `getMcpToolDetailsAction(capabilityId)`: Returns complete tool metadata, JSON schemas, dependencies, and audit history.
   - `approveToolFingerprintAction(capabilityId, reason)`: Re-authorizes an updated tool definition.
   - `toggleMcpToolStateAction(capabilityId, enabled)`: Workspace-level enable/disable switch.
   - `getMcpPlatformMetricsAction()`: Aggregates active tools, invocations, error rates, and security alerts.
2. UI Components conforming to `theme.md` §8:
   - `src/components/mcp/ToolInspectorDrawer.tsx`:
     * Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
     * Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20`.
     * Zero Raw Description: Contextual description routed exclusively through `<CardInfoTooltip text="..." />` at `z-[10050]`. Screen-reader `<DialogDescription className="sr-only">`.
     * Untrusted Data Isolation: Schemas and examples wrapped in `<untrusted_reference_data id="...">` (Rule 30).
     * Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97]`).
   - `src/components/mcp/CapabilityCatalogTable.tsx`: Searchable table with domain filter, risk chips (L0–L4), fingerprint status badges, and mobile-responsive drawer triggers.
   - `src/components/mcp/McpActivityStream.tsx`: Live execution timeline streaming `mcp.tool.invoked` events with latency and status chips.
   - `src/components/mcp/McpDeadManBanner.tsx`: Prominent emergency banner with workspace pause/resume toggle.
3. Route Surfaces:
   - `/settings/ai/capabilities`: Technical administrator console.
   - `/admin/mcp`: Operator mission control surface.
   - Redirection from legacy `/settings/developers/mcp` preserving existing bookmarks.

#### 3. Verification & Quality Gates
- **Tests:** `src/platform/__tests__/ui/mcp-capability-console.test.tsx` (10 tests covering catalog rendering, drawer interaction, theme tokens, tactile active states, and mobile touch targets).
- **Accessibility:** 100% WCAG AA compliance; all interactive elements $\ge 44\text{px}$.

---

### Milestone 5: Native In-Process Genkit Adapter, External Client Interop & Strangler Fig Bridge

#### 1. Objectives & Scope
- Enable internal agents (Genkit, Phase 6 Agent Runtime) to invoke canonical capabilities directly in-process without HTTP network overhead, while preserving full policy and audit enforcement.
- Validate interoperability with external MCP clients (Cursor, Claude Desktop, custom scripts).
- Harmonize legacy `src/lib/mcp/` with canonical capabilities via the Strangler Fig pattern (Rule 69).
- Conduct full platform regression and verification testing.

#### 2. Key Deliverables
1. `src/platform/mcp/adapters/genkit-tool-adapter.ts`:
   - Converts canonical `CapabilityDefinition` into Genkit `ToolAction` using `defineTool`.
   - Seamlessly binds `executeCapability` directly in-process.
   - Guarantees zero distortion to risk evaluation, idempotency, or audit event emission.
2. External Client Interoperability Test Suite:
   - Verifies end-to-end integration with standard MCP client harnesses simulating Cursor and Claude Desktop.
   - Tests protocol handshake, tool listing, tool invocation, error handling, and transaction header propagation.
3. Strangler Fig Legacy Bridge (Rule 69):
   - Bi-directional bridge ensuring `src/lib/mcp/registry.ts` and `src/platform/capabilities/registry/capability-registry.ts` stay synchronized.
   - Existing legacy tests in `src/lib/mcp/__tests__/` (and UI components like `LiveToolRunnerModal`, `ToolCatalogTable`) continue to pass without regression.
4. Comprehensive QA Test Suite:
   - Full regression suite covering all 5 milestones.
   - Chaos and fault injection tests (timeout, rate limit, server failure).
   - Adversarial red-team test suite (injection, fingerprint drift, cross-tenant isolation).

#### 3. Verification & Quality Gates
- **Baseline Regression:** All preexisting test suites (baseline, identity, policy, memory, UI) pass with 100% success.
- **Typecheck & Lint:** Clean exit code 0 across the entire project.

---

## 4. Architectural Failure Modes & Mitigation Strategies (Rule 2)

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **1. Cloud Run Timeout on Multi-Step Tool Calls** | Long-running tools exceeding Cloud Run 300s limit | Client connection dropped, orphaned work | Tools exceeding 30s dispatch asynchronously to Cloud Tasks; return immediate `Task` acknowledgment with correlation ID. |
| **2. Cross-Tenant Discovery Bleed** | Stale or shared discovery cache across workspaces | Operator A discovers tools with Tenant B metadata | Discovery cache keys strictly incorporate `(organizationId, workspaceId, effectiveRole)`. Cache invalidates on tenant switch. |
| **3. Tool Rug-Pull / Silent Poisoning** | Modified schema or altered instructions in upstream tool | Agent executes dangerous operation under innocent guise | Cryptographic SHA-256 fingerprint verification (Rule 14). Any schema/description drift blocks execution until operator re-consent. |
| **4. Cloud Run Memory Spike from Large Payloads** | Large file or dataset passed directly in tool arguments | Container instance crashes with OOM | Strict 32MB payload ceiling enforced at ingress (Rule 9). Large files route via signed Firebase Storage URIs. |
| **5. Model Annotation Confusion** | Model assumes `readOnlyHint=true` implies zero risk | Destructive side effects disguised behind read annotations | Server-side policy engine strictly enforces true risk levels (L0–L4) regardless of client/tool hints (Rule 12). |
| **6. Emergency Kill-Switch Failure** | Dead-man switch state changes not noticed by cached handlers | Paused agent continues executing mutations | 10-second in-memory TTL caching with immediate EventBus broadcast for dead-man state changes (Rule 60). |

---

## 5. Backward & Forward Compatibility Guarantees

### 5.1 Backward Compatibility (Rule 69 Strangler Invariant)
1. **Preexisting MCP Subsystem (`src/lib/mcp/`):**
   - The legacy `src/lib/mcp/` directory (including `gateway.ts`, `registry.ts`, `approval-engine.ts`, and test suites) is preserved and harmonized.
   - The unified capability registry bridges legacy tools, ensuring existing tests (`src/lib/mcp/__tests__/`) pass without regression.
2. **Preexisting Operator Routes:**
   - Legacy routes such as `/settings/developers/mcp` seamlessly redirect to `/settings/ai/capabilities`.
3. **Preexisting Memory & Policy Subsystems:**
   - Memory capabilities (`memory.semantic_search`, `memory.get_context`, `memory.create_item`) and Approval Action Proposals (`ActionProposal`) mount directly into MCP domain servers without rewriting underlying logic.

### 5.2 Forward Compatibility (Phases 6 through 15)
1. **Phase 6: Agent Runtime & Execution Engine:**
   - Phase 6 agents will consume capabilities directly via the `GenkitToolAdapter` (in-process) or via domain MCP endpoints (remote), using identical schemas, policies, and audit logs.
2. **Phase 7: Durable Workflows & Tasks Extension:**
   - The stateless Streamable HTTP transport and Cloud Tasks pattern provide the native substrate for the MCP Tasks extension (durable task creation, polling, and resumption).
3. **Phase 8: AI-Native UX & Interactive Copilots:**
   - The `ToolInspectorDrawer` and `/admin/mcp` console provide reusable components for the global AI Command Center and in-app agent assistants.

---

## 6. Definition of Done for Phase 5

Phase 5 will only be considered complete when all of the following criteria are satisfied:
1. **Protocol Conformance:** Stateless Streamable HTTP endpoints (`/api/mcp/v2/*`) conform to MCP `2026-07-28` specification and `@modelcontextprotocol/server` SDK v2.
2. **Domain Partitioning:** 6 focused domain endpoints operational with dynamic tool discovery and tenant-isolated TTL caching.
3. **Security Hardening:** Tool fingerprinting (Rule 14), server allowlisting (Rule 15), SSRF defense (Rule 34), and anti-IDOR validation (Rule 47) fully verified.
4. **Operator Experience:** `/settings/ai/capabilities` and `/admin/mcp` operational with live SSE activity stream (Rule 62) and `ToolInspectorDrawer` compliant with `theme.md` §8.
5. **Universal Consumption:** Internal agents (Genkit) and external clients (Cursor, Claude Desktop) successfully execute capabilities.
6. **Zero Regression:** All preexisting test suites (baseline, identity, policy, memory, UI, legacy MCP) pass 100%.
7. **Strict Typing:** Project compiles with zero `any` or `any[]` (`pnpm typecheck` exits 0).
8. **Clean Code & Lint:** ESLint passes with 0 errors and 0 warnings.
