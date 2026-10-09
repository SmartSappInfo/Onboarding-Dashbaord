/**
 * @fileOverview Unit & integration tests for the Messaging Dashboard Multi-Tenant Aggregator Action.
 *
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any.
 * - Rule 8 & Rule 18: Fail-closed multi-tenancy & session checks.
 * - Rule 9: High-load protection via in-memory TTL caching.
 * - Rule 21: Graceful degradation on provider failure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { subDays, formatISO } from 'date-fns';

// Mock dependencies
const mockRequireWorkspace = vi.fn();
const mockFetchSmsBalanceAction = vi.fn();
const mockGetWhatsAppPublic = vi.fn();

vi.mock('@/lib/auth/require-auth', () => {
  class UnauthorizedError extends Error {
    readonly status = 401;
    constructor(msg = 'Not signed in.') {
      super(msg);
      this.name = 'UnauthorizedError';
    }
  }
  class ForbiddenError extends Error {
    readonly status = 403;
    constructor(msg = 'Not permitted.') {
      super(msg);
      this.name = 'ForbiddenError';
    }
  }
  return {
    UnauthorizedError,
    ForbiddenError,
    requireWorkspace: (...args: unknown[]) => mockRequireWorkspace(...args),
  };
});

vi.mock('@/lib/mnotify-actions', () => ({
  fetchSmsBalanceAction: (...args: unknown[]) => mockFetchSmsBalanceAction(...args),
}));

vi.mock('@/lib/whatsapp/whatsapp-credential-repository', () => ({
  WhatsAppCredentialRepository: {
    getPublic: (...args: unknown[]) => mockGetWhatsAppPublic(...args),
  },
}));

// In-memory mock Firestore data store for unit tests
interface MockDocData {
  id: string;
  [key: string]: unknown;
}

let mockMessageLogs: MockDocData[] = [];
let mockMessageCampaigns: MockDocData[] = [];
let mockScheduledMessages: MockDocData[] = [];

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(async () => {
        if (colName === 'message_logs') {
          return {
            docs: mockMessageLogs.map((d) => ({
              id: d.id,
              data: () => d,
            })),
            empty: mockMessageLogs.length === 0,
          };
        }
        if (colName === 'message_campaigns') {
          return {
            docs: mockMessageCampaigns.map((d) => ({
              id: d.id,
              data: () => d,
            })),
            empty: mockMessageCampaigns.length === 0,
          };
        }
        if (colName === 'scheduled_messages') {
          return {
            docs: mockScheduledMessages.map((d) => ({
              id: d.id,
              data: () => d,
            })),
            empty: mockScheduledMessages.length === 0,
          };
        }
        return { docs: [], empty: true };
      }),
    }),
  },
}));

import {
  getMessagingDashboardSummaryAction,
  clearDashboardSummaryCacheForTests,
} from '../messaging-dashboard-actions';
import { UnauthorizedError } from '@/lib/auth/require-auth';

describe('getMessagingDashboardSummaryAction', () => {
  const orgId = 'org-testing-123';
  const wsId = 'ws-testing-456';

  beforeEach(() => {
    vi.clearAllMocks();
    clearDashboardSummaryCacheForTests();

    // Default authorized context
    mockRequireWorkspace.mockResolvedValue({
      uid: 'user-agent-007',
      isSystemAdmin: false,
      profile: {
        id: 'user-agent-007',
        organizationId: orgId,
        workspaceIds: [wsId],
      },
    });

    mockFetchSmsBalanceAction.mockResolvedValue({
      success: true,
      balance: 850,
    });

    mockGetWhatsAppPublic.mockResolvedValue({
      status: 'connected',
      displayPhoneNumber: '+233244123456',
    });

    mockMessageLogs = [];
    mockMessageCampaigns = [];
    mockScheduledMessages = [];
  });

  it('rejects unauthenticated callers with 401 Unauthorized', async () => {
    mockRequireWorkspace.mockRejectedValue(new UnauthorizedError('Not signed in.'));

    const result = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Not signed in.');
    }
  });

  it('rejects callers attempting cross-tenant access to another organization', async () => {
    mockRequireWorkspace.mockResolvedValue({
      uid: 'user-agent-007',
      isSystemAdmin: false,
      profile: {
        id: 'user-agent-007',
        organizationId: 'other-alien-org',
        workspaceIds: [wsId],
      },
    });

    const result = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('No access to this organization');
    }
  });

  it('aggregates 7-day KPIs, delivery rates, and channel breakdowns correctly', async () => {
    const now = new Date();
    const twoDaysAgo = formatISO(subDays(now, 2));
    const tenDaysAgo = formatISO(subDays(now, 10));

    // Populate mock logs
    mockMessageLogs = [
      // Current 7-day window (2 SMS sent, 1 WhatsApp sent, 1 Email failed)
      {
        id: 'log-1',
        organizationId: orgId,
        workspaceIds: [wsId],
        channel: 'sms',
        status: 'sent',
        sentAt: twoDaysAgo,
        recipient: '+233240000001',
        displayName: 'Kofi Mensah',
        body: 'Reminder for meeting',
      },
      {
        id: 'log-2',
        organizationId: orgId,
        workspaceIds: [wsId],
        channel: 'sms',
        status: 'sent',
        sentAt: twoDaysAgo,
        recipient: '+233240000002',
        displayName: 'Ama Serwaa',
        body: 'Fees reminder',
      },
      {
        id: 'log-3',
        organizationId: orgId,
        workspaceIds: [wsId],
        channel: 'whatsapp',
        status: 'sent',
        sentAt: twoDaysAgo,
        recipient: '+233240000003',
        displayName: 'Yaw Boateng',
        body: 'Welcome to term',
      },
      {
        id: 'log-4',
        organizationId: orgId,
        workspaceIds: [wsId],
        channel: 'email',
        status: 'failed',
        sentAt: twoDaysAgo,
        recipient: 'parent@example.com',
        displayName: 'Kwesi Appiah',
        body: 'Term newsletter',
      },
      // Previous 7-day window (10 days ago: 2 SMS sent)
      {
        id: 'log-5',
        organizationId: orgId,
        workspaceIds: [wsId],
        channel: 'sms',
        status: 'sent',
        sentAt: tenDaysAgo,
        recipient: '+233240000004',
        displayName: 'Old Recipient',
        body: 'Old notification',
      },
      {
        id: 'log-6',
        organizationId: orgId,
        workspaceIds: [wsId],
        channel: 'sms',
        status: 'sent',
        sentAt: tenDaysAgo,
        recipient: '+233240000005',
        displayName: 'Old Recipient 2',
        body: 'Old notification 2',
      },
    ];

    mockScheduledMessages = [
      {
        id: 'sched-1',
        organizationId: orgId,
        workspaceId: wsId,
        status: 'pending',
      },
    ];

    mockMessageCampaigns = [
      {
        id: 'camp-1',
        internalName: 'Back to School Campaign',
        status: 'active',
        estimatedRecipientCount: 500,
        sentAt: twoDaysAgo,
      },
    ];

    const result = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const summary = result.data;
      expect(summary.organizationId).toBe(orgId);
      expect(summary.workspaceId).toBe(wsId);

      // Current sent: 4 (3 sent + 1 failed)
      expect(summary.kpi.messagesSent).toBe(4);
      // Previous sent: 2. Delta = (4 - 2) / 2 * 100 = +100%
      expect(summary.kpi.messagesSentDeltaPercentage).toBe(100);

      // Delivery rate: 3 succeeded out of 4 total = 75.0%
      expect(summary.kpi.deliveryRate).toBe(75);
      expect(summary.kpi.smsBalance).toBe(850);
      expect(summary.kpi.providerStatus).toBe('healthy');

      // Channel breakdown: SMS (2), WhatsApp (1), Email (1)
      const smsChannel = summary.channelBreakdown.find((c) => c.channel === 'sms');
      expect(smsChannel?.count).toBe(2);
      expect(smsChannel?.percentage).toBe(50);

      // Active queues
      expect(summary.activeQueues.scheduledCount).toBe(1);
      expect(summary.activeQueues.failedCount).toBe(1); // 1 failed message

      // Recent campaigns
      expect(summary.recentCampaigns).toHaveLength(1);
      expect(summary.recentCampaigns[0].name).toBe('Back to School Campaign');

      // Inbox preview
      expect(summary.inboxPreview.length).toBeGreaterThan(0);
    }
  });

  it('tolerates provider lookup failure gracefully without crashing (Rule 21)', async () => {
    // 1. Single provider failure (e.g. mNotify timeout, WhatsApp connected) -> 'degraded'
    mockFetchSmsBalanceAction.mockRejectedValue(new Error('Gateway timeout (504)'));
    mockGetWhatsAppPublic.mockResolvedValue({ status: 'connected', displayPhoneNumber: '+233244123456' });

    const resultDegraded = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });

    expect(resultDegraded.success).toBe(true);
    if (resultDegraded.success) {
      expect(resultDegraded.data.kpi.smsBalance).toBe(0);
      expect(resultDegraded.data.kpi.providerStatus).toBe('degraded');
      expect(resultDegraded.data.kpi.providerStatusLabel).toContain('Degraded');
    }

    // 2. Both providers failing -> 'error'
    clearDashboardSummaryCacheForTests();
    mockGetWhatsAppPublic.mockRejectedValue(new Error('Meta service unavailable'));

    const resultError = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });

    expect(resultError.success).toBe(true);
    if (resultError.success) {
      expect(resultError.data.kpi.providerStatus).toBe('error');
      expect(resultError.data.kpi.providerStatusLabel).toContain('Service Interruptions');
    }
  });

  it('caches the aggregated summary in memory and avoids re-querying within 3-minute TTL', async () => {
    // First call
    const result1 = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });
    expect(result1.success).toBe(true);
    expect(mockFetchSmsBalanceAction).toHaveBeenCalledTimes(1);

    // Second call without forceRefresh
    const result2 = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
    });
    expect(result2.success).toBe(true);
    // mNotify action should not have been called a second time due to cache hit
    expect(mockFetchSmsBalanceAction).toHaveBeenCalledTimes(1);

    // Third call with forceRefresh = true
    const result3 = await getMessagingDashboardSummaryAction({
      organizationId: orgId,
      workspaceId: wsId,
      forceRefresh: true,
    });
    expect(result3.success).toBe(true);
    expect(mockFetchSmsBalanceAction).toHaveBeenCalledTimes(2);
  });
});
