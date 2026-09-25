import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AspectRatioSelector } from '../AspectRatioSelector';

describe('AspectRatioSelector', () => {
  const options = [
    { value: 'auto', label: 'Auto (Original)' },
    { value: '1:1', label: '1:1 Square' },
    { value: '4:3', label: '4:3 Standard' },
    { value: '16:9', label: '16:9 Landscape' },
    { value: '21:9', label: '21:9 Ultra-Wide' },
    { value: '9:16', label: '9:16 Vertical' },
    { value: '3:4', label: '3:4 Portrait' },
  ];

  it('renders all aspect ratio options with accessible radio roles', () => {
    render(<AspectRatioSelector value="16:9" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /aspect ratio/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
  });

  it('marks current value as aria-checked', () => {
    render(<AspectRatioSelector value="16:9" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /16:9/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with selected value when clicked', () => {
    const handleChange = vi.fn();
    render(<AspectRatioSelector value="auto" options={options} onChange={handleChange} />);
    const option = screen.getByRole('radio', { name: /1:1/i });
    fireEvent.click(option);
    expect(handleChange).toHaveBeenCalledWith('1:1');
  });

  it('handles keyboard navigation with arrow keys', () => {
    const handleChange = vi.fn();
    render(<AspectRatioSelector value="auto" options={options} onChange={handleChange} />);
    const option = screen.getByRole('radio', { name: /auto/i });
    fireEvent.keyDown(option, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('1:1');
  });
});
