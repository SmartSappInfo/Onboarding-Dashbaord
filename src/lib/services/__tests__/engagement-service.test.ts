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

    it('provides Action CTAs and Auto-Verification metadata for zero-code automation', () => {
      const steps = EngagementService.getDefaultOnboardingSteps();
      // Step 1: Welcome Video
      expect(steps[0].actionLabel).toBe('Watch Orientation');
      expect(steps[0].autoVerificationType).toBe('auto_watch');
      expect(steps[0].videoUrl).toBeDefined();

      // Step 2: Complete Profile
      expect(steps[1].actionLabel).toBe('Set Up Profile');
      expect(steps[1].autoVerificationType).toBe('has_profile');

      // Step 3: Start Course
      expect(steps[2].actionLabel).toBe('Go to Lesson →');
      expect(steps[2].autoVerificationType).toBe('has_started_lesson');

      // Step 4: Community Post
      expect(steps[3].actionLabel).toBe('Join Discussion');
      expect(steps[3].autoVerificationType).toBe('has_community_post');

      // Step 5: Book Session
      expect(steps[4].actionLabel).toBe('Book Consultation');
      expect(steps[4].autoVerificationType).toBe('manual_confirm');
    });
  });
});
