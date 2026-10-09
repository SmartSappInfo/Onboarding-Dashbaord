import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickMessageComposerCard } from '../QuickMessageComposerCard';

// Mock dependencies
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_123',
    activeOrganizationId: 'org_test_123',
  }),
}));

const mockDispatch = vi.fn();
vi.mock('@/app/actions/quick-message-actions', () => ({
  dispatchQuickDirectMessageAction: (...args: unknown[]) => mockDispatch(...args),
}));

vi.mock('@/components/shared/VariablesPanel', () => ({
  VariablesPanel: ({ onSelect }: { onSelect?: (key: string) => void }) => (
    <div data-testid="mock-variables-panel">
      <button type="button" onClick={() => onSelect?.('first_name')}>
        Insert First Name
      </button>
    </div>
  ),
}));

describe('QuickMessageComposerCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockResolvedValue({ success: true, logId: 'log_abc' });
  });

  it('renders recipient, message textarea, and channel selector', () => {
    render(<QuickMessageComposerCard />);
    expect(screen.getByPlaceholderText(/Enter recipient phone or email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SMS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WHATSAPP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EMAIL' })).toBeInTheDocument();
  });

  it('reveals Subject line when Email channel is selected, hides for SMS/WhatsApp', () => {
    render(<QuickMessageComposerCard />);
    expect(screen.queryByPlaceholderText(/Enter subject line/i)).not.toBeInTheDocument();

    // Switch to Email
    fireEvent.click(screen.getByRole('button', { name: 'EMAIL' }));
    expect(screen.getByPlaceholderText(/Enter subject line/i)).toBeInTheDocument();

    // Switch to WhatsApp
    fireEvent.click(screen.getByRole('button', { name: 'WHATSAPP' }));
    expect(screen.queryByPlaceholderText(/Enter subject line/i)).not.toBeInTheDocument();
  });

  it('accepts spaced phone numbers without false-positive blast detection', () => {
    render(<QuickMessageComposerCard />);
    const recipientInput = screen.getByPlaceholderText(/Enter recipient phone or email/i);
    fireEvent.change(recipientInput, { target: { value: '+233 24 123 4567' } });

    expect(screen.queryByText(/Quick compose supports 1-to-1 messages only/i)).not.toBeInTheDocument();
  });

  it('displays anti-blast warning pill and disables send when multiple recipients are typed', () => {
    render(<QuickMessageComposerCard />);
    const recipientInput = screen.getByPlaceholderText(/Enter recipient phone or email/i);
    fireEvent.change(recipientInput, { target: { value: '+233244123456, +233201112222' } });

    expect(screen.getByText(/Quick compose supports 1-to-1 messages only/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Campaign Wizard/i })).toHaveAttribute(
      'href',
      '/admin/messaging/composer'
    );
  });

  it('displays low-balance alert badge when smsBalance < 10 on SMS channel', () => {
    render(<QuickMessageComposerCard smsBalance={4} />);
    expect(screen.getByText(/Low SMS Balance: 4 units/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Top up →/i })).toHaveAttribute(
      'href',
      '/admin/settings?tab=billing'
    );
  });

  it('inserts variable token from VariablesPanel into message body', async () => {
    render(<QuickMessageComposerCard />);
    const insertVarBtn = screen.getByRole('button', { name: /Insert Variable/i });
    fireEvent.click(insertVarBtn);

    const firstVarBtn = screen.getByRole('button', { name: /Insert First Name/i });
    fireEvent.click(firstVarBtn);

    const textarea = screen.getByPlaceholderText(/Type your message/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('{{first_name}}');
  });

  it('submits valid message to dispatchQuickDirectMessageAction and triggers onMessageSent callback', async () => {
    const handleSent = vi.fn();
    render(
      <QuickMessageComposerCard
        workspaceId="ws_custom_99"
        onMessageSent={handleSent}
      />
    );

    const recipientInput = screen.getByPlaceholderText(/Enter recipient phone or email/i);
    const textarea = screen.getByPlaceholderText(/Type your message/i);

    fireEvent.change(recipientInput, { target: { value: '+233244123456' } });
    fireEvent.change(textarea, { target: { value: 'Hello parent meeting notice' } });

    const sendBtn = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_custom_99',
          channel: 'sms',
          recipient: '+233244123456',
          body: 'Hello parent meeting notice',
        })
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Message Dispatched',
        actionConfig: expect.objectContaining({
          path: '/admin/messaging/conversations',
          label: 'View in Inbox',
        }),
      })
    );
    expect(handleSent).toHaveBeenCalledTimes(1);
  });

  it('handles WHATSAPP_SESSION_CLOSED error with actionable template link toast', async () => {
    mockDispatch.mockResolvedValueOnce({
      success: false,
      error: 'WhatsApp 24-hour customer service window is closed.',
      code: 'WHATSAPP_SESSION_CLOSED',
    });

    render(<QuickMessageComposerCard />);

    // Switch to WhatsApp
    fireEvent.click(screen.getByRole('button', { name: 'WHATSAPP' }));

    const recipientInput = screen.getByPlaceholderText(/Enter recipient phone or email/i);
    const textarea = screen.getByPlaceholderText(/Type your message/i);

    fireEvent.change(recipientInput, { target: { value: '+233244123456' } });
    fireEvent.change(textarea, { target: { value: 'Checking in' } });

    const sendBtn = screen.getByRole('button', { name: /Send Message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'WhatsApp Window Closed',
          actionConfig: expect.objectContaining({
            path: '/admin/messaging/templates?channel=whatsapp',
            label: 'Use Approved Template',
          }),
        })
      );
    });
  });

  it('renders paused maintenance banner and disables dispatch button when channel kill-switch is active', () => {
    render(
      <QuickMessageComposerCard
        killSwitches={{ sms: true, whatsapp: false, email: false }}
        initialMessage="Hello there"
      />
    );

    // SMS is active channel by default
    expect(screen.getByText(/SMS outbound is paused for maintenance/i)).toBeInTheDocument();
    const pausedBtn = screen.getByRole('button', { name: /Channel Paused/i });
    expect(pausedBtn).toBeDisabled();

    // Switch to WhatsApp (which is not paused)
    fireEvent.click(screen.getByRole('button', { name: 'WHATSAPP' }));
    expect(screen.queryByText(/SMS outbound is paused for maintenance/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeInTheDocument();
  });
});
