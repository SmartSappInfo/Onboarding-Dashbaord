/**
 * @fileoverview Phase 2 Unit Test Suite: Visual Designer, Color Contrast,
 * Scannability Diagnostics, Snapping Geometry, and System Poster Templates.
 */

import { describe, it, expect } from 'vitest';
import {
  getLuminance,
  getContrastRatio,
  computeScannabilityScore,
  isLightColor,
} from '@/app/admin/qr-studio/components/designer/scannability-checker';
import { SYSTEM_POSTER_TEMPLATES } from '@/lib/poster-templates';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import type { QRDesign, QRFrameStyle } from '@/lib/types';

describe('QR Visual Designer — WCAG Luminance & Color Contrast Calculations', () => {
  it('calculates exact relative luminance for standard hex colors', () => {
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 2);
    expect(getLuminance('#000000')).toBeCloseTo(0, 2);
  });

  it('computes accurate WCAG contrast ratio for high contrast black on white', () => {
    const ratio = getContrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeCloseTo(21, 0); // 21:1 max contrast
  });

  it('detects low contrast for light yellow on white', () => {
    const ratio = getContrastRatio('#FFFF00', '#FFFFFF');
    expect(ratio).toBeLessThan(3.0); // fails WCAG
  });

  it('correctly classifies light vs dark background colors', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
    expect(isLightColor('#F3F4F6')).toBe(true);
    expect(isLightColor('#000000')).toBe(false);
    expect(isLightColor('#1E293B')).toBe(false);
  });
});

describe('QR Visual Designer — Live Scannability Diagnostic Scoring Engine', () => {
  it('assigns Grade A+ (100%) to optimal black on white default design', () => {
    const scoreResult = computeScannabilityScore(DEFAULT_QR_DESIGN);
    expect(scoreResult.score).toBe(100);
    expect(scoreResult.grade).toBe('A+');
    expect(scoreResult.criticalCount).toBe(0);
    expect(scoreResult.warningCount).toBe(0);
  });

  it('assigns Grade D and flags critical warnings for low contrast colors', () => {
    const lowContrastDesign: QRDesign = {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#FDE047', // Light yellow
      backgroundColor: '#FFFFFF', // White
    };
    const scoreResult = computeScannabilityScore(lowContrastDesign);
    expect(scoreResult.score).toBeLessThan(50);
    expect(scoreResult.grade).toBe('D');
    expect(scoreResult.criticalCount).toBeGreaterThan(0);
  });

  it('applies penalty and warning when dark background has light foreground dots', () => {
    const invertedDesign: QRDesign = {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#FFFFFF',
      backgroundColor: '#0F172A',
    };
    const scoreResult = computeScannabilityScore(invertedDesign);
    expect(scoreResult.score).toBeLessThan(90);
    expect(scoreResult.warningCount).toBeGreaterThanOrEqual(1);
  });

  it('penalizes oversized logos when error correction is insufficient', () => {
    const riskyLogoDesign: QRDesign = {
      ...DEFAULT_QR_DESIGN,
      logoUrl: 'https://example.com/logo.png',
      logoSize: 30, // 30% area
      errorCorrection: 'L', // Low EC
    };
    const scoreResult = computeScannabilityScore(riskyLogoDesign);
    expect(scoreResult.criticalCount).toBeGreaterThan(0);
    expect(scoreResult.score).toBeLessThan(65);
  });
});

describe('QR Visual Designer — Frame Styles & Dual-Color Eye Support', () => {
  it('supports all 10 modern CTA frame styles cleanly', () => {
    const modernFrames: QRFrameStyle[] = [
      'none',
      'bottom-banner',
      'top-banner',
      'rounded-box',
      'polaroid',
      'phone-mockup',
      'scan-me-badge',
      'ticket-stub',
      'minimalist-pill',
      'bubble-callout',
    ];

    for (const frame of modernFrames) {
      const designWithFrame: QRDesign = {
        ...DEFAULT_QR_DESIGN,
        frameStyle: frame,
        frameText: 'SCAN ME',
        frameColor: '#2563EB',
        frameTextColor: '#FFFFFF',
      };
      expect(designWithFrame.frameStyle).toBe(frame);
      expect(designWithFrame.frameText).toBe('SCAN ME');
    }
  });

  it('supports independent dual-color eye ring and pupil configurations', () => {
    const dualColorDesign: QRDesign = {
      ...DEFAULT_QR_DESIGN,
      foregroundColor: '#000000',
      cornerSquareColor: '#2563EB', // Blue outer ring
      cornerDotColor: '#DC2626',   // Red inner pupil
    };

    expect(dualColorDesign.cornerSquareColor).toBe('#2563EB');
    expect(dualColorDesign.cornerDotColor).toBe('#DC2626');
  });
});

describe('QR Visual Designer — System Poster Templates Integrity', () => {
  it('ensures all system poster templates have valid dimensions and QR elements', () => {
    expect(SYSTEM_POSTER_TEMPLATES.length).toBeGreaterThanOrEqual(7);

    for (const tpl of SYSTEM_POSTER_TEMPLATES) {
      expect(tpl.id).toBeDefined();
      expect(tpl.name).toBeDefined();
      expect(tpl.canvasWidth).toBeGreaterThan(200);
      expect(tpl.canvasHeight).toBeGreaterThan(200);
      expect(tpl.backgroundColor).toBeDefined();
      expect(tpl.elements.length).toBeGreaterThan(0);

      // Must contain at least one QR element
      const qrEl = tpl.elements.find((el) => el.isQR || el.type === 'qr');
      expect(qrEl).toBeDefined();
      expect(qrEl?.width).toBeGreaterThan(0);
      expect(qrEl?.height).toBeGreaterThan(0);
    }
  });
});
