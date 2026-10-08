# SmartSapp Agentic & MCP Transformation: Phase 15 Milestone 3 Plan
## Adversarial Red-Team Battery, Chaos Injection & Dependency Drift Monitor
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1965–1976), Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Strangler Fig Pattern, and `theme.md` §8

**Version:** 2.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Senior Principal Systems Architect  
**Git Branch:** `main`

---

## 1. Goal & Milestone Overview

Milestone 3 delivers the enterprise **Adversarial Red-Team Battery, Chaos Fault Injection Engine, and Cryptographic Tool Definition Drift Monitor** to the SmartSapp platform, operationalizing the mandates of `docs/agents_mcp/agents_mcp_roadmap.md` (§14 Adversarial Security, §20 Chaos Engineering) and embedding full compliance with `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, specifically Rules 4, 8, 12, 13, 14, 16, 17, 18, 19, 22, 24, 25, 26, 27, 30, 40, 45, 46, 47, 48, 51, 60, 67, 68, 69, and Rules 1940–1953 / 1971–1974).

Prior to Milestone 3, adversarial testing was executed through scattered domain test files, chaos testing was performed ad-hoc, and external tool definitions lacked automated cryptographic fingerprinting to defend against the OWASP **rug-pull problem** (Rule 14).

Milestone 3 resolves these operational vulnerabilities by establishing:
1. **10-Vector Automated Adversarial Red-Team Suite (`AdversarialInjectionRunner`)**:
   - Tests indirect prompt injection neutralization and untrusted text isolation across all 10 ingress vectors (Rules 13, 30, 46):
     1. `EMAIL_BODY`: Malicious directives hidden in customer emails.
     2. `WEBSITE_DOM`: Hidden DOM elements, meta tags, and white-text injections in scraped web pages.
     3. `PDF_DOCUMENT`: Injected instructions inside uploaded invoices or customer documents.
     4. `CRM_NOTE`: Shared collaborator notes attempting to hijack Next-Best-Action (NBA) scoring.
     5. `MEETING_TRANSCRIPT`: Spoken audio manipulation attempting destructive agent execution.
     6. `FORM_FIELD`: Form inputs with control characters, delimiters, and system override tokens.
     7. `CUSTOMER_CHAT`: WhatsApp/webchat messages probing system prompt boundaries.
     8. `MCP_METADATA`: Injected instructions in external MCP tool descriptions and prompts.
     9. `TOOL_OUTPUT`: Untrusted output from secondary capabilities attempting confused-deputy attacks.
     10. `KNOWLEDGE_POISONING`: Contradictory or malicious factual assertions injected into memory/RAG.
   - Enforces linear non-backtracking regex scanner (`ADVERSARIAL_DIRECTIVE_PATTERNS`) and XML containerization inside `<untrusted_reference_data id="...">` (Rules 13 & 30).
2. **Chaos Fault Injection Engine (`ChaosInjectionEngine`) (Rules 24, 25, 26, 27, 45, 1972)**:
   - Injects deterministic synthetic faults into capability executions:
     - `HTTP_429_RATE_LIMIT`: Simulates upstream model provider rate-limiting and asserts exponential backoff + multi-provider fallback cascade.
     - `HTTP_500_PROVIDER_TIMEOUT`: Simulates provider downtime and asserts failover.
     - `NETWORK_LATENCY_JITTER`: Simulates latency spikes and asserts cooperative cancellation via `AbortSignal` (Rule 26).
     - `CONCURRENT_STATE_COLLISION`: Simulates optimistic concurrency version conflicts (Rule 18).
     - `PARTIAL_EXECUTION_FAILURE`: Simulates DAG failure and asserts Reverse-LIFO Saga compensation (Rule 27) and Dead-Letter Queue (DLQ) quarantine (Rule 25).
3. **Cryptographic Tool Definition Drift & Rug-Pull Defense (`ToolDriftMonitor`) (Rule 14 & 1974)**:
   - Computes canonical SHA-256 fingerprints across 8 tool dimensions:
     `toolId`, `serverId`, `serverVersion`, `toolVersion`, `schemaHash`, `descriptionHash`, `permissionHash`, `riskHash`.
   - Compares live definitions against the approved baseline snapshot.
   - On hash mismatch (drift / rug-pull): immediately locks tool execution (`TOOL_EXECUTION_LOCKED`), routes to incident management, and requires re-approval from a human administrator (`actor.type === 'user'`, Rule 17).
4. **The 4 Mandatory Governance Matrices (Rules 1940–1953)**:
   - `SECURITY_CHAOS_PERMISSION_MATRIX`, `SECURITY_CHAOS_TOOL_MATRIX`, `SECURITY_CHAOS_FAILURE_MATRIX`, `SECURITY_CHAOS_ROLLBACK_MATRIX`.
   - Enforces that chaos injection is strictly gated (`chaos:inject`), and re-approving drifted tool definitions (`security:manage`) is non-delegable to agents (Rule 17).
5. **Governed Next.js 15 Server Actions (`src/app/actions/security-chaos-actions.ts`)**:
   - Gated by Clerk session auth (`requireAuth()`), Anti-IDOR validation (`assertTenantAccess`), and Rule 60 emergency dead-man pause evaluation (`checkGovernanceDeadManSwitch`).

---

## 2. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│               PHASE 15 MILESTONE 3: SECURITY & CHAOS ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │   10-VECTOR ADVERSARIAL INGRESS (Email, Notes, PDF, Transcripts, etc.)   │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │   Linear Scanner & XML Isolation (<untrusted_reference_data id="...">)   │   │
│   │   Rule 13 & Rule 30: Zero Prompt Injection Escalation                       │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │   CHAOS INJECTION ENGINE (Rule 45 & Rule 1972)                          │   │
│   │   - 429 Rate Limits -> Fallback Cascades (Rule 24 & FM-3)                   │   │
│   │   - Timeouts -> AbortSignal Cooperative Cancellation (Rule 26)              │   │
│   │   - Partial Failures -> Reverse-LIFO Saga Compensation (Rule 27)            │   │
│   │   - Unrecoverable Faults -> DLQ Quarantine (Rule 25)                        │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │   TOOL DRIFT & RUG-PULL MONITOR (Rule 14 & 1974)                        │   │
│   │   - Canonical SHA-256 Fingerprint (Schema, Desc, Perms, Risk)               │   │
│   │   - Automated Drift Detection -> Auto-Lock & Operator Re-Consent            │   │
│   │   - Non-Delegable Approval (actor.type === 'user', Rule 17)                 │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │   DOMAIN EVENT BUS (security.drift.detected, chaos.fault.injected, etc.)│   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 4 Mandatory Governance Matrices (Rules 1940–1953)

### 3.1 `SECURITY_CHAOS_PERMISSION_MATRIX` (Rules 8, 16, 17)
Strictly defines role-based access control scopes for all security, adversarial testing, and chaos capabilities.

| Persona / Actor | Allowed Scopes | Forbidden Scopes | Security Rationale |
| :--- | :--- | :--- | :--- |
| **All Agent Personas** | `security:read` | `security:manage`, `chaos:inject` | Autonomous agents may inspect security status, but cannot inject faults or approve drifted tools |
| **QA / Evaluation Persona** | `security:read`, `chaos:inject` | `security:manage` | Testing personas may trigger chaos injection in dry-run mode, but cannot re-approve tool baselines |
| **Human Admin User** | `security:read`, `security:manage`, `chaos:inject` | None | Only human administrators can approve modified tool fingerprints (Rule 17 Non-Delegable) |

### 3.2 `SECURITY_CHAOS_TOOL_MATRIX` (Rules 12, 14, 17)
Exhaustive inventory of security and resilience capabilities with assigned risk tiers and governance metadata.

| Capability ID | Risk Level | Idempotency | Audit Required | Non-Delegable |
| :--- | :---: | :---: | :---: | :---: |
| `security.scan_text` | `L0_READ` | No | No | No |
| `security.run_adversarial_suite` | `L0_READ` | No | Yes | No |
| `chaos.inject_fault` | `L2_STATE_MUTATION` | Yes | Yes | No |
| `security.verify_tool_drift` | `L0_READ` | No | No | No |
| `security.approve_tool_fingerprint` | `L2_STATE_MUTATION` | Yes | Yes | **Yes (Rule 17)** |

### 3.3 `SECURITY_CHAOS_FAILURE_MATRIX` (Rules 2, 24, 48)
Deterministic failure recovery mappings for structured security error codes.

| Error Code | HTTP Status | Recovery Strategy | Action Description |
| :--- | :---: | :--- | :--- |
| `SECURITY_PROMPT_INJECTION_DETECTED` | 422 | `NEUTRALIZE_AND_ISOLATE` | Neutralizes instruction, encloses in XML container |
| `SECURITY_TOOL_DRIFT_DETECTED` | 409 | `LOCK_TOOL_AND_ALERT` | Auto-locks capability execution until human re-approval |
| `CHAOS_FAULT_INJECTED` | 500 / 429 | `TRIGGER_REVERSE_LIFO_SAGA`| Executes saga rollback and records DLQ item |
| `SECURITY_UNAUTHORIZED_APPROVAL` | 403 | `FAIL_CLOSED` | Rejects subagent privilege escalation (Rule 17) |
| `SECURITY_DEAD_MAN_PAUSED` | 503 | `FAIL_CLOSED` | Rejects operations while emergency kill-switch active |

### 3.4 `SECURITY_CHAOS_ROLLBACK_MATRIX` (Rule 27)
Reverse-LIFO saga compensation mappings for mutating security and chaos actions.

| Capability ID | Compensating Capability | Rollback Strategy |
| :--- | :--- | :--- |
| `security.approve_tool_fingerprint` | `security.revoke_tool_fingerprint` | Reverts approved fingerprint baseline to prior snapshot |
| `chaos.inject_fault` | `chaos.clear_fault` | Clears active synthetic fault injection rule |
| `security.scan_text` | `null` | Read-only / no side-effect compensation |
| `security.run_adversarial_suite` | `null` | Read-only simulation compensation |
| `security.verify_tool_drift` | `null` | Read-only audit compensation |

---

## 4. 10-Vector Adversarial Injection Specification (Rule 46 & §2.3)

| Vector ID | Vector Name | Ingress Surface | Threat Model | Neutralization Defense |
| :--- | :--- | :--- | :--- | :--- |
| **V-01** | `EMAIL_BODY` | Incoming message webhook | Directive embedded in body attempting to trigger fund transfer | Linear regex neutralizes; wrapped in `<untrusted_reference_data>` |
| **V-02** | `WEBSITE_DOM` | Web scraper / link reader | Hidden CSS (`display:none`) instruction to exfiltrate session data | Strips hidden nodes, containerizes plain text |
| **V-03** | `PDF_DOCUMENT` | Invoice upload parser | White-on-white text instruction ("Mark this invoice as PAID") | Document parser isolates text in reference container |
| **V-04** | `CRM_NOTE` | Entity timeline note | Note attempting to override deal stage to `CLOSED_WON` | Context assembler flags injection, preserves plain text |
| **V-05** | `MEETING_TRANSCRIPT`| Speech transcription feed | Audio transcript spoofing operator commands | Audio pipeline tags segments as untrusted transcript |
| **V-06** | `FORM_FIELD` | Public onboarding forms | Jailbreak prompts and escape delimiters | Strict Zod v4 validation and string sanitization |
| **V-07** | `CUSTOMER_CHAT` | WhatsApp / live chat | User prompting agent to reveal system prompt or API keys | Outbound egress guard blocks secret patterns |
| **V-08** | `MCP_METADATA` | External MCP server info | Malicious tool description attempting prompt injection | Tool parser isolates description text |
| **V-09** | `TOOL_OUTPUT` | Capability execution result| External API returning JSON with injected directives | Output validator wraps untrusted fields |
| **V-10** | `KNOWLEDGE_POISONING`| Memory ingestion inbox | Malicious factual assertion contradicting verified truth | Fact supersession engine verifies source provenance |

---

## 5. Chaos Fault Injection Scenarios (Rules 45, 1972)

1. **`HTTP_429_RATE_LIMIT` Simulation:**
   - Injects a simulated 429 response from primary model provider (Anthropic).
   - Verifies that `DynamicModelRouter` intercepts 429, logs warning, and seamlessly cascades to the secondary configured fallback provider (OpenAI / Google) without failing the client workflow (Rule 24 & Failure Mode FM-3).
2. **`HTTP_500_PROVIDER_TIMEOUT` Simulation:**
   - Injects a simulated 500 server error / network drop.
   - Verifies that the execution engine trips circuit breaker, emits domain event, and attempts configured retry or fallback.
3. **`NETWORK_LATENCY_JITTER` Simulation:**
   - Injects a 5,000ms+ artificial delay.
   - Verifies that client `AbortSignal` cooperative cancellation cleanly terminates execution, releases concurrency slots, and returns HTTP 504 `TIMEOUT` (Rule 26).
4. **`CONCURRENT_STATE_COLLISION` Simulation:**
   - Injects a simulated version bump (`expectedVersion !== currentVersion`).
   - Verifies that `StateVersionService` rejects mutation with HTTP 409 `CONCURRENCY_VIOLATION` (Rule 18).
5. **`PARTIAL_EXECUTION_FAILURE` Simulation:**
   - Injects synthetic failure on Step 3 of a 5-step Saga.
   - Verifies that `SagaCompensationService` executes compensating capabilities in exact reverse order (LIFO: Step 2 $\to$ Step 1), records unrecoverable state to Dead-Letter Queue (DLQ), and halts safely (Rule 25 & 27).

---

## 6. Cryptographic Tool Fingerprinting Specification (Rule 14 & 1974)

To prevent MCP tool poisoning and the OWASP **rug-pull problem**, every registered capability and MCP tool generates a canonical SHA-256 fingerprint:
$$\text{Fingerprint} = \text{sha256Hex}\left( \text{canonicalJson}\left( \left\{ \text{toolId}, \text{serverId}, \text{serverVersion}, \text{toolVersion}, \text{inputSchema}, \text{description}, \text{permissions}, \text{risk} \right\} \right) \right)$$

### Tool State Machine:
```text
  ┌──────────────┐
  │   APPROVED   │◄──────────────┐
  └──────┬───────┘               │
         │ Hash Mismatch         │ Human Admin Approval (Rule 17)
         ▼                       │
  ┌──────────────┐               │
  │   DRIFTED    ├───────────────┤
  └──────┬───────┘               │
         │ Auto-Lock Threshold   │
         ▼                       │
  ┌──────────────┐               │
  │    LOCKED    ├───────────────┘
  └──────────────┘
