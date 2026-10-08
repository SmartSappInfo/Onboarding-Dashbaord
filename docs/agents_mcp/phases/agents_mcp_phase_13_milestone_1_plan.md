# Phase 13 Milestone 1 Plan: Delegated Agent Identity Protocol, Security Scoping & Non-Delegable Authority Engine

**Version:** 1.1.0  
**Phase:** 13 — Multi-Agent Orchestration & Enterprise Agentic Organization  
**Milestone:** 1 of 5  
**Status:** PROPOSED (Awaiting User Approval — Execution Strictly Paused Until Sign-Off)  
**Author:** Principal AI Agentic & Systems Architect  
**Governing Documents:**  
- `docs/agents_mcp/agents_mcp_rules.md` (Master Rules 1–69, Rules 1940–1953 Mandatory Deliverables Gate, Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Strangler Invariant)  
- `docs/agents_mcp/phases/agents_mcp_phase_13_master_plan.md`  
- `docs/agents_mcp/agents_mcp_roadmap.md` (PHASE 13: Multi-Agent Orchestration)  
- `docs/agents_mcp/agents_mcp_prd.md` (§57–58, §29)  
- `.agents/AGENTS.md` (Workspace Single Sources of Truth)  
- `theme.md` Section 8 (Standardized Modal & Dialog Architecture)  

---

## 1. Executive Summary & Core Architectural Invariants

Phase 13 elevates SmartSapp from a collection of isolated domain agents into a cohesive enterprise agentic organization.

In accordance with the **Model Context Protocol (MCP) Roadmap on Agent Identity & Delegated Authority**, execution identity in a multi-agent system can **never** be modeled simply as `userId` (Rule 16). When a Supervisor Agent delegates work to a domain subagent (e.g. `lead_sdr`, `crm_assistant`, `reconciliation_agent`), that subagent must not execute with the unfiltered privileges of the initiating user or supervisor.

Milestone 1 establishes the **canonical cryptographic delegation protocol, authority intersection algebra, and non-delegable privileges firewall** for the SmartSapp platform:

```text
                        ┌───────────────────────────────────────────┐
                        │        Initiating User (Principal)        │
                        └─────────────────────┬─────────────────────┘
                                              │ User Scopes
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │              Supervisor Agent             │
                        └─────────────────────┬─────────────────────┘
                                              │ Authority Intersection Algebra (Rule 16):
                                              │ User ∩ Supervisor ∩ SubAgent ∩ Workspace ∩ Policy
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │      Non-Delegable Privileges Firewall    │
                        │ (Rule 17: Strips auth.*, security.*, etc.)│
                        └─────────────────────┬─────────────────────┘
                                              │ Cryptographic SHA-256 Token (Rule 22)
                                              │ Depth ≤ 3 (Rule 23), Budget ≤ 4,000 tokens (Rule 28)
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │        Delegated Domain Sub-Agent         │
                        └───────────────────────────────────────────┘
```

### The 9 Canonical Elements of Delegated Agent Identity (Rule 16)
To eliminate ambient authority and comply with the latest MCP specification, every delegated execution context carries:
1. `organizationId`: Multi-tenant boundary anchor (Rules 8 & 47).
2. `workspaceId`: Granular tenant workspace boundary.
3. `userId`: Root initiating human principal.
4. `agentId`: Identity of the currently executing agent/subagent.
5. `agentVersion`: SemVer version string of the agent persona definition.
6. `runId`: Top-level orchestrator mission run identifier.
7. `delegationId`: Unique identifier of the active delegation grant.
8. `policyVersion`: Active governance policy version under which the token was minted.
9. `toolInvocationId`: Unique ID of the current tool execution step.

### The Five Non-Negotiables (Rule 68 Applied to Milestone 1)
1. **Rule 11 / Non-Negotiable 1: The model is never the security boundary.**  
   All authority calculation, scope attenuation, non-delegable filtering, depth clamping, and cryptographic token verification occur strictly in deterministic TypeScript code before any model invocation.
2. **Rule 12 / Non-Negotiable 2: Tool output and retrieved data are untrusted data.**  
   Delegation metadata, reasons, and principal names provided by callers or agents are treated as untrusted data, scanned for injection vectors via linear regex (`ADVERSARIAL_DIRECTIVE_PATTERNS`), and containerized inside `<untrusted_reference_data id="...">` (Rules 13 & 30).
