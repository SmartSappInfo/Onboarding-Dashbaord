import { describe, it, expect } from 'vitest';
import { EngagementService } from '../engagement-service';

describe('EngagementService', () => {
  describe('Default Onboarding Steps', () => {
    it('initializes the complete 5-step orientation sequence', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      expect(steps).toHaveLength(5);
      expect(steps[0].type).toBe('welcome_video');
      expect(steps[1].type).toBe('complete_profile');
      expect(steps[2].type).toBe('start_course');
      expect(steps[3].type).toBe('community_post');
      expect(steps[4].type).toBe('book_meeting');
    });

    it('enforces sequential ordering and required flags', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      expect(steps[0].order).toBe(1);
      expect(steps[0].isRequired).toBe(true);
      expect(steps[4].order).toBe(5);
    });
  });
});
