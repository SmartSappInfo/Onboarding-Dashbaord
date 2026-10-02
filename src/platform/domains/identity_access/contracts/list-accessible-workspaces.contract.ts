/**
 * @fileOverview Capability Contract: identity.workspace.list_accessible (Phase 1 / PR-10)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 16 (Caller Identity),
 * Rule 47 (Explicit Workspace Scope & Anti-IDOR), and Rule 69 (Master Layering Axiom).
 *
 * Enumerates all workspaces accessible by the current verified principal.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../../capabilities/contracts/capability-definition';
import { getUserWorkspaceIds } from '@/lib/workspace-permissions';
import { adminDb } from '@/lib/firebase-admin';

export const ListAccessibleWorkspacesInputSchema = z.object({});

export const WorkspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  organizationId: z.string().optional(),
});

export const ListAccessibleWorkspacesOutputSchema = z.object({
  workspaces: z.array(WorkspaceSummarySchema),
});

export type ListAccessibleWorkspacesInput = z.infer<typeof ListAccessibleWorkspacesInputSchema>;
export type ListAccessibleWorkspacesOutput = z.infer<typeof ListAccessibleWorkspacesOutputSchema>;

export const listAccessibleWorkspacesCapability: CapabilityDefinition<
  ListAccessibleWorkspacesInput,
  ListAccessibleWorkspacesOutput
> = {
  id: 'identity.workspace.list_accessible',
  version: '1.0.0',
  name: 'List Accessible Workspaces',
  description: 'Enumerates all workspaces within the organization accessible by the current principal.',
  domain: 'identity_access',
  operation: 'read',
  inputSchema: ListAccessibleWorkspacesInputSchema,
  outputSchema: ListAccessibleWorkspacesOutputSchema,
  permissions: ['workspace:read'],
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
    _input: ListAccessibleWorkspacesInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ListAccessibleWorkspacesOutput>> {
    const { principal } = context;

    try {
      const workspaceIds = await getUserWorkspaceIds(principal.userId);
      const targetIds = workspaceIds.length > 0
        ? workspaceIds
        : (principal.workspaceId ? [principal.workspaceId] : []);

      const workspaces: ListAccessibleWorkspacesOutput['workspaces'] = [];

      for (const wsId of targetIds) {
        try {
          const docSnap = await adminDb.collection('workspaces').doc(wsId).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            workspaces.push({
              id: wsId,
              name: (typeof data?.name === 'string' ? data.name : wsId),
              role: principal.effectiveRole,
              organizationId: typeof data?.organizationId === 'string' ? data.organizationId : principal.organizationId,
            });
          } else {
            workspaces.push({
              id: wsId,
              name: wsId,
              role: principal.effectiveRole,
              organizationId: principal.organizationId,
            });
          }
        } catch {
          workspaces.push({
            id: wsId,
            name: wsId,
            role: principal.effectiveRole,
            organizationId: principal.organizationId,
          });
        }
      }

      return {
        success: true,
        data: { workspaces },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: 0,
      };
    } catch {
      return {
        success: true,
        data: {
          workspaces: principal.workspaceId
            ? [{
                id: principal.workspaceId,
                name: principal.workspaceId,
                role: principal.effectiveRole,
                organizationId: principal.organizationId,
              }]
            : [],
        },
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: 0,
      };
    }
  },
};
