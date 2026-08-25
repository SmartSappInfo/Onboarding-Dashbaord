import { describe, it, expect } from 'vitest';
import { CourseService } from '../course-service';

describe('CourseService', () => {
  describe('Slug Sanitization', () => {
    it('sanitizes course titles into clean kebab-case slugs', () => {
      expect(CourseService.sanitizeSlug('Invoicing & Fee Recovery Masterclass')).toBe(
        'invoicing-fee-recovery-masterclass'
      );
      expect(
        CourseService.sanitizeSlug('Private School Admissions: From Lead to Enrolled!')
      ).toBe('private-school-admissions-from-lead-to-enrolled');
      expect(CourseService.sanitizeSlug('   AI Tutor & 100% Mastery   ')).toBe(
        'ai-tutor-100-mastery'
      );
    });
  });
});
