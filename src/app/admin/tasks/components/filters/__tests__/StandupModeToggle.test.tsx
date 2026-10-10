import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StandupModeToggle } from '../StandupModeToggle';

describe('StandupModeToggle (Roadmap §31, UI Spec §515)', () => {
  it('renders segmented control with Normal and Standup options and min-h-[44px]', () => {
    const onModeChange = vi.fn();
    render(
      <StandupModeToggle
        mode="normal"
        onModeChange={onModeChange}
        anchorDate={new Date('2026-10-12T10:00:00Z')}
      />
    );

    const normalBtn = screen.getByRole('button', { name: /normal/i });
    const standupBtn = screen.getByRole('button', { name: /standup/i });

    expect(normalBtn).toBeInTheDocument();
    expect(standupBtn).toBeInTheDocument();
    expect(normalBtn.className).toContain('min-h-[44px]');
    expect(standupBtn.className).toContain('min-h-[44px]');
  });

  it('triggers onModeChange when switching options', () => {
    const onModeChange = vi.fn();
    render(
      <StandupModeToggle
        mode="normal"
        onModeChange={onModeChange}
        anchorDate={new Date('2026-10-12T10:00:00Z')}
      />
    );

    const standupBtn = screen.getByRole('button', { name: /standup/i });
    fireEvent.click(standupBtn);
    expect(onModeChange).toHaveBeenCalledWith('standup');
  });

  it('displays Monday standup indicator when in standup mode on a Monday', () => {
    // 2026-10-12 is a Monday
    const monday = new Date(2026, 9, 12, 10, 0, 0);

    const { rerender } = render(
      <StandupModeToggle
        mode="normal"
        onModeChange={vi.fn()}
        anchorDate={monday}
      />
    );

    expect(screen.queryByText(/Monday Standup: Reviewing Fri – Mon work/i)).not.toBeInTheDocument();

    rerender(
      <StandupModeToggle
        mode="standup"
        onModeChange={vi.fn()}
        anchorDate={monday}
      />
    );

    expect(screen.getByText(/Monday Standup: Reviewing Fri – Mon work/i)).toBeInTheDocument();
  });

  it('does not display Monday standup indicator on Tuesday', () => {
    // 2026-10-13 is Tuesday
    const tuesday = new Date(2026, 9, 13, 10, 0, 0);

    render(
      <StandupModeToggle
        mode="standup"
        onModeChange={vi.fn()}
        anchorDate={tuesday}
      />
    );

    expect(screen.queryByText(/Monday Standup: Reviewing Fri – Mon work/i)).not.toBeInTheDocument();
  });
});
