/**
 * ARCHITECTURE:
 * Performance Intelligence & Business Attribution Engine (Phase 10)
 * 
 * Computes downstream business conversion metrics, Return on Ad Spend (ROAS),
 * cross-campaign revenue attribution, and export resolution geometries.
 * 
 * CAUTION:
 * Never divide by zero on ad spend calculations (fallback to adSpend || 1).
 * Strict typing (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-performance.test.ts
 */

import type {
  PerformanceMetrics,
  CampaignAttributionSummary,
  ExportOptions,
} from './creative-types';

export interface FormatEfficiency {
  format: string;
  totalImpressions: number;
  totalConversions: number;
  avgConversionRate: number;
  totalRevenue: number;
  rpm: number; // Revenue per 1,000 impressions
}

/**
 * Computes Return on Ad Spend (ROAS) multiplier with decimal rounding.
 */
export function calculateROAS(revenue: number, adSpend: number): number {
  if (adSpend <= 0) return revenue > 0 ? 10.0 : 0;
  return Math.round((revenue / adSpend) * 100) / 100;
}

/**
 * Aggregates workspace performance metrics across a campaign.
 */
export function aggregateCampaignAttribution(
  campaignId: string,
  campaignName: string,
  metrics: PerformanceMetrics[]
): CampaignAttributionSummary {
  if (metrics.length === 0) {
    return {
      campaignId,
      campaignName,
      totalCreatives: 0,
      totalImpressions: 0,
      totalConversions: 0,
      totalRevenue: 0,
      bestPerformingProjectId: '',
    };
  }

  let totalImpressions = 0;
  let totalConversions = 0;
  let totalRevenue = 0;
  let bestProjectId = metrics[0].projectId;
  let highestRevenue = -1;

  for (const m of metrics) {
    totalImpressions += m.impressions;
    totalConversions += m.conversions;
    totalRevenue += m.revenueGenerated;

    if (m.revenueGenerated > highestRevenue) {
      highestRevenue = m.revenueGenerated;
      bestProjectId = m.projectId;
    }
  }

  return {
    campaignId,
    campaignName,
    totalCreatives: metrics.length,
    totalImpressions,
    totalConversions,
    totalRevenue,
    bestPerformingProjectId: bestProjectId,
  };
}

/**
 * Computes format conversion efficiency across visual document types (16:9 vs 9:16 vs 1:1).
 */
export function calculateFormatEfficiency(
  items: { format: string; impressions: number; conversions: number; revenue: number }[]
): FormatEfficiency[] {
  const groups: Record<string, { impressions: number; conversions: number; revenue: number }> = {};

  for (const item of items) {
    if (!groups[item.format]) {
      groups[item.format] = { impressions: 0, conversions: 0, revenue: 0 };
    }
    groups[item.format].impressions += item.impressions;
    groups[item.format].conversions += item.conversions;
    groups[item.format].revenue += item.revenue;
  }

  return Object.entries(groups).map(([format, data]) => {
    const avgConversionRate =
      data.impressions > 0
        ? Math.round((data.conversions / data.impressions) * 1000) / 10
        : 0;
    const rpm =
      data.impressions > 0
        ? Math.round((data.revenue / (data.impressions / 1000)) * 100) / 100
        : 0;

    return {
      format,
      totalImpressions: data.impressions,
      totalConversions: data.conversions,
      avgConversionRate,
      totalRevenue: data.revenue,
      rpm,
    };
  });
}

/**
 * Calculates export dimensions for canvas rasterization based on scale multiplier.
 */
export function getExportDimensions(
  baseWidth: number,
  baseHeight: number,
  scale: ExportOptions['scale']
): { width: number; height: number; dpi: number } {
  const dpi = scale === 4 ? 300 : scale === 2 ? 144 : 72;
  return {
    width: Math.round(baseWidth * scale),
    height: Math.round(baseHeight * scale),
    dpi,
  };
}

export const SAMPLE_PERFORMANCE_METRICS: Record<string, PerformanceMetrics> = {
  'proj-demo-1': {
    projectId: 'proj-demo-1',
    impressions: 48200,
    clicks: 2940,
    ctr: 6.1,
    conversions: 184,
    conversionRate: 6.26,
    pipelineValue: 46000,
    revenueGenerated: 18400,
    adSpend: 3200,
    roas: 5.75,
    topChannel: 'youtube',
  },
};
