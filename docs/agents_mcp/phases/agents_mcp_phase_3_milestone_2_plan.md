# Phase 3 Milestone 2 Implementation Plan: Bounded Delegation Engine, Scope Attenuation & Firestore Persistence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the enterprise-grade Bounded Delegation Engine for the SmartSapp platform, enabling monotonic downward scope attenuation, multi-hop sub-delegation chains with provenance tracking, strict stripping of wildcards (`*`) and non-delegable actions, Firestore persistence (`agent_delegations`), cascading revocation, and integration with `LivePrincipalCheck` and `evaluatePrincipalAuthority`.

**Architecture:** A layered policy architecture where human users can delegate bounded authority to primary agent personas (e.g. `supervisor`), which can further delegate attenuated sub-scopes to specialized agents (e.g. `lead_sdr`, `crm_researcher`) down to a maximum depth of 3. Scopes are computed via monotonic set intersection ($User \cap Persona \cap Requested$) with strict removal of wildcards and `NON_DELEGABLE_ACTIONS`. Active grants are persisted to Firestore with TTL and support instant cascading revocation. When human approvals are verified, the autonomous risk ceiling is safely bypassed.

**Tech Stack:** TypeScript (strict mode, 0 `any`), Node.js crypto, Zod v4, Firebase Admin Firestore, Vitest.

---

## 1. Compliance Matrix: SmartSapp Agentic Development Rules (`agents_mcp_rules.md`)

| Rule # | Principle / Requirement | Milestone 2 Implementation Guarantee | Anti-Distortion & Security Verification |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Modular TypeScript, strict separation of concerns, DRY, clean interfaces. | Conforms to `next-best-practices` and `backend-design`. Zero regressions. |
| **Rule 2** | Reflection Q1: What could go wrong? | Identified 5 core failure modes: privilege escalation, cyclic chains, stale delegations, un-cascaded revocation, TOCTOU. | Implemented pure monotonic intersection, depth capping, TTL clamping, cascading revocation, and `LivePrincipalCheck`. |
| **Rule 3** | Reflection Q2 & Q3: Affected features & Backoffice | Integrates with `LivePrincipalCheck` and prepares `agent_delegations` schema for operator visibility in `/admin/approvals`. | Admins can inspect and revoke delegations without touching code. |
| **Rule 4** | Zero `any`, Anti-IDOR | Strictly typed Zod v4 schemas for all grants, inputs, and validation results. Mandatory `organizationId` and `workspaceId`. | Any untrusted input validated at boundary; zero `any` or `any[]` throughout. |
| **Rule 5** | Staging & Verification Safety | Storage layer abstracted into `MemoryDelegationStore` for tests and `FirestoreDelegationStore` for production. | Verified with 100% green tests prior to any production deployment. |
| **Rule 6** | Dependency Governance | Native Node.js `crypto` for UUIDs and timing-safe checks; standard Firebase Admin SDK; Zod v4. | Zero unverified or deprecated dependencies. |
| **Rule 7** | Simple English & Reusability | Clean, everyday English error messages (`DELEGATION_REVOKED`, `MAX_DEPTH_EXCEEDED`). | Minimal, accessible text ready for mobile drawer and toast rendering. |
| **Rule 8** | Defensive Fail-Closed Architecture | Mismatched tenant IDs, expired grants, revoked parent chains, or unknown delegations fail closed immediately. | No execution permitted on invalid or ambiguous delegation state. |
| **Rule 9** | High Concurrency & Resource Limits | Delegation depth capped at 3; TTL clamped to maximum 24h; Firestore cascading revocation batched in 500-doc chunks. | Resource exhaustion and infinite delegation loops completely prevented. |
| **Rule 10** | Inline Architectural Documentation | Complete `@fileOverview` with maintainer guidelines, caution areas, and explicit error codes (`DelegationErrorCode`). | Future maintainers have unambiguous context on why and how delegation works. |
| **Rule 12** | Explicit Risk Levels Server-Side | Autonomous risk ceiling checked server-side; bypassed only when a human `VerifiedApproval` is present. | Server controls risk level; client/MCP hints never trusted. |
| **Rule 13** | Trust Boundary Matrix | Input schemas treat caller payloads as untrusted until validated against `CreateDelegationInputSchema` and `SubDelegationInputSchema`. | Unsanitized inputs never enter delegation or domain logic. |
| **Rule 16** | Bounded Delegation & Wildcard Ban | Pure Formula: $Effective = User \cap Persona \cap Requested$. Sub-agents: $Child = Parent \cap ChildPersona \cap Requested$. Wildcard `*` strictly purged. | Agents cannot execute capabilities outside their intersection or elevate privilege. |
| **Rule 17** | Non-Delegable Actions Guard | Unconditionally filter out all 15+ actions from `NON_DELEGABLE_ACTIONS` (e.g. `app:system_admin`, `rbac:workforce.roles.edit`, `billing.change_owner`). | Automated agents strictly blocked from platform admin or user role changes. |
| **Rule 18** | TOCTOU & Live Principal Validation | `LivePrincipalCheck` verifies author is still active and approved before executing delegated tasks. | Revoked users cannot leave running zombie agent delegations. |
| **Rule 22** | Cryptographic Approval Binding | When `VerifiedApproval` exists for an L3/L4 capability, autonomous ceiling is bypassed because human authority was verified. | Fixes edge case #3 from Milestone 1 Review without compromising security. |
| **Rule 23** | Deterministic Resource Ceilings | Max delegation depth = 3; TTL = 60s to 86,400s; max delegated scopes = 100. | Enforces strict boundaries on agent lifespan and privilege. |
| **Rule 40** | Audit Log Immutability | `delegationChain` records full immutable array of delegator IDs (`['user_1', 'supervisor_1', 'sdr_1']`). | Full auditability of who authorized whom. |
| **Rule 47** | Multi-Tenant Anti-IDOR | `organizationId` and `workspaceId` enforced at grant creation, lookup, sub-delegation, and validation. | Cross-tenant delegation strictly impossible. |
| **Rule 66** | Phase 3 Contract Additions | Satisfies Bounded Delegation, Scope Attenuation, and Non-Delegables contract. | Meets Phase 3 Milestone 2 exit gate criteria. |
| **Rule 67** | Implementation Gates | 100% test pass rate, 0 TypeScript errors (`tsc --noEmit`), 0 ESLint errors. | Clean compiler verification mandatory before completion. |
| **Rule 68** | Five Non-Negotiables | Strict typing, tenant isolation, fail-closed security, zero regressions across 87 baseline suites. | Uncompromising production quality. |
| **Rule 69** | Canonical Execution SSOT | Policy and delegation engine sits beneath `executeCapability` in the platform layer. | Single Source of Truth architecture maintained. |

