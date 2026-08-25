import { describe, it, expect } from 'vitest';
import { LearningProgressService } from '../learning-progress-service';
import type { ReleaseRule } from '@/lib/types/learning';

describe('LearningProgressService', () => {
  describe('Drip Release Lock Evaluations', () => {
    it('returns unlocked for immediate release rules or undefined rules', () => {
      const res1 = LearningProgressService.evaluateLessonDripLock(undefined, null, null, []);
      expect(res1.isUnlocked).toBe(true);

      const res2 = LearningProgressService.evaluateLessonDripLock(
        { type: 'immediate' },
        null,
        null,
        []
      );
      expect(res2.isUnlocked).toBe(true);
    });

    it('locks when specific release date is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const rule: ReleaseRule = {
        type: 'specific_date',
        releaseDate: futureDate.toISOString(),
      };

      const res = LearningProgressService.evaluateLessonDripLock(rule, null, null, []);
      expect(res.isUnlocked).toBe(false);
      expect(res.reason).toContain('Unlocks on');
    });

    it('unlocks when specific release date is in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const rule: ReleaseRule = {
        type: 'specific_date',
        releaseDate: pastDate.toISOString(),
      };

      const res = LearningProgressService.evaluateLessonDripLock(rule, null, null, []);
      expect(res.isUnlocked).toBe(true);
    });

    it('evaluates days after enrollment delay accurately', () => {
      const now = new Date();
      const enrollmentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(); // enrolled 2 days ago

      // Requires 7 days
      const rule: ReleaseRule = {
        type: 'days_after_enrollment',
        daysDelay: 7,
      };

      const res = LearningProgressService.evaluateLessonDripLock(rule, enrollmentDate, null, []);
      expect(res.isUnlocked).toBe(false);
      expect(res.reason).toContain('Unlocks in 5 days');
    });

    it('evaluates sequential prerequisites strictly', () => {
      const rule: ReleaseRule = {
        type: 'sequential_prerequisite',
        requiredLessonId: 'lesson-101',
      };

      const lockedRes = LearningProgressService.evaluateLessonDripLock(
        rule,
        null,
        null,
        ['lesson-001', 'lesson-002']
      );
      expect(lockedRes.isUnlocked).toBe(false);
      expect(lockedRes.reason).toContain('Complete previous required lesson');

      const unlockedRes = LearningProgressService.evaluateLessonDripLock(
        rule,
        null,
        null,
        ['lesson-001', 'lesson-101']
      );
      expect(unlockedRes.isUnlocked).toBe(true);
    });
  });
});
