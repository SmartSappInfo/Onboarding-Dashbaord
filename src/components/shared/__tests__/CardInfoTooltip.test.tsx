import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { CardInfoTooltip } from '../CardInfoTooltip';

describe('CardInfoTooltip', () => {
  it('renders a button with a single info icon and no outer border or ring', () => {
    render(<CardInfoTooltip text="Detailed survey guidance" />);

    const button = screen.getByRole('button', { name: /more information/i });
    expect(button).toBeDefined();

    // Verify button does NOT contain hardcoded focus:ring-1 or border classes that create double circles
    expect(button.className).not.toContain('focus:ring-1');
    expect(button.className).not.toContain('border');

    // Verify the SVG inside is the Info icon
    const svg = button.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('displays tooltip description on hover and closes on unhover', async () => {
    const user = userEvent.setup();
    render(<CardInfoTooltip text="Detailed survey guidance" />);

    const button = screen.getByRole('button', { name: /more information/i });

    // Hover
    await user.hover(button);

    // Tooltip content should appear
    await waitFor(() => {
      const elements = screen.queryAllByText('Detailed survey guidance');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 1500 });

    // Unhover
    await user.unhover(button);

    await waitFor(() => {
      const elements = screen.queryAllByText('Detailed survey guidance');
      expect(elements.length).toBe(0);
    }, { timeout: 1500 });
  });

  it('displays tooltip description on tap / click', async () => {
    render(<CardInfoTooltip text="Detailed survey guidance" />);

    const button = screen.getByRole('button', { name: /more information/i });

    // Tap/Click button to open (e.g. mobile touch tap)
    fireEvent.pointerDown(button);

    await waitFor(() => {
      const elements = screen.queryAllByText('Detailed survey guidance');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 1500 });

    // Tap/Click again to toggle off
    fireEvent.pointerDown(button);

    await waitFor(() => {
      const elements = screen.queryAllByText('Detailed survey guidance');
      expect(elements.length).toBe(0);
    }, { timeout: 1500 });
  });
});
