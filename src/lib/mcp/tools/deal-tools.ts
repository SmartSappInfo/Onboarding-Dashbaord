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
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import {
  dealGetCapability,
  dealAdvanceStageCapability,
} from '@/platform/domains/deals_revenue/contracts/deal-capabilities.contract';

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

    return result.data;
  },
};

// ==========================================
// 2. deal.update_stage (High-Risk Mutation)
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

// In-place upgrade of canonical capability definitions into unified registry (Decision D1 / Rule 69)
registerCapability(dealGetCapability, { allowOverride: true });
registerCapability(dealAdvanceStageCapability, { allowOverride: true });
