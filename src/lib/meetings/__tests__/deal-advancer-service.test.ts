import { describe, it, expect } from 'vitest';
import { evaluateDealAdvancement } from '../deal-advancer-service';
import type { DealAdvancementRule } from '../types/deal-advancer';

describe('CRM Deal Stage Advancer Service', () => {
  it('advances open deal to target stage and applies tags upon meeting completion', () => {
    const deal = {
      id: 'deal_123',
      stageId: 'stage_discovery',
      status: 'open',
      tags: ['lead'],
    };

    const rules: DealAdvancementRule[] = [
      {
        triggerOutcome: 'meeting_completed',
        sourceStageId: 'stage_discovery',
        targetStageId: 'stage_proposal_sent',
        autoAssignTags: ['demo-completed', 'qualified'],
        logActivityNote: true,
      },
    ];

    const result = evaluateDealAdvancement(deal, rules, 'meeting_completed');

    expect(result).not.toBeNull();
    expect(result?.dealId).toBe('deal_123');
    expect(result?.previousStageId).toBe('stage_discovery');
    expect(result?.newStageId).toBe('stage_proposal_sent');
    expect(result?.appliedTags).toContain('demo-completed');
    expect(result?.appliedTags).toContain('lead');
  });

  it('returns null if deal is already closed or does not match rule trigger', () => {
    const closedDeal = {
      id: 'deal_456',
      stageId: 'stage_won',
      status: 'won',
    };

    const rules: DealAdvancementRule[] = [
      {
        triggerOutcome: 'meeting_completed',
        targetStageId: 'stage_proposal_sent',
        logActivityNote: true,
      },
    ];

    const result = evaluateDealAdvancement(closedDeal, rules, 'meeting_completed');
    expect(result).toBeNull();
  });
});
