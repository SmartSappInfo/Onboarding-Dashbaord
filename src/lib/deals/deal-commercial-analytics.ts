/**
 * @fileoverview Deals Platform 2.0 - Commercial & Pricing Analytics Engine
 *
 * ARCHITECTURAL POINTER (Deterministic Commercial Analytics Engine - Rule 10):
 * Provides pure, memoizable mathematical calculators for evaluating:
 * - SKU & Subscription Package commercial performance (Won revenue, deal count, win rate, average discount depth)
 * - Category revenue distribution and recurring revenue (MRR/ARR) contributions
 * - Recurring vs One-Time commercial revenue mix
 * - Grounded, deterministic commercial pricing & bundling insights
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Keep calculations O(N) over deals and O(1) per line item.
 * - Always guard against division by zero (e.g. clamp denominators with Math.max(1, count)).
 * - Strict typing with zero 'any' or 'any[]'.
 *
 * TESTABILITY POINTER:
 * Tested comprehensively in `src/lib/deals/__tests__/deal-commercial-analytics.test.ts`.
 */

import type { 
  Deal, 
  Product, 
  ProductCategory, 
  PriceBook,
  SkuPerformanceMetric, 
  CategoryRevenueMetric, 
  CommercialAnalyticsSummary 
} from './deal-types';
import type { SubscriptionPackage } from '../types';

/**
 * Computes high-level commercial catalog analytics across products, packages, categories, and deals.
 */
