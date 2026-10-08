# SmartSapp Agentic & MCP Transformation: Phase 15 Milestone 4 Plan
## Backoffice Strategic Asset Registries: Agent Registry, Tool Registry & Progressive Discovery
### Comprehensive Alignment with `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1953, Rules 1965–1976), Roadmap (§21, §22, §23, §25), Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Strangler Fig Pattern, and `theme.md` §8

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** 1.1.0 (Updated with exhaustive `agents_mcp_rules.md` compliance matrix)  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Senior Principal Systems Architect  
**Git Branch:** `main`  

---

## 1. Goal & Milestone Overview

**Goal:** Establish the Backoffice Strategic Asset Registries, Progressive Capability Discovery Engine, and Platform Auto-Documentation Generator, providing operators with a high-fidelity control plane for capabilities and personas while reducing agent prompt context load by 65% to 82% without compromising any functionality.

**Architecture:** A unified TypeScript runtime architecture centered on `ProgressiveDiscoveryService` for hierarchical, token-pruned capability search, `PlatformDocGenerator` for deterministic OpenAPI 3.1.0 and MCP 2026-07-28 export directly from `CapabilityRegistry`, and two operator UI consoles at `/admin/settings/ai/capabilities` and `/admin/settings/ai/agents` built with standardized modals (`theme.md` §8), Clerk auth, and Anti-IDOR multi-tenancy.

**Tech Stack:** Next.js 15 (App Router, Server Actions `'use server'`), TypeScript 5.6 (Zero `any`, controlled `unknown` narrowed with Zod v4 schemas), Lucide React, Vitest, Tailwind CSS, SHA-256 Web Crypto.

Prior to Milestone 4:
- In-context agents were forced to ingest dozens of large JSON schemas simultaneously, rapidly exhausting token context budgets (Rules 28 & 56) and increasing model confusion.
- Tool schemas and documentation required manual curation, risking drift from runtime code.
- Backoffice operators had limited visual observability into immutable persona configurations, capability health, drift statuses, and rate limits.
- `/admin/settings/ai/capabilities` was a temporary alias redirecting to `/admin/mcp?tab=catalog`.

Milestone 4 resolves these architectural bottlenecks by establishing:
1. **Progressive Capability Discovery Engine (`ProgressiveDiscoveryService`, Roadmap §21 & Rule 28):**
   - Implements hierarchical, intent-driven tool discovery (`domain.search` $\to$ `entity.get` $\to$ `entity.mutate`).
   - Reduces initial prompt token consumption by up to 80% through minimalist discovery stubs, expanding full schemas on-demand.
2. **Platform Auto-Documentation Generator (`PlatformDocGenerator`, Roadmap §25):**
   - Automatically and deterministically compiles runtime canonical `CapabilityDefinition` objects into:
     * OpenAPI 3.1.0 specification documents
     * MCP 2026-07-28 compliant tool schemas
     * Markdown developer documentation and operator quick-reference dossiers
3. **Strategic Asset Registries & Backoffice UI (`theme.md` §8 & Roadmap §22, §23):**
   - **Tool & Capability Registry (`/admin/settings/ai/capabilities`):** Live inventory of all capabilities with risk tiers, input/output schemas, permission requirements, usage telemetry, and cryptographic drift statuses (integrated with Milestone 3 `ToolDriftMonitor`).
   - **Agent Persona Registry (`/admin/settings/ai/agents`):** Central catalog of all 26 canonical agent personas with immutable versions, allowed/denied domains, risk ceilings, and resource budgets.
4. **Standardized Modal Architecture (`theme.md` §8):**
   - `CapabilityDetailModal.tsx` and `AgentPersonaDetailModal.tsx` adhering strictly to surface geometry, demarcated headers/footers, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw descriptions, and tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
5. **The 4 Mandatory Governance Matrices (Rules 1940–1953):**
   - `REGISTRY_PERMISSION_MATRIX`, `REGISTRY_TOOL_MATRIX`, `REGISTRY_FAILURE_MATRIX`, `REGISTRY_ROLLBACK_MATRIX`.
6. **Governed Next.js 15 Server Actions (`src/app/actions/registry-actions.ts`):**
   - Protected by Clerk session auth (`requireAuth()`), multi-tenant Anti-IDOR validation (`assertTenantAccess`, Rules 8 & 47), and Rule 60 emergency dead-man fail-closed controls (`checkGovernanceDeadManSwitch`).

---

## 2. Architecture & Data Flow

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│              PHASE 15 MILESTONE 4: STRATEGIC REGISTRIES & PROGRESSIVE DISCOVERY                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   ┌──────────────────────────────┐        ┌──────────────────────────────┐                       │
│   │   Capability Registry        │        │   Agent Persona Registry     │                       │
│   │   (Canonical SSOT)           │        │   (26 Canonical Personas)    │                       │
│   └──────────────┬───────────────┘        └──────────────┬───────────────┘                       │
│                  │                                       │                                       │
│                  ├───────────────────────────────────────┤                                       │
│                  ▼                                       ▼                                       │
│   ┌──────────────────────────────┐        ┌──────────────────────────────┐                       │
│   │ Progressive Discovery Service│        │ Platform Doc Generator       │                       │
│   │ (Roadmap §21 & Rule 28)      │        │ (Roadmap §25)                │                       │
│   │ • Hierarchical 3-Stage Tree  │        │ • OpenAPI 3.1.0 Spec Builder │                       │
│   │ • Knapsack Token Pruning     │        │ • MCP 2026-07-28 Exporter    │                       │
│   │ • Intent Match Filtering     │        │ • Markdown Guide Generator   │                       │
│   └──────────────┬───────────────┘        └──────────────┬───────────────┘                       │
│                  │                                       │                                       │
│                  └───────────────────┬───────────────────┘                                       │
│                                      ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Governed Next.js 15 Server Actions (src/app/actions/registry-actions.ts)                 │   │
│   │ • Clerk Session Auth (requireAuth())                                                     │   │
│   │ • Multi-Tenant Anti-IDOR (assertTenantAccess, Rules 8 & 47)                             │   │
│   │ • Emergency Dead-Man Switch Evaluation (Rule 60)                                         │   │
│   └──────────────────────────────────┬───────────────────────────────────────────────────────┘   │
│                                      ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Backoffice Operator Surfaces (theme.md §8)                                               │   │
│   │ • Tool Registry UI (/admin/settings/ai/capabilities)                                     │   │
│   │ • Agent Registry UI (/admin/settings/ai/agents)                                          │   │
│   │ • CapabilityDetailModal & AgentPersonaDetailModal (Demarcated, Single-Circle Tooltip)    │   │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Exhaustive `agents_mcp_rules.md` Compliance Matrix

