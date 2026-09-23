import { describe, it, expect } from 'vitest';
import {
  isValidHex,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToHex,
  getContrastRatio,
  generateHarmoniousDarkPalette,
  resolveActivePortalColors,
  resolvePortalThemeStyles,
} from '../portal-theme-generator';
import type { PortalThemeColors, PortalThemeConfig } from '@/lib/types/portal';

describe('portal-theme-generator', () => {
  const sampleLightColors: PortalThemeColors = {
    primary: '#3B82F6',
    secondary: '#1E293B',
    accent: '#6366F1',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#0F172A',
    mutedText: '#64748B',
    border: '#E2E8F0',
  };

  const sampleThemeConfig: PortalThemeConfig = {
    colors: sampleLightColors,
    typography: {
      headingFont: 'Plus Jakarta Sans',
      bodyFont: 'Inter',
      baseSize: 'md',
    },
    ui: {
      borderRadius: 'lg',
      buttonStyle: 'flat',
    },
    colorMode: 'user_choice',
  };

  describe('hex and color conversions', () => {
    it('validates 3 and 6 digit hex colors correctly', () => {
      expect(isValidHex('#FFF')).toBe(true);
      expect(isValidHex('#3B82F6')).toBe(true);
      expect(isValidHex('#3b82f6')).toBe(true);
      expect(isValidHex('3B82F6')).toBe(false);
      expect(isValidHex('rgb(255, 0, 0)')).toBe(false);
      expect(isValidHex('#GGGGGG')).toBe(false);
    });

    it('converts hex to RGB and back accurately', () => {
      const rgb = hexToRgb('#3B82F6');
      expect(rgb).toEqual({ r: 59, g: 130, b: 246 });
      expect(rgbToHex(rgb.r, rgb.g, rgb.b)).toBe('#3B82F6');
    });

    it('handles 3-digit hex expansion', () => {
      const rgb = hexToRgb('#FFF');
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
      expect(rgbToHex(rgb.r, rgb.g, rgb.b)).toBe('#FFFFFF');
    });

    it('converts RGB to HSL and back', () => {
      const hsl = rgbToHsl(59, 130, 246);
      expect(hsl.h).toBeGreaterThanOrEqual(210);
      expect(hsl.h).toBeLessThanOrEqual(220);
      const hex = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(isValidHex(hex)).toBe(true);
    });
  });

  describe('WCAG contrast and dark palette synthesis', () => {
    it('calculates WCAG 2.1 contrast ratio accurately', () => {
      const ratioBlackWhite = getContrastRatio('#000000', '#FFFFFF');
      expect(ratioBlackWhite).toBe(21);

      const ratioIdentical = getContrastRatio('#3B82F6', '#3B82F6');
      expect(ratioIdentical).toBe(1);
    });

    it('generates a harmonious dark palette meeting WCAG AA standards', () => {
      const darkPalette = generateHarmoniousDarkPalette(sampleLightColors);

      // Verify all 8 tokens are present
      expect(darkPalette.primary).toBeDefined();
      expect(darkPalette.secondary).toBeDefined();
      expect(darkPalette.accent).toBeDefined();
      expect(darkPalette.background).toBeDefined();
      expect(darkPalette.surface).toBeDefined();
      expect(darkPalette.text).toBeDefined();
      expect(darkPalette.mutedText).toBeDefined();
      expect(darkPalette.border).toBeDefined();

      // Verify dark background is deep
      const bgRgb = hexToRgb(darkPalette.background);
      expect(bgRgb.r).toBeLessThan(30);
      expect(bgRgb.g).toBeLessThan(30);
      expect(bgRgb.b).toBeLessThan(40);

      // Verify text contrast against dark background is >= 7.0 (AAA)
      const textContrast = getContrastRatio(darkPalette.text, darkPalette.background);
      expect(textContrast).toBeGreaterThanOrEqual(7.0);

      // Verify muted text contrast is >= 4.5 (AA)
      const mutedContrast = getContrastRatio(darkPalette.mutedText, darkPalette.background);
      expect(mutedContrast).toBeGreaterThanOrEqual(4.5);

      // Verify primary contrast against dark background is >= 4.5 (AA)
      const primaryContrast = getContrastRatio(darkPalette.primary, darkPalette.background);
      expect(primaryContrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('theme resolution & scoped CSS variables', () => {
    it('resolves light mode colors directly from config', () => {
      const colors = resolveActivePortalColors(sampleThemeConfig, 'light');
      expect(colors.background).toBe('#FFFFFF');
      expect(colors.text).toBe('#0F172A');
      expect(colors.primary).toBe('#3B82F6');
    });

    it('auto-generates dark mode colors when darkColors is undefined', () => {
      const colors = resolveActivePortalColors(sampleThemeConfig, 'dark');
      expect(colors.text).toBe('#F8FAFC');
      const textContrast = getContrastRatio(colors.text, colors.background);
      expect(textContrast).toBeGreaterThanOrEqual(7.0);
    });

    it('honors explicit darkColors overrides over auto-generated values', () => {
      const themeWithCustomDark: PortalThemeConfig = {
        ...sampleThemeConfig,
        darkColors: {
          primary: '#EC4899', // Custom Hot Pink
          background: '#050505',
        },
      };

      const colors = resolveActivePortalColors(themeWithCustomDark, 'dark');
      expect(colors.primary).toBe('#EC4899');
      expect(colors.background).toBe('#050505');
      // Non-overridden tokens fall back to auto-generated dark values
      expect(colors.text).toBe('#F8FAFC');
    });

    it('generates scoped CSS variables including colorScheme and shadcn overrides', () => {
      const lightStyles = resolvePortalThemeStyles(sampleThemeConfig, 'light');
      expect(lightStyles.colorScheme).toBe('light');
      expect((lightStyles as Record<string, string>)['--portal-bg']).toBe('#FFFFFF');
      expect((lightStyles as Record<string, string>)['--portal-text']).toBe('#0F172A');
      expect((lightStyles as Record<string, string>)['--background']).toBeDefined();

      const darkStyles = resolvePortalThemeStyles(sampleThemeConfig, 'dark');
      expect(darkStyles.colorScheme).toBe('dark');
      expect((darkStyles as Record<string, string>)['--portal-text']).toBe('#F8FAFC');
    });
  });
});
