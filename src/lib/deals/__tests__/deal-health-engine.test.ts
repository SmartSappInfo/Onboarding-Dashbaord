import { describe, it, expect } from 'vitest';
import { 
  calculateDaysInStage, 
  calculateDealHealth, 
  calculateWeightedValue, 
  calculateDealsOverviewMetrics,
  calculateLineItemsTotals 
} from '../deal-health-engine';
import type { Deal, DealStage, DealLineItem } from '../deal-types';

describe('Deal Health & Velocity Engine', () => {
  const baseStage: DealStage = {
    id: 'stage-1',
    pipelineId: 'pipe-1',
    name: 'Discovery',
    order: 1,
    slaDays: 7,
    probability: 30,
  };

  const baseDeal: Deal = {
    id: 'deal-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    entityId: 'ent-1',
    pipelineId: 'pipe-1',
    stageId: 'stage-1',
    name: 'Sample Deal',
    value: 10000,
    status: 'open',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    stageEnteredAt: '2026-08-01T00:00:00.000Z',
  };

  it('should calculate days in stage accurately', () => {
    const fixedNow = new Date('2026-08-05T00:00:00.000Z');
    const days = calculateDaysInStage('2026-08-01T00:00:00.000Z', undefined, fixedNow);
    expect(days).toBe(4);
  });

  it('should classify a deal within SLA as healthy', () => {
    const fixedNow = new Date('2026-08-05T00:00:00.000Z'); // 4 days in stage (SLA is 7)
    const health = calculateDealHealth(baseDeal, baseStage, '2026-08-04T00:00:00.000Z', fixedNow);
    expect(health.status).toBe('healthy');
    expect(health.isSlaBreached).toBe(false);
    expect(health.daysInStage).toBe(4);
  });

  it('should flag deal as at_risk when SLA is exceeded', () => {
    const fixedNow = new Date('2026-08-10T00:00:00.000Z'); // 9 days in stage (SLA is 7)
    const health = calculateDealHealth(baseDeal, baseStage, '2026-08-08T00:00:00.000Z', fixedNow);
    expect(health.status).toBe('at_risk');
    expect(health.isSlaBreached).toBe(true);
  });

  it('should flag deal as stalled when SLA is exceeded by > 100%', () => {
    const fixedNow = new Date('2026-08-20T00:00:00.000Z'); // 19 days in stage (SLA is 7)
    const health = calculateDealHealth(baseDeal, baseStage, '2026-08-01T00:00:00.000Z', fixedNow);
    expect(health.status).toBe('stalled');
    expect(health.isSlaBreached).toBe(true);
  });

  it('should calculate weighted value based on probability', () => {
    expect(calculateWeightedValue(10000, 30)).toBe(3000);
    expect(calculateWeightedValue(50000, 75)).toBe(37500);
    expect(calculateWeightedValue(20000, undefined)).toBe(10000); // 50% default
  });

  it('should calculate line item totals with discounts and tax', () => {
    const items: DealLineItem[] = [
      {
        id: 'li-1',
        name: 'Product A',
        quantity: 2,
        unitPrice: 1000, // 2000
        discount: 200,   // Net 1800
        taxRate: 10,     // Tax 180 -> Total 1980
        total: 1980,
      },
      {
        id: 'li-2',
        name: 'Service B',
        quantity: 1,
        unitPrice: 500,  // 500
        discount: 0,
        taxRate: 0,
        total: 500,
      }
    ];

    const result = calculateLineItemsTotals(items);
    expect(result.subtotal).toBe(2500);
    expect(result.totalDiscount).toBe(200);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(2480);
  });

  it('should compute aggregate overview metrics correctly', () => {
    const deals: Deal[] = [
      { ...baseDeal, id: 'd1', value: 10000, probability: 50, status: 'open' },
      { ...baseDeal, id: 'd2', value: 20000, probability: 80, status: 'won' },
      { ...baseDeal, id: 'd3', value: 15000, probability: 0, status: 'lost' },
    ];

    const metrics = calculateDealsOverviewMetrics(deals, [baseStage]);
    expect(metrics.totalPipelineValue).toBe(10000);
    expect(metrics.totalWonValue).toBe(20000);
    expect(metrics.totalActiveDeals).toBe(1);
    expect(metrics.winRatePercentage).toBe(50); // 1 won out of 2 closed (won + lost)
  });

  it('should guarantee lost deals contribute zero to weighted active forecast', () => {
    const lostDeal: Deal = {
      ...baseDeal,
      id: 'd-lost',
      value: 100000,
      probability: 0,
      status: 'lost',
    };

    expect(calculateWeightedValue(lostDeal.value, 0)).toBe(0);
    expect(calculateDealHealth(lostDeal, baseStage).status).toBe('closed');
  });
});
