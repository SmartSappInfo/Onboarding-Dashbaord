# Phase 3 Milestone 3 Implementation Plan: Two-Phase Action Proposals & Cryptographic Approval Lifecycle Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete Two-Phase Action Proposal and Cryptographic Approval Lifecycle Engine for SmartSapp, enabling automated agents encountering high-risk operations (L3 outbound communication/finance, L4 privileged destructive, or `requiresHumanApproval`) to halt execution, compute canonical SHA-256 payload hashes, generate transparent WHAT/WHY/WHO/BLAST_RADIUS proposals, emit platform domain events, and execute atomically once approved by an authorized human operator via secure Server Actions, protected by zero-redeploy emergency dead-man controls.

**Architecture:** A fail-closed, two-phase execution pipeline where agent steps requiring human approval are halted prior to side effects. The proposal engine computes a canonical SHA-256 hash of the validated arguments (`payloadHash`), records full provenance (`delegationId`, `delegationChain`, `agentPersonaId`), persists the proposal to `capability_approvals` in Firestore, and publishes `policy.approval.requested` on the `PlatformEventBus`. Authenticated human operators review and decide proposals via Server Actions (`decideApprovalAction`) that enforce anti-self-approval and RBAC authority. Upon approval, `ApprovalVerifier.verifyAndBind` executes in a Firestore transaction to atomically transition the record to `bound`, locking it to a single `toolInvocationId` and verifying `LivePrincipalCheck` before execution. An emergency dead-man switch (`system_settings/agent_governance.emergencyPause`) provides immediate operational pause without code redeployment.

**Tech Stack:** TypeScript (strict mode, 0 `any`), Node.js `crypto`, Zod v4, Firebase Admin Firestore, Clerk/Session Auth (`requireAuth`, `requireWorkspace`), Vitest.

---

## 1. Compliance Matrix: SmartSapp Agentic Development Rules (`agents_mcp_rules.md`)

