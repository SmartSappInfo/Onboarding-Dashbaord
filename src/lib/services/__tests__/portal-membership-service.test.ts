import { describe, it, expect } from 'vitest';
import { MembershipPlanService } from '../membership-plan-service';

describe('MembershipPlanService', () => {
  describe('Plan Slug Sanitization', () => {
    it('sanitizes plan names into clean kebab-case slugs', () => {
      expect(MembershipPlanService.sanitizeSlug('Academy Pro (Monthly)')).toBe('academy-pro-monthly');
      expect(MembershipPlanService.sanitizeSlug('VIP School Executive Pass')).toBe('vip-school-executive-pass');
      expect(MembershipPlanService.sanitizeSlug('Free Starter Tier 100%')).toBe('free-starter-tier-100');
    });
  });
});
