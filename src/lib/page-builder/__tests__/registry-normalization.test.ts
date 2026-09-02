/**
 * @file src/lib/page-builder/__tests__/registry-normalization.test.ts
 * @description Unit tests for block normalization and defensive alias resolution.
 * Verifies that PascalCase, snake_case, and legacy semantic names gracefully map to
 * valid PageBlockType definitions without throwing or degrading to unknown blocks.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { normalizeBlockType, getBlock } from '../registry';
import { registerAllBlocks } from '../blocks';

describe('Block Registry Normalization', () => {
  beforeAll(() => {
    registerAllBlocks();
  });

  it('normalizes PascalCase and legacy section names to canonical block types', () => {
    expect(normalizeBlockType('HeroSection')).toBe('hero');
    expect(normalizeBlockType('hero-section')).toBe('hero');
    expect(normalizeBlockType('hero_section')).toBe('hero');
    expect(normalizeBlockType('TextContentSection')).toBe('text');
    expect(normalizeBlockType('text_section')).toBe('text');
    expect(normalizeBlockType('text-section')).toBe('text');
    expect(normalizeBlockType('FeaturesGridSection')).toBe('choice_cards');
    expect(normalizeBlockType('feature_cards')).toBe('choice_cards');
    expect(normalizeBlockType('TestimonialSection')).toBe('testimonial_grid');
    expect(normalizeBlockType('testimonials_grid')).toBe('testimonial_grid');
    expect(normalizeBlockType('FaqSection')).toBe('faq');
    expect(normalizeBlockType('StepSection')).toBe('step_section');
    expect(normalizeBlockType('ProcedureSection')).toBe('procedure_list');
    expect(normalizeBlockType('CtaSection')).toBe('cta');
    expect(normalizeBlockType('StatsSection')).toBe('stats');
    expect(normalizeBlockType('TitleSection')).toBe('title');
  });

  it('retrieves block definition successfully through normalized alias', () => {
    const heroDef = getBlock('HeroSection' as import('@/lib/types').PageBlockType);
    expect(heroDef).toBeDefined();
    expect(heroDef?.type).toBe('hero');

    const textDef = getBlock('TextContentSection' as import('@/lib/types').PageBlockType);
    expect(textDef).toBeDefined();
    expect(textDef?.type).toBe('text');

    const featureDef = getBlock('FeaturesGridSection' as import('@/lib/types').PageBlockType);
    expect(featureDef).toBeDefined();
    expect(featureDef?.type).toBe('choice_cards');
  });

  it('preserves exact registered types', () => {
    expect(normalizeBlockType('hero')).toBe('hero');
    expect(normalizeBlockType('text')).toBe('text');
    expect(normalizeBlockType('cta')).toBe('cta');
    expect(normalizeBlockType('choice_cards')).toBe('choice_cards');
  });
});