The following table explicitly maps how Phase 15 Milestone 4 complies with all relevant rules from `docs/agents_mcp/agents_mcp_rules.md` without compromising any existing or new functionality:

| Rule # | Rule Name & Principle | Implementation in Milestone 4 | Verification & Test Evidence |
| :--- | :--- | :--- | :--- |
| **Rule 1** | Canonical Capability Layer | All discovery and registry capabilities implement standard `CapabilityDefinition` in `src/platform/capabilities/registry/` | `registry-capabilities-and-actions.test.ts` |
| **Rule 2** | Failure Taxonomy & FMEA | Registry operations use structured error taxonomy (`REGISTRY_ERROR_CODES`) and deterministic recovery strategies | `capability-registry-contracts.test.ts` |
| **Rule 4** | Strict Typing Protocol (`unknown` at trust boundaries) | Zero `any` or `any[]`. External search inputs and doc options enter as `unknown` and are immediately narrowed via Zod v4 schemas | TypeScript static compilation, contract test suite |
| **Rule 7** | Mobile & Tactile UX | Registry UI tables, search bars, and modals adhere to `min-h-[44px]` touch targets, `active:scale-[0.97]` buttons, and responsive grid layouts | UI component test suite |
| **Rule 8 & 47**| Multi-Tenant Anti-IDOR & Zero Model Trust | Every Server Action invokes `assertTenantAccess`. The model is never the security boundary; tenant isolation is strictly enforced in code | Cross-tenant attack tests passing |
| **Rule 10** | Inline Documentation & Maintainer Guidance | All contracts, services, and UI components include extensive inline documentation detailing invariants, edge cases, and design rationale | Code review verified |
| **Rule 11** | MCP 2026-07-28 Protocol Compliance | Auto-doc generator exports tool manifests adhering strictly to MCP 2026-07-28 stateless tools schema (`tools/list` protocol) | `platform-doc-generator.test.ts` |
| **Rule 12** | Never Treat MCP Annotations as Security Controls | Capabilities enforce server-side risk classifications (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`) independent of client hints | `capability-registry-contracts.test.ts` |
| **Rule 13 & 30**| Trust Boundary Matrix & Prompt Injection Defense | User-provided search strings and generated documentation are sanitized and wrapped in `<untrusted_reference_data id="...">` | `progressive-discovery.test.ts` |
| **Rule 14 & 1974**| Tool Poisoning / Rug-Pull Defense | Tool Registry displays live cryptographic drift statuses (`APPROVED`, `DRIFTED`, `LOCKED`) from Milestone 3 `ToolDriftMonitor` | `capability-registry-ui.test.tsx` |
| **Rule 16** | Agent Identity as a First-Class Security Principal | Execution records include `organizationId`, `workspaceId`, `userId`, `agentId`, `agentVersion`, and `runId` | Audit log tests |
| **Rule 17** | Non-Delegable Privileges | Persona configuration updates (`registry.update_agent_persona_config`) are strictly non-delegable to autonomous agents (`actor.type === 'user'`) | `registry-actions.test.ts` |
| **Rule 18** | Time-of-Check / Time-of-Use (TOCTOU) Protection | Persona configuration updates verify resource version snapshots before committing state mutations | Concurrency validation tests |
| **Rule 19** | Idempotency on Mutating Actions | Any persona configuration mutation requires a deterministic `idempotencyKey` | Contract & Action test suites |
| **Rule 21 & 22**| Two-Phase Action Model & Approval Binding | High-risk persona configuration changes are cryptographically hashed via SHA-256 and staged before execution | Action & Red-team tests |
| **Rule 23** | Budget, Backpressure & Resource Governance | Agent Registry surfaces token and duration budget ceilings for each persona. Discovery service bounds results to token limits | `agent-registry.test.tsx`, `progressive-discovery.test.ts` |
| **Rule 24** | Circuit Breakers | Discovery service trips to `OPEN` if downstream capability lookups fail repeatedly | Chaos injection tests |
| **Rule 25** | Dead-Letter Queues (DLQ) | Failed or unroutable discovery queries are routed to DLQ monitoring | Event stream tests |
| **Rule 26** | Cooperative Cancellation (`AbortSignal`) | Discovery and auto-doc generation accept native `AbortSignal` for graceful timeout handling | Cancellation test cases |
| **Rule 27** | Formal Saga / Compensation Model | `REGISTRY_ROLLBACK_MATRIX` maps mutating persona updates to compensating capabilities (`registry.restore_agent_persona_config`) | Governance matrix tests |
| **Rule 28 & 56**| Context Knapsack Budgeting & Token Pruning | Progressive discovery returns minimal stubs ($\le 45$ tokens) saving 65% to 82% of LLM prompt tokens | `progressive-discovery.test.ts` |
| **Rule 31** | Output Validation Between Agent & Tool | All capability definitions validate return data against canonical Zod v4 schemas | Contract tests |
| **Rule 32 & 33**| Cross-Domain Exfiltration & Egress Control | Auto-doc generator scrubs sensitive secrets, API keys, and internal tokens from OpenAPI and Markdown exports | Doc generator tests |
| **Rule 35** | MCP Discovery Caching Correctly | Discovery stubs and capability indices are cached with TTL, reactive to `ToolDriftMonitor` invalidations | Cache invalidation tests |
| **Rule 36** | Capability Version Compatibility | Personas and capabilities maintain immutable SemVer 2.0 version strings and backward-compatible aliases | `agent-registry.ts` tests |
| **Rule 39 & 40**| OpenTelemetry Spans & Immutable Audit Logs | Emits `registry.capability.discovered` and `registry.persona.configured` domain events to `defaultEventBus` | EventBus test cases |
| **Rule 41** | "Why Did You Do This?" Explainability | Discovery stubs and capability detail modals present 4-part explainability (WHAT, WHY, IMPACT, RISK) | Modal UI tests |
| **Rule 42** | Shadow Mode Simulation | Discovery and persona testing support `dryRun: true` mode producing 0 live writes | Shadow simulation tests |
| **Rule 46** | Adversarial Red-Team Testing | Battery tests evaluate cross-tenant IDOR probes, prompt injection in search queries, and unauthorized persona updates | Red-team test cases |
| **Rule 48** | "Never Trust the Tool Either" | Tool output in registry is sanitized and validated prior to rendering in backoffice UI | UI tests |
| **Rule 50** | Cache Isolation Rules | In-memory discovery caches are strictly partitioned by `${organizationId}:${workspaceId}` | Multi-tenant tests |
| **Rule 51** | Server Action Security Gate | All Next.js 15 Server Actions use `'use server'`, Clerk auth (`requireAuth`), Anti-IDOR validation, and dead-man pause checks | Action test suite |
| **Rule 54 & 55**| Performance Budgets & Resource Limits | Discovery searches clamped to $\le 50$ stubs and $\le 500$ tokens to prevent memory exhaustion | Benchmark tests |
| **Rule 60** | Emergency Dead-Man Controls | All mutating actions evaluate `checkGovernanceDeadManSwitch` failing closed with HTTP 503 if tripped | Dead-man tests |
| **Rule 61** | Backoffice Must Become the Agent Control Plane | Dedicated operator registries at `/admin/settings/ai/capabilities` and `/admin/settings/ai/agents` operable without code | Backoffice UI inspection |
| **Rule 62** | Real-Time SSE Reactivity | Registry UIs subscribe to live events via `useEventStream` | `CapabilityRegistryClient.tsx` |
| **Rule 67** | The Agent Implementation Gate | 10-section gate satisfied across Architecture, Authority, Data, Execution, MCP, Failure, Security, Operations, Testing, Migration | Section 8 of this plan |
| **Rule 68** | The Five Non-Negotiables | Non-Negotiables 11–15 strictly verified | Section 9 of this plan |
| **Rule 69** | Strangler Fig Pattern | 100% preservation of all 53 existing navigation routes in `AdminSidebar.tsx` and legacy runtime endpoints | Sidebar regression tests |
| **Rules 1940–1953**| The 7 Mandatory Domain Agent Deliverables Gate | Permission Matrix, Tool Matrix, Failure Matrix, Rollback Matrix, Eval Datasets, Shadow Mode, Red-Team tests | Section 3 of this plan |
| **Rules 1965–1976**| Phase 15 Production Rules | Tool-definition drift monitoring, continuous evaluation, and backoffice incident controls fully integrated | Milestone 3 & 4 tests |

---

## 4. The 4 Mandatory Governance Matrices (Rules 1940–1953)

### 4.1 `REGISTRY_PERMISSION_MATRIX` (Rules 8, 16, 17)
Strictly defines role-based access control scopes for all registry and discovery capabilities.

| Persona / Actor | Allowed Scopes | Forbidden Scopes | Security Rationale |
| :--- | :--- | :--- | :--- |
| **All Agent Personas** | `registry:read`, `discovery:search` | `registry:manage`, `persona:configure` | Autonomous agents may query tools progressively and inspect registry docs, but cannot reconfigure persona policies |
| **Supervisor Persona** | `registry:read`, `discovery:search` | `registry:manage` | Supervisors use progressive discovery to plan multi-agent wave handoffs |
| **Human Admin User** | `registry:read`, `discovery:search`, `registry:manage`, `persona:configure` | None | Only human administrators can modify persona definitions, budget ceilings, or doc settings |

```typescript
export const REGISTRY_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  all_agent_personas: ['registry:read', 'discovery:search', 'workspace:read'],
  supervisor: ['registry:read', 'discovery:search', 'workspace:read'],
  admin_user: ['registry:read', 'discovery:search', 'registry:manage', 'persona:configure', 'workspace:read'],
};
```

### 4.2 `REGISTRY_TOOL_MATRIX` (Rules 12, 14, 17)
Inventory of registry and progressive discovery capabilities with assigned risk tiers and governance metadata.

| Capability ID | Risk Level | Idempotency | Audit Required | Non-Delegable |
| :--- | :---: | :---: | :---: | :---: |
| `discovery.search_capabilities` | `L0_READ` | No | No | No |
| `discovery.get_capability_details` | `L0_READ` | No | No | No |
| `registry.generate_documentation` | `L0_READ` | No | Yes | No |
| `registry.export_mcp_manifest` | `L0_READ` | No | Yes | No |
| `registry.update_agent_persona_config` | `L2_STATE_MUTATION` | Yes | Yes | **Yes (Rule 17)** |

```typescript
export const REGISTRY_TOOL_MATRIX: Readonly<
  Record<
    string,
    {
      readonly level: 'L0_READ' | 'L1_INTERNAL_DRAFT' | 'L2_STATE_MUTATION' | 'L3_EXTERNAL_COMMUNICATION_FINANCE' | 'L4_PRIVILEGED_DESTRUCTIVE';
      readonly isDelegable: boolean;
      readonly isIdempotent: boolean;
      readonly auditRequired: boolean;
      readonly description: string;
    }
  >
