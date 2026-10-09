import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { SafeguardBlastModal } from '../SafeguardBlastModal';

describe('SafeguardBlastModal (theme.md Section 8 SSOT)', () => {
  it('renders demarcated header with CardInfoTooltip and sr-only description', () => {
    render(
      <SafeguardBlastModal
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        recipientCount={150}
        channel="sms"
        senderProfileLabel="SmartSapp SMS"
        isScheduled={false}
      />
    );

    // Title verification
    expect(screen.getByText('Confirm Message Dispatch')).toBeInTheDocument();

    // sr-only description check
    const srOnlyDesc = screen.getByText('Please review your dispatch parameters before executing.');
    expect(srOnlyDesc).toHaveClass('sr-only');

    // Tooltip trigger check
    expect(screen.getByRole('button', { name: /more information/i })).toBeInTheDocument();
  });

  it('renders summary metrics with tabular-nums and tactile action buttons', () => {
    const onConfirm = vi.fn();
    render(
      <SafeguardBlastModal
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        recipientCount={450}
        channel="whatsapp"
        senderProfileLabel="Admissions WA"
        isScheduled={true}
        scheduledAt={new Date('2026-10-15T14:30:00Z')}
      />
    );

    // Title changes for scheduled broadcasts
    expect(screen.getByText('Confirm Scheduled Broadcast')).toBeInTheDocument();

    // Volume with tabular-nums
    const volumeEl = screen.getByText('450 recipients');
    expect(volumeEl).toHaveClass('tabular-nums');

    // Channel badge
    expect(screen.getByText('whatsapp')).toBeInTheDocument();
    expect(screen.getByText('Admissions WA')).toBeInTheDocument();

    // Buttons check
    const cancelBtn = screen.getByRole('button', { name: /Review Changes/i });
    expect(cancelBtn).toHaveClass('min-h-[44px]');
    expect(cancelBtn.className).toContain('active:scale-[0.97]');

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Schedule/i });
    expect(confirmBtn).toHaveClass('min-h-[44px]');
    expect(confirmBtn.className).toContain('active:scale-[0.97]');

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