```

1. **Hash Verification:** On capability invocation, `ToolDriftMonitor.verifyFingerprint(toolId, liveDefinition)` compares live hash against approved baseline.
2. **Drift Detection:** If hashes differ:
   - Sets tool status to `DRIFTED`.
   - If change is material (schema modification, permission escalation, risk downgrade): immediately sets status to `LOCKED`.
   - Emits `security.drift.detected` domain event (Rule 40).
3. **Execution Guard:** Capability execution throws `CostDomainError(SECURITY_TOOL_DRIFT_DETECTED, ...)` when tool is `LOCKED`.
4. **Human Re-Approval:** Only authenticated human administrators (`actor.type === 'user'`) can update the approved fingerprint baseline via `security.approve_tool_fingerprint` (Rule 17 Non-Delegable).

---

## 7. Master 69-Rules Compliance Matrix

| Rule # | Requirement | Implementation Mechanism in Milestone 3 | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Rule 1** | Canonical Capability Layer | Security & chaos capabilities implemented as `CapabilityDefinition` in `src/platform/capabilities/security/` | `security-capabilities-and-actions.test.ts` |
| **Rule 2** | Failure Mode Planning | 5 chaos scenarios directly map to FMEA failure modes FM-1 through FM-5 | `chaos-injection.test.ts` |
| **Rule 4** | Strict Typing Protocol | Zero `any` or `any[]` throughout all contracts, schemas, and actions; validated Zod v4 schemas | `security-contracts.test.ts` |
| **Rule 8 & 47**| Multi-Tenant Anti-IDOR | Scoped `assertTenantAccess` on all Server Actions; zero cross-tenant leakage | Attack Vector 2 test passing |
| **Rule 10** | Inline Documentation | Exhaustive explanatory comments detailing threat models, regex security, and invariants | Verified in code review |
| **Rule 12** | Canonical Risk Vocabulary | Capabilities tagged with canonical risk tiers (`L0_READ`, `L2_STATE_MUTATION`) | `security-contracts.test.ts` |
| **Rule 13 & 30**| Prompt Injection XML Isolation | Linear non-backtracking regex scanner and `<untrusted_reference_data>` containerization across 10 vectors | `adversarial-injection.test.ts` |
| **Rule 14 & 1974**| Tool Poisoning & Drift Defense | 8-dimension SHA-256 tool fingerprinting and automated execution locking on drift | `tool-drift-monitor.test.ts` |
| **Rule 16 & 17**| Scoped RBAC & Non-Delegable | Agents restricted to `security:read`; tool fingerprint re-approval strictly non-delegable to agents | `security-capabilities-and-actions.test.ts` |
| **Rule 18** | TOCTOU Concurrency Guard | Chaos engine simulates state collisions; asserts optimistic lock rejection | `chaos-injection.test.ts` |
| **Rule 19** | Idempotency Verification | Mutating chaos & fingerprint capabilities require deterministic idempotency keys | `security-contracts.test.ts` |
| **Rule 22** | Cryptographic Digest Binding | Canonical key-sorted SHA-256 fingerprint hashing (`sha256Hex(canonicalJson(...))`) | `tool-drift-monitor.test.ts` |
| **Rule 24** | Dynamic Circuit Breakers | Chaos engine simulates 429/500 faults and validates fallback cascades | `chaos-injection.test.ts` |
| **Rule 25** | DLQ Quarantine | Unrecoverable chaos faults routed to Dead-Letter Queue with error context | `chaos-injection.test.ts` |
| **Rule 26** | Cooperative Cancellation | Native `AbortSignal` listener verified under simulated latency spikes | `chaos-injection.test.ts` |
| **Rule 27** | Reverse-LIFO Saga Rollback | Partial execution chaos fault triggers reverse-LIFO compensating capabilities | `chaos-injection.test.ts` |
| **Rule 40** | Domain Event Publishing | Emits `security.scan.executed`, `security.drift.detected`, `chaos.fault.injected` to EventBus | `adversarial-injection.test.ts` |
| **Rule 45** | Chaos Testing | Milestone 3 introduces dedicated synthetic fault injector for platform testing | `chaos-injection.test.ts` |
| **Rule 46** | Adversarial Testing | Automated runner testing all 10 ingress vectors with comprehensive assertions | `adversarial-injection.test.ts` |
| **Rule 48** | Structured Error Taxonomy | `SECURITY_ERROR_CODES` and typed `SecurityDomainError` class mapped to HTTP codes | `security-contracts.test.ts` |
| **Rule 51** | Server Action Security Gate | Next.js 15 Server Actions with `'use server'`, Clerk auth, Anti-IDOR, dead-man check | `security-capabilities-and-actions.test.ts` |
| **Rule 60** | Emergency Dead-Man Controls | Fail-closed evaluation via `checkGovernanceDeadManSwitch` on all security mutations | `security-capabilities-and-actions.test.ts` |
| **Rule 67** | The Agent Implementation Gate | 10-category verification gate verified for all Milestone 3 deliverables | Section 8 below |
| **Rule 68** | The Five Non-Negotiables | Strict enforcement of Non-Negotiables 11–15 (§9) | Section 9 below |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of all preexisting routes and services across the platform | Regression verification battery |

---

## 8. The Rule 67 Agent Implementation Gate Assessment

```text
1. ARCHITECTURE
□ Canonical Capabilities: Registered in CapabilityRegistry under domain 'ai_governance'.
□ Zero Service Duplication: Reuses canonicalJson, sha256Hex, defaultEventBus, and deadManModule.
□ Single Source of Truth: Canonical Zod v4 schemas for all security and chaos models.
□ Domain Events: Emits security.scan.executed, security.drift.detected, chaos.fault.injected.

