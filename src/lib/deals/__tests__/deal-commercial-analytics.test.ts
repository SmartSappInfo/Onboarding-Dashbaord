import { describe, it, expect } from 'vitest';
import { 
  calculateCommercialAnalytics, 
  generateCatalogPricingRecommendations 
} from '../deal-commercial-analytics';
import type { Deal, Product, ProductCategory, PriceBook } from '../deal-types';
import type { SubscriptionPackage } from '../../types';

describe('Commercial & Pricing Analytics Engine', () => {
  const baseCategory: ProductCategory = {
    id: 'cat-software',
    name: 'Software Licenses',
    color: '#4f46e5',
    order: 1,
    workspaceId: 'ws-1',
    organizationId: 'org-1',
  };

  const baseProduct1: Product = {
    id: 'prod-core',
    name: 'Core ERP License',
    sku: 'SKU-CORE-01',
    categoryId: 'cat-software',
    unitPrice: 5000,
    currency: 'USD',
    isRecurring: true,
    billingInterval: 'annual',
    isActive: true,
    workspaceId: 'ws-1',
    organizationId: 'org-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const baseProduct2: Product = {
    id: 'prod-setup',
    name: 'Implementation & Onboarding',
    sku: 'SKU-SETUP-01',
    categoryId: 'cat-software',
    unitPrice: 2000,
    currency: 'USD',
    isRecurring: false,
    billingInterval: 'one_time',
    isActive: true,
    workspaceId: 'ws-1',
    organizationId: 'org-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const basePackage: SubscriptionPackage = {
    id: 'pkg-standard',
    name: 'Standard Student Tier',
    description: 'Tiered per-student package',
    ratePerStudent: 50,
    billingTerm: 'termly',
    currency: 'USD',
    isActive: true,
    workspaceIds: ['ws-1'],
  };

  const basePriceBook: PriceBook = {
    id: 'pb-standard',
    name: 'Standard Price Book',
    currency: 'USD',
    isStandard: true,
    isActive: true,
    workspaceId: 'ws-1',
    organizationId: 'org-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  it('should handle completely empty inputs gracefully without errors or NaN', () => {
    const summary = calculateCommercialAnalytics([], [], [], [], []);
    expect(summary.totalCatalogRevenueWon).toBe(0);
    expect(summary.totalActiveSkus).toBe(0);
    expect(summary.totalActivePackages).toBe(0);
    expect(summary.totalPriceBooks).toBe(0);
    expect(summary.recurringVsOneTimeRatio.recurringPercentage).toBe(0);
    expect(summary.avgDiscountDepth).toBe(0);
    expect(summary.topProducts).toEqual([]);

    const recommendations = generateCatalogPricingRecommendations(summary);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].id).toBe('catalog-foundation-tip');
  });

  it('should accurately calculate SKU performance, win rates, and discount depth', () => {
    const deals: Deal[] = [
      {
        id: 'deal-1',
        name: 'Alpha Deal',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        entityId: 'ent-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-won',
        status: 'won',
        value: 7000,
        mrr: 416.67,
        arr: 5000,
        recurringValue: 5000,
        oneTimeValue: 2000,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        lineItems: [
          {
            id: 'li-1',
            productId: 'prod-core',
            name: 'Core ERP License',
            quantity: 1,
            unitPrice: 5000,
            total: 5000,
            isRecurring: true,
            billingInterval: 'annual',
            discountPercent: 0,
          },
          {
            id: 'li-2',
            productId: 'prod-setup',
            name: 'Implementation & Onboarding',
            quantity: 1,
            unitPrice: 2000,
            total: 2000,
            isRecurring: false,
            billingInterval: 'one_time',
            discountPercent: 10,
          },
        ],
      },
      {
        id: 'deal-2',
        name: 'Beta Deal',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        entityId: 'ent-2',
        pipelineId: 'pipe-1',
        stageId: 'stage-discovery',
        status: 'open',
        value: 5000,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        lineItems: [
          {
            id: 'li-3',
            productId: 'prod-core',
            name: 'Core ERP License',
            quantity: 1,
            unitPrice: 5000,
            total: 5000,
            isRecurring: true,
            discountPercent: 20,
          },
        ],
      },
    ];

    const summary = calculateCommercialAnalytics(
      deals,
      [baseProduct1, baseProduct2],
      [basePackage],
      [baseCategory],
      [basePriceBook]
    );

    expect(summary.totalCatalogRevenueWon).toBe(7000);
    expect(summary.totalActiveSkus).toBe(2);
    expect(summary.totalActivePackages).toBe(1);
    expect(summary.totalPriceBooks).toBe(1);

    // Check Core Product stats
    const coreStat = summary.topProducts.find(p => p.skuOrId === 'prod-core');
    expect(coreStat).toBeDefined();
    expect(coreStat?.totalRevenueWon).toBe(5000);
    expect(coreStat?.totalPipelineValue).toBe(10000); // 5000 won + 5000 pipeline
    expect(coreStat?.dealsTotalCount).toBe(2);
    expect(coreStat?.dealsWonCount).toBe(1);
    expect(coreStat?.winRatePercentage).toBe(50); // 1 won out of 2

    // Check Discount Depth: (10 + 20) / 2 = 15%
    expect(summary.avgDiscountDepth).toBe(15);

    // Check Category Revenue Breakdown
    const catStat = summary.categoryBreakdown.find(c => c.categoryId === 'cat-software');
    expect(catStat).toBeDefined();
    expect(catStat?.totalRevenueWon).toBe(7000);
  });

  it('should generate intelligent pricing warnings when discounting is elevated', () => {
    const dealsWithHeavyDiscount: Deal[] = [
      {
        id: 'deal-disc',
        name: 'Discounted Deal',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        entityId: 'ent-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-won',
        status: 'won',
        value: 4000,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        lineItems: [
          {
            id: 'li-disc',
            productId: 'prod-core',
            name: 'Core ERP License',
            quantity: 1,
            unitPrice: 5000,
            total: 4000,
            discountPercent: 20,
          },
        ],
      },
    ];

    const summary = calculateCommercialAnalytics(
      dealsWithHeavyDiscount,
      [baseProduct1],
      [],
      [baseCategory],
      []
    );

    const recommendations = generateCatalogPricingRecommendations(summary);
    const warning = recommendations.find(r => r.id === 'discount-depth-warning');
    expect(warning).toBeDefined();
    expect(warning?.type).toBe('warning');
    expect(warning?.impactScore).toBe('high');
  });
});
