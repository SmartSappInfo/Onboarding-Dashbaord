import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MessagingClient from '../MessagingClient';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/messaging',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
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
      channelBreakdown: [],
      recentCampaigns: [],
      activeQueues: { scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 },
      inboxPreview: [],
    },
  }),
}));

describe('MessagingClient Master Orchestrator', () => {
  it('renders all sections and loads summary from server action', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByText(/Good/i)).toBeInTheDocument();
      expect(screen.getByText(/12,482/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
      expect(screen.getByText(/Conversations Inbox/i)).toBeInTheDocument();
      expect(screen.getByText(/Delivery Performance/i)).toBeInTheDocument();
      expect(screen.getByText(/Recent Campaigns/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick Compose/i)).toBeInTheDocument();
      expect(screen.getByText(/Quick Templates/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Queues/i)).toBeInTheDocument();
    });
  });

  it('populates the quick composer when a template is selected', async () => {
    render(<MessagingClient />);
    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    });

    const welcomeTemplateButton = screen.getByText('Welcome Message').closest('button');
    expect(welcomeTemplateButton).toBeTruthy();
    if (welcomeTemplateButton) {
      fireEvent.click(welcomeTemplateButton);
    }

    const textarea = screen.getByPlaceholderText(/Type your message/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Welcome to our community');
  });
});