2. AUTHORITY
□ Scoped RBAC: Mapped to security:read, security:manage, and chaos:inject.
□ Allowed Actions: Scanning text, running dry-run adversarial suites, verifying tool drift.
□ Forbidden Actions: Subagent tool fingerprint baseline modifications (Rule 17 Non-Delegable).
□ Delegation Attenuation: Subagents cannot inherit security:manage.

3. DATA
□ Ingress: 10 ingress vectors (Email, DOM, PDF, Notes, Transcripts, Forms, Chats, MCP, Tools, RAG).
□ Egress: Sanitized scan reports, drift alerts, and chaos outcomes. Zero secret leakage.
□ Trusted vs Untrusted: All external inputs enclosed in <untrusted_reference_data id="...">.
□ Sensitive Data: Masked credentials, tokens, and PII in scan reports.

4. EXECUTION
□ Idempotency: Mutations require deterministic idempotency keys.
□ Retries: Chaos 429 faults trigger exponential backoff.
□ Cancellation: Cooperative AbortSignal listener on all long-running scans.
□ Concurrency: Isolated in-memory fault rules; zero cross-tenant contamination.

5. MCP
□ Protocol Spec: 2026-07-28 stateless HTTP protocol.
□ SDK Version: @modelcontextprotocol/server v2.
□ Annotations: Treated strictly as hints; security enforced server-side.
□ Drift Defense: 8-dimension SHA-256 fingerprint verification on tool definitions.

