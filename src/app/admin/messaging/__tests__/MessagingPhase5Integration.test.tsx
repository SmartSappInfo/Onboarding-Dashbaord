import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessagingClient from '../MessagingClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/messaging',
  useSearchParams: () => new URLSearchParams(),
}));

const mockGetSummary = vi.fn();
vi.mock('@/app/actions/messaging-dashboard-actions', () => ({
  getMessagingDashboardSummaryAction: (...args: unknown[]) => mockGetSummary(...args),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_123',
    activeOrganizationId: 'org_123',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    schoolTerm: 'School',
    studentTerm: 'Student',
    parentTerm: 'Parent',
    entityTermSingular: 'school',
  }),
}));

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { displayName: 'Sarah Admin' } }),
  useAuth: () => ({ currentUser: { displayName: 'Sarah Admin' } }),
}));

vi.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: { displayName: 'Sarah Admin' } }),
  useAuth: () => ({ currentUser: { displayName: 'Sarah Admin' } }),
  useFirebase: () => ({ auth: {}, firestore: {} }),
}));

const mockDispatch = vi.fn();
vi.mock('@/app/actions/quick-message-actions', () => ({
  dispatchQuickDirectMessageAction: (...args: unknown[]) => mockDispatch(...args),
}));

vi.mock('@/components/shared/VariablesPanel', () => ({
  VariablesPanel: () => <div data-testid="variables-panel">Variables</div>,
}));

describe('Messaging Phase 5 Right Sidebar Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSummary.mockResolvedValue({
      success: true,
      data: {
        kpi: {
          messagesSent: 12480,
          messagesSentDelta: 24.5,
          deliveryRate: 99.7,
          deliveryRateDelta: 1.2,
          smsBalance: 5, // Triggers low-balance alert (< 10)
          providerStatus: 'healthy',
        },
        performance: {
          deliveredCount: 12440,
          sentCount: 12480,
          failedCount: 40,
          deliveryPercentage: 99.7,
        },
        channelBreakdown: [
          { channel: 'sms', count: 6500, percentage: 52 },
          { channel: 'whatsapp', count: 3500, percentage: 28 },
          { channel: 'email', count: 1500, percentage: 12 },
          { channel: 'in_app', count: 980, percentage: 8 },
        ],
        recentCampaigns: [],
        activeQueues: {
          scheduledCount: 15,
          pendingApprovalCount: 2,
          failedCount: 1, // Triggers "Needs Attention" badge
        },
        inboxPreview: [],
      },
    });
    mockDispatch.mockResolvedValue({ success: true, logId: 'log_phase5_test' });
  });

  it('renders all three Right Sidebar cards: Quick Compose, Quick Templates, and Active Queues', async () => {
    render(<MessagingClient />);

    await waitFor(() => {
      expect(screen.getByText('Quick Compose')).toBeInTheDocument();
      expect(screen.getByText('Quick Templates')).toBeInTheDocument();
      expect(screen.getByText('Active Queues')).toBeInTheDocument();
    });
  });

  it('synchronizes template selection from Quick Templates into Quick Composer (body, subject, channel)', async () => {
    render(<MessagingClient />);

    await waitFor(() => {
      expect(screen.getByText('Event Invite')).toBeInTheDocument();
    });

    // Clicking Event Invite (which defaults to email channel)
    const eventInviteBtn = screen.getByText('Event Invite').closest('button');
    fireEvent.click(eventInviteBtn!);

    // Should switch channel to Email and reveal Subject input with invitation subject
    await waitFor(() => {
      const subjectInput = screen.getByPlaceholderText(/Enter subject line/i) as HTMLInputElement;
      expect(subjectInput).toBeInTheDocument();
      expect(subjectInput.value).toContain('Invitation: School Open Day');

      const messageTextarea = screen.getByPlaceholderText(/Type your message/i) as HTMLTextAreaElement;
      expect(messageTextarea.value).toContain('Join us for our upcoming school open day');
    });
  });

  it('displays proactive low SMS balance alert badge when smsBalance is 5 (< 10)', async () => {
    render(<MessagingClient />);

    // Switch to SMS channel
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'SMS' }));
    });

    expect(screen.getByText(/Low SMS Balance: 5 units/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Top up →/i })).toHaveAttribute(
      'href',
      '/admin/settings?tab=billing'
    );
  });

  it('renders Active Queues with real-time stats and dead-letter alert badge', async () => {
    render(<MessagingClient />);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // Scheduled
      expect(screen.getByText('2')).toBeInTheDocument();  // Pending
      expect(screen.getByText('1')).toBeInTheDocument();  // Failed
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });
  });
});