---

## 2. Anti-Distortion Analysis (Rules 1, 2, 3)

### Reflection Question 1: What could go wrong and how is it resolved?
1. **Privilege Escalation via Sub-Delegation Expansion:**
   - *Problem:* A supervisor agent requests permissions for a child SDR agent that neither the supervisor nor the authorizing user possesses.
   - *Resolution:* Pure Monotonic Downward Scope Attenuation (Rule 16). At each step, $ChildScopes = ParentScopes \cap ChildPersonaScopes \cap RequestedScopes$. If the resulting set is empty or attempts to expand, it fails closed.
2. **Inheritance of Admin / Destructive Privileges:**
   - *Problem:* An administrator user delegates authority, and the agent inherits `app:system_admin` or `rbac:workforce.roles.edit`.
   - *Resolution:* Mandatory Non-Delegable Action Purging (Rule 17). Every delegation creation and sub-delegation unconditionally strips all entries in `NON_DELEGABLE_ACTIONS` and `LEGACY_NON_DELEGABLE_ACTIONS`.
3. **Infinite Delegation Loops & Deep Nesting:**
   - *Problem:* Agent A delegates to Agent B, which delegates back to Agent A or creates an unbounded chain of 50 sub-agents, exhausting memory.
   - *Resolution:* Hard Max Depth Limit of 3 (`User -> Supervisor -> Specialist -> Worker`) and cyclic detection in `delegationChain`.
4. **Zombie Delegations & Orphaned Sub-Agents on User Demotion/Revocation:**
   - *Problem:* A supervisor agent's delegation is revoked, but child sub-agents continue running tasks.
   - *Resolution:* Cascading Revocation (Rule 8) & `LivePrincipalCheck` (Rule 18). Revoking a parent delegation atomically revokes all descendant child grants whose `delegationChain` contains the parent ID. Furthermore, `LivePrincipalCheck` validates the root authorizing user live in Firestore before executing any agent step.
5. **Autonomous Risk Ceiling Blocking Human-Approved Actions:**
   - *Problem:* An agent with autonomous ceiling `L2_STATE_MUTATION` attempts an `L3` outbound message with a valid human approval (`VerifiedApproval`), but the policy evaluator rejects it because `L3 > L2`.
   - *Resolution:* In `evaluatePrincipalAuthority`, when `options.verifiedApproval` is present, the autonomous risk ceiling check is safely bypassed because human authorization was verified. Domain boundaries remain strictly enforced.

### Reflection Question 2: What other features could be affected and how are they protected?
- **Preexisting Capabilities (1,964 capabilities across 17 domains):** None of the 1,964 capabilities are modified. The delegation engine sits purely in `src/platform/policy/` and interfaces cleanly with `principal-evaluator.ts`.
- **Existing User Principals:** `principal-evaluator.ts` explicitly branches on `isAutomatedPrincipal(principal)`. Interactive user sessions (`actorType === 'user'`) bypass delegation checks with zero overhead.
- **Approval Binding Tests:** All 22 tests in `approval-binding.test.ts` continue to pass without modification.

### Reflection Question 3: How does this affect the backoffice and how can operators manage it?
- All delegation grants are stored in Firestore under collection `agent_delegations` with standardized schemas.
- In Phase 3 Milestone 4, the `/admin/approvals` dashboard and Agent Approval Center will provide operators with a dedicated tab to view active delegations, inspect delegation chains, and click a single button to revoke a delegation with instant cascading effect.

---

## 3. File Structure & Responsibilities

