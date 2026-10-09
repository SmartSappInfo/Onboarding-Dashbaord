import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagingSettingsTab } from '../MessagingSettingsTab';

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockToast = vi.fn();

vi.mock('@/app/actions/messaging-settings-actions', () => ({
  getWorkspaceMessagingSettingsAction: (...args: unknown[]) => mockGetSettings(...args),
  updateWorkspaceMessagingSettingsAction: (...args: unknown[]) => mockUpdateSettings(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('MessagingSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({
      success: true,
      data: {
        version: 1,
        lowBalanceThreshold: 120,
        quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
        aiPromptStarters: ['Custom Starter Prompt 1'],
        channelKillSwitches: { sms: false, whatsapp: false, email: false },
      },
    });
    mockUpdateSettings.mockResolvedValue({
      success: true,
      data: {
        version: 2,
        lowBalanceThreshold: 150,
        quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
        aiPromptStarters: ['Custom Starter Prompt 1'],
        channelKillSwitches: { sms: true, whatsapp: false, email: false },
      },
    });
  });

  it('renders settings fields with loaded data', async () => {
    render(<MessagingSettingsTab workspaceId="ws_123" />);

    await waitFor(() => {
      expect(screen.getByText(/SMS Low-Balance Alert Threshold/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('120')).toBeInTheDocument();
      expect(screen.getByText(/Custom Starter Prompt 1/i)).toBeInTheDocument();
    });
  });

  it('updates low balance threshold on form save', async () => {
    render(<MessagingSettingsTab workspaceId="ws_123" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByDisplayValue('120');
    fireEvent.change(thresholdInput, { target: { value: '150' } });

    const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        'ws_123',
        expect.objectContaining({ lowBalanceThreshold: 150 }),
        1
      );
    });
  });
});