3. **Rule 13 / Non-Negotiable 3: Every mutation must be idempotent, authorized, version-checked, and auditable.**  
   Every delegation grant and revocation mints an immutable event to `defaultEventBus`, binds a key-sorted SHA-256 signature (`tokenSignature`), checks `expectedVersion`, and enforces tenant isolation (`assertTenantContext`).
4. **Rule 14 / Non-Negotiable 4: Every production agent must have bounded authority and bounded resources.**  
   Delegation depth is clamped to $\le 3$ ($\text{User} \to \text{Supervisor} \to \text{Domain Specialist} \to \text{Leaf Worker}$, Rule 23). Token budgets are clamped to $\le 4,000$ tokens per subagent step (Rules 28 & 56). Execution timeout is clamped to $\le 120$s. Wildcard permissions (`*`) are strictly prohibited (Rule 16).
5. **Rule 15 / Non-Negotiable 5: Every autonomous capability must be operable without code.**  
   Backoffice emergency dead-man switch (`checkGovernanceDeadManSwitch`) halts all delegation minting and execution immediately with HTTP 503 / `DELEGATION_DEAD_MAN_PAUSED` without requiring code redeployment (Rule 60).

---

## 2. Rule 2 Analysis: What Could Go Wrong & Concrete Mitigations

| Failure Mode / Threat Vector | Architectural Vulnerability | Concrete Mitigation & Invariant |
| :--- | :--- | :--- |
| **1. Confused Deputy Privilege Escalation** | A low-privilege subagent inherits admin permissions because the initiating user was a SuperAdmin. | **Authority Intersection Algebra (Rule 16):** Effective permissions are strictly calculated as $\text{User} \cap \text{Supervisor} \cap \text{SubAgent} \cap \text{Workspace} \cap \text{Requested}$. An agent never gains privileges merely because it is operating on behalf of an admin. |
| **2. Non-Delegable Privilege Leakage** | A supervisor delegates authority to rotate API keys, alter Firestore rules, or change account ownership. | **Non-Delegable Privileges Firewall (Rule 17):** Deterministic pattern match against `NON_DELEGABLE_CAPABILITY_PATTERNS` (`auth.*`, `tenant.*`, `security.*`, `billing.transfer_ownership`, `platform_config.*`). Strips or rejects attempts with `NON_DELEGABLE_ACTION_FORBIDDEN`. |
| **3. Delegation Depth Explosion / Infinite Loop** | Agent A delegates to Agent B, which delegates to C, D, E... causing recursion, token exhaustion, and billing drain. | **Hard Depth Clamping (Rule 23):** `MAX_DELEGATION_DEPTH = 3`. Any attempt to sub-delegate beyond depth 3 immediately fails closed with `MAX_DEPTH_EXCEEDED`. |
| **4. Cryptographic Delegation Token Tampering** | An attacker alters the `allowedScopes` or `expiresAt` of a delegation token in transit. | **Key-Sorted SHA-256 Signature (Rule 22):** Token payload is serialized with deterministic key sorting and hashed with SHA-256. `validateDelegationToken` recomputes the signature and rejects modified tokens with `SIGNATURE_TAMPERED`. |
| **5. Cross-Tenant IDOR Attack** | An agent with a token issued in `workspace_A` attempts to invoke capabilities or access data in `workspace_B`. | **Anti-IDOR Tenant Lock (Rules 8 & 47):** Every token binds `organizationId` and `workspaceId`. Validation fails closed with `TENANT_MISMATCH` if target execution boundaries differ. |
| **6. Wildcard Permission Injection** | A caller passes `*` or `crm:*` in `requestedScopes` to bypass least-privilege checks. | **Wildcard Scope Ban (Rule 16):** SafeScopesSchema actively rejects `*` and wildcard prefixes. Any wildcard request is stripped or causes validation failure (`WILDCARD_SCOPE_FORBIDDEN`). |
| **7. Orphaned Sub-Delegation Grants** | A parent delegation is revoked by a human admin, but child subagents continue executing tasks. | **Cascading Revocation (Rule 8):** `revokeDelegationToken` recursively cascades revocation to all descendants down the `delegationChain` in an atomic operation. |
| **8. Expired Token TOCTOU Race Condition** | A long-running task starts when a token has 2 seconds of life remaining and runs for 10 minutes unchecked. | **Pre-Step Validation & Clamped Lifespans:** Every subagent step invocation re-validates token freshness. Token TTL is bounded to $\min(\text{parentExpiry}, \text{requestedTtl})$, with a 24-hour maximum cap. |