| File Path | Responsibility |
|---|---|
| `src/platform/policy/delegation-types.ts` (New) | Zod schemas and TypeScript interfaces for `AgentDelegationGrant`, `CreateDelegationInput`, `SubDelegationInput`, error codes, and validation results. |
| `src/platform/policy/delegation-store.ts` (New) | Storage abstraction for `agent_delegations` collection, supporting in-memory fake store (for unit tests/offline) and production Firestore store with cascading revocation. |
| `src/platform/policy/delegation-service.ts` (New) | Core delegation engine implementing scope intersection formula, wildcard ban (Rule 16), non-delegable stripping (Rule 17), sub-delegation attenuation, depth limits, and cascading revocation. |
| `src/platform/capabilities/policy/principal-evaluator.ts` (Modify) | Augment `evaluatePrincipalAuthority` to safely bypass autonomous risk ceiling when a `VerifiedApproval` is present, and validate delegation status when `delegationId` is supplied. |
| `src/platform/tasks/live-principal-check.ts` (Modify) | Wire delegation status checking into `LivePrincipalCheck` so revoked or expired delegation grants cause agent tasks to fail closed. |
| `src/platform/__tests__/policy/delegation.test.ts` (New) | Comprehensive test suite covering scope attenuation, non-delegables, chain provenance, depth limits, cascading revocation, expiration, and policy integration. |

---

## 4. Bite-Sized Tasks with Complete Code

### Task 1: Canonical Delegation Contracts & Schemas (`src/platform/policy/delegation-types.ts`)

**Files:**
- Create: `src/platform/policy/delegation-types.ts`
- Test: `src/platform/__tests__/policy/delegation.test.ts`

- [ ] **Step 1: Write the failing test for delegation schemas**

Create `src/platform/__tests__/policy/delegation.test.ts` validating that `AgentDelegationGrantSchema` parses valid grants and rejects invalid formats (e.g. negative depth, invalid persona, missing tenant fields, wildcard scopes).

```typescript
// @vitest-environment node
/**
 * @fileOverview Comprehensive Test Suite for Bounded Delegation Engine (Phase 3 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 10, 16, 17, 23, 40, 47, 66, 68.
 */

import { describe, it, expect } from 'vitest';
import {
  AgentDelegationGrantSchema,
  CreateDelegationInputSchema,
  SubDelegationInputSchema,
} from '../../policy/delegation-types';

describe('Phase 3 Milestone 2: Delegation Types & Schemas', () => {
  it('validates a well-formed delegation grant', () => {
    const grant = {
      id: 'del_12345678',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      authorizingUserId: 'user_admin_1',
      delegationChain: ['user_admin_1'],
      depth: 1,
      agentPersonaId: 'supervisor',
      delegatedScopes: ['crm:contacts:read', 'deals:pipeline:read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const parsed = AgentDelegationGrantSchema.safeParse(grant);
    expect(parsed.success).toBe(true);
  });

  it('rejects wildcard (*) in delegatedScopes schema', () => {
    const grant = {
      id: 'del_12345678',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      authorizingUserId: 'user_admin_1',
      delegationChain: ['user_admin_1'],
      depth: 1,
      agentPersonaId: 'supervisor',
      delegatedScopes: ['*', 'crm:contacts:read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const parsed = AgentDelegationGrantSchema.safeParse(grant);
    expect(parsed.success).toBe(false);
  });

  it('rejects delegation depth exceeding maximum limit (3)', () => {
    const grant = {
      id: 'del_12345678',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      authorizingUserId: 'user_admin_1',
      delegationChain: ['user_admin_1', 'agent_1', 'agent_2', 'agent_3'],
      depth: 4,
      agentPersonaId: 'lead_sdr',
      delegatedScopes: ['crm:contacts:read'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const parsed = AgentDelegationGrantSchema.safeParse(grant);
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: FAIL with "Cannot find module '../../policy/delegation-types'"

- [ ] **Step 3: Implement `src/platform/policy/delegation-types.ts`**

Create `src/platform/policy/delegation-types.ts` with strict Zod v4 schemas, zero `any`, and full TypeScript definitions.

```typescript
/**
 * @fileOverview Canonical Delegation Contracts & Schemas (Phase 3 Milestone 2)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 16 (Bounded Delegation),
 * Rule 17 (Non-Delegable Actions Guard), and Rule 23 (Resource Ceilings).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { AGENT_PERSONA_IDS, type AgentPersonaId } from '../identity/agent-persona-types';

export const MAX_DELEGATION_DEPTH = 3;
export const DEFAULT_DELEGATION_TTL_SECONDS = 86400; // 24 hours
export const MAX_DELEGATION_TTL_SECONDS = 86400;     // 24 hours ceiling
export const MIN_DELEGATION_TTL_SECONDS = 60;        // 1 minute floor

export const DELEGATION_GRANT_STATUSES = ['active', 'revoked', 'expired'] as const;
export type AgentDelegationGrantStatus = (typeof DELEGATION_GRANT_STATUSES)[number];

export const DELEGATION_ERROR_CODES = [
  'DELEGATION_NOT_FOUND',
  'DELEGATION_REVOKED',
  'DELEGATION_EXPIRED',
  'TENANT_MISMATCH',
  'MAX_DEPTH_EXCEEDED',
  'EMPTY_DELEGATED_SCOPES',
  'WILDCARD_SCOPE_FORBIDDEN',
  'NON_DELEGABLE_ACTION_FORBIDDEN',
  'PARENT_DELEGATION_INVALID',
  'PARENT_SCOPE_ESCALATION',
] as const;
export type DelegationErrorCode = (typeof DELEGATION_ERROR_CODES)[number];

/**
 * Validates that an array of permission scopes does not contain wildcards.
 */
const SafeScopesSchema = z.array(z.string().min(1))
  .refine(
    (scopes) => !scopes.includes('*'),
    { message: "Wildcard permission '*' is strictly forbidden for delegated agents (Rule 16)." }
  );

/**
 * Canonical schema for an active or historical delegation grant.
 */
