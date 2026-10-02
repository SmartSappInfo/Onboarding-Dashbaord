/**
 * @fileOverview Capability Contract: identity.access.list_effective_permissions (Phase 1 / PR-10)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 16 (Caller Identity),
 * Rule 17 (Non-Delegable Privileges - Refuse Automated Agents), Rule 47 (Explicit Workspace Scope),
 * and Rule 69 (Master Layering Axiom).
 *
 * Returns all enumerated permissions, ownership, and admin status for caller in the target workspace.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../../capabilities/contracts/capability-definition';

export const ListEffectivePermissionsInputSchema = z.object({
  workspaceId: z.string().min(1),
});

export const ListEffectivePermissionsOutputSchema = z.object({
  workspaceId: z.string(),
  permissions: z.array(z.string()),
  isOwner: z.boolean(),
  isAdmin: z.boolean(),
});

export type ListEffectivePermissionsInput = z.infer<typeof ListEffectivePermissionsInputSchema>;
export type ListEffectivePermissionsOutput = z.infer<typeof ListEffectivePermissionsOutputSchema>;

export const listEffectivePermissionsCapability: CapabilityDefinition<
  ListEffectivePermissionsInput,
  ListEffectivePermissionsOutput
> = {
  id: 'identity.access.list_effective_permissions',
  version: '1.0.0',
  name: 'List Effective Permissions',
  description: 'Returns all effective permissions, role markers, and admin flags for the caller in the workspace. Non-delegable to automated agents.',
  domain: 'identity_access',
  operation: 'read',
  inputSchema: ListEffectivePermissionsInputSchema,
  outputSchema: ListEffectivePermissionsOutputSchema,
  permissions: ['identity:access:list'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: true, // Rule 17: Non-delegable
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
    input: ListEffectivePermissionsInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ListEffectivePermissionsOutput>> {
    const { principal } = context;

    const isOwner = principal.effectiveRole === 'owner';
    const isAdmin =
      principal.effectiveRole === 'admin' ||
      principal.effectiveRole === 'system_admin' ||
      principal.grantedScopes.includes('app:system_admin') ||
      principal.grantedScopes.includes('*');

    return {
      success: true,
      data: {
        workspaceId: input.workspaceId,
        permissions: principal.grantedScopes,
        isOwner,
        isAdmin,
      },
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: 0,
    };
  },
};
