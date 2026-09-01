import { describe, it, expect } from 'vitest';
import {
  calculateROAS,
  aggregateCampaignAttribution,
  calculateFormatEfficiency,
  getExportDimensions,
} from '../creative-performance-engine';
import type { PerformanceMetrics } from '../creative-types';

describe('Performance Intelligence, Attribution & Export Warehouse Engine (Phase 10)', () => {
  it('should accurately calculate Return on Ad Spend (ROAS)', () => {
    expect(calculateROAS(18400, 3200)).toBe(5.75);
    expect(calculateROAS(5000, 1000)).toBe(5.0);
    expect(calculateROAS(0, 500)).toBe(0);
    expect(calculateROAS(2000, 0)).toBe(10.0); // Safe fallback for zero ad spend
  });

  it('should aggregate campaign attribution metrics across multiple creative projects', () => {
    const mockMetrics: PerformanceMetrics[] = [
      {
        projectId: 'proj-1',
        impressions: 20000,
        clicks: 1200,
        ctr: 6.0,
        conversions: 80,
        conversionRate: 6.67,
        pipelineValue: 20000,
        revenueGenerated: 8000,
        adSpend: 1500,
        roas: 5.33,
        topChannel: 'youtube',
      },
      {
        projectId: 'proj-2',
        impressions: 30000,
        clicks: 2100,
        ctr: 7.0,
        conversions: 150,
        conversionRate: 7.14,
        pipelineValue: 35000,
        revenueGenerated: 15000,
        adSpend: 2000,
        roas: 7.5,
        topChannel: 'youtube',
      },
    ];

    const summary = aggregateCampaignAttribution('camp-101', 'Q3 Growth Campaign', mockMetrics);

    expect(summary.totalCreatives).toBe(2);
    expect(summary.totalImpressions).toBe(50000);
    expect(summary.totalConversions).toBe(230);
    expect(summary.totalRevenue).toBe(23000);
    expect(summary.bestPerformingProjectId).toBe('proj-2');
  });

  it('should compute format conversion efficiency and RPM', () => {
    const data = [
      { format: '16:9 Landscape', impressions: 40000, conversions: 200, revenue: 16000 },
      { format: '9:16 Story / Reel', impressions: 20000, conversions: 160, revenue: 12000 },
    ];

    const efficiencies = calculateFormatEfficiency(data);

    expect(efficiencies.length).toBe(2);
    const landscape = efficiencies.find((e) => e.format === '16:9 Landscape');
    expect(landscape?.avgConversionRate).toBe(0.5); // (200 / 40000) * 100 = 0.5%
    expect(landscape?.rpm).toBe(400); // 16000 / 40 = 400
  });

  it('should calculate export dimensions and DPI for 1x, 2x, and 4x scale multipliers', () => {
    const dim1x = getExportDimensions(1920, 1080, 1);
    expect(dim1x.width).toBe(1920);
    expect(dim1x.height).toBe(1080);
    expect(dim1x.dpi).toBe(72);

    const dim2x = getExportDimensions(1920, 1080, 2);
    expect(dim2x.width).toBe(3840);
    expect(dim2x.height).toBe(2160);
    expect(dim2x.dpi).toBe(144);

    const dim4x = getExportDimensions(1920, 1080, 4);
    expect(dim4x.width).toBe(7680);
    expect(dim4x.height).toBe(4320);
    expect(dim4x.dpi).toBe(300);
  });
});
