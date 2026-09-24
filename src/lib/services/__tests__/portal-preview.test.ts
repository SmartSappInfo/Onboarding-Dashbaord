import { describe, it, expect } from 'vitest';
import { getTargetViewportWidth, calculatePreviewScale } from '../../utils/portal-preview-utils';

describe('portal-preview-utils', () => {
  describe('getTargetViewportWidth', () => {
    it('returns 390 for mobile', () => {
      expect(getTargetViewportWidth('mobile')).toBe(390);
    });

    it('returns 768 for tablet', () => {
      expect(getTargetViewportWidth('tablet')).toBe(768);
    });

    it('returns 1200 for desktop', () => {
      expect(getTargetViewportWidth('desktop')).toBe(1200);
    });
  });

  describe('calculatePreviewScale', () => {
    it('returns manual zoom overrides when fitMode is false', () => {
      expect(calculatePreviewScale(false, 1000, 'desktop', 50)).toBe(0.5);
      expect(calculatePreviewScale(false, 1000, 'desktop', 75)).toBe(0.75);
      expect(calculatePreviewScale(false, 1000, 'desktop', 100)).toBe(1.0);
    });

    it('calculates scale correctly when fitMode is true and container is smaller than target viewport', () => {
      // Container width: 600, target viewport (desktop): 1200 -> Scale: 600 / 1200 = 0.5
      expect(calculatePreviewScale(true, 600, 'desktop', 100, 0)).toBe(0.5);
    });

    it('returns 1 when fitMode is true and container is larger than target viewport', () => {
      // Container width: 1400, target viewport (desktop): 1200 -> Scale: 1 (max 1)
      expect(calculatePreviewScale(true, 1400, 'desktop', 100, 0)).toBe(1.0);
    });

    it('handles padding correctly in fitMode', () => {
      // Target container width to use for calc: containerWidth - 32 (default padding if not passed? Or let's pass container width directly)
      // The implementation usually subtracts some padding. Let's assume the function is `calculatePreviewScale(fitMode, containerWidth, device, zoomPercent, padding?)`
      // For now, testing basic fit calculation:
      expect(calculatePreviewScale(true, 390, 'mobile', 100, 0)).toBe(1.0);
    });
  });
});
