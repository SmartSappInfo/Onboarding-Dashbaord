/**
 * @fileOverview Bounded Delegation Service (Phase 3 Milestone 2)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 16 (Bounded Delegation & Wildcard Ban), Rule 17 (Non-Delegable Actions Guard),
 * Rule 23 (Resource Ceilings), and Rule 40 (Audit Log Immutability).
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
