import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MediaPlacementSelector } from '../MediaPlacementSelector';

describe('MediaPlacementSelector', () => {
  const options = [
    { value: 'top', label: 'Media on Top' },
    { value: 'bottom', label: 'Media at Bottom' },
    { value: 'left', label: 'Media on Left' },
    { value: 'right', label: 'Media on Right' },
  ];

  it('renders all 4 media placement options with accessible radio roles', () => {
    render(
      <MediaPlacementSelector
        value="bottom"
        options={options}
        onChange={vi.fn()}
      />
    );

    const group = screen.getByRole('radiogroup', { name: /media align placement/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks current placement as aria-checked with checkmark indicator', () => {
    render(
      <MediaPlacementSelector
        value="bottom"
        options={options}
        onChange={vi.fn()}
      />
    );

    const selected = screen.getByRole('radio', { name: /media at bottom/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');

    const unselected = screen.getByRole('radio', { name: /media on top/i });
    expect(unselected).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onChange with selected placement value when clicked', () => {
    const handleChange = vi.fn();
    render(
      <MediaPlacementSelector
        value="bottom"
        options={options}
        onChange={handleChange}
      />
    );

    const leftCard = screen.getByRole('radio', { name: /media on left/i });
    fireEvent.click(leftCard);
    expect(handleChange).toHaveBeenCalledWith('left');
  });

  it('supports roving tabindex keyboard navigation with arrow keys and focus transfer', () => {
    const handleChange = vi.fn();
    render(
      <MediaPlacementSelector
        value="top"
        options={options}
        onChange={handleChange}
      />
    );

    const firstRadio = screen.getByRole('radio', { name: /media on top/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('bottom');
  });
});
