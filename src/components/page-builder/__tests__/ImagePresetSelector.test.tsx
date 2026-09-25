import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImagePresetSelector } from '../ImagePresetSelector';

describe('ImagePresetSelector', () => {
  const options = [
    { value: 'clean-card', label: 'Clean Card' },
    { value: 'browser-mockup', label: 'Browser Window' },
    { value: 'mobile-chassis', label: 'Mobile Chassis' },
    { value: 'cathedral-arch', label: 'Cathedral Arch' },
    { value: 'circular-avatar', label: 'Circular Avatar' },
    { value: 'floating-elevated', label: 'Floating Elevated' },
    { value: 'interactive-zoom', label: 'Interactive Zoom' },
    { value: 'neo-brutalist', label: 'Neo-Brutalist' },
  ];

  it('renders all 8 visual image preset options', () => {
    render(<ImagePresetSelector value="clean-card" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /image preset style/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
  });

  it('marks current preset as checked with checkmark indicator', () => {
    render(<ImagePresetSelector value="browser-mockup" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /browser window/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with preset key and bundle when card clicked', () => {
    const handleChange = vi.fn();
    render(<ImagePresetSelector value="clean-card" options={options} onChange={handleChange} />);
    const archCard = screen.getByRole('radio', { name: /cathedral arch/i });
    fireEvent.click(archCard);
    expect(handleChange).toHaveBeenCalledWith('cathedral-arch', expect.objectContaining({
      borderRadius: 'arch',
      aspectRatio: '3:4',
    }));
  });

  it('cycles presets cleanly with arrow keys', () => {
    const handleChange = vi.fn();
    render(<ImagePresetSelector value="clean-card" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /clean card/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('browser-mockup', expect.objectContaining({
      elevation: 'browser',
      aspectRatio: '16:9',
    }));
  });
});