export function calculateCommercialAnalytics(
  deals: Deal[] = [],
  products: Product[] = [],
  packages: SubscriptionPackage[] = [],
  categories: ProductCategory[] = [],
  priceBooks: PriceBook[] = []
): CommercialAnalyticsSummary {
  const safeDeals = Array.isArray(deals) ? deals.filter(d => Boolean(d && !d.isArchived)) : [];
  const safeProducts = Array.isArray(products) ? products.filter(p => Boolean(p && p.id)) : [];
  const safePackages = Array.isArray(packages) ? packages.filter(p => Boolean(p && p.id)) : [];
  const safeCategories = Array.isArray(categories) ? categories.filter(c => Boolean(c && c.id)) : [];
  const safePriceBooks = Array.isArray(priceBooks) ? priceBooks.filter(pb => Boolean(pb && pb.id)) : [];

  // 1. Build Lookup Maps for O(1) Category & Product Association
  const categoryMap = new Map<string, ProductCategory>();
  safeCategories.forEach(c => categoryMap.set(c.id, c));

  const productMap = new Map<string, Product>();
  safeProducts.forEach(p => productMap.set(p.id, p));

  const packageMap = new Map<string, SubscriptionPackage>();
  safePackages.forEach(pkg => packageMap.set(pkg.id, pkg));

  // 2. Aggregate SKU / Product Performance
  const skuStatsMap = new Map<string, {
    name: string;
    categoryName: string;
    isRecurring: boolean;
    revenueWon: number;
    pipelineValue: number;
    quantitySold: number;
    dealsWonCount: number;
    dealsTotalCount: number;
    discountPercentages: number[];
  }>();

  // Helper to get or initialize stats
  const getOrCreateSkuStat = (idOrSku: string, defaultName: string, categoryName: string, isRecurring: boolean) => {
    let stat = skuStatsMap.get(idOrSku);
    if (!stat) {
      stat = {
        name: defaultName,
        categoryName: categoryName || 'General',
        isRecurring,
        revenueWon: 0,
        pipelineValue: 0,
        quantitySold: 0,
        dealsWonCount: 0,
        dealsTotalCount: 0,
        discountPercentages: [],
      };
      skuStatsMap.set(idOrSku, stat);
    }
    return stat;
  };

  // Pre-seed catalog items to show zero-sold items in the catalog matrix
  safeProducts.forEach(prod => {
    const cat = prod.categoryId ? categoryMap.get(prod.categoryId) : undefined;
    getOrCreateSkuStat(prod.id, prod.name, cat?.name || 'General', Boolean(prod.isRecurring));
  });

  safePackages.forEach(pkg => {
    getOrCreateSkuStat(pkg.id, pkg.name, 'Subscription Tier', true);
  });

  let totalWonRevenue = 0;
  let totalMrr = 0;
  let totalArr = 0;
  let totalRecurringWon = 0;
  let totalOneTimeWon = 0;
  const allDealDiscountPercentages: number[] = [];

  // Iterate over deals to aggregate performance metrics
  for (const deal of safeDeals) {
    if (!deal) continue;
    const isWon = deal.status === 'won';
    const lineItems = Array.isArray(deal.lineItems) ? deal.lineItems : [];

    // Accumulate MRR/ARR and Deal-level Totals
    if (isWon) {
      const dealVal = typeof deal.value === 'number' && Number.isFinite(deal.value) ? Math.max(0, deal.value) : 0;
      totalWonRevenue += dealVal;

      if (typeof deal.mrr === 'number' && Number.isFinite(deal.mrr)) {
        totalMrr += Math.max(0, deal.mrr);
      }
      if (typeof deal.arr === 'number' && Number.isFinite(deal.arr)) {
        totalArr += Math.max(0, deal.arr);
      }
      if (typeof deal.recurringValue === 'number' && Number.isFinite(deal.recurringValue)) {
        totalRecurringWon += Math.max(0, deal.recurringValue);
      }
      if (typeof deal.oneTimeValue === 'number' && Number.isFinite(deal.oneTimeValue)) {
        totalOneTimeWon += Math.max(0, deal.oneTimeValue);
      }
    }

    // Track deal line items
    for (const item of lineItems) {
      if (!item || !item.name) continue;
      const key = item.productId || item.name;
      const matchingProduct = item.productId ? productMap.get(item.productId) : undefined;
      const matchingPackage = item.productId ? packageMap.get(item.productId) : undefined;

      const catName = matchingProduct?.categoryId 
        ? categoryMap.get(matchingProduct.categoryId)?.name || 'General'
        : matchingPackage ? 'Subscription Tier' : 'Custom Offering';

      const isRecurring = Boolean(item.isRecurring || matchingProduct?.isRecurring || matchingPackage);
      const stat = getOrCreateSkuStat(key, item.name, catName, isRecurring);

      const itemTotal = typeof item.total === 'number' && Number.isFinite(item.total) ? Math.max(0, item.total) : 0;
      const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 1;

      stat.dealsTotalCount += 1;
      stat.pipelineValue += itemTotal;

      if (isWon) {
        stat.dealsWonCount += 1;
        stat.revenueWon += itemTotal;
        stat.quantitySold += qty;
      }

      if (typeof item.discountPercent === 'number' && Number.isFinite(item.discountPercent) && item.discountPercent > 0) {
        const clampedDiscount = Math.min(100, Math.max(0, item.discountPercent));
        stat.discountPercentages.push(clampedDiscount);
        allDealDiscountPercentages.push(clampedDiscount);
      }
    }
  }

  // 3. Transform SKU Stats to Array
  const topProducts: SkuPerformanceMetric[] = Array.from(skuStatsMap.entries()).map(([skuOrId, stat]) => {
    const winRate = stat.dealsTotalCount > 0 
      ? Math.round((stat.dealsWonCount / stat.dealsTotalCount) * 100 * 10) / 10 
      : 0;
    
    const avgDiscount = stat.discountPercentages.length > 0
      ? Math.round((stat.discountPercentages.reduce((sum, d) => sum + d, 0) / stat.discountPercentages.length) * 10) / 10
      : 0;

    return {
      skuOrId,
      name: stat.name,
      categoryName: stat.categoryName,
      isRecurring: stat.isRecurring,
      totalRevenueWon: Math.round(stat.revenueWon * 100) / 100,
      totalPipelineValue: Math.round(stat.pipelineValue * 100) / 100,
      totalQuantitySold: stat.quantitySold,
      dealsWonCount: stat.dealsWonCount,
      dealsTotalCount: stat.dealsTotalCount,
      winRatePercentage: winRate,
      avgDiscountPercentage: avgDiscount,
    };
  }).sort((a, b) => b.totalRevenueWon - a.totalRevenueWon);

  // 4. Aggregate Category Breakdown
  const categoryStatsMap = new Map<string, {
    name: string;
    color?: string;
    revenueWon: number;
    dealsCount: number;
    mrrContribution: number;
  }>();

  // Initialize from known categories
  safeCategories.forEach(cat => {
    categoryStatsMap.set(cat.id, {
      name: cat.name,
      color: cat.color || '#4f46e5',
      revenueWon: 0,
      dealsCount: 0,
      mrrContribution: 0,
    });
  });

  // Include special Category for Subscription Packages
  categoryStatsMap.set('cat_packages', {
    name: 'Subscription Tiers',
    color: '#059669', // Emerald
    revenueWon: 0,
    dealsCount: 0,
    mrrContribution: 0,
  });

  // Populate category aggregates from won deals
  for (const deal of safeDeals) {
    if (deal.status !== 'won') continue;
    const lineItems = Array.isArray(deal.lineItems) ? deal.lineItems : [];

    for (const item of lineItems) {
      if (!item) continue;
      const matchingProduct = item.productId ? productMap.get(item.productId) : undefined;
      const matchingPackage = item.productId ? packageMap.get(item.productId) : undefined;

      let catKey = matchingProduct?.categoryId || 'cat_general';
      if (matchingPackage) catKey = 'cat_packages';

      let catStat = categoryStatsMap.get(catKey);
      if (!catStat) {
        catStat = {
          name: catKey === 'cat_general' ? 'General / Custom' : 'Other Offerings',
          color: '#64748b',
          revenueWon: 0,
          dealsCount: 0,
          mrrContribution: 0,
        };
        categoryStatsMap.set(catKey, catStat);
      }

      const itemTotal = typeof item.total === 'number' && Number.isFinite(item.total) ? Math.max(0, item.total) : 0;
      catStat.revenueWon += itemTotal;
      catStat.dealsCount += 1;

      if (item.isRecurring && typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice)) {
        const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
        const rawMonthly = item.billingInterval === 'annual' ? (item.unitPrice * qty) / 12
          : item.billingInterval === 'quarterly' ? (item.unitPrice * qty) / 3
          : item.unitPrice * qty;
        catStat.mrrContribution += Math.round(rawMonthly * 100) / 100;
      }
    }
  }

  const denominatorRevenue = totalWonRevenue > 0 ? totalWonRevenue : 1;

  const categoryBreakdown: CategoryRevenueMetric[] = Array.from(categoryStatsMap.entries())
    .map(([categoryId, stat]) => ({
      categoryId,
      categoryName: stat.name,
      color: stat.color,
      totalRevenueWon: Math.round(stat.revenueWon * 100) / 100,
      dealsCount: stat.dealsCount,
      revenuePercentage: totalWonRevenue > 0 ? Math.round((stat.revenueWon / denominatorRevenue) * 100 * 10) / 10 : 0,
      mrrContribution: Math.round(stat.mrrContribution * 100) / 100,
    }))
    .filter(c => c.totalRevenueWon > 0 || safeCategories.some(cat => cat.id === c.categoryId))
    .sort((a, b) => b.totalRevenueWon - a.totalRevenueWon);

  // 5. Compute Recurring vs One-Time Mix
  const totalCombinedRevenue = totalRecurringWon + totalOneTimeWon;
  const recurringPercentage = totalCombinedRevenue > 0 
    ? Math.round((totalRecurringWon / totalCombinedRevenue) * 100 * 10) / 10 
    : 0;

  // 6. Overall Average Discount Depth
  const avgDiscountDepth = allDealDiscountPercentages.length > 0
    ? Math.round((allDealDiscountPercentages.reduce((sum, d) => sum + d, 0) / allDealDiscountPercentages.length) * 10) / 10
    : 0;

  return {
    totalCatalogRevenueWon: Math.round(totalWonRevenue * 100) / 100,
    totalActiveSkus: safeProducts.filter(p => p.isActive).length,
    totalActivePackages: safePackages.filter(pkg => pkg.isActive).length,
    totalPriceBooks: safePriceBooks.filter(pb => pb.isActive).length,
    recurringVsOneTimeRatio: {
      mrr: Math.round(totalMrr * 100) / 100,
      arr: Math.round(totalArr * 100) / 100,
      recurringTotal: Math.round(totalRecurringWon * 100) / 100,
      oneTimeTotal: Math.round(totalOneTimeWon * 100) / 100,
      recurringPercentage,
    },
    topProducts,
    categoryBreakdown,
    avgDiscountDepth,
  };
}

