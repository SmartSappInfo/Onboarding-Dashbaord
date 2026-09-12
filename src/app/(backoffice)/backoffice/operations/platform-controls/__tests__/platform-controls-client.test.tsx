/**
 * Stage E / Task E2 — the operator-facing half.
 *
 * These assert the properties that matter when someone reads this screen during an
 * incident: the state is stated in words, the environment floor is never mistaken for the
 * operator switch, and a failed save is visible rather than swallowed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setOutboundPausedAction = vi.fn(async (_paused: boolean, _reason: string) => ({
  success: true as boolean,
  error: undefined as string | undefined,
}));

vi.mock('@/lib/platform/platform-controls-actions', () => ({
  setOutboundPausedAction: (paused: boolean, reason: string) =>
    setOutboundPausedAction(paused, reason),
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import PlatformControlsClient from '../PlatformControlsClient';
import type { PlatformControlsView } from '@/lib/platform/platform-controls-actions';

const baseView: PlatformControlsView = {
  surface: 'backoffice',
  outboundEnabled: true,
  envFloorAllows: true,
  pausedReason: '',
  updatedByName: '',
  updatedAt: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  setOutboundPausedAction.mockResolvedValue({ success: true, error: undefined });
});

describe('PlatformControlsClient', () => {
  it('states the current state in words, not a boolean', () => {
    render(<PlatformControlsClient initial={baseView} canEdit />);
    expect(screen.getByText('Sending is on')).toBeInTheDocument();
    expect(screen.queryByText(/true|false/i)).not.toBeInTheDocument();
  });

  it('shows the pause reason and who set it', () => {
    render(
      <PlatformControlsClient
        initial={{
          ...baseView,
          outboundEnabled: false,
          pausedReason: 'provider incident',
          updatedByName: 'Ops',
        }}
        canEdit
      />,
    );
    expect(screen.getByText('Sending is paused')).toBeInTheDocument();
    expect(screen.getByText('provider incident')).toBeInTheDocument();
    expect(screen.getByText(/Last changed by Ops/)).toBeInTheDocument();
  });

  it('never renders an environment variable name to the operator', () => {
    const { container } = render(
      <PlatformControlsClient initial={{ ...baseView, envFloorAllows: false }} canEdit />,
    );
    expect(screen.getByText('Sending is off for this environment')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ALLOW_OUTBOUND_MESSAGING|outboundEnabled/);
  });

  it('makes the toggle inert when the environment blocks sending', () => {
    render(<PlatformControlsClient initial={{ ...baseView, envFloorAllows: false }} canEdit />);
    expect(screen.getByRole('switch', { name: /send messages/i })).toBeDisabled();
  });

  it('makes the toggle inert for a viewer who cannot edit', () => {
    render(<PlatformControlsClient initial={baseView} canEdit={false} />);
    expect(screen.getByRole('switch', { name: /send messages/i })).toBeDisabled();
    expect(screen.getByText(/see this setting but not change it/i)).toBeInTheDocument();
  });

  it('will not pause without a reason', async () => {
    const user = userEvent.setup();
    render(<PlatformControlsClient initial={baseView} canEdit />);

    await user.click(screen.getByRole('switch', { name: /send messages/i }));
    await user.click(await screen.findByRole('button', { name: 'Stop sending' }));

    expect(await screen.findByText(/short note saying why/i)).toBeInTheDocument();
    expect(setOutboundPausedAction).not.toHaveBeenCalled();
  });

  it('pauses with the reason the operator typed', async () => {
    const user = userEvent.setup();
    render(<PlatformControlsClient initial={baseView} canEdit />);

    await user.click(screen.getByRole('switch', { name: /send messages/i }));
    await user.type(await screen.findByLabelText(/why are you pausing/i), 'provider down');
    await user.click(screen.getByRole('button', { name: 'Stop sending' }));

    await waitFor(() =>
      expect(setOutboundPausedAction).toHaveBeenCalledWith(true, 'provider down'),
    );
    expect(await screen.findByText('Sending is paused')).toBeInTheDocument();
  });

  it('resumes without demanding a reason', async () => {
    const user = userEvent.setup();
    render(
      <PlatformControlsClient
        initial={{ ...baseView, outboundEnabled: false, pausedReason: 'x' }}
        canEdit
      />,
    );

    await user.click(screen.getByRole('switch', { name: /send messages/i }));
    await user.click(await screen.findByRole('button', { name: 'Start sending' }));

    await waitFor(() => expect(setOutboundPausedAction).toHaveBeenCalledWith(false, ''));
    expect(await screen.findByText('Sending is on')).toBeInTheDocument();
  });

  it('keeps the dialog open and shows one plain sentence when the save fails', async () => {
    setOutboundPausedAction.mockResolvedValue({
      success: false,
      error: 'Something went wrong. (ref: abc123)',
    });
    const user = userEvent.setup();
    render(<PlatformControlsClient initial={baseView} canEdit />);

    await user.click(screen.getByRole('switch', { name: /send messages/i }));
    await user.type(await screen.findByLabelText(/why are you pausing/i), 'trying');
    await user.click(screen.getByRole('button', { name: 'Stop sending' }));

    expect(await screen.findByText(/Something went wrong\. \(ref: abc123\)/)).toBeInTheDocument();
    // State must not have moved: the write did not happen.
    expect(screen.getByText('Sending is on')).toBeInTheDocument();
  });
});
