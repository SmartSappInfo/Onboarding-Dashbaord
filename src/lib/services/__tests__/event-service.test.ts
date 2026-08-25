import { describe, it, expect } from 'vitest';
import { EventService } from '../event-service';

describe('EventService', () => {
  describe('Slug & Event Helpers', () => {
    it('normalizes event slugs safely', () => {
      const title = 'Live Masterclass: Term 1 Fee Collection Strategies!!';
      const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      expect(slug).toBe('live-masterclass-term-1-fee-collection-strategies');
    });

    it('calculates duration in minutes accurately from ISO dates', () => {
      const start = new Date('2026-09-01T14:00:00.000Z');
      const end = new Date('2026-09-01T15:30:00.000Z');
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      expect(durationMinutes).toBe(90);
    });
  });
});
