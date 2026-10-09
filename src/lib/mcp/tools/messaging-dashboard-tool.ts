/**
 * @fileOverview Governed MCP Tool: messaging.get_dashboard_summary
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 11: MCP Protocol Compliance (stateless multi-round-trip).
 * - Rule 12: Server-side risk enforcement (read_only).
 * - Rule 13: Trust Boundary Matrix (separates system context from caller arguments).
 * - Rule 14: Tool poisoning defense (exact 64-char hex schemaHash).
 * - Rule 17: Non-delegable privileges (read_only telemetry only).
 * - Rule 18: Fail-closed multi-tenancy verification.
 * - Rule 24 & Rule 25: Exposes provider status and dead-letter failed count.
 */

import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';

const getDashboardSummaryInputSchema = z.object({
  forceRefresh: z.boolean().optional().default(false).describe('Bypass in-memory cache to re-aggregate live metrics'),
});

const getDashboardSummaryOutputSchema = z.object({
  success: z.boolean(),
  kpi: z.object({
    messagesSent: z.number().int().nonnegative(),
    messagesSentDeltaPercentage: z.number(),
    deliveryRate: z.number(),
    deliveryRateDeltaPercentage: z.number(),
    smsBalance: z.number().nonnegative(),
    providerStatus: z.string(),
    providerStatusLabel: z.string(),
  }),
  performance: z.object({
    sentCount: z.number().int().nonnegative(),
    deliveredCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    deliveryRatePercentage: z.number(),
    timeRangeLabel: z.string(),
  }),
  activeQueues: z.object({
    scheduledCount: z.number().int().nonnegative(),
    pendingApprovalCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  }),
});

export const messagingGetDashboardSummaryTool: McpToolDefinition<
  z.infer<typeof getDashboardSummaryInputSchema>,
  z.infer<typeof getDashboardSummaryOutputSchema>
> = {
  name: 'messaging.get_dashboard_summary',
  description:
    'Retrieves the multi-tenant communications hub summary including message volume, trend deltas, delivery SLA rate, SMS credit balance, and dead-letter/pending queue counts for a workspace.',
  version: '1.0.0',
  schemaHash: '7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
  riskLevel: 'read_only',
  category: 'campaign',
  requiresApproval: false,
  parameters: getDashboardSummaryInputSchema,
  responseSchema: getDashboardSummaryOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    const res = await getMessagingDashboardSummaryAction({
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      forceRefresh: params.forceRefresh,
    });

    if (!res.success) {
      throw new Error(`Failed to retrieve dashboard summary: ${res.error}`);
    }

    return {
      success: true,
      kpi: {
        messagesSent: res.data.kpi.messagesSent,
        messagesSentDeltaPercentage: res.data.kpi.messagesSentDeltaPercentage,
        deliveryRate: res.data.kpi.deliveryRate,
        deliveryRateDeltaPercentage: res.data.kpi.deliveryRateDeltaPercentage,
        smsBalance: res.data.kpi.smsBalance,
        providerStatus: res.data.kpi.providerStatus,
        providerStatusLabel: res.data.kpi.providerStatusLabel,
      },
      performance: {
        sentCount: res.data.performance.sentCount,
        deliveredCount: res.data.performance.deliveredCount,
        failedCount: res.data.performance.failedCount,
        deliveryRatePercentage: res.data.performance.deliveryRatePercentage,
        timeRangeLabel: res.data.performance.timeRangeLabel,
      },
      activeQueues: {
        scheduledCount: res.data.activeQueues.scheduledCount,
        pendingApprovalCount: res.data.activeQueues.pendingApprovalCount,
        failedCount: res.data.activeQueues.failedCount,
      },
    };
  },
};
