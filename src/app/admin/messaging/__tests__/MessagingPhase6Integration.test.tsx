import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MessagingClient from '../MessagingClient';
import { getMessagingDashboardSummaryAction } from '@/app/actions/messaging-dashboard-actions';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/messaging',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeOrganizationId: 'org_test',
    activeWorkspaceId: 'ws_test',
  }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ singular: 'school', plural: 'schools' }),
}));

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { displayName: 'Sarah Admin' } }),
  useAuth: () => ({ currentUser: { displayName: 'Sarah Admin' } }),
}));

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
      channelBreakdown: [
        { channel: 'sms', label: 'SMS', count: 6490, percentage: 52, color: '#3b82f6' },
      ],
      recentCampaigns: [
        {
          id: 'c1',
          name: 'Fee Notice',
          status: 'active',
          recipientCount: 100,
          sentAt: '2026-10-09T00:00:00Z',
          deliveryRate: 99,
          clickRate: 35.5,
        },
      ],
      activeQueues: { scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 },
      inboxPreview: [
        {
          threadId: 't1',
          entityName: 'St. Mary High',
          lastMessageSnippet: 'Hello school',
          lastMessageChannel: 'sms',
          lastMessageTimestamp: '2026-10-09T00:00:00Z',
          unreadCount: 1,
          isGroup: false,
          isDirect: true,
        },
      ],
    },
  }),
}));

describe('Messaging Phase 6 Master Integration', () => {
  it('opens AI prompt modal when inbox preview AI drafting button is clicked', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByText(/Ask AI to draft a response/i)).toBeInTheDocument();
    });

    const aiBtn = screen.getByRole('button', { name: /Ask AI to draft reply/i });
    fireEvent.click(aiBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /SmartSapp AI Assistant/i })).toBeInTheDocument();
    });
  });

  it('triggers summary refetch with 30d when time range button is clicked on performance charts', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
    });

    const thirtyDayBtn = screen.getByRole('button', { name: /30d/i });
    fireEvent.click(thirtyDayBtn);

    await waitFor(() => {
      expect(getMessagingDashboardSummaryAction).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          timeRange: '30d',
        })
      );
    });
  });

  it('renders campaign click rate when present in recent campaigns', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByText(/35.5% clicked/i)).toBeInTheDocument();
    });
  });
});