6. FAILURE
□ FMEA: 5 failure modes mapped to recovery strategies.
□ Error Taxonomy: Typed SecurityDomainError with canonical error codes.
□ Circuit Breakers: Tripped on unhandled chaos errors.
□ Saga Compensation: Reverse-LIFO compensation for partial failures.

7. SECURITY
□ The Model Is Never the Security Boundary (Rule 68 #11): Scanner and drift monitor run in pure deterministic code.
□ Tool Output Is Untrusted Data (Rule 68 #12): Tool outputs scanned and wrapped before passing to agents.
□ Dead-Man Controls: checkGovernanceDeadManSwitch evaluated on all mutations.
□ Anti-IDOR: Scoped tenant boundary validation on all Server Actions.

8. OPERATIONS
□ Backoffice Control: Drift alerts and lock states operable without code deployments.
□ Replayability: 100% deterministic scenario replay from gold-standard datasets.
□ Rollback: Reverse-LIFO Saga rollback verified under synthetic failures.
□ No-Code Configuration: Fault rules and drift approvals operable via Server Actions.

9. TESTING
□ Battery: Unit, integration, red-team, and chaos test suites.
□ Pass SLA: 100% test pass rate across all suites before deployment.

10. MIGRATION
□ Strangler Fig: 100% preservation of all preexisting routes and services.
□ Data Compatibility: Zero schema modifications to production business collections.
```

---

## 9. Rule 68: The Five Non-Negotiables Verification

1. **Non-Negotiable 11: The model is never the security boundary.**
   - All prompt injection detection, XML isolation, and tool drift comparisons execute in pure TypeScript code prior to LLM invocation.
2. **Non-Negotiable 12: Tool output is untrusted data.**
   - Output from tools (Vector V-09) is scanned and wrapped inside `<untrusted_reference_data>` before consumption by agents.
3. **Non-Negotiable 13: Every mutation must be idempotent, authorized, version-checked and auditable.**
   - All state mutations (`chaos.inject_fault`, `security.approve_tool_fingerprint`) require idempotency keys, emit domain events, and record audit entries.
4. **Non-Negotiable 14: Every production agent must have bounded authority and bounded resources.**
   - Agent personas are strictly restricted to `security:read`. Tool locking enforces hard halts on unauthorized modifications.
5. **Non-Negotiable 15: Every autonomous capability must be operable without code.**
   - Tool locks, drift re-approvals, and chaos rules are operable via Backoffice Server Actions without redeployment.

---

## 10. Rule 69 Strangler Fig Pattern Verification

- **Preservation Invariant:** Preserves 100% of all existing routes, navigation bars, and capabilities across the platform.
- **Zero Disruptions:** New security and chaos services are additive and integrate via standard platform interfaces (`CapabilityRegistry`, `defaultEventBus`, `permission-refs.ts`).
- **Clean Fallbacks:** If a tool is flagged as drifted, execution falls back cleanly to the locked state without crashing runtime services.

---

## 11. Bite-Sized Implementation Tasks

### Task 1: Canonical Security & Chaos Contracts, Schemas, Error Taxonomy & 4 Governance Matrices
**Files:**
- Create: `src/platform/security/contracts/security-types.ts`
- Create: `src/platform/security/contracts/index.ts`
- Test: `src/platform/__tests__/security/security-contracts.test.ts`
- **TDD Step 1:** Write failing contract test covering 10 adversarial ingress vector schemas, chaos fault rules, tool fingerprint records, error taxonomy, and the 4 Governance Matrices.
- **TDD Step 2:** Run test to verify failure (`npx vitest run src/platform/__tests__/security/security-contracts.test.ts`).
- **TDD Step 3:** Implement canonical types, Zod v4 schemas, and governance matrices.
- **TDD Step 4:** Run test to verify pass.

### Task 2: 10-Vector Adversarial Scanner & Injection Runner (Rules 13, 30, 46)
**Files:**
- Create: `src/platform/security/adversarial/adversarial-scanner.ts`
- Create: `src/platform/security/adversarial/adversarial-injection-runner.ts`
- Create: `src/platform/security/adversarial/index.ts`
- Test: `src/platform/__tests__/security/adversarial-injection.test.ts`
- **TDD Step 1:** Write failing adversarial test covering all 10 ingress vectors (Email, Website, PDF, Notes, Transcript, Form, Chat, MCP Metadata, Tool Output, Knowledge RAG).
- **TDD Step 2:** Run test to verify failure.
- **TDD Step 3:** Implement unified `AdversarialScanner` with linear non-backtracking regex patterns and `<untrusted_reference_data>` containerization. Implement `AdversarialInjectionRunner` with dry-run evaluation.
- **TDD Step 4:** Run test to verify pass.

### Task 3: Chaos Fault Injection Engine & Resiliency Evaluator (Rules 24, 25, 26, 27, 45, 1972)
**Files:**
- Create: `src/platform/resilience/chaos/chaos-types.ts`
- Create: `src/platform/resilience/chaos/chaos-injection-engine.ts`
- Create: `src/platform/resilience/chaos/index.ts`
- Test: `src/platform/__tests__/security/chaos-injection.test.ts`
- **TDD Step 1:** Write failing chaos test covering 429 rate limit backoff, 500 provider timeouts, latency jitter with `AbortSignal` cancellation, TOCTOU state collisions, and partial failure with Reverse-LIFO Saga rollback.
- **TDD Step 2:** Run test to verify failure.
- **TDD Step 3:** Implement `ChaosInjectionEngine` with deterministic fault rules, interceptors, and DLQ integration.
- **TDD Step 4:** Run test to verify pass.

### Task 4: Cryptographic Tool Definition Drift & Rug-Pull Monitor (Rule 14 & 1974)
**Files:**
- Create: `src/platform/security/drift/tool-drift-monitor.ts`
- Create: `src/platform/security/drift/index.ts`
- Create: `src/platform/security/index.ts`
- Test: `src/platform/__tests__/security/tool-drift-monitor.test.ts`
- **TDD Step 1:** Write failing drift test covering SHA-256 fingerprint generation, drift detection on schema mutation, tool execution locking, and human re-approval.
- **TDD Step 2:** Run test to verify failure.
- **TDD Step 3:** Implement `ToolDriftMonitor` using `sha256Hex` over canonical JSON. Enforce Rule 17 non-delegable baseline updates.
- **TDD Step 4:** Run test to verify pass.

### Task 5: Canonical Security Capabilities & RBAC Permission Mapping
**Files:**
- Create: `src/platform/capabilities/security/security-capabilities.ts`
- Create: `src/platform/capabilities/security/index.ts`
- Modify: `src/platform/capabilities/contracts/permission-refs.ts`
- Test: `src/platform/__tests__/security/security-capabilities-and-actions.test.ts`
- **TDD Step 1:** Write failing capability test for `security.scan_text`, `security.run_adversarial_suite`, `chaos.inject_fault`, `security.verify_tool_drift`, `security.approve_tool_fingerprint`.
- **TDD Step 2:** Run test to verify failure.
- **TDD Step 3:** Register capabilities in `CapabilityRegistry` and update `permission-refs.ts` with `security:read`, `security:manage`, `chaos:inject`.
- **TDD Step 4:** Run test to verify pass.

### Task 6: Governed Next.js 15 Server Actions
**Files:**
- Create: `src/app/actions/security-chaos-actions.ts`
- Test: `src/platform/__tests__/security/security-capabilities-and-actions.test.ts`
- **TDD Step 1:** Write failing Server Actions test covering Clerk session auth, Anti-IDOR validation (`assertTenantAccess`), and dead-man pause evaluation (Rule 60).
- **TDD Step 2:** Run test to verify failure.
- **TDD Step 3:** Implement Server Actions with structured return `SecurityActionResult<T>`.
- **TDD Step 4:** Run test to verify pass.

### Task 7: Full Test Battery, Red-Team Gate & Platform Regression Verification
**Files:**
- Verify: all test suites in `src/platform/__tests__/security/`
- Verify regressions: `src/platform/__tests__/cost/`, `src/platform/__tests__/evaluation/`, `src/platform/__tests__/verification/`
- Verify strict typing: zero `: any` or `as any`.
- **Step 1:** Run all Milestone 3 test suites (`npx vitest run src/platform/__tests__/security/`).
- **Step 2:** Run full regression suite across all earlier phases.
- **Step 3:** Confirm 100% pass rate.

### Task 8: Completion Report & Senior Principal Architecture Review
- Author `docs/agents_mcp/phases/agents_mcp_phase_15_milestone_3_completion_report.md`.
- Save brain artifact `phase_15_milestone_3_completion_report.md`.
- Invoke Senior Principal Systems & AI Agentic Architecture Reviewer subagent for Grade A verification.

---

## 12. Commitments & Constraints

1. **Zero `any` or `any[]` (Rule 4):** Absolute strict typing across all contracts, services, and actions.
2. **Anti-IDOR Tenant Lock (Rules 8 & 47):** Every Server Action and capability strictly validates organizational boundaries.
3. **Emergency Dead-Man Fail-Closed Control (Rule 60):** `checkGovernanceDeadManSwitch` verified on all mutating capabilities and actions.
4. **Testing Protocol:** Run unit, contract, and red-team tests locally via Vitest (`npx vitest run ...`). Leave full typecheck and linting to GitHub Actions CI as instructed by the user.
5. **Strict Execution Boundary:** No execution until the user explicitly reviews and approves this plan.
