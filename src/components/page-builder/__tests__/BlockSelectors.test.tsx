/**
 * @fileOverview Consolidated Block Selectors & Form Controls UI Suite
 * Validates accessibility (radiogroup, aria-checked, keyboard arrow roving),
 * interactions, change handlers, and mobile touch targets for:
 * - AspectRatioSelector
 * - DividerSegmentedControls (Width, Thickness, Spacing)
 * - DividerStyleSelector
 * - ImagePresetSelector & Progressive Disclosure field definitions
 * - LineSpacingSelector
 * - ListPresetSelector
 * - MediaPlacementSelector
 * - NumberStepperControl
 * - PlayButtonArchetypeSelector
 * - PlaybackModeSelector
 * - ProcedurePresetSelector
 * - VideoPresetSelector
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { AspectRatioSelector } from '../AspectRatioSelector';
import {
  DividerWidthSelector,
  DividerThicknessSelector,
  DividerSpacingSelector,
} from '../DividerSegmentedControls';
import { DividerStyleSelector } from '../DividerStyleSelector';
import { ImagePresetSelector } from '../ImagePresetSelector';
import { LineSpacingSelector } from '../LineSpacingSelector';
import { ListPresetSelector } from '../ListPresetSelector';
import { MediaPlacementSelector } from '../MediaPlacementSelector';
import { NumberStepperControl } from '../NumberStepperControl';
import { PlayButtonArchetypeSelector } from '../PlayButtonArchetypeSelector';
import { PlaybackModeSelector } from '../PlaybackModeSelector';
import { ProcedurePresetSelector } from '../ProcedurePresetSelector';
import { VideoPresetSelector } from '../VideoPresetSelector';

import {
  DIVIDER_WIDTH_OPTIONS,
  DIVIDER_THICKNESS_OPTIONS,
  DIVIDER_SPACING_OPTIONS,
  DIVIDER_STYLE_OPTIONS,
} from '@/lib/page-builder/blocks/divider';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

/* ==============================================================================
 * 1. AspectRatioSelector
 * ============================================================================== */
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

/* ==============================================================================
 * 2. Divider Segmented Controls
 * ============================================================================== */
describe('Divider Segmented Controls', () => {
  describe('DividerWidthSelector', () => {
    it('renders all width options and updates on click', () => {
      const handleChange = vi.fn();
      render(
        <DividerWidthSelector
          value="full"
          options={DIVIDER_WIDTH_OPTIONS}
          onChange={handleChange}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /Line Width/i })).toBeInTheDocument();
      const halfButton = screen.getByRole('radio', { name: /50% Half/i });
      fireEvent.click(halfButton);
      expect(handleChange).toHaveBeenCalledWith('medium');
    });
  });

  describe('DividerThicknessSelector', () => {
    it('renders stroke weight options with visual thickness indicators', () => {
      const handleChange = vi.fn();
      render(
        <DividerThicknessSelector
          value="hairline"
          options={DIVIDER_THICKNESS_OPTIONS}
          onChange={handleChange}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /Stroke Thickness/i })).toBeInTheDocument();
      const thickButton = screen.getByRole('radio', { name: /4px Thick/i });
      fireEvent.click(thickButton);
      expect(handleChange).toHaveBeenCalledWith('thick');
    });
  });

  describe('DividerSpacingSelector', () => {
    it('renders vertical padding options and handles click', () => {
      const handleChange = vi.fn();
      render(
        <DividerSpacingSelector
          value="medium"
          options={DIVIDER_SPACING_OPTIONS}
          onChange={handleChange}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /Vertical Padding/i })).toBeInTheDocument();
      const spaciousButton = screen.getByRole('radio', { name: /Spacious \(64px\)/i });
      fireEvent.click(spaciousButton);
      expect(handleChange).toHaveBeenCalledWith('spacious');
    });
  });
});

/* ==============================================================================
 * 3. DividerStyleSelector
 * ============================================================================== */
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

/* ==============================================================================
 * 4. ImagePresetSelector & Field Definitions
 * ============================================================================== */
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

  it('exposes clean UI English labels for fine-tuning controls', () => {
    const imageDef = getBlock('image')!;
    const fields = imageDef.fields;
    expect(fields.find((f) => f.key === 'preset')?.label).toBe('Preset Style');
    expect(fields.find((f) => f.key === 'aspectRatio')?.label).toBe('Aspect Ratio');
    expect(fields.find((f) => f.key === 'borderRadius')?.label).toBe('Corner Shape & Mask');
    expect(fields.find((f) => f.key === 'elevation')?.label).toBe('Elevation & Frame');
    expect(fields.find((f) => f.key === 'hoverEffect')?.label).toBe('Hover Animation');
    expect(fields.find((f) => f.key === 'objectFit')?.label).toBe('Image Fit Mode');
  });
});