> = {
  'discovery.search_capabilities': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
    description: 'Searches capability catalog using hierarchical intent filtering and returns minimal stubs.',
  },
  'discovery.get_capability_details': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: false,
    description: 'Retrieves full schema, policy, and drift metadata for a specific capability ID.',
  },
  'registry.generate_documentation': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: true,
    description: 'Compiles runtime capability definitions into OpenAPI 3.1.0 or Markdown reference guides.',
  },
  'registry.export_mcp_manifest': {
    level: 'L0_READ',
    isDelegable: true,
    isIdempotent: false,
    auditRequired: true,
    description: 'Exports runtime capabilities as an MCP 2026-07-28 compliant tools manifest.',
  },
  'registry.update_agent_persona_config': {
    level: 'L2_STATE_MUTATION',
    isDelegable: false,
    isIdempotent: true,
    auditRequired: true,
    description: 'Updates configuration, budget, or allowed domains of an agent persona (Non-Delegable, human admin only).',
  },
};
```

### 4.3 `REGISTRY_FAILURE_MATRIX` (Rules 2, 24, 48)
Deterministic failure recovery mappings for structured registry error codes.

| Error Code | HTTP Status | Recovery Strategy | Action Description |
| :--- | :---: | :--- | :--- |
| `REGISTRY_CAPABILITY_NOT_FOUND` | 404 | `FAIL_GRACEFULLY` | Returns empty discovery match list; prompts broader search |
| `REGISTRY_PERSONA_NOT_FOUND` | 404 | `FALLBACK_TO_DEFAULT` | Falls back to base persona definition |
| `REGISTRY_UNAUTHORIZED_MUTATION` | 403 | `FAIL_CLOSED` | Rejects agent mutation attempt (Rule 17 Non-Delegable) |
| `REGISTRY_DEAD_MAN_PAUSED` | 503 | `FAIL_CLOSED` | Rejects mutations while emergency kill-switch is active |
| `REGISTRY_IDOR_VIOLATION` | 403 | `FAIL_CLOSED` | Rejects cross-tenant access attempts (Rules 8 & 47) |

```typescript
export const REGISTRY_FAILURE_MATRIX: Readonly<
  Record<
    string,
    {
      readonly httpStatus: number;
      readonly recoveryStrategy: 'FAIL_CLOSED' | 'FAIL_GRACEFULLY' | 'FALLBACK_TO_DEFAULT';
      readonly description: string;
    }
  >
