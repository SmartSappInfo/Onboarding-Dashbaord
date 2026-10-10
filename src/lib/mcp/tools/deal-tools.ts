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
import { McpToolDefinition, McpExecutionContext } from '../types';
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
import {
  generateCadencePreview,
  executeCadenceSchedule,
} from '@/lib/deals/deal-task-cadence-core';
import { PersonService } from '@/lib/services/identity/person-service';
import type { Deal, DealTaskCadenceConfig } from '@/lib/deals/deal-types';
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
  entityConversionStrategy: z
    .enum([
      'auto',
      'promote_primary_focal_contact',
      'promote_first_contact',
      'derive_from_company_field',
      'promote_primary_as_guardian',
      'require_human_approval',
    ])
    .optional()
    .describe('Polymorphic entity conversion strategy across workspace scopes (Rule 61 & 69).'),
  focalContactId: z.string().optional().describe('Explicit focal contact ID to promote to a Person entity.'),
  dryRun: z.boolean().optional().describe('Shadow Mode: dry run simulation without DB write (Rule 42).'),
  approvalId: z.string().optional().describe('Approval token for committing Two-Phase proposals (Rule 21 & 22).'),
});

const transferDealOutputSchema = z.object({
  dealId: z.string(),
  mode: z.enum(['move', 'copy']),
  targetWorkspaceId: z.string(),
  targetPipelineId: z.string(),
  targetStageId: z.string(),
  success: z.boolean(),
  phase: z.enum(['COMMITTED', 'PROPOSAL']).optional(),
  requiresProposal: z.boolean().optional(),
  approvalId: z.string().optional(),
  entityResolution: z
    .object({
      sourceEntityId: z.string(),
      targetEntityId: z.string(),
      sourceScope: z.string(),
      targetScope: z.string(),
      strategyUsed: z.string(),
      wasCreated: z.boolean(),
      promotedContactId: z.string().optional(),
      auditEvidence: z.string(),
    })
    .optional(),
  updatedAt: z.string(),
});

async function executeDealTransfer(
  params: z.infer<typeof transferDealInputSchema>,
  context: McpExecutionContext
): Promise<z.infer<typeof transferDealOutputSchema>> {
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
    entityConversionStrategy: params.entityConversionStrategy,
    focalContactId: params.focalContactId,
    dryRun: params.dryRun,
    approvalId: params.approvalId,
  });

  if (!result.success || (!result.dealId && result.phase !== 'PROPOSAL')) {
    throw new Error(`[deal.transfer] ${result.error || 'Failed to transfer deal'}`);
  }

  return {
    dealId: result.dealId || params.dealId,
    mode: params.mode,
    targetWorkspaceId: params.targetWorkspaceId,
    targetPipelineId: params.targetPipelineId,
    targetStageId: params.targetStageId,
    success: true,
    phase: result.phase || 'COMMITTED',
    requiresProposal: result.requiresProposal,
    approvalId: result.approvalId,
    entityResolution: result.entityResolution,
    updatedAt: new Date().toISOString(),
  };
}

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
    return executeDealTransfer(params, context);
  },
};

export const dealPreviewTransferTool: McpToolDefinition<
  z.infer<typeof transferDealInputSchema>,
  z.infer<typeof transferDealOutputSchema>
> = {
  name: 'deal.preview_transfer',
  version: '1.0.0',
  category: 'deal',
  description: 'Simulates and previews a deal transfer/cloning operation across workspaces, returning placement checks, assignee access, and polymorphic entity conversion proposals without mutating database state (Rule 21 & 42).',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: transferDealInputSchema,
  responseSchema: transferDealOutputSchema,
  handler: async (params, context) => {
    return executeDealTransfer({ ...params, dryRun: true }, context);
  },
};

// ==========================================
// 6. deal.preview_task_cadence (Read-Only)
// ==========================================

const dealCadenceInputSchema = z.object({
  dealIds: z.array(z.string().min(1)).min(1).describe('Array of deal IDs in current workspace to schedule follow-ups for.'),
  actionType: z.enum(['call', 'email', 'meeting', 'review', 'custom']).describe('Channel or type of task to create.'),
  taskTitle: z.string().min(1).describe('Title prefix or template for the generated tasks.'),
  taskDescription: z.string().optional().describe('Actionable task description, context, or call script.'),
  taskPriority: z.enum(['low', 'medium', 'high', 'urgent']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Target start date in YYYY-MM-DD format.'),
  maxFrequencyPerDay: z.number().int().min(1).max(50).describe('Maximum follow-up tasks assigned per day per representative.'),
  intervalMinutes: z.number().int().min(10).max(240).describe('Pacing interval in minutes between intra-day slots.'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).describe('Daily cadence schedule start time (HH:mm).'),
  skipWeekends: z.boolean().describe('Whether to skip Saturdays and Sundays.'),
  assigneeMode: z.enum(['single', 'round_robin', 'ai_balanced']),
  targetAssigneeIds: z.array(z.string().min(1)).min(1).describe('Target team representative user IDs who will receive the assigned deals and tasks.'),
  idempotencyKey: z.string().optional().describe('Idempotency token for repeatable execution.'),
});

const dealCadencePreviewOutputSchema = z.object({
  workspaceId: z.string(),
  totalDeals: z.number(),
  totalPipelineValue: z.number(),
  totalDaysSpanned: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  slotsCount: z.number(),
  daySummaries: z.array(
    z.object({
      date: z.string(),
      dayNumber: z.number(),
      taskCount: z.number(),
      deals: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          assigneeName: z.string(),
          time: z.string(),
        })
      ),
    })
  ),
});

