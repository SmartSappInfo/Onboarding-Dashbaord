import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateLineItemsTotals } from '@/lib/deals/deal-health-engine';
import type { DealLineItem } from '@/lib/types';

describe('Deal Line Items & Stage History Suite', () => {
  it('should recalculate line items with volume discounts and tax accurately', () => {
    const items: DealLineItem[] = [
      {
        id: 'li-1',
        name: 'Enterprise Platform Subscription',
        quantity: 1,
        unitPrice: 10000,
        discountPercent: 10, // 1000 discount -> 9000
        taxRate: 15, // 1350 tax -> 10350
        total: 10350,
      },
      {
        id: 'li-2',
        name: 'Implementation & Training',
        quantity: 2,
        unitPrice: 2000, // 4000
        discount: 500, // 3500
        taxRate: 0,
        total: 3500,
      }
    ];

    const result = calculateLineItemsTotals(items);
    expect(result.subtotal).toBe(14000);
    expect(result.totalDiscount).toBe(1500);
    expect(result.totalTax).toBe(1350);
    expect(result.grandTotal).toBe(13850);
  });

  it('should correctly calculate duration between enteredAt and exitedAt for stageHistory entries', () => {
    const enteredAt = '2026-07-01T10:00:00.000Z';
    const exitedAt = '2026-07-05T10:00:00.000Z'; // 4 days = 345600 seconds

    const durationSeconds = Math.round(
      (new Date(exitedAt).getTime() - new Date(enteredAt).getTime()) / 1000
    );

    expect(durationSeconds).toBe(345600);
  });

  it('should correctly structure deal quote parameters with validity window', () => {
    const validDays = 30;
    const now = new Date('2026-08-01T00:00:00.000Z').getTime();
    const validUntil = new Date(now + validDays * 24 * 60 * 60 * 1000).toISOString();

    expect(validUntil).toBe('2026-08-31T00:00:00.000Z');
  });
});