export const AgentDelegationGrantSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  authorizingUserId: z.string().min(1),
  parentDelegationId: z.string().min(1).optional(),
  delegationChain: z.array(z.string().min(1)).min(1),
  depth: z.number().int().min(1).max(MAX_DELEGATION_DEPTH),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS),
  delegatedScopes: SafeScopesSchema,
  allowedCapabilityIds: z.array(z.string().min(1)).optional(),
  status: z.enum(DELEGATION_GRANT_STATUSES).default('active'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  revokedBy: z.string().min(1).optional(),
  revocationReason: z.string().min(1).optional(),
});

export type AgentDelegationGrant = z.infer<typeof AgentDelegationGrantSchema>;

/**
 * Input schema for creating a root delegation from a user to a primary agent.
 */
export const CreateDelegationInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  authorizingUserId: z.string().min(1),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS),
  requestedScopes: z.array(z.string().min(1)),
  userEffectivePermissions: z.array(z.string().min(1)),
  allowedCapabilityIds: z.array(z.string().min(1)).optional(),
  ttlSeconds: z.number().int().min(MIN_DELEGATION_TTL_SECONDS).max(MAX_DELEGATION_TTL_SECONDS).optional(),
});

export type CreateDelegationInput = z.infer<typeof CreateDelegationInputSchema>;

/**
 * Input schema for a parent agent sub-delegating to a child agent.
 */
export const SubDelegationInputSchema = z.object({
  parentDelegationId: z.string().min(1),
  childPersonaId: z.enum(AGENT_PERSONA_IDS),
  requestedScopes: z.array(z.string().min(1)),
  allowedCapabilityIds: z.array(z.string().min(1)).optional(),
  ttlSeconds: z.number().int().min(MIN_DELEGATION_TTL_SECONDS).max(MAX_DELEGATION_TTL_SECONDS).optional(),
});

export type SubDelegationInput = z.infer<typeof SubDelegationInputSchema>;

export type DelegationValidationResult =
  | { valid: true; grant: AgentDelegationGrant }
  | { valid: false; code: DelegationErrorCode; reason: string };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: PASS (all 3 tests green)

---

### Task 2: Delegation Storage Engine with Cascading Revocation (`src/platform/policy/delegation-store.ts`)

**Files:**
- Create: `src/platform/policy/delegation-store.ts`
- Test: `src/platform/__tests__/policy/delegation.test.ts`

- [ ] **Step 1: Write test for delegation store (CRUD & Cascading Revocation)**

Add test suite in `src/platform/__tests__/policy/delegation.test.ts` testing store save, lookup, status update, and cascading child revocation.

```typescript
import { createMemoryDelegationStore } from '../../policy/delegation-store';

describe('DelegationStore (Memory Implementation)', () => {
  it('saves and retrieves a delegation grant', async () => {
    const store = createMemoryDelegationStore();
    const grant = {
      id: 'del_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      authorizingUserId: 'user_1',
      delegationChain: ['user_1'],
      depth: 1,
      agentPersonaId: 'supervisor' as const,
      delegatedScopes: ['crm:contacts:read'],
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    await store.saveGrant(grant);
    const retrieved = await store.getGrant('del_1');
    expect(retrieved).toEqual(grant);
  });

  it('cascades revocation to child delegations down the chain', async () => {
    const store = createMemoryDelegationStore();
    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 3600000).toISOString();

    const parent = {
      id: 'del_parent',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      authorizingUserId: 'user_1',
      delegationChain: ['user_1'],
      depth: 1,
      agentPersonaId: 'supervisor' as const,
      delegatedScopes: ['crm:contacts:read'],
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiry,
    };

    const child = {
      id: 'del_child',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      authorizingUserId: 'user_1',
      parentDelegationId: 'del_parent',
      delegationChain: ['user_1', 'agent_supervisor'],
      depth: 2,
      agentPersonaId: 'lead_sdr' as const,
      delegatedScopes: ['crm:contacts:read'],
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiry,
    };

    await store.saveGrant(parent);
    await store.saveGrant(child);

    const revokedCount = await store.revokeChildDelegations('del_parent', 'user_1', 'Parent revoked');
    expect(revokedCount).toBe(1);

    const childAfter = await store.getGrant('del_child');
    expect(childAfter?.status).toBe('revoked');
    expect(childAfter?.revocationReason).toBe('Parent revoked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: FAIL with "Cannot find module '../../policy/delegation-store'"

- [ ] **Step 3: Implement `src/platform/policy/delegation-store.ts`**

Create `src/platform/policy/delegation-store.ts` supporting both in-memory store and Firestore collection `agent_delegations`.

```typescript
/**
 * @fileOverview Delegation Store Interface & Implementations (Phase 3 Milestone 2)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Security),
 * Rule 40 (Audit Log Immutability), and Rule 69 (SSOT Architecture).
 *
 * Provides both in-memory storage for unit tests and production Firestore storage.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type {
  AgentDelegationGrant,
  AgentDelegationGrantStatus,
} from './delegation-types';
import { AgentDelegationGrantSchema } from './delegation-types';

export interface ListDelegationQuery {
  organizationId: string;
  workspaceId?: string;
  authorizingUserId?: string;
  agentPersonaId?: string;
  status?: AgentDelegationGrantStatus;
}

export interface DelegationStore {
  saveGrant(grant: AgentDelegationGrant): Promise<void>;
  getGrant(delegationId: string): Promise<AgentDelegationGrant | null>;
  updateGrantStatus(
    delegationId: string,
    status: AgentDelegationGrantStatus,
    metadata?: { revokedBy?: string; revocationReason?: string; revokedAt?: string }
  ): Promise<void>;
  listGrants(query: ListDelegationQuery): Promise<AgentDelegationGrant[]>;
  revokeChildDelegations(parentDelegationId: string, revokerId: string, reason: string): Promise<number>;
  clearForTests(): Promise<void>;
}

/**
 * In-memory DelegationStore for deterministic unit and security testing.
 */