export const dealPreviewTaskCadenceTool: McpToolDefinition<
  z.infer<typeof dealCadenceInputSchema>,
  z.infer<typeof dealCadencePreviewOutputSchema>
> = {
  name: 'deal.preview_task_cadence',
  version: '1.0.0',
  category: 'deal',
  description: 'Simulates and previews an intelligent task cadence schedule and representative assignment without mutating database state (Two-Phase Action Model).',
  riskLevel: 'read_only',
  requiresApproval: false,
  parameters: dealCadenceInputSchema,
  responseSchema: dealCadencePreviewOutputSchema,
  handler: async (params, context) => {
    const dealsSnap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', context.workspaceId)
      .get();

    const dealMap = new Map<string, Deal>();
    for (const doc of dealsSnap.docs) {
      dealMap.set(doc.id, { id: doc.id, ...doc.data() } as Deal);
    }

    const targetedDeals: Deal[] = [];
    for (const id of params.dealIds) {
      const d = dealMap.get(id);
      if (d) targetedDeals.push(d);
    }

    if (targetedDeals.length === 0) {
      throw new Error('None of the specified deals exist within the active workspace.');
    }

    const assignees = [];
    for (const repId of params.targetAssigneeIds) {
      const person = await PersonService.getPerson(repId);
      if (person) {
        assignees.push({
          id: person.id,
          name: person.displayName || person.email || repId,
          email: person.email,
        });
      } else {
        assignees.push({ id: repId, name: repId });
      }
    }

    const config: DealTaskCadenceConfig = {
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      dealIds: params.dealIds,
      actionType: params.actionType,
      taskTitle: params.taskTitle,
      taskDescription: params.taskDescription,
      taskPriority: params.taskPriority,
      startDate: params.startDate,
      maxFrequencyPerDay: params.maxFrequencyPerDay,
      intervalMinutes: params.intervalMinutes,
      startTime: params.startTime,
      skipWeekends: params.skipWeekends,
      assigneeMode: params.assigneeMode,
      targetAssigneeIds: params.targetAssigneeIds,
      idempotencyKey: params.idempotencyKey,
    };

    const preview = generateCadencePreview(targetedDeals, config, assignees);
    return {
      workspaceId: preview.workspaceId,
      totalDeals: preview.totalDeals,
      totalPipelineValue: preview.totalPipelineValue,
      totalDaysSpanned: preview.totalDaysSpanned,
      startDate: preview.startDate,
      endDate: preview.endDate,
      slotsCount: preview.slots.length,
      daySummaries: preview.daySummaries,
    };
  },
};

// ==========================================
// 7. deal.execute_task_cadence (Low-Risk Mutation)
// ==========================================

const dealCadenceExecuteOutputSchema = z.object({
  jobId: z.string(),
  workspaceId: z.string(),
  totalDealsProcessed: z.number(),
  tasksCreatedCount: z.number(),
  dealsUpdatedCount: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  executedAt: z.string(),
  status: z.string(),
  errors: z.array(z.string()).optional(),
});

export const dealExecuteTaskCadenceTool: McpToolDefinition<
  z.infer<typeof dealCadenceInputSchema>,
  z.infer<typeof dealCadenceExecuteOutputSchema>
> = {
  name: 'deal.execute_task_cadence',
  version: '1.0.0',
  category: 'deal',
  description: 'Executes an automated deal task cadence: assigns designated representatives to deals and creates paced tasks within specified daily frequencies and intervals.',
  riskLevel: 'low_risk',
  requiresApproval: false,
  parameters: dealCadenceInputSchema,
  responseSchema: dealCadenceExecuteOutputSchema,
  handler: async (params, context) => {
    const callerUserId = context.callerType === 'agent' ? `system-${context.callerId}` : (context.userId || context.callerId);

    const config: DealTaskCadenceConfig = {
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      dealIds: params.dealIds,
      actionType: params.actionType,
      taskTitle: params.taskTitle,
      taskDescription: params.taskDescription,
      taskPriority: params.taskPriority,
      startDate: params.startDate,
      maxFrequencyPerDay: params.maxFrequencyPerDay,
      intervalMinutes: params.intervalMinutes,
      startTime: params.startTime,
      skipWeekends: params.skipWeekends,
      assigneeMode: params.assigneeMode,
      targetAssigneeIds: params.targetAssigneeIds,
      idempotencyKey: params.idempotencyKey,
    };

    const result = await executeCadenceSchedule(config, callerUserId);
    return {
      jobId: result.jobId,
      workspaceId: result.workspaceId,
      totalDealsProcessed: result.totalDealsProcessed,
      tasksCreatedCount: result.tasksCreatedCount,
      dealsUpdatedCount: result.dealsUpdatedCount,
      startDate: result.startDate,
      endDate: result.endDate,
      executedAt: result.executedAt,
      status: result.status,
      errors: result.errors,
    };
  },
};

// In-place upgrade of canonical capability definitions into unified registry (Decision D1 / Rule 69)
registerCapability(dealGetCapability, { allowOverride: true });
registerCapability(dealSearchCapability, { allowOverride: true });
registerCapability(dealAdvanceStageCapability, { allowOverride: true });
registerCapability(dealTransferCapability, { allowOverride: true });