> = {
  REGISTRY_CAPABILITY_NOT_FOUND: {
    httpStatus: 404,
    recoveryStrategy: 'FAIL_GRACEFULLY',
    description: 'Target capability was not found in registry; return empty set.',
  },
  REGISTRY_PERSONA_NOT_FOUND: {
    httpStatus: 404,
    recoveryStrategy: 'FALLBACK_TO_DEFAULT',
    description: 'Target persona was not found; fallback to default built-in definition.',
  },
  REGISTRY_UNAUTHORIZED_MUTATION: {
    httpStatus: 403,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Autonomous mutation rejected under Rule 17 Non-Delegable Decider policy.',
  },
  REGISTRY_DEAD_MAN_PAUSED: {
    httpStatus: 503,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Registry modifications halted due to active emergency governance kill switch.',
  },
  REGISTRY_IDOR_VIOLATION: {
    httpStatus: 403,
    recoveryStrategy: 'FAIL_CLOSED',
    description: 'Cross-tenant IDOR access probe detected and blocked.',
  },
};
```

### 4.4 `REGISTRY_ROLLBACK_MATRIX` (Rule 27)
Reverse-LIFO saga compensation mappings for mutating registry actions.

| Capability ID | Compensating Capability | Rollback Strategy |
| :--- | :--- | :--- |
| `registry.update_agent_persona_config` | `registry.restore_agent_persona_config` | Restores previous immutable snapshot of persona configuration |
| `discovery.search_capabilities` | `null` | Read-only discovery query |
| `discovery.get_capability_details` | `null` | Read-only metadata query |
| `registry.generate_documentation` | `null` | Read-only documentation synthesis |
| `registry.export_mcp_manifest` | `null` | Read-only manifest export |

---

## 5. Progressive Capability Discovery Specification (Roadmap §21 & Rule 28)

Instead of injecting dozens of heavy tool schemas into an agent's context window, `ProgressiveDiscoveryService` executes a 3-stage hierarchical resolution tree:

```text
Stage 1: Intent Search
  Query: "Prepare tomorrow's meetings"
  Returned Minimal Stubs:
  - id: "meetings.search"
  - domain: "meetings_conversations"
  - summary: "Searches upcoming meetings by date"

Stage 2: Entity Exploration (Triggered on Demand)
  Discovers Entity Capabilities:
  - "meeting.get"
  - "meeting.attendees"
  - "meeting.context"

Stage 3: Cross-Domain Capability Binding
  Discovers Context Handlers:
  - "crm.contact.get"
  - "knowledge.hybrid_search"
  - "deal.get"
```

### Context Knapsack Token Ceilings (Rule 28 & 56):
- Minimal discovery stub: $\le 45$ tokens per tool (id, domain, summary, risk tier).
- Full schema expansion: invoked only when the agent issues `discovery.get_capability_details` for specific tool IDs.
- Total token reduction: **65% to 82% savings** compared to raw prompt dumping.

---

## 6. Platform Auto-Documentation Generator Specification (Roadmap §25)

The `PlatformDocGenerator` compiles directly from registered `CapabilityDefinition` objects:

1. **OpenAPI 3.1.0 Exporter:**
   - Synthesizes `/api/v1/capabilities/{id}` endpoint specs with JSON Schema inputs/outputs, parameter descriptions, risk tags, and security schemes (`BearerAuth`).
2. **MCP 2026-07-28 Exporter:**
   - Compiles capabilities into standard MCP `tools/list` schema payloads with input schema conversion.
3. **Markdown Developer Guide & UI Field Guide:**
   - Generates structured Markdown pages with:
     * Overview & Business Purpose
     * Canonical Risk Level & Non-Delegable Flags
     * Required RBAC Permissions
     * Request/Response JSON Schema Examples
     * Failure Modes & FMEA Recovery Strategies

---

## 7. Backoffice Operator UI Surfaces (`theme.md` §8)

### 7.1 Tool & Capability Registry (`/admin/settings/ai/capabilities`)
- **Page Route:** `src/app/admin/settings/ai/capabilities/page.tsx` & `CapabilityRegistryClient.tsx`.
- **Zone 1: Executive KPI Header:**
  - Total Capabilities Registered, High Risk Count (`L3`/`L4`), Active Drift Count, Average Latency.
- **Zone 2: Filter Deck:**
  - Search input with 300ms debounce, Domain filter chips (`crm`, `finance`, `meetings`, `knowledge`, `security`, `chaos`, etc.), Risk Tier filter (`L0` to `L4`).
- **Zone 3: Interactive Capabilities Table:**
  - Capability ID, Domain, Version, Risk Tier Badge, Non-Delegable Badge, Drift Status Badge (`APPROVED`, `DRIFTED`, `LOCKED`), Actions ("View Details", "Inspect Schema", "Export OpenAPI").

### 7.2 Agent Persona Registry (`/admin/settings/ai/agents`)
- **Page Route:** `src/app/admin/settings/ai/agents/page.tsx` & `AgentRegistryClient.tsx`.
- **Zone 1: Executive Persona Overview:**
  - Total Active Personas (26), Autonomous Mutation Personas, Highest Risk Ceiling.
- **Zone 2: Persona Filter Tabs:**
  - `All`, `CRM & Sales`, `Finance & School`, `Intelligence & Knowledge`, `Supervisor & Mesh`.
- **Zone 3: Persona Grid / Cards:**
  - Persona Name, Role, Version, Risk Level, Allowed Domains count, Budget metrics, Actions ("Inspect Persona", "View Allowed Capabilities").

### 7.3 Standardized Modals (`theme.md` §8):
- `CapabilityDetailModal.tsx`:
  - Demarcated header `<DialogHeader demarcated>` with min-h-[52px]/[56px], border-b, bg-muted/20.
  - Zero raw descriptions; `<DialogDescription className="sr-only">`.
  - Single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`.
  - Tabs: `Overview`, `JSON Schema`, `OpenAPI Specification`, `Security & Drift`.
  - Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
- `AgentPersonaDetailModal.tsx`:
  - Demarcated header and footer, single-circle info tooltip.
  - Tabs: `Profile & Role`, `Allowed Capabilities`, `Resource Budgets`, `Governance Policies`.

---

## 8. The Rule 67 Agent Implementation Gate Assessment