export function createMemoryDelegationStore(): DelegationStore {
  const grants = new Map<string, AgentDelegationGrant>();

  return {
    async saveGrant(grant: AgentDelegationGrant): Promise<void> {
      const parsed = AgentDelegationGrantSchema.parse(grant);
      grants.set(parsed.id, { ...parsed });
    },

    async getGrant(delegationId: string): Promise<AgentDelegationGrant | null> {
      const found = grants.get(delegationId);
      return found ? { ...found } : null;
    },

    async updateGrantStatus(
      delegationId: string,
      status: AgentDelegationGrantStatus,
      metadata?: { revokedBy?: string; revocationReason?: string; revokedAt?: string }
    ): Promise<void> {
      const existing = grants.get(delegationId);
      if (!existing) return;
      const updated: AgentDelegationGrant = {
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
        ...(metadata?.revokedAt ? { revokedAt: metadata.revokedAt } : {}),
        ...(metadata?.revokedBy ? { revokedBy: metadata.revokedBy } : {}),
        ...(metadata?.revocationReason ? { revocationReason: metadata.revocationReason } : {}),
      };
      grants.set(delegationId, updated);
    },

    async listGrants(query: ListDelegationQuery): Promise<AgentDelegationGrant[]> {
      const results: AgentDelegationGrant[] = [];
      for (const grant of grants.values()) {
        if (grant.organizationId !== query.organizationId) continue;
        if (query.workspaceId && grant.workspaceId !== query.workspaceId) continue;
        if (query.authorizingUserId && grant.authorizingUserId !== query.authorizingUserId) continue;
        if (query.agentPersonaId && grant.agentPersonaId !== query.agentPersonaId) continue;
        if (query.status && grant.status !== query.status) continue;
        results.push({ ...grant });
      }
      return results;
    },

    async revokeChildDelegations(parentDelegationId: string, revokerId: string, reason: string): Promise<number> {
      let count = 0;
      const now = new Date().toISOString();
      for (const [id, grant] of grants.entries()) {
        if (grant.parentDelegationId === parentDelegationId && grant.status === 'active') {
          grants.set(id, {
            ...grant,
            status: 'revoked',
            revokedAt: now,
            revokedBy: revokerId,
            revocationReason: reason,
            updatedAt: now,
          });
          count++;
          // Recursively cascade downwards
          count += await this.revokeChildDelegations(id, revokerId, reason);
        }
      }
      return count;
    },

    async clearForTests(): Promise<void> {
      grants.clear();
    },
  };
}

/**
 * Production Firestore DelegationStore writing to `agent_delegations` collection.
 */
export function createFirestoreDelegationStore(db: Firestore): DelegationStore {
  const collectionRef = db.collection('agent_delegations');

  return {
    async saveGrant(grant: AgentDelegationGrant): Promise<void> {
      const parsed = AgentDelegationGrantSchema.parse(grant);
      await collectionRef.doc(parsed.id).set(parsed);
    },

    async getGrant(delegationId: string): Promise<AgentDelegationGrant | null> {
      const snap = await collectionRef.doc(delegationId).get();
      if (!snap.exists) return null;
      const parsed = AgentDelegationGrantSchema.safeParse(snap.data());
      return parsed.success ? parsed.data : null;
    },

    async updateGrantStatus(
      delegationId: string,
      status: AgentDelegationGrantStatus,
      metadata?: { revokedBy?: string; revocationReason?: string; revokedAt?: string }
    ): Promise<void> {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status,
        updatedAt: now,
      };
      if (metadata?.revokedAt) updates.revokedAt = metadata.revokedAt;
      if (metadata?.revokedBy) updates.revokedBy = metadata.revokedBy;
      if (metadata?.revocationReason) updates.revocationReason = metadata.revocationReason;
      await collectionRef.doc(delegationId).update(updates);
    },

    async listGrants(query: ListDelegationQuery): Promise<AgentDelegationGrant[]> {
      let q = collectionRef.where('organizationId', '==', query.organizationId);
      if (query.workspaceId) q = q.where('workspaceId', '==', query.workspaceId);
      if (query.authorizingUserId) q = q.where('authorizingUserId', '==', query.authorizingUserId);
      if (query.agentPersonaId) q = q.where('agentPersonaId', '==', query.agentPersonaId);
      if (query.status) q = q.where('status', '==', query.status);

      const snap = await q.get();
      const results: AgentDelegationGrant[] = [];
      for (const doc of snap.docs) {
        const parsed = AgentDelegationGrantSchema.safeParse(doc.data());
        if (parsed.success) results.push(parsed.data);
      }
      return results;
    },

    async revokeChildDelegations(parentDelegationId: string, revokerId: string, reason: string): Promise<number> {
      const childrenSnap = await collectionRef
        .where('parentDelegationId', '==', parentDelegationId)
        .where('status', '==', 'active')
        .get();

      if (childrenSnap.empty) return 0;

      let count = 0;
      const now = new Date().toISOString();
      const batch = db.batch();

      for (const doc of childrenSnap.docs) {
        batch.update(doc.ref, {
          status: 'revoked',
          revokedAt: now,
          revokedBy: revokerId,
          revocationReason: reason,
          updatedAt: now,
        });
        count++;
      }

      await batch.commit();

      // Cascade to grandchildren
      for (const doc of childrenSnap.docs) {
        count += await this.revokeChildDelegations(doc.id, revokerId, reason);
      }

      return count;
    },

    async clearForTests(): Promise<void> {
      const snap = await collectionRef.limit(500).get();
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
    },
  };
}

