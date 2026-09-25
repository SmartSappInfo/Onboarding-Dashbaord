import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DividerStyleSelector } from '../DividerStyleSelector';
import { DIVIDER_STYLE_OPTIONS } from '@/lib/page-builder/blocks/divider';

describe('DividerStyleSelector Component', () => {
  it('renders all divider style wireframe cards', () => {
    const handleChange = vi.fn();
    render(
      <DividerStyleSelector
        value="solid"
        options={DIVIDER_STYLE_OPTIONS}
        onChange={handleChange}
      />
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Solid Continuous/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Modern Dashed/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Neon Glow Aura/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Center Text Badge/i })).toBeInTheDocument();
  });

  it('marks the active style card with aria-checked=true and checkmark badge', () => {
    render(
      <DividerStyleSelector
        value="glow"
        options={DIVIDER_STYLE_OPTIONS}
        onChange={() => {}}
      />
    );

    const glowRadio = screen.getByRole('radio', { name: /Neon Glow Aura/i });
    expect(glowRadio).toHaveAttribute('aria-checked', 'true');
    expect(glowRadio.querySelector('[data-testid="selected-check"]')).toBeInTheDocument();

    const solidRadio = screen.getByRole('radio', { name: /Solid Continuous/i });
    expect(solidRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with selected style on click', () => {
    const handleChange = vi.fn();
    render(
      <DividerStyleSelector
        value="solid"
        options={DIVIDER_STYLE_OPTIONS}
        onChange={handleChange}
      />
    );

    const dashedCard = screen.getByRole('radio', { name: /Modern Dashed/i });
    fireEvent.click(dashedCard);
    expect(handleChange).toHaveBeenCalledWith('dashed');
  });

  it('supports keyboard ArrowRight navigation and DOM focus movement', () => {
    const handleChange = vi.fn();
    render(
      <DividerStyleSelector
        value="solid"
        options={DIVIDER_STYLE_OPTIONS}
        onChange={handleChange}
      />
    );

    const solidCard = screen.getByRole('radio', { name: /Solid Continuous/i });
    fireEvent.keyDown(solidCard, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('dashed');
  });
});
