/**
 * @file src/ai/flows/__tests__/modify-page-flow.test.ts
 * @description Unit tests for AI modify page output schema and structure normalization.
 */

import { describe, it, expect } from 'vitest';
import { normalizeBlockType } from '@/lib/page-builder/registry';

describe('modifyPageFlow Schema & Actions Contract', () => {
  it('recognizes all standard PageBlockTypes used in Hero Journey generation', () => {
    const requiredTypes = [
      'hero',
      'title',
      'text',
      'choice_cards',
      'step_section',
      'procedure_list',
      'testimonial_grid',
      'testimonial',
      'stats',
      'faq',
      'cta',
      'columns',
      'container',
      'logo_grid',
      'image',
      'video',
    ];

    for (const t of requiredTypes) {
      expect(normalizeBlockType(t)).toBe(t);
    }
  });

  it('normalizes legacy aliases that LLMs might generate', () => {
    expect(normalizeBlockType('HeroSection')).toBe('hero');
    expect(normalizeBlockType('TextContentSection')).toBe('text');
    expect(normalizeBlockType('FeaturesGridSection')).toBe('choice_cards');
    expect(normalizeBlockType('StepSection')).toBe('step_section');
    expect(normalizeBlockType('TestimonialSection')).toBe('testimonial_grid');
    expect(normalizeBlockType('CtaSection')).toBe('cta');
  });
});