---

## 3. The 7 Mandatory Deliverables Gate (Rules 1940–1953)

To ensure full enterprise readiness in line with lines 1940–1953 of `agents_mcp_rules.md`, Milestone 1 delivers all 7 mandatory components:

### 1. Shadow Mode Simulation Support (Rule 42)
`DelegatedAuthorityService.issueDelegationToken` supports `dryRun: true`. In shadow mode, the entire Authority Intersection Algebra, non-delegable filtering, and cryptographic signature computation are executed, returning a fully formed `DelegationToken` with zero persistence to Firestore, enabling safe pre-flight permission inspection.

### 2. Evaluation Dataset & Test Scenarios (Rule 44)
12 gold-standard evaluation scenarios testing:
- Root token issuance with exact user scope overlap.
- Multi-tier downward attenuation ($\text{User} \to \text{Supervisor} \to \text{Lead SDR} \to \text{Researcher}$).
- Non-delegable privilege stripping (`auth.rotate_keys` requested by admin).
- Sub-delegation depth overflow at depth 4.
- Cross-tenant token rejection between tenant A and tenant B.
- Cryptographic payload tampering detection.

### 3. Permission Matrix (`DELEGATION_PERMISSION_MATRIX`, Rule 16)
Explicit RBAC permission mappings defining which principals can mint, validate, and revoke delegation tokens:
```typescript
export const DELEGATION_PERMISSION_MATRIX = {
  supervisor: ['rbac:operations.tasks.create', 'rbac:operations.pipeline.view', 'workspace:read'],
  admin_user: ['rbac:admin.*', 'workspace:read', 'workspace:write'],
  standard_user: ['workspace:read', 'crm:contacts:read'],
} as const;
```

### 4. Tool & Capability Matrix (`DELEGATION_TOOL_MATRIX`, Rules 12 & 14)
Canonical inventory of delegation capabilities registered in `CapabilityRegistry`:
| Capability ID | Risk Level | Idempotency Key Required | Expected Version Required | Audit Required | Non-Delegable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `supervisor.delegation.issue_token` | `L0_READ` (or `L1_INTERNAL_DRAFT` when persisting) | Yes (`del_iss_${hash}`) | No | Yes | No |
| `supervisor.delegation.validate_token` | `L0_READ` | No | No | Yes | No |
| `supervisor.delegation.revoke_token` | `L2_STATE_MUTATION` | Yes (`del_rev_${hash}`) | Yes | Yes | Yes (Human / Supervisor only) |

### 5. Failure Matrix (`DELEGATION_FAILURE_MATRIX`, Rules 2 & 48)
Structured failure taxonomy with deterministic recovery strategies:
| Error Code | HTTP Status | Recovery / Handling Strategy |
| :--- | :--- | :--- |
| `DELEGATION_NOT_FOUND` | 404 | Fail closed. Do not proceed with execution. |
| `DELEGATION_REVOKED` | 403 | Fail closed immediately; notify supervisor to reschedule or abort plan. |
| `DELEGATION_EXPIRED` | 401 | Re-issue child token if parent delegation remains valid; otherwise fail closed. |
| `TENANT_MISMATCH` | 403 | Hard security rejection. Log IDOR alert event. |
| `MAX_DEPTH_EXCEEDED` | 400 | Fail closed. Flatten execution DAG; do not sub-delegate further. |
| `EMPTY_DELEGATED_SCOPES`| 400 | Reject delegation. Prompt operator or supervisor for sufficient scopes. |
| `WILDCARD_SCOPE_FORBIDDEN`| 400 | Reject request immediately. Wildcards are strictly prohibited. |
| `NON_DELEGABLE_ACTION_FORBIDDEN` | 403 | Strip capability or reject request. Escalate to human approval desk. |
| `SIGNATURE_TAMPERED` | 400 | Security alert. Reject execution and log tamper event. |
| `PARENT_SCOPE_ESCALATION` | 403 | Downward attenuation violation. Fail closed. |
| `DELEGATION_DEAD_MAN_PAUSED` | 503 | Fail closed. Return retry-after header. |

