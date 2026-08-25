import { describe, it, expect } from 'vitest';
import { CommunityService } from '../community-service';

describe('CommunityService', () => {
  describe('Slug Sanitization', () => {
    it('sanitizes community space names into clean slugs', () => {
      expect(CommunityService.sanitizeSlug('Wins & Celebrations 🎉')).toBe('wins-celebrations');
      expect(CommunityService.sanitizeSlug('Tuition & Fee Q&A!')).toBe('tuition-fee-qa');
      expect(CommunityService.sanitizeSlug('   VIP Mastermind & Leadership   ')).toBe(
        'vip-mastermind-leadership'
      );
    });

    it('sanitizes discussion post titles accurately', () => {
      expect(
        CommunityService.sanitizeSlug(
          'What payment channel do your school parents prefer most in 2026?'
        )
      ).toBe('what-payment-channel-do-your-school-parents-prefer-most-in-2026');
    });
  });
});