/**
 * Generates rule-based commercial pricing and bundling recommendations based on catalog performance.
 */
export function generateCatalogPricingRecommendations(
  summary: CommercialAnalyticsSummary
): Array<{
  id: string;
  type: 'opportunity' | 'warning' | 'tip';
  title: string;
  description: string;
  impactScore: 'high' | 'medium' | 'low';
}> {
  const insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'tip';
    title: string;
    description: string;
    impactScore: 'high' | 'medium' | 'low';
  }> = [];

  // Insight 1: Heavy Discounting Alert
  if (summary.avgDiscountDepth > 15) {
    insights.push({
      id: 'discount-depth-warning',
      type: 'warning',
      title: 'Elevated Discount Depth Detected',
      description: `Sales reps are discounting catalog items by an average of ${summary.avgDiscountDepth}%. Consider establishing standardized price book rules with maximum discount ceilings.`,
      impactScore: 'high',
    });
  }

  // Insight 2: High Win-Rate Star Product
  const starProduct = summary.topProducts.find(p => p.winRatePercentage >= 70 && p.dealsWonCount >= 3);
  if (starProduct) {
    insights.push({
      id: 'star-product-lead',
      type: 'opportunity',
      title: `High Velocity Offering: ${starProduct.name}`,
      description: `"${starProduct.name}" achieves an exceptional ${starProduct.winRatePercentage}% win rate across ${starProduct.dealsWonCount} closed deals. Consider promoting it as a default bundle item in proposals.`,
      impactScore: 'high',
    });
  }

  // Insight 3: Recurring Revenue Growth Opportunity
  if (summary.recurringVsOneTimeRatio.recurringPercentage < 40 && summary.totalActivePackages > 0) {
    insights.push({
      id: 'recurring-mix-opportunity',
      type: 'tip',
      title: 'Optimize For Annual / Recurring Subscriptions',
      description: `Recurring revenue represents ${summary.recurringVsOneTimeRatio.recurringPercentage}% of total commercial intake. Emphasize multi-term packages in deal proposals to accelerate MRR/ARR expansion.`,
      impactScore: 'medium',
    });
  }

  // Default Tip if few deals exist
  if (insights.length === 0) {
    insights.push({
      id: 'catalog-foundation-tip',
      type: 'tip',
      title: 'Commercial Catalog Fully Operational',
      description: 'Your products and subscription packages are active and available across Deal Workspaces, quotes, and invoicing.',
      impactScore: 'low',
    });
  }

  return insights;
}
