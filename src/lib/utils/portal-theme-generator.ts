/**
 * @fileOverview Pure Mathematical Color Engine & Portal Theme Generator
 *
 * Provides WCAG 2.1-compliant color transformations, contrast verification,
 * automated dark palette synthesis, and scoped CSS variable resolution.
 *
 * Zero external runtime dependencies.
 * Zero `any`, `any[]`, or `unknown` typing.
 *
 * MAINTAINER GUIDANCE (Rule 10):
 * - All hex strings are sanitized via HEX_REGEX before conversion.
 * - Luminance and contrast algorithms strictly follow W3C WCAG 2.1 formulas.
 * - Changes to dark palette generation lightness formulas should be verified
 *   against WCAG AA minimum 4.5:1 contrast requirements.
 */

import type { PortalThemeColors, PortalThemeConfig } from '@/lib/types/portal';
import type * as React from 'react';

// Strict hex color regex supporting #RGB and #RRGGBB
const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HslColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Validates whether a given string is a well-formed 3 or 6 digit hex color.
 */
export function isValidHex(hex: string): boolean {
  return HEX_REGEX.test(hex.trim());
}

/**
 * Parses a hex color string into standard RGB components.
 * Fallbacks to #000000 if invalid.
 */
export function hexToRgb(hex: string): RgbColor {
  const cleanHex = hex.trim();
  if (!isValidHex(cleanHex)) {
    return { r: 0, g: 0, b: 0 };
  }

  let normalized = cleanHex.slice(1);
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map(char => char + char)
      .join('');
  }

  const intVal = parseInt(normalized, 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

/**
 * Converts standard RGB components into a 6-digit hex color string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (val: number) => clamp(val).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts RGB components (0-255) to HSL components (h: 0-360, s: 0-100, l: 0-100).
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
      default:
        break;
    }
    h = h * 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL components to an RGB object.
 */
export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, tVal: number) => {
    let t = tVal;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = hue2rgb(p, q, hNorm / 360 + 1 / 3);
  const g = hue2rgb(p, q, hNorm / 360);
  const b = hue2rgb(p, q, hNorm / 360 - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Converts HSL components directly into a hex color string.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculates W3C WCAG 2.1 relative luminance for an sRGB color.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function calculateRelativeLuminance(rgb: RgbColor): number {
  const transformChannel = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  const r = transformChannel(rgb.r);
  const g = transformChannel(rgb.g);
  const b = transformChannel(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates the WCAG 2.1 contrast ratio between two hex colors.
 * Return value is in the range of 1 to 21 (e.g. 4.5 for AA normal text, 7.0 for AAA).
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  const l1 = calculateRelativeLuminance(rgb1);
  const l2 = calculateRelativeLuminance(rgb2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}

/**
 * Adjusts a color's lightness and saturation to guarantee a minimum contrast ratio
 * against a target background.
 */
export function ensureMinContrast(
  foregroundHex: string,
  backgroundHex: string,
  minContrast: number = 4.5
): string {
  let ratio = getContrastRatio(foregroundHex, backgroundHex);
  if (ratio >= minContrast) {
    return foregroundHex;
  }

  const rgb = hexToRgb(foregroundHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const bgLuminance = calculateRelativeLuminance(hexToRgb(backgroundHex));

  // If background is dark (luminance < 0.5), we increase lightness
  const step = bgLuminance < 0.5 ? 5 : -5;
  let currentL = hsl.l;

  for (let i = 0; i < 20; i++) {
    currentL = Math.max(5, Math.min(95, currentL + step));
    const testHex = hslToHex(hsl.h, Math.min(hsl.s, 90), currentL);
    ratio = getContrastRatio(testHex, backgroundHex);
    if (ratio >= minContrast) {
      return testHex;
    }
  }

  // Fallback to crisp white or black if extreme saturation prevents threshold
  return bgLuminance < 0.5 ? '#F8FAFC' : '#0F172A';
}

/**
 * Automatically synthesizes an accessible, harmonious dark mode palette from a base
 * light mode theme configuration.
 *
 * Preserves the brand's primary and accent hues while calibrating saturation and
 * lightness for deep, comfortable, WCAG AA/AAA-compliant dark surfaces.
 */
export function generateHarmoniousDarkPalette(lightColors: PortalThemeColors): PortalThemeColors {
  const primaryRgb = hexToRgb(lightColors.primary || '#3B82F6');
  const primaryHsl = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);

  // Subtle hue tinting for dark background and surfaces
  const darkHue = primaryHsl.h;
  const darkBg = hslToHex(darkHue, 20, 6); // Deep charcoal with subtle brand hue (~#090D16)
  const darkSurface = hslToHex(darkHue, 18, 11); // Elevated slate surface (~#111827)
  const darkBorder = hslToHex(darkHue, 14, 18); // Defined subtle divider (~#1F2937)

  // Calibrate primary & accent to ensure high contrast against dark background
  const darkPrimary = ensureMinContrast(
    hslToHex(primaryHsl.h, Math.min(primaryHsl.s, 85), Math.max(primaryHsl.l, 60)),
    darkBg,
    4.5
  );

  const accentRgb = hexToRgb(lightColors.accent || '#6366F1');
  const accentHsl = rgbToHsl(accentRgb.r, accentRgb.g, accentRgb.b);
  const darkAccent = ensureMinContrast(
    hslToHex(accentHsl.h, Math.min(accentHsl.s, 85), Math.max(accentHsl.l, 62)),
    darkBg,
    4.5
  );

  const darkSecondary = hslToHex(primaryHsl.h, 16, 20); // Secondary interactive tone
  const darkText = '#F8FAFC'; // WCAG AAA (>14:1 contrast against darkBg)
  const darkMutedText = '#94A3B8'; // WCAG AA (>6:1 contrast against darkBg)

  return {
    primary: darkPrimary,
    secondary: darkSecondary,
    accent: darkAccent,
    background: darkBg,
    surface: darkSurface,
    text: darkText,
    mutedText: darkMutedText,
    border: darkBorder,
  };
}

/**
 * Resolves the active PortalThemeColors for a given mode ('light' | 'dark').
 * Guarantees a 100% complete set of 8 color tokens with zero undefined values.
 */
export function resolveActivePortalColors(
  theme: PortalThemeConfig,
  mode: 'light' | 'dark'
): PortalThemeColors {
  if (mode === 'light') {
    return {
      primary: theme.colors.primary || '#3B82F6',
      secondary: theme.colors.secondary || '#1E293B',
      accent: theme.colors.accent || '#6366F1',
      background: theme.colors.background || '#FFFFFF',
      surface: theme.colors.surface || '#F8FAFC',
      text: theme.colors.text || '#0F172A',
      mutedText: theme.colors.mutedText || '#64748B',
      border: theme.colors.border || '#E2E8F0',
    };
  }

  // Dark Mode: Fall back to auto-generated dark palette if darkColors is partial or missing
  const autoDark = generateHarmoniousDarkPalette(theme.colors);
  const explicitDark = theme.darkColors || {};

  return {
    primary: explicitDark.primary || autoDark.primary,
    secondary: explicitDark.secondary || autoDark.secondary,
    accent: explicitDark.accent || autoDark.accent,
    background: explicitDark.background || autoDark.background,
    surface: explicitDark.surface || autoDark.surface,
    text: explicitDark.text || autoDark.text,
    mutedText: explicitDark.mutedText || autoDark.mutedText,
    border: explicitDark.border || autoDark.border,
  };
}

/**
 * Resolves border-radius to CSS pixel values.
 */
export function getPortalRadiusCss(borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'): string {
  switch (borderRadius) {
    case 'none':
      return '0px';
    case 'sm':
      return '6px';
    case 'md':
      return '10px';
    case 'lg':
      return '16px';
    case 'full':
      return '9999px';
    default:
      return '12px';
  }
}

/**
 * Produces the complete dictionary of CSS custom properties (variables) for the
 * scoped `.portal-theme-root` wrapper.
 *
 * Crucially resets local shadcn variables (--background, --foreground, etc.) and
 * sets standard `colorScheme` so embedded portal previews are 100% isolated
 * from outer Admin Backoffice styles.
 */
export function resolvePortalThemeStyles(
  theme: PortalThemeConfig,
  mode: 'light' | 'dark'
): React.CSSProperties {
  const activeColors = resolveActivePortalColors(theme, mode);
  const radiusCss = getPortalRadiusCss(theme.ui?.borderRadius);

  // Compute HSL values for local shadcn variable overrides
  const bgRgb = hexToRgb(activeColors.background);
  const bgHsl = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b);

  const textRgb = hexToRgb(activeColors.text);
  const textHsl = rgbToHsl(textRgb.r, textRgb.g, textRgb.b);

  const surfaceRgb = hexToRgb(activeColors.surface);
  const surfaceHsl = rgbToHsl(surfaceRgb.r, surfaceRgb.g, surfaceRgb.b);

  const borderRgb = hexToRgb(activeColors.border);
  const borderHsl = rgbToHsl(borderRgb.r, borderRgb.g, borderRgb.b);

  const primaryRgb = hexToRgb(activeColors.primary);
  const primaryHsl = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);

  return {
    // ── Dedicated Portal Namespace ──────────────────────────────────────────
    ['--portal-primary' as string]: activeColors.primary,
    ['--portal-secondary' as string]: activeColors.secondary,
    ['--portal-accent' as string]: activeColors.accent,
    ['--portal-bg' as string]: activeColors.background,
    ['--portal-surface' as string]: activeColors.surface,
    ['--portal-text' as string]: activeColors.text,
    ['--portal-muted' as string]: activeColors.mutedText,
    ['--portal-border' as string]: activeColors.border,
    ['--portal-radius' as string]: radiusCss,
    ['--portal-heading-font' as string]: `${theme.typography?.headingFont || 'Plus Jakarta Sans'}, sans-serif`,
    ['--portal-body-font' as string]: `${theme.typography?.bodyFont || 'Inter'}, sans-serif`,

    // ── Local shadcn Variable Overrides (Isolation Shield) ──────────────────
    ['--background' as string]: `${bgHsl.h} ${bgHsl.s}% ${bgHsl.l}%`,
    ['--foreground' as string]: `${textHsl.h} ${textHsl.s}% ${textHsl.l}%`,
    ['--card' as string]: `${surfaceHsl.h} ${surfaceHsl.s}% ${surfaceHsl.l}%`,
    ['--card-foreground' as string]: `${textHsl.h} ${textHsl.s}% ${textHsl.l}%`,
    ['--popover' as string]: `${surfaceHsl.h} ${surfaceHsl.s}% ${surfaceHsl.l}%`,
    ['--popover-foreground' as string]: `${textHsl.h} ${textHsl.s}% ${textHsl.l}%`,
    ['--border' as string]: `${borderHsl.h} ${borderHsl.s}% ${borderHsl.l}%`,
    ['--primary' as string]: `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`,

    // ── Standard CSS Engine Isolation ───────────────────────────────────────
    colorScheme: mode,
    fontFamily: `var(--portal-body-font)`,
  };
}