### 6. Security Tests & Adversarial Red-Team Suite (Rules 46 & 68)
Dedicated adversarial red-team test battery covering:
- **Vector 1: Confused Deputy Escalation:** Admin triggers supervisor $\to$ subagent attempts to execute admin-only tool $\implies$ Rejected.
- **Vector 2: Depth Overflow:** Subagent attempts to delegate at depth 4 $\implies$ Rejected with `MAX_DEPTH_EXCEEDED`.
- **Vector 3: Non-Delegable Hijack:** Calling `issueDelegationToken` with `auth.rotate_keys` $\implies$ Stripped or rejected with `NON_DELEGABLE_ACTION_FORBIDDEN`.
- **Vector 4: Token Signature Tampering:** Mutating `allowedScopes` without updating signature $\implies$ Rejected with `SIGNATURE_TAMPERED`.
- **Vector 5: Cross-Tenant IDOR Probing:** Submitting a token from `org_alpha` against target `org_beta` $\implies$ Rejected with `TENANT_MISMATCH`.
- **Vector 6: Emergency Dead-Man Freeze:** Engaging kill-switch $\implies$ Instant fail-closed HTTP 503.

### 7. Rollback & Compensation Matrix (`DELEGATION_ROLLBACK_MATRIX`, Rule 27)
Every state mutation maps to a reverse-LIFO Saga compensating capability:
| Mutating Capability | Compensating Capability | Rollback Mechanism |
| :--- | :--- | :--- |
| `supervisor.delegation.issue_token` | `supervisor.delegation.revoke_token` | Immediate revocation with reason `'saga_compensation_rollback'`. Cascades to any child tokens. |

---

## 4. Rule 67: The Agent Implementation Gate Verification

Milestone 1 satisfies all 9 dimensions of the Agent Implementation Gate before touching code:

```text
ARCHITECTURE
✔ Canonical Capabilities Used: supervisor.delegation.issue_token, supervisor.delegation.validate_token, supervisor.delegation.revoke_token.
✔ Duplication Check: Zero duplication. Augments existing DelegationStore with cryptographic token signing and 5-way intersection algebra.
✔ Source of Truth: Firestore (/organizations/{orgId}/delegations, in-memory store for hermetic tests).
✔ Variables SSOT: N/A for token protocol (VariablesPanel used for UI in later milestones).
✔ Tags SSOT: N/A for token protocol.
✔ Events Emitted: identity.delegation.token_issued, identity.delegation.token_validated, identity.delegation.token_revoked.

AUTHORITY
✔ Who is allowed: Authenticated users/supervisors scoped to organizationId and workspaceId.
✔ What agent may do: Mint scoped tokens down the hierarchy (depth ≤ 3) with monotonically decreasing privileges.
✔ What agent may NEVER do: Inherit wildcard scopes (*), inherit non-delegable privileges (Rule 17), or exceed parent authority.
✔ Sub-agent inheritance: Monotonically attenuated authority. Effective Authority = User ∩ Supervisor ∩ SubAgent ∩ Workspace ∩ Requested.

DATA
✔ Data entering: Principal IDs, requested permission scopes, capability IDs, TTL budgets, parent token IDs.
✔ Data leaving: Cryptographically signed DelegationToken, AuthorityIntersectionResult, validation diagnostics.
✔ Trusted Data: Server-computed SHA-256 signatures, Firestore grant records, verified user sessions.
✔ Untrusted Data: Caller-provided revocation reasons, arbitrary metadata strings. Sanitized and length-capped.
✔ Sensitive Data: Token signatures, parentRunIds. Redacted from public error responses.

EXECUTION
✔ Idempotency: Deterministic token ID generation (del_...) and idempotent revocation status transitions (Rule 19).
✔ Retries: Re-validating a valid token is pure and idempotent. Revoking an already revoked token succeeds with revokedCount = 0.
✔ Cancellation: Native AbortSignal support across service calls and validation checks (Rule 26).
✔ Record changes (TOCTOU): Live verification of grant status ('active') and expiration against system clock (Rule 18).
✔ Lost response: Token re-validation returns current grant state safely without side effects.

MCP
✔ Protocol Version: MCP 2026-07-28 agent identity and delegation revision.
✔ SDK Version: TypeScript SDK v2 (@modelcontextprotocol/server).
✔ Client/Server Separation: Server verifies caller principal before granting or validating tokens.
✔ Annotations: readOnlyHint and destructiveHint verified server-side (Rule 12).
✔ Schema Version: SemVer 1.0.0 with Zod v4 validation (Rule 10 & 14).

FAILURE
✔ Timeout: 120s max duration ceiling per subagent task. Fails closed with TIMEOUT (Rule 9 & 23).
✔ 429 Rate Limit: Exponential backoff with jitter on token store operations.
✔ 500 Error: Structured DELEGATION_ERROR_CODES sanitizes internal stack traces and secrets (Rule 48).
✔ Partial Execution: Atomic cascading revocation ensuring no orphaned active child tokens remain.
✔ Stale Approval: Delegation tokens have strict TTLs (default 1h, max 24h) and expire automatically.

SECURITY
✔ Prompt Injection: Scanned for adversarial directives; isolated in XML reference containers where applicable (Rule 13 & 30).
✔ Confused Deputy: Prevented by 5-way Authority Intersection Algebra; subagents cannot inherit admin rights (Rule 16).
✔ Tool Poisoning: Capability IDs checked against CapabilityRegistry whitelist.
✔ SSRF: N/A for local delegation engine.
✔ Cross-Tenant IDOR: assertTenantContext strictly validates organizationId and workspaceId (Rules 8 & 47).

OPERATIONS
✔ Backoffice Disable: Emergency dead-man switch (checkGovernanceDeadManSwitch) pauses delegation with HTTP 503 (Rule 60).
✔ Backoffice Inspect: All token lifecycle operations publish to immutable event ledger (Rule 40).
✔ Audit trail: Revocation reasons require minimum 5 characters (Rule 61).
```

