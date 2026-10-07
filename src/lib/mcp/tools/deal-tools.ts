/**
 * @fileOverview CompanyBrain 2.0 Phase 6 / Phase 1: Governed Deal MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10 & Rule 69):
 * 1. Single Source of Truth for Deal State:
 *    - Delegates stage progression to canonical `dealAdvanceStageCapability` and reads to `dealGetCapability`.
 * 2. Risk Tier:
 *    - `deal.get`: read_only (L0_READ, zero mutation).
 *    - `deal.update_stage`: high_risk (L2_STATE_MUTATION; transitions stage and checks gate validation).
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses Zod schemas and recursive `McpPayloadValue`.
 * 4. In-Place Upgrades:
 *    - Registers canonical definitions with `{ allowOverride: true }`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts` and `src/platform/__tests__/domains/deals-pipelines.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition } from '../types';
import type { UserProfile } from '@/lib/types';
import { isUserWorkspaceAdmin } from '@/lib/workspace-admin-utils';
import { adminDb } from '@/lib/firebase-admin';
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  dealGetCapability,
  dealSearchCapability,
  dealAdvanceStageCapability,
  dealTransferCapability,
} from '@/platform/domains/deals_revenue/contracts/deal-capabilities.contract';
import { transferDealCore } from '@/lib/deals/deal-transfer-core';
import type { CrmActor } from '@/lib/crm/deal-core';

// ==========================================
// 1. deal.get (Read-Only)
// ==========================================

const getDealInputSchema = z.object({
  dealId: z.string().min(1).describe('The unique ID of the pipeline deal.'),
});

const getDealOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  entityId: z.string(),
  stageId: z.string(),
  stageName: z.string(),
  value: z.number(),
  status: z.string(),
  createdAt: z.string(),
  ownerId: z.string().optional(),
  assignedTo: z.string().optional(),
  createdBy: z.string().optional(),
});

export const dealGetTool: McpToolDefinition<
  z.infer<typeof getDealInputSchema>,
  z.infer<typeof getDealOutputSchema>
> = {
  name: 'deal.get',
  version: '1.0.0',
  category: 'deal',
  description: 'Retrieves current commercial pipeline status, value, and stage for a specific deal.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: getDealInputSchema,
  responseSchema: getDealOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;

    // Fetch workspace to determine visibility restrictions (fail-closed default)
    let isDealsRestricted = true;
    try {
      const wsSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
      if (wsSnap.exists) {
        isDealsRestricted = wsSnap.data()?.restrictDealsVisibilityToAssigned !== false;
      }
    } catch {
      // In offline or testing mode without Firestore, keep fail-closed default
    }

    let isCallerAdmin = false;
    if (context.callerType === 'user') {
      try {
        const userSnap = await adminDb.collection('users').doc(context.callerId).get();
        if (userSnap.exists) {
          const userData = userSnap.data() as UserProfile | undefined;
          isCallerAdmin = isUserWorkspaceAdmin(userData || null, context.workspaceId);
        }
      } catch {
        // Fallback
      }
    } else {
      isCallerAdmin = true;
    }

    const enforceCallerFilter = !isCallerAdmin && isDealsRestricted;

    const result = await dealGetCapability.handler(
      {
        workspaceId: context.workspaceId,
        dealId: params.dealId,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['sales:pipeline:view', 'app:deals_view', 'deal:read'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(`[deal.get] ${result.error.message}`);
    }

    if (enforceCallerFilter) {
      const deal = result.data;
      const isAllowed =
        deal.assignedTo === context.callerId ||
        deal.ownerId === context.callerId ||
        deal.createdBy === context.callerId;
      if (!isAllowed) {
        throw new Error(`[deal.get] Deal "${params.dealId}" not found in workspace.`);
      }
    }

    return result.data;
  },
};

// ==========================================
// 2. deal.list (Read-Only)
// ==========================================

const listDealsInputSchema = z.object({
  stageId: z.string().optional().describe('Filter deals by pipeline stage ID.'),
  status: z.string().optional().describe('Filter deals by status.'),
  limit: z.number().int().min(1).max(50).optional().describe('Maximum deals to return (default 10).'),
});

const listDealsOutputSchema = z.object({
  totalFound: z.number(),
  deals: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      entityId: z.string(),
      stageId: z.string(),
      stageName: z.string(),
      value: z.number(),
      status: z.string(),
      createdAt: z.string(),
      ownerId: z.string().optional(),
      assignedTo: z.string().optional(),
      createdBy: z.string().optional(),
    })
  ),
});

export const dealListTool: McpToolDefinition<
  z.infer<typeof listDealsInputSchema>,
  z.infer<typeof listDealsOutputSchema>
> = {
  name: 'deal.list',
  version: '1.0.0',
  category: 'deal',
  description: 'Lists commercial pipeline deals within the workspace, optionally filtered by stage or status.',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: listDealsInputSchema,
  responseSchema: listDealsOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;

    let isDealsRestricted = true;
    try {
      const wsSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
      if (wsSnap.exists) {
        isDealsRestricted = wsSnap.data()?.restrictDealsVisibilityToAssigned !== false;
      }
    } catch {
      // offline fallback
    }

    let isCallerAdmin = false;
    if (context.callerType === 'user') {
      try {
        const userSnap = await adminDb.collection('users').doc(context.callerId).get();
        if (userSnap.exists) {
          const userData = userSnap.data() as UserProfile | undefined;
          isCallerAdmin = isUserWorkspaceAdmin(userData || null, context.workspaceId);
        }
      } catch {
        // fallback
      }
    } else {
      isCallerAdmin = true;
    }

    const enforceCallerFilter = !isCallerAdmin && isDealsRestricted;

    const result = await dealSearchCapability.handler(
      {
        workspaceId: context.workspaceId,
        stageId: params.stageId,
        status: params.status,
        limit: params.limit,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['sales:pipeline:view', 'app:deals_view', 'deal:read'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(`[deal.list] ${result.error.message}`);
    }

    let deals = result.data.deals;
    if (enforceCallerFilter) {
      deals = deals.filter(
        (d) =>
          d.assignedTo === context.callerId ||
          d.ownerId === context.callerId ||
          d.createdBy === context.callerId
      );
    }

    return {
      totalFound: deals.length,
      deals,
    };
  },
};

// ==========================================
// 3. deal.update_stage (High-Risk Mutation)
// ==========================================

const updateStageInputSchema = z.object({
  dealId: z.string().min(1).describe('The unique ID of the deal to advance.'),
  stageId: z.string().min(1).describe('The target stage ID in the pipeline.'),
  reason: z.string().optional().describe('Commercial justification for stage transition.'),
});

const updateStageOutputSchema = z.object({
  dealId: z.string(),
  stageId: z.string(),
  success: z.boolean(),
  updatedAt: z.string(),
});

export const dealUpdateStageTool: McpToolDefinition<
  z.infer<typeof updateStageInputSchema>,
  z.infer<typeof updateStageOutputSchema>
> = {
  name: 'deal.update_stage',
  version: '1.0.0',
  category: 'deal',
  description: 'Transitions a commercial deal to a new pipeline stage, verifying stage entry requirements.',
  riskLevel: 'high_risk',
  requiresApproval: true,
  parameters: updateStageInputSchema,
  responseSchema: updateStageOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;

    let isDealsRestricted = true;
    try {
      const wsSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
      if (wsSnap.exists) {
        isDealsRestricted = wsSnap.data()?.restrictDealsVisibilityToAssigned !== false;
      }
    } catch {
      // offline fallback
    }

    let isCallerAdmin = false;
    if (context.callerType === 'user') {
      try {
        const userSnap = await adminDb.collection('users').doc(context.callerId).get();
        if (userSnap.exists) {
          const userData = userSnap.data() as UserProfile | undefined;
          isCallerAdmin = isUserWorkspaceAdmin(userData || null, context.workspaceId);
        }
      } catch {
        // fallback
      }
    } else {
      isCallerAdmin = true;
    }

    const enforceCallerFilter = !isCallerAdmin && isDealsRestricted;

    if (enforceCallerFilter) {
      const existingDealRes = await dealGetCapability.handler(
        { workspaceId: context.workspaceId, dealId: params.dealId },
        {
          principal: {
            actorType: context.callerType === 'agent' ? 'agent' : 'user',
            userId: callerUserId,
            workspaceId: context.workspaceId,
            organizationId: context.organizationId,
            grantedScopes: ['sales:pipeline:view'],
            effectiveRole: 'mcp_caller',
          },
          correlationId: context.requestId,
          timestamp: context.timestamp,
        }
      );
      if (existingDealRes.success) {
        const d = existingDealRes.data;
        const isAllowed =
          d.assignedTo === context.callerId ||
          d.ownerId === context.callerId ||
          d.createdBy === context.callerId;
        if (!isAllowed) {
          throw new Error(`[deal.update_stage] Deal "${params.dealId}" not found in workspace.`);
        }
      }
    }

    const result = await dealAdvanceStageCapability.handler(
      {
        workspaceId: context.workspaceId,
        dealId: params.dealId,
        stageId: params.stageId,
        reason: params.reason,
      },
      {
        principal: {
          actorType: context.callerType === 'agent' ? 'agent' : 'user',
          userId: callerUserId,
          agentId: context.callerType === 'agent' ? context.callerId : undefined,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          grantedScopes: ['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update'],
          effectiveRole: 'mcp_caller',
        },
        correlationId: context.requestId,
        timestamp: context.timestamp,
      }
    );

    if (!result.success) {
      throw new Error(result.error.message || `Failed to transition deal ${params.dealId} to stage ${params.stageId}.`);
    }

    return {
      dealId: result.data.dealId,
      stageId: result.data.stageId,
      success: result.data.success,
      updatedAt: result.data.updatedAt,
    };
  },
};

// ==========================================
// 4. deal.transfer (High-Risk Mutation / Cross-Workspace)
// ==========================================

const transferDealInputSchema = z.object({
  dealId: z.string().min(1).describe('The unique ID of the deal to transfer or duplicate.'),
  mode: z.enum(['move', 'copy']).describe('Whether to move the deal or duplicate it.'),
  targetWorkspaceId: z.string().min(1).describe('Destination workspace ID.'),
  targetPipelineId: z.string().min(1).describe('Destination pipeline ID.'),
  targetStageId: z.string().min(1).describe('Destination stage ID in the target pipeline.'),
  targetUserId: z.string().nullable().optional().describe('Target assignee user ID (must belong to target workspace).'),
  newName: z.string().optional().describe('New deal name (used when mode === copy).'),
  summary: z.string().optional().describe('Commercial or operational note for transfer.'),
  copyLineItems: z.boolean().optional(),
  copyContacts: z.boolean().optional(),
  copyCustomFields: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional().describe('TOCTOU optimistic concurrency timestamp.'),
  idempotencyKey: z.string().optional().describe('Unique token for replay protection.'),
});

const transferDealOutputSchema = z.object({
  dealId: z.string(),
  mode: z.enum(['move', 'copy']),
  targetWorkspaceId: z.string(),
  targetPipelineId: z.string(),
  targetStageId: z.string(),
  success: z.boolean(),
  updatedAt: z.string(),
});

export const dealTransferTool: McpToolDefinition<
  z.infer<typeof transferDealInputSchema>,
  z.infer<typeof transferDealOutputSchema>
> = {
  name: 'deal.transfer',
  version: '1.0.0',
  category: 'deal',
  description: 'Transfers or duplicates a commercial deal across workspaces, pipelines, and stages with entity projection and idempotency protection.',
  riskLevel: 'low_risk',
  requiresApproval: false,
  parameters: transferDealInputSchema,
  responseSchema: transferDealOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : context.callerId;
    const actor: CrmActor = context.callerType === 'agent'
      ? {
          kind: 'service',
          service: 'api',
          workspaceId: context.workspaceId,
          allowedWorkspaceIds: [context.workspaceId, params.targetWorkspaceId],
          onBehalfOf: callerUserId,
          agentId: context.callerId,
          toolInvocationId: context.requestId,
        }
      : { kind: 'user', uid: context.callerId };

    const result = await transferDealCore(actor, {
      dealId: params.dealId,
      mode: params.mode,
      sourceWorkspaceId: context.workspaceId,
      targetWorkspaceId: params.targetWorkspaceId,
      targetPipelineId: params.targetPipelineId,
      targetStageId: params.targetStageId,
      assignedTo: params.targetUserId !== undefined
        ? (params.targetUserId ? { userId: params.targetUserId, name: null, email: null } : null)
        : undefined,
      newName: params.newName,
      summary: params.summary,
      copyLineItems: params.copyLineItems,
      copyContacts: params.copyContacts,
      copyCustomFields: params.copyCustomFields,
      expectedUpdatedAt: params.expectedUpdatedAt,
      idempotencyKey: params.idempotencyKey,
    });

    if (!result.success || !result.dealId) {
      throw new Error(`[deal.transfer] ${result.error || 'Failed to transfer deal'}`);
    }

    return {
      dealId: result.dealId,
      mode: params.mode,
      targetWorkspaceId: params.targetWorkspaceId,
      targetPipelineId: params.targetPipelineId,
      targetStageId: params.targetStageId,
      success: true,
      updatedAt: new Date().toISOString(),
    };
  },
};

// In-place upgrade of canonical capability definitions into unified registry (Decision D1 / Rule 69)
registerCapability(dealGetCapability, { allowOverride: true });
registerCapability(dealSearchCapability, { allowOverride: true });
registerCapability(dealAdvanceStageCapability, { allowOverride: true });
registerCapability(dealTransferCapability, { allowOverride: true });
