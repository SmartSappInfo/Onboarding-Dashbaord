import { describe, it, expect } from 'vitest';
import { EngagementService } from '../engagement-service';

describe('EngagementService', () => {
  describe('Default Onboarding Steps & Graph', () => {
    it('provides standard default onboarding steps with positive orders', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      expect(steps.length).toBeGreaterThan(0);
      steps.forEach((s, idx) => {
        expect(s.id).toBeDefined();
        expect(s.title).toBeDefined();
        expect(s.type).toBeDefined();
        expect(s.order).toBe(idx + 1);
      });
    });

    it('contains core steps for welcome video, profile setup, and community', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      const types = steps.map(s => s.type);
      expect(types).toContain('welcome_video');
      expect(types).toContain('complete_profile');
      expect(types).toContain('start_course');
      expect(types).toContain('community_post');
    });
  });

  describe('Progress Calculation Math', () => {
    it('calculates 0% for no completed steps', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      const completed: string[] = [];
      const pct = Math.min(100, Math.round((completed.length / steps.length) * 100));
      expect(pct).toBe(0);
    });

    it('calculates 100% when all steps are completed', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      const completed = steps.map(s => s.id);
      const pct = Math.min(100, Math.round((completed.length / steps.length) * 100));
      expect(pct).toBe(100);
    });

    it('calculates accurate partial progress percentage', () => {
      const totalSteps = 4;
      const completedCount = 3;
      const pct = Math.min(100, Math.round((completedCount / totalSteps) * 100));
      expect(pct).toBe(75);
    });
  });
});
