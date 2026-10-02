/**
 * @fileOverview Capability Contract: identity.access.check_permission (Phase 1 / PR-10)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 16 (Caller Identity),
 * Rule 17 (Non-Delegable Privileges - Refuse Automated Agents), Rule 47 (Explicit Workspace Scope),
 * and Rule 69 (Master Layering Axiom).
 *
 * Checks if the interactive principal has a specific permission in the workspace.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../../capabilities/contracts/capability-definition';

export const CheckPermissionInputSchema = z.object({
  workspaceId: z.string().min(1),
  permission: z.string().min(1),
  resourceId: z.string().optional(),
});

export const CheckPermissionOutputSchema = z.object({
  granted: z.boolean(),
  reason: z.string().optional(),
});

export type CheckPermissionInput = z.infer<typeof CheckPermissionInputSchema>;
export type CheckPermissionOutput = z.infer<typeof CheckPermissionOutputSchema>;

export const checkPermissionCapability: CapabilityDefinition<
  CheckPermissionInput,
  CheckPermissionOutput
> = {
  id: 'identity.access.check_permission',
  version: '1.0.0',
  name: 'Check Permission',
  description: 'Evaluates whether the caller has a specific permission in the workspace. Non-delegable to automated agents.',
  domain: 'identity_access',
  operation: 'execute',
  inputSchema: CheckPermissionInputSchema,
  outputSchema: CheckPermissionOutputSchema,
  permissions: ['identity:access:check'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: true, // Rule 17: Non-delegable, automated agents cannot check/escalate permissions
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
    input: CheckPermissionInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<CheckPermissionOutput>> {
    const { principal } = context;

    // 1. Wildcard check
    if (principal.grantedScopes.includes('*') || principal.grantedScopes.includes('app:system_admin')) {
      return {
        success: true,
        data: { granted: true },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: 0,
      };
    }

    // 2. Direct scope or app: prefixed scope check
    const hasPermission =
      principal.grantedScopes.includes(input.permission) ||
      principal.grantedScopes.includes(`app:${input.permission}`) ||
      principal.grantedScopes.includes(`rbac:${input.permission}`);

    if (hasPermission) {
      return {
        success: true,
        data: { granted: true },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: 0,
      };
    }

    return {
      success: true,
      data: {
        granted: false,
        reason: `Caller does not possess scope '${input.permission}' in workspace '${input.workspaceId}'.`,
      },
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: 0,
    };
  },
};