/* ==============================================================================
 * 5. LineSpacingSelector
 * ============================================================================== */
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

    fireEvent.keyDown(normalRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('relaxed');

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

/* ==============================================================================
 * 6. ListPresetSelector
 * ============================================================================== */
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
  });

  it('marks active preset with aria-checked="true" and tabIndex 0', () => {
    render(<ListPresetSelector value="cards" options={options} onChange={() => {}} />);
    const cardsRadio = screen.getByRole('radio', { name: /Item Cards/i });
    expect(cardsRadio).toHaveAttribute('aria-checked', 'true');
    expect(cardsRadio).toHaveAttribute('tabindex', '0');
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

/* ==============================================================================
 * 7. MediaPlacementSelector
 * ============================================================================== */
describe('MediaPlacementSelector', () => {
  const options = [
    { value: 'top', label: 'Media on Top' },
    { value: 'bottom', label: 'Media at Bottom' },
    { value: 'left', label: 'Media on Left' },
    { value: 'right', label: 'Media on Right' },
  ];

  it('renders all 4 media placement options with accessible radio roles', () => {
    render(<MediaPlacementSelector value="bottom" options={options} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: /media align placement/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks current placement as aria-checked with checkmark indicator', () => {
    render(<MediaPlacementSelector value="bottom" options={options} onChange={vi.fn()} />);
    const selected = screen.getByRole('radio', { name: /media at bottom/i });
    expect(selected).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with selected placement value when clicked', () => {
    const handleChange = vi.fn();
    render(<MediaPlacementSelector value="bottom" options={options} onChange={handleChange} />);
    const leftCard = screen.getByRole('radio', { name: /media on left/i });
    fireEvent.click(leftCard);
    expect(handleChange).toHaveBeenCalledWith('left');
  });

  it('supports roving tabindex keyboard navigation with arrow keys and focus transfer', () => {
    const handleChange = vi.fn();
    render(<MediaPlacementSelector value="top" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /media on top/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('bottom');
  });
});

/* ==============================================================================
 * 8. NumberStepperControl
 * ============================================================================== */
describe('NumberStepperControl', () => {
  it('renders spinbutton input and decrement/increment buttons', () => {
    render(
      <NumberStepperControl
        label="Step Index / Sequence"
        value={1}
        min={1}
        onChange={vi.fn()}
      />
    );

    const spinbutton = screen.getByRole('spinbutton', { name: /step index \/ sequence/i });
    expect(spinbutton).toBeInTheDocument();
    expect(spinbutton).toHaveValue(1);

    const decBtn = screen.getByRole('button', { name: /decrement/i });
    const incBtn = screen.getByRole('button', { name: /increment/i });
    expect(decBtn).toBeInTheDocument();
    expect(incBtn).toBeInTheDocument();
  });

  it('increments value by step on increment button click', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={2}
        min={1}
        step={1}
        onChange={handleChange}
      />
    );

    const incBtn = screen.getByRole('button', { name: /increment/i });
    fireEvent.click(incBtn);
    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it('decrements value by step on decrement button click', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={3}
        min={1}
        step={1}
        onChange={handleChange}
      />
    );

    const decBtn = screen.getByRole('button', { name: /decrement/i });
    fireEvent.click(decBtn);
    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('disables decrement button and prevents going below min', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={1}
        min={1}
        onChange={handleChange}
      />
    );

    const decBtn = screen.getByRole('button', { name: /decrement/i });
    expect(decBtn).toBeDisabled();
    fireEvent.click(decBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('disables increment button and prevents going above max', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={5}
        min={1}
        max={5}
        onChange={handleChange}
      />
    );

    const incBtn = screen.getByRole('button', { name: /increment/i });
    expect(incBtn).toBeDisabled();
    fireEvent.click(incBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('handles direct input change and sanitizes input', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={1}
        min={1}
        onChange={handleChange}
      />
    );

    const spinbutton = screen.getByRole('spinbutton', { name: /step index/i });
    fireEvent.change(spinbutton, { target: { value: '4' } });
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it('supports keyboard navigation via ArrowUp and ArrowDown', () => {
    const handleChange = vi.fn();
    render(
      <NumberStepperControl
        label="Step Index"
        value={2}
        min={1}
        onChange={handleChange}
      />
    );

    const spinbutton = screen.getByRole('spinbutton', { name: /step index/i });
    fireEvent.keyDown(spinbutton, { key: 'ArrowUp' });
    expect(handleChange).toHaveBeenCalledWith(3);

    fireEvent.keyDown(spinbutton, { key: 'ArrowDown' });
    expect(handleChange).toHaveBeenCalledWith(1);
  });
});

/* ==============================================================================
 * 9. PlayButtonArchetypeSelector
 * ============================================================================== */
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

  it('supports roving tabindex keyboard navigation with arrow keys', () => {
    const handleChange = vi.fn();
    render(<PlayButtonArchetypeSelector value="pulse" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /radar \/ pulse waves/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('glass-pill');
  });
});

/* ==============================================================================
 * 10. PlaybackModeSelector
 * ============================================================================== */
describe('PlaybackModeSelector', () => {
  it('renders header and mode cards', () => {
    render(<PlaybackModeSelector value="inline" onChange={() => {}} />);
    expect(screen.getByText('VISUAL MODE PREVIEW')).toBeInTheDocument();
    expect(screen.getByText('Inline View')).toBeInTheDocument();
    expect(screen.getByText('Lightbox View')).toBeInTheDocument();
  });

  it('indicates active selected mode with aria-checked and checkmark badge', () => {
    const { rerender } = render(<PlaybackModeSelector value="inline" onChange={() => {}} />);
    const inlineRadio = screen.getByRole('radio', { name: /Inline View/i });
    const modalRadio = screen.getByRole('radio', { name: /Lightbox View/i });

    expect(inlineRadio).toHaveAttribute('aria-checked', 'true');
    expect(modalRadio).toHaveAttribute('aria-checked', 'false');

    rerender(<PlaybackModeSelector value="modal" onChange={() => {}} />);
    expect(inlineRadio).toHaveAttribute('aria-checked', 'false');
    expect(modalRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with modal when Lightbox View is clicked', () => {
    const onChange = vi.fn();
    render(<PlaybackModeSelector value="inline" onChange={onChange} />);
    const modalRadio = screen.getByRole('radio', { name: /Lightbox View/i });
    fireEvent.click(modalRadio);
    expect(onChange).toHaveBeenCalledWith('modal');
  });

  it('calls onChange with inline when Inline View is clicked', () => {
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

/* ==============================================================================
 * 11. ProcedurePresetSelector
 * ============================================================================== */
describe('ProcedurePresetSelector Component', () => {
  const options = [
    { value: 'connected-timeline', label: 'Connected Timeline' },
    { value: 'elevated-cards', label: 'Elevated Cards' },
    { value: 'split-media', label: 'Split-Media Guide' },
    { value: 'minimal-clean', label: 'Minimal Clean' },
    { value: 'compact-badges', label: 'Compact Badges' },
  ];

  it('renders all 5 preset options with radiogroup accessibility semantics', () => {
    render(<ProcedurePresetSelector value="connected-timeline" options={options} onChange={vi.fn()} />);
    const radiogroup = screen.getByRole('radiogroup', { name: /procedure preset archetype/i });
    expect(radiogroup).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('calls onChange with selected value when clicked', () => {
    const onChange = vi.fn();
    render(<ProcedurePresetSelector value="connected-timeline" options={options} onChange={onChange} />);
    const cardsButton = screen.getByRole('radio', { name: 'Elevated Cards' });
    fireEvent.click(cardsButton);
    expect(onChange).toHaveBeenCalledWith('elevated-cards');
  });

  it('supports roving arrow key navigation across preset cards', () => {
    const onChange = vi.fn();
    render(<ProcedurePresetSelector value="connected-timeline" options={options} onChange={onChange} />);
    const firstButton = screen.getByRole('radio', { name: 'Connected Timeline' });
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('elevated-cards');
  });

  it('satisfies minimum 44px mobile touch targets', () => {
    render(<ProcedurePresetSelector value="connected-timeline" options={options} onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio.className).toContain('min-h-');
    });
  });
});

/* ==============================================================================
 * 12. VideoPresetSelector
 * ============================================================================== */
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

  it('supports roving tabindex keyboard navigation with arrow keys', () => {
    const handleChange = vi.fn();
    render(<VideoPresetSelector value="ambient-loop" options={options} onChange={handleChange} />);
    const firstRadio = screen.getByRole('radio', { name: /ambient background loop/i });
    fireEvent.keyDown(firstRadio, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('hero-walkthrough', expect.any(Object));
  });
});