| Rule # | Principle / Requirement | Milestone 3 Implementation Guarantee | Anti-Distortion & Security Verification |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Modular TypeScript architecture in `src/platform/policy/` and `src/app/actions/`. Strictly DRY, cleanly separated interfaces. | Conforms to `next-best-practices`, `backend-design`, and Next.js Server Action guidelines. |
| **Rule 2** | Reflection Q1: What could go wrong? | Analyzed 6 failure modes: TOCTOU payload alteration, agent self-approval, proposal replay, stale/zombie proposals, race conditions during approval binding, and dead-man switch circumvention. | Enforces canonical SHA-256 hashing, Clerk-verified human actor validation, single-use Firestore transactions, TTL expiration, and global dead-man gates. |
| **Rule 3** | Reflection Q2 & Q3: Affected features & Backoffice | Seamlessly interfaces with existing `executeCapability` Step 08, Cloud Tasks executor, and prepares server actions for the `/admin/approvals` UI (Milestone 4). | Backoffice operators can inspect proposals, review blast radiuses, approve/reject, and engage emergency pauses without code redeployment. |
| **Rule 4** | Zero `any` & Anti-IDOR | All schemas, inputs, and database records typed via Zod v4 (`ActionProposalSchema`, `ProposalDecisionInputSchema`). Mandatory `organizationId` and `workspaceId` matching on every operation. | External inputs narrowed at boundary; zero `any` or `any[]` throughout codebase. |
| **Rule 5** | Staging & Verification Safety | Storage abstractions support both in-memory fakes for unit testing and Firestore for production. | 100% test coverage before production deployment. |
| **Rule 6** | Dependency Governance | Built purely on native Node.js `crypto`, Firebase Admin SDK, and Zod v4. | Zero unverified or deprecated dependencies. |
| **Rule 7** | Simple English & Reusability | Proposal cards and rejection reasons use everyday human English (e.g. "Launch campaign to 1,243 contacts" instead of "AI mutation event"). | Clear, actionable, and structured for mobile and desktop rendering. |
| **Rule 8** | Defensive Fail-Closed Architecture | Any missing, expired, revoked, tampered, or mismatched proposal fails closed immediately (`APPROVAL_REQUIRED`, `APPROVAL_INVALID`, `APPROVAL_EXPIRED`). | No unverified or mutated payload can ever execute. |
| **Rule 9** | High Concurrency & Resource Limits | Approval bindings run in isolated Firestore transactions; proposal lists default to limit 50; batched status updates chunked to $\le 450$ docs. | Resource exhaustion and concurrent race conditions prevented. |
| **Rule 10** | Inline Architectural Documentation | Complete `@fileOverview` with maintainer notes, failure mode analysis, and explicit error codes (`ApprovalFailureCode`). | High maintainability for future developers. |
| **Rule 12** | Explicit Risk Levels Server-Side | Triggers proposals whenever capability risk level is `L3_EXTERNAL_COMMUNICATION_FINANCE`, `L4_PRIVILEGED_DESTRUCTIVE`, or `requiresHumanApproval: true`. | Client hints ignored; server capability definition is authoritative. |
| **Rule 13** | Trust Boundary Matrix & Model Distrust | AI agents are untrusted; an agent can **never** approve its own proposal or approve another agent's proposal. All approvals require human Clerk authentication. | Model-generated outputs treated as untrusted proposals until verified. |
| **Rule 16** | Bounded Delegation & Wildcard Ban | Proposal carries `delegationId` and `delegationChain` from Milestone 2. No wildcard approval is ever generated. | Complete authorization lineage preserved. |
| **Rule 17** | Non-Delegable Actions Guard | Non-delegable capabilities cannot be executed even with an approval proposal; they require direct human execution. | High-privilege admin actions strictly shielded. |
| **Rule 18** | TOCTOU & Live Principal Validation | `LivePrincipalCheck` runs at proposal execution time to ensure authorizing user and delegation are still active. | Demoted or deleted users immediately invalidate pending approvals. |
| **Rule 21** | Two-Phase Action Proposal Model | Halts high-risk steps, captures validated arguments, and formats structured proposals (WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE). | Human-in-the-loop checkpoint before side effects occur. |
| **Rule 22** | Cryptographic Approval Binding | Approval records store canonical SHA-256 `payloadHash`. `verifyAndBind` compares execution arguments against hash; single-use lock prevents replay. | Guarantees exact argument parity between what human approved and what executes. |
| **Rule 23** | Deterministic Resource Ceilings | Approvals carry hard TTL (default 24h, min 60s, max 7 days). Expired proposals cannot be bound. | Bounded approval lifecycle. |
| **Rule 40** | Audit Log Immutability | Proposal generation, approval grants, rejections, and binding emit immutable domain events with correlation and causation IDs. | Full forensic traceability. |
| **Rule 41** | Action Proposal Structure | Mandates WHAT, WHY, WHO, EVIDENCE, RISK, POLICY fields in every proposal. Rejects generic messages. | Transparent operator decision-making. |
| **Rule 47** | Multi-Tenant Anti-IDOR | Proposals and server actions enforce matching `organizationId` and `workspaceId`. | Cross-tenant approval consumption strictly prohibited. |
| **Rule 51** | Server Action Security | `approval-actions.ts` calls `requireAuth()` and `requireWorkspace()` to extract authenticated user from session cookie. | Untrusted client-supplied user IDs rejected. |
| **Rule 60** | Emergency Dead-Man Controls | `system_settings/agent_governance.emergencyPause` immediately pauses all agent approvals and execution without redeployment. | Operational kill-switch for incident response. |
| **Rule 66** | Phase 3 Contract Additions | Satisfies Two-Phase Proposals, Approval Verifier Binding, Server Actions, and Dead-Man Controls. | Meets Milestone 3 gate criteria. |
| **Rule 67** | Implementation Gates | 100% test pass rate, 0 TypeScript errors (`tsc --noEmit`), 0 ESLint errors. | Clean compiler verification mandatory. |
| **Rule 68** | Five Non-Negotiables | Strict typing, tenant isolation, fail-closed security, zero regressions across 88 baseline suites. | Production-grade robustness. |
| **Rule 69** | Canonical Execution SSOT | Proposal engine integrates with `executeCapability` Step 08 and `CloudTasksDispatcher`. | Single Source of Truth architecture maintained. |

