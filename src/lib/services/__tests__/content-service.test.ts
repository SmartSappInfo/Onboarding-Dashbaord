import { describe, it, expect } from 'vitest';
import { ContentService } from '../content-service';

describe('ContentService', () => {
  describe('Slug Sanitization', () => {
    it('converts article titles into clean kebab-case slugs', () => {
      expect(
        ContentService.sanitizeSlug('5 Automated WhatsApp Strategies to Eliminate Late Fee Payments!')
      ).toBe('5-automated-whatsapp-strategies-to-eliminate-late-fee-payments');

      expect(
        ContentService.sanitizeSlug('Module 1: Invoicing Automation Architecture & USSD Setup')
      ).toBe('module-1-invoicing-automation-architecture-ussd-setup');

      expect(
        ContentService.sanitizeSlug('   leading & trailing spaces   ')
      ).toBe('leading-trailing-spaces');

      expect(
        ContentService.sanitizeSlug('Special @#$$% Characters & Symbols')
      ).toBe('special-characters-symbols');
    });
  });
});
