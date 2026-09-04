/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed Deal MCP Tools
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Deal State:
 *    - Delegates stage progression to `updateDealStageAction` (validating entry gates).
 * 2. Risk Tier:
 *    - `deal.get`: read_only (Zero mutation).
 *    - `deal.update_stage`: high_risk (Commercial stage mutation; requires human approval).
 * 3. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses Zod schemas and recursive `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { z } from 'zod';
import { McpToolDefinition } from '../types';
import { adminDb } from '@/lib/firebase-admin';
import { updateDealStageAction } from '@/app/actions/deal-actions';

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
    const docSnap = await adminDb.collection('deals').doc(params.dealId).get();
    if (!docSnap.exists) {
      throw new Error(`[deal.get] Deal "${params.dealId}" not found.`);
    }

    const data = docSnap.data();
    if (data?.workspaceId && data.workspaceId !== context.workspaceId) {
      throw new Error(`[deal.get] Access denied: deal belongs to another workspace.`);
    }

    return {
      id: docSnap.id,
      name: data?.name || 'Untitled Deal',
      entityId: data?.entityId || '',
      stageId: data?.stageId || '',
      stageName: data?.stageName || data?.stageId || 'Unknown Stage',
      value: typeof data?.value === 'number' ? data.value : 0,
      status: data?.status || 'open',
      createdAt: data?.createdAt || new Date().toISOString(),
    };
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
    const result = await updateDealStageAction(params.dealId, params.stageId, {
      userId: context.callerId,
      reason: params.reason,
    });

    if (!result.success) {
      throw new Error(result.error || `Failed to transition deal ${params.dealId} to stage ${params.stageId}.`);
    }

    return {
      dealId: params.dealId,
      stageId: params.stageId,
      success: true,
      updatedAt: new Date().toISOString(),
    };
  },
};