---

## 2. Anti-Distortion Analysis (Rules 1, 2, 3)

### Reflection Question 1: What could go wrong and how is it resolved?
1. **Time-of-Check to Time-of-Use (TOCTOU) Payload Tampering:**
   - *Problem:* A human operator approves an action proposal based on reviewed parameters (e.g. sending an email to a verified test list), but an attacker or bug modifies the input parameters (e.g. changing recipient list or message body) between approval and execution.
   - *Resolution:* Cryptographic SHA-256 `payloadHash` binding (Rule 22). The proposal stores `computeApprovalPayloadHash({ capabilityId, capabilityVersion, organizationId, workspaceId, input })`. When the worker executes `verifyAndBind`, it recomputes the SHA-256 hash of the execution arguments. If even a single byte differs, the execution engine fails closed with `APPROVAL_MISMATCH`.
2. **Agent Self-Approval Vulnerability:**
   - *Problem:* An autonomous agent generates a proposal, and another sub-agent or the requesting agent itself calls `decideApprovalAction` to approve the action.
   - *Resolution:* Model Distrust & Anti-Self-Approval Enforcement (Rule 13, Rule 51). `decideApprovalAction` is a Server Action that verifies the caller's session via `requireAuth()`, which extracts the caller identity from the HTTP-only session cookie. Furthermore, `checkApprovalRecord` asserts `record.approvedBy !== request.agentId` and `record.approvedBy` must be a valid human user ID.
3. **Approval Replay / Multi-Use Attacks:**
   - *Problem:* An approved high-risk action (e.g. charging a credit card or launching an email campaign) is executed multiple times using the same `approvalId`.
   - *Resolution:* Single-Use Atomic Transaction Binding (Rule 22). In `ApprovalVerifier.verifyAndBind`, a Firestore transaction reads the record, validates `status === 'approved'`, updates `status = 'bound'`, and sets `boundToolInvocationId = toolInvocationId`. If a second invocation attempts to use the same approval, it receives `APPROVAL_ALREADY_USED`.
4. **Stale / Zombie Approvals Executing After Permissions Demoted:**
   - *Problem:* An operator approves a proposal, but before it executes, the authorizing user is removed from the organization or the agent's delegation is revoked.
   - *Resolution:* Double-Gated TOCTOU Live Check (Rule 18). Before consuming the approval, the execution worker runs `LivePrincipalCheck.check(principal, target)`. If the authorizing user or delegation grant has been revoked or expired, the step fails closed immediately.
5. **Cascading Failure During Third-Party Outage:**
   - *Problem:* An external vendor outage causes repeated failures or dangerous looping in queued approved tasks.
   - *Resolution:* Emergency Dead-Man Controls (Rule 60). Administrators can toggle `emergencyPause: true` in Firestore `system_settings/agent_governance`. The dead-man checker (`checkGovernanceDeadManSwitch`) immediately blocks all approval evaluations and step executions with `AGENT_GOVERNANCE_EMERGENCY_PAUSED`.

### Reflection Question 2: What other features could be affected and how are they protected?
- **Preexisting Capabilities (1,964 capabilities across 17 domains):** None of the 1,964 capability contracts are altered. Low-risk operations (`L0_READ`, `L1_INTERNAL_DRAFT`, and `L2_STATE_MUTATION` with `requiresHumanApproval: false`) execute immediately without proposals.
- **Interactive Human Users:** When an interactive user executes a capability directly in the UI (`actorType === 'user'`), `requiresAgentApproval(capability.risk)` evaluates to false. Interactive users bypass approval proposals with zero latency.
- **Existing Approval Binding Tests:** All 22 tests in `src/platform/__tests__/approval-binding.test.ts` pass without breakage because the existing `checkApprovalRecord` contract is strictly maintained and augmented.