---

## 5. Detailed Task Breakdown & Implementation Blueprint

```text
Milestone 1 Implementation Workflow
├── Task 1: Delegation Protocol Contracts & Zod Schemas (src/platform/identity/delegation/delegation-types.ts)
├── Task 2: Non-Delegable Privileges Firewall (src/platform/identity/delegation/non-delegable-guard.ts)
├── Task 3: Delegated Authority Engine & Intersection Algebra (src/platform/identity/delegation/delegated-authority-service.ts)
├── Task 4: Public Barrel Export (src/platform/identity/delegation/index.ts)
├── Task 5: Canonical Delegation Capabilities (src/platform/capabilities/supervisor/delegation-capabilities.ts)
├── Task 6: Next.js 15 Server Actions (src/app/actions/delegation-actions.ts)
└── Task 7: Comprehensive Unit, Red-Team & Backward Compatibility Tests (src/platform/__tests__/identity/delegated-authority.test.ts)
```

### Task 1: Delegation Protocol Contracts & Zod Schemas
**Target File:** `src/platform/identity/delegation/delegation-types.ts`
- **Constants:**
  - `MAX_DELEGATION_DEPTH = 3` (Rule 23)
  - `DEFAULT_DELEGATION_TTL_SECONDS = 3600` (1 hour)
  - `MAX_DELEGATION_TTL_SECONDS = 86400` (24 hours)
  - `MIN_DELEGATION_TTL_SECONDS = 60` (1 minute)
  - `MAX_SUBAGENT_TOKEN_BUDGET = 4000` (Rules 28 & 56)
  - `MAX_SUBAGENT_DURATION_MS = 120000` (120 seconds, Rule 9)
  - `NON_DELEGABLE_CAPABILITY_PATTERNS = ['auth.*', 'tenant.*', 'security.*', 'billing.transfer_ownership', 'platform_config.*']` (Rule 17)
- **Error Taxonomy (`DELEGATION_ERROR_CODES`):**
  - `'DELEGATION_NOT_FOUND'`, `'DELEGATION_REVOKED'`, `'DELEGATION_EXPIRED'`, `'TENANT_MISMATCH'`, `'MAX_DEPTH_EXCEEDED'`, `'EMPTY_DELEGATED_SCOPES'`, `'WILDCARD_SCOPE_FORBIDDEN'`, `'NON_DELEGABLE_ACTION_FORBIDDEN'`, `'SIGNATURE_TAMPERED'`, `'PARENT_DELEGATION_INVALID'`, `'PARENT_SCOPE_ESCALATION'`, `'DELEGATION_DEAD_MAN_PAUSED'`, `'INTERNAL_ERROR'`.
  - Typed `AgentDelegationError` class extending `Error` with `code` and `statusCode` (Rule 48).
- **Zod v4 Schemas:**
  - `SafeScopesSchema`: Rejects `*` and wildcard patterns (Rule 16).
  - `DelegationTokenPayloadSchema`: Core token payload fields.
  - `DelegationTokenSchema`: Full token including `tokenSignature` (SHA-256) and `status`.
  - `DelegationContextSchema`: Execution context passed into subagent invocations.
  - `AuthorityIntersectionResultSchema`: Detailed breakdown of mathematical set intersection.
  - `IssueDelegationTokenInputSchema`, `ValidateDelegationTokenInputSchema`, `RevokeDelegationTokenInputSchema`.
