/**
 * @fileOverview Canonical Delegation Contracts & Schemas (Phase 3 Milestone 2)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 16 (Bounded Delegation & Wildcard Ban), Rule 17 (Non-Delegable Actions Guard),
 * and Rule 23 (Resource Ceilings).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { AGENT_PERSONA_IDS } from '../identity/agent-persona-types';

export const MAX_DELEGATION_DEPTH = 3;
export const DEFAULT_DELEGATION_TTL_SECONDS = 86400; // 24 hours default
export const MAX_DELEGATION_TTL_SECONDS = 86400;     // 24 hours hard ceiling (Rule 23)
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
 * Validates that an array of permission scopes does not contain wildcards (Rule 16).
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