### Reflection Question 3: How does this affect the backoffice and how can operators manage it?
- Operators gain full administrative visibility over all pending and historical agent proposals in Firestore collection `capability_approvals`.
- Server actions in `src/app/actions/approval-actions.ts` provide the exact backend API for the upcoming Agent Approval Center (`/admin/approvals`) in Milestone 4.
- Backoffice system administrators can toggle the emergency dead-man pause at any time via `setEmergencyPauseStatusAction` to halt agent actions across the organization without deploying code.

---

## 3. File Structure & Responsibilities

| File Path | Responsibility |
|---|---|
| `src/platform/policy/approval-proposal-types.ts` (New) | Canonical Zod v4 schemas for `ActionProposal`, `ActionProposalInput`, `ProposalDecisionInput`, `ApprovalQueryFilters`, and explicit error taxonomy (`ApprovalErrorCode`). |
| `src/platform/policy/approval-proposal-engine.ts` (New) | Core Proposal Engine that inspects capability risk, generates structured WHAT/WHY/WHO/BLAST_RADIUS metadata, computes canonical SHA-256 `payloadHash`, persists proposals to Firestore `capability_approvals`, emits `policy.approval.requested`, and manages proposal lifecycle. |
| `src/platform/policy/governance-dead-man.ts` (New) | Zero-redeploy operational kill-switch in `system_settings/agent_governance` implementing Rule 60 (Emergency Dead-Man Controls) with in-memory caching and TTL. |
| `src/platform/capabilities/policy/approval-verifier.ts` (Enhance) | Enhance `ApprovalVerifier` to support in-memory fake store for unit tests (`createMemoryApprovalVerifier`), transactional `verifyAndBind`, and anti-self-approval hardening. |
| `src/app/actions/approval-actions.ts` (New) | Secure Next.js Server Actions: `listPendingApprovalsAction`, `getApprovalDetailsAction`, `decideApprovalAction`, and `setEmergencyPauseAction` with Clerk authentication (`requireAuth`), workspace boundaries, and domain event emission. |
| `src/platform/__tests__/policy/approval-proposal.test.ts` (New) | Exhaustive test suite verifying proposal generation, SHA-256 payload binding, anti-self-approval, single-use transactional binding, emergency dead-man pause, and delegation provenance propagation. |

---

## 4. Bite-Sized Tasks with Complete Code

### Task 1: Canonical Action Proposal Types & Schemas (`src/platform/policy/approval-proposal-types.ts`)

**Files:**
- Create: `src/platform/policy/approval-proposal-types.ts`
- Test: `src/platform/__tests__/policy/approval-proposal.test.ts`

- [ ] **Step 1: Write failing test for proposal schemas**

Create `src/platform/__tests__/policy/approval-proposal.test.ts` verifying that `ActionProposalSchema` validates well-formed proposals (WHAT, WHY, WHO, BLAST_RADIUS, EVIDENCE) and rejects invalid proposals (e.g. missing `payloadHash`, invalid status, empty WHAT description).

- [ ] **Step 2: Run test to confirm failure**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```
Expected: Module `approval-proposal-types` not found.

- [ ] **Step 3: Implement `src/platform/policy/approval-proposal-types.ts`**

Implement strict Zod v4 schemas:
- `ActionProposalStatus`: `['pending', 'approved', 'rejected', 'bound', 'expired', 'revoked']`
- `BlastRadiusSchema`: entity count, entity type, estimated financial impact, affected tenants.
- `ActionProposalSchema`: `proposalId`, `organizationId`, `workspaceId`, `capabilityId`, `capabilityVersion`, `agentPersonaId`, `authorizingUserId`, `delegationId`, `delegationChain`, `what`, `why`, `blastRadius`, `evidence`, `payload`, `payloadHash`, `status`, `expiresAt`, `createdAt`, `updatedAt`, `decisionNotes`, `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`.
- `CreateProposalInputSchema` & `ProposalDecisionInputSchema`.
- Explicit error codes: `PROPOSAL_NOT_FOUND`, `PROPOSAL_EXPIRED`, `PROPOSAL_ALREADY_DECIDED`, `UNAUTHORIZED_APPROVER`, `SELF_APPROVAL_FORBIDDEN`, `PAYLOAD_TAMPERED`, `EMERGENCY_PAUSED`.

- [ ] **Step 4: Run test to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```
Expected: Schema validation tests pass 100%.

