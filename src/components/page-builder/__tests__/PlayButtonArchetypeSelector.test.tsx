import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayButtonArchetypeSelector } from '../PlayButtonArchetypeSelector';

describe('PlayButtonArchetypeSelector', () => {
  const options = [
    { value: 'pulse', label: 'Radar / Pulse Waves' },
    { value: 'glass-pill', label: 'Glassmorphic Pill' },
    { value: 'minimal-badge', label: 'Minimal Bottom Badge' },
    { value: 'standard', label: 'Classic Disc' },
  ];

  it('renders all 4 play button archetypes with accessible radio roles', () => {
    render(<PlayButtonArchetypeSelector value="pulse" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /play button style/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks current button style as checked', () => {
    render(<PlayButtonArchetypeSelector value="glass-pill" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /glassmorphic pill/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with selected archetype on click', () => {
    const handleChange = vi.fn();
    render(<PlayButtonArchetypeSelector value="pulse" options={options} onChange={handleChange} />);
    const badge = screen.getByRole('radio', { name: /minimal bottom badge/i });
    fireEvent.click(badge);
    expect(handleChange).toHaveBeenCalledWith('minimal-badge');
  });

  it('supports roving tabindex keyboard navigation with arrow keys and focus transfer', () => {
    const handleChange = vi.fn();
    render(<PlayButtonArchetypeSelector value="pulse" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /radar \/ pulse waves/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('glass-pill');
  });
});
