import { describe, it, expect } from 'vitest';
import type { Deal, OnboardingStage, DealStage, DealLineItem, DealStageHistory } from '../deal-types';

describe('Deals 2.0 Schema & Type Verification', () => {
  it('should accept a minimal legacy deal without errors', () => {
    const legacyDeal: Deal = {
      id: 'deal-123',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      pipelineId: 'pipe-1',
      stageId: 'stage-1',
      name: 'Legacy School Expansion',
      value: 50000,
      status: 'open',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(legacyDeal.id).toBe('deal-123');
    expect(legacyDeal.value).toBe(50000);
    expect(legacyDeal.lineItems).toBeUndefined();
    expect(legacyDeal.stageHistory).toBeUndefined();
  });

  it('should accept a fully populated Deals 2.0 deal record', () => {
    const lineItem: DealLineItem = {
      id: 'li-1',
      name: 'Standard Software License',
      quantity: 2,
      unitPrice: 25000,
      discount: 2000,
      taxRate: 15,
      total: 55200,
      isRecurring: true,
      billingInterval: 'annual',
    };

    const stageHistory: DealStageHistory = {
      stageId: 'stage-1',
      stageName: 'Discovery',
      enteredAt: '2026-01-01T00:00:00.000Z',
      exitedAt: '2026-01-05T00:00:00.000Z',
      durationSeconds: 345600,
      changedByUserId: 'user-1',
    };

    const deals2Record: Deal = {
      id: 'deal-456',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      entityId: 'ent-2',
      pipelineId: 'pipe-1',
      stageId: 'stage-2',
      stageName: 'Proposal',
      name: 'Enterprise School District',
      value: 55200,
      currency: 'USD',
      status: 'open',
      probability: 70,
      forecastCategory: 'commit',
      weightedValue: 38640,
      healthStatus: 'healthy',
      stageEnteredAt: '2026-01-05T00:00:00.000Z',
      stageHistory: [stageHistory],
      lineItems: [lineItem],
      source: 'marketing_campaign',
      campaignId: 'camp-123',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    };

    expect(deals2Record.id).toBe('deal-456');
    expect(deals2Record.lineItems?.length).toBe(1);
    expect(deals2Record.probability).toBe(70);
    expect(deals2Record.forecastCategory).toBe('commit');
    expect(deals2Record.stageHistory?.length).toBe(1);
  });

  it('should verify DealStage aliases cleanly with OnboardingStage', () => {
    const stage: DealStage = {
      id: 'stage-1',
      pipelineId: 'pipe-1',
      name: 'Discovery',
      order: 1,
      color: '#3b82f6',
      probability: 20,
      slaDays: 7,
      isWon: false,
      isLost: false,
    };

    const onboardingStage: OnboardingStage = stage;
    expect(onboardingStage.name).toBe('Discovery');
    expect(onboardingStage.probability).toBe(20);
    expect(onboardingStage.slaDays).toBe(7);
  });
});