- [ ] **Step 5: Commit changes**

Commit:
```bash
git add src/platform/policy/approval-proposal-types.ts src/platform/__tests__/policy/approval-proposal.test.ts
git commit -m "feat(policy): add canonical action proposal types and schemas (Rule 21, Rule 41)"
```

---

### Task 2: Action Proposal Engine & Payload Binding (`src/platform/policy/approval-proposal-engine.ts`)

**Files:**
- Create: `src/platform/policy/approval-proposal-engine.ts`
- Enhance: `src/platform/capabilities/policy/approval-verifier.ts`
- Test: `src/platform/__tests__/policy/approval-proposal.test.ts`

- [ ] **Step 1: Write tests for Proposal Engine**

Add test cases in `src/platform/__tests__/policy/approval-proposal.test.ts`:
- Generates proposal with canonical SHA-256 `payloadHash` from capability input.
- Formats structured WHAT/WHY/WHO/BLAST RADIUS/EVIDENCE metadata.
- Rejects generic descriptions (enforces Rule 41).
- Attaches `delegationId` and `delegationChain` from `AgentPrincipal`.
- Emits `policy.approval.requested` on `PlatformEventBus`.
- Persists proposal to Firestore/Memory store.

- [ ] **Step 2: Run test to confirm failure**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```

- [ ] **Step 3: Implement `src/platform/policy/approval-proposal-engine.ts`**

Implement:
- `createActionProposal(input, options)`:
  1. Computes SHA-256 `payloadHash` via `computeApprovalPayloadHash`.
  2. Synthesizes transparent WHAT statement based on capability domain and target entity.
  3. Synthesizes WHY statement based on agent reasoning.
  4. Computes Blast Radius (entity count, financial estimate).
  5. Assembles audit evidence pack.
  6. Stores proposal in `capability_approvals` collection.
  7. Publishes `policy.approval.requested` event via `PlatformEventBus`.
- Singleton `globalActionProposalEngine` with HMR preservation.

- [ ] **Step 4: Enhance `src/platform/capabilities/policy/approval-verifier.ts`**

Add in-memory verifier factory `createMemoryApprovalVerifier` for offline testing and verify compatibility with `createFirestoreApprovalVerifier`.

- [ ] **Step 5: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```
Expected: Proposal generation and verification tests pass 100%.

- [ ] **Step 6: Commit changes**

Commit:
```bash
git add src/platform/policy/approval-proposal-engine.ts src/platform/capabilities/policy/approval-verifier.ts src/platform/__tests__/policy/approval-proposal.test.ts
git commit -m "feat(policy): implement canonical action proposal engine and payload binding (Rule 21, 22, 41)"
```

---

### Task 3: Emergency Dead-Man Controls (`src/platform/policy/governance-dead-man.ts`)

**Files:**
- Create: `src/platform/policy/governance-dead-man.ts`
- Test: `src/platform/__tests__/policy/approval-proposal.test.ts`

- [ ] **Step 1: Write tests for Emergency Dead-Man Switch**

Add test cases in `src/platform/__tests__/policy/approval-proposal.test.ts`:
- Normal state allows execution.
- When `emergencyPause: true`, `checkGovernanceDeadManSwitch` throws `AgentGovernanceEmergencyPausedError`.
- Setting pause status updates state and invalidates cache.
- In-memory override functions work for testing.

- [ ] **Step 2: Implement `src/platform/policy/governance-dead-man.ts`**

Implement:
- `AgentGovernanceEmergencyPausedError` (`code: 'AGENT_GOVERNANCE_EMERGENCY_PAUSED'`).
- In-memory cache with 10s TTL to prevent Firestore query exhaustion.
- `checkGovernanceDeadManSwitch(organizationId?)`: Reads `system_settings/agent_governance`.
- `setGovernanceDeadManStateForTests(paused)` for deterministic unit testing.
- `updateEmergencyPauseStatus(paused, reason, adminUserId)`: Updates Firestore.

