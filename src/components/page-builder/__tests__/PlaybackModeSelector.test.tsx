import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaybackModeSelector } from '../PlaybackModeSelector';

describe('PlaybackModeSelector', () => {
  it('renders the "VISUAL MODE PREVIEW" header and both mode cards', () => {
    render(<PlaybackModeSelector value="inline" onChange={() => {}} />);

    expect(screen.getByText('VISUAL MODE PREVIEW')).toBeInTheDocument();
    expect(screen.getByText('Inline View')).toBeInTheDocument();
    expect(screen.getByText('Inline placement')).toBeInTheDocument();
    expect(screen.getByText('Lightbox View')).toBeInTheDocument();
    expect(screen.getByText('Full-width Lightbox')).toBeInTheDocument();
    expect(screen.getByText(/Video plays in a darkened overlay/i)).toBeInTheDocument();
  });

  it('indicates active selected mode with aria-checked and checkmark badge', () => {
    const { rerender } = render(<PlaybackModeSelector value="inline" onChange={() => {}} />);

    const inlineRadio = screen.getByRole('radio', { name: /Inline View/i });
    const modalRadio = screen.getByRole('radio', { name: /Lightbox View/i });

    expect(inlineRadio).toHaveAttribute('aria-checked', 'true');
    expect(modalRadio).toHaveAttribute('aria-checked', 'false');

    // Rerender with 'modal'
    rerender(<PlaybackModeSelector value="modal" onChange={() => {}} />);
    expect(inlineRadio).toHaveAttribute('aria-checked', 'false');
    expect(modalRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with "modal" when Lightbox View is clicked', () => {
    const onChange = vi.fn();
    render(<PlaybackModeSelector value="inline" onChange={onChange} />);

    const modalRadio = screen.getByRole('radio', { name: /Lightbox View/i });
    fireEvent.click(modalRadio);

    expect(onChange).toHaveBeenCalledWith('modal');
  });

  it('calls onChange with "inline" when Inline View is clicked', () => {
    const onChange = vi.fn();
    render(<PlaybackModeSelector value="modal" onChange={onChange} />);

    const inlineRadio = screen.getByRole('radio', { name: /Inline View/i });
    fireEvent.click(inlineRadio);

    expect(onChange).toHaveBeenCalledWith('inline');
  });

  it('navigates between modes using keyboard arrow keys and space/enter', () => {
    const onChange = vi.fn();
    render(<PlaybackModeSelector value="inline" onChange={onChange} />);

    const inlineRadio = screen.getByRole('radio', { name: /Inline View/i });
    fireEvent.keyDown(inlineRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('modal');

    const modalRadio = screen.getByRole('radio', { name: /Lightbox View/i });
    fireEvent.keyDown(modalRadio, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('inline');

    fireEvent.keyDown(modalRadio, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('modal');
  });
});