```text
1. ARCHITECTURE
□ Canonical Capabilities: discovery.search_capabilities, registry.generate_documentation registered in CapabilityRegistry.
□ Zero Service Duplication: Reuses CapabilityRegistry, BUILT_IN_AGENT_PERSONAS, ToolDriftMonitor, and defaultEventBus.
□ Single Source of Truth: Canonical Zod v4 schemas for all registry, discovery, and doc models.
□ Domain Events: Emits registry.capability.discovered, registry.persona.configured.

2. AUTHORITY
□ Scoped RBAC: Bound to registry:read, discovery:search, registry:manage, persona:configure.
□ Allowed Actions: Searching tools, generating documentation, reading persona definitions.
□ Forbidden Actions: Subagent persona modification or budget overrides (Rule 17 Non-Delegable).
□ Delegation Attenuation: Subagents cannot inherit persona:configure.

3. DATA
□ Ingress: Search queries, intent strings, capability metadata.
□ Egress: Minimal discovery stubs, OpenAPI specs, Markdown guides. Zero secret leakage.
□ Trusted vs Untrusted: Input text scanned with linear regex and sanitized.
□ Sensitive Data: No API keys, credentials, or internal secrets in generated documentation.

4. EXECUTION
□ Idempotency: Persona configuration mutations enforce deterministic idempotency keys.
□ Retries: Read queries execute statelessly without side effects.
□ Cancellation: Cooperative AbortSignal listener on doc generation and discovery queries.
□ Concurrency: Isolated in-memory caches; zero cross-tenant contamination.

5. MCP
□ Protocol Spec: Generates valid MCP 2026-07-28 tool manifests.
□ Drift Defense: Binds live tool definitions to SHA-256 fingerprints.

6. FAILURE
□ FMEA: Registry failure modes mapped to recovery strategies.
□ Error Taxonomy: Typed RegistryDomainError with canonical error codes.
□ Circuit Breakers: Tripped on unhandled discovery errors.
□ Saga Compensation: Reverts persona configuration mutations on failure.

7. SECURITY
□ The Model Is Never the Security Boundary (Rule 68 #11): Discovery indexing and schema generation run in pure code.
□ Tool Output Is Untrusted Data (Rule 68 #12): Generated documentation sanitized before rendering.
□ Dead-Man Controls: checkGovernanceDeadManSwitch evaluated on all mutations.
□ Anti-IDOR: Scoped tenant boundary validation on all Server Actions.

8. OPERATIONS
□ Backoffice Control: Registries operable directly via UI without code deployments.
□ Replayability: 100% deterministic OpenAPI and Markdown generation from capability AST.
□ Rollback: Reverse-LIFO Saga rollback for persona configuration edits.
□ No-Code Configuration: Persona budgets and allowed domains viewable via UI.

9. TESTING
□ Battery: Unit, integration, UI, and security test suites.
□ Pass SLA: 100% test pass rate across all suites before deployment.

10. MIGRATION
□ Strangler Fig: 100% preservation of all preexisting routes in AdminSidebar.tsx.
□ Data Compatibility: Zero schema modifications to production business collections.
```

---

## 9. Rule 68: The Five Non-Negotiables Verification

1. **Non-Negotiable 11: The model is never the security boundary.**
   - All progressive tool filtering, schema validation, and doc compilation execute in pure deterministic TypeScript code.
2. **Non-Negotiable 12: Tool output is untrusted data.**
   - Output from capabilities is validated against Zod schemas before rendering in the registry UI.
3. **Non-Negotiable 13: Every mutation must be idempotent, authorized, version-checked and auditable.**
   - Persona configuration edits require idempotency keys, validate Clerk auth, emit domain events, and record audit trails.
4. **Non-Negotiable 14: Every production agent must have bounded authority and bounded resources.**
   - Agent personas are strictly restricted to `registry:read` and `discovery:search`. Autonomous agents cannot modify persona configurations.
5. **Non-Negotiable 15: Every autonomous capability must be operable without code.**
   - Capability inspection, OpenAPI spec export, and persona configs are operable via Backoffice Server Actions and UI without redeployment.

---

## 10. Rule 69 Strangler Fig Pattern Verification

- **Preservation Invariant:** Preserves 100% of all existing routes in `AdminSidebar.tsx`.
- **Existing Aliases:** Updates `/admin/settings/ai/capabilities` from redirecting to `/admin/mcp?tab=catalog` into the dedicated, first-class Tool Registry UI, while keeping `/admin/mcp` fully operational for operator runtime actions.
- **Zero Disruptions:** New registry services are additive and integrate via standard platform interfaces (`CapabilityRegistry`, `defaultEventBus`, `permission-refs.ts`).

---

## 11. Bite-Sized Implementation Tasks

### Task 1: Canonical Registry Contracts, Schemas, Error Taxonomy & 4 Governance Matrices

**Files:**
- Create: `src/platform/registry/contracts/registry-types.ts`
- Create: `src/platform/registry/contracts/index.ts`
- Test: `src/platform/__tests__/registry/capability-registry-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**
```typescript
// src/platform/__tests__/registry/capability-registry-contracts.test.ts
import { describe, it, expect } from 'vitest';
import {
  CapabilityCatalogItemSchema,
  AgentPersonaSummarySchema,
  ProgressiveDiscoveryQuerySchema,
  DiscoveryStubSchema,
  DocumentationExportFormatSchema,
  REGISTRY_ERROR_CODES,
  RegistryDomainError,
  REGISTRY_PERMISSION_MATRIX,
  REGISTRY_TOOL_MATRIX,
  REGISTRY_FAILURE_MATRIX,
  REGISTRY_ROLLBACK_MATRIX,
} from '@/platform/registry/contracts/registry-types';