- [ ] **Step 3: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```

- [ ] **Step 4: Commit changes**

Commit:
```bash
git add src/platform/policy/governance-dead-man.ts src/platform/__tests__/policy/approval-proposal.test.ts
git commit -m "feat(policy): implement emergency dead-man controls for agent governance (Rule 60)"
```

---

### Task 4: Approval Decisioning Server Actions (`src/app/actions/approval-actions.ts`)

**Files:**
- Create: `src/app/actions/approval-actions.ts`
- Test: `src/platform/__tests__/policy/approval-proposal.test.ts`

- [ ] **Step 1: Write tests for Server Actions logic**

Add tests verifying:
- `listPendingApprovalsAction` requires authenticated session and scopes by tenant.
- `getApprovalDetailsAction` retrieves proposal and masks secret fields if any.
- `decideApprovalAction` rejects self-approval by agent (`SELF_APPROVAL_FORBIDDEN`).
- `decideApprovalAction` transitions status to `'approved'` or `'rejected'`.
- Emits `policy.approval.granted` or `policy.approval.rejected` domain event.
- Respects emergency dead-man pause.

- [ ] **Step 2: Implement `src/app/actions/approval-actions.ts`**

Implement:
- `'use server'` directive.
- `listPendingApprovalsAction(workspaceId, filters?)`: Authenticates via `requireAuth()` and `requireWorkspace()`, queries proposals.
- `getApprovalDetailsAction(approvalId)`: Validates tenant isolation, returns proposal details.
- `decideApprovalAction(input)`:
  1. Checks emergency dead-man switch.
  2. Authenticates operator via `requireAuth()`.
  3. Verifies operator is not the requesting agent (`approvedBy !== proposal.requestedBy`).
  4. Atomically updates status in Firestore (`approved` or `rejected`).
  5. Emits `policy.approval.granted` or `policy.approval.rejected` via `PlatformEventBus`.
- `setEmergencyPauseAction(paused, reason)`: Requires platform/system admin permissions.

- [ ] **Step 3: Run tests to confirm passing**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```

- [ ] **Step 4: Commit changes**

Commit:
```bash
git add src/app/actions/approval-actions.ts src/platform/__tests__/policy/approval-proposal.test.ts
git commit -m "feat(actions): implement secure approval decisioning server actions (Rule 13, 47, 51)"
```

---

### Task 5: Full Regression & Gate Verification Suite

**Files:**
- Test: `src/platform/__tests__/policy/approval-proposal.test.ts`
- Test: Full Baseline Suite

- [ ] **Step 1: Run comprehensive Milestone 3 test suite**

Run:
```bash
pnpm test src/platform/__tests__/policy/approval-proposal.test.ts
```
Expected: 100% passing tests.

- [ ] **Step 2: Run all platform policy and identity tests**

Run:
```bash
pnpm test src/platform/__tests__/policy/ src/platform/__tests__/identity/ src/platform/__tests__/approval-binding.test.ts src/platform/__tests__/live-principal-check.test.ts
```
Expected: 100% passing tests across all identity, delegation, and approval suites.

- [ ] **Step 3: Run full agentic baseline regression suite**

Run:
```bash
pnpm test:agentic:baseline
```
Expected: 88/88 test files passing (851+ tests green).

- [ ] **Step 4: Run TypeScript typecheck**

Run:
```bash
NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Run ESLint**

Run:
```bash
pnpm lint
```
Expected: 0 errors, warnings strictly below 670 threshold.

- [ ] **Step 6: Generate Completion Report**

Produce `docs/agents_mcp/phases/agents_mcp_phase_3_milestone_3_completion_report.md` documenting test pass evidence, rule compliance matrix, and security invariants.

- [ ] **Step 7: Final Commit**

Commit:
```bash
git commit -m "chore(governance): verify Phase 3 Milestone 3 compliance and baseline regression"
```
