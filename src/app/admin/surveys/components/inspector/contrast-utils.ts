/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — WCAG 2.1 Contrast Ratio Engine & Theme Color Bridge
 */

import type { ContrastScoreResult } from './types';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  const sanitized = hex.replace(/^#/, '').trim();
  if (sanitized.length === 3) {
    return {
      r: parseInt(sanitized[0] + sanitized[0], 16),
      g: parseInt(sanitized[1] + sanitized[1], 16),
      b: parseInt(sanitized[2] + sanitized[2], 16),
    };
  }
  if (sanitized.length === 6) {
    return {
      r: parseInt(sanitized.substring(0, 2), 16),
      g: parseInt(sanitized.substring(2, 4), 16),
      b: parseInt(sanitized.substring(4, 6), 16),
    };
  }
  return null;
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrastScore(bgHex: string, textHex: string = '#0F172A'): ContrastScoreResult {
  const rgbBg = hexToRgb(bgHex) || { r: 241, g: 245, b: 249 };
  const rgbText = hexToRgb(textHex) || { r: 15, g: 23, b: 42 };

  const lumBg = getRelativeLuminance(rgbBg.r, rgbBg.g, rgbBg.b);
  const lumText = getRelativeLuminance(rgbText.r, rgbText.g, rgbText.b);

  const l1 = Math.max(lumBg, lumText);
  const l2 = Math.min(lumBg, lumText);
  const ratio = Number(((l1 + 0.05) / (l2 + 0.05)).toFixed(2));

  const isAaaPassed = ratio >= 7.0;
  const isAaPassed = ratio >= 4.5;

  let status: ContrastScoreResult['status'] = 'fail';
  if (isAaaPassed) status = 'excellent';
  else if (isAaPassed) status = 'good';
  else if (ratio >= 3.0) status = 'warning';

  return {
    ratio,
    scoreText: `${ratio}:1`,
    isAaPassed,
    isAaaPassed,
    status,
  };
}

/**
 * Converts a hex color string into a Tailwind-compatible HSL string (e.g. "160 84% 39%")
 * so that CSS variables work seamlessly with hsl(var(--primary)).
 */
export function hexToHslString(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '230 97% 59%'; // Fallback to standard primary
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
}

/**
 * Returns either '#FFFFFF' or '#0F172A' depending on which text color provides
 * maximum WCAG contrast ratio on top of the given background hex color.
 */
export function getContrastTextColor(bgHex: string): string {
  if (!bgHex) return '#FFFFFF';
  const whiteScore = calculateContrastScore(bgHex, '#FFFFFF');
  const darkScore = calculateContrastScore(bgHex, '#0F172A');
  return whiteScore.ratio >= darkScore.ratio ? '#FFFFFF' : '#0F172A';
}

/**
 * Generates inline style properties for theme buttons ensuring high contrast and consistent brand color.
 */
export function getContrastButtonStyles(accentColor?: string): { backgroundColor: string; color: string } {
  const bg = accentColor || '#3B82F6';
  const color = getContrastTextColor(bg);
  return { backgroundColor: bg, color };
}
