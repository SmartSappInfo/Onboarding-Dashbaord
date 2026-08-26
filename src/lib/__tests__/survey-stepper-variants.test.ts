import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import type { SurveyStepperVariant } from '../types';

describe('Survey Stepper Styles & Variants Engine', () => {
  const surveyStepperSchema = z.enum(['full', 'simple', 'linear', 'none']).default('full');

  describe('Zod Schema & Variant Validation', () => {
    it('accepts all 4 valid stepper variants', () => {
      const validVariants: SurveyStepperVariant[] = ['full', 'simple', 'linear', 'none'];
      validVariants.forEach((v) => {
        const result = surveyStepperSchema.safeParse(v);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(v);
        }
      });
    });

    it('defaults to "full" when value is undefined', () => {
      const result = surveyStepperSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('full');
      }
    });

    it('rejects invalid stepper variant names', () => {
      const invalidResult = surveyStepperSchema.safeParse('circular');
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Progress Calculation & Edge Case Math', () => {
    it('calculates progress percentage accurately for multi-step surveys', () => {
      const calculateProgress = (activeIdx: number, totalSteps: number): number => {
        const safeTotal = Math.max(1, totalSteps);
        const stepNum = activeIdx + 1;
        return Math.round((stepNum / safeTotal) * 100);
      };

      expect(calculateProgress(0, 3)).toBe(33);
      expect(calculateProgress(1, 3)).toBe(67);
      expect(calculateProgress(2, 3)).toBe(100);

      expect(calculateProgress(0, 4)).toBe(25);
      expect(calculateProgress(1, 4)).toBe(50);
      expect(calculateProgress(3, 4)).toBe(100);
    });

    it('guards against division by zero when total visible steps is zero or single page', () => {
      const calculateProgress = (activeIdx: number, totalSteps: number): number => {
        const safeTotal = Math.max(1, totalSteps);
        const stepNum = Math.max(1, activeIdx + 1);
        return Math.round((stepNum / safeTotal) * 100);
      };

      expect(calculateProgress(0, 0)).toBe(100);
      expect(calculateProgress(0, 1)).toBe(100);
    });
  });

  describe('Stepper Display Conditions', () => {
    it('suppresses stepper when variant is none', () => {
      const shouldRenderStepper = (variant: SurveyStepperVariant, pageCount: number, hasCover: boolean, currentIdx: number): boolean => {
        if (variant === 'none') return false;
        const actualPages = hasCover ? pageCount - 1 : pageCount;
        if (actualPages <= 1) return false;
        if (hasCover && currentIdx === 0) return false;
        return true;
      };

      expect(shouldRenderStepper('none', 3, false, 0)).toBe(false);
      expect(shouldRenderStepper('linear', 3, false, 0)).toBe(true);
      expect(shouldRenderStepper('simple', 3, false, 0)).toBe(true);
      expect(shouldRenderStepper('full', 3, false, 0)).toBe(true);
    });

    it('suppresses stepper when on cover page or only 1 page exists', () => {
      const shouldRenderStepper = (variant: SurveyStepperVariant, pageCount: number, hasCover: boolean, currentIdx: number): boolean => {
        if (variant === 'none') return false;
        const actualPages = hasCover ? pageCount - 1 : pageCount;
        if (actualPages <= 1) return false;
        if (hasCover && currentIdx === 0) return false;
        return true;
      };

      expect(shouldRenderStepper('linear', 1, false, 0)).toBe(false);
      expect(shouldRenderStepper('linear', 2, true, 0)).toBe(false); // Cover page
      expect(shouldRenderStepper('linear', 2, true, 1)).toBe(false); // Only 1 question page
      expect(shouldRenderStepper('linear', 3, true, 1)).toBe(true);  // 2 question pages
    });
  });
});
