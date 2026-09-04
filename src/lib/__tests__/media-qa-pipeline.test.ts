/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - QA Pipeline Verification Tests
 *
 * Tests:
 * 1. calculateAttributionWeights: 5 models (Linear, First-Touch, Last-Touch, Time-Decay, Position-Based)
 * 2. Mathematical Invariant: sum(weight_i) === 1.0000 across all models and edge cases
 * 3. resolvePersonalizedContent: SSOT token substitution and unpopulated token cleanup
 * 4. assignExperimentVariant: Deterministic FNV-1a session hashing
 */

import { describe, it, expect } from 'vitest';
import { calculateAttributionWeights, type AttributionTouchpoint } from '../media/attribution-service';
import { resolvePersonalizedContent, assignExperimentVariant } from '../media/personalization-rules-service';
import type { ABExperimentConfig } from '../types/media-2.0';

describe('Media QA Pipeline - Attribution Models & Mathematical Invariants', () => {
  const sampleTouchpoints: AttributionTouchpoint[] = [
    {
      assetId: 'asset-video-intro',
      timestamp: '2026-08-01T10:00:00Z',
      type: 'media_play',
      progressPercent: 100,
    },
    {
      assetId: 'asset-doc-pricing',
      timestamp: '2026-08-03T14:30:00Z',
      type: 'download',
    },
    {
      assetId: 'asset-video-tour',
      timestamp: '2026-08-05T09:15:00Z',
      type: 'cta_click',
    },
    {
      assetId: 'asset-doc-pricing', // Repeated touch on pricing doc
      timestamp: '2026-08-07T16:00:00Z',
      type: 'media_progress',
      progressPercent: 90,
    },
  ];

  it('Linear Model: distributes weight equally among unique assets and sums to exactly 1.0000', () => {
    const weights = calculateAttributionWeights(sampleTouchpoints, 'LINEAR');
    expect(weights.size).toBe(3); // intro, pricing, tour

    let sum = 0;
    weights.forEach((v) => {
      sum += v.weight;
      expect(v.weight).toBeCloseTo(1 / 3, 3);
    });
    // Strict invariant check: sum must be exactly 1.0
    expect(Math.round(sum * 10000) / 10000).toBe(1.0);
  });

  it('First-Touch Model: attributes 100% to first unique asset and sums to exactly 1.0', () => {
    const weights = calculateAttributionWeights(sampleTouchpoints, 'FIRST_TOUCH');
    expect(weights.get('asset-video-intro')?.weight).toBe(1.0);
    expect(weights.get('asset-doc-pricing')?.weight).toBe(0.0);
    expect(weights.get('asset-video-tour')?.weight).toBe(0.0);

    let sum = 0;
    weights.forEach((v) => (sum += v.weight));
    expect(sum).toBe(1.0);
  });

  it('Last-Touch Model: attributes 100% to last touched asset and sums to exactly 1.0', () => {
    const weights = calculateAttributionWeights(sampleTouchpoints, 'LAST_TOUCH');
    expect(weights.get('asset-doc-pricing')?.weight).toBe(1.0); // Most recent touch was asset-doc-pricing on Aug 7
    expect(weights.get('asset-video-intro')?.weight).toBe(0.0);
    expect(weights.get('asset-video-tour')?.weight).toBe(0.0);

    let sum = 0;
    weights.forEach((v) => (sum += v.weight));
    expect(sum).toBe(1.0);
  });

  it('Position-Based (U-Shaped) Model: allocates 40% first, 40% last, 20% middle and sums to 1.0', () => {
    const weights = calculateAttributionWeights(sampleTouchpoints, 'POSITION_BASED');
    expect(weights.get('asset-video-intro')?.weight).toBeCloseTo(0.40, 4);
    expect(weights.get('asset-video-tour')?.weight).toBeCloseTo(0.40, 4);
    expect(weights.get('asset-doc-pricing')?.weight).toBeCloseTo(0.20, 4);

    let sum = 0;
    weights.forEach((v) => (sum += v.weight));
    expect(sum).toBe(1.0);
  });

  it('Time-Decay Model: rewards recency and normalizes sum to 1.0', () => {
    const weights = calculateAttributionWeights(sampleTouchpoints, 'TIME_DECAY');
    let sum = 0;
    weights.forEach((v) => (sum += v.weight));
    expect(sum).toBeCloseTo(1.0, 4);

    // Later touch should have higher weight than earlier touch
    const introWeight = weights.get('asset-video-intro')?.weight || 0;
    const pricingWeight = weights.get('asset-doc-pricing')?.weight || 0;
    expect(pricingWeight).toBeGreaterThan(introWeight);
  });

  it('Edge Case: handles empty touchpoint array safely', () => {
    const weights = calculateAttributionWeights([], 'LINEAR');
    expect(weights.size).toBe(0);
  });

  it('Edge Case: single touchpoint receives 100% across all models', () => {
    const singleTouch: AttributionTouchpoint[] = [
      {
        assetId: 'single-asset',
        timestamp: '2026-08-01T10:00:00Z',
        type: 'media_play',
      },
    ];

    const models = ['LINEAR', 'FIRST_TOUCH', 'LAST_TOUCH', 'TIME_DECAY', 'POSITION_BASED'] as const;
    models.forEach((m) => {
      const weights = calculateAttributionWeights(singleTouch, m);
      expect(weights.get('single-asset')?.weight).toBe(1.0);
    });
  });
});

describe('Media QA Pipeline - Personalization & Variable Resolution', () => {
  it('substitutes contact and company tokens cleanly using resolveTextWithMap SSOT', () => {
    const template = 'Welcome {{contact.name}} from {{company.name}}! We are excited to see you.';
    const result = resolvePersonalizedContent(template, {
      contactName: 'Sarah Connor',
      companyName: 'Cyberdyne Systems',
    });

    expect(result).toBe('Welcome Sarah Connor from Cyberdyne Systems! We are excited to see you.');
  });

  it('removes unpopulated tokens cleanly without raw markup leakage', () => {
    const template = 'Hello {{contact.name}}, your deal is currently in {{deal.stage}} with {{unknown.token}}!';
    const result = resolvePersonalizedContent(template, {
      contactName: 'John Doe',
    });

    expect(result).toBe('Hello John Doe, your deal is currently in with !');
  });

  it('falls back to fallbackText when template is empty', () => {
    const result = resolvePersonalizedContent('', {}, 'Default Headline');
    expect(result).toBe('Default Headline');
  });
});

describe('Media QA Pipeline - Deterministic Experiment Variant Assignment', () => {
  const experiment: ABExperimentConfig = {
    id: 'exp-test-1',
    enabled: true,
    trafficSplitPercent: 50,
    variantA: {
      headline: 'Watch Tour',
      buttonText: 'Start Watching',
    },
    variantB: {
      headline: 'See How It Works',
      buttonText: 'Discover Now',
    },
  };

  it('assigns variants deterministically for the same visitorSeed', () => {
    const variant1 = assignExperimentVariant(experiment, 'visitor-12345');
    const variant2 = assignExperimentVariant(experiment, 'visitor-12345');
    expect(variant1).toBe(variant2);

    const variantB1 = assignExperimentVariant(experiment, 'visitor-67890');
    const variantB2 = assignExperimentVariant(experiment, 'visitor-67890');
    expect(variantB1).toBe(variantB2);
  });

  it('returns variantA when experiment is disabled', () => {
    const disabledExp = { ...experiment, enabled: false };
    const result = assignExperimentVariant(disabledExp, 'any-visitor');
    expect(result).toBe('variantA');
  });
});
