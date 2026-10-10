/**
 * @fileOverview SmartSapp Messaging Dashboard — Phase 7 End-to-End Integration & Governance Suite
 * 
 * Verifies end-to-end integration across:
 * 1. Backoffice Codeless Controls Tab (`MessagingSettingsTab.tsx`).
 * 2. Governed MCP Tooling (`messaging.get_dashboard_summary`).
 * 3. Dynamic prop propagation into dashboard cards (Kill-Switches, Quick Templates, and AI Starters).
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Zero any, strict types.
 * - Rule 8: Multi-tenant boundary verification.
 * - Rule 18: Fail-closed context and TOCTOU version protection.
 * - Rule 21: Graceful degradation and maintenance mode isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessagingSettingsTab } from '../../settings/components/MessagingSettingsTab';
import { QuickMessageComposerCard } from '../components/dashboard/QuickMessageComposerCard';
import { QuickTemplatesCard } from '../components/dashboard/QuickTemplatesCard';
import { MessagingHeroGreeting } from '../components/dashboard/MessagingHeroGreeting';
import { messagingGetDashboardSummaryTool } from '@/lib/mcp/tools/messaging-dashboard-tool';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test',
    activeOrganizationId: 'org_test',
  }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'Student',
    plural: 'Students',
  }),
}));

vi.mock('@/firebase', () => ({
  useUser: () => ({
    user: { displayName: 'Principal Taylor', uid: 'user_123' },
  }),
}));

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();

vi.mock('@/app/actions/messaging-settings-actions', () => ({
  getWorkspaceMessagingSettingsAction: (...args: unknown[]) => mockGetSettings(...args),
  updateWorkspaceMessagingSettingsAction: (...args: unknown[]) => mockUpdateSettings(...args),
}));

describe('Messaging Phase 7 End-to-End Integration', () => {
  beforeEach(() => {
    mockGetSettings.mockResolvedValue({
      success: true,
      data: {
        version: 1,
        lowBalanceThreshold: 120,
        quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
        aiPromptStarters: ['Custom Backoffice AI Prompt Starter'],
        channelKillSwitches: { sms: true, whatsapp: false, email: false },
      },
    });
    mockUpdateSettings.mockResolvedValue({
      success: true,
      data: {
        version: 2,
        lowBalanceThreshold: 150,
        quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
        aiPromptStarters: ['Custom Backoffice AI Prompt Starter'],
        channelKillSwitches: { sms: true, whatsapp: false, email: false },
      },
    });
  });
  it('loads backoffice governance settings and renders actionable controls', async () => {
    render(<MessagingSettingsTab workspaceId="ws_test" />);

    await waitFor(() => {
      expect(screen.getByText(/SMS Low-Balance Alert Threshold/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('120')).toBeInTheDocument();
      expect(screen.getByText(/Dashboard Quick Templates Shortlist/i)).toBeInTheDocument();
      expect(screen.getByText(/Channel Maintenance & Kill-Switches/i)).toBeInTheDocument();
      expect(screen.getByText(/Custom Backoffice AI Prompt Starter/i)).toBeInTheDocument();
    });
  });

  it('saves updated settings with TOCTOU concurrency version increment', async () => {
    render(<MessagingSettingsTab workspaceId="ws_test" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByDisplayValue('120');
    fireEvent.change(thresholdInput, { target: { value: '150' } });

    const saveButton = screen.getByRole('button', { name: /Save Configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        'ws_test',
        expect.objectContaining({ lowBalanceThreshold: 150 }),
        1
      );
    });
  });

  it('propagates channel kill-switches reactively into QuickMessageComposerCard', () => {
    render(
      <QuickMessageComposerCard
        killSwitches={{ sms: true, whatsapp: false, email: false }}
        initialMessage="Test dispatch"
      />
    );

    // Active channel SMS is paused
    expect(screen.getByText(/SMS outbound is paused for maintenance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Channel Paused/i })).toBeDisabled();

    // Switching to WhatsApp removes banner and restores button
    fireEvent.click(screen.getByRole('button', { name: 'WHATSAPP' }));
    expect(screen.queryByText(/SMS outbound is paused for maintenance/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeInTheDocument();
  });

  it('filters displayed quick templates according to workspace allowedTemplateIds', () => {
    render(<QuickTemplatesCard allowedTemplateIds={['tpl_welcome']} />);

    expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    expect(screen.queryByText('Fee Reminder')).not.toBeInTheDocument();
    expect(screen.queryByText('Event Invite')).not.toBeInTheDocument();
    expect(screen.queryByText('General Announcement')).not.toBeInTheDocument();
  });

  it('injects workspace custom AI prompt starters into Hero Greeting modal', () => {
    render(
      <MessagingHeroGreeting
        promptStarters={['Custom Backoffice AI Prompt Starter']}
      />
    );

    const promptPill = screen.getByRole('button', { name: /Ask AI to draft/i });
    fireEvent.click(promptPill);

    expect(screen.getByText(/Custom Backoffice AI Prompt Starter/i)).toBeInTheDocument();
  });

  it('MCP tool rejects executions missing multi-tenant context (Rule 18 fail-closed)', async () => {
    await expect(
      messagingGetDashboardSummaryTool.handler(
        { forceRefresh: false },
        {
          workspaceId: '',
          organizationId: '',
          callerId: 'agent',
          callerType: 'agent',
          requestId: 'r1',
          callDepth: 1,
          timestamp: '2026-10-09T08:00:00Z',
        }
      )
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
