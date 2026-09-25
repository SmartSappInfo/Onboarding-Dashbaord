import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  DividerWidthSelector,
  DividerThicknessSelector,
  DividerSpacingSelector,
} from '../DividerSegmentedControls';
import {
  DIVIDER_WIDTH_OPTIONS,
  DIVIDER_THICKNESS_OPTIONS,
  DIVIDER_SPACING_OPTIONS,
} from '@/lib/page-builder/blocks/divider';

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
