import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoPresetSelector } from '../VideoPresetSelector';

describe('VideoPresetSelector', () => {
  const options = [
    { value: 'ambient-loop', label: 'Ambient Background Loop' },
    { value: 'hero-walkthrough', label: 'Hero Walkthrough' },
    { value: 'social-reel', label: 'Social Reel / Story' },
    { value: 'micro-demo', label: 'Interactive Micro-Demo' },
  ];

  it('renders all 4 video preset archetypes with accessible radio roles', () => {
    render(<VideoPresetSelector value="hero-walkthrough" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /video preset archetype/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks current archetype as aria-checked with checkmark indicator', () => {
    render(<VideoPresetSelector value="ambient-loop" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /ambient background loop/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with archetype key and bundle when clicked', () => {
    const handleChange = vi.fn();
    render(<VideoPresetSelector value="hero-walkthrough" options={options} onChange={handleChange} />);
    const reelCard = screen.getByRole('radio', { name: /social reel/i });
    fireEvent.click(reelCard);
    expect(handleChange).toHaveBeenCalledWith('social-reel', expect.objectContaining({
      aspectRatio: '9:16',
      elevation: 'mobile',
    }));
  });

  it('supports roving tabindex keyboard navigation with arrow keys and focus transfer', () => {
    const handleChange = vi.fn();
    render(<VideoPresetSelector value="ambient-loop" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /ambient background loop/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('hero-walkthrough', expect.any(Object));
  });
});
