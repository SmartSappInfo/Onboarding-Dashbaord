/**
 * @fileOverview Capability Contract: identity.actor.get_current (Phase 1 / PR-10)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 16 (Caller Identity),
 * and Rule 69 (Master Layering Axiom).
 *
 * Returns caller profile, tenant context, active scopes, and role info using the active principal.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../../capabilities/contracts/capability-definition';

export const GetCurrentActorInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export const GetCurrentActorOutputSchema = z.object({
  userId: z.string(),
  actorType: z.string(),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  permissions: z.array(z.string()),
  effectiveRole: z.string(),
  agentId: z.string().optional(),
  delegationId: z.string().optional(),
});

export type GetCurrentActorInput = z.infer<typeof GetCurrentActorInputSchema>;
export type GetCurrentActorOutput = z.infer<typeof GetCurrentActorOutputSchema>;

export const getCurrentActorCapability: CapabilityDefinition<
  GetCurrentActorInput,
  GetCurrentActorOutput
> = {
  id: 'identity.actor.get_current',
  version: '1.0.0',
  name: 'Get Current Actor',
  description: 'Returns the verified identity, tenant context, effective scopes, and role of the current caller.',
  domain: 'identity_access',
  operation: 'read',
  inputSchema: GetCurrentActorInputSchema,
  outputSchema: GetCurrentActorOutputSchema,
  permissions: ['identity:read'],
  workspaceScoped: false,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(
    _input: GetCurrentActorInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<GetCurrentActorOutput>> {
    const { principal } = context;

    return {
      success: true,
      data: {
        userId: principal.userId,
        actorType: principal.actorType,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        permissions: principal.grantedScopes,
        effectiveRole: principal.effectiveRole,
        agentId: principal.agentId,
        delegationId: principal.delegationId,
      },
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: 0,
    };
  },
};
