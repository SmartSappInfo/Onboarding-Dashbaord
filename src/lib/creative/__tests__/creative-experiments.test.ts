import { describe, it, expect } from 'vitest';
import {
  normalCdf,
  calculateStatisticalSignificance,
  cloneDocumentForExperimentVariant,
} from '../creative-experiments-engine';
import type {
  ExperimentVariant,
  CreativeDocument,
} from '../creative-types';

describe('Creative Experiments & Statistical Significance Engine (Phase 9)', () => {
  it('should accurately approximate standard normal cumulative distribution (normalCdf)', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('should prevent premature winner declaration when sample size is below threshold', () => {
    const control: ExperimentVariant = {
      id: 'var-ctrl',
      name: 'Control',
      documentId: 'doc-1',
      trafficWeight: 50,
      impressions: 120, // < 500
      clicks: 5,
      conversions: 1,
      ctr: 4.17,
      conversionRate: 0.83,
      isControl: true,
    };

    const test: ExperimentVariant = {
      id: 'var-test',
      name: 'Curiosity Hook',
      documentId: 'doc-2',
      trafficWeight: 50,
      impressions: 130, // < 500
      clicks: 12,
      conversions: 3,
      ctr: 9.23,
      conversionRate: 2.31,
      isControl: false,
    };

    const stats = calculateStatisticalSignificance(control, test, 500, 95);
    expect(stats.isSignificant).toBe(false);
    expect(stats.recommendation).toContain('Gathering data');
  });

  it('should detect statistical significance and compute relative CTR lift for valid sample', () => {
    const control: ExperimentVariant = {
      id: 'var-ctrl',
      name: 'Control (Feature List)',
      documentId: 'doc-1',
      trafficWeight: 50,
      impressions: 2500,
      clicks: 100, // 4.0% CTR
      conversions: 20,
      ctr: 4.0,
      conversionRate: 0.8,
      isControl: true,
    };

    const test: ExperimentVariant = {
      id: 'var-test',
      name: 'Variant B (Curiosity Hook)',
      documentId: 'doc-2',
      trafficWeight: 50,
      impressions: 2500,
      clicks: 160, // 6.4% CTR (+60% lift)
      conversions: 45,
      ctr: 6.4,
      conversionRate: 1.8,
      isControl: false,
    };

    const stats = calculateStatisticalSignificance(control, test, 500, 95);
    expect(stats.isSignificant).toBe(true);
    expect(stats.confidenceLevel).toBeGreaterThanOrEqual(95);
    expect(stats.pValue).toBeLessThan(0.05);
    expect(stats.liftPercentage).toBe(60);
    expect(stats.winningVariantId).toBe('var-test');
    expect(stats.recommendation).toContain('Variant B (Curiosity Hook)');
  });

  it('should deep-clone canvas document with fresh isolated element IDs', () => {
    const sourceDoc: CreativeDocument = {
      id: 'doc-orig',
      projectId: 'proj-1',
      workspaceId: 'ws-1',
      name: 'Masterclass Hero',
      format: 'youtube_thumbnail',
      backgroundColor: '#0f172a',
      elements: [
        {
          id: 'el-1',
          type: 'text',
          x: 10,
          y: 20,
          width: 50,
          height: 15,
          text: 'ORIGINAL HEADLINE',
        },
        {
          id: 'el-2',
          type: 'badge',
          x: 70,
          y: 20,
          width: 20,
          height: 10,
          text: 'NEW',
        },
      ],
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const variantDoc = cloneDocumentForExperimentVariant(sourceDoc, 'Curiosity Hook');

    expect(variantDoc.id).not.toBe(sourceDoc.id);
    expect(variantDoc.name).toContain('Curiosity Hook');
    expect(variantDoc.elements.length).toBe(sourceDoc.elements.length);

    // Verify all element IDs are regenerated to prevent cross-variant mutation
    expect(variantDoc.elements[0].id).not.toBe(sourceDoc.elements[0].id);
    expect(variantDoc.elements[1].id).not.toBe(sourceDoc.elements[1].id);
  });
});
