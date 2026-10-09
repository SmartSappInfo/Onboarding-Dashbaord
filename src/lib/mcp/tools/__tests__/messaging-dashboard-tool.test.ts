import { describe, it, expect, vi } from 'vitest';
import { messagingGetDashboardSummaryTool } from '../messaging-dashboard-tool';
import type { McpExecutionContext } from '../../types';

vi.mock('@/app/actions/messaging-dashboard-actions', () => ({
  getMessagingDashboardSummaryAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      kpi: {
        messagesSent: 12482,
        messagesSentDeltaPercentage: 24,
        deliveryRate: 99.7,
        deliveryRateDeltaPercentage: 1.2,
        smsBalance: 941,
        providerStatus: 'healthy',
        providerStatusLabel: 'All Systems Active',
      },
      performance: {
        sentCount: 12482,
        deliveredCount: 12444,
        failedCount: 38,
        deliveryRatePercentage: 99.7,
        timeRangeLabel: 'Last 7 days',
      },
      channelBreakdown: [],
      recentCampaigns: [],
      activeQueues: { scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 },
      inboxPreview: [],
    },
  }),
}));

describe('messagingGetDashboardSummaryTool', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    callerId: 'agent_007',
    callerType: 'agent',
    requestId: 'req_123',
    callDepth: 1,
    timestamp: '2026-10-09T08:00:00Z',
  };

  it('declares read_only risk tier, campaign category, and exact 64-char schemaHash', () => {
    expect(messagingGetDashboardSummaryTool.riskLevel).toBe('read_only');
    expect(messagingGetDashboardSummaryTool.category).toBe('campaign');
    expect(messagingGetDashboardSummaryTool.name).toBe('messaging.get_dashboard_summary');
    expect(messagingGetDashboardSummaryTool.requiresApproval).toBe(false);
    expect(messagingGetDashboardSummaryTool.schemaHash).toHaveLength(64);
    expect(messagingGetDashboardSummaryTool.schemaHash).toBe(
      '7f9b8c2d1e0a4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b'
    );
  });

  it('executes successfully and returns summary telemetry', async () => {
    const res = await messagingGetDashboardSummaryTool.handler(
      { forceRefresh: false },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.kpi.messagesSent).toBe(12482);
    expect(res.kpi.deliveryRate).toBe(99.7);
    expect(res.activeQueues.failedCount).toBe(2);
  });

  it('enforces fail-closed multi-tenancy if context is missing workspaceId or organizationId (Rule 18)', async () => {
    await expect(
      messagingGetDashboardSummaryTool.handler(
        { forceRefresh: false },
        { ...mockContext, workspaceId: '' }
      )
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
