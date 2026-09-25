import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LineSpacingSelector } from '../LineSpacingSelector';

describe('LineSpacingSelector Component', () => {
  it('renders with radiogroup role and default options', () => {
    render(<LineSpacingSelector value="normal" onChange={() => {}} />);

    const group = screen.getByRole('radiogroup', { name: /Line Spacing/i });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);

    expect(screen.getByRole('radio', { name: /Tight/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Normal/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Relaxed/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Loose/i })).toBeInTheDocument();
  });

  it('marks selected option with aria-checked="true" and tabIndex 0', () => {
    render(<LineSpacingSelector value="relaxed" onChange={() => {}} />);

    const relaxedRadio = screen.getByRole('radio', { name: /Relaxed/i });
    expect(relaxedRadio).toHaveAttribute('aria-checked', 'true');
    expect(relaxedRadio).toHaveAttribute('tabindex', '0');

    const normalRadio = screen.getByRole('radio', { name: /Normal/i });
    expect(normalRadio).toHaveAttribute('aria-checked', 'false');
    expect(normalRadio).toHaveAttribute('tabindex', '-1');
  });

  it('calls onChange with selected value on click', () => {
    const handleChange = vi.fn();
    render(<LineSpacingSelector value="normal" onChange={handleChange} />);

    const tightRadio = screen.getByRole('radio', { name: /Tight/i });
    fireEvent.click(tightRadio);

    expect(handleChange).toHaveBeenCalledWith('tight');
  });

  it('cycles through options on ArrowRight and ArrowLeft keyboard events', () => {
    const handleChange = vi.fn();
    render(<LineSpacingSelector value="normal" onChange={handleChange} />);

    const normalRadio = screen.getByRole('radio', { name: /Normal/i });

    // ArrowRight should move from normal (index 1) to relaxed (index 2)
    fireEvent.keyDown(normalRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('relaxed');

    // ArrowLeft should move from normal (index 1) to tight (index 0)
    fireEvent.keyDown(normalRadio, { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith('tight');
  });

  it('triggers onChange on Enter or Space key press', () => {
    const handleChange = vi.fn();
    render(<LineSpacingSelector value="loose" onChange={handleChange} />);

    const looseRadio = screen.getByRole('radio', { name: /Loose/i });

    fireEvent.keyDown(looseRadio, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith('loose');

    fireEvent.keyDown(looseRadio, { key: ' ' });
    expect(handleChange).toHaveBeenCalledTimes(2);
  });
});