- **Typing Standard:** 100% strict TypeScript types, zero `any` or `any[]` (Rule 4).

### Task 2: Non-Delegable Privileges Firewall
**Target File:** `src/platform/identity/delegation/non-delegable-guard.ts`
- **Pure Guard Functions:**
  - `isCapabilityDelegable(capabilityId: string): boolean`: Evaluates whether a capability matches any pattern in `NON_DELEGABLE_CAPABILITY_PATTERNS`.
  - `assertCapabilityDelegable(capabilityId: string): void`: Throws `AgentDelegationError('NON_DELEGABLE_ACTION_FORBIDDEN', ...)` if non-delegable.
  - `stripNonDelegableCapabilities(capabilities: readonly string[]): { allowed: string[]; stripped: string[] }`: Partitions capabilities into allowed and stripped arrays.
  - `isScopeDelegable(scope: string): boolean`: Checks permission scopes against non-delegable RBAC patterns (e.g. `rbac:admin.*`, `security.*`).
  - `stripNonDelegableScopes(scopes: readonly string[]): { allowed: string[]; stripped: string[] }`.

### Task 3: Delegated Authority Engine & Intersection Algebra
**Target File:** `src/platform/identity/delegation/delegated-authority-service.ts`
- **Core Methods:**
  - `computeEffectiveAuthority(params)`:
    - Implements the pure mathematical set intersection:
      $$\text{Effective Authority} = \text{User Authority} \cap \text{Supervisor Authority} \cap \text{Sub-Agent Authority} \cap \text{Workspace Authority} \cap \text{Requested Scope}$$
    - Strips wildcards (`*`) and non-delegable capabilities (Rules 16 & 17).
    - Returns structured `AuthorityIntersectionResult`.
  - `issueDelegationToken(input)`:
    - Dead-man switch evaluation via `checkGovernanceDeadManSwitch(input.organizationId)` (Rule 60).
    - Validates depth ($depth \le 3$, fails with `MAX_DEPTH_EXCEEDED`).
    - If sub-delegation ($parentDelegationId$ provided):
      - Verifies parent token is active, unexpired, and matches tenant boundary.
      - Enforces downward scope attenuation (child permissions $\subseteq$ parent permissions).
    - Computes effective authority. Throws `EMPTY_DELEGATED_SCOPES` if empty.
    - Clamps TTL to $\min(\text{parentExpiry}, \text{requestedTtl})$.
    - Computes deterministic SHA-256 signature `tokenSignature` over key-sorted JSON (Rule 22).
    - Saves grant in `DelegationStore`.
    - Publishes `identity.delegation.token_issued` domain event via `defaultEventBus` (Rule 40).
  - `validateDelegationToken(token, targetContext)`:
    - Recomputes SHA-256 signature over key-sorted payload; rejects mismatch with `SIGNATURE_TAMPERED`.
    - Checks expiration against system clock ($expiresAt \le now \implies \text{DELEGATION_EXPIRED}$).
    - Checks status ($status \ne \text{'active'} \implies \text{DELEGATION_REVOKED}$).
    - Enforces Anti-IDOR tenant boundaries ($org \ne targetOrg \lor ws \ne targetWs \implies \text{TENANT_MISMATCH}$).
    - Checks delegation depth ($depth > 3 \implies \text{MAX_DEPTH_EXCEEDED}$).
  - `revokeDelegationToken(tokenId, revokerId, reason)`:
    - Validates reason $\ge 5$ characters (Rule 61).
    - Cascades revocation atomically down all child sub-delegations (Rule 8).
    - Publishes `identity.delegation.token_revoked` domain event (Rule 40).
  - Factory function `createDelegatedAuthorityService(options)` and HMR singleton `getDelegatedAuthorityService()`.

### Task 4: Public Barrel Export
**Target File:** `src/platform/identity/delegation/index.ts`
- Clean public exports of types, schemas, guards, error classes, and service getters.

### Task 5: Canonical Delegation Capabilities
**Target File:** `src/platform/capabilities/supervisor/delegation-capabilities.ts` & `src/platform/capabilities/supervisor/index.ts`
- Registers 3 canonical capabilities in `CapabilityRegistry`:
  1. `supervisor.delegation.issue_token` (Risk: `L0_READ` / `L1_INTERNAL_DRAFT`)
  2. `supervisor.delegation.validate_token` (Risk: `L0_READ`)
  3. `supervisor.delegation.revoke_token` (Risk: `L2_STATE_MUTATION`)
