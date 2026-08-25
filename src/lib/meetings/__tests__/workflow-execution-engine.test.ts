import { describe, it, expect } from 'vitest';
import {
  evaluateWorkflowEligibility,
  formatWorkflowActionSummary,
} from '../workflow-execution-engine';
import type { MeetingWorkflowRule } from '../types/polls';

describe('Meeting Workflow Execution Engine', () => {
  it('evaluates trigger predicates correctly across booking and attendance states', () => {
    // on_booking
    expect(evaluateWorkflowEligibility('on_booking', { bookingStatus: 'confirmed' })).toBe(true);
    expect(evaluateWorkflowEligibility('on_booking', { bookingStatus: 'cancelled' })).toBe(false);

    // after_attended (attended 15m out of 30m)
    expect(
      evaluateWorkflowEligibility('after_attended', {
        attendanceSeconds: 900,
        meetingDurationSeconds: 1800,
      })
    ).toBe(true);

    // on_no_show (attended 0 seconds)
    expect(
      evaluateWorkflowEligibility('on_no_show', {
        attendanceSeconds: 0,
        bookingStatus: 'confirmed',
      })
    ).toBe(true);
  });

  it('evaluates time-offset before triggers correctly', () => {
    const referenceNow = new Date('2026-09-01T10:00:00Z');
    // Meeting starts in 20 hours -> eligible for before_24h
    const startIn20h = new Date('2026-09-02T06:00:00Z').toISOString();
    expect(
      evaluateWorkflowEligibility('before_24h', {
        eventStartAt: startIn20h,
        referenceNow,
      })
    ).toBe(true);

    // Meeting starts in 48 hours -> not eligible for before_24h
    const startIn48h = new Date('2026-09-03T10:00:00Z').toISOString();
    expect(
      evaluateWorkflowEligibility('before_24h', {
        eventStartAt: startIn48h,
        referenceNow,
      })
    ).toBe(false);
  });

  it('formats human-readable summary of workflow rules', () => {
    const rule: MeetingWorkflowRule = {
      id: 'r1',
      workspaceId: 'w1',
      eventTypeId: 'e1',
      trigger: 'after_attended',
      actionType: 'update_lead_score',
      config: { scoreDelta: 20 },
      enabled: true,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    const summary = formatWorkflowActionSummary(rule);
    expect(summary).toBe('After attendee completes meeting → Increment lead score by 20 pts');
  });
});
