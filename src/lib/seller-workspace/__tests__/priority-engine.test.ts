/**
 * @fileoverview Unit tests for Seller Workspace AI Priority & Next-Best-Action Engine (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Validates deterministic priority scoring, SLA countdowns, and entity deduplication:
 * - Priority score clamping and factor weight boosts.
 * - Dynamic SLA timing evaluation (on_track, at_risk, breached).
 * - Coalescence of separate tasks and signals for the same account (R2 deduplication).
 * - Quota deficit priority alignment.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateSlaTiming,
  calculatePriorityScore,
  coalesceAndRankQueue,
  type RawCandidateInput,
} from '../priority-engine';

describe('Seller Workspace Priority Engine', () => {
  const baseDate = new Date('2026-09-07T09:00:00.000Z');

  describe('evaluateSlaTiming', () => {
    it('identifies breached SLAs when due date is in the past', () => {
      const pastDue = new Date(baseDate.getTime() - 45 * 60 * 1000).toISOString(); // 45 mins ago
      const result = evaluateSlaTiming(pastDue, baseDate);

      expect(result.slaStatus).toBe('breached');
      expect(result.minutesRemaining).toBe(-45);
      expect(result.badgeLabel).toBe('Overdue by 45m');
    });

    it('identifies at_risk SLAs when due within warning threshold (<= 2 hours)', () => {
      const soonDue = new Date(baseDate.getTime() + 90 * 60 * 1000).toISOString(); // 1h 30m away
      const result = evaluateSlaTiming(soonDue, baseDate);

      expect(result.slaStatus).toBe('at_risk');
      expect(result.minutesRemaining).toBe(90);
      expect(result.badgeLabel).toBe('Due in 1h 30m');
    });

    it('identifies on_track SLAs when due date is well in advance (> 2 hours)', () => {
      const farDue = new Date(baseDate.getTime() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours away
      const result = evaluateSlaTiming(farDue, baseDate);

      expect(result.slaStatus).toBe('on_track');
      expect(result.minutesRemaining).toBe(300);
      expect(result.badgeLabel).toBe('Due in 5h');
    });
  });

  describe('calculatePriorityScore', () => {
    it('calculates score with base points, deal value, and signal boosts', () => {
      const candidate: RawCandidateInput = {
        id: 'c1',
        type: 'buyer_signal',
        title: 'Sunrise Academy Proposal Viewed',
        description: 'Opened 4 times',
        dealValue: 75000,
        signalStrength: 'high',
        signalCount: 4,
        dueDate: new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString(), // 1h away (at_risk)
        assignedTo: 'rep_1',
        workspaceId: 'ws_1',
        organizationId: 'org_1',
      };

      const result = calculatePriorityScore(candidate, { currentTime: baseDate });

      // Base: 40 (buyer_signal)
      // Deal Value Boost: 15 (75k >= 50k)
      // Signal Boost: 20 (high strength)
      // SLA Boost: 25 (at_risk)
      // Expected total: 40 + 15 + 20 + 25 = 100
      expect(result.priorityScore).toBe(100);
      expect(result.impact).toBe('critical');
      expect(result.urgency).toBe('immediate');
      expect(result.reason).toContain('Viewed materials 4×');
    });

    it('applies quota deficit boost when item matches lagging metric', () => {
      const candidate: RawCandidateInput = {
        id: 'c2',
        type: 'meeting_prep',
        title: 'Prep for Greenfield Academy Meeting',
        description: 'Discovery session',
        dueDate: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        assignedTo: 'rep_1',
        workspaceId: 'ws_1',
        organizationId: 'org_1',
      };

      // When rep is behind on meetings
      const boosted = calculatePriorityScore(candidate, {
        currentTime: baseDate,
        repLaggingMetric: 'meetings',
      });

      // When rep is not lagging on meetings
      const normal = calculatePriorityScore(candidate, {
        currentTime: baseDate,
        repLaggingMetric: 'calls',
      });

      expect(boosted.breakdown.quotaDeficitBoost).toBe(15);
      expect(normal.breakdown.quotaDeficitBoost).toBe(0);
      expect(boosted.priorityScore).toBeGreaterThan(normal.priorityScore);
    });

    it('awards absolute score 100 and critical impact for manager-elevated items', () => {
      const candidate: RawCandidateInput = {
        id: 'c_elevated',
        type: 'deal_action',
        title: 'Executive Priority: Apex International',
        description: 'Stalled deal in negotiation',
        dueDate: baseDate.toISOString(),
        assignedTo: 'rep_1',
        workspaceId: 'ws_1',
        organizationId: 'org_1',
        isManagerElevated: true,
        managerNote: 'Close before quarter end.',
        suggestedAction: 'Schedule CEO-to-CEO call.',
      };

      const result = calculatePriorityScore(candidate, { currentTime: baseDate });

      expect(result.priorityScore).toBe(100);
      expect(result.impact).toBe('critical');
      expect(result.urgency).toBe('immediate');
      expect(result.reason).toContain('Manager Directive: Close before quarter end.');
      expect(result.recommendedAction).toBe('Schedule CEO-to-CEO call.');
    });
  });

  describe('coalesceAndRankQueue', () => {
    it('deduplicates tasks and signals for the same entity and sorts by priority', () => {
      const candidates: RawCandidateInput[] = [
        {
          id: 'task_1',
          type: 'follow_up',
          title: 'Follow up with Sunrise Academy',
          description: 'Regular check-in',
          entityId: 'ent_sunrise',
          entityName: 'Sunrise Academy',
          dueDate: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: 'rep_1',
          workspaceId: 'ws_1',
          organizationId: 'org_1',
        },
        {
          id: 'signal_1',
          type: 'buyer_signal',
          title: 'Sunrise Academy Viewed Pricing',
          description: 'Viewed pricing page 3 times',
          entityId: 'ent_sunrise',
          entityName: 'Sunrise Academy',
          signalStrength: 'high',
          signalCount: 3,
          dueDate: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          assignedTo: 'rep_1',
          workspaceId: 'ws_1',
          organizationId: 'org_1',
        },
        {
          id: 'task_2',
          type: 'call',
          title: 'Cold Outreach Call to St. Peter School',
          description: 'Prospecting call',
          entityId: 'ent_st_peter',
          entityName: 'St. Peter School',
          dueDate: new Date(baseDate.getTime() + 48 * 60 * 60 * 1000).toISOString(),
          assignedTo: 'rep_1',
          workspaceId: 'ws_1',
          organizationId: 'org_1',
        },
      ];

      const ranked = coalesceAndRankQueue(candidates, { currentTime: baseDate });

      // Should coalesce the 2 Sunrise Academy items into 1 item
      expect(ranked.length).toBe(2);

      // Highest priority item should be Sunrise Academy (merged signal + earlier due date)
      expect(ranked[0].entityId).toBe('ent_sunrise');
      expect(ranked[0].priorityScore).toBeGreaterThan(ranked[1].priorityScore);
      expect(ranked[0].description).toContain('Regular check-in • Viewed pricing page 3 times');
    });
  });
});
