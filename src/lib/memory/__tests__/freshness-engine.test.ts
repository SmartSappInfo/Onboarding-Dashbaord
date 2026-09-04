/**
 * @fileOverview Unit tests for CompanyBrain FreshnessEngine
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFreshnessScore,
  getMemoryTtlDays,
  reconfirmFreshness,
  evaluateMemoriesFreshness,
  filterStaleMemories,
} from '../services/freshness-engine';
import type { MemoryObject } from '../types';

function createMockMemory(overrides: Partial<MemoryObject> = {}): MemoryObject {
  const createdAt = overrides.createdAt ?? new Date('2026-01-01T00:00:00Z').toISOString();
  const updatedAt = overrides.updatedAt ?? createdAt;

  return {
    id: 'mem-123',
    organizationId: 'org-test',
    workspaceId: 'ws-test',
    type: 'fact',
    title: 'Acme Enterprise Contract Terms',
    content: 'Acme Enterprise renewal price is set at $12,000/year.',
    topics: [],
    entities: [],
    subjectRefs: {},
    source: {
      type: 'user_note',
      sourceId: 'note-1',
    },
    importance: 0.8,
    confidence: 0.9,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'user', userId: 'user-1' },
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe('FreshnessEngine', () => {
  describe('getMemoryTtlDays', () => {
    it('returns 90 days for pricing-related memories or action items', () => {
      const pricingMemory = createMockMemory({ topics: ['pricing'] });
      expect(getMemoryTtlDays(pricingMemory)).toBe(90);

      const actionItemMemory = createMockMemory({ type: 'action_item', topics: [] });
      expect(getMemoryTtlDays(actionItemMemory)).toBe(60);
    });

    it('returns 180 days for stakeholder preferences and feedback', () => {
      const prefMemory = createMockMemory({ type: 'preference', topics: ['ceo'] });
      expect(getMemoryTtlDays(prefMemory)).toBe(180);
    });

    it('returns 365 days for decisions and core facts', () => {
      const decisionMemory = createMockMemory({ type: 'decision', topics: ['architecture'] });
      expect(getMemoryTtlDays(decisionMemory)).toBe(365);
    });
  });

  describe('calculateFreshnessScore', () => {
    it('calculates 1.0 for brand new memories created today', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const memory = createMockMemory({
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const info = calculateFreshnessScore(memory, now);
      expect(info.freshnessScore).toBe(1.0);
      expect(info.isStale).toBe(false);
      expect(info.daysRemaining).toBeGreaterThan(0);
    });

    it('marks a 90-day pricing memory as stale after 100 days', () => {
      const createdDate = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-04-11T00:00:00Z'); // 100 days later
      const memory = createMockMemory({
        topics: ['pricing'],
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString(),
      });

      const info = calculateFreshnessScore(memory, now);
      expect(info.ttlDays).toBe(90);
      expect(info.isStale).toBe(true);
      expect(info.daysRemaining).toBe(0);
      expect(info.freshnessScore).toBeLessThan(0.5);
    });

    it('uses lastReviewedAt if available rather than original createdAt', () => {
      const oldDate = new Date('2025-01-01T00:00:00Z');
      const reviewedDate = new Date('2026-04-01T00:00:00Z');
      const now = new Date('2026-04-10T00:00:00Z'); // 9 days after review

      const memory = createMockMemory({
        type: 'decision', // 365 days TTL
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        lifecycle: {
          status: 'active',
          lastReviewedAt: reviewedDate.toISOString(),
          reviewedBy: 'user-admin',
        },
      });

      const info = calculateFreshnessScore(memory, now);
      expect(info.isStale).toBe(false);
      expect(info.freshnessScore).toBeGreaterThan(0.95);
    });
  });

  describe('reconfirmFreshness', () => {
    it('generates updated lifecycle with current timestamp and active status', () => {
      const now = new Date('2026-04-15T10:00:00Z');
      const memory = createMockMemory({
        lifecycle: { status: 'stale' },
      });

      const patch = reconfirmFreshness(memory, 'admin-user-42', now);
      expect(patch.lifecycle?.status).toBe('active');
      expect(patch.lifecycle?.lastReviewedAt).toBe(now.toISOString());
      expect(patch.lifecycle?.reviewedBy).toBe('admin-user-42');
      expect(patch.updatedAt).toBe(now.toISOString());
    });
  });

  describe('evaluateMemoriesFreshness and filterStaleMemories', () => {
    it('correctly filters out stale memories from a mixed batch', () => {
      const now = new Date('2026-06-01T00:00:00Z');

      const freshMemory = createMockMemory({
        id: 'fresh-1',
        type: 'decision',
        createdAt: '2026-05-01T00:00:00Z', // 31 days old (TTL 365)
      });

      const staleMemory = createMockMemory({
        id: 'stale-1',
        type: 'action_item',
        topics: [],
        createdAt: '2026-01-01T00:00:00Z', // 151 days old (TTL 60)
      });

      const staleList = filterStaleMemories([freshMemory, staleMemory], 0.5, now);
      expect(staleList.length).toBe(1);
      expect(staleList[0].id).toBe('stale-1');

      const freshnessBatch = evaluateMemoriesFreshness([freshMemory, staleMemory], now);
      expect(freshnessBatch.length).toBe(2);
      expect(freshnessBatch.find(f => f.memoryId === 'fresh-1')?.isStale).toBe(false);
      expect(freshnessBatch.find(f => f.memoryId === 'stale-1')?.isStale).toBe(true);
    });
  });
});
