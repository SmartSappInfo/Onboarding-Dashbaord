/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — WCAG 2.1 Contrast Ratio Engine
 */

import type { ContrastScoreResult } from './types';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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

function getRelativeLuminance(r: number, g: number, b: number): number {
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