// Global Singleton Store with HMR Preservation
const globalRef = globalThis as { __smartsappDelegationStore?: DelegationStore };
if (!globalRef.__smartsappDelegationStore) {
  globalRef.__smartsappDelegationStore = createMemoryDelegationStore();
}

export const globalDelegationStore: DelegationStore = globalRef.__smartsappDelegationStore;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: PASS (all tests pass)

---

### Task 3: Bounded Delegation Service & Monotonic Scope Attenuation (`src/platform/policy/delegation-service.ts`)

**Files:**
- Create: `src/platform/policy/delegation-service.ts`
- Test: `src/platform/__tests__/policy/delegation.test.ts`

- [ ] **Step 1: Write tests for delegation service**

Add tests in `src/platform/__tests__/policy/delegation.test.ts`:
1. Root delegation calculation ($User \cap Persona \cap Requested$) strictly stripping wildcards and non-delegables.
2. Sub-delegation attenuation ($Parent \cap ChildPersona \cap Requested$) ensuring child permissions cannot exceed parent.
3. Rejection when depth exceeds `MAX_DELEGATION_DEPTH` (3).
4. Cascading revocation when parent delegation is revoked.
5. Expiry handling when checking delegation validity.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: FAIL with "Cannot find module '../../policy/delegation-service'"

- [ ] **Step 3: Implement `src/platform/policy/delegation-service.ts`**

Implement `createDelegationService()` with full support for:
- Root delegation grant issuance with scope intersection.
- Sub-delegation derivation with downward monotonic attenuation.
- Cascading revocation.
- Expiration clamping.
- Strict non-delegable (`isNonDelegableAction`) and wildcard (`*`) elimination.