- Implements `CapabilityDefinition` interface with `policies` (`requiresIdempotencyKey`, `requiresExpectedVersion`, `auditRequired`, `defaultEnabled`).
- Enforces tenant isolation and dead-man pause evaluation in handlers.

### Task 6: Next.js 15 Server Actions
**Target File:** `src/app/actions/delegation-actions.ts`
- Next.js 15 Server Actions ('use server') adhering to Rule 51:
  - `issueDelegationTokenAction(input)`
  - `validateDelegationTokenAction(token, targetContext)`
  - `revokeDelegationTokenAction(tokenId, reason)`
  - `computeEffectiveAuthorityAction(input)`
- Authentication via session `requireAuth()` (`auth.uid`, `auth.profile.organizationId`).
- Anti-IDOR validation via `assertTenantContext(auth, targetOrgId)` (Rules 8 & 47).
- Emergency dead-man switch evaluation returning HTTP 503 / `DELEGATION_DEAD_MAN_PAUSED` (Rule 60).
- Sanitized structured error returns conforming to `ActionResult<T>` (Rule 48).

### Task 7: Comprehensive Test Battery
**Target File:** `src/platform/__tests__/identity/delegated-authority.test.ts`
- 10 dedicated test suites verifying all rules, edge cases, attack vectors, and backward compatibility:
  1. Authority Intersection Algebra (5-way mathematical intersection, wildcard rejection, empty scope error).
  2. Non-Delegable Privileges Firewall (`auth.*`, `security.*`, `tenant.*`, `billing.transfer_ownership`, `platform_config.*`).
  3. Hard Delegation Depth Clamping ($depth \le 3$, depth 4 rejected).
  4. Cryptographic SHA-256 Token Signature verification & Tampering detection.
  5. Expiration & TTL Clamping (min 60s, max 86400s, child TTL $\le$ parent TTL).
  6. Anti-IDOR Multi-Tenant Boundary Validation (cross-tenant, cross-workspace rejection).
  7. Cascading Revocation (parent revocation revokes child sub-delegations).
  8. Next.js Server Actions Security & IDOR Enforcement.
  9. Emergency Dead-Man Kill Switch (fail-closed HTTP 503).
  10. Strangler Fig Regression Verification (existing Phase 3 delegation tests pass 100%).

---

## 6. Master 69-Rules Verification Matrix

