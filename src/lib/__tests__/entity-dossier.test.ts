import { vi, describe, it, expect, beforeEach } from 'vitest';
import { generateEntityDossierSummaryAction } from '@/app/actions/entity-dossier-actions';

// Mock the AI flow
vi.mock('@/ai/flows/entity-summarizer', () => ({
  summarizeEntityNotesFlow: vi.fn(async (input: { entityName?: string }) => {
    if (input.entityName === 'ErrorEntity') {
      throw new Error('AI Service Unreachable');
    }
    return {
      executiveSummary: `${input.entityName || 'Entity'} is demonstrating strong growth momentum.`,
      keyThemes: ['Strategic Partnership', 'Contract Renewal'],
      recentSentiment: 'positive',
      actionItems: ['Schedule executive business review', 'Confirm renewal timeline'],
      lastInteraction: 'Discovery call held on Monday',
    };
  }),
}));

describe('Entity Dossier Actions - generateEntityDossierSummaryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates an AI summary when flow succeeds', async () => {
    const result = await generateEntityDossierSummaryAction({
      entityName: 'St. Jude Academy',
      entityType: 'institution',
      stageName: 'Negotiation',
      leadScore: 88,
      notes: [
        {
          content: 'Discussed campus expansion and multi-year licensing.',
          noteType: 'meeting',
          createdByName: 'Sarah Jenkins',
          createdAt: new Date().toISOString(),
        },
      ],
      deals: [{ name: 'Enterprise License 2026', stageName: 'Negotiation', amount: 45000 }],
      tasks: [{ title: 'Send revised agreement', status: 'pending', priority: 'high' }],
      workspaceId: 'ws-123',
      organizationId: 'org-456',
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('ai');
    expect(result.summary.executiveSummary).toContain('St. Jude Academy');
    expect(result.summary.recentSentiment).toBe('positive');
    expect(result.summary.relationshipStatus).toBe('Strong Momentum');
    expect(result.summary.keyThemes).toContain('Strategic Partnership');
    expect(result.summary.actionItems.length).toBeGreaterThan(0);
  });

  it('gracefully falls back to deterministic summary when AI throws an error', async () => {
    const result = await generateEntityDossierSummaryAction({
      entityName: 'ErrorEntity',
      entityType: 'school',
      stageName: 'Discovery',
      leadScore: 42,
      notes: [],
      deals: [{ name: 'Pilot Project', stageName: 'Proposal', amount: 12000 }],
      tasks: [{ title: 'Follow up on pitch', status: 'open', priority: 'medium' }],
      workspaceId: 'ws-123',
      organizationId: 'org-456',
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('analytics');
    expect(result.summary.executiveSummary).toContain('ErrorEntity');
    expect(result.summary.executiveSummary).toContain('Discovery');
    expect(result.summary.recentSentiment).toBe('neutral');
    expect(result.summary.relationshipStatus).toBe('Needs Nurturing');
    expect(result.summary.actionItems.length).toBeGreaterThan(0);
    expect(result.summary.keyThemes).toContain('Commercial Pipeline Tracking');
  });

  it('handles empty notes and high score correctly in fallback', async () => {
    const result = await generateEntityDossierSummaryAction({
      entityName: 'ErrorEntity',
      entityType: 'enterprise',
      stageName: 'Won',
      leadScore: 95,
      notes: [],
      deals: [],
      tasks: [],
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('analytics');
    expect(result.summary.recentSentiment).toBe('positive');
    expect(result.summary.relationshipStatus).toBe('High Momentum');
  });
});
