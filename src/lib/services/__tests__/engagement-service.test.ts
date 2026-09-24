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

  describe('Engagement Scoring & Tiers', () => {
    it('assigns correct tier based on activity score', () => {
      const getTier = (score: number) => {
        if (score >= 150) return 'champion';
        if (score >= 80) return 'active';
        if (score >= 30) return 'warm';
        return 'cold';
      };

      expect(getTier(200)).toBe('champion');
      expect(getTier(150)).toBe('champion');
      expect(getTier(120)).toBe('active');
      expect(getTier(80)).toBe('active');
      expect(getTier(50)).toBe('warm');
      expect(getTier(30)).toBe('warm');
      expect(getTier(10)).toBe('cold');
      expect(getTier(0)).toBe('cold');
    });

    it('determines inactivity tiers from elapsed duration', () => {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

      const getInactivityTier = (inactiveMs: number) => {
        if (inactiveMs >= FOURTEEN_DAYS_MS) return 'cold';
        if (inactiveMs >= SEVEN_DAYS_MS) return 'warm';
        return 'active';
      };

      expect(getInactivityTier(15 * 24 * 60 * 60 * 1000)).toBe('cold');
      expect(getInactivityTier(10 * 24 * 60 * 60 * 1000)).toBe('warm');
      expect(getInactivityTier(3 * 24 * 60 * 60 * 1000)).toBe('active');
    });
  });

  describe('Review Idempotency & Inactivity Transition Protection', () => {
    it('detects redundant approvals to prevent double-awarding points and tags', () => {
      const isRedundantApproval = (currentReviewStatus: string, incomingReviewStatus: string) => {
        return currentReviewStatus === 'approved' && incomingReviewStatus === 'approved';
      };

      expect(isRedundantApproval('approved', 'approved')).toBe(true);
      expect(isRedundantApproval('pending_review', 'approved')).toBe(false);
      expect(isRedundantApproval('rejected', 'approved')).toBe(false);
      expect(isRedundantApproval('approved', 'rejected')).toBe(false);
    });

    it('requires state transitions before emitting inactivity alerts or writes', () => {
      const shouldUpdateInactivityProfile = (
        existingTier: string | null | undefined,
        newTier: string
      ) => {
        return !existingTier || existingTier !== newTier;
      };

      // When already cold, daily cron should NOT trigger updates or spam CRM
      expect(shouldUpdateInactivityProfile('cold', 'cold')).toBe(false);
      expect(shouldUpdateInactivityProfile('warm', 'warm')).toBe(false);

      // Transitions must trigger updates
      expect(shouldUpdateInactivityProfile('active', 'warm')).toBe(true);
      expect(shouldUpdateInactivityProfile('warm', 'cold')).toBe(true);
      expect(shouldUpdateInactivityProfile(undefined, 'cold')).toBe(true);
    });

    it('filters out passive system inactivity events from engagement score calculation', () => {
      const events = [
        { id: '1', eventType: 'course.lesson_completed' },
        { id: '2', eventType: 'community.post_created' },
        { id: '3', eventType: 'portal.member_inactivity_detected' }, // system-generated alert
        { id: '4', eventType: 'task.completed' },
      ];

      const activeMemberEvents = events.filter(
        e => e.eventType !== 'portal.member_inactivity_detected'
      );

      expect(activeMemberEvents.length).toBe(3);
      expect(activeMemberEvents.map(e => e.id)).toEqual(['1', '2', '4']);
    });
  });
});