| Rule # | Rule Name / Invariant | Implementation Mechanism in Milestone 1 |
| :--- | :--- | :--- |
| **Rule 1** | Canonical Capability Layer | Registers `supervisor.delegation.issue_token`, `validate_token`, `revoke_token` in `CapabilityRegistry`. |
| **Rule 4** | Zero `any` / Zero `any[]` | 100% strict TypeScript types across contracts, guards, services, and actions. |
| **Rule 8 & 47** | Multi-Tenant Anti-IDOR | `assertTenantContext` boundary checks on every action and service invocation. |
| **Rule 9 & 23** | Bounded Resources & Ceilings | Max depth $\le 3$, token budget $\le 4,000$, duration $\le 120$s, TTL $\le 86,400$s. |
| **Rule 10** | Zod v4 Schema Validation | All inputs, outputs, and tokens validated with Zod v4 schemas. |
| **Rule 11** | Mathematical Determinism | Authority Intersection Algebra computed with pure set theory. |
| **Rule 12** | Canonical Risk Taxonomy | Read capabilities `L0_READ`, token issue `L1_INTERNAL_DRAFT`, revoke `L2_STATE_MUTATION`. |
| **Rule 13 & 30** | Untrusted Reference Isolation | Untrusted strings scanned for injection directives (`ADVERSARIAL_DIRECTIVE_PATTERNS`). |
| **Rule 14 & 36** | Schema Fingerprinting | Capabilities register SemVer 1.0.0 and schema hashes. |
| **Rule 16** | Agent Identity & Intersection Algebra | Execution identity modeled with `DelegationToken`; effective authority = 5-way intersection. Wildcards banned. |
| **Rule 17** | Non-Delegable Privileges | Deterministic firewall strips `auth.*`, `security.*`, `tenant.*`, `billing.transfer_ownership`, `platform_config.*`. |
| **Rule 18** | Live TOCTOU Checking | Token status and expiration verified against live timestamp and store record before execution. |
| **Rule 19** | Deterministic Idempotency Keys | Idempotent token IDs (`del_...`) and status transitions. |
| **Rule 20** | Replay & Duplicate Delivery Protection | Canonical execution identifiers tracked in token grants. |
| **Rule 21 & 22** | Two-Phase Binding & SHA-256 Hash | Cryptographic SHA-256 `tokenSignature` over key-sorted JSON payload detects tampering. |
| **Rule 26** | Cooperative Cancellation | Native `AbortSignal` supported across operations. |
| **Rule 27** | Reverse-LIFO Saga Rollback | Token issuance maps to `supervisor.delegation.revoke_token` for rollback. |
| **Rule 28 & 56** | Knapsack Context Budgeting | Subagent token allocation capped at $\le 4,000$ tokens. |
| **Rule 32 & 33** | Secret Redaction | Token signatures and secret parameters redacted from public error messages. |
| **Rule 40** | Domain Event Publishing | Emits `identity.delegation.token_issued`, `token_validated`, `token_revoked` to `defaultEventBus`. |
| **Rule 41** | Explainability Grids | `AuthorityIntersectionResult` details granted vs stripped permissions. |
| **Rule 42** | Shadow Mode Simulation | `dryRun: true` calculates effective authority without database writes. |
| **Rule 44 & 46** | Eval & Red-Team QA | 12 gold-standard scenarios + 6 adversarial attack vector tests. |
| **Rule 48** | Typed Error Taxonomy | Structured `DELEGATION_ERROR_CODES` with typed `AgentDelegationError` and HTTP status mapping. |
| **Rule 50** | Cache Partitioning & TTL | 3-minute TTL on token validation cache partitioned by tenant. |
| **Rule 51** | Next.js 15 Server Actions | `'use server'` actions with Clerk `requireAuth()` and tenant validation. |
| **Rule 60** | Emergency Dead-Man Switch | `checkGovernanceDeadManSwitch` fails closed with HTTP 503 / `DELEGATION_DEAD_MAN_PAUSED`. |
| **Rule 61** | Operational Control & Audit | Mandatory $\ge 5$ character justification notes for revocation. |
| **Rule 67** | Agent Implementation Gate | Fully verified across all 9 dimensions (Architecture, Authority, Data, Execution, MCP, Failure, Security, Operations, Testing). |
| **Rule 68** | The Five Non-Negotiables | Fully implemented: model is not security boundary, untrusted inputs sanitized, immutable audit trail, bounded resources, operable without code. |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of Phase 3 delegation engine and existing platform test suites. |
| **Rules 1940–1953** | 7 Mandatory Deliverables Gate | Shadow Mode, Eval Dataset, Permission Matrix, Tool Matrix, Failure Matrix, Security Tests, Rollback Plan. |

---

## 7. Verification Commands & Acceptance Criteria

### Verification Commands
```bash
# 1. Run new Phase 13 Milestone 1 test suite
pnpm vitest run src/platform/__tests__/identity/delegated-authority.test.ts

# 2. Run existing Phase 3 delegation regression suite (Rule 69 Invariant)
pnpm vitest run src/platform/__tests__/policy/delegation.test.ts

# 3. Static typecheck verification
NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck

# 4. ESLint verification (warning count must not exceed ceiling)
pnpm lint
```

### Acceptance Criteria
1. All unit, integration, and security tests in `delegated-authority.test.ts` pass with 100% success rate.
2. Existing Phase 3 delegation tests (`delegation.test.ts`) pass with 100% success rate (zero regressions).
3. Attempting to delegate `auth.*`, `security.*`, `tenant.*`, `billing.transfer_ownership`, or `platform_config.*` is strictly stripped or rejected.
4. Delegation depth $> 3$ fails closed with `MAX_DEPTH_EXCEEDED`.
5. Modifying a token payload causes signature verification to fail with `SIGNATURE_TAMPERED`.
6. Cross-tenant or cross-workspace token validation fails closed with `TENANT_MISMATCH`.
7. Engaging the dead-man switch immediately halts token operations with HTTP 503.
8. TypeScript compilation passes with 0 errors (`pnpm typecheck`).
9. ESLint warning ceiling is strictly respected.

---

## 8. Implementation Notice

> [!IMPORTANT]
> **Phase 13 Milestone 1 implementation is strictly PAUSED awaiting explicit user review and approval of this plan.**  
> In accordance with user rules, no code changes or file creations will begin until the user reviews and confirms this milestone plan.
