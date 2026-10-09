/**
 * @fileOverview Unit tests for Messaging Dashboard Zod schemas & domain types.
 * Enforces SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 13: Trust Boundary Matrix schema enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  MessagingChannelSchema,
  ProviderHealthStatusSchema,
  MessagingDashboardTimeRangeSchema,
  MessagingKpiMetricsSchema,
  PerformanceChartDataSchema,
  ChannelBreakdownItemSchema,
  RecentCampaignItemSchema,
  ActiveQueueStatsSchema,
  InboxThreadPreviewItemSchema,
  MessagingDashboardSummarySchema,
  calculateTrendDeltaPercentage,
  type MessagingDashboardSummary,
} from '../messaging-dashboard';

describe('Messaging Dashboard Zod Schemas & Domain Models', () => {
  it('validates supported messaging channels and rejects unsupported channels', () => {
    expect(MessagingChannelSchema.parse('sms')).toBe('sms');
    expect(MessagingChannelSchema.parse('whatsapp')).toBe('whatsapp');
    expect(MessagingChannelSchema.parse('email')).toBe('email');
    expect(MessagingChannelSchema.parse('in_app')).toBe('in_app');

    expect(() => MessagingChannelSchema.parse('telegram')).toThrow();
    expect(() => MessagingChannelSchema.parse('')).toThrow();
  });

  it('validates provider health statuses', () => {
    expect(ProviderHealthStatusSchema.parse('healthy')).toBe('healthy');
    expect(ProviderHealthStatusSchema.parse('degraded')).toBe('degraded');
    expect(ProviderHealthStatusSchema.parse('error')).toBe('error');
    expect(() => ProviderHealthStatusSchema.parse('offline')).toThrow();
  });

  it('validates time range options and defaults to 7d', () => {
    expect(MessagingDashboardTimeRangeSchema.parse('24h')).toBe('24h');
    expect(MessagingDashboardTimeRangeSchema.parse('7d')).toBe('7d');
    expect(MessagingDashboardTimeRangeSchema.parse('30d')).toBe('30d');
    expect(MessagingDashboardTimeRangeSchema.parse(undefined)).toBe('7d');
    expect(() => MessagingDashboardTimeRangeSchema.parse('90d')).toThrow();
  });

  it('validates KPI metrics with valid data and rejects invalid numbers', () => {
    const validKpi = {
      messagesSent: 12482,
      messagesSentDeltaPercentage: 24,
      deliveryRate: 99.7,
      deliveryRateDeltaPercentage: 1.2,
      smsBalance: 941,
      providerStatus: 'healthy',
      providerStatusLabel: 'All Systems Active',
    };

    const parsed = MessagingKpiMetricsSchema.parse(validKpi);
    expect(parsed.messagesSent).toBe(12482);
    expect(parsed.deliveryRate).toBe(99.7);
    expect(parsed.smsBalance).toBe(941);

    // Negative messagesSent should fail
    expect(() =>
      MessagingKpiMetricsSchema.parse({
        ...validKpi,
        messagesSent: -10,
      })
    ).toThrow();

    // Delivery rate > 100 should fail
    expect(() =>
      MessagingKpiMetricsSchema.parse({
        ...validKpi,
        deliveryRate: 105,
      })
    ).toThrow();
  });

  it('validates performance chart data and rejects out-of-range delivery rates', () => {
    const validPerf = {
      sentCount: 12482,
      deliveredCount: 12446,
      failedCount: 36,
      deliveryRatePercentage: 99.7,
      timeRangeLabel: 'Last 7 days',
    };

    const parsed = PerformanceChartDataSchema.parse(validPerf);
    expect(parsed.sentCount).toBe(12482);
    expect(parsed.deliveredCount).toBe(12446);
    expect(parsed.failedCount).toBe(36);

    expect(() =>
      PerformanceChartDataSchema.parse({
        ...validPerf,
        deliveryRatePercentage: -5,
      })
    ).toThrow();
  });

  it('validates channel breakdown item', () => {
    const validItem = {
      channel: 'sms',
      label: 'SMS',
      count: 6500,
      percentage: 52,
      color: '#3B82F6',
    };

    const parsed = ChannelBreakdownItemSchema.parse(validItem);
    expect(parsed.channel).toBe('sms');
    expect(parsed.percentage).toBe(52);

    expect(() =>
      ChannelBreakdownItemSchema.parse({
        ...validItem,
        percentage: 150,
      })
    ).toThrow();
  });

  it('validates recent campaign item with optional clickRate', () => {
    const campaignWithClick = {
      id: 'camp-123',
      name: 'Back to School 2025',
      status: 'active',
      recipientCount: 2450,
      sentAt: '2026-10-07T12:00:00.000Z',
      deliveryRate: 98.4,
      clickRate: 4.2,
    };

    const parsed = RecentCampaignItemSchema.parse(campaignWithClick);
    expect(parsed.id).toBe('camp-123');
    expect(parsed.clickRate).toBe(4.2);

    const campaignWithoutClick = {
      id: 'camp-456',
      name: 'Fee Reminder',
      status: 'completed',
      recipientCount: 1230,
      sentAt: '2026-10-04T12:00:00.000Z',
      deliveryRate: 97.8,
    };

    const parsedNoClick = RecentCampaignItemSchema.parse(campaignWithoutClick);
    expect(parsedNoClick.clickRate).toBeUndefined();
  });

  it('validates active queue stats', () => {
    const validQueue = {
      scheduledCount: 24,
      pendingApprovalCount: 3,
      failedCount: 2,
    };

    const parsed = ActiveQueueStatsSchema.parse(validQueue);
    expect(parsed.scheduledCount).toBe(24);
    expect(parsed.pendingApprovalCount).toBe(3);
    expect(parsed.failedCount).toBe(2);

    expect(() =>
      ActiveQueueStatsSchema.parse({
        ...validQueue,
        scheduledCount: -1,
      })
    ).toThrow();
  });

  it('validates inbox thread preview items', () => {
    const thread = {
      threadId: 'thread-001',
      entityId: 'entity-123',
      entityName: 'Parents - Grade 5',
      lastMessageSnippet: 'Good day dear parents, school will reopen...',
      lastMessageChannel: 'whatsapp',
      lastMessageTimestamp: '2026-10-09T02:00:00.000Z',
      unreadCount: 24,
      isGroup: true,
    };

    const parsed = InboxThreadPreviewItemSchema.parse(thread);
    expect(parsed.entityName).toBe('Parents - Grade 5');
    expect(parsed.isGroup).toBe(true);
    expect(parsed.lastMessageChannel).toBe('whatsapp');
  });

  it('validates the complete unified MessagingDashboardSummary schema', () => {
    const summary: MessagingDashboardSummary = {
      version: 1,
      organizationId: 'org-test-123',
      workspaceId: 'ws-test-456',
      calculatedAt: '2026-10-09T03:00:00.000Z',
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
        deliveredCount: 12446,
        failedCount: 36,
        deliveryRatePercentage: 99.7,
        timeRangeLabel: 'Last 7 days',
      },
      channelBreakdown: [
        { channel: 'sms', label: 'SMS', count: 6490, percentage: 52, color: '#3B82F6' },
        { channel: 'whatsapp', label: 'WhatsApp', count: 3495, percentage: 28, color: '#10B981' },
        { channel: 'email', label: 'Email', count: 1498, percentage: 12, color: '#8B5CF6' },
        { channel: 'in_app', label: 'In-App', count: 999, percentage: 8, color: '#F59E0B' },
      ],
      recentCampaigns: [
        {
          id: 'camp-1',
          name: 'Back to School 2025',
          status: 'active',
          recipientCount: 2450,
          sentAt: '2026-10-07T12:00:00.000Z',
          deliveryRate: 98.4,
          clickRate: 4.2,
        },
      ],
      activeQueues: {
        scheduledCount: 24,
        pendingApprovalCount: 3,
        failedCount: 2,
      },
      inboxPreview: [
        {
          threadId: 't-1',
          entityId: 'e-1',
          entityName: 'Parents - Grade 5',
          lastMessageSnippet: 'Good day dear parents...',
          lastMessageChannel: 'whatsapp',
          lastMessageTimestamp: '2026-10-09T02:00:00.000Z',
          unreadCount: 24,
          isGroup: true,
          isDirect: false,
        },
      ],
    };

    const parsed = MessagingDashboardSummarySchema.parse(summary);
    expect(parsed.organizationId).toBe('org-test-123');
    expect(parsed.kpi.messagesSent).toBe(12482);
    expect(parsed.channelBreakdown).toHaveLength(4);
    expect(parsed.recentCampaigns).toHaveLength(1);
    expect(parsed.activeQueues.scheduledCount).toBe(24);
  });

  describe('calculateTrendDeltaPercentage helper', () => {
    it('calculates standard positive and negative trend percentages rounded to 1 decimal', () => {
      expect(calculateTrendDeltaPercentage(125, 100)).toBe(25);
      expect(calculateTrendDeltaPercentage(75, 100)).toBe(-25);
      expect(calculateTrendDeltaPercentage(12482, 10066)).toBe(24);
    });

    it('safely handles zero in previous period without divide-by-zero, NaN or Infinity', () => {
      expect(calculateTrendDeltaPercentage(50, 0)).toBe(100);
      expect(calculateTrendDeltaPercentage(0, 0)).toBe(0);
      expect(calculateTrendDeltaPercentage(0, 50)).toBe(-100);
    });
  });
});
