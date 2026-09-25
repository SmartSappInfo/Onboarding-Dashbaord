/**
 * {{Org_name}} Experience Platform — CohortService Test Suite
 *
 * Tests cohort slug normalization, capacity checks, batch chunking limits (<= 400 ops),
 * and cohort-anchored drip calculations without resource exhaustion.
 */

import { describe, it, expect } from 'vitest';
import { CohortService } from '../cohort-service';
import type { CourseCohort } from '@/lib/types/events';

describe('CohortService', () => {
  describe('Slug Normalization & Sanitization', () => {
    it('normalizes cohort names into url-safe kebab-case slugs', () => {
      expect(CohortService.sanitizeSlug('Spring 2026: Executive Leadership Batch #1!')).toBe(
        'spring-2026-executive-leadership-batch-1'
      );
      expect(CohortService.sanitizeSlug('   Cohort Jan - Tech Accelerator   ')).toBe(
        'cohort-jan-tech-accelerator'
      );
      expect(CohortService.sanitizeSlug('AI Masterclass (Week 1 - 4)')).toBe(
        'ai-masterclass-week-1-4'
      );
    });

    it('falls back to default slug when input is empty or symbols only', () => {
      expect(CohortService.sanitizeSlug('*** @@@ !!!')).toBe('cohort');
      expect(CohortService.sanitizeSlug('')).toBe('cohort');
    });
  });

  describe('Capacity & Enrollment Rules', () => {
    it('accurately evaluates capacity availability', () => {
      const unlimitedCohort: CourseCohort = {
        id: 'c1',
        organizationId: 'org1',
        portalId: 'p1',
        courseId: 'course1',
        workspaceIds: ['cohorts'],
        name: 'Open Enrollment Cohort',
        slug: 'open-enrollment',
        startDate: '2026-10-01T00:00:00Z',
        endDate: '2026-12-01T00:00:00Z',
        enrolledCount: 500,
        status: 'upcoming',
        createdAt: '2026-09-25T00:00:00Z',
        updatedAt: '2026-09-25T00:00:00Z',
      };
      expect(CohortService.hasAvailableCapacity(unlimitedCohort)).toBe(true);

      const cappedCohortWithSpace: CourseCohort = {
        ...unlimitedCohort,
        maxCapacity: 30,
        enrolledCount: 29,
      };
      expect(CohortService.hasAvailableCapacity(cappedCohortWithSpace)).toBe(true);

      const fullCohort: CourseCohort = {
        ...unlimitedCohort,
        maxCapacity: 30,
        enrolledCount: 30,
      };
      expect(CohortService.hasAvailableCapacity(fullCohort)).toBe(false);

      const oversubscribedCohort: CourseCohort = {
        ...unlimitedCohort,
        maxCapacity: 30,
        enrolledCount: 35,
      };
      expect(CohortService.hasAvailableCapacity(oversubscribedCohort)).toBe(false);
    });
  });

  describe('Anti-Exhaustion Batch Chunking', () => {
    it('chunks large operations into batches smaller than Firestore 500-op limit (<= 400 ops)', () => {
      const items = Array.from({ length: 950 }, (_, i) => `item-${i}`);
      const chunks = CohortService.chunkBatchOperations(items, 400);

      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(400);
      expect(chunks[1].length).toBe(400);
      expect(chunks[2].length).toBe(150);
    });

    it('handles empty or small arrays safely without creating empty chunks', () => {
      expect(CohortService.chunkBatchOperations([], 400)).toEqual([]);
      const small = ['a', 'b', 'c'];
      const chunks = CohortService.chunkBatchOperations(small, 400);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual(['a', 'b', 'c']);
    });
  });
});