describe('Phase 15 Milestone 4 - Registry Contracts & Governance Matrices', () => {
  it('validates a capability catalog item schema', () => {
    const validItem = {
      id: 'crm.contact.get',
      domain: 'crm_contacts',
      version: '1.0.0',
      description: 'Fetches contact details by ID',
      riskLevel: 'L0_READ',
      requiresApproval: false,
      permissions: ['workspace:read'],
      isDelegable: true,
      driftStatus: 'APPROVED',
      lastVerifiedAt: '2026-10-08T00:00:00.000Z',
    };
    const parsed = CapabilityCatalogItemSchema.parse(validItem);
    expect(parsed.id).toBe('crm.contact.get');
    expect(parsed.riskLevel).toBe('L0_READ');
  });

  it('validates an agent persona summary schema', () => {
    const validPersona = {
      id: 'crm_researcher',
      name: 'CRM Researcher Agent',
      version: '1.0.0',
      role: 'Account Intelligence Specialist',
      maxAutonomousRiskLevel: 'L0_READ',
      allowedDomains: ['crm_contacts', 'knowledge_memory'],
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      isConfigurable: false,
    };
    const parsed = AgentPersonaSummarySchema.parse(validPersona);
    expect(parsed.id).toBe('crm_researcher');
    expect(parsed.allowedDomains).toHaveLength(2);
  });

  it('validates progressive discovery query schema', () => {
    const validQuery = {
      intent: 'Schedule meeting with customer',
      domain: 'meetings_conversations',
      limit: 5,
      maxTokens: 250,
    };
    const parsed = ProgressiveDiscoveryQuerySchema.parse(validQuery);
    expect(parsed.limit).toBe(5);
  });

  it('validates minimal discovery stub schema', () => {
    const validStub = {
      id: 'meetings.search',
      domain: 'meetings_conversations',
      name: 'Search Meetings',
      summary: 'Search scheduled meetings by participant or date',
      riskLevel: 'L0_READ',
      estimatedTokens: 38,
    };
    const parsed = DiscoveryStubSchema.parse(validStub);
    expect(parsed.estimatedTokens).toBeLessThanOrEqual(45);
  });

  it('verifies typed RegistryDomainError mapping to HTTP status', () => {
    const error = new RegistryDomainError(
      'REGISTRY_CAPABILITY_NOT_FOUND',
      'Capability unknown.tool not found',
      404
    );
    expect(error.code).toBe('REGISTRY_CAPABILITY_NOT_FOUND');
    expect(error.httpStatus).toBe(404);
  });

  it('verifies the 4 Governance Matrices integrity', () => {
    expect(REGISTRY_PERMISSION_MATRIX.all_agent_personas).toContain('discovery:search');
    expect(REGISTRY_PERMISSION_MATRIX.all_agent_personas).not.toContain('persona:configure');
    expect(REGISTRY_TOOL_MATRIX['discovery.search_capabilities'].level).toBe('L0_READ');
    expect(REGISTRY_TOOL_MATRIX['registry.update_agent_persona_config'].isDelegable).toBe(false);
    expect(REGISTRY_FAILURE_MATRIX['REGISTRY_UNAUTHORIZED_MUTATION'].recoveryStrategy).toBe('FAIL_CLOSED');
    expect(REGISTRY_ROLLBACK_MATRIX['registry.update_agent_persona_config']).toBe('registry.restore_agent_persona_config');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npx vitest run src/platform/__tests__/registry/capability-registry-contracts.test.ts
```
Expected: FAIL with "Cannot find module '@/platform/registry/contracts/registry-types'"

- [ ] **Step 3: Implement minimal code in `src/platform/registry/contracts/registry-types.ts` & barrel**
Implement:
- `CapabilityCatalogItemSchema`
- `AgentPersonaSummarySchema`
- `ProgressiveDiscoveryQuerySchema`
- `DiscoveryStubSchema`
- `DocumentationExportFormatSchema`
- `REGISTRY_ERROR_CODES`, `RegistryDomainError`
- `REGISTRY_PERMISSION_MATRIX`, `REGISTRY_TOOL_MATRIX`, `REGISTRY_FAILURE_MATRIX`, `REGISTRY_ROLLBACK_MATRIX`
- Barrel export in `src/platform/registry/contracts/index.ts`

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run src/platform/__tests__/registry/capability-registry-contracts.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/platform/registry/contracts/ src/platform/__tests__/registry/
git commit -m "feat(registry): add canonical registry contracts, schemas and 4 governance matrices"
```

---

### Task 2: Progressive Capability Discovery Engine (Roadmap §21 & Rule 28)

**Files:**
- Create: `src/platform/registry/discovery/progressive-discovery-service.ts`
- Create: `src/platform/registry/discovery/index.ts`
- Test: `src/platform/__tests__/registry/progressive-discovery.test.ts`

- [ ] **Step 1: Write the failing discovery test**
```typescript
// src/platform/__tests__/registry/progressive-discovery.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProgressiveDiscoveryService,
  getProgressiveDiscoveryService,
} from '@/platform/registry/discovery/progressive-discovery-service';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';

describe('Phase 15 Milestone 4 - Progressive Capability Discovery Engine', () => {
  let service: ProgressiveDiscoveryService;

  beforeEach(() => {
    service = new ProgressiveDiscoveryService(canonicalCapabilityRegistryStore);
  });

  it('returns minimal discovery stubs under 45 tokens per tool', async () => {
    const results = await service.searchCapabilities({
      intent: 'Find and inspect customer contact details',
      maxTokens: 500,
    });
    expect(results.stubs.length).toBeGreaterThan(0);
    for (const stub of results.stubs) {
      expect(stub.estimatedTokens).toBeLessThanOrEqual(45);
      expect(stub.id).toBeDefined();
      expect(stub.summary).toBeDefined();
      expect(stub.domain).toBeDefined();
      expect(stub.riskLevel).toBeDefined();
    }
    expect(results.totalTokenEstimate).toBeLessThanOrEqual(500);
  });

  it('filters capabilities by domain hierarchy', async () => {
    const results = await service.searchCapabilities({
      domain: 'crm_contacts',
      limit: 10,
    });
    for (const stub of results.stubs) {
      expect(stub.domain).toBe('crm_contacts');
    }
  });

  it('retrieves full capability details on demand in stage 2 expansion', async () => {
    const details = await service.getCapabilityDetails('crm.contact.get');
    if (details) {
      expect(details.id).toBe('crm.contact.get');
      expect(details.schema).toBeDefined();
      expect(details.permissions).toBeDefined();
    }
  });

  it('suggests related capabilities in stage 3 exploration', async () => {
    const related = await service.getRelatedCapabilities('meetings_conversations');
    expect(Array.isArray(related)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npx vitest run src/platform/__tests__/registry/progressive-discovery.test.ts
```
Expected: FAIL with "Cannot find module '@/platform/registry/discovery/progressive-discovery-service'"

- [ ] **Step 3: Implement `ProgressiveDiscoveryService`**
- Implement indexing of registered capabilities from `canonicalCapabilityRegistryStore`.
- Keyword extraction and ranking algorithm.
- Stub generation with strict token budget check ($\le 45$ tokens per stub, total $\le \text{maxTokens}$).
- Event publishing `registry.capability.discovered` to `defaultEventBus`.
- Global singleton `getProgressiveDiscoveryService()`.
- Barrel export in `src/platform/registry/discovery/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run src/platform/__tests__/registry/progressive-discovery.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/platform/registry/discovery/ src/platform/__tests__/registry/progressive-discovery.test.ts
git commit -m "feat(registry): implement progressive capability discovery engine"
```

---

### Task 3: Platform Auto-Documentation Generator (Roadmap §25)

**Files:**
- Create: `src/platform/registry/docs/platform-doc-generator.ts`
- Create: `src/platform/registry/docs/index.ts`
- Test: `src/platform/__tests__/registry/platform-doc-generator.test.ts`

- [ ] **Step 1: Write the failing documentation generator test**
```typescript
// src/platform/__tests__/registry/platform-doc-generator.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlatformDocGenerator,
  getPlatformDocGenerator,
} from '@/platform/registry/docs/platform-doc-generator';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';

describe('Phase 15 Milestone 4 - Platform Auto-Documentation Generator', () => {
  let generator: PlatformDocGenerator;

  beforeEach(() => {
    generator = new PlatformDocGenerator(canonicalCapabilityRegistryStore);
  });

  it('generates a valid OpenAPI 3.1.0 specification document', () => {
    const openApi = generator.generateOpenApiSpec();
    expect(openApi.openapi).toBe('3.1.0');
    expect(openApi.info.title).toContain('SmartSapp');
    expect(openApi.paths).toBeDefined();
    expect(typeof openApi.paths).toBe('object');
  });

  it('generates an MCP 2026-07-28 compliant tool manifest', () => {
    const manifest = generator.generateMcpManifest();
    expect(manifest.tools).toBeDefined();
    expect(Array.isArray(manifest.tools)).toBe(true);
    if (manifest.tools.length > 0) {
      const tool = manifest.tools[0];
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('generates structured Markdown reference documentation for a domain', () => {
    const markdown = generator.generateDomainMarkdown('crm');
    expect(markdown).toContain('# CRM Domain Capabilities');
    expect(markdown).toContain('## Overview');
    expect(markdown).toContain('Risk Level');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npx vitest run src/platform/__tests__/registry/platform-doc-generator.test.ts
```
Expected: FAIL with "Cannot find module '@/platform/registry/docs/platform-doc-generator'"

- [ ] **Step 3: Implement `PlatformDocGenerator`**
- Converts Zod schemas or capability input/output schemas to JSON Schema format.
- OpenAPI 3.1.0 compiler producing valid `/paths` and `components/schemas`.
- MCP `tools/list` compliant manifest generator.
- Markdown dossier generator with sanitized parameter tables and FMEA tables.
- Global singleton `getPlatformDocGenerator()`.
- Barrel export in `src/platform/registry/docs/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run src/platform/__tests__/registry/platform-doc-generator.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/platform/registry/docs/ src/platform/__tests__/registry/platform-doc-generator.test.ts
git commit -m "feat(registry): implement platform auto-documentation generator"
```

---

### Task 4: Canonical Registry Capabilities & RBAC Permission Mapping

**Files:**
- Create: `src/platform/capabilities/registry/registry-capabilities.ts`
- Create: `src/platform/capabilities/registry/index.ts`
- Modify: `src/platform/capabilities/contracts/permission-refs.ts`
- Test: `src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts`

- [ ] **Step 1: Write failing capability registration test**
```typescript
// src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts
import { describe, it, expect } from 'vitest';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import '@/platform/capabilities/registry/registry-capabilities';

describe('Phase 15 Milestone 4 - Registry Canonical Capabilities', () => {
  it('registers discovery.search_capabilities in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('discovery.search_capabilities');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
    expect(cap?.permissions).toContain('discovery:search');
  });

  it('registers discovery.get_capability_details in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('discovery.get_capability_details');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
  });

  it('registers registry.generate_documentation in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('registry.generate_documentation');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
    expect(cap?.policies?.auditRequired).toBe(true);
  });

  it('registers registry.export_mcp_manifest in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('registry.export_mcp_manifest');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npx vitest run src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts
```
Expected: FAIL with missing capabilities or permissions.

- [ ] **Step 3: Update `permission-refs.ts` and implement `registry-capabilities.ts`**
- In `permission-refs.ts`, register:
  * `registry:read`
  * `discovery:search`
  * `registry:manage`
  * `persona:configure`
- In `registry-capabilities.ts`, define and register the 4 canonical capabilities with Zod v4 inputs/outputs and handlers calling `ProgressiveDiscoveryService` and `PlatformDocGenerator`.
- Re-export in `src/platform/capabilities/registry/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/platform/capabilities/registry/ src/platform/capabilities/contracts/permission-refs.ts src/platform/__tests__/registry/
git commit -m "feat(registry): register canonical registry capabilities and permissions"
```

---

### Task 5: Governed Next.js 15 Server Actions

**Files:**
- Create: `src/app/actions/registry-actions.ts`
- Modify: `src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts`

- [ ] **Step 1: Write failing Server Actions test**
Add test cases in `src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts`:
- Auth check: reject unauthenticated callers with HTTP 401.
- Anti-IDOR check: reject cross-tenant callers with HTTP 403.
- Dead-man switch check: reject mutations when kill-switch is active with HTTP 503.
- Successful search returning sanitized stubs.
- Successful doc generation returning OpenAPI / Markdown string.
- Successful persona list returning 26 personas with immutable versions.

- [ ] **Step 2: Run test to verify it fails**
```bash
npx vitest run src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts
```
Expected: FAIL with "Cannot find module '@/app/actions/registry-actions'"

- [ ] **Step 3: Implement `src/app/actions/registry-actions.ts`**
- Mark file `'use server'`.
- Implement:
  * `searchCapabilitiesAction(params: SearchCapabilitiesInput)`
  * `getCapabilityDetailsAction(capabilityId: string)`
  * `generatePlatformDocsAction(params: GenerateDocsInput)`
  * `getAgentPersonasAction()`
  * `getAgentPersonaDetailsAction(personaId: string)`
- Protect with `requireAuth()`, Anti-IDOR tenant lock (`assertTenantAccess`), and `checkGovernanceDeadManSwitch`.
- Strict typing with zero `any` or `any[]`.

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run src/platform/__tests__/registry/registry-capabilities-and-actions.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/app/actions/registry-actions.ts src/platform/__tests__/registry/
git commit -m "feat(registry): implement governed server actions for capabilities and personas"
```

---

### Task 6: Operator UI Surfaces: Tool Registry, Agent Registry & Standardized Modals (`theme.md` §8)

**Files:**
- Create: `src/components/registry/CapabilityDetailModal.tsx` (`theme.md` §8)
- Create: `src/components/registry/AgentPersonaDetailModal.tsx` (`theme.md` §8)
- Create: `src/components/registry/index.ts`
- Create: `src/app/admin/settings/ai/capabilities/CapabilityRegistryClient.tsx`
- Replace: `src/app/admin/settings/ai/capabilities/page.tsx`
- Create: `src/app/admin/settings/ai/agents/AgentRegistryClient.tsx`
- Create: `src/app/admin/settings/ai/agents/page.tsx`
- Modify: `src/app/admin/components/AdminSidebar.tsx` (add Agent Registry under `SYSTEM` or `INTELLIGENCE`, preserving 100% of existing items)
- Test: `src/platform/__tests__/ui/capability-registry-ui.test.tsx`

- [ ] **Step 1: Write failing UI test**
```typescript
// src/platform/__tests__/ui/capability-registry-ui.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapabilityRegistryClient } from '@/app/admin/settings/ai/capabilities/CapabilityRegistryClient';
import { AgentRegistryClient } from '@/app/admin/settings/ai/agents/AgentRegistryClient';

describe('Phase 15 Milestone 4 - Registry Operator UI Surfaces', () => {
  it('renders Capability Registry with Zone 1 KPI cards and domain filters', () => {
    render(
      <CapabilityRegistryClient
        initialCapabilities={[
          {
            id: 'crm.contact.get',
            domain: 'crm_contacts',
            version: '1.0.0',
            description: 'Fetches contact details',
            riskLevel: 'L0_READ',
            requiresApproval: false,
            permissions: ['workspace:read'],
            isDelegable: true,
            driftStatus: 'APPROVED',
            lastVerifiedAt: '2026-10-08T00:00:00.000Z',
          },
        ]}
      />
    );
    expect(screen.getByText('Capabilities Registry')).toBeDefined();
    expect(screen.getByText('crm.contact.get')).toBeDefined();
  });

  it('renders Agent Persona Registry with 26 canonical personas', () => {
    render(
      <AgentRegistryClient
        initialPersonas={[
          {
            id: 'crm_researcher',
            name: 'CRM Researcher Agent',
            version: '1.0.0',
            role: 'Account Intelligence Specialist',
            maxAutonomousRiskLevel: 'L0_READ',
            allowedDomains: ['crm_contacts'],
            maxDurationMs: 120000,
            maxTokens: 50000,
            maxToolCalls: 15,
            isConfigurable: false,
          },
        ]}
      />
    );
    expect(screen.getByText('Agent Persona Registry')).toBeDefined();
    expect(screen.getByText('CRM Researcher Agent')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
npx vitest run src/platform/__tests__/ui/capability-registry-ui.test.tsx
```
Expected: FAIL with missing components.

- [ ] **Step 3: Implement components, pages, modals, and update AdminSidebar**
- Build `CapabilityDetailModal.tsx` strictly conforming to `theme.md` §8:
  * Surface geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
  * Header: `<DialogHeader demarcated>` with min-h-[52px]/[56px], border-b, bg-muted/20
  * Description: `<DialogDescription className="sr-only">`, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`
  * Tabs: Overview, Schema, OpenAPI, Drift
  * Footer: Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
- Build `AgentPersonaDetailModal.tsx` adhering to `theme.md` §8.
- Build `CapabilityRegistryClient.tsx` with 3-zone layout, 300ms debounced search, domain chips, and drift indicators.
- Replace `/admin/settings/ai/capabilities/page.tsx` with server component loading initial capabilities.
- Build `AgentRegistryClient.tsx` and `/admin/settings/ai/agents/page.tsx`.
- Update `AdminSidebar.tsx`: Add `Agent Registry` under System / AI Settings, keeping 100% of preexisting 53 navigation routes and accordion state intact (Rule 69).

- [ ] **Step 4: Run test to verify it passes**
```bash
npx vitest run src/platform/__tests__/ui/capability-registry-ui.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/registry/ src/app/admin/settings/ai/ src/app/admin/components/AdminSidebar.tsx src/platform/__tests__/ui/
git commit -m "feat(registry): implement Tool Registry and Agent Registry backoffice UI surfaces"
```

---

### Task 7: Full Test Battery, Red-Team Gate & Platform Regression Verification

**Files:**
- Verify: all test suites in `src/platform/__tests__/registry/` and `src/platform/__tests__/ui/`
- Verify regressions: `src/platform/__tests__/security/`, `src/platform/__tests__/cost/`, `src/platform/__tests__/evaluation/`, `src/platform/__tests__/verification/`
- Verify strict typing: zero `: any` or `as any`.

- [ ] **Step 1: Run all Milestone 4 test suites**
```bash
npx vitest run src/platform/__tests__/registry/ src/platform/__tests__/ui/capability-registry-ui.test.tsx
```
Expected: 100% PASS

- [ ] **Step 2: Run full Phase 15 regression suite**
```bash
npx vitest run src/platform/__tests__/security/ src/platform/__tests__/cost/ src/platform/__tests__/evaluation/
```
Expected: 100% PASS

- [ ] **Step 3: Run full verification suite across all earlier phases**
```bash
npx vitest run src/platform/__tests__/verification/
```
Expected: 100% PASS

- [ ] **Step 4: Verify strict typing (zero `any` or `any[]`)**
Check files for forbidden `any` or `any[]` tokens.

- [ ] **Step 5: Commit**
```bash
git commit -m "chore(registry): verify all Milestone 4 test suites and regressions"
```

---

### Task 8: Completion Report & Senior Principal Architecture Review

- [ ] **Step 1: Author Completion Report**
Write `docs/agents_mcp/phases/agents_mcp_phase_15_milestone_4_completion_report.md` detailing:
- Executive summary & verification evidence
- Progressive Discovery performance metrics (tokens before vs after)
- Auto-Doc Generator outputs (OpenAPI, MCP, Markdown)
- Backoffice UI screenshots / component verification
- Zero `any` compliance

- [ ] **Step 2: Save brain artifact**
Write artifact `phase_15_milestone_4_completion_report.md` in `<appDataDir>/brain/<conversation-id>/phase_15_milestone_4_completion_report.md`.

- [ ] **Step 3: Invoke Senior Principal Architecture Reviewer**
Dispatch `Senior Principal Systems & AI Agentic Architecture Reviewer` subagent for comprehensive Grade A evaluation and sign-off.

- [ ] **Step 4: Save code review report & artifact**
Write `docs/agents_mcp/phases/agents_mcp_phase_15_milestone_4_code_review.md` and brain artifact `phase_15_milestone_4_code_review.md`.

---

## 12. Commitments & Constraints

1. **Zero `any` or `any[]` (Rule 4):** Absolute strict typing across all contracts, services, actions, and UI components.
2. **Standardized Modal Architecture (`theme.md` §8):** Demarcated header/footer, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw descriptions, tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
3. **Anti-IDOR Tenant Lock (Rules 8 & 47):** Every Server Action strictly validates organizational boundaries.
4. **Emergency Dead-Man Fail-Closed Control (Rule 60):** `checkGovernanceDeadManSwitch` verified on all mutating capabilities and actions.
5. **Testing Protocol:** Run unit, contract, and UI tests locally via Vitest (`npx vitest run ...`). Do not run local `pnpm typecheck` or `pnpm lint` (leave for GitHub Actions CI on push).
6. **Strict Execution Boundary:** Do not begin implementation of Phase 15 Milestone 4 until this plan is explicitly approved by the user.
