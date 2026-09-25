import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ListPresetSelector } from '../ListPresetSelector';

describe('ListPresetSelector Component', () => {
  const options = [
    { value: 'checklist', label: 'Checkmark Feature List' },
    { value: 'bullet', label: 'Classic Bulleted List' },
    { value: 'numbered', label: 'Numbered Steps' },
    { value: 'cards', label: 'Item Cards' },
    { value: 'minimal-dash', label: 'Minimal Dash' },
    { value: 'icon-pill', label: 'Compact Pills' },
    { value: 'stepped-gradient', label: 'Stepped Gradient' },
    { value: 'bordered-rows', label: 'Bordered Rows' },
  ];

  it('renders with radiogroup role and aria-label', () => {
    render(<ListPresetSelector value="checklist" options={options} onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: /List Preset Style/i });
    expect(group).toBeInTheDocument();
  });

  it('renders all 8 preset style options with radio role', () => {
    render(<ListPresetSelector value="checklist" options={options} onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(8);

    expect(screen.getByRole('radio', { name: /Checkmark Feature List/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Classic Bulleted List/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Numbered Steps/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Item Cards/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Minimal Dash/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Compact Pills/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Stepped Gradient/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Bordered Rows/i })).toBeInTheDocument();
  });

  it('marks active preset with aria-checked="true" and tabIndex 0', () => {
    render(<ListPresetSelector value="cards" options={options} onChange={() => {}} />);

    const cardsRadio = screen.getByRole('radio', { name: /Item Cards/i });
    expect(cardsRadio).toHaveAttribute('aria-checked', 'true');
    expect(cardsRadio).toHaveAttribute('tabindex', '0');

    const checklistRadio = screen.getByRole('radio', { name: /Checkmark Feature List/i });
    expect(checklistRadio).toHaveAttribute('aria-checked', 'false');
    expect(checklistRadio).toHaveAttribute('tabindex', '-1');
  });

  it('calls onChange when clicking a different preset', () => {
    const handleChange = vi.fn();
    render(<ListPresetSelector value="checklist" options={options} onChange={handleChange} />);

    const numberedRadio = screen.getByRole('radio', { name: /Numbered Steps/i });
    fireEvent.click(numberedRadio);

    expect(handleChange).toHaveBeenCalledWith('numbered');
  });

  it('cycles through presets on ArrowRight and ArrowLeft keyboard events', () => {
    const handleChange = vi.fn();
    render(<ListPresetSelector value="checklist" options={options} onChange={handleChange} />);

    const checklistRadio = screen.getByRole('radio', { name: /Checkmark Feature List/i });

    // ArrowRight should move from index 0 (checklist) to index 1 (bullet)
    fireEvent.keyDown(checklistRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('bullet');

    // ArrowLeft should cycle backward from index 0 to index 7 (bordered-rows)
    fireEvent.keyDown(checklistRadio, { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith('bordered-rows');
  });
});
