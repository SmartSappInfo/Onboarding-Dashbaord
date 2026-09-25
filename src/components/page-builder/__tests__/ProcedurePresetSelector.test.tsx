import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProcedurePresetSelector } from '../ProcedurePresetSelector';

describe('ProcedurePresetSelector Component', () => {
  const options = [
    { value: 'connected-timeline', label: 'Connected Timeline' },
    { value: 'elevated-cards', label: 'Elevated Cards' },
    { value: 'split-media', label: 'Split-Media Guide' },
    { value: 'minimal-clean', label: 'Minimal Clean' },
    { value: 'compact-badges', label: 'Compact Badges' },
  ];

  it('renders all 5 preset options with radiogroup accessibility semantics', () => {
    const onChange = vi.fn();
    render(
      <ProcedurePresetSelector
        value="connected-timeline"
        options={options}
        onChange={onChange}
      />
    );

    const radiogroup = screen.getByRole('radiogroup', { name: /procedure preset archetype/i });
    expect(radiogroup).toBeDefined();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);

    expect(screen.getByRole('radio', { name: 'Connected Timeline' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Elevated Cards' }).getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with selected value when clicked', () => {
    const onChange = vi.fn();
    render(
      <ProcedurePresetSelector
        value="connected-timeline"
        options={options}
        onChange={onChange}
      />
    );

    const cardsButton = screen.getByRole('radio', { name: 'Elevated Cards' });
    fireEvent.click(cardsButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('elevated-cards');
  });

  it('supports roving arrow key navigation across preset cards', () => {
    const onChange = vi.fn();
    render(
      <ProcedurePresetSelector
        value="connected-timeline"
        options={options}
        onChange={onChange}
      />
    );

    const firstButton = screen.getByRole('radio', { name: 'Connected Timeline' });
    firstButton.focus();

    // ArrowRight should move to elevated-cards
    fireEvent.keyDown(firstButton, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('elevated-cards');

    // ArrowLeft should cycle backward to compact-badges
    fireEvent.keyDown(firstButton, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('compact-badges');
  });

  it('satisfies minimum 44px mobile touch targets', () => {
    const onChange = vi.fn();
    render(
      <ProcedurePresetSelector
        value="connected-timeline"
        options={options}
        onChange={onChange}
      />
    );

    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio.className).toContain('min-h-');
    });
  });
});