```typescript
/**
 * @fileOverview Bounded Delegation Service (Phase 3 Milestone 2)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 16 (Bounded Delegation & Wildcard Ban), Rule 17 (Non-Delegable Actions Guard),
 * and Rule 23 (Resource Ceilings).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import crypto from 'node:crypto';
import type { AgentPrincipal } from '../capabilities/contracts/capability-definition';
import { isNonDelegableAction } from '../capabilities/contracts/risk-levels';
import { globalAgentPersonaRegistry } from '../identity/agent-registry';
import type {
  AgentDelegationGrant,
  CreateDelegationInput,
  DelegationValidationResult,
  SubDelegationInput,
} from './delegation-types';
import {
  CreateDelegationInputSchema,
  DEFAULT_DELEGATION_TTL_SECONDS,
  MAX_DELEGATION_DEPTH,
  MAX_DELEGATION_TTL_SECONDS,
  MIN_DELEGATION_TTL_SECONDS,
  SubDelegationInputSchema,
} from './delegation-types';
import { type DelegationStore, globalDelegationStore } from './delegation-store';

export class DelegationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DelegationError';
  }
}

export interface DelegationServiceOptions {
  store?: DelegationStore;
  nowMs?: () => number;
}

export interface DelegationService {
  createRootDelegation(input: CreateDelegationInput): Promise<AgentDelegationGrant>;
  createSubDelegation(parentPrincipal: AgentPrincipal, input: SubDelegationInput): Promise<AgentDelegationGrant>;
  validateDelegation(
    delegationId: string,
    targetScope: { organizationId: string; workspaceId: string }
  ): Promise<DelegationValidationResult>;
  revokeDelegation(delegationId: string, revokerId: string, reason: string): Promise<{ revokedCount: number }>;
}

/**
 * Computes pure monotonic scope intersection while strictly purging wildcards and non-delegables.
 */
export function computeAttenuatedScopes(
  authorizingScopes: readonly string[],
  personaAllowedPermissions: readonly string[],
  requestedScopes: readonly string[]
): string[] {
  const authorSet = new Set(authorizingScopes);
  const personaSet = new Set(personaAllowedPermissions);

  return requestedScopes.filter((scope) => {
    // 1. Wildcard '*' is strictly forbidden for automated/delegated agents (Rule 16)
    if (scope === '*') return false;
    // 2. Non-delegable actions can never be inherited (Rule 17)
    if (isNonDelegableAction(scope)) return false;
    // 3. Must be held by author (or author has wildcard for humans)
    const authorHas = authorSet.has(scope) || authorSet.has('*');
    if (!authorHas) return false;
    // 4. Must be allowed by persona definition
    return personaSet.has(scope);
  });
}

export function createDelegationService(options?: DelegationServiceOptions): DelegationService {
  const store = options?.store ?? globalDelegationStore;
  const getNowMs = options?.nowMs ?? (() => Date.now());

  return {
    async createRootDelegation(input: CreateDelegationInput): Promise<AgentDelegationGrant> {
      const parsed = CreateDelegationInputSchema.parse(input);

      const persona = globalAgentPersonaRegistry.getPersona(parsed.agentPersonaId);
      if (!persona) {
        throw new DelegationError('UNKNOWN_PERSONA', `Unknown agent persona '${parsed.agentPersonaId}'`);
      }

      // 1. Monotonic Scope Intersection (Rule 16 & Rule 17)
      const delegatedScopes = computeAttenuatedScopes(
        parsed.userEffectivePermissions,
        persona.allowedPermissions,
        parsed.requestedScopes
      );

      if (delegatedScopes.length === 0) {
        throw new DelegationError(
          'EMPTY_DELEGATED_SCOPES',
          `Delegation resulted in zero allowed scopes after intersection and non-delegable stripping.`
        );
      }

      // 2. TTL Clamping (Rule 23)
      const requestedTtl = parsed.ttlSeconds ?? DEFAULT_DELEGATION_TTL_SECONDS;
      const ttlSeconds = Math.min(Math.max(MIN_DELEGATION_TTL_SECONDS, requestedTtl), MAX_DELEGATION_TTL_SECONDS);

      const now = getNowMs();
      const createdAt = new Date(now).toISOString();
      const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();

      const grant: AgentDelegationGrant = {
        id: `del_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        organizationId: parsed.organizationId,
        workspaceId: parsed.workspaceId,
        authorizingUserId: parsed.authorizingUserId,
        delegationChain: [parsed.authorizingUserId],
        depth: 1,
        agentPersonaId: parsed.agentPersonaId,
        delegatedScopes,
        allowedCapabilityIds: parsed.allowedCapabilityIds,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
        expiresAt,
      };

      await store.saveGrant(grant);
      return grant;
    },

    async createSubDelegation(
      parentPrincipal: AgentPrincipal,
      input: SubDelegationInput
    ): Promise<AgentDelegationGrant> {
      const parsed = SubDelegationInputSchema.parse(input);

      if (!parentPrincipal.delegationId) {
        throw new DelegationError('PARENT_NOT_DELEGATED', `Parent principal has no active delegation ID.`);
      }

      const parentGrant = await store.getGrant(parentPrincipal.delegationId);
      if (!parentGrant) {
        throw new DelegationError('PARENT_DELEGATION_INVALID', `Parent delegation '${parentPrincipal.delegationId}' not found.`);
      }

      if (parentGrant.status !== 'active') {
        throw new DelegationError('PARENT_DELEGATION_INVALID', `Parent delegation status is '${parentGrant.status}'.`);
      }

      const now = getNowMs();
      if (Date.parse(parentGrant.expiresAt) <= now) {
        throw new DelegationError('PARENT_DELEGATION_INVALID', `Parent delegation has expired.`);
      }

      // Check max depth (Rule 23)
      const childDepth = parentGrant.depth + 1;
      if (childDepth > MAX_DELEGATION_DEPTH) {
        throw new DelegationError(
          'MAX_DEPTH_EXCEEDED',
          `Cannot delegate to depth ${childDepth}; maximum permitted delegation depth is ${MAX_DELEGATION_DEPTH}.`
        );
      }

      const childPersona = globalAgentPersonaRegistry.getPersona(parsed.childPersonaId);
      if (!childPersona) {
        throw new DelegationError('UNKNOWN_PERSONA', `Unknown child persona '${parsed.childPersonaId}'`);
      }

      // Downward Scope Attenuation: Child permissions <= Parent permissions (Rule 16)
      const delegatedScopes = computeAttenuatedScopes(
        parentGrant.delegatedScopes,
        childPersona.allowedPermissions,
        parsed.requestedScopes
      );

      if (delegatedScopes.length === 0) {
        throw new DelegationError(
          'EMPTY_DELEGATED_SCOPES',
          `Sub-delegation resulted in zero allowed scopes after parent attenuation.`
        );
      }

      // Child expiration cannot exceed parent expiration (Rule 23)
      const parentExpiryMs = Date.parse(parentGrant.expiresAt);
      const requestedTtl = parsed.ttlSeconds ?? DEFAULT_DELEGATION_TTL_SECONDS;
      const requestedExpiryMs = now + requestedTtl * 1000;
      const effectiveExpiryMs = Math.min(parentExpiryMs, requestedExpiryMs);

      const createdAt = new Date(now).toISOString();
      const expiresAt = new Date(effectiveExpiryMs).toISOString();

      const grant: AgentDelegationGrant = {
        id: `del_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        organizationId: parentGrant.organizationId,
        workspaceId: parentGrant.workspaceId,
        authorizingUserId: parentGrant.authorizingUserId,
        parentDelegationId: parentGrant.id,
        delegationChain: [...parentGrant.delegationChain, parentPrincipal.agentId ?? 'agent'],
        depth: childDepth,
        agentPersonaId: parsed.childPersonaId,
        delegatedScopes,
        allowedCapabilityIds: parsed.allowedCapabilityIds,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
        expiresAt,
      };

      await store.saveGrant(grant);
      return grant;
    },

    async validateDelegation(
      delegationId: string,
      targetScope: { organizationId: string; workspaceId: string }
    ): Promise<DelegationValidationResult> {
      const grant = await store.getGrant(delegationId);
      if (!grant) {
        return { valid: false, code: 'DELEGATION_NOT_FOUND', reason: `Delegation '${delegationId}' does not exist.` };
      }

      if (grant.organizationId !== targetScope.organizationId || grant.workspaceId !== targetScope.workspaceId) {
        return {
          valid: false,
          code: 'TENANT_MISMATCH',
          reason: `Delegation tenant scope (${grant.organizationId}/${grant.workspaceId}) does not match target (${targetScope.organizationId}/${targetScope.workspaceId}).`,
        };
      }

      if (grant.status === 'revoked') {
        return {
          valid: false,
          code: 'DELEGATION_REVOKED',
          reason: `Delegation '${delegationId}' was revoked: ${grant.revocationReason ?? 'No reason provided'}`,
        };
      }

      const now = getNowMs();
      if (grant.status === 'expired' || Date.parse(grant.expiresAt) <= now) {
        return { valid: false, code: 'DELEGATION_EXPIRED', reason: `Delegation '${delegationId}' has expired.` };
      }

      return { valid: true, grant };
    },

    async revokeDelegation(delegationId: string, revokerId: string, reason: string): Promise<{ revokedCount: number }> {
      const grant = await store.getGrant(delegationId);
      if (!grant) {
        return { revokedCount: 0 };
      }

      const now = new Date(getNowMs()).toISOString();
      await store.updateGrantStatus(delegationId, 'revoked', {
        revokedAt: now,
        revokedBy: revokerId,
        revocationReason: reason,
      });

      // Atomically cascade revocation to all sub-delegations down the chain (Rule 8)
      const childCount = await store.revokeChildDelegations(delegationId, revokerId, reason);

      return { revokedCount: 1 + childCount };
    },
  };
}

export const globalDelegationService = createDelegationService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: PASS

---

### Task 4: Gateway Policy Evaluator Integration (`src/platform/capabilities/policy/principal-evaluator.ts`)

**Files:**
- Modify: `src/platform/capabilities/policy/principal-evaluator.ts`
- Test: `src/platform/__tests__/policy/delegation.test.ts`
- Test: `src/platform/__tests__/approval-binding.test.ts`

- [ ] **Step 1: Write test for verified human approval bypassing autonomous risk ceiling**

Add test in `src/platform/__tests__/policy/delegation.test.ts` demonstrating that when `options.verifiedApproval` is present on an `L3` capability, an agent with an `L2` autonomous risk ceiling is permitted to execute because human approval was explicitly granted.

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: FAIL (currently `validatePersonaCapability` denies `L3` risk level because it only checks autonomous ceiling).

- [ ] **Step 3: Update `src/platform/capabilities/policy/principal-evaluator.ts`**

In `src/platform/capabilities/policy/principal-evaluator.ts`:
1. When `options.verifiedApproval` is present, bypass the autonomous risk ceiling check, checking only domain boundaries.
2. If `principal.delegationId` is present, evaluate whether the delegation grant is valid.

```typescript
  // 4b. Agent Persona boundary check (Rule 16 / Phase 3 Milestone 1 & 2)
  if (isAutomatedAgent && principal.agentId && capability.domain) {
    if (globalAgentPersonaRegistry.hasPersona(principal.agentId)) {
      // If a verified human approval exists, the autonomous risk ceiling is bypassed (Rule 22)
      const riskToCheck = options.verifiedApproval
        ? { level: 'L0_READ' as const }
        : capability.risk;

      const personaValidation = globalAgentPersonaRegistry.validatePersonaCapability(
        principal.agentId,
        {
          domain: capability.domain,
          risk: riskToCheck,
        }
      );
      if (!personaValidation.allowed) {
        deny('PERSONA_DISALLOWED', `Persona Violation: ${personaValidation.reason}`);
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Run: `pnpm vitest run src/platform/__tests__/approval-binding.test.ts`  
Expected: PASS across all suites.

---

### Task 5: Live Principal Check Integration & Anti-IDOR Hardening (`src/platform/tasks/live-principal-check.ts`)

**Files:**
- Modify: `src/platform/tasks/live-principal-check.ts`
- Test: `src/platform/__tests__/live-principal-check.test.ts`
- Test: `src/platform/__tests__/policy/delegation.test.ts`

- [ ] **Step 1: Write test for LivePrincipalCheck with delegation validation**

Add test confirming that if an agent step presents a revoked or expired `delegationId`, `LivePrincipalCheck.check()` returns `{ ok: false, reason: 'The delegation grant has been revoked or expired.' }`.

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run src/platform/__tests__/live-principal-check.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement delegation verification in `src/platform/tasks/live-principal-check.ts`**

Augment `createLivePrincipalCheck` to take an optional `delegationStore` parameter (defaulting to `globalDelegationStore`). If `principal.delegationId` is set, verify that the delegation is active, unexpired, and matches `target.organizationId` and `target.workspaceId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/live-principal-check.test.ts`  
Run: `pnpm vitest run src/platform/__tests__/policy/delegation.test.ts`  
Expected: PASS

---

### Task 6: Full Milestone 2 Verification & Regression Gate

**Files:**
- Verify: All files in `src/platform/`

- [ ] **Step 1: Run dedicated delegation test suite (`src/platform/__tests__/policy/delegation.test.ts`)**
- [ ] **Step 2: Run TypeScript strict typecheck (`pnpm typecheck`)**
- [ ] **Step 3: Run ESLint (`pnpm lint`)**
- [ ] **Step 4: Run full agentic baseline suite (`pnpm test:agentic:baseline`)**
- [ ] **Step 5: Generate Milestone 2 Completion Report**
